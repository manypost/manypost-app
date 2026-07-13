import { fileURLToPath } from 'node:url';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { loadEnv } from '@manypost/config';
import { runMigrations } from '@manypost/db';
import { providerRegistry } from '@manypost/providers';
import { buildContainer } from './container';
import { correlationId, type AppEnv } from './http/middleware/context';
import { errorHandler } from './http/middleware/error';
import { apiKeyRoutes } from './http/routes/api-keys.routes';
import { approvalPublicRoutes } from './http/routes/approvals-public.routes';
import { authRoutes } from './http/routes/auth.routes';
import { channelRoutes } from './http/routes/channels.routes';
import { eventRoutes } from './http/routes/events.routes';
import { mediaRoutes, publicUploadRoutes } from './http/routes/media.routes';
import { notificationRoutes } from './http/routes/notifications.routes';
import { postRoutes } from './http/routes/posts.routes';
import { publicationRoutes } from './http/routes/publications.routes';
import { socialAuthRoutes } from './http/routes/social-auth.routes';
import { webhookRoutes } from './http/routes/webhooks.routes';

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
app.route('/v1/publications', publicationRoutes(ctn)); // feed do calendário/kanban
app.route('/v1/events', eventRoutes(ctn)); // SSE
app.route('/v1/media', mediaRoutes(ctn));
app.route('/v1/webhooks', webhookRoutes(ctn));
app.route('/v1/notifications', notificationRoutes(ctn));
app.route('/uploads', publicUploadRoutes(ctn)); // arquivos públicos (chaves UUID, não enumeráveis)
app.route('/public/approval', approvalPublicRoutes(ctn)); // aprovação por token, sem login (§12)

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'manypost API', version: '0.0.1' },
});

// Explorador de API no navegador (Scalar) — superfície de teste até existir o apps/web.
// Lê o /openapi.json desta mesma origem; o bundle da UI vem de CDN (precisa de internet só p/
// carregar a página — as chamadas à API são locais). É read-only e a API segue protegida por auth.
app.get('/docs', (c) =>
  c.html(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>manypost API — explorador</title>
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`),
);

// Página inicial: orienta quem abrir a raiz no navegador (evita um 404 sem contexto).
app.get('/', (c) =>
  c.html(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>manypost</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.6; }
      code { background: #f2f2f2; padding: .1rem .35rem; border-radius: 4px; }
      a { color: #1a56db; }
    </style>
  </head>
  <body>
    <h1>manypost</h1>
    <p>Backend no ar. Ainda não há tela visual — você testa pela API.</p>
    <ul>
      <li><a href="/docs">/docs</a> — explorador de API (clique e dispare requisições)</li>
      <li><a href="/health">/health</a> — status e providers disponíveis</li>
      <li><a href="/openapi.json">/openapi.json</a> — especificação OpenAPI</li>
    </ul>
    <p>Passo a passo para testar: veja o <code>TESTING.md</code> no repositório.</p>
  </body>
</html>`),
);

// Fase 1 restante: providers onda 1, semáforo+métricas, analytics, public-v1 e /mcp.
console.log(`manypost api (MODE=${env.MODE}) on :${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };
