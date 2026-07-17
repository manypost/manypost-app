/**
 * E2E de auth contra a API real + Postgres real (rodado no CI e localmente).
 * Fluxo: register → me → refresh (rotação) → reuso detectado (família revogada)
 *        → login → API key (criar, usar, revogar).
 */
export {}; // torna o arquivo um módulo (top-level await)

const BASE = process.env.BASE_URL ?? 'http://localhost:3988';

let failures = 0;
function check(cond: unknown, msg: string) {
  if (cond) {
    console.log(`  ok: ${msg}`);
  } else {
    failures++;
    console.error(`  FALHOU: ${msg}`);
  }
}

const email = `e2e-${Date.now()}@test.dev`;
const password = 'senha-e2e-super-forte-123';

async function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// 1) register
const reg = await post('/v1/auth/register', { email, password, name: 'E2E User' });
check(reg.status === 201, `register → 201 (veio ${reg.status})`);
const regBody = (await reg.json()) as any;
check(regBody.org?.role === 'OWNER', 'registro cria org com papel OWNER');
check(typeof regBody.accessToken === 'string', 'access token emitido');

// 2) me com Bearer
const me = await fetch(`${BASE}/v1/auth/me`, {
  headers: { authorization: `Bearer ${regBody.accessToken}` },
});
check(me.status === 200, 'GET /me com Bearer → 200');
check(((await me.json()) as any).user?.email === email, '/me retorna o usuário');

// 3) refresh com rotação
const r1 = await post('/v1/auth/refresh', { refreshToken: regBody.refreshToken });
check(r1.status === 200, 'refresh → 200');
const r1Body = (await r1.json()) as any;
check(r1Body.refreshToken !== regBody.refreshToken, 'refresh token ROTACIONOU');

// 4) reuso do token antigo → 401 e mata a família
const reuse = await post('/v1/auth/refresh', { refreshToken: regBody.refreshToken });
check(reuse.status === 401, `reuso do token antigo → 401 (veio ${reuse.status})`);
const afterReuse = await post('/v1/auth/refresh', { refreshToken: r1Body.refreshToken });
check(afterReuse.status === 401, 'família inteira revogada: token novo também morre');

// 5) credencial errada → 401 genérico
const badLogin = await post('/v1/auth/login', { email, password: 'senha-errada-123' });
check(badLogin.status === 401, 'login com senha errada → 401');

// 6) login válido + API keys
const login = await post('/v1/auth/login', { email, password });
check(login.status === 200, 'login → 200');
const loginBody = (await login.json()) as any;
const bearer = { authorization: `Bearer ${loginBody.accessToken}` };

const created = await post('/v1/api-keys', { name: 'e2e', scopes: ['posts:write'] }, bearer);
check(created.status === 201, `criar API key → 201 (veio ${created.status})`);
const createdBody = (await created.json()) as any;
check(createdBody.apiKey?.startsWith('mp_live_'), 'API key com prefixo mp_live_');

const meWithKey = await fetch(`${BASE}/v1/auth/me`, {
  headers: { authorization: `Bearer ${createdBody.apiKey}` },
});
check(meWithKey.status === 200, '/me autenticado por API key → 200');
check(((await meWithKey.json()) as any).kind === 'api_key', 'principal é api_key');

const revoked = await fetch(`${BASE}/v1/api-keys/${createdBody.record.id}`, {
  method: 'DELETE',
  headers: bearer,
});
check(revoked.status === 204, 'revogar API key → 204');

const meAfterRevoke = await fetch(`${BASE}/v1/auth/me`, {
  headers: { authorization: `Bearer ${createdBody.apiKey}` },
});
check(meAfterRevoke.status === 401, 'API key revogada → 401');

// 7) sem credencial → 401
const anon = await fetch(`${BASE}/v1/api-keys`);
check(anon.status === 401, 'endpoint protegido sem credencial → 401');

// 8) login social: catálogo responde (vazio sem env) e provider não configurado → 404
const social = await fetch(`${BASE}/v1/auth/social`);
check(social.status === 200, 'GET /v1/auth/social → 200');
check(Array.isArray(((await social.json()) as any).providers), 'catálogo de provedores é lista');
const socialOff = await fetch(`${BASE}/v1/auth/social/google`, { redirect: 'manual' });
check(
  socialOff.status === 404 || socialOff.status === 302,
  `provider google → 302 (configurado) ou 404 (não configurado) — veio ${socialOff.status}`,
);

// 9) catálogo de providers de rede: só os disponíveis (env presente) aparecem
const providers = (await (
  await fetch(`${BASE}/v1/channels/providers`, { headers: bearer })
).json()) as any[];
const ids = providers.map((p) => p.id);
check(ids.includes('bluesky'), 'bluesky sempre disponível (não precisa de env)');
check(ids.includes('mastodon'), 'mastodon sempre disponível');
const bsky = providers.find((p) => p.id === 'bluesky');
check(bsky?.connectType === 'fields', 'bluesky conecta por campos (app password)');
// settingsSchema = JSON Schema dos settings de publicação (formulário "Configurações" do composer)
check(
  bsky?.settingsSchema?.type === 'object' && bsky?.settingsSchema?.properties?.langs !== undefined,
  'catálogo expõe settingsSchema como JSON Schema (bluesky.langs presente)',
);
// connectionFieldsSchema = JSON Schema dos campos do connect (formulário de conexão da UI)
check(
  bsky?.connectionFieldsSchema?.properties?.handle !== undefined &&
    (bsky?.connectionFieldsSchema?.required ?? []).includes('handle'),
  'catálogo expõe connectionFieldsSchema (bluesky.handle obrigatório)',
);
const masto = providers.find((p) => p.id === 'mastodon');
check(
  masto?.connectionFieldsSchema?.properties?.instance !== undefined &&
    !(masto?.connectionFieldsSchema?.required ?? []).includes('instance'),
  'mastodon (OAuth 2 etapas) expõe instance como campo de conexão opcional',
);
// discord conecta por URL de webhook (sem env no servidor) → sempre disponível, por campos
check(ids.includes('discord'), 'discord sempre disponível (webhook, não precisa de env)');
check(
  providers.find((p) => p.id === 'discord')?.connectType === 'fields',
  'discord conecta por campos (URL do webhook)',
);
// telegram só aparece com TELEGRAM_BOT_TOKEN; sem env → some do catálogo e connect dá 404
if (ids.includes('telegram')) {
  check(providers.find((p) => p.id === 'telegram')?.connectType === 'fields', 'telegram conecta por campos');
} else {
  const off = await post('/v1/channels/connect', { provider: 'telegram' }, bearer);
  check(off.status === 404, 'provider sem env → connect 404 (capability.disabled)');
}
// linkedin/x (OAuth, credenciais de app no env) seguem a mesma regra do telegram
for (const oauthId of ['linkedin', 'x']) {
  if (ids.includes(oauthId)) {
    const entry = providers.find((p) => p.id === oauthId);
    check(entry?.connectType === 'oauth', `${oauthId} conecta por OAuth`);
    // OAuth puro (sem instância/credencial) → connect direto, sem formulário
    check(
      entry?.connectionFieldsSchema === undefined,
      `${oauthId} não expõe connectionFieldsSchema (OAuth sem campos)`,
    );
  } else {
    const off = await post('/v1/channels/connect', { provider: oauthId }, bearer);
    check(off.status === 404, `${oauthId} sem env → connect 404 (capability.disabled)`);
  }
}

if (failures > 0) {
  console.error(`\nE2E auth: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\nE2E auth: TUDO OK');
