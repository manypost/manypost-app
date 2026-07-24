# CHANGELOG_ONDAS.md — histórico de entregas, onda a onda

[← docs/](../README.md) · [STATUS](STATUS.md) · [DECISIONS](DECISIONS.md) · [README do projeto](../../README.md)

> **O que é este arquivo:** o registro cronológico (mais recente primeiro) de cada fatia entregue,
> com as provas de cada uma (testes, E2E, verificação em navegador). Nasceu do bloco "última
> atualização" que crescia dentro do [STATUS.md](STATUS.md) — o STATUS agora responde
> "onde estamos"; este arquivo responde "como chegamos aqui".
>
> **Como manter:** ao fechar uma fatia, adicione a onda nova **no topo** e atualize o STATUS.
> Cada entrada é auto-contida: o que mudou, onde no código, e a prova de que funciona.

## Índice

| Onda | Data | Entrega |
|---|---|---|
| 20 | 2026-07-24 | Clerk-only — autenticação humana no Clerk; Manypost autoriza org/papel; sem JWT/exchange legado |
| 19 | 2026-07-23 | Dev.to — primeiro destino de **artigo** e primeira rede sem gate externo (chave pessoal, sem env) |
| 18 | 2026-07-23 | Linguagem de quem usa — settings do composer 100% em pt-BR e humanizadas; nota do catálogo no tooltip padrão |
| 17 | 2026-07-23 | Instagram via Facebook Business — **família Meta completa** (conta IG resolvida pela Página escolhida no post) |
| 16 | 2026-07-23 | Facebook Pages — 3º provider da família Meta (Página escolhida por post, token de Página derivado no publish) |
| 15 | 2026-07-23 | Instagram (standalone) — 2º provider da família Meta (Instagram Login, sem Página do Facebook) |
| 14 | 2026-07-23 | Profundidade 3D sem sombra (brand v1.3): relevo por gradiente + borda por lado em botões e cards |
| 13 | 2026-07-23 | Nota humanizada de conexão por rede (ícone "?" + popover), específica por modo (self-host × nuvem) |
| 12 | 2026-07-22 | Twitch e Kick (chat ao vivo) + catálogo deixa de esconder rede sem credencial |
| 11 | 2026-07-22 | Threads — primeiro provider da família Meta (container → `threads_publish`) |
| 10 | 2026-07-21 | Hosts dedicados para as superfícies de máquina (`api.` e `mcp.`) |
| 9 | 2026-07-21 | Billing Stripe + `PlanPolicy` + onboarding de conversão |
| 8 | 2026-07-19 | API pública `/public/v1` + servidor MCP |
| 7 | 2026-07-18 | Semáforo `maxConcurrent` + `/metrics` Prometheus |
| 6 | 2026-07-17 | TikTok — primeiro provider da onda 2 (auditoria enviada) |
| 5 | 2026-07-17 | Composer e detalhe em popup + settings por canal na edição |
| 4 | 2026-07-17 | Discord OAuth2+Bot, Telegram `/connect`, split de providers |
| 3.1–3.4 | 2026-07-17 | Slot "+" no calendário, settings por canal, formulário auto-gerado, preview por rede |
| 3 | 2026-07-16 | Paridade Postiz no web + toda a superfície da API na UI |
| 1–2 | 2026-07-11/16 | Fundação do `apps/web`, composer v1, calendário em lista |

> As ondas 1 e 2 do frontend e as fatias de backend anteriores (fundação, banco, auth, publicação,
> retry, webhooks, mídia, threads, aprovação por link, listagens/SSE, providers da onda 1) estão
> registradas em [STATUS.md §2](STATUS.md#2-o-que-já-está-pronto-e-verificado), com spec e código de cada uma.

---

## Onda 20 — Clerk-only: autenticação humana fora do Manypost

**2026-07-24.** A autenticação humana deixa de ser JWT/Argon2/social próprio da API e passa a
ser **só Clerk**. A UI de login/cadastro/Google permanece Manypost (custom flows); o token Clerk
vai em toda request `/v1` (Bearer) e no SSE via cookie `__session`. A API verifica o token e
resolve usuário, organização e papel no Postgres — **Manypost autoriza**. API keys, MCP e OAuth
de canais não mudam. Rollback = reverter o release (não há fallback legado embutido).

Mudança OpenSpec: [`adopt-clerk-authentication`](../../openspec/changes/adopt-clerk-authentication/)
(PR [#39](https://github.com/manypost/manypost-app/pull/39)).

**Provas:** `bun run check`, `db:check`, `build:web`, `spec:validate`; integração PostgreSQL de
provisionamento concorrente; E2E `e2e-auth` / `e2e-publish` / `e2e-public` / `e2e-mcp` com sessão
Clerk assinada localmente. Smoke browser signed-in, DNS Clerk de produção, Google OAuth e vars
Railway ficam como checklist operacional pós-merge.

**Onde:** `apps/api` (middleware/identity), `apps/web` (ClerkProvider + `clerk-fetch`),
`packages/config` (fail-closed), docs de arquitetura/ops, CHANGELOG raiz.

---

## Onda 19 — Dev.to: o primeiro artigo, e a primeira rede sem gate

**2026-07-23.** Todas as redes entregues até aqui publicam **post curto**, e as quatro últimas (a
família Meta) estão travadas por um processo de aprovação externo que não depende do código. O
Dev.to é o oposto: a chave é gerada pelo próprio usuário na conta dele, **sem app, sem OAuth, sem
revisão e sem variável de ambiente** — a rede aparece disponível em toda instalação assim que o
código sobe, self-hosted ou nuvem. É também o primeiro **destino de artigo**, o que obrigou a
responder como um texto longo cabe num pipeline desenhado para post curto.

Mudança OpenSpec: [`add-devto-provider`](../../openspec/changes/add-devto-provider/) — proposta,
design e 7 requisitos escritos e validados **antes** do código.

**1. Título obrigatório, recusado no composer e não no horário marcado.** Um artigo sem título não
existe, e o título não sai do corpo do texto. `title` entrou como campo **`required`** do
`settingsSchema` — o primeiro do app. Assim o agendamento recusa com `post.invalid_settings`
enquanto o autor ainda está na tela, em vez de virar uma publicação `FAILED` de madrugada. Isso não
re-litiga a decisão 17 do STATUS (o `channelId` do Discord ficou opcional **de propósito**): lá
existe fallback — o provider auto-descobre um canal postável —, então obrigatório recusaria post que
seria entregue. Aqui não há fallback. A regra registrada é *"obrigatório quando não há fallback"*.

Encaixou sem mecanismo novo: o test-kit não impedia (`safeParse` nunca lança — o comentário lá
ganhou a nota para não ser lido como proibição) e o composer **já validava `required` do JSON Schema
no cliente**, então o campo ganhou asterisco e mensagem com o rótulo pt-BR de graça.

**2. Bug real que o Dev.to expôs: o erro não dizia qual campo.** `post.invalid_settings` devolvia
`issues: ["Required"]`, porque o `path` do Zod era descartado. Enquanto todo settings era opcional
isso quase nunca disparava; com um campo obrigatório, "settings inválidos: Required" é inútil. As
issues agora vêm prefixadas pelo campo (`title: Required`), nos **dois** pontos — agendar e editar.

**3. A capa vem da mídia anexada, não de um campo de settings.** O Postiz modela `main_image` como
mídia dentro do DTO; aqui já existe biblioteca de mídia, dropzone e validação por item, e um segundo
caminho de imagem vivendo só nas settings de um provider seria um paralelo com validação própria. O
provider usa a primeira imagem do item como capa e declara `images.maxCount: 1`,
`videos.maxCount: 0` — o `checkMediaRules` compartilhado recusa o excesso **no agendamento**, sem
uma linha de validação específica. Custo aceito e registrado: a capa é baixada pelo Dev.to pela URL,
então depende de mídia acessível publicamente; o corpo do artigo, não.

**4. Organizações reusam sub-contas, com a limitação escrita na spec.** Publicar por uma organização
é a mesma forma de escolher canal do Discord ou Página do Facebook: `listSubAccounts` +
`SUB_ACCOUNT_FIELDS`, sem alargar o contrato. Só que a API do Forem **não lista as organizações do
autor** — o caminho possível (e o que o Postiz faz) é derivá-las dos artigos já publicados. Autor
que nunca publicou por uma vê lista vazia; como o campo é opcional e o padrão é o perfil pessoal,
isso degrada para o caso comum em vez de um formulário quebrado. Falha ao listar devolve `[]`, para
não derrubar o composer inteiro por uma lista de conveniência.

**5. Uma requisição, e nada depois dela.** A resposta do create já traz id e URL do artigo — então,
diferente da família Meta, não existe chamada pós-publicação que possa lançar e provocar repost. Sem
renovação de credencial: a chave não expira, e 401/403 leva a `REFRESH_REQUIRED` (colar chave nova),
o mesmo caminho do `discord-webhook` e do LinkedIn.

**6. Preview de artigo.** O cartão da listagem do Dev.to (capa, título, autor, tags, tempo de
leitura). Para isso o `NetworkPreview` passou a receber **settings** — o título não está no texto —,
ligado no composer e no detalhe do post. A tela pública de aprovação **não** recebe: `/public/approval`
não expõe settings de propósito, e mudar isso é mudança de API com OpenSpec próprio. Fica registrado
como pendência, não como esquecimento.

**Provas:** `bun run check` verde — **473 testes** (eram 431: +37 do provider, +5 no core) +
typecheck api/web + fronteiras + grep de IA + brand; `bun run build:web` limpo. O `e2e-auth` ganhou
quatro asserções: a rede está disponível **sem configuração**, conecta por campos, expõe
`connectionFieldsSchema.apiKey` e declara `title` como `required` no catálogo.

**Código:** `packages/providers/src/devto/`, registro em `packages/providers/src/index.ts`,
`settingsIssues` em `packages/core/src/application/use-cases/publishing.ts`, `SUB_ACCOUNT_FIELDS` e
`DevtoPreview` no `apps/web`, guia da chave em [INTEGRATIONS_SETUP §2.3](INTEGRATIONS_SETUP.md).

---

## Onda 18 — a linguagem de quem usa: settings do composer em pt-BR e sem jargão

**2026-07-23.** Nenhum comportamento novo — é uma onda de **texto e apresentação**, e mesmo assim a
mais visível para quem não é desenvolvedor. Três frentes:

**1. As configurações por canal falavam a língua do schema, não a de quem usa.** O
`ChannelSettingsCard` monta o formulário a partir do `settingsSchema` de cada provider e busca o
rótulo em `composer.channelSettings.fields.<provider>.<campo>`; **quando a chave não existe, ele cai
no nome cru do campo** e a explicação cai no `describe()` do zod. Resultado na tela: `suppressEmbeds`
e `silent` no Discord (Webhook), `replyControl` e `linkAttachment` no Threads, `messageType` e
`announcementColor` na Twitch — nomes de variável, em inglês, direto no rosto de quem só quer
publicar. Nas opções era pior: `accounts_you_follow`, `mentioned_only`, `primary`, `blue`. Agora a
cobertura é **100%** — todos os campos de todos os providers têm rótulo, explicação e opções em
pt-BR, verificado cruzando os `settingsSchema` com o `pt-BR.json` (script único de conferência).

**2. O que sobrava de jargão foi reescrito para linguagem de gente.** O que valia como explicação
técnica não vale como ajuda: "Não expandir previews de link no post (`SUPPRESS_EMBEDS`)" virou
"Publica só o texto, sem o cartão com imagem e resumo da página do link"; "Códigos BCP-47 separados
por vírgula" virou "Ajuda o Bluesky a mostrar o post para quem fala esse idioma e a oferecer
tradução"; `PUBLIC`/`CONNECTIONS` do LinkedIn viraram "Qualquer pessoa" / "Somente as minhas
conexões". As opções agora respondem à pergunta do rótulo ("Quem pode ver" → "Qualquer pessoa"), em
vez de repetir o enum da API.

**3. Campo opcional sem padrão ganhou nome próprio.** Em X, não escolher quem responde significa
"qualquer pessoa" — mas o seletor dizia "Padrão da rede", que não informa nada. Nova chave
`channelSettings.unset.<provider>.<campo>` nomeia o comportamento de não escolher, com fallback no
texto genérico de antes.

**4. A nota do catálogo de redes voltou ao padrão do app.** A onda 13 tinha criado um popover
próprio (ícone da rede + nome + divisória + linha do modo self-host/nuvem) — informação demais para
um cartão que a pessoa está só passando o olho, e um componente fora do padrão. Agora é o
**tooltip padrão** (`components/ui/tooltip`, superfície escura `bevel-ink`), com **só o texto
explicativo**: o que aquela rede publica. O que **este modo** exige continua existindo, só que no
**diálogo de conexão** — que é onde a informação vira ação. O ícone "?" deixou de ser cinza com
face e borda próprias e virou **só o glifo em `accent-hover`** (o pé do gradiente do botão
primário): ajuda no canto de um cartão não é controle elevado — o relevo é do cartão, e mais uma
moldura só competia com ele.

**Onde:** `apps/web/src/messages/pt-BR.json` (`composer.channelSettings`),
`apps/web/src/features/composer/channel-settings.tsx` (lookup de `unset`),
`apps/web/src/features/channels/provider-note.tsx` (tooltip + botão accent).

**Provas:** `bun run typecheck:web` e `bun run check:brand` verdes; conferência automática de que
todo campo/opção de todo `settingsSchema` tem chave no `pt-BR.json` (só o provider `fake`, de dev,
segue sem explicação — de propósito). Verificado no navegador em `localhost:3000`: tooltip do
catálogo em `/conexoes` e as configurações dos cinco canais conectados (Mastodon, Bluesky, Telegram,
Discord, LinkedIn) no composer.

---

## Onda 17 — Instagram via Facebook Business: a família Meta fechada

**2026-07-23.** Novo `packages/providers/src/instagram`, lendo o código do Postiz
(`instagram.provider.ts`, 1096 l.). É a **última peça da família Meta** e, de propósito, não trouxe
nenhum padrão novo: ela é a **soma dos dois moldes** que as ondas 11/15/16 já haviam provado — o
OAuth e as sub-contas do `facebook` (onda 16) + o `container → poll → media_publish` do
`instagram-standalone` (onda 15). Como no Postiz (e como o nosso `discord` × `discord-webhook`), as
duas variantes do Instagram são **providers separados**: `instagram-standalone` (Instagram Login,
sem Página) e `instagram` (via Facebook Business).

**(A) Uma chamada resolve tudo o que o publish precisa.** O desenho herdado da onda 16 vale igual: o
canal representa a **conta do usuário do Facebook**, e a conta de destino é escolhida **por post**
(`settingsSchema.pageId`, alimentado pelo `SubAccountsField`). A diferença é que aqui o publish
precisa de **duas** coisas derivadas — o token da Página e o **id da conta do Instagram** — e as duas
saem de uma requisição só: `GET /{pageId}?fields=access_token,instagram_business_account{id,username}`.
Continua valendo a invariante da onda 16: **o token da Página nunca é gravado em settings** (jsonb
sem cifra) — ele é derivado a cada publicação e sempre chega fresco. O teste
`JSON.stringify(subs)).not.toContain(PAGE_TOKEN)` trava isso.

**(B) O valor gravado é o `pageId`, mas o rótulo é o `@` da conta.** `listSubAccounts` lista as
Páginas (`/me/accounts` + Business Manager) e **filtra as que têm `instagram_business_account`** —
Página sem Instagram vinculado não publica aqui e some da lista. Para cada uma, busca o perfil do IG
e devolve `{ externalId: pageId, name: '@handle' }`: a pessoa escolhe pela conta que reconhece, e o
que vai para o settings é o id da Página (de onde saem token e conta IG). Isso mantém o
`SUB_ACCOUNT_FIELDS` do composer com **um** campo por provider, sem alargar o contrato de sub-contas.

**(C) Publicação idêntica ao standalone, só que na `graph.facebook.com` e com o token da Página.**
Foto, **reel** (vídeo único no feed), **carrossel 2–10** misturando imagem e vídeo (filhos
`is_carousel_item` sem legenda; só o pai leva a `caption`) e **story** (mídia única). Mantidas as
duas decisões de segurança do standalone: **story com mais de uma mídia é 422 antes de qualquer
chamada** (a Meta cria um story por mídia; publicar uma e falhar duplicaria no retry) e **permalink
best-effort** (depois do `media_publish` o post está na rede — lançar ali faria a máquina de estados
repostar; sem permalink, cai no perfil). Réplicas de thread viram **comentários** no post raiz.

**(D) Faxina junto:** a resolução de Páginas (`/me/accounts` + `owned_pages`/`client_pages` do
Business Manager, paginando e deduplicando) era idêntica no `facebook` e no provider novo — virou
fonte única em `packages/providers/src/shared/meta-graph.ts` (`metaFetch` + `fetchPages`, com os
`fields` por provider). O `facebook` passou a usá-la sem mudança de comportamento (os goldens dele
continuam verdes).

**(E) Zero variável de ambiente nova:** o provider usa a **mesma app Meta do `facebook`
(`FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET`)**, porque é o mesmo produto "Facebook Login" — quem já
habilitou o Facebook ganha o Instagram Business de graça. `providerSecretsFromEnv` mapeia os dois ids
para o mesmo par (o `.env.example` avisa que o par habilita duas redes).

**Prova:** `bun run check` verde — **431 testes** (+40 nesta onda) + typecheck (api/web) + fronteiras
+ grep de IA + brand. Golden bodies novos cobrem: URL de consentimento com os 7 escopos do Postiz,
as duas trocas de token, recusa legível sem `instagram_content_publish`, refresh por
`fb_exchange_token`, sub-contas (Página sem IG filtrada; Business Manager indisponível não derruba a
lista), os quatro caminhos de publicação com a asserção de que **quem assina é o token da Página**,
story >1 barrado **sem tocar na rede**, Página sem IG vinculado, container `ERROR` antes do
`media_publish`, permalink que falha sem derrubar o post, comentários e a taxonomia de erros
(190/REVOKED → refresh; 2207003 → transient; 2207042/2207001 → permanent). `scripts/e2e-auth.ts`
ganhou o bloco do `instagram` (catálogo + URL de consentimento real).

**Ficou de fora:** analytics (`instagram_manage_insights`), refresh proativo do token de 60 dias,
colaboradores/áudio/trial reels (settings extras do Postiz) e a submissão do App Review. Smoke real
de publicação exige túnel HTTPS + driver S3/R2 (a Meta faz *pull* da mídia pela URL).

---

## Onda 16 — Facebook Pages, 3º provider da família Meta

**2026-07-23.** Novo `packages/providers/src/facebook` — a Página do Facebook, lendo o código do
Postiz (`facebook.provider.ts`). É o provider que fecha o padrão que faltava na família Meta: o
**token de Página + sub-conta escolhida por post**. Diferente de Threads/Instagram (uma conexão =
uma conta), o Facebook publica com o **token da Página**, não o do usuário — e uma conta administra
várias Páginas.

**(A) O desenho central — Página por post, token derivado, nunca em settings.** A arquitetura do
manypost guarda UM token por canal e não tem mecanismo de "trocar o token do canal pela sub-conta".
Seguindo o STATUS §4.1 ("reusar o padrão de sub-contas do Discord"), o **canal representa a conta do
usuário** (`externalId` = user id, token longo do usuário cifrado) e a **Página é escolhida por
post** no composer: `settingsSchema.pageId` obrigatório, alimentado pelo `SubAccountsField` via
`listSubAccounts`. No publish, o token da Página é **derivado na hora** do token do usuário
(`GET /{pageId}?fields=access_token`) — e **NUNCA é gravado em `channelSettings`/settings**, que é
jsonb sem cifra (um token ali seria vazamento). Derivar a cada publish é uma chamada extra barata e
sempre pega um token fresco. `listSubAccounts` resolve as Páginas por `/me/accounts` **+ Business
Manager** (`owned_pages`/`client_pages`, best-effort — exige `business_management`, então vem em
try/catch). O `SubAccountsField` do composer virou **genérico** (mapa `SUB_ACCOUNT_FIELDS`
provider→campo, rótulos por i18n) em vez de hard-coded no Discord.

**(B) OAuth Facebook Login** (igual molde de token do Threads/IG): `code` → **token curto** em
`GET graph.facebook.com/v20.0/oauth/access_token` → **token longo (~60d)** por
`grant_type=fb_exchange_token`; checa `/me/permissions` (sem `pages_manage_posts` concedido → **403
legível**) e `/me?fields=id,name,picture` para a identidade. **Não há refresh token separado** — o
token longo se reapresenta ao `fb_exchange_token` para renovar (`accessToken` = `refreshToken`),
refresh **reativo** (401 → `classifyError` → refresh; token que expira sem uso cai em
`REFRESH_REQUIRED`). Escopos = paridade Postiz (`pages_show_list`, `business_management`,
`pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement`, `read_insights`).

**(C) Publicação por caminho** (a Meta faz *pull* da mídia por URL pública — não subimos bytes):
- **Feed de texto/álbum**: cada foto sobe `/{pageId}/photos` `published:false` → o `/{pageId}/feed`
  as anexa por `attached_media` num post atômico. Retry antes do `/feed` só deixa fotos ocultas
  órfãs (a Meta as recolhe) — **nunca duplica**. Texto puro = só `message` (o Facebook aceita
  só-texto: `requiresMedia:false`, diferente do IG).
- **Vídeo único no feed = reel**: `/{pageId}/videos` com `file_url` + `description`.
- **Story**: de foto (`/photos` `published:false` → `/photo_stories`) e de vídeo (`/video_stories`
  em fases: start → upload hospedado com `file_url` no header → poll `video_status` → finish).
  **Mídia única de propósito** (a Meta cria um story por mídia; publicar cada uma e falhar no meio
  duplicaria no retry — mesma decisão do IG standalone). Como `validateMedia` não recebe settings,
  a checagem `>1` mora no publish.
- **Réplicas = comentários encadeados** no post raiz (`/{parentId}/comments`; item i responde ao
  `externalId` do item i-1 → o Facebook aninha; texto + no máx. 1 foto via `attachment_url`).
- Permalink best-effort (depois do post na rede, nada lança — senão a máquina de estados repostaria).

**(D) Web.** `FacebookPreview` no `network-preview.tsx` (cabeçalho da Página com globo, mídia de
ponta a ponta, barra Curtir/Comentar/Compartilhar, réplicas como comentários) — todas as redes agora
têm preview próprio. `pageId` renderiza como `SubAccountsField` (busca `/sub-accounts`), `postType`
como select feed/story. Facebook saiu do "Em breve" (`upcoming.ts`). Nota de conexão por modo
(self-host mostra `FACEBOOK_APP_ID/SECRET`; nuvem "conecte e escolha a Página").

**(E) `classifyError`** (paridade com os códigos do Postiz): token/permissão de Página →
`refresh-token` (190/490/1404078, "Error validating access token", "REVOKED_ACCESS_TOKEN"); "posting
too fast" (1390008), instabilidade (código 1/2, 1363047/1609010) e 5xx/429 → `transient`; política
de conteúdo, arquivo inválido, foto grande demais → `permanent`.

**Provas.** `bun run check` verde: **391 testes** (typecheck api+web, fronteiras, grep de IA, brand).
O `facebook.provider.test.ts` cobre o test-kit de contrato + golden bodies: OAuth (curto →
`fb_exchange_token` → 403 sem `pages_manage_posts`), `listSubAccounts` (dedup `/me/accounts` +
Business Manager, e o token da Página **não** aparecendo em `channelSettings`), publicação
(texto/álbum/reel com o token da Página derivado, story de foto e de vídeo em fases, story `>1` →
422), réplica por comentário e `classifyError`. `env.test.ts`: mapa `FACEBOOK_APP_ID/SECRET` →
`ctx.secrets`. `scripts/e2e-auth.ts` ganhou o Facebook: sem env → `connect 404`; com env, o `connect`
leva à URL de consentimento da Meta com `pages_manage_posts` (o bloco dedicado roda localmente, como
Threads/IG). **Smoke real** de publicação com mídia exige túnel HTTPS público (a Meta baixa a URL) e
o **driver S3/R2** ainda pendente; App Review + Business Verification são o gate externo (não bloqueia
o código — Development Mode cobre dono + testers).

**Ficou de fora** (retomar): analytics (`read_insights` — rota + série), **refresh proativo** do
token de 60 dias (decisão em aberto, comum a Threads/IG/FB), presets de fundo de texto
(`text_format_preset_id`), e a variante `instagram` via Facebook Business — que reusa este mesmo app
Meta, token de Página e `listSubAccounts`, resolvendo `instagram_business_account` na Página.

---

## Onda 15 — Instagram (standalone), 2º provider da família Meta

**2026-07-23.** Novo `packages/providers/src/instagram-standalone` — o caminho mais curto da família
Meta para o criador BR: **Instagram Login, sem Página do Facebook no meio** (só uma conta comercial
ou de criador). Reusa o molde **container → poll → publish** que o Threads (onda 11) deixou pronto,
lendo o código do Postiz (`instagram.standalone.provider.ts`, que delega `post`/`comment` ao
`instagram.provider.ts` passando o host `graph.instagram.com`).

**(A) OAuth Instagram Login** (três saltos, diferente do Threads): `code` → **token curto (1h)** em
`POST https://api.instagram.com/oauth/access_token` (form-urlencoded, não a Graph) → **token longo
(~60 dias)** em `GET graph.instagram.com/access_token?grant_type=ig_exchange_token` — é o longo que
fica cifrado. A URL de consentimento é `www.instagram.com/oauth/authorize?enable_fb_login=0&…`
(escopos `instagram_business_*` separados por vírgula). Se a Meta informa as permissões e falta
`instagram_business_content_publish`, a conexão **recusa com 403 legível** (mesmo padrão de
Threads/TikTok). `channelSettings = {userId, username}`: o `userId` (campo `user_id` do `/me`)
endereça `/{userId}/media`; o `username` monta a URL de fallback. **Não há refresh token separado**
— o próprio token longo vai ao `/refresh_access_token` (`ig_refresh_token`), então `accessToken` e
`refreshToken` guardam o mesmo valor e o worker persiste a rotação; renovação **reativa** (401 →
`classifyError` → refresh), token que expira sem uso cai em `REFRESH_REQUIRED`.

**(B) Publicação em container** (paridade com o `post` do Postiz): foto única → `image_url` +
`caption` no container; **vídeo único no feed → REELS**; **carrossel 2–10** misturando imagem e
vídeo (filhos `is_carousel_item` SEM legenda, pai `CAROUSEL` com `children` + caption; dentro do
carrossel o vídeo é `VIDEO`, não REELS); **story** → `media_type=STORIES`. Poll de `status_code`
até `FINISHED`, com **orçamento de polls compartilhado** pela publicação inteira (< watchdog de 15
min), `ERROR`/`EXPIRED` = 422 permanente, estouro de orçamento = 504 transient (nada publicado ⇒
retry seguro). **Réplicas de thread viram COMENTÁRIOS** no post raiz (`/{postId}/comments`, só
texto — `validateMedia` barra mídia em itens 1+), que é o `comment()` do Postiz. `requiresMedia:
true` (o IG não aceita post só-texto, como o TikTok); `maxLength` 2200.

**Três divergências de corretude do Postiz, todas registradas no código:** (1) **story é uma mídia
só** — não existe carrossel de story; agendar story com >1 mídia levanta 422 ANTES de publicar
qualquer coisa (o Postiz publica cada mídia como um story separado e devolve o último; aqui isso
duplicaria no retry, então barramos). (2) **permalink best-effort** — depois do `media_publish` o
post já está na rede, então a busca do permalink nunca lança (senão a máquina de estados retentaria
e repostaria); falhou, cai no perfil `@handle`. (3) **parâmetros no CORPO do POST** (o Postiz monta
query string) e **ctx injetado** (nada de env/fetch global), como no nosso Threads.

**(C) Encaixe**: registrado no registry; `providerSecretsFromEnv`/`PROVIDER_ENV` ganharam
`instagram-standalone` (`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`); `.env.example` com redirect
(`/v1/channels/callback/instagram-standalone`) e escopos; ícone `Instagram.svg` mapeado; **preview
de feed no composer** (`InstagramPreview` — header com @handle, mídia quadrada, indicador 1/N do
carrossel, barra curtir/comentar/enviar, legenda com @handle em negrito e réplicas como comentários);
nota humanizada de conexão (`connections.notes.instagram-standalone`, específica por modo); e o
**Instagram saiu do "Em breve"** (o `instagram-standalone` cobre "Instagram" no catálogo; a variante
via Facebook Business e o `facebook` seguem no roteiro). Nome do provider = **"Instagram"** (o
standalone é o caminho primário; a variante FB-business se diferencia quando entrar).

**Provas**: `bun run check` **verde — 365 testes** (+24 do instagram-standalone: contrato + golden de
OAuth/`ig_exchange_token`/refresh/foto/reel/carrossel misto/story/`publishReply` por comentário/
permalink indisponível/container ERROR/classificação de erro) + typecheck (api + web), fronteiras,
grep de IA e brand OK. **E2E real** contra stack **isolada** (Postgres 5599 + Redis 6499 efêmeros,
API 3987): `e2e-auth` **TUDO OK** com o bloco novo (catálogo declara mídia obrigatória + 2200 chars +
carrossel 10 + réplica por comentário; connect → URL real do Instagram Login com
`instagram_business_content_publish`) e `e2e-publish` **TUDO OK** (regressão da pipeline). **Ficou
de fora** (não bloqueia): analytics (`instagram_manage_insights`), refresh proativo do token de 60
dias, colaboradores/áudio/trial reels (settings do Postiz que só o standalone não expõe), a variante
`instagram` via Facebook Business e a submissão do App Review (gate jurídico — [platform-gates](platform-gates.md));
o código roda inteiro em **Development Mode**. Como a Meta faz *pull* da mídia por URL pública, o
smoke real de publicação com mídia exige túnel HTTPS (localhost é inalcançável — mesma pegadinha do
Threads) e reforça a pendência do **driver S3/R2**.

---

## Onda 14 — profundidade 3D sem sombra (brand v1.3)

**2026-07-23.** Evolução deliberada do brand (não um contorno): dar **contraste e profundidade** à interface mantendo o pilar inviolável **"zero sombras"**. O relevo 3D que o Postiz/apps maduros têm foi reproduzido **sem um único `box-shadow`** — só **gradiente de preenchimento** (topo mais claro → base mais escura) + **cor de borda por lado** (borda de topo clareada, borda de base escurecida) + um brilho fino de 1–3px sob o topo, tudo derivado dos tokens via `color-mix` no único arquivo com hex (`globals.css`). Quatro tokens de intensidade (`--edge-light`/`--edge-dark`/`--bevel-gloss`/`--bevel-lift`) governam o app inteiro num ponto só; escolhida a intensidade **média**.

**Modelo de três níveis** (a profundidade codifica a *função* do elemento, senão vira "tudo em relevo"): (1) **controle elevado / relevo forte** = botões preenchidos (`primary`/`enterprise`/`outline`/`destructive`), via classes `.bevel-*` no `<Button>`; (2) **superfície clicável / relevo sutil** = `<Card>` + tiles de provider (Conexões) + cards de plano, via `.bevel-surface`; (3) **flat** = containers/painéis (o "chão"), inputs/selects, badges, dots, tints, estados selecionados e overlays. No `primary` a face vai de `--accent` a `--accent-hover` — **os dois já passam AA com branco**, então o relevo não custa contraste. Hover das variantes com gradiente usa `filter: brightness()` (não dá para transicionar `linear-gradient` com `background-color`) — suave, sem `translate`/`scale`, o elemento fica firme (BRAND §2.3 preservado). **Todos os botões ganharam `cursor: pointer`** (o `<button>` nativo vinha com `default`).

**Segunda passada, na prática** (feedback do owner: "alguns botões continuaram flat"): (a) o **`outline` foi reforçado** — a face branca quase não carregava relevo, então o "Conectar canal" (ícone `Plug`, `variant="outline"`) lia como flat; agora sobe pela borda (topo +45% branco, base +32% preto) e um degradê mais perceptível, sem competir com o primary; (b) o **"+" do calendário** (FAB roxo ad-hoc em `calendar-grids.tsx`, que não passava pelo `<Button>`) recebeu a face `.bevel-primary`; (c) **tiles de provider** e **cards de plano** entraram no relevo sutil de card. Containers estruturais e campos ficam flat de propósito.

**Terceira passada — profundidade pervasiva** (feedback: "sidebar, popovers, highlight do dia, seletores… todos os elementos que se pareçam com isso"): a profundidade deixou de ser só "botão + card" e virou **linguagem do app inteiro**, em três níveis (§2.2). Ganharam relevo: **todos os overlays** via os primitivos do kit (`popover`, `dropdown-menu`, `dialog` modal, `alert-dialog`, `sheet`, `select` content → `.bevel-surface`; `tooltip` → `.bevel-ink` escuro), a **sidebar** (painel + item de nav ativo via `.bevel-accent`), os **seletores de visualização** (aba ativa dos `Tabs` = tecla elevada sobre o trilho, regra `[data-slot=tabs-trigger][data-state=active]`), a **pílula do dia atual/selecionado** no calendário (`.bevel-primary`), o **"?" das conexões** (chip redondo elevado) e os **chips de filtro de canal** + **card de plano selecionado** (`.bevel-accent`). Fixar nos primitivos do kit propaga o efeito por toda tela que os usa. Dois novos derivados no `globals.css`: `.bevel-ink` (superfície escura) e `.bevel-accent` (tint elevado p/ estado selecionado). O dialog **em tela cheia** (composer) fica flat de propósito — degradê sobre 90dvh vira vinheta.

**Quarta passada — "nada flat" (fields afundam, o resto sobe).** Diretriz do owner: nenhum elemento pode continuar chapado. Isso fecha as duas últimas famílias flat, cada uma com o tratamento certo em vez de "levantar tudo igual": **campos** (`input`/`select`/`textarea` e caixas de digitação do composer) ganharam **profundidade pra DENTRO** — nova classe `.inset-field` (topo escuro/lábio, base clara, borda por lado invertida), porque campo é recuo, não relevo; um input "levantado" brigaria com o instinto de "digite aqui". **Badges e caixas de tint** ganharam volume de pastilha — nova classe `.bevel-chip` (só `background-image` translúcido: clareia o topo, escurece a base, compõe sobre QUALQUER `background-color` sem alterar a cor base — serve badge de qualquer estado, callout de review, caixa de acento). Telas citadas: **Notificações** (banner com brilho; linha lida = superfície elevada, **não lida = `.bevel-accent`** — destaca "atenção" sem ficar flat; sino com badge de contagem em pastilha), **detalhe do post** (cards internos → `.bevel-surface`, caixas de review/URL → `.bevel-chip`, rodapé elevado) e **composer** (caixas do editor, empty state, círculo do ícone e rodapé → `.bevel-surface`; botão "adicionar à thread" → pastilha). Único plano sem volume: o fundo da página (o chão). **Ficou para uma próxima varredura**: chips de seleção de canal *dentro* do composer e algumas sub-barras internas do editor.

**Quinta passada — contraste e cor (avaliada no Chrome).** O owner apontou pontos "feios" e pediu avaliação no navegador (localhost:3000) — com autorização para mexer na cor. Diagnóstico batido olho a olho: o **accent-tint (`#ede9fe`) é pálido demais** e ainda **colidia com conteúdo da mesma cor**; e minha `.bevel-accent` da passada anterior tinha **trocado a borda de acento por bordas pálidas**, matando o contorno que marca "selecionado". Correções: (1) **badge `solid`** novo (roxo cheio + texto branco) para "RECOMENDADO"/"plano atual" — antes era accent-tint sobre um card accent-tint (contraste zero); agora pop em qualquer fundo. (2) **`.bevel-accent` redefinido** com **borda de acento de verdade** (contorno roxo, topo clareado, base em `--accent-hover`) sobre tint legível — restaura o contorno de seleção que faltava (chip de canal, nav ativa, notificação não lida, card de plano). (3) Botão **"adicionar à thread"** do composer → `bevel-accent` + `border-accent` (some o pálido). (4) **Header de configurações da rede** deixou de ser um bloco lavanda pálido (que ainda ganhava borda dupla contra o `border-t` do conteúdo) e virou **superfície branca** com o acento só no ícone e no texto — coerente com os demais headers. **Verificado no Chrome**: planos (badges sólidos nítidos + card do Pro com contorno roxo), calendário (chip selecionado com contorno definido), composer (header de settings limpo, aberto e fechado). Sem tocar em `box-shadow`; `bun run check` verde (341 testes).

**Sobre o "?" das conexões (bug de MODO, não de profundidade):** o popover mostra instrução de `.env` (self-host) ou "credenciais prontas" (nuvem) conforme `useIsSelfHosted()`, que só reflete o `selfHosted` devolvido por `/v1/capabilities`. Se em produção/dev aparece o texto de self-host, é porque a API está devolvendo `selfHosted: true` naquele ambiente (config de env do backend — `IS_SELF_HOSTED`), não um bug de front. **Deixado para decisão do owner** (não mexi em lógica de produto no chute): confirmar o `IS_SELF_HOSTED` do ambiente gerenciado, ou repensar se a linha de setup deve mesmo aparecer para o usuário final.

**Onde no código**: `apps/web/src/app/globals.css` (4 tokens de intensidade + classes `.bevel-primary|enterprise|outline|destructive|surface|ink|accent` na camada `components` + regra da aba ativa; para um `bg-*`/`border-*` de caller ainda vencer); `components/ui/` → `button.tsx` (variantes preenchidas → `.bevel-*` + `hover:brightness-*` + `cursor-pointer`; ghost/link flat), `card.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `select.tsx`, `tooltip.tsx`, `tabs.tsx`, `calendar.tsx`; `components/shell/app-sidebar.tsx`; `features/channels/connections-view.tsx` e `provider-note.tsx`; `features/billing/plan-picker.tsx`; `features/calendar/channels-panel.tsx` e `calendar-grids.tsx`. **Campos (input/select/textarea) e badges permanecem flat.** **Docs sincronizadas** (fonte de verdade não pode contradizer o código): BRAND_SYSTEM §2.1/§2.2 (regra reescrita: `box-shadow` proibido **e** profundidade pervasiva em 3 níveis), novo §3.1 (tokens de profundidade), §6 (anatomia dos botões + hover por `brightness`), §7 (cards); `docs/brand/README.md` §2 e §4; e o resumo de regras visuais no `CLAUDE.md`.

**Provas**: `bun run check` **verde** — **341 testes** (0 novos: a fatia é de tokens/CSS + classes, sem lógica), typecheck (api + web), fronteiras (dependency-cruiser), grep de IA e **`check:brand` OK** (o lint continua barrando `box-shadow`/`shadow-*`/`translate` em hover — o relevo passa porque é gradiente + borda; hex só em `globals.css`). **Verificação visual** feita pelo owner na stack de dev própria (`:3000` recarrega sozinho) — **não subi segunda stack** (hazard de worker duplicado). Referência renderizada (flat × 3D, com controle de intensidade e o modelo de 3 níveis) publicada como artifact para o owner. **Ficou de fora** (deliberado): dark mode (app é light-only), relevo em inputs/selects (campo é recuo, não relevo — descartado pelo owner) e sweep de todo `rounded-lg border bg-surface` estrutural (containers = chão, ficam flat).

---

## Onda 13 — nota humanizada de conexão por rede (ícone "?" + popover), específica por modo

**2026-07-23.** Cada rede tem sua própria forma de ser configurada, e a tela de Conexões não explicava nenhuma — o cartão só dizia "Conectar". Agora cada cartão (em **Redes disponíveis** e em **Precisa de credencial**) ganhou um **ícone de interrogação no canto superior direito** que, no hover ou no foco, abre um popover explicando **o que a rede publica** e **como conectá-la**. A mesma nota aparece inline dentro do **diálogo de conexão** (o momento real da ação). Reusa o `HoverPopover` que já existia; o ícone é um botão **irmão** do cartão (não aninhado — evita `<button>` dentro de `<button>` e mantém o clique do ícone separado da conexão).

**A segunda linha muda com o modo da instalação.** Como "cada um tem sua própria forma de ser configurado", a nota é honesta sobre o cenário: em **self-host** ela diz o que pôr no `.env` (ex.: Telegram → "crie o bot no @BotFather e ponha `TELEGRAM_BOT_TOKEN` no `.env`"); no **manypost na nuvem** ela diz que as credenciais já estão prontas e o que a pessoa ainda precisa fazer (ex.: "adicione o bot como admin do seu canal e informe o @ dele"). Para não chutar o modo errado, isso exigiu um sinal novo do servidor: **`GET /v1/capabilities` agora devolve `selfHosted: boolean`** — não dava para deduzir de `billingEnabled` (o gerenciado sem Stripe também vem `false`). Enquanto `/capabilities` não responde, o popover mostra só o "o que publica" e omite a instrução de setup — mandar quem está na nuvem editar um `.env` (ou o contrário) é pior que não dizer nada.

**Copy por rede + fallback** (`connections.notes.*` no pt-BR): textos próprios para mastodon, bluesky, telegram, discord, discord-webhook, linkedin, x, tiktok, threads, twitch e kick; rede sem texto próprio cai num genérico por `connectType` (`oauth`/`fields`), então um provider novo nunca fica mudo — só ganha uma explicação mais rasa até alguém escrever a dele. Nenhuma chave/segredo real nos textos (só nomes de variável). **Provas**: `bun run check` verde — **341 testes** (sem teste novo: a fatia é de UI + um campo de leitura no `/capabilities`), typecheck (api + **web**, o campo entrou no snapshot OpenAPI `apps/web/openapi.json` + `schema.d.ts` regenerados), fronteiras, grep de IA e brand OK (ícone `text-mist`→`text-accent` só por cor, zero sombra/transform, popover em `border-line`/`bg-surface`). Verificado na stack de dev do owner (web `:3000` recarrega sozinho). **Ficou de fora**: internacionalização além do pt-BR (o app é pt-BR only hoje) e nota específica para as redes ainda "em breve" (sem provider, não têm o que conectar).

---

## Onda 12 — Twitch e Kick (chat ao vivo) + o catálogo parou de esconder rede

**2026-07-22.** Duas entregas no mesmo dia da onda 11, encadeadas por um achado.

**(A) O catálogo não esconde mais rede sem credencial.** Quando o Threads ficou pronto e **não apareceu** na tela de Conexões (o `.env` de dev não tem `THREADS_APP_ID`), ficou claro o buraco: provider sem credencial sumia do catálogo, e o self-hoster não tinha como saber que a rede existia nem o que configurar. Agora `GET /v1/channels/providers` (interno) devolve **todas** as redes implementadas com **`available: boolean`**; a indisponível traz **`setupEnv`** com os nomes das variáveis que faltam — **só em `IS_SELF_HOSTED=true`**, porque no gerenciado o usuário final não opera o env (lá o campo é omitido e a UI trata a rede como "em breve"). O mapa secret→variável virou fonte única em `@manypost/config` (`PROVIDER_ENV` + `providerEnvVarNames`), derivada do MESMO objeto que alimenta `providerSecretsFromEnv`, com `satisfies` barrando nome de variável inexistente. **A superfície de máquina (`/public/v1`) continua filtrando**: para um agente, listar rede que ele não pode conectar é ruído. Na UI, Conexões ganhou o bloco **"Precisa de credencial"** (nome da rede + a variável que falta + ponteiro para o guia), e o **"Em breve"** — criado na mesma leva, listando as redes do roteiro sem provider (`features/channels/upcoming.ts`, filtrado contra o catálogo) — passou a acolher também as implementadas que a instalação não habilitou. Cartões sem foco e sem clique: nada promete ação que não existe.

**(B) Twitch e Kick, com paridade Postiz.** O owner verificou que o Postiz tem os dois e decidiu que entram **mesmo publicando em chat ao vivo em vez de feed** — com as mesmas features e particularidades que eles já mapearam. **Twitch**: OAuth2 clássico em `id.twitch.tv`, dois modos de publicação (mensagem em `/helix/chat/messages` ou **anúncio do canal** em `/helix/chat/announcements`, com cor), réplica por `reply_parent_message_id`, corte em 500 chars. **Kick**: **OAuth 2.1 com PKCE S256** em `id.kick.com`, mensagem em `/public/v1/chat` (`type: 'user'`, `broadcaster_user_id` numérico), réplica por `reply_to_message_id`. Três divergências deliberadas do Postiz, todas a favor da corretude: (1) **`is_sent:false` vira falha de verdade** — as duas redes respondem **200 mesmo descartando** a mensagem (seguidores-only, duplicada, chat travado) e o Postiz marca `status:'error'` e segue, o que deixaria o post "publicado" sem nunca ter entrado no chat; aqui levanta `422` com o `drop_reason`; (2) **zero mídia declarada** (`maxCount: 0` nos dois tipos) faz o composer barrar anexo no agendamento em vez de descartar no publish; (3) `broadcasterId`/`broadcasterUserId` em `channelSettings` (padrão do Threads) com falha legível se faltar, em vez de chamar a API sem alvo. Detalhes que mordem: a Helix exige **`Client-Id`** em toda chamada (bearer sozinho = 401) e devolve `scope` como **array**; o `/users` da Kick já apareceu como lista e como objeto — o provider aceita os dois. No composer, as duas ganharam **preview de chat** (sala com uma linha por item + aviso de que a mensagem cai ao vivo). **Provas**: `bun run check` verde — **341 testes** (+39: contrato + golden de OAuth/refresh/mensagem/anúncio/réplica/corte em 500/recusa da rede/canal sem broadcaster); E2E completo (`auth`, `publish`, `public`, `mcp`) **TUDO OK** em stack isolada (Postgres 5599 + Redis 6499), com blocos novos no `e2e-auth` para as duas redes (catálogo com zero mídia, connect → URL de consentimento real, PKCE S256 na Kick) e uma rodada extra **sem nenhuma credencial de provider** provando o `setupEnv` (telegram → `TELEGRAM_BOT_TOKEN`, discord → os três `DISCORD_*`, e assim por diante). **Fica valendo a ressalva de produto**: chat é efêmero, então mensagem agendada para canal offline vai para sala vazia — se um dia isso virar feature de verdade, o desenho é "avisar no chat quando eu entrar ao vivo", gatilho de evento e não horário no calendário.

---

## Onda 11 — Threads (primeiro provider da família Meta)

**2026-07-22.** Novo `packages/providers/src/threads` — a família Meta começou pelo provider mais isolado (OAuth próprio em `threads.net`, API própria em `graph.threads.net`, sem Página do Facebook no meio) e é o primeiro do projeto com **réplicas nativas da rede** (`capabilities.threads: true` sem gambiarra de comentário, como no LinkedIn). (A) **OAuth em dois saltos**: `code` → token curto (1h) em `POST /oauth/access_token` → **token longo (~60 dias)** em `GET /access_token?grant_type=th_exchange_token` — é o longo que fica cifrado no canal. Quando a Meta devolve `permissions`, a conexão **recusa com 403 legível** se `threads_content_publish` não foi concedida (mesmo padrão do TikTok). `channelSettings = {userId, username}`: o `userId` endereça `/{userId}/threads` no publish e o `username` monta a URL de fallback. (B) **Publicação em container** (o padrão que IG e Facebook vão reusar): cria o container (`TEXT` / `IMAGE` / `VIDEO` / `CAROUSEL`) → **poll de `status` até `FINISHED`** → `POST /{userId}/threads_publish?creation_id=` → `GET /{id}?fields=permalink`. Carrossel de 2 a 20 itens **misturando imagem e vídeo** (filhos `is_carousel_item` sem texto; só o pai carrega texto/`reply_control`). Mídia é **pull da Meta por URL pública** — nada de upload de bytes, o que torna o driver S3/R2 dependência real em produção. (C) **Detalhe de corretude**: depois do `threads_publish` o post JÁ está na rede, então **nada mais pode lançar** — a busca do permalink é best-effort e cai no perfil `@handle` se falhar (senão a máquina de estados retentaria e repostaria). O orçamento de polls é **compartilhado** por publicação (pai + filhos do carrossel) para o total ficar abaixo do watchdog de zumbis de 15 min; estourar o orçamento é `504` = transient (nada foi publicado, retry é seguro). (D) **Token**: no Threads não existe refresh token separado — o próprio token longo é apresentado ao `/refresh_access_token` (`th_refresh_token`), então guardamos o mesmo valor nos dois campos e o worker persiste a rotação (como Bluesky/X/TikTok). Renovação é **reativa** (401 → `classifyError` → refresh): token que expira sem uso vira `REFRESH_REQUIRED` — o `refreshCron` proativo do Postiz continua como decisão em aberto. (E) **Settings** por canal gerados do Zod: `replyControl` (quem pode responder) e `linkAttachment` (prévia de link, só em post sem mídia). `rateDefaults`: `maxConcurrent: 2` (paridade com o `maxConcurrentJob` do Postiz) + janela de 250 posts/24h por canal (teto documentado da API). (F) **Encaixe**: registrado no registry, `providerSecretsFromEnv` ganhou `threads` (`THREADS_APP_ID`/`THREADS_APP_SECRET`), preview no composer (microblog com thread encadeada e ações curtir/responder/repostar/enviar — o ícone já existia), `.env.example` com redirect e escopos. **Bônus**: o catálogo `GET /v1/channels/providers` documentava `editor` como **booleano** no OpenAPI enquanto devolvia `'plain'` — corrigido para o enum real e o snapshot do web regenerado (`apps/web/openapi.json` + `schema.d.ts`); a nota da onda 4 sobre regenerar o snapshot está resolvida. **Provas**: `bun run check` verde — **300 testes** (+22 do threads: contrato + golden de OAuth/refresh/texto/mídia única com `alt_text`/carrossel misto/`publishReply` com `reply_to_id`/permalink indisponível/container `ERROR`/classificação de erro). E2E completo (`auth`, `publish`, `public`, `mcp`) **TUDO OK** contra uma stack **isolada** (Postgres 5599 + Redis 6499 efêmeros, API 3987) — `e2e-auth` ganhou o bloco do Threads (catálogo com thread nativa + 500 chars + `replyControl`; connect → URL de consentimento real da Meta com `threads_content_publish`). ⚠️ **Aprendizado de ambiente**: o `mp-pg:5499` da doc de E2E **é o banco de dev do owner** (o `.env` aponta para ele) — subir uma segunda API `MODE=all` ali reproduz o hazard de chave dupla (jobs pegos pelo worker "errado" → `Unsupported state or unable to authenticate data` → FAILED permanente, só em canais `fake` de teste). E2E de publicação daqui em diante em containers próprios. **Ficou de fora**: analytics (`threads_insights`), refresh proativo, citar post (`quote_post_id`), `topic_tag`, e a submissão do App Review (gate jurídico — [platform-gates](platform-gates.md)); o código roda inteiro em **Development Mode**.

---

## Onda 10 — hosts dedicados para as superfícies de máquina (`api.` e `mcp.`)

**2026-07-21.** O follow-up do subdomínio da onda 8 saiu, e com ele a ponte temporária pelo proxy do Next. (A) **Roteamento por Host** (`apps/api/src/http/surfaces.ts`): o MESMO processo atende três hosts — app (`PUBLIC_URL`: `/v1` interno, `/public/approval`, `/uploads`, e `/public/v1` + `/mcp` como compat), **`api.dominio`** (`API_PUBLIC_URL`) servindo a **API REST de máquina em `/v1`** + `/openapi.json` e `/docs` restritos a ela, e **`mcp.dominio`** (`MCP_PUBLIC_URL`) servindo o **MCP na raiz** (`/mcp` como alias). Zero duplicação de rota: o sub-app de `/public/v1` registra caminhos OpenAPI **relativos** e o `.route()` do `@hono/zod-openapi` re-prefixa ao montar — a mesma instância vira `/v1` no host de máquina; o sub-app do MCP é instância única (o registro de sessões vive no closure dele) e teve os middlewares presos a `/` e `/mcp` para poder ser montado na raiz. Vazio = self-host de um domínio só, comportamento idêntico ao de antes. (B) **Fronteira humano × máquina** (fecha bypass real): o `/v1` do host do app agora **recusa API key com 403** apontando a superfície de máquina (`humansOnly`) — antes uma `mp_live_` entrava lá sem escopo, sem gate de plano `public_api` e sem rate-limit por credencial, contornando os três. (C) **CORS** nas superfícies de máquina (não existia): qualquer origem, **sem** `credentials` (bearer, nunca cookie), expondo `mcp-session-id` e os `RateLimit-*` — é o que permite cliente MCP em navegador e SDK client-side. (D) **Ponte removida**: o rewrite `/mcp` do Next saiu (`next.config.ts`); `/public/*` continua proxiado (a página `/approve/{token}` depende dele). (E) **Env**: `API_PUBLIC_URL`/`MCP_PUBLIC_URL` opcionais, com refine que **recusa host igual ao do `PUBLIC_URL`** (esconderia a interface); helpers `machineHosts`/`machineEndpoints` em `@manypost/config` como fonte única. (F) **`GET /v1/capabilities` devolve `endpoints`** (`restBaseUrl`/`mcpUrl`) e **Configurações** ganhou o bloco "Conectar seu agente": endereços com copiar + **prompt pronto** p/ colar no agente + JSON de `mcpServers` p/ configuração manual (i18n `settings.agent*`/`endpoint*`; snapshot OpenAPI do web regenerado). **Provas**: `bun run check` verde (**278 testes**, +8: `packages/config/src/env.test.ts` cobre endpoints/hosts/refine e `apps/api/src/http/middleware/auth.test.ts` cobre a recusa da API key); API efêmera 3992 em banco isolado `mp_hosts_e2e` com os três hosts no mesmo processo (`localhost`=app, `127.0.0.1`=api, `127.0.0.2`=mcp) — `e2e-public.ts` **TUDO OK** (36 checks: escopos, idempotência, 429, **403 da API key no `/v1` interno com a URL de máquina no `extra`**, JWT segue passando, preflight CORS `*` sem credentials, doc do host de máquina com `/v1/posts` e **sem** a superfície interna, `/v1/auth/me` 404 no host de máquina, `/public/v1` antigo ainda 200) e `e2e-mcp.ts` **TUDO OK** (raiz do host mcp., alias `/mcp`, página HTML p/ navegador, REST 404 lá). CI passou a subir a API com os dois hosts e a rodar os scripts contra eles. **Pendências desta fatia**: apontar os DNS `api.`/`mcp.` no Railway e setar as duas envs (o MCP do Railway está sem autenticação — precisa de `railway login`); **`MODE=standalone` não publica os subdomínios** (a porta pública é a do Next) — separar `web` e `api` em dois serviços; **em dev** (web 3000 → API 3100) o MCP passou a ser `http://localhost:3100/mcp` (o rewrite morreu) — ou setar `API_PUBLIC_URL=http://127.0.0.1:3100`/`MCP_PUBLIC_URL=http://127.0.0.2:3100` mantendo o proxy em `localhost:3100` (o Host precisa DIFERIR do destino do proxy, senão o `/v1` do web cai na superfície de máquina); **`/uploads` ainda sai por `PUBLIC_URL`** (logo, pelo proxy do Next) — mover a mídia p/ um host próprio exige `MEDIA_PUBLIC_URL` + cuidado com posts já agendados que carregam a URL antiga e com o domínio verificado do TikTok (follow-up).

---

## Onda 9 — billing Stripe + PlanPolicy + onboarding de conversão

**2026-07-21.** A fronteira Community × Cloud saiu do papel. (A) **Catálogo de planos** com fonte única em `packages/contracts/src/billing.ts` (`PLANS`: limites, features por plano, preços em centavos BRL e `lookup_key` da Stripe — espelha a landing oficial). (B) **`PlanPolicy`** (port + duas impls): `makeSelfHostedPlanPolicy` libera tudo; `makeSaasPlanPolicy` impõe o catálogo. Gates ligados em conectar canal (teto 3 + X só Pro+), agendar post (15/mês no Grátis), link de aprovação, API key, webhook e nas superfícies de máquina (`/public/v1`, `/mcp`, revalidado por requisição — chave criada no Pro não sobrevive ao downgrade). Negação = **402** problem+json com `extra.requiredTier`. (C) **Stripe** isolado em `apps/api/src/infra/billing/stripe.gateway.ts` (único arquivo com o SDK): Checkout hospedado, troca de plano com proration, portal, cancelar/reativar, faturas, webhook assinado (`/v1/stripe/webhook`) e reconciliação sob demanda (`/v1/billing/sync`) p/ a volta do checkout. Preços por `lookup_key` + Product de id determinístico (`manypost_pro`) — **zero price ID em env**; `bun run stripe:sync` cria/atualiza o catálogo na conta (mudança de preço = Price novo + `transfer_lookup_key`, grandfathering de quem já assina). Sem trial (`BILLING_TRIAL_DAYS=0`). (D) **Banco**: tabela `subscriptions` (1 por org) + `organizations.billing_customer_id`, migration `0003_billing`. Downgrade **desativa** os canais mais recentes acima do teto (não desconecta); upgrade reativa. (E) **Frontend**: `/planos` (cartões com a cópia da landing, mensal/anual −21%, uso do período, faturas, cancelar/retomar), **`/boas-vindas`** — onboarding pós-cadastro em tela cheia (paridade com o do Postiz, mas COM saída "Continuar no Grátis", que o Postiz não tem), `PlanLockNotice` em Configurações e chip "Pro" no X em Conexões. Tudo some quando `billingEnabled=false`. (F) **Fronteira**: `isBillingEnabled(env)` = `!IS_SELF_HOSTED && !HIDE_BILLING && STRIPE_SECRET_KEY` — falso ⇒ rotas de billing **nem são montadas** (404) e nada é barrado. **Provas**: `bun run check` verde (**270 testes**, +19); `scripts/e2e-billing.ts` **TUDO OK** (26 checks) contra API efêmera 3987 em banco isolado `mp_billing_e2e` — 3 canais ok/4º 402, X 402, 15 posts ok/16º 402, API key e webhook 402, uso reportado — mais a fase 2 em modo Community (3986): `billingEnabled:false`, `/v1/billing` 404, API key liberada. Ambos no CI. **Pendências**: rodar `bun run stripe:sync` com a chave real e criar o webhook (`whsec_`); sub-limite de X da política de uso justo (PL1).

---

## Onda 8 — API pública `/public/v1` + servidor MCP

**2026-07-19.** (backend §4 item 7) (A) superfície **REST pública para máquinas** reusando os MESMOS use-cases: **escopos por API key** (`requireScope`; humano/JWT passa — papel governa à parte, §6; `apiKeyId` propagado no `Principal`), **rate-limit por credencial** (token bucket Redis via `runtime.rateLimiter.acquire`, headers `RateLimit-*`/`RateLimit-Policy`, 429 `Retry-After`) e **`Idempotency-Key`** nos POST de mutação (novo port `IdempotencyStore` no core + adapter `makeRedisIdempotencyStore` no queue — claim/store atômico em Lua, TTL 24h, **falha aberta sem Redis**; replay do MESMO grupo com header `Idempotency-Replayed`, corpo diferente = 409 `common.idempotency_conflict`, em voo = 409). **13 rotas** no `/openapi.json` sob tags `public-*` (posts POST/GET/PATCH/DELETE+retry+approval-link — **DELETE=cancel**, origin=**API** —, publications feed keyset, channels list/providers/disconnect, media upload/from-url/list, webhooks CRUD). Catálogo de providers extraído p/ helper compartilhado `routes/shared/provider-catalog.ts` (rota interna `/v1` e pública sem divergir). **Analytics fica de fora** (feature inexistente). (B) **servidor MCP** em `/mcp` (SDK oficial `@modelcontextprotocol/sdk` 1.29): transporte **`WebStandardStreamableHTTPServerTransport`** (Streamable HTTP fetch-nativo — `handleRequest(c.req.raw)`, casa com Hono/Bun **sem** bridge de `node:http`); modo **stateful** com registro de sessão em memória por `mcp-session-id`+TTL 1h (o transporte exige `initialize` antes de qualquer chamada — server fresco por request não serve); auth por **API key escopo `mcp`** em toda requisição (sessão amarrada ao `orgId`; OAuth 2.1 é follow-up); **tools = use-cases**: `list_channels`/`list_posts`/`get_post`/`schedule_post`/`update_post`/`cancel_post`/`upload_media_from_url`, com política **30 agendamentos/h por credencial** (anti-loop de agente) e `audit_log` **`actor_type=MCP`** nas mutações; `get_channel_analytics`/`generate_content`/`find_free_slot` fora do corte (dependem de features inexistentes). **Provas**: `bun run check` verde (**251 testes**, sem regressão); `scripts/e2e-public.ts` (403 sem escopo/200 com/401 revogada, posts CRUD origin=API, idempotência replay+409, rate-limit 429+`RateLimit-Limit`) e `scripts/e2e-mcp.ts` (cliente Streamable HTTP real: initialize→sessão→tools/list→list_channels/schedule_post origin=MCP/get_post, input inválido→isError, chave sem escopo mcp→403) **TUDO OK** contra API efêmera 3991/banco `mp_public_e2e` isolado; `audit_log actor_type=MCP` conferido no psql; ambos adicionados ao CI (`ci.yml`). **Follow-up**: analytics (rota + tool), **OAuth 2.1 do MCP** (discovery `/.well-known/*` + PKCE + tela de consentimento), store de sessão MCP externo p/ escala horizontal, `webhooks/{id}/test`, **subdomínio `api.` dedicado p/ as superfícies de máquina (`/public/v1` + `/mcp`)** em vez do proxy pela origem única do Next (bearer/sem cookie não precisa ser same-origin; o rewrite do Next não é API gateway — buffering/timeout, ruim p/ streaming do MCP e pull de mídia grande; `PUBLIC_URL` **fica no web** pois OAuth/aprovação/mídia/cookies dependem dele — subdomínio = 2º custom domain no MESMO serviço de API, sem CORS server-to-server; o rewrite `/mcp` que adicionei em `apps/web` (`next.config.ts`+`proxy.ts`) é **ponte temporária — reverter quando o subdomínio existir**). → SPEC_API_MCP §3/§5).

---

## Onda 7 — Semáforo maxConcurrent + `/metrics` Prometheus

(backend §4 item 6) semáforo de concorrência por provider via sorted set Redis com stale-reclaim (`acquireSlot`/`releaseSlot` no port `RateLimiter`; adquire antes das janelas no `makeRunner`, libera em todos os returns + finally; continuações de thread não seguram slot; negado → `:sem:` sem consumir tentativa) + registro Prometheus hand-rolled (port `MetricsSink` no core; `createPrometheusMetrics` em apps/api/infra) exposto em `/metrics` com `METRICS_TOKEN` — `publishing_publications_total`/`retry`/`recovered`/`rate_limit_denied` + `queue_depth` (pull do pgboss.job) + histograma `http_request_duration_seconds`. `bun run check` verde (**251 testes**, +9); smoke real confirmou os contadores movendo (published=12/failed=3/retry=7/window-denied=1) + `/metrics` 401 sem token/200 com. Detalhe completo no §4 item 6. **Owner também pediu 2 features de escopo futuro** (registradas em §4 "Escopo futuro"): serviço de e-mail avançado com Resend (falhas/sucessos/marketing) e streak+conquistas com foguinho 🔥 (alerta por e-mail p/ não perder).

---

## Onda 6 — TikTok (primeiro provider da onda 2), funcional em sandbox — AUDITORIA ENVIADA

novo `packages/providers/src/tiktok` — **OAuth2 + PKCE S256** (env `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`; TikTok usa `client_key`, não `client_id`; escopos `user.info.basic,user.info.profile,video.publish,video.upload` separados por vírgula), **Content Posting API**: vídeo por **Direct Post** (`/v2/post/publish/video/init/`) **ou** envio à caixa de entrada do app (`/inbox/video/init/`), upload dos bytes em **FILE_UPLOAD** chunked (single-chunk até 64MB, senão 10MB com o resto no último) via `upload_url` do init com `Content-Range`; **foto** por `PULL_FROM_URL` (`/content/init/`, `photo_images`); **poll** de `status/fetch` até `PUBLISH_COMPLETE`/`SEND_TO_USER_INBOX`/`FAILED`; `settingsSchema` de compliance (privacidade, disable comment/duet/stitch, brand content/organic, AIGC, auto-add-music, título de foto); `refreshToken` **rotaciona** o par (worker persiste). `requiresMedia:true` (TikTok não aceita só-texto) — **novo campo opcional em `ChannelCapabilities`** + ramo no test-kit de contrato (post vazio → rejeita). Registrado no registry; `providerSecretsFromEnv` ganhou `tiktok`; `env.ts`/`.env.example` com as duas chaves. **Provas**: `bun run check` 100% verde (**242 testes**, +19 do tiktok: contrato + golden de OAuth/Direct Post/inbox/foto/erros); smoke de runtime com as **credenciais reais de sandbox** (`sb…`) confirmou o wiring e a URL de consentimento real do TikTok (host+PKCE+escopos+redirect); `e2e-auth.ts` ganhou o bloco do tiktok (catálogo + connect → URL de autorização). **Follow-up entregue (2026-07-18)**: (1) **preview do TikTok no composer** — `network-preview.tsx` ganhou o `TiktokPreview` (tela **9:16 full-bleed estilo celular**: mídia `object-cover`, gradiente de legibilidade, **rail vertical de ações sobreposto** — avatar com `+`, curtir/comentar/salvar/compartilhar com contadores de amostra, disco de música — e overlay inferior com `@handle`, legenda/placeholder e pílula "som original"; só tokens ink/paper/accent, `check:brand` verde; empty state quando ainda não há mídia); a página pública `/approve/{token}` reusa o mesmo componente. (2) **exigir mídia na UI** — o catálogo `GET /v1/channels/providers` passou a expor **`requiresMedia`** (snapshot `apps/web/openapi.json` + `schema.d.ts` **patcheados à mão** — regenerar quando a API subir) e o composer bloqueia o submit com `issues.requiresMedia` quando um canal que exige mídia está sem vídeo/foto (o backend já barrava no agendamento com `post.invalid_media`). i18n `composer.preview.tiktok` + `issues.requiresMedia`. Tudo commitado pelo owner (`fdad7aa` provider+preview, `8f80800` normaliza as descrições dos settings). ⭐ **Auditoria da Content Posting API: FORMULÁRIO ENVIADO ao TikTok em 2026-07-18** (owner testou o fluxo e submeteu) — gate agora **em revisão** (ver platform-gates); enquanto não sai, os posts saem SELF_ONLY. **Ficou de fora** (não bloqueia a auditoria): analytics do TikTok (pede escopos `user.info.stats`/`video.list`) e o smoke real de publicação de ponta a ponta (pede canal conectado + túnel https).

---

## Onda 5 — composer e detalhe viraram POPUP grande + Discord canal obrigatório + settings por canal na edição

**2026-07-17.** (1) o `ComposerView` agora vive num `Dialog` (`composer-modal.tsx` + store `use-composer-modal.ts`, montado no `(app)/layout.tsx`) — **1640px no desktop, fullscreen no mobile**; "Novo post"/"+"/duplicar/nav mobile abrem o modal sobre a página (não navegam), `/compor` virou atalho que abre o modal e volta ao calendário; rodapé do composer refeito mobile-first. (2) O `post-detail-sheet.tsx` deixou de ser `Sheet` lateral e virou `Dialog` no mesmo padrão (1640px/fullscreen, **2 colunas: edição + preview ao vivo por rede** reusando `PostPreview`), com **edição de settings por canal** (reusa `ChannelSettingsCard`). (3) Discord: `channelId` do settingsSchema voltou a **obrigatório** (sem auto-descoberta/default); o indicador de validação do composer acusa settings obrigatórias faltando e bloqueia o submit. (4) Botão descartar rascunho = `outline` com **hover danger** + confirmação. **Backend**: `PATCH /v1/posts/:groupId` aceita `settingsByChannel` (validado por provider, merge jsonb no `rescheduleGroup`/`updateDraftGroup`, 3 testes novos). `bun run check` verde (223 testes). **Pendências**: regenerar `apps/web/openapi.json` (o `settingsByChannel` do PATCH foi patcheado à mão no snapshot; a rota `/channels/:id/sub-accounts` ainda usa fetch cru).

---

## Onda 4 — Discord "Tudo Pronto" (OAuth2+Bot) + Telegram `/connect` + split de providers

**2026-07-17.** O Discord ganhou um 2º modo, `id: discord`, por **OAuth2 + Bot oficial** (env `DISCORD_CLIENT_ID/SECRET/BOT_TOKEN`, scopes `bot identify guilds`, publish via Bot Token em `/channels/{id}/messages`, `listSubAccounts` lista os canais de texto do servidor) — paridade SaaS; o modo webhook antigo virou `id: discord-webhook` (sempre disponível, sem env, `connectWithFields` por URL). Telegram ganhou **auto-descoberta por `/connect ABCD`** (usuário adiciona o bot como admin e envia o código no canal; connect acha via `getUpdates` e apaga a mensagem). Nova rota `GET /v1/channels/:id/sub-accounts` + use-case `makeListSubAccounts` + tipos `SubAccount`/`ConnectedToken` no contrato; callback OAuth agora fecha o popup via `postMessage` (HTML 200). **Robustez aplicada nesta sessão (as decisões do owner foram mantidas, só endurecidas)**: o publish do Discord lia `token.externalId`/`token.channelSettings` — que no worker NÃO existem (o token é só `{accessToken,scopes}`), erro de runtime **e** de tipo; reescrito p/ ler guildId/channelId do `settings` mergeado (padrão do X, decisão 4); `channelId` do settingsSchema virou **opcional** (obrigatório quebraria a validação de settings no agendamento); helper `fetchPostableChannels` compartilhado; `username`/`avatarUrl` condicionais (exactOptionalPropertyTypes); testes e `e2e-auth.ts` ajustados; script de debug `check-discord-channel.ts` removido. `bun run check` 100% verde (220 testes).

---

## Onda 3.4 — preview por rede + seletor de data do brand

**2026-07-17.** Composer E página pública `/approve/{token}` renderizam cada canal com o layout aproximado da rede de destino via `network-preview.tsx` compartilhado (SPEC §3.3/§3.6); e, a pedido do owner, o `<input type="datetime-local">` padrão morreu — `ui/date-time-picker.tsx` + `ui/calendar.tsx` próprios (API do kit shadrix, zero deps novas) no composer e no sheet de detalhe; detalhes na seção Frontend).

---

## Onda 3.3 — formulário de conexão auto-gerado

**2026-07-17.** Catálogo `GET /v1/channels/providers` expõe `connectionFieldsSchema` (JSON Schema, mesmo helper do settingsSchema) e o ConnectDialog do web renderiza os campos a partir dele — mapa hardcoded `PROVIDER_FIELDS` morreu).

---

## Onda 3.2 — settings por canal no composer

**2026-07-17.** Catálogo expõe `settingsSchema` como JSON Schema e o composer ganha o acordeão "Configurações de {canal}" por aba, paridade Postiz ref 8 — detalhes na seção Frontend; commits externos do owner avaliados: Railway/standalone, barra de formatação, surface, calendário mobile-first — as 5 sombras que `3da955f` introduziu foram removidas com autorização do owner, `check` 100% verde).

---

## Onda 3.1 — calendário: "+" de agendamento por slot

**2026-07-17.** Hover/foco em célula vazia revela um "+" que abre o composer pré-preenchido com dia/hora; verificado em navegador nesta sessão + pelo owner.

---

## Onda 3 — paridade Postiz + toda a superfície da API na UI

**2026-07-16.** Redesign completo seguindo `docs/references for postiz/` (exigência do owner: "próximo do Postiz é inegociável, mais minimalista"), + mídia, threads, calendário dia/semana/mês/lista com drag, kanban, sheet de detalhe, SSE, notificações, configurações (API keys/webhooks) e página pública de aprovação. Tudo verificado em navegador real (stack dev 3000/3100): publicar agora com thread → chip virou verde via SSE sem reload; rascunho com aprovação → link gerado → `/approve/{token}` aprovado como "Cliente Teste" → notificação no sino) · branch `feat/web-foundation`.

---

## Frontend — detalhe das ondas 1 a 5 (`apps/web`)

> Movido do STATUS em 2026-07-22. Cada bullet é uma fatia entregue, com as provas de navegador real.

- ✅ **Fundação `apps/web`**: Next.js 16 (App Router, Turbopack) + Tailwind v4 + primitivas Radix no padrão shadcn (13 componentes em `src/components/ui/*` com a API do kit do shadrix, adaptadas ao brand). **Sem `shadcn@latest init`** (instala Base UI e quebra o kit — guia de bootstrap do shadrix). Tema = tokens do BRAND_SYSTEM em `globals.css` (único lugar com hex) mapeados via `@theme inline`; namespaces `--shadow-*`/`--radius-*` zerados (zero sombras; radius 4/6/8); foco por `outline` (ring do shadcn é box-shadow); Inter + Plus Jakarta Sans via `next/font`; light-only; next-intl **sem** roteamento por locale (pt-BR em `src/messages/`, adicionar idioma = adicionar JSON).
- ✅ **Cliente OpenAPI**: `bun run --cwd apps/web generate:api` baixa `/openapi.json` da API rodando → snapshot versionado `apps/web/openapi.json` + `src/lib/api/schema.d.ts` (openapi-typescript). `openapi-fetch` em `src/lib/api/client.ts` com **refresh-em-401 deduplicado** (1 refresh por vez — rotação de RT revoga família em reuso). Nenhum fetch manual fora dele. TanStack Query, 1 recurso = 1 hook.
- ✅ **Modelo de origem única**: Next proxeia `/v1` e `/uploads` p/ `API_URL` **preservando caminhos** (cookies com `Path=/v1/auth` etc. continuam válidos). Em produção `PUBLIC_URL` da API = origem do web. **Backend ganhou cookie-marcador `mp_session`** (não-sensível, TTL do refresh) — o `src/proxy.ts` do Next (Next 16 renomeou middleware→proxy) só checa presença (SPEC_FRONTEND §1); `mp_at` expira em 15min e `mp_rt` não viaja em rotas de página.
- ✅ **Telas onda 1**: login/registro (erros problem+json traduzidos por código estável; botões sociais do catálogo `GET /v1/auth/social`; registro → onboarding `/conexoes`), shell autenticado (sidebar + topbar + user menu/logout; mobile = dropdown), **Conexões** completa (catálogo filtrado por disponibilidade, conexão OAuth em **popup** com detecção do callback same-origin via proxy — zero mudança no backend —, formulário de credenciais p/ bluesky/telegram/discord/mastodon-instância, badges de estado com tokens `--state-*`, reconectar em REFRESH_REQUIRED, desconectar com confirmação). Placeholders: calendário, kanban, mídia, notificações, configurações.
- ✅ **CI/conformidade**: `bun run check` agora inclui `typecheck:web` e `check:brand` (`scripts/check-brand.ts`: hex fora de globals/sombras/transform em hover/radius/wordmark). dependency-cruiser: regra nova `web-consome-api-via-openapi` (web não importa pacotes de servidor) + exclusão de `.next`. `check_fidelity` do shadrix: 90/100.
- **Provas (2026-07-16, navegador real)**: registro→`/conexoes`→conectar fake via popup (canal ATIVO + toast)→desconectar com confirmação→logout→login com senha errada (erro traduzido)→login ok→`/calendario`. `next build` verde (10 rotas), `bun run check` verde.
- **Armadilha aprendida**: comentário CSS/TS contendo `*/` no MEIO do texto (ex.: escrever "shadow-*/drop-shadow-*") encerra o comentário e quebra o parse — o erro do Tailwind aparece longe dali ("unknown utility class").
- ✅ **Onda 2 (2026-07-16 tarde): composer v1 + calendário em lista.** `/compor`: seleção de canais (só ACTIVE; badge de status nos demais), editor TipTap **plain** (parágrafo+quebra+undo/redo+placeholder — marcas ricas ficam p/ quando houver provider `editor:'rich'`, senão seriam perdidas no publish), contador por canal via `maxLength` do catálogo, abas por canal com "Personalizar o texto" (→ `textByChannel`; ponto roxo na aba indica override), agendar (datetime-local + fuso do usuário)/publicar agora/exigir aprovação (DRAFT), validações client-side listadas sob o botão, store Zustand com `persist` (rascunho sobrevive a F5/fechar; `editorNonce` remonta editores no descartar; gate `mounted` evita mismatch de hidratação). `/calendario`: modo lista do feed real (`from` = hoje 00:00 local, agrupado por dia, badges `--state-*`, releaseUrl, erro legível, "aguardando aprovação"), polling 30s. Primitivas novas via kit shadrix: tabs/checkbox/radio-group (`check_fidelity` 80 — rubrica passa; nota parcial é só falta de use-case Shadboard). "Novo post" na sidebar/topbar/vazio. i18n `composer`/`calendar`.
- **Provas onda 2 (navegador real, dev server)**: compor→selecionar fake→contador 39/500→publicar agora→toast+redirect→item **PUBLICADO** na lista com link externo; segundo post com override por canal → lista mostra o texto personalizado (textByChannel de ponta a ponta); validação "horário no futuro" disparou num rascunho persistido com hora vencida (persist funcionando). `bun run check` verde (191 testes), `next build` verde (11 rotas).
- ✅ **Onda 3 (2026-07-16 noite): paridade Postiz + superfície completa da API.** Redesign guiado pelas screenshots em `docs/references for postiz/` (ver memória `design-direction-postiz-parity`): **shell** = rail de ícones (logo + ícone/rótulo, notificações com dot) + título da página na topbar + sino com dropdown de notificações; **calendário é a casa** — painel "Canais" à esquerda (Criar post + Conectar canal + lista de canais; clique = filtro via `?canais=`), visões **Dia/Semana** (grade de 24h, passado hachurado `.cal-past`, hoje em círculo accent, auto-scroll p/ 7h), **Mês** (42 células, "+N mais" em popover) e **Lista** (tabs Todos/Agendados/Rascunhos/Publicados via `?estado=`→`state` da API), tudo em URL params; **drag** (@dnd-kit) reagenda por slot de hora (semana/dia) ou dia (mês), otimista com rollback — rascunho com link pendente não arrasta (editar revoga o link); **sheet de detalhe** compartilhado (calendário/kanban): editar texto/horário (PATCH; avisa que overrides resetam), cancelar (confirm), retry grupo/por canal, progresso de thread (cursor), erros legíveis, e o ciclo do **link de aprovação** (validade 1/3/7 dias, URL copiada — só aparece 1x —, revogar, feedback de "pediu ajustes"); **composer 2 colunas** = avatares p/ selecionar canais (apagado/colorido+check), abas global/por canal (chips com avatar), cartão do editor com toolbar embaixo (Mídia + **contador no canto** que abre popover com contagem por canal e TODA a validação client-side, incl. regras de mídia por provider), MediaPicker (biblioteca + upload inline via `bodySerializer` FormData), thread = cartões empilhados com conector vertical (delay 0–600s, mídia por item), **preview ao vivo** por canal com thread encadeada, rodapé sticky (exigir aprovação, descartar, datetime, Publicar agora/Agendar); **/midia** = dropzone drag-drop + importar por URL + grid com alt/excluir(soft); **kanban** = colunas por estado do GRUPO (`DRAFT/SCHEDULED/DONE/PARTIAL` — PARTIAL/SCHEDULED com falha visível caem em Falhou), drag Falhou→Agendado = retry, inválido = toast; **SSE** (`use-realtime.ts`: EventSource + GET /v1/auth/me antes de (re)abrir p/ renovar cookie, reconexão manual 15s, eventos → invalidateQueries + toasts); **/notificacoes** página + sino (marcar lida/todas); **/configuracoes** = perfil (role badge), API keys (criar com escopos, `mp_live_` mostrado 1x com copiar, revogar) e webhooks (eventos por checkbox, `whsec_` 1x, excluir); **página pública `/approve/[token]`** (SPEC §3.6) = preview por canal com mídia/thread, aprovar/pedir ajustes (nome opcional, feedback obrigatório), estados resolvido/expirado neutros, `noindex` — proxy ganhou rewrite `/public` e o middleware libera `/approve/*` sem sessão. Novas primitivas (kit shadrix): sheet/tooltip/popover/select/textarea/switch/alert-dialog; deps novas: 5 pacotes Radix + @dnd-kit/core.
- **Armadilhas aprendidas (onda 3)**: (1) estado de GRUPO ≠ estado de publicação — grupo usa `DONE/PARTIAL` (agregador `refreshGroupState`), publicação usa `PUBLISHED/FAILED/...`; a UI mapeia os dois (`features/publications/state.ts`); (2) `next dev` 16 recusa 2ª instância no mesmo diretório — verificar pela stack do owner (3000/3100) que serve o código novo via HMR; (3) a URL do link de aprovação vem do backend como `PUBLIC_URL + /approve/{token}` — a rota pública do web TEM que ser `/approve/[token]`.
- ✅ **Onda 3.1 (2026-07-17): "+" de agendamento por slot no calendário (paridade Postiz).** Hover/foco em qualquer célula vazia ainda "aberta" (Dia/Semana = slot de hora não-passado; Mês = dia de hoje em diante, padrão 9h) revela um quadrado accent 24px radius 6 com "+", por fade de opacidade 0.2s sem deslocamento (`SlotAddButton` em `features/calendar/calendar-grids.tsx`; acessível: focável, `aria-label`/`title` "Agendar para {data}", i18n `calendar.scheduleAt`). Clique pré-preenche o composer via store Zustand (`setMode('schedule')` + `setPublishAtLocal(toLocalInput(...))`) e navega p/ `/compor` — texto/canais de rascunho em andamento são preservados, só a data muda. Horário já vencido (ex.: slot da hora corrente) cai p/ "agora + ~10 min" arredondado a 5 (`scheduleAt` em `calendar-view.tsx`); passado segue sem "+" (hachurado na grade de horas). **Prova**: typecheck rodado pelo owner; verificado em navegador real em 2026-07-17 (hover na semana revela o "+"; owner também testou por conta própria). O `SlotAddButton` sobreviveu ao refactor mobile-first externo (`3da955f`).
- ✅ **Onda 3.2 (2026-07-17 noite): settings por canal no composer (paridade Postiz ref 8 — "desbloquear personalização por provider").** Acordeão "Configurações de {canal}" em cada aba de canal (`features/composer/channel-settings.tsx`), renderizado **genericamente** do `settingsSchema` (JSON Schema) do catálogo — boolean→Switch, enum→Select (optional sem default ganha opção "Padrão da rede"), array de string→input com vírgulas (estado local cru; normalizar a cada tecla engolia a vírgula — bug real corrigido), number→input numérico; labels/opções via i18n `composer.channelSettings.*` com `t.has` (fallback = nome do campo; hint = `description` do schema, já em pt-BR). Store Zustand ganhou `channelSettings` (persistido; limpo ao desmarcar canal/descartar), submit envia `settingsByChannel` só com o que foi alterado. Cabeçalho do acordeão em accent-tint com ícone do provider + ponto quando alterado. Cliente OpenAPI regenerado (snapshot com `settingsSchema` no ChannelProviderInfo).
- **Provas onda 3.2 (navegador real, stack dev 3000/3100)**: bluesky "Idiomas do post" pt → "pt, en", discord com 2 switches, mastodon select; rascunho (exigir aprovação) criado com 4 canais → **no banco**: `publications.settings` = `{"langs": ["pt","en"]}` no bluesky e defaults do schema nos demais (mastodon `visibility: public` etc.) — `settingsByChannel` de ponta a ponta; rascunho de teste cancelado depois. `bun run check` verde exceto `check:brand` (violações pré-existentes de `3da955f`, abaixo). 198 testes (7 novos: serialização JSON Schema por provider no test-kit) + check novo no `e2e-auth.ts` (catálogo expõe `settingsSchema` com `properties.langs`).
- ✅ **Conformidade do brand restaurada (2026-07-17, autorizado pelo owner)**: removidas as 5 classes `shadow-sm`/`shadow-xs` que o commit externo `3da955f` (calendário mobile-first) tinha introduzido em `calendar-grids.tsx`/`channels-panel.tsx`, mais o `scale-105` de seleção na mesma linha (transform proibido pelo brand). `bun run check` 100% verde de novo.
- ✅ **Onda 3.3 (2026-07-17 noite): formulário de conexão auto-gerado (follow-up da 3.2).** Catálogo `GET /v1/channels/providers` expõe `connectionFieldsSchema` = JSON Schema do `connectionFieldsSchema` (Zod) do provider, via o MESMO `settingsJsonSchema` da onda 3.2 — presente só quando o provider pede credenciais/instância (bluesky/telegram/discord/mastodon; LinkedIn/X OAuth puro NÃO expõem, e o e2e-auth confere ambos os lados). Campos de conexão ganharam `.describe()` pt-BR (hints: app password ≠ senha da conta, bot precisa ser admin, onde achar o webhook do Discord etc.). No web, `provider-fields.ts` deixou de ser mapa hardcoded e virou derivador genérico `connectionFields(schema)`: tipo do input = `format: 'uri'` → url, nome batendo `/password|secret|token/i` → password (mascarado), senão text; `required` do JSON Schema; description vira `FormDescription` sob o input; labels/placeholders seguem no i18n com fallback p/ o nome do campo (provider novo ganha formulário sem tocar no web). `ConnectionsView` decide dialog vs popup pelo catálogo (`connectType === 'fields'` ou schema com campos — mastodon OAuth 2 etapas continua abrindo dialog p/ instância opcional). Test-kit ganhou teste de serialização do connectionFieldsSchema (205 testes, +7). Cliente OpenAPI regenerado (stack E2E efêmera em banco `mp_e2e` SEPARADO no mp-pg — nunca contra o banco de dev, ver armadilha da decisão 22).
- **Provas onda 3.3 (2026-07-17)**: `bun run check` 100% verde (205 testes); `e2e-auth.ts` + `e2e-publish.ts` TUDO OK contra API efêmera 3988/banco mp_e2e (4 checks novos de catálogo); navegador real (stack dev 3000/3100, HMR): dialog do Bluesky com 3 campos + hints do schema e App password mascarado (••), dialog do Mastodon com "URL da instância (opcional)" + hint — ambos renderizados do catálogo, zero mapa hardcoded.
- ✅ **Onda 3.4 (2026-07-17 noite): preview por rede + seletor de data do brand.** (1) **Preview por rede** (SPEC_FRONTEND §3.3 — "aproximação visual do post em cada plataforma, como o Postiz"): `features/composer/network-preview.tsx` dá a cada provider um layout que lembra a rede, na versão minimalista do brand (tokens, zero sombras, chrome decorativo `aria-hidden`, NENHUMA cor de rede — identidade vem do badge do provider + layout): X/Bluesky/Mastodon = base `MicroblogPreview` (nome/@handle/hora, thread com conector vertical, linha de ações própria por rede — estrela+bookmark no Mastodon, views no X, 4 ícones no Bluesky); LinkedIn = cartão com hora+globo, mídia de ponta a ponta, barra Gostar/Comentar/Compartilhar/Enviar e réplicas de thread como COMENTÁRIOS (paridade com o publishReply real, decisão 18); Telegram = bolhas de canal sobre o fundo do chat (mídia ACIMA do texto, nome do canal em accent na 1ª bolha, olho+hora no rodapé); Discord = mensagem de webhook (nome + chip APP + hora, itens extras como continuação); fake/desconhecido = cartão neutro. `PostPreview` resolve mediaIds→URLs e passa `publishAt` (hora agendada no chrome; outro dia = "24 de jul., 08:30"; inválida = "agora"); **a página pública `/approve/[token]` usa OS MESMOS componentes** (SPEC §3.6 cumprida — o preview manual duplicado do approval-view morreu; mídia lá já vem resolvida da API). **Armadilha**: avatar em linha flex precisa de `self-start` — sem isso o span estica (align-items: stretch) e o badge absoluto do provider desce p/ o pé do cartão. (2) **DateTimePicker do brand** (pedido do owner na sessão: o datetime-local nativo estava "padrãozão"): `ui/calendar.tsx` espelha a API do kit shadrix (`mode/selected/onSelect/disabled`) mas o grid é próprio com a matemática de `lib/datetime` já usada no /calendario — zero deps novas (kit usaria react-day-picker+date-fns), hoje em círculo accent, semana começa segunda; `ui/date-time-picker.tsx` = botão com a data formatada (só 1ª letra maiúscula — `capitalize` do CSS subiria cada palavra em pt-BR) → popover com calendário + campo de hora; MESMO contrato de valor do input nativo (`toLocalInput`), drop-in no rodapé do composer e na edição do sheet (`min` desabilita dias passados). i18n: grupos novos `dateTime` e `composer.preview.linkedin` + `preview.now`.
- **Provas onda 3.4 (2026-07-17, navegador real na stack dev 3000/3100)**: 4 canais (mastodon/bluesky/telegram/discord) + texto + thread + mídia → um cartão diferente por rede (ações certas por rede, conector de thread, bolha dupla do Telegram, grade 1=cheia/2+=2 colunas, vídeo com frame+chip de filme); rascunho com aprovação → link gerado → `/approve/{token}` mostrou os MESMOS previews com o horário agendado → rascunho cancelado ao fim (link revogado junto, banco de dev limpo); picker: "Julho de 2026", dias passados desabilitados, selecionar dia 24 preservou a hora, editar hora atualizou trigger E chrome dos previews na hora. Console sem erros; `bun run check` 100% verde (205 testes). **Ficou de fora**: X/LinkedIn sem conferência visual ao vivo (pedem canal OAuth real; saem dos mesmos componentes, typecheck cobre) — smoke visual quando houver canal; `next build` não rodado nesta sessão (stack dev do owner ocupa o `.next` — typecheck+HMR cobriram).
- ✅ **Entregue na onda 5 (branch `composer-detail-popup`, confirmado pelo owner em 2026-07-18)**: **duplicar post** (`use-duplicate.tsx` + botão "Duplicar" no rodapé do detalhe → abre o composer pré-preenchido) e **settings por canal na edição** (o `post-detail-sheet.tsx` reusa o `ChannelSettingsCard`; `startEdit` semeia de `publications[].settings` do GET do grupo, `saveEdit` envia só o diff em `settingsByChannel` no PATCH). Ambos já estavam prontos quando esta linha de "Próximas fatias" ainda os listava como pendentes — corrigido aqui.
- **Próximas fatias**: "próximo slot livre"/posting_times, analytics, smoke visual do preview X/LinkedIn com canal real. **Follow-up backend**: avaliar redirect pós-callback OAuth de canal (hoje o popup mostra JSON por um instante); editar réplicas de thread agendadas. **Divergência a resolver na doc**: `docs/brand/BRAND_SYSTEM.md` fala "ManyPost" maiúsculo (§7) e fonte Degular Display (§5) — CLAUDE.md/brand README/app usam `manypost` minúsculo + Plus Jakarta Sans (o que está implementado).
