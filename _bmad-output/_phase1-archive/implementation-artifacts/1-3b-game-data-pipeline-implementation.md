# Story 1.3b: Game Data Pipeline — Implementation

Status: done

## Story

As an advanced Last Epoch player,
I want the app to load the complete skill tree and passive tree data for all 5 classes and 15 masteries at startup,
So that I can view any class tree without waiting for on-demand network requests during my session.

**Prerequisite gate:** Story 1.3a is `done` and `docs/game-data-source.md` exists. ✅ Cleared.

## Acceptance Criteria

1. **Given** the game data pipeline is implemented **When** the application launches for the first time after install **Then** all 5 classes (Sentinel, Mage, Primalist, Acolyte, Rogue) and their 15 masteries load successfully **And** the load completes within ≤ 10 seconds (NFR5) **And** the loaded data includes for each node: node ID, name, point cost, max points, prerequisite node IDs, effect description, tags, and position coordinates for tree layout

2. **Given** game data files are present in the app data directory **When** the user launches the app with no network connection **Then** game data loads successfully from local cache **And** no network error is shown for game data (staleness detection is separate and non-blocking — Story 1.7)

3. **Given** `useGameDataStore` is populated **When** any feature reads `useGameDataStore.gameData` **Then** all class and mastery data is accessible by classId and masteryId **And** the data follows the architecture format: versioned JSON per class in app data directory; `manifest.json` tracking `gameVersion`, `dataVersion`, `generatedAt`, `classes[]`

4. **Given** the app launches with no existing game data directory (first launch) **When** startup runs **Then** bundled resources from `src-tauri/resources/game-data/` are copied to `{app_data_dir}/lebo/game-data/` **And** the manifest check gates the copy (skip if `manifest.json` already exists in app data dir)

5. **Given** the game data load fails (I/O error, corrupt JSON) **When** the error is caught **Then** `useGameDataStore.isLoading` is set to false **And** a `STORAGE_ERROR` `AppError` is thrown (no silent swallowing) **And** the app does NOT crash — the tree canvas shows the empty state from Story 1.1

## Tasks / Subtasks

- [x] Task 1: Update `src/shared/types/gameData.ts` — add `size` field to `GameNode` (AC: 1, 3)
  - [x] Add `size: 'small' | 'medium' | 'large'` field to `GameNode` interface (required by Story 1.4 renderer mapping)
  - [x] Add `schemaVersion: number` to `GameDataManifest` interface (matches JSON format spec)
  - [x] Add `pointCost: number` field if not present (always 1 for LE nodes — hardcoded in transformer, but kept as typed field for future-proofing)

- [x] Task 2: Create `src-tauri/src/models/game_data.rs` — Rust deserialization models (AC: 1, 3)
  - [x] Define `NodeEffect`: `{ description: String, tags: Vec<String> }` with `#[derive(Debug, Deserialize, Serialize, Clone)]`
  - [x] Define `RawGameNode`: matches JSON node schema exactly (`id`, `name`, `x`, `y`, `size`, `max_points`, `effects`) — used for JSON deserialization only
  - [x] Define `RawTreeData`: `{ nodes: Vec<RawGameNode>, edges: Vec<RawEdge> }` where `RawEdge = { from_id: String, to_id: String }`
  - [x] Define `RawMastery`: `{ id: String, name: String, passive_tree: RawTreeData }`
  - [x] Define `RawClassData`: `{ id: String, name: String, base_tree: RawTreeData, masteries: Vec<RawMastery> }`
  - [x] Define `GameDataManifest`: `{ schema_version: u32, game_version: String, data_version: String, generated_at: String, classes: Vec<String> }`
  - [x] All structs use `#[serde(rename_all = "camelCase")]` — JSON keys are camelCase, Rust fields snake_case
  - [x] Export from `pub mod game_data` in `models/mod.rs`

- [x] Task 3: Create `src-tauri/src/services/game_data_service.rs` — initialization + load logic (AC: 2, 4)
  - [x] `pub fn ensure_game_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String>` — returns `{app_data_dir}/lebo/game-data/` path, creating dirs if needed
  - [x] `pub fn copy_bundled_resources(app_handle: &tauri::AppHandle) -> Result<(), String>` — reads each bundled resource file using `app_handle.path().resource_dir()` and copies to app data dir; skips if `manifest.json` already present
  - [x] `pub fn load_manifest(data_dir: &Path) -> Result<GameDataManifest, String>` — reads and deserializes `manifest.json`
  - [x] `pub fn load_class_data(data_dir: &Path, class_id: &str) -> Result<RawClassData, String>` — reads and deserializes `classes/{class_id}.json`
  - [x] Use `std::fs::read_to_string` + `serde_json::from_str` for all file reads
  - [x] All errors return `String` (serializable over Tauri IPC); wrap `std::io::Error` and `serde_json::Error` with context messages
  - [x] Export from `pub mod game_data_service` in `services/mod.rs`

- [x] Task 4: Create `src-tauri/src/commands/game_data_commands.rs` — Tauri command handlers (AC: 1, 2, 3)
  - [x] `#[tauri::command] pub async fn get_manifest(app_handle: tauri::AppHandle) -> Result<GameDataManifest, String>`
  - [x] `#[tauri::command] pub async fn load_game_data(app_handle: tauri::AppHandle, class_id: Option<String>) -> Result<Vec<RawClassData>, String>`
  - [x] `#[tauri::command] pub async fn initialize_game_data(app_handle: tauri::AppHandle) -> Result<(), String>`
  - [x] `#[tauri::command] pub async fn check_data_freshness(_app_handle: tauri::AppHandle) -> Result<bool, String>` — stub, always returns Ok(false)
  - [x] Export all 4 commands from `pub mod game_data_commands` in `commands/mod.rs`

- [x] Task 5: Update `src-tauri/src/lib.rs` — register game data commands (AC: 1)
  - [x] Import all 4 command handlers
  - [x] Add all 4 to `tauri::generate_handler![]`
  - [x] Note: `path` feature flag is NOT needed in Tauri 2.x — Manager trait provides `app_handle.path()` by default
  - [x] Existing plugins preserved: `tauri_plugin_opener`, `tauri_plugin_sql`, `tauri_plugin_http`, `tauri_plugin_store`

- [x] Task 6: Update `src-tauri/tauri.conf.json` — add resources bundle config (AC: 4)
  - [x] Added `"resources": [...]` array listing all 6 game data files to the `bundle` section
  - [x] Note: array format used instead of glob map — Tauri 2.x build script requires files to exist at build time; glob `**` in map-key format fails with "path not found"

- [x] Task 7: Create bundled game data JSON files (AC: 1, 4)
  - [x] Created directory: `src-tauri/resources/game-data/classes/`
  - [x] Created `src-tauri/resources/game-data/manifest.json`
  - [x] Created `src-tauri/resources/game-data/classes/sentinel.json` — FULL: 15 base nodes + 31 VK + 31 FG + 31 Paladin nodes with radial positions
  - [x] Created `src-tauri/resources/game-data/classes/mage.json` — stub: 8 base + 8 nodes per mastery (Sorcerer, Spellblade, Runemaster)
  - [x] Created `src-tauri/resources/game-data/classes/primalist.json` — stub: 8 base + 8 nodes per mastery (Shaman, Druid, Beastmaster)
  - [x] Created `src-tauri/resources/game-data/classes/acolyte.json` — stub: 8 base + 8 nodes per mastery (Lich, Necromancer, Warlock)
  - [x] Created `src-tauri/resources/game-data/classes/rogue.json` — stub: 8 base + 8 nodes per mastery (Bladedancer, Marksman, Falconer)

- [x] Task 8: Create `src/features/game-data/gameDataLoader.ts` — frontend data loading orchestrator (AC: 1, 2, 3)
  - [x] `export async function initGameData(): Promise<void>` — entry point called from `App.tsx` on mount
  - [x] setIsLoading(true) → initialize_game_data → load_game_data → get_manifest → transform → setGameData → setIsLoading(false)
  - [x] try/catch: on error, setIsLoading(false) and re-throw as AppError via normalizeAppError
  - [x] All Tauri calls use `invokeCommand` (never raw invoke)

- [x] Task 9: Create `src/features/game-data/types.ts` — raw wire types from Tauri IPC (AC: 3)
  - [x] All 6 interfaces: RawNodeEffect, RawGameNode, RawEdge, RawTreeData, RawMastery, RawClassData

- [x] Task 10: Implement transform pipeline in `gameDataLoader.ts` — the type mapper (AC: 1, 3)
  - [x] `export function transformNode(raw, prereqIds)` — all field mappings per spec, tags deduplicated, pointCost always 1
  - [x] `buildPrereqMap(edges)` — builds reverse edge map for prerequisiteNodeIds
  - [x] `transformTree`, `transformClass`, `transformMastery` — full transform pipeline

- [x] Task 11: Update `src/App.tsx` — call `initGameData()` on mount (AC: 1)
  - [x] useEffect with initGameData().catch(console.error) added to root App component
  - [x] No loading spinner — isLoading flag set; Story 1.4 will consume it

- [x] Task 12: Write `src/features/game-data/gameDataLoader.test.ts` — Vitest unit tests (AC: 1, 3)
  - [x] 10 tests: command order, isLoading transitions, store population, error handling, transformNode field mapping, missing effects, tag deduplication
  - [x] All 10 tests pass

- [x] Task 13: Update `src/shared/stores/gameDataStore.test.ts` — add test for `setGameData` shape (AC: 3)
  - [x] Added shape test validating classes.acolyte.masteries.lich.nodes accessible with correct fields
  - [x] Updated existing mockGameData to include schemaVersion and size fields added in Task 1

## Dev Notes

### Critical: JSON Format ↔ TypeScript Type Mismatch

The JSON on disk (specified in `docs/game-data-source.md`) uses a different shape from the TypeScript `GameNode` type. **Never try to deserialize JSON directly into `GameNode`.** Always go through the raw types → transformer pipeline:

```
JSON file → RawClassData (Tauri/Rust deserializes) → IPC → RawClassData (TypeScript)
         → transformRawToGameData() → GameData (populated into useGameDataStore)
```

Key field mappings:
| JSON field | GameNode field | Transformation |
|---|---|---|
| `x`, `y` (flat) | `position: {x, y}` | Wrap in object |
| `effects[0].description` | `effectDescription` | Take first, default `''` |
| `effects.flatMap(e => e.tags)` | `tags` | Flatten + deduplicate |
| *(not in JSON)* | `pointCost` | Always `1` (LE constant) |
| *(edges, not on node)* | `prerequisiteNodeIds` | Build reverse-edge map |
| `max_points` / `maxPoints` | `maxPoints` | Direct (camelCase in JSON) |

### Critical: `GameNode.size` Field Gap

**`size: 'small' | 'medium' | 'large'` is NOT currently in `src/shared/types/gameData.ts`.** Story 1.4 (passive tree rendering) needs `size` to set `NODE_RADIUS` in the PixiJS renderer. Add it in Task 1 or Story 1.4 will fail. This is the most likely cross-story regression.

### Tauri Resource Access Pattern

Use `app_handle.path().resource_dir()` to get the bundled resources directory at runtime:

```rust
// In game_data_service.rs
pub fn copy_bundled_resources(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir error: {}", e))?;
    let bundled_data = resource_dir.join("resources/game-data");
    // ... copy to app_data_dir
}
```

Use `app_handle.path().app_data_dir()` for the user's app data directory:

```rust
pub fn ensure_game_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir error: {}", e))?;
    let data_dir = base.join("game-data");
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("mkdir error: {}", e))?;
    Ok(data_dir)
}
```

The `path()` API requires `tauri = { version = "2", features = ["path"] }` in `Cargo.toml`.

### Bundled Resource Copy — Idempotency

The copy logic checks for `manifest.json` existence before copying:

```rust
let manifest_path = data_dir.join("manifest.json");
if manifest_path.exists() {
    return Ok(()); // Already initialized — skip
}
// ... copy all files from bundled resources
```

This makes `initialize_game_data` safe to call on every app launch.

### `tauri.conf.json` Resources Section

Add to the `bundle` section:

```json
"resources": {
  "resources/game-data/**": "resources/game-data"
}
```

This copies the entire `game-data/` directory tree into the bundled installer and makes it accessible from `resource_dir()`.

### JSON File Format (from `docs/game-data-source.md`)

#### `manifest.json`
```json
{
  "schemaVersion": 1,
  "gameVersion": "1.4.4",
  "dataVersion": "1.0.0",
  "generatedAt": "2026-04-22T00:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"]
}
```

#### `classes/{class_id}.json` skeleton
```json
{
  "id": "sentinel",
  "name": "Sentinel",
  "baseTree": {
    "nodes": [
      {
        "id": "sentinel-base-gladiator",
        "name": "Gladiator",
        "x": 0,
        "y": 0,
        "size": "large",
        "maxPoints": 8,
        "effects": [{"description": "+4 Melee Physical Damage per point", "tags": ["MELEE", "PHYSICAL"]}]
      }
    ],
    "edges": [
      {"fromId": "sentinel-base-gladiator", "toId": "sentinel-base-shield-rush"}
    ]
  },
  "masteries": [
    {
      "id": "void_knight",
      "name": "Void Knight",
      "passiveTree": {
        "nodes": [],
        "edges": []
      }
    }
  ]
}
```

#### Node ID Scheme (from 1.3a)
Format: `{class_slug}-{tree_type}-{node_name_slug}`
- `sentinel-base-gladiator` (sentinel base tree)
- `void-knight-passive-void-blade` (mastery passive tree)
- Use kebab-case throughout; tree_type is `base` or `passive`

### Minimal Viable Data Scope (MVP)

Full data authoring (all ~540 passive nodes with accurate effect text and calculated positions) is a multi-hour manual task. For MVP:

**Sentinel** — author complete, accurate data for base tree + all 3 masteries (Void Knight, Forge Guard, Paladin). Use real LE v1.4.4 node names and effect descriptions from community references (lastepochtools.com, tunklab.com). Calculate positions using radial layout from connection graph (same algorithm as `mockTreeData.ts` — see Task below).

**Mage, Primalist, Acolyte, Rogue** — author a representative subset: 5–10 nodes per mastery tree, positioned in a small radial layout, using real node names but no exhaustive effect data. This satisfies AC1 ("loads successfully") for the pipeline demonstration. A tracked follow-up task should expand to full node coverage before Story 1.4 is started (Story 1.4 needs real data for all selected class/mastery).

Add a `// TODO: Full data authoring — ~N nodes remaining` comment to each stub class JSON.

### Position Derivation Algorithm

No machine-readable position data exists. Use the same radial layout algorithm established in `mockTreeData.ts`:

```
Center node at (0, 0)
Each tier at increasing radius (250, 550, 900, ...)
Nodes within a tier distributed evenly by angle around center
Cross-tier edges determine parent-child relationships
```

For each class tree:
1. Identify the root node (the gateway/entry node with no prerequisites)
2. Build a BFS from root, assigning tier depth
3. Position each tier's nodes at radius = tier × 280, distributed by angle
4. Root node at (0, 0)

This gives approximate positions matching the real game's layout style. Story 1.4 will fine-tune rendering once real tree images can be cross-referenced.

### IPC Command Names (Tauri snake_case → TypeScript)

Tauri auto-converts Rust command names to camelCase for `invoke()`. Register as snake_case in Rust:

| Rust handler name | TypeScript `invokeCommand()` call |
|---|---|
| `get_manifest` | `invokeCommand('get_manifest')` |
| `load_game_data` | `invokeCommand('load_game_data', { classId: null })` |
| `initialize_game_data` | `invokeCommand('initialize_game_data')` |
| `check_data_freshness` | `invokeCommand('check_data_freshness')` |

**Note:** Tauri 2.x does NOT auto-convert to camelCase in invoke by default — use exact snake_case command names as registered in `generate_handler![]`.

### File List (all files to create or modify)

**Create (new files):**
- `src-tauri/src/models/game_data.rs`
- `src-tauri/src/services/game_data_service.rs`
- `src-tauri/src/commands/game_data_commands.rs`
- `src-tauri/resources/game-data/manifest.json`
- `src-tauri/resources/game-data/classes/sentinel.json`
- `src-tauri/resources/game-data/classes/mage.json`
- `src-tauri/resources/game-data/classes/primalist.json`
- `src-tauri/resources/game-data/classes/acolyte.json`
- `src-tauri/resources/game-data/classes/rogue.json`
- `src/features/game-data/gameDataLoader.ts`
- `src/features/game-data/gameDataLoader.test.ts`
- `src/features/game-data/types.ts`

**Modify (existing files):**
- `src/shared/types/gameData.ts` — add `size` to `GameNode`, `schemaVersion` to `GameDataManifest`
- `src-tauri/src/commands/mod.rs` — add `pub mod game_data_commands;`
- `src-tauri/src/services/mod.rs` — add `pub mod game_data_service;`
- `src-tauri/src/models/mod.rs` — add `pub mod game_data;`
- `src-tauri/src/lib.rs` — register 4 commands in `invoke_handler![]`, add `path` feature
- `src-tauri/Cargo.toml` — add `features = ["path"]` to tauri dependency
- `src-tauri/tauri.conf.json` — add `resources` bundle config
- `src/App.tsx` — call `initGameData()` on mount
- `src/shared/stores/gameDataStore.test.ts` — add `setGameData` shape test

### Architecture Compliance Checklist

- [ ] All Tauri IPC calls from frontend go through `invokeCommand()` — never raw `invoke()`
- [ ] `useGameDataStore` from `src/shared/stores/gameDataStore.ts` is the ONLY place `GameData` state lives
- [ ] `gameDataLoader.ts` is NOT a React component or hook — it is a plain async module
- [ ] No barrel files (`index.ts`) anywhere in `src/`
- [ ] Rust models use `serde_json` for all serialization/deserialization
- [ ] All file I/O in Rust uses `std::fs` — no async I/O for game data (files are small)
- [ ] Tauri HTTP plugin is NOT used in this story — data is bundled, no outbound HTTP for game data in 1.3b
- [ ] `check_data_freshness` is a stub — no HTTP calls, always returns `Ok(false)`
- [ ] `DataStalenessBar.tsx` is NOT implemented in this story — deferred to Story 1.7
- [ ] `skills/` directory JSON files are NOT implemented in this story — passive tree only, skill trees in Story 1.6

### Previous Story Learnings (from 1.3a)

- `edges[]` is authoritative for node connections — `connections[]` on node was rejected in review
- Node ID scheme is `{class_slug}-{tree_type}-{node_name_slug}` (kebab-case slug) — not sequential integers
- `pointCost` is implicit (always 1) — do not put in JSON format; derive in transformer
- `dataVersion` handles schema versioning; `gameVersion` handles content versioning — keep separate
- Base tree + mastery tree share the same world coordinate space; cross-tree edges use IDs from both trees
- x, y positions are algorithmically derived (radial layout from connection graph); not from any external source

### Previous Story Learnings (from 1.2 — PixiJS spike)

- `SkillTreeCanvas` must receive data via props only — no store access inside it
- The PixiJS renderer (`pixiRenderer.ts`) has no React imports — keep this clean
- Mock data uses world-space ~3000×3000 with center at (0,0) — game data coordinates should use the same world-space convention
- The FPS counter `Text` overlay in `pixiRenderer.ts` was added for benchmarking — it should be removed before or during Story 1.4 (noted in 1.2 completion notes)

### Regression Guard — Do NOT Break

- `SkillTreeCanvas.tsx` currently renders `mockTreeData` from Story 1.2 — Story 1.3b does NOT change how the tree canvas is populated; `mockTreeData` remains in use until Story 1.4
- `src/shared/stores/gameDataStore.ts` currently exports `useGameDataStore` — adding `setGameData` call from `App.tsx` will populate the store, but nothing reads it yet (Story 1.4 will wire it to the tree)
- All 4 existing Zustand stores (`buildStore`, `gameDataStore`, `optimizationStore`, `appStore`) must compile without change (only `gameDataStore` gets new state — but the interface is already complete from Story 1.1)
- Existing Tauri plugins (`opener`, `sql`, `http`, `store`) must remain registered in `lib.rs`
- `tauri_plugin_updater` is in `Cargo.toml` but NOT currently registered in `lib.rs` — do NOT add it (not Story 1.3b scope)

### References

- Data format spec: `docs/game-data-source.md` — authoritative source for JSON structure, node ID scheme, directory layout
- Architecture decisions: `_bmad-output/planning-artifacts/architecture.md` § "Game Data — Versioned JSON in App Data Directory"
- Store interface: `src/shared/stores/gameDataStore.ts` — already has all required actions
- IPC wrapper: `src/shared/utils/invokeCommand.ts` — use for ALL Tauri calls
- Error types: `src/shared/types/errors.ts` + `src/shared/utils/errorNormalizer.ts`
- Tauri path docs: `app_handle.path().app_data_dir()` + `app_handle.path().resource_dir()` (requires `features = ["path"]` in Cargo.toml)
- Tauri resources bundling: `tauri.conf.json` `bundle.resources` key

## Review Findings

- [x] [Review][Decision] `baseTree` nodes silently discarded — fixed: added `baseTree: Record<string, GameNode>` to `ClassData`, wired `transformClass` to call `transformTree(raw.baseTree)`, added base tree test. 69 tests pass, tsc clean.
- [x] [Review][Defer] `load_game_data` Rust command reads `manifest.json` internally to resolve class list, then frontend issues a separate `get_manifest` IPC call — manifest file read twice per launch [game_data_commands.rs + gameDataLoader.ts] — deferred, minor I/O inefficiency, no correctness impact; Story 1.7 (versioning) is a natural time to consolidate
- [x] [Review][Defer] Partial-init guard: `copy_bundled_resources` skips copy if `manifest.json` exists, but does not verify `classes/` files exist — if manifest is present but class files were manually deleted, the copy is silently skipped and subsequent `load_game_data` fails [game_data_service.rs:18-20] — deferred, low-probability scenario in real usage; acceptable for MVP
- [x] [Review][Defer] `tauri.conf.json` bundle resources are an explicit file array — adding a new class requires a manual entry update [tauri.conf.json:34-41] — deferred, Tauri 2.x limitation (glob map format fails at build time, documented in Debug Log); acceptable until Tauri resolves glob support

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Tauri v2 does not have a `path` feature flag — the `Manager` trait's `.path()` method is available by default. Removed `features = ["path"]` from Cargo.toml after compile error.
- Tauri v2 build script requires resource files to exist at build time. Glob map format (`"resources/game-data/**": "resources/game-data"`) fails with "path not found." Used explicit array format instead.
- `tauri.conf.json` resources array format preserves relative directory structure from `src-tauri/`, so `resources/game-data/manifest.json` is accessible at `{resource_dir}/resources/game-data/manifest.json` at runtime.

### Completion Notes List

All 13 tasks implemented and validated. Key implementation decisions:
- `transformNode` exported for direct unit testing
- Tags deduplicated via `Set` across all effects
- `copy_bundled_resources` is idempotent — skips if manifest.json already present in app data dir
- Sentinel: complete data (15 base + 31×3 mastery nodes, radial positions). Mage/Primalist/Acolyte/Rogue: stub data (8 base + 8×3 mastery nodes) per MVP scope.
- `check_data_freshness` is a stub returning `Ok(false)` — Story 1.7 will implement real version comparison.
- TypeScript: clean (tsc --noEmit). Rust: compiles clean (cargo check). 68 frontend tests pass (14 new).

### File List

**Created:**
- `src-tauri/src/models/game_data.rs`
- `src-tauri/src/services/game_data_service.rs`
- `src-tauri/src/commands/game_data_commands.rs`
- `src-tauri/resources/game-data/manifest.json`
- `src-tauri/resources/game-data/classes/sentinel.json`
- `src-tauri/resources/game-data/classes/mage.json`
- `src-tauri/resources/game-data/classes/primalist.json`
- `src-tauri/resources/game-data/classes/acolyte.json`
- `src-tauri/resources/game-data/classes/rogue.json`
- `src/features/game-data/gameDataLoader.ts`
- `src/features/game-data/gameDataLoader.test.ts`
- `src/features/game-data/types.ts`

**Modified:**
- `src/shared/types/gameData.ts` — added `size` to `GameNode`, `schemaVersion` to `GameDataManifest`
- `src-tauri/src/commands/mod.rs` — added `pub mod game_data_commands;`
- `src-tauri/src/services/mod.rs` — added `pub mod game_data_service;`
- `src-tauri/src/models/mod.rs` — added `pub mod game_data;`
- `src-tauri/src/lib.rs` — registered 4 commands in `invoke_handler![]`
- `src-tauri/tauri.conf.json` — added `resources` array to `bundle` section
- `src/App.tsx` — added `useEffect(() => { initGameData().catch(console.error) }, [])`
- `src/shared/stores/gameDataStore.test.ts` — updated mock + added shape test
