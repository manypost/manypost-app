/**
 * Sincroniza o catálogo de planos (packages/contracts/src/billing.ts) com a conta Stripe.
 *
 *   STRIPE_SECRET_KEY=sk_test_… bun run stripe:sync
 *
 * Idempotente: Products têm id determinístico (`manypost_pro`) e Prices são resolvidos pelo
 * `lookup_key`. Se o valor do catálogo mudar, um preço NOVO é criado e a lookup_key é
 * transferida — quem já assina continua no preço antigo (grandfathering), assinaturas novas
 * usam o atual. Rode contra a chave de TESTE primeiro; depois contra a de produção.
 */
import { BILLING_CURRENCY, BillingPeriods, PLANS, PlanTiers } from '@manypost/contracts';
import { makeStripeGateway } from '../apps/api/src/infra/billing/stripe.gateway';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Defina STRIPE_SECRET_KEY (sk_test_… ou sk_live_…) antes de rodar.');
  process.exit(1);
}

const mode = secretKey.startsWith('sk_live_') ? 'PRODUÇÃO (live)' : 'teste';
console.log(`Sincronizando catálogo do manypost com a Stripe — modo ${mode}\n`);

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const gateway = makeStripeGateway({ secretKey, webhookSecret: '' });
const synced = await gateway.syncCatalog();

for (const tier of PlanTiers) {
  const plan = PLANS[tier];
  const prices = BillingPeriods.filter((p) => plan.prices[p]);
  if (prices.length === 0) {
    console.log(`· ${plan.name} — sem cobrança (plano de entrada), nada a criar`);
    continue;
  }
  console.log(`· ${plan.name}`);
  for (const period of prices) {
    const def = plan.prices[period]!;
    const priceId = synced.find((s) => s.tier === tier && s.period === period)?.priceId;
    const label = period === 'MONTHLY' ? 'mensal' : 'anual ';
    console.log(
      `    ${label}  ${brl(def.amount).padStart(11)} ${BILLING_CURRENCY.toUpperCase()}  ${def.lookupKey}  → ${priceId}`,
    );
  }
}

console.log(`
Pronto. Próximo passo (uma vez por ambiente):
  1. Registre o webhook com a MESMA chave:
       bun run stripe:webhook https://app.exemplo.com     (produção)
       stripe listen --forward-to localhost:3100/v1/stripe/webhook   (dev)
  2. Copie o "Signing secret" (whsec_…) impresso para STRIPE_WEBHOOK_SECRET
  3. Suba a API com IS_SELF_HOSTED=false e HIDE_BILLING=false`);
