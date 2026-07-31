# manypost BRAND & DESIGN SYSTEM · ESPECIFICAÇÃO OFICIAL v1.5

[← Índice da documentação](../README.md) · [Guia de adaptação para o app](README.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [README do projeto](../../README.md)

> **Documento de Referência para Agentes de IA e Engenheiros de Frontend**
> Este arquivo estabelece as regras de identidade visual, estrutura de interface, tokens de cor, escala tipográfica e anatomia de componentes do **manypost**. Toda nova página, componente ou interface gerada por IA ou humanos DEVE seguir estes padrões, inspirados na clareza, solidez e maturidade de plataformas como **Zapier** e **Cloudflare**.
>
> **Wordmark canônico:** sempre **`manypost`** em caixa baixa (UI, `<title>`, e-mails, docs de produto). A forma ManyPost é **histórica** neste arquivo e não deve ser reintroduzida. Fonte: [docs/brand/README.md](README.md), `CLAUDE.md`, `check:brand`.

---

## 1. Contexto da Aplicação, Posicionamento & Ecossistema (Branding)

O **manypost** é uma plataforma de gestão inteligente de canais sociais, agendamento multicanal, automação de fluxo de trabalho e análise de dados. Desenvolvida com tecnologia **100% brasileira (BR)** para atender agências, criadores, marcas e desenvolvedores em escala global e nacional, a plataforma elimina o trabalho manual e fragmentado da gestão de conteúdo, oferecendo um ambiente seguro, profissional e fácil de usar.

### A. O Foco Duplo · Agências + Desenvolvedores
O manypost preenche a lacuna entre o design visual e a engenharia de software, unindo os dois mundos em uma única plataforma prática e integrada:
* **Para Agências & Gestores (Dashboard Completo):** Uma interface limpa, intuitiva e sem distrações ("zero sombras") onde equipes de marketing, atendimento e criadores gerenciam todo o ciclo de vida do conteúdo em um único painel, sem trinta abas abertas e com zero necessidade de conhecimento técnico em código.
* **Para Desenvolvedores & IA (API RESTful + Protocolo MCP):** Para equipes de tecnologia e automação avançada, disponibilizamos uma **API oficial completa** e servidores nativos **MCP (Model Context Protocol)**. Isso permite que assistentes de IA (como Claude, ChatGPT e agentes autônomos) e scripts em qualquer linguagem consultem métricas, criem rascunhos, agendem e gerenciem postagens diretamente pelo pipeline oficial e autenticado da plataforma.

### B. Funcionalidades Centrais de Publicação & Multicanalidade
* **Kanban de Postagens:** Quadro visual interativo para gestão ágil do pipeline de conteúdo (colunas de Ideação, Rascunho, Em Revisão, Aprovado pelo Cliente, Agendado e Publicado), com suporte a drag-and-drop e filtros por canal ou responsável.
* **Criação de Rascunhos & Timeline de Agendamento:** Elaboração e teste de formatos com visualização cronológica precisa. O calendário interativo permite agendar posts em múltiplos fusos horários com prevenção de conflitos.
* **Conexões Multicanal & Publicação Automática:** Integração nativa, confiável e segura com as principais redes sociais do mercado: **Instagram, Facebook, Telegram, X (Twitter), LinkedIn, TikTok, YouTube e Pinterest**. Após o agendamento, o manypost assume o disparo e realiza a publicação automática nas redes através das **APIs oficiais**, garantindo conformidade total e eliminando riscos de bloqueio ou banimento (shadowban).

### C. Inteligência Analítica & Análise de Concorrentes (Competitive Intelligence)
* **Criação e Otimização com IA:** Motores de Inteligência Artificial integrados ao fluxo de trabalho para simplificar a criação de posts, otimizar legendas, sugerir variações de tom de voz (adaptando o texto para a linguagem de cada rede social), indicar hashtags relevantes e prever o engajamento antes da publicação.
* **Relatórios Avançados e Dashboards de Marketing & Mídias Sociais:** Gráficos e métricas aprofundadas de alcance, impressões, taxa de engajamento, conversão, crescimento de seguidores e ROI de mídia social em tempo real.
* **Análise de Concorrentes (Benchmarking Avançado):** O manypost analisa, rastrea e compara o crescimento e a performance dos principais concorrentes do usuário. A plataforma revela insights estratégicos como:
  * **Frequência de postagens e curvas de crescimento** do concorrente.
  * **Horários e dias de maior publicação** e engajamento da concorrência.
  * **Formatos de conteúdo utilizados** (proporção entre Vídeos/Reels, Carrosséis, Imagens estáticas e Textos).
  * **Os melhores e piores posts** dos concorrentes (análise detalhada de performance histórica).
  * **Hashtags mais frequentes** e estratégias de legendas utilizadas pelos líderes do setor.

### D. Gestão de Times, Workflow & Aprovação Externa (Links Públicos)
* **Gestão de Equipes e Fluxo de Trabalho (Workflow):** Organização colaborativa com controle de permissões e papéis (Criador, Revisor, Gestor de Mídia e Admin). Cada alteração gera um **histórico de entregas e ajustes**, permitindo acompanhar quem criou, quem comentou, o que foi alterado e quando foi aprovado.
* **Links Públicos para Aprovação de Clientes:** Para simplificar a validação com clientes finais ou gestores externos, o manypost gera **links públicos de preview interativo**. O cliente visualiza a postagem exatamente como ela será renderizada na rede social (com imagens, vídeos e carrosséis) e pode aprovar ou solicitar ajustes com apenas 1 clique — **sem precisar fazer login, criar conta ou enfrentar burocracia no sistema**.

---

## 2. Princípios Fundamentais de Design & Experiência

1. **Estética Limpa, Profissional e Acolhedora:**
   O manypost é uma plataforma de gestão de redes sociais e automação de IA para quem valoriza seu tempo. Elementos decorativos em excesso, sombras flutuantes, gradientes de relevo e animações de entrada são evitados para manter o foco no conteúdo.
2. **Superfícies chapadas e zero sombras:** *(brand v1.5 — 2026-07-31)*
   `box-shadow` e gradientes de preenchimento são proibidos no app. A hierarquia usa três fills chapados — `--canvas`, `--surface` e `--surface-2` — em quatro papéis: piso, superfície, rebaixo e flutuante. O papel flutuante reutiliza `--surface` e se distingue por `--line-strong`, não por um quarto tom. `--line` separa estrutura; `--line-strong` delimita controles e conteúdo flutuante com contraste mínimo de 3:1. Um elemento não acumula fill, borda e molduras internas para parecer importante.
3. **Regra de Estabilidade em Botões:**
   Botões e elementos interativos não saltam ou se deslocam no hover. Ao passar o mouse, deve ocorrer apenas uma transição suave de cor (`background-color`, `border-color`, `color` em `0.2s ease`), mantendo o elemento firme e confortável na tela.
4. **Alinhamento e Espaçamento Harmoniosos (`align-items: stretch`):**
   Todos os cards ou colunas em uma mesma linha ou grid devem compartilhar a mesma altura. Gaps de layout usam a escala fechada de `4/8/12/16/24/32px`; margens negativas não corrigem agrupamento.

---

## 3. Paleta de Cores & Design Tokens (CSS Variables)

Todas as cores devem ser referenciadas via variáveis CSS pré-definidas em `global.css`. Nunca utilize cores hexadecimais *ad-hoc* diretamente nos componentes.

O sistema é **light-first**: o aplicativo usa canvas quente, superfícies brancas, rail escuro e o
roxo somente como acento funcional.

### Tabela de Tokens

| Token CSS | Hexadecimal | Cor / Tom | Uso Prescrito no Sistema |
| :--- | :--- | :--- | :--- |
| `--accent` | `#7C3AED` | Roxo | **Ação Primária:** CTAs, pontos de conversão, links, destaques de marca e hover de bordas interativas. Passa AA sobre branco (5,7:1) — pode ser **texto**, não só preenchimento. |
| `--accent-hover` | `#6D28D9` | Roxo Escuro | **Hover Primário:** Estado `hover` e `active` de botões e links primários. |
| `--accent-tint` | `#EDE9FE` | Roxo Lavado | **Fundo de Realce:** Badges, callouts e faixas de destaque suave sobre fundo claro. |
| `--accent-on-dark` | `#C4B5FD` | Roxo Claro | **Acento sobre Escuro:** `--accent` cai para 3,3:1 sobre `--ink` e reprova AA como texto. Sobre fundo escuro, texto e ícone de acento usam este tom (10,2:1). Preenchimento e borda podem continuar em `--accent`. |
| `--ink` | `#111111` | Quase-preto | **Texto Principal & Contraste:** Títulos H1/H2/H3, texto de alto contraste, superfícies escuras e bordas fortes. |
| `--ink-soft` | `#262626` | Preto Suave | **Hover de Superfície Escura:** estado `hover` de botões e painéis com fundo `--ink`. Não é cor de texto. |
| `--graphite` | `#6B6B70` | Cinza | **Texto Editorial & Apoio:** Subtítulos, parágrafos de corpo, sobretítulos em caixa alta, legendas, metadados e badges (5,3:1 sobre branco). |
| `--mist` | `#8E8E96` | Cinza Claro | **Metadado Decorativo:** 3,2:1 sobre branco — reprova AA para corpo de texto. Nunca use em texto que precise ser lido. |
| `--canvas` | `#F5F3EF` | Piso quente | **Fundo da Página:** base editorial acolhedora, distinta da superfície branca sem sombra. |
| `--paper` / `--surface` | `#FFFFFF` | Branco | **Superfície Principal:** cards, painéis e texto sobre fundo escuro ou roxo. |
| `--surface-2` | `#ECE9E4` | Cinza quente | **Rebaixo:** trilhos, tiles e blocos de código; o próprio fill é o limite, sem borda interna. |
| `--night` | `#0A0A0A` | Preto Premium | **Momento Dark (opcional):** seções de alto impacto, com wordmark branco e acento roxo. |
| `--line` | `#DDD9D2` | Linha / Borda | **Divisores & Estrutura:** bordas decorativas, linhas de tabela e separadores. |
| `--line-strong` | `#8D8882` | Limite Forte | **Controle/Overlay:** pelo menos 3:1 contra branco quando a borda é o único identificador. |
| `--sidebar` | `#111820` | Rail | **Navegação desktop:** superfície escura contínua, 208px aberta e 64px recolhida. |
| `--sidebar-hover` | `#1B2530` | Rail ativo | **Hover/seleção:** fill do item ativo e separadores do rail. |
| `--sidebar-text` | `#E8EDF2` | Texto no rail | **Labels ativos e identidade:** texto principal sobre o rail. |
| `--sidebar-muted` | `#AAB4BF` | Apoio no rail | **Ícones e labels inativos:** nunca usado no canvas claro. |

### Exemplo de Implementação CSS
```css
:root {
  --accent: #7C3AED;
  --accent-hover: #6D28D9;
  --accent-tint: #EDE9FE;
  --accent-on-dark: #C4B5FD;
  --paper: #FFFFFF;
  --surface: #FFFFFF;
  --canvas: #F5F3EF;
  --surface-2: #ECE9E4;
  --sidebar: #111820;
  --sidebar-hover: #1B2530;
  --sidebar-text: #E8EDF2;
  --sidebar-muted: #AAB4BF;
  --night: #0A0A0A;
  --ink: #111111;
  --ink-soft: #262626;
  --graphite: #6B6B70;
  --mist: #8E8E96;
  --line: #DDD9D2;
  --line-strong: #8D8882;
}
```

### 3.1 Camadas e bordas chapadas *(brand v1.4)*

| Token CSS | Papel |
| :--- | :--- |
| `--canvas` | piso da página |
| `--surface` | superfície principal |
| `--surface-2` | região recuada, delimitada pelo próprio fill |
| `--surface` + `--line-strong` | papel flutuante: overlay sem sombra ou gradiente |
| `--line` | divisor e estrutura decorativa |
| `--line-strong` | limite de controle/overlay; contraste mínimo 3:1 contra a superfície |

Os tokens `--edge-*` e `--bevel-*` e as classes `.bevel-*`/`.inset-field` foram removidos. Reintroduzi-los exige uma nova decisão OpenSpec; não é uma variação local permitida.

### 3.2 Shell editorial e Quadro *(brand v1.5)*

No desktop, o chrome é um rail escuro de 208px (64px recolhido); busca, notificações e conta vivem
nele. A topbar global existe somente no mobile. O conteúdo usa canvas quente e pode chegar a 96rem
em superfícies comparativas. Título de página usa Plus Jakarta Sans em 32px; a saudação da Home pode
usar 44px.

O Quadro apresenta cinco lanes abertas separadas por linhas verticais. A lane não recebe fill,
moldura nem raio; cards preservam a própria borda. Cabeçalhos são sticky e contagens são reais, sem
denominador de capacidade. Cards usam preview opcional do primeiro media: imagem em 4:3, vídeo como
tile neutro sem player, e nenhum espaço reservado quando não há media. Em mobile, as lanes rolam
horizontalmente com largura legível.

---

## 4. Estrutura Visual & Cantos Suaves (Border Radius)

O manypost evita formatos pílula (`border-radius: 9999px`) em botões, cards ou containers. `rounded-full` fica restrito ao componente Avatar e a pontos de estado pequenos. O arredondamento dos cantos segue uma escala simples e natural em 3 níveis:

* **`4px` (Small Radius):** Badges, tags, tooltips, toolbars, pequenas pílulas de status e ícones de marca.
* **`6px` (Medium Radius):** Botões padrão (todas as variações), campos de formulário (inputs, selects, textareas) e modais pequenos.
* **`8px` (Large Radius):** Cards de funcionalidade, containers, caixas de destaque e painéis de dados.

---

## 5. Tipografia Dupla (Marca vs. Leitura Fluida)

Utilizamos um sistema tipográfico duplo de alta precisão que combina a personalidade marcante da **Degular Display** nos grandes formatos com a legibilidade suíça da **Inter** na interface do usuário:

```css
@font-face {
  font-family: "Degular Display";
  src: url("/fonts/DegularDisplay-500.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Degular Display', 'Plus Jakarta Sans', var(--font-sans);
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

### A. Degular Display (`var(--font-display)`) · Títulos de Impacto & Grandes Formatos
A fonte proprietária **Degular Display** (da fundição OH no Type Co.) é a assinatura visual do manypost e quem dá vida à manchete do Hero (*"Vários posts. Várias redes. Um clique."*). Com proporções singulares e geometria "regular mas nem tão regular", ela cria memória visual imediata.

> [!IMPORTANT]
> **Regra Tipográfica Inegociável (`Degular Display` apenas $\ge 26\text{px}$):**
> A `Degular Display` foi desenhada exclusivamente para **Grandes Formatos (Hero H1, grandes CTAs e Títulos Principais de Seção H2 entre 32px e 56px)**. É **terminantemente proibido** utilizá-la em toda a aplicação ou em textos pequenos ($\le 22\text{px}$ como subtítulos de cards H3/H4, metadados ou UI). Em tamanhos menores ela fica estranha, pesada e perde a legibilidade.

* **Padrão Exato da LP para Manchetes (Hero H1 / Display):** `font-family: var(--font-display)`, `font-size: 44px a 56px`, `font-weight: 500` (equivalente ao `font-medium` do Tailwind/LP), `line-height: 1.02`, `letter-spacing: -0.5px` (`tracking-[-0.5px]`), `color: var(--ink)`.
* **Títulos Principais de Seções (H2 / CTAs):** `font-family: var(--font-display)`, `font-size: 32px a 48px`, `font-weight: 500`, `letter-spacing: -0.5px`, `color: var(--ink)`.
* **Kickers editoriais (auth/onboarding/marketing):** podem usar caixa alta e peso de display. Essa exceção não se aplica às superfícies autenticadas do produto.

### B. Inter UI (`var(--font-sans)`) · Cards ($\le 22\text{px}$), UI, Corpo & Dados
O padrão imutável para todo o restante do sistema: subtítulos de cards, botões, navegação, tabelas, formulários e parágrafos de corpo.
* **Títulos de Cards de Funcionalidade (H3 / H4 em Cards):** `font-family: var(--font-sans)`, `font-size: 18px a 22px`, `font-weight: 600`, `letter-spacing: -0.2px a -0.3px`, `color: var(--ink)`. (Exemplo exacto das seções *EveryTeam* e *Outcomes*).
* **Corpo de Texto (`.body-lg` / Parágrafos):** `font-size: 14px a 16px`, `font-weight: 400`, `line-height: 1.6`, `color: var(--graphite)`.
* **Textos de UI / Botões / Form Labels:** usam os papéis nomeados `text-axis|meta|compact|panel|title|figure`; labels e controles usam `font-medium`.
* **Títulos e estados ativos:** `font-semibold`. Corpo e valores lidos ficam no peso padrão. `font-bold` não pertence ao chrome do produto.
* **Metadados / Legendas / Carimbos de Tempo:** usam `text-meta`, peso padrão ou médio e `color: var(--graphite)`.
* **Exceção do eixo horário do calendário:** `font-size: 9px`, `line-height: 12px`, restrito aos rótulos `00:00–23:00` das grades de dia/semana; não reutilizar em metadados, botões ou conteúdo.

---

## 6. Sistema de Botões & Tamanhos Padronizados (11px, 13px, 15px)

Para garantir uma navegação agradável e equilibrada, nosso sistema adota exatamente **três tamanhos claros de fonte**, todos com raio de borda fixo em **`6px`** e **sem deslocamento vertical no hover (`translateY: 0`)**.

### Escala de Tamanhos (`size`)
* **Small (`sm`):** `font-size: 11px`, `padding: 6px 14px`, `height: ~32px`. (Para toolbars, tabelas, filtros e ações em listas densas).
* **Medium (`md`):** `font-size: 13px`, `padding: 10px 20px`, `height: ~38px`. (Padrão universal para formulários, cards e modais).
* **Large (`lg`):** `font-size: 15px`, `padding: 14px 28px`, `height: ~44px`, `font-weight: 600`. (CTAs principais em cabeçalhos ou destaques de página).

> Todas as variantes têm preenchimento chapado, borda uniforme e `cursor: pointer`. Nenhuma usa gradiente, brilho, sombra ou filtro de luminosidade.

### Variações de Estilo (`variant`)
1. **Primary (`primary`):** `--accent` chapado, texto branco; hover em `--accent-hover`. Ação principal da tela.
2. **Enterprise (`enterprise`):** `--ink` chapado, texto `--paper`; hover em `--ink-soft`.
3. **Outline (`outline`):** `--surface` chapado, texto `--ink`, borda `--line-strong`; hover em `--surface-2`.
4. **Ghost (`ghost`):** **Flat.** Fundo transparente, texto `--ink`. Hover: Fundo `--surface-2`, texto `--accent`.
5. **Link (`link`):** **Flat.** Fundo transparente, texto `--accent`, sem borda ou padding. Hover: Texto `--accent-hover`.
6. **Destructive (`destructive`):** `--state-failed` chapado, texto branco; hover em `--state-failed-hover`.

> **Hover estável:** variantes transicionam `background-color`, `border-color` e `color` em `0.2s`, sem `filter`, `translate`, `scale` ou `rotate`.

### Especificação de Estilo CSS (Botões Firmes e Estáveis)
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--sans);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  white-space: nowrap;
}
/* TERMINANTEMENTE PROIBIDO: transform: translateY(-2px) NO HOVER! */
```

---

## 7. Componentes e Interações Suaves

### A. Cards Interativos (`.card`)
Cards estruturais devem ter altura igualizada (`height: 100%` em grids com `align-items: stretch`).
* **Estado Normal:** fill `--surface`, `border-radius: 8px`; use uma borda `--line` somente quando ela for necessária para identificar o objeto.
* **Estado Hover (cards clicáveis):** borda forte neutra ou mudança chapada de fill; roxo fica para foco e seleção explícita, sem sombra, filtro ou movimento.
* **Framing:** uma região carrega um nível de borda. Objetos arrastáveis/selecionáveis mantêm frame; o container vira um palco sem borda.

### B. Badges de Indicadores (`.badge`)
* **Especificação:** `text-meta`, `font-medium`, `padding: 4px 10px`, `border-radius: 4px`, fill/tinta sem gradiente e texto em sentence case.

### C. Logo Oficial (SVG)
* **Completa** (`public/images/logo.svg` / `apps/web/public/images/logo.svg`): horizontal com ícone + wordmark **`manypost`** em curvas (não depende de fonte). Usar sozinha — **não** duplicar o texto ao lado.
* **Simplificada** (`logoSimplificada.svg`): mark quadrado roxo (ícone only). Usar em sidebar recolhida, diagramas e espaços onde o wordmark não cabe.
* **No Header / Wordmark do app:** componente `Wordmark` → `<img src="/images/logo.svg" alt="manypost" height="28" />` (proporção ~1600×420).
* **Mark só:** `<img src="/images/logoSimplificada.svg" alt="manypost" width="32" height="32" />`.
* **Grafia da Marca:** A grafia oficial é sempre **`manypost`** (tudo minúsculo), inclusive em títulos, textos e `<title>`. Nunca escrever ManyPost ou `Manypost` em superfícies de produto.

---

## 8. Boas Práticas para Agentes de IA ao Escrever Código Astro / HTML

1. **Sempre importe o CSS Global:** Certifique-se de que `../styles/global.css` (ou equivalente) está importado na página ou layout principal.
2. **Utilize o Componente `<Button />`:** Ao criar botões em arquivos `.astro`, prefira usar o componente pré-construído `<Button variant="..." size="...">Texto</Button>`.
3. **Não invente classes utilitárias *ad-hoc*:** Evite adicionar `box-shadow`, `border-radius: 20px`, ou fontes gigantes nas tags inline. Utilize sempre os tokens e classes documentados acima.
4. **Respeite o Espaçamento:** No app, gaps usam 4/8/12/16/24/32px. Landing pages podem ampliar o respiro de seção, mas não inventam degraus de gap dentro do produto.
5. **Simplicidade e Clareza:** Em caso de dúvida sobre animações ou decorações excessivas, opte sempre pela **simplicidade limpa e funcional**. A elegância do sistema vem do contraste e da facilidade de uso, não do excesso.

---

**Navegação:** [Índice da documentação](../README.md) · [Guia de adaptação](README.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [README do projeto](../../README.md)
