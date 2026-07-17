# ATTRIBUTION.md — origem e derivação

O núcleo do manypost reimplementa soluções do **Postiz** ([gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app), AGPL-3.0), estudado no commit `84edda5b02ea4a0aa31263a6aa52bc02b50f109f` (2026-07-05). Não há cópia literal de código-fonte (a stack é distinta), mas os elementos abaixo são **derivação conceitual direta** e mantêm este repositório sob AGPL-3.0:

| Elemento derivado no manypost | Origem no Postiz |
|---|---|
| Contrato do provider de canal (auth url / authenticate / refresh / post / reply / analytics / mentions + metadados de capacidade: concorrência máxima, conexão em 2 passos, tipo de editor, limite de caracteres, validação de mídia) | `libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts`, `social.abstract.ts` |
| Taxonomia de erros `transient / refresh-token / permanent` e o fluxo "refresh e repete" | `social.abstract.ts`, `apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.0.5.ts` |
| Pipeline de publicação (validações → post principal → thread/comentários com delay → webhooks → repetição) e o scanner de publicações perdidas | `post.workflow.v1.0.5.ts`, `missing.post.workflow.ts` |
| Modelo de dados: publicação por canal com grupo/parent/settings; canal (Integration) com estado de refresh/2-passos/horários preferidos | `libraries/nestjs-libraries/src/database/prisma/schema.prisma` |
| Mapa default de concorrência por provider (X=1, Reddit=1, LinkedIn=2, Pinterest=3, YouTube=200, Instagram=400, Facebook=500) | valores `maxConcurrentJob` dos providers |
| Padrão "MCP sobre o mesmo core" com OAuth de recurso protegido (RFC 9728 + PKCE) e auditoria da origem da mutação | `libraries/nestjs-libraries/src/chat/start.mcp.ts`, enum `CreationMethod` |

**Estratégia Open Source & Nuvem:** Todo o código do manypost (incluindo IA operacional, workspaces, governança, billing e admin) opera em um **Monorepo Único 100% Open Source (AGPL-3.0)**. A separação entre o uso comunitário gratuito (`IS_SELF_HOSTED=true`, `HIDE_BILLING=true`) e o serviço gerenciado na nuvem (`manypost Cloud`, onde os limites de planos e cobranças são ativados via `PlanPolicy`) é controlada por variáveis de ambiente, sem necessidade de repositório privado ou código fechado. Componentes operacionais exclusivos do produto são implementações originais e não derivam do Postiz.
