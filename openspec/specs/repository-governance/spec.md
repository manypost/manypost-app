# repository-governance Specification

## Purpose
TBD - created by archiving change establish-maintenance-baseline. Update Purpose after archive.
## Requirements
### Requirement: Reproducible local OpenSpec
The repository SHALL provide OpenSpec 1.6.0 as an exact local development
dependency and SHALL expose commands for creating, inspecting, strictly
validating and archiving changes without a global installation.

#### Scenario: Clean contributor installation
- **WHEN** a contributor installs dependencies with `bun install --frozen-lockfile`
- **THEN** the OpenSpec 1.6.0 CLI is available through repository scripts

#### Scenario: Strict repository validation
- **WHEN** a contributor runs `bun run spec:validate`
- **THEN** all living specs and active changes are validated in strict non-interactive mode

### Requirement: Specification precedes material implementation
Contributors MUST create or update an OpenSpec change before implementing a
material feature, behavior change, schema change, integration change or
cross-module refactor.

#### Scenario: Material behavior change
- **WHEN** a change modifies externally visible behavior or a cross-module contract
- **THEN** its proposal, requirements, design when needed and tasks exist before implementation

#### Scenario: Small maintenance exception
- **WHEN** a change is a typo or a behavior-preserving, single-file maintenance edit
- **THEN** the pull request documents why a new OpenSpec change is unnecessary

### Requirement: Navigable maintenance documentation
The repository SHALL maintain a canonical architecture entry point, repository
map, end-to-end flows, data/infrastructure guide and development operations
guide with source paths and verified commands.

#### Scenario: New maintainer locates a change
- **WHEN** a maintainer needs to modify authentication, publishing, a provider, database schema or deployment
- **THEN** the documentation identifies the owning module, entry points, dependencies, risks and validation commands

### Requirement: Hierarchical contribution rules
The repository SHALL provide root agent instructions and scoped database and
provider instructions that state package boundaries, security rules, generated
files, test expectations and definition of done.

#### Scenario: Scoped database work
- **WHEN** a contributor works under `packages/db`
- **THEN** the root rules and database-specific migration and tenant-isolation rules both apply

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

### Requirement: Synchronized change record
Every user-, developer- or operator-relevant change MUST update `CHANGELOG.md`
and the affected architecture or operation document in the same pull request.

#### Scenario: Pull request changes runtime or workflow
- **WHEN** a pull request changes runtime behavior, development commands, data, integration or deployment
- **THEN** it includes the applicable changelog entry and synchronized documentation

### Requirement: Secret-safe artifacts
Specifications, documentation, commits and pull requests MUST contain variable
names and expected formats only, never real secret values or production
connection strings.

#### Scenario: Documenting Railway configuration
- **WHEN** Railway environment configuration is documented
- **THEN** purpose, requiredness and format are recorded without reading or copying the value

