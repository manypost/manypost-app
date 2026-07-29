## Why

Image generation currently exposes no quality choice, so every user-facing request relies on the
provider default even though `gpt-image-2` offers materially different cost and rendering profiles.
Users need an explicit economical draft path and an explicit final-quality path before they spend
allowance.

## What Changes

- Add two closed image-generation modes: `economy` and `quality`.
- Map `economy` to the provider's low rendering quality and `quality` to high rendering quality;
  both continue to use the configured `AI_IMAGE_MODEL`.
- Add an independent image-provider configuration (`AI_IMAGE_PROVIDER`, `AI_IMAGE_BASE_URL`,
  `AI_IMAGE_API_KEY` and `AI_IMAGE_MODEL`) so an operator can change an OpenAI-compatible image
  service without changing the text provider or application code.
- Preserve existing installations by inheriting the text provider protocol, base URL and API key
  when `AI_IMAGE_PROVIDER` is omitted.
- Separate the provider-neutral image port and adapter factory from text generation so a future
  native image protocol requires only an infra adapter and factory registration.
- Default omitted API input to `economy`, avoiding an implicit high-cost request.
- Charge 2 credits for an economical image and 5 credits for a quality image, declaring the cost
  before submission.
- Add a compact, accessible selector to the existing generation dialog without redesigning its
  layout.
- Include the selected mode and charged credits in the non-sensitive audit detail.
- Settle the audit append before exposing a successful response, so immediate consumers and
  operational checks do not race a fire-and-forget write.

## Goals

- Let a person knowingly choose between quick iteration and final rendering.
- Keep provider-specific quality vocabulary inside the adapter.
- Let an operator switch an OpenAI-compatible image API through environment configuration only.
- Keep image configuration independent from text configuration while preserving the current
  inherited configuration as a compatibility path.
- Preserve image idempotency, plan gating, tenant scoping, byte validation and provenance.
- Make the browser request, credit reservation and provider request agree on one mode.

## Non-goals

- Automatic runtime fallback between image providers or model selection by the browser.
- Implementing a second native image protocol in this change.
- Editing existing images, generating multiple variants or adding new image sizes.
- Repricing text-generation operations or changing plan allowances.
- Redesigning the media library, composer or generation dialog.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-image-generation`: define the two selectable modes, their safe provider mapping, defaults,
  metering, UI disclosure and idempotent behavior.

## Impact

- **Code/API:** changes the `/v1/ai/image` body, core image-generation port/use case, OpenAI-compatible
  adapter, adapter composition, MCP tool input, generated web client and existing dialog.
- **Data:** no schema or migration; the existing media provenance remains unchanged.
- **Security:** the client sends a closed mode enum, never a model name or arbitrary provider
  parameter. Prompts and credentials remain excluded from logs and specs. The audit append settles
  before success is returned, without turning a completed paid generation into a retryable failure
  if the audit repository itself is unavailable.
- **Compatibility:** the optional legacy `draft` and `standard` request values introduced only on
  the still-unmerged parent PR are replaced by `economy` and `quality`. Omitting the field remains
  valid and now deterministically means `economy`.
- **Product identity:** no Postiz/Manypost names change; classification is not applicable.
- **Railway:** adds optional image-specific environment variables but no service or topology
  change. Existing deployments remain valid because omitted image-provider settings inherit the
  text provider connection.

## Rollback

Revert the API, core, config and web changes together and regenerate the OpenAPI client. Stored
media and credit ledgers need no migration or repair. Deployments using only the inherited
configuration need no environment rollback; deployments using independent image settings can
remove those optional variables before or after reverting.
