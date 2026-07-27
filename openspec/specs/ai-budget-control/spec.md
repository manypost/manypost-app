# ai-budget-control Specification

## Purpose
TBD - created by archiving change add-ai-content-assistance. Update Purpose after archive.
## Requirements
### Requirement: No model call happens outside the budget guard

The system SHALL reserve allowance before calling a model and SHALL resolve
every reservation exactly once, by committing the actual consumption or by
releasing it. A code path that reaches a model without a reservation is a defect.

#### Scenario: Successful generation commits what it used

- **WHEN** a generation is requested and the model answers
- **THEN** a reservation was taken before the call
- **AND** the reservation is committed with the tokens actually consumed

#### Scenario: Failed generation releases the reservation

- **WHEN** a generation is requested and the model call fails or times out
- **THEN** the reservation is released
- **AND** the organization's remaining allowance is what it was before the
  request

#### Scenario: Unusable answer does not charge the organization

- **WHEN** the model answers but the answer cannot be used
- **THEN** the reservation is released rather than committed

### Requirement: A reservation cannot exceed the remaining allowance

The system SHALL grant a reservation only when the granted allowance minus what
is already used and already reserved covers the request, and SHALL make that
decision in a single conditional operation that concurrent requests cannot
interleave.

#### Scenario: Allowance is exhausted

- **WHEN** the remaining allowance is smaller than the requested reservation
- **THEN** the request is refused with the budget-exceeded error
- **AND** no model call is made

#### Scenario: Concurrent requests cannot oversell

- **WHEN** ten generations are requested simultaneously against an allowance
  that covers five
- **THEN** exactly five reservations are granted
- **AND** five requests are refused with the budget-exceeded error
- **AND** the sum of used and reserved allowance never exceeds what was granted

#### Scenario: Refusal names the upgrade path

- **WHEN** an organization on an enforced plan exhausts its allowance
- **THEN** the refusal identifies the exhausted allowance and its renewal date
- **AND** the operation is not silently degraded to a cheaper model

### Requirement: Allowance periods are derived from the plan catalog

The system SHALL take the monthly allowance from the plan catalog rather than
from a separate configuration, and SHALL open the current period's bucket on
first use.

#### Scenario: First AI action of a period

- **WHEN** an organization requests a generation and no bucket covers the
  current moment
- **THEN** a bucket is opened for the current period with the allowance its plan
  grants
- **AND** the reservation is taken against that bucket

#### Scenario: Plan without AI

- **WHEN** an organization whose plan grants no allowance requests a generation
- **THEN** the request is refused before any model call

### Requirement: An unresolved reservation is reclaimed

The system SHALL give every reservation a lease and SHALL reclaim reservations
whose lease has expired, so that a process that dies mid-generation cannot
permanently reduce an organization's allowance.

#### Scenario: Process dies between reserving and committing

- **WHEN** a reservation exists whose lease has expired
- **AND** the same organization requests another generation
- **THEN** the expired reservation is released before the new one is evaluated
- **AND** the released amount is available again

#### Scenario: Resolution is idempotent

- **WHEN** a reservation that is already committed is committed again
- **THEN** the allowance is unchanged by the second attempt

#### Scenario: A reclaimed reservation cannot be committed later

- **WHEN** a reservation was released because its lease expired
- **AND** the original request then tries to commit it
- **THEN** the commit does not consume allowance a second time

### Requirement: Self-hosted installations record without refusing

The system SHALL apply the reservation mechanism in every installation, and
SHALL enforce the numbers only where the plan is enforced. A self-hosted
installation MUST NOT be refused for budget.

#### Scenario: Self-hosted generation

- **WHEN** an installation that does not enforce plans requests a generation
- **THEN** the reservation is granted regardless of any allowance
- **AND** the consumption is still recorded for the operator's telemetry

### Requirement: Consumption is recorded per operation

The system SHALL record, for each reservation, the organization, the operation
that requested it, the estimate, the outcome and the tokens consumed, so an
operator can attribute cost. That record MUST NOT contain the prompt, the
generated content, the API key or the vendor identity.

#### Scenario: Operator inspects consumption

- **WHEN** an operator reads the consumption records for an organization
- **THEN** each record identifies the operation and what it consumed

#### Scenario: Records carry no content and no secret

- **WHEN** any consumption record is written
- **THEN** it contains neither prompt text, generated text, nor any credential
