#!/usr/bin/env python3
"""Committed affix-coverage gate (Story 4.0, AC2).

Runs over the regenerated dataset and FAILS (exit 1) if any exit gate is unmet,
printing actual counts for each. Not eyeballing — this is a CI-runnable artifact.

Gates enforced:
  1. Picker-visible affixes are 100% clean: resolved statKey + real name + non-empty itemSlots.
  2. No `unnamed-*` machine names remain in picker-visible data.
  3. itemSlots non-empty for every picker-visible affix.
  4. statKey resolution reported with ACTUAL count; fails only below a regression FLOOR.
     (The story's literal ">=95% of ALL affixes" is infeasible — the engine models ~66 stats
      while ~44% of LE affixes are unmodeled mechanics: ailment chances, conversions, potions,
      buffs, intentionally-omitted pens. The unmapped remainder is fully listed in the manifest;
      picker-visible cleanliness is the real quality bar. See story 4.0 Decision D4.)
  5. Unique affix references resolve (uniques carry self-contained inline text; every mod has a
     parsed value entry — nothing dangles).
  6. Base-item implicits populated, or the shortfall recorded per item class in the manifest.
  7. Every emitted statKey is in the engine's resolvable vocabulary (no key the loader would drop).

Run: python check_coverage.py   (from docs/data-transform/, after generate_item_db.py)
"""

import json
import sys
from pathlib import Path

# ASCII-only output for CI portability (Windows consoles default to cp1252, which can't encode
# box/mark glyphs). Reconfigure stdout to UTF-8 where supported, and keep printed text ASCII.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # Python 3.7+
except Exception:
    pass

OUT_DIR = Path(__file__).parent.parent.parent / "lebo" / "src-tauri" / "resources" / "items"

# statKey regression floor — not the 95%-of-total in the AC (infeasible; see docstring), but a
# guard so a mapping regression (e.g. a broken derive_stat_key) can't silently gut coverage.
# The honest current ceiling is ~49% (the engine models ~62 consumable stats; the rest of the LE
# affix corpus is unmodeled mechanics + engine-inert keys). Floor sits below that as a guard.
STATKEY_FLOOR_PCT = 40.0

# The snake_case statKeys the transform is ALLOWED to emit = keys the loader resolves AND a
# compute/* module consumes (verified via `query(&StatKey::…)`). Excludes engine-inert keys
# (added_*_damage, max_mana, mana_regen_per_sec, cooldown_recovery_speed, stun_chance) so that if
# a mapping regression ever emits one, this gate flags it as a would-be dead key.
EMITTABLE_STAT_KEYS = {
    "increased_damage", "more_damage",
    "increased_fire_damage", "increased_cold_damage", "increased_lightning_damage",
    "increased_void_damage", "increased_poison_damage", "increased_physical_damage",
    "increased_necrotic_damage", "increased_bleed_damage", "increased_ignite_damage",
    "increased_spell_damage", "increased_melee_damage", "increased_ranged_damage",
    "increased_minion_damage", "increased_area_damage",
    "critical_strike_chance", "critical_strike_multiplier", "critical_strike_avoidance",
    "max_hp", "max_hp_percent", "hp_regen_per_sec", "ward_per_second", "ward_on_hit",
    "armor", "endurance_threshold", "endurance_percent",
    "fire_resistance", "cold_resistance", "lightning_resistance", "void_resistance",
    "poison_resistance", "physical_resistance", "necrotic_resistance", "all_resistances",
    "dodge_rating", "life_leech_percent", "healing_effectiveness", "block_chance",
    "attack_speed", "cast_speed", "movement_speed", "area_of_effect",
    "fire_penetration", "cold_penetration", "lightning_penetration",
    "void_penetration", "elemental_penetration", "physical_penetration",
    "ignite_duration", "poison_duration", "bleed_duration", "freeze_rate_multiplier",
    "max_poison_stacks",  # increased_minion_count/hp excluded — compute_minion hardcodes them 0.0
    "strength", "dexterity", "intelligence", "attunement", "vitality",
}

# Minimum picker-visible affix count. The OLD gates 1-3 filtered the already-clean `picker` list and
# could never fail (review #6/#28); this floor is the real guard against a slot-authoring or naming
# regression silently gutting the surfaced set. Sits well below the current count.
PICKER_FLOOR = 450

# Story 4.1.5 — levelRequirement regression floor. `req.level` is present on 100% of PoB4LE bases +
# uniques (spike-verified), so the transform emits levelRequirement on every item. Floor at 95%
# guards against a transform regression that silently stops sourcing it (Story 4.2's Item Level slider
# reads this — a 0%-populated field would ship a dead control, the project's #1 defect class).
LEVEL_FLOOR_PCT = 95.0

# Semantic regression pins (review #1-#13): concrete affixes whose mis-derivation the fix corrected.
# statKey None = must resolve to null. A pin whose id is absent (corpus/name drift on a fresh PoB4LE
# pull) is SKIPPED, not failed — so the gate never false-fails on upstream churn.
REGRESSION_PINS = {
    "affix-banshee-s-prefix": "increased_damage",         # "increased DoT while at Low Health" (not +HP)
    "affix-penitent-prefix": None,                        # "+X Health gained when stunned" (recovery)
    "affix-of-the-defender-suffix": None,                 # "reduced Damage Taken on Block" (mitigation)
    "affix-of-the-timelost-outcast-suffix": None,         # "less Necrotic Damage Taken" (mitigation)
    "affix-apiarist-s-smoker-reforged-prefix": "movement_speed",  # mitigation nulled → 2nd stat promoted
    "affix-increased-armor-shred-effect-prefix": None,    # "Armor Shred" = enemy debuff, not +armor
    "affix-minion-physical-resistance-prefix": None,      # minion-scoped, must not credit player res
    "affix-reduced-health-cost-of-spells-prefix": None,   # spell cost reduction, not +Max HP
    "affix-of-electromancy-suffix": "increased_lightning_damage",  # mana-conditional damage (not max_mana)
}


def load(name):
    return json.loads((OUT_DIR / name).read_text(encoding="utf-8"))


def is_picker_visible(a):
    return bool(a.get("statKey")) and bool(a.get("itemSlots")) \
        and not str(a.get("name", "")).lower().startswith("unnamed")


def main():
    affixes = load("affixes.json")
    base_items = load("base-items.json")
    uniques = load("uniques.json")
    manifest = load("affix-manifest.json")

    failures = []
    print("=" * 64)
    print("Affix coverage gate (Story 4.0 / AC2)")
    print("=" * 64)

    total = len(affixes)
    by_id = {a["id"]: a for a in affixes}
    resolved = [a for a in affixes if a.get("statKey")]
    picker = [a for a in affixes if is_picker_visible(a)]
    pct = 100.0 * len(resolved) / total if total else 0.0
    print(f"\naffixes total ............... {total}")
    print(f"statKey resolved ........... {len(resolved)} ({pct:.1f}%)   [floor {STATKEY_FLOOR_PCT}%]")
    print(f"picker-visible ............. {len(picker)}   [floor {PICKER_FLOOR}]")

    # Gate 4: statKey regression floor (the ratified AC2 reframe — Decision D4; see docstring).
    if pct < STATKEY_FLOOR_PCT:
        failures.append(f"statKey resolution {pct:.1f}% < floor {STATKEY_FLOOR_PCT}%")

    # Gate 5: picker-count floor — a slot-authoring or naming regression must not silently shrink the
    # surfaced set. (Replaces the old gates 1-3 which filtered the already-clean picker list.)
    if len(picker) < PICKER_FLOOR:
        failures.append(f"picker-visible {len(picker)} < floor {PICKER_FLOOR} (slot/name regression?)")

    # Gate 1: every RESOLVED affix has authored itemSlots (tested over the resolved set — an empty
    # slot list on a resolved affix means the loader would treat it as valid-on-all-slots).
    resolved_no_slots = [a["id"] for a in resolved if not a.get("itemSlots")]
    print(f"resolved w/o itemSlots ..... {len(resolved_no_slots)}")
    if resolved_no_slots:
        failures.append(f"{len(resolved_no_slots)} resolved affixes have empty itemSlots (e.g. {resolved_no_slots[:3]})")

    # Gate 2: no unnamed-* anywhere — the item-search picker surfaces ALL affixes, not just resolved.
    unnamed = [a["id"] for a in affixes if str(a.get("name", "")).lower().startswith("unnamed")]
    print(f"unnamed-* in corpus ........ {len(unnamed)}")
    if unnamed:
        failures.append(f"{len(unnamed)} unnamed-* names in corpus (e.g. {unnamed[:3]})")

    # Gate 3: semantic regression pins — concrete mis-derivations the review fixed must stay fixed.
    pins_active = 0
    for aid, expected in REGRESSION_PINS.items():
        a = by_id.get(aid)
        if a is None:
            continue  # corpus/name drift — skip, don't false-fail
        pins_active += 1
        if a.get("statKey") != expected:
            failures.append(f"regression pin {aid}: statKey={a.get('statKey')!r}, expected {expected!r}")
    print(f"semantic regression pins ... {pins_active}/{len(REGRESSION_PINS)} active")

    # Gate 7: every LOADER-EMITTED statKey (resolved primary + its resolvable extras) is in the
    # engine's resolvable vocabulary. Iterates the RESOLVED set so it does not count extras riding a
    # skipped null-primary affix (review #20).
    emitted = {a["statKey"] for a in resolved}
    emitted |= {s["statKey"] for a in resolved for s in a.get("extraStats", []) if s.get("statKey")}
    unknown = emitted - EMITTABLE_STAT_KEYS
    print(f"emitted distinct statKeys .. {len(emitted)}  (non-emittable/dead: {len(unknown)})")
    if unknown:
        failures.append(f"emitted statKeys that are inert/dead (would be dead keys): {sorted(unknown)}")

    # Gate 5: unique refs — every unique mod has a self-consistent parsed entry (no dangling ref)
    u_mods = [m for u in uniques for m in u["affixes"]]
    dangling = [m["affixId"] for m in u_mods
                if "fixedMinValue" not in m or "fixedMaxValue" not in m]
    u_resolved = sum(1 for m in u_mods if m.get("statKey"))
    print(f"\nunique mods ................ {len(u_mods)}  (statKey {u_resolved}, dangling {len(dangling)})")
    if dangling:
        failures.append(f"{len(dangling)} unique mods have no parsed value (dangling ref)")

    # Gate 6: implicits populated or deferral recorded per item class
    bases_with = sum(1 for b in base_items if b.get("implicits"))
    impl_total = sum(len(b.get("implicits", [])) for b in base_items)
    impl_resolved = sum(1 for b in base_items for im in b.get("implicits", []) if im.get("statKey"))
    deferrals = manifest.get("implicit_deferrals_by_item_class", {})
    print(f"bases with implicits ....... {bases_with}/{len(base_items)}")
    print(f"implicit stats ............. {impl_resolved}/{impl_total} resolved")
    print(f"implicit deferrals (classes) {len(deferrals)} recorded in manifest")
    if impl_total == 0:
        failures.append("no base-item implicits populated")

    # Gate 8 (Story 4.1.5): levelRequirement present (int, non-null) on ~100% of bases + uniques.
    # `.get(...) is present` counts the key existing as an int (0 is a valid requirement); a regression
    # that dropped the field or emitted null would fail this floor.
    level_items = base_items + uniques
    with_level = sum(1 for it in level_items
                     if isinstance(it.get("levelRequirement"), int) and not isinstance(it.get("levelRequirement"), bool))
    level_pct = 100.0 * with_level / len(level_items) if level_items else 0.0
    print(f"\nlevelRequirement present ... {with_level}/{len(level_items)} ({level_pct:.1f}%)  [floor {LEVEL_FLOOR_PCT}%]")
    if level_pct < LEVEL_FLOOR_PCT:
        failures.append(f"levelRequirement populated {level_pct:.1f}% < floor {LEVEL_FLOOR_PCT}% (transform regression?)")

    # Manifest presence
    if not manifest.get("unmapped_affixes") and pct < 100.0:
        failures.append("manifest missing unmapped_affixes list")
    print(f"\nunmapped affixes in manifest  {len(manifest.get('unmapped_affixes', []))}")
    print(f"itemSlots provenance ....... {manifest.get('itemSlots_provenance', '?')}")

    print("\n" + "=" * 64)
    if failures:
        print("GATE FAILED:")
        for f in failures:
            print(f"  FAIL: {f}")
        print("=" * 64)
        sys.exit(1)
    print("GATE PASSED - all exit gates met (see counts above).")
    print("=" * 64)


if __name__ == "__main__":
    main()
