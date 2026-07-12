import { OpenAPIHono, z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, sha256Hex } from '@manypost/core';
import type { Context } from 'hono';
import type { Container } from '../../container';
import type { AppEnv } from '../middleware/context';

/** IP do cliente (atrás de proxy usa o primeiro X-Forwarded-For — SPEC_INFRA: sempre atrás de proxy). */
const clientIp = (c: Context<AppEnv>) =>
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
  c.req.header('x-real-ip') ??
  'unknown';

const serialize = (r: { status: string; resolvedAt?: Date | null } & Record<string, unknown>) => ({
  ...r,
  resolvedAt: r.resolvedAt instanceof Date ? r.resolvedAt.toISOString() : (r.resolvedAt ?? null),
});

/**
 * Superfície pública de aprovação — sem login, por token (DECISIONS v1.1 §12).
 * 404 uniforme para token inválido/expirado/revogado (sem enumeração);
 * approve/request-changes idempotentes (segunda chamada devolve o estado resolvido).
 */
export function approvalPublicRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();

  // rate-limit agressivo por IP + token (SPEC_API_MCP §3); sem Redis = falha aberta
  app.use('*', async (c, next) => {
    const limiter = ctn.runtime.rateLimiter;
    if (!limiter) return next();
    const token = c.req.path.match(/\/public\/approval\/([^/]+)/)?.[1] ?? '';
    const verdict = await limiter.acquire([
      { key: `apr:ip:${clientIp(c)}`, limit: 30, windowSec: 60 },
      { key: `apr:tk:${sha256Hex(token).slice(0, 16)}`, limit: 10, windowSec: 60 },
    ]);
    if (!verdict.ok) {
      throw new DomainError(ErrorCodes.RateLimited, 'muitas tentativas — aguarde um instante', {
        retryAfterSec: verdict.retryAfterSec,
      });
    }
    await next();
  });

  app.get('/:token', async (c) => {
    const preview = await ctn.approvals.preview(c.req.param('token'));
    return c.json({
      ...preview,
      expiresAt: preview.expiresAt.toISOString(),
      resolvedAt: preview.resolvedAt?.toISOString() ?? null,
      publishAt: preview.publishAt?.toISOString() ?? null,
    });
  });

  const ApproveBody = z.object({ name: z.string().min(1).max(120).optional() }).optional();

  app.post('/:token/approve', async (c) => {
    const body = ApproveBody.parse(await c.req.json().catch(() => undefined));
    const out = await ctn.approvals.resolve({
      token: c.req.param('token'),
      action: 'approve',
      ...(body?.name ? { approverName: body.name } : {}),
      ip: clientIp(c),
    });
    return c.json(serialize(out));
  });

  const ChangesBody = z.object({
    feedback: z.string().min(1).max(2000),
    name: z.string().min(1).max(120).optional(),
  });

  app.post('/:token/request-changes', async (c) => {
    const body = ChangesBody.parse(await c.req.json());
    const out = await ctn.approvals.resolve({
      token: c.req.param('token'),
      action: 'request_changes',
      feedback: body.feedback,
      ...(body.name ? { approverName: body.name } : {}),
      ip: clientIp(c),
    });
    return c.json(serialize(out));
  });

  return app;
}
