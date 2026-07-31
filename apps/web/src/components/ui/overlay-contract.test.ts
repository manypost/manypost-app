import { describe, expect, test } from 'bun:test';

/**
 * Contrato da escala de bordas (brand v1.4).
 *
 * Existe porque a regra é de acessibilidade, não de gosto, e nenhuma outra coisa a prende. Sem
 * sombra e sem relevo, um dropdown branco sobre um card branco fica separado só pela borda — e a
 * WCAG 1.4.11 pede 3:1 quando a borda é o único identificador do componente. `--line` dá 1,44:1;
 * `--line-strong` dá 3,22:1.
 *
 * O `check:brand` não consegue verificar isto: ele casa linha a linha e não sabe qual componente
 * renderiza em portal. Aqui a lista é nominal de propósito — acrescentar um overlay novo obriga a
 * acrescentar uma linha, que é o momento em que alguém decide conscientemente.
 */

const source = (name: string) => Bun.file(new URL(name, import.meta.url)).text();

/** conteúdo que renderiza em portal, por cima de superfície de mesma cor */
const EM_PORTAL = [
  'dropdown-menu.tsx',
  'popover.tsx',
  'select.tsx',
  'dialog.tsx',
  'sheet.tsx',
  'alert-dialog.tsx',
] as const;

/** controles de entrada: mesma raiz — caixa branca dentro de caixa branca */
const CAMPOS = ['input.tsx', 'textarea.tsx', 'select.tsx'] as const;

describe('limite de componente usa a borda forte', () => {
  test.each(EM_PORTAL)('%s declara border-line-strong', async (arquivo) => {
    expect(await source(`./${arquivo}`)).toContain('border-line-strong');
  });

  test.each(CAMPOS)('%s declara border-line-strong', async (arquivo) => {
    expect(await source(`./${arquivo}`)).toContain('border-line-strong');
  });

  test('o botão outline também — sem relevo, a borda é o único limite do controle', async () => {
    const src = await source('./button.tsx');
    const outline = src.match(/outline:\s*'([^']+)'/);
    expect(outline).not.toBeNull();
    expect(outline![1]).toContain('border-line-strong');
  });
});

describe('o relevo por gradiente não volta pela porta dos fundos', () => {
  const TODOS = [...new Set([...EM_PORTAL, ...CAMPOS, 'button.tsx', 'card.tsx', 'badge.tsx', 'tooltip.tsx'])];

  test.each(TODOS)('%s não usa classe de relevo', async (arquivo) => {
    const src = await source(`./${arquivo}`);
    expect(src).not.toMatch(/\bbevel-/);
    expect(src).not.toMatch(/\binset-field\b/);
  });

  test.each(TODOS)('%s não usa sombra', async (arquivo) => {
    expect(await source(`./${arquivo}`)).not.toMatch(/\bshadow-(?!none\b)/);
  });

  test('o hover dos preenchidos é transição de cor, não filtro de brilho', async () => {
    const src = await source('./button.tsx');
    // `filter: brightness()` só existia porque não dá para transicionar um linear-gradient
    expect(src).not.toContain('hover:brightness');
    expect(src).toContain('hover:bg-accent-hover');
    expect(src).toContain('hover:bg-destructive-hover');
  });
});

describe('camadas de fundo', () => {
  test('a superfície do card é fill chapado, não gradiente', async () => {
    const src = await source('./card.tsx');
    expect(src).toContain('bg-surface');
    expect(src).not.toContain('linear-gradient');
  });

  test('o tooltip se separa por ser escuro, sem precisar da borda forte', async () => {
    const src = await source('./tooltip.tsx');
    expect(src).toContain('bg-ink');
  });

  test('a variante enterprise não existe mais (era código morto)', async () => {
    // sem os comentários: o docstring do arquivo cita a variante ao registrar que ela saiu
    const src = (await source('./button.tsx')).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toContain('enterprise');
  });

  test('date-time picker usa a altura e a borda padrão de campo', async () => {
    const src = await source('date-time-picker.tsx');

    expect(src).toContain('h-[38px]');
    expect(src).toContain('border-line-strong');
    expect(src).not.toContain("'flex h-9");
  });
});
