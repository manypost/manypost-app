import { fileURLToPath } from 'node:url';
import { createRoute, z } from '@hono/zod-openapi';
import { loadEnv, machineEndpoints, machineHosts } from '@manypost/config';
import { runMigrations } from '@manypost/db';
import { providerRegistry } from '@manypost/providers';
import { buildContainer } from './container';
import { humansOnly } from './http/middleware/auth';
import { createApp } from './http/openapi';
import { buildSurfaceRouter, installBaseMiddleware } from './http/surfaces';
import { apiKeyRoutes } from './http/routes/api-keys.routes';
import { approvalPublicRoutes } from './http/routes/approvals-public.routes';
import { authRoutes } from './http/routes/auth.routes';
import { billingRoutes } from './http/routes/billing.routes';
import { capabilityRoutes } from './http/routes/capabilities.routes';
import { channelRoutes } from './http/routes/channels.routes';
import { eventRoutes } from './http/routes/events.routes';
import { mcpRoutes } from './http/routes/mcp.routes';
import { mediaRoutes, publicUploadRoutes } from './http/routes/media.routes';
import { notificationRoutes } from './http/routes/notifications.routes';
import { postRoutes } from './http/routes/posts.routes';
import { publicV1Routes } from './http/routes/public/public-v1.routes';
import { publicationRoutes } from './http/routes/publications.routes';
import { socialAuthRoutes } from './http/routes/social-auth.routes';
import { stripeWebhookRoutes } from './http/routes/stripe-webhook.routes';
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
const app = createApp();

installBaseMiddleware(app, ctn); // correlation id + histograma HTTP + problem+json

// /metrics (SPEC_INFRA §4): exposição Prometheus. Se METRICS_TOKEN estiver setado, exige
// Authorization: Bearer <token>; senão fica aberto (self-hosted em rede privada). A profundidade
// da fila é lida sob demanda (pull) logo antes de renderizar. Não entra no /openapi.json.
app.get('/metrics', async (c) => {
  if (env.METRICS_TOKEN && c.req.header('authorization') !== `Bearer ${env.METRICS_TOKEN}`) {
    return c.text('unauthorized', 401);
  }
  ctn.metrics.setQueueDepth(await ctn.runtime.queueDepths());
  c.header('content-type', 'text/plain; version=0.0.4; charset=utf-8');
  c.header('cache-control', 'no-store');
  return c.body(ctn.metrics.render());
});

// Schemes de autenticação referenciados pelas rotas protegidas (SPEC_API_MCP §1-2).
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'JWT de acesso OU API key mp_live_ — enviado como Authorization: Bearer <token>',
});
app.openAPIRegistry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'mp_at',
  description: 'cookie de sessão httpOnly (fluxo web)',
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['health'],
    summary: 'Status e providers de rede disponíveis',
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

// `/v1` é a superfície da INTERFACE (humano por cookie/JWT, autorização por papel). Máquina
// tem porta própria — com escopos, gate de plano e rate-limit por credencial (SPEC_API_MCP §3).
app.use('/v1/*', humansOnly(machineEndpoints(env).restBaseUrl));

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
app.route('/v1/capabilities', capabilityRoutes(ctn)); // plano/features desta org (sempre existe)
if (ctn.billing) {
  // gerenciado apenas (IS_SELF_HOSTED=false + Stripe): em self-hosted estas rotas não existem
  app.route('/v1/billing', billingRoutes(ctn));
  app.route('/v1/stripe', stripeWebhookRoutes(ctn));
}
app.route('/uploads', publicUploadRoutes(ctn)); // arquivos públicos (chaves UUID, não enumeráveis)
app.route('/public/approval', approvalPublicRoutes(ctn)); // aprovação por token, sem login (§12)

// Superfícies de MÁQUINA — instâncias únicas: as mesmas são montadas nos hosts dedicados
// (`api.`/`mcp.`) pelo roteador de superfícies. Aqui elas seguem nos caminhos históricos, que
// é o que o self-host de origem única usa (e o que já está publicado).
const publicV1 = publicV1Routes(ctn); // escopos + gate de plano + rate-limit + idempotência
const mcp = mcpRoutes(ctn); // Streamable HTTP; o registro de sessões vive no closure
app.route('/public/v1', publicV1);
app.route('/mcp', mcp);

// OpenAPI: cada rota é documentada com schemas reais de request/response/erro via
// createRoute (auth/api-keys/health) ou app.openAPIRegistry.registerPath (o restante,
// que usa handlers .get/.post). O laço abaixo é apenas uma REDE DE SEGURANÇA: se alguma
// rota nova for montada sem documentação, entra no /openapi.json como stub mínimo (só
// método + caminho) para não sumir do explorador — não sobrescreve nada já documentado.
const OPENAPI_DOC = {
  openapi: '3.1.0' as const,
  info: {
    title: 'manypost API',
    version: '0.0.1',
    description:
      'API do manypost — agendamento/publicação multicanal. Autentique com `Authorization: Bearer <jwt|mp_live_…>` ou cookie de sessão httpOnly. Erros seguem problem+json (RFC 9457): o campo `title` carrega o código estável do erro.',
  },
  servers: [{ url: env.PUBLIC_URL, description: 'esta instalação' }],
  tags: [
    { name: 'auth', description: 'contas, sessões e login social' },
    { name: 'api-keys', description: 'chaves de API por escopo' },
    { name: 'channels', description: 'conexão de canais de rede social' },
    { name: 'posts', description: 'agendar, editar, cancelar, retry, aprovação por link' },
    { name: 'publications', description: 'feed de calendário/kanban' },
    { name: 'media', description: 'biblioteca de mídia' },
    { name: 'webhooks', description: 'webhooks de saída assinados' },
    { name: 'notifications', description: 'notificações da organização' },
    { name: 'events', description: 'stream SSE em tempo real' },
    { name: 'capabilities', description: 'plano, features e limites da organização' },
    { name: 'billing', description: 'assinatura e cobrança (só no serviço gerenciado)' },
    { name: 'approvals', description: 'superfície pública de aprovação por token' },
    { name: 'public-posts', description: 'API pública /public/v1 — posts (escopos posts:*)' },
    { name: 'public-publications', description: 'API pública /public/v1 — feed de publicações (posts:read)' },
    { name: 'public-channels', description: 'API pública /public/v1 — canais (channels:*)' },
    { name: 'public-media', description: 'API pública /public/v1 — mídia (media:write)' },
    { name: 'public-webhooks', description: 'API pública /public/v1 — webhooks (webhooks:manage)' },
  ],
};
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const NON_API_PATHS = new Set(['/', '/docs', '/openapi.json', '/metrics']);

app.get('/openapi.json', (c) => {
  const doc = app.getOpenAPI31Document(OPENAPI_DOC);
  if (!doc.paths) doc.paths = {};
  const paths = doc.paths as Record<string, Record<string, unknown>>;
  const seen = new Set<string>();
  for (const route of app.routes) {
    const method = route.method.toLowerCase();
    if (!HTTP_METHODS.has(method)) continue; // ignora middlewares (method ALL)
    if (route.path.includes('*') || NON_API_PATHS.has(route.path)) continue;
    const oaPath = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}'); // :param (Hono) → {param}
    if (seen.has(`${method} ${oaPath}`)) continue;
    seen.add(`${method} ${oaPath}`);
    const entry = (paths[oaPath] ??= {});
    if (entry[method]) continue; // já documentado via createRoute — não sobrescreve
    const segments = oaPath.split('/').filter(Boolean);
    const tag = segments[0] === 'v1' ? segments[1] ?? 'v1' : segments[0] ?? 'root';
    const params = [...oaPath.matchAll(/\{([^}]+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const op: Record<string, unknown> = {
      tags: [tag],
      summary: `${method.toUpperCase()} ${oaPath}`,
      responses: { default: { description: 'resposta — veja o código / TESTING.md' } },
    };
    if (params.length) op.parameters = params;
    if (method !== 'get' && method !== 'delete') {
      op.requestBody = { content: { 'application/json': { schema: { type: 'object' } } } };
    }
    entry[method] = op;
  }
  // no-store: em dev o doc muda a cada edição — nunca servir uma versão cacheada (evita
  // o explorador mostrar rotas/stubs antigos porque o navegador guardou o /openapi.json).
  c.header('cache-control', 'no-store');
  return c.json(doc);
});

// Explorador de API no navegador (Scalar) — superfície de teste até existir o apps/web.
// Lê o /openapi.json desta mesma origem; o bundle da UI vem de CDN (precisa de internet só p/
// carregar a página — as chamadas à API são locais). É read-only e a API segue protegida por auth.
app.get('/docs', (c) => {
  c.header('cache-control', 'no-store');
  return c.html(`<!doctype html>
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
</html>`);
});

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

// Fase 1 restante: analytics (get_channel_analytics / GET /channels/{id}/analytics), IA
// (generate_content) e OAuth 2.1 do MCP (hoje o /mcp autentica por API key escopo mcp).
const hosts = machineHosts(env);
console.log(
  `manypost api (MODE=${env.MODE}) on :${env.PORT}` +
    (hosts.api ? ` · REST de máquina em ${hosts.api}/v1` : '') +
    (hosts.mcp ? ` · MCP em ${hosts.mcp}/` : ''),
);

// Despacho por Host: app (PUBLIC_URL) × API de máquina (api.) × MCP (mcp.) — ver http/surfaces.ts
export default {
  port: env.PORT,
  hostname: '0.0.0.0',
  fetch: buildSurfaceRouter({ env, ctn, app, publicV1, mcp }),
};
