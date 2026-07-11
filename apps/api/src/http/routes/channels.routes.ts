import { OpenAPIHono, z } from '@hono/zod-openapi';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAdmin, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

const CONNECT_COOKIE = 'mp_ch_state';
const ConnectBody = z.object({ provider: z.string().min(1) });

export function channelRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  const secure = ctn.env.PUBLIC_URL.startsWith('https');
  const providerCtx = {
    fetch: globalThis.fetch,
    log: () => {},
    now: () => new Date(),
    secrets: {},
  };

  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.get('/', async (c) => c.json(await ctn.channels.list(c.get('principal').orgId)));

  // catálogo de providers disponíveis (capacidades p/ o composer)
  app.get('/providers', (c) =>
    c.json(
      ctn.registry.list().map((p) => ({
        id: p.id,
        name: p.name,
        editor: p.capabilities.editor,
        threads: p.capabilities.threads,
        twoStepConnect: p.capabilities.twoStepConnect,
      })),
    ),
  );

  app.use('/connect', requireAdmin());
  app.post('/connect', async (c) => {
    const body = ConnectBody.parse(await c.req.json());
    const provider = ctn.registry.get(body.provider);
    if (!provider) throw new DomainError(ErrorCodes.CapabilityDisabled, 'provider indisponível');

    const redirectUri = `${ctn.env.PUBLIC_URL}/v1/channels/callback/${provider.id}`;
    const auth = await provider.getAuthUrl(providerCtx, { redirectUri });
    setCookie(
      c,
      CONNECT_COOKIE,
      JSON.stringify({ p: provider.id, s: auth.state, v: auth.codeVerifier ?? null }),
      { httpOnly: true, sameSite: 'Lax', secure, path: '/v1/channels', maxAge: 600 },
    );
    return c.json({ url: auth.url });
  });

  app.use('/callback/:provider', requireAdmin());
  app.get('/callback/:provider', async (c) => {
    const provider = ctn.registry.get(c.req.param('provider'));
    if (!provider) throw new DomainError(ErrorCodes.CapabilityDisabled, 'provider indisponível');

    const raw = getCookie(c, CONNECT_COOKIE);
    deleteCookie(c, CONNECT_COOKIE, { path: '/v1/channels' });
    const saved = raw ? (JSON.parse(raw) as { p: string; s: string; v: string | null }) : null;
    const state = c.req.query('state');
    if (!saved || saved.p !== provider.id || !state || state !== saved.s) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'state inválido — reinicie a conexão');
    }
    const code = c.req.query('code');
    if (!code) throw new DomainError(ErrorCodes.AuthUnauthorized, 'code ausente');

    const redirectUri = `${ctn.env.PUBLIC_URL}/v1/channels/callback/${provider.id}`;
    const account = await provider.exchangeCode(providerCtx, {
      code,
      redirectUri,
      ...(saved.v ? { codeVerifier: saved.v } : {}),
    });
    const channel = await ctn.channels.connect({
      orgId: c.get('principal').orgId,
      provider,
      account,
    });
    return c.json(channel, 201);
  });

  app.use('/:id', requireAdmin());
  app.delete('/:id', async (c) => {
    await ctn.channels.disconnect(c.get('principal').orgId, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
