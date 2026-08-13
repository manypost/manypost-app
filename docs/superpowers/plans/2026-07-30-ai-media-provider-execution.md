# AI Media Provider Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository policy forbids delegated agents unless the user explicitly authorizes them.

**Goal:** Execute durable generations through provider-neutral adapters,
preserve the synchronous image endpoint, recover safely across crashes,
callbacks, polling and cancellation, and provide audited reconciliation without
blindly duplicating paid inference.

**Architecture:** Core interprets persisted provider facts; adapters only map
external protocols. pg-boss carries internal IDs and state versions after
commit. Attempt/client-token identity, provider spend and capacity are persisted
before submit. PostgreSQL fencing makes repeated queue delivery safe. Native
commercial adapters are implemented only after a written evaluation decision.

**Tech Stack:** Bun 1.3.14, strict TypeScript, pg-boss/PostgreSQL, Redis
best-effort realtime, mock HTTP servers, Hono callback adapters and
`bun:test`.

## Global Constraints

- Complete the foundation phase before this plan.
- No automated test calls a real or paid provider.
- Persist attempt identity and provider exposure before external submission.
- Treat lost or unclassified submit responses as `submission_uncertain`.
- Repeat submit only when the adapter declares provider-enforced idempotency
  for the persisted client token.
- Providers without authenticated callback evidence are polling-only.
- Callback routes verify exact raw bytes and persist no raw body.
- Redis loss must not weaken idempotency, spend, capacity or settlement.
- Keep all new commercial recipes disabled through implementation.
- Do not add Comfy, GPU, local weights, Python inference, Comfy Cloud or RunPod.

---

## Planned file structure

| Path | Change |
| --- | --- |
| `packages/generative-media/test-kit/contract.ts` | Complete reusable adapter lifecycle contract |
| `packages/generative-media/test-kit/mock-http.ts` | Complete bounded mock HTTP fixture |
| `packages/generative-media/src/fake-provider.ts` | Create deterministic automated-test provider |
| `packages/generative-media/src/openai-image-compat.ts` | Wrap existing synchronous image implementation |
| `packages/generative-media/src/provider-registry.ts` | Create explicit adapter/recipe registry |
| `packages/config/src/env.ts` | Add dedicated managed-media configuration names |
| `packages/queue/src/ai-media-runtime.ts` | Create job names, handlers and recovery scanners |
| `packages/core/src/application/use-cases/ai-media-worker.ts` | Create submit/reconcile/cancel/finalize orchestration |
| `scripts/ai-media-reconcile.ts` | Create operator reconciliation CLI |
| `docs/audits/ai-media-provider-evaluation-2026-07.md` | Create provider evidence and decision record |
| `docs/superpowers/plans/2026-07-30-ai-media-selected-adapters.md` | Create only after the evidence selects exact adapters |

## Task 1: Build the provider lifecycle contract and fake adapter

**Files:**

- Modify: `packages/generative-media/test-kit/contract.ts`
- Modify: `packages/generative-media/test-kit/mock-http.ts`
- Create: `packages/generative-media/src/fake-provider.ts`
- Create: `packages/generative-media/src/fake-provider.test.ts`
- Create: `packages/generative-media/src/provider-registry.ts`
- Create: `packages/generative-media/src/provider-registry.test.ts`
- Modify: `packages/generative-media/src/index.ts`

**Interfaces:**

- Every adapter implements `submit`, `inspect`, `cancel` and `fetchOutput`.
- The fake adapter deterministically simulates completion, acceptance,
  not-created, ambiguity, callback loss and cancellation races.

- [ ] **Step 1: Write the reusable contract suite**

  Export a function with this stable shape:

  ```ts
  export interface ManagedMediaAdapterFixture {
    provider: ManagedMediaProvider;
    setScenario(
      scenario:
        | 'completed'
        | 'accepted'
        | 'not_created'
        | 'uncertain'
        | 'provider_failed'
        | 'cancel_wins'
        | 'completion_wins',
    ): void;
    calls(): readonly SanitizedAdapterCall[];
  }

  export function managedMediaProviderContract(
    name: string,
    makeFixture: () => Promise<ManagedMediaAdapterFixture>,
  ): void;
  ```

  The suite must assert bounded inputs, normalized results, same-token replay,
  changed-input conflict, inspect-by-run/token declarations, cancellation
  truth, output-fetch bounds and redacted errors.

- [ ] **Step 2: Confirm the fake adapter and registry tests are red**

  Run:

  ```bash
  bun test packages/generative-media/src/fake-provider.test.ts packages/generative-media/src/provider-registry.test.ts
  ```

  Expected: missing fake provider/fixture and registry exports.

- [ ] **Step 3: Implement the deterministic fake and registry**

  Keep state in the fixture instance, keyed by persisted client token. Return
  fixed in-memory image/video fixtures from `fetchOutput`; never open a network
  socket. Expose only sanitized call metadata to tests.

  The registry rejects duplicate adapter keys and recipe references to an
  uninstalled adapter at boot. It resolves one exact adapter by immutable
  snapshotted key and never performs implicit fallback or endpoint discovery.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test packages/generative-media/src/fake-provider.test.ts packages/generative-media/src/provider-registry.test.ts
  bun run check:boundaries
  git diff --check
  git add packages/generative-media
  git commit -m "test(ai-media): add managed provider contract fixture"
  ```

## Task 2: Preserve synchronous image compatibility behind the adapter package

**Files:**

- Create: `packages/generative-media/src/openai-image-compat.ts`
- Create: `packages/generative-media/src/openai-image-compat.test.ts`
- Modify: `packages/generative-media/src/index.ts`
- Modify: `packages/core/src/infra/ai/image-generations.ts`
- Modify: `packages/core/src/infra/ai/image-generations.test.ts`
- Modify: `apps/api/src/infra/ai/provider-composition.ts`
- Modify: `apps/api/src/infra/ai/provider-composition.test.ts`
- Modify: `apps/api/src/http/routes/ai.routes.test.ts`

**Interfaces:**

- Existing `/v1/ai/image` request/response, `economy|quality`, aspect, credit and
  optional idempotency behavior remain unchanged.
- Compatibility implementation is registered through
  `packages/generative-media`; provider identity does not leak to core/routes.

- [ ] **Step 1: Add compatibility regression tests**

  Preserve exact existing response fields and failure codes. Assert both image
  modes, all supported aspects, same-key replay, changed-body conflict, byte
  validation and credit commit/release behavior.

- [ ] **Step 2: Confirm tests pass before the move**

  Run:

  ```bash
  bun test packages/core/src/infra/ai/image-generations.test.ts apps/api/src/infra/ai/provider-composition.test.ts apps/api/src/http/routes/ai.routes.test.ts
  ```

  Expected: current compatibility tests pass. This is a characterization step;
  do not change behavior while moving the implementation.

- [ ] **Step 3: Move the implementation and keep a compatibility export**

  Put provider-specific request/response mapping in
  `openai-image-compat.ts`. Keep a narrow re-export from the old core module
  only for migration compatibility, then update composition roots to import
  the adapter package. Core continues to own the synchronous use case and
  budget semantics.

- [ ] **Step 4: Verify the move**

  Run:

  ```bash
  bun test packages/generative-media/src/openai-image-compat.test.ts packages/core/src/infra/ai/image-generations.test.ts apps/api/src/infra/ai/provider-composition.test.ts apps/api/src/http/routes/ai.routes.test.ts
  bun run check:ai-providers
  bun run check:boundaries
  ```

  Expected: no public contract diff and no provider implementation name in
  core port, API schema or web type.

- [ ] **Step 5: Commit**

  Run:

  ```bash
  git diff --check
  git add packages/generative-media packages/core/src/infra/ai apps/api/src/infra/ai apps/api/src/http/routes/ai.routes.test.ts
  git commit -m "refactor(ai): route image compatibility through adapter package"
  ```

## Task 3: Register AI media queues and durable dispatch recovery

**Files:**

- Create: `packages/queue/src/ai-media-runtime.ts`
- Create: `packages/queue/src/ai-media-runtime.test.ts`
- Modify: `packages/queue/src/index.ts`
- Modify: `packages/queue/src/runtime.ts`
- Modify: `apps/api/src/container.ts`
- Modify: `apps/worker/src/main.ts`

**Interfaces:**

- Queue payloads contain only generation/attempt IDs and expected versions.
- Separate queues isolate submission, reconciliation, cancellation,
  output-processing and recurring recovery.

- [ ] **Step 1: Write queue-name and payload tests**

  Use these exact queue names:

  ```ts
  export const AI_MEDIA_SUBMIT_QUEUE = 'ai-media-submit';
  export const AI_MEDIA_RECONCILE_QUEUE = 'ai-media-reconcile';
  export const AI_MEDIA_CANCEL_QUEUE = 'ai-media-cancel';
  export const AI_MEDIA_OUTPUT_QUEUE = 'ai-media-output';
  export const AI_MEDIA_RECOVER_QUEUE = 'ai-media-recover';
  export const AI_MEDIA_RETENTION_QUEUE = 'ai-media-retention';
  ```

  Assert payloads contain only:

  ```ts
  type GenerationJob = {
    generationId: string;
    jobVersion: number;
  };
  ```

  Reconciliation/output jobs may additionally carry `attemptId` or
  `outputId`, never prompt, provider body, signed URL, org claim or secret.

- [ ] **Step 2: Write missed-enqueue recovery tests**

  Simulate transaction commit followed by enqueue failure. The scanner must
  find the due queued generation and enqueue singleton key
  `generationId:jobVersion`. Duplicate scanner/HTTP enqueue must not create a
  second effect.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/queue/src/ai-media-runtime.test.ts
  ```

  Expected: new runtime and queues are missing.

- [ ] **Step 4: Implement job registration**

  Create queues explicitly, use `retryLimit: 0` for business transitions, and
  rethrow unexpected handler failures so pg-boss does not mark them delivered.
  Register recurring recovery separately from publishing recovery. Bound video
  output concurrency independently; phase 3 supplies the processor.

- [ ] **Step 5: Wire API and dedicated worker identically**

  Both composition roots construct the same recipe/provider registry,
  repositories, crypto, storage and AI media runtime. API `MODE=all` and
  `apps/worker` must not resolve different adapters or recipe revisions.

- [ ] **Step 6: Verify and commit**

  Run:

  ```bash
  bun test packages/queue/src/ai-media-runtime.test.ts
  bun run typecheck
  git diff --check
  git add packages/queue apps/api/src/container.ts apps/worker/src/main.ts
  git commit -m "feat(queue): add durable AI media job runtime"
  ```

## Task 4: Implement submit fencing and crash recovery

**Files:**

- Create: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Create: `packages/core/src/application/use-cases/ai-media-worker.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`
- Modify: `packages/queue/src/ai-media-runtime.ts`
- Modify: `packages/queue/src/ai-media-runtime.test.ts`

**Interfaces:**

- Submission persists attempt/client token and reserves exposure before calling
  `provider.submit`.
- Each response maps to one persisted observable fact under expected fences.

- [ ] **Step 1: Write the crash-point matrix**

  Test:

  1. crash before attempt creation;
  2. crash after attempt/spend/capacity commit but before submit;
  3. provider accepts then connection drops before response persistence;
  4. accepted response persists then worker crashes before reconcile enqueue;
  5. stale worker tries to write after lease loss;
  6. customer-credit, provider-spend or capacity admission fails before submit.

  Case 3 becomes `submission_uncertain` unless the adapter contract proves
  safe same-token replay or inspect-by-token. Case 6 must leave provider call
  count at zero.

- [ ] **Step 2: Confirm red**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-worker.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  ```

  Expected: submit use case and handler are missing.

- [ ] **Step 3: Implement the external-effect sequence**

  Execute:

  ```text
  fenced generation claim
    -> prepared attempt with random client token
    -> atomic provider spend/capacity reservation + submitting
    -> commit
    -> provider.submit outside transaction
    -> conditional accepted/completed/not_created/uncertain persistence
    -> enqueue next internal job after commit
  ```

  Do not catch an infrastructure exception merely to keep the worker alive.
  Classify only adapter-normalized provider facts; rethrow unexpected internal
  failures after persisted recovery intent exists.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-worker.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  bun run typecheck
  git diff --check
  git add packages/core/src/application/use-cases packages/db/src/repositories packages/queue/src
  git commit -m "feat(ai-media): fence provider submission and recovery"
  ```

## Task 5: Converge callback, polling and output readiness

**Files:**

- Modify: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.test.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`
- Modify: `packages/queue/src/ai-media-runtime.ts`
- Modify: `packages/queue/src/ai-media-runtime.test.ts`

**Interfaces:**

- Callback and polling enqueue reconciliation; they do not perform domain
  settlement in the HTTP/request path.
- Output retry repeats fetch/ingestion only and never resubmits inference.

- [ ] **Step 1: Write convergence tests**

  Cover callback before submit response mapping, duplicate provider event,
  callback loss recovered by polling, inspect timeout, accepted-to-completed,
  terminal provider failure and duplicate output-ready jobs.

- [ ] **Step 2: Add unmatched callback persistence tests**

  A valid early callback is stored as bounded sanitized evidence keyed by
  adapter/event/client token. No raw bytes or provider payload survives.
  Reconciliation attaches it after the attempt mapping becomes available.

- [ ] **Step 3: Confirm red and implement**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-worker.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  ```

  Expected before implementation: missing reconciliation behavior.

  Implement callback-evidence-first, inspect-by-run, inspect-by-token and
  explicitly safe same-token replay in that order. Schedule bounded polling
  only when declared by the immutable recipe snapshot.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-worker.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  git diff --check
  git add packages/core/src/application/use-cases packages/db/src/repositories packages/queue/src
  git commit -m "feat(ai-media): reconcile provider callbacks and polling"
  ```

## Task 6: Implement truthful cancellation and Redis-independent recovery

**Files:**

- Modify: `packages/core/src/application/use-cases/ai-media.ts`
- Modify: `packages/core/src/application/use-cases/ai-media.test.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.test.ts`
- Modify: `packages/queue/src/ai-media-runtime.ts`
- Modify: `packages/queue/src/ai-media-runtime.test.ts`

**Interfaces:**

- Pre-submit cancel can become terminal immediately.
- Accepted work becomes `cancellation_requested` until provider truth.
- Provider completion may win and produce success/credits despite the request.

- [ ] **Step 1: Write cancellation race tests**

  Test pre-submit cancel, unsupported cancellation, inconclusive cancel,
  confirmed cancellation, completion-before-cancel, provider failure and
  duplicate cancel commands.

- [ ] **Step 2: Write Redis-absent recovery tests**

  Construct the runtime without Redis. Prove PostgreSQL still prevents
  duplicate attempt, spend-cap overflow, capacity overflow and double
  settlement. Realtime absence may delay UI notification but not state truth.

- [ ] **Step 3: Confirm red and implement**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts packages/queue/src/ai-media-runtime.test.ts
  ```

  Expected before implementation: cancellation/recovery cases fail.

  Implement expected-version cancellation commands and scanners for queued,
  submitting, uncertain, accepted, cancel-pending and output-ready rows. Keep
  accepted/uncertain reservations until confirmed terminal truth.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts packages/queue/src/ai-media-runtime.test.ts
  git diff --check
  git add packages/core/src/application packages/queue/src
  git commit -m "feat(ai-media): make cancellation and recovery truthful"
  ```

## Task 7: Add the audited reconciliation CLI

**Files:**

- Create: `scripts/ai-media-reconcile.ts`
- Create: `scripts/ai-media-reconcile.test.ts`
- Create: `packages/core/src/application/use-cases/ai-media-reconcile.ts`
- Create: `packages/core/src/application/use-cases/ai-media-reconcile.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `package.json`

**Interfaces:**

- CLI accepts opaque attempt ID, expected version, action and bounded evidence
  reference.
- Mutations append a sanitized `SYSTEM` event.
- It cannot accept organization ID, output URL, provider secret or raw body.

- [ ] **Step 1: Write CLI parsing and authorization tests**

  Support only:

  ```text
  inspect
  attach-run --provider-run-id <opaque>
  confirm-not-created
  confirm-terminal-failure --cost-minor <integer> --currency <iso>
  confirm-canceled --cost-minor <integer> --currency <iso>
  ```

  Every mutating action requires `--attempt`, `--expected-version` and
  `--evidence-ref`. Reject URL-shaped evidence/run IDs and all unknown flags.

- [ ] **Step 2: Write core reconciliation tests**

  Prove database-derived organization/provider scope, stale-version no-op,
  read-only inspect, verified run attachment, not-created retry eligibility,
  terminal settlement and sanitized audit/event fields.

- [ ] **Step 3: Confirm red and implement**

  Run:

  ```bash
  bun test scripts/ai-media-reconcile.test.ts packages/core/src/application/use-cases/ai-media-reconcile.test.ts
  ```

  Expected before implementation: parser/use case missing.

  Implement a Bun script that loads normal application configuration without
  printing values, builds the core use case and emits JSON status/code only.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test scripts/ai-media-reconcile.test.ts packages/core/src/application/use-cases/ai-media-reconcile.test.ts
  bun run typecheck
  git diff --check
  git add scripts/ai-media-reconcile.ts scripts/ai-media-reconcile.test.ts packages/core/src package.json
  git commit -m "feat(ops): add AI media reconciliation CLI"
  ```

## Task 8: Evaluate and select native provider adapters

**Files:**

- Modify: `scripts/evals/ai-media/run.ts`
- Modify: `scripts/evals/ai-media/README.md`
- Create: `docs/audits/ai-media-provider-evaluation-2026-07.md`
- Create after decision: `docs/superpowers/plans/2026-07-30-ai-media-selected-adapters.md`

**Interfaces:**

- Produces a dated provider/endpoint decision with quality, cost, ambiguity,
  retention, rights and rollback evidence.
- Produces a separate exact implementation plan only for selected adapters.

- [ ] **Step 1: Run capped manual evaluations**

  Use operator-owned capped accounts and the synthetic corpus only. Record
  image create/edit and video prompt/image support, Portuguese typography,
  motion, moderation, latency, output size, cancellation, callback/poll
  behavior, ambiguous disconnect handling and integer minor-unit cost.

  Do not write secrets, account IDs, raw prompts, signed URLs or provider
  response bodies to the report.

- [ ] **Step 2: Complete commercial and privacy review**

  For each candidate record dated links/evidence for commercial-use rights,
  data processing, provider/runtime retention, deletion, regional constraints,
  model deprecation, price effective date and output licensing.

- [ ] **Step 3: Make an explicit decision**

  Select only endpoints that satisfy every mandatory gate. If no video endpoint
  qualifies, launch image operations only and keep `ai_video` capability
  unavailable. If no endpoint qualifies for an operation, leave it disabled.

- [ ] **Step 4: Write the provider-specific addendum**

  The addendum must name exact package files, adapter keys, protocol/model
  versions, configuration variable names, callback authentication, mock-server
  fixtures, contract tests, recipe cost/capacity values, rollout records and
  rollback predecessor. It must contain no generic adapter token standing in
  for an actual reviewed selection.

- [ ] **Step 5: Validate the addendum before implementation**

  Run:

  ```bash
  rg -n 'T[B]D|T[O]DO|place[h]older|example-provider' docs/superpowers/plans/2026-07-30-ai-media-selected-adapters.md docs/audits/ai-media-provider-evaluation-2026-07.md
  git diff --check
  ```

  Expected: no output from the provisional-content scan and no whitespace
  error.

- [ ] **Step 6: Execute the addendum test-first**

  Each selected adapter must pass `managedMediaProviderContract`, its
  mock-server protocol tests and configuration/readiness tests. Keep recipes
  disabled after the implementation commit.

## Task 9: Close the provider-execution phase

**Files:**

- Modify: `docs/audits/2026-07-30-ai-media-runtime-traceability.md`
- Modify: `openspec/changes/add-ai-media-generation-runtime/tasks.md`

**Interfaces:**

- Produces evidence for task groups 7–9 and selected-provider addendum results.
- Leaves output ingestion to phase 3 and HTTP/UI exposure to phase 4.

- [ ] **Step 1: Run focused crash/fault suites**

  Run:

  ```bash
  bun test packages/generative-media packages/core/src/application/use-cases/ai-media-worker.test.ts packages/queue/src/ai-media-runtime.test.ts scripts/ai-media-reconcile.test.ts
  bun run check:ai-providers
  bun run check:boundaries
  ```

  Expected: fake/compatibility and any selected native adapters pass without a
  real network call.

- [ ] **Step 2: Run phase gates**

  Run:

  ```bash
  bun run check
  bun run db:check
  bun run spec:validate
  git diff --check
  ```

  Expected: all commands pass.

- [ ] **Step 3: Record evidence and commit**

  Update traceability and only completed OpenSpec checkboxes. Run:

  ```bash
  git add docs/audits openspec/changes/add-ai-media-generation-runtime/tasks.md
  git commit -m "docs(ai-media): record provider runtime verification"
  ```

  Expected: no recipe was activated and no provider name leaked into customer
  contracts.
