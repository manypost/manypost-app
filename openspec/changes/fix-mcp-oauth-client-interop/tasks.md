## 1. Failing tests and OpenSpec

- [x] 1.1 Write failing proxy tests: unsigned allow for
      `/oauth/authorize|register|token`; unsigned `/oauth/consent` → login.
- [x] 1.2 Write failing core tests for RFC 8252 loopback matching (Claude
      portless, OpenCode path, path mismatch, exact non-loopback) and static
      seed upsert of redirect URIs.
- [x] 1.3 Write failing consent test that expects redirect hostname / loopback
      warning when context includes a loopback `redirect_uri`.

## 2. Issuer reachability and redirect matching

- [x] 2.1 Allow anonymous `/oauth/authorize`, `/oauth/register`, `/oauth/token`
      in `apps/web/src/proxy.ts`; keep consent login-gated.
- [x] 2.2 Implement shared RFC 8252 loopback matcher in core; use it in approve,
      token exchange, and authorize route pre-check.
- [x] 2.3 Extend `STATIC_MCP_REDIRECT_URIS` with OpenCode loopback callbacks;
      add `updateRedirectUris` port/repo; upsert in `ensureStaticMcpClient`.

## 3. Consent, docs, verification

- [x] 3.1 Expose `redirectUri` (and loopback flag) on consent context; show
      hostname + warning in the consent UI.
- [x] 3.2 Update Settings/i18n, `SPEC_API_MCP.md`, CHANGELOG (and STATUS/ondas
      if required) with multi-client matrix + API key fallback.
- [x] 3.3 Run focused tests plus `bun run check`, `bun run spec:validate`,
      `git diff --check`.
