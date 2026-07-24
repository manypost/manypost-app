## Context

MCP today authenticates only with org-scoped API keys (`mp_live_…` + scope
`mcp`) via `requireMachineAuth` on Streamable HTTP. Human auth is Clerk-only;
Clerk must not authenticate MCP. Tables `oauth_apps` / `oauth_grants` exist as
empty stubs. SPEC_API_MCP §2 describes an AS, but runtime has no discovery,
authorize, token, or consent paths. MCP specification 2025-11-25 requires the
MCP host to act as a resource server with RFC 9728 metadata and prefers Client
ID Metadata Documents over Dynamic Client Registration.

Stakeholders: agent users connecting Cursor/Claude without pasting secrets;
self-host operators who still need headless keys; security (opaque hashed
tokens, PKCE, org isolation).

## Goals / Non-Goals

**Goals:**

- Ship dual-auth on MCP: API keys unchanged + OAuth 2.1 access tokens.
- Implement manypost as AS + resource server on the existing API process.
- Support CIMD, static pre-registration, and minimal DCR; PKCE S256 mandatory.
- Bind grants to `orgId` + `userId` chosen at Clerk-authenticated consent.
- Enforce `mcp:read` / `mcp:write` on tools for OAuth principals; map legacy
  key scope `mcp` to both.

**Non-Goals:**

- Replacing API keys; Clerk-as-AS; CIMD-only without Cursor-compatible
  static/DCR paths; MCP session Redis store; new MCP tools/resources beyond
  auth.

## Decisions

### 1. Dual verifier on the MCP resource server

Extend machine auth to accept:

- `Bearer mp_live_…` → existing `verifyApiKey` → principal
  `{ kind: 'api_key', orgId, scopes, apiKeyId }`;
- `Bearer mpo_…` → `verifyOAuthAccessToken` → principal
  `{ kind: 'oauth', orgId, scopes, grantId, userId }`.

Reject Clerk JWT/cookie on MCP (unchanged). On missing/invalid Bearer, respond
`401` with `WWW-Authenticate: Bearer resource_metadata="…", scope="…"`.

**Alternative rejected:** OAuth-only MCP — breaks CI and headless self-host.

### 2. Same process hosts RS and AS; discovery on the right hosts

- Protected Resource Metadata at the MCP public origin
  (`MCP_PUBLIC_URL` or `{PUBLIC_URL}/mcp` path-aware well-known).
- Authorization Server Metadata and `/authorize`, `/token` on the app/API
  origin derived from `PUBLIC_URL` (stable redirects, Clerk cookie available
  for consent).
- PRM `authorization_servers` points at the AS issuer URL.

**Alternative rejected:** separate OAuth microservice — unnecessary deploy
surface for v1.

### 3. Package boundaries

| Concern | Owner |
|---|---|
| Scopes, token prefixes, error codes | `packages/contracts` |
| Ports + use-cases (create code, exchange, refresh, revoke, verify) | `packages/core` |
| `oauth_apps` / `oauth_grants` repos + migration | `packages/db` |
| Discovery, authorize redirect, token HTTP, machine middleware | `apps/api` |
| Consent UI (org + scopes) | `apps/web` |
| Composition | `apps/api/src/container.ts` |

Opaque secrets use `randomToken` + `sha256Hex` (same as API keys). Do **not**
use `CryptoService` for AS tokens.

### 4. Client registration: static + CIMD in v1; minimal DCR for Cursor UX

Spike (`spike-client-registration.md`): Cursor (as of 2026) OAuth for MCP uses
**DCR and/or static `mcp.json` auth credentials**; CIMD is requested but not
shipped. Claude Desktop / VS Code already support CIMD. MCP 2025-11-25 prefers
CIMD and demotes DCR to MAY.

v1 therefore ships all three tiers that matter in practice:

1. **Static public client** — documented platform `client_id` (no secret) with
   Cursor redirect URIs allowlisted; Cursor users can set `auth.CLIENT_ID` in
   `mcp.json` without DCR.
2. **CIMD** — advertise `client_id_metadata_document_supported: true`; fetch and
   validate HTTPS URL client_ids (Claude/VS Code/future Cursor).
3. **Minimal DCR (RFC 7591)** — `registration_endpoint` issuing public clients
   (PKCE, redirect_uris, no long-lived secret pile beyond what DCR returns) so
   Cursor zero-config “paste MCP URL” works without manual CLIENT_ID.

Schema MUST allow `client_secret_hash` NULL for public clients. DCR-created
rows are soft-deletable / TTL-eligible to avoid unbounded growth.

**Alternative rejected:** CIMD-only first cut — blocks Cursor’s current OAuth
path unless every user pastes a static CLIENT_ID. Static alone is acceptable
fallback; DCR is included because Cursor is a primary agent surface for this
product.

### 5. Schema evolution (new migration only)

Evolve stubs without rewriting applied migrations:

- `oauth_apps`: make `org_id` nullable (platform-level apps); make
  `client_secret_hash` nullable (public clients); add optional
  `token_endpoint_auth_method` / `client_uri` as needed for CIMD audit.
- `oauth_grants`: keep `org_id` + `user_id` NOT NULL; store PKCE challenge,
  code/access/refresh hashes, expiries, scopes, `revoked_at`; add
  `resource` (RFC 8707 audience) and refresh-family / reuse marker if not
  representable with current columns.

Grant row is the source of truth for org binding after consent.

### 6. Scopes

- Contracts add `mcp:read` and `mcp:write`.
- OAuth grants issue only these (plus future machine scopes if needed).
- API key scope `mcp` remains and is treated as implying both read and write
  for tool checks (compatibility).
- Tool policy: list/get → `mcp:read` or legacy `mcp`; schedule/update/cancel/
  upload → `mcp:write` or legacy `mcp`.

### 7. Consent UX

`/authorize` validates client + PKCE + redirect + resource, then redirects a
browser to a web consent page on `PUBLIC_URL`. Consent requires Clerk session,
lists requested scopes and org memberships, and posts approval back to the API
to mint the authorization code. Denial returns OAuth error to `redirect_uri`.

### 8. Token lifetimes

- Authorization code: single-use, short TTL (minutes).
- Access token `mpo_*`: ~1h, opaque, hashed.
- Refresh token: rotating; reuse of an already-rotated refresh revokes the
  grant family.

### 9. Observability and audit

Mutating MCP tools continue to write `audit_log` with `actor_type=MCP`. For
OAuth principals, `actorId` is the grant id (and user id recorded in metadata
where the audit shape allows). Never log raw codes, access, or refresh tokens.

### 10. Generated files

- If OpenAPI gains AS/consent-adjacent human routes that the web client calls:
  run `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api` and
  commit `apps/web/openapi.json` + `apps/web/src/lib/api/schema.d.ts` together.
- Drizzle: `bun run --cwd packages/db generate -- --name mcp-oauth-as` (or
  similar); never hand-edit `migrations/000*.sql` or `meta/*`.

## Risks / Trade-offs

- [Incomplete AS / weak redirect validation] → Mitigate with negative tests
  (PKCE fail, redirect mismatch, CIMD fetch fail, wrong resource).
- [MCP clients still expect DCR] → Ship minimal DCR alongside CIMD and a
  documented static public client (Cursor uses DCR/static today).
- [Multi-replica MCP sessions] → Out of scope; document sticky sessions; same
  as today.
- [SPEC_API_MCP human JWT text is stale] → Update MCP/OAuth sections only;
  do not resurrect Manypost human JWT.
- [CIMD SSRF when fetching client metadata URLs] → Reuse outbound URL safety
  (block private IPs, timeouts, size limits) before trusting redirect URIs.

## Migration Plan

1. Land schema migration (expand: nullable columns, new indexes).
2. Deploy API with dual verifier + discovery; consent UI behind same release.
3. Keep API keys working; announce OAuth in CHANGELOG/STATUS.
4. Rollback: revert app deploy or gate AS routes off; unused grants/tables
   harmless; keys unaffected. Do not drop tables in emergency rollback.

## Open Questions

Resolved by spike (see `spike-client-registration.md`):

- **CIMD vs DCR for first cut:** ship **static public client + CIMD + minimal
  DCR** together so Cursor (DCR/static today) and Claude/VS Code (CIMD) both
  work.
- **Live Inspector against a stub:** deferred to implementation tasks (discovery
  stub + `scripts/e2e-mcp-oauth.ts`); research spike is sufficient to lock
  registration strategy before coding.
