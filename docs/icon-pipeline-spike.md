# Icon Pipeline Research Spike — Findings

**Date:** 2026-05-08  
**Story:** 2.1  
**Researcher:** Claude (claude-sonnet-4-6)

---

## 1. Unity Install Path & Icon Location

**Steam installation root (Windows):**
```
C:\Program Files (x86)\Steam\steamapps\common\Last Epoch\
```

> **macOS note:** The subfolder structure under the Steam install root differs on macOS. The `Last Epoch_Data\` prefix is replaced by a different app bundle path. The bundle filename (`skill_icons_assets_all.bundle`) and the `StreamingAssets/aa/` parent are expected to be the same, but this has not been empirically verified on macOS.

**Icon bundle location (confirmed on Windows):**
```
C:\Program Files (x86)\Steam\steamapps\common\Last Epoch\
  Last Epoch_Data\
    StreamingAssets\         ← {RuntimePath} base
      aa\                    ← {RuntimePath}/aa/
        StandaloneWindows64\
          skill_icons_assets_all.bundle   ← 16.07 MB, empirically confirmed
        catalog.bin                        ← 3.25 MB binary Addressables catalog
        settings.json                      ← Addressables 2.3.16 config
```

> **`{RuntimePath}` definition:** Throughout this document, `{RuntimePath}` refers to `{SteamInstallRoot}/{GameName}_Data/StreamingAssets/aa/`. On Windows this resolves to `C:\Program Files (x86)\Steam\steamapps\common\Last Epoch\Last Epoch_Data\StreamingAssets\aa\`.

**No raw PNG files exist on the filesystem.** All skill icons are embedded inside the `skill_icons_assets_all.bundle` file. There are no loose `.png`, `.tex`, or `.sprite` files in any subfolder of the installation.

**Unity version confirmed:** `6000.0.42f1` (Unity 6.0.42f1), verified from both `globalgamemanagers` and `app.info`.

---

## 2. Asset Bundle Format

### System: Unity Addressables, not a raw AssetBundle

Last Epoch uses **Unity Addressables 2.3.16** — a higher-level abstraction on top of AssetBundles. The game's asset loading pipeline is:

1. At startup, load `catalog.bin` (binary Addressables catalog, 3.25 MB)
2. Resolve an Addressable address (e.g., `Paladin Skills/Smite`) to a bundle filename
3. Load the bundle (`skill_icons_assets_all.bundle`)
4. Extract the specific asset by name (e.g., `skillIcon-smite.png`)

### Bundle header analysis

The `skill_icons_assets_all.bundle` file begins with:
```
Magic:            UnityFS\0
File format ver:  8  (Unity 6 format; see Section 3 for parser support status)
Min reader ver:   5.x.x
Unity version:    6000.0.42f1
Bundle size:      16,851,998 bytes (16.07 MB)
Metadata flags:   0x43  → bits 0-5 = 3 (LZ4HC compression for metadata section)
                       → bit 6 = 1 (HasDirectoryInfo)
```

**UnityFS file format version 8** is the format introduced with Unity 6. It is a breaking change from version 7 (Unity 2020–2022 LTS).

### Internal asset structure (empirically confirmed — 2026-05-08)

The bundle was fully parsed and all assets extracted. The internal structure is:

| Object Type | class_id | Count | Notes |
|-------------|----------|-------|-------|
| Texture2D | 28 | 16 | 9 BC7 sprite atlas textures + 7 standalone skillIcon textures |
| AssetBundle | 142 | 1 | Bundle metadata object |
| Sprite | 213 | 1,232 | All named `skillIcon-*`; primary skill icons + color variants |
| SpriteAtlas | 687078895 | 6 | One per character class group |

**Key finding:** Skill icons are NOT stored as standalone Texture2D objects. They are **Sprite objects packed into BC7-compressed sprite atlas textures**, accessed via Unity's SpriteAtlas system (see Section 3).

**Pixel data location:** ALL Texture2D pixel data is stored in a companion `CAB-*.resS` node (20,926,560 bytes) within the same bundle, NOT embedded in the serialized object data. The `stream_info.offset` and `stream_info.size` fields in each Texture2D object slice into this file.

### Internal naming

Sprites are named with the prefix `skillIcon-` followed by the skill or icon name. Examples from the extracted set:

| Our skillId (game data) | Internal bundle asset name |
|-------------------------|---------------------------|
| `acolyte-rip-blood`     | `skillIcon-rip blood` |
| `acolyte-harvest`       | `skillIcon-harvest` |
| `mage-fireball`         | `skillIcon-Fireball` |
| `primalist-fury-leap`   | `skillIcon-Fury Leap` |
| `rogue-puncture`        | `skillIcon-Puncture` |
| `sentinel-anomaly`      | `skillIcon-Anomaly` |

Each skill has multiple icon variants (e.g., `skillIcon-fireball`, `skillIcon-fireball alt`, color-coded variants). There is **no algorithmic mapping** from our kebab-case skillId to the correct primary bundle asset name — a fuzzy lookup (strip class prefix, replace hyphens with spaces, case-insensitive match) achieves ~75% auto-map rate; the remainder requires a hand-curated table.

**Status effect icons:** 199 sprites reference `tex_pid=4804660569748856677`, a Texture2D not present in this bundle. These are buff/debuff status effect icons (e.g., freeze, bleed, ignite) stored in a separate bundle. They are NOT needed for skill tree rendering.

---

## 3. Rust Extraction Viability

### **EMPIRICAL RESULT: GO ✅** (confirmed 2026-05-08)

The `unity-asset-decode` v0.2.0 crate (part of the `unity-asset` workspace) successfully:
- Parses UnityFS version 8 (Unity 6) bundles ✅
- Reads all object type trees from the bundle ✅
- Decodes RGBA32 textures: 24,110-byte valid PNG output ✅
- Decodes BC7 compressed textures: 204,294-byte valid PNG output ✅
- Reads Sprite and SpriteAtlas objects with full TypeTree access ✅
- **Extracted 1,027 skill icon PNGs** to `lebo/src-tauri/resources/icons/skills/` ✅

### Empirical test description

The test binary (`tools/extract-icons/`) performs two phases:

**Probe phase (default):**
1. Opens the bundle via `unity_asset_decode::file::load_unity_file`
2. Locates the `.resS` companion node (20,926,560 bytes of pixel data)
3. Enumerates all objects → discovers 16 Texture2D, 1,232 Sprite, 6 SpriteAtlas objects
4. Injects stream data into each Texture2D via `stream_info.offset/size`
5. Decodes one RGBA32 texture → validates PNG header (`\x89PNG`) ✅
6. Decodes one BC7 atlas texture → validates PNG header ✅

**Extraction phase (`--extract` flag):**
1. Decodes all 16 Texture2D images into memory as `RgbaImage` (keyed by `path_id`)
2. Reads all 6 SpriteAtlas objects' `m_RenderDataMap` → builds `GUID → (tex_path_id, textureRect)` map (1,247 entries)
3. For each Sprite where `name.starts_with("skillIcon-")`:
   - Gets sprite's `m_RenderDataKey` GUID
   - Looks up atlas texture path_id and textureRect
   - Applies Y-flip: `y_from_top = atlas_height - rect.y - rect.height`
   - Crops 128×128 region from decoded atlas
   - Encodes as PNG → saves to `skills/{name}.png`
4. Also extracts 7 standalone Texture2D objects named `skillIcon-*`
5. Generates `skill-icon-map.json`

### Crate ecosystem clarification

The crates used form a single Cargo workspace (`unity-asset` by Latias94, crates.io v0.2.0):

- **`unity-asset-core` v0.2.0** — shared types: `UnityValue`, `UnityClass`, class IDs
- **`unity-asset-binary` v0.2.0** — UnityFS parser: bundle loading, object handles, TypeTree deserialization → produces `UnityObject`
- **`unity-asset-decode` v0.2.0** — higher-level decoders: re-exports the above + provides `Texture2DConverter`, `SpriteParser`, `AssetBundle` convenience type, etc.

**Dependency workaround required:** `unity-asset-decode`'s `Texture2DConverter::validate()` returns `supported: false` for `BC7` and `DXT5Crunched` formats (not listed in its `TextureFormatInfo` match arms), causing decode to fail. Fix: use `texture2ddecoder` v0.1 directly for these formats:
```rust
texture2ddecoder::decode_bc7(&tex.image_data, w, h, &mut buf)?;
texture2ddecoder::decode_crunch(&tex.image_data, w, h, &mut buf)?;
```

**SpriteAtlas lookup required:** For Unity Addressables atlas sprites, `m_RD.texture.m_PathID` is always 0 (null). The real texture reference is in the SpriteAtlas object's `m_RenderDataMap`, keyed by the sprite's `m_RenderDataKey` GUID.

### Candidate crates investigated

| Crate | Version | Status | Unity 6 / v8 Support |
|-------|---------|--------|----------------------|
| `unity-asset` (Latias94) | 0.2.0 | Active (2025) | ✅ Confirmed GO |
| `unity-asset-binary` | 0.2.0 | Active (2025) | ✅ Confirmed GO |
| `unity-asset-decode` | 0.2.0 | Active (2025) | ✅ Confirmed GO (with BC7 workaround) |
| `io_unity` (gameltb) | 0.8.3 | Active | ⚠️ Requires TypeTree dumps |
| `RustyAssetBundleEXtractor` | WIP | "can do about nothing" | ❌ |

### Addressables catalog complexity

The binary catalog (`catalog.bin`) format is internal to Unity Addressables and changes between versions. **No Rust crate supports parsing it.** However, the bundle path is hardcoded as:

```
{RuntimePath}/StandaloneWindows64/skill_icons_assets_all.bundle
```

The bundle path can be hardcoded in Rust code, bypassing the need to parse the catalog at all.

---

## 4. CDN URL Pattern

### `assets.lastepochtools.com` — Does not exist

The URL pattern assumed in the epics (`https://assets.lastepochtools.com/skills/{skill_id}.png`) is **incorrect**. The subdomain `assets.lastepochtools.com` does not resolve.

### `www.lastepochtools.com` — Confirmed accessible, but uses sprite sheets (manual browser inspection 2026-05-08)

The domain is protected by Cloudflare WAF against automated access but loads normally in a real browser. Manual DevTools inspection reveals that **skill icons are not served as individual image files** — the site uses CSS sprite sheets.

**How it works:**
- A single large WebP image is downloaded containing many icons packed together
- CSS `background-position` offsets select the specific 64×64 region for each skill
- No per-skill URL exists that returns a single icon image

**Confirmed example — Abyssal Echoes (Acolyte/Lich):**
```
Sprite sheet URL:  https://www.lastepochtools.com/data/version145/planner/res/01a7d73f4d0c94422564bdc8e9a068e6.webp
Background offset: background-position: -130px -453px
Rendered size:     64px × 64px
```

**Mapping required:** `skillId → (sprite_sheet_url, x_offset, y_offset)`

This is not derivable from our game data.

### `tunklab.com` — Currently down (likely temporary)

The site returns Cloudflare error 526 (Invalid SSL certificate) — this is typically a temporary origin SSL misconfiguration, not a permanent closure. Revisit before Story 2.2 CDN scope is finalized.

---

## 5. GO / NO-GO Recommendation

### Game file extraction: **GO ✅** (empirically confirmed)

The `unity-asset-decode` v0.2.0 crate successfully parses the bundle, decodes all BC7 atlas textures, resolves sprite positions via SpriteAtlas render data, and extracts **1,027 valid PNG skill icons** from the bundle.

**Confirmed outputs (2026-05-08):**
- `lebo/src-tauri/resources/icons/skills/` — 1,027 PNG files (all `skillIcon-*.png`)
- `lebo/src-tauri/resources/icons/skill-icon-map.json` — auto-generated skillId → filename mapping

**Remaining caveats:**
- 199 status effect icons (freeze, bleed, poison, etc.) reference a separate bundle not included in `skill_icons_assets_all.bundle` — these are not needed for skill tree rendering
- skillId → icon name mapping achieves ~75% auto-match; remaining entries require a hand-curated lookup table
- The bundle path is hardcoded for Windows; macOS path needs separate detection logic

### CDN path: **NOT RECOMMENDED**

> `lastepochtools.com` uses CSS sprite sheets, not individual icon URLs. Now that local extraction is confirmed GO, the CDN path offers no advantage and adds internet dependency + version coupling.

---

## 6. Impact on Story 2.2

Given the confirmed GO for local extraction:

**Story 2.2 (`2-2-rust-icon-pipeline-commands`) should implement:**
1. A Tauri command `extract_skill_icons()` that copies pre-extracted PNGs from `src-tauri/resources/icons/skills/` to the icon cache
2. A Tauri command `get_icon_path(skill_id)` that returns the cache path for a given skill ID
3. The lookup uses `skill-icon-map.json` to resolve skill IDs to filenames
4. Icons at `lebo/src-tauri/resources/icons/skills/` are already extracted — no runtime bundle parsing needed

**Story 2.2 does NOT need to:**
- Parse Unity bundles at runtime (extraction is a one-time dev-time operation)
- Make CDN requests
- Handle `catalog.bin`

**Re-extraction:** Run `tools/extract-icons/` whenever the game patches. The tool takes ~15 seconds.

---

## 6a. Passive Tree Node Icons — Supplemental Finding

**Investigated during code review (2026-05-08).**

No dedicated passive tree node icon bundle exists in `StreamingAssets/aa/StandaloneWindows64/`. The named bundle inventory contains only `skill_icons_assets_all.bundle` for icons. Passive node icons are almost certainly embedded in either:

- `defaultlocalgroup_assets_all.bundle` (390 MB — Unity's catch-all Addressables group)
- One or more of the 495 anonymous `duplicateassetssortedbylabel_assets_duplicatebundleN.bundle` files

Identifying which bundle contains passive node icons requires a Unity asset viewer tool (e.g., AssetRipper) to catalog bundle contents — substantially more work than the skill icon pipeline, which has a single known bundle path.

**Decision for Story 2.4:** Limit "icon-accurate" scope to active skill tree nodes only. Passive tree hexagons use colored/styled rendering (already implemented) with no per-node icon art.

---

## 7. Extraction Tool Reference

**Tool location:** `tools/extract-icons/` (standalone Rust binary, NOT part of the Tauri app)

**Run from project root:**
```bash
# Probe mode (verify bundle is readable, ~1s)
cargo run --manifest-path tools/extract-icons/Cargo.toml

# Full extraction (~15s)
cargo run --manifest-path tools/extract-icons/Cargo.toml -- --extract
```

**Outputs:**
- `lebo/src-tauri/resources/icons/skills/{name}.png` — 1,027 icon PNGs (128×128 RGBA)
- `lebo/src-tauri/resources/icons/skill-icon-map.json` — `{ "acolyte-rip-blood": "skillIcon-rip blood.png", ... }`

**Cargo.toml dependencies:**
```toml
unity-asset-core = "0.2.0"
unity-asset-decode = { version = "0.2.0", features = ["texture-advanced", "sprite"] }
texture2ddecoder = "0.1"    # BC7 + Crunch decode bypass
image = { version = "0.25", features = ["png"] }
serde_json = "1"
indexmap = "2"               # matches unity-asset-core's IndexMap type
```
