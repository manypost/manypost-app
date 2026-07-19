import type { MiddlewareHandler } from 'hono';
import type { MemberRole } from '@manypost/contracts';

export interface Principal {
  kind: 'user' | 'api_key';
  orgId: string;
  userId?: string;
  role?: MemberRole;
  scopes?: string[];
  /** id da API key (só quando kind === 'api_key') — usado no rate-limit por credencial e na auditoria */
  apiKeyId?: string;
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
