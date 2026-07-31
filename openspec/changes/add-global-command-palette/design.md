# Design — Global search and command palette

## Package boundaries

The palette itself is entirely `apps/web`. The search read crosses the stack in the thinnest way the
repository already sanctions for reads of this kind:

- `packages/core/src/application/ports/publishing.ts` declares `searchGroups(orgId, q, limit)`.
- `packages/db/src/repositories/publishing.repo.ts` implements it.
- `apps/api/src/container.ts` wires the repository method straight onto the posts surface, exactly as
  `feed: repos.publishing.listPublicationsFeed` already does.
- `apps/api/src/http/routes/search.routes.ts` validates input and serializes output.

**No use case in `packages/core`.** A use case exists to hold a domain rule; there is none here.
Scoping to the organization is enforced by the repository's `where` and by the route taking the
organization from the principal, and validation is the route's job. Adding a pass-through use case
would be ceremony that makes the boundary look respected while adding nothing to enforce.

## Why a new endpoint instead of a text filter on the publication feed

Adding `q` to `GET /v1/publications` looks cheaper and is worse:

- The feed is ordered `publish_at ASC` with a keyset cursor over `(publish_at, id)`. Search results
  in schedule order are close to useless — you want the most relevant or most recent first — and
  reversing the order under `q` would break the cursor's meaning for a parameter combination.
- The feed is the shared contract of the calendar *and* the board. Giving it a second personality
  means every future change to it must reason about which mode it is in.
- The feed returns one row per publication. Search wants one row per post; deduplicating in the
  client is work the query should not have created.

`GET /v1/search` reads `post_groups` directly, so one post is one result.

## The query, and the cost we accept

```sql
select ... from post_groups
where org_id = $1
  and deleted_at is null
  and base_content->>'text' ILIKE $2          -- '%' || q || '%', parameterized
  and (publish_at is null or publish_at > now() - interval '180 days')
order by publish_at desc nulls first
limit $3
```

`base_content` was verified to be `{ text: string }` (`publishing.ts` builds it as
`{ text: first.text, ...media }`), so the JSON extraction is sound.

`nulls first` is intentional: drafts have no schedule time, and a draft is the single most likely
thing someone is searching for — it is the work that has not left yet.

**No `pg_trgm`.** A GIN trigram index is the textbook answer and is rejected here: `CREATE EXTENSION`
requires a privilege that managed PostgreSQL often withholds, so the migration would fail at deploy
time for an unknown share of self-hosted and cloud installations. Breaking everyone's migration to
speed up one screen is the wrong trade.

What bounds the cost instead: the `org_id` predicate confines the scan to one tenant's slice, the
180-day window confines it further, the minimum query length of 2 prevents a `%%` scan, and the
result cap of 10 is enforced in the schema rather than as a default a caller can exceed. This is
recorded as a known limit in the specification so it is revisited deliberately if an organization
ever outgrows it.

## Why not `cmdk`

`cmdk` is the conventional choice and was rejected for three reasons:

1. The repository's only test runner is `bun test` with no DOM. Pure functions are the *only* thing
   that can be verified here, so the ranking must be ours to test. `cmdk` supplies its own scoring,
   which we would neither control nor be able to assert on.
2. `check:brand` enforces literal class rules over the source. `cmdk`'s primitives emit their own
   markup and `data-*` attributes, so they would have to be restyled from scratch anyway — the
   dependency would buy the part we do not need and not the part we do.
3. Everything genuinely hard about a modal — focus trap, portal, escape, scroll lock, return focus —
   is already solved by `@radix-ui/react-dialog`, which is already a dependency. What remains is a
   filtered list with arrow-key navigation: roughly 150 lines.

## Ranking as data

`ranking.ts` holds three pure functions:

- `normalizar(s)` — lowercase plus `NFD` with combining marks stripped, so `conexoes` matches
  `Conexões`. Shared with the board's text filter so the two surfaces cannot disagree about what
  matches.
- `pontuar(alvo, consulta)` — exact prefix beats word-boundary prefix beats substring beats
  subsequence; no match returns nothing.
- `ordenar(itens, consulta, limite)` — score descending, ties broken by a fixed kind precedence
  (actions, screens, channels, posts) and then by stable catalog order.

Determinism is a specification requirement, not a nicety: a palette whose results reorder between
keystrokes for the same input trains people to stop trusting the first entry, which is the entry the
whole interaction depends on.

## Section-level degradation

Screens, actions and channels come from data already in memory — a static catalog and the cached
channels query — so they render on the first keystroke. Posts require a network round trip, debounced
at 250 ms and disabled below two characters.

They are therefore separate sections with separate states. A slow or failing post search shows its
failure inside its own section while everything else stays choosable. The alternative — one combined
list with one loading state — would make the palette feel slower than it is and would make a search
outage look like a broken palette.

## Keyboard contract

`palette-keys.ts` is pure and holds the parts that are easy to get wrong:

- `abrePalette(event)` — meta or control with `K`; refuses when the event target is an `input`,
  `textarea` or `contenteditable` region, and refuses auto-repeat. Without the field check, the
  shortcut would fire while someone is writing a post, which is the single most common thing anyone
  does in this product.
- `moverSelecao(tecla, indice, total)` — arrow movement across the flattened result list with
  wrap-around at both ends.

The dialog primitive supplies escape-to-close and focus return.

## Discoverability

A shortcut nobody knows about does not exist. A visible trigger in the top bar opens the same
palette and states the shortcut, which is how people learn it. This is why the specification requires
the trigger and does not treat the shortcut alone as sufficient.

## Observability and security

No new logging or metric. The organization is taken from the authenticated principal; an
organization identifier supplied by the caller is ignored rather than trusted. The query value is
passed as a bound parameter — never string-interpolated — so the `%` wrappers cannot be used to
inject. Soft-deleted groups are excluded. The response carries the post's identifier, state, schedule
time, a truncated excerpt and channel names only: no token, no credential, no personal data.

## Generated files

`apps/web/src/lib/api/schema.d.ts` is generated and MUST NOT be hand-edited. Regenerate with the API
running:

```
bun run dev                                   # API on :3100
bun run --cwd apps/web generate:api
```

## Compatibility and rollback

Nothing existing changes shape; `GET /v1/search` is purely additive and no current client calls it.
Rollback removes the palette mount, the feature directory, the top-bar trigger, the route, the port
method and its implementation, then regenerates the client. No migration and no data change is
involved.
