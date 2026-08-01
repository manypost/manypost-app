import { describe, expect, test } from 'bun:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import messages from '@/messages/pt-BR.json';
import { KanbanColumn, CancelDropZone } from './kanban-column';
import { KanbanCard } from './kanban-card';
import type { FeedItem, GroupCard } from './logic';

/**
 * Renderização real dos pedaços do quadro, no molde de `features/home/home-blocks.test.tsx`
 * (`renderToStaticMarkup`, sem DOM e sem dependência nova).
 *
 * O que estes testes prendem não é estética: é o que a marcação **afirma**. Em particular o card,
 * que antes era um `<button>` e agora precisa carregar checkbox e menu — aninhar controle dentro de
 * controle produz marcação inválida e quebra teclado e leitor de tela, e é o tipo de regressão que
 * volta silenciosamente na primeira refatoração de layout.
 */
const render = (ui: React.ReactElement) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      {ui}
    </NextIntlClientProvider>,
  );

const item = (over: Partial<FeedItem> = {}): FeedItem =>
  ({
    id: 'pub-1',
    groupId: 'g1',
    channelId: 'c1',
    state: 'SCHEDULED',
    publishAt: '2026-07-30T12:00:00.000Z',
    text: 'texto',
    mediaCount: 0,
    mediaPreview: null,
    externalId: null,
    releaseUrl: null,
    errorClass: null,
    errorMessage: null,
    attemptCount: 0,
    group: { state: 'SCHEDULED', origin: 'WEB', awaitingApproval: false },
    channel: { provider: 'x', name: 'Canal', username: null, avatarUrl: null },
    ...over,
  }) as FeedItem;

const card = (over: Partial<GroupCard> = {}): GroupCard => ({
  groupId: 'g1',
  state: 'SCHEDULED',
  awaitingApproval: false,
  origin: 'WEB',
  publishAt: '2026-07-30T12:00:00.000Z',
  text: 'conteúdo do post',
  items: [item()],
  errorMessage: null,
  mediaPreview: null,
  column: 'scheduled',
  ...over,
});

const renderCard = (over: Partial<GroupCard> = {}, props: Partial<Parameters<typeof KanbanCard>[0]> = {}) =>
  render(
    <KanbanCard
      card={card(over)}
      densidade="confortavel"
      selecionado={false}
      temSelecao={false}
      onOpen={() => {}}
      onToggle={() => {}}
      onAcao={() => {}}
      {...props}
    />,
  );

// ---------------------------------------------------------------------------

describe('card: estrutura antes de estética', () => {
  test('NENHUM controle interativo é aninhado dentro de outro', () => {
    const html = renderCard();
    // um <button> que ainda não fechou não pode conter outro button/input
    const aninhado = /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?<(?:button|input|a)\b/.test(html);
    expect(aninhado).toBe(false);
  });

  test('o card é <article>, não <button> — é o que permite checkbox e menu', () => {
    expect(renderCard()).toContain('<article');
  });

  test('o gatilho do menu é rotulado (sem rótulo, é um botão mudo para leitor de tela)', () => {
    expect(renderCard()).toContain('aria-label="Ações do post"');
  });

  test('o checkbox de seleção é rotulado', () => {
    expect(renderCard()).toContain('aria-label="Selecionar post"');
  });

  test('mostra a mensagem de erro quando existe', () => {
    expect(renderCard({ column: 'failed', errorMessage: 'token expirado' })).toContain(
      'token expirado',
    );
  });

  test('densidade compacta esconde a mensagem de erro e troca o line-clamp', () => {
    const html = render(
      <KanbanCard
        card={card({ column: 'failed', errorMessage: 'token expirado' })}
        densidade="compacta"
        selecionado={false}
        temSelecao={false}
        onOpen={() => {}}
        onToggle={() => {}}
        onAcao={() => {}}
      />,
    );
    expect(html).not.toContain('token expirado');
    expect(html).toContain('line-clamp-2');
  });

  test('card publicado não é arrastável (cursor não promete o que não acontece)', () => {
    expect(renderCard({ column: 'published', state: 'DONE' })).toContain('cursor-pointer');
    expect(renderCard({ column: 'published', state: 'DONE' })).not.toContain('cursor-grab');
  });

  test('card em coluna arrastável mostra o cursor de arraste', () => {
    expect(renderCard({ column: 'failed' })).toContain('cursor-grab');
  });

  test('origem diferente de WEB é sinalizada; WEB não polui o card', () => {
    expect(renderCard({ origin: 'MCP' })).toContain('MCP');
    expect(renderCard({ origin: 'WEB' })).not.toContain('>WEB<');
  });

  test('post sem texto não renderiza uma linha em branco', () => {
    expect(renderCard({ text: '' })).toContain('…');
  });

  test('preview de imagem usa crop editorial e alt real', () => {
    const html = renderCard({
      mediaPreview: {
        type: 'image',
        url: 'https://cdn.example/post.webp',
        mime: 'image/webp',
        alt: 'Mesa com calendário',
      },
    });
    expect(html).toContain('data-media-kind="image"');
    expect(html).toContain('alt="Mesa com calendário"');
    expect(html).toContain('aspect-preview');
  });

  test('preview de vídeo vira tile neutro e não renderiza <video>', () => {
    const html = renderCard({
      mediaPreview: {
        type: 'video',
        url: 'https://cdn.example/reel.mp4',
        mime: 'video/mp4',
        alt: null,
      },
    });
    expect(html).toContain('data-media-kind="video"');
    expect(html).not.toContain('<video');
  });

  test('sem preview não reserva um retângulo vazio', () => {
    expect(renderCard({ mediaPreview: null })).not.toContain('data-media-kind=');
  });
});

// ---------------------------------------------------------------------------

describe('coluna', () => {
  test('coluna sem cards ainda declara sua contagem — zero é informação', () => {
    const html = render(
      <KanbanColumn id="draft" accent="bg-mist" title="Rascunho" count={0} compacta={false}>
        {null}
      </KanbanColumn>,
    );
    expect(html).toContain('aria-label="Rascunho"');
    expect(html).toContain('>0<');
  });

  test('a contagem reflete o que foi passado, não o número de filhos', () => {
    const html = render(
      <KanbanColumn id="failed" accent="bg-state-failed" title="Falhou" count={7} compacta={false}>
        {null}
      </KanbanColumn>,
    );
    expect(html).toContain('>7<');
  });

  test('lane é aberta, sticky e dividida dentro da superfície única', () => {
    const html = render(
      <KanbanColumn id="scheduled" accent="bg-state-scheduled" title="Agendado" count={4} compacta={false}>
        {null}
      </KanbanColumn>,
    );
    expect(html).toContain('border-l');
    expect(html).toContain('sticky');
    expect(html).not.toContain('rounded-card bg-surface-2');
    expect(html).not.toMatch(/4\s*\/\s*\d+/);
  });
});

describe('alvo de cancelamento', () => {
  test('não existe fora do arraste — não é uma sexta coluna', () => {
    expect(render(<CancelDropZone ativo={false} />)).toBe('');
  });

  test('durante o arraste, diz o que vai acontecer', () => {
    expect(render(<CancelDropZone ativo />)).toContain('Soltar aqui para cancelar');
  });
});
