import { z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonBody, jsonResponse } from '../openapi';

const ScheduleBody = z.object({
  text: z.string().min(1).max(10_000),
  channelIds: z.array(z.string().uuid()).min(1).max(20),
  publishAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
  settingsByChannel: z.record(z.unknown()).optional(),
  /** override do texto do post principal por canal (chave = channelId); réplicas de thread são globais.
   *  Atenção: PATCH de texto sobrescreve o content de TODAS as publicações (reseta overrides). */
  textByChannel: z.record(z.string().min(1).max(10_000)).optional(),
  mediaIds: z.array(z.string().uuid()).max(10).optional(),
  /** réplicas encadeadas após o post principal; delaySec = espera antes de cada uma */
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
  /** true = nasce rascunho aguardando aprovação por link público (DECISIONS v1.1 §12) */
  requireApproval: z.boolean().optional(),
});

const serializeGroup = (g: NonNullable<Awaited<ReturnType<Container['posts']['getGroup']>>>) => ({
  id: g.id,
  state: g.state,
  publishAt: g.publishAt?.toISOString() ?? null,
  publications: g.publications.map((p) => ({
    id: p.id,
    channelId: p.channelId,
    state: p.state,
    media: p.content.media ?? [],
    itemCount: p.itemCount ?? 1,
    /** progresso da thread: itens <= índice já estão na rede */
    lastPublishedIndex: p.lastPublishedIndex,
    attemptCount: p.attemptCount,
    externalId: p.externalId,
    releaseUrl: p.releaseUrl,
    errorClass: p.errorClass,
    errorMessage: p.errorMessage,
  })),
});

// ---- schemas de resposta (documentação; serializeGroup é a fonte em runtime) ----
const MediaRefOut = z
  .object({
    mediaId: z.string().optional(),
    type: z.string().openapi({ example: 'image' }),
    url: z.string(),
    mime: z.string().openapi({ example: 'image/png' }),
    alt: z.string().nullable().optional(),
  })
  .openapi('MediaRef');

const PublicationOut = z
  .object({
    id: z.string(),
    channelId: z.string(),
    state: z.string().openapi({ example: 'SCHEDULED' }),
    media: z.array(MediaRefOut),
    itemCount: z.number().int().openapi({ description: 'itens da thread (1 = post simples)' }),
    lastPublishedIndex: z
      .number()
      .int()
      .nullable()
      .openapi({ description: 'cursor da thread: itens ≤ este índice já estão na rede' }),
    attemptCount: z.number().int(),
    externalId: z.string().nullable(),
    releaseUrl: z.string().nullable(),
    errorClass: z.string().nullable(),
    errorMessage: z.string().nullable(),
  })
  .openapi('Publication');

const GroupOut = z
  .object({
    id: z.string(),
    state: z.string().openapi({ example: 'SCHEDULED' }),
    publishAt: z.string().datetime().nullable(),
    publications: z.array(PublicationOut),
  })
  .openapi('PostGroup');

const ApprovalLinkOut = z
  .object({
    token: z.string().openapi({ description: 'token opaco ≥256 bits — só aparece aqui' }),
    url: z.string(),
    expiresAt: z.string().datetime(),
  })
  .openapi('ApprovalLink');

const ApprovalLinkStatusOut = z
  .object({
    status: z.string().openapi({ example: 'PENDING' }),
    feedback: z.string().nullable(),
    approverName: z.string().nullable(),
    expiresAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .nullable()
  .openapi('ApprovalLinkStatus');

const GroupParam = z.object({ groupId: z.string().uuid() });

export function postRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/',
    tags: ['posts'],
    security: AUTH_SECURITY,
    summary: 'Agenda um post (1 grupo → 1 publicação por canal)',
    description:
      'Valida texto/mídia por canal e enfileira. `textByChannel` personaliza o texto do post principal por canal; `thread` cria réplicas encadeadas; `requireApproval` nasce DRAFT aguardando aprovação por link.',
    request: jsonBody(ScheduleBody),
    responses: {
      201: jsonResponse('grupo agendado (ou DRAFT se requireApproval)', GroupOut),
      ...errorResponses(400, 401, 404),
    },
  });
  app.post('/', async (c) => {
    const body = ScheduleBody.parse(await c.req.json());
    const p = c.get('principal');
    const group = await ctn.posts.schedule({
      orgId: p.orgId,
      authorId: p.userId ?? null,
      text: body.text,
      channelIds: body.channelIds,
      publishAt: new Date(body.publishAt),
      timezone: body.timezone,
      origin: p.kind === 'api_key' ? 'API' : 'WEB',
      ...(body.settingsByChannel ? { settingsByChannel: body.settingsByChannel } : {}),
      ...(body.textByChannel ? { textByChannel: body.textByChannel } : {}),
      ...(body.mediaIds ? { mediaIds: body.mediaIds } : {}),
      ...(body.thread ? { thread: body.thread } : {}),
      ...(body.requireApproval ? { requireApproval: true } : {}),
    });
    return c.json(serializeGroup(group!), 201);
  });

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/{groupId}',
    tags: ['posts'],
    security: AUTH_SECURITY,
    summary: 'Detalhe de um grupo de post',
    request: { params: GroupParam },
    responses: { 200: jsonResponse('grupo', GroupOut), ...errorResponses(401, 404) },
  });
  app.get('/:groupId', async (c) => {
    const group = await ctn.posts.getGroup(c.get('principal').orgId, c.req.param('groupId'));
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    return c.json(serializeGroup(group));
  });

  const PatchBody = z
    .object({ text: z.string().min(1).max(10_000).optional(), publishAt: z.string().datetime().optional() })
    .refine((b) => b.text !== undefined || b.publishAt !== undefined, {
      message: 'informe text e/ou publishAt',
    });

  app.openAPIRegistry.registerPath({
    method: 'patch',
    path: '/{groupId}',
    tags: ['posts'],
    security: AUTH_SECURITY,
    summary: 'Edita texto e/ou horário (re-agenda com nova versão de job)',
    request: { params: GroupParam, ...jsonBody(PatchBody) },
    responses: { 200: jsonResponse('grupo re-agendado', GroupOut), ...errorResponses(400, 401, 404) },
  });
  app.patch('/:groupId', async (c) => {
    const body = PatchBody.parse(await c.req.json());
    const group = await ctn.posts.reschedule({
      orgId: c.get('principal').orgId,
      groupId: c.req.param('groupId'),
      ...(body.text !== undefined ? { text: body.text } : {}),
      ...(body.publishAt ? { publishAt: new Date(body.publishAt) } : {}),
    });
    return c.json(serializeGroup(group!));
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/{groupId}/cancel',
    tags: ['posts'],
    security: AUTH_SECURITY,
    summary: 'Cancela um grupo agendado (job antigo morre por versão)',
    request: { params: GroupParam },
    responses: { 200: jsonResponse('grupo cancelado', GroupOut), ...errorResponses(401, 404) },
  });
  app.post('/:groupId/cancel', async (c) => {
    const group = await ctn.posts.cancel(c.get('principal').orgId, c.req.param('groupId'));
    return c.json(serializeGroup(group!));
  });

  const RetryBody = z.object({ channelId: z.string().uuid().optional() }).optional();

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/{groupId}/retry',
    tags: ['posts'],
    security: AUTH_SECURITY,
    summary: 'Tenta publicar de novo (FAILED/NEEDS_REVIEW → SCHEDULED)',
    description: 'Kanban "tentar novamente". Com `channelId` no corpo, retenta só aquele canal.',
    request: {
      params: GroupParam,
      ...jsonBody(z.object({ channelId: z.string().uuid().optional() }), false),
    },
    responses: { 200: jsonResponse('grupo re-agendado', GroupOut), ...errorResponses(400, 401, 404) },
  });
  // kanban "tentar novamente" (por canal quando channelId vem no body)
  app.post('/:groupId/retry', async (c) => {
    const body = RetryBody.parse(await c.req.json().catch(() => undefined));
    const group = await ctn.posts.retry({
      orgId: c.get('principal').orgId,
      groupId: c.req.param('groupId'),
      ...(body?.channelId ? { channelId: body.channelId } : {}),
    });
    return c.json(serializeGroup(group!));
  });

  // ---- aprovação por link público (DECISIONS v1.1 §12) ----

  const ApprovalLinkBody = z
    .object({ expiresInHours: z.number().int().min(1).max(720).optional() })
    .optional();

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/{groupId}/approval-link',
    tags: ['posts', 'approvals'],
    security: AUTH_SECURITY,
    summary: 'Cria o link público de aprovação de um rascunho',
    description: 'Só para grupos DRAFT (requireApproval). Criar de novo revoga o link anterior.',
    request: {
      params: GroupParam,
      ...jsonBody(
        z.object({ expiresInHours: z.number().int().min(1).max(720).optional() }),
        false,
      ),
    },
    responses: { 201: jsonResponse('link criado (token só aqui)', ApprovalLinkOut), ...errorResponses(400, 401, 404) },
  });
  app.post('/:groupId/approval-link', async (c) => {
    const body = ApprovalLinkBody.parse(await c.req.json().catch(() => undefined));
    const p = c.get('principal');
    const out = await ctn.approvals.createLink({
      orgId: p.orgId,
      groupId: c.req.param('groupId'),
      actorType: p.kind === 'api_key' ? 'API_KEY' : 'USER',
      actorId: (p.kind === 'user' ? p.userId : null) ?? null,
      ...(body?.expiresInHours ? { expiresInHours: body.expiresInHours } : {}),
    });
    // o token só existe nesta resposta (o banco guarda o hash);
    // a URL é a rota pública do web app (SPEC_FRONTEND §3.6)
    return c.json(
      {
        token: out.token,
        url: new URL(`/approve/${out.token}`, ctn.env.PUBLIC_URL).toString(),
        expiresAt: out.expiresAt.toISOString(),
      },
      201,
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/{groupId}/approval-link',
    tags: ['posts', 'approvals'],
    security: AUTH_SECURITY,
    summary: 'Status do link de aprovação mais recente (ou null)',
    request: { params: GroupParam },
    responses: {
      200: jsonResponse('status do link (null se nunca houve)', ApprovalLinkStatusOut),
      ...errorResponses(401),
    },
  });
  app.get('/:groupId/approval-link', async (c) => {
    const status = await ctn.approvals.linkStatus(c.get('principal').orgId, c.req.param('groupId'));
    return c.json(status);
  });

  app.openAPIRegistry.registerPath({
    method: 'delete',
    path: '/{groupId}/approval-link',
    tags: ['posts', 'approvals'],
    security: AUTH_SECURITY,
    summary: 'Revoga o link de aprovação pendente',
    request: { params: GroupParam },
    responses: {
      200: jsonResponse('resultado', z.object({ revoked: z.boolean() })),
      ...errorResponses(401),
    },
  });
  app.delete('/:groupId/approval-link', async (c) => {
    const p = c.get('principal');
    const out = await ctn.approvals.revokeLink({
      orgId: p.orgId,
      groupId: c.req.param('groupId'),
      actorType: p.kind === 'api_key' ? 'API_KEY' : 'USER',
      actorId: (p.kind === 'user' ? p.userId : null) ?? null,
    });
    return c.json(out);
  });

  return app;
}
