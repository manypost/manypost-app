## 1. Baseline

- [x] 1.1 Run `bun install --frozen-lockfile` and `bun run check` to record a green baseline (1265
  tests).
- [x] 1.2 Record the measurements this change acts on: 69 `.bevel-*` call sites, 180 raw type-scale
  uses across 35 files, 184 `font-semibold` against 27 `font-medium`, 38 `uppercase tracking-wide`,
  ~368 one-pixel borders with three levels of nesting in the settings screen.
- [x] 1.3 Confirm the `enterprise` button variant is dead (one occurrence, inside `button.tsx`) before
  removing it.

## 2. Tokens and flat surfaces

- [x] 2.1 In `apps/web/src/app/globals.css`, remove the four relief tokens, add `--line-strong` and
  `--state-failed-hover`, recalibrate `--canvas`, and map the two new colours in `@theme inline`.
- [x] 2.2 Delete every `.bevel-*` and `.inset-field` rule from `@layer components`, leaving
  `.calendar-hour-label`; rewrite the active-tab rule to a flat fill and record in a comment why it
  needs no border.
- [x] 2.3 Correct the block comment above the components layer, which already contradicted v1.3.
- [x] 2.4 Make the primitives flat: `button.tsx` (colour-transition hover, `enterprise` removed),
  `card.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `dialog.tsx`, `sheet.tsx`,
  `popover.tsx`, `dropdown-menu.tsx`, `alert-dialog.tsx`, `tooltip.tsx`, `tabs.tsx`.
- [x] 2.5 Apply `--line-strong` to portal content and to input-control boundaries.
- [x] 2.6 Update the 69 call sites, deciding each of the eight `bevel-accent` uses by role: selection
  among bordered peers keeps an accent border; state inside an unbordered list uses tint and text
  colour only.
- [x] 2.7 Invert the depth assertion in `apps/web/src/features/home/home-blocks.test.tsx` so it
  asserts the absence of relief and the presence of the flat border.
- [x] 2.8 Add `apps/web/src/components/ui/overlay-contract.test.ts` asserting that every portal
  component and every input control declares the strong border.
- [x] 2.9 Run `bun run check`.

## 3. Typography and weight

- [x] 3.1 Add the page-title and numeral steps to the scale in `globals.css` and register them in
  `apps/web/src/lib/utils.ts`; extend `apps/web/src/lib/utils.test.tsx` so the merge behaviour is
  covered.
- [x] 3.2 Migrate the 180 raw-scale uses by role, not by size, across the 35 files that mix scales,
  starting with `settings-view.tsx`, `post-detail-sheet.tsx` and `connections-view.tsx`; leave the
  editorial regime untouched and keep the provider-like typography of simulated post content in
  `network-preview.tsx` as the named, file-scoped representational exception.
- [x] 3.3 Apply the three-weight rule, making medium the label weight and reserving semibold for
  titles and active states; remove bold from product surfaces.
- [x] 3.4 Remove upper-casing from the 38 product-surface labels, beginning with `badge.tsx`, which is
  the copied origin of fourteen of them.
- [x] 3.5 Delete the decorative view-name label in `calendar-grids.tsx` rather than restyling it; it
  carries no information and is also an untranslated literal.
- [x] 3.6 Run `bun run check`.

## 4. Framing and empty states

- [x] 4.1 Apply one-level-of-border to the settings screen: the outer list keeps its border and gains
  dividers; rows, inline code and code blocks lose theirs.
- [x] 4.2 Apply it to the Home: pipeline tiles lose their border and their coloured top rule, which
  becomes a state dot.
- [x] 4.3 Apply the object exception to the board: the column becomes a stage without a border, the
  draggable card keeps its frame, and the column's coloured rule becomes a dot beside the heading.
- [x] 4.4 Restrict dashed borders to surfaces where dropping is genuinely possible; empty states lose
  their frames and keep their wording unchanged.
- [x] 4.5 Remove the three decorative icon maps on the Home and make the settings section icon
  optional; the same glyph currently stands for two unrelated sections, which shows the slot is being
  filled rather than used.
- [x] 4.6 Run `bun run check`.

## 5. Spacing, width, header and motion

- [x] 5.1 Collapse layout spacing onto the closed scale and remove the corrective negative margins in
  the settings screen by grouping the heading with its hint.
- [x] 5.2 Add the container tokens and bound the usable width once in the application shell; remove
  the per-screen widths and unify the three paragraph measures into one.
- [x] 5.3 Add `apps/web/src/components/ui/page-shell.tsx`, remove the header's own bottom margin, move
  the three route-level headers into their views, and add a test asserting no route file renders the
  page header.
- [x] 5.4 Remove the Home entrance animation, its class and the index plumbing that fed it; invert the
  two assertions in `apps/web/src/features/home/visual-refinements.test.ts`.
- [x] 5.5 Correct the one control that deviates from the standard field height and size.
- [x] 5.6 Run `bun run check` and `bun run build:web`.

## 6. Copy and documentation

- [x] 6.1 Remove decorative emoji from the seeded example content in
  `apps/web/src/messages/pt-BR.json`; leave the greeting, the empty-state wording and toast
  punctuation unchanged, per the owner's decision.
- [x] 6.2 Revise `docs/brand/BRAND_SYSTEM.md` to v1.4: rewrite the depth principle, replace the relief
  tokens with the border scale and layer contract, add the typographic and weight scales, and correct
  the two token values that had drifted from the implementation.
- [x] 6.3 Replace the depth subsection of `design.md` §51, quoting the superseded text as revoked
  rather than deleting it.
- [x] 6.4 Update `docs/brand/README.md` and the visual rules summary in `CLAUDE.md`.
- [x] 6.5 Update `CHANGELOG.md`, `docs/principal/STATUS.md` and the top of
  `docs/principal/CHANGELOG_ONDAS.md`, recording that this reverts a direction rather than fixing a
  defect.

## 7. Validation and delivery

- [x] 7.1 Run `bun run check`, `bun run db:check`, `bun run build:web` and `bun run spec:validate`.
- [ ] 7.2 Verify in a browser at 1440×900 and 375×812 across the operational screens: open a dropdown,
  select, popover, dialog and the command palette **over a white card** — this is the critical test of
  the strong border — plus a full form and a reduced-motion pass. Compare against the previous build.
- [ ] 7.3 Archive this change together with `add-home-operational-blocks`,
  `add-kanban-board-operations` and `add-global-command-palette`, whose remaining open tasks are the
  same browser verification.

## 8. Brand v1.5 contract and references

- [x] 8.1 Reconcile proposal, design and delta requirements with the approved editorial board
  reference, preserving the v1.3/v1.4 record while making v1.5 normative.
- [x] 8.2 Consolidate `design.md`: warm tokens, dark sidebar, display titles, open composition,
  responsive shell and no trailing normative override; update brand docs and changelog.
- [ ] 8.3 Generate and inspect fresh standalone references for the remaining screen archetypes before
  implementing them; never crop the approved board reference.

## 9. Feed preview, test-first

- [x] 9.1 Add failing serializer and contract tests for nullable `FeedItem.mediaPreview`, including
  first-image, video and no-media cases.
- [x] 9.2 Expose the first existing media reference through core/API, regenerate OpenAPI through the
  running API and return the focused tests to green.

## 10. Editorial shell and product surfaces

- [x] 10.1 Add failing structural tests for the 208px/64px dark desktop rail, mobile topbar/drawer,
  account/search/notification ownership and named page-title roles.
- [x] 10.2 Implement the shell, warm token scale, wide PageShell variant and responsive navigation.
- [x] 10.3 Recompose Home and Quadro from open regions, preserving every behavioral contract and
  rendering real media previews with honest fallbacks.
- [ ] 10.4 Propagate the same system through calendar, composer, media, connections, notifications,
  settings, billing, auth, onboarding, approval and OAuth surfaces.

## 11. Final validation and Coolify delivery

- [ ] 11.1 Run focused tests, `bun run check`, `bun run db:check`, `bun run build:web`,
  `bun run spec:validate`, `git diff --check` and the Docker build.
- [ ] 11.2 Verify desktop/tablet/mobile interaction and visual states with deterministic
  non-production data, including drag, filters, bulk actions, overlays, reduced motion and focus.
- [ ] 11.3 Commit on `feat/ai-image-quality-modes`, push without opening a PR, deploy the exact commit
  through Coolify without env sync, and verify the public endpoints and deployed commit.
