## 1. Pure modules and the global-text rule (test-first)

- [ ] 1.1 Create `apps/web/src/features/composer/editor-guards.ts` with `editorUtilizavel`, moved from
      `ai-actions.tsx`; re-export from `ai-actions.tsx` so `ai-actions.test.tsx` keeps passing
- [ ] 1.2 Add `toolbarMarks(editor)` to `editor-guards.ts` — returns `{ bold, italic }` and never
      touches a destroyed or unmounted instance
- [ ] 1.3 Failing test `editor-guards.test.ts`: a fake whose `isActive` throws and whose
      `isDestroyed` is true returns all-false and is never called
- [ ] 1.4 Create `validation.ts` (React-free, receives the translator): `computeCounters`,
      `computeMinMax`, `computeIssues`, `computeScheduleIssues`
- [ ] 1.5 Failing test `validation.test.ts`: global empty + every selected channel with a non-empty
      override → no `emptyText`
- [ ] 1.6 Failing test: global empty + one selected channel without an override → `emptyText` is
      still raised
- [ ] 1.7 Failing test: an override present but blank → `emptyOverride`, never `emptyText`
- [ ] 1.8 Failing test: no channel selected → `noChannelSelected`
- [ ] 1.9 Failing tests for the rules carried over unchanged: `overLimit` per provider `maxLength`,
      `requiresMedia`, `missingSetting`, thread item over `minMax`, thread delay bounds
- [ ] 1.10 Each issue carries the channel that raised it, so the popover can lead to it
- [ ] 1.11 Create `submit-payload.ts` with `buildSchedulePayload(...)` (React-free)
- [ ] 1.12 Failing test `submit-payload.test.ts`: global empty → `text` falls back to the first
      channel's text and **every** override ships in `textByChannel`
- [ ] 1.13 Failing test: an override identical to a non-empty global still ships (no silent drop)
- [ ] 1.14 Failing test: empty `mediaIds` / `thread` / `settingsByChannel` are omitted
- [ ] 1.15 Implement until 1.3–1.14 pass — `bun test apps/web`

## 2. Focus (the reported defect)

- [ ] 2.1 `editor.tsx`: `mousedown` on the card padding places the caret (`e.target ===
      e.currentTarget`, `preventDefault`, focus the editor); card gets `cursor-text`
- [ ] 2.2 `editor.tsx`: hoist `StarterKit.configure(...)` to the module, memoise `extensions` and
      `editorProps`, freeze initial `content` at mount
- [ ] 2.3 `composer-modal.tsx`: prevent `onOpenAutoFocus` so the composer opens with the caret in the
      editor
- [ ] 2.4 `formatting-toolbar.tsx`: `preventDefault` on `mousedown` for every control; prevent
      `onCloseAutoFocus` on the dropdown content
- [ ] 2.5 `ai-actions.tsx`: prevent `onCloseAutoFocus` on the dropdown content
- [ ] 2.6 `formatting-toolbar.tsx`: replace the render-time `editor?.isActive(...)` reads with
      `toolbarMarks` via `useEditorState`, so marks track the caret and never touch a dead instance
- [ ] 2.7 `features/channels/hooks.ts`: `refetchOnWindowFocus: false` on `useProviders`

## 3. One validation surface

- [ ] 3.1 Create `composer-validation-popover.tsx` — click-triggered `Popover`, `onOpenAutoFocus` and
      `onCloseAutoFocus` prevented, per-channel capacity list, then the scoped issues
- [ ] 3.2 Each issue is a control that moves the composer to the channel that raised it
- [ ] 3.3 Use it in all three places, each with its own scope (global, per channel, per thread item)
- [ ] 3.4 The footer's blocked-CTA explanation becomes the same component, removing the `<span>` that
      mounted and unmounted on every keystroke
- [ ] 3.5 Delete `apps/web/src/components/ui/hover-popover.tsx` — the composer was its only importer

## 4. Decomposition and subscriptions

- [ ] 4.1 `composer-selectors.ts`: `useComposerActions()` via `useShallow`, plus fine-grained
      selectors for `text`, `overrides`, `thread`, `mediaIds`, `channelIds`, `editorNonce`
- [ ] 4.2 `composer-ui-store.ts`: `activeTab`, `previewPeek`, `previewOpen` — not persisted
- [ ] 4.3 `use-composer-validation.ts` and `use-composer-submit.ts` over the pure modules
- [ ] 4.4 `composer-editor-card.tsx` — owns its own `Editor` instance; the hoisted `channelEditors`
- [x] 4.2 `composer-ui-store.ts`: `activeTab`, `previewPeek`, `previewOpen` — not persisted
- [x] 4.3 `use-composer-validation.ts` and `use-composer-submit.ts` over the pure modules
- [x] 4.4 `composer-editor-card.tsx` — owns its own `Editor` instance; the hoisted `channelEditors`
      map is deleted
- [x] 4.5 Split the view into `composer-network-tabs.tsx`, `composer-global-tab.tsx`,
      `composer-channel-tab.tsx`, `composer-thread.tsx`, `composer-preview-pane.tsx`,
      `composer-footer.tsx`, `composer-discard-dialog.tsx`, `section-header.tsx`
- [x] 4.6 `composer-preview-pane.tsx` uses `React.memo` + `useDeferredValue`
- [x] 4.7 `composer-view.tsx` is left as the shell (grid + composition)
- [x] 4.8 Test: the actions selector stays shallow-equal across a `setText`

## 5. Visual direction

- [x] 5.1 Network rail: tab-rail treatment plus a per-chip capacity meter against that network's own
      limit; the global chip measures the tightest limit
- [x] 5.2 Meter states from existing tokens only (`--graphite` / `--accent` / `--state-review` /
      `--state-failed`); no new token
- [x] 5.3 Toolbar in three groups separated by a divider: formatting (`ghost`), media and AI
      (`outline`), validation pinned right
- [x] 5.4 **Remove the dynamic-variables menu** and its placeholders
- [x] 5.5 Channel tab while inheriting: a short panel showing the global text in read-only with
      "customise for this channel", replacing the 240px empty block
- [x] 5.6 Channel tab while customised: offer "copy from global" alongside "use the global text"
- [x] 5.7 Global tab states that it is unused when it is empty and every channel carries its own text
- [x] 5.8 Thread: numbered items on the connector, shorter cards, the raw delay input replaced by a
      compact control
- [x] 5.9 Footer in two blocks (when / actions); blocked CTA wired to its explanation via
      `aria-describedby`
- [x] 5.10 `Ctrl/Cmd + Enter` schedules; a discreet hint states it
- [x] 5.11 Draft-saved indicator
- [x] 5.12 Channel selection header states the count (`3 de 7`)
- [x] 5.13 Move every hardcoded pt-BR string in the composer and AI actions into
      `apps/web/src/messages/pt-BR.json`

## 6. Verification and close-out

- [x] 6.1 `bun run check` (typecheck, tests, boundaries, AI grep, brand)
- [x] 6.2 `bun run build:web`
- [x] 6.3 Manual pass in the running app: composer opens with the caret in the editor; click inert
      chrome and keep typing with no recovery gesture; toolbar and AI keep the caret
- [x] 6.4 Manual pass: global empty + every channel customised schedules, and the scheduled post
      carries the right text per channel; one channel inheriting brings the error back
- [x] 6.5 Manual pass: exceed X's limit → the chip meter states it, the popover names the channel,
      selecting the issue moves to that channel
- [x] 6.6 Manual pass at 375px and 1280px; keyboard reaches the rail, the popover and the footer
- [x] 6.7 `CHANGELOG.md` (root, Keep a Changelog)
- [x] 6.8 `docs/principal/STATUS.md` + a new entry at the top of `docs/principal/CHANGELOG_ONDAS.md`
- [x] 6.9 `bun run spec:validate`
