## Why

Five delivered providers cannot publish media outside a developer machine. The
Meta family (Threads, both Instagram variants, Facebook Pages) and Dev.to do not
accept uploaded bytes: they *pull* the file from a URL we hand them. Today the
only `MediaStorage` implementation writes to a local directory and derives its
URL from `PUBLIC_URL`, so the address we publish is the app origin — unreachable
from the network on `localhost`, and coupled to the web host in production.
`STORAGE_PROVIDER=s3` already exists in the environment schema but the
composition root throws on it, so the option is a promise, not a driver.

## What Changes

- Add an S3-compatible `MediaStorage` driver (Cloudflare R2, AWS S3, MinIO)
  beside the local one, selected by the existing `STORAGE_PROVIDER`.
- Add `MEDIA_PUBLIC_URL` so the published media address is independent of the
  app origin, for **both** drivers.
- Move driver selection into one environment mapping shared by the API and the
  dedicated worker, so the two composition roots cannot disagree.
- Validate storage configuration at boot and fail closed with a message naming
  the missing variable, replacing the current `STORAGE_PROVIDER=s3` throw.
- Add a stable `media.store_failed` domain error for a storage write that the
  backend could not complete, mapped to `502`.
- Validate the object key shape in the port's implementations so a key can never
  leave its organization prefix, in the bucket as well as on disk.
- Keep `GET /uploads/:org/:file` serving through the port for compatibility with
  URLs already materialized inside `publications.content`.
- Add an opt-in live smoke script against a real bucket (never in CI), following
  the `scripts/live-telegram.ts` precedent.

No breaking change: `STORAGE_PROVIDER` keeps defaulting to `local`, and an
installation that sets nothing new behaves exactly as before.

## Capabilities

### New Capabilities

- `media-object-storage`: Driver selection, object key rules, published media
  URL derivation, fail-closed configuration and storage failure behavior for the
  organization's media library.

### Modified Capabilities

None. No living OpenSpec capability currently defines media storage behavior.

## Impact

- `packages/core/src/application/ports/media.ts` — port documentation and key
  contract
- `packages/core/src/infra/storage/` — new S3 driver, shared key validation,
  local driver reads its public base from the same option
- `packages/config/src/env.ts` — `MEDIA_PUBLIC_URL`, `S3_*` variables, boot
  refinement; new `mediaStorageConfigFromEnv` mapping beside the
  `providerSecretsFromEnv` precedent
- `packages/contracts/src/error-codes.ts` — `media.store_failed`
- `apps/api/src/container.ts`, `apps/api/src/http/middleware/error.ts`,
  `apps/worker/src/main.ts` — composition roots and status mapping
- `docs/principal/STATUS.md`, `docs/principal/CHANGELOG_ONDAS.md`,
  `docs/specs/SPEC_INFRA.md`, `.env.example`, `CHANGELOG.md`
- `scripts/live-r2.ts` — opt-in verification against a real bucket

**Data impact**: none. No schema change, no migration; `media.path` keys keep
their `<orgId>/<uuid>.<ext>` shape, so records written under the local driver
remain valid keys under the bucket once the files are copied.

**Security impact**: the media URL stops depending on the app origin, and
credentials for the bucket are read from the environment only — never logged,
never written to `channel_settings` or any jsonb column. Objects stay publicly
readable by design, because the networks fetch them anonymously; the defense is
the unguessable UUID key, unchanged from today.

**Railway impact**: the managed deployment gains four required variables when
`STORAGE_PROVIDER=s3`. The local driver's volume can be retired only after the
existing objects are copied to the bucket; until then both paths resolve.

**Product identity**: unchanged. No Postiz occurrence is renamed by this change.
