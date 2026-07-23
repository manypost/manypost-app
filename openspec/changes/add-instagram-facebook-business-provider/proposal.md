> **Process note:** this change was authored **after** the implementation landed in the working
> tree, which does not follow the required OpenSpec order (change first, then code). It is recorded
> retroactively so the delivery is reviewable; the order deviation is stated here rather than
> disguised. Reviewers should read the requirements against the existing diff.

## Why

The Meta provider family covers Threads, Instagram through Instagram Login (`instagram-standalone`)
and Facebook Pages, but not the Instagram accounts that are linked to a Facebook Page and managed
through Business Manager. Those accounts are the common configuration for brands that already
operate a Page, and they cannot connect through Instagram Login alone. Postiz ships the two
Instagram variants as separate providers, and the remaining variant reuses infrastructure this
repository already has, so the gap is closable without new credentials or new architecture.

## What Changes

- Add a `instagram` channel provider that connects through Facebook Login and publishes to an
  Instagram professional account resolved from a Facebook Page.
- Select the destination account **per post** through the existing sub-account mechanism; the stored
  setting is the Page id, and the option is labelled with the Instagram handle.
- Derive the Page access token and the Instagram user id at publish time from a single Graph
  request; never persist either value in channel or publication settings.
- Publish photo, reel (single video), carousel (2–10, mixed media) and story (single media) through
  the container → status poll → `media_publish` sequence, with thread replies as comments.
- Reuse the existing Meta application credentials: the provider maps to the same environment
  variable pair as the `facebook` provider, so no new configuration is introduced.
- Extract the shared Meta Graph helpers (request wrapper and Page discovery) used by `facebook` and
  the new provider into one module; `facebook` behavior is unchanged.
- Wire the provider into the web composer (sub-account field, settings labels, preview) and the
  connection catalogue.

No breaking changes.

## Capabilities

### New Capabilities

- `instagram-business-publishing`: Connection, destination-account selection, credential derivation,
  publication paths and retry safety for Instagram accounts reached through a Facebook Page.

### Modified Capabilities

None. `openspec/specs/` contains no living capability today, so there is no existing requirement to
restate. The `facebook` provider refactor changes no observable behavior and therefore carries no
requirement delta.

## Goals

- Let an operator publish to an Instagram account that is linked to a Page they administer, choosing
  the account per post.
- Keep the Page access token out of every persisted surface, since channel settings are stored as
  unencrypted JSON.
- Reuse the delivery-safety properties already established for the Meta family: no duplicate
  publication on retry, and no failure raised after the network has accepted the post.
- Add the provider without new environment variables or new operational steps for existing Facebook
  installations.

## Non-goals

- No analytics or insight metrics, although the corresponding scope is requested at connection time.
- No proactive token renewal; renewal stays reactive, as with the other Meta providers.
- No collaborator tagging, audio selection or trial reels.
- No App Review submission, which is an external process tracked separately.
- No media storage driver work, even though public media URLs are a production prerequisite.

## Compatibility

Additive. Existing channels, publications and stored settings are untouched, and the
`instagram-standalone` provider keeps its id, name and behavior, so accounts connected through
Instagram Login continue to work unchanged. Installations that already set the Facebook application
credentials gain the new network in the catalogue after a restart; installations without those
credentials see it as unavailable, following the existing catalogue rules. No database schema, no
migration and no public API shape change.

## Rollback

Remove the provider from the registry and the composer maps; no stored data needs reversal, because
the change persists nothing new. Channels already connected to the provider would become
unavailable and require reconnection to a different network, so rollback after real connections
exist should be treated as user-visible. Normal rollback is a redeploy of the previous revision.

## Impact

- `packages/providers/src/instagram/` (new provider and its tests)
- `packages/providers/src/shared/meta-graph.ts` (new shared module)
- `packages/providers/src/facebook/facebook.provider.ts` (uses the shared module; behavior unchanged)
- `packages/providers/src/index.ts` (registry)
- `packages/config/src/env.ts` (provider-to-secret map; reuses the existing Facebook variable pair)
- `apps/web` composer settings, network preview, connection catalogue copy and messages
- `scripts/e2e-auth.ts` (catalogue and authorization-URL checks)
- `.env.example` and the integration setup guide

**Security impact:** the provider handles an access token that grants publishing rights to a Page's
Instagram account. The design keeps that token derived-per-publish and out of settings, logs and
sub-account payloads; a regression here would leak a publishing credential into unencrypted storage.

**Data impact:** none. No schema, migration or persistence change.

**Railway impact:** none beyond deploying the new code. No new environment variable, service or
volume. The existing constraint that Meta fetches media from a public URL still applies, so media
publishing depends on public storage rather than on this change.

**Product identity:** the provider is a recognizable derivation of Postiz's `instagram.provider.ts`
and carries the required `Derived from Postiz (AGPL-3.0)` attribution comment. This is category 4
(license/attribution) and must be preserved; no category 1 rename is performed by this change.
