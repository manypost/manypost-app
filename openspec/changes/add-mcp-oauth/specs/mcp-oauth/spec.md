## ADDED Requirements

### Requirement: MCP dual authentication

The MCP HTTP surface MUST accept machine credentials as either an org-scoped
API key with prefix `mp_live_` or an OAuth access token with prefix `mpo_`.
The MCP surface MUST reject Clerk session bearers and cookies with
`401 Unauthorized`. Missing or invalid credentials MUST produce
`401 Unauthorized` including a `WWW-Authenticate` challenge that carries a
`resource_metadata` parameter pointing at Protected Resource Metadata.

#### Scenario: API key still works

- **WHEN** a client calls MCP with `Authorization: Bearer` and a valid
  non-revoked `mp_live_` key that includes scope `mcp`
- **THEN** the request is authenticated as an API-key principal for that key's
  organization

#### Scenario: OAuth access token works

- **WHEN** a client calls MCP with `Authorization: Bearer` and a valid
  non-revoked, non-expired `mpo_` access token
- **THEN** the request is authenticated as an OAuth principal for the grant's
  organization and scopes

#### Scenario: Clerk bearer is rejected on MCP

- **WHEN** a client calls MCP with a Clerk session bearer or cookie and no
  valid machine credential
- **THEN** the response is `401 Unauthorized` and no MCP tool runs

#### Scenario: Unauthenticated challenge advertises resource metadata

- **WHEN** a client calls MCP without a valid machine credential
- **THEN** the `401` response includes `WWW-Authenticate` with
  `resource_metadata` referencing the Protected Resource Metadata URL

### Requirement: Protected Resource and Authorization Server discovery

The system MUST serve OAuth 2.0 Protected Resource Metadata (RFC 9728) for the
MCP resource such that MCP clients can discover at least one authorization
server. The Authorization Server MUST serve OAuth 2.0 Authorization Server
Metadata (RFC 8414) describing authorization and token endpoints, PKCE S256
support, and `client_id_metadata_document_supported` set to true when CIMD is
enabled. Discovery documents MUST NOT include secrets.

#### Scenario: Client discovers the authorization server from the MCP resource

- **WHEN** a client fetches Protected Resource Metadata for the MCP resource
- **THEN** the document includes `authorization_servers` with the manypost
  Authorization Server issuer URL and advertises supported MCP scopes

#### Scenario: Client discovers authorize and token endpoints

- **WHEN** a client fetches Authorization Server Metadata for that issuer
- **THEN** the document includes `authorization_endpoint`, `token_endpoint`,
  `code_challenge_methods_supported` containing `S256`, and
  `client_id_metadata_document_supported` as true

### Requirement: Authorization code with PKCE and consent

The Authorization Server MUST implement the OAuth 2.1 authorization code grant
with mandatory PKCE method `S256`. The resource owner MUST authenticate to the
consent experience with an existing Clerk human session. Consent MUST bind the
grant to exactly one Manypost organization the user belongs to and to the
approved scope set. Authorization codes MUST be single-use, short-lived, and
stored only as hashes.

#### Scenario: Successful consent issues a code

- **WHEN** a logged-in member approves requested MCP scopes for one of their
  organizations after a valid authorize request with PKCE S256
- **THEN** the Authorization Server redirects to the registered redirect URI
  with a single-use authorization code and without exposing tokens in the
  redirect

#### Scenario: PKCE failure rejects token exchange

- **WHEN** a client presents an authorization code with a `code_verifier` that
  does not match the stored challenge
- **THEN** the token endpoint refuses to issue tokens and the code is not
  reusable as a successful exchange

#### Scenario: User without org membership cannot consent

- **WHEN** an authenticated Clerk user with no Manypost organization membership
  attempts consent
- **THEN** the system refuses to issue an authorization code for any
  organization

### Requirement: Opaque OAuth tokens and refresh rotation

Access tokens MUST use prefix `mpo_`, MUST be opaque to clients, MUST be stored
only as hashes, and MUST expire. Refresh tokens MUST rotate on each successful
refresh. Reuse of a previously rotated refresh token MUST revoke the grant
family. Revoked or expired access tokens MUST NOT authenticate MCP requests.

#### Scenario: Access token expires

- **WHEN** an MCP request presents an `mpo_` access token past its expiry
- **THEN** the response is `401 Unauthorized` and no tool runs

#### Scenario: Refresh rotation and reuse detection

- **WHEN** a valid refresh token is exchanged for a new access and refresh pair
  and a later request reuses the old refresh token
- **THEN** the first exchange succeeds and the reuse attempt revokes the grant
  family and fails

#### Scenario: Revoked grant cannot call MCP

- **WHEN** a grant is revoked and a previously issued access token for that
  grant is presented to MCP
- **THEN** the response is `401 Unauthorized`

### Requirement: Client registration via static, CIMD, and minimal DCR

The Authorization Server MUST validate public MCP clients by (1) matching a
statically pre-registered public client, (2) fetching a Client ID Metadata
Document when `client_id` is an HTTPS URL, or (3) accepting a client previously
created through Dynamic Client Registration. Authorization Server Metadata MUST
advertise `client_id_metadata_document_supported` as true and MUST advertise a
`registration_endpoint` for public-client DCR. Redirect URIs presented at
authorize time MUST match the client's registered or metadata redirect URIs.
CIMD fetches MUST apply outbound URL safety controls that block
private/link-local targets and bound response size and time.

#### Scenario: Static public client is accepted

- **WHEN** an authorize request uses the documented platform static `client_id`
  with a redirect URI allowlisted for that client
- **THEN** the Authorization Server proceeds to consent without requiring DCR

#### Scenario: CIMD client is accepted

- **WHEN** an authorize request uses an HTTPS URL `client_id` whose metadata
  document is reachable, valid, and lists the requested redirect URI
- **THEN** the Authorization Server proceeds to consent for that client

#### Scenario: DCR registers a public client

- **WHEN** a client POSTs a valid dynamic registration request for a public
  client with redirect URIs
- **THEN** the Authorization Server returns a `client_id` that can complete
  authorize + PKCE token exchange

#### Scenario: Redirect URI mismatch is rejected

- **WHEN** an authorize request presents a redirect URI not listed for the
  client
- **THEN** the Authorization Server refuses the request and does not issue a
  code

#### Scenario: Unsafe CIMD URL is rejected

- **WHEN** a `client_id` metadata URL resolves to a private or otherwise
  disallowed address
- **THEN** the Authorization Server refuses the client and does not fetch
  internal network resources beyond the safety policy

### Requirement: MCP scope enforcement

OAuth grants for MCP MUST use scopes `mcp:read` and/or `mcp:write`. Read-only
tools MUST require `mcp:read` or the legacy API-key scope `mcp`. Mutating tools
MUST require `mcp:write` or the legacy API-key scope `mcp`. Every MCP request
MUST re-check the organization plan feature that gates public API and MCP
access. Tool execution MUST remain scoped to the authenticated principal's
`orgId`.

#### Scenario: Read scope cannot schedule

- **WHEN** an OAuth principal with only `mcp:read` invokes `schedule_post`
- **THEN** the call is denied for insufficient scope and no post is created

#### Scenario: Write scope can schedule within the grant org

- **WHEN** an OAuth principal with `mcp:write` invokes `schedule_post` for
  channels in the grant's organization
- **THEN** the post is scheduled in that organization with MCP origin auditing

#### Scenario: Cross-organization data is unreachable

- **WHEN** an authenticated MCP principal for organization A requests posts or
  channels belonging only to organization B
- **THEN** those resources are not returned or mutated

#### Scenario: Legacy API key scope mcp retains full tool access

- **WHEN** a valid API key with scope `mcp` (and without explicit
  `mcp:read`/`mcp:write`) invokes a read tool and a mutating tool
- **THEN** both calls are authorized subject to plan and org scoping

### Requirement: Audit and non-disclosure of secrets

Mutating MCP tool calls authenticated via OAuth MUST write audit records with
MCP actor type and a stable grant identifier. Logs, discovery documents,
problem responses, and consent pages MUST NOT include raw authorization codes,
access tokens, refresh tokens, API keys, or Clerk secrets.

#### Scenario: Mutating OAuth tool call is audited

- **WHEN** an OAuth-authenticated client successfully calls a mutating MCP tool
- **THEN** an audit log entry exists for that organization with MCP actor type
  and the grant id as actor identity reference

#### Scenario: Errors omit secrets

- **WHEN** authorization or token exchange fails
- **THEN** the client-visible error does not include raw codes or tokens
