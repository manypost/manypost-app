import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Context, MiddlewareHandler } from 'hono';
import { machineEndpoints } from '@manypost/config';
import type { Container } from '../../container';
import type { AppEnv } from '../middleware/context';
import { buildMcpServer } from '../../mcp/mcp-server';
import { requireMachineAuth, requireScope } from '../middleware/auth';
import { machineCors } from '../middleware/machine-cors';
import { requirePlanFeature } from '../middleware/public-api';
import { createApp } from '../openapi';
import { protectedResourceMetadataUrl } from './oauth.routes';

/**
 * Servidor MCP — Streamable HTTP. Auth = API key `mcp` **ou** OAuth `mpo_*`
 * (dual-auth). Discovery PRM neste host; AS em PUBLIC_URL.
 */
const SESSION_TTL_MS = 60 * 60 * 1000;

const ENDPOINTS = ['/', '/mcp'] as const;

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
    <p>Este endereço é um servidor <strong>MCP</strong> (Streamable HTTP).</p>
    <p>Autentique com <strong>OAuth 2.1</strong> (clientes modernos descobrem
       <code>/.well-known/oauth-protected-resource</code>) ou com uma
       <strong>API key</strong> de escopo <code>mcp</code>
       (<code>Authorization: Bearer mp_live_…</code>).</p>
    <p>A chave e as instruções de conexão ficam em <em>Configurações</em> no app.</p>
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
  const mcpUrl = machineEndpoints(ctn.env).mcpUrl;
  const issuer = ctn.env.PUBLIC_URL.replace(/\/+$/, '');
  const prmUrl = protectedResourceMetadataUrl(mcpUrl);

  const prm = () =>
    ({
      resource: mcpUrl,
      authorization_servers: [issuer],
      scopes_supported: ['mcp:read', 'mcp:write'],
      bearer_methods_supported: ['header'],
    }) as const;

  app.get('/.well-known/oauth-protected-resource', (c) => c.json(prm()));
  app.get('/.well-known/oauth-protected-resource/mcp', (c) => c.json(prm()));

  const prune = () => {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, s] of sessions) if (s.lastSeen < cutoff) sessions.delete(id);
  };

  const machineAuth = requireMachineAuth({
    verifyApiKey: ctn.auth.verifyApiKey,
    verifyOAuthAccessToken: ctn.oauth.verifyAccessToken,
    resourceMetadataUrl: prmUrl,
  });

  for (const endpoint of ENDPOINTS) {
    app.use(endpoint, machineCors());
    app.use(endpoint, browserLanding);
    app.use(endpoint, machineAuth);
    app.use(endpoint, requireScope('mcp'));
    app.use(endpoint, requirePlanFeature(ctn.plan, 'public_api'));
  }

  const handle = async (c: Context<AppEnv>) => {
    const p = c.get('principal');
    const sessionId = c.req.header('mcp-session-id');
    const existing = sessionId ? sessions.get(sessionId) : undefined;

    if (existing && existing.orgId === p.orgId) {
      existing.lastSeen = Date.now();
      return existing.transport.handleRequest(c.req.raw);
    }

    prune();
    const credentialId =
      p.kind === 'api_key' ? (p.apiKeyId ?? 'unknown') : (p.grantId ?? p.userId ?? 'unknown');
    const server = buildMcpServer(ctn, {
      orgId: p.orgId,
      credentialId,
      scopes: p.scopes ?? [],
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport, orgId: p.orgId, lastSeen: Date.now() });
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
      },
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  };

  for (const endpoint of ENDPOINTS) {
    app.all(endpoint, handle);
  }

  return app;
}
