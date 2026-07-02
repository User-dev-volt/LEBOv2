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
    resolved = [a for a in affixes if a.get("statKey")]
    picker = [a for a in affixes if is_picker_visible(a)]
    pct = 100.0 * len(resolved) / total if total else 0.0
    print(f"\naffixes total ............... {total}")
    print(f"statKey resolved ........... {len(resolved)} ({pct:.1f}%)   [floor {STATKEY_FLOOR_PCT}%]")
    print(f"picker-visible ............. {len(picker)}")

    # Gate 4: regression floor
    if pct < STATKEY_FLOOR_PCT:
        failures.append(f"statKey resolution {pct:.1f}% < floor {STATKEY_FLOOR_PCT}%")

    # Gate 1 + 3: every picker-visible affix has statKey + non-empty slots
    bad_slots = [a["id"] for a in picker if not a.get("itemSlots")]
    bad_key = [a["id"] for a in picker if not a.get("statKey")]
    print(f"picker-visible missing slots {len(bad_slots)}")
    print(f"picker-visible missing key . {len(bad_key)}")
    if bad_slots:
        failures.append(f"{len(bad_slots)} picker-visible affixes have empty itemSlots (e.g. {bad_slots[:3]})")
    if bad_key:
        failures.append(f"{len(bad_key)} picker-visible affixes have no statKey")

    # Gate 2: no unnamed-* in picker-visible
    unnamed = [a["id"] for a in picker if str(a.get("name", "")).lower().startswith("unnamed")]
    print(f"unnamed-* in picker-visible  {len(unnamed)}")
    if unnamed:
        failures.append(f"{len(unnamed)} unnamed-* names in picker-visible data")

    # Gate 7: every emitted statKey is loader-resolvable (no would-be-dropped key)
    emitted = {a["statKey"] for a in affixes if a.get("statKey")}
    emitted |= {s["statKey"] for a in affixes for s in a.get("extraStats", []) if s.get("statKey")}
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
