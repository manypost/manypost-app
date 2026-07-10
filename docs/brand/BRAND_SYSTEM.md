# manypost BRAND & DESIGN SYSTEM · ESPECIFICAÇÃO OFICIAL (ASTRO 5)

> **Documento de Referência para Agentes de IA e Engenheiros de Frontend**
> Este arquivo estabelece as regras de identidade visual, estrutura de interface, tokens de cor, escala tipográfica e anatomia de componentes do **manypost**. Toda nova página, componente ou interface gerada por IA ou humanos DEVE seguir estes padrões, inspirados na clareza, solidez e maturidade de plataformas como **Zapier** e **Cloudflare**.

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
   O manypost é uma plataforma de gestão de redes sociais e automação de IA para quem valoriza seu tempo. Elementos decorativos em excesso (como globos 3D giratórios, sombras flutuantes ou animações exageradas) são evitados para manter o foco no conteúdo.
2. **Regra do Zero Sombras (`box-shadow: none !important`):**
   Inspirado no padrão visual da Zapier, abolimos todas as sombras artificiais. A hierarquia visual, separação de blocos e destaque são construídos exclusivamente por **bordas limpas** (`1px solid var(--line)`) e **sobreposição de cores de fundo** (ex: `--surface-2` sobre `--surface`).
3. **Regra de Estabilidade em Botões:**
   Botões e elementos interativos não saltam ou se deslocam no hover. Ao passar o mouse, deve ocorrer apenas uma transição suave de cor (`background-color`, `border-color`, `color` em `0.2s ease`), mantendo o elemento firme e confortável na tela.
4. **Alinhamento e Espaçamento Harmoniosos (`align-items: stretch`):**
   Todos os cards ou colunas em uma mesma linha ou grid devem compartilhar a mesma altura. O espaçamento interno (padding) e externo (gap) segue múltiplos de 8px ou 4px (ex: 8px, 12px, 16px, 24px, 32px, 40px, 48px).

---

## 3. Paleta de Cores & Design Tokens (CSS Variables)

Todas as cores devem ser referenciadas via variáveis CSS pré-definidas em `global.css`. Nunca utilize cores hexadecimais *ad-hoc* diretamente nos componentes.

O sistema é **light-first**: a base é o branco, o texto é quase-preto e o roxo entra como acento.

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
| `--paper` / `--surface` | `#FFFFFF` | Branco | **Fundo Principal:** Fundo geral da página (`body`), painéis e badges. Também é o texto sobre fundo escuro ou roxo. |
| `--surface-2` | `#F5F5F7` | Cinza-claro | **Superfície Base:** Cards de conteúdo, caixas de destaque, barras laterais e seções alternadas. |
| `--night` | `#0A0A0A` | Preto Premium | **Momento Dark (opcional):** seções de alto impacto, com wordmark branco e acento roxo. |
| `--line` | `#E2E2E7` | Linha / Borda | **Divisores & Estrutura:** Bordas de cards (`1px solid var(--line)`), linhas divisórias em tabelas e separadores de seções. |

### Exemplo de Implementação CSS
```css
:root {
  --accent: #7C3AED;
  --accent-hover: #6D28D9;
  --accent-tint: #EDE9FE;
  --accent-on-dark: #C4B5FD;
  --paper: #FFFFFF;
  --surface: #FFFFFF;
  --surface-2: #F5F5F7;
  --night: #0A0A0A;
  --ink: #111111;
  --ink-soft: #262626;
  --graphite: #6B6B70;
  --mist: #8E8E96;
  --line: #E2E2E7;
}
```

### 3.1 Tokens Semânticos de Estado (App) — oficial desde 2026-07-10 (DECISIONS v1.1 §11)

Para estados de publicação, toasts e indicadores do aplicativo. Filosofia da paleta preservada: tons **-700 que passam AA como texto sobre branco**, tint de fundo suave, hierarquia por borda/fundo (nunca sombra), nada neon. Badge/chip de estado = fundo `tint` + texto/borda na cor cheia (formato `.badge` do §7.B, radius 4px).

| Token | Hex | Contraste s/ branco | Uso |
| :--- | :--- | :--- | :--- |
| *(rascunho)* | usa `--graphite` + `--surface-2` | 5,3:1 | Estado neutro — não ganha cor própria |
| `--state-scheduled` | `#7C3AED` (= `--accent`) | 5,7:1 | Agendado: "nas mãos do sistema" |
| `--state-scheduled-tint` | `#EDE9FE` (= `--accent-tint`) | — | Fundo do badge agendado |
| `--state-publishing` | `#B45309` | 4,7:1 | Publicando (em andamento) |
| `--state-publishing-tint` | `#FEF3C7` | — | |
| `--state-published` | `#15803D` | 4,8:1 | Publicado / sucesso |
| `--state-published-tint` | `#DCFCE7` | — | |
| `--state-failed` | `#B91C1C` | 5,9:1 | Falha / erro destrutivo |
| `--state-failed-tint` | `#FEE2E2` | — | |
| `--state-review` | `#A16207` | 4,6:1 | Em revisão / aguardando aprovação / needs-review |
| `--state-review-tint` | `#FEF9C3` | — | |

```css
:root {
  --state-scheduled: #7C3AED;  --state-scheduled-tint: #EDE9FE;
  --state-publishing: #B45309; --state-publishing-tint: #FEF3C7;
  --state-published: #15803D;  --state-published-tint: #DCFCE7;
  --state-failed: #B91C1C;     --state-failed-tint: #FEE2E2;
  --state-review: #A16207;     --state-review-tint: #FEF9C3;
}
```

Regras: a mesma cor de estado é usada em **todas** as telas (kanban, calendário, listas, toasts); cores de estado nunca substituem `--accent` em ações/CTAs; texto sobre `tint` usa a cor cheia do estado ou `--ink`.

---

## 4. Estrutura Visual & Cantos Suaves (Border Radius)

O manypost evita formatos pílula (`border-radius: 9999px`) em botões, cards ou containers, exceto em avatares circulares. O arredondamento dos cantos segue uma escala simples e natural em 3 níveis:

* **`4px` (Small Radius):** Badges, tags, tooltips, toolbars, pequenas pílulas de status e ícones de marca.
* **`6px` (Medium Radius):** Botões padrão (todas as variações), campos de formulário (inputs, selects, textareas) e modais pequenos.
* **`8px` (Large Radius):** Cards de funcionalidade, containers, caixas de destaque e painéis de dados.

---

## 5. Tipografia Dupla (Marca vs. Leitura Fluida)

Utilizamos duas famílias tipográficas complementares importadas via Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,600;0,700;0,800;1,700&display=swap');

:root {
  --sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --display: 'Plus Jakarta Sans', var(--sans);
}
```

### A. Plus Jakarta Sans (`var(--display)`) · Títulos & Marca
Fonte moderna e acolhedora reservada para impacto editorial, números de métricas e identidade da marca.
* **Títulos Principais (H1 / Display):** `font-size: 40px`, `font-weight: 700`, `line-height: 1.15`, `letter-spacing: -0.03em`, `color: var(--ink)`. (Evitar tamanhos > 44px ou peso 800 para não desproporcionar a interface e manter a elegância da Zapier).
* **Títulos de Seção (H2):** `font-size: 22px`, `font-weight: 700`, `letter-spacing: -0.02em`, `color: var(--ink)`, `text-transform: uppercase`.
* **Títulos de Cards (H3):** `font-size: 18px`, `font-weight: 700`, `letter-spacing: -0.01em`, `color: var(--ink)`.
* **Kickers (Sobretítulos):** `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.08em`, `color: var(--graphite)`, `text-transform: uppercase`. (Usar grafite editorial para alto contraste, evitando o uso excessivo de laranja).

### B. Inter UI (`var(--sans)`) · UI, Corpo & Dados
O padrão de ouro para legibilidade técnica em interfaces, tabelas de dados, botões, formulários e logs.
* **Corpo de Texto Grande (`.body-lg`):** `font-size: 16px`, `font-weight: 400`, `line-height: 1.6`, `color: var(--graphite)`.
* **Descrição de Cards (`.card-desc`):** `font-size: 14px`, `font-weight: 400`, `line-height: 1.6`, `color: var(--graphite)`.
* **Textos de UI / Botões / Form Labels:** `font-size: 13px` ou `14px`, `font-weight: 500` ou `600`.
* **Metadados / Legendas / Carimbos de Tempo:** `font-size: 12px`, `font-weight: 600`, `color: var(--graphite)`.

---

## 6. Sistema de Botões & Tamanhos Padronizados (11px, 13px, 15px)

Para garantir uma navegação agradável e equilibrada, nosso sistema adota exatamente **três tamanhos claros de fonte**, todos com raio de borda fixo em **`6px`** e **sem deslocamento vertical no hover (`translateY: 0`)**.

### Escala de Tamanhos (`size`)
* **Small (`sm`):** `font-size: 11px`, `padding: 6px 14px`, `height: ~32px`. (Para toolbars, tabelas, filtros e ações em listas densas).
* **Medium (`md`):** `font-size: 13px`, `padding: 10px 20px`, `height: ~38px`. (Padrão universal para formulários, cards e modais).
* **Large (`lg`):** `font-size: 15px`, `padding: 14px 28px`, `height: ~44px`, `font-weight: 700`. (CTAs principais em cabeçalhos ou destaques de página).

### Variações de Estilo (`variant`)
1. **Primary (`primary`):** Fundo `--accent` (`#7C3AED`), texto branco. Hover: Fundo `--accent-hover` (`#6D28D9`). Reservado para a ação principal da tela.
2. **Enterprise (`enterprise`):** Fundo `--ink` (`#111111`), texto `--paper`. Hover: Fundo `--ink-soft` (`#262626`). Para ações corporativas ou secundárias de alta relevância.
3. **Outline (`outline`):** Fundo `--surface`, texto `--ink`, borda `1px solid var(--line)`. Hover: Fundo `--surface-2`, borda `--ink`.
4. **Ghost (`ghost`):** Fundo transparente, texto `--ink`. Hover: Fundo `--surface-2`, texto `--accent`.
5. **Link (`link`):** Fundo transparente, texto `--accent`, sem borda ou padding. Hover: Texto `--accent-hover`.

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
* **Estado Normal:** `background: var(--surface-2)`, `border: 1px solid var(--line)`, `border-radius: 8px`, `padding: 32px`.
* **Estado Hover:** `border-color: var(--accent)`, `background: var(--surface)`. (A borda ilumina em roxo suavemente, sem criar sombras ou saltos verticais).

### B. Badges de Indicadores (`.badge`)
* **Especificação:** `font-size: 11px`, `font-weight: 600`, `padding: 4px 10px`, `border-radius: 4px`, `background: var(--surface)`, `border: 1px solid var(--line)`, `color: var(--graphite)`, `text-transform: uppercase`.

### C. Logo Oficial (`/images/logo.png`)
* A logo oficial do manypost está em `public/images/logo.png` — um mark quadrado (500×500) roxo.
* **No Header:** Utilizar `<img src="/images/logo.png" alt="" width="28" height="28" />` com estilo `height: 28px; width: auto; object-fit: contain; display: inline-block;`, acompanhada do wordmark `manypost` em fonte Display.
* O `alt` fica vazio porque o wordmark textual ao lado já nomeia a marca; o link é rotulado por `aria-label`.
* **O wordmark é sempre em caixa baixa** — inclusive em início de frase, título e `<title>`. Nunca "manypost" ou "manypost".

---

## 8. Boas Práticas para Agentes de IA ao Escrever Código Astro / HTML

1. **Sempre importe o CSS Global:** Certifique-se de que `../styles/global.css` (ou equivalente) está importado na página ou layout principal.
2. **Utilize o Componente `<Button />`:** Ao criar botões em arquivos `.astro`, prefira usar o componente pré-construído `<Button variant="..." size="...">Texto</Button>`.
3. **Não invente classes utilitárias *ad-hoc*:** Evite adicionar `box-shadow`, `border-radius: 20px`, ou fontes gigantes nas tags inline. Utilize sempre os tokens e classes documentados acima.
4. **Respeite o Espaçamento:** Em layouts de grade (`grid-2`, `grid-3`, `grid-4`), mantenha o gap em `24px`, `36px` ou `40px` e padding de seções em `88px 0` (`.section-block`).
5. **Simplicidade e Clareza:** Em caso de dúvida sobre animações ou decorações excessivas, opte sempre pela **simplicidade limpa e funcional**. A elegância do sistema vem do contraste e da facilidade de uso, não do excesso.
