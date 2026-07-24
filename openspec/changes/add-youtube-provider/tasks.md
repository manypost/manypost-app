## 1. Container parser (test-first)

- [x] 1.1 Add `packages/providers/src/youtube/mp4-geometry.test.ts` with byte fixtures, before any
      parser code exists
- [x] 1.2 Failing test: a landscape `mvhd` version 0 file yields its width, height and duration
- [x] 1.3 Failing test: an `mvhd` version 1 file (64-bit duration) is read with the right offsets
- [x] 1.4 Failing test: a 1920x1080 track with a 90-degree rotation matrix reports 1080x1920
- [x] 1.5 Failing test: a truncated prefix with no `moov` returns undefined rather than throwing
- [x] 1.6 Implement `packages/providers/src/youtube/mp4-geometry.ts` until 1.2-1.5 pass

## 2. Provider contract and behavior (test-first)

- [x] 2.1 Add `packages/providers/src/youtube/youtube.provider.test.ts` with `runProviderContract`
      from the test-kit and a mocked `ctx.fetch`
- [x] 2.2 Failing test: the authorization URL carries `access_type=offline`, `prompt=consent` and the
      two sensitive scopes, and omits the analytics scope when the flag is unset
- [x] 2.3 Failing test: a token exchange returning no refresh token is refused, and one missing
      `youtube.upload` is refused naming the permission
- [x] 2.4 Failing test: `refreshToken` preserves the stored refresh token when the platform returns
      none
- [x] 2.5 Failing test: the connection resolves the bound channel and uses the **channel id** as the
      external identifier; an account with no channel is refused
- [x] 2.6 Failing golden-body test: the resumable session is opened with the metadata body and the
      `X-Upload-Content-*` headers, then the bytes are PUT to the returned `Location`.
      **Changed during implementation:** the size comes from the single source `GET` rather than a
      preceding `HEAD` — not every storage answers `HEAD` (the local driver serves a static file),
      and a refused `HEAD` would have failed the publication for no reason
- [x] 2.7 Failing test: a source with no `content-length` is refused before the session opens
- [x] 2.8 Failing tests for Shorts intent: `short` with landscape refused, `short` over the ceiling
      refused, `video` with a vertical short file refused, `auto` uploads either, unparseable
      container refused under an explicit intent and allowed under `auto`
- [x] 2.9 Failing tests for the settings schema: title required, tag combined length capped with the
      whitespace surcharge, `publishAt` must be in the future and forces private
- [x] 2.10 Failing test: a thumbnail rejection still reports the publication as successful
- [x] 2.11 Failing test: a video returned as private is a success, not a retry
- [x] 2.12 Failing tests for `classifyError`: invalid grant, quota exhausted, rate limit, server
      error and rejected metadata
- [x] 2.13 Failing test: media rules reject zero videos, two videos and an image
- [x] 2.14 Implement `packages/providers/src/youtube/youtube.provider.ts` until 2.1-2.13 pass,
      carrying the `Derived from Postiz (AGPL-3.0): youtube.provider.ts` attribution comment
- [x] 2.16 Register the provider in `packages/providers/src/index.ts` and extend the registry comment
- [x] 2.17 Add `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET` and the analytics flag to
      `packages/config/src/env.ts`, with its test
- [x] 2.18 Run `bun test packages/providers`

## 3. Scheduling integration

- [x] 3.1 Verified against `packages/core/src/application/use-cases/publishing.ts:160`: settings are
      parsed with the provider's own schema and a failure raises `post.invalid_settings` with the
      field named (`settingsIssues`, line 29), so `title` behaves exactly as Dev.to's does.
      **No new test added** — the path is provider-agnostic and already covered by
      `publishing.test.ts:384` ("campo obrigatorio ausente -> post.invalid_settings no AGENDAMENTO").
      A YouTube-specific duplicate would assert the framework, not this provider
- [x] 3.2 Verified against `publishing.ts:150`: more than one item with `capabilities.threads` false
      or no `publishReply` raises `CapabilityDisabled`. This provider declares `threads: false` and
      implements no `publishReply`, so replies are refused at scheduling. **No new test added** —
      same reason as 3.1

## 4. Web surface

- [x] 4.1 Add Portuguese label and hint for every settings field — no field may fall back to its raw
      key or to the schema's `describe()` text
- [x] 4.3 Add the video preview to `apps/web/src/features/composer/network-preview.tsx`
- [x] 4.4 Add the connection copy for the network card and the connection dialog
- [x] 4.5 Confirm the "coming soon" entry disappears through the catalogue with no edit to
      `apps/web/src/features/channels/upcoming.ts`
- [x] 4.6 Run `bun run typecheck:web` and `bun run build:web`

## 5. End-to-end and manual verification

- [x] 5.1 Extend `scripts/e2e-auth.ts` to assert the catalogue entry: unavailable without
      configuration, OAuth connect type, `requiresMedia`, one video and no image, `title` required
- [ ] 5.2 **NOT RUN.** The isolated end-to-end stack per `docs/principal/STATUS.md` §5 (containers on
      ports 5599/6499, never the development database) was not started in this session. The
      catalogue assertions were added to `scripts/e2e-auth.ts` but not executed
- [ ] 5.3 **Owner step.** Connect a real YouTube channel and publish one real video, recording its
      URL. Golden tests against a mocked `fetch` are not evidence that the platform accepts the body

## 6. Documentation and validation

- [x] 6.1 Rewrite `docs/principal/INTEGRATIONS_SETUP.md` §5.1 with the minimum scope set, the
      Shorts rule, the audit gate and the quota ceiling, in the lay register that file requires
- [x] 6.2 Update `docs/principal/STATUS.md` and add the wave entry at the top of
      `docs/principal/CHANGELOG_ONDAS.md`
- [x] 6.3 Update `docs/principal/platform-gates.md` to mark the network as delivered
- [x] 6.4 Add the `CHANGELOG.md` entry under Unreleased, referencing this change id
- [x] 6.5 Add the environment variables to `.env.example` with their comment block
- [x] 6.6 Run `bun run check:ci`
- [ ] 6.7 **Owner step.** Open the pull request using `.github/pull_request_template.md`, filled in by hand
- [ ] 6.8 After merge and deploy, run `bun run spec:archive add-youtube-provider`
