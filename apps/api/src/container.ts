import type { Env } from '@manypost/config';
import {
  createDb,
  makeApiKeyRepository,
  makeAuthIdentityRepository,
  makeChannelRepository,
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
  makeCreateWebhook,
  makeDeleteWebhook,
  makeDisconnectChannel,
  makeListApiKeys,
  makeListChannels,
  makeListWebhooks,
  makeLogin,
  makeLoginWithIdentity,
  makeLogout,
  makeRefreshSession,
  makeRegister,
  makeReschedulePost,
  makeRevokeApiKey,
  makeSchedulePost,
  makeVerifyApiKey,
} from '@manypost/core';
import { providerRegistry } from '@manypost/providers';
import { createPublishingRuntime } from '@manypost/queue';
import { bunPasswordHasher } from './infra/auth/password.hasher';
import { makeJwtSigner } from './infra/auth/token.signer';

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
  };

  const signer = makeJwtSigner(env.JWT_SECRET);
  const crypto = AesGcmCryptoService.fromHex(env.ENCRYPTION_KEY);
  const authDeps = { ...repos, hasher: bunPasswordHasher, signer };

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
  });

  return {
    env,
    db,
    repos,
    signer,
    crypto,
    registry: providerRegistry,
    runtime,
    channels: {
      connect: makeConnectChannel({ channels: repos.channels, crypto }),
      list: makeListChannels({ channels: repos.channels }),
      disconnect: makeDisconnectChannel({ channels: repos.channels }),
    },
    posts: {
      schedule: makeSchedulePost({
        channels: repos.channels,
        publishing: repos.publishing,
        registry: providerRegistry,
        scheduler: runtime.scheduler,
      }),
      getGroup: (orgId: string, groupId: string) => repos.publishing.getGroup(orgId, groupId),
      cancel: makeCancelPost({ publishing: repos.publishing, scheduler: runtime.scheduler }),
      reschedule: makeReschedulePost({
        publishing: repos.publishing,
        channels: repos.channels,
        registry: providerRegistry,
        scheduler: runtime.scheduler,
      }),
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
