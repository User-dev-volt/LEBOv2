---
title: 'Skill Role Designation'
story_id: '5.1'
story_key: '5-1-skill-role-designation'
epic: 5
status: done
created: '2026-05-24'
---

## Story

**As a player,**
I want to designate which of my active skills is my Primary Offense (required) and optionally tag others as Secondary Offense, Defensive, or Utility — with those designations saved with the build,
**so that** the gear scoring engine (story 5.2+) knows which damage type and delivery type to optimize affix recommendations around.

---

## Context

This is Story 5.1 — the first story in Epic 5 (Gear Optimization Screen). It is a **Quick Dev candidate**: pure React UI with no Rust work. All implementation lives in TypeScript/TSX.

**What exists today (from Epics 1–4):**
- `BuildState` in `shared/types/build.ts` has `contextData.skills: ActiveSkill[]` — each `ActiveSkill` is `{ slotId, skillName, skillId }`. Five skill slots are defined in `features/context-panel/skillData.ts` as `SKILL_SLOTS = [slot-0 … slot-4]`.
- `buildStore.assignSkillToSlot(slotId, skill)` handles skill assignment. It detects when the skill actually changed (`skillChanged = existingSkill?.skillId !== skill.skillId`) and resets `skillNodeAllocations` for that slot.
- `appStore.currentView: 'main' | 'settings'` drives top-level navigation. Settings uses always-mounted `display: none/block` pattern, matching what this story will add for `'gear-optimization'`.
- `AppHeader` has a "Settings" button that sets `currentView = 'settings'`. This story adds an equivalent "Gear Optimization" button.
- No `features/gear-optimization/` folder exists yet — this story creates it.

**What this story adds:**

1. `SkillRole` type + `skillRoles` optional field on `BuildState`
2. `setSkillRole` / `clearSkillRole` actions on `buildStore`; `assignSkillToSlot` extended to auto-clear role when skill changes
3. `appStore.currentView` extended to include `'gear-optimization'`; `App.tsx` mounts `GearOptimizationView` under always-on `display: none/block`
4. "Gear Optimization" button in `AppHeader` (mirrors "Settings" button pattern)
5. New `features/gear-optimization/SkillRoleDesignator.tsx` — shows all 5 skill slots with role buttons
6. New `features/gear-optimization/GearOptimizationView.tsx` — shell screen: prompt when no roles set, `SkillRoleDesignator` at top, "Analyze Gear" button blocked if no Primary Offense
7. Tests for `buildStore` role actions, `SkillRoleDesignator` rendering and interactions, and `GearOptimizationView` prompt/block behavior

**What this story does NOT do:**
- Add any Rust code or Tauri commands — zero Rust changes
- Wire `skillRoles` into `BuildSnapshot` — that happens in Story 5.3 when the Rust command needs it
- Implement actual gear analysis — `GearOptimizationView` in this story is a shell; analysis logic is in stories 5.2–5.5
- Change the passive tree optimization flow or `optimizationStore` in any way
- Add `schemaVersion: 3` — `skillRoles` is optional and defaults to `{}` on existing builds, no migration needed

---

## Acceptance Criteria

**AC1 — No-role prompt and designation UI:**
**Given** the Gear Optimization screen opened for the first time (no roles set)
**When** the player views the screen
**Then** a prompt explains that at least one skill must be designated Primary Offense before analysis can run
**And** a role designation UI shows all active skill slots with role buttons or dropdowns

**AC2 — Roles persist across build save/load:**
**Given** skill roles are designated and the build is saved
**When** the build is reloaded
**Then** the skill role designations are restored exactly as saved
**And** roles do not affect the passive tree optimization flow or the main optimization view

**AC3 — Role cleared when skill in slot changes:**
**Given** a player changes the skill assigned to a slot that had a role
**When** the skill changes
**Then** the role designation for that slot is cleared
**And** the Gear Optimization screen's role display reflects the cleared state

**AC4 — "Analyze Gear" blocked without Primary Offense:**
**Given** only a Secondary Offense role is designated with no Primary Offense
**When** the player clicks "Analyze Gear"
**Then** the analysis is blocked with an error: "Please designate at least one skill as Primary Offense before running gear analysis"

---

## Tasks / Subtasks

- [x] Task 1: Type and store changes (AC2, AC3)
  - [x] Add `SkillRole` type to `shared/types/build.ts`
  - [x] Add `skillRoles?: Record<string, SkillRole>` field to `BuildState`
  - [x] Add `setSkillRole` and `clearSkillRole` to `BuildStore` interface
  - [x] Implement `setSkillRole` and `clearSkillRole` in `buildStore.ts` (same immutable update pattern as `setBlessing`)
  - [x] Extend `assignSkillToSlot` to call `clearSkillRole` when `skillChanged` is true
  - [x] Add `skillRoles: {}` to `createBuild` initial state
  - [x] `pnpm build` passes, zero TypeScript errors

- [x] Task 2: View and navigation (AC1)
  - [x] Extend `appStore.currentView` union type to `'main' | 'settings' | 'gear-optimization'`
  - [x] Add "Gear Optimization" button to `AppHeader` (mirrors "Settings" button; hidden when `currentView === 'gear-optimization'` or `currentView === 'settings'`; shown when `activeBuild` is non-null)
  - [x] Add `GearOptimizationView` mount in `App.tsx` using `display: none/block` pattern (always mounted, never unmounted)
  - [x] `pnpm build` passes

- [x] Task 3: `SkillRoleDesignator.tsx` component (AC1, AC2, AC3, AC4)
  - [x] Create `src/features/gear-optimization/SkillRoleDesignator.tsx`
  - [x] Shows each of the 5 skill slots from `SKILL_SLOTS` with the assigned skill name (or "Empty" if unassigned)
  - [x] Each non-empty slot has 4 role toggle buttons: Primary Offense, Secondary Offense, Defensive, Utility
  - [x] Active role button is visually selected (accent-gold outline or fill); clicking it again clears the role (toggles off)
  - [x] Empty slots show the role buttons as disabled
  - [x] Reads from `buildStore` via `useBuildStore`; calls `setSkillRole` / `clearSkillRole`

- [x] Task 4: `GearOptimizationView.tsx` shell (AC1, AC4)
  - [x] Create `src/features/gear-optimization/GearOptimizationView.tsx`
  - [x] Shows `SkillRoleDesignator` at the top always
  - [x] When no roles are set at all: shows prompt text "Designate at least one skill as Primary Offense before running gear analysis"
  - [x] "Analyze Gear" button present always; when clicked with no Primary Offense role set, shows inline error message "Please designate at least one skill as Primary Offense before running gear analysis"
  - [x] When Primary Offense IS set: "Analyze Gear" button click shows a "Not yet implemented" placeholder (story 5.3 wires the real command)
  - [x] Back button or header "← Back" link sets `currentView` to `'main'`
  - [x] `pnpm build` passes

- [x] Task 5: Tests (AC1, AC2, AC3, AC4)
  - [x] `buildStore.test.ts` — 3 new tests:
    - (a) `setSkillRole` persists role for a slot
    - (b) `clearSkillRole` removes role for a slot
    - (c) `assignSkillToSlot` clears role when skill changes (not when same skill re-assigned)
  - [x] `SkillRoleDesignator.test.tsx` — 4 new tests (6 total including null-build and hides-prompt cases):
    - (a) renders all 5 SKILL_SLOTS
    - (b) shows skill name for assigned skills, "Empty" for unassigned
    - (c) clicking a role button calls `setSkillRole` with the correct slotId and role
    - (d) clicking the active role button calls `clearSkillRole`
  - [x] `GearOptimizationView.test.tsx` — 3 new tests (5 total including hides-prompt and back-button cases):
    - (a) shows prompt text when no roles are set
    - (b) clicking "Analyze Gear" with no Primary Offense shows the error message
    - (c) clicking "Analyze Gear" with Primary Offense set does NOT show the error message
  - [x] `pnpm build` passes, zero TypeScript errors
  - [x] `pnpm vitest` — all new tests pass, full suite still green (918 passed / 8 pre-existing failures unchanged)

---

## Technical Requirements

### 1. Type changes — `shared/types/build.ts`

Add before the `BuildState` interface:
```typescript
export type SkillRole = 'primary_offense' | 'secondary_offense' | 'defensive' | 'utility'
```

Add to `BuildState`:
```typescript
skillRoles?: Record<string, SkillRole>  // keyed by slotId; absent = no role assigned
```

No `schemaVersion` bump — `skillRoles` is optional and defaults to `{}` for existing saved builds.

### 2. Store changes — `buildStore.ts`

**Add to `BuildStore` interface:**
```typescript
setSkillRole: (slotId: string, role: SkillRole) => void
clearSkillRole: (slotId: string) => void
```

**Add to `buildStore` implementation** (same pattern as `setBlessing`):
```typescript
setSkillRole: (slotId, role) =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            skillRoles: { ...(s.activeBuild.skillRoles ?? {}), [slotId]: role },
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),

clearSkillRole: (slotId) =>
  set((s) => {
    if (!s.activeBuild) return {}
    const { [slotId]: _removed, ...rest } = s.activeBuild.skillRoles ?? {}
    return {
      activeBuild: {
        ...s.activeBuild,
        skillRoles: rest,
        isPersisted: false,
        updatedAt: new Date().toISOString(),
      },
    }
  }),
```

**Extend `assignSkillToSlot`** — add role clearing when skill changes. In the existing `assignSkillToSlot` body, after computing `skillChanged`:
```typescript
// Existing:
const skillChanged = existingSkill?.skillId !== skill.skillId
// ... existing updatedSkills logic ...

// Add role clearing when skill changes:
const updatedSkillRoles = skillChanged
  ? (() => {
      const { [slotId]: _removed, ...rest } = s.activeBuild!.skillRoles ?? {}
      return rest
    })()
  : (s.activeBuild!.skillRoles ?? {})

return {
  activeBuild: {
    ...s.activeBuild,
    contextData: { ...s.activeBuild!.contextData, skills: updatedSkills },
    skillNodeAllocations: updatedSkillNodeAllocations,
    skillRoles: updatedSkillRoles,  // ADD THIS
    isPersisted: false,
    updatedAt: new Date().toISOString(),
  },
}
```

**Add to `createBuild` initial state:**
```typescript
skillRoles: {},
```

**Import `SkillRole`** at the top of `buildStore.ts`:
```typescript
import type { BuildState, BuildMeta, ApplyNodeResult, GearItemV2, ActiveSkill, IdolItem, PlacedIdol, SkillRole } from '../types/build'
```

### 3. App store changes — `appStore.ts`

**Extend `currentView` type:**
```typescript
currentView: 'main' | 'settings' | 'gear-optimization'
```

Update `setCurrentView` action signature:
```typescript
setCurrentView: (view: 'main' | 'settings' | 'gear-optimization') => void
```

No other changes to `appStore.ts` — the setter implementation stays the same.

### 4. `AppHeader.tsx` changes

Add a "Gear Optimization" button alongside the "Settings" button. Show it only when `activeBuild` is non-null and `currentView === 'main'`:
```tsx
const activeBuild = useBuildStore((s) => s.activeBuild)

// In the header JSX, before the existing settings button:
{currentView === 'main' && activeBuild && (
  <button
    onClick={() => setCurrentView('gear-optimization')}
    data-testid="gear-optimization-button"
    className="ml-auto text-xs px-3 py-1 rounded"
    style={{
      backgroundColor: 'var(--color-bg-hover)',
      color: 'var(--color-text-secondary)',
    }}
  >
    Gear Optimization
  </button>
)}
{currentView !== 'settings' && (
  <button
    onClick={() => setCurrentView('settings')}
    data-testid="settings-button"
    className={`${currentView === 'main' && activeBuild ? 'ml-2' : 'ml-auto'} text-xs px-3 py-1 rounded`}
    style={{
      backgroundColor: 'var(--color-bg-hover)',
      color: 'var(--color-text-secondary)',
    }}
  >
    Settings
  </button>
)}
```

Note: `useBuildStore` import is not currently in `AppHeader.tsx` — add it.

### 5. `App.tsx` changes

Add `GearOptimizationView` import and mount alongside Settings:
```tsx
import { GearOptimizationView } from './features/gear-optimization/GearOptimizationView'

// In JSX, add after the Settings div:
<div style={{ display: currentView === 'gear-optimization' ? 'block' : 'none' }}>
  <GearOptimizationView />
</div>
```

The main `div` already uses `display: currentView === 'main' ? 'flex' : 'none'` — the gear optimization view is a third sibling alongside Settings and Main. `height: 100dvh` should be applied to `GearOptimizationView`'s root element for consistent sizing.

### 6. `src/features/gear-optimization/SkillRoleDesignator.tsx`

```tsx
import { useBuildStore } from '../../shared/stores/buildStore'
import { SKILL_SLOTS } from '../context-panel/skillData'
import type { SkillRole } from '../../shared/types/build'

const ROLES: { role: SkillRole; label: string }[] = [
  { role: 'primary_offense', label: 'Primary' },
  { role: 'secondary_offense', label: 'Secondary' },
  { role: 'defensive', label: 'Defensive' },
  { role: 'utility', label: 'Utility' },
]

export function SkillRoleDesignator() {
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const setSkillRole = useBuildStore((s) => s.setSkillRole)
  const clearSkillRole = useBuildStore((s) => s.clearSkillRole)

  if (!activeBuild) return null

  const { skills, skillRoles = {} } = activeBuild.contextData ? 
    { skills: activeBuild.contextData.skills, skillRoles: activeBuild.skillRoles ?? {} } :
    { skills: [], skillRoles: {} }
  // Simpler:
  const assignedSkills = activeBuild.contextData.skills
  const skillRoles = activeBuild.skillRoles ?? {}

  return (
    <div data-testid="skill-role-designator" className="flex flex-col gap-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        Skill Roles
      </p>
      {SKILL_SLOTS.map(({ slotId, label }) => {
        const assignedSkill = assignedSkills.find((s) => s.slotId === slotId)
        const isEmpty = !assignedSkill
        const currentRole = skillRoles[slotId] ?? null

        return (
          <div key={slotId} className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: isEmpty ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
              {label}: {assignedSkill?.skillName ?? 'Empty'}
            </span>
            <div className="flex gap-1 flex-wrap">
              {ROLES.map(({ role, label: roleLabel }) => {
                const isActive = currentRole === role
                return (
                  <button
                    key={role}
                    data-testid={`role-button-${slotId}-${role}`}
                    disabled={isEmpty}
                    onClick={() => {
                      if (isActive) {
                        clearSkillRole(slotId)
                      } else {
                        setSkillRole(slotId, role)
                      }
                    }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: isActive ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)',
                      color: isActive ? 'var(--color-bg-base)' : 'var(--color-text-secondary)',
                      opacity: isEmpty ? 0.4 : 1,
                      cursor: isEmpty ? 'not-allowed' : 'pointer',
                      outline: isActive ? '2px solid var(--color-accent-gold)' : 'none',
                    }}
                    aria-pressed={isActive}
                    aria-label={`${roleLabel} role for ${assignedSkill?.skillName ?? label}`}
                  >
                    {roleLabel}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Note:** The component above has a duplicate variable issue in the draft — clean it up when implementing. The `skillRoles` local variable from `activeBuild.skillRoles ?? {}` is what you need; the intermediate destructuring attempt should be removed. The clean implementation reads:
```typescript
const assignedSkills = activeBuild.contextData.skills
const skillRoles = activeBuild.skillRoles ?? {}
```

### 7. `src/features/gear-optimization/GearOptimizationView.tsx`

```tsx
import { useState } from 'react'
import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { SkillRoleDesignator } from './SkillRoleDesignator'

export function GearOptimizationView() {
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const skillRoles = activeBuild?.skillRoles ?? {}
  const hasPrimaryOffense = Object.values(skillRoles).includes('primary_offense')
  const hasAnyRole = Object.keys(skillRoles).length > 0

  function handleAnalyzeGear() {
    if (!hasPrimaryOffense) {
      setAnalyzeError('Please designate at least one skill as Primary Offense before running gear analysis')
      return
    }
    setAnalyzeError(null)
    // Story 5.3 will call invokeCommand('run_gear_scoring', { snapshot }) here
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Header */}
      <header
        className="h-10 flex items-center px-4 border-b shrink-0"
        style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-bg-hover)' }}
      >
        <button
          onClick={() => setCurrentView('main')}
          data-testid="gear-optimization-back-button"
          className="text-xs px-2 py-1 rounded"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Back to main view"
        >
          ← Back
        </button>
        <span className="ml-3 font-semibold text-sm" style={{ color: 'var(--color-accent-gold)' }}>
          Gear Optimization
        </span>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Role designation — always at top */}
        <SkillRoleDesignator />

        {/* Prompt when no roles are set */}
        {!hasAnyRole && (
          <p
            data-testid="gear-optimization-no-roles-prompt"
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Designate at least one skill as Primary Offense before running gear analysis.
          </p>
        )}

        {/* Analyze button */}
        <div className="flex flex-col gap-2">
          <button
            data-testid="analyze-gear-button"
            onClick={handleAnalyzeGear}
            className="text-sm px-4 py-2 rounded font-medium"
            style={{
              backgroundColor: 'var(--color-accent-gold)',
              color: 'var(--color-bg-base)',
            }}
          >
            Analyze Gear
          </button>
          {analyzeError && (
            <p
              data-testid="analyze-gear-error"
              className="text-xs"
              style={{ color: 'var(--color-data-negative)' }}
            >
              {analyzeError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Important:** Clear `analyzeError` when the user sets a new role. Add an effect or call `setAnalyzeError(null)` inside the role buttons — cleanest is to clear it in `handleAnalyzeGear` when the check passes (already done above) and let the user see the error until they fix the roles and retry. This is simpler and correct.

### 8. Test implementations

**`buildStore.test.ts` additions:**
```typescript
describe('skill role designation', () => {
  beforeEach(() => {
    useBuildStore.setState({
      activeBuild: makeBuild(),
      selectedClassId: 'sentinel',
      selectedMasteryId: 'void-knight',
    })
  })

  it('setSkillRole persists role for a slot', () => {
    useBuildStore.getState().setSkillRole('slot-0', 'primary_offense')
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBe('primary_offense')
  })

  it('clearSkillRole removes role for a slot', () => {
    useBuildStore.getState().setSkillRole('slot-0', 'primary_offense')
    useBuildStore.getState().clearSkillRole('slot-0')
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBeUndefined()
  })

  it('assignSkillToSlot clears role when skill changes, not when same skill re-assigned', () => {
    useBuildStore.getState().setSkillRole('slot-0', 'primary_offense')
    // Same skill: role should persist
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'erasing-strike', skillName: 'Erasing Strike' })
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'erasing-strike', skillName: 'Erasing Strike' })
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBe('primary_offense')
    // Different skill: role should be cleared
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'warpath', skillName: 'Warpath' })
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBeUndefined()
  })
})
```

**`SkillRoleDesignator.test.tsx`:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { SkillRoleDesignator } from './SkillRoleDesignator'

function makeBuildWithSkill() {
  return {
    /* minimum BuildState shape */
    schemaVersion: 2 as const,
    id: 'test',
    name: 'Test Build',
    classId: 'sentinel',
    masteryId: 'void-knight',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: {
      gear: [],
      skills: [{ slotId: 'slot-0', skillId: 'erasing-strike', skillName: 'Erasing Strike' }],
      idols: [],
    },
    idolGrid: [],
    blessings: {},
    skillRoles: {},
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

it('renders all 5 SKILL_SLOTS', () => {
  useBuildStore.setState({ activeBuild: makeBuildWithSkill() })
  render(<SkillRoleDesignator />)
  expect(screen.getByText('Skill 1: Erasing Strike')).toBeInTheDocument()
  expect(screen.getByText(/Skill 2: Empty/)).toBeInTheDocument()
})

it('clicking a role button calls setSkillRole', () => {
  useBuildStore.setState({ activeBuild: makeBuildWithSkill() })
  render(<SkillRoleDesignator />)
  fireEvent.click(screen.getByTestId('role-button-slot-0-primary_offense'))
  expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBe('primary_offense')
})

it('clicking the active role button calls clearSkillRole', () => {
  useBuildStore.setState({
    activeBuild: { ...makeBuildWithSkill(), skillRoles: { 'slot-0': 'primary_offense' } },
  })
  render(<SkillRoleDesignator />)
  fireEvent.click(screen.getByTestId('role-button-slot-0-primary_offense'))
  expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBeUndefined()
})

it('role buttons for empty slots are disabled', () => {
  useBuildStore.setState({ activeBuild: makeBuildWithSkill() })
  render(<SkillRoleDesignator />)
  // slot-1 has no skill assigned
  const btn = screen.getByTestId('role-button-slot-1-primary_offense')
  expect(btn).toBeDisabled()
})
```

**`GearOptimizationView.test.tsx`:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useAppStore } from '../../shared/stores/appStore'
import { GearOptimizationView } from './GearOptimizationView'

function makeBuild(skillRoles: Record<string, string> = {}) {
  return {
    schemaVersion: 2 as const,
    id: 'test',
    name: 'Test',
    classId: 'sentinel',
    masteryId: 'void-knight',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    idolGrid: [],
    blessings: {},
    skillRoles,
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

it('shows no-roles prompt when no roles are set', () => {
  useBuildStore.setState({ activeBuild: makeBuild({}) })
  render(<GearOptimizationView />)
  expect(screen.getByTestId('gear-optimization-no-roles-prompt')).toBeInTheDocument()
})

it('clicking Analyze Gear with no Primary Offense shows error', () => {
  useBuildStore.setState({ activeBuild: makeBuild({ 'slot-0': 'secondary_offense' }) })
  render(<GearOptimizationView />)
  fireEvent.click(screen.getByTestId('analyze-gear-button'))
  expect(screen.getByTestId('analyze-gear-error')).toHaveTextContent(
    'Please designate at least one skill as Primary Offense before running gear analysis'
  )
})

it('clicking Analyze Gear with Primary Offense set does NOT show error', () => {
  useBuildStore.setState({ activeBuild: makeBuild({ 'slot-0': 'primary_offense' }) })
  render(<GearOptimizationView />)
  fireEvent.click(screen.getByTestId('analyze-gear-button'))
  expect(screen.queryByTestId('analyze-gear-error')).toBeNull()
})
```

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/shared/types/build.ts` | MODIFY | Add `SkillRole` type; add `skillRoles?: Record<string, SkillRole>` to `BuildState` |
| `lebo/src/shared/stores/buildStore.ts` | MODIFY | Add `setSkillRole`, `clearSkillRole` to interface + impl; extend `assignSkillToSlot` to clear role on skill change; add `skillRoles: {}` to `createBuild` |
| `lebo/src/shared/stores/appStore.ts` | MODIFY | Extend `currentView` union to include `'gear-optimization'` |
| `lebo/src/features/layout/AppHeader.tsx` | MODIFY | Add "Gear Optimization" button; add `useBuildStore` import |
| `lebo/src/App.tsx` | MODIFY | Import `GearOptimizationView`; add always-mounted div with `display: gear-optimization ? 'block' : 'none'` |
| `lebo/src/features/gear-optimization/SkillRoleDesignator.tsx` | CREATE | New component |
| `lebo/src/features/gear-optimization/GearOptimizationView.tsx` | CREATE | New screen component |
| `lebo/src/shared/stores/buildStore.test.ts` | MODIFY | Add 3 skill role tests |
| `lebo/src/features/gear-optimization/SkillRoleDesignator.test.tsx` | CREATE | 4 tests |
| `lebo/src/features/gear-optimization/GearOptimizationView.test.tsx` | CREATE | 3 tests |

**Do NOT touch:**
- Any Rust files (`src-tauri/`) — zero Rust changes
- `buildSnapshotSerializer.ts` — `skillRoles` is NOT added to `BuildSnapshot` in this story (Story 5.3 does that)
- `optimizationStore.ts` — no changes
- `shared/types/statSheet.ts` — no changes
- `features/context-panel/SkillInput.tsx` — the existing skill assignment UI is unchanged; role designation is a separate Gear Optimization screen concept

---

## Architecture & Pattern Compliance

**Four stores only.** `skillRoles` goes into `buildStore` (it's build state, not optimization state). No new store.

**No barrel files.** `SkillRole` and `SkillRoleDesignator` are imported directly; no `index.ts` re-exports.

**Always-mounted view pattern.** `GearOptimizationView` is mounted in `App.tsx` with `display: none/block`, matching how `Settings` works — in-flight state is preserved during navigation. This means `GearOptimizationView`'s `analyzeError` useState is reset when the component is hidden/shown (state is preserved but visually hidden). For a cleaner UX, `GearOptimizationView` could clear `analyzeError` in a `useEffect` watching the view, but that's not required for AC compliance.

**Schema version stays at 2.** `skillRoles?: Record<string, SkillRole>` is optional. On an existing saved build loaded from Tauri Stronghold, the field is absent from JSON — `activeBuild.skillRoles ?? {}` handles this cleanly everywhere. No migration story needed.

**Role-per-slot model.** Each slot has at most one role. A player cannot assign both "Primary Offense" and "Defensive" to the same slot. The UI naturally enforces this by only highlighting the active role button — clicking a new role replaces the old one on that slot.

**Tailwind v4 / CSS vars.** `SkillRoleDesignator` uses existing CSS variables (`--color-accent-gold`, `--color-bg-elevated`, `--color-text-secondary`, `--color-text-muted`, `--color-bg-base`) — no new color variables needed.

**TypeScript strict mode.** `clearSkillRole` uses destructuring to remove a key:
```typescript
const { [slotId]: _removed, ...rest } = s.activeBuild.skillRoles ?? {}
```
The `_removed` prefix suppresses `noUnusedLocals`. This is the idiomatic pattern used elsewhere in the codebase.

---

## Testing Requirements

### Verification commands

From `lebo/`:
```bash
pnpm build                                                                    # Zero TypeScript errors
pnpm vitest src/shared/stores/buildStore.test.ts                              # All pass (3 new + existing)
pnpm vitest src/features/gear-optimization/SkillRoleDesignator.test.tsx       # All pass (4 new)
pnpm vitest src/features/gear-optimization/GearOptimizationView.test.tsx      # All pass (3 new)
pnpm vitest                                                                   # Full suite still green
```

---

## Dev Notes

**`SkillRoleDesignator` variable scoping note.** The component reads `activeBuild.contextData.skills` for skill names and `activeBuild.skillRoles` for current roles. It calls store actions directly — no intermediate local state needed. This keeps the component fully reactive.

**`AppHeader` button layout.** Adding "Gear Optimization" next to "Settings" requires both to be in the `ml-auto` region. The simplest approach: wrap both in a `div className="ml-auto flex gap-2"`:
```tsx
<div className="ml-auto flex gap-2">
  {currentView === 'main' && activeBuild && (
    <button ...>Gear Optimization</button>
  )}
  {currentView !== 'settings' && (
    <button ...>Settings</button>
  )}
</div>
```
This avoids the `ml-auto` / `ml-2` conditional in the Technical Requirements section above — simpler and cleaner.

**No `AppHeader.test.tsx` changes required.** Existing AppHeader tests don't check for buttons that only appear when `activeBuild` is non-null (the test likely has `activeBuild: null`). The new button will not appear in those tests' state, so no existing tests will fail. However, if an AppHeader test renders with `activeBuild` set, it might now find the new button — check existing tests and add `data-testid="gear-optimization-button"` assertions if needed.

**`GearOptimizationView` is a shell.** Story 5.4 adds the full ranking/wishlist UI; story 5.5 adds Claude narrative. In story 5.1, "Analyze Gear" with a valid Primary Offense just clears the error and shows nothing (or a "Coming soon" placeholder). The placeholder behavior is explicitly acceptable per the epics requirement that stories 5.2–5.5 add the analysis functionality.

**Role persistence through `buildPersistence.ts`.** Builds are saved to Tauri Stronghold as JSON via `saveBuild`. Since `skillRoles` is a plain `Record<string, SkillRole>` (serializable), it is automatically included in the JSON save. No changes to `buildPersistence.ts` are needed — the save/load round-trip works by JSON serialization of `BuildState`.

**`assignSkillToSlot` change is safe.** The existing function has `set((s) => { ... return { activeBuild: { ...s.activeBuild!, ... } } })`. Adding `skillRoles: updatedSkillRoles` to that return is additive and cannot break existing behavior — when `skillChanged` is false, `updatedSkillRoles = s.activeBuild!.skillRoles ?? {}` (unchanged). When `skillChanged` is true, the role for that slot is removed. This is the exact behavior AC3 requires.

**Pre-existing test suite state.** Story 4.5 completed with 902 passed / 8 pre-existing failures. Those 8 failures (`ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls`) are pre-existing and unrelated to this story. If they appear in the test run, ignore them.

---

## Previous Story Intelligence (from 4.5)

- **`setBlessing` is the exact pattern to copy** for `setSkillRole` — same `Record<string, V>` spread update with `isPersisted: false` + `updatedAt`. Copy it verbatim, changing field names.
- **`clearSuggestions()` precedent** — removing a key from a Record in a store uses destructuring: `const { [key]: _, ...rest } = record`. Used in `optimizationStore.ts` via different means but the TypeScript pattern is established.
- **Always-mounted view pattern** — `Settings` is always mounted in `App.tsx` with `display: block/none`. Copy this pattern exactly for `GearOptimizationView`. The comment "Settings is always mounted so in-flight saves survive navigation" applies equally here (the `analyzeError` state persists across navigation, which is acceptable).
- **`SKILL_SLOTS` is a `const` tuple** — it's `as const` with `slotId` as literal types. Import it from `features/context-panel/skillData.ts`. It has 5 entries: `slot-0` through `slot-4`.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blockers or debug iterations required. Implementation succeeded on first attempt with zero TypeScript errors and all tests passing.

### Completion Notes List

- Added `SkillRole` type and optional `skillRoles` field to `BuildState` (no schema bump — optional field, existing saves handled via `?? {}`).
- Added `setSkillRole` / `clearSkillRole` to `buildStore` using the `setBlessing` immutable-update pattern.
- Extended `assignSkillToSlot` to clear the role for a changed slot using an IIFE destructure: `const { [slotId]: _removed, ...rest } = ...` — the `_removed` prefix suppresses `noUnusedLocals`.
- Extended `appStore.currentView` union to `'main' | 'settings' | 'gear-optimization'`.
- Added "Gear Optimization" button to `AppHeader` inside a `<div className="ml-auto flex gap-2">` wrapper (cleaner than conditional `ml-auto`/`ml-2`).
- Mounted `GearOptimizationView` in `App.tsx` as always-on sibling alongside Settings using `display: block/none`.
- `SkillRoleDesignator`: maps `SKILL_SLOTS × ROLES`, disables buttons for empty slots, toggles role via `setSkillRole`/`clearSkillRole`, active role gets gold background with `aria-pressed`.
- `GearOptimizationView`: shell screen with prompt, `SkillRoleDesignator`, and "Analyze Gear" button guarded by Primary Offense check.
- 14 new tests added (3 buildStore + 6 SkillRoleDesignator + 5 GearOptimizationView). Final suite: 918 passed / 8 pre-existing failures (unchanged from story 4.5 baseline).

### File List

- `lebo/src/shared/types/build.ts` — MODIFIED (added `SkillRole` type; added `skillRoles` field to `BuildState`)
- `lebo/src/shared/stores/buildStore.ts` — MODIFIED (added `setSkillRole`, `clearSkillRole`; extended `assignSkillToSlot`; added `skillRoles: {}` to `createBuild`)
- `lebo/src/shared/stores/appStore.ts` — MODIFIED (extended `currentView` union to include `'gear-optimization'`)
- `lebo/src/features/layout/AppHeader.tsx` — MODIFIED (added "Gear Optimization" button; added `useBuildStore` import)
- `lebo/src/App.tsx` — MODIFIED (imported `GearOptimizationView`; added always-mounted div)
- `lebo/src/features/gear-optimization/SkillRoleDesignator.tsx` — CREATED
- `lebo/src/features/gear-optimization/GearOptimizationView.tsx` — CREATED
- `lebo/src/shared/stores/buildStore.test.ts` — MODIFIED (added 3 skill role tests)
- `lebo/src/features/gear-optimization/SkillRoleDesignator.test.tsx` — CREATED (6 tests)
- `lebo/src/features/gear-optimization/GearOptimizationView.test.tsx` — CREATED (5 tests)

---

### Review Findings

- [x] [Review][Defer] `analyzeError` state persists when `activeBuild` changes between builds [GearOptimizationView.tsx:9] — deferred, acknowledged optional polish in spec; stale error from prior build visible if user loads a different build and returns to gear-optimization
- [x] [Review][Defer] `aria-label` for role buttons on empty slots uses slot label var (e.g. "Primary role for Skill 2") instead of clearer "empty slot" phrasing [SkillRoleDesignator.tsx:52] — deferred, minor a11y polish
- [x] [Review][Defer] `handleAnalyzeGear` clears error before async work with no loading state; will create a bare gap when Story 5.3 wires the real IPC call [GearOptimizationView.tsx:18] — deferred, Story 5.3 concern
