export {}; // módulo (top-level await)

/**
 * E2E do coração do produto: conectar canal (fake) → agendar → worker publica.
 * Requer API em MODE=all com PUBLISH_RETRY_BASE_SEC=1.
 * Cobre: publicação no horário, retry transitório, falha permanente, estados do grupo.
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- setup: conta + canal fake conectado ----
const email = `pub-${Date.now()}@test.dev`;
const reg = await fetch(`${BASE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'senha-e2e-super-forte-123', name: 'Publisher' }),
});
const { accessToken } = (await reg.json()) as any;
const auth = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };

const connect = await fetch(`${BASE}/v1/channels/connect`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ provider: 'fake' }),
});
check(connect.status === 200, `POST /channels/connect → 200 (veio ${connect.status})`);
const stateCookie = connect.headers.get('set-cookie')?.split(';')[0] ?? '';
const { url } = (await connect.json()) as any;
const q = new URL(url).searchParams;

const cb = await fetch(
  `${BASE}/v1/channels/callback/fake?code=${q.get('code')}&state=${q.get('state')}`,
  { headers: { ...auth, cookie: stateCookie } },
);
check(cb.status === 201, `callback conecta o canal → 201 (veio ${cb.status})`);
const channel = (await cb.json()) as any;
check(channel.status === 'ACTIVE', 'canal ACTIVE após conexão');

const list = (await (await fetch(`${BASE}/v1/channels`, { headers: auth })).json()) as any[];
check(list.length === 1 && list[0].provider === 'fake', 'GET /channels lista o canal');
check(list[0].tokenEnc === undefined && list[0].token === undefined, 'tokens NUNCA aparecem na API');

async function schedule(body: object) {
  const res = await fetch(`${BASE}/v1/posts`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as any };
}
async function pollGroup(groupId: string, until: (g: any) => boolean, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const g = (await (await fetch(`${BASE}/v1/posts/${groupId}`, { headers: auth })).json()) as any;
    if (until(g)) return g;
    await sleep(500);
  }
  return (await (await fetch(`${BASE}/v1/posts/${groupId}`, { headers: auth })).json()) as any;
}

// ---- 1) caminho feliz: agenda p/ +2s e o worker publica no horário ----
const happy = await schedule({
  text: 'primeiro post do manypost!',
  channelIds: [channel.id],
  publishAt: new Date(Date.now() + 2000).toISOString(),
});
check(happy.status === 201, `agendar → 201 (veio ${happy.status})`);
check(happy.body.state === 'SCHEDULED', 'grupo nasce SCHEDULED');
check(happy.body.publications[0].state === 'SCHEDULED', 'publicação nasce SCHEDULED');

const done = await pollGroup(happy.body.id, (g) => g.state === 'DONE');
check(done.state === 'DONE', `grupo → DONE (veio ${done.state})`);
check(done.publications[0].state === 'PUBLISHED', 'publicação → PUBLISHED');
check(!!done.publications[0].externalId, 'externalId da rede preenchido');
check(!!done.publications[0].releaseUrl, 'releaseUrl preenchida');

// ---- 2) retry transitório: falha 1x e publica na 2ª tentativa ----
const retry = await schedule({
  text: 'post com falha transitória',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
  settingsByChannel: { [channel.id]: { failFirstAttempts: 1 } },
});
const retried = await pollGroup(retry.body.id, (g) => g.state === 'DONE');
check(retried.state === 'DONE', `retry: grupo → DONE (veio ${retried.state})`);
check(retried.publications[0].attemptCount >= 2, `retry: >=2 tentativas (veio ${retried.publications[0].attemptCount})`);

// ---- 3) falha permanente: FAILED sem retry, com erro legível ----
const perm = await schedule({
  text: 'post rejeitado pela rede',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
  settingsByChannel: { [channel.id]: { rejectContent: true } },
});
const failed = await pollGroup(perm.body.id, (g) => g.state === 'PARTIAL');
check(failed.state === 'PARTIAL', `permanente: grupo → PARTIAL (veio ${failed.state})`);
check(failed.publications[0].state === 'FAILED', 'permanente: publicação → FAILED');
check(failed.publications[0].errorClass === 'permanent', 'errorClass = permanent');
check(failed.publications[0].attemptCount === 1, 'permanente: SEM retry (1 tentativa)');

// ---- 4) validações de agendamento ----
const tooLong = await schedule({ text: 'x'.repeat(501), channelIds: [channel.id], publishAt: new Date().toISOString() });
check(tooLong.status === 400 && tooLong.body.title === 'post.too_long', 'texto acima do limite do canal → post.too_long');
const emptyCh = await schedule({ text: 'oi', channelIds: ['00000000-0000-7000-8000-000000000000'], publishAt: new Date().toISOString() });
check(emptyCh.status === 404, 'canal inexistente → 404');

if (failures > 0) {
  console.error(`\nE2E publish: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\nE2E publish: TUDO OK');
