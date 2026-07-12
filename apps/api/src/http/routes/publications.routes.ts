import { OpenAPIHono, z } from '@hono/zod-openapi';
import { PublicationStates, type PublicationState } from '@manypost/contracts';
import type { PublicationFeedItem } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(item).min(1).max(50));

const Query = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /** csv de estados de publicação (ex.: state=SCHEDULED,FAILED) */
  state: csv(z.enum(PublicationStates as unknown as [PublicationState, ...PublicationState[]])).optional(),
  /** csv de ids de canal */
  channelId: csv(z.string().uuid()).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const encodeCursor = (publishAt: Date | null, id: string) =>
  Buffer.from(JSON.stringify({ p: (publishAt ?? new Date(0)).toISOString(), id })).toString(
    'base64url',
  );

const decodeCursor = (raw: string): { publishAt: Date; id: string } | undefined => {
  try {
    const { p, id } = JSON.parse(Buffer.from(raw, 'base64url').toString()) as { p: string; id: string };
    const publishAt = new Date(p);
    if (Number.isNaN(publishAt.getTime()) || typeof id !== 'string') return undefined;
    return { publishAt, id };
  } catch {
    return undefined; // cursor malformado = primeira página (não vaza detalhe)
  }
};

const serialize = (p: PublicationFeedItem) => ({
  id: p.id,
  groupId: p.groupId,
  channelId: p.channelId,
  state: p.state,
  publishAt: p.publishAt?.toISOString() ?? null,
  text: p.content.text,
  mediaCount: p.content.media?.length ?? 0,
  externalId: p.externalId,
  releaseUrl: p.releaseUrl,
  errorClass: p.errorClass,
  errorMessage: p.errorMessage,
  attemptCount: p.attemptCount,
  group: p.group,
  channel: p.channel,
});

/** Feed p/ calendário e kanban (SPEC_FRONTEND §3.1-3.2): flat por publicação,
 *  o cliente agrupa por groupId; cursor keyset (publishAt, id). */
export function publicationRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.get('/', async (c) => {
    const q = Query.parse(c.req.query());
    const cursor = q.cursor ? decodeCursor(q.cursor) : undefined;
    // limit+1 para saber se existe próxima página sem count()
    const rows = await ctn.posts.feed(c.get('principal').orgId, {
      ...(q.from ? { from: new Date(q.from) } : {}),
      ...(q.to ? { to: new Date(q.to) } : {}),
      ...(q.state ? { states: q.state } : {}),
      ...(q.channelId ? { channelIds: q.channelId } : {}),
      ...(cursor ? { cursor } : {}),
      limit: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return c.json({
      items: page.map(serialize),
      nextCursor: rows.length > q.limit && last ? encodeCursor(last.publishAt, last.id) : null,
    });
  });

  return app;
}
