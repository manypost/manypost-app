export const ALLOWED_LAYOUT_GAPS = new Set(['1', '2', '3', '4', '5', '6', '7', '8']);

export type BrandRuleMatch = { line: number; excerpt: string };

export function findInvalidLayoutGaps(text: string): BrandRuleMatch[] {
  const matches: BrandRuleMatch[] = [];
  const token = /\bgap(?:-[xy])?-(\d+(?:\.\d+)?|\[[^\]]+\])/g;

  for (const match of text.matchAll(token)) {
    const value = match[1]!;
    if (ALLOWED_LAYOUT_GAPS.has(value)) continue;
    matches.push({
      line: text.slice(0, match.index).split('\n').length,
      excerpt: match[0],
    });
  }

  return matches;
}

export const ALLOWED_GRADIENT_BLOCKS = new Set([
  'viz-active-bar',
  'viz-donut-segment',
  'viz-area-fill',
  'auth-grid',
  'cal-past',
]);

function withoutComments(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

export function findUnauthorizedGradients(file: string, text: string): BrandRuleMatch[] {
  const matches: BrandRuleMatch[] = [];
  const lines = withoutComments(text).split('\n');
  let cssBlock: string | null = null;

  lines.forEach((line, index) => {
    const opener = line.match(/^\s*(?:@utility\s+|\.)([\w-]+)\s*\{/);
    if (opener) cssBlock = opener[1]!;

    if (/(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/.test(line)) {
      const allowed = file === 'apps/web/src/app/globals.css' &&
        cssBlock !== null &&
        ALLOWED_GRADIENT_BLOCKS.has(cssBlock);
      if (!allowed) matches.push({ line: index + 1, excerpt: line.trim().slice(0, 120) });
    }

    if (line.includes('}')) cssBlock = null;
  });

  return matches;
}
