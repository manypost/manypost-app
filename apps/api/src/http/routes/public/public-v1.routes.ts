import { z } from '@hono/zod-openapi';
import type { RouteConfig } from '@hono/zod-openapi';
import {
  ErrorCodes,
  PublicationStates,
  type PublicationState,
  WebhookEvents,
} from '@manypost/contracts';
import { DomainError, type MediaRecord, type PublicationFeedItem } from '@manypost/core';
import type { Container } from '../../../container';
import { requireAuth, requireScope } from '../../middleware/auth';
import { idempotency, rateLimitByCredential, requirePlanFeature } from '../../middleware/public-api';
import { createApp, errorResponses, jsonBody, jsonResponse } from '../../openapi';
import { isProviderAvailable, providerCatalogEntry } from '../shared/provider-catalog';

/**
 * API pública `/public/v1` (SPEC_API_MCP §3): mesma pilha de use-cases da API interna, mas
 * voltada a máquinas — autenticação por API key com **escopos** (o humano/JWT passa; o papel
 * o governa, §6), **rate-limit por credencial** (headers RateLimit-*) e **Idempotency-Key** nos
 * POST de mutação. Versionada no path (breaking → /public/v2). Erros = problem+json (RFC 9457).
 *
 * Fora deste corte (features ainda inexistentes): analytics de canal e webhooks/{id}/test.
 */

// bearer = JWT de acesso OU API key mp_live_ (o esperado aqui é a API key)
const PUBLIC_SECURITY: NonNullable<RouteConfig['security']> = [{ bearerAuth: [] }];

// ---- schemas de resposta (documentação; a serialização em runtime é a fonte) ----
const PubMediaRef = z
  .object({
    mediaId: z.string().optional(),
    type: z.string().openapi({ example: 'image' }),
    url: z.string(),
    mime: z.string().openapi({ example: 'image/png' }),
    alt: z.string().nullable().optional(),
  })
  .openapi('PubMediaRef');

const PubPublication = z
  .object({
    id: z.string(),
    channelId: z.string(),
    state: z.string().openapi({ example: 'SCHEDULED' }),
    media: z.array(PubMediaRef),
    itemCount: z.number().int(),
    lastPublishedIndex: z.number().int().nullable(),
    attemptCount: z.number().int(),
    externalId: z.string().nullable(),
    releaseUrl: z.string().nullable(),
    errorClass: z.string().nullable(),
    errorMessage: z.string().nullable(),
  })
  .openapi('PubPublication');

const PubGroup = z
  .object({
    id: z.string(),
    state: z.string().openapi({ example: 'SCHEDULED' }),
    publishAt: z.string().datetime().nullable(),
    publications: z.array(PubPublication),
  })
  .openapi('PubPostGroup');

const PubFeedItem = z
  .object({
    id: z.string(),
    groupId: z.string(),
    channelId: z.string(),
    state: z.string().openapi({ example: 'PUBLISHED' }),
    publishAt: z.string().datetime().nullable(),
    text: z.string(),
    mediaCount: z.number().int(),
    externalId: z.string().nullable(),
    releaseUrl: z.string().nullable(),
    errorClass: z.string().nullable(),
    errorMessage: z.string().nullable(),
    attemptCount: z.number().int(),
    group: z.object({ state: z.string(), origin: z.string(), awaitingApproval: z.boolean() }),
    channel: z.object({
      provider: z.string(),
      name: z.string(),
      username: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
  })
  .openapi('PubFeedItem');

const PubFeed = z
  .object({ items: z.array(PubFeedItem), nextCursor: z.string().nullable() })
  .openapi('PubPublicationFeed');

const PubChannel = z
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
  .openapi('PubChannel');

const PubMedia = z
  .object({
    id: z.string(),
    url: z.string(),
    mime: z.string().openapi({ example: 'image/png' }),
    byteSize: z.number().int(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    alt: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('PubMedia');

const PubWebhook = z
  .object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    events: z.array(z.string()),
    channelIds: z.array(z.string()),
    disabledAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('PubWebhook');

// ---- corpos de requisição ----
const ScheduleBody = z.object({
  text: z.string().min(1).max(10_000),
  channelIds: z.array(z.string().uuid()).min(1).max(20),
  publishAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
  settingsByChannel: z.record(z.unknown()).optional(),
  textByChannel: z.record(z.string().min(1).max(10_000)).optional(),
  mediaIds: z.array(z.string().uuid()).max(10).optional(),
  thread: z
    .array(
      z.object({
        text: z.string().min(1).max(10_000),
        mediaIds: z.array(z.string().uuid()).max(10).optional(),
        delaySec: z.number().int().min(0).max(600).optional(),
      }),
    )
    .max(24)
    .optional(),
  requireApproval: z.boolean().optional(),
});

const PatchBody = z
  .object({
    text: z.string().min(1).max(10_000).optional(),
    publishAt: z.string().datetime().optional(),
    settingsByChannel: z.record(z.unknown()).optional(),
  })
  .refine(
    (b) => b.text !== undefined || b.publishAt !== undefined || b.settingsByChannel !== undefined,
    { message: 'informe text, publishAt e/ou settingsByChannel' },
  );

const RetryBody = z.object({ channelId: z.string().uuid().optional() }).optional();
const ApprovalLinkBody = z
  .object({ expiresInHours: z.number().int().min(1).max(720).optional() })
  .optional();
const FromUrlBody = z.object({ url: z.string().url(), alt: z.string().max(1500).optional() });
const WebhookCreateBody = z.object({
  name: z.string().min(1).max(60),
  url: z.string().url(),
  events: z.array(z.enum(Object.values(WebhookEvents) as [string, ...string[]])).min(1),
  channelIds: z.array(z.string().uuid()).optional(),
});

// ---- serializers (fonte em runtime) ----
type Group = NonNullable<Awaited<ReturnType<Container['posts']['getGroup']>>>;
const serializeGroup = (g: Group) => ({
  id: g.id,
  state: g.state,
  publishAt: g.publishAt?.toISOString() ?? null,
  publications: g.publications.map((p) => ({
    id: p.id,
    channelId: p.channelId,
    state: p.state,
    media: p.content.media ?? [],
    itemCount: p.itemCount ?? 1,
    lastPublishedIndex: p.lastPublishedIndex,
    attemptCount: p.attemptCount,
    externalId: p.externalId,
    releaseUrl: p.releaseUrl,
    errorClass: p.errorClass,
    errorMessage: p.errorMessage,
  })),
});

const serializeFeedItem = (p: PublicationFeedItem) => ({
  id: p.id,
  groupId: p.groupId,
  channelId: p.channelId,
  state: p.state,
  publishAt: p.publishAt?.toISOString() ?? null,
  text: p.content.text,
  mediaCount: p.content.media?.length ?? 0,
  externalId: p.externalId,
  releaseUrl: p.releaseUrl,
  errorClass: p.errorClass,
  errorMessage: p.errorMessage,
  attemptCount: p.attemptCount,
  group: p.group,
  channel: p.channel,
});

const serializeMedia = (ctn: Container, m: MediaRecord) => ({
  id: m.id,
  url: ctn.storage.publicUrl(m.path),
  mime: m.mime,
  byteSize: m.byteSize,
  width: m.width,
  height: m.height,
  alt: m.alt,
  createdAt: m.createdAt.toISOString(),
});

// ---- cursor keyset do feed (idêntico ao /v1/publications) ----
const encodeCursor = (publishAt: Date | null, id: string) =>
  Buffer.from(JSON.stringify({ p: (publishAt ?? new Date(0)).toISOString(), id })).toString(
    'base64url',
  );
const decodeCursor = (raw: string): { publishAt: Date; id: string } | undefined => {
  try {
    const { p, id } = JSON.parse(Buffer.from(raw, 'base64url').toString()) as { p: string; id: string };
    const publishAt = new Date(p);
    if (Number.isNaN(publishAt.getTime()) || typeof id !== 'string') return undefined;
    return { publishAt, id };
  } catch {
    return undefined;
  }
};

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(item).min(1).max(50));

const FeedQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  state: csv(
    z.enum(PublicationStates as unknown as [PublicationState, ...PublicationState[]]),
  ).optional(),
  channelId: csv(z.string().uuid()).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const FeedQueryDoc = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  state: z.string().optional().openapi({ example: 'SCHEDULED,PUBLISHED' }),
  channelId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.string().optional().openapi({ example: '100' }),
});

const GroupParam = z.object({ groupId: z.string().uuid() });
const IdParam = z.object({ id: z.string().uuid() });

const path = (app: ReturnType<typeof createApp>, cfg: Omit<RouteConfig, 'security'>) =>
  app.openAPIRegistry.registerPath({ ...cfg, security: PUBLIC_SECURITY });

/**
 * Monta toda a superfície `/public/v1`. Middlewares globais: auth → rate-limit por credencial →
 * idempotência. Cada rota exige o escopo do recurso (SPEC_API_MCP §3).
 */
export function publicV1Routes(ctn: Container) {
  const app = createApp();

  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));
  app.use('*', requirePlanFeature(ctn.plan, 'public_api'));
  app.use('*', rateLimitByCredential(ctn.runtime.rateLimiter, { limit: 60, windowSec: 60 }));
  app.use('*', idempotency(ctn.runtime.idempotency));

  // ==================== POSTS ====================
  path(app, {
    method: 'post',
    path: '/posts',
    tags: ['public-posts'],
    summary: 'Agenda um post (escopo posts:write)',
    description:
      'Idempotente com o header `Idempotency-Key`. `requireApproval` nasce DRAFT aguardando link de aprovação; `thread` cria réplicas encadeadas.',
    request: jsonBody(ScheduleBody),
    responses: { 201: jsonResponse('grupo agendado', PubGroup), ...errorResponses(400, 401, 403, 429) },
  });
  app.post('/posts', requireScope('posts:write'), async (c) => {
    const body = ScheduleBody.parse(await c.req.json());
    const p = c.get('principal');
    const group = await ctn.posts.schedule({
      orgId: p.orgId,
      authorId: p.userId ?? null,
      text: body.text,
      channelIds: body.channelIds,
      publishAt: new Date(body.publishAt),
      timezone: body.timezone,
      origin: 'API',
      ...(body.settingsByChannel ? { settingsByChannel: body.settingsByChannel } : {}),
      ...(body.textByChannel ? { textByChannel: body.textByChannel } : {}),
      ...(body.mediaIds ? { mediaIds: body.mediaIds } : {}),
      ...(body.thread ? { thread: body.thread } : {}),
      ...(body.requireApproval ? { requireApproval: true } : {}),
    });
    return c.json(serializeGroup(group!), 201);
  });

  path(app, {
    method: 'get',
    path: '/posts/{groupId}',
    tags: ['public-posts'],
    summary: 'Detalhe de um grupo (escopo posts:read)',
    request: { params: GroupParam },
    responses: { 200: jsonResponse('grupo', PubGroup), ...errorResponses(401, 403, 404, 429) },
  });
  app.get('/posts/:groupId', requireScope('posts:read'), async (c) => {
    const group = await ctn.posts.getGroup(c.get('principal').orgId, c.req.param('groupId'));
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    return c.json(serializeGroup(group));
  });

  path(app, {
    method: 'patch',
    path: '/posts/{groupId}',
    tags: ['public-posts'],
    summary: 'Edita texto/horário/settings e re-agenda (escopo posts:write)',
    request: { params: GroupParam, ...jsonBody(PatchBody) },
    responses: { 200: jsonResponse('grupo re-agendado', PubGroup), ...errorResponses(400, 401, 403, 404, 429) },
  });
  app.patch('/posts/:groupId', requireScope('posts:write'), async (c) => {
    const body = PatchBody.parse(await c.req.json());
    const group = await ctn.posts.reschedule({
      orgId: c.get('principal').orgId,
      groupId: c.req.param('groupId'),
      ...(body.text !== undefined ? { text: body.text } : {}),
      ...(body.publishAt ? { publishAt: new Date(body.publishAt) } : {}),
      ...(body.settingsByChannel ? { settingsByChannel: body.settingsByChannel } : {}),
    });
    return c.json(serializeGroup(group!));
  });

  path(app, {
    method: 'delete',
    path: '/posts/{groupId}',
    tags: ['public-posts'],
    summary: 'Cancela um grupo agendado (escopo posts:write)',
    request: { params: GroupParam },
    responses: { 200: jsonResponse('grupo cancelado', PubGroup), ...errorResponses(401, 403, 404, 429) },
  });
  app.delete('/posts/:groupId', requireScope('posts:write'), async (c) => {
    const group = await ctn.posts.cancel(c.get('principal').orgId, c.req.param('groupId'));
    return c.json(serializeGroup(group!));
  });

  path(app, {
    method: 'post',
    path: '/posts/{groupId}/retry',
    tags: ['public-posts'],
    summary: 'Tenta publicar de novo (escopo posts:write)',
    description: 'FAILED/NEEDS_REVIEW → SCHEDULED. Com `channelId` no corpo, retenta só o canal.',
    request: { params: GroupParam, ...jsonBody(z.object({ channelId: z.string().uuid().optional() }), false) },
    responses: { 200: jsonResponse('grupo re-agendado', PubGroup), ...errorResponses(400, 401, 403, 404, 429) },
  });
  app.post('/posts/:groupId/retry', requireScope('posts:write'), async (c) => {
    const body = RetryBody.parse(await c.req.json().catch(() => undefined));
    const group = await ctn.posts.retry({
      orgId: c.get('principal').orgId,
      groupId: c.req.param('groupId'),
      ...(body?.channelId ? { channelId: body.channelId } : {}),
    });
    return c.json(serializeGroup(group!));
  });

  path(app, {
    method: 'post',
    path: '/posts/{groupId}/approval-link',
    tags: ['public-posts'],
    summary: 'Cria o link público de aprovação de um rascunho (escopo posts:write)',
    request: {
      params: GroupParam,
      ...jsonBody(z.object({ expiresInHours: z.number().int().min(1).max(720).optional() }), false),
    },
    responses: {
      201: jsonResponse(
        'link criado (token só aqui)',
        z.object({ token: z.string(), url: z.string(), expiresAt: z.string().datetime() }),
      ),
      ...errorResponses(400, 401, 403, 404, 429),
    },
  });
  app.post('/posts/:groupId/approval-link', requireScope('posts:write'), async (c) => {
    const body = ApprovalLinkBody.parse(await c.req.json().catch(() => undefined));
    const p = c.get('principal');
    const out = await ctn.approvals.createLink({
      orgId: p.orgId,
      groupId: c.req.param('groupId'),
      actorType: p.kind === 'api_key' ? 'API_KEY' : 'USER',
      actorId: (p.kind === 'user' ? p.userId : null) ?? null,
      ...(body?.expiresInHours ? { expiresInHours: body.expiresInHours } : {}),
    });
    return c.json(
      {
        token: out.token,
        url: new URL(`/approve/${out.token}`, ctn.env.PUBLIC_URL).toString(),
        expiresAt: out.expiresAt.toISOString(),
      },
      201,
    );
  });

  path(app, {
    method: 'delete',
    path: '/posts/{groupId}/approval-link',
    tags: ['public-posts'],
    summary: 'Revoga o link de aprovação pendente (escopo posts:write)',
    request: { params: GroupParam },
    responses: {
      200: jsonResponse('resultado', z.object({ revoked: z.boolean() })),
      ...errorResponses(401, 403, 429),
    },
  });
  app.delete('/posts/:groupId/approval-link', requireScope('posts:write'), async (c) => {
    const p = c.get('principal');
    const out = await ctn.approvals.revokeLink({
      orgId: p.orgId,
      groupId: c.req.param('groupId'),
      actorType: p.kind === 'api_key' ? 'API_KEY' : 'USER',
      actorId: (p.kind === 'user' ? p.userId : null) ?? null,
    });
    return c.json(out);
  });

  // ==================== PUBLICATIONS (feed) ====================
  path(app, {
    method: 'get',
    path: '/publications',
    tags: ['public-publications'],
    summary: 'Feed flat de publicações — status por canal (escopo posts:read)',
    description: 'Uma linha por publicação; paginação keyset por (publishAt, id).',
    request: { query: FeedQueryDoc },
    responses: { 200: jsonResponse('página do feed', PubFeed), ...errorResponses(400, 401, 403, 429) },
  });
  app.get('/publications', requireScope('posts:read'), async (c) => {
    const q = FeedQuery.parse(c.req.query());
    const cursor = q.cursor ? decodeCursor(q.cursor) : undefined;
    const rows = await ctn.posts.feed(c.get('principal').orgId, {
      ...(q.from ? { from: new Date(q.from) } : {}),
      ...(q.to ? { to: new Date(q.to) } : {}),
      ...(q.state ? { states: q.state } : {}),
      ...(q.channelId ? { channelIds: q.channelId } : {}),
      ...(cursor ? { cursor } : {}),
      limit: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return c.json({
      items: page.map(serializeFeedItem),
      nextCursor: rows.length > q.limit && last ? encodeCursor(last.publishAt, last.id) : null,
    });
  });

  // ==================== CHANNELS ====================
  path(app, {
    method: 'get',
    path: '/channels',
    tags: ['public-channels'],
    summary: 'Lista os canais conectados (escopo channels:read)',
    responses: { 200: jsonResponse('canais', z.array(PubChannel)), ...errorResponses(401, 403, 429) },
  });
  app.get('/channels', requireScope('channels:read'), async (c) =>
    c.json(await ctn.channels.list(c.get('principal').orgId)),
  );

  path(app, {
    method: 'get',
    path: '/channels/providers',
    tags: ['public-channels'],
    summary: 'Catálogo de providers disponíveis + capacidades (escopo channels:read)',
    responses: {
      200: jsonResponse('providers', z.array(z.record(z.unknown()))),
      ...errorResponses(401, 403, 429),
    },
  });
  app.get('/channels/providers', requireScope('channels:read'), (c) =>
    c.json(
      ctn.registry
        .list()
        .filter((p) => isProviderAvailable(p, ctn.providerSecrets))
        .map(providerCatalogEntry),
    ),
  );

  path(app, {
    method: 'delete',
    path: '/channels/{id}',
    tags: ['public-channels'],
    summary: 'Desconecta um canal (escopo channels:write)',
    request: { params: IdParam },
    responses: { 204: { description: 'canal desconectado' }, ...errorResponses(401, 403, 404, 429) },
  });
  app.delete('/channels/:id', requireScope('channels:write'), async (c) => {
    await ctn.channels.disconnect(c.get('principal').orgId, c.req.param('id'));
    return c.body(null, 204);
  });

  // ==================== MEDIA ====================
  path(app, {
    method: 'post',
    path: '/media/upload',
    tags: ['public-media'],
    summary: 'Envia mídia multipart — MIME real por magic bytes (escopo media:write)',
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({ file: z.string().openapi({ format: 'binary' }), alt: z.string().optional() }),
          },
        },
      },
    },
    responses: { 201: jsonResponse('mídia criada', PubMedia), ...errorResponses(400, 401, 403, 429) },
  });
  app.post('/media/upload', requireScope('media:write'), async (c) => {
    const form = await c.req.formData().catch(() => {
      throw new DomainError(ErrorCodes.PostInvalidSettings, 'envie multipart/form-data com o campo "file"');
    });
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new DomainError(ErrorCodes.PostInvalidSettings, 'campo "file" (arquivo) é obrigatório');
    }
    const alt = form.get('alt');
    const record = await ctn.media.upload({
      orgId: c.get('principal').orgId,
      bytes: new Uint8Array(await file.arrayBuffer()),
      ...(typeof alt === 'string' && alt ? { alt } : {}),
    });
    return c.json(serializeMedia(ctn, record), 201);
  });

  path(app, {
    method: 'post',
    path: '/media/from-url',
    tags: ['public-media'],
    summary: 'Importa mídia por URL (anti-SSRF) (escopo media:write)',
    request: jsonBody(FromUrlBody),
    responses: { 201: jsonResponse('mídia criada', PubMedia), ...errorResponses(400, 401, 403, 429) },
  });
  app.post('/media/from-url', requireScope('media:write'), async (c) => {
    const body = FromUrlBody.parse(await c.req.json());
    const record = await ctn.media.fromUrl({
      orgId: c.get('principal').orgId,
      url: body.url,
      ...(body.alt ? { alt: body.alt } : {}),
    });
    return c.json(serializeMedia(ctn, record), 201);
  });

  path(app, {
    method: 'get',
    path: '/media',
    tags: ['public-media'],
    summary: 'Lista a biblioteca de mídia (escopo media:write)',
    request: { query: z.object({ limit: z.string().optional().openapi({ example: '50' }) }) },
    responses: { 200: jsonResponse('itens de mídia', z.array(PubMedia)), ...errorResponses(401, 403, 429) },
  });
  app.get('/media', requireScope('media:write'), async (c) => {
    const limit = Number(c.req.query('limit') ?? 50);
    const items = await ctn.media.list(c.get('principal').orgId, {
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return c.json(items.map((m) => serializeMedia(ctn, m)));
  });

  // ==================== WEBHOOKS ====================
  path(app, {
    method: 'get',
    path: '/webhooks',
    tags: ['public-webhooks'],
    summary: 'Lista os webhooks de saída (escopo webhooks:manage)',
    responses: { 200: jsonResponse('webhooks', z.array(PubWebhook)), ...errorResponses(401, 403, 429) },
  });
  app.get('/webhooks', requireScope('webhooks:manage'), async (c) =>
    c.json(await ctn.webhooks.list(c.get('principal').orgId)),
  );

  path(app, {
    method: 'post',
    path: '/webhooks',
    tags: ['public-webhooks'],
    summary: 'Cria um webhook — entrega assinada HMAC (escopo webhooks:manage)',
    description: 'O secret whsec_ é retornado só aqui.',
    request: jsonBody(WebhookCreateBody),
    responses: {
      201: jsonResponse(
        'webhook criado (secret só aqui)',
        z.object({ secret: z.string(), webhook: PubWebhook }),
      ),
      ...errorResponses(400, 401, 403, 429),
    },
  });
  app.post('/webhooks', requireScope('webhooks:manage'), async (c) => {
    const body = WebhookCreateBody.parse(await c.req.json());
    const out = await ctn.webhooks.create({
      orgId: c.get('principal').orgId,
      name: body.name,
      url: body.url,
      events: body.events,
      ...(body.channelIds ? { channelIds: body.channelIds } : {}),
    });
    return c.json(out, 201);
  });

  path(app, {
    method: 'delete',
    path: '/webhooks/{id}',
    tags: ['public-webhooks'],
    summary: 'Remove um webhook (escopo webhooks:manage)',
    request: { params: IdParam },
    responses: { 204: { description: 'webhook removido' }, ...errorResponses(401, 403, 404, 429) },
  });
  app.delete('/webhooks/:id', requireScope('webhooks:manage'), async (c) => {
    await ctn.webhooks.remove(c.get('principal').orgId, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
