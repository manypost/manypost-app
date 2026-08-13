# AI Media Runtime Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository policy forbids delegated agents unless the user explicitly authorizes them.

**Goal:** Establish stable contracts, pure state machines, additive persistence,
atomic generation creation, generation-bound customer credits, provider
spend/capacity controls and disabled-by-default recipe quoting without making a
paid provider call.

**Architecture:** Public leaf types live in contracts; all decisions live in
framework-free core code; Drizzle implements one tenant-scoped transactional
unit of work. PostgreSQL is authoritative for idempotency, reservations,
capacity and state fencing. The new adapter package is introduced only as a
dependency-safe shell in this phase.

**Tech Stack:** Bun 1.3.14, strict TypeScript, PostgreSQL, Drizzle,
`bun:test`, dependency-cruiser and OpenSpec 1.6.0.

## Global Constraints

- Execute only after reading the root and package-local `AGENTS.md` files.
- Preserve the existing synchronous `/v1/ai/image` credit lease behavior.
- Make all schema changes additive and generate one new migration with Bun.
- Do not call a real provider or add provider credentials.
- Keep every managed-media recipe `disabled`.
- Do not enqueue from inside a database transaction.
- Do not expose wholesale provider cost through contract DTOs.
- Use keyed fingerprints; never persist a plain prompt hash.
- Commit each green slice separately and run `git diff --check` before it.

---

## Planned file structure

| Path | Change |
| --- | --- |
| `packages/contracts/src/ai-media.ts` | Create stable operations, statuses, DTOs and event payloads |
| `packages/contracts/src/ai-media.test.ts` | Create closed-contract tests |
| `packages/contracts/src/billing.ts` | Add the independent `ai_video` entitlement |
| `packages/contracts/src/error-codes.ts` | Add sanitized stable media-generation problem codes |
| `packages/contracts/src/events.ts` | Add bounded generation realtime event |
| `packages/contracts/src/index.ts` | Export new leaf contracts |
| `packages/core/src/domain/ai-media/generation-state.ts` | Create generation reducer |
| `packages/core/src/domain/ai-media/provider-attempt-state.ts` | Create attempt reducer |
| `packages/core/src/application/ports/ai-media.ts` | Create repository, UoW, recipe, accounting and staging ports |
| `packages/core/src/application/ports/managed-media-provider.ts` | Create provider lifecycle port |
| `packages/core/src/application/ports/media-processing.ts` | Create bounded media processor port |
| `packages/core/src/application/use-cases/ai-media.ts` | Create capability, quote and durable creation use cases |
| `packages/generative-media/` | Create adapter package shell and contract test-kit |
| `.dependency-cruiser.cjs` | Enforce new package boundaries |
| `packages/db/src/schema/ai-media.ts` | Create additive runtime tables |
| `packages/db/src/schema/platform.ts` | Extend grants for generation-bound reservations |
| `packages/db/src/schema/content.ts` | Add encrypted compatibility provenance metadata |
| `packages/db/src/repositories/ai-media.repo.ts` | Create repositories and transactional UoW |
| `packages/db/src/repositories/ai-media.repo.integration.test.ts` | Create concurrency and tenant tests |
| `packages/db/src/repositories/ai-credits.repo.ts` | Preserve sync leases and add async settlement |
| `packages/db/src/index.ts` | Export schema/repository factories |
| `packages/db/migrations/` | Add only generated migration and metadata |

## Task 1: Freeze the baseline and traceability matrix

**Files:**

- Read: `openspec/changes/add-ai-image-quality-modes/`
- Read: `openspec/changes/add-ai-media-generation-runtime/`
- Create: `docs/audits/2026-07-30-ai-media-runtime-traceability.md`

**Interfaces:**

- Consumes: six validated delta specs and the current synchronous image
  compatibility behavior.
- Produces: requirement IDs mapped to test paths, implementation phase and
  rollout evidence.

- [ ] **Step 1: Verify prerequisites and worktree ownership**

  Run:

  ```bash
  git status --short
  openspec status --change add-ai-media-generation-runtime --json
  openspec list --json
  ```

  Expected: the media-runtime artifacts are complete; the image-quality change
  is archived or its compatibility contract is demonstrably identical. Record
  unrelated user changes and do not modify them.

- [ ] **Step 2: Install reproducibly and record baseline gates**

  Run:

  ```bash
  bun install --frozen-lockfile
  bun run spec:validate
  bun run check
  bun run db:check
  bun run build:web
  git diff --check
  ```

  Expected: each command passes or its pre-existing failure is recorded with
  command, exit status and unaffected path before implementation begins.

- [ ] **Step 3: Write the traceability document**

  Include one row per `### Requirement:` heading with these exact columns:

  ```markdown
  | Requirement | Positive test | Negative/concurrency test | Phase | Evidence |
  | --- | --- | --- | --- | --- |
  ```

  Map tenant scope, changed-key conflicts, ambiguous submission, settlement,
  purge and rollback to explicit negative or recovery tests.

- [ ] **Step 4: Validate and commit**

  Run:

  ```bash
  rg -n '^### Requirement:' openspec/changes/add-ai-media-generation-runtime/specs
  git diff --check
  git add docs/audits/2026-07-30-ai-media-runtime-traceability.md
  git commit -m "docs(ai-media): map runtime requirements to evidence"
  ```

  Expected: the document accounts for every requirement heading and the commit
  contains documentation only.

## Task 2: Add stable leaf contracts

**Files:**

- Create: `packages/contracts/src/ai-media.ts`
- Create: `packages/contracts/src/ai-media.test.ts`
- Modify: `packages/contracts/src/billing.ts`
- Modify: `packages/contracts/src/billing.test.ts`
- Modify: `packages/contracts/src/error-codes.ts`
- Modify: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces four operations, generation/attempt statuses, public
  capability/quote/generation DTOs and bounded realtime payloads.
- Adds `ai_video` independently from `ai_image`.

- [ ] **Step 1: Write closed-contract tests first**

  Add tests that assert these exact stable values:

  ```ts
  expect(AiMediaOperations).toEqual([
    'social-image-create',
    'social-image-edit',
    'social-video-from-prompt',
    'social-video-from-image',
  ]);
  expect(AiMediaGenerationStatuses).toEqual([
    'queued',
    'submitting',
    'submission_uncertain',
    'provider_running',
    'cancellation_requested',
    'ingesting',
    'finalizing',
    'succeeded',
    'failed',
    'canceled',
  ]);
  expect(PlanFeatures).toContain('ai_video');
  expect(PLANS.PREMIUM.features).toContain('ai_video');
  ```

  Also prove customer DTOs have no `provider`, `model`, `endpoint`,
  `providerCost`, `signedUrl` or raw failure field.

- [ ] **Step 2: Confirm the intended red state**

  Run:

  ```bash
  bun test packages/contracts/src/ai-media.test.ts packages/contracts/src/billing.test.ts
  ```

  Expected: failure only because the new exports, feature and problem codes are
  absent.

- [ ] **Step 3: Implement the exact contract surface**

  Export these readonly constants and derived union types:

  ```ts
  export const AiMediaOperations = [
    'social-image-create',
    'social-image-edit',
    'social-video-from-prompt',
    'social-video-from-image',
  ] as const;

  export type AiMediaOperation = (typeof AiMediaOperations)[number];

  export const AiMediaGenerationStatuses = [
    'queued',
    'submitting',
    'submission_uncertain',
    'provider_running',
    'cancellation_requested',
    'ingesting',
    'finalizing',
    'succeeded',
    'failed',
    'canceled',
  ] as const;

  export type AiMediaGenerationStatus =
    (typeof AiMediaGenerationStatuses)[number];
  ```

  Define public DTOs around product operation/options, quoted maximum credits,
  quote revision/expiry, generation ID/status/version, one optional primary
  media result, sanitized failure code, input-expired indicator and timestamps.
  Do not include provider implementation or wholesale cost fields.

- [ ] **Step 4: Add stable problem and event codes**

  Add media-generation codes for invalid operation/options, unavailable
  capability, expired quote, quote increase, idempotency conflict, capacity,
  spend ceiling, uncertain submission, invalid transition and purged input.
  Add one `ai.media.generation.updated` event whose payload is bounded to
  generation ID, status, state version, output media ID and sanitized code.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test packages/contracts/src/ai-media.test.ts packages/contracts/src/billing.test.ts
  bun run typecheck
  git diff --check
  git add packages/contracts/src
  git commit -m "feat(contracts): define AI media runtime contracts"
  ```

  Expected: focused tests and root typecheck pass.

## Task 3: Implement pure generation and attempt state machines

**Files:**

- Create: `packages/core/src/domain/ai-media/generation-state.ts`
- Create: `packages/core/src/domain/ai-media/generation-state.test.ts`
- Create: `packages/core/src/domain/ai-media/provider-attempt-state.ts`
- Create: `packages/core/src/domain/ai-media/provider-attempt-state.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces pure compare-and-transition decisions with no clock, database,
  provider SDK or framework dependency.
- A stale expected version returns a no-op result.

- [ ] **Step 1: Write generation reducer tests**

  Cover all allowed arrows from the design and these invariants:

  ```ts
  expect(
    transitionGeneration(
      { status: 'submitting', version: 4 },
      { expectedVersion: 3, to: 'provider_running' },
    ),
  ).toEqual({ kind: 'stale' });

  expect(() =>
    transitionGeneration(
      { status: 'succeeded', version: 8 },
      { expectedVersion: 8, to: 'failed' },
    ),
  ).toThrow();
  ```

  Include cancellation-before-acceptance, completion racing cancellation,
  uncertainty resolution and terminal immutability.

- [ ] **Step 2: Write provider-attempt reducer tests**

  Prove that only `not_created`, confirmed terminal failure or confirmed cancel
  can release effect capacity and permit another bounded attempt. Prove
  `accepted`, `submission_uncertain` and `cancellation_pending` cannot fall
  back.

- [ ] **Step 3: Confirm both test files fail for missing reducers**

  Run:

  ```bash
  bun test packages/core/src/domain/ai-media/generation-state.test.ts packages/core/src/domain/ai-media/provider-attempt-state.test.ts
  ```

  Expected: imports or reducer exports are missing; unrelated tests do not run.

- [ ] **Step 4: Implement table-driven reducers**

  Return discriminated results:

  ```ts
  export type TransitionResult<T> =
    | { kind: 'applied'; value: T }
    | { kind: 'stale' };
  ```

  Reject illegal current/to pairs. Increment version exactly once for an
  applied transition. Keep retry ceilings and monetary decisions outside the
  reducer, but expose predicates for `isGenerationTerminal`,
  `attemptHoldsExposure` and `attemptPermitsReplacement`.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/domain/ai-media/generation-state.test.ts packages/core/src/domain/ai-media/provider-attempt-state.test.ts
  bun run typecheck
  git diff --check
  git add packages/core/src/domain/ai-media packages/core/src/index.ts
  git commit -m "feat(core): add AI media state machines"
  ```

## Task 4: Define core ports and the adapter-package boundary

**Files:**

- Create: `packages/core/src/application/ports/ai-media.ts`
- Create: `packages/core/src/application/ports/managed-media-provider.ts`
- Create: `packages/core/src/application/ports/media-processing.ts`
- Create: `packages/core/src/application/ports/ai-media.contract.test.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/generative-media/package.json`
- Create: `packages/generative-media/tsconfig.json`
- Create: `packages/generative-media/AGENTS.md`
- Create: `packages/generative-media/src/index.ts`
- Create: `packages/generative-media/test-kit/contract.ts`
- Create: `packages/generative-media/test-kit/mock-http.ts`
- Modify: `.dependency-cruiser.cjs`

**Interfaces:**

- Core consumes provider facts, not SDK/config/database types.
- The Drizzle UoW will atomically create/finalize generations and accounting.
- The adapter package may depend on contracts/core ports but not apps or DB
  repositories.

- [ ] **Step 1: Write compile-time fake-port tests**

  Instantiate in-memory implementations of generation lookup/UoW, recipe
  catalogue, provider-cost control, runtime staging, media processor and
  managed provider. Use no casts wider than a localized test fixture requires.

- [ ] **Step 2: Define the provider fact contract**

  Use the exact discriminated submission result:

  ```ts
  export type SubmitProviderResult =
    | { kind: 'accepted'; providerRunId: string }
    | {
        kind: 'completed';
        output: ProviderOutputReference;
        providerRunId?: string;
      }
    | { kind: 'not_created'; retryAfterMs?: number }
    | { kind: 'uncertain' };

  export interface ManagedMediaProvider {
    readonly adapterKey: string;
    submit(input: ProviderSubmission): Promise<SubmitProviderResult>;
    inspect(input: ProviderInspection): Promise<ProviderRunSnapshot>;
    cancel(input: ProviderCancellation): Promise<ProviderCancelResult>;
    fetchOutput(
      input: ProviderOutputRequest,
    ): Promise<ProviderOutputReference>;
  }
  ```

  Provider capability metadata must explicitly declare submit-token
  idempotency, inspect-by-token, callback, polling and cancellation behavior.

- [ ] **Step 3: Define the transactional UoW contract**

  Include atomic methods for:

  - creation plus customer-credit reservation;
  - fenced attempt preparation plus provider spend/capacity claim;
  - submission fact recording;
  - terminal no-output settlement;
  - media/output/customer-credit/provider-cost finalization.

  Each mutating method takes expected generation/attempt versions and returns
  `applied`, `stale`, `replayed`, `conflict` or a named admission refusal.

- [ ] **Step 4: Create the package and boundary test**

  Use workspace dependencies and Bun scripts only. Add dependency-cruiser
  rules rejecting:

  - `packages/core` importing `packages/generative-media`;
  - `packages/generative-media` importing `apps/*`, `packages/db` or
    `packages/queue`;
  - `packages/contracts` importing any workspace package.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/ports/ai-media.contract.test.ts
  bun run check:boundaries
  bun run typecheck
  git diff --check
  git add packages/core packages/generative-media .dependency-cruiser.cjs package.json
  git commit -m "feat(ai-media): add provider-neutral runtime ports"
  ```

  Expected: the contract fake compiles and dependency boundaries pass. Add
  `bun.lock` only if Bun changed it while wiring the workspace package.

## Task 5: Add the runtime schema and generated migration

**Files:**

- Create: `packages/db/src/schema/ai-media.ts`
- Create: `packages/db/src/schema/ai-media.test.ts`
- Modify: `packages/db/src/schema/platform.ts`
- Modify: `packages/db/src/schema/content.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/index.ts`
- Create (generated): `packages/db/migrations/0008_add-ai-media-generation-runtime.sql`
- Create/modify (generated): `packages/db/migrations/meta/*`

**Interfaces:**

- Adds `ai_media_generations`, `ai_media_provider_attempts`,
  `ai_media_generation_outputs`, `ai_media_generation_events`,
  provider-cost/spend/capacity tables and recipe activation records.
- Extends `ai_grants` with nullable unique `generation_id` and nullable expiry
  for generation-bound grants while preserving legacy non-null expiry.

- [ ] **Step 1: Read and apply database-local rules**

  Read `packages/db/AGENTS.md`. Do not touch an existing migration or generated
  metadata by hand.

- [ ] **Step 2: Write schema-shape and disposable-PostgreSQL tests**

  Assert:

  - direct `org_id` on generation, attempt, output, event and accounting rows;
  - unique `(org_id, idempotency_key)` plus stored keyed fingerprint;
  - unique `(generation_id, attempt_ordinal)`;
  - unique adapter/client token and nullable stable provider run identity;
  - one `(generation_id, slot='primary')` output;
  - deduplicated provider event identity;
  - unique nullable grant/generation association;
  - no prompt, raw body, signed URL or credential column outside encrypted
    content/locator columns.

- [ ] **Step 3: Confirm the red state**

  Run:

  ```bash
  bun test packages/db/src/schema/ai-media.test.ts
  ```

  Expected: failure because the new tables and grant fields do not exist.

- [ ] **Step 4: Implement the additive Drizzle schema**

  Use text status columns with database check constraints matching the closed
  contracts, integer minor-unit money with ISO currency text, timestamps with
  timezone, monotonic integer versions and bounded sanitized fields. Store
  encrypted canonical input and short-lived locator as binary plus key version,
  never plaintext.

  Keep `ai_grants.expires_at` required for legacy grants through a check:
  generation-bound grants have `generation_id IS NOT NULL` and null expiry;
  legacy grants have `generation_id IS NULL` and non-null expiry.

- [ ] **Step 5: Generate, inspect and exercise the migration**

  Verify `0008` is still the next migration index. If another migration landed,
  stop and update this plan/file map before generation; never force a duplicate
  index or rewrite the intervening migration.

  Run:

  ```bash
  bun run --cwd packages/db generate -- --name add-ai-media-generation-runtime
  git diff -- packages/db/migrations packages/db/src/schema
  bun run db:check
  ```

  Expected: one new additive SQL migration, generated metadata only, no dropped
  table/column and no edit to prior migration files.

  Apply it to clean and previous-schema disposable PostgreSQL databases using
  the repository's isolated integration-test harness. Verify old application
  writes remain valid until the later writer-drain/backfill phase.

- [ ] **Step 6: Commit**

  Run:

  ```bash
  bun test packages/db/src/schema/ai-media.test.ts
  bun run db:check
  git diff --check
  git add packages/db/src packages/db/migrations
  git commit -m "feat(db): add durable AI media runtime schema"
  ```

## Task 6: Implement tenant-scoped repositories and atomic creation

**Files:**

- Create: `packages/db/src/repositories/ai-media.repo.ts`
- Create: `packages/db/src/repositories/ai-media.repo.integration.test.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/core/src/application/use-cases/ai-media.ts`
- Create: `packages/core/src/application/use-cases/ai-media.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- `createGeneration` atomically locks/reserves credits and inserts the encrypted
  queued resource.
- Reads require organization plus actor scope.
- Worker writes use expected state/version/lease predicates.

- [ ] **Step 1: Write concurrent idempotency tests**

  Against disposable PostgreSQL, race two identical requests and assert one
  generation/grant. Replay returns the original result. Race the same key with
  different keyed fingerprints and assert one success plus one stable
  conflict.

- [ ] **Step 2: Write tenant and role tests**

  Prove member-own list/get/cancel, admin/owner organization-wide access and
  cross-tenant not-found. Test organization scope both by direct `org_id` and
  through a locked parent for child rows.

- [ ] **Step 3: Confirm the red state**

  Run:

  ```bash
  bun test packages/db/src/repositories/ai-media.repo.integration.test.ts packages/core/src/application/use-cases/ai-media.test.ts
  ```

  Expected: repository factory and use cases are missing.

- [ ] **Step 4: Implement the creation transaction**

  Order the transaction exactly:

  1. resolve organization-scoped owned reference media;
  2. select an immutable disabled/canary/active recipe snapshot according to
     eligibility;
  3. recompute and validate quote revision/accepted maximum;
  4. lock the current credit bucket;
  5. reserve the generation-bound grant;
  6. insert encrypted canonical input and keyed fingerprint;
  7. return the persisted generation.

  Enqueue remains outside this transaction and outside this phase.

- [ ] **Step 5: Implement fenced repository methods**

  Add claim/release lease, allocate sequential attempt, map client token/event,
  allocate deterministic primary output, finalize success and settle terminal
  no-output methods. Every mutation uses a conditional state/version predicate
  and repeated settlement is a no-op.

- [ ] **Step 6: Verify and commit**

  Run:

  ```bash
  bun test packages/db/src/repositories/ai-media.repo.integration.test.ts packages/core/src/application/use-cases/ai-media.test.ts
  bun run typecheck
  bun run db:check
  git diff --check
  git add packages/db/src/repositories packages/db/src/index.ts packages/core/src/application packages/core/src/index.ts
  git commit -m "feat(ai-media): create generations transactionally"
  ```

## Task 7: Separate customer credits from provider exposure

**Files:**

- Modify: `packages/core/src/application/ports/ai-credits.ts`
- Modify: `packages/core/src/application/use-cases/ai-budget.ts`
- Modify: `packages/core/src/application/use-cases/ai-budget.test.ts`
- Modify: `packages/db/src/repositories/ai-credits.repo.ts`
- Modify: `packages/db/src/repositories/ai-credits.repo.integration.test.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`

**Interfaces:**

- Legacy reservations keep 180-second expiry/reclamation.
- Generation-bound reservations settle only from proven generation truth.
- Provider spend and capacity are atomic PostgreSQL claims in integer minor
  units and are invisible to customer contracts.

- [ ] **Step 1: Write legacy-versus-async credit tests**

  Freeze time and prove an expired legacy grant is reclaimed while a
  generation-bound `submission_uncertain` grant remains reserved. Prove
  customer credits commit once for one durable output and release once for
  terminal no-output. Prove every ledger entry retains the stable product
  operation without storing input content.

- [ ] **Step 2: Write provider spend/capacity concurrency tests**

  Race the final global, organization and adapter/model slot. Assert exactly
  one claimant succeeds. Prove accepted, uncertain and cancellation-pending
  attempts retain their slot and estimated spend.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-budget.test.ts packages/db/src/repositories/ai-credits.repo.integration.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts
  ```

  Expected: generation-bound methods and provider exposure claims are absent.

- [ ] **Step 4: Implement conservative settlement**

  Preserve existing `BudgetGuard` callers. Add explicit async
  reserve/commit/release methods keyed by generation ID. Provider ledger rows
  record estimated/reserved and actual/released values separately, with a
  source of `provider_reported` or `recipe_snapshot`.

  Self-hosted policy skips commercial refusal for customer credits but still
  records them and still fails closed on configured provider spend/capacity.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-budget.test.ts packages/db/src/repositories/ai-credits.repo.integration.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts
  bun run typecheck
  bun run db:check
  git diff --check
  git add packages/core/src/application packages/db/src/repositories
  git commit -m "feat(ai-media): enforce durable credit and provider budgets"
  ```

## Task 8: Add disabled recipes, capabilities and binding quotes

**Files:**

- Create: `packages/generative-media/src/catalogue.ts`
- Create: `packages/generative-media/src/catalogue.test.ts`
- Modify: `packages/generative-media/src/index.ts`
- Modify: `packages/core/src/application/use-cases/ai-media.ts`
- Modify: `packages/core/src/application/use-cases/ai-media.test.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`
- Create: `scripts/evals/ai-media/briefs.v1.json`
- Create: `scripts/evals/ai-media/run.ts`
- Create: `scripts/evals/ai-media/run.test.ts`
- Create: `scripts/evals/ai-media/README.md`

**Interfaces:**

- Recipes are immutable code definitions plus PostgreSQL rollout state.
- Quotes bind operation/options, recipe revision, maximum credits and expiry.
- Capabilities distinguish entitlement, installed readiness and temporary
  admission.

- [ ] **Step 1: Write recipe-validation tests**

  Reject a recipe missing any of:

  - stable recipe/adapter/protocol/model versions;
  - supported product operation and bounded options;
  - exactly one primary output;
  - customer-credit maximum;
  - provider-cost ceiling, currency and effective date;
  - retry/idempotency/lookup/callback/poll/cancel declarations;
  - provider/runtime output retention;
  - rights, moderation and privacy review references;
  - spend/capacity keys and rollback predecessor.

  Reject LoRA, ControlNet, IP-Adapter, seed and sampler controls in this change.

- [ ] **Step 2: Write capability and quote tests**

  Cover wrong entitlement, disabled recipe, missing infrastructure, temporary
  capacity, immutable quote revision/expiry, caller maximum below/above current
  quote and rejection of provider-price fields.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/generative-media/src/catalogue.test.ts packages/core/src/application/use-cases/ai-media.test.ts scripts/evals/ai-media/run.test.ts
  ```

  Expected: catalogue, quote and evaluation runner are absent.

- [ ] **Step 4: Implement only disabled static recipes**

  Add recipe definitions for the existing image-compatibility adapter and fake
  test adapter. Native commercial recipes are not added before the evidence
  gate in phase 2. Resolve rollout as `disabled | canary | active` plus
  organization allowlist; snapshot the selected definition into each new
  generation.

- [ ] **Step 5: Implement the synthetic evaluation runner**

  Store at least 30 non-customer briefs spanning all four operations,
  Portuguese typography, motion, moderation and failure cases. The runner
  records operation, recipe revision, success, latency, bytes,
  dimensions/duration and integer cost only. Tests must prove it rejects a
  customer/private URL and never prints prompt bodies.

- [ ] **Step 6: Verify and commit**

  Run:

  ```bash
  bun test packages/generative-media/src/catalogue.test.ts packages/core/src/application/use-cases/ai-media.test.ts scripts/evals/ai-media/run.test.ts
  bun run check:boundaries
  bun run check:ai-providers
  git diff --check
  git add packages/generative-media packages/core/src/application scripts/evals/ai-media
  git commit -m "feat(ai-media): add disabled recipes and binding quotes"
  ```

## Task 9: Close the foundation phase

**Files:**

- Modify: `docs/audits/2026-07-30-ai-media-runtime-traceability.md`
- Modify: `openspec/changes/add-ai-media-generation-runtime/tasks.md`

**Interfaces:**

- Produces evidence that OpenSpec task groups 1–6 and provider-neutral portions
  of group 7 are implemented.
- Does not mark manual provider evaluation or any later task complete.

- [ ] **Step 1: Run the phase gate**

  Run:

  ```bash
  bun run check
  bun run db:check
  bun run spec:validate
  git diff --check
  ```

  Expected: all commands pass.

- [ ] **Step 2: Inspect persistence and package boundaries**

  Verify with disposable PostgreSQL that:

  - identical concurrent create yields one generation and one grant;
  - changed input under the same key conflicts;
  - cross-tenant reads do not resolve;
  - stale writes are no-ops;
  - uncertainty holds customer/provider reservations;
  - legacy synchronous grant reclamation still works.

- [ ] **Step 3: Update evidence and checkboxes truthfully**

  Add command/output summaries and test paths to the traceability document.
  Check only tasks whose implementation and evidence exist.

- [ ] **Step 4: Commit phase evidence**

  Run:

  ```bash
  git add docs/audits/2026-07-30-ai-media-runtime-traceability.md openspec/changes/add-ai-media-generation-runtime/tasks.md
  git commit -m "docs(ai-media): record foundation verification"
  ```

  Expected: foundation is independently reviewable and no recipe is active.
