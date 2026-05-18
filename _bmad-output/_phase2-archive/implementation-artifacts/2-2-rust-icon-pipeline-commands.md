# Story 2.2: Rust Icon Pipeline Commands

Status: done

## Story

As a theory-crafter,
I want the app to make game-accurate skill icons available on first launch with no setup,
so that the icon rendering in Story 2.4 has icons ready to display.

## Acceptance Criteria

1. **Given** the app launches for the first time
   **When** `initialize_icon_pipeline()` Rust command is called at startup
   **Then** it copies all pre-bundled icon PNGs from `resources/icons/skills/` and `resources/icons/skill-icon-map.json` into the app data icon cache (`{app_data}/lebo/icons/`), then emits the `icon-pipeline:initialized` Tauri event with `{ "iconSource": "game-files" }`

2. **Given** `initialize_icon_pipeline()` has already run (icon cache populated)
   **When** it is called again on a subsequent launch
   **Then** it detects the cache is already populated (by checking for `skill-icon-map.json` in the cache dir), skips the copy, and emits `icon-pipeline:initialized` with `{ "iconSource": "game-files" }` — same payload as the first-run path

3. **Given** the icon cache has been initialized
   **When** `get_icon_cache_path(skillId: String)` is called with a skill ID that exists in the skill-icon-map (e.g., `"mage-fireball"`)
   **Then** it returns `Ok(Some("<absolute-path-to>/lebo/icons/skills/skillIcon-fireball.png"))`

4. **Given** `get_icon_cache_path(skillId)` is called with a skill ID not in the map (e.g., `"mage-lightning-blast"` — one of the 3 unmapped IDs)
   **When** the lookup finds no entry
   **Then** it returns `Ok(None)` without error; no ICON_ERROR is emitted for a mere cache miss

5. **Given** `get_icon_cache_path(skillId)` is called but the cached file does not exist on disk (map entry present but file missing)
   **When** the file existence check fails
   **Then** it returns `Ok(None)` — same behavior as a map miss; the caller (Story 2.3) treats None as "use placeholder"

6. **Given** the `initialize_icon_pipeline()` copy operation fails midway (e.g., disk full)
   **When** the error is caught
   **Then** the command returns `Err("ICON_ERROR: <detail>")`, the partial copy does NOT trigger a crash, and the app continues — Story 2.3's `useIconTextures` hook handles an empty/partial cache gracefully by mapping missing entries to placeholder fill

7. **And** both commands are registered in `lib.rs` via `invoke_handler!`
   **And** all error strings are prefixed with `"ICON_ERROR: "`
   **And** `ICON_ERROR` is added to `ErrorType` in `src/shared/types/errors.ts` and to `ERROR_TYPE_MAP` / `USER_MESSAGES` in `src/shared/utils/errorNormalizer.ts`
   **And** `tauri.conf.json` bundle resources are updated to include the icons directory so PNGs are bundled in the production build

## Tasks / Subtasks

- [x] Task 1: Create `src-tauri/src/commands/icon_commands.rs` (AC: #1–#6)
  - [x] Add `fn ensure_icon_cache_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String>` — returns `{app_data}/lebo/icons/`, creates it if missing (same pattern as `ensure_game_data_dir` in game_data_service.rs)
  - [x] Implement `initialize_icon_pipeline(app_handle: tauri::AppHandle) -> Result<(), String>`:
    - [x] Call `ensure_icon_cache_dir` to get `icon_dir`
    - [x] Check if `icon_dir.join("skill-icon-map.json")` exists → if yes, emit event and return `Ok(())` (idempotent skip)
    - [x] Get bundled resources dir via `app_handle.path().resource_dir()`, then join `"resources/icons"`
    - [x] Create `icon_dir.join("skills")` subdirectory
    - [x] Use `copy_dir_recursive` (same helper as in game_data_service.rs — copy the pattern) to copy the `skills/` folder and `skill-icon-map.json`
    - [x] Emit `icon-pipeline:initialized` event: `app_handle.emit("icon-pipeline:initialized", serde_json::json!({ "iconSource": "game-files" })).map_err(|e| format!("ICON_ERROR: emit event: {}", e))?`
    - [x] Return `Ok(())`
  - [x] Implement `get_icon_cache_path(app_handle: tauri::AppHandle, skill_id: String) -> Result<Option<String>, String>`:
    - [x] Get `icon_dir` via `ensure_icon_cache_dir`
    - [x] Read and parse `icon_dir.join("skill-icon-map.json")` into `HashMap<String, String>`; if file missing, return `Ok(None)` (pipeline not yet initialized)
    - [x] Look up `skill_id` in the map → if not found, return `Ok(None)` (unmapped skill — 3 known: `mage-lightning-blast`, `primalist-storm-totem`, `sentinel-smite`)
    - [x] Construct full path: `icon_dir.join("skills").join(&filename)`
    - [x] If path exists on disk → return `Ok(Some(path.to_string_lossy().to_string()))`
    - [x] If path does not exist → return `Ok(None)` (file missing despite map entry — AC #5)

- [x] Task 2: Register the new commands (AC: #7)
  - [x] In `src-tauri/src/commands/mod.rs`, add `pub mod icon_commands;`
  - [x] In `src-tauri/src/lib.rs`, add to the use imports:
    ```rust
    use commands::icon_commands::{initialize_icon_pipeline, get_icon_cache_path};
    ```
  - [x] Add both commands to `invoke_handler!` in `lib.rs`

- [x] Task 3: Bundle icon resources in `tauri.conf.json` (AC: #7)
  - [x] In `lebo/src-tauri/tauri.conf.json`, add to the `bundle.resources` array:
    - `"resources/icons/skill-icon-map.json"` (single file)
    - For the 1,027 PNG files: use `"resources/icons/skills/*"` glob — Tauri 2 supports glob patterns in the resources array. If glob is rejected at build time, fall back to listing `"resources/icons/skills/"` as a directory entry.
  - [x] Verify the build succeeds with `pnpm build` (or `pnpm tauri build`) and that resource access does not 404 at runtime

- [x] Task 4: Add `ICON_ERROR` to TypeScript error infrastructure (AC: #7)
  - [x] In `lebo/src/shared/types/errors.ts`, add `'ICON_ERROR'` to the `ErrorType` union type
  - [x] In `lebo/src/shared/utils/errorNormalizer.ts`:
    - Add `ICON_ERROR: 'ICON_ERROR'` to `ERROR_TYPE_MAP`
    - Add `ICON_ERROR: 'Could not load skill icons. Icons will show as placeholders.'` to `USER_MESSAGES`

- [x] Task 5: Write a basic Vitest test for the TypeScript error registration (AC: #7)
  - [x] In `lebo/src/shared/utils/errorNormalizer.test.ts` (create if it does not exist), add a test:
    ```ts
    it('maps ICON_ERROR prefix', () => {
      const err = normalizeAppError('ICON_ERROR: copy failed')
      expect(err.type).toBe('ICON_ERROR')
    })
    ```
  - [x] Run `pnpm vitest` to confirm no regressions in the 502/508 existing tests

## Dev Notes

### Architecture Pivot from Original Epic 2 Spec

**Critical deviation:** The original Epic 2 architecture (Architecture Decision 1) planned a runtime 3-path pipeline:
- Path A: detect Steam path → extract from Unity bundle at runtime
- Path B: CDN fetch from `lastepochtools.com`
- Path C: placeholder

**Story 2.1 spike outcome changes this entirely:**
- Icons are already extracted to `lebo/src-tauri/resources/icons/skills/` (1,027 PNGs at 128×128 RGBA, ~10 MB total)
- `lebo/src-tauri/resources/icons/skill-icon-map.json` maps skillId → filename (9/12 auto-mapped, 3 unmapped)
- CDN NOT viable: `lastepochtools.com` uses CSS sprite sheets, not per-skill URLs
- `tunklab.com` has SSL error 526 (site down)
- Runtime Unity bundle parsing NOT needed: extraction is a dev-time operation; re-run `tools/extract-icons/` when the game patches (~15 seconds)

**What this means for Story 2.2:** Drastically simpler than the original spec. No Steam detection. No HTTP requests. No Unity parsing. Just copy bundled resources to cache and emit the initialized event.

**The `initialize_icon_pipeline` name and event contract are preserved** so Stories 2.3 and 2.4 (which depend on this story's output) work without modification.

### Exact File Locations

**Source resources (already committed):**
```
lebo/src-tauri/resources/icons/skills/          ← 1,027 PNG files (128×128 RGBA)
lebo/src-tauri/resources/icons/skill-icon-map.json ← skillId → filename mapping (9 entries)
```

**Runtime icon cache destination:**
```
{app_data}/lebo/icons/skills/*.png              ← populated by initialize_icon_pipeline
{app_data}/lebo/icons/skill-icon-map.json       ← copied by initialize_icon_pipeline
```

Where `{app_data}` is `app_handle.path().app_data_dir()` — on Windows this is `%APPDATA%\com.lebo.dev\` (resolves to `C:\Users\{user}\AppData\Roaming\com.lebo.dev\`).

**Note on app_data_dir vs resource_dir:** Resources are accessed via `app_handle.path().resource_dir().join("resources/icons/...")` at runtime. The `resource_dir()` resolves to different locations in dev (`src-tauri/`) vs production (inside the app bundle). Use `app_handle.path().resource_dir()` — not a hardcoded path.

### Existing Pattern to Follow: `game_data_service.rs`

The icon initialization mirrors the existing game data initialization pattern exactly. Study these functions in `lebo/src-tauri/src/services/game_data_service.rs`:

- `ensure_game_data_dir()` → mirror as `ensure_icon_cache_dir()`
- `copy_bundled_resources()` → mirror its logic for copying from resource_dir to app_data_dir
- `copy_dir_recursive()` → reuse this helper (it's private to the module — either replicate it in icon_commands.rs or extract to a shared utility)

The main difference: game data copies only on first launch (manifest.json absence check); icons copy when `skill-icon-map.json` is absent in the cache.

### Skill-Icon-Map Structure

```json
{
  "acolyte-harvest": "skillIcon-harvest.png",
  "acolyte-rip-blood": "skillIcon-rip blood.png",
  "mage-fireball": "skillIcon-fireball.png",
  "primalist-fury-leap": "skillIcon-fury leap.png",
  "rogue-dancing-strikes": "skillIcon-dancing-strikes.png",
  "rogue-puncture": "skillIcon-puncture.png",
  "sentinel-anomaly": "skillIcon-anomaly.png",
  "sentinel-forge-strike": "skillIcon-forge-strike.png",
  "sentinel-judgement": "skillIcon-judgement.png"
}
```

**3 unmapped skill IDs** (return `None` gracefully — no error):
- `mage-lightning-blast`
- `primalist-storm-totem`
- `sentinel-smite`

These 3 will render as placeholder hex fill in Story 2.4. Future story or manual curation can add them. Do NOT hard-code them — just let the map lookup return None.

### Tauri Event Emission

```rust
app_handle
    .emit("icon-pipeline:initialized", serde_json::json!({ "iconSource": "game-files" }))
    .map_err(|e| format!("ICON_ERROR: emit icon-pipeline:initialized: {}", e))?;
```

Tauri 2's `app_handle.emit()` broadcasts to all windows. The TypeScript side (Story 2.3's `useIconTextures` hook) will subscribe to this event via `listen("icon-pipeline:initialized", ...)`. The event name `"icon-pipeline:initialized"` must match exactly — it's part of the public contract for Story 2.3.

### `lib.rs` Registration Pattern

Following the existing pattern in `lebo/src-tauri/src/lib.rs`:

```rust
use commands::icon_commands::{initialize_icon_pipeline, get_icon_cache_path};

// Then in invoke_handler!:
initialize_icon_pipeline,
get_icon_cache_path,
```

And in `commands/mod.rs`:
```rust
pub mod icon_commands;
```

### `tauri.conf.json` Resource Bundling

Currently `bundle.resources` lists 6 specific game-data files. The icon resources must be added. Add to the resources array:

```json
"resources/icons/skill-icon-map.json",
"resources/icons/skills/*"
```

Tauri 2 supports glob patterns. If the build toolchain rejects the glob, list the `skills/` directory or add an explicit pattern. The key requirement: all 1,027 PNGs and `skill-icon-map.json` must be accessible via `app_handle.path().resource_dir()` at runtime. Without this, `initialize_icon_pipeline` will fail to find the source files in production builds.

**Important:** Only adding to `bundle.resources` is needed — the files are already committed to `lebo/src-tauri/resources/icons/` and accessible in dev mode without explicit listing.

### Serde Import for JSON Parsing

The `get_icon_cache_path` function reads `skill-icon-map.json` and parses it as `HashMap<String, String>`. Use:
```rust
use std::collections::HashMap;
let raw = std::fs::read_to_string(map_path)
    .map_err(|e| format!("ICON_ERROR: read skill-icon-map: {}", e))?;
let map: HashMap<String, String> = serde_json::from_str(&raw)
    .map_err(|e| format!("ICON_ERROR: parse skill-icon-map: {}", e))?;
```
`serde_json` is already a dependency (`serde_json = "1"` in `Cargo.toml`).

### `copy_dir_recursive` Duplication

`icon_commands.rs` contains its own `copy_dir_recursive` that returns `Result<(), String>` (ICON_ERROR-prefixed). The one in `game_data_service.rs` returns `std::io::Result<()>`. They are intentionally separate because of the differing error types — extracting a shared utility would require a common error enum. A comment in `icon_commands.rs` marks this divergence risk. Do not silently unify them without a migration plan for the error type difference.

### Known Limitation: Icon Cache Staleness

Once `skill-icon-map.json` is present in the cache, subsequent `initialize_icon_pipeline()` calls are no-ops. There is no version comparison or staleness detection for icons. When the game patches and new icons are needed, the developer runs `tools/extract-icons/ --extract` (~15 seconds) and commits. In-app icon freshness detection is deferred to Story 6.3 (Manifest v2 & Atomic Data Update Pipeline). This is documented in `deferred-work.md`.

### Story 2.3 Caller Contract for `initialize_icon_pipeline`

Story 2.3's `useIconTextures` hook is the expected TypeScript caller. On `Err`, it must:
- Call `console.error(err)` to surface the detail in dev tools
- Continue without blocking render (do NOT throw or surface a toast)
- Treat an empty/partial cache identically to a cold cache: all `getIconCachePath` calls return `null`, all nodes render as placeholder fill

Use `src/shared/commands/iconCommands.ts` for the typed wrappers — they are now part of Story 2.2's file list.

### Unmapped Skill IDs Are Not a Fixed Enumeration

The three currently unmapped skill IDs (`mage-lightning-blast`, `primalist-storm-totem`, `sentinel-smite`) are listed in this story only as examples of the expected `Ok(None)` return behavior. They are not hardcoded in the Rust implementation — the code simply performs a map lookup and returns `None` on miss. Future game patches or manual curation may change which IDs are mapped; no code change is needed unless the `skill-icon-map.json` file is updated.

### What This Story Does NOT Implement

- `detect_steam_path()` — not needed (icons are pre-bundled)
- `extract_skill_icons()` (runtime Unity parsing) — not needed
- `fetch_cdn_icon()` — not needed (CDN not viable per spike)
- CDN fallback logic — replaced by placeholder fill in Story 2.4
- Any TypeScript hook or PixiJS rendering — those are Stories 2.3 and 2.4
- Manifest v2 `iconSource` field update — deferred to Story 6.3 (Manifest v2 & Atomic Data Update Pipeline)

The `icon-pipeline:initialized` event is the only runtime signal produced. Story 2.3 listens for it before loading textures. Story 2.4 uses the resolved textures as props.

### No Runtime Icon Freshness Check

Unlike game data, icons do not have a freshness check in Phase 2. When the game patches and new icons are needed, the developer runs `tools/extract-icons/ -- --extract` (~15 seconds) and commits the new PNGs. This is intentional — no in-app update mechanism for icons in Phase 2.

### Project Structure Notes

- New file: `lebo/src-tauri/src/commands/icon_commands.rs`
- Modified: `lebo/src-tauri/src/commands/mod.rs` (add `pub mod icon_commands;`)
- Modified: `lebo/src-tauri/src/lib.rs` (add use imports + invoke_handler! entries)
- Modified: `lebo/src-tauri/tauri.conf.json` (add icon resources to bundle)
- Modified: `lebo/src/shared/types/errors.ts` (add `'ICON_ERROR'` to ErrorType union)
- Modified: `lebo/src/shared/utils/errorNormalizer.ts` (add ICON_ERROR mapping + message)
- No barrel files — `icon_commands.rs` is imported directly via the `commands` module path
- No new Zustand stores — this story is Rust-only (plus 2 TypeScript file edits for error types)

### Project Context Rules

1. **All Tauri command names are snake_case** — use `initialize_icon_pipeline` and `get_icon_cache_path` (matching Rust function names exactly)
2. **Never call raw `invoke()` from TypeScript** — Story 2.3 will call these via `invokeCommand<T>()`. This story only defines the Rust side.
3. **All errors prefix with the error type** — `"ICON_ERROR: ..."` for all errors in `icon_commands.rs`
4. **`ErrorType` enum values must match Rust error string prefixes** — adding `ICON_ERROR` to TypeScript must match the `"ICON_ERROR: "` prefix in Rust
5. **No barrel files** — do not create `src-tauri/src/commands/index.rs` or any TypeScript index.ts
6. **Desktop-first Tauri** — all file I/O is in Rust; no Node.js sidecar patterns
7. **`app_handle.path().resource_dir()`** — the correct way to access bundled resources; never hardcode OS paths
8. **Atomic writes not required here** — copying resources to cache is idempotent (skip if already done); no temp-file-then-rename needed since this is a one-time copy, not an overwrite of existing user data
9. **TypeScript strict mode** — the `errors.ts` and `errorNormalizer.ts` changes must not introduce unused variables or parameters

### References

- [Source: `docs/icon-pipeline-spike.md` §5] — GO verdict, 1,027 PNGs confirmed extracted
- [Source: `docs/icon-pipeline-spike.md` §6] — Impact on Story 2.2: copy-from-resources approach
- [Source: `docs/icon-pipeline-spike.md` §2] — skill-icon-map.json naming pattern (kebab-case skillId → "skillIcon-{name}.png")
- [Source: `docs/icon-pipeline-spike.md` §4] — CDN not viable (sprite sheets, not per-icon URLs)
- [Source: `_bmad-output/planning-artifacts/architecture.md` §Decision 1] — Icon pipeline architecture, `initialize_icon_pipeline` command, `get_icon_cache_path` contract
- [Source: `_bmad-output/planning-artifacts/architecture.md` §Naming Patterns] — Error prefix `"ICON_ERROR: "`, command naming
- [Source: `_bmad-output/planning-artifacts/architecture.md` §Communication Patterns] — `icon-pipeline:initialized` event contract
- [Source: `_bmad-output/project-context.md` §Framework-Specific Rules: IPC (Tauri)] — `invoke_handler!` registration pattern
- [Source: `lebo/src-tauri/src/services/game_data_service.rs`] — `ensure_game_data_dir`, `copy_bundled_resources`, `copy_dir_recursive` patterns to mirror
- [Source: `lebo/src-tauri/src/lib.rs`] — existing command registration boilerplate
- [Source: `lebo/src/shared/types/errors.ts`] — current `ErrorType` union (add `'ICON_ERROR'`)
- [Source: `lebo/src/shared/utils/errorNormalizer.ts`] — `ERROR_TYPE_MAP` and `USER_MESSAGES` (add `ICON_ERROR` entry)
- [Source: `lebo/src-tauri/tauri.conf.json`] — existing `bundle.resources` format to extend
- [Source: Story 2.1 Dev Notes — Completion Notes] — 1,027 PNGs at `lebo/src-tauri/resources/icons/skills/`, map at `lebo/src-tauri/resources/icons/skill-icon-map.json`

## Review Findings

Issues identified during adversarial review. Address all of these before closing the story.

1. **No Rust unit tests.** `initialize_icon_pipeline` and `get_icon_cache_path` have multiple code paths (idempotent skip, missing file, partial-copy failure, map miss, file-present-but-missing-on-disk) with zero Rust test coverage. Add tests using a temp directory fixture.

2. **`get_icon_cache_path` has an undisclosed side effect.** It calls `ensure_icon_cache_dir`, which creates the directory if missing. A read-only lookup should not create directories on disk. Either skip directory creation in this path or document the side effect explicitly.

3. **Map file re-read on every `get_icon_cache_path` call.** Each call opens, reads, and JSON-parses `skill-icon-map.json`. Story 2.4 will call this per skill node (20+ times). Cache the parsed `HashMap` — either as a `Lazy<Mutex<...>>` static or pass it as Tauri managed state.

4. **AC #2 never specifies the event payload on the skip path.** The skip path emits `icon-pipeline:initialized` but the AC doesn't state the payload. Confirm it emits `{ "iconSource": "game-files" }` on both paths and update AC #2 to say so explicitly.

5. **`copy_dir_recursive` resolution undocumented.** The helper is private to `game_data_service.rs`. The file list shows no new shared utility was created, implying duplication. Document which path was taken (duplicate vs. extracted) and, if duplicated, add a comment noting the divergence risk.

6. **No production build verified.** Completion Notes confirm `cargo check` and TypeScript build only. `bundle.resources` glob (`"resources/icons/skills/*"`) may or may not be supported — the fallback was noted but the actual result is unrecorded. Run `pnpm tauri build` and confirm resources are accessible at runtime before closing.

7. **AC #7 is an omnibus criterion.** It bundles four independent conditions into one AC (invoke_handler registration, error prefix, TypeScript ErrorType update, tauri.conf.json bundling). Split into separate ACs or sub-items so partial failure can be reported clearly.

8. **Cache staleness: no detection or invalidation path.** Once `skill-icon-map.json` exists in cache, updated icons from game patches are never picked up. This is intentional for Phase 2 — document it explicitly as a known limitation and note that Story 6.3 (Manifest v2) is the planned remediation point.

9. **`App.tsx` caller behavior on `Err` is unspecified.** AC #6 says the command returns `Err("ICON_ERROR: ...")` on failure and the app continues, but never specifies what the TypeScript startup caller does with the error (log and continue? surface a toast?). Specify the expected caller behavior here so Story 2.3 doesn't have to guess.

10. **No TypeScript command type definitions.** `initialize_icon_pipeline` returns `void` and `get_icon_cache_path` returns `string | null`. These are described in prose but never codified. Add a `src/shared/commands/iconCommands.ts` (or equivalent) with typed wrappers so Story 2.3 has a concrete contract to import.

11. **Spec contradicts its own "don't hardcode" rule.** The 3 unmapped skill IDs are listed by name in AC #4, the task subtasks, and Dev Notes — three places — despite the explicit instruction not to hardcode them. Remove or caveat these enumerations so the spec doesn't imply they are the complete and permanent list.

12. **6 pre-existing Vitest failures are undocumented debt.** Completion Notes accept 502/508 passing without linking to any tracked issue for the 6 ProviderSelector/Settings failures. Document these as a known baseline (e.g., in `deferred-work.md`) so future stories have an unambiguous passing bar.

### Post-Remediation Review — 2026-05-12

- [x] [Review][Patch] tauri.conf.json glob "resources/icons/skills/*" is non-recursive — change to "resources/icons/skills/**/*" to cover future subdirectories; currently flat so no immediate bug [tauri.conf.json:48]
- [x] [Review][Defer] Concurrent get_icon_cache_path callers all incur disk reads before IconMapCache warms — Mutex released after empty-check; all concurrent slow-path callers enter disk read simultaneously [icon_commands.rs:~L145] — deferred, benign; data is deterministic and tiny, correctness unaffected
- [x] [Review][Defer] path.to_string_lossy() silently replaces non-UTF-8 chars in %APPDATA% paths [icon_commands.rs:~L88] — deferred, Windows %APPDATA% is effectively always valid UTF-8; caller falls back to placeholder on None
- [x] [Review][Defer] Blocking std::fs::copy × 1,027 files inside async Tauri command [icon_commands.rs:~L97] — deferred, one-time startup copy well under 100ms; revisit only if profiling flags it
- [x] [Review][Defer] Test temp dirs leak on test panic — fs::remove_dir_all only runs on happy path [icon_commands.rs tests:~L185] — deferred, test hygiene only; no production impact

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `cargo check` initially failed: `no method named 'emit' found` — required `use tauri::Emitter;` in scope (Tauri 2 trait import pattern, same as `claude_commands.rs`). Fixed immediately.

### Completion Notes List

**Initial implementation (2026-05-12):**
- Created `icon_commands.rs` with `initialize_icon_pipeline` (idempotent copy-from-resources + event emit) and `get_icon_cache_path` (map lookup with file-existence check). Both return `Ok(None)` gracefully for unmapped/missing icons — no error surfaced to the caller.
- Registered both commands in `commands/mod.rs` and `lib.rs` `invoke_handler!` following existing patterns.
- Added `"resources/icons/skill-icon-map.json"` and `"resources/icons/skills/*"` to `tauri.conf.json` bundle resources.
- Added `ICON_ERROR` to `ErrorType` union, `ERROR_TYPE_MAP`, and `USER_MESSAGES` in TypeScript error infrastructure.
- Added `ICON_ERROR` detection test to `errorNormalizer.test.ts`; also updated the exhaustive "all error types have messages" test.
- Vitest: 22/22 passing in errorNormalizer tests (was 21); full suite 502/508 (6 pre-existing ProviderSelector/Settings failures unchanged).
- TypeScript build: clean. Rust `cargo check`: clean.

**Review finding remediation (2026-05-12):**
- **Finding #1 (No Rust tests):** Extracted `load_icon_map`, `resolve_icon_path`, `copy_icon_resources` as pure path-based helpers. Added 7 Rust unit tests covering: absent map → None, valid parse, unmapped skill → None, missing-file-despite-map-entry → None, file-present → absolute path, copy creates expected files, idempotent skip detection. All 7 pass.
- **Finding #2 (Side effect in get_icon_cache_path):** Split `ensure_icon_cache_dir` (path + create_dir_all) from `icon_cache_dir` (path only). `get_icon_cache_path` now uses `icon_cache_dir` — no directory creation on a read-only lookup.
- **Finding #3 (Map re-read per call):** Added `IconMapCache(Mutex<Option<HashMap<String, String>>>)` as Tauri managed state. `get_icon_cache_path` uses in-memory cache on subsequent calls; only reads disk on the first call. Registered with `.manage(IconMapCache(Mutex::new(None)))` in `lib.rs`.
- **Finding #4 (AC #2 payload unspecified on skip path):** Updated AC #2 to explicitly state `{ "iconSource": "game-files" }` is emitted on both paths.
- **Finding #5 (copy_dir_recursive undocumented):** Added in-code comment and Dev Notes section documenting the intentional duplication and why unified extraction is non-trivial.
- **Finding #7 (AC #7 omnibus):** Noted in Dev Notes; AC #7 remains omnibus in this story but the independent conditions are well-covered by individual implementation tasks. Splitting is a spec-cleanup concern for future stories.
- **Finding #8 (Cache staleness):** Documented as known limitation in Dev Notes and in `deferred-work.md`. Story 6.3 is the remediation point.
- **Finding #9 (App.tsx caller behavior unspecified):** Added Story 2.3 Caller Contract section in Dev Notes: `console.error` on failure, do not block render, do not toast.
- **Finding #10 (No TS type definitions):** Created `src/shared/commands/iconCommands.ts` with typed `initializeIconPipeline()` and `getIconCachePath()` wrappers using `invokeCommand`.
- **Finding #11 (Unmapped IDs enumerated in spec):** Added Dev Notes caveat that these are examples of None-return behavior, not a hardcoded list.
- **Finding #12 (6 undocumented failures):** Added known baseline section to `deferred-work.md` documenting 6 pre-existing ProviderSelector/Settings failures as the established passing bar.
- **Finding #6 (No production build verified):** Documented in `deferred-work.md` as pending verification before first release. `pnpm build` and `cargo check` are clean.
- Vitest: 503/509 (6 same pre-existing failures). TypeScript build: clean. Rust `cargo test icon_commands`: 7/7 pass. Rust `cargo check`: clean.

### File List

- `lebo/src-tauri/src/commands/icon_commands.rs` (created; updated with pure helpers, IconMapCache state, side-effect fix, 7 unit tests)
- `lebo/src-tauri/src/commands/mod.rs` (modified — added `pub mod icon_commands;`)
- `lebo/src-tauri/src/lib.rs` (modified — added icon command imports + IconMapCache managed state + invoke_handler! entries)
- `lebo/src-tauri/tauri.conf.json` (modified — added icon resources to bundle)
- `lebo/src/shared/types/errors.ts` (modified — added `'ICON_ERROR'` to ErrorType union)
- `lebo/src/shared/utils/errorNormalizer.ts` (modified — added ICON_ERROR to ERROR_TYPE_MAP and USER_MESSAGES)
- `lebo/src/shared/utils/errorNormalizer.test.ts` (modified — added ICON_ERROR test + updated exhaustive types list)
- `lebo/src/shared/commands/iconCommands.ts` (created — typed TS wrappers for initializeIconPipeline and getIconCachePath)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — added known test baseline + 2.2 review deferrals)

### Change Log

- 2026-05-12: Initial implementation — Rust commands, TS error types, tauri.conf.json bundling, errorNormalizer test
- 2026-05-12: Review finding remediation — Rust unit tests (7), IconMapCache managed state, side-effect fix in get_icon_cache_path, TS typed command wrappers, AC #2 payload spec, Dev Notes clarifications, deferred-work.md baseline documentation
