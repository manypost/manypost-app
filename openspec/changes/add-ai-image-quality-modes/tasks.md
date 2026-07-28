## 1. Test-first contract and core

- [x] 1.1 Run `bun install --frozen-lockfile`, then add focused failing tests in
  `packages/core/src/infra/ai/chat-completions.test.ts` proving economy maps to `low` and quality
  maps to `high`; run that file and record the expected RED result.
- [x] 1.2 Add focused failing tests in `packages/core/src/application/use-cases/ai-image.test.ts`
  proving omitted/economy requests cost 2 credits, quality costs 5, and audit detail contains mode
  and credits without prompt; run that file and record the expected RED result.
- [x] 1.3 Implement the closed `ImageQualityMode`, mode-specific credit map, deterministic economy
  default and adapter mapping; rerun both focused core test files to GREEN.

## 2. API, MCP and browser contract

- [x] 2.1 Extend `scripts/e2e-ai.ts` test-first for the closed mode enum, default economy request,
  quality request, provider qualities, mode-specific charges and unchanged idempotency behavior.
- [x] 2.2 Update `/v1/ai/image` and MCP `generate_image` to accept only `economy|quality`, pass the
  selected mode to core and describe the correct costs.
- [x] 2.3 Add failing web tests in `apps/web/src/features/ai/ai-actions.test.tsx` for the two-mode
  catalog, initial economy mode and mode-sensitive idempotency fingerprint; run the file RED.
- [x] 2.4 Implement the compact accessible mode selector, explanatory copy and dynamic cost in
  `generate-image-dialog.tsx`/`hooks.ts`; rerun the focused web test GREEN.

## 3. Generated contract and documentation

- [x] 3.1 Start the local API and run
  `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api`; review
  `apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts` together.
- [x] 3.2 Update `docs/specs/SPEC_AI.md`, architecture/operation documentation and `CHANGELOG.md`
  with the two modes, credit costs, compatibility and rollback.
- [x] 3.3 Run `bun run spec:validate` and `git diff --check`.

## 4. Verification and delivery

- [x] 4.1 Run `bun run check`, `bun run db:check`, `bun run build:web` and the relevant real-API
  E2E with isolated PostgreSQL/Redis where available; report only commands actually completed.
- [ ] 4.2 Perform a browser check of both selector states, keyboard focus, mobile width, dark/light
  contrast, submission body and loading/error/success cycles.
- [ ] 4.3 Archive `add-ai-image-quality-modes`, rerun `bun run spec:validate`, review the complete
  diff for secrets/generated artifacts and commit with Conventional Commits.
- [x] 4.4 Push `feat/ai-image-quality-modes`, open the second PR stacked on
  `feat/ai-fixes-home-and-image`, deploy that branch to the Coolify staging app and smoke-test
  without syncing environment secrets.

## 5. Plug-and-play image provider

- [x] 5.1 Add focused failing config tests for inherited image configuration, explicit independent
  configuration, explicit disablement and incomplete-configuration boot failures.
- [x] 5.2 Add focused failing core/container tests proving image generation depends on a dedicated
  provider port and that text/image adapters can use different endpoints and credentials.
- [x] 5.3 Implement `ImageGenerationProvider`, an image adapter factory and deterministic
  `imageConfigFromEnv` resolution without leaking text credentials into explicit image config.
- [x] 5.4 Update `.env.example`, AI/architecture documentation and `CHANGELOG.md` with precedence,
  compatibility, security and rollback guidance.
- [x] 5.5 Run focused tests, `bun run spec:validate`, `git diff --check`, `bun run check`,
  `bun run db:check` and `bun run build:web`.
- [ ] 5.6 Commit and push the PR #55 update, wait for CI, deploy the branch to Coolify staging
  without syncing environment secrets and smoke-test the configured URL.
