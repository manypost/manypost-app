import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './identity';
import { billingPeriod, planTier, subscriptionStatus } from './enums';
import { pk, timestamps } from './helpers';

/**
 * Assinatura da marca (organization) espelhada da Stripe — 1 linha por org, criada só
 * quando existe assinatura de verdade. Sem linha = plano Grátis.
 * O `cus_…` fica em `organizations.billing_customer_id` (nasce antes da assinatura).
 *
 * Derived from Postiz (AGPL-3.0): model Subscription em schema.prisma
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    /** Customer da Stripe (redundante com organizations.billing_customer_id p/ lookup do webhook) */
    customerId: text('customer_id').notNull(),
    /** `sub_…` da Stripe */
    subscriptionId: text('subscription_id'),
    tier: planTier('tier').notNull(),
    period: billingPeriod('period'),
    status: subscriptionStatus('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    /** preenchido quando o cliente pediu cancelamento ao fim do período */
    cancelAt: timestamp('cancel_at', { withTimezone: true }),
    /** id opaco do checkout — a UI confirma "a assinatura caiu" sem esperar o webhook */
    identifier: text('identifier'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('subscriptions_org_ux').on(t.orgId),
    uniqueIndex('subscriptions_customer_ux').on(t.customerId),
  ],
);
