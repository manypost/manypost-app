import { describe, expect, it } from 'bun:test';
import type { Container } from '../../container';
import { errorHandler } from '../middleware/error';
import { searchRoutes } from './search.routes';

const AUTH = { authorization: 'Bearer clerk-session' };

const HIT = {
  groupId: 'grp-1',
  state: 'DRAFT' as const,
  publishAt: null,
  text: 'lançamento da nova versão',
  channels: [{ provider: 'x', name: 'Perfil' }],
};

function makeApp(over: { search?: unknown } = {}) {
  const recebidos: Array<{ orgId: string; q: string; limit: number }> = [];
  const ctn = {
    auth: {
      authenticateHuman: async (token: string) =>
        token === 'clerk-session'
          ? { userId: 'user-1', orgId: 'org-1', role: 'OWNER' as const }
          : null,
      verifyApiKey: async () => null,
    },
    runtime: { rateLimiter: null },
    posts: {
      search:
        over.search ??
        (async (orgId: string, q: string, limit: number) => {
          recebidos.push({ orgId, q, limit });
          return [HIT];
        }),
    },
  } as unknown as Container;

  const app = searchRoutes(ctn);
  app.onError(errorHandler);
  return { app, recebidos };
}

describe('GET /v1/search', () => {
  it('recusa sem sessão, e não toca no repositório', async () => {
    const { app, recebidos } = makeApp();
    const res = await app.request('/?q=lancamento');
    expect(res.status).toBe(401);
    expect(recebidos).toHaveLength(0);
  });

  it('responde 200 com os itens encontrados', async () => {
    const { app } = makeApp();
    const res = await app.request('/?q=lancamento', { headers: AUTH });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it('recusa consulta de 1 caractere em vez de varrer a tabela', async () => {
    const { app, recebidos } = makeApp();
    const res = await app.request('/?q=a', { headers: AUTH });
    expect(res.status).toBe(400);
    expect(recebidos).toHaveLength(0);
  });

  it('recusa consulta ausente', async () => {
    const { app, recebidos } = makeApp();
    const res = await app.request('/', { headers: AUTH });
    expect(res.status).toBe(400);
    expect(recebidos).toHaveLength(0);
  });

  it('recusa consulta longa demais (o teto é do schema, não do banco)', async () => {
    const { app, recebidos } = makeApp();
    const res = await app.request(`/?q=${'a'.repeat(200)}`, { headers: AUTH });
    expect(res.status).toBe(400);
    expect(recebidos).toHaveLength(0);
  });

  it('RECUSA limit acima do teto — não devolve o teto em silêncio', async () => {
    const { app, recebidos } = makeApp();
    const res = await app.request('/?q=lancamento&limit=99', { headers: AUTH });
    expect(res.status).toBe(400);
    expect(recebidos).toHaveLength(0);
  });

  it('aplica um limite padrão quando não pedido', async () => {
    const { app, recebidos } = makeApp();
    await app.request('/?q=lancamento', { headers: AUTH });
    expect(recebidos[0]!.limit).toBeGreaterThan(0);
    expect(recebidos[0]!.limit).toBeLessThanOrEqual(10);
  });

  it('o orgId vem do principal autenticado e NUNCA da query', async () => {
    const { app, recebidos } = makeApp();
    await app.request('/?q=lancamento&orgId=org-de-outra-pessoa', { headers: AUTH });
    expect(recebidos[0]!.orgId).toBe('org-1');
  });

  it('repassa a consulta sem espaço nas pontas', async () => {
    const { app, recebidos } = makeApp();
    await app.request('/?q=%20%20lancamento%20%20', { headers: AUTH });
    expect(recebidos[0]!.q).toBe('lancamento');
  });

  it('o payload carrega só o que a paleta mostra — sem credencial nem dado pessoal', async () => {
    const { app } = makeApp();
    const res = await app.request('/?q=lancamento', { headers: AUTH });
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(Object.keys(body.items[0]!).sort()).toEqual([
      'channels',
      'groupId',
      'publishAt',
      'state',
      'text',
    ]);
    expect(JSON.stringify(body)).not.toMatch(/token|secret|email|password/i);
  });

  it('trunca o excerto para não devolver o post inteiro', async () => {
    const { app } = makeApp({
      search: async () => [{ ...HIT, text: 'x'.repeat(1000) }],
    });
    const res = await app.request('/?q=lancamento', { headers: AUTH });
    const body = (await res.json()) as { items: Array<{ text: string }> };
    expect(body.items[0]!.text.length).toBeLessThanOrEqual(163);
  });

  it('nenhum resultado é 200 com lista vazia, não 404', async () => {
    const { app } = makeApp({ search: async () => [] });
    const res = await app.request('/?q=inexistente', { headers: AUTH });
    expect(res.status).toBe(200);
    expect((await res.json()) as { items: unknown[] }).toEqual({ items: [] });
  });
});
