## Why

YouTube is the last network in the roadmap whose provider was never written, and it is currently
blocking an external process rather than the other way round. The operator has an OAuth consent
screen configured in Google Cloud requesting `youtube.upload` and `youtube.readonly`, both sensitive
scopes, and Google requires a demonstration video showing the application using the data those
scopes grant. That video cannot be recorded, because the channel does not exist: `youtube` is listed
in `apps/web/src/features/channels/upcoming.ts` as a future network. The verification submission is
therefore stuck behind this repository, not behind Google.

It is also the first destination whose medium is **video only**. Every provider delivered so far
treats video as an optional attachment to a text post; here the video *is* the publication, the text
is its description, and the file is large enough that the whole-file-in-memory upload used by TikTok
is the wrong shape.

Finally, YouTube is the first network where the *same* uploaded file yields two different products —
a Short or an ordinary video — and the platform decides which, from the file itself. There is no API
parameter for it. That makes it the first provider that must reason about the video's own geometry,
which nothing in this repository currently knows.

## What Changes

- Add a `youtube` channel provider authenticating through Google OAuth 2.0 with `access_type=offline`
  and `prompt=consent`, so a refresh token is always issued and the channel survives token expiry.
- Request the **minimum** sensitive scope set — `youtube.upload` plus `youtube.readonly` — rather
  than the eight scopes the reference implementation requests. Every additional sensitive scope
  enlarges the Google verification the operator is currently trying to clear.
- Upload through the **resumable** protocol (`uploadType=resumable`), streaming the source bytes
  into the upload session instead of buffering the file in memory.
- Resolve the destination channel **at connection time** rather than per post. The platform binds a
  token to one channel, chosen in its own account chooser during consent, so a per-post destination
  field would offer a single option that cannot change where the video lands. Connecting a second
  channel of the same account is a second connection.
- Read the video's width, height and duration from the MP4/QuickTime container header inside the
  provider, and use them to enforce a per-post **Shorts intent**: `auto`, `short` or `video`.
- Support `title` (required), `categoryId`, `privacyStatus`, `selfDeclaredMadeForKids` (required by
  Google's own COPPA obligation), `tags` under the platform's 500-character combined cap, an optional
  custom `thumbnail`, and an optional native `publishAt`.
- Add `fetchAnalytics` and `fetchPostAnalytics`, with the analytics scope requested **only** when the
  installation opts in, so an installation can be verified for publishing alone.

**No behavior change to any existing rule.** The geometry is read inside the provider from the
bytes of the file being published and is never persisted, so neither `MediaRef`, the media pipeline
nor the provider contract changes. No breaking changes to existing providers or stored data.

## Capabilities

### New Capabilities

- `youtube-video-publishing`: OAuth connection and channel selection, video upload semantics, Shorts
  classification, publication metadata and retry safety for YouTube.

### Modified Capabilities

None. No living capability in `openspec/specs/` states a rule this change contradicts.

## Goals

- Let the operator connect a YouTube channel and publish a scheduled video, so the Google
  verification screencast can be recorded against a working flow.
- Never silently produce the wrong product: a publication marked as a Short SHALL be refused before
  upload when the file cannot become one, naming the reason.
- Keep the sensitive-scope surface as small as the feature allows, because each one is reviewed.
- Upload a large file without holding it in worker memory.
- Never repost. An upload that succeeded followed by a failed metadata step SHALL NOT be retried as
  a new upload.

## Non-goals

- No quota management or upload-budget accounting. The platform's ceiling is roughly six uploads per
  day per project and the operator is told so, but this change does not meter it.
- No playlist assignment, no end screens, no cards, no captions or subtitle tracks.
- No editing or deleting a published video through the platform API.
- No live streaming, no Community posts, no Shorts remixing.
- No comment threads. `threads` stays false; YouTube comments are not a publication concept here.
- No transcoding, no re-encoding and no aspect-ratio correction. The provider reports what the file
  is; it never rewrites it.

## Compatibility

Additive. No database schema, no migration, no change to the public API shape and no change to any
existing provider. The network appears in the connection catalogue only when
`YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET` are configured, matching every other OAuth provider, and
disappears from the "coming soon" list through the catalogue filter with no edit to that list.

Nothing outside `packages/providers/src/youtube/` changes except the registry and the environment
map, so the change is inert for every other network.

**The audit gate is not removed by this change.** Google restricts videos uploaded by unverified API
projects created after 28 July 2020 to private viewing regardless of the requested privacy status.
The provider therefore treats a video that comes back private as a success, not a failure, and the
documentation states plainly that public publishing waits on the compliance audit — the same shape
as the TikTok Direct Post audit already documented.

## Rollback

Remove the provider from the registry and redeploy the previous revision. Nothing new is persisted
beyond ordinary channel rows and the optional `MediaRef` fields, which are computed per publish and
never stored. Channels already connected would become unavailable and require reconnection, so
rollback after real connections exist is user-visible.

## Impact

- `packages/providers/src/youtube/` (new provider, MP4 header parser and their tests)
- `packages/providers/src/index.ts` (registry)
- `packages/config/src/env.ts` (`YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`, optional analytics flag)
- `apps/web/src/features/composer/network-preview.tsx` (video preview)
- `apps/web/messages/` (labels, hints and connection copy in Portuguese)
- `scripts/e2e-auth.ts` (catalogue assertions)
- `docs/principal/INTEGRATIONS_SETUP.md` §5.1, `docs/principal/STATUS.md`,
  `docs/principal/CHANGELOG_ONDAS.md`, `docs/principal/platform-gates.md`, `CHANGELOG.md`,
  `.env.example`

**Security impact:** the OAuth refresh token grants continuing upload rights over the user's channel
and is the channel credential. It is encrypted at rest through the existing channel token path and
is never logged. Google issues a refresh token only on the first consent unless `prompt=consent` is
sent, so the provider always sends it; a regression that dropped it would silently produce channels
that die at the first token expiry with no way to recover except reconnection.

**Data impact:** none. No schema, migration or persistence change. The MP4 parser reads a bounded
prefix of the file and holds no state.

**Railway impact:** none by itself. The provider streams from the media URL, so the media must be
reachable over HTTPS by the worker — the same dependency on the pending object-storage driver that
the Meta family already carries.

**Product identity:** the provider is a recognizable derivation of Postiz's `youtube.provider.ts`
and carries the required `Derived from Postiz (AGPL-3.0)` attribution comment. This is category 4
(license/attribution) and must be preserved. The derivation is partial and the divergences are
deliberate: the reference uses the `googleapis` SDK with global `process.env`, requests eight scopes
including `youtubepartner`, and buffers the upload through a streamed `videos.insert`; this provider
uses plain `fetch` against the REST endpoints with an injected context, requests two sensitive
scopes, and drives the resumable protocol directly.
