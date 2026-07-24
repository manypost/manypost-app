import { beforeEach, describe, expect, test } from 'bun:test';
import type { MemberRole } from '@manypost/contracts';
import type { ApiKeyRecord, OrgRecord, UserRecord } from '../ports/repositories';
import {
  makeCreateApiKey,
  makeListApiKeys,
  makeResolveIdentityPrincipal,
  makeRevokeApiKey,
  makeVerifyApiKey,
  type SocialProfile,
} from './auth';

function makeFakes() {
  const users: UserRecord[] = [];
  const orgs: (OrgRecord & { members: { userId: string; role: MemberRole }[] })[] = [];
  const keys: (ApiKeyRecord & { keyHash: string })[] = [];
  const identities: {
    userId: string;
    provider: string;
    providerUserId: string;
    email: string | null;
  }[] = [];
  let sequence = 0;
  const id = () => `id-${++sequence}`;

  const deps = {
    users: {
      findByEmail: async (email: string) => users.find((user) => user.email === email) ?? null,
      findById: async (userId: string) => users.find((user) => user.id === userId) ?? null,
      create: async (data: Omit<UserRecord, 'id' | 'timezone' | 'locale'>) => {
        const user = { id: id(), timezone: 'UTC', locale: 'pt-BR', ...data };
        users.push(user);
        return user;
      },
      updateAvatarIfEmpty: async (userId: string, avatarUrl: string) => {
        const user = users.find((candidate) => candidate.id === userId);
        if (user && !user.avatarUrl) user.avatarUrl = avatarUrl;
      },
    },
    identities: {
      find: async (provider: string, providerUserId: string) =>
        identities.find(
          (identity) =>
            identity.provider === provider && identity.providerUserId === providerUserId,
        ) ?? null,
      resolveOrProvision: async (data: {
        provider: string;
        providerUserId: string;
        email: string;
        name: string | null;
        avatarUrl: string | null;
        orgName: string;
        orgSlug: string;
      }) => {
        const linked = identities.find(
          (identity) =>
            identity.provider === data.provider &&
            identity.providerUserId === data.providerUserId,
        );
        if (linked) return { userId: linked.userId, isNewUser: false };

        let user = users.find((candidate) => candidate.email === data.email);
        const isNewUser = !user;
        if (!user) {
          user = {
            id: id(),
            email: data.email,
            passwordHash: null,
            name: data.name,
            avatarUrl: data.avatarUrl,
            timezone: 'UTC',
            locale: 'pt-BR',
          };
          users.push(user);
          orgs.push({
            id: id(),
            name: data.orgName,
            slug: data.orgSlug,
            members: [{ userId: user.id, role: 'OWNER' }],
          });
        }
        identities.push({
          userId: user.id,
          provider: data.provider,
          providerUserId: data.providerUserId,
          email: data.email,
        });
        return { userId: user.id, isNewUser };
      },
    },
    orgs: {
      createWithOwner: async () => {
        throw new Error('não usado');
      },
      findMembership: async () => null,
      listForUser: async (userId: string) =>
        orgs
          .filter((org) => org.members.some((member) => member.userId === userId))
          .map((org) => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            role: org.members.find((member) => member.userId === userId)!.role,
          })),
    },
    apiKeys: {
      create: async (data: Omit<ApiKeyRecord, 'id' | 'lastUsedAt' | 'revokedAt' | 'createdAt'> & {
        keyHash: string;
      }) => {
        const key = {
          id: id(),
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date(),
          ...data,
        };
        keys.push(key);
        return key;
      },
      findActiveByHash: async (hash: string) =>
        keys.find((key) => key.keyHash === hash && !key.revokedAt) ?? null,
      list: async (orgId: string) => keys.filter((key) => key.orgId === orgId),
      revoke: async (orgId: string, keyId: string) => {
        const key = keys.find(
          (candidate) =>
            candidate.orgId === orgId && candidate.id === keyId && !candidate.revokedAt,
        );
        if (!key) return false;
        key.revokedAt = new Date();
        return true;
      },
      touchLastUsed: async (keyId: string) => {
        const key = keys.find((candidate) => candidate.id === keyId);
        if (key) key.lastUsedAt = new Date();
      },
    },
    _state: { users, orgs, keys, identities },
  };
  return deps;
}

const profile = (overrides: Partial<SocialProfile> = {}): SocialProfile => ({
  provider: 'clerk',
  providerUserId: 'user_clerk_1',
  email: 'ana@example.test',
  emailVerified: true,
  name: 'Ana',
  avatarUrl: 'https://example.test/ana.png',
  ...overrides,
});

let fakes: ReturnType<typeof makeFakes>;
beforeEach(() => {
  fakes = makeFakes();
});

describe('identidade Clerk e autorização Manypost', () => {
  test('provisiona usuário, organização OWNER e identidade sem sessão interna', async () => {
    const out = await makeResolveIdentityPrincipal(fakes as never)({
      providerUserId: 'user_clerk_1',
      loadProfile: async () => profile(),
    });

    expect(out.isNewUser).toBe(true);
    expect(out.org.role).toBe('OWNER');
    expect(out.user.avatarUrl).toBe('https://example.test/ana.png');
    expect(fakes._state.identities).toHaveLength(1);
    expect(fakes._state).not.toHaveProperty('sessions');
  });

  test('requisições repetidas não duplicam identidade nem tenant', async () => {
    const resolve = makeResolveIdentityPrincipal(fakes as never);
    const [first, second] = await Promise.all([
      resolve({ providerUserId: 'user_clerk_1', loadProfile: async () => profile() }),
      resolve({ providerUserId: 'user_clerk_1', loadProfile: async () => profile() }),
    ]);

    expect([first.isNewUser, second.isNewUser].filter(Boolean)).toHaveLength(1);
    expect(fakes._state.users).toHaveLength(1);
    expect(fakes._state.orgs).toHaveLength(1);
    expect(fakes._state.identities).toHaveLength(1);
  });

  test('vincula por e-mail verificado e preserva avatar escolhido', async () => {
    fakes._state.users.push({
      id: 'existing-user',
      email: 'ana@example.test',
      passwordHash: 'historical-hash',
      name: 'Ana existente',
      avatarUrl: 'https://example.test/chosen.png',
      timezone: 'UTC',
      locale: 'pt-BR',
    });
    fakes._state.orgs.push({
      id: 'existing-org',
      name: 'Existente',
      slug: 'existente',
      members: [{ userId: 'existing-user', role: 'ADMIN' }],
    });

    const out = await makeResolveIdentityPrincipal(fakes as never)({
      providerUserId: 'user_clerk_1',
      loadProfile: async () => profile(),
    });

    expect(out.isNewUser).toBe(false);
    expect(out.org.role).toBe('ADMIN');
    expect(out.user.avatarUrl).toBe('https://example.test/chosen.png');
  });

  test('não provisiona por e-mail não verificado', async () => {
    await expect(
      makeResolveIdentityPrincipal(fakes as never)({
        providerUserId: 'user_clerk_1',
        loadProfile: async () => profile({ emailVerified: false }),
      }),
    ).rejects.toMatchObject({ code: 'auth.social_email_unverified' });
    expect(fakes._state.users).toHaveLength(0);
  });

  test('identidade já vinculada não consulta novamente o perfil remoto', async () => {
    const resolve = makeResolveIdentityPrincipal(fakes as never);
    await resolve({
      providerUserId: 'user_clerk_1',
      loadProfile: async () => profile(),
    });

    const existing = await resolve({
      providerUserId: 'user_clerk_1',
      loadProfile: async () => {
        throw new Error('Clerk Backend API não deveria ser consultada');
      },
    });

    expect(existing.user.email).toBe('ana@example.test');
    expect(existing.org.role).toBe('OWNER');
  });
});

describe('API keys', () => {
  test('cria, verifica, lista e revoga sem expor hash', async () => {
    const { apiKey, record } = await makeCreateApiKey(fakes as never)({
      orgId: 'org-1',
      name: 'ci',
      scopes: ['posts:write'],
    });
    expect(apiKey.startsWith('mp_live_')).toBe(true);
    expect(await makeVerifyApiKey(fakes as never)(apiKey)).toMatchObject({
      orgId: 'org-1',
      scopes: ['posts:write'],
    });
    expect(await makeListApiKeys(fakes as never)('org-1')).toHaveLength(1);

    await makeRevokeApiKey(fakes as never)({ orgId: 'org-1', id: record.id });
    expect(await makeVerifyApiKey(fakes as never)(apiKey)).toBeNull();
  });

  test('não revoga chave de outra organização', async () => {
    const { record } = await makeCreateApiKey(fakes as never)({
      orgId: 'org-1',
      name: 'ci',
      scopes: [],
    });
    await expect(
      makeRevokeApiKey(fakes as never)({ orgId: 'org-2', id: record.id }),
    ).rejects.toMatchObject({ code: 'common.not_found' });
  });
});
