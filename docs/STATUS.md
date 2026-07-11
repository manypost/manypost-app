# STATUS.md — estado da aplicação e handoff para a próxima sessão

> **Para o agente de IA que pegar este projeto:** leia este arquivo + `CLAUDE.md` (raiz) antes de qualquer coisa. Ele diz o que JÁ FUNCIONA (com prova), o que falta (com referência à spec de cada item) e onde tirar dúvidas. Atualize este arquivo ao fim de cada fatia entregue.
>
> **Última atualização:** 2026-07-11 · branch `main` · último commit da série fase 0/1.

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
| **Providers** | **Mastodon (real!)**: registro dinâmico de app por instância, OAuth, publish com thread via `in_reply_to_id`, idempotency-key nativo. **Fake**: simula sucesso/transient/401/rejeição p/ dev e E2E | SPEC_INTEGRATIONS | `packages/providers/src/{mastodon,fake}` |

**Provas:** 47 testes unit (`bun test`) + `scripts/e2e-auth.ts` (21 checks) + `scripts/e2e-publish.ts` (32 checks) — CI roda tudo com services postgres+redis.

## 3. Decisões de implementação que você precisa saber (além das specs)

1. **Enqueue é pós-commit** (não na mesma tx — API do pg-boss v10 não expõe executor): a linha `publications` é a fonte de verdade; scanner+fencing cobrem. Nota na SPEC_QUEUE §5.
2. **Fencing duplo** no handler: por estado (UPDATE condicional `WHERE state IN (...)`) e por `job_version` (payload `{publicationId, v}`; job de versão antiga = no-op). É isso que torna cancel/edit seguros.
3. **AAD da criptografia** de canal = `orgId:provider:externalId` (chave natural — id não existe antes do insert); de webhook = `webhook:orgId`.
4. **Settings de publish** = merge `{...channel.settings, ...publication.settings}` — é assim que o Mastodon recebe a `instance`.
5. **maxConcurrent** dos providers ainda NÃO é aplicado (só janelas). Semáforo Redis é pendência (§4).
6. Retry de fila (pg-boss `retryLimit`) = 0 de propósito: retry de negócio é da máquina de estados.
7. Composition root em `apps/api/src/container.ts` (sem framework de DI); worker dedicado espelha em `apps/worker/src/main.ts`; `MODE=all` roda api+worker num processo.
8. `cancelBySingletonKey` toca `pgboss.job` via SQL (best-effort; higiene) — se o schema do pg-boss mudar, só perde a higiene, nunca a corretude.

## 4. O QUE FALTA — em ordem sugerida, com referências

### Próximas fatias do backend (fase 1 — MVP, SPEC_ROADMAP)
1. **Mídia**: upload (presigned/local), tabela `media` já existe; validação por provider (`validateMedia` é stub); Mastodon `/api/v2/media`. → SPEC_DATA §3, SPEC_INTEGRATIONS §2. Postiz ref: `libraries/nestjs-libraries/src/upload/*`.
2. **Threads no composer** (backend já suporta `publication_items`; expor no POST /v1/posts) + delay entre itens. → SPEC_QUEUE §9.
3. **Aprovação por link público** (`approval_links` já criada no schema): token+preview+approve/request-changes. → DECISIONS v1.1 §12, SPEC_API_MCP §3, SPEC_FRONTEND §3.6.
4. **Listagens**: `GET /v1/publications?from&to&state` (calendário/kanban) + SSE `/v1/events`. → SPEC_FRONTEND §3.1-3.2.
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
bun install && bun run check          # typecheck + 47 testes + fronteiras + grep IA
# E2E (precisa Docker Desktop aberto):
docker run -d --name mp-pg -e POSTGRES_PASSWORD=mp -e POSTGRES_USER=mp -e POSTGRES_DB=mp -p 5499:5432 postgres:17-alpine
docker run -d --name mp-redis -p 6399:6379 redis:7-alpine
MODE=all PORT=3988 PUBLIC_URL=http://localhost:3988 DATABASE_URL=postgresql://mp:mp@localhost:5499/mp \
  REDIS_URL=redis://localhost:6399 JWT_SECRET=<32+chars> ENCRYPTION_KEY=<64 hex> \
  DB_MIGRATE=auto PUBLISH_RETRY_BASE_SEC=1 WEBHOOKS_ALLOW_PRIVATE=true bun run apps/api/src/main.ts &
BASE_URL=http://localhost:3988 bun run scripts/e2e-auth.ts
BASE_URL=http://localhost:3988 bun run scripts/e2e-publish.ts
```

Bun está em `~/.bun/bin` (adicione ao PATH se o shell não achar). O usuário (owner) fala pt-BR, decide por itens numerados e já congelou as decisões — consulte DECISIONS.md antes de propor mudanças de arquitetura.
