/**
 * E2E do resumo operacional da tela inicial (`GET /v1/insights/summary`).
 *
 *   DATABASE_URL=postgresql://... BASE_URL=http://127.0.0.1:3198 bun run scripts/e2e-insights.ts
 *
 * NUNCA aponte para o banco de desenvolvimento: o script cria organizações e publicações próprias.
 *
 * Por que existe um E2E para um endpoint de leitura: as contagens são SQL agregado, e agregado é
 * exatamente onde um erro passa despercebido — ninguém vê a linha errada, só um número plausível.
 * Duas organizações são semeadas de propósito, com a segunda cheia de ruído, porque num agregado
 * um `where org_id` esquecido não quebra nada: só mistura as contas de dois clientes.
 *
 * O cenário é fixo e as contagens esperadas estão escritas à mão abaixo. Se a SQL mudar de forma,
 * este script diz qual contagem saiu errada, não só que "algo" saiu.
 */
import postgres from 'postgres';
import { createE2EHuman } from './e2e-clerk';

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error('✗ defina DATABASE_URL apontando para um Postgres DESCARTÁVEL');
  process.exit(1);
}
const API = process.env.BASE_URL ?? 'http://127.0.0.1:3198';
const sql = postgres(DB, { max: 4, onnotice: () => {} });

let falhas = 0;
let total = 0;
const check = (nome: string, ok: boolean, detalhe?: unknown) => {
  total++;
  console.log(`  ${ok ? '✓' : '✗'} ${nome}`);
  if (!ok) {
    falhas++;
    if (detalhe !== undefined) console.log(`      ${JSON.stringify(detalhe)}`);
  }
};

async function canal(orgId: string, status: string, name: string) {
  const [c] = await sql<{ id: string }[]>`
    INSERT INTO channels (id, org_id, provider, external_id, name, status, token_enc, token_key_version)
    VALUES (gen_random_uuid(), ${orgId}::uuid, 'mastodon', ${`ext-${name}`}, ${name}, ${status}, '\\x00'::bytea, 1)
    RETURNING id`;
  return c!.id;
}

async function publicacao(
  orgId: string,
  channelId: string,
  state: string,
  publishAt: Date,
  groupState = 'SCHEDULED',
) {
  const [g] = await sql<{ id: string }[]>`
    INSERT INTO post_groups (id, org_id, state, origin, publish_at)
    VALUES (gen_random_uuid(), ${orgId}::uuid, ${groupState}, 'WEB', ${publishAt}) RETURNING id`;
  await sql`
    INSERT INTO publications (id, org_id, group_id, channel_id, state, publish_at, content, published_at, updated_at)
    VALUES (gen_random_uuid(), ${orgId}::uuid, ${g!.id}::uuid, ${channelId}::uuid, ${state}, ${publishAt},
            ${sql.json({ text: 'SEGREDO_DO_TEXTO' })},
            ${state === 'PUBLISHED' ? publishAt : null}, now())`;
  return g!.id;
}

async function main() {
  console.log('\n▸ semeando cenário conhecido');
  const alfa = await createE2EHuman('home-alfa', API);
  const beta = await createE2EHuman('home-beta', API);
  const a = { orgId: alfa.orgId, auth: alfa.auth };
  const b = { orgId: beta.orgId, auth: beta.auth };

  const chOk = await canal(a.orgId, 'ACTIVE', 'Ativo');
  await canal(a.orgId, 'REFRESH_REQUIRED', 'Insta da loja');
  const chBeta = await canal(b.orgId, 'REFRESH_REQUIRED', 'Beta');

  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const amanha = new Date(hoje.getTime() + 86_400_000);
  const em3dias = new Date(hoje.getTime() + 3 * 86_400_000);

  // org alfa: 2 falhas, 1 revisão, 1 parcial, 2 agendadas hoje, 1 publicada hoje, e futuras
  await publicacao(a.orgId, chOk, 'FAILED', hoje);
  await publicacao(a.orgId, chOk, 'FAILED', hoje);
  await publicacao(a.orgId, chOk, 'NEEDS_REVIEW', hoje);
  await publicacao(a.orgId, chOk, 'PUBLISHED', hoje, 'PARTIAL');
  await publicacao(a.orgId, chOk, 'SCHEDULED', hoje);
  await publicacao(a.orgId, chOk, 'SCHEDULED', hoje);
  await publicacao(a.orgId, chOk, 'PUBLISHED', hoje, 'DONE');
  await publicacao(a.orgId, chOk, 'SCHEDULED', amanha);
  await publicacao(a.orgId, chOk, 'SCHEDULED', em3dias);
  await publicacao(a.orgId, chOk, 'SCHEDULED', em3dias);

  // org beta: ruído que NÃO pode aparecer no resumo da alfa
  for (let i = 0; i < 9; i++) await publicacao(b.orgId, chBeta, 'FAILED', hoje);

  const tz = 'America/Sao_Paulo';
  const res = await fetch(`${API}/v1/insights/summary?tz=${encodeURIComponent(tz)}`, {
    headers: a.auth,
  });
  const s = (await res.json()) as Record<string, any>;

  console.log('\n▸ contagens da organização alfa');
  check('responde 200', res.status === 200, s);
  check('fuso ecoado', s.timezone === tz, s.timezone);
  check('2 falhas', s.attention.failed === 2, s.attention);
  check('1 aguardando revisão', s.attention.needsReview === 1, s.attention);
  check('1 entrega parcial', s.attention.partial === 1, s.attention);
  check('1 canal pedindo ação', s.attention.channels.length === 1, s.attention.channels);
  check(
    'e é o canal certo, com o status certo',
    s.attention.channels[0]?.status === 'REFRESH_REQUIRED' &&
      s.attention.channels[0]?.name === 'Insta da loja',
    s.attention.channels,
  );
  check('total soma tudo (2+1+0+1+1)', s.attention.total === 5, s.attention.total);
  check('2 agendadas para hoje', s.today.scheduled === 2, s.today);
  check('2 publicadas hoje', s.today.published === 2, s.today);
  check('já operando (sem primeiro passo)', s.firstRun === null, s.firstRun);

  console.log('\n▸ semana por dia');
  check('7 posições', s.week.byDay.length === 7, s.week);
  check('hoje tem 2 agendadas', s.week.byDay[0] === 2, s.week.byDay);
  check('amanhã tem 1', s.week.byDay[1] === 1, s.week.byDay);
  check('depois de amanhã tem 0', s.week.byDay[2] === 0, s.week.byDay);
  check('em 3 dias tem 2', s.week.byDay[3] === 2, s.week.byDay);
  check('total da semana = 5', s.week.scheduled === 5, s.week);

  console.log('\n▸ isolamento por organização (o essencial num agregado)');
  check(
    'as 9 falhas da beta NÃO contaminam a alfa',
    s.attention.failed === 2,
    s.attention.failed,
  );
  check('o canal da beta não aparece', !JSON.stringify(s).includes('Beta'), s.attention.channels);

  const resB = await fetch(`${API}/v1/insights/summary?tz=${encodeURIComponent(tz)}`, {
    headers: b.auth,
  });
  const sb = (await resB.json()) as Record<string, any>;
  check('a beta vê as suas 9 falhas', sb.attention.failed === 9, sb.attention);
  check('e nenhuma revisão (que é da alfa)', sb.attention.needsReview === 0, sb.attention);

  console.log('\n▸ o payload não carrega conteúdo');
  check('nenhum texto de publicação vaza', !JSON.stringify(s).includes('SEGREDO_DO_TEXTO'));

  console.log('\n▸ fuso inválido');
  const ruim = await fetch(`${API}/v1/insights/summary?tz=Marte/Olympus`, {
    headers: a.auth,
  });
  check('fuso inválido vira 400', ruim.status === 400, ruim.status);

  console.log(
    falhas === 0
      ? `\n✓ e2e-insights: ${total} checks`
      : `\n✗ e2e-insights: ${falhas} de ${total} falharam`,
  );
  await sql.end();
  process.exit(falhas === 0 ? 0 : 1);
}

await main();
