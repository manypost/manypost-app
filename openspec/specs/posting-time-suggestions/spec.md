# posting-time-suggestions Specification

## Purpose
TBD - created by archiving change add-ai-content-assistance. Update Purpose after archive.
## Requirements
### Requirement: Posting time suggestions are computed, not generated

The system SHALL derive suggested posting times from the organization's own
publication history and a per-network baseline, without calling a model and
without consuming AI allowance.

#### Scenario: Suggestion requested

- **WHEN** an organization requests suggested posting times for a channel
- **THEN** the result is a list of slots with a weekday and an hour
- **AND** no model call is made and no allowance is consumed

#### Scenario: Availability does not depend on AI being configured

- **WHEN** the installation has no model provider configured
- **AND** suggested posting times are requested
- **THEN** the suggestions are still returned

### Requirement: Suggestions report how much they are worth

The system SHALL return a confidence level derived from how much of the
organization's own history informed the result, and MUST NOT present a baseline
as if it were learned from the organization.

The system SHALL also name the **signal** the suggestion rests on, because
confidence alone is ambiguous: a large sample of publication timestamps says the
organization is consistent, not that those times performed well. While no
engagement data is collected, the signal is the organization's own posting
frequency, the reported confidence SHALL NOT exceed medium, and neither the
response nor the interface SHALL describe the result as a measurement of
performance.

#### Scenario: No history for the channel

- **WHEN** the channel has no delivered publications
- **THEN** the suggestions come from the network baseline
- **AND** the confidence is reported as low
- **AND** the signal is reported as the network baseline

#### Scenario: Substantial history for the channel

- **WHEN** the channel has enough delivered publications to distinguish times
- **THEN** the organization's own history informs the result
- **AND** the confidence is reported above low
- **AND** the signal is reported as the organization's own posting history

#### Scenario: Confidence does not outrun the signal

- **WHEN** the only available signal is when the organization published
- **THEN** the reported confidence is at most medium, however large the sample

#### Scenario: Sample size is disclosed

- **WHEN** suggestions are returned
- **THEN** the response states how many of the organization's publications
  informed them

#### Scenario: The interface describes the signal it has

- **WHEN** suggestions derived from posting frequency are presented
- **THEN** the wording refers to the times the organization uses most on that
  channel
- **AND** it does not attribute the suggestion to how the posts performed

### Requirement: Suggestions are organization-scoped and channel-aware

The system SHALL compute suggestions only from publications belonging to the
requesting organization, and SHALL refuse a channel the organization does not
own.

#### Scenario: Channel from another organization

- **WHEN** suggestions are requested for a channel of a different organization
- **THEN** the request is refused as not found

#### Scenario: History of other organizations does not leak

- **WHEN** suggestions are computed
- **THEN** only the requesting organization's publications contribute to the
  result

### Requirement: Suggestions are expressed in the requester's time zone

The system SHALL return slots in the time zone the requester asks for, so a
suggestion can be applied directly to the scheduling field without conversion.

#### Scenario: Time zone requested

- **WHEN** suggestions are requested with a time zone
- **THEN** every returned weekday and hour is expressed in that time zone

#### Scenario: Time zone omitted

- **WHEN** suggestions are requested without a time zone
- **THEN** the slots are returned in a documented default rather than an
  ambiguous local time

#### Scenario: Invalid time zone

- **WHEN** the requested time zone is not a valid identifier
- **THEN** the request is refused as invalid
