## 1. Baseline and regression coverage

- [x] 1.1 Run `bun install --frozen-lockfile`, inspect the PR #54 branch against
  `origin/main`, and record the current Home/calendar visual root causes.
- [x] 1.2 Add focused source/render tests for explicit white CTA foreground,
  Home reduced-motion-aware polish hooks and compact calendar size contracts.
- [x] 1.3 Run
  `bun test apps/web/src/features/home/visual-refinements.test.ts apps/web/src/features/calendar/visual-refinements.test.ts`
  and confirm each new assertion fails for the intended missing class or
  oversized value.

## 2. Web refinements

- [x] 2.1 Make `text-paper` explicit on the Home “Novo post” and desktop/mobile
  calendar “Criar post” primary actions, then run the focused tests to green.
- [x] 2.2 Add restrained Home card/grid spacing, transitions, hover feedback
  and entrance motion inside `prefers-reduced-motion: no-preference`, without
  adding content regions, then run the focused Home tests to green.
- [x] 2.3 Reduce the calendar toolbar, channel controls, day selectors,
  timeline slots, publication cards and related typography to named compact
  tokens while retaining at least 32px interactive targets, then run the
  focused calendar tests to green.

## 3. Documentation

- [x] 3.1 Add `docs/audits/2026-07-28-product-improvement-opportunities.md`
  with current, non-duplicative recommendations grouped by priority and
  annotated with user impact, effort, prerequisites and suggested delivery PR.
- [x] 3.2 Update `docs/README.md` and `CHANGELOG.md` with the refinement,
  future-improvement document, compatibility, Railway impact and rollback.

## 4. Validation and delivery

- [x] 4.1 Run the focused web tests, `bun run check`,
  `bun run db:check`, `bun run build:web`, `bun run spec:validate` and
  `git diff --check`.
- [x] 4.2 Perform desktop and mobile browser smoke checks for the compiled
  `/inicio` and `/calendario` visual contracts, including computed CTA color,
  proportions, reduced motion and overflow. The isolated authenticated stack
  was unavailable because Docker was stopped; the fallback fixture at
  1440×900 and 375×812 confirmed white CTAs, 32/36/48px proportions, no
  overflow and animation suppression without using an existing session or
  non-disposable database.
- [x] 4.3 Review the complete diff for protected/generated files, secrets,
  product identity and first-PR scope; update task evidence and archive
  `refine-home-calendar-visuals` only after every requirement is satisfied.
