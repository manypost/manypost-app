# CLAUDE.md — manypost (100% Open Source / AGPL-3.0 Monorepo)

Plataforma de agendamento/publicação multicanal. **O wordmark é sempre `manypost`, em caixa baixa — inclusive em início de frase e `<title>`.**

> **COMECE POR [`docs/principal/STATUS.md`](docs/principal/STATUS.md)** — estado atual, o que já funciona (com provas), o que falta (com referência de spec por item) e como rodar os E2E. O índice de toda a documentação está em [`docs/README.md`](docs/README.md). O clone do Postiz para consulta está em `../_ref/postiz-app` (marque derivações — ver [ATTRIBUTION.md](ATTRIBUTION.md)).
>
> **Nota (mudou em 2026-07-22):** `docs/principal/` **é versionado e público** como o resto do repositório. Se o código é 100% aberto, esconder o planejamento não protege nada e só dificulta a contribuição. Consequência prática: **nunca** escreva segredo, chave, id de conta de faturamento ou dado pessoal em qualquer doc — use marcadores (`sk_test_...`).
>
> **⚠️ ANTES DE CODAR — o [`AGENTS.md`](AGENTS.md) da raiz é o contrato operacional e prevalece sobre este arquivo.** Ele torna o **fluxo OpenSpec obrigatório**: feature, mudança de comportamento, schema, **integração/provider**, deploy ou refatoração entre módulos exigem uma mudança em `openspec/changes/` **antes** da implementação (`bun run spec:new`, instruções do CLI por artefato, `bun run spec:validate`). Só correção ortográfica ou edição estritamente local sem mudança de comportamento dispensa — e o PR precisa justificar. Guia: [`docs/openspec.md`](docs/openspec.md).
>
> **Ao fechar uma fatia — são DOIS registros, não um:**
> 1. **`CHANGELOG.md` da raiz** (Keep a Changelog) + a mudança OpenSpec correspondente — exigidos pelo `AGENTS.md`;
> 2. **`docs/principal/STATUS.md`** + uma entrada no topo de [`docs/principal/CHANGELOG_ONDAS.md`](docs/principal/CHANGELOG_ONDAS.md) — a narrativa por ondas deste arquivo. O STATUS é sobre o presente (enxuto); o CHANGELOG_ONDAS guarda o histórico com as provas.
>
> Esquecer o item 1 já aconteceu (onda 17, regularizada depois): `docs/principal/` é narrativa do projeto, **não substitui** o changelog nem o OpenSpec.

## Leia antes de trabalhar

| Se a tarefa é... | Leia primeiro |
|---|---|
| **Qualquer frontend/UI** | `docs/brand/BRAND_SYSTEM.md` (obrigatório) + `docs/brand/README.md` (adaptação p/ o app) + `docs/specs/SPEC_FRONTEND.md` |
| Backend/API | `docs/specs/SPEC_BACKEND.md`, `docs/specs/SPEC_API_MCP.md` |
| Fila/publicação | `docs/specs/SPEC_QUEUE_PUBLISHING.md` |
| Providers de rede social | `docs/specs/SPEC_INTEGRATIONS.md` + `docs/principal/platform-gates.md` |
| Docs de usuário: credenciais das redes | `docs/principal/INTEGRATIONS_SETUP.md` (linguagem leiga — manter assim) |
| Banco | `docs/specs/SPEC_DATA.md` |
| Decisões já tomadas (não re-litigar) | `docs/principal/DECISIONS.md` (v1 + adendo v1.1 + adendo Open Source v1.2) |
| Planos do SaaS e gates de feature | `docs/principal/PLANS.md` — enforcement via feature flags `IS_SELF_HOSTED`/`HIDE_BILLING` no monorepo 100% aberto |
| Origem/licença | `ATTRIBUTION.md` — derivado do Postiz (AGPL-3.0), monorepo unificado 100% open source |
| Achar qualquer outro documento | [`docs/README.md`](docs/README.md) — índice com rota por perfil e regras de manutenção da doc |

## Regras invioláveis

1. **100% Open Source (Monorepo Único):** todo o código da aplicação (inclusive IA operacional, workspaces e enforcement de billing) vive no monorepo sob AGPL-3.0. A separação entre uso grátis self-hosted e SaaS na nuvem ocorre via variáveis de ambiente (`IS_SELF_HOSTED`, `HIDE_BILLING`).
2. **Fronteiras:** `packages/core` não importa de `apps/*` nem de `packages/{db,providers}` (CI: dependency-cruiser). `packages/contracts` está sob AGPL-3.0 junto com o monorepo e contém só tipos/schemas/constantes — zero lógica.
3. **Multi-tenant:** todo repositório/query filtra por `org_id`.
4. **IA agnóstica:** nenhum provedor nominal (openai/anthropic/etc.) fora de `infra/ai/*` (CI: `bun run check:ai-providers`). Toda operação de IA passa pelo BudgetGuard.
5. **Segurança:** tokens de canal cifrados (AES-256-GCM com `ENCRYPTION_KEY` dedicada); nunca logar tokens; nunca repostar em incerteza (`NEEDS_REVIEW`).
6. **Derivação:** trecho portado de forma reconhecível do Postiz leva `// Derived from Postiz (AGPL-3.0): <arquivo>`.

## Regras visuais (resumo — a fonte é docs/brand/)

- **Zero sombras** (`box-shadow` proibido, sempre). **Profundidade pervasiva por gradiente (brand v1.3) — nada de superfície flat:** a direção codifica a função — superfícies/controles **sobem** (botões, cards, overlays, sidebar, aba ativa, estados selecionados: `.bevel-*`), badges e caixas de tint ganham **brilho** (`.bevel-chip`), campos **afundam** (input/select/textarea: `.inset-field`, direção invertida). Só o fundo da página e o texto puro ficam sem volume. Tudo via gradiente + borda por lado; hover de relevo por `filter: brightness()`. Fonte: BRAND §2.2/§3.1/§6/§7.
- **Hover estável**: nada de `translateY`/`scale`/`rotate` no hover; flat transiciona cor 0.2s, relevo usa `filter: brightness()` 0.2s.
- **Cursor**: todo botão usa `cursor: pointer`.
- Cores **somente via tokens CSS** do brand system (nunca hex ad-hoc; o relevo deriva dos tokens via `color-mix` só em `globals.css`); radius só 4/6/8px.
- Fontes: Inter (UI/corpo) + Plus Jakarta Sans (títulos/marca), self-hosted via `next/font`.
- Light-first: o app v1 é light-only.

## Comandos

```bash
bun install
bun run dev          # apps/api (MODE via .env)
bun run dev:worker   # apps/worker
bun run dev:all      # api (:3100) + web (:3000)
bun run check        # typecheck + testes + fronteiras + grep de IA + brand
```

Referência local do código do Postiz estudado: `../_ref/postiz-app` (commit `84edda5`).
