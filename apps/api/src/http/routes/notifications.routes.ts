import { z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonResponse } from '../openapi';

const NotificationOut = z
  .object({
    id: z.string(),
    kind: z.string().openapi({ example: 'approval.resolved' }),
    title: z.string(),
    body: z.string().nullable(),
    link: z.string().nullable(),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('Notification');

/** Notificações da org (ex.: cliente aprovou/pediu ajustes). */
export function notificationRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/',
    tags: ['notifications'],
    security: AUTH_SECURITY,
    summary: 'Lista as notificações da organização',
    responses: { 200: jsonResponse('notificações', z.array(NotificationOut)), ...errorResponses(401) },
  });
  app.get('/', async (c) => {
    const rows = await ctn.notifications.list(c.get('principal').orgId);
    return c.json(
      rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/read-all',
    tags: ['notifications'],
    security: AUTH_SECURITY,
    summary: 'Marca todas as notificações como lidas',
    responses: {
      200: jsonResponse('quantas foram marcadas', z.object({ read: z.number().int() })),
      ...errorResponses(401),
    },
  });
  app.post('/read-all', async (c) =>
    c.json({ read: await ctn.notifications.markAllRead(c.get('principal').orgId) }),
  );

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/{id}/read',
    tags: ['notifications'],
    security: AUTH_SECURITY,
    summary: 'Marca uma notificação como lida (idempotente)',
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: jsonResponse('lida', z.object({ read: z.literal(true) })),
      ...errorResponses(401, 404),
    },
  });
  app.post('/:id/read', async (c) => {
    const ok = await ctn.notifications.markRead(c.get('principal').orgId, c.req.param('id'));
    if (!ok) throw new DomainError(ErrorCodes.NotFound, 'notificação não encontrada');
    return c.json({ read: true });
  });

  return app;
}
