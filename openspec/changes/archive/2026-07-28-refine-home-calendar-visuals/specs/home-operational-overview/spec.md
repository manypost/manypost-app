## ADDED Requirements

### Requirement: The Home preserves contrast and uses restrained motion

The authenticated Home SHALL keep its primary “Novo post” action readable with
a white foreground on the brand-colored surface, and SHALL use only subtle
visual refinement that preserves the existing information architecture.

#### Scenario: Primary Home action is rendered

- **WHEN** the Home header shows the “Novo post” action
- **THEN** its foreground is explicitly white against the primary surface

#### Scenario: Home content becomes available

- **WHEN** operational Home content is rendered
- **THEN** existing blocks MAY enter with a short opacity-and-transform
  transition and SHALL keep their current content and ordering
- **AND** existing interactive surfaces SHALL provide restrained hover and
  focus feedback without introducing a new section

#### Scenario: Reduced motion is requested

- **WHEN** the person's system requests reduced motion
- **THEN** all Home content SHALL render immediately in its final position and
  opacity without entrance animation
