import { describe, expect, test } from 'bun:test';

/**
 * Leitura do fonte da paleta.
 *
 * O `check:brand` é regex por linha e escapa de `className` montado por `cn()` com variável — que é
 * exatamente como os itens da paleta são escritos. Estes testes cobrem esse buraco onde ele é mais
 * provável, e prendem o contrato do diálogo em `palette`.
 */

const source = (name: string) => Bun.file(new URL(name, import.meta.url)).text();

const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('conformidade visual da paleta', () => {
  test('não usa sombra', async () => {
    expect(await source('./command-palette.tsx')).not.toMatch(/\bshadow-/);
  });

  test('não move elementos no hover', async () => {
    expect(await source('./command-palette.tsx')).not.toMatch(/hover:(translate|scale|rotate)/);
  });

  test('usa a escala tipográfica nomeada, nunca valor arbitrário', async () => {
    expect(await source('./command-palette.tsx')).not.toMatch(/\btext-\[/);
  });

  test('todo botão cru da lista declara cursor-pointer', async () => {
    const src = semComentarios(await source('./command-palette.tsx'));
    const tags = src.match(/<button\b[^]*?type="button"/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    // cada <button …> do arquivo carrega cursor-pointer na sua string de classe
    const classes = src.match(/className=\{?cn\(\s*'([^']+)'|className="([^"]+)"/g) ?? [];
    const doItem = classes.filter((c) => c.includes('w-full') && c.includes('rounded-sm'));
    for (const c of doItem) expect(c).toContain('cursor-pointer');
  });

  test('o diálogo tem a variante palette, ancorada no topo e sem sombra', async () => {
    const dialog = await source('../../components/ui/dialog.tsx');
    expect(dialog).toContain("'palette'");
    const trecho = dialog.slice(dialog.indexOf("size === 'palette'"));
    expect(trecho).toContain('top-');
    expect(trecho).not.toMatch(/shadow-/);
  });

  test('o gatilho da topbar anuncia o atalho — senão ninguém descobre o ⌘K', async () => {
    const topbar = await source('../../components/shell/topbar.tsx');
    expect(topbar).toContain('⌘K');
    expect(topbar).toContain('useCommandPalette');
  });

  test('a paleta é montada no shell autenticado', async () => {
    expect(await source('../../app/(app)/layout.tsx')).toContain('<CommandPalette />');
  });
});
