import {
  ErrorCodes,
  PLANS,
  PROVIDER_REQUIRED_FEATURE,
  UNLIMITED,
  isWithinLimit,
  minimumTierFor,
  planHasFeature,
  type PlanFeature,
  type PlanTier,
} from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { SubscriptionRecord, SubscriptionRepository } from '../ports/billing';
import type { WebhookRepository } from '../ports/events';
import type {
  PlanDecision,
  PlanGate,
  PlanPolicy,
  PlanSnapshot,
  PlanUsage,
  PlanUsageReader,
} from '../ports/plan-policy';
import type { ChannelRepository, PublishingRepository } from '../ports/publishing';
import type { ApiKeyRepository } from '../ports/repositories';

/** Rótulo humano de cada feature nas mensagens de bloqueio (pt-BR, tom da landing). */
const FEATURE_LABEL: Record<PlanFeature, string> = {
  x_network: 'publicar no X',
  approval_link: 'aprovação por link público',
  analytics: 'analytics de alcance e engajamento',
  public_api: 'API REST, servidor MCP e webhooks',
  ai_caption: 'IA que adapta o tom e o formato de cada rede',
  ai_best_time: 'IA que sugere o melhor horário por rede',
  priority_support: 'suporte prioritário',
  workspaces: 'workspaces, permissões e auditoria',
  ai_multichannel_draft: 'IA de rascunho multicanal',
  ai_calendar: 'IA que monta o calendário da semana',
  ai_inbox: 'IA que responde comentários e DMs',
  ai_triage: 'IA que classifica e direciona mensagens',
  ai_campaign_reports: 'IA que acompanha campanhas e gera relatórios',
  ai_engagement_alerts: 'IA que avisa quando um post perde engajamento',
};

const PLAN_LABEL: Record<PlanTier, string> = {
  FREE: 'Grátis',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

const denyFeature = (feature: PlanFeature): PlanDecision => {
  const requiredTier = minimumTierFor(feature);
  return {
    allowed: false,
    code: ErrorCodes.PlanFeatureLocked,
    message: `Seu plano não inclui ${FEATURE_LABEL[feature]}. Assine o ${PLAN_LABEL[requiredTier]} para liberar.`,
    requiredTier,
    detail: { feature, requiredTier },
  };
};

/**
 * Assinatura vale acesso enquanto a Stripe não desistir da cobrança: PAST_DUE mantém o
 * plano (dunning em curso — o cliente ainda está sendo cobrado). CANCELED/INCOMPLETE = Grátis.
 */
export const effectiveTier = (sub: SubscriptionRecord | null): PlanTier =>
  sub && (sub.status === 'ACTIVE' || sub.status === 'TRIALING' || sub.status === 'PAST_DUE')
    ? sub.tier
    : 'FREE';

/** Janela do limite mensal do Grátis: mês-calendário corrente (UTC). */
export const currentMonthStart = (now = new Date()): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

const readUsage = async (
  orgId: string,
  usage: PlanUsageReader | undefined,
): Promise<PlanUsage> =>
  usage
    ? {
        channels: await usage.countChannels(orgId),
        postsThisMonth: await usage.countPostsSince(orgId, currentMonthStart()),
        webhooks: await usage.countWebhooks(orgId),
        apiKeys: await usage.countApiKeys(orgId),
      }
    : { channels: 0, postsThisMonth: 0, webhooks: 0, apiKeys: 0 };

/** Contadores de uso sobre os repositórios que já existem (canal desativado não conta). */
export const makePlanUsageReader = (deps: {
  channels: ChannelRepository;
  publishing: PublishingRepository;
  webhooks: WebhookRepository;
  apiKeys: ApiKeyRepository;
}): PlanUsageReader => ({
  countChannels: async (orgId) =>
    (await deps.channels.list(orgId)).filter((c) => c.status !== 'DISABLED').length,
  countPostsSince: (orgId, since) => deps.publishing.countGroupsSince(orgId, since),
  countWebhooks: async (orgId) => (await deps.webhooks.list(orgId)).length,
  countApiKeys: async (orgId) => (await deps.apiKeys.list(orgId)).filter((k) => !k.revokedAt).length,
});

const withAssert = (policy: Omit<PlanPolicy, 'assert'>): PlanPolicy => ({
  ...policy,
  async assert(orgId, gate) {
    const decision = await policy.check(orgId, gate);
    if (!decision.allowed) {
      throw new DomainError(decision.code, decision.message, {
        requiredTier: decision.requiredTier,
        ...decision.detail,
      });
    }
  },
});

/**
 * Community / self-hosted: tudo liberado, nada cobrado (DECISIONS §15). O snapshot
 * reporta o teto máximo com `enforced: false` — a UI usa isso para sumir com o billing.
 */
export const makeSelfHostedPlanPolicy = (deps: { usage?: PlanUsageReader } = {}): PlanPolicy =>
  withAssert({
    async snapshot(orgId) {
      const plan = PLANS.PREMIUM;
      return {
        tier: 'PREMIUM',
        status: null,
        period: null,
        currentPeriodEnd: null,
        cancelAt: null,
        limits: plan.limits,
        features: [...plan.features],
        usage: await readUsage(orgId, deps.usage),
        enforced: false,
      } satisfies PlanSnapshot;
    },
    async check() {
      return { allowed: true };
    },
  });

/** Gerenciado (manypost Cloud): impõe o catálogo de PLANS contra a assinatura da org. */
export const makeSaasPlanPolicy = (deps: {
  subscriptions: SubscriptionRepository;
  usage: PlanUsageReader;
}): PlanPolicy =>
  withAssert({
    async snapshot(orgId) {
      const sub = await deps.subscriptions.findByOrg(orgId);
      const tier = effectiveTier(sub);
      const plan = PLANS[tier];
      return {
        tier,
        status: sub?.status ?? null,
        period: sub?.period ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        cancelAt: sub?.cancelAt ?? null,
        limits: plan.limits,
        features: [...plan.features],
        usage: await readUsage(orgId, deps.usage),
        enforced: true,
      } satisfies PlanSnapshot;
    },

    async check(orgId, gate: PlanGate): Promise<PlanDecision> {
      const tier = effectiveTier(await deps.subscriptions.findByOrg(orgId));
      const { limits } = PLANS[tier];

      switch (gate.kind) {
        case 'feature':
          return planHasFeature(tier, gate.feature) ? { allowed: true } : denyFeature(gate.feature);

        case 'channel': {
          // rede paga (X) antes do teto: a mensagem certa é "seu plano não inclui o X"
          const required = gate.provider ? PROVIDER_REQUIRED_FEATURE[gate.provider] : undefined;
          if (required && !planHasFeature(tier, required)) return denyFeature(required);

          const used = await deps.usage.countChannels(orgId);
          if (isWithinLimit(limits.channels, used)) return { allowed: true };
          return {
            allowed: false,
            code: ErrorCodes.PlanChannelLimit,
            message: `O plano ${PLAN_LABEL[tier]} conecta até ${limits.channels} redes por marca. Assine o Pro para conectar todas.`,
            requiredTier: 'PRO',
            detail: { limit: limits.channels, used },
          };
        }

        case 'post': {
          if (limits.postsPerMonth === UNLIMITED) return { allowed: true };
          const used = await deps.usage.countPostsSince(orgId, currentMonthStart());
          if (isWithinLimit(limits.postsPerMonth, used)) return { allowed: true };
          return {
            allowed: false,
            code: ErrorCodes.PlanPostsLimit,
            message: `Você usou os ${limits.postsPerMonth} posts do plano ${PLAN_LABEL[tier]} neste mês. Assine o Pro para publicar sem limite.`,
            requiredTier: 'PRO',
            detail: { limit: limits.postsPerMonth, used },
          };
        }

        case 'webhook': {
          // webhooks fazem parte da linha "API REST e servidor MCP" da landing
          if (limits.webhooks === 0) return denyFeature('public_api');
          const used = await deps.usage.countWebhooks(orgId);
          if (isWithinLimit(limits.webhooks, used)) return { allowed: true };
          return {
            allowed: false,
            code: ErrorCodes.PlanFeatureLocked,
            message: `O plano ${PLAN_LABEL[tier]} permite ${limits.webhooks} webhooks.`,
            requiredTier: 'PREMIUM',
            detail: { feature: 'public_api', limit: limits.webhooks, used },
          };
        }

        case 'apiKey': {
          if (limits.apiKeys === 0) return denyFeature('public_api');
          const used = await deps.usage.countApiKeys(orgId);
          if (isWithinLimit(limits.apiKeys, used)) return { allowed: true };
          return {
            allowed: false,
            code: ErrorCodes.PlanFeatureLocked,
            message: `O plano ${PLAN_LABEL[tier]} permite ${limits.apiKeys} chaves de API.`,
            requiredTier: 'PREMIUM',
            detail: { feature: 'public_api', limit: limits.apiKeys, used },
          };
        }
      }
    },
  });
