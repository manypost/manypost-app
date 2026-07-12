import { OpenAPIHono } from '@hono/zod-openapi';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

/** Notificações da org (ex.: cliente aprovou/pediu ajustes). Marcar como lida: fatia do SSE. */
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

  return app;
}
