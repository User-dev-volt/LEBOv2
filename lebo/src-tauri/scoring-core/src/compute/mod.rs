use crate::build_snapshot::BuildSnapshot;
use crate::compute_options::ComputeOptions;
use crate::game_data::{ArchetypeWeights, GameData};
use crate::modifier::{
    Condition, Modifier, ModifierRegistry, ModifierSource, SourceType, StatKey,
};
use crate::stat_sheet::{ScoreComponents, StatSheet};

mod offense;
mod penetration;
mod defense;
mod ehp;
mod ward;
mod ailment;
mod attributes;
mod minion;

pub fn compute_stats(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    options: ComputeOptions,
) -> StatSheet {
    let registry = build_registry(snapshot, game_data, options.track_sources);
    let active = snapshot.active_conditions.as_slice();
    let mut offense = offense::compute_offense(&registry, active);

    // Penetration scales the scored damage of the build's primary type(s) against a
    // 0%-resistance reference target. No-penetration builds get multiplier 1.0, so the
    // aggregate damage_score stays byte-identical to Phase 3. (See penetration.rs.)
    let pen = penetration::compute_penetration(&registry, active);
    offense.elemental_penetration = pen.elemental();
    offense.physical_penetration = pen.physical;
    offense.void_penetration = pen.void;
    let pen_mult =
        penetration::penetration_multiplier(&snapshot.primary_offense_damage_elements, &pen);
    offense.damage_score *= pen_mult;
    offense.avg_hit_damage *= pen_mult;
    offense.avg_hit_damage_crit_weighted *= pen_mult;

    let mut defense = defense::compute_defense(snapshot, game_data, &registry, active);
    // FR-6/FR-7: tunklab-aligned EHP triple + Stable Ward/HP, derived from the already-computed
    // defensive layers. These are additive display-only fields — they deliberately do NOT feed the
    // `scores` block below (`survivability_score`/`build_score` stay on the frozen `effective_hp`
    // parity gate). See ehp.rs / ward.rs and Story 1.4.
    let ehp = ehp::compute_ehp(&defense);
    let ward_eq = ward::compute_ward(&defense);
    defense.ehp_vs_hits = ehp.vs_hits;
    defense.ehp_vs_dots = ehp.vs_dots;
    defense.ehp_vs_one_shots = ehp.vs_one_shots;
    defense.stable_ward = ward_eq.stable_ward;
    defense.stable_hp = ward_eq.stable_hp;

    // FR-8/FR-9/FR-10 (Story 1.5): additive sub-sheets. Computed AFTER the offense/defense/ehp/ward
    // block and BEFORE `scores` — they feed only their own sheet fields and NEVER the `scores`
    // block, `effective_hp`, or the speed score (frozen parity gate). The ailment chance/avoidance
    // fields ride offense/defense already at honest 0.0; here we add the attribute totals, the
    // sourced ailment durations, and minion stats, with Some/None conditional presence.
    let attributes = attributes::compute_attributes(&registry, active);
    let ailment_stats = ailment::compute_ailment(&registry, active);
    let ailment = if ailment::has_ailment_data(&ailment_stats) {
        Some(ailment_stats)
    } else {
        None
    };
    let minion = if minion::has_minion_skill(snapshot, &registry, active) {
        Some(minion::compute_minion(&registry, active))
    } else {
        None
    };

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
    let warnings = defense::run_floor_check(&defense, snapshot);
    // Additive metadata only — `stat_sources` never feeds any computed field above. `Some` solely
    // on the display call (`options.track_sources`); loop paths return `None` with zero cost.
    let stat_sources = if options.track_sources {
        Some(registry.collect_sources(active))
    } else {
        None
    };
    StatSheet {
        offense,
        defense,
        scores,
        attributes,
        ailment,
        minion,
        warnings,
        stat_sources,
    }
}

pub(crate) fn build_registry(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    track_sources: bool,
) -> ModifierRegistry {
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
                    // One source per point, parallel to `add` — a 3-point node contributing +5
                    // each shows three sources. The String label allocation lives only here, so
                    // loop paths (track_sources == false) pay nothing (Pattern P4-2 / NFR-9).
                    if track_sources {
                        registry.add_source(
                            effect.stat_key.clone(),
                            effect.condition.clone(),
                            ModifierSource {
                                source_type: SourceType::PassiveNode,
                                source_label: node_id.clone(),
                                value: effect.value,
                                modifier_type: effect.modifier_type.clone(),
                            },
                        );
                    }
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
            if track_sources {
                registry.add_source(
                    effect.stat_key.clone(),
                    Condition::Always,
                    ModifierSource {
                        source_type: SourceType::Idol,
                        source_label: entry.affix_id.clone(),
                        value,
                        modifier_type: effect.modifier_type.clone(),
                    },
                );
            }
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
                if track_sources {
                    registry.add_source(
                        effect.stat_key.clone(),
                        Condition::Always,
                        ModifierSource {
                            source_type: SourceType::Blessing,
                            source_label: blessing_id.clone(),
                            value: effect.value,
                            modifier_type: effect.modifier_type.clone(),
                        },
                    );
                }
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
            if track_sources {
                registry.add_source(
                    effect.stat_key.clone(),
                    Condition::Always,
                    ModifierSource {
                        source_type: SourceType::GearSlot,
                        source_label: format!("{}:{}", slot_id, entry.affix_id),
                        value,
                        modifier_type: effect.modifier_type.clone(),
                    },
                );
            }
        }
    }

    registry
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

// Orchestrator-level tests: every case below exercises the full `compute_stats` round-trip,
// so they live alongside the orchestrator. Offense- and defense-specific math is verified
// here through the public entry point. Parity gate — expected values must never change.
#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_snapshot::{AffixEntry, IdolPlacement};
    use crate::game_data::{ArchetypeWeightsEntry, BaseClassStats, IdolAffixEffect, NodeEffect};
    use crate::modifier::{Condition, ModifierType};
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

    // --- Penetration tests (FR-4) ---

    #[test]
    fn no_penetration_keeps_damage_score_byte_identical() {
        // 100% increased fire, no penetration → aggregate 100 × (1 + 1.0) = 200, unscaled.
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "fire_dmg".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedFireDamage,
                modifier_type: ModifierType::Increased,
                value: 100.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.primary_offense_damage_elements = vec!["fire".to_string()];
        snapshot.node_allocations.insert("fire_dmg".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.offense.damage_score - 200.0).abs() < 0.01,
            "no-pen damage_score must stay 200, got {}",
            sheet.offense.damage_score
        );
        assert_eq!(sheet.offense.elemental_penetration, 0.0);
        assert_eq!(sheet.offense.physical_penetration, 0.0);
    }

    #[test]
    fn elemental_penetration_scales_primary_element_damage_linearly() {
        // 100% increased fire (aggregate 200) + 50% fire penetration on a fire-primary
        // build → ×1.50 → 300. Linear, 0%-resistance reference target.
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "fire_dmg".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedFireDamage,
                modifier_type: ModifierType::Increased,
                value: 100.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "fire_pen".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FirePenetration,
                modifier_type: ModifierType::Flat,
                value: 50.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.primary_offense_damage_elements = vec!["fire".to_string()];
        snapshot.node_allocations.insert("fire_dmg".to_string(), 1);
        snapshot.node_allocations.insert("fire_pen".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.offense.damage_score - 300.0).abs() < 0.01,
            "expected 300 (200 × 1.5), got {}",
            sheet.offense.damage_score
        );
        assert!((sheet.offense.elemental_penetration - 50.0).abs() < 1e-9);
    }

    #[test]
    fn void_penetration_scales_void_primary_damage() {
        // 100% increased void (aggregate 200) + 30% void penetration on a void-primary build
        // → ×1.30 → 260. Exercises the void channel end-to-end through compute_stats (the
        // sourced pen would arrive as Flat from the loader; modeled here directly).
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "void_dmg".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedVoidDamage,
                modifier_type: ModifierType::Increased,
                value: 100.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "void_pen".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::VoidPenetration,
                modifier_type: ModifierType::Flat,
                value: 30.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.primary_offense_damage_elements = vec!["void".to_string()];
        snapshot.node_allocations.insert("void_dmg".to_string(), 1);
        snapshot.node_allocations.insert("void_pen".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.offense.damage_score - 260.0).abs() < 0.01,
            "expected 260 (200 × 1.30), got {}",
            sheet.offense.damage_score
        );
        assert!((sheet.offense.void_penetration - 30.0).abs() < 1e-9);
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

    // --- FR-5 defensive layer tests (Story 1.3) ---

    /// Single Flat node of `stat_key`=`value`, allocated once at slider 50.
    fn single_layer_node(stat_key: StatKey, value: f64) -> (GameData, BuildSnapshot) {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "layer_node".to_string(),
            vec![NodeEffect {
                stat_key,
                modifier_type: ModifierType::Flat,
                value,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("layer_node".to_string(), 1);
        (game_data, snapshot)
    }

    #[test]
    fn necrotic_resistance_is_independent_of_poison() {
        // AC2: a NecroticResistance source feeds necrotic_resistance only — never poison.
        let (game_data, snapshot) = single_layer_node(StatKey::NecroticResistance, 40.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.defense.necrotic_resistance - 40.0).abs() < 0.01,
            "necrotic_resistance expected 40 got {}",
            sheet.defense.necrotic_resistance
        );
        assert!(
            sheet.defense.poison_resistance.abs() < 0.01,
            "poison_resistance must stay 0 (necrotic no longer conflated), got {}",
            sheet.defense.poison_resistance
        );
    }

    #[test]
    fn healing_effectiveness_flows_from_stat_key() {
        let (game_data, snapshot) = single_layer_node(StatKey::HealingEffectiveness, 15.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!((sheet.defense.healing_effectiveness - 15.0).abs() < 0.01);
    }

    #[test]
    fn block_chance_flows_and_caps_at_100() {
        let (game_data, snapshot) = single_layer_node(StatKey::BlockChance, 130.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.defense.block_chance - 100.0).abs() < 0.01,
            "block_chance must cap at 100, got {}",
            sheet.defense.block_chance
        );
    }

    #[test]
    fn armor_mitigation_is_derived_and_caps_at_85() {
        // armor != the reference denominator so the assertion actually pins K=1104:
        // 368 / (368 + 1104) = 0.25 → 25%. (A value of A==K would give 50% for ANY denominator.)
        let (game_data, snapshot) = single_layer_node(StatKey::Armor, 368.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(
            (sheet.defense.armor_mitigation_percent - 25.0).abs() < 0.1,
            "368 armor with K=1104 → 25% mitigation, got {}",
            sheet.defense.armor_mitigation_percent
        );
        // Extreme armor → capped at 85%.
        let (gd2, snap2) = single_layer_node(StatKey::Armor, 1_000_000.0);
        let sheet2 = compute_stats(&snap2, &gd2, ComputeOptions::default());
        assert!(
            (sheet2.defense.armor_mitigation_percent - 85.0).abs() < 0.01,
            "armor mitigation must cap at 85%, got {}",
            sheet2.defense.armor_mitigation_percent
        );
    }

    #[test]
    fn zero_no_key_layers_surface_zero() {
        // AC5: FR-5 layers with no shipped source surface 0.0 (and add no dead StatKey).
        let game_data =
            GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let sheet = compute_stats(&snapshot_at(50), &game_data, ComputeOptions::default());
        assert_eq!(sheet.defense.parry_chance, 0.0);
        assert_eq!(sheet.defense.glancing_blow_chance, 0.0);
        assert_eq!(sheet.defense.block_effectiveness, 0.0);
        assert_eq!(sheet.defense.ward_retention, 0.0);
        assert_eq!(sheet.defense.ward_decay_threshold, 0.0);
        assert_eq!(sheet.defense.reduced_bonus_damage_from_crits, 0.0);
    }

    #[test]
    fn floor_check_resistance_at_cap_emits_no_warning() {
        // AR-14 gap floor: exactly-at-cap AND float-drift-at-cap emit NO *_resistance_uncapped
        // warning; a genuinely-below value still warns with the right gap. AllResistances drives
        // all seven resistances (incl. necrotic) at once.
        let at_cap = single_layer_node(StatKey::AllResistances, 75.0);
        let sheet = compute_stats(&at_cap.1, &at_cap.0, ComputeOptions::default());
        assert!(
            !sheet.warnings.iter().any(|w| w.warning_type.ends_with("_resistance_uncapped")),
            "at-cap resistances must emit no uncapped warning, got: {:?}",
            sheet.warnings.iter().map(|w| &w.warning_type).collect::<Vec<_>>()
        );

        let drift = single_layer_node(StatKey::AllResistances, 74.999_999);
        let sheet_drift = compute_stats(&drift.1, &drift.0, ComputeOptions::default());
        assert!(
            !sheet_drift.warnings.iter().any(|w| w.warning_type.ends_with("_resistance_uncapped")),
            "float-drift at cap (74.999999) must emit no warning (gap floor), got: {:?}",
            sheet_drift.warnings.iter().map(|w| &w.warning_type).collect::<Vec<_>>()
        );

        let below = single_layer_node(StatKey::AllResistances, 68.0);
        let sheet_below = compute_stats(&below.1, &below.0, ComputeOptions::default());
        let fire_warn = sheet_below
            .warnings
            .iter()
            .find(|w| w.warning_type == "fire_resistance_uncapped");
        assert!(fire_warn.is_some(), "68% resistance must still warn");
        assert!(
            (fire_warn.unwrap().gap - 7.0).abs() < 0.1,
            "gap expected ~7 got {}",
            fire_warn.unwrap().gap
        );
        // necrotic is the 7th resistance and must warn at 68 too.
        assert!(
            sheet_below.warnings.iter().any(|w| w.warning_type == "necrotic_resistance_uncapped"),
            "necrotic_resistance_uncapped must be emitted below cap"
        );

        // Pin the epsilon WIDTH (RESISTANCE_GAP_EPSILON = 0.05): a value inside the band
        // (74.97 → gap 0.03 < 0.05) is treated as capped → no warning...
        let in_band = single_layer_node(StatKey::AllResistances, 74.97);
        let sheet_in_band = compute_stats(&in_band.1, &in_band.0, ComputeOptions::default());
        assert!(
            !sheet_in_band.warnings.iter().any(|w| w.warning_type.ends_with("_resistance_uncapped")),
            "within-epsilon resistance (74.97, gap 0.03) must emit no warning, got: {:?}",
            sheet_in_band.warnings.iter().map(|w| &w.warning_type).collect::<Vec<_>>()
        );
        // ...but a value just outside the band (74.9 → gap 0.10 > 0.05) still warns.
        let out_band = single_layer_node(StatKey::AllResistances, 74.9);
        let sheet_out_band = compute_stats(&out_band.1, &out_band.0, ComputeOptions::default());
        let out_warn = sheet_out_band
            .warnings
            .iter()
            .find(|w| w.warning_type == "fire_resistance_uncapped");
        assert!(
            out_warn.is_some(),
            "just-outside-epsilon resistance (74.9, gap 0.10) must still warn"
        );
        assert!(
            (out_warn.unwrap().gap - 0.1).abs() < 0.01,
            "gap expected ~0.1 got {}",
            out_warn.unwrap().gap
        );
    }

    // --- Story 1.5 parity + sub-sheet tests (FR-8/9/10) ---

    fn story_1_5_base_effects() -> HashMap<String, Vec<NodeEffect>> {
        let mut ne = HashMap::new();
        ne.insert(
            "dmg".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 120.0,
                condition: Condition::Always,
            }],
        );
        ne.insert(
            "ward".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::WardPerSecond,
                modifier_type: ModifierType::Flat,
                value: 200.0,
                condition: Condition::Always,
            }],
        );
        ne.insert(
            "spd".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::AttackSpeed,
                modifier_type: ModifierType::Flat,
                value: 30.0,
                condition: Condition::Always,
            }],
        );
        ne
    }

    /// AC4 frozen-parity gate: adding attribute, minion-damage, and ailment-duration nodes leaves
    /// every frozen aggregate (effective_hp, survivability_score, damage_score, speed, build_score)
    /// byte-identical to the same build without them, while the new sub-sheets populate.
    #[test]
    fn story_1_5_stats_do_not_perturb_frozen_aggregates() {
        let gd_base = make_game_data_with_effects(story_1_5_base_effects());
        let mut snap_base = snapshot_at(50);
        snap_base.node_allocations.insert("dmg".to_string(), 1);
        snap_base.node_allocations.insert("ward".to_string(), 1);
        snap_base.node_allocations.insert("spd".to_string(), 1);
        let base = compute_stats(&snap_base, &gd_base, ComputeOptions::default());

        let mut effects = story_1_5_base_effects();
        effects.insert(
            "attrs".to_string(),
            vec![
                NodeEffect {
                    stat_key: StatKey::Strength,
                    modifier_type: ModifierType::Flat,
                    value: 20.0,
                    condition: Condition::Always,
                },
                NodeEffect {
                    stat_key: StatKey::Dexterity,
                    modifier_type: ModifierType::Flat,
                    value: 8.0,
                    condition: Condition::Always,
                },
            ],
        );
        effects.insert(
            "mdmg".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedMinionDamage,
                modifier_type: ModifierType::Increased,
                value: 50.0,
                condition: Condition::Always,
            }],
        );
        effects.insert(
            "ignite".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IgniteDuration,
                modifier_type: ModifierType::Increased,
                value: 40.0,
                condition: Condition::Always,
            }],
        );
        let gd = make_game_data_with_effects(effects);
        let mut snap = snap_base.clone();
        snap.node_allocations.insert("attrs".to_string(), 1);
        snap.node_allocations.insert("mdmg".to_string(), 1);
        snap.node_allocations.insert("ignite".to_string(), 1);
        let with = compute_stats(&snap, &gd, ComputeOptions::default());

        assert_eq!(
            with.defense.effective_hp, base.defense.effective_hp,
            "effective_hp must be byte-identical"
        );
        assert_eq!(with.scores.survivability_score, base.scores.survivability_score);
        assert_eq!(
            with.scores.damage_score, base.scores.damage_score,
            "damage_score must not absorb attribute/minion-damage/ailment keys"
        );
        assert_eq!(
            with.scores.speed_score, base.scores.speed_score,
            "speed must not absorb minion/attribute keys"
        );
        assert_eq!(with.scores.build_score, base.scores.build_score);

        // New sub-sheets actually populated.
        assert_eq!(with.attributes.strength, 20.0);
        assert_eq!(with.attributes.dexterity, 8.0);
        assert_eq!(with.attributes.vitality, 0.0);
        let minion = with.minion.as_ref().expect("minion modifier present → Some");
        assert_eq!(minion.minion_damage_multi, 50.0);
        assert_eq!(minion.minion_count, 0.0);
        assert_eq!(minion.minion_hp_multi, 0.0);
        assert_eq!(minion.minion_speed, 0.0);
        let ailment = with.ailment.as_ref().expect("ignite duration present → Some");
        assert_eq!(ailment.ignite_duration, 40.0);
    }

    /// AC1/AC3 conditional presence: no minion signal → `minion: None`; no ailment figure →
    /// `ailment: None`; the attribute sub-sheet is always present (all-zero when unsourced).
    #[test]
    fn story_1_5_minion_and_ailment_absent_yield_none() {
        let gd = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let sheet = compute_stats(&snapshot_at(50), &gd, ComputeOptions::default());
        assert!(sheet.minion.is_none(), "no minion signal → None");
        assert!(sheet.ailment.is_none(), "no ailment figure → None");
        assert_eq!(sheet.attributes.strength, 0.0);
        assert_eq!(sheet.attributes.intelligence, 0.0);
    }

    /// AC1 honesty rule: ailment chances (offense) and avoidance (defense) surface 0.0 with no
    /// shipped source (the parry_chance precedent).
    #[test]
    fn story_1_5_ailment_chances_and_avoidance_are_zero() {
        let gd = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let sheet = compute_stats(&snapshot_at(50), &gd, ComputeOptions::default());
        assert_eq!(sheet.offense.bleed_chance, 0.0);
        assert_eq!(sheet.offense.ignite_chance, 0.0);
        assert_eq!(sheet.offense.poison_chance, 0.0);
        assert_eq!(sheet.offense.freeze_chance, 0.0);
        assert_eq!(sheet.offense.shock_chance, 0.0);
        assert_eq!(sheet.offense.armor_shred_chance, 0.0);
        assert_eq!(sheet.defense.chill_avoidance, 0.0);
        assert_eq!(sheet.defense.stun_avoidance, 0.0);
        assert_eq!(sheet.defense.bleed_avoidance, 0.0);
    }

    // --- Story 1.7 source-tracking tests (FR-12) ---

    use crate::modifier::SourceType;

    /// AC2: `ComputeOptions::default()` → no source collection, `stat_sources == None`.
    #[test]
    fn stat_sources_none_by_default() {
        let game_data =
            GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let sheet = compute_stats(&snapshot_at(50), &game_data, ComputeOptions::default());
        assert!(sheet.stat_sources.is_none(), "loop path must return None");
    }

    /// AC1: a single Fire Resistance passive node, tracking on → one PassiveNode source under the
    /// `"FireResistance"` key with the right label/value/modifier_type.
    #[test]
    fn stat_sources_some_when_tracking() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "fire_res_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 40.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("fire_res_node".to_string(), 1);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true });
        let sources = sheet.stat_sources.expect("Some when tracking");
        let fr = sources.get("FireResistance").expect("FireResistance key present");
        assert_eq!(fr.len(), 1);
        assert_eq!(fr[0].source_type, SourceType::PassiveNode);
        assert_eq!(fr[0].source_label, "fire_res_node");
        assert_eq!(fr[0].value, 40.0);
        assert_eq!(fr[0].modifier_type, ModifierType::Flat);
    }

    /// AC1: a passive node AND a blessing both granting Fire Resistance → both contributors are
    /// listed under the single `"FireResistance"` key.
    #[test]
    fn stat_sources_groups_multiple_contributors() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "fr_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 20.0,
                condition: Condition::Always,
            }],
        );
        let mut blessing_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
        blessing_effects.insert(
            "fr_blessing".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 18.0,
                condition: Condition::Always,
            }],
        );
        let game_data = GameData {
            node_effects,
            blessing_effects,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("fr_node".to_string(), 1);
        snapshot.blessings.push("fr_blessing".to_string());

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true });
        let entries = sheet
            .stat_sources
            .expect("Some when tracking")
            .remove("FireResistance")
            .expect("FireResistance key present");
        assert_eq!(entries.len(), 2, "both contributors listed under one key");
        assert!(entries.iter().any(|s| s.source_type == SourceType::PassiveNode));
        assert!(entries.iter().any(|s| s.source_type == SourceType::Blessing));
    }

    /// AC3: one of each origin (node / gear affix / idol affix / blessing) lands with its correct
    /// `SourceType`. Distinct resistances keep the assertions unambiguous.
    #[test]
    fn stat_sources_assigns_source_type_per_origin() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "n".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 10.0,
                condition: Condition::Always,
            }],
        );
        let mut idol_affixes = HashMap::new();
        idol_affixes.insert(
            "ia".to_string(),
            IdolAffixEffect {
                stat_key: StatKey::LightningResistance,
                modifier_type: ModifierType::Flat,
                values_by_tier: [(2, 12.0)].into_iter().collect(),
            },
        );
        let mut blessing_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
        blessing_effects.insert(
            "b".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::VoidResistance,
                modifier_type: ModifierType::Flat,
                value: 14.0,
                condition: Condition::Always,
            }],
        );
        let mut gear_affixes = HashMap::new();
        gear_affixes.insert(
            "ga".to_string(),
            crate::game_data::GearAffixData {
                display_name: "% Cold Resistance".to_string(),
                stat_key: StatKey::ColdResistance,
                modifier_type: ModifierType::Flat,
                values_by_tier: [(3, 16.0)].into_iter().collect(),
                affix_class: crate::modifier::AffixPosition::Prefix,
                scope: crate::modifier::Scope::Generic,
                damage_elements: vec![],
            },
        );
        let game_data = GameData {
            node_effects,
            idol_affixes,
            blessing_effects,
            gear_affixes,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("n".to_string(), 1);
        snapshot.idol_placements.push(IdolPlacement {
            row: 0,
            col: 0,
            idol_size: "stout-1x3".to_string(),
            prefix: Some(AffixEntry { affix_id: "ia".to_string(), tier: 2 }),
            suffix: None,
        });
        snapshot.blessings.push("b".to_string());
        snapshot.gear_slots.insert(
            "helm".to_string(),
            crate::build_snapshot::GearSlotSnapshot {
                item_id: None,
                prefixes: vec![AffixEntry { affix_id: "ga".to_string(), tier: 3 }],
                suffixes: vec![],
            },
        );

        let s = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true })
            .stat_sources
            .expect("Some when tracking");
        assert_eq!(s["FireResistance"][0].source_type, SourceType::PassiveNode);
        assert_eq!(s["ColdResistance"][0].source_type, SourceType::GearSlot);
        assert_eq!(s["LightningResistance"][0].source_type, SourceType::Idol);
        assert_eq!(s["VoidResistance"][0].source_type, SourceType::Blessing);
    }

    /// AC3 honesty: an inactive `Condition::Named` modifier is absent from `stat_sources`; turning
    /// its condition on makes it appear — mirroring `query`'s active filter exactly.
    #[test]
    fn stat_sources_excludes_inactive_conditional() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "cond_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 30.0,
                condition: Condition::Named("x".to_string()),
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("cond_node".to_string(), 1);

        let inactive = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true });
        assert!(
            !inactive.stat_sources.unwrap().contains_key("FireResistance"),
            "inactive conditional source must be absent"
        );

        snapshot.active_conditions.push("x".to_string());
        let active = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true });
        assert!(
            active.stat_sources.unwrap().contains_key("FireResistance"),
            "active conditional source must be present"
        );
    }

    /// AC4 frozen-parity gate: the same heavy build computed with `track_sources` false vs true is
    /// byte-identical on every computed field — only `stat_sources` (None vs Some) differs.
    #[test]
    fn tracking_does_not_perturb_frozen_aggregates() {
        let mut effects = story_1_5_base_effects();
        effects.insert(
            "attrs".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::Strength,
                modifier_type: ModifierType::Flat,
                value: 25.0,
                condition: Condition::Always,
            }],
        );
        effects.insert(
            "res".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::AllResistances,
                modifier_type: ModifierType::Flat,
                value: 60.0,
                condition: Condition::Always,
            }],
        );
        effects.insert(
            "mdmg".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedMinionDamage,
                modifier_type: ModifierType::Increased,
                value: 40.0,
                condition: Condition::Always,
            }],
        );
        effects.insert(
            "ignite".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IgniteDuration,
                modifier_type: ModifierType::Increased,
                value: 30.0,
                condition: Condition::Always,
            }],
        );
        let gd = make_game_data_with_effects(effects);
        let mut snap = snapshot_at(50);
        for n in ["dmg", "ward", "spd", "attrs", "res", "mdmg", "ignite"] {
            snap.node_allocations.insert(n.to_string(), 1);
        }

        let base = compute_stats(&snap, &gd, ComputeOptions::default());
        let tracked = compute_stats(&snap, &gd, ComputeOptions { track_sources: true });

        // Compare every computed field via serde value equality (robust to struct shape).
        use serde_json::to_value;
        assert_eq!(to_value(&base.offense).unwrap(), to_value(&tracked.offense).unwrap());
        assert_eq!(to_value(&base.defense).unwrap(), to_value(&tracked.defense).unwrap());
        assert_eq!(to_value(&base.scores).unwrap(), to_value(&tracked.scores).unwrap());
        assert_eq!(to_value(&base.attributes).unwrap(), to_value(&tracked.attributes).unwrap());
        assert_eq!(to_value(&base.ailment).unwrap(), to_value(&tracked.ailment).unwrap());
        assert_eq!(to_value(&base.minion).unwrap(), to_value(&tracked.minion).unwrap());
        assert_eq!(to_value(&base.warnings).unwrap(), to_value(&tracked.warnings).unwrap());

        assert!(base.stat_sources.is_none());
        assert!(tracked.stat_sources.is_some());
    }

    /// AC1: an empty build with tracking on yields `Some` with no keys — unsourced stats add no
    /// empty `Vec`s and no dead keys.
    #[test]
    fn unsourced_stat_has_no_key() {
        let game_data =
            GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let sheet =
            compute_stats(&snapshot_at(50), &game_data, ComputeOptions { track_sources: true });
        let sources = sheet.stat_sources.expect("Some even when empty");
        assert!(sources.is_empty(), "no sources → empty map (no dead keys)");
    }

    /// AC1 / per-point recording: a 3-point node records one `ModifierSource` per allocated point
    /// (parallel to `add`), so a node contributing +5 each across 3 points lists three sources.
    #[test]
    fn stat_sources_records_one_per_allocated_point() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "stacking_node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 5.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("stacking_node".to_string(), 3);

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true });
        let fr = sheet
            .stat_sources
            .expect("Some when tracking")
            .remove("FireResistance")
            .expect("FireResistance key present");
        assert_eq!(fr.len(), 3, "one source per allocated point");
        assert!(fr.iter().all(|s| s.source_type == SourceType::PassiveNode));
        assert!(fr.iter().all(|s| s.source_label == "stacking_node"));
        assert!(fr.iter().all(|s| s.value == 5.0));
        assert!(fr.iter().all(|s| s.modifier_type == ModifierType::Flat));
    }

    /// AC1: two distinct passive nodes feeding the same stat are both listed under the one key,
    /// each carrying its own `source_label` (same-origin grouping, not just node+blessing).
    #[test]
    fn stat_sources_groups_same_origin_contributors() {
        let mut node_effects = HashMap::new();
        for id in ["fr_node_a", "fr_node_b"] {
            node_effects.insert(
                id.to_string(),
                vec![NodeEffect {
                    stat_key: StatKey::FireResistance,
                    modifier_type: ModifierType::Flat,
                    value: 12.0,
                    condition: Condition::Always,
                }],
            );
        }
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("fr_node_a".to_string(), 1);
        snapshot.node_allocations.insert("fr_node_b".to_string(), 1);

        let fr = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true })
            .stat_sources
            .expect("Some when tracking")
            .remove("FireResistance")
            .expect("FireResistance key present");
        assert_eq!(fr.len(), 2, "both same-origin contributors listed under one key");
        assert!(fr.iter().all(|s| s.source_type == SourceType::PassiveNode));
        assert!(fr.iter().any(|s| s.source_label == "fr_node_a"));
        assert!(fr.iter().any(|s| s.source_label == "fr_node_b"));
    }

    /// AC1: idol and gear sources must carry the correct `value` (tier-resolved) and
    /// `modifier_type`, not just `source_type` — these are the fields most likely to drift from
    /// what `add` records.
    #[test]
    fn stat_sources_idol_and_gear_carry_value_and_modifier_type() {
        let mut idol_affixes = HashMap::new();
        idol_affixes.insert(
            "ia".to_string(),
            IdolAffixEffect {
                stat_key: StatKey::LightningResistance,
                modifier_type: ModifierType::Flat,
                values_by_tier: [(2, 12.0)].into_iter().collect(),
            },
        );
        let mut gear_affixes = HashMap::new();
        gear_affixes.insert(
            "ga".to_string(),
            crate::game_data::GearAffixData {
                display_name: "% Cold Resistance".to_string(),
                stat_key: StatKey::ColdResistance,
                modifier_type: ModifierType::Flat,
                values_by_tier: [(3, 16.0)].into_iter().collect(),
                affix_class: crate::modifier::AffixPosition::Prefix,
                scope: crate::modifier::Scope::Generic,
                damage_elements: vec![],
            },
        );
        let game_data = GameData {
            idol_affixes,
            gear_affixes,
            archetype_weights: standard_weight_table(),
            ..Default::default()
        };
        let mut snapshot = snapshot_at(50);
        snapshot.idol_placements.push(IdolPlacement {
            row: 0,
            col: 0,
            idol_size: "stout-1x3".to_string(),
            prefix: Some(AffixEntry { affix_id: "ia".to_string(), tier: 2 }),
            suffix: None,
        });
        snapshot.gear_slots.insert(
            "helm".to_string(),
            crate::build_snapshot::GearSlotSnapshot {
                item_id: None,
                prefixes: vec![AffixEntry { affix_id: "ga".to_string(), tier: 3 }],
                suffixes: vec![],
            },
        );

        let s = compute_stats(&snapshot, &game_data, ComputeOptions { track_sources: true })
            .stat_sources
            .expect("Some when tracking");

        let idol = &s["LightningResistance"][0];
        assert_eq!(idol.source_type, SourceType::Idol);
        assert_eq!(idol.value, 12.0, "idol source records the tier-resolved value");
        assert_eq!(idol.modifier_type, ModifierType::Flat);

        let gear = &s["ColdResistance"][0];
        assert_eq!(gear.source_type, SourceType::GearSlot);
        assert_eq!(gear.value, 16.0, "gear source records the tier-resolved value");
        assert_eq!(gear.modifier_type, ModifierType::Flat);
    }

    /// AC2 (Pattern P4-2) by construction: a build that *would* produce sources records **none**
    /// when `track_sources == false` — asserted on the registry itself, not just the output flag,
    /// so a regression that collects then drops the field cannot pass.
    #[test]
    fn loop_path_records_no_sources_in_registry() {
        let mut node_effects = HashMap::new();
        node_effects.insert(
            "fr".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::FireResistance,
                modifier_type: ModifierType::Flat,
                value: 30.0,
                condition: Condition::Always,
            }],
        );
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("fr".to_string(), 1);
        let active = snapshot.active_conditions.as_slice();

        let off = build_registry(&snapshot, &game_data, false);
        assert!(
            off.collect_sources(active).is_empty(),
            "loop path must record zero sources (no allocation)"
        );
        let on = build_registry(&snapshot, &game_data, true);
        assert!(
            !on.collect_sources(active).is_empty(),
            "display path records sources for the same build"
        );
    }
}
