## Why

The new `/inicio` surface and the existing `/calendario` flow are functional, but two primary
action labels can render with insufficient contrast, the Home still feels visually static, and a
recent mobile-first calendar pass enlarged several controls and time slots beyond the product's
established compact scale. This refinement restores visual clarity now while keeping larger Home
expansions and new functionality in a separate follow-up pull request.

## Goals

- Keep the labels “Novo post” and “Criar post” white on their primary buttons.
- Give `/inicio` restrained depth, motion, hover and transition details without adding content
  regions or changing its information architecture.
- Return calendar typography, controls, cards and spacing to the compact product scale while
  preserving its current views, responsive structure and interactions.
- Record prioritized future product improvements without implementing them in this change.

## Non-goals

- No new Home section, dashboard metric, workflow or data source.
- No calendar behavior, URL state, drag-and-drop or scheduling change.
- No brand-system redesign, new visual identity, dependency or generated API change.
- No implementation of the future-improvement backlog.

## What Changes

- Make the intended white foreground explicit on the affected primary Home and calendar actions
  and protect it with focused regression coverage.
- Refine the existing Home cards and content grid with subtle spacing, hover, entrance and
  transition details that respect reduced-motion preferences.
- Reduce the calendar's oversized mobile toolbar, channel controls, day selector, timeline slots
  and related typography to the established named compact scale.
- Add a future-improvements document organized by priority, impact and effort, clearly assigned to
  a second pull request or later changes.
- Update user-facing change documentation and validate the web surface visually at desktop and
  mobile sizes.

## Capabilities

### New Capabilities

- `calendar-interface-experience`: Defines the calendar's compact visual proportions, responsive
  continuity and primary-action contrast without changing scheduling behavior.

### Modified Capabilities

- `home-operational-overview`: Adds explicit visual-contrast and restrained-motion requirements to
  the existing operational Home.

## Compatibility

All routes, API contracts, URL parameters, publication state, translations and interaction
semantics remain compatible. Existing calendar views and Home data continue to render from the
same components and sources. No Postiz reference is changed; product-identity classification is
therefore not applicable.

## Rollback

Revert the Home and calendar class-level refinements, their focused tests and the accompanying
documentation. No data or generated contract rollback is required.

## Impact

- **Code:** `apps/web/src/features/home/`, `apps/web/src/features/calendar/` and focused web tests.
- **Documentation:** a prioritized future-improvements document, `CHANGELOG.md`, OpenSpec artifacts
  and the PR evidence.
- **Data and APIs:** no schema, migration, persistence, OpenAPI or tenant-scoping impact.
- **Security:** no auth, authorization, cookie, CORS, upload or secret-handling impact.
- **Dependencies:** none.
- **Railway:** no service, variable, volume, domain, build-system or deployment-topology change.
