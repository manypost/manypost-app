## Why

The current state transition fences two initial publication jobs, but delayed
thread continuations validate a previously read cursor and then call the
provider before atomically claiming that specific item. Overlapping
continuations or a crash after the provider accepts a post but before the cursor
commit can therefore create a duplicate external post.

## What Changes

- Define an atomic claim/lease for each publication attempt and thread item.
- Persist enough attempt evidence to distinguish safe retry, known success and
  indeterminate external outcome.
- Require provider idempotency keys where the external API supports them.
- Make recovery reclaim expired work without allowing a live owner to publish.
- Add concurrency, crash-window and recovery tests before changing production
  handlers.

## Capabilities

### New Capabilities

- `publication-delivery-safety`: Fencing, attempt ownership, external
  idempotency and indeterminate-outcome behavior for publications and threads.

### Modified Capabilities

None. No living OpenSpec capability currently defines this behavior.

## Goals

- Prevent two Manypost workers from intentionally sending the same logical item.
- Make every retry decision explainable from durable state.
- Preserve the rule that uncertainty never triggers an automatic repost.

## Non-goals

- No provider-wide rewrite or queue replacement.
- No exactly-once guarantee from external networks that offer no idempotency or
  lookup primitive.
- No implementation in the maintenance-baseline delivery.

## Compatibility

HTTP/MCP contracts and provider identifiers remain stable. The design may
require an additive migration and optional provider-adapter capability. Existing
migrations and historical attribution remain unchanged.

## Rollback

Implementation must be deployable behind a default-off compatibility flag or
through a migration that old code safely ignores. Rollback must stop new claims,
allow leases to expire and redeploy the last successful Railway revision
without deleting attempt history.

## Impact

- `packages/core/src/application/use-cases/publishing.ts`
- publishing ports and `packages/db` repository/schema/migration code
- `packages/queue/src/runtime.ts` recovery and worker acknowledgement
- provider contracts/adapters that can pass external idempotency keys
- metrics, runbooks and Railway worker behavior

Data impact is additive durable attempt state. Security impact is reduced
duplicate posting and stronger worker ownership. Product identity is unchanged;
no legacy Postiz occurrence is renamed.
