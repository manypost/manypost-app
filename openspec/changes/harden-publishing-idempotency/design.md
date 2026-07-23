## Context

Initial jobs atomically move `SCHEDULED|RETRYING|TOKEN_REFRESH` to
`PUBLISHING`. A thread continuation instead reads `state`, `jobVersion` and
`lastPublishedIndex`, checks them in memory, calls the provider, and only then
records the cursor. Two continuations can pass the same check. Any provider
success followed by process/DB failure is also externally successful but
locally unknown.

The core use case owns retry semantics; the database adapter owns atomic
claims; queue workers own delivery acknowledgement; providers know whether an
external idempotency primitive exists. This boundary must be preserved.

## Goals / Non-Goals

**Goals:**

- one durable owner per logical publication item and attempt;
- no automatic repost after indeterminate external success;
- safe lease recovery after confirmed owner death;
- provider idempotency keys and reconciliation where supported;
- organization-scoped attempt history and metrics.

**Non-Goals:**

- replacing pg-boss or all provider implementations;
- promising exactly-once delivery from an API without idempotency/reconciliation;
- editing old migrations or changing public HTTP response shapes.

## Decisions

### Claim the item with a database lease before any provider call

Add an organization-scoped attempt/lease record keyed by publication,
`jobVersion` and item position. A conditional insert/update returns a random
owner token and expiry. Cursor/state updates require the same token.

This belongs in the publishing repository port plus Drizzle adapter: an
in-memory or Redis-only lock would not share the durability boundary of the
cursor. Alternative considered: rely on pg-boss singleton keys. They reduce
duplicate jobs but do not fence two already-running handlers or a recovery job.

### Represent external outcome explicitly

Attempts use `CLAIMED`, `CONFIRMED`, `FAILED_SAFE` or `INDETERMINATE`. A provider
call that may have succeeded but cannot be reconciled becomes `INDETERMINATE`
and moves the publication to human review. It is never automatically retried.

Alternative considered: time out and retry. That favors eventual completion at
the cost of duplicate public posts, contradicting the existing state-machine
rule.

### Derive stable provider idempotency keys

Where supported, adapters receive a stable opaque key derived from installation,
publication, job version and item position. The key contains no user content or
secret. Providers without support declare that limitation; reconciliation is
used when their API exposes lookup, otherwise uncertainty becomes review.

Alternative considered: a random key per worker attempt. It would not deduplicate
retries of the same logical item.

### Rethrow infrastructure failures from queue handlers

Handlers log contextual identifiers and rethrow unexpected infrastructure
errors so pg-boss can apply job failure/retry semantics. Domain-classified
outcomes remain handled by the use case. Current catch-and-return behavior can
acknowledge an unhandled failure as success.

### Generated artifacts

Any schema change is made in `packages/db/src/schema/` and generated with
`bun run --cwd packages/db generate`; generated SQL and Drizzle metadata are
reviewed together and never edited manually. No OpenAPI regeneration is
expected unless implementation later changes an HTTP contract.

## Risks / Trade-offs

- [Lease expires during a slow provider call] → heartbeat or a lease longer than
  the provider timeout; completion still requires the owner token.
- [Provider ignores an idempotency key] → capability declaration plus
  `INDETERMINATE` fallback.
- [Attempt table grows indefinitely] → retention policy only after audit and
  reconciliation windows are defined.
- [New migration blocks deploy] → additive indexed migration, measured on a
  production-sized copy before Railway rollout.

## Migration Plan

1. Add migration and repository operations without enabling new claims.
2. Add concurrency/crash-window tests and provider capability declarations.
3. Enable the path for fake/test provider, then selected idempotent providers.
4. Roll out worker first only if old API code safely ignores the additive table;
   otherwise keep the current single-image atomic deploy.
5. Monitor duplicate-prevented, indeterminate and lease-recovered metrics.
6. Roll back by disabling new claims, waiting for leases to expire and
   redeploying the previous Railway revision. Preserve attempt rows.

## Open Questions

- What lease/heartbeat duration covers the slowest provider upload?
- Which providers support native idempotency or post lookup?
- Who owns review resolution for `INDETERMINATE` publications?
- What is the attempt-history retention period?
