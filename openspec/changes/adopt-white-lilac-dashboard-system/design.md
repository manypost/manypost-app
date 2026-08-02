## Context

The authenticated app currently implements brand v1.5: a warm canvas, a 208px dark rail, 32px
Plus Jakarta page titles, 4/6/8px radii and no shadows or gradients. The owner supplied a measured
1200×900 white/lilac dashboard specification and asked that its system replace the current direction,
with one explicit change: the sidebar stays dark but becomes a softer gray-black.

The reference contains presentation-only facts (98×87 framing offset, a deliberately cropped rail,
and example analytics/contact data). Manypost is a responsive product with real organization data,
not a fixed raster reproduction. The design therefore separates normative visual language from the
reference's capture geometry and sample content.

## Goals / Non-Goals

**Goals:**

- Make the supplied palette, Inter type scale, medium radii, fine borders, compact density and
  analytical lilac/teal hierarchy the normative app system.
- Carry the system primarily through shared tokens, shell and primitives so every route benefits
  without duplicating styling decisions.
- Recompose Home and Quadro explicitly because they expose the greatest density and widest state
  matrix.
- Preserve accessibility, real data, current operations and responsive behavior.

**Non-Goals:**

- No fake KPIs, charts, people, capacities or notifications.
- No fixed 1200×900 product viewport, presentation offset or intentionally clipped content.
- No API, persistence, provider, queue, authentication or dependency change.
- No dark mode.

## Decisions

### 1. Reference measurements become semantic tokens, not fixed page coordinates

The application uses `#D9DBDD` as outer canvas, `#FDFDFD` as main, white cards, `#EDEEFC` lilac KPI
fill, `#E6F1FD` blue KPI fill, `#7C56CD` primary visualization and `#00866C` as the accessible teal
text/line derivative of the reference's neon `#00F3BC`. The literal neon remains allowed for
non-text graph marks only. Borders use `#EEEEEE`/`#EDEDED`.

The fixed 181/820/260 composition becomes a responsive grid: 181px sidebar, flexible main column
bounded for readable data regions, and an optional 260px right rail only where real secondary data
exists. This preserves proportion without fabricating a cropped screenshot.

Alternative considered: ship the exact `.reference-frame`. Rejected because it would create large
dead margins, crop real controls and fail every non-1200 viewport.

### 2. The sidebar is the sole deliberate color departure

The owner explicitly asked for a more gray black sidebar, so `--sidebar` is `#242629`, with
`#303236` selected/hover fill, `#F3F3F4` primary text and `#AEB1B5` secondary text. Width is 181px
and collapsed width remains 64px so the persisted preference stays compatible. Navigation rows are
36px, use 10px radius and never use accent fill; the active item relies on neutral fill and contrast.

Alternative considered: the reference's white sidebar. Rejected by the explicit owner override.

### 3. Desktop topbar returns as a functional context strip

At `lg` and above the main column owns a 59px topbar with route breadcrumb, compact pill search,
notifications and account access. Below `lg`, the same component becomes the existing mobile header
and drawer; the sidebar is hidden. Search, notifications and account remain reachable in both modes.

This reverses the v1.5 ownership decision but does not duplicate the semantic H1: the topbar carries
breadcrumb context while `PageHeader` owns the page title.

### 4. Inter owns the authenticated product

The app uses Inter for navigation, titles, body and data. Page title is 18px/500; card title
15–16px/500; KPI is 23px/500; labels are 12–13px. Display typography remains only in marketing,
authentication and onboarding, which are not dashboard surfaces.

Named utilities are revised rather than adding arbitrary values: axis 10, meta 11, compact 13,
panel 15, title 18 and figure 23. Tabular numbers remain mandatory for comparable data.

### 5. Component geometry follows roles

The radius scale is role-based: 4px keyboard chips, 5px compact keys, 8px tooltip/microbars, 10px
controls/navigation/icon tiles, 11px analytical cards and 12px KPI cards. `rounded-full` is allowed
for search fields, avatars and tiny dots. This is intentionally broader than v1.5's 4/6/8 scale.

Cards use either a subtle border or a tinted KPI fill, never both without a semantic need. Persistent
cards have no shadow. The only shadow token is `--shadow-tooltip`, used only by the tooltip primitive.

### 6. Gradients are data encodings, never surface decoration

Linear gradients are allowed only in named visualization utilities for an active chart bar, donut
segment and low-opacity area fill. Buttons, cards, shell, fields and navigation remain solid fills.
This retains the reference's graph language without reviving generic relief or purple AI surfaces.

### 7. Home maps real operations onto the dashboard grammar

Home retains its real pipeline, upcoming publications, drafts, activity and usage. Its main grid uses
a broad primary column and a denser 260px secondary rail where the existing activity/upcoming data
can live. KPI-like operational summaries use alternating lilac/blue fills only when they contain a
single compact value; other blocks remain white bordered analytical cards. No engagement metric is
invented.

### 8. Quadro uses quiet columns inside a framed work surface

The five real states remain. A single white bordered board surface contains the filter toolbar and
five lanes; lanes use subtle separators, 15px/500 headers and white cards with 11px radius. Media,
retry, error, channel, selection, menu, URL filters, density, drag and keyboard behavior stay intact.
The board may scroll horizontally below its readable minimum. No capacity denominator is added.

### 9. Package boundaries and generated files

All runtime changes belong to `apps/web`; the executable brand check belongs to `scripts/`. There is
no reason to touch contracts, core, repositories, providers or API. No generated OpenAPI or database
file changes. Documentation changes belong to root `design.md`, `docs/brand/`, `CHANGELOG.md` and the
living OpenSpec change.

### 10. Provider identity is content, not decoration

Social-provider marks keep their official third-party colors and become the primary visual anchor
inside connection catalog cards. Connected-account cards pair a clear provider tile with account
identity instead of reducing the provider to a tiny avatar overlay. Quadro cards show compact,
readable channel chips with a 16px provider mark and account label; multi-channel groups expose up
to two identities and a truthful overflow count. These elements remain solid, bordered and quiet:
emphasis comes from size, hierarchy and authentic logos, not provider-colored card backgrounds.

Alternative considered: tint every card with each provider's brand color. Rejected because it
would fragment the white/lilac system, reduce text contrast and make multi-channel posts ambiguous.

## Risks / Trade-offs

- **[Dark sidebar diverges from the white reference]** → Treat it as an explicit token-level owner
  override while preserving the reference's 181px geometry and neutral active rows.
- **[Broader radii and limited gradients weaken a simple lint]** → Replace blanket bans with semantic
  allowlists and focused tests for primitive ownership.
- **[181px can pressure Portuguese labels]** → Keep one line, ellipsis and collapsed tooltips; do not
  widen the rail.
- **[Restored desktop topbar reduces vertical space]** → Keep it at 59px and remove duplicate route
  title text; only compact context/actions live there.
- **[Fixed reference data could tempt fake UI]** → Tests assert real block ownership and prohibit
  capacity/sample values in operational components.

## Migration Plan

1. Add RED structural tests for tokens, shell geometry, typography, role radii and visual exceptions.
2. Update tokens, Tailwind theme, `cn` typography registration, shared primitives and brand checker.
3. Recompose shell, Home and Quadro; propagate shared changes through remaining routes.
4. Update normative docs and run focused tests, `bun run check`, `bun run db:check`,
   `bun run build:web`, `bun run spec:validate`, `git diff --check` and Docker/Coolify build.
5. Commit and deploy the exact branch commit without environment sync. Verify desktop/mobile public
   surfaces and authenticated screens when a session is available.

Rollback is one code revert and redeploy. No schema, data, environment or volume rollback exists.

## Security, Observability and Compatibility

No authorization or organization-scoping path changes. No payload, token or personal data is logged.
Existing routes, query strings and browser preferences remain compatible. No new logging or metrics
are needed for a visual-only runtime change.

## Open Questions

None. The supplied specification and the gray-black sidebar override are treated as approved.
