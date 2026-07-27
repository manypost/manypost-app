## 1. Evidence and data model

- [x] 1.1 Add failing concurrent-continuation and crash-window tests to `publishing.test.ts`
- [x] 1.2 Define attempt states, lease ownership and organization-scoped repository operations
- [x] 1.3 Add Drizzle schema and generate an additive migration with `bun run --cwd packages/db generate`
- [x] 1.4 Review generated SQL, indexes, tenant path and backward compatibility

## 2. Fencing and provider behavior

- [x] 2.1 Implement conditional claim, heartbeat, fenced completion and expired-lease recovery in the DB adapter
      — the lease is a single fixed window aligned to the zombie watchdog (`PUBLISH_LEASE_SEC`)
      instead of a heartbeat; see design note in `docs/specs/SPEC_QUEUE_PUBLISHING.md` §7
- [x] 2.2 Require a valid owner token around every provider call and cursor/state update
- [x] 2.3 Add stable idempotency-key capability and fake-provider contract tests
- [x] 2.4 Map uncertain non-idempotent outcomes to durable review without automatic repost
- [x] 2.5 Log and rethrow unexpected queue infrastructure failures so pg-boss does not acknowledge them

## 3. Verification and rollout

- [x] 3.1 Add concurrency, stale-owner, recovery, cross-organization and provider-idempotency tests
      — unit (`publishing.test.ts`) plus `publishing.repo.integration.test.ts` against real Postgres 17
- [x] 3.2 Add non-secret metrics for claims, prevented duplicates, indeterminate outcomes and recoveries
- [x] 3.3 Update architecture/flow/runbook documentation and `CHANGELOG.md`
- [x] 3.4 Run `bun install --frozen-lockfile`, `bun run check:ci` and migration integration tests
- [ ] 3.5 **Owner step.** Open the pull request using `.github/pull_request_template.md`, filled in by
      hand (`gh` does not apply the template with `--body-file`); after merge and deploy, run
      `bun run spec:archive harden-publishing-idempotency`

## Verification evidence (2026-07-26)

- `bun run check`: 636 unit tests, 0 failures; dependency-cruiser, AI-provider grep and brand check clean.
- `TEST_DATABASE_URL=… bun test packages/db/src/repositories/publishing.repo.integration.test.ts`:
  4 tests against Postgres 17 — concurrent claims elect one owner, the sha256 idempotency key is
  stable across retries, a replaced owner cannot advance the cursor, confirmed items are
  unclaimable and lease abandonment is organization scoped.
- Regression teeth: weakening the in-memory claim double makes 3 of the new unit tests fail.
- Full isolated E2E stack (Postgres 17 + Redis + real worker, `MODE=all`): `e2e-publish`
  (including the new dropped-connection scenario), `e2e-auth`, `e2e-public`, `e2e-mcp`,
  `e2e-mcp-oauth` all green; `/metrics` exposes `publishing_delivery_safety_total` and
  `publishing_lease_recovered_total`.
