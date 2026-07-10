import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { loadEnv } from '@manypost/config';
import { providerRegistry } from '@manypost/providers';

const env = loadEnv();
const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    responses: {
      200: {
        description: 'health check',
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('ok'), providers: z.array(z.string()) }),
          },
        },
      },
    },
  }),
  (c) =>
    c.json({
      status: 'ok' as const,
      providers: providerRegistry.list().map((p) => p.id),
    }),
);

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'manypost API', version: '0.0.1' },
});

// Fase 1: montar http/routes/* (auth, channels, posts, media, analytics, public-v1),
// middleware (correlation-id, auth, org-scope, rate-limit, error-mapper) e /mcp.
console.log(`manypost api (MODE=${env.MODE}) on :${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };
