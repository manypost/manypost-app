import { cors } from 'hono/cors';

/**
 * CORS das superfícies de máquina (`/v1` da API pública e servidor MCP) — SPEC_API_MCP §3/§5.
 *
 * Elas autenticam por `Authorization: Bearer` e **nunca** por cookie, então liberar qualquer
 * origem é seguro: sem `credentials`, o navegador não anexa cookie/sessão e a requisição só
 * chega autenticada se o cliente colar a chave. É o que permite Inspector do MCP, agentes
 * rodando no navegador e SDKs client-side falarem com `api.`/`mcp.` (host diferente do app).
 *
 * `exposeHeaders` importa: sem `mcp-session-id` exposto o cliente MCP não consegue continuar a
 * sessão iniciada no `initialize`, e sem os `RateLimit-*` o cliente REST não vê a cota.
 */
export const machineCors = () =>
  cors({
    origin: '*',
    credentials: false,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'authorization',
      'content-type',
      'accept',
      'idempotency-key',
      'mcp-session-id',
      'mcp-protocol-version',
      'last-event-id',
    ],
    exposeHeaders: [
      'mcp-session-id',
      'ratelimit-limit',
      'ratelimit-policy',
      'ratelimit-remaining',
      'ratelimit-reset',
      'retry-after',
      'idempotency-replayed',
    ],
    maxAge: 86_400,
  });
