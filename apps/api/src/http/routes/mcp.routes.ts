import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Container } from '../../container';
import { buildMcpServer } from '../../mcp/mcp-server';
import { requireAuth, requireScope } from '../middleware/auth';
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
 */
const SESSION_TTL_MS = 60 * 60 * 1000; // 1h ociosa

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

  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));
  app.use('*', requireScope('mcp'));

  app.all('/', async (c) => {
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
  });

  return app;
}
