## ADDED Requirements

### Requirement: Manypost is the current product identity
Current user-facing interface, operational documentation, application metadata
and repository-owned configuration SHALL use Manypost unless an explicitly
documented compatibility, attribution, historical or human-decision exception
applies.

#### Scenario: Safe current wording
- **WHEN** a repository-owned current product label has no external compatibility or legal role
- **THEN** it uses Manypost naming and casing

### Requirement: Legacy references are classified before editing
Every tracked case-insensitive Postiz occurrence MUST be assigned to exactly one
of six categories: direct safe replacement, technical refactor, compatibility,
license/attribution, historical, or human decision.

#### Scenario: Identity audit
- **WHEN** the repository is searched for `postiz`, `Postiz`, `POSTIZ` and derived names
- **THEN** every result is covered by the identity inventory with file, reason, alteration risk and recommendation

### Requirement: Protected provenance remains intact
License notices, attribution, fork provenance, historical analysis, preserved
references and already-applied migration history MUST NOT be renamed solely to
match the current product.

#### Scenario: Legal or historical occurrence
- **WHEN** a Postiz occurrence records original authorship, source derivation or historical fact
- **THEN** it remains unchanged and its preservation reason is documented

### Requirement: Compatibility changes require explicit design
Persisted values, package/API identifiers, domains, telemetry keys, external
integration identifiers and migration names containing legacy identity MUST
remain unchanged until an OpenSpec change defines compatibility and migration.

#### Scenario: Non-trivial identifier
- **WHEN** a legacy name participates in an external or persisted contract
- **THEN** it is classified as technical refactor, compatibility or human decision and is not directly replaced

### Requirement: Residual search is auditable
The completed identity migration SHALL include a final tracked-file search and
SHALL map every residual occurrence to categories 2 through 6.

#### Scenario: Final identity validation
- **WHEN** category 1 edits are complete
- **THEN** the residual count and protected groups are recorded and `bun run check:brand` passes
