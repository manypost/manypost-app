import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { ErrorCodes } from '@manypost/contracts';
import { ACCESS_TTL_SEC, DomainError, REFRESH_TTL_SEC } from '@manypost/core';
import type { Container } from '../../container';
import { ACCESS_COOKIE, REFRESH_COOKIE, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

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
});
const AuthOut = z.object({
  user: UserOut,
  org: z.object({ id: z.string(), name: z.string(), role: z.string() }),
  accessToken: z.string(),
  refreshToken: z.string(),
});

const clientMeta = (c: Context) => ({
  userAgent: c.req.header('user-agent'),
  ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim(),
});

export function authRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  const secure = ctn.env.PUBLIC_URL.startsWith('https');

  const setAuthCookies = (c: Context, accessToken: string, refreshToken: string) => {
    setCookie(c, ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      path: '/',
      maxAge: ACCESS_TTL_SEC,
    });
    setCookie(c, REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      path: '/v1/auth',
      maxAge: REFRESH_TTL_SEC,
    });
  };

  app.openapi(
    createRoute({
      method: 'post',
      path: '/register',
      request: { body: { content: { 'application/json': { schema: RegisterBody } } } },
      responses: {
        201: {
          description: 'conta criada (cookies httpOnly também são definidos)',
          content: { 'application/json': { schema: AuthOut } },
        },
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const out = await ctn.auth.register({ ...body, ...clientMeta(c) });
      setAuthCookies(c, out.accessToken, out.refreshToken);
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
      request: { body: { content: { 'application/json': { schema: Credentials } } } },
      responses: {
        200: { description: 'autenticado', content: { 'application/json': { schema: AuthOut } } },
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const out = await ctn.auth.login({ ...body, ...clientMeta(c) });
      setAuthCookies(c, out.accessToken, out.refreshToken);
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

  app.post('/refresh', async (c) => {
    const out = await ctn.auth.refresh({ refreshToken: await refreshTokenFrom(c) });
    setAuthCookies(c, out.accessToken, out.refreshToken);
    return c.json(out, 200);
  });

  app.post('/logout', async (c) => {
    const token = await refreshTokenFrom(c).catch(() => null);
    if (token) await ctn.auth.logout({ refreshToken: token });
    deleteCookie(c, ACCESS_COOKIE, { path: '/' });
    deleteCookie(c, REFRESH_COOKIE, { path: '/v1/auth' });
    return c.body(null, 204);
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
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
    });
  });

  return app;
}
