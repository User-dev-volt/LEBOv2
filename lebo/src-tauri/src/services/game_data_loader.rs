use std::collections::HashMap;
use scoring_core::{
    game_data::{ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, GameData, IdolAffixEffect, NodeEffect},
    modifier::{Condition, ModifierType, Scope, StatKey},
};
use crate::services::game_data_service;

/// Constructs `scoring_core::GameData` from the bundled disk JSON files.
/// Called once at startup; result stored in `AppState`.
pub fn build_scoring_game_data(app_handle: &tauri::AppHandle) -> Result<GameData, String> {
    let data_dir = game_data_service::ensure_game_data_dir(app_handle)?;
    let manifest = game_data_service::load_manifest(&data_dir)?;

    let mut node_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
    let mut class_base_stats: HashMap<String, BaseClassStats> = HashMap::new();
    let mut node_connections: HashMap<String, Vec<String>> = HashMap::new();
    let mut node_max_points: HashMap<String, u32> = HashMap::new();
    let mut node_mastery_depth: HashMap<String, u32> = HashMap::new();

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
            node_max_points.insert(node.id.clone(), node.max_points);
        }

        // Base tree edges — undirected adjacency list
        for edge in &class_data.base_tree.edges {
            node_connections
                .entry(edge.from_id.clone())
                .or_default()
                .push(edge.to_id.clone());
            node_connections
                .entry(edge.to_id.clone())
                .or_default()
                .push(edge.from_id.clone());
        }

        // Mastery passive trees
        for mastery in &class_data.masteries {
            for node in &mastery.passive_tree.nodes {
                let effects = parse_node_effects(&node.effects, &node.modifier_type);
                if !effects.is_empty() {
                    node_effects.insert(node.id.clone(), effects);
                }
                node_max_points.insert(node.id.clone(), node.max_points);
            }

            // Mastery tree edges — undirected
            for edge in &mastery.passive_tree.edges {
                node_connections
                    .entry(edge.from_id.clone())
                    .or_default()
                    .push(edge.to_id.clone());
                node_connections
                    .entry(edge.to_id.clone())
                    .or_default()
                    .push(edge.from_id.clone());
            }

            // BFS from mastery entry node to compute mastery depth for each mastery sub-tree node.
            // Entry node = first node in the mastery passive_tree (by convention).
            // Depth 1 = entry node; depth increases for each step further into the mastery.
            if let Some(entry_node) = mastery.passive_tree.nodes.first() {
                let mastery_node_ids: std::collections::HashSet<&str> =
                    mastery.passive_tree.nodes.iter().map(|n| n.id.as_str()).collect();
                let mut queue = std::collections::VecDeque::new();
                queue.push_back((entry_node.id.clone(), 1u32));
                let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();
                while let Some((node_id, depth)) = queue.pop_front() {
                    if visited.contains(&node_id) {
                        continue;
                    }
                    visited.insert(node_id.clone());
                    node_mastery_depth.insert(node_id.clone(), depth);
                    if let Some(neighbors) = node_connections.get(&node_id) {
                        for neighbor in neighbors.clone() {
                            if mastery_node_ids.contains(neighbor.as_str()) && !visited.contains(&neighbor) {
                                queue.push_back((neighbor, depth + 1));
                            }
                        }
                    }
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
            // Skill tree nodes and edges are NOT added to node_connections or node_max_points:
            // the efficiency scan is passive-tree-only (skill allocations use skillNodeAllocations).
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

    // Load idol affix scoring data from idol-data.json (lives in context-data dir, not game-data dir)
    let context_data_dir = super::context_data_service::copy_bundled_context_resources(app_handle)
        .map_err(|e| format!("idol-data load failed: {e}"))?;
    let idol_data = super::context_data_service::load_idol_data_from_dir(&context_data_dir)
        .map_err(|e| format!("idol-data load failed: {e}"))?;
    let mut idol_affixes: HashMap<String, IdolAffixEffect> = HashMap::new();
    for idol_type in &idol_data.idol_types {
        for affix in idol_type.prefix_pool.iter().chain(idol_type.suffix_pool.iter()) {
            if let Some(stat_key) = stat_key_from_str(&affix.stat_key) {
                let modifier_type = ModifierType::from_data_str(Some(&affix.modifier_type));
                let values_by_tier: HashMap<u32, f64> = affix
                    .tiers
                    .iter()
                    .map(|t| (t.tier, (t.min_value + t.max_value) / 2.0))
                    .collect();
                idol_affixes.insert(
                    affix.id.clone(),
                    IdolAffixEffect { stat_key, modifier_type, values_by_tier },
                );
            }
        }
    }

    // Load blessing scoring effects from blessings.json
    let blessings_db = super::context_data_service::load_blessings_from_dir(&context_data_dir)
        .map_err(|e| format!("blessings load failed: {e}"))?;
    let mut blessing_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
    for blessing in &blessings_db {
        let mut effects: Vec<NodeEffect> = Vec::new();
        for stat_effect in &blessing.stat_effects {
            if let Some(stat_key) = stat_key_from_str(&stat_effect.stat_key) {
                let modifier_type = ModifierType::from_data_str(Some(&stat_effect.modifier_type));
                effects.push(NodeEffect {
                    stat_key,
                    modifier_type,
                    value: stat_effect.value,
                    condition: Condition::Always,
                });
            }
            // Unknown stat_key → silently skipped (same pattern as idol affixes)
        }
        if !effects.is_empty() {
            blessing_effects.insert(blessing.id.clone(), effects);
        }
    }

    // affix_scope: populated from affix DB when available; empty HashMap degrades gracefully.
    // No affix-scope JSON source exists yet — mismatched_affix detection relies on this being
    // populated in a future story once the full affix DB is parsed with scope fields.
    let affix_scope: HashMap<String, Scope> = HashMap::new();

    // unique_items: seed with the three PRD-named build-enabling uniques (FR-A22).
    // Effects are approximate Phase-3 models; expanded when the item database is fully parsed.
    let unique_items = build_seeded_unique_items();

    Ok(GameData {
        node_effects,
        archetype_weights,
        class_base_stats,
        idol_affixes,
        blessing_effects,
        node_connections,
        node_max_points,
        node_mastery_depth,
        affix_scope,
        unique_items,
        gear_affixes: std::collections::HashMap::new(),
    })
}

/// Converts `RawGameNode.effects` + the node's `modifier_type` string into scoring-core `NodeEffect`s.
/// One `RawGameNode` effect entry can yield **multiple** `NodeEffect`s.
/// Unknown tag combinations produce no effect (node silently contributes nothing — FR-A6 fallback).
///
/// Each effect entry contributes up to two modifiers:
///  1. The historical **single-stat** mapping: `tags_to_stat_key(tags)` + the first number in
///     the whole description (`extract_value`). This path is byte-identical to pre-1.2 behaviour,
///     so every non-penetration effect — including the damage clause of a `DAMAGE`+`PENETRATION`
///     node — parses exactly as before and the Phase-3 aggregate parity is preserved by construction.
///  2. An **additive penetration** modifier, emitted only when the effect carries a `PENETRATION`
///     tag. Penetration cannot ride on `tags_to_stat_key`: the dominant pen nodes are co-tagged
///     `DAMAGE` (the `has("DAMAGE")` branch short-circuits to the damage key first) and the shared
///     `tags` array is a superset spanning every clause, so it cannot distinguish the pen clause
///     from the damage clause. Instead `parse_penetration_clause` reads the description **prose**
///     (e.g. "Void Penetration" → `VoidPenetration`) and parses that clause's own value.
fn parse_node_effects(
    effects: &[crate::models::game_data::NodeEffect],
    node_modifier_type: &Option<String>,
) -> Vec<NodeEffect> {
    let modifier_type = ModifierType::from_data_str(node_modifier_type.as_deref());
    let mut out: Vec<NodeEffect> = Vec::new();
    for e in effects {
        // (1) Unchanged single-stat path — byte-identical to pre-1.2 parsing.
        if let Some(stat_key) = tags_to_stat_key(&e.tags, &modifier_type) {
            if let Some(value) = extract_value(&e.description) {
                out.push(NodeEffect {
                    stat_key,
                    modifier_type: modifier_type.clone(),
                    value,
                    condition: Condition::Always,
                });
            }
        }
        // (2) Additive penetration sourcing (prose-based; only for PENETRATION-tagged effects).
        if e.tags.iter().any(|t| t.eq_ignore_ascii_case("PENETRATION")) {
            if let Some(pen) = parse_penetration_clause(&e.description) {
                out.push(pen);
            }
        }
    }
    out
}

/// Parses the penetration clause of an effect description into a `Flat` penetration `NodeEffect`.
/// Returns `None` when the clause's element is not a modeled LE penetration type (Holy/Chaos are
/// dropped — they are not modeled types, same class as "Corruption"; Necrotic/Poison have no key).
///
/// Penetration is always `Flat`: it is an additive percentage subtracted from enemy resistance,
/// not an "increased" multiplier on a base. The shipped pen nodes carry `modifierType: "increased"`
/// for their *damage* clause, so we must force `Flat` here — `compute_penetration` filters `Flat`
/// (mirroring the crit/stun pattern), and a naive `Increased` value would be silently ignored.
fn parse_penetration_clause(description: &str) -> Option<NodeEffect> {
    // The pen clause is the sentence-fragment mentioning "penetration". Descriptions separate
    // clauses with ". " (e.g. "+4% Void Damage. +2% Void Penetration per point. ..."). For a
    // single-clause pure-pen node the whole string is the clause.
    let clause = description
        .split(". ")
        .find(|c| c.to_ascii_lowercase().contains("penetration"))?;
    let lower = clause.to_ascii_lowercase();
    // Specific elements before the generic "elemental" keyword (no clause carries both).
    let stat_key = if lower.contains("fire") {
        StatKey::FirePenetration
    } else if lower.contains("cold") {
        StatKey::ColdPenetration
    } else if lower.contains("lightning") {
        StatKey::LightningPenetration
    } else if lower.contains("void") {
        StatKey::VoidPenetration
    } else if lower.contains("physical") {
        StatKey::PhysicalPenetration
    } else if lower.contains("elemental") {
        StatKey::ElementalPenetration
    } else {
        // holy / chaos / necrotic / poison / unqualified → not a modeled pen type → dropped.
        return None;
    };
    let value = extract_value(clause)?;
    Some(NodeEffect {
        stat_key,
        modifier_type: ModifierType::Flat,
        value,
        condition: Condition::Always,
    })
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
        // Element-specific increased damage. DoT-ailment tags (IGNITE, BLEED) are checked
        // before their parent element (FIRE/PHYSICAL) so explicitly-DoT nodes land on the
        // DoT key feeding the per-type increased_dot/more_dot split. All branches here
        // still return Some, so the golden effect-count (179) is unchanged by this remap.
        if has("IGNITE") { return Some(StatKey::IncreasedIgniteDamage); }
        if has("FIRE") { return Some(StatKey::IncreasedFireDamage); }
        if has("COLD") { return Some(StatKey::IncreasedColdDamage); }
        if has("LIGHTNING") { return Some(StatKey::IncreasedLightningDamage); }
        if has("VOID") { return Some(StatKey::IncreasedVoidDamage); }
        if has("POISON") { return Some(StatKey::IncreasedPoisonDamage); }
        if has("NECROTIC") { return Some(StatKey::IncreasedNecroticDamage); }
        if has("BLEED") { return Some(StatKey::IncreasedBleedDamage); }
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

    // Defense — Healing Effectiveness (FR-5, Story 1.3). HEALING is distinct from the HEALTH/HP
    // tag above; HEALING nodes also carrying DAMAGE already returned in the damage branch.
    // Precedence is intentional (first-match-wins, single-key model): a node tagged both HEALTH
    // and HEALING maps to HP, NOT HealingEffectiveness. No such combined node ships today (all 4
    // HEALING tags resolve as 3 pure-healing + 1 healing+damage), so this is a documented guard
    // against future data, not a current misroute.
    if has("HEALING") { return Some(StatKey::HealingEffectiveness); }

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
    // Block (FR-5, Story 1.3). Checked AFTER ARMOUR so ARMOUR+BLOCK nodes stay on Armor
    // (unchanged). BLOCK is the only block-related tag — chance and effectiveness are not
    // tagged separately, so this sources block_chance only (block_effectiveness has no key).
    if has("BLOCK") { return Some(StatKey::BlockChance); }

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
        // Necrotic split (Story 1.3/AC2): NECROTIC is the 7th resistance, no longer conflated
        // into Poison. Checked before POISON; both keys already exist. Count-neutral remap.
        if has("NECROTIC") { return Some(StatKey::NecroticResistance); }
        if has("POISON") { return Some(StatKey::PoisonResistance); }
        if has("PHYSICAL") { return Some(StatKey::PhysicalResistance); }
        return Some(StatKey::AllResistances); // unqualified RESISTANCE = all
    }

    // Attributes (FR-9, Story 1.5). Ship as standalone single-tag effects (e.g. `["STRENGTH"]`),
    // so they are placed LAST — below every player-stat branch (DAMAGE, CRIT, SPEED, HEALTH,
    // ATTACK_SPEED, RESISTANCE, ...). First-match-wins means a future node co-tagged with a
    // frozen-gate stat (e.g. `["VITALITY","HEALTH"]` → player HP, `["ATTUNEMENT","ATTACK_SPEED"]`
    // → speed) keeps that stat instead of being silently diverted onto an attribute total —
    // protecting the frozen effective_hp / speed parity gate. No standalone attribute node is
    // co-tagged today, so the golden count is unchanged (203). Audit-proven sourced for
    // STR/DEX/INT/ATT; VITALITY keys the real LE tag for forward-compat (no VITALITY-tagged node
    // ships today). [Story 1.5 code review 2026-06-03]
    if has("STRENGTH") { return Some(StatKey::Strength); }
    if has("DEXTERITY") { return Some(StatKey::Dexterity); }
    if has("INTELLIGENCE") { return Some(StatKey::Intelligence); }
    if has("ATTUNEMENT") { return Some(StatKey::Attunement); }
    if has("VITALITY") { return Some(StatKey::Vitality); }

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

/// Seeds the three PRD-named build-enabling unique items for Game-Changer detection (FR-A22).
/// Effects are approximate Phase-3 models of each unique's primary scoring contribution.
fn build_seeded_unique_items() -> Vec<scoring_core::game_data::UniqueItem> {
    use scoring_core::game_data::{NodeEffect, UniqueItem};
    use scoring_core::modifier::{Condition, ModifierType, StatKey};
    vec![
        UniqueItem {
            item_id: "exsanguinous".to_string(),
            display_name: "Exsanguinous".to_string(),
            scoring_effects: vec![NodeEffect {
                stat_key: StatKey::WardPerSecond,
                modifier_type: ModifierType::Flat,
                value: 200.0,
                condition: Condition::Always,
            }],
            threshold_description: "Ward generation from passives or other sources".to_string(),
        },
        UniqueItem {
            item_id: "bleeding-heart".to_string(),
            display_name: "Bleeding Heart".to_string(),
            scoring_effects: vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 80.0,
                condition: Condition::Always,
            }],
            threshold_description: "Bleed or necrotic damage sources in the build".to_string(),
        },
        UniqueItem {
            item_id: "omnividence".to_string(),
            display_name: "Omnividence".to_string(),
            scoring_effects: vec![NodeEffect {
                stat_key: StatKey::CriticalStrikeMultiplier,
                modifier_type: ModifierType::Flat,
                value: 100.0,
                condition: Condition::Always,
            }],
            threshold_description: "High critical strike chance (60%+) already in the build".to_string(),
        },
    ]
}

/// Maps idol affix JSON stat key strings to `StatKey` enum variants.
/// Returns `None` for unknown keys — the affix is silently dropped (FR-A6 pattern).
fn stat_key_from_str(s: &str) -> Option<StatKey> {
    match s {
        "added_fire_damage"          => Some(StatKey::FlatAddedFireDamage),
        "increased_physical_damage"  => Some(StatKey::IncreasedPhysicalDamage),
        "fire_resistance"            => Some(StatKey::FireResistance),
        "cold_resistance"            => Some(StatKey::ColdResistance),
        "lightning_resistance"       => Some(StatKey::LightningResistance),
        "increased_fire_damage"      => Some(StatKey::IncreasedFireDamage),
        "increased_cold_damage"      => Some(StatKey::IncreasedColdDamage),
        "increased_void_damage"      => Some(StatKey::IncreasedVoidDamage),
        "max_hp"                     => Some(StatKey::MaxHp),
        "critical_strike_chance"     => Some(StatKey::CriticalStrikeChance),
        "attack_speed"               => Some(StatKey::AttackSpeed),
        "cast_speed"                 => Some(StatKey::CastSpeed),
        "all_resistances"            => Some(StatKey::AllResistances),
        "increased_spell_damage"     => Some(StatKey::IncreasedSpellDamage),
        "increased_minion_damage"    => Some(StatKey::IncreasedMinionDamage),
        "armor"                      => Some(StatKey::Armor),
        "max_hp_percent"             => Some(StatKey::MaxHpPercent),
        "critical_strike_multiplier" => Some(StatKey::CriticalStrikeMultiplier),
        "void_resistance"            => Some(StatKey::VoidResistance),
        "poison_resistance"          => Some(StatKey::PoisonResistance),
        "endurance_threshold"        => Some(StatKey::EnduranceThreshold),
        "increased_damage"           => Some(StatKey::IncreasedDamage),
        "ward_per_second"            => Some(StatKey::WardPerSecond),
        "increased_area_damage"      => Some(StatKey::IncreasedAreaDamage),
        "critical_strike_avoidance"  => Some(StatKey::CriticalStrikeAvoidance),
        "movement_speed"             => Some(StatKey::MovementSpeed),
        "dodge_rating"               => Some(StatKey::DodgeRating),
        "life_leech_percent"         => Some(StatKey::LifeLeechPercent),
        "increased_lightning_damage" => Some(StatKey::IncreasedLightningDamage),
        "necrotic_resistance"        => Some(StatKey::NecroticResistance),
        "hp_regen_per_sec"           => Some(StatKey::HpRegenPerSec),
        "freeze_rate_multiplier"     => Some(StatKey::FreezeRateMultiplier),
        "ward_on_hit"                => Some(StatKey::WardOnHit),
        "ignite_duration"            => Some(StatKey::IgniteDuration),
        _                            => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn classes_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("game-data")
            .join("classes")
    }

    /// Counts every NodeEffect the loader's parser produces across all shipped class JSONs
    /// (base tree + mastery trees + skill trees), routed through `ModifierType::from_data_str`.
    fn total_parsed_effects() -> usize {
        let classes = ["sentinel", "mage", "primalist", "rogue", "acolyte"];
        let mut total = 0usize;
        for class_id in classes {
            let path = classes_dir().join(format!("{class_id}.json"));
            let raw = std::fs::read_to_string(&path)
                .unwrap_or_else(|e| panic!("read {class_id}.json: {e}"));
            let class_data: crate::models::game_data::RawClassData =
                serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse {class_id}.json: {e}"));

            for node in &class_data.base_tree.nodes {
                total += parse_node_effects(&node.effects, &node.modifier_type).len();
            }
            for mastery in &class_data.masteries {
                for node in &mastery.passive_tree.nodes {
                    total += parse_node_effects(&node.effects, &node.modifier_type).len();
                }
            }
            for skill in &class_data.skills {
                for node in &skill.skill_tree.nodes {
                    total += parse_node_effects(&node.effects, &node.modifier_type).len();
                }
            }
        }
        total
    }

    /// Existing-data regression (Story 1.1): every shipped class JSON loads through the
    /// node-effect parser without failure, and the total effect count must remain identical
    /// to the pre-migration baseline — proving the `ModifierType::from_data_str` fallback
    /// contract (FR-A6) preserves Phase 3 behavior across the real shipped data set.
    /// A change to this golden number means parser behavior (or the data) changed.
    #[test]
    fn shipped_class_json_effect_count_is_stable() {
        // Baseline history:
        //   179 — Story 1.1 migration / 1.2 first pass (single stat + first value per effect).
        //   185 — Story 1.2 penetration sourcing (Tasks 9-13): each PENETRATION-tagged effect now
        //         ALSO emits an additive Flat penetration modifier parsed from its own clause. Six
        //         shipped nodes gained a pen modifier: mage sorcerer (elemental) + lightning-blast
        //         (lightning), sentinel void-erosion/void-mastery (void) + forge-incandescent/
        //         forge-mastery (fire). The two Holy/Chaos pen nodes are NOT counted — those types
        //         are not modeled (dropped at parse_penetration_clause), so their effect count is
        //         unchanged. Every non-penetration effect still parses byte-identically (path 1 in
        //         parse_node_effects is the unchanged pre-1.2 mapping), preserving aggregate parity.
        //   198 — Story 1.3 FR-5 defensive sourcing (+13): wiring the previously-dropped BLOCK tag
        //         (→ BlockChance, +10 nodes that fell through to None before) and HEALING tag
        //         (→ HealingEffectiveness, +3 non-DAMAGE-tagged nodes). The Necrotic-resistance
        //         split (NECROTIC+RESISTANCE: PoisonResistance → NecroticResistance) is
        //         count-neutral — the one shipped node stays Some, only its key changed.
        //   203 — Story 1.5 FR-9 attribute sourcing (+5): wiring the previously-dropped attribute
        //         tags (STRENGTH/DEXTERITY/INTELLIGENCE/ATTUNEMENT → their new StatKeys). Five
        //         standalone single-tag nodes that fell through to None before now parse, each with
        //         a parseable "+4" value: primalist STRENGTH + ATTUNEMENT, rogue DEXTERITY, mage
        //         base INTELLIGENCE, acolyte INTELLIGENCE. The lone co-tagged attribute node (mage
        //         runemaster `["SPELL","INTELLIGENCE","DAMAGE"]`) is unchanged — it still resolves
        //         to IncreasedSpellDamage via the DAMAGE branch, so it neither double-counts nor
        //         shifts. No VITALITY-tagged node ships (the "Vitality" node is tagged HEALTH), so
        //         the VITALITY branch adds 0 effects here.
        const GOLDEN_EFFECT_COUNT: usize = 203;
        let total = total_parsed_effects();
        assert_eq!(
            total, GOLDEN_EFFECT_COUNT,
            "shipped-data node-effect count drifted from the Story-1.5 attribute-sourcing baseline"
        );
    }

    /// Story 1.2 remap: NECROTIC is no longer conflated into Poison, and BLEED/IGNITE
    /// now land on their own DoT keys. All still require a DAMAGE tag, so this changes
    /// stat-key assignment only — never the effect count guarded above.
    #[test]
    fn damage_tag_remap_lands_on_new_keys() {
        let inc = ModifierType::Increased;
        let tag = |s: &str| vec![s.to_string(), "DAMAGE".to_string()];

        assert_eq!(
            tags_to_stat_key(&tag("NECROTIC"), &inc),
            Some(StatKey::IncreasedNecroticDamage),
            "NECROTIC must remap off Poison onto its own key"
        );
        assert_eq!(
            tags_to_stat_key(&tag("POISON"), &inc),
            Some(StatKey::IncreasedPoisonDamage),
            "POISON must keep its own key after the split"
        );
        assert_eq!(
            tags_to_stat_key(&tag("BLEED"), &inc),
            Some(StatKey::IncreasedBleedDamage),
            "BLEED (physical DoT) must map to its DoT key, not generic damage"
        );
        assert_eq!(
            tags_to_stat_key(&tag("IGNITE"), &inc),
            Some(StatKey::IncreasedIgniteDamage),
            "IGNITE (fire DoT) must map to its DoT key"
        );
        // A DoT tag without DAMAGE is still dropped (no spurious key, count preserved).
        assert_eq!(tags_to_stat_key(&["BLEED".to_string()], &inc), None);
    }

    /// Story 1.5/FR-9: the previously-dropped attribute tags now source their new StatKeys. A
    /// standalone attribute tag maps to its key; an attribute co-tagged with DAMAGE keeps the
    /// damage key (the DAMAGE branch is checked first) so the golden count and damage parity hold.
    #[test]
    fn attribute_tags_land_on_new_keys() {
        let flat = ModifierType::Flat;
        assert_eq!(tags_to_stat_key(&["STRENGTH".to_string()], &flat), Some(StatKey::Strength));
        assert_eq!(tags_to_stat_key(&["DEXTERITY".to_string()], &flat), Some(StatKey::Dexterity));
        assert_eq!(
            tags_to_stat_key(&["INTELLIGENCE".to_string()], &flat),
            Some(StatKey::Intelligence)
        );
        assert_eq!(tags_to_stat_key(&["ATTUNEMENT".to_string()], &flat), Some(StatKey::Attunement));
        assert_eq!(tags_to_stat_key(&["VITALITY".to_string()], &flat), Some(StatKey::Vitality));
        // The lone co-tagged attribute node (mage runemaster) must stay on the damage key.
        assert_eq!(
            tags_to_stat_key(
                &["SPELL".to_string(), "INTELLIGENCE".to_string(), "DAMAGE".to_string()],
                &ModifierType::Increased,
            ),
            Some(StatKey::IncreasedSpellDamage),
            "attribute co-tagged with DAMAGE keeps its damage key (DAMAGE branch wins)"
        );
    }

    /// Story 1.3/AC2: NECROTIC resistance splits off the Poison bucket onto its own key.
    #[test]
    fn necrotic_resistance_splits_off_poison() {
        let inc = ModifierType::Increased;
        let rtag = |s: &str| vec![s.to_string(), "RESISTANCE".to_string()];
        assert_eq!(
            tags_to_stat_key(&rtag("NECROTIC"), &inc),
            Some(StatKey::NecroticResistance),
            "NECROTIC resistance must map to its own key, not Poison"
        );
        assert_eq!(
            tags_to_stat_key(&rtag("POISON"), &inc),
            Some(StatKey::PoisonResistance),
            "POISON resistance must keep its key after the split"
        );
    }

    /// Story 1.3: the previously-dropped BLOCK and HEALING tags now source their FR-5 keys,
    /// and ARMOUR+BLOCK still resolves to Armor (BLOCK is checked after ARMOUR — no regression).
    #[test]
    fn block_and_healing_tags_are_sourced() {
        let inc = ModifierType::Increased;
        assert_eq!(
            tags_to_stat_key(&["BLOCK".to_string(), "DEFENCE".to_string()], &inc),
            Some(StatKey::BlockChance),
            "BLOCK tag must source BlockChance (was previously dropped)"
        );
        assert_eq!(
            tags_to_stat_key(&["HEALING".to_string()], &inc),
            Some(StatKey::HealingEffectiveness),
            "HEALING tag must source HealingEffectiveness"
        );
        assert_eq!(
            tags_to_stat_key(&["ARMOUR".to_string(), "BLOCK".to_string()], &inc),
            Some(StatKey::Armor),
            "ARMOUR+BLOCK must stay Armor — BLOCK checked after ARMOUR"
        );
    }

    /// Task 9/10/11 (penetration sourcing). Single-clause pure-pen, multi-clause split,
    /// generic ELEMENTAL, and the not-modeled HOLY/CHAOS drop are all exercised here.
    /// Every penetration modifier the parser emits must be `Flat` (compute_penetration filters Flat).
    #[test]
    fn penetration_clause_parses_per_clause_value_and_element() {
        use crate::models::game_data::NodeEffect as RawEffect;
        let parse = |desc: &str, tags: &[&str]| {
            parse_node_effects(
                &[RawEffect {
                    description: desc.to_string(),
                    tags: tags.iter().map(|s| s.to_string()).collect(),
                }],
                &Some("increased".to_string()),
            )
        };
        let pen_of = |effects: &[NodeEffect]| -> Option<(StatKey, f64, ModifierType)> {
            effects
                .iter()
                .find(|e| {
                    matches!(
                        e.stat_key,
                        StatKey::FirePenetration
                            | StatKey::ColdPenetration
                            | StatKey::LightningPenetration
                            | StatKey::VoidPenetration
                            | StatKey::ElementalPenetration
                            | StatKey::PhysicalPenetration
                    )
                })
                .map(|e| (e.stat_key.clone(), e.value, e.modifier_type.clone()))
        };

        // Single-clause pure-pen node (no DAMAGE tag): today dropped, now sources the pen key.
        let lightning = parse("+5% Lightning Penetration per point.", &["LIGHTNING", "PENETRATION"]);
        assert_eq!(lightning.len(), 1, "pure-pen node yields exactly the pen modifier");
        assert_eq!(
            pen_of(&lightning),
            Some((StatKey::LightningPenetration, 5.0, ModifierType::Flat))
        );

        // Multi-clause DAMAGE+PENETRATION node: damage clause keeps its key+value (parity),
        // pen clause is sourced from its own clause value (2, not the leading 4).
        let void = parse(
            "+4% Void Damage. +2% Void Penetration per point. Void skills have +1% reduced cooldown.",
            &["VOID", "DAMAGE", "PENETRATION", "MASTERY"],
        );
        assert_eq!(void.len(), 2, "damage + pen modifiers");
        assert!(void.iter().any(|e| e.stat_key == StatKey::IncreasedVoidDamage && e.value == 4.0));
        assert_eq!(pen_of(&void), Some((StatKey::VoidPenetration, 2.0, ModifierType::Flat)));

        // Generic ELEMENTAL penetration → ElementalPenetration; damage clause stays generic.
        let elemental = parse(
            "+4% Elemental Damage. +2% Elemental Penetration. +3% Crit Chance per point.",
            &["ELEMENTAL", "DAMAGE", "PENETRATION", "MASTERY"],
        );
        assert_eq!(pen_of(&elemental), Some((StatKey::ElementalPenetration, 2.0, ModifierType::Flat)));
        assert!(elemental.iter().any(|e| e.stat_key == StatKey::IncreasedDamage && e.value == 4.0));

        // HOLY / CHAOS are not modeled LE pen types → pen clause dropped (no pen modifier).
        let holy = parse(
            "+4% Holy Damage. +3% Block Chance. +2% Holy Penetration per point.",
            &["HOLY", "BLOCK", "PENETRATION", "MASTERY"],
        );
        assert_eq!(pen_of(&holy), None, "Holy penetration must be dropped");
        let chaos = parse(
            "+4% Chaos Damage. +3% DoT Damage. +2% Chaos Penetration per point.",
            &["CHAOS", "DOT", "PENETRATION", "MASTERY"],
        );
        assert_eq!(pen_of(&chaos), None, "Chaos penetration must be dropped");
    }
}
