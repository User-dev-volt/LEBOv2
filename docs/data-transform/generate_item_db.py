#!/usr/bin/env python3
"""
Last Epoch item database transformer.

Sources:
  - Musholic/PathOfBuildingForLastEpoch (dev branch) — bases.json, uniques.json, ModItem.json

Outputs (in ../../lebo/src-tauri/resources/items/ relative to this script):
  - base-items.json   — BaseItem[]  (>=674 entries)
  - uniques.json      — UniqueItem[] (>=445 entries)
  - affixes.json      — AffixEntry[] (>=1,112 entries)

All keys are camelCase to match #[serde(rename_all = "camelCase")] Rust models.
"""

import json
import re
import urllib.request
from pathlib import Path

GITHUB_RAW = "https://raw.githubusercontent.com/Musholic/PathOfBuildingForLastEpoch/dev"
BASES_URL = f"{GITHUB_RAW}/src/Data/Bases/bases.json"
UNIQUES_URL = f"{GITHUB_RAW}/src/Data/Uniques/uniques.json"
MODITEM_URL = f"{GITHUB_RAW}/src/Data/ModItem.json"

SCRIPT_DIR = Path(__file__).parent
OUT_DIR = SCRIPT_DIR.parent.parent / "lebo" / "src-tauri" / "resources" / "items"

# Maps Last Epoch item type strings to the LEBO gear slot keys.
TYPE_TO_SLOT: dict[str, str] = {
    "Helmet": "helmet",
    "Body Armor": "body",
    "Gloves": "gloves",
    "Belt": "belt",
    "Boots": "boots",
    "Ring": "ring1",
    "Amulet": "amulet",
    "Relic": "relic",
    "One-Handed Sword": "weapon",
    "One-Handed Axe": "weapon",
    "One-Handed Mace": "weapon",
    "Dagger": "weapon",
    "Sceptre": "weapon",
    "Wand": "weapon",
    "Two-Handed Sword": "weapon",
    "Two-Handed Axe": "weapon",
    "Two-Handed Mace": "weapon",
    "Two-Handed Spear": "weapon",
    "Two-Handed Staff": "weapon",
    "Bow": "weapon",
    "Shield": "offhand",
    "Quiver": "offhand",
    "Catalyst": "offhand",
    "Off-Hand Catalyst": "offhand",
    # Idol types — stored with slot "idol" for future Epic 5 idol features
    "Grand Idol": "idol",
    "Large Idol": "idol",
    "Ornate Idol": "idol",
    "Huge Idol": "idol",
    "Adorned Idol": "idol",
    "Small Idol": "idol",
    "Minor Idol": "idol",
    "Humble Idol": "idol",
    "Stout Idol": "idol",
    # Lens types — passive slot items
    "Eos Lens": "lens",
    "Dysis Lens": "lens",
    "Arctus Lens": "lens",
    "Mesembria Lens": "lens",
    "Greater Lens": "lens",
    "Idol Altar": "lens",
    # Blessings — timeline boss drop passive bonuses
    "Blessing": "blessing",
}


def fetch_json(url: str) -> object:
    print(f"  Fetching {url} ...")
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read().decode("utf-8")
    return json.loads(data)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_range(text: str) -> tuple[float, float]:
    """Extract (min, max) numeric values from a mod text string.

    Patterns handled:
      +(10-35)% Mana        → (10, 35)
      +(100-150) Armor      → (100, 150)
      +4% Void Penetration  → (4, 4)
      (5-25)% increased ... → (5, 25)
      {rounding:Integer}... → strip prefix then recurse
    """
    text = re.sub(r"\{[^}]+\}", "", text).strip()
    # Range pattern: (min-max)
    m = re.search(r"\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)", text)
    if m:
        return float(m.group(1)), float(m.group(2))
    # Single numeric value
    m = re.search(r"[+\-]?(\d+(?:\.\d+)?)", text)
    if m:
        v = float(m.group(1))
        return v, v
    return 0.0, 0.0


# ──────────────────────────────────────────────────────────────
# Transform bases.json → BaseItem[]
# ──────────────────────────────────────────────────────────────

def transform_bases(raw: dict) -> list[dict]:
    items: list[dict] = []
    for name, entry in raw.items():
        item_type = entry.get("type", "")
        slot = TYPE_TO_SLOT.get(item_type, "")
        if not slot:
            continue  # skip unknown types
        items.append({
            "id": slugify(name),
            "name": name,
            "baseType": item_type,
            "slot": slot,
            "implicitAffixIds": [],  # implicits are text-only in source; linked in future
        })
    return items


# ──────────────────────────────────────────────────────────────
# Transform uniques.json → UniqueItem[]
# ──────────────────────────────────────────────────────────────

def build_basetype_map(bases_raw: dict) -> dict[int, str]:
    """Build baseTypeID → item type string mapping from bases data."""
    mapping: dict[int, str] = {}
    for entry in bases_raw.values():
        bid = entry.get("baseTypeID")
        t = entry.get("type", "")
        if bid is not None and t:
            mapping[bid] = t
    return mapping


def transform_uniques(raw: dict, basetype_map: dict[int, str]) -> list[dict]:
    items: list[dict] = []
    for _idx, entry in raw.items():
        name = entry.get("name", "")
        if not name:
            continue
        bid = entry.get("baseTypeID", -1)
        item_type = basetype_map.get(bid, "")
        slot = TYPE_TO_SLOT.get(item_type, "")
        if not slot:
            slot = "weapon"  # fallback for unknowns

        # Build UniqueItemAffix list from mods strings with range parsing
        mods = entry.get("mods", [])
        affixes: list[dict] = []
        for i, mod_text in enumerate(mods):
            min_val, max_val = parse_range(mod_text)
            affixes.append({
                "affixId": f"unique-{slugify(name)}-{i}",
                "fixedMinValue": min_val,
                "fixedMaxValue": max_val,
            })

        items.append({
            "id": slugify(name),
            "name": name,
            "baseType": item_type if item_type else "Unknown",
            "slot": slot,
            "affixes": affixes,
        })
    return items


# ──────────────────────────────────────────────────────────────
# Transform ModItem.json → AffixEntry[]
# ──────────────────────────────────────────────────────────────

def transform_affixes(raw: dict) -> list[dict]:
    """Group ModItem entries by (affix_name, type) → AffixEntry with tiers."""
    # Each key is like "0_0", "0_1", "14_0", etc.
    # Group by affix name + type to build multi-tier entries.
    groups: dict[tuple[str, str], list[dict]] = {}

    for key, entry in raw.items():
        affix_name = entry.get("affix") or f"unnamed-{key}"
        raw_type = entry.get("type", "Prefix")
        affix_type = raw_type.lower()  # "prefix" | "suffix"
        if affix_type not in ("prefix", "suffix"):
            affix_type = "prefix"

        group_key = (affix_name, affix_type)
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append({
            "key": key,
            "tier": entry.get("tier", 0),
            "stat1": entry.get("1", ""),
            "stat2": entry.get("2", ""),
        })

    affixes: list[dict] = []
    for (affix_name, affix_type), entries in groups.items():
        # Sort by tier number
        entries.sort(key=lambda e: e["tier"])

        tiers: list[dict] = []
        for e in entries:
            stat_text = e["stat1"]
            min_val, max_val = parse_range(stat_text) if stat_text else (0.0, 0.0)
            tiers.append({
                "tier": e["tier"] + 1,  # 1-indexed
                "minValue": min_val,
                "maxValue": max_val,
            })

        # Use the first entry's key as the affix ID
        affix_id = f"affix-{slugify(affix_name)}-{affix_type}"

        affixes.append({
            "id": affix_id,
            "name": affix_name,
            "type": affix_type,
            "itemSlots": [],  # slot filtering not in source data; populated in future
            "tiers": tiers,
        })

    return affixes


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching source data from GitHub...")
    bases_raw = fetch_json(BASES_URL)
    uniques_raw = fetch_json(UNIQUES_URL)
    moditem_raw = fetch_json(MODITEM_URL)

    print("Transforming base items...")
    base_items = transform_bases(bases_raw)
    print(f"  {len(base_items)} base items")

    print("Building baseTypeID map...")
    basetype_map = build_basetype_map(bases_raw)

    print("Transforming unique items...")
    unique_items = transform_uniques(uniques_raw, basetype_map)
    print(f"  {len(unique_items)} unique items")

    print("Transforming affixes...")
    affixes = transform_affixes(moditem_raw)
    print(f"  {len(affixes)} affix entries")

    # Validate minimums
    assert len(base_items) >= 674, f"Need >=674 base items, got {len(base_items)}"
    assert len(unique_items) >= 445, f"Need >=445 unique items, got {len(unique_items)}"
    assert len(affixes) >= 1112, f"Need >=1,112 affixes, got {len(affixes)}"

    print(f"Writing to {OUT_DIR}...")
    with open(OUT_DIR / "base-items.json", "w", encoding="utf-8") as f:
        json.dump(base_items, f, ensure_ascii=False, separators=(",", ":"))

    with open(OUT_DIR / "uniques.json", "w", encoding="utf-8") as f:
        json.dump(unique_items, f, ensure_ascii=False, separators=(",", ":"))

    with open(OUT_DIR / "affixes.json", "w", encoding="utf-8") as f:
        json.dump(affixes, f, ensure_ascii=False, separators=(",", ":"))

    print("Done.")
    print(f"  base-items.json : {len(base_items)} entries")
    print(f"  uniques.json    : {len(unique_items)} entries")
    print(f"  affixes.json    : {len(affixes)} entries")


if __name__ == "__main__":
    main()
