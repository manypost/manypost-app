# ai-provider-runtime Specification

## Purpose
TBD - created by archiving change add-ai-content-assistance. Update Purpose after archive.
## Requirements
### Requirement: Model provider selection is single-sourced and vendor-opaque

The system SHALL resolve which model provider to address from one environment
mapping, and every composition root (API, `MODE=all`, dedicated worker) SHALL
use that mapping rather than constructing an adapter of its own. No vendor name
SHALL appear in any TypeScript file outside the adapter directory.

#### Scenario: No provider configured by default

- **WHEN** the environment does not set the provider variable
- **THEN** the resolved configuration selects no adapter
- **AND** the installation reports AI as unavailable

#### Scenario: Adapter selected by protocol

- **WHEN** the environment names a supported protocol together with a base URL,
  an API key and a model
- **THEN** the resolved configuration selects the adapter for that protocol
- **AND** the API and the dedicated worker resolve the same protocol, base URL
  and model from the same mapping

#### Scenario: Vendor names stay inside the adapter directory

- **WHEN** the provider-name check runs over the workspace
- **THEN** it finds no vendor name in any file outside the permitted adapter
  paths and the environment schema

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

The system SHALL report whether AI is available for the organization, and every
AI route SHALL answer with the disabled-capability error when no provider is
configured. The absence of AI MUST NOT produce a server error.

#### Scenario: Capabilities report AI off

- **WHEN** no provider is configured and the organization reads its capabilities
- **THEN** the response reports AI as not enabled

#### Scenario: AI route called on an installation without AI

- **WHEN** no provider is configured and a generation is requested
- **THEN** the request is refused with the disabled-capability error

### Requirement: Describing an image is an optional provider capability

The system SHALL treat image description as a capability an adapter may not
have, and SHALL refuse the request explicitly rather than fabricating a
description from the file name or metadata.

#### Scenario: Configured model cannot see images

- **WHEN** alt text is requested and the selected adapter cannot describe images
- **THEN** the request is refused with a capability-unavailable error
- **AND** no allowance is consumed
