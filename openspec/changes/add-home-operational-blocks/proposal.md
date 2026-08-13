## Why

The authenticated Home answers one question well — "is anything wrong?" — and stops there. It shows
aggregate counts, plan usage and a seven-day distribution, but it cannot say what publishes next,
what changed since yesterday, which unfinished work is waiting, or what the single most useful next
step is. People still have to open the calendar or the board to find out.

Three defects compound this. A failure delivered over the realtime stream never invalidates the
Home's summary, so the screen keeps showing a resolved or stale state until a twenty-second window
elapses or the window regains focus. A single failing read collapses the whole screen into one error
line, even for blocks fed by other sources. And a post whose approval link expired sits in `DRAFT`
forever with no surface anywhere in the product telling anyone that it will never publish.

## Goals

- Let the Home state what publishes next, what recently completed, and what unfinished work waits,
  using only the platform's own delivery records.
- Offer exactly one contextual next step when nothing needs attention, chosen by a deterministic,
  testable rule.
- Make each block fail, load and empty independently, so one unavailable source does not blank the
  screen.
- Make the Home reflect delivery events without a manual reload.
- Name the posts that can never publish on their own, and offer only the actions the platform can
  actually perform on them.

## Non-goals

- No performance, reach or engagement figure, and no chart presenting delivery counts as audience
  response. No metrics ingestion is added.
- No replacement for the calendar or the board; the Home remains the door, not the tool.
- No persisted Home personalization, no team or role surface, no campaign or template feature.
- No `publication_events` or `audit_log` read surface. Recent activity is derived from the existing
  publication feed and approval notifications; a per-transition history endpoint remains future work.
- No new aggregate endpoint. The Home composes independent reads.

## What Changes

- Add an upcoming-publications block listing the next scheduled posts with their local time, channel
  and state, read from the existing publication feed.
- Add a recent-activity block derived from publications that reached a terminal state, merged with
  approval notifications, ordered by when delivery actually resolved.
- Add a resumable-drafts block covering both the composer's locally persisted draft and server-side
  `DRAFT` groups with no pending approval link, stating plainly that the latter will not publish on
  their own.
- Add a single contextual next-step block that renders only when nothing needs attention, so it
  never repeats what the attention block already said.
- Add a compact pipeline block summarizing the board's columns on the Home, sharing the board's
  query so the two surfaces can never report different numbers.
- Expose `publishedAt` and `updatedAt` on the publication feed item so recent activity can order by
  when delivery resolved rather than when it was scheduled.
- Give each block its own loading, error and empty treatment, replacing the screen-wide error.
- Invalidate the Home summary on delivery and channel events from the realtime stream.

## Capabilities

### Modified Capabilities

- `home-operational-overview`: Adds upcoming publications, recent activity, resumable drafts, a
  single contextual next step, a compact pipeline summary, per-block failure isolation and realtime
  freshness to the existing operational Home.

## Compatibility

All existing routes, translations, publication state and Home data sources remain compatible. The
`GET /v1/insights/summary` contract is unchanged. The publication feed gains two optional response
fields, which is additive: existing consumers ignore them. The generated web client is regenerated
from the same OpenAPI document. No Postiz reference is changed; product-identity classification is
therefore not applicable.

## Rollback

Revert the new Home blocks, the shared feed hook, the realtime invalidation map and the two feed
fields, then regenerate the web client. No data or migration rollback is required.

## Impact

- **Code:** `apps/web/src/features/home/`, `apps/web/src/features/realtime/`,
  `apps/web/src/features/composer/store.ts`, `apps/api/src/http/routes/publications.routes.ts`,
  `packages/core/src/application/ports/publishing.ts`,
  `packages/db/src/repositories/publishing.repo.ts`.
- **Documentation:** `CHANGELOG.md`, `docs/principal/STATUS.md`,
  `docs/principal/CHANGELOG_ONDAS.md`, OpenSpec artifacts.
- **Data and APIs:** no schema or migration change. Two additive read-only fields on the publication
  feed, both already persisted. Every new read is organization-scoped through the existing
  authenticated routes.
- **Security:** no auth, authorization, cookie, CORS, upload or secret-handling change. The new
  blocks display publication text the requesting organization already owns; no credential and no
  personal data is added to any payload.
- **Dependencies:** none.
- **Railway:** no service, variable, volume, domain, build-system or deployment-topology change.
