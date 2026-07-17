export {}; // módulo (top-level await)

/**
 * E2E do coração do produto: conectar canal (fake) → agendar → worker publica.
 * Requer API em MODE=all com PUBLISH_RETRY_BASE_SEC=1, MEDIA_ALLOW_PRIVATE_URLS=true.
 * Cobre: publicação no horário, retry transitório, falha permanente, estados do grupo,
 * webhooks assinados, cancelar/editar, biblioteca de mídia (upload/from-url → post com mídia),
 * aprovação por link público (rascunho → cliente aprova sem login → publica),
 * listagens p/ calendário/kanban, SSE, retry manual e notificações lidas.
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

// ---- 9) threads: item 0 + réplicas encadeadas, delay real via fila ----
const threadPost = await schedule({
  text: 'abrindo a thread',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
  mediaIds: [uploaded.id],
  thread: [
    { text: 'réplica 1, dois segundos depois', delaySec: 2 },
    { text: 'réplica 2, imediata' },
  ],
});
check(threadPost.status === 201, `agendar thread → 201 (veio ${threadPost.status})`);
check(threadPost.body.publications[0].itemCount === 3, 'itemCount = 3 itens');
const threadDone = await pollGroup(threadPost.body.id, (g) => g.state === 'DONE', 30_000);
check(threadDone.state === 'DONE', `thread publicada inteira (veio ${threadDone.state})`);
check(threadDone.publications[0].lastPublishedIndex === 2,
  `cursor no último item (veio ${threadDone.publications[0].lastPublishedIndex})`);
check(!!threadDone.publications[0].externalId, 'externalId do item 0 preenchido');

// réplica falha 1x → retry retoma do cursor e termina (item 0 nunca é repostado — unit cobre)
const flakyThread = await schedule({
  text: 'thread com réplica instável',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
  settingsByChannel: { [channel.id]: { failFirstReplyAttempts: 1 } },
  thread: [{ text: 'réplica que falha na primeira' }],
});
const flakyDone = await pollGroup(flakyThread.body.id, (g) => g.state === 'DONE', 30_000);
check(flakyDone.state === 'DONE', `thread com falha transitória terminou (veio ${flakyDone.state})`);
check(flakyDone.publications[0].attemptCount >= 2,
  `retry consumiu tentativa (veio ${flakyDone.publications[0].attemptCount})`);
check(flakyDone.publications[0].lastPublishedIndex === 1, 'cursor completo após retry');

// ---- 9b) GET de detalhe expõe o conteúdo p/ duplicar (texto/override/settings/thread) ----
const dupSrc = await schedule({
  text: 'texto base p/ duplicar',
  channelIds: [channel.id],
  publishAt: new Date(Date.now() + 3_600_000).toISOString(),
  textByChannel: { [channel.id]: 'texto personalizado deste canal' },
  settingsByChannel: { [channel.id]: { failFirstAttempts: 2 } },
  thread: [{ text: 'réplica p/ duplicar', delaySec: 30 }],
  requireApproval: true,
});
check(dupSrc.status === 201, `fonte p/ duplicar → 201 (veio ${dupSrc.status})`);
const dupDetail = (await (await fetch(`${BASE}/v1/posts/${dupSrc.body.id}`, { headers: auth })).json()) as any;
check(dupDetail.text === 'texto base p/ duplicar', 'detalhe: texto base do grupo');
check(dupDetail.publications[0].text === 'texto personalizado deste canal', 'detalhe: texto por canal (override)');
check(dupDetail.publications[0].settings?.failFirstAttempts === 2, 'detalhe: settings da publicação');
check(
  dupDetail.publications[0].thread?.length === 1 &&
    dupDetail.publications[0].thread[0].text === 'réplica p/ duplicar' &&
    dupDetail.publications[0].thread[0].delaySec === 30,
  'detalhe: réplicas de thread com delay',
);
await fetch(`${BASE}/v1/posts/${dupSrc.body.id}/cancel`, { method: 'POST', headers: auth });

// ---- 10) aprovação por link público (DECISIONS v1.1 §12): sem login, por token ----
const draft = await schedule({
  text: 'post aguardando aprovação do cliente',
  channelIds: [channel.id],
  publishAt: new Date(Date.now() + 2000).toISOString(),
  requireApproval: true,
});
check(draft.status === 201 && draft.body.state === 'DRAFT',
  `requireApproval → grupo DRAFT (veio ${draft.status} ${draft.body.state})`);
check(draft.body.publications[0].state === 'DRAFT', 'publicação nasce DRAFT (sem job)');
await sleep(3500); // horário passa e NADA publica (rascunho não tem job)
const stillDraft = await pollGroup(draft.body.id, () => true);
check(stillDraft.state === 'DRAFT', `rascunho NÃO publica sozinho (veio ${stillDraft.state})`);

const linkRes = await fetch(`${BASE}/v1/posts/${draft.body.id}/approval-link`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({}),
});
check(linkRes.status === 201, `criar approval-link → 201 (veio ${linkRes.status})`);
const link1 = (await linkRes.json()) as any;
check(typeof link1.token === 'string' && link1.token.length >= 43, 'token opaco ≥ 256 bits');
check(link1.url?.includes(link1.token), 'URL única contém o token');

// preview público: sem nenhuma credencial
const prev = await fetch(`${BASE}/public/approval/${link1.token}`);
check(prev.status === 200, `preview público sem login → 200 (veio ${prev.status})`);
const preview = (await prev.json()) as any;
check(preview.status === 'PENDING', 'preview PENDING');
check(preview.publications[0].items[0].text === 'post aguardando aprovação do cliente',
  'preview mostra o conteúdo como será publicado');
check(preview.publications[0].provider === 'fake' && !JSON.stringify(preview).includes(channel.id),
  'preview identifica o canal sem vazar ids internos da org');

const badToken = await fetch(`${BASE}/public/approval/um-token-invalido-qualquer-123456`);
check(badToken.status === 404, `token inválido → 404 uniforme (veio ${badToken.status})`);

// cliente pede ajustes (com feedback)
const changes = await fetch(`${BASE}/public/approval/${link1.token}/request-changes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ feedback: 'troca a primeira frase', name: 'Cliente E2E' }),
});
check(changes.status === 200 && ((await changes.json()) as any).status === 'CHANGES_REQUESTED',
  'request-changes → CHANGES_REQUESTED');
const linkStatus = (await (
  await fetch(`${BASE}/v1/posts/${draft.body.id}/approval-link`, { headers: auth })
).json()) as any;
check(linkStatus.status === 'CHANGES_REQUESTED' && linkStatus.feedback === 'troca a primeira frase',
  'equipe vê o feedback do cliente no link');
check((await pollGroup(draft.body.id, () => true)).state === 'DRAFT', 'pedir ajustes mantém o rascunho');

// equipe edita o rascunho (continua DRAFT) e gera novo link; cliente aprova → publica
const draftPatch = await fetch(`${BASE}/v1/posts/${draft.body.id}`, {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({ text: 'frase trocada, pronta para aprovar' }),
});
check(draftPatch.status === 200 && ((await draftPatch.json()) as any).state === 'DRAFT',
  'editar rascunho não agenda (permanece DRAFT)');
const link2 = (await (
  await fetch(`${BASE}/v1/posts/${draft.body.id}/approval-link`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({}),
  })
).json()) as any;
const approve = await fetch(`${BASE}/public/approval/${link2.token}/approve`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Cliente E2E' }),
});
check(approve.status === 200 && ((await approve.json()) as any).status === 'APPROVED',
  'approve → APPROVED');
// timeout longo: a essa altura a janela de rate-limit do canal fake (10/60s) pode estar
// cheia — o job é adiado sem consumir tentativa e publica quando a janela rola
const approvedDone = await pollGroup(draft.body.id, (g) => g.state === 'DONE', 90_000);
check(approvedDone.state === 'DONE', `aprovado publica de verdade (veio ${approvedDone.state})`);
check(approvedDone.publications[0].state === 'PUBLISHED', 'publicação → PUBLISHED após aprovação');

// idempotência: aprovar de novo não duplica nada
const again = await fetch(`${BASE}/public/approval/${link2.token}/approve`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({}),
});
const againBody = (await again.json()) as any;
check(again.status === 200 && againBody.status === 'APPROVED' && againBody.alreadyResolved === true,
  'segunda aprovação é idempotente (retorna o resolvido)');

// equipe é notificada das duas resoluções
const notifs = (await (await fetch(`${BASE}/v1/notifications`, { headers: auth })).json()) as any[];
check(notifs.filter((n) => n.kind === 'approval.resolved').length === 2,
  `notificações de aprovação para a equipe (veio ${notifs.filter((n) => n.kind === 'approval.resolved').length})`);
check(notifs.some((n) => n.title === 'Cliente aprovou o post'), 'notificação de aprovado');
check(notifs.some((n) => n.body === 'troca a primeira frase'), 'notificação de ajustes carrega o feedback');

// ---- 11) SSE /v1/events: estado muda → evento chega sem reload ----
const sseEvents: Array<{ event: string; data: string }> = [];
const sseAbort = new AbortController();
const ssePromise = (async () => {
  const res = await fetch(`${BASE}/v1/events`, {
    headers: { authorization: auth.authorization },
    signal: sseAbort.signal,
  });
  check(res.status === 200, `SSE conecta → 200 (veio ${res.status})`);
  check((res.headers.get('content-type') ?? '').includes('text/event-stream'), 'content-type event-stream');
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      sseEvents.push({
        event: chunk.match(/^event: (.*)$/m)?.[1] ?? 'message',
        data: chunk.match(/^data: (.*)$/m)?.[1] ?? '',
      });
    }
  }
})().catch(() => {}); // abort esperado no fim

const sseSeen = async (event: string, timeoutMs = 90_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sseEvents.some((e) => e.event === event)) return true;
    await sleep(300);
  }
  return false;
};
check(await sseSeen('hello', 5000), 'handshake hello com realtime ativo');

const ssePost = await schedule({
  text: 'post observado pelo SSE',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
});
check(ssePost.status === 201, `agendar post do SSE → 201 (veio ${ssePost.status})`);
check(await sseSeen('post.scheduled', 10_000), 'SSE recebeu post.scheduled');
check(await sseSeen('post.published'), 'SSE recebeu post.published (worker → Redis → stream)');
{
  const ev = sseEvents.find((e) => e.event === 'post.published');
  check(!!ev && JSON.parse(ev.data).groupId === ssePost.body.id, 'payload do SSE aponta o grupo certo');
}
sseAbort.abort();
await ssePromise;

// ---- 12) GET /v1/publications: feed do calendário/kanban ----
const range = `from=${encodeURIComponent(new Date(Date.now() - 3_600_000).toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 3_600_000).toISOString())}`;
const feed = (await (await fetch(`${BASE}/v1/publications?${range}&limit=200`, { headers: auth })).json()) as any;
check(Array.isArray(feed.items) && feed.items.length >= 10, `feed lista as publicações do período (${feed.items.length})`);
{
  const item = feed.items.find((i: any) => i.groupId === ssePost.body.id);
  check(!!item, 'item do feed pelo groupId');
  check(item?.channel?.provider === 'fake' && !!item?.channel?.name, 'feed embute canal (provider/nome)');
  check(item?.group?.state === 'DONE' && item?.group?.origin === 'WEB', 'feed embute estado e origem do grupo');
  check(typeof item?.text === 'string' && item.text.length > 0, 'feed traz o texto do post');
}

const published = (await (
  await fetch(`${BASE}/v1/publications?${range}&state=PUBLISHED&limit=200`, { headers: auth })
).json()) as any;
check(
  published.items.length > 0 && published.items.every((i: any) => i.state === 'PUBLISHED'),
  `filtro state=PUBLISHED só traz publicadas (${published.items.length})`,
);

const page1 = (await (await fetch(`${BASE}/v1/publications?${range}&limit=2`, { headers: auth })).json()) as any;
check(page1.items.length === 2 && typeof page1.nextCursor === 'string', 'limit=2 + nextCursor presente');
const page2 = (await (
  await fetch(`${BASE}/v1/publications?${range}&limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`, { headers: auth })
).json()) as any;
check(
  page2.items.length > 0 && !page1.items.some((a: any) => page2.items.some((b: any) => a.id === b.id)),
  'página 2 via cursor não repete itens',
);

const badState = await fetch(`${BASE}/v1/publications?state=INVENTADO`, { headers: auth });
check(badState.status === 400 && ((await badState.json()) as any).title === 'validation.invalid_request',
  `estado inválido → 400 problem+json (veio ${badState.status})`);

// rascunho aguardando cliente aparece com a flag do kanban
const kanbanDraft = await schedule({
  text: 'rascunho para a coluna aguardando aprovação',
  channelIds: [channel.id],
  publishAt: new Date(Date.now() + 3_000_000).toISOString(),
  requireApproval: true,
});
await fetch(`${BASE}/v1/posts/${kanbanDraft.body.id}/approval-link`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({}),
});
const draftFeed = (await (
  await fetch(`${BASE}/v1/publications?state=DRAFT&limit=50`, { headers: auth })
).json()) as any;
const draftItem = draftFeed.items.find((i: any) => i.groupId === kanbanDraft.body.id);
check(draftItem?.group?.awaitingApproval === true, 'DRAFT com link pendente → awaitingApproval (kanban)');

// ---- 13) retry manual: falha esgotada → "tentar novamente" → publica ----
const flakyPost = await schedule({
  text: 'post que esgota as tentativas',
  channelIds: [channel.id],
  publishAt: new Date().toISOString(),
  settingsByChannel: { [channel.id]: { failFirstAttempts: 5 } },
});
const exhausted = await pollGroup(flakyPost.body.id, (g) => g.publications[0].state === 'FAILED', 60_000);
check(exhausted.publications[0].state === 'FAILED', `5 falhas → FAILED (veio ${exhausted.publications[0].state})`);
check(exhausted.publications[0].errorClass === 'transient', 'errorClass transient');

const retryRes = await fetch(`${BASE}/v1/posts/${flakyPost.body.id}/retry`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ channelId: channel.id }),
});
check(retryRes.status === 200, `retry → 200 (veio ${retryRes.status})`);
check(((await retryRes.json()) as any).publications[0].state === 'SCHEDULED', 'retry re-agenda a publicação');
const retried2 = await pollGroup(flakyPost.body.id, (g) => g.state === 'DONE', 90_000);
check(retried2.state === 'DONE', `retry manual publica (fake passa na 6ª tentativa — veio ${retried2.state})`);
check(retried2.publications[0].attemptCount >= 1 && retried2.publications[0].attemptCount <= 5,
  `tentativas zeradas no retry (veio ${retried2.publications[0].attemptCount})`);

const nothingToRetry = await fetch(`${BASE}/v1/posts/${ssePost.body.id}/retry`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({}),
});
check(nothingToRetry.status === 400 && ((await nothingToRetry.json()) as any).title === 'post.invalid_transition',
  'retry sem nada falhado → post.invalid_transition');

// ---- 14) notificações: marcar lida / todas lidas ----
const beforeRead = (await (await fetch(`${BASE}/v1/notifications`, { headers: auth })).json()) as any[];
const unread = beforeRead.filter((n) => n.readAt === null);
check(unread.length >= 2, `há notificações não lidas (${unread.length})`);
const readOne = await fetch(`${BASE}/v1/notifications/${unread[0].id}/read`, { method: 'POST', headers: auth });
check(readOne.status === 200, `marcar lida → 200 (veio ${readOne.status})`);
const afterOne = (await (await fetch(`${BASE}/v1/notifications`, { headers: auth })).json()) as any[];
check(afterOne.find((n) => n.id === unread[0].id)?.readAt !== null, 'readAt preenchido');
const readAll = (await (
  await fetch(`${BASE}/v1/notifications/read-all`, { method: 'POST', headers: auth })
).json()) as any;
check(readAll.read >= 1, `read-all marcou as restantes (${readAll.read})`);
const afterAll = (await (await fetch(`${BASE}/v1/notifications`, { headers: auth })).json()) as any[];
check(afterAll.every((n) => n.readAt !== null), 'nenhuma não lida após read-all');
const readMissing = await fetch(`${BASE}/v1/notifications/00000000-0000-7000-8000-000000000000/read`, {
  method: 'POST',
  headers: auth,
});
check(readMissing.status === 404, `notificação inexistente → 404 (veio ${readMissing.status})`);

if (failures > 0) {
  console.error(`\nE2E publish: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\nE2E publish: TUDO OK');
