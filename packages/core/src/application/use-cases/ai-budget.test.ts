import { describe, expect, it } from 'bun:test';
import type { AiCreditsRepository } from '../ports/ai-credits';
import type { PlanPolicy, PlanSnapshot } from '../ports/plan-policy';
import { DomainError } from '../../domain/shared/result';
import { creditPeriod, makeBudgetGuard, withBudget } from './ai-budget';

/** repositório em memória com a MESMA aritmética condicional do SQL (a corrida real é o teste de integração) */
function fakeCredits() {
  const buckets = new Map<string, { granted: number; used: number; reserved: number }>();
  const grants = new Map<string, { orgId: string; credits: number; state: string }>();
  let seq = 0;

  const bucketOf = (orgId: string, granted: number) => {
    const atual = buckets.get(orgId);
    if (!atual) {
      const novo = { granted, used: 0, reserved: 0 };
      buckets.set(orgId, novo);
      return novo;
    }
    atual.granted = Math.max(atual.granted, granted);
    return atual;
  };

  const repo: AiCreditsRepository = {
    async reserve({ orgId, operation, credits, granted }) {
      const b = bucketOf(orgId, granted);
      if (b.granted - b.used - b.reserved < credits) return null;
      b.reserved += credits;
      const grantId = `g${++seq}`;
      grants.set(grantId, { orgId, credits, state: 'RESERVED' });
      void operation;
      return { grantId };
    },
    async commit(grantId, actual) {
      const g = grants.get(grantId);
      if (!g || g.state !== 'RESERVED') return;
      g.state = 'COMMITTED';
      const b = buckets.get(g.orgId)!;
      b.used += actual.credits;
      b.reserved -= g.credits;
    },
    async release(grantId) {
      const g = grants.get(grantId);
      if (!g || g.state !== 'RESERVED') return;
      g.state = 'RELEASED';
      buckets.get(g.orgId)!.reserved -= g.credits;
    },
    async balance({ orgId, granted, periodEnd }) {
      const b = bucketOf(orgId, granted);
      return { ...b, periodEnd };
    },
  };
  return Object.assign(repo, { buckets, grants });
}

const planPolicy = (over: Partial<PlanSnapshot> = {}): PlanPolicy => ({
  async snapshot() {
    return {
      tier: 'PRO',
      status: 'ACTIVE',
      period: 'MONTHLY',
      currentPeriodEnd: null,
      cancelAt: null,
      limits: { channels: -1, postsPerMonth: -1, webhooks: -1, apiKeys: -1, aiCredits: 3 },
      features: ['ai_caption'],
      usage: { channels: 0, postsThisMonth: 0, webhooks: 0, apiKeys: 0 },
      enforced: true,
      ...over,
    } as PlanSnapshot;
  },
  async check() {
    return { allowed: true };
  },
  async assert() {},
});

/** relógio fixo: sem ele, o teste de "quando renova" passaria em julho e quebraria em agosto */
const AGORA = new Date('2026-07-26T13:00:00Z');

const guardWith = (credits: AiCreditsRepository, plan = planPolicy()) =>
  makeBudgetGuard({ credits, plan, now: () => AGORA });

describe('BudgetGuard (DECISIONS v1 §8)', () => {
  it('a janela da franquia é o mês-calendário UTC', () => {
    const { periodStart, periodEnd } = creditPeriod(new Date('2026-07-26T13:00:00Z'));
    expect(periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(periodEnd.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('reserva dentro da franquia e confirma o consumo real com os tokens', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);

    const { grantId } = await guard.reserve('org', 'ai.caption', 1);
    await guard.commit(grantId, { credits: 1, usage: { inputTokens: 100, outputTokens: 20 } });

    expect(credits.buckets.get('org')).toMatchObject({ used: 1, reserved: 0 });
  });

  it('franquia esgotada recusa com ai.budget_exceeded e diz quando renova', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);
    for (let i = 0; i < 3; i++) await guard.reserve('org', 'ai.caption', 1);

    const erro = (await guard
      .reserve('org', 'ai.caption', 1)
      .catch((e: unknown) => e)) as DomainError;

    expect(erro).toBeInstanceOf(DomainError);
    expect(erro.code).toBe('ai.budget_exceeded');
    expect(erro.message).toContain('3 créditos');
    expect(erro.detail?.renewsAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('plano sem franquia nenhuma recusa apontando o upgrade, não o esgotamento', async () => {
    const credits = fakeCredits();
    const guard = guardWith(
      credits,
      planPolicy({
        tier: 'FREE',
        limits: { channels: 3, postsPerMonth: 15, webhooks: 0, apiKeys: 0, aiCredits: 0 },
      }),
    );

    const erro = (await guard.reserve('org', 'ai.caption', 1).catch((e: unknown) => e)) as DomainError;
    expect(erro.code).toBe('ai.budget_exceeded');
    expect(erro.message).toContain('Assine o Pro');
  });

  // Community: o mecanismo roda igual, os números é que não valem
  it('self-hosted nunca recusa, mas continua contabilizando o consumo', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits, planPolicy({ enforced: false }));

    for (let i = 0; i < 50; i++) {
      const { grantId } = await guard.reserve('org', 'ai.caption', 1);
      await guard.commit(grantId, { credits: 1 });
    }

    expect(credits.buckets.get('org')!.used).toBe(50);
    const saldo = await guard.balance('org');
    expect(saldo.enforced).toBe(false);
    // o teto interno gigantesco do self-hosted não vaza para a UI
    expect(saldo.granted).toBe(3);
  });

  it('o saldo desconta reservas em voo', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);
    await guard.reserve('org', 'ai.caption', 1);

    expect(await guard.balance('org')).toMatchObject({
      granted: 3,
      used: 0,
      reserved: 1,
      remaining: 2,
      enforced: true,
    });
  });

  it('remaining nunca fica negativo', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);
    credits.buckets.set('org', { granted: 3, used: 5, reserved: 0 });

    expect((await guard.balance('org')).remaining).toBe(0);
  });
});

describe('withBudget — o único caminho até o modelo', () => {
  it('sucesso confirma o consumo', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);

    const texto = await withBudget(guard, { orgId: 'org', operation: 'ai.caption', credits: 1 }, async () => ({
      result: 'legenda',
      usage: { inputTokens: 10, outputTokens: 5 },
    }));

    expect(texto).toBe('legenda');
    expect(credits.buckets.get('org')).toMatchObject({ used: 1, reserved: 0 });
  });

  // a decisão de design D8: erro NOSSO não cobra a organização
  it('falha do modelo devolve a franquia e propaga o erro original', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);

    const erro = (await withBudget(guard, { orgId: 'org', operation: 'ai.caption', credits: 1 }, async () => {
      throw new DomainError('ai.provider_failed', 'fora do ar');
    }).catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('ai.provider_failed');
    expect(credits.buckets.get('org')).toMatchObject({ used: 0, reserved: 0 });
  });

  it('resposta ilegível também devolve a franquia', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);

    await withBudget(guard, { orgId: 'org', operation: 'ai.draft', credits: 1 }, async () => {
      throw new DomainError('ai.invalid_response', 'estrutura inválida');
    }).catch(() => {});

    expect(await guard.balance('org')).toMatchObject({ used: 0, reserved: 0, remaining: 3 });
  });

  it('devolver a franquia nunca mascara o erro original, mesmo se o release falhar', async () => {
    const credits = fakeCredits();
    const guard = makeBudgetGuard({
      credits: { ...credits, release: async () => { throw new Error('banco fora'); } },
      plan: planPolicy(),
      now: () => AGORA,
    });

    const erro = (await withBudget(guard, { orgId: 'org', operation: 'ai.caption', credits: 1 }, async () => {
      throw new DomainError('ai.provider_failed', 'fora do ar');
    }).catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('ai.provider_failed');
  });

  it('a franquia é reservada ANTES do trabalho, não depois', async () => {
    const credits = fakeCredits();
    const guard = guardWith(credits);
    let reservadoDurante = -1;

    await withBudget(guard, { orgId: 'org', operation: 'ai.caption', credits: 1 }, async () => {
      reservadoDurante = credits.buckets.get('org')!.reserved;
      return { result: 'ok' };
    });

    expect(reservadoDurante).toBe(1);
  });
});
