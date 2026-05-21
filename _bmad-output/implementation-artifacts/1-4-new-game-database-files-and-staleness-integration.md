# Story 1.4: New Game Database Files & Staleness Integration

Status: review

## Story

As a player,
I want the app to load idol, blessings, and conditions data on startup and surface staleness indicators when those databases are out of date,
so that the context input features in Epic 3 have correct data from day one and players are notified when updates are available.

## Acceptance Criteria

1. **Given** the Tauri resource bundle
   **When** the app starts for the first time
   **Then** `idol-data.json`, `blessings.json`, and `conditions.json` are all loaded without error
   **And** all loading uses `invokeCommand<T>()` — never raw `invoke()`

2. **Given** `gameDataStore`
   **When** the store is initialized
   **Then** it exposes `isIdolDataStale`, `idolDataStaleAcknowledged`, `isBlessingsDataStale`, `blessingsDataStaleAcknowledged` boolean flags
   **And** the new flags follow the identical initialization pattern as the existing `isItemDataStale` flag

3. **Given** the loaded `idol-data.json`
   **When** the default grid layout is accessed
   **Then** the grid has 5 rows and 5 columns with exactly 5 blocked cells: (0,0), (0,4), (4,0), (4,4), (2,2)
   **And** the `altarVariants` array is present and empty

4. **Given** the loaded `blessings.json`
   **When** blessings are queried by timeline
   **Then** all current Season 4 monolith timeline blessings are present with their stat effects
   **And** each blessing entry includes: `id`, `timelineId`, `timelineName`, `displayName`, and `statEffects[]`

5. **Given** the loaded `conditions.json`
   **When** universal conditions are queried
   **Then** entries for enemy type, per-element enemy resistance, and charge counts (frenzy, power, endurance) are all present
   **And** build-specific conditions include at minimum: "Sigil of Hope active" (Paladin), "Is enemy Hexed?" (hex builds)

## Tasks / Subtasks

- [x] Task 1: Create context-data resource directory and JSON files (AC: #1, #3, #4, #5)
  - [x] Create directory `lebo/src-tauri/resources/context-data/`
  - [x] Create `idol-data.json` with grid spec, idol types, and affix pools (see Dev Notes for full content)
  - [x] Create `blessings.json` with all 12 Season 4 timeline blessings (see Dev Notes for full content)
  - [x] Create `conditions.json` with universal + build-specific conditions (see Dev Notes for full content)

- [x] Task 2: Extend `GameDataManifest` Rust struct and update merge (AC: #2)
  - [x] Open `lebo/src-tauri/src/models/game_data.rs`
  - [x] Add `#[serde(default)] pub idol_data_version: Option<String>` to `GameDataManifest`
  - [x] Add `#[serde(default)] pub blessings_data_version: Option<String>` to `GameDataManifest`
  - [x] Open `lebo/src-tauri/src/commands/game_data_commands.rs`
  - [x] In `download_game_data_update`, add `merged.idol_data_version = local.idol_data_version;` and `merged.blessings_data_version = local.blessings_data_version;` alongside the existing `merged.item_data_version` carry-forward
  - [x] Update bundled `lebo/src-tauri/resources/game-data/manifest.json` to add `"idolDataVersion": "s4.1"` and `"blessingsDataVersion": "s4.1"` fields

- [x] Task 3: Create `models/context_data.rs` — Rust data structs (AC: #3, #4, #5)
  - [x] Create new file `lebo/src-tauri/src/models/context_data.rs` with all structs (see Dev Notes for exact definitions)
  - [x] Add `pub mod context_data;` to `lebo/src-tauri/src/models/mod.rs`

- [x] Task 4: Create `services/context_data_service.rs` (AC: #1)
  - [x] Create new file `lebo/src-tauri/src/services/context_data_service.rs` with copy/load functions (see Dev Notes for exact implementations)
  - [x] Add `pub mod context_data_service;` to `lebo/src-tauri/src/services/mod.rs`

- [x] Task 5: Create `commands/context_data_commands.rs` — 5 new Tauri commands (AC: #1, #2)
  - [x] Create new file `lebo/src-tauri/src/commands/context_data_commands.rs` with all 5 commands (see Dev Notes)
  - [x] Add `pub mod context_data_commands;` to `lebo/src-tauri/src/commands/mod.rs`

- [x] Task 6: Register new commands in `lib.rs` (AC: #1)
  - [x] Add import: `use commands::context_data_commands::{load_idol_data, load_blessings_data, load_conditions_data, check_idol_data_freshness, check_blessings_data_freshness};`
  - [x] Register all 5 commands in `invoke_handler!`

- [x] Task 7: Update `tauri.conf.json` resources bundle (AC: #1)
  - [x] Add the 3 context-data files to the `bundle.resources` array
  - [x] Also add the missing `"resources/items/set-items.json"` entry (pre-existing gap from story 1.3)

- [x] Task 8: Create TypeScript type file `shared/types/contextDatabase.ts` (AC: #3, #4, #5)
  - [x] Create new file with all interfaces (see Dev Notes for exact definitions)
  - [x] Do NOT create a barrel `index.ts` file

- [x] Task 9: Create `features/context-database/contextDatabaseLoader.ts` (AC: #1, #2)
  - [x] Create new feature folder `lebo/src/features/context-database/`
  - [x] Create `contextDatabaseLoader.ts` with 5 async functions (see Dev Notes)

- [x] Task 10: Extend `shared/stores/gameDataStore.ts` (AC: #2)
  - [x] Add `idolData`, `blessingsDatabase`, `conditionsDatabase` data fields and setters
  - [x] Add `isIdolDataStale`, `idolDataStaleAcknowledged` flags + setters (mirroring `isItemDataStale` pattern exactly)
  - [x] Add `isBlessingsDataStale`, `blessingsDataStaleAcknowledged` flags + setters

- [x] Task 11: Update `App.tsx` startup loading (AC: #1)
  - [x] Import the 3 loaders from `context-database/contextDatabaseLoader`
  - [x] Add `loadIdolData()`, `loadBlessingsData()`, `loadConditionsData()` calls in the startup `useEffect` (fire-and-forget `.catch(console.error)` pattern)

- [x] Task 12: Verify end-to-end (AC: #1–5)
  - [x] Run `pnpm build` from `lebo/` — zero TypeScript errors required
  - [x] Run `cargo build` from `lebo/src-tauri/` — zero Rust errors required
  - [x] Run `pnpm vitest` — confirm no new regressions (8 pre-existing failures from stories 1.1/1.2 remain expected)

---

## Dev Notes

### Architecture Overview — What This Story Touches

This story has four scopes:

1. **Data creation** (Task 1): Three new JSON resource files in `resources/context-data/`. These are the game databases that Epic 3 features will consume.
2. **Rust extension** (Tasks 2–6): New Rust model structs, service layer, and 5 Tauri commands. All mirror the existing `item_data_service.rs` / `item_commands.rs` pattern exactly.
3. **TypeScript extension** (Tasks 8–11): New types, new loaders, store extension, and App.tsx wiring. Mirrors `itemDatabaseLoader.ts` / `gameDataStore.ts` item pattern exactly.
4. **Config** (Task 7): Bundle resources registration.

**No new stores** — all new data goes into `gameDataStore`, following the 4-store rule from `project-context.md`.

**Error prefix convention**: All Rust errors in `context_data_service.rs` and `context_data_commands.rs` must use `"CONTEXT_DATA_ERROR: "` prefix — this keeps them distinct from `"ITEM_DATA_ERROR: "`, `"STORAGE_ERROR: "`, and `"NETWORK_ERROR: "` prefixes and allows future `ErrorType` enum extension in Story 2.1.

---

### Task 1 — JSON Resource File Content (Exact)

#### `lebo/src-tauri/resources/context-data/idol-data.json`

This file defines the Season 4 idol grid layout, idol size types, and their affix pools. The affix pool values are representative approximations — verify exact values against lastepochtools.com before Story 3.2 ships.

```json
{
  "version": "s4.1",
  "defaultGrid": {
    "rows": 5,
    "cols": 5,
    "blockedCells": [[0,0],[0,4],[4,0],[4,4],[2,2]]
  },
  "altarVariants": [],
  "idolTypes": [
    {
      "id": "small-1x1",
      "displayName": "Small Idol",
      "rows": 1,
      "cols": 1,
      "requiresBoth": false,
      "prefixPool": [
        {"id": "idol-small-added-fire-damage", "displayName": "of Flame", "type": "prefix", "tiers": [{"tier": 1, "minValue": 3.0, "maxValue": 5.0}, {"tier": 2, "minValue": 6.0, "maxValue": 8.0}, {"tier": 3, "minValue": 9.0, "maxValue": 12.0}], "statKey": "added_fire_damage", "modifierType": "flat"},
        {"id": "idol-small-increased-physical-damage", "displayName": "Brutal", "type": "prefix", "tiers": [{"tier": 1, "minValue": 8.0, "maxValue": 12.0}, {"tier": 2, "minValue": 13.0, "maxValue": 17.0}, {"tier": 3, "minValue": 18.0, "maxValue": 22.0}], "statKey": "increased_physical_damage", "modifierType": "increased"},
        {"id": "idol-small-fire-resistance", "displayName": "of the Ember", "type": "prefix", "tiers": [{"tier": 1, "minValue": 8.0, "maxValue": 10.0}, {"tier": 2, "minValue": 11.0, "maxValue": 13.0}, {"tier": 3, "minValue": 14.0, "maxValue": 16.0}], "statKey": "fire_resistance", "modifierType": "flat"},
        {"id": "idol-small-cold-resistance", "displayName": "of the Tundra", "type": "prefix", "tiers": [{"tier": 1, "minValue": 8.0, "maxValue": 10.0}, {"tier": 2, "minValue": 11.0, "maxValue": 13.0}, {"tier": 3, "minValue": 14.0, "maxValue": 16.0}], "statKey": "cold_resistance", "modifierType": "flat"},
        {"id": "idol-small-lightning-resistance", "displayName": "of the Storm", "type": "prefix", "tiers": [{"tier": 1, "minValue": 8.0, "maxValue": 10.0}, {"tier": 2, "minValue": 11.0, "maxValue": 13.0}, {"tier": 3, "minValue": 14.0, "maxValue": 16.0}], "statKey": "lightning_resistance", "modifierType": "flat"}
      ],
      "suffixPool": []
    },
    {
      "id": "humble-1x2",
      "displayName": "Humble Idol",
      "rows": 1,
      "cols": 2,
      "requiresBoth": true,
      "prefixPool": [
        {"id": "idol-humble-increased-fire-damage", "displayName": "of Conflagration", "type": "prefix", "tiers": [{"tier": 1, "minValue": 20.0, "maxValue": 25.0}, {"tier": 2, "minValue": 26.0, "maxValue": 31.0}, {"tier": 3, "minValue": 32.0, "maxValue": 38.0}], "statKey": "increased_fire_damage", "modifierType": "increased"},
        {"id": "idol-humble-increased-cold-damage", "displayName": "of the Glacier", "type": "prefix", "tiers": [{"tier": 1, "minValue": 20.0, "maxValue": 25.0}, {"tier": 2, "minValue": 26.0, "maxValue": 31.0}, {"tier": 3, "minValue": 32.0, "maxValue": 38.0}], "statKey": "increased_cold_damage", "modifierType": "increased"},
        {"id": "idol-humble-increased-void-damage", "displayName": "of the Void", "type": "prefix", "tiers": [{"tier": 1, "minValue": 20.0, "maxValue": 25.0}, {"tier": 2, "minValue": 26.0, "maxValue": 31.0}, {"tier": 3, "minValue": 32.0, "maxValue": 38.0}], "statKey": "increased_void_damage", "modifierType": "increased"},
        {"id": "idol-humble-max-hp", "displayName": "Stalwart", "type": "prefix", "tiers": [{"tier": 1, "minValue": 25.0, "maxValue": 35.0}, {"tier": 2, "minValue": 36.0, "maxValue": 46.0}, {"tier": 3, "minValue": 47.0, "maxValue": 60.0}], "statKey": "max_hp", "modifierType": "flat"}
      ],
      "suffixPool": [
        {"id": "idol-humble-crit-chance", "displayName": "of Precision", "type": "suffix", "tiers": [{"tier": 1, "minValue": 3.0, "maxValue": 4.0}, {"tier": 2, "minValue": 5.0, "maxValue": 6.0}, {"tier": 3, "minValue": 7.0, "maxValue": 8.0}], "statKey": "critical_strike_chance", "modifierType": "increased"},
        {"id": "idol-humble-attack-speed", "displayName": "of Swiftness", "type": "suffix", "tiers": [{"tier": 1, "minValue": 4.0, "maxValue": 6.0}, {"tier": 2, "minValue": 7.0, "maxValue": 9.0}, {"tier": 3, "minValue": 10.0, "maxValue": 12.0}], "statKey": "attack_speed", "modifierType": "increased"},
        {"id": "idol-humble-cast-speed", "displayName": "of Channeling", "type": "suffix", "tiers": [{"tier": 1, "minValue": 4.0, "maxValue": 6.0}, {"tier": 2, "minValue": 7.0, "maxValue": 9.0}, {"tier": 3, "minValue": 10.0, "maxValue": 12.0}], "statKey": "cast_speed", "modifierType": "increased"},
        {"id": "idol-humble-all-resistances", "displayName": "of Warding", "type": "suffix", "tiers": [{"tier": 1, "minValue": 4.0, "maxValue": 6.0}, {"tier": 2, "minValue": 7.0, "maxValue": 9.0}, {"tier": 3, "minValue": 10.0, "maxValue": 12.0}], "statKey": "all_resistances", "modifierType": "flat"}
      ]
    },
    {
      "id": "stout-1x3",
      "displayName": "Stout Idol",
      "rows": 1,
      "cols": 3,
      "requiresBoth": true,
      "prefixPool": [
        {"id": "idol-stout-increased-spell-damage", "displayName": "of the Arcane", "type": "prefix", "tiers": [{"tier": 1, "minValue": 25.0, "maxValue": 32.0}, {"tier": 2, "minValue": 33.0, "maxValue": 40.0}, {"tier": 3, "minValue": 41.0, "maxValue": 50.0}], "statKey": "increased_spell_damage", "modifierType": "increased"},
        {"id": "idol-stout-increased-minion-damage", "displayName": "of the Commander", "type": "prefix", "tiers": [{"tier": 1, "minValue": 25.0, "maxValue": 32.0}, {"tier": 2, "minValue": 33.0, "maxValue": 40.0}, {"tier": 3, "minValue": 41.0, "maxValue": 50.0}], "statKey": "increased_minion_damage", "modifierType": "increased"},
        {"id": "idol-stout-armor", "displayName": "Plated", "type": "prefix", "tiers": [{"tier": 1, "minValue": 60.0, "maxValue": 80.0}, {"tier": 2, "minValue": 81.0, "maxValue": 100.0}, {"tier": 3, "minValue": 101.0, "maxValue": 125.0}], "statKey": "armor", "modifierType": "flat"},
        {"id": "idol-stout-max-hp-percent", "displayName": "Vital", "type": "prefix", "tiers": [{"tier": 1, "minValue": 4.0, "maxValue": 5.0}, {"tier": 2, "minValue": 6.0, "maxValue": 7.0}, {"tier": 3, "minValue": 8.0, "maxValue": 10.0}], "statKey": "max_hp_percent", "modifierType": "increased"}
      ],
      "suffixPool": [
        {"id": "idol-stout-crit-multiplier", "displayName": "of Lethal Blows", "type": "suffix", "tiers": [{"tier": 1, "minValue": 10.0, "maxValue": 14.0}, {"tier": 2, "minValue": 15.0, "maxValue": 19.0}, {"tier": 3, "minValue": 20.0, "maxValue": 25.0}], "statKey": "critical_strike_multiplier", "modifierType": "increased"},
        {"id": "idol-stout-void-resistance", "displayName": "of Void Ward", "type": "suffix", "tiers": [{"tier": 1, "minValue": 10.0, "maxValue": 13.0}, {"tier": 2, "minValue": 14.0, "maxValue": 17.0}, {"tier": 3, "minValue": 18.0, "maxValue": 22.0}], "statKey": "void_resistance", "modifierType": "flat"},
        {"id": "idol-stout-poison-resistance", "displayName": "of Toxin Ward", "type": "suffix", "tiers": [{"tier": 1, "minValue": 10.0, "maxValue": 13.0}, {"tier": 2, "minValue": 14.0, "maxValue": 17.0}, {"tier": 3, "minValue": 18.0, "maxValue": 22.0}], "statKey": "poison_resistance", "modifierType": "flat"},
        {"id": "idol-stout-endurance-threshold", "displayName": "of the Bulwark", "type": "suffix", "tiers": [{"tier": 1, "minValue": 3.0, "maxValue": 4.0}, {"tier": 2, "minValue": 5.0, "maxValue": 6.0}, {"tier": 3, "minValue": 7.0, "maxValue": 9.0}], "statKey": "endurance_threshold", "modifierType": "flat"}
      ]
    },
    {
      "id": "grand-2x2",
      "displayName": "Grand Idol",
      "rows": 2,
      "cols": 2,
      "requiresBoth": true,
      "prefixPool": [
        {"id": "idol-grand-increased-damage", "displayName": "of the Destroyer", "type": "prefix", "tiers": [{"tier": 1, "minValue": 10.0, "maxValue": 14.0}, {"tier": 2, "minValue": 15.0, "maxValue": 19.0}, {"tier": 3, "minValue": 20.0, "maxValue": 25.0}], "statKey": "increased_damage", "modifierType": "increased"},
        {"id": "idol-grand-max-hp-flat", "displayName": "Heroic", "type": "prefix", "tiers": [{"tier": 1, "minValue": 80.0, "maxValue": 100.0}, {"tier": 2, "minValue": 101.0, "maxValue": 125.0}, {"tier": 3, "minValue": 126.0, "maxValue": 155.0}], "statKey": "max_hp", "modifierType": "flat"},
        {"id": "idol-grand-ward-per-sec", "displayName": "of Warding", "type": "prefix", "tiers": [{"tier": 1, "minValue": 5.0, "maxValue": 8.0}, {"tier": 2, "minValue": 9.0, "maxValue": 12.0}, {"tier": 3, "minValue": 13.0, "maxValue": 17.0}], "statKey": "ward_per_second", "modifierType": "flat"},
        {"id": "idol-grand-increased-area-damage", "displayName": "Tidal", "type": "prefix", "tiers": [{"tier": 1, "minValue": 15.0, "maxValue": 20.0}, {"tier": 2, "minValue": 21.0, "maxValue": 27.0}, {"tier": 3, "minValue": 28.0, "maxValue": 35.0}], "statKey": "increased_area_damage", "modifierType": "increased"}
      ],
      "suffixPool": [
        {"id": "idol-grand-crit-avoidance", "displayName": "of Negation", "type": "suffix", "tiers": [{"tier": 1, "minValue": 10.0, "maxValue": 14.0}, {"tier": 2, "minValue": 15.0, "maxValue": 20.0}, {"tier": 3, "minValue": 21.0, "maxValue": 27.0}], "statKey": "critical_strike_avoidance", "modifierType": "flat"},
        {"id": "idol-grand-movement-speed", "displayName": "of the Wanderer", "type": "suffix", "tiers": [{"tier": 1, "minValue": 5.0, "maxValue": 7.0}, {"tier": 2, "minValue": 8.0, "maxValue": 10.0}, {"tier": 3, "minValue": 11.0, "maxValue": 14.0}], "statKey": "movement_speed", "modifierType": "increased"},
        {"id": "idol-grand-dodge-rating", "displayName": "of Evasion", "type": "suffix", "tiers": [{"tier": 1, "minValue": 50.0, "maxValue": 65.0}, {"tier": 2, "minValue": 66.0, "maxValue": 82.0}, {"tier": 3, "minValue": 83.0, "maxValue": 100.0}], "statKey": "dodge_rating", "modifierType": "flat"},
        {"id": "idol-grand-life-leech", "displayName": "of Vampirism", "type": "suffix", "tiers": [{"tier": 1, "minValue": 1.0, "maxValue": 1.5}, {"tier": 2, "minValue": 1.6, "maxValue": 2.0}, {"tier": 3, "minValue": 2.1, "maxValue": 2.5}], "statKey": "life_leech_percent", "modifierType": "flat"}
      ]
    }
  ]
}
```

> ⚠️ **Data accuracy note**: Affix IDs, tier values, and `statKey` strings are representative approximations. Verify against lastepochtools.com DB before Story 3.2 ships. The `statKey` strings must match the `StatKey` enum that Story 2.1 will define in `scoring-core`. Coordinate with Story 2.1 dev notes when implementing Story 3.2.

#### `lebo/src-tauri/resources/context-data/blessings.json`

All 12 Season 4 monolith timeline blessings. Each player picks one blessing per timeline.

> ⚠️ **Data accuracy note**: Values are representative approximations from community knowledge. Verify exact percentages against lastepochtools.com before Epic 3 ships. The schema is correct and fixed.

```json
[
  {
    "id": "bfd-twisted-memory",
    "timelineId": "blood-frost-death",
    "timelineName": "Blood, Frost, and Death",
    "displayName": "Twisted Memory",
    "statEffects": [{"statKey": "increased_cold_damage", "value": 30.0, "modifierType": "increased"}]
  },
  {
    "id": "bfd-frost-grasp",
    "timelineId": "blood-frost-death",
    "timelineName": "Blood, Frost, and Death",
    "displayName": "Frost Grasp",
    "statEffects": [{"statKey": "freeze_rate_multiplier", "value": 40.0, "modifierType": "increased"}]
  },
  {
    "id": "bfd-blood-of-the-tundra",
    "timelineId": "blood-frost-death",
    "timelineName": "Blood, Frost, and Death",
    "displayName": "Blood of the Tundra",
    "statEffects": [{"statKey": "life_leech_percent", "value": 1.5, "modifierType": "flat"}]
  },
  {
    "id": "bfd-bone-armor",
    "timelineId": "blood-frost-death",
    "timelineName": "Blood, Frost, and Death",
    "displayName": "Bone Armor",
    "statEffects": [{"statKey": "armor", "value": 120.0, "modifierType": "flat"}]
  },

  {
    "id": "aow-gift-of-winter",
    "timelineId": "age-of-winter",
    "timelineName": "The Age of Winter",
    "displayName": "Gift of Winter",
    "statEffects": [{"statKey": "cold_resistance", "value": 18.0, "modifierType": "flat"}]
  },
  {
    "id": "aow-spirits-of-the-deep",
    "timelineId": "age-of-winter",
    "timelineName": "The Age of Winter",
    "displayName": "Spirits of the Deep",
    "statEffects": [{"statKey": "ward_on_hit", "value": 8.0, "modifierType": "flat"}]
  },
  {
    "id": "aow-winters-bounty",
    "timelineId": "age-of-winter",
    "timelineName": "The Age of Winter",
    "displayName": "Winter's Bounty",
    "statEffects": [{"statKey": "max_hp_percent", "value": 10.0, "modifierType": "increased"}]
  },
  {
    "id": "aow-frozen-time",
    "timelineId": "age-of-winter",
    "timelineName": "The Age of Winter",
    "displayName": "Frozen Time",
    "statEffects": [{"statKey": "cast_speed", "value": 8.0, "modifierType": "increased"}]
  },

  {
    "id": "rod-dragonfire",
    "timelineId": "reign-of-dragons",
    "timelineName": "Reign of Dragons",
    "displayName": "Dragonfire",
    "statEffects": [{"statKey": "increased_fire_damage", "value": 30.0, "modifierType": "increased"}]
  },
  {
    "id": "rod-dragon-scale",
    "timelineId": "reign-of-dragons",
    "timelineName": "Reign of Dragons",
    "displayName": "Dragon Scale",
    "statEffects": [{"statKey": "fire_resistance", "value": 18.0, "modifierType": "flat"}]
  },
  {
    "id": "rod-embers-of-immortality",
    "timelineId": "reign-of-dragons",
    "timelineName": "Reign of Dragons",
    "displayName": "Embers of Immortality",
    "statEffects": [{"statKey": "ignite_duration", "value": 50.0, "modifierType": "increased"}]
  },
  {
    "id": "rod-wings-shadow",
    "timelineId": "reign-of-dragons",
    "timelineName": "Reign of Dragons",
    "displayName": "Wing's Shadow",
    "statEffects": [{"statKey": "dodge_rating", "value": 80.0, "modifierType": "flat"}]
  },

  {
    "id": "tbs-twisted-hearts",
    "timelineId": "the-black-sun",
    "timelineName": "The Black Sun",
    "displayName": "Twisted Hearts",
    "statEffects": [{"statKey": "increased_void_damage", "value": 30.0, "modifierType": "increased"}]
  },
  {
    "id": "tbs-seeds-of-corruption",
    "timelineId": "the-black-sun",
    "timelineName": "The Black Sun",
    "displayName": "Seeds of Corruption",
    "statEffects": [{"statKey": "void_resistance", "value": 18.0, "modifierType": "flat"}]
  },
  {
    "id": "tbs-heart-of-the-maelstrom",
    "timelineId": "the-black-sun",
    "timelineName": "The Black Sun",
    "displayName": "Heart of the Maelstrom",
    "statEffects": [{"statKey": "necrotic_resistance", "value": 18.0, "modifierType": "flat"}]
  },
  {
    "id": "tbs-death-and-rebirth",
    "timelineId": "the-black-sun",
    "timelineName": "The Black Sun",
    "displayName": "Death and Rebirth",
    "statEffects": [{"statKey": "max_hp_percent", "value": 12.0, "modifierType": "increased"}]
  },

  {
    "id": "tlr-exaltation-of-stone",
    "timelineId": "the-last-ruin",
    "timelineName": "The Last Ruin",
    "displayName": "Exaltation of Stone",
    "statEffects": [{"statKey": "armor", "value": 150.0, "modifierType": "flat"}]
  },
  {
    "id": "tlr-ruin-of-the-stone",
    "timelineId": "the-last-ruin",
    "timelineName": "The Last Ruin",
    "displayName": "Ruin of the Stone",
    "statEffects": [{"statKey": "max_hp", "value": 120.0, "modifierType": "flat"}]
  },
  {
    "id": "tlr-end-of-time",
    "timelineId": "the-last-ruin",
    "timelineName": "The Last Ruin",
    "displayName": "End of Time",
    "statEffects": [{"statKey": "movement_speed", "value": 10.0, "modifierType": "increased"}]
  },
  {
    "id": "tlr-devotion",
    "timelineId": "the-last-ruin",
    "timelineName": "The Last Ruin",
    "displayName": "Devotion of the Last",
    "statEffects": [{"statKey": "hp_regen_per_sec", "value": 40.0, "modifierType": "flat"}]
  },

  {
    "id": "ets-stormbreaker",
    "timelineId": "ending-the-storm",
    "timelineName": "Ending the Storm",
    "displayName": "Stormbreaker's Conviction",
    "statEffects": [{"statKey": "increased_lightning_damage", "value": 30.0, "modifierType": "increased"}]
  },
  {
    "id": "ets-lightnings-touch",
    "timelineId": "ending-the-storm",
    "timelineName": "Ending the Storm",
    "displayName": "Lightning's Touch",
    "statEffects": [{"statKey": "critical_strike_chance", "value": 5.0, "modifierType": "increased"}]
  },
  {
    "id": "ets-storms-breath",
    "timelineId": "ending-the-storm",
    "timelineName": "Ending the Storm",
    "displayName": "Storm's Breath",
    "statEffects": [{"statKey": "lightning_resistance", "value": 18.0, "modifierType": "flat"}]
  },
  {
    "id": "ets-endless-torrent",
    "timelineId": "ending-the-storm",
    "timelineName": "Ending the Storm",
    "displayName": "Endless Torrent",
    "statEffects": [{"statKey": "max_mana", "value": 60.0, "modifierType": "flat"}]
  },

  {
    "id": "sof-conflagration",
    "timelineId": "spirits-of-fire",
    "timelineName": "Spirits of Fire",
    "displayName": "Conflagration",
    "statEffects": [{"statKey": "fire_penetration", "value": 12.0, "modifierType": "flat"}]
  },
  {
    "id": "sof-scorched-earth",
    "timelineId": "spirits-of-fire",
    "timelineName": "Spirits of Fire",
    "displayName": "Scorched Earth",
    "statEffects": [{"statKey": "increased_fire_damage", "value": 35.0, "modifierType": "increased"}]
  },
  {
    "id": "sof-eternal-flames",
    "timelineId": "spirits-of-fire",
    "timelineName": "Spirits of Fire",
    "displayName": "Eternal Flames",
    "statEffects": [{"statKey": "ignite_duration", "value": 60.0, "modifierType": "increased"}]
  },
  {
    "id": "sof-searing-light",
    "timelineId": "spirits-of-fire",
    "timelineName": "Spirits of Fire",
    "displayName": "Searing Light",
    "statEffects": [{"statKey": "cast_speed", "value": 10.0, "modifierType": "increased"}]
  },

  {
    "id": "eom-blood-plague",
    "timelineId": "echoes-of-mortality",
    "timelineName": "Echoes of Mortality",
    "displayName": "Blood Plague",
    "statEffects": [{"statKey": "increased_poison_damage", "value": 30.0, "modifierType": "increased"}]
  },
  {
    "id": "eom-plague-carrier",
    "timelineId": "echoes-of-mortality",
    "timelineName": "Echoes of Mortality",
    "displayName": "Plague Carrier",
    "statEffects": [{"statKey": "poison_duration", "value": 50.0, "modifierType": "increased"}]
  },
  {
    "id": "eom-deaths-mark",
    "timelineId": "echoes-of-mortality",
    "timelineName": "Echoes of Mortality",
    "displayName": "Death's Mark",
    "statEffects": [{"statKey": "necrotic_resistance", "value": 18.0, "modifierType": "flat"}]
  },
  {
    "id": "eom-wretched-soul",
    "timelineId": "echoes-of-mortality",
    "timelineName": "Echoes of Mortality",
    "displayName": "Wretched Soul",
    "statEffects": [{"statKey": "increased_minion_damage", "value": 30.0, "modifierType": "increased"}]
  },

  {
    "id": "foto-outcasts-rage",
    "timelineId": "fall-of-the-outcasts",
    "timelineName": "Fall of the Outcasts",
    "displayName": "Outcasts' Rage",
    "statEffects": [{"statKey": "increased_physical_damage", "value": 30.0, "modifierType": "increased"}]
  },
  {
    "id": "foto-ironclad-defense",
    "timelineId": "fall-of-the-outcasts",
    "timelineName": "Fall of the Outcasts",
    "displayName": "Ironclad Defense",
    "statEffects": [{"statKey": "armor", "value": 150.0, "modifierType": "flat"}]
  },
  {
    "id": "foto-warriors-blood",
    "timelineId": "fall-of-the-outcasts",
    "timelineName": "Fall of the Outcasts",
    "displayName": "Warrior's Blood",
    "statEffects": [{"statKey": "max_hp", "value": 100.0, "modifierType": "flat"}]
  },
  {
    "id": "foto-hardened",
    "timelineId": "fall-of-the-outcasts",
    "timelineName": "Fall of the Outcasts",
    "displayName": "Hardened",
    "statEffects": [{"statKey": "endurance_threshold", "value": 5.0, "modifierType": "flat"}]
  },

  {
    "id": "tsl-lances-edge",
    "timelineId": "the-stolen-lance",
    "timelineName": "The Stolen Lance",
    "displayName": "The Lance's Edge",
    "statEffects": [{"statKey": "critical_strike_chance", "value": 6.0, "modifierType": "increased"}]
  },
  {
    "id": "tsl-piercing-strikes",
    "timelineId": "the-stolen-lance",
    "timelineName": "The Stolen Lance",
    "displayName": "Piercing Strikes",
    "statEffects": [{"statKey": "critical_strike_multiplier", "value": 40.0, "modifierType": "increased"}]
  },
  {
    "id": "tsl-swift-as-the-lance",
    "timelineId": "the-stolen-lance",
    "timelineName": "The Stolen Lance",
    "displayName": "Swift as the Lance",
    "statEffects": [{"statKey": "attack_speed", "value": 10.0, "modifierType": "increased"}]
  },
  {
    "id": "tsl-lance-bearers-mark",
    "timelineId": "the-stolen-lance",
    "timelineName": "The Stolen Lance",
    "displayName": "Lance Bearer's Mark",
    "statEffects": [{"statKey": "physical_penetration", "value": 10.0, "modifierType": "flat"}]
  },

  {
    "id": "as-potent-poison",
    "timelineId": "apothecary-sanctum",
    "timelineName": "Apothecary's Sanctum",
    "displayName": "Potent Poison",
    "statEffects": [{"statKey": "increased_poison_damage", "value": 35.0, "modifierType": "increased"}]
  },
  {
    "id": "as-wide-spread",
    "timelineId": "apothecary-sanctum",
    "timelineName": "Apothecary's Sanctum",
    "displayName": "Wide Spread",
    "statEffects": [{"statKey": "area_of_effect", "value": 20.0, "modifierType": "increased"}]
  },
  {
    "id": "as-quick-synthesis",
    "timelineId": "apothecary-sanctum",
    "timelineName": "Apothecary's Sanctum",
    "displayName": "Quick Synthesis",
    "statEffects": [{"statKey": "movement_speed", "value": 12.0, "modifierType": "increased"}]
  },
  {
    "id": "as-toxic-mastery",
    "timelineId": "apothecary-sanctum",
    "timelineName": "Apothecary's Sanctum",
    "displayName": "Toxic Mastery",
    "statEffects": [{"statKey": "max_poison_stacks", "value": 2.0, "modifierType": "flat"}]
  },

  {
    "id": "ts-epoch-of-fire",
    "timelineId": "temporal-sanctum",
    "timelineName": "Temporal Sanctum",
    "displayName": "Epoch of Fire",
    "statEffects": [{"statKey": "increased_fire_damage", "value": 40.0, "modifierType": "increased"}]
  },
  {
    "id": "ts-epoch-of-winter",
    "timelineId": "temporal-sanctum",
    "timelineName": "Temporal Sanctum",
    "displayName": "Epoch of Winter",
    "statEffects": [{"statKey": "increased_cold_damage", "value": 40.0, "modifierType": "increased"}]
  },
  {
    "id": "ts-epoch-of-lightning",
    "timelineId": "temporal-sanctum",
    "timelineName": "Temporal Sanctum",
    "displayName": "Epoch of Lightning",
    "statEffects": [{"statKey": "increased_lightning_damage", "value": 40.0, "modifierType": "increased"}]
  },
  {
    "id": "ts-epoch-of-void",
    "timelineId": "temporal-sanctum",
    "timelineName": "Temporal Sanctum",
    "displayName": "Epoch of Void",
    "statEffects": [{"statKey": "increased_void_damage", "value": 40.0, "modifierType": "increased"}]
  }
]
```

#### `lebo/src-tauri/resources/context-data/conditions.json`

Universal and build-specific conditions. The `filter` field drives build-specific visibility in Story 3.4.

```json
[
  {
    "id": "enemy_type",
    "displayLabel": "Enemy Type",
    "category": "universal",
    "type": "select",
    "options": [
      {"value": "standard_mob", "label": "Standard Mob"},
      {"value": "rare", "label": "Rare Enemy"},
      {"value": "unique_boss", "label": "Unique Boss"},
      {"value": "pinnacle_boss", "label": "Pinnacle Boss"}
    ],
    "defaultValue": "standard_mob"
  },
  {
    "id": "enemy_fire_resistance",
    "displayLabel": "Enemy Fire Resistance (%)",
    "category": "universal",
    "type": "range",
    "min": -100,
    "max": 100,
    "step": 5,
    "defaultValue": 0
  },
  {
    "id": "enemy_cold_resistance",
    "displayLabel": "Enemy Cold Resistance (%)",
    "category": "universal",
    "type": "range",
    "min": -100,
    "max": 100,
    "step": 5,
    "defaultValue": 0
  },
  {
    "id": "enemy_lightning_resistance",
    "displayLabel": "Enemy Lightning Resistance (%)",
    "category": "universal",
    "type": "range",
    "min": -100,
    "max": 100,
    "step": 5,
    "defaultValue": 0
  },
  {
    "id": "enemy_void_resistance",
    "displayLabel": "Enemy Void Resistance (%)",
    "category": "universal",
    "type": "range",
    "min": -100,
    "max": 100,
    "step": 5,
    "defaultValue": 0
  },
  {
    "id": "enemy_poison_resistance",
    "displayLabel": "Enemy Poison Resistance (%)",
    "category": "universal",
    "type": "range",
    "min": -100,
    "max": 100,
    "step": 5,
    "defaultValue": 0
  },
  {
    "id": "enemy_physical_resistance",
    "displayLabel": "Enemy Physical Resistance (%)",
    "category": "universal",
    "type": "range",
    "min": -100,
    "max": 100,
    "step": 5,
    "defaultValue": 0
  },
  {
    "id": "frenzy_charges",
    "displayLabel": "Frenzy Charges",
    "category": "universal",
    "type": "range",
    "min": 0,
    "max": 4,
    "step": 1,
    "defaultValue": 0
  },
  {
    "id": "power_charges",
    "displayLabel": "Power Charges",
    "category": "universal",
    "type": "range",
    "min": 0,
    "max": 3,
    "step": 1,
    "defaultValue": 0
  },
  {
    "id": "endurance_charges",
    "displayLabel": "Endurance Charges",
    "category": "universal",
    "type": "range",
    "min": 0,
    "max": 3,
    "step": 1,
    "defaultValue": 0
  },
  {
    "id": "sigil_of_hope_active",
    "displayLabel": "Sigil of Hope active",
    "category": "build-specific",
    "type": "toggle",
    "defaultValue": false,
    "filter": {"classId": "sentinel", "skillTag": "sigil_of_hope"}
  },
  {
    "id": "enemy_hexed",
    "displayLabel": "Is enemy Hexed?",
    "category": "build-specific",
    "type": "toggle",
    "defaultValue": false,
    "filter": {"skillTag": "hex"}
  }
]
```

---

### Task 2 — Exact Rust `GameDataManifest` Extension

In `lebo/src-tauri/src/models/game_data.rs`, add two fields to `GameDataManifest`:

```rust
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameDataManifest {
    pub schema_version: u32,
    pub game_version: String,
    pub data_version: String,
    pub generated_at: String,
    pub classes: Vec<String>,
    #[serde(default)]
    pub item_data_version: Option<String>,
    #[serde(default)]
    pub icon_cache_version: Option<String>,
    #[serde(default)]
    pub icon_source: Option<String>,
    #[serde(default)]
    pub idol_data_version: Option<String>,      // ← add this
    #[serde(default)]
    pub blessings_data_version: Option<String>, // ← add this
}
```

`#[serde(default)]` is required — existing remote manifests without these fields must deserialize without error.

In `lebo/src-tauri/src/commands/game_data_commands.rs`, in `download_game_data_update`, add two lines alongside the existing carry-forward block:

```rust
// Current code (lines ~76-79):
if let Ok(local) = game_data_service::load_manifest(&data_dir) {
    merged.icon_source = local.icon_source;
    merged.icon_cache_version = local.icon_cache_version;
    merged.item_data_version = local.item_data_version;
    // ← Add these two:
    merged.idol_data_version = local.idol_data_version;
    merged.blessings_data_version = local.blessings_data_version;
}
```

In `lebo/src-tauri/resources/game-data/manifest.json`, add the two version fields (only change these two fields):

```json
{
  "schemaVersion": 2,
  "gameVersion": "Season 4 (Shattered Omens)",
  "dataVersion": "s4.1",
  "generatedAt": "2026-03-26T00:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"],
  "itemDataVersion": "s4.1",
  "iconCacheVersion": "1.0.0",
  "iconSource": "placeholder",
  "idolDataVersion": "s4.1",
  "blessingsDataVersion": "s4.1"
}
```

---

### Task 3 — `models/context_data.rs` (Exact Rust Struct Definitions)

Create `lebo/src-tauri/src/models/context_data.rs`:

```rust
use serde::{Deserialize, Serialize};

// --- idol-data.json models ---

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolGrid {
    pub rows: u32,
    pub cols: u32,
    pub blocked_cells: Vec<(u32, u32)>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolAffixTier {
    pub tier: u32,
    pub min_value: f64,
    pub max_value: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolAffix {
    pub id: String,
    pub display_name: String,
    #[serde(rename = "type")]
    pub affix_type: String,
    pub tiers: Vec<IdolAffixTier>,
    pub stat_key: String,
    pub modifier_type: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolType {
    pub id: String,
    pub display_name: String,
    pub rows: u32,
    pub cols: u32,
    pub requires_both: bool,
    pub prefix_pool: Vec<IdolAffix>,
    pub suffix_pool: Vec<IdolAffix>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolData {
    pub version: String,
    pub default_grid: IdolGrid,
    pub altar_variants: Vec<serde_json::Value>,
    pub idol_types: Vec<IdolType>,
}

// --- blessings.json models ---

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatEffect {
    pub stat_key: String,
    pub value: f64,
    pub modifier_type: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BlessingEntry {
    pub id: String,
    pub timeline_id: String,
    pub timeline_name: String,
    pub display_name: String,
    pub stat_effects: Vec<StatEffect>,
}

pub type BlessingsDatabase = Vec<BlessingEntry>;

// --- conditions.json models ---

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConditionOption {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConditionFilter {
    #[serde(default)]
    pub class_id: Option<String>,
    #[serde(default)]
    pub skill_tag: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConditionEntry {
    pub id: String,
    pub display_label: String,
    pub category: String,
    #[serde(rename = "type")]
    pub condition_type: String,
    #[serde(default)]
    pub options: Vec<ConditionOption>,
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    #[serde(default)]
    pub step: Option<f64>,
    #[serde(default)]
    pub default_value: serde_json::Value,
    #[serde(default)]
    pub filter: Option<ConditionFilter>,
}

pub type ConditionsDatabase = Vec<ConditionEntry>;
```

**Key serde notes:**
- `Vec<(u32, u32)>` deserializes from JSON `[[0,0],[0,4],...]` — tuples serialize as arrays in serde_json
- `altar_variants: Vec<serde_json::Value>` accepts the empty `[]` and future altar data without schema coupling
- `default_value: serde_json::Value` handles `false` (bool), `0` (number), and `"standard_mob"` (string) generically
- All optional fields have `#[serde(default)]`

Add to `lebo/src-tauri/src/models/mod.rs`:
```rust
pub mod context_data;
```

---

### Task 4 — `services/context_data_service.rs` (Exact Implementation)

Create `lebo/src-tauri/src/services/context_data_service.rs`:

```rust
use std::path::{Path, PathBuf};
use tauri::Manager;
use crate::models::context_data::{BlessingsDatabase, ConditionsDatabase, IdolData};

pub fn ensure_context_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("CONTEXT_DATA_ERROR: app_data_dir: {}", e))?;
    let data_dir = base.join("lebo").join("context-data");
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: create context-data dir: {}", e))?;
    Ok(data_dir)
}

pub fn copy_bundled_context_resources(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = ensure_context_data_dir(app_handle)?;
    let files = ["idol-data.json", "blessings.json", "conditions.json"];
    if files.iter().all(|f| data_dir.join(f).exists()) {
        return Ok(data_dir);
    }
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("CONTEXT_DATA_ERROR: resource_dir: {}", e))?;
    let src = resource_dir.join("resources").join("context-data");
    for filename in &files {
        let src_path = src.join(filename);
        let dst_path = data_dir.join(filename);
        std::fs::copy(&src_path, &dst_path)
            .map_err(|e| format!("CONTEXT_DATA_ERROR: copy {}: {}", filename, e))?;
    }
    Ok(data_dir)
}

pub fn load_idol_data_from_dir(data_dir: &Path) -> Result<IdolData, String> {
    let raw = std::fs::read_to_string(data_dir.join("idol-data.json"))
        .map_err(|e| format!("CONTEXT_DATA_ERROR: read idol-data.json: {}", e))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: parse idol-data.json: {}", e))
}

pub fn load_blessings_from_dir(data_dir: &Path) -> Result<BlessingsDatabase, String> {
    let raw = std::fs::read_to_string(data_dir.join("blessings.json"))
        .map_err(|e| format!("CONTEXT_DATA_ERROR: read blessings.json: {}", e))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: parse blessings.json: {}", e))
}

pub fn load_conditions_from_dir(data_dir: &Path) -> Result<ConditionsDatabase, String> {
    let raw = std::fs::read_to_string(data_dir.join("conditions.json"))
        .map_err(|e| format!("CONTEXT_DATA_ERROR: read conditions.json: {}", e))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: parse conditions.json: {}", e))
}
```

Add to `lebo/src-tauri/src/services/mod.rs`:
```rust
pub mod context_data_service;
```

---

### Task 5 — `commands/context_data_commands.rs` (Exact Command Definitions)

Create `lebo/src-tauri/src/commands/context_data_commands.rs`:

```rust
use crate::models::context_data::{BlessingsDatabase, ConditionsDatabase, IdolData};
use crate::models::game_data::DataVersionCheckResult;
use crate::services::context_data_service;
use crate::services::game_data_service::{self, REMOTE_DATA_BASE_URL};

#[tauri::command]
pub async fn load_idol_data(app_handle: tauri::AppHandle) -> Result<IdolData, String> {
    let data_dir = context_data_service::copy_bundled_context_resources(&app_handle)?;
    context_data_service::load_idol_data_from_dir(&data_dir)
}

#[tauri::command]
pub async fn load_blessings_data(app_handle: tauri::AppHandle) -> Result<BlessingsDatabase, String> {
    let data_dir = context_data_service::copy_bundled_context_resources(&app_handle)?;
    context_data_service::load_blessings_from_dir(&data_dir)
}

#[tauri::command]
pub async fn load_conditions_data(app_handle: tauri::AppHandle) -> Result<ConditionsDatabase, String> {
    let data_dir = context_data_service::copy_bundled_context_resources(&app_handle)?;
    context_data_service::load_conditions_from_dir(&data_dir)
}

#[tauri::command]
pub async fn check_idol_data_freshness(
    app_handle: tauri::AppHandle,
) -> Result<DataVersionCheckResult, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let local = game_data_service::load_manifest(&data_dir)?;
    let remote = game_data_service::fetch_remote_manifest(REMOTE_DATA_BASE_URL).await?;

    let local_version = local.idol_data_version.unwrap_or_default();
    let remote_version = remote.idol_data_version.unwrap_or_default();

    // Treat as not stale when remote has no idolDataVersion (graceful degradation)
    let is_stale = !local_version.is_empty() && !remote_version.is_empty() && local_version != remote_version;
    let versions_behind = if is_stale { 1 } else { 0 };

    Ok(DataVersionCheckResult {
        is_stale,
        local_version,
        remote_version,
        versions_behind,
    })
}

#[tauri::command]
pub async fn check_blessings_data_freshness(
    app_handle: tauri::AppHandle,
) -> Result<DataVersionCheckResult, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let local = game_data_service::load_manifest(&data_dir)?;
    let remote = game_data_service::fetch_remote_manifest(REMOTE_DATA_BASE_URL).await?;

    let local_version = local.blessings_data_version.unwrap_or_default();
    let remote_version = remote.blessings_data_version.unwrap_or_default();

    let is_stale = !local_version.is_empty() && !remote_version.is_empty() && local_version != remote_version;
    let versions_behind = if is_stale { 1 } else { 0 };

    Ok(DataVersionCheckResult {
        is_stale,
        local_version,
        remote_version,
        versions_behind,
    })
}
```

Add to `lebo/src-tauri/src/commands/mod.rs`:
```rust
pub mod context_data_commands;
```

---

### Task 6 — `lib.rs` Updates (Exact)

Add to the imports at the top of `lebo/src-tauri/src/lib.rs`:

```rust
use commands::context_data_commands::{
    load_idol_data, load_blessings_data, load_conditions_data,
    check_idol_data_freshness, check_blessings_data_freshness,
};
```

Add to `invoke_handler!` macro (alongside `load_item_database` etc.):

```rust
load_idol_data,
load_blessings_data,
load_conditions_data,
check_idol_data_freshness,
check_blessings_data_freshness,
```

---

### Task 7 — `tauri.conf.json` Resources Update (Exact)

In `lebo/src-tauri/tauri.conf.json`, replace the existing `bundle.resources` array with:

```json
"resources": [
  "resources/game-data/manifest.json",
  "resources/game-data/classes/sentinel.json",
  "resources/game-data/classes/mage.json",
  "resources/game-data/classes/primalist.json",
  "resources/game-data/classes/acolyte.json",
  "resources/game-data/classes/rogue.json",
  "resources/icons/skill-icon-map.json",
  "resources/icons/skills/**/*",
  "resources/items/base-items.json",
  "resources/items/uniques.json",
  "resources/items/affixes.json",
  "resources/items/set-items.json",
  "resources/context-data/idol-data.json",
  "resources/context-data/blessings.json",
  "resources/context-data/conditions.json"
]
```

Note: `resources/items/set-items.json` was added in story 1.3 but was missing from this array — fix it now.

---

### Task 8 — TypeScript Types `shared/types/contextDatabase.ts` (Exact)

Create `lebo/src/shared/types/contextDatabase.ts`:

```typescript
export interface IdolGrid {
  rows: number
  cols: number
  blockedCells: [number, number][]
}

export interface IdolAffixTier {
  tier: number
  minValue: number
  maxValue: number
}

export interface IdolAffix {
  id: string
  displayName: string
  type: 'prefix' | 'suffix'
  tiers: IdolAffixTier[]
  statKey: string
  modifierType: 'increased' | 'more' | 'flat'
}

export interface IdolType {
  id: string
  displayName: string
  rows: number
  cols: number
  requiresBoth: boolean
  prefixPool: IdolAffix[]
  suffixPool: IdolAffix[]
}

export interface IdolData {
  version: string
  defaultGrid: IdolGrid
  altarVariants: unknown[]
  idolTypes: IdolType[]
}

export interface StatEffect {
  statKey: string
  value: number
  modifierType: 'increased' | 'more' | 'flat'
}

export interface BlessingEntry {
  id: string
  timelineId: string
  timelineName: string
  displayName: string
  statEffects: StatEffect[]
}

export type BlessingsDatabase = BlessingEntry[]

export interface ConditionOption {
  value: string
  label: string
}

export interface ConditionFilter {
  classId?: string
  skillTag?: string
}

export interface ConditionEntry {
  id: string
  displayLabel: string
  category: 'universal' | 'build-specific'
  type: 'select' | 'range' | 'toggle'
  options?: ConditionOption[]
  min?: number
  max?: number
  step?: number
  defaultValue: boolean | number | string
  filter?: ConditionFilter
}

export type ConditionsDatabase = ConditionEntry[]
```

**Rules enforced:**
- Named exports only — no default exports
- No barrel `index.ts` file — import directly from `contextDatabase.ts`
- TypeScript strict mode: `defaultValue: boolean | number | string` avoids `any`
- `altarVariants: unknown[]` uses `unknown` instead of `any` (strict-safe)

---

### Task 9 — `features/context-database/contextDatabaseLoader.ts` (Exact)

Create `lebo/src/features/context-database/contextDatabaseLoader.ts`:

```typescript
import { invokeCommand } from '../../shared/utils/invokeCommand'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import type { BlessingsDatabase, ConditionsDatabase, IdolData } from '../../shared/types/contextDatabase'
import type { DataVersionCheckResult } from '../../shared/types/gameData'

export async function loadIdolData(): Promise<void> {
  try {
    const data = await invokeCommand<IdolData>('load_idol_data')
    useGameDataStore.getState().setIdolData(data)
  } catch (err) {
    useGameDataStore.getState().setIdolData(null)
    throw err
  }
}

export async function loadBlessingsData(): Promise<void> {
  try {
    const data = await invokeCommand<BlessingsDatabase>('load_blessings_data')
    useGameDataStore.getState().setBlessingsDatabase(data)
  } catch (err) {
    useGameDataStore.getState().setBlessingsDatabase(null)
    throw err
  }
}

export async function loadConditionsData(): Promise<void> {
  try {
    const data = await invokeCommand<ConditionsDatabase>('load_conditions_data')
    useGameDataStore.getState().setConditionsDatabase(data)
  } catch (err) {
    useGameDataStore.getState().setConditionsDatabase(null)
    throw err
  }
}

export async function checkIdolDataFreshness(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_idol_data_freshness')
  useGameDataStore.getState().setIsIdolDataStale(result.isStale)
}

export async function checkBlessingsDataFreshness(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_blessings_data_freshness')
  useGameDataStore.getState().setIsBlessingsDataStale(result.isStale)
}
```

---

### Task 10 — `gameDataStore.ts` Extension (Exact)

In `lebo/src/shared/stores/gameDataStore.ts`, extend the interface and implementation. Add these imports at the top:

```typescript
import type { IdolData, BlessingsDatabase, ConditionsDatabase } from '../types/contextDatabase'
```

Add to the `GameDataStore` interface (alongside the existing item database fields):

```typescript
  idolData: IdolData | null
  setIdolData: (data: IdolData | null) => void
  isIdolDataStale: boolean
  idolDataStaleAcknowledged: boolean
  setIsIdolDataStale: (stale: boolean) => void
  acknowledgeIdolDataStaleness: () => void

  blessingsDatabase: BlessingsDatabase | null
  setBlessingsDatabase: (db: BlessingsDatabase | null) => void
  isBlessingsDataStale: boolean
  blessingsDataStaleAcknowledged: boolean
  setIsBlessingsDataStale: (stale: boolean) => void
  acknowledgeBlessingsDataStaleness: () => void

  conditionsDatabase: ConditionsDatabase | null
  setConditionsDatabase: (db: ConditionsDatabase | null) => void
```

Add to the `create<GameDataStore>()(...)` implementation object (alongside existing `itemDatabase: null` etc.):

```typescript
  idolData: null,
  setIdolData: (data) => set({ idolData: data }),
  isIdolDataStale: false,
  idolDataStaleAcknowledged: false,
  setIsIdolDataStale: (stale) => set({ isIdolDataStale: stale }),
  acknowledgeIdolDataStaleness: () => set({ idolDataStaleAcknowledged: true }),

  blessingsDatabase: null,
  setBlessingsDatabase: (db) => set({ blessingsDatabase: db }),
  isBlessingsDataStale: false,
  blessingsDataStaleAcknowledged: false,
  setIsBlessingsDataStale: (stale) => set({ isBlessingsDataStale: stale }),
  acknowledgeBlessingsDataStaleness: () => set({ blessingsDataStaleAcknowledged: true }),

  conditionsDatabase: null,
  setConditionsDatabase: (db) => set({ conditionsDatabase: db }),
```

---

### Task 11 — `App.tsx` Startup Wiring (Exact Changes)

Add imports at the top of `lebo/src/App.tsx` alongside `loadItemDatabase`:

```typescript
import { loadIdolData, loadBlessingsData, loadConditionsData } from './features/context-database/contextDatabaseLoader'
```

In the startup `useEffect`, add three calls alongside `loadItemDatabase()`:

```typescript
useEffect(() => {
  initGameData().catch(console.error)
  loadBuildsOnStartup().catch(console.error)
  initializeIconPipeline().catch(console.error)
  loadItemDatabase().catch(console.error)
  loadIdolData().catch(console.error)        // ← add
  loadBlessingsData().catch(console.error)   // ← add
  loadConditionsData().catch(console.error)  // ← add
  // ... rest unchanged
}, [])
```

**Do NOT** call `checkIdolDataFreshness()` or `checkBlessingsDataFreshness()` here. Staleness checks are network operations that should be triggered from the StatusBar staleness-check flow, not from startup. Story 3.3's StatusBar updates will wire the staleness checks. For now, the flags initialize to `false` and remain there.

---

### What This Story Does NOT Do

- ❌ Do NOT create `update_idol_data` or `update_blessings_data` commands — future story
- ❌ Do NOT wire staleness checks to the StatusBar — that is part of Epic 3 (Stories 3.1–3.4)
- ❌ Do NOT add `CONTEXT_DATA_ERROR` to the TypeScript `ErrorType` enum — that is Story 2.1
- ❌ Do NOT add idol/blessings/conditions to `BuildState` — that is Epic 3 (Story 3.1+)
- ❌ Do NOT create UI components for idols, blessings, or conditions — Epic 3
- ❌ Do NOT use raw `invoke()` anywhere — always `invokeCommand<T>()`
- ❌ Do NOT create barrel `index.ts` files
- ❌ Do NOT create a new Zustand store — all new state goes into `gameDataStore`
- ❌ Do NOT modify `AffixEntry` in `build.ts` — that is a build-state type
- ❌ Do NOT modify any Phase 1 files (outside `lebo/` directory)

### Known Pre-existing Test Failures

8 test failures remain from stories 1.1/1.2: `SkillTreeCanvas`, `ProviderSelector`, `Settings`, and `TreeControls` — all pre-existing Phase 2 failures. `pnpm vitest` will show them; do not attempt to fix them.

### Project Structure Notes

**New files:**
- `lebo/src-tauri/resources/context-data/idol-data.json` (new file)
- `lebo/src-tauri/resources/context-data/blessings.json` (new file)
- `lebo/src-tauri/resources/context-data/conditions.json` (new file)
- `lebo/src-tauri/src/models/context_data.rs` (new file)
- `lebo/src-tauri/src/services/context_data_service.rs` (new file)
- `lebo/src-tauri/src/commands/context_data_commands.rs` (new file)
- `lebo/src/shared/types/contextDatabase.ts` (new file)
- `lebo/src/features/context-database/contextDatabaseLoader.ts` (new file)

**Modified files:**
- `lebo/src-tauri/resources/game-data/manifest.json` (add 2 version fields)
- `lebo/src-tauri/src/models/game_data.rs` (add 2 fields to `GameDataManifest`)
- `lebo/src-tauri/src/models/mod.rs` (add `pub mod context_data`)
- `lebo/src-tauri/src/services/mod.rs` (add `pub mod context_data_service`)
- `lebo/src-tauri/src/commands/mod.rs` (add `pub mod context_data_commands`)
- `lebo/src-tauri/src/commands/game_data_commands.rs` (preserve 2 new manifest fields in update)
- `lebo/src-tauri/src/lib.rs` (import + register 5 new commands)
- `lebo/src-tauri/tauri.conf.json` (add 4 resources: 3 context-data + 1 set-items fix)
- `lebo/src/shared/stores/gameDataStore.ts` (add 3 data fields + 4 staleness flags + setters)
- `lebo/src/App.tsx` (import + call 3 new loaders)

### References

- [Source: epics.md § Story 1.4 — New Game Database Files & Staleness Integration]
- [Source: epics.md § Epic 1 — Season 4 Data Foundation, FR-G4, FR-G5]
- [Source: architecture.md § Data Gate — Three new game databases]
- [Source: project-context.md § Language-Specific Rules — no barrel files, strict mode]
- [Source: project-context.md § Framework-Specific Rules — IPC, 4-store rule]
- [Source: project-context.md § Item database staleness pattern]
- [Source: story 1.3 Dev Notes — item_data_service.rs pattern]
- [Source: lebo/src-tauri/src/services/item_data_service.rs — copy/load pattern to replicate]
- [Source: lebo/src-tauri/src/commands/item_commands.rs — command pattern to replicate]
- [Source: lebo/src/features/item-database/itemDatabaseLoader.ts — TypeScript loader pattern]
- [Source: lebo/src/shared/stores/gameDataStore.ts — staleness flag pattern to replicate]
- [Source: lebo/src/App.tsx — startup loading pattern]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation matched specs exactly. Rust compiled cleanly in first pass; TypeScript compiled with zero errors.

### Completion Notes List

- Created 3 JSON resource files in `resources/context-data/`: idol-data.json (4 idol types with affix pools), blessings.json (48 entries across 12 timelines), conditions.json (10 universal + 2 build-specific)
- Extended `GameDataManifest` with `idol_data_version` and `blessings_data_version` optional fields; both preserved through `download_game_data_update` merge
- New Rust module tree: `models/context_data.rs`, `services/context_data_service.rs`, `commands/context_data_commands.rs` — 5 Tauri commands registered in `lib.rs`
- New TypeScript: `shared/types/contextDatabase.ts` (named exports only, no barrel), `features/context-database/contextDatabaseLoader.ts` (5 async functions)
- `gameDataStore` extended with idolData, blessingsDatabase, conditionsDatabase fields plus isIdolDataStale/isBlessingsDataStale staleness flags mirroring the itemDatabase pattern
- `App.tsx` fires `loadIdolData()`, `loadBlessingsData()`, `loadConditionsData()` fire-and-forget on startup
- Fixed pre-existing gap: `resources/items/set-items.json` added to tauri.conf.json bundle resources
- `pnpm build` — 0 TypeScript errors; `cargo build` — 0 Rust errors; `pnpm vitest` — 8 pre-existing failures only (ProviderSelector ×5, Settings ×1, SkillTreeCanvas ×1, TreeControls ×1), no regressions

### File List

**New files:**
- `lebo/src-tauri/resources/context-data/idol-data.json`
- `lebo/src-tauri/resources/context-data/blessings.json`
- `lebo/src-tauri/resources/context-data/conditions.json`
- `lebo/src-tauri/src/models/context_data.rs`
- `lebo/src-tauri/src/services/context_data_service.rs`
- `lebo/src-tauri/src/commands/context_data_commands.rs`
- `lebo/src/shared/types/contextDatabase.ts`
- `lebo/src/features/context-database/contextDatabaseLoader.ts`

**Modified files:**
- `lebo/src-tauri/resources/game-data/manifest.json`
- `lebo/src-tauri/src/models/game_data.rs`
- `lebo/src-tauri/src/models/mod.rs`
- `lebo/src-tauri/src/services/mod.rs`
- `lebo/src-tauri/src/commands/mod.rs`
- `lebo/src-tauri/src/commands/game_data_commands.rs`
- `lebo/src-tauri/src/lib.rs`
- `lebo/src-tauri/tauri.conf.json`
- `lebo/src/shared/stores/gameDataStore.ts`
- `lebo/src/App.tsx`

### Review Findings

#### Decision-Needed

- [ ] [Review][Decision] **conditionsDatabase has no staleness tracking** — `idolData` and `blessingsDatabase` each have a 4-field staleness cluster (`isXStale`, `xStaleAcknowledged`, `setIsXStale`, `acknowledgeXStaleness`). `conditionsDatabase` has none, and `GameDataManifest` has no `conditions_data_version` field. Is this intentional (conditions data is static and doesn't need versioning) or an oversight? Options: A) intentional — dismiss; B) add flags preemptively now; C) defer to Epic 3.

- [ ] [Review][Decision] **`sigil_of_hope_active` filter uses `classId: "sentinel"` but spec says "(Paladin)"** — Paladin is a Sentinel *mastery*, not the base class. If Epic 3 filters by mastery ID, the condition will never activate for Paladin builds. If it filters by base class (any Sentinel mastery), the current value is correct. Options: A) intended — all Sentinel masteries can use Sigil of Hope; B) bug — change to mastery-specific filter; C) defer until Epic 3 implements filtering logic. [`lebo/src-tauri/resources/context-data/conditions.json`]

- [ ] [Review][Decision] **`isIdolDataUpdating`/`isBlessingsDataUpdating` flags missing vs. item pattern** — The item data has a 3-field cluster: `isStale`, `staleAcknowledged`, `isUpdating`. The new idol and blessings entries have only 2 fields each. AC#2 says flags must follow the "identical initialization pattern as `isItemDataStale`." No `update_idol_data` or `update_blessings_data` command exists yet (intentionally deferred). Options: A) add updating flags preemptively now; B) defer — add when update commands exist; C) dismiss — "identical pattern" refers to initialization values, not the full field set. [`lebo/src/shared/stores/gameDataStore.ts`]

- [ ] [Review][Decision] **No tests for new store fields or loaders** — `itemDatabaseLoader.test.ts` covers all item loader paths (success, throw, staleness). `gameDataStore.test.ts` covers all store initial state. This diff adds 8 new store fields and 5 new loader functions with zero corresponding test coverage. Options: A) add tests now (following `itemDatabaseLoader.test.ts` and `gameDataStore.test.ts` as pattern); B) defer to a dedicated test-coverage story.

#### Patch

- [ ] [Review][Patch] **Race condition in `copy_bundled_context_resources` on first cold install** — App.tsx fires `loadIdolData`, `loadBlessingsData`, `loadConditionsData` concurrently (no await). Each Tauri command calls `copy_bundled_context_resources`, which checks `files.iter().all(exists)` — all three pass the check simultaneously on a fresh install, then race to `fs::copy` the same destination files. On Windows this yields `ERROR_SHARING_VIOLATION` (OS error 32), causing one or two loaders to fail on first launch. Fix: replace the all-or-nothing guard with per-file existence checks so only missing files are copied, and use `fs::copy` which atomically replaces the destination. [`lebo/src-tauri/src/services/context_data_service.rs:19-35`]

- [ ] [Review][Patch] **Freshness commands propagate `NETWORK_ERROR`/`STORAGE_ERROR` prefixes instead of `CONTEXT_DATA_ERROR`** — `check_idol_data_freshness` and `check_blessings_data_freshness` call `game_data_service::fetch_remote_manifest` and `load_manifest`, which return errors prefixed with `NETWORK_ERROR:` and `STORAGE_ERROR:`. The spec constraint requires all errors from context data commands use `CONTEXT_DATA_ERROR:` prefix. Fix: add `.map_err(|e| format!("CONTEXT_DATA_ERROR: {}", e))` wrapping both inner service calls in each freshness command. [`lebo/src-tauri/src/commands/context_data_commands.rs:28-44, 47-64`]

- [ ] [Review][Patch] **`options?: ConditionOption[]` in TypeScript misleads consumers** — The Rust model uses `#[serde(default)]` on `Vec<ConditionOption>`, which always serializes as `[]` (empty array) when the JSON field is absent — never as missing/undefined. The TypeScript type `options?: ConditionOption[]` implies `undefined` is possible, but over IPC consumers always receive `[]`. Any guard using `if (!condition.options)` will fail. Fix: change to `options: ConditionOption[]` (non-optional, always an array). [`lebo/src/shared/types/contextDatabase.ts:70`]

- [ ] [Review][Patch] **`display_label` non-optional in Rust without `#[serde(default)]`** — `pub display_label: String` in `ConditionEntry` has no `#[serde(default)]`. If any future `conditions.json` entry omits `displayLabel`, serde will return a deserialization error at runtime. All current entries are correct, but the model is unnecessarily fragile. Fix: add `#[serde(default)]` (gives empty string on missing field, making the model forward-compatible). [`lebo/src-tauri/src/models/context_data.rs:98`]

#### Defer

- [x] [Review][Defer] **Double remote manifest fetch when both freshness checks are called together** [`context_data_commands.rs`] — deferred, pre-existing. `check_idol_data_freshness` and `check_blessings_data_freshness` each independently call `fetch_remote_manifest`, resulting in two network requests to the same URL. Not wired up yet; fix by sharing a single fetch when both are called in Epic 3.

- [x] [Review][Defer] **`acknowledgeIdolDataStaleness` doesn't reset `idolDataStaleAcknowledged` when stale is re-set** [`gameDataStore.ts`] — deferred, pre-existing. `setIsIdolDataStale(true)` after acknowledgment leaves `idolDataStaleAcknowledged: true`, hiding the re-appeared indicator. Same flaw exists for blessings. Pre-existing pattern from item data; fix when staleness UI is implemented.

- [x] [Review][Defer] **Freshness loader functions have no error state on failure** [`contextDatabaseLoader.ts:34-42`] — deferred, pre-existing. `checkIdolDataFreshness`/`checkBlessingsDataFreshness` propagate errors without setting any store state. Consistent with `checkItemDataFreshness` pattern; add `.catch()` callsite guards when wired up in Epic 3.

- [x] [Review][Defer] **Triple redundant `copy_bundled_context_resources` calls on every startup (beyond first)** [`context_data_service.rs`] — deferred, pre-existing. After first install, all three loaders fire the existence check separately (9 filesystem stat calls). Correct but wasteful; consistent with item data service pattern.

- [x] [Review][Defer] **`versions_behind` hard-coded to 0 or 1, not a real version distance** [`context_data_commands.rs:37,57`] — deferred, pre-existing. Consistent with `item_data_service` convention; revisit if multi-version upgrade paths are ever needed.

- [x] [Review][Defer] **TypeScript narrow union types (`'prefix' | 'suffix'`, `'increased' | 'more' | 'flat'`, etc.) not validated in Rust** [`context_data.rs`, `contextDatabase.ts`] — deferred, pre-existing. Project-wide pattern; Rust accepts any `String`, TypeScript narrows post-IPC. Low risk since data is controlled. No change warranted.

## Change Log

- 2026-05-21: Story 1.4 created — new game database files and staleness integration
- 2026-05-21: Story 1.4 implemented — all 12 tasks complete, zero build errors, no new test regressions
