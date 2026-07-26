import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import type { MediaStorage } from '../../application/ports/media';
import { assertMediaKey } from './media-key';
import { joinPublicBase } from './public-base';

/**
 * Storage local (self-host, SPEC_INFRA §2): volume de uploads servido pela própria API.
 *
 * `publicBase` é a URL sob a qual as CHAVES são servidas diretamente — quem decide se ela
 * é `MEDIA_PUBLIC_URL` ou `PUBLIC_URL/uploads` é o mapeamento de ambiente (`@manypost/config`),
 * não o driver.
 */
export function makeLocalMediaStorage(opts: { dir: string; publicBase: string }): MediaStorage {
  const root = resolve(opts.dir);
  const safePath = (key: string) => {
    const p = normalize(join(root, assertMediaKey(key)));
    // defesa em profundidade: a forma da chave já impede escapar da raiz, mas o driver
    // não depende disso — se a regra de forma um dia afrouxar, a contenção continua aqui
    if (p !== root && !p.startsWith(root + sep)) {
      throw new Error('chave de mídia fora do diretório de uploads');
    }
    return p;
  };

  return {
    async put(key, bytes) {
      const p = safePath(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, bytes);
    },
    async read(key) {
      const p = safePath(key);
      try {
        return new Uint8Array(await readFile(p));
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(safePath(key), { force: true });
    },
    publicUrl(key) {
      return joinPublicBase(opts.publicBase, key);
    },
  };
}
