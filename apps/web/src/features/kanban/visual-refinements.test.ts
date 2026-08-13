import { describe, expect, test } from 'bun:test';
import { openingTags, sourceReader, stripComments } from '@/test-utils/source-lint';

/**
 * Leitura do FONTE do quadro — SÓ regras genéricas do brand (o buraco do `cn()` no
 * `check:brand`). Asserções de marcação concreta vivem em `kanban-blocks.test.tsx`,
 * renderizadas de verdade, onde um refactor de arquivo não produz falha falsa.
 */

const ARQUIVOS = [
  'kanban-board.tsx',
  'kanban-card.tsx',
  'kanban-column.tsx',
  'kanban-filters.tsx',
  'bulk-bar.tsx',
  'kanban-view.tsx',
] as const;

const source = sourceReader(import.meta.url);

describe('conformidade visual do quadro', () => {
  test.each(ARQUIVOS)('%s não usa sombra (proibida sempre no brand)', async (arquivo) => {
    expect(await source(`./${arquivo}`)).not.toMatch(/\bshadow-/);
  });

  test.each(ARQUIVOS)('%s não move elementos no hover', async (arquivo) => {
    const src = await source(`./${arquivo}`);
    expect(src).not.toMatch(/hover:(translate|scale|rotate)/);
  });

  test.each(ARQUIVOS)('%s usa somente raios semânticos do sistema', async (arquivo) => {
    const src = await source(`./${arquivo}`);
    const raios = src.match(/\brounded-[a-z[\]0-9.-]+/g) ?? [];
    for (const r of raios) {
      expect([
        'rounded-key',
        'rounded-compact',
        'rounded-tooltip',
        'rounded-control',
        'rounded-card',
        'rounded-kpi',
        'rounded-full',
      ]).toContain(r);
    }
  });

  test.each(ARQUIVOS)('%s usa a escala tipográfica nomeada, nunca valor arbitrário', async (arquivo) => {
    expect(await source(`./${arquivo}`)).not.toMatch(/\btext-\[/);
  });

  test('todo <button> cru do card e dos filtros declara cursor-pointer', async () => {
    const crus: string[] = [];
    for (const arquivo of ARQUIVOS) {
      // comentários citam `<button>` ao explicar por que o card deixou de ser um: não são markup
      const src = stripComments(await source(`./${arquivo}`));
      // gatilhos crus (não o componente <Button>, que já traz cursor-pointer na variante)
      crus.push(
        ...openingTags(src, ['button', 'DropdownMenuTrigger']).filter(
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

  test('o quadro não inventa denominador de capacidade', async () => {
    // a marcação concreta de coluna/card (superfície, sticky, ponto de estado, moldura)
    // é assertada RENDERIZADA em kanban-blocks.test.tsx
    expect(await source('./kanban-board.tsx')).not.toMatch(/\d+\s*\/\s*\d+/);
  });

  test.each(ARQUIVOS)('%s não usa animate-* sem desligar sob reduced motion', async (arquivo) => {
    const src = await source(`./${arquivo}`);
    const linhas = src.split('\n').filter((l) => /\banimate-(spin|pulse|ping|bounce)\b/.test(l));
    for (const l of linhas) {
      expect(l).toContain('motion-reduce:animate-none');
    }
  });
});
