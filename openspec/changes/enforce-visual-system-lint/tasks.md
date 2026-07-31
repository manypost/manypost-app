## 1. Baseline

- [x] 1.1 Record the gate's current shape: nine rules over `apps/web/src`, matched line by line, with
  the token file as the only place hex is allowed.
- [x] 1.2 Confirm each new rule's pattern against the current codebase and note how many violations it
  would report today, so the rule lands with the phase that clears them.

## 2. Rules that keep surfaces flat

- [x] 2.1 Add rules rejecting the relief classes, the relief tokens and hand-written vertical fill
  gradients outside the token file. Verify the two legitimate decorative backgrounds — the
  authentication grid and the past-day hatching — do not match.
- [x] 2.2 Land these together with the flat-surface phase and confirm the gate passes.

## 3. Rules that keep one scale, three weights and sentence case

- [x] 3.1 Add rules rejecting raw size utilities and bold on product surfaces, both excepting lines
  that carry the display typeface so the editorial regime needs no path allowlist, plus the explicit
  file-scoped exception for provider-like post simulations in `network-preview.tsx`.
- [x] 3.2 Add a rule rejecting upper-casing outside the authentication and onboarding routes.
- [x] 3.3 Land these with the typography phase and confirm the gate passes.

## 4. Rules that keep framing and rhythm

- [x] 4.1 Add a rule restricting dashed borders to the surfaces where dropping is genuinely possible,
  by explicit allowlist so each exception is a conscious decision.
- [x] 4.2 Add rules rejecting off-scale spacing and corrective negative margins on feature surfaces,
  exempting the component kit, whose internal geometry is centrally calibrated.
- [x] 4.3 Add a rule restricting fully-rounded corners to avatars and small state dots.
- [x] 4.4 Land these with the framing and spacing phases and confirm the gate passes.

## 5. Documentation and delivery

- [x] 5.1 Update the script's documentation header and the summary it prints so the list of enforced
  rules stays truthful.
- [x] 5.2 Update the gate's rule table in `design.md` §51.8, which currently documents nine rules and
  warns about what is not covered; the warning stays, with the shorter remaining list.
- [x] 5.3 Update `CHANGELOG.md`.
- [x] 5.4 Run `bun run check` and `bun run spec:validate`.
- [ ] 5.5 Archive together with `adopt-flat-visual-system` after the shared authenticated-browser
  verification is complete.
