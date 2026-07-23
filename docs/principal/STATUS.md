# STATUS.md — onde o manypost está agora

[← Índice da documentação](../README.md) · [Histórico das ondas](CHANGELOG_ONDAS.md) · [Decisões](DECISIONS.md) · [Planos](PLANS.md) · [Gates das plataformas](platform-gates.md) · [README do projeto](../../README.md)

> **Comece por aqui** (junto do [CLAUDE.md](../../CLAUDE.md) da raiz). Este arquivo responde três
> perguntas: **o que já funciona** (com prova), **o que falta** (com a spec de referência de cada
> item) e **como rodar/verificar**. O relato de *como chegamos aqui* — onda a onda, com as provas
> de cada entrega — vive em [CHANGELOG_ONDAS.md](CHANGELOG_ONDAS.md).
>
> **Como manter:** ao fechar uma fatia, atualize as seções abaixo **e** abra uma entrada nova no
> topo do changelog. Este arquivo é sobre o presente; o changelog é sobre o passado.

## 0. Estado em uma tela

| | |
|---|---|
| **Última entrega** | Onda 13 (2026-07-23) — **nota humanizada de conexão por rede** em Conexões (ícone "?" + popover), específica por modo (self-host × nuvem); `/v1/capabilities` passou a expor `selfHosted`. Antes, onda 12: **Twitch e Kick** + o catálogo parou de esconder rede sem credencial |
| **Fase** | Fase 1 (MVP): backend completo e verificado, web com toda a superfície da API, billing do Cloud entregue |
| **Provas** | `bun run check` verde — **341 testes** + typecheck (api/web) + fronteiras + grep de IA + brand. E2E reais no CI: `e2e-auth`, `e2e-publish`, `e2e-public`, `e2e-mcp`, `e2e-billing` |
| **Redes prontas** | Mastodon, Bluesky, Telegram, Discord (OAuth2+Bot **e** webhook), LinkedIn, X, TikTok (sandbox — auditoria em revisão), Threads (Development Mode), Twitch e Kick (chat ao vivo) + `fake` para testes |
| **Próxima onda** | Resto da família Meta: Facebook Pages e Instagram (+ `instagram-standalone`) — §4 |
| **Bloqueios externos** | Gates de plataforma — [platform-gates.md](platform-gates.md). Nenhum deles bloqueia o desenvolvimento, só a publicação em produção |

## 1. O que é o projeto (30 segundos)

**manypost** (wordmark sempre minúsculo): agendador/publicador multicanal de posts, **monorepo 100% open source (AGPL-3.0) derivado do Postiz** — reimplementação em Bun/TS + Hono + Drizzle/Postgres + pg-boss + Redis + Next.js. Modelo open-source unificado (sem repo privado `manypost-premium`): IA operacional, governança e billing são integrados ao monorepo e controlados via variáveis de ambiente (`IS_SELF_HOSTED`, `HIDE_BILLING`) para separar a experiência comunitária self-hosted (`manypost Community`) do serviço gerenciado na nuvem (`manypost Cloud`). Decisões congeladas em [DECISIONS.md](DECISIONS.md) (v1 + adendo v1.1 + adendo Open Source v1.2).

**Referência de estudo:** o clone do Postiz está em `../_ref/postiz-app` (commit `84edda5`). **Pode e deve consultá-lo** para tirar dúvidas de comportamento (fluxos OAuth por rede, formatos de payload, validações por plataforma, workflows Temporal deles) — MAS: nunca copiar código literalmente sem marcar `// Derived from Postiz (AGPL-3.0): <arquivo>`, e a análise completa dele já está em [POSTIZ_ANALYSIS.md](POSTIZ_ANALYSIS.md).

## 2. O que JÁ ESTÁ PRONTO e verificado

Cada item abaixo tem testes unitários e/ou E2E reais (Postgres 17 + Redis + worker de verdade em Docker). Rode `bun run check` (typecheck+testes+fronteiras) e os E2E via CI (`.github/workflows/ci.yml`) ou localmente (containers + `scripts/e2e-*.ts`).

| Área | O que funciona | Spec | Código |
|---|---|---|---|
| **Fundação** | Monorepo Bun workspaces, tsconfig, dependency-cruiser (fronteiras), grep anti-provedor-de-IA, Docker/compose, CI completo | SPEC_ARCHITECTURE §4-6 | raiz, `.github/`, `docker/` |
| **Banco** | Schema Drizzle integral (23 tabelas), migrations `0000..0002`, runner no boot com advisory lock, uuidv7 | SPEC_DATA | `packages/db` |
| **Criptografia** | AES-256-GCM p/ tokens de canal e secrets de webhook (AAD por chave natural, keyring versionado) | SPEC_DATA §5 | `packages/core/src/infra/crypto` |
| **Auth** | Registro/login (Argon2id), JWT 15min + refresh 30d com **rotação e detecção de reuso** (reuso → revoga família), API keys `mp_live_` hasheadas com escopos, cookies httpOnly | SPEC_API_MCP §2 | `use-cases/auth.ts`, `apps/api/src/http/routes/auth*` |
| **Login social** | Google + GitHub (env `GOOGLE_*`/`GITHUB_*`), vínculo por e-mail **verificado**, avatar do social só preenche se vazio | SPEC_API_MCP §2 | `social-auth.routes.ts`, `infra/identity/` |
| **Canais** | Conexão OAuth (state em cookie httpOnly, 2 etapas p/ instância custom), tokens cifrados, upsert sem duplicar, list/disconnect | SPEC_INTEGRATIONS §2-3 | `use-cases/channels.ts`, `channels.routes.ts` |
| **Publicação** ⭐ | `POST /v1/posts` valida tudo → grupo + 1 publicação/canal → job pg-boss `startAfter` → worker publica no horário. Máquina de estados com **fencing** (UPDATE condicional) + **fencing por versão de job** | SPEC_QUEUE §3-5,7 | `use-cases/publishing.ts`, `packages/queue` |
| **Retry/erros** | Taxonomia transient/refresh-token/permanent; backoff exponencial+jitter (máx 5); refresh de token automático com re-encrypt; falho → canal `REFRESH_REQUIRED` | SPEC_QUEUE §7 | idem |
| **Recuperação** | Scanner por minuto: SCHEDULED vencida re-enfileira; zumbi PUBLISHING → `NEEDS_REVIEW` (**nunca reposta às cegas** — DECISIONS §7) | SPEC_QUEUE §8 | `makeRecoverDue` |
| **Rate-limit** | Janelas por provider e por canal em Redis (Lua atômico all-or-nothing); negado re-agenda **sem consumir tentativa**; sem Redis = falha aberta | SPEC_QUEUE §6 | `packages/queue/src/redis-rate-limiter.ts` |
| **Cancelar/editar** | Cancel → CANCELLED (job antigo morre por versão); PATCH texto/horário → re-agenda com versão nova (equivalente ao TERMINATE_EXISTING do Postiz) | SPEC_QUEUE §5 | `makeCancelPost`/`makeReschedulePost` |
| **Webhooks de saída** | CRUD `/v1/webhooks`, secret `whsec_` cifrado (mostrado 1x), entrega assinada HMAC (`x-manypost-signature: t=..,v1=..`), retries 1m→6h (5x), anti-SSRF por DNS | SPEC_API_MCP §4 | `use-cases/webhooks.ts` |
| **Eventos emitidos** | `post.published`, `post.failed`, `channel.refresh_required` | contracts `events.ts` | dentro de `publishPublication` |
| **Providers** ⭐ | Onda 1: **Mastodon** (OAuth por instância, `MASTODON_DEFAULT_INSTANCE` opcional pré-preenche), **Telegram** (bot; conecta por `@canal`/id, valida admin+can_post via getChat/getChatMember; publish sendMessage/Photo/Video/MediaGroup por URL pública; réplicas via `reply_parameters`; token do bot cifrado no canal), **Bluesky** (app password sobre AT Protocol; publica com o accessJwt guardado via getSession — worker renova via refreshSession; imagens via uploadBlob+embed; thread com root/parent corretos via getPosts; PDS custom por `service`), **Discord** (conecta por **URL de webhook do canal** — sem OAuth/bot/env; GET valida o webhook e resolve canal/servidor; publish via Execute Webhook `?wait=true` — texto JSON, mídia multipart `payload_json`+`files[]`; flags `suppressEmbeds`/`silent`; sem threads no modelo webhook; URL do webhook cifrada at-rest). **LinkedIn** (OAuth membro `openid profile w_member_social`; publica na Posts API versionada `LinkedIn-Version: 202601` — texto+imagens: 1 = `content.media`, 2–20 = `multiImage`, upload `initializeUpload`→PUT→espera AVAILABLE; `commentary` com escape do formato "little"; threads = comentários via `socialActions` SEMPRE no post raiz; réplica só texto; página/vídeo = onda 2), **X** (OAuth2 **PKCE S256** confidential client, BYO-key `X_CLIENT_ID/SECRET` — DECISIONS §6; `POST /2/tweets`, thread via `reply.in_reply_to_tweet_id`; mídia por upload chunked v2 `initialize/append(4MB)/finalize` + poll STATUS p/ vídeo/gif; alt text `/2/media/metadata` best-effort; refresh OAuth2 rotaciona e o worker persiste o par novo; `channelSettings {username, verified}` → releaseUrl com handle e 4000 chars p/ verified). **Threads** (onda 11 — primeiro da família Meta: OAuth em `threads.net` com token curto → longo de ~60 dias; publica em **container** `POST /{userId}/threads` → poll de `status` até `FINISHED` → `threads_publish` → `permalink`; carrossel de 2–20 itens misturando imagem e vídeo, `alt_text` por mídia; **réplicas nativas** por `reply_to_id`; mídia é *pull* da Meta por URL pública). **Twitch** e **Kick** (onda 12 — publicam no **chat ao vivo**, não em feed: Twitch manda mensagem (`/helix/chat/messages`, `Client-Id` obrigatório) ou anúncio do canal (`/helix/chat/announcements`); Kick manda mensagem (`/public/v1/chat`, OAuth 2.1 + PKCE). Réplica encadeada nos dois; **zero mídia** nas capabilities; `is_sent:false` = falha com o motivo, nunca sucesso falso). **Fake** p/ E2E. Todos passam o **test-kit de contrato** (`test-kit/contract.ts`: schemas, classifyError, validateMedia, threads→publishReply) | SPEC_INTEGRATIONS §2/§7 | `packages/providers/src/{mastodon,telegram,bluesky,discord,linkedin,x,fake}` |
| **Mídia** ⭐ | Upload multipart (`POST /v1/media/upload`) com **MIME real por magic bytes** (JPEG/PNG/GIF/WebP/MP4/MOV/WebM, nunca confia no cliente) + dimensões de imagem lidas do header; `POST /v1/media/from-url` (anti-SSRF com re-validação por salto de redirect + teto de bytes no streaming); `GET /v1/media`, `PATCH :id` (alt), `DELETE :id` (soft — arquivo fica p/ posts agendados); arquivos servidos públicos em `/uploads/:org/:file` (chaves UUID); storage local (`UPLOAD_DIR`), port `MediaStorage` pronto p/ S3/R2; `POST /v1/posts` aceita `mediaIds` → refs com URL pública+MIME no content, validadas por canal via `provider.validateMedia` (helper `checkMediaRules` compartilhado: contagem, mistura imagem/vídeo, MIME) | SPEC_API_MCP §3, SPEC_DATA §3, SPEC_INTEGRATIONS §2 | `use-cases/media.ts`, `infra/media/sniff.ts`, `media.routes.ts`, `providers/src/shared/media-rules.ts` |

| **Threads** ⭐ | `POST /v1/posts` aceita `thread: [{text, mediaIds?, delaySec?}]` (réplicas após o post principal, até 24, delay 0–600s). Publicação item a item com **cursor `lastPublishedIndex`** — retry retoma do cursor e **nunca reposta** item confirmado (SPEC_QUEUE §7); delay entre itens = job `publish-thread-item` durável (§9), continuação com fencing triplo (estado PUBLISHING + jobVersion + cursor exato); item que falha aponta `item N da thread` no errorMessage; `itemCount`/`lastPublishedIndex` expostos no GET | SPEC_QUEUE §7/§9 | `makeContinueThread` em `use-cases/publishing.ts`, `publication_items` |
| **Providers** (2) | `publishReply` no contrato (com settings); Mastodon responde via `in_reply_to_id`; fake simula réplicas com falha injetável (`failFirstReplyAttempts`) | SPEC_INTEGRATIONS §2 | idem |
| **Aprovação por link** ⭐ | `POST /v1/posts` com `requireApproval: true` → grupo/publicações nascem `DRAFT` sem job. `POST/GET/DELETE /v1/posts/:groupId/approval-link` (token 256 bits, só sha256 no banco, expira em 7 dias — configurável 1–720h; criar de novo revoga o anterior). Superfície pública **sem login** `/public/approval/:token`: `GET` preview por canal (conteúdo/mídia/horário, zero ids internos), `POST .../approve` **agenda de verdade** (DRAFT→SCHEDULED + jobs), `POST .../request-changes` (feedback obrigatório) mantém rascunho. 404 uniforme (inválido/expirado/revogado), idempotente (2ª chamada devolve o resolvido), rate-limit Redis por IP+token (30 e 10/min), `audit_log` com `actor_type=PUBLIC_LINK`, notificação p/ equipe (`GET /v1/notifications`) | DECISIONS v1.1 §12, SPEC_API_MCP §3, SPEC_FRONTEND §3.6 | `use-cases/approvals.ts`, `approvals-public.routes.ts`, `approvals.repo.ts`, `platform.repo.ts` |

| **Listagens** ⭐ | `GET /v1/publications?from&to&state&channelId&cursor&limit` — feed flat p/ calendário/kanban (cliente agrupa por `groupId`), cada item embute grupo (`state`, `origin`, **`awaitingApproval`** = link PENDING não expirado) e canal (provider/nome/handle/avatar); keyset pagination por `(publishAt, id)` com `nextCursor`; filtros csv validados (inválido → 400 `validation.invalid_request`, novo mapeamento ZodError→400 no error handler) | SPEC_FRONTEND §3.1-3.2, SPEC_API_MCP §3 | `publications.routes.ts`, `listPublicationsFeed` |
| **SSE** ⭐ | `GET /v1/events` (auth cookie/Bearer): eventos nomeados `post.scheduled`/`post.published`/`post.failed`/`channel.refresh_required`/`notification.created` + `hello`/`ping` keepalive 25s. Transporte: Redis pub/sub (`mp:rt:{orgId}`) — worker publica, API assina; **assina antes do hello** (sem janela de perda); sem Redis = stream só de keepalive (fallback = polling da UI). `makeEmitEvent` ecoa todo evento de domínio no bus (inscrito ou não em webhook), melhor esforço | SPEC_FRONTEND §4 | `events.routes.ts`, `redis-realtime-bus.ts`, port `RealtimePublisher/Subscriber` |
| **Retry manual** | `POST /v1/posts/:groupId/retry` (body `channelId?` = por canal) — kanban "tentar novamente": FAILED **e NEEDS_REVIEW** (ação humana explícita — DECISIONS §7 só proíbe repost automático) → SCHEDULED com tentativas zeradas, `job_version` novo (job antigo morre) e publicação imediata | SPEC_API_MCP §3, SPEC_FRONTEND §3.2 | `makeRetryPost` |
| **Notificações** | `GET /v1/notifications` + `POST /:id/read` (idempotente) + `POST /read-all`; `post.scheduled` agora é emitido como webhook/SSE no agendar e no aprovar (não em rascunho) | SPEC_API_MCP §4, SPEC_FRONTEND §4 | `notifications.routes.ts`, `platform.repo.ts` |
| **Documentação da API** ⭐ | `/openapi.json` (OpenAPI 3.1) descreve **toda** a superfície (36 rotas) com schemas reais de request/response/erro (problem+json RFC 9457), `security` (Bearer JWT/API key + cookie de sessão) e tags por recurso; **zero stubs genéricos**. `/docs` = explorador Scalar. Rotas JSON documentadas via `createRoute`/`app.openAPIRegistry.registerPath` reaproveitando os schemas de request já existentes; SSE/redirect OAuth/binário documentados sem tocar em handler (comportamento idêntico — E2E cobre). `defaultHook` uniformiza erro de validação → 400 problem+json. É a fonte do cliente OpenAPI do futuro `apps/web` | SPEC_API_MCP §3 | `apps/api/src/http/openapi.ts` (infra), `main.ts` (security schemes + info), todas as `*.routes.ts` |

**Provas:** 341 testes unit (`bun test`, inclui golden bodies de Telegram/Bluesky/Discord (OAuth+webhook)/LinkedIn/X/TikTok/Threads/Twitch/Kick com fetch mockado + test-kit de contrato aplicado a todo provider) + `scripts/e2e-auth.ts` (catálogo `/providers` filtrado por env: bluesky/mastodon/**discord-webhook** sempre, telegram só com token, **discord (OAuth2+Bot)**/linkedin/x só com client id/secret (+ bot token no Discord); provider sem env → connect 404; com env fake, connect devolve a URL OAuth certa — verificado manualmente: LinkedIn com os 3 escopos, X com `code_challenge` S256) + `scripts/e2e-publish.ts` (106 checks) — CI roda tudo com services postgres+redis. Discord verificado também contra a API real (connect com webhook inválido → `channel.connect_failed` legível, nunca 500). **Smoke real opcional**: `scripts/live-telegram.ts` (`TG_CHAT=@canal bun run scripts/live-telegram.ts` publica de verdade — não roda no CI).

## 3. Decisões de implementação que você precisa saber (além das specs)

1. **Enqueue é pós-commit** (não na mesma tx — API do pg-boss v10 não expõe executor): a linha `publications` é a fonte de verdade; scanner+fencing cobrem. Nota na SPEC_QUEUE §5.
2. **Fencing duplo** no handler: por estado (UPDATE condicional `WHERE state IN (...)`) e por `job_version` (payload `{publicationId, v}`; job de versão antiga = no-op). É isso que torna cancel/edit seguros.
3. **AAD da criptografia** de canal = `orgId:provider:externalId` (chave natural — id não existe antes do insert); de webhook = `webhook:orgId`.
4. **Settings de publish** = merge `{...channel.settings, ...publication.settings}` — é assim que o Mastodon recebe a `instance`.
5. **maxConcurrent** dos providers ainda NÃO é aplicado (só janelas). Semáforo Redis é pendência (§4).
6. Retry de fila (pg-boss `retryLimit`) = 0 de propósito: retry de negócio é da máquina de estados.
7. Composition root em `apps/api/src/container.ts` (sem framework de DI); worker dedicado espelha em `apps/worker/src/main.ts`; `MODE=all` roda api+worker num processo.
8. `cancelBySingletonKey` toca `pgboss.job` via SQL (best-effort; higiene) — se o schema do pg-boss mudar, só perde a higiene, nunca a corretude.
9. **Mídia**: refs ficam DENTRO de `publications.content` (`{text, media: [{mediaId,type,url,mime,alt}]}`) e em `publication_items.media`; o worker só repassa URLs — quem baixa bytes é o provider (Mastodon baixa de `/uploads` e sobe na instância). `rescheduleGroup` faz **merge jsonb (`||`)** no content: editar só o texto preserva a mídia. `DELETE /v1/media` é soft e NÃO apaga o arquivo (posts agendados ainda apontam p/ a URL). `validateMedia` roda no agendamento (falha cedo com `post.invalid_media`), não no publish.
10. **Threads**: item 0 publica a partir de `publications.content` (por isso PATCH de texto edita o post principal; réplicas são imutáveis por enquanto — edite cancelando/recriando). Itens ≥1 vêm de `publication_items` e saem via `provider.publishReply` (exigido junto com `capabilities.threads` no agendamento). O cursor só avança APÓS confirmação da rede (`recordItemPublished`, UPDATE condicional monotônico). Entre itens com delay o estado fica `PUBLISHING` — por isso `delaySec` ≤ 600s (watchdog de zumbi é 15 min; cada avanço de cursor renova `updated_at`). Continuações NÃO passam pelo rate-limit (a thread já está em voo; o ritmo é o delaySec). Cancelar só alcança estados pendentes — thread em voo termina. Zumbi mid-thread → `NEEDS_REVIEW` (cursor diz o que já está na rede).
11. **Drizzle + subquery correlacionada**: `${tabela.coluna}` dentro de `sql\`\`` num select renderiza SEM qualificação — numa subquery o escopo interno captura a coluna errada. Qualifique com `${tabela}.coluna` (bug real corrigido no `itemCount`).
12. **Aprovação por link**: rascunho (`requireApproval`) NUNCA vira `refreshGroupState` (agregador não conhece DRAFT) — aprovação usa `scheduleDraftGroup` (UPDATE condicional em DRAFT = fencing: grupo cancelado no meio → aprova o link mas agenda 0 publicações, inofensivo). **Editar ou cancelar o rascunho revoga o link pendente** (o cliente não pode aprovar conteúdo que não viu); PATCH em grupo DRAFT edita SEM agendar (via `updateDraftGroup`, não `rescheduleGroup`). Expiração é **lazy** (checada no acesso; sem cron). Aprovado com `publishAt` no passado publica imediatamente. No preview, o item 0 sai de `publications.content` (não de `publication_items`) — mesma fonte que o worker usa, então edição via PATCH aparece certa. Rate-limit da superfície pública falha aberto sem Redis (consistente com §6 da fila).
13. **SSE/realtime é melhor esforço, não fonte de verdade**: o bus Redis só "cutuca" a UI para refetch; perder evento não perde dado (polling 30s cobre). Estados intermediários (PUBLISHING/RETRYING) NÃO geram evento — só os momentos de UX (scheduled/published/failed/refresh_required/notification). No handler SSE, assinar ANTES de escrever o `hello` (quem viu o handshake não perde eventos).
14. **Cursor do feed**: keyset `(publish_at, id)` com row-value comparison; num `sql\`\`` cru o drizzle não infere tipo de `Date` — passar ISO com `::timestamptz` explícito (bug real corrigido). Cursor malformado = primeira página (não vaza erro). `ZodError` agora vira 400 `validation.invalid_request` no error handler (antes: 500).
15. **Retry manual** captura `jobVersion+1` ANTES do `transition` com bump (o repo real retorna snapshot, mas assim fica correto mesmo com referência compartilhada); corrida entre retries: perdedor é no-op, e job com versão errada é descartado pelo fencing — scanner recupera se o enqueue falhar.
16. **Providers onda 1**: contrato ganhou `connectWithFields?` (conexão direta por credenciais, sem OAuth — Bluesky/Telegram) e `requiredSecrets?` (chaves de env que tornam o provider disponível). `ctx.secrets` por provider vem do env: no connect via `container.providerSecrets`, no worker via `PublishDeps.secrets`. Catálogo `/v1/channels/providers` **filtra por disponibilidade** (como o login social) e expõe `connectType: 'fields'|'oauth'`. Erro `{status,body}` de provider no connect → `channel.connect_failed` (400 legível, nunca 500). **Telegram**: o "token do canal" É o bot token, cifrado at-rest por canal (trocar o env = reconectar). **Bluesky**: publica com o **accessJwt guardado** via `getSession` (GET, valida e resolve did/handle); NÃO renova no publish — o `refreshJwt` do atproto rotaciona a cada refresh e só o worker persiste a rotação (renovar num provider stateless invalidaria o token). accessJwt expirado → `ExpiredToken`/401 → classify `refresh-token` → worker chama `refreshToken` (é uma *procedure* POST **sem body**, `refreshJwt` no header → `xrpc({procedure:true})`) e persiste o novo par. `refreshToken(ctx, rt, settings)` recebe settings (Bluesky precisa do `service`/PDS). Vídeo no Bluesky (embed async) fica p/ onda 2 (`videos.maxCount=0`). Golden bodies por rede ficam no `.test.ts` do provider; o test-kit cobre o contrato comum.
17. **Discord — DOIS providers (onda 4)**: (a) **`discord` (OAuth2 + Bot)** — modo "Tudo Pronto"/paridade SaaS: `requiredSecrets: [clientId, clientSecret, botToken]` (só aparece no catálogo com os 3 `DISCORD_*` no env), `getAuthUrl` com `scope=bot identify guilds` e `permissions=377957124096`, `exchangeCode` guarda o guild (`externalId`=guildId, `channelSettings={guildId, chatType:'guild', channelId? default}`) + resolve o app via `/oauth2/@me`; **publish usa o BOT TOKEN (env)** em `POST /channels/{id}/messages`, e o `guildId`/`channelId` vêm do **settings mergeado** (channel.settings+pub.settings, decisão 4) — **nunca do token** (o worker passa só `{accessToken,scopes}`); sem `channelId` escolhido, auto-descobre os canais postáveis (tipos 0/5/15) e tenta cada um até um aceitar; `channelId` do settingsSchema é **opcional** (obrigatório quebraria a validação de settings no agendamento — decisão do owner endurecida nesta sessão); `refreshToken` renova o par OAuth; `listSubAccounts` (rota `GET /v1/channels/:id/sub-accounts`) lista os canais p/ a UI (composer `SubAccountsField`). (b) **`discord-webhook`** — modo leve self-hosted (o antigo webhook por canal, agora `id: discord-webhook`): conecta por `connectWithFields` com uma **URL de incoming webhook** (`https://discord.com/api/webhooks/{id}/{token}`) — sem OAuth, bot token ou env (por isso `requiredSecrets` vazio → sempre disponível no catálogo). `externalId` = **channel_id** (o alvo é o canal; recolar um webhook novo do mesmo canal reconecta em vez de duplicar). A URL (contém o secret) é o `accessToken`, cifrada at-rest. Publish = Execute Webhook `?wait=true` (retorna a mensagem p/ resolver `externalId`+`releaseUrl`); mídia via multipart `payload_json`+`files[i]` (o worker baixa bytes da URL pública e sobe no anexo, filename por MIME). `flags` = SUPPRESS_EMBEDS/SUPPRESS_NOTIFICATIONS (settings `suppressEmbeds`/`silent`). `validateMedia` reforça o teto **combinado** de 10 anexos (o `checkMediaRules` só limita por tipo). **threads:false** — webhook não cria thread nem responde a mensagem (precisaria de bot token → onda 2). `classifyError`: 401/404/`Unknown Webhook` → `refresh-token` (canal sem `refreshTokenEnc` ⇒ `refreshToken()` lança ⇒ vira `REFRESH_REQUIRED` = recolar nova URL).
18. **LinkedIn (member)**: token de membro é **write-only** em `/rest/images` — o GET de status responde 401/403; o poll de processamento detecta isso e cai numa espera fixa de 10s (direção do Postiz) antes de anexar. Refresh programático só existe p/ apps no programa de parceria — canal sem `refreshTokenEnc` vai direto a `REFRESH_REQUIRED` (mesmo modelo do Discord); o `refreshToken` está implementado p/ quando a app tiver o produto. Comentário de comentário tem 1 nível só: `publishReply` extrai a atividade raiz de `urn:li:comment:(raiz,id)` e comenta sempre na raiz (thread = comentários planos em ordem). Escopo conferido no `exchangeCode` (sem `w_member_social` → 403 legível antes de criar canal). `validateMedia` rejeita mídia em itens 1+ (comentário é só texto).
19. **X (OAuth2 PKCE)**: diverge do Postiz de propósito (lá é OAuth 1.0a + upload v1.1) — nosso fluxo genérico já guarda `codeVerifier` no cookie de connect e o upload v2 funciona com o bearer OAuth2 (escopo `media.write`). Token dura ~2h: publish com 401 → classify `refresh-token` → worker renova (o refresh token **rotaciona** a cada uso, como Bluesky — só o worker persiste). `username`/`verified` ficam em `channelSettings` (releaseUrl com handle; `maxLength` 4000 p/ verified — sem handle no settings a releaseUrl cai em `x.com/i/web/status/`). `reply_settings` só no post raiz (réplica não aceita). `maxConcurrent: 1` e janela 80/15min por canal — limites do X são por app (BYO-key) e rígidos.
20. **`providerSecretsFromEnv` (config)**: o mapa env→`ctx.secrets` por provider agora tem fonte única em `@manypost/config` — a api (`container.ts`) E o worker dedicado (`apps/worker/src/main.ts`) usam a mesma função. **Bug corrigido**: o worker dedicado (MODE=worker) não recebia `providerSecrets` nenhum — refresh de LinkedIn/X falharia lá (MODE=all sempre funcionou).
21. **Settings por canal (2026-07-17)**: o catálogo `GET /v1/channels/providers` expõe `settingsSchema` = JSON Schema do Zod de cada provider (helper `settingsJsonSchema` em `packages/providers/src/shared/settings-json-schema.ts`, dep `zod-to-json-schema`, `$refStrategy:'none'`; test-kit exige serialização) — os campos ganharam `.describe()` pt-BR que a UI mostra como hint. **`verified` saiu do settingsSchema do X** (é setting de CANAL preenchido na conexão; exposto viraria toggle enganoso — `maxLength` continua lendo do objeto cru e o parse não-strict só o descarta). Em contrapartida, o `maxLength` do AGENDAMENTO agora valida com o merge `{...canal.settings, ...settings da publicação}` (mesma semântica do publish, decisão 4) — X verified valida contra 4000 já no schedule; o `maxLength` do catálogo segue sendo o base (contador da UI).
22. **`textByChannel` (override de texto por canal, SPEC_FRONTEND §3.3)**: `POST /v1/posts` aceita `textByChannel: {channelId: texto}` — só o **item 0** é personalizado (réplicas de thread são globais); validado pelo `maxLength`/`validateMedia` do canal; chave fora de `channelIds` → 404. **Semântica do PATCH**: editar `text` sobrescreve o content de TODAS as publicações do grupo (overrides são resetados) — documentado no schema. O catálogo `GET /v1/channels/providers` agora expõe `maxLength` (base, sem settings — X verified pode ser maior) e `media` (regras img/vídeo) p/ contadores e validação client-side. **Armadilha de ambiente**: dois processos MODE=all na MESMA fila/DB com `ENCRYPTION_KEY` diferentes = o worker "errado" pega o job e falha decrypt ("Unsupported state or unable to authenticate data") → FAILED permanente. Não rode uma segunda API/worker com chave de teste contra o banco de dev.
23. **Sub-contas / seleção de canal (onda 4)**: contrato ganhou `SubAccount` (= `ExternalAccount` + `channelSettings?`) e `ConnectedToken` (= `TokenSet` + `externalId`/`name`/`channelSettings` — o token decifrado + identidade do canal). `listSubAccounts(ctx, token: ConnectedToken): Promise<SubAccount[]>` (antes era `TokenSet→ExternalAccount[]`, que não dava p/ ler o guildId). Rota `GET /v1/channels/:id/sub-accounts` (auth, admin não exigido) → `makeListSubAccounts` decifra o token e chama o provider; provider sem `listSubAccounts` → `[]`. A UI (composer `SubAccountsField`) busca a rota via fetch cru — o snapshot OpenAPI do web **já tem a rota** (regenerado na onda 11), então trocar pelo cliente tipado virou faxina pendente, não bloqueio. **Telegram `/connect ABCD`**: além de `@nome`/id/`t.me/…`, o connect aceita um código curto — o usuário adiciona o bot como admin do canal e manda `/connect ABCD` (ou só `ABCD`) lá; `connectWithFields` procura via `getUpdates` (allowed_updates message/channel_post), casa o texto, resolve o `chat.id` e apaga a mensagem (`deleteMessage`, best-effort). Sem match → 422 legível. **Callback OAuth agora é popup**: `GET /v1/channels/callback/{provider}` devolve HTML 200 que faz `window.opener.postMessage({type:'manypost:oauth:success', channelId})` e `window.close()` — o web (`oauth-popup.ts`) resolve por `message` (primário) ou por detecção same-origin do path do callback (fallback), e `use-oauth-flow` reinvalida os canais 500ms depois (cobre o canal aparecendo pós-close).

24. **Threads (onda 11) — o molde da família Meta**: (a) **duas trocas de token** no connect (curto de 1h → longo de ~60 dias por `th_exchange_token`); o longo é o que fica cifrado. **Não existe refresh token separado** — o próprio token longo vai ao `/refresh_access_token` (`th_refresh_token`), então `accessToken` e `refreshToken` guardam o MESMO valor e o worker persiste a rotação. Renovação é **reativa** (401 → refresh): token que expira sem uso cai em `REFRESH_REQUIRED` (o `refreshCron` proativo do Postiz segue em aberto). (b) **`userId` e `username` vivem em `channelSettings`** (o contrato de `publish` não recebe o `externalId` do canal) — sem `userId`, o publish cai em `/me/threads`. (c) **Publicação em 2 passos**: container → poll `status` até `FINISHED` → `threads_publish`. **Depois do `threads_publish` o post já está na rede: nada pode lançar** — por isso a busca do permalink é best-effort com fallback para o perfil (`@handle`). Um throw ali faria a máquina de estados retentar e **repostar**. (d) O **orçamento de polls é compartilhado** pela publicação inteira (pai + filhos do carrossel) p/ o total ficar sob o watchdog de zumbis (15 min); estourar = `504` transient (nada publicado ⇒ retry seguro). (e) **A Meta faz *pull* da mídia por URL pública** — o worker não sobe bytes. Em dev, URL de `localhost` não é alcançável pela Meta: o container volta `ERROR` com "The media could not be fetched from this URI" (permanente). (f) Carrossel aceita **mistura de imagem e vídeo** (2–20) — `checkMediaRules` com `allowMixed` + teto combinado no `validateMedia`.

25. **Catálogo de providers não esconde mais rede (2026-07-22)**: `GET /v1/channels/providers` (interno) devolve **todas** as redes implementadas com `available: boolean`; a indisponível traz `setupEnv` com **os nomes das variáveis de ambiente que faltam** — mas só em `IS_SELF_HOSTED=true` (no gerenciado o usuário final não opera o env, então o campo é omitido e a UI trata a rede como "em breve"). Antes o provider sem credencial **sumia**, e o self-hoster não descobria que a rede existia. O mapa secret→variável virou fonte única em `providerEnvVarNames` (`@manypost/config`), derivada do mesmo objeto que alimenta `providerSecretsFromEnv` — provider novo que esquecer de entrar lá não ganha dica (e o `satisfies` barra nome de variável inexistente). **A superfície de máquina (`/public/v1`) continua filtrando**: para um agente, listar rede que ele não pode conectar é ruído.

26. **Twitch/Kick — redes de CHAT (onda 12)**: quebram três suposições que valiam para todas as anteriores. (a) **Não há feed**: o destino é a sala ao vivo, então `releaseUrl` aponta o canal (não o post) e o anúncio da Twitch **não devolve id de mensagem** (geramos `announcement:<uuid>`). (b) **Sucesso não é o status HTTP**: as duas respondem **200 com `is_sent:false` + motivo** quando descartam a mensagem (seguidores-only, duplicada, chat travado) — tratamos como falha `422` com o `drop_reason`, senão o post ficaria "publicado" sem ter entrado no chat (o Postiz engole isso). (c) **Zero mídia**: `media.images/videos maxCount: 0` faz o composer barrar anexo no agendamento. Além disso: a Helix da Twitch exige o header **`Client-Id`** em toda chamada (bearer sozinho dá 401) e devolve `scope` como **array**; a Kick é **OAuth 2.1 (PKCE obrigatório)**, quer `broadcaster_user_id` **numérico** e já devolveu `/users` ora como lista, ora como objeto — o provider aceita os dois. `broadcasterId`/`broadcasterUserId` ficam em `channelSettings` (mesmo padrão do Threads).

## 4. O QUE FALTA — em ordem sugerida, com referências

### ⭐ FOLLOW-UP PRINCIPAL DAS PRÓXIMAS IMPLEMENTAÇÕES — providers da Meta (Facebook Pages · Instagram), lendo a referência do Postiz

> **Threads saiu na onda 11** (o mais isolado dos três: OAuth próprio, API própria, sem Página do Facebook no meio) e deixou pronto o padrão **container → poll → publish** que Facebook e Instagram reusam. Faltam **Facebook Pages** e **Instagram** (+ `instagram-standalone`), que compartilham o MESMO app Meta, o MESMO App Review e a MESMA Business Verification. Ordem: **implementar em Development Mode primeiro, submeter depois** — o gate externo NÃO bloqueia o código (ver "Gate legal" abaixo).

**O gate externo não bloqueia o código (decidido em 2026-07-22 — não re-litigar):** a Meta exige
Business Verification para *advanced access*, que é o que `instagram_content_publish` e
`pages_manage_posts` precisam para publicar em conta de terceiro. Não existe desvio técnico —
detalhes do processo em [platform-gates.md](platform-gates.md#-meta--o-gate-é-de-entidade-jurídica-não-de-código).
Mesmo assim, tudo abaixo pode ser implementado agora:

- **Development Mode** dá acesso completo às permissões para contas com papel no app (dono + testers)
  ⇒ dá para implementar, rodar E2E e **gravar o screencast que a submissão exige** antes de a
  verificação existir. Só o Live Mode com usuário real depende do gate.
- **Self-hosted não depende disso**: mesma lógica de BYO-key já decidida para o X
  ([DECISIONS v1.1 §13](DECISIONS.md)) — cada instância registra o próprio app Meta e faz o próprio
  review. Quem depende da verificação é só o manypost Cloud.
- Ordem prática: implementar → screencast → resolver a habilitação da conta de negócio → submeter.
  Nunca o contrário.

**Referência do Postiz (`../_ref/postiz-app/libraries/nestjs-libraries/src/integrations/social/`) — consultar SEMPRE antes de escrever cada provider; trecho reconhecivelmente portado leva `// Derived from Postiz (AGPL-3.0): <arquivo>`:**

| Nosso provider | Arquivo de referência | Escopos (Postiz) | API |
|---|---|---|---|
| `facebook` (Página) | `facebook.provider.ts` (887 l.) | `pages_show_list`, `business_management`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement`, `read_insights` | OAuth `facebook.com/v20.0/dialog/oauth` → `graph.facebook.com/v20.0`; **token de página** vindo de `/me/accounts` + `/me/businesses` → `owned_pages`/`client_pages` (é o token da página que publica, não o do usuário); `/photos`, `/videos`, `/video_stories`, `/photo_stories`; maxLength 63206 |
| `instagram` (via Facebook Business) | `instagram.provider.ts` (1096 l.) | `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_manage_comments`, `instagram_manage_insights` | mesmo OAuth do Facebook; conta IG resolvida por `instagram_business_account` na Página; publica em 2 passos **`/media` (container) → poll → `/media_publish?creation_id=`**; carrossel, colaboradores e reels no mesmo fluxo; maxLength 2200 |
| `instagram-standalone` (Instagram Login) | `instagram.standalone.provider.ts` (236 l.) | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights` | `graph.instagram.com/v21.0`, **sem Página do Facebook**; refresh por `grant_type=ig_refresh_token`; mesmo fluxo container→publish (o Postiz reusa o código do provider acima passando o host) |
| ~~`threads`~~ ✅ | `threads.provider.ts` (644 l.) | `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_manage_insights` | **Entregue na onda 11** — `packages/providers/src/threads`. Sobrou: analytics (`threads_insights`), refresh proativo, `quote_post_id`, `topic_tag` |

**O que a nossa arquitetura já tem e o que falta encaixar:**
1. **Sub-contas** (escolher QUAL Página/conta IG conectar): o padrão já existe — `listSubAccounts` + `GET /v1/channels/:id/sub-accounts` + `SubAccountsField` no composer, feitos para o Discord na onda 4. Reusar, não inventar. (O Threads não precisou: uma conexão = uma conta.)
2. **Mídia por URL pública é obrigatória** no Instagram (e já é no Threads): a Meta faz *pull* da URL, não há upload de bytes. Hoje `/uploads` sai por `PUBLIC_URL` (logo, pelo proxy do Next) e o **driver S3/R2 nunca foi escrito** (item 1 das fatias de backend). Em produção isso vira dependência real: avaliar `MEDIA_PUBLIC_URL` (já listado como pendência da onda 10) + storage externo antes de submeter o review. **Em dev isso já morde**: URL de `localhost` é inalcançável pela Meta ⇒ container `ERROR` ("The media could not be fetched from this URI"); para testar publicação com mídia é preciso um túnel HTTPS público.
3. **Container assíncrono**: IG publica em 2 passos com poll de status — o molde agora é o **Threads da onda 11** (`createContainer` → `waitContainer` → `publishContainer`, com orçamento de polls compartilhado e permalink best-effort). O poll do TikTok (onda 6) é o precedente anterior.
4. **`maxConcurrentJob`** casa com o semáforo Redis da onda 7 (`acquireSlot`) — só configurar, o mecanismo existe (o Threads usa `2`).
5. **Refresh proativo (`refreshCron` do Postiz)**: nosso refresh é reativo (401 → `classifyError` → `refresh-token`). Token que expira **sem ser usado** não é alcançado por isso — vale para o Threads (60 dias) e valerá para o IG. Decidir se entra um job diário de renovação ou se aceitamos o `REFRESH_REQUIRED`. **Decisão em aberto.**
6. **Previews**: `network-preview.tsx` precisa de layout para IG (grade quadrada/carrossel) e Facebook — os dois ainda caem no cartão neutro. (Threads já tem o seu, microblog com thread encadeada.)
7. **Postiz tem `instagram` e `instagram-standalone` como providers SEPARADOS** (dois `identifier`), exatamente como fizemos com `discord` × `discord-webhook`. Seguir o mesmo desenho: o standalone não exige Página nem `business_management`, então é o caminho mais curto para o criador BR.

### Matriz de redes — escopo fechado em 2026-07-22

**Toda rede com ícone em `apps/web/public/social` vira provider** (é a mesma matriz do Postiz).
São 18 redes + `Google.svg`, que é login social, não canal — mais **Twitch e Kick**, que o Postiz
tem e entraram na onda 12 (o owner adicionou os ícones). **10 prontas** — 11 providers, porque o
Discord tem dois (Mastodon, Bluesky, Telegram, Discord ×2, LinkedIn, X, TikTok, Threads, Twitch,
Kick) — e **10 na fila** — a ordem, o gate e o esforço
de cada uma estão na tabela nova de [platform-gates.md](platform-gates.md#-escopo-confirmado-toda-rede-com-ícone-em-appswebpublicsocial-vira-provider):
Instagram → Facebook → Dev.to → Slack → YouTube → Pinterest → Reddit → Dribbble → Medium
(+ Google Business Profile fora da onda, fase 3).

Dois pontos ainda exigem **decisão do owner antes de virar código**: (1) **Reddit** — o free tier é
explicitamente não-comercial, então cobrar no Cloud por cima dele viola os termos (só BYO-key
self-hosted, ou buscar o acordo comercial pago); (2) **Medium** — a plataforma **não emite mais
integration token**, então o provider só serviria a quem já tem token antigo. (**Twitch e Kick**
eram o terceiro ponto: o owner decidiu em 2026-07-22 que entram com paridade Postiz mesmo
publicando em chat ao vivo em vez de feed — entregues na onda 12.)

Na UI, as redes da fila aparecem em **Conexões → "Em breve"** (`features/channels/upcoming.ts`),
com o cartão desabilitado; cada uma some da lista sozinha quando o id passa a existir no catálogo
da API. As três em decisão ficam fora dessa lista.

### Backlog do backend (fase 1 — MVP, [SPEC_ROADMAP](../specs/SPEC_ROADMAP.md))

**Fatias entregues** — o que cada uma deixou de fora, que é o backlog real (o detalhe de cada
entrega está no [changelog](CHANGELOG_ONDAS.md)):

| Fatia | Entregue | Ficou de fora (retomar depois) |
|---|---|---|
| Mídia | 2026-07-11 | thumbnail/blurhash, duração+dimensões de vídeo (probe), presigned upload direto (hoje o corpo passa pela API), **driver S3/R2** — necessário para Instagram/Threads, que fazem *pull* da URL |
| Threads no composer | 2026-07-11 | editar texto de réplicas já agendadas (hoje só o item 0 via PATCH) |
| Aprovação por link público | 2026-07-12 | papel `MEMBER` sem poder criar link — a matriz papel×endpoint da [SPEC_API_MCP §6](../specs/SPEC_API_MCP.md) ainda não está aplicada nas rotas de posts |
| Listagens + SSE + retry manual | 2026-07-12 | filtro por tags no feed (tabela existe, falta endpoint), `channel.disconnected` como evento, "próximo slot livre"/`posting_times` |
| Providers onda 1 | 2026-07-15 | **LinkedIn** vídeo e página de empresa (exige parceria Community Management API); **Discord** threads (hoje `threads:false` nos dois modos); **X** upload >4MB nunca exercitado contra a API real; smoke real de LinkedIn/X pendente de credenciais ([INTEGRATIONS_SETUP §3.3/§4.1](INTEGRATIONS_SETUP.md) — X usa o par **OAuth 2.0 Client ID/Secret**, não as Consumer Keys) |
| Semáforo `maxConcurrent` + `/metrics` | 2026-07-18 | tracing OTel (a env já existe, faltam os spans), dashboards Grafana de referência, métrica de créditos de IA, `/metrics` no worker dedicado (`MODE=worker` não sobe HTTP) |
| API pública + servidor MCP | 2026-07-19 | analytics (rota + tool `get_channel_analytics`), **OAuth 2.1 do MCP** (discovery + PKCE + consentimento — hoje só API key com escopo `mcp`), store de sessão MCP externo para escala horizontal, `webhooks/{id}/test` |
| Hosts de máquina (`api.`/`mcp.`) | 2026-07-21 | apontar os DNS e setar as duas envs em produção; `MODE=standalone` não publica os subdomínios (separar `web` e `api` em dois serviços); `/uploads` ainda sai por `PUBLIC_URL` — mover mídia para host próprio exige `MEDIA_PUBLIC_URL` |
| Billing Stripe + `PlanPolicy` | 2026-07-21 | rodar `bun run stripe:sync` com a chave real e criar o webhook (`whsec_`); sub-limite de X da política de uso justo ([PLANS](PLANS.md) PL1) |
| Threads (família Meta) | 2026-07-22 | analytics (`threads_insights`), **refresh proativo** do token de 60 dias, citar post (`quote_post_id`), `topic_tag`, submissão do App Review; smoke real de publicação exige túnel HTTPS (a Meta faz *pull* da mídia) |

**Ainda não começadas:**

1. **IA de criação** — o port `AiProvider` existe; falta o adapter `openai-compatible` em `infra/ai/`,
   créditos (`ai_credits`) e o BudgetGuard (port existe). → [SPEC_AI §2-3](../specs/SPEC_AI.md).
   **Nunca citar provedor nominal fora de `infra/ai`** — o CI barra.
2. **Multi-org** — troca de organização e convite de membros. → [SPEC_API_MCP §6](../specs/SPEC_API_MCP.md).

### Frontend (`apps/web`) — o que a interface já entrega

Next.js (App Router) + Tailwind + primitivas Radix no padrão shadcn, tema inteiro vindo dos tokens do
[brand system](../brand/BRAND_SYSTEM.md), pt-BR via next-intl, cliente gerado do OpenAPI da própria API.
O detalhe de cada onda (1 a 5) está no [changelog](CHANGELOG_ONDAS.md#frontend--detalhe-das-ondas-1-a-5-appsweb).

| Tela | Estado |
|---|---|
| Login / registro / login social | ✅ erros problem+json traduzidos por código estável |
| Onboarding `/boas-vindas` e `/planos` | ✅ somem quando `billingEnabled=false` (self-hosted) |
| **Conexões** | ✅ OAuth em popup, formulário de credenciais gerado do JSON Schema do provider, reconectar/desconectar. Três blocos: **disponíveis**, **"Precisa de credencial"** (rede pronta sem env — self-hosted vê a variável que falta) e **"Em breve"** (roteiro + redes ainda não habilitadas no gerenciado). Cada cartão tem um **ícone "?"** com popover explicando o que a rede publica e como conectá-la, **específico por modo** (self-host mostra o `.env`; nuvem mostra o que já está pronto) — a mesma nota aparece dentro do diálogo de conexão (onda 13) |
| **Calendário** (dia/semana/mês/lista) | ✅ a casa do app: painel de canais, drag para reagendar, "+" por slot vazio |
| **Composer** (modal 2 colunas) | ✅ canais por avatar, texto por canal, settings por canal, mídia, threads, preview ao vivo por rede, agendar/publicar/exigir aprovação |
| **Kanban** | ✅ colunas por estado do grupo; arrastar de Falhou → Agendado dispara retry |
| Detalhe do post | ✅ editar texto/horário/settings, cancelar, retry por canal, ciclo do link de aprovação, progresso de thread |
| Mídia | ✅ dropzone, importar por URL, alt text, exclusão soft |
| Notificações + tempo real | ✅ sino, página, SSE com fallback de polling |
| Configurações | ✅ perfil, API keys (`mp_live_`), webhooks (`whsec_`), bloco "Conectar seu agente" (REST + MCP) |
| Página pública `/approve/{token}` | ✅ sem login, mesmos previews do composer, aprovar / pedir ajustes |

**Próximas fatias:** "próximo slot livre"/`posting_times`, analytics, smoke visual do preview de X/LinkedIn com
canal real. **Follow-up de backend:** redirect pós-callback de OAuth (hoje o popup mostra JSON por um instante);
editar réplicas de thread já agendadas.

**Divergência a resolver na doc:** [BRAND_SYSTEM.md](../brand/BRAND_SYSTEM.md) fala "ManyPost" maiúsculo (§7) e
fonte Degular Display (§5); o CLAUDE.md, o [README do brand](../brand/README.md) e o app usam `manypost`
minúsculo + Plus Jakarta Sans (o que está implementado).

### Processos externos (lead time de semanas — rastreados em [platform-gates.md](platform-gates.md))

Cada plataforma tem seu próprio processo de aprovação, com lead time que não depende do código.
Eles são o caminho crítico da onda 2 de providers — mas **nenhum bloqueia o desenvolvimento**,
só a publicação em produção. Guia passo a passo de cada credencial: [INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md).

- **Meta (Facebook + Instagram + Threads de uma vez)**: App Review + Business Verification, que exige
  pessoa jurídica. O desenvolvimento inteiro cabe no Development Mode, inclusive o screencast que a
  submissão pede — ver [platform-gates.md](platform-gates.md#-meta--o-gate-é-de-entidade-jurídica-não-de-código).
- **TikTok**: provider pronto em sandbox; auditoria da Content Posting API **em revisão** desde
  2026-07-18 (~2–3 semanas). Sem aprovação, os posts saem `SELF_ONLY`. Rejeição na 1ª rodada é comum —
  ler o motivo e reenviar.
- **Pinterest e Reddit**: auditoria obrigatória em 2026, ambas iniciadas.
- **X e YouTube**: tier/quota — no self-hosted cada instância usa a própria chave (BYO-key).

### Escopo futuro — features de produto já decididas, ainda NÃO começar (registrado em 2026-07-18)
- **Serviço de e-mail avançado (Resend)** — notificações transacionais + marketing por e-mail. Casos: **falha de publicação** (hoje só há notificação in-app + evento SSE/webhook — `post.failed`/`channel.refresh_required`; falta o e-mail), **post publicado com sucesso**, digests/marketing, e os alertas de streak (abaixo). Provável desenho: port `EmailSender` no core (agnóstico, como os demais), adapter `infra/email/resend` (env `RESEND_API_KEY`, remetente/domínio verificado), templates versionados; disparo via a mesma outbox/fila dos webhooks (`webhook-delivery` como referência de retries+assinatura). Respeitar `IS_SELF_HOSTED`/opt-out por usuário. Reaproveitar os eventos de domínio já emitidos (`post.published`/`post.failed`/`channel.refresh_required`) como gatilho — o bus já existe.
- **Streak + conquistas (gamificação, retenção/UX)** — o usuário ganha um "foguinho" 🔥 por dia com pelo menos 1 post **publicado com sucesso**; dias consecutivos aumentam a streak, e marcos viram **conquistas/badges**. **Alertar por e-mail quando a streak está prestes a expirar** (não perder o foguinho) — depende do serviço de e-mail acima. Desenho provável: contagem derivada de `publications` PUBLISHED por dia/fuso do usuário (cuidado com timezone — usar o fuso do usuário, como o composer já faz), tabela de streak/conquistas por usuário (ou por org — decidir), job diário que fecha o dia e agenda o alerta de "streak em risco". Superfície no `apps/web` (indicador de foguinho + tela de conquistas). "Simples" mas ótimo para retenção — tratar como feature de produto com sua própria fatia (backend: contagem+streak+conquistas; frontend: indicador+conquistas; e-mail: alerta de risco).

### Fase 2+ (não começar sem pedir)
- IA operacional e governança seguem no monorepo aberto, gateadas por `PlanPolicy` (SPEC_AI §4, PLANS.md §2 — a redação antiga de "código fechado, repo separado" foi superada pelo adendo v1.2). **Billing entregue na onda 9.** Onda 2 de providers (Meta/IG/YT) depende dos gates; **TikTok já implementado (onda 6), aguardando só a auditoria**.

### Billing — como rodar/verificar (onda 9)
```bash
# 1. catálogo na conta Stripe (idempotente; use a chave de TESTE primeiro)
STRIPE_SECRET_KEY=sk_test_... bun run stripe:sync
# 2. webhook em dev (a Stripe não alcança localhost):
stripe listen --forward-to localhost:3100/v1/stripe/webhook   # imprime o whsec_
# 3. .env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, IS_SELF_HOSTED=false, HIDE_BILLING=false
# 4. E2E dos limites (banco isolado — NUNCA o de dev):
BASE_URL=http://localhost:3987 SELF_HOSTED_BASE_URL=http://localhost:3986 bun run scripts/e2e-billing.ts
```

## 5. Como rodar/verificar localmente

```bash
bun install && bun run check          # typecheck (api+web) + 300 testes + fronteiras + grep IA + brand
# E2E (precisa Docker Desktop aberto). ⚠️ Containers PRÓPRIOS, nas portas 5599/6499:
# os antigos mp-pg:5499/mp-redis:6399 são o banco de DEV (o .env aponta p/ eles) — subir uma
# segunda API MODE=all ali faz dois workers com ENCRYPTION_KEY diferentes disputarem a mesma fila
# ("Unsupported state or unable to authenticate data" → FAILED permanente).
docker run -d --name mp-pg-iso -e POSTGRES_PASSWORD=mp -e POSTGRES_USER=mp -e POSTGRES_DB=mp -p 5599:5432 postgres:17-alpine
docker run -d --name mp-redis-iso -p 6499:6379 redis:7-alpine
MODE=all PORT=3987 PUBLIC_URL=http://localhost:3987 DATABASE_URL=postgresql://mp:mp@localhost:5599/mp \
  REDIS_URL=redis://localhost:6499 JWT_SECRET=<32+chars> ENCRYPTION_KEY=<64 hex> \
  DB_MIGRATE=auto PUBLISH_RETRY_BASE_SEC=1 WEBHOOKS_ALLOW_PRIVATE=true \
  IS_SELF_HOSTED=true HIDE_BILLING=true STRIPE_SECRET_KEY= \
  MEDIA_ALLOW_PRIVATE_URLS=true UPLOAD_DIR=./.e2e-uploads bun run apps/api/src/main.ts &
BASE_URL=http://localhost:3987 bun run scripts/e2e-auth.ts
BASE_URL=http://localhost:3987 bun run scripts/e2e-publish.ts
BASE_URL=http://localhost:3987 bun run scripts/e2e-public.ts   # API pública: escopos, rate-limit, idempotência
BASE_URL=http://localhost:3987 bun run scripts/e2e-mcp.ts      # servidor MCP: initialize→tools/call (precisa Redis)
docker rm -f mp-pg-iso mp-redis-iso                            # e derrube ao terminar
```

> As envs `IS_SELF_HOSTED=true HIDE_BILLING=true STRIPE_SECRET_KEY=` são obrigatórias localmente:
> o `.env` do dev roda em modo Cloud, e com billing ligado o E2E leva **402** ao criar API key
> (o CI não tem `.env`, então lá o padrão já é self-hosted).

Bun fica em `~/.bun/bin` (adicione ao PATH se o shell não achar). Um passo a passo sem tecniquês,
usando só Docker, está em [TESTING.md](../../TESTING.md).

> **Antes de propor mudança de arquitetura:** as decisões estruturais já estão congeladas em
> [DECISIONS.md](DECISIONS.md) (v1 + adendos v1.1 e v1.2). Leia antes — cada item traz o porquê,
> e re-litigar decisão fechada custa tempo de todo mundo.

---

**Navegação:** [Índice da documentação](../README.md) · [Histórico das ondas](CHANGELOG_ONDAS.md) ·
[Decisões](DECISIONS.md) · [Planos](PLANS.md) · [Gates das plataformas](platform-gates.md) ·
[Setup das redes](INTEGRATIONS_SETUP.md) · [Specs técnicas](../specs/) · [README do projeto](../../README.md)
