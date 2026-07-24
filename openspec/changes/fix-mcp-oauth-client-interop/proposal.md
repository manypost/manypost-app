## Why

MCP clients (OpenCode, Codex, Claude Code, Cursor DCR, VS Code, Inspector) fail
OAuth against production because (1) Clerk middleware on `PUBLIC_URL` redirects
anonymous `/oauth/register|token|authorize` to `/login` HTML, and (2) redirect
URI validation is exact-string only, rejecting RFC 8252 ephemeral loopback
ports. OpenCode reported both; the same class breaks every modern MCP client.

## What Changes

- Make Authorization Server machine endpoints reachable anonymously through the
  Next/Clerk issuer: `/oauth/authorize`, `/oauth/register`, `/oauth/token`.
- Implement RFC 8252 §7.3 loopback redirect matching (ignore port; match scheme,
  host, path, query) for static, DCR, and CIMD clients.
- Extend static `manypost-mcp` allowlist with OpenCode loopback callback paths
  and upsert seed so existing production rows gain the new URIs.
- Show redirect hostname (and loopback warning) on the consent UI.
- Document multi-client connect matrix + API key fallback in Settings/SPEC.

## Goals

- Any MCP client that uses DCR or CIMD with loopback redirects can complete
  OAuth via the advertised issuer without HTML login responses.
- Static Cursor redirects remain valid; OpenCode static `clientId` works.
- Consent surfaces the redirect hostname for loopback clarity.

## Non-goals

- Per-client static allowlists for Codex callback-id paths or VS Code HTTPS
  redirects (those stay on DCR/CIMD).
- Changing issuer host away from `PUBLIC_URL`.
- Archiving `add-mcp-oauth` in this change.

## Capabilities

### New Capabilities

- `mcp-oauth-client-interop`: Issuer reachability for AS machine endpoints,
  RFC 8252 loopback redirect matching, static seed upsert, consent redirect
  hint, and multi-client documentation requirements.

### Modified Capabilities

- (none in `openspec/specs/`; `add-mcp-oauth` is not archived yet)

## Impact

- `apps/web` Clerk proxy and consent UI; Settings/i18n copy.
- `packages/core` OAuth redirect matching + static client seed.
- `packages/db` OAuth app `updateRedirectUris`.
- `apps/api` authorize route uses shared matcher.
- Docs: `SPEC_API_MCP.md`, `CHANGELOG.md`, STATUS/ondas as needed.
- Railway: no schema migration; deploy web+api so proxy and seed upsert apply.
  Rollback: revert proxy allowlist and matcher (clients that need DCR/CIMD
  loopback break again).

## Compatibility

- Non-breaking for existing Cursor static redirects and API keys.
- DCR clients that previously failed against the issuer start working.
- Exact match remains for non-loopback URIs.

## Rollback

Revert the deploy (proxy + matcher + seed upsert). No DB migration to undo;
upserted redirect URIs on `manypost-mcp` can remain (superset is safe).

## Product identity / Postiz

No Postiz renames. Brand remains `manypost`.

## Security

- Consent and consent JSON APIs stay Clerk-authenticated.
- Loopback port flexibility only for `http` on `127.0.0.1` / `localhost` / `::1`.
- Non-loopback `http` redirects remain rejected at DCR.
