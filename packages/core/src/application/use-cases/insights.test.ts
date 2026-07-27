import { describe, expect, it } from 'bun:test';
import { DomainError } from '../../domain/shared/result';
import type { ChannelRecord, PublishingSummaryCounts } from '../ports/publishing';
import { makeSummarizeInsights, startOfDayIn, type InsightsDeps } from './insights';

const ACTOR = { orgId: 'org-1' };

const ZERO: PublishingSummaryCounts = {
  failed: 0,
  needsReview: 0,
  awaitingApproval: 0,
  partial: 0,
  todayScheduled: 0,
  todayPublished: 0,
  todayFailed: 0,
  weekByDay: [0, 0, 0, 0, 0, 0, 0],
  everScheduled: false,
};

const canal = (over: Partial<ChannelRecord> = {}): ChannelRecord =>
  ({
    id: 'ch-1',
    orgId: 'org-1',
    provider: 'mastodon',
    externalId: 'x',
    name: 'Conta',
    username: null,
    avatarUrl: null,
    status: 'ACTIVE',
    scopes: [],
    settings: null,
    tokenEnc: new Uint8Array(),
    refreshTokenEnc: null,
    tokenKeyVersion: 1,
    tokenExpiresAt: null,
    ...over,
  }) as ChannelRecord;

function harness(
  over: {
    resumo?: Partial<PublishingSummaryCounts>;
    canais?: ChannelRecord[];
    now?: () => Date;
  } = {},
) {
  const pedidos: Array<{ orgId: string; window: unknown }> = [];
  const deps: InsightsDeps = {
    publishing: {
      async summarize(orgId: string, window: unknown) {
        pedidos.push({ orgId, window });
        return { ...ZERO, ...over.resumo };
      },
    } as unknown as InsightsDeps['publishing'],
    channels: {
      async list() {
        return over.canais ?? [canal()];
      },
    } as unknown as InsightsDeps['channels'],
    ...(over.now ? { now: over.now } : {}),
  };
  return { deps, pedidos };
}

describe('fuso: o dia é do usuário, não do servidor', () => {
  it('fuso inválido é recusado ANTES de qualquer consulta', async () => {
    const { deps, pedidos } = harness();
    const erro = (await makeSummarizeInsights(deps)(ACTOR, {
      timezone: 'Marte/Olympus',
    }).catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('post.invalid_settings');
    expect(pedidos).toHaveLength(0);
  });

  it('sem fuso declarado, a resposta DIZ qual usou', async () => {
    const { deps } = harness();
    const r = await makeSummarizeInsights(deps)(ACTOR);
    expect(r.timezone).toBe('America/Sao_Paulo');
  });

  /**
   * O corte de "hoje" muda de resultado conforme o fuso, e é isso que a tela mostra. Às 02:00 UTC
   * de 27/07, em São Paulo (UTC-3) ainda é dia 26 — a meia-noite local é 03:00 UTC do dia 26.
   */
  it('a meia-noite local sai no fuso pedido, não no do servidor', () => {
    const agora = new Date('2026-07-27T02:00:00.000Z');

    const sp = startOfDayIn(agora, 'America/Sao_Paulo');
    expect(sp.toISOString()).toBe('2026-07-26T03:00:00.000Z');

    const utc = startOfDayIn(agora, 'UTC');
    expect(utc.toISOString()).toBe('2026-07-27T00:00:00.000Z');

    const toquio = startOfDayIn(agora, 'Asia/Tokyo');
    expect(toquio.toISOString()).toBe('2026-07-26T15:00:00.000Z');
  });

  it('a janela pedida ao repositório explicita hoje, amanhã e 7 dias civis', async () => {
    const { deps, pedidos } = harness({ now: () => new Date('2026-07-27T18:00:00.000Z') });
    await makeSummarizeInsights(deps)(ACTOR, { timezone: 'America/Sao_Paulo' });

    const w = pedidos[0]!.window as {
      dayStart: Date;
      dayEnd: Date;
      weekEnd: Date;
      timezone: string;
    };
    expect(w.dayStart.toISOString()).toBe('2026-07-27T03:00:00.000Z');
    expect(w.dayEnd.toISOString()).toBe('2026-07-28T03:00:00.000Z');
    expect(w.weekEnd.getTime() - w.dayStart.getTime()).toBe(7 * 86_400_000);
    expect(w.timezone).toBe('America/Sao_Paulo');
  });

  it('início do dia da virada de verão não subtrai a hora que ainda não existia', () => {
    const inicio = startOfDayIn(new Date('2026-03-29T12:00:00.000Z'), 'Europe/Lisbon');
    expect(inicio.toISOString()).toBe('2026-03-29T00:00:00.000Z');
  });

  it('virada para o verão: hoje tem 23h e os 7 dias civis têm 167h', async () => {
    const { deps, pedidos } = harness({ now: () => new Date('2026-03-29T12:00:00.000Z') });
    await makeSummarizeInsights(deps)(ACTOR, { timezone: 'Europe/Lisbon' });

    const w = pedidos[0]!.window as { dayStart: Date; dayEnd: Date; weekEnd: Date };
    expect(w.dayStart.toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(w.dayEnd.toISOString()).toBe('2026-03-29T23:00:00.000Z');
    expect(w.dayEnd.getTime() - w.dayStart.getTime()).toBe(23 * 3_600_000);
    expect(w.weekEnd.getTime() - w.dayStart.getTime()).toBe(167 * 3_600_000);
  });

  it('volta ao inverno: hoje tem 25h e os 7 dias civis têm 169h', async () => {
    const { deps, pedidos } = harness({ now: () => new Date('2026-10-25T12:00:00.000Z') });
    await makeSummarizeInsights(deps)(ACTOR, { timezone: 'Europe/Lisbon' });

    const w = pedidos[0]!.window as { dayStart: Date; dayEnd: Date; weekEnd: Date };
    expect(w.dayStart.toISOString()).toBe('2026-10-24T23:00:00.000Z');
    expect(w.dayEnd.toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(w.dayEnd.getTime() - w.dayStart.getTime()).toBe(25 * 3_600_000);
    expect(w.weekEnd.getTime() - w.dayStart.getTime()).toBe(169 * 3_600_000);
  });
});

describe('bloco de atenção', () => {
  it('nada errado = total zero (a tela some com o bloco)', async () => {
    const { deps } = harness();
    const r = await makeSummarizeInsights(deps)(ACTOR);
    expect(r.attention.total).toBe(0);
    expect(r.attention.channels).toEqual([]);
  });

  it('soma as quatro condições de publicação e os canais que pedem ação', async () => {
    const { deps } = harness({
      resumo: { failed: 2, needsReview: 1, awaitingApproval: 3, partial: 1, everScheduled: true },
      canais: [
        canal({ id: 'ch-1', status: 'ACTIVE' }),
        canal({ id: 'ch-2', status: 'REFRESH_REQUIRED', name: 'Insta da loja' }),
        canal({ id: 'ch-3', status: 'PENDING_ACCOUNT_SELECTION' }),
      ],
    });

    const r = await makeSummarizeInsights(deps)(ACTOR);
    expect(r.attention.total).toBe(2 + 1 + 3 + 1 + 2);
    expect(r.attention.channels).toEqual([
      { channelId: 'ch-2', provider: 'mastodon', name: 'Insta da loja', status: 'REFRESH_REQUIRED' },
      { channelId: 'ch-3', provider: 'mastodon', name: 'Conta', status: 'PENDING_ACCOUNT_SELECTION' },
    ]);
  });

  it('canal ATIVO nunca entra na lista de ação', async () => {
    const { deps } = harness({ canais: [canal({ status: 'ACTIVE' })] });
    const r = await makeSummarizeInsights(deps)(ACTOR);
    expect(r.attention.channels).toHaveLength(0);
  });
});

describe('primeiro uso: próximos passos em vez de grade de zeros', () => {
  it('sem canal, o passo é conectar', async () => {
    const { deps } = harness({ canais: [] });
    expect((await makeSummarizeInsights(deps)(ACTOR)).firstRun).toBe('no_channels');
  });

  it('com canal e sem nunca ter agendado, o passo é compor', async () => {
    const { deps } = harness({ canais: [canal()], resumo: { everScheduled: false } });
    expect((await makeSummarizeInsights(deps)(ACTOR)).firstRun).toBe('no_posts');
  });

  it('já operando, não há primeiro passo', async () => {
    const { deps } = harness({ canais: [canal()], resumo: { everScheduled: true } });
    expect((await makeSummarizeInsights(deps)(ACTOR)).firstRun).toBeNull();
  });
});

describe('semana', () => {
  it('o total é a soma dos dias, e os dias vazios continuam visíveis como zero', async () => {
    const { deps } = harness({
      resumo: { weekByDay: [2, 0, 3, 0, 1, 0, 0], everScheduled: true },
    });
    const r = await makeSummarizeInsights(deps)(ACTOR);
    expect(r.week.scheduled).toBe(6);
    expect(r.week.byDay).toHaveLength(7);
    expect(r.week.byDay[1]).toBe(0);
  });
});

describe('o payload não carrega conteúdo', () => {
  it('nada de texto de publicação nem credencial no resumo', async () => {
    const { deps } = harness({
      canais: [canal({ status: 'REFRESH_REQUIRED', tokenEnc: new TextEncoder().encode('segredo') })],
      resumo: { everScheduled: true },
    });
    const serializado = JSON.stringify(await makeSummarizeInsights(deps)(ACTOR));

    expect(serializado).not.toContain('segredo');
    expect(serializado).not.toContain('tokenEnc');
    expect(serializado).not.toContain('content');
  });
});
