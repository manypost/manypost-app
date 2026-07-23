# Mapa do repositório

Este mapa responde ownership, dependências e impacto por diretório.

## Raiz

| Caminho | Papel e arquivos principais | Dependências/consumidores | Riscos e como alterar |
| --- | --- | --- | --- |
| `package.json` | workspaces e scripts canônicos | todos os packages, CI e Docker | Bun somente; valide lock congelado e todos os scripts afetados |
| `bun.lock` | grafo gerado de dependências | Bun/CI/Docker | não editar manualmente |
| `tsconfig.json` | aliases/workspace TypeScript | apps e packages | mudança impacta typecheck global |
| `.dependency-cruiser.cjs` | fronteiras executáveis | `check:boundaries`, CI | mudança de regra exige design e prova de que não mascara violação |
| `.env.example` | catálogo de configuração sem secrets | config, dev e operadores | mantenha sincronizado com `packages/config`; nunca copie valor real |
| `AGENTS.md` | contrato de contribuição | humanos/agentes | atualize junto com processo/arquitetura |
| `CHANGELOG.md` | impacto de releases/manutenção | usuários/dev/operação | entrada por impacto, não lista de commits |

Comandos raiz mais usados: `bun install --frozen-lockfile`, `bun run dev:all`,
`bun run check`, `bun run db:check`, `bun run build:web`,
`bun run spec:validate`.

## `apps/api`

**Responsabilidade:** adaptar HTTP/MCP, montar dependências e iniciar o backend.

| Área | Entradas/arquivos | Dependências | Consumidores |
| --- | --- | --- | --- |
| bootstrap | `src/main.ts`, `src/container.ts` | todos os packages e env | Bun/Docker/Railway |
| superfícies | `src/http/surfaces.ts` | config, Hono | app/API/MCP hosts |
| middleware | `src/http/middleware/` | auth, metrics, errors | todas as rotas |
| rotas | `src/http/routes/*.routes.ts` | use cases, OpenAPI | web e clientes |
| API pública | `src/http/routes/public/` | scopes, idempotência, rate limit | automações |
| MCP | `src/mcp/mcp-server.ts`, `mcp.routes.ts` | SDK e mesmos use cases | agentes |
| auth/identity | `src/infra/auth/`, `src/infra/identity/` | core ports | rotas e container |
| billing | `src/infra/billing/stripe.gateway.ts` | Stripe | use cases de billing |
| storage | `src/infra/storage/local.storage.ts` | filesystem | mídia/uploads |
| métricas | `src/infra/metrics/` | runtime/API | `/metrics`, logs |

**Riscos:** `main.ts` é composition root amplo; importá-lo em teste executa
bootstrap. Roteamento depende de host e pode expor superfície errada se envs
coincidirem. Rotas devem reaproveitar use cases e registrar OpenAPI real.

**Alteração:** teste middleware/route isolado; valide auth e organização;
regere OpenAPI quando o contrato mudar. Execute `bun run check` e E2E da
superfície.

## `apps/web`

**Responsabilidade:** experiência web, sessão same-origin e apresentação dos
recursos da API.

| Área | Entradas/arquivos | Dependências | Consumidores |
| --- | --- | --- | --- |
| App Router | `src/app/layout.tsx`, `src/app/**/page.tsx` | Next/React | browser |
| auth/onboarding | `src/features/auth/`, route groups | cliente API | usuário |
| calendário/kanban | `src/features/calendar/`, `kanban/` | queries/publicações | usuário |
| composer | `src/features/composer/` | TipTap, providers catalog | usuário/aprovação |
| canais | `src/features/channels/` | OAuth/fields/catalog | usuário |
| mídia | `src/features/media/` | upload/import API | usuário/composer |
| realtime | `src/features/realtime/` | EventSource, Query Client | shell autenticado |
| cliente API | `src/lib/api/client.ts`, `schema.d.ts` | openapi-fetch | todas as features |
| i18n | `src/messages/pt-BR.json`, `src/i18n/` | next-intl | toda a UI |
| design system | `src/components/ui/`, `brand/`, `globals.css` | Tailwind/tokens | features |
| proxy | `next.config.ts`, `src/proxy.ts` | API URL/cookies | browser |

**Gerados:** `openapi.json` e `src/lib/api/schema.d.ts` por
`API_URL=http://localhost:3100 bun run --cwd apps/web generate:api`.
`next-env.d.ts` e `.next/` são controlados pelo Next; não inclua alteração
incidental do build sem revisar.

**Riscos:** componentes grandes concentram regras visuais; EventSource não usa o
cliente OpenAPI; middleware depende do marcador `mp_session`; rewrites
preservam paths de cookie.

**Alteração:** leia `docs/brand/BRAND_SYSTEM.md`; mantenha feature por domínio,
use o cliente tipado, atualize mensagens e execute `bun run check`,
`bun run check:brand` e `bun run build:web`.

## `apps/worker`

**Responsabilidade:** entrada dedicada para o runtime assíncrono.

- Entrada: `src/main.ts`.
- Dependências: config, db, core crypto, providers e queue.
- Consumidores: Docker em `MODE=worker`/`standalone`.
- Riscos: precisa do mesmo keyring e provider secrets usados pela API; duas
  versões/chaves diferentes consumindo a mesma fila podem corromper recovery.
- Alteração: valide migrations, startup/shutdown e jobs reais contra
  PostgreSQL/Redis isolados.

## `packages/contracts`

**Responsabilidade:** shared kernel sem lógica de negócio.

- Arquivos principais: `src/enums.ts`, `events.ts`, `providers.ts`,
  `billing.ts`, `errors.ts`.
- Dependências: apenas runtime/types permitidos.
- Consumidores: core, API, web via OpenAPI indireto, db e providers.
- Risco: uma enum/string é contrato público ou persistido.
- Alteração: preserve compatibilidade, atualize todos os switches/adapters e
  teste serialização. O package possui licença/atribuição própria protegida.

## `packages/config`

**Responsabilidade:** validar ambiente e derivar hosts/endpoints/secrets de
provider.

- Entrada: `src/env.ts`; exportações em `src/index.ts`.
- Consumidores: API, worker, scripts.
- Riscos: refine de hosts muda roteamento; default inseguro pode alcançar
  produção; schema aceita `s3` embora adapter não exista.
- Alteração: adicione teste de valor ausente/inválido/default, atualize
  `.env.example` e documentação, sem valores reais.

## `packages/core`

**Responsabilidade:** domínio, casos de uso, ports e infraestrutura
compartilhada que não depende de adapters.

| Área | Papel | Exemplos |
| --- | --- | --- |
| `src/domain/` | estados e regras puras | `publishing/publication-state.ts`, `shared/result.ts` |
| `src/application/use-cases/` | orquestração de negócio | auth, channels, publishing, media, webhooks, billing |
| `src/application/ports/` | interfaces de saída | repositories, providers, jobs, events, crypto |
| `src/infra/crypto/` | AES-GCM e helpers | `aes-gcm.service.ts` |
| `src/infra/media/` | detecção por conteúdo | `sniff.ts` |

- Dependências: contracts e bibliotecas permitidas; nunca apps/db/providers.
- Consumidores: API, worker e testes/fakes.
- Riscos: publicação combina estado persistido com efeitos externos; falha
  parcial e concorrência precisam ser modeladas. `src/infra` é exceção ao core
  puramente de domínio.
- Alteração: teste o caso de uso com ports fake, mantenha regra fora do adapter,
  depois atualize implementações e E2E.

## `packages/db`

**Responsabilidade:** schema/migrations/repositories PostgreSQL.

- Entradas: `src/index.ts`, `src/migrate.ts`, `drizzle.config.ts`.
- Schema: `src/schema/{identity,channels,content,platform,billing}.ts`.
- Repositories: identidade, canais, publicação, mídia, aprovação, webhook,
  platform e billing.
- Consumidores: API/worker/core ports.
- Riscos: isolamento por organização; updates condicionais; migrations
  automáticas; tabelas filhas sem `org_id`; dados cifrados.
- Comandos: `bun run --cwd packages/db generate`, `migrate`, `check`.
- Alteração: siga obrigatoriamente `packages/db/AGENTS.md`; nunca reescreva
  migration aplicada ou metadata à mão.

## `packages/providers`

**Responsabilidade:** traduzir o port social para APIs externas.

- Registry: `src/index.ts`.
- Adapters: uma pasta por Mastodon, Telegram, Bluesky, Discord, LinkedIn, X,
  TikTok, Threads, Instagram, Facebook, Twitch e Kick.
- Compartilhado: `src/shared/`; contrato de teste em `test-kit/`; fake em
  `src/fake/`.
- Dependências: contracts e HTTP injetado; sem banco/route handler.
- Consumidores: API e worker.
- Riscos: API/escopo muda fora do repositório; chamada pode ter criado conteúdo
  antes de falhar; tokens e App Review.
- Alteração: siga `packages/providers/AGENTS.md`, use fake HTTP e atualize
  registry/env/catálogo/UI quando capabilities mudarem.

## `packages/queue`

**Responsabilidade:** infraestrutura assíncrona e coordenação opcional.

| Arquivo | Papel |
| --- | --- |
| `src/runtime.ts` | pg-boss, handlers, cron e composição de publish/webhook |
| `src/redis-rate-limiter.ts` | janela e semáforo atômicos |
| `src/redis-idempotency.ts` | claim/replay da API pública |
| `src/redis-realtime-bus.ts` | pub/sub por organização |
| `src/index.ts` | API pública do package |

- Dependências: core ports/use cases, PostgreSQL e Redis.
- Consumidores: API/worker.
- Riscos: capturar erro pode remover retry; duplicidade de job; diferença de
  comportamento sem Redis; shutdown de múltiplos clientes.
- Alteração: teste com pg-boss/Redis isolados para semântica real, além de unit
  tests. Defina explicitamente retry/idempotência/recovery.

## `scripts`

**Responsabilidade:** verificações, E2E e operação explícita.

- Qualidade: `check-ai-providers.ts`, `check-brand.ts`.
- Desenvolvimento: `dev-all.ts`, `demo.ts`.
- E2E: `e2e-auth.ts`, `e2e-publish.ts`, `e2e-public.ts`, `e2e-mcp.ts`,
  `e2e-billing.ts`.
- Operação externa: `stripe-sync.ts`, `stripe-webhook.ts`,
  `connect-and-post.ts`, `live-telegram.ts`.

Scripts E2E podem criar/apagar dados e devem usar banco descartável. Scripts
live/Stripe exigem autoridade e secrets do operador; nunca os rode como
validação automática ou mostre seus valores.

## `docs`

| Área | Natureza | Regra |
| --- | --- | --- |
| `architecture/` | canônico do código vigente | atualizar com arquitetura/fluxo |
| `operations/` | recipes vigentes | comandos precisam ser executáveis |
| `audits/` | fotografia datada | não tratar hipótese como regra |
| `brand/` | normativo para UI | CI verifica tokens/restrições |
| `principal/` | estado, decisões e história | pode conter números/topologia antigos |
| `specs/` | specs anteriores ao OpenSpec | preservar; migrar gradualmente |
| `references for postiz/` | referência histórica/visual | não renomear como branding |
| `superpowers/plans/` | planos de execução | registrar conclusão, não substituir OpenSpec |

`docs/README.md` é o índice humano. Specs vivos novos ficam em
`openspec/specs/` depois do archive.

## `openspec` e `.codex`

- `openspec/config.yaml`: contexto/regras Manypost.
- `openspec/changes/`: mudanças ativas e arquivo.
- `openspec/specs/`: comportamento vivo após archive.
- `.codex/skills/openspec-*`: workflows gerados pelo CLI.

Use `bun run spec:validate`; não edite skills gerados. Consulte
`docs/openspec.md`.

## Infraestrutura e automação

| Caminho | Papel | Risco |
| --- | --- | --- |
| `docker/Dockerfile` | imagem única e start por `MODE` | shell multi-processo, build precisa ser bloqueante |
| `compose.yaml` | backend + PostgreSQL + Redis de teste | credenciais públicas locais; não produção |
| `docker/docker-compose.yml` | variante self-host | pode divergir do compose raiz |
| `railway.toml` | configuração efetiva Railway | health e Dockerfile |
| `railway.json` | configuração alternativa/histórica | duplicação, não efetiva hoje |
| `railpack.json` | build/start Railpack alternativo | duplicação, não efetiva hoje |
| `.github/workflows/ci.yml` | gates e E2E | deve espelhar validação local |
| `.github/pull_request_template.md` | evidência de revisão | não marcar comando não executado |

Antes de alterar deploy, teste todos os modos impactados e registre rollback.
Na Railway, mudanças de variável, domínio, volume ou serviço são ações externas
e exigem alvo exato; consultas de diagnóstico não autorizam mutação.

## Assets e referências

- `apps/web/public/`: assets servidos pelo Next.
- `docs/brand/logo.png` e artefatos de marca: identidade atual.
- binários/imagens de referência não devem ser recompactados por uma mudança de
  documentação.
- licenças e atribuições na raiz/packages são material legal protegido.
