# AI Image Quality Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `openspec-apply-change` to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit economical and final-quality image-generation modes using `gpt-image-2`.

**Architecture:** A closed product enum crosses the web/API/core boundary. Core owns defaulting and
credit cost; the OpenAI-compatible adapter alone maps product mode to provider quality. The existing
dialog gains one accessible segmented field and sends the mode as part of the idempotent body.

**Tech Stack:** Bun, strict TypeScript, Hono/Zod OpenAPI, React 19, Next.js 16, TanStack Query,
next-intl and Tailwind 4.

## Global Constraints

- Use only `gpt-image-2`; no second model, provider fallback or client-selected model name.
- `economy` maps to `low` and costs 2 credits; `quality` maps to `high` and costs 5 credits.
- Omitted mode means `economy`.
- Preserve plan gating, organization scope, byte validation, provenance and idempotency.
- Do not read, print, document or version secret values.
- Do not edit generated OpenAPI files manually.
- Preserve the existing dialog layout, brand tokens and contrast.

---

### Task 1: Core mode and metering

**Files:**
- Modify: `packages/core/src/application/ports/ai-provider.ts`
- Modify: `packages/core/src/application/use-cases/ai-image.ts`
- Modify: `packages/core/src/application/use-cases/ai-image.test.ts`
- Modify: `packages/core/src/infra/ai/chat-completions.ts`
- Modify: `packages/core/src/infra/ai/chat-completions.test.ts`

**Interfaces:**
- Produces: `ImageQualityMode = 'economy' | 'quality'`
- Produces: `IMAGE_MODE_CREDITS: Record<ImageQualityMode, number>`
- Consumes: `AiProvider.generateImage({ mode })`

- [ ] Write adapter tests that invoke both modes and assert request bodies contain respectively
  `quality: 'low'` and `quality: 'high'`.
- [ ] Run `bun test packages/core/src/infra/ai/chat-completions.test.ts`; expect failures because
  `mode` is absent and the old adapter maps `standard` incorrectly.
- [ ] Write use-case tests whose budget spy captures reserved/committed credits and whose provider
  spy captures mode. Assert omitted/economy is `{ mode: 'economy', credits: 2 }` and quality is
  `{ mode: 'quality', credits: 5 }`.
- [ ] Run `bun test packages/core/src/application/use-cases/ai-image.test.ts`; expect failures on
  the old fixed five-credit behavior.
- [ ] Add:

```ts
export const IMAGE_QUALITY_MODES = ['economy', 'quality'] as const;
export type ImageQualityMode = (typeof IMAGE_QUALITY_MODES)[number];
```

- [ ] In `makeGenerateImage`, resolve `const mode = input.mode ?? 'economy'`, derive credits from
  the closed map, pass mode to the provider and record `{ aspect, mode, credits }` in audit detail.
- [ ] In the adapter, emit `quality: mode === 'economy' ? 'low' : 'high'`.
- [ ] Rerun both focused files; expect all tests GREEN.

### Task 2: API and MCP contract

**Files:**
- Modify: `apps/api/src/http/routes/ai.routes.ts`
- Modify: `apps/api/src/mcp/mcp-server.ts`
- Modify: `scripts/e2e-ai.ts`

**Interfaces:**
- Consumes: request `mode?: 'economy' | 'quality'`
- Produces: validated core input with identical mode

- [ ] Extend `scripts/e2e-ai.ts` to make an omitted-mode request and assert provider `low` plus a
  two-credit delta; make a quality request and assert provider `high` plus a five-credit delta.
- [ ] Add a request with an unsupported mode and assert HTTP 400 before provider invocation.
- [ ] Update `ImageBody` to `mode: z.enum(IMAGE_QUALITY_MODES).optional()` and pass it to core.
- [ ] Update route description to state deterministic economy default and both costs.
- [ ] Add the same optional enum to MCP, update its description and forward it.
- [ ] Keep idempotency middleware and body hashing unchanged; the new body field naturally
  participates in server conflict detection.

### Task 3: Browser selector and retry identity

**Files:**
- Modify: `apps/web/src/features/ai/hooks.ts`
- Modify: `apps/web/src/features/ai/generate-image-dialog.tsx`
- Modify: `apps/web/src/features/ai/ai-actions.test.tsx`
- Modify: `apps/web/src/messages/pt-BR.json`

**Interfaces:**
- Produces: `IMAGE_MODE_OPTIONS` with `id`, label key, description key and credits
- Consumes: `GenerateImageInput.mode`

- [ ] Add tests asserting the catalog contains exactly economy/2 and quality/5, every message key
  resolves, and changing only mode changes the idempotency key.
- [ ] Run `bun test apps/web/src/features/ai/ai-actions.test.tsx`; expect RED because the catalog
  and mode fingerprint do not exist.
- [ ] Add `mode` to `GenerateImageInput` and `imageRequestFingerprint`.
- [ ] Add a `mode` state defaulted to `economy`; render two native button segments with
  `aria-pressed`, visible focus and current brand utilities.
- [ ] Send `mode` on submit and render the selected option's credit count.
- [ ] Add concise Portuguese labels/descriptions: economy for quick iterations, quality for the
  final asset.
- [ ] Rerun the focused web test; expect GREEN.

### Task 4: Contract generation and documentation

**Files:**
- Generate: `apps/web/openapi.json`
- Generate: `apps/web/src/lib/api/schema.d.ts`
- Modify: `docs/specs/SPEC_AI.md`
- Modify: `docs/architecture/flows.md`
- Modify: `docs/architecture/data-and-infrastructure.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: generated web client accepting `mode?: 'economy' | 'quality'`

- [ ] Start API at `http://localhost:3100`.
- [ ] Run `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api`.
- [ ] Verify the two generated files expose the same enum and no route disappeared.
- [ ] Document mode mapping, 2/5 credit costs, unchanged `AI_IMAGE_MODEL` and rollback.
- [ ] Run `bun run spec:validate` and `git diff --check`; expect success.

### Task 5: Full validation and second PR

**Files:**
- Modify: `openspec/changes/add-ai-image-quality-modes/tasks.md`
- Archive via CLI: `openspec/changes/archive/<date>-add-ai-image-quality-modes/**`

**Interfaces:**
- Produces: a reviewable stacked PR and staging deployment

- [ ] Run `bun run check`, `bun run db:check` and `bun run build:web`; expect exit code 0.
- [ ] Run the AI E2E against isolated local services when available; capture exact pass/skip
  evidence.
- [ ] Verify the dialog in browser at desktop/mobile widths, keyboard navigation, light/dark
  contrast and loading/error/success states.
- [ ] Mark OpenSpec tasks only after evidence exists, run
  `bun run spec:archive -- add-ai-image-quality-modes -y`, then rerun `bun run spec:validate`.
- [ ] Run `git diff --check`, `git status --short` and a secret-safe diff review.
- [ ] Commit with Conventional Commits, push the branch and open PR 2 with base
  `feat/ai-fixes-home-and-image`, including rollback/Railway statements.
- [ ] Deploy the branch using the ignored local Coolify script with no environment sync; verify
  deployment status and smoke-test `/login`.
