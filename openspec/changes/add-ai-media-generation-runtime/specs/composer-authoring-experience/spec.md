## ADDED Requirements

### Requirement: Composer offers only available guided media operations

The composer SHALL offer the guided operations `social-image-create`,
`social-image-edit`, `social-video-from-prompt` and
`social-video-from-image` only when the authenticated organization is entitled
and the installation advertises an active eligible recipe and required
infrastructure.

The interface SHALL distinguish a plan entitlement lock, permanent
installation/capability absence and temporary operational admission exhaustion.
It MUST NOT expose provider/model/endpoint/price internals or controls absent
from the Manypost product capability.

#### Scenario: Image is available but video is not configured

- **WHEN** capabilities report eligible image recipes but no production-ready video recipe
- **THEN** guided image creation/editing remain available
- **AND** video generation is not offered as an action that would fail

#### Scenario: Plan lacks video entitlement

- **WHEN** the installation supports video but the organization lacks `ai_video`
- **THEN** video actions show the truthful plan lock/upgrade path
- **AND** image behavior remains governed independently by `ai_image`

#### Scenario: Provider capacity is temporarily exhausted

- **WHEN** a configured entitled operation has no current operational admission
- **THEN** the interface presents a retryable capacity state rather than claiming the feature is unconfigured
- **AND** it does not silently select another provider or cheaper quality

#### Scenario: Advanced control is unavailable

- **WHEN** no launch recipe advertises LoRA, ControlNet, IP-Adapter, seed, sampler or another advanced control
- **THEN** the composer does not render that control
- **AND** it does not infer support from provider or editor terminology

#### Scenario: Provider internals appear in a client payload

- **WHEN** a stale or manipulated client attempts to submit provider, model, endpoint, pixel preset or wholesale-price fields
- **THEN** the request is refused or those non-schema fields are excluded
- **AND** the interface handles the stable sanitized problem without displaying the supplied internals

### Requirement: Media choices and customer credits are confirmed truthfully

Before creating a generation, the composer SHALL display the selected product
operation, cost-affecting options and maximum customer credits from a current
server quote. A configured server-owned expensive-operation threshold SHALL
require an additional explicit confirmation.

The composer SHALL send the maximum credits the person accepted. If creation
recalculates a higher charge or incompatible catalogue revision, the interface
SHALL show the new quote and require confirmation rather than automatically
submitting or downgrading.

#### Scenario: Image quote is below the expensive threshold

- **WHEN** a person chooses supported aspect and `economy|quality` options
- **THEN** the submit action states the maximum customer credits before creation

#### Scenario: Video crosses the confirmation threshold

- **WHEN** selected video duration/quality reaches the server-declared expensive threshold
- **THEN** the person must explicitly confirm the final operation/options/credits
- **AND** no generation is created merely by opening the confirmation

#### Scenario: Quote increases before creation

- **WHEN** the server recalculates customer credits above the accepted maximum
- **THEN** the composer displays the updated quote-conflict state
- **AND** requires a new deliberate confirmation
- **AND** it does not reuse the earlier acceptance as consent for the higher charge

#### Scenario: Quote decreases or remains within acceptance

- **WHEN** creation recalculates a valid charge no greater than the accepted maximum
- **THEN** it may create the generation with the current immutable recipe snapshot
- **AND** the status view shows the generation's declared customer credits

#### Scenario: Quote expires without creation

- **WHEN** a person leaves the quote surface until its expiry
- **THEN** no credits, provider spend or capacity remain reserved
- **AND** returning requires a current quote

### Requirement: Browser retries preserve one logical generation

The composer SHALL generate one idempotency key for a confirmed logical
submission and SHALL reuse it across transport retry, timeout recovery and
duplicate interaction suppression. It SHALL create a new key when the person
changes canonical generation input or deliberately requests another variant.

#### Scenario: Create response is lost

- **WHEN** the browser does not receive the response for an unchanged confirmed generation
- **THEN** retry carries the same idempotency key and canonical body
- **AND** the original persisted generation is displayed

#### Scenario: Submit control receives repeated activation

- **WHEN** repeated click, tap or key events occur while the same create request is pending
- **THEN** the composer sends at most the same logical idempotent submission
- **AND** it does not create multiple variants or charges

#### Scenario: Person changes prompt

- **WHEN** the person edits the prompt after a confirmed logical submission
- **THEN** the next deliberate generation uses a new idempotency key

#### Scenario: Person changes source or cost-affecting option

- **WHEN** the person changes source media, aspect, quality or duration
- **THEN** the composer requests a current quote
- **AND** the next confirmed generation uses a new idempotency key

#### Scenario: Person deliberately asks for another variant

- **WHEN** the person selects generate-again without changing input
- **THEN** the interface explains that this is a separately charged generation
- **AND** confirmation creates a new idempotency key

### Requirement: Asynchronous progress is resumable and persisted state is authoritative

After successful creation, the composer SHALL show the persisted generation
identity and sanitized state. The person MAY close the media surface, navigate
away and later resume an authorized non-purged generation through server state.

SSE/Redis updates MAY refresh progress, but persisted generation `GET` SHALL be
authoritative. The interface MUST NOT infer success from provider progress or
display a provider output before Manypost has durable validated media.

#### Scenario: Person leaves while video is running

- **WHEN** a video generation remains non-terminal and the person leaves the composer
- **THEN** server execution continues
- **AND** returning through the owning account resumes the persisted generation/status

#### Scenario: Realtime update is lost

- **WHEN** SSE disconnects or omits a transition
- **THEN** the interface obtains authoritative status from persisted `GET`
- **AND** does not create a replacement generation

#### Scenario: Provider reports completion before ingestion

- **WHEN** provider progress says complete but Manypost is still ingesting/finalizing
- **THEN** the composer continues to show a non-terminal processing state
- **AND** no attach action is enabled

#### Scenario: Generation succeeds

- **WHEN** the generation reaches durable `succeeded`
- **THEN** the composer presents exactly one primary media preview and review action

#### Scenario: Generation fails

- **WHEN** the generation reaches terminal `failed`
- **THEN** the composer shows a stable actionable Manypost classification
- **AND** no raw provider body, temporary URL or credential is shown

#### Scenario: Provider moderates the request

- **WHEN** failure classification is moderation refusal
- **THEN** the interface explains the refusal in sanitized product language
- **AND** does not echo provider-native wording or hidden submitted data

#### Scenario: Retained input expires

- **WHEN** generation prompt/input has been purged after the retention deadline
- **THEN** history indicates that input is no longer retained
- **AND** still shows authorized non-content status, charge and output provenance

### Requirement: Uncertainty and cancellation are represented honestly

The composer SHALL display `submission_uncertain` and
`cancellation_requested` as non-terminal reconciling states. It MUST NOT promise
that a provider job was not created, that cancellation succeeded, that credits
were refunded or that another attempt is safe until persisted provider truth
resolves the generation.

#### Scenario: Submission becomes uncertain

- **WHEN** the provider may have accepted the generation but no stable run identity is known
- **THEN** the interface states that Manypost is reconciling the request
- **AND** disables generate-again as an automatic retry of that logical submission
- **AND** does not promise a refund

#### Scenario: Person requests cancellation

- **WHEN** cancellation is accepted for a non-terminal generation
- **THEN** the interface shows cancellation pending until persisted state becomes terminal
- **AND** repeated cancel interaction does not create another command outcome

#### Scenario: Provider confirms cancellation

- **WHEN** persisted state reaches `canceled` with no usable output
- **THEN** the interface reports cancellation and released customer credits truthfully

#### Scenario: Provider completes before cancellation

- **WHEN** persisted state reaches `succeeded` because usable output completed before cancellation was confirmed
- **THEN** the interface presents the durable output and committed disclosed credits
- **AND** does not claim that cancellation refunded the generation

#### Scenario: Cancellation cannot be confirmed

- **WHEN** the provider remains inconclusive after a cancel request
- **THEN** the interface keeps the generation non-terminal/reconciling
- **AND** offers no blind retry or provider fallback action

### Requirement: Generated media is reviewed and attached deliberately

A succeeded generation SHALL present the primary-media preview, synthetic
source, non-content recipe/model provenance, customer credits and an editable
alt-text field where applicable. The composer SHALL attach generated media only
after deliberate authorized action.

Attachment SHALL be idempotent for the same draft/media pair and SHALL target
the currently confirmed composer/draft context. Generation success MUST NOT
silently mutate a draft, replace source media, schedule or publish content.

#### Scenario: Person reviews successful image

- **WHEN** a generated image becomes durable media
- **THEN** the review surface shows its preview, synthetic provenance and editable alt text
- **AND** the post remains unchanged

#### Scenario: Person attaches generated media

- **WHEN** the person deliberately confirms attachment to the current draft
- **THEN** the media is added once through the normal composer media path
- **AND** no schedule or publication request starts

#### Scenario: Attach response is retried

- **WHEN** transport repeats attachment of the same media to the same draft
- **THEN** the composer contains one reference to that media rather than duplicates

#### Scenario: Active draft changed while generation ran

- **WHEN** a generation started from one draft but the person is now editing another context
- **THEN** the interface requires explicit confirmation of the current attachment target
- **AND** does not silently attach to either draft

#### Scenario: Source image was edited

- **WHEN** `social-image-edit` succeeds and the result is attached
- **THEN** the new generated media is attached
- **AND** the original source media remains unchanged and available

#### Scenario: Person dismisses the result

- **WHEN** the person closes review without attachment
- **THEN** the media remains available according to organization media policy
- **AND** the draft remains unchanged

#### Scenario: Person attempts attachment across organizations

- **WHEN** a stale or manipulated client attempts to attach generated media outside its organization
- **THEN** the normal media/draft authorization refuses the action as not found

### Requirement: Guided media surfaces preserve draft, focus and accessibility

Opening, updating or dismissing guided generation SHALL NOT discard unsaved
composer content, selected channels, per-channel overrides, thread items or
current media. Opening/closing the surface SHALL follow the composer's existing
caret contract, and background progress MUST NOT steal focus.

All states, confirmations, progress and result actions SHALL be keyboard
operable and exposed to assistive technology. Status SHALL NOT rely only on
color or animation.

#### Scenario: Guided dialog opens from an editor

- **WHEN** a person opens guided media generation from a composer editor
- **THEN** existing draft/channel/thread/media state remains unchanged
- **AND** the invoking editor context is retained for focus restoration

#### Scenario: Dialog closes without generation

- **WHEN** the person dismisses quote or generation input without creating
- **THEN** focus returns according to the existing composer caret contract
- **AND** no draft mutation, credit reservation or generation exists

#### Scenario: Background generation changes state

- **WHEN** an async status update arrives while the person edits text
- **THEN** an accessible status region may announce the update
- **AND** caret/focus and typed content remain undisturbed

#### Scenario: Validation or failure is presented

- **WHEN** guided input, quote or generation fails
- **THEN** the message is programmatically associated with the affected control/action
- **AND** a keyboard user can reach the corrective action

#### Scenario: Progress animation is unavailable

- **WHEN** reduced motion is requested or animation cannot run
- **THEN** textual/programmatic status still communicates current generation state

#### Scenario: Alt text is empty

- **WHEN** a generated visual result has no alt text
- **THEN** the review surface exposes the empty editable field and applicable accessibility guidance
- **AND** it does not invent provider-derived alt text silently
