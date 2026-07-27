## Context

The AI slice is scaffolding only: two interfaces in
`packages/core/src/application/ports/ai-provider.ts`, an unused `ai_credits`
table, four unread `AI_*` variables, one error code and a CI grep. The
commercial surface is already ahead of the runtime — all eight `ai_*` features
are in the plan catalog and `PlanGate {kind:'feature'}` already enforces them,
so gating is solved and only the capability behind the gate is missing.

Three constraints shape every decision below.

1. **Provider agnosticism is enforced by CI.** `scripts/check-ai-providers.ts`
   fails the build on a vendor name in any `.ts` outside
   `packages/core/src/infra/ai` or `apps/api/src/infra/ai`. The allowed paths
   were declared before any code existed, so the intended home is already
   chosen.
2. **`packages/core` is not pure.** `AGENTS.md` records `src/infra/` (crypto,
   media, net, storage) as a bounded exception that must not be widened without
   an OpenSpec design. This document is that design for `src/infra/ai`.
3. **Every external call in this repository has an established shape.** Timeout,
   error classification into transient/permanent, fail-closed configuration and
   organization scoping are not new problems here; the AI adapters should look
   like the provider adapters, not like a new subsystem.

## Goals / Non-Goals

**Goals:**

- One place where a vendor is named, reachable by both composition roots.
- A budget mechanism that is impossible to bypass and impossible to oversell.
- Deterministic guarantees where the model cannot be trusted to provide them
  (channel length, structured shape).
- A visible, honest "off" state.

**Non-Goals:**

- Streaming, image generation, autonomous publishing, comment/DM ingestion and
  metrics collection, as stated in the proposal.
- A model router or per-request model selection. One configured model per
  installation; downgrade-on-budget is explicitly opt-in and out of scope here
  (SPEC_AI §4 forbids silent degradation).

## Decisions

### D1. Adapters live in `packages/core/src/infra/ai`, not in `apps/api`

The CI guard whitelists both, so either would pass. Core wins because the port
lives in core and because AI is not an HTTP concern: the week planner and the
future engagement-alert job belong to the worker, which cannot import from
`apps/api`. Placing the adapter in the API would force a second implementation
the day anything scheduled needs a model — the exact failure the repository
already recorded for `providerSecretsFromEnv`, where the dedicated worker
silently lacked provider secrets until it was single-sourced into
`@manypost/config`.

*Alternative considered:* a new `packages/ai` workspace. Rejected as ceremony:
it would need its own build wiring and dependency-cruiser rules to hold two
adapter files, and the boundary it would create already exists as the port.

### D2. Two protocol adapters, selected by one mapping in config

`aiConfigFromEnv(env)` in `@manypost/config` resolves `{protocol, baseUrl,
apiKey, model, timeoutMs, maxOutputTokens}`, following the
`mediaStorageConfigFromEnv` and `providerSecretsFromEnv` precedents, and both
composition roots consume it. `AI_PROVIDER=none` resolves to `null` and the
container exposes `ai: null`; routes then answer `capability.disabled`, which
already maps to 404. Boot fails closed on a selected protocol missing its base
URL or model, following the `STORAGE_PROVIDER=s3` refinement.

`AI_API_KEY` is deliberately **optional**: a local model runtime commonly needs
no credential, and requiring one would force every self-hoster to invent a dummy
value. The adapter omits the authorization header when no key is configured.

The two adapters cover the field: the chat-completions protocol is what local
runtimes and aggregating gateways speak, and the messages protocol is the other
one in wide use. Adding a third is a file, not a refactor.

*Alternative considered:* a single adapter plus a translation gateway
requirement. Rejected because it pushes an operational dependency onto every
self-hoster to save one file.

### D3. `AI_BASE_URL` is deliberately exempt from the SSRF classifier

`infra/net/outbound-http.ts` exists to stop *user-supplied* URLs from reaching
private addresses. `AI_BASE_URL` is operator configuration, and the most common
self-hosted setup points it at a private address (a model runtime on the same
host or network). Running it through the classifier would break the primary
self-hosting story to defend against an attacker who already controls the
environment file. The exemption is recorded here so a future security review
reads it as a decision, not a gap; the boundary is that no user-controlled value
ever contributes to the AI base URL.

### D4. Reserve/commit/release over a `reserved` column plus a grant record

`reserve` is one conditional `UPDATE` on the period's `ai_credits` row:

```
SET reserved = reserved + :n
WHERE id = :bucket AND granted - used - reserved >= :n
```

The row lock Postgres takes on the update serializes concurrent reservations, so
the acceptance criterion in SPEC_AI §5.3 — ten simultaneous generations must not
exceed the allowance — holds by construction rather than by retry. A zero-row
result is `ai.budget_exceeded`.

The column alone is not enough: a process that dies between the model call and
`commit` would leak reserved credits with no record of what leaked. So each
reservation also writes an `ai_grants` row carrying its operation, estimate,
state, lease expiry and — after commit — the tokens actually consumed. That row
makes `commit` idempotent (it is a conditional transition out of `RESERVED`,
exactly like the publication state machine), makes leaked reservations
reclaimable, and gives the operator a per-operation cost history that
`ai_credits` counters alone cannot provide.

*Alternative considered:* debit `used` immediately and refund on failure.
Rejected because a crash then leaves the organization *charged* for work it
never received, which is the worse direction to fail in.

### D5. Expired reservations are reclaimed lazily, not by a cron

Before reserving, the repository sweeps that organization's `RESERVED` grants
past their lease into `RELEASED` and subtracts them from `reserved`, in the same
transaction. This follows the approval-link expiry precedent (STATUS §3.12,
"expiração é lazy — checada no acesso; sem cron") and avoids adding a scheduled
job for an event that only matters to the organization about to reserve. The
lease is short (twice the request timeout), because unlike a publication lease
nothing external is in flight that a second worker could duplicate.

### D6. The allowance lives in the plan catalog

`PlanLimits` gains `aiCredits`, next to `channels` and `postsPerMonth`. The plan
catalog is already the single source of commercial truth and the file says so:
a paid feature that does not enter it ships free on the managed service.
Self-hosted resolves through `makeSelfHostedPlanPolicy`, which reports the
PREMIUM plan with `enforced: false`; the guard reads that flag and records usage
without ever refusing.

Proposed numbers — **these are commercial values, not engineering ones, and the
owner should confirm them**: FREE 0, PRO 500, PREMIUM 2000 credits per month,
where one text generation is one credit. At roughly 1.5k tokens per generation,
PRO's allowance is well under a real cent-level fraction of the R$ 23,90 price
at commodity token rates, so the risk in these numbers is that they are
generous, not that they are unprofitable.

### D7. Channel length is enforced after the model, not requested from it

SPEC_AI §5.5 requires the caption prompt to respect the channel's `maxLength` in
100% of test cases. A prompt cannot deliver 100% of anything. The use case
therefore asks for the limit *and* enforces it: output longer than the limit is
cut at the last sentence or word boundary that fits and returned with an
explicit `truncated` flag, so the UI can tell the user what happened. The limit
itself comes from `provider.capabilities.maxLength(mergedSettings)` using the
same channel-settings merge the scheduler uses (STATUS §3.4 and §3.21), so a
verified X account gets 4000 characters here exactly as it does at schedule time.

### D8. Structured output is parsed defensively and validated, and a failure
refunds

Multichannel draft and week plan need JSON. The adapter strips code fences and
takes the outermost object before parsing, then the use case validates with Zod.
An unparseable or invalid response raises `ai.invalid_response` and **releases**
the reservation rather than committing it: the tokens were spent upstream, but
charging an organization for our failure to get a usable answer is the wrong
trade. There is no automatic re-ask — a retry doubles cost for a failure mode
that is usually a misconfigured model, and the client can retry deliberately.

### D9. Best times is a heuristic, and says so

`ai_best_time` performs no model call and costs no credit. It aggregates the
organization's own delivered publications per channel into weekday/hour buckets,
blends them with a per-network baseline, and returns slots with a confidence of
`low`, `medium` or `high` derived from the sample size. With `channel_metrics`
empty there is no engagement signal, only "when this organization has published
successfully", so the honest output at low sample size is the baseline plus an
explicit low-confidence marker. When metrics collection lands, the same use case
gains a better input without changing its contract.

### D10. Plan gate precedes budget reservation

Order in every use case: `plan.assert(feature)` → `budget.reserve` → model call
→ `commit` or `release` → audit. A locked feature must never consume an
allowance, and a budget-exceeded answer must never leak the existence of a
feature the plan does not include.

### D11. A burst limit sits in front of the AI routes

The monthly allowance bounds cost but not rate: a loop could exhaust a month's
credits in seconds and saturate the upstream. The routes take a Redis window per
organization, reusing the limiter pattern the public approval surface uses,
including its fail-open behavior when Redis is absent — consistent with
SPEC_QUEUE §6 rather than inventing a second policy.

## Risks / Trade-offs

- **A model returns text that overflows a channel limit** → D7 truncates
  deterministically and flags it; the limit is never violated at the API
  boundary, and the scheduler's own validation remains the second line.
- **Prompt injection through user text (a brief, a post body, a media alt)** →
  user content is delimited and labeled as data in the template, and, more
  importantly, nothing downstream trusts the output: it is never executed, never
  used as a URL, never auto-published. The blast radius of a successful
  injection is a bad caption a human declines.
- **A leaked reservation permanently reduces an allowance** → D5 reclaims on the
  next reservation; worst case is one organization briefly under-counted until
  its next AI action, never a permanent loss.
- **The upstream is slow and holds HTTP requests open** → `AI_TIMEOUT_MS` aborts
  the call, and the reservation is released on the abort path.
- **Credit numbers are wrong commercially** → D6 puts them in one catalog
  constant; changing them is a one-line change with no migration.
- **`packages/core` accumulates more infrastructure** → accepted and bounded
  here (D1); the dependency-cruiser rule is updated to name `infra/ai`
  explicitly rather than loosening the rule.

## Migration Plan

1. Migration `0006` adds `ai_credits.reserved integer not null default 0` and
   creates `ai_grants`. Both are additive; the running application ignores them
   until the new code deploys.
2. Deploy with `AI_PROVIDER` unset. Behavior is identical to today except
   `/v1/capabilities` reporting `ai.enabled: false`; the web app hides the AI
   surface on the first fetch.
3. Turn AI on per environment by setting `AI_PROVIDER`, `AI_BASE_URL`,
   `AI_API_KEY` and `AI_MODEL`. No redeploy of different code.

**Rollback:** revert the application and drop the added table and column. No
publication, channel, media or subscription row is written by this change, so
rollback cannot lose scheduled work or billing state. To disable AI without a
deploy, set `AI_PROVIDER=none`.

## Open Questions

1. **Credit allowances per plan (D6).** 500/2000 are engineering-safe defaults;
   the owner should confirm them as commercial numbers before the managed
   service turns AI on.
2. **Whether a rewrite of an existing caption should cost the same credit as a
   fresh generation.** Treated as one credit each in this change for
   predictability; a weighted cost table is a later refinement of the same
   `estimatedCredits` argument.
3. **Whether the week plan should be able to write drafts directly** once
   accepted, rather than pre-filling the composer. Out of scope here because
   bulk draft creation interacts with the Free plan's monthly post limit in ways
   that deserve their own decision.
