# apps/web

Frontend Next.js + shadcn/ui (SPEC_FRONTEND). Scaffold na fase 0 com:

```bash
bunx create-next-app@latest . --ts --tailwind --app --src-dir --no-eslint
bunx shadcn@latest init
```

Depois: cliente OpenAPI gerado de `apps/api /openapi.json` (`openapi-typescript` + `openapi-fetch`), TanStack Query, Zustand no composer. Nenhum `fetch` manual fora do cliente gerado (lint).
