import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { ErrorCodes } from '@manypost/contracts';
import { API_KEY_PREFIX, DomainError, type TokenSigner } from '@manypost/core';
import type { AppEnv } from './context';

export const ACCESS_COOKIE = 'mp_at';
export const REFRESH_COOKIE = 'mp_rt';

interface AuthMiddlewareDeps {
  signer: TokenSigner;
  verifyApiKey: (key: string) => Promise<{ orgId: string; scopes: string[] } | null>;
}

/** Autenticação unificada: JWT (cookie ou Bearer) ou API key (SPEC_API_MCP §1-2). */
export const requireAuth = (deps: AuthMiddlewareDeps): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer ?? getCookie(c, ACCESS_COOKIE);

    if (token?.startsWith(API_KEY_PREFIX)) {
      const key = await deps.verifyApiKey(token);
      if (key) {
        c.set('principal', { kind: 'api_key', orgId: key.orgId, scopes: key.scopes });
        return next();
      }
    } else if (token) {
      const claims = await deps.signer.verify(token);
      if (claims) {
        c.set('principal', {
          kind: 'user',
          userId: claims.sub,
          orgId: claims.org,
          role: claims.role,
        });
        return next();
      }
    }
    throw new DomainError(ErrorCodes.AuthUnauthorized, 'não autenticado');
  };

/** Exige usuário humano com papel ADMIN/OWNER (gestão de API keys, canais…). */
export const requireAdmin = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const p = c.get('principal');
  if (p?.kind !== 'user' || p.role === 'MEMBER') {
    throw new DomainError(ErrorCodes.Forbidden, 'requer papel ADMIN ou OWNER');
  }
  await next();
};
