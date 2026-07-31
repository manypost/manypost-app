## Why

There is no way to search anything in the product. To reach a screen a person clicks the sidebar; to
find a post written last month there is no path at all — the calendar requires knowing the date and
the board only holds a recent window. As the number of posts and channels grows, "where did I write
that?" has no answer.

The absence is also felt as unfinished craft. Every tool people compare this product to opens a
command palette with one keystroke, and its absence reads as a product that has not been used
seriously by its own makers.

## Goals

- Let a person reach any screen or start any primary action from the keyboard, without the pointer.
- Let a person find a post by what it says, across a useful history window.
- Keep the result ordering deterministic and covered by tests rather than produced by an opaque
  scoring engine.
- Keep navigation and actions instantly available even while the post search is loading or failing.

## Non-goals

- No media search in this change. Searching the library would mean loading it in full or building a
  second search surface; both are disproportionate to the value here.
- No channel-level or settings-level search beyond the connected channels already cached.
- No full-text index, trigram extension or search infrastructure. A creating-extension migration
  fails on managed PostgreSQL without the privilege and would break every deployment.
- No saved searches, no search history, no ranking personalization.
- No text filter added to the publication feed. The feed is the calendar's and the board's contract
  and is ordered for scheduling, not relevance.

## What Changes

- Add a command palette opened by the platform shortcut and by a visible trigger in the top bar,
  listing application screens, primary actions, connected channels and matching posts.
- Add pure matching and ranking so results are ordered by an explainable rule and covered by tests,
  including diacritic-insensitive matching.
- Add `GET /v1/search`, an organization-scoped read over post group text, bounded by a mandatory
  recency window, a minimum query length and a hard result ceiling.
- Degrade section by section: a failing or slow post search leaves screens, actions and channels
  usable.

## Capabilities

### New Capabilities

- `global-search-command-palette`: Defines what the palette can find and what it deliberately
  cannot, its keyboard contract, deterministic result ordering, the organization-scoped and bounded
  search read, and its section-level degradation.

## Compatibility

All existing routes, translations and API contracts remain compatible. `GET /v1/search` is a new
read-only endpoint; nothing existing changes shape. The generated web client is regenerated from the
same OpenAPI document. No Postiz reference is changed; product-identity classification is therefore
not applicable.

## Rollback

Remove the palette mount, its feature directory, the top-bar trigger and the search route with its
port and repository method, then regenerate the web client. No data or migration rollback is
required.

## Impact

- **Code:** `apps/web/src/features/search/` (new), `apps/web/src/components/ui/dialog.tsx`,
  `apps/web/src/components/shell/topbar.tsx`, `apps/web/src/app/(app)/layout.tsx`,
  `apps/api/src/http/routes/search.routes.ts` (new), `apps/api/src/main.ts`,
  `apps/api/src/container.ts`, `packages/core/src/application/ports/publishing.ts`,
  `packages/db/src/repositories/publishing.repo.ts`.
- **Documentation:** `CHANGELOG.md`, `docs/principal/STATUS.md`,
  `docs/principal/CHANGELOG_ONDAS.md`, OpenSpec artifacts.
- **Data and APIs:** no schema or migration change. One new organization-scoped read endpoint whose
  cost is bounded by query length, a recency window and a result ceiling.
- **Security:** the search read derives its organization from the authenticated principal and never
  from the request body or query. Results carry post text the organization already owns, and no
  credential, token or personal data. The query is parameterized; no value is interpolated into SQL.
- **Dependencies:** none. The palette is built on the dialog primitive already in use.
- **Railway:** no service, variable, volume, domain, build-system or deployment-topology change.
