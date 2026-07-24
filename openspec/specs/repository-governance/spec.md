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

#### Scenario: Broken web production build
- **WHEN** Next.js cannot complete a production build
- **THEN** CI and the container image build fail instead of producing an apparently successful artifact

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

