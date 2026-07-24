import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { AppEnv } from './context';
import { humansOnly, requireAuth, requireMachineAuth } from './auth';
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

  it('deixa o bearer Clerk e a requisição sem header seguirem para a autenticação humana', async () => {
    const withClerk = await app.request('/v1/posts', {
      headers: { authorization: 'Bearer clerk-session' },
    });
    expect(withClerk.status).toBe(200);
    expect(await (await app.request('/v1/posts')).status).toBe(200);
  });

  it('não alcança a superfície de máquina — lá a chave é a credencial esperada', async () => {
    const res = await app.request('/public/v1/posts', {
      headers: { authorization: 'Bearer mp_live_abcdef1234567890' },
    });
    expect(res.status).toBe(200);
  });
});

function clerkOnlyApp() {
  const protectedApp = new Hono<AppEnv>();
  protectedApp.onError(errorHandler);
  protectedApp.use(
    '/protected',
    requireAuth({
      authenticateHuman: async (token: string) =>
        token === 'clerk-session'
          ? {
              userId: 'user-1',
              orgId: 'org-1',
              role: 'MEMBER' as const,
            }
          : null,
    }),
  );
  protectedApp.get('/protected', (c) => c.json(c.get('principal')));
  return protectedApp;
}

describe('requireAuth para humanos Clerk', () => {
  it('autentica o bearer Clerk e usa organização e papel resolvidos pelo Manypost', async () => {
    const res = await clerkOnlyApp().request('/protected', {
      headers: {
        authorization: 'Bearer clerk-session',
        'x-org-id': 'attacker-org',
        'x-role': 'OWNER',
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      kind: 'user',
      userId: 'user-1',
      orgId: 'org-1',
      role: 'MEMBER',
    });
  });

  it('ignora o cookie humano legado mesmo quando ele contém um JWT ainda válido', async () => {
    const res = await clerkOnlyApp().request('/protected', {
      headers: { cookie: 'mp_at=legacy-session; mp_rt=legacy-refresh' },
    });

    expect(res.status).toBe(401);
    expect((await res.json()) as { title: string }).toMatchObject({
      title: 'auth.unauthorized',
    });
  });

  it('recusa API key diretamente na autenticação humana', async () => {
    const response = await clerkOnlyApp().request('/protected', {
      headers: { authorization: 'Bearer mp_live_valid' },
    });

    expect(response.status).toBe(401);
  });

  it('aceita o cookie de sessão Clerk para primitivas sem suporte a header, como EventSource', async () => {
    const res = await clerkOnlyApp().request('/protected', {
      headers: { cookie: '__session=clerk-session' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      kind: 'user',
      userId: 'user-1',
      orgId: 'org-1',
    });
  });
});

describe('requireMachineAuth para API REST pública e MCP', () => {
  const machineApp = new Hono<AppEnv>();
  machineApp.onError(errorHandler);
  machineApp.use(
    '/machine',
    requireMachineAuth({
      verifyApiKey: async (token) =>
        token === 'mp_live_valid'
          ? { orgId: 'org-machine', scopes: ['mcp'], apiKeyId: 'key-1' }
          : null,
    }),
  );
  machineApp.get('/machine', (c) => c.json(c.get('principal')));

  it('aceita somente uma API key válida enviada por bearer', async () => {
    const response = await machineApp.request('/machine', {
      headers: { authorization: 'Bearer mp_live_valid' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: 'api_key',
      orgId: 'org-machine',
      scopes: ['mcp'],
      apiKeyId: 'key-1',
    });
  });

  it('recusa bearer e cookie Clerk sem consultar autenticação humana', async () => {
    const bearer = await machineApp.request('/machine', {
      headers: { authorization: 'Bearer clerk-session' },
    });
    const cookie = await machineApp.request('/machine', {
      headers: { cookie: '__session=clerk-session' },
    });

    expect(bearer.status).toBe(401);
    expect(cookie.status).toBe(401);
  });
});

it('mapeia e-mail Clerk não verificado para 403 explícito', async () => {
  const errorApp = new Hono();
  errorApp.onError(errorHandler);
  errorApp.get('/unverified', () => {
    throw new DomainError(
      ErrorCodes.AuthSocialEmailUnverified,
      'a conta Clerk não possui e-mail primário verificado',
    );
  });

  const response = await errorApp.request('/unverified');
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({
    title: ErrorCodes.AuthSocialEmailUnverified,
    status: 403,
  });
});
