import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ChannelRecord, ChannelRepository } from '@manypost/core';
import type { Db } from '../index';
import { channels } from '../schema';

const toRecord = (row: typeof channels.$inferSelect): ChannelRecord => ({
  id: row.id,
  orgId: row.orgId,
  provider: row.provider,
  externalId: row.externalId,
  name: row.name,
  username: row.username,
  avatarUrl: row.avatarUrl,
  status: row.status,
  scopes: row.scopes,
  settings: row.settings,
  tokenEnc: row.tokenEnc,
  refreshTokenEnc: row.refreshTokenEnc,
  tokenKeyVersion: row.tokenKeyVersion,
  tokenExpiresAt: row.tokenExpiresAt,
});

export function makeChannelRepository(db: Db): ChannelRepository {
  return {
    async upsert(data) {
      const [row] = await db
        .insert(channels)
        .values({ ...data, refreshTokenEnc: data.refreshTokenEnc ?? null })
        .onConflictDoUpdate({
          target: [channels.orgId, channels.provider, channels.externalId],
          set: {
            name: data.name,
            username: data.username,
            avatarUrl: data.avatarUrl,
            scopes: data.scopes,
            tokenEnc: data.tokenEnc,
            refreshTokenEnc: data.refreshTokenEnc ?? null,
            tokenKeyVersion: data.tokenKeyVersion,
            tokenExpiresAt: data.tokenExpiresAt,
            status: data.status ?? 'ACTIVE',
            deletedAt: null,
          },
        })
        .returning();
      return toRecord(row!);
    },
    async list(orgId) {
      const rows = await db
        .select()
        .from(channels)
        .where(and(eq(channels.orgId, orgId), isNull(channels.deletedAt)));
      return rows.map(toRecord);
    },
    async findMany(orgId, ids) {
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(channels)
        .where(and(eq(channels.orgId, orgId), inArray(channels.id, ids), isNull(channels.deletedAt)));
      return rows.map(toRecord);
    },
    async updateTokens(id, d) {
      await db
        .update(channels)
        .set({
          tokenEnc: d.tokenEnc,
          tokenKeyVersion: d.tokenKeyVersion,
          ...(d.refreshTokenEnc ? { refreshTokenEnc: d.refreshTokenEnc } : {}),
          ...(d.tokenExpiresAt !== undefined ? { tokenExpiresAt: d.tokenExpiresAt } : {}),
        })
        .where(eq(channels.id, id));
    },
    async setStatus(id, status) {
      await db.update(channels).set({ status }).where(eq(channels.id, id));
    },
    async softDelete(orgId, id) {
      const rows = await db
        .update(channels)
        .set({ deletedAt: new Date(), status: 'DISABLED' })
        .where(and(eq(channels.orgId, orgId), eq(channels.id, id), isNull(channels.deletedAt)))
        .returning({ id: channels.id });
      return rows.length > 0;
    },
  };
}
