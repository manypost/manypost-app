import type { components } from '@/lib/api/schema';

/**
 * Regras do quadro como funções PURAS.
 *
 * Até aqui elas viviam dentro do componente — a regra que decide em qual coluna um post aparece só
 * era verificável abrindo o navegador, e o repositório não tem harness de navegador. O quadro é a
 * ferramenta operacional real do produto e era a única tela sem nenhum teste.
 *
 * O que mora aqui: derivação de coluna, agrupamento, filtro, ordenação, o conjunto FECHADO de
 * transições de arraste e as ações que cada card oferece. O que NÃO mora aqui: nada de React, nada
 * de rede, nada de tradução — só a decisão, em dado.
 */

export type FeedItem = components['schemas']['FeedItem'];

export type ColumnId = 'draft' | 'awaiting' | 'scheduled' | 'published' | 'failed';

/** alvo de arraste que não é coluna: aparece só durante o arraste (design.md — não há coluna "Cancelado") */
export type DropTarget = ColumnId | 'cancel';

export const COLUNAS: ReadonlyArray<{ id: ColumnId; accent: string }> = [
  { id: 'draft', accent: 'border-t-mist' },
  { id: 'awaiting', accent: 'border-t-state-review' },
  { id: 'scheduled', accent: 'border-t-state-scheduled' },
  { id: 'published', accent: 'border-t-state-published' },
  { id: 'failed', accent: 'border-t-state-failed' },
];

export interface GroupCard {
  groupId: string;
  state: string;
  awaitingApproval: boolean;
  origin: string;
  publishAt: string | null;
  text: string;
  items: FeedItem[];
  errorMessage: string | null;
  column: ColumnId;
}

/** publicações que pedem uma pessoa — é o que puxa um grupo inteiro para a coluna "Falhou" */
const PEDE_PESSOA = new Set(['FAILED', 'NEEDS_REVIEW']);

const algumaPedePessoa = (items: FeedItem[]) => items.some((i) => PEDE_PESSOA.has(i.state));

/**
 * Coluna a partir do estado do GRUPO cruzado com o mix de estados das publicações.
 *
 * `PARTIAL` é terminal misto: já teve efeito em alguma rede. Ele cai em "Falhou" quando alguma
 * publicação ainda pede ação humana, e conta como publicado quando não pede — o que sobrou é
 * cancelado, e cancelado não é trabalho pendente.
 *
 * Estado desconhecido devolve `null` de propósito: ficar fora do quadro é mais honesto do que cair
 * numa coluna por acidente e ser lido como algo que não é.
 */
export function columnOf(state: string, awaiting: boolean, items: FeedItem[]): ColumnId | null {
  if (state === 'DRAFT') return awaiting ? 'awaiting' : 'draft';
  // grupo fica SCHEDULED enquanto houver pendente — falha já visível vai p/ Falhou
  if (state === 'SCHEDULED') return algumaPedePessoa(items) ? 'failed' : 'scheduled';
  if (state === 'DONE') return 'published';
  if (state === 'PARTIAL') return algumaPedePessoa(items) ? 'failed' : 'published';
  return null; // CANCELLED e qualquer estado novo ficam fora do quadro
}

/** feed flat (uma linha por publicação) → um card por grupo, preservando a ordem de chegada */
export function agruparEmCards(items: FeedItem[]): GroupCard[] {
  const porGrupo = new Map<string, FeedItem[]>();
  for (const item of items) {
    const lista = porGrupo.get(item.groupId);
    if (lista) lista.push(item);
    else porGrupo.set(item.groupId, [item]);
  }

  const out: GroupCard[] = [];
  for (const [groupId, doGrupo] of porGrupo) {
    const primeiro = doGrupo[0]!;
    const column = columnOf(primeiro.group.state, primeiro.group.awaitingApproval, doGrupo);
    if (!column) continue;
    out.push({
      groupId,
      state: primeiro.group.state,
      awaitingApproval: primeiro.group.awaitingApproval,
      origin: primeiro.group.origin,
      publishAt: primeiro.publishAt,
      text: primeiro.text,
      items: doGrupo,
      errorMessage: doGrupo.find((i) => i.errorMessage)?.errorMessage ?? null,
      column,
    });
  }
  return out;
}

/**
 * Caixa baixa sem diacrítico.
 *
 * Compartilhada com a paleta de comandos: uma única regra de normalização, para "conexoes" achar
 * "Conexões" nos dois lugares em vez de duas implementações que divergem com o tempo.
 */
export const normalizarTexto = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export interface FiltrosDoQuadro {
  colunas?: ColumnId[];
  canais?: string[];
  busca?: string;
}

/** filtros se acumulam (E, não OU): cada um estreita o que o anterior deixou passar */
export function aplicarFiltros(cards: GroupCard[], f: FiltrosDoQuadro): GroupCard[] {
  const colunas = f.colunas?.length ? new Set<ColumnId>(f.colunas) : null;
  const canais = f.canais?.length ? new Set(f.canais) : null;
  const busca = f.busca?.trim() ? normalizarTexto(f.busca.trim()) : null;

  return cards.filter((c) => {
    if (colunas && !colunas.has(c.column)) return false;
    if (canais && !c.items.some((i) => canais.has(i.channelId))) return false;
    if (busca && !normalizarTexto(c.text).includes(busca)) return false;
    return true;
  });
}

/**
 * Mais recente primeiro. Card sem horário (rascunho) sobe para o topo em vez de afundar:
 * comparar `null` como string vazia jogaria todo rascunho para o fim da coluna que é justamente a
 * dele.
 */
export function ordenarCards(cards: GroupCard[]): GroupCard[] {
  return [...cards].sort((a, b) => {
    if (a.publishAt === b.publishAt) return 0;
    if (a.publishAt === null) return -1;
    if (b.publishAt === null) return 1;
    return b.publishAt.localeCompare(a.publishAt);
  });
}

/**
 * Janela do feed, estável dentro do mesmo dia civil.
 *
 * A estabilidade não é detalhe: esta é a chave de cache que o quadro COMPARTILHA com a home. Se
 * variasse por hora, as duas telas leriam caches diferentes e poderiam mostrar números diferentes
 * do mesmo pipeline — que é exatamente o que o compartilhamento existe para impedir.
 */
export function kanbanFeedParams(dias: number, agora = new Date()): { from: string } {
  const d = new Date(agora);
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return { from: d.toISOString() };
}

// ---------------------------------------------------------------------------

export type MotivoRecusa = 'approvalOnly' | 'draftNotSchedulable' | 'publishNeedsConfirmation' | 'nothingToDo';

export type Transicao =
  | { tipo: 'retry' }
  | { tipo: 'cancel' }
  | { tipo: 'nenhuma' }
  | { tipo: 'recusa'; motivo: MotivoRecusa };

/** grupos que ainda dá para cancelar — espelha CANCELLABLE_STATES das publicações */
const COLUNAS_CANCELAVEIS = new Set<ColumnId>(['draft', 'awaiting', 'scheduled']);

/**
 * O conjunto fechado de transições de arraste.
 *
 * Ser generoso com alvos e pedir desculpa depois é o que o quadro fazia: uma mensagem só para toda
 * recusa. Aqui cada recusa carrega o motivo, e a interface usa esse motivo para oferecer a operação
 * que FUNCIONA — porque em dois dos três casos a pessoa quer algo legítimo que só tem outro caminho.
 */
export function transicaoPermitida(de: ColumnId, para: DropTarget): Transicao {
  if (de === para) return { tipo: 'nenhuma' };

  if (para === 'cancel') {
    return COLUNAS_CANCELAVEIS.has(de) ? { tipo: 'cancel' } : { tipo: 'recusa', motivo: 'nothingToDo' };
  }

  // publicar é irreversível e um arrasto é um dedo escorregando: só no menu, com confirmação
  if (para === 'published') return { tipo: 'recusa', motivo: 'publishNeedsConfirmation' };

  if (para === 'scheduled') {
    if (de === 'failed') return { tipo: 'retry' };
    // aprovar pelo quadro faria o registro de aprovação mentir sobre quem decidiu
    if (de === 'awaiting') return { tipo: 'recusa', motivo: 'approvalOnly' };
    // não existe operação que agende um DRAFT: PATCH num rascunho mantém o grupo em DRAFT
    if (de === 'draft') return { tipo: 'recusa', motivo: 'draftNotSchedulable' };
  }

  return { tipo: 'recusa', motivo: 'nothingToDo' };
}

// ---------------------------------------------------------------------------

export type AcaoDoCard =
  | 'open'
  | 'duplicate'
  | 'retry'
  | 'publishNow'
  | 'cancel'
  | 'approvalLink';

/** o menu oferece só o que a plataforma faz naquele estado — nada de item que erra ao ser clicado */
export function acoesDoCard(card: GroupCard): AcaoDoCard[] {
  const acoes: AcaoDoCard[] = ['open', 'duplicate'];
  if (card.column === 'failed') acoes.push('retry');
  if (card.column === 'scheduled') acoes.push('publishNow');
  if (card.column === 'awaiting') acoes.push('approvalLink');
  if (COLUNAS_CANCELAVEIS.has(card.column)) acoes.push('cancel');
  return acoes;
}

/** Shift+clique: o trecho entre a âncora e o alvo, nos dois sentidos */
export function intervaloDeSelecao(ids: string[], ancora: string, alvo: string): string[] {
  const i = ids.indexOf(ancora);
  const j = ids.indexOf(alvo);
  if (i < 0 || j < 0) return j >= 0 ? [alvo] : [];
  return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
}
