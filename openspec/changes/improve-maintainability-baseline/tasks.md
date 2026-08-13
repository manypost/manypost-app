## 1. Visual tests assert rendered output

- [x] 1.1 Extract the shared source-lint helpers (`sourceReader`, `stripComments`, `openingTags`)
  into `apps/web/src/test-utils/source-lint.ts` and consume them from the conformance tests.
- [x] 1.2 Move the kanban column/card markup pins into rendered assertions in
  `kanban-blocks.test.tsx`; keep only generic rules in `visual-refinements.test.ts`.
- [x] 1.3 Add rendered `calendar-grids.test.tsx` (48px rows, hour-label scale, no decorative view
  names) and drop the equivalent source pins.
- [x] 1.4 Soften the remaining exact pins (occurrence counts, exact call strings, exact quoted
  class lists) in the home conformance test.
- [x] 1.5 Run the focused web test files and `bun run check`.

## 2. Publishing runner decomposition

- [x] 2.1 Map `makeRunner`'s phases and add any missing focused test around claim/ownership,
  thread iteration and failure classification before moving code.
- [x] 2.2 Extract the phases into named units (claim/acquire, per-item delivery loop, failure
  classification and retry scheduling) with identical behavior.
- [x] 2.3 Run the publishing suite unchanged (59 tests) plus `bun run check`.

## 3. Instagram shared Graph pipeline

- [x] 3.1 Extract the duplicated container pipeline (create container → poll status → publish →
  permalink, plus the shared constants) into `packages/providers/src/shared/`.
- [x] 3.2 Consume it from `instagram` and `instagram-standalone`, keeping both providers' contract
  tests passing unchanged.

## 4. Accent folding single source

- [x] 4.1 Add the accent map as data in `packages/contracts`, consume it from the SQL translate in
  `publishing.repo.ts`, and fold `search/ranking.ts` + `kanban/logic.ts` into one client
  implementation (`apps/web/src/lib/text.ts`). The NFD strip inside `auth.ts`'s slugify stays: a
  slug is not part of the search-parity contract, and reducing it to the table would regress
  names with diacritics outside it.
- [x] 4.2 Add a parity test proving the TS folding and the SQL `translate` table agree character
  by character (`apps/web/src/lib/text.test.ts`), including uppercase folding and the onda-34
  regression case.

## 5. Web consistency

- [x] 5.1 Collapse the Home v1/v2 split: blocks renamed by content (`home-blocks-operational`),
  the phantom `'today'` entry removed from `BlocoId`/`ordemDosBlocos` (the block renders outside
  the ordering system), every behavioral test green.
- [x] 5.2 Delete dead code: `SetaCta`, `textoParaAplicar` and its assertions.
- [x] 5.3 Add the `unwrap()` helper in `apps/web/src/lib/api` and replace all 50
  `if (error) throw error` call sites (44 data reads + 6 error-only mutations).
- [x] 5.4 Document the composer's deliberate three-store lifecycle split at its entry point
  (persisted draft / ephemeral UI / global modal); merging them would reintroduce the
  hover-rerender defect that motivated the separation. Query-key factory evaluated and skipped
  (see proposal).

## 6. Test floors

- [x] 6.1 Add `packages/queue` tests: fail-open without Redis (unreachable URL), window
  all-or-nothing + denial, semaphore acquire/release/stale-reclaim, `runBatch` rethrow semantics
  (extracted from the worker closure) and idempotency claim/replay/conflict/release/TTL; the
  Redis-gated half runs in CI via `TEST_REDIS_URL` on the existing service.
- [x] 6.2 Add `org_id` scoping tests for the repositories that lacked them (media, channels,
  webhooks, notifications, approvals, billing, oauth grants) in
  `org-scoping.integration.test.ts`, Postgres-gated like the existing integration suites.

## 7. Logging and component splits

- [x] 7.1 Route the inline structured `console.*` sites through one logging helper per app
  boundary: `packages/queue/src/log.ts` (runtime + the three Redis adapters + worker boot) and
  `apps/api/src/log.ts` (migrations/boot, unhandled_error, stripe_signature_invalid). Only the
  two helpers touch `console` now.
- [ ] 7.2 Split `post-detail-sheet.tsx`, `network-preview.tsx`, `calendar-grids.tsx` and
  `settings-view.tsx` into focused modules behind stable entry points. SEQUENCED AFTER
  `propagate-flat-visual-system`: that change recomposes calendar, composer (the preview file is
  also the named file-scoped brand exception referenced by the gate) and settings — splitting
  first would mean rewriting the split twice. Section 1 (rendered assertions) already removed the
  false-failure risk the split needed.

## 8. Delivery

- [ ] 8.1 Update `CHANGELOG.md` per landed block and keep `bun run spec:validate` green.
- [ ] 8.2 Archive after the last block lands with `bun run check` green.
