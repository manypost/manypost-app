## 1. Baseline and Clerk initialization

- [x] 1.1 Run `bun install --frozen-lockfile`, record the clean focused baseline, and initialize the linked Clerk application with `clerk init --app app_3GuqzZa65tX3maBXqZCIAW8Izxs`.
  - The linked app is reachable; `clerk init` cannot detect the monorepo root, so the documented manual fallback was applied with Bun.
- [x] 1.2 Inspect and minimize the Clerk-generated diff, using Bun for dependencies and preserving the existing Next.js 16 layout, proxy, i18n and Manypost auth UI.
- [x] 1.3 Add Clerk variable-name validation and tests without reading, printing or committing secret values.

## 2. Verified identity exchange

- [x] 2.1 Write and run failing core tests for idempotent Clerk identity linking, verified-email rejection and concurrent first-login behavior.
- [x] 2.2 Implement the minimum core/repository behavior needed to reuse `provider = "clerk"` safely, generating a new Drizzle migration only if existing constraints are insufficient.
- [x] 2.3 Write and run failing API tests for missing, invalid, wrong-authorized-party and valid Clerk exchange requests, including rejection of browser-controlled tenant data.
- [x] 2.4 Implement the Clerk verification adapter, composition-root wiring and internal exchange endpoint with secret-safe structured failures.
- [x] 2.5 Start a local API, regenerate `apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts` through `generate:api`, and review both generated files.

## 3. Custom Manypost authentication UI

- [x] 3.1 Write and run failing web tests for Clerk sign-in, sign-up verification, incomplete authentication states, Google OAuth initiation and dual-session logout.
- [x] 3.2 Place `ClerkProvider` inside `<body>` and compose `clerkMiddleware` with the current Next.js proxy, keeping `'/__clerk/:path*'` exactly once after the API/TRPC matcher.
- [x] 3.3 Adapt the existing login, registration and social controls to Clerk hooks while preserving Manypost components, translations and accessibility.
- [x] 3.4 Implement the OAuth callback, internal-session exchange, deduplicated recovery and dual-session logout; keep API keys, MCP and channel OAuth unchanged.
- [ ] 3.5 Verify the signed-in top-bar profile control and signed-out authentication controls in a browser at desktop and mobile widths.
  - Signed-out login and registration controls passed at desktop and mobile widths. Signed-in verification awaits the first test user and a running local API/database.

## 4. Operations and documentation

- [ ] 4.1 Run `clerk doctor` and record only non-secret findings; derive the linked Clerk Google callback rather than guessing it.
  - `clerk doctor` passes the functional checks. The production domain is still pending DNS/SSL and Google has no custom credentials, so the exact callback must still be copied from the production SSO connection in Clerk Dashboard.
- [x] 4.2 Document Clerk/Google/Railway variable names, JavaScript origins, redirect URIs, rollout and rollback in the canonical architecture/operations docs.
- [x] 4.3 Update `CHANGELOG.md` and any affected repository/auth flow maps without changing protected historical or attribution references.

## 5. Verification and local commits

- [x] 5.1 Run focused tests plus `bun run check`, `bun run db:check`, `bun run build:web`, `bun run spec:validate` and `git diff --check`.
- [x] 5.2 Review the diff for secrets, generated-file provenance, tenant authorization, Clerk secret client exposure and unrelated changes.
- [x] 5.3 Create small Conventional Commits on `feat/clerk-auth`, verify the resulting commit history and leave the branch unpushed and undeployed.
