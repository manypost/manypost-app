export {}; // módulo (top-level await)

/**
 * E2E dos limites de plano no serviço gerenciado (PLANS.md §3 / SPEC_BACKEND §5).
 *
 * Requer a API subida em modo GERENCIADO, com uma chave Stripe qualquer (nenhum teste aqui
 * chama a Stripe — o enforcement é 100% local):
 *   IS_SELF_HOSTED=false HIDE_BILLING=false STRIPE_SECRET_KEY=sk_test_e2e ... bun run apps/api/src/main.ts
 *
 * Prova o contrato do plano Grátis: 3 redes, 15 posts/mês, sem X, sem API keys, sem webhooks,
 * sem link de aprovação — tudo com 402 e `extra.requiredTier`.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3988';

let failures = 0;
function check(cond: unknown, msg: string) {
  if (cond) console.log(`  ok: ${msg}`);
  else {
    failures++;
    console.error(`  FALHOU: ${msg}`);
  }
}

const email = `billing-${Date.now()}@test.dev`;
const reg = await fetch(`${BASE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'senha-e2e-super-forte-123', name: 'Billing E2E' }),
});
const { accessToken } = (await reg.json()) as any;
const auth = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
const future = () => new Date(Date.now() + 3_600_000).toISOString();

/** conecta um canal fake novo (externalId distinto por chamada) */
async function connectFake(seed: string) {
  const res = await fetch(`${BASE}/v1/channels/connect`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ provider: 'fake' }),
  });
  if (res.status !== 200) return res;
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
  const { url } = (await res.json()) as any;
  const q = new URL(url).searchParams;
  // sufixo no code = conta distinta no provider fake (ver fake.provider.ts)
  return fetch(`${BASE}/v1/channels/callback/fake?code=fake-code-${seed}&state=${q.get('state')}`, {
    headers: { ...auth, cookie },
  });
}

console.log('\n== capabilities ==');
const caps = (await (await fetch(`${BASE}/v1/capabilities`, { headers: auth })).json()) as any;
check(caps.billingEnabled === true, 'billingEnabled = true no modo gerenciado');
check(caps.plan.tier === 'FREE', 'conta nova nasce no plano Grátis');
check(caps.plan.enforced === true, 'plano é imposto (enforced)');
check(caps.plan.limits.channels === 3, 'limite de 3 redes no Grátis');
check(caps.plan.limits.postsPerMonth === 15, 'limite de 15 posts/mês no Grátis');
check(caps.plan.features.length === 0, 'Grátis não libera nenhuma feature paga');

console.log('\n== catálogo de planos ==');
const plans = (await (await fetch(`${BASE}/v1/billing/plans`, { headers: auth })).json()) as any;
const pro = plans.plans.find((p: any) => p.tier === 'PRO');
const premium = plans.plans.find((p: any) => p.tier === 'PREMIUM');
check(pro?.prices.MONTHLY === 2990, 'Pro mensal = R$ 29,90');
check(pro?.prices.YEARLY === 28680, 'Pro anual = R$ 286,80');
check(premium?.prices.MONTHLY === 6690, 'Premium mensal = R$ 66,90');
check(premium?.prices.YEARLY === 63480, 'Premium anual = R$ 634,80');
check(plans.trialDays === 0, 'sem teste grátis por padrão');

console.log('\n== rede paga (X) fora do Grátis ==');
const xRes = await fetch(`${BASE}/v1/channels/connect`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ provider: 'x' }),
});
const xBody = (await xRes.json()) as any;
check(xRes.status === 402 || xRes.status === 404, 'connect do X barrado (402) ou provider sem env (404)');
if (xRes.status === 402) {
  check(xBody.title === 'plan.feature_locked', 'code plan.feature_locked');
  check(xBody.extra?.requiredTier === 'PRO', 'requiredTier = PRO');
}

console.log('\n== teto de 3 canais ==');
for (const seed of ['a', 'b', 'c']) {
  const res = await connectFake(seed);
  check(res.status === 200, `canal fake ${seed} conectado`);
}
const fourth = await connectFake('d');
const fourthBody = (await fourth.json().catch(() => ({}))) as any;
check(fourth.status === 402, '4º canal barrado com 402');
check(fourthBody.title === 'plan.channel_limit', 'code plan.channel_limit');
check(fourthBody.extra?.limit === 3 && fourthBody.extra?.used === 3, 'detail traz limite e uso');

console.log('\n== API keys e webhooks são do Pro ==');
const keyRes = await fetch(`${BASE}/v1/api-keys`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: 'e2e', scopes: ['posts:read'] }),
});
const keyBody = (await keyRes.json()) as any;
check(keyRes.status === 402, 'criar API key barrado no Grátis');
check(keyBody.extra?.feature === 'public_api', 'feature public_api no detail');

const hookRes = await fetch(`${BASE}/v1/webhooks`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: 'e2e', url: 'https://example.com/hook', events: ['post.published'] }),
});
check(hookRes.status === 402, 'criar webhook barrado no Grátis');

console.log('\n== 15 posts por mês ==');
const channels = (await (await fetch(`${BASE}/v1/channels`, { headers: auth })).json()) as any[];
const channelIds = [channels[0].id];
let created = 0;
let denied: any = null;
for (let i = 0; i < 16; i++) {
  const res = await fetch(`${BASE}/v1/posts`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ text: `post ${i}`, channelIds, publishAt: future() }),
  });
  if (res.status === 201) created++;
  else {
    denied = { status: res.status, body: await res.json() };
    break;
  }
}
check(created === 15, `15 posts criados (criou ${created})`);
check(denied?.status === 402, '16º post barrado com 402');
check(denied?.body?.title === 'plan.posts_limit', 'code plan.posts_limit');

console.log('\n== link de aprovação é do Pro ==');
const draft = await fetch(`${BASE}/v1/posts`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    text: 'rascunho',
    channelIds,
    publishAt: future(),
    requireApproval: true,
  }),
});
// o rascunho em si também consome cota — se barrou, o teste do link não se aplica
if (draft.status === 201) {
  const { groupId } = (await draft.json()) as any;
  const link = await fetch(`${BASE}/v1/posts/${groupId}/approval-link`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({}),
  });
  check(link.status === 402, 'criar link de aprovação barrado no Grátis');
} else {
  check(draft.status === 402, 'rascunho também respeita a cota mensal');
}

console.log('\n== uso reportado em /v1/capabilities ==');
const caps2 = (await (await fetch(`${BASE}/v1/capabilities`, { headers: auth })).json()) as any;
check(caps2.plan.usage.channels === 3, 'uso de canais = 3');
check(caps2.plan.usage.postsThisMonth >= 15, 'uso de posts do mês >= 15');

// ---------------------------------------------------------------------------
// Fase 2 (opcional): o OUTRO lado da fronteira. Suba uma segunda API em modo
// Community — IS_SELF_HOSTED=true, sem STRIPE_SECRET_KEY — e aponte:
//   SELF_HOSTED_BASE_URL=http://localhost:3986 bun run scripts/e2e-billing.ts
// Nada pode ser barrado lá, e as rotas de cobrança não devem nem existir.
const SELF_HOSTED = process.env.SELF_HOSTED_BASE_URL;
if (SELF_HOSTED) {
  console.log('\n== self-hosted: nada é cobrado nem barrado ==');
  const email2 = `selfhost-${Date.now()}@test.dev`;
  const reg2 = await fetch(`${SELF_HOSTED}/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: email2, password: 'senha-e2e-super-forte-123', name: 'Community' }),
  });
  const auth2 = {
    authorization: `Bearer ${((await reg2.json()) as any).accessToken}`,
    'content-type': 'application/json',
  };

  const caps3 = (await (await fetch(`${SELF_HOSTED}/v1/capabilities`, { headers: auth2 })).json()) as any;
  check(caps3.billingEnabled === false, 'billingEnabled = false');
  check(caps3.plan.enforced === false, 'plano não é imposto');
  check(caps3.plan.limits.channels === -1, 'canais ilimitados');

  const billing404 = await fetch(`${SELF_HOSTED}/v1/billing`, { headers: auth2 });
  check(billing404.status === 404, 'GET /v1/billing não existe (404)');
  const webhook404 = await fetch(`${SELF_HOSTED}/v1/stripe/webhook`, { method: 'POST', headers: auth2 });
  check(webhook404.status === 404, 'webhook da Stripe não existe (404)');

  const key2 = await fetch(`${SELF_HOSTED}/v1/api-keys`, {
    method: 'POST',
    headers: auth2,
    body: JSON.stringify({ name: 'community', scopes: ['posts:read'] }),
  });
  check(key2.status === 201, 'API key liberada no self-hosted');
}

console.log(failures === 0 ? '\nTUDO OK' : `\n${failures} CHECK(S) FALHARAM`);
process.exit(failures === 0 ? 0 : 1);
