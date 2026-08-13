/**
 * Helpers de "lint por teste" sobre o código-fonte dos componentes.
 *
 * O `check:brand` é regex por linha sobre o repositório inteiro e escapa de `className` montado
 * por `cn()` com variável. Os testes de conformidade por feature cobrem esse buraco lendo o fonte
 * — mas as REGRAS devem ser genéricas (proibições do brand), nunca pins de markup exato: para
 * afirmar marcação, renderize com `renderToStaticMarkup` e asserte o HTML emitido.
 *
 * Antes deste módulo, cada feature copiava `source()`/`semComentarios`/`tagsDeAbertura`.
 */

import { readFile } from 'node:fs/promises';

/** leitor de fonte relativo ao arquivo de teste: `const source = sourceReader(import.meta.url)` */
export const sourceReader = (base: string | URL) => (name: string) =>
  readFile(new URL(name, base), 'utf8');

/** tira comentários de bloco e de linha, para prosa sobre markup não ser lida como markup */
export const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Extrai a tag de abertura inteira de cada `<nome ...>`.
 *
 * Um regex ganancioso não serve: `onClick={() => …}` tem um `>` dentro de chaves, e a busca pelo
 * primeiro `>` corta a tag no meio. Aqui o `>` só fecha quando a profundidade de chaves é zero.
 */
export function openingTags(src: string, names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    const re = new RegExp(`<${name}\\b`, 'g');
    for (let m = re.exec(src); m; m = re.exec(src)) {
      let depth = 0;
      for (let i = m.index; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (ch === '>' && depth === 0) {
          out.push(src.slice(m.index, i + 1));
          break;
        }
      }
    }
  }
  return out;
}
