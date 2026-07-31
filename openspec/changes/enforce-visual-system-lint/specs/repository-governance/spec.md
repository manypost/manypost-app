## MODIFIED Requirements

### Requirement: Deterministic validation gate
CI MUST install with the frozen Bun lockfile and MUST pass TypeScript checks,
tests, boundary checks, brand checks, Drizzle validation, a production web
build and strict OpenSpec validation before merge.

The brand check MUST additionally enforce the visual system mechanically: that surfaces stay flat,
that the product uses one typographic scale and three weights, that product labels are not
upper-cased, that layout spacing stays on its closed scale, and that framing conventions which can be
expressed as line-level patterns are not violated. Each rule MUST be scoped so it constrains product
surfaces without constraining the component kit's internal geometry or the editorial regime.

#### Scenario: Broken web production build
- **WHEN** Next.js cannot complete a production build
- **THEN** CI and the container image build fail instead of producing an apparently successful artifact

#### Scenario: Gradient relief is reintroduced
- **WHEN** a change reintroduces a relief class, a relief token, or a hand-written vertical fill
  gradient outside the token file
- **THEN** the gate fails, so the removal cannot be undone silently or left behind as dead code

#### Scenario: A raw size utility is used on a product surface
- **WHEN** a product surface uses a size utility outside the named scale
- **THEN** the gate fails
- **AND** an editorial surface using the display typeface on the same line is permitted
- **AND** provider-like typography is permitted only in the explicitly allowlisted post-preview
  implementation

#### Scenario: A product label is upper-cased
- **WHEN** a product surface upper-cases label text
- **THEN** the gate fails
- **AND** authentication and onboarding surfaces remain permitted

#### Scenario: Layout spacing leaves the closed scale
- **WHEN** a feature surface uses a spacing step outside the closed scale, or corrects spacing with a
  negative margin
- **THEN** the gate fails
- **AND** the component kit's own internal geometry is not constrained by these rules

#### Scenario: A rule is added before its code is conformant
- **WHEN** a new visual rule is proposed
- **THEN** it is introduced together with the change that makes the codebase satisfy it
- **AND** it is not added ahead of that change, which would fail the gate on unmigrated code

#### Scenario: A visual property cannot be expressed as a line-level pattern
- **WHEN** a visual property such as border nesting, contrast ratio or semantic token choice cannot be
  checked by a line-level pattern
- **THEN** it is covered by a focused test or by review
- **AND** the gate does not claim to verify it
