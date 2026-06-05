# Story 2.5: Center canvas six-tab bar with Weaver

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a six-tab center canvas bar with a divider and keyboard shortcuts,
so that I can switch between the tree and context editors quickly, with the Weaver tree promoted to a first-class canvas tab beside the Passive tree.

This is the **fifth story of Epic 2 (UI/UX Revamp)**, continuing the same discipline as Stories 2.2/2.3/2.4: the plumbing already exists and is wired correctly — `CenterCanvas.tsx` already renders the five-tab bar, drives `appStore.centerTab`, and keeps `SkillTreeView` always-mounted (shown/hidden via `display`). This story is the **AR-6 (partial) union expansion + center-bar reconciliation**, not a from-scratch rebuild. The concrete deltas are:

1. **Extend the `CenterTab` union with `'weaver'` (AR-6):** `type CenterTab = 'tree' | 'weaver' | 'gear' | 'skill' | 'idol' | 'blessing'`. The Passive tree (`'tree'`) and the Weaver tree (`'weaver'`) become the **two canvas tabs**; both keep the always-mounted `SkillTreeView` visible (preserving the WebGL context). The per-skill specialization trees (the internal `SkillTreeTabBar` slots) are **untouched** here — relocating them into the Skills tab editor is FR-43 / Epic 5, explicitly out of scope.
2. **Six-tab bar with a divider (FR-36):** the center bar shows **Passive Tree | Weaver ┊ Gear | Skills | Idols | Blessings** with badge counts and a **visual divider** separating the two tree tabs (`tree`, `weaver`) from the four context tabs (`gear`, `skill`, `idol`, `blessing`). `'tree'` is relabelled **"Passive Tree"**; the new **"Weaver"** tab badge shows total allocated weaver points.
3. **Keyboard shortcuts 1–6 (FR-36):** the App-level keydown handler maps `1→tree, 2→weaver, 3→gear, 4→skill, 5→idol, 6→blessing` (was `1–5`).
4. **`safeCenterTab` guard (AR-6 partial):** an out-of-range / invalid `centerTab` value falls back to `'tree'` — the same "guard the index" discipline `SkillTreeView`'s existing `safeTabIndex` uses for the internal 7-tab bar.
5. **Center Weaver tab actually shows the Weaver tree (functional coupling):** selecting the center **Weaver** tab shows the weaver canvas; selecting **Passive Tree** shows the passive/skill canvas. This is a thin, loop-safe sync between `centerTab` and `SkillTreeView`'s existing internal `activeTabIndex` — **not** a restructure of `SkillTreeView` or `SkillTreeTabBar`.
6. **Mandatory compile ripple — `buildSectionStatus.ts` (AR-6):** `getSectionStatus()` returns an **exhaustive** `Record<CenterTab, SectionStatus>`. Adding `'weaver'` to the union makes the current object literal non-exhaustive → `tsc` error. A `weaver` entry **must** be added to both branches (no-build + with-build).
7. **LeftPanel Weaver nav row (FR-34 consistency — explicitly deferred here by Story 2.3):** Story 2.3's completion note records *"Scope boundary: CenterTab union unchanged — no Weaver row (Story 2.5)"*, deferring the navigator's Weaver row to this story. Add the **Weaver** row to `LeftPanel`'s `NAV_ROWS` and relabel its `tree` row to **"Passive Tree"** so the left-panel section navigator and the center tab bar stay consistent.
8. **Tests:** new `CenterCanvas.test.tsx` (tab order, divider, badges, weaver→canvas, `safeCenterTab` fallback, axe); `App.keyboard.test.tsx` extended for the `1–6` mapping; `buildSectionStatus.test.ts` weaver entry; `LeftPanel.test.tsx` reconciled to the new row count/label. **No new test failures vs the standing baseline** (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`).

**Scope boundary (read this first — same discipline as Stories 2.2 / 2.3 / 2.4):**
- **Do NOT restructure `SkillTreeView` or `SkillTreeTabBar`.** The internal 7-tab bar (Passive, slots 0–4, Weaver) and all node-interaction / hook-ordering / WebGL logic stay exactly as today. The only change to `SkillTreeView` is a thin `centerTab ⟷ activeTabIndex` sync (Task 4). Moving the per-skill trees into the Skills tab is **FR-43 / Epic 5 (Story 5.3)** — not here.
- **Do NOT touch the PixiJS canvas, `pixiRenderer.ts`, the WebGL patch, `useSkillTree`, or any tree/node behavior.** This is navigation chrome only.
- **Do NOT change `GearTab` / `SkillTab` / `IdolTab` / `BlessingTab` internals**, the stat sheet, the optimizer, gear, idols, or blessings content. The center bar only switches which already-existing tab content shows.
- **Do NOT add a Zustand store, React Router, or any new dependency.** Extend the existing `appStore` union and `setCenterTab` action only.
- **Do NOT change `RightPanel`, `AppHeader`, `StatusBar`**, or any store schema/type beyond the `CenterTab` union string addition.

## Acceptance Criteria

**AC1 — `CenterTab` union extended with `'weaver'`; invalid values guard to `'tree'` (FR-36, AR-6)**
- **Given** `appStore`,
- **When** the `CenterTab` type is read,
- **Then** it is `'tree' | 'weaver' | 'gear' | 'skill' | 'idol' | 'blessing'` (the `'weaver'` member added between `'tree'` and `'gear'`), `setCenterTab(tab: CenterTab)` is unchanged, and the store default stays `centerTab: 'tree'`,
- **And** `CenterCanvas` derives a **`safeCenterTab`**: if `centerTab` is not one of the six valid ids it falls back to `'tree'` (mirroring `SkillTreeView`'s `safeTabIndex` discipline), and all render/active-state/content-switch logic reads `safeCenterTab`, never a raw unguarded value.

**AC2 — Six-tab bar in order, with the tree/context divider and badge counts (FR-36)**
- **Given** the center canvas,
- **When** the tab bar renders,
- **Then** it shows exactly six tabs left-to-right: **Passive Tree** (`tree`), **Weaver** (`weaver`), **Gear** (`gear`), **Skills** (`skill`), **Idols** (`idol`), **Blessings** (`blessing`),
- **And** a **visual divider** (the existing 1px `--color-bg-elevated` separator) sits **between Weaver and Gear**, separating the two tree tabs from the four context tabs (the existing `dividerBefore` on `gear` is preserved; no divider before `weaver`),
- **And** each tab shows its badge: Passive Tree = total passive points (`Σ nodeAllocations`), **Weaver = total weaver points (`Σ weaverAllocations`)**, Gear = `{filled}/11`, Skills = `{filled}/5`, Idols = `{count}`, Blessings = `{filled}/5` (existing badge logic preserved; the Weaver badge is the only new one and reads the existing `activeBuild.weaverAllocations`),
- **And** the active tab uses the existing gold active-state styling, all colors resolve through `--color-*` tokens (no inline hex — Pattern P4-8), and the bar stays within its existing 40px height / `--color-bg-surface` chrome.

**AC3 — The active center tab routes to the correct content; both tree tabs keep `SkillTreeView` mounted (FR-36)**
- **Given** the tab content area,
- **When** `safeCenterTab` is `'tree'` **or** `'weaver'`,
- **Then** the always-mounted `SkillTreeView` container is **shown** (`display: 'block'`) and is **never unmounted** when switching between `tree`, `weaver`, and the context tabs — preserving the PixiJS WebGL context (per project rule: `SkillTreeView` is shown/hidden, never unmounted),
- **And** when `safeCenterTab` is `'gear' | 'skill' | 'idol' | 'blessing'`, the `SkillTreeView` container is hidden (`display: 'none'`) and the matching `GearTab` / `SkillTab` / `IdolTab` / `BlessingTab` renders exactly as today,
- **And** `DataStalenessBar` continues to render between the tab bar and the content area (unchanged).

**AC4 — Selecting the Weaver center tab shows the Weaver tree; selecting Passive Tree shows the passive/skill canvas (FR-36, AR-6)**
- **Given** an active build on the Builder view,
- **When** the user activates the center **Weaver** tab (click or key `2`),
- **Then** `SkillTreeView` displays the **weaver** tree (its existing weaver branch — `WeaverTreePlaceholder` until `weaverTreeData` loads, else the weaver canvas), driven by `SkillTreeView`'s existing internal `activeTabIndex === 6` weaver path,
- **And when** the user activates the center **Passive Tree** tab (click or key `1`) while the weaver tree is showing, `SkillTreeView` returns to the passive/skill canvas (internal `activeTabIndex` leaves index 6),
- **And** the internal `SkillTreeTabBar` (Passive + 5 skill slots + Weaver) **remains functional and untouched** — selecting its Weaver sub-tab keeps the center Weaver tab in sync, and selecting a non-weaver sub-tab keeps the center on Passive Tree; the sync is **loop-safe** (no setState/effect cycle) and adds **no** second source of truth for "which tree renders" (the internal `activeTabIndex` stays authoritative for the canvas; `centerTab` mirrors only the coarse passive-vs-weaver state).

**AC5 — Keyboard shortcuts 1–6 switch tabs (FR-36)**
- **Given** the Builder (`currentView === 'main'`) with no text input focused,
- **When** the user presses **1 / 2 / 3 / 4 / 5 / 6**,
- **Then** the App keydown handler calls `setCenterTab('tree' / 'weaver' / 'gear' / 'skill' / 'idol' / 'blessing')` respectively (the `2–5` mapping shifts to make room for `weaver` at `2`; `6` is newly handled),
- **And** all existing guards are preserved exactly: skipped when typing in an input/textarea/contenteditable, skipped in the `settings` view, skipped when `ctrl/meta/alt` is held, and `e.preventDefault()` is called before each `setCenterTab`. The `[`/`]` panel-collapse and `o`/`i` focus shortcuts are unchanged.

**AC6 — `getSectionStatus` returns a `weaver` entry (compile-required ripple) (AR-6)**
- **Given** `shared/utils/buildSectionStatus.ts`,
- **When** the `CenterTab` union gains `'weaver'`,
- **Then** `getSectionStatus(build): Record<CenterTab, SectionStatus>` is updated so **both** branches (no-build and with-build) include a `weaver` entry, keeping the `Record<CenterTab, …>` exhaustive (otherwise `tsc` fails),
- **And** the weaver entry follows the existing shape: `count` = `"{Σ weaverAllocations} pts"`, `full: false`, and `done` = `weaverPoints >= 1` (Weaver is opt-in/optional per FR-21 "Weaver — unchecked"; a non-zero allocation marks the section as touched — this predicate is the single source Epic 6's CompletenessGate will reuse, matching the "Weaver budget > 0" gate),
- **And** no other field/shape in `SectionStatus` changes, and the existing `tree`/`gear`/`skill`/`idol`/`blessing` entries are byte-for-byte unchanged.

**AC7 — LeftPanel navigator gains the Weaver row and the Passive Tree label (FR-34 consistency; deferred here by Story 2.3)**
- **Given** `LeftPanel.tsx`'s section navigator (`NAV_ROWS`),
- **When** it renders (expanded and collapsed rail),
- **Then** it includes a **Weaver** row (`{ id: 'weaver', label: 'Weaver' }`) positioned **after Passive Tree and before Gear**, and the existing `tree` row is relabelled from **"Skill Trees"** to **"Passive Tree"** so the navigator matches the center tab bar,
- **And** the Weaver row drives `setCenterTab('weaver')` and reflects the active state when `centerTab === 'weaver'`, reuses the existing `getSectionStatus(...).weaver` count/`done` checkmark wiring (no new status logic), and keeps the existing per-row layout, gold checkmark (`CheckGlyph`), and collapsed-rail glyph treatment,
- **And** no other LeftPanel section (build identity, class glyph, mastery selector, saved builds, import) changes.

**AC8 — Tested; accessibility holds; build green; no new baseline failures (NFR-14, UX-DR12)**
- **Given** the rebuilt center bar + navigator,
- **When** tests run,
- **Then** a **new** `CenterCanvas.test.tsx` covers: the six tabs render in order with the divider between Weaver and Gear; the Weaver badge shows `Σ weaverAllocations` (and `0` with no build); clicking each tab calls `setCenterTab` with the right id; with `centerTab === 'weaver'` the `SkillTreeView` container is shown (`display: block`) and no context tab renders; with `centerTab === 'gear'` the context tab renders and `SkillTreeView` is `display: none`; an invalid `centerTab` falls back to `'tree'` rendering; and `expect(await axe(container)).toHaveNoViolations()`,
- **And** `App.keyboard.test.tsx` is extended to assert keys `1–6` map to `tree/weaver/gear/skill/idol/blessing` and that the guards (input focus, settings view, modifier held) still suppress the shortcut,
- **And** `buildSectionStatus.test.ts` (create if absent) asserts the `weaver` entry shape for build / no-build at the boundary (`0 pts`→`done:false`, `≥1`→`done:true`), and `LeftPanel.test.tsx` is reconciled to the new row count/order and the "Passive Tree" label (any prior assertion of exactly 5 nav rows or the "Skill Trees" label is updated),
- **And** every interactive tab/row keeps the **2px solid `--color-accent-gold` focus ring** (global `:focus-visible`), no animation is added that isn't `prefers-reduced-motion`-gated, `pnpm exec tsc --noEmit` exits 0 (watch `noUnusedLocals`/`noUnusedParameters`), `CI=true pnpm exec vitest run` shows **no new failures** vs the standing baseline (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`), and `pnpm build` exits 0.

## Source Audit

**Not applicable — this story introduces, computes, and surfaces NO new stat.** It is center-canvas **navigation chrome + a `CenterTab` union string addition** only: a sixth tab, a divider, keyboard `1–6`, a `safeCenterTab` guard, a thin `centerTab ⟷ activeTabIndex` sync, a left-panel nav row, and a compile-required `weaver` entry in an existing section-status map. It touches **no** game-data loader, **no** `scoring-core` / `compute/*` module, **no** new `StatKey`, **no** new `StatSheet` field, and **no** new displayed numeric **stat**.

The only number this story newly *displays* is the **Weaver tab/nav badge**, which is the **sum of an existing build field** — `activeBuild.weaverAllocations` (`Record<string, number>`, written by the existing `applyWeaverNodeChange` store action and already summed in `SkillTreeView` for the unspent-points counter). It is a UI re-presentation of already-allocated points, not a stat: there is **no new StatKey**, nothing is fed to `compute_stats` (per `buildSnapshotSerializer.ts:130`, `weaverAllocations` is intentionally excluded from the snapshot — Epic 4), and there is no produce-without-consume dead key.

The SOURCE-AUDIT GUARDRAIL's "map each new stat to real shipped-data, or declare honest-`0.0` with no dead `StatKey`" requirement is satisfied by this explicit **no-new-stat / no-dead-key** declaration, and the guardrail's "value + element/type assertion test" requirement (which targets prose/tag stat parsing) **does not apply**. The relevant verification here is **component-behavior + accessibility assertion tests** (AC8).

## Tasks / Subtasks

- [x] **Task 1 — Extend the `CenterTab` union (AC: 1)** — `lebo/src/shared/stores/appStore.ts`
  - [x] Change `export type CenterTab = 'tree' | 'gear' | 'skill' | 'idol' | 'blessing'` → `'tree' | 'weaver' | 'gear' | 'skill' | 'idol' | 'blessing'` (insert `'weaver'` between `'tree'` and `'gear'`).
  - [x] Leave `setCenterTab`, the `centerTab: 'tree'` default, and all other store fields/actions unchanged. (No persist middleware exists, so no migration needed.)

- [x] **Task 2 — Six-tab bar + divider + Weaver badge + `safeCenterTab` (AC: 1, 2, 3)** — `lebo/src/features/layout/CenterCanvas.tsx`
  - [x] Add a `weaver` entry to the `TABS` array between `tree` and `gear`: `{ id: 'weaver', label: 'Weaver', getBadge: (b) => b ? String(Object.values(b.weaverAllocations).reduce((s, v) => s + v, 0)) : '0' }`. Keep `dividerBefore: true` on `gear` (the divider now correctly sits between Weaver and the context tabs). Relabel the `tree` entry to **"Passive Tree"**.
  - [x] Add a module-level `const CENTER_TAB_IDS = new Set<CenterTab>(['tree','weaver','gear','skill','idol','blessing'])` (derived from `TABS`) and a `safeCenterTab = CENTER_TAB_IDS.has(centerTab) ? centerTab : 'tree'`. Use `safeCenterTab` for the active-state comparison and the content switch.
  - [x] Content switch: show the `SkillTreeView` container when `safeCenterTab === 'tree' || safeCenterTab === 'weaver'` (`display: 'block'`, else `'none'`); render `GearTab`/`SkillTab`/`IdolTab`/`BlessingTab` for their respective `safeCenterTab` values. Do **not** unmount `SkillTreeView`.
  - [x] Tokens only; preserve the existing 40px bar / active-gold styling / badge pill markup.

- [x] **Task 3 — Keyboard 1–6 (AC: 5)** — `lebo/src/App.tsx`
  - [x] Remap the center-tab number shortcuts to: `1→'tree'`, `2→'weaver'`, `3→'gear'`, `4→'skill'`, `5→'idol'`, `6→'blessing'`. Add the new `6` case. Keep `e.preventDefault()` + `return` per branch and the surrounding guards (input-focus skip, `settings`-view skip, `ctrl/meta/alt` skip) untouched. Do not change `[`/`]`/`o`/`i`.

- [x] **Task 4 — Center Weaver ⟷ SkillTreeView sync (AC: 4)** — `lebo/src/features/skill-tree/SkillTreeView.tsx`
  - [x] Read `centerTab` from `appStore` and `setCenterTab`. Add a loop-safe sync so the center Weaver tab drives the canvas:
    - **Effect (centerTab → index):** when `centerTab === 'weaver'` and `activeTabIndex !== 6` → `setActiveTabIndex(6)`; when `centerTab === 'tree'` and `activeTabIndex === 6` → `setActiveTabIndex(0)`. Depend on `[centerTab]` (and the setter). When `centerTab` is a context tab (`gear`/`skill`/`idol`/`blessing`) the effect is a no-op (preserve the internal index while hidden).
    - **In `handleTabChange(index)`:** when the user selects internal index `6` → also `setCenterTab('weaver')`; when they select a non-`6` index while `centerTab === 'weaver'` → `setCenterTab('tree')` (read live via `useAppStore.getState()` to avoid dep churn). (User clicks only — `setActiveTabIndex` from the effect does not call `handleTabChange`, so there is no cycle.)
  - [x] Keep `safeTabIndex`, `isWeaverTab = safeTabIndex === 6`, all hooks-before-early-return ordering, and every existing branch **exactly as-is**. Do not change `SkillTreeTabBar`, the weaver canvas branch, or any node logic. (`noUnusedLocals` clean — both store reads are used.)
  - [x] Verify the StrictMode double-mount / `initChainRef` WebGL serialization is unaffected (no new `Application.init` path is introduced — only an existing state value is nudged).

- [x] **Task 5 — `buildSectionStatus.ts` weaver entry (compile-required) (AC: 6)** — `lebo/src/shared/utils/buildSectionStatus.ts`
  - [x] Add a `weaverPoints(build)` helper (`Σ build.weaverAllocations`) mirroring `passivePoints`.
  - [x] Add a `weaver` entry to **both** returned objects: no-build → `{ count: '0 pts', full: false, done: false }`; with-build → `{ count: `${weaver} pts`, full: false, done: weaver >= 1 }`. Positioned after `tree`. Leave all other entries unchanged.

- [x] **Task 6 — LeftPanel Weaver nav row + Passive Tree label (AC: 7)** — `lebo/src/features/layout/LeftPanel.tsx`
  - [x] In `NAV_ROWS`, relabel `{ id: 'tree', label: 'Skill Trees' }` → `{ id: 'tree', label: 'Passive Tree' }` and insert `{ id: 'weaver', label: 'Weaver' }` immediately after it (before `gear`).
  - [x] No other change: the row renders through the existing `.map` over `NAV_ROWS` using `getSectionStatus(activeBuild)[row.id]` (now includes `weaver`), the existing `CheckGlyph`, active-state, and collapsed-rail treatment. Both the expanded list and the collapsed rail iterate `NAV_ROWS`; a distinct collapsed-rail glyph (`✷`) was added for the weaver row.

- [x] **Task 7 — Tests + a11y (AC: 8)**
  - [x] **New `lebo/src/features/layout/CenterCanvas.test.tsx`:** seeded `useBuildStore`/`useAppStore`; asserts the six tab labels in order; the divider sits as the Gear wrapper's first child (none before Weaver); Weaver badge = `Σ weaverAllocations` (`{a:2,b:1}`→`3`; `0` with no build); clicking each tab sets `centerTab` to the right id; `centerTab:'weaver'` shows the `SkillTreeView` container (`display: block`) with no context tab; `centerTab:'gear'` renders `GearTab` with the tree container `display: none`; an invalid `centerTab` falls back to `tree`; `axe` clean. `SkillTreeView` + the four tabs + `DataStalenessBar` are mocked to lightweight stubs.
  - [x] **Extended `lebo/src/App.keyboard.test.tsx`:** new block dispatching `keydown` `1`–`6` → `tree/weaver/gear/skill/idol/blessing`; plus a guard assertion (key `2` in `settings` view leaves `centerTab` unchanged). Reuses the existing mocks/`act()` pattern.
  - [x] **`buildSectionStatus.test.ts`** (created, co-located in `shared/utils/`): `getSectionStatus(null).weaver` = `{ count: '0 pts', full: false, done: false }`; `weaverAllocations: {}` → `done: false`; `{ x: 1 }` → `count: '1 pts', done: true`; sum across nodes; `tree` entry unchanged.
  - [x] **Reconciled `lebo/src/features/layout/LeftPanel.test.tsx`:** nav-row count 5→6, "Skill Trees" → "Passive Tree", duplicate "0 pts" handled via `getAllByText` (tree + weaver), and a Weaver-row routing test (`setCenterTab('weaver')`).
  - [x] Confirmed no other test hardcodes the 5-tab center bar, the `1–5` mapping, or `getSectionStatus` exhaustiveness in a breaking way (grepped `setCenterTab`, `'Skill Trees'`, `NAV_ROWS`, `getSectionStatus`).

- [x] **Task 8 — Verify build + suite (AC: 8)**
  - [x] `pnpm exec tsc --noEmit` → exit 0 (the `getSectionStatus` exhaustiveness gate satisfied; no unused imports).
  - [x] `CI=true pnpm exec vitest run src/features/layout/CenterCanvas.test.tsx src/App.keyboard.test.tsx src/features/layout/LeftPanel.test.tsx src/shared/utils/buildSectionStatus.test.ts` → 37 passed.
  - [x] `CI=true pnpm exec vitest run` → 1119 passed, 8 failed across exactly the standing baseline files (`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`); no new failures.
  - [x] `pnpm build` → exit 0 (only the pre-existing >500 kB chunk-size advisory).

## Dev Notes

### This is a navigation-chrome + union-expansion story — extend, don't rewrite
`CenterCanvas.tsx` already renders the tab bar, drives `appStore.centerTab`, keeps `SkillTreeView` always-mounted (`display` toggled, never unmounted), and renders the four context tabs conditionally. The five deltas are: (1) `'weaver'` in the union, (2) a sixth tab + relabel + Weaver badge, (3) keyboard `6` + the `2–5` shift, (4) the thin `centerTab ⟷ activeTabIndex` sync in `SkillTreeView`, (5) the compile-forced `buildSectionStatus` weaver entry + the LeftPanel row 2.3 deferred here. Mirror 2.2/2.3/2.4: keep the composition and wiring, apply targeted deltas. [Source: lebo/src/features/layout/CenterCanvas.tsx; project-context.md#Center canvas tabs]

### The architecture is explicit: passive + weaver are the two canvas tabs; skills relocate LATER
Architecture AR-6 / the design rationale (architecture.md:268) states: *"Per-skill specialization trees (the old `SkillTreeTabBar` slots 1–5) are accessed inside the Skill tab's editor (FR-43), not as top-level center tabs; the passive and weaver trees are the two canvas tabs."* The **slot relocation is FR-43 / Epic 5 (Story 5.3 `skills-tab-full-picker`)** — **do NOT** attempt it here. For Story 2.5 the internal `SkillTreeTabBar` stays intact (it still owns Passive + the 5 skill slots + Weaver), so the skill specialization trees remain reachable. The center Weaver tab is wired to the canvas via the existing internal `activeTabIndex === 6` weaver path — a nudge, not a restructure. [Source: architecture.md:160 (AR-6), :263-268; epics.md#Story 2.5; epics.md FR-43 mapping]

### Why the `centerTab ⟷ activeTabIndex` sync is loop-safe and single-source
The canvas already has one authoritative selector for *which tree renders*: `SkillTreeView`'s internal `activeTabIndex` (`safeTabIndex`, `isWeaverTab = safeTabIndex === 6`). Do **not** add a second source of truth. `centerTab` only mirrors the **coarse** passive-vs-weaver state. The effect pushes `centerTab → index` (weaver↔6, tree↔leave-6); the user-click handler pushes `index → centerTab`. Because `setActiveTabIndex` from the effect does **not** call `handleTabChange`, and `handleTabChange` only fires on real user clicks, there is no setState cycle. This is the same single-source discipline 2.3 used for `buildSectionStatus.ts` and 2.4 used for `getArchetypeZone` — keep one authority, sync the mirror. [Source: lebo/src/features/skill-tree/SkillTreeView.tsx:112,124-134,256-258,401-406; project-context.md#Skill/tab rules]

### The union change is a compile gate, not optional — `getSectionStatus` is an exhaustive Record
`getSectionStatus(build): Record<CenterTab, SectionStatus>` (buildSectionStatus.ts:34) returns object literals keyed by every `CenterTab`. Adding `'weaver'` makes those literals non-exhaustive and **`tsc` will fail** until a `weaver` entry exists in both branches. This is the highest-priority ripple — implement Task 5 alongside Task 1. The same file is consumed by `LeftPanel` for the navigator checkmarks (FR-21 single-source predicate that Epic 6's CompletenessGate reuses), so the `done` predicate matters: use `weaverPoints >= 1` to match the "Weaver budget > 0" gate (epics.md:987). [Source: lebo/src/shared/utils/buildSectionStatus.ts:34-58; epics.md:971,987]

### LeftPanel Weaver row was explicitly deferred to THIS story by 2.3
Story 2.3's completion note records the scope boundary *"CenterTab union unchanged — no Weaver row (Story 2.5)"* — i.e., 2.3 deliberately left the union and the navigator's Weaver row for 2.5. Honor that: add the `{ id: 'weaver', label: 'Weaver' }` nav row and relabel `tree` → "Passive Tree" so the left-panel navigator (FR-34) and the center bar (FR-36) read consistently. `LeftPanel` already iterates `NAV_ROWS` and pulls `getSectionStatus(...)[row.id]`, so once Task 5 adds the `weaver` status the row needs no new wiring. Reconcile `LeftPanel.test.tsx` for the new row count/label. [Source: sprint-status.yaml (2.3 done note); lebo/src/features/layout/LeftPanel.tsx:12-18,49; lebo/src/features/layout/LeftPanel.test.tsx]

### Weaver badge reads an existing field — no new stat, no snapshot change
The Weaver badge is `Σ activeBuild.weaverAllocations` — the same sum `SkillTreeView` already computes for the unspent-weaver counter (`allocatedWeaverPoints`). `weaverAllocations` is written only by `applyWeaverNodeChange` (never via `set()`), keys with value 0 are deleted (read with `?? 0`), and it is **intentionally excluded from the build snapshot** sent to Rust (`buildSnapshotSerializer.ts:130` — weaver scoring is a later epic). So this story adds **no** stat, no `compute_stats` input, and no dead key. [Source: lebo/src/features/skill-tree/SkillTreeView.tsx:378; lebo/src/shared/utils/buildSnapshotSerializer.ts:130; project-context.md#Multi-tree architecture]

### Accessibility (NFR-14 / UX-DR12)
- Tabs/rows are `<button>`s — keep them keyboard-operable with the global **2px solid `--color-accent-gold` focus ring** (`:focus-visible`); never `outline: none` without a replacement.
- The badge pills are decorative text; the tab label carries meaning. No `aria-hidden` gymnastics needed beyond what exists.
- Add **no** new animation. The active-state `transition` already present is fine; if you add any, gate it behind `prefers-reduced-motion`.
- Run `vitest-axe` on the rendered `CenterCanvas` and the reconciled `LeftPanel`; **zero new violations**.

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate config or re-stub the four `test-setup.ts` polyfills (jest-dom, vitest-axe, ResizeObserver, matchMedia).
- `CenterCanvas.test.tsx` must **mock `SkillTreeView` and the four tab components** — `SkillTreeView`/`SkillTreeCanvas` are not unit-testable with real WebGL in jsdom. A `vi.mock(...)` returning a `<div data-testid="skill-tree-view">` (and similar for the tabs) lets you assert routing/`display` without PixiJS. Follow the mocking style already used in the layout tests.
- Co-located tests only; explicit `expect`, no snapshots. Keep the existing store-seed/restore `beforeEach` in the tests you extend.
- The one piece of real logic worth a focused unit test is `getSectionStatus(...).weaver` at the `0`/`1` boundary — assert it directly (cheap, like 2.4's `getArchetypeZone` boundary test).

### Project Structure Notes
- All source is inside `LEBOv2/lebo/src` — Phase 2 active tree, write freely. Naming holds: `CenterCanvas.tsx`/`LeftPanel.tsx` are `PascalCase.tsx`; `buildSectionStatus.ts` is `camelCase.ts` in `shared/utils/`; no barrel files; named exports only; group imports external → shared → feature-local.
- **Phase boundary:** never write to `_bmad-output/` (Phase 1 / handoff artifacts) — read-only context. (The `sprint-status.yaml` + story files under `_bmad-output/implementation-artifacts/` are the exception this workflow itself writes.)
- The center tab bar (FR-36) and the left-panel navigator (FR-34) both consume `CenterTab`. They are the only two `CenterTab` consumers besides `buildSectionStatus.ts`. There is no React Router — `centerTab` is the sole tab-routing mechanism (project-context.md#React/Zustand).

### Out of scope (do NOT touch here)
- The per-skill specialization trees / `SkillTreeTabBar` restructure or moving slots into the Skills tab editor (**FR-43 / Epic 5 — Story 5.3**).
- The PixiJS canvas, `pixiRenderer.ts`, the WebGL patch, `useSkillTree`, any node interaction, or the weaver canvas rendering itself.
- `GearTab`/`SkillTab`/`IdolTab`/`BlessingTab` internals, the stat sheet, the optimizer, gear, idols, blessings content (Epics 1/3/4 and other Epic 2 stories).
- `RightPanel` (2.4), `AppHeader` (2.2), `StatusBar` (2.8), and any store schema/type change beyond the `CenterTab` union string addition.
- Any new store, dependency, Rust/IPC change, or React Router.

### References
- [Source: epics.md#Story 2.5: Center canvas six-tab bar with Weaver] — ACs (FR-36): Passive Tree | Weaver | Gear | Skills | Idols | Blessings, divider between tree and context tabs, keys 1–6, `CenterTab += 'weaver'`, `safeTabIndex` guard, `SkillTreeView` preserved (shown/hidden, never unmounted).
- [Source: epics.md:94 (FR-36)] — center canvas tab bar, badge counts, visual divider, keyboard shortcuts 1–6.
- [Source: architecture.md:160 (AR-6 / D-P4-5)] — extend `CenterTab += 'weaver'` (keys 1–6, divider after Weaver); no React Router.
- [Source: architecture.md:263-268] — `type CenterTab = 'tree' | 'weaver' | 'gear' | 'skill' | 'idol' | 'blessing'`; divider separates `{tree, weaver}` from `{gear, skill, idol, blessing}`; rationale: passive + weaver are the two canvas tabs, per-skill trees relocate to the Skills editor under FR-43.
- [Source: architecture.md:487] — `CenterCanvas.tsx MODIFIED FR-36 six-tab bar w/ divider, keys 1–6`.
- [Source: architecture.md:448] — `appStore.ts EXTENDED CenterTab += 'weaver'`.
- [Source: epics.md:971,987] — FR-21/FR-22 Weaver is opt-in (unchecked by default); completeness gate "Weaver budget > 0" (informs the `getSectionStatus().weaver.done` predicate; the gate itself is Epic 6).
- [Source: project-context.md#Center canvas tabs] — `CenterTab` routing, keys switch tabs, `setCenterTab()` action, `SkillTreeView` always mounted (shown/hidden via `display`, never unmounted to preserve WebGL).
- [Source: project-context.md#Skill/tab rules] — `safeTabIndex` guards out-of-range; weaver is internal tab index 6; all hooks called unconditionally before any early return.
- [Source: project-context.md#React / Zustand] — four stores only; no React Router; consume existing store actions, never `set()` directly.
- [Source: project-context.md#Multi-tree architecture] — `weaverAllocations` written only by `applyWeaverNodeChange`; zero-value keys deleted; read with `?? 0`.
- [Source: lebo/src/shared/stores/appStore.ts:4,15,28,45,58] — `CenterTab` type, `centerTab` state, `setCenterTab` action, default.
- [Source: lebo/src/features/layout/CenterCanvas.tsx] — `TABS` array, `dividerBefore`, badge logic, always-mounted `SkillTreeView` + conditional context tabs.
- [Source: lebo/src/App.tsx:149-154] — current `1–5` center-tab keyboard mapping + the input/settings/modifier guards to preserve.
- [Source: lebo/src/features/skill-tree/SkillTreeView.tsx:112,124-134,256-260,401-406] — internal `activeTabIndex`, `safeTabIndex` guard, `isWeaverTab`, `handleTabChange` (the sync seam).
- [Source: lebo/src/shared/utils/buildSectionStatus.ts:34-58] — exhaustive `Record<CenterTab, SectionStatus>` (compile-forced weaver entry).
- [Source: lebo/src/features/layout/LeftPanel.tsx:12-18] — `NAV_ROWS` (add Weaver row, relabel `tree`).
- [Source: sprint-status.yaml — Story 2.3 done note] — *"CenterTab union unchanged — no Weaver row (Story 2.5)"* (this story owns that deferral).
- [Source: lebo/src/shared/utils/buildSnapshotSerializer.ts:130] — `weaverAllocations` intentionally excluded from the snapshot (confirms no-new-stat).
- [Source: lebo/src/App.keyboard.test.tsx] — keyboard test harness/mocks to extend for `1–6`.

## Previous Story Intelligence (Story 2.4 — done)

- **Extension-not-rewrite is the Epic 2 pattern.** 2.2 (header), 2.3 (left panel), 2.4 (right panel) all kept the working composition/wiring and applied targeted deltas + a single-source helper (`buildSectionStatus.ts`, `getArchetypeZone.ts`). Mirror it: extend the union, add the tab, keep `SkillTreeView`/`SkillTreeTabBar` intact, sync via one loop-safe seam.
- **Single-source-of-truth discipline.** 2.3's `buildSectionStatus.ts` and 2.4's `getArchetypeZone` each kept one authority. Here, `SkillTreeView.activeTabIndex` stays the sole authority for *which tree renders*; `centerTab` is a mirror — do not introduce a competing "is weaver" boolean in the store.
- **Baseline-failure literacy.** The standing UI baseline after 2.4 is `ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls` (2.4 cleared `RightPanel`). "No new failures vs that baseline" is the floor for this story; this story does not need to clear a baseline file (none of the four are in scope), but must not add one — watch `CenterCanvas`/`LeftPanel`/`App.keyboard` stay green.
- **Compile-ripple awareness.** 2.4 watched `noUnusedLocals` after removing `ScoreBar`. Here the analogous gate is the **exhaustive `Record<CenterTab, …>`** in `buildSectionStatus.ts` — the union change *will* fail `tsc` until the weaver entry is added. Do Task 1 and Task 5 together.
- **Test/seed process.** Store seed/restore in `beforeEach`, mock Tauri IPC/stream/event, `vitest-axe` on the container, mock PixiJS-bearing components (`SkillTreeView`) — reuse exactly; do not render real WebGL in jsdom.

## Git Intelligence Summary

- Recent commits are `[AutoSave]` snapshots (no semantic signal); the last semantic work was Stories 2.4 (right panel), 2.3 (left panel), 2.2 (header), 2.1 (tokens). No center-canvas or `appStore` union work is in flight — `CenterCanvas.tsx`, `appStore.ts`, `SkillTreeView.tsx`, `buildSectionStatus.ts`, and `LeftPanel.tsx` are stable and safe to extend.
- No new dependency: React 19.1, Zustand 5, Tailwind v4, `@testing-library/react`, `vitest-axe` are all present. This story adds **no** library, **no** Rust/IPC change, and **no** new store — it is a `CenterTab` union string addition + navigation chrome + one compile-forced section-status entry + one nav row.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — BMAD dev-story workflow

### Debug Log References

- `pnpm exec tsc --noEmit` → exit 0 (confirmed the union change forces the `getSectionStatus` exhaustive `Record<CenterTab, …>` ripple; satisfied by Task 5).
- `CI=true pnpm exec vitest run` → 1119 passed / 8 failed across exactly the standing baseline (`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`); the four touched/new test files (CenterCanvas, App.keyboard, LeftPanel, buildSectionStatus) are green.
- `pnpm build` → exit 0 (only the pre-existing >500 kB chunk advisory).

### Completion Notes List

- **AR-6 union expansion + center-bar reconciliation only — no rewrite.** Followed the Epic 2 extension discipline: kept `CenterCanvas`/`SkillTreeView`/`SkillTreeTabBar` composition intact and applied targeted deltas.
- **Loop-safe single source of truth.** `SkillTreeView.activeTabIndex` stays the sole authority for which tree renders; `centerTab` is a coarse passive-vs-weaver mirror. The effect pushes `centerTab → index` (keyed on `[centerTab]`); the user-click `handleTabChange` pushes `index → centerTab` (reading live `centerTab` via `useAppStore.getState()` to avoid dep churn). No setState cycle — the effect's `setActiveTabIndex` never calls `handleTabChange`. No competing "is weaver" boolean added to the store.
- **Compile gate handled with Task 1.** Adding `'weaver'` to the union made the exhaustive `Record<CenterTab, SectionStatus>` non-exhaustive; the `weaver` entry was added to both branches with `done: weaverPoints >= 1` (the FR-21 "Weaver budget > 0" predicate Epic 6's CompletenessGate will reuse).
- **No new stat / no dead key.** The Weaver badge is `Σ activeBuild.weaverAllocations`, a UI re-presentation of an existing build field; nothing feeds `compute_stats` (weaver remains excluded from the snapshot).
- **Scope boundary honored.** PixiJS canvas, `pixiRenderer`, the WebGL patch, `useSkillTree`, the per-skill `SkillTreeTabBar` slots (FR-43/Epic 5), context-tab content (Epics 1/3/4), `RightPanel`/`AppHeader`/`StatusBar`, and all store schema/types beyond the union string are untouched. No new store, dependency, Rust/IPC change, or React Router.
- **Accessibility:** tabs/rows stay `<button>`s with the global 2px gold focus ring; no new animation added; `vitest-axe` clean on `CenterCanvas` and the reconciled `LeftPanel`.

### File List

- `lebo/src/shared/stores/appStore.ts` — MODIFIED: `CenterTab` union += `'weaver'`.
- `lebo/src/features/layout/CenterCanvas.tsx` — MODIFIED: Weaver tab + "Passive Tree" relabel + `CENTER_TAB_IDS`/`safeCenterTab` guard + content switch shows the tree container for `tree`/`weaver`.
- `lebo/src/App.tsx` — MODIFIED: center-tab keyboard mapping `1–5` → `1–6` (`weaver` at `2`, new `6` → `blessing`).
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — MODIFIED: loop-safe `centerTab ⟷ activeTabIndex` sync (store reads + effect + `handleTabChange` mirror).
- `lebo/src/shared/utils/buildSectionStatus.ts` — MODIFIED: `weaverPoints` helper + `weaver` entry in both branches of the exhaustive `Record<CenterTab, SectionStatus>`.
- `lebo/src/features/layout/LeftPanel.tsx` — MODIFIED: `NAV_ROWS` Weaver row + "Passive Tree" relabel + collapsed-rail weaver glyph.
- `lebo/src/features/layout/CenterCanvas.test.tsx` — NEW: six-tab order, divider, Weaver badge, per-tab routing, tree/context display toggle, `safeCenterTab` fallback, axe.
- `lebo/src/shared/utils/buildSectionStatus.test.ts` — NEW: `weaver` entry boundary (`0`/`1` pts) + sum + `tree` unchanged.
- `lebo/src/App.keyboard.test.tsx` — MODIFIED: `1–6` mapping block + settings-view guard.
- `lebo/src/features/layout/LeftPanel.test.tsx` — MODIFIED: 6-row reconciliation, "Passive Tree" label, duplicate "0 pts" via `getAllByText`, Weaver-row routing test.

## Change Log

- 2026-06-05 — Story 2.5 implemented (→ review) via dev-story: `CenterTab` union += `'weaver'`; six-tab bar **Passive Tree | Weaver ┊ Gear | Skills | Idols | Blessings** with Weaver badge (`Σ weaverAllocations`) and `safeCenterTab` guard; keyboard `1–6` remap; loop-safe `centerTab ⟷ SkillTreeView.activeTabIndex` sync; compile-required `weaver` entry in `getSectionStatus`'s exhaustive `Record<CenterTab,…>` (`done: weaverPoints >= 1`); LeftPanel Weaver nav row + "Passive Tree" relabel. New `CenterCanvas.test.tsx` + `buildSectionStatus.test.ts`; extended `App.keyboard.test.tsx` (1–6) and reconciled `LeftPanel.test.tsx`. tsc 0 / build 0 / full suite 1119 passed, 8 failed across exactly the standing baseline (`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`) — no new failures. Source Audit: N/A (no-new-stat / no-dead-key). Scope boundary honored (PixiJS canvas, Epic-5 skill-tree relocation, context-tab content, RightPanel/AppHeader/StatusBar, store schema/types beyond the union string untouched).
- 2026-06-05 — Story 2.5 drafted (ready-for-dev) via create-story: center canvas six-tab bar with Weaver (FR-36 / AR-6 partial). Extend `CenterTab` union with `'weaver'` (passive + weaver = the two canvas tabs); six-tab bar **Passive Tree | Weaver ┊ Gear | Skills | Idols | Blessings** with divider, Weaver badge (`Σ weaverAllocations`), and `safeCenterTab` guard; keyboard `1–6` remap; thin loop-safe `centerTab ⟷ SkillTreeView.activeTabIndex` sync so the center Weaver tab shows the weaver tree (SkillTreeView/SkillTreeTabBar otherwise untouched — slot relocation is FR-43/Epic 5); compile-required `weaver` entry in `getSectionStatus`'s exhaustive `Record<CenterTab, …>`; LeftPanel Weaver nav row + "Passive Tree" relabel (the row Story 2.3 deferred here). New `CenterCanvas.test.tsx`, extended `App.keyboard.test.tsx` (1–6), `buildSectionStatus.test.ts` weaver boundary, reconciled `LeftPanel.test.tsx`. **Source Audit: N/A (no-new-stat / no-dead-key — Weaver badge re-presents existing `weaverAllocations`).** Scope boundary: PixiJS canvas, per-skill tree relocation (Epic 5), context-tab content (Epics 1/3/4), RightPanel/AppHeader/StatusBar, and all store schema/types beyond the union string are untouched.
