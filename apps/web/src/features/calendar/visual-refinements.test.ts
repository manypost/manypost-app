import { describe, expect, test } from 'bun:test';
import { sourceReader } from '@/test-utils/source-lint';

const source = sourceReader(import.meta.url);

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

  test('rótulos compactos usam tokens nomeados, não text-xs ou text-sm', async () => {
    const grids = await source('./calendar-grids.tsx');

    expect(grids).not.toContain('text-xs');
    expect(grids).not.toContain('text-sm');
  });

  // a marcação concreta da grade (48px, rótulos de hora, nomes decorativos) é assertada
  // RENDERIZADA em calendar-grids.test.tsx — aqui ficam só as regras de fonte genéricas
});
