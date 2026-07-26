import { z } from 'zod';
import type { ChannelProvider, ProviderContext, PublishItem, TokenSet } from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

/**
 * Provider fake para dev e E2E (SPEC_ROADMAP fase 0): simula uma rede social em memória.
 * Comportamentos injetáveis via settings para testar o pipeline:
 *   failFirstAttempts — falha transitória N vezes antes de publicar
 *   expireToken       — força classificação refresh-token
 *   rejectContent     — força erro permanente
 *   dropConnection    — cai SEM resposta HTTP nas N primeiras tentativas (resultado incerto)
 */
const settingsSchema = z.object({
  failFirstAttempts: z.number().int().min(0).default(0).describe('Falha transitória nas N primeiras tentativas (dev)'),
  expireToken: z.boolean().default(false).describe('Simula token expirado (dev)'),
  rejectContent: z.boolean().default(false).describe('Rejeita o conteúdo como erro permanente (dev)'),
  failFirstReplyAttempts: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Falha transitória nas N primeiras réplicas de thread — testa retomada pelo cursor (dev)'),
  dropConnection: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Derruba a conexão sem resposta nas N primeiras tentativas — exercita a idempotência (dev)'),
});

const attempts = new Map<string, number>();
/** posts já criados por chave de idempotência — repetir a chave devolve o MESMO post */
const byIdempotencyKey = new Map<string, { externalId: string; releaseUrl: string }>();

const create = (key: string | undefined, releaseUrl: (id: string) => string) => {
  const cached = key ? byIdempotencyKey.get(key) : undefined;
  if (cached) return cached;
  const id = crypto.randomUUID();
  const result = { externalId: id, releaseUrl: releaseUrl(id) };
  if (key) byIdempotencyKey.set(key, result);
  return result;
};

export const fakeProvider: ChannelProvider = {
  id: 'fake',
  name: 'Fake Network (dev)',
  capabilities: {
    editor: 'plain',
    maxLength: () => 500,
    media: {
      images: { maxCount: 4, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      videos: { maxCount: 1, mimeTypes: ['video/mp4'], maxDurationSec: 140 },
    },
    threads: true,
    mentions: false,
    analytics: true,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: { maxConcurrent: 2, perChannelWindow: { limit: 10, windowSec: 60 } },
  settingsSchema,
  // simula uma rede que desduplica pela chave (como o Mastodon): repetir a mesma
  // `ctx.idempotencyKey` devolve o post já criado em vez de criar outro
  idempotentPublish: true,

  async getAuthUrl(_ctx: ProviderContext, { redirectUri }) {
    const state = crypto.randomUUID();
    return { url: `${redirectUri}?fake=1&state=${state}&code=fake-code`, state };
  },

  async exchangeCode(_ctx, input) {
    // `code=fake-code` (padrão) sempre resolve a MESMA conta — é o que os E2E existentes
    // usam para exercitar reconexão/upsert. Um sufixo (`fake-code-b`) vira uma conta
    // distinta, o que permite testar cenários com vários canais (ex.: teto de plano).
    const suffix = input.code.startsWith('fake-code-') ? input.code.slice('fake-code-'.length) : '';
    return {
      accessToken: `fake-access-${crypto.randomUUID()}`,
      refreshToken: `fake-refresh-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      scopes: ['read', 'write'],
      externalId: suffix ? `fake-user-${suffix}` : 'fake-user-1',
      name: suffix ? `Fake User ${suffix}` : 'Fake User',
      username: suffix ? `fakeuser-${suffix}` : 'fakeuser',
    };
  },

  async refreshToken(_ctx, _refreshToken) {
    return {
      accessToken: `fake-access-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      scopes: ['read', 'write'],
    };
  },

  async publish(ctx, token: TokenSet, items: PublishItem[], rawSettings) {
    const settings = settingsSchema.parse(rawSettings ?? {});
    if (settings.expireToken) throw { status: 401, body: '{"error":"token expired"}' };
    if (settings.rejectContent) throw { status: 422, body: '{"error":"content rejected"}' };

    // contador por token+conteúdo: falhas transitórias não vazam entre posts diferentes
    const key = `${token.accessToken}:${items[0]?.content ?? ''}`;
    const n = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, n);
    if (n <= settings.failFirstAttempts) throw { status: 500, body: '{"error":"flaky"}' };
    if (n <= settings.failFirstAttempts + settings.dropConnection) {
      // o post É criado e a resposta se perde — é o cenário que a chave de idempotência cobre
      for (const _ of items) create(ctx.idempotencyKey, (id) => `https://fake.example/p/${id}`);
      throw new Error('socket hang up');
    }

    return items.map(() => create(ctx.idempotencyKey, (id) => `https://fake.example/p/${id}`));
  },

  async publishReply(ctx, token: TokenSet, parentExternalId, item, rawSettings) {
    const settings = settingsSchema.parse(rawSettings ?? {});
    const key = `${token.accessToken}:reply:${item.content}`;
    const n = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, n);
    if (n <= settings.failFirstReplyAttempts) throw { status: 500, body: '{"error":"flaky reply"}' };
    return create(ctx.idempotencyKey, (id) => `https://fake.example/p/${parentExternalId}/r/${id}`);
  },

  async validateMedia(items) {
    return checkMediaRules(items, fakeProvider.capabilities.media);
  },

  classifyError(status) {
    if (status === 401) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },

  async fetchAnalytics(_ctx, _token, range) {
    return [
      {
        metric: 'impressions',
        points: [{ date: range.from, value: 42 }],
      },
    ];
  },
};
