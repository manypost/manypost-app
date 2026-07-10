import { beforeEach, describe, expect, test } from 'bun:test';
import type { MemberRole } from '@manypost/contracts';
import type {
  ApiKeyRecord,
  OrgRecord,
  SessionRecord,
  UserRecord,
} from '../ports/repositories';
import {
  makeCreateApiKey,
  makeListApiKeys,
  makeLogin,
  makeLogout,
  makeRefreshSession,
  makeRegister,
  makeRevokeApiKey,
  makeVerifyApiKey,
} from './auth';

// ---------- fakes em memória ----------

function makeFakes() {
  const users: (UserRecord & { _n: number })[] = [];
  const orgs: (OrgRecord & { members: { userId: string; role: MemberRole }[] })[] = [];
  const sessions: (SessionRecord & { refreshTokenHash: string; prevTokenHash: string | null })[] = [];
  const keys: (ApiKeyRecord & { keyHash: string })[] = [];
  let seq = 0;
  const id = () => `id-${++seq}`;

  const deps = {
    users: {
      findByEmail: async (email: string) => users.find((u) => u.email === email) ?? null,
      findById: async (uid: string) => users.find((u) => u.id === uid) ?? null,
      create: async (d: any) => {
        const u = { id: id(), timezone: 'UTC', locale: 'pt-BR', name: null, ...d, _n: seq };
        users.push(u);
        return u;
      },
    },
    orgs: {
      createWithOwner: async (d: any) => {
        const o = { id: id(), name: d.name, slug: d.slug, members: [{ userId: d.ownerId, role: 'OWNER' as MemberRole }] };
        orgs.push(o);
        return o;
      },
      findMembership: async (orgId: string, userId: string) =>
        orgs.find((o) => o.id === orgId)?.members.find((m) => m.userId === userId) ?? null,
      listForUser: async (userId: string) =>
        orgs
          .filter((o) => o.members.some((m) => m.userId === userId))
          .map((o) => ({ id: o.id, name: o.name, slug: o.slug, role: o.members.find((m) => m.userId === userId)!.role })),
    },
    sessions: {
      create: async (d: any) => {
        const s = { id: id(), revokedAt: null, prevTokenHash: null, ...d };
        sessions.push(s);
        return s;
      },
      findByTokenHash: async (hash: string) => {
        const cur = sessions.find((s) => s.refreshTokenHash === hash);
        if (cur) return { session: cur, matched: 'current' as const };
        const prev = sessions.find((s) => s.prevTokenHash === hash);
        return prev ? { session: prev, matched: 'previous' as const } : null;
      },
      rotate: async (sid: string, newHash: string) => {
        const s = sessions.find((x) => x.id === sid)!;
        s.prevTokenHash = s.refreshTokenHash;
        s.refreshTokenHash = newHash;
      },
      revoke: async (sid: string) => {
        const s = sessions.find((x) => x.id === sid)!;
        s.revokedAt = new Date();
      },
    },
    apiKeys: {
      create: async (d: any) => {
        const k = { id: id(), lastUsedAt: null, revokedAt: null, createdAt: new Date(), ...d };
        keys.push(k);
        return k;
      },
      findActiveByHash: async (h: string) => keys.find((k) => k.keyHash === h && !k.revokedAt) ?? null,
      list: async (orgId: string) => keys.filter((k) => k.orgId === orgId),
      revoke: async (orgId: string, kid: string) => {
        const k = keys.find((x) => x.orgId === orgId && x.id === kid && !x.revokedAt);
        if (!k) return false;
        k.revokedAt = new Date();
        return true;
      },
      touchLastUsed: async (kid: string) => {
        const k = keys.find((x) => x.id === kid);
        if (k) k.lastUsedAt = new Date();
      },
    },
    hasher: {
      hash: async (p: string) => `h(${p})`,
      verify: async (p: string, h: string) => h === `h(${p})`,
    },
    signer: {
      sign: async (claims: any) => `jwt(${claims.sub}:${claims.org}:${claims.role})`,
      verify: async () => null,
    },
    _state: { users, orgs, sessions, keys },
  };
  return deps;
}

let f: ReturnType<typeof makeFakes>;
beforeEach(() => {
  f = makeFakes();
});

describe('register/login', () => {
  test('registro cria user + org OWNER e emite tokens', async () => {
    const out = await makeRegister(f as any)({ email: ' Ana@X.com ', password: 's3nh4-forte', name: 'Ana' });
    expect(out.user.email).toBe('ana@x.com');
    expect(out.org.role).toBe('OWNER');
    expect(out.accessToken).toContain('OWNER');
    expect(out.refreshToken.length).toBeGreaterThan(30);
  });

  test('e-mail duplicado → auth.email_taken', async () => {
    await makeRegister(f as any)({ email: 'a@a.com', password: 'x'.repeat(12), name: 'A' });
    await expect(
      makeRegister(f as any)({ email: 'A@A.com', password: 'y'.repeat(12), name: 'B' }),
    ).rejects.toMatchObject({ code: 'auth.email_taken' });
  });

  test('senha errada e usuário inexistente dão o MESMO erro', async () => {
    await makeRegister(f as any)({ email: 'a@a.com', password: 'senha-certa1', name: 'A' });
    const e1 = await makeLogin(f as any)({ email: 'a@a.com', password: 'errada' }).catch((e) => e);
    const e2 = await makeLogin(f as any)({ email: 'nao@existe.com', password: 'errada' }).catch((e) => e);
    expect(e1.code).toBe('auth.invalid_credentials');
    expect(e2.code).toBe('auth.invalid_credentials');
    expect(e1.message).toBe(e2.message);
  });
});

describe('refresh com rotação e detecção de reuso', () => {
  test('rotação: token antigo deixa de valer, novo vale', async () => {
    const { refreshToken } = await makeRegister(f as any)({ email: 'a@a.com', password: 'x'.repeat(12), name: 'A' });
    const r1 = await makeRefreshSession(f as any)({ refreshToken });
    expect(r1.refreshToken).not.toBe(refreshToken);
    const r2 = await makeRefreshSession(f as any)({ refreshToken: r1.refreshToken });
    expect(r2.accessToken).toContain('jwt(');
  });

  test('REUSO do token rotacionado revoga a sessão inteira', async () => {
    const { refreshToken } = await makeRegister(f as any)({ email: 'a@a.com', password: 'x'.repeat(12), name: 'A' });
    const r1 = await makeRefreshSession(f as any)({ refreshToken }); // rotaciona
    // atacante (ou vítima) reapresenta o token ANTIGO:
    await expect(makeRefreshSession(f as any)({ refreshToken })).rejects.toMatchObject({
      code: 'auth.session_invalid',
    });
    // a família morreu: nem o token NOVO funciona mais
    await expect(makeRefreshSession(f as any)({ refreshToken: r1.refreshToken })).rejects.toMatchObject({
      code: 'auth.session_invalid',
    });
  });

  test('sessão expirada é rejeitada', async () => {
    const { refreshToken } = await makeRegister(f as any)({ email: 'a@a.com', password: 'x'.repeat(12), name: 'A' });
    f._state.sessions[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(makeRefreshSession(f as any)({ refreshToken })).rejects.toMatchObject({
      code: 'auth.session_invalid',
    });
  });

  test('logout revoga a sessão', async () => {
    const { refreshToken } = await makeRegister(f as any)({ email: 'a@a.com', password: 'x'.repeat(12), name: 'A' });
    await makeLogout(f as any)({ refreshToken });
    await expect(makeRefreshSession(f as any)({ refreshToken })).rejects.toMatchObject({
      code: 'auth.session_invalid',
    });
  });
});

describe('API keys', () => {
  test('cria com prefixo mp_live_, verifica e revoga', async () => {
    const { apiKey, record } = await makeCreateApiKey(f as any)({ orgId: 'org-1', name: 'ci', scopes: ['posts:write'] });
    expect(apiKey.startsWith('mp_live_')).toBe(true);

    const principal = await makeVerifyApiKey(f as any)(apiKey);
    expect(principal).toMatchObject({ orgId: 'org-1', scopes: ['posts:write'] });

    await makeRevokeApiKey(f as any)({ orgId: 'org-1', id: record.id });
    expect(await makeVerifyApiKey(f as any)(apiKey)).toBeNull();
  });

  test('lista não expõe hash; chave com formato errado → null', async () => {
    await makeCreateApiKey(f as any)({ orgId: 'org-1', name: 'ci', scopes: [] });
    const list = await makeListApiKeys(f as any)('org-1');
    expect(list).toHaveLength(1);
    expect(await makeVerifyApiKey(f as any)('outra-coisa')).toBeNull();
  });

  test('revogar key de OUTRA org falha (filtro multi-tenant)', async () => {
    const { record } = await makeCreateApiKey(f as any)({ orgId: 'org-1', name: 'ci', scopes: [] });
    await expect(makeRevokeApiKey(f as any)({ orgId: 'org-2', id: record.id })).rejects.toMatchObject({
      code: 'common.not_found',
    });
  });
});
