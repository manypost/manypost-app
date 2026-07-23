## Why

Manypost has a functional but partially historical codebase whose architecture,
operational topology and maintenance rules are scattered across code and
outdated specifications. A repository-local specification workflow and a
verified system map are needed before humans or agents can change publishing,
identity, data and integrations safely.

## What Changes

- Install OpenSpec 1.6.0 locally and define a spec-driven lifecycle for
  proposals, designs, requirements, tasks, validation and archive.
- Add hierarchical agent guidance, architecture/operation documentation,
  diagnosis, identity inventory, technical backlog and changelog.
- Classify every tracked Postiz reference and replace only current, non-legal,
  non-historical product wording that is safe to migrate.
- Make clean install, web build, Drizzle and OpenSpec checks reproducible in CI
  and container builds.
- Correct confirmed runtime/security defects in SSE timeout, OAuth popup
  messages, expired-session realtime handling and AES-GCM tag constraints.
- Apply only minimal dependency updates that leave the tested compatibility
  surface intact.
- Preserve APIs, persisted values, existing migrations and attribution. No
  intended breaking change is introduced.

### Goals

- Make the repository navigable and changes auditable.
- Put material changes behind validated specifications.
- Make the Manypost/Postiz identity boundary explicit and safe.
- Turn existing local validation into a reproducible CI/deploy gate.
- Resolve small defects confirmed by code, production evidence or static
  analysis.

### Non-goals

- Redesign the product or restructure the monorepo.
- Rewrite publication concurrency, outbound-request networking or queue retry
  semantics in this change.
- Introduce S3, horizontal scaling, a new supervisor, lint/format churn or broad
  dependency modernization.
- Rewrite historical documents, licenses, migrations or external identifiers.

### Compatibility

Public HTTP/MCP contracts, database schema, cookies, API-key prefixes, Railway
domains and provider identifiers remain unchanged. Postiz attribution and
historical records remain available. Runtime fixes only reject untrusted OAuth
messages, avoid opening SSE after session expiry and keep valid SSE/GCM flows
working as designed.

### Rollback

Documentation and OpenSpec files can be reverted independently. CI/build gates
can be reverted without data migration. Runtime fixes contain no persistence
change; rolling back the application image restores the previous behavior.
Dependency updates retain the prior lockfile in Git for a normal revert.

## Capabilities

### New Capabilities

- `repository-governance`: Reproducible OpenSpec lifecycle, maintenance
  documentation, validation gates and contribution rules.
- `product-identity`: Safe, auditable classification and migration of legacy
  Postiz references to the Manypost identity.
- `runtime-reliability`: Tested requirements for SSE lifetime, session-aware
  realtime, OAuth message trust, GCM tag validation and build failure handling.

### Modified Capabilities

None. This repository had no living OpenSpec capabilities before this change.

## Impact

- Repository: `package.json`, `bun.lock`, OpenSpec/Codex configuration,
  `AGENTS.md`, documentation, changelog, CI and PR template.
- Runtime: API server options, web OAuth/realtime helpers and crypto options.
- Delivery: GitHub Actions, Dockerfile and the currently unused Railpack
  equivalent.
- Dependencies: exact local OpenSpec plus minimal affected Next.js/Drizzle
  versions after compatibility validation.
- Data: no schema or migration change.
- Railway: the same `MODE=standalone` topology and domains; builds will fail
  earlier if Next.js cannot compile.
