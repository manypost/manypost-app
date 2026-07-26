# Design — improve-settings-ux

## The widget decision, in layers

`channel-settings.tsx` currently picks a control by JSON Schema type. The fix is two layers, cheapest
first, so most fields upgrade with no per-field configuration.

**Layer 1 — driven by the schema, no registry.** Zod already emits more than the renderer reads:

- `.datetime()` → `format: "date-time"` → brand `DateTimePicker`.
- `.url()` → `format: "uri"` → URL input with inline validation.
- `z.array(z.string())` → `type: "array"` → chip input, replacing the comma-separated `ArrayField`
  for **every** provider at once (YouTube tags, Dev.to tags, Bluesky langs). `maxItems` (from
  `.max(n)`) caps the chip count.

**Layer 2 — a per-provider registry**, mirroring the existing `SUB_ACCOUNT_FIELDS` map, for what JSON
Schema cannot say:

- `FIELD_WIDGETS[provider][field] = 'media'` → media picker (YouTube thumbnail).
- `TAG_BUDGET[provider][field] = 500` → the chip input shows a live character count for YouTube's
  combined-tag limit (the whitespace surcharge from the provider is mirrored in the counter).

No custom `x-widget` is injected into the JSON Schema, because that would mean teaching
`zod-to-json-schema` to carry metadata and would leak a UI concern into the contract the catalogue
publishes. The registry keeps providers pure and follows a pattern already in the file.

### Category becomes an enum, not a new widget

The cleanest fix for "type 22" is not a new control — it is making `categoryId` a real `z.enum` of the
category ids YouTube accepts on upload. It then flows through the existing enum → `EnumField` path,
and the names come from the existing `options.<provider>.<field>.<value>` i18n path. Zero new
rendering code, and the accepted set is small and stable (People & Blogs, Music, Gaming, Education,
…). Region-specific fetches are a non-goal: `videoCategories.list` adds a network call, depends on the
channel's region, and returns categories that are not all assignable on upload.

## Media in settings: resolve at publish, store the id

The thumbnail must be a real picker, and the post must stay editable. Those two together decide the
timing:

- If the resolved **URL** were stored, reopening a scheduled post could not map it back to a library
  item to show the selection. So the stored value must remain the **media id**.
- Therefore resolution to a URL is **transient, at publish**, not persisted.

`ChannelProvider` gains `mediaSettings?: readonly string[]` — the keys whose value is an org media id.
In the publish runner, before `provider.publish`, each such key in the merged `settings` is resolved:
`deps.media.findMany(orgId, [id])` → `deps.storage.publicUrl(record.path)`, replacing the id in a
**copy** used for that call. `pub.settings` in the database is untouched, so the id survives for
editing. If media/storage are not wired, or the id is not found (including an id from another org,
since the lookup is org-scoped), the key is dropped and publishing continues — the only current use, a
thumbnail, is already best-effort and must never fail a post.

### Why storage moves into core

The runner lives in `@manypost/core` and runs in the worker. The worker cannot import
`makeLocalMediaStorage` from `apps/api` (boundary), and duplicating the `PUBLIC_URL/uploads/<key>`
join in the worker would drift from the api. `AesGcmCryptoService` already sets the precedent: shared
concrete infra lives in `@manypost/core` and the worker imports it. So `makeLocalMediaStorage` moves to
`packages/core/src/infra/storage/`, core re-exports it, and both `apps/api` and `apps/worker`
construct it from there. `publicUrl` is documented as a stable URL, so a schedule-time capture would
also have been safe against staleness — but the editability argument is what fixes the timing at
publish, independent of storage durability.

`PublishDeps.storage` is typed `Pick<MediaStorage, 'publicUrl'>`: the publish path needs only the URL,
not read/write, and the narrow type documents that.

## publishAt round-trip

`publishAt` stores an ISO instant (`z.string().datetime()`); `DateTimePicker` speaks the local
`YYYY-MM-DDTHH:mm` shape. The field adapter converts on read (`toLocalInput(new Date(iso))`) and on
write (`new Date(local).toISOString()`), and passes `min` = now so a past release time cannot be
picked. An empty value clears the field to `undefined`.

## Risks

- **Chip input replacing the comma box changes how existing array fields behave.** It is a superset:
  the same values, added one at a time instead of comma-typed. Covered by leaving the stored shape
  (array of strings) identical.
- **The YouTube settings-shape change** (`thumbnailUrl` → `thumbnail`, `categoryId` string → enum) is
  a break for any stored YouTube settings — but none exist yet, and the provider's own change is
  unarchived, so this is a correction within the same unreleased slice, not a migration.
- **Moving storage into core** touches the api import and the boundary graph; dependency-cruiser will
  confirm core still imports nothing from `apps/*`.
