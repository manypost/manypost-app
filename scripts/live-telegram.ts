/**
 * Smoke REAL do Telegram (opcional — publica de verdade num canal/grupo seu).
 * Não roda no CI; use para validar credenciais de ponta a ponta.
 *
 * Pré-requisitos: API no ar (MODE=all) com TELEGRAM_BOT_TOKEN no .env, e o bot
 * como admin do chat. Rode:
 *   TG_CHAT=@meucanal CLERK_SESSION_TOKEN=... BASE_URL=http://localhost:3988 \
 *     bun run scripts/live-telegram.ts
 *
 * Ele usa um usuário Clerk existente, conecta o canal, agenda um post p/ +3s e confere
 * que publicou.
 */
export {};

const BASE = process.env.BASE_URL ?? 'http://localhost:3988';
const chat = process.env.TG_CHAT;
const token = process.env.CLERK_SESSION_TOKEN;
if (!chat || !token) {
  console.error(
    'defina TG_CHAT=@seucanal e CLERK_SESSION_TOKEN (o bot precisa poder publicar)',
  );
  process.exit(2);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

console.log(`conectando ${chat}...`);
const connect = await fetch(`${BASE}/v1/channels/connect`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ provider: 'telegram', fields: { chat } }),
});
if (connect.status !== 201) {
  console.error('conexão falhou:', connect.status, await connect.text());
  process.exit(1);
}
const channel = (await connect.json()) as any;
console.log(`conectado: ${channel.name} (${channel.id})`);

const post = await fetch(`${BASE}/v1/posts`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    text: `manypost · smoke real do Telegram ${new Date().toISOString()}`,
    channelIds: [channel.id],
    publishAt: new Date(Date.now() + 3000).toISOString(),
  }),
});
const group = (await post.json()) as any;
console.log(`agendado grupo ${group.id}; aguardando publicação...`);

for (let i = 0; i < 40; i++) {
  await sleep(1000);
  const g = (await (await fetch(`${BASE}/v1/posts/${group.id}`, { headers: auth })).json()) as any;
  const pub = g.publications[0];
  if (pub.state === 'PUBLISHED') {
    console.log(`✓ publicado! releaseUrl: ${pub.releaseUrl ?? '(chat privado)'}`);
    process.exit(0);
  }
  if (pub.state === 'FAILED' || pub.state === 'NEEDS_REVIEW') {
    console.error(`✗ ${pub.state}: ${pub.errorClass} — ${pub.errorMessage}`);
    process.exit(1);
  }
}
console.error('timeout esperando a publicação');
process.exit(1);
