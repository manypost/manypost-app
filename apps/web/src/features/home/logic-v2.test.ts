import { describe, expect, test } from 'bun:test';
import messages from '@/messages/pt-BR.json';
import type { components } from '@/lib/api/schema';
import type { InsightsSummary } from './hooks';
import {
  atividadeRecente,
  ordemDosBlocos,
  proximaAcao,
  rascunhosDoServidor,
  resumoDoRascunhoLocal,
  destinoDaNotificacao,
  type EstadoDaHome,
} from './logic';

type FeedItem = components['schemas']['FeedItem'];

const home = messages.home as Record<string, unknown>;

const AGORA = new Date('2026-07-31T12:00:00.000Z');

const atencao = (over: Partial<InsightsSummary['attention']> = {}): InsightsSummary['attention'] => ({
  failed: 0,
  needsReview: 0,
  awaitingApproval: 0,
  partial: 0,
  channels: [],
  total: 0,
  ...over,
});

const item = (over: Partial<FeedItem> = {}): FeedItem =>
  ({
    id: 'p1',
    groupId: 'g1',
    channelId: 'c1',
    state: 'PUBLISHED',
    publishAt: '2026-07-31T09:00:00.000Z',
    publishedAt: '2026-07-31T09:01:00.000Z',
    updatedAt: '2026-07-31T09:01:00.000Z',
    text: 'texto',
    mediaCount: 0,
    externalId: null,
    releaseUrl: null,
    errorClass: null,
    errorMessage: null,
    attemptCount: 0,
    group: { state: 'DONE', origin: 'WEB', awaitingApproval: false },
    channel: { provider: 'x', name: 'Canal', username: null, avatarUrl: null },
    ...over,
  }) as FeedItem;

/** rascunho de verdade: grupo em DRAFT e sem aprovação pendente */
const rascunho = (groupId = 'g9', over: Partial<FeedItem> = {}): FeedItem =>
  item({
    groupId,
    state: 'DRAFT',
    publishAt: null,
    publishedAt: null,
    group: { state: 'DRAFT', origin: 'WEB', awaitingApproval: false },
    ...over,
  });

const estado = (over: Partial<EstadoDaHome> = {}): EstadoDaHome => ({
  firstRun: null,
  atencao: atencao(),
  week: { scheduled: 5, byDay: [1, 1, 1, 1, 1, 0, 0] },
  proximas: [],
  rascunhosServidor: [],
  rascunhoLocal: null,
  planoNoLimite: false,
  agora: AGORA,
  ...over,
});

// ---------------------------------------------------------------------------

describe('proximaAcao: um único passo, e NUNCA repetindo o bloco de atenção', () => {
  test('com algo precisando de atenção, não propõe nada — o bloco de atenção já falou', () => {
    expect(proximaAcao(estado({ atencao: atencao({ failed: 2, total: 2 }) }))).toBeNull();
  });

  test('em primeiro uso, não propõe nada — os passos iniciais JÁ são a próxima ação', () => {
    expect(proximaAcao(estado({ firstRun: 'no_channels' }))).toBeNull();
    expect(proximaAcao(estado({ firstRun: 'no_posts' }))).toBeNull();
  });

  test('rascunho local pendente vence tudo — é o trabalho que a pessoa deixou na mão', () => {
    const a = proximaAcao(
      estado({
        rascunhoLocal: { texto: 'meio escrito', atualizadoEm: AGORA.getTime() - 3_600_000 },
        rascunhosServidor: [rascunho()],
        proximas: [],
      }),
    );
    expect(a?.kind).toBe('resumeLocalDraft');
  });

  test('rascunho órfão no servidor: a home diz que ele nunca vai sair sozinho', () => {
    const a = proximaAcao(estado({ rascunhosServidor: [rascunho()] }));
    expect(a?.kind).toBe('orphanDraft');
  });

  test('sem nada agendado nos próximos 3 dias, propõe agendar', () => {
    const a = proximaAcao(estado({ proximas: [], week: { scheduled: 0, byDay: [0, 0, 0, 1, 1, 1, 1] } }));
    expect(a?.kind).toBe('scheduleSomething');
  });

  test('semana esburacada (4+ dias vazios) vira o passo, quando há algo agendado', () => {
    const a = proximaAcao(
      estado({
        proximas: [item({ state: 'SCHEDULED', publishAt: '2026-07-31T18:00:00.000Z' })],
        week: { scheduled: 1, byDay: [1, 0, 0, 0, 0, 1, 1] },
      }),
    );
    expect(a?.kind).toBe('emptyDays');
  });

  test('plano no limite avisa quando não há nada mais urgente', () => {
    const a = proximaAcao(
      estado({
        proximas: [item({ state: 'SCHEDULED', publishAt: '2026-07-31T18:00:00.000Z' })],
        week: { scheduled: 7, byDay: [1, 1, 1, 1, 1, 1, 1] },
        planoNoLimite: true,
      }),
    );
    expect(a?.kind).toBe('planAtLimit');
  });

  test('operação saudável não inventa sugestão — devolve null e o bloco some', () => {
    const a = proximaAcao(
      estado({
        proximas: [item({ state: 'SCHEDULED', publishAt: '2026-07-31T18:00:00.000Z' })],
        week: { scheduled: 7, byDay: [1, 1, 1, 1, 1, 1, 1] },
      }),
    );
    expect(a).toBeNull();
  });

  test('a escada é determinística: mesma entrada, mesma saída', () => {
    const e = estado({ rascunhosServidor: [rascunho()] });
    expect(proximaAcao(e)).toEqual(proximaAcao(e));
  });

  test('todo tipo de próxima ação tem tradução', () => {
    const acoes = (home.nextAction as Record<string, string>) ?? {};
    const casos: EstadoDaHome[] = [
      estado({ rascunhoLocal: { texto: 'x', atualizadoEm: 1 } }),
      estado({ rascunhosServidor: [rascunho()] }),
      estado({ proximas: [], week: { scheduled: 0, byDay: [0, 0, 0, 0, 0, 0, 0] } }),
      estado({
        proximas: [item({ state: 'SCHEDULED', publishAt: '2026-07-31T18:00:00.000Z' })],
        week: { scheduled: 1, byDay: [1, 0, 0, 0, 0, 1, 1] },
      }),
      estado({
        proximas: [item({ state: 'SCHEDULED', publishAt: '2026-07-31T18:00:00.000Z' })],
        week: { scheduled: 7, byDay: [1, 1, 1, 1, 1, 1, 1] },
        planoNoLimite: true,
      }),
    ];
    for (const caso of casos) {
      const a = proximaAcao(caso);
      expect(a).not.toBeNull();
      expect(typeof acoes[`${a!.kind}Title`]).toBe('string');
      expect(typeof acoes[`${a!.kind}Body`]).toBe('string');
      expect(typeof acoes[`${a!.kind}Cta`]).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------

describe('atividadeRecente: ordena por quando o desfecho ACONTECEU', () => {
  test('usa publishedAt, não o horário agendado — senão o retry mente sobre a hora', () => {
    const lista = atividadeRecente(
      [
        item({ groupId: 'cedo', publishAt: '2026-07-31T09:00:00.000Z', publishedAt: '2026-07-31T09:00:00.000Z' }),
        // agendado para as 08:00, mas só saiu às 14:30 depois de retentar
        item({
          groupId: 'retentado',
          publishAt: '2026-07-31T08:00:00.000Z',
          publishedAt: '2026-07-31T14:30:00.000Z',
        }),
      ],
      [],
      AGORA,
    );
    expect(lista[0]!.groupId).toBe('retentado');
  });

  test('sem publishedAt (falhou/cancelou), cai para updatedAt', () => {
    const lista = atividadeRecente(
      [
        item({ groupId: 'ok', publishedAt: '2026-07-31T09:00:00.000Z' }),
        item({
          groupId: 'falhou',
          state: 'FAILED',
          publishedAt: null,
          updatedAt: '2026-07-31T11:00:00.000Z',
          group: { state: 'PARTIAL', origin: 'WEB', awaitingApproval: false },
        }),
      ],
      [],
      AGORA,
    );
    expect(lista[0]!.groupId).toBe('falhou');
  });

  test('só estado TERMINAL entra: o que ainda está por sair não é atividade', () => {
    const lista = atividadeRecente(
      [
        item({ groupId: 'agendado', state: 'SCHEDULED' }),
        item({ groupId: 'publicando', state: 'PUBLISHING' }),
      ],
      [],
      AGORA,
    );
    expect(lista).toEqual([]);
  });

  test('notificações de aprovação entram MESCLADAS por tempo, não numa lista à parte', () => {
    const lista = atividadeRecente(
      [item({ groupId: 'antes', publishedAt: '2026-07-31T08:00:00.000Z' })],
      [
        {
          id: 'n1',
          kind: 'approval.approved',
          title: 'Aprovado',
          body: null,
          link: '/kanban',
          readAt: null,
          createdAt: '2026-07-31T10:00:00.000Z',
        },
      ],
      AGORA,
    );
    expect(lista[0]!.tipo).toBe('notification');
    expect(lista[1]!.tipo).toBe('publication');
  });

  test('limita o tamanho — a home resume, não substitui a central', () => {
    const muitos = Array.from({ length: 30 }, (_, i) =>
      item({ id: `p${i}`, groupId: `g${i}`, publishedAt: `2026-07-3${(i % 9) + 1}T09:00:00.000Z` }),
    );
    expect(atividadeRecente(muitos, [], AGORA).length).toBeLessThanOrEqual(8);
  });

  test('descarta o que é velho demais para ser "recente"', () => {
    const lista = atividadeRecente(
      [item({ groupId: 'antigo', publishedAt: '2026-01-01T09:00:00.000Z' })],
      [],
      AGORA,
    );
    expect(lista).toEqual([]);
  });

  test('nada recente devolve lista vazia (o bloco some)', () => {
    expect(atividadeRecente([], [], AGORA)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('destino de notificações', () => {
  test('migra o deep link legado de post para o detalhe existente no quadro', () => {
    expect(destinoDaNotificacao('/posts/grupo com espaço')).toBe(
      '/kanban?post=grupo%20com%20espa%C3%A7o',
    );
  });

  test('preserva destinos internos já válidos e rejeita destinos externos', () => {
    expect(destinoDaNotificacao('/kanban?post=g1')).toBe('/kanban?post=g1');
    expect(destinoDaNotificacao('https://example.com')).toBeNull();
  });
});

describe('rascunhosDoServidor: só o que NUNCA vai sair sozinho', () => {
  const draft = (over: Partial<FeedItem['group']> = {}, o: Partial<FeedItem> = {}) =>
    item({
      state: 'DRAFT',
      publishAt: null,
      publishedAt: null,
      group: { state: 'DRAFT', origin: 'WEB', awaitingApproval: false, ...over },
      ...o,
    });

  test('rascunho sem aprovação pendente é o caso de valor: está órfão', () => {
    expect(rascunhosDoServidor([draft({}, { groupId: 'orfao' })]).map((d) => d.groupId)).toEqual([
      'orfao',
    ]);
  });

  test('rascunho AGUARDANDO aprovação fica de fora — já é contado pelo bloco de atenção', () => {
    expect(rascunhosDoServidor([draft({ awaitingApproval: true })])).toEqual([]);
  });

  test('post agendado não é rascunho', () => {
    expect(rascunhosDoServidor([item({ state: 'SCHEDULED' })])).toEqual([]);
  });

  test('agrupa por post: um rascunho em três canais é UM item', () => {
    const r = rascunhosDoServidor([
      draft({}, { id: 'a', groupId: 'g1', channelId: 'c1' }),
      draft({}, { id: 'b', groupId: 'g1', channelId: 'c2' }),
      draft({}, { id: 'c', groupId: 'g1', channelId: 'c3' }),
    ]);
    expect(r).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe('resumoDoRascunhoLocal', () => {
  test('rascunho vazio não conta como trabalho pendente', () => {
    expect(resumoDoRascunhoLocal({ text: '   ', thread: [], mediaIds: [], contentUpdatedAt: 1 })).toBeNull();
  });

  test('texto escrito conta', () => {
    const r = resumoDoRascunhoLocal({
      text: 'começo de post',
      thread: [],
      mediaIds: [],
      contentUpdatedAt: 123,
    });
    expect(r?.texto).toBe('começo de post');
    expect(r?.atualizadoEm).toBe(123);
  });

  test('só mídia anexada também conta como rascunho começado', () => {
    expect(
      resumoDoRascunhoLocal({ text: '', thread: [], mediaIds: ['m1'], contentUpdatedAt: 5 }),
    ).not.toBeNull();
  });

  test('rascunho guardado ANTES do campo existir (contentUpdatedAt 0) fica de fora', () => {
    expect(
      resumoDoRascunhoLocal({ text: 'algo', thread: [], mediaIds: [], contentUpdatedAt: 0 }),
    ).toBeNull();
  });

  test('texto personalizado por canal também conta como conteúdo pendente', () => {
    const resumo = resumoDoRascunhoLocal({
      text: '',
      overrides: { c1: 'texto só para o LinkedIn' },
      channelSettings: {},
      thread: [],
      mediaIds: [],
      contentUpdatedAt: 9,
    });

    expect(resumo?.texto).toBe('texto só para o LinkedIn');
  });

  test('mídia numa réplica também conta mesmo sem texto principal', () => {
    const resumo = resumoDoRascunhoLocal({
      text: '',
      overrides: {},
      channelSettings: {},
      thread: [{ text: '', mediaIds: ['m-thread'] }],
      mediaIds: [],
      contentUpdatedAt: 10,
    });

    expect(resumo).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('ordemDosBlocos: a ordem é DADO, não JSX espalhado', () => {
  test('primeiro uso mostra só o onboarding — nenhum bloco novo aparece junto', () => {
    const o = ordemDosBlocos(estado({ firstRun: 'no_channels' }));
    expect(o.principal).toEqual(['firstRun']);
    expect(o.lateral).toEqual([]);
  });

  test('atenção e próxima ação são mutuamente exclusivos', () => {
    const comAtencao = ordemDosBlocos(estado({ atencao: atencao({ failed: 1, total: 1 }) }));
    expect(comAtencao.principal).toContain('attention');
    expect(comAtencao.principal).not.toContain('nextAction');
  });

  test('bloco sem conteúdo não entra na ordem (e por isso não ocupa espaço)', () => {
    const o = ordemDosBlocos(estado());
    expect(o.principal).not.toContain('attention');
    expect(o.principal).not.toContain('upcoming');
    expect(o.lateral).not.toContain('drafts');
  });

  test('o que é acionável vem antes do que é informativo, e plano por último', () => {
    const o = ordemDosBlocos(
      estado({
        rascunhosServidor: [rascunho()],
        mostrarPlano: true,
      } as Partial<EstadoDaHome>),
    );
    expect(o.lateral.indexOf('drafts')).toBeLessThan(o.lateral.indexOf('usage'));
  });

  test('a versão em coluna única concatena principal e lateral, sem perder bloco', () => {
    const e = estado({ proximas: [item({ state: 'SCHEDULED' })] });
    const o = ordemDosBlocos(e);
    expect(new Set(o.unica)).toEqual(new Set([...o.principal, ...o.lateral]));
  });

  test('nenhum bloco aparece duas vezes', () => {
    const o = ordemDosBlocos(estado({ proximas: [item({ state: 'SCHEDULED' })] }));
    expect(new Set(o.unica).size).toBe(o.unica.length);
  });

  test('fontes pendentes ou com erro continuam na ordem para renderizar seu próprio estado', () => {
    const ordenar = ordemDosBlocos as unknown as (
      value: EstadoDaHome,
      fontes: {
        upcoming: 'pending' | 'error' | 'empty' | 'ready';
        drafts: 'pending' | 'error' | 'empty' | 'ready';
        pipeline: 'pending' | 'error' | 'empty' | 'ready';
        activity: 'pending' | 'error' | 'empty' | 'ready';
      },
    ) => ReturnType<typeof ordemDosBlocos>;

    const o = ordenar(estado(), {
      upcoming: 'pending',
      drafts: 'error',
      pipeline: 'error',
      activity: 'pending',
    });

    expect(o.principal).toContain('upcoming');
    expect(o.principal).toContain('pipeline');
    expect(o.lateral).toContain('drafts');
    expect(o.lateral).toContain('activity');
  });

  test('primeiro uso ignora fontes independentes já resolvidas ou pendentes', () => {
    const ordenar = ordemDosBlocos as unknown as (
      value: EstadoDaHome,
      fontes: Record<'upcoming' | 'drafts' | 'pipeline' | 'activity', 'pending'>,
    ) => ReturnType<typeof ordemDosBlocos>;

    expect(
      ordenar(estado({ firstRun: 'no_channels' }), {
        upcoming: 'pending',
        drafts: 'pending',
        pipeline: 'pending',
        activity: 'pending',
      }),
    ).toEqual({ principal: ['firstRun'], lateral: [], unica: ['firstRun'] });
  });
});
