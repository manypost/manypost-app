import { z } from '@hono/zod-openapi';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonResponse } from '../openapi';

/**
 * Resumo operacional da organização — a fonte da tela inicial (SPEC home-operational-overview).
 *
 * **Contagem, não documento.** A home abre a cada visita; um cliente que quisesse esses números a
 * partir de `/v1/publications` teria de paginar o feed inteiro. Aqui é agregação, e o payload é
 * pequeno o bastante para caber num cache curto.
 *
 * **Só o que a plataforma mede.** Nenhum número aqui vem de desempenho ou alcance —
 * `channel_metrics` está vazia porque ninguém escreve nela. Tudo sai do nosso próprio registro do
 * que foi pedido e do que foi entregue.
 */

const ChannelNeedingAction = z
  .object({
    channelId: z.string(),
    provider: z.string(),
    name: z.string().nullable(),
    status: z.string().openapi({
      description: 'REFRESH_REQUIRED | PENDING_ACCOUNT_SELECTION | DISABLED',
    }),
  })
  .openapi('ChannelNeedingAction');

const Summary = z
  .object({
    timezone: z.string().openapi({
      description: 'fuso em que as fronteiras de dia foram resolvidas — a resposta diz qual usou',
    }),
    attention: z.object({
      failed: z.number().int(),
      needsReview: z
        .number()
        .int()
        .openapi({ description: 'desfecho incerto: nunca retentado sozinho, espera decisão humana' }),
      awaitingApproval: z.number().int().openapi({ description: 'por GRUPO, não por publicação' }),
      partial: z.number().int().openapi({ description: 'saiu em algumas redes e não em outras' }),
      channels: z.array(ChannelNeedingAction),
      total: z.number().int().openapi({ description: '0 = a interface esconde o bloco inteiro' }),
    }),
    today: z.object({
      scheduled: z.number().int(),
      published: z.number().int(),
      failed: z.number().int(),
    }),
    week: z.object({
      scheduled: z.number().int(),
      byDay: z
        .array(z.number().int())
        .openapi({ description: '7 posições, índice 0 = hoje no fuso pedido' }),
    }),
    firstRun: z
      .enum(['no_channels', 'no_posts'])
      .nullable()
      .openapi({
        description:
          'organização sem o que operar. A interface troca os blocos operacionais por próximos ' +
          'passos em vez de mostrar uma grade de zeros. null = já está operando.',
      }),
  })
  .openapi('InsightsSummary');

/**
 * **Sem cache de servidor, de propósito.**
 *
 * A proposta previa 30s no Redis. Ao implementar, a troca virou ruim: este é o painel do "está
 * tudo bem?". Um cache de 30s faz uma falha nova ficar invisível por meia janela — e, pior, faz
 * uma falha já resolvida continuar aparecendo depois de a pessoa arrumar, o que ensina a não
 * confiar na tela. Invalidar corretamente exigiria acoplar publicação, retentativa, aprovação e
 * troca de status de canal a uma chave de cache: muito mecanismo para economizar três contagens
 * agregadas e indexadas.
 *
 * O freio de verdade está no cliente (`staleTime` do React Query), onde uma leitura velha é a
 * escolha explícita de quem está olhando a tela.
 */
export function insightsRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ authenticateHuman: ctn.auth.authenticateHuman }));

  const Query = z.object({
    tz: z
      .string()
      .optional()
      .openapi({ example: 'America/Sao_Paulo', description: 'IANA; inválido responde 400' }),
  });

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/summary',
    tags: ['insights'],
    security: AUTH_SECURITY,
    summary: 'Resumo operacional da organização (tela inicial)',
    description:
      'Contagens agregadas: o que precisa de atenção (falhas, revisão, aprovação, entrega ' +
      'parcial, canais a reconectar), o que sai hoje e a semana por dia. **Não traz métrica de ' +
      'desempenho** — a plataforma não coleta engajamento, então todo número aqui vem do ' +
      'registro do que ela mesma pediu e entregou. As fronteiras de dia são resolvidas no fuso ' +
      'informado em `tz`.',
    request: { query: Query },
    responses: { 200: jsonResponse('resumo', Summary), ...errorResponses(400, 401) },
  });
  app.get('/summary', async (c) => {
    const { tz } = Query.parse(c.req.query());
    return c.json(
      await ctn.insights({ orgId: c.get('principal').orgId }, tz ? { timezone: tz } : {}),
    );
  });

  return app;
}
