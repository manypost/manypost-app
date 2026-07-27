## 1. Aggregate read (test-first)

- [x] 1.1 Failing test in `packages/core/src/application/use-cases/insights.test.ts`: an invalid
      IANA zone is refused before any repository call
- [x] 1.2 Failing test: "today" is resolved in the declared zone, not the server's
- [x] 1.3 Failing test: the summary reports zero everywhere for an organization with no data,
      and `firstRun` describes which step is missing
- [x] 1.4 Add `summarize(orgId, window)` to `PublishingRepository` returning counts by state plus
      per-day counts for the next seven days
- [x] 1.5 Implement it in `packages/db/src/repositories/publishing.repo.ts` with aggregate SQL
      (the `count(*)::int` + `group by` idiom `refreshGroupState` already uses), filtered by
      `org_id` in every branch
- [x] 1.6 Implement `makeSummarizeInsights` in `packages/core/src/application/use-cases/insights.ts`
      — zone validation, window arithmetic by `Intl` (never a fixed offset), channel triage

## 2. HTTP surface

- [x] 2.1 `apps/api/src/http/routes/insights.routes.ts` with `GET /summary`, documented in OpenAPI
      with a real schema
- [x] 2.2 Mount it in the container and in `apps/api/src/main.ts` beside the other `/v1` groups
- [x] 2.3 Route test: 401 without a session; invalid `tz` is 400; the payload carries no text
- [x] 2.4 **Dropped on purpose, not skipped.** A 30s cache on the "is anything wrong" panel makes
      a new failure invisible for half a window and, worse, keeps a resolved failure on screen
      after the person fixed it — which teaches them not to trust the screen. Invalidating it
      properly would couple publishing, retry, approval and channel-status changes to a cache key:
      a lot of mechanism to save three indexed aggregate counts. The brake lives in the client's
      `staleTime`, where a stale read is the explicit choice of whoever is looking. Recorded in
      `insights.routes.ts`.
- [x] 2.5 Regenerate `apps/web/openapi.json` and `schema.d.ts` against a running API and confirm
      the diff is additive (no route lost)

## 3. Page header (design.md §13)

- [x] 3.1 `apps/web/src/components/ui/page-header.tsx`: title 20px/500, description ≤680px
      secondary, actions right on desktop and below on mobile
- [x] 3.2 Adopt it on `/inicio`, `/calendario`, `/kanban`, `/midia`, `/conexoes` — each with a
      description that says what the screen is for (none of them said anything before)
- [x] 3.3 Keep the topbar title (it is the mobile identity) but stop it from being the only place a
      screen names itself
- [x] 3.4 Consolidate the two `PageHeader` implementations; prove `/midia` and `/conexoes` render
      one page-level heading, and adopt the primitive on the remaining application screens
- [x] 3.5 Keep the persistent desktop topbar label visually unchanged but out of the heading
      hierarchy, so the screen's canonical `PageHeader` is its only semantic `h1`

## 4. Home

- [x] 4.1 `apps/web/src/features/home/hooks.ts` — `useInsightsSummary` with the browser zone
- [x] 4.2 `attention-block.tsx` — absent when empty; one row per condition, each linking to the
      screen that resolves it
- [x] 4.3 `today-block.tsx` — counts for today plus the next step when the day is empty. The
      per-post list (time + channels + excerpt) was **left out**: the summary endpoint carries no
      publication text on purpose, so the list would need a second request to the feed. The
      calendar is one click away and already renders exactly that.
- [x] 4.4 `usage-block.tsx` — meters for posts/channels and the AI allowance, using `--data-*`
      tokens; absent when the installation does not enforce limits
- [x] 4.5 `week-block.tsx` — next seven days per day, naming days with nothing scheduled
- [x] 4.6 `first-run-block.tsx` — ordered next steps, replacing the operational blocks
- [x] 4.7 `home-view.tsx` composing them, two columns above 1200px and one below
- [x] 4.8 `apps/web/src/app/(app)/inicio/page.tsx` with `Suspense` and skeletons
- [x] 4.9 Failing render test: a day with `failed > 0` is not empty and displays the failed count

## 5. Navigation

- [x] 5.1 `app/page.tsx` redirects to `/inicio`
- [x] 5.2 Sidebar: "Início" first, wordmark links to it
- [x] 5.3 Topbar title mapping and mobile nav gain the route

## 6. Localization and tests

- [x] 6.1 Every string in `messages/pt-BR.json` under a `home` namespace
- [x] 6.2 Test asserting every `home.*` key used by the components exists
- [x] 6.3 Pure-function tests for the blocks' decisions: which attention rows appear, meter
      percentage and its clamping, which day is empty

## 7. Verification

- [x] 7.1 `bun run check`, `bun run build:web`, `bun run spec:validate` green;
      the final superset `bun run check:ci` passed with 965 tests and 19 pages
- [x] 7.2 `scripts/e2e-insights.ts` — 23 checks against the real API and a disposable Postgres,
      with a hand-written expected scenario, including two organizations to prove the aggregate
      does not mix tenants; the real repository integration additionally proves boundary rows
      across a daylight-saving transition
- [x] 7.3 Both honesty rules asserted by rendering (`home-blocks.test.tsx`), and both mutation
      checked: removing the early return makes the "block disappears" test fail; changing a radius
      makes the scale test fail
- [x] 7.4 Browser smoke at desktop (1440×1000) and mobile (390×844): exactly one `h1`, no
      horizontal overflow, failed-today visible in the operational state, and both
      `no_channels` first-run and operational states readable
