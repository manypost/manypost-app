import { and, arrayContains, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { WebhookRecord, WebhookRepository } from '@manypost/core';
import type { Db } from '../index';
import { webhookDeliveries, webhooks } from '../schema';

const toRecord = (row: typeof webhooks.$inferSelect): WebhookRecord => ({
  id: row.id,
  orgId: row.orgId,
  name: row.name,
  url: row.url,
  events: row.events,
  channelIds: row.channelIds,
  secretEnc: row.secretEnc,
  secretKeyVersion: row.secretKeyVersion,
  disabledAt: row.disabledAt,
  createdAt: row.createdAt,
});

export function makeWebhookRepository(db: Db): WebhookRepository {
  return {
    async create(d) {
      const [row] = await db.insert(webhooks).values(d).returning();
      return toRecord(row!);
    },
    async list(orgId) {
      const rows = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.orgId, orgId), isNull(webhooks.deletedAt)))
        .orderBy(desc(webhooks.createdAt));
      return rows.map(toRecord);
    },
    async softDelete(orgId, id) {
      const rows = await db
        .update(webhooks)
        .set({ deletedAt: new Date() })
        .where(and(eq(webhooks.orgId, orgId), eq(webhooks.id, id), isNull(webhooks.deletedAt)))
        .returning({ id: webhooks.id });
      return rows.length > 0;
    },
    async findForEvent(orgId, event, channelId) {
      const rows = await db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.orgId, orgId),
            isNull(webhooks.deletedAt),
            isNull(webhooks.disabledAt),
            arrayContains(webhooks.events, [event]),
            // channelIds vazio = todos os canais
            channelId
              ? or(sql`cardinality(${webhooks.channelIds}) = 0`, arrayContains(webhooks.channelIds, [channelId]))
              : sql`true`,
          ),
        );
      return rows.map(toRecord);
    },
    async createDelivery(d) {
      const [row] = await db
        .insert(webhookDeliveries)
        .values({ webhookId: d.webhookId, event: d.event, payload: d.payload })
        .returning({ id: webhookDeliveries.id });
      return row!;
    },
    async getDelivery(id) {
      const [row] = await db
        .select({ d: webhookDeliveries, w: webhooks })
        .from(webhookDeliveries)
        .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
        .where(eq(webhookDeliveries.id, id))
        .limit(1);
      if (!row) return null;
      return {
        delivery: {
          id: row.d.id,
          webhookId: row.d.webhookId,
          event: row.d.event,
          payload: row.d.payload,
          status: row.d.status,
          attempts: row.d.attempts,
        },
        webhook: toRecord(row.w),
      };
    },
    async markDelivery(id, d) {
      await db
        .update(webhookDeliveries)
        .set({
          status: d.status,
          attempts: d.attempts,
          nextRetryAt: d.nextRetryAt ?? null,
          lastError: d.lastError ?? null,
        })
        .where(eq(webhookDeliveries.id, id));
    },
  };
}
