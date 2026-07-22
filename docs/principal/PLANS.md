# PLANS.md — planos do gerenciado e mapeamento para a fronteira de código

[← Índice da documentação](../README.md) · [STATUS](STATUS.md) · [Specs técnicas](../specs/) · [README do projeto](../../README.md)

> **Fonte:** landing page oficial (registrada pelo owner em 2026-07-10) + Adendo Open Source v1.2. Este documento é a ponte entre **planos do SaaS** (Grátis/Pro/Premium — gates comerciais) e a **fronteira de código** no monorepo AGPL-3.0. São duas camadas distintas: o código de todas as funcionalidades é 100% aberto, mas o serviço gerenciado na nuvem (`manypost Cloud`) aplica gates comerciais por plano.

## ⚠️ Nota de terminologia e estratégia open source (v1.2)

O projeto adota a estratégia **Monorepo Único 100% Open Source (AGPL-3.0)**, idêntica à do Postiz (`IS_GENERAL` / `DISALLOW_PLUS`).
- **plano Premium** = tier comercial de assinatura mais avançado no serviço gerenciado (`manypost Cloud`).
- **Monorepo 100% Aberto:** Não existe repositório privado `manypost-premium` ou "código fechado". Todas as features operacionais e de governança vivem no monorepo sob AGPL-3.0.
- A diferenciação entre quem roda **Self-Hosted Grátis** e quem roda no **SaaS Cloud** é feita via variáveis de ambiente (`IS_SELF_HOSTED`, `HIDE_BILLING`).

## 1. Matriz de planos (verdade comercial, por marca no SaaS Cloud)

| | **Grátis** — R$ 0 | **Pro** — R$ 23,90/mês (anual R$ 286,80; mensal R$ 29,90) | **Premium** — R$ 52,90/mês (anual R$ 634,80; mensal R$ 66,90) |
|---|---|---|---|
| Marcas | 1 | 1 (por marca) | várias (cobrado por marca) |
| Redes conectadas | até 3 | todas — **inclusive X** | todas — inclusive X |
| Posts | 15/mês | ilimitados (uso justo) | ilimitados (uso justo) |
| Kanban | básico | completo + timeline + calendário | completo + timeline + calendário |
| Publicação | APIs oficiais | APIs oficiais | APIs oficiais |
| Aprovação por link público | — | ✅ | ✅ |
| Analytics (alcance, engajamento, crescimento) | — | ✅ | ✅ |
| API REST + MCP | — | ✅ | ✅ |
| IA: tom/formato por rede | — | ✅ | ✅ |
| IA: melhor horário por rede | — | ✅ | ✅ |
| Workspaces, permissões e auditoria | — | — | ✅ |
| IA: rascunho multicanal a partir de uma ideia | — | — | ✅ |
| IA: monta e otimiza o calendário da semana | — | — | ✅ |
| IA: responde comentários e DMs num lugar só | — | — | ✅ |
| IA: classifica e direciona mensagens | — | — | ✅ |
| IA: acompanha campanhas e gera relatórios | — | — | ✅ |
| IA: avisa quando um post perde engajamento | — | — | ✅ |

"Marca" mapeia para **organization** no modelo de dados (billing por org). Plano Premium com várias marcas destrava a interface multi-workspace avançada do monorepo no SaaS.

## 2. Mapeamento feature → código → gate de plano (Cloud vs Self-Hosted)

| Feature | Código no Monorepo | Gate no SaaS Gerenciado | Comportamento no Self-Hosted (`IS_SELF_HOSTED=true`) |
|---|---|---|---|
| Kanban (básico e completo), calendário, timeline | **monorepo AGPL-3.0** | básico no Grátis; completo Pro+ | Liberado 100% |
| Publicação multicanal, agendamento, retry | monorepo AGPL-3.0 | todos (limites via PlanPolicy) | Liberado e ilimitado |
| **Aprovação por link público** | **monorepo AGPL-3.0** | Pro+ | Liberado 100% |
| Analytics (séries + display) | monorepo AGPL-3.0 | Pro+ | Liberado 100% |
| API REST + MCP | monorepo AGPL-3.0 | Pro+ | Liberado 100% |
| IA de criação (tom/formato por rede) | monorepo AGPL-3.0 (`AiProvider`) | Pro+ (franquia do SaaS) | BYO-Key (usa chave própria configurada no `.env`) |
| IA: melhor horário por rede | **monorepo AGPL-3.0** (heurística sobre `channel_metrics`) | Pro+ | Liberado 100% |
| IA: rascunho multicanal de uma ideia | monorepo AGPL-3.0 (`ai.captionFromBrief`) | **plano Premium** | BYO-Key (`IS_SELF_HOSTED=true`) |
| Workspaces, permissões finas, auditoria estendida | **monorepo AGPL-3.0** (v3) | plano Premium | Liberado por configuração |
| IA: respostas de comentários/DMs, classificação/roteamento, relatórios de campanha, alerta de engajamento, otimização de calendário | **monorepo AGPL-3.0** (IA operacional, v2) | plano Premium | BYO-Key (`IS_SELF_HOSTED=true`) |
| Análise de concorrentes | monorepo AGPL-3.0 (v2+) | plano Premium | Liberado / BYO-Key no self-hosted |

## 2.1 Onde isso vive no código (implementado em 2026-07-21) ⭐

| Camada | Arquivo | Papel |
|---|---|---|
| **Catálogo (fonte única)** | `packages/contracts/src/billing.ts` | `PLANS` = limites + `PlanFeature[]` + preços em centavos + `lookup_key` da Stripe. **Feature nova só existe comercialmente se entrar aqui.** |
| Port de política | `packages/core/src/application/ports/plan-policy.ts` | `PlanPolicy.check/assert/snapshot` + `PlanUsageReader` |
| Implementações | `packages/core/src/application/use-cases/plan-policy.ts` | `makeSelfHostedPlanPolicy` (tudo liberado) e `makeSaasPlanPolicy` (impõe o catálogo) |
| Cobrança | `packages/core/src/application/use-cases/billing.ts` | checkout, troca de plano, portal, cancelamento, webhook, reconciliação |
| Adapter Stripe | `apps/api/src/infra/billing/stripe.gateway.ts` | **único** arquivo que importa o SDK da Stripe |
| Assinatura | `packages/db/src/schema/billing.ts` + `organizations.billing_customer_id` | 1 linha por org; sem linha = Grátis |
| Superfície HTTP | `/v1/capabilities` (sempre), `/v1/billing/*` e `/v1/stripe/webhook` (só no gerenciado) | |
| UI | `apps/web/src/features/billing/*` (`/planos`, `/boas-vindas`, `PlanLockNotice`) | |
| Provas | `scripts/e2e-billing.ts` + testes unitários de `plan-policy`/`billing` | |

**Gates aplicados hoje:** conectar canal (teto de 3 e X só no Pro+), agendar post (15/mês),
criar link de aprovação, emitir API key, criar webhook, `/public/v1` e `/mcp` por requisição.
Downgrade **desativa** (não desconecta) os canais mais recentes acima do teto; upgrade reativa.

## 3. Enforcement dos planos (arquitetura e feature flags)

- O monorepo possui a interface de domínio **`PlanPolicy`** (SPEC_BACKEND §5), consultada ao: conectar canal, agendar post, usar IA, emitir API key e criar link de aprovação.
- **Modo Self-Hosted (`IS_SELF_HOSTED=true` / `HIDE_BILLING=true`):** O adaptador de `PlanPolicy` default responde `allowed` para tudo e o frontend oculta botões de upgrade de planos ou cobrança via Stripe. O usuário roda o código aberto em seus containers com total liberdade e sem bloqueios comerciais artificialmente embutidos no Docker local.
- **Modo SaaS Gerenciado (`IS_SELF_HOSTED=false` / `HIDE_BILLING=false` em `manypost.com`):** A implementação de infraestrutura (`SaaSPlanPolicy` / Billing Service no monorepo) consulta o plano da organização e responde `allowed | denied(code)`. A UI exibe as opções de faturamento e upgrade. O SaaS ganha pela hospedagem zero-config, IA inclusa sem BYO-key, X absorb-key e alta disponibilidade.
- Grátis no SaaS: 3 redes, 15 posts/mês, sem X, sem IA, sem API/MCP, kanban básico — tudo expressado via `PlanPolicy` + `GET /v1/capabilities`.

## 4. Economia do X no gerenciado (atualiza DECISIONS §6 — ver v1.1)

O Pro promete "todas as redes — inclusive X": o gerenciado **absorve** o custo do app X (supersede o "traga-sua-chave no gerenciado" da v1). Self-host continua BYO-key.

**Risco a gerenciar:** o tier Basic da API do X (~US$200/mês) tem teto de posts **por app** (~3k/mês). Com adoção, o teto do app estoura e o próximo tier é caro (US$5k/mês). Mitigações obrigatórias:
1. A "política de uso justo" do Pro deve ter sub-limite explícito para X (ex.: N posts/mês/marca via X) — número a definir (P3 atualizada).
2. Métrica `posts_via_x_total` com alerta em 70% do teto do app (SPEC_INFRA).
3. Plano de contingência documentado: fila de prioridade por plano quando o teto do app se aproximar.

## 5. Pendências desta página

| # | Pendência | Dono |
|---|---|---|
| PL0 | Rodar `bun run stripe:sync` com a chave de teste e criar o webhook (`whsec_`) — a conta da Stripe ainda está sem produtos/preços | owner |
| PL1 | Números da política de uso justo (geral e sub-limite X) — hoje `postsPerMonth: UNLIMITED` no Pro/Premium, sem sub-limite de X | owner |
| PL2 | Definição fina de "kanban básico" (o que exatamente o Grátis não tem) | owner + design |
| PL3 | Créditos de IA por plano (herda P2 do DECISIONS) | owner |
| PL4 | Análise de concorrentes: em qual plano/quando entra na matriz | owner |

---

**Nesta pasta:** [Decisões](DECISIONS.md) · [Gates das plataformas](platform-gates.md) · [Setup das redes](INTEGRATIONS_SETUP.md) · [Análise do Postiz](POSTIZ_ANALYSIS.md) · [STATUS](STATUS.md) · [Histórico das ondas](CHANGELOG_ONDAS.md)

**Navegação:** [Índice da documentação](../README.md) · [Specs técnicas](../specs/) · [Marca](../brand/BRAND_SYSTEM.md) · [README do projeto](../../README.md) · [Contribuir](../../CONTRIBUTING.md)
