import type { SubscriptionRepository } from '@manypost/core';
import { eq } from 'drizzle-orm';
import type { Db } from '../index';
import { subscriptions } from '../schema';

/**
 * Assinaturas (multi-tenant por org_id, como todo repositório do projeto).
 * `upsertByOrg` é idempotente de propósito: a Stripe reentrega webhooks e não garante ordem.
 */
export function makeSubscriptionRepository(db: Db): SubscriptionRepository {
  return {
    async findByOrg(orgId) {
      const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.orgId, orgId))
        .limit(1);
      return row ?? null;
    },
    async findByCustomerId(customerId) {
      const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.customerId, customerId))
        .limit(1);
      return row ?? null;
    },
    async upsertByOrg(d) {
      const [row] = await db
        .insert(subscriptions)
        .values(d)
        .onConflictDoUpdate({
          target: subscriptions.orgId,
          set: {
            customerId: d.customerId,
            subscriptionId: d.subscriptionId,
            tier: d.tier,
            period: d.period,
            status: d.status,
            currentPeriodEnd: d.currentPeriodEnd,
            cancelAt: d.cancelAt,
            identifier: d.identifier,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row!;
    },
    async deleteByCustomerId(customerId) {
      await db.delete(subscriptions).where(eq(subscriptions.customerId, customerId));
    },
  };
}
