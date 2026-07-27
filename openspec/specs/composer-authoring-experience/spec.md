# composer-authoring-experience Specification

## Purpose
TBD - created by archiving change refine-composer-authoring. Update Purpose after archive.
## Requirements
### Requirement: The composer keeps the caret where the person put it

Writing SHALL survive interaction with the rest of the composer. Clicking inert chrome, operating a
toolbar control, or opening and dismissing an auxiliary surface SHALL NOT leave the editor unable to
accept input. The person SHALL never have to discover a recovery gesture to resume typing.

#### Scenario: Clicking inert chrome does not strand the caret

- **WHEN** a person clicks a non-interactive region of the composer while writing
- **THEN** the editor SHALL remain able to accept input immediately
- **AND** the person SHALL NOT need to interact with any other control to resume typing

#### Scenario: Clicking the editor card places the caret

- **WHEN** a person clicks the padding of an editor card rather than its text
- **THEN** the composer SHALL place the caret in that editor

#### Scenario: A toolbar control does not take the caret from the text it acts on

- **WHEN** a person applies a formatting mark, inserts a snippet, or runs an AI action from an
  editor's toolbar
- **THEN** the caret SHALL return to that editor when the control finishes
- **AND** the control SHALL NOT leave focus on itself

#### Scenario: The composer opens ready to write

- **WHEN** the composer is opened
- **THEN** the caret SHALL be in the post's text editor

### Requirement: The global text is required only when a channel still inherits it

The global editor holds the text that selected channels use unless they carry their own. It SHALL be
required only when at least one selected channel would otherwise publish nothing. A post whose every
selected channel carries its own non-empty text SHALL be schedulable with the global editor empty.

#### Scenario: Every channel carries its own text

- **WHEN** every selected channel has its own non-empty text and the global editor is empty
- **THEN** the composer SHALL NOT report that the post text is missing
- **AND** scheduling SHALL be available
- **AND** each channel SHALL be scheduled with its own text

#### Scenario: A channel still inherits the global text

- **WHEN** at least one selected channel has no text of its own and the global editor is empty
- **THEN** the composer SHALL report that the post text is missing
- **AND** scheduling SHALL NOT be available

#### Scenario: No channel is selected

- **WHEN** no channel is selected
- **THEN** the composer SHALL report that a channel must be chosen

#### Scenario: A channel's own text is emptied

- **WHEN** a channel is customised and its text is then emptied
- **THEN** the composer SHALL report that channel's text as empty
- **AND** SHALL NOT instead report the global text as missing

#### Scenario: The global editor states that it is unused

- **WHEN** the global editor is empty and every selected channel carries its own text
- **THEN** the global editor SHALL state that it is not in use rather than appear unfilled

### Requirement: Per-network capacity is legible without interaction

Each selected network imposes its own text limit. The composer SHALL state, without requiring hover
or a click, how the current text stands against each selected network's limit, and SHALL distinguish
text that is within the limit from text that exceeds it.

#### Scenario: Each network states its own occupancy

- **WHEN** channels are selected and text is written
- **THEN** the composer SHALL show, per selected network, how much of that network's limit the text
  occupies
- **AND** a network whose limit is exceeded SHALL be distinguishable from one whose limit is not

#### Scenario: The shared view answers for the tightest limit

- **WHEN** the global text is shown and several networks are selected
- **THEN** the count offered alongside it SHALL be measured against the tightest limit among them

### Requirement: Validation is one surface, and every issue leads to its cause

The composer SHALL present blocking issues through a single surface, opened deliberately rather than
by hover. Each instance of that surface SHALL report the issues of the editor it belongs to. An issue
that names a channel SHALL lead to that channel.

#### Scenario: The surface opens on a deliberate action

- **WHEN** a person wants the detail behind the validation state
- **THEN** the surface SHALL open on a deliberate action and not on hover alone

#### Scenario: An issue leads to what raises it

- **WHEN** an issue names a channel
- **THEN** selecting that issue SHALL move the composer to that channel's editor

#### Scenario: A per-channel editor reports its own issues

- **WHEN** the validation surface is opened from a channel's editor
- **THEN** it SHALL report that channel's state
- **AND** SHALL NOT present the issues of channels that are not being edited

#### Scenario: A blocked action explains itself

- **WHEN** scheduling is unavailable because of blocking issues
- **THEN** the composer SHALL state that there are issues to resolve alongside the unavailable action
- **AND** that statement SHALL lead to the same validation surface

#### Scenario: A thread-only issue explains the disabled footer

- **WHEN** the only blocking issue belongs to a thread item
- **THEN** the footer SHALL still render its validation summary
- **AND** the disabled scheduling action SHALL reference a mounted description

### Requirement: An authoring control offers only what the platform performs

A control that writes into the post SHALL only offer content the platform delivers as the control
implies. A control SHALL NOT insert a placeholder that the platform does not substitute before
publishing.

#### Scenario: Placeholders without substitution are not offered

- **WHEN** the platform does not substitute a marker before publishing
- **THEN** the composer SHALL NOT offer a control that inserts that marker

#### Scenario: Literal snippets remain available

- **WHEN** a control inserts text that is published exactly as written
- **THEN** that control MAY be offered
- **AND** its label SHALL describe the text as literal

### Requirement: AI authoring preserves the content scope

The composer SHALL tell an AI action whether it is editing global, channel-specific or thread
content. It SHALL NOT impose a channel limit on global text, discard a paid channel variant, or offer
an adaptation whose result cannot be represented by the edited scope.

#### Scenario: Global rewrite has no arbitrary channel

- **WHEN** a person rewrites shared global text with multiple channels selected
- **THEN** the rewrite request SHALL omit `channelId`
- **AND** the complete result SHALL remain pending for explicit confirmation if another rule requires it

#### Scenario: Global caption returns one result per channel

- **WHEN** caption generation returns variants for several selected channels
- **THEN** every requested variant SHALL be written to its matching channel override
- **AND** no generated variant SHALL replace the shared global text

#### Scenario: Thread does not promise per-network adaptation

- **WHEN** an AI toolbar belongs to a shared thread item
- **THEN** it SHALL NOT offer an action that produces incompatible per-network variants

### Requirement: Scheduling shortcuts respect blocking surfaces

A keyboard shortcut SHALL only perform the same action that is currently available and visible in
the composer. It SHALL NOT schedule behind a confirmation surface or execute more than once for a
repeated key event.

#### Scenario: Discard confirmation suspends scheduling shortcut

- **WHEN** the discard confirmation is open
- **AND** Ctrl/Cmd + Enter is pressed
- **THEN** no scheduling request SHALL start

#### Scenario: Repeated keydown is ignored

- **WHEN** the browser reports a repeated Ctrl/Cmd + Enter keydown
- **THEN** no additional scheduling request SHALL start

### Requirement: Draft persistence status is truthful

The composer SHALL distinguish an in-memory edit from a browser-storage confirmation. It SHALL only
state that a draft is saved after the latest corresponding storage write completes successfully.

#### Scenario: Browser storage rejects the draft

- **WHEN** the latest persistence write throws or rejects
- **THEN** the composer SHALL NOT state that the draft is saved
- **AND** the in-memory draft SHALL remain available

#### Scenario: An older write completes after a newer edit

- **WHEN** a previous storage write completes after a newer draft mutation began
- **THEN** that older completion SHALL NOT mark the newer draft as saved

### Requirement: Generated-image suggestions preserve destination context

The composer SHALL forward a destination channel when it has one unambiguous network suggestion and
SHALL omit that hint when the edited content spans several destinations.

#### Scenario: Global post suggests the first selected network

- **WHEN** image generation opens from the global post editor with selected channels
- **THEN** the first selected channel SHALL be forwarded as an aspect-ratio suggestion

#### Scenario: Shared thread does not invent a destination

- **WHEN** image generation opens from a thread item shared by several channels
- **THEN** no single channel SHALL be asserted as its destination
