# Revisão crítica da fatia de IA (PR #52) e propostas de evolução — 2026-07-27

> **O que este documento é:** uma revisão pós-merge, adversarial e com evidência, da
> [PR #52](https://github.com/manypost/manypost-app/pull/52) (`feat(ai)`, merge `9b7c81e`),
> mais um plano de evolução — incluindo **geração de imagem**, que a
> [`SPEC_AI`](../specs/SPEC_AI.md) já especifica (`ai.image`, 5 créditos) e o PR não entregou.
>
> **O que este documento não é:** um veto ao PR. A fatia é boa: a arquitetura de portas, o
> BudgetGuard transacional e a honestidade do texto do PR estão acima da média do repositório.
> A crítica abaixo é dura de propósito — o pedido foi "extremamente crítica" —, e a maior parte
> dela ataca o **último centímetro**: a distância entre um backend correto e uma interface que
> entrega o valor que a landing vende.

## Método e limites da verificação

| O que foi feito | Como |
|---|---|
| Leitura do PR completo | `gh pr view 52`, `git show 9b7c81e` (75 arquivos, +14.192/−779) |
| Leitura integral do código de IA | `packages/core/src/{infra,application}/ai*`, `use-cases/ai*.ts`, `apps/api/src/http/routes/ai.routes.ts`, `apps/web/src/features/ai/*`, `packages/db/src/repositories/ai-credits.repo.ts` |
| Análise da UI contra a especificação | [`design.md`](../../design.md) v3.0 (§2.1, §3.3, §3.4, §6.3, §6.4, §14.2, §24, §27, §28, §34, §35, §36, §43, §46) + `scripts/check-brand.ts` |
| Rastreio de contrato | `packages/contracts/src/billing.ts`, `packages/core/src/application/ports/*`, `apps/web/src/lib/api/schema.d.ts` |

**Limites declarados, para este relatório não afirmar mais do que verificou:**

1. **Não houve inspeção visual em navegador.** Subir a superfície de IA exige stack completa
   (Postgres + Redis + API + provedor) **e** uma organização em plano Pro/Premium com
   `AI_PROVIDER` configurada. Toda a análise de UI abaixo é de **código contra especificação**.
   Isso não é uma desculpa — é justamente o [Achado 12](#12-a-ui-foi-aprovada-sem-nenhuma-evidência-visual).
2. **Nenhum teste foi executado nesta revisão.** Os números de validação citados são os do
   autor do PR, tratados como declaração dele, não como verificação minha.
3. Os achados de comportamento são derivados por leitura. Cada um traz o cenário concreto de
   falha para ser reproduzido — não confie neles sem reproduzir.

---

## Veredicto em uma tabela

| Camada | Estado | Nota |
|---|---|---|
| `infra/ai` (adapters, classificação de falha, teto de tempo/saída) | **Sólido** | A escolha de nomear pelo protocolo HTTP e não pelo fornecedor é acertada e o `truncatedByCap` resolve um problema real que a maioria das implementações entrega truncado |
| BudgetGuard + `ai_credits`/`ai_grants` | **Sólido** | Reserva de duas fases com concessão em uma instrução condicional; teste de concorrência mutado para provar que não é vazio |
| Use-cases de geração | **Bom, com custos escondidos** | Ordem plano→franquia→modelo correta; mas latência serial e ausência de sucesso parcial ([A4](#4-caption-multicanal-é-serial-e-tudo-ou-nada), [A5](#5-nenhuma-idempotência-numa-superfície-que-gasta-dinheiro)) |
| `ai_best_time` | **Honesto no código, enganoso na UI** | O sinal é frequência de publicação, não desempenho ([A3](#3-melhor-horário-mede-quando-você-publica-não-quando-funciona)) |
| Superfície HTTP/MCP | **Bom, com lacunas** | Sem idempotência, sem chave de API, rate-limit único para rota grátis e paga |
| **Interface web** | **É onde a fatia perde** | Um defeito de perda de dados ([A1](#1-p0--reescrever-no-editor-global-destrói-texto-sem-avisar)), a promessa central não entregue ([A2](#2-p0--adaptar-para-a-rede-cobra-por-canal-e-descarta-todos-menos-um)), uma feature Premium sem tela ([A6](#6-ai_calendar-é-cobrada-no-premium-e-não-tem-interface)), i18n contornada ([A9](#9-i18n-contornada-em-toda-a-superfície-nova)) |
| Geração de imagem | **Ausente** | Especificada na `SPEC_AI §3` com custo 5; port tem o slot vazio e com forma de um fornecedor ([Proposta 1](#proposta-1--geração-de-imagem-ai_image)) |

**Uma frase:** o PR construiu um motor de IA muito melhor do que o volante que ligou nele.

---

## Achados

Ordenados por severidade. Cada um traz: evidência (`arquivo:linha`), cenário de falha e correção
proposta.

### 1. `[P0]` "Reescrever" no editor global destrói texto sem avisar

**Evidência**
- `apps/web/src/features/ai/ai-actions.tsx:99` — `const primeiroCanal = channelIds[0]`
- `apps/web/src/features/ai/ai-actions.tsx:129-133` — `reescrever()` manda **só** `primeiroCanal`
  e aplica o retorno com `onApply`, que **substitui o conteúdo inteiro**
  (`ai-actions.tsx:89-91`)
- `packages/core/src/application/use-cases/ai.ts:213` — o retorno passa por
  `shortenTo(text, brief.maxLength)`, com `maxLength` do **único canal enviado**
- `packages/providers/src/x/x.provider.ts:204-205` — X: 280 (4000 se verificado);
  `packages/providers/src/linkedin/linkedin.provider.ts:21` — LinkedIn: 3000

**Cenário de falha (reprodutível)**

1. A pessoa seleciona X e LinkedIn, nessa ordem, e escreve 1.200 caracteres na aba global.
2. Clica em **Corrigir** ("Corrija ortografia e gramática, sem mudar o estilo").
3. O back reescreve contra o limite do **primeiro** canal (X, 280) e corta com `shortenTo`.
4. `onApply` substitui o editor global. **Cerca de 920 caracteres desaparecem.** A ação pedida
   foi "corrigir ortografia".
5. `shortened: true` volta na resposta e **a UI não lê esse campo** ([A8](#8-shortened-é-calculado-documentado-e-ignorado-pela-interface)).
   Não há aviso, não há confirmação, não há desfazer explícito.

O inverso também é ruim e mais sutil: se o primeiro canal for o Facebook (63.206), o texto do
LinkedIn passa sem corte mas o do X quebra depois, no agendamento.

**Por que é P0:** é perda de trabalho do usuário, silenciosa, disparada por uma ação que ele
leria como inofensiva, num controle que a interface apresenta como assistivo. Nenhum teste cobre
isso — o único teste de UI da fatia testa duas funções puras (`ai-actions.test.tsx`).

**Correção proposta**

1. Na aba global, reescrever **sem canal** (ver Proposta 5: `channelId` opcional em
   `/v1/ai/rewrite`, e sem canal não se aplica `shortenTo`); ou, se um canal for exigido pelo
   contrato, usar o **menor** `maxLength` entre os selecionados e **avisar**.
2. `onApply` nunca substitui sem revisão: passar pelo painel de revisão da
   [Proposta 3](#proposta-3--revisão-antes-de-aplicar-diff-variantes-e-desfazer).
3. Teste de regressão: rewrite com dois canais de limites diferentes não pode encurtar o texto
   global; texto encurtado tem de renderizar o aviso.

---

### 2. `[P0]` "Adaptar para a rede" cobra por canal e descarta todos menos um

**Evidência**
- `apps/web/src/features/composer/composer-view.tsx:440-443` — na aba global,
  `AiActions` recebe `channelIds={store.channelIds}` (**todos** os selecionados)
- `apps/web/src/features/ai/ai-actions.tsx:122-127` — `gerarLegenda()` manda todos os canais,
  recebe `variantes` e usa **`variantes[0]`**. As demais são descartadas
- `packages/core/src/application/use-cases/ai.ts:146` — a franquia debitada é
  `CUSTO.caption * canais.length`
- `packages/core/src/application/use-cases/ai.ts:153` — **uma chamada ao modelo por canal**

**Cenário de falha**

Cinco canais selecionados, clique em "Adaptar para a rede":
- 5 chamadas ao provedor (5× latência, 5× custo real de token para o operador);
- **5 créditos debitados** da franquia da organização;
- 4 legendas adaptadas jogadas no lixo antes de qualquer olho humano;
- a legenda do canal 1 é aplicada ao **texto global**, ou seja, vai para os 5 canais.

O controle chama-se "Adaptar para a rede". Ele faz o oposto: gera adaptação por rede e depois
uniformiza. A linha da landing — "IA: adapta o tom e o formato de cada rede" — não é entregue
pelo botão que a nomeia.

**O agravante:** o mesmo componente é montado nos itens de thread com
`channelIds={store.channelIds}` (`composer-view.tsx:575-579`), então um comentário de thread
também cobra N créditos e aplica um.

**Correção proposta** — pequena, e o padrão certo já existe no PR:
`DraftFromIdea` faz exatamente isso em `composer-view.tsx:345-350` (`setOverride` por canal +
`bumpEditors`). Basta a `gerarLegenda` aplicar cada variante como override do seu canal, e a aba
global mostrar "5 versões geradas — revise por canal". Custo da correção: dezenas de linhas.

---

### 3. "Melhor horário" mede *quando você publica*, não *quando funciona*

**Evidência**
- `packages/core/src/application/use-cases/ai-best-times.ts:153-158` — a única fonte é
  `publishing.listDeliveredTimes(...)`: **os instantes em que a própria org publicou**
- `ai-best-times.ts:172-184` — `score = n / maior`, isto é, **frequência de publicação**
  normalizada
- `ai-best-times.ts:112-113` — `confidence: 'high'` a partir de 25 amostras
- `apps/web/src/features/ai/best-time-hint.tsx:30-34` — a UI traduz `medium`/`high` para
  **"baseado no seu histórico"**

**Por que é grave**

O código é honesto: o comentário do arquivo diz "tecnicamente é heurística, e este arquivo não
esconde isso" (`ai-best-times.ts:10-17`). A **interface** é que esconde. Para o usuário,
"baseado no seu histórico (37 publicações)" com confiança alta lê-se como "medimos o que
funcionou para você". Não medimos nada: recomendamos os horários em que ele **já** publica. É um
laço fechado — o usuário agenda no horário sugerido, isso reforça a contagem daquele horário, e
a confiança sobe. Nenhum sinal de desempenho entra em lugar algum, porque `channel_metrics` está
vazia (o próprio PR declara isso).

Com `sampleSize` alto e nenhum dado de engajamento, o número de confiança mede **consistência de
hábito**, e é apresentado como qualidade de recomendação. Isso é o tipo de coisa que corrói
confiança quando o cliente percebe.

**Correção proposta (imediata, sem depender de ingestão)**

1. Microcopy que descreve o sinal real: *"seus horários mais usados neste canal (37
   publicações)"* — e, para a baseline, o texto atual já está correto.
2. Renomear `confidence` na resposta ou documentá-la explicitamente como
   **confiança na amostra, não no desempenho**. Preferível: adicionar
   `signal: 'own_posting_history' | 'network_baseline' | 'own_engagement'` ao contrato, e a UI
   escrever a frase a partir do `signal`. Isso deixa a ingestão de métricas entrar depois **sem
   mudar o texto de novo**.
3. Enquanto `signal !== 'own_engagement'`, teto de `confidence` em `medium`.

E a correção estrutural é a próxima onda que o próprio PR recomenda: coleta de métricas
(ver [Proposta 6](#proposta-6--fechar-o-laço-do-best_time-com-métricas-de-entrega)).

---

### 4. Caption multicanal é serial e tudo-ou-nada

**Evidência**
- `packages/core/src/application/use-cases/ai.ts:153-174` — `for (const canal of canais)` com
  `await` dentro; nenhuma paralelização, nenhuma concorrência limitada
- `ai.ts:144-177` — tudo dentro de um único `withBudget`: qualquer exceção derruba a operação
  inteira (`ai-budget.ts:140-143` libera a reserva e repropaga)

**Cenário de falha**

O `scripts/live-ai.ts` do próprio PR mediu **5,9 s** para uma geração. Com 5 canais: ~30 s de
espera com um spinner dentro de um dropdown (`ai-actions.tsx:158-162`). Se o canal 4 falhar
(429 do provedor, timeout), os canais 1–3 — já gerados, já pagos em tokens pelo operador — são
descartados e o usuário recebe um erro após 25 s.

**Correção proposta**

1. Paralelizar com concorrência limitada (3–4), preservando a ordem dos canais na resposta.
2. **Sucesso parcial:** devolver `variants` + `failures: [{channelId, code}]` e **confirmar
   apenas os créditos das variantes entregues** (o `withBudget` já suporta: `commit` recebe o
   custo real, então basta o `work` devolver quantos créditos consumiu de fato).
3. Streaming ou progresso incremental na UI ("2 de 5 prontas"), conforme
   `design.md §28.3`: *"progress bar para duração mensurável; mensagem textual para operações
   longas"*. Um spinner de 30 s é explicitamente fora de spec — spinner é "apenas para ações
   locais e curtas".

---

### 5. Nenhuma idempotência numa superfície que gasta dinheiro

**Evidência**
- `apps/api/src/http/middleware/public-api.ts:64-91` — o monorepo **já tem** middleware de
  `Idempotency-Key` com detecção de conflito e header `Idempotency-Replayed`
- `apps/api/src/http/routes/ai.routes.ts:117-138` — `aiRoutes` monta `requireAuth` e o
  rate-limit, e **não** monta idempotência

**Cenário de falha**

Duplo clique, retry de rede, ou o cliente HTTP repetindo um POST cujo `200` se perdeu no
caminho: cada tentativa reserva, chama o modelo e debita. O usuário paga duas vezes por uma
resposta que viu uma vez. Não há como o cliente se defender — o header é aceito, mas ignorado.

O repositório trata isso como requisito em outro lugar: existe uma mudança arquivada
`2026-07-27-harden-publishing-idempotency`. A rota que gasta franquia paga ficou de fora.

**Correção proposta:** aplicar `idempotency(...)` em todos os `POST /v1/ai/*`. Chave derivada de
`orgId + rota + hash do corpo` quando o cliente não mandar uma, com janela curta (60 s) — o
suficiente para matar duplo clique e retry sem transformar geração em cache permanente (regerar
de propósito é caso de uso legítimo, então a chave explícita do cliente tem de vencer).

---

### 6. `ai_calendar` é cobrada no Premium e não tem interface

**Evidência**
- `packages/contracts/src/billing.ts:162` — `ai_calendar` no pacote de features do Premium
- `apps/api/src/http/routes/ai.routes.ts:283-309` — `POST /v1/ai/week-plan` implementada,
  documentada, custo 3 créditos (`use-cases/ai.ts:38`)
- `apps/web/src/features/ai/hooks.ts:33` — `hasCalendar: plan.has('ai_calendar')` — **o único
  uso de `hasCalendar` em todo o `apps/web`** (`grep -rn "hasCalendar" apps/web/src` devolve
  exatamente esta linha)
- `apps/api/src/mcp/mcp-server.ts:304-367` — MCP expõe `generate_content` e
  `suggest_best_times`; **não** expõe week-plan

**Consequência:** a feature "IA: monta e otimiza o calendário da semana" é vendida no Premium e
só é alcançável por `curl`. Nem interface, nem MCP. O `hasCalendar` calculado e não usado é a
prova de que a intenção existia e o trabalho parou antes.

O PR declara honestamente 4 de 8 features. O problema é que **uma das 4 declaradas como
entregues não tem superfície de usuário** — a checagem de "entregue" ficou no nível da rota, não
no nível de alguém conseguir usar.

**Correção proposta:** [Proposta 4](#proposta-4--tela-do-plano-da-semana-ai_calendar). Enquanto
não houver tela, `ai_calendar` deveria sair da lista de features do Premium ou aparecer como
"em breve" — cobrar por algo inalcançável é o problema que este PR nasceu para consertar.

---

### 7. O crédito não tem relação com o custo real

**Evidência**
- `packages/core/src/infra/ai/shared.ts:120-123` — `cappedTokens` faz `void requested` e devolve
  **sempre** `config.maxOutputTokens`
- `packages/core/src/application/use-cases/ai.ts:505-506` — `tokensParaCaracteres` é calculado,
  passado adiante e **descartado** pelo adapter
- `use-cases/ai.ts:38` — custo fixo por operação (caption 1, draft 2, weekPlan 3)
- `packages/core/src/application/use-cases/ai-budget.ts:138` — o `commit` grava
  `credits: input.credits` (o **estimado**), e os tokens reais vão para `ai_grants` como
  telemetria

**A decisão de mandar o teto da instalação é defensável** e está bem argumentada (modelo de
raciocínio). A consequência, que o PR não tira, é econômica:

- Uma legenda de 280 caracteres para o X é cobrada em **1 crédito** e pode consumir 4.000 tokens
  de saída se `AI_MAX_OUTPUT_TOKENS=4000` e o modelo for de raciocínio.
- Uma legenda de 3.000 caracteres para o LinkedIn também custa **1 crédito**.
- O `ai_grants` **sabe** o consumo real e ninguém o usa para nada além de olhar.

No gerenciado isso significa que a margem por organização varia por um fator grande, e depende
do modelo que **o operador** configurou. O PR já classifica "números de franquia são chute
defensável" como não corrigido, mas o problema não é o número — é a **unidade**.

**Correção proposta**

1. Curto prazo: um relatório operacional sobre `ai_grants` (tokens por crédito, por operação,
   por organização) — o dado já está gravado. Sem isso não há como calibrar a franquia.
2. Médio: classes de custo por operação com base em medição, não em palpite — e uma classe
   própria para imagem, que é uma ordem de magnitude acima
   ([Proposta 1](#proposta-1--geração-de-imagem-ai_image)).
3. Manter o crédito como unidade **de face para o usuário** (é compreensível) e não amarrá-lo a
   tokens na interface. A calibração acontece do lado do catálogo.

---

### 8. `shortened` é calculado, documentado e ignorado pela interface

**Evidência**
- `packages/core/src/application/ai/shorten.ts:6-8` — o comentário diz literalmente que a flag
  existe "para a UI poder dizer ao usuário o que aconteceu"
- `apps/web/src/features/ai/hooks.ts:47` — `shortened: boolean` está no tipo
- `grep -rn "shortened" apps/web/src` (fora do `schema.d.ts` gerado) devolve **só** essa linha

Toda a cadeia de honestidade — cortar em fronteira de frase, marcar que cortou, documentar o
motivo — termina numa flag que ninguém renderiza. O usuário recebe texto truncado
indistinguível de texto que o modelo terminou.

**Correção proposta:** aviso inline (não toast) junto do texto aplicado: *"encurtado para caber
em X (280)"*, com o texto integral disponível para copiar. `design.md §27.1` descreve
exatamente o componente: alert inline, ícone 16px, sem sombra. Combina com a
[Proposta 3](#proposta-3--revisão-antes-de-aplicar-diff-variantes-e-desfazer).

---

### 9. i18n contornada em toda a superfície nova

**Evidência**
- `apps/web/src/i18n/request.ts:5-8` — política declarada: *"v1 é pt-BR only, mas as strings já
  vivem em `messages/`"*
- `apps/web/src/messages/pt-BR.json` existe; `composer-view.tsx:66` usa `useTranslations`
- Nenhum dos quatro componentes de IA importa `next-intl`. Todas as strings são literais:
  `ai-actions.tsx:40-48` (7 rótulos + 7 instruções), `:105-108`, `:167`, `:173`, `:184`,
  `:201`, `:212`, `:217`, `:237`; `best-time-hint.tsx:28-34`, `:79`, `:87`, `:92`, `:97`,
  `:103`, `:105`, `:128-129`; `draft-from-idea.tsx:63`, `:68-72`, `:77`, `:85`, `:91`, `:95`,
  `:110-115`; `alt-text-button.tsx:46-47`, `:60`
- `scripts/check-brand.ts:19-46` não tem regra de i18n, então o CI não pega

Cerca de 40 strings novas fora do sistema. Nota: as **instruções de reescrita**
(`ai-actions.tsx:41-47`) são um caso especial e mais delicado — elas não são só rótulo de UI,
são **prompt em português enviado ao modelo**. Traduzir a UI para inglês sem tratar isso geraria
um menu em inglês pedindo ao modelo, em português, para reescrever. As instruções pertencem ao
back (`packages/core/src/application/prompts/`), não a um array no componente.

**Correção proposta:** mover as strings para `messages/pt-BR.json` e as instruções de reescrita
para o catálogo de prompts do core, referenciadas por **id** (`rewrite.shorten`,
`rewrite.formal`, …). A UI manda o id; o back escolhe a instrução. Bônus: a instrução deixa de
ser controlável pelo cliente, o que estreita a superfície de injeção que o PR discute.

---

### 10. O botão gatilho perde a semântica de carregamento que o design system já dá

**Evidência**
- `apps/web/src/components/ui/button.tsx:50-71` — `isLoading` já faz o certo: `aria-busy`,
  `disabled` e **preserva o label** (`design.md §35`: *"Loading: preservar largura e label
  sempre que possível"*)
- `apps/web/src/features/ai/ai-actions.tsx:146-163` — não usa `isLoading`. Troca manualmente o
  ícone por `<Loader2 className="animate-spin">`, **sem `aria-busy`**, e o botão continua
  clicável durante a geração (só os itens do menu ficam `disabled`)
- `alt-text-button.tsx:42` e `draft-from-idea.tsx:112` **usam** `isLoading` — a inconsistência é
  dentro da própria fatia

**Além disso, três problemas de acessibilidade na mesma superfície:**

1. Nenhum `aria-live`. A geração termina, o texto do editor muda por baixo, e um leitor de tela
   não anuncia nada. Para uma feature cujo carro-chefe é *alt text*, é irônico.
2. `alt-text-button.tsx:43-49` usa `title=` nativo para explicar por que o botão está
   desabilitado. Botão `disabled` não recebe foco e o `title` não é anunciado de forma confiável
   — a explicação existe no DOM e não chega a quem precisa. Os outros três componentes usam
   `Tooltip`; este não.
3. `animate-spin` é animação contínua. `design.md §46.12` exige respeito a
   `prefers-reduced-motion` e `globals.css:417` só cobre `.brand-mark*`. Vale para o repositório
   todo, mas a fatia adiciona três spinners novos. Correção de uma linha:
   `motion-reduce:animate-none` (ou regra global para `.animate-spin`).

---

### 11. Rate-limit: a rota grátis divide o balde com as pagas, e a organização inteira divide um balde

**Evidência**
- `apps/api/src/http/routes/ai.routes.ts:126-138` — `app.use('*')`: **30 req/60 s por
  organização**, aplicado a todas as rotas, incluindo `GET /best-times`
- `best-time-hint.tsx:64` — `useBestTimes(channelId, open && ai.hasBestTime)`, `staleTime` 300 s

**Cenários**

1. `/best-times` não usa modelo e não consome franquia (é o argumento central do PR para ela
   existir sem IA configurada). Mesmo assim ela gasta o balde de rajada das rotas pagas: abrir e
   fechar o menu de horários trocando de canal pode consumir cota que existia para proteger o
   provedor.
2. Uma organização de 20 pessoas divide **30 requisições por minuto**. Uma pessoa em laço de
   tentativas degrada os outros 19. Não há balde por usuário/credencial.
3. `verdict.retryAfterSec` volta no `DomainError`, mas nenhum componente de IA lê `retryAfterSec`
   nem faz backoff — o `executar` mostra o `detail` e para (`ai-actions.tsx:110-120`).

**Correção proposta:** balde composto — org (30/min) **e** ator (10/min) —, `/best-times` num
balde separado e mais generoso, e a UI respeitando `retryAfterSec` com botão desabilitado e
contagem, em vez de só mostrar texto.

---

### 12. A UI foi aprovada sem nenhuma evidência visual

**Evidência**
- Corpo da PR #52, seção "Evidências visuais": um comentário HTML dizendo *"Screenshots
  pendentes de captura pelo autor na stack local; a UI foi verificada por typecheck,
  `build:web` e `check:brand`"*
- `apps/web/src/features/ai/ai-actions.test.tsx` — 48 linhas, testa `editorUtilizavel` e
  `textoParaAplicar`. **Não renderiza um único componente.** A extensão `.tsx` não é usada
- Nenhum teste de navegador no repositório: os E2E são todos scripts de API
  (`scripts/e2e-*.ts`), nenhum `.spec.ts` de Playwright existe em `apps/web`

O que `check:brand` verifica (`scripts/check-brand.ts:19-46`): hex avulso, sombra, transform no
hover, escala de raio, wordmark. O que ele **não** verifica: tamanho de fonte arbitrário,
`cursor: pointer`, `focus-visible`, `tabular-nums`, reduced-motion, i18n, contraste, ordem de
foco. Ou seja: "verificada por `check:brand`" cobre 5 regras de uma especificação com 20 regras
invioláveis e um checklist de 6 seções (`design.md §43`, `§44`).

Os achados 1, 2, 6, 8 e 10 são todos de comportamento de interface, e **nenhum** seria pego por
typecheck, `build:web` ou `check:brand`. É por isso que este achado é de processo e não de
código: a fatia passou por um portão que não olha para o que ela mudou.

**Correção proposta**

1. **Bloqueante para a próxima fatia de UI:** screenshots ou nada. O template de PR já pede.
2. Um E2E de navegador para o composer, com a API mockada — a superfície de IA é ideal para
   isso porque toda ela é "chamou, recebeu, aplicou".
3. Estender `check:brand` com as regras baratas que faltam: tamanho de fonte arbitrário
   (`text-[Npx]`), `cursor-pointer` em `<button>`, `animate-*` sem `motion-reduce`, string
   literal em JSX dentro de `features/` (heurística de i18n).

---

### 13. Achados menores (agrupados)

| # | Achado | Evidência | Proposta |
|---|---|---|---|
| 13.1 | `text-[11px]` em 11 lugares na fatia. O **valor** é legal (`design.md §6.3`: metadado 11–12px), mas é valor arbitrário, não token — `§43.20` proíbe "inventar valores fora dos tokens sem registrar exceção" | `ai-actions.tsx:175,216,236,241`, `best-time-hint.tsx:119,126`, `draft-from-idea.tsx:94,100`, `alt-text-button.tsx:63` | utilitário `text-meta` em `globals.css` + regra no `check:brand` |
| 13.2 | `AltTextButton` não oferece caminho de upgrade — os outros três oferecem "Ver planos". Fica um botão morto | `alt-text-button.tsx:32-49` vs `ai-actions.tsx:186-188` | mesmo padrão de CTA |
| 13.3 | `hover:border-ink` no gatilho: `design.md §35` permite "borda mais forte" no hover, mas `§3.3` (silêncio visual) pede um sinal dominante por região, e o gatilho já muda cor de texto e borda | `ai-actions.tsx:153-155`, `best-time-hint.tsx:80` | escolher um sinal |
| 13.4 | O dropdown fecha ao concluir (`ai-actions.tsx:113`), então iterar ("mais casual", depois "encurtar") exige reabrir o menu a cada passo | `ai-actions.tsx:110-120` | painel persistente ([Proposta 3](#proposta-3--revisão-antes-de-aplicar-diff-variantes-e-desfazer)) |
| 13.5 | 7 instruções de reescrita numa lista plana de texto puro, sem ícone e sem agrupamento (`design.md §24.1` prevê `gap: 9px` para ícone+label) | `ai-actions.tsx:219-231` | ícones + separar "tom" de "correção" |
| 13.6 | Cancelar não cancela: abortar do lado do cliente não interrompe a chamada no servidor, que segue até o fim e **confirma** o crédito. O usuário paga por texto que nunca vê | `ai-budget.ts:130-145` (sem `AbortSignal`) | propagar `AbortSignal` até o `postJson` (que já tem controller: `shared.ts:75-83`) e liberar a reserva no abort |
| 13.7 | `/v1/ai/*` só aceita sessão humana (`ai.routes.ts:119`), não chave de API. Uma integração só consegue gerar via MCP — assimetria não documentada | `ai.routes.ts:119` vs `public-api.ts` | decidir e registrar: ou expõe no `publicV1` com escopo próprio, ou documenta a exclusão |
| 13.8 | `shortenTo` corta por caractere. Para o X, URL conta como 23 caracteres independente do tamanho real, e o corte pode cair no meio de uma URL ou de uma hashtag — deixando link quebrado no post | `shorten.ts:26-41`, `x.provider.ts:204` | nunca cortar dentro de URL/hashtag; contagem por rede via `capabilities` |
| 13.9 | A mudança OpenSpec `add-ai-content-assistance` continua em `openspec/changes/` depois do merge, enquanto o fluxo é Criar→Implementar→**Arquivar** (há 5 mudanças em `changes/archive/`) | `ls openspec/changes/` | `openspec archive add-ai-content-assistance` |
| 13.10 | `alt-text`: no dialeto chat-completions a imagem vai **por URL** para o provedor. Está declarado como limitação de dev (localhost), mas a outra ponta não está: em produção, isso entrega ao terceiro uma URL pública e durável de mídia do cliente, e o acesso dele não aparece em `audit_log` | `use-cases/ai.ts:293` (`storage.publicUrl`) | preferir bytes quando o dialeto suportar; URL assinada de vida curta quando não |

---

## Análise de UI contra `design.md`

### O conflito que precisa ser resolvido antes de tudo

`design.md` v3.0 **contradiz o brand system e o CI** em dois pontos, e o §0 dele diz que é
"proposta para implementação" que só se torna fonte de verdade após aprovação. Hoje temos duas
fontes normativas discordando:

| Assunto | `design.md` v3.0 | `CLAUDE.md` + `docs/brand/` + `scripts/check-brand.ts` |
|---|---|---|
| Sombra | §27.2 *"toast é flutuante, portanto pode usar sombra"*; §24.1 `box-shadow` no dropdown; §46.3 *"permitir sombra apenas em Tooltip, Dropdown, Popover, Toast e CommandPalette"* | **"Zero sombras (`box-shadow` proibido, sempre)"**; `check-brand.ts:25-32` reprova o CI |
| Namespace de token | `--mp-bg-surface`, `--mp-text-tertiary`, `--mp-radius-lg` | `--surface`, `--graphite`, `--line`, `--accent` (`globals.css:9-25`) |
| Raio | §46.5 permite 4, 6, 8, 10, 12, 16, 999px | `check-brand.ts:38-41` só 4/6/8 |
| Profundidade | §8.4 "Elevação" | relevo pervasivo por gradiente (`.bevel-*`, `.inset-field`) — conceito que o `design.md` não menciona |

A paleta **coincide** (`#7c3aed` em `design.md §5.1` e `globals.css:9`), então o desacordo é de
política e de nomenclatura, não de identidade.

**Enquanto isso não for resolvido, "conforme o `design.md`" é ambíguo** — um componente pode
passar no `design.md` e reprovar no CI. Proposta: um adendo de reconciliação no `design.md`
declarando (a) que a regra de sombra do brand **vence** e as seções §24.1/§27.2/§46.3 ficam
sobrescritas, (b) uma tabela de mapeamento `--mp-*` → tokens reais, (c) que a profundidade é por
gradiente. Sem isso, cada revisão de UI vai re-litigar isso do zero.

### Onde a fatia cumpre a especificação

Crédito onde é devido — isto não é acidente, é atenção:

- `cursor-pointer` em todos os botões e itens de menu (regra do brand).
- Zero sombra, zero hex avulso, `bevel-chip` no chip de crédito, raios na escala — o CI de brand
  passa e não por sorte.
- `transition-colors duration-200` casa com `design.md §34.2` ("cor, fundo e borda: 150ms" —
  200ms é o token `--mp-duration-base`, aceitável).
- `role="alert"` nas mensagens de erro; erro é texto + cor, não só cor (`§35`).
- Microcopy no espírito do `§36.4`: "Escolha ao menos um canal para a IA saber o limite e o
  formato" explica o que fazer, não só o que faltou. O rótulo "ponto de partida para esta rede"
  em vez de fingir medição é exatamente o tom certo.
- `Button` com `isLoading` preserva label e largura (`§35`) — quando é usado (ver [A10](#10-o-botão-gatilho-perde-a-semântica-de-carregamento-que-o-design-system-já-dá)).

### Onde não cumpre

| Regra | Onde falha |
|---|---|
| §28.3 *"spinner apenas para ações locais e curtas"*; *"mensagem textual para operações longas"* | 5,9 s medidos para uma geração, até ~30 s para 5 canais, com spinner de 16px dentro de um dropdown ([A4](#4-caption-multicanal-é-serial-e-tudo-ou-nada)) |
| §35 *Loading: preservar largura e label* / `aria-busy` | gatilho do `AiActions` ([A10](#10-o-botão-gatilho-perde-a-semântica-de-carregamento-que-o-design-system-já-dá)) |
| §46.8 *"exigir focus-visible em controles interativos"* | herdado dos primitivos, mas nunca verificado — nenhum teste, nenhuma regra de lint |
| §46.12 *reduced-motion para animações contínuas* | três `animate-spin` novos sem `motion-reduce` |
| §43.20 *"não inventar valores fora dos tokens sem registrar exceção"* | 11 `text-[11px]` |
| §28.1 *empty state descreve o próximo passo* | "Não foi possível calcular agora." (`best-time-hint.tsx:105`) não diz o que fazer nem por quê; `BestTimeHint` retorna `null` sem canal (`:66`), então o controle simplesmente não existe e ninguém sabe por que |
| §36.3 *"timezone explícito em agendamentos críticos"* | o menu de horários mostra "Segunda, 09:00" sem dizer o fuso; a resposta traz `timezone` e a UI não o usa |
| §2.1 *acessibilidade tem precedência sobre tudo* | ausência de `aria-live` na aplicação de texto gerado; `title` em botão desabilitado |

---

## Propostas de evolução

Cada proposta traz o **porquê**, o **desenho** e a **mudança OpenSpec** que precisa ser aberta
antes da implementação (`AGENTS.md` torna o fluxo obrigatório para feature, schema, integração
ou mudança de comportamento).

### Proposta 1 — Geração de imagem (`ai.image`)

**Estado atual:** `SPEC_AI §3` já a especifica — *"prompt + tamanho → media na biblioteca,
5 créditos"*. O port tem o slot e nenhuma implementação
(`packages/core/src/application/ports/ai-provider.ts:34-37`).

**Crítica ao slot que já existe** — ele precisa ser refeito antes de ser usado:

```ts
// hoje: ports/ai-provider.ts:34-37
generateImage?(req: {
  prompt: string;
  size: '1024x1024' | '1792x1024' | '1024x1792';
}): Promise<{ url: string }>;
```

Dois problemas de fundo:

1. **A união de tamanhos é o catálogo de um fornecedor específico.** A regra 4 do `CLAUDE.md`
   diz que nenhum provedor nominal aparece fora de `infra/ai/*` — e este port, que é o contrato
   agnóstico, tem a lista de resoluções de um produto. Outro provedor usa outras dimensões, e
   nenhuma rede social pensa em pixels: pensa em **proporção** (1:1 e 4:5 no feed do Instagram,
   9:16 em stories/reels, 16:9 no YouTube, 1.91:1 em link preview).
2. **Devolver `{ url }` está errado para nós.** Essas URLs expiram (tipicamente em horas), o que
   colocaria mídia com prazo dentro de um post agendado para a semana que vem; e baixar uma URL
   que o provedor escolheu é exatamente a classe de requisição que a onda
   `harden-outbound-request-security` (PR #51) endureceu. Precisamos de **bytes**.

**Port proposto**

```ts
export type ImageAspect = '1:1' | '4:5' | '9:16' | '16:9' | '1.91:1';

export interface GeneratedImage {
  bytes: Uint8Array;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  /** prompt efetivamente usado, quando o provedor o reescreve — vai para a proveniência */
  revisedPrompt?: string;
  usage?: TokenUsage & { images: number };
}

export interface AiProvider {
  // …
  generateImage?(req: {
    prompt: string;
    aspect: ImageAspect;
    /** o adapter traduz para o que o fornecedor entende; o core nunca vê pixel */
    quality?: 'draft' | 'standard';
    signal?: AbortSignal;
  }): Promise<GeneratedImage>;
}
```

A tradução proporção→resolução vive **dentro** de cada adapter em `infra/ai/`, que é o único
lugar autorizado a conhecer o vocabulário do fornecedor. Adapter que não gera imagem não
implementa o método, e `/v1/capabilities` reporta `ai.canGenerateImages: false` — o mesmo padrão
que `canDescribeImages` já usa e que funciona.

**Fluxo do caso de uso** (`makeGenerateImage`), na ordem que o resto da fatia já estabelece:

```
plano (ai_image)
  → franquia (classe própria: 5 créditos, SPEC_AI §3)
  → moderação do prompt, quando o adapter oferecer `moderate`
  → provider.generateImage
  → validação dos bytes: assinatura de arquivo real (não confiar no mime declarado),
    teto de tamanho, dimensões plausíveis
  → storage.put + media.create com proveniência
  → alt text automático quando `describeImage` existir (imagem gerada nasce acessível)
  → commit da franquia + audit_log
```

**Proveniência é requisito, não enfeite.** `MediaRecord`
(`packages/core/src/application/ports/media.ts:3-17`) não tem como distinguir upload de geração.
Migration aditiva `0007`:

| Coluna | Tipo | Por quê |
|---|---|---|
| `source` | `text not null default 'upload'` (`'upload' \| 'ai'`) | a biblioteca precisa marcar visualmente o que é sintético; várias plataformas já exigem divulgação de conteúdo gerado por IA, e sem essa coluna a plataforma não tem como cumprir |
| `generation_prompt` | `text null` | reproduzir e iterar. É conteúdo do próprio usuário; não é segredo, mas **não** entra em `audit_log` (a fatia acertou em não logar prompt) |
| `generation_model` | `text null` | qual modelo produziu — indispensável quando um cliente perguntar, e para o operador comparar custo/qualidade |

**Superfície**

- `POST /v1/ai/image` — corpo `{ prompt, aspect, channelId?, quality? }`. Com `channelId`, o
  adapter escolhe a proporção que **aquela rede** aceita (o `capabilities` do provider já
  descreve mime e contagem: `instagram.provider.ts:272`). Devolve o `MediaRecord` criado.
  **Idempotente** desde o primeiro dia ([A5](#5-nenhuma-idempotência-numa-superfície-que-gasta-dinheiro)) — 5 créditos por duplo clique é caro.
- Biblioteca de mídia: botão "Gerar imagem" abrindo diálogo com prompt, seletor de proporção
  (chips 1:1 / 4:5 / 9:16 / 16:9) e prévia; badge "IA" no card do resultado.
- Composer: "Gerar imagem" no `MediaPicker`, com a proporção **pré-selecionada** pelos canais
  escolhidos — é o momento em que a pessoa sabe para onde a imagem vai.
- MCP: `generate_image`, escopo de **escrita** (mesmo argumento do `generate_content`: queima
  franquia paga).
- Gate: nova feature `ai_image` em `packages/contracts/src/billing.ts`. **Decisão do owner:**
  Pro ou Premium (ver [questões abertas](#questões-abertas-para-o-owner)).

**Riscos que a proposta assume explicitamente**

| Risco | Tratamento |
|---|---|
| Custo por imagem é ordem(ões) de magnitude acima de texto | classe de crédito própria (5, conforme a SPEC), balde de rajada mais estreito, e nunca N imagens numa requisição |
| Prompt pedindo conteúdo ilícito, pessoa real, ou marca de terceiro | `moderate` antes de gerar quando disponível; recusa explícita; nada é publicado sem uma pessoa aceitar (mesma postura do resto da fatia) |
| Bytes hostis vindos do provedor | validar assinatura de arquivo, não o `content-type`; teto de bytes; recodificar antes de servir |
| Consumo de storage | contabilizar em `media` e respeitar limite de plano quando ele existir |
| Divulgação obrigatória de conteúdo sintético | `source: 'ai'` viaja com a mídia e a UI marca; quando um provider exigir a flag na API de publicação, o dado já existe |

**Mudança OpenSpec:** `add-ai-image-generation` — capacidade nova `ai-image-generation`; altera
`ai-provider-runtime` (método novo no port + capability) e `ai-budget-control` (classe de custo).

---

### Proposta 2 — Perfil de voz da marca por organização

**Por que:** hoje cada geração parte do zero. `tone` é uma string opcional que a UI **nem
manda** — nenhum dos quatro componentes passa `tone`
(`hooks.ts:53-58` aceita, `ai-actions.tsx:124` não usa). Resultado: toda organização recebe a
mesma voz genérica, e a única forma de personalizar é redigitar instruções a cada post. É a
diferença entre um brinquedo e uma ferramenta que uma agência usa todo dia.

**Desenho:** tabela `org_voice_profiles` (uma linha por org, versionada):

- `tone` (chips: direto, acolhedor, técnico, divertido, institucional…);
- `audience` (texto curto);
- `dos` / `donts` (listas curtas — "nunca usar emoji", "sempre dizer 'assinantes', não
  'usuários'");
- `banned_terms` (lista) — aplicada **também deterministicamente** depois do modelo, como
  `shortenTo` faz com o limite: prompt nenhum entrega 100% de nada, e essa lição a fatia já
  aprendeu;
- `examples` (2–5 posts que a marca considera bons) — o insumo que mais muda a qualidade;
- `default_hashtags` por rede.

Entra em `prompts/` como bloco delimitado e marcado como dado, igual ao texto do usuário. Tela
em Configurações, com prévia ("gere uma legenda de exemplo com este perfil").

**Ganho colateral:** com perfil de voz salvo, "regenerar" passa a ser útil de verdade — a
variação fica dentro de uma voz, não entre vozes aleatórias.

**Mudança OpenSpec:** `add-brand-voice-profile` — capacidade nova; altera
`ai-content-generation`.

---

### Proposta 3 — Revisão antes de aplicar: diff, variantes e desfazer

**Por que:** consolida A1, A2, A8, 13.4 e 13.6. Hoje o fluxo é: clica, espera às cegas, o texto é
**substituído**, e o que se perdeu não é mostrado. O princípio que o próprio PR declara — "nada
é aplicado sozinho, toda saída passa por `onApply` para a pessoa revisar" — não se sustenta:
`onApply` **é** a aplicação. Não há revisão nenhuma.

**Desenho:** painel lateral (não dropdown) no composer, seguindo `design.md §30` (painel direito)
e `§26.3` (drawer no mobile):

- resultado por canal, com **antes/depois** e contagem de caracteres por canal;
- aviso inline quando `shortened` (`§27.1`), com o texto integral disponível para copiar;
- ações: **Aplicar a este canal** / **Aplicar a todos** / **Descartar** / **Gerar outra
  variante**;
- 2–3 variantes por geração quando o custo permitir, escolha explícita (é o que a pessoa já
  paga hoje sem receber — [A2](#2-p0--adaptar-para-a-rede-cobra-por-canal-e-descarta-todos-menos-um));
- **Desfazer** por 10 s depois de aplicar (`Ctrl+Z` do TipTap resolve por acidente, não por
  desenho, e não sobrevive ao remount do `editorNonce`);
- progresso "3 de 5 canais" em vez de spinner (`§28.3`);
- `aria-live="polite"` anunciando a conclusão.

**Mudança OpenSpec:** `improve-ai-review-surface` — altera `ai-content-generation` (sucesso
parcial, variantes) e a superfície web.

---

### Proposta 4 — Tela do plano da semana (`ai_calendar`)

Fecha [A6](#6-ai_calendar-é-cobrada-no-premium-e-não-tem-interface). A rota existe e funciona
(`POST /v1/ai/week-plan`); falta a tela.

**Desenho:** no calendário, ação "Planejar a semana com IA" → diálogo com objetivo, canais,
quantidade de slots e semana de início → grade dos slots propostos **em cima** do calendário
real, visualmente distintos de publicações de verdade (o `publishAt` já vem em UTC e a UI
converte). Cada slot: aceitar (cria rascunho), editar, descartar. E "aceitar todos", que é onde
está o valor: transformar 12 minutos de trabalho em um clique.

**A decisão que o PR deixou aberta e que esta proposta precisa resolver:** aceitar slots cria
publicações, e o limite mensal de posts do Grátis passa a valer. O caminho certo é o que já
existe no repositório — validar o limite **antes** de aceitar e mostrar quantos slots cabem, em
vez de falhar no meio da criação.

**Mudança OpenSpec:** `add-week-plan-surface` — altera `ai-content-generation`.

---

### Proposta 5 — Higiene da API de IA

Um lote pequeno, de valor desproporcional:

| Mudança | Achado |
|---|---|
| `Idempotency-Key` em todos os `POST /v1/ai/*` | [A5](#5-nenhuma-idempotência-numa-superfície-que-gasta-dinheiro) |
| Sucesso parcial no `/caption` (`variants` + `failures`, commit do custo real) | [A4](#4-caption-multicanal-é-serial-e-tudo-ou-nada) |
| Paralelismo limitado nas chamadas por canal | [A4](#4-caption-multicanal-é-serial-e-tudo-ou-nada) |
| `channelId` opcional no `/rewrite` (sem canal, sem `shortenTo`) | [A1](#1-p0--reescrever-no-editor-global-destrói-texto-sem-avisar) |
| `AbortSignal` do HTTP até o `postJson`, liberando a reserva no abort | 13.6 |
| Balde de rajada por ator + balde próprio para `/best-times` | [A11](#11-rate-limit-a-rota-grátis-divide-o-balde-com-as-pagas-e-a-organização-inteira-divide-um-balde) |
| Instruções de reescrita por **id**, resolvidas no core | [A9](#9-i18n-contornada-em-toda-a-superfície-nova) |
| `signal` na resposta de `/best-times` | [A3](#3-melhor-horário-mede-quando-você-publica-não-quando-funciona) |
| Relatório operacional sobre `ai_grants` (tokens por crédito) | [A7](#7-o-crédito-não-tem-relação-com-o-custo-real) |

**Mudança OpenSpec:** `harden-ai-api-surface`.

---

### Proposta 6 — Fechar o laço do `best_time` com métricas de entrega

É o que o próprio PR aponta como próxima onda, e concordo com a priorização: uma coleta de
métricas destrava `analytics`, duas features de IA operacional (`ai_campaign_reports`,
`ai_engagement_alerts`) e converte o `ai_best_time` de tautologia em medição
([A3](#3-melhor-horário-mede-quando-você-publica-não-quando-funciona)).

O único acréscimo desta revisão: **enquanto isso não existir, a UI tem de parar de sugerir que
existe.** A correção de microcopy do A3 não pode esperar a ingestão — é uma tarde de trabalho e
remove uma afirmação que não temos como sustentar.

---

## Ordem recomendada

| Onda | Conteúdo | Por que nesta ordem |
|---|---|---|
| **29a — correções** | A1, A2, A8, A10, 13.2, 13.9 + microcopy do A3 | Perda de dados e cobrança por trabalho descartado não esperam nada. Tudo é local à fatia, cabe em um PR |
| **29b — portão** | A12: E2E de navegador do composer + `check:brand` estendido + screenshots obrigatórios | Antes de adicionar UI nova, ter como verificar UI. Se isto ficar para depois, a próxima fatia repete os mesmos achados |
| **30 — Proposta 3** | Painel de revisão, variantes, desfazer, progresso | Transforma o "último centímetro" e é pré-requisito de qualidade para imagem |
| **31 — Proposta 1** | Geração de imagem, com proveniência e moderação | Pedido explícito, já especificado, e é a feature com maior efeito percebido. Depois de 30, nasce dentro de um fluxo de revisão que já existe |
| **32 — Propostas 2 e 5** | Voz da marca + higiene da API | Voz da marca é o que faz o cliente ficar; a higiene pode ir em paralelo |
| **33 — Propostas 4 e 6** | Plano da semana + ingestão de métricas | A ingestão é a maior das ondas e destrava 4 coisas ao mesmo tempo |

Antes de qualquer implementação: `bun run spec:new` para a mudança correspondente, e
`bun run spec:validate` (`AGENTS.md`). Ao fechar: `CHANGELOG.md` da raiz **e**
`docs/principal/STATUS.md` + `CHANGELOG_ONDAS.md` — os dois registros, conforme o `CLAUDE.md`.

---

## O que este documento recomenda **não** fazer

Um plano sem não-metas é uma lista de desejos.

1. **Não ligar `ai_inbox`/`ai_triage`/`ai_campaign_reports`/`ai_engagement_alerts`.** O PR está
   certo: falta ingestão, não IA. Ligá-las produz resposta inventada, e resposta inventada em
   DM de cliente é pior que feature ausente.
2. **Não implementar auto-repergunta quando o modelo devolve formato ilegível.** O PR já
   justificou (`use-cases/ai.ts:486-489`): dobra o custo de um caso que é quase sempre
   configuração errada.
3. **Não rodar `AI_BASE_URL` pelo classificador anti-SSRF.** Decisão D3 do PR, e está certa —
   Ollama na rede local é a história principal do self-host, e o "atacante" hipotético já
   controla o arquivo de ambiente.
4. **Não trocar créditos por tokens na interface.** Crédito é compreensível; token não. A
   calibração pertence ao catálogo ([A7](#7-o-crédito-não-tem-relação-com-o-custo-real)).
5. **Não publicar nada automaticamente por IA**, em nenhuma proposta acima. O plano da semana
   propõe; a imagem entra na biblioteca; o texto entra em rascunho. "Nunca repostar em
   incerteza" é regra inviolável do `CLAUDE.md`, e vale dobrado para saída de modelo.
6. **Não adotar o `design.md` como normativo antes do adendo de reconciliação.** Hoje ele
   contradiz o CI em sombra e raio.

---

## Questões abertas para o owner

| # | Questão | Por que precisa de você |
|---|---|---|
| 1 | `ai_image` fica no **Pro** ou no **Premium**? | Decisão comercial. Imagem é a feature de maior efeito percebido e a de maior custo unitário — provavelmente Premium, ou Pro com franquia estreita |
| 2 | Quantos créditos vale uma imagem? A SPEC diz 5; medição pode dizer outra coisa | O A7 mostra que o crédito hoje não reflete custo. Vale medir antes de congelar |
| 3 | Grátis 0 / Pro 500 / Premium 2000 continua? | O PR já pediu confirmação e ela não veio. Sem o relatório de `ai_grants` (Proposta 5) é palpite sobre palpite |
| 4 | `ai_calendar` sai do Premium até a tela existir? | Cobrar por algo inalcançável é exatamente o problema que a PR #52 nasceu para consertar |
| 5 | `design.md` v3.0 é aprovado com o adendo de reconciliação, ou o brand system continua sendo a única fonte? | Bloqueia toda revisão de UI daqui para frente |
| 6 | `/v1/ai/*` deve aceitar chave de API, ou permanece só sessão humana + MCP? | 13.7 — hoje é assimetria não documentada |

---

## Referências

- PR: [manypost/manypost-app#52](https://github.com/manypost/manypost-app/pull/52), merge
  `9b7c81e`, 75 arquivos, +14.192/−779
- Mudança OpenSpec da fatia: `openspec/changes/add-ai-content-assistance/`
  (proposta, design com D1–D10, 4 specs, 188 tasks)
- Especificações: [`docs/specs/SPEC_AI.md`](../specs/SPEC_AI.md),
  [`docs/specs/SPEC_FRONTEND.md`](../specs/SPEC_FRONTEND.md),
  [`design.md`](../../design.md) v3.0, `docs/brand/BRAND_SYSTEM.md`
- Decisões relacionadas: `DECISIONS.md` v1 §8 (BudgetGuard), §15 (self-hosted não recusa)
- Ondas anteriores citadas: `2026-07-27-harden-outbound-request-security` (PR #51),
  `2026-07-27-harden-publishing-idempotency`
</content>
</invoke>
