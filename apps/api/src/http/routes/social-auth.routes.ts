import { OpenAPIHono } from '@hono/zod-openapi';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, randomToken } from '@manypost/core';
import type { Container } from '../../container';
import { buildIdentityProviders } from '../../infra/identity/identity.providers';
import { setAuthCookies } from '../cookies';
import type { AppEnv } from '../middleware/context';

const STATE_COOKIE = 'mp_oauth_state';

/**
 * Login social (Google/GitHub) — GET /v1/auth/social.
 * state anti-CSRF em cookie httpOnly de 10 min (single-use).
 */
export function socialAuthRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  const providers = buildIdentityProviders(ctn.env);
  const secure = ctn.env.PUBLIC_URL.startsWith('https');
  const redirectUri = (id: string) => `${ctn.env.PUBLIC_URL}/v1/auth/social/${id}/callback`;

  // catálogo p/ o frontend decidir quais botões mostrar
  app.get('/', (c) =>
    c.json({ providers: [...providers.values()].map((p) => ({ id: p.id, name: p.name })) }),
  );

  app.get('/:provider', (c) => {
    const p = providers.get(c.req.param('provider'));
    if (!p) throw new DomainError(ErrorCodes.CapabilityDisabled, 'login social não configurado');
    const state = randomToken(16);
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      path: '/v1/auth/social',
      maxAge: 600,
    });
    return c.redirect(p.authUrl(redirectUri(p.id), state), 302);
  });

  app.get('/:provider/callback', async (c) => {
    const p = providers.get(c.req.param('provider'));
    if (!p) throw new DomainError(ErrorCodes.CapabilityDisabled, 'login social não configurado');

    const state = c.req.query('state');
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: '/v1/auth/social' });
    if (!state || !expected || state !== expected) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'state inválido — tente de novo');
    }
    const code = c.req.query('code');
    if (!code) throw new DomainError(ErrorCodes.AuthUnauthorized, 'code ausente');

    const profile = await p.exchange(code, redirectUri(p.id));
    const out = await ctn.auth.loginWithIdentity({
      profile,
      userAgent: c.req.header('user-agent'),
      ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim(),
    });
    setAuthCookies(c, secure, out.accessToken, out.refreshToken);
    return c.redirect(`${ctn.env.PUBLIC_URL}/?login=social&new=${out.isNewUser ? 1 : 0}`, 302);
  });

  return app;
}
