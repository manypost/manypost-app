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
