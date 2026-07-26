## Context

The authentication surface lives entirely in `apps/web`. It is a presentation
concern: it reads no persisted data, owns no business rule and calls the
authenticator through hooks that the `adopt-clerk-authentication` change
already specifies. This change therefore touches no other package, adds no
port, and moves no logic into or out of `packages/core`.

The one piece of genuine logic in the current stage — which slide is current,
how the index wraps, and whether autoplay may run — is today tangled into a
373-line client component and can only be verified by looking at a browser. It
is extracted to a pure module so it can be asserted with `bun test`, matching
the existing `auth-flow.ts` / `auth-flow.test.ts` pattern in the same folder.

## Diagnosis that drives the design

Measured on the running application at a 1707px viewport, 1110px stage panel:

| Observation | Measurement | Consequence |
| --- | --- | --- |
| Mock code editor on slide 1 | 830px wide, 12 rendered lines | Dominates the panel and reads as a wall of text |
| Slide artwork heights | differ per slide inside a `min-h-[440px]` box | Panel jumps between slides; a short slide strands its controls |
| Pagination vs. previous/next | opposite ends of a 1110px panel | Two unrelated fragments instead of one control |
| Autoplay | 6000ms, no indication | The slide changes without warning |
| Inputs | no `placeholder` attribute anywhere | Nothing tells a person what a field expects |
| Password toggle | `tabIndex={-1}` | Unreachable by keyboard |

The root problem on slide 1 is not styling. Its headline promises *"Vários
posts. Várias redes. Um clique."* and its artwork is a `fetch()` call. Copy and
image argue with each other; no amount of restyling reconciles them. The
correcting principle for this change is therefore: **each slide's artwork is the
literal proof of its own headline.**

An earlier reading of a mid-transition screenshot suggested slide content was
bleeding across slide boundaries. Direct measurement of every slide's
`scrollWidth` against its `clientWidth` returned zero overflow on all three; the
appearance was two adjacent slides during a normal transition. No clipping
defect exists and none is fixed here.

## Design decisions

### D1. What is pinned and what is free

The brand system pins the palette (`--night` stage, `--accent-on-dark` for text
and marks on dark, ink/paper/graphite elsewhere), the zero-`box-shadow` rule,
gradient relief with direction encoding function, the 4/6/8px radius scale,
Inter plus Plus Jakarta Sans, and a light-first form side. Those are not
revisited. The freedom in this change is spent on composition, rhythm and
motion — not on introducing a new look.

### D2. One shared frame

Every slide renders through a single frame component that reserves a fixed
heading zone and a fixed artwork area. Slides fill that frame instead of
defining their own height. This is what removes the empty band and stops the
panel from jumping, and it is why the fix belongs in a shared frame rather than
in per-slide height tweaks.

### D3. One control cluster with visible autoplay progress

Pagination and previous/next are grouped into one row. The current pagination
control carries the autoplay progress as a filling bar, so a 6-second automatic
advance is announced by the interface instead of surprising the reader. Progress
is CSS-driven and keyed to the current index so it restarts on change; it is
absent entirely under reduced motion, where autoplay does not run.

### D4. The signature: the connection diagram

Slide 1 reuses the structural pattern of the marketing site's connection
diagram — grouped entry points, a gathering bracket, a connector, the central
hub, a connector, a bracket, the supported networks — rendered in the stage's
dark palette. This settles the developer-audience question raised below: the
MCP and API story returns to the surface in the product's own established
visual language rather than as a mock code editor.

Two deliberate departures from the marketing implementation, both load-bearing:

1. **Brackets are CSS borders, not SVG paths.** The original draws them with
   `pathLength="100"` and `stroke-dasharray: 100` *together with*
   `vector-effect: non-scaling-stroke`. In that combination the dash pattern is
   resolved in screen pixels and stops tracking the path — invisible there
   because the bracket is short, but the same pattern produced a broken,
   1px-dashed line in this stage. A three-sided border with a radius on the
   spine corners draws the identical shape, stays crisp at any width, and has
   no such failure mode.
2. **Connector lines and brackets are static.** The owner asked for the
   structure to hold still and the motion to live in the hub, so the only
   movement on this slide is the hub's block wave (a port of `HubBlocks.astro`,
   which is JavaScript-driven and therefore checks `prefers-reduced-motion`
   itself rather than through a media query).

The gap that separates a bracket from its cards must not be mirrored on the
spine side: with padding on both sides the connector stops short and the
diagram reads as disconnected. Padding is applied only toward the cards.

### D5. Third-party marks are not altered

Desaturating the channel logos would harmonize the stage most aggressively, and
it was rejected. Platform brand guidelines generally forbid recolouring, and
this repository has pending platform App Review work. Visual dominance is
instead controlled by size, spacing and inactive opacity, which leaves each mark
unmodified in colour and shape. This is recorded because it is a deliberate
constraint, not an oversight.

### D6. Placeholder copy demonstrates rather than repeats

A placeholder that restates its label carries no information. The e-mail
placeholder demonstrates the shape of an address, and the code placeholder
demonstrates the expected digit count. On registration, the minimum-length rule
stays in the persistent description rather than the placeholder, because the
placeholder disappears exactly when the rule starts to matter. No placeholder
contains a real address or credential.

### D7. Why the carousel module is pure

`use-carousel` exports the index arithmetic and the autoplay-eligibility
predicate as plain functions over plain values, with the React hook composed on
top. The existing web test idiom is `bun:test` with `renderToStaticMarkup` and
no DOM library, so a pure module is the only shape that can actually be
asserted here.

## Resolved: the developer-facing proof

Removing the mock editor initially removed the stage's only developer-facing
proof, while BRAND §1.A states a dual focus on agencies *and* developers. The
owner resolved this by directing the opening slide to adopt the marketing
site's MCP + API connection diagram, so the developer story returns in the
product's established visual language. Slide 1's copy changed with it, from the
single-action publishing line to the secure-connection line; the retired hero
strings remain in the `auth` namespace and are listed with the other unused
keys in `tasks.md`.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Motion reads as decoration for its own sake | One sequence, on one slide, at one moment; every other slide is still |
| Fixed artwork frame clips a slide at small stage widths | Frame is sized from the shortest supported stage width; slides scale within it |
| Translation drift after retiring code-editor keys | Retired keys are removed in the same commit as their last usage |
| Regression in authentication behavior | No authenticator call, submitted value or redirect guard is edited; existing `auth-flow` tests must stay green |

## Security, data and observability

No change. The surface transmits nothing new, logs nothing, and reads no
persisted data. The open-redirect guard on the login `de` parameter and the
destination guard on the completion route are untouched. Placeholders are
static copy and are explicitly barred from carrying real values.

## Generated files

None are affected. No OpenAPI route or schema changes, so
`bun run --cwd apps/web generate:api` is not required and
`apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts` must not appear
in this change's diff.

## Rollback

Reverting the commit fully restores the previous surface. The change is confined
to presentation files under `apps/web`, with no migration, configuration or
external state involved.
