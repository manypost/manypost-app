import type { MiddlewareHandler } from 'hono';
import type { MemberRole } from '@manypost/contracts';

export interface Principal {
  kind: 'user' | 'api_key';
  orgId: string;
  userId?: string;
  role?: MemberRole;
  scopes?: string[];
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
