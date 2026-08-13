# AI Media Generation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute the linked phase plans, one checked step at a time. This document controls sequencing and governance. Repository policy forbids delegated agents unless the user explicitly authorizes them.

**Document role:** Master delivery plan and phase gate index.

**Goal:** Deliver durable, tenant-safe guided image and video generation while
preserving `/v1/ai/image`, keeping provider choice replaceable, making customer
credits and wholesale provider cost truthful, and leaving workflow
orchestration for a separate OpenSpec change.

**Architecture:** Manypost owns authentication, authorization, durable
generation state, provider-attempt truth, idempotency, budgets, storage,
settlement and recovery. External managed-media APIs are adapters behind core
ports. PostgreSQL is authoritative; pg-boss is at-least-once delivery and Redis
is advisory. The web uses only generated OpenAPI contracts. This change adds no
ComfyUI service, workflow graph, App Mode, Studio, custom node or GPU runtime.

**Tech Stack:** Bun 1.3.14, strict TypeScript, Hono, Next.js 16, React 19,
PostgreSQL, Drizzle, pg-boss, Redis, S3-compatible object storage,
FFmpeg/FFprobe, `bun:test`, dependency-cruiser and OpenSpec 1.6.0.

## Global Constraints

- Follow the root `AGENTS.md` and every closer `AGENTS.md`.
- Use Bun only. Do not use npm, pnpm or Yarn and do not edit `bun.lock`
  manually.
- Start each behavioral slice with a failing focused test and confirm that it
  fails for the intended missing behavior.
- Before every `git add`, inspect the target diff and stage only task-owned
  changes. If a target file contains unrelated user work that cannot be
  separated safely, stop that commit and ask for direction.
- Never edit generated OpenAPI files, Drizzle metadata or existing migrations
  manually.
- Keep `packages/contracts` free of business logic and keep `packages/core`
  independent of apps, database, queue and provider implementations.
- Every organization-owned read and write must prove tenant scope. Cross-tenant
  identifiers return not-found where required by the specs.
- PostgreSQL, not Redis or a queue singleton, enforces idempotency, credits,
  provider spend, outstanding capacity and terminal settlement.
- Commit before enqueue. Persist attempt identity and reserve provider exposure
  before an external submission.
- Never retry or fall back from an ambiguous provider submission. Preserve
  `submission_uncertain` until provider truth or an audited operator decision.
- Do not log prompts, raw provider bodies, credentials, signed URLs or
  unbounded organization/generation identifiers.
- Managed-media recipes start `disabled`. A recipe cannot enter canary before
  quality, rights, retention, pricing, secret, spend/capacity and rollback
  evidence exists.
- Keep customer credits separate from wholesale provider cost. Provider price
  and implementation identity never appear in customer APIs or the Composer.
- Guided generation returns one primary output. A successful generation never
  attaches, schedules or publishes without an explicit user action.
- Video is unavailable unless S3-compatible durable storage and bounded
  FFmpeg/FFprobe processing are ready.
- This change adds no ComfyUI, Python inference service, local model, GPU,
  Comfy Cloud, RunPod, graph compiler, workflow persistence, App Mode or Studio.
- Update documentation and `CHANGELOG.md` in the same implementation change.
- Report only checks actually run. Archive the OpenSpec change only after
  implementation, rollout and rollback evidence are complete.

---

## Canonical implementation file map

The phase plans use these names consistently. Change a name only by updating
all five plans and the OpenSpec tasks in the same planning commit.

| Path | Responsibility |
| --- | --- |
| `packages/contracts/src/ai-media.ts` | Stable media operations, statuses, public DTOs and realtime event payloads |
| `packages/contracts/src/ai-media.test.ts` | Leaf-contract and closed-enum tests |
| `packages/core/src/domain/ai-media/generation-state.ts` | Pure generation transition and version-fencing rules |
| `packages/core/src/domain/ai-media/provider-attempt-state.ts` | Pure provider-attempt truth and safe retry rules |
| `packages/core/src/application/ports/ai-media.ts` | Generation repositories, transactional unit of work, recipe, cost and staging ports |
| `packages/core/src/application/ports/managed-media-provider.ts` | Provider lifecycle facts reported to core |
| `packages/core/src/application/ports/media-processing.ts` | Bounded stream inspection/normalization interface |
| `packages/core/src/application/use-cases/ai-media.ts` | Capabilities, quote, create/list/get/cancel use cases |
| `packages/core/src/application/use-cases/ai-media-worker.ts` | Submission, reconciliation, ingestion, settlement and recovery use cases |
| `packages/core/src/application/use-cases/ai-media-retention.ts` | Encrypted-content purge and legacy prompt retention use cases |
| `packages/generative-media/` | Provider adapters, catalogue definitions, fake adapter and media infrastructure adapters |
| `packages/db/src/schema/ai-media.ts` | Additive generation, attempt, output, event, spend and rollout tables |
| `packages/db/src/repositories/ai-media.repo.ts` | Organization-scoped repositories and Drizzle unit of work |
| `packages/queue/src/ai-media-runtime.ts` | pg-boss jobs and recurring scanners for AI media |
| `apps/api/src/http/routes/ai-media.routes.ts` | Authenticated capabilities, quote and generation HTTP adapters |
| `apps/api/src/http/routes/ai-media-callback.routes.ts` | Authenticated provider callbacks selected by adapter evidence |
| `scripts/ai-media-reconcile.ts` | Audited operator-only reconciliation CLI |
| `apps/web/src/features/ai-media/` | Guided generation, progress, review and explicit attachment UI |
| `scripts/evals/ai-media/` | Synthetic evaluation corpus, runner, rubric and dated evidence |

## Executable phase plans

| Order | Plan | OpenSpec task groups | Exit condition |
| --- | --- | --- | --- |
| 1 | [Foundation, persistence and budgets](./2026-07-30-ai-media-runtime-foundation.md) | 1–6 | Atomic idempotent generation creation and fenced state transitions pass with no external call |
| 2 | [Provider execution and recovery](./2026-07-30-ai-media-provider-execution.md) | 7–9 | Fake and compatibility adapters converge under duplicate, crash and ambiguity tests |
| 3 | [Storage and video processing](./2026-07-30-ai-media-storage-video.md) | 10 | One bounded durable output is ingested; video readiness fails closed |
| 4 | [API and guided Composer](./2026-07-30-ai-media-api-composer.md) | 11 and 13 | Generated API and accessible guided UI support resumable explicit attachment |
| 5 | [Privacy, operations and rollout](./2026-07-30-ai-media-privacy-rollout.md) | 12 and 14–16 | Content retention, fault tests, docs, canary and rollback evidence are complete |

## Dependency and gate graph

```text
baseline
  -> contracts/state machines
  -> additive schema + unit of work + async credit reservations
  -> disabled recipe catalogue + quotes
  -> fake/compatibility adapters + queues + recovery
  -> bounded storage/image ingestion
  -> S3 + FFmpeg readiness
  -> API/OpenAPI
  -> guided Composer
  -> privacy backfill + retention + fault/security suites
  -> internal canary
  -> recipe activation
```

The provider evaluation branch joins only after the provider-neutral runtime is
green:

```text
synthetic evaluation + legal/privacy/pricing review
  -> written provider decision
  -> provider-specific implementation-plan addendum
  -> native adapter contract tests
  -> disabled native recipe
  -> internal canary
```

## Decisions that stop implementation

- If `add-ai-image-quality-modes` is not archived or its synchronous contract
  differs from this change, stop and reconcile the OpenSpec artifacts first.
- If the current migration history or production compatibility requires a
  destructive rewrite, stop; design an additive expand/backfill/contract path.
- If a candidate provider lacks evidence for rights, retention, pricing,
  bounded cost or ambiguity recovery, do not implement or activate its recipe.
- If a provider does not guarantee client-token idempotency and cannot inspect
  by token, a lost submission response must remain `submission_uncertain`.
- If private S3 staging cannot issue scoped, expiring read-only URLs, keep
  URL-transport recipes disabled.
- If FFmpeg/FFprobe is absent, unpinned or outside resource limits, do not
  advertise video capability.
- If prompt backfill cannot distinguish old writers from drained writers, do
  not purge while an old application version can still write plaintext.
- If accepted or uncertain work remains during rollback, disable creation but
  keep callbacks, polling, cancellation, ingestion and reconciliation alive.

## Commit and review strategy

Each phase plan names reviewable Conventional Commits. A commit must contain
one behavior and its tests. Do not create empty milestone commits. Generated
migration/OpenAPI output travels with the source change that generated it.

Before each commit:

```bash
bun test <focused-test-paths>
git diff --check
git status --short
```

At the end of each phase:

```bash
bun run check
bun run db:check
bun run spec:validate
git diff --check
```

`bun run build:web` is additionally mandatory after web or generated OpenAPI
changes. Database phases also require clean and previous-schema disposable
PostgreSQL migration tests.

## Requirements-to-plan traceability

| Requirement area | Primary phase | Cross-check |
| --- | --- | --- |
| Durable async resource, immutable recipes, idempotent create | 1 | 2, 4 |
| Provider identity before effect and uncertainty | 1, 2 | 5 |
| Callback/poll/cancel convergence | 2 | 4, 5 |
| Customer credits, provider cost and capacity | 1, 2 | 5 |
| One validated durable media output | 3 | 2, 4 |
| Capabilities, quotes and stable public contracts | 1, 4 | 5 |
| Encrypted content and 30-day purge | 1, 5 | 4 |
| Guided Composer, resumability and explicit attach | 4 | 5 |
| Streaming S3, private staging and video bounds | 3 | 5 |
| Security, observability, canary and rollback | 5 | all |
| Synchronous `/v1/ai/image` compatibility | 2 | 4, 5 |

## OpenSpec task-group mapping

| Group | Executable plan task |
| --- | --- |
| 1. Baseline and implementation gates | Foundation task 1 and all phase-closing gates |
| 2. Contracts, state machines and core ports | Foundation tasks 2–4 |
| 3. Generative-media package and boundaries | Foundation task 4 |
| 4. Additive schema and migration | Foundation task 5 |
| 5. Repositories and transactional unit of work | Foundation task 6 |
| 6. Customer credits, provider cost, spend and capacity | Foundation task 7 |
| 7. Recipe catalogue, quotes and evaluation gates | Foundation task 8 and provider-execution task 8 |
| 8. Provider adapters and synchronous compatibility | Provider-execution tasks 1, 2 and 8 |
| 9. Queue, provider lifecycle and recovery | Provider-execution tasks 3–7 |
| 10. Streaming storage, private staging and video | Storage/video tasks 1–7 |
| 11. API, callbacks, realtime and operator reconciliation | API/Composer tasks 1–5 and provider-execution task 7 |
| 12. Encryption, legacy prompt backfill and retention | Privacy/rollout tasks 1–3 |
| 13. Guided Composer and accessibility | API/Composer tasks 6–8 |
| 14. Security, fault injection and observability | Privacy/rollout tasks 4–5 |
| 15. Documentation, deployment and changelog | Privacy/rollout task 6 |
| 16. Canary, rollback and final verification | Privacy/rollout tasks 7–8 |

## Final completion checklist

- [ ] Every OpenSpec task from groups 1–16 is linked to implementation evidence.
- [ ] All six delta specs have positive, negative, concurrency and recovery
  coverage where applicable.
- [ ] Managed recipes were never enabled before their evidence and rollback
  gates.
- [ ] No provider, raw endpoint, wholesale price or signed URL leaked into
  stable customer contracts.
- [ ] No ComfyUI/workflow/App Mode/Studio service or dependency entered this
  change.
- [ ] `bun run check`, `bun run db:check`, `bun run build:web`,
  `bun run spec:validate` and `git diff --check` pass.
- [ ] Paid/manual/environment-dependent checks are named explicitly with dated
  evidence or explicitly reported as not run.
- [ ] Deployment rollback was drilled without abandoning accepted or uncertain
  provider work.
- [ ] Documentation, configuration references, runbooks and `CHANGELOG.md`
  match the final diff.
- [ ] The change is archived only after the resulting commit and operational
  state are verified.
