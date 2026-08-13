/**
 * Serialização compartilhada das superfícies de máquina (REST interno, /public/v1 e MCP).
 *
 * Uma entidade compartilhada tem UMA forma de fio. As cópias locais por rota divergiram na
 * prática (o MCP omitia `media`/`attemptCount`; o feed público ficou sem `publishedAt`/
 * `updatedAt`/`mediaPreview`; a mídia pública sem `source`) — por isso a regra do spec
 * `machine-api-contract`: rota e tool consomem este módulo, nunca redeclaram a forma.
 *
 * Os schemas zod `.openapi()` das rotas continuam sendo documentação; o runtime é daqui.
 */
import type { MediaRecord, PublicationFeedItem } from '@manypost/core';
import { z } from '@hono/zod-openapi';
import type { Container } from '../../../container';

/** grupo como o `posts.getGroup` devolve — a entrada canônica de serialização */
export type SerializableGroup = NonNullable<Awaited<ReturnType<Container['posts']['getGroup']>>>;

export const serializeGroup = (g: SerializableGroup) => ({
  id: g.id,
  state: g.state,
  publishAt: g.publishAt?.toISOString() ?? null,
  publications: g.publications.map((p) => ({
    id: p.id,
    channelId: p.channelId,
    state: p.state,
    media: p.content.media ?? [],
    itemCount: p.itemCount ?? 1,
    /** progresso da thread: itens <= índice já estão na rede */
    lastPublishedIndex: p.lastPublishedIndex,
    attemptCount: p.attemptCount,
    externalId: p.externalId,
    releaseUrl: p.releaseUrl,
    errorClass: p.errorClass,
    errorMessage: p.errorMessage,
  })),
});

export const serializeFeedItem = (p: PublicationFeedItem) => {
  const preview = p.content.media?.[0];
  return {
    id: p.id,
    groupId: p.groupId,
    channelId: p.channelId,
    state: p.state,
    publishAt: p.publishAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    text: p.content.text,
    mediaCount: p.content.media?.length ?? 0,
    mediaPreview: preview
      ? { type: preview.type, url: preview.url, mime: preview.mime ?? null, alt: preview.alt ?? null }
      : null,
    externalId: p.externalId,
    releaseUrl: p.releaseUrl,
    errorClass: p.errorClass,
    errorMessage: p.errorMessage,
    attemptCount: p.attemptCount,
    group: p.group,
    channel: p.channel,
  };
};

export const serializeMedia = (publicUrl: (path: string) => string, m: MediaRecord) => ({
  id: m.id,
  url: publicUrl(m.path),
  mime: m.mime,
  // a biblioteca (e toda superfície) marca o que é sintético (SPEC ai-image-generation)
  source: m.source,
  byteSize: m.byteSize,
  width: m.width,
  height: m.height,
  alt: m.alt,
  createdAt: m.createdAt.toISOString(),
});

// ---- cursor keyset do feed de publicações: (publishAt, id) ----

export const encodeCursor = (publishAt: Date | null, id: string) =>
  Buffer.from(JSON.stringify({ p: (publishAt ?? new Date(0)).toISOString(), id })).toString(
    'base64url',
  );

export const decodeCursor = (raw: string): { publishAt: Date; id: string } | undefined => {
  try {
    const { p, id } = JSON.parse(Buffer.from(raw, 'base64url').toString()) as { p: string; id: string };
    const publishAt = new Date(p);
    if (Number.isNaN(publishAt.getTime()) || typeof id !== 'string') return undefined;
    return { publishAt, id };
  } catch {
    return undefined; // cursor malformado = primeira página (não vaza detalhe)
  }
};

/** query param csv → array validado (mesmo comportamento no feed interno e no público) */
export const csvParam = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(item).min(1).max(50));
