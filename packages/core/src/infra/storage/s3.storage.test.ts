import { ErrorCodes } from '@manypost/contracts';
import { describe, expect, test } from 'bun:test';
import { DomainError } from '../../domain/shared/result';
import { makeS3MediaStorage, type S3ObjectClient } from './s3.storage';

const ORG = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const KEY = `${ORG}/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c.png`;
const CREDENCIAL = 'segredo-do-bucket-nao-pode-vazar';

const s3Error = (code: string) =>
  Object.assign(new Error('an unexpected error has occurred'), { name: 'S3Error', code });

/** Dublê do `Bun.S3Client` — o driver só usa write/file/delete (AGENTS: zero rede em teste). */
function fakeClient(overrides?: {
  onWrite?: () => Promise<number>;
  onRead?: () => Promise<ArrayBuffer>;
  onDelete?: () => Promise<void>;
}) {
  const calls: Array<{ op: string; key: string; type?: string; bytes?: Uint8Array }> = [];
  const objects = new Map<string, Uint8Array>();
  const client: S3ObjectClient = {
    async write(key, bytes, opts) {
      calls.push({ op: 'write', key, type: opts.type, bytes });
      if (overrides?.onWrite) return overrides.onWrite();
      objects.set(key, bytes);
      return bytes.byteLength;
    },
    file(key) {
      return {
        async arrayBuffer() {
          calls.push({ op: 'read', key });
          if (overrides?.onRead) return overrides.onRead();
          const found = objects.get(key);
          if (!found) throw s3Error('NoSuchKey');
          return found.buffer.slice(
            found.byteOffset,
            found.byteOffset + found.byteLength,
          ) as ArrayBuffer;
        },
      };
    },
    async delete(key) {
      calls.push({ op: 'delete', key });
      if (overrides?.onDelete) return overrides.onDelete();
      objects.delete(key);
    },
  };
  return { client, calls, objects };
}

const makeStorage = (client: S3ObjectClient) =>
  makeS3MediaStorage({
    bucket: 'manypost-media',
    region: 'auto',
    endpoint: 'https://conta.r2.cloudflarestorage.com',
    accessKeyId: 'chave-publica',
    secretAccessKey: CREDENCIAL,
    publicBase: 'https://media.exemplo',
    client,
  });

describe('storage S3/R2', () => {
  test('grava com a chave e o content-type recebidos', async () => {
    const fake = fakeClient();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await makeStorage(fake.client).put(KEY, bytes, 'image/png');
    expect(fake.calls).toEqual([{ op: 'write', key: KEY, type: 'image/png', bytes }]);
    expect(fake.objects.get(KEY)).toEqual(bytes);
  });

  test('lê de volta os bytes gravados', async () => {
    const fake = fakeClient();
    const storage = makeStorage(fake.client);
    const bytes = new Uint8Array([9, 8, 7]);
    await storage.put(KEY, bytes, 'image/png');
    expect(await storage.read(KEY)).toEqual(bytes);
  });

  // a rota pública responde 404 nesse caso — nunca 500
  test('objeto ausente devolve null em vez de lançar', async () => {
    expect(await makeStorage(fakeClient().client).read(KEY)).toBeNull();
  });

  test('apagar objeto ausente não lança', async () => {
    await expect(makeStorage(fakeClient().client).delete(KEY)).resolves.toBeUndefined();
  });

  test('chave inválida é recusada antes de qualquer chamada ao bucket', async () => {
    const fake = fakeClient();
    const storage = makeStorage(fake.client);
    await expect(storage.put(`${ORG}/../fora.png`, new Uint8Array([1]), 'image/png')).rejects.toThrow(
      /chave de mídia inválida/,
    );
    await expect(storage.read('../fora.png')).rejects.toThrow(/chave de mídia inválida/);
    await expect(storage.delete(`${ORG}\\fora.png`)).rejects.toThrow(/chave de mídia inválida/);
    expect(fake.calls).toEqual([]);
  });

  test('falha de gravação vira media.store_failed sem vazar credencial', async () => {
    const fake = fakeClient({ onWrite: () => Promise.reject(s3Error('AccessDenied')) });
    const erro = await makeStorage(fake.client)
      .put(KEY, new Uint8Array([1]), 'image/png')
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(DomainError);
    expect((erro as DomainError).code).toBe(ErrorCodes.MediaStoreFailed);
    expect((erro as DomainError).message).toContain('AccessDenied');
    expect((erro as DomainError).message).not.toContain(CREDENCIAL);
  });

  // AccessDenied na leitura NÃO pode virar null: seria credencial errada mascarada de 404
  test('falha de leitura que não é NoSuchKey vira media.store_failed', async () => {
    const fake = fakeClient({ onRead: () => Promise.reject(s3Error('NoSuchBucket')) });
    const erro = await makeStorage(fake.client)
      .read(KEY)
      .catch((e: unknown) => e);
    expect((erro as DomainError).code).toBe(ErrorCodes.MediaStoreFailed);
  });

  test('publicUrl deriva da base pública, não do endpoint do bucket', () => {
    expect(makeStorage(fakeClient().client).publicUrl(KEY)).toBe(`https://media.exemplo/${KEY}`);
  });
});
