# Design — editorial flat product system (brand v1.5)

## 0. Approved reference and v1.5 direction

The approved desktop board reference is
`/home/guilherme/.codex/generated_images/019fb9ab-ed58-7110-ab25-5bdf6fbc90f0/exec-f4c47eef-07ae-4687-8f15-90c9bf07479e.png`.
It is the source of truth for composition, hierarchy and density. It is not a source of fictional
product data: invented navigation destinations and capacity denominators in the generated image are
deliberately excluded.

V1.5 is a warm editorial workspace: `#F5F3EF` page floor, white working surfaces, a `#111820`
navigation rail, Plus Jakarta Sans for page display roles, Inter for product copy and `#7C3AED`
only for primary action, focus and selection. Flat fills, zero shadow and the 4/6/8px radius scale
from v1.4 remain intact.

## 1. The record: why v1.3 is being reverted

This section exists so the next person who proposes "let's add some depth" starts from here instead
of from zero.

Gradient relief entered in wave 14 (`91db74e`, 2026-07-23) and was refined across **five rounds, each
one requested by the owner**, each widening its reach or raising its intensity. The history is in
`docs/principal/CHANGELOG_ONDAS.md:1160-1170`:

1. Three levels — buttons, cards, everything else flat.
2. Feedback: *"some buttons stayed flat"* → `.bevel-outline` given its own, stronger values.
3. Feedback: *"sidebar, popovers, day highlight, selectors… every element that looks like this"* →
   relief stopped being "button + card" and became **the language of the whole app**.
4. Directive: *"no element may stay flat"* → `.inset-field` and `.bevel-chip` were born. The only
   plane left without volume was the page background.
5. Contrast pass — `.bevel-accent` redefined with a real accent border.

On 2026-07-31 the owner assessed the aggregate result and concluded that a pervasive depth language
reads as a generated dashboard rather than an enterprise tool.

**This is not a defect report against v1.3.** v1.3 did exactly what was asked, competently, and its
implementation was sound — all colour maths derived from tokens via `color-mix`, no `box-shadow`
anywhere, four intensity tokens governing the whole app from one place. What is being reverted is the
*direction*, and the cost of the reversal — two new tokens, a recalibrated `--canvas`, 69 revised call
sites — is the price of learning by implementation that the direction was wrong. Recording it as a
mistake in execution would be false and would make the same proposal attractive again in six months.

**What survives from v1.3, deliberately:** the discipline that produced it. All colour still derives
from tokens, `globals.css` remains the only file with hex, and the intensity of the new border scale
is likewise governed from a single token.

## 2. The technical crux: what replaces relief

With `box-shadow` forbidden (unchanged) and gradients removed, exactly three instruments remain:
**fill colour**, **border strength** and **space**. All three are currently miscalibrated, and the
gradient was masking that. Deleting the gradients without recalibrating would make the interface
*less* defined, not cleaner.

### Measured luminance and contrast against `#ffffff`

| Colour | Relative luminance | Contrast vs white |
|---|---:|---:|
| `--line` `#d6d6df` | 0.677 | **1.44:1** |
| `--surface-2` `#eeeeef` | 0.856 | 1.16:1 |
| `--canvas` `#f6f6f9` | 0.934 | **1.07:1** |
| `--mist` `#8e8e96` | 0.276 | **3.22:1** |

Two conclusions. First, `--canvas` at 1.07:1 is noise, not a layer — a white card does not read as
sitting on anything. Second, no light grey reaches 3:1; the lightest that does is approximately
`#909096`. There is no way to satisfy WCAG 1.4.11 with a hairline.

### Decision: two border tokens with distinct semantic roles

```
--line        #d6d6df   DIVIDER / STRUCTURE. Decorative. No contrast floor.
                        Card border, divide-y, table rules, separators.
--line-strong #8e8e96   COMPONENT BOUNDARY. Floor 3:1.
                        (a) anything in a portal: dropdown, popover, select content,
                            dialog, sheet, command palette;
                        (b) input control boundary: input, textarea, select trigger,
                            outline button.
```

Rationale:

- **It is not an invented token.** This is the `border-subtle` / `border-strong` pair from IBM Carbon
  and the same reasoning behind Radix's `border-strong`. A serious flat system has two border
  strengths; having one is what produces a washed-out look.
- **One token fixes two problems.** `.inset-field` existed because a white field inside a white card
  disappears — the same root cause as the overlay problem. Both are boundary-legibility problems, and
  both are solved by a border that meets the floor.
- **It rescues `variant="outline"`.** The original justification for `.bevel-outline` was recorded in
  `globals.css:233-237`: *"otherwise outline reads as flat next to primary."* A 3:1 border reads as a
  control without needing a gradient.
- **It is enforceable.** A lint rule can require `border-line-strong` in the six portal components and
  the four input components.

### Second lever: recalibrate `--canvas`

`#f6f6f9` → `#f1f1f4` raises the step from 1.07:1 to 1.115:1. The number looks small; perceptually it
roughly doubles the separation and is what makes a white card read as elevated without shadow. One
token, no risk.

### Resulting layer contract

```
layer 0 (floor)     --canvas    #f1f1f4   page background. never bordered.
layer 1 (surface)   --surface   #ffffff   card, sidebar, topbar.      border-line
layer 2 (recess)    --surface-2 #eeeeef   tab rail, tile, code block. NO border — the fill is the bound
layer 3 (floating)  --surface   #ffffff   portal content.             border-line-strong
```

V1.5 warms the same semantic contract:

```
layer 0 (floor)     --canvas         #f5f3ef
layer 1 (surface)   --surface        #ffffff
layer 2 (recess)    --surface-2      #ece9e4
divider             --line           #ddd9d2
component boundary  --line-strong    #8d8882  (3.51:1 against white)
navigation          --sidebar        #111820
navigation hover    --sidebar-hover  #1b2530
navigation text     --sidebar-text   #e8edf2
navigation muted    --sidebar-muted  #aab4bf
```

Layer 3 is deliberately the same white as layer 1. What separates it is the stronger border plus, for
modal overlays, the `bg-night/40` scrim that already exists in `dialog.tsx`, `sheet.tsx` and
`alert-dialog.tsx`.

### Cases that need no new token

- **Tooltip** — becomes `bg-ink text-paper`. Dark on light separates by itself.
- **Active tab** — becomes `bg-surface` over the `--surface-2` rail with no border. The white fill
  alone is only 1.16:1, but the state is redundantly encoded by text colour (`text-graphite` →
  `text-ink`, roughly a 4.9:1 step), which satisfies 1.4.11 without a border. This justification is
  recorded in the CSS comment so it is not "fixed" later by adding a border back.
- **`bevel-accent`** (active nav, selected plan, unread notification) — becomes `bg-accent-tint
  text-accent`. Where the item is a selection among peers that already have borders, it also takes
  `border-accent`; where it is a state inside an unbordered list, tint plus text colour is enough.

### `--state-failed-hover`

Filled buttons currently hover with `filter: brightness()`. That existed only because a gradient
cannot be transitioned with `background-color`. With flat fills, hover returns to a colour transition
— which is what BRAND §2.3 always specified. `--accent-hover` and `--ink-soft` already exist for the
other filled variants; destructive lacked its pair.

## 3. Package boundaries

The visual work remains in `apps/web`. The media preview crosses the existing core port and API
serializer because the feed currently exposes only `mediaCount`; it needs no repository or database
work because `PublicationFeedItem.content.media` is already loaded.
Within `apps/web` the ordering is deliberate: tokens in `globals.css` first, then the primitives in
`components/ui/**`, and only then feature call sites. The primitives are where the system is centrally
defined; changing them first means most feature files need no edit at all.

`apps/web/src/lib/utils.ts` must register the two new type steps with `extendTailwindMerge`. This is
not cosmetic: without it, tailwind-merge classifies `text-title` as a colour and `cn('text-title
text-ink')` silently drops one of the two. The existing comment in that file records the same trap
being hit before.

## 4. Typography: why by role, not by size

The migration from the raw scale is **not** a numeric mapping — 12→11, 14→13 and 16→15 are all
one-step shifts, so a mechanical substitution would silently change the meaning of every label. Each
of the 180 raw uses is re-decided by role: is this a stamp, a sentence, or a title?

`text-panel` (15px) is revived rather than removed. It exists and has six uses because everyone wrote
`text-lg` for a card title instead. Giving it the explicit role of "title of anything that is not the
page H1" takes it from 6 uses to roughly 80 and makes the scale actually used.

The **editorial regime** (≥26px with `font-display` and `clamp()`) is untouched and stays outside this
scale. That boundary already exists in BRAND §5 and in `check-brand` rule 7, which only polices sizes
below 16px. Using `font-display` on the line as the lint exception means the boundary enforces itself
without a path allowlist that would drift.

There is one separate, named representational exception: `network-preview.tsx` simulates posts as
they will read on external providers. Its embedded post typography may retain the provider-like raw
sizes and weights needed for fidelity. The surrounding Manypost controls and labels remain on the
product scale. This is enforced by an explicit file allowlist in `check-brand`, so the exception
cannot spread to another screen silently; it is not part of the editorial regime and does not define
a second product scale.

## 5. Framing: the one exception, and why it is needed

The rule is one level of border per region. Applied literally to the kanban it would remove the border
from both the column and the card, turning draggable cards into an undifferentiated mass.

The exception is therefore stated positively: **an object a person drags, selects or reorders keeps
its frame; a container that merely holds things loses its own.** So the kanban column becomes a stage
(`bg-surface-2`, no border) and the card stays a bordered white object. This also removes the column's
2px coloured top rule, which is ornament; the same information becomes a 6px dot next to the heading,
which is data.

## 6. Motion: removing the Home entrance

`.home-surface` staggers each block in by `40ms × index` (capped at 6). Three reasons to remove it:

1. It is the exact tell the work is meant to eliminate.
2. **It costs information.** On a screen whose stated purpose is "what needs me right now", delaying
   the attention block by up to 240ms because it happens to be third is a product regression.
3. It only exists under `prefers-reduced-motion: no-preference` — so a version of the UI without it
   already ships and has simply never been looked at. Adopting it is free.

`.auth-enter` stays. It is the editorial stage on the login screen, a different regime with a
different purpose.

## 6.1 Layout spacing: the closed six-step scale

Layout gaps use exactly `4, 8, 12, 16, 24, 32px` (`gap-1/2/3/4/6/8`). This keeps the existing
4px foundation while removing the off-rhythm 2px, 20px, 28px and 40px gaps found in product
surfaces. Internal component geometry is not layout spacing and remains centrally calibrated in the
component kit. Negative margins are not part of the scale; elements that belong closer together are
wrapped as a group with their own gap.

## 7. Density: the decision to keep 38/36/56

Reducing control height to ~32px would save about 6px per control. The cost is a long tail: roughly 60
files align manually against the current height (`h-8` beside an input, `grid-cols-[48px_…]`,
`min-h-12` in the calendar locked by an existing test). The resulting 2–6px misalignments surface only
in visual review, not in tests.

The perception of "generated" does not come from six pixels of button height. It comes from the
gradient, the upper-casing, the universal semibold and the nested frames. Spending the risk budget on
density spends it in the wrong place. Recorded as a requirement so it is not re-litigated.

The single genuine outlier is corrected: `date-time-picker.tsx` is the only field at `h-9`/`text-sm`
without the field treatment.

## 8. Observability, security, migration

No logging, metric or trace change. No schema, migration or persisted state. Accessibility improves
measurably: component boundaries move from 1.44:1 to 3.22:1, satisfying WCAG 1.4.11 where a border is
the sole identifier.

## 9. Generated files

None are regenerated. No API contract changes, so `apps/web/openapi.json` and
`apps/web/src/lib/api/schema.d.ts` are untouched.

## 10. Compatibility and rollback

The feed adds `mediaPreview` as a nullable field serialized from the first existing media reference.
Images render as a 4:3 preview; video uses a neutral play tile so the board does not eagerly load a
video per card. `/kanban` and every workflow transition remain unchanged. Rollback is an application
redeploy to `ab1d114`; no data rollback exists or is needed.

## 11. Shell and responsive composition

Desktop uses a 208px dark sidebar, collapsible to 64px. The rail owns the global command trigger,
navigation, notifications, settings and account menu. The redundant desktop topbar is removed.
Below 768px the sidebar becomes the existing drawer pattern and a 56px mobile topbar keeps menu,
wordmark, search and notifications reachable.

The main canvas uses 24px padding on desktop and 16px on mobile. Standard pages remain bounded by
the shell; workflow surfaces use a named wide PageShell variant rather than a one-off width. Page
titles use a 32px named product-display role; the Home greeting may use 44px.

## 12. Board composition

The board keeps five semantic lanes and every existing transition. Lanes are open work areas
separated by vertical dividers and whitespace, with sticky headers, a state dot and the count of
items actually read. No capacity denominator or progress percentage is rendered because the product
has no capacity model.

Cards remain framed draggable objects. Their hierarchy is local date/state, two or three lines of
copy, optional media preview, channel identity and actions. Failure reason and retry are visible in
the failed lane. Selection uses one accent edge/tint. Search, channel, status, window and density
live in one toolbar; URL and localStorage ownership remain unchanged.

## 13. Whole-product propagation

Home uses a prominent next-publication row, horizontal pipeline, open schedule list and activity
rail. Calendar, composer, media, connections, notifications, settings and billing reuse open-list,
rail, gallery and form-region patterns. Auth, onboarding, approval and OAuth keep their functional
contracts while adopting the warm canvas, hierarchy and shared primitives.
