/**
 * Conecta um canal REAL e publica um post de teste — pela linha de comando, sem frontend.
 * Funciona com Mastodon (OAuth pelo navegador) e Telegram / Bluesky / Discord (credenciais
 * diretas — o Discord conecta colando a URL de um webhook do canal).
 *
 * Pré-requisitos: Postgres + Redis no ar e a API rodando (veja docs/principal/STATUS.md §5 ou o
 * passo a passo que o assistente te passou). Então:
 *
 *   bun run scripts/connect-and-post.ts
 *
 * Variáveis opcionais:
 *   BASE_URL   (default http://localhost:3000 — precisa bater com o PUBLIC_URL da API)
 *   TEXT       (texto do post de teste)
 *   WHEN_SEC   (daqui a quantos segundos publicar; default 5)
 */
export {};

import { createInterface } from 'node:readline/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => rl.question(q);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // saúde + catálogo: só mostra os providers que estão realmente disponíveis nesta instalação
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\n✗ não consegui falar com a API em ${BASE}.`);
    console.error('  Confirme que ela está rodando e que BASE_URL bate com o PUBLIC_URL dela.\n');
    process.exit(1);
  }

  // conta de teste (nova a cada run; a org é isolada)
  const email = `teste-${Date.now()}@manypost.local`;
  const password = 'senha-de-teste-bem-forte-123';
  const reg = await fetch(`${BASE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Conta de Teste' }),
  });
  if (!reg.ok) {
    console.error('✗ falha ao criar a conta de teste:', reg.status, await reg.text());
    process.exit(1);
  }
  const { accessToken } = (await reg.json()) as { accessToken: string };
  const auth = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
  console.log(`\n✓ conta de teste criada: ${email}`);

  const providers = (await (
    await fetch(`${BASE}/v1/channels/providers`, { headers: auth })
  ).json()) as Array<{ id: string; name: string; connectType: 'fields' | 'oauth' }>;
  const real = providers.filter((p) => p.id !== 'fake');
  if (real.length === 0) {
    console.error('\n✗ nenhum provider real disponível — configure as credenciais no .env.\n');
    process.exit(1);
  }

  console.log('\nProviders disponíveis nesta instalação:');
  real.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.id}) — conexão por ${p.connectType}`));
  const pick = Number(await ask('\nQual provider quer testar? (número) ')) - 1;
  const provider = real[pick];
  if (!provider) {
    console.error('opção inválida');
    process.exit(1);
  }

  const channel = await (provider.connectType === 'fields'
    ? connectByFields(provider.id, auth)
    : connectByOAuth(provider.id, auth));

  console.log(`\n✓ canal conectado: ${channel.name} (${channel.id})`);

  // publica um post de teste
  const whenSec = Number(process.env.WHEN_SEC ?? 5);
  const text =
    process.env.TEXT ?? `Publicação de teste do manypost 🚀 — ${new Date().toLocaleString('pt-BR')}`;
  const confirm = (await ask(`\nPublicar agora "${text}" em ${whenSec}s? (s/N) `)).toLowerCase();
  if (confirm !== 's') {
    console.log('ok, canal conectado mas nada publicado. Até!');
    process.exit(0);
  }

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
  console.log(`\n✓ agendado (grupo ${group.id}); aguardando o worker publicar...`);

  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    const g = (await (await fetch(`${BASE}/v1/posts/${group.id}`, { headers: auth })).json()) as any;
    const pub = g.publications[0];
    if (pub.state === 'PUBLISHED') {
      console.log(`\n🎉 publicado! ${pub.releaseUrl ?? '(sem URL pública — ex.: chat privado)'}\n`);
      process.exit(0);
    }
    if (pub.state === 'FAILED' || pub.state === 'NEEDS_REVIEW') {
      console.error(`\n✗ ${pub.state}: [${pub.errorClass}] ${pub.errorMessage}\n`);
      process.exit(1);
    }
    process.stdout.write('.');
  }
  console.error('\n✗ tempo esgotado esperando a publicação (o worker está rodando? MODE=all ou =worker)\n');
  process.exit(1);
}

/** Telegram/Bluesky: pede os campos e conecta direto (sem navegador). */
async function connectByFields(providerId: string, auth: Record<string, string>) {
  const fields: Record<string, string> = {};
  if (providerId === 'telegram') {
    fields.chat = await ask('Canal/grupo do Telegram (ex.: @meucanal ou id numérico): ');
  } else if (providerId === 'bluesky') {
    fields.handle = await ask('Seu handle Bluesky (ex.: voce.bsky.social): ');
    fields.appPassword = await ask('App Password (xxxx-xxxx-xxxx-xxxx): ');
  } else if (providerId === 'discord') {
    fields.webhookUrl = await ask(
      'URL do webhook do canal Discord (Config do servidor → Integrações → Webhooks → Copiar URL): ',
    );
  } else {
    // fallback genérico: pergunta os campos que o provider declara
    console.log('(informe os campos de conexão exigidos por este provider)');
    fields.value = await ask('valor: ');
  }
  const res = await fetch(`${BASE}/v1/channels/connect`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ provider: providerId, fields }),
  });
  if (res.status !== 201) {
    console.error('\n✗ a rede recusou a conexão:', res.status, ((await res.json()) as any).detail ?? '');
    process.exit(1);
  }
  return (await res.json()) as { id: string; name: string };
}

/** Mastodon: OAuth com autorização no navegador; o code volta na URL de redirect. */
async function connectByOAuth(providerId: string, auth: Record<string, string>) {
  let fields: Record<string, string> | undefined;
  if (providerId === 'mastodon') {
    const instance = await ask(
      'URL da sua instância Mastodon (Enter p/ usar MASTODON_DEFAULT_INSTANCE): ',
    );
    if (instance.trim()) fields = { instance: instance.trim() };
  }

  const connect = await fetch(`${BASE}/v1/channels/connect`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ provider: providerId, ...(fields ? { fields } : {}) }),
  });
  if (connect.status !== 200) {
    console.error('\n✗ falha ao iniciar a conexão:', connect.status, ((await connect.json()) as any).detail ?? '');
    process.exit(1);
  }
  // o cookie de state (mp_ch_state) precisa voltar no callback — guardamos aqui
  const stateCookie = connect.headers.get('set-cookie')?.split(';')[0] ?? '';
  const { url } = (await connect.json()) as { url: string };

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('1) Abra este link no navegador e autorize o manypost:\n');
  console.log(`   ${url}\n`);
  console.log('2) Depois de autorizar, o navegador vai redirecionar para uma página');
  console.log('   que pode mostrar um ERRO (é esperado — falta o cookie no browser).');
  console.log('   O que importa é a URL final na barra de endereço.');
  console.log('──────────────────────────────────────────────────────────────');
  const redirected = await ask('\n3) Cole aqui a URL COMPLETA para onde o navegador foi: ');

  let code: string | null;
  let state: string | null;
  try {
    const u = new URL(redirected.trim());
    code = u.searchParams.get('code');
    state = u.searchParams.get('state');
  } catch {
    console.error('✗ isso não parece uma URL válida');
    process.exit(1);
  }
  if (!code || !state) {
    console.error('✗ a URL não tinha ?code=...&state=... — autorizou até o fim?');
    process.exit(1);
  }

  const cb = await fetch(
    `${BASE}/v1/channels/callback/${providerId}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { headers: { ...auth, cookie: stateCookie } },
  );
  if (cb.status !== 201) {
    console.error('\n✗ a troca do code falhou:', cb.status, ((await cb.json()) as any).detail ?? '');
    process.exit(1);
  }
  return (await cb.json()) as { id: string; name: string };
}

await main().finally(() => rl.close());
