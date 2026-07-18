import { providerSecretsFromEnv, type Env } from '@manypost/config';
import {
  createDb,
  makeApiKeyRepository,
  makeApprovalLinkRepository,
  makeAuditLogRepository,
  makeAuthIdentityRepository,
  makeChannelRepository,
  makeMediaRepository,
  makeNotificationRepository,
  makeOrganizationRepository,
  makePublishingRepository,
  makeSessionRepository,
  makeUserRepository,
  makeWebhookRepository,
} from '@manypost/db';
import {
  AesGcmCryptoService,
  makeCancelPost,
  makeConnectChannel,
  makeCreateApiKey,
  makeCreateApprovalLink,
  makeCreateWebhook,
  makeDeleteMedia,
  makeDeleteWebhook,
  makeDisconnectChannel,
  makeGetApprovalLinkStatus,
  makeGetApprovalPreview,
  makeIngestMediaFromUrl,
  makeListApiKeys,
  makeListChannels,
  makeListMedia,
  makeListSubAccounts,
  makeListWebhooks,
  makeLogin,
  makeLoginWithIdentity,
  makeLogout,
  makeRefreshSession,
  makeRegister,
  makeReschedulePost,
  makeResolveApproval,
  makeRetryPost,
  makeRevokeApiKey,
  makeRevokeApprovalLink,
  makeSchedulePost,
  makeSetMediaAlt,
  makeUploadMedia,
  makeVerifyApiKey,
} from '@manypost/core';
import { providerRegistry } from '@manypost/providers';
import { createPublishingRuntime } from '@manypost/queue';
import { bunPasswordHasher } from './infra/auth/password.hasher';
import { makeJwtSigner } from './infra/auth/token.signer';
import { createPrometheusMetrics } from './infra/metrics/prometheus';
import { makeLocalMediaStorage } from './infra/storage/local.storage';

export type Container = Awaited<ReturnType<typeof buildContainer>>;

/** Composition root (SPEC_BACKEND §3): fiação explícita, sem framework de DI. */
export async function buildContainer(env: Env) {
  const db = createDb(env.DATABASE_URL);

  const repos = {
    users: makeUserRepository(db),
    orgs: makeOrganizationRepository(db),
    sessions: makeSessionRepository(db),
    apiKeys: makeApiKeyRepository(db),
    identities: makeAuthIdentityRepository(db),
    channels: makeChannelRepository(db),
    publishing: makePublishingRepository(db),
    webhooks: makeWebhookRepository(db),
    media: makeMediaRepository(db),
    approvals: makeApprovalLinkRepository(db),
    audit: makeAuditLogRepository(db),
    notifications: makeNotificationRepository(db),
  };

  if (env.STORAGE_PROVIDER !== 'local') {
    throw new Error('STORAGE_PROVIDER=s3 ainda não implementado — use local (S3/R2 vem com a onda 2)');
  }
  const storage = makeLocalMediaStorage({ dir: env.UPLOAD_DIR, publicBaseUrl: env.PUBLIC_URL });
  const mediaLimits = {
    imageMaxBytes: env.MEDIA_MAX_IMAGE_MB * 1024 * 1024,
    videoMaxBytes: env.MEDIA_MAX_VIDEO_MB * 1024 * 1024,
  };
  const mediaDeps = { media: repos.media, storage, limits: mediaLimits };

  const signer = makeJwtSigner(env.JWT_SECRET);
  const crypto = AesGcmCryptoService.fromHex(env.ENCRYPTION_KEY);
  const authDeps = { ...repos, hasher: bunPasswordHasher, signer };

  // secrets de app por provider (SPEC_INTEGRATIONS §2): env → ctx.secrets;
  // provider indisponível quando faltam os requiredSecrets dele
  const providerSecrets = providerSecretsFromEnv(env);

  // métricas Prometheus (SPEC_INFRA §4): o sink alimenta publish/recover; a apps/api expõe /metrics
  const metrics = createPrometheusMetrics();

  const runtime = await createPublishingRuntime({
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    publishing: repos.publishing,
    channels: repos.channels,
    webhooks: repos.webhooks,
    registry: providerRegistry,
    crypto,
    retryBaseSec: env.PUBLISH_RETRY_BASE_SEC,
    allowPrivateWebhookUrls: env.WEBHOOKS_ALLOW_PRIVATE,
    providerSecrets,
    metrics: metrics.sink,
  });

  return {
    env,
    db,
    repos,
    signer,
    crypto,
    storage,
    registry: providerRegistry,
    providerSecrets,
    metrics,
    runtime,
    media: {
      upload: makeUploadMedia(mediaDeps),
      fromUrl: makeIngestMediaFromUrl({
        ...mediaDeps,
        allowPrivateUrls: env.MEDIA_ALLOW_PRIVATE_URLS,
      }),
      list: makeListMedia(mediaDeps),
      setAlt: makeSetMediaAlt(mediaDeps),
      remove: makeDeleteMedia(mediaDeps),
    },
    channels: {
      connect: makeConnectChannel({ channels: repos.channels, crypto }),
      list: makeListChannels({ channels: repos.channels }),
      disconnect: makeDisconnectChannel({ channels: repos.channels }),
      listSubAccounts: makeListSubAccounts({ channels: repos.channels, crypto }),
    },
    posts: {
      schedule: makeSchedulePost({
        channels: repos.channels,
        publishing: repos.publishing,
        registry: providerRegistry,
        scheduler: runtime.scheduler,
        media: repos.media,
        storage,
        events: runtime.events,
      }),
      getGroup: (orgId: string, groupId: string) => repos.publishing.getGroup(orgId, groupId),
      // sem orgId de propósito: só chamar com ids vindos de um getGroup org-scoped (como o preview de aprovação)
      listItems: (publicationId: string) => repos.publishing.listItems(publicationId),
      feed: repos.publishing.listPublicationsFeed,
      retry: makeRetryPost({ publishing: repos.publishing, scheduler: runtime.scheduler }),
      cancel: makeCancelPost({
        publishing: repos.publishing,
        scheduler: runtime.scheduler,
        approvals: repos.approvals,
      }),
      reschedule: makeReschedulePost({
        publishing: repos.publishing,
        channels: repos.channels,
        registry: providerRegistry,
        scheduler: runtime.scheduler,
        approvals: repos.approvals,
      }),
    },
    approvals: {
      createLink: makeCreateApprovalLink({
        approvals: repos.approvals,
        publishing: repos.publishing,
        audit: repos.audit,
      }),
      revokeLink: makeRevokeApprovalLink({ approvals: repos.approvals, audit: repos.audit }),
      linkStatus: makeGetApprovalLinkStatus({ approvals: repos.approvals }),
      preview: makeGetApprovalPreview({
        approvals: repos.approvals,
        publishing: repos.publishing,
        channels: repos.channels,
      }),
      resolve: makeResolveApproval({
        approvals: repos.approvals,
        publishing: repos.publishing,
        scheduler: runtime.scheduler,
        audit: repos.audit,
        notifications: repos.notifications,
        events: runtime.events,
        ...(runtime.realtime ? { realtime: runtime.realtime } : {}),
      }),
    },
    notifications: {
      list: (orgId: string) => repos.notifications.list(orgId),
      markRead: repos.notifications.markRead,
      markAllRead: repos.notifications.markAllRead,
    },
    webhooks: {
      create: makeCreateWebhook({
        webhooks: repos.webhooks,
        crypto,
        allowPrivateUrls: env.WEBHOOKS_ALLOW_PRIVATE,
      }),
      list: makeListWebhooks({ webhooks: repos.webhooks }),
      remove: makeDeleteWebhook({ webhooks: repos.webhooks }),
    },
    auth: {
      register: makeRegister(authDeps),
      login: makeLogin(authDeps),
      loginWithIdentity: makeLoginWithIdentity({ ...authDeps, identities: repos.identities }),
      refresh: makeRefreshSession(authDeps),
      logout: makeLogout({ sessions: repos.sessions }),
      createApiKey: makeCreateApiKey({ apiKeys: repos.apiKeys }),
      listApiKeys: makeListApiKeys({ apiKeys: repos.apiKeys }),
      revokeApiKey: makeRevokeApiKey({ apiKeys: repos.apiKeys }),
      verifyApiKey: makeVerifyApiKey({ apiKeys: repos.apiKeys }),
    },
  };
}
