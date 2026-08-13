# AI Media Privacy and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository policy forbids delegated agents unless the user explicitly authorizes them.

**Goal:** Remove permanent plaintext prompt provenance, enforce encrypted
30-day content retention, prove tenant/security/fault behavior, add bounded
operations telemetry and launch reviewed recipes through a reversible internal
canary.

**Architecture:** Generation content is encrypted with the existing
`CryptoService` and decrypted only inside authorized use cases/workers. An
application backfill drains legacy plaintext in bounded resumable batches;
recurring retention clears expired content while preserving non-content
accounting and provenance. Rollout disables creation first but keeps truth
reconciliation alive for accepted or uncertain work.

**Tech Stack:** Bun 1.3.14, strict TypeScript, AES-256-GCM, PostgreSQL,
pg-boss, Prometheus exposition, Railway/Docker documentation, fake-provider
fault injection and OpenSpec.

## Global Constraints

- Complete phases 1–4 before enabling any recipe.
- `ENCRYPTION_KEY` remains independent from auth secrets.
- Never print, log, audit, metric-label or return prompt/plaintext, decrypted
  options, raw provider body, credentials or signed URLs.
- Queue payloads carry IDs/versions only.
- Purging expired content is intentionally irreversible at application level;
  rollback does not reconstruct plaintext.
- Do not run a backfill while an old application replica can still write
  plaintext `media.generation_prompt`.
- Redis/telemetry failures never change business truth.
- Use bounded metric labels; never use org, generation, attempt or prompt as a
  label.
- Automated tests use fake/mock providers only.
- Canary activation is organization-scoped and cost-capped.
- During rollback, callbacks/polling/cancel/ingestion/reconciliation remain
  active until all accepted/uncertain work is truthfully terminal.

---

## Planned file structure

| Path | Change |
| --- | --- |
| `packages/core/src/application/use-cases/ai-media-retention.ts` | Create encryption/purge decisions |
| `packages/core/src/application/use-cases/ai-media-retention.test.ts` | Create retention tests |
| `packages/db/src/repositories/ai-media.repo.ts` | Add encrypted content/purge/backfill queries |
| `packages/db/src/repositories/ai-media.repo.integration.test.ts` | Add retention and concurrency tests |
| `scripts/ai-media-prompt-backfill.ts` | Create dry-run/resumable legacy backfill |
| `scripts/ai-media-prompt-backfill.test.ts` | Create no-content/idempotency tests |
| `packages/queue/src/ai-media-runtime.ts` | Add recurring retention/cleanup handler |
| `packages/core/src/application/ports/metrics.ts` | Add bounded AI-media metrics port |
| `apps/api/src/infra/metrics/prometheus.ts` | Add counters/gauges/histograms |
| `scripts/e2e-ai-media.ts` | Create fake-provider end-to-end/fault suite |
| `docs/operations/ai-media-generation.md` | Create operator activation/reconciliation/rollback runbook |
| `docs/architecture/*.md` | Update actual runtime, data and package maps |
| `.env.example` | Document non-secret configuration contract |
| `CHANGELOG.md` | Record user, developer, data, privacy and operations impact |

## Task 1: Encrypt all new generation and compatibility content

**Files:**

- Modify: `packages/core/src/application/use-cases/ai-media.ts`
- Modify: `packages/core/src/application/use-cases/ai-media.test.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.test.ts`
- Create: `packages/core/src/application/use-cases/ai-media-retention.ts`
- Create: `packages/core/src/application/use-cases/ai-media-retention.test.ts`
- Modify: `packages/core/src/application/use-cases/ai-image.ts`
- Modify: `packages/core/src/application/use-cases/ai-image.test.ts`
- Modify: `packages/core/src/application/ports/media.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`
- Modify: `packages/db/src/repositories/media.repo.ts`

**Interfaces:**

- Async canonical input and temporary output locators are encrypted with row
  identity as AAD and have `content_expires_at`.
- New synchronous image media records do not write plaintext
  `generation_prompt`; they retain non-content source/model/recipe provenance.
- Keyed request/input fingerprints remain after content purge.

- [ ] **Step 1: Write encryption-boundary tests**

  Assert the repository receives ciphertext/key version/expiry, never the
  prompt. Queue jobs and worker logs contain IDs/version only. Authorized
  creator/admin decryption succeeds before expiry; other member/cross-tenant
  access and wrong AAD/key version fail without revealing content.

- [ ] **Step 2: Write compatibility tests**

  Existing `/v1/ai/image` response, media identity, source, model provenance,
  credits and idempotency remain unchanged. Inspect the stored row and assert
  plaintext `generation_prompt` is null while encrypted compatibility prompt
  metadata exists with 30-day expiry.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts packages/core/src/application/use-cases/ai-media-retention.test.ts packages/core/src/application/use-cases/ai-image.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts
  ```

  Expected: compatibility path still writes plaintext or new retention use case
  is absent.

- [ ] **Step 4: Implement canonical encryption**

  Serialize a versioned canonical object, encrypt through `CryptoService` with
  `ai-media-generation:<generationId>` or
  `media-generation:<mediaId>` AAD, and set expiry from persisted creation time.
  Decrypt only after authorization and immediately before adapter use/detail
  response. Do not include decrypted content in caught errors.

- [ ] **Step 5: Stop new plaintext provenance writes**

  Update `MediaRecord` so public/application provenance exposes source,
  model/recipe and an input-retained boolean, not `generationPrompt`. Keep the
  database column only for the compatibility backfill window.

- [ ] **Step 6: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts packages/core/src/application/use-cases/ai-media-retention.test.ts packages/core/src/application/use-cases/ai-image.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts
  bun run typecheck
  bun run db:check
  git diff --check
  git add packages/core/src packages/db/src/repositories
  git commit -m "feat(ai-media): encrypt generation content at rest"
  ```

## Task 2: Backfill and purge legacy plaintext prompts safely

**Files:**

- Create: `scripts/ai-media-prompt-backfill.ts`
- Create: `scripts/ai-media-prompt-backfill.test.ts`
- Modify: `package.json`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`

**Interfaces:**

- Command supports dry-run, bounded batch size and resumable cursor.
- Recent plaintext is encrypted then nulled; already-expired plaintext is
  nulled directly.
- It refuses mutation without explicit old-writer-drained acknowledgement.

- [ ] **Step 1: Write parser and output tests**

  Support:

  ```text
  bun run scripts/ai-media-prompt-backfill.ts --dry-run --batch-size 100
  bun run scripts/ai-media-prompt-backfill.ts --apply --old-writers-drained --batch-size 100
  ```

  JSON output contains only counts, oldest/newest timestamps, cursor and status.
  Test invalid batch sizes, mutually exclusive mode flags, missing drain
  acknowledgement and zero prompt leakage.

- [ ] **Step 2: Write repository backfill tests**

  Cover recent encryption, expired direct nulling, idempotent rerun, crash
  between batches, row changed by a concurrent writer, stable cursor and
  organization-independent bounded scanning without returning content to the
  CLI layer.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test scripts/ai-media-prompt-backfill.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts
  ```

  Expected: command and repository batch methods are missing.

- [ ] **Step 4: Implement resumable batches**

  Select rows ordered by primary key with `FOR UPDATE SKIP LOCKED`, process at
  most the validated batch size, use row ID as AAD and conditionally update the
  original plaintext/version predicate. Commit each batch independently and
  emit only bounded counts.

- [ ] **Step 5: Verify dry-run and apply on disposable data**

  Seed a disposable previous-schema database with recent, expired and null
  prompts. Run dry-run, apply, interruption/resume and rerun. Query counts and
  ciphertext presence without selecting/printing prompt values.

- [ ] **Step 6: Commit**

  Run:

  ```bash
  bun test scripts/ai-media-prompt-backfill.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts
  git diff --check
  git add scripts/ai-media-prompt-backfill.ts scripts/ai-media-prompt-backfill.test.ts packages/db/src/repositories package.json
  git commit -m "feat(privacy): backfill legacy AI prompt encryption"
  ```

## Task 3: Enforce recurring content and staging retention

**Files:**

- Modify: `packages/core/src/application/use-cases/ai-media-retention.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-retention.test.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`
- Modify: `packages/queue/src/ai-media-runtime.ts`
- Modify: `packages/queue/src/ai-media-runtime.test.ts`

**Interfaces:**

- Generation/compatibility content is cleared at 30 days.
- Provider output locators clear immediately after ingestion or terminal
  no-output.
- Accounting, actor, status, recipe/model provenance and media link remain.

- [ ] **Step 1: Write retention tests**

  Freeze time and cover just-before/at/after expiry, repeat runs, mixed async
  and compatibility rows, output locator early cleanup, active staging
  exclusion, expired staging cleanup and preservation of non-content fields.

- [ ] **Step 2: Write backlog and failure tests**

  Repository failure must cause job failure/retry through the recurring scanner
  policy; partial batch progress is safe. Metrics receive counts/age only, not
  IDs or content.

- [ ] **Step 3: Confirm red and implement**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-retention.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  ```

  Expected before implementation: purge worker behavior is missing.

  Implement conditional bounded batch clears and recurring
  `AI_MEDIA_RETENTION_QUEUE` scheduling. Clear ciphertext, key version and
  locator fields together while leaving keyed fingerprints and non-content
  evidence.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-retention.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  git diff --check
  git add packages/core/src/application/use-cases packages/db/src/repositories packages/queue/src
  git commit -m "feat(privacy): enforce AI media content retention"
  ```

## Task 4: Add tenant, SSRF and fault-injection end-to-end coverage

**Files:**

- Create: `scripts/e2e-ai-media.ts`
- Create: `scripts/e2e-ai-media.test.ts`
- Modify: `package.json`

**Interfaces:**

- E2E uses disposable PostgreSQL/Redis/object storage and fake provider only.
- It proves behavior at route, queue, repository and storage boundaries.

- [ ] **Step 1: Write the E2E harness contract**

  Require explicit test-only database/Redis/storage endpoints and refuse hosts
  not allowlisted by the existing E2E safety helper. Seed two organizations,
  member/admin actors, fake recipes and bounded media fixtures.

- [ ] **Step 2: Add tenant/authorization cases**

  Cover cross-tenant generation, input media, retained input, output media,
  member-other/admin access, callback mapping and attach visibility. Every
  cross-tenant direct ID must be not-found or forbidden exactly as specified.

- [ ] **Step 3: Add fault cases**

  Cover:

  - crash after create commit/before enqueue;
  - duplicate job/callback and missed callback;
  - ambiguous submit and audited resolution;
  - stale lease/version;
  - cancellation/completion race;
  - provider outage and capacity/spend exhaustion;
  - output write/database partial failure;
  - Redis absence;
  - retention/backfill interruption.

- [ ] **Step 4: Add security-negative cases**

  Cover arbitrary output/reference URLs, scheme/private DNS/rebinding/redirect,
  oversized/malformed media, staging public access, callback signature/replay
  and storage credential exposure.

- [ ] **Step 5: Confirm the suite detects missing wiring**

  Run:

  ```bash
  bun test scripts/e2e-ai-media.test.ts
  ```

  Expected before full harness implementation: missing fixture/runtime setup.

- [ ] **Step 6: Implement and run against isolated dependencies**

  Add this exact root script:

  ```json
  {
    "e2e:ai-media": "bun run scripts/e2e-ai-media.ts"
  }
  ```

  Run:

  ```bash
  bun run e2e:ai-media
  ```

  Expected: all cases pass with zero outbound request to a real provider.

- [ ] **Step 7: Commit**

  Run:

  ```bash
  git diff --check
  git add scripts/e2e-ai-media.ts scripts/e2e-ai-media.test.ts package.json
  git commit -m "test(ai-media): cover tenant and runtime fault boundaries"
  ```

## Task 5: Add bounded metrics, alerts and operational diagnostics

**Files:**

- Modify: `packages/core/src/application/ports/metrics.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-retention.ts`
- Modify: `apps/api/src/infra/metrics/prometheus.ts`
- Modify: `apps/api/src/infra/metrics/prometheus.test.ts`
- Create: `docs/operations/ai-media-generation.md`

**Interfaces:**

- Metrics use bounded operation/status/recipe-revision classes only.
- Runbook defines alerts and diagnostics without secret values.

- [ ] **Step 1: Write metrics tests**

  Add bounded series for generation result, state latency, uncertainty age,
  cancellation result, customer-credit settlement, provider cost/capacity
  decision, output ingestion, staging cleanup and retention backlog.

  Test metric output contains none of:

  ```text
  org-
  gen-
  prompt
  signed
  authorization
  api_key
  ```

- [ ] **Step 2: Confirm red**

  Run:

  ```bash
  bun test apps/api/src/infra/metrics/prometheus.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts packages/core/src/application/use-cases/ai-media-retention.test.ts
  ```

  Expected: AI-media sink methods and series are absent.

- [ ] **Step 3: Implement best-effort metrics**

  Extend `MetricsSink` with optional methods so unrelated composition remains
  compatible. Restrict label values to closed operations/statuses and
  sanitized reason classes. Metrics exceptions are swallowed at the adapter
  boundary and never alter state.

- [ ] **Step 4: Write alert/runbook thresholds**

  Document actionable alerts for stale queued/running/finalizing work,
  uncertainty/reservation age, callback authentication failure, price/outage,
  spend/capacity saturation, media-tool readiness, ingestion failure, staging
  cleanup and retention backlog. Each alert includes query, symptom,
  diagnostic command, safe action and escalation/rollback rule.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test apps/api/src/infra/metrics/prometheus.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts packages/core/src/application/use-cases/ai-media-retention.test.ts
  git diff --check
  git add packages/core/src apps/api/src/infra/metrics docs/operations/ai-media-generation.md
  git commit -m "feat(ops): observe AI media runtime safely"
  ```

## Task 6: Synchronize architecture, configuration, deployment and changelog

**Files:**

- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/repository-map.md`
- Modify: `docs/architecture/flows.md`
- Modify: `docs/architecture/data-and-infrastructure.md`
- Modify: `docs/operations/development.md`
- Modify: `docs/operations/ai-media-generation.md`
- Modify: `.env.example`
- Modify: `railway.json` only if the existing process command/readiness must change
- Modify: `railway.toml` only if the existing process contract must change
- Modify: `CHANGELOG.md`
- Modify: `docs/audits/postiz-reference-inventory.md` only for touched classified references

**Interfaces:**

- Documentation describes the implemented runtime, not the rejected Comfy
  architecture.
- This change adds worker duties and dependencies but no new Railway service.

- [ ] **Step 1: Update architecture and data maps**

  Document the new package, tables, queue names, composition roots, generation
  state, attempt uncertainty, one-output ingestion, streaming S3, private
  staging, video tools, encryption and backup/object-retention boundary.

- [ ] **Step 2: Update configuration contract**

  Document exact variable names, purpose, requirement conditions and formats
  only. Ensure API and worker receive the same adapter/recipe/storage settings.
  State that provider secrets are dedicated per selected adapter and never
  inherited from unrelated text/image endpoints.

- [ ] **Step 3: Update Railway/deployment guidance**

  State explicitly that no Comfy/GPU/Python service is introduced. Document
  worker CPU/memory/temp disk, S3 and FFmpeg readiness, additive migration
  ordering, old-writer drain, backfill, canary activation and rollback
  ordering. Change Railway manifests only when the verified runtime requires
  an actual command/health/resource contract change.

- [ ] **Step 4: Update user/developer/privacy changelog**

  Record guided image/video operations, one output, explicit attachment,
  separate entitlements, customer credits, provider-cost separation,
  synchronous compatibility, 30-day content purge, migration and operational
  impact.

- [ ] **Step 5: Run documentation safety checks**

  Run:

  ```bash
  rg -n 'Comfy|App Mode|Studio|graph compiler|custom node|GPU|RunPod' docs/architecture docs/operations CHANGELOG.md
  rg -n 'postgres[q]l://|redis://|sk_live_|sk_test_|BEGIN (RSA|OPENSSH) PRIVATE KEY' docs .env.example CHANGELOG.md
  git diff --check
  ```

  Expected: Comfy-family terms appear only in an explicit non-goal/future
  architecture note; secret-pattern scan has no real value.

- [ ] **Step 6: Commit**

  Run:

  ```bash
  git add docs/architecture docs/operations .env.example CHANGELOG.md
  git add railway.json railway.toml docs/audits/postiz-reference-inventory.md
  git commit -m "docs(ai-media): document runtime operations and privacy"
  ```

  Stage the conditional files only when their diff exists.

## Task 7: Execute internal canary and rollback drills

**Files:**

- Modify: `docs/operations/ai-media-generation.md`
- Modify: `docs/audits/2026-07-30-ai-media-runtime-traceability.md`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`

**Interfaces:**

- Canary is one reviewed recipe plus explicit internal/demo organization
  allowlist and hard spend/capacity ceilings.
- Rollback disables new creation while draining accepted/uncertain work.

- [ ] **Step 1: Deploy dark**

  Apply the additive schema, then deploy API/worker/web with all recipes
  disabled. Run compatibility smoke for `/v1/ai/image`, queue/readiness,
  migrations, storage and media tools. Verify no route advertises disabled
  operations.

- [ ] **Step 2: Drain old writers and backfill**

  Confirm every old replica is stopped, run prompt backfill dry-run, review
  counts, run bounded apply and verify zero plaintext rows without selecting
  prompt values. Start retention scheduling only after this proof.

- [ ] **Step 3: Enable one internal image recipe**

  Set `canary` with explicit internal/demo organization allowlist and capped
  spend/capacity. Run the synthetic/manual image-create/edit smoke. Verify
  durable output, credits, provider cost, metrics, explicit attach and recipe
  disable rollback.

- [ ] **Step 4: Enable video only in media-ready environment**

  After image stability and only with S3/FFmpeg readiness, canary prompt/image
  video recipes. Verify duration/size limits, worker resource isolation,
  staging cleanup, poster/normalization and provider monetary ceiling.

- [ ] **Step 5: Drill failure recovery**

  In canary, simulate dropped callback, ambiguous response, provider outage,
  cancellation race, output retry and Redis loss. Use the reconciliation CLI
  only with verified evidence; confirm no blind duplicate or premature refund.

- [ ] **Step 6: Drill rollback**

  Disable create/capability/recipe promotion. Keep callbacks, polling,
  cancellation, output processing, retention and reconciliation running.
  Continue until accepted/uncertain generations become truthful terminal and
  all held reservations/capacity are settled.

- [ ] **Step 7: Record dated evidence**

  Record commit, environment name, recipe revision, operation, result,
  aggregate latency/cost, alerts and rollback timestamps without secret,
  customer payload, provider raw body or signed URL.

## Task 8: Final verification and OpenSpec completion

**Files:**

- Modify: `docs/audits/2026-07-30-ai-media-runtime-traceability.md`
- Modify: `openspec/changes/add-ai-media-generation-runtime/tasks.md`
- Modify: `CHANGELOG.md` only if final behavior differs from the prior entry

**Interfaces:**

- Reconciles requirements, tasks, implementation, generated artifacts and
  operational evidence.
- Archive occurs only after every applicable task is complete.

- [ ] **Step 1: Run all automated gates**

  Run:

  ```bash
  bun run check
  bun run db:check
  bun run build:web
  bun run spec:validate
  git diff --check
  ```

  Expected: all commands pass.

- [ ] **Step 2: Run isolated integration gates**

  Run the disposable previous-schema migration/backfill/retention drill,
  `e2e:ai-media`, fake-provider crash/fault suite, S3 streaming suite and
  production Docker build/readiness check. Never point destructive tests at
  development or production data.

- [ ] **Step 3: Audit forbidden leakage and scope**

  Run:

  ```bash
  rg -n 'generationPrompt|providerCost|signedUrl|rawBody' apps/web packages/contracts
  rg -n 'Comfy|App Mode|Studio|graph compiler|custom node|RunPod' apps packages docker railway.json railway.toml
  git status --short
  ```

  Expected: no forbidden public content fields or Comfy/runtime dependency.
  Compatibility/deprecation tests may name `generationPrompt`; inspect every
  match rather than performing a global replacement.

- [ ] **Step 4: Reconcile traceability and task truth**

  Every requirement has test/evidence. Every checked OpenSpec task corresponds
  to the diff and a passing/manual result. Report skipped paid/manual or
  environment-dependent checks explicitly.

- [ ] **Step 5: Commit final evidence**

  Run:

  ```bash
  git add docs/audits/2026-07-30-ai-media-runtime-traceability.md openspec/changes/add-ai-media-generation-runtime/tasks.md CHANGELOG.md
  git commit -m "docs(ai-media): complete runtime rollout evidence"
  ```

  Stage `CHANGELOG.md` only if it changed in this step.

- [ ] **Step 6: Archive only after reviewed completion**

  Run:

  ```bash
  openspec archive add-ai-media-generation-runtime --yes
  bun run spec:validate
  git diff --check
  ```

  Expected: archived specs validate and the resulting diff preserves every
  requirement. Verify the final commit and operational state before claiming
  completion.
