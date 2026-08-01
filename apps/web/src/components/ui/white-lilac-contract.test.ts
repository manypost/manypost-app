import { describe, expect, test } from 'bun:test';
import {
  findInvalidLayoutGaps,
  findUnauthorizedGradients,
} from '../../../../../scripts/brand-rules';

const source = (url: string) => Bun.file(new URL(url, import.meta.url)).text();

describe('contrato visual branco/lilás', () => {
  test('declara a paleta medida e as superfícies silenciosas', async () => {
    const css = await source('../../app/globals.css');

    expect(css).toContain('--canvas: #d9dbdd');
    expect(css).toContain('--main: #fdfdfd');
    expect(css).toContain('--surface: #ffffff');
    expect(css).toContain('--surface-2: #f5f5f5');
    expect(css).toContain('--kpi-lilac: #edeefc');
    expect(css).toContain('--kpi-blue: #e6f1fd');
    expect(css).toContain('--accent: #7c56cd');
    expect(css).toContain('--data-2-bright: #00f3bc');
    expect(css).toContain('--line: #ededed');
  });

  test('expõe raios por função e somente a sombra do tooltip', async () => {
    const css = await source('../../app/globals.css');

    for (const token of [
      '--radius-key: 4px',
      '--radius-compact: 5px',
      '--radius-tooltip: 8px',
      '--radius-control: 10px',
      '--radius-card: 11px',
      '--radius-kpi: 12px',
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain('--shadow-tooltip:');
    expect(css).toContain('@utility viz-active-bar');
    expect(css).toContain('@utility viz-donut-segment');
    expect(css).toContain('@utility viz-area-fill');
  });

  test('o tooltip é o único primitive persistente autorizado a usar sombra', async () => {
    const tooltip = await source('./tooltip.tsx');
    const button = await source('./button.tsx');
    const card = await source('./card.tsx');

    expect(tooltip).toContain('shadow-tooltip');
    expect(button).not.toMatch(/\bshadow-/);
    expect(card).not.toMatch(/\bshadow-/);
  });

  test('o gate rejeita gaps fracionários e aceita somente a escala fechada', () => {
    expect(findInvalidLayoutGaps('flex gap-1 gap-4 gap-x-8')).toEqual([]);
    expect(findInvalidLayoutGaps('flex gap-2.5 gap-y-[10px]')).toEqual([
      { line: 1, excerpt: 'gap-2.5' },
      { line: 1, excerpt: 'gap-y-[10px]' },
    ]);
  });

  test('o gate aceita gradientes somente em blocos nomeados', () => {
    const globals = 'apps/web/src/app/globals.css';
    expect(
      findUnauthorizedGradients(globals, '@utility viz-active-bar {\n background: linear-gradient(180deg, red, blue);\n}'),
    ).toEqual([]);
    expect(
      findUnauthorizedGradients(globals, '.card {\n background: linear-gradient(180deg, red, blue);\n}'),
    ).toEqual([{ line: 2, excerpt: 'background: linear-gradient(180deg, red, blue);' }]);
  });
});
