# docs/brand — identidade visual do manypost

[← Índice da documentação](../README.md) · [BRAND_SYSTEM.md](BRAND_SYSTEM.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [README do projeto](../../README.md)

> **Fonte da verdade visual:** [`design.md`](../../design.md) contém o contrato completo e [BRAND_SYSTEM.md](BRAND_SYSTEM.md) o resumo oficial. **Todo trabalho de frontend segue esses arquivos e os tokens de `globals.css`.** O HTML histórico não prevalece sobre a v2.0.

## 1. Avaliação

### Pontos fortes (acima da média para um brand system)
1. **Contraste WCAG documentado por token** — cada cor traz a razão de contraste e a regra de uso (`--accent` 5,7:1 sobre branco pode ser texto; `--accent-on-dark` para fundo escuro; `--mist` proibido para texto legível). Isso elimina a maior fonte de bugs de acessibilidade e casa com o critério "Lighthouse a11y ≥ 95" da SPEC_FRONTEND.
2. **Regras binárias fáceis de automatizar**: sombra somente no tooltip, zero `translateY` no hover, wordmark sempre minúsculo, raios por função e espaçamento fechado. Todas viram lint/review checklist.
3. **Tipografia bem delimitada**: Inter em todo o produto autenticado; Plus Jakarta Sans somente em marketing, auth e onboarding.
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

- **Tokens**: as CSS vars do BRAND_SYSTEM entram em `globals.css`; o tema shadcn referencia as superfícies, texto, destaque e borda. Raios são definidos por papel: key `4px`, compact `5px`, tooltip `8px`, control `10px`, card `11px` e KPI `12px`.
- **Sistema branco/lilás v2.0**: canvas `#D9DBDD`, main `#FDFDFD`, superfícies brancas, KPIs lilás/azul, rail cinza-preto 181/64 e títulos Inter compactos. Superfícies persistentes não usam sombra; só o tooltip usa a sombra nomeada. Gradientes pertencem apenas a dados.
- **Hover estável**: proibido `translate`/`scale`/`rotate`, `filter: brightness()` e animação de entrada em superfícies operacionais. O hover transiciona `background-color`, `border-color` e `color` em 0.2s.
- **Cursor**: todo botão usa `cursor: pointer` (base do `<Button>`); `disabled` cai para `pointer-events: none`.
- **Botões**: `primary|outline|ghost|link|destructive` × `sm|md|lg`, com raio de controle de `10px` e ícones compactos.
- **Densidade do app** (substitui as métricas de landing): o shell limita a largura em `--container-app` ou `--container-wide`, descrições usam `--container-reading`, e gaps de layout usam 4/8/12/16/20/24/28/32px. Margens negativas não corrigem agrupamento.
- **Tipografia do produto**: utilities `text-axis|meta|compact|panel|title|figure` em 10/11/13/15/18/23px. Inter, peso máximo 600 e algarismos tabulares em dados comparáveis.
- **Shell e Quadro**: rail desktop 181/64; topbar de 59px no desktop e mobile. Busca/notificações/conta ficam na topbar. O Quadro usa uma superfície única com cinco lanes, divisores, cabeçalhos sticky e cards reais, nunca capacidade inventada.
- **Framing e raio**: raios por função em 4/5/8/10/11/12px; `rounded-full` apenas em busca pill, Avatar e pontos circulares.
- **Fontes**: `next/font` self-hosted — Inter 400/500/600 no produto e Plus Jakarta Sans apenas em auth, onboarding e marketing.
- **Wordmark**: `manypost` sempre minúsculo (UI, `<title>`, e-mails, docs). Logos SVG em `apps/web/public/images/`: `logo.svg` (completa, ícone + texto) e `logoSimplificada.svg` (mark quadrado). Header usa a completa via `Wordmark` (~28px de altura); espaços apertados usam a simplificada.

## 3. Tokens semânticos de estado (✅ APROVADO — promovido ao BRAND_SYSTEM.md §3.1 em 2026-07-10)

Seguindo a filosofia da paleta (tons -700 que passam AA como texto sobre branco + tint de fundo; nada neon; hierarquia por borda/fundo, não sombra):

```css
:root {
  /* rascunho: neutro (usa --graphite / --surface-2 existentes) */
  --state-scheduled:       #8B3CF0;  /* = --accent: "nas mãos do sistema" */
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

1. Nenhum hex fora de `globals.css`; gradientes apenas em utilities nomeadas de visualização.
2. Nenhum `shadow-*`/`box-shadow` fora do tooltip e nenhum `translate`/`scale`/`rotate` em hover.
3. Raios apenas nos papéis 4/5/8/10/11/12px; `rounded-full` só em busca, Avatar e pontos.
4. Produto sem escala tipográfica crua, bold ou uppercase; exceções editoriais e de preview são nomeadas.
5. Gaps na escala 4/8/12/16/20/24/28/32px, sem margem negativa corretiva; tracejado só em drop target.
6. Fontes só Inter/Plus Jakarta Sans via `next/font`; wordmark `manypost` minúsculo.
7. `bun run check:brand`, testes focados e inspeção visual das telas principais após mudanças de tema.

---

**Navegação:** [Índice da documentação](../README.md) · [BRAND_SYSTEM.md](BRAND_SYSTEM.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [STATUS](../principal/STATUS.md) · [README do projeto](../../README.md)
