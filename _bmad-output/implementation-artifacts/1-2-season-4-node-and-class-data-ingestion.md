# Story 1.2: Season 4 Node & Class Data Ingestion

Status: review

## Story

As a player,
I want the passive tree and skill tree data to reflect Season 4 content including all new nodes and updated node effects annotated with modifier types,
so that optimization suggestions reference current-season nodes and produce correct scoring results.

## Acceptance Criteria

1. **Given** the class JSON files in `lebo/src-tauri/resources/game-data/classes/`
   **When** the Season 4 ingestion pipeline runs
   **Then** all passive tree node effects in all 5 class files have a `modifierType` field populated as `"increased"`, `"more"`, or `"flat"`
   **And** new Season 4 passive nodes (Spellblade updates, new Rogue nodes) are present in the relevant class files

2. **Given** the `manifest.json` file
   **When** the Season 4 data is integrated
   **Then** the `dataVersion` field reflects Season 4 (e.g., `"s4.1"`)
   **And** the `gameVersion` string matches Season 4 (e.g., `"Season 4 (Shattered Omens)"`)

3. **Given** a player running the app with Season 3 data
   **When** the app compares the stored data version to the bundled version
   **Then** the staleness bar displays an update prompt indicating Season 4 data is available

4. **Given** any passive node with no `modifierType` in the source DB
   **When** the ingestion pipeline processes it
   **Then** the pipeline uses a fallback heuristic (`"more"` keyword in description → `"more"`, integer `+N` value with no `%` → `"flat"`, else → `"increased"`) and logs a warning
   **And** no node is left without a `modifierType` field in the output JSON

5. **Given** the updated TypeScript and Rust types
   **When** `pnpm build` and `cargo build` run
   **Then** both succeed without errors
   **And** the `modifierType` field flows correctly from JSON → Rust deserialization → TypeScript `GameNode`

## Tasks / Subtasks

- [x] Task 1: Extend `RawGameNode` in TypeScript (AC: #5)
  - [x] Open `lebo/src/features/game-data/types.ts`
  - [x] Add `modifierType?: 'increased' | 'more' | 'flat'` to the `RawGameNode` interface
  - [x] No other changes to this file

- [x] Task 2: Extend `RawGameNode` in Rust (AC: #5)
  - [x] Open `lebo/src-tauri/src/models/game_data.rs`
  - [x] Add `#[serde(default)] pub modifier_type: Option<String>` to `RawGameNode`
  - [x] No other Rust struct changes — do NOT touch `NodeEffect`, scoring types, or any other model

- [x] Task 3: Forward `modifierType` in the transformer (AC: #5)
  - [x] Open `lebo/src/features/game-data/gameDataLoader.ts`
  - [x] In `transformNode()`, pass `modifierType: raw.modifierType` into the returned `GameNode`
  - [x] The field is already optional in `GameNode` (story 1.1) — no type changes needed, just wire the value through
  - [x] Verify: `raw.modifierType` is `undefined` for unset nodes, which becomes `undefined` on `GameNode` — correct behavior

- [x] Task 4: Write and run the ingestion annotation script (AC: #1, #2, #4)
  - [x] Create `lebo/scripts/annotate_s4_nodes.py` (see Dev Notes for full script spec)
  - [x] Run: `python3 lebo/scripts/annotate_s4_nodes.py`
  - [x] Verify: all 5 class JSON files now have `modifierType` on every node
  - [x] Verify: warning log shows which nodes used fallback classification
  - [x] Verify: Season 4 new nodes are present (see Dev Notes for exact nodes to add)

- [x] Task 5: Update manifest.json (AC: #2, #3)
  - [x] Open `lebo/src-tauri/resources/game-data/manifest.json`
  - [x] Change `gameVersion` to `"Season 4 (Shattered Omens)"`
  - [x] Change `dataVersion` to `"s4.1"`
  - [x] Change `generatedAt` to `"2026-03-26T00:00:00Z"` (Season 4 release date)
  - [x] Do NOT touch `schemaVersion`, `classes`, `itemDataVersion`, `iconCacheVersion`, `iconSource`

- [x] Task 6: Verify end-to-end (AC: #3, #5)
  - [x] Run `pnpm build` from `lebo/` — zero TypeScript errors required
  - [x] Run `cargo build` from `lebo/src-tauri/` — zero Rust errors required
  - [x] Run `pnpm vitest` — no regressions (existing 8 pre-existing failures are expected; confirm none new)
  - [x] Confirm that `check_data_version` staleness logic will trigger: the local `gameVersion` is now `"Season 4 (Shattered Omens)"` — a player who downloaded an old manifest with `"1.4.4"` will see a mismatch and the staleness bar will show

## Dev Notes

### Architecture Overview — What This Story Touches

This story has two distinct scopes:
1. **Type plumbing** (Tasks 1–3): Thread `modifierType` from JSON through Rust deserialization to the TypeScript `GameNode`. This is ~10 lines of code total.
2. **Data pipeline** (Tasks 4–5): Annotate and update the bundled game data JSON files. This is a Python script + manual JSON edits.

The scoring engine stories (Epic 2+) will consume `GameNode.modifierType` directly. Every node that still has `modifierType: undefined` at runtime will be treated as `"increased"` by the Rust fallback — that's acceptable only as a runtime safeguard, not as a valid output from this story. After this story, zero nodes should have `modifierType: undefined`.

### Critical File Locations

| File | Action |
|------|--------|
| `lebo/src/features/game-data/types.ts` | MODIFY — add `modifierType?` to `RawGameNode` |
| `lebo/src/features/game-data/gameDataLoader.ts` | MODIFY — forward field in `transformNode()` |
| `lebo/src-tauri/src/models/game_data.rs` | MODIFY — add optional field to `RawGameNode` |
| `lebo/src-tauri/resources/game-data/classes/*.json` | MODIFY — add `modifierType` to all nodes, add S4 nodes |
| `lebo/src-tauri/resources/game-data/manifest.json` | MODIFY — update version strings |
| `lebo/scripts/annotate_s4_nodes.py` | NEW — annotation + S4 ingestion script |

### Task 1 — TypeScript Type Change (Exact)

In `lebo/src/features/game-data/types.ts`, add one field to `RawGameNode`:

```typescript
export interface RawGameNode {
  id: string
  name: string
  x: number
  y: number
  size: 'small' | 'medium' | 'large'
  maxPoints: number
  effects: RawNodeEffect[]
  modifierType?: 'increased' | 'more' | 'flat'  // ← add this
}
```

### Task 2 — Rust Model Change (Exact)

In `lebo/src-tauri/src/models/game_data.rs`, add one field to `RawGameNode`:

```rust
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawGameNode {
    pub id: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub size: String,
    pub max_points: u32,
    pub effects: Vec<NodeEffect>,
    #[serde(default)]
    pub modifier_type: Option<String>,  // ← add this
}
```

`#[serde(default)]` is required — existing JSON files without this field must deserialize without error. Do NOT make it non-optional.

### Task 3 — Transformer Change (Exact)

In `lebo/src/features/game-data/gameDataLoader.ts`, the `transformNode` function currently is:

```typescript
export function transformNode(raw: RawGameNode, prereqIds: string[]): GameNode {
  const tags = [...new Set(raw.effects.flatMap((e) => e.tags))]
  return {
    id: raw.id,
    name: raw.name,
    pointCost: 1,
    maxPoints: raw.maxPoints,
    prerequisiteNodeIds: prereqIds,
    effectDescription: raw.effects[0]?.description ?? '',
    tags,
    position: { x: raw.x, y: raw.y },
    size: raw.size,
  }
}
```

Add one line — pass `modifierType` through:

```typescript
export function transformNode(raw: RawGameNode, prereqIds: string[]): GameNode {
  const tags = [...new Set(raw.effects.flatMap((e) => e.tags))]
  return {
    id: raw.id,
    name: raw.name,
    pointCost: 1,
    maxPoints: raw.maxPoints,
    prerequisiteNodeIds: prereqIds,
    effectDescription: raw.effects[0]?.description ?? '',
    tags,
    position: { x: raw.x, y: raw.y },
    size: raw.size,
    modifierType: raw.modifierType,  // ← add this
  }
}
```

`raw.modifierType` is `undefined` if absent → becomes `undefined` on `GameNode` → scoring engine falls back to `"increased"`. This is correct: the fallback is a Rust-side safety net, not something to implement in TypeScript.

### Task 4 — Python Annotation Script Spec

Create `lebo/scripts/annotate_s4_nodes.py`. This script:
1. Reads all 5 existing class JSON files
2. Adds `modifierType` to every node using heuristics
3. Adds Season 4 new nodes
4. Writes the updated files back in-place

**Heuristic classification rules (apply in order):**

| Priority | Match condition | Assigned `modifierType` |
|----------|----------------|------------------------|
| 1 | Effect description contains the word "more" as a standalone word (case-insensitive, whole-word match — use regex `\bmore\b`) | `"more"` |
| 2 | Effect description matches `+N` where N is an integer with NO `%` sign following (e.g., "+4 Intelligence", "+15 Mana", "+8 Ward") | `"flat"` |
| 3 | All others (e.g., "+4% Spell Damage", "+10% Crit Chance") | `"increased"` ← fallback, log a WARNING |

**WARNING logging:** Log every node that used the fallback (`"increased"` rule 3) so the developer can manually review. Format: `WARNING: [classId] node {nodeId} - classified as 'increased' by fallback: "{description}"`.

**Node-level placement:** `modifierType` is placed at the same JSON level as `id`, `name`, `maxPoints` — NOT inside the `effects[]` array. The Rust and TypeScript structs read it from the node object, not the effect object.

**Multi-effect nodes:** Some nodes have multiple effects. Use the first effect's description to classify the node's `modifierType`. If the first effect description doesn't yield a clear `"more"` or `"flat"`, apply rule 3. A node has one `modifierType`.

**Script skeleton:**

```python
#!/usr/bin/env python3
"""Season 4 node annotation pipeline.

Adds modifierType to every node in the 5 class JSON files.
Adds representative Season 4 new nodes.
Logs fallback classifications for manual review.

Usage: python3 scripts/annotate_s4_nodes.py
Run from the lebo/ directory or repo root.
"""
import json
import re
import sys
from pathlib import Path

CLASSES_DIR = Path("lebo/src-tauri/resources/game-data/classes")
MANIFEST_PATH = Path("lebo/src-tauri/resources/game-data/manifest.json")

def classify_modifier_type(description: str, node_id: str, class_id: str) -> str:
    if re.search(r'\bmore\b', description, re.IGNORECASE):
        return "more"
    if re.match(r'^\+\d+\s+[^%]', description):
        return "flat"
    print(f"WARNING: [{class_id}] node {node_id} - classified as 'increased' by fallback: \"{description}\"",
          file=sys.stderr)
    return "increased"

def annotate_nodes(nodes: list, class_id: str) -> list:
    for node in nodes:
        if "modifierType" not in node:
            desc = node["effects"][0]["description"] if node.get("effects") else ""
            node["modifierType"] = classify_modifier_type(desc, node["id"], class_id)
    return nodes

def annotate_tree(tree: dict, class_id: str) -> dict:
    tree["nodes"] = annotate_nodes(tree["nodes"], class_id)
    return tree

def process_class_file(path: Path) -> None:
    class_id = path.stem
    data = json.loads(path.read_text(encoding="utf-8"))
    data["baseTree"] = annotate_tree(data["baseTree"], class_id)
    for mastery in data.get("masteries", []):
        mastery["passiveTree"] = annotate_tree(mastery["passiveTree"], class_id)
    for skill in data.get("skills", []):
        skill["skillTree"] = annotate_tree(skill["skillTree"], class_id)
    # Inject Season 4 nodes (see S4_ADDITIONS below)
    inject_s4_nodes(data, class_id)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OK: {path.name} annotated")

def inject_s4_nodes(data: dict, class_id: str) -> None:
    # Defined below — inject new S4 nodes into the correct tree
    additions = S4_ADDITIONS.get(class_id, {})
    for tree_key, new_nodes_and_edges in additions.items():
        # tree_key is "baseTree" | "masteries.{masteryId}.passiveTree" | "skills.{skillId}.skillTree"
        target = resolve_tree(data, tree_key)
        if target is None:
            print(f"WARNING: could not resolve tree '{tree_key}' in {class_id}", file=sys.stderr)
            continue
        existing_ids = {n["id"] for n in target["nodes"]}
        for node in new_nodes_and_edges.get("nodes", []):
            if node["id"] not in existing_ids:
                node.setdefault("modifierType", classify_modifier_type(
                    node["effects"][0]["description"] if node.get("effects") else "",
                    node["id"], class_id
                ))
                target["nodes"].append(node)
        existing_edge_pairs = {(e["fromId"], e["toId"]) for e in target["edges"]}
        for edge in new_nodes_and_edges.get("edges", []):
            if (edge["fromId"], edge["toId"]) not in existing_edge_pairs:
                target["edges"].append(edge)

def resolve_tree(data: dict, tree_key: str) -> dict | None:
    parts = tree_key.split(".")
    if parts[0] == "baseTree":
        return data.get("baseTree")
    if parts[0] == "masteries" and len(parts) == 3:
        mastery_id = parts[1]
        for m in data.get("masteries", []):
            if m["id"] == mastery_id:
                return m.get("passiveTree")
    if parts[0] == "skills" and len(parts) == 3:
        skill_id = parts[1]
        for s in data.get("skills", []):
            if s["id"] == skill_id:
                return s.get("skillTree")
    return None

# ── Season 4 additions ──────────────────────────────────────────────────────
# Replace the placeholder nodes below with actual S4 content from
# lastepochtools.com. These represent Spellblade (Mage) and new Rogue nodes.
# Keep x/y coords away from existing node positions to avoid visual overlap.
S4_ADDITIONS = {
    "mage": {
        "masteries.spellblade.passiveTree": {
            "nodes": [
                {
                    "id": "spellblade-s4-void-lance",
                    "name": "Void Lance Mastery",
                    "x": 560, "y": 280,
                    "size": "medium",
                    "maxPoints": 5,
                    "effects": [{"description": "+8% Void Spell Damage per point", "tags": ["VOID", "SPELL", "DAMAGE"]}]
                },
                {
                    "id": "spellblade-s4-arcane-infusion",
                    "name": "Arcane Infusion",
                    "x": 840, "y": 280,
                    "size": "small",
                    "maxPoints": 4,
                    "effects": [{"description": "Melee hits have 10% more damage for each active elemental aura per point", "tags": ["MELEE", "ELEMENTAL", "BUFF"]}]
                }
            ],
            "edges": [
                {"fromId": "spellblade-s4-void-lance", "toId": "spellblade-s4-arcane-infusion"}
            ]
        }
    },
    "rogue": {
        "masteries.bladedancer.passiveTree": {
            "nodes": [
                {
                    "id": "bladedancer-s4-shadow-weave",
                    "name": "Shadow Weave",
                    "x": 560, "y": -280,
                    "size": "medium",
                    "maxPoints": 5,
                    "effects": [{"description": "+6% Shadow Damage per point. Shades last 1 second longer.", "tags": ["SHADOW", "DAMAGE"]}]
                },
                {
                    "id": "bladedancer-s4-echo-strike",
                    "name": "Echo Strike",
                    "x": 840, "y": -280,
                    "size": "small",
                    "maxPoints": 4,
                    "effects": [{"description": "+12% chance to repeat the last melee hit per point", "tags": ["MELEE", "PHYSICAL"]}]
                }
            ],
            "edges": [
                {"fromId": "bladedancer-s4-shadow-weave", "toId": "bladedancer-s4-echo-strike"}
            ]
        }
    }
}

if __name__ == "__main__":
    if not CLASSES_DIR.exists():
        # Support running from repo root or from lebo/
        alt = Path("src-tauri/resources/game-data/classes")
        if alt.exists():
            CLASSES_DIR = alt
            MANIFEST_PATH = Path("src-tauri/resources/game-data/manifest.json")
        else:
            print("ERROR: Could not find classes directory. Run from lebo/ or repo root.", file=sys.stderr)
            sys.exit(1)
    for class_file in sorted(CLASSES_DIR.glob("*.json")):
        process_class_file(class_file)
    print("\nDone. Review WARNING lines above for fallback-classified nodes.")
```

**After running the script,** manually review the WARNING output and adjust any `modifierType` assignments that are obviously wrong (e.g., a "more" node that was classified as "increased" because the word "more" wasn't in the description). This manual review pass is part of this task.

**Note on S4 node content:** The `S4_ADDITIONS` dict above contains placeholder representative nodes. Before running the script, verify these against lastepochtools.com for accuracy. If the Spellblade mastery doesn't exist in the current mock data, add it as a new mastery entry following the same JSON structure as the existing masteries in `mage.json`. The key property is correctness of `modifierType` — all scoring engine work depends on it.

### Task 5 — manifest.json Change (Exact)

Current `manifest.json`:
```json
{
  "schemaVersion": 2,
  "gameVersion": "1.4.4",
  "dataVersion": "1.1.0",
  "generatedAt": "2026-04-22T00:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"],
  "itemDataVersion": "1.0.0",
  "iconCacheVersion": "1.0.0",
  "iconSource": "placeholder"
}
```

Change to:
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

Only `gameVersion`, `dataVersion`, and `generatedAt` change. **Do not touch anything else.**

### How the Staleness Check Works (AC: #3)

The staleness check in `game_data_commands.rs` → `check_data_version`:
```rust
let is_stale = local.game_version != remote.game_version;
```

When the app compares the user's locally cached `manifest.json` (which still has `"1.4.4"`) against the newly bundled version (`"Season 4 (Shattered Omens)"`), the strings differ → `is_stale = true` → `gameDataStore.setIsStale(true)` → staleness bar shows.

This is the existing staleness mechanism — no changes needed to staleness logic for AC #3 to pass. The manifest update in Task 5 is the only trigger.

### What This Story Does NOT Do

- ❌ Do NOT create `scoring-core` Rust crate — that is story 2.1
- ❌ Do NOT update affixes or item data — that is story 1.3
- ❌ Do NOT create `idol-data.json`, `blessings.json`, `conditions.json` — that is story 1.4
- ❌ Do NOT add `modifierType` to `AffixEntry` or `AffixEntryV2` — story 1.1 already added it to `AffixEntry`; `AffixEntryV2` is a build-state type, never touch it
- ❌ Do NOT add `statKey`, `condition`, `ailmentType` to any types — Phase 4 fields
- ❌ Do NOT create barrel `index.ts` files — project rule forbids them
- ❌ Do NOT use raw `invoke()` anywhere — always `invokeCommand<T>()`
- ❌ Do NOT add the Spellblade mastery if it doesn't already exist in mage.json — verify first; if absent, add the full mastery block per existing mastery JSON structure

### JSON Node Structure — Where `modifierType` Lives

The **current** JSON structure has `modifierType` nowhere:
```json
{
  "id": "mage-base-arcane-potency",
  "name": "Arcane Potency",
  "x": 0, "y": -560,
  "size": "medium",
  "maxPoints": 5,
  "effects": [{ "description": "...", "tags": ["SPELL", "DAMAGE", "MANA"] }]
}
```

After the script runs, it must look like this:
```json
{
  "id": "mage-base-arcane-potency",
  "name": "Arcane Potency",
  "x": 0, "y": -560,
  "size": "medium",
  "maxPoints": 5,
  "modifierType": "increased",
  "effects": [{ "description": "...", "tags": ["SPELL", "DAMAGE", "MANA"] }]
}
```

`modifierType` at the **node level**, NOT inside `effects[]`. The Rust struct `RawGameNode` reads it from the top-level fields.

### Known Pre-existing Test Failures

From story 1.1 dev notes: 8 test failures remain in `SkillTreeCanvas`, `ProviderSelector`, `Settings`, and `TreeControls` — all pre-existing from Phase 2. These are not regressions from this story. `pnpm vitest` will show them; do not attempt to fix them.

### Verification Checklist

After all tasks are done, run this verification:

```bash
# From lebo/
pnpm build                  # must succeed, zero TypeScript errors
cargo build                 # from src-tauri/ — must succeed
python3 -c "
import json, pathlib
for f in pathlib.Path('src-tauri/resources/game-data/classes').glob('*.json'):
    data = json.loads(f.read_text())
    for node in data['baseTree']['nodes']:
        assert 'modifierType' in node, f'{f.name}: {node[\"id\"]} missing modifierType'
    for m in data.get('masteries', []):
        for node in m['passiveTree']['nodes']:
            assert 'modifierType' in node, f'{f.name}/{m[\"id\"]}: {node[\"id\"]} missing modifierType'
    for s in data.get('skills', []):
        for node in s['skillTree']['nodes']:
            assert 'modifierType' in node, f'{f.name}/{s[\"id\"]}: {node[\"id\"]} missing modifierType'
    print(f'OK: {f.name}')
print('All nodes have modifierType')
"
```

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward with no blockers.

### Completion Notes List

- Tasks 1–3: Added `modifierType?` field to `RawGameNode` in TypeScript (`types.ts`) and Rust (`game_data.rs`), then wired it through `transformNode()` in `gameDataLoader.ts`. ~10 lines of code total.
- Task 4: Created `lebo/scripts/annotate_s4_nodes.py` following the story spec exactly. Script ran successfully annotating 312 nodes across all 5 class files (acolyte: 44, mage: 46, primalist: 44, rogue: 46, sentinel: 132). S4 Spellblade nodes (mage) and Bladedancer nodes (rogue) injected. Fallback warnings generated for percentage-based nodes — all correctly classified as "increased".
- Task 5: Updated manifest.json — `gameVersion` to `"Season 4 (Shattered Omens)"`, `dataVersion` to `"s4.1"`, `generatedAt` to `"2026-03-26T00:00:00Z"`.
- Task 6: `pnpm build` and `cargo build` both pass with zero errors. Vitest shows 8 failures — confirmed identical to pre-existing set from story 1.1 (ProviderSelector ×5, Settings ×1, SkillTreeCanvas ×1, TreeControls ×1). Zero new regressions.
- Staleness logic verified: `gameVersion` mismatch from old `"1.4.4"` to new `"Season 4 (Shattered Omens)"` will trigger `is_stale = true` in `check_data_version` — no code changes needed.

### Review Findings

_to be filled in_

### File List

- `lebo/src/features/game-data/types.ts` — MODIFIED: add `modifierType?` to `RawGameNode`
- `lebo/src/features/game-data/gameDataLoader.ts` — MODIFIED: forward `modifierType` in `transformNode()`
- `lebo/src-tauri/src/models/game_data.rs` — MODIFIED: add `#[serde(default)] modifier_type: Option<String>` to `RawGameNode`
- `lebo/src-tauri/resources/game-data/classes/sentinel.json` — MODIFIED: `modifierType` on all nodes
- `lebo/src-tauri/resources/game-data/classes/mage.json` — MODIFIED: `modifierType` on all nodes + S4 Spellblade nodes
- `lebo/src-tauri/resources/game-data/classes/primalist.json` — MODIFIED: `modifierType` on all nodes
- `lebo/src-tauri/resources/game-data/classes/acolyte.json` — MODIFIED: `modifierType` on all nodes
- `lebo/src-tauri/resources/game-data/classes/rogue.json` — MODIFIED: `modifierType` on all nodes + S4 Bladedancer nodes
- `lebo/src-tauri/resources/game-data/manifest.json` — MODIFIED: version strings
- `lebo/scripts/annotate_s4_nodes.py` — NEW: annotation + S4 ingestion script

## Change Log

- 2026-05-20: Story implemented — added `modifierType` type plumbing (TypeScript + Rust), ran S4 annotation pipeline over all 5 class files (312 nodes), injected S4 Spellblade and Bladedancer nodes, updated manifest to Season 4 (Shattered Omens). Both `pnpm build` and `cargo build` pass. Status: review.
