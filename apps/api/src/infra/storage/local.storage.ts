import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import type { MediaStorage } from '@manypost/core';

/** Storage local (self-host, SPEC_INFRA §2): volume de uploads servido em PUBLIC_URL/uploads. */
export function makeLocalMediaStorage(opts: { dir: string; publicBaseUrl: string }): MediaStorage {
  const root = resolve(opts.dir);
  const safePath = (key: string) => {
    const p = normalize(join(root, key));
    if (p !== root && !p.startsWith(root + sep)) {
      throw new Error('chave de mídia fora do diretório de uploads');
    }
    return p;
  };
  const base = opts.publicBaseUrl.replace(/\/+$/, '');

  return {
    async put(key, bytes) {
      const p = safePath(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, bytes);
    },
    async read(key) {
      try {
        return new Uint8Array(await readFile(safePath(key)));
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(safePath(key), { force: true });
    },
    publicUrl(key) {
      return `${base}/uploads/${key}`;
    },
  };
}
