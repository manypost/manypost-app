import type { ActorType, ApprovalStatus, MediaRef } from '@manypost/contracts';
import { ErrorCodes, WebhookEvents } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type {
  ApprovalLinkRecord,
  ApprovalLinkRepository,
  AuditLogRepository,
  NotificationRepository,
} from '../ports/approvals';
import type { EventPublisher } from '../ports/events';
import type { JobScheduler } from '../ports/job-scheduler';
import type { PlanPolicy } from '../ports/plan-policy';
import type { RealtimePublisher } from '../ports/realtime';
import type { ChannelRepository, PublishingRepository } from '../ports/publishing';
import { randomToken, sha256Hex } from '../tokens';
import { PUBLISH_QUEUE } from './publishing';

/** 32 bytes = 256 bits (spec exige ≥128); validade default de 7 dias. */
const TOKEN_BYTES = 32;
export const APPROVAL_DEFAULT_TTL_HOURS = 168;

// ---------------------------------------------------------------- equipe (autenticado)

export interface ApprovalLinkDeps {
  approvals: ApprovalLinkRepository;
  publishing: PublishingRepository;
  audit?: AuditLogRepository;
  /** limites comerciais do gerenciado; ausente = self-hosted (nada é barrado) */
  plan?: PlanPolicy;
}

/** Cria o link público do grupo (só para rascunhos). Criar de novo revoga o anterior. */
export const makeCreateApprovalLink = (deps: ApprovalLinkDeps) =>
  async (input: {
    orgId: string;
    groupId: string;
    actorType?: ActorType;
    actorId?: string | null;
    expiresInHours?: number;
  }) => {
    // "Aprovação por link público" é linha do Pro na landing
    await deps.plan?.assert(input.orgId, { kind: 'feature', feature: 'approval_link' });

    const group = await deps.publishing.getGroup(input.orgId, input.groupId);
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    if (group.state !== 'DRAFT') {
      throw new DomainError(
        ErrorCodes.PostInvalidTransition,
        'aprovação por link só se aplica a rascunhos (crie o post com requireApproval)',
      );
    }
    await deps.approvals.revokePending(input.orgId, input.groupId);
    const token = randomToken(TOKEN_BYTES);
    const link = await deps.approvals.create({
      orgId: input.orgId,
      groupId: input.groupId,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(
        Date.now() + (input.expiresInHours ?? APPROVAL_DEFAULT_TTL_HOURS) * 3_600_000,
      ),
    });
    await deps.audit?.append({
      orgId: input.orgId,
      actorType: input.actorType ?? 'USER',
      actorId: input.actorId ?? null,
      action: 'approval_link.created',
      targetType: 'post_group',
      targetId: input.groupId,
    });
    return { linkId: link.id, token, expiresAt: link.expiresAt };
  };

export const makeRevokeApprovalLink = (deps: Pick<ApprovalLinkDeps, 'approvals' | 'audit'>) =>
  async (input: { orgId: string; groupId: string; actorType?: ActorType; actorId?: string | null }) => {
    const revoked = await deps.approvals.revokePending(input.orgId, input.groupId);
    if (revoked > 0) {
      await deps.audit?.append({
        orgId: input.orgId,
        actorType: input.actorType ?? 'USER',
        actorId: input.actorId ?? null,
        action: 'approval_link.revoked',
        targetType: 'post_group',
        targetId: input.groupId,
      });
    }
    return { revoked: revoked > 0 };
  };

/** Status do link mais recente do grupo (badge "aguardando cliente"); expira lazy. */
export const makeGetApprovalLinkStatus = (deps: Pick<ApprovalLinkDeps, 'approvals'>) =>
  async (orgId: string, groupId: string) => {
    const link = await deps.approvals.latestByGroup(orgId, groupId);
    if (!link) return null;
    let status: ApprovalStatus = link.status;
    if (status === 'PENDING' && link.expiresAt <= new Date()) {
      await deps.approvals.resolve(link.id, 'EXPIRED');
      status = 'EXPIRED';
    }
    return {
      status,
      feedback: link.feedback,
      approverName: link.approverName,
      expiresAt: link.expiresAt,
      resolvedAt: link.resolvedAt,
      createdAt: link.createdAt,
    };
  };

// ---------------------------------------------------------------- superfície pública

/** Token → link "vivo" (PENDING ou resolvido). Inválido/expirado/revogado = null:
 *  o chamador responde 404 uniforme — sem enumeração (SPEC_API_MCP §3). */
const findLiveLink = async (
  approvals: ApprovalLinkRepository,
  token: string,
): Promise<ApprovalLinkRecord | null> => {
  if (!token || token.length < 16) return null;
  const link = await approvals.findByTokenHash(sha256Hex(token));
  if (!link) return null;
  if (link.status === 'PENDING' && link.expiresAt <= new Date()) {
    await approvals.resolve(link.id, 'EXPIRED');
    return null;
  }
  if (link.status === 'EXPIRED' || link.status === 'REVOKED') return null;
  return link;
};

const notFound = () => new DomainError(ErrorCodes.NotFound, 'link inválido ou expirado');

export interface ApprovalPreviewDeps {
  approvals: ApprovalLinkRepository;
  publishing: PublishingRepository;
  channels: ChannelRepository;
}

const publicMedia = (media: MediaRef[]) =>
  media.map((m) => ({ type: m.type, url: m.url, mime: m.mime, ...(m.alt ? { alt: m.alt } : {}) }));

/** Preview público: como o post será renderizado em cada rede — e NADA além disso. */
export const makeGetApprovalPreview = (deps: ApprovalPreviewDeps) =>
  async (token: string) => {
    const link = await findLiveLink(deps.approvals, token);
    if (!link) throw notFound();
    const group = await deps.publishing.getGroup(link.orgId, link.groupId);
    if (!group || group.state === 'CANCELLED') throw notFound();

    const channels = await deps.channels.findMany(
      link.orgId,
      group.publications.map((p) => p.channelId),
    );
    const byId = new Map(channels.map((c) => [c.id, c]));

    const publications = await Promise.all(
      group.publications.map(async (p) => {
        const ch = byId.get(p.channelId);
        const items = await deps.publishing.listItems(p.id);
        return {
          provider: ch?.provider ?? 'desconhecido',
          channelName: ch?.name ?? '',
          channelUsername: ch?.username ?? null,
          channelAvatarUrl: ch?.avatarUrl ?? null,
          items: [
            // item 0 sai de publication.content (fonte de verdade p/ edições — STATUS §3.10)
            { text: p.content.text, media: publicMedia(p.content.media ?? []), delaySec: 0 },
            ...items
              .filter((it) => it.position > 0)
              .map((it) => ({
                text: it.content.text,
                media: publicMedia(it.media),
                delaySec: it.delaySec,
              })),
          ],
        };
      }),
    );

    return {
      status: link.status,
      feedback: link.feedback,
      approverName: link.approverName,
      expiresAt: link.expiresAt,
      resolvedAt: link.resolvedAt,
      publishAt: group.publishAt,
      timezone: group.timezone,
      publications,
    };
  };

export interface ResolveApprovalDeps {
  approvals: ApprovalLinkRepository;
  publishing: PublishingRepository;
  scheduler: JobScheduler;
  audit?: AuditLogRepository;
  notifications?: NotificationRepository;
  events?: EventPublisher;
  realtime?: RealtimePublisher;
  log?: (level: string, msg: string, data?: object) => void;
}

/** Aprovar agenda de verdade (DRAFT→SCHEDULED + jobs); pedir ajustes mantém o rascunho.
 *  Idempotente: segunda chamada retorna o estado resolvido sem agir de novo. */
export const makeResolveApproval = (deps: ResolveApprovalDeps) =>
  async (input: {
    token: string;
    action: 'approve' | 'request_changes';
    feedback?: string;
    approverName?: string;
    ip?: string;
  }) => {
    const link = await findLiveLink(deps.approvals, input.token);
    if (!link) throw notFound();
    if (link.status !== 'PENDING') {
      return { status: link.status, resolvedAt: link.resolvedAt, alreadyResolved: true as const };
    }

    const to = input.action === 'approve' ? ('APPROVED' as const) : ('CHANGES_REQUESTED' as const);
    const won = await deps.approvals.resolve(link.id, to, {
      ...(input.feedback ? { feedback: input.feedback } : {}),
      ...(input.approverName ? { approverName: input.approverName } : {}),
      ...(input.ip ? { approverIp: input.ip } : {}),
    });
    if (!won) {
      // corrida entre duas abas: quem perdeu devolve o estado que venceu
      const current = await deps.approvals.findByTokenHash(sha256Hex(input.token));
      return {
        status: current?.status ?? to,
        resolvedAt: current?.resolvedAt ?? null,
        alreadyResolved: true as const,
      };
    }

    if (input.action === 'approve') {
      // aprovado após o horário planejado = publica assim que possível (startAfter no passado)
      const pubs = await deps.publishing.scheduleDraftGroup(link.orgId, link.groupId);
      for (const pub of pubs) {
        try {
          await deps.scheduler.enqueue(
            PUBLISH_QUEUE,
            { publicationId: pub.id, v: pub.jobVersion },
            { startAfter: pub.publishAt ?? new Date(), singletonKey: pub.id },
          );
        } catch (err) {
          deps.log?.('error', 'enqueue pós-aprovação falhou — scanner vai recuperar', {
            publicationId: pub.id,
            err: String(err),
          });
        }
      }
      if (pubs.length > 0) {
        await deps.events?.emit({
          orgId: link.orgId,
          event: WebhookEvents.PostScheduled,
          data: { groupId: link.groupId, via: 'approval_link' },
        });
      }
    }

    await deps.audit?.append({
      orgId: link.orgId,
      actorType: 'PUBLIC_LINK',
      actorId: link.id,
      action: input.action === 'approve' ? 'approval.approved' : 'approval.changes_requested',
      targetType: 'post_group',
      targetId: link.groupId,
      detail: {
        ...(input.feedback ? { feedback: input.feedback.slice(0, 500) } : {}),
        ...(input.approverName ? { approverName: input.approverName } : {}),
      },
      ip: input.ip ?? null,
    });
    const title =
      input.action === 'approve' ? 'Cliente aprovou o post' : 'Cliente pediu ajustes no post';
    await deps.notifications?.create({
      orgId: link.orgId,
      kind: 'approval.resolved',
      title,
      ...(input.feedback
        ? { body: input.feedback.slice(0, 500) }
        : input.approverName
          ? { body: `por ${input.approverName}` }
          : {}),
      link: `/posts/${link.groupId}`,
    });
    // badge de notificação + card do kanban se movem sem reload (SSE)
    await deps.realtime
      ?.publish(link.orgId, {
        type: 'notification.created',
        data: { kind: 'approval.resolved', title, groupId: link.groupId, status: to },
      })
      .catch((err) => deps.log?.('warn', 'realtime publish falhou', { err: String(err) }));

    return { status: to, resolvedAt: new Date(), alreadyResolved: false as const };
  };
