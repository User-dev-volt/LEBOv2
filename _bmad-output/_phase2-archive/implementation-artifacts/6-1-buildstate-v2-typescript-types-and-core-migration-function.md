# Story 6.1: BuildState v2 TypeScript Types and Core Migration Function

Status: done

## Story

As a developer,
I want the TypeScript types for `GearItemV2` and `AffixEntryV2`, and a `migrateBuildState` function that converts Phase 1 v1 saves to v2 schema without data loss,
so that the entire Phase 2 feature set can rely on a consistent BuildState structure.

## Acceptance Criteria

**AC1 — New v2 type definitions in `build.ts`:**
Given the Phase 1 gear type `GearItem = { slotId: string; itemName: string; affixes: string[] }`,
when the v2 TypeScript interfaces are added to `src/shared/types/build.ts`,
then the file exports:
- `AffixEntryV2 = { affixId?: string; name: string; tier?: number; value?: number }`
- `GearItemV2 = { slotId: string; itemId?: string; itemName: string; affixes: AffixEntryV2[] }`
- `BuildState.schemaVersion` becomes `1 | 2` (union type, not literal `1`)
- `BuildState.contextData.gear` becomes `GearItemV2[]` (v2 gear is the canonical store shape)

**AC2 — v1 → v2 migration: free-text affixes converted:**
Given a v1 build with `gear: [{ slotId: 'chest', itemName: 'Plate', affixes: ['Health', 'Armor'] }]`,
when `migrateBuildState(rawJson)` runs,
then the result is:
```
gear: [{ slotId: 'chest', itemName: 'Plate', affixes: [
  { name: 'Health', tier: undefined, value: undefined },
  { name: 'Armor', tier: undefined, value: undefined }
] }]
schemaVersion: 2
```

**AC3 — v1 → v2 migration: null/undefined gear coerced:**
Given a v1 build with `gear: null` or `gear: undefined` or `gear` field entirely absent,
when `migrateBuildState` runs,
then `contextData.gear` is coerced to `[]` and `schemaVersion` is set to `2`; no error thrown.

**AC4 — v1 → v2 migration: empty affixes array preserved:**
Given a v1 build with `gear: [{ slotId: 'helm', itemName: 'Crown', affixes: [] }]`,
when `migrateBuildState` runs,
then the result preserves `affixes: []` (no AffixEntryV2 objects) and sets `schemaVersion: 2`.

**AC5 — Idempotency: v2 builds pass through unchanged:**
Given a v2 build (schemaVersion: 2) with `affixes` already as `AffixEntryV2[]`,
when `migrateBuildState` runs,
then the build is returned unchanged — `schemaVersion` remains `2`, `affixes` are not double-converted (NFR18, FR54).

**AC6 — `migrateBuildState` location and Rust boundary:**
`migrateBuildState` remains in `src/features/build-manager/buildPersistence.ts`; all migration logic is TypeScript-only; Rust continues to store and retrieve raw JSON with no schema awareness.

## Tasks / Subtasks

- [x] Task 1: Update `src/shared/types/build.ts` with v2 types (AC1)
  - [x] 1.1: Add `AffixEntryV2` interface: `{ affixId?: string; name: string; tier?: number; value?: number }`
  - [x] 1.2: Add `GearItemV2` interface: `{ slotId: string; itemId?: string; itemName: string; affixes: AffixEntryV2[] }` (keep `GearItem` for backward reference — migration reads it as input shape)
  - [x] 1.3: Change `BuildState.schemaVersion` from literal `1` to union `1 | 2`
  - [x] 1.4: Change `BuildState.contextData.gear` from `GearItem[]` to `GearItemV2[]` (canonical store type is v2 post-migration)

- [x] Task 2: Update `migrateBuildState` in `buildPersistence.ts` (AC2, AC3, AC4, AC5, AC6)
  - [x] 2.1: Add v2 idempotency guard: if `obj.schemaVersion === 2`, return the build as-is with `schemaVersion: 2`
  - [x] 2.2: In the v1 path, convert `contextData.gear` from raw string-affixes to `GearItemV2[]`:
    - Coerce null/undefined/missing gear to `[]`
    - For each gear slot: map `affixes: string[]` → `AffixEntryV2[]` using `name => ({ name, tier: undefined, value: undefined })`
    - Preserve `slotId`, `itemName`; set `itemId: undefined`
  - [x] 2.3: Set `schemaVersion: 2` in the returned build for all v1 inputs
  - [x] 2.4: Update `return` statement in `migrateBuildState` to use `GearItemV2[]` for `contextData.gear`

- [x] Task 3: Update tests in `buildPersistence.test.ts` (AC1–AC5)
  - [x] 3.1: Update existing test `expect(result.schemaVersion).toBe(1)` → `toBe(2)` (v1 input now migrates to v2)
  - [x] 3.2: Add migration test: v1 build with string affixes produces correct `AffixEntryV2[]` objects (AC2)
  - [x] 3.3: Add migration test: null gear coerced to `[]`, schemaVersion set to 2 (AC3)
  - [x] 3.4: Add migration test: empty `affixes: []` preserved as empty `AffixEntryV2[]` (AC4)
  - [x] 3.5: Add idempotency test: v2 build passes through `migrateBuildState` unchanged (AC5)
  - [x] 3.6: `mockBuild` fixture `schemaVersion: 1` is valid for `1 | 2` union; `gear: []` is valid for `GearItemV2[]` — no fixture change needed

## Dev Notes

### CRITICAL: `slotId` vs `slot` Field Name Discrepancy

The epics file and architecture doc both specify `GearItemV2.slot: string` (using `slot`). However, the **existing `GearItem` interface in `build.ts` uses `slotId: string`**. The existing codebase uses `slotId` throughout (buildStore, context panel, etc.).

**Decision: Use `slotId` in `GearItemV2`** to maintain consistency with the existing codebase. A field rename to `slot` would require touching dozens of files and is out of scope for this story. The migration function maps `slotId → slotId` (no rename needed). If a future story renames the field, it can be a dedicated refactor.

### CRITICAL: `build.ts` Not `buildState.ts`

The epics AC says types go in `src/shared/types/buildState.ts` — this is incorrect. The project's existing build types live in `src/shared/types/build.ts`. Add the new interfaces to the **existing `build.ts`** file. Do NOT create a new `buildState.ts` file (no barrel files rule; and it would be a second home for build types that already live in `build.ts`).

### CRITICAL: Existing Test Will Break — Must Fix

The existing test in `buildPersistence.test.ts` asserts:
```typescript
it('passes through a valid schemaVersion 1 object', () => {
  const result = migrateBuildState({ ...mockBuild })
  expect(result.schemaVersion).toBe(1)  // ← MUST change to toBe(2)
```
After this story, v1 inputs migrate to v2. This test must change to `toBe(2)`. The test name should also be updated to reflect the new behavior (e.g., "migrates a schemaVersion 1 build to schemaVersion 2").

### CRITICAL: `mockBuild` in Tests Uses v1 Shape

The `mockBuild` fixture is currently:
```typescript
const mockBuild: BuildState = {
  schemaVersion: 1,
  contextData: { gear: [], skills: [], idols: [] },
  ...
}
```

After Task 1.3/1.4, `BuildState.schemaVersion` becomes `1 | 2` and `gear` becomes `GearItemV2[]`. The `mockBuild` fixture with `schemaVersion: 1` and `gear: []` is **still valid** — `GearItemV2[]` is compatible with `[]`. But the type annotation `BuildState` will now accept both `1` and `2`, so no fixture change is strictly required. Do check that TypeScript strict mode doesn't flag anything.

### Current `migrateBuildState` Implementation

The current function (in `buildPersistence.ts:6-43`) always hardcodes `schemaVersion: 1` and doesn't transform the gear affixes. It does set up all other fields with sensible defaults. The v2 migration is an additive change on top of the existing field-defaulting logic.

The cleanest approach is:
1. Extract all the existing field defaults (the `return { schemaVersion: 1, id: ..., ... }` block)
2. Add a v2 idempotency check at the top
3. Add the gear conversion for v1 inputs before the return

Concrete structure:
```typescript
export function migrateBuildState(raw: unknown): BuildState {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('STORAGE_ERROR: invalid build data')
  }
  const obj = raw as Record<string, unknown>

  // Idempotency: v2 builds pass through unchanged
  if (obj.schemaVersion === 2) {
    return {
      ...obj,
      schemaVersion: 2,
      // re-apply existing defaults for safety (handles partial v2 saves)
      id: String(obj.id ?? crypto.randomUUID()),
      // ... all other fields with their existing defaults ...
      contextData: {
        gear: (obj.contextData as any)?.gear ?? [],
        skills: (obj.contextData as any)?.skills ?? [],
        idols: (obj.contextData as any)?.idols ?? [],
      },
      isPersisted: true,
    } as BuildState
  }

  // v1 → v2: migrate gear affixes from string[] to AffixEntryV2[]
  const rawGear = (obj.contextData as any)?.gear
  const migratedGear: GearItemV2[] = Array.isArray(rawGear)
    ? rawGear.map((slot: any) => ({
        slotId: String(slot.slotId ?? slot.slot ?? ''),
        itemId: slot.itemId,
        itemName: String(slot.itemName ?? ''),
        affixes: Array.isArray(slot.affixes)
          ? slot.affixes.map((a: unknown) =>
              typeof a === 'string'
                ? { name: a, tier: undefined, value: undefined }
                : (a as AffixEntryV2)
            )
          : [],
      }))
    : []

  return {
    schemaVersion: 2,
    id: String(obj.id ?? crypto.randomUUID()),
    name: String(obj.name ?? ''),
    classId: String(obj.classId ?? ''),
    masteryId: String(obj.masteryId ?? ''),
    characterLevel: typeof obj.characterLevel === 'number' ? obj.characterLevel : 1,
    budgetEnforced: typeof obj.budgetEnforced === 'boolean' ? obj.budgetEnforced : false,
    nodeAllocations: ...,
    // ... all other existing field defaults unchanged ...
    contextData: {
      gear: migratedGear,
      skills: ...,
      idols: ...,
    },
    isPersisted: true,
    createdAt: ...,
    updatedAt: ...,
  }
}
```

Note the `slot.slotId ?? slot.slot ?? ''` fallback — handles both field names in case any Phase 1 data happened to use `slot` instead of `slotId`. This is defensive, not required.

### TypeScript Strict Mode Warning

`noUnusedLocals` and `noUnusedParameters` are enforced. After adding `GearItemV2` and `AffixEntryV2` to `build.ts`, they must be used somewhere immediately (imported in `buildPersistence.ts`) or the build will fail. Import both new types in `buildPersistence.ts` as part of Task 2.

### No New Files

This story creates NO new files. All changes are:
- `lebo/src/shared/types/build.ts` (types)
- `lebo/src/features/build-manager/buildPersistence.ts` (migration function)
- `lebo/src/features/build-manager/buildPersistence.test.ts` (tests)

No new Rust commands. No store changes. No UI changes.

### Downstream Compatibility

After this story, `BuildState.contextData.gear` is `GearItemV2[]`. Any existing code that reads `gear` and treats affixes as strings will now get `AffixEntryV2[]` objects. Check the context panel and optimization payload code — they likely use `gear` today. 

Currently, `contextData` is used in optimization prompts and displayed via the context panel. Since `GearItemV2.affixes` is `AffixEntryV2[]` instead of `string[]`, any code doing `gear.affixes.join(', ')` or similar will need to handle the new type. **Audit this now** — if any consumer of `gear.affixes` exists and treats them as strings, you must update it in this story to avoid TypeScript strict mode errors.

Run `grep -r "\.affixes" lebo/src` to find all affix consumers before you write a line of code.

### Previous Story Learnings (from 5-6)

- **Store reset pattern in tests:** `useBuildStore.setState(initialBuildState, true)` in `beforeEach` — already established. Follow the same pattern for any new store-touching tests.
- **No `vi.useFakeTimers()` conflicts:** This story has no async timers, so no timer conflicts expected.
- **Mock pattern:** `vi.mock('../../shared/utils/invokeCommand', () => ({ invokeCommand: vi.fn() }))` — already in `buildPersistence.test.ts`. No new mocks needed for migration tests (migration is pure TypeScript, no IPC).

### Testing Patterns to Follow

Migration tests are **pure unit tests** — no store, no mocks, no async:
```typescript
describe('migrateBuildState — v2 migration', () => {
  it('migrates v1 string affixes to AffixEntryV2 objects', () => {
    const raw = {
      schemaVersion: 1,
      id: 'x',
      name: 'Test',
      contextData: {
        gear: [{ slotId: 'chest', itemName: 'Plate', affixes: ['Health', 'Armor'] }],
        skills: [],
        idols: [],
      },
    }
    const result = migrateBuildState(raw)
    expect(result.schemaVersion).toBe(2)
    expect(result.contextData.gear[0].affixes).toEqual([
      { name: 'Health', tier: undefined, value: undefined },
      { name: 'Armor', tier: undefined, value: undefined },
    ])
  })
})
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1] — ACs, user story
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 3] — v2 schema definition, migration logic, `migrateBuildState` pseudocode
- [Source: lebo/src/shared/types/build.ts] — existing GearItem and BuildState types to extend
- [Source: lebo/src/features/build-manager/buildPersistence.ts] — current `migrateBuildState` to update (lines 6–43)
- [Source: lebo/src/features/build-manager/buildPersistence.test.ts] — existing tests to update + new tests to add
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — no barrel files, strict TypeScript, no new stores

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 ACs satisfied. `AffixEntryV2` and `GearItemV2` added to `build.ts`; `BuildState.schemaVersion` is now `1 | 2`; `contextData.gear` is `GearItemV2[]`.
- `migrateBuildState` updated: idempotency guard for v2 builds, v1→v2 gear conversion with string-to-`AffixEntryV2` mapping and null/undefined coercion.
- `migrateBuildState` now always returns `schemaVersion: 2` for v1 inputs.
- Downstream consumers updated for TypeScript strict-mode compliance: `buildStore.ts`, `GearInput.tsx`, `GearSlot.tsx` (replaced `buildAffixStrings` with `buildAffixEntries` returning `AffixEntryV2[]`).
- All downstream tests updated: `buildStore.test.ts`, `GearInput.test.tsx`, `GearSlot.test.tsx`.
- 0 new TypeScript errors introduced (27 pre-existing errors in unrelated `AffixTierControl.test.tsx`).
- 136 tests pass across all 4 modified test files; 8 pre-existing unrelated test failures unchanged.

### File List

- lebo/src/shared/types/build.ts
- lebo/src/shared/stores/buildStore.ts
- lebo/src/shared/stores/buildStore.test.ts
- lebo/src/features/build-manager/buildPersistence.ts
- lebo/src/features/build-manager/buildPersistence.test.ts
- lebo/src/features/context-panel/GearInput.tsx
- lebo/src/features/context-panel/GearInput.test.tsx
- lebo/src/features/item-database/GearSlot.tsx
- lebo/src/features/item-database/GearSlot.test.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-1-buildstate-v2-typescript-types-and-core-migration-function.md

### Review Findings

- [x] [Review][Defer] `value` field intentionally absent from `buildAffixEntries` — deferred to story 7-5 (structured gear context in optimization payload). `AffixEntryV2.value?: number` cannot represent the old min–max range anyway; `affixId + tier` is sufficient for 7-5 to reconstruct full values from the item DB. Patch applied: clarifying comments added to `buildAffixEntries` and `AffixEntryV2.value` so future devs don't repeat this debate.
- [x] [Review][Patch] Unsafe non-string affix object cast without `name` validation — fixed: non-string objects without a valid `name` string now coerce to `{ name: '', tier: undefined, value: undefined }`. [`buildPersistence.ts:63-68`]
- [x] [Review][Patch] No guard for unknown schemaVersion (> 2) — fixed: throws `STORAGE_ERROR: unknown schemaVersion N` for any numeric version outside `[1, 2]`. [`buildPersistence.ts`]
- [x] [Review][Patch] v2 passthrough test missing `affixId` coverage — fixed: added tests for affixId passthrough, unknown schemaVersion throw, and nameless object affix coercion. [`buildPersistence.test.ts`]
- [x] [Review][Defer] v2 passthrough gear items not structurally validated — `schemaVersion === 2` branch casts gear/skills/idols without field-level validation; a corrupted v2 build passes through silently [`buildPersistence.ts:46-54`] — deferred, pre-existing trust assumption; full validation layer is out of scope for this story
- [x] [Review][Defer] AC5 "unchanged" letter vs. intent — `sharedFields` re-applies `String(...)` coercions even for v2 passthrough; spec says "returned unchanged" but auditor notes this is a spec-intent deviation not a functional bug [`buildPersistence.ts`] — deferred, low impact
- [x] [Review][Defer] `AffixEntryV2.value` semantics undocumented — no invariant on whether `value` is min, max, or resolved scalar; will cause divergent interpretations across codebase [`build.ts`] — deferred, document in a future story
- [x] [Review][Defer] `GearSlot.test.tsx` hardcodes `tier: 3` — assertion depends on game data fixture stability; if median tier calculation changes the test fails for the wrong reason [`GearSlot.test.tsx:282`] — deferred, pre-existing test fragility
- [x] [Review][Patch] `characterLevel` bounds validation — fixed post-review: `migrateBuildState` now clamps to `[1, MAX_CHARACTER_LEVEL]`. UI was already clamping; disk-load path is now also protected. 2 tests added. [`buildPersistence.ts:20`, `buildPersistence.test.ts`]
- [x] [Review][Defer] `tier: 0` possible from `medianTier` when tiers array is empty [`GearSlot.tsx:buildAffixEntries`] — deferred, pre-existing GearSlot concern
- [x] [Review][Defer] `isPersisted: true` hardcoded in `sharedFields` — can't distinguish freshly-constructed from loaded builds [`buildPersistence.ts`] — deferred, pre-existing behavior
- [x] [Review][Defer] `GearItem` kept with no deprecation marker or removal plan — creates dead type alongside `GearItemV2` [`build.ts`] — deferred, intentional per dev notes; schedule removal in a future cleanup story

### Change Log
