# Design — Kanban board operations

## Package boundaries and the one additive API projection

Every operation the board performs already exists as a
use case with its own authorization and validation: `makeRetryPost` and `makeCancelPost` in
`packages/core`, reached through `POST /v1/posts/{groupId}/retry` and `.../cancel`. The board is a
presentation of the publication feed plus a dispatcher for those operations. Adding board rules to
`packages/core` would put a screen's layout policy inside the domain.

The visual reference does require one server projection: the route serializer exposes the first
media reference already present in `PostContent` as nullable `mediaPreview`. It adds no domain rule,
query, persistence or provider behavior. Keeping the projection in the HTTP adapter avoids leaking
presentation policy into `packages/core` while letting the generated web client remain typed.

The one thing that does move is the board's *own* rules — which column a group belongs to, which
transitions are permitted, which actions a card offers, which cards a bulk run may touch. Those
leave the React component and become pure modules under `apps/web/src/features/kanban/`, because
today they are only verifiable by opening a browser, and the repository has no browser harness.

## Fixing the window before anything else reads it

`listPublicationsFeed` orders by `asc(publishAt, id)` and applies `limit`. The board asks for a
thirty-day window with `limit=200`. An organization with more than two hundred publications in that
window therefore receives the two hundred *oldest* rows, and the board renders an empty "Scheduled"
column while work is in fact scheduled. The board is not merely incomplete; it asserts something
false.

The fix follows the cursor the endpoint already returns, inside the query function, up to a ceiling
of five pages (1000 items). Two alternatives were considered:

- **Raise `limit`.** The endpoint caps it at 200, and raising the cap changes a contract shared with
  the calendar to paper over a client problem.
- **`useInfiniteQuery`.** It models pagination correctly, but the board needs the *whole* set at once
  to count columns, and it would give the Home a different cache key than the board — losing the
  shared-cache guarantee that the two surfaces cannot disagree.

The ceiling is a deliberate second-order honesty problem: past 1000 items the board is truncated
again. That is why the specification requires the board to *say* it truncated and offer a narrower
window, rather than silently showing a short board. Truncated-but-labeled is acceptable; truncated
and silent is not.

## Filters in the address, density in the browser

Filters describe *the view*: which channel, which columns, which window, which text. A colleague
should be able to receive "the board, filtered to Instagram failures this week" as a link, and
returning from a post detail must not reset it. They therefore live in the screen's search
parameters, written with `router.replace(..., { scroll: false })` so filtering does not push history
entries.

Density describes *the person*, not the view. Sending a compact board to someone who prefers the
comfortable one is a small rudeness with no upside, so density is a per-browser preference in
`localStorage` and is deliberately excluded from the address.

Text filtering is client-side over the cards already read. The whole window is in memory by
construction, so a server round trip would add latency and a second matching implementation for no
gain. It reuses `normalizar()` from the search feature so that "conexoes" matches "Conexões" in both
the board and the palette — one normalization rule, not two that drift.

## The closed set of drag transitions

Being generous with drag targets and apologizing afterwards is what the board does today, with one
message for every refusal. The design instead enumerates what the platform can do and explains every
refusal with the operation that would work.

| From | To | Operation | Why |
|---|---|---|---|
| needs-a-person | scheduled | retry | `makeRetryPost` accepts `FAILED` and `NEEDS_REVIEW` |
| draft, awaiting, scheduled | cancel target | cancel, confirmed | `CANCELLABLE_STATES` covers `DRAFT` and `SCHEDULED` |

Refusals, each carrying its remedy:

- **awaiting → scheduled.** Approval is granted through the public link, by someone who may not have
  an account. Letting the board approve would make the approval record lie about who decided. The
  refusal offers copying the approval link.
- **draft → scheduled.** There is no operation. `PATCH` on a draft calls `updateDraftGroup` and the
  group stays `DRAFT`. The refusal offers duplicating into the composer, which does reach a
  schedulable state.
- **anything → published.** Technically reachable by patching `publishAt` to now, and deliberately
  not a drop target: publishing is irreversible and a drop is one slipped finger. It exists in the
  card menu with a confirmation, where the intent is unambiguous.

## Why the cancel target is not a sixth column

A "Cancelled" column would be a resting place: it would accumulate, invite drags into it, and imply
that cancelled work is part of the pipeline. It is not — it is work that left. The design keeps
`CANCELLED` off the board (preserving today's behavior and the derivation rule) and materializes a
drop target only while a drag is in progress, disappearing when it ends. Confirmation is required
because the action is destructive and the gesture is cheap.

## Bulk operations: fan-out, not a batch endpoint

A `POST /v1/posts/bulk-retry` was considered and rejected. It would need its own partial-failure
contract, its own idempotency story, and it would reimplement per-post validation that
`makeRetryPost` and `makeCancelPost` already perform — a significant amount of new mechanism for a
rare, human-initiated action over a set the person assembled by hand.

Instead: bounded fan-out over the existing endpoints, concurrency 4, selection capped at 50. The cap
is what keeps this defensible — 50 posts at concurrency 4 is a bounded burst, not a thundering herd,
and it is far more than a person selects in practice. If the cap ever becomes a real constraint,
that is the signal that a batch endpoint has earned its complexity.

Partial failure is the normal case, not an edge case: a bulk retry across eight channels will often
have some posts whose channel is still disconnected. The result is therefore a report — how many
succeeded, how many failed, and which — rather than a success toast. `planoDoLote` separates eligible
from skipped *with a reason* before anything is sent, so the person is told what will not be
attempted before it is not attempted.

## Card structure

The card is currently a `<button>`. A `<button>` cannot contain a checkbox or a menu trigger:
nesting interactive controls produces invalid markup, and screen readers and keyboard navigation
both break on it. The card becomes an `<article>` that carries the drag handle, with an inner
`<button>` covering the content region that opens the detail sheet, and the selection control and
menu trigger as siblings outside it. This is why the restructuring is a prerequisite for both the
menu and multi-select rather than a cosmetic pass.

## Keyboard

`@dnd-kit/core` registers only a `PointerSensor` today, so the board cannot be operated without a
pointer. Adding `KeyboardSensor` costs one sensor registration and makes the same transition rules
apply to keyboard moves, since the rules live in the pure `transicaoPermitida` and not in the
pointer path. `DragOverlay` replaces the current `opacity-40` treatment, which leaves the dragged
card in place and gives no feedback about where it is going.

## Observability, security, migration

No new logging, metric or trace. No schema, migration or persisted server state. Every read and
mutation uses an existing organization-scoped authenticated route, so a bulk run cannot touch a post
the organization does not own — authorization is enforced per call, exactly as for a single card.

## Editorial board composition

The approved reference is a dense work surface, not five cards containing more cards. At desktop
width the board presents five open lanes separated by vertical rules. The lane header is sticky,
status is communicated by a small semantic dot and count, and empty lanes remain visible. There are
no fictional capacity denominators because the product has no capacity model.

Cards use a compact reading order: operational time, post excerpt, optional preview, channel/account
and actions. An image uses the first media item in a 4:3 crop. Video receives a neutral play tile and
is not eagerly loaded. A post without preview does not reserve an empty rectangle. Failures keep the
error and retry action visible. Comfortable and compact density alter information volume without
changing the action model.

The board sits on the warm application canvas, with white cards, flat borders, 4/6/8px radii and no
shadow or gradient. At narrow widths lanes remain horizontally scrollable instead of collapsing
into unreadable cards. The mobile route retains all filters, operations and keyboard-accessible
controls.

## Generated files

The OpenAPI snapshot and generated web schema are regenerated from the running API after adding the
nullable feed preview. They are never edited manually.

## Compatibility and rollback

The five lanes, their derivation and the existing failed-to-scheduled retry are preserved, so a
person's mental model of the board does not change. Filters are additive and absent parameters mean
today's behavior. Rollback is a code revert of the feature directory; nothing persisted server-side
needs undoing, and a stale `mp-kanban-prefs` entry in a browser is inert. Older clients ignore the
additive preview response field.
