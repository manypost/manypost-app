import {
  BILLING_CURRENCY,
  BillingPeriods,
  ErrorCodes,
  PLANS,
  PlanTiers,
  type BillingPeriod,
  type PlanTier,
  type SubscriptionStatus,
} from '@manypost/contracts';
import {
  DomainError,
  type BillingGateway,
  type InvoiceSummary,
  type RemoteSubscription,
} from '@manypost/core';
import Stripe from 'stripe';

/**
 * Adapter Stripe da porta BillingGateway — ÚNICO arquivo do monorepo que importa o SDK.
 * Só é instanciado no modo gerenciado (`IS_SELF_HOSTED=false` + STRIPE_SECRET_KEY).
 *
 * Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/services/stripe.service.ts
 * Divergências deliberadas: (1) preços resolvidos por `lookup_key` estável (o Postiz procura
 * por nome/valor e cria duplicata quando o preço muda); (2) Product com id determinístico
 * (`manypost_pro`) em vez de busca por nome; (3) sem trial por padrão — a landing já vende
 * um plano Grátis para sempre.
 */

/** Marca os objetos criados por esta instalação — webhooks de outras integrações são ignorados. */
export const STRIPE_SERVICE_TAG = 'manypost';

const productId = (tier: PlanTier) => `manypost_${tier.toLowerCase()}`;
const intervalOf = (period: BillingPeriod) => (period === 'MONTHLY' ? 'month' : 'year');

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  incomplete: 'INCOMPLETE',
  // cobrança desistiu ou terminou: sem acesso pago
  canceled: 'CANCELED',
  incomplete_expired: 'CANCELED',
  unpaid: 'CANCELED',
  paused: 'CANCELED',
};

const isMissing = (err: unknown) =>
  (err as Stripe.errors.StripeError)?.code === 'resource_missing' ||
  (err as { statusCode?: number })?.statusCode === 404;

const asDate = (unix: number | null | undefined) => (unix ? new Date(unix * 1000) : null);

/** Descobre plano+período pelo `lookup_key` do preço; cai no produto+intervalo se faltar. */
function planFromPrice(price: Stripe.Price | null | undefined) {
  if (!price) return null;
  for (const tier of PlanTiers) {
    for (const period of BillingPeriods) {
      if (PLANS[tier].prices[period]?.lookupKey === price.lookup_key) return { tier, period };
    }
  }
  const product = typeof price.product === 'string' ? price.product : price.product?.id;
  const tier = PlanTiers.find((t) => productId(t) === product);
  if (tier && price.recurring) {
    return { tier, period: price.recurring.interval === 'year' ? 'YEARLY' : 'MONTHLY' } as const;
  }
  return null;
}

/** Normaliza a Subscription da Stripe para o contrato do core. */
export function toRemoteSubscription(sub: Stripe.Subscription): RemoteSubscription | null {
  const item = sub.items.data[0];
  const fromPrice = planFromPrice(item?.price);
  const metaTier = PlanTiers.find((t) => t === sub.metadata?.tier);
  const metaPeriod = BillingPeriods.find((p) => p === sub.metadata?.period);
  const tier = fromPrice?.tier ?? metaTier;
  const period = fromPrice?.period ?? metaPeriod;
  if (!tier || !period) return null; // assinatura de outro produto na mesma conta

  return {
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
    status: STATUS_MAP[sub.status] ?? 'CANCELED',
    tier,
    period,
    // na API 2025+ o fim do período vive no ITEM da assinatura, não na assinatura
    currentPeriodEnd: asDate(item?.current_period_end),
    cancelAt: asDate(sub.cancel_at),
    identifier: sub.metadata?.identifier ?? null,
  };
}

export interface StripeGateway extends BillingGateway {
  /** valida a assinatura do webhook (corpo CRU — nunca o JSON já parseado) */
  constructEvent(rawBody: string | Buffer, signature: string): Stripe.Event;
  /** cria/atualiza Products e Prices do catálogo na conta (script `stripe:sync`) */
  syncCatalog(): Promise<Array<{ tier: PlanTier; period: BillingPeriod; priceId: string }>>;
}

export function makeStripeGateway(opts: {
  secretKey: string;
  webhookSecret: string;
}): StripeGateway {
  const stripe = new Stripe(opts.secretKey);

  /** Product por plano, com id determinístico — idempotente sem depender de busca. */
  async function ensureProduct(tier: PlanTier): Promise<string> {
    const id = productId(tier);
    try {
      const found = await stripe.products.retrieve(id);
      if (found.name !== PLANS[tier].name || !found.active) {
        await stripe.products.update(id, { name: PLANS[tier].name, active: true });
      }
      return found.id;
    } catch (err) {
      if (!isMissing(err)) throw err;
      const created = await stripe.products.create({
        id,
        name: PLANS[tier].name,
        metadata: { service: STRIPE_SERVICE_TAG, tier },
      });
      return created.id;
    }
  }

  /**
   * Price por `lookup_key`. Se o valor do catálogo mudar, cria um preço novo e TRANSFERE a
   * chave (`transfer_lookup_key`): quem já assina continua no preço antigo (grandfathering),
   * assinaturas novas pegam o atual.
   */
  async function ensurePrice(tier: PlanTier, period: BillingPeriod): Promise<string> {
    const def = PLANS[tier].prices[period];
    if (!def) {
      throw new DomainError(ErrorCodes.PlanFeatureLocked, `plano ${tier} não é assinável`);
    }
    const { data } = await stripe.prices.list({
      active: true,
      lookup_keys: [def.lookupKey],
      limit: 1,
    });
    const found = data[0];
    if (found && found.unit_amount === def.amount && found.currency === BILLING_CURRENCY) {
      return found.id;
    }
    const created = await stripe.prices.create({
      product: await ensureProduct(tier),
      currency: BILLING_CURRENCY,
      unit_amount: def.amount,
      recurring: { interval: intervalOf(period) },
      lookup_key: def.lookupKey,
      transfer_lookup_key: true,
      nickname: `${PLANS[tier].name} — ${period === 'MONTHLY' ? 'mensal' : 'anual'}`,
      metadata: { service: STRIPE_SERVICE_TAG, tier, period },
    });
    return created.id;
  }

  /** Assinaturas que ainda valem alguma coisa (a Stripe mantém as canceladas na listagem). */
  async function liveSubscriptions(customerId: string) {
    const { data } = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      expand: ['data.latest_invoice'],
    });
    return data.filter((s) => s.status !== 'canceled' && s.status !== 'incomplete_expired');
  }

  const metadataFor = (input: {
    orgId: string;
    userId: string;
    tier: PlanTier;
    period: BillingPeriod;
    identifier: string;
  }) => ({
    service: STRIPE_SERVICE_TAG,
    orgId: input.orgId,
    userId: input.userId,
    tier: input.tier,
    period: input.period,
    identifier: input.identifier,
  });

  return {
    constructEvent(rawBody, signature) {
      return stripe.webhooks.constructEvent(rawBody, signature, opts.webhookSecret);
    },

    async syncCatalog() {
      const out: Array<{ tier: PlanTier; period: BillingPeriod; priceId: string }> = [];
      for (const tier of PlanTiers) {
        for (const period of BillingPeriods) {
          if (!PLANS[tier].prices[period]) continue;
          out.push({ tier, period, priceId: await ensurePrice(tier, period) });
        }
      }
      return out;
    },

    async ensureCustomer(input) {
      if (input.existingCustomerId) return input.existingCustomerId;
      const customer = await stripe.customers.create({
        name: input.orgName,
        ...(input.email ? { email: input.email } : {}),
        metadata: { service: STRIPE_SERVICE_TAG, orgId: input.orgId },
      });
      return customer.id;
    },

    async createCheckout(input) {
      const price = await ensurePrice(input.tier, input.period);
      const metadata = metadataFor(input);
      const session = await stripe.checkout.sessions.create({
        customer: input.customerId,
        mode: 'subscription',
        locale: 'pt-BR',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        allow_promotion_codes: true,
        line_items: [{ price, quantity: 1 }],
        subscription_data: {
          metadata,
          ...(input.trialDays > 0 ? { trial_period_days: input.trialDays } : {}),
        },
        metadata,
      });
      if (!session.url) {
        throw new DomainError(ErrorCodes.BillingProviderError, 'checkout sem URL');
      }
      return { url: session.url };
    },

    async createPortal(input) {
      const session = await stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: input.returnUrl,
        locale: 'pt-BR',
      });
      return { url: session.url };
    },

    async changePlan(input) {
      const price = await ensurePrice(input.tier, input.period);
      const [current] = await liveSubscriptions(input.customerId);
      const item = current?.items.data[0];
      if (!current || !item) {
        throw new DomainError(ErrorCodes.BillingNoSubscription, 'nenhuma assinatura para trocar');
      }
      try {
        await stripe.subscriptions.update(current.id, {
          cancel_at_period_end: false,
          proration_behavior: 'always_invoice',
          metadata: metadataFor(input),
          items: [{ id: item.id, price, quantity: 1 }],
        });
        return { changed: true };
      } catch {
        // cartão exigindo ação (3DS), saldo insuficiente…: o cliente resolve no portal
        const portal = await stripe.billingPortal.sessions.create({
          customer: input.customerId,
          return_url: input.returnUrl,
          locale: 'pt-BR',
        });
        return { portalUrl: portal.url };
      }
    },

    async previewChange(input) {
      const [current] = await liveSubscriptions(input.customerId);
      const item = current?.items.data[0];
      if (!current || !item) return { amount: 0 };
      try {
        const price = await ensurePrice(input.tier, input.period);
        const preview = await stripe.invoices.createPreview({
          customer: input.customerId,
          subscription: current.id,
          subscription_details: {
            proration_behavior: 'create_prorations',
            billing_cycle_anchor: 'now',
            proration_date: Math.floor(Date.now() / 1000),
            items: [{ id: item.id, price, quantity: 1 }],
          },
        });
        return { amount: preview.amount_remaining ?? 0 };
      } catch {
        return { amount: 0 }; // prévia é conveniência: nunca derruba a tela de planos
      }
    },

    /** Derived from Postiz (AGPL-3.0): stripe.service.ts setToCancel */
    async toggleCancel(customerId) {
      const [sub] = await liveSubscriptions(customerId);
      if (!sub) {
        throw new DomainError(ErrorCodes.BillingNoSubscription, 'nenhuma assinatura ativa');
      }

      // já estava marcada para cancelar → o clique reativa
      if (sub.cancel_at_period_end) {
        const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
        return { cancelAt: asDate(updated.cancel_at), canceledImmediately: false };
      }

      const invoice = sub.latest_invoice as Stripe.Invoice | null;
      const failedPayment =
        sub.status === 'past_due' ||
        invoice?.status === 'open' ||
        invoice?.status === 'uncollectible';

      if (failedPayment) {
        // não há período pago a honrar: encerra na hora
        await stripe.subscriptions.cancel(sub.id);
        return { cancelAt: new Date(), canceledImmediately: true };
      }

      const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
      return {
        cancelAt: asDate(updated.cancel_at ?? updated.items.data[0]?.current_period_end),
        canceledImmediately: false,
      };
    },

    async listInvoices(customerId) {
      const { data } = await stripe.invoices.list({ customer: customerId, limit: 24 });
      return data.map(
        (i): InvoiceSummary => ({
          id: i.id ?? '',
          amountPaid: i.amount_paid,
          currency: i.currency,
          status: i.status ?? 'unknown',
          createdAt: new Date(i.created * 1000),
          invoiceUrl: i.hosted_invoice_url ?? null,
          pdfUrl: i.invoice_pdf ?? null,
        }),
      );
    },

    async findRemoteSubscription(customerId) {
      const live = await liveSubscriptions(customerId);
      for (const sub of live) {
        const remote = toRemoteSubscription(sub);
        if (remote) return remote;
      }
      return null;
    },
  };
}
