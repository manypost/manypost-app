import { describe, expect, it } from 'bun:test';
import { DomainError } from '../../domain/shared/result';
import type { PlanPolicy } from '../ports/plan-policy';
import type { ChannelRecord } from '../ports/publishing';
import {
  DEFAULT_TIMEZONE,
  makeSuggestBestTimes,
  weekdayHourIn,
  type BestTimesDeps,
} from './ai-best-times';

const ACTOR = { orgId: 'org-1' };
const AGORA = new Date('2026-07-27T12:00:00Z');

const canal = (over: Partial<ChannelRecord> = {}) =>
  ({ id: 'ch-1', orgId: 'org-1', provider: 'linkedin', ...over }) as ChannelRecord;

function harness(over: { historico?: Date[]; canal?: ChannelRecord; plan?: PlanPolicy } = {}) {
  const pedidos: { orgId: string; channelId: string }[] = [];
  const deps: BestTimesDeps = {
    publishing: {
      async listDeliveredTimes(orgId: string, channelId: string) {
        pedidos.push({ orgId, channelId });
        return over.historico ?? [];
      },
    } as unknown as BestTimesDeps['publishing'],
    channels: {
      async findMany(_orgId: string, ids: string[]) {
        return ids.includes('ch-1') ? [over.canal ?? canal()] : [];
      },
    } as unknown as BestTimesDeps['channels'],
    registry: { get: () => undefined, list: () => [] },
    plan:
      over.plan ??
      ({
        async assert() {},
        async check() {
          return { allowed: true };
        },
        async snapshot() {
          throw new Error('não usado');
        },
      } as unknown as PlanPolicy),
    now: () => AGORA,
  };
  return { deps, pedidos };
}

/** N publicações no mesmo dia da semana e hora, em São Paulo (UTC-3) */
const historicoEm = (n: number, isoUtc: string): Date[] =>
  Array.from({ length: n }, (_, i) => new Date(new Date(isoUtc).getTime() - i * 7 * 86_400_000));

describe('conversão de fuso (Intl, não offset fixo)', () => {
  it('converte para o fuso pedido', () => {
    // 2026-07-27T12:00Z = segunda 09:00 em São Paulo
    expect(weekdayHourIn(new Date('2026-07-27T12:00:00Z'), 'America/Sao_Paulo')).toEqual({
      weekday: 1,
      hour: 9,
    });
  });

  it('vira o dia quando o fuso empurra para trás', () => {
    // 2026-07-27T02:00Z = domingo 23:00 em São Paulo
    expect(weekdayHourIn(new Date('2026-07-27T02:00:00Z'), 'America/Sao_Paulo')).toEqual({
      weekday: 0,
      hour: 23,
    });
  });

  it('meia-noite é hora 0, não 24', () => {
    expect(weekdayHourIn(new Date('2026-07-27T03:00:00Z'), 'America/Sao_Paulo').hour).toBe(0);
  });

  it('respeita horário de verão do hemisfério norte (o mesmo instante muda de hora)', () => {
    const inverno = weekdayHourIn(new Date('2026-01-15T12:00:00Z'), 'Europe/Lisbon');
    const verao = weekdayHourIn(new Date('2026-07-15T12:00:00Z'), 'Europe/Lisbon');
    expect(verao.hour).toBe(inverno.hour + 1);
  });
});

describe('ai_best_time — sem histórico', () => {
  it('devolve a linha de base da rede, com confiança baixa e amostra zero', async () => {
    const { deps } = harness({ historico: [] });
    const r = await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' });

    expect(r.fromBaseline).toBe(true);
    expect(r.confidence).toBe('low');
    expect(r.sampleSize).toBe(0);
    expect(r.signal).toBe('network_baseline');
    expect(r.slots.length).toBeGreaterThan(0);
  });

  it('a linha de base é específica da rede', async () => {
    const doLinkedin = await makeSuggestBestTimes(harness({ canal: canal({ provider: 'linkedin' }) }).deps)(
      ACTOR,
      { channelId: 'ch-1', limit: 4 },
    );
    const doTwitch = await makeSuggestBestTimes(harness({ canal: canal({ provider: 'twitch' }) }).deps)(
      ACTOR,
      { channelId: 'ch-1', limit: 4 },
    );

    expect(doLinkedin.slots.map((s) => s.hour)).not.toEqual(doTwitch.slots.map((s) => s.hour));
    expect(doTwitch.slots.every((s) => s.hour >= 19)).toBe(true); // chat ao vivo é à noite
  });

  it('rede desconhecida cai num padrão em vez de devolver lista vazia', async () => {
    const { deps } = harness({ canal: canal({ provider: 'rede-que-nao-existe' }) });
    const r = await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' });
    expect(r.slots.length).toBeGreaterThan(0);
  });
});

describe('ai_best_time — com histórico próprio', () => {
  it('o horário mais frequente lidera e a confiança sobe', async () => {
    // 30 publicações sempre em segunda 09:00 (São Paulo)
    const { deps } = harness({ historico: historicoEm(30, '2026-07-27T12:00:00Z') });
    const r = await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' });

    expect(r.fromBaseline).toBe(false);
    expect(r.sampleSize).toBe(30);
    expect(r.signal).toBe('own_posting_history');
    expect(r.slots[0]).toMatchObject({ weekday: 1, hour: 9, score: 1 });
  });

  /**
   * O sinal disponível hoje é FREQUÊNCIA DE PUBLICAÇÃO, não desempenho: `channel_metrics` está
   * vazia. Uma amostra grande prova que a organização é consistente, não que aqueles horários
   * funcionaram. Enquanto for esse o sinal, a confiança não passa de média — e o `signal` deixa
   * a interface escrever a frase certa em vez de insinuar medição.
   */
  it('confiança não passa de média enquanto o sinal é só frequência de publicação', async () => {
    const { deps } = harness({ historico: historicoEm(300, '2026-07-27T12:00:00Z') });
    const r = await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' });

    expect(r.sampleSize).toBe(300);
    expect(r.signal).toBe('own_posting_history');
    expect(r.confidence).toBe('medium');
    expect(r.confidence).not.toBe('high');
  });

  it('pouca amostra fica em confiança baixa mesmo usando o histórico', async () => {
    const { deps } = harness({ historico: historicoEm(3, '2026-07-27T12:00:00Z') });
    const r = await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' });

    expect(r.confidence).toBe('low');
    expect(r.sampleSize).toBe(3);
  });

  it('amostra intermediária vira confiança média', async () => {
    const { deps } = harness({ historico: historicoEm(10, '2026-07-27T12:00:00Z') });
    expect((await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' })).confidence).toBe('medium');
  });

  it('completa com a linha de base sem deixá-la ultrapassar o observado', async () => {
    const { deps } = harness({ historico: historicoEm(30, '2026-07-27T12:00:00Z') });
    const r = await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1', limit: 5 });

    expect(r.slots).toHaveLength(5);
    expect(r.slots[0]!.score).toBe(1); // o observado
    expect(r.slots.slice(1).every((s) => s.score < 1)).toBe(true);
    // nenhum horário repetido entre observado e completado
    const chaves = r.slots.map((s) => `${s.weekday}:${s.hour}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('o mesmo histórico em fusos diferentes dá horas diferentes', async () => {
    const historico = historicoEm(30, '2026-07-27T12:00:00Z');
    const emSp = await makeSuggestBestTimes(harness({ historico }).deps)(ACTOR, {
      channelId: 'ch-1',
      timezone: 'America/Sao_Paulo',
    });
    const emLisboa = await makeSuggestBestTimes(harness({ historico }).deps)(ACTOR, {
      channelId: 'ch-1',
      timezone: 'Europe/Lisbon',
    });

    expect(emSp.slots[0]!.hour).toBe(9);
    expect(emLisboa.slots[0]!.hour).toBe(13);
  });
});

describe('ai_best_time — contrato', () => {
  it('sem fuso pedido, usa um default documentado (nunca hora local ambígua)', async () => {
    const { deps } = harness();
    expect((await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' })).timezone).toBe(
      DEFAULT_TIMEZONE,
    );
  });

  it('fuso inválido é recusado', async () => {
    const { deps } = harness();
    const erro = (await makeSuggestBestTimes(deps)(ACTOR, {
      channelId: 'ch-1',
      timezone: 'Marte/Olympus',
    }).catch((e: unknown) => e)) as DomainError;

    expect(erro).toBeInstanceOf(DomainError);
    expect(erro.code).toBe('post.invalid_settings');
  });

  it('canal de outra org é 404', async () => {
    const { deps } = harness();
    const erro = (await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'de-outra' }).catch(
      (e: unknown) => e,
    )) as DomainError;
    expect(erro.code).toBe('common.not_found');
  });

  it('só o histórico da própria org é consultado', async () => {
    const { deps, pedidos } = harness();
    await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' });
    expect(pedidos).toEqual([{ orgId: 'org-1', channelId: 'ch-1' }]);
  });

  it('exige a feature ai_best_time do plano', async () => {
    const { deps } = harness({
      plan: {
        async assert(_o: string, gate: { feature?: string }) {
          if (gate.feature === 'ai_best_time') throw new DomainError('plan.feature_locked', 'x');
        },
      } as unknown as PlanPolicy,
    });
    const erro = (await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1' }).catch(
      (e: unknown) => e,
    )) as DomainError;
    expect(erro.code).toBe('plan.feature_locked');
  });

  it('o limite de slots é respeitado e limitado', async () => {
    const { deps } = harness();
    expect((await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1', limit: 3 })).slots).toHaveLength(3);
    expect(
      (await makeSuggestBestTimes(deps)(ACTOR, { channelId: 'ch-1', limit: 999 })).slots.length,
    ).toBeLessThanOrEqual(21);
  });
});
