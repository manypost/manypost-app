import { OpenAPIHono, z } from '@hono/zod-openapi';
import { WebhookEvents } from '@manypost/contracts';
import type { Container } from '../../container';
import { requireAdmin, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

const CreateBody = z.object({
  name: z.string().min(1).max(60),
  url: z.string().url(),
  events: z.array(z.enum(Object.values(WebhookEvents) as [string, ...string[]])).min(1),
  channelIds: z.array(z.string().uuid()).optional(),
});

export function webhookRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));
  app.use('*', requireAdmin());

  app.get('/', async (c) => c.json(await ctn.webhooks.list(c.get('principal').orgId)));

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

  app.delete('/:id', async (c) => {
    await ctn.webhooks.remove(c.get('principal').orgId, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
