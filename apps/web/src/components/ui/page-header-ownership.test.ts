import { describe, expect, test } from 'bun:test';

const source = async (relative: string) =>
  Bun.file(new URL(`../../${relative}`, import.meta.url)).text();

describe('um único dono do cabeçalho por tela', () => {
  test.each([
    ['conexoes', 'features/channels/connections-view.tsx'],
    ['midia', 'features/media/media-view.tsx'],
    ['notificacoes', 'features/notifications/notifications-view.tsx'],
    ['configuracoes', 'features/settings/settings-view.tsx'],
    ['planos', 'features/billing/plans-view.tsx'],
  ])('%s deixa o PageHeader com a feature view, sem duplicá-lo na rota', async (route, view) => {
    const page = await source(`app/(app)/${route}/page.tsx`);
    const feature = await source(view);

    expect(page).not.toContain('PageHeader');
    expect(feature).toContain("@/components/ui/page-header");
  });

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
