## ADDED Requirements

### Requirement: The landing screen states what publishes next

The system SHALL show, on the authenticated landing screen, a bounded list of the organization's
next scheduled publications, each with its local time, its channel and its state, ordered by when it
publishes.

#### Scenario: Scheduled work exists ahead

- **WHEN** the organization has at least one publication scheduled at or after the current moment
- **THEN** the landing screen lists the earliest of them, at most five
- **AND** each entry states its time in the caller's time zone, its channel and its state
- **AND** each entry opens that post

#### Scenario: More scheduled work exists than is listed

- **WHEN** more publications are scheduled than the list shows
- **THEN** the block offers the calendar as the way to see the rest
- **AND** it does not imply that the listed entries are all that is scheduled

#### Scenario: Nothing is scheduled ahead

- **WHEN** no publication is scheduled at or after the current moment
- **THEN** the block is absent from the screen

### Requirement: The landing screen states what recently resolved

The system SHALL show a bounded list of recent delivery outcomes — publications that reached a
terminal state — merged with approval decisions, ordered by when each outcome actually resolved
rather than by when it had been scheduled.

#### Scenario: Delivery resolved recently

- **WHEN** publications reached a published, failed, cancelled or needs-review state
- **THEN** the landing screen lists the most recent of them, at most eight
- **AND** each entry states what happened, to which channel, and how long ago

#### Scenario: A publication failed and was retried

- **WHEN** a publication's outcome resolved at a moment different from its scheduled time
- **THEN** the entry is ordered by when the outcome resolved
- **AND** it is not ordered by the time it had been scheduled for

#### Scenario: An approval was decided

- **WHEN** an approval decision was recorded for the organization
- **THEN** it appears in the same list, ordered among the delivery outcomes by time

#### Scenario: Nothing resolved recently

- **WHEN** no delivery outcome and no approval decision falls in the recent window
- **THEN** the block is absent from the screen

#### Scenario: Activity belongs to one organization

- **WHEN** two organizations each have recent outcomes
- **THEN** each landing screen lists only its own organization's entries

### Requirement: The landing screen surfaces unfinished work that will not publish itself

The system SHALL show work in progress that no schedule will resolve: the composer's locally
retained draft, and post groups that remain in a draft state without a pending approval link. For
the latter, the system MUST NOT offer scheduling, because no platform operation schedules a draft
group.

#### Scenario: A local draft was left unfinished

- **WHEN** the composer holds retained draft content that was never submitted
- **THEN** the landing screen offers resuming it
- **AND** it states how long ago the draft was last edited

#### Scenario: A draft group has no pending approval

- **WHEN** a post group is in a draft state and has no pending, unexpired approval link
- **THEN** the landing screen names it as work that will not publish on its own
- **AND** offers only operations the platform performs on it, such as duplicating it into the
  composer or issuing an approval link

#### Scenario: A draft group is awaiting approval

- **WHEN** a draft group has a pending approval link
- **THEN** it is not listed as unfinished work here
- **AND** it remains counted by the attention block instead

#### Scenario: No unfinished work exists

- **WHEN** there is no retained composer draft and no draft group without a pending approval
- **THEN** the block is absent from the screen

### Requirement: The landing screen proposes one next step, and never repeats the attention block

The system SHALL propose at most one contextual next step, chosen by a deterministic rule over data
already on the screen. The system MUST NOT show the next step while the attention block is present,
and MUST NOT show it during first run, where the first-run steps already are the next step.

#### Scenario: Something needs attention

- **WHEN** the attention block is present
- **THEN** the contextual next step is absent

#### Scenario: The organization is in first run

- **WHEN** the landing screen is showing first-run steps
- **THEN** the contextual next step is absent

#### Scenario: Nothing needs attention and several conditions could suggest a step

- **WHEN** more than one condition would propose a step
- **THEN** exactly one is shown, chosen by a fixed documented priority
- **AND** the same inputs always produce the same step

#### Scenario: No condition applies

- **WHEN** no condition proposes a step
- **THEN** the block is absent rather than showing a generic suggestion

### Requirement: The landing screen summarizes the board without becoming it

The system SHALL show a compact summary of the delivery pipeline by column on the landing screen,
derived from the same read as the board so the two surfaces cannot report different numbers. The
summary MUST NOT offer drag, bulk selection or state transitions; those remain the board's.

#### Scenario: The pipeline holds work

- **WHEN** the organization has posts in the board's window
- **THEN** the landing screen states how many are in each column
- **AND** each column opens the board filtered to it

#### Scenario: The board and the landing screen are open on the same data

- **WHEN** both surfaces present the pipeline
- **THEN** their per-column counts agree

#### Scenario: A narrow viewport

- **WHEN** the viewport is too narrow for the columns side by side
- **THEN** the summary presents counts only, scrolling horizontally, without card content

### Requirement: One unavailable source does not blank the landing screen

The system SHALL scope each block's loading, error and empty presentation to that block's own
source. A failing read SHALL degrade its block alone and offer retrying it, while every block fed by
another source continues to render.

#### Scenario: One read fails

- **WHEN** one of the landing screen's reads fails and the others succeed
- **THEN** only the failing block shows an error and a way to retry
- **AND** the remaining blocks render their content

#### Scenario: Reads resolve at different times

- **WHEN** one read is still pending while others have resolved
- **THEN** only the pending block shows a loading placeholder

#### Scenario: The attention summary itself fails

- **WHEN** the aggregate summary read fails
- **THEN** the blocks derived from it degrade
- **AND** blocks derived from other reads still render

### Requirement: The landing screen reflects delivery events without a manual reload

The system SHALL refresh the landing screen's counts when the realtime stream reports a delivery
outcome or a channel connection problem, so a resolved failure stops being shown and a new failure
starts being shown without the person reloading.

#### Scenario: A publication fails while the landing screen is open

- **WHEN** the realtime stream reports a failed publication
- **THEN** the landing screen's summary is refreshed
- **AND** the failure appears in the attention block without a reload

#### Scenario: A channel requires reconnection while the landing screen is open

- **WHEN** the realtime stream reports that a channel needs reconnection
- **THEN** the landing screen's summary is refreshed

#### Scenario: A publication succeeds after being retried

- **WHEN** the realtime stream reports a published publication that had previously failed
- **THEN** the resolved failure stops being counted without a reload

#### Scenario: Realtime delivery is unavailable

- **WHEN** the realtime connection carries no delivery events because pub/sub is unavailable
- **THEN** the landing screen refreshes its operational reads on a bounded polling interval
- **AND** losing realtime does not leave delivery state stale indefinitely

#### Scenario: One recent-activity source fails

- **WHEN** either delivery outcomes or approval notifications cannot be loaded
- **AND** the other source returned recent activity
- **THEN** the available activity remains visible
- **AND** the block discloses that its list is incomplete and offers a retry

#### Scenario: An approval notification is opened

- **WHEN** a recent approval notification has a post-group destination
- **THEN** its link opens that group's detail on an existing authenticated web route
- **AND** historical `/posts/:groupId` destinations are mapped to the same valid detail route

## MODIFIED Requirements

### Requirement: The landing screen claims only what the platform measures

The system MUST NOT present performance or engagement figures on the landing screen while no such
data is collected. Every figure shown SHALL derive from the platform's own records of what it was
asked to publish and what it delivered. This applies to every block, including lists of upcoming
publications, recent outcomes and pipeline counts, none of which may be presented or ordered as if
they measured audience response.

#### Scenario: No engagement data exists

- **WHEN** the platform has not collected engagement or reach for any channel
- **THEN** the landing screen shows no performance figure, chart or trend
- **AND** it does not present delivery counts as if they measured audience response

#### Scenario: Plan usage is shown where it is enforced

- **WHEN** the installation enforces plan limits
- **THEN** the landing screen shows usage against each limit that applies
- **AND** on an installation that does not enforce limits, those meters are absent rather than
  showing a limit that would never be applied

#### Scenario: Recent outcomes are listed

- **WHEN** the landing screen lists recent delivery outcomes
- **THEN** each entry describes delivery only
- **AND** no entry is ranked, highlighted or annotated by supposed audience response

### Requirement: A first-run organization gets next steps, not empty counters

The system SHALL replace the landing screen's operational blocks with an ordered list of next steps
when the organization has nothing to operate yet. No operational block SHALL appear alongside those
steps.

#### Scenario: No channel connected

- **WHEN** the organization has no connected channel
- **THEN** the landing screen's primary content is the step of connecting one
- **AND** counters that would all read zero are not shown

#### Scenario: Channels connected but nothing published

- **WHEN** the organization has at least one channel and has never scheduled a post
- **THEN** the landing screen offers composing the first post as the next step

#### Scenario: First run with unfinished or upcoming work blocks available

- **WHEN** the landing screen is showing first-run steps
- **THEN** the upcoming, recent-activity, unfinished-work, pipeline and next-step blocks are all
  absent
