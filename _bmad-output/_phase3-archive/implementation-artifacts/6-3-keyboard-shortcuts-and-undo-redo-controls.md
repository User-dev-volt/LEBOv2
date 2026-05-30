---
title: 'Keyboard Shortcuts & Undo/Redo Controls'
story_id: '6.3'
story_key: '6-3-keyboard-shortcuts-and-undo-redo-controls'
epic: 6
status: done
created: '2026-05-27'
---

## Story

**As a player,**
I want `Ctrl+Z`/`Cmd+Z` (undo) and `Ctrl+Y`/`Cmd+Y` (redo) keyboard shortcuts with visible ↩/↪ icon buttons in the tree controls bar,
**so that** I can quickly reverse and replay accidental passive tree (and skill/weaver tree) allocations with familiar keyboard conventions.

---

## Scope Clarification — CRITICAL

> **REVISED 2026-05-26 (sprint-status.yaml):** The original Story 6.3 also included C/S/P panel-focus shortcuts. Those are **superseded** by the 1–5 center-tab model already live in `App.tsx`. The `[`/`]` panel-collapse shortcuts are also already live.
>
> **This story's remaining scope:**
> 1. `Ctrl+Z` / `Cmd+Z` — undo (partially implemented, needs text-input guard + buttons)
> 2. `Ctrl+Y` / `Cmd+Y` — redo (not implemented at all — no store action, no keybinding, no button)
> 3. ↩ undo button + ↪ redo button in TreeControls bar (not implemented)

**Do NOT implement or touch:**
- The 1–5 center tab shortcuts (already live in `App.tsx`)
- The `[`/`]` panel-collapse shortcuts (already live in `App.tsx`)
- Any C/S/P panel-focus shortcuts (superseded)

---

## Acceptance Criteria

**AC1 — Undo keyboard shortcut:**
**Given** the app is open with tree allocations made
**When** user presses `Ctrl+Z` (Windows) or `Cmd+Z` (macOS)
**Then** the most recent tree allocation is undone (passive, skill, or weaver — whatever was last)
**And** pressing Ctrl+Z when `undoStack` is empty is a no-op (no crash)

**AC2 — Redo keyboard shortcut:**
**Given** the app is open and an undo has been performed
**When** user presses `Ctrl+Y` (Windows) or `Cmd+Y` (macOS)
**Then** the most recently undone action is re-applied
**And** pressing Ctrl+Y when `redoStack` is empty is a no-op

**AC3 — Text-input focus guard:**
**Given** a text input is focused (affix search, blessing search, node search, level input, etc.)
**When** the user presses `Ctrl+Z` or `Ctrl+Y`
**Then** undo/redo is NOT triggered — native browser text undo/redo runs normally
**Note:** The existing `Ctrl+Z` handler in `SkillTreeView.tsx` (line 405–414) does NOT have this guard — it must be removed from `SkillTreeView.tsx` and replaced in `App.tsx` with the guard.

**AC4 — Undo button in TreeControls:**
**Given** the tree controls bar is visible
**When** an agent reviews it
**Then** a ↩ (undo) button is present alongside the existing Reset button
**And** the button is **disabled** when `undoStack.length === 0`
**And** clicking it calls `undoNodeChange()`
**And** it has `aria-label="Undo"` and the standard 2px solid accent-gold focus ring

**AC5 — Redo button in TreeControls:**
**Given** the tree controls bar is visible
**When** an agent reviews it
**Then** a ↪ (redo) button is present alongside the Reset and Undo buttons
**And** the button is **disabled** when `redoStack.length === 0`
**And** clicking it calls `redoNodeChange()`
**And** it has `aria-label="Redo"` and the standard 2px solid accent-gold focus ring

**AC6 — Redo stack cleared by new allocations:**
**Given** the user has undone several actions
**When** the user makes a new allocation (any tree type)
**Then** the `redoStack` is cleared (redo history is invalidated)
**And** the ↪ redo button becomes disabled

**AC7 — Accessibility:**
**Given** the TreeControls with undo/redo buttons rendered
**When** `axe(container)` is run
**Then** `expect(await axe(container)).toHaveNoViolations()` passes

---

## Current State Analysis — READ BEFORE IMPLEMENTING

### What already exists (DO NOT reinvent):

**Undo infrastructure in `buildStore.ts`:**
- `undoStack: BuildState[]` — capped at `MAX_UNDO_STACK = 10`
- `undoNodeChange()` (line 336–341) — pops from `undoStack`, restores as `activeBuild`. Currently does NOT push to any redoStack.
- Undo snapshots pushed in: `applyNodeChange` (line 232), `applyWeaverNodeChange` (line 292), `applySkillNodeChange` (line 430), and all three `resetActiveTree` branches (lines 309, 320, 331)
- Stack cleared in: `setSelectedClass` (line 80), `clearActiveBuild` (line 85), `createBuild` (line 115)

**Partial Ctrl+Z handler in `SkillTreeView.tsx` (lines 405–414):**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      undoNodeChange()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [undoNodeChange])
```
**Problem:** No text-input guard — fires when user is typing in any input. Must be removed from `SkillTreeView.tsx`.

### What does NOT exist yet:
- `redoStack: BuildState[]` — missing from store
- `redoNodeChange()` — missing from store  
- Undo/redo buttons in `TreeControls.tsx`
- `Ctrl+Y` / `Cmd+Y` keybinding anywhere
- Text-input guard on Ctrl+Z

### Where global shortcuts live (important pattern):
`App.tsx` handles all global keydown shortcuts (lines 89–157). The pattern for modifier-key shortcuts (like `Ctrl+S`) is: check the key combination BEFORE the `isInputTarget` guard at line 108. For undo/redo, we need the OPPOSITE — check the guard first (skip if input focused).

The correct position for Ctrl+Z/Y in `App.tsx`:
- After the `Ctrl+S` block (line 91–98)  
- After the `Escape` block (line 100–105)
- **Before** the bare-key input guard at line 108

---

## Tasks / Subtasks

- [x] **Task 1: Add `redoStack` and `redoNodeChange` to `buildStore.ts`**
- [x] **Task 2: Remove old Ctrl+Z handler from `SkillTreeView.tsx`; add undo/redo props to TreeControls**
- [x] **Task 3: Add global Ctrl+Z/Y handler with text-input guard in `App.tsx`**
- [x] **Task 4: Update `TreeControls.tsx` — add ↩ and ↪ buttons**
- [x] **Task 5: Update `buildStore.test.ts` — add redo tests**
- [x] **Task 6: Update `TreeControls.test.tsx` — add undo/redo button tests**

---

## Technical Requirements

### Task 1: `buildStore.ts` — Add `redoStack` and `redoNodeChange`

**Interface additions** (add to `BuildStore` interface after `undoStack`):
```typescript
redoStack: BuildState[]
redoNodeChange: () => void
```

**State initialization** (add to initial state after `undoStack: []`):
```typescript
redoStack: [],
```

**Modify `undoNodeChange`** — push current state to redoStack before restoring:
```typescript
undoNodeChange: () => {
  const { undoStack, activeBuild, redoStack } = get()
  if (undoStack.length === 0) return
  const previous = undoStack[undoStack.length - 1]
  set({
    activeBuild: previous,
    undoStack: undoStack.slice(0, -1),
    redoStack: activeBuild ? [...redoStack, activeBuild].slice(-MAX_UNDO_STACK) : redoStack,
  })
},
```

**Add `redoNodeChange`** (add after `undoNodeChange`):
```typescript
redoNodeChange: () => {
  const { redoStack, activeBuild, undoStack } = get()
  if (redoStack.length === 0) return
  const next = redoStack[redoStack.length - 1]
  set({
    activeBuild: next,
    redoStack: redoStack.slice(0, -1),
    undoStack: activeBuild ? [...undoStack, activeBuild].slice(-MAX_UNDO_STACK) : undoStack,
  })
},
```

**Clear `redoStack` on new allocation actions** — every `set()` call that pushes to `undoStack` must also reset `redoStack: []`:

In `applyNodeChange` (line 233):
```typescript
// Before:
set({ activeBuild: newActiveBuild, undoStack: newUndoStack })
// After:
set({ activeBuild: newActiveBuild, undoStack: newUndoStack, redoStack: [] })
```

In `applyWeaverNodeChange` (line 293):
```typescript
set({ activeBuild: newActiveBuild, undoStack: newUndoStack, redoStack: [] })
```

In `applySkillNodeChange` (line 431):
```typescript
set({ activeBuild: newActiveBuild, undoStack: newUndoStack, redoStack: [] })
```

In `resetActiveTree` — all three branches (lines 302–333 `set({...})` calls):
```typescript
// Each set() that includes undoStack push also needs redoStack: []
set({
  activeBuild: { ... },
  undoStack: [...undoStack, activeBuild].slice(-MAX_UNDO_STACK),
  redoStack: [],  // ADD THIS
})
```

**Clear `redoStack` on class/build resets** — add `redoStack: []` to:
- `setSelectedClass` (line 80): `set({ ..., undoStack: [], redoStack: [] })`
- `clearActiveBuild` (line 85): `set({ ..., undoStack: [], redoStack: [] })`
- `createBuild` (line 115): `set({ ..., undoStack: [], redoStack: [] })`

> **Verify:** `pnpm build` from `lebo/` must pass with zero TypeScript errors after all changes.

---

### Task 2: `SkillTreeView.tsx` — Remove old handler, add redo, pass props

**Remove the old Ctrl+Z keydown effect** (lines 405–414) — delete it entirely:
```typescript
// DELETE THIS ENTIRE EFFECT:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      undoNodeChange()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [undoNodeChange])
```

**Add store subscriptions** — after line 86 (`const undoNodeChange = ...`):
```typescript
const redoNodeChange = useBuildStore((s) => s.redoNodeChange)
const canUndo = useBuildStore((s) => s.undoStack.length > 0)
const canRedo = useBuildStore((s) => s.redoStack.length > 0)
```

**Keep `undoNodeChange`** — it's still needed for the `onUndo` prop.

**Pass undo/redo props to the passive/skill TreeControls** (line 647–655):
```tsx
{showControls && (
  <TreeControls
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    onReset={handleReset}
    onFit={() => activeCanvasRef.current?.fitToTree()}
    hasOverlay={isPassiveTab && !!effectiveNodeEfficiencies && effectiveNodeEfficiencies.length > 0}
    showOverlay={showOverlay}
    onToggleOverlay={() => setShowOverlay((v) => !v)}
    onUndo={undoNodeChange}       // NEW
    onRedo={redoNodeChange}       // NEW
    canUndo={canUndo}             // NEW
    canRedo={canRedo}             // NEW
  />
)}
```

**Pass undo/redo props to the weaver TreeControls** (line 459–464):
```tsx
{weaverTreeData !== null && (
  <TreeControls
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    onReset={() => { resetActiveTree('weaver'); setSearchQuery('') }}
    onFit={() => weaverCanvasRef.current?.fitToTree()}
    onUndo={undoNodeChange}       // NEW
    onRedo={redoNodeChange}       // NEW
    canUndo={canUndo}             // NEW
    canRedo={canRedo}             // NEW
  />
)}
```

> **Note:** Undo/redo works cross-tree (the undoStack holds `BuildState` snapshots regardless of which tree was modified), so both TreeControls instances share the same `canUndo`/`canRedo`.

> **noUnusedLocals:** After removing the Ctrl+Z effect, `undoNodeChange` is still used as `onUndo`. `redoNodeChange`, `canUndo`, `canRedo` are all used. No orphan variables.

---

### Task 3: `App.tsx` — Add global Ctrl+Z/Y with text-input guard

**Insert after the `Escape` block (after line 105) and before the `isInputTarget` guard at line 107:**

```typescript
// Undo/Redo — skip if text input focused (preserve native browser text undo/redo)
if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
  const target = e.target as HTMLElement
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  ) return
  e.preventDefault()
  if (e.key === 'z') useBuildStore.getState().undoNodeChange()
  else useBuildStore.getState().redoNodeChange()
  return
}
```

> **Why here in App.tsx?** All other global shortcuts live here. `SkillTreeView`'s local handler was an oversight — the correct home is the global handler. Moving it here means the shortcut works on ALL center tabs (gear, idol, etc.), not just when the tree tab is focused.

> **Import:** `useBuildStore` is already imported in `App.tsx`. No new imports needed.

---

### Task 4: `TreeControls.tsx` — Add ↩ and ↪ buttons

**Add new props to the interface:**
```typescript
interface TreeControlsProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onReset: () => void
  onFit?: () => void
  hasOverlay?: boolean
  showOverlay?: boolean
  onToggleOverlay?: () => void
  onUndo?: () => void          // NEW
  onRedo?: () => void          // NEW
  canUndo?: boolean            // NEW
  canRedo?: boolean            // NEW
}
```

**Destructure in the function signature:**
```typescript
export function TreeControls({
  searchQuery, onSearchChange, onReset, onFit,
  hasOverlay, showOverlay, onToggleOverlay,
  onUndo, onRedo, canUndo, canRedo,       // NEW
}: TreeControlsProps) {
```

**Add ↩ and ↪ buttons** — place them immediately after the Reset/Reset-confirm block and before the `onFit` button. Full button JSX:

```tsx
{onUndo && (
  <button
    type="button"
    aria-label="Undo"
    onClick={onUndo}
    disabled={!canUndo}
    style={{
      ...btnBase,
      border: `1px solid ${canUndo ? 'var(--color-accent-gold-soft)' : 'var(--color-bg-elevated)'}`,
      color: canUndo ? 'var(--color-accent-gold-soft)' : 'var(--color-text-muted)',
      cursor: canUndo ? 'pointer' : 'not-allowed',
      outline: 'none',
    }}
    onFocus={(e) => {
      e.currentTarget.style.outline = '2px solid var(--color-accent-gold)'
    }}
    onBlur={(e) => {
      e.currentTarget.style.outline = 'none'
    }}
  >
    ↩
  </button>
)}

{onRedo && (
  <button
    type="button"
    aria-label="Redo"
    onClick={onRedo}
    disabled={!canRedo}
    style={{
      ...btnBase,
      border: `1px solid ${canRedo ? 'var(--color-accent-gold-soft)' : 'var(--color-bg-elevated)'}`,
      color: canRedo ? 'var(--color-accent-gold-soft)' : 'var(--color-text-muted)',
      cursor: canRedo ? 'pointer' : 'not-allowed',
      outline: 'none',
    }}
    onFocus={(e) => {
      e.currentTarget.style.outline = '2px solid var(--color-accent-gold)'
    }}
    onBlur={(e) => {
      e.currentTarget.style.outline = 'none'
    }}
  >
    ↪
  </button>
)}
```

> **Focus ring pattern:** The project uses inline `style` for custom CSS values (Tailwind v4 pattern). Other buttons in this codebase use `outline: none` in style — checking existing buttons, they don't have a focus ring yet. The spec requires `2px solid accent-gold`. Use `onFocus`/`onBlur` handlers as shown above. This is consistent with how focus rings are handled in this project for custom-styled buttons.

> **Disabled state:** HTML `disabled` attribute prevents click events natively. The `cursor: not-allowed` and muted colors signal the disabled state visually.

> **Placement:** Undo before Redo, both after the Reset block. This gives left-to-right logical grouping: [Reset] [Undo ↩] [Redo ↪] [Fit] [Overlay] [Search].

---

### Task 5: `buildStore.test.ts` — Add redo tests

Add after the existing `undoNodeChange` tests (around line 401):

```typescript
describe('redoNodeChange', () => {
  beforeEach(() => {
    useBuildStore.setState({
      selectedClassId: 'void-knight',
      selectedMasteryId: 'void-knight',
      activeBuild: null,
      undoStack: [],
      redoStack: [],
    })
  })

  it('redoNodeChange is a no-op when redoStack is empty', () => {
    useBuildStore.getState().redoNodeChange()
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('undoNodeChange pushes current state to redoStack', () => {
    // Setup: allocate a node to create undo history
    const mockTreeData = makeMockTreeData()
    useBuildStore.getState().applyNodeChange('node-1', 1, mockTreeData)
    const afterAlloc = useBuildStore.getState().activeBuild
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().redoStack).toHaveLength(1)
    expect(useBuildStore.getState().redoStack[0]).toEqual(afterAlloc)
  })

  it('redoNodeChange restores the undone allocation', () => {
    const mockTreeData = makeMockTreeData()
    useBuildStore.getState().applyNodeChange('node-1', 1, mockTreeData)
    const afterAlloc = useBuildStore.getState().activeBuild
    useBuildStore.getState().undoNodeChange()
    useBuildStore.getState().redoNodeChange()
    expect(useBuildStore.getState().activeBuild?.nodeAllocations['node-1']).toBe(1)
    expect(useBuildStore.getState().activeBuild).toEqual(afterAlloc)
  })

  it('new allocation clears redoStack', () => {
    const mockTreeData = makeMockTreeData()
    useBuildStore.getState().applyNodeChange('node-1', 1, mockTreeData)
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().redoStack).toHaveLength(1)
    // Make a new allocation
    useBuildStore.getState().applyNodeChange('node-1', 1, mockTreeData)
    expect(useBuildStore.getState().redoStack).toHaveLength(0)
  })

  it('redo pushes current state to undoStack (redo is undoable)', () => {
    const mockTreeData = makeMockTreeData()
    useBuildStore.getState().applyNodeChange('node-1', 1, mockTreeData)
    useBuildStore.getState().undoNodeChange()
    const beforeRedo = useBuildStore.getState().activeBuild
    useBuildStore.getState().redoNodeChange()
    expect(useBuildStore.getState().undoStack).toHaveLength(1)
    expect(useBuildStore.getState().undoStack[0]).toEqual(beforeRedo)
  })
})
```

> **Note:** Look at how `makeMockTreeData()` or equivalent test helpers are defined in the existing `buildStore.test.ts` file — reuse the same helper pattern. Do NOT create a new helper if one already exists.

---

### Task 6: `TreeControls.test.tsx` — Add undo/redo button tests

Add the following test blocks at the end of the file (before the closing `}`):

```typescript
// ── Story 6.3: Undo/Redo buttons ─────────────────────────────────────────────

it('Undo button is absent when onUndo is not provided', () => {
  render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
})

it('Redo button is absent when onRedo is not provided', () => {
  render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Redo' })).not.toBeInTheDocument()
})

it('Undo button is rendered and calls onUndo when clicked', () => {
  const onUndo = vi.fn()
  render(
    <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onUndo={onUndo} canUndo={true} />
  )
  const btn = screen.getByRole('button', { name: 'Undo' })
  expect(btn).toBeInTheDocument()
  expect(btn).not.toBeDisabled()
  fireEvent.click(btn)
  expect(onUndo).toHaveBeenCalledTimes(1)
})

it('Undo button is disabled when canUndo is false', () => {
  render(
    <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onUndo={vi.fn()} canUndo={false} />
  )
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
})

it('Redo button is rendered and calls onRedo when clicked', () => {
  const onRedo = vi.fn()
  render(
    <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onRedo={onRedo} canRedo={true} />
  )
  const btn = screen.getByRole('button', { name: 'Redo' })
  expect(btn).toBeInTheDocument()
  expect(btn).not.toBeDisabled()
  fireEvent.click(btn)
  expect(onRedo).toHaveBeenCalledTimes(1)
})

it('Redo button is disabled when canRedo is false', () => {
  render(
    <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onRedo={vi.fn()} canRedo={false} />
  )
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
})

it('passes accessibility check with undo and redo buttons', async () => {
  const { container } = render(
    <TreeControls
      searchQuery=""
      onSearchChange={vi.fn()}
      onReset={vi.fn()}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      canUndo={true}
      canRedo={false}
    />
  )
  expect(await axe(container)).toHaveNoViolations()
})
```

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/shared/stores/buildStore.ts` | MODIFY | Add `redoStack`, `redoNodeChange`; modify `undoNodeChange`; add `redoStack: []` clears to 7 locations |
| `lebo/src/features/skill-tree/TreeControls.tsx` | MODIFY | Add 4 new props + ↩ and ↪ buttons |
| `lebo/src/features/skill-tree/SkillTreeView.tsx` | MODIFY | Remove old Ctrl+Z effect; add `redoNodeChange`/`canUndo`/`canRedo` subscriptions; pass new props to both `<TreeControls>` |
| `lebo/src/App.tsx` | MODIFY | Add Ctrl+Z/Y global handler with text-input guard |
| `lebo/src/shared/stores/buildStore.test.ts` | MODIFY | Add `redoNodeChange` test block |
| `lebo/src/features/skill-tree/TreeControls.test.tsx` | MODIFY | Add 7 new tests for undo/redo buttons |

**Do NOT touch:**
- Any Rust files (pure frontend story)
- `pixiRenderer.ts` — no canvas changes
- `SkillTreeCanvas.tsx` — no canvas changes
- `src/shared/types/` — no type file changes needed
- `appStore.ts` — no app store changes

---

## Architecture & Pattern Compliance

**Four stores rule:** No new stores. All changes to `buildStore.ts` only.

**No barrel files:** Import `useBuildStore` from `'../../shared/stores/buildStore'` (or the relative path appropriate for the file). Never from an `index.ts`.

**TypeScript strict mode:** `redoStack` and `redoNodeChange` must be added to BOTH the `BuildStore` interface (lines 10–65) AND the `create<BuildStore>()` implementation body. TypeScript will error if one is missing.

**Inline style pattern (Tailwind v4):** Undo/redo buttons use inline `style` for all custom CSS values — consistent with every other button in `TreeControls.tsx`. Do NOT use `@apply` or Tailwind classes for custom colors.

**No `outline: none` without replacement:** The focus ring is implemented via `onFocus`/`onBlur` setting `e.currentTarget.style.outline`. This is the pattern for Tailwind v4 custom-styled buttons (CSS variables can't be used in Tailwind `ring-*` utilities).

**App.tsx handler location:** The Ctrl+Z/Y block must go BEFORE the bare-key input guard (`isInputTarget` at line 108), but it has its own input guard because modifier+key shortcuts need different guarding semantics than bare keys.

**`useBuildStore.getState()` in App.tsx:** This is already used for `Ctrl+S` save (line 93). Same pattern for undo/redo — call `.getState()` for imperative access from the global event handler without a React subscription.

---

## Previous Story Intelligence (from 6.2)

- **Pre-existing test failures:** `AppHeader`, `RightPanel`, `ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls` tests have **14 pre-existing failures** unchanged since Story 6.1. Do not diagnose or fix them. Run only the relevant test files for this story.
- **`pnpm build` is the TypeScript truth:** Run after all changes to catch unused vars and type errors.
- **Tailwind v4 pattern:** Inline `style` props for non-standard CSS values. Never `@apply`.
- **PNG tiles from 6.2:** The background files are `bg_stone_tile.png` and `bg_weaver_tile.png` (`.png` extension, not `.webp` — decision accepted in 6.2 review).
- **TreeControls already has optional buttons** (`onFit`, `hasOverlay`) rendered conditionally. Follow the same `{onUndo && (...)}` pattern for the new buttons.

---

## Potential Pitfalls / Guardrails

1. **`redoStack` must be cleared in ALL 7 allocation call sites** — it's easy to miss one. The locations are: `applyNodeChange`, `applyWeaverNodeChange`, `applySkillNodeChange`, and 3 branches of `resetActiveTree`, plus `setSelectedClass`, `clearActiveBuild`, `createBuild`. Count all 7.

2. **`undoNodeChange` guard for null `activeBuild`** — When undoing with `activeBuild` being null (shouldn't happen normally, but be safe), the redoStack push is guarded: `activeBuild ? [...redoStack, activeBuild].slice(-MAX_UNDO_STACK) : redoStack`.

3. **Double Ctrl+Z handler after this story** — The old handler in `SkillTreeView.tsx` MUST be deleted before adding the new one to `App.tsx`. If both exist, undo fires twice per keypress.

4. **`noUnusedParameters` enforcement** — After removing the old `useEffect` in `SkillTreeView.tsx`, verify `undoNodeChange` is still used (it is — for `onUndo={undoNodeChange}`). If you accidentally remove the subscription too, TypeScript will error on `canUndo`/`canRedo` computation.

5. **`TreeControls` props are all optional** — The existing callers (weaver and passive/skill) that don't pass `onUndo`/`onRedo` should not break. The `{onUndo && (...)}` conditional render handles this.

6. **Disabled button click** — HTML `disabled` attribute prevents `onClick` natively. No additional guard needed in the handler.

7. **`axe` accessibility:** Disabled buttons must have `aria-label`. The `disabled` attribute alone is sufficient for axe — no `aria-disabled` needed when using the native HTML attribute.

8. **Pre-existing `TreeControls.test.tsx` failures** — The spec mentions 14 pre-existing failures; some may be in `TreeControls`. Check which tests currently fail before making changes so you don't accidentally blame your changes for them.

---

## Verification Commands

```bash
# From lebo/:
pnpm build                                               # Zero TS errors (critical)
pnpm vitest src/shared/stores/buildStore.test.ts         # All undo/redo tests pass
pnpm vitest src/features/skill-tree/TreeControls.test.tsx  # All button tests pass
pnpm vitest                                              # Full suite — story-relevant tests green; 14 pre-existing failures unchanged
```

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6 (2026-05-27)

### Completion Notes List

- **Task 1:** Added `redoStack: BuildState[]` and `redoNodeChange: () => void` to `BuildStore` interface and implementation. Modified `undoNodeChange` to push current `activeBuild` to `redoStack` before restoring previous state. Added `redoNodeChange` that pops from `redoStack`, restores as `activeBuild`, and pushes pre-redo state to `undoStack`. Added `redoStack: []` clear to all 7 mutation sites: `applyNodeChange`, `applyWeaverNodeChange`, `applySkillNodeChange`, all 3 `resetActiveTree` branches, `setSelectedClass`, `clearActiveBuild`, and `createBuild`.

- **Task 2:** Removed the old Ctrl+Z `useEffect` handler from `SkillTreeView.tsx` (it lacked a text-input guard). Added `redoNodeChange`, `canUndo` (derived from `undoStack.length > 0`), and `canRedo` (derived from `redoStack.length > 0`) store subscriptions. Passed all four props (`onUndo`, `onRedo`, `canUndo`, `canRedo`) to both `<TreeControls>` instances (weaver and passive/skill).

- **Task 3:** Added global Ctrl+Z/Y handler in `App.tsx` with text-input guard. Placed after the Escape block and before the bare-key input guard. Uses `useBuildStore.getState()` for imperative access (consistent with existing Ctrl+S pattern). Guard checks `HTMLInputElement | HTMLTextAreaElement | isContentEditable` — falls through to native browser undo/redo behavior when input is focused.

- **Task 4:** Added `onUndo?`, `onRedo?`, `canUndo?`, `canRedo?` props to `TreeControlsProps` interface and function signature. Added ↩ and ↪ buttons after the Reset/confirm block, before the Fit button. Buttons disabled when `!canUndo`/`!canRedo` respectively. Focus ring implemented via `onFocus`/`onBlur` setting `outline: 2px solid var(--color-accent-gold)` (Tailwind v4 inline style pattern). Conditional render via `{onUndo && (...)}` so existing callers without the prop are unaffected.

- **Task 5:** Added `describe('buildStore — redoNodeChange', ...)` with 6 tests covering: no-op on empty stack, undo pushes to redoStack, redo restores allocation, new allocation clears redoStack, redo is itself undoable, and redoStack shrinks after each redo.

- **Task 6:** Added 7 TreeControls tests: absent when not provided (×2), rendered + clickable when enabled (×2), disabled when `canUndo/canRedo = false` (×2), and accessibility check with both buttons present.

- **Results:** `pnpm build` ✅ zero TS errors. Full suite: 1007/1021 pass (14 pre-existing failures, unchanged from Story 6.2).

### Review Findings

_Reviewed 2026-05-27 — 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 14 raw findings → 0 decision-needed, 0 patch, 4 deferred, 10 dismissed._

- [x] [Review][Defer] `canUndo`/`canRedo` co-provision not type-enforced [`lebo/src/features/skill-tree/TreeControls.tsx`] — deferred, pre-existing; all current callers supply all four props; fix requires discriminated union type
- [x] [Review][Defer] `redoStack` not cleared on `setSelectedMastery` [`lebo/src/shared/stores/buildStore.ts`] — deferred, mirrors pre-existing `undoStack` behavior; not in spec's required 7 sites; architecturally ambiguous
- [x] [Review][Defer] `activeBuild` null guard in undo/redo creates stack asymmetry [`lebo/src/shared/stores/buildStore.ts`] — deferred, theoretically unreachable in practice (stack only populated via paths that require non-null activeBuild)
- [x] [Review][Defer] `isPersisted` flag snapshotted into `BuildState` — undo may restore stale "saved" appearance [`lebo/src/shared/stores/buildStore.ts`] — deferred, pre-existing design concern not introduced by this story

### File List

- `lebo/src/shared/stores/buildStore.ts` — MODIFIED (redoStack field + redoNodeChange action; undoNodeChange updated; 7 redoStack clear sites)
- `lebo/src/features/skill-tree/TreeControls.tsx` — MODIFIED (4 new props; ↩ undo + ↪ redo buttons with disabled state + focus ring)
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — MODIFIED (removed old Ctrl+Z effect; added redoNodeChange/canUndo/canRedo subscriptions; both TreeControls callers updated)
- `lebo/src/App.tsx` — MODIFIED (Ctrl+Z/Y global handler with text-input guard added)
- `lebo/src/shared/stores/buildStore.test.ts` — MODIFIED (6 redoNodeChange tests added)
- `lebo/src/features/skill-tree/TreeControls.test.tsx` — MODIFIED (7 undo/redo button tests added)
