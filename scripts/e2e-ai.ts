/**
 * E2E de IA (SPEC_AI) — exercita a fatia inteira contra Postgres real e um **provedor de modelo
 * falso** que fala o protocolo de chat-completions. Nada de rede externa e nenhuma credencial
 * real: o que se prova aqui é a fiação (env → adapter → BudgetGuard → use-case → rota) e as
 * garantias que os testes unitários não alcançam por rodarem sem banco.
 *
 * Uso (com Postgres/Redis de teste de pé):
 *   TEST_DATABASE_URL=postgresql://... REDIS_URL=redis://... bun run scripts/e2e-ai.ts
 *
 * NUNCA aponte para o banco de desenvolvimento: o script cria organização e canal próprios.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { createE2EHuman } from './e2e-clerk';

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ defina TEST_DATABASE_URL apontando para um Postgres DESCARTÁVEL');
  process.exit(1);
}
if (!process.env.REDIS_URL) {
  console.error('✗ defina REDIS_URL apontando para um Redis DESCARTÁVEL');
  process.exit(1);
}

const API_PORT = Number(process.env.E2E_AI_PORT ?? 3198);
const MODEL_PORT = API_PORT + 1;
const API = `http://127.0.0.1:${API_PORT}`;

let passed = 0;
const failures: string[] = [];
function check(nome: string, condicao: boolean, detalhe?: unknown) {
  if (condicao) {
    passed++;
    console.log(`  ✓ ${nome}`);
  } else {
    failures.push(nome);
    console.error(`  ✗ ${nome}${detalhe === undefined ? '' : ` — ${JSON.stringify(detalhe)}`}`);
  }
}

// ---------------------------------------------------------------------------
// provedor de modelo falso — fala o protocolo, registra o que recebeu
// ---------------------------------------------------------------------------
const recebidos: { path: string; body: Record<string, unknown> }[] = [];
let respostaDoModelo = 'Legenda gerada pelo modelo de teste.';

/** PNG quadrado 191x191 válido — permite recortar todas as proporções sem ampliar. */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAL8AAAC/AQMAAACVJJ9FAAAAA1BMVEUqW3iVMYN9AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAG0lEQVRYw+3BMQEAAADCoPVPbQwfoAAAAADgbhKnAAHV6RVBAAAAAElFTkSuQmCC';
/** PNG cujo cabeçalho é legível, mas cujo stream foi truncado. */
const CORRUPT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAL8AAAC/CAYAAACv6g0GAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAEEklEQVR4nO3awW0EMQwEwYunU3Iik/05B38sgPXQf0H1NqghP/3s66hBB2vw+e8PcNQg8IOACMb8ICCCtD0gIILp+UFABHnwgoAIJu0BAREk6gQBEUzODwIiyJALBEQwE14QEEHWG0BABLPbA4Kdr4HFNhB8r9YA/A9cgjPwg8CPEPODgAim7QEBEaTnBwERzIMXBESQtAcERDBRJwiIIDk/CIhghlwgIIJMeEFABLPeAAIiyG4PCDpeA4ttD1yCM/CDwI8Q84OACKbtAQERpOcHARHMgxcERJC0BwREMFEnCIggOT8IiGCGXCAggkx4QUAEs94AAiLIbg8IOl4Di20PXIIz8IPAjxDzg4AIpu0BARGk5wcBEcyDFwREkLQHBEQwUScIiCA5PwiIYIZcICCCTHhBQASz3gACIshuDwg6XgOLbQ9cgjPwg8CPEPODgAim7QEBEaTnBwERzIMXBESQtAcERDBRJwiIIDk/CIhghlwgIIJMeEFABLPeAAIiyG4PCDpeA4ttD1yCM/CDwI8Q84OACKbtAQERpOcHARHMgxcERJC0BwREMFEnCIggOT8IiGCGXCAggkx4QUAEs94AAiLIbg8IOl4Di20PXIIz8IPAjxDzg4AIpu0BARGk5wcBEcyDFwREkLQHBEQwUScIiCA5PwiIYIZcICCCTHhBQASz3gACIshuDwg6XgOLbQ9cgjPwg8CPEPODgAim7QEBEaTnBwERzIMXBESQtAcERDBRJwiIIDk/CIhghlwgIIJMeEFABLPeAAIiyG4PCDpeA4ttD1yCM/CDwI8Q84OACKbtAQERpOcHARHMgxcERJC0BwREMFEnCIggOT8IiGCGXCAggkx4QUAEs94AAiLIbg8IOl4Di20PXIIz8IPAjxDzg4AIpu0BARGk5wcBEcyDFwREkLQHBEQwUScIiCA5PwiIYIZcICCCTHhBQASz3gACIshuDwg6XgOLbQ9cgjPwg8CPEPODgAim7QEBEaTnBwERzIMXBESQtAcERDBRJwiIIDk/CIhghlwgIIJMeEFABLPeAAIiyG4PCDpeA4ttD1yCM/CDwI8Q84OACKbtAQERpOcHARHMgxcERJC0BwREMFEnCIggOT8IiGCGXCAggkx4QUAEs94AAiLIbg8IOl4Di20PXIIz8IPAjxDzg4AIpu0BARGk5wcBEcyDFwREkLQHBEQwUScIiCA5PwiIYIZcICCCTHhBQASz3gACIshuDwg6XgOLbQ9cgjPwg8CPEPODgAim7QEBEaTnBwERzIMXBESQtAcERDBRJwiIIDk/CIhghlwgIIJMeEFABLPeAAIiyG4PCDpeA4ttD1yCM/CDwI8Q84OACKbtAQERpOcHARHMgxcERJC0BwREMFEnCIggOT8IiGCGXCAggkx4QUAEs94AAiLIbg8IOl4Di20PXIIz8IPAjxDzg4AIpu0BARGk5wcBEcyDFwREkLQHBEQwUScIiCA5PwiIYIZcICCCTHhBQASz3gACIshuDwg6XgOLbQ9cgjPwg8CPEPODgAim7QEBEaTnBwERzIMXBESQtAcERDBRJwiIIDk/CIhghlwgIIJMeEFABLPeAAIiyG4PCDpeA4ttD1yCM/CDwI8Q84OACKbtAQERpOcHARHMgxcERJC0BwREsD/X4BeYV9iDqMAASAAAAABJRU5ErkJggg==';
/** trocável pelo teste: o que o "provedor" devolve como imagem */
let respostaDeImagem: string | null = PNG_B64;

const modelo = Bun.serve({
  port: MODEL_PORT,
  fetch: async (req) => {
    const path = new URL(req.url).pathname;
    const body = (await req.json()) as Record<string, unknown>;
    recebidos.push({ path, body });

    if (path === '/images/generations') {
      return Response.json({
        data: [{ b64_json: respostaDeImagem, revised_prompt: 'um gato, luz quente' }],
      });
    }
    return Response.json({
      choices: [{ message: { content: respostaDoModelo } }],
      usage: { prompt_tokens: 123, completion_tokens: 45 },
    });
  },
});

const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

async function main() {
  const marca = Date.now();

  // organização, usuário, membership e sessão Clerk assinada — mesmo helper dos outros E2E
  const humano = await createE2EHuman('ia', API);
  const org = { id: humano.orgId };
  const user = { id: humano.userId };
  const [canal] = await sql<{ id: string }[]>`
    INSERT INTO channels (id, org_id, provider, external_id, name, scopes, token_enc, token_key_version)
    VALUES (gen_random_uuid(), ${org.id}, 'fake', ${`ext-${marca}`}, 'Canal de teste', '{}', '\\x00', 1)
    RETURNING id`;

  const authed = () => humano.auth;

  const post = (path: string, body: unknown) =>
    fetch(`${API}${path}`, { method: 'POST', headers: authed(), body: JSON.stringify(body) });

  // -------------------------------------------------------------------------
  console.log('\n▸ contrato OpenAPI');
  const openapi = (await (await fetch(`${API}/openapi.json`)).json()) as {
    paths?: Record<string, { post?: { parameters?: { in?: string; name?: string }[] } }>;
  };
  const imageParameters = openapi.paths?.['/v1/ai/image']?.post?.parameters ?? [];
  check(
    'Idempotency-Key é um header explícito no contrato',
    imageParameters.some(
      (parameter) =>
        parameter.in === 'header' && parameter.name?.toLowerCase() === 'idempotency-key',
    ),
    imageParameters,
  );

  // -------------------------------------------------------------------------
  // A IA é feature PAGA no gerenciado (`ai_caption` = Pro, `ai_multichannel_draft` = Premium)
  // e a franquia do Grátis é zero. A CI sobe esta fase com IS_SELF_HOSTED=false de propósito —
  // é o único modo em que o BudgetGuard é realmente imposto —, então a org de teste precisa
  // assinar como qualquer cliente. Antes de assinar ela prova o gate; em self-hosted não há
  // gate nenhum (DECISIONS §15) e o bloco é pulado.
  console.log('\n▸ IA é feature paga no gerenciado');
  const capPlano = (await (await fetch(`${API}/v1/capabilities`, { headers: authed() })).json()) as {
    plan: { enforced: boolean };
  };
  if (capPlano.plan?.enforced) {
    const barrado = await post('/v1/ai/caption', { brief: 'x', channelIds: [canal!.id] });
    const barradoBody = (await barrado.json()) as { title: string; extra?: { requiredTier?: string } };
    check('sem assinatura, caption responde 402', barrado.status === 402, barrado.status);
    check('com plan.feature_locked', barradoBody.title === 'plan.feature_locked', barradoBody);
    check('e diz qual plano libera', barradoBody.extra?.requiredTier === 'PRO', barradoBody);
  } else {
    console.log('  · self-hosted: nada é barrado por plano');
  }

  // assinatura Premium espelhada "como se" a Stripe tivesse mandado — nenhuma chamada externa;
  // o enforcement lê esta linha (subscriptions_org_ux garante 1 por org)
  await sql`
    INSERT INTO subscriptions (id, org_id, customer_id, subscription_id, tier, period, status, current_period_end)
    VALUES (gen_random_uuid(), ${org.id}, ${`cus_e2e_${marca}`}, ${`sub_e2e_${marca}`},
            'PREMIUM', 'MONTHLY', 'ACTIVE', now() + interval '30 days')`;

  // -------------------------------------------------------------------------
  console.log('\n▸ capacidades');
  const capRes = await fetch(`${API}/v1/capabilities`, { headers: authed() });
  const cap = (await capRes.json()) as {
    ai: {
      enabled: boolean;
      canDescribeImages: boolean;
      canGenerateImages: boolean;
      credits: { granted: number; remaining: number; enforced: boolean } | null;
    };
  };
  check('capabilities responde 200', capRes.status === 200, capRes.status);
  check('IA aparece habilitada', cap.ai?.enabled === true, cap.ai);
  check('o adapter declara que enxerga imagem', cap.ai?.canDescribeImages === true);
  check('o modelo de imagem opt-in habilita geração', cap.ai?.canGenerateImages === true);
  check('a franquia do plano aparece', (cap.ai?.credits?.granted ?? 0) > 0, cap.ai?.credits);
  const franquiaInicial = cap.ai!.credits!.remaining;

  // -------------------------------------------------------------------------
  console.log('\n▸ legenda');
  const capRes2 = await post('/v1/ai/caption', {
    brief: 'abrimos aos domingos das 9h às 14h',
    channelIds: [canal!.id],
    tone: 'acolhedor',
  });
  const legenda = (await capRes2.json()) as { variants: { channelId: string; text: string }[] };
  check('caption responde 200', capRes2.status === 200, legenda);
  check('devolve uma variação por canal', legenda.variants?.length === 1, legenda);
  check('o texto é o do modelo', legenda.variants?.[0]?.text === respostaDoModelo);

  const enviado = recebidos.at(-1)!;
  check('chamou o protocolo esperado', enviado.path === '/chat/completions', enviado.path);
  check(
    'o brief do usuário foi delimitado como DADO',
    String((enviado.body.messages as { content: string }[])[1]!.content).includes('<<<BRIEF'),
  );
  // o `max_tokens` que sai é o DA INSTALAÇÃO (`AI_MAX_OUTPUT_TOKENS`), nunca um teto derivado do
  // limite do canal: apertar por requisição corta modelo de raciocínio no meio da palavra, e o
  // tamanho por canal é garantido depois pelo `shortenTo` (design D7 — cenário mais abaixo).
  const tetoDaInstalacao = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 4000);
  check(
    'o teto de saída da instalação foi aplicado',
    Number(enviado.body.max_tokens) === tetoDaInstalacao,
    { enviado: enviado.body.max_tokens, esperado: tetoDaInstalacao },
  );

  // -------------------------------------------------------------------------
  console.log('\n▸ franquia (BudgetGuard)');
  const [balde] = await sql<{ granted: number; used: number; reserved: number }[]>`
    SELECT granted, used, reserved FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  check('o consumo foi confirmado no balde', balde!.used === 1, balde);
  check('nada ficou reservado em voo', balde!.reserved === 0, balde);

  const [grant] = await sql<
    { state: string; operation: string; input_tokens: number; output_tokens: number }[]
  >`SELECT state, operation, input_tokens, output_tokens FROM ai_grants WHERE org_id = ${org!.id}::uuid`;
  check('a reserva ficou COMMITTED', grant!.state === 'COMMITTED', grant);
  check('a operação foi atribuída', grant!.operation === 'ai.caption', grant);
  check(
    'os tokens reais do provedor foram gravados',
    grant!.input_tokens === 123 && grant!.output_tokens === 45,
    grant,
  );

  const cap2 = (await (await fetch(`${API}/v1/capabilities`, { headers: authed() })).json()) as {
    ai: { credits: { remaining: number } };
  };
  check('o saldo exposto caiu em 1', cap2.ai.credits.remaining === franquiaInicial - 1, {
    antes: franquiaInicial,
    depois: cap2.ai.credits.remaining,
  });

  // -------------------------------------------------------------------------
  console.log('\n▸ auditoria sem conteúdo');
  const auditoria = await sql<{ action: string; detail: unknown }[]>`
    SELECT action, detail FROM audit_log WHERE org_id = ${org!.id}::uuid AND action = 'ai.caption'`;
  check('a geração foi auditada', auditoria.length === 1, auditoria);
  check(
    'a auditoria não guarda prompt nem texto gerado',
    !JSON.stringify(auditoria).includes('domingos') &&
      !JSON.stringify(auditoria).includes(respostaDoModelo),
    auditoria,
  );

  // -------------------------------------------------------------------------
  console.log('\n▸ limite do canal é imposto DEPOIS do modelo');
  respostaDoModelo = 'palavra '.repeat(300); // o `fake` tem maxLength 5000? não: estoura o limite
  const longa = await post('/v1/ai/caption', { brief: 'x', channelIds: [canal!.id] });
  const longaBody = (await longa.json()) as { variants: { text: string; maxLength: number; shortened: boolean }[] };
  const v = longaBody.variants?.[0];
  check('resposta longa ainda responde 200', longa.status === 200, longaBody);
  check('o texto devolvido cabe no limite do canal', (v?.text.length ?? 0) <= (v?.maxLength ?? 0), {
    len: v?.text.length,
    max: v?.maxLength,
  });
  respostaDoModelo = 'Legenda gerada pelo modelo de teste.';

  // -------------------------------------------------------------------------
  // Regressão do defeito P0: a reescrita voltava CORTADA no limite do canal e o composer
  // substituía o editor com ela. Pedir "corrija a ortografia" num rascunho longo com o X
  // selecionado apagava centenas de caracteres sem avisar.
  console.log('\n▸ reescrita NÃO corta o texto da pessoa');
  const textoLongo = 'palavra '.repeat(300);
  respostaDoModelo = textoLongo;
  const rw = await post('/v1/ai/rewrite', {
    text: 'original',
    instructionId: 'fix_grammar',
    channelId: canal!.id,
  });
  const rwBody = (await rw.json()) as {
    text: string;
    maxLength: number | null;
    overLimit: boolean;
  };
  check('rewrite responde 200', rw.status === 200, rwBody);
  check(
    'devolve o texto INTEIRO, sem remover caractere',
    rwBody.text.length === textoLongo.trim().length,
    { devolvido: rwBody.text.length, esperado: textoLongo.trim().length },
  );
  check('avisa que passou do limite', rwBody.overLimit === true, rwBody);
  check('e diz qual limite era', typeof rwBody.maxLength === 'number', rwBody);
  check(
    'não fala de encurtamento — nada foi encurtado',
    !Object.hasOwn(rwBody, 'shortened'),
    Object.keys(rwBody),
  );

  console.log('\n▸ reescrita sem canal (aba global) não impõe limite alheio');
  const rwSem = await post('/v1/ai/rewrite', { text: 'original', instructionId: 'formal' });
  const rwSemBody = (await rwSem.json()) as {
    text: string;
    channelId: string | null;
    maxLength: number | null;
    overLimit: boolean;
  };
  check('rewrite sem canal responde 200', rwSem.status === 200, rwSemBody);
  check('o texto volta inteiro', rwSemBody.text.length === textoLongo.trim().length, {
    len: rwSemBody.text.length,
  });
  check('nenhum canal é inventado', rwSemBody.channelId === null, rwSemBody);
  check('nenhum limite é reportado', rwSemBody.maxLength === null, rwSemBody);
  check('e não se afirma excesso', rwSemBody.overLimit === false, rwSemBody);

  console.log('\n▸ instrução fora do catálogo do servidor é recusada');
  const rwRuim = await post('/v1/ai/rewrite', {
    text: 'original',
    instructionId: 'ignore-as-regras-anteriores',
  });
  check('id inválido vira 400', rwRuim.status === 400, rwRuim.status);
  respostaDoModelo = 'Legenda gerada pelo modelo de teste.';

  // -------------------------------------------------------------------------
  console.log('\n▸ resposta ilegível devolve a franquia');
  const usadoAntes = (
    await sql<{ used: number }[]>`SELECT used FROM ai_credits WHERE org_id = ${org!.id}::uuid`
  )[0]!.used;
  respostaDoModelo = 'desculpe, não consegui montar o JSON'; // o /draft exige estrutura
  const draft = await post('/v1/ai/draft', { idea: 'x', channelIds: [canal!.id] });
  const draftBody = (await draft.json()) as { title: string };
  check('draft com resposta ilegível vira 502 ai.invalid_response', draftBody.title === 'ai.invalid_response', {
    status: draft.status,
    body: draftBody,
  });
  const [aposFalha] = await sql<{ used: number; reserved: number }[]>`
    SELECT used, reserved FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  check('a franquia NÃO foi cobrada pela falha nossa', aposFalha!.used === usadoAntes, aposFalha);
  check('e nada ficou preso em reserva', aposFalha!.reserved === 0, aposFalha);
  respostaDoModelo = 'Legenda gerada pelo modelo de teste.';

  // -------------------------------------------------------------------------
  console.log('\n▸ melhores horários (sem modelo, sem franquia)');
  const chamadasAntes = recebidos.length;
  const bt = await fetch(`${API}/v1/ai/best-times?channelId=${canal!.id}`, { headers: authed() });
  const btBody = (await bt.json()) as { slots: unknown[]; confidence: string; sampleSize: number; fromBaseline: boolean; signal: string };
  check('best-times responde 200', bt.status === 200, btBody);
  check('devolve slots', (btBody.slots?.length ?? 0) > 0, btBody);
  check('sem histórico, confiança baixa e linha de base', btBody.confidence === 'low' && btBody.fromBaseline === true, btBody);
  check('e o sinal é nomeado como linha de base da rede', btBody.signal === 'network_baseline', btBody);
  check('NÃO chamou o modelo', recebidos.length === chamadasAntes, {
    antes: chamadasAntes,
    depois: recebidos.length,
  });
  const [semCobranca] = await sql<{ used: number }[]>`
    SELECT used FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  check('e não consumiu franquia', semCobranca!.used === usadoAntes, semCobranca);

  // -------------------------------------------------------------------------
  console.log('\n▸ geração de imagem: bytes validados, proveniência e custo próprio');
  const usadoAntesDaImagem = (
    await sql<{ used: number }[]>`SELECT used FROM ai_credits WHERE org_id = ${org!.id}::uuid`
  )[0]!.used;

  const img = await post('/v1/ai/image', { prompt: 'um gato no sofá', aspect: '9:16' });
  const imgBody = (await img.json()) as { media?: Record<string, unknown> };
  check('image responde 200', img.status === 200, imgBody);
  check('a mídia volta marcada como gerada', imgBody.media?.source === 'ai', imgBody.media);
  check('com mime real de imagem', String(imgBody.media?.mime).startsWith('image/'), imgBody.media);
  check(
    'com a proporção 9:16 exata nas dimensões reais',
    Number(imgBody.media?.width) * 16 === Number(imgBody.media?.height) * 9,
    imgBody.media,
  );

  const pedidoDeImagem = recebidos.at(-1)!;
  check('falou o dialeto de imagens', pedidoDeImagem.path === '/images/generations', pedidoDeImagem.path);
  check('pediu UMA imagem só', pedidoDeImagem.body.n === 1, pedidoDeImagem.body);
  check(
    'a PROPORÇÃO virou resolução no adapter (o core não manda pixel)',
    pedidoDeImagem.body.size === '1024x1792',
    pedidoDeImagem.body,
  );

  const [linhaMidia] = await sql<{ source: string; generation_prompt: string; generation_model: string }[]>`
    SELECT source, generation_prompt, generation_model FROM media WHERE id = ${String(imgBody.media?.id)}::uuid`;
  check('a proveniência foi gravada', linhaMidia?.source === 'ai', linhaMidia);
  check(
    'o prompt REVISADO é o guardado (foi ele que produziu a imagem)',
    linhaMidia?.generation_prompt === 'um gato, luz quente',
    linhaMidia,
  );
  check('e o modelo que a produziu', Boolean(linhaMidia?.generation_model), linhaMidia);

  const [aposImagem] = await sql<{ used: number }[]>`
    SELECT used FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  check(
    'uma imagem custa 5 créditos (classe própria, não a de texto)',
    aposImagem!.used === usadoAntesDaImagem + 5,
    { antes: usadoAntesDaImagem, depois: aposImagem!.used },
  );

  const auditoriaImg = await sql<{ detail: unknown }[]>`
    SELECT detail FROM audit_log WHERE org_id = ${org!.id}::uuid AND action = 'ai.image'`;
  check('a geração foi auditada', auditoriaImg.length === 1, auditoriaImg);
  check(
    'sem o prompt na auditoria',
    !JSON.stringify(auditoriaImg).includes('um gato'),
    auditoriaImg,
  );

  console.log('\n▸ a mesma Idempotency-Key não cobra duas vezes');
  const chave = `e2e-img-${marca}`;
  const idem = () =>
    fetch(`${API}/v1/ai/image`, {
      method: 'POST',
      headers: { ...authed(), 'idempotency-key': chave },
      body: JSON.stringify({ prompt: 'mesmo pedido', aspect: '1:1' }),
    });
  const chamadasAntesIdem = recebidos.length;
  const usadoAntesIdem = (
    await sql<{ used: number }[]>`SELECT used FROM ai_credits WHERE org_id = ${org!.id}::uuid`
  )[0]!.used;

  const primeira = await idem();
  const primeiraBody = (await primeira.json()) as { media?: { id?: string } };
  const segunda = await idem();
  const segundaBody = (await segunda.json()) as { media?: { id?: string } };

  check(
    'a segunda resposta declara replay do Redis',
    segunda.headers.get('idempotency-replayed') === 'true',
    Object.fromEntries(segunda.headers),
  );
  check('a repetição responde 200', segunda.status === 200, segundaBody);
  check(
    'e devolve a MESMA mídia',
    Boolean(primeiraBody.media?.id) && primeiraBody.media?.id === segundaBody.media?.id,
    { primeira: primeiraBody.media?.id, segunda: segundaBody.media?.id },
  );
  check('o provedor foi chamado uma vez só', recebidos.length === chamadasAntesIdem + 1, {
    chamadas: recebidos.length - chamadasAntesIdem,
  });
  const [aposIdem] = await sql<{ used: number }[]>`
    SELECT used FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  check('e cobrou 5 créditos uma vez só', aposIdem!.used === usadoAntesIdem + 5, {
    antes: usadoAntesIdem,
    depois: aposIdem!.used,
  });

  const conflito = await fetch(`${API}/v1/ai/image`, {
    method: 'POST',
    headers: { ...authed(), 'idempotency-key': chave },
    body: JSON.stringify({ prompt: 'corpo diferente', aspect: '1:1' }),
  });
  const conflitoBody = (await conflito.json()) as { title?: string };
  check(
    'mesma chave com outro corpo é conflito',
    conflito.status === 409 && conflitoBody.title === 'common.idempotency_conflict',
    { status: conflito.status, body: conflitoBody },
  );

  console.log('\n▸ bytes que não são imagem falham e devolvem a franquia');
  respostaDeImagem = btoa('<html>erro do proxy</html>');
  const usadoAntesDoLixo = (
    await sql<{ used: number }[]>`SELECT used FROM ai_credits WHERE org_id = ${org!.id}::uuid`
  )[0]!.used;
  const lixo = await post('/v1/ai/image', { prompt: 'x', aspect: '1:1' });
  const lixoBody = (await lixo.json()) as { title: string };
  check('resposta que não é imagem vira ai.invalid_response', lixoBody.title === 'ai.invalid_response', {
    status: lixo.status,
    body: lixoBody,
  });
  const [aposLixo] = await sql<{ used: number; reserved: number }[]>`
    SELECT used, reserved FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  check('a franquia NÃO foi cobrada', aposLixo!.used === usadoAntesDoLixo, aposLixo);
  check('e nada ficou reservado', aposLixo!.reserved === 0, aposLixo);

  console.log('\n▸ imagem com cabeçalho válido e stream truncado também falha fechado');
  respostaDeImagem = CORRUPT_PNG_B64;
  const pngCorrompido = await post('/v1/ai/image', { prompt: 'x', aspect: '9:16' });
  const pngCorrompidoBody = (await pngCorrompido.json()) as { title: string };
  check(
    'PNG corrompido vira ai.invalid_response',
    pngCorrompidoBody.title === 'ai.invalid_response',
    { status: pngCorrompido.status, body: pngCorrompidoBody },
  );
  const [aposPngCorrompido] = await sql<{ used: number; reserved: number }[]>`
    SELECT used, reserved FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  check(
    'PNG corrompido também devolve a franquia',
    aposPngCorrompido!.used === usadoAntesDoLixo && aposPngCorrompido!.reserved === 0,
    aposPngCorrompido,
  );
  respostaDeImagem = PNG_B64;

  // -------------------------------------------------------------------------
  console.log('\n▸ escopo por organização');
  const outroCanal = randomUUID();
  const alheio = await post('/v1/ai/caption', { brief: 'x', channelIds: [outroCanal] });
  check('canal de outra org é 404', alheio.status === 404, alheio.status);

  // -------------------------------------------------------------------------
  console.log('\n▸ nenhuma credencial vaza numa falha do provedor');
  modelo.stop(true); // derruba o "modelo" para forçar falha de transporte
  const semModelo = await post('/v1/ai/caption', { brief: 'x', channelIds: [canal!.id] });
  const semModeloBody = (await semModelo.json()) as Record<string, unknown>;
  const texto = JSON.stringify(semModeloBody);
  check('falha do provedor vira ai.provider_failed', semModeloBody.title === 'ai.provider_failed', semModeloBody);
  check('a resposta não carrega a chave configurada', !texto.includes('nao-e-uma-chave-real'), texto);
  check('a resposta não carrega o endereço do provedor', !texto.includes(String(MODEL_PORT)), texto);

  // --- limpeza ---
  await sql`DELETE FROM ai_grants WHERE org_id = ${org!.id}::uuid`;
  await sql`DELETE FROM ai_credits WHERE org_id = ${org!.id}::uuid`;
  await sql`DELETE FROM audit_log WHERE org_id = ${org!.id}::uuid`;
  // a geração de imagem cria mídia: sem apagá-la, a FK barra a remoção da organização
  await sql`DELETE FROM media WHERE org_id = ${org!.id}::uuid`;
  await sql`DELETE FROM channels WHERE org_id = ${org!.id}::uuid`;
  await sql`DELETE FROM subscriptions WHERE org_id = ${org!.id}::uuid`;
  await sql`DELETE FROM memberships WHERE org_id = ${org!.id}::uuid`;
  await sql`DELETE FROM auth_identities WHERE user_id = ${user!.id}::uuid`;
  await sql`DELETE FROM users WHERE id = ${user!.id}::uuid`;
  await sql`DELETE FROM organizations WHERE id = ${org!.id}::uuid`;
}

try {
  await main();
} catch (err) {
  console.error('\n✗ erro inesperado:', err);
  failures.push('exceção não tratada');
} finally {
  await sql.end();
  try {
    modelo.stop(true);
  } catch {
    // já parado no último cenário
  }
}

console.log(`\n${failures.length === 0 ? '✓' : '✗'} e2e-ai: ${passed} checks`);
if (failures.length > 0) {
  console.error(`falhas:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
