import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { type ApiScope, ErrorCodes, type MemberRole } from '@manypost/contracts';
import {
  API_KEY_PREFIX,
  DomainError,
  OAUTH_ACCESS_PREFIX,
  hasMcpReadScope,
  hasMcpWriteScope,
} from '@manypost/core';
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
  verifyOAuthAccessToken: (
    token: string,
  ) => Promise<{
    orgId: string;
    userId: string;
    scopes: string[];
    grantId: string;
  } | null>;
  /** URL do Protected Resource Metadata (RFC 9728) para o challenge 401 */
  resourceMetadataUrl: string;
}

function machineUnauthorized(
  message: string,
  resourceMetadataUrl: string,
): DomainError {
  return new DomainError(ErrorCodes.AuthUnauthorized, message, {
    wwwAuthenticate: `Bearer resource_metadata="${resourceMetadataUrl}", scope="mcp:read mcp:write"`,
  });
}

/** Autenticação humana exclusiva por sessão Clerk (bearer ou cookie EventSource). */
export const requireAuth = (deps: HumanAuthMiddlewareDeps): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer?.trim() || getCookie(c, '__session');

    if (
      token &&
      !token.startsWith(API_KEY_PREFIX) &&
      !token.startsWith(OAUTH_ACCESS_PREFIX)
    ) {
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

/** Superfícies de máquina: API key `mp_live_` ou access token OAuth `mpo_`. */
export const requireMachineAuth = (
  deps: MachineAuthMiddlewareDeps,
): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw machineUnauthorized('credencial ausente', deps.resourceMetadataUrl);
    }

    if (token.startsWith(API_KEY_PREFIX)) {
      const key = await deps.verifyApiKey(token);
      if (!key) {
        throw machineUnauthorized('API key inválida', deps.resourceMetadataUrl);
      }
      c.set('principal', {
        kind: 'api_key',
        orgId: key.orgId,
        scopes: key.scopes,
        apiKeyId: key.apiKeyId,
      });
      return next();
    }

    if (token.startsWith(OAUTH_ACCESS_PREFIX)) {
      const grant = await deps.verifyOAuthAccessToken(token);
      if (!grant) {
        throw machineUnauthorized('access token inválido', deps.resourceMetadataUrl);
      }
      c.set('principal', {
        kind: 'oauth',
        orgId: grant.orgId,
        userId: grant.userId,
        scopes: grant.scopes,
        grantId: grant.grantId,
      });
      return next();
    }

    throw machineUnauthorized('credencial de máquina ausente', deps.resourceMetadataUrl);
  };

/**
 * Fecha a superfície interna `/v1` para **máquinas** (SPEC_API_MCP §3): API key `mp_live_`
 * e tokens OAuth `mpo_` são recusados aqui.
 */
export const humansOnly = (machineApiUrl: string): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      if (token.startsWith(API_KEY_PREFIX) || token.startsWith(OAUTH_ACCESS_PREFIX)) {
        throw new DomainError(
          ErrorCodes.Forbidden,
          `credencial de máquina não é aceita nesta superfície — use a API de máquina em ${machineApiUrl}`,
          { machineApiUrl },
        );
      }
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

function scopeSatisfied(have: readonly string[], needed: ApiScope): boolean {
  if (have.includes(needed)) return true;
  if (needed === 'mcp:read') return hasMcpReadScope(have);
  if (needed === 'mcp:write') return hasMcpWriteScope(have);
  if (needed === 'mcp') return hasMcpReadScope(have) || hasMcpWriteScope(have);
  return false;
}

/**
 * Exige que a credencial de máquina tenha TODOS os escopos listados.
 * Humanos passam (autorização por papel). API key e OAuth são verificados.
 */
export const requireScope = (...needed: ApiScope[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const p = c.get('principal');
    if (p.kind === 'api_key' || p.kind === 'oauth') {
      const have = p.scopes ?? [];
      if (needed.some((s) => !scopeSatisfied(have, s))) {
        throw new DomainError(
          ErrorCodes.Forbidden,
          `escopo insuficiente: esta credencial precisa de ${needed.join(', ')}`,
        );
      }
    }
    await next();
  };
