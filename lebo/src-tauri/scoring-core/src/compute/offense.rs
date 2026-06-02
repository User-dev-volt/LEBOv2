//! Offense stat computation (damage score, crit, attack/cast speed, AoE).
//! FR-1, FR-2, FR-3, FR-4 land here in Story 1.2.

use crate::modifier::{ModifierRegistry, ModifierType, StatKey};
use crate::stat_sheet::OffenseStats;

const DAMAGE_STAT_KEYS: &[StatKey] = &[
    StatKey::IncreasedDamage,
    StatKey::IncreasedFireDamage,
    StatKey::IncreasedColdDamage,
    StatKey::IncreasedLightningDamage,
    StatKey::IncreasedVoidDamage,
    StatKey::IncreasedPoisonDamage,
    StatKey::IncreasedPhysicalDamage,
    StatKey::IncreasedSpellDamage,
    StatKey::IncreasedMeleeDamage,
    StatKey::IncreasedRangedDamage,
    StatKey::IncreasedAreaDamage,
];

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

    OffenseStats {
        damage_score,
        avg_hit_damage,
        avg_hit_damage_crit_weighted,
        critical_strike_chance: crit_chance * 100.0,
        critical_strike_multiplier: crit_multi * 100.0,
        attack_speed,
        cast_speed,
        aoe_modifier,
    }
}
