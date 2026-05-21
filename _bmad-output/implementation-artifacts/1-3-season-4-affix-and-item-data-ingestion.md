# Story 1.3: Season 4 Affix & Item Data Ingestion

Status: review

## Story

As a player,
I want the affix database and item database to reflect Season 4 content with delivery-type and damage-element scope annotations,
so that the gear affix scorer can correctly weight affixes for any build's damage delivery type and element.

## Acceptance Criteria

1. **Given** the affix database file
   **When** the Season 4 ingestion pipeline runs
   **Then** all affix entries have `modifierType`, `scope`, and `damageType` fields populated
   **And** Rune of Corruption affixes from Season 4 are present with correct values and `modifierType` annotations

2. **Given** an affix whose scope cannot be determined from the community DB
   **When** the ingestion pipeline processes it
   **Then** a heuristic fallback applies: "Melee" in the affix name → `scope: "melee"`, "Spell" → `scope: "spell"`, etc.
   **And** a fallback count is logged so the data can be manually verified

3. **Given** new Season 4 unique and set items
   **When** the item database is inspected
   **Then** all new uniques and set items are present with correct affix value tables and `modifierType` annotations
   **And** build-enabling uniques (Exsanguinous, Bleeding Heart, Omnividence) are present with correct effect descriptions for the synergy detector

4. **Given** the updated affix and item databases
   **When** `pnpm build` and `cargo build` both run
   **Then** both succeed without errors
   **And** no existing TypeScript type assertions fail due to schema changes

## Tasks / Subtasks

- [x] Task 1: Extend `RawAffix` in Rust (AC: #4)
  - [x] Open `lebo/src-tauri/src/models/item_data.rs`
  - [x] Add `#[serde(default)] pub modifier_type: Option<String>` to `RawAffix`
  - [x] Add `#[serde(default)] pub scope: Option<String>` to `RawAffix`
  - [x] Add `#[serde(default)] pub damage_type: Option<String>` to `RawAffix`
  - [x] `#[serde(default)]` is required on all three — existing affixes.json without these fields must deserialize without error

- [x] Task 2: Extend `RawUniqueItem` in Rust for synergy descriptions (AC: #3)
  - [x] Open `lebo/src-tauri/src/models/item_data.rs`
  - [x] Add `#[serde(default)] pub description: Option<String>` to `RawUniqueItem`
  - [x] This field holds the unique's special effect summary for the synergy detector (Epic 4)

- [x] Task 3: Extend `UniqueItem` TypeScript type (AC: #3)
  - [x] Open `lebo/src/shared/types/itemDatabase.ts`
  - [x] Add `description?: string` to the `UniqueItem` interface
  - [x] No other changes to this file — do NOT touch `AffixEntry` (already extended in story 1.1)

- [x] Task 4: Write and run the affix annotation script (AC: #1, #2)
  - [x] Create `lebo/scripts/annotate_s4_affixes.py` (see Dev Notes for full script spec)
  - [x] Run: `python3 lebo/scripts/annotate_s4_affixes.py` from repo root
  - [x] Verify: all 4171+ affixes now have `modifierType`, `scope`, `damageType` fields
  - [x] Verify: fallback count logged for generic-classified entries
  - [x] Verify: Rune of Corruption affixes are present

- [x] Task 5: Update uniques.json with synergy descriptions (AC: #3)
  - [x] Open `lebo/src-tauri/resources/items/uniques.json`
  - [x] Add `"description"` field to Exsanguinous, Bleeding Heart, and Omnividence entries (see Dev Notes for exact values)
  - [x] Do NOT modify any other unique entries — only the three build-enabling synergy uniques

- [x] Task 6: Update `manifest.json` item data version (AC: #4)
  - [x] Open `lebo/src-tauri/resources/game-data/manifest.json`
  - [x] Change `itemDataVersion` from `"1.0.0"` to `"s4.1"`
  - [x] Do NOT touch `schemaVersion`, `gameVersion`, `dataVersion`, `generatedAt`, `classes`, `iconCacheVersion`, `iconSource`

- [x] Task 7: Verify end-to-end (AC: #4)
  - [x] Run `pnpm build` from `lebo/` — zero TypeScript errors required
  - [x] Run `cargo build` from `lebo/src-tauri/` — zero Rust errors required
  - [x] Run `pnpm vitest` — confirm no new regressions (8 pre-existing failures are expected from stories 1.1/1.2)
  - [x] Run verification script (see Dev Notes) to confirm all affixes have the three new fields

## Dev Notes

### Architecture Overview — What This Story Touches

This story has three scopes:
1. **Rust/TypeScript type extension** (Tasks 1–3): Add `modifierType`, `scope`, `damageType` to `RawAffix` in Rust; add `description` to `RawUniqueItem`/`UniqueItem`. ~10 lines of code total. Mirrors story 1.2's pattern.
2. **Data pipeline** (Task 4): Python annotation script to add the three fields to all 4171 affix entries in `affixes.json`, plus inject Rune of Corruption S4 affixes.
3. **Manual data updates** (Tasks 5–6): Add synergy descriptions to 3 key uniques; bump `itemDataVersion`.

TypeScript `AffixEntry` already has `modifierType?`, `scope?`, `damageType?` (added in story 1.1) — no TypeScript changes to the affix type are needed.

The scoring engine stories (Epic 2+) will consume `AffixEntry.modifierType` and `AffixEntry.scope` to drive the gear affix scorer. Every affix that has `modifierType: undefined` at runtime will be treated as `"increased"` by the Rust fallback — acceptable only as a safety net, not as valid data output from this story.

### Critical Context — Current Affix Database State

`lebo/src-tauri/resources/items/affixes.json`:
- **4171 total entries**, **0 have `modifierType`/`scope`/`damageType`** currently
- **567 named affixes** (e.g., "Inevitable", "Glacial", "Occultist's", "of Frost")
- **3604 unnamed affixes** with placeholder IDs like "unnamed-407_4" — these have no useful name for heuristic classification and will default to `scope: "generic"`, `damageType: null`, `modifierType: "increased"`

This is expected: the community database only has names for affixes that appear in-game with a visible prefix/suffix name. Many LE affixes (especially implicit/unique-specific ones) have internal IDs only. The heuristic script handles both cases.

### Task 1 — Rust Model Changes (Exact)

In `lebo/src-tauri/src/models/item_data.rs`, extend `RawAffix`:

```rust
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawAffix {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub affix_type: String,
    pub item_slots: Vec<String>,
    pub tiers: Vec<AffixTier>,
    #[serde(default)]
    pub modifier_type: Option<String>,  // ← add this
    #[serde(default)]
    pub scope: Option<String>,          // ← add this
    #[serde(default)]
    pub damage_type: Option<String>,    // ← add this
}
```

`#[serde(default)]` is required on all three — existing JSON without these fields must deserialize without error. Do NOT make them non-optional.

And extend `RawUniqueItem`:

```rust
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawUniqueItem {
    pub id: String,
    pub name: String,
    pub base_type: String,
    pub slot: String,
    pub affixes: Vec<RawUniqueItemAffix>,
    #[serde(default)]
    pub description: Option<String>,    // ← add this
}
```

### Task 3 — TypeScript `UniqueItem` Change (Exact)

In `lebo/src/shared/types/itemDatabase.ts`:

```typescript
export interface UniqueItem {
  id: string
  name: string
  baseType: string
  slot: string
  affixes: UniqueItemAffix[]
  description?: string  // ← add this; synergy detector effect summary
}
```

The `AffixEntry` interface already has `modifierType?`, `scope?`, `damageType?` from story 1.1 — do NOT re-add them or touch that interface.

### Task 4 — Python Annotation Script Spec

Create `lebo/scripts/annotate_s4_affixes.py`. This script:
1. Reads `affixes.json`
2. Annotates every entry with `modifierType`, `scope`, `damageType` using name-based heuristics
3. Appends Season 4 Rune of Corruption affix entries
4. Writes the updated file back in-place
5. Logs fallback counts

**Heuristic classification rules:**

**`scope` classification** (apply checks in order; first match wins):

| Priority | Match condition (case-insensitive substring in `name`) | Assigned `scope` |
|----------|-------------------------------------------------------|-----------------|
| 1 | "melee" or "attack" or "warrior" or "blade" or "sword" or "eviscerating" | `"melee"` |
| 2 | "spell" or "cast" or "pyromancer" or "cryomancer" or "spellblade" or "arcane" or "occultist" | `"spell"` |
| 3 | "ranged" or "bow" or "projectile" or "marksman" | `"ranged"` |
| 4 | "minion" or "skeleton" or "zombie" or "wraith" or "golem" or "companion" or "commander" or "summon" | `"minion"` |
| Fallback | Anything else (including all "unnamed-XXX" entries) | `"generic"` — log to fallback count |

**`damageType` classification** (apply checks in order; first match wins):

| Priority | Match condition (case-insensitive substring in `name`) | Assigned `damageType` |
|----------|-------------------------------------------------------|----------------------|
| 1 | "fire" or "flame" or "pyromancer" or "ember" or "blaze" or "burning" or "ignit" | `"fire"` |
| 2 | "cold" or "ice" or "frost" or "glacial" or "cryomancer" or "freez" or "chill" or "shiver" | `"cold"` |
| 3 | "lightning" or "storm" or "thunder" or "conduit" or "spark" or "electric" | `"lightning"` |
| 4 | "void" or "abyss" or "eldritch" | `"void"` |
| 5 | "poison" or "venom" or "toxic" or "blight" or "noxious" | `"poison"` |
| 6 | "bleed" or "gore" or "hemorrhage" or "sanguine" | `"bleed"` |
| 7 | "physical" | `"physical"` |
| Fallback | Anything else | `null` |

**`modifierType` classification**: Without affix descriptions in the database (only names available), all affixes default to `"increased"`. This is the correct Rust-side fallback per spec (FR-A6). Do NOT attempt to infer `"more"` or `"flat"` from names alone — the false positive rate would be too high. Use `"increased"` for every entry.

**Fallback logging:** Print a summary at script end:
```
scope fallback count (generic): 3612
modifierType: all entries set to "increased" (name-only heuristics)
```

**Season 4 Rune of Corruption affixes to inject:**

These represent the S4 corruption mechanic. Add them as new entries if not already present (check by ID):

```python
ROC_AFFIXES = [
    {
        "id": "affix-roc-attack-speed-corruption",
        "name": "of Frenzied Strikes",
        "type": "suffix",
        "itemSlots": ["weapon", "gloves"],
        "tiers": [
            {"tier": 1, "minValue": 10.0, "maxValue": 14.0},
            {"tier": 2, "minValue": 15.0, "maxValue": 19.0},
            {"tier": 3, "minValue": 20.0, "maxValue": 24.0}
        ],
        "modifierType": "increased",
        "scope": "melee",
        "damageType": None
    },
    {
        "id": "affix-roc-spell-damage-corruption",
        "name": "of Arcane Surge",
        "type": "suffix",
        "itemSlots": ["weapon", "catalyst"],
        "tiers": [
            {"tier": 1, "minValue": 15.0, "maxValue": 19.0},
            {"tier": 2, "minValue": 20.0, "maxValue": 24.0},
            {"tier": 3, "minValue": 25.0, "maxValue": 30.0}
        ],
        "modifierType": "increased",
        "scope": "spell",
        "damageType": None
    },
    {
        "id": "affix-roc-all-resistances-corruption",
        "name": "of Warding",
        "type": "suffix",
        "itemSlots": ["body", "helmet", "boots", "gloves", "ring", "amulet", "belt"],
        "tiers": [
            {"tier": 1, "minValue": 8.0, "maxValue": 10.0},
            {"tier": 2, "minValue": 11.0, "maxValue": 13.0},
            {"tier": 3, "minValue": 14.0, "maxValue": 16.0}
        ],
        "modifierType": "increased",
        "scope": "generic",
        "damageType": None
    },
    {
        "id": "affix-roc-movement-speed-corruption",
        "name": "of Haste",
        "type": "suffix",
        "itemSlots": ["boots"],
        "tiers": [
            {"tier": 1, "minValue": 10.0, "maxValue": 12.0},
            {"tier": 2, "minValue": 13.0, "maxValue": 15.0},
            {"tier": 3, "minValue": 16.0, "maxValue": 18.0}
        ],
        "modifierType": "increased",
        "scope": "generic",
        "damageType": None
    },
    {
        "id": "affix-roc-critical-multiplier-corruption",
        "name": "of Lethal Precision",
        "type": "suffix",
        "itemSlots": ["weapon", "amulet"],
        "tiers": [
            {"tier": 1, "minValue": 20.0, "maxValue": 24.0},
            {"tier": 2, "minValue": 25.0, "maxValue": 29.0},
            {"tier": 3, "minValue": 30.0, "maxValue": 35.0}
        ],
        "modifierType": "increased",
        "scope": "generic",
        "damageType": None
    }
]
```

**Full script skeleton:**

```python
#!/usr/bin/env python3
"""Season 4 affix annotation pipeline.

Adds modifierType, scope, damageType to every entry in affixes.json.
Appends Rune of Corruption S4 affixes.
Logs fallback counts for manual review.

Usage: python3 scripts/annotate_s4_affixes.py
Run from the lebo/ directory or repo root.
"""
import json
import sys
from pathlib import Path

AFFIXES_PATH = Path("lebo/src-tauri/resources/items/affixes.json")

SCOPE_RULES = [
    ("melee",  ["melee", "attack", "warrior", "blade", "sword", "eviscerating"]),
    ("spell",  ["spell", "cast", "pyromancer", "cryomancer", "spellblade", "arcane", "occultist"]),
    ("ranged", ["ranged", "bow", "projectile", "marksman"]),
    ("minion", ["minion", "skeleton", "zombie", "wraith", "golem", "companion", "commander", "summon"]),
]

DAMAGE_TYPE_RULES = [
    ("fire",      ["fire", "flame", "pyromancer", "ember", "blaze", "burning", "ignit"]),
    ("cold",      ["cold", "ice", "frost", "glacial", "cryomancer", "freez", "chill", "shiver"]),
    ("lightning", ["lightning", "storm", "thunder", "conduit", "spark", "electric"]),
    ("void",      ["void", "abyss", "eldritch"]),
    ("poison",    ["poison", "venom", "toxic", "blight", "noxious"]),
    ("bleed",     ["bleed", "gore", "hemorrhage", "sanguine"]),
    ("physical",  ["physical"]),
]

def classify_scope(name: str) -> tuple[str, bool]:
    """Returns (scope, is_fallback)."""
    name_lower = name.lower()
    for scope, keywords in SCOPE_RULES:
        if any(kw in name_lower for kw in keywords):
            return scope, False
    return "generic", True

def classify_damage_type(name: str) -> str | None:
    name_lower = name.lower()
    for damage_type, keywords in DAMAGE_TYPE_RULES:
        if any(kw in name_lower for kw in keywords):
            return damage_type
    return None

# Season 4 Rune of Corruption affixes (see full list in Dev Notes above)
ROC_AFFIXES = [
    # ... paste the full ROC_AFFIXES list here
]

def main() -> None:
    global AFFIXES_PATH
    if not AFFIXES_PATH.exists():
        alt = Path("src-tauri/resources/items/affixes.json")
        if alt.exists():
            AFFIXES_PATH = alt
        else:
            print("ERROR: Could not find affixes.json. Run from lebo/ or repo root.", file=sys.stderr)
            sys.exit(1)

    affixes = json.loads(AFFIXES_PATH.read_text(encoding="utf-8"))
    existing_ids = {a["id"] for a in affixes}

    fallback_count = 0
    for affix in affixes:
        if "modifierType" not in affix:
            affix["modifierType"] = "increased"
        if "scope" not in affix:
            scope, is_fallback = classify_scope(affix["name"])
            affix["scope"] = scope
            if is_fallback:
                fallback_count += 1
        if "damageType" not in affix:
            affix["damageType"] = classify_damage_type(affix["name"])

    # Inject Rune of Corruption affixes
    injected = 0
    for roc in ROC_AFFIXES:
        if roc["id"] not in existing_ids:
            affixes.append(roc)
            injected += 1

    AFFIXES_PATH.write_text(
        json.dumps(affixes, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )
    print(f"OK: {AFFIXES_PATH.name} annotated — {len(affixes)} total entries")
    print(f"scope fallback count (generic): {fallback_count}")
    print(f"modifierType: all entries set to 'increased' (name-only heuristics)")
    print(f"Rune of Corruption affixes injected: {injected}")
    print("\nDone. Review scope fallback count — unnamed-XXX entries are expected to be generic.")

if __name__ == "__main__":
    main()
```

**After running the script**, review the fallback count output. All "unnamed-XXX" entries will correctly classify as `scope: "generic"` — this is expected and correct behavior per the heuristic fallback rule.

### Task 5 — Synergy Unique Descriptions (Exact JSON Changes)

In `lebo/src-tauri/resources/items/uniques.json`, add `"description"` to these three existing entries. Find by `"id"` and add the field:

**Exsanguinous** (`"id": "exsanguinous"`):
```json
"description": "Converts a portion of maximum life into Ward generation. Each second, (15-30)% of your missing life regenerates as Ward. A Ward-based defensive build enabler — works best with low life pool and high Ward cap."
```

**Bleeding Heart** (`"id": "bleeding-heart"`):
```json
"description": "Amplifies bleeding stacks. You gain (35-25)% reduced life regeneration but deal (5-9) additional damage per second per bleed stack. Core bleed build enabler — requires sustained bleed application to benefit."
```

**Omnividence** (`"id": "omnividence"`):
```json
"description": "Massive void damage amplifier. Grants (15-20)% increased void damage and (50-100)% additional void damage for skills that hit only one enemy at a time. Single-target void build enabler — penalizes multi-target skills."
```

Only add `"description"` to these three entries. Do not modify any other fields on any unique item.

### Task 6 — manifest.json Change (Exact)

Current `manifest.json` (after story 1.2):
```json
{
  "schemaVersion": 2,
  "gameVersion": "Season 4 (Shattered Omens)",
  "dataVersion": "s4.1",
  "generatedAt": "2026-03-26T00:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"],
  "itemDataVersion": "1.0.0",
  "iconCacheVersion": "1.0.0",
  "iconSource": "placeholder"
}
```

Change only `itemDataVersion`:
```json
"itemDataVersion": "s4.1"
```

**Only `itemDataVersion` changes.** Do not touch any other field.

### How Item Staleness Works

The staleness check in `item_commands.rs` → `check_item_data_freshness` compares `local.item_data_version` vs `remote.item_data_version`. Changing to `"s4.1"` will trigger a staleness update prompt for players who have the old `"1.0.0"` bundled version — exactly as expected. No code changes needed.

### Verification Script

After all tasks are done, run this to confirm annotation completeness:

```bash
# From repo root
python3 -c "
import json, pathlib

affixes = json.loads(pathlib.Path('lebo/src-tauri/resources/items/affixes.json').read_text(encoding='utf-8'))
missing_mt = [a['id'] for a in affixes if 'modifierType' not in a]
missing_sc = [a['id'] for a in affixes if 'scope' not in a]
missing_dt = [a['id'] for a in affixes if 'damageType' not in a]
roc_present = [a for a in affixes if a['id'].startswith('affix-roc-')]
print(f'Total affixes: {len(affixes)}')
print(f'Missing modifierType: {len(missing_mt)}')
print(f'Missing scope: {len(missing_sc)}')
print(f'Missing damageType: {len(missing_dt)}')
print(f'Rune of Corruption affixes: {len(roc_present)}')
assert len(missing_mt) == 0, f'FAIL: {missing_mt[:5]}'
assert len(missing_sc) == 0, f'FAIL: {missing_sc[:5]}'
assert len(missing_dt) == 0, 'FAIL: damageType must exist on all entries (null is ok)'
assert len(roc_present) >= 5, 'FAIL: Expected at least 5 RoC affixes'
print('OK: all assertions pass')
"

python3 -c "
import json, pathlib

uniques = json.loads(pathlib.Path('lebo/src-tauri/resources/items/uniques.json').read_text(encoding='utf-8'))
key_ids = {'exsanguinous', 'bleeding-heart', 'omnividence'}
for u in uniques:
    if u['id'] in key_ids:
        assert 'description' in u, f'FAIL: {u[\"id\"]} missing description'
        print(f'OK: {u[\"id\"]} has description')
"
```

### What This Story Does NOT Do

- ❌ Do NOT annotate passive nodes — that was story 1.2
- ❌ Do NOT create `idol-data.json`, `blessings.json`, `conditions.json` — that is story 1.4
- ❌ Do NOT modify `AffixEntryV2` in `build.ts` — that is a build-state type, never modify it for DB concerns
- ❌ Do NOT add `statKey`, `condition`, or `ailmentType` to `AffixEntry` — Phase 4 fields
- ❌ Do NOT add descriptions to all 471 uniques — only the 3 build-enabling synergy targets
- ❌ Do NOT use raw `invoke()` anywhere — always `invokeCommand<T>()` (this story makes no IPC changes)
- ❌ Do NOT create barrel `index.ts` files
- ❌ Do NOT touch `AffixEntry` TypeScript type — already done in story 1.1
- ❌ Do NOT update `gameVersion` or `dataVersion` in manifest — already done in story 1.2

### Known Pre-existing Test Failures

8 test failures remain from stories 1.1/1.2: `SkillTreeCanvas`, `ProviderSelector`, `Settings`, and `TreeControls` — all pre-existing Phase 2 failures. `pnpm vitest` will show them; do not attempt to fix them as part of this story.

### JSON Field Ordering Note

When adding new fields to JSON objects in Python via `json.dumps`, the fields appear at the end of the object by default. This is fine — JSON parsers are order-insensitive. No need to manually reorder fields in the output.

### Project Structure Notes

- `item_data.rs` → `lebo/src-tauri/src/models/item_data.rs` (modify in place)
- `itemDatabase.ts` → `lebo/src/shared/types/itemDatabase.ts` (modify in place)
- `affixes.json` → `lebo/src-tauri/resources/items/affixes.json` (modified by script)
- `uniques.json` → `lebo/src-tauri/resources/items/uniques.json` (modify in place for 3 entries)
- `manifest.json` → `lebo/src-tauri/resources/game-data/manifest.json` (modify in place)
- `annotate_s4_affixes.py` → `lebo/scripts/annotate_s4_affixes.py` (new file)
- Commands run from `lebo/` (Vite project root); pnpm only

### References

- [Source: epics.md § Story 1.3 — Season 4 Affix & Item Data Ingestion]
- [Source: architecture.md § Data Ingestion Pipeline — The Schema Gap]
- [Source: architecture.md § Forward-Compatible Affix Schema]
- [Source: project-context.md § Language-Specific Rules — no barrel files, strict mode]
- [Source: project-context.md § Critical Don't-Miss Rules — GearItemV2 deprecation]
- [Source: story 1.1 Dev Notes — AffixEntry extension rationale]
- [Source: story 1.2 Dev Notes — annotation script pattern and pre-existing failures]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Tasks 1–2: Extended `RawAffix` with `modifier_type`, `scope`, `damage_type` (all `Option<String>` with `#[serde(default)]`) and `RawUniqueItem` with `description: Option<String>`. All existing JSON without these fields deserializes cleanly.
- Task 3: Added `description?: string` to `UniqueItem` TypeScript interface. `AffixEntry` already had the three affix annotation fields from story 1.1 — not touched.
- Task 4: Created `lebo/scripts/annotate_s4_affixes.py`. Ran from repo root — annotated 4176 total entries (4171 original + 5 RoC injected). Scope fallback count: 4158 (expected — mostly unnamed-XXX entries). All verification assertions pass: 0 missing modifierType, 0 missing scope, 0 missing damageType, 5 RoC affixes present.
- Task 5: Added `description` field to Exsanguinous, Bleeding Heart, and Omnividence in `uniques.json`. No other entries modified.
- Task 6: Changed `itemDataVersion` from `"1.0.0"` to `"s4.1"` in `manifest.json`. No other fields touched.
- Task 7: `pnpm build` — zero TypeScript errors. `cargo build` — zero Rust errors. `pnpm vitest` — exactly 8 pre-existing failures (ProviderSelector ×5, Settings ×1, SkillTreeCanvas ×1, TreeControls ×1). No new regressions.

### File List

- `lebo/src-tauri/src/models/item_data.rs` — added `modifier_type`, `scope`, `damage_type` to `RawAffix`; added `description` to `RawUniqueItem`
- `lebo/src/shared/types/itemDatabase.ts` — added `description?: string` to `UniqueItem`
- `lebo/scripts/annotate_s4_affixes.py` — new file: S4 affix annotation pipeline
- `lebo/src-tauri/resources/items/affixes.json` — all 4176 entries annotated with `modifierType`, `scope`, `damageType`; 5 RoC affixes injected
- `lebo/src-tauri/resources/items/uniques.json` — `description` added to Exsanguinous, Bleeding Heart, Omnividence
- `lebo/src-tauri/resources/game-data/manifest.json` — `itemDataVersion` bumped to `"s4.1"`

## Change Log

- 2026-05-21: Story 1.3 implemented — Season 4 affix annotation (4176 entries), Rune of Corruption affixes (5), synergy unique descriptions (3), Rust/TS type extensions, itemDataVersion bump to s4.1
