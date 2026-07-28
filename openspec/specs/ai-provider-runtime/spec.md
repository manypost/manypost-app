# ai-provider-runtime Specification

## Purpose
TBD - created by archiving change add-ai-content-assistance. Update Purpose after archive.
## Requirements
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
The adapter MUST omit optional request parameters that the selected protocol
endpoint does not accept and MUST still read the endpoint's base64 image result.

#### Scenario: No provider configured by default

- **WHEN** the environment does not set the provider variable
- **THEN** the resolved configuration selects no adapter
- **AND** the installation reports AI as unavailable

#### Scenario: Adapter selected by protocol

- **WHEN** the environment names a supported protocol together with a base URL
  and a model, with an optional API key
- **THEN** the resolved configuration selects the adapter for that protocol
- **AND** the API and the dedicated worker resolve the same protocol, base URL
  and models from the same mapping

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

#### Scenario: Image request uses only supported parameters

- **WHEN** the adapter requests one image from a protocol-compatible endpoint
- **THEN** the outbound body omits unsupported optional response-format fields
- **AND** the adapter reads the base64 image returned by the endpoint

### Requirement: Provider configuration fails closed at boot

The system SHALL refuse to start when a provider is selected but a required
setting is missing, and the refusal MUST name the missing environment variable.
The system MUST NOT print, log or embed the API key value in that message or
anywhere else.

#### Scenario: Protocol selected without a model

- **WHEN** a provider protocol is selected and the model variable is absent
- **THEN** startup fails with a message naming the missing model variable

#### Scenario: Protocol selected without a base URL

- **WHEN** a provider protocol is selected and the base URL variable is absent
- **THEN** startup fails with a message naming the missing base URL variable
- **AND** no configured value appears in the message

#### Scenario: Local runtime that needs no credential

- **WHEN** a provider protocol is selected with a base URL and a model but no
  API key
- **THEN** startup succeeds
- **AND** requests to the provider carry no authorization header

### Requirement: Every model call is bounded in time and output

The system SHALL abort a model call that exceeds the configured timeout and
SHALL cap the tokens a single call may produce.

#### Scenario: Upstream does not answer in time

- **WHEN** the provider does not respond within the configured timeout
- **THEN** the call is aborted
- **AND** the caller receives a provider failure rather than a hanging request

#### Scenario: Output cap is always sent

- **WHEN** any generation is requested
- **THEN** the request carries a maximum output size no larger than the
  configured cap

### Requirement: Provider failures are classified, never surfaced raw

The system SHALL translate a provider failure into a stable domain error and
MUST NOT include the provider's response body, endpoint or credentials in what
it returns to the caller.

#### Scenario: Upstream rejects the credential

- **WHEN** the provider answers that the credential is invalid or forbidden
- **THEN** the caller receives a provider failure error
- **AND** the response contains no credential, endpoint or vendor name

#### Scenario: Upstream is rate limited or unavailable

- **WHEN** the provider answers with a rate limit or a server-side failure
- **THEN** the caller receives a provider failure error indicating the attempt
  can be repeated

#### Scenario: Response is not usable

- **WHEN** the provider answers successfully but the body cannot be read as a
  generation
- **THEN** the caller receives an invalid-response error distinct from a
  provider failure

### Requirement: An installation without AI advertises its absence

The system SHALL report, per installation, whether AI is configured at all,
which optional AI capabilities exist, and the organization's remaining
allowance, so an interface can hide what would fail rather than offering it.

#### Scenario: Capabilities report AI off

- **WHEN** no provider is configured and the organization reads its capabilities
- **THEN** the response reports AI as not enabled

#### Scenario: AI route called on an installation without AI

- **WHEN** no provider is configured and a generation is requested
- **THEN** the request is refused with the disabled-capability error

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
