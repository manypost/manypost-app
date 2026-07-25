## Why

The per-channel settings form renders every field from the raw JSON Schema type: `string` becomes a
text box, `enum` a select, `boolean` a switch, `array` a comma-separated text box. That mapping is
too coarse. A publish date, an image URL, a YouTube category code and a list of tags are all
`string` (or `array<string>`), so they all render as "type something here" — the user has to know
that the category is the number `22`, paste a public image URL by hand, type an ISO timestamp, and
separate tags with commas. The YouTube provider made this glaring, but it is every network's
problem: the control is chosen by the storage type, not by what the field means.

The fields do carry the information needed to do better. Zod already emits `format: "date-time"` for
`.datetime()` and `format: "uri"` for `.url()`; the renderer just ignores `format`. What JSON Schema
cannot express — "this field points at a media item", "this is a curated list of named options" — is
a small, closed set that a per-provider registry can carry, exactly as the existing
`SUB_ACCOUNT_FIELDS` map already does for sub-account selects.

## What Changes

- Render `format: "date-time"` string fields with the existing brand date/time picker, converting to
  and from the ISO value the schema stores.
- Render `array` string fields as a tag/chip input (add on Enter or comma, remove per chip) instead
  of one comma-separated text box, honouring the schema's `maxItems` and, where a field declares a
  character budget, showing it live.
- Render `format: "uri"` string fields as a URL input that validates and normalises, instead of a
  bare text box.
- Introduce a per-provider media-settings mechanism: a settings field may hold an **org media id**;
  the composer renders it with the existing media picker, and the platform resolves the id to a
  public URL before the provider publishes. The stored settings keep the id, so the publication
  stays editable.
- Turn the YouTube `categoryId` into a fixed set of the categories YouTube accepts on upload, so it
  renders as a named list; and turn the YouTube thumbnail from a pasted URL into a media-picker field
  backed by the mechanism above.
- Move the local media storage factory into `@manypost/core` so the worker can resolve media-settings
  at publish without importing from `apps/*`.

**Behavior change to an existing rule:** a provider MAY declare `mediaSettings` — settings keys whose
stored value is a media id. When present, the publish path resolves each such key to a public URL
before calling the provider. Providers that declare nothing are unaffected; the field is optional and
additive to the contract.

**Behavior change to the YouTube provider settings shape:** `thumbnailUrl` (a pasted URL) becomes
`thumbnail` (a media id), and `categoryId` goes from a free string to an enum of accepted category
ids. No YouTube channel has published yet, so no stored settings carry the old shape.

## Capabilities

### New Capabilities

- `composer-channel-settings`: how the composer chooses a control for each settings field, and how a
  settings field references org media that the platform resolves at publish time.

### Modified Capabilities

None. No living capability in `openspec/specs/` states a rule this change contradicts.

## Goals

- A user configures every settings field with a control that fits it: pick a date, pick an image from
  the library, add tags as chips, choose a category by name — never by typing a code or a URL.
- A media-settings field stays a media id at rest, so a scheduled post can be reopened and its image
  is still shown selected.
- The mechanism is declarative and reusable: a new provider adds a date, a media field or a chip
  list with no new rendering code.

## Non-goals

- No change to how the post's own media (the attachments) work.
- No rich media editing (cropping, filters) inside the picker.
- No live fetch of YouTube categories per region; the accepted set is shipped as a curated list.
- No signed-URL handling work; `MediaStorage.publicUrl` is already contractually stable, and the
  resolution is transient at publish, so nothing stale is persisted.

## Compatibility

Additive to the provider contract (`mediaSettings` is optional). The publish path gains an optional
`media`/`storage` dependency; when absent, media-settings simply are not resolved and the field is
skipped, which matches the best-effort nature of the only current use (a thumbnail). The composer
change is purely how existing fields render. The YouTube settings-shape change is safe because the
network shipped days ago and has no real publications yet; the OpenSpec `add-youtube-provider` change
is still in `changes/` (not archived), so this is a correction within the same unreleased slice.

## Rollback

Revert the branch. The stored settings for any future media field hold an id; if rolled back, that id
would render in a text box again but is still a valid string, so nothing breaks irrecoverably.

## Impact

- `packages/contracts/src/channel-provider.ts` (optional `mediaSettings`)
- `packages/core/src/infra/storage/local.storage.ts` (moved from `apps/api`), core barrel export
- `packages/core/src/application/use-cases/publishing.ts` (`PublishDeps` gains `media`/`storage`;
  resolve media-settings before `provider.publish`)
- `packages/queue/src/runtime.ts` (thread `media`/`storage` through)
- `apps/worker/src/main.ts`, `apps/api/src/container.ts` (wire `media`/`storage` into the runtime;
  api imports storage from core)
- `packages/providers/src/youtube/youtube.provider.ts` (`categoryId` enum, `thumbnail` media id,
  `mediaSettings`)
- `apps/web/src/features/composer/channel-settings.tsx` (date, media, chip, url controls + registry)
- `apps/web/src/messages/pt-BR.json` (category labels; thumbnail/rename copy)
- `scripts/e2e-auth.ts`, docs, `CHANGELOG.md`

**Security impact:** a media-settings id is resolved through the org-scoped media repository
(`findMany(orgId, ids)`), so a channel cannot reference another org's media. The resolved URL is the
same public URL the post media already uses. No new secret or token path.

**Data impact:** none. No schema or migration. Settings remain free-form JSON; the only change is that
one YouTube key now holds a media id instead of a URL.

**Product identity:** no Postiz derivation changes; the widget mechanism is original to this repo.
