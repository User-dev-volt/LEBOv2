---
title: 'Real Game Art Assets — Skill Icons, Background Tiles & Gear Icons'
story_id: '6.5'
story_key: '6-5-real-game-art-assets'
epic: 6
status: backlog
created: '2026-05-27'
---

## Story

**As a player,**
I want the skill tree, gear slots, and passive tree backgrounds to display actual Last Epoch art assets — real skill icons, correct background textures per tree layout, and accurate gear visuals —
**so that** the app feels like a native companion to the game rather than a placeholder prototype.

---

## Context

This story is **asset-integration work** — the game art has been extracted and is ready to use; this story wires it into the existing pipelines.

### 📁 Asset Base Path

**All game assets are at:** `D:\GameAssets\Last Epoch\`

If you need assets that are NOT already in this directory, use the `/rip` skill to extract additional bundles.

### What's Available

```
D:\GameAssets\Last Epoch\
└── UI_Kit\
    ├── 01_skill_icons\          # 1,036 individual skill icon PNGs — READY TO USE
    ├── 02_gear_icons\
    │   ├── weapons_1h\          # 117 icons
    │   ├── uniques_misc\        # 774 icons
    │   ├── idols\               # 82 icons
    │   └── (other subfolders)
    ├── 04_passive_tree\
    │   └── _new_passives_4_background_mastery_background.png
    │       # 377×1024 px — NOT tileable; this is a decorative overlay, not a bg tile
    └── (other kit folders)
```

> **Background tiles (stone, void) are NOT in the UI Kit.** They are baked into Unity scene
> bundles. Use `/rip` to extract them from the scene/environment asset bundles if needed,
> or procedurally generate seamless tiles from the mastery background PNG as a fallback.

---

## Acceptance Criteria

### AC1 — Skill Icons

- [ ] Copy all 1,036 PNGs from `D:\GameAssets\Last Epoch\UI_Kit\01_skill_icons\` into
  `lebo/src-tauri/resources/icons/skills/` (replacing empty placeholders).
- [ ] Generate an updated `lebo/src-tauri/resources/icons/skill-icon-map.json` mapping
  `{class}-{skill-name-kebab}` keys to filenames (see Bridge Script section below).
- [ ] Verify at runtime: `SkillRoleDesignator` loads and displays real icons for all skills
  currently in game data (`mage-fireball`, `mage-glacier`, etc.).

### AC2 — Background Tiles

- [ ] Replace `lebo/public/backgrounds/bg_stone_tile.png` (currently a 568-byte solid-color
  placeholder) with a real seamless stone texture at minimum 256×256.
- [ ] Replace `lebo/public/backgrounds/bg_weaver_tile.png` (currently a solid-color
  placeholder) with an appropriate weaver/cosmic texture tile.
- [ ] Both tiles must be visually tileable (seamless edges) and sized 256×256 px.
- [ ] Source strategy: extract from Unity scene bundles via `/rip`, or crop/process the
  mastery background PNG into seamless tiles.

### AC3 — Gear Icons (Optional / Phase 4 gate)

- [ ] This AC is **blocked on game data expansion** — the current item DB is placeholder-only.
  Wire gear icons once `itemDatabase.ts` is populated with real base/unique item data.
- [ ] When ready: map base item `typeId → filename` from `02_gear_icons\`, place icons in
  `src-tauri/resources/icons/gear/`, and add a Rust copy step analogous to the skill icon
  pipeline.

---

## Technical Notes

### Skill Icon Map Bridge Script

The user has a custom `skill-icon-map.json` keyed by **human-readable skill name**
(e.g., `"fireball" → { "file": "skillIcon-fireball.png" }`). The Rust pipeline expects
keys in `{class}-{skill-name-kebab}` format (e.g., `"mage-fireball"`).

**Bridge script needed** (Python or Node, run once):

1. Read class skill data from `lebo/src-tauri/resources/game-data/classes/*.json`
   to get the mapping `skillId (class-kebab) → skill name`.
2. Normalise the human-readable name to match the user's map keys (lowercase, trim).
3. Look up each skill's icon filename in the user's map.
4. Write `skill-icon-map.json` in `{class}-{skill-name-kebab}: filename` format.

> **Bottleneck:** Game data currently has only 12 skills across 5 classes (2 per class —
> placeholders from story 1.2). The bridge script is trivially runnable now for those 12,
> but the full map requires game data to be populated (Phase 4 task). Run the script
> incrementally as game data grows.

### Current Placeholder State

| Asset | Current state |
|---|---|
| `bg_stone_tile.png` | 568-byte solid `#0a0a0b` fill — functionally identical to old canvas background color |
| `bg_weaver_tile.png` | 569-byte solid fill |
| `skill-icon-map.json` | 9 placeholder entries in `{class}-{skill-kebab}` format |
| Skill icon files in resources | Empty / placeholder PNGs |

### Icon Pipeline (Existing — do not change)

Rust command `initialize_icon_pipeline` in `src-tauri/src/icon_commands.rs`:
- Copies from `src-tauri/resources/icons/skills/` → app cache dir on first run.
- `skill-icon-map.json` is read from the same resources directory.

TS side: `SkillRoleDesignator` calls `get_skill_icon_path` IPC command, receives an
absolute path, and renders `<img src={convertFileSrc(path)}>`.

No pipeline changes needed — only asset content and the JSON map need updating.

### Background Tile Pipeline (Existing — do not change)

`pixiRenderer.ts` loads `bg_stone_tile.png` via `new PIXI.Texture.from('/backgrounds/bg_stone_tile.png')` from the Vite public directory. Serving is handled by Vite/Tauri's asset protocol — just replace the file in `lebo/public/backgrounds/`.

The tile is rendered as a `TilingSprite` at 20000×20000 world-space. Seamless edges matter; the tile size (currently 256×256) can be adjusted via the `tileScale` property in `pixiRenderer.ts` if needed.

---

## Getting More Assets

If the assets needed for this story are not in `D:\GameAssets\Last Epoch\`:

1. Run the `/rip` skill (Claude skill, available in this project).
2. Target the Unity bundle that contains the required textures:
   - Scene/environment bundles for stone/void backgrounds.
   - UI bundles for any additional icon sheets.
3. `/rip` will extract and stage the assets — update this story with the new paths.

---

## Out of Scope

- Game data population (12 → full skill DB) — Phase 4 story.
- Weaver tree data wiring — separate story.
- Animated effects or VFX — beyond Phase 3 scope.
