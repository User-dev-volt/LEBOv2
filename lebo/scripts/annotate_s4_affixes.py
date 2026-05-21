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
    ("spell",  ["spell", "cast", "pyromancer", "cryomancer", "spellblade", "arcane", "occultist"]),
    ("melee",  ["melee", "attack", "warrior", "blade", "sword", "eviscerating"]),
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


def main() -> None:
    path = AFFIXES_PATH
    if not path.exists():
        alt = Path("src-tauri/resources/items/affixes.json")
        if alt.exists():
            path = alt
        else:
            print("ERROR: Could not find affixes.json. Run from lebo/ or repo root.", file=sys.stderr)
            sys.exit(1)

    affixes = json.loads(path.read_text(encoding="utf-8"))
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

    injected = 0
    for roc in ROC_AFFIXES:
        if roc["id"] not in existing_ids:
            affixes.append(roc)
            injected += 1

    path.write_text(
        json.dumps(affixes, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )
    print(f"OK: {path.name} annotated — {len(affixes)} total entries")
    print(f"scope fallback count (generic): {fallback_count}")
    print(f"modifierType: all entries set to 'increased' (name-only heuristics)")
    print(f"Rune of Corruption affixes injected: {injected}")
    print("\nDone. Review scope fallback count — unnamed-XXX entries are expected to be generic.")


if __name__ == "__main__":
    main()
