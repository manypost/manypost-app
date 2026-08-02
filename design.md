---
title: "manypost — sistema visual branco/lilás"
status: "normativo"
version: "2.0"
source_dimensions: "1200 × 900 px"
reference_mode: "desktop, recorte horizontal com painel direito parcialmente visível"
measurement_tolerance: "±1–2 px por antialiasing da imagem"
language: "pt-BR"
last_updated: "2026-08-01"
openspec: "adopt-white-lilac-dashboard-system"
---

# Sistema visual branco/lilás do manypost

Este é o contrato visual normativo do produto. Ele traduz a referência medida de 1200 × 900 px
para uma aplicação real, responsiva e alimentada por dados existentes. Em divergência, prevalecem:

1. segurança, acessibilidade e operações reais;
2. este documento e `apps/web/src/app/globals.css`;
3. os specs vivos em `openspec/specs/`;
4. documentação histórica.

A moldura de apresentação da referência — offset de 98 × 87 px, recorte à direita e conteúdo de
exemplo — serve apenas para reproduzir mocks. Ela não é aplicada ao runtime do produto.

## 1. Direção estética

O manypost usa uma linguagem de dashboard SaaS editorial, minimalista e silenciosa:

- superfícies quase totalmente brancas;
- canvas externo cinza-claro e centro `#FDFDFD`;
- sidebar cinza-preta, por decisão explícita do produto;
- contraste tipográfico alto sem peso excessivo;
- bordas finas, raios médios e ausência de sombra em superfícies persistentes;
- roxo usado com parcimônia para marca, seleção e série principal;
- teal usado somente como série analítica secundária;
- cartões KPI lilás e azul extremamente claros;
- gráficos leves, sem grades visíveis;
- ícones lineares monocromáticos;
- densidade média, alinhamento rigoroso e bastante espaço negativo.

A sensação deve ser precisa, contemporânea, leve, limpa e premium. O produto não usa dark mode.

## 2. Referência medida e adaptação do runtime

### 2.1 Moldura de mock em 1200 × 900 px

| Elemento | Medida |
| --- | ---: |
| Canvas | `1200 × 900 px` |
| Fundo externo | `#D9DBDD` |
| Início do app no mock | `x: 98 px`, `y: 87 px` |
| Raio externo superior esquerdo | `18–20 px` |
| Sidebar | `181 px` |
| Coluna central de referência | `820 px` |
| Painel direito | `260 px` |
| Topbar | `59 px` |

Para um mock pixel a pixel, a aplicação pode ocupar `1261px` e ser recortada pelo canvas. No
produto, não existe offset artificial, largura fixa ou recorte proposital.

```css
.reference-frame {
  width: 1200px;
  height: 900px;
  overflow: hidden;
  padding: 87px 0 0 98px;
  background: #d9dbdd;
}

.reference-app-shell {
  display: grid;
  grid-template-columns: 181px 820px 260px;
  width: 1261px;
  min-height: 900px;
  overflow: hidden;
  border-radius: 19px 0 0;
}
```

### 2.2 Runtime

- desktop: sidebar de `181px`, main flexível e rail opcional de `260px` onde há dados reais;
- sidebar recolhida: `64px`;
- abaixo de `1024px`: sidebar fixa some e a topbar oferece drawer;
- a largura central usa `--container-app` ou `--container-wide` conforme a superfície;
- nenhum conteúdo fictício é criado para preencher a composição.

## 3. Tokens de cor

Todos os componentes usam tokens. Hexadecimal só é permitido em `globals.css` e em documentação.

```css
:root {
  --canvas: #d9dbdd;
  --main: #fdfdfd;
  --surface: #ffffff;
  --surface-2: #f5f5f5;

  --line: #ededed;
  --line-strong: #8b8b8b;
  --data-track: #eeeeef;

  --ink: #0c0f17;
  --ink-soft: #26282d;
  --graphite: #74767c;
  --mist: #9b9da2;

  --kpi-lilac: #edeefc;
  --kpi-blue: #e6f1fd;

  --accent: #7c56cd;
  --accent-hover: #6e44c7;
  --accent-tint: #edeefc;
  --accent-on-dark: #d0c4ea;

  --data-1: #7c56cd;
  --data-2: #00866c;
  --data-2-bright: #00f3bc;

  --sidebar: #242629;
  --sidebar-hover: #303236;
  --sidebar-text: #f3f3f4;
  --sidebar-muted: #aeb1b5;
}
```

### 3.1 Regras de cor

- roxo não domina a página; fica em marca, ação primária, seleção e dados;
- `--data-2-bright` é reservado a marcas gráficas não textuais;
- texto teal usa `--data-2`, que preserva contraste;
- azul e lilás claros identificam somente resumos compactos;
- vermelho, âmbar e verde mantêm significado de estado, nunca decoração;
- o centro é `#FDFDFD`, não cinza visível nem branco puro;
- cards internos são brancos para separação quase imperceptível;
- o fundo geral nunca recebe gradiente.

## 4. Tipografia

### 4.1 Família

Inter é a fonte integral do produto autenticado:

```css
font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Plus Jakarta Sans permanece apenas em marketing, autenticação e onboarding. Não entra em títulos
do dashboard.

### 4.2 Escala de produto

| Papel | Utility | Tamanho | Peso | Line-height |
| --- | --- | ---: | ---: | ---: |
| Eixo de gráfico | `text-axis` | `10px` | `400` | `14px` |
| Metadado/timestamp | `text-meta` | `11px` | `400–500` | `1.4` |
| Navegação/corpo compacto | `text-compact` | `13px` | `400–500` | `18px` |
| Título de card | `text-panel` | `15px` | `500` | `1.35` |
| Título de página | `text-title` | `18px` | `500` | `22px` |
| Valor KPI | `text-figure` | `23px` | `500` | `27px` |

Regras:

- o produto não usa peso 700;
- títulos não têm tracking perceptível;
- valores comparáveis usam `font-variant-numeric: tabular-nums`;
- valores grandes podem usar `letter-spacing: -0.02em`;
- labels compactos não quebram linha;
- nomes longos truncam com reticências.

## 5. Espaçamento, raios, bordas e sombra

### 5.1 Escala de layout

`4 / 8 / 12 / 16 / 20 / 24 / 28 / 32px`.

- padding padrão de cartão: `20px`;
- gap ícone/texto: `8–12px`;
- gap entre regiões principais: `24px`;
- gap da referência entre cards analíticos: `22–23px`;
- margem negativa não corrige layout;
- geometria interna de ícone, preview e biblioteca pode usar meia unidade quando medida.

### 5.2 Raios por função

| Token/utility | Valor | Uso |
| --- | ---: | --- |
| `rounded-key` | `4px` | checkbox, badge, marca mínima |
| `rounded-compact` | `5px` | tecla de atalho |
| `rounded-tooltip` | `8px` | tooltip e microbarra |
| `rounded-control` | `10px` | botão, input, nav, tile de ícone |
| `rounded-card` | `11px` | card analítico e board |
| `rounded-kpi` | `12px` | cartão KPI |
| `rounded-full` | `999px` | busca pill, avatar e ponto circular |

Não existe raio universal. O papel do elemento determina o raio.

### 5.3 Bordas

- divisor estrutural: `1px solid var(--line)`;
- limite de input/overlay: `1px solid var(--line-strong)` quando for o único identificador;
- KPI não recebe borda visível;
- nenhuma borda escura decorativa;
- uma região não acumula molduras internas sem necessidade funcional.

### 5.4 Sombras

Cards, menus persistentes, botões, inputs, shell e navegação não usam sombra. Somente tooltip usa:

```css
box-shadow:
  0 8px 18px rgba(12, 15, 23, 0.18),
  0 2px 5px rgba(12, 15, 23, 0.12);
```

## 6. Gradientes

Gradiente é codificação de dados, nunca decoração de superfície. Só três utilities são permitidas:

```css
.viz-active-bar {
  background: linear-gradient(180deg, rgba(208, 196, 234, 0.7), #a389dc 24%, #7c56cd 72%, #6e44c7);
}

.viz-donut-segment {
  background: linear-gradient(145deg, #d8cfef, #a389dc 38%, #7c56cd 72%, #6e44c7);
}

.viz-area-fill {
  background: linear-gradient(180deg, rgba(124, 86, 205, 0.055), rgba(124, 86, 205, 0));
}
```

Botões, cards, campos, sidebar, topbar e páginas usam fills sólidos.

## 7. Iconografia

- Lucide, Tabler ou Phosphor regular, conforme o kit existente;
- stroke `1.5–1.75px`, caps e joins arredondados;
- sidebar e topbar: `15–17px`;
- KPI: `17–19px` dentro de tile branco `34 × 34px` com raio `10px`;
- chevron: `11–12px`;
- nenhum preenchimento em massa;
- ícone não substitui label quando o significado não é universal.

## 8. Shell autenticado

### 8.1 Sidebar

- largura `181px`; recolhida `64px`;
- fundo `#242629`, separadores e active fill `#303236`;
- texto principal `#F3F3F4`, secundário `#AEB1B5`;
- item de navegação com `36px` de altura, raio `10px`, padding horizontal `10–12px`;
- ícone de `16px`, gap de `10px`, label `13px/500`;
- item ativo usa fill neutro e contraste, nunca faixa roxa;
- no máximo um item ativo;
- labels não quebram; truncam;
- conta permanece no rodapé e o estado recolhido oferece tooltip;
- abaixo de `1024px`, a sidebar vira drawer da topbar.

A sidebar cinza-preta é a única diferença cromática deliberada em relação à referência branca.

### 8.2 Topbar

- altura `59px`;
- fundo `#FDFDFD`, borda inferior `#EEEEEE`;
- breadcrumb compacto à esquerda, sem duplicar o H1;
- busca `138 × 27px`, pill, borda clara, ícone de `14px`, texto `11–12px` e chip de atalho;
- notificações e conta à direita, sem círculos decorativos;
- mobile mantém wordmark, drawer, busca, notificações e conta;
- topbar é sticky e não usa sombra.

### 8.3 Conteúdo

- main usa `#FDFDFD` e padding responsivo de `16–24px`;
- `PageShell` é a única fronteira de largura;
- H1 pertence a `PageHeader`, nunca ao breadcrumb;
- descrição usa no máximo `--container-reading`;
- ação principal fica à direita e desce no mobile.

## 9. Cartões KPI

- três cartões preferenciais por linha no desktop;
- referência: `238 × 96px`, gaps de `23px`;
- sequência lilás, azul, lilás;
- raio `12px`, sem borda, sem sombra;
- padding `20px`;
- label no topo esquerdo, valor abaixo, tile de ícone no topo direito;
- valor `23px/500`, tabular, uma linha;
- label com no máximo 15–18 caracteres visuais;
- valores longos são abreviados; a fonte não cai abaixo de `20px`;
- só dados reais podem ocupar um KPI.

Na Home, os KPIs representam agendados, publicados e falhas do dia. Eles não simulam alcance,
impressões, seguidores ou engajamento que o produto não mede.

## 10. Cartões analíticos e gráficos

### 10.1 Card base

```css
.analytics-card {
  overflow: hidden;
  padding: 20px;
  background: #fff;
  border: 1px solid #ededed;
  border-radius: 11px;
  box-shadow: none;
}
```

Títulos ficam a `20px` do topo/esquerda, em `15px/500`. Cabeçalhos não recebem fundo separado.

### 10.2 Linha principal

- cartão de referência: `565 × 282px`;
- área útil aproximada: `490 × 170px`;
- quatro labels no eixo Y e sete no eixo X;
- sem gridlines, borda do plot ou pontos em todas as amostras;
- linha roxa `1–1.25px`, suave, com area fill máximo de 5–6%;
- linha teal tracejada `1px`, dash `3/3`, sem preenchimento;
- ponto ativo `8–9px`, borda branca de `2px`;
- tooltip preto de aproximadamente `86 × 50px`, raio `8px`, única sombra do sistema.

### 10.3 Microbarras

- espessura `3px`, raio pill;
- máximo aproximado `68px`;
- segmentos roxo, teal e trilha clara com gaps de `1–2px`;
- não viram progress bars grossas.

### 10.4 Barras verticais

- largura `23–24px`, raio `8px`;
- cinco barras neutras e uma ativa com `.viz-active-bar`;
- sem sombra e sem gridlines.

### 10.5 Rosca

- diâmetro externo `138–140px`, interno `66–70px`;
- espessura `34–36px`;
- gaps brancos de `4–6px`;
- segmento principal usa `.viz-donut-segment`;
- legenda inferior compacta, tabular e em duas colunas.

## 11. Home operacional

A Home aplica o dashboard grammar aos dados existentes:

1. `PageHeader` compacto com Novo post e Calendário;
2. três KPIs reais do dia em lilás/azul/lilás;
3. grid principal `minmax(0, 1fr) + 260px` no desktop;
4. blocos detalhados como cards brancos de raio `11px`;
5. atividade, próximos posts, rascunhos, pipeline e uso aparecem apenas quando seus dados existem;
6. loading, erro e vazio preservam a mesma geometria;
7. first run continua instrutivo e não recebe uma grade de zeros;
8. nenhuma pessoa, capacidade, métrica de audiência ou dado de exemplo é fabricado.

## 12. Quadro

O Quadro preserva as cinco colunas reais e todas as operações existentes.

### 12.1 Superfície

- toolbar e lanes vivem dentro de uma única superfície branca;
- contorno `1px #EDEDED`, raio `11px`, sem sombra;
- toolbar tem borda inferior e controles de raio `10px`;
- lanes usam divisores verticais sutis e não viram cartões aninhados;
- cabeçalhos são sticky, `15px/500`, com dot de estado e contagem compacta;
- em largura insuficiente, as lanes rolam horizontalmente.

### 12.2 Cards

- branco, borda clara, raio `11px`, sem sombra;
- data/status em `11px`, corpo em `13px`;
- preview real opcional; sem mídia não reserva caixa vazia;
- ações, seleção, canal, retry e erro continuam visíveis;
- canal é identidade primária: chip com logo oficial de `16px` e conta legível, nunca apenas um selo minúsculo sobre avatar;
- grupos multicanal mostram até duas identidades e uma contagem real do restante;
- vermelho é semântico apenas em falhas e ação destrutiva;
- card publicado não promete arraste;
- nenhuma capacidade `n / limite` é mostrada porque esse dado não existe.

### 12.3 Operações que não podem regredir

- filtros e estado na URL;
- janela temporal e canais;
- densidade confortável/compacta;
- seleção, faixa, ações em lote e confirmação;
- drag por pointer e teclado;
- retry, cancelar, duplicar, publicar agora e aprovação;
- detalhe da publicação e media preview;
- estado truncado e empty state filtrado distintos.

## 13. Demais superfícies do produto

Calendário, composer, mídia, conexões, notificações, configurações e planos herdam:

- main quase branco;
- Inter compacta;
- cards brancos de raio `11px`;
- controles de raio `10px`;
- bordas claras;
- roxo como ação/seleção;
- ausência de sombra e gradiente decorativo.

Em Conexões, cada rede é conteúdo primário: o catálogo desktop usa quatro colunas e cards de
`144px`; o logo oficial fica direto sobre a superfície neutra, com `56px`, sem tile/card aninhado,
e o nome usa `18px/500`. Contas conectadas usam três colunas, tile de `56px` com logo de `36px`,
plataforma no primeiro nível e conta no segundo. As cores oficiais ficam restritas ao arquivo do
logo — o card continua branco e neutro.

Autenticação, onboarding, aprovação pública e previews de provider mantêm exceções documentadas de
composição e tipografia, mas continuam usando os mesmos tokens de cor e geometria onde aplicável.

## 14. Responsividade

### `>= 1260px`

- sidebar `181px`;
- topbar `59px`;
- rail de `260px` quando houver conteúdo secundário real;
- KPIs em três colunas;
- Quadro com cinco lanes no espaço disponível ou overflow honesto.

### `1024–1259px`

- sidebar permanece;
- rail secundário pode recolher para a linha seguinte;
- cards respeitam seus mínimos e não comprimem conteúdo ilegível.

### `768–1023px`

- sidebar vira drawer;
- topbar preserva navegação e ações;
- KPIs podem virar `2 + 1`;
- grids analíticos empilham;
- Quadro rola horizontalmente.

### `< 768px`

- uma coluna;
- KPIs empilhados;
- ações descem do cabeçalho;
- touch targets críticos têm pelo menos `44px`;
- não se tenta manter o recorte de referência.

## 15. Interação, movimento e acessibilidade

- hover altera apenas cor, borda ou fundo; não desloca o componente;
- animação contínua respeita `prefers-reduced-motion`;
- foco é visível por outline, não por shadow ring;
- controles não são aninhados em outros controles;
- ícone sozinho exige nome acessível ou tooltip;
- contraste de texto e objetos informativos prevalece sobre a correspondência literal do raster;
- teal neon não é usado para texto;
- botões crus declaram `cursor-pointer`;
- estados não dependem apenas de cor.

## 16. Estrutura recomendada

```text
AppFrame
├── Sidebar (181px / 64px)
├── MainColumn
│   ├── Topbar (59px)
│   └── PageShell
│       ├── PageHeader
│       ├── KPIGrid
│       ├── MainRegion
│       └── SecondaryRail (260px, opcional)
└── GlobalOverlays
    ├── ComposerModal
    ├── CommandPalette
    ├── Dialogs
    └── Tooltip
```

## 17. Proibições

- não saturar ou espalhar roxo pela página;
- não usar sombra em cards, botões, menus persistentes ou shell;
- não usar gradiente fora das três utilities de dados;
- não trocar o centro por cinza visível;
- não engrossar bordas;
- não usar títulos pesados ou display no dashboard;
- não centralizar títulos, cards ou KPIs;
- não adicionar gridlines aos gráficos;
- não transformar filtros em botões preenchidos;
- não aumentar a sidebar para acomodar labels;
- não usar ícones preenchidos em massa;
- não aplicar raio de `20–24px` em tudo;
- não aumentar avatares ou barras de gráfico;
- não permitir quebra em elementos compactos;
- não criar métricas, pessoas ou capacidades para imitar o mock.

## 18. Checklist de revisão

- [ ] Canvas `#D9DBDD` e main `#FDFDFD`.
- [ ] Sidebar `181px`, recolhida `64px`, fundo `#242629`.
- [ ] Topbar desktop `59px` com breadcrumb, busca e ações.
- [ ] Inter 18px/500 no H1 e 15px/500 em títulos de card.
- [ ] KPI 23px/500, tabular, fundos lilás/azul e raio 12px.
- [ ] Cards brancos, borda 1px, raio 11px, sem sombra.
- [ ] Controles com raio 10px.
- [ ] Tooltip é o único elemento com sombra.
- [ ] Gradientes aparecem somente em dados.
- [ ] Home usa apenas dados reais e rail de 260px.
- [ ] Quadro é uma superfície única e preserva cinco estados/operações.
- [ ] Lanes rolam em vez de comprimir.
- [ ] Mobile usa drawer e uma coluna quando necessário.
- [ ] Nenhum texto compacto quebra linha.
- [ ] `bun run check:brand` e testes focados passam.

## 19. Histórico normativo

| Versão | Data | Decisão |
| --- | --- | --- |
| v1.3 | 2026-07 | relevo por gradiente, posteriormente revogado |
| v1.4 | 2026-07 | superfícies chapadas e bordas sem sombra |
| v1.5 | 2026-07-31 | canvas quente, rail 208px e títulos display |
| v2.0 | 2026-08-01 | dashboard branco/lilás, Inter compacta, rail 181px e tooltip-only shadow |

As versões anteriores permanecem como histórico em commits e mudanças OpenSpec; não devem ser
usadas como fonte para novos mocks ou componentes.
