import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { setAuthCookies } from '../cookies';
import { ACCESS_COOKIE, REFRESH_COOKIE, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';
import { AUTH_SECURITY, createApp, errorResponses, jsonBody, jsonResponse } from '../openapi';

const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
});
const RegisterBody = Credentials.extend({
  name: z.string().min(1).max(80),
  orgName: z.string().min(1).max(80).optional(),
});
const UserOut = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
const AuthOut = z
  .object({
    user: UserOut,
    org: z.object({ id: z.string(), name: z.string(), role: z.string() }),
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi('AuthResult');
const TokenPair = z
  .object({ accessToken: z.string(), refreshToken: z.string() })
  .openapi('TokenPair');
const RefreshBody = z.object({
  /** token de refresh; opcional quando vai no cookie httpOnly (fluxo web) */
  refreshToken: z.string().optional(),
});
const MeOut = z
  .object({
    kind: z.enum(['user', 'api_key']),
    orgId: z.string(),
    role: z.string().optional(),
    scopes: z.array(z.string()).optional(),
    user: UserOut.nullable().optional(),
  })
  .openapi('Me');

const clientMeta = (c: Context) => ({
  userAgent: c.req.header('user-agent'),
  ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim(),
});

export function authRoutes(ctn: Container) {
  const app = createApp();
  const secure = ctn.env.PUBLIC_URL.startsWith('https');

  const applyCookies = (c: Context, accessToken: string, refreshToken: string) =>
    setAuthCookies(c, secure, accessToken, refreshToken);

  app.openapi(
    createRoute({
      method: 'post',
      path: '/register',
      tags: ['auth'],
      summary: 'Cria conta + organização (papel OWNER) e já autentica',
      request: { body: { content: { 'application/json': { schema: RegisterBody } } } },
      responses: {
        201: {
          description: 'conta criada (cookies httpOnly também são definidos)',
          content: { 'application/json': { schema: AuthOut } },
        },
        ...errorResponses(400, 409),
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const out = await ctn.auth.register({ ...body, ...clientMeta(c) });
      applyCookies(c, out.accessToken, out.refreshToken);
      return c.json(
        {
          user: out.user,
          org: { id: out.org.id, name: out.org.name, role: out.org.role },
          accessToken: out.accessToken,
          refreshToken: out.refreshToken,
        },
        201,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/login',
      tags: ['auth'],
      summary: 'Autentica por e-mail e senha',
      request: { body: { content: { 'application/json': { schema: Credentials } } } },
      responses: {
        200: { description: 'autenticado', content: { 'application/json': { schema: AuthOut } } },
        ...errorResponses(400, 401),
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const out = await ctn.auth.login({ ...body, ...clientMeta(c) });
      applyCookies(c, out.accessToken, out.refreshToken);
      return c.json(
        {
          user: out.user,
          org: { id: out.org.id, name: out.org.name, role: out.org.role },
          accessToken: out.accessToken,
          refreshToken: out.refreshToken,
        },
        200,
      );
    },
  );

  // refresh e logout aceitam o token via cookie httpOnly (web) ou body JSON (clientes de API)
  const refreshTokenFrom = async (c: Context): Promise<string> => {
    const fromCookie = getCookie(c, REFRESH_COOKIE);
    if (fromCookie) return fromCookie;
    const body = await c.req.json().catch(() => null);
    const fromBody = body && typeof body.refreshToken === 'string' ? body.refreshToken : null;
    if (!fromBody) throw new DomainError(ErrorCodes.AuthSessionInvalid, 'refresh token ausente');
    return fromBody;
  };

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/refresh',
    tags: ['auth'],
    summary: 'Renova a sessão com rotação do refresh token',
    description:
      'Token via cookie httpOnly (web) ou body JSON (clientes de API). O reuso de um token já rotacionado revoga a família inteira.',
    request: jsonBody(RefreshBody, false),
    responses: {
      200: jsonResponse('nova dupla de tokens (cookies também são atualizados)', TokenPair),
      ...errorResponses(401),
    },
  });
  app.post('/refresh', async (c) => {
    const out = await ctn.auth.refresh({ refreshToken: await refreshTokenFrom(c) });
    applyCookies(c, out.accessToken, out.refreshToken);
    return c.json(out, 200);
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/logout',
    tags: ['auth'],
    summary: 'Encerra a sessão e limpa os cookies',
    request: jsonBody(RefreshBody, false),
    responses: { 204: { description: 'sessão encerrada' } },
  });
  app.post('/logout', async (c) => {
    const token = await refreshTokenFrom(c).catch(() => null);
    if (token) await ctn.auth.logout({ refreshToken: token });
    deleteCookie(c, ACCESS_COOKIE, { path: '/' });
    deleteCookie(c, REFRESH_COOKIE, { path: '/v1/auth' });
    return c.body(null, 204);
  });

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/me',
    tags: ['auth'],
    security: AUTH_SECURITY,
    summary: 'Identidade do principal autenticado (usuário ou API key)',
    responses: {
      200: jsonResponse('usuário (com papel) ou API key (com escopos)', MeOut),
      ...errorResponses(401),
    },
  });
  app.use('/me', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));
  app.get('/me', async (c) => {
    const p = c.get('principal');
    if (p.kind === 'api_key') {
      return c.json({ kind: p.kind, orgId: p.orgId, scopes: p.scopes ?? [] });
    }
    const user = await ctn.repos.users.findById(p.userId!);
    return c.json({
      kind: p.kind,
      orgId: p.orgId,
      role: p.role,
      user: user
        ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }
        : null,
    });
  });

  return app;
}
