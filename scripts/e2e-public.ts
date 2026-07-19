export {}; // módulo (top-level await)

/**
 * E2E da API pública /public/v1 (SPEC_API_MCP §3/§7): escopos por API key, rate-limit por
 * credencial e Idempotency-Key. Requer API em MODE=all COM Redis (sem Redis o rate-limit e a
 * idempotência falham abertos — os checks de 429/replay/conflito não teriam o que provar).
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

// ---- setup: conta (OWNER) + canal fake conectado ----
const email = `public-${Date.now()}@test.dev`;
const reg = await fetch(`${BASE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'senha-e2e-super-forte-123', name: 'Public API' }),
});
const { accessToken } = (await reg.json()) as any;
const auth = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };

const connect = await fetch(`${BASE}/v1/channels/connect`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ provider: 'fake' }),
});
const stateCookie = connect.headers.get('set-cookie')?.split(';')[0] ?? '';
const { url } = (await connect.json()) as any;
const cbq = new URL(url).searchParams;
await fetch(`${BASE}/v1/channels/callback/fake?code=${cbq.get('code')}&state=${cbq.get('state')}`, {
  headers: { ...auth, cookie: stateCookie },
});
const channels0 = (await (await fetch(`${BASE}/v1/channels`, { headers: auth })).json()) as any[];
const channel = channels0[0];
check(channel?.provider === 'fake', 'setup: canal fake conectado');

// ---- helpers ----
async function createKey(name: string, scopes: string[]) {
  const res = await fetch(`${BASE}/v1/api-keys`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name, scopes }),
  });
  return ((await res.json()) as any).apiKey as string;
}
const H = (key: string, extra: Record<string, string> = {}) => ({
  authorization: `Bearer ${key}`,
  'content-type': 'application/json',
  ...extra,
});
const future = () => new Date(Date.now() + 3_600_000).toISOString();

const postsKey = await createKey('e2e-posts', ['posts:write', 'posts:read']);
const chKey = await createKey('e2e-channels', ['channels:read']);
check(postsKey.startsWith('mp_live_'), 'API key criada no formato mp_live_');

// ---- 1) escopos: chave sem channels:read é barrada; com o escopo, passa ----
const noScope = await fetch(`${BASE}/public/v1/channels`, { headers: H(postsKey) });
check(noScope.status === 403, `GET /public/v1/channels sem escopo → 403 (veio ${noScope.status})`);
check(((await noScope.json()) as any).title === 'common.forbidden', '403 com title common.forbidden');

const withScope = await fetch(`${BASE}/public/v1/channels`, { headers: H(chKey) });
check(withScope.status === 200, `GET /public/v1/channels com channels:read → 200 (veio ${withScope.status})`);
const chList = (await withScope.json()) as any[];
check(chList.some((x) => x.id === channel.id), 'lista o canal fake');
check(chList.every((x) => x.token === undefined && x.tokenEnc === undefined), 'tokens NUNCA aparecem');

// chave revogada → 401
const throwaway = await createKey('e2e-revoke', ['posts:read']);
// descobrir o id da chave recém-criada p/ revogar
const keys = (await (await fetch(`${BASE}/v1/api-keys`, { headers: auth })).json()) as any[];
const throwawayId = keys.find((k) => k.name === 'e2e-revoke')?.id;
await fetch(`${BASE}/v1/api-keys/${throwawayId}`, { method: 'DELETE', headers: auth });
const revoked = await fetch(`${BASE}/public/v1/publications`, { headers: H(throwaway) });
check(revoked.status === 401, `chave revogada → 401 (veio ${revoked.status})`);

// ---- 2) posts pela API pública: cria (origin=API), lê detalhe e feed ----
const created = await fetch(`${BASE}/public/v1/posts`, {
  method: 'POST',
  headers: H(postsKey),
  body: JSON.stringify({ text: 'via API pública', channelIds: [channel.id], publishAt: future() }),
});
check(created.status === 201, `POST /public/v1/posts → 201 (veio ${created.status})`);
const group = (await created.json()) as any;
check(group.state === 'SCHEDULED', 'grupo nasce SCHEDULED');

const detail = await fetch(`${BASE}/public/v1/posts/${group.id}`, { headers: H(postsKey) });
check(detail.status === 200, 'GET /public/v1/posts/{id} → 200');

const feed = (await (await fetch(`${BASE}/public/v1/publications`, { headers: H(postsKey) })).json()) as any;
const feedItem = feed.items?.find((it: any) => it.groupId === group.id);
check(!!feedItem, 'a publicação aparece no feed público');
check(feedItem?.group.origin === 'API', `origin = API (veio ${feedItem?.group.origin})`);

// cancelar via DELETE (contrato REST público)
const cancel = await fetch(`${BASE}/public/v1/posts/${group.id}`, { method: 'DELETE', headers: H(postsKey) });
check(cancel.status === 200 && ((await cancel.json()) as any).state === 'CANCELLED', 'DELETE /public/v1/posts/{id} cancela');

// ---- 3) Idempotency-Key: replay não duplica; corpo diferente = conflito ----
const idemKey = `idem-${Date.now()}`;
const idemBody = JSON.stringify({ text: 'post idempotente', channelIds: [channel.id], publishAt: future() });
const r1 = await fetch(`${BASE}/public/v1/posts`, { method: 'POST', headers: H(postsKey, { 'idempotency-key': idemKey }), body: idemBody });
check(r1.status === 201, `1º POST com Idempotency-Key → 201 (veio ${r1.status})`);
const g1 = (await r1.json()) as any;

const r2 = await fetch(`${BASE}/public/v1/posts`, { method: 'POST', headers: H(postsKey, { 'idempotency-key': idemKey }), body: idemBody });
check(r2.status === 201, 'replay mantém o status original (201)');
check(r2.headers.get('idempotency-replayed') === 'true', 'header Idempotency-Replayed: true');
const g2 = (await r2.json()) as any;
check(g2.id === g1.id, 'replay devolve o MESMO grupo — não duplicou o post');

const r3 = await fetch(`${BASE}/public/v1/posts`, {
  method: 'POST',
  headers: H(postsKey, { 'idempotency-key': idemKey }),
  body: JSON.stringify({ text: 'CORPO DIFERENTE', channelIds: [channel.id], publishAt: future() }),
});
check(r3.status === 409, `mesma chave + corpo diferente → 409 (veio ${r3.status})`);
check(((await r3.json()) as any).title === 'common.idempotency_conflict', '409 com title common.idempotency_conflict');

// limpa os grupos idempotentes criados
await fetch(`${BASE}/public/v1/posts/${g1.id}`, { method: 'DELETE', headers: H(postsKey) });

// ---- 4) rate-limit por credencial: 429 + headers após o teto (chave dedicada) ----
const rlKey = await createKey('e2e-ratelimit', ['channels:read']);
let got429 = false;
let retryAfter: string | null = null;
let limitHeader: string | null = null;
for (let i = 0; i < 65; i++) {
  const res = await fetch(`${BASE}/public/v1/channels/providers`, { headers: H(rlKey) });
  limitHeader = res.headers.get('ratelimit-limit');
  if (res.status === 429) {
    got429 = true;
    retryAfter = res.headers.get('retry-after');
    check(((await res.json()) as any).title === 'rate.limited', '429 com title rate.limited');
    break;
  }
  await res.body?.cancel();
}
check(got429, 'rate-limit dispara 429 depois do teto de 60/min');
check(limitHeader === '60', `header RateLimit-Limit = 60 (veio ${limitHeader})`);
check(retryAfter !== null && Number(retryAfter) > 0, `Retry-After presente e > 0 (veio ${retryAfter})`);

console.log(failures ? `\n❌ ${failures} FALHA(S)` : '\n✅ TUDO OK (API pública /public/v1)');
if (failures) process.exit(1);
