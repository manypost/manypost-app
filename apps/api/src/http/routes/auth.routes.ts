import { z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonResponse } from '../openapi';

const UserOut = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const MeOut = z
  .object({
    kind: z.literal('user'),
    orgId: z.string(),
    role: z.string(),
    user: UserOut.nullable(),
  })
  .openapi('Me');

export function authRoutes(ctn: Container) {
  const app = createApp();

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/me',
    tags: ['auth'],
    security: AUTH_SECURITY,
    summary: 'Identidade Clerk com autorização Manypost',
    responses: {
      200: jsonResponse('usuário Clerk com papel Manypost', MeOut),
      ...errorResponses(401, 403, 503),
    },
  });
  app.use('/me', requireAuth({
    authenticateHuman: ctn.auth.authenticateHuman,
  }));
  app.get('/me', async (c) => {
    const principal = c.get('principal');
    if (principal.kind !== 'user') {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'sessão Clerk obrigatória');
    }
    const user = await ctn.repos.users.findById(principal.userId!);
    return c.json({
      kind: principal.kind,
      orgId: principal.orgId,
      role: principal.role,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          }
        : null,
    });
  });

  return app;
}
