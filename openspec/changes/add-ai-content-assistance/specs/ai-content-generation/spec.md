## ADDED Requirements

### Requirement: Plan gating precedes any allowance consumption

The system SHALL assert the plan feature that covers a generation before
reserving allowance, so an organization whose plan excludes a capability never
spends allowance discovering that.

#### Scenario: Feature not included in the plan

- **WHEN** an organization whose plan excludes the capability requests it
- **THEN** the request is refused with the feature-locked error naming the
  minimum plan that includes it
- **AND** no allowance is reserved and no model call is made

#### Scenario: Feature included

- **WHEN** an organization whose plan includes the capability requests it
- **THEN** the request proceeds to reserve allowance

### Requirement: Caption generation adapts one brief to each selected channel

The system SHALL produce one caption per selected channel from a single brief,
adapting tone and format to that network, and SHALL reject a channel that does
not belong to the requesting organization.

#### Scenario: One brief, several networks

- **WHEN** a brief and several connected channels are given
- **THEN** the result contains one caption per channel, each identified by its
  channel

#### Scenario: Channel from another organization

- **WHEN** a channel that belongs to a different organization is requested
- **THEN** the request is refused as not found
- **AND** no allowance is consumed

#### Scenario: No channel selected

- **WHEN** no channel is given
- **THEN** the request is refused as invalid before any model call

### Requirement: Generated text never exceeds the channel's limit

The system SHALL guarantee that generated text respects the target channel's
maximum length, using the same channel-settings merge the scheduler uses, and
SHALL shorten deterministically when the model exceeds it rather than returning
text the scheduler would later reject.

#### Scenario: Model returns text within the limit

- **WHEN** the model's answer fits the channel's limit
- **THEN** the text is returned unchanged and is not marked shortened

#### Scenario: Model overshoots the limit

- **WHEN** the model's answer exceeds the channel's limit
- **THEN** the returned text is within the limit
- **AND** it is cut at a sentence or word boundary rather than mid-word
- **AND** the result is marked as shortened

#### Scenario: Channel settings raise the limit

- **WHEN** the channel's stored settings grant a larger limit than the
  network's base limit
- **THEN** the larger limit is the one enforced, matching what scheduling would
  accept

### Requirement: Rewriting and hashtags operate on given text

The system SHALL rewrite a given text according to an instruction, and SHALL
propose hashtags for a given text and target network, without inventing facts
the source text does not contain.

#### Scenario: Rewrite with an instruction

- **WHEN** a text and an instruction such as shortening or changing tone are
  given
- **THEN** the result is a rewritten text honoring the target channel's limit

#### Scenario: Hashtags for a network

- **WHEN** a text and a target network are given
- **THEN** the result is a list of hashtags appropriate to that network

#### Scenario: Empty source text

- **WHEN** the text to rewrite is empty
- **THEN** the request is refused as invalid before any model call

### Requirement: Alt text is generated from the stored media

The system SHALL generate alt text from a media item belonging to the requesting
organization, and SHALL refuse a media item that is not an image.

#### Scenario: Alt text for an image

- **WHEN** an image in the organization's library is given
- **THEN** a descriptive alt text is returned

#### Scenario: Media from another organization

- **WHEN** a media item that belongs to a different organization is given
- **THEN** the request is refused as not found

#### Scenario: Media that is not an image

- **WHEN** the given media item is a video
- **THEN** the request is refused as invalid before any model call

### Requirement: A multichannel draft turns one idea into per-channel content

The system SHALL produce, from a single idea, a draft for each selected channel
that the composer can open directly, and SHALL validate the shape of what the
model returns before accepting it.

#### Scenario: Idea becomes drafts

- **WHEN** an idea and several channels are given
- **THEN** the result contains a draft per channel within each channel's limit

#### Scenario: Model returns an unusable structure

- **WHEN** the model's answer cannot be read as the expected structure
- **THEN** the request fails with the invalid-response error
- **AND** the allowance is released rather than consumed

### Requirement: A week plan proposes slots without scheduling them

The system SHALL propose a week of posts across the organization's channels,
and MUST NOT create, schedule or publish anything by itself. The proposal is
material a human accepts.

#### Scenario: Plan is returned as a proposal

- **WHEN** a week plan is requested
- **THEN** the result is a list of proposed slots with a topic and a target
  channel per slot
- **AND** no publication, draft or job exists as a result of the request

#### Scenario: Proposed times respect the requested week

- **WHEN** a week plan is requested for a given week
- **THEN** every proposed slot falls inside that week

### Requirement: User text inside a prompt is treated as data

The system SHALL delimit user-supplied text within a prompt and mark it as
content to work on rather than as instruction, and MUST NOT act on instructions
found inside user text.

#### Scenario: Brief contains an instruction aimed at the model

- **WHEN** the brief contains text attempting to override the system
  instruction
- **THEN** the response is still a caption for the requested channels
- **AND** no capability outside the requested generation is performed

#### Scenario: Model output is never executed or published

- **WHEN** any generation completes
- **THEN** its output is returned to the caller only
- **AND** nothing is published, scheduled or fetched as a consequence of the
  output's content

### Requirement: Generations are auditable without storing content

The system SHALL record that a generation happened, for which organization,
which operation and by which actor, and MUST NOT write the prompt or the
generated text to the audit record.

#### Scenario: Generation is audited

- **WHEN** a generation completes
- **THEN** an audit entry exists identifying the organization, the actor and the
  operation

#### Scenario: Audit carries no content

- **WHEN** an audit entry for a generation is written
- **THEN** it contains neither the prompt nor the generated text
