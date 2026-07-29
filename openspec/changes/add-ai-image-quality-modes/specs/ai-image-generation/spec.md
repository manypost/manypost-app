## MODIFIED Requirements

### Requirement: Image generation is gated, metered and refused honestly

The system SHALL require the image plan feature before generating, SHALL charge the declared cost
of the selected rendering mode above text generation, and SHALL refuse rather than degrade when the
installation cannot generate images.

#### Scenario: Plan excludes the feature

- **WHEN** an organization whose plan excludes image generation requests an image
- **THEN** the request is refused as feature-locked, naming the minimum plan
- **AND** no allowance is reserved and no provider call is made

#### Scenario: Installation cannot generate images

- **WHEN** the configured provider dialect cannot generate images
- **THEN** the request is refused as capability-unavailable
- **AND** the capabilities endpoint reports that this installation cannot generate images, so the
  interface hides the action instead of offering one that would fail

#### Scenario: Allowance is exhausted

- **WHEN** the organization has less remaining allowance than the selected rendering mode costs
- **THEN** the request is refused as budget-exceeded before the provider is called

#### Scenario: Provider fails after the reservation

- **WHEN** the provider fails or returns something unusable after a mode-specific reservation
- **THEN** the complete reserved allowance for that mode is returned to the organization
- **AND** no media record is created

## ADDED Requirements

### Requirement: Rendering mode is an explicit safe product choice

The system SHALL expose exactly `economy` and `quality` as product-level rendering modes, SHALL map
them to provider vocabulary only inside the provider adapter, and MUST NOT accept a model identifier
or arbitrary provider quality value from the browser.

#### Scenario: Economical mode requested

- **WHEN** a caller requests `economy`
- **THEN** the adapter requests low rendering quality from the configured image model
- **AND** the organization is charged 2 credits

#### Scenario: Quality mode requested

- **WHEN** a caller requests `quality`
- **THEN** the adapter requests high rendering quality from the configured image model
- **AND** the organization is charged 5 credits

#### Scenario: Mode omitted

- **WHEN** a caller omits the rendering mode
- **THEN** the system deterministically uses `economy`
- **AND** neither the provider default nor a high-cost mode is selected implicitly

#### Scenario: Unsupported mode requested

- **WHEN** a caller sends a mode outside the closed product enum
- **THEN** the request is rejected before allowance reservation and before any provider call

#### Scenario: Browser chooses a mode

- **WHEN** image generation is available and the dialog opens
- **THEN** the interface shows an accessible `economy` and `quality` choice
- **AND** each choice explains its intended use and credit cost before submission
- **AND** `economy` is selected initially

#### Scenario: Mode changes between retry attempts

- **WHEN** a browser changes the rendering mode after a failed logical submission
- **THEN** the changed body receives a new idempotency key
- **AND** an unchanged retry continues to reuse its original key

#### Scenario: Successful generation is audited before the response is observable

- **WHEN** image generation, media persistence and allowance confirmation succeed
- **THEN** the non-sensitive audit append attempt settles before the successful response returns
- **AND** an immediate audit reader does not race a still-pending append
- **AND** an audit repository failure does not turn the already-completed paid generation into an
  error that invites a duplicate request

### Requirement: Image provider is independently replaceable

The system SHALL resolve image generation through an image-specific provider port and factory,
SHALL allow an operator to replace an OpenAI-compatible image API through environment
configuration only, and MUST NOT expose endpoint, model or credential choices to browser callers.

#### Scenario: Independent image provider configured

- **WHEN** an operator configures an image protocol, base URL, optional API key and image model
- **THEN** image generation uses that connection independently from the text provider
- **AND** captions, rewrites and other text operations continue using their existing connection

#### Scenario: Existing installation defines only an image model

- **WHEN** `AI_IMAGE_MODEL` is configured and `AI_IMAGE_PROVIDER` is omitted
- **THEN** the complete text provider protocol, base URL and optional key are inherited for images
- **AND** the installation preserves its pre-change behavior without an environment migration

#### Scenario: Explicit image provider has incomplete connection

- **WHEN** an operator selects a non-disabled image protocol without its required base URL or model
- **THEN** application boot fails closed and names the missing image-specific variable
- **AND** no text-provider credential is silently copied into the independent connection

#### Scenario: Image provider is explicitly disabled

- **WHEN** `AI_IMAGE_PROVIDER=none`
- **THEN** image generation is unavailable even if an image model value remains configured
- **AND** text generation remains available according to its own provider configuration

#### Scenario: New native image protocol is added

- **WHEN** a maintainer implements the provider-neutral image port and registers its adapter
- **THEN** existing routes, use cases, metering, storage and browser contracts require no changes
