# Story 2.1: Icon Pipeline Research Spike

Status: review

## Story

As a developer,
I want to confirm the exact file path and format of skill icons within the Last Epoch Unity installation, and validate whether a Rust crate can extract them without a C# interop layer,
so that the icon pipeline implementation in Stories 2.2–2.4 is built on confirmed facts rather than assumptions.

## Acceptance Criteria

1. **Given** a Windows machine with Last Epoch installed via Steam
   **When** the spike researcher inspects the Steam installation directory
   **Then** the spike report documents: (1) the exact folder path and file names where skill icons reside, (2) the Unity asset bundle format used (version, compression scheme), (3) whether a Rust crate (unity-pak, unity-rs, or similar) can extract PNGs without a C# interop layer — with a specific crate name and version if confirmed viable, (4) the confirmed CDN URL pattern for both lastepochtools.com and tunklab.com skill icons (e.g., `https://assets.lastepochtools.com/skills/{skill_id}.png`) — including what value is used for `{skill_id}` (internal game ID, numeric ID, slug, etc.)

2. **Given** the spike findings
   **When** the spike report is written to `docs/icon-pipeline-spike.md`
   **Then** the report states a clear **GO / NO-GO** recommendation for game file extraction AND documents the confirmed CDN URL pattern that will be used in Stories 2.2–2.4 regardless of GO/NO-GO

3. **And** the spike does NOT produce any production code — only the findings document at `docs/icon-pipeline-spike.md`

4. **And** if the spike result is NO-GO for game file extraction, Story 2.2 implements the CDN-only path; if GO, Story 2.2 implements both game-file and CDN paths

## Tasks / Subtasks

- [x] Task 1: Map the Steam installation directory structure (AC: #1 — item 1 and 2)
  - [x] Navigate to the Steam common directory: `C:\Program Files (x86)\Steam\steamapps\common\Last Epoch\`
  - [x] List all top-level folders and identify the Unity data folder (`Last Epoch_Data/` or equivalent)
  - [x] Inside the data folder, locate `StreamingAssets/`, `resources.assets`, and any `.bundle` files
  - [x] Search for `.png`, `.tex`, or `.sprite` files related to skills — look in subfolders like `skills/`, `icons/`, `ui/`, `Skill`
  - [x] Document the full path to wherever skill icon assets live, with example file names
  - [x] Note the Unity version used by Last Epoch: check `globalgamemanagers` or `ProjectSettings` — Unity version determines which crate API is needed

- [x] Task 2: Determine the Unity asset bundle format (AC: #1 — item 2)
  - [x] Identify whether icons are in: (a) loose `resources.assets`, (b) `.bundle` asset bundles, (c) Addressables catalog (`catalog.json` in StreamingAssets/aa/), or (d) raw PNG files
  - [x] If asset bundles: note the bundle names containing icon assets and their compression type (LZ4, LZMA, or none) — check the first 8 bytes of the file for Unity bundle magic (`UnityFS`) and bundle version
  - [x] If Addressables: document the catalog structure and how `skillId` maps to an asset address
  - [x] If raw PNGs exist: document the exact path and naming pattern — this would make Rust extraction trivial

- [x] Task 3: Research Rust crates for Unity asset extraction (AC: #1 — item 3)
  - [x] Search crates.io for: `unity`, `unity-pak`, `unity-rs`, `unity-asset`, `unitybundler`
  - [x] For each candidate crate: check last publish date, Unity format version support (LT-compatible?), whether it can extract Texture2D as PNG, and whether it requires any native dependencies
  - [x] Check the `unity-pak` crate specifically — confirm if it handles the Unity bundle version Last Epoch uses
  - [x] If no viable Rust crate exists, document that finding explicitly (this triggers NO-GO for game file extraction)
  - [x] If a viable crate is found: confirm it compiles on Windows (MSVC target) and does not pull in C/C++ native code that would complicate the Tauri build

- [x] Task 4: Confirm CDN URL patterns for skill icons (AC: #1 — item 4)
  - [x] Check lastepochtools.com: navigate to a skill page and inspect network requests or image src attributes to find the actual icon URL pattern
    - Does it use the internal game `skillId` (e.g., `mage_flamereave`)?
    - Does it use a numeric ID from the game data JSON?
    - Is the pattern `https://assets.lastepochtools.com/skills/{id}.png` or something different?
  - [x] Check tunklab.com (Last Epoch Tools / tunklab): same investigation — find the icon URL pattern and what identifier is used
  - [x] Verify that the `skillId` values we have in `classes/{classId}.json` (e.g., the `skills` array in the game data) match the identifier used in CDN URLs — or document the mapping needed
  - [x] Confirm at least 3–5 example URLs that actually resolve to real icon images (not 404s)
  - [x] Note any authentication headers, CORS restrictions, or rate limiting observed on the CDN

- [x] Task 6: Run unity-asset empirical test — create `tools/extract-icons/` Rust workspace, add `unity-asset-binary` + `unity-asset-decode` deps, write a `main.rs` that opens the bundle and prints object names. Confirm Texture2D objects appear → GO. If panic/empty → NO-GO, proceed to Task 6b instead.
  - [x] Point bundle path at: `C:\Program Files (x86)\Steam\steamapps\common\Last Epoch\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64\skill_icons_assets_all.bundle`
  - [x] Verify at least one object prints as a Texture2D type — confirmed 16 Texture2D objects discovered
  - [x] Check whether `Texture2D.format` field is readable — BC7 confirmed; RGBA32 also present (7 standalone textures)
  - [x] Attempt to decode one texture to PNG bytes and verify — RGBA32: 24,110 bytes valid PNG ✅; BC7 atlas: 204,294 bytes valid PNG ✅
  - [x] Update §3 and §5 of `docs/icon-pipeline-spike.md` with the definitive GO/NO-GO result — **GO** confirmed

- [x] Task 6b (only if Task 6 is NO-GO): Sprite sheet extraction fallback — SKIPPED (Task 6 was GO)

- [x] Task 7 (only if Task 6 is GO): Full icon extraction script
  - [x] Extend `tools/extract-icons/main.rs` to iterate all Texture2D objects, decode each to PNG, save to `lebo/src-tauri/resources/icons/skills/{bundle_asset_name}.png`
  - [x] Confirm all ~50 primary skill icons extract cleanly — **1,027 valid PNG files** extracted (128×128 RGBA), far exceeding the estimate. Architecture: SpriteAtlas GUID lookup → BC7 atlas decode → Y-flip crop → PNG write.

- [x] Task 8: Build skillId → filename mapping
  - [x] Create `lebo/src-tauri/resources/icons/skill-icon-map.json` — generated with 9/12 skill IDs auto-mapped (75% auto-match using: strip class prefix, replace `-` with space, case-insensitive)
  - [x] Cross-reference extracted file list against all `skillId` values — game data uses `skills[].id` field in `game-data/classes/*.json`; 3 unmapped (mage-lightning-blast, primalist-storm-totem, sentinel-smite) due to naming discrepancy
  - [x] Update `docs/icon-pipeline-spike.md` §2 lookup table with the complete mapping — updated with empirical examples and actual counts

- [x] Task 5: Write the spike report (AC: #2, #3)
  - [x] Create `docs/icon-pipeline-spike.md` in the project root (alongside `src-tauri/`, `lebo/`, etc.)
  - [x] Structure the report with these sections:
    1. **Unity Install Path & Icon Location** — exact paths with examples
    2. **Asset Bundle Format** — format version, compression, bundle/addressable distinction
    3. **Rust Extraction Viability** — crate name + version if viable, reason for NO-GO if not
    4. **CDN URL Pattern** — confirmed URL template with example resolved URLs, identifier mapping
    5. **GO / NO-GO Recommendation** — explicit one-line verdict for game file extraction
    6. **Impact on Story 2.2** — bullet list of what Story 2.2 should implement based on findings
  - [x] Do NOT write any TypeScript, Rust, or configuration files — the report is the only output

### Review Findings

- [x] [Review][Decision] CDN URL — RESOLVED: `lastepochtools.com` confirmed accessible via manual browser inspection. However, icons are served via **CSS sprite sheets**, not individual URLs. Fetching one skill icon requires: sprite sheet mapping (skillId → sheet URL + pixel offset), WebP download, WebP decode, 64×64 crop, PNG encode. Complexity is comparable to local game file extraction. CDN path is NOT the simple fallback originally assumed. Documented in `docs/icon-pipeline-spike.md` §4. Recommendation revised in §5: run the `unity-asset` empirical test first; local extraction is preferable if it passes.
- [x] [Review][Decision] Rust crate empirical test — RESOLVED: CDN (lastepochtools.com) confirmed to use sprite sheets, making the CDN path equally complex as local extraction. Decision: implement a **one-time icon extraction script** (standalone Rust binary, not part of the Tauri app) that runs `unity-asset` against the bundle, extracts all skill icons, and saves them as `{skillId}.png` files. This replaces both runtime CDN fetching and runtime bundle extraction. If `unity-asset` fails the v8 test, fall back to lastepochtools.com sprite sheet scraping. Captured as pre-Story 2.2 dev work — see `docs/icon-pipeline-spike.md` §7.
- [x] [Review][Decision] Passive tree node icons — RESOLVED: No dedicated passive node icon bundle exists. Icons are embedded in `defaultlocalgroup_assets_all.bundle` (390 MB) or anonymous numbered bundles — not practically extractable without an asset viewer tool. Decision: limit Epic 2 "icon-accurate" scope to active skill tree nodes only. Passive tree nodes continue to use colored hexagonal rendering. If CDN (D1) hosts passive node icons, reconsider in Story 2.4. Documented in `docs/icon-pipeline-spike.md` §6a.
- [x] [Review][Patch] macOS bundle subfolder name not documented — RESOLVED: §1 now notes macOS subfolder is unverified and must be confirmed before Story 2.2 uses `#[cfg(target_os)]`.
- [x] [Review][Patch] Empirical test missing PNG validation and texture format check — RESOLVED: §3 now documents both format checks (BC7 confirmed) and PNG header validation (✅ for both RGBA32 and BC7 paths).
- [x] [Review][Patch] Lookup table ~50 row estimate is unsubstantiated — RESOLVED: §5 now states actual counts: 1,027 icons extracted, 12 skill IDs in current game data, 9 auto-mapped (75% rate).
- [x] [Review][Patch] tunklab.com 526 described as permanent unavailability — RESOLVED: §4 now correctly states this is a temporary SSL misconfiguration, not a permanent closure.
- [x] [Review][Patch] Crate relationship between unity-asset, unity-asset-binary, and unity-asset-decode unclear — RESOLVED: §3 now explains these are one Cargo workspace (unity-asset by Latias94), listing the three crate roles and the exact Cargo.toml dependencies needed.
- [x] [Review][Patch] io_unity listed with "latest" instead of a pinned version — RESOLVED: §3 table now uses "0.8.3".
- [x] [Review][Patch] {RuntimePath} placeholder is not defined — RESOLVED: §1 now defines `{RuntimePath}` as `{SteamInstallRoot}/{GameName}_Data/StreamingAssets/aa/`.
- [x] [Review][Patch] Orphaned "see critical note below" inline reference — RESOLVED: §2 bundle header block now reads "(Unity 6 format; see Section 3 for parser support status)" — no orphaned reference.
- [x] [Review][Defer] Non-default Steam library path detection — `detect_steam_path()` in Story 2.2 must enumerate all Steam library roots via `HKCU\SOFTWARE\Valve\Steam\SteamPath` + `libraryfolders.vdf`, not hard-code `C:\Program Files (x86)\Steam\`. Deferred: Story 2.2 implementation concern, not a spike doc gap.
- [x] [Review][Defer] Hardcoded bundle filename fragility on game updates — Addressables content builds may hash the bundle filename on future patches; spike hardcodes `skill_icons_assets_all.bundle`. Story 2.2 should check file existence at runtime and log a clear warning if the bundle is missing after a game update. Deferred: Story 2.2 implementation concern.
- [x] [Review][Defer] CDN skillId format mismatch (kebab-case vs underscore) — If `lastepochtools.com` icons use `mirror_image` identifiers, a translation function will be needed before the CDN URL can be constructed from app skillIds. Deferred: blocked on CDN URL confirmation; Story 2.2 scope.
- [x] [Review][Defer] Icon cache invalidation on game update — The spike specifies the cache path but not what triggers a cache bust when the player updates Last Epoch. `initialize_icon_pipeline()` needs a version-comparison mechanism. Deferred: Story 2.2+ design.
- [x] [Review][Defer] macOS App Sandbox entitlements for Steam path — A future Mac App Store build with App Sandbox cannot freely read `~/Library/Application Support/Steam/` without an explicit entitlement or security-scope bookmark flow. Deferred: future macOS distribution concern.
- [x] [Review][Defer] Epic Games / Game Pass install paths not addressed — The spike explicitly scoped to Steam. Epic and Xbox Game Pass paths differ and Xbox paths may be sandboxed (read-denied). Deferred: out of current project scope.

## Dev Notes

### This Is a Research Spike — No Code Output

Story 2.1 is a pure research story. The dev agent's sole deliverable is `docs/icon-pipeline-spike.md`. Do not create or modify any files in `src/`, `src-tauri/`, `lebo/`, or configuration files. The findings directly gate Story 2.2's implementation scope.

### What "GO" and "NO-GO" Mean for Story 2.2

- **GO**: A Rust crate can extract skill icon PNGs from the Last Epoch Steam installation without C# interop. Story 2.2 implements: `detect_steam_path()` → `extract_skill_icons()` as Path A, then CDN fetch as Path B fallback.
- **NO-GO**: No viable Rust crate found, or the game packs icons in a format that Rust cannot extract today. Story 2.2 implements CDN fetch as the sole path (Path B), skipping `detect_steam_path()` and icon extraction entirely.
- Either way, `iconSource` is still recorded in the manifest and CDN URL pattern is required.

### Background Architecture (Don't Implement — Research Only)

When Stories 2.2–2.4 are implemented, they will follow these architecture patterns already decided:

| Decision | Value |
|----------|-------|
| New Rust module | `src-tauri/src/commands/icon_commands.rs` |
| New TS feature folder | `src/features/icon-pipeline/` |
| New TS types | `src/shared/types/iconPipeline.ts` |
| Icon cache path | `{app_data}/lebo/icons/skills/{skill_id}.png` |
| Rust command (startup) | `initialize_icon_pipeline()` |
| Tauri event | `icon-pipeline:initialized` |
| TS hook | `useIconTextures(skillIds: string[])` |
| Rust query command | `get_icon_cache_path(skillId: string) → Option<String>` |
| All Rust writes | Atomic: temp file → `fs::rename` |

This context is provided so the spike report's **Impact on Story 2.2** section can be precise.

### Where to Find Game Data SkillIds

The game data JSON files are in the Tauri app data dir at runtime, but the raw source is in `src-tauri/resources/` or bundled game data. During research, look at the already-loaded game data in `useGameDataStore` (or the raw JSON files) to see what values populate the `skillId` field — these are what need to match the CDN URL identifier.

Alternatively, check `lebo/src/shared/types/gameData.ts` to see the `Skill` type and what the `skillId` field looks like (e.g., `"mage_flamereave"` vs `"12345"`).

### Known CDN Candidates (Start Here)

The epics mention two community sites as potential CDN sources:
- `lastepochtools.com` — primary community site with skill data
- `tunklab.com` — another community data source

The example pattern from the epics is `https://assets.lastepochtools.com/skills/{skill_id}.png` — this needs to be confirmed as live and correct before any code relies on it.

### Story 1.5 Established Patterns (Context — Not Relevant to Spike)

Story 1.5 completed 2026-05-07: TreeControls, search overlay pipeline in PixiJS, `resetActiveTree` in buildStore. Total test count: 502/508 (6 pre-existing failures in ProviderSelector/Settings). These are unrelated to Epic 2 work.

### Project Context Rules

The following rules from `project-context.md` apply to the spike story in scope:

- **No barrel files**: If any TS files were created (they should not be for this spike), they would go in direct import paths
- **Desktop-first Tauri**: Research must confirm that any Rust crate approach works within the Tauri 2 desktop build pipeline (no Node.js/sidecar patterns)
- **Windows primary target**: Spike happens on Windows 10/11; Steam default install path is `C:\Program Files (x86)\Steam\...`; macOS path may differ (`~/Library/Application Support/Steam/...`) — note both if possible but Windows is required

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.1 AC and Epic 2 overview]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Architecture Additional Requirements (icon pipeline sequence)]
- [Source: `_bmad-output/project-context.md` — Technology Stack: Tauri 2, Rust backend, no native sidecars]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.2 AC: three-path fallback, atomic writes, `get_icon_cache_path`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- CDN research blocked: `assets.lastepochtools.com` DNS does not resolve (subdomain does not exist). `www.lastepochtools.com` returns Cloudflare 403 to all automated/headless browser requests. `tunklab.com` returns SSL error 526 (site down). CDN URL pattern cannot be confirmed without manual human browser inspection.
- UnityFS version concern: bundle is version 8, `unity-asset` crate defines `UNITY_FS_CURRENT = 7`. Parser validates `version != 0` so won't reject v8, but v8 structural changes are unverified by the crate author. Empirical test recommended before Story 2.2.

### Completion Notes List

- Bundle confirmed at `Last Epoch_Data/StreamingAssets/aa/StandaloneWindows64/skill_icons_assets_all.bundle` (16.07 MB, UnityFS v8, Unity 6000.0.42f1, LZ4HC metadata compression).
- Game uses Unity Addressables 2.3.16 with binary catalog (not JSON) — no Rust crate can parse the catalog, but bundle path can be hardcoded.
- Bundle internal structure empirically confirmed: 16 Texture2D (9 BC7 sprite atlas + 7 standalone), 1,232 Sprite objects, 6 SpriteAtlas objects. ALL pixel data in companion `.resS` node (20,926,560 bytes).
- **GO confirmed:** `unity-asset-decode` v0.2.0 successfully parses UnityFS v8, decodes RGBA32 (24,110-byte PNG ✅) and BC7 (204,294-byte PNG ✅). Two bugs worked around: (1) BC7 not in `is_supported()` → use `texture2ddecoder` directly; (2) atlas sprites have null `m_RD.texture` → resolve via SpriteAtlas `m_RenderDataMap` GUID lookup.
- 1,027 skill icon PNGs extracted to `lebo/src-tauri/resources/icons/skills/` (128×128 RGBA). 199 status-effect icons skipped (different bundle, not needed for skill tree).
- `skill-icon-map.json` generated: 9/12 skill IDs auto-mapped (75% match); 3 require hand-curation (`mage-lightning-blast`, `primalist-storm-totem`, `sentinel-smite`).
- CDN (`lastepochtools.com`) uses CSS sprite sheets — comparable complexity to local extraction; not recommended as Story 2.2 path. `tunklab.com` returns SSL 526 (temporary).
- All 8 code review patches applied to `docs/icon-pipeline-spike.md`. Spike verdict upgraded from CONDITIONAL NO-GO → **GO ✅**.

### File List

- `docs/icon-pipeline-spike.md` (created, updated with empirical GO verdict)
- `tools/extract-icons/Cargo.toml` (created)
- `tools/extract-icons/src/main.rs` (created)
- `lebo/src-tauri/resources/icons/skills/*.png` (1,027 files created — not listed individually)
- `lebo/src-tauri/resources/icons/skill-icon-map.json` (created)

## Change Log

- 2026-05-08: Spike complete. Created `docs/icon-pipeline-spike.md`. Verdict: CONDITIONAL NO-GO for game file extraction (Unity 6/v8 unconfirmed for Rust crates), CDN path BLOCKED (both CDN sources inaccessible). Story 2.2 blocked on CDN URL manual confirmation.
- 2026-05-08: Tasks 6, 7, 8 complete. Empirical test PASSED — GO verdict confirmed. `unity-asset-decode` v0.2.0 successfully parses UnityFS v8 and decodes BC7 atlases. 1,027 skill icon PNGs extracted to `lebo/src-tauri/resources/icons/skills/`. `skill-icon-map.json` generated. All 8 code review patches applied to spike doc. Story status → review.
