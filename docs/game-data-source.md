# Last Epoch Game Data Source

**Spike:** Story 1.3a
**Date:** 2026-04-21
**Status:** Complete — GO decision reached
**Researched by:** Claude Sonnet 4.6 (BMAD dev agent)

---

## Decision Summary

**Primary source:** Manually curated static JSON dataset, seeded from publicly available community pages (lastepochtools.com node pages, lastepoch.tunklab.com, Last Epoch wiki).

**Rationale:** No public API exists. Official EHG API is partner-only. Community GitHub data is incomplete or unlicensed. Actual node counts are small enough (~47 passive nodes per mastery, ~29 per skill tree) that a maintained static JSON bundle is the correct scope for MVP.

**Fallback:** Bundle the static JSON in the installer for offline-first first launch. The architecture already specifies this (`manifest.json` + per-class versioned JSON files in app data directory).

**Long-term:** EHG confirmed they are "exploring ways" to expose data publicly and have an official API section in their support docs (currently partner-only). File a partner request to EHG after MVP ships.

---

## Sources Evaluated

### 1. Official EHG Game Data API

| Field | Detail |
|-------|--------|
| URL | `https://support.lastepoch.com/hc/en-us/sections/1260802021429-Last-Epoch-s-Game-Data-API` |
| Status | **Partner-only, not publicly available** |
| Format | Unknown (undocumented publicly) |
| ToS | N/A — restricted access |

**Finding:** EHG developer Kain confirmed on the official forums (Feb 2025): *"The API is not publicly available and is currently limited access to partners during development."* The forum thread was closed May 2025 with no public access announced. The support section exists and signals EHG intends to release it eventually, but it is blocked for MVP.

**Decision:** ❌ Cannot use — not accessible. Flag for post-MVP partner request.

---

### 2. lastepochtools.com (by Dammitt)

| Field | Detail |
|-------|--------|
| URL | `https://www.lastepochtools.com/` |
| Node pages | `https://www.lastepochtools.com/skills/{class_or_mastery}/nodes` |
| Tree pages | `https://www.lastepochtools.com/skills/{class_or_mastery}/tree` |
| API | None documented |
| ToS | Site footer: "Not affiliated with Eleventh Hour Games. © Dammitt 2019–2026." — no explicit API or redistribution terms |
| Direct fetch | Returns HTTP 403 |

**Finding:** The site has one page per class/mastery listing all passive tree nodes with name, description, and point cost. It is the most comprehensive community data viewer but serves no API. Direct HTTP fetching is blocked. There is no GitHub repo linked from the site. Dammitt's Discord is accessible for feedback but no data license is published.

**Decision:** ❌ Cannot scrape (403 blocks, no API). ✅ Can use as **reference source** for manual curation — the node pages are human-readable and serve as the authoritative community cross-reference.

---

### 3. lastepoch.tunklab.com (by Tunk)

| Field | Detail |
|-------|--------|
| URL | `https://lastepoch.tunklab.com/` |
| Data version | 1.4.4 |
| API | None documented |
| License | "Slapped together by Tunk" — no explicit license |
| Data scope | All 5 classes, passive trees, 133 skills, 3,862 skill nodes, bestiary, affixes, items |

**Finding:** Human-readable community reference database. Pages are fetchable and contain node counts per mastery. No machine-readable API, no documented JSON endpoints.

**Decision:** ❌ Cannot use as an API. ✅ Use as **cross-reference** for manual curation and node count verification.

---

### 4. github.com/prowner/last-epoch-data

| Field | Detail |
|-------|--------|
| URL | `https://github.com/prowner/last-epoch-data` |
| Language | TypeScript |
| Data | Datamined `skillTrees.ts` + manually processed `skillTreeNodes.ts` |
| Completeness | ~1 skill tree at 100%; most classes incomplete |
| License | **None stated** |
| Stars | 0 |
| Commits | 28 |

**Finding:** Small community initiative targeting DPS calculation node structuring. The datamined `skillTrees.ts` contains raw stat objects (`statName`, `value`, `property`). The processed format adds `property`, `modifierType` (ADDED/INCREASED/MORE), `specialTags`, `tags`, `value`. No position data (x/y coordinates), no edge/connection data, no node IDs for tree rendering. Coverage is too incomplete for MVP.

**Decision:** ❌ Unusable — incomplete, no license, no positional data. Data schema is useful as reference for the `effects`/`tags` field design.

---

### 5. github.com/Musholic/PathOfBuildingForLastEpoch (LastEpochPlanner)

| Field | Detail |
|-------|--------|
| URL | `https://github.com/Musholic/PathOfBuildingForLastEpoch` |
| Language | Lua (99.8%) |
| License | MIT |
| Latest release | v0.11.0 — 2026-04-02 |
| Coverage | All classes; 43% of mods recognized (6,646/15,506) |
| Data format | Lua tables — not JSON; requires conversion |
| Character import | Imports from offline saves and LE Tools |

**Finding:** Most actively maintained community build tool (14 releases, last in April 2026). Contains full class coverage in Lua tables. MIT licensed — redistribution permitted. However: (a) data is in Lua, not JSON; (b) 57% of mods are unrecognized, meaning effect/tag data is incomplete; (c) positional data for tree node layout is unclear from repo inspection.

**Decision:** ⚠️ Partially usable as reference. MIT license allows derivative use. The Lua data tables could be converted to JSON as a data seeding exercise. Not viable as an automated runtime data source.

---

## Chosen Strategy: Curated Static JSON Bundle

### Approach

Story 1.3b will implement a **manually curated static JSON dataset** bundled with the installer. The data is authored once (seeded from community sources above), versioned with the game version it targets, and updated manually when EHG ships significant patches.

This is the same approach used by LastEpochPlanner (Lua tables) and is appropriate for MVP given the small actual node counts.

### Data Category Availability (AC2)

Confirmed availability of each data category required by downstream stories:

| Data Category | Available? | Source | Notes |
|---------------|-----------|--------|-------|
| Passive tree nodes (all 5 classes, 15 masteries) | ✅ Yes | lastepochtools.com node pages, tunklab.com | Human-readable; must be manually curated into JSON |
| Active skill trees (all 133 skills) | ✅ Yes | lastepochtools.com skill pages, tunklab.com | 3,862 total skill nodes; same manual curation process |
| Gear / item affixes | ✅ Yes | tunklab.com (1,112 affixes, 674 base items, 445 unique items) | Available for Epic 4 Context Panel (Story 4.x); schema TBD in a dedicated spike |
| Idol data | ✅ Yes | tunklab.com (idol types and modifiers listed) | Available for Epic 4; schema TBD |
| Node x/y positions | ❌ No machine-readable source | N/A | Derived algorithmically in Story 1.3b (see Open Questions) |

### Why This Is Viable

| Tree | Node count |
|------|-----------|
| Sentinel base passive | ~15 nodes |
| Void Knight mastery passive | ~31 nodes |
| Forge Guard mastery passive | ~32 nodes |
| Paladin mastery passive | ~32 nodes |
| Average per class/mastery combined | ~46–47 nodes |
| Average skill tree (per active skill) | ~29 nodes (3,862 total ÷ 133 skills) |
| Typical build view (passive + 5 skill trees) | ~47 + (5 × 29) = **~192 nodes** |

All 5 classes × 3 masteries = 15 mastery passive trees. Estimated total passive tree data: ~700 nodes.  
All 133 skill trees × ~29 nodes = ~3,862 skill nodes.  
**Grand total: ~4,562 game nodes across entire dataset.**

A static JSON bundle covering all of this is well within maintainability scope for MVP. The PixiJS benchmark at 800 nodes provides **>4× safety margin** over any single-view rendering load — no re-run needed.

### Attribution

The dataset is authored by Alec/LEBOv2 contributors using publicly available community information. Where data is cross-referenced from specific tools:
- lastepochtools.com node pages (Dammitt)
- lastepoch.tunklab.com (Tunk)
- Official Last Epoch wiki (Fandom)

No data is redistributed verbatim from any source. The JSON schema is LEBOv2's own format.

---

## Data Format Specification

### Directory Layout (app data directory)

```
{app_data}/lebo/game-data/
  manifest.json
  classes/
    sentinel.json
    mage.json
    primalist.json
    acolyte.json
    rogue.json
  skills/
    {skill_id}.json   (one file per active skill)
```

### manifest.json

```json
{
  "schemaVersion": 1,
  "gameVersion": "1.4.4",
  "dataVersion": "1.0.0",
  "generatedAt": "2026-04-21T00:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"]
}
```

### classes/{class_id}.json

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
        "effects": [
          {
            "description": "+4 Melee Physical Damage per point",
            "tags": ["MELEE", "PHYSICAL"]
          }
        ]
      }
    ],
    "edges": [
      { "fromId": "sentinel-base-gladiator", "toId": "sentinel-base-shield-rush" }
    ]
  },
  "masteries": [
    {
      "id": "void_knight",
      "name": "Void Knight",
      "passiveTree": {
        "nodes": [ /* same node schema; IDs use "void-knight-passive-{node-name-slug}" */ ],
        "edges": [ /* same edge schema */ ]
      }
    },
    {
      "id": "forge_guard",
      "name": "Forge Guard",
      "passiveTree": { "nodes": [], "edges": [] }
    },
    {
      "id": "paladin",
      "name": "Paladin",
      "passiveTree": { "nodes": [], "edges": [] }
    }
  ]
}
```

### skills/{skill_id}.json

`skill_id` format: **kebab-case slug of the skill name** (e.g., `rive`, `tempest-strike`, `bone-curse`). Globally unique within Last Epoch — skill names are unique across all classes. File name matches the `id` field exactly.

```json
{
  "id": "rive",
  "name": "Rive",
  "classId": "sentinel",
  "tree": {
    "nodes": [
      {
        "id": "rive-blade-weaver",
        "name": "Blade Weaver",
        "x": 0,
        "y": 0,
        "size": "medium",
        "maxPoints": 1,
        "effects": [
          {
            "description": "Gain a stack of Blade Weaver for 4 seconds on hit...",
            "tags": ["MELEE"]
          }
        ]
      }
    ],
    "edges": [
      { "fromId": "rive-blade-weaver", "toId": "rive-serrated-edge" }
    ]
  }
}
```

### Node Schema Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | **Slug-based** unique node ID. Pattern: `{class_slug}-{tree_type}-{node_name_slug}` (e.g., `sentinel-base-gladiator`, `void-knight-passive-void-blade`). Stable across patch additions; never use sequential indexes. |
| `name` | `string` | Display name of the node |
| `x`, `y` | `number` | World-space position for PixiJS layout (integer, relative to tree origin 0,0). **Derived algorithmically** from the connection graph using a radial/layered layout (same approach as `mockTreeData.ts`). Positions are approximate until EHG releases coordinate data. Story 1.3b implements the layout algorithm. |
| `size` | `"small" \| "medium" \| "large"` | Visual size class; maps to NODE_RADIUS in pixiRenderer |
| `maxPoints` | `number` | Maximum points allocatable (1 for milestone nodes; 2–8 for stat nodes) |
| `effects` | `{description: string, tags: string[]}[]` | Per-point effect description (e.g., `"+4 Melee Physical Damage per point"`). Scoring engine multiplies `value` by player's allocated point count. Single entry for flat-bonus nodes; multiple entries only for nodes where the effect type changes between tiers (rare). |

### Edge Schema Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `fromId` | `string` | Source node ID |
| `toId` | `string` | Target node ID |

Edges are stored as directed (from prerequisite → dependent) to enable prerequisite validation in Story 1.5.

---

## ToS Compliance Assessment

| Source | ToS Status |
|--------|-----------|
| EHG official API | Partner-only; not available |
| lastepochtools.com | No explicit redistribution terms; not scraped |
| lastepoch.tunklab.com | No license; used for reference only, not redistributed |
| prowner/last-epoch-data | No license; not used |
| Musholic/PathOfBuildingForLastEpoch | MIT; derivative use permitted |
| Last Epoch wiki (Fandom) | CC BY-SA 3.0; attribution required if redistributing wiki text verbatim — effect descriptions will be rephrased |
| Original game data | EHG © — game mechanics (node names, effect values) are factual data not protected by copyright; fan tool use consistent with EHG's stated intention to support tool development |

**Risk assessment:** Low. This approach is consistent with how every other Last Epoch community tool (LE Tools, LastEpochPlanner, tunklab.com) operates. EHG has never issued takedowns against community tool builders and actively maintains an API section on their support site indicating intent to support developers.

---

## Update Strategy

### EHG Patch Cadence (Update Frequency)

EHG ships approximately **2–4 major content patches per year** (each may change passive/skill tree structure) and **monthly hotfixes** (typically balance tweaks to node values, not tree topology). Major patches (e.g., 1.0, 1.1, 1.2, 1.3, 1.4) are the ones most likely to require JSON updates. Hotfixes rarely require tree structure changes.

**Expected maintenance burden:** Roughly quarterly full data review; monthly spot-checks after hotfixes.

### Version Field Semantics

| Field | Meaning |
|-------|---------|
| `gameVersion` | EHG's public release version string (e.g., `"1.4.4"`) — matches EHG's patch notes exactly. Used by Story 1.7 staleness detection to compare local vs. remote. |
| `dataVersion` | LEBOv2's internal JSON schema version (e.g., `"1.0.0"`). Increments when the JSON field structure changes (schema migration), not when node values change. `gameVersion` handles content versioning; `dataVersion` handles schema versioning. |
| `schemaVersion` | Integer (1, 2, …). Increments only when the manifest structure itself changes. Frontend uses this to detect incompatible manifest formats. |

### Trigger Table

| Trigger | Action |
|---------|--------|
| EHG game patch with tree changes | Manually update affected JSON files; bump `dataVersion`; update `gameVersion` |
| EHG public API becomes available | Replace static bundle fetch with live API call in `game_data_service.rs`; static bundle becomes offline fallback only |
| Community discovers a significant error | Hotfix the JSON; ship data update without full app release |
| JSON schema structure changes | Bump `dataVersion`; may require app update if Rust deserialization breaks |

The `manifest.json` `gameVersion` field enables Story 1.7 (staleness detection) to compare local vs. remote game version.

> **Note (deferred):** Story 1.7 requires a remote `manifest.json` URL to compare against. No community service currently hosts a versioned manifest for this purpose. Story 1.7 will define the hosting strategy (e.g., GitHub release asset, dedicated endpoint).

---

## Implementation Guidance for Story 1.3b

1. **Bundled data**: Store the complete JSON dataset in `src-tauri/resources/game-data/` at build time. Tauri's `include_str!()` or resource embedding copies it to app data directory on first launch.

2. **Runtime location**: Copy to `{app_data_dir}/lebo/game-data/` on first launch only (check for `manifest.json` existence). Never overwrite unless user triggers a manual update.

3. **Tauri commands to implement**:
   - `load_game_data(class_id: Option<String>)` — returns parsed class JSON
   - `load_skill_data(skill_id: String)` — returns parsed skill JSON
   - `get_manifest()` — returns manifest for version display (FR34)
   - `check_data_freshness()` — compares `manifest.gameVersion` to a remote version file (future: Story 1.7)

4. **HTTP allowlist** (for Story 1.7 future version check): only permit the URL where a remote `manifest.json` lives. No other outbound HTTP for game data in MVP.

5. **Frontend integration**: `src/features/game-data/gameDataLoader.ts` calls `invokeCommand('load_game_data')` for each class on startup, then populates `useGameDataStore`.

6. **Base + mastery tree combination rendering (Story 1.4):** When a user selects a mastery (e.g., Sentinel → Void Knight), the renderer combines `baseTree` nodes and the selected mastery's `passiveTree` nodes into a single `TreeData` object. Both trees share the same world coordinate space — the base class nodes sit in one region, the mastery nodes in another. Cross-tree edges (from base class entry points to mastery root nodes) are defined in the mastery's `passiveTree.edges` array using IDs from both trees. The wrapper component in `src/features/skill-tree/` is responsible for merging `baseTree` + `masteryTree` before passing `treeData` to `SkillTreeCanvas` — `SkillTreeCanvas` itself always receives a single flat `TreeData` prop.

---

## PixiJS Spike Re-Run Assessment

Story 1.2 benchmarked at **800 nodes** — confirmed ≥60fps. Actual maximum rendering load for a single view:

- Passive tree view: ~47 nodes + ~47 edges = ~94 objects
- Skill tree view (single skill): ~29 nodes + ~29 edges = ~58 objects
- **No re-run required.** The 800-node benchmark provides >4× safety margin.

Note in `docs/pixi-spike-report.md` that real counts were verified here and no re-run is needed.

---

## Open Questions / Risks

| Item | Risk | Mitigation |
|------|------|-----------|
| Position coordinates (x, y) not available from any community source | High | Positions must be reconstructed from tree screenshots or estimated algorithmically from connection graph. This is the primary manual effort in Story 1.3b data authoring. |
| Node IDs vary across community tools | Medium | Use our own ID scheme (`{class}_{index}`) — no dependency on external ID schemes |
| Game patches change tree structure | Low-Medium | Version-gated JSON files; `gameVersion` in manifest enables staleness detection |
| EHG DMCA concern | Very Low | EHG has indicated intent to support tool development; no prior enforcement action against community tools |
