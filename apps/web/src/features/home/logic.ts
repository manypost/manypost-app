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
