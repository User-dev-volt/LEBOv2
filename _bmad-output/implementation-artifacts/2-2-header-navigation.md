# Story 2.2: Header navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want top-level header navigation between Builder, Complete Build Optimizer, Gear Optimization, and Settings,
so that I can move between the app's major surfaces.

This is the **second story of Epic 2 (UI/UX Revamp)**, building on the already-reconciled design tokens from Story 2.1. The header (`AppHeader.tsx`) already exists and is largely faithful to the Claude Design prototype — this story **extends** it: adds the **Complete Build Optimizer** nav item (in FR-33 order), adds **global `Esc` → Builder** navigation from any full-screen view, hardens **accessibility** (active-item `aria-current`, focus ring), and **reconciles `AppHeader.tsx` with its already-ahead test file** to clear the documented AppHeader baseline failure. It is a **layout/navigation-chrome** story: no scoring engine, no new stat, no Rust, no data-loader change.

**The one structural decision (read this first):** The `appStore.currentView` union extension to add `'complete-optimizer'` and the actual Complete Build Optimizer **view + routing** are **owned by Epic 6 / D-P4-5** (`Story 6.1`), *not* this story. Epic 2 owns only `CenterTab += 'weaver'` (that's Story 2.5, not here). Therefore in this story the **Complete Build Optimizer nav item is rendered present-but-inert** (visible per FR-33, but `disabled`/non-navigating with a quiet "coming soon" affordance). **Do NOT add `'complete-optimizer'` to the `currentView` union here** — that would land Epic 6's deliverable early and create a dead-end route to a non-existent view. See Dev Notes "The Complete Build Optimizer ownership boundary".

## Acceptance Criteria

**AC1 — Header renders the four nav items in FR-33 order, active item highlighted (FR-33, UX-DR12)**
- **Given** the app header (`lebo/src/features/layout/AppHeader.tsx`),
- **When** it renders,
- **Then** it shows nav items in this exact order — **Builder | Complete Build Optimizer | Gear Optimization | Settings** — restyled per the Claude Design `.header-nav-item` treatment (active = `--color-accent-gold` text on the gold-tint background `rgba(201,168,76,0.12)`; inactive = `--color-text-secondary`; hover = `--color-text-primary` on `--color-bg-elevated`),
- **And** the nav item matching the current view carries the **active** treatment **and** `aria-current="page"`,
- **And** the existing **Gear Optimization** item keeps its current `requiresBuild` gating (hidden when `activeBuild` is null — unchanged behavior),
- **And** the existing logo, update banner, online indicator, and right-side cluster are preserved (this story does not remove any existing header capability).

**AC2 — `Esc` returns to the Builder from any full-screen view; navigation stays `appStore.currentView`-driven, no router (FR-33, AR-6/D-P4-5)**
- **Given** the app is in any full-screen view (`currentView` is `'settings'` or `'gear-optimization'`),
- **When** `Esc` is pressed,
- **Then** the app returns to the Builder view (`setCurrentView('main')`),
- **And** when `currentView` is already `'main'`, `Esc` retains its existing in-builder behavior (clear preview-suggestion rank + dispatch the `keyboard:escape` event) — it must **not** be hijacked,
- **And** all view switching is driven by `appStore.currentView` (no React Router is introduced; no new top-level store).

**AC3 — Complete Build Optimizer nav item is present but inert until Epic 6 (scope boundary; D-P4-5 owned by Epic 6)**
- **Given** the new Complete Build Optimizer nav item,
- **When** the header renders,
- **Then** the item is visible in its FR-33 position with a `data-testid="complete-optimizer-button"`, rendered **disabled / non-navigating** (`disabled` attribute + `aria-disabled="true"`, muted styling, e.g. a `title`/visually-quiet "Coming soon" cue), and clicking it does **nothing** (it does not change `currentView`),
- **And** the `appStore.currentView` union is **left as `'main' | 'settings' | 'gear-optimization'`** — `'complete-optimizer'` is **not** added in this story (it is Epic 6 / Story 6.1 / D-P4-5),
- **And** a brief comment at the nav-item site notes the Epic 6 hand-off so the next dev wires it (remove `disabled` + add the union member + route) without re-deriving this boundary.

**AC4 — AppHeader source reconciled with its test spec; baseline failure cleared (regression-positive)**
- **Given** `AppHeader.test.tsx` already asserts strings the current source does not render (it is part of the documented pre-existing UI baseline failure set),
- **When** the header is rebuilt,
- **Then** `AppHeader.tsx` is brought into agreement with the existing test spec so those assertions pass: logo mark text **`LEBOv2`** (the test does `getByText('LEBOv2')`), update-available text **`LEBOv2 {version} is available.`**, downloading text **`Downloading... {pct}%`**, ready text **`Update ready. Restart LEBOv2 to apply?`** (see Dev Notes "Source ↔ test reconciliation table" for the exact strings/testids),
- **And** the full product subtitle `Last Epoch Build Optimizer` is retained,
- **And** the `AppHeader` file moves from the failing-baseline list to **passing** — this story **reduces** the documented baseline failure count; it must not introduce any new failure.

**AC5 — New navigation behavior is tested; accessibility holds; build green (NFR-14, UX-DR12)**
- **Given** the existing co-located `AppHeader.test.tsx`,
- **When** tests are updated/added,
- **Then** new tests cover: all four nav items render in order; the Complete Build Optimizer item is present and `disabled` and clicking it does not change `currentView`; clicking **Builder** / **Gear Optimization** / **Settings** sets the matching `currentView`; the active item has `aria-current="page"`; Gear Optimization is hidden when `activeBuild` is null and shown when set,
- **And** an `Esc`-from-full-screen test (or App-level test) asserts `currentView` returns to `'main'` from `'settings'` and from `'gear-optimization'`, and that `Esc` in `'main'` does not navigate away,
- **And** interactive nav items keep the 2px solid `--color-accent-gold` focus ring, animations gate behind `prefers-reduced-motion`, and the header introduces **zero new `vitest-axe` violations**,
- **And** `pnpm exec tsc --noEmit` exits 0 and `CI=true pnpm exec vitest run` shows no new failures versus the documented baseline (and AppHeader now passing).

## Source Audit

**Not applicable — this story introduces, computes, and surfaces NO new stat.** It is header navigation chrome only. It touches no game-data loader, no `scoring-core` / `compute/*` module, no `StatKey`, no `StatSheet` field, and no displayed numeric stat. The SOURCE-AUDIT GUARDRAIL's "map each new stat to real shipped-data, or declare honest-`0.0` with no dead StatKey" requirement is satisfied by this explicit **no-new-stat / no-dead-key** declaration, and the guardrail's "value + element assertion test" requirement (which targets prose/tag stat parsing) does not apply. The relevant verification here is **navigation-behavior + accessibility assertion tests** in `AppHeader.test.tsx` (AC5).

## Tasks / Subtasks

- [x] **Task 1 — Add the Complete Build Optimizer nav item (inert) and reorder to FR-33 (AC: 1, 3)** — `lebo/src/features/layout/AppHeader.tsx`
  - [x] Reorder `navItems` to FR-33 order: Builder → Complete Build Optimizer → Gear Optimization → Settings.
  - [x] Keep the `requiresBuild` gate on Gear Optimization (`if (requiresBuild && !activeBuild) return null`). Builder and Settings stay always-on.
  - [x] Render the Complete Build Optimizer item as a **disabled** button: `disabled`, `aria-disabled="true"`, `data-testid="complete-optimizer-button"`, muted color (`--color-text-muted`), `title="Coming soon"`, `cursor: not-allowed`; its `onClick` must be a no-op (do not call `setCurrentView`). Add a one-line comment: `// Epic 6 / Story 6.1 (D-P4-5) wires this: add 'complete-optimizer' to currentView union + route the view, then remove disabled.`
  - [x] Add `data-testid` to all four items for testability — keep the existing `settings-button` and `gear-optimization-button`; add `builder-button` and `complete-optimizer-button`.
  - [x] On the active item set `aria-current="page"`. Confirm the active/inactive/hover styling matches the prototype `.header-nav-item` (active gold + `rgba(201,168,76,0.12)`; inactive `--color-text-secondary`; hover `--color-text-primary` / `--color-bg-elevated`).

- [x] **Task 2 — Reconcile AppHeader source strings with the test spec (AC: 4)** — `lebo/src/features/layout/AppHeader.tsx`
  - [x] Logo mark: render **`LEBOv2`** (was `LEBO`). Keep the subtitle `Last Epoch Build Optimizer`.
  - [x] Update banner strings to match the test spec exactly (see Dev Notes table): version-available → `LEBOv2 {version} is available.` (testid `update-version-text`); downloading → `Downloading... {progress}%` (testid `download-progress-text`); ready → `Update ready. Restart LEBOv2 to apply?` (testid `update-ready-text`). Preserve all existing update-flow logic (`startDownload`, `installAndRestart`, dismiss, error, button testids).
  - [x] Do not alter the online/offline indicator or the `v2` version tag logic except as needed for the above (the online dot uses `--color-data-positive` / `--color-data-negative`; leave as-is).

- [x] **Task 3 — Global `Esc` → Builder from full-screen views (AC: 2)** — `lebo/src/App.tsx`
  - [x] In the keydown handler's existing `if (e.key === 'Escape')` branch (currently clears preview rank + dispatches `keyboard:escape`), branch on view first:
    ```ts
    if (e.key === 'Escape') {
      const { currentView, setCurrentView } = useAppStore.getState()
      if (currentView !== 'main') { setCurrentView('main'); return }   // FR-33: Esc returns to Builder from any full-screen view
      useOptimizationStore.getState().setPreviewSuggestionRank(null)
      window.dispatchEvent(new CustomEvent('keyboard:escape'))
      return
    }
    ```
  - [x] Verify the existing in-builder `Esc` behavior (preview clear + suggestion-panel collapse) is unchanged when `currentView === 'main'`.
  - [x] Leave the existing **"Back to Builder"** controls in `Settings.tsx` and `GearOptimizationView.tsx` intact (they already call `setCurrentView('main')`) — `Esc` is additive, not a replacement.

- [x] **Task 4 — Tests: nav behavior + Esc + a11y (AC: 5)** — `lebo/src/features/layout/AppHeader.test.tsx` (+ App-level Esc test)
  - [x] Add tests: four items render in FR-33 order; Complete Build Optimizer is present, `disabled`, and clicking it leaves `currentView` unchanged; Builder/Gear Optimization/Settings clicks set the matching `currentView`; active item has `aria-current="page"`; Gear Optimization hidden when `activeBuild` null, shown when set (set `useBuildStore` state in the test, mirroring existing store-driven test setup).
  - [x] Keep/repair the existing update-banner tests — they should now pass against the reconciled strings (AC4). Do **not** weaken them to match old source; fix the source.
  - [x] Add an `Esc`-from-full-screen assertion: with `currentView: 'settings'`, dispatch `keydown` `Escape` and assert `currentView === 'main'`; same from `'gear-optimization'`; and assert `Esc` in `'main'` does not change the view. (Placed in a new App-level test `App.keyboard.test.tsx` alongside the App keydown handler.)
  - [x] Add/keep a `vitest-axe` check on the rendered header: `expect(await axe(container)).toHaveNoViolations()`.

- [x] **Task 5 — Verify build + suite (AC: 4, 5)**
  - [x] `pnpm exec tsc --noEmit` → exit 0.
  - [x] `CI=true pnpm exec vitest run` → AppHeader now passes; no new failures vs. the documented baseline (`RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls` remain in the baseline — AppHeader dropped out of it).
  - [x] `pnpm build` → exit 0.
  - [x] Manual sanity: verified via automated tests (four items in order; Complete Build Optimizer disabled + non-navigating; Builder/Gear Opt/Settings navigate; `Esc` from Settings and Gear Optimization returns to Builder; active item gold with `aria-current`). Interactive Tauri-window check deferred to reviewer.

### Review Findings

_Code review 2026-06-04 (3-layer adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor: all 5 ACs PASS, scope boundary (currentView union unextended) PASS._

- [x] [Review][Patch] Guard text inputs from the global `Esc` handler (resolved decision, 2026-06-04) — `Esc` while a text/textarea/contenteditable field is focused (e.g. the API-key or OpenRouter field in Settings) currently navigates to Builder mid-edit, overriding the conventional "Esc shouldn't eject you from a focused field." **Alec's call: add an input-target guard** (matching the existing `isInputTarget` pattern at App.tsx:124-128) so `Esc` does nothing while a field is focused; it still returns to Builder from any non-input focus in a full-screen view. This intentionally supersedes the spec's "Esc fires before the input guard" note. (Blind Hunter's "Esc steals modal dismissal" was refuted — no modal mounts outside `main`.) [lebo/src/App.tsx:100-107]
- [x] [Review][Patch] `Esc` from a non-main view skips `setPreviewSuggestionRank(null)` (early-return) — leftover preview rank from `main` is not cleared on the keystroke; defensively clear it before the early return [lebo/src/App.tsx:101-103]
- [x] [Review][Patch] Disabled-button click test is a trivial pass — jsdom does not fire `onClick` on a `disabled` `<button>`, so `fireEvent.click` + `expect(currentView).toBe('main')` asserts nothing; the `toBeDisabled()`/`aria-disabled` assertions already cover the guarantee, so drop or replace the misleading click assertion [lebo/src/features/layout/AppHeader.test.tsx:~191]
- [x] [Review][Patch] `navItems` `'main'` entry is dead data + literal duplication — `'main'`/`'Builder'`/`'builder-button'` are duplicated between the `navItems` array and the explicit `renderNavButton('main', ...)` call, then filtered back out with `.filter(id !== 'main')`; drift risk against the order-asserting test. Render all items from a single source [lebo/src/features/layout/AppHeader.tsx:51-78]
- [x] [Review][Patch] "hides Gear Optimization" test mounts two headers in one `it` — second `render(<AppHeader />)` mounts a duplicate header; `getAllByTestId(...).length > 0` tolerates leakage and weakens the assertion. Use `rerender`/scoped query [lebo/src/features/layout/AppHeader.test.tsx:~228]

_Dismissed as noise (6): "no Esc history stack" (spec mandates flat reset to Builder; no nested nav exists); "dead placeholder UI in nav" (AC3 mandates the inert item; Epic 6 hand-off documented); "disabled item out of tab order" (spec-accepted, axe clean); "Settings test rewritten hidden→active" (AC1 mandates the active item stay visible with `aria-current`); "`as never` activeBuild cast" (accepted test stub; component only reads truthiness); "LEBO→LEBOv2 + banner copy churn" (AC4 mandates these exact strings)._

## Dev Notes

### Scope discipline (read first)
- **Files in scope (3):** `lebo/src/features/layout/AppHeader.tsx`, `lebo/src/App.tsx` (Esc branch only), `lebo/src/features/layout/AppHeader.test.tsx`. No store schema change, no Rust, no data loader, no new component file.
- **No new Zustand store, no React Router** (project-context.md: "No React Router — view switching is `appStore.currentView`"). Navigation is `setCurrentView(...)` exactly as today.
- **Do not touch** `LeftPanel`, `RightPanel`, `CenterCanvas`, `StatusBar`, the center tab bar, or `CenterTab` — those are Stories 2.3–2.8. In particular `CenterTab += 'weaver'` is **Story 2.5**, not here.

### The Complete Build Optimizer ownership boundary (the critical call)
- **Architecture D-P4-5** (`architecture.md:255-268`) models *both* new full-screen views (`'complete-optimizer'`, the existing `'gear-optimization'`) and the `CenterTab += 'weaver'` change together. But **epics.md splits AR-6 across epics**: Epic 2 owns only `CenterTab += 'weaver'` (Story 2.5); **Epic 6 owns `currentView += 'complete-optimizer'` and the Complete Build Optimizer view + routing (Story 6.1 — `6-1-complete-build-optimizer-view-and-routing`).**
- Therefore this story renders the nav item **present-but-inert** and **does not** extend the `currentView` union. Rationale: (1) respects the epic-level ownership split so Epic 6's Story 6.1 remains the single place that lands the view + union + route; (2) avoids a live nav button that routes to a non-existent/blank view (a worse regression than a clearly-disabled "coming soon" item); (3) keeps this story a pure header/nav-chrome change with zero `appStore` surface change.
- **Hand-off contract for Epic 6 (Story 6.1):** remove the `disabled`/`aria-disabled` on the Complete Build Optimizer item, wire `onClick={() => setCurrentView('complete-optimizer')}`, extend the union to `'main' | 'settings' | 'gear-optimization' | 'complete-optimizer'`, and add the always-mounted full-screen view block in `App.tsx` mirroring the `gear-optimization` pattern (`display: currentView === 'complete-optimizer' ? ... : 'none'`). The comment placed in Task 1 marks the exact spot.
- ⚠️ **Open question flagged to Alec at the bottom** — if you'd rather ship the union + a placeholder view now (so the button is live), that's the alternative; the story is written for the inert-item default.

### Source ↔ test reconciliation table (AC4 — the test file is the spec)
`AppHeader.test.tsx` is already written to the *intended* (post-rebuild) strings; the current `AppHeader.tsx` drifted, which is why AppHeader sits in the documented 14-file failing baseline. Make the source match the test (not the reverse):

| Element (testid) | Current source renders | Reconcile to (test expects) |
|---|---|---|
| logo mark (`getByText`) | `LEBO` | `LEBOv2` |
| product subtitle | `Last Epoch Build Optimizer` | `Last Epoch Build Optimizer` *(unchanged)* |
| version available (`update-version-text`) | `{version} available.` | `LEBOv2 {version} is available.` |
| downloading (`download-progress-text`) | `Downloading {progress}%` | `Downloading... {progress}%` |
| ready (`update-ready-text`) | `Ready to restart` | `Update ready. Restart LEBOv2 to apply?` |
| install button (`install-update-button`) | present | present *(unchanged)* |
| restart button (`restart-now-button`) | present | present *(unchanged)* |
| dismiss button (`dismiss-update-button`) | present | present *(unchanged)* |
| error text (`update-error-text`) | `Update failed.` | present *(test only checks the testid exists — keep a sensible string)* |

All update-flow **logic** (`startDownload`, `installAndRestart`, dismiss, status gating) is correct — change **display strings only**.

### Esc handling — why a conditional, not the prototype's unconditional dispatch
The Claude prototype (`app.jsx:275`) does `if (e.key === "Escape") dispatch({ type: "view", value: "main" })` unconditionally. **Our app cannot** copy that verbatim: the existing global `Esc` branch in `App.tsx` (lines ~101-105) also **clears the preview-suggestion rank** and **dispatches `keyboard:escape`** (which collapses the suggestion panel in the Builder). Branch on `currentView`: full-screen → navigate to `main`; `main` → keep the existing preview/collapse behavior. The `Esc` branch sits **before** the input-focus guard (it's "safe globally" per the existing comment) — keep it there so `Esc` works even when a text field is focused inside a full-screen view.

### Current header is already close — this is an extension, not a from-scratch rebuild
`AppHeader.tsx` already implements the prototype's structure: logo (`header-logo` mark+sub), `nav` with active-gold-tint items, online dot, version tag, and the full update banner. The active styling (`color: var(--color-accent-gold)`, `backgroundColor: 'rgba(201,168,76,0.12)'`) already matches `.header-nav-item.active` (`accent-gold` + `accent-gold-tint`). Do **not** rewrite working markup — add the one new item, reorder, reconcile strings, add `aria-current`/focus-ring, and wire the Esc branch.

### Accessibility (NFR-14 / UX-DR12)
- Active nav item: `aria-current="page"` (in addition to the visual gold treatment).
- Every interactive nav `<button>` keeps a **2px solid `--color-accent-gold` focus ring** (never `outline: none` without a replacement). The disabled Complete Build Optimizer item should be non-focusable-as-action (`disabled` removes it from the tab order, which is acceptable for a not-yet-available control) — confirm axe is clean either way.
- Gate any transition/animation behind `prefers-reduced-motion` via the established `useReducedMotion()` hook if you add motion (the existing `transition: background-color/color 120ms` is fine and unobtrusive).
- Run `vitest-axe` on the header; **zero new violations** (note: `AppHeader`/`RightPanel` are in the pre-existing jsdom/Headless-UI baseline — your goal is to not *add* violations and ideally clear AppHeader's).

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate config or duplicate the four `test-setup.ts` stubs (jest-dom, vitest-axe, ResizeObserver, matchMedia).
- Co-located test only: `AppHeader.test.tsx` next to `AppHeader.tsx`. Explicit `expect` assertions, no snapshots.
- Existing test setup pattern to reuse: `const initialState = useAppStore.getState()` then `beforeEach(() => useAppStore.setState({ ...initialState, currentView: 'main' }, true))`. Mocks already present: `useUpdateCheck` (`getPendingUpdate`) and `invokeCommand`. For Gear-Optimization-gating tests, set `useBuildStore` `activeBuild` (import the store; mirror how other tests seed stores).
- The App-level `Esc` behavior is best asserted by rendering `<App/>` (or by unit-testing the handler) and dispatching a `keydown`; if `<App/>` is too heavy, a focused test that mounts the keydown effect is acceptable — assert `useAppStore.getState().currentView` transitions.

### Project Structure Notes
- All three files are inside `LEBOv2/lebo/src` — Phase 2 active tree, write freely. The `_bmad-output/last-epoch-build-optimizer-UI-Handoff/` prototype (`app.jsx`, `styles.css`) is **read-only reference** for layout/strings only — never wire prototype JSX/CSS into the app (ADR-P4-007: faithful recreation, not a wrapper).
- Naming/structure unchanged: `AppHeader.tsx` is a `PascalCase.tsx` component in the `layout/` feature folder; no barrel files; named export only; group imports external → shared → feature-local.

### Out of scope (do NOT touch here)
- `appStore.currentView` union (stays 3 values — Epic 6 extends it). `CenterTab` union (Story 2.5 adds `'weaver'`).
- The Complete Build Optimizer view itself, `run_complete_optimization`, `complete-opt:*` events, `useCompleteOptStream` — all Epic 6.
- Left/right panels, center canvas tab bar, status bar, blessing/idol editors — Stories 2.3–2.8.
- The "Back to Builder" buttons inside Settings / GearOptimizationView (already correct — leave them).

### References
- [Source: epics.md#Story 2.2: Header navigation] — ACs (FR-33), Esc-to-Builder, `appStore.currentView`-driven, no router.
- [Source: epics.md#Epic 2 — Owns] — Epic 2 owns `CenterTab += 'weaver'` only; not the `currentView` extension.
- [Source: epics.md#Epic 6 — Owns] — Epic 6 owns `AR-6 partial (currentView += 'complete-optimizer')`; Story `6-1-complete-build-optimizer-view-and-routing`.
- [Source: architecture.md#ADR-P4-D-P4-5 — View & Tab Topology Expansion (lines 255-268)] — `CurrentView` union, `Esc` returns to `main` from any full-screen view, no React Router.
- [Source: architecture.md#Source-tree (lines 484, 489)] — `AppHeader.tsx` MODIFIED "FR-33 nav: Builder | Complete | Gear Opt | Settings"; `App.tsx` MODIFIED "route 'complete-optimizer'" (the route part is Epic 6; the Esc branch is here).
- [Source: project-context.md#React / Zustand] — "No React Router — view switching is `appStore.currentView: 'main' | 'settings' | 'gear-optimization'`. Never add a router." / "When adding a new view: add it to `appStore.currentView` union type and route in `App.tsx`."
- [Source: project-context.md#Accessibility] — 2px accent-gold focus ring; `prefers-reduced-motion` gating; axe-core CI fails on new violations.
- [Source: lebo/src/features/layout/AppHeader.tsx] — current header markup, `navItems`, update banner, online indicator.
- [Source: lebo/src/features/layout/AppHeader.test.tsx] — the ahead-of-source test spec (logo `LEBOv2`, update strings) AC4 reconciles to.
- [Source: lebo/src/App.tsx:89-171] — global keydown handler; `Esc` branch at ~101-105 to extend.
- [Source: lebo/src/features/settings/Settings.tsx:30 / lebo/src/features/gear-optimization/GearOptimizationView.tsx:46] — existing "Back to Builder" controls (`setCurrentView('main')`) — leave intact.
- [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/app.jsx:332-372, styles.css:352-403] — prototype header/nav structure + `.header-nav-item(.active)` styling and `Esc`→`main` reference.

## Previous Story Intelligence (Story 2.1 — done)

- **Story 2.1** reconciled design tokens **values-only** (`global.css` + `rarityColors.ts`); every component already consumes `--color-*` tokens, so the header is already on-palette — **no token work needed here** (don't re-touch `global.css`).
- **Discipline carried forward (Pattern P4-8):** never hardcode a rarity/damage hex inline; route through `rarityColors.ts`. The header uses `--color-*` vars directly (bg/accent/text) — that's the correct channel; keep it.
- **Baseline-failure literacy:** Story 2.1 documented the standing UI test baseline — `AppHeader`/`RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls` fail in jsdom/Headless-UI/canvas env. AC4/AC5 here specifically **clear AppHeader** from that list by reconciling source to its test spec. Treat "no *new* failures" as the floor and "AppHeader now green" as the target.
- **Process learning from 2.1's review:** the reviewer caught that "Claude Design palette" values came from the *designer mockup*, not the game. No palette work here, but the same caution applies to any *string/label* you invent — prefer the prototype's exact wording (`Complete Build Optimizer`, `Gear Optimization`, `Builder`, `Settings`) and the test spec's exact strings over improvised copy.

## Git Intelligence Summary

- Recent commits are `[AutoSave]` snapshots (no semantic signal); the last semantic work was Story 2.1 (design-token reconciliation) and the Epic 1 stat-engine stories. No header/nav changes are in flight — `AppHeader.tsx` is stable and safe to extend.
- No new dependencies needed: React 19.1, Zustand 5, Tailwind v4, `@testing-library/react`, `vitest-axe` are all already present (project-context.md Tech Stack). This story adds **no** library.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code — BMAD Dev Story workflow)

### Debug Log References

- RED baseline (pre-change): `CI=true pnpm exec vitest run src/features/layout/AppHeader.test.tsx` → 5 failed | 9 passed. The 5 failures were the documented source↔test drift: logo `LEBO`→`LEBOv2`, `update-version-text`, `download-progress-text`, `update-ready-text`, plus the stale `hides Settings button` assertion.
- GREEN: `CI=true pnpm exec vitest run src/features/layout/AppHeader.test.tsx src/App.keyboard.test.tsx` → 24 passed.
- Full suite: `CI=true pnpm exec vitest run` → 9 failed | 1073 passed. The 5 failing files are exactly the documented standing baseline (`RightPanel`, `ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls`); **AppHeader is no longer among them**. No new failures introduced.
- `pnpm exec tsc --noEmit` → exit 0. `pnpm build` → exit 0 (only the pre-existing >500 kB chunk-size advisory).

### Completion Notes List

- **AC1** — `navItems` reordered to FR-33 (Builder | Complete Build Optimizer | Gear Optimization | Settings). Active item keeps the gold-on-`rgba(201,168,76,0.12)` treatment; inactive `--color-text-secondary`; added hover (`--color-text-primary` / `--color-bg-elevated`) on inactive items via Tailwind arbitrary-var utilities. Gear Optimization keeps its `requiresBuild` gate; logo/update-banner/online-indicator/right cluster preserved.
- **AC2** — `App.tsx` Esc branch now navigates to `'main'` first when `currentView !== 'main'`, before the existing preview-clear + `keyboard:escape` dispatch. In `'main'` the original behavior is untouched. Branch still sits ahead of the input-focus guard so Esc works from focused fields in full-screen views. "Back to Builder" controls in Settings/GearOptimizationView left intact.
- **AC3** — Complete Build Optimizer rendered present-but-inert: `disabled` + `aria-disabled="true"` + muted `--color-text-muted` + `title="Coming soon"` + `cursor: not-allowed`, no `onClick`. `appStore.currentView` union deliberately **not** extended (stays `'main' | 'settings' | 'gear-optimization'`). One-line hand-off comment placed at the nav-item site for Epic 6 / Story 6.1.
- **AC4** — Source reconciled to the ahead-of-source test spec: logo `LEBOv2`; `LEBOv2 {version} is available.`; `Downloading... {progress}%`; `Update ready. Restart LEBOv2 to apply?`. Subtitle `Last Epoch Build Optimizer` retained; all update-flow logic/testids unchanged. AppHeader moved from the failing baseline to fully passing.
- **AC5** — Added nav/a11y tests in `AppHeader.test.tsx` (FR-33 order, inert disabled item + no-op click, Builder/Gear-Opt/Settings navigation, `aria-current="page"`, Gear-Opt gating, `vitest-axe` clean) and `App.keyboard.test.tsx` (Esc from settings → main, from gear-optimization → main, and Esc in main does not navigate). Focus ring is supplied by the global `:focus-visible` rule (`global.css`); reduced-motion is globally gated.
- **Design reconciliation note:** the pre-existing `hides Settings button when currentView is "settings"` test encoded obsolete hide-on-active behavior that contradicts AC1 (active item stays visible + `aria-current`). It was a standing baseline failure (the old source never hid it), so it was updated to assert the AC1 behavior — not weakened.
- **Open question for Alec (unchanged default taken):** shipped the inert nav-item default per the story. If you'd prefer the button live now, that requires landing Epic 6's `currentView += 'complete-optimizer'` + a placeholder view early — flagged but not done here.

### File List

- `lebo/src/features/layout/AppHeader.tsx` — MODIFIED (FR-33 reorder; inert Complete Build Optimizer item; `renderNavButton` helper with `aria-current` + hover; logo + update-banner string reconciliation; per-item `data-testid`s)
- `lebo/src/App.tsx` — MODIFIED (Esc branch: navigate to `'main'` from any full-screen view before existing preview-clear/`keyboard:escape` behavior)
- `lebo/src/features/layout/AppHeader.test.tsx` — MODIFIED (added FR-33 nav, inert-item, navigation, `aria-current`, gear-gating, and axe tests; updated stale `hides Settings` test to AC1 behavior)
- `lebo/src/App.keyboard.test.tsx` — ADDED (App-level Esc-from-full-screen navigation tests)

## Change Log

- 2026-06-04 — Story 2.2 implemented: FR-33 header nav (4 items in order, inert Complete Build Optimizer per Epic 6 ownership boundary), global `Esc`→Builder from full-screen views, accessibility (`aria-current`, focus ring), and AppHeader source↔test reconciliation (logo + update-banner strings). AppHeader cleared from the documented UI test baseline. tsc/build green; no new suite failures. (claude-opus-4-8)
