## 1. Baseline

- [x] 1.1 Run `bun install --frozen-lockfile` and record a clean baseline with `bun run check`.
  - `bun run check` passes: 513 pass / 3 skip / 0 fail, boundaries, ai-providers and brand all clean.
- [x] 1.2 Capture before-screenshots of `/login` and `/registro` at desktop and handset widths for review evidence.
  - Captured in-browser against the running application before any edit; measurements recorded in `design.md`.

## 2. Stage sequencing logic (test-first)

- [x] 2.1 Write failing `bun test` cases in `apps/web/src/features/auth/stage/carousel.test.ts` for index wrap-around forward and backward, direct selection, and autoplay ineligibility when paused or when reduced motion is requested.
  - Failed first for the right reason (module absent), then 9 tests / 27 assertions pass.
- [x] 2.2 Implement `apps/web/src/features/auth/stage/carousel.ts` with pure index and eligibility functions plus the React hook composed on top.
  - File is `carousel.ts` (not `use-carousel.ts`) so the pure functions read as the module's subject and the hook composes them.

## 3. Input guidance and keyboard access (test-first)

- [x] 3.1 Write failing `bun test` cases asserting placeholders on the e-mail and password fields and that no placeholder carries a real address or credential.
  - `auth-placeholders.test.tsx`; 5 of 6 failed first, then all pass.
- [x] 3.2 Add the placeholder keys to the `auth` namespace in `apps/web/src/messages/pt-BR.json`.
- [x] 3.3 Apply placeholders to the e-mail, password, sign-up password, e-mail verification code and second-factor code inputs; keep the registration minimum-length rule in its persistent description.
  - Code fields also gained `maxLength={6}` to match the demonstrated shape.
- [x] 3.4 Remove `tabIndex={-1}` from the password visibility toggle, keeping `aria-pressed` and the visible focus outline.

## 4. Stage recomposition

- [x] 4.1 Split `brand-stage.tsx` into a shell plus `stage/slide-frame.tsx` and one file per slide under `stage/slides/`.
- [x] 4.2 Implement the shared frame with a fixed heading zone and fixed artwork area so stage height is constant across slides.
- [x] 4.3 Replace the mock source-code editor with artwork that proves the headline; delete the `CODE`/`TOKEN` tables and the `CodeCard` component.
  - Three iterations, driven by owner review. A dispatch fan, then orthogonal routing (rejected as lifeless), then network cables with travelling packets — and finally, on the owner's direction, the marketing site's MCP + API connection diagram (`stage/slides/diagram-slide.tsx` + `stage/hub-blocks.tsx`). The cable implementation was removed.
  - Slide 1's copy changed with the artwork, from the single-action publishing line to the secure-connection line, so the headline still matches what the artwork proves.
- [x] 4.4 Rebuild the schedule and flow slides against the shared frame, giving empty week cells a baseline so the grid reads as a calendar rather than as missing content.
- [x] 4.5 Collapse pagination and previous/next into one control cluster with autoplay progress on the current pagination control.
- [x] 4.6 Retire the translation keys that only served the removed code editor, in the same commit as their last usage.
  - **No-op, and worth recording:** the removed editor was hard-coded and used no translation key, so it orphaned nothing. An audit of the `auth` namespace found 10 keys unused, all of them pre-existing (`heroTitle`, `name`, `orgName`, `orgNameHint`, `providerUnavailable`, `retryCta`, `socialDivider`, `proofApis`, `proofSchedule`, `slideScheduleQueue`). They were left in place — deleting copy the owner may still intend to use is outside this change. Conversely `stageComposerTitle` and `stageComposerTime` were unused before and are now in service.

## 5. Motion and accessibility

- [x] 5.1 Add the slide entrance and the cable sequence in `globals.css`, entirely inside `@media (prefers-reduced-motion: no-preference)`.
- [x] 5.2 Verify that non-current slides stay out of the accessibility tree and out of the tab order, and that slide position is announced.
  - Measured in-browser: exactly **1** slide in the DOM per index and **5** focusable elements in the carousel (3 pagination + 2 arrows) on every slide.
- [x] 5.3 Verify with reduced motion that all slide content is visible in its final state, autoplay does not run, and the controls remain operable.
  - Guaranteed structurally: every rule that sets an initial opacity/transform/dash state lives inside the `no-preference` media query, and `autoplayEligible` returns false under reduced motion (unit-tested). Observed directly while the dev server was serving CSS without those rules: all content rendered in its final state.
- [x] 5.4 Verify keyboard operation end to end.
  - Focus reaches every field, the password toggle and all five stage controls, each with a visible outline.

## 6. Responsive behavior

- [x] 6.1 Improve the layout across widths and give the sub-stage-breakpoint summary real content.
  - Wordmark, card and footer now share one measure (`max-w-[25rem]`); below `lg` the column also carries the open-source footer, which previously existed only inside the desktop-only stage.
- [x] 6.2 Verify at handset, tablet, stage-breakpoint and wide-desktop widths that no horizontal scrollbar appears and that stage artwork stays inside the panel padding.
  - Verified with same-origin iframes (window resizing was unavailable — the browser window was maximized). 390, 768: form only, no overflow. 1023: stage correctly hidden.
  - **Defect found and fixed here:** with the diagram in place, 1024–1040 overflowed the page by 66px. The form column's `minmax(26rem, …)` floor plus the diagram's minimum widths exceeded the viewport. Fixed by lowering the form floor to `22rem` and the stage's sub-`xl` padding to `px-8`.
  - After the fix, page overflow is 0px at 1024, 1040, 1280 and 1600, the artwork never overflows its own box, and no label truncates at any of those widths.

## 7. Validation and documentation

- [x] 7.1 Run `bun run check` and record the result.
  - Passes; see 1.1.
- [x] 7.2 Run `bun run build:web` and record the result.
  - **Fails, and not from this change.** Next compiles (`✓ Compiled successfully`) but prerendering `/calendario` throws `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY não configurada`. Reproduced identically on a stashed, clean tree, so it is pre-existing: the variable name is present in the root `.env`, which the Next build inside `apps/web` does not load. No auth-surface route is involved.
- [x] 7.3 Confirm `apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts` are absent from the diff.
- [x] 7.4 Capture after-screenshots at the same widths as task 1.2 and compare against the before set.
- [x] 7.5 Update `CHANGELOG.md`, `docs/principal/STATUS.md` and the top of `docs/principal/CHANGELOG_ONDAS.md`.
- [x] 7.6 Run `bun run spec:validate` and confirm the change is strictly valid.

## 8. Handover

- [ ] 8.1 Restart the web dev server before reviewing locally. The running instance served a stale CSS chunk throughout implementation — component changes hot-reloaded but `globals.css` did not, so the cable and entrance rules were absent until restart. The production build compiles the same CSS correctly.
