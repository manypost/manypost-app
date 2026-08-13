import type { components } from '@/lib/api/schema';
import type { InsightsSummary } from './hooks';

/**
 * Decisões da tela inicial como funções PURAS.
 *
 * Ficam separadas do JSX porque são elas que decidem o que a pessoa vê — quais linhas aparecem no
 * bloco de atenção, se o medidor está perto do limite, quais dias da semana estão vazios. É o tipo
 * de lógica que, dentro de um componente, só seria verificável abrindo o navegador; e o
 * repositório não tem harness de navegador.
 */

export type AttentionKind =
  | 'failed'
  | 'needsReview'
  | 'awaitingApproval'
  | 'partial'
  | 'channel';

export interface AttentionRow {
  kind: AttentionKind;
  count: number;
  /** para `channel`: o canal específico, para a linha poder nomeá-lo */
  channel?: { channelId: string; provider: string; name: string | null; status: string };
  href: string;
  /** urgência: quanto menor, mais acima. Perda de trabalho vem antes de pendência de fluxo. */
  weight: number;
}

/**
 * Linhas do bloco de atenção, mais urgente primeiro.
 *
 * A ordem não é estética. Falha e canal desconectado são **perda**: um post que não saiu e um que
 * não vai sair. Revisão é decisão pendente sobre algo que já aconteceu. Aprovação é fluxo normal
 * de trabalho, não problema. Entrega parcial fica no meio: já teve efeito, mas incompleto.
 *
 * Devolve `[]` quando não há nada — e é isso que faz o bloco DESAPARECER em vez de virar um cartão
 * de "tudo em ordem" (design.md §3.3: silêncio é a mensagem).
 */
export function linhasDeAtencao(a: InsightsSummary['attention']): AttentionRow[] {
  const linhas: AttentionRow[] = [];

  if (a.failed > 0) {
    linhas.push({ kind: 'failed', count: a.failed, href: '/kanban', weight: 0 });
  }
  for (const c of a.channels) {
    linhas.push({
      kind: 'channel',
      count: 1,
      channel: c,
      href: '/conexoes',
      weight: 1,
    });
  }
  if (a.partial > 0) {
    linhas.push({ kind: 'partial', count: a.partial, href: '/kanban', weight: 2 });
  }
  if (a.needsReview > 0) {
    linhas.push({ kind: 'needsReview', count: a.needsReview, href: '/kanban', weight: 3 });
  }
  if (a.awaitingApproval > 0) {
    linhas.push({
      kind: 'awaitingApproval',
      count: a.awaitingApproval,
      href: '/kanban',
      weight: 4,
    });
  }

  return linhas.sort((x, y) => x.weight - y.weight);
}

export interface Medidor {
  used: number;
  /** -1 = ilimitado (o catálogo usa -1; a barra não existe nesse caso) */
  limit: number;
  unlimited: boolean;
  /** 0–100, já limitado: uso acima do limite não estoura a barra */
  pct: number;
  /** a partir de 80% a interface avisa antes de a pessoa bater na parede */
  nearLimit: boolean;
  atLimit: boolean;
}

const LIMIAR_AVISO = 0.8;

/**
 * Medidor de uso contra limite do plano.
 *
 * `limit <= 0` significa duas coisas diferentes no catálogo e as duas caem em "sem barra": `-1` é
 * ilimitado e `0` é "o plano não inclui" — nos dois casos uma barra de progresso mentiria.
 */
export function medidor(used: number, limit: number): Medidor {
  const unlimited = limit < 0;
  if (unlimited || limit === 0) {
    return { used, limit, unlimited, pct: 0, nearLimit: false, atLimit: false };
  }
  const bruto = used / limit;
  return {
    used,
    limit,
    unlimited: false,
    pct: Math.min(100, Math.max(0, Math.round(bruto * 100))),
    nearLimit: bruto >= LIMIAR_AVISO && bruto < 1,
    atLimit: bruto >= 1,
  };
}

/** quantos dos próximos 7 dias não têm nada agendado */
export const diasVazios = (byDay: number[]): number => byDay.filter((n) => n === 0).length;

/** saudação pela hora local — a home é a primeira coisa que a pessoa lê no dia */
export function periodoDoDia(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** primeiro nome, para a saudação não virar um nome completo formal no meio da frase */
export const primeiroNome = (nome: string | null | undefined): string | null => {
  const limpo = nome?.trim();
  if (!limpo) return null;
  return limpo.split(/\s+/)[0] ?? null;
};

// ---------------------------------------------------------------------------
// Home v2 — SPEC home-operational-overview (mudança `add-home-operational-blocks`)
// ---------------------------------------------------------------------------

export type FeedItem = components['schemas']['FeedItem'];

/** publicação em estado TERMINAL: o desfecho já aconteceu, é isso que vira atividade */
const TERMINAIS = new Set(['PUBLISHED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW']);

const MAX_ATIVIDADE = 8;
const JANELA_ATIVIDADE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PROXIMAS = 5;
const MAX_RASCUNHOS = 4;
/** semana com este tanto de dias vazios já é um buraco de agenda, não uma folga */
const DIAS_VAZIOS_PREOCUPANTES = 4;

// --- rascunho local do composer ------------------------------------------------

export interface RascunhoLocal {
  texto: string;
  /** epoch ms da última edição de conteúdo */
  atualizadoEm: number;
}

/**
 * O rascunho que a pessoa deixou pela metade no composer.
 *
 * `contentUpdatedAt === 0` é descartado de propósito: é um rascunho guardado antes de o campo
 * existir, e sem o tempo o bloco não teria o que dizer. Sumir é melhor do que inventar "agora".
 */
export function resumoDoRascunhoLocal(draft: {
  text: string;
  overrides?: Record<string, string>;
  channelSettings?: Record<string, Record<string, unknown>>;
  thread: Array<{ text: string; mediaIds?: string[] }>;
  mediaIds: string[];
  contentUpdatedAt: number;
}): RascunhoLocal | null {
  if (!draft.contentUpdatedAt) return null;
  const textos = [
    draft.text,
    ...Object.values(draft.overrides ?? {}),
    ...draft.thread.map((i) => i.text),
  ];
  const primeiroTexto = textos.find((texto) => texto.trim() !== '')?.trim() ?? '';
  const comecou =
    primeiroTexto !== '' ||
    draft.mediaIds.length > 0 ||
    draft.thread.some((i) => (i.mediaIds?.length ?? 0) > 0) ||
    Object.values(draft.channelSettings ?? {}).some((settings) => Object.keys(settings).length > 0);
  if (!comecou) return null;
  return { texto: primeiroTexto, atualizadoEm: draft.contentUpdatedAt };
}

// --- rascunhos do servidor ----------------------------------------------------

export interface RascunhoServidor {
  groupId: string;
  texto: string;
  canais: number;
}

/**
 * Posts em `DRAFT` **sem** link de aprovação pendente.
 *
 * É o caso de maior valor do bloco e hoje é invisível no produto: um post cujo link de aprovação
 * expirou ou foi revogado fica em `DRAFT` para sempre e nenhuma tela diz isso. Rascunho *com*
 * aprovação pendente fica de fora — aquele já é contado pelo bloco de atenção, e repetir seria a
 * home falando duas vezes da mesma coisa.
 */
export function rascunhosDoServidor(items: FeedItem[]): RascunhoServidor[] {
  const porGrupo = new Map<string, FeedItem[]>();
  for (const i of items) {
    if (i.group.state !== 'DRAFT' || i.group.awaitingApproval) continue;
    const lista = porGrupo.get(i.groupId);
    if (lista) lista.push(i);
    else porGrupo.set(i.groupId, [i]);
  }
  return [...porGrupo.entries()]
    .slice(0, MAX_RASCUNHOS)
    .map(([groupId, doGrupo]) => ({
      groupId,
      texto: doGrupo[0]!.text,
      canais: doGrupo.length,
    }));
}

// --- atividade recente --------------------------------------------------------

export interface NotificacaoResumida {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export type EntradaDeAtividade =
  | {
      tipo: 'publication';
      chave: string;
      groupId: string;
      state: string;
      canal: string;
      provider: string;
      texto: string;
      em: number;
    }
  | { tipo: 'notification'; chave: string; title: string; link: string | null; em: number };

/**
 * Mantém notificações históricas acionáveis sem aceitar navegação externa. A rota `/posts/:id`
 * existia apenas na API; no web, o detalhe compartilhado vive no quadro.
 */
export function destinoDaNotificacao(link: string | null): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  const legado = link.match(/^\/posts\/([^/?#]+)$/);
  if (!legado) return link;
  try {
    return `/kanban?post=${encodeURIComponent(decodeURIComponent(legado[1]!))}`;
  } catch {
    return `/kanban?post=${encodeURIComponent(legado[1]!)}`;
  }
}

/**
 * O que mudou desde ontem.
 *
 * **Por que não é construída sobre notificações.** Elas pareciam a fonte natural e não são: o único
 * produtor no código é o caso de uso de aprovação, então um bloco alimentado só por elas ficaria
 * vazio na maioria das organizações. Aprovações entram *mescladas* — são atividade de verdade — mas
 * a espinha é a entrega.
 *
 * **Por que a ordem é `publishedAt ?? updatedAt`.** `publishAt` é o horário *agendado*, não o
 * momento de nada: uma publicação marcada para as 09:00 que falhou e foi retentada às 14:30
 * apareceria como evento das 09:00. A fonte exata seria `publication_events`, que ainda não tem
 * rota de leitura (não-objetivo declarado na mudança OpenSpec).
 */
export function atividadeRecente(
  items: FeedItem[],
  notificacoes: NotificacaoResumida[],
  agora: Date,
): EntradaDeAtividade[] {
  const limite = agora.getTime() - JANELA_ATIVIDADE_MS;
  const entradas: EntradaDeAtividade[] = [];

  for (const i of items) {
    if (!TERMINAIS.has(i.state)) continue;
    const quando = Date.parse(i.publishedAt ?? i.updatedAt);
    if (!Number.isFinite(quando) || quando < limite) continue;
    entradas.push({
      tipo: 'publication',
      chave: i.id,
      groupId: i.groupId,
      state: i.state,
      canal: i.channel.name,
      provider: i.channel.provider,
      texto: i.text,
      em: quando,
    });
  }

  for (const n of notificacoes) {
    const quando = Date.parse(n.createdAt);
    if (!Number.isFinite(quando) || quando < limite) continue;
    entradas.push({ tipo: 'notification', chave: n.id, title: n.title, link: n.link, em: quando });
  }

  return entradas.sort((a, b) => b.em - a.em).slice(0, MAX_ATIVIDADE);
}

/** as próximas publicações, já cortadas no tamanho que a home mostra */
export const proximasPublicacoes = (items: FeedItem[]): FeedItem[] =>
  items
    .filter((i) => i.state === 'SCHEDULED' && i.publishAt !== null)
    .sort((a, b) => (a.publishAt ?? '').localeCompare(b.publishAt ?? ''))
    .slice(0, MAX_PROXIMAS);

// --- próxima ação contextual --------------------------------------------------

export interface EstadoDaHome {
  firstRun: InsightsSummary['firstRun'];
  atencao: InsightsSummary['attention'];
  week: InsightsSummary['week'];
  proximas: FeedItem[];
  rascunhosServidor: FeedItem[];
  rascunhoLocal: RascunhoLocal | null;
  planoNoLimite: boolean;
  mostrarPlano?: boolean;
  atividade?: EntradaDeAtividade[];
  pipelineTemAlgo?: boolean;
  agora: Date;
}

export type TipoDeProximaAcao =
  | 'resumeLocalDraft'
  | 'orphanDraft'
  | 'scheduleSomething'
  | 'emptyDays'
  | 'planAtLimit';

export interface ProximaAcao {
  kind: TipoDeProximaAcao;
  href: string;
  /** dado extra para a mensagem (contagem, trecho do rascunho) */
  dados?: Record<string, string | number>;
}

const DIAS_PARA_CONSIDERAR_VAZIO = 3;

/**
 * Um único próximo passo — e só quando não há nada errado.
 *
 * A escada é fixa e testada, não uma heurística: mesma entrada, mesma saída. Duas guardas no topo
 * importam mais que a ordem em si. Se o bloco de atenção está na tela, este some — dois blocos
 * dizendo o que fazer competem entre si, e o urgente perde. Em primeiro uso também some, porque os
 * passos iniciais já *são* a próxima ação.
 *
 * Nenhuma condição aplicável devolve `null`: sugestão genérica para preencher espaço é o oposto do
 * que a spec desta tela pede.
 */
export function proximaAcao(e: EstadoDaHome): ProximaAcao | null {
  if (e.firstRun !== null) return null;
  if (linhasDeAtencao(e.atencao).length > 0) return null;

  if (e.rascunhoLocal) {
    return {
      kind: 'resumeLocalDraft',
      href: '/compor',
      dados: { texto: e.rascunhoLocal.texto.slice(0, 60) },
    };
  }

  const orfaos = rascunhosDoServidor(e.rascunhosServidor);
  if (orfaos.length > 0) {
    return { kind: 'orphanDraft', href: '/kanban', dados: { count: orfaos.length } };
  }

  const limite = e.agora.getTime() + DIAS_PARA_CONSIDERAR_VAZIO * 24 * 60 * 60 * 1000;
  const temAlgoLogo = e.proximas.some(
    (p) => p.publishAt !== null && Date.parse(p.publishAt) <= limite,
  );
  if (!temAlgoLogo) return { kind: 'scheduleSomething', href: '/compor' };

  const vazios = diasVazios(e.week.byDay);
  if (vazios >= DIAS_VAZIOS_PREOCUPANTES) {
    return { kind: 'emptyDays', href: '/calendario', dados: { count: vazios } };
  }

  if (e.planoNoLimite) return { kind: 'planAtLimit', href: '/planos' };

  return null;
}

// --- ordem dos blocos ---------------------------------------------------------

export type BlocoId =
  | 'firstRun'
  | 'attention'
  | 'nextAction'
  | 'upcoming'
  | 'pipeline'
  | 'drafts'
  | 'week'
  | 'activity'
  | 'usage';

export interface OrdemDosBlocos {
  principal: BlocoId[];
  lateral: BlocoId[];
  /** abaixo de 1024px vira uma coluna só, sem `order-*` espalhado pelo JSX */
  unica: BlocoId[];
}

export type EstadoDeFonte = 'pending' | 'error' | 'empty' | 'ready';

export interface EstadosDasFontesDaHome {
  upcoming: EstadoDeFonte;
  drafts: EstadoDeFonte;
  pipeline: EstadoDeFonte;
  activity: EstadoDeFonte;
}

/**
 * A ordem vira dado.
 *
 * Duas coisas ficam garantidas por construção em vez de por disciplina: bloco sem conteúdo não
 * entra na lista (e por isso não ocupa espaço nem vira cartão vazio), e o reordenamento no celular
 * não precisa de `order-*` espalhado — é outra lista.
 *
 * O plano sai do topo da lateral de propósito: é o bloco menos urgente da tela e ocupava a posição
 * mais nobre dela. Acionável primeiro, informativo depois, comercial por último.
 */
export function ordemDosBlocos(
  e: EstadoDaHome | null,
  fontes?: EstadosDasFontesDaHome,
): OrdemDosBlocos {
  if (e?.firstRun) {
    return { principal: ['firstRun'], lateral: [], unica: ['firstRun'] };
  }

  const temAtencao = e ? linhasDeAtencao(e.atencao).length > 0 : false;
  const temProximaAcao = e ? !temAtencao && proximaAcao(e) !== null : false;
  const fonteVisivel = (id: keyof EstadosDasFontesDaHome) =>
    fontes ? fontes[id] !== 'empty' : false;

  const principal: BlocoId[] = [];
  if (temAtencao) principal.push('attention');
  else if (temProximaAcao) principal.push('nextAction');
  // o TodayBlock renderiza FORA do sistema de ordem (largura cheia acima da grade) — não entra aqui
  if ((e && proximasPublicacoes(e.proximas).length > 0) || fonteVisivel('upcoming')) {
    principal.push('upcoming');
  }
  if (e?.pipelineTemAlgo || fonteVisivel('pipeline')) principal.push('pipeline');

  const lateral: BlocoId[] = [];
  if (
    (e && (rascunhosDoServidor(e.rascunhosServidor).length > 0 || e.rascunhoLocal)) ||
    fonteVisivel('drafts')
  ) {
    lateral.push('drafts');
  }
  if (e) lateral.push('week');
  if ((e?.atividade?.length ?? 0) > 0 || fonteVisivel('activity')) lateral.push('activity');
  if (e?.mostrarPlano) lateral.push('usage');

  return { principal, lateral, unica: [...principal, ...lateral] };
}
