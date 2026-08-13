## MODIFIED Requirements

### Requirement: Model provider selection is single-sourced and vendor-opaque

The system SHALL derive text, vision, synchronous-image and managed-media
provider composition from one environment/configuration mapping shared by every
API and worker process. Managed media MAY register multiple evaluated
adapter/recipe entries, but activation and routing SHALL remain server-owned;
no browser request, queue payload or provider callback may select an endpoint,
credential, model, price or tenant.

Selecting a provider SHALL name the protocol spoken, not the company that
publishes the model, so that changing vendor within a compatible protocol
remains a configuration/catalogue change. Vendor-specific names, SDK types,
request fields and status values SHALL remain inside the relevant adapter
directory.

A provider's vocabulary of image sizes remains adapter detail: callers SHALL
express shape through the closed Manypost aspect-ratio set, and the adapter
SHALL translate it to provider dimensions. No use case, route, public contract
or provider-neutral port SHALL name a vendor pixel preset. Adapters MUST omit
unsupported optional request parameters and parse only response forms declared
by their registered protocol/recipe.

#### Scenario: No provider configured by default

- **WHEN** the environment does not activate any model or managed-media provider
- **THEN** the resolved composition selects no adapter
- **AND** the installation reports the corresponding AI capabilities unavailable

#### Scenario: Adapter is selected by protocol

- **WHEN** configuration names a supported protocol together with its required base URL and model and an optional credential
- **THEN** the resolved composition selects the adapter for that protocol
- **AND** API and dedicated worker resolve the same protocol, endpoint, model and recipe mapping

#### Scenario: Multiple evaluated media recipes are active

- **WHEN** the server catalogue activates more than one image/video recipe
- **THEN** each recipe resolves through the single shared configuration mapping
- **AND** product routing selects only among server-owned active entries

#### Scenario: Switching vendor without code change

- **WHEN** base URL and model are changed to another vendor that implements the same registered protocol
- **THEN** generation continues without changing core, route or browser code
- **AND** a managed-media recipe still requires evaluation, pricing version and activation evidence before serving traffic

#### Scenario: Vendor names stay inside adapter boundaries

- **WHEN** the repository is scanned for vendor-specific implementation names or types outside adapter/configuration boundaries
- **THEN** none appears in core use cases, public routes, contracts or web code

#### Scenario: Image shape is requested as a ratio

- **WHEN** an image operation requests a supported aspect ratio
- **THEN** the adapter chooses provider-native dimensions
- **AND** the aspect ratio, not a vendor resolution preset, crosses the provider-neutral port

#### Scenario: Image request uses only supported parameters

- **WHEN** an adapter submits one image through a registered protocol recipe
- **THEN** its outbound body contains only fields supported by that protocol/recipe
- **AND** it reads only a declared result form

#### Scenario: Caller attempts to override routing

- **WHEN** a public request includes provider, model, endpoint, price or credential fields
- **THEN** schema validation refuses or excludes those fields
- **AND** server-owned recipe routing remains unchanged

### Requirement: Provider configuration fails closed at boot

The system SHALL refuse to start when a legacy selected provider or an active
managed-media recipe lacks a required setting. The error SHALL name only the
missing environment variable or catalogue field and MUST NOT print, log or
embed credential values, configured endpoints containing secrets, or provider
response bodies.

Disabled/canary-ineligible recipes MAY remain unconfigured without making
unrelated AI capabilities unavailable. Explicit partial configuration MUST fail
closed rather than inherit a credential from another endpoint. API and worker
SHALL use the same validated mapping.

#### Scenario: Protocol is selected without a model

- **WHEN** a provider protocol is selected and its required model variable is absent
- **THEN** startup fails with a message naming the missing model variable

#### Scenario: Protocol is selected without a base URL

- **WHEN** a provider protocol is selected and its required base URL variable is absent
- **THEN** startup fails with a message naming the missing base URL variable
- **AND** no configured value appears in the message

#### Scenario: Active media recipe lacks a credential

- **WHEN** an active recipe requires a credential and its dedicated variable is absent
- **THEN** the process that could execute that recipe fails readiness/startup
- **AND** the error names only the missing variable

#### Scenario: Disabled media recipe is unconfigured

- **WHEN** a disabled recipe has no endpoint or credential configuration
- **THEN** unrelated configured providers can start
- **AND** that recipe is not advertised or routable

#### Scenario: Explicit media endpoint lacks its dedicated key

- **WHEN** a media provider endpoint is configured independently but its dedicated credential is absent
- **THEN** startup fails closed
- **AND** it does not inherit the text, image or another media-provider credential

#### Scenario: Protocol requires no credential

- **WHEN** a supported protocol is configured with its required base URL and model but declares no credential requirement
- **THEN** startup succeeds
- **AND** outbound requests carry no authorization header

#### Scenario: API and worker configuration drift

- **WHEN** API and worker do not resolve the same active recipe/protocol version
- **THEN** media capability readiness fails
- **AND** no new generation is submitted through that inconsistent recipe

### Requirement: Every model call is bounded in time and output

The system SHALL bound every text, vision, synchronous-image and managed-media
provider call by configured time, request and output limits. Text calls SHALL
cap generated tokens. Managed-media recipes SHALL cap input count/bytes,
requested output count, image/video dimensions, video duration and provider
retention deadlines.

A timeout SHALL be classified according to the operation's external-effect
semantics. Timeout of a read-only inspect/fetch operation MAY be retried as the
same operation. Timeout of media submit after possible provider acceptance MUST
become `submission_uncertain` unless the adapter has proof that no run was
created or provider-enforced replay with the identical client token is safe.

#### Scenario: Synchronous text upstream does not answer in time

- **WHEN** a text/vision provider does not respond within its configured timeout
- **THEN** the call is aborted
- **AND** the caller receives a sanitized provider failure rather than a hanging request

#### Scenario: Text output cap is always sent

- **WHEN** a text generation is requested
- **THEN** the request carries a maximum output size no larger than the configured token cap

#### Scenario: Managed-media submission times out ambiguously

- **WHEN** a submit call reaches its timeout after the provider may have accepted the job
- **THEN** the adapter reports `uncertain`
- **AND** the runtime does not convert the timeout into a generic retryable failure

#### Scenario: Provider proves timeout occurred before creation

- **WHEN** a timed-out submit can prove from protocol evidence that no external run was created
- **THEN** the adapter reports `not_created`
- **AND** bounded retry policy may apply

#### Scenario: Read-only inspection times out

- **WHEN** inspect, polling or output lookup times out for a persisted provider run
- **THEN** recovery may repeat that same read-only operation
- **AND** it does not submit another generation

#### Scenario: Media request exceeds recipe bounds

- **WHEN** normalized input or requested output constraints exceed the active recipe envelope
- **THEN** validation fails before provider submission
- **AND** no customer or provider reservation is consumed by that request

### Requirement: Provider failures are classified, never surfaced raw

The system SHALL translate provider outcomes into stable domain classifications
and MUST NOT expose raw provider response bodies, endpoints, credentials,
submitted content or vendor-native error wording.

Synchronous legacy calls SHALL preserve their existing sanitized
retryable/non-retryable behavior. Managed-media adapters SHALL additionally
distinguish configuration failure, refreshable authentication failure,
moderation refusal, permanent request failure, transient failure with proof of
`not_created`, accepted/running, terminal provider failure,
`submission_uncertain` and invalid output.

An HTTP status, socket error or generic provider 5xx MUST NOT by itself be proof
that a paid media run was not created.

#### Scenario: Upstream rejects a credential

- **WHEN** a provider reports that its credential is invalid, expired or forbidden
- **THEN** the adapter emits a stable authentication classification
- **AND** the public response contains no credential, endpoint or vendor-native body

#### Scenario: Refreshable authentication fails

- **WHEN** a registered adapter supports server-side credential refresh and receives the matching authentication classification
- **THEN** it may perform one bounded refresh path under adapter policy
- **AND** it MUST NOT replay an ambiguous paid submission unless client-token idempotency proves that safe

#### Scenario: Rate limit proves no media run was created

- **WHEN** a provider rejects media submission before creation with an authenticated rate-limit response
- **THEN** the adapter emits `not_created` with bounded retry timing

#### Scenario: Server failure has ambiguous acceptance

- **WHEN** media submission receives a disconnect or provider failure that does not prove whether a run was created
- **THEN** the adapter emits `uncertain`
- **AND** the runtime does not expose it as an ordinary retryable provider error

#### Scenario: Provider returns moderation refusal

- **WHEN** the provider refuses submitted content under moderation policy
- **THEN** the adapter emits a stable non-retryable moderation classification
- **AND** raw provider wording and submitted content are not exposed

#### Scenario: Provider run terminates without output

- **WHEN** inspection proves an accepted run ended in provider failure
- **THEN** the adapter emits a terminal provider-failure snapshot
- **AND** any later attempt is decided by the snapshotted core retry/cost policy

#### Scenario: Response is not usable

- **WHEN** a provider reports success but its response/output cannot satisfy the registered contract
- **THEN** the adapter emits an invalid-output classification distinct from provider unavailability
- **AND** raw payload is not returned or logged

#### Scenario: Legacy synchronous provider is unavailable

- **WHEN** a synchronous text/image provider returns a proven rate-limit or availability failure
- **THEN** its existing caller receives the stable sanitized provider failure and retryability metadata

## ADDED Requirements

### Requirement: Managed media adapters implement one registered lifecycle contract

Third-party image/video APIs SHALL integrate through registered server-side
adapters that implement the provider-supported subset of `submit`, `inspect`,
`cancel` and `fetchOutput`. The adapter boundary SHALL translate
provider-native request fields, statuses, errors, pricing evidence and output
references into provider-neutral Manypost types.

`submit` SHALL return exactly one of `accepted`, `completed`, `not_created` or
`uncertain`. An adapter MUST NOT claim an operation, inspection, callback,
cancellation or output transport capability that the provider protocol and
activated recipe do not support.

#### Scenario: Direct media API recipe is selected

- **WHEN** a generation resolves an active registered media recipe
- **THEN** API and worker resolve the same adapter/protocol/model recipe snapshot
- **AND** no endpoint or credential is accepted from the browser or job payload

#### Scenario: Provider completes during submission

- **WHEN** a provider returns a valid completed output in the submit response
- **THEN** the adapter reports `completed` with one provider-neutral output reference
- **AND** the runtime schedules ingestion without polling or resubmitting

#### Scenario: Provider accepts asynchronous work

- **WHEN** the provider returns a stable run identity
- **THEN** the adapter reports `accepted` with that identity
- **AND** later inspect/cancel/fetch calls require the persisted identity

#### Scenario: Adapter lacks an operation

- **WHEN** a recipe requests image editing, text-to-video or image-to-video unsupported by its adapter
- **THEN** catalogue activation fails closed
- **AND** the unsupported operation is not advertised

#### Scenario: Adapter lacks cancellation

- **WHEN** cancellation is requested for a provider that does not support cancellation
- **THEN** the adapter reports cancellation unsupported without claiming terminal cancellation
- **AND** normal inspection continues until provider truth is terminal

### Requirement: Recipe capabilities expose only reviewed provider behavior

Each managed-media recipe SHALL declare its supported product operation,
typed option bounds, output constraints, provider retention, customer-credit
maximum, provider-cost ceiling/pricing date, idempotency/lookup semantics,
callback/poll/cancel behavior, moderation/rights review, activation state and
rollback predecessor.

The capability catalogue MUST NOT advertise LoRA, ControlNet, IP-Adapter, seed,
sampler, reference control or any other advanced field merely because the
underlying protocol uses similar vocabulary. Such a field requires explicit
adapter support and a separately reviewed capability change.

#### Scenario: Supported options are advertised

- **WHEN** an organization reads media capabilities
- **THEN** it receives only product operations and typed options supported by an active eligible recipe
- **AND** provider-native implementation fields remain hidden

#### Scenario: Unsupported advanced control is supplied

- **WHEN** a request includes an advanced field absent from the activated recipe schema
- **THEN** schema/capability validation refuses it before quote or submission

#### Scenario: Recipe lacks commercial or retention review

- **WHEN** provider/model behavior is technically reachable but required rights, retention or pricing evidence is absent
- **THEN** that recipe cannot become canary or active

#### Scenario: Canary recipe is resolved

- **WHEN** a canary organization requests a supported operation
- **THEN** routing may select the immutable canary recipe
- **AND** an organization outside its allowlist cannot select it

### Requirement: Routing and provider identity are snapshotted before paid execution

The system SHALL select and persist one approved adapter/model/recipe snapshot
when the generation is created and SHALL persist a server-generated client
token before provider submission. It MUST NOT silently move an existing
generation or attempt to another provider, model, protocol or price tier.

Health, price or activation changes MAY affect quoting and creation of later
generations. An existing generation SHALL use only the safe retry behavior and
route encoded by its snapshot.

#### Scenario: Provider is unhealthy before generation creation

- **WHEN** current health excludes the preferred recipe before quote/create
- **THEN** the server may quote another already active evaluated recipe
- **AND** it recalculates customer credits before acceptance

#### Scenario: Provider becomes unhealthy after generation creation

- **WHEN** a generation already snapshots a recipe and that provider becomes unhealthy before submit
- **THEN** the generation waits, safely fails or follows its own snapshotted policy
- **AND** it does not silently switch provider/model/price

#### Scenario: Provider may have accepted the attempt

- **WHEN** submission outcome is ambiguous
- **THEN** the attempt remains bound to its persisted adapter/client token
- **AND** automatic fallback does not create another provider run

#### Scenario: Recipe is rolled back

- **WHEN** an operator activates the reviewed predecessor recipe
- **THEN** new generations use the predecessor
- **AND** accepted generations retain their original adapter/protocol snapshot for recovery

### Requirement: Adapter idempotency and lookup claims are explicit

Every adapter SHALL declare whether its provider enforces idempotent submit with
the supplied client token and whether it can inspect by client token before a
provider run ID is known. Core recovery MUST treat an undeclared or unverified
claim as unsupported.

Repeating `submit` SHALL be allowed only with the exact persisted client token
and canonical input and only when the adapter contract proves provider-enforced
idempotency. Otherwise an ambiguous outcome SHALL remain
`submission_uncertain`.

#### Scenario: Provider enforces client-token idempotency

- **WHEN** recovery repeats submit through an adapter whose activated protocol proves idempotency
- **THEN** it uses the exact persisted client token and canonical request
- **AND** the provider returns or reconciles the same external effect

#### Scenario: Provider does not support idempotent submit

- **WHEN** submit outcome is ambiguous and the adapter lacks verified client-token idempotency
- **THEN** recovery does not call submit again
- **AND** it uses supported lookup/evidence or leaves the attempt uncertain

#### Scenario: Client token is reused with changed input

- **WHEN** an adapter invocation attempts the persisted client token with a different canonical fingerprint
- **THEN** the execution is refused as conflict before any provider call

#### Scenario: Provider can inspect by client token

- **WHEN** a submission response is lost before a run ID is stored
- **THEN** recovery may inspect with the persisted client token
- **AND** a found run is attached to the original attempt

### Requirement: Callback, polling and cancellation capabilities are truthful

A recipe SHALL enable callbacks only when the adapter can authenticate callback
integrity and map stable event/run/client-token identity. Providers without such
a callback contract SHALL be polling-only. Callback parsing SHALL produce a
sanitized provider-neutral event and SHALL NOT perform generation settlement in
the HTTP adapter.

Inspection, cancellation and output lookup SHALL be safe to repeat against the
same persisted run identity. An unsupported or inconclusive cancellation MUST
NOT be reported as terminal cancellation.

#### Scenario: Callback-enabled provider is configured

- **WHEN** a recipe enables provider callbacks
- **THEN** the adapter declares signature, timestamp/replay and event-identity validation
- **AND** readiness fails if required callback authentication configuration is absent

#### Scenario: Provider has no authenticated callback

- **WHEN** an adapter cannot authenticate callback integrity
- **THEN** its active recipe is configured as polling-only
- **AND** no unauthenticated callback route can change generation state

#### Scenario: Duplicate provider event is parsed

- **WHEN** the adapter receives the same authenticated provider event again
- **THEN** it produces the same stable event identity
- **AND** persistence can deduplicate the event before reconciliation

#### Scenario: Cancellation response is inconclusive

- **WHEN** provider cancellation does not prove canceled, failed or completed
- **THEN** the adapter returns a non-terminal cancellation result
- **AND** the runtime continues inspection without releasing reservations

### Requirement: Managed media output references are ephemeral and untrusted

Adapters SHALL return provider-neutral output references, never a permanent
Manypost media path. Output references SHALL declare the transport required,
expiry when known and any provider-reported metadata, but downstream ingestion
MUST independently enforce network, byte and content constraints.

An adapter MUST NOT receive broad object-storage credentials. Input transport
SHALL use bounded bytes/streams or a short-lived signed reference supplied by
the storage composition.

#### Scenario: Provider returns a temporary URL

- **WHEN** an adapter maps a provider output URL
- **THEN** it marks the reference as ephemeral with known expiry when available
- **AND** it does not expose that URL as durable media

#### Scenario: Provider metadata conflicts with bytes

- **WHEN** provider MIME, dimensions or filename disagree with fetched content
- **THEN** ingestion trusts independent inspection rather than adapter metadata

#### Scenario: Provider requires input URL

- **WHEN** an active recipe requires URL-based media input
- **THEN** the adapter receives only a short-lived scoped staging URL
- **AND** it receives no bucket credential or stable public-library authority

### Requirement: Launch media inference uses approved external APIs only

The managed-media registry in this change MUST NOT route inference through
Comfy Cloud, RunPod, local model weights, CUDA, a GPU worker or any self-hosted
model runtime. All launch inference SHALL occur through evaluated third-party
API adapters.

This restriction does not prevent a later reviewed workflow runtime from using
an ephemeral DAG executor above the managed-media port; such an executor SHALL
not become a provider credential, billing or durable-effect authority.

#### Scenario: Local model execution is requested

- **WHEN** configuration or a request attempts to select a local checkpoint, sampler or GPU inference backend
- **THEN** no registered launch recipe accepts it
- **AND** media capability remains unavailable for that request

#### Scenario: Comfy Cloud is proposed as a provider route

- **WHEN** a catalogue entry attempts to make Comfy Cloud a launch inference dependency
- **THEN** activation is refused by this change's provider policy

#### Scenario: Future execution backend is proposed

- **WHEN** a future change proposes managed GPU, local inference or another durable execution backend
- **THEN** it requires its own OpenSpec security, cost, deployment and rollback review
- **AND** existing API-backed adapter contracts remain compatible
