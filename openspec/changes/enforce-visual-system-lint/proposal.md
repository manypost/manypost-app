## Why

`adopt-flat-visual-system` replaces the product's visual language. Without enforcement, it decays: the
current state is itself the evidence. The named typographic scale has existed since wave 30, and 180
raw-size uses accumulated beside it across 35 files anyway, because nothing failed when someone wrote
`text-sm`. The same is true of the 38 upper-cased labels, all copied from one component, and of the 23
distinct gap values.

The existing `check:brand` gate has nine rules and is honest about its limits — `design.md` §51.8
already warns that saying "verified by check:brand" covers those nine rules, not the twenty design
rules it documents. Every dimension this change added to the visual system is currently unenforced.

The gate is also the only place where a visual rule can be stated once and applied to every future
file. A rule that lives only in a document is a rule that is followed until the next hurried change.

## Goals

- Make the flat surface model non-reversible by accident: relief classes and tokens cannot return
  silently as dead code or as a hand-written gradient.
- Make the single typographic scale, the three weights and the sentence-case rule enforceable.
- Make the closed spacing scale and the ban on corrective negative margins enforceable.
- Keep the editorial regime available where it legitimately applies, without a path allowlist that
  drifts.

## Non-goals

- No new tooling or dependency; this extends the existing script.
- No rule that cannot be expressed as a line-level pattern. Border nesting, contrast and semantic token
  choice remain outside the gate and are covered by focused tests and review, as they are today.
- No enforcement of the editorial regime itself; it stays deliberately unconstrained.
- No rule is added before the code it governs is conformant — each rule ships with the phase that makes
  it pass.

## What Changes

- Extend `scripts/check-brand.ts` from nine rules to sixteen, covering: reintroduction of relief
  classes, of the relief tokens, and of hand-written vertical fill gradients; raw type-scale
  utilities; upper-casing; bold; dashed borders; off-scale spacing; corrective negative margins; and
  fully-rounded corners outside their two legitimate uses.
- Scope each rule so it constrains product surfaces without touching the component kit's internal
  geometry or the editorial regime. The editorial exception is expressed by the presence of the
  display typeface on the line, so no path allowlist is needed for that regime. Provider post
  simulations use one separate explicit file allowlist so their external-network typography stays
  faithful without weakening the rule anywhere else.
- Update the script's own documentation header and the summary it prints.

## Capabilities

### Modified Capabilities

- `repository-governance`: The deterministic validation gate additionally enforces the visual system —
  flat surfaces, one typographic scale, three weights, sentence case, the closed spacing scale and the
  framing conventions that can be checked mechanically.

## Compatibility

Additive to CI. No runtime, API, data or deployment impact. Each rule is introduced in the phase whose
code it governs, so the gate never fails on code that has not yet been migrated. Existing rules are
unchanged.

## Rollback

Remove the added rules from `scripts/check-brand.ts`. No other artifact depends on them.

## Impact

- **Code:** `scripts/check-brand.ts`.
- **Documentation:** the gate's rule table in `design.md` §51.8, `CHANGELOG.md`.
- **Data and APIs:** none.
- **Security:** none.
- **Dependencies:** none.
- **Railway:** none.

**Depends on `adopt-flat-visual-system`.** The rules cannot pass until the code they govern is
conformant, so this change lands rule by rule alongside that one and is archived with it.
