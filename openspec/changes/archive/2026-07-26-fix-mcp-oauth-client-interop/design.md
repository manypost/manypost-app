## Context

`add-mcp-oauth` shipped dual-auth MCP and an Authorization Server on
`PUBLIC_URL` (Next rewrites → API). E2E hit the API host directly, so Clerk
blocking of `/oauth/register|token|authorize` was invisible. Redirect checks
used exact string equality, which breaks every client that binds an ephemeral
loopback port (OpenCode, Claude Code CIMD, VS Code, Codex DCR).

## Goals / Non-Goals

**Goals:**

- Anonymous clients can POST/GET AS machine endpoints on the advertised issuer.
- Loopback redirect matching follows RFC 8252 §7.3 for all client types.
- Static seed upsert keeps `manypost-mcp` redirects current in production.
- Docs/Settings describe Cursor / OpenCode / Claude / Codex / VS Code + API key.

**Non-Goals:**

- Moving the issuer off `PUBLIC_URL`.
- Wildcards for non-loopback hosts or arbitrary path prefixes on the static
  client beyond documented Cursor + OpenCode paths.
- Live manual smoke against every vendor binary in CI.

## Decisions

### 1. Public AS paths in Clerk proxy (not remove Clerk from `/oauth/*`)

Allow only `/oauth/authorize`, `/oauth/register`, `/oauth/token` without a
session. Keep `/oauth/consent` login-gated so humans still authenticate before
approve/deny. Consent JSON remains `requireAuth` on the API.

**Alternative considered:** Mark all `/oauth/` public — rejected because the
consent page would skip login until API 401, worse UX.

### 2. Shared RFC 8252 matcher for static, DCR, and CIMD

One `redirectUriAllowed(registered[], requested)` helper:

- Loopback `http` (`127.0.0.1`, `localhost`, `::1` / `[::1]`): compare scheme,
  hostname, pathname, search; ignore port.
- Everything else: exact string match.

Apply in core approve/token paths and in the authorize HTTP pre-check.

**Alternative considered:** Only special-case OpenCode paths on the static
client — rejected; Claude CIMD and VS Code ephemeral ports would still fail.

### 3. Static allowlist = Cursor + OpenCode; others use DCR/CIMD

Add portless OpenCode callbacks to `STATIC_MCP_REDIRECT_URIS`. Do not encode
Codex `/callback/{id}` or VS Code HTTPS redirects on the static client.

### 4. Seed upsert via `updateRedirectUris`

`ensureStaticMcpClient` merges missing canonical URIs into the existing row so
production does not stay stuck on the first seed.

## Risks / Trade-offs

- [Loopback impersonation] → Mitigation: consent shows redirect hostname and
  warns on loopback; PKCE + human Clerk consent still required.
- [Over-broad proxy allow] → Mitigation: only three machine paths; consent stays
  protected.
- [Existing DB row without new URIs] → Mitigation: upsert on API boot.

## Migration Plan

1. Deploy web (proxy) + api (matcher + seed upsert) together.
2. No SQL migration.
3. Rollback = previous image; leftover static redirect URIs are harmless.

## Open Questions

None — client matrix and RFC 8252 behavior are fixed by this design.
