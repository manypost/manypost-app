import { describe, expect, test } from 'bun:test';

const source = () => Bun.file(new URL('./connections-view.tsx', import.meta.url)).text();

describe('ênfase visual das redes em Conexões', () => {
  test('o catálogo mantém a marca dominante em uma escala mais compacta', async () => {
    const view = await source();
    const catalog = view.slice(view.indexOf('data-provider-card'));

    expect(catalog).toContain('min-h-32');
    expect(catalog).toContain('data-provider-mark');
    expect(catalog).toContain('className="size-12"');
    expect(catalog).not.toContain('size-16 shrink-0 items-center justify-center rounded-control border border-line bg-main');
  });

  test('contas conectadas não reduzem a rede a um selo sobre o avatar', async () => {
    const view = await source();

    expect(view).toContain('data-connected-provider');
    expect(view).toContain('ProviderIcon');
    expect(view).toContain('size-14');
    expect(view).toContain('size-9');
    expect(view).not.toContain('absolute -bottom-0.5 -right-0.5 size-4');
  });
});
