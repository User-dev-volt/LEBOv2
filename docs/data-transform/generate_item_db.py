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

# StatKeys defined in the engine whose VALUE no shipped gear/idol source feeds (Source Audit;
# memory stun-chance-inert-unowned). Emitting one would ship a dead key that renders a wrong/empty
# number, so the transform emits `statKey: null` for these and records them in the manifest.
# NOTE (review #21): some of these ARE referenced by a compute module (offense.rs sums Flat
# StunChance; minion.rs reads IncreasedMinionCount/Hp as a presence signal) — they are inert because
# no shipped source feeds a *consumed value* (every stun affix is "% increased", offense sums Flat
# only; minion count/hp resolve to hardcoded 0.0), NOT because "no module consumes them."
#   - stun_chance:            StunChance surfaces a field but no source feeds a consumed value.
#   - max_mana / mana_regen:  the engine has no mana computation (MaxMana/ManaRegenPerSec unqueried).
#   - cooldown_recovery_speed: CooldownRecoverySpeed is unqueried.
#   - added_*_damage:         FlatAdded*Damage is unqueried — the damage model tracks % increased,
#                             not flat added base damage. This is a known engine gap, not a 4.0 fix.
INERT_STAT_KEYS = {
    "stun_chance", "max_mana", "mana_regen_per_sec", "cooldown_recovery_speed",
    "added_fire_damage", "added_cold_damage", "added_lightning_damage",
    "added_void_damage", "added_physical_damage",
    "added_poison_damage", "added_necrotic_damage",  # flat added poison/necrotic — same engine gap
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
# " taken" is incoming-mitigation/conversion (defensive) the engine has no gear stat for — nulling
# it stops "less/reduced Damage [Over Time] Taken" from mis-deriving to offensive increased_*_damage
# (review #3/#5). The leading space keeps it word-bounded ("damage over time taken", "taken as"),
# and no modeled bonus stat contains the token "taken".
NULL_PHRASES = (
    "before health", "dealt to mana", " taken", "converted to", "no ward", "chance to",
    "of damage dealt", "damage leeched", "reflect", "per second while", "while channelling",
    "second delay", "increased effect of", "of missing", "of current",
)

# Descriptor fragments that mean a "…health…" phrase is NOT the Maximum-Health pool: recovery
# (heal on kill/hit/block/potion/glancing), cost reduction, conditional ("while at low health"),
# per-scaling, or a conversion to another stat. When any appears, the health branch falls through
# so the real stat (e.g. conditional "increased Spell Damage while at Low Health") is derived, and
# pure recovery/cost text resolves to null instead of phantom +Max HP (review #1/#2/#4/#8).
HEALTH_NOT_POOL = (
    "gain", "gained", "leech", "cost", "while ", "when ", "as endurance",
    "on kill", "on block", "on hit", "on potion", "on glancing", "on melee",
    "per ", "missing", "current", "regen",
)

# Keys that legitimately carry a damageType element (offense/penetration). damageType on anything
# else (resistances, crit, cast-speed) is a spurious offense element-filter tag (review #24), so
# stat_from_text only emits damageType for these.
DAMAGE_ELEMENT_KEYS = {
    "increased_fire_damage", "increased_cold_damage", "increased_lightning_damage",
    "increased_void_damage", "increased_poison_damage", "increased_physical_damage",
    "increased_necrotic_damage", "increased_bleed_damage", "increased_ignite_damage",
    "added_fire_damage", "added_cold_damage", "added_lightning_damage", "added_void_damage",
    "added_physical_damage", "added_poison_damage", "added_necrotic_damage",
    "fire_penetration", "cold_penetration", "lightning_penetration", "void_penetration",
    "elemental_penetration", "physical_penetration",
}


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


def value_sign(text: str) -> float:
    """-1 for a "reduced"/"less" penalty (parse_range only ever yields a positive magnitude), else +1.
    A downside must be stored as a negative value so the engine scores it as a penalty, not a bonus
    (review #3/#23). "damage taken" mitigation is nulled upstream, so it never reaches here."""
    t = f" {clean_text(text).lower()} "
    return -1.0 if ("reduced" in t or " less " in t) else 1.0


def signed_range(text: str) -> tuple[float, float]:
    """parse_range with the reduced/less sign applied, returned low<=high."""
    mn, mx = parse_range(text)
    a, b = mn * value_sign(text), mx * value_sign(text)
    return (a, b) if a <= b else (b, a)


def derive_modifier_type(text: str) -> str:
    t = clean_text(text).lower()
    # "% more X" is a real multiplier, but "300 or more mana" / "more than" are conditional clauses,
    # not a more-modifier — don't let them mis-type a % increased affix as a ×multiplier (review #30).
    if " more " in f" {t} " and "or more" not in t and "more than" not in t:
        return "more"
    if "converted" in t or "->" in t:
        return "conversion"
    # "reduced"/"less" are additive-inverse penalties: same modifierType as the buff, negative value
    # (value_sign). Treating them as their own signed "increased"/"flat" keeps sign correct for the
    # engine's additive stacking (a single "% less" == 1 - x/100, exact for one modifier).
    if "increased" in t or "reduced" in t or " less " in f" {t} ":
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

    # Minion FIRST — scope isolation (review #9). build_registry applies gear modifiers with
    # Condition::Always and never consults scope, so a minion-scoped stat that falls through to a
    # player branch (resistance/crit/armor) is credited to the PLAYER. Only increased_minion_damage
    # is engine-consumed; minion hp/count are inert and minion resist/crit/speed are unmodeled → null.
    if is_minion:
        return "increased_minion_damage" if "damage" in t else None

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
    # Attributes. "per point of Strength" / "per Intelligence" are SCALING clauses, not attribute
    # bonuses — skip when "per " is present so they don't ship a phantom flat attribute (review #10/#13).
    if "per " not in t:
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
    # Ward. Only sustained/generation ward is modeled as ward_per_second; conditional trigger ward
    # ("Ward gained when you cast/use X", panic ward at low health) is NOT continuous — null it rather
    # than over-value it as permanent per-second ward (review #31).
    if "ward" in t:
        if "on hit" in t:
            return "ward_on_hit"
        if "per second" in t or "regen" in t or "generation" in t:
            return "ward_per_second"
        return None  # conditional/trigger ward + retention/decay not modeled
    # Health / regen
    if "health regen" in t or "health regeneration" in t or "life regen" in t:
        return "hp_regen_per_sec"
    # Maximum-Health pool ONLY — recovery ("Health Gain on Kill"), cost ("Reduced Health Cost"),
    # conditional ("… while at Low Health"), per-scaling, and conversions are NOT the HP pool; the
    # HEALTH_NOT_POOL guard lets those fall through (conditional-damage → its real damage key below;
    # recovery/cost → null) instead of shipping phantom +Max HP (review #1/#2/#4/#8).
    if ("health" in t or t.strip() in ("life", "hp")) and not is_minion \
            and not any(x in t for x in HEALTH_NOT_POOL):
        return "max_hp_percent" if modifier_type == "increased" else "max_hp"
    # Mana. "increased Fire Damage … doubled if 300+ Mana" is a damage affix, not a mana affix — only
    # treat mana as the subject when there is no damage clause (review #27). (max_mana is inert anyway.)
    if "mana regen" in t or "mana regeneration" in t:
        return "mana_regen_per_sec"
    if "mana" in t and "damage" not in t:
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
    # Armor. "Armor Shred" reduces the ENEMY's armor (offensive ailment), not the wearer's — exclude
    # it (review #12/#26). Minion armor already excluded by the minion-first return above.
    if ("armor" in t or "armour" in t) and "shred" not in t:
        return "armor"
    # Damage (element / delivery / generic) — last, most general
    if "damage" in t:
        flat = modifier_type == "flat"
        for el in ("fire", "cold", "lightning", "void", "physical", "poison", "necrotic"):
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
        # damageType only on real damage/penetration keys — a resistance/crit/speed affix must not
        # carry an element tag (it becomes a spurious offense element-filter in gear.rs) (review #24).
        "damageType": derive_damage_type(text) if key in DAMAGE_ELEMENT_KEYS else None,
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

def tiers_from_field(rows: list, field: str) -> list:
    """Per-tier [{tier,minValue,maxValue}] for a ModItem stat field, sign applied (reduced/less)."""
    out = []
    for e in rows:
        mn, mx = signed_range(e.get(field, ""))
        out.append({"tier": e.get("tier", 0) + 1, "minValue": mn, "maxValue": mx})
    return out


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
        primary_tiers = tiers_from_field(rows, "1")

        # Hybrid second stat — derive from the FIRST row that actually carries field "2" (a ragged
        # hybrid must not lose its second stat just because the lowest tier lacks it) (review #33).
        sec = None
        sec_row = next((e for e in rows if clean_text(e.get("2", ""))), None)
        if sec_row is not None:
            sec = stat_from_text(sec_row.get("2", ""))

        # DN-3 promotion (review #25): when the PRIMARY stat is unmodeled ("+1 to [Skill]",
        # "+1 Potion Slots") but the hybrid SECOND stat IS engine-consumed ("+40% Spell Damage"),
        # promote the second stat to primary — the affix then contributes its real stat and gets
        # authored itemSlots, instead of the whole affix being skipped and its modeled stat dropped.
        if primary["statKey"] is None and sec is not None and sec["statKey"] is not None:
            primary, primary_tiers, sec = sec, tiers_from_field(rows, "2"), None

        # Emit the second stat as extraStats ONLY when it resolves (a null clause is not a dead extra;
        # this also keeps the manifest's hybrid_second_stat count loader-accurate) (review #20).
        extra_stats = []
        if sec is not None and sec["statKey"] is not None:
            extra_stats.append({
                "statKey": sec["statKey"],
                "modifierType": sec["modifierType"],
                "scope": sec["scope"],
                "damageType": sec["damageType"],
                "tiers": tiers_from_field(rows, "2"),
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
            "tiers": primary_tiers,
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
            mn, mx = signed_range(text)
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
            "levelRequirement": (entry.get("req") or {}).get("level") or 0,
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
            mn, mx = signed_range(mod_text)
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
            "levelRequirement": (entry.get("req") or {}).get("level") or 0,
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
        "inert_stat_keys_note": "StatKey variants no shipped source feeds a CONSUMED value. Some ARE "
                                "referenced by a compute module (offense.rs sums Flat StunChance; "
                                "minion.rs reads minion count/hp as a presence signal) but no gear/idol "
                                "source produces a value they consume (every stun affix is % increased, "
                                "offense sums Flat only; minion count/hp resolve to hardcoded 0.0). "
                                "Emitted as statKey:null so no dead key ships (Source Audit).",
        "unique_implicit_coverage_note": "unique_mods_* and implicit_stats_* counts describe PRODUCED "
                                "statKeys only. The scoring engine consumes gear_affixes (from affixes.json) "
                                "exclusively; uniques are seeded via build_seeded_unique_items and base "
                                "implicits are unconsumed. These are re-derived and gated when a future "
                                "story wires them into scoring (review deferred item #32).",
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
