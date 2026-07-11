import { OpenAPIHono, z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

const ScheduleBody = z.object({
  text: z.string().min(1).max(10_000),
  channelIds: z.array(z.string().uuid()).min(1).max(20),
  publishAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
  settingsByChannel: z.record(z.unknown()).optional(),
});

const serializeGroup = (g: NonNullable<Awaited<ReturnType<Container['posts']['getGroup']>>>) => ({
  id: g.id,
  state: g.state,
  publishAt: g.publishAt?.toISOString() ?? null,
  publications: g.publications.map((p) => ({
    id: p.id,
    channelId: p.channelId,
    state: p.state,
    attemptCount: p.attemptCount,
    externalId: p.externalId,
    releaseUrl: p.releaseUrl,
    errorClass: p.errorClass,
    errorMessage: p.errorMessage,
  })),
});

export function postRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

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
    });
    return c.json(serializeGroup(group!), 201);
  });

  app.get('/:groupId', async (c) => {
    const group = await ctn.posts.getGroup(c.get('principal').orgId, c.req.param('groupId'));
    if (!group) throw new DomainError(ErrorCodes.NotFound, 'post não encontrado');
    return c.json(serializeGroup(group));
  });

  return app;
}
