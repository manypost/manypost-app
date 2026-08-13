# Home Operational Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** close the audited gaps in `/inicio` so every source degrades independently, every promised
field is visible, draft freshness is truthful, and the shared pipeline never implies complete counts
when its feed was truncated.

**Architecture:** keep data fetching in `home-view.tsx`, pure ordering and draft rules in `logic.ts`,
and presentation in the existing Home block files. Query state becomes explicit input to the ordering
rule, while `BlocoAssincrono` owns only pending/error shells and successful blocks keep exactly one
`Card`. No schema, migration, provider call or new server endpoint is introduced in this slice.

**Tech Stack:** Bun 1.3, TypeScript, React 19, Next.js 16 App Router, TanStack Query, Zustand,
next-intl, bun:test and OpenSpec.

## Global Constraints

- Use Bun only and do not alter `bun.lock` except through Bun.
- Follow `add-home-operational-blocks`; do not add engagement or performance claims.
- Keep every read organization-scoped through the existing authenticated API routes.
- Preserve first-run behavior: no operational block appears beside onboarding.
- Do not edit generated OpenAPI or migration files.
- Preserve at least 32px interactive targets and reduced-motion behavior.
- Write and run the failing test before each production change.

---

### Task 1: Make asynchronous block ordering explicit

**Files:**

- Modify: `apps/web/src/features/home/logic.ts`
- Modify: `apps/web/src/features/home/logic-v2.test.ts`
- Modify: `apps/web/src/features/home/home-view.tsx`
- Create: `apps/web/src/features/home/home-view-async.test.ts`

**Interfaces:**

- Consumes: `OrdemDosBlocos`, query states from TanStack Query and the existing `BlocoId` values.
- Produces: `incluirEstadosAssincronos(ordem, estados)` where each independent source is
  `'pending' | 'error' | 'empty' | 'ready'`.

- [x] **Step 1: Add failing pure-order tests** proving pending/error upcoming and pipeline slots remain
  visible, and first run still returns only `firstRun`.
- [x] **Step 2: Run** `bun test apps/web/src/features/home/logic-v2.test.ts` and confirm the new tests
  fail because `incluirEstadosAssincronos` does not exist.
- [x] **Step 3: Implement the minimal canonical ordering function** with principal order
  `attention|nextAction → today → upcoming → pipeline` and lateral order
  `drafts → week → activity → usage`.
- [x] **Step 4: Add a failing Home source contract** proving there is no screen-wide
  `resumo.isError || !ordem` branch and that upcoming, pipeline and activity each receive their own
  query state.
- [x] **Step 5: Recompose `HomeView`** so summary failure renders one retryable summary block while
  independent successful blocks continue; pending/error independent sources stay in the order.
- [x] **Step 6: Run the two focused tests and confirm green.**

### Task 2: Fulfil the visible block contracts

**Files:**

- Modify: `apps/web/src/features/home/home-blocks-v2.tsx`
- Modify: `apps/web/src/features/home/home-blocks-v2.test.tsx`
- Modify: `apps/web/src/messages/pt-BR.json`

**Interfaces:**

- Consumes: existing `FeedItem`, `RascunhoLocal`, `GroupCard` and retry callbacks.
- Produces: one-card success rendering, visible `Agendado` state, relative draft time, linked
  notification activity and a truncation disclosure for pipeline counts.

- [x] **Step 1: Add failing render tests** for exactly one upcoming title/card, visible state,
  “editado há …”, clickable notification link and the truncated-pipeline disclosure.
- [x] **Step 2: Run** `bun test apps/web/src/features/home/home-blocks-v2.test.tsx` and verify the
  assertions fail for the audited omissions.
- [x] **Step 3: Make `BlocoAssincrono` return children directly on success**, retaining `Card` only
  for pending/error.
- [x] **Step 4: Render the state label, local draft age, notification link and truncation note**, then
  add the exact pt-BR translation keys.
- [x] **Step 5: Run the focused render tests and confirm green.**

### Task 3: Make local draft freshness truthful

**Files:**

- Modify: `apps/web/src/features/composer/store.ts`
- Create: `apps/web/src/features/composer/store-draft-timestamp.test.ts`
- Modify: `apps/web/src/features/home/logic.ts`
- Modify: `apps/web/src/features/home/logic-v2.test.ts`
- Modify: `apps/web/src/features/home/home-view.tsx`

**Interfaces:**

- Consumes: complete composer content (`text`, overrides, settings, main/thread media and thread
  text) plus `contentUpdatedAt`.
- Produces: `resumoDoRascunhoLocal` that recognizes every material draft form and a timestamp touched
  by every material content setter.

- [x] **Step 1: Add failing tests** for override-only and thread-media-only drafts and for remove/
  clear/thread/settings mutations updating `contentUpdatedAt`.
- [x] **Step 2: Run both focused test files and verify RED.**
- [x] **Step 3: Extend the draft summary input** and centralize timestamp updates across material
  composer setters, excluding UI-only actions and opening the composer.
- [x] **Step 4: Pass the complete persisted draft shape from `HomeView`.**
- [x] **Step 5: Run both focused tests and confirm green.**

### Task 4: Add bounded freshness fallback and accessibility cleanup

**Files:**

- Modify: `apps/web/src/features/home/hooks.ts`
- Modify: `apps/web/src/features/home/home-blocks.tsx`
- Modify: `apps/web/src/features/home/home-blocks-v2.tsx`
- Modify: `apps/web/src/features/home/visual-refinements.test.ts`

**Interfaces:**

- Consumes: current SSE invalidation and TanStack Query observers.
- Produces: a 60-second fallback refetch for Home reads and no `h-7` interactive override inside
  Home blocks.

- [x] **Step 1: Add failing source assertions** for `refetchInterval: 60_000` on summary/upcoming/
  drafts and for absence of `h-7` in both block files.
- [x] **Step 2: Run the visual/freshness tests and verify RED.**
- [x] **Step 3: Add bounded polling** while preserving SSE invalidation and `staleTime`.
- [x] **Step 4: Restore Home controls to the existing `size="sm"` 32px contract.**
- [x] **Step 5: Run the focused tests and confirm green.**

### Task 5: Validate and close the change

**Files:**

- Modify: `openspec/changes/add-home-operational-blocks/tasks.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/principal/STATUS.md`
- Modify: `docs/principal/CHANGELOG_ONDAS.md`
- Modify: `docs/audits/2026-07-28-product-improvement-opportunities.md`

**Interfaces:**

- Consumes: the completed implementation and actual command results.
- Produces: synchronized evidence, a current backlog and an archive-ready OpenSpec change.

- [x] **Step 1: Run** `bun test apps/web/src/features/home apps/web/src/features/realtime
  apps/web/src/features/composer`.
- [x] **Step 2: Run** `bun run check`, `bun run db:check`, `bun run build:web`,
  `bun run spec:validate` and `git diff --check`.
- [x] **Step 3: Run `scripts/e2e-insights.ts` only against a confirmed disposable PostgreSQL/Redis
  stack; otherwise record the unavailable prerequisite without reading secret values.**
- [ ] **Step 4: Verify authenticated desktop/mobile loading, error, first-run, realtime and reduced
  motion states when a safe local session exists; otherwise keep the browser task open.**
- [x] **Step 5: Update docs with only observed evidence, review generated/secrets/identity, and mark
  each OpenSpec task only when its evidence exists.**

### Independent review follow-up

- [x] Replace invalid notification destinations and support historical `/posts/:groupId` links.
- [x] Keep activity from a healthy source visible when its sibling source fails.
- [x] Give compact interactive list rows an explicit 32px minimum target.
- [x] Advance relative-time and time-sensitive Home decisions once per minute.
- [x] Fall back to group-detail content for notification-linked drafts outside the Quadro feed.
- [x] Repeat the full validation suite after these review corrections.
