## Why

A full-repository quality review (2026-08-13) found that the classic quality problems are absent —
zero `TODO`/`@ts-ignore`, zero `any` in production code, deliberate and commented fail-open catches
— but six structural debts actively slow maintenance down, and two of them fight every future
refactor:

1. Fifteen test files assert on component **source text** (exact class strings, exact call
   expressions, occurrence counts), so legitimate refactors produce false failures.
2. `makeRunner` in `packages/core/src/application/use-cases/publishing.ts` is one 397-line
   function mixing claim/fencing, concurrency, rate limits, thread iteration, failure
   classification and retry scheduling.
3. The two Instagram providers duplicate ~400 lines of the same Graph API container pipeline.
4. Accent folding exists four times (three TS implementations plus a SQL `translate` table), so
   client and server relevance can disagree.
5. The web app carries a permanent Home v1/v2 file split, three composer stores, dead code
   (`SetaCta`, `textoParaAplicar`, a phantom `'today'` block) and fifty copies of the same
   three-line API unwrap.
6. `packages/queue` has zero tests, and eight of eleven repositories have no `org_id` scoping
   test.

## What Changes

- Visual conformance tests assert **rendered output** (via `renderToStaticMarkup`) or generic
  source rules (the `cn()` hole in `check:brand`), never exact markup strings; shared source-lint
  helpers replace five hand-copied test preludes.
- `makeRunner` is decomposed into named, individually testable units with identical behavior;
  the 59 existing tests keep passing unchanged.
- The Instagram Graph container pipeline (create container → poll → publish → permalink) moves to
  `packages/providers/src/shared/`, consumed by both `instagram` and `instagram-standalone`.
- Accent folding gets one shared data table in `packages/contracts` (data, not logic) with a JS↔SQL
  parity test.
- Web consistency: the Home v1/v2 split collapses, composer state consolidates, dead code is
  deleted, an `unwrap()` helper replaces the repeated fetch boilerplate, and query keys get one
  factory per feature convention.
- Test floors: `packages/queue` gains tests for fail-open behavior, semaphore release, `runBatch`
  rethrow semantics and idempotency TTL; every repository gains an `org_id` scoping test.
- Structured logging goes through one helper instead of seven inline `console.*` sites; the four
  oversized web components (`post-detail-sheet`, `network-preview`, `calendar-grids`,
  `settings-view`) split into focused modules behind stable entry points.

## Non-goals

- No user-visible behavior change anywhere in this change. The machine-API serialization fix is
  separate (`unify-machine-api-serialization`).
- No new runtime dependency and no DOM test environment; rendered assertions keep using
  `react-dom/server`.
- No renaming of persisted identifiers, migrations or external contracts.

## Capabilities

### Modified Capabilities

- `repository-governance`: visual conformance testing rules and the organization-scoping test
  floor become explicit requirements.

## Compatibility

Behavior-preserving by definition; each block lands only with `bun run check` green and, where a
block touches publishing or providers, with the focused suites passing unchanged.

## Rollback

Each block is an independent commit; revert the offending commit. No data or environment change.

## Impact

- **Code:** `apps/web/src/**` (tests, home, composer, lib), `packages/core/src/application/use-cases/publishing.ts`,
  `packages/providers/src/{instagram,instagram-standalone,shared}/**`, `packages/contracts`,
  `packages/queue/src/**`, `packages/db/src/repositories/*.test.ts`.
- **Docs:** `CHANGELOG.md` per block.
- **Data/APIs/Security:** none.
