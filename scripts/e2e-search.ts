/**
 * E2E da busca (`GET /v1/search`) e dos campos novos do feed.
 *
 *   E2E_CLERK_PRIVATE_KEY_FILE=... DATABASE_URL=postgresql://... BASE_URL=http://127.0.0.1:3199 \
 *     bun run scripts/e2e-search.ts
 *
 * NUNCA aponte para o banco de desenvolvimento: o script cria organizações e posts próprios.
 *
 * **Por que existe.** Os testes de rota usam um repositório falso, então nenhum deles toca no SQL —
 * e foi exatamente ali que estava o defeito: o `ilike` cru não dobra acento, então "lancamento" não
 * achava "Lançamento", enquanto a paleta já dobrava acento nas telas e nos canais. A busca
 * pareceria quebrada justamente para quem digita rápido, sem acento. Este script pega essa classe
 * de erro, e mais duas que só aparecem contra o banco: vazamento entre organizações num `where`
 * esquecido, e valor de consulta com aspas ou `%` mudando o significado da instrução.
 */
import postgres from 'postgres';
import { createE2EHuman } from './e2e-clerk';

const API = process.env.BASE_URL!;
const sql = postgres(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} });
let ok = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${nome}${extra ? ` — ${extra}` : ''}`);
  if (cond) ok++; else process.exitCode = 1;
};

const alfa = await createE2EHuman('search-alfa');
const beta = await createE2EHuman('search-beta');

const semear = async (orgId: string, texto: string, publishAt: string | null) => {
  const id = crypto.randomUUID();
  await sql`insert into post_groups (id, org_id, base_content, publish_at, timezone, state, origin)
    values (${id}::uuid, ${orgId}::uuid, ${sql.json({ text: texto })}, ${publishAt}::timestamptz,
            'UTC', 'DRAFT', 'WEB')`;
  return id;
};

await semear(alfa.orgId, 'Lançamento da nova versão do produto', null);
await semear(alfa.orgId, 'promoção de VERÃO com desconto', new Date().toISOString());
await semear(beta.orgId, 'Lançamento confidencial da beta', null);

const get = (h: typeof alfa, qs: string) => fetch(`${API}/v1/search?${qs}`, { headers: h.auth });

console.log('\n▸ busca de posts');
let r = await get(alfa, 'q=lancamento');
check('200 autenticado', r.status === 200);
type Hit = { text: string; state: string; publishAt: string | null; channels: unknown[] };
const lerHits = async (res: Response) => ((await res.json()) as { items: Hit[] }).items;
let body = { items: await lerHits(r) };
check('encontra o post', body.items.some((i) => i.text.includes('Lançamento da nova')));
check('NÃO vaza o post da outra organização', !body.items.some((i) => i.text.includes('confidencial')));
check('rascunho (sem horário) vem primeiro', body.items[0]?.publishAt === null);
check('devolve só os campos declarados', Object.keys(body.items[0]!).sort().join(',') === 'channels,groupId,publishAt,state,text');

r = await get(alfa, 'q=PROMOÇÃO');
body = { items: await lerHits(r) };
check('ILIKE ignora caixa e acento do dado', body.items.some((i) => i.text.includes('promoção')));

console.log('\n▸ isolamento e limites');
r = await get(beta, 'q=lancamento');
body = { items: await lerHits(r) };
check('a beta só vê o dela', body.items.length === 1 && body.items[0]!.text.includes('confidencial'));

check('sem sessão vira 401', (await fetch(`${API}/v1/search?q=lancamento`)).status === 401);
check('consulta de 1 char vira 400', (await get(alfa, 'q=a')).status === 400);
check('sem consulta vira 400', (await get(alfa, '')).status === 400);
check('limit acima do teto é RECUSADO (não cortado em silêncio)', (await get(alfa, 'q=lancamento&limit=99')).status === 400);

r = await get(alfa, 'q=lancamento&orgId=' + beta.orgId);
body = { items: await lerHits(r) };
check('orgId na query é IGNORADO, não obedecido', !body.items.some((i) => i.text.includes('confidencial')));

r = await get(alfa, "q=" + encodeURIComponent("%' or 1=1 --"));
body = { items: await lerHits(r) };
check('valor com aspas e % não injeta nem casa tudo', body.items.length === 0);

r = await get(alfa, 'q=inexistentexyz');
check('nada encontrado é 200 com lista vazia', r.status === 200 && ((await r.json()) as { items: unknown[] }).items.length === 0);

console.log('\n▸ campos novos do feed');
const feed = await fetch(`${API}/v1/publications?limit=5`, { headers: alfa.auth });
check('feed responde 200', feed.status === 200);
const fb = (await feed.json()) as { items: Array<Record<string, unknown>> };
check('FeedItem declara publishedAt', fb.items.length === 0 || 'publishedAt' in fb.items[0]!);
check('FeedItem declara updatedAt', fb.items.length === 0 || 'updatedAt' in fb.items[0]!);

console.log(`\n✓ e2e-search: ${ok} checks`);
await sql.end();
