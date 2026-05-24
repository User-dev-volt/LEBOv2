use std::collections::HashMap;

use crate::build_snapshot::{AffixEntry, BuildSnapshot, GearSlotSnapshot};
use crate::compute::compute_stats;
use crate::compute_options::ComputeOptions;
use crate::game_data::{GameData, GearAffixData};
use crate::modifier::StatKey;
use crate::stat_sheet::{GearAnalysis, GearSlotRanking, WishlistAffix};

/// Canonical 12 gear slot IDs — every run_gear_scoring result includes all 12.
const SLOT_IDS: &[&str] = &[
    "helm", "chest", "gloves", "boots", "belt", "amulet",
    "ring_1", "ring_2", "weapon", "off_hand", "relic", "catalyst",
];

/// Computes skill-context-aware affix weights, ideal slot configurations, and slot rankings.
/// Pure function — no side effects. Safe to call from spawn_blocking in Story 5.3.
///
/// Degrades gracefully when game_data.gear_affixes is empty: all slots return
/// upgrade_score: 0.0, efficiency_percent: 100.0, empty wishlists.
pub fn run_gear_scoring(snapshot: &BuildSnapshot, game_data: &GameData) -> GearAnalysis {
    let baseline = compute_stats(snapshot, game_data, ComputeOptions::default());
    let baseline_score = baseline.scores.build_score;

    // Compute per-affix weights once; filtered by delivery type and element.
    let affix_weights: HashMap<String, f64> = game_data
        .gear_affixes
        .iter()
        .map(|(id, data)| {
            let weight = compute_weight(id, data, snapshot, game_data, baseline_score);
            (id.clone(), weight)
        })
        .collect();

    // Build per-slot rankings for all 12 canonical slots.
    let mut slot_rankings: Vec<GearSlotRanking> = SLOT_IDS
        .iter()
        .map(|&slot_id| score_slot(slot_id, snapshot, game_data, &affix_weights))
        .collect();

    // Sort by upgrade_score descending. Stable sort preserves slot order when tied.
    slot_rankings.sort_by(|a, b| {
        b.upgrade_score
            .partial_cmp(&a.upgrade_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let priority_slot = slot_rankings
        .first()
        .filter(|r| r.upgrade_score > 0.0)
        .map(|r| r.slot.clone())
        .unwrap_or_default();

    GearAnalysis { slot_rankings, priority_slot }
}

// ── Weight computation ────────────────────────────────────────────────────────

fn compute_weight(
    affix_id: &str,
    data: &GearAffixData,
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    baseline_score: f64,
) -> f64 {
    // Delivery-type filter: non-generic scope must match primary offense delivery type.
    if !passes_delivery_filter(&data.scope, snapshot.primary_offense_delivery_type.as_deref()) {
        return 0.0;
    }
    // Damage-element filter: non-empty damage_elements must overlap primary elements.
    if !passes_element_filter(&data.damage_elements, &snapshot.primary_offense_damage_elements) {
        return 0.0;
    }

    let (best_tier, best_val) = best_tier_value(&data.values_by_tier);
    if best_val == 0.0 {
        return 0.0;
    }

    // ΔBuildScore = compute_stats with affix injected at its best tier minus baseline.
    // Weight is a build-level concept (FR-A16: ΔBuildScore when affix present at best tier).
    // We inject into "helm" for all affixes to ensure deterministic, comparable weights.
    let mut modified = snapshot.clone();
    let inject_slot = modified.gear_slots.entry("helm".to_string()).or_default();
    let entry = AffixEntry { affix_id: affix_id.to_string(), tier: best_tier };
    if data.affix_class == "prefix" {
        inject_slot.prefixes.push(entry);
    } else {
        inject_slot.suffixes.push(entry);
    }

    let modified_score = compute_stats(&modified, game_data, ComputeOptions::default())
        .scores
        .build_score;
    (modified_score - baseline_score).max(0.0)
}

fn passes_delivery_filter(scope: &str, primary_delivery: Option<&str>) -> bool {
    if scope == "generic" {
        return true;
    }
    // If no primary offense is designated, non-generic affixes receive no weight.
    match primary_delivery {
        Some(dt) => dt == scope,
        None => false,
    }
}

fn passes_element_filter(affix_elements: &[String], primary_elements: &[String]) -> bool {
    if affix_elements.is_empty() {
        return true; // no element restriction — applies to all elements
    }
    if primary_elements.is_empty() {
        return true; // no element context specified — allow all
    }
    affix_elements.iter().any(|e| primary_elements.contains(e))
}

fn best_tier_value(values_by_tier: &HashMap<u32, f64>) -> (u32, f64) {
    // T5 preferred; fall back to highest available tier.
    if let Some(&v) = values_by_tier.get(&5) {
        return (5, v);
    }
    values_by_tier
        .iter()
        .max_by_key(|(&t, _)| t)
        .map(|(&t, &v)| (t, v))
        .unwrap_or((0, 0.0))
}

// ── Per-slot scoring ──────────────────────────────────────────────────────────

fn score_slot(
    slot_id: &str,
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    affix_weights: &HashMap<String, f64>,
) -> GearSlotRanking {
    let current_slot = snapshot.gear_slots.get(slot_id);

    // Separate affixes by class, filter to positive-weight entries, sort descending.
    let mut prefix_candidates: Vec<(&str, &GearAffixData, f64)> = game_data
        .gear_affixes
        .iter()
        .filter(|(_, d)| d.affix_class == "prefix")
        .filter_map(|(id, d)| {
            let w = *affix_weights.get(id)?;
            if w > 0.0 { Some((id.as_str(), d, w)) } else { None }
        })
        .collect();
    prefix_candidates
        .sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let mut suffix_candidates: Vec<(&str, &GearAffixData, f64)> = game_data
        .gear_affixes
        .iter()
        .filter(|(_, d)| d.affix_class == "suffix")
        .filter_map(|(id, d)| {
            let w = *affix_weights.get(id)?;
            if w > 0.0 { Some((id.as_str(), d, w)) } else { None }
        })
        .collect();
    suffix_candidates
        .sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let top_prefixes = &prefix_candidates[..prefix_candidates.len().min(2)];
    let top_suffixes = &suffix_candidates[..suffix_candidates.len().min(2)];

    let ideal_prefix = build_wishlist(top_prefixes, current_slot);
    let ideal_suffix = build_wishlist(top_suffixes, current_slot);

    let ideal_total: f64 = ideal_prefix.iter().chain(ideal_suffix.iter()).map(|w| w.weight).sum();
    let current_total =
        current_affix_total(current_slot, &ideal_prefix, &ideal_suffix, affix_weights);

    let upgrade_score = (ideal_total - current_total).max(0.0);
    let efficiency_percent = if ideal_total > 0.0 {
        (current_total / ideal_total * 100.0).clamp(0.0, 100.0)
    } else {
        100.0
    };

    GearSlotRanking {
        slot: slot_id.to_string(),
        upgrade_score,
        efficiency_percent,
        ideal_prefix,
        ideal_suffix,
    }
}

fn build_wishlist(
    candidates: &[(&str, &GearAffixData, f64)],
    current_slot: Option<&GearSlotSnapshot>,
) -> Vec<WishlistAffix> {
    candidates
        .iter()
        .map(|(id, data, weight)| {
            let target_tier = data.values_by_tier.keys().copied().max().unwrap_or(5);
            let satisfied = is_satisfied(id, target_tier, current_slot);
            WishlistAffix {
                affix_id: id.to_string(),
                display_name: data.display_name.clone(),
                target_tier,
                weight: *weight,
                mechanical_reason: format!(
                    "{} — contributes +{:.2} to BuildScore at T{}",
                    stat_display_name(&data.stat_key),
                    weight,
                    target_tier
                ),
                satisfied,
            }
        })
        .collect()
}

fn is_satisfied(affix_id: &str, target_tier: u32, slot: Option<&GearSlotSnapshot>) -> bool {
    let Some(slot) = slot else { return false };
    slot.prefixes
        .iter()
        .chain(slot.suffixes.iter())
        .any(|a| a.affix_id == affix_id && a.tier >= target_tier)
}

/// Sums weights of current slot affixes that appear in the ideal wishlist at their required tier.
/// Affixes not in the wishlist, or present at a lower tier than required, have no upgrade-gap contribution.
fn current_affix_total(
    slot: Option<&GearSlotSnapshot>,
    ideal_prefix: &[WishlistAffix],
    ideal_suffix: &[WishlistAffix],
    affix_weights: &HashMap<String, f64>,
) -> f64 {
    let Some(slot) = slot else { return 0.0 };
    // Map affix_id → required target_tier so we can gate on tier, not just ID.
    let ideal_tiers: HashMap<&str, u32> = ideal_prefix
        .iter()
        .chain(ideal_suffix.iter())
        .map(|w| (w.affix_id.as_str(), w.target_tier))
        .collect();
    slot.prefixes
        .iter()
        .chain(slot.suffixes.iter())
        .filter(|a| {
            ideal_tiers
                .get(a.affix_id.as_str())
                .map_or(false, |&required| a.tier >= required)
        })
        .filter_map(|a| affix_weights.get(&a.affix_id).copied())
        .sum()
}

fn stat_display_name(key: &StatKey) -> &'static str {
    match key {
        StatKey::IncreasedDamage => "% Increased Damage",
        StatKey::IncreasedFireDamage => "% Increased Fire Damage",
        StatKey::IncreasedColdDamage => "% Increased Cold Damage",
        StatKey::IncreasedLightningDamage => "% Increased Lightning Damage",
        StatKey::IncreasedVoidDamage => "% Increased Void Damage",
        StatKey::IncreasedPoisonDamage => "% Increased Poison Damage",
        StatKey::IncreasedPhysicalDamage => "% Increased Physical Damage",
        StatKey::IncreasedSpellDamage => "% Increased Spell Damage",
        StatKey::IncreasedMeleeDamage => "% Increased Melee Damage",
        StatKey::IncreasedRangedDamage => "% Increased Ranged Damage",
        StatKey::IncreasedMinionDamage => "% Increased Minion Damage",
        StatKey::CriticalStrikeChance => "% Critical Strike Chance",
        StatKey::CriticalStrikeMultiplier => "% Critical Strike Multiplier",
        StatKey::MaxHp => "Maximum HP",
        StatKey::MaxHpPercent => "% Maximum HP",
        StatKey::FireResistance => "% Fire Resistance",
        StatKey::ColdResistance => "% Cold Resistance",
        StatKey::LightningResistance => "% Lightning Resistance",
        StatKey::VoidResistance => "% Void Resistance",
        StatKey::PoisonResistance => "% Poison Resistance",
        StatKey::AllResistances => "% All Resistances",
        StatKey::EnduranceThreshold => "Endurance Threshold",
        StatKey::EndurancePercent => "% Endurance",
        StatKey::AttackSpeed => "% Attack Speed",
        StatKey::CastSpeed => "% Cast Speed",
        _ => "Stat Bonus",
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_data::GearAffixData;
    use crate::modifier::{ModifierType, StatKey};

    /// Minimal GameData with affixes covering all filter test cases.
    /// Uses stats that directly affect build_score:
    /// - IncreasedSpellDamage / IncreasedPoisonDamage / IncreasedDamage → DamageScore
    /// - MaxHp (Flat) → effective_hp → SurvivabilityScore
    fn make_game_data_with_affixes() -> GameData {
        let mut gear_affixes: HashMap<String, GearAffixData> = HashMap::new();
        // scope "melee" — must score 0 on a spell build (delivery-type filter)
        gear_affixes.insert(
            "melee_increased_damage".to_string(),
            GearAffixData {
                display_name: "% Increased Melee Damage".to_string(),
                stat_key: StatKey::IncreasedMeleeDamage,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 60.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "melee".to_string(),
                damage_elements: vec![],
            },
        );
        // scope "spell" — non-zero weight on spell build (IncreasedSpellDamage ∈ DAMAGE_STAT_KEYS)
        gear_affixes.insert(
            "spell_increased_damage".to_string(),
            GearAffixData {
                display_name: "% Increased Spell Damage".to_string(),
                stat_key: StatKey::IncreasedSpellDamage,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 60.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "spell".to_string(),
                damage_elements: vec![],
            },
        );
        // scope "generic", damage_elements ["fire"] — must score 0 on poison/physical build
        gear_affixes.insert(
            "fire_damage".to_string(),
            GearAffixData {
                display_name: "% Increased Fire Damage".to_string(),
                stat_key: StatKey::IncreasedFireDamage,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 60.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "generic".to_string(),
                damage_elements: vec!["fire".to_string()],
            },
        );
        // scope "generic", damage_elements ["poison"] — non-zero weight (IncreasedPoisonDamage ∈ DAMAGE_STAT_KEYS)
        gear_affixes.insert(
            "poison_damage".to_string(),
            GearAffixData {
                display_name: "% Increased Poison Damage".to_string(),
                stat_key: StatKey::IncreasedPoisonDamage,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 60.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "generic".to_string(),
                damage_elements: vec!["poison".to_string()],
            },
        );
        // scope "generic", no element restriction — must always pass element filter (MaxHp → effective_hp)
        gear_affixes.insert(
            "flat_hp_suffix".to_string(),
            GearAffixData {
                display_name: "Maximum HP".to_string(),
                stat_key: StatKey::MaxHp,
                modifier_type: ModifierType::Flat,
                values_by_tier: [(5u32, 200.0)].into_iter().collect(),
                affix_class: "suffix".to_string(),
                scope: "generic".to_string(),
                damage_elements: vec![],
            },
        );
        let mut game_data = GameData::default();
        game_data.gear_affixes = gear_affixes;
        game_data
    }

    fn make_spell_poison_snapshot() -> BuildSnapshot {
        BuildSnapshot {
            class_id: "rogue".to_string(),
            mastery_id: "bladedancer".to_string(),
            character_level: 75,
            primary_offense_delivery_type: Some("spell".to_string()),
            primary_offense_damage_elements: vec![
                "poison".to_string(),
                "physical".to_string(),
            ],
            skill_roles: [("slot-0".to_string(), "primary_offense".to_string())]
                .into_iter()
                .collect(),
            ..Default::default()
        }
    }

    #[test]
    fn test_delivery_type_zero_weight() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        // "melee_increased_damage" (scope "melee") must not appear in any wishlist on a spell build.
        for ranking in &analysis.slot_rankings {
            for affix in ranking.ideal_prefix.iter().chain(ranking.ideal_suffix.iter()) {
                assert_ne!(
                    affix.affix_id, "melee_increased_damage",
                    "melee-scoped affix must not appear in wishlist for a spell build"
                );
            }
        }
    }

    #[test]
    fn test_element_filter_zero_weight() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        // "fire_damage" has damage_elements: ["fire"] — no overlap with ["poison", "physical"].
        for ranking in &analysis.slot_rankings {
            for affix in ranking.ideal_prefix.iter().chain(ranking.ideal_suffix.iter()) {
                assert_ne!(
                    affix.affix_id, "fire_damage",
                    "fire damage affix must not appear for a poison/physical build"
                );
            }
        }
    }

    #[test]
    fn test_element_filter_generic_passes() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        // "flat_hp_suffix" has damage_elements: [] — must appear in suffix wishlist for any build.
        let found = analysis
            .slot_rankings
            .iter()
            .any(|r| r.ideal_suffix.iter().any(|a| a.affix_id == "flat_hp_suffix"));
        assert!(
            found,
            "flat_hp_suffix (generic, no element restriction) must appear in a suffix wishlist"
        );
    }

    #[test]
    fn test_ideal_prefix_suffix_ranking() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        let helm = analysis
            .slot_rankings
            .iter()
            .find(|r| r.slot == "helm")
            .expect("helm slot must be present in rankings");

        // Only spell_increased_damage and poison_damage pass all filters for this build.
        let valid_prefixes = ["spell_increased_damage", "poison_damage"];
        for affix in &helm.ideal_prefix {
            assert!(
                valid_prefixes.contains(&affix.affix_id.as_str()),
                "unexpected prefix affix in wishlist: {}",
                affix.affix_id
            );
        }
        // flat_hp_suffix is the only valid suffix.
        for affix in &helm.ideal_suffix {
            assert_eq!(
                affix.affix_id, "flat_hp_suffix",
                "unexpected suffix affix in wishlist: {}",
                affix.affix_id
            );
        }
    }

    #[test]
    fn test_upgrade_score_and_efficiency() {
        let game_data = make_game_data_with_affixes();
        let mut snapshot = make_spell_poison_snapshot();

        // Pre-populate helm with spell_increased_damage at T5.
        // Ideal has 2 prefixes (spell_increased_damage + poison_damage) + 1 suffix (flat_hp_suffix).
        // With one prefix already satisfied, efficiency must be between 0 and 100.
        let mut helm_slot = GearSlotSnapshot::default();
        helm_slot.prefixes.push(AffixEntry {
            affix_id: "spell_increased_damage".to_string(),
            tier: 5,
        });
        snapshot.gear_slots.insert("helm".to_string(), helm_slot);

        let analysis = run_gear_scoring(&snapshot, &game_data);
        let helm = analysis
            .slot_rankings
            .iter()
            .find(|r| r.slot == "helm")
            .expect("helm must be in rankings");

        // With one prefix satisfied, efficiency must be < 100 (still missing poison_damage + flat_hp_suffix).
        assert!(
            helm.efficiency_percent < 100.0,
            "efficiency must be < 100 when slot is partially equipped, got {}",
            helm.efficiency_percent
        );
        assert!(
            helm.efficiency_percent > 0.0,
            "efficiency must be > 0 when some matching affixes present, got {}",
            helm.efficiency_percent
        );

        // The satisfied prefix must be marked satisfied.
        let satisfied_count = helm
            .ideal_prefix
            .iter()
            .filter(|a| a.affix_id == "spell_increased_damage" && a.satisfied)
            .count();
        assert_eq!(satisfied_count, 1, "spell_increased_damage at T5 must be marked satisfied");

        // upgrade_score must be positive (still items to improve).
        assert!(
            helm.upgrade_score > 0.0,
            "upgrade_score must be > 0 when slot has improvement potential"
        );
    }
}
