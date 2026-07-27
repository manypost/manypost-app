# Finish AI, Home and Image Delivery Implementation Plan

> **Execution mode:** implement inline in this session. The repository rules do
> not authorize delegated agents, so each TDD slice is completed and verified
> sequentially.

**Goal:** finish the three interrupted OpenSpec changes, remove confirmed
correctness gaps, validate the full stack with disposable dependencies, inspect
the authenticated UI locally, and leave a reviewable commit/PR narrative.

**Architecture:** preserve `contracts/config → core → adapters → composition
roots`, keep browser communication on generated OpenAPI, and treat PostgreSQL as
business state while Redis remains coordination. Correctness boundaries are
explicit civil instants for insights and a validated, compensated media write
for generated images.

**Tech Stack:** Bun/TypeScript, Hono, Next.js/React, Drizzle/PostgreSQL, Redis,
Sharp, bun:test and Playwright CLI.

---

## Task 1: Reconcile specs and unblock quality gates

**Files:**

- Modify the three active changes under `openspec/changes/`
- Modify `packages/core/src/application/ports/ai-provider.ts`
- Modify the four living specs reported by `git diff --check`

1. Add the missing cross-cutting design artifacts and corrective tasks.
2. Remove leaked artifact markers and trailing blank lines.
3. Replace the provider-name check violation in the AI port comment.
4. Run `bun run spec:validate`, `bun run check:ai-providers` and
   `git diff --check`.
5. Commit as a documentation/quality-gate unit.

## Task 2: Make insights windows civil-time correct

**Files:**

- Modify `packages/core/src/application/ports/publishing.ts`
- Modify `packages/core/src/application/use-cases/insights.ts`
- Modify `packages/core/src/application/use-cases/insights.test.ts`
- Modify `packages/db/src/repositories/publishing.repo.ts`
- Modify repository/E2E tests as needed

1. Add failing tests for Lisbon's 23-hour and 25-hour days.
2. Pass explicit `dayStart`, `dayEnd` and `weekEnd`.
3. Replace fixed elapsed-time and SQL interval boundaries.
4. Add database boundary coverage and tenant assertions.
5. Run focused core/repository tests.

## Task 3: Consolidate application headers and complete today

**Files:**

- Modify/remove duplicate `apps/web/src/components/*/page-header.tsx`
- Modify application route/view files under `apps/web/src/app/(app)` and
  `apps/web/src/features`
- Modify `apps/web/src/features/home/home-blocks.tsx`
- Modify `apps/web/src/messages/pt-BR.json`
- Modify web rendering tests

1. Add failing tests for one heading per affected screen and today's failures.
2. Keep one PageHeader primitive and adopt it on remaining real app screens.
3. Render failed-today counts and include them in empty-state logic.
4. Run focused web tests and typecheck.

## Task 4: Make image capability and aspect output honest

**Files:**

- Modify `packages/config/src/env.ts` and tests/docs/env example
- Modify `packages/core/package.json` and Bun lock through `bun add`
- Modify `packages/core/src/infra/ai/chat-completions.ts` and tests
- Modify container capability tests

1. Add failing config/adapter tests proving no `AI_IMAGE_MODEL` means no image
   method.
2. Add failing tests that inspect real output dimensions for every aspect.
3. Add Sharp as a direct core dependency with Bun.
4. Implement bounded exact-ratio center crop and return actual dimensions.
5. Run focused config/adapter/capability tests.

## Task 5: Make media writes compensating and browser requests idempotent

**Files:**

- Modify media use cases and tests in `packages/core`
- Modify `apps/web/src/features/ai/hooks.ts`
- Modify `apps/web/src/features/ai/generate-image-dialog.tsx`
- Modify related web tests and `scripts/e2e-ai.ts`

1. Add failing tests for repository failure after storage write.
2. Extract/reuse a storage-to-record helper with best-effort delete.
3. Add failing hook/dialog tests for a stable `Idempotency-Key`.
4. Generate one key per logical request fingerprint and pass it as a header.
5. Extend E2E to require Redis replay and conflict behavior.

## Task 6: Validate data, runtime and UI

**Files:**

- Modify generated OpenAPI files only via `generate:api`
- Modify `CHANGELOG.md` and normative operations/data docs
- Update OpenSpec task checkboxes only after evidence exists

1. Start disposable PostgreSQL and Redis with explicit test-only names/ports.
2. Validate migration `0007` on clean and previous schemas with existing media;
   inspect generated SQL/metadata and representative aggregate `EXPLAIN`.
3. Run focused tests, E2E AI/insights, `bun run check:ci` and
   `git diff --check`.
4. Start API/web locally with test-only env, authenticate through a locally
   signed test session, and inspect desktop/mobile pages with Playwright.
5. Capture screenshots, verify the destructive rewrite scenario, generation
   dialog, one page header and responsive overflow.
6. Update docs/changelog/OpenSpec with only commands actually run.

## Task 7: Review, commits and PR handoff

1. Review the complete diff for tenant scope, secrets, generated/protected
   files, licensing and rollback.
2. Create focused Conventional Commits with one responsibility each.
3. Prepare a PR body targeting `main` with OpenSpec links, impact, migration,
   risks, test evidence, rollback and Railway notes.
4. Resolve the pre-existing coauthor/history policy before any push or PR
   creation; do not rewrite or publish history implicitly.
