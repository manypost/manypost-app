# Design — Home operational blocks

## Package boundaries and why each layer owns its part

Almost all of this change lives in `apps/web`, and that is the correct home for it: every new block
is a *presentation* of records the platform already keeps, and none of it introduces a domain rule.
There is no new use case in `packages/core` because there is no new invariant to protect — the
priority ladder that chooses the next step is a product decision about what to say on one screen,
not a rule the API must enforce.

Two exceptions cross the boundary, both minimal:

- `packages/core/src/application/ports/publishing.ts` gains two fields on `PublicationFeedItem`.
  The port owns the shape because the port is what `packages/db` implements and what the API
  serializes; adding the field only at the route would leave the repository and the port disagreeing
  about what a feed item is.
- `packages/db/src/repositories/publishing.repo.ts` maps them. Both columns are already selected
  (`select({ pub: publications, … })`), so this is a mapping change with no query change.

## Why no aggregate endpoint

The obvious alternative is one `GET /v1/insights/home` returning everything the screen needs. It is
rejected for two reasons that outweigh the extra requests.

First, the specification requires that one unavailable source not blank the screen. A single
aggregate read has a single failure: if the pipeline query is slow or fails, the upcoming list and
the drafts list fail with it, and the screen has no way to degrade block by block. Independent reads
give that isolation for free.

Second, the pipeline summary must agree with the board. The board derives its columns in the client
from group state combined with the mix of its publications' states (`columnOf`). An aggregate
endpoint would have to reproduce that rule in SQL, and two implementations of the same rule drift.
Sharing the *client* query means the Home and the board cannot disagree, because they are literally
reading the same cached result.

The cost is that the Home issues six reads instead of three. This is mitigated by: `staleTime` on
each; the pipeline read being shared with the board, so navigating between them costs nothing; and
no `refetchInterval` on the Home, which refreshes on realtime events and window focus instead of on
a timer.

## Ordering recent activity: why `publishedAt ?? updatedAt`, and what it costs

The feed's `publishAt` is *when the post was scheduled for*, not when anything happened. A
publication scheduled for 09:00 that failed and was retried at 14:30 would sort as if it were a
09:00 event. Ordering recent activity by it produces a list that is quietly wrong exactly for the
entries people care about most.

`publications.publishedAt` is exact for delivered work. For failed and cancelled work there is no
per-outcome timestamp on the row, so `updatedAt` is used: it is the moment of the last mutation,
which for a terminal publication is the transition into that terminal state — unless a later
unrelated write touched the row.

The precise source exists: `publication_events` records every `fromState → toState` with its own
timestamp. It is deliberately not used here. Exposing it means a new port method, a new repository
query, a new route and its own specification, and the marginal gain over `updatedAt` is small for a
list of eight recent items. This is recorded as future work in the proposal's non-goals rather than
smuggled in.

## Why recent activity is not built on notifications

`notifications` looks like the natural source, and it is not: the only producer in the codebase is
the approvals use case. A `notifications`-backed activity block would be empty for any organization
that does not use approval links, which is most of them. Notifications are therefore *merged into*
the activity list — approval decisions are real activity — but they are not its spine.

## Draft groups: stating a limitation instead of hiding it

A post group enters `DRAFT` when it requires approval. If the approval link expires or is revoked,
the group stays `DRAFT` forever, and no screen in the product says so. There is also no API
operation that schedules a draft group: `PATCH /v1/posts/{groupId}` on a draft routes to
`updateDraftGroup`, which leaves the group in `DRAFT`.

The design chooses to surface the situation and be explicit about the limitation rather than to add
a scheduling operation as a side effect of a Home change. The block offers only what exists:
duplicating into the composer, or issuing a fresh approval link. The specification states the
prohibition so a later reader does not "fix" the block by inventing an endpoint under it.

A consequence for the query: draft groups have `publishAt = null`, and the feed filters with
`gte(publishAt, from)`. The drafts read therefore must not send `from`, which is why it is a separate
read rather than a slice of the pipeline read.

## Realtime invalidation as data

`use-realtime.ts` currently decides invalidation inside a `switch` that also raises toasts, and it
never invalidates `['insights']` — the defect this change fixes. Rather than adding one line to the
switch, the event-to-query-key mapping is extracted into a pure function in
`apps/web/src/features/realtime/invalidations.ts`.

This is what makes the fix testable: `bun test` has no DOM, so a hook cannot be exercised, but a pure
map can. The regression — "a delivery event invalidates the Home summary" — becomes an assertion
rather than a promise. The switch keeps only the toasts, which are presentation.

The new Home reads all use query keys prefixed `['publications', …]`, so they are already covered by
the existing publications invalidation. That is a reason to keep the prefix rather than to invent
per-block keys.

## Composer draft timestamp

The composer persists its draft under `mp-composer-draft` via zustand's `persist`, with no notion of
when it was last touched. The resumable-drafts block must say how long ago the draft was edited —
"you left something unfinished" without a time is not actionable. A single `updatedAt: number` is
added, written by the content setters only, so that opening the composer without typing does not
make a stale draft look fresh.

Migration of persisted state: the field is optional on read. An existing stored draft without it
renders without the relative time rather than failing to load.

## Observability and security

No new logging, metric or trace is introduced; the new reads travel the existing instrumented HTTP
surface. Every read is an existing authenticated route whose organization comes from the principal.
The two new feed fields are timestamps of rows the caller already receives, so no data the
organization could not already see becomes visible.

## Generated files

`apps/web/src/lib/api/schema.d.ts` is generated and MUST NOT be hand-edited. Regenerate with the API
running:

```
bun run dev                                   # API on :3100
bun run --cwd apps/web generate:api
```

## Compatibility and rollback

The feed's two new fields are additive and optional to consumers; the calendar and the board ignore
them. Reverting means removing the new Home blocks and hooks, restoring the previous
`use-realtime.ts` switch, dropping the two feed fields and regenerating the client. No migration and
no data change is involved, so rollback is a code revert.
