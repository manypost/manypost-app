import { createRoute, z } from '@hono/zod-openapi';
import {
  BILLING_CURRENCY,
  BillingPeriods,
  ErrorCodes,
  PLANS,
  PlanTiers,
  SubscriptionStatuses,
} from '@manypost/contracts';
import { DomainError } from '@manypost/core';
import type { Container } from '../../container';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonResponse } from '../openapi';

const SubscribeBody = z.object({
  tier: z.enum(['PRO', 'PREMIUM']),
  period: z.enum(BillingPeriods),
});

const PlanCatalog = z
  .object({
    currency: z.string(),
    /** dias de teste grátis (0 = sem trial) */
    trialDays: z.number().int(),
    plans: z.array(
      z.object({
        tier: z.enum(PlanTiers),
        name: z.string(),
        limits: z.object({
          channels: z.number().int(),
          postsPerMonth: z.number().int(),
          webhooks: z.number().int(),
          apiKeys: z.number().int(),
        }),
        features: z.array(z.string()),
        prices: z.object({
          MONTHLY: z.number().int().nullable(),
          YEARLY: z.number().int().nullable(),
        }),
      }),
    ),
  })
  .openapi('PlanCatalog');

const BillingState = z
  .object({
    plan: z.object({
      tier: z.enum(PlanTiers),
      status: z.enum(SubscriptionStatuses).nullable(),
      period: z.enum(BillingPeriods).nullable(),
      currentPeriodEnd: z.string().nullable(),
      cancelAt: z.string().nullable(),
      limits: z.object({
        channels: z.number().int(),
        postsPerMonth: z.number().int(),
        webhooks: z.number().int(),
        apiKeys: z.number().int(),
      }),
      features: z.array(z.string()),
      usage: z.object({
        channels: z.number().int(),
        postsThisMonth: z.number().int(),
        webhooks: z.number().int(),
        apiKeys: z.number().int(),
      }),
      enforced: z.boolean(),
    }),
    subscription: z
      .object({
        tier: z.enum(PlanTiers),
        period: z.enum(BillingPeriods).nullable(),
        status: z.enum(SubscriptionStatuses),
        currentPeriodEnd: z.string().nullable(),
        cancelAt: z.string().nullable(),
        identifier: z.string().nullable(),
      })
      .nullable(),
  })
  .openapi('BillingState');

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

/** Cobrança é ação de gente logada: API key não assina nem cancela plano. */
const userOf = (principal: { kind: string; orgId: string; userId?: string }) => {
  if (principal.kind !== 'user' || !principal.userId) {
    throw new DomainError(ErrorCodes.Forbidden, 'cobrança exige sessão de usuário');
  }
  return { orgId: principal.orgId, userId: principal.userId };
};

/**
 * Cobrança do serviço gerenciado (SPEC_BACKEND §5 / PLANS.md). Só é montada quando
 * `isBillingEnabled(env)` — em self-hosted estas rotas simplesmente não existem.
 *
 * Derived from Postiz (AGPL-3.0): apps/backend/src/api/routes/billing.controller.ts
 */
export function billingRoutes(ctn: Container) {
  const app = createApp();
  const billing = ctn.billing;
  if (!billing) return app; // defesa: nunca montada sem billing

  // catálogo é público para quem está logado (a tela de planos precisa dele)
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.openapi(
    createRoute({
      method: 'get',
      path: '/plans',
      tags: ['billing'],
      security: AUTH_SECURITY,
      summary: 'Catálogo de planos, preços (centavos) e limites',
      responses: { 200: jsonResponse('catálogo', PlanCatalog), ...errorResponses(401) },
    }),
    (c) =>
      c.json(
        {
          currency: BILLING_CURRENCY,
          trialDays: ctn.env.BILLING_TRIAL_DAYS,
          plans: PlanTiers.map((tier) => ({
            tier,
            name: PLANS[tier].name,
            limits: PLANS[tier].limits,
            features: [...PLANS[tier].features] as string[],
            prices: {
              MONTHLY: PLANS[tier].prices.MONTHLY?.amount ?? null,
              YEARLY: PLANS[tier].prices.YEARLY?.amount ?? null,
            },
          })),
        },
        200,
      ),
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['billing'],
      security: AUTH_SECURITY,
      summary: 'Plano efetivo, uso do período e assinatura da marca',
      responses: { 200: jsonResponse('estado de cobrança', BillingState), ...errorResponses(401) },
    }),
    async (c) => {
      const { plan, subscription } = await billing.get(c.get('principal').orgId);
      return c.json(
        {
          plan: {
            ...plan,
            currentPeriodEnd: iso(plan.currentPeriodEnd),
            cancelAt: iso(plan.cancelAt),
          },
          subscription: subscription && {
            ...subscription,
            currentPeriodEnd: iso(subscription.currentPeriodEnd),
            cancelAt: iso(subscription.cancelAt),
          },
        },
        200,
      );
    },
  );

  // a partir daqui, só ADMIN/OWNER (billing é do dono da marca — SPEC_API_MCP §6)
  app.use('/checkout', requireAdmin());
  app.use('/preview', requireAdmin());
  app.use('/portal', requireAdmin());
  app.use('/cancel', requireAdmin());
  app.use('/sync', requireAdmin());

  app.openapi(
    createRoute({
      method: 'post',
      path: '/checkout',
      tags: ['billing'],
      security: AUTH_SECURITY,
      summary: 'Assina um plano (Checkout) ou troca o plano de quem já assina (proration)',
      request: { body: { content: { 'application/json': { schema: SubscribeBody } } } },
      responses: {
        200: jsonResponse(
          'url = Checkout hospedado; changed = trocou direto; portalUrl = pagamento precisa de ação',
          z.object({
            url: z.string().optional(),
            portalUrl: z.string().optional(),
            changed: z.boolean().optional(),
            identifier: z.string(),
          }),
        ),
        ...errorResponses(400, 401, 403),
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      return c.json(
        await billing.checkout({
          ...userOf(c.get('principal')),
          tier: body.tier,
          period: body.period,
        }),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/preview',
      tags: ['billing'],
      security: AUTH_SECURITY,
      summary: 'Quanto sai agora ao trocar de plano (proration, em centavos)',
      request: { body: { content: { 'application/json': { schema: SubscribeBody } } } },
      responses: {
        200: jsonResponse('valor a pagar agora', z.object({ amount: z.number().int() })),
        ...errorResponses(400, 401, 403),
      },
    }),
    async (c) => {
      const body = c.req.valid('json');
      return c.json(
        await billing.preview({
          orgId: c.get('principal').orgId,
          tier: body.tier,
          period: body.period,
        }),
        200,
      );
    },
  );

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/portal',
    tags: ['billing'],
    security: AUTH_SECURITY,
    summary: 'Link do portal da Stripe (cartão, faturas, dados fiscais)',
    responses: {
      200: jsonResponse('portal', z.object({ url: z.string() })),
      ...errorResponses(401, 403),
    },
  });
  app.get('/portal', async (c) => c.json(await billing.portal(userOf(c.get('principal'))), 200));

  app.openapi(
    createRoute({
      method: 'post',
      path: '/cancel',
      tags: ['billing'],
      security: AUTH_SECURITY,
      summary: 'Cancela ao fim do período (chamar de novo reativa)',
      request: {
        body: {
          required: false,
          content: {
            'application/json': { schema: z.object({ feedback: z.string().max(2000).optional() }) },
          },
        },
      },
      responses: {
        200: jsonResponse(
          'cancelAt = quando perde o acesso; canceledImmediately = encerrou na hora (pagamento em atraso)',
          z.object({
            cancelAt: z.string().nullable(),
            canceledImmediately: z.boolean(),
          }),
        ),
        ...errorResponses(401, 403, 404),
      },
    }),
    async (c) => {
      const body = c.req.valid('json') ?? {};
      const out = await billing.cancel({
        ...userOf(c.get('principal')),
        ...(body.feedback ? { feedback: body.feedback } : {}),
      });
      return c.json({ cancelAt: iso(out.cancelAt), canceledImmediately: out.canceledImmediately }, 200);
    },
  );

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/invoices',
    tags: ['billing'],
    security: AUTH_SECURITY,
    summary: 'Faturas pagas da marca (link e PDF hospedados pela Stripe)',
    responses: {
      200: jsonResponse(
        'faturas',
        z.array(
          z.object({
            id: z.string(),
            amountPaid: z.number().int(),
            currency: z.string(),
            status: z.string(),
            createdAt: z.string(),
            invoiceUrl: z.string().nullable(),
            pdfUrl: z.string().nullable(),
          }),
        ),
      ),
      ...errorResponses(401),
    },
  });
  app.get('/invoices', async (c) => {
    const list = await billing.invoices(c.get('principal').orgId);
    return c.json(
      list.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
      200,
    );
  });

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/sync',
    tags: ['billing'],
    security: AUTH_SECURITY,
    summary: 'Reconcilia a assinatura com a Stripe (volta do checkout, sem esperar o webhook)',
    responses: {
      200: jsonResponse('resultado', z.object({ ok: z.boolean() })),
      ...errorResponses(401, 403),
    },
  });
  app.post('/sync', async (c) => c.json(await billing.sync(c.get('principal').orgId), 200));

  return app;
}
