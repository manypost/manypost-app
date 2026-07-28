## Why

Image generation currently exposes no quality choice, so every user-facing request relies on the
provider default even though `gpt-image-2` offers materially different cost and rendering profiles.
Users need an explicit economical draft path and an explicit final-quality path before they spend
allowance.

## What Changes

- Add two closed image-generation modes: `economy` and `quality`.
- Map `economy` to the provider's low rendering quality and `quality` to high rendering quality;
  both continue to use the single configured `AI_IMAGE_MODEL`.
- Default omitted API input to `economy`, avoiding an implicit high-cost request.
- Charge 2 credits for an economical image and 5 credits for a quality image, declaring the cost
  before submission.
- Add a compact, accessible selector to the existing generation dialog without redesigning its
  layout.
- Include the selected mode and charged credits in the non-sensitive audit detail.

## Goals

- Let a person knowingly choose between quick iteration and final rendering.
- Keep provider-specific quality vocabulary inside the adapter.
- Preserve image idempotency, plan gating, tenant scoping, byte validation and provenance.
- Make the browser request, credit reservation and provider request agree on one mode.

## Non-goals

- Supporting two image model identifiers, automatic provider fallback or model selection by the
  browser.
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
  adapter, MCP tool input, generated web client and existing dialog.
- **Data:** no schema or migration; the existing media provenance remains unchanged.
- **Security:** the client sends a closed mode enum, never a model name or arbitrary provider
  parameter. Prompts and credentials remain excluded from logs and specs.
- **Compatibility:** the optional legacy `draft` and `standard` request values introduced only on
  the still-unmerged parent PR are replaced by `economy` and `quality`. Omitting the field remains
  valid and now deterministically means `economy`.
- **Product identity:** no Postiz/Manypost names change; classification is not applicable.
- **Railway:** no environment, service or deployment-topology change. `AI_IMAGE_MODEL` remains the
  sole image-model opt-in.

## Rollback

Revert the API, core and web changes together and regenerate the OpenAPI client. Stored media and
credit ledgers need no migration or repair; deployments can return to the previous provider-default
behavior without changing environment variables.
