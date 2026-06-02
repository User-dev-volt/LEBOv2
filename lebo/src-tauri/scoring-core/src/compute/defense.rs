//! Defensive stat computation (HP, ward, endurance, resistances, defensive layers)
//! and the defensive floor-check warnings. FR-5 lands here in Story 1.3.

use crate::build_snapshot::BuildSnapshot;
use crate::game_data::GameData;
use crate::modifier::{ModifierRegistry, ModifierType, StatKey};
use crate::stat_sheet::{DefenseStats, StatWarning};

const RESISTANCE_CAP: f64 = 75.0;
const CRIT_AVOIDANCE_FLOOR: f64 = 80.0;
const HP_REGEN_SUSTAIN_THRESHOLD: f64 = 100.0;
const MAX_SUFFIXES_PER_SLOT: usize = 2;

pub(super) fn compute_defense(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    registry: &ModifierRegistry,
    active: &[String],
) -> DefenseStats {
    // Base HP from class or fallback
    let (base_hp, hp_per_level) = game_data
        .class_base_stats
        .get(&snapshot.class_id)
        .map(|s| (s.base_hp, s.hp_per_level))
        .unwrap_or((100.0, 5.0));

    let level = snapshot.character_level.max(1) as f64;
    let flat_hp: f64 = registry
        .query(&StatKey::MaxHp, active)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Flat)
        .map(|m| m.value)
        .sum();

    let hp_percent: f64 = registry
        .query(&StatKey::MaxHpPercent, active)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Increased)
        .map(|m| m.value)
        .sum();

    let class_hp = base_hp + (level - 1.0) * hp_per_level;
    let raw_hp = class_hp + flat_hp + class_hp * hp_percent / 100.0;

    // Ward
    let ward: f64 = registry
        .query(&StatKey::WardPerSecond, active)
        .iter()
        .map(|m| m.value)
        .sum::<f64>()
        + registry
            .query(&StatKey::WardOnHit, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>();

    // Endurance
    let endurance_pct_raw: f64 = registry
        .query(&StatKey::EndurancePercent, active)
        .iter()
        .map(|m| m.value)
        .sum::<f64>()
        / 100.0;
    let endurance_pct = endurance_pct_raw.clamp(0.0, 0.9);

    // Effective HP
    let ward_ratio = if raw_hp > 0.0 { ward / raw_hp } else { 0.0 };
    let mut effective_hp = raw_hp * (1.0 + ward_ratio) * (1.0 / (1.0 - endurance_pct));

    // Resistances
    let all_res: f64 = registry
        .query(&StatKey::AllResistances, active)
        .iter()
        .map(|m| m.value)
        .sum();
    let fire_res: f64 = all_res
        + registry
            .query(&StatKey::FireResistance, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>();
    let cold_res: f64 = all_res
        + registry
            .query(&StatKey::ColdResistance, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>();
    let lightning_res: f64 = all_res
        + registry
            .query(&StatKey::LightningResistance, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>();
    let void_res: f64 = all_res
        + registry
            .query(&StatKey::VoidResistance, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>();
    let poison_res: f64 = all_res
        + registry
            .query(&StatKey::PoisonResistance, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>();
    let physical_res: f64 = all_res
        + registry
            .query(&StatKey::PhysicalResistance, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>();

    // Crit avoidance (as percentage 0–100)
    let crit_avoidance: f64 = registry
        .query(&StatKey::CriticalStrikeAvoidance, active)
        .iter()
        .map(|m| m.value)
        .sum();

    // Life leech and regen for sustain layer
    let life_leech: f64 = registry
        .query(&StatKey::LifeLeechPercent, active)
        .iter()
        .map(|m| m.value)
        .sum();
    let hp_regen: f64 = registry
        .query(&StatKey::HpRegenPerSec, active)
        .iter()
        .map(|m| m.value)
        .sum();
    // Armor and dodge
    let armor: f64 = registry
        .query(&StatKey::Armor, active)
        .iter()
        .map(|m| m.value)
        .sum();
    let dodge_chance: f64 = registry
        .query(&StatKey::DodgeRating, active)
        .iter()
        .map(|m| m.value)
        .sum();
    let endurance_threshold: f64 = registry
        .query(&StatKey::EnduranceThreshold, active)
        .iter()
        .map(|m| m.value)
        .sum();

    // Defensive layers
    let mut layer_count: u32 = 0;
    if endurance_pct > 0.0 {
        layer_count += 1;
    }
    if ward > 0.0 {
        layer_count += 1;
    }
    if fire_res >= 75.0
        && cold_res >= 75.0
        && lightning_res >= 75.0
        && void_res >= 75.0
        && poison_res >= 75.0
        && physical_res >= 75.0
    {
        layer_count += 1;
    }
    if crit_avoidance >= 80.0 {
        layer_count += 1;
    }
    // Sustain layer: leech or regen only; ward_per_sec is already captured by the ward layer
    if life_leech > 0.0 || hp_regen >= 100.0 {
        layer_count += 1;
    }
    if layer_count > 2 {
        effective_hp *= 1.05_f64.powi((layer_count - 2) as i32);
    }

    DefenseStats {
        effective_hp,
        raw_hp,
        ward,
        endurance_percent: endurance_pct * 100.0,
        endurance_threshold,
        armor,
        fire_resistance: fire_res,
        cold_resistance: cold_res,
        lightning_resistance: lightning_res,
        void_resistance: void_res,
        poison_resistance: poison_res,
        physical_resistance: physical_res,
        crit_avoidance,
        dodge_chance,
        life_leech_percent: life_leech,
        hp_regen_per_sec: hp_regen,
    }
}

pub(super) fn run_floor_check(defense: &DefenseStats, snapshot: &BuildSnapshot) -> Vec<StatWarning> {
    let mut warnings = Vec::new();

    let resistance_checks = [
        ("fire_resistance_uncapped", defense.fire_resistance),
        ("cold_resistance_uncapped", defense.cold_resistance),
        ("lightning_resistance_uncapped", defense.lightning_resistance),
        ("void_resistance_uncapped", defense.void_resistance),
        ("poison_resistance_uncapped", defense.poison_resistance),
        ("physical_resistance_uncapped", defense.physical_resistance),
    ];
    for (warning_type, current_value) in resistance_checks {
        if current_value < RESISTANCE_CAP {
            let gap = RESISTANCE_CAP - current_value;
            let suggested_fix = find_slot_with_open_suffix(snapshot)
                .map(|slot| format!("{} has room for a Resistance suffix", slot));
            warnings.push(StatWarning {
                warning_type: warning_type.to_string(),
                current_value,
                gap,
                suggested_fix,
            });
        }
    }

    if defense.crit_avoidance < CRIT_AVOIDANCE_FLOOR {
        warnings.push(StatWarning {
            warning_type: "crit_avoidance_low".to_string(),
            current_value: defense.crit_avoidance,
            gap: CRIT_AVOIDANCE_FLOOR - defense.crit_avoidance,
            suggested_fix: None,
        });
    }

    let has_sustain = defense.ward > 0.0
        || defense.life_leech_percent > 0.0
        || defense.hp_regen_per_sec >= HP_REGEN_SUSTAIN_THRESHOLD;
    if !has_sustain {
        warnings.push(StatWarning {
            warning_type: "no_sustain_layer".to_string(),
            current_value: 0.0,
            gap: 0.0,
            suggested_fix: Some(
                "Add Life Leech, Ward generation, or Life Regeneration \u{2265} 100/s".to_string(),
            ),
        });
    }

    warnings
}

/// Finds the first gear slot with fewer than `MAX_SUFFIXES_PER_SLOT` suffixes.
/// Preference order: helm → chest → gloves → boots → belt → amulet → ring_1 → ring_2.
/// Falls back to "helm" if no snapshot gear data is present.
fn find_slot_with_open_suffix(snapshot: &BuildSnapshot) -> Option<String> {
    const PRIORITY: &[&str] = &[
        "helm", "chest", "gloves", "boots", "belt", "amulet", "ring_1", "ring_2",
    ];
    for slot_id in PRIORITY {
        match snapshot.gear_slots.get(*slot_id) {
            Some(slot) if slot.suffixes.len() < MAX_SUFFIXES_PER_SLOT => return Some(slot_id.to_string()),
            None => return Some(slot_id.to_string()),
            _ => {}
        }
    }
    Some("helm".to_string())
}
