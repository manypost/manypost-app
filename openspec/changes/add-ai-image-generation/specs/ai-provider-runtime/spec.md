## MODIFIED Requirements

### Requirement: Describing an image is an optional provider capability

The system SHALL treat image description as a capability an adapter may not
have, and SHALL refuse the request explicitly rather than fabricating a
description from the file name or metadata.

The same holds for **producing** an image: generation is an optional adapter
capability, and an adapter that cannot draw SHALL not implement it. In both
cases the capabilities endpoint SHALL advertise whether this installation has
the capability, so the interface can hide an action instead of offering one that
would fail. Neither capability SHALL be simulated by falling back to the other.
Image generation SHALL require an explicitly configured image model; a text
model SHALL NOT be assumed to produce images merely because the protocol has an
image endpoint.

#### Scenario: Configured model cannot see images

- **WHEN** alt text is requested and the selected adapter cannot describe images
- **THEN** the request is refused with a capability-unavailable error
- **AND** no allowance is consumed

#### Scenario: Configured provider cannot generate images

- **WHEN** an image is requested and the selected adapter cannot generate images
- **THEN** the request is refused with a capability-unavailable error
- **AND** no allowance is consumed

#### Scenario: Text AI exists without an image model

- **WHEN** text AI is configured but no image model is declared
- **THEN** the adapter omits image generation
- **AND** the capabilities endpoint reports `canGenerateImages: false`

#### Scenario: Capabilities advertise both independently

- **WHEN** an installation's capabilities are read
- **THEN** seeing images and producing images are reported as separate facts
- **AND** an installation may have either, both or neither

### Requirement: Model provider selection is single-sourced and vendor-opaque

The system SHALL select the model adapter from a single environment-derived
configuration shared by every process, and no vendor name SHALL appear outside
the adapter directory. Selecting a provider SHALL name the **protocol** spoken,
not the company that publishes the model, so that changing vendor is a change of
base URL and model name rather than a change of code.

A provider's **vocabulary of sizes** is part of that vendor detail: callers SHALL
express the shape of a requested image as an aspect ratio drawn from a closed set,
and the adapter SHALL translate that ratio into whatever dimensions its protocol
accepts. No use case, route, contract or interface SHALL name a pixel resolution.

#### Scenario: Switching vendor without code change

- **WHEN** the base URL and model name are changed to a different vendor that
  speaks the same protocol
- **THEN** generation continues to work with no code change

#### Scenario: Vendor names stay inside the adapter directory

- **WHEN** the repository is scanned for vendor names outside the adapter
  directory
- **THEN** none is found

#### Scenario: Image shape is requested as a ratio

- **WHEN** an image is requested for a given aspect ratio
- **THEN** the adapter chooses the dimensions its provider accepts
- **AND** the ratio, not the resolution, is what crosses the port

### Requirement: An installation without AI advertises its absence

The system SHALL report, per installation, whether AI is configured at all,
which optional AI capabilities exist, and the organization's remaining
allowance, so an interface can hide what would fail rather than offering it.

#### Scenario: No provider configured

- **WHEN** no provider is configured and a generation route is called
- **THEN** the response is the disabled-capability error, not a server error

#### Scenario: Interface reads capabilities

- **WHEN** the capabilities endpoint is read
- **THEN** it states whether AI is enabled, whether the model can describe
  images, whether the provider can generate images, and the remaining allowance

#### Scenario: Heuristic features survive without a provider

- **WHEN** no provider is configured
- **AND** a feature that needs no model is requested
- **THEN** it answers normally
