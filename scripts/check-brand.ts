/**
 * Lint de conformidade com o brand system no apps/web
 * (critérios de aceite de docs/brand/README.md §4 + SPEC_FRONTEND §5.7):
 *  1. nenhum hex fora de src/app/globals.css
 *  2. nenhuma classe de sombra (shadow-…, drop-shadow-…) — exceto shadow-none
 *  3. nenhum translate/scale em hover (hover estável)
 *  4. radius só 4/6/8px (rounded-sm|md|lg|xl|full — full apenas em avatar)
 *  5. wordmark sempre `manypost` minúsculo em texto de UI
 *  6. nenhum tamanho de fonte arbitrário no regime compacto (< 16px) — a escala do
 *     design.md §6.3 existe como utility: text-calendar-hour/axis/meta/compact/panel
 *  7. animação contínua respeita `prefers-reduced-motion`
 *  8. `<button>` declara `cursor-pointer`
 *
 * As regras 6-8 entraram com o adendo `design.md §51` (2026-07-27). Elas fecham a distância entre
 * "passou no check:brand" e "está conforme a especificação": as três nasceram de defeitos reais
 * encontrados na revisão da fatia de IA, não de zelo abstrato.
 *
 * O que este script NÃO verifica está listado no `design.md §51.8` — de propósito, para ninguém
 * confundir estas oito regras com as vinte do §43.
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
  {
    // design.md §6.4 fixa 11px como piso e §43.20 proíbe valor fora dos tokens: as duas juntas
    // condenam o `text-[11px]` avulso. `.text-meta` existe para o papel "Metadado".
    // Só o REGIME COMPACTO (< 16px), onde a escala do §6.3 é normativa e as utilities existem
    // (text-calendar-hour/axis/meta/compact/panel + as do Tailwind). Acima de 16px vale o regime editorial do
    // §6.2, que usa `clamp()` e valor explícito de propósito — hero e títulos de marca.
    rule: 'tamanho de fonte arbitrário no regime compacto (use text-calendar-hour/axis/meta/compact/panel — design.md §6.3/§43.20)',
    re: /\btext-\[(?:\d|1[0-5])(?:\.\d+)?(?:px|rem|em)\]/,
    skip: (f) => !/\.tsx?$/.test(f),
  },
  {
    // design.md §46.12: animação contínua respeita reduced-motion. Um spinner que gira sob
    // redução de movimento é exatamente o caso que a regra existe para pegar.
    rule: 'animação contínua sem motion-reduce (design.md §46.12)',
    re: /\banimate-(?:spin|ping|pulse|bounce)\b(?![^"'`]*motion-reduce:animate-none)/,
    skip: (f) => !/\.tsx?$/.test(f),
  },
];

/**
 * `<button>` sem `cursor-pointer` (regra do brand: todo botão é clicável à vista).
 *
 * Fora do laço linha-a-linha porque uma tag de botão costuma ocupar várias linhas — verificar por
 * linha daria falso positivo em toda abertura de tag. Aqui o casamento é por TAG inteira.
 * `Button` do kit já traz o cursor no `buttonVariants`; a regra vale para o elemento cru.
 */
function checarCursorEmBotoes(file: string, text: string) {
  if (!/\.tsx$/.test(file)) return;
  for (const m of text.matchAll(/<button\b[^>]*>/gs)) {
    const tag = m[0];
    if (tag.includes('cursor-pointer') || tag.includes('cursor-')) continue;
    // `asChild`/`className={cn(...)}` com variável não é auditável por regex — só acusa o literal
    if (!tag.includes('className')) continue;
    const line = text.slice(0, m.index).split('\n').length;
    violations.push({
      file,
      line,
      rule: '<button> sem cursor-pointer (todo botão usa cursor: pointer)',
      excerpt: tag.split('\n')[0]!.trim().slice(0, 100),
    });
  }
}

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
  checarCursorEmBotoes(norm, text);
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} violação(ões) do brand system:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.rule}\n    ${v.excerpt}`);
  }
  process.exit(1);
}
console.log('✓ brand system ok (hex, sombras, hover, radius, wordmark, escala tipográfica, motion-reduce, cursor)');
