## Context

Manypost is a Bun workspace with three applications and six shared packages.
The API composition root connects Hono routes to domain use cases, Drizzle
repositories, social providers and a pg-boss/Redis runtime. The Next.js app
uses a generated OpenAPI client. Production currently runs worker, API and web
inside one Railway container.

The initial audit found that local tests pass, while repository governance,
architecture navigation and the product-name decision trail are incomplete.
It also confirmed small defects from production logs and static analysis. Larger
publication concurrency, SSRF, retry and storage risks require independent
designs so they are intentionally excluded.

Stakeholders are maintainers, new developers, AI agents, reviewers and Railway
operators. The design must not expose production secrets or erase fork
provenance.

## Goals / Non-Goals

**Goals:**

- make OpenSpec a local, pinned and validated repository workflow;
- create one canonical documentation entry point and scoped agent rules;
- trace product-identity decisions rather than performing blind replacement;
- align local, CI, Docker and OpenSpec validation;
- add focused tests around the confirmed runtime/security fixes;
- leave validated future proposals for high-risk work.

**Non-Goals:**

- no schema/migration or API contract change;
- no monorepo reorganization;
- no queue, thread-fencing or network-stack redesign;
- no changes to legal/historical attribution;
- no automatic dependency-wide update.

## Decisions

### OpenSpec is an exact local dev dependency

Use `@fission-ai/openspec@1.6.0` in the root workspace and invoke it through Bun
scripts. This makes CI and contributors use the same CLI without relying on a
global install.

Alternative considered: official global installation. It is convenient for an
individual machine but does not make the repository version reproducible.

### The current initiative is a real OpenSpec change

The adoption itself lives in `establish-maintenance-baseline`, produces three
capabilities and is archived only after implementation. Broader H-01/H-02 risks
become separate active proposals.

Alternative considered: leave a toy example. A synthetic example would not
prove that the workflow can govern a cross-cutting production change.

### Documentation is split by decision path

`docs/architecture/README.md` is the canonical entry point. Repository map,
flows, data/infrastructure and development operation are separate because they
change at different rates. Audits remain dated evidence rather than becoming
normative architecture.

Alternative considered: one large architecture file. It is harder to navigate
and encourages stale partial updates.

### Identity migration is allow-list based

Every tracked Postiz occurrence is assigned to one of six categories. Only
category 1 is edited. Legal, historical, compatibility and ambiguous
occurrences stay with a recorded reason.

Alternative considered: case-insensitive global replacement. It can corrupt
licenses, provenance, migrations, URLs and compatibility identifiers.

### Validation has one CI aggregate

`check:ci` composes the existing `check` with Drizzle, production web build and
strict OpenSpec validation. CI pins Bun and freezes the lockfile. Docker and
Railpack stop accepting a failed web build.

Alternative considered: retain duplicated workflow steps. That already drifted
from the more complete root `check`.

### Runtime fixes remain at existing seams

- Bun server options own SSE idle timeout.
- A pure web predicate owns OAuth event trust.
- A pure session-result helper gates EventSource construction.
- The crypto adapter makes the existing 16-byte GCM format explicit.

No new framework is added. Each behavior gets a focused `bun:test` regression
before implementation.

### Dependency remediation is minimal

Update only direct packages whose installed ranges are reported affected and
whose patched versions pass the full matrix. Do not force major transitive
overrides; document any residual chain.

## Risks / Trade-offs

- [Documentation can drift] → root/scoped AGENTS require synchronized docs and
  PR checklist evidence.
- [Strict build increases failed deployments] → failures occur before release,
  which is the intended safer failure point.
- [Local OpenSpec adds transitive packages] → exact pin, lockfile and audit make
  the cost visible.
- [Session redirect can interrupt a page] → it occurs only after the authenticated
  `/auth/me` check remains unsuccessful after the existing refresh attempt.
- [Thirty-second global Bun idle timeout affects all routes] → it only expands
  the maximum idle window and remains bounded; the SSE ping is 25 seconds.
- [Residual advisories remain] → record dependency chain and do not claim a
  clean audit unless the command actually returns clean.
- [Historical Postiz wording remains searchable] → the inventory is the source
  of truth for why each group remains.

## Migration Plan

1. Add local OpenSpec and validate the active change.
2. Add agent rules and canonical documentation without runtime changes.
3. Classify identity and apply the safe subset.
4. Strengthen CI/container validation.
5. Add failing regressions and minimal runtime fixes.
6. Apply minimal dependency remediation and rerun clean install/check/build.
7. Add future proposals, changelog and final audit.
8. Archive this completed change, push, review, merge and verify Railway.

Rollback uses normal Git reverts in reverse order. There is no database
rollback because no schema changes are made. Railway can redeploy the previous
successful Git revision if a runtime regression appears.

## Security and observability

No secret values enter artifacts. Authentication, tenant scope and external
identifiers remain compatible. New tests cover message origin/source and GCM
tag length. Production verification checks deployment state, `/login` health
and error logs without reading variable values.

## Open Questions

- Which owner and delivery milestone will be assigned to the publication
  idempotency and outbound-request proposals?
- Should a future deployment split the worker and API into independent Railway
  services?
- Which object-storage and backup policy should replace the single local upload
  volume before horizontal scale?
