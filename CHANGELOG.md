# Changelog

Todas as mudanças relevantes do Manypost serão registradas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto pretende seguir versionamento semântico quando publicar releases.

## [Unreleased]

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
