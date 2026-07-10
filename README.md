# manypost

Agendador e publicador open source de posts para redes sociais: canais via OAuth, composer multi-canal, calendário + kanban, publicação durável com retry/rate-limit, analytics, API pública e servidor MCP. Self-hostable em 3 containers (app, Postgres, Redis).

> **Origem e licença:** o núcleo do manypost é **derivado do [Postiz](https://github.com/gitroomhq/postiz-app)** (AGPL-3.0) — reimplementação das soluções dele em nova stack (Bun/TypeScript, Hono, Next.js, Drizzle/PostgreSQL, pg-boss, Redis). Por isso este repositório é **AGPL-3.0**, com atribuição preservada. Detalhes: [NOTICE](NOTICE) e [ATTRIBUTION.md](ATTRIBUTION.md).

**Status:** fase 0 — esqueleto do repositório. Nada aqui é utilizável ainda.

## Estrutura

```
apps/api        Bun + Hono: HTTP, MCP, webhooks de entrada
apps/worker     Bun: consumidores pg-boss (publicação, refresh, recuperação)
apps/web        Next.js + shadcn/ui (scaffold na fase 0)
packages/core   DDD: domain + application (use-cases, ports) — sem IO
packages/db     Drizzle: schema + migrations + repositórios
packages/providers  ChannelProviders (1 pasta por rede) + test-kit de contrato
packages/contracts  Tipos/schemas públicos (licença pendente de parecer jurídico — não publicar)
packages/config     Env tipada (zod)
docker/         Compose self-host + observabilidade de referência
docs/           Análise do Postiz, specs por camada e decisões congeladas
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/POSTIZ_ANALYSIS.md](docs/POSTIZ_ANALYSIS.md) | Avaliação técnica do Postiz (commit `84edda5`) e mapa de derivação |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisões congeladas v1 + adendo v1.1 (fronteira AGPL/código fechado, fila, stack, planos) |
| [docs/PLANS.md](docs/PLANS.md) | Matriz de planos do gerenciado (Grátis/Pro/Premium) e mapeamento feature → código → gate de plano |
| [docs/specs/](docs/specs/) | Specs por camada: arquitetura, backend, frontend, fila/publicação, integrações, dados, API/MCP, IA, infra, roadmap |
| [docs/INTEGRATIONS_SETUP.md](docs/INTEGRATIONS_SETUP.md) | **Guia para leigos:** como conseguir as credenciais de cada rede (Meta App Review, X, TikTok, YouTube…), clique a clique |
| [docs/platform-gates.md](docs/platform-gates.md) | Rastreio interno do status dos gates de aprovação por plataforma |
| [docs/brand/](docs/brand/) | **Identidade visual (normativa para todo frontend):** BRAND_SYSTEM.md + guia de adaptação para o app |

## Regras invioláveis do repositório

1. Este repo roda **100% self-hosted sem qualquer componente premium** — nenhum import, nenhuma flag que dependa de código fechado.
2. `packages/core` não importa de `apps/*` nem de adapters de infra (CI: dependency-cruiser).
3. Nenhum provedor de IA nominal fora de `infra/ai/*` (CI: grep).
4. Código portado de forma reconhecível do Postiz deve ser marcado com `// Derived from Postiz (AGPL-3.0): <arquivo>`.

## Licença

[AGPL-3.0](LICENSE). © contribuidores do manypost. Derivado do Postiz © Gitroom Holdings — ver [ATTRIBUTION.md](ATTRIBUTION.md).
