## Why

The composer is where the product happens, and three defects make it hostile to use.

**The editor stops accepting input after a click.** The composer body lives inside a modal
`DialogContent`, so Radix's `FocusScope` is trapped. Its `handleFocusOut` bails out when
`relatedTarget === null` — which is exactly what a mousedown on any non-focusable region produces —
so focus is stranded on `<body>` and ProseMirror silently blurs. Nothing brings it back. Worse, the
same scope's `MutationObserver` re-steals focus to the dialog container on every removed node while
focus sits on `<body>`, and the footer's error `<span>` mounts and unmounts on every keystroke. The
only recovery a user found was hovering the character counter, because opening and closing the
hover-popover moves focus back inside the dialog and re-arms the trap.

**The composer refuses to schedule a post that is complete.** The client requires the global text
unconditionally, with no awareness of per-channel overrides. Someone who writes a bespoke text for
every selected channel and leaves the global editor empty is told "write the post text" and both
CTAs stay disabled, with no way forward. The draft is finished; the app says it is empty.

**The per-network state is hidden behind a hover.** Whether a text fits each network — the one thing
a multichannel composer exists to answer — is reachable only by hovering a small pill, which then
renders the same unscoped global list in all three places it appears, and whose issues name a
channel without leading anywhere.

Investigating turned up a fourth problem nobody reported: the "dynamic variables" menu inserts
`{nome_canal}`, `{data_atual}` and `{empresa}` into the text and **nothing in the repository
substitutes them**. They would be published literally to the social network. It is a control that
promises something the platform does not do.

The change was implemented in parallel with `fix-ai-composer-safety` and
`add-ai-image-generation`. Reviewing the combined tree exposed four integration defects that do not
exist when either branch is considered alone:

- the modular editor card did not tell `AiActions` whether it represented global, channel or thread
  content, so a global rewrite could again inherit the first channel's limit and paid per-channel
  variants could be discarded;
- the footer used the global-editor validation scope, which excludes thread-item issues even though
  those issues disable the footer actions;
- the document-level scheduling shortcut remained live while the discard confirmation was open;
- the new media picker contract accepted a destination channel, but the modular global editor did
  not forward it, losing the network-aware aspect suggestion for generated images.

The review also found that the "draft saved" indicator observed an in-memory Zustand mutation, not
the completion of the corresponding storage write. It could therefore claim success when browser
storage rejected the draft.

## What Changes

- **Focus belongs to the editor.** Clicking the editor card's padding places the caret instead of
  stranding focus; the modal no longer auto-focuses a channel avatar on open; toolbar controls no
  longer blur the text they act on; and menus return focus to the editor rather than to their
  trigger.
- **One validation surface, opened by click.** The hover-driven counter is replaced by a popover
  that states per-channel capacity and the blocking issues, scoped to the editor it belongs to. Each
  issue is actionable: selecting it moves to the channel that raised it.
- **Per-network capacity is stated on the surface.** Each network chip carries a capacity meter
  against that network's own limit, so the answer is legible without opening anything.
- **The dynamic-variables menu is removed**, along with the placeholders it inserted.
- **AI actions are explicitly scoped.** Global rewrites carry no arbitrary channel limit; global
  caption variants are distributed to their channels; channel actions remain channel-specific; and
  thread items do not offer a per-network adaptation that cannot be represented.
- **Every footer block has an explanation.** The footer validation scope includes post, channel and
  thread issues, while editor-local popovers remain scoped.
- **Shortcuts stop behind blocking surfaces.** Ctrl/Cmd + Enter is ignored while discard confirmation
  is open and for repeated keydown events.
- **Saved means persisted.** The status is driven by completion or failure of the browser-storage
  write rather than by any store mutation.
- **Generated-image aspect remains network-aware.** The modular global editor forwards the first
  selected channel as a suggestion; multichannel thread items do not invent a single destination.

**Behavior change to an existing rule:** the global text is required **only when at least one
selected channel still inherits it**. When every selected channel carries its own non-empty text,
the post schedules with the global editor empty. This is a client-side rule and a client-side
payload rule: the API contract for `POST /v1/posts` is unchanged, because the composer sends the
first channel's text as the group's base text and every override explicitly in `textByChannel`.

## Capabilities

### New Capabilities

- `composer-authoring-experience`: how the composer holds the caret, when the global text is
  required, how per-network limits are stated, and what an authoring control may promise.

### Modified Capabilities

None. `ai-content-generation` and `ai-image-generation` remain the normative sources for their API
contracts; this change makes the composer preserve those existing contracts while specifying only
the authoring experience. `composer-channel-settings` is likewise unchanged.

## Goals

- A person writes for twenty minutes without the editor going dead and without losing the caret to a
  toolbar button.
- A post whose channels all carry their own text schedules, and one where a channel still inherits an
  empty global does not.
- Whether the text fits each selected network is answerable at a glance, and an issue leads to the
  place that fixes it.
- Every authoring control does what its label says.

## Non-goals

- No change to the API, the public API, the MCP tools, `packages/core` or the generated OpenAPI. The
  server-side rule that a publication's text is non-empty stays exactly as it is.
- No rich-text marks beyond the current bold/italic; the providers are all `editor: 'plain'`.
- No substitution engine for dynamic variables. Removing the menu is the correction; building the
  feature is a separate slice.
- No change to the per-network preview cards or to `channel-settings.tsx`.
- No new AI operation, plan entitlement, provider call or credit cost. The integration only preserves
  the behavior already specified by the parallel AI changes.

## Compatibility

The stored draft (`mp-composer-draft` in localStorage) keeps its shape, so a draft written before
this change reopens unchanged. Posts scheduled with an empty global text carry the first channel's
text as `baseContent`, which is what every existing consumer (calendar, approval page, duplicate)
already reads; duplicating such a post reconstructs the same publications, with the first channel
shown as inheriting rather than customised — the resulting post is identical.

## Rollback

Revert the branch. Nothing is persisted in a new shape and no migration runs.

## Impact

- `apps/web/src/features/composer/` — `validation.ts`, `submit-payload.ts`, `editor-guards.ts`
  (new, pure); `composer-selectors.ts`, `composer-ui-store.ts` (new); the view is decomposed into
  per-region components; `editor.tsx`, `formatting-toolbar.tsx`, `composer-modal.tsx` change
- `apps/web/src/components/ui/hover-popover.tsx` — deleted (the composer was its only importer)
- `apps/web/src/features/ai/ai-actions.tsx` — menu no longer steals the caret on close
- `apps/web/src/features/channels/hooks.ts` — the provider catalogue stops refetching on window focus
- `apps/web/src/messages/pt-BR.json` — strings that were hardcoded in TSX move here
- `CHANGELOG.md`, `docs/principal/STATUS.md`, `docs/principal/CHANGELOG_ONDAS.md`

**Security impact:** the change keeps rewrite instructions server-owned and prevents a client-side
merge resolution from restoring free-form instruction text. No auth, tenant boundary, secret or
provider request is added.

**Data impact:** none. No schema, no migration.

**Product identity:** the network rail with per-channel capacity meters is original to this repo. The
global-plus-per-channel composer structure remains the acknowledged Postiz direction already recorded
in `SPEC_FRONTEND` §3.3.
