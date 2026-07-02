#!/usr/bin/env python3
"""Last Epoch item database transformer (Story 4.0 — affix stat-semantics data gate).

Sources (Musholic/PathOfBuildingForLastEpoch, dev branch):
  - src/Data/ModItem.json          — affix stat text, tiers, prefix/suffix
  - src/Data/Bases/bases.json      — base items + implicit stat text
  - src/Data/Uniques/uniques.json  — unique items + inline mod text

Outputs (../../lebo/src-tauri/resources/items/ relative to this script):
  - base-items.json    — BaseItem[]  (implicits parsed inline)
  - uniques.json       — UniqueItem[] (inline mods parsed to statKey)
  - affixes.json       — AffixEntry[] (real statKey / modifierType / tiers / name / itemSlots + hybrids)
  - affix-manifest.json — coverage counts, unmapped-affix list, implicit deferrals (AC2)

This is the single, re-runnable per-patch refresh path. Re-running against a fresh
PoB4LE pull reproduces the dataset deterministically — no manual post-edits.

WHY the design (verified 2026-07-02, see story 4.0 Dev Agent Record):
  - Affixes are grouped by their ModItem GROUP INDEX (the `NN` in `NN_tier`), NOT by name.
    496/1112 groups have an empty `affix` name; grouping by index + deriving a name from the
    stat text removes the historical `unnamed-*` pollution (4176 -> 1112 real affixes).
  - `statKey`/`modifierType`/`scope`/`damageType` are derived from the STAT TEXT (fields "1"/"2"),
    which is authoritative — never from the affix NAME (the superseded annotate_s4_affixes.py
    heuristic). Emitted `statKey` is snake_case, resolved by game_data_loader.rs::stat_key_from_str.
  - 58% of affixes are HYBRID (a second stat in field "2"); the second stat is emitted in
    `extraStats[]`. Primary stat stays at top level for item-search RawAffix back-compat.
  - itemSlots has NO source in PoB4LE (confirmed across ModItem/bases/LEToolsImport/ModCache and
    external LE-tools/tunklab). It is AUTHORED here from LE item design (STAT_SLOT_GROUPS), in
    gear.rs's canonical 12-slot vocabulary, and recorded as authored in the manifest.
"""

import argparse
import json
import re
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

GITHUB_RAW = "https://raw.githubusercontent.com/Musholic/PathOfBuildingForLastEpoch/dev"
BASES_URL = f"{GITHUB_RAW}/src/Data/Bases/bases.json"
UNIQUES_URL = f"{GITHUB_RAW}/src/Data/Uniques/uniques.json"
MODITEM_URL = f"{GITHUB_RAW}/src/Data/ModItem.json"

SCRIPT_DIR = Path(__file__).parent
OUT_DIR = SCRIPT_DIR.parent.parent / "lebo" / "src-tauri" / "resources" / "items"
SOURCE_CACHE = SCRIPT_DIR / ".source-cache"

# gear.rs canonical 12 slot IDs (scoring-core/src/gear.rs SLOT_IDS). itemSlots MUST use this
# vocabulary so gear.rs::score_slot's per-slot filter matches.
ARMOR = ["helm", "chest", "gloves", "boots", "belt"]
JEWELRY = ["amulet", "ring_1", "ring_2", "relic"]
OFFHAND = ["off_hand", "catalyst"]
ALL_SLOTS = ARMOR + ["amulet", "ring_1", "ring_2", "weapon", "off_hand", "relic", "catalyst"]

# Base-item `type` string -> slot id. Gear types use gear.rs's canonical 12-slot vocabulary
# (so uniques/implicits share it); idol/lens/blessing keep their own slot names (not gear slots,
# never referenced by an affix's authored itemSlots).
TYPE_TO_SLOT = {
    "Helmet": "helm", "Body Armor": "chest", "Gloves": "gloves", "Belt": "belt", "Boots": "boots",
    "Ring": "ring_1", "Amulet": "amulet", "Relic": "relic",
    "One-Handed Sword": "weapon", "One-Handed Axe": "weapon", "One-Handed Mace": "weapon",
    "Dagger": "weapon", "Sceptre": "weapon", "Wand": "weapon", "Two-Handed Sword": "weapon",
    "Two-Handed Axe": "weapon", "Two-Handed Mace": "weapon", "Two-Handed Spear": "weapon",
    "Two-Handed Staff": "weapon", "Bow": "weapon",
    "Shield": "off_hand", "Quiver": "off_hand", "Catalyst": "catalyst", "Off-Hand Catalyst": "catalyst",
    # Non-gear base types — kept in base-items.json for the item DB, but affixes never slot here.
    "Grand Idol": "idol", "Large Idol": "idol", "Ornate Idol": "idol", "Huge Idol": "idol",
    "Adorned Idol": "idol", "Small Idol": "idol", "Minor Idol": "idol", "Humble Idol": "idol",
    "Stout Idol": "idol", "Eos Lens": "lens", "Dysis Lens": "lens", "Arctus Lens": "lens",
    "Mesembria Lens": "lens", "Greater Lens": "lens", "Idol Altar": "lens", "Blessing": "blessing",
}

# ── Authored stat-category -> valid gear slots (AC3 / Decision D2) ──────────────
# There is NO affix->slot source in PoB4LE (verified). This table is AUTHORED from Last
# Epoch item design and is recorded as `authored` in the manifest. Keyed by snake_case
# statKey; the transform looks up the PRIMARY stat's key. Coarse but principled — enough
# to make per-slot wishlists differ (defensive on armor/jewelry, offense on weapon/jewelry,
# movement on boots, etc.).
_DEFENSIVE = ARMOR + JEWELRY + ["off_hand"]                 # armor + jewelry + shield
_OFFENSE = ["weapon", "catalyst", "gloves", "amulet", "ring_1", "ring_2", "relic"]
_SPEED = ["weapon", "catalyst", "gloves", "amulet", "ring_1", "ring_2", "relic"]
_MINION = ["helm", "amulet", "ring_1", "ring_2", "relic", "off_hand", "catalyst"]
_MANA = ["amulet", "ring_1", "ring_2", "relic", "catalyst", "off_hand", "belt"]

STAT_SLOT_GROUPS = {
    # Defensive
    "max_hp": _DEFENSIVE, "max_hp_percent": _DEFENSIVE, "hp_regen_per_sec": _DEFENSIVE,
    "armor": _DEFENSIVE, "endurance_threshold": _DEFENSIVE, "endurance_percent": _DEFENSIVE,
    "dodge_rating": _DEFENSIVE, "life_leech_percent": _DEFENSIVE, "healing_effectiveness": _DEFENSIVE,
    "critical_strike_avoidance": _DEFENSIVE,
    "ward_per_second": _DEFENSIVE, "ward_on_hit": _DEFENSIVE,
    "fire_resistance": _DEFENSIVE, "cold_resistance": _DEFENSIVE, "lightning_resistance": _DEFENSIVE,
    "void_resistance": _DEFENSIVE, "poison_resistance": _DEFENSIVE, "necrotic_resistance": _DEFENSIVE,
    "physical_resistance": _DEFENSIVE, "all_resistances": _DEFENSIVE,
    "block_chance": ["off_hand", "amulet", "relic"],
    # Offense
    "increased_damage": _OFFENSE, "more_damage": _OFFENSE,
    "increased_fire_damage": _OFFENSE, "increased_cold_damage": _OFFENSE,
    "increased_lightning_damage": _OFFENSE, "increased_void_damage": _OFFENSE,
    "increased_poison_damage": _OFFENSE, "increased_physical_damage": _OFFENSE,
    "increased_necrotic_damage": _OFFENSE, "increased_bleed_damage": _OFFENSE,
    "increased_ignite_damage": _OFFENSE,
    "increased_spell_damage": _OFFENSE, "increased_melee_damage": _OFFENSE,
    "increased_ranged_damage": _OFFENSE, "increased_area_damage": _OFFENSE,
    "added_fire_damage": ["weapon", "gloves", "amulet", "ring_1", "ring_2", "relic"],
    "added_cold_damage": ["weapon", "gloves", "amulet", "ring_1", "ring_2", "relic"],
    "added_lightning_damage": ["weapon", "gloves", "amulet", "ring_1", "ring_2", "relic"],
    "added_void_damage": ["weapon", "gloves", "amulet", "ring_1", "ring_2", "relic"],
    "added_physical_damage": ["weapon", "gloves", "amulet", "ring_1", "ring_2", "relic"],
    "critical_strike_chance": _OFFENSE, "critical_strike_multiplier": _OFFENSE,
    "fire_penetration": _OFFENSE, "cold_penetration": _OFFENSE, "lightning_penetration": _OFFENSE,
    "void_penetration": _OFFENSE, "elemental_penetration": _OFFENSE, "physical_penetration": _OFFENSE,
    # Ailments (offense-adjacent)
    "ignite_duration": _OFFENSE, "poison_duration": _OFFENSE, "bleed_duration": _OFFENSE,
    "freeze_rate_multiplier": _OFFENSE, "max_poison_stacks": _OFFENSE,
    # Speed
    "attack_speed": _SPEED, "cast_speed": _SPEED, "cooldown_recovery_speed": _SPEED,
    "area_of_effect": _SPEED, "movement_speed": ["boots", "relic"],
    # Minion
    "increased_minion_damage": _MINION, "increased_minion_count": _MINION,
    "increased_minion_hp": _MINION,
    # Mana
    "max_mana": _MANA, "mana_regen_per_sec": _MANA,
    # Attributes roll broadly
    "strength": ALL_SLOTS, "dexterity": ALL_SLOTS, "intelligence": ALL_SLOTS,
    "attunement": ALL_SLOTS, "vitality": ALL_SLOTS,
}

# StatKeys that are defined but INERT in the current engine — no compute/* module consumes them
# (verified via `query(&StatKey::…)` usage across scoring-core). Emitting them would ship a dead
# key that renders a wrong/empty number (Source Audit; memory stun-chance-inert-unowned). The
# transform emits `statKey: null` for these and records them in the manifest.
#   - stun_chance:            StunChance surfaces a field but no source is meant to feed it (memory).
#   - max_mana / mana_regen:  the engine has no mana computation (MaxMana/ManaRegenPerSec unqueried).
#   - cooldown_recovery_speed: CooldownRecoverySpeed is unqueried.
#   - added_*_damage:         FlatAdded*Damage is unqueried — the damage model tracks % increased,
#                             not flat added base damage. This is a known engine gap, not a 4.0 fix.
INERT_STAT_KEYS = {
    "stun_chance", "max_mana", "mana_regen_per_sec", "cooldown_recovery_speed",
    "added_fire_damage", "added_cold_damage", "added_lightning_damage",
    "added_void_damage", "added_physical_damage",
    # compute_minion hardcodes minion_count / minion_hp_multi = 0.0 (no shipped source; de-conflating
    # would perturb the frozen EHP parity gate). Only increased_minion_damage is consumed.
    "increased_minion_count", "increased_minion_hp",
}

# Offense damage stats the engine consumes ONLY as Increased/More (offense.rs DAMAGE_STAT_KEYS sums
# Increased for the aggregate; per-type sums Increased+More). A "flat" modifier on one of these is
# inert, but a damage affix phrased "+X% Fire Damage" (no "increased" keyword) is really % increased
# damage — so coerce its flat modifierType to increased. (added_*_damage flat base is a different,
# unmodeled stat and is NOT in this set.)
COERCE_TO_INCREASED = {
    "increased_damage", "increased_fire_damage", "increased_cold_damage",
    "increased_lightning_damage", "increased_void_damage", "increased_poison_damage",
    "increased_physical_damage", "increased_necrotic_damage", "increased_bleed_damage",
    "increased_ignite_damage", "increased_spell_damage", "increased_melee_damage",
    "increased_ranged_damage", "increased_area_damage",
}

# Minion synonyms — LE minions are named (skeleton, wraith, ...) not tagged "minion".
MINION_WORDS = ("minion", "skeleton", "wraith", "zombie", "golem", "companion", "totem",
                "sacrifice", "abomination", "spriggan", "scorpion", "wolf", "beastmaster")

# Known non-stat mechanic phrases that would otherwise false-match a real stat -> force null.
NULL_PHRASES = (
    "before health", "dealt to mana", "taken as", "converted to", "no ward", "chance to",
    "of damage dealt", "damage leeched", "reflect", "per second while", "while channelling",
    "second delay", "increased effect of", "of missing", "of current",
)


# ── Source I/O (cache-first; committed script fetches live for per-patch refresh) ──

def fetch_json(name: str, url: str) -> object:
    SOURCE_CACHE.mkdir(exist_ok=True)
    cache = SOURCE_CACHE / f"{name}.json"
    if cache.exists():
        print(f"  [cache] {name}.json")
        return json.loads(cache.read_text(encoding="utf-8"))
    print(f"  [fetch] {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "lebo-item-db"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
    cache.write_text(raw, encoding="utf-8")
    return json.loads(raw)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ── Stat-text parsing ──────────────────────────────────────────────────────────

_ROUNDING = re.compile(r"\{[^}]*\}")
_RANGE = re.compile(r"\((\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\)")
_NUM = re.compile(r"[+\-]?\d+(?:\.\d+)?")


def clean_text(text: str) -> str:
    return _ROUNDING.sub("", text or "").strip()


def parse_range(text: str) -> tuple[float, float]:
    """Extract (min, max) from a mod string. Handles (a-b), +N, N% etc."""
    t = clean_text(text)
    m = _RANGE.search(t)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = _NUM.search(t)
    if m:
        v = float(m.group(0))
        return v, v
    return 0.0, 0.0


def derive_modifier_type(text: str) -> str:
    t = clean_text(text).lower()
    if " more " in f" {t} ":
        return "more"
    if "converted" in t or "->" in t:
        return "conversion"
    if "increased" in t or "reduced" in t:
        return "increased"
    return "flat"


def derive_scope(text: str) -> str:
    t = clean_text(text).lower()
    if "minion" in t or any(w in t for w in MINION_WORDS):
        return "minion"
    if "spell" in t or "cast" in t:
        return "spell"
    if "melee" in t:
        return "melee"
    if "ranged" in t or "bow" in t or "throwing" in t:
        return "ranged"
    return "generic"


def derive_damage_type(text: str):
    t = clean_text(text).lower()
    for dmg in ("fire", "cold", "lightning", "void", "poison", "necrotic", "physical", "bleed"):
        if dmg in t:
            return dmg
    return None


def _descriptor(text: str) -> str:
    """Cleaned, number-stripped, lowercased stat phrase for keyword matching."""
    t = clean_text(text)
    t = _RANGE.sub(" ", t)
    t = _NUM.sub(" ", t)
    t = t.replace("%", " ").replace("+", " ")
    return re.sub(r"\s+", " ", t).strip().lower()


def derive_stat_key(text: str, modifier_type: str):
    """Stat text -> snake_case statKey (resolvable by stat_key_from_str) or None.

    Order matters: specific categories before the generic `damage` fallback.
    Returns None for unmapped/inert stats (excluded from picker visibility; manifest-listed).
    """
    t = _descriptor(text)
    if not t:
        return None
    if any(p in t for p in NULL_PHRASES):
        return None

    is_minion = ("minion" in t) or any(w in t for w in MINION_WORDS)

    # Penetration
    if "penetration" in t:
        for el in ("void", "fire", "cold", "lightning", "physical", "elemental"):
            if el in t:
                return f"{el}_penetration"
        return None  # necrotic/poison/holy/chaos pen not modeled
    # Resistance
    if "resist" in t:
        if "all " in t or t.strip() in ("resistance", "resistances"):
            return "all_resistances"
        for el in ("fire", "cold", "lightning", "void", "poison", "necrotic", "physical"):
            if el in t:
                return f"{el}_resistance"
        return None
    # Attributes
    for attr in ("strength", "dexterity", "intelligence", "attunement", "vitality"):
        if attr in t:
            return attr
    # Crit. The engine consumes FLAT crit chance/multiplier ONLY (offense.rs filters
    # modifier_type == Flat), so "increased"/"more" crit chance/multiplier is inert → null (an
    # engine-model limitation, recorded via the unmapped manifest, not a wrong 0 shipped as a stat).
    # Crit avoidance sums all modifier types (defense.rs), so it maps regardless.
    if "critical" in t or "crit " in t or t.endswith("crit"):
        if "avoidance" in t:
            return "critical_strike_avoidance"
        if "multiplier" in t:
            return "critical_strike_multiplier" if modifier_type == "flat" else None
        if "chance" in t:
            return "critical_strike_chance" if modifier_type == "flat" else None
        return None
    # Speed
    if "attack speed" in t:
        return "attack_speed"
    if "cast speed" in t:
        return "cast_speed"
    if "movement speed" in t:
        return "movement_speed"
    if "cooldown" in t:
        return "cooldown_recovery_speed"
    if "area of effect" in t:
        return "area_of_effect"
    # Block / dodge
    if "block chance" in t or t.strip() == "block":
        return "block_chance"
    if "dodge" in t:
        return "dodge_rating"
    # Ward
    if "ward" in t:
        if "on hit" in t:
            return "ward_on_hit"
        if "per second" in t or "regen" in t or "gained" in t:
            return "ward_per_second"
        return None  # ward retention/decay not modeled
    # Health / regen
    if "health regen" in t or "health regeneration" in t or "life regen" in t:
        return "hp_regen_per_sec"
    if ("health" in t or t.strip() in ("life", "hp")) and "minion" not in t and not is_minion:
        return "max_hp_percent" if modifier_type == "increased" else "max_hp"
    # Mana
    if "mana regen" in t or "mana regeneration" in t:
        return "mana_regen_per_sec"
    if "mana" in t:
        return "max_mana"
    # Endurance
    if "endurance threshold" in t:
        return "endurance_threshold"
    if "endurance" in t:
        return "endurance_percent"
    # Leech / healing
    if "leech" in t:
        return "life_leech_percent"
    if "healing effectiveness" in t:
        return "healing_effectiveness"
    # Ailment durations / stacks
    if "freeze rate" in t:
        return "freeze_rate_multiplier"
    if "ignite" in t and "duration" in t:
        return "ignite_duration"
    if "poison" in t and "duration" in t:
        return "poison_duration"
    if "bleed" in t and "duration" in t:
        return "bleed_duration"
    if "poison" in t and "stack" in t:
        return "max_poison_stacks"
    # Armor (after minion-armor exclusion)
    if ("armor" in t or "armour" in t) and not is_minion:
        return "armor"
    # Minion count / hp / damage
    if is_minion:
        if "damage" in t:
            return "increased_minion_damage"
        if ("health" in t or "life" in t):
            return "increased_minion_hp"
        if any(w in t for w in ("maximum", "additional", "skeleton", "wraith", "companion")) and "damage" not in t:
            return "increased_minion_count"
        return None
    # Damage (element / delivery / generic) — last, most general
    if "damage" in t:
        flat = modifier_type == "flat"
        for el in ("fire", "cold", "lightning", "void", "physical"):
            if el in t and flat:
                return f"added_{el}_damage"
        for el in ("fire", "cold", "lightning", "void", "poison", "necrotic", "physical"):
            if el in t:
                return f"increased_{el}_damage"
        if "bleed" in t:
            return "increased_bleed_damage"
        if "ignite" in t:
            return "increased_ignite_damage"
        if "spell" in t:
            return "increased_spell_damage"
        if "melee" in t:
            return "increased_melee_damage"
        if "ranged" in t or "bow" in t:
            return "increased_ranged_damage"
        if "area" in t:
            return "increased_area_damage"
        return "more_damage" if modifier_type == "more" else "increased_damage"
    return None


def normalize_stat_key(key):
    """Drop inert/dead keys at the data boundary (Source Audit)."""
    if key in INERT_STAT_KEYS:
        return None
    return key


def stat_from_text(text: str):
    """Full derivation for one stat clause. Returns dict or None if no numeric content."""
    if not clean_text(text):
        return None
    mt = derive_modifier_type(text)
    key = normalize_stat_key(derive_stat_key(text, mt))
    if key in COERCE_TO_INCREASED and mt == "flat":
        mt = "increased"  # damage % stats are consumed as Increased; flat would be inert
    return {
        "statKey": key,
        "modifierType": mt,
        "scope": derive_scope(text),
        "damageType": derive_damage_type(text),
    }


def slots_for(stat_key) -> list:
    return list(STAT_SLOT_GROUPS.get(stat_key, [])) if stat_key else []


def derive_name(affix_name: str, stat_text: str) -> str:
    """Real affix name from ModItem, or a human-readable phrase from the stat text."""
    n = (affix_name or "").strip()
    if n:
        return n
    desc = _descriptor(stat_text)
    if not desc:
        return "Bonus"
    return " ".join(w.capitalize() for w in desc.split())[:60] or "Bonus"


# ── Transforms ─────────────────────────────────────────────────────────────────

def transform_affixes(moditem: dict) -> tuple[list, dict]:
    """Group ModItem rows by affix index -> one AffixEntry each (primary + hybrid extraStats)."""
    groups: dict[int, list] = defaultdict(list)
    for key, entry in moditem.items():
        gi = int(key.split("_")[0])
        groups[gi].append(entry)

    affixes: list[dict] = []
    used_ids: set[str] = set()
    unmapped: list[dict] = []

    for gi in sorted(groups):
        rows = sorted(groups[gi], key=lambda e: e.get("tier", 0))
        first = rows[0]
        raw_type = str(first.get("type", "Prefix")).lower()
        affix_type = raw_type if raw_type in ("prefix", "suffix") else "prefix"
        name = derive_name(first.get("affix"), first.get("1", ""))

        affix_id = f"affix-{slugify(name)}-{affix_type}"
        if affix_id in used_ids:
            affix_id = f"{affix_id}-{gi}"
        used_ids.add(affix_id)

        primary = stat_from_text(first.get("1", "")) or {
            "statKey": None, "modifierType": "increased", "scope": "generic", "damageType": None,
        }
        # Primary tiers from stat "1".
        tiers = []
        for e in rows:
            mn, mx = parse_range(e.get("1", ""))
            tiers.append({"tier": e.get("tier", 0) + 1, "minValue": mn, "maxValue": mx})

        # Hybrid second stat from field "2" (if any row carries it).
        extra_stats = []
        if any(clean_text(e.get("2", "")) for e in rows):
            sec = stat_from_text(rows[0].get("2", ""))
            if sec:
                sec_tiers = []
                for e in rows:
                    mn, mx = parse_range(e.get("2", ""))
                    sec_tiers.append({"tier": e.get("tier", 0) + 1, "minValue": mn, "maxValue": mx})
                extra_stats.append({
                    "statKey": sec["statKey"],
                    "modifierType": sec["modifierType"],
                    "scope": sec["scope"],
                    "damageType": sec["damageType"],
                    "tiers": sec_tiers,
                })

        item_slots = slots_for(primary["statKey"])
        affix = {
            "id": affix_id,
            "name": name,
            "type": affix_type,
            "itemSlots": item_slots,
            "statKey": primary["statKey"],
            "modifierType": primary["modifierType"],
            "scope": primary["scope"],
            "damageType": primary["damageType"],
            "tiers": tiers,
            "extraStats": extra_stats,
        }
        affixes.append(affix)
        if primary["statKey"] is None:
            unmapped.append({"id": affix_id, "name": name, "stat_text": clean_text(first.get("1", ""))})

    return affixes, {"unmapped_affixes": unmapped}


def transform_bases(bases: dict) -> list:
    """BaseItem[] with implicits parsed inline (Decision D3)."""
    items = []
    for name, entry in bases.items():
        item_type = entry.get("type", "")
        slot = TYPE_TO_SLOT.get(item_type, "")
        if not slot:
            continue  # unknown item type
        implicits = []
        for text in entry.get("implicits", []) or []:
            stat = stat_from_text(text)
            if stat is None:
                continue
            mn, mx = parse_range(text)
            implicits.append({
                "statKey": stat["statKey"],
                "modifierType": stat["modifierType"],
                "scope": stat["scope"],
                "damageType": stat["damageType"],
                "minValue": mn,
                "maxValue": mx,
                "text": clean_text(text),
            })
        items.append({
            "id": slugify(name),
            "name": name,
            "baseType": item_type,
            "slot": slot,
            "implicitAffixIds": [],
            "implicits": implicits,
        })
    return items


def build_basetype_map(bases: dict) -> dict:
    mapping = {}
    for entry in bases.values():
        bid = entry.get("baseTypeID")
        t = entry.get("type", "")
        if bid is not None and t:
            mapping[bid] = t
    return mapping


def transform_uniques(uniques: dict, basetype_map: dict) -> list:
    """UniqueItem[] — inline mods parsed to statKey (Decision D3; rollIds are NOT corpus refs)."""
    items = []
    for _idx, entry in uniques.items():
        name = entry.get("name", "")
        if not name:
            continue
        item_type = basetype_map.get(entry.get("baseTypeID", -1), "")
        slot = TYPE_TO_SLOT.get(item_type, "weapon")
        affixes = []
        for i, mod_text in enumerate(entry.get("mods", [])):
            mn, mx = parse_range(mod_text)
            stat = stat_from_text(mod_text) or {"statKey": None, "modifierType": "flat",
                                                "scope": "generic", "damageType": None}
            affixes.append({
                "affixId": f"unique-{slugify(name)}-{i}",
                "fixedMinValue": mn,
                "fixedMaxValue": mx,
                "statKey": stat["statKey"],
                "modifierType": stat["modifierType"],
                "scope": stat["scope"],
                "damageType": stat["damageType"],
                "text": clean_text(mod_text),
            })
        items.append({
            "id": slugify(name),
            "name": name,
            "baseType": item_type or "Unknown",
            "slot": slot,
            "affixes": affixes,
        })
    return items


# Rune of Corruption S4 endgame affixes — hand-authored (not in PoB4LE ModItem source).
# Preserved from the superseded annotate_s4_affixes.py, now with real statKey + gear.rs slots.
ROC_AFFIXES = [
    {"id": "affix-roc-attack-speed-corruption", "name": "of Frenzied Strikes", "type": "suffix",
     "statKey": "attack_speed", "modifierType": "increased", "scope": "melee",
     "itemSlots": ["weapon", "gloves"],
     "tiers": [{"tier": 1, "minValue": 10.0, "maxValue": 14.0},
               {"tier": 2, "minValue": 15.0, "maxValue": 19.0},
               {"tier": 3, "minValue": 20.0, "maxValue": 24.0}]},
    {"id": "affix-roc-spell-damage-corruption", "name": "of Arcane Surge", "type": "suffix",
     "statKey": "increased_spell_damage", "modifierType": "increased", "scope": "spell",
     "itemSlots": ["weapon", "catalyst"],
     "tiers": [{"tier": 1, "minValue": 15.0, "maxValue": 19.0},
               {"tier": 2, "minValue": 20.0, "maxValue": 24.0},
               {"tier": 3, "minValue": 25.0, "maxValue": 30.0}]},
    {"id": "affix-roc-all-resistances-corruption", "name": "of Warding", "type": "suffix",
     "statKey": "all_resistances", "modifierType": "flat", "scope": "generic",
     "itemSlots": ARMOR + ["ring_1", "ring_2", "amulet"],
     "tiers": [{"tier": 1, "minValue": 8.0, "maxValue": 10.0},
               {"tier": 2, "minValue": 11.0, "maxValue": 13.0},
               {"tier": 3, "minValue": 14.0, "maxValue": 16.0}]},
    {"id": "affix-roc-movement-speed-corruption", "name": "of Haste", "type": "suffix",
     "statKey": "movement_speed", "modifierType": "increased", "scope": "generic",
     "itemSlots": ["boots"],
     "tiers": [{"tier": 1, "minValue": 10.0, "maxValue": 12.0},
               {"tier": 2, "minValue": 13.0, "maxValue": 15.0},
               {"tier": 3, "minValue": 16.0, "maxValue": 18.0}]},
    {"id": "affix-roc-critical-multiplier-corruption", "name": "of Lethal Precision", "type": "suffix",
     "statKey": "critical_strike_multiplier", "modifierType": "flat", "scope": "generic",
     "itemSlots": ["weapon", "amulet"],
     "tiers": [{"tier": 1, "minValue": 20.0, "maxValue": 24.0},
               {"tier": 2, "minValue": 25.0, "maxValue": 29.0},
               {"tier": 3, "minValue": 30.0, "maxValue": 35.0}]},
]


def add_roc(affixes: list) -> None:
    for roc in ROC_AFFIXES:
        entry = dict(roc)
        entry.setdefault("damageType", None)
        entry.setdefault("extraStats", [])
        affixes.append(entry)


# ── Coverage manifest (AC2) ────────────────────────────────────────────────────

def is_picker_visible(affix: dict) -> bool:
    return bool(affix.get("statKey")) and bool(affix.get("itemSlots")) \
        and not affix["name"].lower().startswith("unnamed")


def build_manifest(affixes, base_items, uniques, unmapped) -> dict:
    total = len(affixes)
    resolved = sum(1 for a in affixes if a.get("statKey"))
    picker = [a for a in affixes if is_picker_visible(a)]
    hybrids = sum(1 for a in affixes if a.get("extraStats"))
    hybrids_second_resolved = sum(
        1 for a in affixes if a.get("extraStats") and a["extraStats"][0].get("statKey"))
    unnamed = sum(1 for a in affixes if a["name"].lower().startswith("unnamed"))
    picker_missing_slots = sum(1 for a in picker if not a["itemSlots"])

    unique_mods = sum(len(u["affixes"]) for u in uniques)
    unique_mods_resolved = sum(
        1 for u in uniques for m in u["affixes"] if m.get("statKey"))
    bases_with_implicits = sum(1 for b in base_items if b["implicits"])
    implicit_total = sum(len(b["implicits"]) for b in base_items)
    implicit_resolved = sum(
        1 for b in base_items for im in b["implicits"] if im.get("statKey"))

    # Per-item-class implicit deferral (bases whose implicit text did not resolve).
    implicit_deferrals = defaultdict(int)
    for b in base_items:
        for im in b["implicits"]:
            if not im.get("statKey"):
                implicit_deferrals[b["baseType"]] += 1

    stat_key_hist = Counter(a["statKey"] for a in affixes if a.get("statKey"))

    return {
        "generated_by": "generate_item_db.py (Story 4.0)",
        "itemSlots_provenance": "AUTHORED (STAT_SLOT_GROUPS) -- no affix->slot source exists in PoB4LE",
        "inert_stat_keys_excluded": sorted(INERT_STAT_KEYS),
        "inert_stat_keys_note": "Defined StatKey variants no compute/* module consumes; emitted as "
                                "statKey:null so no dead key ships (Source Audit). See INERT_STAT_KEYS.",
        "counts": {
            "affixes_total": total,
            "affixes_statkey_resolved": resolved,
            "affixes_statkey_resolved_pct": round(100.0 * resolved / total, 1) if total else 0.0,
            "picker_visible": len(picker),
            "picker_visible_missing_slots": picker_missing_slots,
            "unnamed_in_picker_visible": sum(
                1 for a in picker if a["name"].lower().startswith("unnamed")),
            "hybrid_affixes": hybrids,
            "hybrid_second_stat_resolved": hybrids_second_resolved,
            "unnamed_affixes": unnamed,
            "unique_mods_total": unique_mods,
            "unique_mods_statkey_resolved": unique_mods_resolved,
            "unique_mods_resolved_pct": round(100.0 * unique_mods_resolved / unique_mods, 1) if unique_mods else 0.0,
            "bases_total": len(base_items),
            "bases_with_implicits": bases_with_implicits,
            "implicit_stats_total": implicit_total,
            "implicit_stats_resolved": implicit_resolved,
        },
        "stat_key_histogram": dict(sorted(stat_key_hist.items(), key=lambda kv: -kv[1])),
        "implicit_deferrals_by_item_class": dict(sorted(implicit_deferrals.items())),
        "unmapped_affixes": unmapped["unmapped_affixes"],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="Directory of cached bases/uniques/moditem json (offline)")
    args = ap.parse_args()
    global SOURCE_CACHE
    if args.source:
        SOURCE_CACHE = Path(args.source)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Loading PoB4LE source...")
    bases_raw = fetch_json("bases", BASES_URL)
    uniques_raw = fetch_json("uniques", UNIQUES_URL)
    moditem_raw = fetch_json("moditem", MODITEM_URL)

    print("Transforming affixes...")
    affixes, meta = transform_affixes(moditem_raw)
    add_roc(affixes)
    print(f"  {len(affixes)} affixes")

    print("Transforming base items (implicits inline)...")
    base_items = transform_bases(bases_raw)
    basetype_map = build_basetype_map(bases_raw)
    print(f"  {len(base_items)} base items")

    print("Transforming uniques (inline mods)...")
    unique_items = transform_uniques(uniques_raw, basetype_map)
    print(f"  {len(unique_items)} uniques")

    manifest = build_manifest(affixes, base_items, unique_items, meta)

    assert len(affixes) >= 1100, f"Need >=1100 affixes, got {len(affixes)}"
    assert len(base_items) >= 660, f"Need >=660 base items, got {len(base_items)}"

    print(f"Writing to {OUT_DIR}...")
    for fname, data in [
        ("affixes.json", affixes),
        ("base-items.json", base_items),
        ("uniques.json", unique_items),
    ]:
        (OUT_DIR / fname).write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "affix-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    c = manifest["counts"]
    print("\nDone.")
    print(f"  affixes            : {c['affixes_total']} "
          f"({c['affixes_statkey_resolved']} statKey = {c['affixes_statkey_resolved_pct']}%)")
    print(f"  picker-visible     : {c['picker_visible']} (missing slots: {c['picker_visible_missing_slots']})")
    print(f"  hybrids            : {c['hybrid_affixes']} "
          f"(2nd stat resolved: {c['hybrid_second_stat_resolved']})")
    print(f"  unique mods        : {c['unique_mods_statkey_resolved']}/{c['unique_mods_total']} "
          f"= {c['unique_mods_resolved_pct']}%")
    print(f"  bases w/ implicits : {c['bases_with_implicits']}/{c['bases_total']} "
          f"({c['implicit_stats_resolved']}/{c['implicit_stats_total']} implicit stats resolved)")


if __name__ == "__main__":
    main()
