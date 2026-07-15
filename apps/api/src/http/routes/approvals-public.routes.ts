import { z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, sha256Hex } from '@manypost/core';
import type { Context } from 'hono';
import type { Container } from '../../container';
import type { AppEnv } from '../middleware/context';
import { createApp, errorResponses, jsonBody, jsonResponse } from '../openapi';

const ApprovalMediaOut = z.object({
  type: z.string(),
  url: z.string(),
  mime: z.string(),
  alt: z.string().optional(),
});
const ApprovalItemOut = z.object({
  text: z.string(),
  media: z.array(ApprovalMediaOut),
  delaySec: z.number().int(),
});
const ApprovalPreviewOut = z
  .object({
    status: z.string().openapi({ example: 'PENDING' }),
    feedback: z.string().nullable(),
    approverName: z.string().nullable(),
    expiresAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
    publishAt: z.string().datetime().nullable(),
    timezone: z.string(),
    publications: z.array(
      z.object({
        provider: z.string(),
        channelName: z.string(),
        channelUsername: z.string().nullable(),
        channelAvatarUrl: z.string().nullable(),
        items: z.array(ApprovalItemOut),
      }),
    ),
  })
  .openapi('ApprovalPreview');
const ApprovalResolveOut = z
  .object({
    status: z.string().openapi({ example: 'APPROVED' }),
    resolvedAt: z.string().datetime().nullable(),
    alreadyResolved: z.boolean().optional(),
  })
  .openapi('ApprovalResolution');

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
  const app = createApp();

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

  const TokenParam = z.object({ token: z.string() });

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/{token}',
    tags: ['approvals'],
    summary: 'Preview público do post (sem login, por token)',
    description: '404 uniforme para token inválido/expirado/revogado — sem enumeração.',
    request: { params: TokenParam },
    responses: { 200: jsonResponse('como o post será publicado', ApprovalPreviewOut), ...errorResponses(404, 429) },
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

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/{token}/approve',
    tags: ['approvals'],
    summary: 'Cliente aprova — agenda o post de verdade (idempotente)',
    request: { params: TokenParam, ...jsonBody(z.object({ name: z.string().min(1).max(120).optional() }), false) },
    responses: { 200: jsonResponse('resolução', ApprovalResolveOut), ...errorResponses(404, 429) },
  });
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

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/{token}/request-changes',
    tags: ['approvals'],
    summary: 'Cliente pede ajustes (feedback obrigatório) — mantém rascunho',
    request: { params: TokenParam, ...jsonBody(ChangesBody) },
    responses: { 200: jsonResponse('resolução', ApprovalResolveOut), ...errorResponses(400, 404, 429) },
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
