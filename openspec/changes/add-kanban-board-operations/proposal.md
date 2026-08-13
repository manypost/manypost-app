## Why

The board at `/kanban` is the product's real operational tool and its least maintained surface. It
is one 327-line file with no test coverage at all: the rule that maps a post group to a column
exists only inside a React component, and nothing prevents it from silently changing.

Three concrete defects follow from that. The board reads the publication feed ordered by ascending
schedule time with a fixed ceiling of two hundred rows over a thirty-day window, so an organization
that publishes more than that sees the two hundred *oldest* rows and finds its "Scheduled" column
empty — the board reports a state the organization is not in. Only one drag transition exists, and
every other move answers with one generic "invalid move" message that teaches nothing. And there is
no way to filter by channel, state or text, and no way to act on more than one card, so recovering
from an incident with eight channels means opening cards one at a time.

The board is also unusable without a pointer: no keyboard sensor is registered, so dragging is
impossible by keyboard.

## Goals

- Make the board's column derivation, filtering and eligibility rules pure, named and covered by
  tests.
- Make the board tell the truth about its window, including when it had to stop reading.
- Let a person narrow the board by channel, column, text and time window, and share that view.
- Let a person act on many cards at once, with an explicit report when only some succeeded.
- Widen drag to every transition the platform can actually perform, and explain — with the action
  that would work — every transition it cannot.
- Make the board operable by keyboard.
- Recompose the board as the approved editorial work surface: five open lanes, visible dividers,
  media-aware cards and a compact operational toolbar, while preserving every operation above.

## Non-goals

- No batch endpoint. Bulk actions are bounded fan-out over the existing per-post operations.
- No `CANCELLED` column. Cancelling stays a deliberate, confirmed action rather than a resting place
  on the board.
- No approval decision from the board. Approval remains the public link's responsibility.
- No scheduling of a `DRAFT` group by drag, because no API operation performs it.
- No change to the publication feed's ordering, cursor semantics or filters beyond one additive,
  nullable preview field derived from content that the feed already reads.
- No new persistence, migration or background job.

## What Changes

- Extract the board's column derivation, grouping, filtering, ordering, transition eligibility, card
  actions and selection-range rules into pure modules with focused tests.
- Read the full window by following the feed's existing keyset cursor up to a bounded number of
  pages, and state on screen when the window was truncated instead of showing a silently short
  board.
- Add channel, column, text and time-window filters, held in the URL so a board view can be shared
  and survives navigation.
- Add a comfortable/compact density preference, held per browser.
- Restructure the card so it can carry a selection control and an actions menu without nesting
  interactive controls inside one another.
- Add multi-select with range selection and a bulk bar offering retry and cancel, executed with
  bounded concurrency and reported per item.
- Allow dragging from every column except the published one; keep retry as the failed-to-scheduled
  transition; add a cancel drop target that appears only while dragging and always confirms.
- Refuse every other transition with a message that names why and offers the operation that does
  work.
- Add a drag overlay and a keyboard sensor.
- Rename the visible destination to `Quadro` and render the five states as open lanes rather than
  rounded column containers. Cards show the first available image preview, a neutral video tile or
  no reserved media space when the post has no preview.

## Capabilities

### New Capabilities

- `kanban-board-operations`: Defines the board's columns and their derivation from publication and
  group state, the closed set of drag transitions and how refusals are explained, shareable
  filtering, window truthfulness, multi-selection with partially successful bulk operations, the
  card's action menu, density and keyboard operability.

## Compatibility

The board's five columns, their meaning and the existing failed-to-scheduled retry are preserved.
`CANCELLED` groups remain outside the board. Publication state and URL routes remain compatible;
the board's filters are additive optional query parameters that default to the current behavior.
The publication feed gains only an additive nullable `mediaPreview`, so older clients remain
compatible. No Postiz reference is changed; product-identity classification is therefore not
applicable.

## Rollback

Revert the board feature directory and the additive preview serializer. No data or migration
rollback is required; older clients ignore the extra response field.

## Impact

- **Code:** `apps/web/src/features/kanban/` (split into pure logic, hooks and components) and
  `apps/web/src/features/publications/` (reuse of existing mutations only).
- **Documentation:** `CHANGELOG.md`, `docs/principal/STATUS.md`,
  `docs/principal/CHANGELOG_ONDAS.md`, OpenSpec artifacts.
- **Data and APIs:** no schema, migration or persistence change. The existing organization-scoped
  feed returns an additive nullable media preview and every mutation remains unchanged.
- **Security:** no auth, authorization, cookie, CORS, upload or secret-handling change. Bulk actions
  reuse per-post authorization; no operation is performed on a post the organization does not own.
- **Dependencies:** none. `@dnd-kit/core` already provides the drag overlay and keyboard sensor.
- **Railway:** no service, variable, volume, domain, build-system or deployment-topology change.
