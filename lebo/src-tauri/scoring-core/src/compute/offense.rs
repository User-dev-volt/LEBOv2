//! Offense stat computation (damage score, crit, attack/cast speed, AoE).
//! FR-1, FR-2, FR-3, FR-4 land here in Story 1.2.

use crate::modifier::{ModifierRegistry, ModifierType, StatKey};
use crate::stat_sheet::{DamageTypeBreakdown, OffenseStats};

const DAMAGE_STAT_KEYS: &[StatKey] = &[
    StatKey::IncreasedDamage,
    StatKey::IncreasedFireDamage,
    StatKey::IncreasedColdDamage,
    StatKey::IncreasedLightningDamage,
    StatKey::IncreasedVoidDamage,
    StatKey::IncreasedPoisonDamage,
    StatKey::IncreasedPhysicalDamage,
    StatKey::IncreasedNecroticDamage,
    // DoT ailment keys feed the aggregate too — the loader remap moved Bleed/Ignite
    // off the generic/fire keys, so they must stay summed here to keep the aggregate
    // byte-identical to Phase 3.
    StatKey::IncreasedBleedDamage,
    StatKey::IncreasedIgniteDamage,
    StatKey::IncreasedSpellDamage,
    StatKey::IncreasedMeleeDamage,
    StatKey::IncreasedRangedDamage,
    StatKey::IncreasedAreaDamage,
];

/// Per-damage-type breakdown spec: (label, hit key, optional DoT-ailment key).
/// Fixed order — drives the stable `OffenseStats::damage_types` Vec for the UI.
const DAMAGE_TYPES: &[(&str, StatKey, Option<StatKey>)] = &[
    ("physical", StatKey::IncreasedPhysicalDamage, Some(StatKey::IncreasedBleedDamage)),
    ("fire", StatKey::IncreasedFireDamage, Some(StatKey::IncreasedIgniteDamage)),
    ("cold", StatKey::IncreasedColdDamage, None),
    ("lightning", StatKey::IncreasedLightningDamage, None),
    ("void", StatKey::IncreasedVoidDamage, None),
    ("necrotic", StatKey::IncreasedNecroticDamage, None),
    ("poison", StatKey::IncreasedPoisonDamage, None),
];

/// Splits a stat key's active modifiers into (Σ Increased%, Π More multipliers).
/// `product()` on an empty iterator is 1.0, so a type with no More mods reports 1.0.
fn increased_and_more(registry: &ModifierRegistry, active: &[String], key: &StatKey) -> (f64, f64) {
    let mods = registry.query(key, active);
    let increased: f64 = mods
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Increased)
        .map(|m| m.value)
        .sum();
    let more: f64 = mods
        .iter()
        .filter(|m| m.modifier_type == ModifierType::More)
        .map(|m| m.value)
        .product();
    (increased, more)
}

pub(super) fn compute_offense(registry: &ModifierRegistry, active: &[String]) -> OffenseStats {
    // Sum all Increased% modifiers for damage stats
    let total_increased: f64 = DAMAGE_STAT_KEYS
        .iter()
        .flat_map(|key| registry.query(key, active))
        .filter(|m| m.modifier_type == ModifierType::Increased)
        .map(|m| m.value)
        .sum();

    // Multiply all More% multipliers; product() on empty iterator returns 1.0 correctly
    let more_factor: f64 = registry
        .query(&StatKey::MoreDamage, active)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::More)
        .map(|m| m.value)
        .product();

    let base = 100.0_f64;
    let damage_score = (base * (1.0 + total_increased / 100.0) * more_factor).max(0.01);

    // Crit chance: sum of CriticalStrikeChance Flat modifiers / 100, clamped to [0, 1]
    let crit_chance_raw: f64 = registry
        .query(&StatKey::CriticalStrikeChance, active)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Flat)
        .map(|m| m.value)
        .sum::<f64>()
        / 100.0;
    let crit_chance = crit_chance_raw.clamp(0.0, 1.0);

    // Crit multiplier: base 200% + added% → expressed as multiplier (e.g., 3.50)
    let crit_multi_added: f64 = registry
        .query(&StatKey::CriticalStrikeMultiplier, active)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Flat)
        .map(|m| m.value)
        .sum();
    let crit_multi = 2.0 + crit_multi_added / 100.0;

    let avg_hit_damage = damage_score;
    let avg_hit_damage_crit_weighted =
        avg_hit_damage * (crit_multi * crit_chance + 1.0 * (1.0 - crit_chance));

    // Attack/cast speed
    let attack_speed_mods: f64 = registry
        .query(&StatKey::AttackSpeed, active)
        .iter()
        .map(|m| m.value)
        .sum();
    let cast_speed_mods: f64 = registry
        .query(&StatKey::CastSpeed, active)
        .iter()
        .map(|m| m.value)
        .sum();

    let attack_speed = if attack_speed_mods != 0.0 {
        Some(1.0 + attack_speed_mods / 100.0)
    } else {
        None
    };
    let cast_speed = if cast_speed_mods != 0.0 {
        Some(1.0 + cast_speed_mods / 100.0)
    } else {
        None
    };

    let aoe_modifier: f64 = registry
        .query(&StatKey::AreaOfEffect, active)
        .iter()
        .map(|m| m.value)
        .sum::<f64>()
        / 100.0
        + 1.0;

    // Stun chance: sum of Flat StunChance modifiers, clamped to [0, 100] (mirrors the
    // crit-chance pattern). 0 when no modifiers exist.
    let stun_chance: f64 = registry
        .query(&StatKey::StunChance, active)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Flat)
        .map(|m| m.value)
        .sum::<f64>()
        .clamp(0.0, 100.0);

    // Per-type Increased%/More% — computed independently per key so a fire modifier
    // never bleeds into another type's figures (FR-1).
    let damage_types: Vec<DamageTypeBreakdown> = DAMAGE_TYPES
        .iter()
        .map(|(label, hit_key, dot_key)| {
            let (increased, more) = increased_and_more(registry, active, hit_key);
            let (increased_dot, more_dot) = match dot_key {
                Some(key) => {
                    let (inc, mo) = increased_and_more(registry, active, key);
                    (Some(inc), Some(mo))
                }
                None => (None, None),
            };
            DamageTypeBreakdown {
                damage_type: (*label).to_string(),
                increased,
                more,
                increased_dot,
                more_dot,
            }
        })
        .collect();

    OffenseStats {
        damage_score,
        avg_hit_damage,
        avg_hit_damage_crit_weighted,
        critical_strike_chance: crit_chance * 100.0,
        critical_strike_multiplier: crit_multi * 100.0,
        attack_speed,
        cast_speed,
        aoe_modifier,
        stun_chance,
        // Penetration figures and their effect on the scored damage are wired in by the
        // orchestrator (it owns the build's primary-element context); default here.
        elemental_penetration: 0.0,
        physical_penetration: 0.0,
        void_penetration: 0.0,
        damage_types,
        // FR-8 ailment chances (Story 1.5): no shipped Season-4 source — honest 0.0, no dead key.
        // These flow in automatically once a stat_key-bearing affix lands. See OffenseStats docs.
        bleed_chance: 0.0,
        ignite_chance: 0.0,
        poison_chance: 0.0,
        freeze_chance: 0.0,
        shock_chance: 0.0,
        armor_shred_chance: 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modifier::{Condition, Modifier};

    fn registry_with(mods: Vec<(StatKey, ModifierType, f64)>) -> ModifierRegistry {
        let mut registry = ModifierRegistry::new();
        for (stat_key, modifier_type, value) in mods {
            registry.add(Modifier {
                stat_key,
                modifier_type,
                value,
                condition: Condition::Always,
                source: "test".to_string(),
            });
        }
        registry
    }

    fn find<'a>(stats: &'a OffenseStats, label: &str) -> &'a DamageTypeBreakdown {
        stats
            .damage_types
            .iter()
            .find(|d| d.damage_type == label)
            .unwrap_or_else(|| panic!("no breakdown entry for {label}"))
    }

    #[test]
    fn per_type_increased_does_not_bleed_across_types() {
        // Only fire increased present → fire > 0, every other type's increased == 0.
        let registry = registry_with(vec![(
            StatKey::IncreasedFireDamage,
            ModifierType::Increased,
            50.0,
        )]);
        let stats = compute_offense(&registry, &[]);
        assert!((find(&stats, "fire").increased - 50.0).abs() < 1e-9);
        for label in ["physical", "cold", "lightning", "void", "necrotic", "poison"] {
            assert_eq!(
                find(&stats, label).increased,
                0.0,
                "{label} increased should be 0 (no cross-type bleed)"
            );
        }
    }

    #[test]
    fn per_type_more_is_a_multiplier_not_folded_into_increased() {
        // A More-typed fire node yields fire.more as a multiplier; increased stays 0.
        let registry = registry_with(vec![(StatKey::IncreasedFireDamage, ModifierType::More, 1.40)]);
        let stats = compute_offense(&registry, &[]);
        let fire = find(&stats, "fire");
        assert!((fire.more - 1.40).abs() < 1e-9, "fire.more expected 1.40 got {}", fire.more);
        assert_eq!(fire.increased, 0.0, "More must not fold into increased");
    }

    #[test]
    fn type_with_no_modifiers_reports_more_one() {
        // product() on empty → 1.0 multiplier; increased 0.
        let registry = registry_with(vec![]);
        let stats = compute_offense(&registry, &[]);
        let cold = find(&stats, "cold");
        assert_eq!(cold.increased, 0.0);
        assert!((cold.more - 1.0).abs() < 1e-12, "empty More must be 1.0, got {}", cold.more);
        assert!(cold.increased_dot.is_none(), "cold has no DoT variant");
    }

    #[test]
    fn dot_split_lands_under_parent_type() {
        // Bleed → physical DoT; Ignite → fire DoT. Parent hit figures stay untouched.
        let registry = registry_with(vec![
            (StatKey::IncreasedBleedDamage, ModifierType::Increased, 30.0),
            (StatKey::IncreasedIgniteDamage, ModifierType::More, 1.25),
        ]);
        let stats = compute_offense(&registry, &[]);
        let physical = find(&stats, "physical");
        assert_eq!(physical.increased, 0.0, "bleed must not touch physical hit increased");
        assert_eq!(physical.increased_dot, Some(30.0));
        let fire = find(&stats, "fire");
        assert_eq!(fire.increased, 0.0, "ignite must not touch fire hit increased");
        assert_eq!(fire.more_dot, Some(1.25));
    }

    #[test]
    fn necrotic_contributes_to_its_own_type() {
        let registry = registry_with(vec![(
            StatKey::IncreasedNecroticDamage,
            ModifierType::Increased,
            40.0,
        )]);
        let stats = compute_offense(&registry, &[]);
        assert!((find(&stats, "necrotic").increased - 40.0).abs() < 1e-9);
        // Necrotic was historically conflated into poison — prove it no longer bleeds there.
        assert_eq!(find(&stats, "poison").increased, 0.0);
    }

    #[test]
    fn stun_chance_sums_and_clamps() {
        let registry = registry_with(vec![
            (StatKey::StunChance, ModifierType::Flat, 60.0),
            (StatKey::StunChance, ModifierType::Flat, 60.0),
        ]);
        let stats = compute_offense(&registry, &[]);
        assert_eq!(stats.stun_chance, 100.0, "stun chance must clamp to 100");
    }

    #[test]
    fn stun_chance_defaults_to_zero_when_absent() {
        let stats = compute_offense(&registry_with(vec![]), &[]);
        assert_eq!(stats.stun_chance, 0.0);
    }

    #[test]
    fn necrotic_key_contributes_to_aggregate_damage_score() {
        // The remap moved Necrotic onto its own key; it must still feed the aggregate so
        // the generic damage_score total is preserved (Necrotic was previously summed via
        // IncreasedPoisonDamage, both in DAMAGE_STAT_KEYS).
        let registry = registry_with(vec![(
            StatKey::IncreasedNecroticDamage,
            ModifierType::Increased,
            100.0,
        )]);
        let stats = compute_offense(&registry, &[]);
        // base 100 × (1 + 1.0) = 200
        assert!(
            (stats.damage_score - 200.0).abs() < 0.01,
            "necrotic increased must reach the aggregate; got {}",
            stats.damage_score
        );
    }
}
