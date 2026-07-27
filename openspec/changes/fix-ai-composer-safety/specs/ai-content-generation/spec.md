## MODIFIED Requirements

### Requirement: Generated text never exceeds the channel's limit

The system SHALL guarantee that text it **generates** respects the target
channel's maximum length, using the same channel-settings merge the scheduler
uses, and SHALL shorten deterministically when the model exceeds it rather than
returning text the scheduler would later reject. This applies to operations
whose output is new text — captions, multichannel drafts and week-plan slots.
It MUST NOT apply to an operation whose input is text the person wrote, because
discarding part of the person's own words to fit a limit they did not choose
loses work rather than protecting it. Whenever the system shortens text, the
result SHALL carry a marker the interface can present, and the interface SHALL
present it.

#### Scenario: Model returns text within the limit

- **WHEN** the model's answer fits the channel's limit
- **THEN** the text is returned unchanged and is not marked shortened

#### Scenario: Model overshoots the limit

- **WHEN** the model's answer exceeds the channel's limit
- **THEN** the returned text is within the limit
- **AND** it is cut at a sentence or word boundary rather than mid-word
- **AND** the result is marked as shortened

#### Scenario: Shortening is disclosed to the person

- **WHEN** a generated result is marked as shortened
- **THEN** the interface states, next to the affected text, that it was
  shortened and which limit applied

#### Scenario: Channel settings raise the limit

- **WHEN** the channel's stored settings grant a larger limit than the
  network's base limit
- **THEN** the larger limit is the one enforced, matching what scheduling would
  accept

#### Scenario: Rewriting is never shortened

- **WHEN** a rewrite returns text longer than the target channel's limit
- **THEN** the full text is returned with no characters removed
- **AND** the response reports that it exceeds the limit, and which limit
- **AND** the person is warned before the text is put into the editor

### Requirement: Rewriting and hashtags operate on given text

The system SHALL rewrite a given text according to an instruction, and SHALL
propose hashtags for a given text and target network, without inventing facts
the source text does not contain. A target channel is OPTIONAL for a rewrite: a
composer editing one text shared by several networks has no single channel to
resolve against, and picking one arbitrarily would impose an unrelated network's
limit on the result. When no channel is given, the rewrite SHALL still run and
SHALL report no limit.

The instruction MAY be selected from a server-owned catalogue by identifier. The
catalogue is the system's own prompt text, not user input, and SHALL live beside
the other prompts rather than in the client.

#### Scenario: Rewrite with an instruction

- **WHEN** a text and an instruction such as shortening or changing tone are
  given
- **THEN** the result is a rewritten text honoring the instruction

#### Scenario: Rewrite with a target channel

- **WHEN** a target channel is given
- **THEN** the response reports that channel's limit and whether the result
  exceeds it

#### Scenario: Rewrite without a target channel

- **WHEN** no target channel is given
- **THEN** the rewrite is performed
- **AND** the response reports no limit and does not claim the result exceeds one

#### Scenario: Instruction selected by identifier

- **WHEN** a caller names an instruction from the server's catalogue
- **THEN** the server resolves the sentence sent to the model
- **AND** an unknown identifier is refused as invalid before any model call

#### Scenario: Hashtags for a network

- **WHEN** a text and a target network are given
- **THEN** the result is a list of hashtags appropriate to that network

#### Scenario: Empty source text

- **WHEN** the text to rewrite is empty
- **THEN** the request is refused as invalid before any model call

### Requirement: Caption generation adapts one brief to each selected channel

The system SHALL produce one caption per selected channel from a single brief,
adapting tone and format to that network, and SHALL reject a channel that does
not belong to the requesting organization. Because the allowance is consumed per
channel, every caption paid for SHALL be delivered to the person addressed to
its channel; the interface MUST NOT keep one result and discard the rest.

#### Scenario: One brief, several networks

- **WHEN** a brief and several connected channels are given
- **THEN** the result contains one caption per channel, each identified by its
  channel

#### Scenario: Every paid caption reaches the person

- **WHEN** captions are generated for several channels
- **THEN** each caption is applied to the channel it was written for
- **AND** the number of results presented equals the number of channels charged

#### Scenario: Channel from another organization

- **WHEN** a channel that belongs to a different organization is requested
- **THEN** the request is refused as not found
- **AND** no allowance is consumed

#### Scenario: No channel selected

- **WHEN** no channel is given
- **THEN** the request is refused as invalid before any model call
</content>
