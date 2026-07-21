import {
  ErrorCodes,
  PLANS,
  UNLIMITED,
  type BillingPeriod,
  type PlanTier,
} from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { AuditLogRepository } from '../ports/approvals';
import type {
  BillingGateway,
  RemoteSubscription,
  SubscriptionRecord,
  SubscriptionRepository,
} from '../ports/billing';
import type { PlanPolicy } from '../ports/plan-policy';
import type { ChannelRepository } from '../ports/publishing';
import type { OrganizationRepository, UserRepository } from '../ports/repositories';
import { randomToken } from '../tokens';
import { effectiveTier } from './plan-policy';

export interface BillingDeps {
  gateway: BillingGateway;
  subscriptions: SubscriptionRepository;
  orgs: OrganizationRepository;
  users: UserRepository;
  channels: ChannelRepository;
  plan: PlanPolicy;
  audit?: AuditLogRepository;
  /** URL base do app (PUBLIC_URL) para success/cancel/return do Stripe */
  appUrl: string;
  /** 0 = sem teste grátis (a landing já vende um plano Grátis para sempre) */
  trialDays: number;
}

type Deps = BillingDeps;

const billingUrl = (appUrl: string, suffix = '') => `${appUrl.replace(/\/$/, '')}/planos${suffix}`;

export const sanitizeSubscription = (s: SubscriptionRecord | null) =>
  s && {
    tier: s.tier,
    period: s.period,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd,
    cancelAt: s.cancelAt,
    identifier: s.identifier,
  };

/**
 * Customer da Stripe por marca (organization). Criado sob demanda no primeiro checkout e
 * guardado em `organizations.billing_customer_id`.
 * Derived from Postiz (AGPL-3.0): stripe.service.ts createOrGetCustomer
 */
async function ensureCustomer(deps: Deps, orgId: string, userId: string): Promise<string> {
  const org = await deps.orgs.findById(orgId);
  if (!org) throw new DomainError(ErrorCodes.NotFound, 'organização não encontrada');
  if (org.billingCustomerId) return org.billingCustomerId;

  const user = await deps.users.findById(userId);
  const customerId = await deps.gateway.ensureCustomer({
    orgId,
    orgName: org.name,
    email: user?.email ?? '',
    existingCustomerId: null,
  });
  await deps.orgs.setBillingCustomerId(orgId, customerId);
  return customerId;
}

/**
 * Aplica os limites do plano após uma mudança de assinatura: canais acima do teto são
 * DESATIVADOS (não desconectados — o token continua lá) e voltam sozinhos no upgrade.
 * Derived from Postiz (AGPL-3.0): subscription.service.ts modifySubscription → disableIntegrations
 */
async function applyTierLimits(
  deps: Pick<Deps, 'channels'>,
  orgId: string,
  tier: PlanTier,
): Promise<void> {
  const { channels: limit } = PLANS[tier].limits;
  const list = await deps.channels.list(orgId);

  if (limit === UNLIMITED) {
    // upgrade: devolve ao ar o que só estava desativado por limite de plano
    for (const c of list.filter((c) => c.status === 'DISABLED')) {
      await deps.channels.setStatus(c.id, 'ACTIVE');
    }
    return;
  }

  const usable = list.filter((c) => c.status !== 'DISABLED');
  const excess = usable.length - limit;
  if (excess <= 0) return;
  // os mais recentes saem primeiro (list vem ordenada por created_at)
  for (const c of usable.slice(-excess)) await deps.channels.setStatus(c.id, 'DISABLED');
}

/** Estado de cobrança da marca: plano efetivo, uso e assinatura. */
export const makeGetBilling = (deps: Pick<Deps, 'plan' | 'subscriptions'>) =>
  async (orgId: string) => ({
    plan: await deps.plan.snapshot(orgId),
    subscription: sanitizeSubscription(await deps.subscriptions.findByOrg(orgId)),
  });

/**
 * Assinar ou trocar de plano. Sem assinatura ativa → Stripe Checkout hospedado; com
 * assinatura → troca direta do item com proration (o cliente não passa pelo checkout de novo).
 * Derived from Postiz (AGPL-3.0): stripe.service.ts subscribe
 */
export const makeStartCheckout = (deps: Deps) =>
  async (input: {
    orgId: string;
    userId: string;
    tier: PlanTier;
    period: BillingPeriod;
  }): Promise<{ url?: string; portalUrl?: string; changed?: boolean; identifier: string }> => {
    if (input.tier === 'FREE') {
      throw new DomainError(
        ErrorCodes.PlanFeatureLocked,
        'Para voltar ao Grátis, cancele a assinatura atual.',
      );
    }
    const customerId = await ensureCustomer(deps, input.orgId, input.userId);
    const identifier = randomToken(8);
    const current = await deps.subscriptions.findByOrg(input.orgId);

    if (current?.subscriptionId && effectiveTier(current) !== 'FREE') {
      const out = await deps.gateway.changePlan({
        orgId: input.orgId,
        userId: input.userId,
        customerId,
        tier: input.tier,
        period: input.period,
        identifier,
        returnUrl: billingUrl(deps.appUrl),
      });
      await deps.audit?.append({
        orgId: input.orgId,
        actorType: 'USER',
        actorId: input.userId,
        action: 'billing.plan_changed',
        detail: { tier: input.tier, period: input.period },
      });
      return 'changed' in out ? { changed: true, identifier } : { portalUrl: out.portalUrl, identifier };
    }

    const { url } = await deps.gateway.createCheckout({
      orgId: input.orgId,
      userId: input.userId,
      customerId,
      tier: input.tier,
      period: input.period,
      identifier,
      successUrl: billingUrl(deps.appUrl, `?assinatura=${identifier}`),
      cancelUrl: billingUrl(deps.appUrl, '?cancelado=1'),
      trialDays: deps.trialDays,
    });
    await deps.audit?.append({
      orgId: input.orgId,
      actorType: 'USER',
      actorId: input.userId,
      action: 'billing.checkout_started',
      detail: { tier: input.tier, period: input.period },
    });
    return { url, identifier };
  };

/** Valor a pagar agora numa troca de plano (proration) — 0 quando não há assinatura. */
export const makePreviewPlanChange = (deps: Deps) =>
  async (input: { orgId: string; tier: PlanTier; period: BillingPeriod }) => {
    const org = await deps.orgs.findById(input.orgId);
    if (!org?.billingCustomerId) return { amount: 0 };
    return deps.gateway.previewChange({
      customerId: org.billingCustomerId,
      tier: input.tier,
      period: input.period,
    });
  };

/** Portal da Stripe (cartão, faturas, endereço fiscal). */
export const makeOpenBillingPortal = (deps: Deps) =>
  async (input: { orgId: string; userId: string }) => {
    const customerId = await ensureCustomer(deps, input.orgId, input.userId);
    return deps.gateway.createPortal({ customerId, returnUrl: billingUrl(deps.appUrl) });
  };

/**
 * Alterna o cancelamento: assinatura em dia cancela ao fim do período (o cliente usa o que
 * pagou); com pagamento em atraso, cancela na hora. Chamar de novo reativa.
 * Derived from Postiz (AGPL-3.0): stripe.service.ts setToCancel
 */
export const makeCancelSubscription = (deps: Deps) =>
  async (input: { orgId: string; userId: string; feedback?: string }) => {
    const org = await deps.orgs.findById(input.orgId);
    const current = await deps.subscriptions.findByOrg(input.orgId);
    if (!org?.billingCustomerId || !current) {
      throw new DomainError(ErrorCodes.BillingNoSubscription, 'nenhuma assinatura ativa');
    }

    const out = await deps.gateway.toggleCancel(org.billingCustomerId);
    if (out.canceledImmediately) {
      await deps.subscriptions.deleteByCustomerId(org.billingCustomerId);
      await applyTierLimits(deps, input.orgId, 'FREE');
    } else {
      await deps.subscriptions.upsertByOrg({
        orgId: input.orgId,
        customerId: current.customerId,
        subscriptionId: current.subscriptionId,
        tier: current.tier,
        period: current.period,
        status: current.status,
        currentPeriodEnd: current.currentPeriodEnd,
        cancelAt: out.cancelAt,
        identifier: current.identifier,
      });
    }

    await deps.audit?.append({
      orgId: input.orgId,
      actorType: 'USER',
      actorId: input.userId,
      action: out.cancelAt ? 'billing.cancel_scheduled' : 'billing.cancel_reverted',
      detail: {
        cancelAt: out.cancelAt?.toISOString() ?? null,
        ...(input.feedback ? { feedback: input.feedback } : {}),
      },
    });
    return out;
  };

export const makeListInvoices = (deps: Deps) =>
  async (orgId: string) => {
    const org = await deps.orgs.findById(orgId);
    if (!org?.billingCustomerId) return [];
    return deps.gateway.listInvoices(org.billingCustomerId);
  };

/**
 * Webhook da Stripe: espelha a assinatura na org dona do customer e reaplica os limites.
 * Idempotente de propósito — a Stripe reentrega eventos e a ordem não é garantida.
 * Derived from Postiz (AGPL-3.0): stripe.service.ts createSubscription/updateSubscription
 */
export const makeApplyRemoteSubscription = (
  deps: Pick<Deps, 'subscriptions' | 'orgs' | 'channels'>,
) =>
  async (remote: RemoteSubscription): Promise<{ ok: boolean }> => {
    const org = await deps.orgs.findByBillingCustomerId(remote.customerId);
    if (!org) return { ok: false }; // customer de outra instalação/ambiente — ignorar

    const saved = await deps.subscriptions.upsertByOrg({
      orgId: org.id,
      customerId: remote.customerId,
      subscriptionId: remote.subscriptionId,
      tier: remote.tier,
      period: remote.period,
      status: remote.status,
      currentPeriodEnd: remote.currentPeriodEnd,
      cancelAt: remote.cancelAt,
      identifier: remote.identifier,
    });
    await applyTierLimits(deps, org.id, effectiveTier(saved));
    return { ok: true };
  };

/** Assinatura encerrada na Stripe → org volta ao Grátis (com os limites do Grátis). */
export const makeRemoveSubscription = (
  deps: Pick<Deps, 'subscriptions' | 'orgs' | 'channels'>,
) =>
  async (customerId: string): Promise<{ ok: boolean }> => {
    const org = await deps.orgs.findByBillingCustomerId(customerId);
    if (!org) return { ok: false };
    await deps.subscriptions.deleteByCustomerId(customerId);
    await applyTierLimits(deps, org.id, 'FREE');
    return { ok: true };
  };

/**
 * Reconciliação sob demanda: lê a assinatura na Stripe e grava localmente. Serve para a
 * volta do checkout (o webhook pode não ter chegado ainda) e para conferir divergência.
 */
export const makeSyncSubscription = (deps: Deps) =>
  async (orgId: string): Promise<{ ok: boolean }> => {
    const org = await deps.orgs.findById(orgId);
    if (!org?.billingCustomerId) return { ok: false };
    const remote = await deps.gateway.findRemoteSubscription(org.billingCustomerId);
    if (!remote) {
      await deps.subscriptions.deleteByCustomerId(org.billingCustomerId);
      await applyTierLimits(deps, orgId, 'FREE');
      return { ok: true };
    }
    return makeApplyRemoteSubscription(deps)(remote);
  };
