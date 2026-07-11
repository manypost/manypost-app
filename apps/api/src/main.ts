import { fileURLToPath } from 'node:url';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { loadEnv } from '@manypost/config';
import { runMigrations } from '@manypost/db';
import { providerRegistry } from '@manypost/providers';
import { buildContainer } from './container';
import { correlationId, type AppEnv } from './http/middleware/context';
import { errorHandler } from './http/middleware/error';
import { apiKeyRoutes } from './http/routes/api-keys.routes';
import { authRoutes } from './http/routes/auth.routes';
import { channelRoutes } from './http/routes/channels.routes';
import { postRoutes } from './http/routes/posts.routes';
import { socialAuthRoutes } from './http/routes/social-auth.routes';

const env = loadEnv();

if (env.DB_MIGRATE === 'auto') {
  const migrationsFolder = fileURLToPath(
    new URL('../../../packages/db/migrations', import.meta.url),
  );
  await runMigrations(env.DATABASE_URL, migrationsFolder);
  console.log(JSON.stringify({ level: 'info', msg: 'migrations aplicadas' }));
}

const ctn = await buildContainer(env);
if (env.MODE !== 'api') {
  await ctn.runtime.startWorker(); // MODE=all|worker: consome a fila no mesmo processo
}
const app = new OpenAPIHono<AppEnv>();

app.use('*', correlationId());
app.onError(errorHandler);

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

app.route('/v1/auth/social', socialAuthRoutes(ctn));
app.route('/v1/auth', authRoutes(ctn));
app.route('/v1/api-keys', apiKeyRoutes(ctn));
app.route('/v1/channels', channelRoutes(ctn));
app.route('/v1/posts', postRoutes(ctn));

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'manypost API', version: '0.0.1' },
});

// Fase 1: channels, posts, media, analytics, public-v1 e /mcp.
console.log(`manypost api (MODE=${env.MODE}) on :${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };
