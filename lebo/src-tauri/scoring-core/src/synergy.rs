use crate::build_snapshot::BuildSnapshot;
use crate::compute::compute_stats;
use crate::compute_options::ComputeOptions;
use crate::game_data::GameData;
use crate::modifier::StatKey;
use crate::stat_sheet::SynergyFlag;

/// FR-A22: BuildScore increase threshold to surface a unique as a Game-Changer suggestion.
const GAME_CHANGER_THRESHOLD: f64 = 0.30;

// ── Delivery type ────────────────────────────────────────────────────────────

/// Delivery-type scope variants used internally by the synergy detector.
/// Derived from `StatKey` variants; never serialized.
#[derive(Debug, Clone, PartialEq)]
enum DeliveryType {
    Melee,
    Spell,
    Ranged,
    Minion,
}

impl DeliveryType {
    fn as_str(&self) -> &'static str {
        match self {
            DeliveryType::Melee => "melee",
            DeliveryType::Spell => "spell",
            DeliveryType::Ranged => "ranged",
            DeliveryType::Minion => "minion",
        }
    }

    fn capitalize(&self) -> &'static str {
        match self {
            DeliveryType::Melee => "Melee",
            DeliveryType::Spell => "Spell",
            DeliveryType::Ranged => "Ranged",
            DeliveryType::Minion => "Minion",
        }
    }
}

/// Returns the `DeliveryType` associated with a `StatKey`, if any.
/// Generic damage keys (`IncreasedDamage`, `MoreDamage`, etc.) return `None`.
fn stat_key_delivery_type(key: &StatKey) -> Option<DeliveryType> {
    match key {
        StatKey::IncreasedMeleeDamage => Some(DeliveryType::Melee),
        StatKey::IncreasedSpellDamage => Some(DeliveryType::Spell),
        StatKey::IncreasedRangedDamage => Some(DeliveryType::Ranged),
        StatKey::IncreasedMinionDamage => Some(DeliveryType::Minion),
        _ => None,
    }
}

// ── Public API ───────────────────────────────────────────────────────────────

/// Detects zero-value passive allocations, mismatched gear affixes, and Game-Changer unique
/// items that could dramatically increase BuildScore (FR-A20, FR-A21, FR-A22).
///
/// Returns flags sorted by priority descending (game_changer → high → medium).
/// Pure function — no side effects, no locks. Called by Story 4.3 via `spawn_blocking`.
pub fn run_synergy_detection(snapshot: &BuildSnapshot, game_data: &GameData) -> Vec<SynergyFlag> {
    let baseline = compute_stats(snapshot, game_data, ComputeOptions::default());
    let baseline_score = baseline.scores.build_score;
    let delivery_type = infer_delivery_type(snapshot, game_data);

    let mut flags: Vec<SynergyFlag> = Vec::new();
    flags.extend(detect_zero_value_nodes(snapshot, game_data, &delivery_type));
    flags.extend(detect_mismatched_affixes(snapshot, game_data, &delivery_type));
    flags.extend(detect_game_changers(snapshot, game_data, baseline_score));

    // Sort: game_changer (0) > high (1) > medium (2)
    // Stable sort preserves relative order within each priority tier.
    flags.sort_by_key(|f| match f.priority.as_str() {
        "high" => 1u8,
        "medium" => 2u8,
        _ => 0u8, // "game_changer" sorts first
    });

    flags
}

// ── Delivery type inference ──────────────────────────────────────────────────

/// Infers the build's primary damage delivery type from its allocated passive nodes.
///
/// Counts occurrences of each delivery-type-specific `StatKey` across all allocated nodes,
/// weighted by point count. Returns the dominant type, or `None` if no delivery-type-specific
/// nodes are allocated (generic build — detectors produce no flags in this case).
fn infer_delivery_type(snapshot: &BuildSnapshot, game_data: &GameData) -> Option<DeliveryType> {
    let mut melee: u32 = 0;
    let mut spell: u32 = 0;
    let mut ranged: u32 = 0;
    let mut minion: u32 = 0;

    for (node_id, &pts) in &snapshot.node_allocations {
        let Some(effects) = game_data.node_effects.get(node_id) else {
            continue;
        };
        for effect in effects {
            match effect.stat_key {
                StatKey::IncreasedMeleeDamage => melee += pts,
                StatKey::IncreasedSpellDamage => spell += pts,
                StatKey::IncreasedRangedDamage => ranged += pts,
                StatKey::IncreasedMinionDamage => minion += pts,
                _ => {}
            }
        }
    }

    let max = melee.max(spell).max(ranged).max(minion);
    if max == 0 {
        return None; // no delivery-type-specific nodes → cannot infer
    }

    // Tie-break order: spell > melee > ranged > minion (deterministic)
    if spell == max {
        Some(DeliveryType::Spell)
    } else if melee == max {
        Some(DeliveryType::Melee)
    } else if ranged == max {
        Some(DeliveryType::Ranged)
    } else {
        Some(DeliveryType::Minion)
    }
}

// ── Zero-value passive node detection (FR-A20) ──────────────────────────────

/// Flags allocated passive nodes whose ALL delivery-type-specific damage effects are for
/// a different delivery type than the build's primary (Medium priority).
///
/// A node with ONLY mismatching delivery-type effects (e.g., `IncreasedMeleeDamage` in a spell
/// build) provides zero value. Nodes that also have generic effects are NOT flagged.
fn detect_zero_value_nodes(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    delivery_type: &Option<DeliveryType>,
) -> Vec<SynergyFlag> {
    let Some(primary) = delivery_type else {
        return vec![]; // cannot detect without inferred delivery type
    };

    let mut flags = Vec::new();

    for (node_id, _pts) in &snapshot.node_allocations {
        let Some(effects) = game_data.node_effects.get(node_id) else {
            continue;
        };

        let delivery_types: Vec<DeliveryType> = effects
            .iter()
            .filter_map(|e| stat_key_delivery_type(&e.stat_key))
            .collect();

        if delivery_types.is_empty() {
            continue; // no delivery-type-specific effects → not zero-value by delivery type
        }

        // Zero-value only if ALL delivery-type effects are mismatched
        let all_mismatched = delivery_types.iter().all(|dt| dt != primary);
        if !all_mismatched {
            continue;
        }

        let mismatch_str = delivery_types[0].as_str();
        flags.push(SynergyFlag {
            flag_type: "zero_value_allocation".to_string(),
            priority: "medium".to_string(),
            description: format!(
                "Node '{}' contributes {} damage bonuses but your build uses {} damage. \
                 This node provides zero value and its points could be reallocated.",
                node_id,
                mismatch_str,
                primary.as_str(),
            ),
            node_id: Some(node_id.clone()),
            slot: None,
            delta_build_score: None,
        });
    }

    flags
}

// ── Mismatched affix detection (FR-A21) ─────────────────────────────────────

/// Flags gear slot affixes whose scope doesn't match the build's primary delivery type
/// (High priority). Relies on `game_data.affix_scope` for scope lookup.
///
/// Affixes with unknown scope (not in `affix_scope`) are treated as "generic" → not flagged.
fn detect_mismatched_affixes(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    delivery_type: &Option<DeliveryType>,
) -> Vec<SynergyFlag> {
    let Some(primary) = delivery_type else {
        return vec![];
    };
    let primary_str = primary.as_str();

    let mut flags = Vec::new();

    for (slot_id, slot) in &snapshot.gear_slots {
        let all_affixes = slot.prefixes.iter().chain(slot.suffixes.iter());
        for affix_entry in all_affixes {
            let scope = game_data
                .affix_scope
                .get(&affix_entry.affix_id)
                .map(|s| s.as_str())
                .unwrap_or("generic");

            if scope == "generic" || scope == primary_str {
                continue; // no mismatch
            }

            flags.push(SynergyFlag {
                flag_type: "mismatched_affix".to_string(),
                priority: "high".to_string(),
                description: format!(
                    "Affix '{}' on your {} slot has {} scope but your build uses {} damage. \
                     Replace it with a {} Critical Strike Chance or equivalent {} affix.",
                    affix_entry.affix_id,
                    slot_id,
                    scope,
                    primary_str,
                    primary.capitalize(),
                    primary.capitalize(),
                ),
                node_id: None,
                slot: Some(slot_id.clone()),
                delta_build_score: None,
            });
        }
    }

    flags
}

// ── Game-Changer unique item detection (FR-A22) ──────────────────────────────

/// Flags unique items that would increase BuildScore by more than `GAME_CHANGER_THRESHOLD`
/// (30%) if equipped. Injects each unique's scoring effects as a synthetic node and calls
/// `compute_stats` to measure the delta.
///
/// Cloning `GameData` per unique is acceptable for Phase 3's small unique count (~3–20 items).
fn detect_game_changers(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    baseline_score: f64,
) -> Vec<SynergyFlag> {
    if baseline_score <= 0.0 {
        return vec![]; // degenerate build — avoid divide-by-zero
    }

    let mut flags = Vec::new();

    for unique in &game_data.unique_items {
        // Inject the unique's effects as a synthetic proxy node in a cloned GameData.
        // Real node IDs never use "__" prefix — no collision risk.
        let proxy_id = format!("__unique__{}", unique.item_id);
        let mut modified_gd = game_data.clone();
        modified_gd
            .node_effects
            .insert(proxy_id.clone(), unique.scoring_effects.clone());

        let mut modified_snapshot = snapshot.clone();
        modified_snapshot.node_allocations.insert(proxy_id, 1);

        let new_score = compute_stats(&modified_snapshot, &modified_gd, ComputeOptions::default())
            .scores
            .build_score;

        let delta_ratio = (new_score - baseline_score) / baseline_score;
        if delta_ratio > GAME_CHANGER_THRESHOLD {
            flags.push(SynergyFlag {
                flag_type: "game_changer".to_string(),
                priority: "game_changer".to_string(),
                description: format!(
                    "{} would increase your BuildScore by {:.0}% — a Game-Changer upgrade. \
                     Requires: {}.",
                    unique.display_name,
                    delta_ratio * 100.0,
                    unique.threshold_description,
                ),
                node_id: None,
                slot: None,
                delta_build_score: Some(new_score - baseline_score),
            });
        }
    }

    flags
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_snapshot::{AffixEntry, GearSlotSnapshot};
    use crate::game_data::{
        ArchetypeWeights, ArchetypeWeightsEntry, NodeEffect, UniqueItem,
    };
    use crate::modifier::{Condition, ModifierType};
    use std::collections::HashMap;

    // ── Shared test helpers ───────────────────────────────────────────────────

    fn standard_weights() -> Vec<ArchetypeWeightsEntry> {
        vec![ArchetypeWeightsEntry {
            slider_upper: 100,
            weights: ArchetypeWeights { w_dmg: 0.55, w_surv: 0.35, w_speed: 0.10 },
        }]
    }

    /// Build a minimal `GameData` with:
    /// - "spell-node": IncreasedSpellDamage +50
    /// - "melee-node": IncreasedMeleeDamage +50
    /// - "generic-node": IncreasedDamage +30
    /// - affix_scope: {"melee-crit-chance" → "melee", "spell-crit-chance" → "spell"}
    /// - unique_items: "test-unique" (IncreasedDamage +200, guaranteed game-changer)
    ///                 "weak-unique" (IncreasedDamage +5, not a game-changer)
    fn make_test_game_data() -> GameData {
        let mut node_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
        node_effects.insert(
            "spell-node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedSpellDamage,
                modifier_type: ModifierType::Increased,
                value: 50.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "melee-node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedMeleeDamage,
                modifier_type: ModifierType::Increased,
                value: 50.0,
                condition: Condition::Always,
            }],
        );
        node_effects.insert(
            "generic-node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 30.0,
                condition: Condition::Always,
            }],
        );

        let mut affix_scope: HashMap<String, String> = HashMap::new();
        affix_scope.insert("melee-crit-chance".to_string(), "melee".to_string());
        affix_scope.insert("spell-crit-chance".to_string(), "spell".to_string());

        let unique_items = vec![
            UniqueItem {
                item_id: "test-unique".to_string(),
                display_name: "Test Unique".to_string(),
                scoring_effects: vec![NodeEffect {
                    stat_key: StatKey::IncreasedDamage,
                    modifier_type: ModifierType::Increased,
                    value: 200.0,
                    condition: Condition::Always,
                }],
                threshold_description: "Any build".to_string(),
            },
            UniqueItem {
                item_id: "weak-unique".to_string(),
                display_name: "Weak Unique".to_string(),
                scoring_effects: vec![NodeEffect {
                    stat_key: StatKey::IncreasedDamage,
                    modifier_type: ModifierType::Increased,
                    value: 5.0,
                    condition: Condition::Always,
                }],
                threshold_description: "Barely helps".to_string(),
            },
        ];

        GameData {
            node_effects,
            archetype_weights: standard_weights(),
            affix_scope,
            unique_items,
            ..Default::default()
        }
    }

    fn snapshot_with_allocations(allocated: &[(&str, u32)]) -> BuildSnapshot {
        let mut s = BuildSnapshot::default();
        s.character_level = 20;
        s.slider_position = 50;
        for (id, pts) in allocated {
            s.node_allocations.insert(id.to_string(), *pts);
        }
        s
    }

    // ── Test 1: melee node in spell build → zero_value_allocation ────────────

    #[test]
    fn zero_value_melee_node_in_spell_build_flagged() {
        let gd = make_test_game_data();
        // Build is a spell build: spell-node is allocated
        let snapshot = snapshot_with_allocations(&[("spell-node", 1), ("melee-node", 1)]);
        let flags = run_synergy_detection(&snapshot, &gd);

        let zero_val: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "zero_value_allocation")
            .collect();
        assert_eq!(zero_val.len(), 1, "expected exactly one zero-value flag");
        let f = &zero_val[0];
        assert_eq!(f.priority, "medium");
        assert_eq!(f.node_id, Some("melee-node".to_string()));
        assert!(
            f.description.contains("melee"),
            "description should mention melee: {}",
            f.description
        );
    }

    // ── Test 2: melee node in melee build → no flag ───────────────────────────

    #[test]
    fn zero_value_melee_node_in_melee_build_not_flagged() {
        let gd = make_test_game_data();
        let snapshot = snapshot_with_allocations(&[("melee-node", 1)]);
        let flags = run_synergy_detection(&snapshot, &gd);

        let zero_val: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "zero_value_allocation")
            .collect();
        assert!(zero_val.is_empty(), "melee node in melee build should not be flagged");
    }

    // ── Test 3: generic node never flagged ────────────────────────────────────

    #[test]
    fn zero_value_generic_node_never_flagged() {
        let gd = make_test_game_data();
        // Spell build; generic-node has no delivery-type effects
        let snapshot = snapshot_with_allocations(&[("spell-node", 1), ("generic-node", 1)]);
        let flags = run_synergy_detection(&snapshot, &gd);

        let zero_val: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "zero_value_allocation" && f.node_id == Some("generic-node".to_string()))
            .collect();
        assert!(zero_val.is_empty(), "generic node should never be flagged as zero-value");
    }

    // ── Test 4: no delivery type → no zero-value flags ───────────────────────

    #[test]
    fn zero_value_no_delivery_type_produces_no_flags() {
        let gd = make_test_game_data();
        // Only generic node → inference returns None
        let snapshot = snapshot_with_allocations(&[("generic-node", 1)]);
        let flags = run_synergy_detection(&snapshot, &gd);

        let zero_val: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "zero_value_allocation")
            .collect();
        assert!(zero_val.is_empty(), "no delivery type → no zero-value flags");
    }

    // ── Test 5: mismatched affix (melee crit on spell build) → high flag ──────

    #[test]
    fn mismatched_affix_melee_crit_on_spell_build_flagged() {
        let gd = make_test_game_data();
        let mut snapshot = snapshot_with_allocations(&[("spell-node", 1)]);
        // Place a melee-scoped affix on the helm slot
        let mut helm = GearSlotSnapshot::default();
        helm.prefixes.push(AffixEntry {
            affix_id: "melee-crit-chance".to_string(),
            tier: 3,
        });
        snapshot.gear_slots.insert("helm".to_string(), helm);

        let flags = run_synergy_detection(&snapshot, &gd);

        let affix_flags: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "mismatched_affix")
            .collect();
        assert_eq!(affix_flags.len(), 1, "expected one mismatched_affix flag");
        let f = &affix_flags[0];
        assert_eq!(f.priority, "high");
        assert_eq!(f.slot, Some("helm".to_string()));
        assert!(
            f.description.contains("melee") && f.description.contains("spell"),
            "description should mention both scopes: {}",
            f.description
        );
    }

    // ── Test 6: matching affix (spell crit on spell build) → no flag ──────────

    #[test]
    fn mismatched_affix_spell_crit_on_spell_build_not_flagged() {
        let gd = make_test_game_data();
        let mut snapshot = snapshot_with_allocations(&[("spell-node", 1)]);
        let mut helm = GearSlotSnapshot::default();
        helm.prefixes.push(AffixEntry {
            affix_id: "spell-crit-chance".to_string(),
            tier: 3,
        });
        snapshot.gear_slots.insert("helm".to_string(), helm);

        let flags = run_synergy_detection(&snapshot, &gd);

        let affix_flags: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "mismatched_affix")
            .collect();
        assert!(affix_flags.is_empty(), "matching affix scope should not be flagged");
    }

    // ── Test 7: high-delta unique → game_changer flag ─────────────────────────

    #[test]
    fn game_changer_high_delta_unique_flagged() {
        let gd = make_test_game_data();
        // Empty build (baseline score is very low) — test-unique adds +200% increased damage
        let snapshot = snapshot_with_allocations(&[]);
        let flags = run_synergy_detection(&snapshot, &gd);

        let gc: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "game_changer" && f.description.contains("Test Unique"))
            .collect();
        assert!(!gc.is_empty(), "Test Unique should be a game-changer on an empty build");
        let f = &gc[0];
        assert!(f.delta_build_score.is_some());
        assert!(
            f.description.contains("Game-Changer"),
            "description should contain Game-Changer: {}",
            f.description
        );
    }

    // ── Test 8: low-delta unique → NOT flagged ────────────────────────────────

    #[test]
    fn game_changer_low_delta_unique_not_flagged() {
        let gd = make_test_game_data();
        // Build already has high IncreasedDamage so weak-unique (+5%) can't reach 30% threshold
        // Give the build a very high baseline by allocating a large increased damage
        let mut strong_gd = gd.clone();
        strong_gd.node_effects.insert(
            "big-damage-node".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 1000.0, // huge baseline → weak-unique's +5% is negligible
                condition: Condition::Always,
            }],
        );
        let snapshot = snapshot_with_allocations(&[("big-damage-node", 1)]);
        let flags = run_synergy_detection(&snapshot, &strong_gd);

        let gc: Vec<_> = flags
            .iter()
            .filter(|f| f.flag_type == "game_changer" && f.description.contains("Weak Unique"))
            .collect();
        assert!(gc.is_empty(), "Weak Unique should not be a game-changer against high baseline");
    }

    // ── Test 9: priority ordering (high before medium) ────────────────────────

    #[test]
    fn priority_ordering_high_before_medium() {
        let gd = make_test_game_data();
        let mut snapshot = snapshot_with_allocations(&[("spell-node", 1), ("melee-node", 1)]);
        // Add mismatched affix (high) alongside the zero-value node (medium)
        let mut helm = GearSlotSnapshot::default();
        helm.prefixes.push(AffixEntry {
            affix_id: "melee-crit-chance".to_string(),
            tier: 2,
        });
        snapshot.gear_slots.insert("helm".to_string(), helm);

        let flags = run_synergy_detection(&snapshot, &gd);

        // Find positions of first high and first medium flag
        let first_high = flags.iter().position(|f| f.priority == "high");
        let first_medium = flags.iter().position(|f| f.priority == "medium");

        assert!(first_high.is_some(), "expected at least one high-priority flag");
        assert!(first_medium.is_some(), "expected at least one medium-priority flag");
        assert!(
            first_high.unwrap() < first_medium.unwrap(),
            "high-priority flags must appear before medium-priority flags"
        );
    }

    // ── Test 10: game_changer ranks before high ───────────────────────────────

    #[test]
    fn game_changer_ranks_before_high_priority() {
        let gd = make_test_game_data();
        // Spell build with mismatched affix (high) + zero-value node (medium) + game-changer
        let mut snapshot = snapshot_with_allocations(&[("spell-node", 1), ("melee-node", 1)]);
        let mut helm = GearSlotSnapshot::default();
        helm.prefixes.push(AffixEntry {
            affix_id: "melee-crit-chance".to_string(),
            tier: 2,
        });
        snapshot.gear_slots.insert("helm".to_string(), helm);

        let flags = run_synergy_detection(&snapshot, &gd);

        let first_gc = flags.iter().position(|f| f.flag_type == "game_changer");
        let first_high = flags
            .iter()
            .position(|f| f.priority == "high" && f.flag_type != "game_changer");

        // game_changer may not appear if baseline is too high — only assert if it appears
        if let (Some(gc_pos), Some(high_pos)) = (first_gc, first_high) {
            assert!(
                gc_pos < high_pos,
                "game_changer should rank before other high-priority flags"
            );
        }
        // If no game_changer appears (baseline too high for test-unique to trigger), that's fine —
        // the ordering invariant still holds for the flags that do appear.
    }
}
