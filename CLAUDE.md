# CLAUDE.md — manypost (100% Open Source / AGPL-3.0 Monorepo)

Plataforma de agendamento/publicação multicanal. **O wordmark é sempre `manypost`, em caixa baixa — inclusive em início de frase e `<title>`.**

> **COMECE POR [`docs/principal/STATUS.md`](docs/principal/STATUS.md)** — estado atual, o que já funciona (com provas), o que falta (com referência de spec por item) e como rodar os E2E. O índice de toda a documentação está em [`docs/README.md`](docs/README.md). O clone do Postiz para consulta está em `../_ref/postiz-app` (marque derivações — ver [ATTRIBUTION.md](ATTRIBUTION.md)).
>
> **Nota (mudou em 2026-07-22):** `docs/principal/` **é versionado e público** como o resto do repositório. Se o código é 100% aberto, esconder o planejamento não protege nada e só dificulta a contribuição. Consequência prática: **nunca** escreva segredo, chave, id de conta de faturamento ou dado pessoal em qualquer doc — use marcadores (`sk_test_...`).
>
> **Ao fechar uma fatia:** atualize o STATUS **e** abra uma entrada no topo de [`docs/principal/CHANGELOG_ONDAS.md`](docs/principal/CHANGELOG_ONDAS.md). O STATUS é sobre o presente (enxuto); o changelog guarda o histórico com as provas.

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
5. **Segurança:** tokens de canal cifrados (AES-256-GCM, `ENCRYPTION_KEY` ≠ `JWT_SECRET`); nunca logar tokens; nunca repostar em incerteza (`NEEDS_REVIEW`).
6. **Derivação:** trecho portado de forma reconhecível do Postiz leva `// Derived from Postiz (AGPL-3.0): <arquivo>`.

## Regras visuais (resumo — a fonte é docs/brand/)

- **Zero sombras** (`box-shadow` proibido) — hierarquia por borda `1px solid var(--line)` e camadas de fundo.
- **Hover estável**: só transição de cor 0.2s; `translateY`/`scale` no hover são proibidos.
- Cores **somente via tokens CSS** do brand system (nunca hex ad-hoc); radius só 4/6/8px.
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
