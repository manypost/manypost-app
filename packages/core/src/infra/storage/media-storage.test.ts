import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { makeMediaStorage } from './media-storage';

const KEY = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c.png';

describe('escolha do driver de storage', () => {
  test('local serve pela base configurada', () => {
    const storage = makeMediaStorage({
      driver: 'local',
      dir: tmpdir(),
      publicBase: 'https://app.exemplo/uploads',
    });
    expect(storage.publicUrl(KEY)).toBe(`https://app.exemplo/uploads/${KEY}`);
  });

  test('s3 serve pela base pública do bucket, não pelo endpoint', () => {
    const storage = makeMediaStorage({
      driver: 's3',
      bucket: 'manypost-media',
      region: 'auto',
      endpoint: 'https://conta.r2.cloudflarestorage.com',
      accessKeyId: 'chave-publica',
      secretAccessKey: 'nao-usado-sem-chamada',
      publicBase: 'https://media.exemplo',
    });
    expect(storage.publicUrl(KEY)).toBe(`https://media.exemplo/${KEY}`);
  });
});
