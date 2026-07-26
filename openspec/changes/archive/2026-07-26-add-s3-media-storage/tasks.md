## 1. Object key rules (test-first)

- [x] 1.1 Add `packages/core/src/infra/storage/media-key.test.ts` before the helper
      exists
- [x] 1.2 Failing test: a key with a parent-directory segment is refused
- [x] 1.3 Failing test: a key with an absolute path or a backslash is refused
- [x] 1.4 Failing test: a key nesting segments beyond `<orgId>/<file>` is refused
- [x] 1.5 Failing test: a well-formed `<orgId>/<uuid>.<ext>` key is accepted and
      returned unchanged
- [x] 1.6 Implement `media-key.ts` until 1.2-1.5 pass
- [x] 1.7 Make `makeLocalMediaStorage` validate through the helper, keeping its
      root-containment check as the second line of defense; extend
      `local.storage.test.ts` (or add it) to prove both defenses still refuse

## 2. Public URL derivation (test-first)

- [x] 2.1 Failing test: with a public base configured, `publicUrl` is
      `<base>/<key>` and a trailing separator on the base does not duplicate
- [x] 2.2 Failing test: with no public base, the local driver still returns
      `<appOrigin>/uploads/<key>` — the shape already stored in
      `publications.content`
- [x] 2.3 Implement the option in `makeLocalMediaStorage` until 2.1-2.2 pass

## 3. S3-compatible driver (test-first)

- [x] 3.1 Add `packages/core/src/infra/storage/s3.storage.test.ts` with a fake
      client seam, before the driver exists
- [x] 3.2 Failing test: `put` writes to the configured bucket under the given key
      with the media content type it was handed
- [x] 3.3 Failing test: `read` returns the bytes that were written
- [x] 3.4 Failing test: `read` of a missing object resolves absent instead of
      raising
- [x] 3.5 Failing test: `delete` of a missing object completes without raising
- [x] 3.6 Failing test: an invalid key is refused before any client call (assert
      the fake recorded no call)
- [x] 3.7 Failing test: a client failure on write surfaces `media.store_failed`
      and the message carries no credential value
- [x] 3.8 Failing test: `publicUrl` derives from the configured public base
- [x] 3.9 Implement `s3.storage.ts` on `Bun.S3Client` with the injectable client
      factory of design D2 until 3.2-3.8 pass
- [x] 3.10 Export the driver and the shared factory from `packages/core/src/index.ts`

## 4. Environment and single-sourced selection (test-first)

- [x] 4.1 Failing test in `packages/config`: `STORAGE_PROVIDER=s3` without the
      bucket variable refuses to load, naming it
- [x] 4.2 Failing test: `s3` without an access key id or without a secret access
      key refuses to load, naming the missing one, and the message contains no
      credential value
- [x] 4.3 Failing test: `s3` without `MEDIA_PUBLIC_URL` refuses to load naming it
- [x] 4.4 Failing test: `local` with no `S3_*` variable loads successfully
- [x] 4.5 Failing test: `mediaStorageConfigFromEnv` maps a local environment and
      an s3 environment to the matching discriminated configuration
- [x] 4.6 Add `MEDIA_PUBLIC_URL`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`,
      `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` to `packages/config/src/env.ts`
      with the boot refinement, documenting name/purpose/format only — never a
      value
- [x] 4.7 Implement `mediaStorageConfigFromEnv` beside `providerSecretsFromEnv`
      until 4.1-4.5 pass
- [x] 4.8 Add `makeMediaStorage(config)` in core that selects the driver from the
      discriminated configuration, with a test proving each branch

## 5. Error surface

- [x] 5.1 Add `MediaStoreFailed: 'media.store_failed'` to
      `packages/contracts/src/error-codes.ts`
- [x] 5.2 Map it to `502` in `apps/api/src/http/middleware/error.ts`, with a test
      asserting the status and the problem+json title
- [x] 5.3 Confirm `storeSniffed` creates no media record when the write fails
      (test in `media.test.ts`)

## 6. Composition roots

- [x] 6.1 Replace the `STORAGE_PROVIDER=s3` throw in `apps/api/src/container.ts`
      with `makeMediaStorage(mediaStorageConfigFromEnv(env))`
- [x] 6.2 Use the same two calls in `apps/worker/src/main.ts`, replacing the
      duplicated local-driver construction
- [x] 6.3 Confirm `GET /uploads/:org/:file` still serves through the port and
      still answers `404` for an unknown key under either driver
- [x] 6.4 Grep for any remaining direct `makeLocalMediaStorage` call outside tests
      and the factory

## 7. Verification against a real bucket (opt-in)

- [x] 7.1 Add `scripts/live-r2.ts`: write an object, read it back through the
      port, fetch the public URL anonymously, delete it, print the URL it used
- [x] 7.2 Document it as opt-in and never part of CI, alongside
      `scripts/live-telegram.ts`
- [x] 7.3 **PARTIAL.** Run against a real **MinIO** server in a container (a genuine S3
      implementation, public-read bucket): write, read through the driver, anonymous fetch with a
      byte comparison, delete — all passed. A **production bucket** (R2/S3) remains an owner step,
      since it needs credentials that must not exist in this workspace

## 8. Documentation and changelog

- [x] 8.1 Document the new variables in `.env.example` (names, purpose, format,
      no values) and the one-bucket-per-environment guidance of design D4
- [x] 8.2 Update `docs/specs/SPEC_INFRA.md` with the driver, the public base and
      the fail-closed boot
- [x] 8.3 Update `docs/principal/STATUS.md`: the S3/R2 driver stops being a
      pendency; state what remains (copying existing objects, presigned upload,
      the field proof with a Meta-family channel)
- [x] 8.4 Add the wave entry at the top of `docs/principal/CHANGELOG_ONDAS.md`
- [x] 8.5 Add the `CHANGELOG.md` entry (Keep a Changelog)

## 9. Validation

- [x] 9.0 **Drive-by fix, unplanned.** Three `scripts/e2e-auth.ts` assertions for YouTube read
      `capabilities.requiresMedia`/`capabilities.media.*`, a shape the provider catalog never
      returned (`providerCatalogEntry` flattens them; the file's four other assertions already used
      the flat shape). They arrived with the YouTube commit `23db05b` (#44), whose own tasks.md
      records the isolated E2E as NOT RUN, so they had never been exercised. Corrected to the flat
      shape — test-only, no behavior change

- [x] 9.1 `bun run check`
- [x] 9.2 `bun run spec:validate`
- [x] 9.3 `git diff --check`
- [x] 9.4 Isolated end-to-end stack per `docs/principal/STATUS.md` §5 (containers on 5599/6499,
      API on 3987). `STORAGE_PROVIDER=local`: `e2e-auth`, `e2e-publish`, `e2e-public` and `e2e-mcp`
      all green — the default path did not regress. **Went further than planned:** the same stack
      was re-run with `STORAGE_PROVIDER=s3` against MinIO and `e2e-publish` passed end to end
      (upload, schedule with `mediaIds`, publish with media), with the objects landing in the bucket
      under the organization prefix. Fail-closed boot was verified by actually starting the API
      while omitting `S3_BUCKET`, `MEDIA_PUBLIC_URL` and `S3_SECRET_ACCESS_KEY` in turn
- [ ] 9.5 **Owner step.** Open the pull request using
      `.github/pull_request_template.md`, filled in by hand, citing this change
- [ ] 9.6 After merge and deploy, run `bun run spec:archive -- add-s3-media-storage -y`
      and revalidate
