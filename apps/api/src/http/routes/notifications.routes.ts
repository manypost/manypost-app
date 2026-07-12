import { OpenAPIHono } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

/** Notificações da org (ex.: cliente aprovou/pediu ajustes). */
export function notificationRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

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

  app.post('/read-all', async (c) =>
    c.json({ read: await ctn.notifications.markAllRead(c.get('principal').orgId) }),
  );

  app.post('/:id/read', async (c) => {
    const ok = await ctn.notifications.markRead(c.get('principal').orgId, c.req.param('id'));
    if (!ok) throw new DomainError(ErrorCodes.NotFound, 'notificação não encontrada');
    return c.json({ read: true });
  });

  return app;
}
