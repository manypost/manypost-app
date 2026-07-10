/**
 * DECISIONS v1 §8 / SPEC_AI §2: nenhum provedor de IA nominal fora de infra/ai.
 * Uso: bun run scripts/check-ai-providers.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = /\b(openai|anthropic|gpt-\d|claude|gemini|mistral)\b/i;
const ALLOWED_PATHS = [
  /packages[\\/]core[\\/]src[\\/]infra[\\/]ai/,
  /apps[\\/]api[\\/]src[\\/]infra[\\/]ai/,
  // seleção do adapter via env (SPEC_AI §2): 'openai-compatible' é nome de protocolo
  /packages[\\/]config[\\/]src[\\/]env\.ts$/,
];
const ROOTS = ['apps', 'packages'];

const violations: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      if (ALLOWED_PATHS.some((p) => p.test(full))) continue;
      const content = readFileSync(full, 'utf8');
      const match = content.match(FORBIDDEN);
      if (match) violations.push(`${full}: "${match[0]}"`);
    }
  }
}

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // pasta ainda não existe na fase 0
  }
}

if (violations.length > 0) {
  console.error('Provedores de IA nominais fora de infra/ai (SPEC_AI §2):');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('check:ai-providers ok');
