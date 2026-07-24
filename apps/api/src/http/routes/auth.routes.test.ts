import { describe, expect, it } from 'bun:test';
import type { Container } from '../../container';
import { errorHandler } from '../middleware/error';
import { authRoutes } from './auth.routes';

function makeApp() {
  const ctn = {
    env: { PUBLIC_URL: 'https://app.manypost.com.br' },
    auth: {
      authenticateHuman: async (token: string) =>
        token === 'clerk-session'
          ? { userId: 'user-1', orgId: 'org-1', role: 'OWNER' as const }
          : null,
      verifyApiKey: async () => null,
    },
    repos: {
      users: {
        findById: async (id: string) =>
          id === 'user-1'
            ? {
                id,
                email: 'ada@example.test',
                name: 'Ada',
                avatarUrl: null,
              }
            : null,
      },
    },
  } as unknown as Container;
  const app = authRoutes(ctn);
  app.onError(errorHandler);
  return app;
}

describe('rotas humanas autenticadas pelo Clerk', () => {
  it('expõe somente /me e autoriza com a membership resolvida pelo Manypost', async () => {
    const res = await makeApp().request('/me', {
      headers: { authorization: 'Bearer clerk-session' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      kind: 'user',
      orgId: 'org-1',
      role: 'OWNER',
      user: {
        id: 'user-1',
        email: 'ada@example.test',
        name: 'Ada',
        avatarUrl: null,
      },
    });
  });

  it('não registra login, cadastro, social, exchange, refresh ou logout internos', async () => {
    for (const path of [
      '/login',
      '/register',
      '/social',
      '/clerk/exchange',
      '/refresh',
      '/logout',
    ]) {
      const res = await makeApp().request(path, { method: 'POST' });
      expect(res.status).toBe(404);
    }
  });

  it('ignora cookies legados em /me', async () => {
    const res = await makeApp().request('/me', {
      headers: { cookie: 'mp_at=legacy-access; mp_rt=legacy-refresh' },
    });

    expect(res.status).toBe(401);
  });
});
