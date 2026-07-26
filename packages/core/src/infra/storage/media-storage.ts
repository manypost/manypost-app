import type { MediaStorage } from '../../application/ports/media';
import { makeLocalMediaStorage } from './local.storage';
import { makeS3MediaStorage, type S3MediaStorageOptions } from './s3.storage';

/**
 * Configuração resolvida do storage de mídia. Quem traduz ambiente → esta forma é
 * `mediaStorageConfigFromEnv` em `@manypost/config` (mesmo precedente do
 * `providerSecretsFromEnv`): `packages/config` vem ANTES do core no grafo, então os dois
 * lados declaram a forma e a compatibilidade é estrutural — checada no composition root.
 */
export type MediaStorageConfig =
  | { driver: 'local'; dir: string; publicBase: string }
  | ({ driver: 's3' } & Omit<S3MediaStorageOptions, 'client'>);

/** Um único ponto de escolha do driver — a api e o worker dedicado não podem divergir. */
export function makeMediaStorage(config: MediaStorageConfig): MediaStorage {
  if (config.driver === 'local') {
    return makeLocalMediaStorage({ dir: config.dir, publicBase: config.publicBase });
  }
  const { driver: _driver, ...s3 } = config;
  return makeS3MediaStorage(s3);
}
