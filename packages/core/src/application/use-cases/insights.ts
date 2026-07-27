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

/**
 * Instante em que começa o dia civil do fuso pedido que contém `agora`.
 *
 * Feito lendo as partes formatadas e remontando: é a única forma correta sem tabela de fusos
 * própria. Somar offset fixo erra em toda transição de horário de verão — e um erro de uma hora
 * aqui move um post do "hoje" para o "amanhã" na tela que a pessoa usa para conferir o dia.
 */
export function startOfDayIn(agora: Date, timeZone: string): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(agora);

  const get = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? '0');
  // quanto do dia local já passou; subtrair isso de `agora` dá a meia-noite local em UTC
  const decorridoMs =
    ((get('hour') % 24) * 3600 + get('minute') * 60 + get('second')) * 1000 +
    (agora.getTime() % 1000);
  return new Date(agora.getTime() - decorridoMs);
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
    const inicioDeHoje = startOfDayIn(agora, timezone);
    // 7 dias civis a partir de hoje; o repositório fatia por dia usando o mesmo fuso
    const fimDaJanela = new Date(inicioDeHoje.getTime() + 7 * 86_400_000);

    const [resumo, canais] = await Promise.all([
      deps.publishing.summarize(actor.orgId, {
        dayStart: inicioDeHoje,
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
