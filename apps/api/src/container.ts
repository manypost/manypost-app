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
} from '@manypost/db';
import {
  AesGcmCryptoService,
  makeConnectChannel,
  makeCreateApiKey,
  makeDisconnectChannel,
  makeListApiKeys,
  makeListChannels,
  makeLogin,
  makeLoginWithIdentity,
  makeLogout,
  makeRefreshSession,
  makeRegister,
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
  };

  const signer = makeJwtSigner(env.JWT_SECRET);
  const crypto = AesGcmCryptoService.fromHex(env.ENCRYPTION_KEY);
  const authDeps = { ...repos, hasher: bunPasswordHasher, signer };

  const runtime = await createPublishingRuntime({
    databaseUrl: env.DATABASE_URL,
    publishing: repos.publishing,
    channels: repos.channels,
    registry: providerRegistry,
    crypto,
    retryBaseSec: env.PUBLISH_RETRY_BASE_SEC,
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
