import { z } from '@hono/zod-openapi';
import { WebhookEvents } from '@manypost/contracts';
import type { Container } from '../../container';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonBody, jsonResponse } from '../openapi';

const CreateBody = z.object({
  name: z.string().min(1).max(60),
  url: z.string().url(),
  events: z.array(z.enum(Object.values(WebhookEvents) as [string, ...string[]])).min(1),
  channelIds: z.array(z.string().uuid()).optional(),
});

const WebhookOut = z
  .object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    events: z.array(z.string()),
    channelIds: z.array(z.string()),
    disabledAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('Webhook');

const WebhookCreated = z
  .object({
    secret: z.string().openapi({ description: 'whsec_… — só aparece nesta resposta' }),
    webhook: WebhookOut,
  })
  .openapi('WebhookCreated');

export function webhookRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));
  app.use('*', requireAdmin());

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/',
    tags: ['webhooks'],
    security: AUTH_SECURITY,
    summary: 'Lista os webhooks de saída',
    responses: { 200: jsonResponse('webhooks', z.array(WebhookOut)), ...errorResponses(401, 403) },
  });
  app.get('/', async (c) => c.json(await ctn.webhooks.list(c.get('principal').orgId)));

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/',
    tags: ['webhooks'],
    security: AUTH_SECURITY,
    summary: 'Cria um webhook (entrega assinada HMAC)',
    description: 'O secret whsec_ é retornado só aqui — o receptor valida a assinatura com ele.',
    request: jsonBody(CreateBody),
    responses: { 201: jsonResponse('webhook criado', WebhookCreated), ...errorResponses(400, 401, 403) },
  });
  app.post('/', async (c) => {
    const body = CreateBody.parse(await c.req.json());
    const out = await ctn.webhooks.create({
      orgId: c.get('principal').orgId,
      name: body.name,
      url: body.url,
      events: body.events,
      ...(body.channelIds ? { channelIds: body.channelIds } : {}),
    });
    // o secret (whsec_*) só aparece nesta resposta — o receptor valida a assinatura com ele
    return c.json(out, 201);
  });

  app.openAPIRegistry.registerPath({
    method: 'delete',
    path: '/{id}',
    tags: ['webhooks'],
    security: AUTH_SECURITY,
    summary: 'Remove um webhook',
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: 'webhook removido' }, ...errorResponses(401, 403, 404) },
  });
  app.delete('/:id', async (c) => {
    await ctn.webhooks.remove(c.get('principal').orgId, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
