# Story 1.4: Active Skill Tab → Skill Picker Integration

Status: done

## Story

As a theory-crafter,
I want to select a skill from the picker and have it load that skill's full interactive tree under the active tab,
So that I can plan all 5 active skill slots with their complete trees visible.

## Acceptance Criteria

1. **Given** the skill picker is open for an active skill tab
   **When** the player clicks a skill (or presses Enter on a focused skill cell)
   **Then** the picker closes, the tab shows the selected skill's name, and the skill's full treeData loads into the center canvas

2. **Given** the active skill tab now has a skill assigned
   **When** the player clicks the tab again
   **Then** the skill picker re-opens as a popover/flyout anchored to the tab (not a full center-panel replacement)

3. **Given** five active skill slot tabs are present
   **When** each tab has a different skill assigned
   **Then** switching between tabs renders each skill's tree independently without losing any tab's allocation state

4. **Given** the treeData for a skill is loaded into SkillTreeCanvas
   **When** the player allocates nodes in that tree
   **Then** the allocations are stored in `skillNodeAllocations[slotId]` (a `Record<string, number>` per slot) so tab switching preserves all node states

5. **And** FR10 is satisfied: the active skill's name and unlock condition appear in a header strip above the canvas; other active skill slot indicators are visible in the tab bar row

6. **And** an empty skill tab (no skill assigned) renders a prompt/empty state with a "Select a skill" label when the picker is not open

## Tasks / Subtasks

- [x] Task 1: Extend game data schema for skill trees (AC: #1, #3, #4)
  - [x] **`src-tauri/src/models/game_data.rs`**: Add `RawSkillEntry` struct with `serde(rename_all = "camelCase")`:
    ```rust
    pub struct RawSkillEntry {
        pub id: String,
        pub name: String,
        pub mastery_id: Option<String>,
        pub mastery_gate_points: Option<u32>,
        pub skill_tree: RawTreeData,
    }
    ```
    Add `pub skills: Vec<RawSkillEntry>` to `RawClassData`.
  - [x] **`src/features/game-data/types.ts`**: Add `RawSkillEntry` interface (mirrors Rust struct with camelCase fields). Add `skills: RawSkillEntry[]` to `RawClassData`.
  - [x] **`src/shared/types/gameData.ts`**: Add two fields to `ClassData`:
    ```typescript
    skills: SkillEntry[]                                // for SkillPickerGrid
    skillTrees: Record<string, Record<string, GameNode>>  // skillId → nodes
    ```
    `SkillEntry` is already defined in this file (added in Story 1.3).
  - [x] **`src/features/game-data/gameDataLoader.ts`**: Update `transformClass` to transform skills:
    ```typescript
    const skills: SkillEntry[] = raw.skills.map(s => ({
      skillId: s.id,
      skillName: s.name,
      masteryId: s.masteryId,
      masteryName: s.masteryId != null ? (masteries[s.masteryId]?.masteryName ?? null) : null,
      masteryGatePoints: s.masteryGatePoints,
    }))
    const skillTrees: Record<string, Record<string, GameNode>> = {}
    for (const rawSkill of raw.skills) {
      skillTrees[rawSkill.id] = transformTree(rawSkill.skillTree)
    }
    ```
    Return both in the `ClassData` object alongside existing fields. The existing `transformTree` function handles `{ nodes: RawGameNode[]; edges: RawEdge[] }` — reuse it.
  - [x] **`src-tauri/resources/game-data/classes/sentinel.json`**: Add `"skills"` array. Minimum: 1 base class skill (no mastery gate) + 2 Void Knight mastery skills. Each skill needs `id`, `name`, `masteryId`, `masteryGatePoints`, and a `skillTree` with `nodes` (5–10 entries) and `edges`. Use the same `RawGameNode` format as passive trees (`id`, `name`, `x`, `y`, `size`, `maxPoints`, `effects[{description, tags}]`). Example structure:
    ```json
    {
      "id": "smite",
      "name": "Smite",
      "masteryId": null,
      "masteryGatePoints": null,
      "skillTree": {
        "nodes": [
          { "id": "smite-core", "name": "Smite", "x": 0, "y": 0, "size": "large", "maxPoints": 1,
            "effects": [{ "description": "Your base Smite skill.", "tags": ["LIGHTNING"] }] },
          { "id": "smite-holy-aura", "name": "Holy Aura", "x": 280, "y": 0, "size": "medium", "maxPoints": 5,
            "effects": [{ "description": "+8% Lightning Damage per point.", "tags": ["LIGHTNING", "DAMAGE"] }] }
        ],
        "edges": [
          { "fromId": "smite-core", "toId": "smite-holy-aura" }
        ]
      }
    }
    ```
  - [x] Add similar stub skill data to `acolyte.json`, `mage.json`, `primalist.json`, `rogue.json` — at minimum 1 base class skill + 1 mastery skill each, with 5+ nodes per skill tree, referencing the correct mastery IDs: acolyte (`lich`, `necromancer`, `warlock`), mage (`sorcerer`, `spellblade`, `runemaster`), primalist (`shaman`, `druid`, `beastmaster`), rogue (`bladedancer`, `marksman`, `falconer`). Skill IDs must be globally unique (prefix with class: `"acolyte-rip-blood"`, etc.).

- [x] Task 2: Extend BuildState for per-slot skill allocations (AC: #3, #4)
  - [x] **`src/shared/types/build.ts`**:
    - Add `skillId: string` to `ActiveSkill` (the slot now carries the selected skill's ID)
    - Add `skillNodeAllocations: Record<string, Record<string, number>>` to `BuildState` — outer key is `slotId` (`"slot-0"` through `"slot-4"`), inner key is `nodeId`
  - [x] **`src/shared/stores/buildStore.ts`**:
    - Add `skillNodeAllocations: {}` to the initial state in `createBuild` and `clearActiveBuild` (both branches)
    - Add `assignSkillToSlot: (slotId: string, skill: Pick<SkillEntry, 'skillId' | 'skillName'>) => void` action: replaces or inserts into `contextData.skills` (filter out existing slotId entry, add new one), clears `skillNodeAllocations[slotId]` when the skill changes (assigning a different skill resets that slot's allocations)
    - Add `applySkillNodeChange: (slotId: string, nodeId: string, delta: number, treeData: TreeData) => ApplyNodeResult` action: identical prerequisite and dependent validation logic as `applyNodeChange` but reads/writes `activeBuild.skillNodeAllocations[slotId]` instead of `activeBuild.nodeAllocations`; pushes to same `undoStack` (stores full `BuildState` snapshot so Ctrl+Z restores both passive and skill allocations)
  - [x] **`src/shared/stores/buildStore.ts`** — also add `skillNodeAllocations` to the `BuildStore` interface type, and to `setActiveBuild` (pass-through), and confirm `undoNodeChange` already restores skill allocations (it restores the full `BuildState` snapshot — no extra work needed)

- [x] Task 3: Add `buildSkillTreeData` to treeDataTransformer.ts (AC: #1, #3, #4)
  - [x] **`src/features/skill-tree/treeDataTransformer.ts`**: Export a new function:
    ```typescript
    export function buildSkillTreeData(
      skillNodes: Record<string, GameNode>,
      allocations: Record<string, number>
    ): TreeData {
      const nodes: TreeNode[] = []
      const edges: TreeEdge[] = []
      appendTreeNodes(nodes, edges, skillNodes, allocations, 0)
      return { nodes, edges }
    }
    ```
    This reuses the private `appendTreeNodes` function — no new logic, just a named export for single-section skill trees (no mastery Y-offset).

- [x] Task 4: Extend `useSkillTree` to support skill tabs (AC: #4)
  - [x] **`src/features/skill-tree/useSkillTree.ts`**: Add optional second parameter `slotId?: string`:
    ```typescript
    export function useSkillTree(
      treeData: TreeData | null,
      slotId?: string
    ): SkillTreeInteraction
    ```
    Subscribe to `applySkillNodeChange` from the store. In `handleNodeClick`:
    ```typescript
    const result = slotId !== undefined
      ? applySkillNodeChange(slotId, nodeId, delta, treeData)
      : applyNodeChange(nodeId, delta, treeData)
    ```
    Flash/error behavior is identical for both paths — no change needed there.

- [x] Task 5: Update `SkillTreeTabBar.tsx` for tab click callbacks (AC: #2)
  - [x] **`src/features/skill-tree/SkillTreeTabBar.tsx`**: Add optional prop:
    ```typescript
    onSkillTabClick?: (slotIndex: number, element: HTMLButtonElement) => void
    ```
    On each skill `<Tab>` (index `i` in the tabs array where `i >= 1`), add an `onClick` handler:
    ```typescript
    onClick={(e) => onSkillTabClick?.(i - 1, e.currentTarget as HTMLButtonElement)}
    ```
    This fires even when the tab is already selected (Headless UI fires `onClick` on every click regardless of whether the tab changes). The passive tab (index 0) does NOT get this handler — only skill tabs.

- [x] Task 6: Update `SkillTreeView.tsx` — wire picker and skill tree rendering (AC: #1–#6)
  - [x] **State additions** (local, not store):
    ```typescript
    type PickerState = {
      slotIndex: number        // 0-based slot index
      anchorRect: DOMRect      // getBoundingClientRect() at click time
      isPopover: boolean       // true=has skill, false=empty tab
    }
    const [pickerState, setPickerState] = useState<PickerState | null>(null)
    ```
  - [x] **Store subscriptions to add**:
    ```typescript
    const assignSkillToSlot = useBuildStore((s) => s.assignSkillToSlot)
    const applySkillNodeChange = useBuildStore((s) => s.applySkillNodeChange)
    const skillNodeAllocations = useBuildStore(
      (s) => s.activeBuild?.skillNodeAllocations ?? EMPTY_SKILL_ALLOC
    )
    ```
    Add `const EMPTY_SKILL_ALLOC: Record<string, Record<string, number>> = {}` alongside the other empty constants at the top of the file.
  - [x] **`handleSkillTabClick` callback**:
    ```typescript
    const handleSkillTabClick = useCallback(
      (slotIndex: number, el: HTMLButtonElement) => {
        const slotId = `slot-${slotIndex}`
        const hasSkill = activeSkills.some(s => s.slotId === slotId)
        setPickerState({ slotIndex, anchorRect: el.getBoundingClientRect(), isPopover: hasSkill })
        setActiveTabIndex(slotIndex + 1)
      },
      [activeSkills]
    )
    ```
  - [x] **`handleSkillSelect` callback**:
    ```typescript
    const handleSkillSelect = useCallback(
      (skillId: string) => {
        if (!pickerState || !classData) return
        const skillEntry = classData.skills.find(s => s.skillId === skillId)
        if (!skillEntry) return
        const slotId = `slot-${pickerState.slotIndex}`
        assignSkillToSlot(slotId, skillEntry)
        setPickerState(null)
      },
      [pickerState, classData, assignSkillToSlot]
    )
    ```
  - [x] **Filtered skills for picker** (memo):
    ```typescript
    const filteredSkills = useMemo(
      () => classData?.skills.filter(
        s => s.masteryId === null || s.masteryId === selectedMasteryId
      ) ?? [],
      [classData, selectedMasteryId]
    )
    ```
  - [x] **Skill tree data computation** (memo) — add below the existing `treeData` memo:
    ```typescript
    const slotId = isPassiveTab ? null : `slot-${safeTabIndex - 1}`
    const activeSkill = slotId
      ? activeSkills.find(s => s.slotId === slotId) ?? null
      : null
    const skillNodes = activeSkill ? classData?.skillTrees[activeSkill.skillId] : undefined
    const slotAllocations = slotId ? (skillNodeAllocations[slotId] ?? EMPTY_ALLOCATED) : EMPTY_ALLOCATED
    const skillTreeData = useMemo(
      () => skillNodes ? buildSkillTreeData(skillNodes, slotAllocations) : null,
      [skillNodes, slotAllocations]
    )
    ```
  - [x] **Hook call for skill tab** — add after the existing `useSkillTree` call:
    ```typescript
    const skillTreeInteraction = useSkillTree(skillTreeData, slotId ?? undefined)
    ```
    The existing `useSkillTree(treeData)` call remains for the passive tab. The `skillTreeInteraction` is a separate instance that routes to `applySkillNodeChange`.
  - [x] **Update `SkillTreeTabBar` usage** — add `onSkillTabClick={handleSkillTabClick}` prop.
  - [x] **Skill header strip** (FR10) — render above the skill canvas when `activeSkill !== null`:
    ```tsx
    {!isPassiveTab && activeSkill && (
      <div className="px-4 py-1.5 flex items-center gap-3 text-sm"
        style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {activeSkill.skillName}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>Level —</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {classData?.skills.find(s => s.skillId === activeSkill.skillId)?.masteryGatePoints != null
            ? `Requires ${classData.skills.find(s => s.skillId === activeSkill.skillId)!.masteryGatePoints} mastery points`
            : classData?.className
              ? `Available for ${classData.className}`
              : ''}
        </span>
      </div>
    )}
    ```
    "Level —" is a placeholder — Story 3.2 replaces it with actual skill level input.
  - [x] **Center panel rendering for skill tabs** — replace the single `SkillTreeStubPanel` block with:
    ```
    if !isPassiveTab:
      if pickerState && !pickerState.isPopover && pickerState.slotIndex === safeTabIndex - 1:
        render SkillPickerGrid full-panel
      else if activeSkill && skillTreeData:
        render skill header strip + SkillTreeCanvas (with skillTreeInteraction handlers)
      else if !activeSkill:
        render empty state: "Select a skill" prompt (a simple centered div)
    ```
    The `SkillTreeCanvas` for skill tabs uses `skillTreeInteraction.handleNodeClick` (not the passive tree's `handleNodeClick`), and `slotAllocations` as `nodeAllocations`, and `skillTreeData` as `treeData`. Tooltip logic mirrors the passive tab pattern using `skillTreeInteraction.hoveredNodeId`, etc., and `classData.skillTrees[activeSkill.skillId]` to look up game node names for the tooltip.
  - [x] **Popover picker** — rendered unconditionally (not inside the center panel swap) when `pickerState?.isPopover === true`:
    ```tsx
    {pickerState?.isPopover && (
      <>
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 49 }}
          onClick={() => setPickerState(null)}
        />
        <div style={{
          position: 'fixed',
          top: pickerState.anchorRect.bottom + 4,
          left: pickerState.anchorRect.left,
          zIndex: 50,
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-bg-elevated)',
          borderRadius: 4,
          maxHeight: '60vh',
          overflowY: 'auto',
        }}>
          <SkillPickerGrid
            baseClassName={classData?.className ?? ''}
            skills={filteredSkills}
            selectedSkillId={activeSkills.find(s => s.slotId === `slot-${pickerState.slotIndex}`)?.skillId ?? null}
            onSelect={handleSkillSelect}
            onClose={() => setPickerState(null)}
          />
        </div>
      </>
    )}
    ```
  - [x] **Remove `SkillTreeStubPanel`** — the function and its usages are eliminated. It was a Phase 1 placeholder only.
  - [x] **Close picker when build changes** — add to the existing `useEffect` that resets `activeTabIndex` on `activeBuildId` change: also call `setPickerState(null)`.

- [x] Task 7: Unit tests (AC: #3, #4)
  - [x] **`src/features/skill-tree/treeDataTransformer.test.ts`** (already exists — add to it):
    - Test: `buildSkillTreeData` with 3 nodes and 2 edges returns correct `TreeNode[]` and `TreeEdge[]`
    - Test: `buildSkillTreeData` with empty nodes returns `{ nodes: [], edges: [] }`
    - Test: allocated nodes are reflected in `TreeNode.state` (allocated vs available)
  - [x] **`src/shared/stores/buildStore.test.ts`** (already exists — add to it):
    - Test: `assignSkillToSlot('slot-0', { skillId: 'smite', skillName: 'Smite' })` adds entry to `contextData.skills`
    - Test: re-assigning a different skill to the same slot clears `skillNodeAllocations[slotId]`
    - Test: `applySkillNodeChange` increments allocation in `skillNodeAllocations['slot-0']`
    - Test: `applySkillNodeChange` blocks allocation when prerequisite not met (same validation as `applyNodeChange`)
    - Test: `undoNodeChange` restores previous `skillNodeAllocations` (it restores full BuildState snapshot)
    - Mock `treeData` in tests using a minimal `TreeData` fixture (3 nodes, 2 edges) — same pattern as existing `applyNodeChange` tests

## Dev Notes

### Critical Architecture Patterns

**No barrel files**: `src/features/skill-picker/` already has no `index.ts` — maintain this for all feature folders. Import `SkillPickerGrid` directly from `src/features/skill-picker/SkillPickerGrid.tsx`.

**No new Zustand stores**: All new state (`skillNodeAllocations`, `assignSkillToSlot`, `applySkillNodeChange`) goes into the existing `useBuildStore`. No new store.

**SkillTreeCanvas is props-only**: Never access Zustand inside `SkillTreeCanvas` or `pixiRenderer.ts`. The `slotAllocations` record is computed outside and passed as the `nodeAllocations` prop.

**invokeCommand only**: No Tauri IPC calls are needed in this story (game data is already loaded). Do not add any new `invokeCommand` calls.

### Slot ID Convention

Slots are identified by `slotId: "slot-0"` through `"slot-4"` (zero-indexed, matching the active skill tab index offset by 1 from the tab bar). The passive tab is index 0 in the tab bar; skill slot 0 is tab index 1. Derive `slotId = \`slot-${safeTabIndex - 1}\`` when on a skill tab.

`contextData.skills` is a sparse array — it contains only entries for assigned slots. Look up by `slotId`:
```typescript
const activeSkill = activeSkills.find(s => s.slotId === slotId)
```

### applySkillNodeChange vs applyNodeChange

`applySkillNodeChange` in `buildStore.ts` is structurally identical to `applyNodeChange` except:
1. Reads/writes `activeBuild.skillNodeAllocations[slotId]` instead of `activeBuild.nodeAllocations`
2. Takes `slotId` as first parameter

Both push to the same `undoStack` (full `BuildState` snapshots). Ctrl+Z restores both passive and skill allocations correctly because the snapshot includes all state.

Do NOT share implementation between the two — copy the logic and adjust the property access. DRY refactoring is not worth the abstraction cost here.

### Two useSkillTree Hook Instances

`SkillTreeView.tsx` will call `useSkillTree` twice:
1. `const passiveInteraction = useSkillTree(treeData)` — existing call for passive tab
2. `const skillInteraction = useSkillTree(skillTreeData, slotId ?? undefined)` — new call for skill tabs

Both instances maintain independent state (hovered node, flash, etc.) for their respective trees. Only the active tab's interaction handlers are wired to the rendered canvas.

When `slotId === null` (passive tab), `slotId ?? undefined` evaluates to `undefined`, which triggers the `applyNodeChange` path in `useSkillTree`.

### Game Data JSON Format

The existing `transformTree(raw: { nodes: RawGameNode[]; edges: RawEdge[] })` function in `gameDataLoader.ts` handles the same format as `skillTree`. The `RawSkillEntry.skillTree` field uses exactly this format — no new transformer needed.

Skill node IDs must be globally unique across the entire class's skills and passive trees. Use descriptive prefixes: `sentinel-smite-core`, `sentinel-smite-holy-aura`, etc.

### Skill Filtering for Picker

Pass only skills visible for the player's current class+mastery to `SkillPickerGrid`. Base class skills (`masteryId === null`) always show. Mastery skills only show if `masteryId === selectedMasteryId`.

```typescript
const filteredSkills = classData?.skills.filter(
  s => s.masteryId === null || s.masteryId === selectedMasteryId
) ?? []
```

`SkillPickerGrid` (Story 1.3) is already responsible only for rendering what it receives — filtering belongs to the caller, `SkillTreeView.tsx`. This matches the existing AC #3 note in Story 1.3.

### Popover Positioning

The popover uses `position: fixed` with coordinates from `anchorRect.bottom` and `anchorRect.left` — both are viewport coordinates from `getBoundingClientRect()` captured at click time. This correctly positions the picker just below the clicked tab regardless of scroll position.

The backdrop div (transparent, `position: fixed; inset: 0; zIndex: 49`) catches clicks outside the popover and closes it. The popover itself is at `zIndex: 50`.

### Skill Header Strip (FR10)

The header strip shows:
- Skill name (primary text, 600 weight)
- "Level —" placeholder (muted) — Story 3.2 replaces this with an actual numeric input
- Unlock condition: if `masteryGatePoints != null`, show "Requires N mastery points"; else show "Available for {ClassName}"

The tab bar (existing) serves as the "other active skill slot indicators" per FR10 — it already shows all 5 skill tabs with skill names or empty labels.

### Empty Slot State

When a skill tab has no skill assigned and the picker is not open, render:
```tsx
<div className="flex flex-col items-center justify-center h-full gap-3">
  <p style={{ color: 'var(--color-text-muted)' }}>No skill selected</p>
  <button
    style={{ color: 'var(--color-accent-gold)', textDecoration: 'underline', background: 'none', border: 'none' }}
    onClick={() => { /* trigger picker open for this slot in full mode */ }}
  >
    Select a skill
  </button>
</div>
```
This "Select a skill" button calls `handleSkillTabClick(safeTabIndex - 1, buttonRef.current)` — or open picker state directly.

### Testing Approach

No Playwright or SkillTreeView integration tests — the component has PixiJS dependencies that require a real browser. Test the pure logic only:
- `buildSkillTreeData` is a pure function — unit test directly
- `buildStore` actions are pure — unit test with `useStore.getState()` / `setState()` pattern

Look at existing `buildStore.test.ts` for the test pattern (it already tests `applyNodeChange` with a minimal `TreeData` fixture). Add to that file rather than creating a new one.

`treeDataTransformer.test.ts` — check if it exists already. If so, add to it. If not, create it alongside `treeDataTransformer.ts`.

### Project Context Rules

- **No barrel files**: direct imports only — `src/features/skill-picker/SkillPickerGrid.tsx`, not `src/features/skill-picker`
- **invokeCommand only**: no raw `invoke()` from `@tauri-apps/api/core`
- **No new top-level Zustand stores**: all changes go into existing stores
- **TypeScript strict mode**: every new field on `BuildState` / `ActiveSkill` must be initialized in all code paths (`createBuild`, `clearActiveBuild`, and the auto-create path inside `applyNodeChange`)
- **Tailwind v4**: use CSS custom property tokens (`var(--color-*)`) and Tailwind utility classes; no `@apply`
- **NFR12**: any new interactive elements (the "Select a skill" button, popover backdrop) must have focus rings — the global `:focus-visible` rule handles this automatically
- **NFR16**: the popover open/close has no animation yet — skip `useReducedMotion` for this story (no transitions to gate)

### Previous Story Learnings (Story 1.3)

- `SkillPickerGrid` is fully props-driven — no internal store access. Pass `skills`, `selectedSkillId`, `baseClassName`, `onSelect`, `onClose` from `SkillTreeView.tsx`.
- The `invokeCommand` mock pattern in tests: `vi.mock('../../shared/utils/invokeCommand', ...)` — replicate for any new test files that need to render `SkillPickerGrid`.
- CSS tokens (`--hex-clip-path`, `--color-badge-mastery-gate`) are already in `global.css @theme` — do not re-add.
- `SkillEntry.masteryName` is resolved in `transformClass` from `masteries[masteryId].masteryName` — this is why skill transformation must happen AFTER mastery transformation in `transformClass`.

### References

- Story 1.3 (SkillPickerGrid) — props contract, icon loading pattern, CSS tokens [Source: `_bmad-output/implementation-artifacts/1-3-skill-picker-grid-component.md`]
- Architecture Decision 2: `nodeAllocations` type upgrade and `applyNodeChange` pattern [Source: `_bmad-output/planning-artifacts/architecture.md#Decision-2`]
- `ClassData` and `SkillEntry` types [Source: `src/shared/types/gameData.ts`]
- `RawClassData` + `transformClass` [Source: `src/features/game-data/gameDataLoader.ts`]
- `buildStore.applyNodeChange` — copy validation logic for `applySkillNodeChange` [Source: `src/shared/stores/buildStore.ts`]
- `useSkillTree` hook — extension point for `slotId` param [Source: `src/features/skill-tree/useSkillTree.ts`]
- `SkillTreeTabBar` — Tab click handler location [Source: `src/features/skill-tree/SkillTreeTabBar.tsx`]
- `SkillTreeView` — rendering pipeline to modify [Source: `src/features/skill-tree/SkillTreeView.tsx`]
- `buildTreeData` and `appendTreeNodes` — reuse for `buildSkillTreeData` [Source: `src/features/skill-tree/treeDataTransformer.ts`]
- Slot IDs (`"slot-0"` through `"slot-4"`), EMPTY_ALLOCATED constant pattern [Source: `src/features/skill-tree/SkillTreeView.tsx`]
- Mastery IDs: sentinel (`void_knight`, `forge_guard`, `paladin`), acolyte (`lich`, `necromancer`, `warlock`), mage (`sorcerer`, `spellblade`, `runemaster`), primalist (`shaman`, `druid`, `beastmaster`), rogue (`bladedancer`, `marksman`, `falconer`) [Source: `src-tauri/resources/game-data/classes/*.json`]
- No barrel files rule, no new stores, invokeCommand pattern [Source: `_bmad-output/project-context.md`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 7 tasks implemented. `pnpm build` (TypeScript) passes clean. Test suite: 6 pre-existing ProviderSelector/Settings failures unrelated to this story; all Story 1.4 tests pass.
- `buildPersistence.ts` required `skillNodeAllocations` migration in `migrateBuildState` — added alongside existing `nodeAllocations` migration pattern.
- `SkillInput.tsx` fallback object needed `skillId: ''` after `ActiveSkill` gained the required `skillId` field.
- ~15 test files needed mock fixture updates: added `skillNodeAllocations: {}` to `BuildState` mocks, `skillId` to `ActiveSkill` mocks, and `skills: [] / skillTrees: {}` to `ClassData` mocks.
- `SkillTreeStubPanel` removed from `SkillTreeView.tsx` (it was a Phase 1 placeholder).
- Two `useSkillTree` instances in `SkillTreeView.tsx` run independently: `passiveInteraction` and `skillInteraction` (with `slotId`).

### Review Findings

- [x] [Review][Decision] Slot ID mismatch — resolved: removed editable text-entry from `SkillInput`; picker is now canonical. `skillData.ts` slot IDs updated to `"slot-0"…"slot-4"`. `SkillInput` converted to read-only display.
- [x] [Review][Decision] AC3/AC5: Tab bar renders only assigned-skill tabs — resolved: `SkillTreeTabBar` now always renders 6 tabs (passive + 5 fixed skill slots); empty slots show dimmed fallback labels.
- [x] [Review][Patch] `applySkillNodeChange` missing `isPersisted: false` — fixed: added `isPersisted: false` to `newActiveBuild`. [buildStore.ts]
- [x] [Review][Patch] Passive tab click doesn't close open picker popover — fixed: `handleTabChange` wrapper calls `setPickerState(null)` on every tab switch; all `SkillTreeTabBar` instances use `onChange={handleTabChange}`. [SkillTreeView.tsx]
- [x] [Review][Defer] `applySkillNodeChange` not atomic (uses `get()`/`set()` TOCTOU) [buildStore.ts] — deferred, pre-existing pattern in `applyNodeChange`
- [x] [Review][Defer] Dependent-blocking guard only fires at `newPoints === 0`, misses partial removal [buildStore.ts] — deferred, same as pre-existing `applyNodeChange` behaviour
- [x] [Review][Defer] `buildPersistence.ts` bare-cast `skillNodeAllocations` without deep structural validation [buildPersistence.ts] — deferred, runtime safe (all reads guarded with `?? 0`), consistent with existing migration style
- [x] [Review][Defer] Inactive `useSkillTree` instance may surface stale hover/error state on tab return [SkillTreeView.tsx] — deferred, pre-existing single-instance limitation; hooks rules block conditional calls
- [x] [Review][Defer] Popover `position: fixed` rendered inline without React portal [SkillTreeView.tsx] — deferred, only breaks with CSS-transform ancestors (not present in current layout)
- [x] [Review][Defer] `assignSkillToSlot` writes `{}` to cleared slot instead of removing the key [buildStore.ts] — deferred, harmless for correctness
- [x] [Review][Defer] `transformSkillEntry` silently nulls `masteryName` for unknown `masteryId` [gameDataLoader.ts] — deferred, no downstream crash

### File List

**Production files changed:**
- `lebo/src-tauri/src/models/game_data.rs`
- `lebo/src-tauri/resources/game-data/classes/sentinel.json`
- `lebo/src-tauri/resources/game-data/classes/acolyte.json`
- `lebo/src-tauri/resources/game-data/classes/mage.json`
- `lebo/src-tauri/resources/game-data/classes/primalist.json`
- `lebo/src-tauri/resources/game-data/classes/rogue.json`
- `lebo/src/features/game-data/types.ts`
- `lebo/src/features/game-data/gameDataLoader.ts`
- `lebo/src/shared/types/gameData.ts`
- `lebo/src/shared/types/build.ts`
- `lebo/src/shared/stores/buildStore.ts`
- `lebo/src/features/skill-tree/treeDataTransformer.ts`
- `lebo/src/features/skill-tree/useSkillTree.ts`
- `lebo/src/features/skill-tree/SkillTreeTabBar.tsx`
- `lebo/src/features/skill-tree/SkillTreeView.tsx`
- `lebo/src/features/context-panel/SkillInput.tsx`
- `lebo/src/features/build-manager/buildPersistence.ts`

**Test files changed:**
- `lebo/src/features/skill-tree/treeDataTransformer.test.ts`
- `lebo/src/shared/stores/buildStore.test.ts`
- `lebo/src/features/game-data/gameDataLoader.test.ts`
- `lebo/src/features/context-panel/SkillInput.test.tsx`
- `lebo/src/features/context-panel/ContextPanel.test.tsx`
- `lebo/src/features/context-panel/GearInput.test.tsx`
- `lebo/src/features/context-panel/IdolInput.test.tsx`
- `lebo/src/features/build-manager/buildPersistence.test.ts`
- `lebo/src/features/build-manager/SavedBuildsList.test.tsx`
- `lebo/src/features/layout/RightPanel.test.tsx`
- `lebo/src/features/optimization/scoringEngine.test.ts`
- `lebo/src/features/optimization/SuggestionsList.test.tsx`
- `lebo/src/features/skill-tree/ClassMasterySelector.test.tsx`
- `lebo/src/features/skill-tree/SkillTreeTabBar.test.tsx`
- `lebo/src/shared/stores/gameDataStore.test.ts`
