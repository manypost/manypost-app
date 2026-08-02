import { describe, expect, test } from 'bun:test';

const source = () => Bun.file(new URL('./connections-view.tsx', import.meta.url)).text();

describe('ênfase visual das redes em Conexões', () => {
  test('o catálogo usa o provider como âncora visual reconhecível', async () => {
    const view = await source();

    expect(view).toContain('data-provider-card');
    expect(view).toContain('size-12');
    expect(view).toContain('text-panel font-medium');
  });

  test('contas conectadas não reduzem a rede a um selo sobre o avatar', async () => {
    const view = await source();

    expect(view).toContain('data-connected-provider');
    expect(view).toContain('ProviderIcon');
    expect(view).not.toContain('absolute -bottom-0.5 -right-0.5 size-4');
  });
});
