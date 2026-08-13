## ADDED Requirements

### Requirement: The board derives columns from group and publication state

The system SHALL place each post group in exactly one board column derived from the group's state
and the states of its publications: drafts without a pending approval, drafts awaiting approval,
scheduled work, published work, and work that needs a person. A cancelled group SHALL NOT appear on
the board. The derivation SHALL be a pure, named rule covered by tests rather than a side effect of
rendering.

#### Scenario: A scheduled group has a failed publication

- **WHEN** a group is scheduled and at least one of its publications is failed or needs review
- **THEN** the group appears in the column for work that needs a person

#### Scenario: A partially delivered group still needs a person

- **WHEN** a group delivered to some channels and at least one publication is failed or needs review
- **THEN** the group appears in the column for work that needs a person
- **AND** it does not appear as published

#### Scenario: A partially delivered group needs no person

- **WHEN** a group delivered to some channels and no publication is failed or needs review
- **THEN** the group appears as published

#### Scenario: A draft awaits approval

- **WHEN** a draft group has a pending, unexpired approval link
- **THEN** it appears in the awaiting-approval column rather than the draft column

#### Scenario: A group was cancelled

- **WHEN** a group is cancelled
- **THEN** it appears in no column

### Requirement: The board states when it could not read the whole window

The system SHALL read the whole requested window by following the feed's cursor up to a documented
page ceiling. When the window still holds more than the ceiling, the board SHALL say so and offer
narrowing the window. The board MUST NOT present a truncated read as a complete one.

#### Scenario: The window fits within the ceiling

- **WHEN** the requested window holds fewer entries than the ceiling
- **THEN** the board shows every entry in the window
- **AND** no truncation notice is shown

#### Scenario: The window exceeds the ceiling

- **WHEN** the requested window holds more entries than the ceiling
- **THEN** the board states that it is showing only the first entries
- **AND** it offers narrowing the time window

#### Scenario: Columns are counted

- **WHEN** the board shows a count on a column
- **THEN** that count reflects the entries the board actually read
- **AND** the count is not presented as the organization's total

### Requirement: The board can be narrowed and the narrowed view can be shared

The system SHALL let a person restrict the board by channel, by column, by text within the card
content, and by time window. Filter state SHALL live in the screen's address so the narrowed board
can be shared and survives returning to the screen. Text matching SHALL ignore diacritics and case.

#### Scenario: A filter is applied

- **WHEN** a person restricts the board by channel, column, text or window
- **THEN** only matching cards remain
- **AND** the address reflects the restriction

#### Scenario: A narrowed board is reopened

- **WHEN** a person opens an address carrying filter state
- **THEN** the board opens already narrowed to it

#### Scenario: Text is matched across diacritics

- **WHEN** a person types a query without diacritics that matches accented card content
- **THEN** the accented card matches

#### Scenario: A filter excludes everything

- **WHEN** no card matches the restriction
- **THEN** the board states that the filter excluded everything and offers clearing it
- **AND** it does not present the result as an empty pipeline

### Requirement: Drag performs only transitions the platform can perform

The system SHALL accept a closed set of drag transitions, each mapping to an operation the platform
actually performs, and SHALL refuse every other transition with a message naming why it cannot
happen and offering the operation that would work. A card in the published column SHALL NOT be
draggable. Cancelling by drag SHALL require confirmation.

#### Scenario: Failed work is dragged to scheduled

- **WHEN** a card in the needs-a-person column is dropped on the scheduled column
- **THEN** the platform retries that post
- **AND** the board reports the outcome

#### Scenario: Work is dragged to the cancel target

- **WHEN** a draft, awaiting-approval or scheduled card is dropped on the cancel target
- **THEN** the person is asked to confirm
- **AND** on confirmation the post is cancelled and leaves the board

#### Scenario: The cancel target is not resting state

- **WHEN** no drag is in progress
- **THEN** the cancel target is absent from the board
- **AND** the board has no cancelled column

#### Scenario: An awaiting-approval card is dragged to scheduled

- **WHEN** a card awaiting approval is dropped on the scheduled column
- **THEN** the board refuses the move
- **AND** states that approval happens through the approval link, offering that link

#### Scenario: A draft card is dragged to scheduled

- **WHEN** a draft card is dropped on the scheduled column
- **THEN** the board refuses the move
- **AND** states that a draft is not scheduled directly, offering to duplicate it into the composer

#### Scenario: Publishing is never a drop

- **WHEN** any card is dropped on the published column
- **THEN** the board refuses the move
- **AND** publishing immediately remains available only as a confirmed action from the card's menu

### Requirement: A card carries its own actions without nesting controls

The system SHALL give each card an actions menu offering only the operations valid for that card's
state, and SHALL structure the card so that its selection control and its menu are not nested inside
the control that opens the post. Destructive actions SHALL require confirmation.

#### Scenario: A card's menu is opened

- **WHEN** a person opens a card's actions menu
- **THEN** it offers only operations valid for that card's state

#### Scenario: A published card's menu is opened

- **WHEN** the card is published
- **THEN** the menu offers no retry, no cancel and no immediate publish

#### Scenario: An immediate publish is chosen

- **WHEN** a person chooses to publish a scheduled post immediately
- **THEN** confirmation is required before the post is rescheduled to now

#### Scenario: The card is rendered

- **WHEN** a card renders its selection control, its menu trigger and its open target
- **THEN** no interactive control is nested inside another interactive control

### Requirement: Bulk operations report partial success

The system SHALL let a person select many cards, including selecting a contiguous range, and apply
retry or cancel to the selection. Selection size SHALL be bounded. The system SHALL skip cards the
operation cannot apply to and state why, and after execution SHALL report how many succeeded and how
many failed rather than claiming uniform success.

#### Scenario: A bulk retry is applied to a mixed selection

- **WHEN** a selection contains cards that cannot be retried
- **THEN** those cards are skipped with a stated reason
- **AND** only the eligible cards are retried

#### Scenario: Some operations in a bulk run fail

- **WHEN** part of a bulk run fails
- **THEN** the board reports the number that succeeded and the number that failed
- **AND** the failures can be inspected

#### Scenario: The selection exceeds the bound

- **WHEN** a person selects more cards than the bound allows
- **THEN** the board refuses to run and states the bound

#### Scenario: A bulk cancel is applied

- **WHEN** a person applies cancel to a selection
- **THEN** confirmation is required before any post is cancelled

### Requirement: The board is operable without a pointer

The system SHALL let a person move a card between columns using the keyboard, SHALL make every card
control reachable by keyboard focus, and SHALL show a visible drag representation while a card is
being moved.

#### Scenario: A card is moved by keyboard

- **WHEN** a person focuses a draggable card and uses the keyboard to move it
- **THEN** the same transition rules apply as for pointer drag

#### Scenario: Card controls are reached by keyboard

- **WHEN** a person moves focus through a card
- **THEN** the open target, the selection control and the menu trigger are all reachable
- **AND** each shows a visible focus indicator

#### Scenario: A card is being dragged

- **WHEN** a drag is in progress
- **THEN** a representation of the dragged card follows the pointer or keyboard target

### Requirement: Board density is a personal preference

The system SHALL offer a comfortable and a compact presentation of the board and SHALL remember the
choice for the person's browser. Density SHALL NOT be carried in the screen's address, because it
describes the person rather than the view being shared.

#### Scenario: Compact density is chosen

- **WHEN** a person chooses the compact presentation
- **THEN** cards show less content per card and more cards fit in a column

#### Scenario: The board is reopened

- **WHEN** a person returns to the board in the same browser
- **THEN** the previously chosen density is applied

#### Scenario: A narrowed board is shared

- **WHEN** a narrowed board's address is opened by another person
- **THEN** the filters apply and the recipient's own density preference is used

### Requirement: The board renders an honest editorial work surface

The system SHALL present the five operational states as open lanes separated by visible rules,
SHALL keep empty lanes visible, SHALL NOT display a capacity denominator without a real capacity
model, and SHALL use optional feed media to improve recognition without hiding operational text or
actions.

#### Scenario: A post has an image preview

- **WHEN** a card's first available preview is an image
- **THEN** the card renders it in a compact 4:3 crop with meaningful alternative text when present

#### Scenario: A post has a video preview

- **WHEN** a card's first available preview is a video
- **THEN** the card renders a neutral play tile without eagerly loading the video

#### Scenario: A post has no preview

- **WHEN** no usable preview is available
- **THEN** the card reserves no empty media area

#### Scenario: A lane has no cards

- **WHEN** a lane is empty in the current view
- **THEN** its header and zero count remain visible
- **AND** no fictional capacity value is shown
