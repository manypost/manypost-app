## MODIFIED Requirements

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
