import { describe, expect, test } from 'bun:test';
import { PLANS } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { SubscriptionRecord } from '../ports/billing';
import type { PlanUsageReader } from '../ports/plan-policy';
import { makeSaasPlanPolicy, makeSelfHostedPlanPolicy } from './plan-policy';

interface Counts {
  channels?: number;
  posts?: number;
  webhooks?: number;
  apiKeys?: number;
}

const usage = (over: Counts = {}): PlanUsageReader => {
  const n = { channels: 0, posts: 0, webhooks: 0, apiKeys: 0, ...over };
  return {
    countChannels: async () => n.channels,
    countPostsSince: async () => n.posts,
    countWebhooks: async () => n.webhooks,
    countApiKeys: async () => n.apiKeys,
  };
};

const subscription = (over: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  id: 'sub-row',
  orgId: 'org-1',
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  tier: 'PRO',
  period: 'MONTHLY',
  status: 'ACTIVE',
  currentPeriodEnd: null,
  cancelAt: null,
  identifier: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const subs = (record: SubscriptionRecord | null) =>
  ({
    findByOrg: async () => record,
    findByCustomerId: async () => record,
    upsertByOrg: async () => record!,
    deleteByCustomerId: async () => {},
  }) as const;

describe('PlanPolicy self-hosted (Community)', () => {
  test('libera tudo e reporta enforced=false', async () => {
    const policy = makeSelfHostedPlanPolicy({ usage: usage({ channels: 99 }) });
    expect(await policy.check('org-1', { kind: 'channel', provider: 'x' })).toEqual({ allowed: true });
    expect(await policy.check('org-1', { kind: 'feature', feature: 'workspaces' })).toEqual({
      allowed: true,
    });
    const snap = await policy.snapshot('org-1');
    expect(snap.enforced).toBe(false);
    expect(snap.tier).toBe('PREMIUM');
    expect(snap.usage.channels).toBe(99); // uso real continua sendo reportado
  });
});

describe('PlanPolicy gerenciado — plano Grátis', () => {
  const free = (over = {}) => makeSaasPlanPolicy({ subscriptions: subs(null), usage: usage(over) });

  test('conecta até 3 canais e barra o 4º', async () => {
    expect(await free({ channels: 2 }).check('org-1', { kind: 'channel' })).toEqual({
      allowed: true,
    });
    const denied = await free({ channels: 3 }).check('org-1', { kind: 'channel' });
    expect(denied).toMatchObject({
      allowed: false,
      code: 'plan.channel_limit',
      requiredTier: 'PRO',
    });
  });

  test('X é barrado ANTES do teto de canais (mensagem certa)', async () => {
    const denied = await free({ channels: 0 }).check('org-1', { kind: 'channel', provider: 'x' });
    expect(denied).toMatchObject({
      allowed: false,
      code: 'plan.feature_locked',
      requiredTier: 'PRO',
      detail: { feature: 'x_network' },
    });
  });

  test('15 posts/mês: o 16º é negado', async () => {
    expect(await free({ posts: 14 }).check('org-1', { kind: 'post' })).toEqual({ allowed: true });
    expect(await free({ posts: 15 }).check('org-1', { kind: 'post' })).toMatchObject({
      allowed: false,
      code: 'plan.posts_limit',
    });
  });

  test('API keys, webhooks e link de aprovação exigem Pro', async () => {
    for (const gate of [
      { kind: 'apiKey' } as const,
      { kind: 'webhook' } as const,
      { kind: 'feature', feature: 'approval_link' } as const,
    ]) {
      expect(await free().check('org-1', gate)).toMatchObject({
        allowed: false,
        code: 'plan.feature_locked',
        requiredTier: 'PRO',
      });
    }
  });

  test('assert lança DomainError com o requiredTier no detail', async () => {
    const policy = free({ posts: 15 });
    await expect(policy.assert('org-1', { kind: 'post' })).rejects.toThrow(DomainError);
    const err = await policy
      .assert('org-1', { kind: 'post' })
      .then(() => null)
      .catch((e: DomainError) => e);
    expect(err?.detail).toMatchObject({ requiredTier: 'PRO', limit: 15, used: 15 });
  });
});

describe('PlanPolicy gerenciado — assinaturas pagas', () => {
  test('Pro libera X, posts ilimitados e API, mas não workspaces (Premium)', async () => {
    const pro = makeSaasPlanPolicy({
      subscriptions: subs(subscription({ tier: 'PRO' })),
      usage: usage({ channels: 50, posts: 9999 }),
    });
    expect(await pro.check('org-1', { kind: 'channel', provider: 'x' })).toEqual({ allowed: true });
    expect(await pro.check('org-1', { kind: 'post' })).toEqual({ allowed: true });
    expect(await pro.check('org-1', { kind: 'apiKey' })).toEqual({ allowed: true });
    expect(await pro.check('org-1', { kind: 'feature', feature: 'workspaces' })).toMatchObject({
      allowed: false,
      requiredTier: 'PREMIUM',
    });
  });

  test('Premium libera a IA operacional inteira', async () => {
    const premium = makeSaasPlanPolicy({
      subscriptions: subs(subscription({ tier: 'PREMIUM' })),
      usage: usage(),
    });
    for (const feature of PLANS.PREMIUM.features) {
      expect(await premium.check('org-1', { kind: 'feature', feature })).toEqual({ allowed: true });
    }
  });

  test('pagamento em atraso mantém o plano (dunning); cancelada volta ao Grátis', async () => {
    const pastDue = makeSaasPlanPolicy({
      subscriptions: subs(subscription({ status: 'PAST_DUE' })),
      usage: usage(),
    });
    expect(await pastDue.check('org-1', { kind: 'apiKey' })).toEqual({ allowed: true });

    const canceled = makeSaasPlanPolicy({
      subscriptions: subs(subscription({ status: 'CANCELED' })),
      usage: usage({ channels: 3 }),
    });
    expect((await canceled.snapshot('org-1')).tier).toBe('FREE');
    expect(await canceled.check('org-1', { kind: 'channel' })).toMatchObject({
      allowed: false,
      code: 'plan.channel_limit',
    });
  });

  test('snapshot reporta limites, features e uso do plano efetivo', async () => {
    const policy = makeSaasPlanPolicy({
      subscriptions: subs(subscription({ tier: 'PRO', period: 'YEARLY' })),
      usage: usage({ channels: 4, posts: 120 }),
    });
    const snap = await policy.snapshot('org-1');
    expect(snap).toMatchObject({
      tier: 'PRO',
      period: 'YEARLY',
      status: 'ACTIVE',
      enforced: true,
      limits: PLANS.PRO.limits,
    });
    expect(snap.usage).toEqual({ channels: 4, postsThisMonth: 120, webhooks: 0, apiKeys: 0 });
  });
});
