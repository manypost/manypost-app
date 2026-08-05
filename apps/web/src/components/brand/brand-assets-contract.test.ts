import { expect, test } from 'bun:test';

const source = (url: string) => Bun.file(new URL(url, import.meta.url)).text();

test('a marca usa o mesmo accent sólido do botão primário', async () => {
  const [globals, button, ...assets] = await Promise.all([
    source('../../app/globals.css'),
    source('../ui/button.tsx'),
    source('../../../public/images/logo.svg'),
    source('../../../public/images/logoSimplificada.svg'),
    source('../../../public/images/logo-icon-animated.svg'),
  ]);

  expect(globals).toContain('--accent: #7c56cd');
  expect(button).toContain('border-accent bg-accent text-paper');

  for (const asset of assets) {
    expect(asset).toContain('fill="#7C56CD"');
    expect(asset).not.toContain('linearGradient');
    expect(asset).not.toContain('stop-color');
  }
});
