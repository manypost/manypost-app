/**
 * Smoke de 10 segundos com uma sessão Clerk de teste: conecta um canal "fake", agenda um
 * post e espera o worker publicar.
 *
 * Com a stack no ar (`docker compose up`), rode em outro terminal:
 *
 *   docker compose exec app bun run scripts/demo.ts
 *
 * ...ou, se estiver rodando a API localmente com Bun:
 *
 *   bun run scripts/demo.ts
 *
 * Variáveis opcionais:
 *   BASE_URL   (default http://localhost:3000 — precisa bater com o PUBLIC_URL da API)
 *   WHEN_SEC   (daqui a quantos segundos publicar; default 3)
 * Variável obrigatória:
 *   CLERK_SESSION_TOKEN (sessão de um usuário já criado no Clerk)
 */
export {};

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const whenSec = Number(process.env.WHEN_SEC ?? 3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\n✗ não consegui falar com a API em ${BASE}.`);
    console.error('  A stack está no ar? Rode `docker compose up` e tente de novo.\n');
    process.exit(1);
  }

  const token = process.env.CLERK_SESSION_TOKEN;
  if (!token) {
    console.error('✗ defina CLERK_SESSION_TOKEN para um usuário Clerk de teste.');
    process.exit(1);
  }
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // 1) conecta o canal fake (OAuth simulado: connect devolve uma url local + cookie de state;
  //    o "callback" fecha a conexão sem sair da máquina)
  const connect = await fetch(`${BASE}/v1/channels/connect`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ provider: 'fake' }),
  });
  if (connect.status !== 200) {
    console.error('✗ falha ao iniciar a conexão do canal fake:', connect.status, await connect.text());
    process.exit(1);
  }
  const stateCookie = connect.headers.get('set-cookie')?.split(';')[0] ?? '';
  const { url } = (await connect.json()) as { url: string };
  const q = new URL(url).searchParams;
  const cb = await fetch(
    `${BASE}/v1/channels/callback/fake?code=${q.get('code')}&state=${q.get('state')}`,
    { headers: { ...auth, cookie: stateCookie } },
  );
  if (cb.status !== 200) {
    console.error('✗ falha ao conectar o canal fake:', cb.status, await cb.text());
    process.exit(1);
  }
  const channels = (await (
    await fetch(`${BASE}/v1/channels`, { headers: auth })
  ).json()) as Array<{ id: string; name: string; provider: string }>;
  const channel = channels.find((item) => item.provider === 'fake');
  if (!channel) {
    console.error('✗ callback concluído, mas o canal fake não apareceu na listagem');
    process.exit(1);
  }
  console.log(`✓ canal conectado: ${channel.name} (${channel.id})`);

  // 3) agenda um post para daqui a poucos segundos
  const text = `Post de teste do manypost 🚀 — ${new Date().toLocaleString('pt-BR')}`;
  const post = await fetch(`${BASE}/v1/posts`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      text,
      channelIds: [channel.id],
      publishAt: new Date(Date.now() + whenSec * 1000).toISOString(),
    }),
  });
  if (post.status !== 201) {
    console.error('✗ falha ao agendar:', post.status, await post.text());
    process.exit(1);
  }
  const group = (await post.json()) as { id: string };
  console.log(`✓ agendado para daqui a ${whenSec}s; esperando o worker publicar`);

  // 4) espera a publicação (o worker roda no mesmo processo com MODE=all)
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    const g = (await (await fetch(`${BASE}/v1/posts/${group.id}`, { headers: auth })).json()) as any;
    const pub = g.publications[0];
    if (pub.state === 'PUBLISHED') {
      console.log(`\n🎉 publicado! url simulada: ${pub.releaseUrl}\n`);
      console.log('A stack está funcionando. Agora explore a API em ' + `${BASE}/docs\n`);
      process.exit(0);
    }
    if (pub.state === 'FAILED' || pub.state === 'NEEDS_REVIEW') {
      console.error(`\n✗ ${pub.state}: [${pub.errorClass}] ${pub.errorMessage}\n`);
      process.exit(1);
    }
    process.stdout.write('.');
  }
  console.error('\n✗ tempo esgotado esperando a publicação (o worker está rodando?)\n');
  process.exit(1);
}

await main();
