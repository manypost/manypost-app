# docs/brand — identidade visual do manypost

[← Índice da documentação](../README.md) · [BRAND_SYSTEM.md](BRAND_SYSTEM.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [README do projeto](../../README.md)

> **Fonte da verdade visual:** [BRAND_SYSTEM.md](BRAND_SYSTEM.md) (especificação) e [BRAND_SYSTEM.html](BRAND_SYSTEM.html) (guia renderizado — abra no navegador). **Todo trabalho de frontend segue esses dois arquivos.** Este README é a avaliação técnica e o guia de adaptação da marca (escrita para landing/Astro) para o **app** (Next.js + shadcn/ui — SPEC_FRONTEND).

## 1. Avaliação

### Pontos fortes (acima da média para um brand system)
1. **Contraste WCAG documentado por token** — cada cor traz a razão de contraste e a regra de uso (`--accent` 5,7:1 sobre branco pode ser texto; `--accent-on-dark` para fundo escuro; `--mist` proibido para texto legível). Isso elimina a maior fonte de bugs de acessibilidade e casa com o critério "Lighthouse a11y ≥ 95" da SPEC_FRONTEND.
2. **Regras binárias fáceis de automatizar**: zero sombras (`box-shadow: none`), zero `translateY` no hover, wordmark sempre minúsculo, radius em 3 níveis (4/6/8px), espaçamento múltiplo de 4/8px. Todas viram lint/review checklist.
3. **Tipografia dupla bem delimitada** (Plus Jakarta Sans = display/marca; Inter = UI/dados) com escala completa e pesos definidos.
4. **Sistema de botões fechado** (3 tamanhos × 5 variantes) que mapeia 1:1 para variantes do shadcn `<Button>`.
5. Os dois arquivos são **consistentes entre si** (mesmos hex, mesmas regras).

### Lacunas para o APP (a marca foi escrita para landing pages)
| # | Lacuna | Impacto | Resolução |
|---|---|---|---|
| G1 | **Sem cores semânticas de estado** (sucesso/erro/alerta/info) | O app vive de estados de publicação (rascunho→agendado→publicando→publicado/falha/needs-review — SPEC_QUEUE §4) | Extensão proposta no §3 abaixo — **precisa do aval do owner** antes de codar UI |
| G2 | **Light-first, sem dark mode** (só "momento dark" decorativo) | SPEC_FRONTEND previa dark nativo | Spec ajustada: app é **light-only** na v1 (coerente com a marca); dark é backlog e exigirá extensão do brand system |
| G3 | **Densidade de landing** (seções 88px, cards 32px de padding, grids de marketing) | Kanban, calendário e tabelas precisam de densidade de aplicativo | Regra de adaptação no §2: tokens e regras valem; métricas de espaçamento de seção NÃO se aplicam a telas densas |
| G4 | **Fontes via Google Fonts CDN** | Performance + privacidade (LGPD) no app | Self-host via `next/font` com as mesmas famílias/pesos |
| G5 | Componentes descritos para Astro (`<Button />` .astro) | App usa shadcn/ui | Tema shadcn no §2 traduz os tokens; os nomes de variantes da marca são preservados |

### Alinhamento marca ↔ roadmap (RESOLVIDO em DECISIONS v1.1 + [PLANS.md](../principal/PLANS.md))
- **Análise de concorrentes / benchmarking** (BRAND §1.C) → confirmado pelo owner como feature do produto; **código aberto no monorepo** (gates no SaaS em v2+), entra na matriz de planos quando pronta (PLANS PL4). Marketing do MVP não a promete.
- **Papéis Criador/Revisor/Gestor + histórico** (BRAND §1.D) → workspaces/permissões/auditoria do **plano Premium no SaaS** (monorepo 100% aberto, v3); núcleo comunitário tem OWNER/ADMIN/MEMBER + aprovação de 1 estágio.
- **Links públicos de aprovação de cliente sem login** (BRAND §1.D) → **✅ aprovado para o núcleo AGPL** (DECISIONS v1.1 §12), gate Pro+ no gerenciado; fase 1 do roadmap.
- **Colunas do kanban** na marca (Ideação, Rascunho, Em Revisão, Aprovado pelo Cliente, Agendado, Publicado): mapeamento v1 — Ideação+Rascunho → `DRAFT`; Em Revisão → aguardando aprovação (interna ou por link público); Aprovado pelo Cliente → resultado do link público; Agendado → `SCHEDULED`; Publicado → `PUBLISHED` (+ coluna Falhou, que a marca omite mas o app precisa). "Kanban básico" do plano Grátis: definição pendente (PLANS PL2).

## 2. Adaptação para o app (Next.js + shadcn/ui + Tailwind)

- **Tokens**: as CSS vars do BRAND_SYSTEM entram em `globals.css` como estão; o tema shadcn referencia elas (`--background: var(--surface)`, `--foreground: var(--ink)`, `--primary: var(--accent)`, `--muted: var(--surface-2)`, `--border: var(--line)`, `--radius: 8px` com botões/inputs em 6px e badges em 4px).
- **Zero sombras**: sobrescrever as shadows padrão do shadcn (popover, dropdown, dialog, card) por `border: 1px solid var(--line)` + camadas de `--surface-2`. Nenhum componente entra com `shadow-*`.
- **Hover estável**: proibido `translate`/`scale` em hover — só transição de `background-color/border-color/color` 0.2s (regra da marca; vira regra de lint de classe Tailwind).
- **Botões**: `primary|enterprise|outline|ghost|link` × `sm|md|lg` exatamente como BRAND §6 (11/13/15px, radius 6px).
- **Densidade do app** (substitui as métricas de landing): páginas com padding 24px; cards de app com padding 16–24px; linhas de tabela/lista 40–48px; gaps 8/12/16/24px — sempre múltiplos de 4/8 (princípio da marca preservado, escala reduzida).
- **Fontes**: `next/font` self-hosted — Inter 400/500/600/700 e Plus Jakarta Sans 600/700/800.
- **Wordmark**: `manypost` sempre minúsculo (UI, `<title>`, e-mails, docs). Logo: mark 500×500 roxo em `public/images/logo.png`, 28px no header com wordmark ao lado.

## 3. Tokens semânticos de estado (✅ APROVADO — promovido ao BRAND_SYSTEM.md §3.1 em 2026-07-10)

Seguindo a filosofia da paleta (tons -700 que passam AA como texto sobre branco + tint de fundo; nada neon; hierarquia por borda/fundo, não sombra):

```css
:root {
  /* rascunho: neutro (usa --graphite / --surface-2 existentes) */
  --state-scheduled:       #7C3AED;  /* = --accent: "nas mãos do sistema" */
  --state-scheduled-tint:  #EDE9FE;  /* = --accent-tint */
  --state-publishing:      #B45309;  /* âmbar 700 — 4,7:1 sobre branco */
  --state-publishing-tint: #FEF3C7;
  --state-published:       #15803D;  /* verde 700 — 4,8:1 */
  --state-published-tint:  #DCFCE7;
  --state-failed:          #B91C1C;  /* vermelho 700 — 5,9:1 */
  --state-failed-tint:     #FEE2E2;
  --state-review:          #A16207;  /* needs-review/aguardando aprovação — 4,6:1 */
  --state-review-tint:     #FEF9C3;
}
```

Uso: badge/chip de estado = `tint` de fundo + cor como texto/borda (padrão `.badge` da marca, radius 4px). A mesma paleta serve para toasts de sucesso/erro. **A versão oficial vive no BRAND_SYSTEM.md §3.1** — em divergência, ele vence.

## 4. Critérios de aceite de conformidade (entram no CI/review do web)

1. Nenhum hex fora de `globals.css` (lint: cores só via token).
2. Nenhum `shadow-*`/`box-shadow` e nenhum `translate`/`scale` em hover (lint de classes).
3. Radius apenas 4/6/8px (e `9999px` só em avatar).
4. Fontes só Inter/Plus Jakarta Sans via `next/font`.
5. Wordmark minúsculo em 100% das ocorrências (grep no CI: `Manypost|MANYPOST` proibidos em UI/docs voltados a usuário).
6. Screenshot test das telas principais comparado após mudanças de tema.

---

**Navegação:** [Índice da documentação](../README.md) · [BRAND_SYSTEM.md](BRAND_SYSTEM.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [STATUS](../principal/STATUS.md) · [README do projeto](../../README.md)
