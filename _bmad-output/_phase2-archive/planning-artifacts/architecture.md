---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-05-06'
inputDocuments:
  - '_bmad-output/project-intent-phase2.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/project-context.md'
  - 'docs/game-data-source.md'
  - 'docs/pixi-spike-report.md'
project_name: 'LEBOv2'
user_name: 'Alec'
date: '2026-05-06'
---

# Architecture Decision Document — LEBOv2 Phase 2

**Author:** Alec
**Date:** 2026-05-06
**Phase:** 2 of 3
**Supersedes:** Phase 1 Architecture (archived in `_bmad-output/_phase1-archive/planning-artifacts/architecture.md`)
**Status:** Complete — ready for Epic Breakdown

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements — Phase 2 (55 FRs):**

FR1–FR10 — Skill tree visual rendering (all tree types, node states, search, RESET, unspent counter)
FR11–FR17 — Active skill management (picker grid, left-click increment, right-click decrement, prerequisite validation)
FR18–FR22 — Character level & budget system (level input, passive point budget, skill level per slot, enforce toggle)
FR23–FR33 — Item database & gear input (local DB load, typeahead search, tier sliders, custom affixes, free-text fallback, structured AI context, freshness check)
FR34–FR42 — Optimization UX & AI integration (Glass Cannon ↔ Juggernaut slider, Fine Tune panel, level-budget-aware AI context, streaming output, clear/rerun)
FR43–FR50 — Data pipeline & asset management (Steam detection, icon extraction, CDN fallback, icon caching, game/item data freshness, atomic update)
FR51–FR55 — Build persistence & migration (lossless v1→v2 migration, v2 save format, idempotent migration, version display in settings)

**Non-Functional Requirements (architecturally significant):**

| NFR | Requirement | Architecture Impact |
|-----|-------------|---------------------|
| Performance | PixiJS ≥60fps idle, ≥45fps sustained @ ≤200 nodes | Icon textures in PixiJS Assets cache; 5 shared Graphics objects (Phase 1 pattern) |
| Performance | Icon load ≤200ms from tree view mount | Pre-warm PixiJS Assets before tree is interactive |
| Performance | Item typeahead ≤50ms per keystroke | In-memory search in TypeScript; corpus fits in RAM (~5MB) |
| Security | API key never crosses IPC boundary | Unchanged from Phase 1; all Claude API calls stay in Rust |
| Security | Steam directory read-only | Rust commands only read; never write to Steam paths |
| Reliability | BuildState v1→v2 migration lossless | `migrateBuildState` handles all Phase 1 save variants |
| Reliability | Atomic data updates | Rust writes to temp file then renames; never corrupts existing data |
| Accessibility | WCAG AA (4.5:1 contrast, focus rings, ARIA) | All Phase 2 components use existing token system + Headless UI |
| Reliability | Icon extraction failure degrades silently | CDN fallback always available; user never sees an error |

**Scale & Complexity:**

- Primary domain: Tauri 2.x desktop application (brownfield extension)
- Complexity level: Medium — no regulatory compliance; complexity driven by icon extraction pipeline, multi-source data, PixiJS rendering with icon textures, and schema migration
- Estimated new architectural components: 8 major additions to Phase 1 foundation
- Brownfield constraint: All Phase 1 rules in `project-context.md` remain in force — no exceptions

### Technical Constraints & Dependencies

**Inherited from Phase 1 (non-negotiable):**
- Four domain stores only (`useBuildStore`, `useGameDataStore`, `useOptimizationStore`, `useAppStore`)
- `SkillTreeCanvas` is props-only — no Zustand access inside PixiJS context
- No barrel files — direct imports from source files only
- All Tauri commands implemented in Rust, registered in `lib.rs`, called via `invokeCommand<T>()`
- API key never crosses IPC boundary — all Claude/OpenRouter calls stay in Rust
- No React Router — view switching via `appStore.currentView`
- WebGL null patch already applied at module load in `pixiRenderer.ts` — do not re-inject

**Phase 2 New Constraints:**
- Icon extraction from Unity asset bundles requires a research spike to validate feasibility (see Decision 1 below)
- Weaver Tree gated behind data research spike — architecture supports it but implementation is conditional
- Item database corpus must fit in resident memory for ≤50ms typeahead (target: ~5MB total)
- BuildState schema migration must be idempotent and handle all Phase 1 save variants including null gear and empty builds

### Cross-Cutting Concerns Identified

1. **Icon pipeline** — spans Rust (Steam detection, file extraction, CDN fetch, cache write), TypeScript (PixiJS Assets loading, Texture propagation), and PixiJS (node rendering with icon textures). Failure at any layer must degrade gracefully to the next layer.

2. **Item database freshness** — shares the same staleness-check pattern as game data but uses `itemDataVersion` independently. Both can be stale simultaneously and produce separate banners.

3. **BuildState v2 migration** — must run on every load, be idempotent, and handle the full range of Phase 1 save formats (free-text gear, null gear, empty builds). Migration is the first thing `buildPersistence.ts` does after SQLite read.

4. **Weaver Tree research gate** — all Phase 2 epics referencing the Weaver Tree are conditional on the spike result. Architecture defines both paths: spike succeeds (render) and spike fails (placeholder tab).

5. **Level budget system** — shared logic between passive tree (character level → passive points), active skill trees (skill level → skill tree points), and Weaver Tree (separate Weaver point pool). Budget state lives in `useBuildStore`.

---

## Starter Template Evaluation

### Context: Brownfield Extension

LEBOv2 Phase 2 is a brownfield extension. The Phase 1 codebase is the foundation — no new project initialization is required. This section documents Phase 1's starter decision (carried forward) and confirms Phase 2 adds to it without reinitializing.

### Existing Foundation (Phase 1 Starter)

**Selected Starter (Phase 1):** `create-tauri-app` (React TypeScript)

**Initialization Command (historical reference):**
```bash
pnpm create tauri-app@latest lebo --template react-ts
```

**Technology Stack (in production, from `project-context.md`):**

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop shell | Tauri | 2.x (tauri-cli ^2, @tauri-apps/api ^2) |
| Frontend | React + TypeScript | 19.1 + ~5.8.3 (strict mode) |
| Build | Vite | 7 |
| Styling | Tailwind CSS v4 | CSS-first, no config file |
| Canvas | PixiJS + @pixi/react | 8.18.1 + 8.0.5 |
| State | Zustand | 5.0.12 |
| UI primitives | @headlessui/react | 2.2.10 |
| Toasts | react-hot-toast | 2.6.0 |
| Rust backend | serde/serde_json, rusqlite, reqwest, tokio, argon2 | 1, 0.32, 0.12, 1, 0.5 |
| Tauri plugins | sql, stronghold, http, updater, store | 2.4.0, 2, 2.5.8, 2.10.1, 2.4.2 |
| Testing | Vitest + @testing-library/react + jsdom + vitest-axe | 4.1.4 + 16 + 29 + 0.1.0 |

**Phase 2 adds no new top-level packages** beyond what is already in the manifest, unless the icon extraction spike reveals a required binary parsing crate (see Decision 1).

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. Icon extraction strategy — determines whether game file extraction is feasible or CDN-only
2. `nodeAllocations` type change — Phase 1 `SkillTreeCanvas` props must be updated for multi-point support
3. BuildState schema v2 migration — must be correct before any Phase 2 build data is saved

**Important Decisions (Shape Architecture):**

4. Item database search approach — in-memory TypeScript vs. Rust query
5. `SkillTreeCanvas` props extension for icon textures
6. Optimization slider state location and backward compatibility mapping
7. Weaver Tree renderer strategy (conditional on spike)

**Deferred Decisions (Post-Phase-2 / Spike-Gated):**

- Exact Unity asset bundle extraction API — gated behind icon pipeline spike
- Weaver Tree node layout algorithm — gated behind Weaver data spike

---

### Decision 1: Icon Pipeline Strategy

**Context:** Skill icons must appear in PixiJS tree nodes. Last Epoch uses Unity, so game assets are in Unity asset bundle (`.assets` / `.bundle`) format. Extraction feasibility from binary Unity bundles in Rust is unknown without a spike.

**Research Spike Required:** Before implementing `extract_skill_icons`, a spike must confirm:
1. The exact file path and format of skill icons within the Last Epoch Unity installation
2. Whether a Rust crate (`unity-pak` or similar) can extract them, or whether raw binary parsing is needed
3. Icon file format after extraction (PNG assumed)

**Architecture Decision:** Two-path icon pipeline with automatic fallback:

```
Path A (game files): detect_steam_path → find icon bundle → extract_skill_icons → cache to {app_data}/lebo/icons/skills/
Path B (CDN):        fetch_cdn_icon(skill_id, cdnUrl) → cache to {app_data}/lebo/icons/skills/
Path C (placeholder): placeholder hex color fill in PixiJS node
```

**Fallback logic (Rust command `initialize_icon_pipeline`):**
1. Try `detect_steam_path` — if None, go to Path B
2. If Steam path found, try icon extraction — if fails (any error), log silently, go to Path B
3. Try CDN fetch — if fails, go to Path C
4. Record `iconSource: "game-files" | "community-cdn" | "placeholder"` in manifest

**TypeScript side:** `useIconTextures` hook calls Rust to get the local cache path for each skill icon, then loads via `PixiJS.Assets.load()`. Returns `Map<skillId, Texture>`.

**Icon loading timing:** Textures loaded during tree view mount, before the canvas becomes interactive. `useIconTextures` is called by the parent of `SkillTreeCanvas`, which passes `iconTextures: Map<string, Texture>` as a prop. The tree renders with placeholder fill colors until textures resolve (within 200ms from cache).

**New Rust commands:**
- `detect_steam_path() -> Result<Option<String>, String>` — returns None if not found, never errors
- `extract_skill_icons(steamPath: String) -> Result<(), String>` — writes to icon cache; errors if bundle parsing fails
- `fetch_cdn_icon(skillId: String, cdnUrl: String) -> Result<String, String>` — fetches and caches; returns local path
- `get_icon_cache_path(skillId: String) -> Result<Option<String>, String>` — returns local path or None if not cached
- `initialize_icon_pipeline() -> Result<IconPipelineStatus, String>` — orchestrates full A→B→C flow on launch

**Manifest v2 additions:**
```json
{
  "itemDataVersion": "1.0.0",
  "iconCacheVersion": "1.0.0",
  "iconSource": "game-files | community-cdn | placeholder"
}
```

---

### Decision 2: `nodeAllocations` Type Upgrade (Multi-Point Support)

**Context:** Phase 1 `SkillTreeCanvas` receives `allocatedNodes: Set<string>` — a boolean presence check. Phase 2 multi-point nodes require knowing how many points are allocated (0 to maxPoints). This is a breaking change to the SkillTreeCanvas props interface.

**Decision:** Change `allocatedNodes: Set<string>` → `nodeAllocations: Record<string, number>` throughout.

**Scope of change:**
- `SkillTreeCanvas.tsx` props type: `allocatedNodes: Set<string>` → `nodeAllocations: Record<string, number>`
- All PixiJS draw functions: receive `allocation: number` (0 = locked/unallocated, 1–maxPoints = allocated)
- `useBuildStore`: `nodeAllocations` was already `Record<string, number>` in Phase 1 per project-context — confirm and standardize
- Node rendering: display `current/max` counter when `allocation > 0`; node visual state is:
  - `0` = locked or available (check prerequisites to differentiate)
  - `1..maxPoints` = allocated (highlight based on count, show counter)
  - `maxPoints` = fully allocated (saturated visual, no further increment)

**`applyNodeChange(nodeId: string, delta: +1 | -1)` in `useBuildStore`:**
- For delta = +1: validate prerequisites met AND budget allows (if enforced) AND current < maxPoints
- For delta = -1: validate no allocated dependents would lose their prerequisites AND current > 0
- Push to undo stack after successful change (MAX_UNDO_STACK = 10, unchanged)

**Prerequisite validation data:** The `treeData` prop already contains edge definitions (`fromId → toId` = prerequisite → dependent). The store needs the active `treeData` to validate dependencies. Pattern: validation logic in `useBuildStore` receives the current `treeData` as a parameter to `applyNodeChange` (passed from the component that knows the active tree).

---

### Decision 3: BuildState Schema v2

**Context:** Phase 1 gear is `{ slot: string, itemName: string, affixes: string[] }` (free-text). Phase 2 requires structured gear with `itemId`, `affixId`, `tier`, and `value`.

**Schema v2 gear definition:**
```typescript
interface GearItemV2 {
  slot: string;
  itemId?: string;           // undefined if free-text entry
  itemName: string;
  affixes: AffixEntryV2[];
}

interface AffixEntryV2 {
  affixId?: string;          // undefined if free-text or custom
  name: string;
  tier?: number;             // undefined if free-text (lossless migration)
  value?: number;            // undefined if free-text (lossless migration)
}
```

**`migrateBuildState` logic (in `buildPersistence.ts`):**
```typescript
// v1 → v2: convert free-text affix strings to AffixEntryV2
if (build.schemaVersion === 1) {
  build.contextData.gear = build.contextData.gear?.map(slot => ({
    ...slot,
    affixes: (slot.affixes as string[]).map(name => ({ name, tier: undefined, value: undefined }))
  })) ?? [];
  build.schemaVersion = 2;
}
// v2 builds pass through unchanged (idempotent)
```

**Migration coverage (all Phase 1 save variants):**
- `gear: null | undefined` → coerced to `[]`
- `gear: []` → remains `[]`
- `gear: [{ slot, itemName, affixes: [] }]` → empty affixes array preserved
- `gear: [{ slot, itemName, affixes: ['Health', 'Armor'] }]` → `[{ name: 'Health', tier: undefined }, { name: 'Armor', tier: undefined }]`

**SQLite schema:** The `schema_version` column in the `builds` table continues to track build schema. `schema_version = 2` for all Phase 2 builds. The `migrateBuildState` function is called immediately after reading from SQLite and before populating `useBuildStore`.

---

### Decision 4: Item Database Architecture

**Storage:** Three JSON files in `{app_data}/lebo/items/` — `base-items.json`, `uniques.json`, `affixes.json`. Bundled in `src-tauri/resources/items/` at build time, copied to app data on first launch.

**Load strategy:**
- Rust command `load_item_database()` reads and deserializes all three files
- Returns structured data to TypeScript via `invokeCommand<ItemDatabase>()`
- `useGameDataStore` extended with `itemDatabase: ItemDatabase | null` slice
- Load happens at app startup alongside game data load (parallel, non-blocking)

**In-memory search (TypeScript):**
- All search happens in TypeScript after `itemDatabase` is loaded into `useGameDataStore`
- Rationale: ≤50ms requirement; TypeScript string search on 5MB corpus is fast; avoids IPC round-trip latency
- `itemSearch.ts` exports `searchItems(query: string, database: ItemDatabase): SearchResult[]`
- Fuzzy matching: score items by prefix match > substring match > Levenshtein proximity

**Item corpus size estimate:**
- 674 base items × ~200 bytes avg = ~135KB
- 445 uniques × ~300 bytes avg = ~134KB
- 1,112 affixes × ~150 bytes avg = ~167KB
- **Total: ~440KB** — well within memory budget for in-process search

**Freshness check:**
- Rust command `check_item_data_freshness()` compares local `itemDataVersion` in manifest against remote version file
- Same pattern as `check_data_freshness()` for game data
- Staleness banner in `StalenessBar` component shows separate indicator when item data is stale

**New Rust commands:**
- `load_item_database() -> Result<ItemDatabase, String>`
- `check_item_data_freshness() -> Result<FreshnessStatus, String>`
- `update_item_data() -> Result<(), String>` — downloads and atomically replaces item files

---

### Decision 5: `SkillTreeCanvas` Props Extension for Icons

**Context:** `SkillTreeCanvas` is props-only. Icons must be loaded outside the canvas and passed in as resolved PixiJS `Texture` objects. Direct `Assets.load()` inside PixiJS context is not permitted under the props-only contract.

**New prop:**
```typescript
interface SkillTreeCanvasProps {
  treeData: TreeData;
  nodeAllocations: Record<string, number>;  // was allocatedNodes: Set<string>
  highlightedNodes: Set<string>;
  onNodeClick: (nodeId: string, button: 0 | 2) => void;  // 0=left, 2=right
  iconTextures: Map<string, Texture>;  // NEW — empty Map = placeholder fills
  treeLayout: 'passive' | 'skill' | 'weaver';  // NEW — controls layout algorithm
  reducedMotion: boolean;
}
```

**Icon rendering in PixiJS (inside `pixiRenderer.ts`):**
- Each node draw function receives `iconTexture: Texture | undefined`
- If texture is defined: draw as Sprite centered in the hexagonal node area, clipped to hex bounds
- If texture is undefined: draw placeholder fill using existing node-state color

**`useIconTextures` hook (in `icon-pipeline/`):**
```typescript
// Returns Map<skillId, Texture> — populated async after PixiJS Assets.load
function useIconTextures(skillIds: string[]): Map<string, Texture>
```
- Calls `invokeCommand<string | null>('get_icon_cache_path', { skillId })` for each skill
- Batches `PixiJS.Assets.load()` calls
- Returns partial Map as textures resolve (progressive rendering is intentional)

---

### Decision 6: Optimization Slider State & Backward Compatibility

**State location:** `useOptimizationStore` extended with:
```typescript
interface OptimizationStore {
  // ... existing Phase 1 fields ...
  sliderPosition: number;  // 0–100 (0=Juggernaut, 100=Glass Cannon, 50=Balanced)
  fineTuneWeights: { damage: number; survivability: number; speed: number } | null;
  // null = Fine Tune collapsed, master slider drives weights
  // non-null = Fine Tune expanded, sub-sliders override master slider
}
```

**Backward compatibility mapping (Phase 1 preset → slider position):**
| Phase 1 Preset | Slider Position |
|---------------|----------------|
| Maximize Damage | 100 |
| Maximize Survivability | 0 |
| Maximize Speed | fineTuneWeights: { damage: 25, survivability: 0, speed: 75 } |
| Balanced | 50 |

Phase 1 builds with a saved preset automatically migrate via `migrateBuildState` by converting the preset to the equivalent slider position. The `goalPreset` field is removed from `BuildState` and replaced by `sliderPosition`.

**Prompt construction in Rust (`optimization_commands.rs`):**
- Receives `slider_position: f32` and `fine_tune_weights: Option<FineTuneWeights>`
- Computes effective weights:
  - If `fine_tune_weights` is Some: use directly (normalized to 0–1)
  - If None: derive from slider (linear interpolation: `survivability = (100 - position) / 100`, `damage = position / 100`, `speed = 0`)
- Includes weights as named context in the optimization prompt: "Optimization intent: {N}% survivability, {M}% damage, {P}% speed"
- When "Enforce level budget" ON: includes character level, available passive points, and per-skill levels as hard constraints in the prompt

---

### Decision 7: Weaver Tree Renderer (Spike-Gated)

**Gate condition:** A dedicated research spike story confirms:
1. Machine-readable Weaver Tree node data exists in community sources
2. Node coordinate format is compatible with existing PixiJS layout algorithm
3. Point pool mechanics are documented

**If spike succeeds:**
- Weaver Tree uses the same `SkillTreeCanvas` component with `treeLayout: 'weaver'`
- A new layout algorithm (`weaverLayout`) is added to `pixiRenderer.ts` implementing the web/radial pattern
- Weaver Tree data loaded via `useGameDataStore` like any other tree
- Tab added to the center panel tab bar: `Weaver Tree` (rightmost)
- Weaver has its own point pool, tracked in `useBuildStore.weaverAllocations: Record<string, number>`

**If spike fails:**
- `WeaverTreePlaceholder.tsx` — a static message: "Weaver Tree planning is in research. Data sourcing is in progress."
- The Weaver Tree tab is shown but renders the placeholder; no crash, no error toast
- The tab is always present in the UI so the layout is consistent

**Architecture supports both paths:** The tab rendering in the center panel switches on `useGameDataStore.weaverTreeData !== null`. If null (spike failed), renders placeholder. If non-null (spike succeeded), renders `SkillTreeCanvas` with Weaver props.

---

### Decision 8: Skill Picker Grid Architecture

**Technology:** React DOM (not PixiJS) — the skill picker is an overlay/dropdown, not a canvas element.

**Visual continuity:** Uses hexagonal clip-path CSS (`clip-path: polygon(...)`) matching the PixiJS node shape, so picker icons look identical to tree nodes. The hex clip-path is defined as a CSS custom property: `--hex-clip-path`.

**Data source:** `useGameDataStore.classData[classId].skills` — all active skills for the selected class and mastery. Filtered by the active tab's mastery constraints.

**Organization (matching lastepochtools.com pattern):**
```
Section: "{BaseClassName} Skills" (base class skills, no mastery gate)
Section: "{Mastery1Name} Skills" (requires mastery selection, shows point gate badges)
Section: "{Mastery2Name} Skills"
Section: "{Mastery3Name} Skills"
```

**Mastery-gate badge:** Absolute-positioned pill overlay on the skill hex, showing required points (5, 10, 15, 20, 25, 35). Uses `--color-badge-mastery-gate` token. Badge is not interactive.

**Skill picker trigger:** Clicking an active skill tab that has a skill assigned opens the picker as a popover anchored to the tab. Clicking a tab with no skill assigned shows the picker in the center panel inline. ESC closes.

**Icon source:** Same `useIconTextures`-style fetch, but for HTML `<img>` elements (not PixiJS Textures). Rust returns the local cache path; `<img src={localPath}>` renders it. If icon path is null: placeholder hex div with `--color-node-available` fill.

---

### Decision 9: Character Level & Budget System

**New `useBuildStore` fields:**
```typescript
interface BuildStore {
  // ... existing fields ...
  characterLevel: number;              // 1–100, default 1
  budgetEnforced: boolean;             // default false
  activeSkillLevels: Record<string, number>;  // slotId → level 1–20, default 1
  // Derived (not stored — computed from above):
  // availablePassivePoints = f(characterLevel)
  // allocatedPassivePoints = sum of all passive nodeAllocations
  // unspentPassivePoints = availablePassivePoints - allocatedPassivePoints
}
```

**Passive point budget formula:**
The exact formula for passive points per level is a research item. Based on community data, the standard Last Epoch formula is approximately: `points = characterLevel + 20` (each level grants 1 passive point; the first 20 are from the base allocation). This will be confirmed during data spike and hardcoded in a utility function `calculatePassivePoints(level: number): number`.

**Budget enforcement in `applyNodeChange`:**
When `budgetEnforced = true` and `delta = +1`:
- Compute `unspentPassivePoints`
- If `unspentPassivePoints <= 0`, block the allocation and return without changes
- No error toast — the UI shows `0 points remaining` in the counter (signal is sufficient)

**Skill tree budget:**
- `activeSkillLevels[slotId]` → maps to max allocatable points for that skill (formula TBD in data spike)
- Approximation: each skill level grants 1 skill tree point (confirmed at implementation)

**AI context when enforced:**
Optimization command payload includes:
```json
{
  "characterLevel": 85,
  "availablePassivePoints": 105,
  "allocatedPassivePoints": 102,
  "unspentPassivePoints": 3,
  "activeSkillLevels": { "slot1": 20, "slot2": 15 }
}
```

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**New Rust commands (snake_case, registered in `lib.rs`):**
```
detect_steam_path
extract_skill_icons
fetch_cdn_icon
get_icon_cache_path
initialize_icon_pipeline
load_item_database
check_item_data_freshness
update_item_data
```

All follow the Phase 1 pattern: `invoke_handler!` registration, `AppResult<T>` return type, error strings prefixed with the error category (`"ICON_ERROR: ..."`, `"ITEM_DATA_ERROR: ..."`).

**New TypeScript `invokeCommand` calls:**
```typescript
// Always use invokeCommand<T>, never raw invoke()
invokeCommand<string | null>('get_icon_cache_path', { skillId })
invokeCommand<ItemDatabase>('load_item_database')
invokeCommand<FreshnessStatus>('check_item_data_freshness')
```

**New ErrorType enum values (added to `src/shared/utils/errorNormalizer.ts`):**
```typescript
ICON_ERROR = 'ICON_ERROR',     // matches Rust prefix "ICON_ERROR: "
ITEM_DATA_ERROR = 'ITEM_DATA_ERROR',  // matches Rust prefix "ITEM_DATA_ERROR: "
```

**New Zustand store extension pattern:**
```typescript
// Always extend existing stores, never create new top-level stores
// Pattern: add slice to existing store using the existing create<Interface>() pattern
interface GameDataStore {
  // ... existing Phase 1 fields ...
  itemDatabase: ItemDatabase | null;    // new
  weaverTreeData: TreeData | null;      // new (null if spike failed)
}
```

**New feature folder naming (kebab-case, no barrel files):**
```
src/features/skill-picker/
src/features/icon-pipeline/
src/features/item-database/
src/features/weaver-tree/
src/features/optimization-panel/
src-tauri/src/commands/icon_commands.rs
src-tauri/src/commands/item_commands.rs
```

**New Tauri event names (feature:action pattern):**
```
icon-pipeline:initialized     // emitted after initialize_icon_pipeline completes
item-data:freshness-checked   // emitted with FreshnessStatus after launch check
item-data:updated             // emitted after successful update_item_data
```

### Structure Patterns

**Icon texture loading pattern (mandatory for all icon consumers):**
1. Parent component calls `useIconTextures(skillIds)` → receives `Map<string, Texture>`
2. Parent passes map to `SkillTreeCanvas` via `iconTextures` prop
3. `SkillTreeCanvas` passes individual textures to draw functions per node
4. Never load `PixiJS.Assets` inside `SkillTreeCanvas` or `pixiRenderer.ts`

**Item search pattern (mandatory):**
1. Item database loaded once at startup into `useGameDataStore.itemDatabase`
2. All search done in TypeScript via `itemSearch.ts` functions
3. Never call a Rust command for search — latency requirement (≤50ms) cannot tolerate IPC
4. Components receive search results via local component state, not store

**Data update pattern (atomic, mandatory for all data file updates):**
```rust
// Always: write to temp → rename (atomic on same filesystem)
let temp_path = data_path.with_extension("tmp");
fs::write(&temp_path, &content)?;
fs::rename(&temp_path, &data_path)?;
// Never: fs::write directly to the final path
```

**Staleness banner pattern (extend Phase 1 pattern):**
- Game data freshness: `useGameDataStore.isGameDataStale: boolean`
- Item data freshness: `useGameDataStore.isItemDataStale: boolean` (new)
- Both drive the same `StalenessBar` component via separate props; component renders two banners stacked if both stale

### Format Patterns

**Icon manifest entry (append to existing manifest.json):**
```json
{
  "schemaVersion": 2,
  "gameVersion": "1.4.4",
  "dataVersion": "1.0.0",
  "generatedAt": "2026-05-06T00:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"],
  "itemDataVersion": "1.0.0",
  "iconCacheVersion": "1.0.0",
  "iconSource": "game-files | community-cdn | placeholder"
}
```

**AI optimization prompt payload (Phase 2 additions):**
```typescript
interface OptimizationPayload {
  // Phase 1 fields (unchanged)
  buildContext: string;
  goal: string;
  // Phase 2 additions
  sliderPosition: number;         // 0–100
  fineTuneWeights?: FineTuneWeights;
  levelContext?: LevelContext;    // only when budgetEnforced = true
  structuredGear: StructuredGearSlot[];  // replaces free-text gear
}
```

**StructuredGearSlot format for AI prompt:**
```typescript
interface StructuredGearSlot {
  slot: string;
  itemName: string;
  affixes: { name: string; tier?: number; value?: number }[];
  // Free-text fallback: affixes array with tier=undefined and value=undefined
}
```

### Communication Patterns

**Icon pipeline initialization sequence:**
1. App startup: `invokeCommand('initialize_icon_pipeline')` called alongside game data load
2. Rust emits `icon-pipeline:initialized` event with `IconPipelineStatus` when complete
3. TypeScript `useIconTextures` hook subscribes to this event before loading any textures
4. Tree components mount only after icon pipeline status is known (loading spinner on tree mount, not on app startup)

**Budget counter update pattern:**
- `unspentPassivePoints` is derived (not stored) — computed in the store's selector
- Components subscribe to `useComputedBudget` hook that derives counts from `characterLevel`, `nodeAllocations`, and `budgetEnforced`
- Counter re-renders on every node allocation change (automatic via Zustand selector)

### Process Patterns

**Icon pipeline failure recovery:**
```
Level 1: Game file extraction fails → fall back to CDN silently (no user notification)
Level 2: CDN fetch fails → render placeholder fill color (no user notification)
Level 3: If ALL icons fail placeholder → no change; app continues fully functional
```
Never show a toast or error for icon failures. Log to console in debug mode only.

**Item database load failure recovery:**
- If `load_item_database()` returns error: `useGameDataStore.itemDatabase = null`
- All gear slot components detect `itemDatabase === null` and render in free-text mode
- No error toast — slots simply show free-text inputs with a muted "Database unavailable" label
- Retry on next app launch (no in-session retry)

**Multi-point node allocation error pattern:**
- Prerequisite blocked on increment: canvas emits `onNodeClick(nodeId, 0)` → store validates → returns `false` → canvas receives no allocation change → briefly flashes node in `--color-node-locked` state (150ms, skip if `reducedMotion`)
- Prerequisite blocked on decrement: same flash pattern
- No toast for allocation errors — the visual flash is the feedback

**Enforcement Guidelines — All AI Agents MUST:**

1. Never call `PixiJS.Assets.load()` inside `SkillTreeCanvas` or `pixiRenderer.ts` — textures are always passed via props
2. Never create a new top-level Zustand store — extend existing stores only
3. Never call raw `invoke()` — always `invokeCommand<T>()`
4. Never write to Steam directories — read-only access only
5. Always use `migrateBuildState` when loading builds from SQLite — never skip migration
6. Never add a barrel file (`index.ts`) in any `src/features/*` folder
7. Always use `invokeCommand<T>('register_icon_commands', ...)` pattern for new Rust commands
8. Never debounce the item typeahead search — it must be synchronous on loaded data

---

## Project Structure & Boundaries

### Phase 2 Extensions to Existing Structure

Phase 2 adds to the existing Phase 1 directory tree. Only new additions are shown:

```
LEBOv2/                                (project root)
├── src/
│   ├── features/
│   │   ├── skill-tree/               (Phase 1 — extended)
│   │   │   ├── SkillTreeCanvas.tsx   (MODIFIED: new props for iconTextures, nodeAllocations, treeLayout)
│   │   │   ├── pixiRenderer.ts       (MODIFIED: icon rendering, multi-point counter, weaver layout)
│   │   │   └── ...                   (existing files unchanged)
│   │   │
│   │   ├── skill-picker/             (NEW — Pillar 1)
│   │   │   ├── SkillPickerGrid.tsx
│   │   │   ├── SkillPickerGrid.test.tsx
│   │   │   ├── SkillCard.tsx
│   │   │   └── useSkillPicker.ts
│   │   │
│   │   ├── icon-pipeline/            (NEW — Pillar 1)
│   │   │   ├── iconPipeline.ts        (orchestration logic)
│   │   │   ├── iconPipeline.test.ts
│   │   │   └── useIconTextures.ts     (hook: returns Map<skillId, Texture>)
│   │   │
│   │   ├── item-database/            (NEW — Pillar 2)
│   │   │   ├── itemDatabaseLoader.ts  (invokeCommand wrapper)
│   │   │   ├── itemSearch.ts          (in-memory fuzzy search)
│   │   │   ├── itemSearch.test.ts
│   │   │   ├── GearSlot.tsx
│   │   │   ├── GearSlot.test.tsx
│   │   │   ├── AffixTierControl.tsx
│   │   │   ├── AffixTierControl.test.tsx
│   │   │   └── AffixPicker.tsx        (custom affix addition combobox)
│   │   │
│   │   ├── weaver-tree/              (NEW — Pillar 1, spike-gated)
│   │   │   ├── WeaverTreePlaceholder.tsx   (always present)
│   │   │   └── weaverLayout.ts            (only if spike succeeds)
│   │   │
│   │   ├── optimization-panel/       (NEW — Pillar 3)
│   │   │   ├── OptimizationSlider.tsx
│   │   │   ├── OptimizationSlider.test.tsx
│   │   │   ├── FineTunePanel.tsx
│   │   │   └── FineTunePanel.test.tsx
│   │   │
│   │   └── build-manager/            (Phase 1 — extended)
│   │       ├── buildPersistence.ts   (MODIFIED: migrateBuildState v1→v2)
│   │       └── ...                   (existing files unchanged)
│   │
│   ├── shared/
│   │   ├── stores/
│   │   │   ├── gameDataStore.ts      (MODIFIED: +itemDatabase, +weaverTreeData)
│   │   │   ├── buildStore.ts         (MODIFIED: +characterLevel, +budgetEnforced, +activeSkillLevels, +weaverAllocations)
│   │   │   └── optimizationStore.ts  (MODIFIED: +sliderPosition, +fineTuneWeights)
│   │   │
│   │   ├── types/
│   │   │   ├── buildState.ts         (MODIFIED: BuildState schemaVersion 2, GearItemV2, AffixEntryV2)
│   │   │   ├── itemDatabase.ts       (NEW: ItemDatabase, BaseItem, UniqueItem, AffixEntry)
│   │   │   └── iconPipeline.ts       (NEW: IconPipelineStatus, IconSource)
│   │   │
│   │   └── utils/
│   │       ├── errorNormalizer.ts    (MODIFIED: +ICON_ERROR, +ITEM_DATA_ERROR)
│   │       └── budgetCalculator.ts   (NEW: calculatePassivePoints, calculateSkillPoints)
│   │
│   └── components/                   (Phase 1 shared components — existing)
│       └── StalenessBar.tsx          (MODIFIED: +isItemDataStale prop)
│
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── icon_commands.rs      (NEW: detect_steam_path, extract_skill_icons, fetch_cdn_icon,
│   │   │   │                          get_icon_cache_path, initialize_icon_pipeline)
│   │   │   ├── item_commands.rs      (NEW: load_item_database, check_item_data_freshness, update_item_data)
│   │   │   └── ...                   (Phase 1 commands unchanged)
│   │   └── lib.rs                    (MODIFIED: register new commands in invoke_handler!)
│   │
│   └── resources/
│       ├── game-data/               (Phase 1 — unchanged)
│       └── items/                   (NEW — bundled at build time)
│           ├── base-items.json
│           ├── uniques.json
│           └── affixes.json
│
└── {app_data}/lebo/                  (runtime — not in repo)
    ├── game-data/
    │   └── manifest.json             (EXTENDED: +itemDataVersion, +iconCacheVersion, +iconSource)
    ├── items/                        (NEW: copied from resources on first launch)
    │   ├── base-items.json
    │   ├── uniques.json
    │   └── affixes.json
    └── icons/                        (NEW: populated by icon pipeline)
        ├── skills/                   ({skill_id}.png)
        └── items/                    (future / best-effort)
```

### Architectural Boundaries

**Icon Pipeline Boundary:**
- Rust side: all file I/O (Steam path detection, asset extraction, CDN HTTP fetch, cache write)
- TypeScript side: all PixiJS texture loading, texture map management, prop propagation
- Boundary crossing: local file path string passed from Rust → TypeScript → PixiJS Assets.load(path)
- No binary data crosses the IPC boundary — only file paths

**Item Database Boundary:**
- Rust side: file I/O (read JSON from disk, parse with serde, return deserialized struct), freshness check HTTP
- TypeScript side: all search, filtering, UI rendering of results
- Boundary crossing: `ItemDatabase` struct (JSON-serializable) returned via `invokeCommand`
- Search never crosses back to Rust — TypeScript-only after initial load

**Optimization Slider Boundary:**
- TypeScript side: slider UI, state management (`useOptimizationStore`), weight computation
- Rust side: prompt construction using the weights, API call, streaming response
- Boundary crossing: `OptimizationPayload` (slider position, fine tune weights, gear, level context) sent to Rust via `invokeCommand`

**BuildState Migration Boundary:**
- All migration logic in TypeScript (`buildPersistence.ts`)
- Rust stores and retrieves raw JSON; it does not version-check or migrate
- Migration happens exclusively in TypeScript before the build enters the Zustand store

### Requirements to Structure Mapping

**Pillar 1 — Skill Tree Fidelity:**
| Requirement | Location |
|-------------|----------|
| Icon-accurate PixiJS nodes (FR1, FR2) | `pixiRenderer.ts` (modified) + `useIconTextures.ts` |
| Skill picker grid with mastery badges (FR5, FR11) | `skill-picker/SkillPickerGrid.tsx` |
| Multi-point left/right-click (FR13–FR17) | `buildStore.ts` (applyNodeChange) + `pixiRenderer.ts` |
| Character level budget (FR18–FR22) | `buildStore.ts` + `budgetCalculator.ts` + `BudgetToggle.tsx` |
| Search within trees (FR7) | Existing Phase 1 pattern, extended to new tree types |
| RESET per tree (FR8) | Existing Phase 1 pattern, extended |
| Weaver Tree (FR3) | `weaver-tree/` folder — conditional on spike |
| Icon pipeline (FR43–FR49) | `icon-pipeline/` + `icon_commands.rs` |

**Pillar 2 — Item Database:**
| Requirement | Location |
|-------------|----------|
| Local item DB load (FR23) | `item_commands.rs` + `itemDatabaseLoader.ts` + `gameDataStore.ts` |
| Typeahead search (FR24) | `item-database/itemSearch.ts` + `GearSlot.tsx` |
| Tier sliders (FR26) | `item-database/AffixTierControl.tsx` |
| Custom affix addition (FR27) | `item-database/AffixPicker.tsx` |
| Free-text fallback (FR30) | `GearSlot.tsx` (toggles to textarea mode) |
| Structured AI context (FR31) | `optimization_commands.rs` prompt builder |
| Item freshness (FR33, FR48) | `item_commands.rs` + `gameDataStore.ts` + `StalenessBar.tsx` |
| BuildState v2 migration (FR51–FR54) | `buildPersistence.ts` (migrateBuildState) + `buildState.ts` types |

**Pillar 3 — Optimization UX:**
| Requirement | Location |
|-------------|----------|
| Glass Cannon ↔ Juggernaut slider (FR34) | `optimization-panel/OptimizationSlider.tsx` + `optimizationStore.ts` |
| Fine Tune panel (FR35) | `optimization-panel/FineTunePanel.tsx` |
| Backward compat mapping (FR36) | `migrateBuildState` in `buildPersistence.ts` |
| Level-budget-aware AI (FR37–FR38) | `optimizationStore.ts` payload builder |

### Data Flow

**Icon rendering data flow (startup):**
```
initialize_icon_pipeline (Rust)
  → detect_steam_path → extract / fetch_cdn → cache to disk
  → emit "icon-pipeline:initialized"
  ↓
useIconTextures (TS) subscribes
  → get_icon_cache_path for active tree's skill IDs
  → PixiJS.Assets.load(localPaths[])
  → Map<skillId, Texture> populated
  ↓
SkillTreeCanvas receives iconTextures prop
  → pixiRenderer draws icons in nodes
```

**Item search data flow:**
```
load_item_database (Rust)
  → deserialize base-items.json, uniques.json, affixes.json
  → return ItemDatabase
  ↓
gameDataStore.itemDatabase = result
  ↓
GearSlot (TS) user types
  → itemSearch(query, itemDatabase)
  → ranked results rendered in Combobox dropdown
```

**Build save data flow (Phase 2):**
```
useBuildStore.saveBuild()
  → serialize BuildState v2 (schemaVersion: 2)
  → invokeCommand('save_build', { id, data: JSON.stringify(state) })
  → Rust: rusqlite INSERT/UPDATE
```

**Build load data flow (Phase 2):**
```
invokeCommand('load_build', { id })
  → Rust: rusqlite SELECT → return raw JSON
  ↓
buildPersistence.migrateBuildState(rawJson)
  → if schemaVersion === 1: upgrade gear fields
  → return BuildState v2
  ↓
useBuildStore.loadBuild(migratedBuild)
  → all components re-render with v2 data
```

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All Phase 2 decisions extend Phase 1 without contradiction:
- Icon pipeline (Decision 1) uses existing Rust command pattern and existing PixiJS props-only contract
- `nodeAllocations` type upgrade (Decision 2) is a single breaking change to one interface, tracked through all consumers
- BuildState v2 migration (Decision 3) extends `migrateBuildState` function that already exists for Phase 1 schema changes
- Item database (Decision 4) uses the same game-data loading pattern established in Phase 1
- Optimization slider (Decision 6) extends `useOptimizationStore` which is one of the 4 permitted stores

**Pattern Consistency:**
- All new Rust commands follow `snake_case`, return `AppResult<T>`, and are registered in `lib.rs`
- All new TypeScript calls use `invokeCommand<T>()` — no raw `invoke()`
- All new feature folders follow `kebab-case/` with no barrel files
- All new store extensions use existing `create<Interface>()` pattern without new top-level stores
- All new components use existing CSS token variables, not raw color values

**Structure Alignment:**
- The four-store constraint is maintained (extending existing stores only)
- SkillTreeCanvas props-only contract is maintained (textures passed via props, loaded outside)
- No barrel files introduced
- No new routing added (Weaver Tree is a tab in the existing tab system)
- WebGL patch not re-injected

### Requirements Coverage Validation ✅

**Functional Requirements (55 FRs):**
All 55 FRs are architecturally supported:
- FR1–FR10 (tree rendering): covered by `pixiRenderer.ts` modifications and `useIconTextures`
- FR11–FR17 (active skill management): covered by `SkillPickerGrid` and modified `applyNodeChange`
- FR18–FR22 (budget system): covered by `useBuildStore` extensions and `budgetCalculator.ts`
- FR23–FR33 (item database): covered by `item_commands.rs`, `itemSearch.ts`, `GearSlot`, `AffixTierControl`
- FR34–FR42 (optimization UX): covered by `OptimizationSlider`, `FineTunePanel`, `optimizationStore.ts` extensions
- FR43–FR50 (data pipeline): covered by `icon_commands.rs` and the two-path icon pipeline
- FR51–FR55 (build persistence): covered by `migrateBuildState` and BuildState v2 schema

**Non-Functional Requirements:**
- Performance ≥60fps: Icon textures in PixiJS Assets cache (no per-frame network calls); 5 shared Graphics draw calls maintained from Phase 1 benchmark
- Icon load ≤200ms: Textures loaded from local cache before tree is interactive; progressive rendering with placeholder fills
- Item search ≤50ms: In-memory TypeScript search on ~440KB corpus — significantly under limit
- API key security: Unchanged from Phase 1 — all Claude/OpenRouter calls in Rust
- Lossless migration: `migrateBuildState` handles all Phase 1 save variants with explicit test coverage required
- Atomic updates: All Rust data writes use temp-file-then-rename pattern

**Weaver Tree coverage:** FR3 (Weaver Tree) is architecturally supported with a spike gate. The `weaverTreeData: TreeData | null` in `useGameDataStore` and `WeaverTreePlaceholder.tsx` cover both spike outcomes. No implementation is blocked waiting for the spike.

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All 9 critical decisions are documented with specific types, function signatures, and data formats
- All new Rust commands are named and their return types specified
- All store extensions are specified with TypeScript interface additions
- Icon pipeline failure modes are specified at three levels (game files → CDN → placeholder)

**Structure Completeness:**
- All new feature folders identified with their component files
- All modified existing files identified with the nature of each modification
- App data directory structure documented with new additions
- Build-time resource bundling location specified (`src-tauri/resources/items/`)

**Pattern Completeness:**
- All potential agent conflict points addressed: naming, atomic writes, IPC pattern, store extension
- Icon pipeline data flow fully specified (Rust → TypeScript → PixiJS)
- Item database data flow fully specified (Rust → TypeScript store → component)
- Migration data flow fully specified (SQLite → TypeScript migration → store)

### Gap Analysis Results

**Critical Gaps — None.** All Phase 2 FRs have architectural coverage.

**Important Gaps (addressed in implementation stories):**

1. **Passive point budget formula:** `calculatePassivePoints(level)` formula needs verification against actual Last Epoch game data. Architecture provides the hook; story must confirm the formula. Approximation: `level + 20`.

2. **Icon extraction feasibility:** `extract_skill_icons` command requires a research spike to confirm Unity asset bundle parsing in Rust. The CDN fallback guarantees icons are always available regardless of spike outcome.

3. **Weaver Tree data:** Spike story required before `weaverLayout.ts` is implemented. Architecture provides the gate (`weaverTreeData === null` → placeholder).

4. **CDN URL format for icons:** The exact URL pattern for lastepochtools.com / tunklab.com skill icon assets needs confirmation during the icon pipeline story. Pattern assumption: `https://assets.lastepochtools.com/skills/{skill_id}.png` — to be validated.

**Nice-to-Have Gaps (post-Phase 2):**
- Item icon caching (`icons/items/`) is architecturally stubbed but not implemented in Phase 2
- Steam Library custom paths (Steam libraries on non-C: drives) — the current architecture detects the default path only; non-standard install locations may miss

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] All 55 Phase 2 FRs analyzed for architectural implications
- [x] All NFRs (performance, security, reliability, accessibility) addressed
- [x] Brownfield constraints validated — no Phase 1 rules violated
- [x] Cross-cutting concerns (icon pipeline, item DB, schema migration, Weaver gate) mapped

**✅ Architectural Decisions**
- [x] 9 critical decisions documented with types, signatures, and data formats
- [x] All new Rust commands named and typed
- [x] All store extensions specified
- [x] Failure modes specified at each pipeline layer
- [x] Backward compatibility explicitly mapped (Phase 1 presets → slider positions)

**✅ Implementation Patterns**
- [x] Naming conventions (Rust commands, TypeScript, stores, feature folders) established
- [x] Icon pipeline data flow: Rust → TypeScript → PixiJS
- [x] Item search pattern: Rust load → TypeScript in-memory search
- [x] Migration pattern: SQLite read → `migrateBuildState` → store
- [x] Atomic write pattern: temp file → rename
- [x] Error degradation pattern: game files → CDN → placeholder

**✅ Project Structure**
- [x] All new feature folders specified
- [x] All modified existing files identified
- [x] App data directory extensions specified
- [x] Build-time resource bundling location specified
- [x] All 55 FRs mapped to specific files/components

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

Phase 2 is a well-bounded brownfield extension. All three pillars have clear architectural paths. The two research spikes (icon extraction, Weaver Tree data) are properly gated — neither blocks any other epic's implementation. The CDN fallback guarantees icon delivery regardless of the icon extraction spike outcome.

**Key Strengths:**
- Props-only `SkillTreeCanvas` contract maintained — icon textures integrated without breaking the boundary
- Four-store constraint maintained — all Phase 2 state fits in extensions of existing stores
- Lossless migration design is fully specified — no Phase 1 user data at risk
- In-memory item search avoids IPC latency for the 50ms typeahead requirement
- Three-level icon pipeline degradation means the app is never blocked by asset availability

**Areas for Future Enhancement (Phase 3+):**
- Item icons (`icons/items/`) — stubbed but not implemented
- Steam Library custom path detection (non-C: drives)
- EHG official API integration when publicly available (replaces static bundle)
- Meta context integration ("current S-tier meta") requiring external community data

### Implementation Handoff

**AI Agent Guidelines:**
- Read `project-context.md` before implementing any code — its 47 rules remain in force
- This architecture document is the Phase 2 addition to those rules
- Follow all patterns exactly as documented: props-only canvas, no barrel files, invokeCommand only, 4 stores max
- For any decision not documented here, default to the Phase 1 pattern in `project-context.md`

**Implementation Sequence:**
1. Epic: Skill picker grid + multi-point node allocation (prerequisite validation refactor)
2. Epic: Icon pipeline (research spike → CDN fallback guaranteed → game file extraction if spike succeeds)
3. Epic: Character level budget system
4. Epic: Weaver Tree research spike → render or placeholder
5. Epic: Item database load + typeahead search + tier sliders
6. Epic: BuildState schema v2 + migration + structured AI context
7. Epic: Glass Cannon ↔ Juggernaut slider + Fine Tune panel + level-budget-aware optimization

**First Implementation Action:**
Run `bmad-create-epics-and-stories` to break these seven epics into implementable user stories with acceptance criteria derived from this architecture and the Phase 2 PRD.

---

## Phase 2 Workflow Progress

| Step | Skill | Status |
|------|-------|--------|
| 1 | `bmad-create-prd` | `[x] Complete` |
| 2 | `bmad-create-ux-design` | `[x] Complete` |
| 3 | `bmad-create-architecture` | `[x] Complete` |
| 4 | `bmad-create-epics-and-stories` | `[ ] Not Started` |
| 5 | `bmad-check-implementation-readiness` | `[ ] Not Started` |
| 6 | `gds-sprint-planning` | `[ ] Not Started` |
| 7 | Dev Loop | `[ ] Not Started` |
