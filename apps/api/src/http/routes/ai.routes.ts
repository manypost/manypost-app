import { z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonBody, jsonResponse } from '../openapi';

/**
 * Superfície de IA (SPEC_AI §3). Duas naturezas convivem aqui:
 *
 *  - geração por modelo (`/caption`, `/rewrite`, `/hashtags`, `/alt-text`, `/draft`,
 *    `/week-plan`): exige provedor configurado, gate de plano e franquia;
 *  - `/best-times`: heurística estatística, sem modelo e sem franquia — por isso continua
 *    respondendo mesmo numa instalação com `AI_PROVIDER=none`.
 */

const ChannelIds = z
  .array(z.string().uuid())
  .min(1)
  .max(20)
  .openapi({ description: 'canais de destino — todos precisam ser desta organização' });

const Settings = z
  .record(z.string(), z.unknown())
  .optional()
  .openapi({
    description:
      'settings da publicação, mergeados com os do canal — mesma semântica do agendamento ' +
      '(uma conta verificada do X, por exemplo, valida contra o limite maior)',
  });

const Variant = z
  .object({
    channelId: z.string(),
    text: z.string(),
    maxLength: z.number().int(),
    shortened: z
      .boolean()
      .openapi({ description: 'true = o texto passou do limite do canal e foi cortado' }),
  })
  .openapi('AiVariant');

const CaptionBody = z.object({
  brief: z.string().min(1).max(4000),
  channelIds: ChannelIds,
  tone: z.string().max(120).optional(),
  settings: Settings,
});

const RewriteBody = z.object({
  text: z.string().min(1).max(20_000),
  instruction: z.string().min(1).max(500),
  channelId: z.string().uuid(),
  settings: Settings,
});

const HashtagsBody = z.object({
  text: z.string().min(1).max(20_000),
  channelId: z.string().uuid(),
  count: z.number().int().min(1).max(30).optional(),
});

const AltTextBody = z.object({
  mediaId: z.string().uuid(),
  context: z.string().max(2000).optional(),
  maxLength: z.number().int().min(60).max(1000).optional(),
});

const DraftBody = z.object({
  idea: z.string().min(1).max(4000),
  channelIds: ChannelIds,
  tone: z.string().max(120).optional(),
  settings: Settings,
});

const WeekPlanBody = z.object({
  goal: z.string().min(1).max(2000),
  channelIds: ChannelIds,
  weekStart: z.string().datetime().openapi({ description: 'início da semana, ISO 8601' }),
  slots: z.number().int().min(1).max(21).optional(),
  settings: Settings,
});

const PlannedSlot = z
  .object({
    channelId: z.string(),
    topic: z.string(),
    text: z.string(),
    publishAt: z.string().datetime(),
    maxLength: z.number().int(),
    shortened: z.boolean(),
  })
  .openapi('AiPlannedSlot');

const BestTimes = z
  .object({
    channelId: z.string(),
    timezone: z.string(),
    slots: z.array(
      z.object({
        weekday: z.number().int().openapi({ description: '0 = domingo … 6 = sábado' }),
        hour: z.number().int(),
        score: z.number(),
      }),
    ),
    confidence: z.enum(['low', 'medium', 'high']),
    sampleSize: z
      .number()
      .int()
      .openapi({ description: 'publicações da própria organização que sustentam a resposta' }),
    fromBaseline: z
      .boolean()
      .openapi({ description: 'true = veio da linha de base da rede, sem histórico próprio' }),
  })
  .openapi('AiBestTimes');

export function aiRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ authenticateHuman: ctn.auth.authenticateHuman }));

  /**
   * A franquia mensal limita o CUSTO, não o ritmo: sem isto, um laço esgotaria o mês em
   * segundos e saturaria o provedor. Janela por organização, falhando aberto sem Redis —
   * mesma política da fila (SPEC_QUEUE §6), não uma segunda inventada aqui.
   */
  app.use('*', async (c, next) => {
    const limiter = ctn.runtime.rateLimiter;
    if (!limiter) return next();
    const verdict = await limiter.acquire([
      { key: `ai:org:${c.get('principal').orgId}`, limit: 30, windowSec: 60 },
    ]);
    if (!verdict.ok) {
      throw new DomainError(ErrorCodes.RateLimited, 'muitos pedidos de IA — aguarde um instante', {
        retryAfterSec: verdict.retryAfterSec,
      });
    }
    await next();
  });

  /** instalação sem IA responde `capability.disabled` (404), nunca 500 — SPEC_AI §5.2 */
  const requireAi = () => {
    if (!ctn.ai) {
      throw new DomainError(
        ErrorCodes.CapabilityDisabled,
        'Esta instalação não tem IA configurada.',
      );
    }
    return ctn.ai;
  };

  const actor = (c: { get: (k: 'principal') => { orgId: string; userId: string } }) => ({
    orgId: c.get('principal').orgId,
    userId: c.get('principal').userId,
  });

  const erros = errorResponses(400, 401, 402, 404, 429);

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/caption',
    tags: ['ai'],
    security: AUTH_SECURITY,
    summary: 'Gera uma legenda por canal, adaptada a cada rede',
    description:
      'Requer a feature `ai_caption` (plano Pro). O texto devolvido SEMPRE respeita o limite ' +
      'do canal: se o modelo passar, cortamos numa fronteira de frase e marcamos `shortened`.',
    request: jsonBody(CaptionBody),
    responses: {
      200: jsonResponse('legendas por canal', z.object({ variants: z.array(Variant) })),
      ...erros,
    },
  });
  app.post('/caption', async (c) => {
    const body = CaptionBody.parse(await c.req.json());
    return c.json(
      await requireAi().caption(actor(c), {
        brief: body.brief,
        channelIds: body.channelIds,
        ...(body.tone ? { tone: body.tone } : {}),
        ...(body.settings ? { settings: body.settings } : {}),
      }),
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/rewrite',
    tags: ['ai'],
    security: AUTH_SECURITY,
    summary: 'Reescreve um texto seguindo uma instrução',
    description: 'Requer a feature `ai_caption` (plano Pro).',
    request: jsonBody(RewriteBody),
    responses: { 200: jsonResponse('texto reescrito', Variant), ...erros },
  });
  app.post('/rewrite', async (c) => {
    const body = RewriteBody.parse(await c.req.json());
    return c.json(
      await requireAi().rewrite(actor(c), {
        text: body.text,
        instruction: body.instruction,
        channelId: body.channelId,
        ...(body.settings ? { settings: body.settings } : {}),
      }),
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/hashtags',
    tags: ['ai'],
    security: AUTH_SECURITY,
    summary: 'Sugere hashtags para um texto e uma rede',
    description: 'Requer a feature `ai_caption` (plano Pro).',
    request: jsonBody(HashtagsBody),
    responses: {
      200: jsonResponse('hashtags sugeridas', z.object({ hashtags: z.array(z.string()) })),
      ...erros,
    },
  });
  app.post('/hashtags', async (c) => {
    const body = HashtagsBody.parse(await c.req.json());
    return c.json(
      await requireAi().hashtags(actor(c), {
        text: body.text,
        channelId: body.channelId,
        ...(body.count ? { count: body.count } : {}),
      }),
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/alt-text',
    tags: ['ai'],
    security: AUTH_SECURITY,
    summary: 'Descreve uma imagem da biblioteca para leitores de tela',
    description:
      'Requer a feature `ai_caption` (plano Pro) **e** um modelo que enxergue imagem. Sem essa ' +
      'capacidade responde 501 `ai.capability_unavailable` — descrever pelo nome do arquivo ' +
      'seria pior que não descrever.',
    request: jsonBody(AltTextBody),
    responses: {
      200: jsonResponse('descrição da imagem', z.object({ alt: z.string() })),
      ...errorResponses(400, 401, 402, 404, 429, 501),
    },
  });
  app.post('/alt-text', async (c) => {
    const body = AltTextBody.parse(await c.req.json());
    return c.json(
      await requireAi().altText(actor(c), {
        mediaId: body.mediaId,
        ...(body.context ? { context: body.context } : {}),
        ...(body.maxLength ? { maxLength: body.maxLength } : {}),
      }),
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/draft',
    tags: ['ai'],
    security: AUTH_SECURITY,
    summary: 'Transforma uma ideia em um rascunho por canal',
    description: 'Requer a feature `ai_multichannel_draft` (plano Premium).',
    request: jsonBody(DraftBody),
    responses: {
      200: jsonResponse('rascunhos por canal', z.object({ drafts: z.array(Variant) })),
      ...erros,
    },
  });
  app.post('/draft', async (c) => {
    const body = DraftBody.parse(await c.req.json());
    return c.json(
      await requireAi().draft(actor(c), {
        idea: body.idea,
        channelIds: body.channelIds,
        ...(body.tone ? { tone: body.tone } : {}),
        ...(body.settings ? { settings: body.settings } : {}),
      }),
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/week-plan',
    tags: ['ai'],
    security: AUTH_SECURITY,
    summary: 'Propõe uma semana de publicações',
    description:
      'Requer a feature `ai_calendar` (plano Premium). **Propõe, não agenda**: nada é criado, ' +
      'agendado ou publicado por esta rota — o resultado é material que uma pessoa aceita.',
    request: jsonBody(WeekPlanBody),
    responses: {
      200: jsonResponse('semana proposta', z.object({ slots: z.array(PlannedSlot) })),
      ...erros,
    },
  });
  app.post('/week-plan', async (c) => {
    const body = WeekPlanBody.parse(await c.req.json());
    return c.json(
      await requireAi().weekPlan(actor(c), {
        goal: body.goal,
        channelIds: body.channelIds,
        weekStart: new Date(body.weekStart),
        ...(body.slots ? { slots: body.slots } : {}),
        ...(body.settings ? { settings: body.settings } : {}),
      }),
    );
  });

  const BestTimesQuery = z.object({
    channelId: z.string().uuid(),
    timezone: z.string().optional().openapi({ example: 'America/Sao_Paulo' }),
    limit: z.coerce.number().int().min(1).max(21).optional(),
  });

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/best-times',
    tags: ['ai'],
    security: AUTH_SECURITY,
    summary: 'Sugere horários de publicação para um canal',
    description:
      'Requer a feature `ai_best_time` (plano Pro). **Não usa modelo e não consome franquia**: ' +
      'é estatística sobre o histórico da própria organização mais uma linha de base por rede. ' +
      '`confidence` e `sampleSize` dizem o quanto a resposta vale — com pouco histórico, ' +
      '`fromBaseline` vem true e a confiança é baixa. Responde mesmo sem IA configurada.',
    request: { query: BestTimesQuery },
    responses: { 200: jsonResponse('horários sugeridos', BestTimes), ...erros },
  });
  app.get('/best-times', async (c) => {
    const q = BestTimesQuery.parse(c.req.query());
    return c.json(
      await ctn.bestTimes(
        { orgId: c.get('principal').orgId },
        {
          channelId: q.channelId,
          ...(q.timezone ? { timezone: q.timezone } : {}),
          ...(q.limit ? { limit: q.limit } : {}),
        },
      ),
    );
  });

  return app;
}
