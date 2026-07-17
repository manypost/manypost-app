import type { MediaRef, PostOrigin, ProviderContext } from '@manypost/contracts';
import { ErrorCodes, WebhookEvents } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { ApprovalLinkRepository } from '../ports/approvals';
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
export const THREAD_QUEUE = 'publish-thread-item';
export const RECOVER_QUEUE = 'recover-scan';
const ERROR_MAX_LEN = 4000;
/** teto do delay entre itens de thread — mantém a publicação abaixo do watchdog de zumbis (15 min) */
export const THREAD_MAX_DELAY_SEC = 600;

const makeCtx = (
  log?: ProviderContext['log'],
  secrets?: Record<string, string>,
): ProviderContext => ({
  fetch: globalThis.fetch,
  log: log ?? (() => {}),
  now: () => new Date(),
  secrets: secrets ?? {},
});

// ---------------------------------------------------------------- schedule

export interface SchedulePostDeps {
  channels: ChannelRepository;
  publishing: PublishingRepository;
  registry: ChannelProviderRegistry;
  scheduler: JobScheduler;
  media?: MediaRepository;
  storage?: MediaStorage;
  events?: EventPublisher;
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
    /** override do texto do post principal por canal (SPEC_FRONTEND §3.3 — abas por canal) */
    textByChannel?: Record<string, string>;
    mediaIds?: string[];
    /** réplicas encadeadas após o post principal (SPEC_QUEUE §9); delaySec = espera antes do item */
    thread?: Array<{ text: string; mediaIds?: string[] | undefined; delaySec?: number | undefined }>;
    /** true = nasce DRAFT aguardando aprovação por link (DECISIONS v1.1 §12) — sem job até aprovar */
    requireApproval?: boolean;
  }) => {
    // item 0 = post principal; itens seguintes = réplicas da thread
    const rawItems = [
      { text: input.text, mediaIds: input.mediaIds ?? [], delaySec: 0 },
      ...(input.thread ?? []).map((t) => ({
        text: t.text,
        mediaIds: t.mediaIds ?? [],
        delaySec: Math.min(Math.max(t.delaySec ?? 0, 0), THREAD_MAX_DELAY_SEC),
      })),
    ].map((t) => ({ ...t, text: t.text.trim() }));
    if (rawItems.some((t) => !t.text)) {
      throw new DomainError(ErrorCodes.PostEmptyContent, 'conteúdo vazio');
    }
    const ids = [...new Set(input.channelIds)];
    if (ids.length === 0) throw new DomainError(ErrorCodes.PostNoChannels, 'selecione ao menos um canal');
    for (const key of Object.keys(input.textByChannel ?? {})) {
      if (!ids.includes(key)) {
        throw new DomainError(ErrorCodes.NotFound, 'textByChannel referencia canal fora de channelIds', {
          channelId: key,
        });
      }
    }

    const channels = await deps.channels.findMany(input.orgId, ids);
    if (channels.length !== ids.length) {
      throw new DomainError(ErrorCodes.NotFound, 'canal não encontrado nesta organização');
    }

    // resolve a mídia da biblioteca → refs com URL pública e MIME real (validado por canal abaixo)
    const allMediaIds = [...new Set(rawItems.flatMap((t) => t.mediaIds))];
    const refById = new Map<string, MediaRef>();
    if (allMediaIds.length > 0) {
      if (!deps.media || !deps.storage) {
        throw new DomainError(ErrorCodes.CapabilityDisabled, 'mídia indisponível nesta instalação');
      }
      const records = await deps.media.findMany(input.orgId, allMediaIds);
      for (const m of records) {
        refById.set(m.id, {
          mediaId: m.id,
          type: m.mime.startsWith('image/') ? 'image' : 'video',
          url: deps.storage.publicUrl(m.path),
          mime: m.mime,
          ...(m.alt ? { alt: m.alt } : {}),
        });
      }
      if (refById.size !== allMediaIds.length) {
        throw new DomainError(ErrorCodes.NotFound, 'mídia não encontrada nesta organização');
      }
    }
    const items = rawItems.map((t) => ({
      text: t.text,
      media: [...new Set(t.mediaIds)].map((id) => refById.get(id)!),
      delaySec: t.delaySec,
    }));
    const hasMedia = items.some((t) => t.media.length > 0);

    const publications: Array<{
      channelId: string;
      content: { text: string; media?: MediaRef[] };
      settings: unknown;
      items: Array<{ content: { text: string }; media: MediaRef[]; delaySec: number }>;
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
      if (items.length > 1 && (!provider.capabilities.threads || !provider.publishReply)) {
        throw new DomainError(ErrorCodes.CapabilityDisabled, `${ch.name} não suporta threads`, {
          channelId: ch.id,
        });
      }
      const settingsRaw = input.settingsByChannel?.[ch.id] ?? {};
      const parsed = provider.settingsSchema.safeParse(settingsRaw);
      if (!parsed.success) {
        throw new DomainError(ErrorCodes.PostInvalidSettings, 'settings inválidos para o canal', {
          channelId: ch.id,
          issues: parsed.error.issues.map((i) => i.message),
        });
      }
      // override do texto do post principal (item 0) por canal; réplicas da thread são globais
      const override = input.textByChannel?.[ch.id]?.trim();
      if (override !== undefined && override.length === 0) {
        throw new DomainError(ErrorCodes.PostEmptyContent, `conteúdo vazio para ${ch.name}`, {
          channelId: ch.id,
        });
      }
      const chItems =
        override === undefined ? items : items.map((t, i) => (i === 0 ? { ...t, text: override } : t));
      // mesmo merge do publish (decisão: canal+publicação) — X verified valida contra 4000 já no agendamento
      const max = provider.capabilities.maxLength({
        ...((ch.settings as Record<string, unknown> | null) ?? {}),
        ...(parsed.data as Record<string, unknown>),
      });
      for (const item of chItems) {
        if (item.text.length > max) {
          throw new DomainError(ErrorCodes.PostTooLong, `limite de ${max} caracteres em ${ch.name}`, {
            channelId: ch.id,
            max,
            length: item.text.length,
          });
        }
      }
      if (hasMedia) {
        const verdict = await provider.validateMedia(
          chItems.map((t) => ({ content: t.text, media: t.media })),
        );
        if (!verdict.ok) {
          throw new DomainError(ErrorCodes.PostInvalidMedia, `${ch.name}: ${verdict.reason}`, {
            channelId: ch.id,
          });
        }
      }
      const first = chItems[0]!;
      publications.push({
        channelId: ch.id,
        content: { text: first.text, ...(first.media.length > 0 ? { media: first.media } : {}) },
        settings: parsed.data,
        items: chItems.map((t) => ({ content: { text: t.text }, media: t.media, delaySec: t.delaySec })),
      });
    }

    const first = items[0]!;
    const created = await deps.publishing.createGroup({
      orgId: input.orgId,
      authorId: input.authorId,
      baseContent: { text: first.text, ...(first.media.length > 0 ? { media: first.media } : {}) },
      publishAt: input.publishAt,
      timezone: input.timezone ?? 'UTC',
      origin: input.origin ?? 'WEB',
      state: input.requireApproval ? 'DRAFT' : 'SCHEDULED',
      publications,
    });

    // rascunho aguardando aprovação: o job só nasce quando o cliente aprovar (approvals.ts)
    if (input.requireApproval) return deps.publishing.getGroup(input.orgId, created.groupId);

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

    await deps.events?.emit({
      orgId: input.orgId,
      event: WebhookEvents.PostScheduled,
      data: { groupId: created.groupId, publishAt: input.publishAt.toISOString() },
    });

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
  /** secrets de app por provider (client id/secret via env — SPEC_INTEGRATIONS §2) */
  secrets?: Record<string, Record<string, string>>;
  log?: (level: string, msg: string, data?: object) => void;
}

const RUNNABLE = ['SCHEDULED', 'RETRYING', 'TOKEN_REFRESH'] as const;

interface RunInput {
  publicationId: string;
  jobVersion?: number;
  /** presente = continuação de thread: retoma após o item deste índice (job publish-thread-item) */
  afterIndex?: number;
}

const makeRunner = (deps: PublishDeps) =>
  async ({ publicationId, jobVersion, afterIndex }: RunInput): Promise<void> => {
    const found = await deps.publishing.findForPublish(publicationId);
    if (!found) return;
    const { publication: pub, channel } = found;
    const isContinuation = afterIndex !== undefined;

    if (isContinuation) {
      // continuação só roda se NADA mudou: mesma versão, ainda PUBLISHING e cursor exato.
      // Qualquer divergência = job obsoleto/duplicado → no-op (nunca repostar)
      if (pub.state !== 'PUBLISHING') return;
      if (jobVersion !== pub.jobVersion) return;
      if (pub.lastPublishedIndex !== afterIndex) return;
    } else {
      if (!(RUNNABLE as readonly string[]).includes(pub.state)) return; // já tratada — fencing
      // job de uma versão anterior (post editado/cancelado): descarta
      if (jobVersion !== undefined && jobVersion !== pub.jobVersion) return;

      // rate-limit ANTES de reivindicar (negado não consome tentativa) — SPEC_QUEUE §6.
      // Continuações não passam aqui: a thread já está em voo e o ritmo é o delaySec
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
    }
    const attempt = isContinuation ? pub.attemptCount : pub.attemptCount + 1;

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
    const ctx = makeCtx(
      deps.log ? (l, m, d) => deps.log!(l, m, d) : undefined,
      deps.secrets?.[channel.provider],
    );

    const items = await deps.publishing.listItems(pub.id);
    const startIdx = pub.lastPublishedIndex + 1;
    let i = startIdx;

    const finalize = async () => {
      await deps.publishing.transition(pub.id, ['PUBLISHING'], 'PUBLISHED', {
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
          externalId: firstExternalId,
          releaseUrl: firstReleaseUrl,
        },
      });
    };

    // externalId/releaseUrl do item 0 (podem vir de tentativa anterior via cursor)
    let firstExternalId: string | null = items[0]?.externalId ?? pub.externalId;
    let firstReleaseUrl: string | null = pub.releaseUrl;

    // settings do canal (ex.: instância Mastodon, service do Bluesky) + settings da publicação;
    // fora do try: o refresh de token (catch) também precisa deles
    const settings = {
      ...(channel.settings as Record<string, unknown>),
      ...(pub.settings as Record<string, unknown>),
    };

    try {
      // retomada tardia (crash entre o último item e o PUBLISHED): só finaliza
      if (startIdx >= items.length) {
        if (items.length > 0) await finalize();
        return;
      }

      const accessToken = await deps.crypto.decrypt(channel.tokenEnc, aad, channel.tokenKeyVersion);
      const token = { accessToken, scopes: channel.scopes };

      let prevExternalId = startIdx > 0 ? items[startIdx - 1]!.externalId : null;
      for (; i < items.length; i++) {
        const item = items[i]!;
        let res;
        if (i === 0) {
          // item 0 publica a partir de pub.content — fonte de verdade p/ edições via PATCH
          [res] = await provider.publish(
            ctx,
            token,
            [{ content: pub.content.text, media: pub.content.media ?? [] }],
            settings,
          );
        } else {
          if (!provider.publishReply || !prevExternalId) {
            throw { status: 422, body: 'thread sem suporte no provider ou sem item anterior' };
          }
          res = await provider.publishReply(
            ctx,
            token,
            prevExternalId,
            { content: item.content.text, media: item.media },
            settings,
          );
        }
        // cursor avança SÓ após confirmação da rede — retry nunca reposta (SPEC_QUEUE §7)
        await deps.publishing.recordItemPublished(pub.id, item.id, i, {
          externalId: res?.externalId ?? null,
          releaseUrl: res?.releaseUrl ?? null,
        });
        prevExternalId = res?.externalId ?? null;
        if (i === 0) {
          firstExternalId = res?.externalId ?? null;
          firstReleaseUrl = res?.releaseUrl ?? null;
        }

        const next = items[i + 1];
        if (next && next.delaySec > 0) {
          // espera durável via fila (SPEC_QUEUE §9) — estado permanece PUBLISHING
          await deps.scheduler.enqueue(
            THREAD_QUEUE,
            { publicationId: pub.id, v: pub.jobVersion, afterIndex: i },
            {
              startAfter: new Date(Date.now() + next.delaySec * 1000),
              singletonKey: `${pub.id}:t${i + 1}:v${pub.jobVersion}`,
            },
          );
          return;
        }
      }

      await finalize();
    } catch (err) {
      const status = Number((err as { status?: number })?.status ?? 0);
      const rawBody = String(
        (err as { body?: string })?.body ?? (err as Error)?.message ?? err,
      );
      // em thread, aponta o item que falhou (os anteriores ficam publicados — cursor)
      const body = items.length > 1 ? `item ${i} da thread: ${rawBody}` : rawBody;
      const cls = provider.classifyError(status, rawBody);

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
          const fresh = await provider.refreshToken(ctx, refreshPlain, settings);
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

export const makePublishPublication = (deps: PublishDeps) => {
  const run = makeRunner(deps);
  return (publicationId: string, jobVersion?: number) =>
    run({ publicationId, ...(jobVersion !== undefined ? { jobVersion } : {}) });
};

/** Handler do job publish-thread-item (SPEC_QUEUE §9): retoma a thread após o delay. */
export const makeContinueThread = (deps: PublishDeps) => {
  const run = makeRunner(deps);
  return (publicationId: string, jobVersion: number, afterIndex: number) =>
    run({ publicationId, jobVersion, afterIndex });
};

// ---------------------------------------------------------------- cancel / edit

const PENDING = ['SCHEDULED', 'RETRYING', 'TOKEN_REFRESH'] as const;
/** DRAFT (aguardando aprovação) também é cancelável — só nunca teve job */
const CANCELLABLE = ['DRAFT', ...PENDING] as const;

export interface MutatePostDeps {
  publishing: PublishingRepository;
  channels: ChannelRepository;
  registry: ChannelProviderRegistry;
  scheduler: JobScheduler;
  /** presente = cancelar/editar rascunho revoga o link público pendente (o cliente
   *  não pode aprovar algo que mudou ou deixou de existir) */
  approvals?: ApprovalLinkRepository;
}

/** Cancela tudo que ainda não foi publicado; fencing por estado + versão mata jobs antigos. */
export const makeCancelPost = (deps: Pick<MutatePostDeps, 'publishing' | 'scheduler' | 'approvals'>) =>
  async (orgId: string, groupId: string) => {
    const group = await deps.publishing.getGroup(orgId, groupId);
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    for (const pub of group.publications) {
      if ((CANCELLABLE as readonly string[]).includes(pub.state)) {
        await deps.publishing.transition(pub.id, [...CANCELLABLE], 'CANCELLED', { bumpJobVersion: true });
        await deps.scheduler.cancelBySingletonKey(PUBLISH_QUEUE, pub.id).catch(() => {}); // higiene
      }
    }
    await deps.approvals?.revokePending(orgId, groupId);
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
    const isDraft = group.state === 'DRAFT';
    const pending = group.publications.filter((p) =>
      (isDraft ? (['DRAFT'] as readonly string[]) : (PENDING as readonly string[])).includes(p.state),
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

    if (isDraft) {
      // rascunho continua rascunho (a aprovação é quem agenda); editar invalida o
      // link pendente — o cliente não pode aprovar um conteúdo que não viu
      await deps.publishing.updateDraftGroup(input.orgId, input.groupId, {
        ...(text !== undefined ? { baseContent: { text } } : {}),
        ...(input.publishAt ? { publishAt: input.publishAt } : {}),
      });
      await deps.approvals?.revokePending(input.orgId, input.groupId);
      return deps.publishing.getGroup(input.orgId, input.groupId);
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

// ---------------------------------------------------------------- retry manual

/** Retry humano (kanban "tentar novamente"): FAILED e NEEDS_REVIEW voltam a SCHEDULED.
 *  NEEDS_REVIEW só entra aqui porque é ação humana explícita — o scanner NUNCA reposta
 *  às cegas (DECISIONS §7); quem clica confirma que olhou a rede antes. */
export const makeRetryPost = (deps: Pick<MutatePostDeps, 'publishing' | 'scheduler'>) =>
  async (input: { orgId: string; groupId: string; channelId?: string }) => {
    const group = await deps.publishing.getGroup(input.orgId, input.groupId);
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    const targets = group.publications.filter(
      (p) =>
        (p.state === 'FAILED' || p.state === 'NEEDS_REVIEW') &&
        (!input.channelId || p.channelId === input.channelId),
    );
    if (targets.length === 0) {
      throw new DomainError(ErrorCodes.PostInvalidTransition, 'nada falhado para repetir');
    }
    for (const pub of targets) {
      // versão capturada ANTES do bump; se outra corrida bumpar no meio, o job
      // com versão errada é no-op e o scanner recupera a SCHEDULED
      const v = pub.jobVersion + 1;
      const moved = await deps.publishing.transition(pub.id, ['FAILED', 'NEEDS_REVIEW'], 'SCHEDULED', {
        resetAttempts: true,
        bumpJobVersion: true,
        errorClass: null,
        errorMessage: null,
      });
      if (!moved) continue; // corrida com outro retry — o vencedor já enfileirou
      await deps.scheduler
        .enqueue(
          PUBLISH_QUEUE,
          { publicationId: pub.id, v },
          { singletonKey: `${pub.id}:v${v}` }, // retry publica imediatamente
        )
        .catch(() => {}); // scanner recupera
    }
    await deps.publishing.refreshGroupState(input.groupId);
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
