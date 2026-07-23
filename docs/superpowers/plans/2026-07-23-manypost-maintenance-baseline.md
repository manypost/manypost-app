# Manypost Maintenance Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reproducible OpenSpec workflow, a navigable maintenance
map, safe Manypost identity rules, stronger validation gates, and targeted
runtime/security fixes without changing product behavior beyond confirmed
defects.

**Architecture:** Keep the existing Bun workspace and its package boundaries.
Add governance as repository-local tooling and focused Markdown documents;
make the current build contract explicit in CI and Railway. Implement only
small fixes at existing seams, with a failing test before each code change,
while moving broad concurrency, SSRF, queue, and storage work into validated
OpenSpec proposals.

**Tech Stack:** Bun 1.3.14, TypeScript, Hono, Next.js 16, React 19, PostgreSQL,
Drizzle, pg-boss, Redis, `bun:test`, dependency-cruiser, OpenSpec 1.6.0,
GitHub Actions, Railway.

## Global Constraints

- Preserve existing behavior except for confirmed, documented defects.
- Use Bun exclusively for dependency and script operations.
- Pin `@fission-ai/openspec` exactly to `1.6.0`; require Node.js `>=20.19.0`
  for that CLI.
- Never print, edit, or commit credentials, tokens, private keys, connection
  strings, or production variable values.
- Do not rewrite historical migrations, license/attribution files, or generated
  artifacts manually.
- Do not globally replace `postiz`; classify every remaining occurrence.
- Use only the configured Git identity and add no coauthors/signatures.
- Keep changes in `chore/maintenance-baseline-openspec`, with approximately
  10–15 independently reviewable commits.
- Merge only after CI passes, the PR is conflict-free and unblocked, and branch
  protection is respected.

---

## Planned file structure

| Path | Responsibility |
| --- | --- |
| `openspec/config.yaml` | Project-level OpenSpec context and artifact rules |
| `.codex/skills/openspec-*/SKILL.md` | CLI-generated Codex workflows |
| `openspec/changes/establish-maintenance-baseline/` | Executed change artifacts |
| `openspec/changes/harden-publishing-idempotency/` | Future concurrency change |
| `openspec/changes/harden-outbound-request-security/` | Future SSRF change |
| `docs/openspec.md` | Human/agent OpenSpec operating guide |
| `AGENTS.md` | Root contribution and safety contract |
| `packages/db/AGENTS.md` | Data/migration rules |
| `packages/providers/AGENTS.md` | External-provider rules |
| `docs/architecture/README.md` | Canonical architecture entry point |
| `docs/architecture/repository-map.md` | Directory/package map |
| `docs/architecture/flows.md` | End-to-end business flows |
| `docs/architecture/data-and-infrastructure.md` | Data, env, queues, deploy, CI |
| `docs/operations/development.md` | Install/run/test/debug/change recipes |
| `docs/audits/postiz-reference-inventory.md` | Six-category identity inventory |
| `docs/audits/technical-backlog.md` | Prioritized unresolved risks |
| `CHANGELOG.md` | Keep a Changelog user/developer/operator impact |

## Task 1: Record the baseline diagnosis

**Files:**

- Create: `docs/audits/2026-07-23-initial-diagnosis.md`
- Create: `docs/superpowers/plans/2026-07-23-manypost-maintenance-baseline.md`

**Interfaces:**

- Consumes: repository state at
  `aa382e85edceb57a3e35959d762c26e7fd971a82`.
- Produces: fixed evidence IDs `H-01`…`L-05` used by later docs/specs.

- [ ] **Step 1: Verify the worktree and baseline commit**

  Run:
  `git status --short --branch && git rev-parse HEAD`

  Expected: branch `chore/maintenance-baseline-openspec`, no unexpected files,
  commit `aa382e85edceb57a3e35959d762c26e7fd971a82`.

- [ ] **Step 2: Review the report for secret values and placeholders**

  Run:
  `rg -n 'T[B]D|T[O]DO|postgres[q]l://|redis[:]//|s[k]_live_|s[k]_test_' docs/audits/2026-07-23-initial-diagnosis.md docs/superpowers/plans/2026-07-23-manypost-maintenance-baseline.md`

  Expected: no output.

- [ ] **Step 3: Commit the diagnosis**

  Run:

  ```bash
  git add docs/audits/2026-07-23-initial-diagnosis.md \
    docs/superpowers/plans/2026-07-23-manypost-maintenance-baseline.md
  git commit -m "docs(audit): record initial codebase diagnosis"
  ```

  Expected: one commit authored by the configured Git identity.

## Task 2: Add reproducible OpenSpec tooling

**Files:**

- Modify: `package.json`
- Modify (generated): `bun.lock`
- Create (generated): `openspec/config.yaml`
- Create (generated): `.codex/skills/openspec-*/SKILL.md`

**Interfaces:**

- Consumes: official `@fission-ai/openspec@1.6.0` CLI.
- Produces: local `openspec` binary and Bun scripts
  `spec:new`, `spec:status`, `spec:validate`, `spec:archive`.

- [ ] **Step 1: Install the exact local dependency**

  Run:
  `bun add --dev --exact @fission-ai/openspec@1.6.0`

  Expected: exact version in `devDependencies`, lockfile updated by Bun only.

- [ ] **Step 2: Initialize the official Codex profile**

  Run:
  `bun run openspec init . --tools codex --profile core --force`

  Expected: `openspec/config.yaml` and six OpenSpec skill directories under
  `.codex/skills/`.

- [ ] **Step 3: Add project scripts**

  Add these exact scripts to root `package.json`:

  ```json
  {
    "spec:new": "openspec new change",
    "spec:status": "openspec status",
    "spec:validate": "openspec validate --all --strict --no-interactive",
    "spec:archive": "openspec archive",
    "build:web": "bun run --cwd apps/web build",
    "db:check": "bun run --cwd packages/db check"
  }
  ```

- [ ] **Step 4: Verify the local CLI**

  Run:
  `bun run openspec --version && bun run openspec list --json`

  Expected: version `1.6.0` and valid JSON.

- [ ] **Step 5: Commit**

  Run:

  ```bash
  git add package.json bun.lock openspec/config.yaml .codex/skills
  git commit -m "chore(openspec): add reproducible local tooling"
  ```

## Task 3: Specify the maintenance initiative

**Files:**

- Modify: `openspec/config.yaml`
- Create: `openspec/changes/establish-maintenance-baseline/proposal.md`
- Create: `openspec/changes/establish-maintenance-baseline/design.md`
- Create: `openspec/changes/establish-maintenance-baseline/specs/repository-governance/spec.md`
- Create: `openspec/changes/establish-maintenance-baseline/specs/product-identity/spec.md`
- Create: `openspec/changes/establish-maintenance-baseline/specs/runtime-reliability/spec.md`
- Create: `openspec/changes/establish-maintenance-baseline/tasks.md`
- Create: `docs/openspec.md`

**Interfaces:**

- Consumes: generated OpenSpec config and artifact instructions.
- Produces: requirements with SHALL statements and Given/When/Then scenarios
  for governance, identity and the confirmed runtime fixes.

- [ ] **Step 1: Create the change skeleton**

  Run:

  ```bash
  bun run openspec new change establish-maintenance-baseline \
    --description "Adopt OpenSpec, document the architecture, govern identity, and fix confirmed maintenance defects"
  ```

  Expected: change directory with `.openspec.yaml`.

- [ ] **Step 2: Obtain artifact instructions**

  Run:

  ```bash
  bun run openspec instructions proposal --change establish-maintenance-baseline --json
  bun run openspec instructions specs --change establish-maintenance-baseline --json
  bun run openspec instructions design --change establish-maintenance-baseline --json
  bun run openspec instructions tasks --change establish-maintenance-baseline --json
  ```

  Expected: four valid JSON responses; authored artifacts follow their required
  templates.

- [ ] **Step 3: Author proposal, delta specs, design and tasks**

  Requirements must explicitly cover:

  - local exact OpenSpec version and strict validation;
  - OpenSpec-before-code for material changes;
  - synchronized AGENTS, architecture docs and changelog;
  - six-category Postiz decision record;
  - preservation of legal/historical/compatibility names;
  - required web build and frozen lockfile;
  - SSE idle timeout greater than the 25-second keepalive;
  - OAuth messages accepted only from the popup and same origin;
  - realtime stream opened only after successful session confirmation;
  - AES-GCM decryption constrained to a 16-byte auth tag.

- [ ] **Step 4: Author the operating guide**

  `docs/openspec.md` must document these exact flows:

  ```text
  bun run spec:new -- <kebab-case-name>
  bun run spec:status -- --change <name>
  bun run openspec instructions <artifact> --change <name>
  bun run spec:validate
  bun run spec:archive -- <name> -y
  ```

  It must distinguish active changes, living specs and archived changes, and
  explain update/installation with Bun.

- [ ] **Step 5: Validate and commit**

  Run:

  ```bash
  bun run spec:validate
  git add openspec/config.yaml openspec/changes/establish-maintenance-baseline docs/openspec.md
  git commit -m "docs(openspec): define maintenance change workflow"
  ```

## Task 4: Add repository-specific agent rules

**Files:**

- Create: `AGENTS.md`
- Create: `packages/db/AGENTS.md`
- Create: `packages/providers/AGENTS.md`
- Modify: `.github/pull_request_template.md`

**Interfaces:**

- Consumes: commands and boundaries confirmed in the diagnosis.
- Produces: hierarchical, verifiable instructions for human and agent changes.

- [ ] **Step 1: Write root rules**

  Include exact commands, Bun-only package management, package dependency
  direction, secret handling, generated-file rules, minimum tests by impact,
  OpenSpec gate, changelog gate, conventional commit examples, PR evidence,
  migration safety and definition of done.

- [ ] **Step 2: Write scoped database/provider rules**

  Database rules must prohibit editing old migrations and require
  `bun run --cwd packages/db generate`, schema check and tenant-scope review.
  Provider rules must require capability/settings validation, normalized error
  classification, fake HTTP tests, token secrecy and no live API calls in tests.

- [ ] **Step 3: Extend the PR template**

  Add required fields for OpenSpec change, identity classification, migrations,
  validation command/results, known risks, rollback and Railway impact.

- [ ] **Step 4: Commit**

  Run:

  ```bash
  git add AGENTS.md packages/db/AGENTS.md packages/providers/AGENTS.md \
    .github/pull_request_template.md
  git commit -m "docs(agents): add repository-specific contribution rules"
  ```

## Task 5: Build the repository and architecture map

**Files:**

- Create: `docs/architecture/README.md`
- Create: `docs/architecture/repository-map.md`
- Modify: `docs/README.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: application/package inventory and verified commands.
- Produces: canonical documentation entry point linked from both READMEs.

- [ ] **Step 1: Write the architecture overview**

  Include system purpose, stack, container/component diagram, runtime modes,
  request surfaces, dependency direction, provider list and “where to change”
  decision table.

- [ ] **Step 2: Write the directory map**

  For every app/package/infrastructure directory include responsibility, entry
  points, key files, dependencies, consumers, commands, risks and change
  guidance. Mark generated and historical paths.

- [ ] **Step 3: Link the canonical map**

  Add a documentation section to root `README.md` and a categorized index to
  `docs/README.md`; do not remove legal attribution.

- [ ] **Step 4: Check links and commit**

  Run:

  ```bash
  rg -n '\\]\\([^)]*\\.md\\)' README.md docs/README.md docs/architecture
  git add README.md docs/README.md docs/architecture
  git commit -m "docs(architecture): map repository and module boundaries"
  ```

## Task 6: Document end-to-end flows

**Files:**

- Create: `docs/architecture/flows.md`

**Interfaces:**

- Consumes: route/use-case/repository/queue/provider paths.
- Produces: traceable flows for auth, connections, scheduling, publishing,
  threads, approvals, media, webhooks, MCP/public API and billing.

- [ ] **Step 1: Document every flow**

  Each flow must state entry, validation, domain operation, persistence,
  asynchronous work, external call, result, errors/recovery and relevant files.
  Use Mermaid only for scheduling/publishing because it has more than three
  dependent asynchronous branches.

- [ ] **Step 2: Cross-check all paths**

  Run a loop using `test -e` for every backticked source path listed in the
  document. Expected: no missing path.

- [ ] **Step 3: Commit**

  Run:
  `git add docs/architecture/flows.md && git commit -m "docs(architecture): document end-to-end business flows"`

## Task 7: Document data, infrastructure and operations

**Files:**

- Create: `docs/architecture/data-and-infrastructure.md`
- Create: `docs/operations/development.md`

**Interfaces:**

- Consumes: Zod env schema, Drizzle schema/migrations, Railway read-only facts.
- Produces: secret-free environment catalog and operational recipes.

- [ ] **Step 1: Document data and infrastructure**

  Include entity groups and relationships, tenant-scope caveat, migration
  lifecycle, cache/Redis behavior, pg-boss queues, local storage, all environment
  variable names with purpose/requiredness/format but no values, Docker/Railway
  modes, domains/ports, observability, CI and backup limitations.

- [ ] **Step 2: Document development recipes**

  Include clean install, local services, run modes, test/build commands,
  debugging request IDs/jobs/SSE, adding route/use case/provider, changing DB,
  regenerating OpenAPI, impact checklist and unavailable validations.

- [ ] **Step 3: Commit**

  Run:

  ```bash
  git add docs/architecture/data-and-infrastructure.md docs/operations/development.md
  git commit -m "docs(operations): document data infrastructure and development"
  ```

## Task 8: Classify and migrate product identity safely

**Files:**

- Create: `docs/audits/postiz-reference-inventory.md`
- Modify: safe operational comments/tests/docs identified by the inventory
- Do not modify: `LICENSE`, `NOTICE`, `ATTRIBUTION.md`,
  `packages/contracts/LICENSE`, `docs/principal/POSTIZ_ANALYSIS.md`,
  `docs/references for postiz/`

**Interfaces:**

- Consumes: case-insensitive tracked-file search.
- Produces: six categories, counts, preserved-path reasons and final residual
  search.

- [ ] **Step 1: Export the tracked occurrence list**

  Run:
  `git grep -In -E 'postiz|Postiz|POSTIZ' > /tmp/manypost-postiz-before.txt`

  Expected: 298 initial matches. The temporary file must not be committed.

- [ ] **Step 2: Classify each file/group**

  Use exactly:

  1. direct safe replacement;
  2. technical refactor required;
  3. compatibility required;
  4. license/attribution required;
  5. historical, do not modify;
  6. human decision required.

  Record file/glob, occurrence type, rationale, alteration risk and future
  recommendation.

- [ ] **Step 3: Apply only category 1 changes**

  Safe edits may replace comparative wording in current operational comments
  with behavioral descriptions. Never change attribution headers, historical
  analyses, old migrations, external identifiers or legal notices.

- [ ] **Step 4: Run the final search and brand check**

  Run:

  ```bash
  git grep -In -E 'postiz|Postiz|POSTIZ' > /tmp/manypost-postiz-after.txt
  bun run check:brand
  ```

  Expected: every residual occurrence maps to inventory categories 2–6; brand
  check passes.

- [ ] **Step 5: Commit**

  Run:
  `git add docs/audits/postiz-reference-inventory.md <safe-edited-files> && git commit -m "docs(brand): classify legacy Postiz references"`

## Task 9: Make build and CI deterministic

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `docker/Dockerfile`
- Modify: `railpack.json`

**Interfaces:**

- Consumes: `build:web`, `db:check`, `spec:validate`.
- Produces: `check:ci` and image builds that fail on a broken web build.

- [ ] **Step 1: Add the CI aggregate**

  Add:

  ```json
  {
    "packageManager": "bun@1.3.14",
    "scripts": {
      "check:ci": "bun run check && bun run db:check && bun run build:web && bun run spec:validate"
    }
  }
  ```

- [ ] **Step 2: Update GitHub Actions**

  Set `bun-version: 1.3.14`, install with
  `bun install --frozen-lockfile`, replace partial duplicate checks with
  `bun run check:ci`, and retain PostgreSQL/Redis E2E steps.

- [ ] **Step 3: Stop masking builds**

  Use these exact lines:

  ```dockerfile
  RUN bun install --frozen-lockfile
  RUN cd apps/web && bun run build
  ```

  Make the equivalent Railpack commands
  `bun install --frozen-lockfile` and `cd apps/web && bun run build`.

- [ ] **Step 4: Validate and commit**

  Run:

  ```bash
  bun run check:ci
  docker build -f docker/Dockerfile -t manypost:maintenance-baseline .
  git add package.json .github/workflows/ci.yml docker/Dockerfile railpack.json
  git commit -m "ci: enforce reproducible web and spec validation"
  ```

## Task 10: Fix SSE timeout with TDD

**Files:**

- Create: `apps/api/src/main.test.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**

- Consumes: Bun server option `idleTimeout` in seconds.
- Produces: exported/default server config with `idleTimeout: 30`, greater than
  `KEEPALIVE_MS` (25 seconds).

- [ ] **Step 1: Write a failing test**

  Extract the server options into an importable module-level value named
  `serverOptions` and assert:

  ```ts
  import { describe, expect, test } from 'bun:test';
  import { serverOptions } from './main';

  describe('Bun server options', () => {
    test('keeps SSE alive past the 25 second ping interval', () => {
      expect(serverOptions.idleTimeout).toBeGreaterThan(25);
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm the expected failure**

  Run: `bun test apps/api/src/main.test.ts`

  Expected: failure because `serverOptions` or `idleTimeout` is absent.

- [ ] **Step 3: Implement the minimal option**

  Make the exported default options include:

  ```ts
  export const serverOptions = {
    port: env.PORT,
    fetch: app.fetch,
    idleTimeout: 30,
  };

  export default serverOptions;
  ```

- [ ] **Step 4: Run focused and full tests**

  Run:
  `bun test apps/api/src/main.test.ts && bun run check`

  Expected: both pass.

- [ ] **Step 5: Commit**

  Run:
  `git add apps/api/src/main.ts apps/api/src/main.test.ts && git commit -m "fix(api): keep SSE connections alive"`

## Task 11: Harden OAuth and AES-GCM with TDD

**Files:**

- Modify: `apps/web/src/features/channels/oauth-popup.ts`
- Create: `apps/web/src/features/channels/oauth-popup.test.ts`
- Modify: `packages/core/src/infra/crypto/aes-gcm.service.ts`
- Modify: `packages/core/src/infra/crypto/aes-gcm.service.test.ts`

**Interfaces:**

- Produces:
  `isExpectedOauthMessage(event: MessageEvent, popup: Window): boolean`;
  AES-GCM decipher constrained with `{ authTagLength: TAG_LEN }`.

- [ ] **Step 1: Write OAuth decision tests**

  Test four cases: same origin + popup + allowed type is true; foreign origin,
  different source and unknown type are false. Use plain object casts rather
  than opening a real browser window.

- [ ] **Step 2: Verify OAuth test fails**

  Run:
  `bun test apps/web/src/features/channels/oauth-popup.test.ts`

  Expected: failure because `isExpectedOauthMessage` does not exist.

- [ ] **Step 3: Implement the pure predicate**

  Add:

  ```ts
  export function isExpectedOauthMessage(event: MessageEvent, popup: Window): boolean {
    return (
      event.origin === window.location.origin &&
      event.source === popup &&
      (event.data?.type === 'manypost:oauth:success' ||
        event.data?.type === 'manypost:oauth:done')
    );
  }
  ```

  Use it in `onMessage`.

- [ ] **Step 4: Add the AES tag-length regression**

  Extend the existing tampering tests to verify a valid ciphertext still
  decrypts and a truncated input rejects. Then pass
  `{ authTagLength: TAG_LEN }` to `createDecipheriv`.

- [ ] **Step 5: Run and commit**

  Run:

  ```bash
  bun test apps/web/src/features/channels/oauth-popup.test.ts \
    packages/core/src/infra/crypto/aes-gcm.service.test.ts
  bun run check
  git add apps/web/src/features/channels/oauth-popup.ts \
    apps/web/src/features/channels/oauth-popup.test.ts \
    packages/core/src/infra/crypto/aes-gcm.service.ts \
    packages/core/src/infra/crypto/aes-gcm.service.test.ts
  git commit -m "fix(security): validate OAuth messages and GCM tags"
  ```

## Task 12: Stop realtime retries after session expiry with TDD

**Files:**

- Modify: `apps/web/src/features/realtime/use-realtime.ts`
- Create: `apps/web/src/features/realtime/session.ts`
- Create: `apps/web/src/features/realtime/session.test.ts`

**Interfaces:**

- Produces:
  `hasActiveSession(result: { response: Response }): boolean`;
  the hook opens EventSource only when the `/auth/me` response is successful.

- [ ] **Step 1: Write failing pure tests**

  Assert 200 returns true and 401 returns false:

  ```ts
  import { expect, test } from 'bun:test';
  import { hasActiveSession } from './session';

  test('accepts a successful session check', () => {
    expect(hasActiveSession({ response: new Response(null, { status: 200 }) })).toBe(true);
  });

  test('rejects an expired session check', () => {
    expect(hasActiveSession({ response: new Response(null, { status: 401 }) })).toBe(false);
  });
  ```

- [ ] **Step 2: Verify failure**

  Run: `bun test apps/web/src/features/realtime/session.test.ts`

  Expected: missing module/export failure.

- [ ] **Step 3: Implement and use the guard**

  Implement:

  ```ts
  export const hasActiveSession = (result: { response: Response }) => result.response.ok;
  ```

  In `open`, inspect the `api.GET` result. If not active, clear the non-sensitive
  `mp_session` marker with `Max-Age=0`, navigate to `/login` using
  `window.location.replace('/login')`, and return without constructing
  `EventSource`.

- [ ] **Step 4: Validate and commit**

  Run:

  ```bash
  bun test apps/web/src/features/realtime/session.test.ts
  bun run check
  bun run build:web
  git add apps/web/src/features/realtime
  git commit -m "fix(web): stop realtime retries after session expiry"
  ```

## Task 13: Remediate minimal direct dependency advisories

**Files:**

- Modify: `apps/web/package.json`
- Modify: `packages/db/package.json`
- Modify (generated): `bun.lock`

**Interfaces:**

- Consumes: Next.js `16.2.11`, Drizzle ORM `0.45.2`.
- Produces: direct versions outside the affected ranges reported on
  2026-07-23.

- [ ] **Step 1: Update only affected direct packages**

  Run:

  ```bash
  bun add --cwd apps/web next@16.2.11
  bun add --cwd packages/db drizzle-orm@0.45.2
  ```

  Expected: no unrelated direct dependency upgrades.

- [ ] **Step 2: Run full compatibility checks**

  Run:

  ```bash
  bun install --frozen-lockfile
  bun run check:ci
  bun audit
  ```

  Expected: tests/build/schema/OpenSpec pass; audit count decreases. Remaining
  transitives are recorded with package chain and reason instead of forced
  overrides.

- [ ] **Step 3: Commit**

  Run:
  `git add apps/web/package.json packages/db/package.json bun.lock && git commit -m "fix(deps): update affected Next and Drizzle versions"`

## Task 14: Publish backlog and changelog

**Files:**

- Create: `openspec/changes/harden-publishing-idempotency/*`
- Create: `openspec/changes/harden-outbound-request-security/*`
- Create: `docs/audits/technical-backlog.md`
- Create: `CHANGELOG.md`

**Interfaces:**

- Consumes: diagnostic IDs and completed changes.
- Produces: validated future proposals and Keep a Changelog entry.

- [ ] **Step 1: Create two future changes**

  Run:

  ```bash
  bun run openspec new change harden-publishing-idempotency \
    --description "Prevent duplicate external thread publication under concurrent or recovered jobs"
  bun run openspec new change harden-outbound-request-security \
    --description "Harden media and webhook outbound requests against DNS rebinding and private address variants"
  ```

- [ ] **Step 2: Author complete planning artifacts**

  The first change must cover per-item fencing, crash recovery, provider
  idempotency support and concurrent PostgreSQL tests. The second must cover
  canonical IP parsing, all private/reserved CIDRs, DNS pinning, redirects,
  IPv4-mapped IPv6 and local test fixtures. Tasks remain unchecked because these
  changes are not implemented.

- [ ] **Step 3: Write backlog and changelog**

  Backlog maps every unresolved H/M/L item to owner area, evidence, impact,
  recommendation and OpenSpec change where available. Changelog follows Keep a
  Changelog with `Unreleased` sections Added, Changed, Fixed, Security and Known
  Issues, including preserved Postiz references and explicit “no intended
  breaking changes”.

- [ ] **Step 4: Validate and commit**

  Run:

  ```bash
  bun run spec:validate
  git add openspec/changes/harden-* docs/audits/technical-backlog.md CHANGELOG.md
  git commit -m "docs(changelog): record baseline and future risk backlog"
  ```

## Task 15: Archive the completed change and perform final validation

**Files:**

- Move via OpenSpec: `openspec/changes/establish-maintenance-baseline/` to archive
- Create/update via OpenSpec: `openspec/specs/*`
- Modify: documentation only if validation exposes inconsistencies

**Interfaces:**

- Consumes: all completed baseline artifacts.
- Produces: living specs and an archived implementation record.

- [ ] **Step 1: Mark baseline tasks complete**

  Change every baseline task checkbox only after its file/change and validation
  have actually completed.

- [ ] **Step 2: Run the full validation matrix**

  Run:

  ```bash
  bun install --frozen-lockfile
  bun run check:ci
  bun audit
  git diff --check origin/main...HEAD
  git grep -In -E 'postiz|Postiz|POSTIZ'
  git status --short
  ```

  Also rerun Semgrep on all 245 source files plus new TS files. Expected:
  application validations pass; every audit/Semgrep residual is documented; no
  whitespace errors, secrets, generated binary files or accidental artifacts.

- [ ] **Step 3: Archive with the official CLI**

  Run:
  `bun run spec:archive -- establish-maintenance-baseline -y`

  Expected: living specs synchronized and change moved under
  `openspec/changes/archive/`.

- [ ] **Step 4: Validate archive and commit**

  Run:

  ```bash
  bun run spec:validate
  git add openspec docs
  git commit -m "docs(openspec): archive completed maintenance baseline"
  ```

## Task 16: Pull request, protected merge and production verification

**Files:**

- No planned repository content changes.

**Interfaces:**

- Consumes: validated branch with 10–15 coherent commits.
- Produces: reviewed PR to `main`, approved merge commit and verified Railway
  deployment.

- [ ] **Step 1: Review history, authors and final diff**

  Run:

  ```bash
  git log --format='%h %an <%ae> %s' origin/main..HEAD
  git diff --stat origin/main...HEAD
  git diff origin/main...HEAD
  ```

  Expected: only configured author identity, no coauthors, scoped files only.

- [ ] **Step 2: Update from main without destructive commands**

  Run:

  ```bash
  git fetch origin main
  git rev-list --left-right --count HEAD...origin/main
  ```

  If behind, merge `origin/main`, resolve conflicts explicitly, and rerun the
  full matrix.

- [ ] **Step 3: Push and open the PR**

  Run:

  ```bash
  git push -u origin chore/maintenance-baseline-openspec
  gh pr create --base main --head chore/maintenance-baseline-openspec \
    --title "chore: establish Manypost maintenance baseline" \
    --body-file /tmp/manypost-pr-body.md
  ```

  The body must contain context, objectives, file map, identity strategy,
  OpenSpec setup, fixed/unfixed findings, risks, breaking changes, exact
  validation results, checklist and rollback.

- [ ] **Step 4: Wait for mandatory checks and inspect blockers**

  Run:

  ```bash
  gh pr checks <number> --watch
  gh pr view <number> --json baseRefName,mergeable,mergeStateStatus,reviews,comments,statusCheckRollup
  ```

  Expected: base `main`, all required checks pass, mergeable, no blocking review
  or unresolved conflict.

- [ ] **Step 5: Merge without bypass**

  Use the repository-supported merge method through `gh pr merge <number>`.
  Never pass an admin/bypass option.

- [ ] **Step 6: Verify Git and Railway**

  Fetch/switch/pull `main`, record resulting commit hash, then wait for the
  Railway `manypost-app` deployment sourced from that commit to reach `SUCCESS`.
  Confirm `/login` health and inspect error logs without exposing variables.

## Self-review

- Spec coverage: all ten user stages and all 18 mandatory deliverables map to
  Tasks 1–16.
- Placeholder scan: the plan contains no unfinished markers or unspecified
  implementation step.
- Type consistency: named helpers are introduced and consumed within their
  corresponding task; scripts defined in Tasks 2/9 are used only afterward.
- Scope: broad concurrency, SSRF, queue and storage work is separated into
  future OpenSpec changes rather than mixed into the baseline.
- Execution mode: inline execution is required in this session because
  subagent-driven execution is not enabled; checkpoints remain the commits and
  validation commands above.
