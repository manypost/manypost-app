import { describe, expect, test } from 'bun:test';

const source = () => Bun.file(new URL('./connections-view.tsx', import.meta.url)).text();

describe('ênfase visual das redes em Conexões', () => {
  test('o catálogo usa cards amplos e o provider como âncora visual dominante', async () => {
    const view = await source();

    expect(view).toContain('data-provider-card');
    expect(view).toContain('min-h-40');
    expect(view).toContain('size-16');
    expect(view).toContain('size-10');
    expect(view).toContain('text-title font-medium');
    expect(view).toContain('xl:grid-cols-4');
    expect(view).not.toContain('xl:grid-cols-5');
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
