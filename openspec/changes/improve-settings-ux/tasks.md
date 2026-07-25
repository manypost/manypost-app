## 1. Move storage into core

- [x] 1.1 Move `apps/api/src/infra/storage/local.storage.ts` to
      `packages/core/src/infra/storage/local.storage.ts` and export `makeLocalMediaStorage` from the
      core barrel
- [x] 1.2 Update `apps/api/src/container.ts` to import it from `@manypost/core`; delete the old file
- [x] 1.3 `bun run check` — boundaries clean (core imports nothing from `apps/*`)

## 2. Media-in-settings resolution (test-first)

- [x] 2.1 Add `mediaSettings?: readonly string[]` to `ChannelProvider` in
      `packages/contracts/src/channel-provider.ts`
- [x] 2.2 Add `media?` and `storage?: Pick<MediaStorage,'publicUrl'>` to `PublishDeps`
- [x] 2.3 Failing test in `publishing` : a provider declaring `mediaSettings: ['thumbnail']` receives
      the resolved URL, and `pub.settings` in the store keeps the media id
- [x] 2.4 Failing test: an id from another org resolves to nothing and the key is dropped; publish
      still succeeds
- [x] 2.5 Failing test: with no media/storage wired, the key is dropped and publish succeeds
- [x] 2.6 Implement the resolution in the publish runner (copy of settings, org-scoped lookup) until
      2.3–2.5 pass
- [x] 2.7 Thread `media`/`storage` through `packages/queue/src/runtime.ts` into the publish and
      thread runners
- [x] 2.8 Wire `media`/`storage` in `apps/worker/src/main.ts` and pass them in `apps/api/src/container.ts`

## 3. YouTube settings shape

- [x] 3.1 Change `categoryId` to a `z.enum` of the accepted upload categories, default `22`
- [x] 3.2 Change `thumbnailUrl` (URL) to `thumbnail` (media id) and declare `mediaSettings: ['thumbnail']`
- [x] 3.3 `publish` reads `cfg.thumbnail` as the resolved URL; skip when unset
- [x] 3.4 Update the provider tests (thumbnail via resolved URL, category enum) — `bun test packages/providers`

## 4. Composer controls

- [x] 4.1 Add a `DateTimeField` branch for `format: "date-time"`, converting ISO ↔ local with `min` = now
- [x] 4.2 Replace `ArrayField` with a chip input honouring `maxItems`; add a live counter when the
      registry declares a character budget
- [x] 4.3 Add a `UrlField` branch for `format: "uri"` with inline validation
- [x] 4.4 Add a `MediaField` branch driven by a `FIELD_WIDGETS` registry, wrapping the media picker for
      single select, showing the chosen image with a change/remove affordance
- [x] 4.5 Add the YouTube category option labels and the thumbnail/rename copy to `pt-BR.json`; ensure
      no field falls back to its raw key
- [x] 4.6 `bun run typecheck:web` and `bun run build:web`

## 5. End-to-end, docs, validation

- [x] 5.1 Update `scripts/e2e-auth.ts` if the YouTube catalogue assertions reference the changed fields
- [x] 5.2 Update `docs/principal/STATUS.md`, add the wave entry to `docs/principal/CHANGELOG_ONDAS.md`
- [x] 5.3 Add the `CHANGELOG.md` entry under Unreleased
- [x] 5.4 `bun run check:ci` and `bun run spec:validate`
- [ ] 5.5 **Owner step.** Open the PR from the template; after merge, `bun run spec:archive improve-settings-ux`
