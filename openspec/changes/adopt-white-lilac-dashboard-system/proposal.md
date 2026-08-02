## Why

The current warm-canvas, dark-rail direction still does not match the product owner's preferred
visual language. The supplied 1200×900 dashboard specification establishes a more precise target:
quiet white surfaces, lilac analytical emphasis, compact Inter typography, medium radii and a
desktop shell that feels lighter while keeping the sidebar in a deliberately gray-black variant.

## Goals

- Adopt the supplied white/lilac system as the product's normative visual contract, including its
  palette, density, typography, borders, radii, icon sizing and responsive rules.
- Translate the fixed reference composition into a real responsive application shell rather than
  embedding a presentation canvas or fake dashboard data.
- Make shared primitives and the authenticated shell carry the direction across the product, then
  explicitly recompose the Home and Quadro as the highest-information surfaces.
- Preserve real Manypost data, operations, accessibility and URL behavior while changing visual
  hierarchy.
- Give connected social networks clear visual ownership in connection cards and post cards, using
  their real provider marks and account labels instead of tiny decorative overlays.

## Non-goals

- No fake analytics, contacts, notifications or capacity figures are introduced to imitate the
  reference raster.
- No fixed 1200×900 frame, 98px presentation offset or intentionally cropped right edge is shipped
  in the product runtime.
- No new API, database schema, provider, queue behavior or authentication mechanism.
- No broad replacement of Postiz references or protected attribution material.

## What Changes

- Replace the warm canvas and editorial display scale with a near-white main surface, subtle cool
  page canvas, compact Inter page titles and low-contrast white cards.
- Replace the 208px dark rail with a 181px gray-black sidebar (64px collapsed), neutral selected
  rows and compact 35–36px navigation items. The owner-requested dark sidebar is the only deliberate
  deviation from the supplied reference's white sidebar.
- Restore a 59px desktop topbar with breadcrumb context, compact pill search and lightweight actions;
  keep a responsive drawer on smaller screens.
- Adopt the supplied 10–12px component radii, pill search, lilac/blue KPI fills, restrained purple
  and teal accents, fine borders, two-series graph treatment and tooltip-only shadow allowance.
- Recompose Home and Quadro using aligned analytical regions, low-noise cards, compact headers and
  a denser right-rail-ready content grid without changing their data or operations.
- Promote provider identity in Conexões and in the Quadro card footer through larger brand marks,
  readable platform/account labels and bounded overflow for multi-channel groups.
- Update `design.md`, brand documentation, executable visual checks and regression tests so one
  normative layer describes the shipped product.

## Capabilities

### New Capabilities

- `white-lilac-dashboard-system`: Defines the responsive visual contract for shell, typography,
  surfaces, navigation, cards, analytics, Quadro and operational states.

### Modified Capabilities

- `repository-governance`: Changes the executable visual allowlist from the v1.5 flat 4/6/8 system
  to the approved 4/5/8/10/11/12/pill roles, chart-gradient allowance and tooltip-only shadow.

## Compatibility

Routes, API schemas, persisted preferences and all publication operations remain compatible. The
existing `/kanban` route continues to display `Quadro`; filter query parameters, density, selection,
drag, keyboard and bulk behavior do not change. Old browser sidebar preferences remain readable.

## Rollback

Revert the visual-system commit and redeploy the previous image. There is no data migration, API
rollback, environment rollback or volume operation. Existing browser preferences remain inert or
continue to work after revert.

## Impact

- **Code:** shared CSS tokens, brand checker, shell, UI primitives and authenticated web features,
  with focused work in Home and Kanban.
- **Data/API:** none.
- **Security:** no auth, tenant, token, upload, CORS or secret-handling change.
- **Product identity:** `manypost` naming and all attribution remain unchanged; no Postiz occurrence
  is modified.
- **Dependencies:** none; the existing Next.js/Tailwind/Lucide stack is retained.
- **Coolify/Railway:** image rebuild and ordinary application redeploy only; no environment sync,
  service topology, database or volume change.
