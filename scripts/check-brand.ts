/**
 * Lint de conformidade com o brand system no apps/web
 * (critérios de aceite de docs/brand/README.md §4 + SPEC_FRONTEND §5.7):
 *  1. nenhum hex fora de src/app/globals.css
 *  2. nenhuma classe de sombra (shadow-…, drop-shadow-…) — exceto shadow-none
 *  3. nenhum translate/scale em hover (hover estável)
 *  4. radius só 4/6/8px (rounded-sm|md|lg|xl|full — full apenas em avatar)
 *  5. wordmark sempre `manypost` minúsculo em texto de UI
 */
import { Glob } from 'bun';

const WEB_SRC = 'apps/web/src';
const HEX_ALLOWED = new Set(['apps/web/src/app/globals.css']);
const GENERATED = [/[\\/]schema\.d\.ts$/];

type Violation = { file: string; line: number; rule: string; excerpt: string };
const violations: Violation[] = [];

const RULES: Array<{ rule: string; re: RegExp; skip?: (file: string) => boolean }> = [
  {
    rule: 'hex fora de globals.css (use tokens do brand)',
    re: /#[0-9a-fA-F]{3,8}\b/,
    skip: (f) => HEX_ALLOWED.has(f) || !/\.(tsx?|css)$/.test(f),
  },
  {
    rule: 'sombra proibida (zero sombras — BRAND §2.2)',
    re: /\b(?:drop-|inset-|text-)?shadow-(?!none\b)[[\w]/,
  },
  {
    rule: 'box-shadow proibido (zero sombras — BRAND §2.2)',
    re: /box-shadow\s*:(?!\s*none)/,
  },
  {
    rule: 'transform em hover proibido (hover estável — BRAND §2.3)',
    re: /hover:-?(?:translate|scale|rotate)/,
  },
  {
    rule: 'radius fora da escala 4/6/8 (BRAND §4)',
    re: /\brounded(?:-[trbl]|-[se])?-(?:xs|2xl|3xl|4xl|\[)/,
  },
  {
    rule: 'wordmark deve ser `manypost` minúsculo',
    re: /Manypost|ManyPost|MANYPOST|manyPost/,
  },
];

const glob = new Glob(`${WEB_SRC}/**/*.{ts,tsx,css,json}`);
for await (const file of glob.scan('.')) {
  const norm = file.replaceAll('\\', '/');
  if (GENERATED.some((re) => re.test(norm))) continue;
  const text = await Bun.file(file).text();
  const lines = text.split('\n');
  for (const { rule, re, skip } of RULES) {
    if (skip?.(norm)) continue;
    lines.forEach((content, i) => {
      if (re.test(content)) {
        violations.push({ file: norm, line: i + 1, rule, excerpt: content.trim().slice(0, 120) });
      }
    });
  }
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} violação(ões) do brand system:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.rule}\n    ${v.excerpt}`);
  }
  process.exit(1);
}
console.log('✓ brand system ok (hex/sombras/hover/radius/wordmark)');
