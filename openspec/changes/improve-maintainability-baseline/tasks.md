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

- [ ] 5.1 Collapse the Home v1/v2 split (one blocks module, no phantom `'today'` entry) keeping
  every behavioral test green.
- [ ] 5.2 Delete dead code: `SetaCta`, `textoParaAplicar` and its assertions.
- [ ] 5.3 Add the `unwrap()` helper in `apps/web/src/lib/api` and replace the repeated
  `if (error) throw error; return data` call sites.
- [ ] 5.4 Consolidate composer state files under one convention and document the store split.

## 6. Test floors

- [ ] 6.1 Add `packages/queue` tests: fail-open without Redis, semaphore slot release, `runBatch`
  rethrow semantics and idempotency TTL.
- [ ] 6.2 Add `org_id` scoping tests for the repositories that lack them (media, oauth, channels,
  platform, webhooks, billing, approvals).

## 7. Logging and component splits

- [ ] 7.1 Route the seven inline structured `console.*` sites through one logging helper per app
  boundary.
- [ ] 7.2 Split `post-detail-sheet.tsx`, `network-preview.tsx`, `calendar-grids.tsx` and
  `settings-view.tsx` into focused modules behind stable entry points, after section 1 is done.

## 8. Delivery

- [ ] 8.1 Update `CHANGELOG.md` per landed block and keep `bun run spec:validate` green.
- [ ] 8.2 Archive after the last block lands with `bun run check` green.
