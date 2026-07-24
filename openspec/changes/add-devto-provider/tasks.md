## 1. Provider contract and behavior (test-first)

- [x] 1.1 Add `packages/providers/src/devto/devto.provider.test.ts` with `runProviderContract` from
      the test-kit and a mocked `ctx.fetch`, before any provider code exists
- [x] 1.2 Add a failing golden-body test asserting the create-article request: title from settings,
      item text as the Markdown body, published flag set, and optional fields omitted when unset
- [x] 1.3 Add failing tests for the settings schema: title required with a minimum length, at most
      four tags, optional canonical URL, optional organization
- [x] 1.4 Add failing tests for media rules: one image allowed as cover, a second image rejected,
      any video rejected, no media accepted
- [x] 1.5 Add failing tests for `classifyError`: credential rejection, rate limiting, server failure
      and a canonical-URL conflict reported as permanent with the platform's message preserved
- [x] 1.6 Add a failing test asserting `refreshToken` rejects, so the channel is marked for
      reconnection instead of retried
- [x] 1.7 Add a failing test for `connectWithFields`: the profile lookup resolves the external id,
      name and username; a rejected key surfaces a readable error and returns no channel
- [x] 1.8 Add a failing test for `listSubAccounts`: distinct organizations are resolved from the
      author's articles, and an author with no organization article yields an empty list
- [x] 1.9 Implement `packages/providers/src/devto/devto.provider.ts` until 1.1–1.8 pass, carrying the
      `Derived from Postiz (AGPL-3.0): dev.to.provider.ts` attribution comment
- [x] 1.10 Register the provider in `packages/providers/src/index.ts` and extend the registry comment
- [x] 1.11 Run `bun test packages/providers` — 322 pass, 0 fail

## 2. Scheduling integration

- [x] 2.1 Verify against `packages/core/src/application/use-cases/publishing.ts` that a missing title
      is rejected at scheduling with `post.invalid_settings`, and add the covering test.
      **Defect found and fixed:** the error carried `issues: ["Required"]` with no field name,
      because the Zod `path` was discarded. Issues are now prefixed with the field (`title: Required`)
      at both call sites (schedule and edit) through the new `settingsIssues` helper. The spec
      requires the error to name the missing field, so this was in scope.
- [x] 2.2 Verify that scheduling a publication with replies for this channel is refused by the
      existing capability check, and add the covering test
- [x] 2.3 Add the test-kit note recording that a required settings field is now expected for at least
      one provider, so `packages/providers/test-kit/contract.ts:55` is not later read as forbidding it

## 3. Web surface

- [x] 3.1 Add `organizationId` to `SUB_ACCOUNT_FIELDS` in
      `apps/web/src/features/composer/channel-settings.tsx`
- [x] 3.2 Add Portuguese label, hint and, where applicable, option copy for every settings field
      (`title`, `tags`, `canonicalUrl`, `organizationId`) — no field may fall back to its raw key or
      to the schema's `describe()` text
- [x] 3.3 Add the article preview to `apps/web/src/features/composer/network-preview.tsx` (cover,
      title, author, tags) and map it to `devto`. Required threading channel settings through
      `NetworkPreview` (the title is not in the post text); wired in the composer and the post
      detail sheet. **Not wired in the public approval page** — `/public/approval` deliberately
      omits settings, and exposing them is an API change needing its own OpenSpec.
- [x] 3.4 Add the connection copy for the network card and the connection dialog, in the humanized
      register used by the other networks. Only the `what` key was added: `provider-note.tsx`
      consumes nothing else (`selfHosted`/`cloud` are dead keys being cleaned up separately).
- [x] 3.5 Confirm the "coming soon" entry disappears through the catalogue with no edit to
      `apps/web/src/features/channels/upcoming.ts` — verified at `connections-view.tsx:359`
- [x] 3.6 Run `bun run typecheck:web` and `bun run build:web` — both clean

## 4. End-to-end and manual verification

- [x] 4.1 Extend `scripts/e2e-auth.ts` to assert the network is listed as available with no
      configuration and reports credential-field connection (4 new assertions, including that the
      catalogue publishes `title` as required)
- [x] 4.2 Run the isolated end-to-end stack per `docs/principal/STATUS.md` §5 (containers on ports
      5599/6499, never the development database) and run `scripts/e2e-auth.ts` — all pass.
      `scripts/e2e-publish.ts` also run, because `publishing.ts` changed — all pass.
      Live catalogue verified: `available: true`, `connectType: fields`, `editor: markdown`,
      `maxLength: 100000`, `threads: false`, `images.maxCount: 1`, `videos.maxCount: 0`,
      `required: ["title"]`.
- [ ] 4.3 **PARTIAL.** The owner connected a real Dev.to account against the live platform and
      reported the connection working, which exercises `connectWithFields` and the `/users/me`
      lookup end to end. **Publishing a real article was not verified**: the create-article body is
      covered only by golden tests against a mocked `fetch`, which is not the same as the platform
      accepting it. Publish one real article and record its URL before archiving this change.

## 5. Documentation and validation

- [x] 5.1 Add the API-key instructions to `docs/principal/INTEGRATIONS_SETUP.md` in the lay register
      that file requires, with no real key in any example (new §2.3; Telegram renumbered to §2.4 and
      the two cross-referencing tables updated)
- [x] 5.2 Update `docs/principal/STATUS.md` (ready networks, delivered slices with what was left out,
      implementation decision 30) and add wave 19 at the top of `docs/principal/CHANGELOG_ONDAS.md`
- [x] 5.3 Update `docs/principal/platform-gates.md` to mark the network as delivered (queue is now 6)
- [x] 5.4 Add the `CHANGELOG.md` entry under Unreleased, referencing this change id, plus the
      settings-error fix under Changed
- [x] 5.5 Run `bun install --frozen-lockfile` — no changes
- [x] 5.6 Run `bun run check:ci` — 473 tests pass (was 431), 0 fail; boundaries, AI grep, brand,
      Drizzle, web build and OpenSpec validation all clean
- [x] 5.7 Run `bun run spec:validate` — 5 passed, 0 failed
- [ ] 5.8 Open the pull request using `.github/pull_request_template.md`, filled in by hand
- [ ] 5.9 After merge and deploy, run `bun run spec:archive add-devto-provider`
