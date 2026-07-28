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

  test('os cartões expõem o hook visual compartilhado', async () => {
    expect(await source('./home-blocks.tsx')).toContain('home-surface');
  });

  test('a entrada vive somente no bloco que respeita reduced motion', async () => {
    const css = await source('../../app/globals.css');
    const reducedMotionBlock = css.match(
      /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/,
    );

    expect(reducedMotionBlock).not.toBeNull();
    expect(reducedMotionBlock![1]).toContain('.home-surface');
    expect(reducedMotionBlock![1]).toContain('opacity');
    expect(reducedMotionBlock![1]).toContain('transform');
  });
});
