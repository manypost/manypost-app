# DECISIONS.md — v1.1 (v1 congelada em 2026-07-10 + adendo v1.1 do mesmo dia, ao final)

> Decisões ratificadas pelo product owner. Este documento é a referência normativa; as specs foram atualizadas para refletir cada item. Mudança daqui em diante = nova versão deste arquivo com changelog.

## 1. Fronteira AGPL / premium

**a) Aprovação simples (1 estágio) no núcleo — ✅ APROVADO.**
Aprovação básica é higiene, não carro-chefe: kanban open source sem "revisar antes de publicar" atrapalharia a adoção, que é a função do núcleo. O que protege o premium é manter fechados: multi-estágio, papéis custom e SSO.

**b) Histórico de analytics no núcleo — ✅ APROVADO (padrão "dado aberto, insight fechado").**
`channel_metrics` (armazenamento da série) é AGPL; benchmarking, comparações e alertas (a interpretação) são premium. Guardar o histórico não é o valor; interpretá-lo é.

**c) Licença dos `@manypost/contracts` — ⚠️ DIREÇÃO APROVADA, LICENÇA PENDENTE DE VALIDAÇÃO JURÍDICA.**
Direção aprovada: contratos em licença permissiva para desacoplar o premium (dual-licensing de interface). **Não congelado:** a fronteira "contrato/interface (permissivo) vs implementação (AGPL)" é exatamente onde o copyleft é testado — se um contrato permissivo carregar lógica derivada do núcleo AGPL, a separação vaza. **Ação obrigatória antes de publicar o pacote:** parecer de especialista em licenciamento. Até lá: o pacote existe no monorepo, marcado `LICENSE: pending legal review`, **não publicado no npm** e contendo apenas tipos/schemas/constantes (zero lógica). Item de fase 0 no roadmap.

## 2. Fila: pg-boss no núcleo — ✅ APROVADO, com rota de fuga

pg-boss + orquestração explícita (state machine + outbox + scanner + rate-limit Redis) atrás do port `JobScheduler`. Temporal é tecnicamente superior, mas custaria stack pesada, um serviço a mais e o risco Bun×`@temporalio/worker`; "self-host em 3 containers" é argumento de adoção do núcleo. **Aprovado também:** o gerenciado pode divergir (adapter Temporal Cloud) na v2+ sem tocar o domínio.

## 3. HTTP: Hono — ✅ APROVADO
Portabilidade de runtime + `zod-openapi` amarrado ao contrato OpenAPI tipado valem mais que micro-benchmark do Elysia; Hono não prende ao Bun.

## 4. ORM: Drizzle — ✅ APROVADO
SQL fino é conforto para o time, não barreira; migrations versionadas são requisito.

## 5. Redes do MVP: onda 1 — ✅ APROVADO, com posicionamento explícito

Onda 1 (Mastodon, LinkedIn, X, Discord, Telegram, Bluesky) tira o MVP do papel sem esperar App Review; processos de Meta/Instagram/TikTok/YouTube abrem **no dia 1** (lead time = caminho crítico real).
**Posicionamento ratificado:** o público criador brasileiro vive de Instagram e TikTok. O MVP da onda 1 serve para **validar e captar** (dev/open-source/LinkedIn/X), não para reter criador de Instagram. Instagram/TikTok são o marco que **"abre" o produto ao público principal** — comunicar assim no discurso e no roadmap público.

## 6. Custo da API do X — ✅ DECIDIDO: traga-sua-chave nos DOIS modos

Self-host e gerenciado começam com "conecte sua própria chave" para o X. ~US$200/mês de X Basic no COGS de plano de criador brasileiro destrói margem sem demanda comprovada. Absorção no COGS só quando houver volume que justifique (métrica de demanda antes).

## 7. Incerteza de publicação: NEEDS_REVIEW — ✅ APROVADO
Na dúvida entre duplicar post público do cliente (dano visível, irreversível) e pedir confirmação humana (um clique), sempre `NEEDS_REVIEW`. Fallback conservador é o correto dado que APIs de terceiros nem sempre confirmam.

## 8. IA: números adiados, MECANISMO de teto obrigatório desde já — ✅ APROVADO COM AMARRAÇÃO

- Código nasce **agnóstico de provedor** (`AI_PROVIDER`) desde o dia 1 — inegociável.
- Franquias de créditos por plano e valores de teto: decisão de negócio, adiada para a v2.
- **O mecanismo de teto de custo é requisito de arquitetura, não placeholder**: toda operação de IA declara orçamento máximo e passa por um BudgetGuard (contadores por org/período + circuit breaker). O número é config; o mecanismo não é adiável. (SPEC_AI atualizada.)

## 9. Dois repositórios — ✅ APROVADO
`manypost` (público, AGPL) + `manypost-premium` (privado). Isolamento físico da fronteira vale mais que a DX de monorepo para time pequeno. Contratos versionados entre eles.

## 10. Atribuição visível ao Postiz — ✅ APROVADO
"Derived from Postiz (AGPL-3.0)" no README público, com commit analisado e lista de elementos derivados (POSTIZ_ANALYSIS §8). Transparência é estratégia (proteção reputacional na mesma comunidade), não só compliance.

---

## Pendências abertas (rastreadas no roadmap)

| # | Pendência | Fase | Dono |
|---|---|---|---|
| P1 | Validação jurídica da licença dos contratos (§1c) | Fase 0 | product owner + jurídico |
| P2 | Números de franquia/teto de IA (§8) | antes da v2 | product owner |
| P3 | Métrica de demanda que justifica absorver custo do X (§6) | v2+ | product owner |

**Status: liberado para fase 0 — esqueleto do repositório núcleo.**

---

# Adendo v1.1 (2026-07-10) — matriz de planos da landing e desdobramentos

> Fonte: matriz Grátis/Pro/Premium registrada pelo owner (detalhada em `docs/PLANS.md`, que passa a ser documento normativo junto deste). Terminologia: "plano Premium" (tier comercial) ≠ "código fechado" (repo manypost-premium).

## 11. Tokens semânticos de estado — ✅ APROVADO
A extensão `--state-*` proposta em `docs/brand/README.md §3` foi aceita e **promovida ao BRAND_SYSTEM.md oficial** (§3.1). Estados de publicação em todas as telas usam esses tokens.

## 12. Aprovação por link público — ✅ APROVADO PARA O NÚCLEO AGPL
Cliente aprova/pede ajuste por link público, sem login, vendo o preview como será renderizado. Código no núcleo (encaixa na aprovação simples do §1a); no gerenciado é gate Pro+. Specs atualizadas: DATA (tabela `approval_links`), API_MCP (superfície pública por token), FRONTEND (tela pública), ROADMAP (fase 1).

## 13. §6 SUPERSEDIDO em parte — X incluído no plano Pro do gerenciado
A landing promete "todas as redes — inclusive X" no Pro: o gerenciado **absorve** o custo do app X (não é mais traga-sua-chave lá). Mantido: self-host = BYO-key; plano Grátis sem X. **Condições de gestão de risco obrigatórias** (teto de posts por app do tier Basic do X): sub-limite de X na política de uso justo, métrica com alerta em 70% do teto, plano de contingência — detalhado em `docs/PLANS.md §4`.

## 14. Fronteira de código × gate de plano — mapeamento ratificado
Conforme `docs/PLANS.md §2`. Destaques: kanban completo/timeline/calendário, aprovação por link, analytics, API/MCP, IA de criação e **sugestão de melhor horário (heurística estatística)** = núcleo AGPL com gate comercial no SaaS; workspaces/permissões/auditoria estendida e toda a lista de IA operacional do plano Premium (respostas de comentários/DMs, classificação/roteamento, relatórios de campanha, alerta de perda de engajamento, otimização de calendário semanal) = código fechado. Análise de concorrentes: owner confirma que quer no produto; permanece código fechado, entra na matriz quando pronta (PL4).

## Pendências atualizadas
| # | Pendência | Fase |
|---|---|---|
| P1 | Parecer jurídico da licença dos contratos (inalterada) | fase 0 |
| P2/PL3 | Créditos de IA por plano | antes da v2 |
| P3→PL1 | Números da política de uso justo (geral + sub-limite X no Pro) | antes do lançamento do gerenciado |
| PL2 | Definição fina de "kanban básico" do plano Grátis | design da fase 1 |
| PL4 | Quando/onde análise de concorrentes entra na matriz | v2+ |
