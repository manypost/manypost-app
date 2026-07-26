## ADDED Requirements

### Requirement: Issuer machine endpoints are anonymously reachable

The Authorization Server issuer advertised in discovery (`PUBLIC_URL`) MUST
allow unauthenticated HTTP access to `/oauth/authorize`, `/oauth/register`, and
`/oauth/token` through the web front door so MCP clients receive JSON or OAuth
redirects rather than an HTML login page. The consent page `/oauth/consent` and
consent JSON APIs MUST continue to require a Clerk human session.

#### Scenario: Anonymous DCR on the issuer returns JSON

- **WHEN** an unauthenticated client POSTs a valid public-client registration to
  `{issuer}/oauth/register`
- **THEN** the response is `201` with a JSON body containing `client_id` and is
  not an HTML login redirect

#### Scenario: Anonymous token endpoint is not redirected to login

- **WHEN** an unauthenticated client POSTs to `{issuer}/oauth/token`
- **THEN** the web front door does not redirect to `/login` (the AS may still
  return an OAuth error for invalid credentials)

#### Scenario: Consent page still requires login

- **WHEN** an unauthenticated browser requests `/oauth/consent`
- **THEN** the web front door redirects to the login experience

### Requirement: RFC 8252 loopback redirect matching

When validating a `redirect_uri` against a client's registered redirect URIs,
the Authorization Server MUST treat `http` URIs whose host is `127.0.0.1`,
`localhost`, or IPv6 loopback (`::1` / `[::1]`) as matching if scheme, host,
pathname, and query are equal, **ignoring the port**. Non-loopback URIs MUST
continue to require exact string equality. This MUST apply to static, DCR, and
CIMD clients.

#### Scenario: Claude-style portless registration accepts ephemeral port

- **WHEN** a client has registered `http://127.0.0.1/callback` and authorize
  presents `http://127.0.0.1:53092/callback`
- **THEN** the Authorization Server accepts the redirect URI

#### Scenario: OpenCode loopback path accepts ephemeral port

- **WHEN** the static client has registered `http://127.0.0.1/mcp/oauth/callback`
  and authorize presents `http://127.0.0.1:19876/mcp/oauth/callback`
- **THEN** the Authorization Server accepts the redirect URI

#### Scenario: Different loopback path is rejected

- **WHEN** a client has registered `http://127.0.0.1/callback` and authorize
  presents `http://127.0.0.1:19876/mcp/oauth/callback`
- **THEN** the Authorization Server rejects the redirect URI

#### Scenario: Non-loopback URIs stay exact-match

- **WHEN** a client has registered `https://cursor.com/api/mcp/auth/callback`
  and authorize presents a different string
- **THEN** the Authorization Server rejects the redirect URI

### Requirement: Static MCP client seed upsert

The platform static client `manypost-mcp` MUST include documented Cursor
redirect URIs and OpenCode loopback callback URIs. On Authorization Server
startup, if the client row already exists, the system MUST merge any missing
canonical redirect URIs into the stored allowlist without removing existing
entries.

#### Scenario: Existing static client gains OpenCode redirects

- **WHEN** `manypost-mcp` already exists without OpenCode loopback URIs and the
  AS boots
- **THEN** the stored `redirect_uris` include the canonical OpenCode loopback
  callbacks after ensure/upsert

### Requirement: Consent shows redirect hostname

The consent experience MUST display the pending request's redirect URI hostname
(and MUST warn when that hostname is loopback) so the resource owner can see
where the authorization code will be delivered.

#### Scenario: Loopback redirect is labeled on consent

- **WHEN** a member opens consent for a request whose `redirect_uri` host is
  `127.0.0.1` or `localhost`
- **THEN** the UI shows that hostname and a loopback warning

### Requirement: Multi-client connect documentation

Settings and MCP API documentation MUST describe how Cursor, OpenCode, Claude
Code, Codex, and VS Code connect (URL-only DCR/CIMD vs static `manypost-mcp`)
and MUST document the API key fallback `Authorization: Bearer mp_live_…` with
scope `mcp`.

#### Scenario: Settings mention API key fallback and client matrix

- **WHEN** a member opens the agent connect section in Settings
- **THEN** the copy documents OAuth URL-only setup, static client id for
  Cursor/OpenCode, and the `mp_live_` API key alternative
