## 1. Baseline

- [x] 1.1 Run `bun install --frozen-lockfile` and `bun run check` to record a green baseline.
- [x] 1.2 Record the defects with evidence: `use-realtime.ts` never invalidates `['insights']`,
  `home-view.tsx` collapses the whole screen on one failed read, the feed item carries no
  `publishedAt` or `updatedAt`, and a draft group whose approval link expired has no surface.

## 2. Realtime freshness, test-first

- [x] 2.1 Add `apps/web/src/features/realtime/invalidations.test.ts` asserting that every stream
  event maps to its query keys and that delivery and channel events include `['insights']`. Confirm
  it fails against today's behavior.
- [x] 2.2 Add `apps/web/src/features/realtime/invalidations.ts` with the pure event-to-key map, make
  `use-realtime.ts` iterate over it while keeping only toasts in the switch, and run the focused test
  to green.

## 3. Feed timestamps

- [x] 3.1 Add `publishedAt` and `updatedAt` to `PublicationFeedItem` in
  `packages/core/src/application/ports/publishing.ts`, map them in
  `packages/db/src/repositories/publishing.repo.ts`, and expose them in `FeedItemOut` and `serialize`
  in `apps/api/src/http/routes/publications.routes.ts`.
- [x] 3.2 Regenerate `apps/web/src/lib/api/schema.d.ts` with the API running
  (`bun run dev`, then `bun run --cwd apps/web generate:api`) and confirm the file is generated, not
  hand-edited.
- [x] 3.3 Run `bun run check` and `bun run db:check`.

## 4. Home rules, test-first

- [x] 4.1 Extend `apps/web/src/features/home/logic.test.ts` with the next-step priority ladder
  including that it yields nothing while the attention block is present and nothing during first run,
  `ordemDosBlocos` for wide and narrow layouts, `atividadeRecente` ordering by resolved time rather
  than scheduled time and merging approval notifications, and the local-draft summary. Confirm the
  new cases fail.
- [x] 4.2 Implement `proximaAcao`, `ordemDosBlocos`, `atividadeRecente` and `rascunhoLocalResumo` in
  `apps/web/src/features/home/logic.ts` and run the focused test to green.
- [x] 4.3 Add `updatedAt` to the composer's persisted draft in
  `apps/web/src/features/composer/store.ts`, written by content setters only and optional on read so
  an existing stored draft still loads, with a focused test.
- [x] 4.4 Add `useUpcomingPublications` and `useDraftGroups` to
  `apps/web/src/features/home/hooks.ts`, the drafts read deliberately omitting `from` because a draft
  group has no schedule time.

## 5. Home blocks

- [x] 5.1 Add the upcoming-publications block, at most five entries, each stating local time, channel
  and state, absent when nothing is scheduled ahead, and offering the calendar when more exists.
- [x] 5.2 Add the recent-activity block, at most eight entries, absent when nothing resolved.
- [x] 5.3 Add the resumable-drafts block covering the local draft and draft groups without a pending
  approval, offering only duplication or issuing an approval link and never scheduling.
- [x] 5.4 Add the contextual next-step block, rendered only when the attention block is absent and
  not during first run.
- [x] 5.5 Add the compact pipeline block reading through the board's shared query, linking each column
  to the filtered board, and reducing to counts only on a narrow viewport.
- [x] 5.6 Recompose `home-view.tsx` from `ordemDosBlocos`, give each block its own loading, error and
  empty treatment, and remove the screen-wide error in favor of per-block degradation.
- [x] 5.7 Add the new translation keys to `apps/web/src/messages/pt-BR.json`.

## 6. Coverage and validation

- [x] 6.1 Extend `apps/web/src/features/home/home-blocks.test.tsx` so each new block renders empty
  output when it has nothing to say, first run hides every new block, and no new copy names
  performance, reach or engagement.
- [x] 6.2 Run `bun test apps/web/src/features/home apps/web/src/features/realtime`,
  `bun run check`, `bun run build:web`, `bun run db:check` and `bun run spec:validate`.
- [x] 6.3 Run `bun run scripts/e2e-insights.ts` against an isolated stack to confirm the summary
  contract is unchanged, or record why the isolated stack was unavailable.
  - 2026-08-05: the command exited before data access because no disposable PostgreSQL URL was
    configured; no development or production database was used.
- [ ] 6.4 Verify in a browser at 1440×900 and 375×812: block-level loading and error, a failure
  appearing without reload after a stream event, first run hiding the new blocks, and reduced motion.

## 7. Documentation and delivery

- [x] 7.1 Update `CHANGELOG.md`, `docs/principal/STATUS.md` and the top of
  `docs/principal/CHANGELOG_ONDAS.md` with the Home's new blocks, their evidence and their rollback.
- [ ] 7.2 Review the full diff for generated files, secrets and product identity, then archive
  `add-home-operational-blocks` only once every requirement above is satisfied.

## 8. Audit follow-up — 2026-08-05

- [x] 8.1 Add RED→GREEN regression coverage and make pending/error state keep each independent block
  visible; a failed summary must not suppress upcoming, drafts, pipeline or activity.
- [x] 8.2 Remove the successful nested-card composition and render the scheduled state, local-draft
  relative edit time, notification destination and pipeline truncation disclosure.
- [x] 8.3 Make every material composer draft mutation refresh `contentUpdatedAt`, and recognize drafts
  made only of overrides, settings or thread media.
- [x] 8.4 Add a bounded 60-second polling fallback for Home reads and restore every Home control to
  the 32px minimum target.
- [x] 8.5 Repeat focused tests, full checks, build, database/schema validation, OpenSpec validation and
  diff review; update evidence without claiming unavailable browser or disposable-stack checks.
- [x] 8.6 Address independent review findings test-first: valid/compatible notification deep links,
  partial recent activity, explicit 32px list targets and a minute-updated operational clock.
- [x] 8.7 Make directly linked draft details use the group read when the dated pipeline feed does not
  contain them, so request-changes notifications open readable and editable content.
