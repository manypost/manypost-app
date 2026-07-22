import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import type { AppEnv } from './context';
import { humansOnly } from './auth';
import { errorHandler } from './error';

/**
 * Fronteira humano × máquina (SPEC_API_MCP §3): a superfície interna `/v1` é da INTERFACE e é
 * regida por papel. Máquina entra pela superfície própria, onde escopo, gate de plano e
 * rate-limit por credencial valem — sem esta recusa, uma API key contornaria os três.
 */
const app = new Hono<AppEnv>();
app.onError(errorHandler);
app.use('/v1/*', humansOnly('https://api.manypost.com.br/v1'));
app.get('/v1/posts', (c) => c.json({ ok: true }));
app.get('/public/v1/posts', (c) => c.json({ ok: true })); // fora do escopo do middleware

describe('humansOnly', () => {
  it('recusa API key com 403 e aponta a superfície de máquina', async () => {
    const res = await app.request('/v1/posts', {
      headers: { authorization: 'Bearer mp_live_abcdef1234567890' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { title: string; detail: string; extra: { machineApiUrl: string } };
    expect(body.title).toBe('common.forbidden');
    expect(body.detail).toContain('https://api.manypost.com.br/v1');
    expect(body.extra.machineApiUrl).toBe('https://api.manypost.com.br/v1');
  });

  it('deixa passar JWT (humano) e requisição sem Authorization (cookie resolve adiante)', async () => {
    const withJwt = await app.request('/v1/posts', {
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x.y' },
    });
    expect(withJwt.status).toBe(200);
    expect(await (await app.request('/v1/posts')).status).toBe(200);
  });

  it('não alcança a superfície de máquina — lá a chave é a credencial esperada', async () => {
    const res = await app.request('/public/v1/posts', {
      headers: { authorization: 'Bearer mp_live_abcdef1234567890' },
    });
    expect(res.status).toBe(200);
  });
});
