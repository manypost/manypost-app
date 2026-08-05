import { describe, expect, test } from 'bun:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import messages from '@/messages/pt-BR.json';
import type { GroupCard } from '@/features/kanban/logic';
import {
  ActivityBlock,
  BlocoAssincrono,
  DraftsBlock,
  NextActionBlock,
  PipelineBlock,
  UpcomingBlock,
} from './home-blocks-v2';
import type { EntradaDeAtividade, FeedItem, ProximaAcao } from './logic';

/**
 * Renderização real dos blocos da Home v2, no molde de `home-blocks.test.tsx`.
 *
 * A asserção que mais importa aqui é sempre a mesma: **bloco sem conteúdo produz `''`**. É a regra
 * central desta tela (design.md §3.3 — silêncio é a mensagem), e é o tipo de coisa que se perde na
 * primeira vez que alguém acha que "ficou um buraco no layout".
 */
const render = (ui: React.ReactElement) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      {ui}
    </NextIntlClientProvider>,
  );

const AGORA = new Date('2026-07-31T12:00:00.000Z');

const item = (over: Partial<FeedItem> = {}): FeedItem =>
  ({
    id: 'p1',
    groupId: 'g1',
    channelId: 'c1',
    state: 'SCHEDULED',
    publishAt: '2026-07-31T18:00:00.000Z',
    publishedAt: null,
    updatedAt: '2026-07-31T09:00:00.000Z',
    text: 'conteúdo agendado',
    mediaCount: 0,
    externalId: null,
    releaseUrl: null,
    errorClass: null,
    errorMessage: null,
    attemptCount: 0,
    group: { state: 'SCHEDULED', origin: 'WEB', awaitingApproval: false },
    channel: { provider: 'x', name: 'Perfil', username: null, avatarUrl: null },
    ...over,
  }) as FeedItem;

const noop = () => {};

// ---------------------------------------------------------------------------

describe('próxima ação', () => {
  test('sem ação, o bloco NÃO é renderizado', () => {
    expect(render(<NextActionBlock acao={null} />)).toBe('');
  });

  test('rascunho órfão diz que o post não vai sair sozinho e oferece o quadro', () => {
    const acao: ProximaAcao = { kind: 'orphanDraft', href: '/kanban', dados: { count: 1 } };
    const html = render(<NextActionBlock acao={acao} />);
    expect(html).toContain('não vai sair sozinho');
    expect(html).toContain('/kanban');
  });

  test('retomar rascunho mostra um trecho do que foi escrito', () => {
    const acao: ProximaAcao = {
      kind: 'resumeLocalDraft',
      href: '/compor',
      dados: { texto: 'começo do post' },
    };
    expect(render(<NextActionBlock acao={acao} />)).toContain('começo do post');
  });
});

// ---------------------------------------------------------------------------

describe('próximas publicações', () => {
  test('nada agendado: bloco ausente', () => {
    expect(render(<UpcomingBlock items={[]} onOpen={noop} />)).toBe('');
  });

  test('só entra o que está AGENDADO — publicado não é "próxima publicação"', () => {
    const html = render(
      <UpcomingBlock
        items={[item({ id: 'a', state: 'PUBLISHED', text: 'já saiu' })]}
        onOpen={noop}
      />,
    );
    expect(html).toBe('');
  });

  test('mostra horário, canal e texto', () => {
    const html = render(<UpcomingBlock items={[item()]} onOpen={noop} />);
    expect(html).toContain('Próximas publicações');
    expect(html).toContain('conteúdo agendado');
  });

  test('mostra explicitamente o estado agendado prometido pelo contrato', () => {
    expect(render(<UpcomingBlock items={[item()]} onOpen={noop} />)).toContain('Agendado');
  });

  test('sucesso assíncrono mantém exatamente um cartão e um título', () => {
    const html = render(
      <BlocoAssincrono
        titulo="Próximas publicações"
        isPending={false}
        isError={false}
        onRetry={noop}
      >
        <UpcomingBlock items={[item()]} onOpen={noop} />
      </BlocoAssincrono>,
    );
    expect((html.match(/Próximas publicações/g) ?? []).length).toBe(1);
  });

  test('no máximo 5 entradas, e oferece o calendário para o resto', () => {
    const muitos = Array.from({ length: 12 }, (_, i) =>
      item({ id: `p${i}`, groupId: `g${i}`, text: `post ${i}` }),
    );
    const html = render(<UpcomingBlock items={muitos} onOpen={noop} />);
    // `<li[ >]` e não `<li`: o preload de ícone do React emite `<link …>` e contaria junto
    expect((html.match(/<li[ >]/g) ?? []).length).toBe(5);
    expect(html).toContain('/calendario');
  });
});

// ---------------------------------------------------------------------------

describe('atividade recente', () => {
  test('nada resolvido: bloco ausente', () => {
    expect(render(<ActivityBlock entradas={[]} agora={AGORA} onOpen={noop} />)).toBe('');
  });

  test('descreve o desfecho e o canal, sem falar de audiência', () => {
    const entradas: EntradaDeAtividade[] = [
      {
        tipo: 'publication',
        chave: 'p1',
        groupId: 'g1',
        state: 'PUBLISHED',
        canal: 'Perfil',
        provider: 'x',
        texto: 'oi',
        em: AGORA.getTime() - 30 * 60_000,
      },
    ];
    const html = render(<ActivityBlock entradas={entradas} agora={AGORA} onOpen={noop} />);
    expect(html).toContain('publicado em Perfil');
    expect(html).not.toMatch(/alcance|engajament|curtida/i);
  });

  test('falha aparece com o tom de falha', () => {
    const entradas: EntradaDeAtividade[] = [
      {
        tipo: 'publication',
        chave: 'p1',
        groupId: 'g1',
        state: 'FAILED',
        canal: 'Perfil',
        provider: 'x',
        texto: '',
        em: AGORA.getTime() - 60_000,
      },
    ];
    const html = render(<ActivityBlock entradas={entradas} agora={AGORA} onOpen={noop} />);
    expect(html).toContain('falhou em Perfil');
    expect(html).toContain('bg-state-failed');
  });

  test('aprovação (notificação) aparece na mesma lista', () => {
    const entradas: EntradaDeAtividade[] = [
      { tipo: 'notification', chave: 'n1', title: 'Post aprovado', link: null, em: AGORA.getTime() },
    ];
    expect(render(<ActivityBlock entradas={entradas} agora={AGORA} onOpen={noop} />)).toContain(
      'Post aprovado',
    );
  });

  test('notificação com destino é acionável', () => {
    const entradas: EntradaDeAtividade[] = [
      {
        tipo: 'notification',
        chave: 'n1',
        title: 'Post aprovado',
        link: '/notificacoes?open=n1',
        em: AGORA.getTime(),
      },
    ];
    expect(render(<ActivityBlock entradas={entradas} agora={AGORA} onOpen={noop} />)).toContain(
      'href="/notificacoes?open=n1"',
    );
  });

  test('mantém atividade disponível e avisa quando uma fonte falhou', () => {
    const entradas: EntradaDeAtividade[] = [
      { tipo: 'notification', chave: 'n1', title: 'Post aprovado', link: null, em: AGORA.getTime() },
    ];
    const html = render(
      <ActivityBlock
        entradas={entradas}
        agora={AGORA}
        onOpen={noop}
        incompleta
        onRetry={noop}
      />,
    );
    expect(html).toContain('Algumas atividades não puderam ser carregadas');
    expect(html).toContain('Post aprovado');
    expect(html).toContain('Tentar de novo');
  });
});

// ---------------------------------------------------------------------------

describe('rascunhos retomáveis', () => {
  const rascunhoServidor = item({
    state: 'DRAFT',
    publishAt: null,
    text: 'rascunho parado',
    group: { state: 'DRAFT', origin: 'WEB', awaitingApproval: false },
  });

  test('sem rascunho nenhum: bloco ausente', () => {
    expect(
      render(
        <DraftsBlock
          local={null}
          servidor={[]}
          onResumeLocal={noop}
          onDuplicate={noop}
          onApproval={noop}
        />,
      ),
    ).toBe('');
  });

  test('rascunho do servidor NÃO oferece agendar — a API não tem essa operação', () => {
    const html = render(
      <DraftsBlock
        local={null}
        servidor={[rascunhoServidor]}
        onResumeLocal={noop}
        onDuplicate={noop}
        onApproval={noop}
      />,
    );
    expect(html).toContain('rascunho parado');
    expect(html).toContain('Duplicar no composer');
    expect(html).not.toMatch(/\bAgendar\b/);
  });

  test('rascunho aguardando aprovação não entra (já é contado pelo bloco de atenção)', () => {
    const aguardando = item({
      state: 'DRAFT',
      publishAt: null,
      group: { state: 'DRAFT', origin: 'WEB', awaitingApproval: true },
    });
    expect(
      render(
        <DraftsBlock
          local={null}
          servidor={[aguardando]}
          onResumeLocal={noop}
          onDuplicate={noop}
          onApproval={noop}
        />,
      ),
    ).toBe('');
  });

  test('rascunho local aparece com o trecho escrito', () => {
    const html = render(
      <DraftsBlock
        local={{ texto: 'meio escrito', atualizadoEm: AGORA.getTime() }}
        servidor={[]}
        agora={AGORA}
        onResumeLocal={noop}
        onDuplicate={noop}
        onApproval={noop}
      />,
    );
    expect(html).toContain('meio escrito');
  });

  test('rascunho local informa há quanto tempo foi editado', () => {
    const html = render(
      <DraftsBlock
        local={{ texto: 'meio escrito', atualizadoEm: AGORA.getTime() - 2 * 60 * 60_000 }}
        servidor={[]}
        agora={AGORA}
        onResumeLocal={noop}
        onDuplicate={noop}
        onApproval={noop}
      />,
    );
    expect(html).toContain('Editado há 2 horas');
  });
});

// ---------------------------------------------------------------------------

describe('pipeline', () => {
  const card = (over: Partial<GroupCard> = {}): GroupCard => ({
    groupId: 'g1',
    state: 'SCHEDULED',
    awaitingApproval: false,
    origin: 'WEB',
    publishAt: null,
    text: 'x',
    items: [],
    errorMessage: null,
    column: 'scheduled',
    ...over,
  });

  test('pipeline vazio: bloco ausente', () => {
    expect(render(<PipelineBlock cards={[]} />)).toBe('');
  });

  test('conta por coluna e leva ao quadro JÁ FILTRADO naquela coluna', () => {
    const html = render(
      <PipelineBlock cards={[card({ groupId: 'a' }), card({ groupId: 'b', column: 'failed' })]} />,
    );
    expect(html).toContain('/kanban?col=scheduled');
    expect(html).toContain('/kanban?col=failed');
  });

  test('não oferece arraste nem seleção — a home é a porta, não a ferramenta', () => {
    const html = render(<PipelineBlock cards={[card()]} />);
    expect(html).not.toContain('cursor-grab');
    expect(html).not.toContain('type="checkbox"');
  });

  test('avisa quando as contagens vieram de um feed truncado', () => {
    const html = render(<PipelineBlock cards={[card()]} truncado />);
    expect(html).toContain('Mais de 1.000 itens');
    expect(html).toContain('/kanban');
  });
});
