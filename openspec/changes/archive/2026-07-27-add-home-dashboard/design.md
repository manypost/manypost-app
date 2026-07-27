## Context

The home summary is a tenant-scoped aggregate read spanning core, PostgreSQL,
Hono/OpenAPI and the Next.js application shell. Its date windows are civil
calendar windows in the caller's IANA time zone, so elapsed-duration arithmetic
is incorrect across daylight-saving transitions. The branch also introduced a
second `PageHeader`, leaving some routes with duplicate headings.

## Goals / Non-Goals

**Goals:**

- answer the operational questions with organization-scoped aggregate queries;
- make today and seven-day boundaries correct on 23-hour and 25-hour days;
- expose one reusable page header across every application screen;
- show all counts returned for today, including failed publications;
- validate the responsive screen in a browser.

**Non-Goals:**

- analytics or engagement charts;
- a server-side cache for operational alerts;
- changing publication state semantics.

## Decisions

1. Core computes and passes three explicit instants: `dayStart`, `dayEnd` and
   `weekEnd`, plus the IANA zone used for day grouping. The repository never
   derives a civil boundary by adding a fixed SQL interval to an instant.
2. Civil boundaries are resolved from local calendar dates with `Intl`.
   Adding `7 * 24h` was rejected because a seven-day civil window may contain
   167, 168 or 169 elapsed hours.
3. Every aggregate branch filters by `org_id`; channels are loaded through the
   organization-scoped repository. The response contains counts and channel
   identifiers, never post content or credentials.
4. The summary is not cached on the server. A just-failed or just-recovered
   publication must be visible immediately; the web query's `staleTime` is the
   only intentional freshness trade-off.
5. `apps/web/src/components/ui/page-header.tsx` is the single implementation.
   Route wrappers must not add a second header when their feature view already
   owns it, and remaining application screens adopt the same primitive.
6. OpenAPI artifacts are regenerated from the API, not edited by hand.

## Risks / Trade-offs

- [IANA rules differ by date and zone] → unit tests cover both Lisbon DST
  transitions and database E2E checks boundary rows.
- [Aggregate queries run on every home visit] → keep indexed predicates,
  inspect representative `EXPLAIN`, and avoid fetching document bodies.
- [Header consolidation changes layout] → test desktop and narrow viewports
  and assert a single page-level heading.

## Migration Plan

There is no schema migration. API and web can roll out together; the endpoint
is additive. Rollback redirects `/` to `/calendario` and removes the new route
and view without touching data.

## Open Questions

None.
