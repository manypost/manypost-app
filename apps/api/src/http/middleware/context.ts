import type { MiddlewareHandler } from 'hono';
import type { MemberRole } from '@manypost/contracts';

export interface Principal {
  kind: 'user' | 'api_key' | 'oauth';
  orgId: string;
  userId?: string;
  role?: MemberRole;
  scopes?: string[];
  /** id da API key (só quando kind === 'api_key') */
  apiKeyId?: string;
  /** id do grant OAuth (só quando kind === 'oauth') */
  grantId?: string;
}

export type AppEnv = {
  Variables: {
    correlationId: string;
    principal: Principal;
  };
};

export const correlationId = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const id = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('correlationId', id);
  c.header('x-request-id', id);
  await next();
};

/** Chave estável para rate-limit / idempotência por credencial. */
export function credentialKey(p: Principal): string {
  if (p.kind === 'api_key') return `k:${p.apiKeyId}`;
  if (p.kind === 'oauth') return `g:${p.grantId}`;
  return `u:${p.userId}`;
}
