## Context

The parent PR introduced `/v1/ai/image`, a provider-agnostic `generateImage` port and a compact
generation dialog. The port already had draft/standard placeholders, but the UI sent neither and
the OpenAI-compatible adapter relied on the provider default. Current `gpt-image-2` supports
`low`, `medium`, `high` and `auto`; the public product only needs a cheap iteration mode and a final
asset mode.

The change crosses the web client, generated OpenAPI contract, Hono route, core use case and
provider adapter. Existing plan gating, organization scoping, media storage, idempotency, byte
validation and provenance remain authoritative.

## Goals / Non-Goals

**Goals:**

- Make rendering cost/quality an explicit choice before a paid request.
- Keep the product enum stable and provider-neutral.
- Align the selected mode across the browser fingerprint, API validation, budget reservation,
  adapter request and audit detail.
- Preserve the existing dialog hierarchy and Manypost brand tokens.

**Non-Goals:**

- Letting clients select a model or raw provider parameter.
- Configuring multiple image model environment variables or automatic fallback.
- Editing images, adding output formats or changing aspect-ratio behavior.
- Changing plan allowance sizes or adding database fields.

## Decisions

### 1. Product modes are `economy` and `quality`

The route and core port use a closed `ImageQualityMode` union. `economy` maps to OpenAI `low`;
`quality` maps to `high`. The adapter owns this translation because provider vocabulary cannot
cross into the core. `medium` and `auto` stay out of the product API until a concrete product need
exists.

Alternative considered: retain `draft`/`standard`. Those labels do not tell a user that the choice
changes cost, and `standard` is not a valid GPT Image quality value. The parent PR has not merged,
so replacing these unused values has no deployed-client migration burden.

### 2. Omitted mode means economy

API and MCP callers that omit the field get `economy`. This prevents provider-default changes from
silently changing cost and avoids making the expensive path implicit.

Alternative considered: preserve provider `auto`. That defeats predictable metering and makes the
label shown by the UI diverge from the actual provider request.

### 3. Credits are mode-specific constants in core

`economy` reserves/commits 2 credits and `quality` reserves/commits 5. Both remain above a normal
text operation, while the higher-cost final render preserves the existing five-credit class. The
server, not the client, owns the map; the dialog imports only a mirrored presentation catalog whose
values are contract-tested.

Alternative considered: charge five credits for both. That would hide the economic benefit the
choice promises and provide no allowance incentive for iterative drafts.

### 4. The existing dialog gains one segmented field

The selector sits between prompt and aspect, uses native buttons with `aria-pressed`, visible focus,
the existing radius/color tokens and concise helper copy. No new dependency, animation or layout
container is introduced. Economy is initially selected.

### 5. Idempotency includes mode

The browser fingerprint includes the selected mode because it changes provider cost and output.
Unchanged transport retries reuse the same key; changing mode creates a new logical request. The
server's existing body-hash conflict protection remains unchanged.

### 6. Generated contract remains generated

`apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts` are regenerated only with:

```bash
API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
```

No generated file is edited manually.

## Risks / Trade-offs

- **[High quality is materially more expensive]** → default to economy and show both credit costs
  before the click.
- **[Presentation cost catalog drifts from core]** → cover API charging and UI labels with focused
  tests and the real-API E2E.
- **[Provider rejects a quality value]** → use only values documented for GPT Image models and
  keep the mapping inside the adapter test suite.
- **[Changing mode after a network failure could replay the wrong result]** → include mode in the
  idempotency fingerprint; the server also rejects same-key/different-body conflicts.
- **[Audit detail expands]** → record only mode, aspect and credits; never prompt, bytes, key or
  credentials.

## Migration Plan

1. Deploy API and web together; no database or environment migration is required.
2. Confirm `AI_IMAGE_MODEL` remains `gpt-image-2` in the target environment without reading or
   logging its credential.
3. Smoke-test one economical generation and inspect the request/result behavior.
4. Quality generation is opt-in and can be validated manually when accepting its external cost.
5. Roll back by reverting this change and regenerating the web contract. Existing media and credit
   rows remain valid.

## Security and Observability

The route validates a closed enum before entering the use case. The provider model remains
server-side configuration. Audit detail gains only `mode` and `credits`; prompts retain their
existing media-provenance handling and remain absent from audit logs.

## Compatibility

Omitted mode remains valid. The unused `draft`/`standard` values from the unmerged parent PR are
intentionally replaced rather than supported as aliases, preventing two vocabularies from becoming
permanent. No Railway setting, database schema or external provider fallback changes.

## Open Questions

None.
