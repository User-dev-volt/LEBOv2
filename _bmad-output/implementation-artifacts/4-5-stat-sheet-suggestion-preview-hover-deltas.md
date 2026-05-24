---
title: 'Stat Sheet Suggestion Preview — Hover Deltas'
story_id: '4.5'
story_key: '4-5-stat-sheet-suggestion-preview-hover-deltas'
epic: 4
status: done
created: '2026-05-24'
---

## Story

**As a player,**
I want to hover over any AI suggestion to see how applying it would change my stat sheet values — gains in green and losses in red,
**so that** I can evaluate the trade-off at a glance.

---

## Context

This is Story 4.5 — the final story in Epic 4. Stories 4.1–4.4 have established:
- `run_optimization` (Tauri command) computing node efficiencies and streaming suggestions via events
- Each `SuggestionResult` carries `nodeChange` (toNodeId, fromNodeId, pointsChange), `explanation`, and score deltas
- `optimizationStore.statSheet` holds the live `StatSheet` from the Rust scoring engine
- `StatSheetPanel.tsx` renders the five-tab stat sheet
- `SuggestionCard.tsx` already has `onHoverEnter` / `onHoverLeave` props wired in `SuggestionsList.tsx`
- `compute_stats` IPC command is already registered and used by `useStatSheet.ts`

**What this story adds:**

1. `optimizationStore` gains `previewStatSheet: StatSheet | null` + `setPreviewStatSheet()`
2. `SuggestionsList.tsx` `handleHoverEnter` calls `invokeCommand('compute_stats', { snapshot })` with the suggestion's node change applied to the current build — stores result as `previewStatSheet`; hover leave clears it
3. Delta suppressed when `isComputingStats` is true
4. `StatSheetPanel.tsx` computes per-field deltas from `(previewStatSheet - statSheet)` and shows them inline in `StatRow` with `+`/`-` prefix signs and green/red colors
5. New tests for the delta display and hover interaction

**What this story does NOT do:**
- Add any new Rust code or Tauri commands — `compute_stats` already exists
- Show deltas for the General tab (level, skill levels — unaffected by node allocation changes)
- Replace or modify the canvas `previewSuggestionRank` overlay (passive tree overlay remains unchanged)
- Animate the delta appearance/disappearance

**Critical constraint:** `StatSheetPanel` is a pure display component — it reads store state and renders. The IPC call lives in `SuggestionsList`, which already owns hover handling.

---

## Acceptance Criteria

**AC1 — Hover shows deltas:**
**Given** a suggestion item in the suggestion list with a non-null `statSheet` in the store
**When** the player hovers over it and the preview `compute_stats` call resolves
**Then** affected stat sheet values display before/after deltas: gains appear as green `(+X)`, losses appear as red `(-X)`
**And** stat rows with zero delta show no delta notation

**AC2 — Mouse-off clears deltas:**
**Given** hover delta display is active
**When** the player moves the mouse off the suggestion item
**Then** all stat sheet values return to normal display immediately with no animation delay

**AC3 — Loading state suppresses deltas:**
**Given** the stat sheet is in a loading state (`isComputingStats = true`)
**When** the player hovers a suggestion
**Then** hover delta display is suppressed — no `invokeCommand('compute_stats')` call is made and no delta is shown

**AC4 — Accessibility (color-blind safe):**
**Given** the hover delta implementation
**When** `axe(container)` runs on the stat sheet panel with a `previewStatSheet` set
**Then** `expect(await axe(container)).toHaveNoViolations()` passes
**And** color is not the sole differentiator — delta values include `+` or `-` prefix signs in the rendered text

**AC5 — Stale hover result discarded:**
**Given** a player hovers suggestion A, then quickly moves to suggestion B before suggestion A's `compute_stats` resolves
**When** suggestion A's result arrives
**Then** it is discarded and `previewStatSheet` reflects suggestion B's result (or null if B's call hasn't resolved yet)

---

## Tasks / Subtasks

- [x] Task 1: Extend `optimizationStore` with `previewStatSheet` (AC1, AC2, AC3)
  - [x] Add `previewStatSheet: StatSheet | null` field (initialize to `null`)
  - [x] Add `setPreviewStatSheet: (sheet: StatSheet | null) => void` action
  - [x] In `clearSuggestions()`: add `previewStatSheet: null` to the reset object
  - [x] `pnpm build` passes, zero TypeScript errors

- [x] Task 2: Update `SuggestionsList.tsx` — compute preview on hover (AC1, AC2, AC3, AC5)
  - [x] Import `invokeCommand` from `'../../shared/utils/invokeCommand'`
  - [x] Import `toBuildSnapshot` from `'../../shared/utils/buildSnapshotSerializer'`
  - [x] Import `StatSheet` type from `'../../shared/types/statSheet'`
  - [x] Add `setPreviewStatSheet` selector from `optimizationStore`
  - [x] Add `isComputingStats` selector from `optimizationStore`
  - [x] Add `previewAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false })`
  - [x] Refactor `handleHoverEnter(suggestion)` to be `async`:
    - Still calls `setHighlightedNodeIds(...)` as before (unchanged)
    - Guard: if `isComputingStats` is true → return immediately (AC3)
    - Build modified snapshot: clone `activeBuild.nodeAllocations`, apply `suggestion.nodeChange` (add `pointsChange` to `toNodeId`, subtract from `fromNodeId`), call `toBuildSnapshot({ ...activeBuild, nodeAllocations: modified }, gameData)`
    - Set `previewAbortRef.current = { cancelled: false }`, capture `guard` reference
    - `await invokeCommand<StatSheet>('compute_stats', { snapshot })` inside try/catch
    - If `!guard.cancelled`: call `setPreviewStatSheet(result)`
    - Catch block: swallow — no delta shown on IPC failure (correct behavior)
  - [x] Refactor `handleHoverLeave()`:
    - Still calls `setHighlightedNodeIds(null)` (unchanged)
    - Sets `previewAbortRef.current.cancelled = true`
    - Calls `setPreviewStatSheet(null)` (AC2)
  - [x] `pnpm build` passes

- [x] Task 3: Update `StatSheetPanel.tsx` — show deltas (AC1, AC2, AC4)
  - [x] Add `previewStatSheet` selector: `const previewStatSheet = useOptimizationStore((s) => s.previewStatSheet)`
  - [x] Update `StatRow` interface: add `delta?: number` prop (optional)
  - [x] Add inline `DeltaBadge` helper in `StatSheetPanel.tsx` (NOT a separate file — keep it co-located)
  - [x] Update `StatRow` render: when `delta !== undefined && delta !== 0`, render `<DeltaBadge delta={delta} unit={unit} />` after the value span
  - [x] In `StatSheetPanel`, compute `deltas` object only when `previewStatSheet !== null && statSheet !== null && !isComputingStats`
  - [x] Add pure helper function `computeStatDeltas(base, preview)` in the same file (NOT exported)
  - [x] Pass `delta={deltas?.field}` to each `StatRow` where a delta is meaningful (Offense, Defense, Other tabs — not General)
  - [x] `pnpm build` passes

- [x] Task 4: Tests (AC1, AC2, AC3, AC4, AC5)
  - [x] `StatSheetPanel.test.tsx` — 4 new tests:
    - (a) shows positive delta on Offense stat when `previewStatSheet` has higher value
    - (b) shows negative delta on Defense stat when `previewStatSheet` has lower value  
    - (c) no delta shown when `previewStatSheet` is null
    - (d) no delta shown when `isComputingStats` is true (even with `previewStatSheet` set)
  - [x] `StatSheetPanel.test.tsx` — update `setupMocks` to accept `previewStatSheet` option
  - [x] `SuggestionsList.test.tsx` — 2 new tests:
    - (a) `mouseenter` on suggestion card calls `invokeCommand('compute_stats')` when `isComputingStats` is false
    - (b) `mouseenter` on suggestion card does NOT call `invokeCommand('compute_stats')` when `isComputingStats` is true
  - [x] `pnpm vitest src/features/stat-sheet/StatSheetPanel.test.tsx` — 13 passed (all)
  - [x] `pnpm vitest src/features/optimization/SuggestionsList.test.tsx` — 42 passed (all)
  - [x] `pnpm build` — zero TypeScript errors

---

## Technical Requirements

### 1. `optimizationStore.ts` changes

Add to the `OptimizationStore` interface:
```typescript
previewStatSheet: StatSheet | null
setPreviewStatSheet: (sheet: StatSheet | null) => void
```

Initialize in the store body:
```typescript
previewStatSheet: null,
setPreviewStatSheet: (sheet) => set({ previewStatSheet: sheet }),
```

In `clearSuggestions()` reset object, add:
```typescript
previewStatSheet: null,
```

**Import:** `StatSheet` is already imported at the top of `optimizationStore.ts`.

### 2. `SuggestionsList.tsx` changes

**New selectors** (add alongside existing `useOptimizationStore` calls):
```typescript
const setPreviewStatSheet = useOptimizationStore((s) => s.setPreviewStatSheet)
const isComputingStats = useOptimizationStore((s) => s.isComputingStats)
```

**New ref** (add alongside `cardRefs` and `prevSuggestionsRef`):
```typescript
const previewAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false })
```

**Updated `handleHoverEnter`** — replace the existing sync function with:
```typescript
async function handleHoverEnter(suggestion: SuggestionResult) {
  setHighlightedNodeIds({
    glowing: new Set([suggestion.nodeChange.toNodeId]),
    dimmed: suggestion.nodeChange.fromNodeId
      ? new Set([suggestion.nodeChange.fromNodeId])
      : new Set(),
  })

  if (isComputingStats) return  // AC3: suppress during live recompute

  const activeBuild = useBuildStore.getState().activeBuild
  const gameData = useGameDataStore.getState().gameData
  if (!activeBuild || !gameData) return

  const { toNodeId, fromNodeId, pointsChange } = suggestion.nodeChange
  const modifiedAllocations = { ...activeBuild.nodeAllocations }
  modifiedAllocations[toNodeId] = (modifiedAllocations[toNodeId] ?? 0) + pointsChange
  if (fromNodeId) {
    modifiedAllocations[fromNodeId] = Math.max(
      0,
      (modifiedAllocations[fromNodeId] ?? 0) - pointsChange,
    )
  }

  const snapshot = toBuildSnapshot({ ...activeBuild, nodeAllocations: modifiedAllocations }, gameData)
  const guard = { cancelled: false }
  previewAbortRef.current = guard

  try {
    const previewSheet = await invokeCommand<StatSheet>('compute_stats', { snapshot })
    if (!guard.cancelled) {
      setPreviewStatSheet(previewSheet)
    }
  } catch {
    // IPC failure = no delta shown; correct behavior
  }
}
```

**Updated `handleHoverLeave`** — replace with:
```typescript
function handleHoverLeave() {
  setHighlightedNodeIds(null)
  previewAbortRef.current.cancelled = true
  setPreviewStatSheet(null)
}
```

**Imports to add at the top of `SuggestionsList.tsx`:**
```typescript
import { invokeCommand } from '../../shared/utils/invokeCommand'
import { toBuildSnapshot } from '../../shared/utils/buildSnapshotSerializer'
import type { StatSheet } from '../../shared/types/statSheet'
```

**Important:** `handleHoverEnter` and `handleHoverLeave` are NOT wrapped in `useCallback` — the existing code doesn't use `useCallback` for these, and adding it would require listing dependencies. Keep the pattern consistent.

### 3. `StatSheetPanel.tsx` changes

**New selector** (add after existing `isComputingStats` selector):
```typescript
const previewStatSheet = useOptimizationStore((s) => s.previewStatSheet)
```

**`computeStatDeltas` helper** (pure function, NOT exported, placed before `StatSheetPanel`):
```typescript
interface StatDeltas {
  damage_score: number
  avg_hit_damage: number
  avg_hit_damage_crit_weighted: number
  critical_strike_chance: number
  critical_strike_multiplier: number
  attack_speed: number | null
  cast_speed: number | null
  aoe_modifier: number
  effective_hp: number
  raw_hp: number
  ward: number
  endurance_percent: number
  endurance_threshold: number
  armor: number
  fire_resistance: number
  cold_resistance: number
  lightning_resistance: number
  void_resistance: number
  poison_resistance: number
  physical_resistance: number
  crit_avoidance: number
  dodge_chance: number
  score_damage: number
  score_survivability: number
  score_speed: number
  score_build: number
}

function computeStatDeltas(base: StatSheet, preview: StatSheet): StatDeltas {
  return {
    damage_score: preview.offense.damage_score - base.offense.damage_score,
    avg_hit_damage: preview.offense.avg_hit_damage - base.offense.avg_hit_damage,
    avg_hit_damage_crit_weighted: preview.offense.avg_hit_damage_crit_weighted - base.offense.avg_hit_damage_crit_weighted,
    critical_strike_chance: preview.offense.critical_strike_chance - base.offense.critical_strike_chance,
    critical_strike_multiplier: preview.offense.critical_strike_multiplier - base.offense.critical_strike_multiplier,
    attack_speed: preview.offense.attack_speed != null && base.offense.attack_speed != null
      ? preview.offense.attack_speed - base.offense.attack_speed
      : null,
    cast_speed: preview.offense.cast_speed != null && base.offense.cast_speed != null
      ? preview.offense.cast_speed - base.offense.cast_speed
      : null,
    aoe_modifier: preview.offense.aoe_modifier - base.offense.aoe_modifier,
    effective_hp: preview.defense.effective_hp - base.defense.effective_hp,
    raw_hp: preview.defense.raw_hp - base.defense.raw_hp,
    ward: preview.defense.ward - base.defense.ward,
    endurance_percent: preview.defense.endurance_percent - base.defense.endurance_percent,
    endurance_threshold: preview.defense.endurance_threshold - base.defense.endurance_threshold,
    armor: preview.defense.armor - base.defense.armor,
    fire_resistance: preview.defense.fire_resistance - base.defense.fire_resistance,
    cold_resistance: preview.defense.cold_resistance - base.defense.cold_resistance,
    lightning_resistance: preview.defense.lightning_resistance - base.defense.lightning_resistance,
    void_resistance: preview.defense.void_resistance - base.defense.void_resistance,
    poison_resistance: preview.defense.poison_resistance - base.defense.poison_resistance,
    physical_resistance: preview.defense.physical_resistance - base.defense.physical_resistance,
    crit_avoidance: preview.defense.crit_avoidance - base.defense.crit_avoidance,
    dodge_chance: preview.defense.dodge_chance - base.defense.dodge_chance,
    score_damage: preview.scores.damage_score - base.scores.damage_score,
    score_survivability: preview.scores.survivability_score - base.scores.survivability_score,
    score_speed: preview.scores.speed_score - base.scores.speed_score,
    score_build: preview.scores.build_score - base.scores.build_score,
  }
}
```

**`DeltaBadge` component** (add before `StatRow`, NOT exported):
```tsx
function DeltaBadge({ delta, unit = '' }: { delta: number; unit?: string }) {
  const sign = delta > 0 ? '+' : ''
  const color = delta > 0 ? 'var(--color-data-positive)' : 'var(--color-data-negative)'
  return (
    <span
      style={{ color, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginLeft: '0.25rem' }}
      aria-label={`${sign}${delta.toFixed(1)}${unit}`}
    >
      ({sign}{delta.toFixed(1)}{unit})
    </span>
  )
}
```

**Updated `StatRow` interface:**
```typescript
interface StatRowProps {
  label: string
  value: string
  unit?: string
  warningGap?: number
  delta?: number  // NEW: when set and non-zero, renders a DeltaBadge
}
```

**Updated `StatRow` render** — add after the `{isWarning && ...}` block:
```tsx
{delta !== undefined && delta !== 0 && (
  <DeltaBadge delta={delta} unit={unit} />
)}
```

**`deltas` derivation** in `StatSheetPanel` body (after `spentPassivePoints`):
```typescript
const deltas = previewStatSheet !== null && statSheet !== null && !isComputingStats
  ? computeStatDeltas(statSheet, previewStatSheet)
  : null
```

**Updated `StatRow` calls in the Offense tab:**
```tsx
<StatRow label="Build Score" value={statSheet ? fmt(statSheet.scores.build_score) : '—'} delta={deltas?.score_build} />
<StatRow label="Damage Score" value={statSheet ? fmt(statSheet.offense.damage_score) : '—'} delta={deltas?.damage_score} />
<StatRow label="Avg Hit" value={statSheet ? fmtInt(statSheet.offense.avg_hit_damage) : '—'} unit="" delta={deltas?.avg_hit_damage} />
<StatRow label="Avg Hit (Crit)" value={statSheet ? fmtInt(statSheet.offense.avg_hit_damage_crit_weighted) : '—'} unit="" delta={deltas?.avg_hit_damage_crit_weighted} />
<StatRow label="Crit Chance" value={statSheet ? fmt(statSheet.offense.critical_strike_chance) : '—'} unit="%" delta={deltas?.critical_strike_chance} />
<StatRow label="Crit Multi" value={statSheet ? fmt(statSheet.offense.critical_strike_multiplier) : '—'} unit="%" delta={deltas?.critical_strike_multiplier} />
<StatRow
  label="Attack Speed"
  value={statSheet?.offense.attack_speed != null ? fmt(statSheet.offense.attack_speed) : '—'}
  delta={deltas?.attack_speed ?? undefined}
/>
<StatRow
  label="Cast Speed"
  value={statSheet?.offense.cast_speed != null ? fmt(statSheet.offense.cast_speed) : '—'}
  delta={deltas?.cast_speed ?? undefined}
/>
<StatRow label="AoE Modifier" value={statSheet ? fmt(statSheet.offense.aoe_modifier) : '—'} delta={deltas?.aoe_modifier} />
```

**Updated `StatRow` calls in the Defense tab:**
```tsx
<StatRow label="Effective HP" value={statSheet ? fmtInt(statSheet.defense.effective_hp) : '—'} delta={deltas?.effective_hp} />
<StatRow label="HP" value={statSheet ? fmtInt(statSheet.defense.raw_hp) : '—'} delta={deltas?.raw_hp} />
<StatRow label="Ward" value={statSheet ? fmtInt(statSheet.defense.ward) : '—'} delta={deltas?.ward} />
<StatRow label="Armor" value={statSheet ? fmtInt(statSheet.defense.armor) : '—'} delta={deltas?.armor} />
<StatRow label="Endurance" value={statSheet ? fmt(statSheet.defense.endurance_percent) : '—'} unit="%" delta={deltas?.endurance_percent} />
<StatRow label="End. Threshold" value={statSheet ? fmtInt(statSheet.defense.endurance_threshold) : '—'} delta={deltas?.endurance_threshold} />
{RESISTANCES.map(({ field, warnType, label }) => {
  const warn = statSheet ? findWarning(statSheet.warnings, warnType) : undefined
  return (
    <StatRow
      key={field}
      label={label}
      value={statSheet ? fmt(statSheet.defense[field]) : '—'}
      unit="%"
      warningGap={warn?.gap}
      delta={deltas?.[field]}
    />
  )
})}
<StatRow label="Crit Avoidance" value={statSheet ? fmt(statSheet.defense.crit_avoidance) : '—'} unit="%" delta={deltas?.crit_avoidance} />
<StatRow label="Dodge" value={statSheet ? fmt(statSheet.defense.dodge_chance) : '—'} unit="%" delta={deltas?.dodge_chance} />
```

**Updated `StatRow` calls in the Other tab:**
```tsx
<StatRow label="Damage Score" value={statSheet ? fmt(statSheet.scores.damage_score) : '—'} delta={deltas?.score_damage} />
<StatRow label="Surv. Score" value={statSheet ? fmt(statSheet.scores.survivability_score) : '—'} delta={deltas?.score_survivability} />
<StatRow label="Speed Score" value={statSheet ? fmt(statSheet.scores.speed_score) : '—'} delta={deltas?.score_speed} />
```

**Type note:** `StatDeltas` keys for resistances use the same string as `DefenseStats` field names — `deltas?.[field]` where `field` is `ResistanceFieldKey` works because `StatDeltas` has all resistance fields. TypeScript will not raise a `noImplicitAny` error since the key types match. If it does, cast with `deltas?.[field as keyof StatDeltas] as number | undefined`.

### 4. `StatSheetPanel.tsx` test additions

In `setupMocks`, expand the `opts` parameter:
```typescript
function setupMocks(opts: {
  statSheet?: StatSheet | null
  isComputingStats?: boolean
  previewStatSheet?: StatSheet | null  // NEW
} = {}) {
  const optState = {
    statSheet: opts.statSheet ?? null,
    isComputingStats: opts.isComputingStats ?? false,
    previewStatSheet: opts.previewStatSheet ?? null,  // NEW
  }
  // ... rest unchanged
```

**New tests to add:**
```typescript
it('shows positive delta on Offense stat when previewStatSheet has higher damage_score', () => {
  const base = makeStatSheet()
  const preview = makeStatSheet({ offense: { ...makeStatSheet().offense, damage_score: 120 } })
  setupMocks({ statSheet: base, previewStatSheet: preview, isComputingStats: false })
  render(<StatSheetPanel />)
  fireEvent.click(screen.getByRole('tab', { name: 'Offense' }))
  expect(screen.getByText(/\(\+20\.0\)/)).toBeInTheDocument()
})

it('shows negative delta on Defense stat when previewStatSheet has lower effective_hp', () => {
  const base = makeStatSheet()
  const preview = makeStatSheet({ defense: { ...makeStatSheet().defense, effective_hp: 4500 } })
  setupMocks({ statSheet: base, previewStatSheet: preview, isComputingStats: false })
  render(<StatSheetPanel />)
  fireEvent.click(screen.getByRole('tab', { name: 'Defense' }))
  expect(screen.getByText(/\(-500\.0\)/)).toBeInTheDocument()
})

it('shows no delta when previewStatSheet is null', () => {
  setupMocks({ statSheet: makeStatSheet(), previewStatSheet: null })
  render(<StatSheetPanel />)
  fireEvent.click(screen.getByRole('tab', { name: 'Offense' }))
  expect(screen.queryByText(/\(\+/)).toBeNull()
  expect(screen.queryByText(/\(-/)).toBeNull()
})

it('suppresses delta when isComputingStats is true even with previewStatSheet set', () => {
  const base = makeStatSheet()
  const preview = makeStatSheet({ offense: { ...makeStatSheet().offense, damage_score: 120 } })
  setupMocks({ statSheet: base, previewStatSheet: preview, isComputingStats: true })
  render(<StatSheetPanel />)
  fireEvent.click(screen.getByRole('tab', { name: 'Offense' }))
  expect(screen.queryByText(/\(\+/)).toBeNull()
})
```

### 5. `SuggestionsList.test.tsx` additions

Add a `vi.mock` for `invokeCommand` at the top of the test file (alongside the existing Tauri event mock):
```typescript
vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn(() => Promise.resolve(null)),
}))
```

Import after mocks:
```typescript
import { invokeCommand } from '../../shared/utils/invokeCommand'
```

**New tests:**
```typescript
it('calls invokeCommand compute_stats on mouseenter when isComputingStats is false', async () => {
  useOptimizationStore.setState({
    suggestions: [makeSuggestion(1)],
    isComputingStats: false,
    isOptimizing: false,
  })
  useBuildStore.setState({ activeBuild: MOCK_BUILD })
  useGameDataStore.setState({ gameData: {} as GameData })
  render(<SuggestionsList onRetry={vi.fn()} />)
  const card = screen.getByTestId('suggestion-card-1')
  fireEvent.mouseEnter(card)
  await act(async () => {})
  expect(invokeCommand).toHaveBeenCalledWith('compute_stats', expect.objectContaining({ snapshot: expect.any(Object) }))
})

it('does NOT call invokeCommand compute_stats on mouseenter when isComputingStats is true', async () => {
  vi.mocked(invokeCommand).mockClear()
  useOptimizationStore.setState({
    suggestions: [makeSuggestion(1)],
    isComputingStats: true,
    isOptimizing: false,
  })
  useBuildStore.setState({ activeBuild: MOCK_BUILD })
  useGameDataStore.setState({ gameData: {} as GameData })
  render(<SuggestionsList onRetry={vi.fn()} />)
  const card = screen.getByTestId('suggestion-card-1')
  fireEvent.mouseEnter(card)
  await act(async () => {})
  expect(invokeCommand).not.toHaveBeenCalledWith('compute_stats', expect.anything())
})
```

You'll need `GameData` imported in the test file:
```typescript
import type { GameData } from '../../shared/types/gameData'
```

And `vi.mocked` is available from vitest — no extra import needed.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/shared/stores/optimizationStore.ts` | MODIFY | Add `previewStatSheet: StatSheet \| null` field + `setPreviewStatSheet` action; add to `clearSuggestions` reset |
| `lebo/src/features/optimization/SuggestionsList.tsx` | MODIFY | Add `previewAbortRef`; update `handleHoverEnter` (async, IPC call); update `handleHoverLeave` (cancel + clear); new imports |
| `lebo/src/features/stat-sheet/StatSheetPanel.tsx` | MODIFY | Add `previewStatSheet` selector; add `computeStatDeltas` helper; add `DeltaBadge`; update `StatRow` interface/render; pass `delta` to all numeric stat rows except General tab |
| `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` | MODIFY | Expand `setupMocks` to include `previewStatSheet`; add 4 new tests |
| `lebo/src/features/optimization/SuggestionsList.test.tsx` | MODIFY | Mock `invokeCommand`; add 2 new hover tests |

**Do not touch:**
- `shared/types/statSheet.ts` — no type changes needed
- `shared/types/optimization.ts` — `SuggestionResult` shape is unchanged
- `features/skill-tree/` — tree canvas and overlay behavior is unchanged
- Any Rust files — zero Rust changes in this story
- `useStatSheet.ts` — the live stat sheet refresh loop is unchanged

---

## Architecture & Pattern Compliance

**No new Tauri commands.** This story calls `compute_stats` on hover — this is the **same** Tauri command already used by `useStatSheet.ts`. The IPC call pattern follows `invokeCommand<StatSheet>('compute_stats', { snapshot })` exactly.

**Store pattern — four stores only.** `previewStatSheet` is added to `optimizationStore` (already the home of `statSheet`, `isComputingStats`, `nodeEfficiencies`). No new store is created.

**Props-only pattern preserved.** `StatSheetPanel` reads `previewStatSheet` from the store (it already reads `statSheet` and `isComputingStats` from the same store). This is consistent with how the stat sheet works today.

**No barrel files.** `StatSheet` type is already imported in `optimizationStore.ts` from `'../types/statSheet'`. `SuggestionsList.tsx` will import it directly from `'../../shared/types/statSheet'`.

**Tailwind v4 / CSS vars.** `DeltaBadge` uses `var(--color-data-positive)` and `var(--color-data-negative)` — same vars already used in `SuggestionCard.tsx`'s `getDeltaColor()`.

**TypeScript strict mode.** `previewAbortRef` is typed as `useRef<{ cancelled: boolean }>`. The async `handleHoverEnter` returns `Promise<void>` — assigned as an event handler where the return value is ignored (correct). `delta?: number` on `StatRow` is optional — existing call sites need no changes except adding the new `delta` prop where desired.

**`isComputingStats` race:** If `isComputingStats` becomes true AFTER the hover starts but BEFORE the IPC resolves, the result still arrives and `setPreviewStatSheet` is called. This is acceptable — the stat sheet will have a fresh `statSheet` immediately after `isComputingStats` returns to false, and `deltas` is derived from `!isComputingStats` — so any stale preview will be invisible until the next hover. This is a pre-existing edge case in the optimization flow; AC3 only requires suppression at hover start.

---

## Testing Requirements

### Verification commands

From `lebo/`:
```bash
pnpm build                                                              # Zero TypeScript errors
pnpm vitest src/features/stat-sheet/StatSheetPanel.test.tsx            # All pass (4 new + existing)
pnpm vitest src/features/optimization/SuggestionsList.test.tsx         # All pass (2 new + existing)
pnpm vitest                                                              # Full suite still green
```

---

## Dev Notes

**`handleHoverEnter` is async — this is safe.** `onMouseEnter` in React accepts `MouseEventHandler` which is `(e: MouseEvent) => void`. Assigning an `async` function here is fine because the `Promise` return is silently ignored by the DOM event system. This is a common React pattern for event handlers that perform async work.

**`previewAbortRef` pattern prevents stale results.** When the player moves quickly between suggestion cards:
1. Card A mouseenter → `guard_A = { cancelled: false }`, `previewAbortRef.current = guard_A`
2. Card A mouseleave → `guard_A.cancelled = true`, `setPreviewStatSheet(null)`
3. Card B mouseenter → `guard_B = { cancelled: false }`, `previewAbortRef.current = guard_B`
4. Card A's IPC resolves → checks `guard_A.cancelled === true` → discarded ✓
5. Card B's IPC resolves → checks `guard_B.cancelled === false` → `setPreviewStatSheet(result)` ✓

This is simpler and more correct than using `AbortController` (which doesn't cancel in-flight Tauri IPC anyway — only cancels the JS side).

**`compute_stats` is fast.** The Tauri `compute_stats` command completes in < 2ms on target hardware (per NFR-2). The user will not perceive lag between hovering a suggestion and seeing deltas appear. No debouncing is needed.

**DeltaBadge uses `delta.toFixed(1)` universally.** This works for all numeric stat sheet values:
- Float stats (damage_score, crit_chance %): shows 1 decimal, e.g. `(+5.2)`
- Integer stats (effective_hp, armor): may show `.0` suffix, e.g. `(+500.0)`. This is acceptable — the value field uses `fmtInt` (whole number) but the delta shows the decimal. If this bothers you, use `Number.isInteger(delta) ? String(delta) : delta.toFixed(1)` inside `DeltaBadge`. However, in practice, EHP/HP deltas from node allocation are often fractional due to Ward ratio math, so `.toFixed(1)` is defensible for all fields.

**`null` delta fields for attack_speed/cast_speed.** These can be `null` in both `base` and `preview`. `computeStatDeltas` returns `null` for these when either side is `null`. The `StatRow` receives `delta={deltas?.attack_speed ?? undefined}` — `null` becomes `undefined` which triggers no badge (correct: if the stat is N/A, no delta is meaningful).

**General tab has no deltas.** Character level, class, mastery, skill levels — none of these change when a passive node is allocated. Showing "delta" on them would always be `0` (no badge). Skipping deltas on the General tab is correct and avoids needless prop threading.

**Minion tab has no deltas.** The Minion tab currently shows a placeholder. No delta wiring needed.

**Pre-existing test failures.** Story 4.4 confirmed a pre-existing failure in `TreeControls.test.tsx` (`clicking RESET button calls onReset`). If it appears in your test run, ignore it — it's not introduced by this story.

**`SuggestionsList.test.tsx` `invokeCommand` mock.** The test file currently mocks `@tauri-apps/api/event`. Adding a mock for `../../shared/utils/invokeCommand` follows the same pattern. The mock returns `Promise.resolve(null)` — `null` will be passed to `setPreviewStatSheet(null)` when the guard check passes, which is fine for testing the call (not the result).

**`MOCK_BUILD` in `SuggestionsList.test.tsx`** has `schemaVersion: 1 as const`. Note from project-context: new builds use `schemaVersion: 2`. The `MOCK_BUILD` fixture is used for testing hover trigger logic only — the schema version doesn't affect whether `compute_stats` is called. Do not change the fixture.

---

## Previous Story Intelligence (from 4.4)

- **`setPreviewStatSheet` naming is free.** The 4.4 story used `setNodeEfficiencies` — `setPreviewStatSheet` follows the same `set{FieldName}` convention.
- **`clearSuggestions()` already resets many fields.** Adding `previewStatSheet: null` to the reset object is safe and expected — it's already done for `nodeEfficiencies`, `statSheet`, etc.
- **`isComputingStats` is already `false` after `clearSuggestions()`.** So clearing suggestions naturally also suppresses any residual delta display.
- **`optimizationBuildId` guard is NOT needed for preview calls.** The hover compute is on-demand and short-lived — it doesn't need the build ID guard used by the event listeners in `useOptimizationStream`. The `previewAbortRef` pattern is sufficient.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `previewStatSheet: StatSheet | null` + `setPreviewStatSheet` in `optimizationStore` and added to `clearSuggestions()` reset
- `SuggestionsList.tsx` `handleHoverEnter` refactored to async; applies node change to a cloned `nodeAllocations`, serializes snapshot via `toBuildSnapshot`, calls `invokeCommand<StatSheet>('compute_stats', { snapshot })`; uses `previewAbortRef` guard to discard stale results from fast hover moves
- `handleHoverLeave` cancels in-flight guard and calls `setPreviewStatSheet(null)` immediately
- `StatSheetPanel.tsx` gains `computeStatDeltas` pure helper, `DeltaBadge` component (green/red with `+`/`-` prefix), and `StatRow` delta prop — all wired to Offense, Defense, and Other tabs; General tab intentionally skipped
- `deltas` derived only when `previewStatSheet !== null && statSheet !== null && !isComputingStats` (AC3)
- 4 new `StatSheetPanel` tests + 2 new `SuggestionsList` hover tests; full suite 902 passed / 8 pre-existing failures (unrelated, from stories 4.3/4.4)
- Pre-existing test failures confirmed in `ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls` — none from this story

### File List

- lebo/src/shared/stores/optimizationStore.ts
- lebo/src/features/optimization/SuggestionsList.tsx
- lebo/src/features/stat-sheet/StatSheetPanel.tsx
- lebo/src/features/stat-sheet/StatSheetPanel.test.tsx
- lebo/src/features/optimization/SuggestionsList.test.tsx

---

### Review Findings

- [x] [Review][Patch] `toNodeId` allocation lacks `Math.max(0, …)` guard [SuggestionsList.tsx:handleHoverEnter] — `modifiedAllocations[toNodeId] = (modifiedAllocations[toNodeId] ?? 0) + pointsChange` has no lower bound. `fromNodeId` branch uses `Math.max(0, …)` but `toNodeId` does not. If `pointsChange` is ever ≤ 0 the allocation goes negative, producing an invalid snapshot for `compute_stats`. Fix: wrap with `Math.max(0, …)` consistent with the `fromNodeId` branch.
- [x] [Review][Patch] Missing AC2 test — `mouseleave` clearing `previewStatSheet` not covered [SuggestionsList.test.tsx] — Both new hover tests exercise only `mouseenter`. AC2 requires that mouse-off clears the stat sheet delta display. Add a test: `fireEvent.mouseLeave(card)` then assert `setPreviewStatSheet` was called with `null`.
- [x] [Review][Patch] Missing AC4 axe test with `previewStatSheet` set [StatSheetPanel.test.tsx] — The existing axe test runs with `previewStatSheet: null`, so `DeltaBadge` never renders. AC4 requires `axe(container)` passes with delta badges visible. Add an axe assertion inside the positive-delta test, or add a dedicated axe test with `previewStatSheet` set.
- [x] [Review][Defer] `isComputingStats` read from hook subscription, not `.getState()` [SuggestionsList.tsx:handleHoverEnter] — `activeBuild` and `gameData` use `.getState()` (always fresh), but `isComputingStats` uses a hook closure value. In practice the window where these diverge is zero (Zustand re-renders synchronously); spec dev notes acknowledge the post-hover race as acceptable. Inconsistency worth aligning if concurrent mode is ever adopted. — deferred, pre-existing pattern acceptable per spec
- [x] [Review][Defer] `clearSuggestions()` resets store but does not cancel `previewAbortRef` [optimizationStore.ts + SuggestionsList.tsx] — An in-flight hover IPC can resolve after suggestions are cleared and write a non-null `previewStatSheet` back into the store. `statSheet` is also null after a clear so `deltas` won't render, making this benign. — deferred, benign in current flow
- [x] [Review][Defer] AC5 stale-guard behavior untested [SuggestionsList.test.tsx] — The `previewAbortRef` guard pattern (hover A → hover B before A resolves → A discarded) has no automated test. Requires Promise control fixtures to test. — deferred, complex async test setup
