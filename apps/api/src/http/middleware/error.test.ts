import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { AppEnv } from './context';
import { errorHandler } from './error';

const app = new Hono<AppEnv>();
app.onError(errorHandler);
app.get('/falha-storage', () => {
  throw new DomainError(ErrorCodes.MediaStoreFailed, 'falha ao gravar mídia no storage (S3: AccessDenied)');
});

describe('DomainError → problem+json', () => {
  it('falha de storage é 502: o pedido está certo, o nosso lado é que falhou', async () => {
    const res = await app.request('/falha-storage');
    expect(res.status).toBe(502);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { title: string; status: number; detail: string };
    expect(body.title).toBe('media.store_failed');
    expect(body.status).toBe(502);
    expect(body.detail).toContain('AccessDenied');
  });
});
