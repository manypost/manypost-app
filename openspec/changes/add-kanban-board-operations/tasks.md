## 1. Baseline

- [x] 1.1 Run `bun install --frozen-lockfile` and `bun run check` to record a green baseline before
  touching the board.
- [x] 1.2 Record the current defects with evidence: `kanban-view.tsx` has no test file, the feed is
  read with `limit=200` ordered ascending over a 30-day window, only one drag transition exists, and
  no `KeyboardSensor` is registered.

## 2. Pure board rules, test-first

- [x] 2.1 Add `apps/web/src/features/kanban/logic.test.ts` asserting the full `columnOf` matrix
  (`DRAFT`/`SCHEDULED`/`DONE`/`PARTIAL`/`CANCELLED` against publication mixes containing `FAILED`
  and `NEEDS_REVIEW`), grouping by `groupId`, diacritic-insensitive and multi-channel filtering,
  stable ordering, deterministic feed parameters within one day, and that `transicaoPermitida`
  refuses `awaiting → scheduled`, `draft → scheduled` and every drop on `published`. Confirm the
  file fails because the module does not exist yet.
- [x] 2.2 Add `apps/web/src/features/kanban/logic.ts` with `columnOf`, `agruparEmCards`,
  `aplicarFiltros`, `ordenarCards`, `kanbanFeedParams`, `transicaoPermitida`, `acoesDoCard` and
  `intervaloDeSelecao`, preserving today's column derivation exactly, and run
  `bun test apps/web/src/features/kanban/logic.test.ts` to green.
- [x] 2.3 Add `apps/web/src/features/kanban/bulk.test.ts` covering `planoDoLote` separating eligible
  from skipped with a stated reason, the 50-item bound being refused, and `resumoDoLote` reporting
  partial success; then add `bulk.ts` and run the focused test to green.
- [x] 2.4 Split `kanban-view.tsx` into `kanban-board.tsx`, `kanban-column.tsx`, `kanban-card.tsx`
  and `hooks.ts` with no behavior change, and run `bun run check`.

## 3. Window truthfulness

- [x] 3.1 Implement `usePipelineFeed` in `apps/web/src/features/kanban/hooks.ts` following the feed's
  existing keyset cursor up to five pages, returning whether the window was truncated, under a query
  key that the Home can share.
- [x] 3.2 Render the truncation notice with the option to narrow the window, and make each column's
  count describe what was read rather than an organization total.

## 4. Filtering, density and card structure

- [x] 4.1 Add `kanban-filters.tsx` with channel, column, text and time-window filters held in the
  screen's search parameters via `router.replace(..., { scroll: false })`, reusing `normalizar()`
  from `apps/web/src/features/search/ranking.ts` for text matching.
- [x] 4.2 Add the empty-because-filtered state offering to clear the filters, distinct from the
  empty-pipeline state.
- [x] 4.3 Add the comfortable/compact density preference persisted per browser under
  `mp-kanban-prefs`, excluded from the address.
- [x] 4.4 Restructure the card from `<button>` to `<article>` carrying an inner content button, a
  selection control and a menu trigger as siblings, so no interactive control nests inside another.

## 5. Drag and card actions

- [x] 5.1 Enable dragging from every column except published, register `KeyboardSensor` alongside
  the existing `PointerSensor`, and add `DragOverlay`.
- [x] 5.2 Add the cancel drop target that materializes only during a drag, requires confirmation and
  does not exist as a column.
- [x] 5.3 Replace the generic refusal with per-transition messages that name the reason and offer the
  operation that works: the approval link for `awaiting → scheduled`, duplication for
  `draft → scheduled`, and the card menu for publishing.
- [x] 5.4 Add the card actions menu offering only operations valid for the card's state, with
  confirmation on immediate publish and on cancel.

## 6. Bulk operations

- [x] 6.1 Add multi-selection with contiguous range selection and the bulk bar offering retry, cancel
  and clearing the selection.
- [x] 6.2 Add `useBulkAction` running the existing per-post operations with concurrency 4 under the
  50-item bound, and report succeeded and failed counts with inspectable failures.

## 7. Coverage and validation

- [x] 7.1 Add `apps/web/src/features/kanban/kanban-blocks.test.tsx` rendering statically with the
  translation provider, asserting that no interactive control nests inside another, that the menu
  trigger is labelled, that a column with no cards still states its count, and that compact density
  changes the rendered classes.
- [x] 7.2 Add `apps/web/src/features/kanban/visual-refinements.test.ts` asserting no `shadow-`, no
  transform-based hover, `cursor-pointer` on bare buttons and `motion-reduce` alongside any
  animation.
- [x] 7.3 Run `bun test apps/web/src/features/kanban`, `bun run check`, `bun run build:web` and
  `bun run spec:validate`.
- [ ] 7.4 Verify in a browser at 1440×900 and 375×812: pointer drag to retry and to cancel, keyboard
  drag, filters surviving a round trip through the address, bulk run with a deliberate partial
  failure, the truncation notice, and reduced motion.

## 8. Documentation and delivery

- [x] 8.1 Update `CHANGELOG.md`, `docs/principal/STATUS.md` and the top of
  `docs/principal/CHANGELOG_ONDAS.md` with the board's new capability, its evidence and its rollback.
- [ ] 8.2 Review the full diff for generated files, secrets and product identity, then archive
  `add-kanban-board-operations` only once every requirement above is satisfied.
