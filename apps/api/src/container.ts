import {
  aiConfigFromEnv,
  clerkConfig,
  isBillingEnabled,
  mediaStorageConfigFromEnv,
  providerSecretsFromEnv,
  type Env,
} from '@manypost/config';
import {
  createDb,
  makeAiCreditsRepository,
  makeApiKeyRepository,
  makeApprovalLinkRepository,
  makeAuditLogRepository,
  makeAuthIdentityRepository,
  makeChannelRepository,
  makeMediaRepository,
  makeNotificationRepository,
  makeOAuthAppRepository,
  makeOAuthGrantRepository,
  makeOrganizationRepository,
  makePublishingRepository,
  makeSubscriptionRepository,
  makeUserRepository,
  makeWebhookRepository,
} from '@manypost/db';
import {
  AesGcmCryptoService,
  makeAiProvider,
  makeBudgetGuard,
  makeDraftMultichannel,
  makeGenerateAltText,
  makeGenerateCaption,
  makePlanWeek,
  makeRewriteText,
  makeSuggestBestTimes,
  makeSummarizeInsights,
  makeSuggestHashtags,
  type AiDeps,
  makeApplyRemoteSubscription,
  makeCancelPost,
  makeCancelSubscription,
  makeConnectChannel,
  makeCreateApiKey,
  makeCreateApprovalLink,
  makeCreateWebhook,
  makeDeleteMedia,
  makeDeleteWebhook,
  makeDisconnectChannel,
  makeEnsureStaticMcpClient,
  makeExchangeAuthorizationCode,
  makeApproveAuthorization,
  makeGetApprovalLinkStatus,
  makeGetApprovalPreview,
  makeGetBilling,
  makeIngestMediaFromUrl,
  makeMediaStorage,
  makeListApiKeys,
  makeListChannels,
  makeListInvoices,
  makeListMedia,
  makeListSubAccounts,
  makeListWebhooks,
  makeOpenBillingPortal,
  makePlanUsageReader,
  makePreviewPlanChange,
  makeRefreshOAuthToken,
  makeRegisterPublicClient,
  makeRemoveSubscription,
  makeReschedulePost,
  makeResolveIdentityPrincipal,
  makeResolveOAuthClient,
  makeResolveApproval,
  makeRetryPost,
  makeRevokeApiKey,
  makeRevokeApprovalLink,
  makeSaasPlanPolicy,
  makeSchedulePost,
  makeSelfHostedPlanPolicy,
  makeSetMediaAlt,
  makeStartCheckout,
  makeSyncSubscription,
  makeUploadMedia,
  makeVerifyApiKey,
  makeVerifyOAuthAccessToken,
  type BillingDeps,
} from '@manypost/core';
import { providerRegistry } from '@manypost/providers';
import { createPublishingRuntime } from '@manypost/queue';
import { makeStripeGateway, type StripeGateway } from './infra/billing/stripe.gateway';
import { makeClerkIdentityVerifier } from './infra/identity/clerk.identity';
import { createPrometheusMetrics } from './infra/metrics/prometheus';

export type Container = Awaited<ReturnType<typeof buildContainer>>;

/** Cobrança do gerenciado — `null` em self-hosted (as rotas nem são montadas). */
interface BillingBundle {
  get: ReturnType<typeof makeGetBilling>;
  checkout: ReturnType<typeof makeStartCheckout>;
  preview: ReturnType<typeof makePreviewPlanChange>;
  portal: ReturnType<typeof makeOpenBillingPortal>;
  cancel: ReturnType<typeof makeCancelSubscription>;
  invoices: ReturnType<typeof makeListInvoices>;
  sync: ReturnType<typeof makeSyncSubscription>;
  applyRemote: ReturnType<typeof makeApplyRemoteSubscription>;
  removeRemote: ReturnType<typeof makeRemoveSubscription>;
  constructEvent: StripeGateway['constructEvent'];
}

/** Composition root (SPEC_BACKEND §3): fiação explícita, sem framework de DI. */
export async function buildContainer(env: Env) {
  const db = createDb(env.DATABASE_URL);

  const repos = {
    users: makeUserRepository(db),
    orgs: makeOrganizationRepository(db),
    apiKeys: makeApiKeyRepository(db),
    oauthApps: makeOAuthAppRepository(db),
    oauthGrants: makeOAuthGrantRepository(db),
    identities: makeAuthIdentityRepository(db),
    channels: makeChannelRepository(db),
    publishing: makePublishingRepository(db),
    webhooks: makeWebhookRepository(db),
    media: makeMediaRepository(db),
    approvals: makeApprovalLinkRepository(db),
    audit: makeAuditLogRepository(db),
    aiCredits: makeAiCreditsRepository(db),
    notifications: makeNotificationRepository(db),
    subscriptions: makeSubscriptionRepository(db),
  };

  // Fronteira Community × Cloud (DECISIONS §15): sem Stripe configurada, o PlanPolicy
  // libera tudo e as rotas de billing nem sequer são montadas (main.ts).
  const billingEnabled = isBillingEnabled(env);
  const planUsage = makePlanUsageReader({
    channels: repos.channels,
    publishing: repos.publishing,
    webhooks: repos.webhooks,
    apiKeys: repos.apiKeys,
  });
  const plan = billingEnabled
    ? makeSaasPlanPolicy({ subscriptions: repos.subscriptions, usage: planUsage })
    : makeSelfHostedPlanPolicy({ usage: planUsage });

  // local (volume) ou bucket S3-compatível — a escolha vem do MESMO mapeamento que o worker usa
  const storage = makeMediaStorage(mediaStorageConfigFromEnv(env));
  const mediaLimits = {
    imageMaxBytes: env.MEDIA_MAX_IMAGE_MB * 1024 * 1024,
    videoMaxBytes: env.MEDIA_MAX_VIDEO_MB * 1024 * 1024,
  };
  const mediaDeps = { media: repos.media, storage, limits: mediaLimits };

  const crypto = AesGcmCryptoService.fromHex(env.ENCRYPTION_KEY);
  const clerk = clerkConfig(env);
  const clerkIdentity = makeClerkIdentityVerifier({
    secretKey: clerk.secretKey,
    jwtKey: clerk.jwtKey,
    authorizedParties: clerk.authorizedParties,
  });
  const resolveIdentityPrincipal = makeResolveIdentityPrincipal({
    users: repos.users,
    orgs: repos.orgs,
    identities: repos.identities,
  });
  const authenticateHuman = async (token: string) => {
    const verified = await clerkIdentity(token);
    const resolved = await resolveIdentityPrincipal(verified);
    return {
      userId: resolved.user.id,
      orgId: resolved.org.id,
      role: resolved.org.role,
    };
  };

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
    // resolução de mediaSettings no publish (ex.: miniatura do YouTube: id → URL pública)
    media: repos.media,
    storage,
    metrics: metrics.sink,
  });

  // Adapter Stripe + use-cases de cobrança — só existem no gerenciado.
  let billing: BillingBundle | null = null;
  if (billingEnabled) {
    const gateway = makeStripeGateway({
      secretKey: env.STRIPE_SECRET_KEY!,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    });
    const deps: BillingDeps = {
      gateway,
      subscriptions: repos.subscriptions,
      orgs: repos.orgs,
      users: repos.users,
      channels: repos.channels,
      plan,
      audit: repos.audit,
      appUrl: env.PUBLIC_URL,
      trialDays: env.BILLING_TRIAL_DAYS,
    };
    billing = {
      get: makeGetBilling({ plan, subscriptions: repos.subscriptions }),
      checkout: makeStartCheckout(deps),
      preview: makePreviewPlanChange(deps),
      portal: makeOpenBillingPortal(deps),
      cancel: makeCancelSubscription(deps),
      invoices: makeListInvoices(deps),
      sync: makeSyncSubscription(deps),
      applyRemote: makeApplyRemoteSubscription(deps),
      removeRemote: makeRemoveSubscription(deps),
      constructEvent: gateway.constructEvent,
    };
  }

  // IA (SPEC_AI §2): sem AI_PROVIDER a instalação não tem IA — `ai` fica null e as rotas
  // respondem `capability.disabled`, com a UI escondendo a superfície inteira. O BudgetGuard,
  // porém, é montado sempre: o mecanismo de teto é arquitetura, não feature (DECISIONS v1 §8).
  const budget = makeBudgetGuard({ credits: repos.aiCredits, plan });
  const aiProvider = makeAiProvider(aiConfigFromEnv(env));
  const ai = aiProvider
    ? (() => {
        const deps: AiDeps = {
          provider: aiProvider,
          budget,
          plan,
          channels: repos.channels,
          registry: providerRegistry,
          media: repos.media,
          storage,
          audit: repos.audit,
        };
        return {
          caption: makeGenerateCaption(deps),
          rewrite: makeRewriteText(deps),
          hashtags: makeSuggestHashtags(deps),
          altText: makeGenerateAltText(deps),
          draft: makeDraftMultichannel(deps),
          weekPlan: makePlanWeek(deps),
          /** o adapter vê imagem? define se o alt-text aparece na UI */
          canDescribeImages: Boolean(aiProvider.describeImage),
        };
      })()
    : null;

  return {
    env,
    db,
    repos,
    budget,
    ai,
    // resumo operacional da home: contagens agregadas do nosso próprio registro (sem métrica
    // de desempenho — `channel_metrics` está vazia porque nada escreve nela)
    insights: makeSummarizeInsights({
      publishing: repos.publishing,
      channels: repos.channels,
    }),
    // heurística, não modelo: existe mesmo sem AI_PROVIDER e não consome franquia (SPEC_AI §3)
    bestTimes: makeSuggestBestTimes({
      publishing: repos.publishing,
      channels: repos.channels,
      registry: providerRegistry,
      plan,
    }),
    clerkIdentity,
    crypto,
    storage,
    registry: providerRegistry,
    providerSecrets,
    metrics,
    runtime,
    plan,
    billing,
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
      connect: makeConnectChannel({ channels: repos.channels, crypto, plan }),
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
        plan,
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
        plan,
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
        plan,
      }),
      list: makeListWebhooks({ webhooks: repos.webhooks }),
      remove: makeDeleteWebhook({ webhooks: repos.webhooks }),
    },
    auth: {
      authenticateHuman,
      createApiKey: makeCreateApiKey({ apiKeys: repos.apiKeys, plan }),
      listApiKeys: makeListApiKeys({ apiKeys: repos.apiKeys }),
      revokeApiKey: makeRevokeApiKey({ apiKeys: repos.apiKeys }),
      verifyApiKey: makeVerifyApiKey({ apiKeys: repos.apiKeys }),
    },
    oauth: {
      ensureStaticClient: makeEnsureStaticMcpClient({ apps: repos.oauthApps }),
      resolveClient: makeResolveOAuthClient({ apps: repos.oauthApps }),
      registerPublicClient: makeRegisterPublicClient({ apps: repos.oauthApps }),
      approveAuthorization: makeApproveAuthorization({
        apps: repos.oauthApps,
        grants: repos.oauthGrants,
      }),
      exchangeCode: makeExchangeAuthorizationCode({
        apps: repos.oauthApps,
        grants: repos.oauthGrants,
      }),
      refresh: makeRefreshOAuthToken({ grants: repos.oauthGrants }),
      verifyAccessToken: makeVerifyOAuthAccessToken({ grants: repos.oauthGrants }),
    },
  };
}
