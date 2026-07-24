## Context

Manypost currently authenticates browser users with password or direct
Google/GitHub OAuth in the Hono API, issues short-lived internal JWTs plus
rotating refresh tokens, and derives tenant authorization from PostgreSQL
memberships. The Next.js 16 web application uses a same-origin proxy and custom
Manypost login/registration screens.

Clerk will own credential authentication but cannot become the source of truth
for Manypost tenant authorization in this cut. Production has one combined
Railway application service exposed as `app.manypost.com.br` for Next.js and as
`api.manypost.com.br`/`mcp.manypost.com.br` for the Hono API. No secret value may
be read into artifacts or client code.

## Goals / Non-Goals

**Goals:**

- Preserve the existing Manypost auth visual language with Clerk custom flows.
- Verify Clerk sessions server-side and exchange them for the existing
  organization-scoped Manypost session.
- Reuse the existing external-identity linking and internal organization model.
- Make logout, refresh recovery and protected routing coherent across both
  session systems.
- Document local, Clerk-dashboard, Google OAuth and Railway setup precisely.

**Non-Goals:**

- Clerk Organizations as the tenant or role source of truth.
- Password-hash migration, user deletion synchronization or bidirectional
  profile synchronization.
- Clerk authentication for API keys, public REST, MCP or channel OAuth.
- Production variable mutation, deploy, domain mutation or push.

## Decisions

### 1. Use Clerk as authenticator and Manypost as authorizer

The browser completes authentication with Clerk. It then sends its Clerk
session token only to a dedicated internal exchange endpoint. The Hono API
verifies the token, resolves the Clerk user server-side and invokes an internal
identity-login use case that issues the existing Manypost access/refresh
cookies. Every protected business route continues reading a principal derived
from persisted Manypost membership.

This keeps tenant isolation independent of client-controlled metadata and
avoids forcing Clerk tokens into machine surfaces. Replacing all internal JWTs
with Clerk tokens was rejected because it would couple every API middleware,
role check, SSE reconnect and API-key distinction to Clerk claims.

### 2. Store Clerk as an existing external identity

The `auth_identities` representation already maps a provider and stable provider
subject to an internal user. The implementation will first try
`provider = "clerk"` with the Clerk user ID and reuse the social-identity login
semantics: require a verified primary email, link an existing normalized email,
or create the user and owner organization.

No schema change is planned. Before implementation, repository constraints and
concurrent create behavior will be tested. If they cannot guarantee a single
identity and initial tenant, the design must be revised and a new Drizzle
migration generated rather than editing existing migrations.

### 3. Keep custom Manypost authentication screens

`@clerk/nextjs` hooks will drive the existing forms and buttons. Clerk prebuilt
screens are not embedded. Email/password sign-up includes Clerk-required email
verification; sign-in handles required second-factor/client-trust states
without treating them as success. Google uses Clerk's OAuth strategy and a
dedicated callback route.

Using only Clerk prebuilt components was rejected because it would replace the
established product interface and duplicate navigation semantics. Recreating
Clerk security protocol details in the Hono API was rejected because it defeats
the purpose of adopting Clerk.

### 4. Compose Clerk middleware with the existing Next.js proxy

Next.js 16 uses `apps/web/src/proxy.ts`. `clerkMiddleware` will wrap the existing
route decisions. Its matcher will retain application exclusions, include the
API matcher before the Clerk frontend proxy matcher, and contain
`'/__clerk/:path*'` exactly once. Public approval routes and API rewrites remain
reachable.

`ClerkProvider` will be placed inside `<body>` around the existing provider
tree. All server calls to `auth()` will be awaited.

### 5. Attach Clerk tokens only where required

The OpenAPI client remains the only application HTTP client. A small auth-token
adapter will obtain the Clerk token for exchange/recovery and attach it as an
Authorization bearer only to the internal exchange request. Normal resource
requests continue using HttpOnly Manypost cookies.

On an internal 401 after refresh failure, at most one exchange can run at a
time, matching the current refresh deduplication rule. A failed exchange clears
the non-sensitive session hint and returns the browser to login.

### 6. End both sessions on logout

Logout first asks the API to revoke/clear the internal session, then invokes
Clerk sign-out, clears client queries and navigates to login. Failure to revoke
the internal session does not preserve the visible Clerk session, but is
reported through structured client telemetry without logging tokens.

### 7. Configuration ownership

The web runtime receives only Clerk publishable configuration. The Hono
server/composition root owns secret or verification material and a comma-safe
list of authorized browser origins. Configuration validation reports names and
formats only.

Production origins are derived from inspected Railway domains:
`https://app.manypost.com.br` is the human browser origin;
`https://api.manypost.com.br` and `https://mcp.manypost.com.br` are not browser
origins for Clerk human auth. Exact Google callback URLs will be copied from
the linked Clerk application's provider configuration or CLI diagnostics after
initialization; they will not be guessed.

Generated OpenAPI files will be regenerated only through:

```bash
API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
```

Dependency lock changes will be produced only by Bun. Migration metadata will
be produced only by Drizzle Kit if the no-migration assumption is disproved.

### 8. Observability and error boundaries

Authentication failures use stable problem+json codes and log correlation IDs,
failure class and Clerk subject only when safe. Tokens, cookies, OAuth codes and
provider payloads are never logged. Clerk network failures remain distinct from
invalid credentials so operators can diagnose availability without revealing
account existence.

## Risks / Trade-offs

- [Two session systems can drift] → Centralize exchange/logout/recovery and test
  every transition; keep the internal session short-lived and revocable.
- [Existing password users cannot sign in until linked through Clerk] → Link by
  verified normalized email and document the cutover; do not migrate hashes.
- [Concurrent first login can duplicate tenant data] → Verify unique constraints
  with a failing concurrency test and use a transaction/retry on unique
  conflict if required.
- [Clerk outage blocks new login and exchange] → Existing internal sessions
  continue until expiry; exchanges fail closed with an operational error.
- [Custom flows must track Clerk state-machine changes] → Use official hooks and
  typed statuses, keep flow components small, and cover non-complete states.
- [CLI scaffolding can overwrite existing auth/proxy code] → Inspect its diff
  immediately, retain only required changes and restore product-specific logic.
- [Rollback leaves Clerk identity rows] → They are additive external-identity
  links and harmless to the legacy flow; no destructive cleanup is required.

## Migration Plan

1. Add and validate the OpenSpec artifacts before running Clerk scaffolding.
2. Run `clerk init` against the explicitly supplied Clerk application and
   inspect every generated change.
3. Add dependencies/config names and server verification behind the new
   exchange route.
4. Add failing core/API/web tests, then implement provisioning, exchange,
   custom UI, proxy and lifecycle behavior.
5. Regenerate OpenAPI artifacts from a local API and run focused tests,
   `clerk doctor`, `bun run check`, `bun run db:check`,
   `bun run build:web`, `bun run spec:validate` and `git diff --check`.
6. Commit locally on `feat/clerk-auth`; do not push or deploy.
7. In a later authorized rollout, configure Clerk/Google/Railway, validate a
   first test signup, then remove or disable legacy public login entry points.

Rollback reverts the application commits and restores the prior proxy/auth UI.
No production mutation is performed here. Existing data remains intact.

## Open Questions

- Which exact callback URI does the linked Clerk instance expose for Google?
  Resolve from Clerk after initialization and record it in operator guidance.
- Does the Clerk application currently require MFA, client trust or additional
  sign-up fields? The custom UI must render the enabled state machine rather
  than assume password-only completion.
- Should legacy API password/social routes be disabled immediately or retained
  for one release as a rollback path? Default implementation keeps no UI entry
  point and documents any temporarily reachable compatibility surface.
