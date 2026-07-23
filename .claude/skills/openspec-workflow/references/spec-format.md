# OpenSpec Spec Format Guide

Detailed guide for writing OpenSpec specifications and deltas.

## File Structure

### Spec Files (Source of Truth)
Located in `openspec/specs/<capability>/spec.md`:

```markdown
# <Capability> Specification

## Purpose
Brief description of what this capability does.

## Requirements
### Requirement: Feature Name
The system SHALL/MUST provide [capability].

#### Scenario: Success case
- **WHEN** user performs action
- **THEN** expected result

#### Scenario: Error case
- **WHEN** invalid input provided
- **THEN** error message shown
```

### Delta Files (Proposed Changes)
Located in `openspec/changes/<change-id>/specs/<capability>/spec.md`:

```markdown
# Delta for <Capability>

## ADDED Requirements
### Requirement: New Feature
The system SHALL provide new capability.

#### Scenario: New scenario
- **WHEN** condition
- **THEN** outcome

## MODIFIED Requirements
### Requirement: Existing Feature
[Complete updated requirement with all scenarios]

## REMOVED Requirements
### Requirement: Old Feature
**Reason**: Why removing
**Migration**: How to handle existing usage
```

## Requirement Format

### Header Format
```markdown
### Requirement: Descriptive Name
```

**Rules:**
- Use exactly 3 hashtags (`###`)
- Include "Requirement:" prefix
- Use descriptive, unique names
- Capitalize first letter

**Examples:**
- ✅ `### Requirement: User Authentication`
- ✅ `### Requirement: Two-Factor Authentication`
- ❌ `## Requirement: Auth` (wrong number of hashtags)
- ❌ `### User Authentication` (missing "Requirement:" prefix)

### Requirement Body
```markdown
The system SHALL/MUST [action] [object] [condition].
```

**Rules:**
- Use SHALL or MUST for normative requirements
- Use MAY or SHOULD for optional/recommended features
- Be specific and testable
- Avoid ambiguous terms (e.g., "fast", "easy", "good")

**Examples:**
- ✅ `The system SHALL return a JWT token within 200ms`
- ✅ `Users MUST provide valid credentials to authenticate`
- ❌ `The system should be fast` (vague, not testable)
- ❌ `Authentication works well` (not normative, vague)

## Scenario Format

### Header Format
```markdown
#### Scenario: Descriptive Name
```

**Critical rules:**
- Use exactly 4 hashtags (`####`)
- Include "Scenario:" prefix
- No bullet points before header
- No bold formatting on header

**Examples:**
- ✅ `#### Scenario: Valid credentials provided`
- ✅ `#### Scenario: Invalid password`
- ❌ `- **Scenario: Login**` (bullet point)
- ❌ `**Scenario**: Login` (bold formatting)
- ❌ `### Scenario: Login` (wrong number of hashtags)

### Scenario Body
```markdown
- **WHEN** [condition or action]
- **THEN** [expected outcome]
- **AND** [additional outcome] (optional)
```

**Rules:**
- Use WHEN for preconditions or actions
- Use THEN for expected outcomes
- Use AND for additional outcomes
- Bold the keywords (WHEN, THEN, AND)
- Each scenario must have at least one WHEN and one THEN

**Examples:**
```markdown
#### Scenario: Successful login
- **WHEN** user provides valid credentials
- **THEN** a JWT token is returned
- **AND** the user is redirected to dashboard

#### Scenario: Invalid credentials
- **WHEN** user provides incorrect password
- **THEN** an error message is displayed
- **AND** the login form remains visible
```

## Delta Operations

### ADDED Requirements
Use for new capabilities that don't exist in current specs.

```markdown
## ADDED Requirements
### Requirement: Two-Factor Authentication
Users MUST provide a second factor during login.

#### Scenario: OTP required
- **WHEN** valid credentials are provided
- **THEN** an OTP challenge is required
```

**When to use:**
- Introducing new capability
- Adding orthogonal feature
- New sub-capability that stands alone

### MODIFIED Requirements
Use for changing existing requirement behavior.

```markdown
## MODIFIED Requirements
### Requirement: User Authentication
[PASTE COMPLETE UPDATED REQUIREMENT HERE]

The system SHALL issue a JWT on successful login AND require two-factor authentication.

#### Scenario: Valid credentials
- **WHEN** user submits valid credentials
- **THEN** an OTP challenge is required

#### Scenario: OTP verification
- **WHEN** user provides valid OTP
- **THEN** a JWT is returned
```

**Critical: Include complete requirement**
1. Find existing requirement in `openspec/specs/<capability>/spec.md`
2. Copy entire requirement block (header + all scenarios)
3. Paste under `## MODIFIED Requirements`
4. Edit to reflect new behavior
5. Keep at least one scenario

**When to use:**
- Changing behavior of existing requirement
- Modifying acceptance criteria
- Updating scope or semantics

**Common mistake:**
Using MODIFIED to add new concerns without including previous text. This causes data loss at archive time. If not changing existing requirement, use ADDED instead.

### REMOVED Requirements
Use for deprecating features.

```markdown
## REMOVED Requirements
### Requirement: Password-Only Authentication
**Reason**: Security enhancement - moving to two-factor authentication
**Migration**: Users will be prompted to set up 2FA on next login
```

**When to use:**
- Deprecating feature
- Removing capability
- Replacing with better alternative

**Include:**
- Reason for removal
- Migration path for existing users
- Timeline (if applicable)

### RENAMED Requirements
Use when only the name changes.

```markdown
## RENAMED Requirements
- FROM: `### Requirement: Login`
- TO: `### Requirement: User Authentication`
```

**When to use:**
- Only changing requirement name
- No behavior changes

**If also changing behavior:**
Use RENAMED for the name change, then MODIFIED (referencing new name) for behavior changes.

## Multi-Capability Changes

When a change affects multiple capabilities, create separate delta files:

```
openspec/changes/add-2fa-notify/
├── proposal.md
├── tasks.md
└── specs/
    ├── auth/
    │   └── spec.md   # ADDED: Two-Factor Authentication
    └── notifications/
        └── spec.md   # ADDED: OTP Email Notification
```

Each delta file follows the same format:
```markdown
# Delta for Auth

## ADDED Requirements
### Requirement: Two-Factor Authentication
...
```

```markdown
# Delta for Notifications

## ADDED Requirements
### Requirement: OTP Email Notification
...
```

## Validation Rules

### Required Elements
- ✅ At least one delta operation (ADDED/MODIFIED/REMOVED)
- ✅ At least one requirement per operation
- ✅ At least one scenario per requirement
- ✅ Proper header formatting (### for requirements, #### for scenarios)

### Common Validation Errors

**"Change must have at least one delta"**
- Missing `specs/` directory
- No .md files in `specs/<capability>/`
- Missing operation headers

**"Requirement must have at least one scenario"**
- Missing scenario blocks
- Wrong scenario format (not using ####)
- Scenarios not properly nested under requirement

**"Invalid scenario format"**
- Using bullets before scenario header
- Using bold on scenario header
- Wrong number of hashtags

## Best Practices

### Requirement Writing
1. **Be specific**: "Return JWT within 200ms" not "Be fast"
2. **Be testable**: Include measurable criteria
3. **Be complete**: Cover success and error cases
4. **Be atomic**: One concern per requirement

### Scenario Writing
1. **Cover happy path**: Normal successful usage
2. **Cover edge cases**: Boundary conditions
3. **Cover error cases**: Invalid inputs, failures
4. **Be realistic**: Use actual user workflows

### Delta Writing
1. **Use ADDED for new**: Don't modify existing requirements to add new features
2. **Include full text in MODIFIED**: Don't assume previous content is preserved
3. **Explain REMOVED**: Always include reason and migration path
4. **Keep focused**: One change per delta file

### Naming Conventions
1. **Requirements**: Use noun phrases ("User Authentication", "Payment Processing")
2. **Scenarios**: Use descriptive phrases ("Valid credentials provided", "Payment fails")
3. **Capabilities**: Use verb-noun ("user-auth", "payment-capture")

## Examples

### Complete Spec File
```markdown
# Auth Specification

## Purpose
Authentication and session management for the application.

## Requirements
### Requirement: User Authentication
The system SHALL issue a JWT token on successful login.

#### Scenario: Valid credentials
- **WHEN** a user submits valid username and password
- **THEN** a JWT token is returned
- **AND** the token expires in 24 hours

#### Scenario: Invalid credentials
- **WHEN** a user submits incorrect password
- **THEN** an error message "Invalid credentials" is displayed
- **AND** no token is issued

### Requirement: Session Management
The system SHALL maintain user sessions using JWT tokens.

#### Scenario: Valid token
- **WHEN** a user provides a valid JWT token
- **THEN** the user's session is restored
- **AND** the user can access protected resources

#### Scenario: Expired token
- **WHEN** a user provides an expired JWT token
- **THEN** an error message "Session expired" is displayed
- **AND** the user is redirected to login
```

### Complete Delta File
```markdown
# Delta for Auth

## ADDED Requirements
### Requirement: Two-Factor Authentication
Users MUST provide a second factor (OTP) during login.

#### Scenario: OTP required
- **WHEN** user provides valid credentials
- **THEN** an OTP is sent to user's email
- **AND** user is prompted to enter OTP

#### Scenario: Valid OTP
- **WHEN** user enters correct OTP within 5 minutes
- **THEN** a JWT token is issued
- **AND** user is logged in

#### Scenario: Invalid OTP
- **WHEN** user enters incorrect OTP
- **THEN** an error message "Invalid OTP" is displayed
- **AND** user can retry up to 3 times

#### Scenario: Expired OTP
- **WHEN** user enters OTP after 5 minutes
- **THEN** an error message "OTP expired" is displayed
- **AND** user must request new OTP

## MODIFIED Requirements
### Requirement: User Authentication
The system SHALL issue a JWT token on successful login AND two-factor authentication.

#### Scenario: Valid credentials
- **WHEN** a user submits valid username and password
- **THEN** an OTP challenge is initiated
- **AND** no JWT token is issued yet

#### Scenario: Complete authentication
- **WHEN** user completes OTP verification
- **THEN** a JWT token is returned
- **AND** the token expires in 24 hours

#### Scenario: Invalid credentials
- **WHEN** a user submits incorrect password
- **THEN** an error message "Invalid credentials" is displayed
- **AND** no OTP is sent
```

## Troubleshooting

See `troubleshooting.md` for common errors and solutions.
