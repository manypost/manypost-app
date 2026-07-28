## Context

The protocol adapter owns the outbound image-generation payload. Its current
request includes an optional response-format field even though the configured
endpoint returns base64 image data by default and rejects that field. The use
case, route and UI are not involved in this incompatibility.

## Goals / Non-Goals

**Goals:**

- Keep protocol-specific request details inside the infrastructure adapter.
- Exercise the exact outbound JSON shape in a focused test.
- Preserve every downstream validation and persistence guarantee.

**Non-Goals:**

- Change the provider port, use case, HTTP schema, UI or database.
- Migrate text generation or introduce provider-name conditionals.
- Persist or expose deployment credentials.

## Decisions

1. Remove the unsupported optional field rather than branching on a model
   identifier. The endpoint already returns base64 image data, and a
   model-name branch would leak vendor lifecycle into a protocol adapter.
2. Assert field absence in the existing adapter unit test. This layer already
   captures the outgoing request and is the narrowest place that reproduces the
   failure.
3. Keep the generated-image response parser unchanged because the returned
   `data[0].b64_json` contract remains the same.
4. No generated files are affected; no regeneration command is needed.

## Risks / Trade-offs

- A non-conforming gateway may have required the removed optional field. →
  Such a gateway is outside the endpoint behavior used by the configured
  staging provider; the response parser still requires base64 data and fails
  honestly otherwise.
- Runtime configuration can make the feature visible before a compatible
  deployment finishes. → Update variables immediately before a redeploy and
  validate the resulting capability and a real generation.

## Migration Plan

1. Ship the adapter test and one-field request correction in PR #54.
2. Configure the existing Coolify staging application without synchronizing
   unrelated variables.
3. Redeploy the PR branch and run capability, HTTP and real-generation checks.
4. Roll back by redeploying the preceding commit and restoring/removing only
   the five AI variables; no data migration is involved.

## Security and Observability

The credential is accepted only through the deployment platform's environment
API and is never written to the worktree, test fixtures, documentation or PR.
Validation reports status, model identifiers and stable error codes only.

## Open Questions

None.
