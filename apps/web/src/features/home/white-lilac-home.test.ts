import { describe, expect, test } from 'bun:test';

const source = (name: string) => Bun.file(new URL(name, import.meta.url)).text();

describe('Home no sistema branco/lilás', () => {
  test('usa rail real de 260px e não inventa dados analíticos', async () => {
    const view = await source('./home-view.tsx');

    expect(view).toContain('lg:grid-cols-[minmax(0,1fr)_260px]');
    expect(view).toContain('ordem.lateral');
    expect(view).not.toMatch(/engagement|impressions|followers|audience/i);
  });

  test('resumos operacionais usam fills KPI lilás/azul e cards analíticos usam raio próprio', async () => {
    const blocks = await source('./home-blocks.tsx');
    const blocksV2 = await source('./home-blocks-v2.tsx');

    expect(blocks).toContain('rounded-card');
    expect(blocks).toContain('rounded-kpi');
    expect(blocksV2).toContain('bg-kpi-lilac');
    expect(blocksV2).toContain('bg-kpi-blue');
  });

  test('KPIs preservam uma coluna no mobile, 2 + 1 no tablet e três colunas no desktop', async () => {
    const blocks = await source('./home-blocks.tsx');
    const view = await source('./home-view.tsx');

    expect(blocks).toContain('grid gap-3 md:grid-cols-2 lg:grid-cols-3');
    expect(blocks).not.toContain('sm:grid-cols-3');
    expect(view).toContain('grid gap-3 md:grid-cols-2 lg:grid-cols-3');
    expect(view.match(/h-24 rounded-kpi/g)?.length).toBe(3);
  });
});
