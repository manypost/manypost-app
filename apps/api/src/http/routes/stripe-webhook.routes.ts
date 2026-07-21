import { createRoute, z } from '@hono/zod-openapi';
import type { Container } from '../../container';
import { STRIPE_SERVICE_TAG, toRemoteSubscription } from '../../infra/billing/stripe.gateway';
import { createApp, jsonResponse } from '../openapi';

/**
 * Webhook da Stripe — SEM autenticação de sessão: a prova é a assinatura HMAC do corpo CRU
 * (`stripe-signature`), validada com STRIPE_WEBHOOK_SECRET. Nunca ler o JSON já parseado.
 *
 * Eventos assinados no Dashboard: customer.subscription.created / .updated / .deleted.
 * Responder 2xx sempre que o evento for reconhecido (a Stripe reentrega em erro/timeout, e
 * reentrega é inofensiva: o upsert é idempotente).
 *
 * Derived from Postiz (AGPL-3.0): apps/backend/src/api/routes/stripe.controller.ts
 */
export function stripeWebhookRoutes(ctn: Container) {
  const app = createApp();
  const billing = ctn.billing;
  if (!billing) return app;

  app.openapi(
    createRoute({
      method: 'post',
      path: '/webhook',
      tags: ['billing'],
      summary: 'Webhook da Stripe (assinado por HMAC — não usa sessão)',
      request: {
        headers: z.object({ 'stripe-signature': z.string() }),
        body: { content: { 'application/json': { schema: z.object({}).passthrough() } } },
      },
      responses: {
        200: jsonResponse('evento processado', z.object({ ok: z.boolean() })),
        400: jsonResponse('assinatura HMAC inválida', z.object({ ok: z.boolean() })),
      },
    }),
    async (c) => {
      const signature = c.req.header('stripe-signature');
      if (!signature) return c.json({ ok: false }, 400);

      let event: ReturnType<typeof billing.constructEvent>;
      try {
        event = billing.constructEvent(await c.req.text(), signature);
      } catch (err) {
        console.warn(
          JSON.stringify({ level: 'warn', msg: 'stripe_signature_invalid', err: String(err) }),
        );
        return c.json({ ok: false }, 400);
      }

      const object = event.data.object as { metadata?: Record<string, string> };
      // objetos de outra integração na mesma conta Stripe não são nossos
      if (object.metadata?.service && object.metadata.service !== STRIPE_SERVICE_TAG) {
        return c.json({ ok: true }, 200);
      }

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const remote = toRemoteSubscription(event.data.object);
          if (!remote) return c.json({ ok: true }, 200); // assinatura de outro produto
          return c.json(await billing.applyRemote(remote), 200);
        }
        case 'customer.subscription.deleted': {
          const customer = event.data.object.customer;
          return c.json(
            await billing.removeRemote(typeof customer === 'string' ? customer : customer.id),
            200,
          );
        }
        default:
          return c.json({ ok: true }, 200);
      }
    },
  );

  return app;
}
