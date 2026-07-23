# Backlog técnico priorizado

Estado consolidado em 2026-07-23 a partir do
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
| H-01 | alto | especificado | `harden-publishing-idempotency` |
| H-02 | alto | especificado | `harden-outbound-request-security` |
| H-03 | alto | aberto | contrato de erro/ack para todas as filas; publicação/thread aparece no OpenSpec H-01 |
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

### H-01 — duplicidade em continuação de thread

- Evidência: `packages/core/src/application/use-cases/publishing.ts` verifica
  cursor/versão em leitura antes da chamada externa; o cursor só é persistido
  depois do provider.
- Impacto: dois workers podem publicar o mesmo item; crash após sucesso externo
  deixa resultado incerto.
- Recomendação: implementar lease/fencing por item, idempotency key do provider
  e estado indeterminado conforme
  [`harden-publishing-idempotency`](../../openspec/changes/harden-publishing-idempotency/).
- Decisão humana: definir owner, prazo e tratamento operacional de publicações
  indeterminadas.

### H-02 — DNS rebinding em mídia/webhook

- Evidência: `assertPublicUrl` resolve DNS, mas `fetch` abre outra conexão e a
  classificação atual é regex parcial.
- Impacto: hostname controlado pode trocar resolução e alcançar rede interna ou
  metadata.
- Recomendação: resolver e fixar o endereço da conexão, normalizar IPv4/IPv6,
  revalidar redirects e limitar recursos conforme
  [`harden-outbound-request-security`](../../openspec/changes/harden-outbound-request-security/).
- Decisão humana: política de destinos/portas privadas para self-hosted versus
  Manypost gerenciado.

### H-03 — exceções de worker podem ser reconhecidas como sucesso

- Evidência: `packages/queue/src/runtime.ts` captura erros inesperados nos
  handlers de publish, thread e webhook e não relança.
- Impacto: pg-boss pode concluir o job sem aplicar seu retry; recovery não cobre
  igualmente todas as fases/deliveries.
- Recomendação: definir erro tratado versus infraestrutura por fila, persistir
  o estado apropriado e relançar somente falhas que o pg-boss deve repetir.
  Testar acknowledgement, duplicidade e crash. A parte de publicação/thread
  deve ser resolvida junto ao H-01; webhook ainda exige escopo explícito.

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

Produção usa `/app/uploads` em um volume Railway único. O schema aceita
`STORAGE_PROVIDER=s3`, mas não existe adapter. Antes de múltiplas réplicas:
implementar object storage por port, definir retenção/backup, testar restore e
documentar migração/rollback.

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
