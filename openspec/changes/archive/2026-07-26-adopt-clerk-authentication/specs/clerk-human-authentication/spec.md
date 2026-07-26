## ADDED Requirements

### Requirement: Clerk authenticates human users
The web application SHALL use the linked Clerk application for human sign-in,
sign-up, email verification, session management and supported external identity
providers while presenting Manypost-owned authentication screens.

#### Scenario: User signs in with a password
- **WHEN** a user submits valid Clerk credentials through the Manypost login UI
- **THEN** Clerk SHALL establish the only human session and Manypost MUST NOT issue an internal browser session

#### Scenario: User signs up with email verification
- **WHEN** a new user registers through the Manypost registration UI
- **THEN** the UI MUST complete Clerk's required email verification before accessing a protected Manypost request

#### Scenario: User authenticates with Google
- **WHEN** a user selects Google on a Manypost authentication screen
- **THEN** Clerk SHALL own the OAuth transaction and return the user to the configured Manypost callback

#### Scenario: Additional verification is required
- **WHEN** Clerk reports a second-factor, client-trust or session-task requirement
- **THEN** the UI SHALL keep the user unauthenticated in Manypost and present a safe continuation path

### Requirement: Clerk authenticates every protected human request
The API SHALL accept a protected human request only after independently
verifying its Clerk session token and resolving a verified Clerk identity. It
MUST NOT issue or accept an internal Manypost browser session.

#### Scenario: Valid Clerk request is authenticated
- **WHEN** the API receives a valid Clerk session token from an authorized Manypost web origin
- **THEN** it SHALL resolve the stable Clerk subject before authorizing the requested operation from persisted Manypost data

#### Scenario: Missing or invalid token is rejected
- **WHEN** a protected human request omits a token or supplies a token with invalid signature, issuer, lifetime or authorized party
- **THEN** the API MUST return an authentication error without executing the operation or falling back to legacy authentication

#### Scenario: Browser injects organization claims
- **WHEN** a valid request also contains browser-controlled organization, role or user identifiers
- **THEN** the API MUST ignore those values and derive authorization only from persisted Manypost data

#### Scenario: Clerk lookup is unavailable
- **WHEN** token verification or required Clerk identity resolution fails transiently
- **THEN** the API SHALL fail closed without executing the operation and SHALL NOT retry a state-changing operation blindly

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

#### Scenario: Existing Clerk identity returns
- **WHEN** the same Clerk subject authenticates another protected request
- **THEN** Manypost SHALL reuse the existing user and membership without duplicating persisted records

#### Scenario: Clerk email is not verified
- **WHEN** Clerk does not provide a verified primary email while provisioning a new internal identity
- **THEN** Manypost MUST reject provisioning and MUST NOT link by email

#### Scenario: Concurrent first requests occur
- **WHEN** two valid authenticated requests for the same new Clerk subject race
- **THEN** persistence constraints and transaction handling MUST produce one identity link and one initial tenant

### Requirement: Manypost authorizes human operations
Manypost SHALL derive organization scope, membership and role for an
authenticated Clerk subject exclusively from persisted Manypost data.

#### Scenario: Membership authorizes the operation
- **WHEN** an authenticated Clerk subject maps to an active Manypost membership with the required role
- **THEN** the API SHALL execute the operation within that membership's persisted organization scope

#### Scenario: Membership is missing
- **WHEN** an authenticated Clerk subject has no applicable Manypost membership
- **THEN** the API MUST deny the operation without accepting Clerk metadata or browser claims as authorization

#### Scenario: Role is insufficient
- **WHEN** an authenticated Clerk subject has a Manypost membership without the required role
- **THEN** the API MUST return a forbidden response without executing the operation

### Requirement: Clerk is the only human session lifecycle
The web application SHALL use the Clerk session as the only human
authentication lifecycle.

#### Scenario: Protected route has no Clerk session
- **WHEN** an unauthenticated browser requests a protected web route
- **THEN** the Next.js proxy SHALL redirect it to the Manypost login page while leaving public approval and Clerk proxy paths reachable

#### Scenario: Signed-in user opens an auth page
- **WHEN** a browser with a valid Clerk session requests login or registration
- **THEN** the application SHALL redirect to its authenticated landing route

#### Scenario: User logs out
- **WHEN** a signed-in user chooses logout
- **THEN** the application SHALL end the Clerk session, clear private client state and return to login

#### Scenario: Clerk session is absent
- **WHEN** a protected API request has no active Clerk session
- **THEN** the web application SHALL require interactive authentication without attempting an internal refresh or legacy login

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
- **THEN** startup or diagnostics SHALL fail closed and identify missing variable names without printing any secret value

#### Scenario: Production configuration is prepared
- **WHEN** an operator configures Clerk and Google OAuth for production
- **THEN** documentation SHALL distinguish `app.manypost.com.br` browser origins from API and MCP domains and list the exact callbacks discovered from Clerk

#### Scenario: Secret is referenced by client code
- **WHEN** static validation examines the web bundle boundary
- **THEN** `CLERK_SECRET_KEY` and equivalent server-only values MUST NOT be imported or exposed by client components

### Requirement: Legacy human authentication is unavailable
The application MUST NOT expose password, social OAuth, access-token or
refresh-token authentication implemented by Manypost for human users.

#### Scenario: Legacy password endpoint is requested
- **WHEN** a client requests a former Manypost password or social-login endpoint
- **THEN** the application SHALL return no authentication capability and MUST NOT create a human session

#### Scenario: Clerk configuration is unavailable
- **WHEN** the human web or API runtime starts without required Clerk configuration
- **THEN** it SHALL fail closed instead of enabling a legacy login form or authentication route

#### Scenario: Previous internal browser cookie is presented
- **WHEN** a client presents an access or refresh cookie issued by the legacy human session system
- **THEN** a protected human route MUST ignore it and require a valid Clerk session token

### Requirement: Non-human authentication remains compatible
The change SHALL preserve machine API keys, MCP authentication and
publication-provider OAuth semantics.

#### Scenario: Machine API key is used
- **WHEN** an existing valid API key calls the machine API or MCP surface
- **THEN** authentication and organization scoping SHALL behave as before the Clerk adoption

#### Scenario: Human session targets a machine surface
- **WHEN** a Clerk bearer or cookie is presented to the public REST API or MCP surface
- **THEN** the request MUST be rejected without creating a human principal or bypassing API-key scopes

#### Scenario: User connects a publication channel
- **WHEN** an authenticated user starts a supported channel-provider OAuth flow
- **THEN** its callback, encrypted credentials and provider-specific behavior SHALL remain owned by Manypost
