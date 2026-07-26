## Why

The public authentication surface is the first screen a prospective customer
sees, and it currently undercuts the product. Input fields carry no example
value, the brand stage renders a different composition height per slide so the
panel visibly jumps and leaves a large empty band above its controls, the
carousel controls sit at opposite ends of the panel with no relationship, and
the first slide illustrates the promise "Vários posts. Várias redes. Um clique."
with an 830px mock source-code editor that argues with its own headline. The
stage is also a single 373-line client component with no separable, testable
logic and no motion beyond a track translate.

## What Changes

- Add a demonstrating placeholder to every input on the authentication surface:
  e-mail, password, sign-up password, e-mail verification code and second-factor
  code.
- Make the password visibility toggle reachable by keyboard instead of removing
  it from the tab order.
- Replace the first stage slide's mock source-code editor with a dispatch
  composition that depicts one post fanning out to the connected channels, so
  the artwork proves the headline it sits under.
- Give all stage slides one shared frame with a fixed artwork area so the panel
  no longer changes height between slides, and collapse the separated pagination
  dots and previous/next controls into a single control cluster that exposes
  autoplay progress.
- Add an orchestrated, reduced-motion-aware entrance for stage slides and a
  staggered dispatch sequence on the first slide; no hover motion is introduced.
- Extract the carousel index, autoplay and reduced-motion behavior into a pure,
  unit-tested module, and split the stage into a shell plus one file per slide.
- Improve the authentication layout across widths, including a mobile summary
  that carries real content rather than a lone row of channel icons.
- Keep every authentication behavior, route, Clerk call, redirect and error path
  exactly as it is today.

## Capabilities

### New Capabilities

- `auth-surface-experience`: presentation, input guidance, responsive behavior,
  motion policy and accessibility of the public authentication surface (login,
  registration, e-mail verification, second factor, SSO callback and session
  completion), independent of which authenticator is used.

### Modified Capabilities

None. No archived live OpenSpec capability specifies authentication
presentation. The active `adopt-clerk-authentication` change owns
authentication behavior; this change deliberately does not alter any of its
requirements.

## Impact

- Web only: `apps/web/src/app/(auth)/**`, `apps/web/src/features/auth/**`, the
  authentication string block in `apps/web/src/messages/pt-BR.json` and the
  authentication-scoped rules in `apps/web/src/app/globals.css`.
- No change to API, core, database, queue, providers, worker, OpenAPI schema or
  generated clients. No migration.
- Dependencies: none added. The stage composition uses inline SVG and CSS
  already permitted by the brand system.
- Data: none. The surface reads no persisted data and adds no field that is
  submitted, logged or transmitted.
- Security: unchanged. No modification to Clerk calls, session finalization,
  redirect validation or the existing open-redirect guard on the `de` parameter.
  Placeholders are static interface copy and MUST NOT contain a real address,
  credential or personal datum.
- Brand: all colour comes from existing tokens; `box-shadow` remains absent;
  hover keeps colour and brightness transitions only; radius stays on the
  4/6/8px scale. Third-party channel marks are not recoloured or otherwise
  altered, so platform brand-asset review is unaffected.
- Product identity: no Postiz occurrence is renamed; the Postiz-reference
  classification is not applicable to this change.
- Railway: no deployment and no configuration change.

## Goals

- Make the authentication surface hold its composition at every supported width
  and between every slide.
- Make each stage slide's artwork the literal proof of its own headline.
- Tell a person what a field expects before they type in it.
- Make stage logic testable without a browser.

## Non-goals

- Changing any authentication behavior, provider, route or redirect.
- Introducing dark mode; the form side stays light-first per the brand system.
- Adding a developer/API-oriented slide. Removing the mock code editor also
  removes the only developer-facing proof from the stage. Whether the stage
  should carry a dedicated API/MCP slide for the "Agências + Desenvolvedores"
  dual focus (BRAND §1.A) is left as an open product decision, recorded in
  `design.md`, and is trivially additive later.
- Redesigning the post-authentication application shell.

## Compatibility

Fully backward compatible. Routes, component export names, translation keys in
use and the authentication state machine are preserved; translation keys are
added, and keys that only served the removed code editor are retired. No
consumer outside `apps/web` references the changed modules.

## Rollback

Roll back by deploying the previously verified release. The change is confined
to presentation files in `apps/web`, so reverting the commit fully restores the
prior surface. No data migration, no configuration change and no external state
is involved.
