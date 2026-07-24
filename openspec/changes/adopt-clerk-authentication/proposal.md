## Why

Manypost currently owns password, social-login and browser-session handling even
though authentication is not its product domain. Adopting Clerk centralizes
credential security and account-provider configuration while preserving
Manypost's PostgreSQL organization model as the authorization source of truth.

## What Changes

- Authenticate every human browser request with the linked Clerk application
  while retaining the existing Manypost login and registration surfaces.
- Verify Clerk session tokens at the API boundary and resolve authorization
  from persisted Manypost users, organizations, memberships and roles.
- Provision or link the internal user and owner organization from a verified
  Clerk identity in an idempotent transaction.
- Replace direct Google/GitHub login handling in the web flow with Clerk-managed
  external accounts.
- Remove the legacy human password/social endpoints and the internal
  access/refresh-session runtime; missing Clerk configuration fails closed.
- Add Clerk configuration names, deployment guidance and Google OAuth callback
  documentation without recording secret values.
- Keep machine API keys, MCP authentication and publication-provider OAuth
  unchanged, with machine surfaces explicitly rejecting Clerk bearer/cookies.
- **BREAKING**: Clerk becomes the only runtime authenticator for human users.
  Existing internal credentials and sessions do not migrate.

## Capabilities

### New Capabilities

- `clerk-human-authentication`: Clerk-backed human authentication, secure
  request authentication, internal tenant authorization, custom Manypost auth
  UI and deployment configuration.

### Modified Capabilities

None. No archived live OpenSpec capability currently specifies human
authentication.

## Impact

- Web: Clerk provider/proxy, custom login and registration flows, bearer-token
  attachment to protected API requests, signed-in controls and logout.
- API/core/db: verified Clerk request identity, idempotent internal identity
  provisioning and tenant-scoped authorization from Manypost memberships.
- Dependencies/configuration: Clerk Next.js/backend SDKs and named environment
  variables in local and Railway documentation.
- Data: existing users and organizations are preserved; linking uses verified,
  normalized email and a stable Clerk subject identity. A new migration is
  required only if the existing identity representation cannot safely store the
  Clerk subject after implementation inspection.
- Security: Clerk secret material remains server-only; session tokens are
  verified for issuer, signature, lifetime and authorized party. Negative tests
  cover missing, invalid and cross-origin tokens, tenant-claim injection and
  removal of legacy authentication entry points.
- Product identity: no Postiz occurrence is renamed; identity impact is
  therefore not applicable to the Postiz-reference classification.
- Railway: no deployment is performed in this change. Production later needs
  Clerk configuration on `app.manypost.com.br`; API and MCP domains remain
  unchanged.

## Goals

- Preserve the polished Manypost UI while delegating authentication to Clerk.
- Make Clerk the sole authenticator for every human application request.
- Keep organization membership and roles authoritative in Manypost.
- Make local and production setup explicit, testable and fail-closed.

## Non-goals

- Migrating existing password hashes into Clerk.
- Using Clerk Organizations as the Manypost tenant or role source of truth.
- Replacing machine API keys or adding Clerk authentication to MCP.
- Moving channel-provider OAuth flows to Clerk.

## Compatibility

Existing application data, organizations, memberships, API keys and external
channel connections remain valid. An existing user can link to Clerk when the
Clerk primary email is verified and matches the normalized internal email.
Existing browser sessions are invalidated at cutover and users authenticate
again through Clerk. No legacy human authentication path remains reachable at
runtime.

## Rollback

Roll back by deploying the previously verified application release and its
matching configuration, not through a dormant runtime fallback. No destructive
data migration is part of this change. Any additive identity data must remain
compatible with the previous release, and rollback must preserve all existing
users, memberships and identities.
