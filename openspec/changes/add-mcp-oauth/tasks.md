## 1. Contracts and failing tests (auth surface)

- [ ] 1.1 Run `bun install --frozen-lockfile`.
- [ ] 1.2 Add contract scopes `mcp:read` / `mcp:write` (keep legacy `mcp`) and
      any stable OAuth/MCP error codes needed; write failing unit tests for
      scope implication (`mcp` ⇒ read+write).
- [ ] 1.3 Write failing core tests for authorization-code+PKCE issue/exchange,
      refresh rotation + reuse revocation, access-token verify/expiry/revoke,
      and org binding on grants.

## 2. Schema and repositories

- [ ] 2.1 Evolve `oauth_apps` / `oauth_grants` in Drizzle (nullable
      `org_id` / `client_secret_hash`, resource audience, refresh-family /
      reuse fields as required by design).
- [ ] 2.2 Generate a **new** migration with
      `bun run --cwd packages/db generate -- --name mcp-oauth-as`; inspect SQL
      and metadata; never edit existing `000*.sql`.
- [ ] 2.3 Implement repositories + fakes; run `bun run db:check` and focused
      repository tests (org scope, revoke, hash lookup).

## 3. Authorization Server use-cases and HTTP

- [ ] 3.1 Implement core use-cases: CIMD fetch (with SSRF controls), static
      client resolve, DCR register, authorize/consent code mint, token
      (code + refresh), revoke, verify access token.
- [ ] 3.2 Write failing API tests for PRM, AS metadata, `WWW-Authenticate`
      `resource_metadata`, PKCE failure, redirect mismatch, unsafe CIMD URL,
      DCR public client happy path.
- [ ] 3.3 Mount discovery, `/authorize`, `/token`, `registration_endpoint`, and
      dual `mp_live_` / `mpo_` verifier on MCP; keep Clerk rejected on MCP.
- [ ] 3.4 Enforce per-tool scopes and `public_api` plan gate; audit mutating
      OAuth tool calls with grant id.

## 4. Consent UI and Settings copy

- [ ] 4.1 Write failing web tests for consent (Clerk required, org picker,
      approve/deny).
- [ ] 4.2 Implement consent page on `PUBLIC_URL` (brand tokens, no secrets in
      UI) and wire approve/deny to the AS.
- [ ] 4.3 Update MCP browser landing + Settings connect instructions for OAuth
      (static CLIENT_ID for Cursor + discovery URL); keep API-key path.
- [ ] 4.4 If web calls new human/AS JSON routes, start local API and run
      `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api`;
      review `openapi.json` and `schema.d.ts` together.

## 5. E2E, docs, verification

- [ ] 5.1 Extend or add `scripts/e2e-mcp-oauth.ts`: discovery → (DCR or static)
      → PKCE → `schedule_post` on disposable Postgres/Redis; keep existing
      API-key MCP E2E green.
- [ ] 5.2 Update `docs/specs/SPEC_API_MCP.md` (OAuth/MCP sections only; do not
      resurrect human JWT), architecture flows, STATUS backlog, CHANGELOG.
- [ ] 5.3 Run focused tests plus `bun run check`, `bun run db:check`,
      `bun run build:web`, `bun run spec:validate`, `git diff --check`.
- [ ] 5.4 Manual smoke when feasible: Cursor with static `auth.CLIENT_ID` and
      Claude/Inspector CIMD or DCR against local/staging MCP URL (no secrets in
      docs).
