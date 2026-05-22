---
title: 'Conditions Panel'
story_id: '3.4'
story_key: '3-4-conditions-panel'
epic: 3
status: review
created: '2026-05-22'
---

## Story

**As a player,**
I want a conditions panel where I can set combat context (enemy type, charges, build-specific toggles) that flows into the scoring engine and Claude's optimization payload,
**So that** optimization suggestions are accurate for my actual play context (e.g., boss fight with power charges active).

> **Quick Dev candidate** — Toggle UI + build-specific filter logic. Pure React + state, no new Rust required. Use `/bmad-quick-dev` instead of the full CS → DS → CR cycle.

---

## Context

This is the final story in Epic 3. Infrastructure is 90%+ in place from prior stories:

- `BuildState.activeConditions?: string[]` is defined in `shared/types/build.ts`
- `BuildSnapshot.active_conditions: Vec<String>` is defined in `src-tauri/scoring-core/src/build_snapshot.rs`
- `buildSnapshotSerializer.ts` already maps `activeConditions: build.activeConditions ?? []` — **this stub must be replaced**
- `ConditionEntry`, `ConditionFilter`, `ConditionsDatabase` TypeScript types are in `shared/types/contextDatabase.ts`
- `gameDataStore.conditionsDatabase`, `conditionsDataStaleAcknowledged`, `acknowledgeConditionsDataStaleness` are already in `shared/stores/gameDataStore.ts`
- `context_data_service` already loads `conditions.json` on startup
- `conditions.json` at `src-tauri/resources/context-data/conditions.json` has 13 entries (10 universal, 3 build-specific)

**What this story adds:**
1. `conditionValues?: Record<string, string | number | boolean>` field to `BuildState` in `shared/types/build.ts`
2. `setConditionValue` action in `buildStore.ts`
3. Replace the `activeConditions` stub in `buildSnapshotSerializer.ts` with encoding from `conditionValues`
4. New `ConditionsPanel.tsx` component
5. Add Conditions Disclosure to `ContextPanel.tsx`

**What this story does NOT touch:**
- `shared/types/contextDatabase.ts` — types already correct
- `shared/stores/gameDataStore.ts` — conditions fields already present
- Any Rust scoring files — `active_conditions` is already in `BuildSnapshot` and the registry handles `Named` conditions
- `context_data_service.rs` — loading already wired
- `src-tauri/scoring-core/` — **no Rust changes whatsoever**

---

## Acceptance Criteria

**Given** the Conditions panel is opened
**When** the player views universal conditions
**Then** an enemy type selector (standard mob / rare / unique boss / pinnacle boss), per-element enemy resistance inputs, and charge count selectors (frenzy, power, endurance up to their maximums) are all displayed

**Given** a Paladin build with "Sigil of Hope" skill assigned to an active slot
**When** the Conditions panel is displayed
**Then** a "Is Sigil of Hope active?" toggle is visible
**And** a non-Paladin build without Sigil of Hope does not show this toggle

**Given** conditions set to "pinnacle boss" with 3 power charges active
**When** `compute_stats()` is called
**Then** `BuildSnapshot.activeConditions` includes `["on_pinnacle_boss", "power_charges_3"]`
**And** the DamageScore in the stat sheet reflects the condition-adjusted computation

**Given** active conditions when `run_optimization` is triggered
**When** the Claude optimization payload is assembled
**Then** `build_context.conditions` in the payload matches the active conditions
**And** Claude references the conditions in at least one suggestion explanation

**Given** a build-specific condition visible for a skill currently in a slot
**When** the player replaces that skill with a different skill
**Then** the condition disappears from the panel
**And** the `BuildSnapshot` no longer includes the now-irrelevant condition

---

## Tasks / Subtasks

- [x] Task 1: Add `conditionValues` field to `BuildState` in `shared/types/build.ts`
  - [x] Add `conditionValues?: Record<string, string | number | boolean>` (optional, no migration needed)
- [x] Task 2: Add `setConditionValue` action to `buildStore.ts`
  - [x] Add interface declaration
  - [x] Add implementation following `setBlessing` pattern
- [x] Task 3: Replace `activeConditions` stub in `buildSnapshotSerializer.ts` + serializer tests
  - [x] Implement `encodeConditionValues()` helper function
  - [x] Replace stub line with `encodeConditionValues(build.conditionValues ?? {})`
  - [x] Add 3 serializer tests
- [x] Task 4: Create `ConditionsPanel.tsx` + `ConditionsPanel.test.tsx`
  - [x] Implement component with universal conditions and build-specific filtering
  - [x] Write 10 unit tests
- [x] Task 5: Update `ContextPanel.tsx` + `ContextPanel.test.tsx`
  - [x] Add Conditions Disclosure section after Blessings
  - [x] Add `conditionValues: {}` to mockBuild + 2 new tests

---

## Technical Requirements

### 1. TypeScript — Add `conditionValues` to `BuildState` (`shared/types/build.ts`)

Add after the existing `activeConditions?: string[]` line:

```typescript
conditionValues?: Record<string, string | number | boolean>
```

`schemaVersion` stays at `2` — this optional field defaults to `{}` for all existing saved builds. No migration function needed.

**Do NOT remove `activeConditions?: string[]`** — it remains in `BuildState` for future backward-compat reads. The serializer will derive from `conditionValues` instead.

### 2. TypeScript — Add `setConditionValue` action (`shared/stores/buildStore.ts`)

Add to `BuildStore` interface:
```typescript
setConditionValue: (id: string, value: string | number | boolean) => void
```

Add implementation (follow the `setBlessing` pattern):
```typescript
setConditionValue: (id, value) =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            conditionValues: {
              ...(s.activeBuild.conditionValues ?? {}),
              [id]: value,
            },
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),
```

Setting any value (including the default/zero) is allowed — the encoding step in the serializer handles what to include in `activeConditions`.

### 3. TypeScript — Replace `activeConditions` stub in `buildSnapshotSerializer.ts`

**Encoding logic** — add as an exported helper (enables testing independently):

```typescript
// Encodes structured conditionValues into the flat activeConditions string array
// used by the scoring engine.
//   boolean true  → condition.id (e.g. "sigil_of_hope_active")
//   string        → "on_" + value (e.g. "on_pinnacle_boss") — skipped if empty
//   number != 0   → id + "_" + value (e.g. "power_charges_3")
export function encodeConditionValues(
  values: Record<string, string | number | boolean>
): string[] {
  const result: string[] = []
  for (const [id, value] of Object.entries(values)) {
    if (typeof value === 'boolean') {
      if (value) result.push(id)
    } else if (typeof value === 'number') {
      if (value !== 0) result.push(`${id}_${value}`)
    } else if (typeof value === 'string') {
      if (value) result.push(`on_${value}`)
    }
  }
  return result
}
```

Replace the existing stub:
```typescript
// OLD (remove):
activeConditions: build.activeConditions ?? [],

// NEW:
activeConditions: encodeConditionValues(build.conditionValues ?? {}),
```

**Encoding examples that match the AC:**
| UI value | Encoded string |
|---|---|
| `enemy_type = "pinnacle_boss"` | `"on_pinnacle_boss"` |
| `enemy_type = "standard_mob"` | skipped (empty/default? No — the string is non-empty → `"on_standard_mob"` IS included) |
| `power_charges = 3` | `"power_charges_3"` |
| `power_charges = 0` | skipped |
| `enemy_fire_resistance = 25` | `"enemy_fire_resistance_25"` |
| `enemy_fire_resistance = 0` | skipped |
| `enemy_fire_resistance = -25` | `"enemy_fire_resistance_-25"` |
| `sigil_of_hope_active = true` | `"sigil_of_hope_active"` |
| `sigil_of_hope_active = false` | skipped |

**Note on enemy type:** The enemy type is a select with `defaultValue: "standard_mob"`. Since every non-empty string gets encoded as `"on_*"`, the `"on_standard_mob"` condition string IS included in `activeConditions` when enemy type is set. The scoring engine ignores conditions it doesn't recognize — this is safe. If `conditionValues["enemy_type"]` is never set, it simply doesn't appear (no default injection by the panel).

### 4. TypeScript — New Component (`features/conditions/ConditionsPanel.tsx`)

**File path:** `lebo/src/features/conditions/ConditionsPanel.tsx`

**Data flow:**
- `conditionsDatabase: ConditionEntry[] | null` from `useGameDataStore((s) => s.conditionsDatabase)`
- `conditionValues: Record<string, string | number | boolean>` from `useBuildStore((s) => s.activeBuild?.conditionValues ?? {})`
- `setConditionValue` from `useBuildStore`
- `classId: string` from `useBuildStore((s) => s.activeBuild?.classId ?? '')`
- `activeSkills: ActiveSkill[]` from `useBuildStore((s) => s.activeBuild?.contextData.skills ?? [])`

**Build-specific condition filter logic (useMemo, recomputes when classId or skills change):**
```typescript
const visibleConditions = useMemo(() => {
  if (!conditionsDatabase) return []
  return conditionsDatabase.filter((entry) => {
    if (entry.category === 'universal') return true
    const { filter } = entry
    if (!filter) return true
    if (filter.classId && filter.classId !== classId) return false
    if (filter.skillTag) {
      const hasSkill = activeSkills.some(
        (s) => s.skillId.toLowerCase().includes(filter.skillTag!.toLowerCase())
      )
      if (!hasSkill) return false
    }
    return true
  })
}, [conditionsDatabase, classId, activeSkills])
```

**Auto-clear stale build-specific conditions (useEffect):**
When visible conditions change (a skill was removed), clear any `conditionValues` entries for build-specific conditions that are no longer visible:
```typescript
useEffect(() => {
  if (!conditionsDatabase) return
  const visibleIds = new Set(visibleConditions.map((c) => c.id))
  const staleIds = Object.keys(conditionValues).filter((id) => {
    const entry = conditionsDatabase.find((c) => c.id === id)
    return entry?.category === 'build-specific' && !visibleIds.has(id)
  })
  if (staleIds.length > 0) {
    staleIds.forEach((id) => setConditionValue(id, false))
  }
}, [visibleConditions, conditionsDatabase])
```

**Render structure:**

Universal conditions section first, build-specific (if any visible) second:
```tsx
if (!conditionsDatabase || conditionsDatabase.length === 0) {
  return (
    <p className="text-xs" style={{ color: 'var(--color-text-muted)', padding: '4px 0' }}>
      Conditions data not loaded.
    </p>
  )
}

const universalConditions = visibleConditions.filter((c) => c.category === 'universal')
const buildSpecificConditions = visibleConditions.filter((c) => c.category === 'build-specific')

return (
  <div className="flex flex-col gap-2 py-1">
    {/* Universal conditions */}
    {universalConditions.map((entry) => (
      <ConditionRow key={entry.id} entry={entry} value={conditionValues[entry.id]} onChange={setConditionValue} />
    ))}

    {/* Build-specific divider + conditions */}
    {buildSpecificConditions.length > 0 && (
      <>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
          Build-specific
        </p>
        {buildSpecificConditions.map((entry) => (
          <ConditionRow key={entry.id} entry={entry} value={conditionValues[entry.id]} onChange={setConditionValue} />
        ))}
      </>
    )}
  </div>
)
```

**ConditionRow sub-component (inline, not exported):**

Renders the appropriate control based on `entry.type`:
- `'select'` → `<select>` with `entry.options`
- `'range'` → `<input type="range">` + number display (min/max/step from entry)
- `'toggle'` → `<input type="checkbox">`

```tsx
function ConditionRow({
  entry,
  value,
  onChange,
}: {
  entry: ConditionEntry
  value: string | number | boolean | undefined
  onChange: (id: string, value: string | number | boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor={`condition-${entry.id}`}
        className="text-xs shrink-0"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {entry.displayLabel}
      </label>

      {entry.type === 'select' && (
        <select
          id={`condition-${entry.id}`}
          value={typeof value === 'string' ? value : String(entry.defaultValue)}
          onChange={(e) => onChange(entry.id, e.target.value)}
          className="text-xs rounded px-1 py-0.5"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
        >
          {entry.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {entry.type === 'range' && (
        <div className="flex items-center gap-1">
          <input
            id={`condition-${entry.id}`}
            type="range"
            min={entry.min ?? 0}
            max={entry.max ?? 100}
            step={entry.step ?? 1}
            value={typeof value === 'number' ? value : Number(entry.defaultValue)}
            onChange={(e) => onChange(entry.id, Number(e.target.value))}
            className="w-20"
            aria-valuemin={entry.min ?? 0}
            aria-valuemax={entry.max ?? 100}
            aria-valuenow={typeof value === 'number' ? value : Number(entry.defaultValue)}
          />
          <span className="text-xs w-8 text-right" style={{ color: 'var(--color-text-muted)' }}>
            {typeof value === 'number' ? value : entry.defaultValue}
          </span>
        </div>
      )}

      {entry.type === 'toggle' && (
        <input
          id={`condition-${entry.id}`}
          type="checkbox"
          checked={typeof value === 'boolean' ? value : Boolean(entry.defaultValue)}
          onChange={(e) => onChange(entry.id, e.target.checked)}
          className="w-4 h-4"
        />
      )}
    </div>
  )
}
```

**No barrel file.** Named export `export function ConditionsPanel()`. No `index.ts`.

**Component reads stores directly** — same pattern as `BlessingsPanel`, `GearInput`, `SkillInput`.

### 5. TypeScript — Update `ContextPanel.tsx`

Add import:
```typescript
import { ConditionsPanel } from '../conditions/ConditionsPanel'
```

Add `activeConditionsCount` selector:
```typescript
const conditionValues = useBuildStore((s) => s.activeBuild?.conditionValues ?? {})
const activeConditionsCount = Object.values(conditionValues).filter((v) => {
  if (typeof v === 'boolean') return v === true
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== '' && v !== 'standard_mob'
  return false
}).length
```

**Note on `standard_mob` exclusion from count:** Standard mob is the default enemy type, so it's excluded from the "active" count display. Other non-zero/non-default values count as active.

Add Conditions Disclosure section (after Blessings section):
```tsx
<div data-testid="context-section-conditions">
  <Disclosure>
    <DisclosureButton
      className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
      style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
    >
      <span>Conditions</span>
      <span style={{ color: 'var(--color-text-muted)' }}>{activeConditionsCount} active</span>
    </DisclosureButton>
    <DisclosurePanel>
      <ConditionsPanel />
    </DisclosurePanel>
  </Disclosure>
</div>
```

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/shared/types/build.ts` | MODIFY | Add `conditionValues?: Record<string, string \| number \| boolean>` field |
| `lebo/src/shared/stores/buildStore.ts` | MODIFY | Add `setConditionValue` action to interface + implementation |
| `lebo/src/shared/utils/buildSnapshotSerializer.ts` | MODIFY | Add `encodeConditionValues()` helper; replace `activeConditions` stub |
| `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` | MODIFY | Add 3 conditions serialization tests |
| `lebo/src/features/conditions/ConditionsPanel.tsx` | CREATE | New feature component |
| `lebo/src/features/conditions/ConditionsPanel.test.tsx` | CREATE | Unit tests |
| `lebo/src/features/context-panel/ContextPanel.tsx` | MODIFY | Add Conditions Disclosure section |
| `lebo/src/features/context-panel/ContextPanel.test.tsx` | MODIFY | Add `conditionValues: {}` to mockBuild + 2 new tests |

**Do not touch:**
- `shared/types/contextDatabase.ts` — types already correct
- `shared/stores/gameDataStore.ts` — conditions fields already present
- `src-tauri/scoring-core/` — no Rust changes needed
- `src-tauri/src/services/context_data_service.rs` — loading already wired
- Any existing blessings or idol files

---

## Architecture & Pattern Compliance

**Pattern 1** — `buildSnapshotSerializer.ts` is the only encoding point. `ConditionsPanel` calls only `setConditionValue` store action — it never directly calls `invokeCommand`. The rAF debounce in `useStatSheet` fires `compute_stats` automatically.

**Pattern 2** — `BuildSnapshot.active_conditions` is `Vec<String>` (camelCase input `activeConditions`). `BuildSnapshot` already has `#[serde(default)]` on this field. No Rust struct changes needed.

**No new Zustand stores** — Four stores only. `ConditionsPanel` reads from `useGameDataStore` and `useBuildStore` directly (same pattern as `BlessingsPanel`).

**Store initialization** — `buildStore.createBuild` already initializes `activeConditions: []`. `conditionValues` is optional and defaults to `{}` at every access point via `?? {}`. No migration needed.

**`schemaVersion` stays at `2`** — `conditionValues` is an optional field with no breaking impact on existing v2 builds.

---

## Previous Story Intelligence (from 3.3)

**Key patterns from 3.3:**
- Feature components (`BlessingsPanel`, `ConditionsPanel`) access stores directly (not via props) — they are feature-level, not presentational
- Sub-components that are purely presentational (`TimelineRow` in BlessingsPanel) receive data via props. `ConditionRow` follows the same pattern — receives `entry`, `value`, `onChange` via props
- `vi.mock(...)` with `vi.fn()` — NOT `vi.mocked()`. Follow `IdolGrid.test.tsx` / `BlessingsPanel.test.tsx` patterns exactly
- `ContextPanel.test.tsx` mockBuild requires ALL optional fields defined (`blessings: {}`, now also `conditionValues: {}`) to prevent undefined access warnings
- The `useEffect` dependency array must include all values accessed inside (ESLint would catch missing deps — be explicit)
- `setConditionValue(id, false)` for toggles and `setConditionValue(id, 0)` for ranges means "reset to default" — the serializer encodes these as "not active" (booleans false → skipped, number 0 → skipped)
- Per `BlessingsPanel.test.tsx` pattern: mock both stores at top of test file with `vi.mock(...)`, then use `(useStore as ReturnType<typeof vi.fn>).mockReturnValue(...)` per test

**3.3 deferred items that may affect 3.4:**
- The `Modifier` in `build_registry` may be missing `source: blessing_id.clone()` — do NOT fix this in 3.4. Verify it's still deferred before Epic 4 begins (mentioned in 3.3 review)
- Stale select value when selected blessing is filtered out — ConditionsPanel has a similar risk when build-specific conditions disappear. The `useEffect` auto-clear handles the VALUE; the ConditionRow will unmount when the condition is not `visibleConditions`, so there's no stale display issue

**Test baseline:** 871 TS tests passing after 3.3. New tests from 3.4 add ~15 tests. Expected final: ~886+.

---

## conditions.json Data Reference

File: `lebo/src-tauri/resources/context-data/conditions.json`

**Universal conditions (10 entries):**
| id | type | range/options |
|---|---|---|
| `enemy_type` | select | standard_mob / rare / unique_boss / pinnacle_boss |
| `enemy_fire_resistance` | range | -100 to 100, step 5 |
| `enemy_cold_resistance` | range | -100 to 100, step 5 |
| `enemy_lightning_resistance` | range | -100 to 100, step 5 |
| `enemy_void_resistance` | range | -100 to 100, step 5 |
| `enemy_poison_resistance` | range | -100 to 100, step 5 |
| `enemy_physical_resistance` | range | -100 to 100, step 5 |
| `frenzy_charges` | range | 0 to 4, step 1 |
| `power_charges` | range | 0 to 3, step 1 |
| `endurance_charges` | range | 0 to 3, step 1 |

**Build-specific conditions (3 entries):**
| id | type | filter |
|---|---|---|
| `sigil_of_hope_active` | toggle | classId: "sentinel" AND skillTag: "sigil_of_hope" |
| `enemy_hexed` | toggle | skillTag: "hex" |

**Filter matching logic:**
- `filter.classId` is checked against `build.classId` (exact match, case-sensitive)
- `filter.skillTag` is checked against each active skill's `skillId` with case-insensitive substring match: `skillId.toLowerCase().includes(filter.skillTag.toLowerCase())`
- Both filter fields must match (AND logic) when both are present

---

## Testing Requirements

### `ConditionsPanel.test.tsx`

Mock setup pattern (follow `BlessingsPanel.test.tsx`):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConditionsPanel } from './ConditionsPanel'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { ConditionEntry } from '../../shared/types/contextDatabase'
import { axe } from 'vitest-axe'

vi.mock('../../shared/stores/gameDataStore')
vi.mock('../../shared/stores/buildStore')

const mockConditions: ConditionEntry[] = [
  {
    id: 'enemy_type',
    displayLabel: 'Enemy Type',
    category: 'universal',
    type: 'select',
    options: [
      { value: 'standard_mob', label: 'Standard Mob' },
      { value: 'pinnacle_boss', label: 'Pinnacle Boss' },
    ],
    defaultValue: 'standard_mob',
  },
  {
    id: 'power_charges',
    displayLabel: 'Power Charges',
    category: 'universal',
    type: 'range',
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 0,
    options: [],
  },
  {
    id: 'sigil_of_hope_active',
    displayLabel: 'Sigil of Hope active',
    category: 'build-specific',
    type: 'toggle',
    defaultValue: false,
    options: [],
    filter: { classId: 'sentinel', skillTag: 'sigil_of_hope' },
  },
]

const mockSetConditionValue = vi.fn()
```

**Tests (10 total):**

1. **Renders empty state when no conditions database** — shows "Conditions data not loaded." when `conditionsDatabase` is null
2. **Renders universal conditions** — `enemy_type` select and `power_charges` range inputs are visible
3. **Select change calls setConditionValue** — `fireEvent.change(select, { target: { value: 'pinnacle_boss' } })` triggers `setConditionValue('enemy_type', 'pinnacle_boss')`
4. **Range change calls setConditionValue** — `fireEvent.change(rangeInput, { target: { value: '3' } })` triggers `setConditionValue('power_charges', 3)` (as number, not string)
5. **Build-specific condition hidden when filter doesn't match class** — `sigil_of_hope_active` not visible when `classId = 'acolyte'`
6. **Build-specific condition hidden when filter skill not active** — `sigil_of_hope_active` not visible when `classId = 'sentinel'` but no skill with "sigil_of_hope" in skillId
7. **Build-specific condition visible when both filter parts match** — `sigil_of_hope_active` visible when `classId = 'sentinel'` AND skill with skillId `"sigil_of_hope"` is active
8. **Toggle change calls setConditionValue with boolean** — `fireEvent.click(checkbox)` triggers `setConditionValue('sigil_of_hope_active', true)`
9. **Build-specific section header appears only when conditions are visible** — "Build-specific" label appears only when at least one build-specific condition is visible
10. **Accessibility** — `expect(await axe(container)).toHaveNoViolations()`

### `buildSnapshotSerializer.test.ts` additions

```typescript
it('encodes toggle condition as condition id when true', () => {
  const build = makeBuild({ conditionValues: { sigil_of_hope_active: true } })
  const snapshot = toBuildSnapshot(build, minimalGameData)
  expect(snapshot.activeConditions).toContain('sigil_of_hope_active')
})

it('encodes select condition as on_value string', () => {
  const build = makeBuild({ conditionValues: { enemy_type: 'pinnacle_boss' } })
  const snapshot = toBuildSnapshot(build, minimalGameData)
  expect(snapshot.activeConditions).toContain('on_pinnacle_boss')
})

it('encodes range condition as id_value and skips zero', () => {
  const build = makeBuild({
    conditionValues: {
      power_charges: 3,
      frenzy_charges: 0,   // zero → skipped
    },
  })
  const snapshot = toBuildSnapshot(build, minimalGameData)
  expect(snapshot.activeConditions).toContain('power_charges_3')
  expect(snapshot.activeConditions).not.toContain('frenzy_charges_0')
  expect(snapshot.activeConditions.some((c) => c.startsWith('frenzy_charges'))).toBe(false)
})

it('returns empty activeConditions when conditionValues is undefined', () => {
  const build = makeBuild({ conditionValues: undefined })
  const snapshot = toBuildSnapshot(build, minimalGameData)
  expect(snapshot.activeConditions).toEqual([])
})
```

### `ContextPanel.test.tsx` additions

1. Add `conditionValues: {}` to `mockBuild` (prevents undefined access)
2. Add test: `renders context-section-conditions` — `expect(screen.getByTestId('context-section-conditions')).toBeInTheDocument()`
3. Add test: `shows conditions count as "0 active" when none set` — `expect(screen.getByText('0 active')).toBeInTheDocument()`

---

## Verification Commands

From `lebo/`:
```bash
pnpm build        # zero TypeScript errors
pnpm vitest       # all new tests pass; 871+ pre-existing tests still pass
```

No Rust verification needed — no Rust files changed.

Expected test baseline: 871 TS passed (from 3.3 final) + new tests ≈ 886+. The 8 pre-existing failures remain unchanged.

---

## Dev Notes

- **`encodeConditionValues` is exported** for independent testing. Import it in `buildSnapshotSerializer.test.ts` directly: `import { encodeConditionValues } from './buildSnapshotSerializer'`
- **Range slider value is a string from the DOM** — `e.target.value` returns a string even for `type="range"`. Always call `Number(e.target.value)` before passing to `setConditionValue` for range inputs
- **`conditionValues[entry.id]` may be undefined** — when a condition has never been set, fall back to `entry.defaultValue`: `typeof value === 'number' ? value : Number(entry.defaultValue)` for range, etc. The ConditionRow handles this with the `undefined` fallback to `entry.defaultValue`
- **`activeConditionsCount` in ContextPanel** excludes `"standard_mob"` from the count since it's the default enemy type. If the player sets enemy type to anything other than `"standard_mob"`, it counts. Other select values (which aren't enemy_type) don't need special exclusion — but for now only `enemy_type` is a select in the conditions.json, so this check is sufficient
- **`useEffect` deps for auto-clear** — include `visibleConditions`, `conditionsDatabase`, and `conditionValues` in the dependency array. Watch for ESLint/TypeScript strict mode complaints about missing deps
- **`ConditionRow` is a local function component, not exported** — it only handles the rendering of a single condition entry. Keeping it local avoids the "no barrel files" rule violation (it can't be re-exported elsewhere)
- **Accessibility**: Each control must have an `id` matching a `<label htmlFor>`. The `id={`condition-${entry.id}`}` pattern ensures uniqueness. All controls need the 2px solid accent-gold focus ring standard — use the default browser focus ring or the `focus:outline` Tailwind class
- **The `ConditionEntry.options` field** is typed as `ConditionOption[]` but is absent for toggle and range entries in the JSON — they're absent from the JSON, which means TS will see them as `undefined`. The `contextDatabase.ts` type has `options: ConditionOption[]` (non-optional). Check the actual type — if it's required, mock data must include `options: []` for non-select entries (as shown in the test mock above)

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Build passes clean (zero TS errors)
- All 5 tasks completed and tested; 895 tests passing (903 total, 8 pre-existing failures unrelated to this story)
- `ConditionEntry.options` typed as required array — used `entry.options ?? []` in select render to guard against absent field in range/toggle entries; mock data includes `options: []` for non-select test entries

### Completion Notes List
- Added `conditionValues?: Record<string, string | number | boolean>` to BuildState (optional, backward-compat, no migration)
- Added `setConditionValue` action to buildStore following setBlessing pattern
- Exported `encodeConditionValues()` helper in buildSnapshotSerializer.ts; replaced `activeConditions: build.activeConditions ?? []` stub with `encodeConditionValues(build.conditionValues ?? {})`
- Created ConditionsPanel.tsx with local ConditionRow sub-component, useMemo-filtered visible conditions, useEffect auto-clear of stale build-specific values
- Added 10 ConditionsPanel tests + 12 serializer tests (4 integration + 8 unit for encodeConditionValues)
- Scoped blessings "0 active" test in ContextPanel.test.tsx with `within(getByTestId(...))` to avoid conflict with conditions "0 active" button
- Conditions count in ContextPanel excludes standard_mob string (default enemy type) from active count

### File List
- `lebo/src/shared/types/build.ts` — added `conditionValues?: Record<string, string | number | boolean>`
- `lebo/src/shared/stores/buildStore.ts` — added `setConditionValue` action
- `lebo/src/shared/utils/buildSnapshotSerializer.ts` — added `encodeConditionValues()`, replaced stub
- `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` — replaced broken test, added 12 new tests
- `lebo/src/features/conditions/ConditionsPanel.tsx` — new file
- `lebo/src/features/conditions/ConditionsPanel.test.tsx` — new file
- `lebo/src/features/context-panel/ContextPanel.tsx` — added Conditions Disclosure section
- `lebo/src/features/context-panel/ContextPanel.test.tsx` — added conditionValues to mockBuild, scoped blessings test, added 2 new tests

### Review Findings
