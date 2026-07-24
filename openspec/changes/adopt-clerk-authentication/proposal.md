## Why

Manypost currently owns password, social-login and browser-session handling even
though authentication is not its product domain. Adopting Clerk centralizes
credential security and account-provider configuration while preserving
Manypost's PostgreSQL organization model as the authorization source of truth.

## What Changes

- Authenticate browser users with the linked Clerk application while retaining
  the existing Manypost login and registration surfaces.
- Exchange a verified Clerk session for an internal, organization-scoped
  Manypost session; never accept organization or role data from the browser.
- Provision or link the internal user and owner organization from a verified
  Clerk identity in an idempotent transaction.
- Replace direct Google/GitHub login handling in the web flow with Clerk-managed
  external accounts.
- Add Clerk configuration names, deployment guidance and Google OAuth callback
  documentation without recording secret values.
- Keep machine API keys, MCP authentication and publication-provider OAuth
  unchanged.
- **BREAKING**: browser password and social authentication move to Clerk.
  Existing internal password credentials do not automatically migrate.

## Capabilities

### New Capabilities

- `clerk-human-authentication`: Clerk-backed human authentication, secure
  identity exchange, internal tenant provisioning, custom Manypost auth UI and
  deployment configuration.

### Modified Capabilities

None. No archived live OpenSpec capability currently specifies human
authentication.

## Impact

- Web: Clerk provider/proxy, custom login and registration flows, bearer-token
  attachment during session exchange, signed-in controls and logout.
- API/core/db: verified external identity port, idempotent identity
  provisioning, internal-session exchange endpoint and tenant-scoped
  authorization.
- Dependencies/configuration: Clerk Next.js/backend SDKs and named environment
  variables in local and Railway documentation.
- Data: existing users and organizations are preserved; linking uses verified,
  normalized email and a stable Clerk subject identity. A new migration is
  required only if the existing identity representation cannot safely store the
  Clerk subject after implementation inspection.
- Security: Clerk secret material remains server-only; session tokens are
  verified for issuer, signature, lifetime and authorized party. Negative tests
  cover missing, invalid and cross-origin tokens plus tenant-claim injection.
- Product identity: no Postiz occurrence is renamed; identity impact is
  therefore not applicable to the Postiz-reference classification.
- Railway: no deployment is performed in this change. Production later needs
  Clerk configuration on `app.manypost.com.br`; API and MCP domains remain
  unchanged.

## Goals

- Preserve the polished Manypost UI while delegating authentication to Clerk.
- Keep organization membership and roles authoritative in Manypost.
- Make local and production setup explicit, testable and reversible.

## Non-goals

- Migrating existing password hashes into Clerk.
- Replacing machine API keys or adding Clerk authentication to MCP.
- Moving channel-provider OAuth flows to Clerk.
- Enabling Clerk Organizations as the authorization source in this change.

## Compatibility

Existing application data, organizations, memberships, API keys and external
channel connections remain valid. An existing user can link to Clerk when the
Clerk primary email is verified and matches the normalized internal email.
Rollback must leave the pre-Clerk internal auth code and schema recoverable
until the cutover has been validated.

## Rollback

Revert the application commits and remove the Clerk environment variable names
from the deployment configuration. Restore the previous login routes and proxy
guard; no Railway mutation or destructive data migration is part of this
change. If a migration is introduced, its rollback must preserve all existing
users, memberships and identities.
