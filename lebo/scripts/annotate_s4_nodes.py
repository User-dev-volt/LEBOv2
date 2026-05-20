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
    inject_s4_nodes(data, class_id)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OK: {path.name} annotated")

def inject_s4_nodes(data: dict, class_id: str) -> None:
    additions = S4_ADDITIONS.get(class_id, {})
    for tree_key, new_nodes_and_edges in additions.items():
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
