import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { ChannelRepository, PublishingRepository } from '../ports/publishing';

/**
 * Resumo operacional da organização — o que a tela inicial precisa saber (SPEC home-operational-overview).
 *
 * Três regras que governam este arquivo:
 *
 * 1. **Contagem, não documento.** A tela abre a cada visita; percorrer o feed paginado para contar
 *    seria errado. Aqui são agregações, e o feed continua servindo listas.
 * 2. **Só o que a plataforma mede.** Nada aqui vem de desempenho ou alcance — `channel_metrics`
 *    está vazia porque ninguém escreve nela. Todo número sai do nosso próprio registro do que foi
 *    pedido e do que foi entregue, então todo número é verdadeiro hoje.
 * 3. **O dia é do usuário, não do servidor.** "Hoje" e "próximos 7 dias" são resolvidos no fuso
 *    declarado, por `Intl` — somar offset fixo erraria em toda troca de horário de verão, e a tela
 *    existe para dizer o que sai hoje.
 */

export interface AttentionCounts {
  /** publicações que falharam e ninguém tratou */
  failed: number;
  /** desfecho incerto — nunca retentado automaticamente, espera decisão humana */
  needsReview: number;
  /** rascunho aguardando aprovação de alguém */
  awaitingApproval: number;
  /** post que saiu em algumas redes e não em outras */
  partial: number;
}

export interface ChannelNeedingAction {
  channelId: string;
  provider: string;
  name: string | null;
  /** `REFRESH_REQUIRED`, `PENDING_ACCOUNT_SELECTION`, `DISABLED` */
  status: string;
}

export interface InsightsSummary {
  /** fuso em que as fronteiras de dia foram resolvidas — a resposta diz qual usou */
  timezone: string;
  attention: AttentionCounts & { channels: ChannelNeedingAction[]; total: number };
  today: { scheduled: number; published: number; failed: number };
  /** próximos 7 dias contando de hoje, índice 0 = hoje */
  week: { scheduled: number; byDay: number[] };
  /**
   * Organização que ainda não tem o que operar. `null` = tem. A tela troca os blocos
   * operacionais por próximos passos em vez de mostrar uma grade de zeros.
   */
  firstRun: 'no_channels' | 'no_posts' | null;
}

/**
 * Fuso default explícito — melhor um documentado que uma hora local ambígua.
 *
 * Nome próprio (e não `DEFAULT_TIMEZONE`) porque o barrel do core reexporta tudo: o
 * `ai_best_time` já exporta o seu, e dois defaults com o mesmo nome viram ambiguidade no
 * `export *`. Os dois valem o mesmo hoje e podem divergir sem se arrastarem.
 */
export const INSIGHTS_DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const validarTimezone = (tz: string): string => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    throw new DomainError(ErrorCodes.PostInvalidSettings, `fuso horário inválido: ${tz}`, {
      timezone: tz,
    });
  }
};

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const civilDateIn = (instant: Date | number, timeZone: string): CivilDate => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day') };
};

const compareCivilDate = (left: CivilDate, right: CivilDate): number =>
  left.year - right.year || left.month - right.month || left.day - right.day;

const addCivilDays = (date: CivilDate, days: number): CivilDate => {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
};

/**
 * Primeiro instante que pertence a uma data civil no fuso pedido.
 *
 * Não convertemos "00:00" subtraindo as horas mostradas no relógio: no dia em que o relógio
 * avança, 13:00 locais podem ter só 12 horas reais desde a meia-noite. Em vez disso, procuramos
 * monotonicamente a fronteira em que a data formatada por `Intl` passa a ser a data alvo. Isso
 * também cobre o dia de 25 horas quando o relógio volta.
 */
const startOfCivilDate = (target: CivilDate, timeZone: string): Date => {
  const approximate = Date.UTC(target.year, target.month - 1, target.day);
  let before = approximate - 48 * 3_600_000;
  let atOrAfter = approximate + 48 * 3_600_000;

  // Os extremos de ±48h cobrem todos os offsets IANA vigentes; os loops deixam a função correta
  // também para mudanças históricas de linha de data sem depender desse conhecimento.
  while (compareCivilDate(civilDateIn(before, timeZone), target) >= 0) {
    before -= 24 * 3_600_000;
  }
  while (compareCivilDate(civilDateIn(atOrAfter, timeZone), target) < 0) {
    atOrAfter += 24 * 3_600_000;
  }

  while (atOrAfter - before > 1) {
    const middle = before + Math.floor((atOrAfter - before) / 2);
    if (compareCivilDate(civilDateIn(middle, timeZone), target) >= 0) atOrAfter = middle;
    else before = middle;
  }

  const found = civilDateIn(atOrAfter, timeZone);
  if (compareCivilDate(found, target) !== 0) {
    throw new DomainError(
      ErrorCodes.PostInvalidSettings,
      `a data civil não existe no fuso ${timeZone}`,
      { timezone: timeZone, date: `${target.year}-${target.month}-${target.day}` },
    );
  }
  return new Date(atOrAfter);
};

/** Instante em que começa o dia civil do fuso pedido que contém `agora`. */
export function startOfDayIn(agora: Date, timeZone: string): Date {
  return startOfCivilDate(civilDateIn(agora, timeZone), timeZone);
}

export interface InsightsDeps {
  publishing: PublishingRepository;
  channels: ChannelRepository;
  now?: () => Date;
}

export const makeSummarizeInsights =
  (deps: InsightsDeps) =>
  async (
    actor: { orgId: string },
    input: { timezone?: string } = {},
  ): Promise<InsightsSummary> => {
    const timezone = validarTimezone(input.timezone ?? INSIGHTS_DEFAULT_TIMEZONE);
    const agora = deps.now?.() ?? new Date();
    const hoje = civilDateIn(agora, timezone);
    const inicioDeHoje = startOfCivilDate(hoje, timezone);
    const fimDeHoje = startOfCivilDate(addCivilDays(hoje, 1), timezone);
    // Sete DATAS civis a partir de hoje. Em transição de DST isto não equivale a 168 horas.
    const fimDaJanela = startOfCivilDate(addCivilDays(hoje, 7), timezone);

    const [resumo, canais] = await Promise.all([
      deps.publishing.summarize(actor.orgId, {
        dayStart: inicioDeHoje,
        dayEnd: fimDeHoje,
        weekEnd: fimDaJanela,
        timezone,
      }),
      deps.channels.list(actor.orgId),
    ]);

    const precisamDeAcao = canais
      .filter((c) => c.status !== 'ACTIVE')
      .map((c) => ({
        channelId: c.id,
        provider: c.provider,
        name: c.name,
        status: c.status,
      }));

    const total =
      resumo.failed +
      resumo.needsReview +
      resumo.awaitingApproval +
      resumo.partial +
      precisamDeAcao.length;

    return {
      timezone,
      attention: {
        failed: resumo.failed,
        needsReview: resumo.needsReview,
        awaitingApproval: resumo.awaitingApproval,
        partial: resumo.partial,
        channels: precisamDeAcao,
        total,
      },
      today: {
        scheduled: resumo.todayScheduled,
        published: resumo.todayPublished,
        failed: resumo.todayFailed,
      },
      week: {
        scheduled: resumo.weekByDay.reduce((s, n) => s + n, 0),
        byDay: resumo.weekByDay,
      },
      firstRun:
        canais.length === 0 ? 'no_channels' : resumo.everScheduled ? null : 'no_posts',
    };
  };
