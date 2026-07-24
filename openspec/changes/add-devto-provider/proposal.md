## Why

Every network delivered so far publishes short-form posts, and the four most recent ones (the Meta
family) are blocked from production by an external approval process that does not depend on this
repository. Dev.to is the opposite case: it authenticates with a personal API key that the user
copies from their own account settings, requires no application registration, no OAuth client, no
environment variable and no platform review. It is the cheapest remaining network in the roadmap and
the only one that is immediately usable in production by both self-hosted and managed installations.

It is also the first **article** destination. The publishing pipeline, the composer and the settings
mechanism were all built around short posts, so this change establishes how a long-form destination
fits the existing contract without widening it.

## What Changes

- Add a `devto` channel provider that connects with a personal API key through the existing
  credential-based connection path, with no OAuth and no server-side secret.
- Publish one article per publication through `POST /api/articles`, using the post body as Markdown
  and a required per-channel `title` setting.
- Treat the first attached image as the article cover, so the existing media library is the single
  source of images and no separate URL field is introduced.
- Offer the author's Dev.to organizations as a per-post destination through the existing sub-account
  mechanism, defaulting to the personal profile.
- Support the optional `canonicalUrl` and `tags` (up to four) article fields.
- Declare the provider as unable to thread, unable to carry video, and limited to a single image.
- Add the article preview, the Portuguese labels for every settings field, and the connection guide
  entry.

**Behavior change to an existing rule:** `title` is the first **required** field in any provider's
settings schema. Scheduling a Dev.to publication without a title is rejected at scheduling time with
`post.invalid_settings`, instead of failing later at publish time.

No breaking changes to existing providers or stored data.

## Capabilities

### New Capabilities

- `devto-article-publishing`: Connection by personal API key, article composition and destination
  selection, publication semantics and retry safety for Dev.to.

### Modified Capabilities

None. `openspec/specs/` contains no living capability today, so there is no existing requirement to
restate.

## Goals

- Let an operator connect a Dev.to account by pasting an API key and publish a scheduled article.
- Reject an article without a title at scheduling time, where the operator can still correct it.
- Keep the API key encrypted at rest and out of logs, settings and sub-account payloads.
- Add the network without introducing an environment variable, so it is available in every
  installation immediately after deploy.
- Establish an article destination without widening the provider contract.

## Non-goals

- No draft publishing: articles are published immediately when the scheduled time arrives. The
  scheduling is the product's, not the platform's.
- No editing or deleting an already published article through the platform API.
- No series, no organization creation, no cover image cropping.
- No analytics; Dev.to exposes article metrics, but analytics is a separate, cross-provider slice.
- No thread or comment support. Dev.to has comments, but an article thread is not a product concept
  here, so `threads` stays false rather than being emulated.
- No rich text or HTML editor work in the composer. The body is authored as plain text and sent as
  Markdown, matching the platform's own editor.

## Compatibility

Additive. No database schema, no migration, no change to the public API shape and no change to any
existing provider. The network appears in the connection catalogue for every installation after
deploy, because it declares no required secret; it therefore also disappears from the "coming soon"
list automatically, since that list is filtered by the catalogue.

The required `title` setting is scoped to this provider only. The scheduling path already validates
each channel's settings against its own schema (`packages/core/src/application/use-cases/publishing.ts:148`),
and the composer already renders required fields and array fields from the published JSON Schema, so
no shared validation or UI mechanism changes.

## Rollback

Remove the provider from the registry and redeploy the previous revision. Nothing new is persisted
beyond ordinary channel rows, so no data reversal is required. Channels already connected would
become unavailable and require reconnection to another network, so rollback after real connections
exist is user-visible.

## Impact

- `packages/providers/src/devto/` (new provider and its tests)
- `packages/providers/src/index.ts` (registry)
- `apps/web/src/features/composer/channel-settings.tsx` (sub-account field map)
- `apps/web/src/features/composer/network-preview.tsx` (article preview)
- `apps/web/messages/` (labels, hints and connection copy in Portuguese)
- `scripts/e2e-auth.ts` (catalogue assertion: available without configuration)
- `docs/principal/INTEGRATIONS_SETUP.md` (how to obtain the API key), `docs/principal/STATUS.md`,
  `docs/principal/CHANGELOG_ONDAS.md`, `CHANGELOG.md`

**Security impact:** the API key grants full publishing rights over the user's Dev.to account and is
the channel credential. It is encrypted at rest through the existing channel token path, is never
written to settings (stored as unencrypted JSON) and is never logged. A regression that placed it in
settings or in a sub-account payload would leak a publishing credential.

**Data impact:** none. No schema, migration or persistence change.

**Railway impact:** none. No new environment variable, service or volume. Unlike the Meta family,
Dev.to does not fetch media from a public URL for the article body, so this network does not depend
on the pending object-storage driver; the cover image, however, is sent as a URL and therefore does
require the media URL to be publicly reachable.

**Product identity:** the provider is a recognizable derivation of Postiz's `dev.to.provider.ts` and
carries the required `Derived from Postiz (AGPL-3.0)` attribution comment. This is category 4
(license/attribution) and must be preserved.
