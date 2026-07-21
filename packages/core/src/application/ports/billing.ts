import type {
  BillingPeriod,
  PlanTier,
  SubscriptionStatus,
} from '@manypost/contracts';

/**
 * Assinatura da organização (marca) espelhada da Stripe — SPEC_BACKEND §5.
 * O `customerId` mora em `organizations.billing_customer_id` (existe antes de haver
 * assinatura); esta linha só nasce quando a Stripe confirma a assinatura.
 */
export interface SubscriptionRecord {
  id: string;
  orgId: string;
  customerId: string;
  /** `sub_…` da Stripe */
  subscriptionId: string | null;
  tier: PlanTier;
  period: BillingPeriod | null;
  status: SubscriptionStatus;
  /** fim do período pago corrente (renovação, ou corte quando cancelada) */
  currentPeriodEnd: Date | null;
  /** preenchido quando o cliente pediu cancelamento ao fim do período */
  cancelAt: Date | null;
  /** id opaco gerado no checkout — permite a UI confirmar "a assinatura caiu" */
  identifier: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Estado vindo da Stripe já normalizado pelo adapter (o core não conhece a Stripe). */
export interface RemoteSubscription {
  customerId: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  tier: PlanTier;
  period: BillingPeriod;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  identifier: string | null;
}

export interface SubscriptionRepository {
  findByOrg(orgId: string): Promise<SubscriptionRecord | null>;
  findByCustomerId(customerId: string): Promise<SubscriptionRecord | null>;
  upsertByOrg(d: {
    orgId: string;
    customerId: string;
    subscriptionId: string | null;
    tier: PlanTier;
    period: BillingPeriod | null;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    cancelAt: Date | null;
    identifier: string | null;
  }): Promise<SubscriptionRecord>;
  /** assinatura encerrada na Stripe: a org volta ao Grátis (a linha some, o customer fica) */
  deleteByCustomerId(customerId: string): Promise<void>;
}

export interface InvoiceSummary {
  id: string;
  /** centavos */
  amountPaid: number;
  currency: string;
  status: string;
  createdAt: Date;
  /** link hospedado pela Stripe (fatura/recibo) — pode não existir em faturas de valor 0 */
  invoiceUrl: string | null;
  pdfUrl: string | null;
}

export interface CheckoutSession {
  /** URL do Stripe Checkout hospedado */
  url: string;
  /** id opaco para a UI confirmar a assinatura na volta */
  identifier: string;
}

/**
 * Porta de cobrança (adapter = Stripe em `apps/api/src/infra/billing`). Fora do modo
 * gerenciado ela simplesmente não é instanciada — nenhum use-case exige billing.
 */
export interface BillingGateway {
  /** cria (ou reaproveita) o Customer da marca na Stripe */
  ensureCustomer(input: {
    orgId: string;
    orgName: string;
    email: string;
    existingCustomerId: string | null;
  }): Promise<string>;
  createCheckout(input: {
    orgId: string;
    userId: string;
    customerId: string;
    tier: PlanTier;
    period: BillingPeriod;
    identifier: string;
    successUrl: string;
    cancelUrl: string;
    trialDays: number;
  }): Promise<{ url: string }>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /**
   * Troca de plano de quem já assina (upgrade/downgrade) com proration imediata.
   * Se a Stripe recusar (cartão exigindo ação), devolve o portal para o cliente resolver.
   */
  changePlan(input: {
    orgId: string;
    userId: string;
    customerId: string;
    tier: PlanTier;
    period: BillingPeriod;
    identifier: string;
    returnUrl: string;
  }): Promise<{ changed: true } | { portalUrl: string }>;
  /** prévia do valor a pagar agora numa troca de plano (centavos) */
  previewChange(input: {
    customerId: string;
    tier: PlanTier;
    period: BillingPeriod;
  }): Promise<{ amount: number }>;
  /** alterna cancelamento ao fim do período; pagamento em atraso cancela na hora */
  toggleCancel(customerId: string): Promise<{
    cancelAt: Date | null;
    canceledImmediately: boolean;
  }>;
  listInvoices(customerId: string): Promise<InvoiceSummary[]>;
  /** assinatura ativa (ou em teste) na Stripe — usado para reconciliar sem esperar webhook */
  findRemoteSubscription(customerId: string): Promise<RemoteSubscription | null>;
}
