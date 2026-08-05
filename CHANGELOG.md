# Changelog

Todas as mudanças relevantes do Manypost serão registradas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto pretende seguir versionamento semântico quando publicar releases.

## [Unreleased]

### Added

- **O feed de publicações ganhou `mediaPreview` aditivo e opcional.** O serializer projeta somente
  a primeira mídia que já existe no conteúdo, com tipo, URL, MIME e alt; imagem, vídeo e ausência
  de mídia têm contrato e testes próprios. O cliente OpenAPI foi regenerado pela API, sem mudança
  de banco ou de domínio.

- **A tela inicial passou a responder também "o que acontece agora?".** O `/inicio` ganhou
  próximas publicações (até 5, com horário local, canal e estado), atividade recente (desfechos de
  entrega mesclados com decisões de aprovação), rascunhos retomáveis e um resumo do pipeline. Um
  único próximo passo contextual aparece **só** quando nada precisa de atenção, escolhido por uma
  escada de prioridade determinística e testada. Todo bloco some quando não tem o que dizer, e
  nenhum número é de desempenho — a plataforma não coleta engajamento, então tudo continua vindo do
  registro do que ela pediu e do que entregou.
  - **Cada bloco falha sozinho.** Antes uma leitura ruim derrubava a tela inteira, inclusive as
    partes alimentadas por outra fonte; agora carregando e erro são do bloco, com "tentar de novo"
    dentro dele.
  - Rascunhos do servidor (grupos em `DRAFT` sem link de aprovação pendente) ficam visíveis pela
    primeira vez: eles **nunca** são publicados sozinhos. O bloco oferece só o que a API faz —
    duplicar no composer ou gerar link de aprovação — e deliberadamente **não** oferece agendar,
    porque não existe operação que agende um rascunho.
  - `GET /v1/publications` passou a expor `publishedAt` e `updatedAt` (aditivo). Sem eles a
    atividade recente ordenaria pelo horário *agendado* e mentiria sobre o que falhou e foi
    retentado.
  OpenSpec: `add-home-operational-blocks`.
- **Busca global e paleta de comandos (⌘K / Ctrl+K).** De qualquer tela autenticada, a paleta
  encontra telas, ações, canais conectados e posts pelo texto. O atalho não dispara enquanto se
  digita — abrir a paleta no meio de um post seria o pior defeito possível aqui — e um gatilho
  visível na topbar anuncia o atalho, porque atalho invisível é atalho inexistente.
  - Novo `GET /v1/search`: escopado pela organização do principal (um `orgId` na query é ignorado,
    não confiado), consulta de 2 a 80 caracteres, teto de 10 resultados **no schema** (pedir mais é
    recusado, não cortado em silêncio) e janela obrigatória de 180 dias. Rascunhos vêm primeiro —
    é o que mais se procura. Devolve excerto, estado e canais; nunca credencial.
  - A busca dobra acento **nos dois lados** (`translate` portátil, não a extensão `unaccent`): sem
    isso "lancamento" não achava "Lançamento", enquanto a paleta já dobrava acento nas telas e
    canais — a busca pareceria quebrada justamente para quem digita rápido. O defeito estava no SQL
    e nenhum teste de rota o alcançava, porque todos usam repositório falso; foi pego pelo novo
    `scripts/e2e-search.ts`, agora no CI.
  - Sem `pg_trgm` de propósito: `CREATE EXTENSION` exige um privilégio que Postgres gerenciado
    costuma negar, e quebrar a migração de todo mundo para acelerar uma tela é a troca errada. O
    custo é contido por organização, janela, tamanho mínimo e teto de resultados.
  - Construída sobre o `Dialog` já existente, sem adicionar `cmdk`: o ranking precisa ser puro e
    testável, e o motor de pontuação de terceiros é justamente a parte que não daria para afirmar.
  OpenSpec: `add-global-command-palette`.
- **O quadro ganhou filtros, ações em lote, menu por card e operação por teclado.** Filtros de
  canal, etapa, texto e período vivem na URL, então um quadro estreitado cabe num link e sobrevive
  a voltar da tela de detalhe. Densidade confortável/compacta é preferência do navegador, não da
  URL. Seleção múltipla com Shift+clique aplica nova tentativa ou cancelamento em leque limitado
  (concorrência 4, teto de 50) e **reporta falha parcial** — "12 concluídos, 2 com erro" — em vez
  de um toast verde que ensina a não conferir.
  - O card deixou de ser um `<button>` e virou `<article>`: um botão não pode conter checkbox nem
    gatilho de menu, e a marcação inválida quebrava teclado e leitor de tela.
  - `KeyboardSensor` e `DragOverlay` adicionados — o quadro era inoperável sem ponteiro.
  - O arraste passou a aceitar cancelamento (faixa que só existe durante o arraste, com
    confirmação; **não** é uma sexta coluna) e a recusar cada transição inválida com o motivo e a
    operação que funciona: link de aprovação para aguardando→agendado, duplicar para
    rascunho→agendado, e o menu do card para publicar agora.
  OpenSpec: `add-kanban-board-operations`.

### Fixed

- **A Home v2 passou a cumprir o isolamento e os metadados prometidos pelo OpenSpec.** Loading e
  erro agora pertencem à fonte que falhou; indisponibilidade do resumo não apaga próximas
  publicações, rascunhos, pipeline ou atividade, e cada erro oferece retry local. A lista de próximas
  publicações mostra o estado agendado sem cartão aninhado; rascunho local informa a última edição;
  notificações da atividade abrem um detalhe existente no Quadro (inclusive links históricos e
  rascunhos fora da janela do feed), uma
  fonte de atividade saudável continua visível se a outra falhar, e pipeline truncado declara que
  as contagens são parciais. O relógio operacional avança a cada minuto. O composer reconhece
  overrides, settings e mídia de thread como rascunho e atualiza
  `contentUpdatedAt` em toda mutação material. As leituras da Home ganharam polling de 60 segundos
  como fallback do SSE/Redis, e controles compactos têm alvo mínimo explícito de 32px. Sem migration,
  mudança de API ou dado novo. OpenSpec: `add-home-operational-blocks`.

- **O quadro mostrava colunas vazias que não estavam vazias.** O feed é ordenado por horário
  crescente e era lido com teto de 200 linhas numa janela de 30 dias: uma organização com mais que
  isso recebia as 200 publicações **mais antigas** e via "Agendado" vazio enquanto havia trabalho
  agendado. A leitura passou a seguir o cursor keyset até 1000 itens e, quando ainda assim não
  couber, o quadro **diz** que truncou e oferece reduzir o período.
- **A tela inicial não reagia ao stream de eventos.** Nenhum evento do SSE invalidava o resumo, então
  uma falha nova ficava invisível e uma falha já resolvida continuava na tela até 20 s de
  `staleTime` ou o foco da janela — a maneira mais rápida de ensinar alguém a não confiar num
  painel. O mapa de invalidação virou função pura testada, e entrega e problema de canal agora
  invalidam também as contagens da home.
- O quadro passou a distinguir "o filtro excluiu tudo" de "o pipeline está vazio", que eram a mesma
  mensagem.

### Changed

- **Redes sociais ganharam identidade visual explícita nos cards.** Em Conexões, o logotipo da
  plataforma agora é a âncora de 48px e o nome da rede ocupa o primeiro nível, com a conta logo
  abaixo. No Quadro, o rodapé do post deixou de usar avatares sobrepostos com selos minúsculos e
  passou a mostrar até dois chips com logo e conta, além da contagem real dos canais restantes.
  As superfícies continuam brancas e neutras; as cores oficiais permanecem restritas aos logos.
  OpenSpec: `adopt-white-lilac-dashboard-system`.

- **O catálogo de redes passou a usar o espaço do desktop.** A grade de conexão fica em quatro
  colunas, com cards de 160px, tiles de 64px e logos de 40px; contas conectadas ficam em três
  colunas e também receberam marca maior. Os chips do Quadro seguem compactos para não disputar
  leitura com o conteúdo da publicação. OpenSpec: `adopt-white-lilac-dashboard-system`.

- **O catálogo de redes removeu o card aninhado atrás dos logos.** O logo agora ocupa 56px direto
  sobre o card neutro, enquanto o card externo foi reduzido de 160px para 144px. OpenSpec:
  `adopt-white-lilac-dashboard-system`.

- **O catálogo de redes ficou mais compacto.** Os cards de conexão passaram de 144px para 128px e
  os logos diretos de 56px para 48px, preservando a leitura imediata da plataforma sem ocupar altura
  demais. OpenSpec: `adopt-white-lilac-dashboard-system`.

- **Os resumos operacionais da Home adotaram o modelo leve de status.** Agendados, publicados e
  falhas agora têm ícone pastel, superfície clara por estado, valor real e trama pontilhada discreta.
  Não há percentual de variação quando o produto não possui esse dado. OpenSpec:
  `adopt-white-lilac-dashboard-system`.

- **Brand v2.0: o dashboard adotou o sistema branco/lilás aprovado.** O shell autenticado agora
  usa main `#FDFDFD`, sidebar cinza-preta 181/64 e topbar funcional de 59px no desktop e mobile.
  Inter compacta substitui títulos display no produto; cards usam bordas finas e raios por função;
  lilás/azul identificam somente KPIs reais; sombra pertence apenas ao tooltip e gradientes apenas
  a visualizações de dados nomeadas. A Home mostra três resumos reais do dia e rail de 260px. O
  Quadro reúne filtros e cinco lanes numa única superfície branca sem alterar URL, filtros,
  densidade, seleção, drag, teclado, ações em lote, retry ou confirmações. Não houve mudança de API,
  banco, ambiente ou dados. Rollback: reverter o commit visual e redeployar a imagem anterior.
  OpenSpec: `adopt-white-lilac-dashboard-system`.

- **Brand v1.5: o app adotou a composição editorial aprovada.** O shell autenticado agora combina
  canvas quente com rail escuro 208/64, busca/notificações/conta no rail, topbar somente mobile,
  largura ampla nomeada e títulos Plus Jakarta de 32px (44px na saudação da Home). `/kanban`
  permanece a rota, mas a interface se chama **Quadro** e usa cinco lanes abertas com divisores,
  cabeçalhos sticky, cards com preview opcional, retry visível e nenhuma capacidade fictícia.
  Filtros, URL, densidade, seleção, drag, teclado, lote e confirmações foram preservados.
  OpenSpec: `adopt-flat-visual-system` + `add-kanban-board-operations`.

- **O sistema visual voltou deliberadamente a superfícies chapadas (brand v1.4).** A direção de
  relevo por gradiente da v1.3 foi revogada — não era um defeito de implementação, mas deixou de ser
  a linguagem desejada. Botões, campos, cards, overlays, sidebar, tabs, badges e estados selecionados
  agora usam fill uniforme, camadas de fundo e duas forças de borda; `--line-strong` mantém pelo
  menos 3:1 quando a borda é o único limite de um controle ou overlay. Sombras continuam proibidas.
  - O produto usa uma escala tipográfica nomeada, três pesos, sentence case, seis gaps de layout,
    um shell de largura única e um nível de borda por região. `rounded-full` ficou restrito a Avatar
    e pequenos dots; tracejado, apenas a drop targets reais; a Home deixou de animar a entrada.
  - `check:brand` agora executa 18 regras linha a linha mais o check estrutural de cursor, cobrindo
    relevo residual, tipografia crua/bold/uppercase, framing, spacing, raio e as regras anteriores.
  - Exemplos semânticos do composer deixaram de trazer emoji decorativo. O preview de provider
    preserva tipografia representacional por uma exceção explícita e limitada ao arquivo.
  OpenSpec: `adopt-flat-visual-system` + `enforce-visual-system-lint`.
- **Geração de imagem ganha modos explícitos de custo e qualidade.** O diálogo, a API e a tool
  MCP agora oferecem `economy` (renderização `low`, 2 créditos) e `quality` (renderização `high`,
  5 créditos), sempre sobre o `AI_IMAGE_MODEL` configurado. O padrão é econômico, os dois
  custos aparecem antes do clique e trocar o modo troca também a identidade idempotente da
  submissão. O navegador nunca envia nome de modelo ou parâmetro livre do provedor; essa tradução
  permanece no adapter.
  - Imagens agora usam port e fábrica independentes da IA de texto. Um endpoint
    OpenAI-compatible pode ser trocado apenas com `AI_IMAGE_PROVIDER`, `AI_IMAGE_BASE_URL`,
    `AI_IMAGE_API_KEY` e `AI_IMAGE_MODEL`.
  - Definir somente `AI_IMAGE_MODEL` preserva o comportamento anterior herdando a conexão completa
    de texto. Ao declarar um provider de imagem, endpoint e chave passam a ser exclusivamente os
    `AI_IMAGE_*`; a chave de texto nunca é copiada silenciosamente.
  - `AI_IMAGE_PROVIDER=none` desliga só imagens, e uma instalação pode gerar imagens mesmo com
    texto desligado. Não há migration nem fallback automático após falha externa. Rollback:
    remover o bloco independente e reverter API/core/config/web juntos.
  OpenSpec: `add-ai-image-quality-modes`.
- **Geração de imagem compatível com endpoints atuais.** O adapter do protocolo
  `openai-compatible` deixou de enviar o parâmetro opcional
  `response_format`, rejeitado pelo endpoint atual de imagens, e continua
  consumindo o resultado base64 devolvido por padrão. A correção não altera a
  API do Manypost, o fluxo de créditos, a proveniência ou o armazenamento.
  OpenSpec: `fix-image-generation-request-compatibility`.
- **Home e calendário receberam uma rodada visual restrita ao PR #54.** Os CTAs
  “Novo post” e “Criar post” explicitam o texto branco; a Home ganhou respiro,
  hover e uma entrada curta que desaparece sob `prefers-reduced-motion`; e o
  calendário voltou à escala compacta de tipografia, controles, seletores de
  dia e timeline, incluindo rótulos horários em uma escala exclusiva de 9px
  preservada após o `tailwind-merge`. A escala tipográfica customizada também
  passou a ser reconhecida pelo merge central de classes: botões preenchidos
  mantêm texto branco e inputs/textareas preservam o tamanho compacto e o
  placeholder, inclusive em Configurações. Não houve alteração de rotas,
  filtros, drag-and-drop ou agendamento.
  OpenSpec: `refine-home-calendar-visuals`.
- **Composer modular integrado às superfícies de IA, mídia e persistência.** A refatoração
  `refine-composer-authoring` mantém um editor TipTap por aba/item, trilho de redes com capacidade,
  validação em popover, threads compactas e rodapé responsivo, sem regredir os contratos entregues
  em paralelo.
  - A ação de IA agora conhece o escopo global, de canal ou de thread: reescrita global não inventa
    `channelId`, todas as variantes multicanal viram overrides e item compartilhado de thread não
    oferece uma adaptação por rede que cobraria créditos sem destino correto.
  - O rodapé considera também issues de thread; `Ctrl/Cmd + Enter` ignora repetição de tecla e não
    agenda por trás da confirmação de descarte.
  - O editor global encaminha o primeiro canal selecionado ao seletor de mídia; threads
    compartilhadas continuam sem um destino artificial.
  - “Rascunho salvo” passou a refletir a conclusão real do storage. Falhas de quota ou privacidade
    preservam o estado em memória, não interrompem a edição e são informadas sem falso sucesso.
- **Runtime de imagens endurecido.** A dependência direta `sharp`, usada para normalizar os bytes
  produzidos pela geração de imagens, foi atualizada para `0.35.3`, fora da faixa afetada pelo
  advisory conhecido das versões anteriores.

### Added

- **Backlog atual de evolução do produto.**
  [`docs/audits/2026-07-28-product-improvement-opportunities.md`](docs/audits/2026-07-28-product-improvement-opportunities.md)
  separa sugestões P0/P1/P2 e registra impacto, esforço, dependências e PR
  sugerido. Nenhuma das funcionalidades maiores foi implementada nesta rodada;
  Home v2, busca, central de falhas, colaboração, analytics e outras expansões
  permanecem para mudanças OpenSpec e PRs próprios. O recorte recomendado da
  Home v2 ganhou um documento dedicado com opções, esforço, riscos, não-objetivos
  e decisões que precisam de aprovação antes do PR2.
- **`ai_image`: a IA passa a produzir a imagem, não só o texto.** A `SPEC_AI §3` listava
  `ai.image` — "prompt + tamanho → media na biblioteca" — e era o único item da família
  de criação que existia como nada: o port guardava um slot `generateImage` sem implementação. Um
  agendador cuja IA escreve a legenda e não produz a figura para um passo antes do trabalho, porque
  a figura é a parte que falta. OpenSpec: `add-ai-image-generation` → capacidade nova
  `ai-image-generation`; altera `ai-provider-runtime` e `ai-budget-control`. **Plano Premium**, por
  custo unitário: uma imagem custa uma ordem de magnitude mais que uma legenda, e a franquia de 500
  do Pro se esgotaria em cem imagens.
  - **O slot antigo foi refeito antes de ser usado**, por duas razões que não são cosméticas. A
    união de tamanhos (`'1024x1024' | '1792x1024' | '1024x1792'`) era o **catálogo de um fornecedor
    dentro do port agnóstico** — o mesmo acoplamento que a regra 4 do `CLAUDE.md` proíbe, de roupa
    nova —, e rede social nenhuma pensa em pixel: pensa em **proporção**. E devolver `{ url }`
    estava errado para este produto: URL de provedor expira em horas, o que colocaria mídia com
    prazo dentro de um post agendado para a semana que vem, e baixar uma URL escolhida pelo
    provedor é a classe de requisição que a onda anti-SSRF endureceu. Agora o port pede
    `aspect` (`1:1`, `4:5`, `9:16`, `16:9`, `1.91:1`) e devolve **bytes**; a tradução
    proporção→resolução vive dentro do adapter, o único lugar autorizado a conhecer o vocabulário
    do fornecedor.
  - **Os bytes são validados como bytes.** O `content-type` que o provedor declara não é confiável:
    a resposta passa pelo mesmo `sniffMedia` (magic bytes) de todo upload, e o teto de tamanho da
    instalação vale igual. Um proxy no caminho devolvendo HTML de erro não vira mídia quebrada
    esperando para falhar na publicação — vira `ai.invalid_response`, com a franquia **devolvida**.
    O adapter normaliza a saída com `sharp` para a proporção exata solicitada, sem ultrapassar
    8192×8192; dimensões incompatíveis do provedor não vazam para a biblioteca.
  - **Proveniência é requisito, não enfeite.** Migration `0007`, puramente aditiva, dá a `media`
    um `source` (`upload` | `ai`), o `generation_prompt` e o `generation_model`. Várias plataformas
    já exigem divulgação de conteúdo sintético; sem a coluna, o produto não teria como cumprir — nem
    como responder um cliente que pergunte qual modelo produziu um material. A biblioteca marca o
    que é gerado com um selo. O prompt fica com a mídia e **nunca** entra no `audit_log`.
  - **Idempotente desde o primeiro commit.** Uma geração paga não pode ser cobrada duas vezes por
    deixar para depois — a rota reusa o middleware `Idempotency-Key` que a API pública já tinha.
    O contrato OpenAPI declara o header e o browser preserva a mesma chave após falha ambígua,
    trocando-a apenas quando a entrada muda ou a geração conclui; replay/conflito/cobrança única
    são exercitados contra Redis real.
  - **Upload e metadata formam uma unidade recuperável.** Se o objeto foi gravado mas a criação da
    linha `media` falha, o storage recebe uma compensação best-effort; falha da limpeza nunca
    mascara o erro primário.
  - **Uma requisição, uma imagem** (`n: 1`), para o custo de uma chamada ficar previsível.
  - **Dois modos sobre o mesmo modelo:** `economy` traduz para `low` e custa 2 créditos;
    `quality` traduz para `high` e custa 5. O modo econômico é o padrão determinístico.
  - Superfícies: diálogo na biblioteca de mídia, a mesma ação dentro do seletor de mídia do
    composer (com a proporção da rede escolhida já pré-selecionada, que é o momento em que a pessoa
    sabe para onde a imagem vai), e a tool MCP `generate_image` sob escopo de **escrita** — gerar
    queima a franquia paga da organização, e credencial só-leitura não pode gastar crédito.
  - `AI_IMAGE_MODEL` é o **opt-in explícito** da capacidade. Sem ela, `AI_MODEL` nunca é presumido
    como modelo de imagem e a geração permanece desabilitada.
  - `AI_IMAGE_PROVIDER`/`AI_IMAGE_BASE_URL`/`AI_IMAGE_API_KEY` permitem uma conexão independente;
    omitindo o provider, a conexão de texto é herdada integralmente por compatibilidade.
  - Sem provedor capaz de desenhar, `/v1/capabilities` reporta `ai.canGenerateImages: false`, a
    rota responde `capability.disabled` e a interface **esconde a ação inteira** — o mesmo padrão
    que `canDescribeImages` já usava.

- **A home que não existia.** `apps/web/src/app/page.tsx` tinha seis linhas e redirecionava para
  `/calendario`, e o grupo autenticado não tinha página raiz: a primeira tela do produto era uma
  ferramenta, não um panorama. O calendário responde "o que está agendado nesta semana" — boa
  pergunta, mas não a **primeira**. A primeira é "está tudo bem?", e a plataforma sabia a resposta
  sem nunca oferecê-la: uma publicação que falhava de madrugada era um cartão vermelho no kanban
  *se* a pessoa pensasse em ir lá, e um canal com token expirado só aparecia em `/conexoes` — então
  o jeito normal de descobrir era um post falhando. OpenSpec: `add-home-dashboard` → capacidade
  nova `home-operational-overview`.
  - **`GET /v1/insights/summary?tz=<IANA>`** — contagens agregadas, não documentos: o que precisa
    de atenção (falhas, revisão, aprovação, entrega parcial, canais a reconectar), o que sai hoje e
    a semana por dia. As fronteiras de dia são resolvidas **no fuso do usuário** por `Intl`, nunca
    por offset fixo (um erro de uma hora aqui move um post do "hoje" para o "amanhã" na tela que a
    pessoa usa para conferir o dia). Início e fim de cada dia civil são limites explícitos:
    semanas com transição de horário de verão aceitam dias UTC de 23/25 horas sem derivar o fim
    por `interval '1 day'`. Filtro por `org_id` em toda ramificação, inclusive dentro de cada
    subconsulta — agregado é exatamente onde um vazamento passa despercebido, porque ninguém vê
    a linha, só um número plausível.
  - **Tela `/inicio`**, e `/` passa a levar até lá. O calendário continua onde estava, a um clique.
  - **Bloco sem conteúdo não existe.** "Precisa de atenção" **desaparece** quando nada está errado
    — não vira um cartão verde de "tudo em ordem" (design.md §3.3: silêncio também é sinal). Os
    medidores de plano desaparecem em self-hosted, onde o limite nunca é aplicado.
  - **Nenhuma métrica de desempenho.** `channel_metrics` está vazia porque nada escreve nela, então
    todo número da home vem do nosso próprio registro do que foi pedido e do que foi entregue —
    e é verdadeiro hoje. Um gráfico de engajamento aqui seria dado inventado. Há teste que reprova
    qualquer mensagem da home que fale de alcance, engajamento ou curtida.
  - **Primeiro uso é onboarding**, não uma grade de zeros: sem canal conectado, a home é o passo de
    conectar um.
  - **`PageHeader` (design.md §13)**, adotado em `/inicio`, `/calendario`, `/kanban`, `/midia` e
    `/conexoes` — nenhuma tela do app tinha cabeçalho, o título vivia só na topbar e **nenhuma tela
    dizia o que era**. Cada uma ganhou uma linha de descrição; a topbar passou a ser contexto
    visual, não um segundo `h1`, preservando um único título principal por página.
  - **"Início" na sidebar** e o wordmark apontando para lá: antes ele levava ao calendário, então
    nem o gesto universal de voltar ao começo existia.
  - `scripts/e2e-insights.ts` — 23 checks contra API real e Postgres descartável, com cenário
    esperado escrito à mão e **duas organizações**, para provar que o agregado não mistura
    inquilinos. Roda no job de E2E do CI.

### Fixed

- **A reescrita por IA destruía texto do usuário.** Na aba global do composer, a ação de
  reescrever mandava apenas `channelIds[0]` e o caso de uso cortava a resposta no limite
  **daquele** canal antes de o componente substituir o editor inteiro. Com X (280) e LinkedIn
  (3000) selecionados nessa ordem, pedir "Corrigir" num rascunho de 1200 caracteres apagava cerca
  de 920 — numa ação que qualquer pessoa leria como inofensiva. OpenSpec:
  `fix-ai-composer-safety` → altera `ai-content-generation` e `posting-time-suggestions`.
  - `POST /v1/ai/rewrite` **nunca mais encurta**. Reescrever é a única operação cuja *entrada* é
    o texto que a pessoa escreveu; descartar parte dele para caber num limite que ela não
    escolheu perde trabalho em vez de proteger algo. O limite continua imposto onde sempre foi:
    no agendamento, que valida e mostra o excesso.
  - `channelId` passou a ser **opcional** na reescrita — a aba global edita um texto compartilhado
    por várias redes e não tem canal único a resolver. Sem canal, nenhum limite é imposto nem
    reportado. A resposta troca `shortened` por `overLimit` + `maxLength` nulo, e a interface
    **pergunta antes de escrever** quando o resultado passa do limite.
  - O corte determinístico (`shortenTo`) permanece exatamente onde faz sentido: legenda, rascunho
    multicanal e plano da semana, onde a saída é texto novo.
- **A legenda multicanal cobrava por canal e jogava fora todos menos um.** A aba global mandava
  todos os canais selecionados (a franquia debita **um crédito por canal**), o modelo era chamado
  uma vez por canal, e a interface aplicava `variants[0]` ao texto compartilhado — as outras N-1
  adaptações, já pagas, morriam antes de qualquer olho humano, sob um controle chamado "adaptar
  para a rede". Agora cada legenda chega ao canal que a pediu, como override, pelo mesmo caminho
  que o rascunho multicanal já usava; a aba ativa vai para o primeiro canal afetado e um aviso
  diz quantas versões foram aplicadas.
- **Item de thread deixou de oferecer "adaptar para a rede".** O texto de um item é compartilhado
  pelas redes que suportam thread — ele cobrava N créditos e aplicava um. Restam reescrita e
  hashtags, que fazem sentido para um texto compartilhado.
- **`shortened` deixou de ser calculado e ignorado.** A flag existia, documentada como "para a UI
  poder dizer ao usuário o que aconteceu", e nenhum componente a lia: o texto voltava cortado,
  indistinguível de um texto que o modelo terminou. Legenda e rascunho agora dizem o que foi
  encurtado e por qual limite.
- **A sugestão de horário afirmava mais do que os dados sustentam.** O sinal disponível é a
  **frequência com que a organização publica** — `channel_metrics` está vazia, ninguém coleta
  desempenho —, e a interface rotulava confiança média e alta como "baseado no seu histórico", que
  se lê como medição de resultado. `GET /v1/ai/best-times` passa a devolver `signal`
  (`network_baseline` | `own_posting_history` | `own_engagement`), a confiança fica limitada a
  `medium` enquanto o sinal for frequência, e a frase descreve o que existe: "os horários que você
  mais usa neste canal". `own_engagement` — e só ele — libera `high`, quando a coleta existir.
- **Acessibilidade e conformidade com o design system na superfície de IA.** O gatilho passou a
  usar o `isLoading` do `Button` (que já entrega `aria-busy` e preserva o rótulo) em vez de um
  spinner montado à mão sem estado anunciado; toda ação anuncia início e fim por região
  `aria-live`; o botão de alt text explica-se por `Tooltip` em vez do `title` nativo, que um botão
  desabilitado não anuncia de forma confiável — ironia num controle cuja razão de existir é
  acessibilidade — e ganhou o caminho de upgrade que os outros três já tinham; spinners respeitam
  `prefers-reduced-motion` (design.md §46.12); e os `text-[11px]` avulsos viraram a classe
  `text-meta`, para o valor arbitrário não voltar por descuido (design.md §43.20).
- **A superfície de IA contornava o i18n.** Cerca de quarenta strings literais foram para
  `apps/web/src/messages/pt-BR.json`. As sete instruções de reescrita não eram rótulo e sim
  **prompt em português enviado ao modelo**: mudaram para um catálogo em
  `packages/core/src/application/prompts/`, selecionado por id. O cliente manda o id, o servidor
  é dono da frase — o que também estreita a superfície de injeção, já que texto livre deixa de ser
  a rota normal do navegador até o prompt (segue aceito para chamador de API/MCP).

### Added

- **Fatia de IA: a plataforma passa a gerar conteúdo de verdade.** Até aqui as oito features
  `ai_*` existiam só no catálogo de planos — o gate funcionava, mas atrás dele não havia nada.
  Esta entrega liga quatro delas ponta a ponta. OpenSpec: `add-ai-content-assistance` →
  capacidades `ai-provider-runtime`, `ai-budget-control`, `ai-content-generation`,
  `posting-time-suggestions`.
  - **Adapters agnósticos de fornecedor** em `packages/core/src/infra/ai/`, selecionados por
    `AI_PROVIDER` — dois protocolos HTTP (`openai-compatible` e `anthropic`) cobrem gateways
    agregadores, os fornecedores de uso amplo e runtimes locais de self-host. Trocar de
    fornecedor é mudar `AI_BASE_URL`/`AI_MODEL`, nunca código; `AI_API_KEY` é **opcional**
    (runtime local não pede credencial). Boot falha fechado nomeando a variável que falta, e
    nenhuma falha do provedor devolve corpo, endpoint ou chave ao cliente. Nova fronteira de
    CI `ia-so-pelo-port`: use-case que importar `infra/ai` reprova o dependency-cruiser.
  - **BudgetGuard operacional** (DECISIONS v1 §8 deixa de ser aspiracional): reserva → confirma
    ou devolve, sobre `ai_credits` + a nova `ai_grants`. A concessão é um único `UPDATE`
    condicional, então o bloqueio de linha do Postgres torna impossível furar a franquia —
    provado por teste de integração com **dez reservas simultâneas contra franquia de cinco**
    (SPEC_AI §5.3). Reserva órfã é recuperada por lease na varredura preguiçosa da reserva
    seguinte, sem cron. Falha nossa (modelo fora do ar, resposta ilegível) **devolve** a
    franquia. Self-hosted contabiliza e nunca recusa.
  - **`ai_caption` (Pro)** — legenda adaptada por rede, reescrita com instrução, hashtags e
    alt text de imagem para leitor de tela. O limite do canal é garantido **depois** do modelo,
    por corte em fronteira de frase com marca `shortened`: prompt não entrega 100% de nada, e
    100% é o critério de aceite. Usa o mesmo merge de settings do agendamento, então conta
    verificada do X vale 4000 caracteres aqui como vale lá.
  - **`ai_best_time` (Pro)** — sugestão de horário por canal. **Sem modelo e sem custo de
    franquia**: estatística sobre o histórico de entrega da própria organização mais uma linha
    de base por rede, com `confidence` e `sampleSize` expostos. Enquanto não houver histórico,
    a resposta diz que é ponto de partida em vez de fingir medição. Funciona mesmo com
    `AI_PROVIDER=none`.
  - **`ai_multichannel_draft` e `ai_calendar` (Premium)** — uma ideia vira um rascunho por
    canal; um objetivo vira uma semana proposta. Saída estruturada é lida defensivamente e
    validada; o plano da semana **propõe e não agenda** — nenhuma publicação, rascunho ou job
    nasce dessas rotas.
  - **Superfícies**: `POST /v1/ai/{caption,rewrite,hashtags,alt-text,draft,week-plan}` e
    `GET /v1/ai/best-times`, documentadas em OpenAPI 3.1 com rate-limit de rajada por
    organização; bloco `ai` no `GET /v1/capabilities` (habilitada, visão, saldo); tools MCP
    `generate_content` e `suggest_best_times`; ações no composer, alt text na biblioteca de
    mídia, rascunho por IA e dica de melhor horário no agendamento.
  - Dois defeitos encontrados **usando a aplicação de verdade** e corrigidos com regressão:
    (a) as ações de IA liam o texto do editor durante o render — o `?.` não protegia, porque a
    instância do TipTap existe antes de a view montar e continua existindo depois de destruída
    pelo remount, e nos dois casos `editor.state` é null (`Cannot read properties of null`);
    o texto passou a vir do store e o editor é usado só para escrever, com guarda de instância
    viva. (b) o CTA de upgrade apontava para uma rota inexistente — as rotas do app são em
    português (`/planos`), e agora usam `next/link` como o resto da interface.
  - **Texto do usuário é dado, não instrução**: tudo que vem de fora entra delimitado e o
    delimitador não pode ser fechado por dentro. A defesa real, porém, é a jusante — nenhuma
    saída de modelo é executada, vira URL ou publica sem uma pessoa aceitar.
  - **Auditoria sem conteúdo**: cada geração registra organização, ator e operação; nem
    `audit_log` nem `ai_grants` guardam prompt, texto gerado ou credencial.
  - **Resposta cortada pelo teto de tokens não é entregue como se estivesse pronta.** Descoberto
    verificando contra um provedor real: **modelo de raciocínio gasta tokens de SAÍDA pensando**
    antes de escrever a primeira letra, então um teto apertado o corta no meio da palavra.
    Duas correções: (a) `finish_reason: length` / `stop_reason: max_tokens` vira
    `ai.invalid_response` **nomeando `AI_MAX_OUTPUT_TOKENS`**, em vez de virar um fragmento
    marcado como "encurtado para caber no canal" — que é outra coisa e esconderia um problema
    de configuração; (b) o teto enviado ao provedor passou a ser o **da instalação**, não um
    calculado por requisição: `max_tokens` é teto e não alvo (modelo comum para sozinho quando
    termina), e apertá-lo não comprava nada, porque o tamanho por canal já é garantido **depois**
    do modelo. Default de `AI_MAX_OUTPUT_TOKENS` subiu para 4000.
  - `AI_TIMEOUT_MS` e `AI_MAX_OUTPUT_TOKENS` novos; `.env.example` ganhou blocos prontos para
    **sete** provedores reais (inclui Fireworks) e a nota sobre modelo de raciocínio.
    `scripts/live-ai.ts` faz um smoke opt-in contra o provedor configurado, sem tocar no banco
    e sem imprimir a credencial (precedente `live-telegram.ts`/`live-r2.ts`). Franquia por plano
    no catálogo: Grátis 0 / Pro 500 / Premium 2000.
  - **`scripts/e2e-ai.ts` roda em modo gerenciado** (`IS_SELF_HOSTED=false`), o único em que a
    franquia é imposta de verdade — então a org de teste assina o Premium como qualquer cliente,
    e o script passa a provar também o outro lado do gate: sem assinatura, `/v1/ai/caption`
    responde 402 `plan.feature_locked` com `requiredTier: PRO`. Em self-hosted o bloco é pulado.
    O teto conferido no corpo enviado ao provedor é o **da instalação** (`AI_MAX_OUTPUT_TOKENS`,
    fixado em 900 no job da CI para não coincidir com o default), não um derivado do canal.
  - Migration `0006_ai_budget` (aditiva): `ai_credits.reserved` e a tabela `ai_grants`.

### Changed

- **Snapshot OpenAPI do web regenerado** (`apps/web/openapi.json`, `schema.d.ts`). Além das
  rotas de IA, a regeneração trouxe correções **não relacionadas** que o snapshot devia desde
  ondas anteriores: os escopos `mcp:read`/`mcp:write` no corpo de `POST /v1/api-keys` e as
  rotas de OAuth/well-known, que o código já servia e o arquivo versionado não refletia.

### Security

- **Anti-SSRF com pin de DNS.** Media import, entrega de webhooks e fetch CIMD do MCP
  passam por um adapter único que classifica IPv4/IPv6 (incluindo mapped/CGNAT/link-local),
  rejeita respostas mistas público/privado e **conecta no IP validado** com SNI/Host do
  hostname original — fecha a janela de rebinding entre `assertPublicUrl` e o `fetch`.
  Redirects revalidam a cada salto; downgrade HTTPS→HTTP é recusado; erros de política
  carregam só `reason` + `hostname` (sem query/headers). OpenSpec:
  `harden-outbound-request-security` → living `outbound-request-security`.
- **Webhook worker não engole mais erro de infraestrutura** (mesma política do publish/thread):
  falha inesperada é relançada ao pg-boss após o lote.
- **IPv4 privado escondido em NAT64, 6to4 e IPv4-compatible passa a ser recusado.** O classificador
  já desembrulhava o IPv4-mapped (`::ffff:169.254.169.254`), mas parava aí — então
  `64:ff9b::7f00:1` (127.0.0.1 dentro de um NAT64), `2002:7f00:1::1` (o mesmo dentro de um 6to4) e
  `::127.0.0.1` (forma IPv4-compatible, obsoleta mas ainda aceita por stacks) eram classificados
  como **públicos**. São três invólucros diferentes para a mesma classe de furo; agora todos são
  classificados pelo endereço embutido. Alcançar o loopback por eles depende de o host ter rota
  NAT64/6to4, o que não é o padrão — por isso é endurecimento, não incidente. A faixa de
  benchmarking `198.18.0.0/15` (RFC 2544) entrou junto.

### Documentation

- **README renovado.** A página inicial do repositório ganhou uma apresentação
  mais visual e escaneável, demonstração animada do calendário multicanal,
  diagrama de arquitetura regenerável com `mingrammer/diagrams`, início rápido,
  recursos e integrações atualizados e rotas mais claras para usuários,
  integradores e contribuidores.
- Alinhamento docs↔código: inventário de **28 tabelas** / migrations `0000..0005`,
  `maxConcurrent` como entregue, mapa de contracts/providers, Clerk-only em SPEC_API_MCP,
  wordmark `manypost` no BRAND_SYSTEM, banners de verdade em SPECs legados.
- OpenSpec: archive de `harden-publishing-idempotency` e `harden-outbound-request-security`.
- **Coleção Postman completa** em `postman/` (HTTP interno, público, OAuth AS, MCP) +
  environments local/cloud + `scripts/generate-postman.py`.

### Fixed

- **Um post não sai duas vezes na rede porque dois jobs se sobrepuseram.** A continuação de uma
  thread lia o estado da publicação, conferia em memória e só então chamava a rede: duas execuções
  concorrentes do mesmo item passavam juntas por essa conferência e publicavam a mesma réplica duas
  vezes. Agora cada item é **reivindicado no banco antes de qualquer chamada à rede**, numa única
  instrução que valida estado, versão do agendamento e cursor e concede a posse no mesmo passo — e
  o cursor só avança para quem apresenta essa posse. Publicação duplicada é o pior modo de falha do
  produto. Mudança OpenSpec: `harden-publishing-idempotency`.
- **Uma oscilação de rede não mata mais o post.** Erro sem resposta HTTP chegava ao classificador do
  provider como `status: 0`, que todo provider trata como falha **permanente** — um timeout de DNS
  reprovava o post de vez, sem retentativa. Agora falha de transporte é transitória para a
  plataforma; a decisão de repetir ou não vem do protocolo de posse, não do código HTTP ausente.
- **Mastodon:** o cabeçalho `Idempotency-Key` era um UUID novo a cada tentativa, o que não
  desduplica nada (é justamente a retentativa que precisa ser reconhecida como o mesmo toot). Passou
  a usar a chave estável da plataforma.
- **Falha de infraestrutura na fila não é mais engolida:** o handler registrava o erro e devolvia
  sucesso ao pg-boss, então um banco fora do ar marcava o job como entregue e a publicação ficava
  parada até o watchdog. Agora o erro é relançado depois de percorrer o lote (um job ruim não
  impede os demais), e o scanner recupera.

### Added

- **Desfecho incerto vai para revisão humana, nunca para retentativa automática.** Quando a rede
  pode ter aceitado a publicação mas a confirmação se perdeu (conexão derrubada no meio, posse
  expirada durante a chamada), a publicação entra em `NEEDS_REVIEW` com `errorClass: 'indeterminate'`
  e só sai pelo botão "tentar novamente", que é ação humana explícita (DECISIONS §7).
- **Chave de idempotência estável por item lógico** entregue aos providers em `ctx.idempotencyKey`
  (`sha256` de publicação+versão+posição — sem conteúdo, id interno ou segredo). Provider cuja API
  desduplica declara `idempotentPublish` e, com isso, uma queda de conexão volta a ser retentativa
  segura em vez de revisão. Hoje: `mastodon` e o provider `fake`.
- Métricas `publishing_delivery_safety_total{provider,outcome}` (posses concedidas, duplicatas
  evitadas, desfechos incertos) e `publishing_lease_recovered_total` em `/metrics`.
- Migration aditiva `0005`: tabela `publication_attempts` (posse por item, escopada por
  organização). Código anterior a ela continua funcionando — só não reivindica nada.

- **Mídia pode morar num bucket (Cloudflare R2, AWS S3 ou MinIO), não só no disco do servidor.**
  `STORAGE_PROVIDER=s3` deixou de ser uma promessa que derrubava o boot e virou driver de verdade,
  sobre o cliente S3 nativo do Bun — **sem dependência nova**. Isso destrava a publicação com mídia
  nas redes que **buscam o arquivo por URL** em vez de aceitar upload: a família Meta inteira
  (Threads, Instagram nas duas variantes, Facebook Pages) e a capa do Dev.to. O padrão continua
  `local`: quem não configurar nada não vê diferença. Mudança OpenSpec: `add-s3-media-storage`.
- **`MEDIA_PUBLIC_URL`**: a URL pública da mídia deixa de depender do endereço do app. Antes o
  arquivo só existia em `PUBLIC_URL/uploads`, o que em `localhost` é inalcançável pelas redes — a
  Meta responde que não conseguiu buscar a mídia, e isso é falha **permanente** do post. A variável
  vale para os dois drivers, e o script opt-in `bun run scripts/live-r2.ts` prova o caminho inteiro
  (grava, lê, busca a URL **sem credencial** e apaga) antes de qualquer publicação depender dela.
- Novo erro estável `media.store_failed` (HTTP 502) para falha de gravação/leitura no storage —
  antes um bucket fora do ar viraria 500 genérico. Falha na gravação **não cria registro de mídia**
  (a biblioteca não lista arquivo cuja URL devolve 404).

### Security

- A forma da chave de mídia (`<orgId>/<uuid>.<ext>`) passa a ser validada **antes de qualquer I/O**
  nos dois drivers, com fonte única compartilhada com a rota pública de uploads. No disco a
  travessia já era barrada pela contenção de diretório; num bucket `..` não é resolvido pelo sistema
  de arquivos, então uma chave malformada criaria objeto **fora do prefixo da organização** em
  silêncio. Configuração de bucket incompleta **falha fechado no boot**, nomeando a variável que
  falta e nunca o valor; e `AccessDenied`/`NoSuchBucket` na leitura não são engolidos como "mídia
  não encontrada" (credencial errada mascarada de 404 é o pior modo de falhar).

### Changed

- **Configurações por canal deixam de ser caixas de texto.** O compositor escolhia o controle de cada
  campo pelo tipo cru do JSON Schema, então data, URL, categoria e lista viravam todos "caixa de
  texto" — no YouTube, a categoria pedia o número `22`, a miniatura pedia colar uma URL e a data de
  liberação era texto. Agora o controle segue o significado do campo, em todas as redes: **data/hora**
  vira o seletor de calendário; **listas** (tags do YouTube e do Dev.to, idiomas do Bluesky) viram
  chips adicionados um a um, com contador quando há limite de caracteres; **URLs** (canonical do
  Dev.to, link do Threads) ganham validação inline; a **miniatura** do YouTube vira um seletor da sua
  biblioteca de mídia; e a **categoria** do YouTube vira uma lista com nomes ("Pessoas e blogs",
  "Jogos", "Educação"…) em vez de um código. O cabeçalho do card ganhou a cor de destaque com texto
  branco e relevo. Mudança OpenSpec: `improve-settings-ux`.
- Um campo de configuração pode referenciar uma **mídia da biblioteca por id**: o compositor mostra o
  seletor de mídia e o valor guardado continua sendo o id (o post segue editável, reabrindo com a
  imagem selecionada); a plataforma resolve o id para a URL pública **na hora de publicar**, sempre
  dentro da organização. A resolução é best-effort — sem mídia acessível, o campo simplesmente não é
  enviado e a publicação segue. Primeiro uso: a miniatura do YouTube.

### Fixed

- **OAuth MCP multi-cliente (issuer + loopback).** DCR/token/authorize no
  `PUBLIC_URL` deixavam de ser públicos por causa do Clerk (302 `/login` HTML),
  quebrando OpenCode, Codex, VS Code e Cursor paste-URL. O proxy agora libera
  esses três paths; consent continua autenticado. Redirects `http` em loopback
  passam a seguir RFC 8252 §7.3 (porta efêmera). O client estático
  `manypost-mcp` ganhou callbacks OpenCode e upsert no seed. Consent mostra o
  hostname do redirect com aviso de loopback. Settings/SPEC documentam a matriz
  de clientes + API key `mp_live_`. OpenSpec: `fix-mcp-oauth-client-interop`.

### Changed

- **Telas de entrar/criar conta redesenhadas.** Todo campo agora mostra um exemplo do que
  espera (e-mail, senha, senha nova e código de verificação), em vez de um campo vazio sem
  pista nenhuma. O painel escuro à direita passou a ter **altura fixa**: antes cada slide
  tinha uma altura diferente, então o bloco inteiro pulava na troca e sobrava um vão morto
  acima dos controles nos slides curtos. A paginação e as setas — que ficavam em pontas
  opostas de um painel de ~1100px — viraram um único agrupamento, e a pastilha ativa mostra
  quanto falta para o avanço automático, que antes acontecia sem aviso. O primeiro slide
  trocou o editor de código falso de 830px pelo **diagrama de conexão MCP + API**, no mesmo
  padrão do diagrama da landing (pontos de entrada → hub → redes suportadas): a arte agora
  prova a própria manchete em vez de ilustrar a API de um jeito que a manchete não prometia.
  As colunas do dia e do funil respondem ao ponteiro com borda de acento, sempre por
  cor/brilho e sem deslocar nada. A animação fica sob `prefers-reduced-motion`.
  Mudança OpenSpec: `redesign-auth-surface`.

- **Guia de credenciais da Meta (Facebook/Instagram/Threads) reescrito** — a seção §5.2 de
  `docs/principal/INTEGRATIONS_SETUP.md` descrevia o painel antigo da Meta ("Create App → tipo
  Business", "Add Product", escopos em *App Review → Permissions and Features*) e era impossível
  de seguir hoje, onde tudo é organizado por **casos de uso** e o escopo se habilita em
  *caso de uso → Permissions → Add*. Agora há uma tabela que mapeia canal → caso de uso →
  variáveis → redirect URI, e um passo a passo por canal. Corrigidos três erros que travavam a
  configuração: o redirect do Instagram de login direto é `/callback/instagram-standalone` (não
  `/callback/instagram`, que é o da variante via Facebook Business) e nunca havia sido
  documentado; `INSTAGRAM_APP_ID/SECRET` faltava na tabela de variáveis do §6; e as credenciais
  do Instagram/Threads ficam no painel do caso de uso, não em *App settings → Basic*. Os escopos
  listados passaram a ser exatamente os que os providers pedem. Comentários do `.env.example`
  sincronizados (inclusive uma referência errada a "docs §5.4" no Threads).
- O botão de mostrar/ocultar senha estava fora da ordem de tabulação (`tabIndex={-1}`) e não
  podia ser alcançado pelo teclado.
- Apenas o slide atual do palco de auth vai ao DOM. Antes os três ficavam montados, então os
  slides fora de tela permaneciam na árvore de acessibilidade e no tab order.

### Added

- **OAuth 2.1 no servidor MCP (dual-auth).** Clientes modernos autenticam com tokens
  `mpo_*` obtidos via authorization code + PKCE S256; a API key `mp_live_` com escopo
  `mcp` continua válida. O authorization server vive em `PUBLIC_URL` (discovery,
  `/oauth/authorize`, `/oauth/token`, DCR); o host MCP anuncia o PRM e exige Bearer.
  Consentimento no web (Clerk) escolhe organização e escopos `mcp:read`/`mcp:write`.
  Clientes: estático `manypost-mcp`, CIMD e DCR público. Mudança OpenSpec: `add-mcp-oauth`.

- Canal **YouTube**: publica **vídeo** e **Short** no seu canal, com título próprio, descrição
  (o texto do post), categoria, tags, miniatura personalizada e liberação programada. Toda
  publicação leva um vídeo — o YouTube não aceita post só de texto. **O YouTube não tem parâmetro
  de Short**: ele decide pelo arquivo (vertical ou quadrado **e** até 3 minutos). Como um botão de
  Short seria decorativo, o manypost **mede o vídeo antes de enviar** — proporção, duração e a
  rotação que o celular grava no arquivo — e o campo **Formato** recusa no agendamento, dizendo a
  medida encontrada, quando o arquivo não vai virar o que você pediu. O envio usa upload resumível
  com o corpo em streaming, então o arquivo nunca fica inteiro na memória. São pedidos **dois**
  escopos sensíveis (`youtube.upload` e `youtube.readonly`) e mais nenhum, porque cada um é
  revisado separadamente pelo Google; métricas existem mas ficam atrás de
  `YOUTUBE_ENABLE_ANALYTICS`, que acrescenta um terceiro escopo sensível. O canal de destino é
  escolhido no consentimento do Google, não a cada post — conectar outro canal da mesma conta vira
  outro canal no manypost. **Enquanto o projeto no Google não passar pela auditoria de
  conformidade, o vídeo sai privado mesmo pedindo público**; isso é tratado como publicação bem
  sucedida, com aviso no log, e nunca como falha a retentar. Mudança OpenSpec:
  `add-youtube-provider`.

- Canal **Dev.to**: publica **artigos** em Markdown, com título próprio, tags (até 4), endereço
  original (canonical) e a opção de publicar por uma organização, escolhida a cada post. A primeira
  imagem anexada vira a capa. **Não exige configuração nenhuma**: a conexão pede uma chave de API
  que o próprio usuário gera na conta dele, então a rede fica disponível em toda instalação —
  self-hosted ou gerenciada — assim que o código sobe. O título é obrigatório e é recusado **ao
  agendar**, não no horário marcado. Mudança OpenSpec: `add-devto-provider`.

- Canal **Instagram (Facebook Business)**: publica em conta profissional do Instagram
  vinculada a uma Página do Facebook, com a conta escolhida a cada post. Publica foto,
  reel, carrossel de 2 a 10 (misturando foto e vídeo) e story de mídia única; réplicas de
  thread saem como comentários. **Não exige credencial nova** — usa a mesma aplicação Meta
  do canal Facebook, então quem já configurou o Facebook só precisa registrar o redirect
  URI do novo callback. O token de publicação da Página é derivado a cada publicação e
  nunca é gravado em configurações, que são armazenadas sem cifra. Mudança OpenSpec:
  `add-instagram-facebook-business-provider`.

- Autenticação humana obrigatória pelo Clerk, com UI Manypost customizada para
  senha, verificação de email, Google e tarefas de sessão.
- Fluxos de callback e conclusão Clerk, matcher de proxy e configuração
  operacional para Google OAuth e Railway.
- Continuação segura para tarefas Clerk de organização, reset de senha e MFA.
- OpenSpec `1.6.0` como dependência local exata, com configuração, scripts,
  guia de criação/validação/implementação/archive e a mudança real
  `establish-maintenance-baseline`.
- Propostas OpenSpec completas para idempotência de publicação/thread e
  proteção de requisições externas contra DNS rebinding.
- `AGENTS.md` raiz e regras específicas para banco e providers, incluindo
  boundaries, segurança, migrations, testes, commits, PR e definição de pronto.
- Documentação canônica e navegável de arquitetura, mapa do repositório, fluxos,
  dados/infraestrutura, Railway e desenvolvimento.
- Diagnóstico inicial, inventário de identidade legada e backlog técnico
  priorizado com evidência, impacto e recomendação.
- Comando `bun run check:ci` para reunir typechecks, 404 testes, boundaries,
  checks próprios, Drizzle, build web e OpenSpec.

### Changed

- O erro de configuração inválida agora **diz qual campo** está errado. Antes o detalhe do
  erro trazia só a mensagem do validador (`Required`), sem o nome do campo, o que era
  inútil assim que um provider passou a ter campo obrigatório. Vale para agendar e editar.

- As configurações por canal do composer passaram a ter rótulo, explicação e opções em
  pt-BR para **todos** os campos de **todos** os providers. Antes, campo sem tradução caía
  no nome cru da variável (`suppressEmbeds`, `replyControl`, `announcementColor`) e a
  explicação vinha do `describe()` do schema, com jargão técnico e nomes de enum da API
  (`SUPPRESS_EMBEDS`, `BCP-47`, `PUBLIC`/`CONNECTIONS`, `accounts_you_follow`). Os textos
  existentes também foram reescritos em linguagem de quem usa o produto.
- Campo de configuração opcional e sem valor padrão pode nomear o comportamento de não
  escolher pela chave `composer.channelSettings.unset.<provider>.<campo>` (em X, "Qualquer
  pessoa" no lugar de "Padrão da rede"); sem a chave, o texto genérico continua valendo.
- A nota de cada rede no catálogo de conexões passou a usar o tooltip padrão do app e a
  mostrar apenas o texto explicativo do que a rede publica. A orientação específica do modo
  da instalação (chaves no `.env` em self-host, nada no gerenciado) continua no diálogo de
  conexão. O ícone "?" do cartão passou a usar accent com relevo, como os demais controles.
- A descoberta de Páginas da Meta (listagem direta mais Business Manager, paginada e
  deduplicada) passou a ter fonte única em `packages/providers/src/shared/meta-graph.ts`,
  compartilhada pelos canais Facebook e Instagram (Facebook Business), sem mudança de
  comportamento do Facebook.
- Clerk autentica toda requisição humana; a API Manypost continua responsável
  por usuário, organização, membership, role e autorização. Não existe sessão
  humana interna nem fallback de senha/social. API keys, MCP e OAuth de canais
  não mudaram.
- O CI cria sessões Clerk de teste com chave RSA efêmera e identidades em
  PostgreSQL descartável; os E2E não dependem mais do JWT humano removido.
- Bun fixado em `1.3.14`; CI e imagem usam instalação congelada pelo `bun.lock`.
- GitHub Actions passa a executar typecheck web, brand, build Next, build da
  imagem Docker e validação OpenSpec além das verificações anteriores.
- Docker e Railpack deixam de aceitar instalação ou build web com falha.
- Next.js atualizado de `16.2.10` para `16.2.11` e Drizzle ORM de `0.44.7`
  para `0.45.2`, mantendo contratos e schema.
- Trinta e uma menções comparativas seguras ao produto de origem foram
  neutralizadas em comentários/configuração/testes; a identidade executável já
  era Manypost.

### Fixed

- Botão “Continuar com Google” não engole mais falha silenciosa quando o Clerk
  ainda não carregou: espera o resource, captura erro e mostra
  `auth.googleUnavailable`. Docs de ops cobrem DNS only / Zone Hold / SSL do
  domínio `clerk.manypost.com.br`.
- Conexões SSE agora têm timeout Bun de 30 segundos, acima do ping de 25
  segundos, evitando a desconexão observada no Railway.
- O web client anexa o token Clerk a toda chamada `/v1`; o EventSource usa o
  cookie Clerk `__session`. Um 401 encerra o Clerk, vai ao login e não inicia
  retry do stream.
- API REST pública e MCP aceitam somente API key `mp_live_` por bearer; bearer
  ou cookie Clerk não pode mais contornar os escopos de máquina.
- Respostas 401, 403, 429 e 5xx da Backend API Clerk são tratadas como
  indisponibilidade; somente usuário inexistente é uma identidade inválida.
- A conclusão do popup OAuth exige o `origin` do app e a janela popup
  efetivamente aberta.
- AES-256-GCM fixa explicitamente a tag de autenticação existente em 16 bytes
  tanto na cifra quanto na decifra.
- Advisories diretos do Next.js e do Drizzle ORM foram removidos pelo menor
  patch compatível validado.

### Security

- Autenticação humana e autenticação de máquina usam middlewares separados, com
  testes negativos HTTP para bearer e cookie Clerk nas superfícies REST/MCP.
- Corridas de provisionamento por subject/e-mail e rollback intermediário são
  exercitados contra PostgreSQL real no CI.
- O audit caiu de 17 para 7 advisories transitivos. Permanecem 4 altos e 3
  moderados nas cadeias de Sharp/PostCSS, AJV/fast-uri, Redocly/js-yaml,
  Drizzle Kit/esbuild e MCP SDK/Hono; cadeia e exposição estão no
  [backlog](docs/audits/technical-backlog.md#advisories-de-dependências-restantes).
- Referências ao Postiz que permanecem são licença/atribuição ou
  história/proveniência. Nenhum identificador runtime legado foi encontrado;
  paths preservados e contagens constam no
  [inventário](docs/audits/postiz-reference-inventory.md).

### Known Issues

- O CLI Clerk está autenticado, vinculado e aprovado pelo `clerk doctor`; o
  domínio Clerk de produção ainda aguarda DNS/SSL, e a URI Google exata e o
  teste browser autenticado dependem dessa ativação e do primeiro usuário.
- Continuações concorrentes de thread e resultados externos indeterminados
  exigem fencing durável antes de qualquer mudança no publish.
- Media/webhook egress exige address pinning para fechar DNS rebinding.
- Exceções inesperadas dos handlers de fila podem ser reconhecidas como job
  concluído; refresh concorrente ainda não usa compare-and-swap.
- Uploads dependem de um volume Railway local sem restore automatizado testado;
  S3 ainda não possui adapter.
- Não há lint/formatter compartilhado nem E2E browser.

### Breaking Changes

- Clerk é obrigatório e invalida as sessões humanas anteriores. Usuários
  existentes precisam criar/recuperar a identidade no Clerk com o mesmo email.
  Login, cadastro, OAuth social, exchange, refresh e logout internos foram
  removidos. Não houve migration destrutiva nem mudança na API pública/MCP ou
  no OAuth de canais.

### Operational Notes

- Produção exige chaves de uma instância Clerk de produção e credenciais Google
  customizadas. A URL de callback deve ser copiada da conexão Google no Clerk;
  as origens web canônicas são `https://app.manypost.com.br` e
  `http://localhost:3000` somente em desenvolvimento.
- A imagem agora falha cedo se o lockfile ou build Next estiver inválido; isso
  pode transformar deploy antes “verde” em falha de build, por segurança.
- O daemon Docker local não estava disponível durante a validação inicial da
  branch; o build efetivo deve ser comprovado pela CI/Railway antes do merge.
- Rollback não requer mudança de dados: redeploye o último release verificado.
  O release novo não contém fallback runtime.
