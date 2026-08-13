import { describe, expect, it } from 'bun:test';
import type { MediaRecord, PublicationFeedItem } from '@manypost/core';
import {
  decodeCursor,
  encodeCursor,
  serializeFeedItem,
  serializeGroup,
  serializeMedia,
  type SerializableGroup,
} from './serialize';

const GROUP: SerializableGroup = {
  id: 'g-1',
  state: 'SCHEDULED',
  publishAt: new Date('2026-08-13T12:00:00.000Z'),
  timezone: 'UTC',
  baseContent: { text: 'olá' },
  publications: [
    {
      id: 'p-1',
      orgId: 'org-1',
      groupId: 'g-1',
      channelId: 'c-1',
      state: 'SCHEDULED',
      publishAt: new Date('2026-08-13T12:00:00.000Z'),
      content: {
        text: 'olá',
        media: [{ mediaId: 'm-1', type: 'image', url: 'https://cdn/m-1.png', mime: 'image/png' }],
      },
      settings: {},
      attemptCount: 2,
      jobVersion: 1,
      lastPublishedIndex: 0,
      itemCount: 3,
      externalId: null,
      releaseUrl: null,
      errorClass: null,
      errorMessage: null,
    },
  ],
};

const FEED_ITEM: PublicationFeedItem = {
  id: 'p-1',
  groupId: 'g-1',
  channelId: 'c-1',
  state: 'PUBLISHED',
  publishAt: new Date('2026-08-13T09:00:00.000Z'),
  publishedAt: new Date('2026-08-13T09:00:02.000Z'),
  updatedAt: new Date('2026-08-13T14:30:00.000Z'),
  content: {
    text: 'publicado',
    media: [
      { mediaId: 'm-1', type: 'image', url: 'https://cdn/m-1.png', mime: 'image/png', alt: 'capa' },
      { mediaId: 'm-2', type: 'video', url: 'https://cdn/m-2.mp4', mime: 'video/mp4' },
    ],
  },
  externalId: 'ext-9',
  releaseUrl: 'https://rede/post/9',
  errorClass: null,
  errorMessage: null,
  attemptCount: 1,
  group: { state: 'DONE', origin: 'WEB', awaitingApproval: false },
  channel: { provider: 'mastodon', name: 'Conta', username: 'conta', avatarUrl: null },
};

const MEDIA: MediaRecord = {
  id: 'm-1',
  orgId: 'org-1',
  path: 'org-1/m-1.png',
  mime: 'image/png',
  byteSize: 1234,
  width: 800,
  height: 600,
  durationSec: null,
  thumbnailPath: null,
  alt: 'capa',
  blurhash: null,
  source: 'ai',
  generationPrompt: 'um gato',
  generationModel: 'modelo-x',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

describe('serializeGroup — uma fonte para REST, público e MCP', () => {
  it('serializa o grupo com media e attemptCount em cada publicação', () => {
    const out = serializeGroup(GROUP);

    expect(out).toEqual({
      id: 'g-1',
      state: 'SCHEDULED',
      publishAt: '2026-08-13T12:00:00.000Z',
      publications: [
        {
          id: 'p-1',
          channelId: 'c-1',
          state: 'SCHEDULED',
          media: [
            { mediaId: 'm-1', type: 'image', url: 'https://cdn/m-1.png', mime: 'image/png' },
          ],
          itemCount: 3,
          lastPublishedIndex: 0,
          attemptCount: 2,
          externalId: null,
          releaseUrl: null,
          errorClass: null,
          errorMessage: null,
        },
      ],
    });
  });

  it('grupo sem horário e publicação sem mídia serializam null e lista vazia', () => {
    const { itemCount: _semContagem, ...publicacaoSemItemCount } = GROUP.publications[0]!;
    const semMidia: SerializableGroup = {
      ...GROUP,
      publishAt: null,
      publications: [{ ...publicacaoSemItemCount, content: { text: 'só texto' } }],
    };
    const out = serializeGroup(semMidia);

    expect(out.publishAt).toBeNull();
    expect(out.publications[0]!.media).toEqual([]);
    expect(out.publications[0]!.itemCount).toBe(1);
  });
});

describe('serializeFeedItem — o feed interno e o público têm a mesma linha', () => {
  it('inclui publishedAt, updatedAt e mediaPreview da primeira mídia', () => {
    const out = serializeFeedItem(FEED_ITEM);

    expect(out.publishedAt).toBe('2026-08-13T09:00:02.000Z');
    expect(out.updatedAt).toBe('2026-08-13T14:30:00.000Z');
    expect(out.mediaPreview).toEqual({
      type: 'image',
      url: 'https://cdn/m-1.png',
      mime: 'image/png',
      alt: 'capa',
    });
    expect(out.mediaCount).toBe(2);
    expect(out.attemptCount).toBe(1);
  });

  it('sem mídia, o preview é null e a contagem é zero', () => {
    const out = serializeFeedItem({
      ...FEED_ITEM,
      publishedAt: null,
      content: { text: 'sem mídia' },
    });

    expect(out.mediaPreview).toBeNull();
    expect(out.mediaCount).toBe(0);
    expect(out.publishedAt).toBeNull();
  });
});

describe('serializeMedia — a proveniência acompanha a mídia em toda superfície', () => {
  it('expõe source e resolve a URL pública pelo storage', () => {
    const out = serializeMedia((path) => `https://files.example/${path}`, MEDIA);

    expect(out).toEqual({
      id: 'm-1',
      url: 'https://files.example/org-1/m-1.png',
      mime: 'image/png',
      source: 'ai',
      byteSize: 1234,
      width: 800,
      height: 600,
      alt: 'capa',
      createdAt: '2026-08-01T00:00:00.000Z',
    });
  });
});

describe('cursor keyset — compartilhado e à prova de entrada malformada', () => {
  it('faz roundtrip de (publishAt, id)', () => {
    const publishAt = new Date('2026-08-13T10:00:00.000Z');
    const decoded = decodeCursor(encodeCursor(publishAt, 'p-42'));

    expect(decoded).toEqual({ publishAt, id: 'p-42' });
  });

  it('publishAt nulo codifica a época para ordenar antes de tudo', () => {
    const decoded = decodeCursor(encodeCursor(null, 'p-0'));

    expect(decoded).toEqual({ publishAt: new Date(0), id: 'p-0' });
  });

  it('cursor malformado devolve undefined (primeira página), sem vazar erro', () => {
    expect(decodeCursor('lixo')).toBeUndefined();
    expect(decodeCursor(Buffer.from('{"p":"não-é-data"}').toString('base64url'))).toBeUndefined();
    expect(
      decodeCursor(Buffer.from(JSON.stringify({ p: new Date().toISOString(), id: 7 })).toString('base64url')),
    ).toBeUndefined();
  });
});
