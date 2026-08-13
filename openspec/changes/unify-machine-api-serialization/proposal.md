## Why

The API serializes the same entities in five hand-copied places, and the copies have already
diverged into a live contract inconsistency. `serializeGroup` exists three times
(`posts.routes.ts`, `public-v1.routes.ts`, `mcp-server.ts`) and the MCP copy silently omits each
publication's `media` and `attemptCount`, so an agent reading a post over MCP sees a different
publication than the same request over REST. The feed serializer exists twice and the public copy
lacks `publishedAt`, `updatedAt` and `mediaPreview`, which the internal feed gained additively for
Home v2 and the board. The media serializer exists twice and the public copy omits the `source`
provenance marker — the field the platform itself treats as a synthetic-content disclosure
requirement. The keyset cursor encode/decode is byte-identical in two files, one of them labeled
"idêntico ao /v1/publications" — a comment acknowledging duplication instead of removing it.

## What Changes

- Add one shared serialization module in `apps/api` (group, feed item, media, keyset cursor and
  the csv query helper) and make the internal REST routes, the public v1 routes and the MCP tools
  consume it.
- MCP `get_post`/`schedule_post`/`reschedule_post`/`cancel_post` responses gain the missing
  `media` and `attemptCount` fields (additive fix of the divergence).
- Public v1 feed items gain `publishedAt`, `updatedAt` and `mediaPreview`; public v1 media gains
  `source` (all additive, already present on the internal surface).
- Public v1 documentation schemas and the generated OpenAPI client are updated accordingly.
- Real-API E2E scripts assert the newly exposed fields.

## Non-goals

- No field removal, rename or semantic change on any surface.
- No cursor format change: existing cursors keep paging.
- No change to scopes, rate limits, idempotency or plan gating on the public surface.
- No new endpoint or MCP tool.

## Capabilities

### New Capabilities

- `machine-api-contract`: the machine surfaces (internal REST, public v1, MCP) serialize shared
  entities from one source, and feed pagination cursors are shared and fail safe.

## Compatibility

Purely additive. Clients that ignore unknown fields are untouched; no existing field changes type
or meaning. The MCP tools expose more of the same post the REST surface already exposed to the
same organization, under the same read scope. The public v1 additions surface data the
organization already owns.

## Rollback

Revert the commit; no migration, environment or persisted state is involved. Regenerate the
OpenAPI client after reverting.

## Impact

- **Code:** new `apps/api/src/http/serialize.ts` (+ focused test); `posts.routes.ts`,
  `publications.routes.ts`, `media.routes.ts`, `public/public-v1.routes.ts`, `mcp/mcp-server.ts`
  lose their local copies.
- **APIs:** additive fields on public v1 feed/media and MCP post payloads; regenerated
  `apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts` (via `generate:api` against a
  local API).
- **Data:** none. **Security:** none — no new data class crosses a trust boundary; provenance
  `source` is already public on the internal surface for the same principal's organization.
- **E2E:** `scripts/e2e-mcp.ts` and `scripts/e2e-public.ts` gain assertions for the new fields.
