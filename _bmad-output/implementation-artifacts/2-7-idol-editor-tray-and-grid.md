# Story 2.7: Idol editor tray and grid

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the idol editor rebuilt as a tray plus grid where I pick an idol, set its affixes/tiers, then hover the grid to see its size and click to place it,
so that placing idols is visual, size-aware, and mistake-proof.

This is the **seventh story of Epic 2 (UI/UX Revamp — Claude Design System)** and continues the exact discipline of Stories 2.2–2.6: the **idol data wiring already exists and is correct** — `IdolGrid.tsx` already reads `idolData` from `gameDataStore`, reads `activeBuild.idolGrid`, validates with `validatePlacement()`, and writes via `placeIdol` / `clearIdolSlot` / `resetIdolGrid` / `updateIdolAffix`. This story is a **visual + interaction-model rebuild of the idol editor only** (FR-38): replace the current *click-empty-cell → `<select>` size dropdown → inline affix picker → confirm* flow with a **tray + grid layout** — a left grid and a right **Idol Tray** of all idol definitions; the user selects an idol in the tray, configures its prefix/suffix/tiers there, then **hovers grid cells to see a live size-aware placement preview and clicks a valid cell to place**. **Idol data wiring is unchanged from Phase 3** (epics.md:269: *"Blessing/idol editors here are the visual rebuilds; their data wiring is unchanged from Phase 3."*).

**Interaction model — confirmed with Alec (Option A):** *pick the idol that matches → set its %s/#s (affixes + tiers) in the tray → hover the grid to show its size/fit → click a valid cell to place it.* Affix configuration happens **in the tray detail before placement** (reusing the existing `IdolAffixPicker`); the configured idol is then dropped onto a hovered/clicked valid cell. Clicking an **occupied** cell **removes** that idol. Editing a placed idol's affixes in-place is **dropped** in favor of this place/remove model (matches the Claude Design prototype and FR-38) — to change a placed idol, remove and re-place it. This trade-off is deliberate and documented (see Dev Notes → Interaction model).

> **"Drag" is realized as select → hover-preview → click-to-place, NOT native HTML5 drag-and-drop.** The prototype `IdolEditor.jsx` implements placement with `onMouseEnter`/`onMouseLeave` preview + `onClick`, not DnD. Native HTML5 drag-and-drop (AR-8 / ADR-P4-006) is scoped to the **gear paper-doll in Epic 4** — do **not** introduce DnD machinery here. The hover-preview + click interaction produces the same "drag it to the spot" feel.

The concrete deltas are:

1. **Two-pane tray + grid layout (FR-38, AC1):** rebuild the Idol tab into a left **grid** pane and a right **Idol Tray** pane. The tray lists **all `idolData.idolTypes`** as cards, each with a **shape visualization** (a proportional rectangle sized by the idol's `rows`×`cols`, plus a `W×H` label, UX-DR11), the idol **name** (`displayName`), a short **stat/affix descriptor** (derived from the type's affix pools — see Dev Notes), and a **filter input** that filters the tray by name. An **Active Idol Stats** summary renders below the grid.
2. **Tray selection + in-tray affix config (AC1, AC2):** clicking a tray card selects it (gold-highlighted, `aria-pressed`); clicking the selected card again deselects. While selected, the tray detail shows the existing **`IdolAffixPicker`** (edit mode — no Place/Cancel buttons) to set prefix/suffix + tiers. `requiresBoth` idols cannot be placed until both affixes are set (reuse the picker's existing gating logic).
3. **Live, size-aware placement preview (FR-38, AC2):** with a tray idol selected, hovering a grid cell shows a **preview overlay** of exactly the cells the idol would occupy (sized by its shape). Only cells where the idol **fits** (in-bounds, not blocked, not overlapping) given current occupancy highlight as **valid**; overflow/collision cells render **invalid and are not clickable**. Reuse `validatePlacement()` / `getCellsForPlacement()` for fit logic — never reinvent collision math.
4. **Click to place / click to remove (FR-38, AC2):** clicking a **valid** empty cell with a selected, fully-configured idol calls `placeIdol(...)` with the tray-configured affixes; clicking an **occupied** cell calls `clearIdolSlot(occupant.id)`. Clicking **outside the grid** deselects the placing idol.
5. **Active Idol Stats summary (FR-38, AC1):** below the grid, list each placed idol's configured affix(es) (name + tier) — the **same** prefix/suffix data the current cells already render, re-presented as a summary; empty state "No idols placed."
6. **Grid stays data-driven:** grid dimensions, blocked cells, and idol shapes come from `idolData.defaultGrid` / each `IdolType` — **never hardcode 5×4** (project-context.md#Idol grid: "Grid dimensions and blocked cells vary by game version — never hardcode them"). The Claude Design target is the LE Season-4 5-column × 4-row board; the renderer must read it from config so a data update re-shapes the grid automatically.
7. **Tests rewritten:** `IdolGrid.test.tsx` asserts the old click-cell→`<select>`→affix-picker flow; that contract is gone. Rewrite the idol-editor tests to the tray-driven contract (tray cards with shape viz + filter, select → affix config, hover preview, valid/invalid cells, click-to-place with affixes, click-occupied-to-remove, deselect-on-outside-click, Active Idol Stats summary, `axe` clean).

**Scope boundary (read this first — same discipline as Stories 2.2 / 2.3 / 2.4 / 2.5 / 2.6):**
- **Do NOT change idol data wiring.** `placeIdol`, `clearIdolSlot`, `resetIdolGrid`, `updateIdolAffix`, `validatePlacement`, `getOccupantAt`, `getCellsForPlacement`, `idolData`/`gameDataStore`, `activeBuild.idolGrid`, `PlacedIdol`, and `toBuildSnapshot`'s idol extraction (`toIdolPlacements`) stay **exactly as today**. This is a visual + interaction rebuild only.
- **Do NOT introduce native HTML5 drag-and-drop.** Placement is select → hover-preview → click. DnD (AR-8) is Epic 4 gear only.
- **Do NOT add a new store, store field, Zustand action, dependency, Rust/IPC change, or React Router.** Consume the existing idol actions only. Local placing/hover/filter/affix-config state is component `useState` (as today).
- **Do NOT add a new stat, `StatKey`, `StatSheet` field, idol affix `statKey`, or `compute_stats` input.** The tray descriptor and Active Idol Stats text are **existing** idol affix data re-presented — see **Source Audit**.
- **Do NOT hardcode grid dimensions, blocked cells, or idol shapes.** Read them from `idolData`.
- **Do NOT touch** `CenterCanvas` (Story 2.5 — the Idols tab badge/routing), `RightPanel` (2.4), `LeftPanel` (2.3), `AppHeader` (2.2), `StatusBar` (2.8 — backlog), the Blessings/Conditions editors (2.6), the stat sheet (Epic 1), the optimizer (Epic 3/6), or gear (Epic 4).
- **Do NOT invent design tokens.** Use only the real `--color-*` tokens in `global.css` (there is **no** `--color-border`, no `--accent-gold-tint`; the prototype's `--hairline`/`--accent-gold-tint`/`--bg-elevated` map to `--color-bg-elevated`/`--color-bg-hover`/gold tokens — see Dev Notes → Design tokens).

## Acceptance Criteria

**AC1 — Tray + grid layout with shape viz, filter, and Active Idol Stats summary (FR-38, UX-DR11)**
- **Given** the Idol tab with `idolData` loaded and an active build,
- **When** the editor renders,
- **Then** it shows a **two-pane layout**: the idol **grid** on the left (dimensions, blocked cells, and per-idol shapes read from `idolData.defaultGrid` / `IdolType` — **not hardcoded**), and a scrollable **Idol Tray** on the right listing **every `idolData.idolTypes`** entry,
- **And** each tray card shows a **shape visualization** — a proportional rectangle scaled by the idol's `rows`×`cols` plus a `W×H` label (e.g. `1×2`) — the idol **name** (`displayName`), and a short **affix/stat descriptor** derived from the idol's `prefixPool`/`suffixPool` (e.g. a summary of available affix names; never a new stat — see Source Audit),
- **And** a **filter input** above the tray filters the cards by name (case-insensitive substring),
- **And** an **Active Idol Stats** summary renders **below the grid** listing each placed idol's configured affix(es) (name + tier), with an empty state ("No idols placed.") when `idolGrid` is empty,
- **And** all colors resolve through `--color-*` tokens only (Pattern P4-8 — no inline hex, no undefined `--color-border`).

**AC2 — Tray-driven placement: select → configure → hover-preview → click to place; click occupied to remove (FR-38)**
- **Given** an idol selected in the tray,
- **When** the user configures its prefix/suffix/tiers (via the existing `IdolAffixPicker` in the tray detail) and hovers grid cells,
- **Then** a **live placement-preview overlay** shows exactly the cells the idol would occupy (sized by its shape), **only** cells where the idol **fits** (in-bounds, not blocked, not overlapping — via `validatePlacement()`/`getCellsForPlacement()`) are highlighted **valid**, and overflow/collision cells render **invalid and are not clickable**,
- **And** clicking a **valid** empty cell calls `placeIdol({ id: crypto.randomUUID(), row, col, idolTypeId, prefixId?, prefixTier?, suffixId?, suffixTier? })` with the **tray-configured** affixes; a `requiresBoth` idol cannot be placed until **both** a prefix and suffix are set (reuse the picker's existing `isConfirmBlocked`/`requiresBoth` gating — block the cell click and surface the existing "requires both a prefix and suffix" hint),
- **And** clicking an **occupied** cell calls `clearIdolSlot(occupant.id)` (removal; `getOccupantAt` resolves the occupant),
- **And** clicking **outside the grid** deselects the placing idol (selection cleared, preview gone),
- **And** the selection toggles off when the same tray card is clicked again.

**AC3 — Tray active-state highlight; selection conveyed without color alone (FR-38, UX-DR12)**
- **Given** a tray card,
- **When** it is the selected idol,
- **Then** it is highlighted gold (`--color-accent-gold` border + gold-soft text / `--color-bg-hover` tint) and carries `aria-pressed="true"`; non-selected cards use the neutral `--color-bg-elevated` hairline + `--color-text-secondary`/`--color-text-muted` and `aria-pressed="false"`,
- **And** the selected/valid/invalid grid-cell states are conveyed to assistive tech via accessible names or aria (not color alone) — e.g. valid preview cells expose a "place here" affordance, invalid cells are non-interactive.

**AC4 — Idol data wiring unchanged from Phase 3 (visual + interaction rebuild only) (FR-38, epics.md:269)**
- **Given** the rebuilt editor,
- **When** it reads and writes state,
- **Then** it uses the **same** store reads (`useGameDataStore` → `idolData`; `useBuildStore` → `activeBuild.idolGrid`) and the **same** actions (`placeIdol`, `clearIdolSlot`, `resetIdolGrid`, `updateIdolAffix`) with the **same** `PlacedIdol` shape and the **same** `validatePlacement()` / `getOccupantAt()` / `getCellsForPlacement()` utilities — **no** new store field, action, prop on the store, snapshot change, or idol `statKey`,
- **And** the `!activeBuild` guard ("Create or load a build to manage idols.") and the `!idolData` loading guard ("Loading idol data…") behave exactly as today,
- **And** the "Reset all idols" affordance (`resetIdolGrid`) is preserved.

**AC5 — `IdolTab` hosts the two-pane editor; surrounding chrome reconciled (FR-38)**
- **Given** the Idol center tab,
- **When** it renders,
- **Then** `IdolTab.tsx` hosts the rebuilt two-pane idol editor (widened from the current single `max-w-3xl` card to fit grid + tray side by side), keeping the existing section heading and card chrome tokens (`--color-bg-surface` + `--color-bg-elevated` border),
- **And** the `!activeBuild` / `!idolData` guards remain in `IdolTab` (or are preserved equivalently in the editor),
- **And** no other tab content (Gear/Skill/Blessing) is touched.

**AC6 — Tested; accessibility holds; build green; no new baseline failures (NFR-14, UX-DR12)**
- **Given** the rebuilt idol editor,
- **When** tests run,
- **Then** `IdolGrid.test.tsx` (and any new co-located editor/tray test) is **rewritten** to the tray-driven contract and covers: the `!idolData` loading guard; the grid renders `gridConfig.rows × gridConfig.cols` with `blockedCells` non-interactive (`aria-disabled="true"`, not `BUTTON`); the tray lists one card per `idolType` with its `W×H` shape label and name; the filter input narrows the cards; clicking a card selects it (`aria-pressed="true"`) and reveals the affix picker; configuring a prefix (and suffix for `requiresBoth`) then clicking a valid cell calls `placeIdol` with the configured `idolTypeId`/`prefixId`/`prefixTier` (assert the call shape); a `requiresBoth` idol with only a prefix set does **not** place on cell click (and surfaces the requires-both hint); clicking an occupied cell calls `clearIdolSlot(id)`; clicking outside the grid deselects; the Active Idol Stats summary lists a placed idol's affix text and shows the empty state otherwise; "Reset all idols" calls `resetIdolGrid`; and `expect(await axe(container)).toHaveNoViolations()`,
- **And** every interactive tray card / grid cell / control is keyboard-operable, keeps the global **2px solid `--color-accent-gold` focus ring** (`:focus-visible`), and carries an accessible name (visible text or `aria-label`); selection uses `aria-pressed` (not color alone),
- **And** no animation is added that isn't `prefers-reduced-motion`-gated, `pnpm exec tsc --noEmit` exits 0 (watch `noUnusedLocals`/`noUnusedParameters` — drop the now-dead size-`<select>`/`pendingCell`/`configuringNew` placement code paths that the new model removes), `CI=true pnpm exec vitest run` shows **no new failures** vs the standing baseline (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`), and `pnpm build` exits 0.

## Source Audit

**Not applicable — this story introduces, computes, and surfaces NO new stat.** It is a **visual + interaction rebuild of the idol editor** (FR-38): a tray + grid layout replacing the click-cell→dropdown placement flow, with live size-aware placement preview and gold tray selection. It touches **no** game-data loader, **no** `scoring-core` / `compute/*` module, **no** new `StatKey`, **no** new `StatSheet` field, **no** new idol affix `statKey`, and **no** new `compute_stats` input.

The tray's **affix/stat descriptor** and the **Active Idol Stats** summary are the **existing idol affix data re-presented**, not a new stat. Idol affixes are already loaded into `idolData.idolTypes[].prefixPool/suffixPool` (each `IdolAffix` carries `id`, `displayName`, `statKey`, `modifierType`, `tiers[]`) from the shipped idol context-data source, already typed in `shared/types/contextDatabase.ts`, and the current `IdolGrid` **already renders** the chosen affix's `displayName` + tier on each placed cell (`getPrefixName`/`getSuffixName`). This story re-presents that already-shipped, already-displayed data in a tray descriptor and a summary list — a presentation change, nothing more.

**No dead key:** placed idols are both **produced** (the user's placement is written by `placeIdol` into `activeBuild.idolGrid`) **and consumed** (`toBuildSnapshot` → `toIdolPlacements()` maps `idolTypeId` → `idolSize` and emits the affixes into the snapshot that feeds `compute_stats` — project-context.md#Idol grid). This story changes neither end of that pipe.

The SOURCE-AUDIT GUARDRAIL's "map each new stat to real shipped-data, or declare honest-`0.0` with no dead `StatKey`" requirement is satisfied by this explicit **no-new-stat / no-dead-key** declaration. The guardrail's "value + element/type assertion test" requirement (which targets new prose/tag stat parsing in the loader) **does not apply** — there is no loader or parsing change. The relevant verification here is **component-behavior + accessibility assertion tests** (AC6), including that `placeIdol` is called with the correct configured `idolTypeId`/affix shape and that the existing affix `displayName` + tier text still renders.

## Tasks / Subtasks

- [x] **Task 1 — Build the tray + grid editor container and lift placing state (AC: 1, 2, 4, 5)** — `lebo/src/features/idol-grid/`
  - [x] Add an editor container (recommended: new `IdolEditor.tsx` in `features/idol-grid/`) that holds the shared placing state with `useState`: `selectedTypeId: string | null`, the in-tray affix config (`prefixId?/prefixTier?/suffixId?/suffixTier?`), and `hoverCell: { row; col } | null`. It reads `idolData` (`useGameDataStore`) and `idolGrid` (`useBuildStore`), and owns `handlePlace` (calls `placeIdol`) / `handleRemove` (calls `clearIdolSlot`) / `handleReset` (`resetIdolGrid`).
  - [x] Render the two panes: `<IdolGrid …>` (left) + `<IdolTray …>` (right), and the **Active Idol Stats** summary below the grid (reuse `getPrefixName`/`getSuffixName`-style lookups against `idolData.idolTypes` for each placed idol's affix text; empty state "No idols placed.").
  - [x] Preserve the `!idolData` ("Loading idol data…") and `!activeBuild` ("Create or load a build to manage idols.") guards (keep them in `IdolTab` or move into the editor — pick one, no double-guard).
  - [x] Keep a "Reset all idols" control wired to `resetIdolGrid` and a placed-count line (existing behavior).

- [x] **Task 2 — Refactor `IdolGrid.tsx` into the tray-driven, preview-capable grid (AC: 2, 3, 4)** — `lebo/src/features/idol-grid/IdolGrid.tsx`
  - [x] Make `IdolGrid` receive the selected idol type (+ its configured affixes), `hoverCell`, and callbacks (`onHoverCell`, `onPlace(row,col)`, `onRemove(idolId)`) as props from the container — OR keep store reads but accept the placing state as props. Either way: **remove** the old `pendingCell` size-`<select>` flow and the inline `configuringNew` placement picker (those are superseded by tray-side config).
  - [x] Render the grid from `gridConfig.rows/cols` with `blockedCells` non-interactive (`aria-disabled="true"`, not a `<button>`) — **keep this data-driven** (do not hardcode dimensions).
  - [x] When a tray idol is selected, compute the **preview cell set** for `hoverCell` via `getCellsForPlacement()` + `validatePlacement()`; highlight valid-fit cells, render the multi-cell footprint, and make overflow/collision cells **non-clickable**.
  - [x] Cell click: occupied → `onRemove(occupant.id)` (via `getOccupantAt`); empty + valid + fully-configured selection → `onPlace(row,col)`; empty + invalid/over-budget/`requiresBoth`-unmet → no-op (surface the existing requires-both hint when applicable).
  - [x] Occupied cells render the placed idol's footprint (multi-cell span via `gridColumn/gridRow`) with its `displayName` + affix text; clicking removes (no more in-place edit mode — see Dev Notes).
  - [x] Keep the global `:focus-visible` 2px gold ring for interactive cells; do not reintroduce the per-element `onFocus/onBlur` inline outline hack unless matching the existing pattern (prefer the global ring).

- [x] **Task 3 — Build `IdolTray.tsx` with shape viz, filter, selection, and in-tray affix config (AC: 1, 2, 3)** — `lebo/src/features/idol-grid/IdolTray.tsx` (new)
  - [x] List all `idolData.idolTypes` as cards: a shape rectangle scaled by `rows`×`cols` (proportional, e.g. base + `cols*step` wide × `rows*step` tall) with a `W×H` label, the `displayName`, and a derived affix descriptor (e.g. join the first N `prefixPool`/`suffixPool` `displayName`s, or an affix-count summary — keep it short; this is existing data, no new stat).
  - [x] A filter `<input>` (controlled, component-local `useState`) narrows cards by case-insensitive name substring.
  - [x] Each card is a `<button>` with `aria-pressed={selectedTypeId === type.id}`; click toggles selection (`onSelect(type.id | null)`). Selected card → gold (`--color-accent-gold` border + gold-soft text + `--color-bg-hover` tint); others → `--color-bg-elevated` hairline + secondary text.
  - [x] When a card is selected, render the existing **`IdolAffixPicker`** below/within the tray detail in **edit mode** (omit `onConfirm`/`onCancel` so the Place/Cancel buttons don't render) wired to the container's affix-config setters via `onPrefixChange`/`onSuffixChange`. Show a "Click a valid grid cell to place" hint (and the requires-both hint when `requiresBoth` and affixes incomplete).

- [x] **Task 4 — Wire `IdolTab` to the two-pane editor; deselect on outside click (AC: 2, 5)** — `lebo/src/features/layout/tabs/IdolTab.tsx`
  - [x] Replace `<IdolGrid />` with the new `<IdolEditor />`; widen the container from `max-w-3xl` to fit grid + tray (e.g. a wider max-width or a two-column flex/grid). Keep the "Idols" heading + card chrome tokens.
  - [x] Implement **click-outside-grid deselects**: a click on the editor background (not on a tray card or grid cell) clears `selectedTypeId` (and hover/affix config). Keep it simple and accessible (no global document listeners that leak; an onClick on a wrapper that stops propagation from interactive children is sufficient).

- [x] **Task 5 — Rewrite the idol-editor tests to the tray-driven contract (AC: 6)** — `lebo/src/features/idol-grid/IdolGrid.test.tsx` (+ new test file if components split)
  - [x] Keep the store-mock harness pattern (`vi.mock` of `gameDataStore`/`buildStore`, `getState` returning `placeIdol`/`clearIdolSlot`/`resetIdolGrid`/`updateIdolAffix`, `mockIdolData` with mixed shapes incl. a `requiresBoth` 1×2 and a 1×1).
  - [x] **Remove** the dropdown-era tests (click-empty-cell → `Select idol type` combobox → place; Cancel-during-placement; in-place edit-mode tests). Replace with: tray cards present (one per type, with `W×H` + name); filter narrows cards; select card → `aria-pressed="true"` + affix picker appears; configure prefix (+suffix for requiresBoth) → click valid cell → `placeIdol` called with `{ idolTypeId, prefixId, prefixTier, … }`; requiresBoth with only prefix → cell click does **not** place + requires-both hint shown; click occupied cell → `clearIdolSlot(id)`; click outside grid → deselect (affix picker gone); Active Idol Stats lists placed affix text / empty state; "Reset all idols" → `resetIdolGrid`.
  - [x] Keep the blocked-cell assertions (`aria-disabled="true"`, not `BUTTON`) and the `axe` no-violations test.

- [x] **Task 6 — Verify build + suite (AC: 6)**
  - [x] `pnpm exec tsc --noEmit` → exit 0 (drop unused imports/locals from the removed placement flow).
  - [x] `CI=true pnpm exec vitest run src/features/idol-grid` → green (42/42).
  - [x] `CI=true pnpm exec vitest run` → **no new failures** vs the standing baseline (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`); no baseline file cleared or added.
  - [x] `pnpm build` → exit 0 (pre-existing >500 kB chunk advisory only).

### Review Findings

_Code review 2026-06-05 (Blind Hunter + Edge Case Hunter + Acceptance Auditor, pinned diff f9f60a5..eab9ccb). All 6 ACs verified MET by the Acceptance Auditor; every Critical scope boundary clean (idol data wiring untouched, no DnD/store/dep/IPC, grid data-driven, token discipline). 0 patch findings — implementation is correct as shipped. 1 decision, 3 deferred, 21 dismissed as noise/false-positives._

- [x] [Review][Decision → keep-as-is, Alec] Tray filter that excludes the currently-selected idol leaves its affix-config panel open below the list — `selectedType` derives from full `idolTypes`, not the filtered `visible` set [IdolTray.tsx:42,133]. **Resolved keep-as-is:** persisting selection + in-progress affix config across a filter keystroke protects the user's work (filtering to double-check another idol won't wipe configured affixes); the panel header still names the selection and it stays placeable. Matches how a normal user expects it to behave. No change.
- [x] [Review][Defer] Stale/removed `idolTypeId` → placed idol becomes invisible on the grid and un-removable via click, yet still listed in Active Idol Stats; another idol can overlap its untracked footprint [idolGridUtils.ts:79; IdolEditor.tsx:132] — deferred, pre-existing util behavior (`getOccupantAt`/`isOccupiedByAnother` unchanged by this story), data-staleness path already flagged by the app's staleness system; idol data wiring is explicitly out of scope.
- [x] [Review][Defer] Malformed/degenerate idol-type or grid data isn't defensively annotated: empty `prefixPool` (non-`requiresBoth`), `requiresBoth` with empty `suffixPool`, `tiers: []`, or `rows/cols: 0` produce a selectable-but-never-placeable card / empty grid with no guard message [IdolTray.tsx; IdolAffixPicker.tsx; IdolGrid.tsx:59] — deferred, data-quality only; Phase-3 idol data is valid, no crash, out of scope for a visual rebuild.
- [x] [Review][Defer] `crypto.randomUUID()` unguarded in `handlePlace` [IdolEditor.tsx:69] — deferred, pre-existing pattern (old code used it too) and available in Tauri secure-context webviews.

## Dev Notes

### This is a visual + interaction rebuild — keep the data wiring, swap the placement UX
`IdolGrid.tsx` already does everything correctly at the data layer: reads `idolData`, reads `activeBuild.idolGrid`, validates with `validatePlacement()`, resolves occupants with `getOccupantAt()`, and writes via `placeIdol`/`clearIdolSlot`/`resetIdolGrid`/`updateIdolAffix`. The **only** change is the interaction + presentation: *click-cell → size `<select>` → inline affix picker → confirm* becomes *select in tray → configure affixes in tray → hover-preview → click valid cell to place*. Mirror the Epic 2 pattern (2.2–2.6): keep the wiring, rebuild the chrome/flow to the Claude Design layout. The prototype is the visual source of truth. [Source: lebo/src/features/idol-grid/IdolGrid.tsx; epics.md#Story 2.7; epics.md:269]

### Interaction model (Alec-confirmed, Option A) — affix config lives in the tray, placed idols are place/remove
- The current component **couples placement with affix configuration** and supports **in-place editing** of a placed idol (click cell → edit-mode affix pickers). FR-38 and the prototype use a **place/remove** model: "click empty cells to place selected idol · click placed idol to remove" (IdolEditor.jsx:122-124). AC2 explicitly makes **clicking an occupied cell remove it**.
- Resolution: affix `%s/#s` are set **in the tray** (the `IdolAffixPicker` in edit mode, in the selected-card detail) *before* placement; the configured idol is dropped onto a valid cell. **In-place affix editing is dropped** — to change a placed idol, remove and re-place. This is a deliberate trade to match FR-38 + the prototype, not an oversight. (If a future story wants in-place editing back, it would re-home it onto a non-removing affordance.) [Source: epics.md:600-604; _bmad-output/last-epoch-build-optimizer-UI-Handoff/IdolEditor.jsx:48-60, 122-124]
- `requiresBoth` gating is **preserved**: a `requiresBoth` idol cannot be placed until both prefix and suffix are set. Reuse the picker's existing logic (`requiresBoth ? !prefix || !suffix : !prefix`) to gate the **cell click** (block placement + show the existing "requires both a prefix and suffix" hint) rather than a Place button. [Source: lebo/src/features/idol-grid/IdolAffixPicker.tsx:46-50]

### The prototype is explicit about the layout — but adapt its data model to the real one
`_bmad-output/last-epoch-build-optimizer-UI-Handoff/IdolEditor.jsx` shows the target: a left `idol-board` (grid + `Active Idol Stats` summary) and a right `idol-tray` (`Available Idols` header with a count chip, a `Filter idols…` input, and idol cards each with a `idol-card-shape` proportional box `width: 18 + w*8`, `height: 18 + h*8` showing `w×h`, a name, a stat line, and a cell count). Selecting a card highlights it and shows a "Click empty grid cell to place" footer; hovering grid cells drives a `previewCells` set; `canPlace()` gates valid cells; placed cells span their footprint and remove on click. **Adapt to the real data model:**
- The prototype's `IDOL_DEFS` have a flat `.shape` string (`"1x2"`), a `.name`, a fixed `.stat` description, and `.cells`. The shipped model is `IdolType { id, displayName, rows, cols, requiresBoth, prefixPool[], suffixPool[] }` — there is **no single `.stat` string per type**; the stat comes from the chosen affix. So the tray descriptor must be **derived** from `prefixPool`/`suffixPool` (e.g. a short affix-name summary), and the per-placement stat text comes from the configured `PlacedIdol` affixes (as the current cells already render).
- The prototype hardcodes `COLS=5, ROWS=4`. **Do not** hardcode — read `idolData.defaultGrid.rows/cols/blockedCells`. The Season-4 board is 5×4; the renderer must reflect config so a data update re-shapes it. [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/IdolEditor.jsx:5-189; lebo/src/shared/types/contextDatabase.ts:1-37; project-context.md#Idol grid]

### Reuse the existing placement/collision utilities — do not reinvent
`idolGridUtils.ts` already provides `getCellsForPlacement(row,col,type)`, `isBlockedCell`, `isOccupiedByAnother`, `validatePlacement(...) → { valid, error }`, and `getOccupantAt(row,col,placed,types)`. The preview overlay = `getCellsForPlacement` for `hoverCell` gated by `validatePlacement`; valid highlighting and "not clickable on collision" both fall out of `validatePlacement(...).valid`. Never inline collision math (project-context.md#Idol grid: "All idol placement validation goes through `validatePlacement()`"). [Source: lebo/src/features/idol-grid/idolGridUtils.ts:4-86]

### Design tokens — use only what exists (Pattern P4-8)
`global.css` (`@theme`) defines: backgrounds `--color-bg-base/-surface/-elevated/-hover/-sunken`; gold `--color-accent-gold (#C9A84C)`, `--color-accent-gold-soft (#D4B96A)`, `--color-accent-gold-dim (#8B7030)`; text `--color-text-primary/-secondary/-muted`; data colors `--color-data-*`. **There is NO `--color-border`, NO `--hairline`, NO `--accent-gold-tint`** (those are prototype names). Map them: prototype `--hairline` → `--color-bg-elevated`; `--bg-elevated` → `--color-bg-elevated`/`--color-bg-hover`; `--accent-gold-tint` (selected-card tint) → `--color-bg-hover` + a gold border/text; `--text-muted` → `--color-text-muted`. Route any rarity/damage colors through `rarityColors.ts` — never inline hex. The existing `IdolGrid` uses `var(--color-error, #f87171)` for the placement-error fallback; keep that pattern for any error/invalid text. [Source: lebo/src/assets/styles/global.css:19-83; project-context.md#Tailwind v4]

### Accessibility (NFR-14 / UX-DR12)
- Tray cards and grid cells are `<button>`s (or have a button role) — keyboard-operable with the global **2px solid `--color-accent-gold` focus ring** (`:focus-visible`); never `outline: none` without a replacement.
- Convey tray selection with `aria-pressed` (toggle semantics) — **not color alone** (axe + colorblind). The gold treatment is reinforcement.
- Blocked cells stay non-interactive (`aria-disabled="true"`, not a `<button>`) — keep the existing pattern so axe stays clean.
- Each interactive element has an accessible name: tray card from its visible name; grid cells via `aria-label` (e.g. "Empty cell, row R col C" / "Place {idol} here" / "{idol} placed. Click to remove."). Multi-cell occupied tiles need one accessible name on the head cell.
- Placement errors / requires-both hints use `role="alert"` (as today).
- Add **no** new animation unless `prefers-reduced-motion`-gated. Run `vitest-axe` on the rendered editor — **zero new violations**.

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate config or re-stub the four `test-setup.ts` polyfills (jest-dom, vitest-axe, ResizeObserver, matchMedia).
- Reuse the existing `IdolGrid.test.tsx` mock harness (the `useGameDataStore`/`useBuildStore` `vi.mock` + `getState` imperative-action stubs + `mockIdolData` with a 1×1, a `requiresBoth` 1×2, and larger shapes). No Tauri IPC to mock — the editor reaches state only through the mocked stores.
- Co-located tests only; explicit `expect`, no snapshots. Assert selection via role/`aria-pressed`/accessible name and via rendered affix text — **not** brittle inline-style hex matching (active-state colors may be class or style; assert behavior/semantics).
- Per the Source Audit this is a no-new-stat story, so the guardrail's loader value+element assertion tests **do not apply**; the relevant checks are that `placeIdol` is called with the correct configured `{ idolTypeId, prefixId, prefixTier, suffixId?, suffixTier? }`, that `requiresBoth` blocks placement until both affixes are set, that `clearIdolSlot` fires on occupied-cell click, and that the existing affix `displayName` + tier text still renders in the Active Idol Stats summary.

### Project Structure Notes
- All source is inside `LEBOv2/lebo/src` — Phase 2 active tree, write freely. Naming holds: `IdolGrid.tsx`/`IdolTray.tsx`/`IdolEditor.tsx`/`IdolTab.tsx` are `PascalCase.tsx`; utils stay `camelCase.ts`; no barrel files; named exports only; group imports external → shared → feature-local.
- `IdolTab` (in `features/layout/tabs/`) importing from `features/idol-grid/` is the **existing** cross-feature pattern for tab hosts — keep it; do not route idol components through `shared/`.
- **Phase boundary:** never write to `_bmad-output/` (Phase 1 / handoff artifacts) — the prototype `IdolEditor.jsx` and idol context-data are read-only references. The `sprint-status.yaml` + story files under `_bmad-output/implementation-artifacts/` are the exception this workflow itself writes.
- **`features/context-panel/idolData.ts` is NOT the idol DB** — it's a stale `IDOL_SLOTS` constant for the dead Phase-3 `ContextPanel` accordion (never mounted; project-context.md#Panel system). The real idol data is `gameDataStore.idolData` (`IdolData` type). Do not import `idolData.ts` here.

### Out of scope (do NOT touch here)
- Idol **data wiring**: `placeIdol`/`clearIdolSlot`/`resetIdolGrid`/`updateIdolAffix`, `gameDataStore.idolData`, `validatePlacement`/`getOccupantAt`/`getCellsForPlacement`, `PlacedIdol`, `buildSnapshotSerializer`'s `toIdolPlacements`, and `compute_stats`.
- The Idols **tab badge / routing** in `CenterCanvas` (Story 2.5 — done), `LeftPanel` (2.3), `RightPanel` (2.4), `AppHeader` (2.2), `StatusBar` (2.8 — backlog), the Blessings/Conditions editors (2.6), the stat sheet (Epic 1), the optimizer (Epic 3/6), and gear (Epic 4).
- Native HTML5 drag-and-drop (AR-8 — Epic 4 gear paper-doll only).
- Any new store, store field, action, dependency, Rust/IPC change, idol `statKey`, or React Router.

### References
- [Source: epics.md#Story 2.7: Idol editor tray and grid] — ACs (FR-38): 5×4 grid + scrollable Idol Tray with shape visualizations, names, stat descriptions, filter; Active Idol Stats summary; live placement-preview overlay; size-aware valid-cell highlighting; click outside deselects; click occupied removes (via `validatePlacement()`); **data wiring unchanged from Phase 3**.
- [Source: epics.md:96 (FR-38)] — Idol editor: tray + grid (5×4 grid with hover "+", occupied cells show abbreviated name in shape-scaled colored tile, click to remove; right tray of all idol definitions with shape viz + filter + selection; live placement-preview overlay; size-aware valid-cell highlighting; Active Idol Stats summary).
- [Source: epics.md:196 (UX-DR11)] — Idol shape visualizations (proportional rectangle + `W×H` label) in the tray and size-aware valid-cell highlighting in the grid.
- [Source: epics.md:266-269 (Epic 2 overview + implementation notes)] — components faithfully rebuilt to the Claude Design, not wrappers of the prototype JSX; *"Blessing/idol editors here are the visual rebuilds; their data wiring is unchanged from Phase 3."*
- [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/IdolEditor.jsx:5-189] — the visual target: left board (grid + Active Idol Stats), right tray (filter + idol cards with `w×h` shape box, name, stat, cell count), select-to-place with hover `previewCells`, `canPlace()` gating, click-placed-to-remove. (Adapt to the real `IdolType`/`PlacedIdol` model — no per-type `.stat`; affixes per placement; grid dims from config.)
- [Source: lebo/src/features/idol-grid/IdolGrid.tsx] — current editor: store reads, the `pendingCell`/`configuringNew` placement flow to remove, the occupied-cell footprint render + `getPrefixName`/`getSuffixName`, the placed-count line, and "Reset all idols".
- [Source: lebo/src/features/idol-grid/idolGridUtils.ts:4-86] — `getCellsForPlacement`, `validatePlacement`, `getOccupantAt` (reuse for preview/valid-highlight/occupant lookup — never reinvent collision math).
- [Source: lebo/src/features/idol-grid/IdolAffixPicker.tsx] — the affix picker (reuse in **edit mode**: omit `onConfirm`/`onCancel`); the `requiresBoth`/`isConfirmBlocked` gating logic to reuse for cell-click gating.
- [Source: lebo/src/features/layout/tabs/IdolTab.tsx] — the center-tab host (`max-w-3xl` card to widen for grid + tray; the `!activeBuild`/`!idolData` guards).
- [Source: lebo/src/shared/types/contextDatabase.ts:1-37] — `IdolGrid` (rows/cols/blockedCells), `IdolAffix` (id/displayName/type/tiers/statKey/modifierType), `IdolType` (id/displayName/rows/cols/requiresBoth/prefixPool/suffixPool), `IdolData`.
- [Source: lebo/src/shared/types/build.ts] — `PlacedIdol` (`{ id, row, col, idolTypeId, prefixId?, prefixTier?, suffixId?, suffixTier? }`) — the unchanged placement shape.
- [Source: lebo/src/shared/stores/buildStore.ts:56-59,573-633] — `placeIdol`/`clearIdolSlot`/`resetIdolGrid`/`updateIdolAffix` actions (the unchanged write paths).
- [Source: lebo/src/assets/styles/global.css:19-83] — the available `--color-*` tokens (no `--color-border`/`--hairline`/`--accent-gold-tint`); the global `:focus-visible` 2px gold ring.
- [Source: project-context.md#Idol grid] — `IdolGridState = PlacedIdol[]`; validation through `validatePlacement()`; grid config from `contextDatabase` — **never hardcode** dims/blocked cells; `toBuildSnapshot` → `toIdolPlacements()` maps `idolTypeId` → `idolSize` (confirms idols are consumed → no dead key).
- [Source: project-context.md#Tailwind v4] — CSS-first tokens, never `@apply`, route colors through `--color-*` / `rarityColors.ts`, no inline hex.
- [Source: project-context.md#Panel system] — the left panel is a navigator only (no `ContextPanel` accordion) → `context-panel/idolData.ts` `IDOL_SLOTS` is dead; use `gameDataStore.idolData`.

## Previous Story Intelligence (Story 2.6 — done)

- **Visual-rebuild-not-rewrite is the Epic 2 pattern.** 2.2 (header), 2.3 (left panel), 2.4 (right panel), 2.5 (center bar), 2.6 (blessing card grid) all kept the working store reads/wiring and applied targeted visual deltas. Here the same: keep `idolData`/`idolGrid` reads + `validatePlacement`/`placeIdol`/`clearIdolSlot`; swap the placement flow to tray-driven.
- **2.6's prototype-vs-real-data adaptation is the direct precedent.** 2.6 adapted the prototype's 5-slot `BLESSING_SLOTS` to the real 12-timeline `BlessingEntry[]` and explicitly did **not** copy the prototype's `"{N}/5"` chip. Here: adapt the prototype's flat `IDOL_DEFS` (`.shape`/`.stat`) to the real `IdolType` (`rows`/`cols`/affix pools) and do **not** hardcode the prototype's 5×4 — read `idolData.defaultGrid`.
- **Baseline-failure literacy.** The standing UI baseline is `ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`. "No new failures vs that baseline" is the floor; this story neither clears nor adds a baseline file. The rewritten idol-editor tests must stay green.
- **Compile-ripple / `noUnusedLocals` awareness.** 2.4 watched `noUnusedLocals` after removing `ScoreBar`; 2.6 after removing the search `useState`/`<select>`. Here the analogous gate is **removing the `pendingCell`/`configuringNew`/size-`<select>` placement code** — drop now-unused locals/imports or `tsc` fails.
- **Selection semantics via `aria-pressed`, asserted by behavior not hex.** 2.6 modeled single-select rows as `aria-pressed` toggle buttons and Alec resolved "keep as-is" at review (Epic 2 pattern). Reuse `aria-pressed` for tray selection; tests assert roles/`aria-pressed`/accessible names + rendered affix text, never inline-style hex.
- **Token discipline (Pattern P4-8).** Use only real `--color-*` tokens; map prototype token names (`--hairline`/`--accent-gold-tint`/`--bg-elevated`) to the real ones; no inline hex; no undefined `--color-border`.
- **Test/seed process.** Reuse the store-mock harness; `vitest-axe` on the container.

## Git Intelligence Summary

- Recent commits are `[AutoSave]` snapshots (no semantic signal); the last semantic work was Stories 2.6 (blessing card grid), 2.5 (center bar), 2.4 (right panel), 2.3 (left panel), 2.2 (header), 2.1 (tokens). No idol-editor work is in flight — `IdolGrid.tsx`, `IdolGrid.test.tsx`, `IdolAffixPicker.tsx`, `idolGridUtils.ts`, and `IdolTab.tsx` are stable and safe to rebuild.
- No new dependency: React 19.1, Zustand 5, Tailwind v4, `@testing-library/react`, `@testing-library/user-event`, `vitest-axe` are all present. This story adds **no** library, **no** Rust/IPC change, **no** new store, and **no** new stat — it is a presentation + interaction rebuild of the idol-editor components + their host + their test.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev-story workflow)

### Debug Log References

- `IdolGrid.test.tsx:146` — `within(card).getByText(/1×2/)` threw "multiple elements" because the W×H label appears twice inside a tray card (the shape box `1×2` and the descriptor line `1×2 · …`). Both are the legitimate UX-DR11 W×H surface. Fixed the test to `getAllByText(/1×2/).length > 0` (assert presence, not uniqueness) rather than altering the source. No source defect.

### Completion Notes List

**Implementation (visual + interaction rebuild only — idol data wiring untouched, per AC4):**
- **New `IdolEditor.tsx`** container lifts placing state (`selectedTypeId`, `affixConfig`, `hoverCell`) via `useState`, reads `idolData`/`idolGrid` from the existing stores, and owns `handlePlace`→`placeIdol` / `handleRemove`→`clearIdolSlot` / `handleReset`→`resetIdolGrid`. Renders `<IdolGrid>` (left) + `<IdolTray>` (right), the **Active Idol Stats** summary (placed affix `displayName` + `T{tier}`; empty state "No idols placed."), the placed-count line, and "Reset all idols". Outer wrapper `onClick={deselect}`; both panes `stopPropagation` so background-only clicks deselect (AC2).
- **`IdolGrid.tsx` refactored** from the `pendingCell` size-`<select>` / `configuringNew` flow into a props-driven, preview-capable grid. Data-driven from `gridConfig.rows/cols` (no hardcoded 5×4); blocked cells render as non-interactive `aria-disabled` `<div>`s. Preview footprint computed via `getCellsForPlacement` gated by `validatePlacement`; cells where the selected idol cannot originate render invalid + non-clickable; valid cells call `onPlace`; occupied head cell spans its footprint (`gridColumn/gridRow`) and calls `onRemove` (AC2/AC3). No collision math reinvented — reuses `idolGridUtils`.
- **New `IdolTray.tsx`**: one `<button>` card per `idolData.idolTypes` with a proportional `rows×cols` shape box + `W×H` label (UX-DR11), `displayName`, derived affix descriptor (first 2 pooled affix names + "+N more"), a count chip, and a case-insensitive name **filter** input. Cards carry `aria-pressed`; selected → gold border/text + `--color-bg-hover` tint. Selected card reveals the existing **`IdolAffixPicker` in edit mode** (no `onConfirm`/`onCancel`, so Place/Cancel don't render) wired to the container's setters; shows the place hint and the requires-both hint.
- **`IdolTab.tsx`** swapped `<IdolGrid />` → `<IdolEditor />`, widened `max-w-3xl` → `max-w-5xl` for grid + tray side-by-side; `!activeBuild` / `!idolData` guards preserved.
- **`ContextPanel.tsx`** (dead Phase-3 consumer, never mounted) swapped its zero-prop `<IdolGrid />` → `<IdolEditor />` — a compile-fix only, since `IdolGrid` is now props-driven and would otherwise fail `tsc`. No behavior change (component is unmounted).
- **Interaction-model trade documented in story**: in-place affix editing of a placed idol is dropped in favor of place/remove (Alec-confirmed Option A); to change a placed idol, remove and re-place. `requiresBoth` gating preserved — a cell click is a no-op until both prefix and suffix are set, surfacing the existing requires-both hint.

**Source Audit:** N/A — no-new-stat / no-dead-key. Tray descriptor + Active Idol Stats re-present existing `idolData` affix data already rendered on placed cells; placed idols are produced by `placeIdol` and consumed by `toIdolPlacements`/`compute_stats`. No loader/parsing change → guardrail value+element assertion tests do not apply; component-behavior + a11y assertions (AC6) are the relevant verification.

**Verification:** `tsc --noEmit` → 0. `vitest run src/features/idol-grid` → 42/42 green. Full suite → **1125 passed, 8 failed across exactly the standing baseline** (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`) — no new failures, no baseline file cleared or added. `pnpm build` → exit 0 (pre-existing >500 kB chunk advisory only).

### File List

**New:**
- `lebo/src/features/idol-grid/IdolEditor.tsx`
- `lebo/src/features/idol-grid/IdolTray.tsx`

**Modified:**
- `lebo/src/features/idol-grid/IdolGrid.tsx`
- `lebo/src/features/idol-grid/IdolGrid.test.tsx`
- `lebo/src/features/layout/tabs/IdolTab.tsx`
- `lebo/src/features/context-panel/ContextPanel.tsx` (compile-fix only — dead consumer)

## Change Log

| Date | Change |
|------|--------|
| 2026-06-05 | Story 2.7 implemented — idol editor rebuilt to tray + grid (FR-38, UX-DR11). New `IdolEditor` container + `IdolTray`; `IdolGrid` refactored to props-driven preview/place/remove model; `IdolTab` widened and hosts the editor. Data wiring unchanged from Phase 3. tsc 0 / idol tests 42/42 / full suite 1125 passed, 8 failed across standing baseline (no new failures) / build 0. Status → review. |
