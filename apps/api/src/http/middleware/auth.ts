import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { type ApiScope, ErrorCodes, type MemberRole } from '@manypost/contracts';
import { API_KEY_PREFIX, DomainError } from '@manypost/core';
import type { AppEnv } from './context';

interface HumanAuthMiddlewareDeps {
  authenticateHuman: (
    token: string,
  ) => Promise<{ userId: string; orgId: string; role: MemberRole } | null>;
}

interface MachineAuthMiddlewareDeps {
  verifyApiKey: (
    key: string,
  ) => Promise<{ orgId: string; scopes: string[]; apiKeyId: string } | null>;
}

/** Autenticação humana exclusiva por sessão Clerk (bearer ou cookie EventSource). */
export const requireAuth = (deps: HumanAuthMiddlewareDeps): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer?.trim() || getCookie(c, '__session');

    if (token && !token.startsWith(API_KEY_PREFIX)) {
      const principal = await deps.authenticateHuman(token);
      if (principal) {
        c.set('principal', {
          kind: 'user',
          userId: principal.userId,
          orgId: principal.orgId,
          role: principal.role,
        });
        return next();
      }
    }
    throw new DomainError(ErrorCodes.AuthUnauthorized, 'não autenticado');
  };

/** Superfícies de máquina aceitam exclusivamente API key por bearer. */
export const requireMachineAuth = (
  deps: MachineAuthMiddlewareDeps,
): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token.startsWith(API_KEY_PREFIX)) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'API key ausente');
    }
    const key = await deps.verifyApiKey(token);
    if (!key) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'API key inválida');
    }
    c.set('principal', {
      kind: 'api_key',
      orgId: key.orgId,
      scopes: key.scopes,
      apiKeyId: key.apiKeyId,
    });
    await next();
  };

/**
 * Fecha a superfície interna `/v1` para **máquinas** (SPEC_API_MCP §3): API key `mp_live_` é
 * recusada aqui e mandada para a superfície de máquina, onde escopos, gate de plano
 * (`public_api`), rate-limit por credencial e idempotência de fato valem. Sem isto, uma chave
 * contornaria os três apontando para o `/v1` interno, que é regido por PAPEL (humano), não
 * por escopo. Roda ANTES do `requireAuth` (o header basta — nem verifica a chave).
 */
export const humansOnly = (machineApiUrl: string): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    if (header?.startsWith('Bearer ') && header.slice(7).startsWith(API_KEY_PREFIX)) {
      throw new DomainError(
        ErrorCodes.Forbidden,
        `API key não é aceita nesta superfície (ela é da interface web) — use a API de máquina em ${machineApiUrl}`,
        { machineApiUrl },
      );
    }
    await next();
  };

/** Exige usuário humano com papel ADMIN/OWNER (gestão de API keys, canais…). */
export const requireAdmin = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const p = c.get('principal');
  if (p?.kind !== 'user' || p.role === 'MEMBER') {
    throw new DomainError(ErrorCodes.Forbidden, 'requer papel ADMIN ou OWNER');
  }
  await next();
};

/**
 * Exige que a credencial tenha TODOS os escopos listados (SPEC_API_MCP §1/§6 — "mesmo
 * middleware de escopos"). Vale só para API keys (máquinas): a identidade humana Clerk é
 * regida pelo papel persistido no Manypost, não por escopos, então passa direto aqui — a
 * autorização fina dela é `requireAdmin` e a matriz papel×endpoint. Escopo faltando → 403
 * problem+json.
 */
export const requireScope = (...needed: ApiScope[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const p = c.get('principal');
    if (p.kind === 'api_key') {
      const have = new Set(p.scopes ?? []);
      if (needed.some((s) => !have.has(s))) {
        throw new DomainError(
          ErrorCodes.Forbidden,
          `escopo insuficiente: esta API key precisa de ${needed.join(', ')}`,
        );
      }
    }
    await next();
  };
