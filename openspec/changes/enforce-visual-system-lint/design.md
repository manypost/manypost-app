# Design — enforcing the visual system

## Why the gate and not a document

The visual system already existed as a document before this work. The named typographic scale shipped
in wave 30 with a written rule that no component should use an arbitrary size — and 180 raw-size uses
accumulated beside it across 35 files anyway. The same happened with upper-casing: one component
introduced it, nineteen files copied it. Nothing failed, so nothing stopped.

That is the argument for the gate. A rule stated once in `BRAND_SYSTEM.md` governs the person who
reads it; a rule in `check:brand` governs every future change including the hurried ones. The
existing script is already honest about this asymmetry — `design.md` §51.8 warns that "verified by
`check:brand`" covers its nine rules, not the twenty design rules the document lists. This change
shortens that gap; it does not close it, and the warning stays.

## Package boundaries

Entirely `scripts/check-brand.ts`. It is a standalone Bun script over `apps/web/src`, invoked by
`bun run check`. No dependency, no new tool, no config file — the rule table is data in one file, and
adding a rule is adding a row.

## Rule shape and its two exception mechanisms

Every rule is a line-level regular expression with an optional file predicate. That constrains what
can be enforced, and the constraint is accepted deliberately: a rule that needs an AST is a rule that
needs a linter, and introducing one to police seven patterns is disproportionate.

Two exception mechanisms are used, and the choice between them matters:

**By content on the line — for the editorial regime.** The raw-size and bold rules except any line
carrying the display typeface. This works because the editorial regime is *defined* by that typeface
in BRAND §5: a large heading in Degular is editorial by construction. The alternative — a list of
paths for auth, onboarding, approval and OAuth consent — would drift the first time a marketing
surface is added, and would fail open, which is the wrong direction for a gate.

**By explicit file allowlist — for genuine exceptions.** Raw sizes and bold remain permitted in
`network-preview.tsx`, where the embedded content simulates an external provider and normalizing it
would reduce preview fidelity. Dashed borders are permitted only in named files, and fully-rounded
corners only in the avatar component and small state-dot implementations. Here an allowlist is correct
precisely because it is inconvenient: each exception has to be added by name, which forces the
decision to be conscious. The provider-preview exception cannot spread to surrounding product chrome;
a dashed border promises that something can be dropped, and that promise should be hard to make by
accident.

The spacing and negative-margin rules exempt the component kit by path, because `px-3.5` inside the
button is centrally calibrated geometry, not a screen inventing a value. The rule exists to stop sixty
screens from drifting, not to rewrite the kit.

## Ordering: a rule ships with the code that satisfies it

No rule is added before its phase. Adding the upper-case rule while thirty-eight violations remain
would turn the gate red for the duration of the work, and a red gate that everyone learns to ignore is
worse than no gate. Each rule lands in the commit that clears its last violation, which also makes the
rule's introduction self-verifying: if it passes immediately, the migration was complete.

## What stays outside the gate

Three properties from `visual-design-system` cannot be checked by a line pattern, and the script must
not imply otherwise:

- **Border nesting.** "One level of border per region" is a tree property. Covered by review and by a
  render test that counts borders in the settings screen's markup.
- **Contrast ratios.** The 3:1 floor on the strong border is a colour computation. Covered by the
  token's definition and by the recorded luminance table; the gate can only check that portal
  components reference the right token, which the overlay contract test does.
- **Semantic token choice.** Using `--graphite` where `--mist` was meant produces legal code that says
  the wrong thing. This has always been outside the gate and remains so.

The script's header and printed summary are updated to list what it now covers, so that the sentence
"verified by `check:brand`" stays accurate as the rule set grows.

## Observability, security, migration

None. The script exits non-zero with a file, line and rule name per violation, as it does today. No
runtime, data or deployment surface is touched.

## Compatibility and rollback

Purely additive to CI. Removing the added rows from the rule table restores the previous behaviour;
nothing else depends on them.
