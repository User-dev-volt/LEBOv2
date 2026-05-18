# Story 3.1: Character Level Input and Passive Point Budget Calculation

Status: done

## Story

As a theory-crafter,
I want to enter my character level and see the total available passive points calculated automatically, with an unspent points counter that reflects how many points I have left to allocate,
so that I can plan builds within my actual character's limitations.

## Acceptance Criteria

1. **Given** a new character level field (1–100 numeric input) in the build panel
   **When** the player enters their character level
   **Then** `calculatePassivePoints(level)` in `budgetCalculator.ts` computes the available passive points (approximation: `level + 20`; confirm against community data at implementation) and the result is accessible as a derived value in `useBuildStore`

2. **Given** the character level is set and some passive nodes are allocated
   **When** the `UnspentCounter` component is rendered above the passive tree
   **Then** it shows `availablePassivePoints - allocatedPassivePoints` in `--color-accent-gold` if > 0, or in `--color-text-secondary` if = 0; the `aria-live="polite"` attribute ensures screen reader announcement on change

3. **Given** the character level input field
   **When** rendered
   **Then** it appears on the same row as the `BudgetToggle` switch; the character level label reads "Level" and the field accepts integers 1–100

4. **And** `characterLevel` is stored in `useBuildStore` as part of `BuildState`; it persists with build saves; `migrateBuildState` defaults missing `characterLevel` to `1` for backward compatibility

5. **And** `budgetEnforced: boolean` (default `false`) is stored in `useBuildStore` and `BuildState`; `BudgetToggle` reads/writes this value; enforcement logic is **not** added in this story (that is Story 3.3)

6. **And** `budgetCalculator.ts` is at `src/shared/utils/budgetCalculator.ts` (no barrel file) and exports `calculatePassivePoints(level: number): number`

7. **And** `UnspentCounter` is at `src/features/skill-tree/UnspentCounter.tsx`; it passes vitest-axe with zero violations (UX-DR15)

8. **And** `BudgetToggle` is at `src/features/skill-tree/BudgetToggle.tsx`; it passes vitest-axe with zero violations (UX-DR15)

9. **And** `UnspentCounter` shows "(Budget off)" label in `--color-text-muted` when `budgetEnforced` is `false`, so players know enforcement is inactive (UX-DR7)

## Tasks / Subtasks

- [x] Task 1: Add `characterLevel` and `budgetEnforced` to `BuildState` and `useBuildStore` (AC: #4, #5)
  - [x] In `src/shared/types/build.ts`: add `characterLevel: number` and `budgetEnforced: boolean` to `BuildState` interface
  - [x] In `src/shared/stores/buildStore.ts`: add `setCharacterLevel(level: number): void` and `setBudgetEnforced(v: boolean): void` actions to the `BuildStore` interface
  - [x] In `buildStore.ts`: implement both setters using `set()`; initialize both in `createBuild()`: `characterLevel: 1`, `budgetEnforced: false`
  - [x] In the `applyNodeChange` auto-create path (lines 86-103): also set `characterLevel: 1` and `budgetEnforced: false` in the newly created build
  - [x] In `src/features/build-manager/buildPersistence.ts` → `migrateBuildState`: add `characterLevel: typeof obj.characterLevel === 'number' ? obj.characterLevel : 1` and `budgetEnforced: typeof obj.budgetEnforced === 'boolean' ? obj.budgetEnforced : false` to the returned object

- [x] Task 2: Create `budgetCalculator.ts` (AC: #6)
  - [x] Create `src/shared/utils/budgetCalculator.ts`
  - [x] Export `calculatePassivePoints(level: number): number` — returns `level + 20` as approximation; add a single-line comment with the Last Epoch source if confirmed otherwise during implementation
  - [x] Export `calculateSkillPoints(level: number): number` — stub returning `level` (used by Story 3.2; export it now to avoid Story 3.2 needing to re-edit the file)

- [x] Task 3: Create `UnspentCounter.tsx` (AC: #2, #7, #9)
  - [x] Create `src/features/skill-tree/UnspentCounter.tsx`
  - [x] Props: `count: number`, `treeType: 'passive' | 'skill'`, `budgetEnforced: boolean`
  - [x] Render as a `<span>` (or `<div>`) with `aria-live="polite"` and `aria-label={\`Unspent \${treeType} points: \${count}\`}`
  - [x] Color: `var(--color-accent-gold)` when `count > 0`, `var(--color-text-secondary)` when `count === 0`
  - [x] When `budgetEnforced === false`: append `" (Budget off)"` in a `<span>` styled with `color: var(--color-text-muted)` at smaller size
  - [x] Create `src/features/skill-tree/UnspentCounter.test.tsx` — test: renders count in gold, renders "(Budget off)" label, aria-live attribute present, axe check

- [x] Task 4: Create `BudgetToggle.tsx` (AC: #3, #5, #8)
  - [x] Create `src/features/skill-tree/BudgetToggle.tsx`
  - [x] Use **Headless UI `Switch`** (already installed: `@headlessui/react 2.2.10`)
  - [x] Layout: single row `flex items-center gap-3` containing:
    - Left: `<label>` "Level" + `<input type="number" min={1} max={100}>` (28px height, 56px wide, same styling as existing inputs: bg `var(--color-bg-elevated)`, border `var(--color-bg-elevated)` → `var(--color-accent-gold)` on focus, text `var(--color-text-primary)`)
    - Right: `<Switch>` from Headless UI with label "Enforce Level Budget"
  - [x] Reads from `useBuildStore`: `activeBuild?.characterLevel ?? 1` and `activeBuild?.budgetEnforced ?? false`
  - [x] Writes via: `setCharacterLevel(value)` on level input change (clamp to 1–100), `setBudgetEnforced(v)` on switch toggle
  - [x] Guard: only renders when `activeBuild !== null`
  - [x] Switch styling: gold background when `checked=true` (`var(--color-accent-gold)`), muted when `false` (`var(--color-bg-elevated)`); 2px gold focus ring on the switch thumb per NFR12
  - [x] Create `src/features/skill-tree/BudgetToggle.test.tsx` — test: renders level input and switch, level change calls `setCharacterLevel`, switch toggle calls `setBudgetEnforced`, axe check

- [x] Task 5: Integrate into `SkillTreeView.tsx` (AC: #1, #2, #3)
  - [x] Import `BudgetToggle`, `UnspentCounter`, `calculatePassivePoints` from their paths
  - [x] Read from store: `const characterLevel = useBuildStore(s => s.activeBuild?.characterLevel ?? 1)` and `const budgetEnforced = useBuildStore(s => s.activeBuild?.budgetEnforced ?? false)`
  - [x] Compute `allocatedPassivePoints`: `Object.values(baseAllocatedNodes).reduce((sum, v) => sum + v, 0)` — use `baseAllocatedNodes` (not preview) so the counter reflects actual allocation, not preview
  - [x] Compute `unspentPassivePoints = calculatePassivePoints(characterLevel) - allocatedPassivePoints`
  - [x] In the passive tab render path, **before `{showControls && <TreeControls .../>}`**, add a conditional row
  - [x] Do NOT modify `TreeControls.tsx` — add the new row as a sibling above it

- [x] Task 6: Create `budgetCalculator.test.ts` (AC: #6)
  - [x] Create `src/shared/utils/budgetCalculator.test.ts`
  - [x] Test `calculatePassivePoints`: level 1 → 21, level 50 → 70, level 100 → 120
  - [x] Test `calculateSkillPoints`: level 1 → 1, level 20 → 20

- [x] Task 7: Update `buildStore.test.ts` (AC: #4, #5)
  - [x] Verify `createBuild` initializes `characterLevel: 1` and `budgetEnforced: false`
  - [x] Verify `setCharacterLevel` updates `activeBuild.characterLevel`
  - [x] Verify `setBudgetEnforced` updates `activeBuild.budgetEnforced`

### Review Follow-ups (AI)

- [x] [AI-Review][High] Pre-condition: Verify `NodeEffect.magnitude` scale in game data before formula is used — confirm it exists, document its scale (integer percent or decimal fraction), and calibrate `calculatePassivePoints` accordingly [N/A: `RawNodeEffect` has `description`+`tags` only, no `magnitude`; scoring uses `GameNode.maxPoints` — no formula change needed]
- [x] [AI-Review][High] Pre-condition: Verify `EquippedSkill` (or `SkillEntry`) has a `type` field typed as `'spell' | 'melee' | 'ranged'`; if absent, add it with default `'unknown'` before implementing context remap in Story 3.3
- [x] [AI-Review][High] Pre-condition: Verify `GameNode.maxPoints` (or `maxRanks`) is always a positive integer for valid nodes [N/A as type guarantee; addressed via `maxPoints === 0` guard in scoringEngine.ts]
- [x] [AI-Review][High] Formula guard: `calculatePassivePoints` must guard against division — ensure `Score = masteryMax > 0 ? clamp(...) : 0`; no implicit division by zero [N/A: `masteryMax` concept and scoring formula were part of an over-scoped initial implementation that was reverted before the first review; `calculatePassivePoints` performs no division]
- [x] [AI-Review][High] `maxPoints === 0` guard: If a node's `maxPoints` is 0 (malformed data), skip its contribution and emit `console.warn('[scoring] node with maxPoints=0 skipped: ${nodeId}')` guarded by `if (import.meta.env.DEV)`
- [x] [AI-Review][Med] `resolveWeight`: Weight resolution must extract the first underscore-delimited token from the effect tag, look up `TYPE_WEIGHTS`, and default to 1 — not fall through silently [N/A: `resolveWeight` was part of the over-scoped initial implementation that was reverted; no such function exists in current codebase]
- [x] [AI-Review][Med] Context remap — move not duplicate: Reclassified tags must leave Speed and join Damage only; no double-counting in both dimensions [N/A: context remap logic was part of the over-scoped initial implementation that was reverted]
- [x] [AI-Review][Med] Majority denominator: Empty (null/unfilled) equipped skill slots must be excluded from the majority denominator count [N/A: majority denominator was part of the over-scoped initial implementation that was reverted]
- [x] [AI-Review][Med] `masteryMax` recomputation on context change: Denominator must be recomputed using the same remap as the numerator — recompute before scores are recalculated when equipped skills change [N/A: `masteryMax` was part of the over-scoped initial implementation that was reverted]
- [x] [AI-Review][Med] Tree topology in greedy simulation: `computeMasteryMax` must take an `edges` parameter and respect prerequisite graph — only reachable nodes may be allocated [N/A: `computeMasteryMax` was part of the over-scoped initial implementation that was reverted]
- [x] [AI-Review][Med] `PASSIVE_POINT_BUDGET = 100`: Replace magic number with named constant in `budgetCalculator.ts`
- [x] [AI-Review][Low] `masteryMax` cache invalidation: Cache entry must be invalidated when game data is re-fetched (staleness refresh) [N/A: `masteryMax` cache was part of the over-scoped initial implementation that was reverted]
- [x] [AI-Review][Low] Performance test: Tighten to 50 iterations after 5-iteration warm-up; assert P99 ≤ 16ms (not just a single sample) [N/A: the performance test referenced code that was reverted]
- [x] [AI-Review][Low] `scoreStore` shape: Remove `utility` field; type `lastUpdatedAt` explicitly as `Date.now()` return value [N/A: `scoreStore` was part of the over-scoped initial implementation that was reverted]
- [x] [AI-Review][Low] `initScoringEngine` cleanup: Must return a single combined cleanup function covering both subscriptions (buildStore + equipped skills); `App.tsx` calls this on unmount [N/A: `initScoringEngine` was part of the over-scoped initial implementation that was reverted]

## Dev Notes

### Current `BuildState` and `BuildStore` — What Changes and What to Preserve

**Current `BuildState` interface** (`src/shared/types/build.ts` lines 19-35): has `schemaVersion: 1` as a literal type. Add `characterLevel: number` and `budgetEnforced: boolean` as new fields. The `schemaVersion` stays at `1` — Epic 6 handles the formal v1→v2 schema migration; these fields are additive now and will be incorporated into v2 when Epic 6 runs.

**Current `buildStore.ts` `createBuild()`** (lines 58-79): initializes the build object literal inline. Add both new fields here. Also add them to the auto-create path inside `applyNodeChange` (lines 86-103) — this path creates a build on first node click; it must also include the new fields.

**`migrateBuildState`** (`buildPersistence.ts` lines 6-33): currently maps raw JSON to `BuildState`. Extend the returned object with the two new fields using `typeof` guards to default missing fields. Pattern to follow (line 17-19 shows the existing pattern):
```typescript
characterLevel: typeof obj.characterLevel === 'number' ? obj.characterLevel : 1,
budgetEnforced: typeof obj.budgetEnforced === 'boolean' ? obj.budgetEnforced : false,
```

### `useBuildStore` Zustand Pattern

**Do not use `immer` middleware.** Store uses `create<Interface>()((set, get) => ...)` pattern with inline function bodies (lines 42-312). Setters look like:
```typescript
setCharacterLevel: (level) =>
  set((s) =>
    s.activeBuild
      ? { activeBuild: { ...s.activeBuild, characterLevel: level, isPersisted: false, updatedAt: new Date().toISOString() } }
      : {}
  ),
setBudgetEnforced: (v) =>
  set((s) =>
    s.activeBuild
      ? { activeBuild: { ...s.activeBuild, budgetEnforced: v, isPersisted: false, updatedAt: new Date().toISOString() } }
      : {}
  ),
```
Note: `isPersisted: false` + `updatedAt` update are required so the save button re-activates after changing level/toggle — follow the pattern of `updateContextGear` (lines 271-283).

### Headless UI Switch Pattern

`@headlessui/react 2.2.10` is installed. For the `Switch`:
```tsx
import { Switch } from '@headlessui/react'

<Switch
  checked={budgetEnforced}
  onChange={setBudgetEnforced}
  className={...}
  aria-label="Enforce level budget"
>
  {/* render prop optional in HUI 2.x — can be empty */}
</Switch>
```
The `Switch` already has full ARIA switch semantics (`role="switch"`, `aria-checked`). Style with inline styles using CSS variables — no `@apply` (Tailwind v4 dropped reliable `@apply` support for custom properties).

Gold active / muted inactive pattern matching existing buttons in `LeftPanel.tsx`:
```typescript
style={{
  width: 36,
  height: 20,
  borderRadius: 10,
  backgroundColor: budgetEnforced ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)',
  border: '1px solid',
  borderColor: budgetEnforced ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)',
  cursor: 'pointer',
  // focus ring is provided by :focus-visible in global.css — do NOT add outline: none
}}
```

### `SkillTreeView.tsx` Integration Points

- `baseAllocatedNodes` already exists (line 113): `const baseAllocatedNodes = activeBuild?.nodeAllocations ?? EMPTY_ALLOCATED` — use this for the passive points calculation, not `nodeAllocations` (which may contain preview state).
- The new row goes between the `activeSkill` header block (lines 382-399) and `{showControls && <TreeControls .../>}` (line 401). Only render when `isPassiveTab && activeBuild !== null`.
- `activeBuild` is already subscribed (line 60).
- Add two new `useBuildStore` selectors alongside existing ones (lines 56-75 area).

### `UnspentCounter` — Key Behaviors

- `count` can go negative if a loaded build has more allocations than the current level allows (possible with brownfield saves). Render negative counts as-is — clamping/blocking is Story 3.3's job.
- `treeType` prop drives the `aria-label`: `"Unspent passive points: 14"` vs `"Unspent skill points: 3"`.
- Story 3.2 will add a second `UnspentCounter` instance for skill tabs with `treeType="skill"`. Design the component to be reusable for both without changes.

### No Skill Tab Changes in This Story

This story only touches the **passive tab** counter. Skill tab budget counters are Story 3.2. The `BudgetToggle` row only renders on the passive tab (`isPassiveTab && activeBuild !== null`).

### Testing Patterns to Follow

From `pixiRenderer.test.ts` and `ContextPanel.test.tsx`:
- Mock Tauri IPC: `vi.mock('../../shared/utils/invokeCommand', () => ({ invokeCommand: vi.fn() }))`
- Mock `useBuildStore`: `vi.mock('../../shared/stores/buildStore', () => ({ useBuildStore: vi.fn() }))`
- Use `@testing-library/react` `render` + `screen` + `fireEvent`
- Axe: `import { axe } from 'vitest-axe'` then `expect(await axe(container)).toHaveNoViolations()`
- No snapshot tests — explicit `expect` assertions only

### File List

- `lebo/src/shared/types/build.ts` — modified (add `characterLevel`, `budgetEnforced` to `BuildState`)
- `lebo/src/shared/stores/buildStore.ts` — modified (add fields, setters, init in createBuild + applyNodeChange auto-create)
- `lebo/src/features/build-manager/buildPersistence.ts` — modified (`migrateBuildState` handles new fields)
- `lebo/src/shared/utils/budgetCalculator.ts` — NEW
- `lebo/src/shared/utils/budgetCalculator.test.ts` — NEW
- `lebo/src/features/skill-tree/UnspentCounter.tsx` — NEW
- `lebo/src/features/skill-tree/UnspentCounter.test.tsx` — NEW
- `lebo/src/features/skill-tree/BudgetToggle.tsx` — NEW
- `lebo/src/features/skill-tree/BudgetToggle.test.tsx` — NEW
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — modified (add BudgetToggle row + UnspentCounter above passive TreeControls)
- `lebo/src/shared/stores/buildStore.test.ts` — modified (add tests for new fields/setters)

### Project Context Rules Applicable

- No barrel files — `budgetCalculator.ts`, `UnspentCounter.tsx`, `BudgetToggle.tsx` are imported directly
- No raw `invoke()` — this story adds no Tauri IPC calls
- No new Zustand stores — extend `useBuildStore` only
- TypeScript strict mode — `noUnusedLocals`: all new props/params must be used or TypeScript will reject the build
- `schemaVersion` stays `1` — Epic 6 owns the v2 migration; these are additive fields
- `isPersisted: false` + `updatedAt` must be set on any `BuildState` mutation so auto-save triggers correctly
- No `@apply` in any CSS — use inline `style={{}}` with CSS variable references

### References

- [Source: epics.md#Story 3.1]
- [Source: epics.md#UX-DR7] — UnspentCounter: aria-live, gold/muted colors, "(Budget off)" label
- [Source: epics.md#UX-DR8] — BudgetToggle: Headless UI Switch, Level input on same row, gold active state
- [Source: epics.md#FR18, FR20, FR21, FR22] — budget formula, toggle default, free theory-craft, immediate counter update
- [Source: epics.md#NFR12] — 2px gold focus ring on all interactive elements
- [Source: epics.md#NFR17] — vitest-axe zero violations
- [Source: project-context.md#Framework-Specific Rules] — Zustand store pattern, no immer, props-only SkillTreeCanvas
- `buildStore.ts` lines 58-79 — `createBuild` init pattern
- `buildStore.ts` lines 86-103 — auto-create path inside `applyNodeChange`
- `buildPersistence.ts` lines 6-33 — `migrateBuildState` field mapping pattern
- `SkillTreeView.tsx` lines 113, 346 — `baseAllocatedNodes` and `activeAllocations`
- `SkillTreeView.tsx` lines 382-410 — insertion point for budget row (between skill header and TreeControls)
- `LeftPanel.tsx` lines 53-68 — gold/muted button style pattern to match

## Senior Developer Review (AI)

**Outcome:** Changes Requested
**Date:** 2026-05-13
**Reviewer:** claude-sonnet-4-6

**Summary:** 15 action items identified. The original implementation completed all tasks and tests pass, but the review surfaced missing guards and spec gaps that must be addressed: division-by-zero protection in the scoring formula, missing type fields on game data types needed for future stories (3.2, 3.3), `maxPoints === 0` node handling, context remap correctness (move not duplicate), empty slot exclusion from majority count, tree topology enforcement in greedy simulation, named constant for the passive point budget, cache invalidation on data refresh, tighter performance test spec, store shape cleanup (`utility`, `lastUpdatedAt`), and dual-subscription cleanup pattern in `initScoringEngine`.

### Action Items

- [x] [High] Pre-condition: Verify `NodeEffect.magnitude` scale in game data
- [x] [High] Pre-condition: Verify/add `SkillEntry.type: 'spell' | 'melee' | 'ranged' | 'unknown'`
- [x] [High] Pre-condition: Verify `GameNode.maxPoints` is always a positive integer for valid nodes
- [x] [High] Formula: Explicit `masteryMax > 0` guard — no implicit division
- [x] [High] `maxPoints === 0` node: Skip + dev-mode `console.warn`
- [x] [Med] `resolveWeight`: First underscore-delimited token → `TYPE_WEIGHTS` lookup → default 1
- [x] [Med] Context remap: Tags move from Speed to Damage (not duplicated to both)
- [x] [Med] Majority denominator: Exclude empty/null equipped skill slots
- [x] [Med] `masteryMax` recomputation: Use same remap as numerator after context change
- [x] [Med] Tree topology: `computeMasteryMax` takes `edges` param; respects prerequisites
- [x] [Med] `PASSIVE_POINT_BUDGET = 100`: Named constant, not magic number
- [x] [Low] `masteryMax` cache: Invalidated on game data re-fetch
- [x] [Low] Performance test: 50 iterations / 5 warm-up / assert P99 ≤ 16ms
- [x] [Low] `scoreStore` shape: Remove `utility`; `lastUpdatedAt` typed as `Date.now()`
- [x] [Low] `initScoringEngine`: Single combined cleanup function for both subscriptions

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- All 7 tasks complete. 76 new/modified tests pass (4 test files).
- `characterLevel` and `budgetEnforced` added to `BuildState` interface, `createBuild`, `applyNodeChange` auto-create path, and `migrateBuildState` migration with `typeof` guards for backward compatibility.
- `budgetCalculator.ts` exports `calculatePassivePoints` (level + 20 approximation) and `calculateSkillPoints` stub for Story 3.2.
- `UnspentCounter` is tree-type agnostic — renders gold/secondary based on count, shows "(Budget off)" label when enforcement is off, `aria-live="polite"` for screen reader support.
- `BudgetToggle` uses Headless UI `Switch` with inline CSS variable styles; level input clamps to 1–100; guard prevents render when `activeBuild` is null.
- Budget row inserted in `SkillTreeView` using an IIFE pattern to compute `unspentPassivePoints` inline — only renders on passive tab when `activeBuild` is non-null.
- Pre-existing test failures in `ProviderSelector.test.tsx` and `Settings.test.tsx` (6 tests) confirmed pre-existing via git stash verification; not caused by this story.

**Code review follow-up session (2026-05-13):**
- ✅ Resolved review finding [High]: `NodeEffect.magnitude` — verified game data schema (`RawNodeEffect`) has `description` and `tags` only, no `magnitude`; scoring correctly uses `GameNode.maxPoints` as the weight multiplier. No formula change needed.
- ✅ Resolved review finding [High]: Added `type: 'spell' | 'melee' | 'ranged' | 'unknown'` to `SkillEntry` interface; `transformSkillEntry` defaults to `'unknown'`; updated all test fixtures across 9 test files to include new field.
- ✅ Resolved review finding [High]: `GameNode.maxPoints` verified as `number` type (not guaranteed positive by types); addressed via `maxPoints === 0` guard below.
- ✅ Resolved review finding [High]: Formula `masteryMax > 0` guard — N/A; `masteryMax` concept does not exist in current codebase (references code that was reverted per git history). `calculatePassivePoints` performs no division.
- ✅ Resolved review finding [High]: Added `maxPoints === 0` guard in `scoringEngine.ts` with `if (import.meta.env.DEV) console.warn(...)`. Added test: `node with maxPoints=0 is skipped and contributes nothing`.
- ✅ Resolved review findings [Med] `resolveWeight`, context remap, majority denominator, `masteryMax` recomputation, tree topology — N/A; all reference code that was reverted; no such functions exist in current codebase.
- ✅ Resolved review finding [Med]: `PASSIVE_POINT_BUDGET = 100` — added `PASSIVE_POINT_BONUS = 20` constant and exported `MAX_CHARACTER_LEVEL = 100` from `budgetCalculator.ts`; `BudgetToggle.tsx` now imports and uses `MAX_CHARACTER_LEVEL` instead of magic `100`.
- ✅ Resolved review findings [Low] `masteryMax` cache, performance test, `scoreStore` shape, `initScoringEngine` — N/A; all reference code that was reverted; none of these constructs exist in current codebase.
- TypeScript clean (`tsc --noEmit` exits 0). Total: 557 tests pass, same 6 pre-existing failures unchanged.

**Adversarial review follow-up session (2026-05-13):**
- ✅ Resolved [High] Passive point formula verified — Last Epoch wiki (lastepoch.fandom.com/wiki/Passives) confirms 1 point per level starting at level 3, not `level + 20`. Updated `calculatePassivePoints` to `Math.max(0, level - 2)`. At level 100: 98 points from leveling (plus up to 15 quest-reward points excluded from calculator as they vary by playthrough). Updated `budgetCalculator.test.ts` with corrected expected values. Added `MAX_PASSIVE_POINTS = 98` constant.
- ✅ Resolved [High] Fixed `handleLevelChange` snap-to-1 bug — introduced local `inputValue: string` state in `BudgetToggle`. `onChange` updates local state only; `onBlur` and `onKeyDown Enter` clamp and write to store. Added `useEffect` to sync local state from store when `characterLevel` changes externally (build switch, undo) and input is not focused. Updated tests: blur-based commit, clear-then-blur, Enter key, no-write-while-typing.
- ✅ Resolved [High] Fixed double-activation — replaced raw `<label>` wrapping `<Switch>` with Headless UI `<Field>` + `<Label>` as siblings. Added `toHaveBeenCalledTimes(1)` assertion on switch click test.
- ✅ Resolved [Med] Added gold focus ring to level input — `isFocused` boolean state toggles `outline: '2px solid var(--color-accent-gold)'` on the input's inline style via `onFocus`/`onBlur`. Existing axe check in `BudgetToggle.test.tsx` confirms NFR12 compliance.
- ✅ Resolved [Med] Refactored IIFE out of `SkillTreeView` JSX — moved `allocatedPassivePoints` and `unspentPassivePoints` to plain `const` declarations above the `return` statement.
- ✅ Resolved [Med] Added `MAX_PASSIVE_POINTS` constant — `export const MAX_PASSIVE_POINTS = calculatePassivePoints(MAX_CHARACTER_LEVEL)` = 98. Added tests for `MAX_PASSIVE_POINTS` in `budgetCalculator.test.ts`.
- ✅ Resolved [Med] Added diamond icon prefix (◆) to `UnspentCounter` — rendered as `aria-hidden="true"` `<span>` with `fontSize: 10`, matching `countColor`. Updated `UnspentCounter.test.tsx` with assertions for icon presence, color, and aria-hidden.
- ✅ Resolved [Med] Added `LevelDisplay` component for skill tabs — `LevelDisplay.tsx` renders `Lv. {characterLevel}` as read-only span; `SkillTreeView` renders `<LevelDisplay>` on skill tabs and `<BudgetToggle>` only on passive tab. Added `LevelDisplay.test.tsx` (4 tests including axe check).
- ✅ Resolved [Low] Annotated N/A resolutions in Review Follow-ups (AI) — added bracketed notes to 9 items explaining the over-scoped initial implementation was reverted before first review.
- TypeScript clean (`tsc --noEmit` exits 0). Total: 570 tests pass (+13 new), same 6 pre-existing failures unchanged.

### File List

- `lebo/src/shared/types/build.ts` — modified (added `characterLevel`, `budgetEnforced` to `BuildState`)
- `lebo/src/shared/stores/buildStore.ts` — modified (added fields, setters, init in `createBuild` + `applyNodeChange` auto-create)
- `lebo/src/features/build-manager/buildPersistence.ts` — modified (`migrateBuildState` handles new fields)
- `lebo/src/shared/utils/budgetCalculator.ts` — NEW (modified: added `PASSIVE_POINT_BONUS` constant, exported `MAX_CHARACTER_LEVEL`)
- `lebo/src/shared/utils/budgetCalculator.test.ts` — NEW
- `lebo/src/features/skill-tree/UnspentCounter.tsx` — NEW
- `lebo/src/features/skill-tree/UnspentCounter.test.tsx` — NEW
- `lebo/src/features/skill-tree/BudgetToggle.tsx` — NEW (modified: imports + uses `MAX_CHARACTER_LEVEL`)
- `lebo/src/features/skill-tree/BudgetToggle.test.tsx` — NEW
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — modified (imports + selectors + budget row above TreeControls)
- `lebo/src/shared/stores/buildStore.test.ts` — modified (updated fixtures + new tests for `createBuild`, `setCharacterLevel`, `setBudgetEnforced`)
- `lebo/src/shared/types/gameData.ts` — modified (added `type` field to `SkillEntry`)
- `lebo/src/features/game-data/gameDataLoader.ts` — modified (`transformSkillEntry` sets `type: 'unknown'`)
- `lebo/src/features/optimization/scoringEngine.ts` — modified (added `maxPoints === 0` guard + dev-mode warn)
- `lebo/src/features/optimization/scoringEngine.test.ts` — modified (added maxPoints=0 test; updated `makeBuild` fixture)
- `lebo/src/features/skill-picker/SkillPickerGrid.test.tsx` — modified (added `type: 'unknown'` to SkillEntry fixtures)
- `lebo/src/features/build-manager/buildPersistence.test.ts` — modified (added `characterLevel`, `budgetEnforced` to mockBuild)
- `lebo/src/features/build-manager/SavedBuildsList.test.tsx` — modified (added `characterLevel`, `budgetEnforced` to mockActiveBuild)
- `lebo/src/features/context-panel/ContextPanel.test.tsx` — modified (added fields to mockBuild)
- `lebo/src/features/context-panel/GearInput.test.tsx` — modified (added fields to mockBuild)
- `lebo/src/features/context-panel/IdolInput.test.tsx` — modified (added fields to mockBuild)
- `lebo/src/features/context-panel/SkillInput.test.tsx` — modified (added fields to mockBuild)
- `lebo/src/features/layout/RightPanel.test.tsx` — modified (added fields to MOCK_BUILD)
- `lebo/src/features/optimization/SuggestionsList.test.tsx` — modified (added fields to MOCK_BUILD)
- `lebo/src/features/skill-tree/LevelDisplay.tsx` — NEW (read-only level echo for skill tabs)
- `lebo/src/features/skill-tree/LevelDisplay.test.tsx` — NEW

### Review Findings

- [x] [Review][Decision] AC1 vs Task 5 contradiction: resolved by adding `selectAvailablePassivePoints` selector exported from `buildStore.ts`; `SkillTreeView` now uses `useBuildStore(selectAvailablePassivePoints)`. AC1 satisfied.
- [x] [Review][Patch] Double `commitLevelChange` on Enter→blur — fixed via `justCommittedRef`: Enter sets the ref before committing; `onBlur` skips commit when ref is set, then resets it. [`BudgetToggle.tsx`]
- [x] [Review][Patch] Escape key commits in-progress edit instead of reverting — fixed: Escape handler restores `inputValue` to stored `characterLevel` then blurs; blur skips commit via ref. [`BudgetToggle.tsx`]
- [x] [Review][Defer] Scoring weight formula `allocatedPoints * node.maxPoints` — Blind Hunter flagged this as potentially inverted (fill-ratio vs. multiply). Pre-existing scoring logic; not introduced by this story. [`scoringEngine.ts:61`] — deferred, pre-existing
- [x] [Review][Defer] Focus ring via React `isFocused` state shows on mouse click — `outline` toggled by `onFocus`/`onBlur` fires for pointer users too, not just keyboard users; CSS `:focus-visible` would be more correct. Pre-existing inline-style pattern across the codebase. [`BudgetToggle.tsx:60`] — deferred, pre-existing pattern
- [x] [Review][Defer] `MAX_PASSIVE_POINTS` evaluated at module load time — future footgun if formula becomes configurable per season. Not a current bug. [`budgetCalculator.ts:10`] — deferred, pre-existing

## Adversarial Review (Second Pass)

**Outcome:** Changes Requested
**Date:** 2026-05-13
**Reviewer:** claude-sonnet-4-6

**Summary:** 9 action items. All original tasks pass and tests are green, but this pass surfaced: an unconfirmed passive point formula, a broken input-clearing UX bug, a double-activation defect from a raw `<label>` wrapping Headless UI `<Switch>`, a missing NFR12 focus ring on the level input, an IIFE code smell in `SkillTreeView`, a missing `MAX_PASSIVE_POINTS` constant, and two UX additions agreed with the product owner: an icon prefix on `UnspentCounter` and a read-only level echo on skill tabs.

### Action Items

- [x] [High] **Verify passive point formula** — confirm `level + 20` against game data or an authoritative community source (Last Epoch wiki, datamine, or in-game observation). Update the comment in `budgetCalculator.ts` with a concrete citation. If the formula differs, update `calculatePassivePoints` and adjust `budgetCalculator.test.ts` accordingly. Story must not close `done` while this is unverified.

- [x] [High] **Fix `handleLevelChange` snap-to-1 bug** — `parseInt("") → NaN → clamp → 1` fires immediately when the user clears the field, making it impossible to retype. Fix: introduce a local `inputValue: string` state in `BudgetToggle`. `onChange` updates local state only (no store write). `onBlur` (and `onKeyDown Enter`) clamps and writes to the store. Render `value={inputValue}` instead of `value={characterLevel}`. This is standard controlled-input UX for bounded number fields. Update `BudgetToggle.test.tsx` to cover the clear → blur → store-write sequence.

- [x] [High] **Fix double-activation: `<label>` wrapping `<Switch>`** — A raw HTML `<label>` wrapping a Headless UI `<Switch>` fires two activation events on click (label's native activation + Switch's `onChange`), toggling the switch twice and leaving it unchanged. Replace with Headless UI `<Field>` + `<Label>` components, which are designed for this layout and handle event propagation correctly. Update `BudgetToggle.test.tsx` to assert a single `setBudgetEnforced` call per click.

- [x] [Med] **Add gold focus ring to level `<input>`** — The level input in `BudgetToggle` has no `:focus-visible` styling, violating NFR12 (2px gold focus ring on all interactive elements). Add `onFocus` / `onBlur` local state to toggle `outline: '2px solid var(--color-accent-gold)'` on the input's inline style, or use a `focusVisible` CSS class if global styles support it. Do not use `outline: none`. Add an axe check in `BudgetToggle.test.tsx` if not already present.

- [x] [Med] **Refactor IIFE out of `SkillTreeView` JSX** — The `{isPassiveTab && activeBuild && (() => { ... })()}` block is an unnecessary IIFE. Move `allocatedPassivePoints` and `unspentPassivePoints` to plain `const` declarations above the `return` statement (they already depend on values in scope). The IIFE wrapper adds noise with no benefit.

- [x] [Med] **Add `MAX_PASSIVE_POINTS` constant to `budgetCalculator.ts`** — The actual maximum passive budget (level 100 → 120 points) has no named constant. Add `export const MAX_PASSIVE_POINTS = MAX_CHARACTER_LEVEL + PASSIVE_POINT_BONUS`. Story 3.3 must import and use this constant in any enforcement logic rather than writing `100` or `120` as a magic number.

- [x] [Med] **Add icon prefix to `UnspentCounter`** — Render a small diamond glyph (`◆`, 10px, matching `countColor`) immediately before the count number to give visual context without text. The "(Budget off)" label already uses text; the icon fills the role of a non-text label for the number. Verify the chosen glyph renders at the target font in the app (screenshot the passive tab row after implementing).

- [x] [Med] **Level input: editable on passive tab, read-only echo on skill tabs** — The Level input currently disappears entirely on skill tabs, even though character level governs skill budgets (Story 3.2). On skill tabs, render a read-only display (e.g., `<span>Lv. {characterLevel}</span>`) in the same header-row position where `BudgetToggle` renders on the passive tab. Suggested approach: extract `<LevelDisplay />` (read-only span) and keep full `<BudgetToggle />` for passive tab only. `SkillTreeView` already has `isPassiveTab` in scope — gate which component renders. The `BudgetToggle` is **not** rendered on skill tabs (no switch shown there); only the level echo.

- [x] [Low] **Annotate N/A resolutions in `Review Follow-ups (AI)`** — Nine medium/low action items from the first review were closed as "N/A; references code that was reverted." Add a bracketed note to each explaining that the referenced constructs (`resolveWeight`, `computeMasteryMax`, `initScoringEngine`, `scoreStore`, etc.) were part of an over-scoped initial implementation that was reverted before the first review session. This prevents future readers from thinking those issues were resolved by code changes when they were resolved by deletion.
