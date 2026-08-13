## 1. References

- [ ] 1.1 Generate and inspect fresh standalone references for the remaining screen archetypes
  (calendar, composer, media library, connections, notifications/settings, billing,
  auth/onboarding, approval/OAuth) before implementing each one; never crop the approved board
  reference.

## 2. Operational surfaces

- [ ] 2.1 Propagate the system through the calendar: grids, filters, day/week controls and event
  cards adopt the warm canvas, named scale, weight roles and one level of border.
- [ ] 2.2 Propagate through the composer: editor chrome, network rail, channel settings and footer;
  the provider post preview keeps its named, file-scoped representational exception.
- [ ] 2.3 Propagate through the media library and connections surfaces.
- [ ] 2.4 Propagate through notifications and settings.
- [ ] 2.5 Propagate through billing.

## 3. Identity and handoff surfaces

- [ ] 3.1 Propagate the editorial treatment through auth and onboarding.
- [ ] 3.2 Propagate through the approval and OAuth consent surfaces.

## 4. Validation and delivery

- [ ] 4.1 Run `bun run check` and `bun run build:web`; keep the brand gate green.
- [ ] 4.2 Verify in a browser at 1440×900 and 375×812, including overlays over white cards and a
  reduced-motion pass.
- [ ] 4.3 Update `CHANGELOG.md`, `docs/principal/STATUS.md` and the top of
  `docs/principal/CHANGELOG_ONDAS.md`; archive this change and rerun `bun run spec:validate`.
