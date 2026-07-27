## Context

The composer AI flow crosses core use cases, Hono schemas, the generated web
client and React editor state. The original implementation could truncate text
written by a person and discard paid multichannel results. The corrective work
must preserve the existing package direction: prompts and business decisions in
`packages/core`, HTTP adaptation in `apps/api`, and editor/UI decisions in
`apps/web`.

## Goals / Non-Goals

**Goals:**

- preserve user-authored text and disclose every limit-related decision;
- apply every paid caption to the channel it was generated for;
- keep provider prompts server-owned and provider-neutral;
- verify the destructive regression in an authenticated browser.

**Non-Goals:**

- changing the publication-time length validation;
- adding engagement collection to best-time suggestions;
- exposing the internal rewrite route as a public machine API.

## Decisions

1. Rewrites return the complete model output. The core reports `maxLength` and
   `overLimit`; only the browser may ask the person whether to replace the
   editor content. Automatically truncating was rejected because it destroys
   user-authored input.
2. Caption variants remain addressed by channel. The web maps every result to
   the existing per-channel override store. Collapsing them into the global
   editor was rejected because it discards paid work.
3. Rewrite instruction identifiers cross HTTP; prompt sentences do not live in
   the browser. Free text remains for compatible programmatic callers.
4. Best-time confidence is capped at `medium` while the only signal is posting
   frequency. No wording may imply engagement performance.
5. OpenAPI artifacts are regenerated from a running local API with
   `API_URL=http://localhost:3100 bun run --cwd apps/web generate:api`; they are
   never edited manually.

## Risks / Trade-offs

- [A rewrite may exceed a network limit] → the UI warns before replacement and
  scheduling remains the final validation boundary.
- [A stale generated client can misread the new response] → API snapshot and
  TypeScript schema are regenerated and checked in together.
- [Unit tests can miss editor integration] → reproduce X + LinkedIn with a
  long draft in a real browser before completion.

## Migration Plan

No data migration is required. Deploy API and web from the same commit because
the internal rewrite response changes shape. Rollback is a code revert; no
persisted value needs restoration.

## Open Questions

None.
