# Story 1.6: Active Skill Tree Tab Navigation

Status: done

## Story

As an advanced Last Epoch player,
I want to switch between my passive tree and the skill trees of each of my active skills using tabs at the top of the canvas,
So that I can view and interact with my complete build across all tree types in one interface.

## Acceptance Criteria

1. **Given** a build has one or more active skills set in the context panel
   **When** the user views the skill tree canvas
   **Then** tabs appear at the top: "Passive Tree" plus one tab per active skill (labeled with the skill name)
   **And** the selected tab has a gold underline and primary text weight; unselected tabs show muted text

2. **Given** the user clicks an active skill tab
   **When** the tab selection changes
   **Then** the canvas switches to render the skill-specific tree for that active skill within ≤ 2 seconds (stub for this story)

3. **Given** no active skills have been set in the context panel
   **When** the user views the canvas header
   **Then** only the "Passive Tree" tab is visible — no empty placeholder skill tabs

## Tasks / Subtasks

- [x] Task 1: Create `src/features/skill-tree/SkillTreeTabBar.tsx` (AC: 1, 3)
  - [x] `TabGroup`, `TabList`, `Tab` from `@headlessui/react` (controlled: `selectedIndex` + `onChange`)
  - [x] "Passive Tree" tab always first; one `Tab` per entry in `activeSkills` prop
  - [x] Selected tab: `border-bottom: 2px solid var(--color-accent-gold)`, `color: var(--color-text-primary)`, `font-weight: 600`
  - [x] Unselected tab: transparent bottom border, `color: var(--color-text-muted)`, normal weight
  - [x] `focus:outline-none` on each Tab; `tabIndex={-1}` for unselected per HUI v2 default behaviour
  - [x] Add `SkillTreeTabBar.test.tsx` with 4 tests (see Dev Notes)

- [x] Task 2: Update `src/features/skill-tree/SkillTreeView.tsx` (AC: 1, 2, 3)
  - [x] Read `activeSkills = useBuildStore(s => s.activeBuild?.contextData.skills ?? EMPTY_SKILLS)`; define `EMPTY_SKILLS: ActiveSkill[] = []` as module constant
  - [x] Add `activeTabIndex: number` state (default `0`)
  - [x] Add `useEffect` that resets `activeTabIndex` to `0` when `activeTabIndex >= 1 + activeSkills.length` (skill removed mid-session)
  - [x] Compute `isPassiveTab = activeTabIndex === 0`
  - [x] Change outer wrapper from `<div className="h-full" ...>` to `<div id="skill-tree-canvas" className="flex flex-col h-full">`
  - [x] Render `<SkillTreeTabBar activeSkills={activeSkills} selectedIndex={activeTabIndex} onChange={setActiveTabIndex} />` before canvas area
  - [x] Canvas area becomes `<div className="flex-1 min-h-0 relative" onMouseMove={handleMouseMove}>`
  - [x] When `isPassiveTab`: render existing `SkillTreeCanvas` + `NodeTooltip` logic (unchanged)
  - [x] When skill tab: render `<SkillTreeStubPanel skillName={activeSkills[activeTabIndex - 1]?.skillName ?? ''} />` (see Dev Notes for stub)

- [x] Task 3: Validate (AC: 1, 2, 3)
  - [x] `pnpm tsc --noEmit` → zero errors
  - [x] `pnpm vitest run` → 111/111 tests pass (4 new across 15 files)

## Dev Notes

### SkillTreeTabBar Tests (4)

1. Renders only "Passive Tree" tab when `activeSkills` is empty
2. Renders "Passive Tree" + one tab per skill when `activeSkills` has entries
3. The tab at `selectedIndex` has `aria-selected="true"`
4. Calls `onChange` with the correct index when a tab is clicked

### Stub Skill Panel

For skill tabs in this story, render an inline stub (no separate file needed — keep it in `SkillTreeView.tsx`):

```tsx
function SkillTreeStubPanel({ skillName }: { skillName: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {skillName} skill tree — available in Epic 4
      </p>
    </div>
  )
}
```

This is a module-local function in `SkillTreeView.tsx`, not exported. No separate file.

### Tab Styling

Tabs sit on a bar with `border-bottom: 1px solid var(--color-bg-elevated)`. Each tab has:
- `marginBottom: '-1px'` to overlap the bar border with the selected tab's gold border
- `border-bottom: 2px solid var(--color-accent-gold)` when selected; `2px solid transparent` when not
- `padding: '8px 16px'`

### Layout Change

```
Before: <div className="h-full" onMouseMove={...}>
After:  <div id="skill-tree-canvas" className="flex flex-col h-full">
          <SkillTreeTabBar />
          <div className="flex-1 min-h-0 relative" onMouseMove={...}>
            {isPassiveTab ? <SkillTreeCanvas + tooltips> : <SkillTreeStubPanel>}
          </div>
        </div>
```

`id="skill-tree-canvas"` moves to the outer wrapper so the App.tsx skip link still targets the whole tree area.

### Previous Story Learnings

- No `index.ts` barrel files — import directly
- Tailwind v4 CSS-first — use `var(--color-*)` tokens
- Headless UI v2 named sub-components: `TabGroup`, `TabList`, `Tab`
- `@headlessui/react` Listbox usage pattern in `ClassMasterySelector.tsx` as reference
- HUI v2 `Tab` supports `className` (string or render fn) + standard `style` prop
- Keep `EMPTY_*` constants at module level for stable references

### Active Skills Data Shape

```ts
// from build.ts:
interface ActiveSkill {
  slotId: string
  skillName: string
}
// default: activeBuild?.contextData.skills ?? []
```

For stub testing in unit tests, create mock `ActiveSkill[]` directly — no store setup needed since `SkillTreeTabBar` is a pure presentational component.

### References

- `src/features/skill-tree/SkillTreeView.tsx` — modify
- `src/shared/types/build.ts` — `ActiveSkill` interface
- Epic 6, Story 6.1 — full keyboard nav for tabs (Tab/arrow keys) is deferred there
- `_bmad-output/planning-artifacts/epics.md` line ~446

## Review Findings

- [x] [Review][Decision] EmptyTreeState branch: skill tab clicks update `activeTabIndex` but `SkillTreeStubPanel` is never rendered — resolved: option B chosen, empty branch now respects `isPassiveTab`. [SkillTreeView.tsx]

- [x] [Review][Patch] One-frame blank skill name flash on skill removal — fixed: `safeTabIndex` derived during render; `isPassiveTab` and both `SkillTreeStubPanel` calls use `safeTabIndex`. [SkillTreeView.tsx]

- [x] [Review][Patch] Stale `activeTabIndex` persists across `activeBuild` switches — fixed: `useEffect` keyed on `activeBuild?.id` resets to 0 on build change. [SkillTreeView.tsx]

- [x] [Review][Patch] Passive tab key collision risk — fixed: `'passive'` → `'__passive__'`. [SkillTreeTabBar.tsx L12]

- [x] [Review][Patch] Tests use `.toBeDefined()` instead of `.toBeInTheDocument()` — fixed: replaced with `.toBeInTheDocument()`. [SkillTreeTabBar.test.tsx]

- [x] [Review][Defer] Non-null assertions `hoveredNodeId!` and `keyboardFocusedNodeId!` [SkillTreeView.tsx L151, L166] — deferred, pre-existing (introduced in story 1.5)

- [x] [Review][Defer] `EMPTY_ALLOCATED` typed as mutable `Record<string, number>` rather than `Readonly<Record<string, number>>` [SkillTreeView.tsx L13] — deferred, pre-existing sentinel pattern

- [x] [Review][Defer] Inline style object allocations on every render inside `TabList` and `Tab` map [SkillTreeTabBar.tsx L21–35] — deferred, pre-existing concern; negligible for 5-tab component

- [x] [Review][Defer] No text truncation or max-width for long skill names in tab labels [SkillTreeTabBar.tsx L25] — deferred, future polish, not in story 1.6 scope

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- All 3 tasks complete. `pnpm tsc --noEmit` → zero errors. `pnpm vitest run` → 111/111 tests pass (15 files, 4 new story 1.6 tests).
- `SkillTreeTabBar` is a pure presentational component — controlled `TabGroup` from `@headlessui/react`. Styles driven by `selectedIndex === i` comparison via inline `style` prop (CSS vars) + `focus:outline-none` className.
- `SkillTreeView` tab state is owned by `activeTabIndex: number` (default 0). A `useEffect` guards against out-of-bounds index when a skill is removed mid-session.
- `EmptyTreeState` path (no class/mastery selected) now also renders the tab bar, matching the AC3 requirement that the tab row is always visible.
- Skill tab stub content rendered via module-local `SkillTreeStubPanel` — no extra file, not exported. Real skill tree data wired in Epic 4.
- `id="skill-tree-canvas"` moved from inner canvas wrapper to the outermost `SkillTreeView` div so the App.tsx skip link still resolves correctly.

### File List

**New files:**
- `lebo/src/features/skill-tree/SkillTreeTabBar.tsx`
- `lebo/src/features/skill-tree/SkillTreeTabBar.test.tsx`

**Modified files:**
- `lebo/src/features/skill-tree/SkillTreeView.tsx`

## Change Log

| Date | Change |
|------|--------|
| 2026-04-23 | Story file created from epics spec. Status → in-progress. |
| 2026-04-23 | All 3 tasks implemented: SkillTreeTabBar + tests, SkillTreeView wired with tab state + stub panel. 111/111 tests pass. Status → review. |
| 2026-04-23 | Code review complete (Blind Hunter + Edge Case Hunter). 1 decision resolved (option B — EmptyTreeState respects tab), 4 patches applied: safeTabIndex derived during render, build-switch reset effect, passive key namespaced, test assertions tightened. 111/111 tests pass. Status → done. |
