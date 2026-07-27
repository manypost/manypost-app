## ADDED Requirements

### Requirement: Publication items have one active owner
The system MUST atomically grant at most one unexpired ownership lease for a
publication item, job version and attempt before invoking an external provider.

#### Scenario: Overlapping thread continuations
- **WHEN** two workers concurrently claim the same publication, job version and thread position
- **THEN** exactly one worker receives ownership and only that worker may call the provider

#### Scenario: Stale job version
- **WHEN** a worker claims an item whose publication job version has changed
- **THEN** the claim is rejected without invoking the provider

### Requirement: Completion is fenced by ownership
The system MUST update an item cursor or terminal publication state only when
the caller presents the current ownership token.

#### Scenario: Expired owner completes late
- **WHEN** a worker returns after its lease was replaced by another owner
- **THEN** its completion update is rejected and cannot advance the cursor

### Requirement: Indeterminate outcomes are not reposted automatically
The system MUST persist an indeterminate outcome and require reconciliation or
human review when an external call may have succeeded but local confirmation
was not committed.

#### Scenario: Provider accepted request before connection loss
- **WHEN** the client loses confirmation after sending a non-idempotent provider request
- **THEN** the publication enters an indeterminate review state and no automatic retry calls the provider

### Requirement: Stable external idempotency is used when available
Provider adapters that support idempotency MUST receive the same opaque
idempotency key for every retry of one logical publication item.

#### Scenario: Idempotent provider retry
- **WHEN** a claimed item is safely retried after a transient failure
- **THEN** the adapter sends the same key and records the single external result

### Requirement: Attempt state remains tenant scoped and observable
Every durable claim, outcome and recovery MUST be scoped through the owning
organization and emit non-secret metrics and structured identifiers.

#### Scenario: Cross-organization lookup
- **WHEN** an attempt identifier is queried through another organization
- **THEN** no attempt data is returned or mutated

#### Scenario: Lease recovery
- **WHEN** recovery reclaims an expired lease
- **THEN** a metric records the recovery without logging content, tokens or credentials
