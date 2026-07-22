import type { OpenAPIHono } from '@hono/zod-openapi';
import { type Env, machineHosts } from '@manypost/config';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../container';
import { correlationId } from './middleware/context';
import type { AppEnv } from './middleware/context';
import { errorHandler } from './middleware/error';
import { createApp } from './openapi';

/**
 * Superfícies por **Host** (SPEC_API_MCP §3/§5). Um único serviço de API atende:
 *
 * | Host | O que serve |
 * |---|---|
 * | `PUBLIC_URL` (app) | `/v1` interno (humano/cookie), `/public/approval`, `/public/v1`, `/mcp`, `/uploads`, `/docs` |
 * | `API_PUBLIC_URL` (`api.`) | **`/v1` = API REST de máquina** (o mesmo sub-app de `/public/v1`) + `/docs` próprio |
 * | `MCP_PUBLIC_URL` (`mcp.`) | **servidor MCP na raiz** (`/`, com `/mcp` como alias) |
 *
 * Por que host e não caminho: a superfície de máquina é bearer/sem cookie, então não precisa
 * ser same-origin com o web — e o rewrite do Next não é API gateway (bufferiza, tem timeout
 * próprio, atrapalha o streaming do MCP e o pull de mídia grande). Os dois domínios são
 * custom domains do MESMO serviço, então não há CORS server-to-server nem outro deploy.
 *
 * `PUBLIC_URL` continua sendo a origem do produto (OAuth de canal, link de aprovação, URL
 * pública de mídia, cookies) — ela NÃO se move para o subdomínio.
 *
 * Sem `API_PUBLIC_URL`/`MCP_PUBLIC_URL` (self-host padrão) nada muda: um host só, superfícies
 * em `/public/v1` e `/mcp` da própria origem.
 */

interface Fetcher {
  fetch: (req: Request) => Response | Promise<Response>;
}

/** Middlewares que TODA superfície tem: correlation id, histograma HTTP e problem+json. */
export function installBaseMiddleware(app: OpenAPIHono<AppEnv>, ctn: Container) {
  app.use('*', correlationId());
  // Latência/status por rota → histograma Prometheus (SPEC_INFRA §4). Usa o PADRÃO da rota
  // (c.req.routePath, ex.: /v1/posts/:groupId) e não o path com ids — cardinalidade limitada.
  app.use('*', async (c, next) => {
    const start = performance.now();
    try {
      await next();
    } finally {
      ctn.metrics.observeHttp(
        c.req.method,
        c.req.routePath ?? c.req.path,
        c.res.status,
        (performance.now() - start) / 1000,
      );
    }
  });
  app.onError(errorHandler);
}

interface MachineAppOptions {
  env: Env;
  ctn: Container;
  /** sub-app de `/public/v1` — a MESMA instância montada na origem do app (zero duplicação) */
  publicV1: OpenAPIHono<AppEnv>;
  /** sub-app do MCP — instância ÚNICA: o registro de sessões vive no closure dele */
  mcp: OpenAPIHono<AppEnv>;
  /** este host serve a API REST em `/v1`? */
  rest: boolean;
  /** este host serve o MCP na raiz? */
  servesMcp: boolean;
}

/**
 * App de um host de máquina. Reusa os MESMOS sub-apps do host do app — escopos, gate de plano,
 * rate-limit por credencial e idempotência vêm de graça, e não existe segunda implementação
 * para divergir.
 */
function buildMachineApp(o: MachineAppOptions): OpenAPIHono<AppEnv> {
  const app = createApp();
  installBaseMiddleware(app, o.ctn);

  app.get('/health', (c) => c.json({ status: 'ok' as const }));

  if (o.rest) {
    // o sub-app registra os caminhos OpenAPI relativos (/posts, /channels…) — o .route()
    // re-prefixa, então aqui a superfície vira /v1/posts sem tocar em nenhuma rota
    app.route('/v1', o.publicV1);
    app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
      type: 'http',
      scheme: 'bearer',
      description: 'API key `mp_live_…` (escopos por recurso) — Authorization: Bearer <chave>',
    });
    app.get('/openapi.json', (c) => {
      c.header('cache-control', 'no-store');
      return c.json(
        app.getOpenAPI31Document({
          openapi: '3.1.0',
          info: {
            title: 'manypost API (máquinas)',
            version: '0.0.1',
            description:
              'Superfície REST para integrações e agentes. Autentique com uma API key `mp_live_…` (Authorization: Bearer). Erros seguem problem+json (RFC 9457): `title` carrega o código estável. Rate limit por credencial (headers `RateLimit-*`) e `Idempotency-Key` nos POST de mutação.',
          },
          servers: [{ url: o.env.API_PUBLIC_URL ?? '/', description: 'API de máquina' }],
          tags: [
            { name: 'public-posts', description: 'posts (escopos posts:*)' },
            { name: 'public-publications', description: 'feed de publicações (posts:read)' },
            { name: 'public-channels', description: 'canais (channels:*)' },
            { name: 'public-media', description: 'mídia (media:write)' },
            { name: 'public-webhooks', description: 'webhooks de saída (webhooks:manage)' },
          ],
        }),
      );
    });
    app.get('/docs', (c) => {
      c.header('cache-control', 'no-store');
      return c.html(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>manypost API (máquinas) — explorador</title>
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`);
    });
  }

  if (o.servesMcp) {
    app.route('/', o.mcp); // atende `/` e `/mcp` (os middlewares dele são presos a esses paths)
  } else {
    // engano comum: procurar o MCP no host da API REST — responde onde ele está, não 404 mudo
    app.all('/mcp', () => {
      throw new DomainError(
        ErrorCodes.NotFound,
        o.env.MCP_PUBLIC_URL
          ? `o servidor MCP fica em ${o.env.MCP_PUBLIC_URL}`
          : 'servidor MCP não está publicado neste host',
      );
    });
  }

  app.notFound(() => {
    throw new DomainError(
      ErrorCodes.NotFound,
      o.rest
        ? 'rota não encontrada — a API de máquina vive sob /v1 (veja /docs)'
        : 'rota não encontrada — este host serve apenas o servidor MCP na raiz',
    );
  });

  return app;
}

/**
 * Devolve o `fetch` do processo: despacha por Host para a superfície certa. Sem hosts de
 * máquina configurados, é o `fetch` do app de origem única (nenhum custo por requisição).
 */
export function buildSurfaceRouter(opts: {
  env: Env;
  ctn: Container;
  app: OpenAPIHono<AppEnv>;
  publicV1: OpenAPIHono<AppEnv>;
  mcp: OpenAPIHono<AppEnv>;
}): (req: Request) => Response | Promise<Response> {
  const { env, ctn, app, publicV1, mcp } = opts;
  const hosts = machineHosts(env);
  if (!hosts.api && !hosts.mcp) return app.fetch;

  const byHost = new Map<string, Fetcher>();
  if (hosts.api) {
    byHost.set(
      hosts.api,
      buildMachineApp({ env, ctn, publicV1, mcp, rest: true, servesMcp: hosts.api === hosts.mcp }),
    );
  }
  if (hosts.mcp && hosts.mcp !== hosts.api) {
    byHost.set(
      hosts.mcp,
      buildMachineApp({ env, ctn, publicV1, mcp, rest: false, servesMcp: true }),
    );
  }

  return (req: Request) => {
    // req.url é montado a partir do header Host — o proxy na frente PRECISA preservá-lo
    // (Caddy/nginx/Railway preservam por padrão). Host desconhecido cai no app do produto.
    const host = new URL(req.url).host.toLowerCase();
    return (byHost.get(host) ?? app).fetch(req);
  };
}
