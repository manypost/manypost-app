## Context

Five local serializer copies in `apps/api` drifted: MCP dropped `media`/`attemptCount` from
publications, the public feed dropped the additive fields the internal feed gained (`publishedAt`,
`updatedAt`, `mediaPreview`), and public media dropped `source`. The keyset cursor pair is
byte-identical in two routes. Every future additive field would have to be remembered in up to
three places, which is how the divergence happened.

## Decisions

### 1. One module inside `apps/api`, not a package

The serializers translate core read models into wire shapes for this app's surfaces. They belong
to the API composition (`apps/api/src/http/serialize.ts`), not to `packages/core` (which must not
know wire formats) nor `packages/contracts` (which holds types, not logic). The MCP server imports
from the same module; MCP runs over Streamable HTTP inside the same app, and the point is exactly
that it must not have its own shape.

### 2. Divergences resolve toward the richer shape

Every divergence is an omission, so unification is additive everywhere: MCP gains `media` and
`attemptCount`; public v1 gains `publishedAt`, `updatedAt`, `mediaPreview` and `source`. The
alternative — projecting deliberate subsets per surface — would preserve the machinery that caused
the drift and would keep the MCP agent blind to fields the same credential can already read over
REST.

### 3. Cursor behavior is part of the contract

`encodeCursor`/`decodeCursor` move with the serializers, keeping the documented fail-safe: a
malformed cursor selects the first page and leaks no parse detail. The format does not change, so
cursors issued before this change keep paging after it.

### 4. Documentation schemas stay route-local

The zod `.openapi()` schemas remain in the route files (they are documentation, with
surface-specific names like `PubFeedItem`), but they are extended to match the shared runtime
serializers. The generated client is refreshed through a disposable local stack
(`generate:api`), reviewing `openapi.json` and `schema.d.ts` together as required.

## Risks / Trade-offs

- **[Public consumers with strict parsers]** → additive-only fields; Keep a Changelog entry names
  them so an operator can pin expectations.
- **[MCP payload grows]** → the added fields are small scalars plus the media references already
  bounded per publication (max 10).
- **[Route docs drift from the shared runtime shape]** → the focused serializer test asserts the
  canonical shape, and the E2E scripts assert the new fields against the real API in CI.
