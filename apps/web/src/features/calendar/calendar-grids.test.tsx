import { describe, expect, test } from 'bun:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import messages from '@/messages/pt-BR.json';
import { TimeGrid } from './calendar-grids';

/**
 * Renderização real da grade de horários (molde de `kanban-blocks.test.tsx`): o que se afirma
 * aqui é o HTML emitido, então um refactor de arquivo ou de composição de classe via `cn()`
 * não produz falha falsa — só uma mudança visual de verdade produz.
 */
const render = (ui: React.ReactElement) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      {ui}
    </NextIntlClientProvider>,
  );

const gridHtml = () =>
  render(
    <TimeGrid
      days={[new Date('2026-08-10T12:00:00')]}
      itemsByDay={new Map()}
      onOpen={() => {}}
      onSchedule={() => {}}
    />,
  );

describe('grade de horários renderizada', () => {
  test('linhas de hora usam a altura compacta de 48px nas duas variantes', () => {
    const html = gridHtml();
    expect(html).toContain('min-h-12');
    expect(html).toContain('grid-cols-[48px_minmax(0,1fr)]');
    expect(html).not.toContain('min-h-[50px]');
    expect(html).not.toContain('min-h-[56px]');
  });

  test('rótulos de hora usam a escala exclusiva do calendário, sem token de produto', () => {
    const html = gridHtml();
    const labels = html.match(/class="[^"]*calendar-hour-label[^"]*"/g) ?? [];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).not.toMatch(/text-(xs|sm|axis|meta|calendar-hour)\b/);
    }
  });

  test('não renderiza nome decorativo e não traduzido da visualização', () => {
    const html = gridHtml();
    expect(html).not.toContain('Linha do Tempo 24h');
    expect(html).not.toContain('Visão do Dia');
  });

  test('a grade não usa sombra nem move elementos no hover', () => {
    const html = gridHtml();
    expect(html).not.toMatch(/\bshadow-/);
    expect(html).not.toMatch(/hover:(translate|scale|rotate)/);
  });
});
