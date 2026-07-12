import type { ActorType, ApprovalStatus } from '@manypost/contracts';

/** Link público de aprovação (DECISIONS v1.1 §12). O token em claro nunca é persistido. */
export interface ApprovalLinkRecord {
  id: string;
  orgId: string;
  groupId: string;
  status: ApprovalStatus;
  feedback: string | null;
  approverName: string | null;
  expiresAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface ApprovalLinkRepository {
  create(d: {
    orgId: string;
    groupId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ApprovalLinkRecord>;
  findByTokenHash(tokenHash: string): Promise<ApprovalLinkRecord | null>;
  /** link mais recente do grupo (qualquer status) — badge "aguardando cliente" */
  latestByGroup(orgId: string, groupId: string): Promise<ApprovalLinkRecord | null>;
  /** UPDATE condicional PENDING→to (fencing); false = corrida/já resolvido */
  resolve(
    id: string,
    to: Exclude<ApprovalStatus, 'PENDING'>,
    d?: { feedback?: string; approverName?: string; approverIp?: string },
  ): Promise<boolean>;
  /** revoga o link PENDING do grupo, se houver; retorna quantos revogou */
  revokePending(orgId: string, groupId: string): Promise<number>;
}

/** Trilha de auditoria central (SPEC_BACKEND §4.6, tabela audit_log). */
export interface AuditLogRepository {
  append(e: {
    orgId: string;
    actorType: ActorType;
    actorId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    detail?: Record<string, unknown>;
    ip?: string | null;
  }): Promise<void>;
}

export interface NotificationRecord {
  id: string;
  orgId: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationRepository {
  create(n: {
    orgId: string;
    userId?: string | null;
    kind: string;
    title: string;
    body?: string;
    link?: string;
  }): Promise<void>;
  list(orgId: string, limit?: number): Promise<NotificationRecord[]>;
  /** false = não encontrada nesta org (já lida é idempotente: true) */
  markRead(orgId: string, id: string): Promise<boolean>;
  markAllRead(orgId: string): Promise<number>;
}
