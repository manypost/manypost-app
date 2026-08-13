## MODIFIED Requirements

### Requirement: Deterministic validation gate
CI MUST install with the frozen Bun lockfile and MUST pass TypeScript checks,
tests, boundary checks, brand checks, Drizzle validation, a production web
build and strict OpenSpec validation before merge.

The brand check MUST additionally enforce the active visual system mechanically: product text uses
the named compact scale and approved weights, labels remain sentence case, layout spacing stays on
its closed scale, persistent surfaces do not receive shadows or arbitrary gradients, and role-based
radii remain within the documented set. Semantic exceptions MUST be scoped to their owning primitive
or named data-visualization utility rather than weakening a rule globally.

#### Scenario: Broken web production build
- **WHEN** Next.js cannot complete a production build
- **THEN** CI and the container image build fail instead of producing an apparently successful artifact

#### Scenario: Shadow is used outside the tooltip primitive
- **WHEN** a component other than the tooltip declares a visible shadow
- **THEN** the gate fails

#### Scenario: Gradient is used as product-surface decoration
- **WHEN** a shell, card, navigation, field or button declares a fill gradient
- **THEN** the gate fails
- **AND** named active-bar, donut-segment and area-fill visualization utilities remain permitted

#### Scenario: A raw compact size is used on a product surface
- **WHEN** a product surface uses a compact font-size utility outside the named scale
- **THEN** the gate fails
- **AND** marketing, authentication, onboarding and provider-preview exceptions remain explicitly scoped

#### Scenario: A role radius leaves the approved set
- **WHEN** product code declares an arbitrary radius outside 4, 5, 8, 10, 11, 12 or the documented full-radius roles
- **THEN** the gate fails

#### Scenario: A product label is upper-cased
- **WHEN** a product surface upper-cases label text
- **THEN** the gate fails
- **AND** authentication and onboarding surfaces remain permitted

#### Scenario: Layout spacing leaves the closed scale
- **WHEN** a feature surface uses a spacing step outside 4, 8, 12, 16, 20, 24, 28 or 32px, or corrects spacing with a negative margin
- **THEN** the gate fails
- **AND** the component kit's own internal geometry is not constrained by these rules

#### Scenario: A visual property cannot be expressed as a line-level pattern
- **WHEN** a visual property such as semantic token choice, alignment or responsive composition cannot be checked by a line-level pattern
- **THEN** it is covered by a focused test or by browser review
- **AND** the gate does not claim to verify it
