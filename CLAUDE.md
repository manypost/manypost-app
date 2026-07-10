# CLAUDE.md — manypost (núcleo AGPL)

Plataforma de agendamento/publicação multicanal. **O wordmark é sempre `manypost`, em caixa baixa — inclusive em início de frase e `<title>`.**

## Leia antes de trabalhar

| Se a tarefa é... | Leia primeiro |
|---|---|
| **Qualquer frontend/UI** | `docs/brand/BRAND_SYSTEM.md` (obrigatório) + `docs/brand/README.md` (adaptação p/ o app) + `docs/specs/SPEC_FRONTEND.md` |
| Backend/API | `docs/specs/SPEC_BACKEND.md`, `docs/specs/SPEC_API_MCP.md` |
| Fila/publicação | `docs/specs/SPEC_QUEUE_PUBLISHING.md` |
| Providers de rede social | `docs/specs/SPEC_INTEGRATIONS.md` + `docs/platform-gates.md` |
| Docs de usuário: credenciais das redes | `docs/INTEGRATIONS_SETUP.md` (linguagem leiga — manter assim) |
| Banco | `docs/specs/SPEC_DATA.md` |
| Decisões já tomadas (não re-litigar) | `docs/DECISIONS.md` (v1 + adendo v1.1) |
| Planos do SaaS e gates de feature | `docs/PLANS.md` — "plano Premium" (tier) ≠ "código fechado" (repo privado) |
| Origem/licença | `ATTRIBUTION.md` — derivado do Postiz (AGPL-3.0) |

## Regras invioláveis

1. **AGPL/premium:** nada neste repo importa ou referencia código premium; o núcleo roda 100% self-hosted sozinho.
2. **Fronteiras:** `packages/core` não importa de `apps/*` nem de `packages/{db,providers}` (CI: dependency-cruiser). `packages/contracts` contém só tipos/schemas/constantes — zero lógica — e **não é publicado** até o parecer jurídico (DECISIONS §1c).
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
bun run check        # typecheck + testes + fronteiras + grep de IA
```

Referência local do código do Postiz estudado: `../_ref/postiz-app` (commit `84edda5`).
