## ADDED Requirements

### Requirement: Clerk authenticates human users
The web application SHALL use the linked Clerk application for human sign-in,
sign-up, email verification and supported external identity providers while
presenting Manypost-owned authentication screens.

#### Scenario: User signs in with a password
- **WHEN** a user submits valid Clerk credentials through the Manypost login UI
- **THEN** Clerk completes authentication and Manypost establishes its internal organization-scoped session

#### Scenario: User signs up with email verification
- **WHEN** a new user registers through the Manypost registration UI
- **THEN** the UI MUST complete Clerk's required email verification before requesting an internal Manypost session

#### Scenario: User authenticates with Google
- **WHEN** a user selects Google on a Manypost authentication screen
- **THEN** Clerk SHALL own the OAuth transaction and return the user to the configured Manypost callback

#### Scenario: Additional verification is required
- **WHEN** Clerk reports a second-factor, client-trust or session-task requirement
- **THEN** the UI SHALL keep the user unauthenticated in Manypost and present a safe continuation path

### Requirement: Clerk identities exchange for internal sessions
The API SHALL issue an internal Manypost session only after independently
verifying the Clerk session token and resolving a verified Clerk identity.

#### Scenario: Valid Clerk identity is exchanged
- **WHEN** the API receives a valid Clerk session token from an authorized Manypost web origin
- **THEN** it SHALL resolve the stable Clerk subject and verified primary email before issuing an internal session

#### Scenario: Missing or invalid token is rejected
- **WHEN** the exchange request omits a token or supplies a token with invalid signature, issuer, lifetime or authorized party
- **THEN** the API MUST return an authentication error without creating a user, organization, identity or session

#### Scenario: Browser injects organization claims
- **WHEN** a valid exchange request also contains browser-controlled organization, role or user identifiers
- **THEN** the API MUST ignore those values and derive authorization only from persisted Manypost data

#### Scenario: Clerk lookup is unavailable
- **WHEN** token verification or Clerk identity resolution fails transiently
- **THEN** the API SHALL fail the exchange without issuing a session and SHALL NOT retry a state-changing operation blindly

### Requirement: Internal identity provisioning is tenant-safe and idempotent
Manypost SHALL persist Clerk as an external identity while retaining its own
users, organizations, memberships and roles as the authorization source of
truth.

#### Scenario: New verified Clerk user signs in
- **WHEN** no internal identity or user matches the verified Clerk identity
- **THEN** Manypost SHALL atomically create one user, one owner organization, one owner membership and one Clerk identity link

#### Scenario: Existing email is linked
- **WHEN** no Clerk identity exists but a normalized internal email matches the verified Clerk primary email
- **THEN** Manypost SHALL link the Clerk subject to that user without creating another user or organization

#### Scenario: Existing Clerk identity signs in again
- **WHEN** the same Clerk subject exchanges another valid session
- **THEN** Manypost SHALL reuse the existing user and membership without duplicating persisted records

#### Scenario: Clerk email is not verified
- **WHEN** Clerk does not provide a verified primary email for the authenticated subject
- **THEN** Manypost MUST reject provisioning and MUST NOT link by email

#### Scenario: Concurrent first exchanges occur
- **WHEN** two valid exchange requests for the same Clerk subject race
- **THEN** persistence constraints and transaction handling MUST produce one identity link and one initial tenant

### Requirement: Browser session lifecycle remains coherent
The web application SHALL treat the Clerk session and the internal Manypost
session as one user-visible authentication lifecycle.

#### Scenario: Protected route has no Clerk session
- **WHEN** an unauthenticated browser requests a protected web route
- **THEN** the Next.js proxy SHALL redirect it to the Manypost login page while leaving public approval and Clerk proxy paths reachable

#### Scenario: Signed-in user opens an auth page
- **WHEN** a browser with a valid Clerk session requests login or registration
- **THEN** the application SHALL redirect to its authenticated landing route

#### Scenario: User logs out
- **WHEN** a signed-in user chooses logout
- **THEN** the application SHALL end both the internal Manypost session and the Clerk session before returning to login

#### Scenario: Internal session expires while Clerk remains valid
- **WHEN** a protected API request cannot refresh the internal session but Clerk still has a valid session
- **THEN** the web application SHALL perform at most one deduplicated Clerk exchange before requiring interactive login

### Requirement: Authentication controls match the Manypost interface
Sign-in, sign-up and signed-in user controls SHALL be clear, accessible and
integrated into the existing Manypost layouts rather than duplicating a second
visual system.

#### Scenario: Signed-out controls are visible
- **WHEN** a signed-out user opens an authentication page
- **THEN** the page SHALL expose clear email and configured social-provider actions using existing Manypost components and translations

#### Scenario: Signed-in control is visible
- **WHEN** an authenticated user opens the application shell
- **THEN** the top bar SHALL show a recognizable profile control and logout action

### Requirement: Deployment configuration is explicit and secret-safe
The repository SHALL document the Clerk variable names, allowed origins,
redirect targets and Railway placement without recording or exposing secret
values.

#### Scenario: Local configuration is absent
- **WHEN** required Clerk configuration is missing in local development
- **THEN** startup or diagnostics SHALL identify missing variable names without printing any secret value

#### Scenario: Production configuration is prepared
- **WHEN** an operator configures Clerk and Google OAuth for production
- **THEN** documentation SHALL distinguish `app.manypost.com.br` browser origins from API and MCP domains and list the exact callbacks discovered from Clerk

#### Scenario: Secret is referenced by client code
- **WHEN** static validation examines the web bundle boundary
- **THEN** `CLERK_SECRET_KEY` and equivalent server-only values MUST NOT be imported or exposed by client components

### Requirement: Non-human authentication remains compatible
The change SHALL preserve machine API keys, MCP authentication and
publication-provider OAuth semantics.

#### Scenario: Machine API key is used
- **WHEN** an existing valid API key calls the machine API or MCP surface
- **THEN** authentication and organization scoping SHALL behave as before the Clerk adoption

#### Scenario: User connects a publication channel
- **WHEN** an authenticated user starts a supported channel-provider OAuth flow
- **THEN** its callback, encrypted credentials and provider-specific behavior SHALL remain owned by Manypost
