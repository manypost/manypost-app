## Why

The application has no home. `apps/web/src/app/page.tsx` is six lines and redirects to
`/calendario`, and the authenticated route group has no root page. The first screen of the product
is a tool, not an overview: the calendar answers "what is scheduled this week", which is a good
question but not the first one.

The first question is "is anything wrong". Today the platform knows the answer and never
volunteers it. A publication that failed overnight is a red card in the kanban, if the person
thinks to go there. A channel whose token expired is a status on a card in `/conexoes`, with no
alert anywhere else — so the usual way to discover it is a post failing to publish. `PARTIAL` (a
post that reached three of five networks) exists in the contract and no screen highlights it. The
AI allowance is only visible inside a dropdown in the composer, after selecting a channel.

The gap is not data. `GET /v1/capabilities` already returns plan tier, status, period end, and
four limit/usage pairs. The publications feed already filters by window, state and channel, and
every item already carries `errorClass`, `attemptCount` and the group's `state` and
`awaitingApproval`. `ChannelStatus` already distinguishes `REFRESH_REQUIRED` and
`PENDING_ACCOUNT_SELECTION`. What is missing is one aggregate read and a screen that assembles it.

## What Changes

- **New route `GET /v1/insights/summary?tz=<IANA>`** — counts, not documents: publications needing
  attention (failed, needs review, awaiting approval, partial), what goes out today, the next seven
  days broken down per day, and channels whose status needs a human. One query per group of counts,
  scoped by organization, with the day boundaries resolved in the caller's time zone.
- **New page `/inicio`**, and `/` redirects there instead of to `/calendario`. The calendar stays
  exactly where it is, one click away, and remains the default landing for anyone who bookmarked it.
- **Blocks that disappear when they have nothing to say.** "Needs attention" is absent when nothing
  is wrong — silence is the message (design.md §3.3), not a green "all clear" card. Plan meters are
  absent on self-hosted, where the limits are not enforced.
- **First-run state doubles as onboarding**: with no channel connected, the home is a short list of
  next steps rather than a grid of zeros.
- **New reusable `PageHeader`** implementing design.md §13 (title, description, actions right on
  desktop and below on mobile). No screen in the app has one today; the title lives in the topbar
  and no screen explains itself.
- **Sidebar gains "Início"** as the first item, and the wordmark links to it — today it links to
  the calendar, so the universal "go back to the start" gesture does not exist.

**Not included, deliberately:** any performance metric. `channel_metrics` is empty because nothing
writes to it, so every number on this home comes from our own database and is true today. Charts
and analytics wait for the ingestion wave; putting a graph here now would mean inventing data.

## Capabilities

**New Capabilities:**

- `home-operational-overview` — what the landing screen must answer, and the honesty rules about
  what it may claim.

**Modified Capabilities:** none. No existing requirement changes behavior; the new route is
additive and no other endpoint's contract moves.

## Impact

- **Code:** new `packages/core/src/application/use-cases/insights.ts`; new repository method on
  `PublishingRepository` plus its Drizzle implementation; new
  `apps/api/src/http/routes/insights.routes.ts`; new `apps/web/src/features/home/*`; new
  `apps/web/src/app/(app)/inicio/page.tsx`; edits to `app/page.tsx`,
  `components/shell/{app-sidebar,topbar}.tsx`, `messages/pt-BR.json`.
- **API:** one new route. `apps/web/openapi.json` and `schema.d.ts` regenerated.
- **Data:** **no migration.** Only reads, and only of tables that already exist.
- **Security:** the summary is organization-scoped like every other read; the aggregate must not
  become a way to count another organization's rows. Counts only — no publication text, no channel
  token, no personal data in the payload.
- **Performance:** the home is loaded on every visit, so the summary is a small number of indexed
  aggregate queries rather than a page walk over the feed. It is deliberately not cached on the
  server: a new or resolved failure must be visible immediately. The browser query's `staleTime`
  is the explicit freshness trade-off.
- **Product identity:** none. No Postiz reference touched.
- **Railway/deploy:** nothing required.

## Compatibility

Additive. The only observable change for an existing user is that `/` now lands on `/inicio`
instead of `/calendario`; every existing link, including `/calendario` itself, keeps working. No
persisted value is read differently and no contract field changes type.

## Rollback

Revert the branch. With no migration and no writes, there is nothing to undo in the database. If
only the landing needs reverting, pointing `app/page.tsx` back at `/calendario` is a one-line
change that leaves the route and the endpoint in place.
