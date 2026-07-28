# calendar-interface-experience Specification

## Purpose
TBD - created by archiving change refine-home-calendar-visuals. Update Purpose after archive.
## Requirements
### Requirement: Calendar controls use compact product proportions

The calendar SHALL use the product's named compact typography and restrained
spacing for its toolbar, channel controls, day selector, time slots and
publication cards while preserving usable touch targets.

#### Scenario: Calendar is opened on a wide viewport

- **WHEN** the calendar renders its desktop toolbar, channel panel and grid
- **THEN** controls and labels follow the compact product scale
- **AND** the grid preserves the same views, data and interactions

#### Scenario: Calendar is opened on a narrow viewport

- **WHEN** the calendar renders its mobile channel controls, day selector and
  timeline
- **THEN** those elements use compact typography, icons, padding and vertical
  rhythm
- **AND** interactive controls remain at least 32 CSS pixels high

### Requirement: The calendar primary action has sufficient contrast

The calendar SHALL render the “Criar post” label with a white foreground on its
brand-colored primary button.

#### Scenario: Create-post action is rendered

- **WHEN** the channel panel shows the “Criar post” action on a desktop or
  mobile viewport
- **THEN** the action's foreground is explicitly white

### Requirement: Calendar refinement preserves behavior

The visual refinement MUST NOT change calendar navigation, URL state, channel
filtering, drag-and-drop, detail actions or scheduling behavior.

#### Scenario: Existing calendar interaction is used

- **WHEN** a person changes view or date, filters a channel, opens or duplicates
  a publication, removes an eligible publication, drags a schedulable
  publication, or starts a new post
- **THEN** the same state transition and destination used before the visual
  refinement occur
