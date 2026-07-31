import { describe, expect, test } from 'bun:test';
import messages from '@/messages/pt-BR.json';
import type { components } from '@/lib/api/schema';
import {
  acoesDoCard,
  agruparEmCards,
  aplicarFiltros,
  columnOf,
  COLUNAS,
  intervaloDeSelecao,
  kanbanFeedParams,
  normalizarTexto,
  ordenarCards,
  transicaoPermitida,
  type ColumnId,
  type GroupCard,
} from './logic';

type FeedItem = components['schemas']['FeedItem'];

const kanban = messages.kanban as Record<string, unknown>;

/** item de feed mínimo — só os campos que a lógica lê */
const item = (over: Partial<FeedItem> & { state?: string } = {}): FeedItem =>
  ({
    id: over.id ?? 'pub-1',
    groupId: over.groupId ?? 'g1',
    channelId: over.channelId ?? 'c1',
    state: over.state ?? 'SCHEDULED',
    publishAt: over.publishAt ?? '2026-07-30T12:00:00.000Z',
    text: over.text ?? 'texto',
    mediaCount: over.mediaCount ?? 0,
    mediaPreview: over.mediaPreview ?? null,
    externalId: over.externalId ?? null,
    releaseUrl: over.releaseUrl ?? null,
    errorClass: over.errorClass ?? null,
    errorMessage: over.errorMessage ?? null,
    attemptCount: over.attemptCount ?? 0,
    group: over.group ?? { state: 'SCHEDULED', origin: 'WEB', awaitingApproval: false },
    channel: over.channel ?? {
      provider: 'x',
      name: 'Canal',
      username: null,
      avatarUrl: null,
    },
  }) as FeedItem;

const card = (over: Partial<GroupCard> = {}): GroupCard => ({
  groupId: 'g1',
  state: 'SCHEDULED',
  awaitingApproval: false,
  origin: 'WEB',
  publishAt: '2026-07-30T12:00:00.000Z',
  text: 'texto',
  items: [item()],
  errorMessage: null,
  mediaPreview: null,
  column: 'scheduled',
  ...over,
});

// ---------------------------------------------------------------------------

describe('columnOf: a coluna sai do estado do GRUPO cruzado com o mix das publicações', () => {
  test('DRAFT sem aprovação pendente é rascunho', () => {
    expect(columnOf('DRAFT', false, [item({ state: 'DRAFT' })])).toBe('draft');
  });

  test('DRAFT com aprovação pendente sai do rascunho e vira aguardando', () => {
    expect(columnOf('DRAFT', true, [item({ state: 'DRAFT' })])).toBe('awaiting');
  });

  test('SCHEDULED sem falha visível é agendado', () => {
    expect(columnOf('SCHEDULED', false, [item({ state: 'SCHEDULED' })])).toBe('scheduled');
  });

  test.each([['FAILED'], ['NEEDS_REVIEW']])(
    'SCHEDULED com uma publicação %s vai para Falhou — o grupo ainda está pendente, mas já há perda',
    (estado) => {
      const items = [item({ id: 'a', state: 'SCHEDULED' }), item({ id: 'b', state: estado })];
      expect(columnOf('SCHEDULED', false, items)).toBe('failed');
    },
  );

  test('DONE é publicado', () => {
    expect(columnOf('DONE', false, [item({ state: 'PUBLISHED' })])).toBe('published');
  });

  test('PARTIAL com publicação que pede ação humana conta como Falhou, não como publicado', () => {
    const items = [item({ id: 'a', state: 'PUBLISHED' }), item({ id: 'b', state: 'FAILED' })];
    expect(columnOf('PARTIAL', false, items)).toBe('failed');
  });

  test('PARTIAL sem nada pendente conta como publicado — entregou o que dava', () => {
    const items = [item({ id: 'a', state: 'PUBLISHED' }), item({ id: 'b', state: 'CANCELLED' })];
    expect(columnOf('PARTIAL', false, items)).toBe('published');
  });

  test('CANCELLED fica FORA do quadro (null), não vira sexta coluna', () => {
    expect(columnOf('CANCELLED', false, [item({ state: 'CANCELLED' })])).toBeNull();
  });

  test('estado desconhecido fica fora em vez de cair numa coluna por acidente', () => {
    expect(columnOf('QUALQUER_COISA', false, [item()])).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('agruparEmCards: uma publicação por canal vira UM card por grupo', () => {
  test('agrupa por groupId e mantém todas as publicações no card', () => {
    const cards = agruparEmCards([
      item({ id: 'a', groupId: 'g1', channelId: 'c1' }),
      item({ id: 'b', groupId: 'g1', channelId: 'c2' }),
      item({ id: 'c', groupId: 'g2' }),
    ]);
    expect(cards).toHaveLength(2);
    expect(cards.find((c) => c.groupId === 'g1')?.items).toHaveLength(2);
  });

  test('o card herda o grupo/horário/texto da PRIMEIRA publicação do grupo', () => {
    const cards = agruparEmCards([
      item({ id: 'a', groupId: 'g1', text: 'primeiro', publishAt: '2026-07-30T09:00:00.000Z' }),
      item({ id: 'b', groupId: 'g1', text: 'segundo', publishAt: '2026-07-30T18:00:00.000Z' }),
    ]);
    expect(cards[0]?.text).toBe('primeiro');
    expect(cards[0]?.publishAt).toBe('2026-07-30T09:00:00.000Z');
  });

  test('o card expõe a primeira mensagem de erro que encontrar', () => {
    const cards = agruparEmCards([
      item({ id: 'a', groupId: 'g1', errorMessage: null }),
      item({ id: 'b', groupId: 'g1', errorMessage: 'token expirado' }),
    ]);
    expect(cards[0]?.errorMessage).toBe('token expirado');
  });

  test('o card usa o primeiro preview disponível do grupo, mesmo quando não está na primeira publicação', () => {
    const preview = {
      type: 'image' as const,
      url: 'https://cdn.example/post.webp',
      mime: 'image/webp',
      alt: 'Post sobre calendário',
    };
    const cards = agruparEmCards([
      item({ id: 'a', groupId: 'g1', mediaPreview: null }),
      item({ id: 'b', groupId: 'g1', mediaPreview: preview }),
    ]);
    expect(cards[0]?.mediaPreview).toEqual(preview);
  });

  test('grupo cancelado não vira card', () => {
    const cards = agruparEmCards([
      item({ groupId: 'g1', group: { state: 'CANCELLED', origin: 'WEB', awaitingApproval: false } }),
    ]);
    expect(cards).toEqual([]);
  });

  test('feed vazio devolve lista vazia', () => {
    expect(agruparEmCards([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('normalizarTexto: acento não pode esconder um card', () => {
  test('remove diacrítico e caixa', () => {
    expect(normalizarTexto('Conexões')).toBe('conexoes');
    expect(normalizarTexto('AÇÃO')).toBe('acao');
  });

  test('texto sem acento é preservado', () => {
    expect(normalizarTexto('kanban')).toBe('kanban');
  });
});

describe('aplicarFiltros', () => {
  const base = [
    card({ groupId: 'g1', column: 'draft', text: 'Promoção de verão' }),
    card({
      groupId: 'g2',
      column: 'failed',
      text: 'Nada a ver',
      items: [item({ channelId: 'c2' })],
    }),
    card({ groupId: 'g3', column: 'scheduled', text: 'outro' }),
  ];

  test('sem filtro devolve tudo (a lista é a mesma ordem)', () => {
    expect(aplicarFiltros(base, {}).map((c) => c.groupId)).toEqual(['g1', 'g2', 'g3']);
  });

  test('filtra por coluna, aceitando várias', () => {
    const r = aplicarFiltros(base, { colunas: ['draft', 'scheduled'] });
    expect(r.map((c) => c.groupId)).toEqual(['g1', 'g3']);
  });

  test('filtra por canal, aceitando vários', () => {
    const r = aplicarFiltros(base, { canais: ['c2'] });
    expect(r.map((c) => c.groupId)).toEqual(['g2']);
  });

  test('busca ignora acento e caixa — "promocao" acha "Promoção"', () => {
    const r = aplicarFiltros(base, { busca: 'promocao' });
    expect(r.map((c) => c.groupId)).toEqual(['g1']);
  });

  test('busca só com espaço não filtra nada', () => {
    expect(aplicarFiltros(base, { busca: '   ' })).toHaveLength(3);
  });

  test('filtros se acumulam (E, não OU)', () => {
    const r = aplicarFiltros(base, { colunas: ['draft'], busca: 'nada' });
    expect(r).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('ordenarCards: mais recente primeiro, e sem sumir com rascunho sem horário', () => {
  test('ordena por publishAt decrescente', () => {
    const r = ordenarCards([
      card({ groupId: 'antigo', publishAt: '2026-07-01T00:00:00.000Z' }),
      card({ groupId: 'novo', publishAt: '2026-07-31T00:00:00.000Z' }),
    ]);
    expect(r.map((c) => c.groupId)).toEqual(['novo', 'antigo']);
  });

  test('card sem horário (rascunho) vai para o topo, não some', () => {
    const r = ordenarCards([
      card({ groupId: 'com-hora', publishAt: '2026-07-31T00:00:00.000Z' }),
      card({ groupId: 'sem-hora', publishAt: null }),
    ]);
    expect(r.map((c) => c.groupId)).toEqual(['sem-hora', 'com-hora']);
  });

  test('empate mantém a ordem de entrada (estável)', () => {
    const r = ordenarCards([
      card({ groupId: 'a', publishAt: '2026-07-31T00:00:00.000Z' }),
      card({ groupId: 'b', publishAt: '2026-07-31T00:00:00.000Z' }),
    ]);
    expect(r.map((c) => c.groupId)).toEqual(['a', 'b']);
  });

  test('não muta a lista recebida', () => {
    const entrada = [card({ groupId: 'a', publishAt: '2026-07-01T00:00:00.000Z' }), card({ groupId: 'b' })];
    ordenarCards(entrada);
    expect(entrada.map((c) => c.groupId)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------

describe('kanbanFeedParams: a chave de cache é COMPARTILHADA com a home', () => {
  test('duas chamadas no mesmo instante produzem parâmetros idênticos', () => {
    const agora = new Date('2026-07-31T15:42:11.000Z');
    expect(kanbanFeedParams(30, agora)).toEqual(kanbanFeedParams(30, agora));
  });

  test('o mesmo dia civil produz a mesma janela, mesmo em horas diferentes', () => {
    const manha = kanbanFeedParams(30, new Date('2026-07-31T08:00:00.000Z'));
    const noite = kanbanFeedParams(30, new Date('2026-07-31T23:00:00.000Z'));
    expect(manha).toEqual(noite);
  });

  test('a janela começa no início do dia, N dias atrás', () => {
    const p = kanbanFeedParams(30, new Date('2026-07-31T15:00:00.000Z'));
    expect(p.from.startsWith('2026-07-01')).toBe(true);
  });

  test('janelas diferentes produzem parâmetros diferentes (senão o cache mentiria)', () => {
    const agora = new Date('2026-07-31T15:00:00.000Z');
    expect(kanbanFeedParams(7, agora)).not.toEqual(kanbanFeedParams(90, agora));
  });
});

// ---------------------------------------------------------------------------

describe('transicaoPermitida: conjunto FECHADO, e cada recusa sabe explicar', () => {
  test('Falhou → Agendado é a nova tentativa', () => {
    expect(transicaoPermitida('failed', 'scheduled')).toEqual({ tipo: 'retry' });
  });

  test.each<[ColumnId]>([['draft'], ['awaiting'], ['scheduled']])(
    '%s → cancelar é permitido (o grupo ainda é cancelável)',
    (de) => {
      expect(transicaoPermitida(de, 'cancel')).toEqual({ tipo: 'cancel' });
    },
  );

  test('Publicado → cancelar é recusado: não há o que cancelar', () => {
    const r = transicaoPermitida('published', 'cancel');
    expect(r.tipo).toBe('recusa');
  });

  test('Aguardando → Agendado é recusado, e o motivo aponta o link de aprovação', () => {
    const r = transicaoPermitida('awaiting', 'scheduled');
    expect(r).toEqual({ tipo: 'recusa', motivo: 'approvalOnly' });
  });

  test('Rascunho → Agendado é recusado porque NÃO EXISTE endpoint que agende um rascunho', () => {
    const r = transicaoPermitida('draft', 'scheduled');
    expect(r).toEqual({ tipo: 'recusa', motivo: 'draftNotSchedulable' });
  });

  test.each<[ColumnId]>([['draft'], ['awaiting'], ['scheduled'], ['failed']])(
    '%s → Publicado é recusado: publicar por arrasto acidental é destrutivo demais',
    (de) => {
      expect(transicaoPermitida(de, 'published')).toEqual({
        tipo: 'recusa',
        motivo: 'publishNeedsConfirmation',
      });
    },
  );

  test('soltar na própria coluna não é transição nem recusa', () => {
    expect(transicaoPermitida('scheduled', 'scheduled')).toEqual({ tipo: 'nenhuma' });
  });

  test('todo motivo de recusa tem tradução', () => {
    const motivos = new Set<string>();
    const alvos: Array<ColumnId | 'cancel'> = [...COLUNAS.map((c) => c.id), 'cancel'];
    for (const de of COLUNAS.map((c) => c.id)) {
      for (const para of alvos) {
        const r = transicaoPermitida(de, para);
        if (r.tipo === 'recusa') motivos.add(r.motivo);
      }
    }
    const traducoes = kanban.refusals as Record<string, string>;
    expect(motivos.size).toBeGreaterThan(0);
    for (const m of motivos) expect(typeof traducoes?.[m]).toBe('string');
  });
});

// ---------------------------------------------------------------------------

describe('acoesDoCard: o menu só oferece o que a plataforma faz naquele estado', () => {
  test('card publicado não oferece retry, cancelar nem publicar agora', () => {
    const a = acoesDoCard(card({ column: 'published', state: 'DONE' }));
    expect(a).not.toContain('retry');
    expect(a).not.toContain('cancel');
    expect(a).not.toContain('publishNow');
  });

  test('card em Falhou oferece nova tentativa', () => {
    expect(acoesDoCard(card({ column: 'failed', state: 'SCHEDULED' }))).toContain('retry');
  });

  test('card agendado oferece publicar agora e cancelar', () => {
    const a = acoesDoCard(card({ column: 'scheduled', state: 'SCHEDULED' }));
    expect(a).toContain('publishNow');
    expect(a).toContain('cancel');
  });

  test('card aguardando aprovação oferece copiar o link', () => {
    const a = acoesDoCard(card({ column: 'awaiting', state: 'DRAFT', awaitingApproval: true }));
    expect(a).toContain('approvalLink');
  });

  test('rascunho NÃO oferece publicar agora — não há operação que agende um rascunho', () => {
    expect(acoesDoCard(card({ column: 'draft', state: 'DRAFT' }))).not.toContain('publishNow');
  });

  test('todo card oferece abrir e duplicar', () => {
    for (const col of COLUNAS.map((c) => c.id)) {
      const a = acoesDoCard(card({ column: col }));
      expect(a).toContain('open');
      expect(a).toContain('duplicate');
    }
  });

  test('toda ação possível tem tradução', () => {
    const traducoes = kanban.actions as Record<string, string>;
    for (const col of COLUNAS.map((c) => c.id)) {
      for (const acao of acoesDoCard(card({ column: col, awaitingApproval: col === 'awaiting' }))) {
        expect(typeof traducoes?.[acao]).toBe('string');
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('intervaloDeSelecao: Shift+clique seleciona o trecho, nos dois sentidos', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  test('da âncora para baixo', () => {
    expect(intervaloDeSelecao(ids, 'b', 'd')).toEqual(['b', 'c', 'd']);
  });

  test('da âncora para cima devolve o mesmo trecho', () => {
    expect(intervaloDeSelecao(ids, 'd', 'b')).toEqual(['b', 'c', 'd']);
  });

  test('âncora igual ao alvo seleciona um só', () => {
    expect(intervaloDeSelecao(ids, 'c', 'c')).toEqual(['c']);
  });

  test('id fora da lista devolve só o alvo em vez de estourar', () => {
    expect(intervaloDeSelecao(ids, 'zzz', 'c')).toEqual(['c']);
  });
});
