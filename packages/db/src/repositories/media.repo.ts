import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { MediaRecord, MediaRepository } from '@manypost/core';
import type { Db } from '../index';
import { media } from '../schema';

const toRecord = (row: typeof media.$inferSelect): MediaRecord => ({
  id: row.id,
  orgId: row.orgId,
  path: row.path,
  mime: row.mime,
  byteSize: row.byteSize,
  width: row.width,
  height: row.height,
  durationSec: row.durationSec,
  thumbnailPath: row.thumbnailPath,
  alt: row.alt,
  blurhash: row.blurhash,
  createdAt: row.createdAt,
});

export function makeMediaRepository(db: Db): MediaRepository {
  return {
    async create(d) {
      const [row] = await db.insert(media).values(d).returning();
      return toRecord(row!);
    },

    async list(orgId, opts) {
      const rows = await db
        .select()
        .from(media)
        .where(and(eq(media.orgId, orgId), isNull(media.deletedAt)))
        .orderBy(desc(media.createdAt))
        .limit(Math.min(opts?.limit ?? 50, 200));
      return rows.map(toRecord);
    },

    async findMany(orgId, ids) {
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(media)
        .where(and(eq(media.orgId, orgId), inArray(media.id, ids), isNull(media.deletedAt)));
      return rows.map(toRecord);
    },

    async setAlt(orgId, id, alt) {
      const rows = await db
        .update(media)
        .set({ alt })
        .where(and(eq(media.id, id), eq(media.orgId, orgId), isNull(media.deletedAt)))
        .returning({ id: media.id });
      return rows.length > 0;
    },

    async softDelete(orgId, id) {
      const rows = await db
        .update(media)
        .set({ deletedAt: new Date() })
        .where(and(eq(media.id, id), eq(media.orgId, orgId), isNull(media.deletedAt)))
        .returning({ id: media.id });
      return rows.length > 0;
    },
  };
}
