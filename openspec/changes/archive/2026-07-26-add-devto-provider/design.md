# Design — Dev.to article provider

## Layer ownership

The change lives almost entirely in `packages/providers/src/devto/`. Dev.to needs no new port, no
new use case and no schema column, so `packages/core`, `packages/db` and `packages/queue` are
untouched. This is deliberate: the point of the provider contract is that a new destination is a
leaf, and a network that cannot be added without editing the core would signal a contract gap. The
only edits outside the provider package are the registry, the composer maps (which are provider-id
lookups, not logic) and documentation.

The web changes are presentation only. The settings form is generated from the JSON Schema the
catalogue publishes, so `title`, `tags`, `canonicalUrl` and `organizationId` need no bespoke field
component — only Portuguese labels.

## Decision 1 — `title` is a required setting, validated at scheduling

Dev.to rejects an article without a title, and an article's title is not derivable from the post
body. The alternatives were:

1. **Required in `settingsSchema`** (chosen). Scheduling calls
   `provider.settingsSchema.safeParse(settingsRaw)` per channel and raises
   `post.invalid_settings` with the failing issue when it does not pass. The operator finds out in
   the composer, before anything is queued.
2. Optional in the schema, checked at publish time. This defers a certain, fully local failure to
   the worker, where the only outcome is a `FAILED` publication the operator must diagnose after the
   scheduled moment has passed.
3. Deriving a title from the first line of the body. This silently invents content for a published
   article, and the operator cannot see what will be used.

Option 1 is the only one where the error reaches the person who can fix it while it is still
correctable.

This is a first for the codebase and it deliberately diverges from the Discord precedent recorded in
`docs/principal/STATUS.md` §3.17, where `channelId` was made **optional** on purpose. That case is
not this one: Discord has a working fallback (auto-discovering a postable channel), so a required
field there would reject publications the provider could actually deliver. Dev.to has no fallback —
without a title there is no article. The rule is therefore "required when there is no fallback", not
"never required".

The contract test-kit is compatible: `packages/providers/test-kit/contract.ts:55` asserts that
`settingsSchema.safeParse({})` does not *throw*, and `safeParse` never throws. No test-kit change is
needed, but the assertion's comment ("publicação sem settings explícitos é o caminho comum") no
longer describes every provider, so the test gains a note.

## Decision 2 — the cover image comes from attached media, not a settings field

Postiz models the cover as a `main_image` media object inside the settings DTO. Here the composer
already has a media library, a dropzone and per-item media validation, so a second image mechanism
that lives only in one provider's settings would be a parallel path with its own validation gap.

The provider therefore reads `items[0].media[0]` and sends its public URL as `article.main_image`,
and declares `images.maxCount: 1`, `videos.maxCount: 0`. `validateMedia` then rejects a second image
or any video **at scheduling time** through the shared `checkMediaRules` helper, with no
provider-specific validation logic.

Consequence to accept: the cover is sent as a URL that Dev.to fetches, so a cover only works when
the media URL is publicly reachable. This is the same constraint the Meta family has, but it applies
here only to the cover — a text-only article is unaffected. `requiresMedia` stays false.

Images inside the article body are not handled: the body is Markdown, and an operator who wants
inline images writes the Markdown for them.

## Decision 3 — organizations reuse the sub-account mechanism, with a known limitation

Dev.to lets an author publish under an organization they belong to. This is the same shape as
choosing a Discord channel or a Facebook Page, so it reuses `listSubAccounts` and the existing
`GET /v1/channels/:id/sub-accounts` route, with `organizationId` added to `SUB_ACCOUNT_FIELDS` in
the composer. No contract change.

The Forem API has no "list the organizations I belong to" endpoint. Postiz works around this by
reading the author's own articles (`GET /api/articles/me/all`), collecting the distinct organization
usernames that appear, then fetching each one. We keep that approach and accept its limitation: an
author who has never published under an organization sees an empty list.

The field is optional and defaults to the personal profile, so an empty list degrades to exactly the
common case rather than to a broken form. The limitation is recorded in the requirement so it is not
later mistaken for a bug.

## Decision 4 — no renewal, and an invalid key means reconnection

An API key does not expire and there is no refresh flow. `refreshToken` therefore throws, which
routes a `401` through `classifyError` → `refresh-token` → a channel marked `REFRESH_REQUIRED`,
prompting the operator to paste a new key. This is exactly the `discord-webhook` and LinkedIn
precedent, so no new failure path is introduced.

## Decision 5 — retry safety

`POST /api/articles` is a single non-idempotent call with no idempotency key in the platform API,
and it is the only external write in a publication. The existing state machine already guarantees
that a publication is claimed before the call and that a job of a stale version is discarded, so the
duplicate window is the same one every provider has and is the subject of the separate
`harden-publishing-idempotency` change. This change adds no new window: there is no multi-step
sequence, no cursor and no post-publish call that could throw after the article exists.

The one thing the provider must not do is throw after a successful create. The response carries both
the article id and its URL, so no follow-up request is needed to resolve either — unlike the Meta
providers, where the permalink lookup had to be made best-effort.

`maxConcurrent` is 3 and the per-channel window is conservative, matching Postiz's `maxConcurrentJob`
for this network.

## Generated files

None. The provider does not change the API surface, so `apps/web`'s OpenAPI snapshot is unaffected.
The catalogue response gains an entry at runtime, which is data, not a contract change.

## Observability

The provider logs through the injected `ctx.log` only, and never logs the key or the article body.
A failed create logs the platform's error message, which is what the operator needs to see in the
publication's `errorMessage`.
