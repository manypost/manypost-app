# PLANS.md — planos do gerenciado e mapeamento para a fronteira de código

> **Fonte:** landing page oficial (registrada pelo owner em 2026-07-10). Este documento é a ponte entre **planos do SaaS** (Grátis/Pro/Premium — gates comerciais) e a **fronteira de código** (núcleo AGPL vs código fechado). São duas fronteiras distintas: um recurso pode ser AGPL no código e ainda assim ser gate de plano no gerenciado.

## ⚠️ Nota de terminologia (obrigatória nos docs)

"Premium" agora significa duas coisas. Para não contaminar decisões:
- **plano Premium** = tier comercial do gerenciado (esta página);
- **código fechado** (repo `manypost-premium`) = componentes proprietários (IA operacional, governança, billing, admin).
Nos documentos, sempre qualificar: "plano Premium" vs "código fechado".

## 1. Matriz de planos (verdade comercial, por marca)

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

"Marca" mapeia para **organization** no modelo de dados (billing por org). Plano Premium com várias marcas usa os workspaces do código fechado por cima.

## 2. Mapeamento feature → código → gate de plano

| Feature | Código | Gate no gerenciado | Observação |
|---|---|---|---|
| Kanban (básico e completo), calendário, timeline | **núcleo AGPL** | básico no Grátis; completo Pro+ | "básico" = sem coluna de aprovação e sem filtros salvos (definição de produto, não de código) |
| Publicação multicanal, agendamento, retry | núcleo AGPL | todos | limites de posts/redes via PlanPolicy |
| **Aprovação por link público** | **núcleo AGPL** (DECISIONS v1.1) | Pro+ | specs atualizadas: DATA, API_MCP, FRONTEND, ROADMAP fase 1 |
| Analytics (séries + display) | núcleo AGPL | Pro+ | já decidido (dado aberto) |
| API REST + MCP | núcleo AGPL | Pro+ | escopo do token respeita o plano |
| IA de criação (tom/formato por rede) | núcleo AGPL (`AiProvider` + créditos) | Pro+ | |
| IA: melhor horário por rede | **núcleo AGPL** — heurística estatística sobre `channel_metrics` (não é LLM; custo zero) | Pro+ | SPEC_AI §3 atualizada |
| IA: rascunho multicanal de uma ideia | núcleo AGPL (`ai.captionFromBrief` já spec'ado) | **plano Premium** | gate comercial sobre código aberto |
| Workspaces, permissões finas, auditoria estendida | **código fechado** (v3) | plano Premium | |
| IA: respostas de comentários/DMs, classificação/roteamento, relatórios de campanha, alerta de engajamento, otimização de calendário | **código fechado** (IA operacional, v2) | plano Premium | escopo da v2 agora é exatamente esta lista |
| Análise de concorrentes | código fechado (v2+) | fora da matriz atual | owner quer na aplicação; entra no plano Premium quando pronta |

## 3. Enforcement dos planos (arquitetura)

- O núcleo tem o port **`PlanPolicy`** (SPEC_BACKEND §5) consultado em: conectar canal, agendar post, usar IA, emitir API key, criar link de aprovação.
- **Self-host:** `PlanPolicy` default = ilimitado. Quem self-hosta tem todos os recursos AGPL sem gates — é a natureza do open-core e está OK: o gerenciado vende hospedagem, X incluído, IA sem chave própria, links públicos servidos pela nossa infra e o código fechado.
- **Gerenciado:** o serviço de billing (código fechado) implementa `PlanPolicy` via extension point (SPEC_ARCHITECTURE §5). O núcleo nunca conhece nomes/preços de planos — só respostas de política (`allowed | denied(code)`).
- Grátis: 3 redes, 15 posts/mês, sem X, sem IA, sem API/MCP, kanban básico — tudo expressável como respostas do PlanPolicy + capacidades no `GET /v1/capabilities`.

## 4. Economia do X no gerenciado (atualiza DECISIONS §6 — ver v1.1)

O Pro promete "todas as redes — inclusive X": o gerenciado **absorve** o custo do app X (supersede o "traga-sua-chave no gerenciado" da v1). Self-host continua BYO-key.

**Risco a gerenciar:** o tier Basic da API do X (~US$200/mês) tem teto de posts **por app** (~3k/mês). Com adoção, o teto do app estoura e o próximo tier é caro (US$5k/mês). Mitigações obrigatórias:
1. A "política de uso justo" do Pro deve ter sub-limite explícito para X (ex.: N posts/mês/marca via X) — número a definir (P3 atualizada).
2. Métrica `posts_via_x_total` com alerta em 70% do teto do app (SPEC_INFRA).
3. Plano de contingência documentado: fila de prioridade por plano quando o teto do app se aproximar.

## 5. Pendências desta página

| # | Pendência | Dono |
|---|---|---|
| PL1 | Números da política de uso justo (geral e sub-limite X) | owner |
| PL2 | Definição fina de "kanban básico" (o que exatamente o Grátis não tem) | owner + design |
| PL3 | Créditos de IA por plano (herda P2 do DECISIONS) | owner |
| PL4 | Análise de concorrentes: em qual plano/quando entra na matriz | owner |
