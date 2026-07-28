## Why

The image-generation adapter sends an optional response-format parameter that
the currently supported image endpoint rejects, so a configured installation
advertises generation but every real request fails before producing media.

## What Changes

- Send only parameters accepted by the image-generation protocol while
  continuing to read the base64 image returned by that endpoint.
- Add a regression test for the exact outbound request.
- Document and validate the staging configuration without storing credentials
  in the repository or deployment evidence.

## Goals

- Make the existing image-generation flow work against the configured
  protocol-compatible endpoint.
- Preserve one-image generation, aspect normalization, validation,
  provenance, idempotency and credit accounting.

## Non-goals

- Migrate text generation to another API surface or model family.
- Add image editing, streaming, multiple candidates or new UI.
- Change billing, plans, storage, schema or public API contracts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-runtime`: require adapters to omit unsupported optional request
  parameters while preserving the protocol's base64 image response.

## Compatibility

The change removes an optional outbound field and does not alter Manypost's
HTTP contract. Protocol-compatible providers that already ignored the field
continue to work; providers that reject it become usable.

## Impact

- Code: `packages/core/src/infra/ai/chat-completions.ts` and its focused test.
- Data: none; no migration or stored-data transformation.
- Security: credentials remain server-only and must not appear in tests,
  documentation, logs or PR evidence.
- Product identity: no Postiz or Manypost naming changes.
- Railway: no service, domain, volume or required-variable change. Production
  remains untouched; only the user-designated Coolify staging is configured.

## Rollback

Revert the adapter commit and redeploy the previous revision. Coolify variables
can be restored or removed independently; no data rollback is required.
