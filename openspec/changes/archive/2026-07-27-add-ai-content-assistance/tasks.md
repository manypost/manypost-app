## 1. Contracts and configuration

- [x] 1.1 Add `ai.provider_failed`, `ai.invalid_response` and
      `ai.capability_unavailable` to `packages/contracts/src/error-codes.ts`
- [x] 1.2 Map them in `apps/api/src/http/middleware/error.ts` (502, 502, 501)
- [x] 1.3 Add `aiCredits` to `PlanLimits` and set it per tier in `PLANS`
      (FREE 0, PRO 500, PREMIUM 2000 — commercial values, flagged in design D6)
- [x] 1.4 Failing test: `minimumTierFor('ai_caption')` is `PRO` and
      `minimumTierFor('ai_calendar')` is `PREMIUM` — locks the catalog wiring
- [x] 1.5 Add `AI_TIMEOUT_MS` and `AI_MAX_OUTPUT_TOKENS` to
      `packages/config/src/env.ts`
- [x] 1.6 Failing test: `aiConfigFromEnv` returns `null` when no provider is set
- [x] 1.7 Failing test: the boot fails naming the missing variable when a
      protocol is selected without a model and without a base URL; a protocol
      with base URL and model but **no** key boots fine (local runtime)
- [x] 1.8 Implement `aiConfigFromEnv` beside `mediaStorageConfigFromEnv` until
      1.6-1.7 pass
- [x] 1.9 Document the new variables in `.env.example`

## 2. Provider adapters (test-first)

- [x] 2.1 Add `packages/core/src/infra/ai/chat-completions.test.ts` with a fetch
      double, before the adapter exists
- [x] 2.2 Failing test: a text generation posts the system and user parts, the
      configured model and an output cap no larger than the configured maximum
- [x] 2.3 Failing test: usage is read back as input and output tokens
- [x] 2.4 Failing test: a credential rejection becomes `ai.provider_failed` and
      the raised error contains no key, endpoint or vendor name
- [x] 2.5 Failing test: a rate limit and a server failure become
      `ai.provider_failed` marked repeatable
- [x] 2.6 Failing test: a success whose body has no generation becomes
      `ai.invalid_response`
- [x] 2.7 Failing test: exceeding the timeout aborts the request
- [x] 2.8 Implement the chat-completions adapter until 2.2-2.7 pass
- [x] 2.9 Repeat 2.1-2.8 for the messages-protocol adapter in
      `messages.test.ts` / `messages.ts`
- [x] 2.10 Failing test: `describeImage` sends the image reference and its media
      type; an adapter without the capability is absent rather than throwing
- [x] 2.11 Add `describeImage?` to the `AiProvider` port and implement it in both
      adapters
- [x] 2.12 Failing test: `parseStructured` strips code fences, takes the
      outermost object, and reports failure instead of throwing on garbage
- [x] 2.13 Implement `packages/core/src/infra/ai/structured.ts` until 2.12 passes
- [x] 2.14 Implement `makeAiProvider(config)` selecting the adapter, returning
      `null` for no provider
- [x] 2.15 Name `packages/core/src/infra/ai` explicitly in
      `.dependency-cruiser.cjs` so the core-purity exception stays enumerated
- [x] 2.16 Run `bun run check:ai-providers` and confirm it still passes

## 3. Budget guard — schema and repository (test-first)

- [x] 3.1 Add `reserved` to `aiCredits` and the `aiGrants` table to
      `packages/db/src/schema/platform.ts`
- [x] 3.2 Generate migration `0006` with Drizzle Kit; inspect the SQL and the
      metadata; confirm it is additive only
- [x] 3.3 Run `bun run db:check`
- [x] 3.4 Add `packages/db/src/repositories/ai-credits.repo.test.ts` gated by
      `TEST_DATABASE_URL`, following the `publishing.repo` integration precedent
- [x] 3.5 Failing test: reserving against an empty period opens the bucket with
      the plan's allowance
- [x] 3.6 Failing test: reserving more than remains returns no grant
- [x] 3.7 Failing test: **ten concurrent reservations against an allowance of
      five grant exactly five**, and used plus reserved never exceeds granted
      (SPEC_AI §5.3)
- [x] 3.8 Failing test: committing a grant moves it out of reserved into used
      exactly once — a second commit changes nothing
- [x] 3.9 Failing test: releasing a grant returns the amount to the allowance
- [x] 3.10 Failing test: a reservation past its lease is reclaimed by the next
      reservation of the same organization, and a late commit on the reclaimed
      grant does not consume allowance again
- [x] 3.11 Failing test: reclaiming is scoped to the organization
- [x] 3.12 Implement the repository until 3.5-3.11 pass

## 4. Budget guard — use case (test-first)

- [x] 4.1 Failing test: an enforced plan with no allowance left refuses with
      `ai.budget_exceeded` carrying the renewal date, before any model call
- [x] 4.2 Failing test: a non-enforced (self-hosted) installation always grants
      and still records consumption
- [x] 4.3 Failing test: a plan whose allowance is zero refuses before reserving
- [x] 4.4 Failing test: the recorded grant carries the operation and the tokens,
      and carries no prompt, no output and no credential
- [x] 4.5 Implement `makeBudgetGuard` in
      `packages/core/src/application/use-cases/ai-budget.ts` until 4.1-4.4 pass

## 5. Prompts (test-first)

- [x] 5.1 Add `packages/core/src/application/prompts/*.test.ts` before the
      templates exist
- [x] 5.2 Failing test: each template is a pure function of its input and names
      no vendor and no model
- [x] 5.3 Failing test: user text is emitted inside an explicit delimiter and
      labeled as data, and a delimiter sequence inside the user text cannot close
      the block
- [x] 5.4 Failing test: the caption template states the channel's limit
- [x] 5.5 Snapshot tests for caption, rewrite, hashtags, alt text, draft and week
      plan
- [x] 5.6 Implement the templates until 5.2-5.5 pass

## 6. Generation use cases (test-first)

- [x] 6.1 Failing test: a locked feature refuses with `plan.feature_locked` and
      reserves nothing (gate precedes budget — design D10)
- [x] 6.2 Failing test: a channel of another organization is not found and
      consumes nothing
- [x] 6.3 Failing test: caption returns one result per channel
- [x] 6.4 Failing test: an over-long model answer is cut at a boundary, is within
      the channel limit, and is marked shortened
- [x] 6.5 Failing test: a channel whose settings raise the limit is validated
      against the raised limit, matching the scheduler's merge
- [x] 6.6 Failing test: a model failure releases the reservation
- [x] 6.7 Failing test: rewrite refuses empty text before any model call
- [x] 6.8 Failing test: alt text refuses a video and refuses another
      organization's media
- [x] 6.9 Failing test: alt text refuses with `ai.capability_unavailable` when
      the adapter cannot describe images, consuming nothing
- [x] 6.10 Failing test: the multichannel draft validates the returned structure,
      and an invalid structure releases the reservation and raises
      `ai.invalid_response`
- [x] 6.11 Failing test: the week plan returns slots inside the requested week
      and creates no publication, draft or job
- [x] 6.12 Failing test: a successful generation writes an audit entry that
      carries neither prompt nor output
- [x] 6.13 Implement `packages/core/src/application/use-cases/ai.ts` until
      6.1-6.12 pass

## 7. Posting time suggestions (test-first)

- [x] 7.1 Failing test: a channel with no history returns baseline slots with low
      confidence and a disclosed sample size of zero
- [x] 7.2 Failing test: a channel with history concentrated in a weekday and hour
      ranks that slot first with confidence above low
- [x] 7.3 Failing test: only the requesting organization's publications
      contribute
- [x] 7.4 Failing test: slots are expressed in the requested time zone, and an
      invalid identifier is refused
- [x] 7.5 Failing test: suggestions work with no AI provider configured and
      consume no allowance
- [x] 7.6 Add the delivered-publication aggregation to the publishing repository,
      organization-scoped
- [x] 7.7 Implement `makeSuggestBestTimes` until 7.1-7.5 pass

## 8. HTTP surface

- [x] 8.1 Wire the AI bundle in `apps/api/src/container.ts`, `null` when no
      provider is configured
- [x] 8.2 Add `apps/api/src/http/routes/ai.routes.ts` with full OpenAPI schemas —
      no generic stubs, matching the documented-API standard
- [x] 8.3 Failing route test: every AI route answers `capability.disabled` when
      no provider is configured
- [x] 8.4 Failing route test: an unauthenticated request is refused
- [x] 8.5 Add the per-organization burst limit, failing open without Redis
- [x] 8.6 Extend `GET /v1/capabilities` with the `ai` block (enabled, remaining,
      period end) and its OpenAPI schema
- [x] 8.7 Add the `generate_content` tool to `apps/api/src/mcp/mcp-server.ts`
- [x] 8.8 Regenerate the web client:
      `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api`, and
      review `apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts`
      together

## 9. Web surface

- [x] 9.1 Read `docs/brand/BRAND_SYSTEM.md` before writing any component
- [x] 9.2 Add the AI actions to the composer (adapt per network, rewrite,
      hashtags), hidden entirely when capabilities report AI off
- [x] 9.3 Add alt-text generation to the media picker
- [x] 9.4 Add the multichannel draft entry
- [x] 9.5 Add the best-time hint to the scheduling field, showing its confidence
- [x] 9.6 Show the remaining allowance and the upgrade path when the plan locks a
      capability or the allowance is exhausted
- [x] 9.7 Verify zero `box-shadow`, relief by gradient, `cursor: pointer` on
      every button, colors only through brand tokens
- [x] 9.8 `bun run build:web`

## 10. Documentation and closure

- [x] 10.1 Update `docs/specs/SPEC_AI.md`: what this change delivers stops being
      aspirational; state precisely what remains
- [x] 10.2 Record in `docs/principal/STATUS.md` what is delivered and that
      `ai_inbox`, `ai_triage`, `ai_campaign_reports` and `ai_engagement_alerts`
      are blocked on comment/DM ingestion and metrics collection
- [x] 10.3 Add an entry at the top of `docs/principal/CHANGELOG_ONDAS.md`
- [x] 10.4 Update `CHANGELOG.md`
- [x] 10.5 `bun run check`, `bun run db:check`, `bun run build:web`,
      `bun run spec:validate`
- [x] 10.6 Confirm no secret, key or endpoint value entered any document
- [x] 10.7 Mark every task above complete and open the PR with the repository
      template
