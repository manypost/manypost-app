import { describe, expect, it } from 'bun:test';
import type { Container } from '../../container';
import { errorHandler } from '../middleware/error';
import { aiRoutes } from './ai.routes';

const AUTH = { authorization: 'Bearer clerk-session' };

function makeApp(over: { ai?: unknown; aiImage?: unknown; rateLimiter?: unknown } = {}) {
  const chamadas: string[] = [];
  /** o que a rota entregou ao caso de uso — é o que prova que o corpo foi traduzido certo */
  const recebidos: Record<string, unknown>[] = [];
  const ctn = {
    auth: {
      authenticateHuman: async (token: string) =>
        token === 'clerk-session'
          ? { userId: 'user-1', orgId: 'org-1', role: 'OWNER' as const }
          : null,
      verifyApiKey: async () => null,
    },
    runtime: { rateLimiter: over.rateLimiter ?? null },
    ai:
      'ai' in over
        ? over.ai
        : {
            caption: async () => {
              chamadas.push('caption');
              return { variants: [{ channelId: 'ch-1', text: 'oi', maxLength: 280, shortened: false }] };
            },
            rewrite: async (_a: unknown, input: Record<string, unknown>) => {
              recebidos.push(input);
              return { channelId: 'ch-1', text: 'r', maxLength: 280, overLimit: false };
            },
            hashtags: async () => ({ hashtags: ['#a'] }),
            altText: async () => ({ alt: 'um gato' }),
            draft: async () => ({ drafts: [] }),
            weekPlan: async () => ({ slots: [] }),
            canDescribeImages: true,
          },
    aiImage:
      'aiImage' in over
        ? over.aiImage
        : {
            enabled: true,
            generate: async () => ({
              media: {
                id: 'media-1',
                path: 'org-1/media-1.png',
                mime: 'image/png',
                byteSize: 68,
                width: 1,
                height: 1,
                alt: null,
                source: 'ai',
              },
            }),
          },
    storage: { publicUrl: (path: string) => `https://media.example/${path}` },
    bestTimes: async () => {
      chamadas.push('bestTimes');
      return {
        channelId: 'ch-1',
        timezone: 'America/Sao_Paulo',
        slots: [{ weekday: 1, hour: 9, score: 1 }],
        confidence: 'low' as const,
        sampleSize: 0,
        fromBaseline: true,
        signal: 'network_baseline' as const,
      };
    },
  } as unknown as Container;

  const app = aiRoutes(ctn);
  app.onError(errorHandler);
  return { app, chamadas, recebidos };
}

const UUID = '00000000-0000-4000-8000-000000000001';

describe('rotas de IA — autenticação', () => {
  it.each([
    ['post', '/caption'],
    ['post', '/rewrite'],
    ['post', '/hashtags'],
    ['post', '/alt-text'],
    ['post', '/draft'],
    ['post', '/week-plan'],
    ['post', '/image'],
    ['get', '/best-times'],
  ])('%s %s recusa sem sessão', async (method, path) => {
    const { app } = makeApp();
    const res = await app.request(path, {
      method: method.toUpperCase(),
      ...(method === 'post' ? { body: '{}', headers: { 'content-type': 'application/json' } } : {}),
    });
    expect(res.status).toBe(401);
  });
});

describe('instalação sem IA configurada (SPEC_AI §5.2)', () => {
  it('as rotas de geração respondem capability.disabled, nunca 500', async () => {
    const { app } = makeApp({ ai: null });
    const res = await app.request('/caption', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ brief: 'x', channelIds: [UUID] }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe('capability.disabled');
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  // a heurística não depende de modelo: continua servindo o plano Pro numa instalação sem IA
  it('best-times continua respondendo sem provedor configurado', async () => {
    const { app, chamadas } = makeApp({ ai: null });
    const res = await app.request(`/best-times?channelId=${UUID}`, { headers: AUTH });

    expect(res.status).toBe(200);
    expect(chamadas).toContain('bestTimes');
  });

  it('imagem continua independente quando apenas o provider de texto está desligado', async () => {
    const { app } = makeApp({ ai: null });
    const res = await app.request('/image', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'um gato', mode: 'economy' }),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { media: { id: string } }).media.id).toBe('media-1');
  });
});

describe('validação de contrato', () => {
  it('corpo fora do schema vira 400, não 500', async () => {
    const { app } = makeApp();
    const res = await app.request('/caption', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ brief: '', channelIds: [] }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { title: string }).title).toBe('validation.invalid_request');
  });

  it('channelId que não é uuid é recusado antes de chegar ao caso de uso', async () => {
    const { app, chamadas } = makeApp();
    const res = await app.request('/best-times?channelId=nao-e-uuid', { headers: AUTH });
    expect(res.status).toBe(400);
    expect(chamadas).not.toContain('bestTimes');
  });

  it('a lista de canais tem teto (um pedido não vira 200 gerações)', async () => {
    const { app } = makeApp();
    const res = await app.request('/caption', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ brief: 'x', channelIds: Array(50).fill(UUID) }),
    });
    expect(res.status).toBe(400);
  });
});

describe('rate-limit de rajada', () => {
  it('estourar a janela vira 429 com retryAfter', async () => {
    const { app } = makeApp({
      rateLimiter: { acquire: async () => ({ ok: false, retryAfterSec: 42 }) },
    });
    const res = await app.request(`/best-times?channelId=${UUID}`, { headers: AUTH });

    expect(res.status).toBe(429);
    const body = (await res.json()) as { title: string; extra: { retryAfterSec: number } };
    expect(body.title).toBe('rate.limited');
    expect(body.extra.retryAfterSec).toBe(42);
  });

  // consistente com SPEC_QUEUE §6: sem Redis a fila também falha aberta
  it('sem Redis o limite falha ABERTO em vez de bloquear a feature', async () => {
    const { app } = makeApp({ rateLimiter: null });
    const res = await app.request(`/best-times?channelId=${UUID}`, { headers: AUTH });
    expect(res.status).toBe(200);
  });

  it('a janela é por organização', async () => {
    const chaves: string[] = [];
    const { app } = makeApp({
      rateLimiter: {
        acquire: async (specs: { key: string }[]) => {
          chaves.push(...specs.map((s) => s.key));
          return { ok: true };
        },
      },
    });
    await app.request(`/best-times?channelId=${UUID}`, { headers: AUTH });
    expect(chaves).toEqual(['ai:org:org-1']);
  });
});

describe('caminho feliz', () => {
  it('caption devolve as variações do caso de uso', async () => {
    const { app } = makeApp();
    const res = await app.request('/caption', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ brief: 'novo café', channelIds: [UUID], tone: 'acolhedor' }),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { variants: unknown[] }).variants).toHaveLength(1);
  });

  it('best-times aceita fuso e limite', async () => {
    const { app } = makeApp();
    const res = await app.request(
      `/best-times?channelId=${UUID}&timezone=Europe/Lisbon&limit=3`,
      { headers: AUTH },
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { confidence: string }).confidence).toBe('low');
  });

  it('best-times nomeia o sinal que sustenta a resposta', async () => {
    const { app } = makeApp();
    const res = await app.request(`/best-times?channelId=${UUID}`, { headers: AUTH });
    expect(((await res.json()) as { signal: string }).signal).toBe('network_baseline');
  });
});

describe('reescrita — o canal é opcional e a instrução vem por id', () => {
  const post = (app: ReturnType<typeof makeApp>['app'], body: unknown) =>
    app.request('/rewrite', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('aceita reescrita SEM canal e não inventa um', async () => {
    const { app, recebidos } = makeApp();
    const res = await post(app, { text: 'meu texto', instructionId: 'fix_grammar' });

    expect(res.status).toBe(200);
    expect(recebidos[0]).toEqual({ text: 'meu texto', instructionId: 'fix_grammar' });
    expect(recebidos[0]).not.toHaveProperty('channelId');
  });

  it('repassa o canal quando ele vem', async () => {
    const { app, recebidos } = makeApp();
    await post(app, { text: 'x', instructionId: 'formal', channelId: UUID });
    expect(recebidos[0]).toMatchObject({ channelId: UUID });
  });

  it('id de instrução fora do catálogo é 400, sem chegar ao caso de uso', async () => {
    const { app, recebidos } = makeApp();
    const res = await post(app, { text: 'x', instructionId: 'me-obedeca' });

    expect(res.status).toBe(400);
    expect(recebidos).toHaveLength(0);
  });

  it('instrução livre continua aceita (chamador de API/MCP)', async () => {
    const { app, recebidos } = makeApp();
    const res = await post(app, { text: 'x', instruction: 'deixe irônico' });

    expect(res.status).toBe(200);
    expect(recebidos[0]).toMatchObject({ instruction: 'deixe irônico' });
  });

  it('as duas formas juntas são recusadas — ambiguidade não é problema do servidor resolver', async () => {
    const { app } = makeApp();
    const res = await post(app, { text: 'x', instruction: 'livre', instructionId: 'formal' });
    expect(res.status).toBe(400);
  });

  it('nenhuma das duas também é recusado', async () => {
    const { app } = makeApp();
    expect((await post(app, { text: 'x' })).status).toBe(400);
  });

  it('a resposta reporta overLimit e não fala de encurtamento', async () => {
    const { app } = makeApp();
    const corpo = (await (await post(app, { text: 'x', instructionId: 'expand' })).json()) as Record<
      string,
      unknown
    >;

    expect(corpo).toHaveProperty('overLimit');
    expect(corpo).not.toHaveProperty('shortened');
  });
});
