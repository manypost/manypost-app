## ADDED Requirements

### Requirement: One keystroke opens a command surface from anywhere

The system SHALL open a command palette from any authenticated screen using the platform's command
or control key with `K`, and SHALL also offer a visible trigger so the shortcut is discoverable. The
shortcut MUST NOT fire while the person is typing into a text field, and the palette SHALL be fully
operable by keyboard.

#### Scenario: The shortcut is pressed

- **WHEN** a person presses the platform shortcut on an authenticated screen
- **THEN** the palette opens with the query field focused

#### Scenario: The person is typing into a field

- **WHEN** focus is inside a text input, a text area or an editable region
- **THEN** the shortcut does not open the palette

#### Scenario: The palette is navigated

- **WHEN** the palette is open
- **THEN** the arrow keys move the selection across all sections, wrapping at the ends
- **AND** confirming runs the selected entry
- **AND** dismissing closes the palette and returns focus to where it was

#### Scenario: The shortcut is undiscovered

- **WHEN** a person has never used the shortcut
- **THEN** a visible trigger in the application header opens the same palette
- **AND** it states the shortcut

### Requirement: The palette finds screens, actions, channels and posts

The system SHALL search application screens, primary actions, the organization's connected channels
and the text of the organization's posts. It SHALL group results by kind and state what each result
is. Media SHALL NOT be searchable in this capability, and the palette MUST NOT imply otherwise.

#### Scenario: A screen is found

- **WHEN** a query matches a screen's name or its keywords
- **THEN** the screen is offered and choosing it navigates there

#### Scenario: An action is found

- **WHEN** a query matches a primary action such as composing a post or connecting a channel
- **THEN** the action is offered and choosing it starts it

#### Scenario: A channel is found

- **WHEN** a query matches a connected channel's name or handle
- **THEN** the channel is offered and choosing it opens the connections screen

#### Scenario: A post is found

- **WHEN** a query matches the text of a post in the organization
- **THEN** the post is offered with an excerpt, its state and its channels
- **AND** choosing it opens that post

#### Scenario: Media is sought

- **WHEN** a query would match media
- **THEN** no media result is shown
- **AND** the media screen is still reachable as a screen result

### Requirement: Result ordering is deterministic and diacritic-insensitive

The system SHALL order results by an explainable rule: a stronger match outranks a weaker one, and
equal matches are broken by a fixed kind precedence and then by a stable catalog order. Matching
SHALL ignore case and diacritics. The same query over the same data SHALL always produce the same
order.

#### Scenario: Matches differ in strength

- **WHEN** one result matches from the start of its name and another matches in the middle
- **THEN** the result matching from the start is ordered first

#### Scenario: Matches are equally strong

- **WHEN** two results match equally well
- **THEN** their order is decided by kind precedence and then by a stable order
- **AND** repeating the query produces the same order

#### Scenario: The query omits diacritics

- **WHEN** a person types a query without diacritics
- **THEN** entries whose text carries those diacritics match

#### Scenario: Nothing matches

- **WHEN** no entry matches the query
- **THEN** the palette says that nothing matched
- **AND** it does not show unrelated entries to fill the space

### Requirement: The post search is organization-scoped and bounded

The system SHALL expose post search as an authenticated read whose organization comes from the
authenticated principal and never from the request. The read SHALL require a minimum query length,
SHALL cap the number of results regardless of what the caller requests, and SHALL restrict itself to
a recency window. The query value SHALL be parameterized and never interpolated into the statement.

#### Scenario: Results belong to one organization

- **WHEN** two organizations hold posts matching the same text
- **THEN** each caller receives only its own organization's posts

#### Scenario: The organization is asserted by the caller

- **WHEN** a request carries an organization identifier of its own
- **THEN** it is ignored and the authenticated principal's organization is used

#### Scenario: The query is too short

- **WHEN** a query shorter than the minimum is submitted
- **THEN** the request is refused as invalid rather than scanning

#### Scenario: An oversized result count is requested

- **WHEN** a caller requests more results than the cap
- **THEN** the request is refused rather than silently returning the cap

#### Scenario: An unauthenticated request arrives

- **WHEN** no valid session accompanies the request
- **THEN** the request is refused as unauthenticated

#### Scenario: Results are returned

- **WHEN** matching posts are returned
- **THEN** each carries only its identifier, state, schedule time, an excerpt of its text and its
  channels' names
- **AND** no credential, token or personal data is included

#### Scenario: A deleted post matches

- **WHEN** a matching post group was deleted
- **THEN** it is not returned

#### Scenario: The query omits diacritics that the post carries

- **WHEN** a query without diacritics would match post text that carries them
- **THEN** the post is returned
- **AND** the same holds when the query carries diacritics the post omits

### Requirement: A failing post search leaves the palette usable

The system SHALL render screens, actions and channels from data already held, without waiting for
the post search, and SHALL isolate the post search's loading and failure to its own section.

#### Scenario: The person begins typing

- **WHEN** the first characters are typed
- **THEN** matching screens, actions and channels appear immediately
- **AND** the post section indicates that it is still loading

#### Scenario: The post search fails

- **WHEN** the post search request fails
- **THEN** only the post section reports the failure
- **AND** screens, actions and channels remain listed and choosable

#### Scenario: The query is below the search minimum

- **WHEN** the query is shorter than the post search requires
- **THEN** no post request is made
- **AND** the other sections still respond
