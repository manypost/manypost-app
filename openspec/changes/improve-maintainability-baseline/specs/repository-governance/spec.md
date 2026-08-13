## ADDED Requirements

### Requirement: Visual conformance tests do not pin exact markup

Feature-level visual conformance tests SHALL assert either rendered component output or generic
brand rules over source (the `cn()` composition hole that line-based linting cannot see). A test
MUST NOT assert exact class strings, exact call expressions or exact occurrence counts against
component source text, because those pins fail on legitimate refactors without any visual change.

#### Scenario: A component file is refactored without visual change

- **WHEN** a component is split, renamed internally or has its classes recomposed via `cn()`
  with identical rendered output
- **THEN** the feature's visual conformance tests keep passing

#### Scenario: A brand rule is violated inside a cn() composition

- **WHEN** a banned pattern (shadow, hover movement, raw type scale, arbitrary radius) is
  introduced through a composed `className`
- **THEN** a source-rule test or the rendered assertion fails

### Requirement: Every repository proves organization scoping

Each repository in `packages/db` SHALL have at least one test proving that reads and mutations are
scoped by `org_id` — directly or through a join to an already-scoped parent — so a missing filter
fails a test instead of leaking a tenant's data.

#### Scenario: A repository query drops its organization filter

- **WHEN** a repository method is changed so a second organization's rows become reachable
- **THEN** a scoping test fails
