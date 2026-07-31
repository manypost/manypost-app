import { z } from '@hono/zod-openapi';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonResponse } from '../openapi';

/** tamanho do excerto: o suficiente para reconhecer o post, longe de devolver o post */
const EXCERTO = 160;

const HitOut = z
  .object({
    groupId: z.string(),
    state: z.string().openapi({ example: 'DRAFT' }),
    publishAt: z.string().datetime().nullable(),
    text: z.string().openapi({ description: `excerto de até ${EXCERTO} caracteres` }),
    channels: z.array(z.object({ provider: z.string(), name: z.string() })),
  })
  .openapi('SearchHit');

const SearchOut = z.object({ items: z.array(HitOut) }).openapi('SearchResults');

const Query = z.object({
  q: z.string().trim().min(2).max(80),
  // teto no SCHEMA, não só default: um `limit` grande é recusado em vez de silenciosamente cortado
  limit: z.coerce.number().int().min(1).max(10).default(8),
});

/**
 * Busca de posts — a leitura que alimenta a paleta de comandos.
 *
 * **Por que não é um `q` em `/v1/publications`.** O feed é ordenado por `publish_at ASC` com cursor
 * keyset e é o contrato compartilhado do calendário e do quadro. Resultado de busca em ordem de
 * agendamento é inútil; inverter a ordem sob `q` quebraria o significado do cursor; e o feed
 * devolve uma linha por publicação, quando a busca quer uma por post.
 *
 * **Sem cache e sem paginação, de propósito.** São no máximo dez itens que só existem enquanto
 * alguém digita.
 *
 * O custo é contido por quatro limites, não por índice: `org_id` confina a varredura à fatia de um
 * inquilino, a janela de 180 dias confina mais, o mínimo de 2 caracteres impede um `%%`, e o teto
 * de 10 resultados é do schema. `pg_trgm` foi deliberadamente descartado — `CREATE EXTENSION` exige
 * um privilégio que Postgres gerenciado costuma negar, e quebrar a migração de todo mundo para
 * acelerar uma tela é a troca errada (design.md da mudança `add-global-command-palette`).
 */
export function searchRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ authenticateHuman: ctn.auth.authenticateHuman }));

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/',
    tags: ['search'],
    security: AUTH_SECURITY,
    summary: 'Busca posts pelo texto (paleta de comandos)',
    description:
      'Busca no conteúdo dos posts da organização autenticada. Escopo por organização vem do ' +
      'principal e nunca da requisição. Consulta de 2 a 80 caracteres, até 10 resultados, ' +
      'restrita aos últimos 180 dias. Devolve excerto, estado e canais — nunca credencial.',
    request: { query: Query },
    responses: { 200: jsonResponse('resultados', SearchOut), ...errorResponses(400, 401) },
  });

  app.get('/', async (c) => {
    const { q, limit } = Query.parse(c.req.query());
    // orgId do principal: um orgId vindo na query é ignorado, não confiado
    const hits = await ctn.posts.search(c.get('principal').orgId, q, limit);
    return c.json({
      items: hits.map((h) => ({
        groupId: h.groupId,
        state: h.state,
        publishAt: h.publishAt?.toISOString?.() ?? (h.publishAt as string | null) ?? null,
        text: h.text.slice(0, EXCERTO),
        channels: h.channels,
      })),
    });
  });

  return app;
}
