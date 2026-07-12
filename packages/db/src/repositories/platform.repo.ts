import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AuditLogRepository, NotificationRepository } from '@manypost/core';
import type { Db } from '../index';
import { auditLog, notifications } from '../schema';

export function makeAuditLogRepository(db: Db): AuditLogRepository {
  return {
    async append(e) {
      await db.insert(auditLog).values({
        orgId: e.orgId,
        actorType: e.actorType,
        actorId: e.actorId ?? null,
        action: e.action,
        targetType: e.targetType ?? null,
        targetId: e.targetId ?? null,
        detail: e.detail ?? {},
        ip: e.ip ?? null,
      });
    },
  };
}

export function makeNotificationRepository(db: Db): NotificationRepository {
  return {
    async create(n) {
      await db.insert(notifications).values({
        orgId: n.orgId,
        userId: n.userId ?? null,
        kind: n.kind,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
      });
    },

    async list(orgId, limit = 50) {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.orgId, orgId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        kind: r.kind,
        title: r.title,
        body: r.body,
        link: r.link,
        readAt: r.readAt,
        createdAt: r.createdAt,
      }));
    },

    async markRead(orgId, id) {
      // idempotente: já lida não regrava o horário, mas continua sendo "encontrada"
      const rows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.orgId, orgId)))
        .limit(1);
      if (rows.length === 0) return false;
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(eq(notifications.id, id), eq(notifications.orgId, orgId), isNull(notifications.readAt)),
        );
      return true;
    },

    async markAllRead(orgId) {
      const rows = await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.orgId, orgId), isNull(notifications.readAt)))
        .returning({ id: notifications.id });
      return rows.length;
    },
  };
}
