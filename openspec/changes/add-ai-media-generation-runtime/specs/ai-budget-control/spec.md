## MODIFIED Requirements

### Requirement: No model call happens outside the budget guard

The system SHALL reserve customer allowance before calling a synchronous model
or accepting an asynchronous media generation for dispatch. Every reservation
SHALL resolve exactly once by committing customer consumption or releasing it.
A code path that reaches a model/provider submit without the required
reservation is a defect.

Synchronous calls SHALL preserve immediate commit/release behavior.
Asynchronous media SHALL bind the reservation to its durable generation:
delivery of one usable primary output commits the declared actual customer
credits, while a truthful terminal outcome with no usable primary output
releases them. `submission_uncertain` and inconclusive cancellation MUST keep
the reservation unresolved because a paid output may still arrive.

Provider monetary exposure SHALL be reserved and settled independently from
customer credits.

#### Scenario: Successful synchronous generation commits what it used

- **WHEN** a synchronous generation is requested and the model returns a usable answer
- **THEN** a customer reservation existed before the call
- **AND** it commits exactly once with the applicable actual consumption

#### Scenario: Failed synchronous generation releases the reservation

- **WHEN** a synchronous model call fails or times out under its existing safe failure contract
- **THEN** its customer reservation is released
- **AND** the organization's remaining allowance is what it was before the request

#### Scenario: Unusable synchronous answer does not charge the organization

- **WHEN** a synchronous model answers but the result cannot be used
- **THEN** its customer reservation is released rather than committed

#### Scenario: Asynchronous generation is accepted

- **WHEN** a valid asynchronous media generation is created
- **THEN** its maximum customer credits are reserved in the same transaction as the generation
- **AND** no provider submission occurs before that transaction commits

#### Scenario: Asynchronous output becomes usable

- **WHEN** the generation's primary object, media and output metadata are ready for durable finalization
- **THEN** the generation-bound reservation commits exactly once in the same finalization transaction
- **AND** committed customer credits do not exceed the reserved maximum

#### Scenario: Asynchronous generation ends without usable output

- **WHEN** provider truth and ingestion state prove that a generation terminated with no usable primary output
- **THEN** its customer reservation is released exactly once
- **AND** provider cost already incurred remains separately recorded

#### Scenario: Submission remains uncertain

- **WHEN** a provider may have accepted an asynchronous paid submission
- **THEN** the customer reservation remains unresolved
- **AND** elapsed time alone does not release it or authorize another paid submit

#### Scenario: Duplicate settlement path runs

- **WHEN** callback, polling and recovery all attempt to settle the same generation
- **THEN** only the first conditional terminal transition changes customer and provider ledgers
- **AND** later attempts are no-ops

### Requirement: An unresolved reservation is reclaimed

The system SHALL retain lease reclamation for legacy synchronous reservations,
so a process that dies during a bounded synchronous call cannot permanently
reduce allowance.

A generation-bound asynchronous reservation SHALL NOT expire or be reclaimed
solely by wall-clock time. Recovery SHALL inspect the persisted generation and
may release that reservation only when a conditional transaction proves the
generation is safely abandoned before provider submission or is truthfully
terminal with no usable output. Accepted, `submission_uncertain`,
`cancellation_requested`, ingesting and finalizing generations SHALL retain
their reservations.

#### Scenario: Synchronous process dies after reserving

- **WHEN** a legacy synchronous reservation exists whose lease expired
- **AND** the same organization requests another credit reservation
- **THEN** the expired synchronous reservation is released before the new one is evaluated
- **AND** the released amount becomes available again

#### Scenario: Process dies after async commit and before enqueue

- **WHEN** a generation-bound reservation and queued generation committed but initial enqueue was missed
- **THEN** recovery re-enqueues the persisted generation
- **AND** it does not reclaim or recreate the customer reservation

#### Scenario: Async generation is provably abandoned before submission

- **WHEN** recovery conditionally proves that a queued generation can no longer be dispatched and no provider attempt reached submission
- **THEN** it may terminally fail/cancel the generation and release the associated reservation once

#### Scenario: Async generation exceeds the synchronous lease

- **WHEN** a healthy video generation remains active longer than the legacy lease duration
- **THEN** its generation-bound reservation remains reserved
- **AND** another allowance operation cannot reclaim it because time elapsed

#### Scenario: Uncertain attempt remains unresolved

- **WHEN** a generation is `submission_uncertain` after its automatic reconciliation deadline
- **THEN** its customer reservation remains held for audited operator resolution

#### Scenario: Resolution is idempotent

- **WHEN** an already committed or released reservation receives the same resolution again
- **THEN** customer used/reserved balances remain unchanged

#### Scenario: A reclaimed synchronous reservation cannot be committed later

- **WHEN** a legacy synchronous reservation was released because its lease expired
- **AND** the original request later tries to commit it
- **THEN** the late commit does not consume allowance

#### Scenario: Generation crosses an allowance-period boundary

- **WHEN** an asynchronous generation remains active after the monthly period in which it reserved credits ends
- **THEN** its reservation remains associated with the original period bucket
- **AND** terminal commit/release settles that original bucket without changing the new period's grant

### Requirement: Self-hosted installations record without refusing

The system SHALL apply customer reservation and consumption accounting in every
installation. Managed plan allowance numbers SHALL be enforced only where plan
policy is enforced; a self-hosted installation MUST NOT be refused because its
commercial customer-credit allowance is exhausted.

Provider monetary spend ceilings, outstanding provider capacity and
infrastructure readiness are operational safety controls rather than managed
plan allowance. They SHALL remain enforceable in self-hosted installations
when configured and MUST NOT fail open merely because commercial plan
enforcement is disabled.

#### Scenario: Self-hosted customer-credit reservation

- **WHEN** an installation that does not enforce managed plans creates a generation
- **THEN** the customer-credit reservation is granted regardless of commercial allowance
- **AND** its consumption is still recorded for operator telemetry

#### Scenario: Self-hosted provider spend ceiling is reached

- **WHEN** a self-hosted installation reaches its configured provider monetary ceiling
- **THEN** no new paid provider attempt starts
- **AND** existing accepted attempts continue reconciliation and ingestion

#### Scenario: Self-hosted capacity is exhausted

- **WHEN** a self-hosted installation reaches configured outstanding provider capacity
- **THEN** new attempts wait or receive a retryable capacity outcome
- **AND** customer-plan bypass does not create additional provider effects

### Requirement: Consumption is recorded per operation

The system SHALL record customer-credit consumption by organization, product
operation, estimate, outcome and applicable token/credit usage. That
customer-facing ledger MUST NOT contain prompt/generated content, credentials,
raw provider identity or provider response bodies.

Managed-media provider monetary accounting SHALL be a separate operator ledger
keyed by generation attempt and immutable adapter/model recipe. It SHALL record
estimated/reserved and actual monetary amounts as integers with explicit
currency and scale, plus whether actual cost is provider-reported or derived
from the pricing snapshot. It MUST NOT contain submitted/generated content,
signed URLs, credentials or raw provider payloads.

Operations SHALL use customer-credit classes that reflect product cost. Image
and video recipes SHALL declare their own credit values rather than being
charged as text. One media generation SHALL produce and charge at most one
primary output.

#### Scenario: Operator inspects customer consumption

- **WHEN** an authorized operator reads customer-credit records for an organization
- **THEN** each record identifies the product operation and customer credits/tokens consumed
- **AND** it does not expose provider wholesale accounting

#### Scenario: Operator inspects provider monetary cost

- **WHEN** an authorized operator reads provider-cost records
- **THEN** each attempt identifies its immutable adapter/model recipe, currency, integer amount/scale and cost source
- **AND** customer-facing responses do not expose that wholesale cost

#### Scenario: Records carry no content and no secret

- **WHEN** any customer or provider accounting record is written
- **THEN** it contains no prompt, generated content, media URL, credential or raw provider body

#### Scenario: Image costs more than a caption

- **WHEN** an image generation and a caption generation are recorded under their active product pricing
- **THEN** each uses its declared cost class rather than treating the image as one text generation

#### Scenario: Video recipe declares its own charge

- **WHEN** a video recipe is activated
- **THEN** its supported duration/quality options declare bounded customer credits and provider-cost ceilings

#### Scenario: One generation produces one primary output

- **WHEN** an image or video generation succeeds
- **THEN** exactly one primary output is committed and charged
- **AND** a poster thumbnail or canonical derivative creates no second customer charge

## ADDED Requirements

### Requirement: Media quotes bind maximum customer credits to an immutable recipe

The system SHALL calculate media quote credits from the active immutable recipe
and normalized cost-affecting options. A quote SHALL include its catalogue
revision and expiry but SHALL NOT reserve allowance. Generation creation SHALL
recalculate the quote, require the caller's accepted maximum credits and
snapshot the resulting recipe/charge.

The browser MUST NOT supply provider price, wholesale cost, exchange rate,
credit conversion or a lower server rate.

#### Scenario: Video duration changes declared customer credits

- **WHEN** a caller selects a supported video duration or quality option
- **THEN** the server computes maximum customer credits from the active versioned recipe
- **AND** the quote remains bounded to one primary output

#### Scenario: Quote does not reserve allowance

- **WHEN** an eligible actor requests a media quote but creates no generation
- **THEN** customer used/reserved balances remain unchanged

#### Scenario: Current charge exceeds caller acceptance

- **WHEN** generation creation recalculates credits above the maximum the caller accepted
- **THEN** creation fails with a stable quote-conflict problem
- **AND** no customer reservation, provider spend or capacity is claimed

#### Scenario: Browser supplies provider price

- **WHEN** a creation request includes a provider rate or wholesale-cost field
- **THEN** the field is rejected or excluded by the public schema
- **AND** server-owned pricing remains authoritative

#### Scenario: Recipe price version drifts

- **WHEN** provider price evidence no longer matches the active recipe ceiling
- **THEN** new affected quotes/generations fail closed until a reviewed recipe is activated
- **AND** existing generations retain their persisted customer reservation and provider-cost snapshot

### Requirement: Provider spend and outstanding capacity are claimed atomically

Before each managed-media submit, the system SHALL use PostgreSQL conditional
operations to reserve the attempt's maximum monetary exposure and one
outstanding slot for its adapter/model capacity key. It SHALL also enforce
configured organization and global provider spend windows.

Accepted, `submission_uncertain` and cancellation-pending attempts SHALL retain
their estimated spend and capacity claims until provider truth is known. A
proven `not_created` outcome SHALL release both; terminal provider outcomes
SHALL settle monetary cost and release capacity exactly once.

Redis MAY smooth admission or realtime but MUST NOT authorize paid effects or
be the source of spend/capacity truth.

#### Scenario: Spend and capacity are available

- **WHEN** a prepared attempt fits all configured spend windows and outstanding-capacity limits
- **THEN** PostgreSQL atomically claims estimated spend and one capacity slot before submit

#### Scenario: Concurrent attempts reach provider capacity

- **WHEN** concurrent workers compete for the final provider capacity slot
- **THEN** at most one conditional claim succeeds
- **AND** the others perform no provider submission

#### Scenario: Organization spend window is exhausted

- **WHEN** the organization cannot reserve another attempt's provider-cost ceiling
- **THEN** no new paid submission starts for that attempt
- **AND** reads, callbacks, polling, cancellation and ingestion remain available

#### Scenario: Global spend circuit opens

- **WHEN** the configured global provider spend threshold is reached
- **THEN** new paid attempts fail closed
- **AND** accepted/uncertain attempts retain recovery capacity

#### Scenario: Provider proves not-created

- **WHEN** an attempt with reserved provider exposure is truthfully classified `not_created`
- **THEN** its estimated monetary reservation and outstanding slot are released once

#### Scenario: Provider reports actual cost

- **WHEN** a terminal provider response includes trustworthy monetary cost
- **THEN** the attempt settles the reported integer amount/currency/scale
- **AND** marks its cost source as provider-reported

#### Scenario: Provider does not report actual cost

- **WHEN** an attempt becomes terminal without provider-reported cost
- **THEN** accounting settles from the immutable pricing snapshot
- **AND** marks the amount as derived rather than reported

#### Scenario: Redis is unavailable

- **WHEN** Redis coordination is absent or loses state
- **THEN** PostgreSQL still prevents overspending and excess outstanding provider effects

### Requirement: Media finalization settles output and ledgers in one transaction

After the primary object is durably stored, the system SHALL use one database
unit-of-work transaction to create/finalize media and output metadata, resolve
the customer grant, settle provider accounting as available and transition the
generation to its truthful terminal status.

A storage write outside that transaction SHALL use a deterministic allocated
object identity so database retry does not require another provider submission.
No customer charge SHALL commit merely because the provider reported success.

#### Scenario: Durable usable output finalizes

- **WHEN** the primary object passed validation and is durably stored
- **THEN** media/output creation, customer-credit commit and generation success commit atomically
- **AND** repeating finalization changes no balance or output

#### Scenario: Provider succeeds but storage fails

- **WHEN** provider output exists but Manypost cannot persist a usable primary object
- **THEN** the generation does not become `succeeded`
- **AND** customer credits do not commit
- **AND** recovery retries ingestion without another provider submit

#### Scenario: Object exists but final transaction rolls back

- **WHEN** deterministic object storage succeeds and database finalization rolls back
- **THEN** the generation remains non-terminal
- **AND** retry reuses the allocated object identity and unresolved customer reservation

#### Scenario: Terminal no-output resolution commits

- **WHEN** recovery or audited reconciliation proves the generation is terminal with no usable output
- **THEN** generation failure/cancellation and customer-credit release commit atomically
- **AND** incurred provider-cost settlement remains independent
