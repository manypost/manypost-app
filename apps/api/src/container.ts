import type { Env } from '@manypost/config';
import {
  createDb,
  makeApiKeyRepository,
  makeOrganizationRepository,
  makeSessionRepository,
  makeUserRepository,
} from '@manypost/db';
import {
  AesGcmCryptoService,
  makeCreateApiKey,
  makeListApiKeys,
  makeLogin,
  makeLogout,
  makeRefreshSession,
  makeRegister,
  makeRevokeApiKey,
  makeVerifyApiKey,
} from '@manypost/core';
import { bunPasswordHasher } from './infra/auth/password.hasher';
import { makeJwtSigner } from './infra/auth/token.signer';

export type Container = ReturnType<typeof buildContainer>;

/** Composition root (SPEC_BACKEND §3): fiação explícita, sem framework de DI. */
export function buildContainer(env: Env) {
  const db = createDb(env.DATABASE_URL);

  const repos = {
    users: makeUserRepository(db),
    orgs: makeOrganizationRepository(db),
    sessions: makeSessionRepository(db),
    apiKeys: makeApiKeyRepository(db),
  };

  const signer = makeJwtSigner(env.JWT_SECRET);
  const crypto = AesGcmCryptoService.fromHex(env.ENCRYPTION_KEY);
  const authDeps = { ...repos, hasher: bunPasswordHasher, signer };

  return {
    env,
    db,
    repos,
    signer,
    crypto,
    auth: {
      register: makeRegister(authDeps),
      login: makeLogin(authDeps),
      refresh: makeRefreshSession(authDeps),
      logout: makeLogout({ sessions: repos.sessions }),
      createApiKey: makeCreateApiKey({ apiKeys: repos.apiKeys }),
      listApiKeys: makeListApiKeys({ apiKeys: repos.apiKeys }),
      revokeApiKey: makeRevokeApiKey({ apiKeys: repos.apiKeys }),
      verifyApiKey: makeVerifyApiKey({ apiKeys: repos.apiKeys }),
    },
  };
}
