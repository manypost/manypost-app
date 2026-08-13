import { z } from '@hono/zod-openapi';
import { PublicationStates, type PublicationState } from '@manypost/contracts';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonResponse } from '../openapi';
import { csvParam, decodeCursor, encodeCursor, serializeFeedItem } from './shared/serialize';

// schema só de documentação: o Query real usa transforms (csv/coerce) que não renderizam
// limpo em OpenAPI — aqui descrevemos os params como o cliente os envia (strings de query).
const QueryDoc = z.object({
  from: z.string().datetime().optional().openapi({ description: 'início do período (ISO 8601)' }),
  to: z.string().datetime().optional().openapi({ description: 'fim do período (ISO 8601)' }),
  state: z
    .string()
    .optional()
    .openapi({ description: 'csv de estados de publicação', example: 'SCHEDULED,PUBLISHED' }),
  channelId: z.string().optional().openapi({ description: 'csv de ids de canal' }),
  cursor: z.string().optional().openapi({ description: 'cursor keyset da página anterior' }),
  limit: z.string().optional().openapi({ description: '1–200 (default 100)', example: '100' }),
});

const FeedItemOut = z
  .object({
    id: z.string(),
    groupId: z.string(),
    channelId: z.string(),
    state: z.string().openapi({ example: 'PUBLISHED' }),
    publishAt: z.string().datetime().nullable(),
    publishedAt: z.string().datetime().nullable().openapi({ description: 'quando a entrega aconteceu' }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ description: 'última mutação da linha — ordena atividade recente' }),
    text: z.string(),
    mediaCount: z.number().int(),
    mediaPreview: z
      .object({
        type: z.enum(['image', 'video']),
        url: z.string(),
        mime: z.string().nullable(),
        alt: z.string().nullable(),
      })
      .nullable()
      .openapi({ description: 'primeira mídia do conteúdo para reconhecimento visual do card' }),
    externalId: z.string().nullable(),
    releaseUrl: z.string().nullable(),
    errorClass: z.string().nullable(),
    errorMessage: z.string().nullable(),
    attemptCount: z.number().int(),
    group: z.object({
      state: z.string(),
      origin: z.string().openapi({ example: 'WEB' }),
      awaitingApproval: z.boolean(),
    }),
    channel: z.object({
      provider: z.string(),
      name: z.string(),
      username: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
  })
  .openapi('FeedItem');

const FeedOut = z
  .object({
    items: z.array(FeedItemOut),
    nextCursor: z.string().nullable().openapi({ description: 'cursor keyset da próxima página' }),
  })
  .openapi('PublicationFeed');

const Query = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /** csv de estados de publicação (ex.: state=SCHEDULED,FAILED) */
  state: csvParam(
    z.enum(PublicationStates as unknown as [PublicationState, ...PublicationState[]]),
  ).optional(),
  /** csv de ids de canal */
  channelId: csvParam(z.string().uuid()).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/** Feed p/ calendário e kanban (SPEC_FRONTEND §3.1-3.2): flat por publicação,
 *  o cliente agrupa por groupId; cursor keyset (publishAt, id). */
export function publicationRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({
    authenticateHuman: ctn.auth.authenticateHuman,
  }));

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/',
    tags: ['publications'],
    security: AUTH_SECURITY,
    summary: 'Feed flat de publicações (calendário/kanban)',
    description:
      'Uma linha por publicação (o cliente agrupa por groupId). Cada item embute grupo (state/origin/awaitingApproval) e canal. Paginação keyset por (publishAt, id).',
    request: { query: QueryDoc },
    responses: { 200: jsonResponse('página do feed', FeedOut), ...errorResponses(400, 401) },
  });
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
      items: page.map(serializeFeedItem),
      nextCursor: rows.length > q.limit && last ? encodeCursor(last.publishAt, last.id) : null,
    });
  });

  return app;
}
