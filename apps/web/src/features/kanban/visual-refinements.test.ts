import { describe, expect, test } from 'bun:test';

/**
 * Leitura do FONTE do quadro.
 *
 * O `check:brand` é regex por linha sobre o repositório inteiro e escapa de `className` montado por
 * `cn()` com variável — que é exatamente como o card e os filtros novos são escritos. Estes testes
 * cobrem esse buraco nos arquivos onde ele é mais provável.
 */

const ARQUIVOS = [
  'kanban-board.tsx',
  'kanban-card.tsx',
  'kanban-column.tsx',
  'kanban-filters.tsx',
  'bulk-bar.tsx',
  'kanban-view.tsx',
] as const;

const source = (name: string) => Bun.file(new URL(name, import.meta.url)).text();

/** tira comentários de bloco e de linha, para prosa sobre markup não ser lida como markup */
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Extrai a tag de abertura inteira de cada `<nome ...>`.
 *
 * Um regex ganancioso não serve: `onClick={() => …}` tem um `>` dentro de chaves, e a busca pelo
 * primeiro `>` corta a tag no meio. Aqui o `>` só fecha quando a profundidade de chaves é zero.
 */
function tagsDeAbertura(src: string, nomes: string[]): string[] {
  const out: string[] = [];
  for (const nome of nomes) {
    const re = new RegExp(`<${nome}\\b`, 'g');
    for (let m = re.exec(src); m; m = re.exec(src)) {
      let profundidade = 0;
      for (let i = m.index; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') profundidade++;
        else if (ch === '}') profundidade--;
        else if (ch === '>' && profundidade === 0) {
          out.push(src.slice(m.index, i + 1));
          break;
        }
      }
    }
  }
  return out;
}

describe('conformidade visual do quadro', () => {
  test.each(ARQUIVOS)('%s não usa sombra (proibida sempre no brand)', async (arquivo) => {
    expect(await source(`./${arquivo}`)).not.toMatch(/\bshadow-/);
  });

  test.each(ARQUIVOS)('%s não move elementos no hover', async (arquivo) => {
    const src = await source(`./${arquivo}`);
    expect(src).not.toMatch(/hover:(translate|scale|rotate)/);
  });

  test.each(ARQUIVOS)('%s usa só a escala de raio 4/6/8', async (arquivo) => {
    const src = await source(`./${arquivo}`);
    const raios = src.match(/\brounded-[a-z[\]0-9.-]+/g) ?? [];
    for (const r of raios) {
      expect(['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-full']).toContain(r);
    }
  });

  test.each(ARQUIVOS)('%s usa a escala tipográfica nomeada, nunca valor arbitrário', async (arquivo) => {
    expect(await source(`./${arquivo}`)).not.toMatch(/\btext-\[/);
  });

  test('todo <button> cru do card e dos filtros declara cursor-pointer', async () => {
    const crus: string[] = [];
    for (const arquivo of ARQUIVOS) {
      // comentários citam `<button>` ao explicar por que o card deixou de ser um: não são markup
      const src = semComentarios(await source(`./${arquivo}`));
      // gatilhos crus (não o componente <Button>, que já traz cursor-pointer na variante)
      crus.push(
        ...tagsDeAbertura(src, ['button', 'DropdownMenuTrigger']).filter(
          (tag) => !tag.includes('asChild'),
        ),
      );
    }
    expect(crus.length).toBeGreaterThan(0);
    for (const tag of crus) {
      // grab e pointer são os dois cursores legítimos aqui: o card arrastável promete arrasto
      expect(tag).toMatch(/cursor-(pointer|grab)/);
    }
  });

  test('toda transição/animação convive com motion-reduce ou é só de cor', async () => {
    const src = await source('./kanban-card.tsx');
    // a única animação do card é de opacidade nos controles — precisa desligar sob reduced motion
    expect(src).toContain('motion-reduce:transition-none');
  });

  test('coluna é palco sem borda; card arrastável preserva a moldura', async () => {
    const coluna = await source('./kanban-column.tsx');
    const card = await source('./kanban-card.tsx');

    expect(coluna).not.toContain('border border-line border-t-2');
    expect(coluna).toContain("'size-1.5 shrink-0 rounded-full'");
    expect(card).toContain('rounded-md border bg-surface');
  });

  test.each(ARQUIVOS)('%s não usa animate-* sem desligar sob reduced motion', async (arquivo) => {
    const src = await source(`./${arquivo}`);
    const linhas = src.split('\n').filter((l) => /\banimate-(spin|pulse|ping|bounce)\b/.test(l));
    for (const l of linhas) {
      expect(l).toContain('motion-reduce:animate-none');
    }
  });
});
