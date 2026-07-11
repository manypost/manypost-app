export {}; // módulo (top-level await)

/**
 * E2E do coração do produto: conectar canal (fake) → agendar → worker publica.
 * Requer API em MODE=all com PUBLISH_RETRY_BASE_SEC=1, MEDIA_ALLOW_PRIVATE_URLS=true.
 * Cobre: publicação no horário, retry transitório, falha permanente, estados do grupo,
 * webhooks assinados, cancelar/editar e biblioteca de mídia (upload/from-url → post com mídia).
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

// ---- 5) webhook de saída: entrega assinada de post.published ----
import { createHmac } from 'node:crypto';
const received: Array<{ headers: Record<string, string>; body: string }> = [];
const receiver = Bun.serve({
  port: 3989,
  fetch: async (req) => {
    received.push({
      headers: Object.fromEntries(req.headers.entries()),
      body: await req.text(),
    });
    return new Response('ok');
  },
});

const wh = await fetch(`${BASE}/v1/webhooks`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    name: 'e2e',
    url: 'http://localhost:3989/hook',
    events: ['post.published', 'post.failed'],
  }),
});
check(wh.status === 201, `criar webhook → 201 (veio ${wh.status})`);
const whBody = (await wh.json()) as any;
check(whBody.secret?.startsWith('whsec_'), 'secret whsec_ retornado uma única vez');

const hooked = await schedule({
  text: 'post que dispara webhook',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
});
await pollGroup(hooked.body.id, (g) => g.state === 'DONE');
for (let i = 0; i < 20 && received.length === 0; i++) await sleep(500);
check(received.length >= 1, `webhook entregue (${received.length} recebido)`);
if (received.length > 0) {
  const r = received[0]!;
  check(r.headers['x-manypost-event'] === 'post.published', 'header x-manypost-event correto');
  const sig = r.headers['x-manypost-signature'] ?? '';
  const t = sig.match(/t=(\d+)/)?.[1];
  const v1 = sig.match(/v1=([a-f0-9]+)/)?.[1];
  const expected = createHmac('sha256', whBody.secret).update(`${t}.${r.body}`).digest('hex');
  check(v1 === expected, 'assinatura HMAC confere com o secret');
  const payload = JSON.parse(r.body);
  check(payload.event === 'post.published' && !!payload.data.releaseUrl, 'payload com releaseUrl');
}
receiver.stop(true);

// ---- 6) cancelar agendado: nunca publica ----
const toCancel = await schedule({
  text: 'post que será cancelado',
  channelIds: [channel.id],
  publishAt: new Date(Date.now() + 4000).toISOString(),
});
const cancelRes = await fetch(`${BASE}/v1/posts/${toCancel.body.id}/cancel`, { method: 'POST', headers: auth });
check(cancelRes.status === 200, `cancelar → 200 (veio ${cancelRes.status})`);
check(((await cancelRes.json()) as any).publications[0].state === 'CANCELLED', 'publicação → CANCELLED');
await sleep(6000); // horário original passa; job antigo deve ser descartado
const afterCancel = await pollGroup(toCancel.body.id, () => true);
check(afterCancel.publications[0].state === 'CANCELLED', 'cancelado NÃO publicou após o horário');

// ---- 7) editar agendado: publica o texto novo no horário novo ----
const toEdit = await schedule({
  text: 'texto original',
  channelIds: [channel.id],
  publishAt: new Date(Date.now() + 60_000).toISOString(),
});
const patch = await fetch(`${BASE}/v1/posts/${toEdit.body.id}`, {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({ text: 'texto editado', publishAt: new Date(Date.now() + 1000).toISOString() }),
});
check(patch.status === 200, `editar → 200 (veio ${patch.status})`);
const edited = await pollGroup(toEdit.body.id, (g) => g.state === 'DONE');
check(edited.state === 'DONE', `editado publicou no novo horário (veio ${edited.state})`);
check(edited.publications[0].attemptCount === 1, 'edição zerou tentativas (1 tentativa)');

// ---- 8) biblioteca de mídia: upload → arquivo público → post com mídia ----
function pngBytes(width = 64, height = 32): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

const form = new FormData();
form.append('file', new Blob([pngBytes()], { type: 'text/plain' }), 'foto.png'); // content-type mentiroso de propósito
form.append('alt', 'logo do e2e');
const up = await fetch(`${BASE}/v1/media/upload`, {
  method: 'POST',
  headers: { authorization: auth.authorization },
  body: form,
});
check(up.status === 201, `upload multipart → 201 (veio ${up.status})`);
const uploaded = (await up.json()) as any;
check(uploaded.mime === 'image/png', `MIME real por magic bytes, não o do cliente (veio ${uploaded.mime})`);
check(uploaded.width === 64 && uploaded.height === 32, 'dimensões extraídas do header');
check(uploaded.alt === 'logo do e2e', 'alt persistido');

const served = await fetch(uploaded.url); // sem auth: URL pública p/ as redes baixarem
check(served.status === 200, `arquivo servido em /uploads → 200 (veio ${served.status})`);
check(served.headers.get('content-type') === 'image/png', 'content-type correto no serving');

const badForm = new FormData();
badForm.append('file', new Blob([new TextEncoder().encode('não sou imagem')]), 'nota.txt');
const badUp = await fetch(`${BASE}/v1/media/upload`, {
  method: 'POST',
  headers: { authorization: auth.authorization },
  body: badForm,
});
check(badUp.status === 400 && ((await badUp.json()) as any).title === 'media.unsupported_type',
  'arquivo não-mídia recusado → media.unsupported_type');

// from-url contra um servidor local (MEDIA_ALLOW_PRIVATE_URLS=true no e2e)
const mediaServer = Bun.serve({
  port: 3990,
  fetch: () => new Response(pngBytes(10, 10), { headers: { 'content-type': 'image/png' } }),
});
const fromUrl = await fetch(`${BASE}/v1/media/from-url`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ url: 'http://localhost:3990/externa.png' }),
});
check(fromUrl.status === 201, `from-url → 201 (veio ${fromUrl.status})`);
mediaServer.stop(true);

const lib = (await (await fetch(`${BASE}/v1/media`, { headers: auth })).json()) as any[];
check(lib.length === 2, `GET /media lista a biblioteca (${lib.length} itens)`);

const withMedia = await schedule({
  text: 'post com imagem anexada',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
  mediaIds: [uploaded.id],
});
check(withMedia.status === 201, `agendar com mediaIds → 201 (veio ${withMedia.status})`);
check(withMedia.body.publications[0].media?.[0]?.url === uploaded.url, 'publicação carrega a ref da mídia');
const mediaDone = await pollGroup(withMedia.body.id, (g) => g.state === 'DONE');
check(mediaDone.state === 'DONE', `post com mídia publicado (veio ${mediaDone.state})`);

// 5 imagens distintas estouram o limite do canal (fake: máx 4) ANTES de agendar
const moreIds: string[] = [uploaded.id];
for (let i = 0; i < 4; i++) {
  const extra = new FormData();
  extra.append('file', new Blob([pngBytes(8 + i, 8)]), `extra-${i}.png`);
  const res = await fetch(`${BASE}/v1/media/upload`, {
    method: 'POST',
    headers: { authorization: auth.authorization },
    body: extra,
  });
  moreIds.push(((await res.json()) as any).id);
}
const tooManyMedia = await schedule({
  text: 'cinco imagens não passam',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
  mediaIds: moreIds,
});
check(tooManyMedia.status === 400 && tooManyMedia.body.title === 'post.invalid_media',
  `5 imagens → post.invalid_media (veio ${tooManyMedia.status} ${tooManyMedia.body.title})`);

if (failures > 0) {
  console.error(`\nE2E publish: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\nE2E publish: TUDO OK');
