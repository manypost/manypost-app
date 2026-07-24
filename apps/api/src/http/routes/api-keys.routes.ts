import { createRoute, z } from '@hono/zod-openapi';
import { ApiScopes } from '@manypost/contracts';
import type { Container } from '../../container';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses } from '../openapi';

const KeyOut = z
  .object({
    id: z.string(),
    name: z.string(),
    prefix: z.string(),
    scopes: z.array(z.string()),
    lastUsedAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('ApiKey');
const CreateKeyBody = z.object({
  name: z.string().min(1).max(60),
  scopes: z.array(z.enum(ApiScopes)).min(1),
});

const serialize = (r: {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  scopes: r.scopes,
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  revokedAt: r.revokedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

export function apiKeyRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({
    authenticateHuman: ctn.auth.authenticateHuman,
  }));
  app.use('*', requireAdmin());

  app.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['api-keys'],
      security: AUTH_SECURITY,
      summary: 'Lista as API keys da organização',
      responses: {
        200: {
          description: 'API keys da organização (sem hash — chave só aparece na criação)',
          content: { 'application/json': { schema: z.array(KeyOut) } },
        },
        ...errorResponses(401, 403),
      },
    }),
    async (c) => {
      const list = await ctn.auth.listApiKeys(c.get('principal').orgId);
      return c.json(list.map(serialize), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['api-keys'],
      security: AUTH_SECURITY,
      summary: 'Cria uma API key (mp_live_…) com escopos',
      request: { body: { content: { 'application/json': { schema: CreateKeyBody } } } },
      responses: {
        201: {
          description: 'a apiKey em claro aparece SOMENTE nesta resposta',
          content: {
            'application/json': { schema: z.object({ apiKey: z.string(), record: KeyOut }) },
          },
        },
        ...errorResponses(400, 401, 403),
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const out = await ctn.auth.createApiKey({
        orgId: c.get('principal').orgId,
        name: body.name,
        scopes: body.scopes,
      });
      return c.json({ apiKey: out.apiKey, record: serialize(out.record) }, 201);
    },
  );

  app.openAPIRegistry.registerPath({
    method: 'delete',
    path: '/{id}',
    tags: ['api-keys'],
    security: AUTH_SECURITY,
    summary: 'Revoga uma API key',
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: 'chave revogada' }, ...errorResponses(401, 403) },
  });
  app.delete('/:id', async (c) => {
    await ctn.auth.revokeApiKey({ orgId: c.get('principal').orgId, id: c.req.param('id') });
    return c.body(null, 204);
  });

  return app;
}
