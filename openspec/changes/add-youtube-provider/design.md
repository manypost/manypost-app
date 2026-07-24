# Design — add-youtube-provider

## Context

The reference implementation (`../_ref/postiz-app/.../youtube.provider.ts`) drives the Google
`googleapis` SDK: it constructs an `OAuth2Client` from `process.env`, calls `youtube.videos.insert`
with a Node stream as `media.body`, and lets the SDK choose the upload strategy. Three properties of
this repository make a direct port wrong.

1. **No global environment and no global fetch.** `ProviderContext` injects `fetch`, `secrets`, `now`
   and `log` (`packages/contracts/src/channel-provider.ts:111`). The SDK reads `process.env` and owns
   its own HTTP client, so it cannot be driven through the injected context, and every existing
   provider is testable precisely because it can.
2. **Scope cost is real here.** The reference requests eight scopes, four of them sensitive, plus
   `youtubepartner`, which is for content owners. Each sensitive scope is separately justified and
   separately demonstrated in Google's verification. Requesting what we do not use makes the
   operator's pending submission strictly harder.
3. **Memory.** TikTok reads the whole file into a `Uint8Array`
   (`packages/providers/src/tiktok/tiktok.provider.ts:371`), which is acceptable for a 64 MB ceiling
   and is not for YouTube.

So: plain `fetch` against the REST endpoints, two sensitive scopes, resumable upload driven by hand.

## Decisions

### Scopes: two sensitive, analytics opt-in

Requested always — and nothing else:

- `https://www.googleapis.com/auth/youtube.upload` — the upload itself. No narrower scope publishes.
- `https://www.googleapis.com/auth/youtube.readonly` — `channels.list?mine=true`, which resolves the
  connected channel's id, title and avatar. `youtube.upload` alone cannot name the destination.

`openid`, `userinfo.profile` and `userinfo.email` are **not** requested, against the reference. The
channel is the identity that matters to a publishing tool, and `channels.list` already returns it;
the Google account behind it is never displayed. Two scopes total, both sensitive, both demonstrable
in a single screencast.

Requested only when `YOUTUBE_ENABLE_ANALYTICS` is set:

- `https://www.googleapis.com/auth/yt-analytics.readonly`

Analytics was asked for, and it is implemented. But adding a third sensitive scope to a verification
submission that is currently blocking the operator would trade a feature nobody can use yet for weeks
of delay on the one they need. The gate resolves both: publish-only installations submit two
sensitive scopes now; analytics is switched on and reconnected once approved. `fetchAnalytics` throws
a readable "reconnect with analytics enabled" when the stored token lacks the scope, rather than
returning a misleading empty series.

Deliberately **not** requested, against the reference: `youtube` (full read/write), `youtube.force-ssl`
(comment management, which is a non-goal), `youtubepartner` (content-owner operations we do not
perform).

### The channel is bound at connection, not chosen per post

Discovered while implementing, and it overturned the original plan. The platform's OAuth flow shows
its own account/channel chooser during consent and binds the issued token to the channel picked
there: `channels.list?mine=true` returns exactly one channel, not every channel the Google account
owns. A per-post destination field — the Facebook/Instagram sub-account pattern — would therefore
render a select with one option that cannot change where the video lands.

So `exchangeCode` resolves the channel and uses **the channel id as the connection's external
identifier**, not the Google user id. This gets the multi-channel case right for free: connecting
twice and picking a different channel each time yields two channels in the product, while
reconnecting the same one updates it in place. `listSubAccounts` is not implemented.

### Upload: resumable, streamed

Two requests.

1. `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
   with the metadata as a JSON body and `X-Upload-Content-Length` / `X-Upload-Content-Type` naming
   the file. The response's `Location` header is the session URL.
2. `PUT <session URL>` with the source response's `body` as the request body.

The second request passes the `ReadableStream` from `ctx.fetch(mediaUrl)` straight through, so the
file is never fully resident. This requires `duplex: 'half'` and a known `Content-Length`, which is
why a source that declares no `content-length` is refused up front rather than buffered to discover
its size — buffering to learn the length would defeat the streaming.

Chunked resumption after a network drop is **not** implemented. The single PUT either completes or
fails, and a failure before the platform accepted the video is classified transient so the state
machine retries the publication from the start. Resuming a half-uploaded session would mean
persisting the session URL across attempts, which is a state-machine change, not a provider change.

### Shorts: measured, never assumed

There is no API parameter for Shorts. The platform classifies from geometry and duration, so the
only honest options are to measure or to stay silent. We measure.

`parseVideoGeometry(head: Uint8Array)` walks the ISO base media file format box tree — the container
behind both `video/mp4` and `video/quicktime` — reading `moov/mvhd` for the timescale and duration
and `moov/trak/tkhd` for the visual track's width, height and rotation matrix. It is roughly the
shape of the existing `sniff.ts`: no dependency, header formats stable for decades, bounded read.

Two details that are easy to get wrong and are covered by tests:

- **Rotation.** A phone-shot vertical video is frequently stored as 1920×1080 with a 90° rotation
  matrix in `tkhd`. Reading the raw dimensions alone would classify it as landscape and refuse a
  legitimate Short. The parser applies the matrix and swaps the axes when the rotation is 90° or 270°.
- **`mvhd` version.** Version 1 stores 64-bit creation time and duration; version 0 stores 32-bit.
  Reading a version-1 box with version-0 offsets yields a duration off by orders of magnitude.

The parser reads only the prefix needed to find `moov`. When `moov` sits at the end of the file — a
non-faststart export — the prefix will not contain it. That is why an unparseable container is not
fatal under intent `auto`: the platform's own classification is authoritative, and refusing a
publication because we could not measure it would be worse than the outcome we are guarding against.
Under intent `short` or `video` it *is* fatal, because the operator asked for a guarantee we cannot
give.

`webm` is accepted for upload but never measured; its container is not ISO BMFF. Same rule applies:
fine under `auto`, refused under an explicit intent.

Thresholds: vertical means `height >= width` (the platform accepts square), and the duration ceiling
is 180 seconds. Both are constants, because the platform has moved the ceiling once already (60s →
180s) and will again.

### Metadata

`categoryId` defaults to `22` ("People & Blogs"), the platform's own default for an uncategorised
upload and valid in every region — an invalid category is a hard rejection, so a safe default matters
more than an expressive one.

`selfDeclaredMadeForKids` is sent on every upload, defaulting to `false`. It is not optional in
practice: the platform requires an explicit declaration, and this is a legal declaration under COPPA,
so it is surfaced as an explicit setting rather than buried.

Tag length follows the reference's measurement, which is correct and non-obvious: the platform caps
the *combined* length at 500 characters and charges two extra characters for any tag containing
whitespace, because it quotes such tags internally.

`publishAt` is supported. It was asked for, and it is genuinely different from the product's own
scheduler in one case: it makes the video visible at a moment the worker need not be alive for. While
it applies it forces `privacyStatus=private`, which the platform requires — sending `publishAt`
alongside a public status is rejected. A `publishAt` that has already passed by the time the upload
runs is dropped with a log rather than failing the publication: the operator's intent was "release at
that moment", and that moment is now.

### Post-upload steps are best-effort

`thumbnails.set` runs after the video exists. If it throws, the video is already on the channel, and
throwing would return the publication to the state machine and cause a second upload. This is the
same rule the Meta providers already follow for permalink resolution, and it is stated in the spec
rather than left as a comment, because it is the difference between a failed thumbnail and a
duplicate video.

### Rate defaults

`maxConcurrent: 1`. The upload quota is the binding constraint — roughly six uploads per day against
a default project allowance — so there is nothing to gain from parallelism and a real risk of
burning the day's quota on retries. The reference sets `maxConcurrentJob = 200`, which is the
opposite of what its own comment says.

## Risks

- **The prefix may miss `moov`.** Mitigated by the `auto` fallback above, and by reading a prefix
  large enough for faststart exports, which is what every consumer encoder and every upload path in
  this product produces.
- **The audit gate still applies.** Videos from an unaudited project are forced private. This change
  cannot remove that, and the spec makes the private result an explicit success so the state machine
  does not fight it. The operator's screencast can still be recorded: the flow, the consent screen
  and the resulting video are all demonstrable.
- **Streaming through `fetch` with `duplex: 'half'`** is supported by the runtime in use but is a
  narrower path than a buffered body. If the source responds without a length the publication is
  refused, which is a visible failure rather than a silent memory blowup.
