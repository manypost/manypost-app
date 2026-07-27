import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { ChannelProviderRegistry } from '../ports/channel-provider-registry';
import type { PlanPolicy } from '../ports/plan-policy';
import type { ChannelRepository, PublishingRepository } from '../ports/publishing';

/**
 * `ai_best_time` — "IA: sugere o melhor horário por rede" (plano Pro).
 *
 * **Não usa modelo e não consome franquia** (SPEC_AI §3): é estatística sobre o histórico da
 * própria organização, misturada a uma linha de base por rede. Vender isso como "IA" é decisão
 * comercial registrada na SPEC; tecnicamente é heurística, e este arquivo não esconde isso.
 *
 * A honestidade fica na `confidence`: enquanto a organização tiver pouco histórico, o que sai é
 * a linha de base — e a resposta diz exatamente isso, com `sampleSize`. Quando a coleta de
 * métricas existir (hoje `channel_metrics` está vazia), ela entra como insumo melhor sem mudar
 * o contrato desta função.
 */

export interface TimeSlot {
  /** 0 = domingo … 6 = sábado, no fuso pedido */
  weekday: number;
  /** 0–23, no fuso pedido */
  hour: number;
  /** 0–1: quanto este horário se destaca dos demais */
  score: number;
}

export interface BestTimes {
  channelId: string;
  timezone: string;
  slots: TimeSlot[];
  confidence: 'low' | 'medium' | 'high';
  /** quantas publicações da própria org sustentam a resposta */
  sampleSize: number;
  /** true = veio só da linha de base da rede, sem histórico próprio */
  fromBaseline: boolean;
}

/** fuso default explícito — melhor um documentado que uma hora local ambígua */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/** janela de histórico considerada; mais que isso já não descreve o público de hoje */
const JANELA_DIAS = 180;
const MAX_AMOSTRAS = 500;

/** a partir daqui o histórico próprio manda mais que a linha de base */
const AMOSTRA_MEDIA = 8;
const AMOSTRA_ALTA = 25;

/**
 * Linha de base por rede: horários em que publicar costuma funcionar, em dia útil e fim de
 * semana. É ponto de partida declarado, não medição — por isso sozinha nunca passa de
 * `confidence: 'low'`.
 */
const BASELINE: Record<string, number[]> = {
  linkedin: [8, 9, 12, 17],
  x: [9, 12, 15, 18, 21],
  instagram: [11, 12, 18, 19, 20],
  'instagram-standalone': [11, 12, 18, 19, 20],
  facebook: [10, 13, 19, 20],
  threads: [9, 12, 18, 21],
  tiktok: [12, 18, 19, 21],
  youtube: [15, 17, 19, 20],
  mastodon: [9, 12, 17, 20],
  bluesky: [9, 12, 17, 20],
  telegram: [9, 12, 18, 21],
  discord: [15, 18, 20, 22],
  'discord-webhook': [15, 18, 20, 22],
  twitch: [19, 20, 21, 22],
  kick: [19, 20, 21, 22],
  devto: [8, 9, 13, 15],
};
const BASELINE_PADRAO = [9, 12, 18, 20];

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
 * Dia da semana e hora de um instante NO FUSO pedido. Feito com `Intl` de propósito: somar
 * offset fixo erraria em toda troca de horário de verão, e a resposta existe justamente para
 * ser colada no campo de agendamento.
 */
export function weekdayHourIn(date: Date, timeZone: string): { weekday: number; hour: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const dia = partes.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? '0');
  const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    weekday: Math.max(0, DIAS.indexOf(dia)),
    // 'numeric' com hour12:false devolve 24 para a meia-noite em alguns runtimes
    hour: hora % 24,
  };
}

const chave = (weekday: number, hour: number) => `${weekday}:${hour}`;

const confiancaDe = (amostras: number): BestTimes['confidence'] =>
  amostras >= AMOSTRA_ALTA ? 'high' : amostras >= AMOSTRA_MEDIA ? 'medium' : 'low';

/** dias úteis e fim de semana recebem a mesma lista de horas da linha de base */
function slotsDaBaseline(provider: string, quantidade: number): TimeSlot[] {
  const horas = BASELINE[provider] ?? BASELINE_PADRAO;
  const slots: TimeSlot[] = [];
  // dias úteis primeiro (é onde a maioria das marcas publica), depois sábado e domingo
  for (const weekday of [2, 4, 3, 1, 5, 6, 0]) {
    for (const hour of horas) {
      slots.push({ weekday, hour, score: 0.5 });
      if (slots.length === quantidade) return slots;
    }
  }
  return slots;
}

export interface BestTimesDeps {
  publishing: PublishingRepository;
  channels: ChannelRepository;
  registry: ChannelProviderRegistry;
  plan: PlanPolicy;
  now?: () => Date;
}

export const makeSuggestBestTimes =
  (deps: BestTimesDeps) =>
  async (
    actor: { orgId: string },
    input: { channelId: string; timezone?: string; limit?: number },
  ): Promise<BestTimes> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_best_time' });

    const timezone = validarTimezone(input.timezone ?? DEFAULT_TIMEZONE);
    const quantidade = Math.min(Math.max(input.limit ?? 5, 1), 21);

    const [canal] = await deps.channels.findMany(actor.orgId, [input.channelId]);
    if (!canal) throw new DomainError(ErrorCodes.NotFound, 'canal não encontrado');

    const agora = deps.now?.() ?? new Date();
    const desde = new Date(agora.getTime() - JANELA_DIAS * 86_400_000);
    const historico = await deps.publishing.listDeliveredTimes(
      actor.orgId,
      canal.id,
      desde,
      MAX_AMOSTRAS,
    );

    const base = {
      channelId: canal.id,
      timezone,
      sampleSize: historico.length,
      confidence: confiancaDe(historico.length),
    };

    // sem histórico nenhum, a resposta é a linha de base — e diz que é
    if (historico.length === 0) {
      return { ...base, slots: slotsDaBaseline(canal.provider, quantidade), fromBaseline: true };
    }

    const contagem = new Map<string, number>();
    for (const instante of historico) {
      const { weekday, hour } = weekdayHourIn(instante, timezone);
      contagem.set(chave(weekday, hour), (contagem.get(chave(weekday, hour)) ?? 0) + 1);
    }

    const maior = Math.max(...contagem.values());
    const observados: TimeSlot[] = [...contagem.entries()]
      .map(([k, n]) => {
        const [weekday, hour] = k.split(':').map(Number);
        return { weekday: weekday!, hour: hour!, score: n / maior };
      })
      .sort((a, b) => b.score - a.score || a.weekday - b.weekday || a.hour - b.hour);

    // com pouca amostra, completa com a linha de base em vez de fingir que 2 posts bastam
    const slots = [...observados];
    if (slots.length < quantidade) {
      const jaTem = new Set(slots.map((s) => chave(s.weekday, s.hour)));
      for (const s of slotsDaBaseline(canal.provider, quantidade * 3)) {
        if (jaTem.has(chave(s.weekday, s.hour))) continue;
        slots.push({ ...s, score: 0.25 }); // completa, mas nunca disputa com o observado
        if (slots.length === quantidade) break;
      }
    }

    return { ...base, slots: slots.slice(0, quantidade), fromBaseline: false };
  };
