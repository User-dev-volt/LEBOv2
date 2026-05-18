# Story 4.2: Active Skill & Idol Context Input

Status: done

## Story

As an advanced Last Epoch player,
I want to input my active skill selections and idol items so the AI has complete visibility into my full character state,
So that optimization suggestions reflect how my skill tree interacts with my actual skill loadout and idol bonuses.

## Acceptance Criteria

1. **Given** the user opens the "Active Skills" section of the Context Panel
   **When** the section expands
   **Then** 5 skill slots are shown, each labeled "Skill 1" through "Skill 5"
   **And** each unfilled slot shows a placeholder prompt (e.g., "Add skill…")
   **And** the section header shows a filled count indicator (e.g., "Active Skills — 0 / 5")

2. **Given** the user types a skill name in a skill slot
   **When** they edit the input field
   **Then** the name is stored in `activeBuild.contextData.skills` at the matching `slotId`
   **And** the `SkillTreeTabBar` reactively shows a new tab labeled with that skill name — no additional wiring needed (Story 1.6 already reads `contextData.skills`)

3. **Given** the user opens the "Idols" section of the Context Panel
   **When** the section expands
   **Then** 6 idol slots are shown, each labeled "Idol 1" through "Idol 6"
   **And** each unfilled slot shows a placeholder for both type (e.g., "Add idol type…") and modifiers
   **And** the section header shows a filled count indicator (e.g., "Idols — 0 / 6")

4. **Given** the user fills an idol slot
   **When** they enter an idol type name and one or more modifier strings
   **Then** the idol type is stored in `IdolItem.idolType`
   **And** each modifier is stored as a string entry in `IdolItem.modifiers[]`
   **And** the user can remove individual modifiers via a dismiss button (same pattern as gear affixes)

5. **Given** context data is filled and the user clicks "Optimize"
   **When** `invokeCommand('invoke_claude_api', ...)` is called
   **Then** all three context fields (`gear`, `skills`, `idols`) are included in `buildState.contextData` (FR18)
   **And** no backend changes are required — Rust already receives the full `BuildState`

6. **Given** a build with skill and idol context is saved and reloaded
   **When** the build loads
   **Then** all skill names and idol data (type + modifiers) are restored correctly
   **And** no persistence changes are required — `buildPersistence.ts` already serializes `BuildState`

7. **Given** no active build is loaded
   **When** the left panel renders
   **Then** the Context Panel (including Active Skills and Idols sections) is hidden — same guard as in 4.1

## Tasks / Subtasks

- [x] Task 1: Add `updateContextSkills` and `updateContextIdols` actions to `buildStore.ts`
  - [x] Add `updateContextSkills: (skills: ActiveSkill[]) => void` to `BuildStore` interface
  - [x] Add `updateContextIdols: (idols: IdolItem[]) => void` to `BuildStore` interface
  - [x] Implement both actions — same pattern as `updateContextGear`: spread `contextData`, replace the respective array, set `isPersisted: false`, update `updatedAt`
  - [x] Import `ActiveSkill` and `IdolItem` from `'../types/build'` in `buildStore.ts`

- [x] Task 2: Create `skillData.ts` — static skill slot definitions
  - [x] Create `lebo/src/features/context-panel/skillData.ts`
  - [x] Export `SKILL_SLOTS: readonly { slotId: string; label: string }[]` — 5 entries: `skill1`–`skill5`, labeled "Skill 1"–"Skill 5"

- [x] Task 3: Create `idolData.ts` — static idol slot definitions
  - [x] Create `lebo/src/features/context-panel/idolData.ts`
  - [x] Export `IDOL_SLOTS: readonly { slotId: string; label: string }[]` — 6 entries: `idol1`–`idol6`, labeled "Idol 1"–"Idol 6"

- [x] Task 4: Create `SkillInput.tsx`
  - [x] Create `lebo/src/features/context-panel/SkillInput.tsx`
  - [x] Renders all 5 slots from `SKILL_SLOTS`
  - [x] Each slot: one plain `<input type="text">` for skill name — no affix/modifier fields (skills are identified by name only for MVP)
  - [x] On change: calls `useBuildStore.getState().updateContextSkills(updatedSkills)` — `getState()` pattern (same as `GearInput`)
  - [x] `updatedSkills` is built by mapping over `SKILL_SLOTS` with the same helper pattern as `GearInput.handleNameChange`
  - [x] Each slot root: `data-testid={`skill-slot-${slotId}`}`
  - [x] Skill name input: `data-testid={`skill-name-${slotId}`}`

- [x] Task 5: Create `IdolInput.tsx`
  - [x] Create `lebo/src/features/context-panel/IdolInput.tsx`
  - [x] Renders all 6 slots from `IDOL_SLOTS`
  - [x] Each slot has two areas:
    - Idol type: plain `<input type="text">` with placeholder "Add idol type…" — stored in `IdolItem.idolType`
    - Modifiers: same add/dismiss tag pattern as `GearInput.tsx` affixes — stored in `IdolItem.modifiers[]`
  - [x] Local state for pending modifier inputs: `useState<Record<string, string>>({})` keyed by slotId
  - [x] `useEffect` clears `pendingModifiers` when `activeBuildId` changes (same fix applied to `GearInput` in 4.1 review)
  - [x] On any change: calls `useBuildStore.getState().updateContextIdols(updatedIdols)` via `getState()`
  - [x] Each slot root: `data-testid={`idol-slot-${slotId}`}`
  - [x] Idol type input: `data-testid={`idol-type-${slotId}`}`
  - [x] Modifier add input: `data-testid={`idol-modifier-input-${slotId}`}`
  - [x] Modifier add button: `data-testid={`idol-modifier-add-${slotId}`}`
  - [x] Each modifier tag: `data-testid={`idol-modifier-tag-${slotId}-${index}`}`

- [x] Task 6: Update `ContextPanel.tsx`
  - [x] Import `SkillInput` from `'./SkillInput'`
  - [x] Import `IdolInput` from `'./IdolInput'`
  - [x] Import `SKILL_SLOTS` from `'./skillData'`
  - [x] Import `IDOL_SLOTS` from `'./idolData'`
  - [x] Add `skills` and `idols` subscriptions from `useBuildStore` (same selector pattern as `gear`)
  - [x] Compute `filledSkillCount = skills.filter(s => s.skillName.trim() !== '').length`
  - [x] Compute `filledIdolCount = idols.filter(i => i.idolType.trim() !== '').length`
  - [x] Update "Active Skills" `DisclosureButton` to show count: `<span>Active Skills</span><span>{filledSkillCount} / {SKILL_SLOTS.length}</span>`
  - [x] Update "Idols" `DisclosureButton` to show count: `<span>Idols</span><span>{filledIdolCount} / {IDOL_SLOTS.length}</span>`
  - [x] Replace the "Coming soon" `<p>` inside `context-section-skills` `DisclosurePanel` with `<SkillInput />`
  - [x] Replace the "Coming soon" `<p>` inside `context-section-idols` `DisclosurePanel` with `<IdolInput />`

- [x] Task 7: Tests
  - [x] `buildStore.test.ts` — 6 new tests (3 for updateContextSkills, 3 for updateContextIdols)
  - [x] `SkillInput.test.tsx` — 5 new tests: renders 5 slots, name updates store, pre-populated data preserved, build switch clears input, empty name stores empty string
  - [x] `IdolInput.test.tsx` — 5 new tests: renders 6 slots, type updates store, modifier add appends, modifier dismiss removes, build switch clears pending modifier
  - [x] `ContextPanel.test.tsx` — replaced "Coming soon" test with 2 new count indicator tests (0/5 skills, 0/6 idols)
  - [x] `pnpm tsc --noEmit` — clean
  - [x] `pnpm vitest run` — 352 tests, all passing

## Dev Notes

### Why Free-Text (not searchable dropdowns)

The epics spec says active skill names should "auto-fill from the current class's available active skills (from `useGameDataStore.gameData`)". **This is blocked:** `GameData` has no active skill list — it contains only passive tree and mastery node data. Similarly, idol types and modifiers have no game data entry.

**MVP resolution:** Free-text input. The user types skill and idol names directly. Claude can interpret natural-language skill names just as well as structured data for suggestion quality. A future story can add structured skill/idol search once those data pipelines are built.

**Do NOT:** add a Combobox or searchable dropdown in this story. That requires a skill/idol data pipeline that doesn't exist.

---

### `ActiveSkill` type (already defined in `build.ts:7–10`)

```typescript
export interface ActiveSkill {
  slotId: string
  skillName: string
}
```

`SkillInput` only needs a single text field per slot — no affix/modifier pattern needed.

---

### `IdolItem` type (already defined in `build.ts:12–16`)

```typescript
export interface IdolItem {
  slotId: string
  idolType: string    // free-text: e.g. "Ornate Idol of the Leech"
  modifiers: string[] // free-text: e.g. "+50% Poison Damage"
}
```

`IdolInput` mirrors `GearInput` almost exactly — idol type replaces item name, modifiers replaces affixes.

---

### `buildStore.ts` — New Actions

```typescript
// Add to BuildStore interface:
updateContextSkills: (skills: ActiveSkill[]) => void
updateContextIdols: (idols: IdolItem[]) => void

// Add to create() body (both follow the same pattern as updateContextGear):
updateContextSkills: (skills) =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            contextData: { ...s.activeBuild.contextData, skills },
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),

updateContextIdols: (idols) =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            contextData: { ...s.activeBuild.contextData, idols },
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),
```

Imports: add `ActiveSkill` and `IdolItem` to the import from `'../types/build'`.

---

### `skillData.ts`

```typescript
export const SKILL_SLOTS = [
  { slotId: 'skill1', label: 'Skill 1' },
  { slotId: 'skill2', label: 'Skill 2' },
  { slotId: 'skill3', label: 'Skill 3' },
  { slotId: 'skill4', label: 'Skill 4' },
  { slotId: 'skill5', label: 'Skill 5' },
] as const
```

---

### `idolData.ts`

```typescript
export const IDOL_SLOTS = [
  { slotId: 'idol1', label: 'Idol 1' },
  { slotId: 'idol2', label: 'Idol 2' },
  { slotId: 'idol3', label: 'Idol 3' },
  { slotId: 'idol4', label: 'Idol 4' },
  { slotId: 'idol5', label: 'Idol 5' },
  { slotId: 'idol6', label: 'Idol 6' },
] as const
```

---

### `SkillInput.tsx` — Structure

Simple: one text input per slot. No modifier/affix pattern needed.

```tsx
import { useBuildStore } from '../../shared/stores/buildStore'
import type { ActiveSkill } from '../../shared/types/build'
import { SKILL_SLOTS } from './skillData'

export function SkillInput() {
  const skills = useBuildStore((s) => s.activeBuild?.contextData.skills ?? [])

  function getSlot(slotId: string): ActiveSkill {
    return skills.find((s) => s.slotId === slotId) ?? { slotId, skillName: '' }
  }

  function handleNameChange(slotId: string, skillName: string) {
    const updated = SKILL_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...getSlot(id), skillName } : getSlot(id)
    )
    useBuildStore.getState().updateContextSkills(updated)
  }

  return (
    <div className="flex flex-col gap-3 px-1 pt-1">
      {SKILL_SLOTS.map(({ slotId, label }) => {
        const slot = getSlot(slotId)
        return (
          <div key={slotId} data-testid={`skill-slot-${slotId}`} className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </span>
            <input
              type="text"
              data-testid={`skill-name-${slotId}`}
              placeholder="Add skill…"
              value={slot.skillName}
              onChange={(e) => handleNameChange(slotId, e.target.value)}
              className="w-full text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-elevated)',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
```

---

### `IdolInput.tsx` — Structure

Mirrors `GearInput.tsx` exactly: `idolType` = item name, `modifiers` = affixes.

Key difference: use `activeBuildId` + `useEffect` to clear `pendingModifiers` on build switch (the fix from 4.1 review must also apply here).

```tsx
import { useEffect, useState } from 'react'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { IdolItem } from '../../shared/types/build'
import { IDOL_SLOTS } from './idolData'

export function IdolInput() {
  const idols = useBuildStore((s) => s.activeBuild?.contextData.idols ?? [])
  const activeBuildId = useBuildStore((s) => s.activeBuild?.id ?? null)
  const [pendingModifiers, setPendingModifiers] = useState<Record<string, string>>({})

  useEffect(() => {
    setPendingModifiers({})
  }, [activeBuildId])

  function getSlot(slotId: string): IdolItem {
    return idols.find((i) => i.slotId === slotId) ?? { slotId, idolType: '', modifiers: [] }
  }

  function handleTypeChange(slotId: string, idolType: string) {
    const updated = IDOL_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...getSlot(id), idolType } : getSlot(id)
    )
    useBuildStore.getState().updateContextIdols(updated)
  }

  function handleAddModifier(slotId: string) {
    const modifier = (pendingModifiers[slotId] ?? '').trim()
    if (!modifier) return
    const slot = getSlot(slotId)
    const updated = IDOL_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...slot, modifiers: [...slot.modifiers, modifier] } : getSlot(id)
    )
    useBuildStore.getState().updateContextIdols(updated)
    setPendingModifiers((prev) => ({ ...prev, [slotId]: '' }))
  }

  function handleRemoveModifier(slotId: string, index: number) {
    const slot = getSlot(slotId)
    const updated = IDOL_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...slot, modifiers: slot.modifiers.filter((_, i) => i !== index) } : getSlot(id)
    )
    useBuildStore.getState().updateContextIdols(updated)
  }

  // render: mirrors GearInput layout — idol type input + modifier add/dismiss tags
}
```

---

### `ContextPanel.tsx` — Updates

Three changes:
1. Subscribe to `skills` and `idols` from the store
2. Compute `filledSkillCount` and `filledIdolCount`
3. Update button text + replace "Coming soon" with real components

The `DisclosureButton` for "Active Skills" should use the same `flex justify-between` layout already on the Gear button so the count badge aligns right.

---

### `ContextPanel.test.tsx` — Test Changes

Two existing tests must be updated because "Coming soon" no longer appears:

**Before (must change):**
```tsx
it('Active Skills and Idols sections show Coming soon placeholder when opened', async () => {
  // ...
  const allComingSoon = screen.getAllByText('Coming soon')
  expect(allComingSoon).toHaveLength(2)
})
```

**After (replace with):**
```tsx
it('shows skill count indicator as 0 / 5 when no skills filled', () => {
  useBuildStore.getState().setActiveBuild(mockBuild)
  render(<ContextPanel />)
  expect(screen.getByText('0 / 5')).toBeInTheDocument()
})

it('shows idol count indicator as 0 / 6 when no idols filled', () => {
  useBuildStore.getState().setActiveBuild(mockBuild)
  render(<ContextPanel />)
  expect(screen.getByText('0 / 6')).toBeInTheDocument()
})
```

The "SkillInput renders inside Active Skills section" and "IdolInput renders inside Idols section" are tested via the input component's own test files — no additional integration test needed at the ContextPanel level for MVP.

---

### `SkillTreeTabBar` Integration — Free (No Extra Work)

`SkillTreeView.tsx:52–54` already does:
```tsx
const activeSkills = useBuildStore(
  (s) => s.activeBuild?.contextData.skills ?? EMPTY_SKILLS
)
```

When `SkillInput` writes a skill name to `contextData.skills`, the tab bar updates reactively. This is completely wired from Story 1.6 — no changes to `SkillTreeView` or `SkillTreeTabBar` needed.

---

### What's Already Done — DO NOT Reinvent

| What | Status | Where |
|------|--------|-------|
| `ActiveSkill`, `IdolItem` types | ✅ Done | `shared/types/build.ts:7–16` |
| `BuildState.contextData: { gear, skills, idols }` | ✅ Done | `shared/types/build.ts:24–28` |
| `contextData` in Claude API payload | ✅ Done | Rust receives full `BuildState` |
| `contextData` saved/loaded | ✅ Done | `buildPersistence.ts` serializes full `BuildState` |
| `ContextPanel.tsx` shell with 3 Disclosure sections | ✅ Done | Story 4.1 |
| `GearInput.tsx` (reference pattern) | ✅ Done | Story 4.1 |
| `SkillTreeView` reads `contextData.skills` for tabs | ✅ Done | Story 1.6 |
| `updateContextGear` pattern in buildStore | ✅ Done | Story 4.1 |
| `updateContextSkills` | ❌ Missing — Task 1 adds this | `buildStore.ts` |
| `updateContextIdols` | ❌ Missing — Task 1 adds this | `buildStore.ts` |
| `SkillInput.tsx` | ❌ Missing — Task 4 adds this | `src/features/context-panel/` |
| `IdolInput.tsx` | ❌ Missing — Task 5 adds this | `src/features/context-panel/` |

---

### Patterns from Previous Stories

- No barrel `index.ts` files — import directly from file paths
- Tailwind v4 CSS-first: `className` for layout/spacing, `style={{ color: 'var(--color-...)' }}` for design tokens
- Test files co-located with source
- Mock Zustand stores in tests: `useBuildStore.setState(overrides, true)` to reset between tests
- Mock `@tauri-apps/api/event` in any file that imports hooks calling `listen`
- `ResizeObserver` polyfill is in `test-setup.ts` — required for Headless UI components
- `getState()` pattern in event handlers (not hook)
- `useEffect(() => { setPending({}) }, [activeBuildId])` to clear draft state on build switch
- `key={\`${value}-${index}\`}` for list items with dismiss buttons

---

### File Locations

**New files:**
- `lebo/src/features/context-panel/skillData.ts`
- `lebo/src/features/context-panel/idolData.ts`
- `lebo/src/features/context-panel/SkillInput.tsx`
- `lebo/src/features/context-panel/SkillInput.test.tsx`
- `lebo/src/features/context-panel/IdolInput.tsx`
- `lebo/src/features/context-panel/IdolInput.test.tsx`

**Modified files:**
- `lebo/src/shared/stores/buildStore.ts` — add `updateContextSkills` and `updateContextIdols`
- `lebo/src/shared/stores/buildStore.test.ts` — 4 new tests
- `lebo/src/features/context-panel/ContextPanel.tsx` — wire SkillInput + IdolInput, add count indicators
- `lebo/src/features/context-panel/ContextPanel.test.tsx` — update 1 test, add 2 new

---

### Regression Warnings

- `buildStore` gains two new actions — all existing buildStore tests pass (additive change).
- `ContextPanel.tsx` gains two new subscriptions + replaces "Coming soon" with real components — the existing `ContextPanel.test.tsx` test for "Coming soon" MUST be replaced (it will fail after this story). See task 7 for the exact replacement.
- `SkillTreeView` and `SkillTreeTabBar` are NOT modified — tab integration is already wired and reactive.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Free-text MVP resolution applied to both Active Skills and Idols: `GameData` has no skill/idol schema, same constraint as Story 4.1's gear gap. User types names/types directly; Claude interprets natural language equally well.
- `updateContextSkills` and `updateContextIdols` added to `buildStore.ts` — both follow exact same pattern as `updateContextGear` (spread contextData, set `isPersisted: false`, update `updatedAt`).
- `SkillInput.tsx` is deliberately simpler than `GearInput.tsx` — `ActiveSkill` has only `skillName`, no modifier/affix array. One input per slot.
- `IdolInput.tsx` mirrors `GearInput.tsx` exactly: `idolType` ↔ `itemName`, `modifiers` ↔ `affixes`. Both the `useEffect` build-switch clear and composite key pattern from the 4.1 review are applied.
- `SkillTreeTabBar` integration is free — `SkillTreeView.tsx:52–54` already subscribes to `contextData.skills`. Typing a skill name in `SkillInput` immediately causes a new tab to appear in the tree canvas.
- `ContextPanel.tsx` now subscribes to all three context arrays and shows filled/total counts on every section header.
- `ContextPanel.test.tsx` `userEvent` import removed (no longer needed after replacing Coming Soon test); raw store updates in tests wrapped in `act()` to flush React re-renders.
- 352 tests pass; `pnpm tsc --noEmit` clean.

### File List

- `lebo/src/features/context-panel/skillData.ts` (new)
- `lebo/src/features/context-panel/idolData.ts` (new)
- `lebo/src/features/context-panel/SkillInput.tsx` (new)
- `lebo/src/features/context-panel/SkillInput.test.tsx` (new)
- `lebo/src/features/context-panel/IdolInput.tsx` (new)
- `lebo/src/features/context-panel/IdolInput.test.tsx` (new)
- `lebo/src/shared/stores/buildStore.ts` (modified)
- `lebo/src/shared/stores/buildStore.test.ts` (modified)
- `lebo/src/features/context-panel/ContextPanel.tsx` (modified)
- `lebo/src/features/context-panel/ContextPanel.test.tsx` (modified)

### Change Log

- 2026-04-25: Implemented Story 4.2 — Active Skill & Idol Context Input. Added `updateContextSkills` and `updateContextIdols` store actions, created `SkillInput` + `IdolInput` components, wired into `ContextPanel` replacing Coming Soon placeholders. All three context sections now have live count indicators. SkillTreeTabBar integration reactive with no extra wiring.
