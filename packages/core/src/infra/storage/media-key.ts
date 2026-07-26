/**
 * Forma da chave de mídia: `<orgId>/<uuid>.<ext>` (a mesma que `storeSniffed` cunha).
 *
 * O driver local se defende de travessia resolvendo o caminho e comparando com a raiz —
 * defesa com forma de sistema de arquivos, que um bucket NÃO tem: lá `..` é só uma
 * sequência de caracteres, e uma chave malformada criaria um objeto fora do prefixo da
 * organização em silêncio. Por isso a validação de FORMA é compartilhada pelos drivers e
 * roda antes de qualquer chamada de rede ou toque em disco.
 */

const ORG_RE = /^[0-9a-f-]{36}$/i;
const FILE_RE = /^[0-9a-f-]{36}\.([a-z0-9]{2,5})$/i;

export interface MediaKeyParts {
  orgId: string;
  file: string;
  /** extensão normalizada em minúsculas (mapeia p/ o content-type na rota pública) */
  ext: string;
}

/** Decompõe a chave, ou `null` se ela não estiver na forma esperada. */
export function parseMediaKey(key: string): MediaKeyParts | null {
  if (key.includes('\\')) return null;
  const segments = key.split('/');
  if (segments.length !== 2) return null;
  const [orgId, file] = segments as [string, string];
  if (!ORG_RE.test(orgId)) return null;
  const ext = FILE_RE.exec(file)?.[1];
  if (!ext) return null;
  return { orgId, file, ext: ext.toLowerCase() };
}

/** Devolve a chave intacta, ou lança — chave inválida é erro de programação, não de usuário. */
export function assertMediaKey(key: string): string {
  if (!parseMediaKey(key)) {
    throw new Error('chave de mídia inválida');
  }
  return key;
}
