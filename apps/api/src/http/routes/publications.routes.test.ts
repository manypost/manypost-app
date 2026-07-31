import { describe, expect, it } from 'bun:test';
import type { PublicationFeedItem } from '@manypost/core';
import type { Container } from '../../container';
import { errorHandler } from '../middleware/error';
import { publicationRoutes } from './publications.routes';

const AUTH = { authorization: 'Bearer clerk-session' };

const row = (media?: PublicationFeedItem['content']['media']): PublicationFeedItem => ({
  id: 'pub-1',
  groupId: 'group-1',
  channelId: 'channel-1',
  state: 'SCHEDULED',
  publishAt: new Date('2026-07-31T14:00:00.000Z'),
  publishedAt: null,
  updatedAt: new Date('2026-07-31T13:00:00.000Z'),
  content: { text: 'Post com mídia', ...(media ? { media } : {}) },
  externalId: null,
  releaseUrl: null,
  errorClass: null,
  errorMessage: null,
  attemptCount: 0,
  group: { state: 'SCHEDULED', origin: 'WEB', awaitingApproval: false },
  channel: { provider: 'instagram', name: 'Manypost', username: 'manypost', avatarUrl: null },
});

function makeApp(item: PublicationFeedItem) {
  const ctn = {
    auth: {
      authenticateHuman: async (token: string) =>
        token === 'clerk-session'
          ? { userId: 'user-1', orgId: 'org-1', role: 'OWNER' as const }
          : null,
      verifyApiKey: async () => null,
    },
    runtime: { rateLimiter: null },
    posts: { feed: async () => [item] },
  } as unknown as Container;
  const app = publicationRoutes(ctn);
  app.onError(errorHandler);
  return app;
}

describe('GET /v1/publications — preview editorial', () => {
  it('projeta somente a primeira mídia de imagem já presente no conteúdo', async () => {
    const app = makeApp(
      row([
        { type: 'image', url: 'https://cdn.example/first.webp', mime: 'image/webp', alt: 'Mesa de trabalho' },
        { type: 'image', url: 'https://cdn.example/second.webp', mime: 'image/webp' },
      ]),
    );
    const response = await app.request('/?limit=20', { headers: AUTH });
    const body = (await response.json()) as { items: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.items[0]?.mediaPreview).toEqual({
      type: 'image',
      url: 'https://cdn.example/first.webp',
      mime: 'image/webp',
      alt: 'Mesa de trabalho',
    });
  });

  it('preserva o tipo vídeo sem transformar a resposta em player', async () => {
    const app = makeApp(row([{ type: 'video', url: 'https://cdn.example/reel.mp4', mime: 'video/mp4' }]));
    const body = (await (await app.request('/?limit=20', { headers: AUTH })).json()) as {
      items: Array<Record<string, unknown>>;
    };
    expect(body.items[0]?.mediaPreview).toEqual({
      type: 'video',
      url: 'https://cdn.example/reel.mp4',
      mime: 'video/mp4',
      alt: null,
    });
  });

  it('retorna null quando não há mídia, sem inventar placeholder', async () => {
    const app = makeApp(row());
    const body = (await (await app.request('/?limit=20', { headers: AUTH })).json()) as {
      items: Array<Record<string, unknown>>;
    };
    expect(body.items[0]?.mediaPreview).toBeNull();
  });
});
