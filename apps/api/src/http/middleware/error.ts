import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { DomainError } from '@manypost/core';

/** DomainError.code → HTTP (RFC 9457 problem+json — SPEC_API_MCP §3). */
const STATUS: Record<string, ContentfulStatusCode> = {
  'auth.invalid_credentials': 401,
  'auth.session_invalid': 401,
  'auth.unauthorized': 401,
  'auth.email_taken': 409,
  'common.not_found': 404,
  'common.forbidden': 403,
  'common.idempotency_conflict': 409,
  'rate.limited': 429,
  'plan.channel_limit': 403,
  'ai.budget_exceeded': 402,
  'capability.disabled': 404,
};

export function errorHandler(err: unknown, c: Context) {
  if (err instanceof ZodError) {
    // body/query fora do contrato: 400 com os campos, nunca 500
    return c.json(
      {
        type: 'about:blank',
        title: 'validation.invalid_request',
        status: 400,
        detail: 'requisição fora do contrato',
        extra: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400,
      { 'content-type': 'application/problem+json' },
    );
  }
  if (err instanceof DomainError) {
    const status = STATUS[err.code] ?? 400;
    return c.json(
      {
        type: 'about:blank',
        title: err.code,
        status,
        detail: err.message,
        ...(err.detail ? { extra: err.detail } : {}),
      },
      status,
      { 'content-type': 'application/problem+json' },
    );
  }
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'unhandled_error',
      correlationId: c.get('correlationId'),
      err: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    }),
  );
  return c.json(
    { type: 'about:blank', title: 'internal_error', status: 500 },
    500,
    { 'content-type': 'application/problem+json' },
  );
}
