import { ErrorCodes } from '@manypost/contracts';
import type { MediaStorage } from '../../application/ports/media';
import { DomainError } from '../../domain/shared/result';
import { assertMediaKey } from './media-key';
import { joinPublicBase } from './public-base';

/**
 * Storage S3-compatível (Cloudflare R2, AWS S3, MinIO) — a família Meta e o Dev.to fazem
 * *pull* da mídia por URL pública, então o endereço publicado não pode depender da origem
 * do app (design D1/D3 da mudança `add-s3-media-storage`).
 *
 * Roda sobre o `Bun.S3Client` nativo: zero dependência nova num monorepo que já escreve à
 * mão o sniffer de magic bytes e o parser de MP4. O acoplamento ao runtime Bun fica preso
 * a este adapter — o port e os casos de uso seguem agnósticos.
 */

/** Superfície mínima que o driver usa do `Bun.S3Client` (costura para teste — design D2). */
export interface S3ObjectClient {
  write(key: string, bytes: Uint8Array, opts: { type: string }): Promise<unknown>;
  file(key: string): { arrayBuffer(): Promise<ArrayBuffer> };
  delete(key: string): Promise<void>;
}

export interface S3MediaStorageOptions {
  bucket: string;
  /** `auto` no R2; região real na AWS */
  region?: string;
  /** obrigatório no R2/MinIO; na AWS o padrão do SDK resolve */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** URL sob a qual as chaves são servidas publicamente (bucket público/CDN) */
  publicBase: string;
  /** injetado só em teste; em produção o driver constrói o cliente nativo */
  client?: S3ObjectClient;
}

/** Código do erro do S3 sem arrastar mensagem de biblioteca (nem credencial) para o log. */
const s3Code = (err: unknown): string | undefined => {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
};

const storeFailed = (op: string, err: unknown): DomainError =>
  new DomainError(
    ErrorCodes.MediaStoreFailed,
    `falha ao ${op} mídia no storage (S3: ${s3Code(err) ?? 'erro desconhecido'})`,
  );

export function makeS3MediaStorage(opts: S3MediaStorageOptions): MediaStorage {
  const client: S3ObjectClient =
    opts.client ??
    new Bun.S3Client({
      bucket: opts.bucket,
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      ...(opts.region ? { region: opts.region } : {}),
      ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
    });

  return {
    async put(key, bytes, mime) {
      const safe = assertMediaKey(key);
      try {
        await client.write(safe, bytes, { type: mime });
      } catch (err) {
        throw storeFailed('gravar', err);
      }
    },
    async read(key) {
      const safe = assertMediaKey(key);
      try {
        return new Uint8Array(await client.file(safe).arrayBuffer());
      } catch (err) {
        // só a ausência do objeto vira `null`. AccessDenied/NoSuchBucket precisam doer:
        // engolidos, mascarariam credencial ou bucket errado como 404 de mídia
        if (s3Code(err) === 'NoSuchKey') return null;
        throw storeFailed('ler', err);
      }
    },
    async delete(key) {
      const safe = assertMediaKey(key);
      try {
        await client.delete(safe);
      } catch (err) {
        if (s3Code(err) === 'NoSuchKey') return;
        throw storeFailed('apagar', err);
      }
    },
    publicUrl(key) {
      return joinPublicBase(opts.publicBase, key);
    },
  };
}
