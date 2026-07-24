import { describe, expect, it } from 'bun:test';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, type SocialProfile } from '@manypost/core';
import type { Container } from '../../container';
import { errorHandler } from '../middleware/error';
import { authRoutes } from './auth.routes';

const profile: SocialProfile = {
  provider: 'clerk',
  providerUserId: 'user_clerk_1',
  email: 'ada@example.test',
  emailVerified: true,
  name: 'Ada Lovelace',
  avatarUrl: null,
};

function makeApp(input?: {
  verify?: (token: string) => Promise<SocialProfile>;
  onLogin?: (value: unknown) => void;
  onLegacy?: () => void;
}) {
  const ctn = {
    env: { PUBLIC_URL: 'https://app.manypost.com.br' },
    clerkIdentity: input?.verify ?? (async () => profile),
    auth: {
      register: async () => {
        input?.onLegacy?.();
        throw new Error('legacy register não deveria ser chamado');
      },
      login: async () => {
        input?.onLegacy?.();
        throw new Error('legacy login não deveria ser chamado');
      },
      loginWithIdentity: async (value: unknown) => {
        input?.onLogin?.(value);
        return {
          user: {
            id: 'internal-user',
            email: 'ada@example.test',
            name: 'Ada Lovelace',
            avatarUrl: null,
          },
          org: { id: 'org-1', name: 'Ada', slug: 'ada', role: 'OWNER' },
          accessToken: 'internal-access',
          refreshToken: 'internal-refresh',
          isNewUser: false,
        };
      },
    },
  } as unknown as Container;
  const app = authRoutes(ctn);
  app.onError(errorHandler);
  return app;
}

describe('POST /clerk/exchange', () => {
  it('recusa requisição sem bearer token sem chamar o login interno', async () => {
    let called = false;
    const res = await makeApp({ onLogin: () => (called = true) }).request('/clerk/exchange', {
      method: 'POST',
    });

    expect(res.status).toBe(401);
    expect(called).toBe(false);
    expect((await res.json()) as { title: string }).toMatchObject({
      title: ErrorCodes.AuthUnauthorized,
    });
  });

  it('troca identidade verificada e ignora tenant controlado pelo browser', async () => {
    const calls: unknown[] = [];
    const app = makeApp({
      verify: async (token) => {
        calls.push({ token });
        return profile;
      },
      onLogin: (value) => calls.push(value),
    });
    const res = await app.request('/clerk/exchange', {
      method: 'POST',
      headers: {
        authorization: 'Bearer clerk-session',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        orgId: 'attacker-org',
        role: 'OWNER',
        userId: 'attacker-user',
      }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()) as { isNewUser: boolean }).toMatchObject({ isNewUser: false });
    expect(calls).toEqual([
      { token: 'clerk-session' },
      {
        profile,
        userAgent: undefined,
        ip: undefined,
      },
    ]);
    expect(res.headers.getSetCookie().join('\n')).toContain('mp_at=internal-access');
    expect(res.headers.getSetCookie().join('\n')).toContain('mp_rt=internal-refresh');
  });

  it('não cria sessão interna quando a verificação Clerk falha', async () => {
    let called = false;
    const res = await makeApp({
      verify: async () => {
        throw new DomainError(ErrorCodes.AuthUnauthorized, 'sessão Clerk inválida');
      },
      onLogin: () => (called = true),
    }).request('/clerk/exchange', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid' },
    });

    expect(res.status).toBe(401);
    expect(called).toBe(false);
  });
});

describe('autenticação legada com Clerk habilitado', () => {
  it('bloqueia login e registro diretos sem executar os casos de uso legados', async () => {
    let calls = 0;
    const app = makeApp({ onLegacy: () => (calls += 1) });
    const [login, register] = await Promise.all([
      app.request('/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ada@example.test', password: 'password-1234' }),
      }),
      app.request('/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'ada@example.test',
          password: 'password-1234',
          name: 'Ada',
        }),
      }),
    ]);

    expect([login.status, register.status]).toEqual([404, 404]);
    expect(calls).toBe(0);
  });
});
