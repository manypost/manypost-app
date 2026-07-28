## Context

The web app uses Next.js 16, React 19 and Tailwind 4 with named compact
typography tokens and shared `Button` variants. `/inicio` is intentionally a
small operational overview; `/calendario` is a responsive scheduling tool whose
mobile-first structure must remain intact. The recent calendar mobile pass
introduced larger ad-hoc `text-*`, padding, minimum-height and icon values than
the surrounding product scale, while the affected primary CTAs rely on an
implicit default foreground.

This change is owned entirely by `apps/web`: it changes presentation at the
feature-component layer and does not alter API, domain, persistence, queue or
provider boundaries.

## Goals / Non-Goals

**Goals:**

- Make the primary CTA foreground explicit at the call sites named by the
  requirement.
- Reuse the current layout, tokens and shared components while making Home feel
  less static.
- Replace oversized calendar values with existing named compact tokens and
  smaller spacing values.
- Preserve keyboard focus, reduced-motion behavior and current responsive
  interaction semantics.

**Non-Goals:**

- No shared button-system redesign or palette change.
- No component hierarchy rewrite, new Home region or scheduling behavior.
- No dependency, generated file, API or data change.

## Decisions

### Keep contrast explicit at the affected semantic actions

The Home “Novo post” and calendar “Criar post” actions will carry an explicit
`text-paper` class in addition to the shared primary variant. This documents
their required foreground locally and prevents a future default-variant change
from silently regressing contrast.

Changing the global `Button` component was rejected because other primary
buttons are already correct and the reported scope names two specific actions.

### Polish Home through reusable classes, not new content

The existing Home grid and blocks will receive a small, shared visual treatment:
subtle entrance sequencing on initial render, restrained border/background
transitions and hover feedback on existing cards or actionable rows. Motion
will use only opacity and transform inside
`prefers-reduced-motion: no-preference`; reduced-motion users receive the final
state immediately.

Adding ambient artwork, a hero or a new dashboard section was rejected because
it materially changes the layout and belongs to the second PR.

### Restore calendar density without reverting mobile-first behavior

The current desktop/mobile split, channel filtering, day selection and 24-hour
timeline remain. Only named typography, icon size, padding, gaps and minimum
heights introduced above the compact product scale are reduced. The historical
pre-mobile implementation is used as a density reference, not restored
wholesale.

### Verify appearance structurally and in a browser

Focused Bun rendering/source tests will lock the CTA foreground, Home
motion/reduced-motion hooks and compact calendar class contract before
implementation. A headless browser smoke at desktop and mobile sizes will
confirm computed styles and proportions when an authenticated local fixture is
available. No generated OpenAPI files are involved.

## Risks / Trade-offs

- **Class-level tests can overfit markup** → Assert only semantic visual
  contracts (foreground, reduced-motion hook and compact size ceilings).
- **Smaller mobile targets could harm usability** → Keep interactive controls
  at least 32px high and preserve focus/pressed feedback.
- **Motion can distract or violate accessibility preferences** → Keep duration
  short, animate only transform/opacity and define it exclusively under
  `prefers-reduced-motion: no-preference`.
- **A global button fix could cause unrelated regressions** → Limit the
  explicit foreground to the two reported actions.

## Migration Plan

Deploy as a normal web-only application update. No migration, environment
change, Railway operation or coordinated backend rollout is required. Roll
back by reverting the feature classes, focused tests and documentation.

## Security, Observability and Compatibility

No request, auth, tenant data or external-call path changes. Existing routes,
analytics/logging behavior and browser semantics remain unchanged; no new
observability event is introduced for cosmetic interactions.

## Open Questions

None for this scoped refinement. Larger visual or functional Home decisions are
recorded for the second PR and require separate approval.
