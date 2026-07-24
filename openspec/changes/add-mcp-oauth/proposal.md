## Why

MCP clients (Cursor, Claude, Inspector) expect OAuth 2.1 discovery and a browser
consent dance instead of pasting a long-lived API key into config. Manypost
already ships Streamable HTTP MCP behind org-scoped `mp_live_` keys and has
empty `oauth_apps` / `oauth_grants` stubs plus an aspirational SPEC — agents
still cannot complete “paste URL → login → consent → call tools” without a
first-party Authorization Server.

## What Changes

- Add manypost as an OAuth 2.1 Authorization Server for MCP: Protected Resource
  Metadata (RFC 9728), Authorization Server Metadata (RFC 8414), authorization
  code + PKCE S256, opaque `mpo_*` access tokens (hashed at rest) with short
  TTL and rotating refresh tokens.
- Support public MCP client registration via static platform client_id,
  Client ID Metadata Documents (CIMD), and minimal Dynamic Client Registration
  (RFC 7591) so Cursor (DCR/static today) and Claude/VS Code (CIMD) both work.
- Keep dual-auth on the MCP resource server: existing `mp_live_` API keys with
  scope `mcp` continue to work; OAuth access tokens are an additional path.
- Introduce fine scopes `mcp:read` and `mcp:write` for OAuth grants and
  per-tool enforcement; map legacy API-key scope `mcp` to both for compatibility.
- Add a Clerk-authenticated consent UI (org picker + scopes); Clerk never
  authenticates MCP Bearer requests.
- Evolve `oauth_apps` / `oauth_grants` schema for platform-level / public
  clients (nullable secret, optional org on app, grant-bound org) via a new
  migration — never rewrite applied migrations.
- Update MCP landing, Settings connect copy, E2E (discovery → PKCE → tool),
  docs/SPEC alignment, CHANGELOG, and STATUS backlog item.

## Capabilities

### New Capabilities

- `mcp-oauth`: MCP resource-server dual-auth, OAuth 2.1 AS discovery and token
  lifecycle, CIMD/public-client registration, consent, scopes, and grant
  revocation.

### Modified Capabilities

None. No archived live OpenSpec capability currently specifies MCP or machine
API-key authentication.

## Impact

- API: discovery well-knowns on MCP/API hosts, `/authorize` + `/token` (+
  optional revoke), `WWW-Authenticate` with `resource_metadata` on MCP 401,
  dual verifier for `mp_live_` / `mpo_*` in machine middleware.
- Core/db: ports and use-cases for oauth apps/grants; schema migration evolving
  stub tables; hashed opaque tokens (same pattern as API keys, not AES).
- Web: consent page under the app host, Clerk session required to approve;
  Settings MCP connect instructions mention OAuth-capable clients.
- Security: PKCE mandatory; redirect URI validation against CIMD/static app;
  refresh rotation with reuse detection; org-scoped grants; plan gate
  `public_api` re-checked on every MCP request; negative tests for forged
  tokens, wrong audience/resource, revoked grants, cross-org session reuse.
- Data: new/altered columns on `oauth_*`; no change to `api_keys` semantics.
- Product identity: no Postiz rename; direction is category 5 historical /
  design parity with Postiz AS — implementation is Manypost-owned.
- Railway: no deploy in this change; later needs stable `PUBLIC_URL` /
  `MCP_PUBLIC_URL` for redirects and discovery. Self-host without browser
  keeps API keys.

## Goals

- Let modern MCP clients authenticate via OAuth 2.1 without pasting secrets.
- Preserve API keys for CI, scripts, and headless self-host.
- Keep Clerk out of the MCP resource-server auth path.
- Enforce tenant isolation and least-privilege scopes on every tool call.

## Non-goals

- Removing or deprecating `mp_live_` API keys for MCP or public REST.
- Using Clerk (or any external IdP) as the MCP Authorization Server or as
  Bearer auth on `/mcp`.
- Making DCR the only registration path (CIMD and static remain first-class).
- Externalizing the in-memory MCP session store (sticky/store remains a
  separate follow-up).
- Shipping missing MCP tools/resources (`get_channel_analytics`,
  `generate_content`, `manypost://…`) beyond auth.
- Building a general third-party OAuth AS for arbitrary non-MCP apps beyond
  what MCP registration needs.

## Compatibility

Existing API keys, MCP tool contracts, and Clerk human auth remain valid.
Clients that already send `Authorization: Bearer mp_live_…` keep working.
OAuth is additive. Scope `mcp` on keys continues to unlock all MCP tools;
OAuth grants use `mcp:read` / `mcp:write`. Schema changes are
expand/contract-compatible with a new migration only.

## Rollback

Disable OAuth routes/feature flag or revert the deploy that serves AS
endpoints; MCP falls back to API-key-only. Soft-revoke outstanding grants.
Do not drop `oauth_*` tables in an emergency rollback — leave unused. API key
path is unaffected. Railway: unset any new OAuth-specific env only after
confirming no client depends on discovery; keys still work.
