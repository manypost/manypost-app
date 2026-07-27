## Why

The pricing page sells eight AI capabilities — two in Pro (`ai_caption`,
`ai_best_time`) and six in Premium — and the plan catalog already gates all
eight in `packages/contracts/src/billing.ts`. None of them exist at runtime.
What exists is scaffolding: the `AiProvider`/`BudgetGuard` interfaces in
`packages/core/src/application/ports/ai-provider.ts`, an `ai_credits` table no
code writes to, four `AI_*` environment variables nothing reads, the
`ai.budget_exceeded` error code and the `check:ai-providers` CI guard. An
organization that pays for Pro today receives a plan feature that resolves to
nothing.

Four of the eight promises are not blocked by AI at all — they are blocked by
ingestion the product does not have yet. `ai_inbox` and `ai_triage` need comment
and DM ingestion, which no provider implements; `ai_campaign_reports` and
`ai_engagement_alerts` need the metrics collection that would fill
`channel_metrics`, which is empty because nothing writes to it. This change
delivers everything the current data and provider surface can honestly support
and states the remaining four as dependency-blocked rather than pretending.

## Goals

- Make AI a real runtime capability with no vendor name outside `infra/ai`, so
  a self-hoster can point `AI_BASE_URL` at a local model and a managed
  deployment can point it at a hosted gateway, with no code change.
- Make the BudgetGuard the only path to a model call, with a transactional
  reservation that cannot be oversold under concurrency (SPEC_AI §5.3).
- Ship the four capabilities the product can support today: `ai_caption`,
  `ai_multichannel_draft`, `ai_calendar` and `ai_best_time`.
- Degrade to nothing, visibly and gracefully, when `AI_PROVIDER=none`.

## Non-goals

- Comment/DM ingestion, and therefore `ai_inbox` and `ai_triage`.
- Metrics collection into `channel_metrics`, and therefore
  `ai_campaign_reports` and `ai_engagement_alerts`.
- Streaming responses. Every generation in this change is short and returns
  whole; a streaming transport can be added later without changing the port.
- Autonomous publishing. Every AI output in this change is a **proposal a human
  accepts**; nothing this change adds can put content on a network by itself.
- Image generation (`ai.image` in SPEC_AI §3). It needs a media-library write
  path from a generated asset and a separate cost class; the port keeps its
  optional `generateImage` slot unimplemented.

## What Changes

**Provider runtime**

- Add `packages/core/src/infra/ai/` with two adapters behind the existing
  `AiProvider` port, selected by `AI_PROVIDER`: one speaking the widely
  implemented chat-completions protocol (covering local runtimes and gateways)
  and one speaking the messages protocol. `none` resolves to no adapter.
- Extend the `AiProvider` port with an optional `describeImage` for alt text,
  since describing an image is not something `generateText` can express.
- Add `AI_TIMEOUT_MS` and `AI_MAX_OUTPUT_TOKENS` so a slow or runaway model
  cannot hold an HTTP request open or bill without bound.
- Add stable error codes `ai.provider_failed`, `ai.invalid_response` and
  `ai.capability_unavailable`; reuse the existing `capability.disabled` for
  "this installation has no AI configured".

**Budget control**

- Implement `BudgetGuard` over `ai_credits` as reserve → commit/release, where
  `reserve` is one conditional statement that cannot grant more than the
  remaining allowance, and a reservation that is never resolved expires on a
  lease and is reclaimed lazily.
- Add `ai_credits.reserved` and a new `ai_grants` table recording every
  reservation, its outcome and the tokens actually consumed.
- Add `aiCredits` to `PlanLimits` in the plan catalog, so the monthly allowance
  is single-sourced with the rest of the commercial truth.
- Self-hosted installations reserve and record but never refuse: the mechanism
  is always present, only the numbers are enforced on the managed service
  (DECISIONS v1 §8).

**Content generation**

- Add pure, snapshot-tested prompt templates in
  `packages/core/src/application/prompts/`.
- Add use cases: caption adapted per network, rewrite with an instruction,
  hashtags, alt text from a media item, multichannel draft from one idea, and a
  week plan. Each asserts its plan feature **before** reserving budget.
- Guarantee the per-channel `maxLength` deterministically rather than trusting
  the model to obey, using the same merged-settings semantics the scheduler
  uses.

**Posting time suggestions**

- Add `ai_best_time` as a statistical heuristic over the organization's own
  publication history plus a per-network baseline, with an explicit confidence
  level. No model call, no credit cost (SPEC_AI §3).

**Surfaces**

- Add `POST /v1/ai/*` and `GET /v1/ai/best-times`, documented in OpenAPI 3.1
  like every other registered route, with a per-organization burst limit.
- Extend `GET /v1/capabilities` with an `ai` block (enabled, remaining
  allowance, period end) so the web app can hide what does not exist.
- Add a `generate_content` MCP tool (SPEC_API_MCP).
- Add the AI actions to the composer, alt text to the media picker, the
  multichannel draft entry, and the best-time hint on the schedule field.

No breaking change. An installation that sets nothing new keeps `AI_PROVIDER`
at its `none` default and behaves exactly as it does today, except that
`/v1/capabilities` now reports `ai.enabled: false`.

## Capabilities

### New Capabilities

- `ai-provider-runtime`: how a model provider is selected, addressed, bounded in
  time and cost per call, and how its failures are classified; how the
  installation advertises the absence of AI.
- `ai-budget-control`: the reservation lifecycle over the organization's
  allowance, its behavior under concurrency and crash, and the difference
  between self-hosted recording and managed enforcement.
- `ai-content-generation`: the generation use cases, their plan gating, their
  output guarantees (channel length, structured shape) and the posture toward
  untrusted text inside a prompt.
- `posting-time-suggestions`: the non-model heuristic behind `ai_best_time`,
  its inputs, and how it reports low confidence instead of inventing certainty.

### Modified Capabilities

None. No living capability in `openspec/specs/` currently defines AI behavior,
plan capability reporting or the composer's action surface.

## Impact

- `packages/core/src/application/ports/ai-provider.ts` — `describeImage`,
  budget grant shape
- `packages/core/src/infra/ai/` — **new**: adapter selection, two protocol
  adapters, timeout and failure classification, defensive structured parsing
- `packages/core/src/application/prompts/` — **new**: pure templates
- `packages/core/src/application/use-cases/ai.ts` — **new**: generation use
  cases and the best-time heuristic
- `packages/core/src/application/use-cases/ai-budget.ts` — **new**: BudgetGuard
- `packages/contracts/src/billing.ts` — `PlanLimits.aiCredits`
- `packages/contracts/src/error-codes.ts` — three AI codes
- `packages/config/src/env.ts` — `AI_TIMEOUT_MS`, `AI_MAX_OUTPUT_TOKENS`,
  `aiConfigFromEnv`
- `packages/db` — migration `0006`, `ai_grants` schema, credits repository
- `apps/api` — `ai.routes.ts`, capabilities block, error status mapping, MCP
  tool, container wiring
- `apps/web` — composer AI panel, alt-text action, draft entry, best-time hint,
  regenerated OpenAPI client
- `docs/specs/SPEC_AI.md`, `docs/principal/STATUS.md`,
  `docs/principal/CHANGELOG_ONDAS.md`, `CHANGELOG.md`, `.env.example`

**Data impact**: one additive migration. `ai_credits` gains a `reserved` column
defaulting to zero, so existing rows (there are none in practice) stay valid.
`ai_grants` is new. No column is dropped or retyped, and an older application
process reading `ai_credits` is unaffected by the new column. Rollback is
`DROP TABLE ai_grants` plus dropping the column; no data the product depends on
is lost, because credits are re-derivable from the plan and the period.

**Security impact**: `AI_API_KEY` is read from the environment only — never
logged, never persisted, never returned by any route, and never written to a
jsonb column. `AI_BASE_URL` is operator-supplied configuration and is
deliberately **not** subjected to the outbound SSRF classification that guards
user-supplied URLs, because a self-hosted install legitimately points it at a
private address; this is stated as a decision rather than an oversight. User
text reaching a prompt is untrusted input: it is delimited and marked as data,
and no model output is ever executed, used as a URL, or published without a
human accepting it. Every use case is organization-scoped through the
principal, and the credit bucket is keyed by organization.

**Product identity**: unchanged. No Postiz occurrence is renamed by this change.
The AGPL derivation note stays on the plan catalog, which keeps its existing
`Derived from Postiz` marker; the credits direction follows Postiz's, and the
new files that follow it carry the marker.

**Railway impact**: none required. The managed deployment gains optional
variables; with `AI_PROVIDER` unset the deployed behavior is identical to today.
Turning AI on in the managed service is an environment change, not a redeploy of
different code.

## Compatibility

- `AI_PROVIDER` keeps its `none` default, so no existing installation changes
  behavior on upgrade.
- `GET /v1/capabilities` gains a field; the OpenAPI client regenerates and no
  existing field changes type.
- `PlanLimits` gains a required field. This is a compile-time change inside the
  monorepo only — `PlanLimits` is not part of any serialized contract a third
  party stores, and the capabilities route already serializes limits field by
  field, so the wire shape stays under our control.

## Rollback

Revert the change and run the down direction of migration `0006`
(`ALTER TABLE ai_credits DROP COLUMN reserved`, `DROP TABLE ai_grants`). No
publication, channel, media or billing record is touched by this change, so a
rollback cannot lose scheduled work. If AI must be disabled without a deploy,
setting `AI_PROVIDER=none` turns every route into `capability.disabled` and the
web app hides the surface on the next capabilities fetch.
