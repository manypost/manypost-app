## Why

`SPEC_AI §3` lists `ai.image` — "prompt + tamanho → media na biblioteca", 5 credits — and it is the
one item of the creation family that shipped as nothing. The port kept a `generateImage` slot with
no implementation, and the landing does not sell it, so it degraded quietly rather than lying. But
a scheduling product whose AI can write the caption and not produce the picture stops one step
short of the job: the picture is the part people actually lack.

The slot that exists must be redesigned before it is used, and for two reasons that are not
cosmetic:

```ts
// hoje: packages/core/src/application/ports/ai-provider.ts
generateImage?(req: { prompt: string; size: '1024x1024' | '1792x1024' | '1024x1792' })
  : Promise<{ url: string }>;
```

1. **That size union is one vendor's catalogue, sitting in the agnostic port.** Rule 4 of
   `CLAUDE.md` says no vendor is named outside `infra/ai/*`; a hard-coded list of one product's
   resolutions is the same coupling wearing different clothes. Another provider offers other
   dimensions, and no social network thinks in pixels — they think in **aspect ratio** (1:1 and 4:5
   in the Instagram feed, 9:16 for stories and reels, 16:9 on YouTube, 1.91:1 for a link preview).
2. **Returning `{ url }` is wrong for this product.** Those URLs expire, typically in hours, which
   would put media with a deadline inside a post scheduled for next week; and fetching a URL the
   provider chose is exactly the request class that `harden-outbound-request-security` tightened.
   We need bytes.

## What Changes

- **`generateImage` is redesigned**: it takes an `aspect` from a closed set of ratios the networks
  actually use and returns **bytes plus mime and dimensions**. Translating a ratio into whatever
  resolution a vendor understands happens inside each adapter in `infra/ai/`, the only place
  allowed to know a vendor's vocabulary. Adapters that cannot generate images simply do not
  implement the method, and `/v1/capabilities` reports `ai.canGenerateImages: false` — the same
  pattern `canDescribeImages` already uses and that the interface already knows how to obey.
- **New plan feature `ai_image` in Premium**, 5 credits per image, per `SPEC_AI §3`. Premium
  because an image costs an order of magnitude more than a caption and the Pro allowance of 500
  would be spent in a hundred pictures.
- **Generated media is marked as generated.** Migration `0007`, purely additive, gives `media` a
  `source` (`upload` | `ai`), the `generation_prompt` and the `generation_model`. This is a
  requirement, not decoration: several platforms already demand disclosure of synthetic content, and
  without the column the product has no way to comply — and no way to answer a customer who asks
  which model produced an asset.
- **The bytes are validated as bytes.** The write path reuses `sniffMedia` — the same magic-byte
  check every upload goes through — so the declared content type of the response is never trusted,
  and the existing per-kind size ceilings apply.
- **`POST /v1/ai/image` is idempotent from the first commit.** Every other AI route can be made
  idempotent later; at five credits, a double click here is expensive enough that shipping without
  it would be a defect. It reuses the `Idempotency-Key` middleware the public API already has.
- **Alt text is offered on the generated image** when the configured model can see images, so a
  synthetic asset does not enter the library less accessible than an uploaded one.
- **Surfaces:** a "Generate image" dialog in the media library, the same action inside the
  composer's media picker with the aspect preselected from the chosen channels, and an MCP tool
  under the write scope (generating burns the organization's paid allowance, so a read-only
  credential must not be able to do it).

## Capabilities

**New Capabilities:**

- `ai-image-generation` — what generating an image must guarantee: provenance, byte validation,
  cost class, refusal when the installation cannot do it.

**Modified Capabilities:**

- `ai-provider-runtime` — the port gains an optional image capability, and the capabilities
  endpoint must report whether this installation has it.
- `ai-budget-control` — a cost class above text, and the same reserve/commit/release discipline.

## Impact

- **Code:** `packages/core/src/application/ports/{ai-provider,media}.ts`,
  `packages/core/src/infra/ai/{chat-completions,index}.ts`, new
  `packages/core/src/application/use-cases/ai-image.ts`, `packages/contracts/src/billing.ts`,
  `packages/db/src/{schema/content.ts,repositories/media.repo.ts}`,
  `apps/api/src/http/routes/{ai,capabilities}.routes.ts`, `apps/api/src/mcp/mcp-server.ts`,
  `apps/web/src/features/{ai,media,composer}/*`.
- **API:** `POST /v1/ai/image` is new; `/v1/capabilities` **gains** `ai.canGenerateImages`;
  `GET /v1/media` items gain `source`. No existing field changes type.
- **Data:** migration `0007_ai_image_provenance.sql`, **purely additive** — three nullable-or-
  defaulted columns on `media`. An older application ignores them. **Rollback:** drop the three
  columns; no media file, publication or channel is touched, so rolling back loses no scheduled
  work.
- **Security:** bytes are sniffed rather than trusted; the prompt is user content and is stored
  with the media (it is the person's own text, and it is what makes the result reproducible) but
  **never** enters `audit_log`, keeping the rule the AI slice already follows. Generation requires
  the write scope on MCP.
- **Environment:** `AI_IMAGE_MODEL`, optional. When unset, an installation with an
  image-capable dialect uses `AI_MODEL`; when the configured text model cannot draw, the operator
  names the image model here instead of running a second installation.
- **Product identity:** none.
- **Railway/deploy:** nothing required. Without an image-capable provider the route answers
  `capability.disabled` and the interface hides the surface, exactly as with the rest of the AI.

## Compatibility

Additive on every axis. Installations with `AI_PROVIDER=none`, or with a dialect that cannot draw,
behave as today with one new `false` in the capabilities payload. Existing media rows read
`source: 'upload'` through the column default, which is true of them.

## Rollback

Revert the branch and run the inverse of `0007`. Media already generated stays in the library as an
ordinary upload — losing only its provenance, which is the correct failure mode: the file itself is
never orphaned.
</content>
