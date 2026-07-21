/**
 * Registra (ou confere) o endpoint de webhook da Stripe desta instalação.
 *
 *   STRIPE_SECRET_KEY=sk_live_… bun run stripe:webhook https://app.manypost.com.br
 *   STRIPE_SECRET_KEY=sk_test_… bun run stripe:webhook            # usa PUBLIC_URL do .env
 *
 * O ambiente (teste × produção) vem da própria chave — não há flag. Idempotente pela URL:
 * rodar de novo só reconcilia os eventos assinados. A Stripe revela o `whsec_` UMA vez, na
 * criação; `--recreate` gera outro (o anterior para de valer e as entregas passam a falhar
 * com 400 até o STRIPE_WEBHOOK_SECRET do ambiente ser atualizado).
 *
 * Em desenvolvimento não use este script — a Stripe não alcança `localhost`. Rode
 *   stripe listen --forward-to localhost:3100/v1/stripe/webhook
 * e ponha no .env o `whsec_` que a CLI imprime.
 */
import { makeStripeGateway } from '../apps/api/src/infra/billing/stripe.gateway';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Defina STRIPE_SECRET_KEY (sk_test_… ou sk_live_…) antes de rodar.');
  process.exit(1);
}

const args = process.argv.slice(2);
const recreate = args.includes('--recreate');
const base = args.find((a) => !a.startsWith('--')) ?? process.env.PUBLIC_URL;
if (!base) {
  console.error('Informe a URL pública: bun run stripe:webhook https://app.manypost.com.br');
  process.exit(1);
}

const url = `${base.replace(/\/+$/, '')}/v1/stripe/webhook`;
if (!url.startsWith('https://') || /localhost|127\.0\.0\.1/.test(url)) {
  console.error(
    `A Stripe só entrega em HTTPS público — "${url}" não serve.\n` +
      'Em dev: stripe listen --forward-to localhost:3100/v1/stripe/webhook',
  );
  process.exit(1);
}

const live = secretKey.startsWith('sk_live_');
console.log(`Webhook do manypost — modo ${live ? 'PRODUÇÃO (live)' : 'teste'}\n  ${url}\n`);

const gateway = makeStripeGateway({ secretKey, webhookSecret: '' });
const result = await gateway.ensureWebhookEndpoint({ url, recreate });

console.log(`· ${result.id} — ${result.outcome}`);
console.log(`· eventos: ${result.events.join(', ')}`);

if (result.secret) {
  console.log(`
STRIPE_WEBHOOK_SECRET=${result.secret}

Guarde agora — a Stripe não mostra este segredo de novo. No ambiente de destino:
  1. STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (acima) nas variáveis do serviço
  2. IS_SELF_HOSTED=false e HIDE_BILLING=false
  3. bun run stripe:sync com a MESMA chave (produtos e preços são por modo)`);
} else {
  console.log(`
O endpoint já existia, então o "Signing secret" não é revelado pela API. Se você não o tem:
  · Dashboard → Developers → Webhooks → ${result.id} → Reveal, ou
  · bun run stripe:webhook ${base} --recreate   (gera outro; o antigo para de valer)`);
}
