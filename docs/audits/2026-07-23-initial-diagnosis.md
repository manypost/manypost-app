# Diagnóstico inicial da codebase — 2026-07-23

## Escopo e método

Este documento registra o estado observado antes da primeira alteração na
codebase. A análise combinou leitura de código e configuração, execução local
dos comandos existentes, busca textual, Semgrep OSS, `bun audit` e consultas
somente leitura ao projeto Railway `manypost`
(`e1e95da7-8df9-4e16-8075-7adefa113572`).

Nenhum valor de segredo foi lido ou copiado para este relatório. Os achados
sobre produção usam apenas nomes de variáveis, topologia, estado, métricas
agregadas e mensagens de erro.

## Estado do repositório

- Branch inicial: `main`.
- Commit inicial: `aa382e85edceb57a3e35959d762c26e7fd971a82`.
- Sincronização: `main` e `origin/main` estavam sem divergência (`0 0`).
- Worktree inicial: limpo.
- Repositório remoto: `manypost/manypost-app`.
- Branch de trabalho: `chore/maintenance-baseline-openspec`.
- Identidade Git configurada no ambiente:
  `Guilehrme <c0mbedforn1ght@gmail.com>`.
- Linguagem predominante: TypeScript (`187` arquivos `.ts`, `86` `.tsx`,
  aproximadamente 42,5 mil linhas).
- Runtime e gerenciador obrigatório já adotado pelo projeto: Bun.
- Versões do ambiente de diagnóstico: Bun `1.3.14`, Node.js `24.18.0`.
- OpenSpec não existia no repositório no início da análise.

## Árvore funcional

```text
manypost-app/
├── apps/
│   ├── api/       API HTTP, MCP, OpenAPI, autenticação e composition root
│   ├── web/       interface Next.js e cliente OpenAPI
│   └── worker/    processo dedicado para filas
├── packages/
│   ├── config/    validação Zod de ambiente e hosts
│   ├── contracts/ tipos, enums e eventos compartilhados
│   ├── core/      regras de domínio, casos de uso, ports e parte da infraestrutura
│   ├── db/        schema Drizzle, migrations e repositories PostgreSQL
│   ├── providers/ adaptadores de redes sociais
│   └── queue/     pg-boss, Redis e runtime assíncrono
├── docs/          especificações e documentação histórica
├── docker/        imagem e compose de self-hosting
├── scripts/       verificações e utilitários operacionais
└── .github/       CI, templates e automação do repositório
```

Diretórios gerados ou locais encontrados durante a análise, como
`node_modules/` e `apps/web/.next/`, são ignorados pelo Git e não fazem parte da
arquitetura versionada.

## Stack e ferramentas

| Área | Tecnologia confirmada | Evidência principal |
| --- | --- | --- |
| Runtime | Bun >= 1.2 | `package.json` |
| API | Hono, `@hono/zod-openapi`, Scalar | `apps/api/src/main.ts`, `apps/api/src/http/openapi.ts` |
| Web | Next.js 16, React 19, App Router, Tailwind 4 | `apps/web/package.json`, `apps/web/src/app/` |
| Estado web | TanStack Query, Zustand | `apps/web/package.json`, `apps/web/src/` |
| Editor | TipTap | `apps/web/src/features/composer/editor.tsx` |
| Banco | PostgreSQL, Drizzle ORM/Kit | `packages/db/` |
| Filas | pg-boss no PostgreSQL | `packages/queue/src/runtime.ts` |
| Coordenação | Redis para rate limit, idempotência e realtime | `packages/queue/src/` |
| Contratos | OpenAPI gerado pela API e cliente tipado | `apps/web/openapi.json`, `apps/web/src/lib/api/schema.d.ts` |
| Testes | `bun:test` e scripts E2E HTTP | arquivos `*.test.ts`, `scripts/e2e-*.ts` |
| Limites | dependency-cruiser | `.dependency-cruiser.cjs` |
| Deploy | Railway com Dockerfile | `railway.toml`, `docker/Dockerfile` |

Não há ferramenta de lint ou formatter configurada. O TypeScript e as
verificações próprias são, hoje, as barreiras estáticas existentes.

## Aplicações, entradas e responsabilidades

### `apps/api`

- Entrada: `apps/api/src/main.ts`.
- Composition root: `apps/api/src/container.ts`.
- Responsabilidades: migrations opcionais no boot, autenticação, organizações,
  canais, posts, publicações, mídia, aprovações, notificações, billing, webhooks,
  API pública, MCP, OpenAPI e métricas Prometheus.
- Superfícies: app, API e MCP são selecionadas por host em
  `apps/api/src/http/surfaces.ts`.
- Dependências internas: consome todos os packages; é a camada que conecta ports
  de `core` às implementações de banco, providers, queue, storage e billing.

### `apps/web`

- Entrada: `apps/web/src/app/layout.tsx`; rotas no App Router em
  `apps/web/src/app/`.
- Responsabilidades: login/registro, onboarding, calendário, composer,
  conexões, kanban, mídia, notificações, planos, configurações e aprovação
  pública.
- Integração: requisições same-origin por `apps/web/src/lib/api/client.ts`;
  rewrites para API e uploads em `apps/web/next.config.ts`.
- Contrato gerado: `apps/web/src/lib/api/schema.d.ts`, derivado de
  `apps/web/openapi.json`.

### `apps/worker`

- Entrada: `apps/worker/src/main.ts`.
- Responsabilidade: iniciar o mesmo runtime de filas usado pelo modo combinado,
  permitindo separação futura do worker.
- Na produção atual não é um serviço Railway separado; `MODE=standalone` inicia
  worker, API e web no container de `manypost-app`.

## Packages e dependências internas

```text
contracts ──────────────────────────────────────────────┐
config ─────────────────────────────────────────────┐   │
core (domain + ports + use cases) ───────────────┐  │   │
db (Drizzle + implementations de repositories) ─┤  │   │
providers (implementações de SocialProvider) ───┤  │   │
queue (pg-boss + Redis) ─────────────────────────┤  │   │
                                                 ▼  ▼   ▼
                                          api / worker
                                                 │
                                                 ▼
                                         web via HTTP/OpenAPI
```

- `packages/contracts`: tipos compartilhados sem efeitos; deve permanecer no
  nível mais baixo.
- `packages/config`: schema Zod de variáveis e regras de hosts.
- `packages/core`: estado de publicação, casos de uso e interfaces. Apesar do
  nome, contém também criptografia e detecção de mídia em `src/infra/`; portanto
  não é um domínio totalmente puro.
- `packages/db`: schema, migrations e adaptadores PostgreSQL.
- `packages/providers`: registry e 13 integrações reais mais provider fake.
- `packages/queue`: execução de publish, continuação de threads, recovery e
  webhook; Redis é opcional para recursos coordenados.

O dependency-cruiser analisou 400 módulos e 1.199 dependências sem violação das
regras atuais.

## Persistência

O schema está dividido em:

- `identity.ts`: usuários, organizações, memberships, identidades sociais,
  sessões e API keys;
- `channels.ts`: canais e tokens criptografados;
- `content.ts`: grupos de posts, publicações, itens de thread, eventos, mídia,
  tags, conjuntos, assinaturas, métricas e aprovações;
- `platform.ts`: webhooks, deliveries, notificações, auditoria, créditos de IA,
  OAuth apps/grants, idempotência e subscriptions.

Há quatro migrations versionadas (`0000` a `0003`) e metadata do Drizzle.
`DB_MIGRATE=auto` aplica migrations no boot sob advisory lock. Nem todas as
tabelas filhas possuem `org_id`; o isolamento delas depende de acesso pelo pai
já escopado. A afirmação histórica de que toda tabela multi-tenant possui
`org_id` não é literalmente verdadeira.

Tabelas atualmente definidas sem consumidor de aplicação confirmado fora do
schema/migration:

- `ai_credits`;
- `oauth_apps` e `oauth_grants`;
- `idempotency_keys` (a idempotência ativa usa Redis);
- `channel_sets`, `signatures` e `channel_metrics`.

Elas não são classificadas como código morto removível: podem representar
reservas de roadmap ou compatibilidade de dados e exigem decisão humana.

## Fluxos de negócio confirmados

### Sessão web

1. As rotas de autenticação criam access JWT de 15 minutos e refresh token de
   30 dias.
2. Cookies `mp_at` e `mp_rt` são HttpOnly; `mp_session` é apenas um marcador
   legível pelo middleware web.
3. O cliente tipado tenta um único refresh deduplicado ao receber 401.
4. A rotação guarda hash atual e anterior para detectar reuso.
5. O realtime faz `GET /v1/auth/me` antes de abrir `EventSource`.

### Agendamento e publicação

1. A API valida organização, canais, provider settings e mídia.
2. O caso de uso cria grupo, publicações e itens em transação.
3. O job é enfileirado após o commit.
4. O worker reivindica publicações por transição condicional de estado.
5. Rate limits e semáforos Redis, quando disponíveis, antecedem o publish.
6. O provider envia o conteúdo à rede externa.
7. O cursor de thread avança depois da confirmação externa.
8. Delays de thread geram jobs duráveis.
9. Recovery periódico reprograma publicações vencidas ou presas.

### Webhook

1. A criação valida plano e resolução pública da URL.
2. Um segredo é gerado, criptografado e exibido uma única vez.
3. Eventos de domínio criam deliveries e jobs.
4. O worker assina o payload e entrega com backoff.
5. O resultado é persistido e refletido no realtime.

### Mídia

1. Upload ou importação remota valida tamanho e tipo por conteúdo.
2. URLs remotas passam pela mesma verificação anti-SSRF usada por webhooks.
3. Redirects são revalidados e o stream tem limite de bytes.
4. O backend ativo salva no volume local; `STORAGE_PROVIDER=s3` é aceito no
   schema, mas ainda não possui implementação.

## Integrações externas

- Redes sociais: Mastodon, Telegram, Bluesky, Discord OAuth, Discord webhook,
  LinkedIn, X, TikTok, Threads, Instagram standalone, Facebook, Twitch e Kick.
- Identidade social: Google e GitHub.
- Billing: Stripe; pode ser ocultado/desabilitado por configuração.
- Automação: MCP SDK e API pública.
- Infraestrutura: PostgreSQL, Redis, Railway e volume local.
- Documentação da API: Scalar carregado via CDN.

IA, S3 e telemetria distribuída aparecem em configuração/documentos, mas não
foram confirmados como implementações funcionais completas.

## Background, filas e cron

- `publish`: publicação inicial.
- `thread`: continuação atrasada de thread.
- `webhook-delivery`: entrega de webhook.
- `recover-scan`: cron a cada minuto para jobs vencidos/presos.

pg-boss oferece persistência no PostgreSQL. Redis adiciona rate limiting,
semáforo, idempotência da API pública e pub/sub SSE. Sem Redis esses recursos
falham de forma aberta onde documentado; o publish continua dependente do
pg-boss.

## Desenvolvimento, testes e validação existentes

| Finalidade | Comando observado |
| --- | --- |
| instalar | `bun install --frozen-lockfile` |
| API dev | `bun run dev` |
| web dev | `bun run dev:web` |
| worker dev | `bun run dev:worker` |
| todos em dev | `bun run dev:all` |
| TypeScript backend/packages | `bun run typecheck` |
| TypeScript web | `bun run typecheck:web` |
| testes | `bun test` |
| arquitetura | `bun run check:boundaries` |
| marca | `bun run check:brand` |
| validação agregada | `bun run check` |
| build web | `bun run --cwd apps/web build` |
| schema Drizzle | `bun run --cwd packages/db check` |

Baseline executado antes das alterações:

- `bun install --frozen-lockfile`: passou, 800 packages.
- `bun run check`: passou.
- `bun test`: 391 testes, 0 falhas, 1.015 assertions, 27 arquivos.
- `bun run --cwd apps/web build`: passou, 14 páginas processadas.
- `bun run --cwd packages/db check`: passou.
- `bun audit`: falhou com 17 avisos (9 altos, 8 moderados).
- Semgrep OSS: 245 arquivos TS/TSX, três áreas sinalizadas para triagem.
- Semgrep Supply Chain via MCP: não executado; a integração respondeu
  `Workspace directory not found`. O impacto é mitigado parcialmente pelo
  `bun audit`; a configuração do scanner deve ser corrigida fora desta entrega.

## CI/CD e deploy

O workflow `.github/workflows/ci.yml` usa Postgres e Redis e executa
typecheck parcial, testes, dependency-cruiser, verificação de providers,
Drizzle e scripts E2E de autenticação, publicação, API pública, MCP e billing.

Lacunas confirmadas:

- Bun está como `latest`;
- instalação não usa `--frozen-lockfile`;
- o job não executa o typecheck web nem `check:brand`;
- o build Next.js não é obrigatório;
- não há validação OpenSpec;
- não há lint/formatter;
- a geração/consistência OpenAPI não possui gate dedicado.

Três fontes parcialmente duplicadas descrevem o deploy:
`railway.toml`, `railway.json` e `railpack.json`. Na produção, o manifesto
efetivo usa `railway.toml` e `docker/Dockerfile`.

Topologia Railway confirmada em `production`:

- `manypost-app`: Dockerfile, `MODE=standalone`, três domínios
  (`app`, `api` e `mcp`), volume `/app/uploads`;
- PostgreSQL 18 com volume;
- Redis 8.2.1 com volume;
- `manypost-lp`: landing page em outro repositório.

Todos os deployments estavam `SUCCESS`. O volume de uploads usava
aproximadamente 0,793 GB de 50 GB. Nas seis horas consultadas, o app usou em
média aproximadamente 0,041 CPU e 0,360 GB de memória, com pico de 0,723 GB.

## Inventário inicial de identidade

A busca case-insensitive por `postiz` encontrou 298 ocorrências em 71 arquivos
versionados. A interface, packages internos, cookies, API keys, domínios
operacionais e projeto Railway já usam Manypost.

Grupos observados:

1. atribuição/licença que deve permanecer;
2. análise histórica do fork;
3. documentos de referência preservados em `docs/references for postiz/`;
4. comentários `Derived from Postiz` que documentam proveniência;
5. comparações de comportamento e nomes de teste;
6. poucas descrições operacionais que podem ser neutralizadas com segurança.

Nenhuma substituição global é segura. A entrega produzirá inventário
classificado e manterá as ocorrências legais, históricas ou de compatibilidade.

## Achados por severidade

### Crítico

Nenhum problema crítico foi confirmado nesta análise inicial.

### Alto

| ID | Evidência e localização | Impacto | Recomendação |
| --- | --- | --- | --- |
| H-01 | Continuação de thread valida estado/versão/cursor em leitura não bloqueante antes da chamada externa (`packages/core/src/application/use-cases/publishing.ts:286-291,439-467`). O cursor é condicionado só depois do publish (`packages/db/src/repositories/publishing.repo.ts:190-211`). | Dois jobs concorrentes podem observar o mesmo cursor e publicar a mesma resposta externa antes que apenas um avanço de cursor seja aceito. | Especificar fencing/lease atômico por item, testar duas continuações concorrentes e tornar a atualização de item/publicação uma operação com resultado verificado. Não corrigir sem design de recovery. |
| H-02 | Anti-SSRF resolve DNS antes de um `fetch` posterior e usa regex parcial de IP (`packages/core/src/application/use-cases/webhooks.ts:28-40`; consumidor em `media.ts`). | DNS rebinding e formas alternativas de IPv4/IPv6 podem alcançar metadata ou rede privada. | Criar mudança OpenSpec para resolução fixada/conexão segura, parser completo de CIDRs, validação de todos os redirects e testes com IPv4-mapped IPv6. |
| H-03 | Handlers capturam exceções inesperadas e não as relançam (`packages/queue/src/runtime.ts:171-205`). | pg-boss pode considerar o job concluído, removendo retry automático. Recovery cobre parte dos estados, mas não garante webhook ou falhas anteriores à transição. | Definir contrato de erro por fila e relançar falhas que devam acionar retry, com testes de integração e verificação de duplicidade. |
| H-04 | `bun audit` encontrou Drizzle ORM `<0.45.2` e Next.js `<16.2.11`, entre outros transitivos afetados. | SQL identifier injection em usos vulneráveis do ORM e múltiplos avisos do runtime web; a explorabilidade depende dos caminhos usados. | Atualizar apenas versões diretas mínimas compatíveis, executar toda a suíte/build/schema e registrar transitivos sem correção direta segura. |
| H-05 | Docker e Railpack ignoram falha do build web (`docker/Dockerfile:11`, `railpack.json:7`). | Uma imagem pode ser publicada sem artefato Next válido e falhar apenas ao iniciar. | Remover `|| true`, tornar build obrigatório na CI e preservar instalação congelada. |

### Médio

| ID | Evidência e localização | Impacto | Recomendação |
| --- | --- | --- | --- |
| M-01 | SSE envia keepalive a cada 25 s (`events.routes.ts:7,51-54`), mas Bun encerra requisições ociosas em 10 s por padrão. Logs Railway: `request timed out after 10 seconds`. | Realtime desconecta continuamente em produção. | Configurar `idleTimeout` acima do keepalive e testar a configuração exportada. |
| M-02 | `useRealtime` ignora o resultado de `/auth/me` e abre EventSource mesmo após refresh falhar (`apps/web/src/features/realtime/use-realtime.ts:50-76`). Logs mostraram pares repetidos de 401 em `/auth/me` e `/events`. | Sessões expiradas geram reconexão infinita e ruído operacional. | Não abrir SSE sem sessão confirmada; limpar a sessão/retornar ao login por fluxo testável. |
| M-03 | Listener OAuth aceita qualquer `message` com dois tipos conhecidos sem verificar `origin` ou `source` (`apps/web/src/features/channels/oauth-popup.ts:39-46`). | Outra janela/origem pode sinalizar sucesso falso ao fluxo local. | Exigir `e.origin === window.location.origin` e `e.source === popup`, com teste unitário da decisão. |
| M-04 | Rotação de refresh faz leitura e update separados sem condição no hash corrente (`identity.repo.ts:139-163`). | Duas requisições concorrentes podem rotacionar a mesma sessão e causar revogação/reuso inesperado. | Alterar em proposta própria para compare-and-swap transacional, cobrindo concorrência real no PostgreSQL. |
| M-05 | CI não reproduz as verificações locais completas e não obriga build web. | Regressões de interface/configuração podem entrar em `main`. | Pin de Bun, lock congelado e comando agregado de CI incluindo web, DB e OpenSpec. |
| M-06 | OpenAPI adiciona respostas genéricas a rotas não documentadas. | A geração pode aparentar cobertura completa enquanto contratos específicos estão ausentes. | Criar verificação de cobertura e snapshot em mudança futura; não expandir todos os contratos nesta entrega. |
| M-07 | Uploads de produção usam um único volume local e não há política de backup/restauração testada no repositório. | Perda do volume ou escala horizontal compromete arquivos. | Documentar operação atual e projetar storage de objeto antes de escalar réplicas. |
| M-08 | Documentos existentes divergem da produção sobre topologia standalone, providers, testes e observabilidade. | Desenvolvedores podem tomar decisões a partir de premissas falsas. | Criar mapa canônico e marcar documentos históricos/aspiracionais. |
| M-09 | Algumas tabelas filhas não têm `org_id`; o escopo depende do pai e de repositories internos. | Uma futura query direta por ID pode quebrar isolamento multi-tenant. | Documentar a regra e exigir testes/joins escopados para novos acessos. |

### Baixo

| ID | Evidência e localização | Impacto | Recomendação |
| --- | --- | --- | --- |
| L-01 | Semgrep sinalizou `createDecipheriv` sem `authTagLength`; o formato já extrai exatamente 16 bytes (`aes-gcm.service.ts:49-63`). | Defesa criptográfica fica implícita e o scanner não consegue provar o tamanho. | Passar `authTagLength: 16` explicitamente e manter os testes de adulteração. |
| L-02 | `/robots.txt` e `/sitemap.xml` retornaram 404 nos logs Railway. | Ruído de logs e descoberta incompleta por crawlers. | Tratar junto à landing/SEO, fora do backend funcional. |
| L-03 | `/metrics` fica público quando `METRICS_TOKEN` não existe (`apps/api/src/main.ts:45-55`). | Exposição de contadores em deployments públicos mal configurados. | Exigir token no managed ou restringir por rede; manter comportamento self-hosted documentado. |
| L-04 | Não há lint/formatter compartilhado. | Estilo e alguns bugs dependem de revisão manual. | Avaliar Biome ou ESLint em proposta separada, sem introduzir churn nesta entrega. |
| L-05 | Escape HTML artesanal foi sinalizado pelo Semgrep (`composer/editor.tsx:18-25`). A ordem escapa `&`, `<` e `>` antes de inserir apenas texto em `<p>`, sem interpolar atributo. | Baixo; nenhum bypass foi confirmado no uso atual. | Manter como falso positivo documentado ou migrar futuramente para JSON TipTap se conteúdo rico for habilitado. |

### Observações

- 226 de 228 requests de erro amostrados na Railway eram 401 de sessão expirada;
  não houve 5xx na amostra.
- Idempotência e rate limits da API pública falham de forma aberta sem Redis por
  decisão atual.
- JWTs não configuram `issuer`/`audience`; é hardening recomendado, não falha
  explorável confirmada neste contexto.
- `railpack.json` e `railway.json` não são a configuração efetiva de produção,
  mas removê-los exige decisão sobre estratégias alternativas de deploy.
- `apps/worker` é útil para separação futura, embora a produção atual execute o
  worker a partir do container combinado.

## Duplicações e acoplamentos

- Três configurações Railway repetem instalação, build e shell de start.
- O comando de start combinado gerencia três processos via shell no mesmo
  container, sem supervisor.
- `packages/core` mistura domínio, ports e infraestrutura criptográfica/mídia.
- OpenAPI existe como documento JSON e type declaration gerada; falta gate de
  sincronização.
- O composition root da API conhece banco, filas, providers, billing e storage;
  esse acoplamento é esperado na borda, mas torna mudanças de bootstrap de alto
  impacto.

## Arquivos que não devem ser editados manualmente

- `bun.lock`;
- `apps/web/src/lib/api/schema.d.ts`;
- `apps/web/openapi.json` quando regenerado pela API;
- `packages/db/migrations/meta/*`;
- migrations existentes já aplicadas;
- arquivos futuros gerados por `openspec init`.

Atualizações devem usar, respectivamente, Bun, `generate:api`, Drizzle Kit e
OpenSpec.

## Decisões de escopo

Serão corrigidos nesta iniciativa apenas:

- timeout SSE;
- validação do evento OAuth;
- encerramento do retry realtime sem sessão, se coberto por teste;
- tamanho explícito da tag GCM;
- build web mascarado;
- gaps reproduzíveis de CI/OpenSpec;
- versões diretas afetadas cuja atualização mínima passe todas as validações;
- referências Manypost seguras e documentação desatualizada relacionada.

Os achados H-01, H-02, H-03, M-04, M-06, M-07 e M-09 serão documentados como
backlog/propostas, pois exigem design, migração, testes de concorrência ou
decisão operacional mais ampla.

## Hipóteses e limitações

- A análise Railway foi somente leitura e limitada ao ambiente `production`.
- Não foi executado um fluxo browser E2E real; a suíte atual é
  predominantemente HTTP/domínio.
- Não houve restauração de backup nem teste destrutivo de migrations.
- A explorabilidade de advisories transitivos depende de caminhos internos de
  dependências; o inventário é fato, mas risco efetivo individual requer
  threat modeling adicional.
- Tabelas sem consumidores podem ser roadmap; não serão removidas.
- A classificação detalhada das 298 referências Postiz será produzida após a
  configuração do OpenSpec e antes de qualquer substituição.
