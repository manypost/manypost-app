import { describe, expect, test } from 'bun:test';

const source = (name: string) => Bun.file(new URL(name, import.meta.url)).text();

describe('refinamentos visuais da Home', () => {
  test('Novo post explicita o texto branco no próprio CTA', async () => {
    const view = await source('./home-view.tsx');
    const button = view.match(
      /<Button[^>]+className="([^"]+)"[^>]*>[\s\S]*?\{t\('newPost'\)\}[\s\S]*?<\/Button>/,
    );

    expect(button).not.toBeNull();
    expect(button![1]!.split(/\s+/)).toContain('text-paper');
  });

  test('os cartões aparecem na posição final sem hook de entrada', async () => {
    expect(await source('./home-blocks.tsx')).not.toContain('home-surface');
  });

  test('listas operacionais não dependem de mapas de ícones decorativos', async () => {
    const original = await source('./home-blocks.tsx');
    const v2 = await source('./home-blocks-v2.tsx');

    expect(original).not.toContain('ICONE_ATENCAO');
    expect(v2).not.toContain('ICONE_ACAO');
    expect(v2).not.toContain('ICONE_ATIVIDADE');
  });

  test('tiles do pipeline usam fill e ponto de estado, sem frame ou regra superior', async () => {
    const v2 = await source('./home-blocks-v2.tsx');

    expect(v2).not.toContain('border-t-2');
    expect(v2).toContain("'size-1.5 shrink-0 rounded-full'");
  });

  test('a Home não escalona entrada por CSS nem por índice', async () => {
    const css = await source('../../app/globals.css');
    const view = await source('./home-view.tsx');

    expect(css).not.toContain('.home-surface');
    expect(css).not.toContain('home-surface-enter');
    expect(view).not.toContain("'--i'");
    expect(view).not.toMatch(/bloco\(id,\s*i\)/);
  });

  test('controles compactos preservam o alvo mínimo de 32px do Button sm', async () => {
    const original = await source('./home-blocks.tsx');
    const v2 = await source('./home-blocks-v2.tsx');
    expect(original).not.toContain('h-7');
    expect(v2).not.toContain('h-7');
    expect((v2.match(/min-h-8/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  test('leituras da Home têm fallback de polling quando o SSE não entrega eventos', async () => {
    const hooks = await source('./hooks.ts');
    const view = await source('./home-view.tsx');

    expect((hooks.match(/refetchInterval: 60_000/g) ?? []).length).toBe(3);
    expect(view).toContain('usePipelineFeed(30, { refetchInterval: 60_000 })');
  });
});
