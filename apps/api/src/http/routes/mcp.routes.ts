import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context, MiddlewareHandler } from 'hono';
import type { Container } from '../../container';
import type { AppEnv } from '../middleware/context';
import { buildMcpServer } from '../../mcp/mcp-server';
import { requireMachineAuth, requireScope } from '../middleware/auth';
import { machineCors } from '../middleware/machine-cors';
import { requirePlanFeature } from '../middleware/public-api';
import { createApp } from '../openapi';

/**
 * Servidor MCP (SPEC_API_MCP §5) em `/mcp` — transporte **Streamable HTTP** no mesmo processo
 * da API. Auth = API key com escopo `mcp` em toda requisição (OAuth 2.1 é follow-up). As tools
 * são os próprios use-cases (ver `mcp/mcp-server.ts`).
 *
 * Modo **stateful**: o transporte exige `initialize` antes de qualquer chamada, então guardamos
 * servidor+transporte por `mcp-session-id` (gerado no initialize). Requisições seguintes trazem
 * o header e reusam a sessão; a sessão é amarrada ao `orgId` da credencial (reuso cross-org é
 * ignorado). O cliente encerra com DELETE (dispara `onsessionclosed`); sessões ociosas são
 * podadas por TTL. Registro em memória: em MODE=all (processo único) é suficiente — escala
 * horizontal exigiria sticky sessions ou store externo (follow-up junto do OAuth).
 *
 * **Montagem**: este sub-app atende `/` e `/mcp`, então serve tanto montado em `/mcp` (origem
 * da própria API, self-host) quanto na **raiz** de um host dedicado `mcp.` (`MCP_PUBLIC_URL`).
 * Os middlewares são presos a esses dois caminhos (e não a `*`) justamente para que montar na
 * raiz não engula as demais rotas do host.
 */
const SESSION_TTL_MS = 60 * 60 * 1000; // 1h ociosa

/** Caminhos atendidos pelo sub-app (o 2º é alias — ver nota de montagem acima). */
const ENDPOINTS = ['/', '/mcp'] as const;

/**
 * Quem abre `mcp.dominio` no navegador é gente, não cliente MCP: responde uma página curta em
 * vez de um `401` cru. Cliente MCP nunca cai aqui — ele usa POST (JSON-RPC) ou GET com
 * `accept: text/event-stream`; só a navegação humana pede `text/html`.
 */
const browserLanding: MiddlewareHandler<AppEnv> = async (c, next) => {
  const accept = c.req.header('accept') ?? '';
  if (c.req.method !== 'GET' || !accept.includes('text/html')) return next();
  return c.html(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>manypost — servidor MCP</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.6; }
      code { background: #f2f2f2; padding: .1rem .35rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>servidor MCP do manypost</h1>
    <p>Este endereço não é uma página: é um servidor <strong>MCP</strong> (Streamable HTTP).
       Cole esta URL no seu cliente de agente e autentique com uma <strong>API key</strong> de
       escopo <code>mcp</code> em <code>Authorization: Bearer mp_live_…</code>.</p>
    <p>A chave é criada em <em>Configurações → API keys</em> no app.</p>
  </body>
</html>`);
};

interface Session {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  orgId: string;
  lastSeen: number;
}

export function mcpRoutes(ctn: Container) {
  const app = createApp();
  const sessions = new Map<string, Session>();

  const prune = () => {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, s] of sessions) if (s.lastSeen < cutoff) sessions.delete(id);
  };

  for (const endpoint of ENDPOINTS) {
    app.use(endpoint, machineCors()); // antes do auth: preflight não carrega credencial
    app.use(endpoint, browserLanding); // navegação humana no host mcp. → página, não 401
    app.use(endpoint, requireMachineAuth({
      verifyApiKey: ctn.auth.verifyApiKey,
    }));
    app.use(endpoint, requireScope('mcp'));
    app.use(endpoint, requirePlanFeature(ctn.plan, 'public_api')); // "API REST e MCP" = Pro+
  }

  const handle = async (c: Context<AppEnv>) => {
    const p = c.get('principal');
    const sessionId = c.req.header('mcp-session-id');
    const existing = sessionId ? sessions.get(sessionId) : undefined;

    // sessão conhecida e da MESMA org → reusa o transporte já inicializado
    if (existing && existing.orgId === p.orgId) {
      existing.lastSeen = Date.now();
      return existing.transport.handleRequest(c.req.raw);
    }

    // nova sessão: só um `initialize` (POST) inicializa o transporte; qualquer outra coisa
    // recebe do próprio transporte um 400 "Server not initialized" (o cliente reinicializa).
    prune();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sid) => {
        sessions.set(sid, { server, transport, orgId: p.orgId, lastSeen: Date.now() });
      },
      onsessionclosed: (sid) => {
        sessions.delete(sid);
      },
    });
    const server = buildMcpServer(ctn, {
      orgId: p.orgId,
      apiKeyId: p.apiKeyId ?? p.userId ?? 'unknown',
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  };

  for (const endpoint of ENDPOINTS) app.all(endpoint, handle);

  return app;
}
