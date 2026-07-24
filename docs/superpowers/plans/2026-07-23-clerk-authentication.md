# Clerk Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authenticate Manypost browser users with Clerk through the existing
custom UI while keeping Manypost organizations and roles authoritative.

**Architecture:** Next.js completes Clerk custom authentication, then sends the
Clerk session token to a dedicated Hono exchange endpoint. The API verifies the
token and verified primary email server-side, links `provider = "clerk"` to an
internal user, and issues the existing organization-scoped HttpOnly session.

**Tech Stack:** Bun 1.3.14, TypeScript, Next.js 16 App Router,
`@clerk/nextjs`, Clerk backend verification, Hono/OpenAPI, PostgreSQL/Drizzle,
`bun:test`.

## Global Constraints

- Use only Bun for project dependencies and lockfile changes.
- Never read, print or commit `.env`, Railway values, cookies, tokens or keys.
- Keep `CLERK_SECRET_KEY` and verification material outside client modules.
- Keep Manypost PostgreSQL memberships authoritative for organization and role.
- Preserve API-key, MCP and channel-provider OAuth behavior.
- Regenerate OpenAPI files only through the repository generator.
- Do not deploy, push or mutate Railway in this branch.

---

### Task 1: Initialize and constrain Clerk

**Files:**
- Modify: `apps/web/package.json`
- Modify: `bun.lock`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/proxy.ts`
- Test: `apps/web/src/proxy.test.ts`

**Interfaces:**
- Consumes: Clerk application `app_3GuqzZa65tX3maBXqZCIAW8Izxs`
- Produces: a Clerk-enabled provider tree and proxy that preserve existing route decisions

- [ ] **Step 1: Run the existing focused proxy test or add one that describes public, authenticated and `/__clerk` routing, then confirm the new Clerk expectation fails.**
- [ ] **Step 2: Run `clerk init --app app_3GuqzZa65tX3maBXqZCIAW8Izxs` from the repository root and inspect `git diff` before retaining changes.**
- [ ] **Step 3: Keep `ClerkProvider` inside `<body>` and compose `clerkMiddleware`; the matcher order must contain `/(api|trpc)(.*)` before `/__clerk/:path*`.**
- [ ] **Step 4: Run the focused proxy test and `bun run typecheck:web`; expect both to pass.**
- [ ] **Step 5: Commit only when the initialization and configuration slice is independently valid.**

### Task 2: Exchange verified Clerk identity

**Files:**
- Modify: `packages/config/src/env.ts`
- Test: `packages/config/src/env.test.ts`
- Create: `apps/api/src/infra/identity/clerk.ts`
- Test: `apps/api/src/infra/identity/clerk.test.ts`
- Modify: `apps/api/src/container.ts`
- Modify: `apps/api/src/http/routes/auth.routes.ts`
- Test: `apps/api/src/http/routes/auth.routes.test.ts`
- Test: `packages/core/src/application/use-cases/auth.test.ts`

**Interfaces:**
- Consumes: Clerk bearer session token and server-only Clerk configuration
- Produces: `POST /v1/auth/clerk/exchange`, which returns the existing auth result and sets existing HttpOnly cookies

- [ ] **Step 1: Add failing config tests asserting required Clerk variable names and valid authorized origins without including values in messages.**
- [ ] **Step 2: Add failing adapter tests for valid identity resolution and invalid signature, issuer, lifetime, authorized-party and unverified-email cases.**
- [ ] **Step 3: Add failing route tests proving request-body tenant identifiers are ignored and invalid tokens create no persistence.**
- [ ] **Step 4: Add a failing concurrency test using the existing external-identity repository contract; require one identity and one initial organization.**
- [ ] **Step 5: Implement the smallest verifier and exchange wiring that passes those tests, reusing the current internal session issuer and `provider = "clerk"` identity link.**
- [ ] **Step 6: Run the focused tests and `bun run typecheck`; expect clean passes.**
- [ ] **Step 7: Commit the server exchange slice with its tests.**

### Task 3: Preserve the custom authentication experience

**Files:**
- Modify: `apps/web/src/features/auth/hooks.ts`
- Modify: `apps/web/src/features/auth/login-form.tsx`
- Modify: `apps/web/src/features/auth/register-form.tsx`
- Modify: `apps/web/src/features/auth/social-buttons.tsx`
- Create: `apps/web/src/app/(auth)/sso-callback/page.tsx`
- Modify: `apps/web/src/components/shell/topbar.tsx`
- Test: colocated `*.test.ts` files under `apps/web/src/features/auth/`

**Interfaces:**
- Consumes: Clerk `useSignIn`, `useSignUp`, `useAuth` and `signOut`
- Produces: Manypost-styled email/password, verification, Google OAuth, exchange and logout flows

- [ ] **Step 1: Extract pure state-to-action helpers and write failing tests for complete, verification-required, MFA/client-trust and error states.**
- [ ] **Step 2: Implement the helpers minimally, then run their focused tests until green.**
- [ ] **Step 3: Wire the existing forms to Clerk while retaining labels, validation, loading states, accessibility and translations.**
- [ ] **Step 4: Add the typed Google OAuth callback and exchange once Clerk reports a complete session.**
- [ ] **Step 5: Update logout to end the API session and Clerk session, then clear queries and navigate.**
- [ ] **Step 6: Run focused tests and `bun run typecheck:web`; expect clean passes.**
- [ ] **Step 7: Commit the UI and lifecycle slice.**

### Task 4: Regenerate contracts and document operations

**Files:**
- Generate: `apps/web/openapi.json`
- Generate: `apps/web/src/lib/api/schema.d.ts`
- Modify: `.env.example`
- Modify: `docs/architecture/flows.md`
- Modify: `docs/architecture/data-and-infrastructure.md`
- Modify: `docs/operations/development.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: running local API OpenAPI document and verified Clerk diagnostics
- Produces: generated client types and exact operator instructions without secrets

- [ ] **Step 1: Start an isolated local API and run `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api`.**
- [ ] **Step 2: Review the generated diff and confirm only the Clerk exchange contract changed.**
- [ ] **Step 3: Run `clerk doctor`; record only non-secret configuration names and callback/origin information.**
- [ ] **Step 4: Document local and production origins, Google callback, variable ownership, rollout and rollback.**
- [ ] **Step 5: Run `bun run spec:validate` and `git diff --check`; expect clean passes.**
- [ ] **Step 6: Commit generated contracts and operational documentation.**

### Task 5: End-to-end verification and handoff

**Files:**
- Modify: `openspec/changes/adopt-clerk-authentication/tasks.md`

**Interfaces:**
- Consumes: all previous committed slices
- Produces: an unpushed, reviewable local branch with verified setup evidence

- [ ] **Step 1: Run the focused auth tests and capture only pass/fail summaries.**
- [ ] **Step 2: Run `bun run check`, `bun run db:check`, `bun run build:web`, `bun run spec:validate` and `git diff --check`.**
- [ ] **Step 3: Start the app and verify login, registration, Google initiation, profile control and logout in the browser without real external calls in automated tests.**
- [ ] **Step 4: Review `git diff`, `git status`, dependency changes and history for secrets or unrelated edits.**
- [ ] **Step 5: Mark only evidenced OpenSpec tasks complete and create a final local Conventional Commit if needed.**
- [ ] **Step 6: Report the exact Google Console fields, Railway variable names, local branch and commits; explicitly confirm no push or deployment occurred.**
