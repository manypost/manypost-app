# AI Media Storage and Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository policy forbids delegated agents unless the user explicitly authorizes them.

**Goal:** Convert untrusted ephemeral provider output into one bounded,
validated, durable Manypost media record and add video processing that is
available only with S3-compatible storage and pinned FFmpeg/FFprobe readiness.

**Architecture:** Provider output is streamed through SSRF-safe retrieval into
a private runtime-staging namespace, inspected and normalized under resource
limits, then written to the existing organization media namespace. The output
row owns deterministic ingestion identity. Database finalization and customer
settlement are atomic; object writes are repeatable and orphan cleanup is
reference-aware.

**Tech Stack:** Bun 1.3.14, strict TypeScript, Web Streams/async iterables,
S3-compatible multipart storage, FFmpeg/FFprobe, PostgreSQL, pg-boss and
`bun:test`.

## Global Constraints

- Complete foundation and provider-neutral execution before this plan.
- Preserve existing `put`, `read`, `delete` and public URL behavior.
- Never buffer the configured maximum video size in one application object.
- Treat every provider URL, redirect, content type and length as untrusted.
- Private staging is not addressable through `/uploads` or permanent media
  URLs.
- Signed staging URLs are scoped, read-only and short-lived; the provider
  receives no bucket credential.
- Output-processing retries never submit inference again.
- Successful provider status is advisory until object, media row, output row,
  credits and generation finalization commit.
- Advertise video only when durable S3 and bounded media tools are ready.

---

## Planned file structure

| Path | Change |
| --- | --- |
| `packages/core/src/application/ports/media.ts` | Add bounded streaming storage methods |
| `packages/core/src/application/ports/media-processing.ts` | Define inspect/normalize/result limits |
| `packages/core/src/infra/storage/local.storage.ts` | Preserve byte APIs and add bounded streams |
| `packages/core/src/infra/storage/s3.storage.ts` | Add multipart streaming and abort cleanup |
| `packages/generative-media/src/runtime-staging.ts` | Create private staging adapter |
| `packages/generative-media/src/output-fetch.ts` | Create hardened bounded provider-output fetch |
| `packages/generative-media/src/video-processing.ts` | Create bounded FFprobe/FFmpeg adapter |
| `packages/generative-media/test-kit/fixtures/` | Add controlled image/video/corrupt fixtures |
| `packages/core/src/application/use-cases/ai-media-worker.ts` | Add idempotent ingestion/finalization |
| `packages/db/src/repositories/ai-media.repo.ts` | Add deterministic output and orphan-reference queries |
| `packages/queue/src/ai-media-runtime.ts` | Add isolated output/video handler concurrency |
| `docker/Dockerfile` | Add pinned CPU FFmpeg/FFprobe packages |
| `packages/config/src/env.ts` | Add non-secret staging/tool resource limits |

## Task 1: Extend media storage with bounded streams

**Files:**

- Modify: `packages/core/src/application/ports/media.ts`
- Modify: `packages/core/src/infra/storage/local.storage.ts`
- Modify: `packages/core/src/infra/storage/local.storage.test.ts`
- Modify: `packages/core/src/infra/storage/s3.storage.ts`
- Modify: `packages/core/src/infra/storage/s3.storage.test.ts`
- Modify: `packages/core/src/infra/storage/media-storage.test.ts`

**Interfaces:**

- Byte APIs remain behaviorally compatible.
- Streaming writes accept an explicit maximum and abort incomplete writes.
- Streaming reads expose bounded chunks, not a whole video buffer.

- [ ] **Step 1: Write streaming contract tests**

  Add this port surface:

  ```ts
  export interface MediaStreamWrite {
    bytesWritten: number;
    etag?: string;
  }

  export interface MediaStorage {
    put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
    read(key: string): Promise<Uint8Array | null>;
    delete(key: string): Promise<void>;
    publicUrl(key: string): string;
    putStream(
      key: string,
      source: AsyncIterable<Uint8Array>,
      options: { mime: string; maxBytes: number },
    ): Promise<MediaStreamWrite>;
    readStream(
      key: string,
      options: { maxBytes: number },
    ): Promise<AsyncIterable<Uint8Array> | null>;
  }
  ```

  Test empty, exact-limit, over-limit, source error, storage error, abort,
  cleanup and the original byte methods.

- [ ] **Step 2: Confirm red**

  Run:

  ```bash
  bun test packages/core/src/infra/storage/local.storage.test.ts packages/core/src/infra/storage/s3.storage.test.ts packages/core/src/infra/storage/media-storage.test.ts
  ```

  Expected: streaming methods are absent.

- [ ] **Step 3: Implement local streaming**

  Write to a sibling temporary file with exclusive random identity, count every
  chunk, abort/delete on overflow or source error, then atomically rename to the
  validated media key. `readStream` enforces its own observed-byte bound even
  if file metadata is wrong.

- [ ] **Step 4: Implement S3 multipart streaming**

  Start multipart only after key validation. Upload bounded parts, retain
  upload ID only in memory/log-safe metadata, complete on success and issue
  abort on every failure path. A failed abort is reported as a sanitized
  cleanup metric/error and never exposes bucket credentials.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/infra/storage/local.storage.test.ts packages/core/src/infra/storage/s3.storage.test.ts packages/core/src/infra/storage/media-storage.test.ts
  bun run typecheck
  git diff --check
  git add packages/core/src/application/ports/media.ts packages/core/src/infra/storage
  git commit -m "feat(storage): add bounded media streaming"
  ```

## Task 2: Add a private runtime-staging namespace

**Files:**

- Create: `packages/generative-media/src/runtime-staging.ts`
- Create: `packages/generative-media/src/runtime-staging.test.ts`
- Modify: `packages/generative-media/src/index.ts`
- Modify: `packages/core/src/application/ports/ai-media.ts`
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/src/env.test.ts`
- Modify: `.env.example`
- Modify: `apps/api/src/container.ts`
- Modify: `apps/worker/src/main.ts`
- Modify: `apps/api/src/http/routes/media.routes.ts`
- Create: `apps/api/src/http/routes/media.routes.test.ts`

**Interfaces:**

- Runtime staging uses deterministic private keys derived from generation,
  output slot and content role.
- It can issue a scoped read-only URL only when S3 signing is configured.
- Public media routes reject every staging key.

- [ ] **Step 1: Write staging-policy tests**

  Assert:

  ```ts
  expect(runtimeStagingKey({
    organizationId: 'org-1',
    generationId: 'gen-1',
    role: 'reference',
  })).toBe('runtime-staging/org-1/gen-1/reference');
  ```

  Also assert traversal rejection, organization isolation, read-only method,
  expiry at or below the configured maximum, no credential query parameter,
  deterministic cleanup and denial through public media routes.

- [ ] **Step 2: Write readiness tests**

  A recipe requiring URL input is unavailable when storage is local, signing is
  absent or lifecycle cleanup is disabled. Byte-upload providers may remain
  available if their own limits pass.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/generative-media/src/runtime-staging.test.ts packages/config/src/env.test.ts apps/api/src/http/routes/media.routes.test.ts
  ```

  Expected: staging adapter/config/readiness do not exist.

- [ ] **Step 4: Implement staging and configuration**

  Add configuration names for namespace, signed-read TTL and cleanup age with
  safe numeric bounds. Document names, purpose, requirement and format only in
  `.env.example`; include no values resembling credentials or connection
  strings.

  Compose the identical staging adapter in API and worker. Never reuse the
  permanent public media base URL for staging.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test packages/generative-media/src/runtime-staging.test.ts packages/config/src/env.test.ts apps/api/src/http/routes/media.routes.test.ts
  bun run typecheck
  git diff --check
  git add packages/generative-media packages/config apps/api/src apps/worker/src .env.example
  git commit -m "feat(ai-media): add private runtime staging"
  ```

## Task 3: Fetch provider output through SSRF-safe bounded streaming

**Files:**

- Create: `packages/generative-media/src/output-fetch.ts`
- Create: `packages/generative-media/src/output-fetch.test.ts`
- Modify: `packages/generative-media/src/index.ts`
- Modify: `packages/core/src/infra/net/outbound-http.ts`
- Modify: `packages/core/src/infra/net/outbound-http.test.ts`

**Interfaces:**

- Fetch validates scheme/host/DNS/IP on the initial request and every redirect.
- It enforces connect/read/total timeout, redirect count and observed-byte
  limit.
- Failures contain stable sanitized classifications only.

- [ ] **Step 1: Write negative fetch tests**

  Cover `file:`, non-HTTPS when prohibited, loopback, RFC1918, link-local,
  reserved IPv4/IPv6, DNS rebinding between validation/connect, redirect to
  private address, redirect loop, missing body, timeout, over-limit stream,
  claimed/observed length mismatch and unsupported content type.

- [ ] **Step 2: Write adapter-mediated output tests**

  Prefer `provider.fetchOutput`. Permit direct URL retrieval only for a recipe
  whose reviewed adapter returns that transport. Ensure errors do not include
  URL query strings, host credentials or raw response bodies.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/generative-media/src/output-fetch.test.ts packages/core/src/infra/net/outbound-http.test.ts
  ```

  Expected: bounded output fetch behavior is missing.

- [ ] **Step 4: Implement using the hardened outbound boundary**

  Reuse existing IP classification and redirect policy. Stream chunks to the
  supplied sink while counting observed bytes. Sniff bounded leading bytes
  instead of trusting headers. Redact URL query/fragment before logging or
  returning errors.

- [ ] **Step 5: Verify and commit**

  Run:

  ```bash
  bun test packages/generative-media/src/output-fetch.test.ts packages/core/src/infra/net/outbound-http.test.ts
  bun run check
  git diff --check
  git add packages/generative-media/src packages/core/src/infra/net
  git commit -m "feat(ai-media): harden provider output retrieval"
  ```

## Task 4: Make output ingestion deterministic and exactly-once

**Files:**

- Modify: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.test.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.ts`
- Modify: `packages/db/src/repositories/ai-media.repo.integration.test.ts`
- Modify: `packages/queue/src/ai-media-runtime.ts`
- Modify: `packages/queue/src/ai-media-runtime.test.ts`
- Modify: `packages/core/src/application/ports/media.ts`

**Interfaces:**

- One generation owns one `primary` output row and one final media ID.
- Storage key and media allocation are deterministic under retry.
- Final transaction links output/media, settles ledgers and marks success once.

- [ ] **Step 1: Write ingestion failure-matrix tests**

  Cover:

  - provider output ready twice;
  - object write succeeds then database finalization fails;
  - database allocates output then worker crashes before object write;
  - validation fails after partial staging;
  - finalization is invoked twice;
  - orphan scanner races a live retry;
  - provider URL expires but adapter can re-inspect;
  - output fetch fails without causing provider resubmission.

- [ ] **Step 2: Write media provenance tests**

  Assert source `ai`, non-content model/recipe provenance, one primary media,
  optional thumbnail/poster fields and no plaintext prompt in `MediaRecord`.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-worker.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  ```

  Expected: ingestion/finalization behavior is absent.

- [ ] **Step 4: Implement deterministic ingestion**

  Allocate the output row before retrieval. Derive storage identity from
  organization, generation and primary slot, not provider filename. Stream to
  staging, inspect, write the permanent object idempotently, create or replay
  the media row, then atomically:

  ```text
  output -> media
  customer grant -> committed
  provider cost -> settled
  capacity slot -> released
  generation -> succeeded
  ```

  Terminal no-output performs release/settlement without a media row.

- [ ] **Step 5: Implement reference-aware cleanup**

  Delete only staging/multipart/permanent candidates older than the configured
  threshold and not referenced by a live output/media row. A database outage
  makes cleanup skip, never guess.

- [ ] **Step 6: Verify and commit**

  Run:

  ```bash
  bun test packages/core/src/application/use-cases/ai-media-worker.test.ts packages/db/src/repositories/ai-media.repo.integration.test.ts packages/queue/src/ai-media-runtime.test.ts
  bun run db:check
  git diff --check
  git add packages/core/src packages/db/src/repositories packages/queue/src
  git commit -m "feat(ai-media): ingest one durable primary output"
  ```

## Task 5: Add bounded image/video inspection and normalization

**Files:**

- Create: `packages/generative-media/src/video-processing.ts`
- Create: `packages/generative-media/src/video-processing.test.ts`
- Create: `packages/generative-media/test-kit/fixtures/image-small.png`
- Create: `packages/generative-media/test-kit/fixtures/video-supported.mp4`
- Create: `packages/generative-media/test-kit/fixtures/video-needs-normalization.mov`
- Create: `packages/generative-media/test-kit/fixtures/video-corrupt.bin`
- Create: `packages/generative-media/test-kit/fixtures/README.md`
- Modify: `packages/generative-media/src/index.ts`
- Modify: `packages/core/src/application/ports/media-processing.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.ts`
- Modify: `packages/core/src/application/use-cases/ai-media-worker.test.ts`

**Interfaces:**

- Processor returns observed mime, bytes, dimensions, duration and
  passthrough/normalized object paths.
- All subprocess arguments are fixed-position arrays; no shell interpolation.
- CPU, wall time, output size, dimensions, duration and temporary disk are
  bounded.

- [ ] **Step 1: Add controlled fixtures and provenance**

  Generate the two tiny videos locally with a pinned FFmpeg command and record
  the exact command plus SHA-256 values in
  `packages/generative-media/test-kit/fixtures/README.md`. Fixtures contain no
  customer or copyrighted source content.

- [ ] **Step 2: Write processor tests**

  Cover image passthrough, supported MP4 passthrough, MOV normalization,
  corrupt/unsupported media, excessive duration/dimensions/bytes, timeout,
  forced process error, argument-injection filename, poster extraction and
  temporary-file cleanup after every result.

- [ ] **Step 3: Confirm red**

  Run:

  ```bash
  bun test packages/generative-media/src/video-processing.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts
  ```

  Expected: media processor implementation is missing.

- [ ] **Step 4: Implement FFprobe inspection**

  Invoke FFprobe with a fixed JSON-output argument array. Parse with an explicit
  schema, reject extra/unbounded streams and normalize rational frame-rate and
  duration values without `any`.

- [ ] **Step 5: Implement FFmpeg normalization**

  Use fixed codec/container policy compatible with existing social providers,
  CPU-only resource limits, no network protocol input, a fresh temporary
  directory per job and a deterministic output name. Kill the process tree on
  timeout and remove the directory in `finally`.

- [ ] **Step 6: Verify and commit**

  Run:

  ```bash
  bun test packages/generative-media/src/video-processing.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts
  bun run typecheck
  git diff --check
  git add packages/generative-media packages/core/src/application
  git commit -m "feat(ai-media): add bounded video normalization"
  ```

## Task 6: Gate video capability on production readiness

**Files:**

- Modify: `docker/Dockerfile`
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/src/env.test.ts`
- Modify: `.env.example`
- Modify: `apps/api/src/container.ts`
- Modify: `apps/worker/src/main.ts`
- Modify: `packages/core/src/application/use-cases/ai-media.ts`
- Modify: `packages/core/src/application/use-cases/ai-media.test.ts`
- Modify: `packages/queue/src/ai-media-runtime.ts`
- Modify: `packages/queue/src/ai-media-runtime.test.ts`

**Interfaces:**

- Image capability may run with supported durable storage.
- Video capability requires S3-compatible durable storage plus supported
  FFprobe/FFmpeg versions and isolated output-worker capacity.

- [ ] **Step 1: Write readiness tests**

  Assert video unavailable for local storage, missing tool, unsupported tool
  version, zero concurrency, invalid byte/duration limit or missing staging
  cleanup. Assert the response exposes product unavailability, not a binary
  path/version or storage credential.

- [ ] **Step 2: Confirm red**

  Run:

  ```bash
  bun test packages/config/src/env.test.ts packages/core/src/application/use-cases/ai-media.test.ts packages/queue/src/ai-media-runtime.test.ts
  ```

  Expected: video readiness checks are absent.

- [ ] **Step 3: Add pinned production tools**

  Install the distribution-pinned CPU FFmpeg package in `docker/Dockerfile`.
  Do not add Python, CUDA, models or GPU runtime. Build output must show the
  expected FFmpeg/FFprobe major versions and no extra inference service.

- [ ] **Step 4: Compose health and capacity**

  Check storage driver and tool readiness at boot. Register a distinct bounded
  output worker class so video processing cannot starve publication,
  submission or reconciliation jobs. A readiness failure keeps video recipes
  unavailable without disabling compatible image operations.

- [ ] **Step 5: Build and verify**

  Run:

  ```bash
  bun test packages/config/src/env.test.ts packages/core/src/application/use-cases/ai-media.test.ts packages/queue/src/ai-media-runtime.test.ts
  bun run check
  bun run db:check
  bun run spec:validate
  git diff --check
  ```

  Build and inspect the production image:

  ```bash
  docker build -f docker/Dockerfile -t manypost:ai-media-test .
  docker run --rm --entrypoint ffmpeg manypost:ai-media-test -version
  docker run --rm --entrypoint ffprobe manypost:ai-media-test -version
  ```

  Expected: the build succeeds, both tools report the supported pinned major
  version and the image contains no Python/CUDA/model runtime added by this
  change.

- [ ] **Step 6: Commit**

  Run:

  ```bash
  git add docker/Dockerfile packages/config apps/api/src/container.ts apps/worker/src/main.ts packages/core/src/application packages/queue/src .env.example
  git commit -m "feat(ai-media): gate video on durable media readiness"
  ```

## Task 7: Close the storage/video phase

**Files:**

- Modify: `docs/audits/2026-07-30-ai-media-runtime-traceability.md`
- Modify: `openspec/changes/add-ai-media-generation-runtime/tasks.md`

**Interfaces:**

- Produces evidence for OpenSpec task group 10.
- Leaves routes and user UI disabled until phase 4.

- [ ] **Step 1: Run fault and resource tests**

  Run:

  ```bash
  bun test packages/core/src/infra/storage packages/generative-media/src/output-fetch.test.ts packages/generative-media/src/runtime-staging.test.ts packages/generative-media/src/video-processing.test.ts packages/core/src/application/use-cases/ai-media-worker.test.ts
  ```

  Expected: all bounded streaming, SSRF, ingestion and process cleanup cases
  pass.

- [ ] **Step 2: Run phase gates**

  Run:

  ```bash
  bun run check
  bun run db:check
  bun run spec:validate
  git diff --check
  ```

  Expected: all commands pass.

- [ ] **Step 3: Record evidence and commit**

  Update traceability and only completed task 10 checkboxes. Run:

  ```bash
  git add docs/audits/2026-07-30-ai-media-runtime-traceability.md openspec/changes/add-ai-media-generation-runtime/tasks.md
  git commit -m "docs(ai-media): record storage and video verification"
  ```

  Expected: video remains unavailable outside S3/tool-ready environments and
  no managed recipe is active.
