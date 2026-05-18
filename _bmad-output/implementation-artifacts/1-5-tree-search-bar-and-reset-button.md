# Story 1.5: Tree Search Bar and RESET Button

Status: done

## Story

As a theory-crafter,
I want a search bar that highlights matching nodes and a RESET button that clears all allocations in the active tree,
So that I can quickly navigate large trees and undo all allocation choices at once.

## Acceptance Criteria

1. **Given** a skill or passive tree is displayed in the canvas
   **When** the player types text in the search bar (positioned top-right of controls row, 200px wide, 28px height)
   **Then** matching nodes are immediately highlighted with a gold outline; non-matching nodes render at 40% opacity; filtering is synchronous with no debounce

2. **Given** the search bar has text and the player clicks the × button or presses Escape
   **When** the input is cleared
   **Then** all nodes return to their normal visual state immediately

3. **Given** the player clicks the RESET button (left of controls row, same row as search bar)
   **When** the active tree has any node allocations
   **Then** all nodeAllocations (passive) or skillNodeAllocations[slotId] (skill) for the active tree are cleared to 0, the change is pushed to the undoStack (MAX_UNDO_STACK = 10), and the canvas re-renders with all nodes in their default state

4. **Given** the player presses Ctrl+Z after a RESET
   **When** the undoStack has the pre-RESET state
   **Then** all allocations are restored to their prior state (handled by existing `undoNodeChange` — no new undo logic needed)

5. **And** the RESET button is styled as a secondary outlined button (1px `--color-accent-gold-soft` border, transparent background) at 28px height; no confirmation dialog

6. **And** the search bar and RESET button apply to all tree views: passive trees, active skill trees, and the Weaver Tree tab (when implemented in Story 4.2)

## Tasks / Subtasks

- [x] Task 1: Extend `HighlightedNodes` type and update PixiJS renderer (AC: #1)
  - [x] **`src/shared/types/treeData.ts`**: Add two fields to `HighlightedNodes`:
    ```typescript
    export interface HighlightedNodes {
      glowing: Set<string>
      dimmed: Set<string>
      previewRemoved: Set<string>
      previewAdded: Set<string>
      searchHighlighted: Set<string>   // ADD: matched search nodes → gold ring overlay
      searchDimmed: Set<string>        // ADD: non-matching nodes → 40% opacity overlay
    }
    ```
  - [x] **`src/features/skill-tree/pixiRenderer.ts`**: Add two new Graphics objects and two new draw functions, update `renderTree`:
    - After `previewAddedGraphics` declaration, add:
      ```typescript
      const searchDimOverlayGraphics = new Graphics()
      const searchHighlightGraphics = new Graphics()
      ```
    - Add both to `worldContainer.addChild(...)` AFTER `previewAddedGraphics`, BEFORE `labelContainer`:
      ```typescript
      worldContainer.addChild(
        edgeGraphics,
        lockedGraphics,
        availableGraphics,
        allocatedGraphics,
        dimmedGraphics,
        suggestedGraphics,
        previewRemovedGraphics,
        previewAddedGraphics,
        searchDimOverlayGraphics,    // ADD: drawn on top of node state
        searchHighlightGraphics,     // ADD: drawn on top of dim overlay
        labelContainer,
        flashContainer,
        hitAreaContainer,
      )
      ```
    - Add two draw functions (after `drawPreviewAdded`):
      ```typescript
      function drawSearchDimOverlay(g: Graphics, x: number, y: number, r: number) {
        // Draws a semi-transparent dark overlay achieving ~40% visibility on the underlying node
        g.circle(x, y, r + 2).fill({ color: 0x0a0a0b, alpha: 0.6 })
      }
      function drawSearchHighlight(g: Graphics, x: number, y: number, r: number) {
        // Gold outer ring distinguishes search-matched nodes
        g.circle(x, y, r + 4).stroke({ color: 0xc9a84c, width: 2 })
      }
      ```
    - In `renderTree`, clear the two new graphics at the start (alongside the others):
      ```typescript
      searchDimOverlayGraphics.clear()
      searchHighlightGraphics.clear()
      ```
    - In the node loop, after the existing draw call for each node, add search overlay rendering. These run as OVERLAYS on top of the normal state draw — they do NOT replace it:
      ```typescript
      const isSearchHighlighted = highlightedNodes.searchHighlighted.has(node.id)
      const isSearchDimmed = highlightedNodes.searchDimmed.has(node.id)
      // Draw overlays after state-based draw
      if (isSearchDimmed) drawSearchDimOverlay(searchDimOverlayGraphics, node.x, node.y, r)
      if (isSearchHighlighted) drawSearchHighlight(searchHighlightGraphics, node.x, node.y, r)
      ```

- [x] Task 2: Add `resetActiveTree` action to `buildStore.ts` (AC: #3, #4)
  - [x] **`src/shared/stores/buildStore.ts`**: Add to `BuildStore` interface:
    ```typescript
    resetActiveTree: (treeType: 'passive' | 'skill', slotId?: string) => void
    ```
  - [x] Add implementation after `applySkillNodeChange`:
    ```typescript
    resetActiveTree: (treeType, slotId) => {
      const { activeBuild, undoStack } = get()
      if (!activeBuild) return
      const newUndoStack = [...undoStack, activeBuild].slice(-MAX_UNDO_STACK)
      if (treeType === 'passive') {
        set({
          activeBuild: {
            ...activeBuild,
            nodeAllocations: {},
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
          undoStack: newUndoStack,
        })
      } else if (treeType === 'skill' && slotId) {
        set({
          activeBuild: {
            ...activeBuild,
            skillNodeAllocations: { ...activeBuild.skillNodeAllocations, [slotId]: {} },
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
          undoStack: newUndoStack,
        })
      }
    },
    ```
  - [x] RESET pushes the FULL pre-reset `BuildState` snapshot to the `undoStack` exactly like `applyNodeChange` does. Ctrl+Z via existing `undoNodeChange` restores it automatically — no new undo logic needed.

- [x] Task 3: Create `TreeControls.tsx` component (AC: #1, #2, #3, #5)
  - [x] **`src/features/skill-tree/TreeControls.tsx`** (NEW):
    ```typescript
    interface TreeControlsProps {
      searchQuery: string
      onSearchChange: (query: string) => void
      onReset: () => void
    }
    ```
  - [ ] Layout: flex row, `px-3 py-1`, `borderBottom: '1px solid var(--color-bg-elevated)'`, height 36px, align items center, gap 2
  - [ ] RESET button (left):
    - 28px height, transparent background, `1px solid var(--color-accent-gold-soft)` border, `4px` borderRadius
    - Text: "Reset", 12px, `--color-accent-gold-soft` color
    - `onClick={onReset}` — no confirmation dialog
    - `type="button"` (prevents form submission if ever nested)
    - Focus ring: global `:focus-visible` handles it (2px solid --color-accent-gold); do NOT add `outline: none`
  - [ ] Search input (right, pushed to flex end with `marginLeft: 'auto'`):
    - `<div style={{ position: 'relative', width: 200 }}>` wrapper
    - `<input type="text" placeholder="Search nodes…" value={searchQuery} onChange={e => onSearchChange(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onSearchChange('') }}`
    - Input styles: `width: '100%'`, `height: 28`, `paddingLeft: 8`, `paddingRight: searchQuery ? 24 : 8`, `fontSize: 12`, background `--color-bg-elevated`, border `1px solid var(--color-bg-elevated)`, borderRadius 4, color `--color-text-primary`
    - Focus border: `outline: none; border-color: var(--color-accent-gold)` via className or inline style on focus (use React `onFocus`/`onBlur` state to toggle, OR just use Tailwind `focus:border-[var(--color-accent-gold)]`)
    - × clear button: only render when `searchQuery !== ''`:
      ```tsx
      {searchQuery && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onSearchChange('')}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}
        >
          ×
        </button>
      )}
      ```
    - `aria-label="Search skill tree nodes"` on the input
  - [ ] No `useReducedMotion` needed — no animations in TreeControls

- [x] Task 4: Wire `TreeControls` into `SkillTreeView.tsx` and compute search sets (AC: #1, #2, #3, #6)
  - [x] **`src/features/skill-tree/SkillTreeView.tsx`**:
  
  **4a. Update `EMPTY_HIGHLIGHTED` constant** (at top of file, before the component):
  ```typescript
  const EMPTY_HIGHLIGHTED: HighlightedNodes = {
    glowing: EMPTY_SET,
    dimmed: EMPTY_SET,
    previewRemoved: EMPTY_SET,
    previewAdded: EMPTY_SET,
    searchHighlighted: EMPTY_SET,   // ADD
    searchDimmed: EMPTY_SET,        // ADD
  }
  ```
  
  **4b. Add store subscription** (with other store subscriptions at the top of `SkillTreeView`):
  ```typescript
  const resetActiveTree = useBuildStore((s) => s.resetActiveTree)
  ```
  
  **4c. Add search state** (with other `useState` calls):
  ```typescript
  const [searchQuery, setSearchQuery] = useState('')
  ```
  
  **4d. Move `activeGameNodes` to a `useMemo`** — it's currently a plain expression AFTER the early returns (line ~266). Move it BEFORE the early returns and wrap it in `useMemo` so it can be used in search memos:
  ```typescript
  // Replace the existing plain `const activeGameNodes = ...` with this memo BEFORE early returns:
  const activeGameNodes = useMemo<Record<string, GameNode>>(
    () => isPassiveTab
      ? allGameNodes
      : (activeSkill ? (classData?.skillTrees[activeSkill.skillId] ?? {}) : {}),
    [isPassiveTab, allGameNodes, activeSkill, classData]
  )
  ```
  Remove the duplicate `const activeGameNodes` line that currently appears after the early returns.
  
  **4e. Add search memos** (after `skillTreeData` and `activeGameNodes` memos, before `filteredSkills`):
  ```typescript
  const activeTreeData = isPassiveTab ? treeData : skillTreeData
  
  const searchHighlighted = useMemo<Set<string>>(() => {
    if (!searchQuery || !activeTreeData) return EMPTY_SET
    const q = searchQuery.toLowerCase()
    return new Set(
      activeTreeData.nodes
        .filter((n) => (activeGameNodes[n.id]?.name ?? '').toLowerCase().includes(q))
        .map((n) => n.id)
    )
  }, [searchQuery, activeTreeData, activeGameNodes])
  
  const searchDimmed = useMemo<Set<string>>(() => {
    if (!searchQuery || !activeTreeData) return EMPTY_SET
    const q = searchQuery.toLowerCase()
    return new Set(
      activeTreeData.nodes
        .filter((n) => !(activeGameNodes[n.id]?.name ?? '').toLowerCase().includes(q))
        .map((n) => n.id)
    )
  }, [searchQuery, activeTreeData, activeGameNodes])
  ```
  Note: `activeTreeData` is a `const` (not a hook), so it does not violate hooks rules. The memos reference it via closure.
  
  **4f. Add merged highlighted nodes memos** (after existing `highlightedNodes` memo):
  ```typescript
  // For passive tab: merge optimization highlights with search highlights
  const passiveHighlightedNodes = useMemo<HighlightedNodes>(
    () => ({ ...highlightedNodes, searchHighlighted, searchDimmed }),
    [highlightedNodes, searchHighlighted, searchDimmed]
  )
  // For skill tab: no optimization highlights, just search
  const skillHighlightedNodes = useMemo<HighlightedNodes>(
    () => ({ ...EMPTY_HIGHLIGHTED, searchHighlighted, searchDimmed }),
    [searchHighlighted, searchDimmed]
  )
  ```
  
  **4g. Add `handleReset` callback** (with other `useCallback` handlers):
  ```typescript
  const handleReset = useCallback(() => {
    if (isPassiveTab) {
      resetActiveTree('passive')
    } else if (slotId) {
      resetActiveTree('skill', slotId)
    }
    setSearchQuery('')
  }, [isPassiveTab, slotId, resetActiveTree])
  ```
  
  **4h. Clear search on tab switch** — update `handleTabChange`:
  ```typescript
  const handleTabChange = useCallback((index: number) => {
    setActiveTabIndex(index)
    setPickerState(null)
    setSearchQuery('')    // ADD: clear search when switching tabs
  }, [])
  ```
  
  **4i. Compute `showControls` flag** (after `isPickerFullPanel` computation):
  ```typescript
  const showControls =
    isPassiveTab
      ? treeData !== null
      : activeSkill !== null && skillTreeData !== null && !isPickerFullPanel
  ```
  
  **4j. Add `TreeControls` import** at top of file:
  ```typescript
  import { TreeControls } from './TreeControls'
  ```
  
  **4k. Render `TreeControls` in JSX** — inside the main `return` block, after the skill header strip and BEFORE the main canvas div:
  ```tsx
  {showControls && (
    <TreeControls
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onReset={handleReset}
    />
  )}
  ```
  
  **4l. Update `SkillTreeCanvas` `highlightedNodes` props**:
  - Passive tab canvas: replace `highlightedNodes={highlightedNodes}` → `highlightedNodes={passiveHighlightedNodes}`
  - Skill tab canvas: replace `highlightedNodes={EMPTY_HIGHLIGHTED}` → `highlightedNodes={skillHighlightedNodes}`

- [x] Task 5: Update test files for new `HighlightedNodes` fields (AC: compile/test)
  - [x] **`src/features/skill-tree/SkillTreeCanvas.test.tsx`**: In `DEFAULT_PROPS.highlightedNodes`, add:
    ```typescript
    highlightedNodes: {
      glowing: new Set<string>(),
      dimmed: new Set<string>(),
      previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(),
      searchHighlighted: new Set<string>(),   // ADD
      searchDimmed: new Set<string>(),         // ADD
    }
    ```
  - [x] **`src/features/skill-tree/pixiRenderer.test.ts`**: Both `renderTree` calls at lines 110 and 115 need updating:
    ```typescript
    renderer.renderTree(emptyTree, {}, {
      glowing: new Set(), dimmed: new Set(),
      previewRemoved: new Set(), previewAdded: new Set(),
      searchHighlighted: new Set(), searchDimmed: new Set(),  // ADD
    })
    ```
  - [x] **Scan for any other files** that construct `HighlightedNodes` objects directly (not via EMPTY_HIGHLIGHTED). Run: `grep -r "previewAdded: new Set"` to find all. The grep result showed only these two test files plus SkillTreeCanvas.test.tsx — update all found occurrences.

- [x] Task 6: Unit tests (AC: #3, #4)
  - [x] **`src/shared/stores/buildStore.test.ts`** (existing file — add to it):
    - Test: `resetActiveTree('passive')` clears `nodeAllocations` and pushes to `undoStack`
      ```typescript
      it('resetActiveTree("passive") clears passive allocations and pushes undo snapshot', () => {
        const store = useBuildStore.getState()
        store.createBuild('void_knight')
        store.applyNodeChange('node-a', 1, minimalTreeData)
        expect(store.activeBuild!.nodeAllocations['node-a']).toBe(1)
        store.resetActiveTree('passive')
        expect(store.activeBuild!.nodeAllocations).toEqual({})
        expect(useBuildStore.getState().undoStack.length).toBeGreaterThan(0)
      })
      ```
    - Test: `undoNodeChange` after reset restores allocations
    - Test: `resetActiveTree('skill', 'slot-0')` clears `skillNodeAllocations['slot-0']` only, leaves other slots intact
    - Test: `resetActiveTree` with no active build does nothing (no throw)
    - Use the existing `minimalTreeData` fixture pattern already in the file
  - [x] **`src/features/skill-tree/TreeControls.test.tsx`** (NEW file, co-located with `TreeControls.tsx`):
    - Test: renders RESET button and search input
    - Test: typing in search input calls `onSearchChange` with the typed value
    - Test: clicking × clears search (calls `onSearchChange('')`)
    - Test: pressing Escape in input clears search
    - Test: clicking RESET calls `onReset`
    - Test: × button is not rendered when `searchQuery === ''`
    - Test: axe-core passes zero violations (import `axe` from `vitest-axe`)
    ```typescript
    import { axe } from 'vitest-axe'
    it('passes accessibility check', async () => {
      const { container } = render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
      expect(await axe(container)).toHaveNoViolations()
    })
    ```

## Dev Notes

### Critical Architecture Patterns

**HighlightedNodes type is shared** — it's in `src/shared/types/treeData.ts` and re-exported from `src/features/skill-tree/types.ts` via `export type { HighlightedNodes }`. Adding fields to the interface requires updating ALL sites that construct `HighlightedNodes` objects (not just the ones that use the type annotation). The grep for `previewAdded: new Set` found exactly: `pixiRenderer.test.ts` (2 locations) and `SkillTreeCanvas.test.tsx` (1 location). Also update `EMPTY_HIGHLIGHTED` in `SkillTreeView.tsx`.

**No barrel files**: `TreeControls.tsx` lives in `src/features/skill-tree/` (not a new folder). Import directly from `./TreeControls`.

**No new stores**: `searchQuery` is local `useState` in `SkillTreeView`. `resetActiveTree` goes into existing `useBuildStore`.

**SkillTreeCanvas is props-only**: Search highlighting is computed in `SkillTreeView` and passed as `highlightedNodes` prop. Never access Zustand or search state inside `SkillTreeCanvas` or `pixiRenderer.ts`.

**useMemo vs plain const for `activeGameNodes`**: The existing line `const activeGameNodes = isPassiveTab ? allGameNodes : (...)` appears AFTER the early returns in the current code. This is valid JS/TS but means search memos (hooks) cannot safely reference it via closure since hooks must be called before conditional returns. Solution: move `activeGameNodes` before the early returns as a `useMemo`. The dependency array is `[isPassiveTab, allGameNodes, activeSkill, classData]`.

### Search Implementation Details

**Why overlay pattern (not replace)**: The story requires non-matching nodes to be at "40% opacity" — meaning their state (allocated/locked/available) should still be visible but dimmed. The existing `drawDimmed` REPLACES the state draw entirely. Using overlay graphics preserves state visibility while dimming: `drawSearchDimOverlay` draws a `0.6 alpha` dark circle on top of the normally-rendered node, leaving ~40% of the original color visible.

**Gold ring for matched nodes**: `drawSearchHighlight` draws a 2px gold stroke ring at `r+4` (just outside the node). This is visually distinct from `drawSuggested` (which draws a purple glow at `r+6`). Matched nodes render their normal state + the gold ring on top.

**Search sets are empty when no query**: Both `searchHighlighted` and `searchDimmed` return `EMPTY_SET` (the frozen empty set constant) when `searchQuery === ''`. This means the overlay graphics are cleared and no-op when search is inactive.

**Node name lookup**: `TreeNode` has no `name` field — names come from `GameNode` keyed by node ID. The `activeGameNodes` record maps `nodeId → GameNode`. For passive: `allGameNodes` (base tree + mastery). For skill: `classData.skillTrees[activeSkill.skillId]`. Both are covered by the `activeGameNodes` memo.

**Synchronous filtering**: No debounce per UX-DR11. The `useMemo` recalculates synchronously on every keystroke. For typical tree sizes (50-200 nodes) this is under 1ms.

### RESET Button Behavior

**No confirmation dialog** — per story spec. RESET is immediate on click.

**Undo is automatic**: `resetActiveTree` pushes `activeBuild` to `undoStack` (same pattern as `applyNodeChange`). The existing `undoNodeChange` action and Ctrl+Z handler in `SkillTreeView` already handle restoring the full `BuildState` snapshot — no new undo logic.

**RESET also clears search**: `handleReset` calls `setSearchQuery('')` after `resetActiveTree(...)`. This prevents orphaned search highlight state after allocations are cleared.

**RESET on skill tab**: Targets `skillNodeAllocations[slotId]` only. Other skill slots are unaffected. Passive allocations are unaffected.

### TreeControls Layout Notes

Row height is 36px total (28px element height + 4px vertical padding). This sits between the skill header strip (if any) and the canvas div. The controls row has `borderBottom: '1px solid var(--color-bg-elevated)'` to visually separate it from the canvas.

The `showControls` condition prevents TreeControls from rendering when the picker is in full-panel mode (`isPickerFullPanel === true`) or when there's no tree to search (empty slot state). This matches the UX expectation — search/reset only make sense when a tree is visible.

### Two `HighlightedNodes` Merging Approach

Passive tab gets `passiveHighlightedNodes` which merges optimization highlights (`glowing`/`dimmed`/`previewRemoved`/`previewAdded`) from the existing `highlightedNodes` memo with search highlights. When search is active, matching nodes show both the optimization-suggested glow AND the search gold ring (additive — `searchHighlighted` and `glowing` are independent sets).

Skill tab gets `skillHighlightedNodes` which is `EMPTY_HIGHLIGHTED` + search sets. Skill tabs have no optimization highlighting currently (they use `EMPTY_HIGHLIGHTED` in the pre-story code).

### Story 1.4 Dev Notes (relevant patterns to preserve)

- `EMPTY_HIGHLIGHTED` constant is defined at the top of `SkillTreeView.tsx` — DO NOT define it inside the component function
- The `slotId` variable is `null` on the passive tab, `"slot-0"` through `"slot-4"` on skill tabs. `handleReset` checks `if (slotId)` before calling `resetActiveTree('skill', slotId)`
- `activeSkills` is subscribed via `useBuildStore((s) => s.activeBuild?.contextData.skills ?? EMPTY_SKILLS)` — do not re-read from store directly
- `handleTabChange` already calls `setPickerState(null)` — add `setSearchQuery('')` alongside it

### File Locations

```
src/shared/types/treeData.ts            — UPDATE: add 2 fields to HighlightedNodes
src/features/skill-tree/pixiRenderer.ts — UPDATE: 2 new Graphics + 2 functions + renderTree changes
src/features/skill-tree/SkillTreeView.tsx — UPDATE: search state, memos, TreeControls
src/shared/stores/buildStore.ts          — UPDATE: resetActiveTree action
src/features/skill-tree/TreeControls.tsx — NEW: search + reset controls row
src/features/skill-tree/TreeControls.test.tsx — NEW: tests for TreeControls
src/features/skill-tree/SkillTreeCanvas.test.tsx — UPDATE: add 2 fields to HighlightedNodes mock
src/features/skill-tree/pixiRenderer.test.ts — UPDATE: add 2 fields to HighlightedNodes mocks (2 locations)
src/shared/stores/buildStore.test.ts     — UPDATE: tests for resetActiveTree
```

### Project Context Rules (from project-context.md)

- **TypeScript strict mode**: `noUnusedLocals`/`noUnusedParameters` — every import and parameter must be used
- **No barrel files**: `import { TreeControls } from './TreeControls'` — not `from '.'`
- **No new Zustand stores**: `searchQuery` is local `useState`; `resetActiveTree` extends `useBuildStore`
- **Tailwind v4**: use `var(--color-*)` CSS custom properties; no `@apply`
- **NFR12**: RESET button and search input must have focus rings — global `:focus-visible` rule handles this automatically; do NOT add `outline: none` without replacement
- **NFR16**: No animations in TreeControls — no `useReducedMotion` needed here
- **Testing**: Vitest config in `vite.config.ts` under `test` key; `test-setup.ts` provides all stubs; no separate `vitest.config.ts`

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
None — clean implementation with one TypeScript fix required.

### Completion Notes List
- Task 1: Added `searchHighlighted` and `searchDimmed` to `HighlightedNodes` in `treeData.ts`. Added `searchDimOverlayGraphics` and `searchHighlightGraphics` Graphics objects to `pixiRenderer.ts`, wired into `worldContainer`, added `drawSearchDimOverlay` and `drawSearchHighlight` draw functions, and added overlay rendering in the node loop.
- Task 2: Added `resetActiveTree(treeType, slotId?)` action to `BuildStore` interface and implementation in `buildStore.ts`. Pattern mirrors `applyNodeChange` — pushes full `BuildState` to `undoStack` then clears the targeted allocations.
- Task 3: Created `TreeControls.tsx` with RESET button (left) and search input (right, 200px, 28px height). Clear (×) button renders only when `searchQuery !== ''`. Focus border toggles via React `onFocus`/`onBlur` state.
- Task 4: Wired `TreeControls` into `SkillTreeView.tsx`. Key changes: moved `activeGameNodes` to `useMemo` before early returns; added `searchHighlighted`/`searchDimmed` memos using `activeTreeData`; added `passiveHighlightedNodes` and `skillHighlightedNodes` merged memos; updated canvas props; added `handleReset` callback; added `showControls` flag; updated `handleTabChange` to clear search on tab switch.
- TypeScript fix: `HighlightedNodeIds` (optimizationStore) only has `glowing`/`dimmed`. In `highlightedNodes` memo, spread `EMPTY_HIGHLIGHTED` first to ensure all `HighlightedNodes` fields are present before spreading `highlightedNodeIds`.
- Task 5: Updated `SkillTreeCanvas.test.tsx` and `pixiRenderer.test.ts` (2 occurrences) with the two new `HighlightedNodes` fields.
- Task 6: Added 4 `resetActiveTree` tests to `buildStore.test.ts`. Created `TreeControls.test.tsx` with 8 tests including axe accessibility check.
- All 70 targeted tests pass. TypeScript build clean. 502/508 total tests pass (6 pre-existing failures in ProviderSelector/Settings unrelated to this story).

### Review Findings

**Decision-needed (2):**
- [x] [Review][Decision] `outline: none` on search input — resolved: keep Task 3's React-state focus border approach (current code unchanged). [`TreeControls.tsx`]
- [x] [Review][Decision] Optimizer-suggested node dimmed by search overlay — resolved: optimizer wins; added `&& !isGlowing` guard so suggested nodes are never dimmed by search. [`pixiRenderer.ts:253`]

**Patch (4):**
- [x] [Review][Patch] Main `SkillTreeTabBar` uses `setActiveTabIndex` not `handleTabChange` — fixed: changed to `handleTabChange` [`SkillTreeView.tsx:352`]
- [x] [Review][Patch] `cursor: 'none'` on × clear button — false positive; actual code already had `cursor: 'pointer'` [`TreeControls.tsx:~78`]
- [x] [Review][Patch] `resetActiveTree` pushes undo snapshot even when allocations already empty — fixed: early-return guard added before undo push [`buildStore.ts:158`]
- [x] [Review][Patch] `handleReset` calls `setSearchQuery('')` unconditionally — fixed: search cleared only inside the branch that fires [`SkillTreeView.tsx:~224`]

**Deferred (4):**
- [x] [Review][Defer] `activeTabIndex > 5` magic number replaces `>= 1 + activeSkills.length` — equivalent for current fixed 5-slot tab bar (Edge Case Hunter confirmed `SKILL_SLOT_LABELS` has 5 entries); dep array change to `[activeTabIndex]` is fragile if slots become dynamic [`SkillTreeView.tsx:83`] — deferred, pre-existing design constraint
- [x] [Review][Defer] `searchHighlighted` and `searchDimmed` memos each iterate `activeTreeData.nodes` independently — double traversal + double name lookup per keystroke; acceptable for current tree sizes (50–200 nodes) [`SkillTreeView.tsx:172`] — deferred, pre-existing
- [x] [Review][Defer] Inline `style` objects in `TreeControls` are recreated every render — every keystroke reallocates all style objects; switch to module-level constants or Tailwind classes to avoid churn [`TreeControls.tsx`] — deferred, pre-existing
- [x] [Review][Defer] Weaver Tree tab not covered by `showControls` (AC 6) — Story 4.2 work; will require revisiting `showControls` logic when Weaver Tree tab is implemented [`SkillTreeView.tsx:343`] — deferred, pre-existing

### File List
- `lebo/src/shared/types/treeData.ts` — updated: added `searchHighlighted`, `searchDimmed` to `HighlightedNodes`
- `lebo/src/features/skill-tree/pixiRenderer.ts` — updated: new Graphics objects, draw functions, renderTree changes
- `lebo/src/shared/stores/buildStore.ts` — updated: `resetActiveTree` interface + implementation
- `lebo/src/features/skill-tree/TreeControls.tsx` — new: search bar + RESET controls row component
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — updated: search state, memos, TreeControls wiring
- `lebo/src/features/skill-tree/TreeControls.test.tsx` — new: 8 tests for TreeControls
- `lebo/src/shared/stores/buildStore.test.ts` — updated: 4 tests for resetActiveTree
- `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` — updated: new HighlightedNodes fields in mock
- `lebo/src/features/skill-tree/pixiRenderer.test.ts` — updated: new HighlightedNodes fields in 2 renderTree calls

### Change Log
- 2026-05-07: Implemented Story 1.5 — Tree Search Bar and RESET Button. Added search overlay rendering pipeline to PixiJS renderer, `resetActiveTree` action to buildStore, new `TreeControls` component, and full wiring in `SkillTreeView`. 70 tests pass, build clean.
