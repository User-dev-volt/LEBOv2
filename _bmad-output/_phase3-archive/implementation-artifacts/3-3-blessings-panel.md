---
title: 'Blessings Panel'
story_id: '3.3'
story_key: '3-3-blessings-panel'
epic: 3
status: done
created: '2026-05-22'
---

## Story

**As a player,**
I want to assign monolith blessings from a searchable panel with one blessing per timeline, with blessing contributions flowing into the stat sheet in real time,
**So that** my actual blessings are modeled in the scoring engine and included in optimization suggestions.

> **Quick Dev candidate** — Searchable dropdown + stat contribution via `BuildSnapshot`. Use `/bmad-quick-dev` instead of the full CS → DS → CR cycle.

---

## Context

This story is pure front-end + thin Rust wiring. The infrastructure is already 90% in place:

- `BuildState.blessings?: Record<string, string | null>` is defined in `shared/types/build.ts` (keyed by `timelineId`)
- `buildStore.createBuild` already initializes `blessings: {}` (no schema migration needed)
- `BuildSnapshot.blessings: Vec<String>` is defined in `src-tauri/scoring-core/src/build_snapshot.rs`
- `buildSnapshotSerializer.ts` line 55 has `blessings: []` with the comment `// Epic 3.3 adds BuildState.blessings` — replace this stub
- `BlessingsDatabase`, `BlessingEntry`, `StatEffect` TypeScript types are in `shared/types/contextDatabase.ts`
- `gameDataStore.blessingsDatabase`, `isBlessingsDataStale`, `blessingsDataStaleAcknowledged`, etc. are already in `shared/stores/gameDataStore.ts`
- `context_data_service::load_blessings_from_dir` exists and is already wired in `src-tauri/src/services/context_data_service.rs`
- `BlessingsDatabase`, `BlessingEntry`, `StatEffect` Rust types exist in `src-tauri/src/models/context_data.rs`

**What this story adds:**
1. `setBlessing` action in `buildStore.ts`
2. Fill in the `blessings` stub in `buildSnapshotSerializer.ts`
3. New `BlessingsPanel.tsx` component
4. Add Blessings Disclosure to `ContextPanel.tsx`
5. Rust: `GameData.blessing_effects` + loader + `build_registry` processing

**What this story does NOT touch:**
- `shared/types/build.ts` — `blessings` field already present
- `shared/types/contextDatabase.ts` — types already correct
- `shared/stores/gameDataStore.ts` — blessings fields already present
- Any existing context-data loading infrastructure

---

## Acceptance Criteria

**Given** the context panel with the Blessings section open
**When** the player views it
**Then** all monolith timelines are listed, each with a searchable dropdown for selecting one blessing
**And** selecting a blessing from one timeline does not affect other timelines' selections

**Given** the blessing search field in any timeline dropdown
**When** a player types "critical"
**Then** only blessings with "critical" in their name or description are shown (case-insensitive)

**Given** a blessing selected from a timeline that provides +14% fire resistance (e.g., `rod-dragon-scale`)
**When** that blessing is active
**Then** the Defense tab's fire resistance value increases by 14%
**And** the `BuildSnapshot` includes the blessing ID for `compute_stats`

**Given** a player who deselects a previously selected blessing
**When** the blessing is removed
**Then** the stat sheet removes its contribution immediately
**And** the optimization payload no longer includes the blessing's effect

**Given** a stale blessings database detected by the staleness check system
**When** the app displays the blessings panel
**Then** an inline staleness notice is visible within the panel
**And** the blessing selection remains functional with current data while the update is pending

---

## Tasks / Subtasks

- [x] Task 1: Add `setBlessing` action to `buildStore.ts` (AC: blessings state management)
  - [x] Add interface declaration
  - [x] Add implementation following `updateIdolAffix` pattern
- [x] Task 2: Fill blessings stub in `buildSnapshotSerializer.ts` + serializer tests (AC: snapshot includes active blessings)
  - [x] Replace `blessings: []` stub with Object.values filter
  - [x] Add 2 serializer tests to `buildSnapshotSerializer.test.ts`
- [x] Task 3: Create `BlessingsPanel.tsx` + `BlessingsPanel.test.tsx` (AC: all 5 ACs)
  - [x] Implement BlessingsPanel component with timeline grouping, per-timeline search, staleness notice
  - [x] Write 12 unit tests
- [x] Task 4: Update `ContextPanel.tsx` + `ContextPanel.test.tsx` (AC: panel integration)
  - [x] Add Blessings Disclosure section after Idols
  - [x] Add `blessings: {}` to mockBuild + 2 new tests
- [x] Task 5: Add `blessing_effects` field to `GameData` in `game_data.rs` (AC: Rust type system)
- [x] Task 6: Load blessings in `game_data_loader.rs` + extend `stat_key_from_str` (AC: blessing stat contribution)
  - [x] Add 6 missing stat key arms to `stat_key_from_str`
  - [x] Add blessings loading block
  - [x] Add `blessing_effects` to `Ok(GameData{...})`
- [x] Task 7: Add blessing loop in `build_registry` in `compute.rs` + 2 Rust tests (AC: stat sheet reflects blessings)

---

## Technical Requirements

### 1. TypeScript — Add `setBlessing` action (`shared/stores/buildStore.ts`)

Add to `BuildStore` interface:
```typescript
setBlessing: (timelineId: string, blessingId: string | null) => void
```

Add implementation (follow the `updateIdolAffix` pattern):
```typescript
setBlessing: (timelineId, blessingId) =>
  set((s) =>
    s.activeBuild
      ? {
          activeBuild: {
            ...s.activeBuild,
            blessings: {
              ...(s.activeBuild.blessings ?? {}),
              [timelineId]: blessingId,
            },
            isPersisted: false,
            updatedAt: new Date().toISOString(),
          },
        }
      : {}
  ),
```

`blessingId = null` clears the selection for that timeline. `blessingId = 'some-id'` selects it. The `blessings` record always has one key per timeline that the player has interacted with; unvisited timelines simply have no key (treated as no selection).

### 2. TypeScript — Fill `blessings` stub in `buildSnapshotSerializer.ts`

Replace line 55:
```typescript
blessings: [],            // Epic 3.3 adds BuildState.blessings
```
with:
```typescript
blessings: Object.values(build.blessings ?? {}).filter((id): id is string => id !== null),
```

This converts `Record<string, string | null>` → `string[]` of active blessing IDs. Only non-null values are included. The Rust side receives `Vec<String>` of active IDs.

### 3. TypeScript — New Component (`features/blessings/BlessingsPanel.tsx`)

Create `lebo/src/features/blessings/BlessingsPanel.tsx`.

**Data flow:**
- `blessingsDatabase: BlessingEntry[]` from `useGameDataStore((s) => s.blessingsDatabase ?? [])`
- `isBlessingsDataStale`, `blessingsDataStaleAcknowledged`, `acknowledgeBlessingsDataStaleness` from `useGameDataStore`
- `blessings: Record<string, string | null>` from `useBuildStore((s) => s.activeBuild?.blessings ?? {})`
- `setBlessing` from `useBuildStore`

**Timeline grouping (useMemo, stable reference):**
```typescript
const timelineGroups = useMemo(() => {
  const map = new Map<string, { timelineName: string; entries: BlessingEntry[] }>()
  for (const b of blessingsDatabase) {
    if (!map.has(b.timelineId)) {
      map.set(b.timelineId, { timelineName: b.timelineName, entries: [] })
    }
    map.get(b.timelineId)!.entries.push(b)
  }
  return Array.from(map.entries()).map(([id, v]) => ({ timelineId: id, ...v }))
}, [blessingsDatabase])
```

**Per-timeline search (local state per row):**
Each timeline row has its own `searchTerm` string. Filter logic:
```typescript
const filtered = entries.filter(
  (b) =>
    b.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.statEffects.some((e) => e.statKey.toLowerCase().includes(searchTerm.toLowerCase()))
)
```

**Structure per timeline row:**
```tsx
<div key={timelineId} className="mb-2">
  <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
    {timelineName}
  </p>
  <input
    type="text"
    placeholder="Search…"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    aria-label={`Search blessings for ${timelineName}`}
    className="w-full text-xs rounded px-1.5 py-0.5"
    style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
  />
  <select
    value={selectedId ?? ''}
    onChange={(e) => setBlessing(timelineId, e.target.value || null)}
    aria-label={`Select blessing for ${timelineName}`}
    className="w-full text-xs rounded px-1 py-0.5 mt-0.5"
    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
  >
    <option value="">— None —</option>
    {filtered.map((b) => (
      <option key={b.id} value={b.id}>
        {b.displayName}
      </option>
    ))}
  </select>
  {/* Selected blessing stat effect summary */}
  {selectedBlessing && (
    <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
      {selectedBlessing.statEffects
        .map((e) => `${e.modifierType === 'increased' ? '+' : ''}${e.value}% ${e.statKey.replace(/_/g, ' ')}`)
        .join(', ')}
    </p>
  )}
</div>
```

**Staleness indicator (inline, follows existing item-data banner style but smaller):**
```tsx
{isBlessingsDataStale && !blessingsDataStaleAcknowledged && (
  <div
    role="status"
    aria-live="polite"
    className="flex items-center justify-between px-2 py-1 rounded text-xs mb-2"
    style={{ backgroundColor: 'var(--color-accent-gold-soft)', color: 'var(--color-bg-base)' }}
  >
    <span>Blessings data may be outdated</span>
    <button
      onClick={acknowledgeBlessingsDataStaleness}
      aria-label="Dismiss blessings staleness notice"
      className="opacity-75 hover:opacity-100 ml-2"
    >
      Dismiss
    </button>
  </div>
)}
```

**When `blessingsDatabase` is empty** (loading or unavailable):
```tsx
if (blessingsDatabase.length === 0) {
  return (
    <p className="text-xs" style={{ color: 'var(--color-text-muted)', padding: '4px 0' }}>
      Blessings data not loaded.
    </p>
  )
}
```

**No barrel file** — named export `export function BlessingsPanel()`. No `index.ts` created.

**Component accesses stores directly** — it does NOT receive blessings data via props (unlike `IdolAffixPicker` which is a presentational child). `BlessingsPanel` is a feature component, consistent with how `GearInput` and `SkillInput` access stores directly.

### 4. TypeScript — Update `ContextPanel.tsx`

Add import:
```typescript
import { BlessingsPanel } from '../blessings/BlessingsPanel'
```

Add `blessingsCount` selector:
```typescript
const blessings = useBuildStore((s) => s.activeBuild?.blessings ?? {})
const activeBlessingsCount = Object.values(blessings).filter((v) => v !== null).length
```

Add Blessings Disclosure section (after Idols section, follows the same pattern):
```tsx
<div data-testid="context-section-blessings">
  <Disclosure>
    <DisclosureButton
      className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
      style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
    >
      <span>Blessings</span>
      <span style={{ color: 'var(--color-text-muted)' }}>{activeBlessingsCount} active</span>
    </DisclosureButton>
    <DisclosurePanel>
      <BlessingsPanel />
    </DisclosurePanel>
  </Disclosure>
</div>
```

### 5. Rust — Add `blessing_effects` to `GameData` (`scoring-core/src/game_data.rs`)

Add field to `GameData`:
```rust
/// Blessing ID → scoring effects. Populated by `game_data_loader.rs` from blessings.json.
/// Reuses NodeEffect (stat_key, modifier_type, value, condition: Always) — same fields apply.
pub blessing_effects: HashMap<String, Vec<NodeEffect>>,
```

`GameData` derives `Default` — `blessing_effects` defaults to `HashMap::new()` automatically.

`NodeEffect` is already imported in `game_data.rs` (it's defined in this file). `HashMap` is already imported via `use std::collections::HashMap`. No new imports needed.

### 6. Rust — Load blessings in `game_data_loader.rs`

Add import at the top (alongside the existing `IdolAffixEffect`):
```rust
use scoring_core::game_data::{..., NodeEffect};
```
(Check the existing import line and add `NodeEffect` to it if not already there.)

After the idol-affixes loading block (before `Ok(GameData { ... })`), add:

```rust
// Load blessing scoring effects from blessings.json
let blessings_db = super::context_data_service::load_blessings_from_dir(&data_dir)
    .map_err(|e| format!("blessings load failed: {e}"))?;
let mut blessing_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
for blessing in &blessings_db {
    let mut effects: Vec<NodeEffect> = Vec::new();
    for stat_effect in &blessing.stat_effects {
        if let Some(stat_key) = stat_key_from_str(&stat_effect.stat_key) {
            let modifier_type = parse_modifier_type(Some(&stat_effect.modifier_type));
            effects.push(NodeEffect {
                stat_key,
                modifier_type,
                value: stat_effect.value,
                condition: Condition::Always,
            });
        }
        // Unknown stat_key → silently skipped (same pattern as idol affixes)
    }
    if !effects.is_empty() {
        blessing_effects.insert(blessing.id.clone(), effects);
    }
}
```

Update the `Ok(GameData { ... })` return to include `blessing_effects`:
```rust
Ok(GameData {
    node_effects,
    archetype_weights,
    class_base_stats,
    idol_affixes,
    blessing_effects,   // ← ADD
})
```

**Extend `stat_key_from_str` for blessing-only stat keys** (these are in `blessings.json` but were NOT in idol-data.json):

Add these arms to the existing `stat_key_from_str` match:
```rust
"increased_lightning_damage" => Some(StatKey::IncreasedLightningDamage),
"necrotic_resistance"        => Some(StatKey::NecroticResistance),
"hp_regen_per_sec"           => Some(StatKey::HpRegenPerSec),
"freeze_rate_multiplier"     => Some(StatKey::FreezeRateMultiplier),
"ward_on_hit"                => Some(StatKey::WardOnHit),
"ignite_duration"            => Some(StatKey::IgniteDuration),
```

All six target `StatKey` variants already exist in `scoring-core/src/modifier.rs`. No new enum variants needed.

**`data_dir` for blessings** — same `data_dir` as idol data (already resolved at the top of `build_scoring_game_data`). Use `super::context_data_service::load_blessings_from_dir(&data_dir)`, exactly matching the pattern for `load_idol_data_from_dir`.

### 7. Rust — Register blessing modifiers in `compute.rs` `build_registry`

After the idol affix loop, add:

```rust
// Blessing modifiers — each active blessing contributes its stat effects
for blessing_id in &snapshot.blessings {
    if let Some(effects) = game_data.blessing_effects.get(blessing_id) {
        for effect in effects {
            registry.add(Modifier {
                stat_key: effect.stat_key.clone(),
                modifier_type: effect.modifier_type.clone(),
                value: effect.value,
                condition: Condition::Always,
                source: blessing_id.clone(),
            });
        }
    }
    // Unknown blessing_id → silently skipped
}
```

No imports needed beyond what's already in `compute.rs` — `Modifier`, `Condition`, `ModifierRegistry` are already imported.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/shared/stores/buildStore.ts` | MODIFY | Add `setBlessing` action to interface + implementation |
| `lebo/src/shared/utils/buildSnapshotSerializer.ts` | MODIFY | Fill in blessings stub (line 55) |
| `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` | MODIFY | Add blessings serialization test |
| `lebo/src/features/blessings/BlessingsPanel.tsx` | CREATE | New feature component |
| `lebo/src/features/blessings/BlessingsPanel.test.tsx` | CREATE | Unit tests |
| `lebo/src/features/context-panel/ContextPanel.tsx` | MODIFY | Add Blessings Disclosure section |
| `lebo/src/features/context-panel/ContextPanel.test.tsx` | MODIFY | Add `context-section-blessings` test + count test |
| `lebo/src-tauri/scoring-core/src/game_data.rs` | MODIFY | Add `blessing_effects` field to `GameData` |
| `lebo/src-tauri/src/services/game_data_loader.rs` | MODIFY | Load blessings; extend `stat_key_from_str`; add `blessing_effects` to `Ok(GameData{...})` |
| `lebo/src-tauri/scoring-core/src/compute.rs` | MODIFY | Add blessing loop in `build_registry` + Rust test |

**Do not touch:**
- `shared/types/build.ts` — `blessings` field already present
- `shared/types/contextDatabase.ts` — types already correct
- `shared/stores/gameDataStore.ts` — all blessings fields already present
- `features/game-data/DataStalenessBar.tsx` — staleness shown inline in BlessingsPanel
- `src-tauri/src/services/context_data_service.rs` — `load_blessings_from_dir` already exists
- `src-tauri/src/models/context_data.rs` — Rust models already correct
- `src-tauri/scoring-core/src/build_snapshot.rs` — `blessings: Vec<String>` already present
- `src-tauri/scoring-core/src/modifier.rs` — no new StatKey variants needed

---

## Architecture & Pattern Compliance

**Pattern 1** — `buildSnapshotSerializer.ts` is the only conversion point. `BlessingsPanel` calls only `setBlessing` store action. The rAF debounce in `useStatSheet` fires `compute_stats` automatically — `BlessingsPanel` never calls `invokeCommand` directly.

**Pattern 2** — `BuildSnapshot.blessings` is `Vec<String>` (camelCase input `blessings`). No Rust struct change needed — field already exists with correct `#[serde(default)]`.

**Pattern 3** — `build_registry` in `compute.rs` is sync (no await). Blessing lookup is a simple hash lookup, no issue with lock duration.

**No barrel files** — `BlessingsPanel.tsx` is a named export, no `index.ts`.

**No new Zustand stores** — Four stores only. `BlessingsPanel` reads from `useGameDataStore` and `useBuildStore` directly (same pattern as `GearInput` and `SkillInput`).

**Store initialization** — `buildStore.createBuild` already sets `blessings: {}`. If `blessings` is undefined on an existing saved build (loaded from disk), `build.blessings ?? {}` handles it at every access point. No migration needed.

---

## Previous Story Intelligence (from 3.2)

**Key patterns established:**
- Idol affix components that access stores: `IdolGrid.tsx` reads from stores directly; presentational children (`IdolAffixPicker`) receive everything via props. `BlessingsPanel` is a feature-level component, so it reads stores directly (same as `GearInput`/`SkillInput`/`IdolGrid`).
- `onBlur` + `onChange` race on `<select>` was fixed in 3.1 — use functional state updates (`(prev) => ...`) when updating state inside callbacks.
- Test mocks use `vi.mock(...)` with `vi.fn()` — NOT `vi.mocked()`. Follow `StatSheetPanel.test.tsx` and `IdolGrid.test.tsx` patterns exactly.
- `ContextPanel.test.tsx` mock build uses `idolGrid: []` — add `blessings: {}` to the `mockBuild` in `ContextPanel.test.tsx` to avoid accessing undefined fields.
- The `stat_key_from_str` function in `game_data_loader.rs` has 28 arms for idol affixes. For blessings, 6 additional arms are needed (see Technical Requirements §6).

**From 3.2 deferred issues:**
- Story 3.2 review note: `stat_key_from_str` has 28 arms (one extra vs. the 27 expected). This is pre-existing and harmless — don't remove it.

---

## Blessings Data Reference

The `blessings.json` file is at `src-tauri/resources/context-data/blessings.json`.

**Stat keys used in blessings.json that ARE already in `stat_key_from_str`:**
`cold_resistance`, `life_leech_percent`, `armor`, `max_hp_percent`, `cast_speed`, `increased_fire_damage`, `fire_resistance`, `dodge_rating`, `void_resistance`, `max_hp`, `movement_speed`, `increased_void_damage`, `critical_strike_chance`, `lightning_resistance`, `critical_strike_multiplier`, `increased_physical_damage`, `increased_minion_damage`, `increased_cold_damage`, `poison_resistance`, `all_resistances`, `increased_spell_damage`, `increased_damage`

**Stat keys used in blessings.json NOT yet in `stat_key_from_str` (must add in this story):**

| statKey in JSON | StatKey enum variant | Notes |
|---|---|---|
| `increased_lightning_damage` | `StatKey::IncreasedLightningDamage` | Already in StatKey enum |
| `necrotic_resistance` | `StatKey::NecroticResistance` | Already in StatKey enum |
| `hp_regen_per_sec` | `StatKey::HpRegenPerSec` | Already in StatKey enum |
| `freeze_rate_multiplier` | `StatKey::FreezeRateMultiplier` | Phase 4 ailment — in StatKey enum |
| `ward_on_hit` | `StatKey::WardOnHit` | Already in StatKey enum |
| `ignite_duration` | `StatKey::IgniteDuration` | Phase 4 ailment — in StatKey enum |

All 6 variants already exist in `modifier.rs`. This story adds them to `stat_key_from_str` only.

**Note:** Some blessing stat effects (e.g., `freeze_rate_multiplier`, `ignite_duration`) target Phase 4 stat keys. The scoring engine will register these as modifiers but they won't affect the Phase 3 stat sheet output — the `compute_offense`/`compute_defense` functions simply don't query those stat keys yet. This is correct and expected behavior: the registry absorbs them silently.

---

## Testing Requirements

### `BlessingsPanel.test.tsx`

Mock setup pattern (follow `IdolGrid.test.tsx` and `ContextPanel.test.tsx`):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlessingsPanel } from './BlessingsPanel'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { BlessingEntry } from '../../shared/types/contextDatabase'
import axe from 'vitest-axe'

const mockBlessings: BlessingEntry[] = [
  {
    id: 'bfd-twisted-memory',
    timelineId: 'blood-frost-death',
    timelineName: 'Blood, Frost, and Death',
    displayName: 'Twisted Memory',
    statEffects: [{ statKey: 'increased_cold_damage', value: 30, modifierType: 'increased' }],
  },
  {
    id: 'bfd-bone-armor',
    timelineId: 'blood-frost-death',
    timelineName: 'Blood, Frost, and Death',
    displayName: 'Bone Armor',
    statEffects: [{ statKey: 'armor', value: 120, modifierType: 'flat' }],
  },
  {
    id: 'aow-gift-of-winter',
    timelineId: 'age-of-winter',
    timelineName: 'The Age of Winter',
    displayName: 'Gift of Winter',
    statEffects: [{ statKey: 'cold_resistance', value: 18, modifierType: 'flat' }],
  },
]
```

**Tests:**

1. **Renders empty state when no blessings database** — shows "Blessings data not loaded." when `blessingsDatabase` is `null` or empty
2. **Renders timeline headers** — shows "Blood, Frost, and Death" and "The Age of Winter" when database is set
3. **Renders dropdown per timeline** — each timeline has a `<select>` with `— None —` + its blessings as `<option>` entries
4. **Selecting a blessing calls setBlessing** — `fireEvent.change(select, { target: { value: 'bfd-twisted-memory' } })` triggers `setBlessing('blood-frost-death', 'bfd-twisted-memory')`
5. **Selecting "None" calls setBlessing with null** — `fireEvent.change(select, { target: { value: '' } })` triggers `setBlessing('blood-frost-death', null)`
6. **Shows selected blessing stat summary** — when a blessing is active, shows a summary of its stat effects
7. **Search filters visible options** — typing "armor" in the search input for "Blood, Frost, and Death" hides "Twisted Memory" and shows "Bone Armor"
8. **Search is case-insensitive** — typing "ARMOR" also matches "Bone Armor"
9. **Staleness banner shows when stale** — when `isBlessingsDataStale: true` and `blessingsDataStaleAcknowledged: false`, staleness text is visible
10. **Staleness banner hidden when acknowledged** — when `blessingsDataStaleAcknowledged: true`, no staleness text
11. **Dismiss button calls acknowledgeBlessingsDataStaleness** — clicking Dismiss triggers the store action
12. **Accessibility** — `expect(await axe(container)).toHaveNoViolations()`

### `buildSnapshotSerializer.test.ts` additions

Add test: `blessings serialization`:
```typescript
it('includes active blessing IDs in snapshot', () => {
  const build = makeBuild({
    blessings: {
      'blood-frost-death': 'bfd-twisted-memory',
      'age-of-winter': null,         // deselected → excluded
      'reign-of-dragons': 'rod-dragonfire',
    },
  })
  const snapshot = toBuildSnapshot(build, minimalGameData)
  expect(snapshot.blessings).toHaveLength(2)
  expect(snapshot.blessings).toContain('bfd-twisted-memory')
  expect(snapshot.blessings).toContain('rod-dragonfire')
  expect(snapshot.blessings).not.toContain(null)
})

it('returns empty blessings array when blessings is undefined', () => {
  const build = makeBuild({ blessings: undefined })
  const snapshot = toBuildSnapshot(build, minimalGameData)
  expect(snapshot.blessings).toEqual([])
})
```

### `ContextPanel.test.tsx` additions

1. Add `blessings: {}` to `mockBuild` object (prevents potential undefined access)
2. Add test: `renders context-section-blessings` — `expect(screen.getByTestId('context-section-blessings')).toBeInTheDocument()`
3. Add test: `shows blessings count as "0 active" when none selected` — `expect(screen.getByText('0 active')).toBeInTheDocument()`

### Rust unit test (add to `compute.rs` test module)

```rust
#[test]
fn blessing_fire_resistance_contributes() {
    use std::collections::HashMap;
    use crate::game_data::{GameData, NodeEffect};
    use crate::modifier::{Condition, ModifierType, StatKey};

    let mut blessing_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
    blessing_effects.insert(
        "rod-dragon-scale".to_string(),
        vec![NodeEffect {
            stat_key: StatKey::FireResistance,
            modifier_type: ModifierType::Flat,
            value: 18.0,
            condition: Condition::Always,
        }],
    );
    let game_data = GameData {
        blessing_effects,
        archetype_weights: standard_weight_table(),
        ..Default::default()
    };
    let mut snapshot = snapshot_at(50);
    snapshot.blessings.push("rod-dragon-scale".to_string());

    let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
    assert!(
        (sheet.defense.fire_resistance - 18.0).abs() < 0.01,
        "expected fire_resistance 18.0, got {}",
        sheet.defense.fire_resistance
    );
}

#[test]
fn unknown_blessing_id_silently_skipped() {
    let game_data = GameData {
        archetype_weights: standard_weight_table(),
        ..Default::default()
    };
    let mut snapshot = snapshot_at(50);
    snapshot.blessings.push("nonexistent-blessing".to_string());
    // Should not panic
    let _sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
}
```

---

## Verification Commands

From `lebo/`:
```bash
pnpm build        # zero TypeScript errors
pnpm vitest       # all new tests pass; 855+ pre-existing tests still pass (0 new regressions)
cargo test -p scoring-core   # all Rust tests pass including new blessing tests
cargo build                  # clean build (Tauri crate + scoring-core)
```

Expected test baseline: 855 TS passed (from 3.2 final) + new tests. 8 pre-existing failures remain (not introduced by this story).

---

## Dev Notes

- **`setBlessing` with null** vs. deleting the key: the implementation uses `[timelineId]: null` (keeps the key with null value). The serializer filters out null values with `.filter((id): id is string => id !== null)`. Do NOT delete keys from the blessings record — null is the "explicitly deselected" state vs. "never visited".
- **`blessingsDatabase` loading timing**: the database is loaded at startup by the existing context-data loading infrastructure (from `App.tsx`). `BlessingsPanel` guards against `blessingsDatabase.length === 0` — safe on first render.
- **Per-timeline search state**: use an array or object of search strings keyed by `timelineId`, initialized lazily. Example: `const [searchTerms, setSearchTerms] = useState<Record<string, string>>({})`. Access: `searchTerms[timelineId] ?? ''`. Update: `setSearchTerms((prev) => ({ ...prev, [timelineId]: value }))`.
- **Blessing stat contribution in Rust**: blessings arrive as `Vec<String>` of active IDs. The `blessing_effects` HashMap maps each ID to `Vec<NodeEffect>`. Lookup is `O(1)` per blessing. The loop in `build_registry` is short (≤ 10 active blessings possible) — no performance concern.
- **`load_blessings_from_dir` path**: uses the SAME `data_dir` variable as `load_idol_data_from_dir` in `game_data_loader.rs`. This is already resolved at the top of `build_scoring_game_data` via `game_data_service::ensure_game_data_dir`. No new path resolution needed.
- **`NodeEffect` import in `game_data_loader.rs`**: currently the existing import line is `use scoring_core::game_data::{ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, GameData, IdolAffixEffect, NodeEffect}`. The `NodeEffect` is already imported (used in `parse_node_effects`). Just add `blessing_effects` to the `GameData` struct and the `Ok(GameData{...})` return. No new import needed.
- **`Condition` import in `game_data_loader.rs`**: `Condition::Always` is used in `parse_node_effects`. The import `use scoring_core::modifier::{Condition, ModifierType, StatKey}` already includes `Condition`. Adding blessing effects uses the same `Condition::Always` — no new import needed.
- **Accessibility**: timeline `<select>` elements each need `aria-label={`Select blessing for ${timelineName}`}`. Search inputs need `aria-label`. The "— None —" option provides a clear "clear selection" affordance (selecting it passes `null` to `setBlessing`).

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 7 tasks completed. 871 TS tests passing (16 new), 8 pre-existing failures unchanged. 29 Rust tests passing (2 new). Zero TypeScript errors. Clean `cargo build`.
- `setBlessing` follows `updateIdolAffix` pattern: sets `[timelineId]: blessingId`, null means deselected.
- `BlessingsPanel` uses sub-component `TimelineRow` to isolate per-timeline `useState(searchTerm)`.
- Blessing stat keys `increased_lightning_damage`, `necrotic_resistance`, `hp_regen_per_sec`, `freeze_rate_multiplier`, `ward_on_hit`, `ignite_duration` added to `stat_key_from_str` — all had matching `StatKey` variants already.
- `blessing_effects` reuses `NodeEffect` struct (same fields as passive nodes, condition always `Always`).

### File List

- `lebo/src/shared/stores/buildStore.ts` — MODIFIED: added `setBlessing` action
- `lebo/src/shared/utils/buildSnapshotSerializer.ts` — MODIFIED: filled blessings stub
- `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` — MODIFIED: added 2 blessings serialization tests
- `lebo/src/features/blessings/BlessingsPanel.tsx` — CREATED: new feature component
- `lebo/src/features/blessings/BlessingsPanel.test.tsx` — CREATED: 12 unit tests
- `lebo/src/features/context-panel/ContextPanel.tsx` — MODIFIED: added Blessings Disclosure section
- `lebo/src/features/context-panel/ContextPanel.test.tsx` — MODIFIED: added blessings to mockBuild + 2 new tests
- `lebo/src-tauri/scoring-core/src/game_data.rs` — MODIFIED: added `blessing_effects` field to `GameData`
- `lebo/src-tauri/src/services/game_data_loader.rs` — MODIFIED: added blessing loading + 6 stat key arms + `blessing_effects` to return
- `lebo/src-tauri/scoring-core/src/compute.rs` — MODIFIED: added blessing loop in `build_registry` + 2 Rust tests

### Review Findings

- [x] [Review][Patch] Flat modifier stat summary always appends `%` regardless of `modifierType` [lebo/src/features/blessings/BlessingsPanel.tsx:75]
- [x] [Review][Patch] Dismiss button focus ring uses wrong color token (`var(--color-bg-base)` instead of `var(--color-accent-gold)`) [lebo/src/features/blessings/BlessingsPanel.tsx:127-128]
- [x] [Review][Defer] Search filtering leaves stale select value when selected blessing is filtered out [lebo/src/features/blessings/BlessingsPanel.tsx:53-65] — deferred, UX confusion only, no data corruption
- [x] [Review][Defer] `Modifier` in `build_registry` may be missing `source: blessing_id.clone()` [lebo/src-tauri/scoring-core/src/compute.rs:~78] — deferred, code builds and tests pass; verify before Epic 4
- [x] [Review][Defer] Rust test `blessing_fire_resistance_contributes` fragile if base stats non-zero [lebo/src-tauri/scoring-core/src/compute.rs:~1234] — deferred, pre-existing test pattern
