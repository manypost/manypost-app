import { OpenAPIHono, z } from '@hono/zod-openapi';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { ChannelProvider } from '@manypost/contracts';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAdmin, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

const CONNECT_COOKIE = 'mp_ch_state';
const ConnectBody = z.object({ provider: z.string().min(1), fields: z.unknown().optional() });

/** Erros de rede/provider ({status, body}) → problem+json legível, nunca 500. */
const asConnectError = (err: unknown): unknown => {
  const e = err as { status?: number; body?: string };
  if (typeof e?.status === 'number' && e.body !== undefined) {
    return new DomainError(ErrorCodes.ChannelConnectFailed, `a rede recusou a conexão: ${String(e.body).slice(0, 300)}`);
  }
  return err;
};

export function channelRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  const secure = ctn.env.PUBLIC_URL.startsWith('https');
  const ctxFor = (provider: ChannelProvider) => ({
    fetch: globalThis.fetch,
    log: () => {},
    now: () => new Date(),
    secrets: ctn.providerSecrets[provider.id] ?? {},
  });
  const available = (p: ChannelProvider) =>
    (p.requiredSecrets ?? []).every((k) => ctn.providerSecrets[p.id]?.[k]);
  const getAvailable = (id: string) => {
    const provider = ctn.registry.get(id);
    if (!provider) throw new DomainError(ErrorCodes.CapabilityDisabled, 'provider indisponível');
    if (!available(provider)) {
      throw new DomainError(
        ErrorCodes.CapabilityDisabled,
        'provider não configurado nesta instalação — veja docs/INTEGRATIONS_SETUP.md',
      );
    }
    return provider;
  };

  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.get('/', async (c) => c.json(await ctn.channels.list(c.get('principal').orgId)));

  // catálogo de providers DISPONÍVEIS (sem env necessária o provider some — como o login social)
  app.get('/providers', (c) =>
    c.json(
      ctn.registry
        .list()
        .filter(available)
        .map((p) => ({
          id: p.id,
          name: p.name,
          editor: p.capabilities.editor,
          threads: p.capabilities.threads,
          twoStepConnect: p.capabilities.twoStepConnect,
          /** fields = credenciais direto no app (Bluesky/Telegram); oauth = redirect */
          connectType: p.connectWithFields ? 'fields' : 'oauth',
        })),
    ),
  );

  app.use('/connect', requireAdmin());
  app.post('/connect', async (c) => {
    const body = ConnectBody.parse(await c.req.json());
    const provider = getAvailable(body.provider);

    // providers de credenciais/instância custom validam os campos de conexão
    const fields = provider.connectionFieldsSchema
      ? provider.connectionFieldsSchema.parse(body.fields ?? {})
      : undefined;

    // conexão direta por credenciais (Bluesky app password, Telegram bot) — sem redirect
    if (provider.connectWithFields) {
      const account = await provider
        .connectWithFields(ctxFor(provider), { fields })
        .catch((err) => Promise.reject(asConnectError(err)));
      const channel = await ctn.channels.connect({
        orgId: c.get('principal').orgId,
        provider,
        account,
      });
      return c.json(channel, 201);
    }

    const redirectUri = `${ctn.env.PUBLIC_URL}/v1/channels/callback/${provider.id}`;
    const auth = await provider
      .getAuthUrl(ctxFor(provider), { redirectUri, fields })
      .catch((err) => Promise.reject(asConnectError(err)));
    setCookie(
      c,
      CONNECT_COOKIE,
      JSON.stringify({
        p: provider.id,
        s: auth.state,
        v: auth.codeVerifier ?? null,
        x: auth.extra ?? null,
      }),
      { httpOnly: true, sameSite: 'Lax', secure, path: '/v1/channels', maxAge: 600 },
    );
    return c.json({ url: auth.url });
  });

  app.use('/callback/:provider', requireAdmin());
  app.get('/callback/:provider', async (c) => {
    const provider = getAvailable(c.req.param('provider'));

    const raw = getCookie(c, CONNECT_COOKIE);
    deleteCookie(c, CONNECT_COOKIE, { path: '/v1/channels' });
    const saved = raw
      ? (JSON.parse(raw) as { p: string; s: string; v: string | null; x: unknown })
      : null;
    const state = c.req.query('state');
    if (!saved || saved.p !== provider.id || !state || state !== saved.s) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'state inválido — reinicie a conexão');
    }
    const code = c.req.query('code');
    if (!code) throw new DomainError(ErrorCodes.AuthUnauthorized, 'code ausente');

    const redirectUri = `${ctn.env.PUBLIC_URL}/v1/channels/callback/${provider.id}`;
    const account = await provider
      .exchangeCode(ctxFor(provider), {
        code,
        redirectUri,
        ...(saved.v ? { codeVerifier: saved.v } : {}),
        ...(saved.x ? { extra: saved.x } : {}),
      })
      .catch((err) => Promise.reject(asConnectError(err)));
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
