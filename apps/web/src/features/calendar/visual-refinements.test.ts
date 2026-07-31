import { describe, expect, test } from 'bun:test';

import { cn } from '../../lib/utils';

const source = (name: string) => Bun.file(new URL(name, import.meta.url)).text();

describe('proporções visuais do calendário', () => {
  test('Criar post explicita o texto branco nas variantes mobile e desktop', async () => {
    const panel = await source('./channels-panel.tsx');
    const createButtons = [
      ...panel.matchAll(
        /<Button[^>]+className="([^"]+)"[^>]*>[\s\S]*?\{t\('createPost'\)\}[\s\S]*?<\/Button>/g,
      ),
    ];

    expect(createButtons).toHaveLength(2);
    for (const button of createButtons) {
      expect(button[1]!.split(/\s+/)).toContain('text-paper');
    }
  });

  test('toolbar usa a altura compacta em vez da escala ampliada', async () => {
    const view = await source('./calendar-view.tsx');

    expect(view).not.toContain('h-11');
    expect(view).not.toContain('sm:h-10');
  });

  test('painel de canais não amplia botões ou chips acima do necessário', async () => {
    const panel = await source('./channels-panel.tsx');

    expect(panel).not.toContain('py-5');
    expect(panel).not.toContain('size-10');
    expect(panel).not.toContain('min-h-[42px]');
  });

  test('seletores e timeline usam linha compacta de 48px', async () => {
    const grids = await source('./calendar-grids.tsx');

    expect(grids).not.toContain('min-h-[50px]');
    expect(grids).not.toContain('min-h-[56px]');
    expect(grids).not.toContain('grid-cols-[56px_minmax(0,1fr)]');
    expect(grids).toContain('min-h-12');
    expect(grids).toContain('grid-cols-[48px_minmax(0,1fr)]');
  });

  test('rótulos compactos usam tokens nomeados, não text-xs ou text-sm', async () => {
    const grids = await source('./calendar-grids.tsx');

    expect(grids).not.toContain('text-xs');
    expect(grids).not.toContain('text-sm');
  });

  test('não renderiza o nome decorativo e não traduzido da visualização', async () => {
    const grids = await source('./calendar-grids.tsx');

    expect(grids).not.toContain('Linha do Tempo 24h');
    expect(grids).not.toContain('Visão do Dia');
  });

  test('horários da grade usam a escala exclusiva do calendário em desktop e mobile', async () => {
    const grids = await source('./calendar-grids.tsx');
    const hourLabels = [
      ...grids.matchAll(
        /'([^'\n]*text-right[^'\n]*tabular-nums[^'\n]*)'[\s\S]{0,350}\{hourFmt\.format/g,
      ),
    ];

    expect(hourLabels).toHaveLength(2);
    for (const label of hourLabels) {
      const classes = label[1]!.split(/\s+/);
      expect(classes).toContain('calendar-hour-label');
      expect(classes).not.toContain('text-calendar-hour');
      expect(classes).not.toContain('text-axis');
      expect(classes).not.toContain('text-meta');
    }

    expect(cn('calendar-hour-label text-mist').split(/\s+/)).toEqual([
      'calendar-hour-label',
      'text-mist',
    ]);
  });
});
