## ADDED Requirements

### Requirement: The landing screen answers whether anything is wrong

The system SHALL provide an authenticated landing screen that states, without further navigation,
whether the organization has work that needs a person: publications that failed, publications
awaiting review, publications awaiting approval, posts that reached some networks but not all, and
channels whose connection needs action.

#### Scenario: Something needs attention

- **WHEN** the organization has at least one failed publication, one publication awaiting review or
  approval, one partially delivered post, or one channel not in an active state
- **THEN** the landing screen states how many of each, most urgent first
- **AND** each count links to the screen that resolves it

#### Scenario: Nothing needs attention

- **WHEN** none of those conditions holds
- **THEN** the attention block is **absent** from the screen
- **AND** no reassurance card takes its place

#### Scenario: A channel needs reconnection

- **WHEN** a channel's status requires a human, such as an expired credential
- **THEN** the landing screen names the channel and offers the reconnection path
- **AND** it does so without waiting for a publication to fail first

### Requirement: The summary is aggregate, organization-scoped and time-zone aware

The system SHALL expose the landing screen's counts as a single aggregate read scoped to the
requesting organization, and SHALL resolve "today" and "the next seven days" in the time zone the
caller declares.

#### Scenario: Counts belong to one organization

- **WHEN** two organizations each have publications and channels
- **THEN** each organization's summary counts only its own rows

#### Scenario: Day boundaries follow the caller's time zone

- **WHEN** a caller declares a time zone
- **THEN** "today" spans that zone's calendar day, not the server's

#### Scenario: Invalid time zone

- **WHEN** the declared time zone is not a valid IANA name
- **THEN** the request is refused as invalid rather than silently falling back

#### Scenario: No time zone declared

- **WHEN** no time zone is declared
- **THEN** a documented default is used and the response states which zone the counts are in

#### Scenario: The payload carries no content

- **WHEN** the summary is returned
- **THEN** it contains counts, states and channel identifiers only
- **AND** it contains no publication text, no channel credential and no personal data

### Requirement: The landing screen claims only what the platform measures

The system MUST NOT present performance or engagement figures on the landing screen while no such
data is collected. Every figure shown SHALL derive from the platform's own records of what it was
asked to publish and what it delivered.

#### Scenario: No engagement data exists

- **WHEN** the platform has not collected engagement or reach for any channel
- **THEN** the landing screen shows no performance figure, chart or trend
- **AND** it does not present delivery counts as if they measured audience response

#### Scenario: Plan usage is shown where it is enforced

- **WHEN** the installation enforces plan limits
- **THEN** the landing screen shows usage against each limit that applies
- **AND** on an installation that does not enforce limits, those meters are absent rather than
  showing a limit that would never be applied

### Requirement: A first-run organization gets next steps, not empty counters

The system SHALL replace the landing screen's operational blocks with an ordered list of next steps
when the organization has nothing to operate yet.

#### Scenario: No channel connected

- **WHEN** the organization has no connected channel
- **THEN** the landing screen's primary content is the step of connecting one
- **AND** counters that would all read zero are not shown

#### Scenario: Channels connected but nothing published

- **WHEN** the organization has at least one channel and has never scheduled a post
- **THEN** the landing screen offers composing the first post as the next step

### Requirement: Every screen states what it is

The system SHALL give each application screen a header carrying its title, a one-line description
of what the screen is for, and its primary actions.

#### Scenario: A screen is opened

- **WHEN** a person opens any application screen
- **THEN** the screen shows its own title and a description of its purpose
- **AND** the primary action for that screen, when one exists, sits in the header

#### Scenario: Narrow viewport

- **WHEN** the viewport is too narrow for title and actions side by side
- **THEN** the actions move below the title rather than shrinking or wrapping the title
</content>
