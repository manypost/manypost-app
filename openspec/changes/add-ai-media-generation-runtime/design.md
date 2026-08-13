## Context

Manypost currently exposes synchronous image generation through
`POST /v1/ai/image`. The use case checks the `ai_image` plan feature, reserves a
fixed number of credits, invokes one configured image provider, validates the
returned bytes and creates an ordinary organization-scoped media record.

That path is intentionally small, but it does not provide the guarantees needed
for long-running image or video APIs:

- an HTTP request cannot be the durable owner of a provider run;
- the current AI credit reservation has a 180-second lease and may be reclaimed
  while a legitimate long-running generation is still active;
- a timeout after provider acceptance cannot be treated as a safe retry;
- provider callbacks, polling, cancellation and expiring output URLs need
  durable correlation;
- video ingestion needs bounded streaming, probing/normalization and
  production-capable object storage;
- customer credits and Manypost's monetary provider cost are different
  accounting dimensions;
- `media.generation_prompt` currently retains plaintext content without the
  retention boundary required by this change.

PostgreSQL and pg-boss are already the authoritative data/job infrastructure.
Redis coordinates rate limits and realtime but is not a source of business
truth. Media storage already has local and S3-compatible drivers; local storage
still depends on a shared volume, while S3 is suitable for horizontally scaled
workers. The existing anti-SSRF remote-media client, byte sniffing,
`CryptoService`, audit log and conditional publishing patterns are precedents
to reuse rather than reimplement.

This change is a prerequisite for advanced media workflows. It deliberately
does not deploy ComfyUI or implement workflow graphs, App Mode or Studio. A
later workflow-runtime change may use ComfyUI as an ephemeral DAG executor, but
only after the durable provider-effect boundary specified here exists.

Implementation starts only after `add-ai-image-quality-modes` is landed and
archived so the compatibility baseline for `economy|quality`, image credits
and `/v1/ai/image` is unambiguous.

Stakeholders are:

- organization members generating and reviewing media;
- owners/admins managing organization activity and spend;
- operators reconciling ambiguous paid submissions and provider incidents;
- developers adding provider adapters without changing domain invariants;
- self-hosted operators configuring their own providers and storage.

## Goals / Non-Goals

**Goals:**

- Add durable, organization-scoped asynchronous image and video generation for
  four guided operations: `social-image-create`, `social-image-edit`,
  `social-video-from-prompt` and `social-video-from-image`.
- Preserve exactly one primary user-visible output per generation.
- Make dispatch, submission, callback/poll recovery, cancellation, ingestion
  and settlement safe across process and queue failures.
- Prevent a timeout or stale worker from causing a blind duplicate paid call.
- Reserve customer credits before submission, settle them exactly once and
  account for provider monetary cost independently.
- Keep provider/model selection and pricing behind immutable, evaluated recipe
  snapshots.
- Preserve tenant isolation, encrypted content retention, synthetic-media
  provenance, accessibility and deliberate composer attachment.
- Expose stable generation/provider/output contracts that a later workflow
  runtime can reuse.

**Non-Goals:**

- ComfyUI deployment or integration, workflow graphs, workflow
  drafts/versions, App Mode, Studio or arbitrary graph execution.
- Comfy Cloud, RunPod, GPU workers, CUDA, local model weights or self-hosted
  inference.
- More than one primary output, batches, user-visible variants, fan-out or
  partial-success semantics inside one generation.
- Local or provider-backed LoRA, ControlNet, IP-Adapter, seed, sampler or
  similar advanced controls. Each requires a later provider-capability change.
- A public provider-management or platform-operator administration API.
- A non-linear video editor, avatar/face/lip/voice cloning, or automatic
  attachment/publication.
- Replacing pg-boss, the existing media library or the current plan-policy
  model.

## Decisions

### 1. Land the durable generation foundation before workflow orchestration

The launch unit is guided generation over a durable provider runtime. Graph
authoring and graph execution are separate dependent products.

This order keeps the first change independently useful and proves the hardest
invariants—paid external effects, ambiguous submission, budget settlement and
output durability—without also introducing a Python service, browser proxy,
graph compiler and authoring authorization.

Alternative: ship guided generation, App Mode, Studio and Comfy orchestration
as one change. Rejected because rollout or rollback of any one surface would
couple the others, and the previous plan made two systems appear to own
orchestration.

Alternative: use ComfyUI only as an editor forever. Rejected as the target
architecture. A later change may use its DAG scheduler, caching and async branch
execution; the durable boundary in this design makes that use safe.

### 2. Domain policy stays in core; adapters stay replaceable

Ownership follows the existing dependency direction:

| Layer | Ownership in this change |
| --- | --- |
| `packages/contracts` | shared operation/status constants, public schemas, events and stable problem codes; no business logic |
| `packages/core` | generation/attempt state transitions, authorization policy, quoting, reservation rules, recovery decisions, cancellation, settlement and ports |
| `packages/generative-media` | concrete provider adapters, provider catalogue serialization, response mapping and bounded image/video infrastructure adapters |
| `packages/db` | additive Drizzle schema, organization-scoped repositories, conditional transitions and multi-table transactions |
| `packages/queue` | pg-boss queue adapter, job registration and advisory Redis realtime/rate coordination |
| `apps/api` | authenticated HTTP/OpenAPI adapters, signed provider callbacks and composition |
| `apps/worker` | composition root for submission, polling, recovery, retention and media-processing handlers |
| `apps/web` | guided UX through the generated OpenAPI client; no server-package imports |

`packages/core` does not import the database, provider package, queue or apps.
`packages/generative-media` does not decide credits, tenant access, retry
eligibility, attempt state or settlement. It reports provider facts through
ports; core decides what those facts mean.

Core exposes a narrow `AiMediaGenerationUnitOfWork` port for the operations that
must atomically span generation, credit, provider-spend, output and media
repositories. The Drizzle implementation owns the database transaction.
Application code must not simulate atomicity by invoking independent
repositories in sequence.

The existing storage and crypto implementations in `packages/core/src/infra`
may be reused, but this change does not add provider/business logic to that
existing exception. The package-boundary checks are updated when the new
adapter package is introduced.

Alternative: place the graph/compiler and provider runtime together in
`packages/generative-media`. Rejected because compilation and paid-effect
policy are application/domain concerns, not provider-adapter concerns.

### 3. Product operations use immutable, capability-driven recipes

The public operation is a stable Manypost concept; provider dialect is not.

| Operation | Required input | Required entitlement | Primary output |
| --- | --- | --- | --- |
| `social-image-create` | prompt | `ai_image` | image |
| `social-image-edit` | prompt + owned image | `ai_image` | image |
| `social-video-from-prompt` | prompt | `ai_video` | video |
| `social-video-from-image` | prompt + owned image | `ai_video` | video |

`ai_video` is a distinct `PlanFeature`, initially assigned to Premium in the
managed plan catalogue. Existing self-hosted plan semantics remain: commercial
plan enforcement is disabled, but provider availability, credit accounting,
capacity and spend safety still apply.

Every enabled catalogue recipe declares:

- stable recipe, adapter and adapter-protocol versions;
- provider/model identifier and supported operation;
- typed option bounds such as aspect, quality and video duration;
- customer-credit maximum;
- provider-cost estimate/ceiling as integer minor units plus currency and
  pricing effective date;
- maximum safe attempts and terminal/transient classification;
- idempotency, lookup, callback, polling and cancellation capabilities;
- provider runtime/output retention deadlines;
- content rights, moderation and provider-retention review references;
- rollout state and rollback predecessor.

The selected recipe is snapshotted when the generation is created. Later
catalogue changes affect only new generations. The exact initial providers and
models are not architectural constants: an entry cannot be enabled until the
evaluation and commercial/privacy gates in this design pass.

A recipe requests exactly one provider result. If a provider protocol can
return multiple candidates, its versioned adapter recipe has one deterministic
primary-selection rule and does not expose the other candidates as generation
outputs. A user requesting another variant creates another idempotent
generation and receives a separate quote.

### 4. PostgreSQL stores one generation aggregate and sequential attempts

Additive persistence includes:

#### `ai_media_generations`

- generation ID, organization ID and creator actor type/ID;
- operation, idempotency key and keyed canonical request fingerprint;
- canonical status, monotonic state/job version and worker lease metadata;
- immutable recipe/routing/credit/provider-cost ceiling snapshot;
- encrypted canonical input and `content_expires_at`;
- credit grant ID, quoted/settled credits and terminal outcome;
- cancellation, sanitized failure and timestamps.

#### `ai_media_provider_attempts`

- generation ID and monotonically increasing attempt ordinal;
- immutable adapter/model/protocol/recipe snapshot;
- server-generated provider client token and provider run ID when known;
- attempt status, monotonic version and execution lease;
- keyed normalized-input fingerprint;
- provider-cost reservation, reported/estimated actual cost and currency;
- sanitized failure and reconciliation metadata.

A unique `(generation_id, attempt_ordinal)` constraint and a conditional
transition ensure that at most one effect-capable attempt is active. Provider
client tokens are unique within an adapter; provider run IDs are unique when
the provider contract makes them stable.

#### `ai_media_generation_outputs`

- one unique `(generation_id, slot='primary')` row;
- ingestion status, deterministic staging object identity and eventual media
  ID;
- encrypted short-lived provider output locator only when a provider cannot be
  re-inspected to obtain it;
- validation/normalization metadata and sanitized failure.

Canonical derivatives such as a poster thumbnail remain fields/objects of the
same media result, not additional generation output slots.

#### `ai_media_generation_events`

Sanitized append-only transitions and deduplicated provider event identities.
Events contain IDs, statuses, codes and bounded timing/cost facts, never prompts,
provider bodies, credentials or signed URLs.

#### Provider accounting and rollout

Provider-cost ledger/window records reserve estimated monetary exposure before
submit and settle reported or price-snapshot-derived actual cost afterward.
Static recipe definitions remain versioned in code; an operator-controlled
PostgreSQL activation record supplies `disabled|canary|active`, organization
allowlists and rollback selection.

All tables carry `org_id` directly where practical. Repository methods require
organization scope or derive it through a parent row already locked and proven
scoped. Foreign keys never replace authorization.

Existing migrations are not edited. Drizzle generates new migrations and
metadata, which are inspected rather than hand-written in
`packages/db/migrations/meta/*`.

### 5. Generation and attempt state machines have explicit uncertainty

The canonical generation state is:

```text
queued -> submitting -> provider_running -> ingesting -> finalizing -> succeeded
   |           |                |               |             |
   |           |                |               +-----------> failed
   |           |                +---------------------------> failed
   |           +-> submission_uncertain
   |                    |-> provider_running
   |                    |-> queued       (only after proof of not-created)
   |                    +-> failed       (truthfully resolved with no output)
   +-> canceled         (only before provider acceptance)

active -> cancellation_requested
                    |-> canceled
                    |-> provider_running | ingesting  (provider completed first)
                    +-> failed                       (provider terminal failure)
```

`succeeded`, `failed` and `canceled` are terminal. `submission_uncertain` and
`cancellation_requested` are non-terminal blocked/reconciling states and keep
their credit/provider-spend reservations.

The provider-attempt state is:

```text
prepared -> submitting -> accepted -> completed
                |            |
                |            +-> provider_failed | cancellation_pending
                |                                  |-> canceled
                |                                  |-> completed | provider_failed
                +-> not_created | submission_uncertain
                                      |-> accepted | not_created | provider_failed
```

Only `not_created`, a confirmed terminal provider failure, or confirmed
cancellation proves that the previous provider run cannot later produce a
duplicate usable output. A new attempt after such a result must still be
allowed by the snapshotted retry count and provider-cost ceiling.

Output ingestion has its own output-row state and may retry while the provider
attempt remains `completed`; an ingestion error does not rewrite provider truth
or create another provider attempt.

All worker writes use compare-and-set conditions over the expected state,
version and lease owner. Losing a lease turns subsequent writes into no-ops;
it never authorizes a second submission.

Generation success means all of the following committed:

1. the primary object is durable and validated;
2. the organization-scoped media record exists;
3. the output row references that media;
4. the customer-credit grant is committed exactly once;
5. the generation is terminal `succeeded`.

A provider reporting success is therefore advisory until Manypost completes
ingestion and settlement.

### 6. Creation is idempotent and survives a missed enqueue

`POST /v1/ai/media/generations` requires `Idempotency-Key`. The API:

1. authenticates the actor and derives the organization from the session;
2. validates role, entitlement, operation, input-media ownership and installed
   capability;
3. recalculates the selected recipe and quote;
4. canonicalizes the request and computes a keyed fingerprint so retained
   fingerprints cannot be used as a prompt dictionary;
5. in one PostgreSQL transaction, conditionally reserves credits and creates
   the `queued` generation with encrypted input;
6. commits before enqueueing a pg-boss job;
7. enqueues only `{ generationId, jobVersion }` with a singleton key.

The same organization/key/fingerprint returns the original generation. The
same key with a different fingerprint returns a stable conflict. No prompt,
provider payload or tenant claim is placed in pg-boss.

The generation row is also the durable dispatch intent. A periodic scanner
finds due `queued` rows without current progress and re-enqueues them with a
versioned singleton key. Therefore a crash after commit but before enqueue does
not strand the reservation. Queue delivery remains at-least-once; state
fencing makes execution effectively once per transition.

Alternative: enqueue before commit. Rejected because a worker can observe a job
whose generation or reservation does not exist.

Alternative: rely only on Redis idempotency or pg-boss singleton keys. Rejected
because both are coordination aids, not the durable business result.

### 7. Long-running credits are generation-bound, not lease-reclaimed

The current short-lived `AiCreditsRepository` behavior remains valid for
synchronous text/image calls but cannot govern an asynchronous provider run.

`ai_grants` gains a nullable generation reference and permits no expiry for a
generation-bound reservation. Existing synchronous grants keep their current
lease and lazy reclamation. Async reservation reclamation is allowed only when
a transaction proves that:

- the generation is still pre-submission and has become safely abandoned; or
- the generation is terminal with no usable output; or
- an audited operator resolution established that no output will be delivered.

The generation-creation transaction locks the monthly credit bucket, reserves
the declared maximum and inserts the generation/grant association atomically.
The finalization transaction conditionally changes the same grant from
`RESERVED` to `COMMITTED` or `RELEASED`; a unique generation association and
state predicate make repetition a no-op.

Customer settlement policy is:

- one durable usable primary output commits the recipe's declared actual
  credits, never more than the reservation;
- no usable primary output releases customer credits even if Manypost incurred
  provider cost;
- provider retries do not charge customer credits repeatedly;
- a cancellation confirmed before completion releases credits;
- cancellation is best-effort: if the provider completes before cancellation
  is confirmed and Manypost ingests a usable output, the generation succeeds
  and consumes the disclosed credits.

Provider monetary cost is recorded independently for every attempt. Reported
cost remains nullable when the provider does not supply it; the ledger records
whether the value is provider-reported or derived from the immutable pricing
snapshot instead of presenting an estimate as exact.

### 8. Submission persists identity before the external effect

For each attempt the worker:

1. claims the generation with a fenced execution lease;
2. chooses only the already-snapshotted route;
3. creates a `prepared` attempt with a random provider client token;
4. atomically reserves provider spend/capacity and moves the attempt to
   `submitting`;
5. invokes the adapter outside the transaction;
6. persists one of `accepted`, `completed`, `not_created` or
   `submission_uncertain` under the same fence.

The provider port is shaped around observable facts:

```ts
type SubmitProviderResult =
  | { kind: "accepted"; providerRunId: string }
  | { kind: "completed"; output: ProviderOutputReference; providerRunId?: string }
  | { kind: "not_created"; retryAfterMs?: number }
  | { kind: "uncertain" };

interface ManagedMediaProvider {
  readonly adapterKey: string;
  submit(input: ProviderSubmission): Promise<SubmitProviderResult>;
  inspect(input: ProviderInspection): Promise<ProviderRunSnapshot>;
  cancel(input: ProviderCancellation): Promise<ProviderCancelResult>;
  fetchOutput(input: ProviderOutputRequest): Promise<ProviderOutputReference>;
}
```

Every adapter declares whether repeating `submit` with the same client token is
provider-enforced idempotency and whether `inspect` can resolve by client token
before a provider run ID is known. Recovery may repeat submit only when the
adapter contract proves server-side idempotency. Otherwise a lost response
becomes `submission_uncertain`.

Polling and callback processing are safe to repeat. Providers without an
authenticated callback contract are polling-only. For adapters that enable
callbacks, provider callback routes:

- verify signature against the exact raw request bytes;
- enforce timestamp/replay limits;
- deduplicate a stable provider event identity;
- derive organization/generation from stored attempt mapping or client token;
- persist only a sanitized event;
- enqueue reconciliation instead of performing business transitions in the
  route handler.

An unmatched but valid callback is held as a bounded sanitized reconciliation
event and retried after the submission response race closes. Raw callback
bodies are never retained.

Provider errors are normalized to:

- permanent request/moderation failure;
- transient failure with proof that no run was created;
- accepted/running;
- terminal provider failure;
- refreshable provider authentication failure;
- uncertain acceptance.

Fallback or retry is prohibited while an attempt is accepted, uncertain,
cancel-pending or has an unclassified outcome. Output-processing retry repeats
only fetch/validation/storage, never inference.

### 9. Ambiguous attempts use an audited operational workflow

Automatic reconciliation first uses, in order:

1. callback evidence;
2. inspect by provider run ID;
3. inspect by provider client token when supported;
4. provider-enforced replay of the same idempotent submission when explicitly
   supported by the adapter.

If those cannot determine truth before the recipe deadline, the attempt remains
`submission_uncertain`; it is not converted to ordinary failure by elapsed time.
The generation is visible as requiring operational review, holds its
reservations and raises an alert.

Launch reconciliation is a Bun operational CLI composed from the same core use
case and repositories, not a public HTTP endpoint. It accepts an opaque attempt
ID and an explicit evidence/reference string, derives organization/provider
from the database and supports only:

- attach a verified provider run ID, then resume normal inspect/fetch;
- confirm provider proof of `not_created`, allowing the normal retry policy;
- confirm terminal failure/cancellation and provider cost;
- rerun read-only adapter inspection.

It cannot accept arbitrary organization IDs, output URLs or provider
credentials. Mutations require the expected attempt version, append a
`SYSTEM` audit/event with the operator-supplied evidence reference and never
delete history. An operator console, broader operator identity system or
manual-output upload is a separate change.

### 10. PostgreSQL enforces provider spend and outstanding capacity

Redis may smooth HTTP request rates and deliver realtime updates, but absence
or loss of Redis must not permit extra paid provider submissions.

Before `submitting`, a PostgreSQL transaction conditionally reserves:

- the attempt's maximum provider monetary cost in the provider/day spend
  window;
- one outstanding slot for the adapter/model capacity key;
- any configured organization/day ceiling.

Accepted, uncertain and cancellation-pending attempts continue occupying their
slot and estimated spend until provider truth is known. Terminal settlement
converts estimated spend to reported/snapshot-derived actual cost and releases
the slot. A safely `not_created` attempt releases both.

This conservative policy may temporarily reduce availability during provider
ambiguity, but it cannot fail open into duplicate cost. Limits use integer
minor units and row-locked conditional updates. Catalogue entries remain
disabled if required ceilings or currency information are missing.

Worker concurrency is separately bounded so video probing and provider polling
cannot starve publication jobs. Queue names and worker pools distinguish
submission, reconciliation and media processing; all still use the existing
pg-boss/PostgreSQL runtime.

### 11. Output ingestion is durable, bounded and independent of provider URLs

Provider output references are untrusted and ephemeral. The worker:

1. obtains the output through an adapter or the existing outbound-media client;
2. applies DNS/IP/redirect, scheme, timeout and byte limits on every fetch;
3. streams to a bounded temporary/staging location rather than buffering a
   maximum-size video in application memory;
4. validates actual content independently from `Content-Type` or filename;
5. normalizes when the selected recipe requires it;
6. writes the final object under an organization-scoped immutable media key;
7. in one database transaction, creates media/output metadata, settles credits
   and marks the generation terminal.

The output row allocates its media/object identity before the storage write, so
retries use the same key. If object persistence succeeds and database
finalization fails, retry is idempotent; a scanner removes abandoned staging
objects only after proving that no active output references them.

Images reuse the existing sniff/size/metadata pipeline. Launch video output is
bounded to the catalogue's duration, dimensions and byte ceiling and is probed
with resource-limited FFprobe. When normalization is required, FFmpeg runs with
wall-clock, CPU, memory, disk and output-byte limits and produces:

- MP4 with H.264 and `yuv420p`;
- an allowed 24/30 fps profile;
- a catalogue-supported `9:16`, `1:1` or `16:9` shape;
- AAC only when the recipe explicitly permits audio;
- one poster thumbnail associated with the primary media.

Production video capabilities require `STORAGE_PROVIDER=s3` and successful
media-tool readiness. The local driver remains supported for compatibility and
guided image generation, but the capability endpoint reports video unavailable
under local storage. No provider temporary URL becomes `media.path` or a
permanent public URL.

Provider inputs are resolved from organization-owned media IDs. Adapters receive
bounded bytes/streams by default. When an adapter requires a URL, its recipe is
available only if the storage composition provides a private runtime-staging
object plus a short-lived signed read URL. The staging prefix/bucket must not be
served by the stable public media base, and readiness verifies expiration
behavior. Adapters never receive bucket credentials. Runtime staging objects
use unguessable keys and lifecycle cleanup.

### 12. API, authorization and composer behavior remain Manypost-native

The initial authenticated application API is:

- `GET /v1/ai/media/capabilities`;
- `POST /v1/ai/media/quotes`;
- `POST /v1/ai/media/generations`;
- `GET /v1/ai/media/generations`;
- `GET /v1/ai/media/generations/{id}`;
- `POST /v1/ai/media/generations/{id}/cancel`;
- signed provider-specific callback routes.

A quote is advisory and expires with its catalogue revision. Creation
recalculates the quote and requires the client to declare the maximum credits
it accepted; a higher current quote returns a stable conflict instead of
silently charging more. Responses expose customer credits, operation,
capabilities and status, never Manypost's provider wholesale cost, internal
adapter payloads or topology.

All organization members may use a guided operation when the plan and runtime
capability allow it. A member lists/reads/cancels only generations they created;
an `ADMIN` or `OWNER` may manage all generations in the organization. Durable
media outputs follow the existing organization media-library visibility.
Raw/decrypted input is omitted from list responses and is returned, while
retained, only to the creator or an admin/owner.

Cancellation is an authenticated command, not a direct queue deletion. It
increments the generation version, fences stale jobs and follows the provider
truth rules above.

Existing SSE/Redis realtime can announce sanitized generation status, but
persisted GET is authoritative. Realtime loss never changes execution.

The composer offers guided operation/options, quote confirmation, progress,
cancel/retry guidance, output review, alt text and an explicit “attach” action.
Generation never mutates a draft or schedules/publishes a post automatically.
Accessibility includes keyboard operation, focus/status announcements and no
color-only state.

`POST /v1/ai/image` remains synchronous and preserves its current request,
response, `economy|quality`, credit and idempotency behavior during migration.
Its provider implementation may move behind the new adapter package, but it
does not silently become an async response. New guided clients use generation
IDs.

Any OpenAPI route/schema change regenerates, rather than manually edits:

```bash
API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
```

Both `apps/web/openapi.json` and
`apps/web/src/lib/api/schema.d.ts` are reviewed together.

### 13. Content retention replaces permanent plaintext prompt provenance

For new async generations, canonical prompt/options/input-media references are
encrypted through the existing `CryptoService` before persistence.
`ENCRYPTION_KEY` remains independent from authentication secrets. Jobs carry
only IDs; workers decrypt just in time for the selected attempt.

Content-bearing generation input and encrypted provider output locators receive
`content_expires_at = created_at + 30 days`. The retention worker clears those
fields after the deadline; output locators are cleared earlier as soon as
ingestion or a terminal no-output resolution makes them unnecessary. Operation,
recipe/model, output media link, synthetic source, accounting, actor/audit
identity and sanitized status history remain.

`media.generation_prompt` becomes a deprecated compatibility column:

- new code does not write a plaintext prompt there;
- new media retains `source='ai'` and non-content model/recipe provenance;
- additive encrypted prompt/expiry columns support recent synchronous legacy
  calls during the compatibility period;
- an idempotent application backfill encrypts legacy plaintext newer than 30
  days and nulls the plaintext;
- legacy plaintext already older than 30 days is nulled;
- the backfill runs in bounded batches after old application replicas are
  drained, then the retention worker enforces the same deadline.

The backfill has a dry-run count/age report and never logs prompt values.
Prompt purge is intentionally irreversible at the application layer; rollback
does not restore content. Backup/object-store retention is documented and
aligned operationally instead of being presented as immediate physical erasure.

Request and normalized-input fingerprints use a keyed canonical digest, not a
plain hash of the prompt. They may remain for idempotency/audit after content
purge without enabling practical dictionary matching outside the installation.

### 14. Provider evaluation and activation are runtime gates

No provider/model recipe reaches `active` based only on marketing claims.
Repeatable fixtures cover:

- product, editorial and lifestyle images;
- Portuguese/English typography;
- image editing and owned references;
- vertical/social composition;
- text-to-video and image-to-video motion;
- temporal coherence and camera instructions;
- moderation, latency, failure classification and cancellation;
- callback/poll behavior and ambiguous submission;
- provider output retention, commercial rights and provider cost.

Promotion requires signed-off evidence, immutable recipe/pricing versions,
configured spend/capacity ceilings, canary organizations and a rollback
predecessor. Price or protocol drift disables new creation for that recipe;
already accepted generations continue recovery through their snapshots.

Capabilities distinguish:

- entitlement: the organization plan permits the product operation;
- configured capability: an evaluated recipe and required infrastructure
  exist;
- operational admission: spend/capacity currently permits a new attempt.

Temporary admission exhaustion does not falsely advertise that the installation
lacks the feature; creation returns a retryable capacity problem without
falling back to an unevaluated provider.

### 15. Future ComfyUI orchestration consumes this runtime without owning it

The dependent `add-ai-media-workflow-runtime` change is expected to preserve
this boundary:

- Manypost stores immutable compiled allowlisted workflows and is authoritative
  for tenant, run/version, orchestration-attempt lease, node effects, provider
  reconciliation, outputs and settlement.
- A private pinned ComfyUI service receives a complete stored workflow
  server-to-server and acts as an ephemeral DAG scheduler, including
  topological execution, caching, async branches and progress.
- The browser never sends an authoritative raw `/prompt` request.
- Provider-effect custom nodes receive only an opaque node-attempt token. The
  Manypost gateway derives organization, run, node, recipe and canonical input
  from PostgreSQL and recomputes the fingerprint; it does not trust
  Comfy-supplied tenant, provider, price or input-hash fields.
- Pure nodes may re-execute. Paid provider nodes return the persisted
  node-effect result when replayed.
- A Comfy process success is advisory until Manypost has durable required
  outputs and settlement.
- After Comfy restart or orchestration-lease expiry, Manypost may resubmit the
  whole compiled graph because effectful node replays are idempotent below the
  Comfy process.

That future change, not this one, decides the pinned build, proxy surface,
custom-node protocol, replica/queue policy, workflow compiler, App Mode and
Studio RBAC. Guided generation remains independent of Comfy availability.

### 16. Observability uses bounded metadata and actionable states

Structured logs preserve request/correlation IDs and may include generation,
attempt, recipe and sanitized provider-run identifiers. They never include
prompts, input/output URLs, callback bodies, provider credentials, encryption
material or media bytes.

Metrics use bounded labels for operation, status, recipe version, adapter/model
recipe, error class and source. They cover:

- create-to-start, provider and end-to-end latency;
- dispatch recovery and stale worker leases;
- submit outcomes and current uncertain/cancel-pending attempts;
- callback deduplication and polling recovery;
- provider outstanding capacity and spend-window headroom;
- reserved/committed/released customer credits and reservation age;
- provider estimated/reported cost;
- ingestion, validation, normalization and staging cleanup;
- retention/backfill counts without content.

Organization, actor, generation, attempt and provider-run IDs are not metric
labels.

Alerts cover stale queued/running/finalizing generations, uncertainty age,
reservation age, callback signature/replay failures, provider outage or price
drift, capacity/spend exhaustion, ingestion failure, media-tool readiness and
retention backlog. The operator runbook links every alert to a read-only
diagnostic and, where applicable, the reconciliation CLI.

## Risks / Trade-offs

- **The narrowed change is still cross-cutting** → deliver dark vertical slices
  with provider entries disabled until each invariant is tested.
- **An uncertain attempt can hold credits and provider capacity for a long
  time** → conservative safety, visible status, age alerts and an audited
  reconciliation SLO; never auto-release while an output may still arrive.
- **PostgreSQL spend/capacity rows can become hot** → key windows by
  provider/model/period, keep transactions short and load-test conditional
  claims before increasing concurrency.
- **Some providers have weak idempotency or lookup APIs** → encode support in
  adapter metadata, prefer stronger providers during evaluation and route weak
  outcomes to explicit uncertainty.
- **Provider cost may be estimated rather than reported** → retain source and
  price-snapshot metadata and never label derived cost as provider-reported.
- **Video processing can exhaust worker resources** → S3-only production gate,
  separate worker concurrency, streaming/temp quotas and bounded FFmpeg/FFprobe.
- **Remote output retrieval is an SSRF and decompression risk** → reuse the
  hardened outbound client, revalidate redirects/bytes and independently probe
  content.
- **Object write and database finalize cannot be one transaction** →
  deterministic staging identity, idempotent finalize and a reference-aware
  orphan scanner.
- **The synchronous compatibility endpoint does not gain full async recovery**
  → preserve it without expanding promises; migrate the guided web surface to
  the durable API and deprecate only in a later reviewed change.
- **Legacy prompt purge is irreversible** → bounded dry-run/backfill, drain old
  writers first, monitor completion and document backup retention.
- **Encryption-key loss makes retained input unrecoverable** → use the existing
  key-management/rotation contract and surface decrypt failure as a permanent
  sanitized generation failure, never log ciphertext or keys.
- **Redis loss removes realtime/rate smoothing** → PostgreSQL remains
  authoritative for spend, capacity, idempotency and state; clients recover by
  GET.
- **Future Comfy integration could recreate dual orchestration** → require the
  node-effect token and advisory-executor boundary above in its own OpenSpec
  design and negative tests.

## Migration Plan

1. Land and archive `add-ai-image-quality-modes`; capture the compatibility
   contract in tests.
2. Add contracts, core state machines/ports and pure transition tests with all
   async recipes disabled.
3. Generate additive generation/attempt/output/event/accounting/rollout schema
   and the generation-bound credit-grant extension. Test clean and previous
   schemas in disposable PostgreSQL and verify old application compatibility.
4. Add transactional repositories and test concurrent idempotency, credit
   reservation, spend/capacity claims, fencing and exactly-once finalization.
5. Add the provider package, fake adapter and evaluation harness. Move or wrap
   the OpenAI-compatible image implementation without changing
   `POST /v1/ai/image`.
6. Add pg-boss submission, inspect, callback, cancellation, dispatch recovery
   and ambiguity paths. Keep real provider catalogue entries disabled.
7. Add bounded output ingestion, deterministic staging cleanup, video tooling
   readiness and S3 capability gating.
8. Add authenticated async API/realtime and regenerate the OpenAPI client.
9. Add guided web image flow, deliberate attachment, RBAC and accessibility;
   canary one evaluated image recipe to internal/demo organizations.
10. Add encrypted compatibility prompt fields. Drain old writers, run the
    legacy plaintext backfill in dry-run and bounded mutation modes, then enable
    30-day retention.
11. Evaluate and canary video recipes only on S3-backed environments with media
    tools ready and conservative spend/concurrency ceilings.
12. Run crash-before-enqueue, crash-after-submit, duplicate callback, callback
    loss, uncertain submission, cancellation race, cross-tenant, credit,
    provider-spend, storage and rollback drills.
13. Update architecture/data/operations documentation and `CHANGELOG.md`, then
    expand rollout by organization only after the full gate passes.

Rollback:

1. Set affected recipe activation records to `disabled` and remove asynchronous
   create capability; disable `ai_video` exposure.
2. Keep callback receipt, polling, cancellation, output ingestion, staging
   cleanup and reconciliation running until accepted/uncertain attempts reach
   truthful terminal states.
3. Revert web/API exposure while retaining additive tables, grants, media and
   accounting records. `/v1/ai/image` remains available.
4. Stop new retention/backfill batches if necessary, but do not attempt to
   restore already purged prompt content.
5. Remove new provider configuration only after no active snapshot references
   it. Do not reverse production migrations destructively.

## Security and Authorization Verification

Mandatory negative coverage includes:

- cross-tenant generation, attempt, output, input-media and media-result access;
- member access to another creator's generation and prompt;
- plan/role/capability bypass;
- changed body under the same idempotency key;
- unowned input media or provider/model/price fields supplied by the browser;
- duplicate/stale worker lease and version writes;
- blind retry after uncertain provider acceptance;
- unsigned, expired, replayed, unmatched and cross-provider callbacks;
- callback/provider body, prompt, URL or credential leakage;
- Redis absence during spend/capacity enforcement;
- SSRF, DNS rebinding, redirects, malformed/decompression-bomb and oversized
  output;
- cancellation racing provider completion;
- retention/backfill logging or returning purged content;
- operator reconciliation with stale version, arbitrary URL or mismatched
  provider run.

Tests use fake adapters and controlled fixtures. Automated tests never call
real providers or use committed sandbox credentials.

## Compatibility

- `POST /v1/ai/image` keeps its existing synchronous contract,
  `economy|quality` modes and credit values during this change.
- Existing image configuration remains valid; adapter migration accepts the
  current `AI_IMAGE_*` contract. New native provider configurations are
  explicit and never inherit credentials across unrelated endpoints.
- `ai_image` remains unchanged. `ai_video` is additive and independently
  gated.
- Existing media remains ordinary organization-scoped media. New generation
  output links and encrypted prompt metadata are additive.
- Existing synchronous AI grants keep lease reclamation; only
  generation-bound grants use terminal-state reclamation.
- Old application versions tolerate the additive schema during rolling deploy.
  Prompt backfill waits until old plaintext writers are drained.
- Local storage retains compatible image behavior; video advertises unavailable
  without S3 and media-tool readiness.
- Generated OpenAPI files are regenerated by the repository command and never
  edited manually.
- No new Railway service, ComfyUI, Python, GPU or model-weight dependency is
  introduced.

## Open Questions

None. Provider/model activation, customer-credit values for new recipes and
canary promotion are required catalogue evidence/rollout decisions, not reasons
to weaken or postpone the architectural invariants above.
