# Home and Calendar Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.
>
> **Execution mode:** inline in this session. Repository instructions do not
> authorize delegated agents, and the user asked to increment the existing PR
> #54.

**Goal:** fix primary-action contrast, make `/inicio` feel subtly more polished,
restore compact `/calendario` proportions, and document larger improvements for
a second PR without implementing them now.

**Architecture:** keep all runtime changes in the owning `apps/web` feature
components and existing Tailwind/brand system. OpenSpec
`refine-home-calendar-visuals` defines the observable visual contracts; focused
source/render tests protect those contracts before class-level implementation.

**Tech Stack:** Bun 1.3, TypeScript, React 19, Next.js 16 App Router, Tailwind 4,
next-intl, bun:test, OpenSpec and headless Playwright.

## Global Constraints

- Use Bun only and do not alter `bun.lock` except through Bun.
- Do not add a Home section, feature, data source or structural layout change.
- Preserve calendar URL state, views, filtering, drag-and-drop and scheduling.
- Use named product typography tokens and retain 32px minimum interactive
  targets.
- Put entrance motion only inside
  `@media (prefers-reduced-motion: no-preference)`.
- Do not manually edit generated OpenAPI or migration files.
- Keep new functionality and larger Home expansion for a separate second PR.

---

### Task 1: Lock contrast and compact-scale regressions

**Files:**

- Create: `apps/web/src/features/home/visual-refinements.test.ts`
- Create: `apps/web/src/features/calendar/visual-refinements.test.ts`

**Interfaces:**

- Consumes: source markup from `home-view.tsx`, `home-blocks.tsx`,
  `channels-panel.tsx`, `calendar-view.tsx`, `calendar-grids.tsx` and
  `globals.css`.
- Produces: focused regression assertions for semantic visual contracts.

- [ ] **Step 1: Add the failing Home source test**

```ts
import { describe, expect, test } from 'bun:test';

const source = (name: string) =>
  Bun.file(new URL(name, import.meta.url)).text();

describe('refinamentos visuais da Home', () => {
  test('Novo post explicita o texto branco', async () => {
    expect(await source('./home-view.tsx')).toMatch(
      /className="[^"]*text-paper[^"]*"[^>]*>[\s\S]*?newPost/,
    );
  });

  test('movimento é sutil e removido sob reduced motion', async () => {
    const blocks = await source('./home-blocks.tsx');
    const css = await source('../../app/globals.css');
    expect(blocks).toContain('home-surface');
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain('.home-surface');
  });
});
```

- [ ] **Step 2: Add the failing calendar source test**

```ts
import { describe, expect, test } from 'bun:test';

const source = (name: string) =>
  Bun.file(new URL(name, import.meta.url)).text();

describe('proporções visuais do calendário', () => {
  test('Criar post explicita o texto branco nas duas variantes', async () => {
    const panel = await source('./channels-panel.tsx');
    expect(panel.match(/text-paper/g)).toHaveLength(2);
  });

  test('toolbar e timeline não mantêm a escala ampliada', async () => {
    const view = await source('./calendar-view.tsx');
    const grids = await source('./calendar-grids.tsx');
    expect(view).not.toContain('h-11');
    expect(grids).not.toContain('min-h-[56px]');
    expect(grids).not.toContain('grid-cols-[56px_minmax(0,1fr)]');
  });
});
```

- [ ] **Step 3: Verify RED**

Run:
`bun test apps/web/src/features/home/visual-refinements.test.ts apps/web/src/features/calendar/visual-refinements.test.ts`

Expected: failures for absent explicit `text-paper`, absent Home polish hook and
the existing `h-11`/56px calendar scale.

### Task 2: Apply the minimal Home refinement

**Files:**

- Modify: `apps/web/src/features/home/home-view.tsx`
- Modify: `apps/web/src/features/home/home-blocks.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/src/features/home/visual-refinements.test.ts`

**Interfaces:**

- Consumes: existing `Button`, `Card`, brand tokens and Home data order.
- Produces: explicit white primary CTA plus reusable `home-surface` styling.

- [ ] **Step 1: Make the CTA foreground explicit**

Add `text-paper` to the existing “Novo post” button class; do not change the
shared `Button` default.

- [ ] **Step 2: Add the Home surface hook**

Add `home-surface` and a short filter/border transition to the existing `Card`
section. Add modest bottom spacing and a 20px content gap where the current
layout uses 16px, without adding wrappers that create a new visual region.

- [ ] **Step 3: Define suppressible motion**

```css
@media (prefers-reduced-motion: no-preference) {
  .home-surface {
    animation: home-surface-enter 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes home-surface-enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run:
`bun test apps/web/src/features/home/visual-refinements.test.ts apps/web/src/features/home/home-blocks.test.tsx`

Expected: both suites pass with Home content and ordering unchanged.

### Task 3: Restore compact calendar density

**Files:**

- Modify: `apps/web/src/features/calendar/channels-panel.tsx`
- Modify: `apps/web/src/features/calendar/calendar-view.tsx`
- Modify: `apps/web/src/features/calendar/calendar-grids.tsx`
- Test: `apps/web/src/features/calendar/visual-refinements.test.ts`

**Interfaces:**

- Consumes: existing responsive breakpoints, named `text-meta` /
  `text-compact` tokens and 32px shared small-button size.
- Produces: the same calendar behavior at lower visual density.

- [ ] **Step 1: Fix both channel-panel CTA foregrounds**

Add `text-paper` to desktop and mobile “Criar post” buttons. Replace the mobile
button's `py-5`, 40px icon-only control and 42px channel chips with the shared
32–36px compact sizing while preserving horizontal scrolling and focus styles.

- [ ] **Step 2: Compact the toolbar**

Replace 44/40px tab-list heights and `text-xs` overrides with 36/32px lists and
named `text-meta` / `text-compact` classes; keep the four-column mobile grid.

- [ ] **Step 3: Compact month and time grids**

Reduce 50–56px day selectors and timeline rows toward the historical 48px
baseline, replace ad-hoc `text-xs`/`text-sm` interface labels with named tokens,
and keep every button at least 32px tall.

- [ ] **Step 4: Keep scroll math synchronized**

Update the mobile initial-scroll multiplier to the resulting row height so the
view still opens near 07:00.

- [ ] **Step 5: Verify GREEN**

Run:
`bun test apps/web/src/features/calendar/visual-refinements.test.ts apps/web/src/features/publications/state.test.ts`

Expected: visual-contract and existing publication-state suites pass.

### Task 4: Record the second-PR opportunities

**Files:**

- Create: `docs/audits/2026-07-28-product-improvement-opportunities.md`
- Modify: `docs/README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: current code, living OpenSpecs and the dated
  `2026-07-27-home-e-evolucao-do-app.md` audit.
- Produces: a current prioritized backlog, not an implementation promise.

- [ ] **Step 1: Write the document**

Organize recommendations into P0/P1/P2 tables with `Impacto`, `Esforço`,
`Dependências`, `Por que agora` and `PR sugerido`. Separate quick usability
gains from new product capabilities and state that all implementation requires
its own OpenSpec and approval.

- [ ] **Step 2: Link and record it**

Add the new audit to `docs/README.md` and add a concise Unreleased changelog
entry covering contrast, Home polish, calendar density and the non-implemented
future backlog.

### Task 5: Validate, archive and increment PR #54

**Files:**

- Modify: `openspec/changes/refine-home-calendar-visuals/tasks.md`
- Archive through CLI after all evidence:
  `openspec/changes/archive/2026-07-28-refine-home-calendar-visuals/`
- Modify: PR #54 body after pushing commits

**Interfaces:**

- Produces: a reviewable, validated increment on
  `feat/ai-fixes-home-and-image`.

- [ ] **Step 1: Run repository gates**

Run:

```bash
bun install --frozen-lockfile
bun run check
bun run db:check
bun run build:web
bun run spec:validate
git diff --check
```

Expected: all commands pass; no protected/generated file changes.

- [ ] **Step 2: Run browser smoke**

At desktop 1440×900 and mobile 375×812, inspect `/inicio` and `/calendario`;
verify white CTA computed color, smaller controls/slots, hover/focus,
reduced-motion final state, no horizontal overflow and no new console errors.

- [ ] **Step 3: Archive only after completion**

Run:

```bash
bun run spec:archive -- refine-home-calendar-visuals -y
bun run spec:validate
```

Expected: living specs updated, change moved to the dated archive and strict
validation remains green.

- [ ] **Step 4: Commit and update the existing PR**

Create focused Conventional Commits, push the existing branch, and update PR
#54 with the new OpenSpec, exact command results, no migration/breaking change,
web-only rollback and unchanged Railway impact.
