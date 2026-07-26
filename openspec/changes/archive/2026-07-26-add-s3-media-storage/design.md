## Context

`MediaStorage` (`packages/core/src/application/ports/media.ts`) has four
operations: `put`, `read`, `delete`, `publicUrl`. One implementation exists,
`makeLocalMediaStorage`, which writes to a directory and derives URLs as
`PUBLIC_URL/uploads/<key>`. Keys are `<orgId>/<uuid>.<ext>`, minted in
`storeSniffed` after the magic-byte sniff.

Who consumes what today:

- `publicUrl` — `use-cases/publishing.ts` (materializes media refs into
  `publications.content` at schedule time, and resolves `mediaSettings` at
  publish time), the media routes, the public API routes and the MCP server.
- `read` — only `GET /uploads/:org/:file`. Providers never read bytes through the
  port; they either fetch the public URL themselves (`discord-webhook` multipart,
  YouTube resumable upload) or hand the URL to the network (Meta family, Dev.to).
- `put` — only `storeSniffed`.
- `delete` — nothing. Media deletion is soft on purpose: scheduled posts still
  point at the URL.

Two composition roots build the driver independently: `apps/api/src/container.ts`
(which throws for `STORAGE_PROVIDER=s3`) and `apps/worker/src/main.ts`. They
already drifted once — decision 20 in `docs/principal/STATUS.md` records the
worker missing `providerSecrets` — and the fix was to single-source the mapping in
`@manypost/config`. This change follows that precedent rather than inventing one.

Constraint from the boundaries (`.dependency-cruiser.cjs`): `packages/core` may
not import `@manypost/config`. So the environment→options mapping lives in config
and the driver factory in core takes explicit options.

## Goals / Non-Goals

**Goals:**

- One S3-compatible driver that works against Cloudflare R2, AWS S3 and MinIO.
- A published media URL that does not depend on the app origin, so the Meta
  family and Dev.to can fetch it.
- API and worker provably resolving the same storage from the same code path.
- Fail closed at boot with a message naming the missing variable.

**Non-Goals:**

- Presigned direct-to-bucket upload from the browser. The body still passes
  through the API; that pendency stays open (`docs/principal/STATUS.md` §4).
- Thumbnails, blurhash and video probing. Unrelated pendencies of the same slice.
- Migrating existing objects. Copying a volume into a bucket is an operator task
  with an `rclone`/`aws s3 sync` one-liner, not application code.
- Signed/expiring media URLs. The networks fetch anonymously; the unguessable
  UUID key is the existing and unchanged defense.
- A CDN or cache policy beyond the immutable `cache-control` already sent.

## Decisions

### D1: `Bun.S3Client` instead of `@aws-sdk/client-s3`

Bun ships a native S3 client (the workspace pins `bun@1.3.14`; `engines` requires
`>=1.2.0`), which speaks the same protocol R2 and MinIO expose through a custom
endpoint. Chosen because it adds **zero dependencies** to a monorepo that already
hand-writes its magic-byte sniffer and its MP4 geometry parser rather than pulling
libraries, and because `@aws-sdk/client-s3` would add tens of megabytes to the
Docker image for four operations.

Alternatives considered:

- `@aws-sdk/client-s3`: portable across runtimes, but heavy, and portability is
  worthless here — `AGENTS.md` makes Bun mandatory and both entrypoints are Bun.
- Hand-rolled SigV4 over `fetch`: no dependency either, but request signing is a
  security-critical primitive with a large footgun surface. Rejected.

Cost accepted: `packages/core/src/infra/storage/` gains a Bun runtime coupling.
It is confined to one adapter file behind the port, which is exactly what the port
exists for, and `packages/core/src/domain` stays framework-free. The exception
`AGENTS.md` already grants (`core/src/infra` holds crypto and media) is not
widened in kind, only used.

### D2: The driver takes an injected client seam, so it can be tested without a bucket

`AGENTS.md` forbids real network calls in automated tests. `makeS3MediaStorage`
accepts an optional client factory; by default it constructs `Bun.S3Client`. Unit
tests pass a fake exposing only the surface the driver uses, and assert what the
driver *decides*: the key it derives, the content type it sends, absent-on-missing
reads, error mapping, key refusal. What the fake cannot prove — that Bun signs a
real request R2 accepts — is covered by an opt-in `scripts/live-r2.ts`, following
the `scripts/live-telegram.ts` precedent: a real round trip, never in CI.

### D3: `MEDIA_PUBLIC_URL` is `<base>/<key>` for both drivers

The base is the address under which keys are served *directly*, so
`publicUrl(key)` is `${base}/${key}` with no path segment of its own. The local
driver keeps its historical shape only as the fallback when the variable is
absent: `${PUBLIC_URL}/uploads/${key}`.

The asymmetry is deliberate. Baking `uploads` into the configured base would
force an R2 bucket to contain a pointless `uploads/` prefix; leaving the local
default alone keeps every URL already stored inside `publications.content`
resolving. An operator who points `MEDIA_PUBLIC_URL` at the local driver must
route that host's root to the app's `uploads` path — documented where the variable
is documented.

### D4: No `S3_PREFIX`, one bucket per environment

Rejected on purpose. A prefix invites sharing one bucket between staging and
production, which then shares credentials, lifecycle rules and blast radius. Keys
already start with the organization id; environment separation belongs at the
bucket boundary. Documented as guidance rather than enforced in code.

### D5: Key validation moves into a shared helper

The local driver defends against traversal by resolving the path and comparing to
its root — a filesystem-shaped defense that a bucket does not have. In a bucket a
`..` segment is just a character sequence, so a malformed key would silently
create an object outside its organization prefix instead of failing. Both drivers
therefore validate the key *shape* (`<orgId>/<file>`, no traversal, no absolute
path, no backslash) before touching anything, and the local driver keeps its root
containment check as a second line of defense.

### D6: A new error code rather than reusing `media.fetch_failed`

`media.fetch_failed` means "we could not download what you pointed us at". A
failed bucket write is a different fact with a different fix (operator, not user),
so it gets `media.store_failed` → `502`, alongside `billing.provider_error`.
Reusing the fetch code would have told the user to check their URL when the bucket
was the problem.

### D7: `GET /uploads/:org/:file` stays mounted under `s3`

The route reads through the port, so it keeps working with either driver. It is
kept for one reason: URLs materialized into `publications.content` before the
switch still point at the app origin. Under `s3` the route is a compatibility
path that proxies bytes, and the operator's incentive to copy old objects into the
bucket is documented rather than enforced. New publications get bucket URLs
immediately.

## Risks / Trade-offs

- **Objects written under the local driver are not in the bucket** → After the
  switch, an old scheduled post whose URL points at the app origin still resolves
  through the compatibility route; a post whose URL was never materialized
  resolves through the new base and 404s if the file was not copied. Mitigation:
  the migration plan copies objects *before* flipping the variable, and the flip
  is one variable to revert.
- **Public bucket exposure** → Objects must be anonymously readable, because the
  networks fetch them without credentials. Mitigation: this is unchanged from the
  local driver serving `/uploads` without auth; keys stay UUIDs, the bucket holds
  nothing but media, and it must not be reused for anything else. Documented.
- **Bun runtime coupling in `core/infra`** → Mitigation: confined to one adapter
  behind the port; the port and every use case stay runtime-agnostic, and a future
  driver can be written without touching either.
- **`Bun.S3Client` behavior across R2/S3/MinIO is not proven by unit tests** →
  Mitigation: `scripts/live-r2.ts` proves a real round trip on demand, and the
  boot validation fails closed rather than degrading silently.
- **A wrong `MEDIA_PUBLIC_URL` publishes unreachable URLs** → The failure surfaces
  as a provider-side fetch error, which for the Meta family is *permanent* (the
  container reports the media could not be fetched), so a whole batch could fail.
  Mitigation: `scripts/live-r2.ts` fetches the object back over the public base
  and reports the exact URL, so the variable is verifiable before any publication
  depends on it.

## Migration Plan

1. Deploy with `STORAGE_PROVIDER=local` unchanged. New code paths are inert; the
   local driver's only behavior change is honoring `MEDIA_PUBLIC_URL` when set.
2. Create the bucket, restrict its credentials to it, and confirm anonymous read
   on its public base.
3. Copy existing objects from the volume into the bucket, preserving keys.
4. Run `scripts/live-r2.ts` against the bucket: write, read back through the port,
   fetch the public URL anonymously, delete.
5. Set `MEDIA_PUBLIC_URL` and the `S3_*` variables, then flip `STORAGE_PROVIDER`
   to `s3` on the API and the worker together — they must not disagree.
6. Publish one real post with media to a Meta-family channel and record the
   permalink as the field proof.

**Rollback**: set `STORAGE_PROVIDER=local` and redeploy the previous revision.
Objects written to the bucket in the meantime stay reachable through their stored
URLs only while the bucket lives, so a rollback after real traffic should keep the
bucket and copy new objects back to the volume. No data is deleted and no
migration needs reversal.

## Open Questions

- Whether the managed deployment fronts the bucket with a custom domain from day
  one or starts on the provider's public bucket URL. Both satisfy
  `MEDIA_PUBLIC_URL`; the choice only affects the value, not the code.
- Whether media should eventually move behind `API_PUBLIC_URL`-style host
  splitting. Out of scope here; `MEDIA_PUBLIC_URL` is what that would need.
