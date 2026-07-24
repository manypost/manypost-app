import { describe, expect, it } from 'bun:test';
import type { Container } from '../../container';
import { errorHandler } from '../middleware/error';
import { socialAuthRoutes } from './social-auth.routes';

describe('login social legado com Clerk habilitado', () => {
  it('esconde o catálogo e bloqueia a rota direta do provider', async () => {
    const app = socialAuthRoutes({
      env: {
        PUBLIC_URL: 'https://app.manypost.com.br',
        GOOGLE_CLIENT_ID: 'legacy-client',
        GOOGLE_CLIENT_SECRET: 'legacy-secret',
      },
      clerkIdentity: async () => {
        throw new Error('não usado');
      },
    } as unknown as Container);
    app.onError(errorHandler);

    const catalog = await app.request('/');
    const direct = await app.request('/google');

    expect(catalog.status).toBe(200);
    expect(await catalog.json()).toEqual({ providers: [] });
    expect(direct.status).toBe(404);
  });
});
