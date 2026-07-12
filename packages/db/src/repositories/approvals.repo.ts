import { and, desc, eq } from 'drizzle-orm';
import type { ApprovalLinkRecord, ApprovalLinkRepository } from '@manypost/core';
import type { Db } from '../index';
import { approvalLinks } from '../schema';

const toRecord = (row: typeof approvalLinks.$inferSelect): ApprovalLinkRecord => ({
  id: row.id,
  orgId: row.orgId,
  groupId: row.groupId,
  status: row.status,
  feedback: row.feedback,
  approverName: row.approverName,
  expiresAt: row.expiresAt,
  resolvedAt: row.resolvedAt,
  createdAt: row.createdAt,
});

export function makeApprovalLinkRepository(db: Db): ApprovalLinkRepository {
  return {
    async create(d) {
      const [row] = await db
        .insert(approvalLinks)
        .values({
          orgId: d.orgId,
          groupId: d.groupId,
          tokenHash: d.tokenHash,
          expiresAt: d.expiresAt,
        })
        .returning();
      return toRecord(row!);
    },

    async findByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(approvalLinks)
        .where(eq(approvalLinks.tokenHash, tokenHash))
        .limit(1);
      return row ? toRecord(row) : null;
    },

    async latestByGroup(orgId, groupId) {
      const [row] = await db
        .select()
        .from(approvalLinks)
        .where(and(eq(approvalLinks.orgId, orgId), eq(approvalLinks.groupId, groupId)))
        .orderBy(desc(approvalLinks.createdAt))
        .limit(1);
      return row ? toRecord(row) : null;
    },

    async resolve(id, to, d) {
      // UPDATE condicional em PENDING: entre duas abas do cliente, só uma vence
      const rows = await db
        .update(approvalLinks)
        .set({
          status: to,
          resolvedAt: new Date(),
          ...(d?.feedback !== undefined ? { feedback: d.feedback } : {}),
          ...(d?.approverName !== undefined ? { approverName: d.approverName } : {}),
          ...(d?.approverIp !== undefined ? { approverIp: d.approverIp } : {}),
        })
        .where(and(eq(approvalLinks.id, id), eq(approvalLinks.status, 'PENDING')))
        .returning({ id: approvalLinks.id });
      return rows.length > 0;
    },

    async revokePending(orgId, groupId) {
      const rows = await db
        .update(approvalLinks)
        .set({ status: 'REVOKED', resolvedAt: new Date() })
        .where(
          and(
            eq(approvalLinks.orgId, orgId),
            eq(approvalLinks.groupId, groupId),
            eq(approvalLinks.status, 'PENDING'),
          ),
        )
        .returning({ id: approvalLinks.id });
      return rows.length;
    },
  };
}
