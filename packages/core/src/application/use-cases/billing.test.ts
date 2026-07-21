import { describe, expect, test } from 'bun:test';
import type { ChannelStatus } from '@manypost/contracts';
import type { BillingGateway, RemoteSubscription, SubscriptionRecord } from '../ports/billing';
import {
  makeApplyRemoteSubscription,
  makeCancelSubscription,
  makeRemoveSubscription,
  makeStartCheckout,
  type BillingDeps,
} from './billing';
import { makeSelfHostedPlanPolicy } from './plan-policy';

// ---------------------------------------------------------------- fakes

function fakeWorld(opts: { channels?: number; subscription?: SubscriptionRecord | null } = {}) {
  const channels = Array.from({ length: opts.channels ?? 0 }, (_, i) => ({
    id: `ch-${i + 1}`,
    orgId: 'org-1',
    provider: 'fake',
    externalId: `ext-${i}`,
    name: `canal ${i + 1}`,
    username: null,
    avatarUrl: null,
    status: 'ACTIVE' as ChannelStatus,
    scopes: [],
    settings: {},
    tokenEnc: new Uint8Array(),
    refreshTokenEnc: null,
    tokenKeyVersion: 1,
    tokenExpiresAt: null,
  }));

  let subscription = opts.subscription ?? null;
  const calls: Record<string, unknown[]> = { checkout: [], changePlan: [], toggleCancel: [] };

  const gateway: BillingGateway = {
    ensureCustomer: async () => 'cus_new',
    createCheckout: async (input) => {
      calls.checkout!.push(input);
      return { url: 'https://checkout.stripe.com/c/pay/abc' };
    },
    createPortal: async () => ({ url: 'https://billing.stripe.com/p/session/xyz' }),
    changePlan: async (input) => {
      calls.changePlan!.push(input);
      return { changed: true };
    },
    previewChange: async () => ({ amount: 1234 }),
    toggleCancel: async () => {
      calls.toggleCancel!.push(true);
      return { cancelAt: new Date('2026-08-21T00:00:00Z'), canceledImmediately: false };
    },
    listInvoices: async () => [],
    findRemoteSubscription: async () => null,
  };

  const deps: BillingDeps = {
    gateway,
    subscriptions: {
      findByOrg: async () => subscription,
      findByCustomerId: async () => subscription,
      upsertByOrg: async (d) => {
        subscription = {
          id: 'row-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...d,
        } as SubscriptionRecord;
        return subscription;
      },
      deleteByCustomerId: async () => {
        subscription = null;
      },
    },
    orgs: {
      createWithOwner: async () => ({ id: 'org-1', name: 'Marca', slug: 'marca' }),
      findMembership: async () => ({ role: 'OWNER' }),
      listForUser: async () => [],
      findById: async () => ({
        id: 'org-1',
        name: 'Marca',
        slug: 'marca',
        billingCustomerId: 'cus_1',
      }),
      findByBillingCustomerId: async (customerId) =>
        customerId === 'cus_1'
          ? { id: 'org-1', name: 'Marca', slug: 'marca', billingCustomerId: 'cus_1' }
          : null,
      setBillingCustomerId: async () => {},
    },
    users: {
      findByEmail: async () => null,
      findById: async () => ({
        id: 'u-1',
        email: 'dono@marca.com',
        passwordHash: null,
        name: 'Dono',
        avatarUrl: null,
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
      }),
      create: async () => {
        throw new Error('não usado');
      },
      updateAvatarIfEmpty: async () => {},
    },
    channels: {
      upsert: async () => channels[0]!,
      list: async () => channels,
      findMany: async () => [],
      updateTokens: async () => {},
      setStatus: async (id, status) => {
        const found = channels.find((c) => c.id === id);
        if (found) found.status = status;
      },
      softDelete: async () => true,
    },
    plan: makeSelfHostedPlanPolicy(),
    appUrl: 'https://app.manypost.com',
    trialDays: 0,
  };

  return { deps, channels, calls, current: () => subscription };
}

const remote = (over: Partial<RemoteSubscription> = {}): RemoteSubscription => ({
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  status: 'ACTIVE',
  tier: 'PRO',
  period: 'MONTHLY',
  currentPeriodEnd: new Date('2026-08-21T00:00:00Z'),
  cancelAt: null,
  identifier: 'chk123',
  ...over,
});

// ---------------------------------------------------------------- testes

describe('checkout', () => {
  test('sem assinatura → Stripe Checkout hospedado com URLs de volta do app', async () => {
    const w = fakeWorld();
    const out = await makeStartCheckout(w.deps)({
      orgId: 'org-1',
      userId: 'u-1',
      tier: 'PRO',
      period: 'YEARLY',
    });
    expect(out.url).toContain('checkout.stripe.com');
    expect(out.identifier).toBeTruthy();
    expect(w.calls.checkout![0]).toMatchObject({
      tier: 'PRO',
      period: 'YEARLY',
      trialDays: 0,
      successUrl: `https://app.manypost.com/planos?assinatura=${out.identifier}`,
      cancelUrl: 'https://app.manypost.com/planos?cancelado=1',
    });
  });

  test('já assinante → troca o item com proration, sem passar pelo checkout', async () => {
    const w = fakeWorld({
      subscription: {
        id: 'row-1',
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
      },
    });
    const out = await makeStartCheckout(w.deps)({
      orgId: 'org-1',
      userId: 'u-1',
      tier: 'PREMIUM',
      period: 'MONTHLY',
    });
    expect(out).toMatchObject({ changed: true });
    expect(w.calls.checkout).toHaveLength(0);
    expect(w.calls.changePlan![0]).toMatchObject({ tier: 'PREMIUM' });
  });

  test('FREE não é assinável (voltar ao Grátis = cancelar)', async () => {
    const w = fakeWorld();
    await expect(
      makeStartCheckout(w.deps)({
        orgId: 'org-1',
        userId: 'u-1',
        tier: 'FREE' as 'PRO',
        period: 'MONTHLY',
      }),
    ).rejects.toThrow(/cancele a assinatura/i);
  });
});

describe('webhook da Stripe', () => {
  test('assinatura criada espelha o plano na org e reativa canais desativados', async () => {
    const w = fakeWorld({ channels: 5 });
    await w.deps.channels.setStatus('ch-4', 'DISABLED');
    await w.deps.channels.setStatus('ch-5', 'DISABLED');

    expect(await makeApplyRemoteSubscription(w.deps)(remote())).toEqual({ ok: true });
    expect(w.current()).toMatchObject({ tier: 'PRO', status: 'ACTIVE', orgId: 'org-1' });
    expect(w.channels.every((c) => c.status === 'ACTIVE')).toBe(true); // Pro = canais ilimitados
  });

  test('customer de outra instalação é ignorado sem erro', async () => {
    const w = fakeWorld();
    expect(await makeApplyRemoteSubscription(w.deps)(remote({ customerId: 'cus_alheio' }))).toEqual({
      ok: false,
    });
    expect(w.current()).toBeNull();
  });

  test('assinatura removida → Grátis desativa os canais MAIS RECENTES acima de 3', async () => {
    const w = fakeWorld({ channels: 5 });
    await makeApplyRemoteSubscription(w.deps)(remote());

    expect(await makeRemoveSubscription(w.deps)('cus_1')).toEqual({ ok: true });
    expect(w.current()).toBeNull();
    expect(w.channels.map((c) => c.status)).toEqual([
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'DISABLED',
      'DISABLED',
    ]);
  });

  test('reentrega do MESMO evento é idempotente', async () => {
    const w = fakeWorld({ channels: 2 });
    await makeApplyRemoteSubscription(w.deps)(remote());
    const first = w.current();
    await makeApplyRemoteSubscription(w.deps)(remote());
    expect(w.current()).toMatchObject({ tier: first!.tier, subscriptionId: first!.subscriptionId });
  });
});

describe('cancelamento', () => {
  test('agenda o corte para o fim do período e guarda o cancelAt', async () => {
    const w = fakeWorld({ channels: 5 });
    await makeApplyRemoteSubscription(w.deps)(remote());

    const out = await makeCancelSubscription(w.deps)({ orgId: 'org-1', userId: 'u-1' });
    expect(out.canceledImmediately).toBe(false);
    expect(w.current()?.cancelAt).toEqual(new Date('2026-08-21T00:00:00Z'));
    // ainda pago até lá: nada de desativar canal agora
    expect(w.channels.every((c) => c.status === 'ACTIVE')).toBe(true);
  });

  test('sem assinatura → erro de domínio, não 500', async () => {
    const w = fakeWorld();
    await expect(
      makeCancelSubscription(w.deps)({ orgId: 'org-1', userId: 'u-1' }),
    ).rejects.toMatchObject({ code: 'billing.no_subscription' });
  });
});
