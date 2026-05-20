# Story 1.1: Game Data Type Extension & Schema Definition

Status: ready-for-dev

## Story

As a developer,
I want the TypeScript types and JSON schemas extended to include `modifierType`, `scope`, and `damageType` fields on nodes and affixes, plus defined schemas for the three new game databases,
so that subsequent data ingestion and scoring engine stories have a stable contract to build against.

## Acceptance Criteria

1. **Given** the TypeScript type definitions in `shared/types/gameData.ts`
   **When** a developer imports the passive node and affix types
   **Then** passive node effects include an optional `modifierType?: 'increased' | 'more' | 'flat'` field on `GameNode`
   **And** `AffixEntry` in `shared/types/itemDatabase.ts` includes optional `modifierType`, `scope: 'melee' | 'ranged' | 'spell' | 'minion' | 'generic'`, and `damageType` fields

2. **Given** all new fields are optional
   **When** the scoring engine encounters a node or affix without `modifierType`
   **Then** the engine falls back to treating it as `"increased"` (no panic, no error — this is a Rust-side rule enforced in later stories, but the optional field in TypeScript makes the fallback contract explicit)

3. **Given** the `idol-data.json` schema is documented as TypeScript interfaces
   **When** an agent reviews the schema definition
   **Then** the schema includes a top-level `IdolData` type with `version: string`, `defaultGrid: IdolDefaultGrid`, and `altarVariants: []`
   **And** `IdolDefaultGrid` has `rows`, `cols`, and `blockedCells: IdolGridCell[]`
   **And** the `altarVariants` array is the documented Phase 4 extension point (empty in Phase 3)

4. **Given** the `conditions.json` schema is documented as TypeScript interfaces
   **When** an agent reviews it
   **Then** each `ConditionEntry` includes: `id: string`, `displayLabel: string`, `category: 'universal' | 'build-specific'`, and an optional `filter?: { classId?: string; skillTag?: string }`

5. **Given** the updated TypeScript types
   **When** `pnpm build` runs from `lebo/`
   **Then** the build succeeds with zero TypeScript errors

## Tasks / Subtasks

- [ ] Task 1: Extend `GameNode` with `modifierType` (AC: #1, #2)
  - [ ] Open `lebo/src/shared/types/gameData.ts`
  - [ ] Add `modifierType?: 'increased' | 'more' | 'flat'` to the `GameNode` interface
  - [ ] No other changes to `gameData.ts` — do not modify any other existing field

- [ ] Task 2: Extend `AffixEntry` with scoring engine fields (AC: #1, #2)
  - [ ] Open `lebo/src/shared/types/itemDatabase.ts`
  - [ ] Add to `AffixEntry`: `modifierType?: 'increased' | 'more' | 'flat'`
  - [ ] Add to `AffixEntry`: `scope?: 'melee' | 'ranged' | 'spell' | 'minion' | 'generic'`
  - [ ] Add to `AffixEntry`: `damageType?: DamageType | null`
  - [ ] Define `DamageType` as a union type in `itemDatabase.ts` (see Dev Notes for values)
  - [ ] No changes to `AffixEntryV2` in `build.ts` — that is a build-state type, not a database type

- [ ] Task 3: Create idol data TypeScript schema (AC: #3)
  - [ ] Create new file `lebo/src/shared/types/idolData.ts`
  - [ ] Define all interfaces specified in Dev Notes
  - [ ] No barrel `index.ts` file — import directly from `idolData.ts`

- [ ] Task 4: Create conditions TypeScript schema (AC: #4)
  - [ ] Create new file `lebo/src/shared/types/conditions.ts`
  - [ ] Define all interfaces specified in Dev Notes
  - [ ] No barrel `index.ts` file

- [ ] Task 5: Verify build (AC: #5)
  - [ ] Run `pnpm build` from `lebo/` — zero TypeScript errors required
  - [ ] Run `pnpm vitest` — no existing tests should regress (new optional fields are backward-compatible)

## Dev Notes

### Critical Clarification — Which Affix Type to Extend

The epics doc says `AffixEntryV2` when describing affix fields to extend. **This is a documentation error in the epics.** The correct type to extend is `AffixEntry` in `lebo/src/shared/types/itemDatabase.ts`.

Reason: `AffixEntryV2` (in `build.ts`) represents a *placed* affix on a specific item in the player's build — it holds `{ affixId?, name, tier?, value? }`. It's a build-state type with no game-data semantics. `AffixEntry` (in `itemDatabase.ts`) is the database record with `{ id, name, type, itemSlots, tiers[] }`. The scoring engine will look up an affix's `modifierType` and `scope` from the database record, not from the build state.

**Never modify `AffixEntryV2` in `build.ts` for this story.**

### `DamageType` Union — Exact Values

Define as a named export in `itemDatabase.ts` (co-locate with `AffixEntry` since it's used there first):

```typescript
export type DamageType =
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'void'
  | 'poison'
  | 'physical'
  | 'bleed'
```

These match Last Epoch's canonical damage types and the FR-F3 rarity color system (see architecture doc). `damageType: null` is the correct value for affixes that are not damage-type-specific (e.g., flat HP, resistances).

### Forward-Compatible `AffixEntry` Schema

The architecture doc specifies this forward-compatible affix schema (architecture.md §Data Ingestion Pipeline):

```json
{
  "affixId": "melee_crit_chance",
  "statKey": "crit_chance",
  "modifierType": "increased",
  "scope": "melee",
  "damageType": null,
  "condition": null,
  "ailmentType": null,
  "valuePerTier": [4, 8, 12, 16, 20, 24, 28]
}
```

Story 1.1 adds only `modifierType`, `scope`, and `damageType` to `AffixEntry` — matching the ACs. `statKey`, `condition`, and `ailmentType` are Phase 4 fields. Do NOT add them now — they are out of scope for this story.

Note: the current `AffixEntry` uses `id` (not `affixId`) and `tiers: AffixTier[]` (not `valuePerTier[]`). These existing field names are the established TypeScript convention for this project and must not be changed.

### `IdolData` Schema — Full TypeScript Interface

Create `lebo/src/shared/types/idolData.ts` with these exact interfaces:

```typescript
export interface IdolGridCell {
  row: number
  col: number
}

export interface IdolDefaultGrid {
  rows: number
  cols: number
  blockedCells: IdolGridCell[]
}

export type IdolSizeType = '1x1' | '1x2' | '1x3' | '2x2'

export interface IdolAffixSlot {
  affixId: string
  tier: number
}

export interface IdolPlacementRule {
  sizeType: IdolSizeType
  validOriginCells: IdolGridCell[]  // top-left cells where this size can be placed
}

export interface IdolData {
  version: string
  defaultGrid: IdolDefaultGrid
  placementRules: IdolPlacementRule[]
  altarVariants: []  // Phase 4 extension point — always empty in Phase 3
}
```

The `defaultGrid.blockedCells` for the Phase 3 idol grid are: `(0,0)`, `(0,4)`, `(4,0)`, `(4,4)`, `(2,2)` — the four corners and center cell. This is the canonical Last Epoch default idol grid from story 1.4 AC.

### `ConditionEntry` Schema — Full TypeScript Interface

Create `lebo/src/shared/types/conditions.ts` with these exact interfaces:

```typescript
export type ConditionCategory = 'universal' | 'build-specific'

export interface ConditionFilter {
  classId?: string    // e.g. 'paladin', 'bladedancer'
  skillTag?: string   // e.g. 'sigil_of_hope', 'hex'
}

export interface ConditionEntry {
  id: string
  displayLabel: string
  category: ConditionCategory
  filter?: ConditionFilter
}

export interface ConditionsData {
  version: string
  conditions: ConditionEntry[]
}
```

The `filter` field enables build-specific conditions to appear only when the relevant skill/class is active (FR-E3). `filter` being absent means the condition is always shown when its `category` applies.

### What This Story Does NOT Do

These are explicitly out of scope for story 1.1 — do not implement them:

- ❌ Do NOT create the actual JSON data files (`idol-data.json`, `blessings.json`, `conditions.json`) — that is story 1.4
- ❌ Do NOT create `shared/types/statSheet.ts` — that is story 2.1 (Scoring Engine Foundation)
- ❌ Do NOT add any Rust code or `scoring-core` crate work
- ❌ Do NOT add `statKey`, `condition`, or `ailmentType` to `AffixEntry` — those are Phase 4 fields
- ❌ Do NOT create a `blessings.ts` type file — blessings schema is in story 1.4, not 1.1
- ❌ Do NOT modify `AffixEntryV2` in `build.ts`

### No Barrel Files

Per project rules (project-context.md): **never create `index.ts` re-export files**. Import directly from `idolData.ts` and `conditions.ts` when needed in future stories. Do not add these new files to any re-export file.

### TypeScript Strict Mode

All new fields must be optional (`?:`) so existing code that constructs `GameNode` or `AffixEntry` objects without these fields continues to compile. The TypeScript compiler is in strict mode (`noUnusedLocals`, `noUnusedParameters`) — any unused import in the new files will be a build error.

### Project Structure Notes

- `gameData.ts` → `lebo/src/shared/types/gameData.ts` (modify in place)
- `itemDatabase.ts` → `lebo/src/shared/types/itemDatabase.ts` (modify in place)
- `idolData.ts` → `lebo/src/shared/types/idolData.ts` (new file)
- `conditions.ts` → `lebo/src/shared/types/conditions.ts` (new file)
- No feature folder changes — all work is in `shared/types/`
- The `lebo/` directory is the Vite project root — run all commands from there

### References

- [Source: epics.md § Story 1.1 — Game Data Type Extension & Schema Definition]
- [Source: architecture.md § Data Ingestion Pipeline — The Schema Gap]
- [Source: architecture.md § Forward-Compatible Affix Schema]
- [Source: architecture.md § Three New Game Databases]
- [Source: project-context.md § Language-Specific Rules — No barrel files]
- [Source: project-context.md § Language-Specific Rules — TypeScript strict mode]
- [Source: project-context.md § Critical Don't-Miss Rules — GearItemV2 deprecation (AffixEntryV2 context)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
