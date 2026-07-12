# STATUS.md — estado da aplicação e handoff para a próxima sessão

> **Para o agente de IA que pegar este projeto:** leia este arquivo + `CLAUDE.md` (raiz) antes de qualquer coisa. Ele diz o que JÁ FUNCIONA (com prova), o que falta (com referência à spec de cada item) e onde tirar dúvidas. Atualize este arquivo ao fim de cada fatia entregue.
>
> **Última atualização:** 2026-07-12 (fatias de aprovação por link público e listagens/SSE/retry) · branch `main`.

## 1. O que é o projeto (30 segundos)

**manypost** (wordmark sempre minúsculo): agendador/publicador multicanal de posts, núcleo **AGPL-3.0 derivado do Postiz** — reimplementação em Bun/TS + Hono + Drizzle/Postgres + pg-boss + Redis + Next.js. Modelo open-core: núcleo aberto self-hostable; IA operacional/governança/billing são **código fechado em repo separado** (`manypost-premium`, ainda não criado). Decisões congeladas em [DECISIONS.md](DECISIONS.md) (v1 + adendo v1.1) — **não re-litigar**.

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
| **Providers** | **Mastodon (real!)**: registro dinâmico de app por instância, OAuth, publish com thread via `in_reply_to_id`, idempotency-key nativo, **mídia via `/api/v2/media`** (202 → poll até processar, `media_ids` no status, `description`=alt). **Fake**: simula sucesso/transient/401/rejeição p/ dev e E2E | SPEC_INTEGRATIONS | `packages/providers/src/{mastodon,fake}` |
| **Mídia** ⭐ | Upload multipart (`POST /v1/media/upload`) com **MIME real por magic bytes** (JPEG/PNG/GIF/WebP/MP4/MOV/WebM, nunca confia no cliente) + dimensões de imagem lidas do header; `POST /v1/media/from-url` (anti-SSRF com re-validação por salto de redirect + teto de bytes no streaming); `GET /v1/media`, `PATCH :id` (alt), `DELETE :id` (soft — arquivo fica p/ posts agendados); arquivos servidos públicos em `/uploads/:org/:file` (chaves UUID); storage local (`UPLOAD_DIR`), port `MediaStorage` pronto p/ S3/R2; `POST /v1/posts` aceita `mediaIds` → refs com URL pública+MIME no content, validadas por canal via `provider.validateMedia` (helper `checkMediaRules` compartilhado: contagem, mistura imagem/vídeo, MIME) | SPEC_API_MCP §3, SPEC_DATA §3, SPEC_INTEGRATIONS §2 | `use-cases/media.ts`, `infra/media/sniff.ts`, `media.routes.ts`, `providers/src/shared/media-rules.ts` |

| **Threads** ⭐ | `POST /v1/posts` aceita `thread: [{text, mediaIds?, delaySec?}]` (réplicas após o post principal, até 24, delay 0–600s). Publicação item a item com **cursor `lastPublishedIndex`** — retry retoma do cursor e **nunca reposta** item confirmado (SPEC_QUEUE §7); delay entre itens = job `publish-thread-item` durável (§9), continuação com fencing triplo (estado PUBLISHING + jobVersion + cursor exato); item que falha aponta `item N da thread` no errorMessage; `itemCount`/`lastPublishedIndex` expostos no GET | SPEC_QUEUE §7/§9 | `makeContinueThread` em `use-cases/publishing.ts`, `publication_items` |
| **Providers** (2) | `publishReply` no contrato (com settings); Mastodon responde via `in_reply_to_id`; fake simula réplicas com falha injetável (`failFirstReplyAttempts`) | SPEC_INTEGRATIONS §2 | idem |
| **Aprovação por link** ⭐ | `POST /v1/posts` com `requireApproval: true` → grupo/publicações nascem `DRAFT` sem job. `POST/GET/DELETE /v1/posts/:groupId/approval-link` (token 256 bits, só sha256 no banco, expira em 7 dias — configurável 1–720h; criar de novo revoga o anterior). Superfície pública **sem login** `/public/approval/:token`: `GET` preview por canal (conteúdo/mídia/horário, zero ids internos), `POST .../approve` **agenda de verdade** (DRAFT→SCHEDULED + jobs), `POST .../request-changes` (feedback obrigatório) mantém rascunho. 404 uniforme (inválido/expirado/revogado), idempotente (2ª chamada devolve o resolvido), rate-limit Redis por IP+token (30 e 10/min), `audit_log` com `actor_type=PUBLIC_LINK`, notificação p/ equipe (`GET /v1/notifications`) | DECISIONS v1.1 §12, SPEC_API_MCP §3, SPEC_FRONTEND §3.6 | `use-cases/approvals.ts`, `approvals-public.routes.ts`, `approvals.repo.ts`, `platform.repo.ts` |

| **Listagens** ⭐ | `GET /v1/publications?from&to&state&channelId&cursor&limit` — feed flat p/ calendário/kanban (cliente agrupa por `groupId`), cada item embute grupo (`state`, `origin`, **`awaitingApproval`** = link PENDING não expirado) e canal (provider/nome/handle/avatar); keyset pagination por `(publishAt, id)` com `nextCursor`; filtros csv validados (inválido → 400 `validation.invalid_request`, novo mapeamento ZodError→400 no error handler) | SPEC_FRONTEND §3.1-3.2, SPEC_API_MCP §3 | `publications.routes.ts`, `listPublicationsFeed` |
| **SSE** ⭐ | `GET /v1/events` (auth cookie/Bearer): eventos nomeados `post.scheduled`/`post.published`/`post.failed`/`channel.refresh_required`/`notification.created` + `hello`/`ping` keepalive 25s. Transporte: Redis pub/sub (`mp:rt:{orgId}`) — worker publica, API assina; **assina antes do hello** (sem janela de perda); sem Redis = stream só de keepalive (fallback = polling da UI). `makeEmitEvent` ecoa todo evento de domínio no bus (inscrito ou não em webhook), melhor esforço | SPEC_FRONTEND §4 | `events.routes.ts`, `redis-realtime-bus.ts`, port `RealtimePublisher/Subscriber` |
| **Retry manual** | `POST /v1/posts/:groupId/retry` (body `channelId?` = por canal) — kanban "tentar novamente": FAILED **e NEEDS_REVIEW** (ação humana explícita — DECISIONS §7 só proíbe repost automático) → SCHEDULED com tentativas zeradas, `job_version` novo (job antigo morre) e publicação imediata | SPEC_API_MCP §3, SPEC_FRONTEND §3.2 | `makeRetryPost` |
| **Notificações** | `GET /v1/notifications` + `POST /:id/read` (idempotente) + `POST /read-all`; `post.scheduled` agora é emitido como webhook/SSE no agendar e no aprovar (não em rascunho) | SPEC_API_MCP §4, SPEC_FRONTEND §4 | `notifications.routes.ts`, `platform.repo.ts` |

**Provas:** 97 testes unit (`bun test`) + `scripts/e2e-auth.ts` (21 checks) + `scripts/e2e-publish.ts` (106 checks: aprovação sem login, SSE de ponta a ponta worker→Redis→stream, feed com cursor, retry até publicar, notificações lidas) — CI roda tudo com services postgres+redis.

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

## 4. O QUE FALTA — em ordem sugerida, com referências

### Próximas fatias do backend (fase 1 — MVP, SPEC_ROADMAP)
1. ~~Mídia~~ ✅ (2026-07-11). Ficou de fora (aceitável p/ MVP, retomar depois): thumbnail/blurhash, duração+dimensões de vídeo (probe), presigned upload direto (hoje o corpo passa pela API), driver S3/R2 (necessário p/ Instagram na onda 2 — mídia via URL pública já funciona com o storage local + PUBLIC_URL).
2. ~~Threads no composer~~ ✅ (2026-07-11). Ficou de fora (retomar depois): editar texto de réplicas já agendadas (hoje só o item 0 via PATCH), `publishReply` nos providers da onda 1 conforme forem chegando.
3. ~~Aprovação por link público~~ ✅ (2026-07-12). Ficou de fora (retomar depois): página pública no web app (SPEC_FRONTEND §3.6 — a API está pronta), marcar notificação como lida (vem com a fatia de listagens/SSE), papel `MEMBER` sem poder criar link (matriz papel×endpoint da SPEC_API_MCP §6 ainda não aplicada nas rotas de posts).
4. ~~Listagens + SSE~~ ✅ (2026-07-12), incluindo retry manual e notificações lidas. Ficou de fora (retomar depois): filtro por tags no feed (tabela existe, sem endpoint de tags ainda), `channel.disconnected` como evento (webhook/SSE) no disconnect, "próximo slot livre"/`posting_times` (vem com o MCP `find_free_slot`).
5. **Providers onda 1 restantes**: Bluesky (app password), Telegram (bot), Discord, LinkedIn, X. Suíte de contrato em `packages/providers/test-kit` (README define; implementar). → SPEC_INTEGRATIONS §4/§7, guia de credenciais em [INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md). Postiz ref: `libraries/nestjs-libraries/src/integrations/social/*.provider.ts`.
6. **Semáforo maxConcurrent** por provider (Redis) + métricas Prometheus `/metrics` + OTel. → SPEC_QUEUE §6, SPEC_INFRA §4.
7. **API pública `/public/v1`** (paths com escopos por API key — middleware pronto) + **MCP server** (`@modelcontextprotocol/sdk`, tools = use-cases). → SPEC_API_MCP §3/§5.
8. **IA de criação**: port `AiProvider` existe; implementar adapter `openai-compatible` em `infra/ai/`, créditos (`ai_credits`) + BudgetGuard (port existe). → SPEC_AI §2-3; NUNCA citar provedor fora de `infra/ai` (CI barra).
9. Multi-org: troca de organização, convites de membros. → SPEC_API_MCP §6.

### Frontend (fase 1 — ainda não iniciado)
- `apps/web` é só um README. Scaffold Next.js + shadcn/ui + cliente OpenAPI gerado de `/openapi.json`. **OBRIGATÓRIO seguir [brand/BRAND_SYSTEM.md](brand/BRAND_SYSTEM.md)** (zero sombras, tokens, light-only, wordmark minúsculo) + [brand/README.md](brand/README.md) (adaptação p/ app, tokens `--state-*` aprovados). Telas: login (com botões sociais via `GET /v1/auth/social`), conexões, composer, calendário, kanban. → SPEC_FRONTEND inteira.

### Processos externos (URGENTE — lead time de semanas, rastrear em [platform-gates.md](platform-gates.md))
- Abrir App Review Meta, auditoria TikTok, tier do X, quota YouTube (guia leigo: [INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md)).
- **P1**: parecer jurídico da licença de `@manypost/contracts` (DECISIONS §1c) — até lá, não publicar no npm.

### Fase 2+ (não começar sem pedir)
- IA operacional, governança, billing = **código fechado, repo separado** (SPEC_AI §4, PLANS.md §2). Onda 2 de providers (Meta/IG/TikTok/YT) depende dos gates.

## 5. Como rodar/verificar localmente

```bash
bun install && bun run check          # typecheck + 97 testes + fronteiras + grep IA
# E2E (precisa Docker Desktop aberto):
docker run -d --name mp-pg -e POSTGRES_PASSWORD=mp -e POSTGRES_USER=mp -e POSTGRES_DB=mp -p 5499:5432 postgres:17-alpine
docker run -d --name mp-redis -p 6399:6379 redis:7-alpine
MODE=all PORT=3988 PUBLIC_URL=http://localhost:3988 DATABASE_URL=postgresql://mp:mp@localhost:5499/mp \
  REDIS_URL=redis://localhost:6399 JWT_SECRET=<32+chars> ENCRYPTION_KEY=<64 hex> \
  DB_MIGRATE=auto PUBLISH_RETRY_BASE_SEC=1 WEBHOOKS_ALLOW_PRIVATE=true \
  MEDIA_ALLOW_PRIVATE_URLS=true UPLOAD_DIR=./.e2e-uploads bun run apps/api/src/main.ts &
BASE_URL=http://localhost:3988 bun run scripts/e2e-auth.ts
BASE_URL=http://localhost:3988 bun run scripts/e2e-publish.ts
```

Bun está em `~/.bun/bin` (adicione ao PATH se o shell não achar). O usuário (owner) fala pt-BR, decide por itens numerados e já congelou as decisões — consulte DECISIONS.md antes de propor mudanças de arquitetura.
