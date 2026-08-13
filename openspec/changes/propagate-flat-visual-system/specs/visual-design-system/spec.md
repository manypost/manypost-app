## ADDED Requirements

### Requirement: Every authenticated surface follows the editorial system

The brand v1.5 editorial composition SHALL apply to every authenticated product surface — calendar,
composer, media library, connections, notifications, settings and billing — not only to the shell,
Home and Quadro. Auth, onboarding, approval and OAuth surfaces SHALL receive the corresponding
editorial treatment. A surface MUST NOT mix the previous visual generation with the editorial
system.

#### Scenario: A remaining product surface is opened

- **WHEN** the calendar, composer, media library, connections, notifications, settings or billing
  screen is rendered
- **THEN** it uses the warm canvas, the named type scale, the three weight roles, one level of
  border per region and the closed spacing scale

#### Scenario: An identity or handoff surface is opened

- **WHEN** an auth, onboarding, approval or OAuth consent surface is rendered
- **THEN** it composes with the editorial regime consistently with the approved reference
- **AND** its behavioral contracts are unchanged

#### Scenario: A new archetype is implemented

- **WHEN** a remaining screen archetype is implemented
- **THEN** a fresh standalone reference is generated and inspected first
- **AND** the approved board reference is never cropped
