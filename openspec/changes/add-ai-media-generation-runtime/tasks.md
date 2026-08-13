## 1. Baseline and implementation gates

- [ ] 1.1 Verify `add-ai-image-quality-modes` is landed and archived; stop and
  reconcile this change if the compatibility endpoint, modes or credit values
  differ from the proposal/design baseline.
- [ ] 1.2 Read the root `AGENTS.md` and each closer `AGENTS.md` before touching
  its package, preserve unrelated worktree changes and run
  `bun install --frozen-lockfile`.
- [ ] 1.3 Record the clean baseline results of `bun run spec:validate`,
  `bun run check`, `bun run db:check`, `bun run build:web` and
  `git diff --check`; distinguish pre-existing failures from change failures.
- [ ] 1.4 Build a requirement-to-test traceability checklist for all six delta
  specs, including organization scope, negative authorization, ambiguous
  submission, settlement, retention and rollback.
- [ ] 1.5 Keep every new managed-media recipe `disabled` until its adapter,
  evidence, secrets, spend/capacity ceilings, infrastructure and rollback entry
  pass the later activation tasks.

## 2. Contracts, state machines and core ports

- [ ] 2.1 Add failing contract tests for media operation/status constants,
  provider outcome classifications, sanitized problem codes and generation
  realtime/event payload schemas in `packages/contracts`.
- [ ] 2.2 Implement the leaf contracts from task 2.1 without adding business
  logic or dependencies to `packages/contracts`.
- [ ] 2.3 Add failing pure tests for generation transitions, terminal
  immutability, cancellation races, state/version fencing and
  `submission_uncertain`.
- [ ] 2.4 Implement the generation state machine in core and prove stale
  transition attempts are no-ops.
- [ ] 2.5 Add failing pure tests for sequential provider-attempt transitions,
  at-most-one active effect, safe `not_created` retry and retry/cost ceilings.
- [ ] 2.6 Implement the provider-attempt state machine and normalized
  `accepted|completed|not_created|uncertain` decisions in core.
- [ ] 2.7 Define core ports for generation repositories/unit-of-work, provider
  lifecycle, recipe catalogue/rollout, customer credits, provider cost/capacity,
  runtime staging, media streaming/processing and audit/realtime.
- [ ] 2.8 Add compile-time/fake contract tests proving core use cases depend
  only on those ports and accept no provider SDK/config or app/database types.

## 3. Generative-media package and dependency boundaries

- [ ] 3.1 Create `packages/generative-media` with package metadata, exports,
  focused `AGENTS.md` and no generated, credential or provider-cache artifacts.
- [ ] 3.2 Add failing dependency-cruiser coverage proving core cannot import
  `packages/generative-media` and the adapter package cannot import apps/web or
  own domain settlement/authorization rules.
- [ ] 3.3 Implement the dependency rules and composition-root-only wiring
  required by task 3.2.
- [ ] 3.4 Add provider-neutral adapter test-kit utilities and mock HTTP server
  fixtures without any real provider call or committed sandbox credential.
- [ ] 3.5 Add package-focused type/test scripts through Bun workspace
  conventions without introducing npm, pnpm, Yarn or another lockfile.

## 4. Additive schema and migration

- [ ] 4.1 Read `packages/db/AGENTS.md` and add failing disposable-PostgreSQL
  schema tests for generation/attempt/output uniqueness, organization scope,
  foreign keys, state constraints and idempotency conflicts.
- [ ] 4.2 Add Drizzle schema for media generations, sequential provider
  attempts, one primary output, sanitized events, provider cost/spend/capacity
  windows and recipe activation/canary records.
- [ ] 4.3 Add failing migration tests for generation-bound AI grants with
  nullable lease semantics while preserving current synchronous grant expiry
  and period buckets.
- [ ] 4.4 Extend `ai_grants` for a unique nullable generation association and
  add the fields/indexes required for conditional async commit/release without
  changing legacy synchronous behavior.
- [ ] 4.5 Add encrypted compatibility prompt/expiry metadata and any nullable
  media-generation linkage required to stop new plaintext
  `media.generation_prompt` writes.
- [ ] 4.6 Generate a new migration only with
  `bun run --cwd packages/db generate -- --name add-ai-media-generation-runtime`;
  do not edit existing migrations or generated metadata manually.
- [ ] 4.7 Inspect generated SQL/metadata for tenant keys, uniqueness, indexes,
  locks, nullability and destructive operations; document forward/rollback and
  old-app/new-schema compatibility.
- [ ] 4.8 Apply the migration to clean and previous-schema disposable
  PostgreSQL databases, run focused integration tests, representative
  `EXPLAIN` checks and `bun run db:check`.

## 5. Repositories and transactional unit of work

- [ ] 5.1 Add failing integration tests for atomic
  generation-plus-customer-reservation creation, same-key replay and
  same-key/different-fingerprint conflict under concurrency.
- [ ] 5.2 Implement the creation unit-of-work transaction and direct
  organization-scoped generation lookup/list queries.
- [ ] 5.3 Add failing integration tests for worker lease/version claim,
  sequential attempt allocation, stale writes and at-most-one active paid
  effect.
- [ ] 5.4 Implement fenced generation/attempt repositories and scanner queries
  without network calls or enqueue inside database transactions.
- [ ] 5.5 Add failing integration tests for provider callback-event
  deduplication, early callback mapping by client token and sanitized unmatched
  reconciliation evidence.
- [ ] 5.6 Implement event/attempt mapping repositories that derive organization
  through stored state and persist no raw callback body.
- [ ] 5.7 Add failing integration tests for deterministic output allocation and
  atomic media/output/customer-settlement/generation finalization.
- [ ] 5.8 Implement finalization and terminal no-output unit-of-work methods so
  duplicate callback/poll/worker paths settle exactly once.
- [ ] 5.9 Add failing repository/use-case tests for member-own versus
  admin/owner organization-wide list/get/cancel and cross-tenant not-found.
- [ ] 5.10 Implement the authorization-scoped queries and conditional cancel
  commands from task 5.9.

## 6. Customer credits, provider cost, spend and capacity

- [ ] 6.1 Add failing tests proving the existing synchronous 180-second lease
  still reclaims legacy grants while a generation-bound grant cannot expire by
  wall-clock time.
- [ ] 6.2 Implement async customer-grant reserve/commit/release behavior and
  original-period settlement without changing synchronous BudgetGuard callers.
- [ ] 6.3 Add failing concurrency tests for organization/provider/global spend
  windows and the final outstanding-capacity slot.
- [ ] 6.4 Implement PostgreSQL conditional provider-spend/capacity claims and
  exactly-once release/settlement; Redis must remain advisory.
- [ ] 6.5 Add failing tests for accepted, `submission_uncertain` and
  cancellation-pending attempts retaining provider/customer reservations until
  truthful resolution.
- [ ] 6.6 Implement conservative reservation retention and audited resolution
  for the states in task 6.5.
- [ ] 6.7 Add failing tests for provider-reported versus recipe-derived integer
  monetary amounts with explicit currency/scale and no content/secrets.
- [ ] 6.8 Implement the operator-only provider-cost ledger while keeping
  wholesale cost out of customer capabilities/quotes/responses.
- [ ] 6.9 Add failing tests proving self-hosted plan allowance never refuses
  customer credits while configured provider spend/capacity still fails closed.
- [ ] 6.10 Implement and document the self-hosted behavior from task 6.9.

## 7. Recipe catalogue, quotes and evaluation gates

- [ ] 7.1 Add versioned synthetic image/video evaluation briefs and a
  repeatable rubric under `scripts/evals/ai-media/` with no customer/private
  content.
- [ ] 7.2 Add failing catalogue tests for operation/options, one output,
  adapter/protocol/model version, retry/idempotency/lookup, callback/poll/cancel,
  retention, rights, price, spend/capacity, activation and rollback metadata.
- [ ] 7.3 Implement disabled-by-default static recipe definitions plus
  PostgreSQL `disabled|canary|active` resolution and organization allowlists.
- [ ] 7.4 Add negative catalogue tests rejecting missing pricing/rights/
  retention evidence and launch controls such as LoRA, ControlNet, IP-Adapter,
  seed or sampler.
- [ ] 7.5 Add failing core quote tests for entitlement, installed readiness,
  normalized cost options, expiry/revision, caller-accepted maximum and
  provider-price field rejection.
- [ ] 7.6 Implement capability/quote selection so only new generations observe
  health/promotion changes and current generation snapshots stay immutable.
- [ ] 7.7 Benchmark candidate image/video API endpoints manually under capped
  operator accounts and record dated quality, Portuguese typography, motion,
  moderation, latency, ambiguity, cancellation, retention and cost evidence
  without secrets or customer payloads.
- [ ] 7.8 Complete commercial-use, data-processing, retention, deprecation and
  pricing review for each candidate; leave entries disabled when evidence is
  missing.

## 8. Provider adapters and synchronous compatibility

- [ ] 8.1 Add mock-server contract tests for managed-media
  `submit|inspect|cancel|fetchOutput`, synchronous completion, accepted run,
  proven `not_created`, ambiguous disconnect and redaction.
- [ ] 8.2 Add adapter tests for declared provider-enforced client-token
  idempotency, inspect-by-token support and changed-input conflict.
- [ ] 8.3 Implement the provider-neutral lifecycle adapter test suite and fake
  adapter used by all automated runtime/E2E tests.
- [ ] 8.4 Move or wrap the current OpenAI-compatible image implementation behind
  `packages/generative-media` while preserving `/v1/ai/image`,
  `economy|quality`, aspect, response and credit tests.
- [ ] 8.5 After task 7 evidence, add failing native contract tests for only the
  selected image-create/edit and video prompt/image adapters.
- [ ] 8.6 Implement only the reviewed selected adapters and keep their recipes
  disabled until canary activation; do not add Comfy Cloud, RunPod, GPU/local
  weights or unsupported advanced controls.
- [ ] 8.7 Add failing configuration tests for active/disabled recipes, missing
  dedicated secrets, no cross-endpoint credential inheritance and identical
  API/worker mapping.
- [ ] 8.8 Implement configuration/readiness with secret-name-only errors and
  polling-only behavior when no authenticated callback contract exists.
- [ ] 8.9 Run focused adapter/config tests and `bun run check` to prove provider
  implementation names/types do not leak into core/routes/web contracts.

## 9. Queue, provider lifecycle and recovery

- [ ] 9.1 Add failing create/dispatch tests for enqueue-after-commit, versioned
  singleton keys and recovery of a queued generation missed before enqueue.
- [ ] 9.2 Register separate pg-boss submission, reconciliation, cancellation,
  output-processing and recurring recovery jobs carrying internal IDs only.
- [ ] 9.3 Add failing crash-point tests before submit, after external
  acceptance/before response persistence and after response persistence.
- [ ] 9.4 Implement persisted attempt/client-token/spend/capacity identity
  before submit and route crash recovery through adapter-declared lookup/
  idempotency instead of blind resubmit.
- [ ] 9.5 Add failing callback/poll tests for authenticated duplicate events,
  early callback race, callback loss, inspect timeout and terminal convergence.
- [ ] 9.6 Implement callback-driven reconciliation, polling schedules and
  output-only retry under fenced leases.
- [ ] 9.7 Add failing cancellation tests for pre-submit cancel, unsupported/
  inconclusive provider cancel, completion race and duplicate commands.
- [ ] 9.8 Implement cancellation state/version fencing and truthful
  `canceled|succeeded|failed|cancellation_requested` convergence.
- [ ] 9.9 Add recovery tests with Redis absent and prove PostgreSQL still
  enforces idempotency, spend, capacity and terminal settlement.

## 10. Streaming storage, private staging and video processing

- [ ] 10.1 Add failing storage-adapter tests for bounded stream write/read,
  abort, incomplete multipart cleanup and preserved byte APIs.
- [ ] 10.2 Implement streaming on S3-compatible storage without changing
  existing public media key/URL or local byte behavior.
- [ ] 10.3 Add failing runtime-staging tests for private namespace, public-route
  denial, scoped read-only URL expiry, no bucket credentials and lifecycle
  cleanup.
- [ ] 10.4 Implement the separate runtime-staging port/composition and fail the
  requiring recipe closed when private signed transport readiness is absent.
- [ ] 10.5 Add failing provider-output retrieval tests for scheme/host,
  DNS/private address, redirect, timeout, stream-byte limit, metadata mismatch
  and sanitized failure.
- [ ] 10.6 Implement bounded output retrieval through the registered adapter or
  existing hardened outbound-media client.
- [ ] 10.7 Add failing ingestion tests for deterministic primary identity,
  object-write/database-failure retry, duplicate finalization and
  reference-aware orphan cleanup.
- [ ] 10.8 Implement image/video object ingestion, one primary media/output and
  thumbnail/poster derivatives without provider resubmission.
- [ ] 10.9 Add controlled media fixtures and failing FFprobe/FFmpeg tests for
  passthrough, normalization, corrupt/unsupported/excess output, argument
  injection, resource timeout and temp cleanup.
- [ ] 10.10 Implement bounded video probing/normalization behind an
  infrastructure port and dedicated worker concurrency class.
- [ ] 10.11 Add FFprobe/FFmpeg to the production worker/container image and
  implement readiness that advertises video only with S3-compatible durable
  storage and supported media tools.

## 11. Application API, callbacks, realtime and operator reconciliation

- [ ] 11.1 Add failing route tests for media capabilities and quotes, including
  entitlement/config/admission distinction, accepted credits and sanitized
  problem+json.
- [ ] 11.2 Implement capability/quote routes backed only by core use cases.
- [ ] 11.3 Add failing route tests for generation create/list/get/cancel,
  mandatory async idempotency, member-own/admin-all RBAC, cross-tenant 404 and
  purged-input responses.
- [ ] 11.4 Implement generation routes without provider/database business logic
  in Hono handlers and never return wholesale cost, endpoint, raw body or signed
  URL.
- [ ] 11.5 Add failing provider callback route tests for exact raw-body
  signature, timestamp/replay, event deduplication, early mapping and invalid
  callback no-op.
- [ ] 11.6 Implement only authenticated callback routes required by selected
  adapters; polling-only adapters get no state-changing unauthenticated route.
- [ ] 11.7 Add failing operational reconciliation CLI tests for read-only
  inspect, verified run attachment, proven `not_created`, terminal
  failure/cancel, stale version and arbitrary output URL rejection.
- [ ] 11.8 Implement the Bun reconciliation CLI through the core use case with
  opaque attempt ID, evidence reference and sanitized `SYSTEM` audit events.
- [ ] 11.9 Add bounded generation-status events to existing Redis/SSE and test
  persisted GET recovery after missed realtime.
- [ ] 11.10 Start the local API, run
  `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api` and review
  `apps/web/openapi.json` with `apps/web/src/lib/api/schema.d.ts`.

## 12. Encryption, legacy prompt backfill and retention

- [ ] 12.1 Add failing core/repository tests for canonical input encryption,
  keyed request fingerprint, authorized decryption and jobs/logs without
  content.
- [ ] 12.2 Implement generation content encryption through the existing
  `CryptoService`; queue payloads contain only internal IDs/version.
- [ ] 12.3 Add failing compatibility tests proving new synchronous image calls
  preserve their public response/provenance while no longer writing plaintext
  `media.generation_prompt`.
- [ ] 12.4 Implement encrypted compatibility prompt metadata and keep
  non-content `source='ai'`/model provenance.
- [ ] 12.5 Add failing backfill tests for dry-run counts, bounded batches,
  encryption of recent plaintext, direct purge of expired plaintext,
  idempotency and zero prompt logging.
- [ ] 12.6 Implement the backfill command/job with an explicit old-writer drain
  precondition and resumable checkpoints.
- [ ] 12.7 Add failing retention tests for 30-day generation/compatibility
  content purge, earlier output-locator cleanup and preserved non-content
  accounting/provenance.
- [ ] 12.8 Implement the recurring retention worker and sanitized backlog/
  completion metrics.

## 13. Guided composer and accessibility

- [ ] 13.1 Add failing web tests for capability-driven image/video operations,
  plan lock, permanent unavailability, temporary capacity and absence of
  unsupported/provider-native controls.
- [ ] 13.2 Implement the guided operation/input surface using only the generated
  OpenAPI client.
- [ ] 13.3 Add failing web tests for quote display, expensive confirmation,
  quote increase/reconfirmation and no reservation from quote alone.
- [ ] 13.4 Implement quote confirmation and one idempotency key per confirmed
  logical submission, with a new key after input/options/variant changes.
- [ ] 13.5 Add failing web tests for persisted progress, SSE loss/GET recovery,
  leave/resume, moderation/failure, `submission_uncertain` and truthful
  cancellation.
- [ ] 13.6 Implement status/history/cancel UX without blind retry, raw provider
  detail or premature refund/success claims.
- [ ] 13.7 Add failing tests for one primary preview, editable alt text,
  explicit attach, same draft/media attach replay and changed-draft target
  confirmation.
- [ ] 13.8 Implement review/attach through the existing media/composer path;
  generation alone never mutates, schedules or publishes a post.
- [ ] 13.9 Add failing focus/caret, keyboard, accessible-name/status and reduced
  motion tests for open, confirmation, background updates, failures and close.
- [ ] 13.10 Implement accessibility behavior and manually verify desktop/
  mobile, keyboard, screen reader, light/dark and reconnect states.

## 14. Security, fault injection and observability

- [ ] 14.1 Add fake-provider integration/E2E tests for cross-tenant generation,
  input media, output, retained prompt, member/admin role and attach access.
- [ ] 14.2 Add fault tests for duplicate callback, callback loss, ambiguous
  submit, stale lease, queue duplication, cancellation race, provider outage
  and output/database partial failure.
- [ ] 14.3 Add negative tests for arbitrary URL, SSRF/DNS rebinding/redirect,
  oversized/malformed media, staging public access and storage credential
  exposure.
- [ ] 14.4 Add tests proving logs/audits/problems/metrics contain no prompt,
  signed URL, raw provider body, credentials or unbounded organization/run IDs.
- [ ] 14.5 Implement bounded metrics for operation/status/recipe, latency,
  uncertainty, cancellation, credits, provider cost/capacity, ingestion,
  staging cleanup and retention.
- [ ] 14.6 Add alerts for stale queued/running/finalizing work, uncertainty/
  reservation age, callback auth failure, provider price/outage, spend/capacity,
  media readiness, ingestion and retention backlog.
- [ ] 14.7 Run the focused negative/fault suites with fake adapters only; no
  automated test may call a real paid provider.

## 15. Documentation, deployment and changelog

- [ ] 15.1 Update `docs/architecture/README.md`,
  `docs/architecture/repository-map.md` and dependency diagrams for the actual
  S3 driver, new package, tables, queues and composition roots.
- [ ] 15.2 Update data/infrastructure documentation for async state, provider
  cost/capacity, streaming S3, private runtime staging, FFmpeg/FFprobe and
  backup/object retention boundaries.
- [ ] 15.3 Update configuration references and `.env.example` with variable
  names, purpose, requirement rules and format only; include no values or
  credential examples.
- [ ] 15.4 Write operator runbooks for provider activation/rollback,
  `submission_uncertain` diagnostics/reconciliation, reservation/spend leaks,
  staging cleanup and prompt backfill/retention.
- [ ] 15.5 Update Railway/deployment docs to state that this change adds no
  service and to describe worker resources/readiness, S3/media tools, canary
  configuration and rollback ordering.
- [ ] 15.6 Update user/developer/privacy documentation for guided operations,
  one output, explicit attachment, customer credits, provider-cost separation
  and 30-day content retention.
- [ ] 15.7 Update `CHANGELOG.md` with user, developer, data, privacy and
  operational impacts plus compatibility and rollback notes.
- [ ] 15.8 Verify Manypost naming and classify any touched Postiz references;
  update the reference inventory only when an occurrence actually changes.

## 16. Canary, rollback and final verification

- [ ] 16.1 Run focused package/use-case/route/web tests after every vertical
  slice and fix failures before enabling its recipe/route.
- [ ] 16.2 Run migration and rollback-compatibility drills against disposable
  previous-schema data; never use development or production data as the test
  target.
- [ ] 16.3 Build the production container and verify worker media-tool
  readiness, no GPU/model/Python/Comfy dependency and no accidental secret or
  generated artifact.
- [ ] 16.4 Run fake-provider end-to-end drills for crash-before-enqueue,
  crash-after-acceptance, duplicate/missed callback, uncertain reconciliation,
  cancellation race, output retry, Redis absence and cap exhaustion.
- [ ] 16.5 Enable one reviewed image recipe for internal/demo organizations,
  execute capped manual smoke/evaluation and verify permanent ingestion,
  credits/provider cost, observability and disable rollback.
- [ ] 16.6 Enable reviewed video recipes only in S3/media-ready environments,
  execute capped prompt/image video smoke and verify worker resource/spend
  ceilings.
- [ ] 16.7 Drill rollback by disabling new creation/recipes while keeping
  callbacks, polling, cancellation, ingestion, cleanup and reconciliation
  active until accepted/uncertain work is truthful terminal.
- [ ] 16.8 Run final `bun run check`, `bun run db:check`,
  `bun run build:web`, `bun run spec:validate` and `git diff --check`; report
  every skipped paid/manual/environment-dependent check explicitly.
- [ ] 16.9 Reconcile requirements, tasks, implementation diff, generated
  OpenAPI, migration, documentation and `CHANGELOG.md`; archive only after all
  applicable tasks and rollout/rollback evidence are complete.
