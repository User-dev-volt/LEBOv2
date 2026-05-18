# Story 7.5: Structured Gear Context in Optimization Payload

Status: done

## Story

As a theory-crafter,
I want gear I've set using the item database (with specific affix tiers) to flow into the AI optimization request as structured data, so the AI can reference specific affix values in its suggestions,
So that suggestions like "your T4 Health roll already covers the defensive floor" become possible.

## Acceptance Criteria

**AC1 — Populated-database slots included in structuredGear:**
Given one or more gear slots are in "populated-database" state (i.e., `contextData.gear[n].affixes` has entries where `affixId !== undefined` AND `tier !== undefined`),
when `startOptimization()` constructs the optimization payload,
then each such slot appears in a `structuredGear: StructuredGearSlot[]` array with: `{ slot: slotId, itemName, affixes: [{ name, tier, value }] }` where `value` is resolved from the item database (`Math.round((tierEntry.minValue + tierEntry.maxValue) / 2)`) (FR31).

**AC2 — Free-text / legacy slots in structuredGear with empty affixes:**
Given a gear slot has `itemName !== ''` AND `affixes` is empty (free-text mode) OR all affixes lack `affixId` (Phase 1 legacy),
when `startOptimization()` constructs the payload,
then that slot appears in `structuredGear` as `{ slot: slotId, itemName, affixes: [] }` — no tier, no value. Its Phase 1 textual content (`itemName`) is already in `build_state.contextData.gear` which Rust passes through as-is (FR32).

**AC3 — Empty slots excluded:**
Given a gear slot has `itemName === ''`,
when `startOptimization()` constructs the payload,
then that slot is excluded from `structuredGear`. If all slots are empty, `structuredGear: null` is passed.

**AC4 — Rust prompt includes gearContext string:**
Given `invoke_claude_api` receives a non-null `structured_gear: Option<Vec<StructuredGearSlot>>`,
when the user_message JSON is assembled,
then a `"gearContext"` string field is included, formatted as:
`"Helmet: Runed Skullcap — Health T4 (+280), Armor T2 (+120); Body: Juggernaut Plate — Endurance T3 (+240)"`
- Slots separated by `"; "`
- Database items: `"{slot}: {itemName} — {affixList}"` where each affix is `"{name} T{tier} (+{value:.0})"` if value present, else `"{name} T{tier}"`
- Free-text items: `"{slot}: {itemName}"` (no dash, no affixes)
When `structured_gear` is `None`, `"gearContext": null` in the JSON.

**AC5 — TypeScript types defined:**
`StructuredGearAffix` and `StructuredGearSlot` interfaces added to `src/shared/types/optimization.ts`:
```ts
export interface StructuredGearAffix {
  name: string
  tier?: number
  value?: number
}

export interface StructuredGearSlot {
  slot: string
  itemName: string
  affixes: StructuredGearAffix[]
}
```

**AC6 — Rust structs defined:**
`StructuredGearAffix` and `StructuredGearSlot` Rust structs added in `claude_commands.rs` with `#[serde(rename_all = "camelCase")]`. `invoke_claude_api` accepts `structured_gear: Option<Vec<StructuredGearSlot>>` after `level_context`.

**AC7 — No streaming regression:**
Streaming behavior is identical to Phase 1: events, before/after scoring, suggestion rendering all unchanged (FR39, FR40, NFR4).

**AC8 — Tests updated:**
Three new tests in `useOptimizationStream.test.ts`:
1. Database gear → `structuredGear` has entries with resolved `value` (via item DB tier midpoint)
2. Free-text gear → `structuredGear` has entry with `affixes: []`
3. Empty gear → `structuredGear: null`
Global `useGameDataStore` mock updated to include `itemDatabase: null` so existing 14 tests remain green.

## Tasks / Subtasks

- [x] Task 1: Add TypeScript types (AC5)
  - [x] 1.1: In `lebo/src/shared/types/optimization.ts`, append after `LevelContext` interface:
    ```ts
    export interface StructuredGearAffix {
      name: string
      tier?: number
      value?: number
    }

    export interface StructuredGearSlot {
      slot: string
      itemName: string
      affixes: StructuredGearAffix[]
    }
    ```

- [x] Task 2: Build `structuredGear` in `startOptimization()` and pass to Rust (AC1, AC2, AC3)
  - [x] 2.1: In `lebo/src/shared/stores/useOptimizationStream.ts`, add import at top:
    ```ts
    import type { LevelContext, StructuredGearAffix, StructuredGearSlot } from '../types/optimization'
    ```
    (`useGameDataStore` is already imported at line 9)
  - [x] 2.2: In `startOptimization()`, after the `levelContext` block (after line 52, before `clearSuggestions()`), insert:
    ```ts
    const itemDatabase = useGameDataStore.getState().itemDatabase
    const gearItems = activeBuild.contextData?.gear ?? []
    const populatedGear = gearItems.filter((g) => g.itemName !== '')
    const structuredGear: StructuredGearSlot[] | null = populatedGear.length > 0
      ? populatedGear.map((g): StructuredGearSlot => {
          const dbAffixes = g.affixes.filter((a) => a.affixId !== undefined && a.tier !== undefined)
          if (!itemDatabase || dbAffixes.length === 0) {
            return { slot: g.slotId, itemName: g.itemName, affixes: [] }
          }
          const affixes: StructuredGearAffix[] = dbAffixes.map((a) => {
            const entry = itemDatabase.affixes.find((e) => e.id === a.affixId)
            const tierEntry = entry?.tiers.find((t) => t.tier === a.tier)
            const value = tierEntry
              ? Math.round((tierEntry.minValue + tierEntry.maxValue) / 2)
              : undefined
            return { name: a.name, tier: a.tier, value }
          })
          return { slot: g.slotId, itemName: g.itemName, affixes }
        })
      : null
    ```
  - [x] 2.3: Add `structuredGear` to the `invokeCommand` call (alongside `levelContext`):
    ```ts
    await invokeCommand('invoke_claude_api', {
      buildState: activeBuild,
      sliderPosition,
      fineTuneWeights,
      levelContext,
      structuredGear,
    })
    ```

- [x] Task 3: Add Rust structs and update command signature (AC6)
  - [x] 3.1: In `lebo/src-tauri/src/commands/claude_commands.rs`, add below the `LevelContext` struct (after line 21):
    ```rust
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct StructuredGearAffix {
        name: String,
        tier: Option<u32>,
        value: Option<f64>,
    }

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct StructuredGearSlot {
        slot: String,
        item_name: String,
        affixes: Vec<StructuredGearAffix>,
    }
    ```
  - [x] 3.2: Add `structured_gear: Option<Vec<StructuredGearSlot>>` to `invoke_claude_api` after `level_context`:
    ```rust
    pub async fn invoke_claude_api(
        app_handle: tauri::AppHandle,
        build_state: Value,
        slider_position: f32,
        fine_tune_weights: Option<FineTuneWeights>,
        level_context: Option<LevelContext>,
        structured_gear: Option<Vec<StructuredGearSlot>>,
    ) -> Result<(), String> {
    ```

- [x] Task 4: Add `build_gear_context` helper and wire into user_message (AC4)
  - [x] 4.1: In `claude_commands.rs`, add after `build_level_constraints` fn (after line 213):
    ```rust
    fn build_gear_context(slots: &[StructuredGearSlot]) -> String {
        slots
            .iter()
            .map(|slot| {
                if slot.affixes.is_empty() {
                    format!("{}: {}", slot.slot, slot.item_name)
                } else {
                    let affixes_str: Vec<String> = slot
                        .affixes
                        .iter()
                        .map(|a| match (a.tier, a.value) {
                            (Some(t), Some(v)) => format!("{} T{} (+{:.0})", a.name, t, v),
                            (Some(t), None) => format!("{} T{}", a.name, t),
                            _ => a.name.clone(),
                        })
                        .collect();
                    format!("{}: {} — {}", slot.slot, slot.item_name, affixes_str.join(", "))
                }
            })
            .collect::<Vec<_>>()
            .join("; ")
    }
    ```
  - [x] 4.2: In `invoke_claude_api`, after `let level_constraints = ...` (line 123), add:
    ```rust
    let gear_context = structured_gear.as_deref().map(build_gear_context);
    ```
  - [x] 4.3: Update the `json!({...})` user_message to include `"gearContext"`:
    ```rust
    let user_message = serde_json::to_string(&json!({
        "optimizationIntent": optimization_intent,
        "levelConstraints": level_constraints,
        "gearContext": gear_context,
        "build": build_state,
        "availableNodes": available_nodes
    }))
    ```

- [x] Task 5: Run `cargo check` (prerequisite for Task 6)
  - [x] 5.1: Run `cd lebo && cargo check --manifest-path src-tauri/Cargo.toml` — fix any compile errors before proceeding.

- [x] Task 6: Update tests (AC8)
  - [x] 6.1: Update global `useGameDataStore` mock in test file to include `itemDatabase: null`:
    ```ts
    vi.mock('./gameDataStore', () => ({
      useGameDataStore: {
        getState: vi.fn(() => ({
          gameData: { classes: {}, manifest: { schemaVersion: 1, gameVersion: '1.0', dataVersion: '1.0', generatedAt: '2026-01-01', classes: [] } },
          itemDatabase: null,
        })),
      },
    }))
    ```
  - [x] 6.2: Add import for `useGameDataStore` after the existing imports (after `import { useBuildStore }` line):
    ```ts
    import { useGameDataStore } from './gameDataStore'
    ```
  - [x] 6.3: Add test — database gear resolves structuredGear with values:
    ```ts
    it('startOptimization passes structuredGear with resolved values for database-sourced gear', async () => {
      vi.mocked(useGameDataStore.getState).mockReturnValueOnce({
        gameData: { classes: {}, manifest: { schemaVersion: 1, gameVersion: '1.0', dataVersion: '1.0', generatedAt: '2026-01-01', classes: [] } },
        itemDatabase: {
          affixes: [{
            id: 'health_prefix',
            name: 'Health',
            type: 'prefix' as const,
            itemSlots: ['helmet'],
            tiers: [{ tier: 4, minValue: 260, maxValue: 300 }],
          }],
          baseItems: [],
          uniqueItems: [],
        },
      } as ReturnType<typeof useGameDataStore.getState>)

      vi.mocked(useBuildStore.getState).mockReturnValueOnce({
        activeBuild: {
          id: 'test',
          name: 'Test',
          classId: 'sentinel',
          masteryId: 'void_knight',
          schemaVersion: 2 as const,
          budgetEnforced: false,
          characterLevel: 1,
          nodeAllocations: {},
          activeSkillLevels: {},
          skillNodeAllocations: {},
          weaverAllocations: {},
          contextData: {
            gear: [{
              slotId: 'helmet',
              itemName: 'Runed Skullcap',
              affixes: [{ affixId: 'health_prefix', name: 'Health', tier: 4 }],
            }],
            skills: [],
            idols: [],
          },
          isPersisted: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      } as ReturnType<typeof useBuildStore.getState>)

      await act(async () => { await startOptimization() })

      expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
        structuredGear: [{
          slot: 'helmet',
          itemName: 'Runed Skullcap',
          affixes: [{ name: 'Health', tier: 4, value: 280 }], // Math.round((260+300)/2)
        }],
      }))
    })
    ```
  - [x] 6.4: Add test — free-text gear produces structuredGear with empty affixes:
    ```ts
    it('startOptimization passes structuredGear with empty affixes for free-text gear', async () => {
      vi.mocked(useBuildStore.getState).mockReturnValueOnce({
        activeBuild: {
          id: 'test',
          name: 'Test',
          classId: 'sentinel',
          masteryId: 'void_knight',
          schemaVersion: 2 as const,
          budgetEnforced: false,
          characterLevel: 1,
          nodeAllocations: {},
          activeSkillLevels: {},
          skillNodeAllocations: {},
          weaverAllocations: {},
          contextData: {
            gear: [{ slotId: 'body', itemName: 'Some good chest piece', affixes: [] }],
            skills: [],
            idols: [],
          },
          isPersisted: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      } as ReturnType<typeof useBuildStore.getState>)

      await act(async () => { await startOptimization() })

      expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
        structuredGear: [{ slot: 'body', itemName: 'Some good chest piece', affixes: [] }],
      }))
    })
    ```
  - [x] 6.5: Add test — empty gear produces `structuredGear: null`:
    ```ts
    it('startOptimization passes structuredGear: null when all gear slots are empty', async () => {
      // Default mock has contextData: { gear: [], skills: [], idols: [] }
      await act(async () => { await startOptimization() })

      expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
        structuredGear: null,
      }))
    })
    ```
  - [x] 6.6: Run `pnpm vitest src/shared/stores/useOptimizationStream.test.ts` — all 17 tests must pass.

## Dev Notes

### Data flow summary

TypeScript reads `contextData.gear` (array of `GearItemV2`) from `activeBuild`, classifies each slot (database vs free-text vs empty), and resolves affix values from `itemDatabase` before sending `structuredGear` to Rust. Rust receives it as `Option<Vec<StructuredGearSlot>>` and formats it into the `"gearContext"` prompt field. No new Tauri commands, no new stores, no IPC round-trips beyond what already exists.

### Distinguishing database vs free-text gear

There is no dedicated "mode" field on `GearItemV2`. The distinction is inferred from affix data:
- **Database-sourced**: `affixes` array has entries where **both** `affixId !== undefined` AND `tier !== undefined` (set by `buildAffixEntries()` in `GearSlot.tsx`)
- **Free-text (GearSlot textarea mode)**: `affixes === []`, `itemName` contains the typed text
- **Legacy Phase 1 affixes (GearInput.tsx)**: affixes have `name` but no `affixId` — treated as free-text path (no tier/value to resolve)
- **Empty**: `itemName === ''` (result of `handleClear()`) — excluded from `structuredGear`

Filter condition for "database affixes": `a.affixId !== undefined && a.tier !== undefined`.

### Value resolution formula

`value = Math.round((tierEntry.minValue + tierEntry.maxValue) / 2)`

This is the tier midpoint, representing the "average roll" for that tier. It matches the AC example: Health T4 with `[260, 300]` → `Math.round((260+300)/2) = 280` → displays as `+280`.

If the item database is null (not loaded) or the affix/tier entry can't be found, `value` is `undefined` and Rust formats the affix as `"{name} T{tier}"` without a value.

### Rust parameter ordering

New params follow `level_context` in the Tauri command signature. Tauri command parameter names use `snake_case` in Rust and `camelCase` in TypeScript (Tauri's `#[tauri::command]` rename convention). So `structured_gear` (Rust) ↔ `structuredGear` (TypeScript). No `lib.rs` changes needed — adding a parameter to an already-registered command doesn't require re-registering.

### `build_gear_context` Rust helper placement

Place it after `build_level_constraints` (currently the last private fn at line 194). It follows the same pattern — takes a slice reference, returns a formatted String.

### Slot label vs slotId

The `slotId` values (`'helmet'`, `'body'`, `'gloves'`, etc.) are used directly as the `slot` field sent to Rust and formatted into the prompt. These are already human-readable. The slot labels from `GEAR_SLOTS` (e.g., `'Body'`, `'Off-hand'`) are only used in the UI; the prompt uses the raw slotId.

### No system prompt changes needed

The existing `OPTIMIZATION_SYSTEM_PROMPT` in `prompts.rs` refers to the "build context" and node suggestions. The user_message JSON now has `"gearContext"` when gear is populated — the AI will see this structured data and use it for affix-level reasoning. Leave `prompts.rs` untouched.

### No `lib.rs` changes needed

`invoke_claude_api` is already registered in `lib.rs`. Adding `structured_gear` as a new parameter does not require touching `invoke_handler!`.

### `contextData` null guard

Use `activeBuild.contextData?.gear ?? []` (optional chaining + nullish coalesce) to guard against theoretically null/undefined contextData on older persisted builds. This matches the defensive pattern used for `nodeAllocations` and `activeSkillLevels` in the 7-4 implementation.

### TypeScript strict mode: imports

`useOptimizationStream.ts` will import `StructuredGearAffix` and `StructuredGearSlot` from `'../types/optimization'`. Both are type-only imports — prefer `import type`. The `useGameDataStore` import is already present at line 9; no additional import needed for the store itself.

### Test: `mockReturnValueOnce` override pattern

Both `useBuildStore.getState` and `useGameDataStore.getState` are declared as `vi.fn(() => {...})` in the module mock — `mockReturnValueOnce` overrides the factory return for one call only, then reverts to the default mock. This is the established pattern (used in the level-context tests from 7-4).

### Value edge case: affixId found but tier not found

If the affix entry exists in `itemDatabase.affixes` but the specific tier number isn't in `entry.tiers`, `tierEntry` will be `undefined` and `value` will be `undefined`. Rust will format the affix as `"{name} T{tier}"` (no value shown). This is safe and graceful.

### Project Structure Notes

Files to **MODIFY**:

| File | Change |
|------|--------|
| `lebo/src/shared/types/optimization.ts` | Add `StructuredGearAffix` and `StructuredGearSlot` interfaces |
| `lebo/src/shared/stores/useOptimizationStream.ts` | Import new types; add `structuredGear` computation in `startOptimization()`; add to `invokeCommand` call |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | Update `useGameDataStore` mock to add `itemDatabase: null`; add import for `useGameDataStore`; add 3 new tests |
| `lebo/src-tauri/src/commands/claude_commands.rs` | Add `StructuredGearAffix`/`StructuredGearSlot` structs; add `structured_gear` param; add `build_gear_context` fn; include `"gearContext"` in user_message JSON |

Files to **NOT touch**:
- `lebo/src-tauri/src/lib.rs` — no changes needed
- `lebo/src-tauri/src/services/prompts.rs` — no changes needed
- `lebo/src/shared/stores/optimizationStore.ts` — no changes needed
- `lebo/src/shared/types/build.ts` — `GearItemV2` and `AffixEntryV2` already have all needed fields; `value?: number` is reserved but NOT set here (populated at optimization time in `startOptimization()`)
- `lebo/src/features/item-database/GearSlot.tsx` — no changes needed; the `value` field comment ("story 7-5 will resolve min/max from the item DB at prompt-build time") confirms this story's approach
- `lebo/src/features/context-panel/gearData.ts` — slot IDs already correct for use as prompt labels
- Any component files — this story is purely data-pipeline; no UI changes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.5] — ACs, user story, `StructuredGearSlot` payload structure, FR31/FR32/FR41 requirements
- [Source: lebo/src/shared/types/build.ts:9-23] — `AffixEntryV2` and `GearItemV2` types; `affixId?/tier?/value?` fields and the story 7-5 reservation comment
- [Source: lebo/src/features/item-database/GearSlot.tsx:50-58] — `buildAffixEntries()` sets `affixId` and `tier`; `value` intentionally omitted (this story resolves it)
- [Source: lebo/src/features/item-database/GearSlot.tsx:183-195] — free-text path writes `{ slotId, itemName: e.target.value, affixes: [] }` (how to detect free-text vs database gear)
- [Source: lebo/src/features/context-panel/gearData.ts:1-12] — `GEAR_SLOTS` with slotId/label mapping; slotIds are the prompt labels
- [Source: lebo/src/shared/types/itemDatabase.ts:1-5] — `AffixTier { tier, minValue, maxValue }` — `value = Math.round((min+max)/2)`
- [Source: lebo/src/shared/stores/gameDataStore.ts:27-28] — `itemDatabase: ItemDatabase | null` on store state
- [Source: lebo/src/shared/stores/useOptimizationStream.ts:36-69] — `startOptimization()` current state; new code inserts between lines 52 and 54 (after levelContext block, before clearSuggestions)
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:12-21] — `LevelContext` struct pattern to follow for new Rust structs
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:29-35] — current `invoke_claude_api` signature; `structured_gear` goes after `level_context`
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:121-130] — user_message assembly; `"gearContext"` slot goes between `"levelConstraints"` and `"build"`
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:194-213] — `build_level_constraints` fn pattern; `build_gear_context` follows same placement (directly after)
- [Source: lebo/src/shared/stores/useOptimizationStream.test.ts:44-50] — gameDataStore mock to update with `itemDatabase: null`
- [Source: lebo/src/shared/stores/useOptimizationStream.test.ts:291-332] — 7-4 level-context tests; `mockReturnValueOnce` pattern to follow for new tests
- [Source: _bmad-output/implementation-artifacts/7-4-level-budget-aware-ai-optimization-context.md#Dev Notes] — confirms `invoke_claude_api` param additions don't require `lib.rs` changes; camelCase↔snake_case Tauri param renaming behaviour; `#[serde(rename_all = "camelCase")]` required on nested structs

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 tasks and subtasks implemented exactly as specified.
- StructuredGearAffix and StructuredGearSlot TypeScript interfaces added to optimization.ts after LevelContext.
- startOptimization() now classifies gear slots: database-sourced (affixId+tier present) → resolves midpoint value; free-text (affixes empty) → empty affixes array; empty (itemName='') → excluded. structuredGear is null when all slots are empty.
- Rust: StructuredGearAffix/StructuredGearSlot structs with #[serde(rename_all = "camelCase")] added; structured_gear parameter added after level_context; build_gear_context helper formats slots into prompt string with em-dash separator; gearContext included in user_message JSON.
- cargo check passed clean (0 errors, 0 warnings).
- 17 tests pass: 14 existing (no regressions) + 3 new structuredGear tests (database gear value resolution, free-text empty affixes, null for empty slots).

### File List

- lebo/src/shared/types/optimization.ts
- lebo/src/shared/stores/useOptimizationStream.ts
- lebo/src/shared/stores/useOptimizationStream.test.ts
- lebo/src-tauri/src/commands/claude_commands.rs

### Review Findings

- [x] [Review][Patch] `itemDatabase === null` drops ALL affix data instead of preserving name+tier without value [`lebo/src/shared/stores/useOptimizationStream.ts`]
- [x] [Review][Defer] Affix name sourced from build storage (`a.name`) rather than canonical DB entry name — pre-existing data design, not caused by this story

## Change Log

- 2026-05-18: Story 7-5 implemented — structured gear context in optimization payload. Added StructuredGearAffix/StructuredGearSlot types (TS + Rust), gear classification and value resolution in startOptimization(), build_gear_context Rust helper, gearContext field in user_message JSON. 17 tests pass.
- 2026-05-18: Code review — 1 patch, 1 deferred, 13 dismissed.
