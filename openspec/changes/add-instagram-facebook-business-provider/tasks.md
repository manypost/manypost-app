> **Process note:** the implementation preceded this checklist (see `proposal.md`). Boxes are checked
> only where the evidence exists in the diff and the named command was actually executed.

## 1. Shared Meta Graph module

- [x] 1.1 Extract the Graph request wrapper and the Page discovery routine (direct listing plus
      Business Manager, paginated and deduplicated) into `packages/providers/src/shared/meta-graph.ts`,
      taking the field list as a parameter
- [x] 1.2 Point `packages/providers/src/facebook/facebook.provider.ts` at the shared module and delete
      its local copies
- [x] 1.3 Confirm the extraction is behavior-preserving with the existing Facebook golden tests:
      `bun test packages/providers/src/facebook`

## 2. Provider contract and connection

- [x] 2.1 Add the failing golden tests for the authorization URL, the two-step token exchange, the
      declined-consent rejection and credential renewal
- [x] 2.2 Implement `getAuthUrl`, `exchangeCode` and `refreshToken` in
      `packages/providers/src/instagram/instagram.provider.ts`
- [x] 2.3 Declare capabilities (media required, 2200 characters, carousel of 10, replies as comments)
      and the settings schema with the destination and post-type fields
- [x] 2.4 Register the provider in `packages/providers/src/index.ts`

## 3. Destination selection and credential derivation

- [x] 3.1 Add the failing tests for sub-account listing: Pages without a linked Instagram account are
      excluded, the label uses the Instagram handle, an unavailable Business Manager does not fail the
      listing, and the payload carries no access token
- [x] 3.2 Implement `listSubAccounts` returning the Page identifier as the stored value
- [x] 3.3 Implement the single-request derivation of the Page access token and the Instagram account
      identifier, used to authorize every publishing request
- [x] 3.4 Assert in tests that publishing requests are authorized by the derived Page token and not by
      the stored user credential

## 4. Publication paths and retry safety

- [x] 4.1 Add the failing tests for photo, reel, carousel and story containers
- [x] 4.2 Implement the container, status-poll and publish sequence with a polling budget shared by
      parent and carousel children
- [x] 4.3 Add the failing tests for retry safety: multi-item story rejected before any external call,
      container failure before publish, permalink failure not raised after acceptance
- [x] 4.4 Implement replies as comments and reject media on replies in `validateMedia`
- [x] 4.5 Implement and test the error classification for credential, transient and permanent failures

## 5. Configuration and machine surfaces

- [x] 5.1 Map the provider to the existing Facebook application variable pair in
      `packages/config/src/env.ts`, without adding a variable
- [x] 5.2 Extend `scripts/e2e-auth.ts` with the catalogue assertions and the authorization-URL check
- [x] 5.3 Document in `.env.example` that the Facebook variable pair enables both networks

## 6. Web surfaces

- [x] 6.1 Register the destination field in the composer sub-account map
- [x] 6.2 Add the Portuguese labels, hints and option names for the new settings
- [x] 6.3 Reuse the Instagram preview for the new provider and update the connection catalogue copy
- [x] 6.4 Confirm the production web build: `bun run build:web`
- [x] 6.5 Confirm the API catalogue snapshot is unaffected by the new settings schema; if it is not,
      regenerate against a local API with
      `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api` and review
      `apps/web/openapi.json` with `apps/web/src/lib/api/schema.d.ts`
      — verified unaffected: the catalogue response references the generic `ChannelProviderInfo`
      schema and the snapshot enumerates no provider id or provider setting, so no regeneration was
      required

## 7. Documentation, changelog and validation

- [x] 7.1 Update the project status and wave history under `docs/principal/`
- [x] 7.2 Update the integration setup guide with the two Instagram variants and the new redirect URI
- [x] 7.3 Update the platform gate tracking for the Meta family
- [x] 7.4 Record the delivery in the root `CHANGELOG.md`
- [x] 7.5 Reproducible install check: `bun install --frozen-lockfile`
- [x] 7.6 Repository checks: `bun run check` (typechecks, tests, boundaries, AI grep, brand) — 431
      tests passing
- [x] 7.7 Database check: `bun run db:check` — no schema impact, as expected
- [x] 7.8 OpenSpec validation: `bun run spec:validate` — 4 changes passing
