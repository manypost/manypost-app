## 1. Evidence and data model

- [ ] 1.1 Add failing concurrent-continuation and crash-window tests to `publishing.test.ts`
- [ ] 1.2 Define attempt states, lease ownership and organization-scoped repository operations
- [ ] 1.3 Add Drizzle schema and generate an additive migration with `bun run --cwd packages/db generate`
- [ ] 1.4 Review generated SQL, indexes, tenant path and backward compatibility

## 2. Fencing and provider behavior

- [ ] 2.1 Implement conditional claim, heartbeat, fenced completion and expired-lease recovery in the DB adapter
- [ ] 2.2 Require a valid owner token around every provider call and cursor/state update
- [ ] 2.3 Add stable idempotency-key capability and fake-provider contract tests
- [ ] 2.4 Map uncertain non-idempotent outcomes to durable review without automatic repost
- [ ] 2.5 Log and rethrow unexpected queue infrastructure failures so pg-boss does not acknowledge them

## 3. Verification and rollout

- [ ] 3.1 Add concurrency, stale-owner, recovery, cross-organization and provider-idempotency tests
- [ ] 3.2 Add non-secret metrics for claims, prevented duplicates, indeterminate outcomes and recoveries
- [ ] 3.3 Update architecture/flow/runbook documentation and `CHANGELOG.md`
- [ ] 3.4 Run `bun install --frozen-lockfile`, `bun run check:ci` and migration integration tests
- [ ] 3.5 Run `bun run spec:validate`, review Railway rollout evidence and archive the change after deployment
