import { describe, expect, it } from 'bun:test';
import type { Container } from '../../container';
import { errorHandler } from '../middleware/error';
import { insightsRoutes } from './insights.routes';

const AUTH = { authorization: 'Bearer clerk-session' };

const VAZIO = {
  timezone: 'America/Sao_Paulo',
  attention: {
    failed: 0,
    needsReview: 0,
    awaitingApproval: 0,
    partial: 0,
    channels: [],
    total: 0,
  },
  today: { scheduled: 0, published: 0, failed: 0 },
  week: { scheduled: 0, byDay: [0, 0, 0, 0, 0, 0, 0] },
  firstRun: null,
};

function makeApp(over: { insights?: unknown } = {}) {
  const recebidos: Array<{ actor: unknown; input: unknown }> = [];
  const ctn = {
    auth: {
      authenticateHuman: async (token: string) =>
        token === 'clerk-session'
          ? { userId: 'user-1', orgId: 'org-1', role: 'OWNER' as const }
          : null,
      verifyApiKey: async () => null,
    },
    runtime: { rateLimiter: null },
    insights:
      over.insights ??
      (async (actor: unknown, input: unknown) => {
        recebidos.push({ actor, input });
        return VAZIO;
      }),
  } as unknown as Container;

  const app = insightsRoutes(ctn);
  app.onError(errorHandler);
  return { app, recebidos };
}

describe('GET /v1/insights/summary', () => {
  it('recusa sem sessão', async () => {
    const { app, recebidos } = makeApp();
    const res = await app.request('/summary');
    expect(res.status).toBe(401);
    expect(recebidos).toHaveLength(0);
  });

  it('responde 200 e ecoa o fuso', async () => {
    const { app } = makeApp();
    const res = await app.request('/summary?tz=America/Sao_Paulo', { headers: AUTH });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { timezone: string }).timezone).toBe('America/Sao_Paulo');
  });

  it('repassa o fuso pedido ao caso de uso', async () => {
    const { app, recebidos } = makeApp();
    await app.request('/summary?tz=Europe/Lisbon', { headers: AUTH });
    expect(recebidos[0]!.input).toEqual({ timezone: 'Europe/Lisbon' });
  });

  it('sem fuso, não inventa um na rota — o caso de uso decide e declara o default', async () => {
    const { app, recebidos } = makeApp();
    await app.request('/summary', { headers: AUTH });
    expect(recebidos[0]!.input).toEqual({});
  });

  it('a organização vem do principal, nunca da query', async () => {
    const { app, recebidos } = makeApp();
    await app.request('/summary?orgId=org-de-outra-pessoa', { headers: AUTH });
    expect(recebidos[0]!.actor).toEqual({ orgId: 'org-1' });
  });

  /**
   * O fuso inválido é recusado pelo caso de uso (é ele que sabe validar via `Intl`), então aqui o
   * que se prova é o CONTRATO HTTP: o `DomainError` vira 400 com problem+json, não 500.
   */
  it('fuso inválido vira 400, não 500', async () => {
    const { app } = makeApp({
      insights: async () => {
        const { DomainError } = await import('@manypost/core');
        throw new DomainError('post.invalid_settings', 'fuso horário inválido: Marte/Olympus');
      },
    });
    const res = await app.request('/summary?tz=Marte/Olympus', { headers: AUTH });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { title: string }).title).toBe('post.invalid_settings');
  });

  it('o payload é contagem: nada de texto de publicação nem credencial', async () => {
    const { app } = makeApp();
    const res = await app.request('/summary', { headers: AUTH });
    const corpo = await res.text();

    for (const proibido of ['content', 'tokenEnc', 'token_enc', 'text']) {
      expect(corpo).not.toContain(proibido);
    }
  });
});
