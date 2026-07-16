# apps/web

Frontend Next.js (App Router) + Tailwind v4 + primitivas Radix no padrão shadcn/ui, com o tema mapeado 1:1 do brand system (`docs/brand/`). **Onda 1 implementada:** login/registro (+ social), shell autenticado (sidebar/topbar) e Conexões (catálogo de providers + canais, OAuth em popup e conexão por credenciais). Calendário/kanban/mídia/notificações/configurações são placeholders.

## Rodar em dev

```bash
# 1. API (precisa de Postgres/Redis — ver STATUS.md §5) em outra porta:
PORT=3100 PUBLIC_URL=http://localhost:3000 MODE=api ... bun run dev

# 2. web (proxeia /v1 e /uploads p/ API_URL):
API_URL=http://localhost:3100 bun run dev:web   # → http://localhost:3000
```

**Modelo de origem única:** o Next serve a UI e proxeia `/v1` e `/uploads` para a API (`next.config.ts`), preservando os caminhos — os cookies httpOnly (`mp_at`, `mp_rt` com `Path=/v1/auth`, marcador `mp_session`) ficam first-party. Em produção, o `PUBLIC_URL` da API deve ser a origem do web.

## Cliente da API

Gerado de `/openapi.json` (`openapi-typescript` + `openapi-fetch`), snapshot versionado em `openapi.json`:

```bash
API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
```

Nenhum `fetch` manual fora de `src/lib/api/client.ts` (que também faz refresh-em-401 deduplicado). 1 recurso = 1 hook (`src/features/*/hooks.ts`).

## Regras de conformidade (CI: `bun run check:brand`)

Hex só em `globals.css`; zero `shadow-*`; zero transform em hover; radius 4/6/8 (full só avatar); wordmark `manypost` minúsculo. Fontes Inter + Plus Jakarta Sans via `next/font`. Foco por `outline` (ring do shadcn é box-shadow — não usar).

**Nunca rode `shadcn@latest init/add`** (instala Base UI e quebra o kit) — primitivas novas entram por `src/components/ui/*` seguindo a API do kit do shadrix (`get_component`/`get_code_snippet` no MCP) adaptada ao brand.
