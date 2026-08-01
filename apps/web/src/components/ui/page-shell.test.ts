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

  test('o shell branco/lilás tem rail cinza-preto 181/64 e topbar de 59px no desktop', async () => {
    const sidebar = await source('../shell/app-sidebar.tsx');
    const topbar = await source('../shell/topbar.tsx');
    const css = await source('../../app/globals.css');

    expect(css).toContain('--sidebar:');
    expect(css).toContain('--container-wide:');
    expect(css).toContain('--sidebar: #242629');
    expect(css).toContain('--sidebar-hover: #303236');
    expect(sidebar).toContain("isCollapsed ? 'w-16");
    expect(sidebar).toContain(": 'w-[181px]'");
    expect(sidebar).toContain('bg-sidebar');
    expect(sidebar).toContain('useMe');
    expect(sidebar).toMatch(/hidden[^']*lg:flex/);
    expect(topbar).toContain('h-[59px]');
    expect(topbar).toContain('lg:flex');
    expect(topbar).toContain('abrirPaleta');
    expect(topbar).toContain('NotificationsMenu');
    expect(topbar).toContain('size-11 lg:size-8');
    expect(topbar).toContain('size-11 cursor-pointer');
  });

  test('PageShell possui variante wide e o título de produto usa Inter 18px/500', async () => {
    const shell = await source('./page-shell.tsx');
    const header = await source('./page-header.tsx');
    const css = await source('../../app/globals.css');

    expect(shell).toContain("size?: 'standard' | 'wide'");
    expect(shell).toContain('max-w-wide');
    expect(header).toContain('font-sans text-title font-medium');
    expect(header).not.toContain('font-display');
    expect(css).toContain('--text-title: 18px');
    expect(css).toContain('--text-figure: 23px');
  });
});
