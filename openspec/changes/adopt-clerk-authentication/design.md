## Context

Manypost currently contains two human session systems on this branch: Clerk
authenticates credentials, then a dedicated exchange endpoint issues internal
JWT access and refresh cookies. Tenant authorization is derived from PostgreSQL
memberships. The double session creates drift and leaves legacy human
authentication code available as a runtime fallback.

The target boundary is stricter: Clerk is the sole human authenticator on every
request, while Manypost remains the sole source of tenant authorization.
Production has one combined Railway application service exposed as
`app.manypost.com.br` for Next.js and as
`api.manypost.com.br`/`mcp.manypost.com.br` for the Hono API. No secret value may
be read into artifacts or client code.

## Goals / Non-Goals

**Goals:**

- Preserve the existing Manypost auth visual language with Clerk custom flows.
- Verify a Clerk session token on every protected human API request.
- Reuse the existing external-identity linking and internal organization model.
- Resolve organization membership and roles exclusively from Manypost data.
- Remove internal browser sessions and legacy human authentication entry points.
- Document local, Clerk-dashboard, Google OAuth and Railway setup precisely.

**Non-Goals:**

- Clerk Organizations as the tenant or role source of truth.
- Password-hash migration, user deletion synchronization or bidirectional
  profile synchronization.
- Clerk authentication for API keys, public REST, MCP or channel OAuth.
- Destructive removal of obsolete session storage in this cut.

## Decisions

### 1. Authenticate every human API request with Clerk

The OpenAPI web client obtains the active Clerk session token and sends it as an
Authorization bearer on protected human requests. Browser primitives that
cannot set a custom header, such as EventSource, present Clerk's same-origin
`__session` cookie. The Hono authentication middleware verifies either form for
signature, issuer, lifetime and authorized party, then resolves the stable Clerk
subject. It never issues a second browser session.

An internal exchange was rejected because it makes Manypost an additional
runtime authenticator, delays Clerk revocation until the internal refresh
lifecycle ends and requires coordinated login, recovery and logout across two
session systems.

### 2. Authorize exclusively from persisted Manypost membership

After Clerk authentication, the API maps `provider = "clerk"` and the verified
Clerk subject to an internal user. It loads that user's persisted Manypost
organization membership and role to build the human principal used by route
authorization and repository scoping. Browser-controlled organization, role,
permission or user values are ignored.

Public REST and MCP use a separate machine-only middleware. They accept only a
`mp_live_` API key in the Authorization bearer, never a Clerk bearer or cookie,
so a human principal cannot bypass scope checks.

The `auth_identities` representation already maps a provider and stable provider
subject to an internal user. On the first authenticated request, provisioning
requires a verified primary email, links an existing normalized email or creates
the user and owner organization.

No schema change is planned. Repository constraints and concurrent create
behavior must guarantee a single identity and initial tenant. If they cannot,
the design must be revised and a new Drizzle migration generated rather than
editing existing migrations.

Once a Clerk subject is already linked, token verification is sufficient to
resolve the Manypost principal; the Backend Users API is consulted only while
provisioning an unlinked subject. This keeps authorization available during a
profile-API throttle without weakening signature or authorized-party checks.

Clerk Organizations and Clerk metadata were rejected for authorization because
the product's domain tables, billing relationships and tenant invariants use
Manypost organization IDs and memberships.

### 3. Keep custom Manypost authentication screens

`@clerk/nextjs` hooks drive the existing forms and buttons. Clerk prebuilt
screens are not embedded. Email/password sign-up includes Clerk-required email
verification; sign-in handles required second-factor/client-trust states
without treating them as success. Google uses Clerk's OAuth strategy and a
dedicated callback route.

Using only Clerk prebuilt components was rejected because it would replace the
established product interface and duplicate navigation semantics. Recreating
Clerk security protocol details in the Hono API was rejected because it defeats
the purpose of adopting Clerk.

### 4. Compose Clerk middleware with the existing Next.js proxy

Next.js 16 uses `apps/web/src/proxy.ts`. `clerkMiddleware` wraps the existing
route decisions. Its matcher retains application exclusions, includes the API
matcher before the Clerk frontend proxy matcher, and contains
`'/__clerk/:path*'` exactly once. Public approval routes and API rewrites remain
reachable.

`ClerkProvider` stays inside `<body>` around the existing provider tree. All
server calls to `auth()` are awaited.

### 5. Centralize Clerk token attachment

The OpenAPI client remains the only application HTTP client. A small auth-token
adapter obtains the current Clerk token and attaches it to protected human
requests. Public requests and machine API-key requests do not receive a Clerk
token. A missing or invalid token produces one authentication failure and never
falls back to a Manypost password, social login, JWT or refresh cookie.

### 6. Keep one visible human session

Logout invokes Clerk sign-out, clears client queries and navigates to login.
There is no internal browser session to revoke, recover or coordinate.

### 7. Remove legacy human authentication at runtime

Password hashing, direct Google/GitHub login routes, internal browser
access/refresh issuance and their public UI fallback are removed from the human
runtime. Historical database columns or tables may remain temporarily when
dropping them would create destructive migration risk, but no application path
may read them to authenticate a human.

Rollback is operational: redeploy the prior verified release. Keeping dormant
legacy routes in the new release was rejected because configuration mistakes or
Clerk outages could silently weaken the authentication boundary.

### 8. Configuration ownership

The web runtime receives only Clerk publishable configuration. The Hono
server/composition root owns secret or verification material and a comma-safe
list of authorized browser origins. Configuration validation reports names and
formats only. Required Clerk configuration is unconditional for the human web
and API runtimes; startup and diagnostics fail closed when it is absent. A
dedicated `MODE=worker` process serves no human HTTP surface and therefore does
not receive Clerk configuration.

Production origins are derived from inspected Railway domains:
`https://app.manypost.com.br` is the human browser origin;
`https://api.manypost.com.br` and `https://mcp.manypost.com.br` are not browser
origins for Clerk human auth. Exact Google callback URLs are copied from the
linked Clerk application's provider configuration or CLI diagnostics; they are
not guessed.

Generated OpenAPI files are regenerated only through:

```bash
API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
```

Dependency lock changes are produced only by Bun. Migration metadata is
produced only by Drizzle Kit if the no-migration assumption is disproved.

### 9. Observability and error boundaries

Authentication failures use stable problem+json codes and log correlation IDs,
failure class and Clerk subject only when safe. Tokens, cookies, OAuth codes and
provider payloads are never logged. Clerk network failures remain distinct from
invalid credentials so operators can diagnose availability without revealing
account existence.

## Risks / Trade-offs

- [Clerk outage blocks all human API access] → Fail closed deliberately, expose
  secret-safe operational diagnostics and leave machine credentials independent.
- [Existing password users cannot sign in until linked through Clerk] → Link by
  verified normalized email and document the cutover; do not migrate hashes.
- [Concurrent first login can duplicate tenant data] → Use tested unique
  constraints plus transactional recovery from identity/email races.
- [Every request obtains a Clerk token] → Centralize token attachment in the
  generated-client wrapper and test concurrent and unauthenticated requests.
- [A Clerk JWT can remain valid briefly after revocation] → Accept Clerk's
  bounded token lifetime and do not extend it with an internal refresh session.
- [Custom flows must track Clerk state-machine changes] → Use official hooks and
  typed statuses, keep flow components small, and cover non-complete states.
- [CLI scaffolding can overwrite existing auth/proxy code] → Inspect its diff,
  retain only required changes and preserve product-specific logic.
- [Cutover invalidates internal browser sessions] → Announce reauthentication
  and deploy only after Clerk/Google configuration passes production checks.
- [Rollback leaves Clerk identity rows] → They are additive external-identity
  links compatible with the previous release; no destructive cleanup is
  required.

## Migration Plan

1. Revise and validate the OpenSpec artifacts.
2. Add failing API and web tests for per-request Clerk authentication, Manypost
   authorization, legacy-cookie rejection and missing-configuration failure.
3. Move Clerk verification into the human authentication middleware and attach
   Clerk tokens through the web OpenAPI client.
4. Remove the internal human exchange/refresh lifecycle and legacy password and
   social route registration after replacement tests pass.
5. Regenerate OpenAPI artifacts from a local API and run focused tests,
   `clerk doctor`, `bun run check`, `bun run db:check`,
   `bun run build:web`, `bun run spec:validate` and `git diff --check`.
6. Run PostgreSQL-backed concurrency/rollback tests and the HTTP E2E suite with
   an ephemeral RSA key and locally signed Clerk test sessions.
7. Create focused commits, update PR #39 and deploy only after required review.
8. Configure Clerk/Google/Railway before cutover, validate a first test signup
   and require every existing browser user to authenticate again.

Rollback deploys the previous verified release and its matching environment.
The new release contains no runtime fallback. Existing data remains intact.

## Open Questions

- Which exact callback URI does the linked Clerk instance expose for Google?
  Resolve from Clerk after initialization and record it in operator guidance.
- Does the Clerk application currently require MFA, client trust or additional
  sign-up fields? The custom UI must render the enabled state machine rather
  than assume password-only completion.
- Should destructive removal of obsolete internal session storage be a later
  migration after the Clerk-only cutover is stable? The default is to leave
  storage intact but unreachable in this change.
