# Design — refine-composer-authoring

## 1. Why the editor went dead, precisely

Worth recording, because the symptom pointed at the wrong component and the recovery gesture the
user found ("hover the counter") actively misleads.

The composer body renders inside a modal `DialogContent`, so `@radix-ui/react-focus-scope` is active
with `trapped: true` (`react-dialog/dist/index.mjs:146,216`). Two of its behaviours combine:

- `dist/index.mjs:45-51` — `handleFocusOut` returns early when `event.relatedTarget === null`. A
  mousedown on a non-focusable region produces exactly that. The trap does not pull focus back, so
  focus is left on `<body>` (or, in Chrome, on the dialog's own `div[tabindex="-1"]`). ProseMirror
  fires `blur`, `view.focused` goes false, and keystrokes go nowhere.
- `dist/index.mjs:52-58` — while `document.activeElement === document.body`, a `MutationObserver` on
  the dialog re-focuses the dialog container on **any removed node**. The composer removes nodes
  constantly while typing (the footer's `uniqueIssues[0]` span, `MediaStrip`, `TabsContent` swaps),
  so the steal repeats.

Hovering the counter opened a non-modal `Popover`. On open, `react-focus-scope:82-84` focuses the
portalled content because it has no tabbable child; on close, `react-popover:176-184` focuses the
**trigger** and calls `preventDefault()`, suppressing the restore-previous behaviour. So the hover
never restored the caret — it moved focus off `<body>` and back inside the dialog, which re-armed
the trap and made the next click into the editor work.

**Decision.** Fix the cause rather than the symptom, in three places:

1. The editor card owns its own focus: a `mousedown` on the card's padding (`e.target ===
   e.currentTarget`, true only for the padding ring since `.tiptap` fills the rest) calls
   `preventDefault()` and focuses the editor. The `preventDefault` is what stops the browser from
   walking up to the dialog's `tabindex="-1"`.
2. The modal stops auto-focusing on open, so the editor's own `autofocus` wins instead of racing a
   channel avatar.
3. Toolbar controls `preventDefault` on `mousedown`, and menus/popovers `preventDefault` their
   close-autofocus so the caret goes back to the text rather than to the button.

`onOpenAutoFocus` is prevented on the validation **popover** (read-only content, no tabbables — the
exact case that triggers `focus(container)`), but **not** on dropdown menus, where arrow-key
navigation depends on it.

## 2. Why `useEditor` is restabilised in the same change

`@tiptap/react`'s `compareOptions` (`dist/index.js:394-428`) compares `extensions` element-by-element
by reference and does not skip `editorProps` or `content`. The current call site rebuilds
`StarterKit.configure({...})`, `Placeholder.configure({...})` and `editorProps` inline on every
render and passes `content: store.text`, so the comparison always fails and `editor.setOptions(...)`
runs on every keystroke, in every mounted editor, reaching `view.setProps()` + `view.updateState()`.

Traced through `prosemirror-view` (`dist/index.js:5523-5551`), the same state object means
`updateSel` stays false, so this does **not** lose the selection — it is wasted work, not the focus
bug. It is fixed here anyway because it is the same file and the same read, and because the cost is
multiplied by every mounted editor.

The editor stays deliberately uncontrolled, as it already was: initial content is frozen at mount and
external writes remount through `editorNonce`. That contract is unchanged.

## 3. Where the global-text rule lives

The rule — *the global text is required only when a selected channel still inherits it* — is
implemented in one pure function, so it is testable without a DOM. `apps/web` has no jsdom and no
testing-library; all ten existing web tests are logic-only. That constraint shapes the decomposition:
`validation.ts` and `submit-payload.ts` are React-free and receive their translator as a parameter.

**Payload.** `POST /v1/posts` requires `text` to be non-empty, and this change does not touch the
API. So when the global text is empty:

- every non-empty override ships explicitly in `textByChannel` (the previous
  `override !== store.text.trim()` filter is dropped, since it would discard overrides against an
  empty global);
- `text` falls back to the first selected channel's text, becoming the group's `baseContent`.

`baseContent` is what the calendar, the approval page and duplicate already read, so they keep
working. The accepted cost: duplicating such a post will not mark that first channel as customised,
because its text equals the base. The reconstructed post is identical.

The alternative — relaxing `text` to accept empty across `POST /v1/posts`, the public API and the MCP
tool, and moving the empty-content check in `packages/core` onto the per-channel effective text — is
more correct conceptually but changes a public contract and regenerates the OpenAPI snapshot for a
UI defect. Rejected for this slice; recorded here in case the contract is revisited.

## 4. Why the view is decomposed

`composer-view.tsx` subscribes to the whole store with no selector, so all 788 lines re-render on
every keystroke and on every hover over the network row. Selectors alone do not fix that — the
component genuinely reads about twenty fields. The decomposition is the mechanism: `text`,
`overrides`, `thread` and `mediaIds` move down into the leaves that own them, and the shell keeps
only `channelIds`, `editorNonce` and the actions.

Two consequences worth stating:

- Ephemeral UI state (`activeTab`, `previewPeek`, `previewOpen`) moves into its own non-persisted
  store, so a hover over a network chip costs two re-renders instead of the whole tree.
- Each editor card owns its own `Editor` instance in local state. The hoisted `channelEditors` map
  disappears, and with it the class of bug where a destroyed instance stayed reachable — `TabsContent`
  unmounts a channel's editor without ever calling `onEditorReady(null)`. This is preferred over
  `forceMount`, which would keep a live ProseMirror view for every channel simultaneously.

`zustand@5` requires `useShallow` from `zustand/react/shallow` for object-returning selectors; the
actions object is created once inside `create()` and never replaced, so the actions selector is
shallow-stable forever.

## 5. Visual direction

The palette, type and relief system are fixed and CI-verified (`bun run check:brand`), so the
personality comes from structure. The signature is the **network rail**: each chip carries a 3px
capacity meter measured against that network's own limit, so the same text draws different bars —
a reading that only makes sense in a multichannel composer. The rail also resolves the standing
confusion between the two near-identical avatar rows by making them look like what they are:
selection (large avatars, "where it goes") versus navigation (a tab rail, "what I am editing").

Meter states use existing tokens only: `--graphite` empty, `--accent` within, `--state-review` at or
above 90% (read as "worth a look"), `--state-failed` over. No new token is introduced.
