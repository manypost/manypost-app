/**
 * E2E de auth contra a API real + Postgres real (rodado no CI e localmente).
 * Fluxo: register → me → refresh (rotação) → reuso detectado (família revogada)
 *        → login → API key (criar, usar na superfície de máquina, revogar).
 */
export {}; // torna o arquivo um módulo (top-level await)

const BASE = process.env.BASE_URL ?? 'http://localhost:3988';
/** superfície de máquina: host dedicado (`https://api.dominio/v1`) ou o caminho da origem */
const API = process.env.API_BASE_URL ?? `${BASE}/public/v1`;

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

const created = await post(
  '/v1/api-keys',
  { name: 'e2e', scopes: ['posts:write', 'channels:read'] },
  bearer,
);
check(created.status === 201, `criar API key → 201 (veio ${created.status})`);
const createdBody = (await created.json()) as any;
check(createdBody.apiKey?.startsWith('mp_live_'), 'API key com prefixo mp_live_');
const keyAuth = { authorization: `Bearer ${createdBody.apiKey}` };

// A API key é credencial de MÁQUINA (SPEC_API_MCP §3): a superfície interna /v1 — que é da
// interface e é regida por PAPEL — a recusa e aponta a porta certa. Sem isso, ela driblaria
// escopo, gate de plano e rate-limit por credencial entrando pela porta do web.
const meWithKey = await fetch(`${BASE}/v1/auth/me`, { headers: keyAuth });
check(meWithKey.status === 403, `API key no /v1 interno → 403 (veio ${meWithKey.status})`);
const meWithKeyBody = (await meWithKey.json()) as any;
check(meWithKeyBody.title === 'common.forbidden', '403 com title common.forbidden');
check(
  typeof meWithKeyBody.extra?.machineApiUrl === 'string',
  `a recusa aponta a superfície de máquina (veio ${meWithKeyBody.extra?.machineApiUrl})`,
);

// ...e a MESMA chave funciona na superfície de máquina
const keyOnMachine = await fetch(`${API}/channels`, { headers: keyAuth });
check(keyOnMachine.status === 200, `API key em ${API}/channels → 200 (veio ${keyOnMachine.status})`);

const revoked = await fetch(`${BASE}/v1/api-keys/${createdBody.record.id}`, {
  method: 'DELETE',
  headers: bearer,
});
check(revoked.status === 204, 'revogar API key → 204');

const afterRevoke = await fetch(`${API}/channels`, { headers: keyAuth });
check(afterRevoke.status === 401, `API key revogada → 401 (veio ${afterRevoke.status})`);

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

// 9) catálogo de providers de rede: lista TODA rede implementada, com `available` dizendo
// quem tem credencial de app aqui (e `setupEnv`, no self-hosted, dizendo o que falta)
const providers = (await (
  await fetch(`${BASE}/v1/channels/providers`, { headers: bearer })
).json()) as any[];
/** ids CONECTÁVEIS — é o que a tela de Conexões oferece; o resto vira "precisa de credencial" */
const ids = providers.filter((p) => p.available).map((p) => p.id);
check(
  providers.every((p) => typeof p.available === 'boolean'),
  'catálogo marca disponibilidade em vez de esconder a rede',
);
{
  // rede implementada e sem credencial não some mais: aparece com available:false + a dica de env
  const off = providers.filter((p) => !p.available);
  check(
    off.every((p) => Array.isArray(p.setupEnv) && p.setupEnv.length > 0),
    `indisponível traz setupEnv com a variável que falta (${off.map((p) => `${p.id}:${(p.setupEnv ?? []).join('/')}`).join(', ') || 'nenhuma indisponível'})`,
  );
}
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
// discord-webhook conecta por URL de webhook (sem env no servidor) → sempre disponível, por campos
check(ids.includes('discord-webhook'), 'discord-webhook sempre disponível (webhook, não precisa de env)');
check(
  providers.find((p) => p.id === 'discord-webhook')?.connectType === 'fields',
  'discord-webhook conecta por campos (URL do webhook)',
);
check(
  providers.find((p) => p.id === 'discord-webhook')?.connectionFieldsSchema?.properties?.webhookUrl !== undefined,
  'discord-webhook expõe connectionFieldsSchema (webhookUrl)',
);
// telegram só fica conectável com TELEGRAM_BOT_TOKEN; sem env → available:false e connect 404
if (ids.includes('telegram')) {
  check(providers.find((p) => p.id === 'telegram')?.connectType === 'fields', 'telegram conecta por campos');
} else {
  const off = await post('/v1/channels/connect', { provider: 'telegram' }, bearer);
  check(off.status === 404, 'provider sem env → connect 404 (capability.disabled)');
}
// discord (OAuth2+Bot), linkedin, x, tiktok, threads, twitch e kick (credenciais de app no env)
// seguem a mesma regra do telegram
for (const oauthId of [
  'discord',
  'linkedin',
  'x',
  'tiktok',
  'threads',
  'instagram-standalone',
  'twitch',
  'kick',
]) {
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

// tiktok disponível → connect devolve a URL de consentimento real do TikTok (client_key + PKCE S256)
if (ids.includes('tiktok')) {
  const entry = providers.find((p) => p.id === 'tiktok');
  check(entry?.threads === false && entry?.editor === 'plain', 'tiktok: sem thread, editor plano');
  check(
    entry?.settingsSchema?.properties?.privacyLevel !== undefined &&
      entry?.settingsSchema?.properties?.contentPostingMethod !== undefined,
    'tiktok expõe settingsSchema de compliance (privacyLevel/contentPostingMethod)',
  );
  const res = await post('/v1/channels/connect', { provider: 'tiktok' }, bearer);
  const url = ((await res.json()) as { url?: string })?.url;
  const u = url ? new URL(url) : undefined;
  check(
    u?.origin + (u?.pathname ?? '') === 'https://www.tiktok.com/v2/auth/authorize/' &&
      !!u?.searchParams.get('client_key') &&
      u?.searchParams.get('code_challenge_method') === 'S256' &&
      (u?.searchParams.get('scope') ?? '').includes('video.publish'),
    'tiktok connect → URL de autorização do TikTok com client_key + PKCE + escopo video.publish',
  );
}

// threads disponível → catálogo declara thread nativa e o connect leva ao consentimento da Meta
if (ids.includes('threads')) {
  const entry = providers.find((p) => p.id === 'threads');
  check(
    entry?.threads === true && entry?.maxLength === 500,
    'threads: réplicas nativas e limite de 500 caracteres no catálogo',
  );
  check(
    entry?.settingsSchema?.properties?.replyControl !== undefined,
    'threads expõe settingsSchema com replyControl (quem pode responder)',
  );
  const res = await post('/v1/channels/connect', { provider: 'threads' }, bearer);
  const url = ((await res.json()) as { url?: string })?.url;
  const u = url ? new URL(url) : undefined;
  check(
    u?.origin + (u?.pathname ?? '') === 'https://www.threads.net/oauth/authorize' &&
      !!u?.searchParams.get('client_id') &&
      (u?.searchParams.get('scope') ?? '').includes('threads_content_publish'),
    'threads connect → URL de autorização da Meta com client_id + escopo threads_content_publish',
  );
}

// twitch/kick: redes de CHAT — o catálogo precisa deixar claro que não aceitam mídia
for (const chatId of ['twitch', 'kick']) {
  if (!ids.includes(chatId)) continue;
  const entry = providers.find((p) => p.id === chatId);
  check(
    entry?.media?.images?.maxCount === 0 && entry?.media?.videos?.maxCount === 0,
    `${chatId}: catálogo declara zero mídia (chat não carrega anexo)`,
  );
  check(entry?.threads === true && entry?.maxLength === 500, `${chatId}: réplica no chat, 500 chars`);
  const res = await post('/v1/channels/connect', { provider: chatId }, bearer);
  const url = ((await res.json()) as { url?: string })?.url;
  const u = url ? new URL(url) : undefined;
  const expected = chatId === 'twitch' ? 'https://id.twitch.tv/oauth2/authorize' : 'https://id.kick.com/oauth/authorize';
  check(
    u?.origin + (u?.pathname ?? '') === expected &&
      !!u?.searchParams.get('client_id') &&
      (u?.searchParams.get('scope') ?? '').includes(chatId === 'twitch' ? 'user:write:chat' : 'chat:write'),
    `${chatId} connect → URL de autorização com client_id + escopo de escrita no chat`,
  );
  if (chatId === 'kick') {
    check(
      u?.searchParams.get('code_challenge_method') === 'S256',
      'kick connect → PKCE S256 (OAuth 2.1 exige)',
    );
  }
}

// instagram-standalone: exige mídia e leva ao consentimento do Instagram Login (sem Facebook)
if (ids.includes('instagram-standalone')) {
  const entry = providers.find((p) => p.id === 'instagram-standalone');
  check(
    entry?.requiresMedia === true && entry?.maxLength === 2200,
    'instagram-standalone: exige mídia e 2200 caracteres no catálogo',
  );
  check(
    entry?.threads === true && entry?.media?.images?.maxCount === 10,
    'instagram-standalone: réplica por comentário e carrossel de até 10 no catálogo',
  );
  const res = await post('/v1/channels/connect', { provider: 'instagram-standalone' }, bearer);
  const url = ((await res.json()) as { url?: string })?.url;
  const u = url ? new URL(url) : undefined;
  check(
    u?.origin + (u?.pathname ?? '') === 'https://www.instagram.com/oauth/authorize' &&
      u?.searchParams.get('enable_fb_login') === '0' &&
      !!u?.searchParams.get('client_id') &&
      (u?.searchParams.get('scope') ?? '').includes('instagram_business_content_publish'),
    'instagram-standalone connect → URL do Instagram Login com escopo instagram_business_content_publish',
  );
}

if (failures > 0) {
  console.error(`\nE2E auth: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\nE2E auth: TUDO OK');
