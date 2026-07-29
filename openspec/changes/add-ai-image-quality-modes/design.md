## Context

The parent PR introduced `/v1/ai/image`, a provider-agnostic `generateImage` capability and a
compact generation dialog. The port already had draft/standard placeholders, but the UI sent
neither and the OpenAI-compatible adapter relied on the provider default. Current `gpt-image-2`
supports `low`, `medium`, `high` and `auto`; the public product only needs a cheap iteration mode
and a final asset mode.

Image generation is currently attached as an optional method of the text `AiProvider`. Its endpoint,
credential and protocol therefore always come from `AI_PROVIDER`, `AI_BASE_URL` and `AI_API_KEY`.
Changing the image API can unexpectedly change captions and rewrites too. It also means adding a
native image protocol would require modifying a text adapter instead of registering an isolated
image adapter.

The change crosses the web client, generated OpenAPI contract, Hono route, core use case and
provider adapter. Existing plan gating, organization scoping, media storage, idempotency, byte
validation and provenance remain authoritative.

## Goals / Non-Goals

**Goals:**

- Make rendering cost/quality an explicit choice before a paid request.
- Keep the product enum stable and provider-neutral.
- Align the selected mode across the browser fingerprint, API validation, budget reservation,
  adapter request and audit detail.
- Allow image and text providers to use independent protocols, endpoints and credentials.
- Preserve the current image configuration through an explicit compatibility inheritance rule.
- Make a new image protocol local to a provider adapter plus one factory registration.
- Preserve the existing dialog hierarchy and Manypost brand tokens.

**Non-Goals:**

- Letting clients select a model or raw provider parameter.
- Automatic runtime fallback between image providers after an upstream failure.
- Shipping a second native image protocol in this change.
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

### 7. Image generation has its own port and adapter factory

Core exposes an `ImageGenerationProvider` containing only `generateImage`. `AiProvider` remains the
text/vision port and no longer owns image generation. The image use case depends directly on the
smaller port, and the API composition root builds text and image providers independently.

`makeImageGenerationProvider` is the only protocol selection point. Initially it registers the
`openai-compatible` image adapter. A future native protocol adds one adapter and one factory branch;
routes, use cases, metering, storage and browser code remain unchanged.

Alternative considered: construct the existing text provider and copy its optional
`generateImage` method. That would make independent configuration possible but preserve the wrong
coupling and make protocol additions harder to review.

### 8. Image environment settings are independent with compatibility inheritance

The resolved image configuration uses:

- `AI_IMAGE_PROVIDER`: optional image protocol; currently `openai-compatible` or `none`;
- `AI_IMAGE_BASE_URL`: optional independent endpoint;
- `AI_IMAGE_API_KEY`: optional independent credential, including an explicitly empty value for
  local runtimes without authentication;
- `AI_IMAGE_MODEL`: the existing explicit image capability opt-in.

Resolution is deterministic:

1. Without `AI_IMAGE_MODEL`, image generation is disabled.
2. With `AI_IMAGE_PROVIDER=none`, image generation is disabled even if a model is present.
3. With an explicit non-`none` image provider, `AI_IMAGE_BASE_URL` is required and the image key
   comes only from `AI_IMAGE_API_KEY`.
4. When `AI_IMAGE_PROVIDER` is omitted, protocol, base URL and key inherit from the text
   configuration. Inheritance supports only a text protocol that has a registered image adapter;
   otherwise the installation fails closed and names `AI_IMAGE_PROVIDER`.

This keeps current deployments working while making an explicit image provider fully independent.
The API key remains optional because local OpenAI-compatible runtimes legitimately have no
credential.

Like `AI_BASE_URL`, `AI_IMAGE_BASE_URL` is trusted operator configuration and intentionally does
not pass through the user-input SSRF classifier. Private endpoints are a legitimate self-hosted
deployment target; the value remains server-only and is never accepted from a browser request.

Alternative considered: silently inherit each missing image field independently. That can
accidentally send an image request to a new endpoint with the text provider's secret. Explicit image
configuration is therefore all-or-nothing for endpoint and credential ownership.

### 9. The audit attempt settles before generation success returns

The image use case awaits the audit append before returning successful media. The append remains
best-effort: an audit repository failure is contained because the provider call, allowance commit,
media storage and media record have already completed, and converting that completed operation into
an error would invite an unsafe duplicate generation outside idempotent HTTP callers.

This ordering removes a race where an immediate consumer receives HTTP 200 and queries `audit_log`
before the corresponding row exists. It also makes the real-API E2E deterministic without polling
or weakening its assertion.

Alternative considered: keep the fire-and-forget append and make tests retry. That preserves the
race in production and teaches the test to tolerate an observability gap instead of enforcing the
request boundary.

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
- **[Independent endpoint accidentally receives the text credential]** → never inherit a key when
  `AI_IMAGE_PROVIDER` is explicit; only the compatibility mode inherits the complete connection.
- **[Configured text protocol has no image adapter]** → fail closed at boot with the missing
  `AI_IMAGE_PROVIDER` contract instead of exposing a button that fails after reserving credits.
- **[Existing deployment only defines `AI_IMAGE_MODEL`]** → retain whole-connection inheritance
  when the image provider is omitted.
- **[Audit storage is slow or unavailable after generation completes]** → await the append attempt
  for deterministic ordering, but contain its failure so a completed paid generation is not
  presented as safe to retry.

## Migration Plan

1. Deploy API and web together; no database migration is required.
2. Existing deployments may keep only `AI_IMAGE_MODEL`; the resolved image connection inherits
   the text provider unchanged.
3. To decouple images, set the image provider, base URL, optional key and model together without
   removing the text settings.
4. Smoke-test one economical generation and inspect the request/result behavior.
5. Quality generation is opt-in and can be validated manually when accepting its external cost.
6. Roll back by removing optional image-specific settings and reverting this change. Existing media
   and credit rows remain valid.

## Security and Observability

The route validates a closed enum before entering the use case. Provider endpoint, model and
credential remain server-side configuration. Text and image credentials are never logged, copied
to specs or returned through capabilities. Audit detail gains only `mode` and `credits`; prompts
retain their existing media-provenance handling and remain absent from audit logs.

## Compatibility

Omitted mode remains valid. The unused `draft`/`standard` values from the unmerged parent PR are
intentionally replaced rather than supported as aliases, preventing two vocabularies from becoming
permanent. Existing `AI_IMAGE_MODEL` deployments inherit their current text provider connection.
There is no database schema or external runtime-fallback change.

## Open Questions

None.
