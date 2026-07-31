## 1. Baseline

- [x] 1.1 Run `bun install --frozen-lockfile` and `bun run check` to record a green baseline.
- [x] 1.2 Confirm the premises before writing SQL: `post_groups.base_content` is `{ text }` as built
  in `packages/core/src/application/use-cases/publishing.ts`, and no `q` parameter exists on
  `GET /v1/publications`.

## 2. Search read, test-first

- [x] 2.1 Add `apps/api/src/http/routes/search.routes.test.ts` in the shape of
  `insights.routes.test.ts`, asserting refusal without a session, refusal of a one-character query,
  refusal of a requested result count above the cap, that the organization comes from the principal
  and never from the request, and that the payload carries no credential or personal data. Confirm it
  fails because the route does not exist.
- [x] 2.2 Declare `searchGroups` in `packages/core/src/application/ports/publishing.ts` and implement
  it in `packages/db/src/repositories/publishing.repo.ts` with an organization predicate, the
  soft-delete exclusion, the mandatory 180-day window, `order by publish_at desc nulls first`, a
  bound result limit and a parameterized query value.
- [x] 2.3 Add `apps/api/src/http/routes/search.routes.ts`, wire it in `apps/api/src/container.ts`
  following the existing `feed` wiring, mount it in `apps/api/src/main.ts`, and run the focused test
  to green.
- [x] 2.4 Regenerate `apps/web/src/lib/api/schema.d.ts` with the API running
  (`bun run dev`, then `bun run --cwd apps/web generate:api`).
- [x] 2.5 Run `bun run check` and `bun run db:check`.

## 3. Pure matching and keyboard rules, test-first

- [x] 3.1 Add `apps/web/src/features/search/ranking.test.ts` covering diacritic- and
  case-insensitive normalization, prefix outranking substring outranking subsequence, ties broken by
  kind precedence and then stable order, the result limit, and no match returning nothing. Confirm it
  fails.
- [x] 3.2 Implement `apps/web/src/features/search/ranking.ts` with `normalizar`, `pontuar` and
  `ordenar` and run the focused test to green.
- [x] 3.3 Add `apps/web/src/features/search/palette-keys.test.ts` asserting that the shortcut opens
  on meta or control with `K`, refuses while focus is in an input, textarea or editable region,
  refuses auto-repeat, and that selection movement wraps at both ends; then implement
  `palette-keys.ts` and run it to green.
- [x] 3.4 Add `apps/web/src/features/search/catalog.ts` listing application screens and primary
  actions as data, plus `catalog.test.ts` asserting via `Bun.Glob` that every catalog destination has
  a matching route file under `apps/web/src/app/(app)`.

## 4. Palette

- [x] 4.1 Add the `palette` size variant to `apps/web/src/components/ui/dialog.tsx`, anchored near the
  top of the viewport, with no shadow and the established radius scale.
- [x] 4.2 Add `use-command-palette.ts` and `hooks.ts` with the post search debounced at 250 ms and
  disabled below the minimum query length.
- [x] 4.3 Add `command-palette.tsx` rendering screens, actions and channels from data already held
  and posts in their own section, with arrow navigation across sections, an explicit no-match state,
  and section-level loading and failure that leave the other sections choosable.
- [x] 4.4 Mount the palette in `apps/web/src/app/(app)/layout.tsx` alongside the composer modal and
  add the visible trigger in `apps/web/src/components/shell/topbar.tsx` stating the shortcut.
- [x] 4.5 Add the new translation keys to `apps/web/src/messages/pt-BR.json`.

## 5. Validation

- [x] 5.1 Run `bun test apps/web/src/features/search apps/api/src/http/routes/search.routes.test.ts`,
  `bun run check`, `bun run build:web`, `bun run db:check` and `bun run spec:validate`.
- [x] 5.2 Add `scripts/e2e-search.ts` and run it against a disposable stack. It caught a real
  defect the route tests could not: the raw `ilike` did not fold diacritics, so "lancamento" failed
  to find "Lançamento" while the palette already folded them for screens and channels. Fixed with a
  portable `translate` on both sides — not the `unaccent` extension, for the same reason `pg_trgm`
  was refused.
- [ ] 5.3 Verify in a browser at 1440×900 and 375×812: the shortcut opens the palette, it does not
  fire while typing in the composer, arrow navigation wraps, dismissing returns focus, a forced
  search failure leaves screens and actions usable, and no result is shown for media.

## 6. Documentation and delivery

- [x] 6.1 Update `CHANGELOG.md`, `docs/principal/STATUS.md` and the top of
  `docs/principal/CHANGELOG_ONDAS.md` with the palette, the new read, the deliberate absence of a
  trigram index and the rollback.
- [ ] 6.2 Review the full diff for generated files, secrets and product identity, then archive
  `add-global-command-palette` only once every requirement above is satisfied.
