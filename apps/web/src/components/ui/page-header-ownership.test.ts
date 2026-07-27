import { describe, expect, test } from 'bun:test';

const source = async (relative: string) =>
  Bun.file(new URL(`../../${relative}`, import.meta.url)).text();

describe('um único dono do cabeçalho por tela', () => {
  test.each(['conexoes', 'midia'])(
    '%s deixa o cabeçalho com a feature view, sem duplicá-lo no wrapper',
    async (route) => {
      const page = await source(`app/(app)/${route}/page.tsx`);
      expect(page).not.toContain('PageHeader');
    },
  );

  test.each(['notificacoes', 'configuracoes', 'planos'])(
    '%s usa o PageHeader canônico no wrapper',
    async (route) => {
      const page = await source(`app/(app)/${route}/page.tsx`);
      expect(page).toContain("@/components/ui/page-header");
    },
  );

  test('não mantém uma segunda implementação no shell', async () => {
    expect(await Bun.file(new URL('../shell/page-header.tsx', import.meta.url)).exists()).toBe(
      false,
    );
  });

  test('o topbar não compete com o PageHeader pelo h1 da tela', async () => {
    const topbar = await source('components/shell/topbar.tsx');
    expect(topbar).not.toContain('<h1');
  });
});
