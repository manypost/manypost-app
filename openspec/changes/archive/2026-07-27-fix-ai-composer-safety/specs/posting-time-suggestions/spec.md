## MODIFIED Requirements

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
