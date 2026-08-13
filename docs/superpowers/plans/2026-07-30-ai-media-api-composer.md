# AI Media API and Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository policy forbids delegated agents unless the user explicitly authorizes them.

**Goal:** Expose stable authenticated capabilities, quotes and durable
generation resources, then deliver an accessible guided Composer experience
with resumable progress, honest uncertainty/cancellation and explicit media
attachment.

**Architecture:** Hono adapts HTTP to core use cases and returns problem+json;
it contains no database/provider decisions. Signed callbacks enqueue
reconciliation. Redis/SSE accelerates updates while persisted GET remains
authoritative. The Next.js client imports only generated OpenAPI types and
never provider/server packages.

**Tech Stack:** Bun 1.3.14, Hono/OpenAPI, Next.js 16, React 19, TanStack Query,
next-intl, Zustand, existing SSE/realtime, `bun:test` and generated
`openapi-typescript` contracts.

## Global Constraints

- Complete the first three phases before exposing the async API.
- Derive actor and organization from authenticated context, never request data.
- Require `Idempotency-Key` for async create; quotes reserve nothing.
- Return provider-independent problem+json with stable Manypost codes.
- Never return wholesale cost, provider/model/endpoint, raw callback body,
  encrypted content, signed staging URL or internal topology.
- Members see only their generations; admin/owner may see the organization.
- Persisted GET is authoritative after missed realtime.
- Generation alone never changes Composer draft/media or schedules/publishes.
- Use the generated OpenAPI client in web code.
- Do not edit `apps/web/openapi.json` or `schema.d.ts` manually.

---

## Planned file structure

| Path | Change |
| --- | --- |
| `apps/api/src/http/routes/ai-media.routes.ts` | Create authenticated capability/quote/generation routes |
| `apps/api/src/http/routes/ai-media.routes.test.ts` | Create API, tenant and problem tests |
| `apps/api/src/http/routes/ai-media-callback.routes.ts` | Create selected authenticated callback adapters |
| `apps/api/src/http/routes/ai-media-callback.routes.test.ts` | Create signature/replay/dedupe tests |
| `apps/api/src/http/routes/events.routes.ts` | Add bounded generation event projection |
| `apps/api/src/main.ts` | Mount routes |
| `apps/api/src/container.ts` | Expose core use cases only |
| `apps/web/openapi.json` | Regenerate from local API |
| `apps/web/src/lib/api/schema.d.ts` | Regenerate from local API |
| `apps/web/src/features/ai-media/hooks.ts` | Create generated-client queries/mutations |
| `apps/web/src/features/ai-media/idempotency.ts` | Create logical-submission key tracker |
| `apps/web/src/features/ai-media/guided-media-dialog.tsx` | Create guided operation/quote/status/review flow |
| `apps/web/src/features/ai-media/guided-media-dialog.test.tsx` | Create behavioral/accessibility tests |
| `apps/web/src/features/composer/media-picker.tsx` | Integrate guided generation entry and explicit attach |
| `apps/web/src/messages/pt-BR.json` | Add product-language messages |

## Task 1: Expose capabilities and binding quotes

**Files:**

- Create: `apps/api/src/http/routes/ai-media.routes.ts`
- Create: `apps/api/src/http/routes/ai-media.routes.test.ts`
- Modify: `apps/api/src/container.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/http/openapi.ts`

**Interfaces:**

- `GET /v1/ai/media/capabilities`
- `POST /v1/ai/media/quotes`

- [ ] **Step 1: Write route tests first**

  Cover authenticated success, missing session, `ai_image` versus `ai_video`,
  active/configured/admission distinctions, disabled recipe, video readiness,
  invalid input-media ownership and unknown/non-schema provider fields.

  Quote tests assert operation/options, catalogue revision, expiry and maximum
  customer credits. Assert no generation, grant, provider spend or capacity row
  is created.

- [ ] **Step 2: Confirm red**

  Run:

  ```bash
  bun test apps/api/src/http/routes/ai-media.routes.test.ts
  ```

  Expected: routes are not mounted.

- [ ] **Step 3: Implement thin Hono adapters**

  Parse the closed public schemas from `@manypost/contracts`, obtain actor/org
  from existing auth middleware and call `container.aiMedia.capabilities` or
  `container.aiMedia.quote`. Map domain refusals through the existing
  problem+json middleware.

  The capability response distinguishes:

  ```ts
  type OperationCapability = {
    operation: AiMediaOperation;
    entitled: boolean;
    configured: boolean;
    admitted: boolean;
    reasonCode?: string;
    supportedOptions: Record<string, readonly string[] | readonly number[]>;
    expensiveConfirmationCredits: number;
  };
  ```

  It contains no provider identity or cost.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test apps/api/src/http/routes/ai-media.routes.test.ts
  bun run typecheck
  git diff --check
  git add apps/api/src/http apps/api/src/container.ts apps/api/src/main.ts
  git commit -m "feat(api): expose AI media capabilities and quotes"
  ```

## Task 2: Expose durable generation create/list/get/cancel

**Files:**

- Modify: `apps/api/src/http/routes/ai-media.routes.ts`
- Modify: `apps/api/src/http/routes/ai-media.routes.test.ts`
- Modify: `apps/api/src/container.ts`

**Interfaces:**

- `POST /v1/ai/media/generations`
- `GET /v1/ai/media/generations`
- `GET /v1/ai/media/generations/{id}`
- `POST /v1/ai/media/generations/{id}/cancel`

- [ ] **Step 1: Write create/idempotency tests**

  Assert missing/blank/oversized `Idempotency-Key` fails before mutation.
  Identical replay returns the original generation. Changed canonical body
  conflicts. Quote increase above accepted maximum creates nothing. Commit
  happens before enqueue and an enqueue error still leaves a recoverable queued
  generation.

- [ ] **Step 2: Write authorization and response tests**

  Cover member-own, member-other, admin/owner same-org and cross-tenant
  list/get/cancel. List omits all decrypted input. Detail returns retained input
  only to creator/admin/owner and returns an explicit purged indicator after
  expiry. Output appears only after durable success.

- [ ] **Step 3: Write cancellation tests**

  Assert cancellation is a versioned command, not queue deletion. Repeated
  cancel is idempotent. `cancellation_requested` and
  `submission_uncertain` remain non-terminal and do not claim refund.

- [ ] **Step 4: Confirm red**

  Run:

  ```bash
  bun test apps/api/src/http/routes/ai-media.routes.test.ts
  ```

  Expected: generation endpoints are missing.

- [ ] **Step 5: Implement handlers**

  Pass only actor, parsed product input and idempotency key to core. After
  successful creation commit, enqueue:

  ```ts
  await scheduler.enqueue(
    AI_MEDIA_SUBMIT_QUEUE,
    {
      generationId: generation.id,
      jobVersion: generation.stateVersion,
    },
    {
      singletonKey: `${generation.id}:${generation.stateVersion}`,
      retryLimit: 0,
    },
  );
  ```

  If enqueue fails, log bounded generation/version metadata and return the
  persisted resource; the recovery scanner owns dispatch.

- [ ] **Step 6: Verify and commit**

  Run:

  ```bash
  bun test apps/api/src/http/routes/ai-media.routes.test.ts
  bun run typecheck
  git diff --check
  git add apps/api/src
  git commit -m "feat(api): expose durable AI media generations"
  ```

## Task 3: Mount only authenticated provider callbacks

**Files:**

- Create: `apps/api/src/http/routes/ai-media-callback.routes.ts`
- Create: `apps/api/src/http/routes/ai-media-callback.routes.test.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/container.ts`
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/src/env.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Callback routes exist only for selected adapters with reviewed authenticated
  callback contracts.
- Valid events enqueue reconciliation; invalid events cause no state change.

- [ ] **Step 1: Write signature and replay tests**

  For every selected callback contract, use its provider-specific addendum to
  test signature over exact raw bytes, bounded timestamp skew, replay event ID,
  wrong secret, mutated body, missing header, duplicate delivery and early
  client-token mapping.

- [ ] **Step 2: Write redaction/no-op tests**

  Prove raw request bytes, query secrets and provider body never enter
  database/log/problem data. Invalid callbacks do not create event rows or jobs.
  Valid unmatched callbacks persist bounded sanitized evidence only.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test apps/api/src/http/routes/ai-media-callback.routes.test.ts
  ```

  Expected: callback registry/routes are missing. If no selected adapter has an
  authenticated callback contract, record polling-only evidence and do not
  mount a generic callback route.

- [ ] **Step 4: Implement callback adapters**

  Read raw bytes exactly once, verify before parsing, derive adapter from the
  fixed route, normalize stable event/client/run identity and enqueue
  reconciliation after sanitized persistence. Never accept organization or
  generation identity as authoritative callback input.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test apps/api/src/http/routes/ai-media-callback.routes.test.ts packages/config/src/env.test.ts
  bun run typecheck
  git diff --check
  git add apps/api/src packages/config .env.example
  git commit -m "feat(api): authenticate AI media callbacks"
  ```

  Skip the commit when all selected providers are polling-only and no source
  file changed.

## Task 4: Publish bounded realtime generation updates

**Files:**

- Modify: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/ai-media.test.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.test.ts`
- Modify: `apps/api/src/http/routes/events.routes.ts`
- Create: `apps/api/src/http/routes/events.routes.test.ts`

**Interfaces:**

- SSE event type: `ai.media.generation.updated`.
- Payload contains generation ID, status, state version, optional media ID and
  stable sanitized code only.

- [ ] **Step 1: Write payload and missed-event tests**

  Prove prompt, provider, raw body, signed URL, credits ledger and unbounded
  labels are absent. Simulate SSE loss and prove `GET` returns the newer state.

- [ ] **Step 2: Confirm red**

  Run:

  ```bash
  bun test packages/contracts/src/ai-media.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts apps/api/src/http/routes/events.routes.test.ts
  ```

  Expected: generation event is not projected.

- [ ] **Step 3: Implement best-effort publication**

  Publish only after a committed state transition. Realtime failure is logged
  as bounded operational metadata and never rolls back or changes durable
  execution.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun test packages/contracts/src/ai-media.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts apps/api/src/http/routes/events.routes.test.ts
  git diff --check
  git add packages/contracts/src packages/core/src/application apps/api/src/http/routes/events.routes.ts apps/api/src/http/routes/events.routes.test.ts
  git commit -m "feat(realtime): publish AI media generation status"
  ```

## Task 5: Regenerate and review the OpenAPI client

**Files:**

- Modify (generated): `apps/web/openapi.json`
- Modify (generated): `apps/web/src/lib/api/schema.d.ts`

**Interfaces:**

- Generated types include the six authenticated AI media operations and any
  selected signed callback routes.
- Existing `/v1/ai/image` schema remains synchronous and compatible.

- [ ] **Step 1: Start the local API**

  Run in one terminal:

  ```bash
  bun run dev
  ```

  Expected: API health responds on `http://localhost:3100` using isolated local
  PostgreSQL/Redis and no paid provider invocation.

- [ ] **Step 2: Generate through the repository command**

  Run in a second terminal:

  ```bash
  API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
  ```

  Expected: both generated files change together.

- [ ] **Step 3: Review the generated diff**

  Run:

  ```bash
  git diff -- apps/web/openapi.json apps/web/src/lib/api/schema.d.ts
  rg -n 'providerCost|signedUrl|rawBody|endpoint|submission_uncertain' apps/web/openapi.json apps/web/src/lib/api/schema.d.ts
  ```

  Expected: `submission_uncertain` exists; forbidden internal fields do not.
  Provider callback path names may exist, but their secrets/bodies are not
  exposed to the authenticated web feature.

- [ ] **Step 4: Verify and commit**

  Run:

  ```bash
  bun run typecheck:web
  git diff --check
  git add apps/web/openapi.json apps/web/src/lib/api/schema.d.ts
  git commit -m "chore(openapi): generate AI media client contracts"
  ```

## Task 6: Build generated-client hooks and logical idempotency

**Files:**

- Create: `apps/web/src/features/ai-media/hooks.ts`
- Create: `apps/web/src/features/ai-media/hooks.test.ts`
- Create: `apps/web/src/features/ai-media/idempotency.ts`
- Create: `apps/web/src/features/ai-media/idempotency.test.ts`

**Interfaces:**

- Hooks call capabilities, quote, create, list/get and cancel only through
  `@/lib/api/client`.
- One key persists across transport retry for one confirmed canonical request.
- Input/option/source change or deliberate variant creates a new key.

- [ ] **Step 1: Write idempotency tracker tests**

  Use this public interface:

  ```ts
  export interface LogicalSubmissionTracker {
    keyForConfirmed(fingerprint: string): string;
    beginAnotherVariant(fingerprint: string): string;
    clearAfterTerminal(generationId: string): void;
  }
  ```

  Prove repeated click/timeout uses one key, a new confirmation after changed
  prompt/source/aspect/quality/duration uses a new key, and “generate another”
  deliberately rotates the key even with unchanged input.

- [ ] **Step 2: Write hook tests**

  Assert quote reserves nothing, create sends `Idempotency-Key` plus accepted
  maximum credits, GET polling resumes after SSE loss and cancel never assumes
  terminal cancellation from command acceptance.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test apps/web/src/features/ai-media/idempotency.test.ts apps/web/src/features/ai-media/hooks.test.ts
  ```

  Expected: modules are missing.

- [ ] **Step 4: Implement hooks**

  Use generated path/body/response types without parallel handwritten API DTOs.
  TanStack Query keys include generation ID; status invalidation follows
  realtime but retains bounded polling while non-terminal.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test apps/web/src/features/ai-media/idempotency.test.ts apps/web/src/features/ai-media/hooks.test.ts
  bun run typecheck:web
  git diff --check
  git add apps/web/src/features/ai-media
  git commit -m "feat(web): add AI media generation client state"
  ```

## Task 7: Build the guided, resumable and accessible Composer flow

**Files:**

- Create: `apps/web/src/features/ai-media/guided-media-dialog.tsx`
- Create: `apps/web/src/features/ai-media/guided-media-dialog.test.tsx`
- Create: `apps/web/src/features/ai-media/generation-status.ts`
- Create: `apps/web/src/features/ai-media/generation-status.test.ts`
- Modify: `apps/web/src/features/composer/media-picker.tsx`
- Modify: `apps/web/src/features/composer/composer-editor-card.tsx`
- Modify: `apps/web/src/features/composer/store.ts`
- Modify: `apps/web/src/features/ai/ai-actions.test.tsx`
- Modify: `apps/web/src/messages/pt-BR.json`

**Interfaces:**

- Capability-driven four-operation UI with only advertised product options.
- Quote/expensive confirmation precedes creation.
- Persisted generation history resumes independently of the draft.
- Successful output attaches only after explicit review/action.

- [ ] **Step 1: Write capability/rendering tests**

  Cover image-ready/video-absent, video plan lock, temporary capacity,
  permanent unavailability and absence of provider-native advanced controls.
  Reject displaying provider/model/endpoint/wholesale price even if a malformed
  fixture includes them.

- [ ] **Step 2: Write quote and submission tests**

  Cover displayed maximum credits, expensive-operation confirmation, quote
  increase/reconfirmation, quote expiry, duplicate activation suppression and
  deliberate separately charged variant.

- [ ] **Step 3: Write state/recovery tests**

  Map:

  ```ts
  export type GenerationPresentation =
    | { kind: 'waiting'; cancellable: boolean }
    | { kind: 'reconciling'; cancellable: false }
    | { kind: 'cancellation_pending'; cancellable: false }
    | { kind: 'processing'; cancellable: boolean }
    | { kind: 'ready'; mediaId: string }
    | { kind: 'failed'; code: string }
    | { kind: 'canceled'; creditsReleased: boolean };
  ```

  Prove provider completion during ingestion is still processing, SSE loss uses
  GET, navigation/close preserves server generation identity, uncertainty
  disables blind retry, and cancellation does not promise refund early.

- [ ] **Step 4: Write explicit attach tests**

  Successful generation leaves `composer.mediaIds` unchanged. Review shows one
  primary preview and editable alt text. “Attach” uses the existing media path,
  applies once to the same draft/target and asks for confirmation if the draft
  target changed.

- [ ] **Step 5: Write accessibility tests**

  Cover keyboard-only operation, accessible names, focus entering/restoring,
  `role=status`/`role=alert`, no color-only status, reduced motion, caret
  preservation in Composer and no focus theft from background updates.

- [ ] **Step 6: Confirm red**

  Run:

  ```bash
  bun test apps/web/src/features/ai-media/guided-media-dialog.test.tsx apps/web/src/features/ai-media/generation-status.test.ts apps/web/src/features/ai/ai-actions.test.tsx
  ```

  Expected: guided surface and presentation mapper are missing.

- [ ] **Step 7: Implement the minimum guided flow**

  Reuse current dialog/button/media primitives and brand tokens. Keep
  generation identity in query/history state rather than Composer draft
  persistence. Attach through `toggleMedia`/existing media library after
  successful alt update.

- [ ] **Step 8: Verify focused tests and build**

  Run:

  ```bash
  bun test apps/web/src/features/ai-media/guided-media-dialog.test.tsx apps/web/src/features/ai-media/generation-status.test.ts apps/web/src/features/ai/ai-actions.test.tsx
  bun run typecheck:web
  bun run build:web
  git diff --check
  ```

  Expected: tests/typecheck/build pass with no server-package import.

- [ ] **Step 9: Manually inspect accessibility and responsiveness**

  Using the repository's documented local web flow, verify desktop/mobile,
  keyboard, screen reader announcements, light/dark, focus return, reconnect,
  uncertainty, cancellation and explicit attach. Record date/browser/results
  in traceability; do not record customer content.

- [ ] **Step 10: Commit**

  Run:

  ```bash
  git add apps/web/src/features/ai-media apps/web/src/features/composer apps/web/src/features/ai/ai-actions.test.tsx apps/web/src/messages/pt-BR.json
  git commit -m "feat(composer): add guided AI media generation"
  ```

## Task 8: Close the API/Composer phase

**Files:**

- Modify: `docs/audits/2026-07-30-ai-media-runtime-traceability.md`
- Modify: `openspec/changes/add-ai-media-generation-runtime/tasks.md`

**Interfaces:**

- Produces evidence for task groups 11 and 13.
- Leaves recipes disabled until phase 5.

- [ ] **Step 1: Run API/web negative suites**

  Run:

  ```bash
  bun test apps/api/src/http/routes/ai-media.routes.test.ts apps/api/src/http/routes/ai-media-callback.routes.test.ts apps/api/src/http/routes/events.routes.test.ts apps/web/src/features/ai-media apps/web/src/features/ai/ai-actions.test.tsx
  ```

  Expected: auth, tenant, idempotency, callback, resumability and accessibility
  tests pass. Omit the callback test path only when the selected provider
  decision is polling-only and the file does not exist.

- [ ] **Step 2: Run phase gates**

  Run:

  ```bash
  bun run check
  bun run db:check
  bun run build:web
  bun run spec:validate
  git diff --check
  ```

  Expected: all commands pass and generated files are synchronized.

- [ ] **Step 3: Record evidence and commit**

  Update traceability and only completed task 11/13 checkboxes. Run:

  ```bash
  git add docs/audits/2026-07-30-ai-media-runtime-traceability.md openspec/changes/add-ai-media-generation-runtime/tasks.md
  git commit -m "docs(ai-media): record API and Composer verification"
  ```
