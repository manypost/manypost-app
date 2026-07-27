# A home que não existe, e o plano de evolução do app — 2026-07-27

> **Companheiro de** [`2026-07-27-ai-slice-review-and-proposals.md`](2026-07-27-ai-slice-review-and-proposals.md),
> que revisa a fatia de IA. Este documento olha para o **produto inteiro**: o que a pessoa vê
> quando entra, o que ela precisa saber, e o que a plataforma já sabe e não conta.
>
> A observação que originou este documento — *"a home ainda tá simples demais"* — está correta,
> e a razão é mais forte do que "simples": **não existe home.** A verificação está abaixo.

---

## 1. O achado central: `/` não é uma tela, é um `redirect`

```ts
// apps/web/src/app/page.tsx — arquivo completo, 6 linhas
import { redirect } from 'next/navigation';

// raiz do app: o middleware já barrou quem não tem sessão (vai p/ /login)
export default function Home() {
  redirect('/calendario');
}
```

E o grupo autenticado não tem página raiz — `ls apps/web/src/app/(app)/` devolve apenas
`calendario/ compor/ conexoes/ configuracoes/ kanban/ midia/ notificacoes/ planos/ layout.tsx`.

Consequências concretas:

1. **A primeira tela do produto é uma ferramenta, não um panorama.** O calendário responde
   *"o que está agendado nesta semana?"*. É uma boa pergunta — não é a **primeira** pergunta.
2. **A navegação não tem âncora.** A sidebar (`components/shell/app-sidebar.tsx:25-29`) tem
   Calendário, Kanban, Mídia, Conexões. Não há "Início". Clicar no wordmark leva a
   `/calendario` (`app-sidebar.tsx:141`), então nem o gesto universal de "voltar ao começo"
   existe.
3. **Não há cabeçalho de página em nenhuma tela.** O título vive na topbar
   (`components/shell/topbar.tsx:91-94`), e o `design.md §13` especifica um cabeçalho de página
   com título, **descrição** e ações à direita — que não foi implementado em lugar algum. O
   resultado é que nenhuma tela explica o que ela é ou o que fazer nela.
4. **A topbar tem 56px de altura e três coisas:** título, notificações, avatar. O `design.md`
   prevê ali breadcrumb (§12.2) e busca compacta (§12.3). Nenhum dos dois existe. Não há busca
   em nenhum lugar do app — nem de post, nem de mídia, nem de canal.

---

## 2. O teste das 9h da manhã

A pergunta que importa não é "a home é bonita?", é: **uma pessoa que abre o manypost de manhã
consegue saber se está tudo bem?** Abaixo, cada pergunta real de quem opera redes sociais, e
onde a resposta está hoje.

| A pergunta das 9h | Onde está a resposta hoje | Custo |
|---|---|---|
| "Algo falhou de madrugada?" | Kanban, coluna `failed` (`kanban-view.tsx:33-39`) — se a pessoa souber ir lá | 1 clique + varredura visual, sem contagem |
| "Tem post esperando minha aprovação?" | Kanban, coluna `awaiting` | idem |
| "Algum canal desconectou?" | `/conexoes`, olhando o `status` de cada cartão (`ChannelStatus` inclui `REFRESH_REQUIRED`, `PENDING_ACCOUNT_SELECTION`) | 1 clique + leitura item a item, **sem nenhum alerta em outro lugar** |
| "Algo publicou parcialmente?" | Estado `PARTIAL` do grupo existe no contrato (`contracts/src/enums.ts:20`) e **nenhuma tela o destaca** | não há caminho |
| "O que sai hoje?" | Calendário na visão semana — hoje é uma coluna entre sete | leitura |
| "Quanto do meu plano eu já usei?" | `/planos` | 1 clique |
| "Quantos créditos de IA sobraram?" | Só dentro do dropdown de IA no composer (`features/ai/ai-actions.tsx:174-178`) | abrir composer, selecionar canal, abrir menu |
| "O que aconteceu desde ontem?" | Sino de notificações (`notifications-menu.tsx:29`) | 1 clique |
| "Como meus posts performaram?" | **Não existe.** `channel_metrics` está no schema (`packages/db/src/schema/content.ts:279-290`) e nada escreve nela | impossível |

O padrão: **o produto tem os sinais e não tem o painel.** Cada resposta exige que a pessoa
saiba onde procurar, e três das mais urgentes (falha, canal caído, publicação parcial) não têm
nenhuma superfície proativa. Quem opera 8 canais descobre que o token do Instagram expirou
quando um post falha — não antes.

---

## 3. O que a plataforma já sabe e não mostra

Este é o argumento mais forte para priorizar a home: **ela é, em grande parte, montagem — não
backend novo.** Inventário do que já está exposto e não é consumido:

| Sinal | Já disponível em | Estado na UI |
|---|---|---|
| Plano, status da assinatura, fim do período, cancelamento agendado | `GET /v1/capabilities` → `plan.{tier,status,period,currentPeriodEnd,cancelAt}` (`capabilities.routes.ts:18-23`) | só em `/planos` |
| **Uso vs. limite** de canais, posts do mês, webhooks, chaves de API | `plan.limits` + `plan.usage` (`capabilities.routes.ts:26-39`) — os quatro pares, prontos | só em `/planos` |
| Franquia de IA: concedido, usado, reservado, restante, renovação | `ai.credits` (`capabilities.routes.ts:49-63`) | dentro de um dropdown do composer |
| IA habilitada / modelo enxerga imagem | `ai.enabled`, `ai.canDescribeImages` | usado para esconder botões |
| Publicações por janela, estado e canal, com cursor keyset | `GET /v1/publications?from&to&state&channelId` (`publications.routes.ts:126-142`) | calendário e kanban |
| Estados ricos: `FAILED`, `NEEDS_REVIEW`, `RETRYING`, `TOKEN_REFRESH`, `PARTIAL`, `awaitingApproval` | `contracts/src/enums.ts:7-21`, embutidos em cada item do feed | kanban agrupa 5 deles; `PARTIAL`, `RETRYING` e `TOKEN_REFRESH` não têm destaque |
| `errorClass` e `errorMessage` por publicação | serializados no feed (`publications.routes.ts:100-101`) | visíveis no cartão, sem agregação |
| `attemptCount` | idem | não usado |
| Saúde do canal (`ACTIVE`/`REFRESH_REQUIRED`/`PENDING_ACCOUNT_SELECTION`/`DISABLED`) | `GET /v1/channels` → `status` (`channels.routes.ts:23`) | cartão em `/conexoes` |
| Notificações com `readAt` | `GET /v1/notifications` | sino + página |
| `audit_log` (quem fez o quê) | tabela populada, inclusive pelas operações de IA | **nenhuma tela** |
| Endpoints REST/MCP da instalação | `endpoints` no capabilities | Configurações |

Nada nessa tabela precisa de migration. Uma home útil sai de composição — com **uma** adição de
backend, discutida na [§4.3](#43-o-endpoint-que-falta).

---

## 4. Proposta: a tela `/inicio`

### 4.1 Princípio

Não é um dashboard de vaidade. É um **painel operacional**: responde "está tudo bem?" em três
segundos e oferece o próximo passo. O `design.md §36.4` já dá o tom certo — *"evitar linguagem
promocional dentro do app operacional"*. A home não celebra: informa e encaminha.

Regra de ouro para cada bloco: **se não há nada a dizer, o bloco desaparece.** Uma home com seis
cartões vazios é pior que o `redirect` atual.

### 4.2 Layout

Duas colunas acima de 1200px (`design.md §37.3`), uma coluna abaixo. Right rail conforme
`§30.2` (260–300px), virando drawer abaixo de 1200px (`§30.3`).

```
┌─────────────────────────────────────────────────────────┬──────────────────┐
│ Cabeçalho de página (§13)                               │  Atividade       │
│ "Bom dia, {nome}" · descrição · [Novo post]             │  recente         │
├─────────────────────────────────────────────────────────┤  (§30)           │
│ ⚠ PRECISA DE ATENÇÃO   ← só aparece se houver algo      │                  │
│ 2 falhas · 1 canal a reconectar · 3 aguardando aprovação│  linhas densas   │
│ [Ver falhas] [Reconectar] [Revisar]                     │  40–50px,        │
├─────────────────────────────────────────────────────────┤  sem cards       │
│ SAI HOJE (4)                                            │  individuais     │
│ 09:00 ▸ LinkedIn — "Abrimos aos domingos…"      [editar]│                  │
│ 12:30 ▸ Instagram + X — "Bastidores…"           [editar]│  ─────────────   │
│ …                                                       │                  │
├──────────────┬──────────────┬───────────────────────────┤  Franquia de IA  │
│ Posts do mês │ Canais       │ Próximos 7 dias           │  312 de 500      │
│ 23 / 60      │ 6 / 10       │ 11 agendados              │  renova em 01/08 │
│ ▓▓▓▓░░░░░░   │ ▓▓▓▓▓▓░░░░   │ 2 dias sem nada           │                  │
└──────────────┴──────────────┴───────────────────────────┴──────────────────┘
```

### 4.3 Bloco por bloco

| Bloco | Responde | Fonte | Novo backend? |
|---|---|---|---|
| **Precisa de atenção** | "está tudo bem?" | contagens de `FAILED`, `NEEDS_REVIEW`, `awaitingApproval`, `PARTIAL` + canais com status ≠ `ACTIVE` | sim — ver abaixo |
| **Sai hoje** | "o que acontece nas próximas horas?" | `GET /v1/publications?from=hoje&to=amanhã` | **não** |
| **Uso do plano** (3 medidores) | "estou perto de um limite?" | `plan.limits` + `plan.usage` | **não** |
| **Franquia de IA** | "quanto sobrou?" | `ai.credits` | **não** |
| **Próximos 7 dias / lacunas** | "minha semana tem buracos?" | feed dos próximos 7 dias, agrupado por dia | **não** |
| **Atividade recente** | "o que mudou desde ontem?" | notificações + `audit_log` | expor `audit_log` (leitura, filtrado por org) |
| **Primeiros passos** (só org nova) | "por onde começo?" | derivado: 0 canais → conectar; 0 posts → compor; IA ligada e nunca usada → experimentar | **não** |

#### 4.3 O endpoint que falta

Os medidores e o bloco de atenção precisam de **contagens**, e o feed de publicações é keyset com
`limit` — contar exige paginar até o fim, o que é errado para uma tela que abre a cada visita.
Proposta: `GET /v1/insights/summary?tz=America/Sao_Paulo`, uma consulta agregada por org:

```jsonc
{
  "attention": {
    "failed": 2, "needsReview": 0, "awaitingApproval": 3, "partial": 1,
    "channelsNeedingAction": [{ "channelId": "…", "status": "REFRESH_REQUIRED" }]
  },
  "today":    { "scheduled": 4, "published": 1, "nextAt": "2026-07-27T12:30:00Z" },
  "next7d":   { "scheduled": 11, "byDay": [2,3,0,1,4,1,0] },
  "last30d":  { "published": 42, "failed": 3 }
}
```

Requisitos que este endpoint tem de respeitar, pelas regras da casa:

- filtro por `org_id` em toda consulta (`CLAUDE.md` regra 3);
- `tz` explícito, porque "hoje" é uma pergunta de fuso — e o precedente correto já existe em
  `ai-best-times.ts:92-108` (conversão por `Intl`, não por offset fixo);
- cacheável por 30–60 s no Redis, degradando aberto sem Redis (mesma política da fila,
  `SPEC_QUEUE §6`);
- **não** é analytics de desempenho: são contagens do nosso próprio banco. Isso mantém a home
  independente da onda de ingestão de métricas.

### 4.4 Estados que a home tem de tratar bem

O `design.md §28.1` pede que o empty state descreva o próximo passo. Três casos, e nenhum é
detalhe:

1. **Organização nova, zero canais.** A home **é** o onboarding: um bloco "Primeiros passos" com
   conectar canal → criar primeiro post → (se houver IA) gerar uma legenda. Hoje o
   `/boas-vindas` existe (`app/(onboarding)/boas-vindas/page.tsx`) e é de billing; não há
   checklist de produto em lugar algum.
2. **Tudo em ordem.** O bloco de atenção **desaparece** — não vira "nenhum problema 🎉". Silêncio
   é a mensagem (`design.md §3.3`, regra de silêncio visual).
3. **Self-hosted.** `capabilities.selfHosted` e `plan.enforced: false`: os medidores de plano
   não fazem sentido e devem sair. A franquia de IA continua fazendo (o BudgetGuard contabiliza
   sem recusar, `ai-budget.ts:71-73`) — mostrada como **consumo**, não como saldo.

### 4.5 Pré-requisitos de design system

Aqui a home colide com o [conflito documentado no relatório da IA](2026-07-27-ai-slice-review-and-proposals.md#o-conflito-que-precisa-ser-resolvido-antes-de-tudo).
Para os cartões de KPI, o `design.md` pede coisas que o brand system hoje **não tem**:

| `design.md` pede | Estado real |
|---|---|
| §20.1 `border-radius: var(--mp-radius-xl)`; §47.2 card radius **10px**; §47.3 KPI radius **12px** | `scripts/check-brand.ts:38-41` só aceita 4/6/8 — 10px e 12px **reprovam o CI** |
| §20.1 `background: var(--mp-accent-soft)` e um `#EEF5FD` (azul) | `globals.css` não tem token azul nenhum (`grep -n "blue\|teal" globals.css` → vazio) |
| §47.3 série secundária de analytics `#14B8A6` (teal) | não existe token teal |
| §20.2 *"sem borda e sem sombra"* em KPI | compatível com o brand, desde que a profundidade venha do gradiente (`.bevel-*`) |

**Não se constrói a home sem resolver isso primeiro** — ou os cartões nascem fora de spec, ou
nascem reprovando o CI. É uma tarde de trabalho: adendo de reconciliação no `design.md` + tokens
novos registrados como exceção (`design.md §46.15` exige o registro).

---

## 5. Além da home: onde o app tem mais a ganhar

Ordenado por **valor por unidade de esforço**, com evidência do estado atual.

### 5.1 Confiança operacional (o que faz alguém confiar a marca dele a nós)

| Proposta | Por que | Estado hoje |
|---|---|---|
| **Central de falhas** com agrupamento por `errorClass`, "tentar de novo" em lote e explicação do erro em português | Hoje uma falha é um cartão vermelho no kanban. Com 8 canais e 40 posts/semana isso não escala | `errorClass`/`errorMessage`/`attemptCount` já vêm no feed (`publications.routes.ts:100-102`); `POST /v1/posts/{groupId}/retry` já existe |
| **Alerta proativo de canal expirando** | `REFRESH_REQUIRED` só é visto por quem entra em `/conexoes`. Token expirado = post perdido, e o post perdido é o pior defeito possível de uma plataforma de agendamento | status existe; falta banner (`design.md §27.3`: banner é para "manutenção, conectividade, cobrança") + notificação |
| **Destaque para `PARTIAL`** | Publicou em 3 de 5 canais: hoje nenhuma tela diz isso com clareza. É o estado que mais confunde | `GroupStates` inclui `PARTIAL` (`enums.ts:20`) |
| **Tela de histórico/auditoria** | `audit_log` registra tudo (inclusive as operações de IA) e não há como olhar. Para uma agência, "quem mudou esse post?" é pergunta semanal | tabela populada, zero superfície |

### 5.2 Navegação e arquitetura de informação

| Proposta | Por que | Estado hoje |
|---|---|---|
| **Command palette (⌘K)** | Especificada em detalhe no `design.md §24.3` (largura 560–640, linhas de 40px, foco no campo). Com 9 rotas + N canais + N posts, é o atalho que transforma a sensação do produto | não existe |
| **Busca** de posts, mídia e canais | `design.md §12.3` especifica a busca compacta da topbar, com o único caso em que raio 999px é permitido. Hoje não há busca em nenhuma tela | não existe |
| **Cabeçalho de página** (§13) em todas as telas | Título + descrição + ações. Hoje o título está na topbar e a descrição não existe — nenhuma tela se apresenta | `topbar.tsx:91-94` |
| **Item "Início" na sidebar** e wordmark apontando para ele | Âncora de navegação | `app-sidebar.tsx:25-29`, `:141` |
| **Breadcrumb** (§12.2) nas telas de profundidade 2 | Composer aberto sobre calendário já confunde; vai piorar com plano da semana | não existe |

### 5.3 Colaboração — a lacuna estrutural

A tabela `memberships` existe com papéis `OWNER`/`ADMIN`/`MEMBER`
(`packages/db/src/schema/identity.ts:46-61`, `contracts/src/enums.ts:31`). **Não existe API nem
UI para convidar alguém.** `grep` por rotas de membros/convites em `apps/api/src/http/routes/`
não devolve nada, e `features/settings/` tem só perfil, chaves de API e webhooks.

Ou seja: o modelo de dados é multiusuário, o produto é monousuário. O fluxo de aprovação
funciona por **link público** (`approvals-public.routes.ts`, `/approve/[token]`) — o que é uma
boa decisão para o aprovador externo (o cliente da agência não precisa de conta), mas não
substitui equipe. Uma agência com três pessoas não tem como usar o manypost hoje sem
compartilhar senha.

**Proposta:** convites por e-mail, papéis, e o `audit_log` passando a mostrar nomes. É a
diferença entre uma ferramenta pessoal e uma ferramenta de agência — e o `PLANS.md` vende planos
por organização.

### 5.4 Alavancagem de conteúdo (o que faz voltar todo dia)

| Proposta | Por que |
|---|---|
| **Modelos (templates)** de post por canal | Toda equipe repete estruturas. Hoje "duplicar post" existe (o composer tem `loadDraft` com `ComposerPrefill`, `composer/store.ts:157+`) — modelo é o passo natural |
| **Reaproveitar/republicar** um post que foi bem | O `publishAt` já é editável e o duplicar existe; falta a intenção explícita e a proteção contra republicar cedo demais |
| **Fila recorrente por canal** ("segunda 9h, quarta 12h") | Combina com o `ai_best_time` e com o plano da semana: horários fixos + IA preenchendo os slots é o fluxo que economiza tempo de verdade |
| **Séries/campanhas** agrupando posts | Pré-requisito para `ai_campaign_reports`, que está gateada no Premium |
| **Ações em lote** no kanban e na lista | Cancelar 5 posts hoje = 5 fluxos |

### 5.5 A onda de métricas (destrava quatro coisas)

`channel_metrics` existe no schema e ninguém escreve nela. Ligá-la destrava, de uma vez:
`analytics` (não há tela), `ai_campaign_reports` e `ai_engagement_alerts` (gateadas no Premium
sem runtime) e converte o `ai_best_time` de tautologia em medição — ver
[o Achado 3 do relatório da IA](2026-07-27-ai-slice-review-and-proposals.md#3-melhor-horário-mede-quando-você-publica-não-quando-funciona).

**Duas armadilhas para registrar antes de codar:**

1. **`channel_metrics` não tem `org_id`** (`content.ts:279-290`: chave é
   `channelId + metric + day`). A regra 3 do `CLAUDE.md` exige filtro por `org_id` em todo
   repositório. Dá para satisfazer por join em `channels`, mas isso precisa ser **decidido e
   escrito** — não descoberto durante a implementação. Uma coluna `org_id` desnormalizada é
   provavelmente a escolha certa, e é migration aditiva.
2. **Cada rede tem sua própria API de insights, seu próprio atraso e seu próprio rate limit.**
   Isso não é uma onda de uma semana. Recomendação: começar por **uma** rede com API de métricas
   estável e um contrato que aguente as outras, em vez de seis meias-integrações.

E o pré-requisito de design: `design.md §29` (gráficos) e §47.3 (paleta analítica) precisam dos
tokens que não existem (§4.5 acima).

### 5.6 Higiene transversal

| Item | Evidência |
|---|---|
| **Nenhum teste de navegador no repositório.** Todos os E2E são scripts de API (`scripts/e2e-*.ts`); não há `.spec.ts` de Playwright em `apps/web` | ver [Achado 12 do relatório da IA](2026-07-27-ai-slice-review-and-proposals.md#12-a-ui-foi-aprovada-sem-nenhuma-evidência-visual) |
| **`check:brand` cobre 5 regras** (hex, sombra, transform no hover, raio, wordmark) de uma spec com 20 regras invioláveis | `scripts/check-brand.ts:19-46` |
| **Atalhos de teclado** inexistentes fora do que os primitivos dão de graça | — |
| **`prefers-reduced-motion`** só tratado para `.brand-mark*` | `globals.css:417` |
| **i18n**: o sistema existe (`next-intl` + `messages/pt-BR.json`) e features novas o contornam | `features/ai/*` não importa `next-intl` |

---

## 6. Ordem recomendada

| Onda | Conteúdo | Justificativa da posição |
|---|---|---|
| **A — desbloqueio** | Adendo de reconciliação do `design.md` + tokens de KPI/analytics registrados como exceção | Sem isso, qualquer cartão de KPI nasce fora de spec ou reprovando o CI. Uma tarde |
| **B — home v1** | `/inicio` com atenção, sai hoje, medidores de plano/IA, primeiros passos + item na sidebar + cabeçalho de página. Sem `audit_log`, sem gráficos | Só composição do que já existe, exceto o `/v1/insights/summary` |
| **C — portão de UI** | E2E de navegador (home + composer) e `check:brand` estendido | Antes de acumular mais UI, ter como verificá-la. Se isto escorregar, as ondas seguintes repetem os mesmos achados |
| **D — confiança operacional** | Central de falhas, alerta de canal expirando, destaque de `PARTIAL`, tela de auditoria | É o que evita perder um post — o dano mais caro do produto |
| **E — navegação** | Command palette, busca, breadcrumb | Muda a sensação do produto por esforço baixo |
| **F — colaboração** | Convites, papéis, nomes na auditoria | Destrava o cliente de agência que o `PLANS.md` vende |
| **G — alavancagem** | Modelos, fila recorrente, ações em lote, séries | Retenção diária |
| **H — métricas** | Ingestão por uma rede + analytics + fechar o laço do `best_time` | A maior das ondas, e a que mais destrava. Depois de E/F porque exige as anteriores estáveis |

Cada onda abre sua mudança OpenSpec antes da implementação (`bun run spec:new`,
`bun run spec:validate` — `AGENTS.md`), e fecha com os **dois** registros: `CHANGELOG.md` da raiz
+ `docs/principal/STATUS.md` e `CHANGELOG_ONDAS.md` (`CLAUDE.md`).

Nomes sugeridos: `add-home-dashboard`, `add-insights-summary-endpoint`,
`reconcile-design-system-tokens`, `add-web-e2e-coverage`, `add-failure-center`,
`add-command-palette`, `add-team-membership`, `add-post-templates`,
`add-channel-metrics-ingestion`.

---

## 7. O que **não** fazer

1. **Não transformar a home em analytics.** Enquanto `channel_metrics` estiver vazia, qualquer
   gráfico na home é enfeite — ou pior, é número inventado. A home v1 mostra **contagens do
   nosso próprio banco**, que são verdadeiras hoje.
2. **Não usar KPI de vaidade.** "Total de posts publicados desde sempre" não muda decisão
   nenhuma. Cada número na home tem de responder uma das perguntas da [§2](#2-o-teste-das-9h-da-manhã).
3. **Não preencher espaço.** `design.md §43.5`: *"não adicionar gridlines visíveis apenas para
   preencher espaço"* — o princípio vale para cartões também. Bloco sem conteúdo desaparece.
4. **Não fazer a home antes do adendo de tokens.** Ver [§4.5](#45-pré-requisitos-de-design-system).
5. **Não construir seis integrações de métricas em paralelo.** Uma rede, contrato bom, depois as
   outras.
6. **Não mover o calendário.** Ele é a ferramenta central e funciona; a home passa a ser a porta,
   não a substituta. `/calendario` continua sendo o destino de um clique.

---

## 8. Questões abertas para o owner

| # | Questão | Por que precisa de você |
|---|---|---|
| 1 | A home é `/` (redirect deixa de existir) ou `/inicio` com `/` apontando para ela? | Prefiro `/inicio` real + `/` redirecionando: URL nomeada é melhor para link e histórico. Mas quebra o hábito de quem já usa |
| 2 | Equipe (convites/papéis) entra antes ou depois de alavancagem de conteúdo? | É a maior decisão de posicionamento: ferramenta pessoal vs. ferramenta de agência |
| 3 | Qual rede social começa a ingestão de métricas? | Depende de qual acesso de API você já tem aprovado — ver `platform-gates.md` |
| 4 | Os tokens novos (KPI azul suave, teal analítico) entram no brand system ou o `design.md` cede para a paleta atual? | Bloqueia a onda A, que bloqueia a home |
| 5 | Analytics é feature de plano (gate) ou base? | Muda o desenho da tela e do endpoint |

---

## Referências

- [`design.md`](../../design.md) v3.0 — §12 (topbar), §13 (cabeçalho de página), §20 (KPI),
  §24.3 (command palette), §28 (empty/loading), §29 (gráficos), §30 (right rail), §37
  (responsividade), §43 (regras invioláveis), §46 (lint), §47.2/§47.3 (presets)
- `docs/brand/BRAND_SYSTEM.md` + `scripts/check-brand.ts` — o que o CI realmente impõe
- [`docs/specs/SPEC_FRONTEND.md`](../specs/SPEC_FRONTEND.md) — §3.1/§3.2 (calendário e kanban)
- [`docs/principal/PLANS.md`](../principal/PLANS.md) — o que cada plano vende
- [`2026-07-27-ai-slice-review-and-proposals.md`](2026-07-27-ai-slice-review-and-proposals.md) —
  a fatia de IA, incluindo a proposta de geração de imagem
- Código citado: `apps/web/src/app/page.tsx`, `apps/web/src/app/(app)/layout.tsx`,
  `apps/web/src/components/shell/{app-sidebar,topbar}.tsx`,
  `apps/api/src/http/routes/{capabilities,publications,channels}.routes.ts`,
  `packages/contracts/src/enums.ts`, `packages/db/src/schema/{content,identity}.ts`
</content>
