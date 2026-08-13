## Why

Brand v1.5 (`adopt-flat-visual-system`) rebuilt the application shell and recomposed Home and
Quadro around the approved editorial reference, but its original task 10.4 — propagating the same
system through the remaining product surfaces — was never implemented. Calendar, composer, media
library, connections, notifications, settings, billing, auth, onboarding, approval and OAuth still
read as the previous visual generation, so the authenticated product currently ships two visual
generations at once. On 2026-08-13 the owner decided to land the finished work on `main` and treat
the propagation as its own change instead of holding the merge.

## What Changes

- Apply the brand v1.5 editorial composition — warm canvas, dark-rail hierarchy, open work regions,
  the named type scale, three weight roles, one level of border per region and the closed spacing
  scale — to the calendar, composer, media library, connections, notifications, settings and
  billing surfaces.
- Apply the corresponding editorial treatment to the auth, onboarding, approval and OAuth consent
  surfaces, which follow the editorial regime rather than the product chrome.
- Generate and inspect fresh standalone visual references for each remaining screen archetype
  before implementing it (moved from `adopt-flat-visual-system` task 8.3); the approved board
  reference is never cropped.
- No behavioral change: every route, filter, keyboard flow, confirmation, contract and API remains
  as it is. The provider post preview keeps its named, file-scoped representational exception.

## Non-goals

- No new route, navigation destination, dependency or API change.
- No change to the accent hue, state palette, radius scale or zero-shadow rule.
- No dark mode; the product remains light-first.
- No redesign of interaction flows; this change is visual composition only.

## Capabilities

### Modified Capabilities

- `visual-design-system`: extend the system's mandatory coverage from the shell, Home and Quadro to
  every authenticated product surface.

## Compatibility

Visual-only change. No route, publication state, contract or interaction semantic changes; clients
and the API are untouched. No Postiz reference is involved, so product-identity classification does
not apply.

## Rollback

Revert the UI diff. No migration, environment variable, volume or persisted state is involved.

## Impact

- **Code:** `apps/web/src/features/{calendar,composer,media,connections,notifications,settings,billing}/**`,
  auth/onboarding/approval/OAuth routes under `apps/web/src/app/**`; shared primitives only if a
  propagation gap is found in them.
- **Documentation:** `CHANGELOG.md`, `docs/principal/STATUS.md`, `docs/principal/CHANGELOG_ONDAS.md`.
- **Data and APIs:** none.
- **Security:** none. No auth, authorization, cookie, CORS, upload or secret-handling change.
- **Deploy:** application-only; no service, variable, volume, domain or topology change.
