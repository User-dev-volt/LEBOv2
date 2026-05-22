use std::collections::HashMap;
use scoring_core::{
    game_data::{ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, GameData, NodeEffect},
    modifier::{Condition, ModifierType, StatKey},
};
use crate::services::game_data_service;

/// Constructs `scoring_core::GameData` from the bundled disk JSON files.
/// Called once at startup; result stored in `AppState`.
pub fn build_scoring_game_data(app_handle: &tauri::AppHandle) -> Result<GameData, String> {
    let data_dir = game_data_service::ensure_game_data_dir(app_handle)?;
    let manifest = game_data_service::load_manifest(&data_dir)?;

    let mut node_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
    let mut class_base_stats: HashMap<String, BaseClassStats> = HashMap::new();

    for class_id in &manifest.classes {
        let class_data = game_data_service::load_class_data(&data_dir, class_id)?;

        // Base HP stats per class (Sentinel-family base values; refined in Epic 4)
        let base_stats = derive_class_base_stats(class_id);
        class_base_stats.insert(class_id.clone(), base_stats);

        // Passive tree nodes from base_tree
        for node in &class_data.base_tree.nodes {
            let effects = parse_node_effects(&node.effects, &node.modifier_type);
            if !effects.is_empty() {
                node_effects.insert(node.id.clone(), effects);
            }
        }

        // Mastery passive trees
        for mastery in &class_data.masteries {
            for node in &mastery.passive_tree.nodes {
                let effects = parse_node_effects(&node.effects, &node.modifier_type);
                if !effects.is_empty() {
                    node_effects.insert(node.id.clone(), effects);
                }
            }
        }

        // Skills at class level
        for skill in &class_data.skills {
            for node in &skill.skill_tree.nodes {
                let effects = parse_node_effects(&node.effects, &node.modifier_type);
                if !effects.is_empty() {
                    node_effects.insert(node.id.clone(), effects);
                }
            }
        }
    }

    // Archetype weight table — sorted ascending by slider_upper (required by resolve_archetype_weights).
    // Deferred note from 2.2: enforce sort here.
    let mut archetype_weights = standard_archetype_weights();
    archetype_weights.sort_by_key(|e| e.slider_upper);
    debug_assert!(
        archetype_weights.windows(2).all(|w| w[0].slider_upper < w[1].slider_upper),
        "archetype_weights must be sorted ascending with unique slider_upper values"
    );

    Ok(GameData {
        node_effects,
        archetype_weights,
        class_base_stats,
    })
}

/// Converts `RawGameNode.effects` + the node's `modifier_type` string into scoring-core `NodeEffect`s.
/// One `RawGameNode` can have multiple effects. Each maps to one `NodeEffect`.
/// Unknown tag combinations produce no effect (node silently contributes nothing — FR-A6 fallback).
fn parse_node_effects(
    effects: &[crate::models::game_data::NodeEffect],
    node_modifier_type: &Option<String>,
) -> Vec<NodeEffect> {
    let modifier_type = parse_modifier_type(node_modifier_type.as_deref());
    effects
        .iter()
        .filter_map(|e| {
            let stat_key = tags_to_stat_key(&e.tags, &modifier_type)?;
            let value = extract_value(&e.description)?;
            Some(NodeEffect {
                stat_key,
                modifier_type: modifier_type.clone(),
                value,
                condition: Condition::Always,
            })
        })
        .collect()
}

/// Maps the node-level `modifierType` string to `ModifierType`.
/// Fallback: "increased" (FR-A6).
fn parse_modifier_type(raw: Option<&str>) -> ModifierType {
    match raw {
        Some("more") => ModifierType::More,
        Some("flat") => ModifierType::Flat,
        _ => ModifierType::Increased, // "increased" or missing → additive (FR-A6 fallback)
    }
}

/// Maps tag arrays to a `StatKey`. Returns `None` for unknown/unmapped combinations.
/// Priority: specific > generic. First matching rule wins.
fn tags_to_stat_key(tags: &[String], modifier_type: &ModifierType) -> Option<StatKey> {
    let has = |t: &str| tags.iter().any(|s| s.eq_ignore_ascii_case(t));

    // Damage — delivery-type specific (check before generic DAMAGE)
    if has("DAMAGE") {
        if has("SPELL") { return Some(StatKey::IncreasedSpellDamage); }
        if has("MINION") { return Some(StatKey::IncreasedMinionDamage); }
        if has("AREA") || has("AOE") { return Some(StatKey::IncreasedAreaDamage); }
        if has("RANGED") { return Some(StatKey::IncreasedRangedDamage); }
        if has("MELEE") && *modifier_type == ModifierType::Flat {
            // "+N Melee Physical/Fire/etc. Damage" = flat added damage
            if has("FIRE") { return Some(StatKey::FlatAddedFireDamage); }
            if has("COLD") { return Some(StatKey::FlatAddedColdDamage); }
            if has("LIGHTNING") { return Some(StatKey::FlatAddedLightningDamage); }
            return Some(StatKey::FlatAddedPhysicalDamage);
        }
        if has("MELEE") { return Some(StatKey::IncreasedMeleeDamage); }
        // Element-specific increased damage
        if has("FIRE") { return Some(StatKey::IncreasedFireDamage); }
        if has("COLD") { return Some(StatKey::IncreasedColdDamage); }
        if has("LIGHTNING") { return Some(StatKey::IncreasedLightningDamage); }
        if has("VOID") { return Some(StatKey::IncreasedVoidDamage); }
        if has("POISON") || has("NECROTIC") { return Some(StatKey::IncreasedPoisonDamage); }
        if has("PHYSICAL") && *modifier_type == ModifierType::Flat {
            return Some(StatKey::FlatAddedPhysicalDamage);
        }
        if has("PHYSICAL") { return Some(StatKey::IncreasedPhysicalDamage); }
        return Some(StatKey::IncreasedDamage); // generic
    }

    // Crit
    if has("CRIT_AVOIDANCE") || (has("CRIT") && has("AVOIDANCE")) {
        return Some(StatKey::CriticalStrikeAvoidance);
    }
    if has("CRIT") && (has("MULTIPLIER") || has("MULTI")) {
        return Some(StatKey::CriticalStrikeMultiplier);
    }
    if has("CRIT") && has("CHANCE") {
        return Some(StatKey::CriticalStrikeChance);
    }
    if has("CRIT") { return Some(StatKey::CriticalStrikeChance); } // default crit tag

    // Speed
    if has("ATTACK_SPEED") || (has("ATTACK") && has("SPEED")) {
        return Some(StatKey::AttackSpeed);
    }
    if has("CAST_SPEED") || (has("CAST") && has("SPEED")) {
        return Some(StatKey::CastSpeed);
    }
    if has("MOVEMENT_SPEED") || (has("MOVEMENT") && has("SPEED")) {
        return Some(StatKey::MovementSpeed);
    }

    // Defense — HP
    if has("HEALTH") || has("HP") || has("LIFE") {
        return match modifier_type {
            ModifierType::Flat => Some(StatKey::MaxHp),
            _ => Some(StatKey::MaxHpPercent),
        };
    }

    // Defense — Armor/Ward/Leech/Regen
    if has("ARMOUR") || has("ARMOR") { return Some(StatKey::Armor); }
    if has("WARD") {
        // No FlatWard StatKey yet — flat ward nodes dropped (FR-A6) to avoid scoring flat
        // values (50–200) as ward-per-second. Add a MaxWard/FlatWard key in Epic 4.
        return match modifier_type {
            ModifierType::Flat => None,
            _ => Some(StatKey::WardPerSecond),
        };
    }
    if has("LEECH") { return Some(StatKey::LifeLeechPercent); }
    if has("REGEN") || has("REGENERATION") { return Some(StatKey::HpRegenPerSec); }
    if has("DODGE") { return Some(StatKey::DodgeRating); }

    // Defense — Endurance
    if has("ENDURANCE") {
        if has("THRESHOLD") { return Some(StatKey::EnduranceThreshold); }
        return Some(StatKey::EndurancePercent);
    }

    // Defense — Resistances (check element before generic)
    if has("RESISTANCE") || has("RES") {
        if has("ALL") || has("ALL_RESISTANCE") { return Some(StatKey::AllResistances); }
        if has("FIRE") { return Some(StatKey::FireResistance); }
        if has("COLD") || has("ICE") { return Some(StatKey::ColdResistance); }
        if has("LIGHTNING") || has("SHOCK") { return Some(StatKey::LightningResistance); }
        if has("VOID") { return Some(StatKey::VoidResistance); }
        if has("POISON") || has("NECROTIC") { return Some(StatKey::PoisonResistance); }
        if has("PHYSICAL") { return Some(StatKey::PhysicalResistance); }
        return Some(StatKey::AllResistances); // unqualified RESISTANCE = all
    }

    None // Unknown tag combination → silently dropped (FR-A6)
}

/// Extracts the first numeric value from a description string.
/// "+4 Melee Physical Damage per point" → 4.0
/// "+3% Melee Attack Speed per point" → 3.0
/// "+.5% per point" → 0.5
/// Returns None if no numeric value found (effect is dropped).
fn extract_value(description: &str) -> Option<f64> {
    // Collect (byte_offset, char) pairs so slicing description[s..end] uses byte indices.
    let chars: Vec<(usize, char)> = description.char_indices().collect();
    let n = chars.len();
    let mut start: Option<usize> = None; // byte offset
    let mut end: usize = 0;             // byte offset (exclusive)
    let mut i = 0;
    while i < n {
        let (byte_i, ch) = chars[i];
        // Byte offset of the character *after* this one (used for end).
        let next_byte = if i + 1 < n { chars[i + 1].0 } else { description.len() };
        if ch.is_ascii_digit() {
            if start.is_none() {
                // Look back for optional leading dot and/or sign: handles "+5", ".5", "+.5"
                start = Some(if i > 0 && (chars[i - 1].1 == '+' || chars[i - 1].1 == '-') {
                    chars[i - 1].0
                } else if i > 0 && chars[i - 1].1 == '.' {
                    if i > 1 && (chars[i - 2].1 == '+' || chars[i - 2].1 == '-') {
                        chars[i - 2].0
                    } else {
                        chars[i - 1].0
                    }
                } else {
                    byte_i
                });
            }
            end = next_byte;
        } else if ch == '.' && start.is_some() && i + 1 < n && chars[i + 1].1.is_ascii_digit() {
            end = next_byte;
        } else if start.is_some() {
            break;
        }
        i += 1;
    }
    start.and_then(|s| description[s..end].parse::<f64>().ok())
}

/// Standard 5-band archetype weight table covering slider positions 0–100.
/// Deferred from 2.2: archetype_weights must be sorted ascending. `build_scoring_game_data`
/// sorts this before storing.
fn standard_archetype_weights() -> Vec<ArchetypeWeightsEntry> {
    vec![
        ArchetypeWeightsEntry { slider_upper: 24, weights: ArchetypeWeights { w_dmg: 0.75, w_surv: 0.15, w_speed: 0.10 } }, // Glass Cannon
        ArchetypeWeightsEntry { slider_upper: 49, weights: ArchetypeWeights { w_dmg: 0.65, w_surv: 0.25, w_speed: 0.10 } }, // Lean DPS
        ArchetypeWeightsEntry { slider_upper: 74, weights: ArchetypeWeights { w_dmg: 0.55, w_surv: 0.35, w_speed: 0.10 } }, // Balanced
        ArchetypeWeightsEntry { slider_upper: 89, weights: ArchetypeWeights { w_dmg: 0.40, w_surv: 0.50, w_speed: 0.10 } }, // Lean Tank
        ArchetypeWeightsEntry { slider_upper: 100, weights: ArchetypeWeights { w_dmg: 0.25, w_surv: 0.65, w_speed: 0.10 } }, // Juggernaut
    ]
}

/// Placeholder base HP stats per class — conservative values used until Epic 4 refines them.
/// Scoring fallback in `compute_defense` already handles missing class: (base_hp: 100.0, hp_per_level: 5.0).
fn derive_class_base_stats(class_id: &str) -> BaseClassStats {
    match class_id {
        "sentinel" => BaseClassStats { base_hp: 90.0, hp_per_level: 5.0 },
        "mage"     => BaseClassStats { base_hp: 70.0, hp_per_level: 4.0 },
        "primalist"=> BaseClassStats { base_hp: 85.0, hp_per_level: 5.0 },
        "rogue"    => BaseClassStats { base_hp: 75.0, hp_per_level: 5.0 },
        "acolyte"  => BaseClassStats { base_hp: 70.0, hp_per_level: 4.0 },
        _          => BaseClassStats { base_hp: 80.0, hp_per_level: 5.0 }, // unknown class
    }
}
