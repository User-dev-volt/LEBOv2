use crate::build_snapshot::BuildSnapshot;
use crate::compute_options::ComputeOptions;
use crate::game_data::{ArchetypeWeights, GameData};
use crate::modifier::{Condition, Modifier, ModifierRegistry, ModifierType, StatKey};
use crate::stat_sheet::{DefenseStats, OffenseStats, ScoreComponents, StatSheet, StatWarning};

pub fn compute_stats(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    _options: ComputeOptions,
) -> StatSheet {
    let registry = build_registry(snapshot, game_data);
    let active = snapshot.active_conditions.as_slice();
    let offense = compute_offense(&registry, active);
    let defense = compute_defense(snapshot, game_data, &registry, active);
    let speed = compute_speed(&registry, active);
    let weights = resolve_archetype_weights(snapshot.slider_position, game_data);
    let scores = ScoreComponents {
        damage_score: offense.damage_score,
        survivability_score: defense.effective_hp,
        speed_score: speed,
        build_score: weights.w_dmg * offense.damage_score
            + weights.w_surv * defense.effective_hp
            + weights.w_speed * speed,
    };
    let warnings = run_floor_check(&defense, snapshot);
    StatSheet {
        offense,
        defense,
        scores,
        ailment: None,
        minion: None,
        warnings,
    }
}

pub(crate) fn build_registry(snapshot: &BuildSnapshot, game_data: &GameData) -> ModifierRegistry {
    let mut registry = ModifierRegistry::new();
    for (node_id, &point_count) in &snapshot.node_allocations {
        if let Some(effects) = game_data.node_effects.get(node_id) {
            for effect in effects {
                for _ in 0..point_count {
                    registry.add(Modifier {
                        stat_key: effect.stat_key.clone(),
                        modifier_type: effect.modifier_type.clone(),
                        value: effect.value,
                        condition: effect.condition.clone(),
                        source: node_id.clone(),
                    });
                }
            }
        }
        // Unknown node_id (not in game_data) → silently skipped; no panic (FR-A6)
    }

    // Idol affix modifiers — each placed idol's prefix and suffix contribute stat modifiers
    for placement in &snapshot.idol_placements {
        for opt_entry in [&placement.prefix, &placement.suffix] {
            let Some(entry) = opt_entry else { continue };
            let Some(effect) = game_data.idol_affixes.get(&entry.affix_id) else { continue };
            let Some(&value) = effect.values_by_tier.get(&entry.tier) else { continue };
            registry.add(Modifier {
                stat_key: effect.stat_key.clone(),
                modifier_type: effect.modifier_type.clone(),
                value,
                condition: Condition::Always,
                source: entry.affix_id.clone(),
            });
        }
    }

    // Blessing modifiers — each active blessing contributes its stat effects
    for blessing_id in &snapshot.blessings {
        if let Some(effects) = game_data.blessing_effects.get(blessing_id) {
            for effect in effects {
                registry.add(Modifier {
                    stat_key: effect.stat_key.clone(),
                    modifier_type: effect.modifier_type.clone(),
                    value: effect.value,
                    condition: Condition::Always,
                    source: blessing_id.clone(),
                });
            }
        }
        // Unknown blessing_id → silently skipped
    }

    // Gear slot affix modifiers — each slot's prefix and suffix entries contribute stat modifiers
    // via game_data.gear_affixes lookup. Unknown affix IDs are silently skipped (FR-A6 pattern).
    for (slot_id, slot) in &snapshot.gear_slots {
        for entry in slot.prefixes.iter().chain(slot.suffixes.iter()) {
            let Some(effect) = game_data.gear_affixes.get(&entry.affix_id) else { continue };
            let Some(&value) = effect.values_by_tier.get(&entry.tier) else { continue };
            registry.add(Modifier {
                stat_key: effect.stat_key.clone(),
                modifier_type: effect.modifier_type.clone(),
                value,
                condition: Condition::Always,
                source: format!("{}:{}", slot_id, entry.affix_id),
            });
        }
    }

    registry
}

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

fn compute_offense(registry: &ModifierRegistry, active: &[String]) -> OffenseStats {
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

fn compute_defense(
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

fn compute_speed(registry: &ModifierRegistry, active: &[String]) -> f64 {
    let move_speed = 1.0
        + registry
            .query(&StatKey::MovementSpeed, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>()
            / 100.0;
    let atk_speed = 1.0
        + registry
            .query(&StatKey::AttackSpeed, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>()
            / 100.0;
    let aoe = 1.0
        + registry
            .query(&StatKey::AreaOfEffect, active)
            .iter()
            .map(|m| m.value)
            .sum::<f64>()
            / 100.0;
    move_speed * atk_speed * aoe
}

const RESISTANCE_CAP: f64 = 75.0;
const CRIT_AVOIDANCE_FLOOR: f64 = 80.0;
const HP_REGEN_SUSTAIN_THRESHOLD: f64 = 100.0;
const MAX_SUFFIXES_PER_SLOT: usize = 2;

fn run_floor_check(defense: &DefenseStats, snapshot: &BuildSnapshot) -> Vec<StatWarning> {
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

fn resolve_archetype_weights(slider_position: u32, game_data: &GameData) -> ArchetypeWeights {
    for entry in &game_data.archetype_weights {
        if slider_position <= entry.slider_upper {
            return entry.weights.clone();
        }
    }
    // Fallback: balanced weights if table is empty or slider > all upper bounds
    ArchetypeWeights {
        w_dmg: 0.55,
        w_surv: 0.35,
        w_speed: 0.10,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_snapshot::{AffixEntry, IdolPlacement};
    use crate::game_data::{ArchetypeWeightsEntry, BaseClassStats, IdolAffixEffect, NodeEffect};
    use crate::modifier::Condition;
    use std::collections::HashMap;

    fn standard_weight_table() -> Vec<ArchetypeWeightsEntry> {
        vec![
            ArchetypeWeightsEntry {
                slider_upper: 24,
                weights: ArchetypeWeights { w_dmg: 0.75, w_surv: 0.20, w_speed: 0.05 },
            },
            ArchetypeWeightsEntry {
                slider_upper: 49,
                weights: ArchetypeWeights { w_dmg: 0.65, w_surv: 0.28, w_speed: 0.07 },
            },
            ArchetypeWeightsEntry {
                slider_upper: 74,
                weights: ArchetypeWeights { w_dmg: 0.55, w_surv: 0.35, w_speed: 0.10 },
            },
            ArchetypeWeightsEntry {
                slider_upper: 89,
                weights: ArchetypeWeights { w_dmg: 0.40, w_surv: 0.50, w_speed: 0.10 },
            },
            ArchetypeWeightsEntry {
                slider_upper: 100,
                weights: ArchetypeWeights { w_dmg: 0.25, w_surv: 0.65, w_speed: 0.10 },
            },
        ]
    }

    fn make_game_data_with_effects(
        node_effects: HashMap<String, Vec<NodeEffect>>,
    ) -> GameData {
        GameData {
            node_effects,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        }
    }

    fn snapshot_at(slider: u32) -> BuildSnapshot {
        let mut s = BuildSnapshot::default();
        s.slider_position = slider;
        s
    }

    // --- Damage formula tests ---

    #[test]
    fn damage_score_increased_only() {
        // 150% increased damage → score = base(100) × (1 + 1.50) × 1.0 = 250
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "node_a".to_string(),
            vec![
                NodeEffect {
                    stat_key: StatKey::IncreasedDamage,
                    modifier_type: ModifierType::Increased,
                    value: 75.0,
                    condition: Condition::Always,
                },
                NodeEffect {
                    stat_key: StatKey::IncreasedDamage,
                    modifier_type: ModifierType::Increased,
                    value: 75.0,
                    condition: Condition::Always,
                },
            ],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("node_a".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 100.0 * (1.0 + 1.50) * 1.0;
        assert!(
            (sheet.offense.damage_score - expected).abs() < 0.01,
            "expected {} got {}",
            expected,
            sheet.offense.damage_score
        );
    }

    #[test]
    fn damage_score_more_multiplier_only() {
        // 0% increased, 1.40 more → score = 100 × 1.0 × 1.40 = 140
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "node_more".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::MoreDamage,
                modifier_type: ModifierType::More,
                value: 1.40,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("node_more".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.offense.damage_score - 140.0).abs() < 0.01,
            "expected 140 got {}",
            sheet.offense.damage_score
        );
    }

    #[test]
    fn damage_score_increased_and_more() {
        // 100% increased + 1.40 more → score = 100 × (1+1.0) × 1.40 = 280
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "node_inc".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 100.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "node_more".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::MoreDamage,
                modifier_type: ModifierType::More,
                value: 1.40,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("node_inc".to_string(), 1);
        snapshot.node_allocations.insert("node_more".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 100.0 * 2.0 * 1.40;
        assert!(
            (sheet.offense.damage_score - expected).abs() < 0.01,
            "expected {} got {}",
            expected,
            sheet.offense.damage_score
        );
    }

    // --- Crit tests ---

    #[test]
    fn crit_weighted_at_82_percent() {
        // crit_chance = 82%, crit_multi = 350% → factor = 3.50×0.82 + 1.0×0.18 = 3.05
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "crit_chance_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::CriticalStrikeChance,
                modifier_type: ModifierType::Flat,
                value: 82.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "crit_multi_node".to_string(),
            vec![NodeEffect {
                // +150% added multi → total = 200 + 150 = 350%
                stat_key: StatKey::CriticalStrikeMultiplier,
                modifier_type: ModifierType::Flat,
                value: 150.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("crit_chance_node".to_string(), 1);
        snapshot.node_allocations.insert("crit_multi_node".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // avg_hit = base 100, crit_weighted = 100 × 3.05 = 305
        assert!(
            (sheet.offense.avg_hit_damage_crit_weighted - 305.0).abs() < 0.5,
            "expected ~305 got {}",
            sheet.offense.avg_hit_damage_crit_weighted
        );
    }

    #[test]
    fn crit_chance_above_100_is_clamped() {
        // 120% crit chance → clamped to 100% → factor = crit_multi (base 200% = 2.0)
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "crit_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::CriticalStrikeChance,
                modifier_type: ModifierType::Flat,
                value: 120.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("crit_node".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // crit_multi = 2.0, crit_chance clamped to 1.0 → crit_weighted = base × 2.0
        let expected = sheet.offense.avg_hit_damage * 2.0;
        assert!(
            (sheet.offense.avg_hit_damage_crit_weighted - expected).abs() < 0.001,
            "expected {} got {}",
            expected,
            sheet.offense.avg_hit_damage_crit_weighted
        );
    }

    // --- EHP tests ---

    #[test]
    fn effective_hp_with_ward_and_endurance() {
        // HP=1500 (base, level 1, hp_per_level=0), Ward=300, Endurance=30% → effective_hp ≈ 2571
        let mut class_base_stats = HashMap::new();
        class_base_stats.insert(
            "sentinel".to_string(),
            BaseClassStats { base_hp: 1500.0, hp_per_level: 0.0 },
        );
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "ward_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::WardPerSecond,
                modifier_type: ModifierType::Flat,
                value: 300.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "endurance_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::EndurancePercent,
                modifier_type: ModifierType::Flat,
                value: 30.0,
                condition: Condition::Always,
            }],
        );
        let game_data = GameData {
            node_effects,
            class_base_stats,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.class_id = "sentinel".to_string();
        snapshot.character_level = 1;
        snapshot.node_allocations.insert("ward_node".to_string(), 1);
        snapshot.node_allocations.insert("endurance_node".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // 1500 × (1 + 300/1500) × (1 / (1 - 0.30)) = 1500 × 1.2 × 1.4286 ≈ 2571.4
        // but layer bonus applies: endurance + ward = 2 layers → no bonus (≤ 2)
        assert!(
            (sheet.defense.effective_hp - 2571.0).abs() < 2.0,
            "expected ~2571 got {}",
            sheet.defense.effective_hp
        );
    }

    #[test]
    fn effective_hp_no_ward_no_endurance() {
        // No ward, no endurance → effective_hp = raw_hp
        let mut class_base_stats = HashMap::new();
        class_base_stats.insert(
            "sentinel".to_string(),
            BaseClassStats { base_hp: 500.0, hp_per_level: 10.0 },
        );
        let game_data = GameData {
            class_base_stats,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.class_id = "sentinel".to_string();
        snapshot.character_level = 11; // raw_hp = 500 + 10×10 = 600

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.defense.effective_hp - sheet.defense.raw_hp).abs() < 0.001,
            "effective_hp should equal raw_hp when no ward/endurance"
        );
        assert!(
            (sheet.defense.raw_hp - 600.0).abs() < 0.001,
            "raw_hp expected 600 got {}",
            sheet.defense.raw_hp
        );
    }

    // --- BuildScore weight tests ---

    #[test]
    fn build_score_slider_0_glass_cannon() {
        let game_data = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let snapshot = snapshot_at(0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 0.75 * sheet.scores.damage_score
            + 0.20 * sheet.scores.survivability_score
            + 0.05 * sheet.scores.speed_score;
        assert!(
            (sheet.scores.build_score - expected).abs() < 0.001,
            "slider=0 expected {} got {}",
            expected,
            sheet.scores.build_score
        );
    }

    #[test]
    fn build_score_slider_25_lean_dps() {
        let game_data = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let snapshot = snapshot_at(25);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 0.65 * sheet.scores.damage_score
            + 0.28 * sheet.scores.survivability_score
            + 0.07 * sheet.scores.speed_score;
        assert!(
            (sheet.scores.build_score - expected).abs() < 0.001,
            "slider=25 expected {} got {}",
            expected,
            sheet.scores.build_score
        );
    }

    #[test]
    fn build_score_slider_50_balanced() {
        // Verify BuildScore = 0.55×D + 0.35×S + 0.10×Sp at slider 50
        let game_data = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let snapshot = snapshot_at(50);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 0.55 * sheet.scores.damage_score
            + 0.35 * sheet.scores.survivability_score
            + 0.10 * sheet.scores.speed_score;
        assert!(
            (sheet.scores.build_score - expected).abs() < 0.001,
            "slider=50 expected {} got {}",
            expected,
            sheet.scores.build_score
        );
    }

    #[test]
    fn build_score_slider_75_lean_tank() {
        let game_data = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let snapshot = snapshot_at(75);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 0.40 * sheet.scores.damage_score
            + 0.50 * sheet.scores.survivability_score
            + 0.10 * sheet.scores.speed_score;
        assert!(
            (sheet.scores.build_score - expected).abs() < 0.001,
            "slider=75 expected {} got {}",
            expected,
            sheet.scores.build_score
        );
    }

    #[test]
    fn build_score_slider_100_juggernaut() {
        let game_data = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let snapshot = snapshot_at(100);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 0.25 * sheet.scores.damage_score
            + 0.65 * sheet.scores.survivability_score
            + 0.10 * sheet.scores.speed_score;
        assert!(
            (sheet.scores.build_score - expected).abs() < 0.001,
            "slider=100 expected {} got {}",
            expected,
            sheet.scores.build_score
        );
    }

    // --- Fallback / edge case tests ---

    #[test]
    fn unknown_node_id_does_not_panic() {
        let game_data = GameData::default();
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("nonexistent_node".to_string(), 3);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // No modifiers → damage_score = base × 1.0 × 1.0 = 100
        assert!(
            (sheet.offense.damage_score - 100.0).abs() < 0.01,
            "expected 100 got {}",
            sheet.offense.damage_score
        );
    }

    #[test]
    fn missing_modifier_type_treated_as_increased() {
        // Verifies compute_stats processes Increased-typed modifiers correctly.
        // AC5 full coverage (JSON missing field → Increased default) is Story 2.4's
        // responsibility: NodeEffect is constructed programmatically here, not deserialized.
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "node_inc".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased, // treated as fallback Increased (FR-A6)
                value: 50.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("node_inc".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // 50% increased → 100 × 1.5 = 150
        assert!(
            (sheet.offense.damage_score - 150.0).abs() < 0.01,
            "expected 150 got {}",
            sheet.offense.damage_score
        );
    }

    // --- Defensive floor check tests ---

    fn make_defense_snapshot_with_res(
        fire: f64,
        cold: f64,
        lightning: f64,
        void_r: f64,
        poison: f64,
        physical: f64,
    ) -> (GameData, BuildSnapshot) {
        let mut node_effects = HashMap::new();
        let mut nodes = vec![];
        if fire != 0.0 {
            nodes.push(NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: fire,
                condition: Condition::Always,
            });
        }
        if cold != 0.0 {
            nodes.push(NodeEffect {
                stat_key: StatKey::ColdResistance,
                modifier_type: ModifierType::Flat,
                value: cold,
                condition: Condition::Always,
            });
        }
        if lightning != 0.0 {
            nodes.push(NodeEffect {
                stat_key: StatKey::LightningResistance,
                modifier_type: ModifierType::Flat,
                value: lightning,
                condition: Condition::Always,
            });
        }
        if void_r != 0.0 {
            nodes.push(NodeEffect {
                stat_key: StatKey::VoidResistance,
                modifier_type: ModifierType::Flat,
                value: void_r,
                condition: Condition::Always,
            });
        }
        if poison != 0.0 {
            nodes.push(NodeEffect {
                stat_key: StatKey::PoisonResistance,
                modifier_type: ModifierType::Flat,
                value: poison,
                condition: Condition::Always,
            });
        }
        if physical != 0.0 {
            nodes.push(NodeEffect {
                stat_key: StatKey::PhysicalResistance,
                modifier_type: ModifierType::Flat,
                value: physical,
                condition: Condition::Always,
            });
        }
        node_effects.insert("res_node".to_string(), nodes);
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("res_node".to_string(), 1);
        (game_data, snapshot)
    }

    #[test]
    fn floor_check_fire_resistance_uncapped() {
        let (game_data, snapshot) =
            make_defense_snapshot_with_res(52.0, 75.0, 75.0, 75.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let fire_warn = sheet
            .warnings
            .iter()
            .find(|w| w.warning_type == "fire_resistance_uncapped");
        assert!(fire_warn.is_some(), "expected fire_resistance_uncapped warning");
        let w = fire_warn.unwrap();
        assert!(
            (w.current_value - 52.0).abs() < 0.1,
            "current_value expected 52 got {}",
            w.current_value
        );
        assert!((w.gap - 23.0).abs() < 0.1, "gap expected 23 got {}", w.gap);
        assert!(w.suggested_fix.is_some(), "suggested_fix should be present");
    }

    #[test]
    fn floor_check_cold_resistance_uncapped() {
        let (game_data, snapshot) =
            make_defense_snapshot_with_res(75.0, 50.0, 75.0, 75.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet
            .warnings
            .iter()
            .any(|w| w.warning_type == "cold_resistance_uncapped"));
    }

    #[test]
    fn floor_check_lightning_resistance_uncapped() {
        let (game_data, snapshot) =
            make_defense_snapshot_with_res(75.0, 75.0, 40.0, 75.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet
            .warnings
            .iter()
            .any(|w| w.warning_type == "lightning_resistance_uncapped"));
    }

    #[test]
    fn floor_check_void_resistance_uncapped() {
        let (game_data, snapshot) =
            make_defense_snapshot_with_res(75.0, 75.0, 75.0, 30.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet
            .warnings
            .iter()
            .any(|w| w.warning_type == "void_resistance_uncapped"));
    }

    #[test]
    fn floor_check_poison_resistance_uncapped() {
        let (game_data, snapshot) =
            make_defense_snapshot_with_res(75.0, 75.0, 75.0, 75.0, 0.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet
            .warnings
            .iter()
            .any(|w| w.warning_type == "poison_resistance_uncapped"));
    }

    #[test]
    fn floor_check_physical_resistance_uncapped() {
        let (game_data, snapshot) =
            make_defense_snapshot_with_res(75.0, 75.0, 75.0, 75.0, 75.0, 0.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet
            .warnings
            .iter()
            .any(|w| w.warning_type == "physical_resistance_uncapped"));
    }

    #[test]
    fn floor_check_crit_avoidance_low() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "avoid_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::CriticalStrikeAvoidance,
                modifier_type: ModifierType::Flat,
                value: 62.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("avoid_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let warn = sheet
            .warnings
            .iter()
            .find(|w| w.warning_type == "crit_avoidance_low");
        assert!(warn.is_some(), "expected crit_avoidance_low warning");
        let w = warn.unwrap();
        assert!((w.current_value - 62.0).abs() < 0.1);
        assert!((w.gap - 18.0).abs() < 0.1);
    }

    #[test]
    fn floor_check_no_sustain_layer() {
        let game_data =
            GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let snapshot = snapshot_at(50);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "expected no_sustain_layer, got: {:?}",
            sheet.warnings.iter().map(|w| &w.warning_type).collect::<Vec<_>>()
        );
    }

    #[test]
    fn floor_check_sustain_via_ward() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "ward_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::WardPerSecond,
                modifier_type: ModifierType::Flat,
                value: 50.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("ward_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            !sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "ward should satisfy sustain layer"
        );
    }

    #[test]
    fn floor_check_sustain_via_life_leech() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "leech_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::LifeLeechPercent,
                modifier_type: ModifierType::Flat,
                value: 2.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("leech_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            !sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "life leech should satisfy sustain layer"
        );
    }

    #[test]
    fn floor_check_sustain_via_hp_regen() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "regen_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::HpRegenPerSec,
                modifier_type: ModifierType::Flat,
                value: 120.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("regen_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            !sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "hp_regen >= 100 should satisfy sustain layer"
        );
    }

    #[test]
    fn floor_check_happy_path_no_warnings() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "all_res_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::AllResistances,
                modifier_type: ModifierType::Flat,
                value: 75.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "avoid_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::CriticalStrikeAvoidance,
                modifier_type: ModifierType::Flat,
                value: 80.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "ward_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::WardPerSecond,
                modifier_type: ModifierType::Flat,
                value: 1.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("all_res_node".to_string(), 1);
        snapshot.node_allocations.insert("avoid_node".to_string(), 1);
        snapshot.node_allocations.insert("ward_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            sheet.warnings.is_empty(),
            "expected no warnings, got: {:?}",
            sheet.warnings.iter().map(|w| &w.warning_type).collect::<Vec<_>>()
        );
    }

    #[test]
    fn idol_affix_endurance_threshold_contributes() {
        // stout-endurance-threshold T2: (5.0 + 6.0) / 2 = 5.5
        let mut idol_affixes = HashMap::new();
        idol_affixes.insert(
            "idol-stout-endurance-threshold".to_string(),
            IdolAffixEffect {
                stat_key: StatKey::EnduranceThreshold,
                modifier_type: ModifierType::Flat,
                values_by_tier: [(2, 5.5)].into_iter().collect(),
            },
        );
        let game_data = GameData {
            idol_affixes,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.idol_placements.push(IdolPlacement {
            row: 1,
            col: 0,
            idol_size: "stout-1x3".to_string(),
            prefix: Some(AffixEntry {
                affix_id: "idol-stout-endurance-threshold".to_string(),
                tier: 2,
            }),
            suffix: None,
        });
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.defense.endurance_threshold - 5.5).abs() < 0.01,
            "expected endurance_threshold 5.5 got {}",
            sheet.defense.endurance_threshold
        );
    }

    #[test]
    fn blessing_fire_resistance_contributes() {
        let mut blessing_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
        blessing_effects.insert(
            "rod-dragon-scale".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 18.0,
                condition: Condition::Always,
            }],
        );
        let game_data = GameData {
            blessing_effects,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.blessings.push("rod-dragon-scale".to_string());

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.defense.fire_resistance - 18.0).abs() < 0.01,
            "expected fire_resistance 18.0, got {}",
            sheet.defense.fire_resistance
        );
    }

    #[test]
    fn unknown_blessing_id_silently_skipped() {
        let game_data = GameData {
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.blessings.push("nonexistent-blessing".to_string());
        // Should not panic
        let _sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
    }
}
