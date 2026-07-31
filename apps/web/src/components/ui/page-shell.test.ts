import { describe, expect, test } from 'bun:test';

const source = (url: string) => Bun.file(new URL(url, import.meta.url)).text();

describe('shell único de página', () => {
  test('o shell autenticado aplica o limite de conteúdo em um único componente', async () => {
    const layout = await source('../../app/(app)/layout.tsx');
    const shell = await source('./page-shell.tsx');
    const css = await source('../../app/globals.css');

    expect(layout).toContain("import { PageShell }");
    expect(layout).toContain('<PageShell>{children}</PageShell>');
    expect(shell).toContain('max-w-app');
    expect(css).toContain('--container-app:');
    expect(css).toContain('--container-reading:');
  });

  test('cabeçalho usa a medida de leitura e não cria margem externa própria', async () => {
    const header = await source('./page-header.tsx');

    expect(header).toContain('max-w-reading');
    expect(header).not.toContain('mb-5');
  });

  test('arquivos de rota não renderizam PageHeader', async () => {
    for (const route of [
      '../../app/(app)/configuracoes/page.tsx',
      '../../app/(app)/notificacoes/page.tsx',
      '../../app/(app)/planos/page.tsx',
    ]) {
      expect(await source(route)).not.toContain('PageHeader');
    }
  });

  test('o shell editorial tem rail escuro 208/64, e a topbar pertence somente ao mobile', async () => {
    const sidebar = await source('../shell/app-sidebar.tsx');
    const topbar = await source('../shell/topbar.tsx');
    const css = await source('../../app/globals.css');

    expect(css).toContain('--sidebar:');
    expect(css).toContain('--container-wide:');
    expect(sidebar).toContain("isCollapsed ? 'w-16");
    expect(sidebar).toContain(": 'w-52'");
    expect(sidebar).toContain('bg-sidebar');
    expect(sidebar).toContain('abrirPaleta');
    expect(sidebar).toContain('useMe');
    expect(topbar).toContain('md:hidden');
    expect(topbar).not.toContain('md:block');
  });

  test('PageShell possui variante wide nomeada e título de página usa display 32px', async () => {
    const shell = await source('./page-shell.tsx');
    const header = await source('./page-header.tsx');
    const css = await source('../../app/globals.css');

    expect(shell).toContain("size?: 'standard' | 'wide'");
    expect(shell).toContain('max-w-wide');
    expect(header).toContain('font-display');
    expect(css).toContain('--text-title: 32px');
  });
});
