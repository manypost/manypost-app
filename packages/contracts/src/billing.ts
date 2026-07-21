/**
 * Catálogo de planos do manypost — FONTE ÚNICA de preços, limites e features.
 *
 * A verdade comercial é a página de preços oficial (landing, registrada em 2026-07-21):
 * cobrança **por marca gerenciada** (marca = organization), não por rede conectada.
 * Cada linha da landing vira uma `PlanFeature` aqui — quando uma feature nova nascer,
 * ela entra nesta lista ANTES de ir para a UI, senão sai de graça no Cloud.
 *
 * Duas camadas distintas (DECISIONS §15 / PLANS.md):
 *  - o CÓDIGO de tudo é AGPL-3.0 e roda liberado em self-hosted (`IS_SELF_HOSTED=true`);
 *  - este catálogo só é imposto no serviço gerenciado (`IS_SELF_HOSTED=false`), via PlanPolicy.
 *
 * Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts
 */

export const PlanTiers = ['FREE', 'PRO', 'PREMIUM'] as const;
export type PlanTier = (typeof PlanTiers)[number];

export const BillingPeriods = ['MONTHLY', 'YEARLY'] as const;
export type BillingPeriod = (typeof BillingPeriods)[number];

/** Espelho normalizado de `subscription.status` da Stripe. */
export const SubscriptionStatuses = [
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE',
] as const;
export type SubscriptionStatus = (typeof SubscriptionStatuses)[number];

/**
 * Capacidades destravadas por plano — cada chave é uma linha da página de preços.
 * Features ainda não implementadas ficam aqui de propósito: o gate nasce junto com a feature.
 */
export const PlanFeatures = [
  /** "todas as redes — inclusive X" (o Grátis não inclui X) */
  'x_network',
  /** "Aprovação por link público" */
  'approval_link',
  /** "Analytics de alcance, engajamento e crescimento" */
  'analytics',
  /** "API REST e servidor MCP" (inclui API keys e webhooks de saída) */
  'public_api',
  /** "IA: adapta o tom e o formato de cada rede" */
  'ai_caption',
  /** "IA: sugere o melhor horário por rede" */
  'ai_best_time',
  /** "Suporte prioritário" */
  'priority_support',
  /** "Workspaces, permissões e auditoria" */
  'workspaces',
  /** "IA: rascunho multicanal a partir de uma ideia" */
  'ai_multichannel_draft',
  /** "IA: monta e otimiza o calendário da semana" */
  'ai_calendar',
  /** "IA: responde comentários e DMs num lugar só" */
  'ai_inbox',
  /** "IA: classifica e direciona mensagens" */
  'ai_triage',
  /** "IA: acompanha campanhas e gera relatórios" */
  'ai_campaign_reports',
  /** "IA: avisa quando um post perde engajamento" */
  'ai_engagement_alerts',
] as const;
export type PlanFeature = (typeof PlanFeatures)[number];

/** Sentinela de "sem teto" em limites numéricos (posts ilimitados sob uso justo). */
export const UNLIMITED = -1;

export interface PlanLimits {
  /** canais conectados simultâneos (`UNLIMITED` = todas as redes) */
  channels: number;
  /** posts publicados por mês de assinatura (`UNLIMITED` = uso justo) */
  postsPerMonth: number;
  /** webhooks de saída ativos */
  webhooks: number;
  /** API keys ativas */
  apiKeys: number;
}

export interface PlanPrice {
  /**
   * `lookup_key` do Price na Stripe — chave estável e determinística: o backend resolve
   * o preço por ela (e cria se faltar), então nenhum `price_…` vive em variável de ambiente.
   */
  lookupKey: string;
  /** valor total do período, em centavos (BRL) */
  amount: number;
}

export interface PlanDefinition {
  tier: PlanTier;
  /** nome comercial exibido na UI e no Product da Stripe */
  name: string;
  limits: PlanLimits;
  features: readonly PlanFeature[];
  /** null no Grátis (sem checkout) */
  prices: Record<BillingPeriod, PlanPrice | null>;
}

export const BILLING_CURRENCY = 'brl';

const PRO_FEATURES = [
  'x_network',
  'approval_link',
  'analytics',
  'public_api',
  'ai_caption',
  'ai_best_time',
  'priority_support',
] as const satisfies readonly PlanFeature[];

export const PLANS: Record<PlanTier, PlanDefinition> = {
  /** "Para publicar em mais de uma rede sem pagar nada." R$ 0, para sempre. */
  FREE: {
    tier: 'FREE',
    name: 'manypost Grátis',
    limits: { channels: 3, postsPerMonth: 15, webhooks: 0, apiKeys: 0 },
    features: [],
    prices: { MONTHLY: null, YEARLY: null },
  },
  /** "Para quem publica todo dia e quer automatizar o fluxo." R$ 29,90/mês ou R$ 286,80/ano. */
  PRO: {
    tier: 'PRO',
    name: 'manypost Pro',
    limits: {
      channels: UNLIMITED,
      postsPerMonth: UNLIMITED,
      webhooks: UNLIMITED,
      apiKeys: UNLIMITED,
    },
    features: PRO_FEATURES,
    prices: {
      MONTHLY: { lookupKey: 'manypost_pro_monthly_brl', amount: 2990 },
      YEARLY: { lookupKey: 'manypost_pro_yearly_brl', amount: 28_680 },
    },
  },
  /** "Para quem opera várias marcas e responde em escala." R$ 66,90/mês ou R$ 634,80/ano. */
  PREMIUM: {
    tier: 'PREMIUM',
    name: 'manypost Premium',
    limits: {
      channels: UNLIMITED,
      postsPerMonth: UNLIMITED,
      webhooks: UNLIMITED,
      apiKeys: UNLIMITED,
    },
    features: [
      ...PRO_FEATURES,
      'workspaces',
      'ai_multichannel_draft',
      'ai_calendar',
      'ai_inbox',
      'ai_triage',
      'ai_campaign_reports',
      'ai_engagement_alerts',
    ],
    prices: {
      MONTHLY: { lookupKey: 'manypost_premium_monthly_brl', amount: 6690 },
      YEARLY: { lookupKey: 'manypost_premium_yearly_brl', amount: 63_480 },
    },
  },
};

/**
 * Redes que exigem feature de plano no gerenciado. Hoje só o X: o Grátis diz
 * "Não inclui X (Twitter)" e o Pro promete "todas as redes — inclusive X" (o custo do
 * app do X é absorvido pelo gerenciado — PLANS.md §4). Self-host segue BYO-key liberado.
 */
export const PROVIDER_REQUIRED_FEATURE: Record<string, PlanFeature> = { x: 'x_network' };

/** Ordem de poder dos planos (upgrade/downgrade e "plano mínimo" de uma feature). */
export const PLAN_RANK: Record<PlanTier, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

export const planHasFeature = (tier: PlanTier, feature: PlanFeature): boolean =>
  PLANS[tier].features.includes(feature);

/** Menor plano que inclui a feature — vira o CTA "faça upgrade para o {plano}". */
export const minimumTierFor = (feature: PlanFeature): PlanTier =>
  PlanTiers.find((tier) => planHasFeature(tier, feature)) ?? 'PREMIUM';

export const isWithinLimit = (limit: number, used: number): boolean =>
  limit === UNLIMITED || used < limit;

/** Preço mensal equivalente do plano anual (o "R$ 23,90/mês" da landing). */
export const monthlyEquivalent = (price: PlanPrice, period: BillingPeriod): number =>
  period === 'YEARLY' ? Math.round(price.amount / 12) : price.amount;
