import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeLocalMediaStorage } from './local.storage';

const ORG = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const KEY = `${ORG}/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c.png`;
const dir = await mkdtemp(join(tmpdir(), 'mp-local-storage-'));
const storage = makeLocalMediaStorage({ dir, publicBase: 'https://app.exemplo/uploads' });

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('storage local', () => {
  test('grava, lê e apaga pela chave', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await storage.put(KEY, bytes, 'image/png');
    expect(await storage.read(KEY)).toEqual(bytes);
    await storage.delete(KEY);
    expect(await storage.read(KEY)).toBeNull();
  });

  test('ler chave inexistente devolve null (a rota pública responde 404, não 500)', async () => {
    expect(await storage.read(`${ORG}/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d.png`)).toBeNull();
  });

  test('publicUrl é base + chave', () => {
    expect(storage.publicUrl(KEY)).toBe(`https://app.exemplo/uploads/${KEY}`);
  });

  test('barra sobrando na base não duplica', () => {
    const s = makeLocalMediaStorage({ dir, publicBase: 'https://media.exemplo//' });
    expect(s.publicUrl(KEY)).toBe(`https://media.exemplo/${KEY}`);
  });

  test('chave inválida é recusada antes de tocar o disco', async () => {
    const antes = await readdir(dir);
    await expect(storage.put(`../fora.png`, new Uint8Array([9]), 'image/png')).rejects.toThrow(
      /chave de mídia inválida/,
    );
    await expect(storage.read(`${ORG}/../../etc/passwd`)).rejects.toThrow(/chave de mídia inválida/);
    await expect(storage.delete(`${ORG}\\fora.png`)).rejects.toThrow(/chave de mídia inválida/);
    expect(await readdir(dir)).toEqual(antes);
  });
});
