## 1. Port and contracts

- [x] 1.1 Redesign `generateImage` in `ports/ai-provider.ts`: closed `ImageAspect` set, returns
      bytes + mime + dimensions + optional `revisedPrompt`, accepts `AbortSignal`
- [x] 1.2 Add `ai_image` to `PlanFeature` and to the Premium bundle in `contracts/src/billing.ts`
- [x] 1.3 Failing test: `minimumTierFor('ai_image')` is `PREMIUM`
- [x] 1.4 `AI_IMAGE_MODEL` (optional) in `packages/config/src/env.ts`, defaulting to `AI_MODEL`

## 2. Provenance (migration + repo)

- [x] 2.1 Add `source`, `generationPrompt`, `generationModel` to the `media` schema
- [x] 2.2 Generate migration `0007` with the Drizzle CLI — never hand-write it
- [x] 2.3 Extend `MediaRecord` and `MediaRepository.create` to carry provenance
- [x] 2.4 `GET /v1/media` exposes `source` so the library can mark generated assets

## 3. Adapter (test-first)

- [x] 3.1 Failing test in `infra/ai/chat-completions.test.ts`: a ratio becomes the vendor's
      resolution, and the response's base64 payload becomes bytes
- [x] 3.2 Failing test: an adapter without image support does not expose the method
- [x] 3.3 Implement `generateImage` in the images dialect; the messages dialect omits it
- [x] 3.4 `canGenerateImages` on the selected provider, beside `canDescribeImages`

## 4. Use case (test-first)

- [x] 4.1 Failing test: plan gate before reservation; unsupported ratio refused before the provider
- [x] 4.2 Failing test: bytes that are not an image fail and **return** the allowance
- [x] 4.3 Failing test: the media record carries `source: 'ai'`, the prompt and the model
- [x] 4.4 Failing test: the audit entry carries neither prompt nor bytes
- [x] 4.5 Implement `makeGenerateImage`, reusing `sniffMedia` and the storage/repository path that
      uploads already use — the ceiling and the magic-byte check come for free

## 5. Surfaces

- [x] 5.1 `POST /v1/ai/image` with `Idempotency-Key` support, documented in OpenAPI
- [x] 5.2 `ai.canGenerateImages` in `/v1/capabilities`
- [x] 5.3 MCP tool `generate_image` under the **write** scope
- [x] 5.4 Regenerate the OpenAPI snapshot and confirm the diff is additive

## 6. Interface

- [x] 6.1 `features/ai/generate-image-dialog.tsx`: prompt, aspect chips, preview and the declared
      cost. The **alt-text offer inside the dialog was left out**: the library's existing
      "Descrever com IA" already covers the generated image, and adding a second alt-text entry
      point here would have duplicated the flow for no gain
- [x] 6.2 Media library: the action plus an "IA" badge on generated assets
- [x] 6.3 Composer media picker: same action with the aspect preselected from the chosen channels
- [x] 6.4 Strings in `messages/pt-BR.json`; hidden entirely when the installation cannot generate

## 7. Verification

- [x] 7.1 `bun run check`, `bun run build:web`, `bun run db:check`, `bun run spec:validate`
- [x] 7.2 Extend `scripts/e2e-ai.ts`: an image is generated against the fake provider, lands in the
      library with provenance, costs 5 credits, and a replayed idempotency key charges once
- [ ] 7.3 **Not verified locally: no Redis.** Idempotency is stored in Redis and fails **open**
      without it — by design, matching the rest of the platform — so a local run regenerates
      instead of replaying. The E2E detects the absence and says so rather than pretending to have
      proved it; CI has Redis and runs the full assertion. The byte-validation rule was
      mutation-checked instead (removing the sniff makes the HTML-as-image test fail).
