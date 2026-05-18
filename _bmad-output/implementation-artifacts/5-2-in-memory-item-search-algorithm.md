# Story 5.2: In-Memory Item Search Algorithm

Status: review

## Story

As a theory-crafter,
I want typeahead search to return relevant item results instantly as I type, without any perceptible delay,
so that finding items feels like filtering a known list, not waiting for a database query.

## Acceptance Criteria

1. **Given** `useGameDataStore.itemDatabase` is loaded with the full corpus
   **When** `searchItems(query: string, database: ItemDatabase): SearchResult[]` is called with a 3-character query
   **Then** results are returned within 50ms for the full corpus (NFR3); measured via `performance.now()` in unit tests

2. **Given** a query that exactly matches the start of an item name (e.g., "Jugg")
   **When** `searchItems` runs
   **Then** prefix-matched items appear before substring-matched items; items whose names start with the query are ranked highest

3. **Given** a query with a minor typo (e.g., "Jugernaut")
   **When** `searchItems` runs
   **Then** items with close Levenshtein proximity to the query appear in results; the correct item surfaces within the top 5 results

4. **Given** a query that matches no item names
   **When** `searchItems` runs
   **Then** an empty array is returned; this triggers an inline "No items found" display in the GearSlot dropdown (not a toast — that is Story 5.4's concern)

5. **And** `searchItems` is in `src/features/item-database/itemSearch.ts`; it never calls any Tauri command — all computation is in-memory TypeScript

6. **And** `itemSearch.test.ts` covers: prefix match ranking, substring match, empty results, and the ≤50ms performance benchmark on a simulated full corpus

## Tasks / Subtasks

- [x] Task 1: Add `SearchResult` type to `src/shared/types/itemDatabase.ts` (AC: #1, #2, #3, #4, #5)
  - [x] Export `SearchResult` interface with fields: `id: string`, `name: string`, `baseType: string`, `slot: string`, `type: 'base' | 'unique'`
  - [x] No barrel file — direct import from `itemDatabase.ts`
  - [x] Named export only (no `export default`)

- [x] Task 2: Implement `itemSearch.ts` at `src/features/item-database/itemSearch.ts` (AC: #1, #2, #3, #4, #5)
  - [x] Export `searchItems(query: string, database: ItemDatabase): SearchResult[]`
  - [x] Case-insensitive matching on item name throughout
  - [x] Scoring: score 3 = name starts with query (prefix match); score 2 = name contains query as substring; score 1 = Levenshtein distance ≤ threshold (fuzzy fallback); score 0 = exclude
  - [x] Search both `database.baseItems` and `database.uniqueItems`; tag each result with `type: 'base'` or `type: 'unique'`
  - [x] Sort results descending by score, then alphabetically within the same score for stable output
  - [x] Return all matching results unsorted — cap at call site (GearSlot will take first 6); do not hard-cap inside `searchItems`
  - [x] No Tauri IPC calls, no `invokeCommand`, no `import ... from '@tauri-apps/api/core'`
  - [x] No debounce logic inside `searchItems` — it is synchronous and must remain so per architecture rule

- [x] Task 3: Write `itemSearch.test.ts` at `src/features/item-database/itemSearch.test.ts` (AC: #1, #2, #3, #4, #6)
  - [x] Prefix match ranking: given corpus with "Juggernaut Helm" and "Helm of Juggernaut", query "Jugg" → "Juggernaut Helm" appears first
  - [x] Substring match: query "helm" → items containing "helm" in name appear (not necessarily prefix)
  - [x] Fuzzy/typo: query "Jugernaut" (one missing 'g') → "Juggernaut Helm" is in top 5 results
  - [x] Empty result: query "xyzxyz" → returns `[]`
  - [x] Performance benchmark: build a simulated corpus of 1,400 items (matching real corpus size); call `searchItems` with a 3-char query; assert elapsed < 50ms using `performance.now()`
  - [x] No Tauri mocks needed — `itemSearch.ts` has no IPC calls; no `vi.mock` required
  - [x] No snapshot tests — explicit `expect` assertions only

## Dev Notes

### What This Story Is (and Is Not)

This story creates the **pure search algorithm only**. It does NOT:
- Build any UI component (that is Story 5.4 — GearSlot)
- Build the affix search for the "+" picker (that is Story 5.5 — AffixPicker)
- Wire results into any store (search results live in local component state per architecture)
- Call any Tauri command or touch Rust at all

### SearchResult Type Design

Add `SearchResult` to the existing `src/shared/types/itemDatabase.ts`. Story 5.4 (GearSlot) uses this type to decide which pre-populate logic to run:
- `type: 'base'` → pre-populate from `BaseItem.implicitAffixIds` at median tier
- `type: 'unique'` → pre-populate from `UniqueItem.affixes[].fixedMinValue/fixedMaxValue`

```typescript
export interface SearchResult {
  id: string
  name: string
  baseType: string
  slot: string
  type: 'base' | 'unique'
}
```

Do NOT search `database.affixes` in `searchItems` — affix search is a separate function for Story 5.5's AffixPicker. `searchItems` only searches base items and unique items.

### Scoring Algorithm Detail

```typescript
function scoreItem(name: string, queryLower: string): number {
  const nameLower = name.toLowerCase()
  if (nameLower.startsWith(queryLower)) return 3          // prefix
  if (nameLower.includes(queryLower)) return 2            // substring
  if (levenshtein(nameLower, queryLower) <= threshold) return 1  // fuzzy
  return 0
}
```

**Levenshtein threshold:** Recommend `Math.floor(queryLower.length / 3) + 1` — scales with query length. For "Jugernaut" (9 chars) → threshold = 4; actual distance to "Juggernaut" is 1. This surfaces correct items without excessive false positives.

**Implement Levenshtein inline** — do not add an npm package. The corpus is small; a standard iterative DP implementation is fast enough. Keep it as a module-private function (not exported).

### Performance Guarantee

Corpus stats (actual from Story 5.1): 897 base items + 471 uniques = **1,368 items total**. Simple string ops on ~1,400 names run in <<1ms in V8. Levenshtein on short strings (<30 chars) adds <5ms total. The 50ms budget is extremely generous — this will pass trivially. The benchmark test exists to **prevent future regressions** if corpus grows.

### Architecture Mandates (Non-Negotiable)

From `_bmad-output/planning-artifacts/architecture.md`, mandatory pattern #8:
> **Never debounce the item typeahead search — it must be synchronous on loaded data.**

`searchItems` must be a pure synchronous function. The GearSlot (Story 5.4) calls it directly in an onChange handler. No async, no debounce, no setTimeout inside this module.

Item search pattern (architecture §Implementation Patterns):
1. Database loaded once at startup → `useGameDataStore.itemDatabase`
2. All search done in TypeScript via `itemSearch.ts` functions
3. **Never call a Rust command for search** — ≤50ms cannot tolerate IPC round-trip
4. Components receive search results via **local component state**, not any store

### File Structure

```
src/features/item-database/
  itemDatabaseLoader.ts        ← EXISTS (Story 5.1, do not touch)
  itemDatabaseLoader.test.ts   ← EXISTS (Story 5.1, do not touch)
  itemSearch.ts                ← CREATE (Task 2)
  itemSearch.test.ts           ← CREATE (Task 3)
  GearSlot.tsx                 ← does not exist yet (Story 5.4)
  ...
```

No `index.ts` barrel file. Import `searchItems` directly: `import { searchItems } from './itemSearch'`.

### What Already Exists — Do NOT Recreate

| Already exists | Location |
|----------------|----------|
| `ItemDatabase`, `BaseItem`, `UniqueItem`, `AffixEntry`, `AffixTier` types | `src/shared/types/itemDatabase.ts` |
| `useGameDataStore.itemDatabase` | `src/shared/stores/gameDataStore.ts` |
| `itemDatabaseLoader.ts` | `src/features/item-database/itemDatabaseLoader.ts` |
| `ITEM_DATA_ERROR` in ErrorType | `src/shared/types/errors.ts` |

Do NOT add a new Zustand store or extend any existing store in this story. `SearchResult[]` lives exclusively in local component state (Story 5.4).

### TypeScript Strict Mode Checklist

- `searchItems` parameters and return type must be explicitly typed (no `any`)
- Levenshtein helper: mark as `function levenshtein(a: string, b: string): number` — private to module, not exported
- `noUnusedLocals` and `noUnusedParameters`: do not leave unused variables
- All exports named (no `export default`)

### Previous Story Learnings (Story 5.1)

- **Pre-existing test failures:** `ProviderSelector.test.tsx` and `Settings.test.tsx` have 6 pre-existing failures unrelated to this epic. Do not count them as regressions.
- **No Rust work in this story** — Story 5.2 is entirely TypeScript. No `lib.rs`, no `commands/mod.rs`, no `services/` changes.
- **Test file co-location:** `itemSearch.test.ts` sits next to `itemSearch.ts` (same folder). Vitest discovers it automatically.
- **No `vi.mock` needed:** `itemSearch.ts` has zero Tauri/IPC imports, so tests run in jsdom with no mocking overhead.
- **Story 5.1 completion note:** `implicitAffixIds` is empty for all base items in current data; affix cross-link is a future concern. `itemSlots` is empty for all affixes. Do not block on these gaps — Story 5.2 does not depend on them.

### Project Context Rules

- **No barrel files:** `itemSearch.ts` in `src/features/item-database/` — no `index.ts` re-export file.
- **No new Zustand stores:** Search results are local component state (Story 5.4's concern).
- **TypeScript strict mode:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`.
- **Named exports only:** `export function searchItems(...)` — no `export default`.
- **No `@apply` in CSS:** Not applicable here (no CSS in this story).
- **Test files co-locate with source:** `itemSearch.test.ts` next to `itemSearch.ts`.
- **No snapshot tests:** Explicit `expect` assertions only.
- **Vitest config** lives in `vite.config.ts` under the `test` key — do not create a separate `vitest.config.ts`.
- **`test-setup.ts` already provides** `@testing-library/jest-dom`, `vitest-axe`, `ResizeObserver` stub, `matchMedia` stub — do not duplicate in test file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.2 ACs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — §In-memory search, §Implementation Patterns rule #8, §Item search data flow, §Pillar 2 Item Database]
- [Source: `_bmad-output/project-context.md` — Technology Stack, Language rules, Testing rules, Code quality rules]
- [Source: `lebo/src/shared/types/itemDatabase.ts` — existing type definitions; `SearchResult` extends this file]
- [Source: `lebo/src/shared/stores/gameDataStore.ts` — `itemDatabase: ItemDatabase | null`; search reads from here in Story 5.4 (this story does not touch the store)]
- [Source: `lebo/src/features/item-database/itemDatabaseLoader.ts` — co-location pattern in `item-database/`]
- [Source: `_bmad-output/implementation-artifacts/5-1-item-database-load-and-typescript-types.md` — completion notes: corpus counts (897 base, 471 unique, 4171 affixes); pre-existing failures warning]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fuzzy match initially failed: `levenshtein` was comparing against full item name ("juggernaut helm") instead of individual words. Fixed `scoreItem` to split the name on whitespace and check each word — aligns with Dev Notes example showing distance to "Juggernaut" (not "Juggernaut Helm") is 1.

### Completion Notes List

- Added `SearchResult` interface to `src/shared/types/itemDatabase.ts` — named export, no default.
- Implemented `itemSearch.ts` with synchronous `searchItems(query, database)`: prefix match (score 3) → substring (score 2) → per-word Levenshtein fuzzy (score 1); sorts by score descending then name alphabetically; no cap, no IPC, no debounce.
- `levenshtein` uses space-optimised single-array DP (O(n) space) — private to module, not exported.
- 9 tests cover: prefix ranking, substring, case-insensitivity, fuzzy typo, empty results, base/unique type tagging, alphabetic tiebreak, no-internal-cap, and ≤50ms performance on 1,400-item corpus.
- All 9 new tests pass; 6 pre-existing failures in ProviderSelector/Settings unchanged; TypeScript strict build clean.

### File List

- `lebo/src/shared/types/itemDatabase.ts` (modified — added `SearchResult`)
- `lebo/src/features/item-database/itemSearch.ts` (created)
- `lebo/src/features/item-database/itemSearch.test.ts` (created)

## Change Log

- 2026-05-14: Implemented in-memory item search algorithm — `SearchResult` type added, `searchItems` function with prefix/substring/fuzzy scoring, 9 unit tests including ≤50ms performance benchmark (claude-sonnet-4-6)
