## 1. Contract test-first

- [x] 1.1 Add failing tests in `apps/api/src/http/serialize.test.ts` covering group serialization
  (`media`, `attemptCount` present per publication), feed serialization (`publishedAt`,
  `updatedAt`, `mediaPreview`), media serialization (`source`) and cursor roundtrip plus
  malformed-cursor fail-safe; record the RED.
- [x] 1.2 Implement `apps/api/src/http/serialize.ts` and return the focused file to GREEN.

## 2. Consumers

- [x] 2.1 Swap `posts.routes.ts`, `publications.routes.ts` and `media.routes.ts` to the shared
  module, deleting the local copies; `serializeGroupDetail` keeps building on the shared base.
- [x] 2.2 Swap `mcp/mcp-server.ts` to the shared `serializeGroup`, so MCP post tools expose
  `media` and `attemptCount`.
- [x] 2.3 Swap `public/public-v1.routes.ts` to the shared module and extend the `PubFeedItem`
  (`publishedAt`, `updatedAt`, `mediaPreview`) and `PubMedia` (`source`) documentation schemas.
- [x] 2.4 Verify by search that no route or MCP tool declares a local serializer or cursor copy.

## 3. Generated contract and E2E

- [x] 3.1 Extend `scripts/e2e-mcp.ts` and `scripts/e2e-public.ts` to assert the newly exposed
  fields against the real API.
- [x] 3.2 Boot a disposable local stack, run
  `API_URL=<local> bun run --cwd apps/web generate:api` and review `apps/web/openapi.json` and
  `apps/web/src/lib/api/schema.d.ts` together.

## 4. Validation and delivery

- [x] 4.1 Run `bun run check` and `bun run build:web`.
- [x] 4.2 Update `CHANGELOG.md`, run `bun run spec:validate` and `git diff --check`.
