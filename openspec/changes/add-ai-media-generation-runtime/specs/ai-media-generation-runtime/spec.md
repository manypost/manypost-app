## ADDED Requirements

### Requirement: Media generation is a durable asynchronous resource

The system SHALL represent every guided image or video generation as a
persisted, organization-scoped resource independent from the initiating HTTP
request. It SHALL use the canonical states `queued`, `submitting`,
`provider_running`, `submission_uncertain`, `ingesting`, `finalizing`,
`cancellation_requested`, `succeeded`, `failed` and `canceled`. Every state
transition SHALL be conditional on the expected persisted version and worker
lease.

`succeeded`, `failed` and `canceled` SHALL be terminal. A duplicate job,
callback, polling result or operator command MUST NOT alter a terminal outcome,
output or settlement.

#### Scenario: Video generation outlives the request

- **WHEN** an authorized video generation is created successfully
- **THEN** the API returns its generation identifier and persisted status without waiting for provider output
- **AND** worker execution can continue after the initiating API process exits

#### Scenario: Stale worker attempts a transition

- **WHEN** a worker writes with an expired lease or older state version
- **THEN** no generation, attempt, output or accounting row changes
- **AND** that worker performs no subsequent provider or storage effect for the lost claim

#### Scenario: Terminal generation receives duplicate work

- **WHEN** a duplicate job, callback, poll result or recovery scan targets a terminal generation
- **THEN** its terminal status, primary output, customer-credit settlement and provider-cost records remain unchanged

### Requirement: Guided operations use immutable provider recipes

The system SHALL support the guided operations `social-image-create`,
`social-image-edit`, `social-video-from-prompt` and
`social-video-from-image`. Every accepted generation SHALL snapshot an active,
evaluated recipe containing the adapter/protocol/model versions, normalized
options, retry behavior, customer-credit maximum, provider-cost ceiling and
output constraints.

The launch runtime SHALL produce exactly one primary user-visible output per
generation. Canonical derivatives such as a video poster thumbnail SHALL belong
to that primary media and MUST NOT be represented or billed as additional
generation outputs.

#### Scenario: Supported guided operation is created

- **WHEN** an authorized caller submits valid inputs and options for a supported guided operation
- **THEN** the generation snapshots the selected immutable recipe and declared charge
- **AND** later catalogue changes do not alter that generation

#### Scenario: Provider catalogue changes during execution

- **WHEN** an operator promotes, disables or rolls back a provider recipe while a generation is active
- **THEN** the active generation continues recovery through its original snapshot
- **AND** only later generations use the new active routing

#### Scenario: Caller requests multiple variants

- **WHEN** a caller requests a batch or more than one user-visible candidate in one generation
- **THEN** the request is refused as unsupported
- **AND** each desired variant must be created as a separately quoted and idempotent generation

#### Scenario: Provider returns multiple candidates

- **WHEN** the snapshotted provider protocol returns more than one candidate
- **THEN** the versioned recipe applies its deterministic primary-selection rule
- **AND** the generation exposes at most one primary output

### Requirement: Authorization, entitlements and tenant scope are independent

The system SHALL derive actor and organization from authenticated Manypost
identity, require `ai_image` for image operations and `ai_video` for video
operations, and prove organization ownership of every referenced media item
before reservation or external work.

An organization member MAY create guided generations allowed by the effective
plan/runtime capability. A member SHALL list, read and cancel only generations
they created; an `ADMIN` or `OWNER` MAY manage every generation in the same
organization. Durable output media SHALL follow the existing organization media
library visibility.

#### Scenario: Image and video are gated independently

- **WHEN** an organization has `ai_image` but not `ai_video`
- **THEN** eligible image operations remain available
- **AND** video creation is refused before credits, capacity or provider cost are reserved

#### Scenario: Referenced media belongs to another organization

- **WHEN** a generation request names input media outside the authenticated organization
- **THEN** the system returns not found without revealing ownership
- **AND** it creates no generation, reservation, queue job or provider submission

#### Scenario: Member accesses another member's generation

- **WHEN** a `MEMBER` reads or cancels a generation created by another actor in the same organization
- **THEN** the system refuses the request without disclosing retained prompt content

#### Scenario: Admin manages organization generation

- **WHEN** an `ADMIN` or `OWNER` reads or cancels a generation in their organization
- **THEN** the command is authorized subject to the generation state

#### Scenario: Generation is accessed across organizations

- **WHEN** any actor reads or cancels a generation belonging to another organization
- **THEN** the system returns not found without revealing that the generation exists

#### Scenario: Browser supplies provider routing

- **WHEN** a request includes provider, model, endpoint, price, tenant or internal recipe fields
- **THEN** the system rejects or ignores them according to the public schema
- **AND** server-owned routing and organization identity remain authoritative

### Requirement: Capabilities, quotes and generation APIs expose stable product contracts

The system SHALL expose authenticated capabilities, quote, create, list, get
and cancel resources for guided media generation. Capability results SHALL
distinguish plan entitlement, configured recipe/infrastructure capability and
temporary operational admission without exposing provider credentials,
wholesale cost or internal topology.

A quote SHALL declare its catalogue revision, expiry and maximum customer
credits but SHALL NOT reserve credits or provider capacity. Creation SHALL
recalculate the current quote and SHALL require the caller's accepted maximum
credits.

All failure responses SHALL use problem+json with stable Manypost error codes
and sanitized details.

#### Scenario: Quote is requested

- **WHEN** an authenticated eligible actor requests a quote for valid guided inputs
- **THEN** the response contains the operation, supported options, catalogue revision, expiry and maximum customer credits
- **AND** no generation, credit reservation or provider-capacity claim is created

#### Scenario: Current quote exceeds accepted maximum

- **WHEN** creation recalculates a maximum credit charge greater than the caller accepted
- **THEN** creation returns a stable quote-conflict problem
- **AND** it creates no reservation, generation or external effect

#### Scenario: Provider capacity is temporarily exhausted

- **WHEN** an entitled/configured operation has no current admission capacity
- **THEN** capability remains distinguishable from permanent unavailability
- **AND** creation returns a retryable capacity problem without choosing an unevaluated fallback

#### Scenario: Realtime delivery is lost

- **WHEN** Redis or SSE does not deliver a generation update
- **THEN** persisted `GET` returns the authoritative current status and output
- **AND** execution and settlement remain unaffected

### Requirement: Creation is transactional, idempotent and recoverable after enqueue failure

`POST /v1/ai/media/generations` SHALL require an idempotency key scoped to the
organization. The system SHALL canonicalize the request and store a keyed
fingerprint. In one PostgreSQL transaction it SHALL reserve customer credits
and create the dispatchable `queued` generation. It SHALL commit that
transaction before enqueueing a pg-boss job.

Jobs SHALL contain only internal generation identity/version and MUST NOT
contain prompts, provider payloads, media URLs, credentials or caller-supplied
tenant identity. A durable scanner SHALL recover a committed queued generation
when initial enqueue is missed.

#### Scenario: Same request is replayed

- **WHEN** the same organization repeats the same idempotency key and canonical request
- **THEN** the original generation is returned
- **AND** no second reservation, generation, queue effect or provider attempt is created

#### Scenario: Same key is reused with another request

- **WHEN** the same organization reuses an idempotency key with a different canonical fingerprint
- **THEN** the request is refused as conflict

#### Scenario: Credit reservation cannot be created

- **WHEN** the organization cannot reserve the current declared maximum
- **THEN** no generation row or queue job is committed
- **AND** no provider spend/capacity is reserved

#### Scenario: Process crashes after commit and before enqueue

- **WHEN** generation and credits commit but the initial pg-boss enqueue does not complete
- **THEN** a scanner detects the persisted queued generation
- **AND** it enqueues a versioned singleton job without creating another credit reservation

#### Scenario: Queue delivers the same job repeatedly

- **WHEN** pg-boss delivers duplicate jobs for the same generation version
- **THEN** at most one worker acquires the conditional execution lease
- **AND** duplicates do not create parallel provider effects

### Requirement: Provider attempts persist identity before external submission

The system SHALL persist a sequential provider attempt, immutable routing
snapshot, random client token, normalized keyed input fingerprint,
provider-cost reservation and outstanding-capacity claim before invoking the
provider.

The adapter SHALL classify submission as `accepted`, `completed`,
`not_created` or `uncertain`. At most one effect-capable attempt SHALL be active
for a generation. A later attempt SHALL be created only after provider truth
proves the previous attempt cannot later produce a duplicate usable output and
the snapshotted retry/cost bounds permit it.

#### Scenario: Provider accepts a run

- **WHEN** provider submission returns a stable run identifier
- **THEN** the identifier is conditionally persisted on the existing attempt
- **AND** polling, callbacks and recovery reconcile that attempt

#### Scenario: Provider completes synchronously

- **WHEN** provider submission returns a completed output reference
- **THEN** the same persisted attempt becomes completed
- **AND** only output ingestion is scheduled

#### Scenario: Provider proves no run was created

- **WHEN** submission returns `not_created`
- **THEN** provider capacity and estimated spend for that attempt are released
- **AND** a later attempt may run only within the immutable retry policy

#### Scenario: Old worker receives provider response after losing lease

- **WHEN** a worker loses its attempt lease before persisting a submission response
- **THEN** its conditional write changes no state
- **AND** recovery reconciles from the already-persisted client token instead of blindly creating another attempt

#### Scenario: Retry limit is exhausted

- **WHEN** a safe transient outcome occurs after the maximum snapshotted attempts
- **THEN** the generation reaches truthful failure without another provider submission

### Requirement: Submission uncertainty never becomes a blind duplicate

When a submission may have been accepted but no stable provider run identity is
known, the attempt and generation SHALL enter `submission_uncertain`. Elapsed
time MUST NOT automatically convert uncertainty to ordinary failure, release
its reservations or authorize a new submission.

Automatic reconciliation SHALL use callback evidence, inspect by run ID,
inspect by client token, or replay with the identical client token only when the
adapter contract proves provider-enforced idempotency.

#### Scenario: Connection is lost during submission

- **WHEN** the provider may have accepted a paid job but the response is lost
- **THEN** the generation enters `submission_uncertain`
- **AND** no retry or fallback creates another paid run
- **AND** a sanitized age alert is emitted

#### Scenario: Client-token inspection finds the run

- **WHEN** automatic reconciliation finds a provider run using the persisted client token
- **THEN** the run ID is attached conditionally to the uncertain attempt
- **AND** normal polling/output recovery resumes

#### Scenario: Provider proves not-created after uncertainty

- **WHEN** authenticated provider evidence proves that the uncertain request created no run
- **THEN** the attempt becomes `not_created`
- **AND** normal bounded retry policy may proceed

#### Scenario: Uncertainty deadline passes without proof

- **WHEN** all automatic reconciliation paths remain inconclusive after the recipe deadline
- **THEN** the generation remains non-terminal and blocked for operational review
- **AND** customer credits, provider spend and outstanding capacity remain conservatively reserved

### Requirement: Operational reconciliation is explicit and audited

The launch system SHALL expose uncertain-attempt reconciliation through a Bun
operational CLI composed from the same core use case and repositories, not
through a public administration endpoint. The command SHALL derive
organization, provider and generation from an opaque attempt ID, require the
expected attempt version and append sanitized `SYSTEM` audit/event evidence for
every mutation.

Allowed mutations SHALL be limited to attaching a verified provider run ID,
confirming provider proof of `not_created`, or confirming terminal
failure/cancellation and provider cost. The command MUST NOT accept an arbitrary
organization ID, provider credential or output URL.

#### Scenario: Operator attaches verified provider run

- **WHEN** an operator supplies an uncertain attempt, expected version, verified run ID and evidence reference
- **THEN** the run ID is attached only if it belongs to the attempt's snapshotted provider
- **AND** normal automated reconciliation resumes
- **AND** a sanitized `SYSTEM` event records the action

#### Scenario: Operator command uses stale version

- **WHEN** reconciliation is attempted after the attempt version changed
- **THEN** no state, reservation or provider identity changes

#### Scenario: Operator supplies arbitrary output URL

- **WHEN** an operator command attempts to inject an output URL or media object
- **THEN** the command is refused
- **AND** output remains obtainable only through the registered provider adapter and ingestion path

### Requirement: Callback, polling and cancellation converge on provider truth

Providers without an authenticated callback contract SHALL use polling only.
For callback-enabled providers, the system SHALL verify the exact raw-body
signature, timestamp and replay window, deduplicate stable event identity and
derive organization/generation from stored attempt mapping. Callback routes
SHALL enqueue reconciliation rather than perform domain transitions directly.

Polling and cancellation SHALL be idempotent and fenced. Cancellation SHALL be
best-effort and SHALL remain non-terminal until provider truth proves
cancellation, failure or completion.

#### Scenario: Valid callback arrives

- **WHEN** a callback passes signature, timestamp and replay validation and maps to a stored attempt
- **THEN** a sanitized provider event is recorded once
- **AND** reconciliation is enqueued for the organization derived from storage

#### Scenario: Callback arrives before submit response is persisted

- **WHEN** a valid callback maps by persisted client token before the API response stores a run ID
- **THEN** the event is retained as bounded sanitized reconciliation evidence
- **AND** later processing converges on the same attempt without another submission

#### Scenario: Invalid or replayed callback arrives

- **WHEN** callback authentication, timestamp or replay validation fails
- **THEN** no generation, attempt, output or accounting state changes
- **AND** raw body, signature material and provider credentials are not logged

#### Scenario: Callback never arrives

- **WHEN** an accepted non-terminal attempt reaches its polling deadline
- **THEN** a worker inspects the stored provider run under a fenced lease

#### Scenario: Cancellation happens before submission

- **WHEN** cancellation is accepted while the generation is still safely pre-submission
- **THEN** the generation becomes `canceled`
- **AND** customer credits and provider reservations are released

#### Scenario: Cancellation races provider completion

- **WHEN** the provider completes before cancellation is confirmed
- **THEN** the system ingests the usable primary output
- **AND** the generation succeeds and settles the disclosed customer credits exactly once

#### Scenario: Cancellation remains uncertain

- **WHEN** the provider cannot confirm whether an accepted run was canceled
- **THEN** the generation remains `cancellation_requested`
- **AND** polling/reconciliation continues without releasing reservations or claiming success

### Requirement: Provider output becomes one validated durable Manypost media

A provider completion SHALL remain advisory until the system obtains the
primary output, applies SSRF/DNS/redirect/time/byte protections, validates
actual content, performs required bounded normalization, stores the final
organization-scoped object and atomically creates media/output metadata and
settlement.

Provider-declared MIME, filenames, dimensions and temporary URLs MUST NOT be
trusted as permanent media facts. Output-processing retries SHALL repeat only
fetch, validation, normalization or storage and MUST NOT resubmit inference.

#### Scenario: Supported image is returned

- **WHEN** the provider returns a valid image within the snapshotted bounds
- **THEN** inspected bytes are stored under the generation organization
- **AND** one ordinary `source='ai'` media record becomes the primary output
- **AND** the provider temporary URL is not used as the media library URL

#### Scenario: Supported video is returned

- **WHEN** the provider returns video within the recipe duration, dimensions and byte limits
- **THEN** bounded FFprobe/FFmpeg processing produces the required canonical media
- **AND** its poster thumbnail is associated with the same primary output

#### Scenario: Video infrastructure is not ready

- **WHEN** S3-compatible storage, private staging or required media tools are unavailable
- **THEN** video capability is reported unavailable before generation creation
- **AND** compatible guided image capability may remain available

#### Scenario: Output is oversized, malformed or unsafe

- **WHEN** fetched content violates network, byte, format or media constraints
- **THEN** no user-visible media/output is committed
- **AND** the provider attempt is not resubmitted
- **AND** customer credits are eventually released while incurred provider cost remains recorded

#### Scenario: Object write succeeds and database finalization fails

- **WHEN** the immutable final object is stored but the final database transaction does not commit
- **THEN** the output remains non-visible and non-terminal
- **AND** retry uses the same allocated object/media identity
- **AND** provider inference is not repeated

#### Scenario: Abandoned staging object is found

- **WHEN** cleanup finds a staging object whose output has no active or durable reference
- **THEN** it deletes the object only after proving that no active ingestion can still finalize it

### Requirement: Customer credits, provider cost and capacity settle independently

The system SHALL reserve the maximum customer credits when the generation is
created and SHALL settle that grant exactly once from generation truth. A
generation-bound reservation MUST NOT be reclaimed by the short lease used for
legacy synchronous AI calls.

Before each external submission, PostgreSQL SHALL conditionally reserve the
attempt's provider monetary-cost ceiling and outstanding-capacity slot.
Provider monetary cost SHALL be recorded for every attempt independently from
customer-credit settlement, including whether actual cost is provider-reported
or derived from the immutable pricing snapshot.

Redis MUST NOT be authoritative for credit, spend, capacity or settlement.

#### Scenario: Usable primary output is finalized

- **WHEN** durable object, media and output records are ready to commit
- **THEN** the customer grant commits no more than its reserved credits exactly once
- **AND** provider cost settles independently
- **AND** the generation becomes `succeeded` in the same database transaction

#### Scenario: Provider bills but no usable output is delivered

- **WHEN** provider cost is incurred and the generation truthfully terminates without usable media
- **THEN** customer credits are released exactly once
- **AND** provider cost remains recorded against the attempt

#### Scenario: Async generation exceeds 180 seconds

- **WHEN** a healthy asynchronous generation runs longer than the legacy reservation lease
- **THEN** its generation-bound customer reservation remains active
- **AND** another credit operation cannot reclaim it solely because time elapsed

#### Scenario: Provider spend circuit is exhausted

- **WHEN** the provider, organization or global spend window cannot reserve another attempt ceiling
- **THEN** no new paid submission starts
- **AND** callbacks, polling, cancellation, output ingestion and reads remain available

#### Scenario: Redis is unavailable

- **WHEN** Redis coordination is absent or loses state
- **THEN** PostgreSQL still prevents exceeding customer credits, provider spend and outstanding capacity
- **AND** no paid-effect safety check fails open

#### Scenario: Uncertain attempt consumes capacity

- **WHEN** an attempt remains `submission_uncertain` or cancellation-pending
- **THEN** it continues occupying estimated provider spend and outstanding capacity
- **AND** only truthful reconciliation releases or settles those claims

### Requirement: Generation content is encrypted and purged after 30 days

The system SHALL encrypt canonical prompts, options, input-media references and
short-lived provider output locators at rest through the existing
`CryptoService`. Jobs, logs, metrics, audit details and provider events MUST NOT
contain that content, signed URLs, credentials or raw provider bodies.

Content-bearing runtime fields SHALL expire no later than 30 days after
generation creation. Provider output locators SHALL be cleared earlier when
ingestion or terminal no-output resolution makes them unnecessary.
Non-content operation, recipe/model, output-media link, synthetic provenance,
actor/audit identity, accounting and sanitized transition history MAY remain
according to policy.

#### Scenario: Generation input is persisted

- **WHEN** a valid generation is created
- **THEN** its canonical content is encrypted before persistence
- **AND** the queue contains only internal identifiers

#### Scenario: Creator reads retained input

- **WHEN** the creator or an organization `ADMIN`/`OWNER` reads a generation before content expiry
- **THEN** authorized retained input may be decrypted for that response
- **AND** list responses remain content-free

#### Scenario: Retention deadline passes

- **WHEN** content-bearing generation data is older than 30 days
- **THEN** the retention worker irreversibly clears it from application records
- **AND** status, non-content provenance, output link and accounting remain usable

#### Scenario: Purged input is requested

- **WHEN** an authorized caller reads a generation whose content expired
- **THEN** the response indicates that content is no longer retained
- **AND** no backup, log or provider payload is used to reconstruct it

#### Scenario: Legacy plaintext prompt is backfilled

- **WHEN** old application writers are drained and a legacy
  `media.generation_prompt` is newer than 30 days
- **THEN** bounded backfill encrypts it into compatibility retention metadata
- **AND** nulls the plaintext without logging its value

#### Scenario: Legacy plaintext prompt is already expired

- **WHEN** backfill finds a legacy plaintext prompt older than 30 days
- **THEN** it nulls the plaintext without copying it into retained ciphertext

#### Scenario: Request fingerprint is retained

- **WHEN** content is purged but idempotency/audit fingerprint remains
- **THEN** it is a keyed canonical digest rather than a plain prompt hash

### Requirement: Operations are observable without content or unbounded labels

The system SHALL preserve request/correlation identity and emit bounded
metrics/events for operation, status, recipe, adapter/model recipe, submission
outcome, uncertainty, cancellation, credit settlement, provider cost/capacity,
ingestion and retention. IDs, prompts, URLs, provider bodies, media bytes and
credentials MUST NOT be metric labels or log content.

Alerts SHALL cover stale dispatch/execution/finalization, uncertainty age,
reservation age, callback authentication failures, provider outage/price
drift, spend/capacity exhaustion, ingestion failure, media-tool readiness and
retention backlog.

#### Scenario: Operator diagnoses slow generation

- **WHEN** telemetry for generation latency is inspected
- **THEN** it is grouped by bounded operation/status/recipe/adapter dimensions
- **AND** organization, actor, generation, attempt and content values are absent from labels

#### Scenario: Uncertain generation ages

- **WHEN** a `submission_uncertain` generation exceeds its reconciliation SLO
- **THEN** an alert links to sanitized read-only diagnostics and the operational reconciliation runbook

#### Scenario: Sensitive provider failure occurs

- **WHEN** a provider returns a body containing submitted content or credentials
- **THEN** logs and public problems contain only the normalized sanitized error class/code

### Requirement: Provider recipes require evidence, canary and rollback

The system SHALL evaluate candidate provider/model recipes against versioned
Manypost image/video briefs and a repeatable rubric covering capability,
quality, typography, reference fidelity, motion, moderation, latency, failure
classification, ambiguous submission, cancellation, output retention,
commercial rights and provider cost.

No recipe SHALL become active without immutable protocol/pricing versions,
configured spend/capacity ceilings, recorded review, canary scope and a rollback
predecessor. Activation state SHALL be
`disabled`, `canary` or `active`.

#### Scenario: Candidate recipe is evaluated

- **WHEN** a provider/model endpoint is considered for activation
- **THEN** it is tested against the same versioned fixtures and rubric as the current recipe
- **AND** evidence records quality, behavior, rights, retention, latency, failure and cost

#### Scenario: Canary recipe is requested outside allowlist

- **WHEN** an organization outside the canary scope requests an operation
- **THEN** the canary recipe is not selected

#### Scenario: Provider price or protocol drifts

- **WHEN** runtime evidence no longer matches the activated pricing/protocol snapshot
- **THEN** new generation creation through that recipe is disabled
- **AND** already accepted generations continue reconciliation through their immutable snapshots

#### Scenario: Production thresholds are breached

- **WHEN** an active recipe breaches configured quality, failure, latency or cost thresholds
- **THEN** new generations roll back to the reviewed predecessor or become unavailable
- **AND** no unevaluated provider fallback is selected

### Requirement: Compatibility generation remains separate from async resources

The system SHALL preserve the existing synchronous `POST /v1/ai/image`
request/response contract, `economy|quality` behavior, credit values and
idempotency semantics during this change. New guided clients SHALL use durable
generation identifiers and MUST deliberately attach completed media to composer
drafts.

The compatibility endpoint MUST NOT be represented as having the recovery
guarantees of the asynchronous runtime. Moving its concrete provider adapter
MUST NOT change its public contract or permit credential inheritance across
unrelated provider endpoints.

#### Scenario: Existing image client calls compatibility endpoint

- **WHEN** a valid existing client calls `POST /v1/ai/image`
- **THEN** it receives the same synchronous media response and mode credit behavior

#### Scenario: Guided async generation completes

- **WHEN** a new guided generation reaches `succeeded`
- **THEN** its primary output appears as ordinary organization-scoped AI media
- **AND** no composer draft, schedule or publication changes until an authorized person explicitly attaches it

#### Scenario: Compatibility endpoint times out

- **WHEN** the existing synchronous provider call times out
- **THEN** the endpoint follows its existing sanitized failure behavior
- **AND** the system does not falsely claim that an asynchronous generation will recover it
