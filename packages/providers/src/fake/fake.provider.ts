import { z } from 'zod';
import type { ChannelProvider, ProviderContext, PublishItem, TokenSet } from '@manypost/contracts';

/**
 * Provider fake para dev e E2E (SPEC_ROADMAP fase 0): simula uma rede social em memória.
 * Comportamentos injetáveis via settings para testar o pipeline:
 *   failFirstAttempts — falha transitória N vezes antes de publicar
 *   expireToken       — força classificação refresh-token
 *   rejectContent     — força erro permanente
 */
const settingsSchema = z.object({
  failFirstAttempts: z.number().int().min(0).default(0),
  expireToken: z.boolean().default(false),
  rejectContent: z.boolean().default(false),
});

const attempts = new Map<string, number>();

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

  async getAuthUrl(_ctx: ProviderContext, { redirectUri }) {
    const state = crypto.randomUUID();
    return { url: `${redirectUri}?fake=1&state=${state}&code=fake-code`, state };
  },

  async exchangeCode(_ctx, _input) {
    return {
      accessToken: `fake-access-${crypto.randomUUID()}`,
      refreshToken: `fake-refresh-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      scopes: ['read', 'write'],
      externalId: 'fake-user-1',
      name: 'Fake User',
      username: 'fakeuser',
    };
  },

  async refreshToken(_ctx, _refreshToken) {
    return {
      accessToken: `fake-access-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      scopes: ['read', 'write'],
    };
  },

  async publish(_ctx, token: TokenSet, items: PublishItem[], rawSettings) {
    const settings = settingsSchema.parse(rawSettings ?? {});
    if (settings.expireToken) throw { status: 401, body: '{"error":"token expired"}' };
    if (settings.rejectContent) throw { status: 422, body: '{"error":"content rejected"}' };

    // contador por token+conteúdo: falhas transitórias não vazam entre posts diferentes
    const key = `${token.accessToken}:${items[0]?.content ?? ''}`;
    const n = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, n);
    if (n <= settings.failFirstAttempts) throw { status: 500, body: '{"error":"flaky"}' };

    return items.map(() => {
      const id = crypto.randomUUID();
      return { externalId: id, releaseUrl: `https://fake.example/p/${id}` };
    });
  },

  async validateMedia(items) {
    const tooMany = items.some((i) => i.media.filter((m) => m.type === 'image').length > 4);
    return tooMany ? { ok: false, reason: 'máximo de 4 imagens' } : { ok: true };
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
