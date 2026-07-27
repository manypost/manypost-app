## 1. Rewrite stops truncating (core, test-first)

- [x] 1.1 Failing test in `packages/core/src/application/use-cases/ai.test.ts`:
      a rewrite whose model answer exceeds the channel limit returns the text
      with **no** characters removed
- [x] 1.2 Failing test: the same rewrite reports `overLimit: true` and the
      channel's `maxLength`
- [x] 1.3 Failing test: a rewrite with no `channelId` runs, returns
      `maxLength: null` and `overLimit: false`, and never touches the registry
- [x] 1.4 Change `RewriteResult` to `{ text, channelId: string | null,
      maxLength: number | null, overLimit: boolean }` and drop the `shortenTo`
      call from `makeRewriteText` until 1.1–1.3 pass
- [x] 1.5 Keep `shortenTo` where output is newly generated (caption, draft,
      week plan) — assert in a test that caption still shortens and still marks

## 2. Server-owned rewrite instructions

- [x] 2.1 Failing test in `packages/core/src/application/prompts/prompts.test.ts`:
      `rewriteInstruction('rewrite.formal')` resolves to a non-empty sentence
      and an unknown id throws the invalid-argument domain error
- [x] 2.2 Add the catalogue (`shorten`, `expand`, `formal`, `casual`,
      `with_emoji`, `without_emoji`, `fix_grammar`) to
      `packages/core/src/application/prompts/index.ts`
- [x] 2.3 Accept `instructionId` **or** free-text `instruction` in
      `makeRewriteText`; exactly one is required
- [x] 2.4 Update the prompts snapshot; confirm `check:ai-providers` still passes

## 3. Best-times honesty (core, test-first)

- [x] 3.1 Failing test in `ai-best-times.test.ts`: a channel with no history
      reports `signal: 'network_baseline'`
- [x] 3.2 Failing test: a channel with 40 delivered publications reports
      `signal: 'own_posting_history'` and `confidence: 'medium'` — never `high`
      while posting frequency is the only signal
- [x] 3.3 Add `signal` to `BestTimes`, cap confidence, and keep `sampleSize`
      and `fromBaseline` reporting exactly what they report today

## 4. API surface

- [x] 4.1 `RewriteBody`: `channelId` optional; add `instructionId` as an enum of
      the catalogue keys; `instruction` stays optional free text; refine so
      exactly one of the two is present
- [x] 4.2 New `RewriteOut` schema (nullable `maxLength`, `overLimit`) instead of
      reusing `AiVariant`; update the route's OpenAPI response
- [x] 4.3 Add `signal` to the `AiBestTimes` schema
- [x] 4.4 Update `apps/api/src/http/routes/ai.routes.test.ts` for the new
      request/response shapes
- [x] 4.5 Regenerate `apps/web/openapi.json` and
      `apps/web/src/lib/api/schema.d.ts` with the existing generator script

## 5. Composer: caption applies per channel

- [x] 5.1 Failing test for a pure mapper `variantesParaOverrides(variants)` in
      `apps/web/src/features/ai/ai-actions.test.tsx`: N variants produce N
      overrides keyed by channel, and a variant for an unknown channel is dropped
- [x] 5.2 In the global tab, apply every caption variant via `store.setOverride`
      + `store.bumpEditors` (the path `DraftFromIdea` already uses), and switch
      the active tab to the first affected channel
- [x] 5.3 In a per-channel tab, keep the single-channel behavior (apply to that
      editor)
- [x] 5.4 Thread items: offer rewrite and hashtags only, resolved against the
      tightest limit among selected channels (`minMax`, already computed in
      `composer-view.tsx:134`); remove "adapt to the network" there
- [x] 5.5 Say what happened: an inline note stating how many versions were
      applied and where to review them

## 6. Composer: render what the API reports

- [x] 6.1 Render `shortened` inline for caption and draft results, naming the
      limit that applied
- [x] 6.2 Warn on `overLimit` from a rewrite **before** writing to the editor,
      with an explicit confirm-or-cancel — never silently
- [x] 6.3 Show the credit cost of the caption action when more than one channel
      is selected

## 7. Accessibility and design-system conformance

- [x] 7.1 `AiActions` trigger uses `Button isLoading` instead of a hand-rolled
      spinner, so `aria-busy` and the preserved label come from the primitive
- [x] 7.2 Add a polite live region announcing completion and failure of every
      AI action
- [x] 7.3 `AltTextButton`: `Tooltip` instead of native `title`, and the
      "Ver planos" upgrade path the other three controls have
- [x] 7.4 `motion-reduce:animate-none` on every spinner added by this surface
- [x] 7.5 `BestTimeHint`: show the time zone next to the suggested times, and
      replace "Não foi possível calcular agora." with a message that says what
      to do next

## 8. Localization

- [x] 8.1 Move every literal string in `apps/web/src/features/ai/` to
      `apps/web/src/messages/pt-BR.json` under an `ai` namespace
- [x] 8.2 Replace the client-side `REESCRITAS` array with the catalogue ids from
      task 2, labelled from the message catalogue
- [x] 8.3 Failing test asserting every `ai.*` key referenced by the components
      exists in the catalogue (the pattern in
      `features/auth/auth-placeholders.test.tsx` already does this for auth)
- [x] 8.4 Keep rewrite labels as a nested `ai.rewrite` namespace rather than
      literal dotted keys, and assert the catalogue is valid for `next-intl`
      before a browser can fail at runtime

## 9. Verification

- [ ] 9.1 `bun run check` green (typechecks, tests, boundaries, AI grep, brand)
- [ ] 9.2 `bun run build:web` green
- [ ] 9.3 `bun run spec:validate` green
- [x] 9.4 Extend `scripts/e2e-ai.ts`: a rewrite over the limit returns the whole
      text and `overLimit: true`; a rewrite without `channelId` succeeds
- [ ] 9.5 **Not done — needs a browser.** Reproduce the original data-loss
      scenario by hand: X + LinkedIn selected, 1200-character draft, "Corrigir".
      The equivalent assertion runs at the API level in `scripts/e2e-ai.ts` (the
      whole text comes back with `overLimit: true`), and the composer's mapping
      is covered by unit tests, but nobody has watched the fixed flow in a real
      browser. The repository has no browser test harness — every E2E is an API
      script — so this is the same gap the audit records as finding 12, not an
      oversight of this change.
