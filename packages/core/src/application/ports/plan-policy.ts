import type {
  BillingPeriod,
  PlanFeature,
  PlanLimits,
  PlanTier,
  SubscriptionStatus,
} from '@manypost/contracts';

/**
 * PlanPolicy (SPEC_ARCHITECTURE §5): extension point do domínio consultado ao conectar
 * canal, agendar post, criar link de aprovação, emitir API key, criar webhook e usar IA.
 *
 * Duas implementações, escolhidas por variável de ambiente:
 *  - self-hosted (`IS_SELF_HOSTED=true`): responde `allowed` para tudo (Community);
 *  - gerenciado (`IS_SELF_HOSTED=false` + Stripe configurada): impõe o catálogo de PLANS.
 *
 * Derived from Postiz (AGPL-3.0): apps/backend/src/services/auth/permissions/permissions.service.ts
 * (lá o gate equivalente é a ausência de `STRIPE_PUBLISHABLE_KEY`).
 */

export interface PlanUsage {
  channels: number;
  postsThisMonth: number;
  webhooks: number;
  apiKeys: number;
}

export interface PlanSnapshot {
  tier: PlanTier;
  /** null enquanto a org nunca assinou (Grátis) */
  status: SubscriptionStatus | null;
  period: BillingPeriod | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  limits: PlanLimits;
  features: PlanFeature[];
  usage: PlanUsage;
  /** false = self-hosted: nada é cobrado nem bloqueado (a UI some com o billing) */
  enforced: boolean;
}

/** O que está sendo pedido. `provider` é o id do canal (ex.: 'x') no gate de canal. */
export type PlanGate =
  | { kind: 'feature'; feature: PlanFeature }
  | { kind: 'channel'; provider?: string }
  | { kind: 'post' }
  | { kind: 'webhook' }
  | { kind: 'apiKey'; scopes?: readonly string[] };

export type PlanDecision =
  | { allowed: true }
  | {
      allowed: false;
      /** code estável do contrato (ErrorCodes.Plan*) */
      code: string;
      message: string;
      /** plano mínimo que libera — vira o CTA de upgrade na UI */
      requiredTier: PlanTier;
      detail?: Record<string, unknown>;
    };

export interface PlanPolicy {
  snapshot(orgId: string): Promise<PlanSnapshot>;
  check(orgId: string, gate: PlanGate): Promise<PlanDecision>;
  /** lança DomainError quando negado (uso direto nos use-cases) */
  assert(orgId: string, gate: PlanGate): Promise<void>;
}

/** Contadores de uso da org — implementados sobre os repositórios existentes. */
export interface PlanUsageReader {
  countChannels(orgId: string): Promise<number>;
  /** posts (grupos) criados desde `since` — janela do mês corrente no Grátis */
  countPostsSince(orgId: string, since: Date): Promise<number>;
  countWebhooks(orgId: string): Promise<number>;
  countApiKeys(orgId: string): Promise<number>;
}
