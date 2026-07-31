## Why

The authenticated product does not read as an enterprise tool. The owner's assessment, after living
with the result, is that it looks generated rather than designed.

The dominant cause is measurable. Brand v1.3 (2026-07-23) made gradient relief a **pervasive**
language — the rule is literally "nothing flat". Every card, overlay, sidebar, input and filled
button carries a vertical fill gradient plus a four-value `color-mix` border. That is 69 `.bevel-*`
call sites, and it is the single strongest signal that the interface was assembled from a theme
rather than designed for this product.

Four measured patterns compound it:

| Pattern | Measurement |
|---|---|
| Two typographic scales in use at once | 295 uses of the named scale against **180 raw** `text-xs/sm/base/lg`; **35 files mix both** |
| `font-semibold` as the default weight | **184** semibold to 27 medium to 18 bold |
| Shouted labels | **38** `uppercase tracking-wide`, originating in `badge.tsx` and copied into 19 files |
| Nested frames | ~368 one-pixel borders; the settings screen alone has 16 bordered containers and three levels of nesting |

There is also an accessibility defect hiding behind the gradient. `--line` is `#d6d6df`, **1.44:1**
against white. WCAG 1.4.11 requires 3:1 where a border is the only thing identifying a component.
Today a white dropdown over a white card is separated by that hairline plus a gradient; the gradient
is doing work the border should be doing, and doing it without meeting the contrast floor.

After v1.4 shipped, the owner reviewed the result in production and found that flatness alone did
not solve the hierarchy. The interface still reads as a collection of equally weighted grey boxes.
The board makes this most visible: five identical tubs, detached filters and text-first cards do not
communicate the rhythm of a publishing operation. Brand v1.5 keeps the flat foundation and gives it
an authored composition, using the approved board reference as the visual source of truth.

## Goals

- Remove gradient relief from the product and rebuild hierarchy from background layering, border
  strength and space.
- Give borders a contrast floor where a border is the only component boundary.
- Reduce the interface to one typographic scale, three weights and one spacing scale.
- Make frames carry information: one level of border per region.
- Lock the usable content width once, in the shell.
- Establish a warm editorial canvas with a dark navigation rail and open work regions.
- Recompose Home and the board around the real publishing workflow, including optional media
  previews, without inventing analytics or capacity data.
- Consolidate `design.md` so its primary sections form one normative source.

## Non-goals

- **`box-shadow` remains forbidden.** Zero-shadow is the brand's identity pillar and is untouched by
  this change; this is not a step toward reintroducing elevation.
- No reduction below the established accessible control targets; compact board controls remain at
  least 36px.
- No change to the accent hue, the state palette or the radius scale (4/6/8).
- No normalization of typography inside provider post simulations. Those previews reproduce an
  external network's content rather than the Manypost product chrome; changing their scale or weight
  would make the preview less faithful. This is a named, file-scoped representational exception, not
  a second product scale.
- No new route or navigation destination. Existing routes may receive clearer Portuguese labels.
- No dark mode. The product remains light-first.
- No new dependency.

## What Changes

- Delete the four relief tokens and every `.bevel-*` and `.inset-field` class; surfaces become flat
  fills.
- Add `--line-strong` (3.22:1) for content in a portal and for the boundary of an input control, and
  `--state-failed-hover` so destructive hover is a colour transition rather than a brightness filter
  left over from the gradient logic.
- Recalibrate `--canvas` so the page floor sits a perceptible step below a white surface.
- Collapse the raw Tailwind type scale into the named product scale, adding a page-title and a
  numeral step and reviving the panel-title step that had been abandoned.
- Reduce weights to three roles and remove upper-casing from product surfaces.
- Apply one-level-of-border, with a named exception for objects a person drags or selects.
- Close the spacing scale to six steps and remove corrective negative margins.
- Introduce container tokens and lock the shell width once.
- Remove the Home's staggered entrance animation.
- Remove the dead `enterprise` button variant.
- Replace the cold application neutrals with the approved warm scale and introduce semantic tokens
  for the dark sidebar.
- Replace the desktop topbar with a persistent 208px/64px navigation rail that owns global search,
  notifications and the account menu; retain a compact mobile topbar and drawer.
- Recompose Home, board and the remaining product surfaces from open lists, rails and work areas.
- Rename the board label to `Quadro` while preserving `/kanban`.
- Add a nullable first-media preview to the publication feed.

## Capabilities

### New Capabilities

- `visual-design-system`: Defines the product's flat surface model, background layering, the
  two-step border scale with its contrast floor, the typographic and weight scales, the framing
  rule, the spacing scale, content measure, entrance-motion policy and control density.

## Compatibility

No route, publication state or interaction semantic changes. The publication feed receives one
additive nullable field; clients that ignore it remain compatible. The radius scale, accent/state
palettes and zero-shadow rule remain. No Postiz reference is changed, so product-identity
classification does not apply.

**Overlap:** `add-home-operational-blocks`, `add-kanban-board-operations` and
`add-global-command-palette` are open and blocked only on authenticated browser verification. This
change edits the same files. The browser verification is performed once, covering all four, and
those three are archived at that point rather than before.

## Rollback

Redeploy commit `ab1d114` to restore the production v1.4 interface. The feed addition is nullable
and requires no data rollback. No migration, environment or volume change is involved.

## Impact

- **Code:** `apps/web/src/app/globals.css`, `apps/web/src/components/ui/**`,
  `apps/web/src/components/shell/**`, `apps/web/src/lib/utils.ts`, `apps/web/src/features/**`,
  `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/messages/pt-BR.json`.
- **Documentation:** `docs/brand/BRAND_SYSTEM.md` (to v1.5), consolidated `design.md`, `docs/brand/README.md`,
  `CLAUDE.md`, `CHANGELOG.md`, `docs/principal/STATUS.md`, `docs/principal/CHANGELOG_ONDAS.md`.
- **Data and APIs:** additive `FeedItem.mediaPreview`; generated OpenAPI client change, with no
  schema migration or persistence change.
- **Security:** none. No auth, authorization, cookie, CORS, upload or secret-handling change.
  Accessibility improves: component boundaries reach the 3:1 floor that WCAG 1.4.11 requires.
- **Dependencies:** none added; one dead component variant removed.
- **Coolify:** application-only deployment; no service, variable, volume, domain or topology change.
