---
title: 'Idol Grid Builder — Layout & Placement'
story_id: '3.1'
story_key: '3-1-idol-grid-builder-layout-and-placement'
epic: 3
status: review
created: '2026-05-21'
---

## Story

**As a player,**
I want an idol grid that matches the Last Epoch in-game layout where I can place idols by size type with valid placement enforcement and clear/reset controls,
**So that** my idol configuration is accurately modeled in the app's stat calculations.

---

## Context

Epic 3 introduces the full build-context layer: idols, blessings, and conditions. Story 3.1 is the foundation — it establishes the grid data model, placement state in `BuildState`, and the interactive grid UI. Story 3.2 adds affix selection on top of what 3.1 builds.

**Previous story (2.6):** Added `StatSheetPanel` with five-tab stat display. The `buildSnapshotSerializer.ts` has `idolPlacements: []` as a documented stub for Epic 3. The `gameDataStore` already holds `idolData: IdolData | null` (loaded from `idol-data.json` at startup in Story 1.4). No changes are needed to Rust code for this story — placement state flows into the serializer stub and will reach the scoring engine in 3.2.

---

## Acceptance Criteria

**Given** the context panel is open
**When** a player navigates to the Idols section
**Then** a 5×5 grid is displayed with the four corners and center cell visually blocked (non-interactive, distinct visual treatment)
**And** the layout is sourced from `gameDataStore.idolData.defaultGrid` — not hardcoded values

**Given** an empty idol grid
**When** a player clicks an active cell and selects idol size type "1×2" from a picker
**Then** the idol occupies 2 cells in the correct column-spanning orientation and the cells become visually occupied
**And** the idol's visual representation shows the idol type name and placeholder affix slots (affix selection configured in Story 3.2)

**Given** a player tries to place a "2×2" idol that would overlap an existing "1×2" idol
**When** the placement is attempted
**Then** the placement is rejected and an error message explains the overlap
**And** no partial placement occurs (atomic — either all cells are placed or none)

**Given** a placed idol
**When** the player clicks "Clear slot" for that idol
**Then** all cells the idol occupied return to empty state immediately
**And** the idol's stat contributions are removed (once 3.2 wires affixes; for 3.1, no stat contributions exist yet)

**Given** a grid with multiple placed idols
**When** the player clicks "Reset all idols"
**Then** all slots clear and the grid returns to fully empty state

**Given** idol grid state when a build is saved and then reloaded
**When** the build is restored from the Tauri vault
**Then** all placed idols are at their exact row/col positions with correct `idolTypeId` values
**And** idol state is persisted in `BuildState.idolGrid`

**Given** `shared/types/build.ts`
**When** an agent reviews the `BuildState` interface
**Then** it includes `idolGrid?: IdolGridState` at the top level (alongside `contextData`, not nested inside it)
**And** `blessings?: Record<string, string | null>` and `activeConditions?: string[]` are also present (stubs for Stories 3.3/3.4)
**And** `schemaVersion` remains at `2` — no migration needed (new fields default to empty for existing builds)
**And** `buildSnapshotSerializer.ts` maps `build.idolGrid` into `BuildSnapshot.idolPlacements` (without affixes — prefix/suffix are `undefined` until 3.2)

---

## Technical Requirements

### 1. New Types — `shared/types/build.ts`

Add at the bottom of the file (before the export of `ApplyNodeResult`):

```typescript
export interface PlacedIdol {
  id: string          // crypto.randomUUID() — unique key per placed instance
  row: number         // 0-indexed top-left row
  col: number         // 0-indexed top-left col
  idolTypeId: string  // references IdolType.id from idol-data.json
}

export type IdolGridState = PlacedIdol[]
```

Update `BuildState` interface:

```typescript
export interface BuildState {
  // ... existing fields ...
  idolGrid?: IdolGridState        // Epic 3.1 — positioned idols (no affixes yet)
  blessings?: Record<string, string | null>  // Epic 3.3 stub
  activeConditions?: string[]               // Epic 3.4 stub
}
```

**Do NOT remove `contextData.idols: IdolItem[]`** — it is used by existing gear/skill context and `IdolInput.tsx` (which is unrelated Phase 1 functionality). The new `idolGrid` field is separate.

### 2. Build Store — `shared/stores/buildStore.ts`

Import the new types:
```typescript
import type { BuildState, BuildMeta, ApplyNodeResult, GearItemV2, ActiveSkill, IdolItem, IdolGridState, PlacedIdol } from '../types/build'
```

Add to `BuildStore` interface:
```typescript
placeIdol: (placed: PlacedIdol) => void
clearIdolSlot: (idolId: string) => void
resetIdolGrid: () => void
```

Add implementations (all follow the existing `set((s) => s.activeBuild ? {...} : {}` pattern):
```typescript
placeIdol: (placed) =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            idolGrid: [...(s.activeBuild.idolGrid ?? []), placed],
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),

clearIdolSlot: (idolId) =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            idolGrid: (s.activeBuild.idolGrid ?? []).filter((p) => p.id !== idolId),
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),

resetIdolGrid: () =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            idolGrid: [],
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),
```

Also update `createBuild` to initialize the new fields in the created build object:
```typescript
idolGrid: [],
blessings: {},
activeConditions: [],
```

### 3. Serializer Update — `shared/utils/buildSnapshotSerializer.ts`

Replace the `idolPlacements: []` stub:

```typescript
idolPlacements: toIdolPlacements(build.idolGrid ?? []),
```

Add the helper function:

```typescript
function toIdolPlacements(idolGrid: IdolGridState): IdolPlacementTS[] {
  return idolGrid.map((placed) => ({
    row: placed.row,
    col: placed.col,
    idolSize: placed.idolTypeId,
    // prefix and suffix populated in Story 3.2
  }))
}
```

Import `IdolGridState` from `'../types/build'`.

### 4. New Feature — `features/idol-grid/`

Create a new feature folder: `lebo/src/features/idol-grid/`

**Files to create:**
- `IdolGrid.tsx` — main grid component
- `IdolGrid.test.tsx` — tests
- `idolGridUtils.ts` — placement validation logic (pure functions, testable)

### 5. Placement Validation — `idolGridUtils.ts`

```typescript
import type { IdolType, IdolGrid as IdolGridConfig } from '../../shared/types/contextDatabase'
import type { PlacedIdol } from '../../shared/types/build'

export function getCellsForPlacement(
  row: number,
  col: number,
  idolType: IdolType,
): [number, number][] {
  const cells: [number, number][] = []
  for (let r = row; r < row + idolType.rows; r++) {
    for (let c = col; c < col + idolType.cols; c++) {
      cells.push([r, c])
    }
  }
  return cells
}

export function isBlockedCell(
  row: number,
  col: number,
  gridConfig: IdolGridConfig,
): boolean {
  return gridConfig.blockedCells.some(([br, bc]) => br === row && bc === col)
}

export function isOccupiedByAnother(
  cells: [number, number][],
  existing: PlacedIdol[],
  types: IdolType[],
): boolean {
  const occupiedCells = new Set<string>()
  for (const p of existing) {
    const t = types.find((t) => t.id === p.idolTypeId)
    if (!t) continue
    for (let r = p.row; r < p.row + t.rows; r++) {
      for (let c = p.col; c < p.col + t.cols; c++) {
        occupiedCells.add(`${r},${c}`)
      }
    }
  }
  return cells.some(([r, c]) => occupiedCells.has(`${r},${c}`))
}

export interface PlacementResult {
  valid: boolean
  error?: string
}

export function validatePlacement(
  row: number,
  col: number,
  idolType: IdolType,
  gridConfig: IdolGridConfig,
  existing: PlacedIdol[],
  allTypes: IdolType[],
): PlacementResult {
  const cells = getCellsForPlacement(row, col, idolType)
  for (const [r, c] of cells) {
    if (r < 0 || r >= gridConfig.rows || c < 0 || c >= gridConfig.cols) {
      return { valid: false, error: `${idolType.displayName} does not fit within the grid at this position` }
    }
    if (isBlockedCell(r, c, gridConfig)) {
      return { valid: false, error: `${idolType.displayName} would overlap a blocked cell` }
    }
  }
  if (isOccupiedByAnother(cells, existing, allTypes)) {
    return { valid: false, error: `${idolType.displayName} overlaps an existing idol` }
  }
  return { valid: true }
}

// Returns the PlacedIdol that occupies a given cell (if any)
export function getOccupantAt(
  row: number,
  col: number,
  placed: PlacedIdol[],
  types: IdolType[],
): PlacedIdol | null {
  for (const p of placed) {
    const t = types.find((t) => t.id === p.idolTypeId)
    if (!t) continue
    if (row >= p.row && row < p.row + t.rows && col >= p.col && col < p.col + t.cols) {
      return p
    }
  }
  return null
}
```

### 6. Grid Component — `IdolGrid.tsx`

Key design points:
- Reads `idolData` from `useGameDataStore((s) => s.idolData)`
- Reads `idolGrid` from `useBuildStore((s) => s.activeBuild?.idolGrid ?? [])`
- Calls `useBuildStore.getState().placeIdol(...)`, `clearIdolSlot(...)`, `resetIdolGrid()`
- If `idolData` is null (loading), renders a loading placeholder
- Uses the grid config from `idolData.defaultGrid` (rows=5, cols=5, blockedCells)
- Uses `idolData.idolTypes` for the size picker

**Cell visual states:**
- Blocked: dark gray, `cursor-not-allowed`, `aria-disabled="true"`, no interaction
- Empty: interactive, shows "+" or click-to-place affordance
- Occupied (top-left cell of idol): shows idol type name + "×" clear button; spans visually across the idol's footprint using CSS or absolute positioning

**Placement flow (state machine within the component):**
1. Player clicks an empty cell → opens a size picker (inline dropdown or small popover listing idol types)
2. Player selects a size type → `validatePlacement` runs
3. If valid: `placeIdol({ id: crypto.randomUUID(), row, col, idolTypeId: type.id })`
4. If invalid: show an error message inline (not a toast — display near the grid, clear on next interaction)

**Rendering the grid:**
```tsx
<div
  data-testid="idol-grid"
  className="grid"
  style={{ gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))` }}
>
  {Array.from({ length: gridConfig.rows }, (_, row) =>
    Array.from({ length: gridConfig.cols }, (_, col) => {
      // determine cell state: blocked, top-left of idol, interior of idol, or empty
    })
  )}
</div>
```

**Interior cells of a multi-cell idol:** render as `visually-occupied` (same fill as the idol) but with no interaction. The top-left cell owns the clear button.

**Reset button:** a single "Reset all idols" button below the grid. Calls `resetIdolGrid()`.

**Error display:** a `<p role="alert">` element below the grid that shows the last placement error, cleared when any placement succeeds or when the selection changes.

### 7. Integration — `ContextPanel.tsx`

Replace `IdolInput` with `IdolGrid`:

```tsx
import { IdolGrid } from '../idol-grid/IdolGrid'
```

The `DisclosurePanel` content changes from `<IdolInput />` to `<IdolGrid />`. The `filledIdolCount` count stat can change to count `idolGrid.length` from the store (representing placed idols, not the legacy `contextData.idols`).

**Do not delete `IdolInput.tsx`** — it tests pass currently and removing it risks breaking the build. Simply stop using it in `ContextPanel.tsx`. It will be cleaned up in a follow-up story.

### 8. Accessibility Requirements

- Grid cells have `role="gridcell"` or use native `<button>` for interactive cells
- Blocked cells: `aria-disabled="true"` and non-focusable
- Occupied cells: `aria-label="{idol type} placed. Press to clear."` on the clear button
- Empty cells: `aria-label="Empty cell, row {row+1} col {col+1}. Click to place an idol."`
- Size picker: accessible as a listbox or native `<select>` — `<select>` is acceptable for this story
- Focus rings: `outline: 2px solid var(--color-accent-gold)` on all interactive elements
- Error region: `role="alert"` so screen readers announce placement errors

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/shared/types/build.ts` | MODIFY | Add `PlacedIdol`, `IdolGridState`, update `BuildState` |
| `lebo/src/shared/stores/buildStore.ts` | MODIFY | Add `placeIdol`, `clearIdolSlot`, `resetIdolGrid` actions |
| `lebo/src/shared/utils/buildSnapshotSerializer.ts` | MODIFY | Replace `idolPlacements: []` stub |
| `lebo/src/features/idol-grid/idolGridUtils.ts` | CREATE | Pure placement validation helpers |
| `lebo/src/features/idol-grid/IdolGrid.tsx` | CREATE | 5×5 grid component |
| `lebo/src/features/idol-grid/IdolGrid.test.tsx` | CREATE | Tests |
| `lebo/src/features/context-panel/ContextPanel.tsx` | MODIFY | Replace `IdolInput` import with `IdolGrid` |

**Do not touch:**
- `IdolInput.tsx` — leave in place, just stop using it in `ContextPanel.tsx`
- All Rust files — no scoring changes in this story
- `useStatSheet.ts`, `gameDataStore.ts` — read-only references
- `StatSheetPanel.tsx` — no changes needed

---

## Architecture & Pattern Compliance

**Pattern 1** — `buildSnapshotSerializer.ts` is the only conversion point from `BuildState` to `BuildSnapshot`. The `IdolGrid` component must not call `invokeCommand` directly.

**Store access in components** — Always use `useBuildStore((s) => s.activeBuild?.idolGrid ?? [])` for reading. For writes, use `useBuildStore.getState().placeIdol(...)` — consistent with how `IdolInput` calls `updateContextIdols`.

**No barrel files** — named exports only; no `index.ts` in `features/idol-grid/`.

**No default exports** — all exports are named.

**Testing pattern** — Mock stores using `vi.mock(...)` with `vi.fn()` implementations. Do not use `vi.mocked()` — use the mock implementations directly as shown in `StatSheetPanel.test.tsx` and `ContextPanel.test.tsx`.

---

## Previous Story Intelligence (from 2.6)

From the spec-2-6 review notes:
- Tab component pattern uses `@headlessui/react` (TabGroup/TabList/Tab) — not needed here, but the Disclosure pattern used in `ContextPanel.tsx` is the right model for the Idols accordion section
- Tests use `vi.mock(...)` for store isolation — follow the same pattern
- Focus rings: `outline: 2px solid var(--color-accent-gold)` via `data-[focus]:` Tailwind or inline style on keyboard focus events

The `buildSnapshotSerializer.ts` has a clear comment marking `idolPlacements: []` as the Epic 3 stub — update it, don't ignore it. The serializer comment says:
```
// Epic 3 adds structured idol grid state (IdolItem has no row/col)
```
This is the primary serializer integration point for this story.

---

## Key Existing Code to Read Before Implementing

Before coding, read these files in full:

1. **`lebo/src/shared/types/build.ts`** — Current `BuildState`, `IdolItem` (legacy type), `GearItemV2` pattern to follow
2. **`lebo/src/shared/stores/buildStore.ts`** — Complete store including `updateContextIdols` (pattern to follow for new idol actions)
3. **`lebo/src/shared/utils/buildSnapshotSerializer.ts`** — The stub to replace; understand `IdolPlacementTS` shape
4. **`lebo/src/features/context-panel/ContextPanel.tsx`** — How Disclosure wraps existing sections; where `IdolGrid` plugs in
5. **`lebo/src/features/context-panel/IdolInput.tsx`** — Understand what it does (do not delete; just stop importing it in `ContextPanel.tsx`)
6. **`lebo/src/shared/types/contextDatabase.ts`** — `IdolData`, `IdolType`, `IdolGrid`, `IdolAffix` types — these are the source-of-truth types from `idol-data.json`
7. **`lebo/src-tauri/resources/context-data/idol-data.json`** — Actual grid config and idol types: 4 size types (`small-1x1`, `humble-1x2`, `stout-1x3`, `grand-2x2`)

---

## Idol Data Reference (from `idol-data.json`)

The grid config (from `defaultGrid`):
- `rows: 5`, `cols: 5`
- `blockedCells: [[0,0],[0,4],[4,0],[4,4],[2,2]]` — 4 corners + center

The 4 idol size types:
| `idolTypeId` | `displayName` | rows | cols | `requiresBoth` |
|---|---|---|---|---|
| `small-1x1` | Small Idol | 1 | 1 | false (only prefix) |
| `humble-1x2` | Humble Idol | 1 | 2 | true |
| `stout-1x3` | Stout Idol | 1 | 3 | true |
| `grand-2x2` | Grand Idol | 2 | 2 | true |

The size picker shown to the user should show these 4 options. Each idol's `rows`/`cols` defines how many grid cells it occupies. The idol occupies cells `[row..row+rows-1][col..col+cols-1]`.

---

## Testing Requirements

**`IdolGrid.test.tsx`** — Tests to write:

1. **Renders 5×5 grid** — 25 cells render when `idolData` is present
2. **Blocked cells are non-interactive** — Corners and center are `aria-disabled="true"` and have no click handler
3. **Places a 1×1 idol** — Clicking an empty cell, selecting "Small Idol", calls `placeIdol` with correct row/col/idolTypeId
4. **Rejects overlapping placement** — Placing a 2×2 when a 1×2 already occupies part of that space shows an error message
5. **Clear slot removes idol** — Clicking clear on a placed idol calls `clearIdolSlot` with the idol's id
6. **Reset all** — "Reset all idols" button calls `resetIdolGrid()`
7. **Persists on store** — Grid re-reads from `useBuildStore` state (store mock returns placed idols, they render as occupied)
8. **Loading state** — When `idolData` is null, renders a loading placeholder
9. **Accessibility** — `expect(await axe(container)).toHaveNoViolations()` passes

**`idolGridUtils.test.ts`** — Unit tests for pure functions:

1. `getCellsForPlacement(0, 0, 2×2idol)` → returns `[[0,0],[0,1],[1,0],[1,1]]`
2. `validatePlacement` rejects out-of-bounds (e.g., 1×3 at col=3 would extend to col=5)
3. `validatePlacement` rejects blocked cell overlap (e.g., 1×1 at (0,0))
4. `validatePlacement` rejects occupied cell overlap
5. `validatePlacement` accepts a valid 2×2 in the bottom-right (rows 3-4, cols 3-4)
6. `getOccupantAt` returns the correct placed idol or null

---

## Verification Commands

From `lebo/`:
```bash
pnpm build        # zero TypeScript errors
pnpm vitest       # idol-grid tests pass; no regressions in other tests
```

Expected test baseline: 8 pre-existing failures (from Story 2.6 baseline) — no new failures.

---

## Dev Notes

- The `buildStore.createBuild` function initializes `contextData: { gear: [], skills: [], idols: [] }` — also add `idolGrid: [], blessings: {}, activeConditions: []` here so fresh builds always start with empty state
- When rendering interior cells of a multi-cell idol (e.g., a 1×3 occupying cells (1,0), (1,1), (1,2)), only the cell at (1,0) (top-left) shows the clear button. The other cells render as occupied/filled but have no interaction.
- The `idolTypeId` in `PlacedIdol` maps exactly to `IdolType.id` in `idol-data.json` — e.g., `"humble-1x2"`. The component resolves the type object via `idolData.idolTypes.find((t) => t.id === placed.idolTypeId)`.
- For Story 3.2: the `PlacedIdol` type will be extended with `prefixId?: string`, `prefixTier?: number`, `suffixId?: string`, `suffixTier?: number`. Story 3.1 must NOT add these fields — that is 3.2's scope.
- The existing `buildSnapshotSerializer.ts` already has the `IdolPlacementTS` interface defined (with `prefix?` and `suffix?` as optional). The 3.1 implementation of `toIdolPlacements()` simply omits these optional fields.

## Dev Agent Record

### Implementation Notes

- Added `PlacedIdol`, `IdolGridState` types and updated `BuildState` with `idolGrid?`, `blessings?`, `activeConditions?` fields
- Added `placeIdol`, `clearIdolSlot`, `resetIdolGrid` store actions following existing pattern; updated `createBuild` to initialize new fields
- Replaced `idolPlacements: []` stub in `buildSnapshotSerializer.ts` with `toIdolPlacements()` helper
- Created `idolGridUtils.ts` with pure placement validation (getCellsForPlacement, isBlockedCell, isOccupiedByAnother, validatePlacement, getOccupantAt)
- Created `IdolGrid.tsx` with full 5×5 grid, blocked cells, placement flow (click → select picker → validate → place), clear per idol, reset all, inline error display
- Replaced `IdolInput` with `IdolGrid` in `ContextPanel.tsx`; idol count now shows "N placed"
- A11y: removed `role="grid/gridcell"` (requires row wrappers incompatible with CSS grid layout); interactive cells use native `<button>` with descriptive `aria-labels`; blocked cells use `aria-disabled/aria-hidden`; error region uses `role="alert"`; focus rings via inline `onFocus/onBlur`
- Updated `ContextPanel.test.tsx` mockBuild to include `idolGrid: []` (prevents infinite-loop from `?? []` creating new array each render) and updated idol count assertion

### Test Results

- `idolGridUtils.test.ts`: 14/14 pass
- `IdolGrid.test.tsx`: 9/9 pass
- Full suite: 834 passed, 8 pre-existing failures (no new regressions)
- `pnpm build`: zero TypeScript errors

### File List

- `lebo/src/shared/types/build.ts` — Added `PlacedIdol`, `IdolGridState`; updated `BuildState`
- `lebo/src/shared/stores/buildStore.ts` — Added idol grid actions; updated `createBuild`
- `lebo/src/shared/utils/buildSnapshotSerializer.ts` — Replaced idol stub with `toIdolPlacements()`
- `lebo/src/features/idol-grid/idolGridUtils.ts` — Created (pure validation helpers)
- `lebo/src/features/idol-grid/IdolGrid.tsx` — Created (grid component)
- `lebo/src/features/idol-grid/IdolGrid.test.tsx` — Created (9 tests)
- `lebo/src/features/idol-grid/idolGridUtils.test.ts` — Created (14 tests)
- `lebo/src/features/context-panel/ContextPanel.tsx` — Replaced IdolInput with IdolGrid
- `lebo/src/features/context-panel/ContextPanel.test.tsx` — Updated mockBuild + idol count assertion

### Change Log

- 2026-05-22: Story 3.1 implemented — idol grid builder with layout, placement validation, and store integration

---

## Senior Developer Review (AI)

**Date:** 2026-05-22
**Outcome:** Changes Requested
**Layers:** Blind Hunter · Edge Case Hunter · Acceptance Auditor
**Summary:** 4 High + 2 Medium patches, 1 decision needed, 5 deferred, 4 dismissed.

### Action Items

- [ ] [Review][Decision] AC2 — Placeholder affix slots missing: spec states "the idol's visual representation shows the idol type name and placeholder affix slots (affix selection configured in Story 3.2)" but the placed idol renders only the type name and clear button — no slot UI placeholders exist. Clarify: should 3.1 show empty/greyed affix slot placeholders, or was the intent that the full slot UI is deferred to 3.2? [`IdolGrid.tsx`]

- [ ] [Review][Patch] Interior cells of multi-cell idols break CSS Grid layout — occupied non-top-left cells are rendered as individual `<div aria-hidden>` elements that fill their own grid tracks; CSS Grid auto-places them after the spanning top-left cell, producing extra visible gold-tinted cells that push subsequent empty cells out of alignment [`IdolGrid.tsx` occupant+!isTopLeft branch]

- [ ] [Review][Patch] `aspect-square` conflicts with `gridColumn: span N` on placed idol top-left cells — `aspect-ratio: 1/1` forces height equal to full spanned width, making a 1×2 idol render as a tall square and a 2×2 idol produce undefined sizing on both axes [`IdolGrid.tsx` occupant+isTopLeft branch]

- [ ] [Review][Patch] Blocked cells: `aria-hidden="true"` + `aria-disabled="true"` are contradictory — `aria-hidden` removes the element from the AT entirely, making `aria-disabled` invisible to screen readers; use `aria-disabled="true"` alone (no `aria-hidden`) to communicate non-interactivity while remaining perceivable [`IdolGrid.tsx` isBlocked branch]

- [ ] [Review][Patch] `onBlur`/`onChange` race on `<select>`: clicking a second empty cell while a picker is open triggers `handleCellClick` → `setPendingCell(newCell)`, then the select's `onBlur` fires → `setPendingCell(null)`, silently cancelling the new picker — the user sees nothing happen [`IdolGrid.tsx` select onBlur handler]

- [ ] [Review][Patch] Error state not cleared when select is dismissed via `onBlur` without choosing — TR5 requires error cleared on "selection change"; currently `onBlur` only calls `setPendingCell(null)` without clearing `placementError`, leaving a stale error message visible [`IdolGrid.tsx:154`]

- [ ] [Review][Patch] `buildSnapshotSerializer` test never exercises `toIdolPlacements` with actual placed idols — only tests the empty case; `toIdolPlacements` mapping (`idolTypeId` → `idolSize`) is unverified [`buildSnapshotSerializer.test.ts`]

### Deferred

- [x] [Review][Defer] Stale `idolGrid` closure in validation handlers — `idolGrid` captured at render time; low practical risk with Zustand reactive selectors and React 18 batching — deferred
- [x] [Review][Defer] Unknown `idolTypeId` silently skipped in `isOccupiedByAnother` — corrupted PlacedIdol becomes invisible to overlap detection; edge case for saved data; defer to 3.2 data validation story [`idolGridUtils.ts:isOccupiedByAnother`]
- [x] [Review][Defer] `idolSize` field sends full `idolTypeId` string (e.g. `"grand-2x2"`) — Rust contract for this field not yet defined; intentional scaffolding per comments; revisit in 3.2 when scoring consumes it [`buildSnapshotSerializer.ts:toIdolPlacements`]
- [x] [Review][Defer] `applyNodeChange` fallback build construction missing `idolGrid`/`blessings`/`activeConditions` — pre-existing pattern, not introduced by this story [`buildStore.ts`]
- [x] [Review][Defer] Build persistence round-trip for `idolGrid` untested — `buildPersistence.test.ts` does not verify `idolGrid` survives a save/load cycle [`buildPersistence.test.ts`]
