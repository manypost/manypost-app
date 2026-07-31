---

title: "manypost — Sistema de Design: especificação de implementação"
version: "4.0"
language: "pt-BR"
audience:

* "Product Design"
* "Frontend"
* "QA"
  scope:
* "marketing"
* "aplicativo"
* "analytics"
  updated_at: "2026-07-31"

---

# manypost — Sistema de Design: especificação de implementação

> Especificação técnica e normativa para implementar a linguagem visual da `manypost` em marketing, produto e analytics.
>
> Este documento define o que deve ser construído, quais regras são obrigatórias, onde exceções são permitidas e como validar a implementação.

---

## 0. Status e objetivo

### Status

Esta versão é a **fonte normativa vigente** para mocks e implementação. O mock aprovado do Quadro
define a composição visual de referência; dados ou destinos fictícios gerados no mock não definem
capacidade do produto.

| Item                     | Definição                                                                        |
| ------------------------ | -------------------------------------------------------------------------------- |
| Público                  | Product Design, Frontend e QA                                                    |
| Aplicação                | Landing pages, aplicativo, analytics e superfícies técnicas locais               |
| Fonte de verdade         | Tokens, regras de componentes e critérios de aceite deste documento              |
| Fora da fonte de verdade | Mockups isolados, valores copiados manualmente e estilos locais não documentados |

### Objetivo

O sistema deve produzir interfaces:

* editoriais e técnicas;
* visualmente silenciosas;
* legíveis em cenários densos;
* consistentes entre marketing e produto;
* previsíveis em todos os estados de interação;
* implementáveis sem valores arbitrários.

### Resultado esperado

Ao concluir a implementação:

1. os componentes devem consumir tokens semânticos ou tokens de componente;
2. os estados de interação devem seguir um comportamento único em toda a aplicação;
3. marketing, aplicativo e analytics devem compartilhar a mesma identidade, com densidades adequadas a cada contexto;
4. exceções devem estar registradas e justificadas;
5. as telas devem passar pelos critérios de acessibilidade, responsividade e QA definidos neste documento.

---

## 1. Escopo

### 1.1 Incluído

Esta especificação cobre:

* tokens de cor, tipografia, espaçamento, raio, borda, elevação e movimento;
* layouts de marketing e shell do aplicativo;
* componentes de ação, formulário, navegação, exibição de dados, feedback e overlay;
* padrões de analytics e visualização de dados;
* responsividade;
* acessibilidade;
* governança, lint, QA e critérios de aceite.

### 1.2 Fora do escopo

Esta especificação não define:

* arquitetura de backend;
* modelo de dados;
* contratos de API;
* regras de negócio da plataforma;
* framework frontend ou biblioteca de gráficos;
* conteúdo final de cada tela;
* tema escuro global;
* API pública dos componentes.

Esses itens devem ser especificados em documentos próprios. Quando afetarem o comportamento visual, a decisão deve respeitar os tokens e as regras deste sistema.

---

## 2. Como interpretar os requisitos

Os termos abaixo são normativos:

| Termo           | Significado                                                            |
| --------------- | ---------------------------------------------------------------------- |
| **DEVE**        | Requisito obrigatório. A implementação não é aceita sem conformidade.  |
| **NÃO DEVE**    | Comportamento proibido.                                                |
| **PODE**        | Opção permitida em um contexto explicitamente indicado.                |
| **RECOMENDADO** | Direção preferencial. Uma alternativa exige justificativa documentada. |

### 2.1 Ordem de precedência

Em caso de conflito, aplicar esta ordem:

1. acessibilidade e usabilidade;
2. regra específica do componente;
3. token de componente;
4. token semântico do contexto;
5. token primitivo;
6. preferência visual local.

Uma regra específica pode restringir uma regra geral, mas não pode reduzir acessibilidade ou introduzir valores fora da arquitetura de tokens.

### 2.2 Modelo de decisão

Toda decisão de implementação deve ser classificada como:

* **regra global:** aplica-se a todos os contextos;
* **regra de contexto:** aplica-se somente a marketing, aplicativo, analytics ou dark técnico;
* **regra de componente:** aplica-se a um componente e seus estados;
* **exceção registrada:** desvio temporário ou específico, com justificativa, responsável e escopo.

---

## 3. Princípios e decisões globais

### 3.1 Identidade

* A marca deve ser escrita como `manypost`, sempre em minúsculas.
* O roxo principal deve ser `#7C3AED`.
* A interface deve usar `Inter`.
* Grandes títulos editoriais devem usar a fonte display definida nos tokens.
* Código, comandos e endpoints devem usar `JetBrains Mono`.
* O layout deve ser predominantemente alinhado à esquerda.
* O espaçamento deve seguir uma escala baseada em `4px`.

### 3.2 Hierarquia visual

* Branco e cinzas quase brancos devem dominar a interface.
* O roxo deve indicar ação principal, foco, seleção explícita ou dado primário.
* Cards persistentes não devem usar sombra.
* Hovers comuns devem usar mudança de fundo, texto ou borda neutra.
* Borda roxa não deve ser usada como hover genérico.
* Títulos de produto devem usar peso entre `500` e `600`.
* Peso `700` deve ficar restrito a labels pequenas, badges, kickers e CTAs de alta prioridade.
* Marketing deve usar mais espaço; o aplicativo deve usar densidade média e controlada.
* Analytics deve usar números tabulares, gráficos leves e no máximo duas cores fortes por visualização.
* Raios maiores devem ficar restritos aos componentes explicitamente definidos.
* Sombras só podem aparecer em camadas realmente flutuantes.

### 3.3 Regra de silêncio visual

Em cada região, apenas um dos sinais abaixo deve ser dominante:

1. contraste de texto;
2. diferença de superfície;
3. borda;
4. cor de marca;
5. elevação.

O mesmo elemento não deve combinar simultaneamente fundo forte, borda forte, cor de marca e sombra.

### 3.4 Padrões proibidos

A implementação não deve usar como padrão:

* borda roxa no hover de cards;
* peso `700` em títulos de produto;
* ícones grandes em caixas coloridas;
* badges para informações que podem ser texto simples;
* botões preenchidos para ações secundárias;
* gridlines visíveis sem necessidade analítica;
* pills em botões, cards ou tabs comuns;
* raios grandes em todos os componentes;
* múltiplas cores saturadas no mesmo gráfico;
* texto centralizado em cards de produto;
* elevação simultânea em menus, cards e previews;
* movimento, escala, salto ou glow em hover.

---

## 4. Arquitetura de tokens

O sistema passa a separar tokens em quatro camadas:

1. **Primitivos:** valores absolutos de cor, espaço, raio e tempo.
2. **Semânticos:** significado de uso, como `text-primary` ou `border-subtle`.
3. **Componente:** decisões locais, como `button-primary-bg`.
4. **Contexto:** marketing, app, analytics e dark técnico.

### 4.1 Regra de implementação

Componentes não devem consumir hexadecimais ou valores primitivos diretamente. Devem consumir tokens semânticos ou de componente.

```css
.mp-card {
  color: var(--mp-text-primary);
  background: var(--mp-bg-surface);
  border-color: var(--mp-border-subtle);
}
```

Evite:

```css
.mp-card {
  color: #111111;
  background: #ffffff;
  border-color: #e2e2e7;
}
```

---

## 5. Tokens de cor

### 5.1 Tokens primitivos

```css
:root {
  --mp-purple-600: #7C3AED;
  --mp-purple-700: #6D28D9;
  --mp-purple-300: #C4B5FD;
  --mp-purple-100: #EDE9FE;
  --mp-purple-050: #F5F3FF;

  --mp-neutral-1000: #0A0A0A;
  --mp-neutral-950: #111111;
  --mp-neutral-900: #1B1B1D;
  --mp-neutral-800: #262626;
  --mp-neutral-700: #45454A;
  --mp-neutral-600: #6B6B70;
  --mp-neutral-500: #8E8E96;
  --mp-neutral-400: #B4B4BC;
  --mp-neutral-300: #D6D6DF;
  --mp-neutral-250: #DEDEE5;
  --mp-neutral-200: #E7E7EC;
  --mp-neutral-150: #ECECF0;
  --mp-neutral-100: #F1F1F4;
  --mp-neutral-075: #F5F5F7;
  --mp-neutral-050: #F8F8FA;
  --mp-white: #FFFFFF;
}
```

### 5.2 Semânticos — marketing

```css
:root,
[data-mp-context="marketing"] {
  --mp-bg-canvas: var(--mp-white);
  --mp-bg-surface: var(--mp-white);
  --mp-bg-subtle: var(--mp-neutral-075);
  --mp-bg-muted: var(--mp-neutral-100);

  --mp-text-primary: var(--mp-neutral-950);
  --mp-text-secondary: var(--mp-neutral-600);
  --mp-text-tertiary: var(--mp-neutral-500);
  --mp-text-disabled: var(--mp-neutral-400);

  --mp-border-subtle: var(--mp-neutral-200);
  --mp-border-default: var(--mp-neutral-300);
  --mp-border-strong: var(--mp-neutral-700);

  --mp-accent: var(--mp-purple-600);
  --mp-accent-hover: var(--mp-purple-700);
  --mp-accent-soft: var(--mp-purple-050);
  --mp-accent-tint: var(--mp-purple-100);
  --mp-accent-on-dark: var(--mp-purple-300);
}
```

### 5.3 Tokens semânticos — aplicativo

```css
[data-mp-context="app"] {
  --mp-bg-canvas: #F5F3EF;
  --mp-bg-main: #F5F3EF;
  --mp-bg-surface: #FFFFFF;
  --mp-bg-subtle: #ECE9E4;
  --mp-bg-muted: #ECE9E4;
  --mp-bg-selected: #EDE9FE;

  --mp-text-primary: #111217;
  --mp-text-secondary: #686870;
  --mp-text-tertiary: #92929B;
  --mp-text-disabled: #B8B8C0;

  --mp-border-subtle: #DDD9D2;
  --mp-border-default: #DDD9D2;
  --mp-border-strong: #8D8882;

  --mp-sidebar: #111820;
  --mp-sidebar-hover: #1B2530;
  --mp-sidebar-text: #E8EDF2;
  --mp-sidebar-muted: #AAB4BF;

  --mp-accent: #7C3AED;
  --mp-accent-hover: #6D28D9;
  --mp-accent-soft: #F5F3FF;
  --mp-accent-tint: #EDE9FE;
}
```

> **Decisão:** o canvas do aplicativo é porcelana quente e as superfícies de trabalho permanecem
> brancas. O rail escuro é navegação, não tema escuro global. Hierarquia usa fill, divisores e espaço.

### 5.4 Estados semânticos

```css
:root {
  --mp-success: #15803D;
  --mp-success-soft: #ECFDF3;
  --mp-warning: #A16207;
  --mp-warning-soft: #FFFBEA;
  --mp-danger: #B91C1C;
  --mp-danger-soft: #FFF1F1;
  --mp-info: #2563EB;
  --mp-info-soft: #EFF6FF;

  --mp-state-scheduled: var(--mp-purple-600);
  --mp-state-scheduled-soft: var(--mp-purple-050);
  --mp-state-publishing: #B45309;
  --mp-state-publishing-soft: #FFF7E8;
  --mp-state-published: var(--mp-success);
  --mp-state-published-soft: var(--mp-success-soft);
  --mp-state-failed: var(--mp-danger);
  --mp-state-failed-soft: var(--mp-danger-soft);
  --mp-state-review: var(--mp-warning);
  --mp-state-review-soft: var(--mp-warning-soft);
}
```

### 5.5 Paleta analítica

A visualização de dados pode usar uma segunda cor forte somente para diferenciar séries. Essa cor não passa a fazer parte da paleta principal da marca.

```css
:root {
  --mp-chart-primary: #7C3AED;
  --mp-chart-primary-soft: #D8CEF4;
  --mp-chart-secondary: #14B8A6;
  --mp-chart-secondary-soft: #CCFBF1;
  --mp-chart-blue: #8FB3E8;
  --mp-chart-green: #65C982;
  --mp-chart-track: #ECECF0;
  --mp-chart-grid: #F1F1F4;
  --mp-chart-tooltip: #111217;
}
```

Regras:

* no máximo duas cores fortes por gráfico;
* série primária sempre roxa;
* série secundária preferencialmente teal;
* demais séries usam variações neutras ou tons suaves;
* verde semântico não deve ser confundido com série analítica quando o gráfico também comunica sucesso/erro;
* não usar o teal fora de visualização de dados, salvo documentação específica.

### 5.6 Proporção visual

Em telas de produto:

* `72–82%` superfícies brancas ou quase brancas;
* `10–18%` superfícies sutis;
* `5–9%` texto e linhas;
* `2–4%` roxo;
* menos de `2%` outras cores fortes.

---

## 6. Tipografia

### 6.1 Famílias

```css
:root {
  --mp-font-display: "Degular Display", "Plus Jakarta Sans", sans-serif;
  --mp-font-ui: "Inter", system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  --mp-font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}
```

### 6.2 Escala editorial — marketing

| Papel          | Família |   Tamanho |  Peso | Line-height | Tracking |
| -------------- | ------- | --------: | ----: | ----------: | -------: |
| Hero H1        | Display |    `56px` | `500` |      `1.02` | `-0.5px` |
| Hero H1 mobile | Display |    `40px` | `500` |      `1.04` | `-0.4px` |
| H2 de destaque | Display | `40–48px` | `500` |      `1.05` | `-0.5px` |
| H2 de seção    | Display |    `32px` | `500` |       `1.1` | `-0.5px` |
| H3 editorial   | Inter   | `18–22px` | `600` |      `1.25` | `-0.2px` |
| Lead           | Inter   |    `18px` | `400` |       `1.6` |      `0` |
| Corpo          | Inter   | `14–16px` | `400` |       `1.6` |      `0` |

### 6.3 Escala de produto

| Papel            |   Tamanho |      Peso | Line-height | Cor padrão        |
| ---------------- | --------: | --------: | ----------: | ----------------- |
| Título de página |    `32px` |     `600` |      `1.15` | primary/display   |
| Saudação da Home |    `44px` |     `600` |      `1.08` | primary/display   |
| Título de painel | `15–16px` |     `500` |      `1.35` | primary           |
| Título de card   | `14–16px` | `500–600` |      `1.35` | primary           |
| Navegação        |    `13px` | `450–500` |      `18px` | primary/secondary |
| Label de campo   |    `13px` |     `500` |      `18px` | primary           |
| Corpo de produto | `13–14px` |     `400` |       `1.5` | secondary         |
| Metadado         | `11–12px` | `400–500` |       `1.4` | tertiary          |
| Eixo de gráfico  | `10–11px` |     `400` |      `14px` | tertiary          |
| Badge            |    `11px` |     `600` |         `1` | contextual        |
| KPI label        |    `12px` | `450–500` |      `16px` | primary           |
| KPI value        | `22–24px` |     `500` |       `1.1` | primary           |

### 6.4 Regras tipográficas

* Peso `700` não deve ser usado em títulos de produto.
* Peso `700` fica permitido somente no regime editorial de marketing/auth.
* Títulos de cards analíticos usam `500`, não `600–700`.
* Números de KPI usam tracking entre `-0.015em` e `-0.025em`.
* Dados numéricos usam `font-variant-numeric: tabular-nums`.
* Navegação não quebra linha.
* Texto auxiliar usa `text-secondary`; `text-tertiary` fica restrito a metadados não essenciais.
* Interface compacta não deve usar texto menor que `11px`.
* Texto principal nunca deve depender de cinza claro para parecer sutil.

```css
.mp-numeric {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
```

---

## 7. Espaçamento e densidade

### 7.1 Escala

```css
:root {
  --mp-space-1: 4px;
  --mp-space-2: 8px;
  --mp-space-3: 12px;
  --mp-space-4: 16px;
  --mp-space-5: 20px;
  --mp-space-6: 24px;
  --mp-space-7: 28px;
  --mp-space-8: 32px;
  --mp-space-10: 40px;
  --mp-space-12: 48px;
  --mp-space-16: 64px;
  --mp-space-20: 80px;
  --mp-space-22: 88px;
  --mp-space-24: 96px;
}
```

### 7.2 Modos de densidade

```css
:root {
  --mp-control-height-compact: 32px;
  --mp-control-height-default: 38px;
  --mp-control-height-comfortable: 44px;

  --mp-row-height-compact: 36px;
  --mp-row-height-default: 44px;
  --mp-row-height-comfortable: 52px;
}
```

| Modo          | Uso                                                              |
| ------------- | ---------------------------------------------------------------- |
| `compact`     | tabelas densas, filtros secundários, calendário, listas técnicas |
| `default`     | uso geral do app                                                 |
| `comfortable` | formulários, onboarding, marketing e ações principais            |

### 7.3 Regras de composição

* padding padrão de card do app: `20px`;
* card complexo ou formulário: `24px`;
* card de marketing: `28–32px`;
* gap de ícone e texto: `8–10px`;
* gap entre controles relacionados: `8px`;
* gap entre cards: `20–24px`;
* distância entre título de card e conteúdo: `16–20px`;
* distância entre cabeçalho de página e primeira linha: `16–24px`;
* distância entre grupos da sidebar: `24–28px`;
* seções de marketing: `80–88px` no desktop.

### 7.4 Regra de consistência

Uma mesma tela deve usar no máximo dois modos de densidade. Exemplo: `default` no conteúdo e `compact` na toolbar. Não misture alturas arbitrárias como `34`, `37`, `41`, `46` e `50px` sem necessidade documentada.

---

## 8. Raios, bordas e elevação

### 8.1 Escala de raios

```css
:root {
  --mp-radius-xs: 4px;
  --mp-radius-sm: 6px;
  --mp-radius-md: 8px;
  --mp-radius-round: 999px;
}
```

### 8.2 Uso por componente

|    Raio | Uso                                                                           |
| ------: | ----------------------------------------------------------------------------- |
|   `4px` | badges, tags, keycaps, microindicadores                                       |
|   `6px` | botões, inputs, selects, tooltips pequenos                                    |
|   `8px` | cards, modais, dropdowns, previews e regiões externas                         |
| `999px` | avatar e pontos de estado pequenos; nunca card ou botão comum                 |

> **Decisão:** somente 4, 6 e 8px são raios de componente. `999px` é exceção exclusiva de avatar e dot.

### 8.3 Intensidade de bordas

```css
:root {
  --mp-border-width: 1px;
}

.mp-border-subtle { border: 1px solid var(--mp-border-subtle); }
.mp-border-default { border: 1px solid var(--mp-border-default); }
.mp-border-strong { border: 1px solid var(--mp-border-strong); }
```

Use:

* `subtle`: divisórias internas, cards estáticos e tabelas;
* `default`: inputs, cards interativos e containers;
* `strong`: hover de controle, drag target e contraste em superfícies próximas;
* `accent`: foco, seleção explícita, drop target ativo e validação.

### 8.4 Elevação

```css
:root {
  --mp-shadow-none: none;
}
```

Regras:

* `box-shadow`, `drop-shadow` e sombras de texto são proibidas em todo componente;
* flutuantes usam superfície branca e `border-strong`;
* tooltip usa fundo escuro, e modal usa overlay, sem simular elevação.

---

## 9. Layout de marketing

### 9.1 Container

```css
.mp-container {
  width: min(100% - 80px, 1240px);
  margin-inline: auto;
}

@media (max-width: 900px) {
  .mp-container {
    width: calc(100% - 40px);
  }
}
```

### 9.2 Seções

```css
.mp-section {
  padding-block: 88px;
  border-bottom: 1px solid var(--mp-border-subtle);
}

.mp-hero {
  padding-top: 96px;
  padding-bottom: 80px;
}
```

### 9.3 Grids

```css
.mp-grid-2,
.mp-grid-3,
.mp-grid-4 {
  display: grid;
  gap: 24px;
  align-items: stretch;
}

.mp-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mp-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.mp-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
```

---

## 10. Shell do aplicativo

### 10.1 Estrutura recomendada

```text
AppShell
├── Sidebar
├── MainColumn
│   ├── MobileTopbar (abaixo de 768px)
│   └── MainContent
└── RightRail opcional
```

### 10.2 Dimensões

```css
:root {
  --mp-sidebar-width: 208px;
  --mp-sidebar-collapsed: 64px;
  --mp-topbar-height: 56px;
  --mp-right-rail-width: 280px;
  --mp-page-padding: 24px;
}
```

* sidebar de `208px` equilibra labels em português e preserva área útil do Quadro;
* o right rail só aparece quando houver conteúdo contextual persistente;
* o conteúdo principal não deve ficar artificialmente estreito para preservar o painel lateral;
* em demonstrações editoriais, o shell pode usar raio externo de `16px`, sem sombra; esse raio não deve ser aplicado ao shell do produto em produção sem necessidade documentada.

### 10.3 CSS-base

```css
.mp-app-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: var(--mp-sidebar-width) minmax(0, 1fr);
  background: var(--mp-bg-canvas);
  color: var(--mp-text-primary);
}

.mp-app-main {
  min-width: 0;
  background: var(--mp-bg-main);
}

.mp-app-content {
  padding: var(--mp-page-padding);
}
```

---

## 11. Sidebar

### 11.1 Estrutura visual

* fundo `sidebar` escuro;
* separador direito no próprio tom do rail;
* sem sombra;
* grupos separados por espaço, não por caixas;
* labels em `12–13px/500`, sem uppercase;
* itens com altura padrão de `36px`;
* ícones lineares de `16px` e stroke `1.5–1.75px`.

### 11.2 Item de navegação

```css
.mp-nav-item {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 10px;
  gap: 10px;
  border-radius: var(--mp-radius-lg);
  color: var(--mp-sidebar-muted);
  font-size: 13px;
  font-weight: 450;
  text-decoration: none;
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.mp-nav-item:hover {
  color: var(--mp-sidebar-text);
  background: var(--mp-sidebar-hover);
}

.mp-nav-item[aria-current="page"] {
  color: var(--mp-accent-on-dark);
  background: var(--mp-sidebar-hover);
  font-weight: 500;
}
```

### 11.3 Uso do roxo no item ativo

Por padrão, o item ativo não precisa de texto roxo nem borda roxa. O roxo pode aparecer em apenas um destes pontos:

* ícone ativo;
* microindicador lateral de `2px`;
* pequeno badge;
* item selecionado em navegação altamente complexa.

Não usar todos simultaneamente.

### 11.4 Subitens

* recuo de `28–36px` em relação ao label principal;
* sem ícone, salvo quando necessário para compreensão;
* mesma altura ou `32px` no modo compacto;
* texto truncado com reticências;
* não reduzir abaixo de `12px`.

### 11.5 Rodapé

* separador horizontal sutil;
* ações de configuração e saída com o mesmo padrão dos itens;
* conta do usuário em bloco simples, sem transformar em card elevado;
* avatar entre `24–28px`.

---

## 12. Topbar móvel e utilidades globais

### 12.1 Estrutura

No desktop não existe topbar persistente: busca global, notificações e conta pertencem à sidebar.
A topbar abaixo existe somente abaixo de `768px`.

```css
.mp-app-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: var(--mp-topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: 24px;
  background: var(--mp-bg-surface);
  border-bottom: 1px solid var(--mp-border-subtle);
}
```

### 12.2 Breadcrumb

* anterior em `text-tertiary`;
* atual em `text-primary/500`;
* divisor discreto;
* máximo de três níveis visíveis;
* truncar níveis longos, sem quebrar linha.

### 12.3 Busca compacta

* altura `32px`;
* largura padrão `180–240px`;
* raio `999px` é permitido somente na busca compacta da topbar;
* fundo branco;
* borda sutil;
* ícone `14px`;
* placeholder `12–13px`;
* keycap opcional com raio `4px`.

### 12.4 Ações

* icon buttons de `32px`;
* ícones `16px`;
* sem círculo visível em repouso;
* hover com fundo sutil;
* foco com ring roxo;
* notificações usam badge pequeno e não deslocam o layout.

---

## 13. Cabeçalho de página

```css
.mp-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.mp-page-title {
  margin: 0;
  font-family: var(--mp-font-display);
  font-size: 32px;
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.mp-page-description {
  max-width: 680px;
  margin: 6px 0 0;
  color: var(--mp-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
```

Regras:

* títulos sempre alinhados à esquerda;
* ações primárias à direita no desktop e abaixo no mobile;
* filtros de contexto simples não devem parecer CTAs;
* controle de período pode ser text button ou select compacto, sem fundo preenchido.

---

## 14. Botões

### 14.1 Base

```css
.mp-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--mp-radius-sm);
  font-family: var(--mp-font-ui);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    border-color 150ms ease,
    opacity 150ms ease;
}

.mp-button:focus-visible {
  outline: 2px solid var(--mp-accent);
  outline-offset: 2px;
}

.mp-button:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}
```

### 14.2 Tamanhos

```css
.mp-button--sm {
  height: 32px;
  padding-inline: 12px;
  font-size: 12px;
}

.mp-button--md {
  height: 38px;
  padding-inline: 16px;
  font-size: 13px;
}

.mp-button--lg {
  height: 44px;
  padding-inline: 24px;
  font-size: 14px;
  font-weight: 650;
}
```

### 14.3 Variantes

```css
.mp-button--primary {
  color: #fff;
  background: var(--mp-accent);
}

.mp-button--primary:hover {
  background: var(--mp-accent-hover);
}

.mp-button--secondary {
  color: var(--mp-text-primary);
  background: var(--mp-bg-surface);
  border-color: var(--mp-border-default);
}

.mp-button--secondary:hover {
  background: var(--mp-bg-subtle);
  border-color: var(--mp-border-strong);
}

.mp-button--ghost {
  color: var(--mp-text-secondary);
  background: transparent;
}

.mp-button--ghost:hover {
  color: var(--mp-text-primary);
  background: var(--mp-bg-subtle);
}

.mp-button--danger {
  color: #fff;
  background: var(--mp-danger);
}

.mp-button--link {
  height: auto;
  padding: 0;
  border: 0;
  color: var(--mp-accent);
  background: transparent;
}
```

### 14.4 Hierarquia de ações

* apenas uma ação primária por região;
* ação secundária usa `secondary` ou `ghost`;
* ações destrutivas não ficam preenchidas até que a intenção esteja clara;
* toolbar densa usa botões `sm` ou icon buttons;
* não usar botão roxo para filtros, ordenação, paginação ou período.

---

## 15. Icon buttons

```css
.mp-icon-button {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--mp-radius-sm);
  color: var(--mp-text-secondary);
  background: transparent;
}

.mp-icon-button:hover {
  color: var(--mp-text-primary);
  background: var(--mp-bg-subtle);
}

.mp-icon-button[aria-pressed="true"] {
  color: var(--mp-accent);
  background: var(--mp-accent-soft);
}
```

* ícone padrão `16px`;
* área clicável mínima `32px`, preferencialmente `38px` em ações importantes;
* todo icon button precisa de nome acessível;
* não adicionar borda circular decorativa em repouso.

---

## 16. Inputs e formulários

### 16.1 Campo-base

```css
.mp-input,
.mp-select,
.mp-textarea {
  width: 100%;
  border: 1px solid var(--mp-border-default);
  border-radius: var(--mp-radius-sm);
  background: var(--mp-bg-surface);
  color: var(--mp-text-primary);
  font: inherit;
  outline: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.mp-input,
.mp-select {
  height: 38px;
  padding-inline: 12px;
  font-size: 13px;
}

.mp-textarea {
  min-height: 104px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

.mp-input:hover,
.mp-select:hover,
.mp-textarea:hover {
  border-color: var(--mp-border-strong);
}

.mp-input:focus,
.mp-select:focus,
.mp-textarea:focus {
  border-color: var(--mp-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mp-accent) 12%, transparent);
}
```

### 16.2 Labels e mensagens

```css
.mp-field-label {
  display: block;
  margin-bottom: 7px;
  color: var(--mp-text-primary);
  font-size: 13px;
  font-weight: 500;
}

.mp-field-help,
.mp-field-error {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
}

.mp-field-help { color: var(--mp-text-secondary); }
.mp-field-error { color: var(--mp-danger); }
```

### 16.3 Estados

* `hover`: borda mais forte, sem roxo;
* `focus`: borda roxa + ring suave;
* `invalid`: borda vermelha + mensagem textual;
* `disabled`: fundo muted, texto disabled, cursor default;
* `readonly`: fundo subtle, texto primary, sem aparência desabilitada;
* placeholder nunca substitui label.

### 16.4 Busca

* busca de página: controle padrão com raio `6px`;
* busca compacta da topbar pode usar formato pill;
* botão de limpar só aparece com conteúdo;
* resultados e atalhos aparecem em dropdown flutuante.

---

## 17. Seletores, checkbox, radio e switch

### 17.1 Checkbox e radio

* caixa/círculo de `16px`;
* borda default em repouso;
* preenchimento roxo quando selecionado;
* foco por ring externo;
* label de `13px`;
* área clicável inclui label e padding vertical.

### 17.2 Switch

```css
.mp-switch {
  width: 36px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  background: var(--mp-border-strong);
}

.mp-switch[aria-checked="true"] {
  background: var(--mp-accent);
}
```

* knob de `16px`;
* movimento linear curto, sem bounce;
* usar apenas para efeito imediato;
* preferência que exige confirmação deve usar checkbox ou ação explícita.

---

## 18. Tabs e controles segmentados

### 18.1 Tabs lineares

```css
.mp-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--mp-border-subtle);
}

.mp-tab {
  position: relative;
  min-height: 38px;
  padding: 0;
  border: 0;
  color: var(--mp-text-tertiary);
  background: transparent;
  font-size: 13px;
  font-weight: 500;
}

.mp-tab[aria-selected="true"] {
  color: var(--mp-text-primary);
}

.mp-tab[aria-selected="true"]::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: -1px;
  height: 2px;
  background: var(--mp-accent);
}
```

### 18.2 Tabs compactas em cards analíticos

* podem não usar underline;
* ativo em `text-primary`, inativo em `text-tertiary`;
* separar grupos por divisor vertical sutil;
* não transformar cada tab em pill.

### 18.3 Controle segmentado

Usar apenas quando as opções alteram imediatamente a mesma visualização.

* fundo `bg-subtle`;
* padding externo `3px`;
* item ativo branco com borda sutil;
* sombra proibida;
* máximo recomendado de quatro opções.

---

## 19. Cards

### 19.1 Card-base do app

```css
.mp-card {
  border: 1px solid var(--mp-border-subtle);
  border-radius: var(--mp-radius-lg);
  background: var(--mp-bg-surface);
  box-shadow: none;
}

.mp-card__header {
  padding: 20px 20px 0;
}

.mp-card__content {
  padding: 20px;
}

.mp-card__title {
  margin: 0;
  color: var(--mp-text-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
}

.mp-card__description {
  margin: 5px 0 0;
  color: var(--mp-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
```

### 19.2 Card interativo

```css
.mp-card--interactive {
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.mp-card--interactive:hover {
  border-color: var(--mp-border-default);
  background: color-mix(in srgb, var(--mp-bg-surface) 96%, var(--mp-bg-subtle));
}

.mp-card--interactive[aria-selected="true"] {
  border-color: color-mix(in srgb, var(--mp-accent) 45%, var(--mp-border-default));
  background: var(--mp-accent-soft);
}
```

> **Regra obrigatória:** hover não deve usar borda roxa. O roxo deve aparecer apenas em foco, seleção explícita ou validação.

### 19.3 Card de marketing

* raio `8px`;
* padding `28–32px`;
* fundo branco ou `bg-subtle`;
* título `18–20px/600`;
* descrição `14–15px/1.6`;
* CTA discreto no rodapé;
* sem ícone colorido grande.

### 19.4 Princípios de conteúdo

* uma ideia principal por card;
* título de duas a seis palavras;
* descrição de uma a três linhas;
* ações secundárias não competem com o título;
* cards da mesma linha mantêm cabeçalho e rodapé alinhados;
* card vazio não deve parecer quebrado: usar empty state intencional.

---

## 20. Cards de KPI

### 20.1 Estrutura

```css
.mp-kpi-card {
  position: relative;
  min-height: 104px;
  padding: 20px;
  border: 0;
  border-radius: var(--mp-radius-xl);
  background: var(--mp-accent-soft);
}

.mp-kpi-card--blue {
  background: #EEF5FD;
}

.mp-kpi-card--neutral {
  background: var(--mp-bg-subtle);
}
```

### 20.2 Conteúdo

* label no topo esquerdo;
* valor em `22–24px/500`;
* variação pequena alinhada pela baseline;
* ícone opcional em caixa branca de `34px`, raio `10px`;
* sem borda e sem sombra;
* valor abreviado antes de reduzir fonte;
* nenhuma quebra de linha nos dados compactos.

### 20.3 Paleta

Em uma linha de três KPIs, usar no máximo:

* lilás suave;
* azul suave;
* neutro suave.

Não usar três cores saturadas nem semânticas conflitantes.

---

## 21. Badges, tags e status

### 21.1 Badge neutro

```css
.mp-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 3px 8px;
  border: 1px solid var(--mp-border-subtle);
  border-radius: var(--mp-radius-xs);
  color: var(--mp-text-secondary);
  background: var(--mp-bg-surface);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
```

### 21.2 Badge de destaque

```css
.mp-badge--accent {
  border-color: transparent;
  color: var(--mp-accent);
  background: var(--mp-accent-soft);
}
```

### 21.3 Status

* combinar cor suave, texto e opcionalmente dot;
* não usar uppercase obrigatório;
* status crítico pode usar borda contextual;
* nunca comunicar apenas por cor;
* não usar badge para metadado que pode ser texto simples.

---

## 22. Tabelas, listas e linhas

### 22.1 Estrutura

```css
.mp-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.mp-table th {
  height: 36px;
  padding: 0 12px;
  border-bottom: 1px solid var(--mp-border-subtle);
  color: var(--mp-text-tertiary);
  font-size: 11px;
  font-weight: 600;
  text-align: left;
}

.mp-table td {
  height: 44px;
  padding: 0 12px;
  border-bottom: 1px solid var(--mp-border-subtle);
  color: var(--mp-text-primary);
  font-size: 13px;
}

.mp-table tbody tr:hover td {
  background: var(--mp-bg-subtle);
}
```

### 22.2 Seleção

```css
.mp-table tbody tr[aria-selected="true"] td {
  background: var(--mp-accent-soft);
}
```

Quando for necessário um indicador adicional, usar pseudo-elemento lateral de `2px`; não usar sombra inset.

### 22.3 Regras de conteúdo

* números alinhados à direita quando comparáveis;
* números tabulares;
* primeira coluna preserva contexto e recebe mais largura;
* ações ficam ocultas até hover apenas quando continuam acessíveis por teclado;
* cabeçalho sticky precisa de fundo opaco;
* truncar texto com tooltip quando a informação completa for relevante;
* divisores verticais podem estruturar lanes paralelas quando a comparação horizontal é o propósito
  central, como no Quadro; não devem ser usados como ornamento em listas comuns.

### 22.4 Linhas de atividade

* avatar `24–28px`;
* texto principal `12–13px`;
* timestamp `11px` tertiary;
* sem card por item;
* separação por espaço ou linha sutil.

---

## 23. Filtros, ordenação e toolbar

### 23.1 Toolbar

```css
.mp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 16px;
}
```

### 23.2 Regras

* filtros usam selects `sm` ou botões secondary/ghost;
* filtro ativo pode usar `accent-soft`, nunca preenchimento roxo sólido;
* ordenar usa ícone e label compactos;
* botão “limpar filtros” aparece apenas quando necessário;
* chips de filtro têm raio `6px`, não pill exagerada;
* busca deve receber mais largura do que filtros individuais;
* toolbars não devem parecer uma segunda navegação principal.

### 23.3 Quadro editorial

O Quadro é a referência de densidade operacional do aplicativo. Em desktop, os cinco estados são
**lanes abertas** sobre o canvas quente, separados por regras verticais. A lane não recebe fundo,
raio ou moldura própria; somente o card é um objeto delimitado. O cabeçalho da lane é sticky, opaco
e contém ponto de estado, label e contagem real. Nunca exibir denominador de capacidade enquanto o
produto não possuir uma regra de capacidade.

Ordem do card: horário operacional, resumo, preview opcional, canal/conta e ações. Imagem usa o
primeiro media disponível em corte 4:3; vídeo usa tile neutro com play, sem carregar o player; sem
preview, nenhum espaço vazio é reservado. Falha mantém causa e retry visíveis. Em telas estreitas,
as lanes preservam largura legível e rolam horizontalmente. Filtros, densidade, seleção, drag e
ações mantêm a mesma semântica em qualquer breakpoint.

---

## 24. Menus, dropdowns e command palette

### 24.1 Dropdown

```css
.mp-menu {
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--mp-border-strong);
  border-radius: var(--mp-radius-md);
  background: var(--mp-bg-surface);
}

.mp-menu-item {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 0 9px;
  gap: 9px;
  border-radius: var(--mp-radius-sm);
  color: var(--mp-text-primary);
  font-size: 13px;
}

.mp-menu-item:hover,
.mp-menu-item[data-highlighted="true"] {
  background: var(--mp-bg-subtle);
}
```

### 24.2 Seções e atalhos

* label de grupo em `11px/600`, tertiary;
* separador sutil;
* keycap em `10–11px`, fundo muted, raio `4px`;
* ação destrutiva usa texto danger, sem fundo vermelho em repouso;
* item selecionado usa check ou ícone, não borda.

### 24.3 Command palette

* largura `560–640px`;
* input integrado ao topo;
* resultados com linhas de `40px`;
* grupos separados por espaço e labels;
* sombra floating permitida;
* overlay `rgba(10,10,10,.38)`;
* foco inicial no campo de busca.

---

## 25. Tooltip, popover e hover card

### 25.1 Tooltip

```css
.mp-tooltip {
  max-width: 240px;
  padding: 7px 9px;
  border-radius: var(--mp-radius-sm);
  color: #fff;
  background: var(--mp-chart-tooltip);
  box-shadow: var(--mp-shadow-tooltip);
  font-size: 11px;
  line-height: 1.35;
}
```

* atraso de abertura entre `300–500ms` para ícones comuns;
* sem tooltip em texto já explícito;
* não conter ações interativas.

### 25.2 Popover

* fundo branco;
* raio `10px`;
* borda sutil;
* sombra floating;
* padding `12–16px`;
* pode conter ações e formulário curto;
* fecha com Escape e clique externo.

---

## 26. Modais, drawers e overlays

### 26.1 Overlay

```css
.mp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 10, 0.42);
  animation: mp-fade-in 150ms ease-out;
}
```

### 26.2 Modal

```css
.mp-modal {
  width: min(100% - 32px, 560px);
  border: 1px solid var(--mp-border-subtle);
  border-radius: var(--mp-radius-md);
  background: var(--mp-bg-surface);
}

.mp-modal__header,
.mp-modal__footer {
  padding: 18px 20px;
}

.mp-modal__body {
  padding: 20px;
  border-block: 1px solid var(--mp-border-subtle);
}
```

### 26.3 Drawer

* largura `360–440px` no desktop;
* largura total no mobile;
* borda lateral sutil;
* sem card interno desnecessário;
* cabeçalho sticky apenas quando o conteúdo for longo;
* entrada com `translateX` curto, nunca spring.

### 26.4 Hierarquia de ações

* cancelar à esquerda ou antes da ação principal;
* ação principal no extremo direito;
* destruição exige confirmação clara;
* footer não deve conter mais de três ações.

---

## 27. Alertas, toasts e banners

### 27.1 Alert inline

* fundo semântico muito claro;
* ícone `16px`;
* título opcional `13px/600`;
* texto `12–13px`;
* raio `8px`;
* borda semântica discreta;
* não usar sombra.

### 27.2 Toast

```css
.mp-toast {
  width: min(360px, calc(100vw - 32px));
  padding: 12px 14px;
  border: 1px solid var(--mp-border-subtle);
  border-radius: var(--mp-radius-lg);
  background: var(--mp-bg-surface);
  box-shadow: var(--mp-shadow-floating);
}
```

* toast é flutuante, portanto pode usar sombra;
* empilhar com gap `8px`;
* sucesso simples pode desaparecer automaticamente;
* erro com ação não deve desaparecer rápido;
* progresso longo deve usar status persistente na interface, não sequência de toasts.

### 27.3 Banner

* largura total da região;
* sem sombra;
* borda inferior ou contorno sutil;
* usar para manutenção, conectividade, cobrança e alertas persistentes.

---

## 28. Empty states, loading e skeleton

### 28.1 Empty state

* largura de texto entre `320–440px`;
* título `15–18px/500`;
* descrição `13–14px` secondary;
* ícone monocromático `24–32px` ou pequena ilustração técnica;
* uma ação primária e no máximo uma secundária;
* não usar ilustração colorida grande por padrão.

### 28.2 Skeleton

```css
.mp-skeleton {
  border-radius: var(--mp-radius-xs);
  background: linear-gradient(
    90deg,
    var(--mp-bg-muted) 0%,
    var(--mp-bg-subtle) 50%,
    var(--mp-bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: mp-skeleton 1.4s linear infinite;
}
```

O gradiente do skeleton é funcional e pode ser usado. A animação deve respeitar `prefers-reduced-motion`.

### 28.3 Loading

* spinner apenas para ações locais e curtas;
* skeleton para estrutura conhecida;
* progress bar para duração mensurável;
* mensagem textual para operações longas;
* não bloquear a página inteira quando apenas um card está atualizando.

---

## 29. Gráficos e visualização de dados

### 29.1 Princípios gerais

* gráficos leves e sem moldura interna;
* cards brancos com borda sutil;
* título `15–16px/500`;
* eixos `10–11px` tertiary;
* gridlines ausentes ou quase invisíveis;
* linhas entre `1–1.5px`;
* apenas ponto ativo no hover;
* legendas compactas;
* tooltip escuro pequeno;
* sem 3D, glow ou sombra nas séries.

### 29.2 Gráfico de linhas

```css
.mp-chart-line-primary {
  stroke: var(--mp-chart-primary);
  stroke-width: 1.25;
}

.mp-chart-line-secondary {
  stroke: var(--mp-chart-secondary);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
```

* preenchimento sob a série primária pode usar opacidade máxima de `5%`;
* não mostrar marcadores em todos os pontos;
* usar quatro a cinco labels no eixo Y;
* reduzir labels do eixo X antes de rotacioná-las.

### 29.3 Barras

* largura de `12–24px` conforme densidade;
* raio `6–8px` apenas nas extremidades visíveis;
* trilha neutra opcional;
* uma barra pode ser destacada em roxo;
* outras barras ficam neutras ou em tom suave;
* não usar gradiente como padrão; permitido apenas em visualização editorial específica.

### 29.4 Rosca

* espessura moderada;
* gaps brancos de `3–5px`;
* segmento principal roxo;
* demais segmentos neutros ou suaves;
* centro pode conter valor, mas não repetir legenda completa;
* máximo recomendado de cinco segmentos.

### 29.5 Microbarras e sparklines

* altura `2–4px` para microbarras;
* sparkline sem eixo em contextos KPI;
* manter contraste suficiente;
* não usar mais de três cores por linha compacta.

### 29.6 Tooltip de dados

* fundo `chart-tooltip`;
* raio `6–8px`;
* padding `8–10px`;
* label `10px` muted;
* valor `12px/500` branco;
* números tabulares;
* sombra tooltip permitida.

### 29.7 Acessibilidade

* fornecer resumo textual ou tabela equivalente;
* não depender apenas de cor;
* foco e navegação por teclado quando o gráfico for interativo;
* contraste suficiente para séries e pontos ativos;
* respeitar redução de movimento.

---

## 30. Painel direito e conteúdo contextual

### 30.1 Uso

O right rail é apropriado para:

* notificações;
* atividade recente;
* contatos;
* propriedades do item selecionado;
* ajuda contextual;
* resumo de publicação.

Não usar como depósito permanente de ações secundárias.

### 30.2 Visual

* fundo branco;
* borda esquerda sutil;
* largura `260–300px`;
* padding `18–20px`;
* títulos `13px/500`;
* linhas densas de `40–50px`;
* avatares `20–24px`;
* timestamps `10–11px` tertiary;
* sem cards individuais por linha.

### 30.3 Responsividade

* ocultar ou transformar em drawer abaixo de `1200px` quando necessário;
* nunca comprimir o conteúdo principal abaixo de seu mínimo útil;
* preservar estado e scroll ao abrir como drawer.

---

## 31. Preview de produto na landing page

### 31.1 Moldura

```css
.mp-product-preview {
  overflow: hidden;
  border: 1px solid var(--mp-border-subtle);
  border-radius: var(--mp-radius-md);
  background: var(--mp-bg-surface);
}
```

### 31.2 Conteúdo

* toolbar entre `44–48px`;
* canvas interno quase branco;
* cards brancos com borda sutil;
* gaps de `12–16px`;
* sidebar entre `208–224px` quando proporcional;
* ícones `16px`;
* roxo em item ativo, dado principal ou ação;
* sem moldura de laptop 3D, perspectiva, brilho ou sombra forte.

### 31.3 Diferença entre preview e app real

O preview pode simplificar conteúdo, mas não deve inventar componentes inexistentes. A redução deve preservar:

* proporção;
* hierarquia;
* densidade;
* padrões de navegação;
* cor e tipografia;
* alinhamento dos cards.

---

## 32. Hero e componentes editoriais

### 32.1 Hero

```css
.mp-eyebrow {
  margin: 0 0 16px;
  color: var(--mp-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mp-hero h1 {
  max-width: 820px;
  margin: 0;
  font-family: var(--mp-font-display);
  font-size: 56px;
  font-weight: 500;
  line-height: 1.02;
  letter-spacing: -0.5px;
}

.mp-lead {
  max-width: 680px;
  margin: 24px 0 0;
  color: var(--mp-text-secondary);
  font-size: 18px;
  line-height: 1.6;
}
```

### 32.2 Cabeçalho editorial de seção

* H2 à esquerda;
* linha divisória flexível;
* número ou label da seção em roxo;
* margem inferior `40–48px`;
* em mobile, empilhar e manter linha horizontal.

### 32.3 Faixa de métricas

* três ou quatro colunas;
* números display `32–36px/500`;
* labels `12–13px` secondary;
* separadores de `1px`;
* sem ícones decorativos.

---

## 33. Blocos técnicos, código e dark local

### 33.1 Painel dark

```css
.mp-code-panel {
  overflow-x: auto;
  padding: 28px;
  border: 1px solid #262626;
  border-radius: var(--mp-radius-md);
  background: #111111;
  color: #FFFFFF;
  font-family: var(--mp-font-mono);
  font-size: 13px;
  line-height: 1.7;
}
```

### 33.2 Regras

* dark é contexto local, não tema global automático;
* roxo claro para chave ou ação;
* comentários em cinza;
* tabs técnicas lineares;
* botão de copiar ghost ou outline escuro;
* nenhuma sombra ou glow;
* grid técnico discreto permitido apenas em autenticação e blocos de infraestrutura.

---

## 34. Motion e interação

### 34.1 Tokens

```css
:root {
  --mp-duration-instant: 100ms;
  --mp-duration-fast: 150ms;
  --mp-duration-base: 200ms;
  --mp-duration-enter: 280ms;
  --mp-duration-auth: 550ms;

  --mp-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --mp-ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 34.2 Regras

* cor, fundo e borda: `150ms`;
* opacity: `100–150ms`;
* dropdown/popover: `150–200ms`;
* modal/drawer: `200–280ms`;
* entrada editorial ou autenticação: até `550ms`;
* hover nunca usa `translateY`, `scale`, bounce ou glow;
* movimento de switch e accordion é curto e previsível;
* não animar métricas a cada atualização se isso prejudicar leitura.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 35. Estados de interação

| Estado   | Tratamento padrão                                      |
| -------- | ------------------------------------------------------ |
| Rest     | superfície e borda semânticas do componente            |
| Hover    | fundo sutil ou borda mais forte; sem roxo automático   |
| Focus    | outline/ring roxo visível                              |
| Active   | leve redução de luminosidade, sem escala               |
| Selected | fundo accent-soft e, quando necessário, indicador roxo |
| Disabled | opacidade reduzida, contraste ainda legível            |
| Loading  | preservar largura e label sempre que possível          |
| Error    | texto + ícone + cor; nunca apenas cor                  |

### 35.1 Regra de prioridade

Quando um componente está selecionado e focado, o foco precisa continuar visível. Quando está inválido e focado, a mensagem de erro continua vermelha, mas o ring pode permanecer roxo ou usar danger conforme a biblioteca adotada; a decisão deve ser consistente globalmente.

---

## 36. Conteúdo e comportamento

### 36.1 Truncamento

* navegação: uma linha com reticências;
* cards: título pode usar até duas linhas; descrição até três em grids uniformes;
* tabelas: truncar colunas secundárias, preservar primeira coluna;
* tooltip oferece conteúdo completo quando necessário;
* ações não quebram linha.

### 36.2 Números

* usar abreviações `k`, `M` e `B` apenas quando o espaço exigir;
* manter precisão consistente entre itens comparáveis;
* percentuais usam sinal e unidade explícitos;
* valores monetários respeitam locale da interface;
* números comparáveis usam alinhamento tabular.

### 36.3 Datas e horários

* formato local em conteúdo de usuário;
* formato compacto em tabelas;
* timezone explícito em agendamentos críticos;
* tempo relativo pode aparecer com data absoluta em tooltip.

### 36.4 Microcopy

* ações usam verbos diretos;
* títulos não terminam com ponto;
* erros explicam o que aconteceu e o que fazer;
* empty states descrevem o próximo passo;
* evitar linguagem promocional dentro do app operacional.

---

## 37. Responsividade

### 37.1 Marketing — acima de `900px`

* container `1240px`;
* padding lateral `40px`;
* H1 `56px`;
* grids de duas a quatro colunas;
* seções de `88px`;
* formulário do hero inline.

### 37.2 Marketing — até `900px`

* padding lateral `20px`;
* H1 `40px`;
* grids em uma coluna;
* menu desktop vira menu móvel;
* métricas perdem divisores verticais;
* previews podem ganhar scroll horizontal controlado.

### 37.3 App — acima de `1200px`

* sidebar expandida;
* conteúdo principal flexível;
* right rail opcional;
* grids analíticos de duas ou três colunas.

### 37.4 App — `900–1199px`

* sidebar pode permanecer expandida ou compactar;
* right rail vira drawer;
* KPIs em `2 + 1` quando necessário;
* gráfico principal ocupa mais largura.

### 37.5 App — `640–899px`

* sidebar vira drawer;
* uma ou duas colunas;
* topbar simplificada;
* ações de página podem quebrar para segunda linha;
* tabelas usam scroll horizontal ou visualização em lista.

### 37.6 App — abaixo de `640px`

* uma coluna;
* page padding `16px`;
* botões primários podem ocupar largura total;
* KPIs empilhados;
* modais viram bottom sheet ou tela cheia quando apropriado;
* manter texto mínimo de `13px` fora de metadados.

---

## 38. Acessibilidade

* contraste mínimo WCAG AA para texto e controles;
* foco visível com outline de `2px`;
* touch targets de pelo menos `44×44px` em mobile;
* icon buttons com `aria-label`;
* tabs com semântica completa;
* status com texto ou ícone, não apenas cor;
* validação associada ao campo por `aria-describedby`;
* modais com foco inicial, trap de foco e retorno ao acionador;
* tooltips não contêm informação essencial exclusiva;
* gráficos possuem resumo textual ou tabela;
* motion respeita `prefers-reduced-motion`;
* ordem visual e DOM devem coincidir;
* texto tertiary não deve carregar informação indispensável.

---

## 39. Starter CSS consolidado

```css
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: var(--mp-font-ui);
  color: var(--mp-text-primary);
  background: var(--mp-bg-canvas);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "cv11", "ss01";
}

button,
input,
select,
textarea {
  font: inherit;
}

button,
a,
input,
select,
textarea,
[tabindex]:not([tabindex="-1"]) {
  -webkit-tap-highlight-color: transparent;
}

:focus-visible {
  outline: 2px solid var(--mp-accent);
  outline-offset: 2px;
}

::selection {
  color: var(--mp-text-primary);
  background: var(--mp-accent-tint);
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--mp-border-default) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--mp-border-default);
}

*::-webkit-scrollbar-thumb:hover {
  background: var(--mp-border-strong);
}
```

---

## 40. Tokens em JSON

```json
{
  "manypost": {
    "color": {
      "accent": "#7C3AED",
      "accentHover": "#6D28D9",
      "accentSoft": "#F5F3FF",
      "textPrimary": "#111217",
      "textSecondary": "#686870",
      "textTertiary": "#92929B",
      "canvas": "#F5F3EF",
      "main": "#F5F3EF",
      "surface": "#FFFFFF",
      "surfaceSubtle": "#ECE9E4",
      "borderSubtle": "#DDD9D2",
      "borderDefault": "#DDD9D2",
      "borderStrong": "#8D8882",
      "sidebar": "#111820",
      "sidebarHover": "#1B2530",
      "sidebarText": "#E8EDF2",
      "sidebarMuted": "#AAB4BF",
      "chartPrimary": "#7C3AED",
      "chartSecondary": "#14B8A6"
    },
    "radius": {
      "xs": 4,
      "sm": 6,
      "md": 8
    },
    "controlHeight": {
      "compact": 32,
      "default": 38,
      "comfortable": 44
    },
    "space": {
      "1": 4,
      "2": 8,
      "3": 12,
      "4": 16,
      "5": 20,
      "6": 24,
      "7": 28,
      "8": 32,
      "12": 48,
      "16": 64,
      "22": 88
    },
    "motion": {
      "instant": 100,
      "fast": 150,
      "base": 200,
      "enter": 280,
      "auth": 550
    }
  }
}
```

---

## 41. Estrutura de componentes recomendada

```text
ManypostDesignSystem
├── Foundations
│   ├── Color
│   ├── Typography
│   ├── Spacing
│   ├── Radius
│   ├── Borders
│   ├── Elevation
│   ├── Motion
│   └── Iconography
├── Actions
│   ├── Button
│   ├── IconButton
│   ├── Link
│   └── ButtonGroup
├── Forms
│   ├── Input
│   ├── Textarea
│   ├── Select
│   ├── Search
│   ├── Checkbox
│   ├── Radio
│   ├── Switch
│   ├── DatePicker
│   └── FieldMessage
├── Navigation
│   ├── Sidebar
│   ├── Topbar
│   ├── Breadcrumb
│   ├── Tabs
│   ├── Pagination
│   └── CommandPalette
├── DataDisplay
│   ├── Card
│   ├── KPICard
│   ├── Badge
│   ├── Status
│   ├── Avatar
│   ├── Table
│   ├── ListRow
│   ├── Timeline
│   └── Chart
├── Feedback
│   ├── Alert
│   ├── Toast
│   ├── Tooltip
│   ├── Progress
│   ├── Skeleton
│   ├── EmptyState
│   └── ErrorState
├── Overlays
│   ├── Dropdown
│   ├── Popover
│   ├── Modal
│   ├── Drawer
│   └── HoverCard
└── Patterns
    ├── AppShell
    ├── PageHeader
    ├── Toolbar
    ├── FilterBar
    ├── AnalyticsGrid
    ├── RightRail
    ├── ProductPreview
    ├── Hero
    └── TechnicalSection
```

---

## 42. Matriz de requisitos por componente

| Componente         | Requisito obrigatório                                         | Critério de aceite                                   |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| Card interativo    | Hover neutro; roxo apenas em foco ou seleção explícita        | Hover não altera a borda para `accent`               |
| Card do aplicativo | Raio `8px`, padding `20–24px`, sem sombra                     | Usa somente tokens e não possui `box-shadow`         |
| Card de KPI        | Superfície suave, raio `8px`, sem borda e sem sombra          | Valor não quebra linha e usa números tabulares       |
| Sidebar            | Item ativo por fundo suave e contraste tipográfico            | O roxo aparece em no máximo um indicador             |
| Topbar             | Altura `56px`, ações compactas e breadcrumb truncável         | Não há quebra de linha nem deslocamento por badge    |
| Título de card     | `15–16px`, peso `500` em produto e analytics                  | Peso `700` não é utilizado                           |
| Bordas             | Uso de `subtle`, `default`, `strong` e `accent` por semântica | Não há hex ou intensidade local não documentada      |
| Tooltip            | Camada flutuante, pequena, escura, borda forte e sem sombra   | Não contém ação interativa                           |
| Dropdown           | Borda forte, raio `8px` e superfície distinta, sem sombra     | Abre com foco gerenciado e fecha com Escape          |
| Input              | Hover neutro; foco com borda accent e ring suave              | Label permanece visível e erro usa mensagem textual  |
| Tabela             | Linhas de `44px`, divisores horizontais sutis                 | Números comparáveis ficam alinhados e tabulares      |
| Gráfico            | Linhas finas, no máximo duas cores fortes                     | Há resumo textual ou tabela equivalente              |
| Filtros            | Controles neutros; accent somente quando ativos               | Não parecem ações primárias                          |
| Densidade          | Uso de no máximo dois modos por tela                          | Alturas não fogem dos tokens sem exceção registrada  |
| Raios              | Uso exclusivo da escala oficial                               | Apenas `4px`, `6px` e `8px`; círculo só para avatar  |

---

## 43. Regras que não devem ser quebradas

1. Não usar roxo em grandes massas sem função.
2. Não usar sombra em cards persistentes.
3. Não usar borda roxa como hover genérico.
4. Não usar mais de duas cores fortes por gráfico.
5. Não adicionar gridlines visíveis apenas para preencher espaço.
6. Não usar peso `700` em títulos de produto.
7. Não arredondar todos os componentes com `12–20px`.
8. Não transformar filtros em CTAs.
9. Não usar pills em botões comuns, cards ou tabs.
10. Não usar texto tertiary para informação essencial.
11. Não permitir quebra em labels compactas, KPIs ou ações.
12. Não misturar três modos de densidade na mesma tela.
13. Não usar animação de escala ou salto em hover.
14. Não combinar sombra, borda forte e fundo forte em um único destaque.
15. Não inserir teal fora de analytics sem justificativa.
16. Não centralizar títulos, valores ou tabelas por padrão.
17. Não usar ícones preenchidos em massa.
18. Não transformar cada linha do right rail em card.
19. Não alterar a marca `manypost` para caixa alta ou camel case.
20. Não inventar valores fora dos tokens sem registrar exceção.

---

## 44. Checklist de validação visual

### Fundamentos

* [ ] Roxo principal continua `#7C3AED`.
* [ ] Marketing e app usam contextos de superfície diferentes.
* [ ] Interface usa Inter; grandes títulos usam display.
* [ ] Números analíticos usam algarismos tabulares.
* [ ] Espaçamento segue escala de `4px`.

### Geometria

* [ ] Marketing usa principalmente raios `4/6/8px`.
* [ ] App usa `10px` apenas em cards e navegação selecionada.
* [ ] KPIs podem usar `12px`.
* [ ] Bordas têm intensidade semântica correta.
* [ ] Cards persistentes não têm sombra.

### Componentes

* [ ] Hover de card não fica roxo automaticamente.
* [ ] Foco é visível e distinto de seleção.
* [ ] Botões têm hierarquia clara.
* [ ] Inputs usam ring suave, não glow.
* [ ] Tabs não viram pills sem necessidade.
* [ ] Sidebar ativa usa fundo suave.
* [ ] Dropdowns e tooltips são as únicas camadas com sombra recorrente.

### Dados

* [ ] Gráfico principal usa roxo.
* [ ] Segunda série usa teal ou neutro adequado.
* [ ] Linhas são finas.
* [ ] Gridlines são ausentes ou quase invisíveis.
* [ ] Tooltip é pequeno e escuro.
* [ ] KPIs não quebram linha.

### Conteúdo

* [ ] Títulos de cards têm peso moderado.
* [ ] Texto secondary continua legível.
* [ ] Labels compactas não quebram.
* [ ] Empty states indicam próximo passo.
* [ ] Erros explicam recuperação.

### Acessibilidade

* [ ] Contraste AA.
* [ ] Navegação por teclado completa.
* [ ] Redução de movimento respeitada.
* [ ] Status não depende apenas de cor.
* [ ] Gráficos têm alternativa textual.

---

## 45. Procedimento de QA

1. Validar tokens antes de componentes.
2. Validar componentes isolados em todos os estados.
3. Montar páginas com conteúdo realista, não lorem ipsum curto.
4. Testar dados longos, vazios, negativos e extremos.
5. Capturar viewports `1440×900`, `1280×800`, `1024×768`, `390×844` e `360×800`.
6. Comparar alinhamento, densidade, largura de texto, bordas e raios.
7. Validar contraste e foco.
8. Testar com fontes carregadas e fallback.
9. Testar `prefers-reduced-motion`.
10. Criar snapshots para tokens, buttons, inputs, cards, sidebar, KPIs, tabelas, dropdowns e gráficos.

### Ordem de correção

1. estrutura e largura;
2. densidade e gaps;
3. tipografia;
4. superfícies e bordas;
5. estados;
6. ícones;
7. motion;
8. detalhes de dados.

### Tolerâncias

* componentes estáticos: `±1px` em dimensões críticas;
* line-wrap: consistente em títulos e labels;
* cores: somente tokens;
* ícones: mesma viewBox, stroke e alinhamento;
* animações: mesma duração percebida e direção.

---

## 46. Regras de governança e lint

```txt
1. Proibir hex avulso fora dos arquivos de tokens.
2. Proibir box-shadow em Card, Button, Input, Sidebar, Topbar e ProductPreview.
3. Permitir sombra apenas em Tooltip, Dropdown, Popover, Toast e CommandPalette.
4. Proibir translateY, scale, bounce e glow em :hover.
5. Proibir border-radius fora de 4, 6, 8, 10, 12, 16 e 999px.
6. Exigir justificativa para 10, 12, 16 e 999px conforme componente.
7. Proibir border-color accent em hover genérico de cards.
8. Exigir focus-visible em controles interativos.
9. Exigir Inter em UI e display font em títulos editoriais >= 26px.
10. Exigir font-variant-numeric tabular-nums em KPIs e tabelas numéricas.
11. Limitar gráficos a duas cores fortes por visualização.
12. Exigir reduced-motion para animações contínuas.
13. Proibir “ManyPost”, “Manypost” e “MANYPOST” em nome textual da marca.
14. Exigir screenshot tests para componentes-base.
15. Exigir registro de exceção para qualquer token novo.
```

---

## 47. Presets recomendados

### 47.1 Landing page

```txt
Canvas               #FFFFFF
Surface subtle       #F5F5F7
Border subtle        #E7E7EC
Container            1240px
Horizontal padding   40px / 20px
Section padding      88px / 64px
Card radius          8px
Card padding         28–32px
Hero H1              56px / 500 / 1.02
```

### 47.2 Dashboard / app

```txt
Canvas               #F5F3EF
Main                  #F5F3EF
Surface               #FFFFFF
Surface subtle        #ECE9E4
Border subtle         #DDD9D2
Border strong         #8D8882
Page padding          24px / 16px
Card radius           8px
Analytics radius      8px
Card padding          20–24px
Row height            36 / 44 / 52px
Control height        36 / 40 / 44px
Sidebar               208px / 64px collapsed
Sidebar surface       #111820
Desktop topbar        none
Mobile topbar         56px
```

### 47.3 Analytics

```txt
Primary series        #7C3AED
Secondary series      #14B8A6
Track                 #ECECF0
Tooltip               #111217
Card title            15–16px / 500
Axis label            10–11px / 400
Line stroke           1–1.5px
Gridlines             hidden or near-invisible
KPI radius            8px
```

### 47.4 Autenticação

```txt
Dark panel            #0A0A0A / #111111
Technical grid        44×44px at 5% white
Form surface          #FFFFFF
Container radius      8px
Control radius        6px
Entry motion          550ms cubic-bezier(.16,1,.3,1)
Overlay/fade          150ms
```

---

## 48. Registro de decisões e exceções

### 48.1 Decisões fixas desta versão

As decisões abaixo devem ser tratadas como requisitos do sistema:

* canvas porcelana quente e superfícies de trabalho brancas;
* sidebar escura como contexto local de navegação;
* bordas quentes com intensidade semântica e limite forte ≥ 3:1;
* títulos de analytics com peso `500`;
* KPIs com superfície suave, sem borda e sem sombra;
* item ativo da sidebar por fundo escuro secundário e um único sinal roxo;
* iconografia linear;
* gráficos com gridlines ausentes ou quase invisíveis;
* teal restrito à diferenciação de séries em analytics;
* tooltip pequeno, escuro e flutuante;
* right rail denso, sem card por item;
* busca global no rail desktop e na topbar móvel;
* raios somente de `4`, `6` e `8px`.

### 48.2 Exceções permitidas

Uma exceção só pode ser criada quando:

1. um requisito funcional não pode ser atendido com os componentes existentes;
2. uma necessidade de acessibilidade exige tratamento diferente;
3. uma limitação técnica comprovada impede a implementação padrão;
4. um experimento foi aprovado com prazo e métrica definidos.

### 48.3 Registro obrigatório

Toda exceção deve registrar:

* componente ou tela afetada;
* regra que será desviada;
* justificativa;
* responsável;
* impacto em acessibilidade;
* token novo, quando aplicável;
* data de revisão ou remoção.

Valores locais sem registro não são considerados parte do sistema.

---

## 49. Plano de implementação

A implementação deve ocorrer na ordem abaixo para evitar componentes baseados em valores temporários.

### Fase 1 — Fundamentos

Entregáveis:

* tokens primitivos;
* tokens semânticos por contexto;
* tipografia;
* escala de espaçamento;
* raios, bordas, elevação e motion.

Critério de saída: todos os tokens publicados, versionados e consumíveis pelo frontend.

### Fase 2 — Componentes-base

Entregáveis:

* Button;
* IconButton;
* Input, Textarea e Select;
* Checkbox, Radio e Switch;
* Badge e Status;
* Tooltip e Dropdown.

Critério de saída: estados `rest`, `hover`, `focus`, `active`, `selected`, `disabled`, `loading` e `error` documentados e testados quando aplicáveis.

### Fase 3 — Navegação e estrutura

Entregáveis:

* AppShell;
* Sidebar;
* Topbar;
* Breadcrumb;
* PageHeader;
* Tabs;
* Toolbar.

Critério de saída: navegação por teclado, responsividade e truncamento validados.

### Fase 4 — Exibição de dados

Entregáveis:

* Card;
* Card de KPI;
* Table;
* ListRow;
* EmptyState;
* Skeleton;
* padrões de gráficos.

Critério de saída: cenários com dados reais, vazios, extensos, negativos e extremos validados.

### Fase 5 — Overlays e feedback

Entregáveis:

* Popover;
* Modal;
* Drawer;
* Toast;
* Alert;
* CommandPalette.

Critério de saída: foco, Escape, retorno ao acionador e comportamento de overlay testados.

### Fase 6 — Composição de páginas

Migrar e validar, no mínimo:

* uma landing page;
* uma página principal do aplicativo;
* uma tela de tabela;
* uma tela de formulário;
* um dashboard analítico;
* um fluxo com modal ou drawer.

### Fase 7 — QA e publicação

Executar:

* testes visuais;
* testes de acessibilidade;
* testes responsivos;
* lint de tokens e estilos;
* revisão conjunta de Design, Frontend e QA.

### Definition of Done

A versão só pode ser considerada concluída quando:

* não houver hexadecimais avulsos fora dos arquivos de tokens;
* não houver sombras em componentes persistentes;
* todos os controles tiverem foco visível;
* os componentes-base tiverem documentação e exemplos;
* as telas de referência passarem nos viewports definidos;
* não houver falhas críticas de acessibilidade;
* exceções estiverem registradas;
* snapshots e testes de regressão visual estiverem ativos.

---

## 50. Dependências, premissas e validações pendentes

### 50.1 Dependências

A implementação depende de:

* disponibilidade das famílias tipográficas definidas;
* mecanismo de distribuição e versionamento de tokens;
* biblioteca de componentes ou camada equivalente;
* ferramenta de testes visuais;
* biblioteca de gráficos capaz de atender aos requisitos de acessibilidade;
* processo de aprovação entre Design, Frontend e QA.

### 50.2 Premissas

Este documento assume que:

* a interface principal utiliza contexto claro;
* dark é um contexto técnico local, não um tema global;
* os componentes suportam atributos semânticos e navegação por teclado;
* valores de negócio, conteúdo e permissões são fornecidos por outras camadas do produto;
* os componentes podem consumir CSS custom properties ou tokens equivalentes.

### 50.3 Validações pendentes

Antes de publicar esta versão como oficial, a equipe deve validar:

1. contraste real dos tokens em componentes e gráficos;
2. disponibilidade e fallback das fontes;
3. comportamento dos componentes com conteúdo em português;
4. densidade em telas com dados reais;
5. compatibilidade dos padrões com a biblioteca frontend escolhida;
6. APIs dos componentes e convenções de nomenclatura;
7. custo de migração das telas existentes;
8. aprovação final de marca.

Decisões ainda não validadas devem permanecer marcadas como proposta e não devem ser tratadas como implementação concluída.

---

## 51. Registro histórico da reconciliação (não normativo)

### 51.1 Por que este adendo existe

Esta seção preserva o histórico que levou ao sistema flat. Ela não sobrescreve nenhuma seção
anterior: desde a versão 4.0, as regras vigentes estão incorporadas diretamente nos capítulos
principais. Em conflito acidental, prevalece sempre a regra principal mais específica.

### 51.2 Sombra: proibida, sem exceção de componente flutuante

| Seção sobrescrita | O que dizia | O que vale |
| --- | --- | --- |
| §24.1 | `box-shadow: var(--mp-shadow-floating)` no dropdown | nenhuma sombra |
| §25.1, §25.2 | sombra permitida em tooltip e popover | nenhuma sombra |
| §26.1 | overlay com elevação | nenhuma sombra |
| §27.2 | "toast é flutuante, portanto pode usar sombra" | nenhuma sombra |
| §24.3 | "sombra floating permitida" na command palette | nenhuma sombra |
| §46.3 | "permitir sombra apenas em Tooltip, Dropdown, Popover, Toast e CommandPalette" | **regra removida**: `box-shadow` é proibido em todo componente |
| §8.4 | "Elevação" como eixo de hierarquia | substituído por §51.4 |

Motivo: zero sombra não é preferência, é o pilar de identidade da marca (BRAND §2.2) e a regra
que o `check-brand.ts` verifica arquivo por arquivo. Um flutuante se separa do fundo por **borda
forte + mudança de superfície**, sem simular elevação.

### 51.3 Raio: somente 4, 6 e 8px

| Seção sobrescrita | O que dizia | O que vale |
| --- | --- | --- |
| §8.1, §46.5 | escala 4/6/8/10/12/16/999px | **4/6/8px**; `rounded-full` apenas no Avatar e em pontos de estado pequenos |
| §47.2 | card 10px, analytics 12px | 8px |
| §47.3 | KPI 12px | 8px |
| §20.1 | `--mp-radius-xl` no card de KPI | 8px (`rounded-lg`) |

O `check-brand.ts` reprova qualquer coisa fora disso, incluindo valor arbitrário (`rounded-[10px]`).

### 51.4 Profundidade revogada: camadas chapadas (brand v1.4, 2026-07-31)

O texto anterior dizia que “o brand v1.3 resolve profundidade por gradiente de preenchimento + cor
de borda por lado”. Essa decisão está **revogada**. Nenhum componente simula profundidade com
gradiente, brilho, sombra ou filtro. A hierarquia usa `--canvas`, `--surface` e `--surface-2`; o
papel flutuante reutiliza `--surface` e ganha `--line-strong`. `--line` separa estrutura e a borda
forte delimita controles e overlays quando é o único identificador. As classes `.bevel-*` e `.inset-field` e os tokens
`--edge-*`/`--bevel-*` foram removidos.

**Card de KPI (§20):** usa fill de estado chapado, `rounded-lg` e no máximo uma borda uniforme.
Estado e hierarquia vêm de fill, texto, um pequeno ponto semântico e espaçamento — não de ornamento.

### 51.5 Mapa de nomes: `--mp-*` → tokens reais

Este documento usa um namespace que o aplicativo não tem. A tradução é esta, e é a única
autorizada:

| `design.md` | Token real | Utility |
| --- | --- | --- |
| `--mp-bg-canvas` | `--canvas` | `bg-canvas` |
| `--mp-bg-surface` | `--surface` | `bg-surface` |
| `--mp-bg-subtle`, `--mp-bg-muted` | `--surface-2` | `bg-surface-2` |
| superfície de overlay | `--surface` + `--line-strong` | `bg-surface border-line-strong` |
| `--mp-text-primary` | `--ink` | `text-ink` |
| `--mp-text-secondary` | `--ink-soft` | `text-ink-soft` |
| `--mp-text-tertiary` | `--graphite` | `text-graphite` |
| `--mp-border-subtle`, `--mp-border-default` | `--line` | `border-line` |
| limite de controle/overlay | `--line-strong` | `border-line-strong` |
| `--mp-accent`, roxo `#7C3AED` | `--accent` | `text-accent`, `bg-accent` |
| `--mp-accent-soft` | `--accent-tint` | `bg-accent-tint` |
| `--mp-radius-xs`/`sm` | `--radius-sm` (4px) | `rounded-sm` |
| `--mp-radius-md` | `--radius-md` (6px) | `rounded-md` |
| `--mp-radius-lg`/`xl` | `--radius-lg` (8px) | `rounded-lg` |
| `--mp-duration-fast`/`base` | — | `duration-200` (transição de cor) |
| série primária de gráfico | `--data-1` | `text-data-1`, `bg-data-1` |
| série secundária de gráfico | `--data-2` | `text-data-2`, `bg-data-2` |
| trilha de medidor/barra | `--data-track` | `bg-data-track` |

### 51.6 Tokens novos registrados (exceção sob §46.15)

O §20.3 pede três tints de KPI (lilás, azul, neutro) e o §47.3 pede duas séries analíticas. O
aplicativo tinha o lilás (`--accent-tint`) e o neutro (`--surface-2`); faltava a segunda série.
Foram adicionados a `globals.css`:

| Token | Valor | Justificativa |
| --- | --- | --- |
| `--data-1` / `--data-1-tint` | `#7c3aed` / `#ede9fe` | apelido semântico do acento, para o gráfico não referenciar "cor de marca" |
| `--data-2` / `--data-2-tint` | `#0f766e` / `#ccfbf1` | ver abaixo |
| `--data-track` | `#eeeeef` | o "vazio" de medidor e barra |

**Sobre o teal:** o §47.3 sugere `#14B8A6`. Ele **não foi adotado**. Contra branco esse tom dá
**2,49:1**, abaixo do 3:1 que a WCAG 1.4.11 exige para objeto gráfico não textual — e a §2.1
deste documento coloca acessibilidade **acima** de preferência visual, então a troca é obrigatória,
não opcional. `#0f766e` dá **5,47:1**, praticamente igual ao roxo (5,70:1), o que também equilibra
o peso das duas séries. Teal foi mantido como matiz porque é o único distante do roxo que não
colide com a semântica dos estados de publicação (âmbar = publicando, verde = publicado, vermelho
= falhou, amarelo = revisão): uma série verde leria como "publicado".

**Sobre o azul de KPI (§20.1, `#EEF5FD`):** não foi adotado e não deve ser usado. Uma fileira de
três KPIs usa `--accent-tint`, `--data-2-tint` e `--surface-2` — três tons suaves, dois deles já
com significado no produto, sem introduzir um matiz que a marca não tem.

### 51.7 Tipografia, spacing e largura do produto (brand v1.4)

O produto usa apenas `text-axis|meta|compact|panel|title|figure`; papel novo ganha nome em vez de
utility crua. Corpo usa peso padrão, labels/controles `medium`, títulos/ativos `semibold`; bold e
uppercase ficam fora do chrome autenticado. Auth/onboarding preservam o regime editorial e
`network-preview.tsx` é a única exceção representacional nomeada para tipografia externa.

Gaps de layout usam 4/8/12/16/24/32px e margens negativas não corrigem ritmo. O shell aplica uma
única largura `--container-app`; texto descritivo usa `--container-reading`. Uma tela pode se
estreitar dentro desse limite, mas não substituí-lo.

### 51.8 O que o `check-brand.ts` verifica hoje

Para a especificação não ser confundida com o portão, o que o CI realmente impõe:

| Verifica | Não verifica |
| --- | --- |
| hex fora de `globals.css` | contraste real |
| `box-shadow` e utilities de sombra | ordem de foco e navegação por teclado |
| `translate`/`scale`/`rotate` em `:hover` | densidade de controles |
| raio fora de 4/6/8 | uso correto de token semântico |
| wordmark `manypost` minúsculo | string literal fora do i18n |
| tamanho de fonte arbitrário (`text-[Npx]`) | — |
| `<button>` sem `cursor-pointer` | — |
| `animate-*` sem `motion-reduce` | — |
| classes/tokens de relevo e gradiente vertical de preenchimento | gradientes decorativos autorizados em `globals.css` |
| escala tipográfica crua, bold e uppercase no produto | papel semântico correto do texto |
| borda tracejada fora dos drop targets nomeados | hierarquia visual de estados vazios |
| gaps fora de 4/8/12/16/24/32px e margem negativa corretiva | padding/geometria interna do kit de componentes |
| `rounded-full` fora do Avatar e de dots pequenos | semântica visual além da classe |

As regras tipográficas, de superfície, framing, spacing e raio foram ampliadas pela brand v1.4. O
resto do checklist do §44 continua sendo **revisão humana** — o gate executa 18 regras linha a linha
e um check estrutural de cursor; não substitui inspeção visual ou acessibilidade no navegador.
