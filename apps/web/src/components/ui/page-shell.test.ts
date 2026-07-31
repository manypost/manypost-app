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
});
