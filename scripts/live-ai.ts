/**
 * Smoke REAL contra o provedor de IA configurado (opt-in — NUNCA roda no CI).
 *
 * Prova o que o dublê de fetch não consegue: que o `AI_BASE_URL`, o `AI_MODEL` e a credencial
 * desta instalação realmente conversam, que a resposta chega no formato que o adapter lê, e
 * quantos tokens uma geração de verdade custa. Mesmo espírito de `live-telegram.ts`/`live-r2.ts`.
 *
 * Uso — com o `.env` já preenchido:
 *   bun run scripts/live-ai.ts
 *
 * Ou apontando na hora (a chave sai do seu shell e nunca é impressa):
 *   AI_PROVIDER=openai-compatible \
 *   AI_BASE_URL=https://api.fireworks.ai/inference/v1 \
 *   AI_MODEL=accounts/fireworks/models/deepseek-v4-pro \
 *   AI_API_KEY=$FIREWORKS_API_KEY \
 *   bun run scripts/live-ai.ts
 *
 * Este script NÃO toca no banco, não consome franquia e não publica nada: é só a ponta do
 * adapter. O caminho completo (franquia, plano, auditoria) é o `scripts/e2e-ai.ts`.
 */
import { aiConfigFromEnv, type Env } from '@manypost/config';
import { makeAiProvider, aiPrompts } from '@manypost/core';

// lê direto do process.env: o schema completo exigiria DATABASE_URL/Clerk, que não fazem
// falta aqui — este smoke não sobe aplicação nenhuma
const cru = {
  AI_PROVIDER: process.env.AI_PROVIDER ?? 'none',
  AI_BASE_URL: process.env.AI_BASE_URL,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS ?? 45_000),
  AI_MAX_OUTPUT_TOKENS: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 4000),
} as unknown as Env;

if (cru.AI_PROVIDER === 'none') {
  console.error('✗ AI_PROVIDER=none — configure um provedor antes (veja o .env.example)');
  process.exit(1);
}
for (const nome of ['AI_BASE_URL', 'AI_MODEL'] as const) {
  if (!cru[nome]) {
    console.error(`✗ ${nome} ausente — obrigatória com AI_PROVIDER=${cru.AI_PROVIDER}`);
    process.exit(1);
  }
}

const config = aiConfigFromEnv(cru)!;
const provider = makeAiProvider(config)!;

// eco da configuração SEM a credencial — o valor da chave nunca é impresso
console.log('configuração:');
console.log(`  protocolo        ${config.protocol}`);
console.log(`  base             ${config.baseUrl}`);
console.log(`  modelo           ${config.model}`);
console.log(`  chave            ${config.apiKey ? `presente (${config.apiKey.length} caracteres)` : 'ausente'}`);
console.log(`  teto de tempo    ${config.timeoutMs} ms`);
console.log(`  teto de saída    ${config.maxOutputTokens} tokens`);

// o MESMO prompt que a rota /v1/ai/caption usa — o que sai aqui é o que o usuário veria
const canal = { channelId: 'smoke', network: 'Instagram', maxLength: 2200 };
const brief = process.env.LIVE_AI_BRIEF ?? 'a cafeteria passa a abrir aos domingos, das 9h às 14h';

console.log('\ngerando uma legenda de verdade…\n');
const inicio = Date.now();

try {
  const { text, usage } = await provider.generateText({
    system: aiPrompts.captionSystem(),
    prompt: aiPrompts.captionPrompt({ brief, channel: canal, tone: 'acolhedor' }),
    maxTokens: 800,
  });

  console.log('─'.repeat(70));
  console.log(text);
  console.log('─'.repeat(70));
  console.log(`\n✓ funcionou em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
  console.log(`  tokens: ${usage.inputTokens} entrada + ${usage.outputTokens} saída`);
  console.log(`  tamanho: ${text.length} caracteres (limite do canal simulado: ${canal.maxLength})`);

  // a capacidade opcional que decide se o "Descrever com IA" aparece na biblioteca de mídia
  console.log(
    `\n  descrever imagem: ${provider.describeImage ? 'o adapter suporta' : 'não suportado neste protocolo'}` +
      ' — se o MODELO não enxergar imagem, a chamada falha e o alt text vira 501',
  );
} catch (err) {
  const e = err as { code?: string; message?: string; detail?: Record<string, unknown> };
  console.error(`\n✗ falhou: ${e.code ?? 'erro'} — ${e.message ?? String(err)}`);
  if (e.detail) console.error(`  detalhe: ${JSON.stringify(e.detail)}`);
  console.error(
    '\n  dicas: 401/403 = chave errada para esta base; 404 = AI_BASE_URL sem o caminho certo' +
      ' (ex.: falta /v1); 400 = nome do modelo inválido para este provedor.',
  );
  process.exit(1);
}
