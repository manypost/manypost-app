import type { MediaRef, PostOrigin, ProviderContext } from '@manypost/contracts';
import { ErrorCodes, WebhookEvents } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { ChannelProviderRegistry } from '../ports/channel-provider-registry';
import type { CryptoService } from '../ports/crypto';
import type { EventPublisher } from '../ports/events';
import type { JobScheduler } from '../ports/job-scheduler';
import type { MediaRepository, MediaStorage } from '../ports/media';
import type { RateLimiter, RateWindowSpec } from '../ports/rate-limiter';
import type { ChannelRepository, PublishingRepository } from '../ports/publishing';
import { randomToken } from '../tokens';
import { channelAad } from './channels';

export const PUBLISH_QUEUE = 'publish';
export const RECOVER_QUEUE = 'recover-scan';
const ERROR_MAX_LEN = 4000;

const makeCtx = (log?: ProviderContext['log']): ProviderContext => ({
  fetch: globalThis.fetch,
  log: log ?? (() => {}),
  now: () => new Date(),
  secrets: {},
});

// ---------------------------------------------------------------- schedule

export interface SchedulePostDeps {
  channels: ChannelRepository;
  publishing: PublishingRepository;
  registry: ChannelProviderRegistry;
  scheduler: JobScheduler;
  media?: MediaRepository;
  storage?: MediaStorage;
  log?: (level: string, msg: string, data?: object) => void;
}

export const makeSchedulePost = (deps: SchedulePostDeps) =>
  async (input: {
    orgId: string;
    authorId: string | null;
    text: string;
    channelIds: string[];
    publishAt: Date;
    timezone?: string;
    origin?: PostOrigin;
    settingsByChannel?: Record<string, unknown>;
    mediaIds?: string[];
  }) => {
    const text = input.text.trim();
    if (!text) throw new DomainError(ErrorCodes.PostEmptyContent, 'conteúdo vazio');
    const ids = [...new Set(input.channelIds)];
    if (ids.length === 0) throw new DomainError(ErrorCodes.PostNoChannels, 'selecione ao menos um canal');

    const channels = await deps.channels.findMany(input.orgId, ids);
    if (channels.length !== ids.length) {
      throw new DomainError(ErrorCodes.NotFound, 'canal não encontrado nesta organização');
    }

    // resolve a mídia da biblioteca → refs com URL pública e MIME real (validado por canal abaixo)
    let mediaRefs: MediaRef[] = [];
    const mediaIds = [...new Set(input.mediaIds ?? [])];
    if (mediaIds.length > 0) {
      if (!deps.media || !deps.storage) {
        throw new DomainError(ErrorCodes.CapabilityDisabled, 'mídia indisponível nesta instalação');
      }
      const records = await deps.media.findMany(input.orgId, mediaIds);
      const byId = new Map(records.map((m) => [m.id, m]));
      mediaRefs = mediaIds.map((id) => {
        const m = byId.get(id);
        if (!m) throw new DomainError(ErrorCodes.NotFound, 'mídia não encontrada nesta organização');
        return {
          mediaId: m.id,
          type: m.mime.startsWith('image/') ? ('image' as const) : ('video' as const),
          url: deps.storage!.publicUrl(m.path),
          mime: m.mime,
          ...(m.alt ? { alt: m.alt } : {}),
        };
      });
    }

    const publications: Array<{
      channelId: string;
      content: { text: string; media?: MediaRef[] };
      settings: unknown;
    }> = [];
    for (const ch of channels) {
      if (ch.status !== 'ACTIVE') {
        throw new DomainError(ErrorCodes.ChannelDisabled, `canal ${ch.name} não está ativo`, {
          channelId: ch.id,
          status: ch.status,
        });
      }
      const provider = deps.registry.get(ch.provider);
      if (!provider) {
        throw new DomainError(ErrorCodes.CapabilityDisabled, `provider ${ch.provider} indisponível`);
      }
      const settingsRaw = input.settingsByChannel?.[ch.id] ?? {};
      const parsed = provider.settingsSchema.safeParse(settingsRaw);
      if (!parsed.success) {
        throw new DomainError(ErrorCodes.PostInvalidSettings, 'settings inválidos para o canal', {
          channelId: ch.id,
          issues: parsed.error.issues.map((i) => i.message),
        });
      }
      const max = provider.capabilities.maxLength(parsed.data);
      if (text.length > max) {
        throw new DomainError(ErrorCodes.PostTooLong, `limite de ${max} caracteres em ${ch.name}`, {
          channelId: ch.id,
          max,
          length: text.length,
        });
      }
      if (mediaRefs.length > 0) {
        const verdict = await provider.validateMedia([{ content: text, media: mediaRefs }]);
        if (!verdict.ok) {
          throw new DomainError(ErrorCodes.PostInvalidMedia, `${ch.name}: ${verdict.reason}`, {
            channelId: ch.id,
          });
        }
      }
      publications.push({
        channelId: ch.id,
        content: { text, ...(mediaRefs.length > 0 ? { media: mediaRefs } : {}) },
        settings: parsed.data,
      });
    }

    const created = await deps.publishing.createGroup({
      orgId: input.orgId,
      authorId: input.authorId,
      baseContent: { text, ...(mediaRefs.length > 0 ? { media: mediaRefs } : {}) },
      publishAt: input.publishAt,
      timezone: input.timezone ?? 'UTC',
      origin: input.origin ?? 'WEB',
      publications,
    });

    // enqueue pós-commit; qualquer falha aqui é recuperada pelo scanner (§8),
    // e o fencing de estado torna entregas duplicadas inofensivas
    for (const pub of created.publications) {
      try {
        await deps.scheduler.enqueue(
          PUBLISH_QUEUE,
          { publicationId: pub.id, v: 0 },
          { startAfter: input.publishAt, singletonKey: pub.id },
        );
      } catch (err) {
        deps.log?.('error', 'enqueue falhou — scanner vai recuperar', {
          publicationId: pub.id,
          err: String(err),
        });
      }
    }

    return deps.publishing.getGroup(input.orgId, created.groupId);
  };

// ---------------------------------------------------------------- publish

export interface PublishDeps {
  publishing: PublishingRepository;
  channels: ChannelRepository;
  registry: ChannelProviderRegistry;
  crypto: CryptoService;
  scheduler: JobScheduler;
  retryBaseSec: number;
  maxAttempts?: number;
  rateLimiter?: RateLimiter;
  events?: EventPublisher;
  log?: (level: string, msg: string, data?: object) => void;
}

const RUNNABLE = ['SCHEDULED', 'RETRYING', 'TOKEN_REFRESH'] as const;

export const makePublishPublication = (deps: PublishDeps) =>
  async (publicationId: string, jobVersion?: number): Promise<void> => {
    const found = await deps.publishing.findForPublish(publicationId);
    if (!found) return;
    const { publication: pub, channel } = found;
    if (!(RUNNABLE as readonly string[]).includes(pub.state)) return; // já tratada — fencing
    // job de uma versão anterior (post editado/cancelado): descarta
    if (jobVersion !== undefined && jobVersion !== pub.jobVersion) return;

    // rate-limit ANTES de reivindicar (negado não consome tentativa) — SPEC_QUEUE §6
    if (deps.rateLimiter) {
      const provider0 = deps.registry.get(channel.provider);
      const windows: RateWindowSpec[] = [];
      const pw = provider0?.rateDefaults.perProviderWindow;
      if (pw) windows.push({ key: `rl:p:${channel.provider}`, ...pw });
      const cw = provider0?.rateDefaults.perChannelWindow;
      if (cw) windows.push({ key: `rl:c:${channel.id}`, ...cw });
      if (windows.length > 0) {
        const verdict = await deps.rateLimiter.acquire(windows);
        if (!verdict.ok) {
          deps.log?.('warn', 'rate-limit: publicação adiada', {
            publicationId: pub.id,
            retryAfterSec: verdict.retryAfterSec,
          });
          await deps.scheduler.enqueue(
            PUBLISH_QUEUE,
            { publicationId: pub.id, v: pub.jobVersion },
            {
              startAfter: new Date(Date.now() + Math.max(1, verdict.retryAfterSec) * 1000),
              singletonKey: `${pub.id}:rl:${Math.floor(Date.now() / 1000)}`,
            },
          );
          return;
        }
      }
    }

    const claimed = await deps.publishing.transition(pub.id, [...RUNNABLE], 'PUBLISHING', {
      incrementAttempt: true,
      attemptId: randomToken(16),
    });
    if (!claimed) return;
    const attempt = pub.attemptCount + 1;

    const fail = async (cls: string, msg: string) => {
      await deps.publishing.transition(pub.id, ['PUBLISHING', 'TOKEN_REFRESH'], 'FAILED', {
        errorClass: cls,
        errorMessage: msg.slice(0, ERROR_MAX_LEN),
      });
      await deps.publishing.refreshGroupState(pub.groupId);
      await deps.events?.emit({
        orgId: pub.orgId,
        event: WebhookEvents.PostFailed,
        channelId: channel.id,
        data: { groupId: pub.groupId, publicationId: pub.id, channelId: channel.id, errorClass: cls },
      });
    };

    const provider = deps.registry.get(channel.provider);
    if (!provider) return fail('permanent', `provider ${channel.provider} desconhecido`);

    const aad = channelAad(channel.orgId, channel.provider, channel.externalId);
    const ctx = makeCtx(deps.log ? (l, m, d) => deps.log!(l, m, d) : undefined);

    try {
      const accessToken = await deps.crypto.decrypt(channel.tokenEnc, aad, channel.tokenKeyVersion);
      // settings do canal (ex.: instância Mastodon) + settings da publicação
      const settings = {
        ...(channel.settings as Record<string, unknown>),
        ...(pub.settings as Record<string, unknown>),
      };
      const [res] = await provider.publish(
        ctx,
        { accessToken, scopes: channel.scopes },
        [{ content: pub.content.text, media: pub.content.media ?? [] }],
        settings,
      );
      await deps.publishing.transition(pub.id, ['PUBLISHING'], 'PUBLISHED', {
        ...(res?.externalId ? { externalId: res.externalId } : {}),
        ...(res?.releaseUrl ? { releaseUrl: res.releaseUrl } : {}),
        publishedAt: new Date(),
        errorClass: null,
        errorMessage: null,
      });
      await deps.publishing.refreshGroupState(pub.groupId);
      await deps.events?.emit({
        orgId: pub.orgId,
        event: WebhookEvents.PostPublished,
        channelId: channel.id,
        data: {
          groupId: pub.groupId,
          publicationId: pub.id,
          channelId: channel.id,
          externalId: res?.externalId ?? null,
          releaseUrl: res?.releaseUrl ?? null,
        },
      });
    } catch (err) {
      const status = Number((err as { status?: number })?.status ?? 0);
      const body = String(
        (err as { body?: string })?.body ?? (err as Error)?.message ?? err,
      );
      const cls = provider.classifyError(status, body);

      if (cls === 'permanent') return fail('permanent', body);

      if (cls === 'refresh-token') {
        const moved = await deps.publishing.transition(pub.id, ['PUBLISHING'], 'TOKEN_REFRESH', {
          errorClass: 'refresh-token',
          errorMessage: body.slice(0, ERROR_MAX_LEN),
        });
        if (!moved) return;
        const markRefreshRequired = async () => {
          await deps.channels.setStatus(channel.id, 'REFRESH_REQUIRED');
          await deps.events?.emit({
            orgId: pub.orgId,
            event: WebhookEvents.ChannelRefreshRequired,
            channelId: channel.id,
            data: { channelId: channel.id, provider: channel.provider },
          });
        };
        if (!channel.refreshTokenEnc) {
          await markRefreshRequired();
          return fail('refresh-token', 'canal sem refresh token — reconexão manual necessária');
        }
        try {
          const refreshPlain = await deps.crypto.decrypt(
            channel.refreshTokenEnc,
            aad,
            channel.tokenKeyVersion,
          );
          const fresh = await provider.refreshToken(ctx, refreshPlain);
          const tokenEnc = await deps.crypto.encrypt(fresh.accessToken, aad);
          const refreshEnc = fresh.refreshToken
            ? await deps.crypto.encrypt(fresh.refreshToken, aad)
            : null;
          await deps.channels.updateTokens(channel.id, {
            tokenEnc: tokenEnc.ciphertext,
            tokenKeyVersion: tokenEnc.keyVersion,
            ...(refreshEnc ? { refreshTokenEnc: refreshEnc.ciphertext } : {}),
            tokenExpiresAt: fresh.expiresAt ? new Date(fresh.expiresAt) : null,
          });
          // token renovado → tenta de novo já (estado TOKEN_REFRESH é RUNNABLE)
          await deps.scheduler.enqueue(
            PUBLISH_QUEUE,
            { publicationId: pub.id, v: pub.jobVersion },
            { singletonKey: `${pub.id}:refresh:${attempt}` },
          );
        } catch {
          await markRefreshRequired();
          return fail('refresh-token', 'refresh do token falhou — reconexão manual necessária');
        }
        return;
      }

      // transient
      if (attempt >= (deps.maxAttempts ?? 5)) return fail('transient', body);
      const delaySec = deps.retryBaseSec * 2 ** (attempt - 1) * (0.5 + Math.random());
      await deps.publishing.transition(pub.id, ['PUBLISHING'], 'RETRYING', {
        errorClass: 'transient',
        errorMessage: body.slice(0, ERROR_MAX_LEN),
      });
      await deps.scheduler.enqueue(
        PUBLISH_QUEUE,
        { publicationId: pub.id, v: pub.jobVersion },
        {
          startAfter: new Date(Date.now() + delaySec * 1000),
          singletonKey: `${pub.id}:a${attempt}`,
        },
      );
    }
  };

// ---------------------------------------------------------------- cancel / edit

const PENDING = ['SCHEDULED', 'RETRYING', 'TOKEN_REFRESH'] as const;

export interface MutatePostDeps {
  publishing: PublishingRepository;
  channels: ChannelRepository;
  registry: ChannelProviderRegistry;
  scheduler: JobScheduler;
}

/** Cancela tudo que ainda não foi publicado; fencing por estado + versão mata jobs antigos. */
export const makeCancelPost = (deps: Pick<MutatePostDeps, 'publishing' | 'scheduler'>) =>
  async (orgId: string, groupId: string) => {
    const group = await deps.publishing.getGroup(orgId, groupId);
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    for (const pub of group.publications) {
      if ((PENDING as readonly string[]).includes(pub.state)) {
        await deps.publishing.transition(pub.id, [...PENDING], 'CANCELLED', { bumpJobVersion: true });
        await deps.scheduler.cancelBySingletonKey(PUBLISH_QUEUE, pub.id).catch(() => {}); // higiene
      }
    }
    await deps.publishing.refreshGroupState(groupId);
    return deps.publishing.getGroup(orgId, groupId);
  };

/** Edita texto/horário do que ainda está pendente (equivalente ao TERMINATE_EXISTING do Postiz). */
export const makeReschedulePost = (deps: MutatePostDeps) =>
  async (input: { orgId: string; groupId: string; text?: string; publishAt?: Date }) => {
    const group = await deps.publishing.getGroup(input.orgId, input.groupId);
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    if (group.publications.some((p) => p.state === 'PUBLISHING')) {
      throw new DomainError(ErrorCodes.PostInvalidTransition, 'publicação em andamento — aguarde');
    }
    const pending = group.publications.filter((p) =>
      (PENDING as readonly string[]).includes(p.state),
    );
    if (pending.length === 0) {
      throw new DomainError(ErrorCodes.PostInvalidTransition, 'nada pendente para editar');
    }

    const text = input.text?.trim();
    if (text !== undefined) {
      if (!text) throw new DomainError(ErrorCodes.PostEmptyContent, 'conteúdo vazio');
      const channels = await deps.channels.findMany(input.orgId, pending.map((p) => p.channelId));
      for (const ch of channels) {
        const provider = deps.registry.get(ch.provider);
        const max = provider?.capabilities.maxLength(undefined) ?? Infinity;
        if (text.length > max) {
          throw new DomainError(ErrorCodes.PostTooLong, `limite de ${max} caracteres em ${ch.name}`);
        }
      }
    }

    const updated = await deps.publishing.rescheduleGroup(input.orgId, input.groupId, {
      ...(text !== undefined ? { baseContent: { text } } : {}),
      ...(input.publishAt ? { publishAt: input.publishAt } : {}),
    });
    for (const pub of updated) {
      await deps.scheduler
        .enqueue(
          PUBLISH_QUEUE,
          { publicationId: pub.id, v: pub.jobVersion },
          { startAfter: pub.publishAt, singletonKey: `${pub.id}:v${pub.jobVersion}` },
        )
        .catch(() => {}); // scanner recupera
    }
    return deps.publishing.getGroup(input.orgId, input.groupId);
  };

// ---------------------------------------------------------------- recover

export interface RecoverDeps {
  publishing: PublishingRepository;
  scheduler: JobScheduler;
  log?: (level: string, msg: string, data?: object) => void;
}

/** Scanner (§8): SCHEDULED vencidas → re-enqueue; zumbis → NEEDS_REVIEW/re-enqueue. */
export const makeRecoverDue = (deps: RecoverDeps) =>
  async (): Promise<{ due: number; stuck: number }> => {
    const minuteKey = Math.floor(Date.now() / 60_000);

    const due = await deps.publishing.listDue(new Date(Date.now() - 3_000), 200);
    for (const d of due) {
      await deps.scheduler.enqueue(
        PUBLISH_QUEUE,
        { publicationId: d.id, v: d.jobVersion },
        { singletonKey: `${d.id}:recover:${minuteKey}` },
      );
    }
    if (due.length > 0) deps.log?.('warn', 'scanner recuperou publicações', { count: due.length });

    const stuck = await deps.publishing.listStuck(new Date(Date.now() - 15 * 60_000), 200);
    for (const s of stuck) {
      if (s.state === 'PUBLISHING') {
        // morreu no meio da chamada à rede: NUNCA repostar às cegas (DECISIONS §7)
        await deps.publishing.transition(s.id, ['PUBLISHING'], 'NEEDS_REVIEW', {
          errorClass: 'unknown',
          errorMessage: 'worker interrompido durante a publicação — confirme na rede antes de repostar',
        });
      } else {
        await deps.scheduler.enqueue(
          PUBLISH_QUEUE,
          { publicationId: s.id },
          { singletonKey: `${s.id}:stuck:${minuteKey}` },
        );
      }
    }
    return { due: due.length, stuck: stuck.length };
  };
