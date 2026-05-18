# Story 6.1: Keyboard Navigation & Global Shortcuts

Status: done

## Story

As an advanced Last Epoch player who prefers keyboard-driven workflows,
I want to navigate the skill tree, trigger optimization, and interact with suggestions entirely by keyboard,
So that I can operate the tool efficiently without requiring a mouse for any primary action.

## Acceptance Criteria

**Given** the app is open with a build loaded
**When** the user presses `O` (while not in a text input)
**Then** focus moves to the Optimize button in the right panel

**Given** the app is open
**When** the user presses `I` (while not in a text input)
**Then** focus moves to the build import input in the left panel

**Given** a build is active
**When** the user presses `Ctrl+S`
**Then** the current build saves (existing behavior, already implemented)

**Given** a suggestion card is expanded or a tree preview is active
**When** the user presses `Escape`
**Then** the expanded card collapses or the tree preview clears — returning to neutral state

**Given** the suggestion list is visible and has keyboard focus
**When** the user presses `Up` or `Down` arrow keys
**Then** focus moves between suggestion cards
**And** pressing `Enter` on a focused card expands or applies it
**And** pressing `P` activates preview for the focused suggestion
**And** pressing `S` skips/dismisses the focused suggestion

**Given** the skill tree canvas has keyboard focus
**When** the user presses `Tab`
**Then** focus moves to the next node in connection graph order (parent nodes before children)
**And** the focused node shows a 2px solid accent-gold focus ring
**And** pressing `Enter` allocates or deallocates the focused node

**Given** the user is within a node cluster with keyboard focus
**When** the user presses an arrow key (Up/Down/Left/Right)
**Then** focus moves to the nearest adjacent node in that direction

## Tasks / Subtasks

- [x] Task 1: Extend global shortcuts in `App.tsx` (AC: 1, 2, 4)
  - [x] In the existing `handleKeyDown` useEffect, add `O` and `I` shortcuts with the input element guard:
    `if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).isContentEditable) return`
    Apply the guard to bare-key shortcuts only (`O`, `I`) — `Ctrl+S` and `Escape` are already safe
  - [x] `O`: `document.getElementById('optimize-button')?.focus()`
  - [x] `I`: `document.getElementById('build-import-input')?.focus()`
  - [x] `Escape`: call `useOptimizationStore.getState().setPreviewSuggestionRank(null)` to clear tree preview; optionally dispatch a custom event `keyboard:escape` that `SuggestionsList` listens to for collapsing expanded cards
  - [x] Add `id="optimize-button"` to the Optimize button in `RightPanel` or wherever it lives
  - [x] Add `id="build-import-input"` to the build import text input in `LeftPanel`/`BuildImportInput`
  - [x] Guard: do NOT emit `O`/`I` shortcuts when `currentView === 'settings'` (no skill tree or optimize button)

- [x] Task 2: Add `addTickerListener` to `RendererInstance` and `pixiRenderer.ts` (required for Task 3)
  - [x] In `lebo/src/features/skill-tree/types.ts`, add to `RendererInstance`:
    `addTickerListener(fn: () => void): () => void  // returns unsubscribe fn`
  - [x] In `pixiRenderer.ts`, implement using `app.ticker.add(fn)` / `app.ticker.remove(fn)`:
    ```ts
    function addTickerListener(fn: () => void): () => void {
      app.ticker.add(fn)
      return () => app.ticker.remove(fn)
    }
    return { renderTree, resize, destroy, getViewport, addTickerListener }
    ```

- [x] Task 3: Refactor `SkillTreeCanvas.tsx` — invisible-button overlay pattern (AC: 6, 7)
  - [x] Remove from container `<div>`: `tabIndex`, `onFocus`, `onBlur`, `onKeyDown` props, and `focusedIndexRef`, `handleFocus`, `handleBlur`, `handleKeyDown` functions — the overlay buttons will own all keyboard interaction
  - [x] Add overlay `<div>` (same size, `position: absolute, inset: 0, pointerEvents: none`) on top of canvas
  - [x] Add state: `nodeButtons: Array<{id: string, screenX: number, screenY: number, r: number}>` — positions of visible viewport nodes
  - [x] Add ref: `buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())`
  - [x] Add ref: `focusedNodeIdRef = useRef<string | null>(null)`
  - [x] Add ref: `treeDataRef = useRef(treeData)` — keep current in ticker callback (no stale closure)
  - [x] **Position sync function** (call on mount + ticker)
  - [x] Register ticker listener after renderer init; also call `syncButtonPositions()` immediately after first render
  - [x] **Connection-graph Tab traversal:** cycles through `nodeButtons` array order (visible nodes); arrow keys use angle-based nearest connected node
  - [x] **Arrow key — nearest adjacent node:** angle-based search through connected nodes only
  - [x] **Render hidden buttons:** `sr-only` until focused, then gold focus ring via `focus:not-sr-only` + `focus:outline`
  - [x] **`handleNodeKeyDown`** handles: `Enter`/`Space` → `onNodeClick(id)`, `Tab`/`Shift+Tab` → cycle nodeButtons, `ArrowUp/Down/Left/Right` → nearest adjacent, `Escape` → blur + clear nav
  - [x] All buttons `tabIndex={-1}` except first (index 0) which gets `tabIndex={0}`; focus managed programmatically
  - [x] Container `<div>` loses its `tabIndex={0}`; `aria-hidden="true"` on canvas element
  - [x] `NODE_RADIUS` exported from `pixiRenderer.ts` and imported in `SkillTreeCanvas.tsx`

- [x] Task 4: Keyboard nav in `SuggestionsList.tsx` (AC: 5)
  - [x] Add `focusedCardIndex: number | null` state to `SuggestionsList`
  - [x] Add `expandedRank: number | null` state for card expand/collapse
  - [x] Wrap the suggestion card list container with `onKeyDown={handleListKeyDown}` and `role="list"`
  - [x] `handleListKeyDown`: ArrowDown/Up, Enter (toggle expand), P (preview), S (skip), Escape (clear)
  - [x] Pass `isFocused` and `isExpanded` props to `SuggestionCard`; card uses `ref` via `forwardRef`
  - [x] `SuggestionCard` has `role="article"`, `aria-label`, `tabIndex={-1}` on root element
  - [x] Listen for global `keyboard:escape` custom event to collapse expanded cards from App.tsx

- [x] Task 5: Add keyboard shortcuts reference to Settings view
  - [x] In `lebo/src/features/settings/Settings.tsx`, added "Keyboard Shortcuts" section with styled table

- [x] Task 6: Tests
  - [x] `SkillTreeCanvas.test.tsx` (new): Tab, Enter, Escape, ArrowRight, onFocus tests — all passing
  - [x] `SuggestionsList.test.tsx` (extended): ArrowDown focus, P preview, S skip, Escape clear, keyboard:escape event — all passing
  - [x] `pnpm tsc --noEmit` — clean
  - [x] `pnpm vitest run` — 447/447 passing

## Dev Notes

### Existing Keyboard State — What Already Works

Do NOT remove or break these:
- **`Ctrl+S`** in `App.tsx` (`lebo/src/App.tsx:72-82`) — already implemented, no changes needed
- **Skip links** in `App.tsx` (`lebo/src/App.tsx:103-117`) — "Skip to tree" and "Skip to suggestions" already rendered; Story 6.2 needs these, don't touch them
- **Story 1.5 minimal canvas nav** — `tabIndex={0}` + `onKeyDown` in `SkillTreeCanvas.tsx`; THIS IS WHAT STORY 6.1 REPLACES. After Task 3, the `SkillTreeCanvas.tsx` keyboard approach changes from the container `div` approach to the invisible-button overlay approach.

### Critical: Input Element Guard for Bare-Key Shortcuts

The `O` and `I` shortcuts MUST include this guard (add at start of `handleKeyDown` before any bare-key handling):
```ts
const target = e.target as HTMLElement
const isInputTarget =
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target.isContentEditable
if (isInputTarget && !e.ctrlKey && !e.metaKey) return
```
Without this guard, typing `o` in the build name field, API key input (`#build-import-input`), or any context panel search box will hijack focus mid-typing. `Ctrl+S` is already safe (has `e.ctrlKey` check). `Escape` is safe globally.

### Connection-Graph Traversal — Using Existing `TreeNode.connections`

`TreeData.edges: TreeEdge[]` and `TreeNode.connections: string[]` both exist. Use `TreeNode.connections` directly for adjacency — it's already bidirectional per node:

```ts
// Build lookup map once when treeData changes
const connectionMap = useMemo(() => {
  const map = new Map<string, string[]>()
  for (const node of treeData.nodes) {
    map.set(node.id, node.connections)
  }
  return map
}, [treeData])
```

Tab traversal: from the current node, get `connectionMap.get(currentId) ?? []`, take the next ID in that array (cycling). If the array is empty, fall back to `nodes` array linear order (for truly isolated nodes).

Arrow key traversal: from the current node's screen position, filter to connected nodes, compute angle to each, pick the one whose angle is closest to the arrow direction:
```ts
const dirAngles = { ArrowRight: 0, ArrowDown: Math.PI/2, ArrowLeft: Math.PI, ArrowUp: -Math.PI/2 }
const targetAngle = dirAngles[e.key]
const connected = connectionMap.get(currentId) ?? []
const best = connected.reduce((best, id) => {
  const btn = buttonData[id]  // screen position from nodeButtons state
  if (!btn) return best
  const angle = Math.atan2(btn.screenY - currentBtn.screenY, btn.screenX - currentBtn.screenX)
  const diff = Math.abs(((angle - targetAngle) + Math.PI) % (2 * Math.PI) - Math.PI)
  return diff < best.diff ? { id, diff } : best
}, { id: null as string | null, diff: Infinity })
if (best.id) buttonRefs.current.get(best.id)?.focus()
```

### Invisible-Button Overlay Pattern — Key Constraints

- **`pointer-events: none`** on the overlay container — mouse clicks still reach the PixiJS canvas beneath
- Each button: `pointer-events: auto` to allow click + focus
- Each button: `position: absolute` inside the `position: relative` overlay div; `transform: translate(-50%, -50%)` to center on node coordinates
- **`sr-only` until focused**: use Tailwind's `sr-only` class (`position: absolute; width: 1px; height: 1px; ...`) as default, then `focus:not-sr-only focus:absolute focus:w-auto focus:h-auto` to show the focus ring on keyboard focus. The button is invisible to sighted mouse users, visible only when keyboard-focused.
- **Focus ring style**: `focus:outline focus:outline-2 focus:outline-[var(--color-accent-gold)] focus:rounded-full` — 2px gold ring, circular (matches node shape)
- **Tab DOM order vs. programmatic focus**: Set all buttons to `tabIndex={-1}` initially. Only the first node gets `tabIndex={0}`. Manage focus entirely programmatically via `buttonRefs.current.get(nextId)?.focus()` in `onKeyDown`. This prevents the browser's default Tab cycling through all buttons (which would be linear DOM order, not graph order).
  
  **Correction from above task:** Use `tabIndex={-1}` on all buttons except the first reachable node; manage Tab/arrow keys manually in `handleNodeKeyDown` by calling `.focus()` on target buttons. Do NOT set `tabIndex={0}` on all buttons — that creates 300+ tab stops in a large tree.

- **Viewport-only rendering**: only render buttons for nodes visible in current pan/zoom viewport (plus a 50px buffer). This is critical for performance — a full passive tree has hundreds of nodes but only ~30-50 are visible at any time.

### Pan/Zoom Position Sync — Ticker Pattern

The `addTickerListener` in Task 2 fires after every PixiJS render frame. The sync function reads `renderer.getViewport()` to get current `{x, y, scale}` (these are the `worldContainer.x/y/scale` values from `pixiRenderer.ts`). This fires at 60fps during pan/zoom — the `setNodeButtons` React state update must be debounced or use a ref-based approach to avoid triggering 60 React re-renders per second.

**Recommended pattern** — use a ref for button data and only trigger React state sync when the viewport has changed:
```ts
const lastViewportRef = useRef({ x: 0, y: 0, scale: 1 })
function syncButtonPositions() {
  const r = rendererRef.current
  if (!r) return
  const vp = r.getViewport()
  const last = lastViewportRef.current
  if (vp.x === last.x && vp.y === last.y && vp.scale === last.scale) return
  lastViewportRef.current = vp
  // now compute and setNodeButtons(...)
}
```
This throttles React re-renders to only when the viewport actually changes (not every frame if user isn't panning/zooming).

### `RendererInstance` Extension — Non-Breaking

Adding `addTickerListener` to `RendererInstance` in `types.ts` is a breaking change to the type only — `SkillTreeCanvas.tsx` is the only consumer. Mock this method in tests. The `pixiRenderer.ts` implementation is straightforward: `app.ticker.add(fn)` / `app.ticker.remove(fn)`.

Note: `pixiRenderer.ts` exports `NODE_RADIUS = { small: 12, medium: 18, large: 26 }`. Export it if it isn't already, or duplicate the constant in `SkillTreeCanvas.tsx`. Do NOT query the DOM for node sizes.

### `SuggestionsList.tsx` — Focused Card vs Expanded Card

`SuggestionsList` already manages `expandedRank` state (or similar) and `previewSuggestionRank`. The keyboard `focusedCardIndex` is a new piece of state that tracks which card has keyboard focus. They are independent:
- `focusedCardIndex` → which card the keyboard is on (for P/S/Enter actions)
- `expandedRank` → which card is expanded (toggled by Enter)
- `previewSuggestionRank` → which suggestion's nodes are highlighted on tree (toggled by P)

Read `SuggestionsList.tsx` fully before implementing — it already has complex state for apply errors, retry, etc. Do not inadvertently break any of that.

### File Locations Summary

| File | Change Type |
|---|---|
| `lebo/src/App.tsx` | Extend `handleKeyDown` useEffect — add `O`, `I`, `Escape` |
| `lebo/src/features/skill-tree/types.ts` | Add `addTickerListener` to `RendererInstance` |
| `lebo/src/features/skill-tree/pixiRenderer.ts` | Implement `addTickerListener` + export `NODE_RADIUS` |
| `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` | Major refactor — invisible-button overlay pattern |
| `lebo/src/features/optimization/SuggestionsList.tsx` | Add keyboard nav (Up/Down/P/S/Enter/Escape) |
| `lebo/src/features/optimization/SuggestionCard.tsx` | Add `role="article"`, `aria-label`, `tabIndex={-1}` |
| `lebo/src/features/settings/Settings.tsx` | Add keyboard shortcuts reference table |
| `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` | New — keyboard overlay tests |

### Coding Patterns (from prior stories)

- Tailwind v4 CSS-first: `className` for layout/spacing, `style={{ color: 'var(--color-...)' }}` for design tokens
- No barrel `index.ts` — import directly from source files
- Tests co-located with source, `*.test.tsx`
- Mock `@tauri-apps/api/core` in tests that invoke Tauri commands
- `getState()` in event handlers, not store subscriptions

### NFR15 — This Story Finalizes It

NFR15 requires every interactive control to be keyboard-reachable and activatable. After this story:
- Skill tree nodes: keyboard-reachable via hidden button overlay ✓
- Suggestion cards: keyboard-reachable via Up/Down nav ✓
- Optimize button: reachable via `O` shortcut ✓
- Build import input: reachable via `I` shortcut ✓
- All Headless UI components (Settings, dialogs): keyboard-native ✓ (already)

Story 6.2 will layer axe-core CI enforcement and ARIA live regions on top of this foundation.

## Project Context

- Architecture: Tauri 2.x + React 19 + TypeScript + PixiJS v8 + Zustand v5 + Tailwind v4 + Headless UI
- Stack: [architecture.md](../_bmad-output/planning-artifacts/architecture.md)
- Epics: [epics.md](../_bmad-output/planning-artifacts/epics.md) — Epic 6, Story 6.1 (lines ~1210–1268)
- UX spec: [ux-design-specification.md](../_bmad-output/planning-artifacts/ux-design-specification.md) — keyboard shortcuts at line ~823; accessibility strategy at line ~880

## Dev Agent Record

### Implementation Plan

1. Added `addTickerListener` to `RendererInstance` interface and implemented in `pixiRenderer.ts` using a wrapper callback for PixiJS type compatibility. Exported `NODE_RADIUS` constant.
2. Replaced the `SkillTreeCanvas.tsx` container-div keyboard approach (Story 1.5) with the invisible-button overlay pattern. Each visible viewport node gets a `sr-only` button that shows a gold focus ring on keyboard focus. Sync is throttled via viewport change detection in the ticker callback.
3. Refactored `SuggestionCard.tsx` to use `forwardRef`, added `role="article"`, `aria-label`, `isFocused`/`isExpanded` props, and `tabIndex={-1}`.
4. Extended `SuggestionsList.tsx` with `focusedCardIndex` + `expandedRank` state, `handleListKeyDown` handler, card refs map, and a `keyboard:escape` event listener.
5. Extended `App.tsx` `handleKeyDown` with `O`/`I`/`Escape` shortcuts, input-target guard, and settings-view guard.
6. Created `BuildImportInput.tsx` (new component; no build import API exists yet — serves as the `I` shortcut focus target).
7. Added keyboard shortcuts reference table to `Settings.tsx`.

### Completion Notes

All 6 tasks complete. 447/447 tests passing. `pnpm tsc --noEmit` clean.

**Key decisions:**
- `BuildImportInput`: No pasteable build-code format exists for Last Epoch (documented in story 2.1 as deferred). Created a minimal textarea stub as the `I` shortcut focus target; actual import logic is a future story.
- Tab traversal in SkillTreeCanvas cycles through `nodeButtons` array order (visible nodes) rather than true BFS graph order — simpler to implement, predictable, and functional. Arrow keys use the connection-graph angle-based approach as specified.
- `SuggestionCard` uses `tabIndex={-1}` (not `0`) — cards are focusable programmatically but not in the natural Tab order, preventing 10+ unwanted Tab stops in the right panel.
- `keyboard:escape` is dispatched as a `CustomEvent` on `window` so components deep in the tree can respond without prop drilling.

## File List

- `lebo/src/App.tsx` — extended `handleKeyDown`: O, I, Escape shortcuts + input-target guard
- `lebo/src/features/skill-tree/types.ts` — added `addTickerListener` to `RendererInstance`
- `lebo/src/features/skill-tree/pixiRenderer.ts` — `addTickerListener` impl + `NODE_RADIUS` export
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` — full refactor: invisible-button overlay
- `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` — NEW: overlay keyboard tests
- `lebo/src/features/optimization/SuggestionCard.tsx` — `forwardRef`, role/aria/tabIndex/isFocused/isExpanded
- `lebo/src/features/optimization/SuggestionsList.tsx` — keyboard nav + escape listener
- `lebo/src/features/optimization/SuggestionsList.test.tsx` — extended with 6 keyboard nav tests
- `lebo/src/features/optimization/OptimizeButton.tsx` — added `id="optimize-button"`
- `lebo/src/features/build-manager/BuildImportInput.tsx` — NEW: textarea stub with `id="build-import-input"`
- `lebo/src/features/layout/LeftPanel.tsx` — added `BuildImportInput`
- `lebo/src/features/settings/Settings.tsx` — keyboard shortcuts reference table

## Review Findings

- [x] [Review][Decision] Tab traversal order: BFS sort implemented — `syncButtonPositions` now orders visible nodes by BFS from directed-edge roots; also fixed single-node Tab flicker guard [`SkillTreeCanvas.tsx`]
- [x] [Review][Patch] Escape key blocked by input guard — fixed: Escape check moved before `isInputTarget` guard [`App.tsx`]
- [x] [Review][Patch] O/I shortcuts intercept modifier combos — fixed: `if (e.ctrlKey || e.metaKey || e.altKey) return` added before O/I handlers [`App.tsx`]
- [x] [Review][Patch] BuildImportInput removes focus outline with no replacement — fixed: `outline: 'none'` replaced with `focus:outline focus:outline-1 focus:outline-[var(--color-accent-gold)]` [`BuildImportInput.tsx`]
- [x] [Review][Patch] `focusedCardIndex` stale after suggestions change — fixed: `prevSuggestionsRef` effect resets `focusedCardIndex` and `expandedRank` when suggestions reference changes [`SuggestionsList.tsx`]
- [x] [Review][Patch] Tab on single visible tree node causes blur+focus flicker — fixed: guard `if (nodeButtons.length < 2) return` + `nextId !== id` check added [`SkillTreeCanvas.tsx`]
- [x] [Review][Patch] Enter on focused suggestion card should apply when already expanded (AC5) — fixed: first Enter expands, second Enter calls `handleApply`; `expandedRank` added to `useCallback` deps [`SuggestionsList.tsx`]
- [x] [Review][Defer] `document.getElementById('optimize-button')?.focus()` gives no feedback when button not visible/mounted — deferred, pre-existing UX gap; toast/announcement out of scope for 6.1 [`App.tsx`]
- [x] [Review][Defer] SuggestionCard child action buttons (Apply/Preview/Skip) remain in natural tab order — creates tab stops outside the managed card-nav model; deferred, spec silent on child button tabIndex [`SuggestionCard.tsx`]
- [x] [Review][Defer] `aria-label` on SuggestionCard embeds full explanation text — may produce very long screen-reader announcements; deferred, no spec constraint on label length [`SuggestionCard.tsx`]
- [x] [Review][Defer] `addTickerListener` wrapper `const cb = () => fn()` creates a new closure per call — if same `fn` passed twice, second subscription can't be removed; deferred, single-call usage in practice [`pixiRenderer.ts`]
- [x] [Review][Defer] `cardRefs` keyed by `suggestion.rank` — reused rank numbers across optimizer re-runs could cause wrong ref; deferred, low risk with sequential rank assignment [`SuggestionsList.tsx`]
- [x] [Review][Defer] Arrow key nav silently dead-ends when connected nodes are off-screen — intentional per dev notes (viewport-only rendering for performance); deferred, known design limitation [`SkillTreeCanvas.tsx`]
- [x] [Review][Defer] `focusedCardIndex`/`expandedRank` desync on mouse apply/skip — mouse interactions don't reset keyboard focus state; deferred, minor cosmetic issue [`SuggestionsList.tsx`]
- [x] [Review][Defer] `tabIndex={0}` entry point shifts to different node during pan — first visible node changes as viewport changes; deferred, acceptable limitation of viewport-array approach [`SkillTreeCanvas.tsx`]

## Change Log

- 2026-04-29: Story 6.1 implemented — keyboard navigation & global shortcuts. All tasks complete, 447 tests passing.
- 2026-04-29: Code review complete — 1 decision-needed resolved, 6 patches applied, 8 deferred, 10 dismissed.

## Story Completion Status

Story created: 2026-04-29
Status: done
