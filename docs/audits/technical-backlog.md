# Backlog técnico priorizado

Estado consolidado em 2026-07-26; H-01/H-02/H-03 fechados em 2026-07-27 a partir do
[diagnóstico inicial](2026-07-23-initial-diagnosis.md), testes, Semgrep,
`bun audit` e observação somente leitura do Railway. Evidência nova deve
atualizar este arquivo e, para mudança material, abrir ou alterar um OpenSpec.

## Resumo

Nenhum achado crítico foi confirmado. Dos 19 achados classificados no
diagnóstico, oito foram resolvidos nesta iniciativa, um foi parcialmente
remediado e dez permanecem deliberadamente no backlog. A CI final acrescentou
uma observação de baixo risco sobre o runtime de uma action.

| ID | Severidade | Estado | Resultado ou próximo passo |
| --- | --- | --- | --- |
| H-01 | alto | resolvido | `publication_attempts` + living `publication-delivery-safety` (arquivado 2026-07-27) |
| H-02 | alto | resolvido | pin DNS + living `outbound-request-security` (arquivado 2026-07-27) |
| H-03 | alto | resolvido | publish/thread/webhook relançam falha inesperada após o lote (`packages/queue` runtime) |
| H-04 | alto | parcialmente resolvido | Next e Drizzle corrigidos; sete advisories transitivos documentados abaixo |
| H-05 | alto | resolvido | builds Docker/Railpack não mascaram mais falhas |
| M-01 | médio | resolvido | timeout Bun 30 s, keepalive SSE 25 s, teste de regressão |
| M-02 | médio | resolvido | SSE só abre após sessão confirmada; 401 final encerra retry |
| M-03 | médio | resolvido | mensagem OAuth exige origem e popup esperados |
| M-04 | médio | aberto | compare-and-swap da rotação de refresh |
| M-05 | médio | resolvido | Bun/lock/check completo fixados na CI |
| M-06 | médio | aberto | cobertura/snapshot OpenAPI específico por rota |
| M-07 | médio | aberto | storage de objeto e restore testado antes de escalar |
| M-08 | médio | resolvido | documentação canônica criada e histórico sinalizado |
| M-09 | médio | aberto | queries de tabelas filhas sempre escopadas pelo pai/org |
| L-01 | baixo | resolvido | tag GCM de 16 bytes explícita e testada |
| L-02 | baixo | aberto | `/robots.txt` e `/sitemap.xml` na iniciativa de landing/SEO |
| L-03 | baixo | aberto | exigir/proteger métricas no modo gerenciado |
| L-04 | baixo | aberto | avaliar Biome ou ESLint sem churn massivo |
| L-05 | baixo | triado | falso positivo atual; migrar para JSON TipTap se houver rich text |
| L-06 | baixo | aberto | atualizar action que ainda declara Node.js 20 após revisão da versão compatível |

## Prioridade 1 — segurança e efeitos externos

### H-01 — duplicidade em continuação de thread — **resolvido**

- Entrega: `publication_attempts` com `claimItem` antes de qualquer chamada à
  rede, `confirmItem` fenceado por `owner_token`, desfecho `INDETERMINATE` →
  `NEEDS_REVIEW` sem retry automático.
- Spec viva: [`publication-delivery-safety`](../../openspec/specs/publication-delivery-safety/spec.md).
- Archive: [`2026-07-27-harden-publishing-idempotency`](../../openspec/changes/archive/2026-07-27-harden-publishing-idempotency/).

### H-02 — DNS rebinding em mídia/webhook — **resolvido** (phase 1)

- Entrega: classificador IPv4/IPv6 + `outboundRequest` com pin do IP validado
  (Host/SNI do hostname), redirects revalidados; usado em mídia from-url,
  entrega de webhooks e CIMD OAuth.
- Flags `MEDIA_ALLOW_PRIVATE_URLS` / `WEBHOOKS_ALLOW_PRIVATE` default **false**;
  só E2E/dev controlado.
- Spec viva: [`outbound-request-security`](../../openspec/specs/outbound-request-security/spec.md).
- Archive: [`2026-07-27-harden-outbound-request-security`](../../openspec/changes/archive/2026-07-27-harden-outbound-request-security/).
- **Residual consciente (phase 2):** providers ainda baixam `media.url` com
  `ctx.fetch` (URLs em geral já são do storage da instância). Endurecer com
  allowlist de host (`MEDIA_PUBLIC_URL`/`PUBLIC_URL`) ou fetch pinado no worker.

### H-03 — exceções de worker reconhecidas como sucesso — **resolvido**

- Entrega: `runBatch` em publish, continue-thread e webhook relança a primeira
  falha inesperada após processar o lote; retries de negócio de webhook
  continuam dentro de `makeDeliverWebhook`.
- Código: `packages/queue/src/runtime.ts`.

## Prioridade 2 — identidade, contratos e dados

### M-04 — rotação concorrente de refresh token

`packages/db/src/repositories/identity.repo.ts` lê e atualiza o hash corrente em
operações separadas. Duas requisições concorrentes podem rotacionar a mesma
sessão e disparar detecção de reuso indevida. Projetar compare-and-swap
transacional, testar concorrência em PostgreSQL real e preservar revogação da
família.

### M-06 — cobertura OpenAPI aparente

`apps/api/src/main.ts` cria stubs genéricos para rotas sem contrato detalhado.
Isso mantém descoberta, mas pode ocultar request/response ausentes. Adicionar
gate que distingue rota documentada de fallback, snapshot do contrato e
regeneração verificada do cliente web.

### M-07 — volume local sem restore comprovado

Driver `s3` (R2/S3/MinIO) e `MEDIA_PUBLIC_URL` já existem (onda 25 / living
`media-object-storage`). Residual: restore testado, retenção/backup e migração
de volume local → bucket em produção multi-réplica.

### M-09 — isolamento indireto de tabelas filhas

Várias tabelas não possuem `org_id` e dependem de join ao pai. Novos repositories
devem exigir o escopo do pai/organização e testes negativos cross-tenant. Uma
eventual redundância de `org_id` exige OpenSpec e migration aditiva; não
reescrever migrations existentes.

## Prioridade 3 — operação e qualidade

- L-02: servir SEO técnico pela aplicação/landing responsável e reduzir 404
  conhecido em produção.
- L-03: no managed, falhar boot ou restringir `/metrics` quando
  `METRICS_TOKEN` estiver ausente; manter contrato self-hosted explícito.
- L-04: comparar Biome/ESLint por cobertura, integração Bun/Next, tempo de CI e
  churn antes de adoção.
- L-05: o escape atual converte texto em parágrafos sem interpolar atributos e
  não teve bypass confirmado. Se rich text for aceito, guardar JSON TipTap e
  renderizar por pipeline sanitizado.
- L-06: o runner registrou que `actions/checkout@v4` ainda declara Node.js 20 e
  foi forçado a executar em Node.js 24. Atualizar a action em PR separado após
  revisar notas de versão e repetir a matriz completa.

## Advisories de dependências restantes

Baseline: 17 advisories (`9` altos, `8` moderados). Após Next `16.2.11` e
Drizzle ORM `0.45.2`: 7 advisories transitivos (`4` altos, `3` moderados).
`bun audit` continua retornando código diferente de zero; não há alegação de
grafo limpo.

| Pacote/achado | Severidade | Cadeia confirmada | Exposição observada e ação |
| --- | --- | --- | --- |
| `sharp <0.35.0` / GHSA-f88m-g3jw-g9cj | alto | Next opcional → `sharp 0.34.5` | imagens Next atuais são assets locais; aguardar Next compatível com Sharp corrigido e reavaliar image optimizer |
| `postcss <=8.5.11` / GHSA-6g55-p6wh-862q | alto | Next fixa `8.4.31` | build processa CSS versionado; atualizar pelo upstream Next, sem override incompatível |
| `postcss <8.5.10` / GHSA-qx2v-qp2m-jg93 | moderado | mesma cadeia Next | mesma ação; Tailwind usa `8.5.19` não afetado |
| `fast-uri 3.1.3` / GHSA-v2hh-gcrm-f6hx | alto | AJV via MCP SDK e dependency-cruiser | acompanhar AJV/MCP; testar URI/host validation antes de upgrade |
| `js-yaml 4.2.0` / GHSA-52cp-r559-cp3m | alto | Redocly → openapi-typescript | ferramenta de geração, não runtime de produção; atualizar quando Redocly liberar cadeia compatível |
| `esbuild 0.18.20` / GHSA-67mh-4wv8-2f99 | moderado | loader legado de drizzle-kit | risco do dev server, não do bundle runtime; aguardar Drizzle Kit remover loader |
| `@hono/node-server 1.19.14` / GHSA-frvp-7c67-39w9 | moderado | MCP SDK | app executa Bun e não usa `serve-static` do adapter diretamente; acompanhar MCP SDK |

Não adicionar dependências diretas artificiais nem `resolutions` apenas para
silenciar o audit. Atualizar a cadeia proprietária, repetir
`bun install --frozen-lockfile`, `bun run check:ci` e `bun audit`.

## Observações arquiteturais e código sem consumidor confirmado

- `ai_credits`, `oauth_apps`, `oauth_grants`, `idempotency_keys`,
  `channel_sets`, `signatures` e `channel_metrics` não têm consumidor de
  aplicação confirmado. São reservas/compatibilidade, não remoção autorizada.
- Docker, Railway JSON/TOML e Railpack duplicam partes do start/deploy.
- O container standalone gerencia três processos por shell, sem supervisor.
- `packages/core/src/infra` mistura infraestrutura ao package de domínio.
- Não existe E2E browser; UI depende de helper tests, typecheck, build e revisão
  manual.
- Semgrep Supply Chain não conseguiu mapear o workspace; `bun audit` foi a
  cobertura disponível nesta entrega.

## Ordem recomendada

1. atribuir owner/prazo e implementar H-01;
2. prototipar address pinning e implementar H-02;
3. fechar contrato de erro/ack das quatro filas (H-03);
4. projetar CAS de refresh (M-04);
5. decidir storage/backup antes de horizontalizar (M-07);
6. adicionar cobertura OpenAPI e browser E2E;
7. revisar advisories a cada patch de Next, MCP, Drizzle Kit e Redocly.
