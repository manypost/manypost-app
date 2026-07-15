import { z } from '@hono/zod-openapi';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { ChannelProvider } from '@manypost/contracts';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonBody, jsonResponse } from '../openapi';

const CONNECT_COOKIE = 'mp_ch_state';
const ConnectBody = z.object({ provider: z.string().min(1), fields: z.unknown().optional() });

const ChannelOut = z
  .object({
    id: z.string(),
    provider: z.string().openapi({ example: 'mastodon' }),
    externalId: z.string(),
    name: z.string().nullable(),
    username: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    status: z.string().openapi({ example: 'ACTIVE' }),
    scopes: z.array(z.string()).nullable(),
  })
  .openapi('Channel');

const ProviderInfo = z
  .object({
    id: z.string(),
    name: z.string(),
    editor: z.boolean(),
    threads: z.boolean(),
    twoStepConnect: z.boolean(),
    connectType: z.enum(['fields', 'oauth']).openapi({ description: 'fields = credenciais; oauth = redirect' }),
  })
  .openapi('ChannelProviderInfo');

/** Erros de rede/provider ({status, body}) → problem+json legível, nunca 500. */
const asConnectError = (err: unknown): unknown => {
  const e = err as { status?: number; body?: string };
  if (typeof e?.status === 'number' && e.body !== undefined) {
    return new DomainError(ErrorCodes.ChannelConnectFailed, `a rede recusou a conexão: ${String(e.body).slice(0, 300)}`);
  }
  return err;
};

export function channelRoutes(ctn: Container) {
  const app = createApp();
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

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/',
    tags: ['channels'],
    security: AUTH_SECURITY,
    summary: 'Lista os canais conectados (tokens nunca são expostos)',
    responses: { 200: jsonResponse('canais', z.array(ChannelOut)), ...errorResponses(401) },
  });
  app.get('/', async (c) => c.json(await ctn.channels.list(c.get('principal').orgId)));

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/providers',
    tags: ['channels'],
    security: AUTH_SECURITY,
    summary: 'Catálogo de providers disponíveis nesta instalação',
    description: 'Providers cujas credenciais de app faltam no env não aparecem (como o login social).',
    responses: { 200: jsonResponse('providers disponíveis', z.array(ProviderInfo)), ...errorResponses(401) },
  });
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

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/connect',
    tags: ['channels'],
    security: AUTH_SECURITY,
    summary: 'Inicia a conexão de um canal',
    description:
      'Provider por credenciais (connectType=fields) conecta direto e devolve o canal (201). Provider OAuth devolve a URL de autorização (200) — o navegador segue e volta em /callback.',
    request: jsonBody(ConnectBody),
    responses: {
      200: jsonResponse('URL de autorização OAuth', z.object({ url: z.string() })),
      201: jsonResponse('canal conectado (fluxo por credenciais)', ChannelOut),
      ...errorResponses(400, 401, 403, 404),
    },
  });
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

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/callback/{provider}',
    tags: ['channels'],
    security: AUTH_SECURITY,
    summary: 'Callback OAuth — troca o code pelo token e conecta o canal',
    request: {
      params: z.object({ provider: z.string() }),
      query: z.object({ code: z.string(), state: z.string() }),
    },
    responses: { 201: jsonResponse('canal conectado', ChannelOut), ...errorResponses(401, 403, 404) },
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

  app.openAPIRegistry.registerPath({
    method: 'delete',
    path: '/{id}',
    tags: ['channels'],
    security: AUTH_SECURITY,
    summary: 'Desconecta um canal (soft delete)',
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: 'canal desconectado' }, ...errorResponses(401, 403, 404) },
  });
  app.use('/:id', requireAdmin());
  app.delete('/:id', async (c) => {
    await ctn.channels.disconnect(c.get('principal').orgId, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
