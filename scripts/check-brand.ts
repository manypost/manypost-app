/**
 * Lint de conformidade com o brand system no apps/web
 * (critérios de aceite de docs/brand/README.md §4 + SPEC_FRONTEND §5.7):
 *  1. nenhum hex fora de src/app/globals.css
 *  2. nenhuma classe de sombra (shadow-…, drop-shadow-…) — exceto a sombra nomeada do tooltip
 *  3. nenhum translate/scale em hover (hover estável)
 *  4. radius por função em 4/5/8/10/11/12px; rounded-full apenas em pills, avatares e pontos
 *  5. wordmark sempre `manypost` minúsculo em texto de UI
 *  6. nenhum tamanho de fonte arbitrário no regime compacto (< 16px) — a escala do
 *     design.md §6.3 existe como utility: calendar-hour-label e text-axis/meta/compact/panel
 *  7. animação contínua respeita `prefers-reduced-motion`
 *  8. `<button>` declara `cursor-pointer`
 *  9. nenhuma classe de relevo por gradiente (bevel-*, inset-field) — brand v1.4
 * 10. nenhum token de relevo (--edge-*, --bevel-*) — brand v1.4
 * 11. gradientes somente em utilities/contextos nomeados de visualização — brand v2.0
 * 12. escala tipográfica do produto sem utilities cruas xs/sm/base/lg
 * 13. pesos do produto limitados a normal/medium/semibold
 * 14. labels do produto em sentence case, sem uppercase
 * 15. borda tracejada apenas em alvos de drop nomeados
 * 16. gaps de layout na escala fechada 4/8/12/16/20/24/28/32px
 * 17. nenhuma margem negativa corretiva em layout
 * 18. rounded-full restrito ao Avatar e a pontos de estado pequenos
 *
 * As regras 6-8 entraram com o adendo `design.md §51` (2026-07-27). Elas fecham a distância entre
 * "passou no check:brand" e "está conforme a especificação": as três nasceram de defeitos reais
 * encontrados na revisão da fatia de IA, não de zelo abstrato.
 *
 * As regras 9-11 entraram com a brand v1.4 (`adopt-flat-visual-system`). Elas existem porque a
 * remoção do relevo é fácil de desfazer sem querer: uma classe `bevel-` sobrevivente vira código
 * morto silencioso, e um `linear-gradient(180deg, …)` escrito à mão reinventa o efeito sem usar o
 * nome. Regra em CI é o que impede a v1.3 de voltar por descuido — e a decisão de trazê-la de volta
 * de propósito continua possível: basta remover estas regras junto, o que torna a escolha explícita.
 *
 * O que este script NÃO verifica está listado no `design.md §51.8` — de propósito, para ninguém
 * confundir estas dezoito regras, mais o check estrutural de cursor, com as vinte do §43.
 */
import { Glob } from 'bun';
import { findInvalidLayoutGaps, findUnauthorizedGradients } from './brand-rules';

const WEB_SRC = 'apps/web/src';
const HEX_ALLOWED = new Set(['apps/web/src/app/globals.css']);
const GENERATED = [/[\\/]schema\.d\.ts$/];
const NON_UI_SOURCE = [/\.test\.[cm]?[jt]sx?$/];
const TOOLTIP_SHADOW_PATHS = new Set([
  'apps/web/src/app/globals.css',
  'apps/web/src/components/ui/tooltip.tsx',
]);
const FULL_RADIUS_ROLE_PATHS = new Set([
  'apps/web/src/components/shell/topbar.tsx',
  'apps/web/src/components/ui/avatar.tsx',
  'apps/web/src/features/kanban/kanban-card.tsx',
]);
const PROVIDER_PREVIEW_TYPOGRAPHY = new Set([
  'apps/web/src/features/composer/network-preview.tsx',
]);
const UPPERCASE_EDITORIAL_PATHS = [
  /apps\/web\/src\/app\/\(auth\)\//,
  /apps\/web\/src\/features\/auth\//,
  /apps\/web\/src\/features\/billing\/onboarding-view\.tsx$/,
];
const DASHED_DROP_TARGETS = new Set([
  'apps/web/src/features/kanban/kanban-column.tsx',
  'apps/web/src/features/media/upload-zone.tsx',
]);
const WHITE_LILAC_LAYOUT_PATHS = [
  /apps\/web\/src\/components\/shell\//,
  /apps\/web\/src\/features\/(?:home|kanban)\//,
  /apps\/web\/src\/app\/\(app\)\//,
];

type Violation = { file: string; line: number; rule: string; excerpt: string };
const violations: Violation[] = [];

const RULES: Array<{ rule: string; re: RegExp; skip?: (file: string) => boolean }> = [
  {
    rule: 'hex fora de globals.css (use tokens do brand)',
    re: /#[0-9a-fA-F]{3,8}\b/,
    skip: (f) =>
      HEX_ALLOWED.has(f) ||
      NON_UI_SOURCE.some((re) => re.test(f)) ||
      !/\.(tsx?|css)$/.test(f),
  },
  {
    rule: 'sombra fora do tooltip (superfícies persistentes não usam relevo)',
    re: /\b(?:drop-|inset-|text-)?shadow-(?!none\b)[[\w]/,
    skip: (f) => TOOLTIP_SHADOW_PATHS.has(f) || NON_UI_SOURCE.some((re) => re.test(f)),
  },
  {
    rule: 'box-shadow fora do token do tooltip',
    re: /box-shadow\s*:(?!\s*none)/,
    skip: (f) => TOOLTIP_SHADOW_PATHS.has(f) || NON_UI_SOURCE.some((re) => re.test(f)),
  },
  {
    rule: 'transform em hover proibido (hover estável — BRAND §2.3)',
    re: /hover:-?(?:translate|scale|rotate)/,
  },
  {
    rule: 'radius fora da escala 4/5/8/10/11/12 (BRAND §4)',
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
    // (calendar-hour-label + text-axis/meta/compact/panel + as do Tailwind). Acima de 16px vale o regime editorial do
    // §6.2, que usa `clamp()` e valor explícito de propósito — hero e títulos de marca.
    rule: 'tamanho de fonte arbitrário no regime compacto (use calendar-hour-label ou text-axis/meta/compact/panel — design.md §6.3/§43.20)',
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
  {
    // brand v1.4: as classes deixaram de existir. Uma sobrevivente não quebra nada — só não faz
    // nada, e fica no código parecendo intencional. Melhor falhar o CI que acumular resíduo.
    rule: 'classe de relevo removida na brand v1.4 (superfície é fill + borda)',
    re: /\bbevel-(?:primary|enterprise|outline|destructive|surface|ink|accent|chip)\b|\binset-field\b/,
  },
  {
    // idem para os tokens; sem exceção para o globals.css, que é justamente de onde saíram
    rule: 'token de relevo removido na brand v1.4 (use --line/--line-strong e as camadas de fundo)',
    re: /--(?:edge-light|edge-dark|bevel-gloss|bevel-lift)\b/,
  },
  {
    // A linha com `font-display` pertence ao regime editorial. O preview de provider é uma exceção
    // representacional nomeada: normalizar a tipografia simulada reduziria a fidelidade do post.
    rule: 'escala tipográfica crua em superfície de produto (use text-axis/meta/compact/panel/title/figure)',
    re: /^(?!.*\bfont-display\b).*\btext-(?:xs|sm|base|lg)\b/,
    skip: (f) => !/\.tsx?$/.test(f) || NON_UI_SOURCE.some((re) => re.test(f)) || PROVIDER_PREVIEW_TYPOGRAPHY.has(f),
  },
  {
    rule: 'peso bold em superfície de produto (use medium para labels ou semibold para títulos/ativos)',
    re: /^(?!.*\bfont-display\b).*\bfont-(?:bold|extrabold|black)\b/,
    skip: (f) => !/\.tsx?$/.test(f) || NON_UI_SOURCE.some((re) => re.test(f)) || PROVIDER_PREVIEW_TYPOGRAPHY.has(f),
  },
  {
    rule: 'uppercase em superfície de produto (use sentence case)',
    re: /(?<!first-letter:)\buppercase\b/,
    skip: (f) =>
      !/\.tsx?$/.test(f) ||
      NON_UI_SOURCE.some((re) => re.test(f)) ||
      UPPERCASE_EDITORIAL_PATHS.some((re) => re.test(f)),
  },
  {
    rule: 'borda tracejada fora de alvo de drop (estado vazio não promete arraste)',
    re: /\bborder-dashed\b/,
    skip: (f) => DASHED_DROP_TARGETS.has(f),
  },
  {
    rule: 'margem negativa corretiva em layout (agrupe os elementos)',
    re: /(?:^|[\s"'`])-(?:m|mt|mr|mb|ml|mx|my)-[^\s"'`]+/,
    skip: (f) => !/apps\/web\/src\/(?:features|app\/\(app\)|components\/shell)\//.test(f),
  },
  {
    rule: 'rounded-full fora de busca pill, avatar ou ponto de estado pequeno',
    re: /^(?!.*\bsize-(?:1|1\.5|2|2\.5|3)\b).*\brounded-full\b/,
    skip: (f) =>
      /apps\/web\/src\/components\/ui\/avatar\.tsx$/.test(f) ||
      FULL_RADIUS_ROLE_PATHS.has(f) ||
      /\.(?:test|spec)\.[jt]sx?$/.test(f) ||
      /apps\/web\/src\/app\/globals\.css$/.test(f),
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
  if (WHITE_LILAC_LAYOUT_PATHS.some((re) => re.test(norm)) && !NON_UI_SOURCE.some((re) => re.test(norm))) {
    for (const match of findInvalidLayoutGaps(text)) {
      violations.push({
        file: norm,
        line: match.line,
        rule: 'gap fora da escala fechada de layout (use 1/2/3/4/5/6/7/8)',
        excerpt: match.excerpt,
      });
    }
  }
  if (!NON_UI_SOURCE.some((re) => re.test(norm))) {
    for (const match of findUnauthorizedGradients(norm, text)) {
      violations.push({
        file: norm,
        line: match.line,
        rule: 'gradiente fora de utility/contexto nomeado de visualização',
        excerpt: match.excerpt,
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} violação(ões) do brand system:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.rule}\n    ${v.excerpt}`);
  }
  process.exit(1);
}
console.log('✓ brand system ok (19 checks: tokens, superfície, tipografia, framing, spacing, radius, motion e cursor)');
