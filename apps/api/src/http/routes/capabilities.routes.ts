import { createRoute, z } from '@hono/zod-openapi';
import { machineEndpoints } from '@manypost/config';
import { BillingPeriods, PlanTiers, SubscriptionStatuses } from '@manypost/contracts';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonResponse } from '../openapi';

const Capabilities = z
  .object({
    /** false = self-hosted/Community: sem cobrança e sem limites (a UI esconde o billing) */
    billingEnabled: z.boolean(),
    /**
     * true = instalação self-hosted (`IS_SELF_HOSTED`): quem usa também opera o `.env`.
     * Não dá para deduzir de `billingEnabled` (o gerenciado sem Stripe também vem `false`),
     * e a UI precisa disso para explicar a conexão de cada rede no modo certo.
     */
    selfHosted: z.boolean(),
    plan: z.object({
      tier: z.enum(PlanTiers),
      status: z.enum(SubscriptionStatuses).nullable(),
      period: z.enum(BillingPeriods).nullable(),
      currentPeriodEnd: z.string().nullable(),
      cancelAt: z.string().nullable(),
      /** features liberadas — a UI usa isto para mostrar/ocultar e marcar "requer Pro" */
      features: z.array(z.string()),
      limits: z.object({
        channels: z.number().int().openapi({ description: '-1 = ilimitado' }),
        postsPerMonth: z.number().int(),
        webhooks: z.number().int(),
        apiKeys: z.number().int(),
      }),
      usage: z.object({
        channels: z.number().int(),
        postsThisMonth: z.number().int(),
        webhooks: z.number().int(),
        apiKeys: z.number().int(),
      }),
      enforced: z.boolean(),
    }),
    /**
     * IA desta instalação (SPEC_AI §5.2). `enabled: false` = nenhum provedor configurado:
     * a UI esconde a superfície inteira em vez de oferecer botão que responderia 404.
     */
    ai: z.object({
      enabled: z.boolean(),
      /** false = o modelo configurado não enxerga imagem; a UI some com o alt-text automático */
      canDescribeImages: z.boolean(),
      /** null quando não há IA — não há franquia a mostrar */
      credits: z
        .object({
          granted: z.number().int(),
          used: z.number().int(),
          reserved: z.number().int().openapi({ description: 'gerações em voo' }),
          remaining: z.number().int(),
          periodEnd: z.string(),
          enforced: z
            .boolean()
            .openapi({ description: 'false = self-hosted: contabiliza, mas nunca recusa' }),
        })
        .nullable(),
    }),
    /**
     * Onde uma máquina fala com esta instalação (SPEC_API_MCP §3/§5). Vem do servidor porque
     * depende de como ELA foi publicada (host dedicado `api.`/`mcp.` ou origem única).
     */
    endpoints: z.object({
      restBaseUrl: z.string().openapi({ example: 'https://api.manypost.com.br/v1' }),
      mcpUrl: z.string().openapi({ example: 'https://mcp.manypost.com.br' }),
    }),
  })
  .openapi('Capabilities');

/**
 * O que ESTA instalação libera para ESTA organização (SPEC_API_MCP §3 / PLANS.md §3).
 * Existe sempre — inclusive em self-hosted, onde responde tudo liberado com
 * `billingEnabled: false`. É a fonte que o apps/web usa para gatear a interface.
 */
export function capabilityRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({
    authenticateHuman: ctn.auth.authenticateHuman,
  }));

  app.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['capabilities'],
      security: AUTH_SECURITY,
      summary: 'Plano, features liberadas, limites e uso da organização',
      responses: {
        200: jsonResponse('capacidades da organização', Capabilities),
        ...errorResponses(401),
      },
    }),
    async (c) => {
      const orgId = c.get('principal').orgId;
      const plan = await ctn.plan.snapshot(orgId);
      // o saldo só é lido quando há IA: sem provedor não há franquia a mostrar, e abrir balde
      // de créditos numa instalação que nunca vai gerar nada seria escrita à toa
      const credits = ctn.ai ? await ctn.budget.balance(orgId) : null;
      return c.json(
        {
          billingEnabled: Boolean(ctn.billing),
          selfHosted: ctn.env.IS_SELF_HOSTED,
          plan: {
            ...plan,
            currentPeriodEnd: plan.currentPeriodEnd?.toISOString() ?? null,
            cancelAt: plan.cancelAt?.toISOString() ?? null,
          },
          ai: {
            enabled: Boolean(ctn.ai),
            canDescribeImages: ctn.ai?.canDescribeImages ?? false,
            credits: credits
              ? { ...credits, periodEnd: credits.periodEnd.toISOString() }
              : null,
          },
          endpoints: machineEndpoints(ctn.env),
        },
        200,
      );
    },
  );

  return app;
}
