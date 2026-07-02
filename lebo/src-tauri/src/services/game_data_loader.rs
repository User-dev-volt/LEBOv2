use std::collections::HashMap;
use scoring_core::{
    game_data::{
        ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, GameData, GearAffixData,
        GearAffixStat, IdolAffixEffect, NodeEffect,
    },
    modifier::{AffixPosition, Condition, ModifierType, Scope, StatKey},
};
use crate::models::item_data::{AffixTier, RawAffix};
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
        gear_affixes: load_gear_affixes(app_handle),
    })
}

/// Loads `affixes.json` into `GameData.gear_affixes` (Story 4.0, AC3). Mirrors the idol path:
/// resolve each affix's snake_case `statKey` via `stat_key_from_str`, average per-tier ranges into
/// `values_by_tier`. Degrades gracefully to an empty map on any I/O/parse error (run_gear_scoring
/// already handles empty → zero scores, so a bad dataset never panics startup).
fn load_gear_affixes(app_handle: &tauri::AppHandle) -> HashMap<String, GearAffixData> {
    match load_raw_affixes(app_handle) {
        Ok(raw) => parse_gear_affixes(&raw),
        Err(e) => {
            eprintln!("gear_affixes load failed (degrading to empty map): {e}");
            HashMap::new()
        }
    }
}

fn load_raw_affixes(app_handle: &tauri::AppHandle) -> Result<Vec<RawAffix>, String> {
    let data_dir = crate::services::item_data_service::copy_bundled_item_resources(app_handle)?;
    let raw = std::fs::read_to_string(data_dir.join("affixes.json"))
        .map_err(|e| format!("read affixes.json: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse affixes.json: {e}"))
}

fn tiers_to_values(tiers: &[AffixTier]) -> HashMap<u32, f64> {
    // Average each tier's min/max range — the idol averaging idiom (game_data_loader.rs idol path).
    tiers.iter().map(|t| (t.tier, (t.min_value + t.max_value) / 2.0)).collect()
}

/// Pure `RawAffix` → `GearAffixData` transform (testable without a Tauri handle). Only
/// prefix/suffix craftable affixes with a resolvable PRIMARY statKey are inserted — an affix whose
/// primary key is null/unresolvable is skipped entirely (never inserted as a dead key; the coverage
/// gate + manifest own the unmapped tail). Hybrid `extraStats` clauses are added when resolvable.
pub(crate) fn parse_gear_affixes(affixes: &[RawAffix]) -> HashMap<String, GearAffixData> {
    let mut map: HashMap<String, GearAffixData> = HashMap::new();
    for a in affixes {
        let affix_class = match a.affix_type.as_str() {
            "prefix" => AffixPosition::Prefix,
            "suffix" => AffixPosition::Suffix,
            _ => continue, // implicits/other are not craftable slot affixes
        };
        let Some(primary_key) = a.stat_key.as_deref().and_then(stat_key_from_str) else {
            continue; // no resolvable primary stat → skip (no dead-key affix)
        };
        let mut stats = vec![GearAffixStat {
            stat_key: primary_key,
            modifier_type: ModifierType::from_data_str(a.modifier_type.as_deref()),
            values_by_tier: tiers_to_values(&a.tiers),
        }];
        for ex in &a.extra_stats {
            if let Some(k) = ex.stat_key.as_deref().and_then(stat_key_from_str) {
                stats.push(GearAffixStat {
                    stat_key: k,
                    modifier_type: ModifierType::from_data_str(ex.modifier_type.as_deref()),
                    values_by_tier: tiers_to_values(&ex.tiers),
                });
            }
        }
        let damage_elements = a
            .damage_type
            .as_deref()
            .filter(|d| !d.is_empty())
            .map(|d| vec![d.to_string()])
            .unwrap_or_default();
        map.insert(
            a.id.clone(),
            GearAffixData {
                display_name: a.name.clone(),
                affix_class,
                scope: Scope::from_data_str(a.scope.as_deref()),
                damage_elements,
                item_slots: a.item_slots.clone(),
                stats,
            },
        );
    }
    map
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

/// Maps snake_case affix stat-key strings (from idol-data.json AND affixes.json) to `StatKey`
/// variants. Single canonical resolver for idols + gear (Story 4.0, Decision D1). Returns `None`
/// for unknown/inert keys — the affix (or that stat clause) is silently dropped (FR-A6 pattern).
///
/// `stun_chance` is deliberately ABSENT because no shipped source feeds a CONSUMED `StunChance`
/// value: `offense.rs` does sum Flat `StunChance`, but every stun affix in the corpus is
/// "% increased" (which the Flat-only sum ignores), so mapping it would ship a dead key (Source
/// Audit; memory stun-chance-inert-unowned). The transform emits `statKey: null` for stun regardless.
fn stat_key_from_str(s: &str) -> Option<StatKey> {
    Some(match s {
        // Damage — generic
        "increased_damage" => StatKey::IncreasedDamage,
        "more_damage" => StatKey::MoreDamage,
        // Damage — element
        "increased_fire_damage" => StatKey::IncreasedFireDamage,
        "increased_cold_damage" => StatKey::IncreasedColdDamage,
        "increased_lightning_damage" => StatKey::IncreasedLightningDamage,
        "increased_void_damage" => StatKey::IncreasedVoidDamage,
        "increased_poison_damage" => StatKey::IncreasedPoisonDamage,
        "increased_physical_damage" => StatKey::IncreasedPhysicalDamage,
        "increased_necrotic_damage" => StatKey::IncreasedNecroticDamage,
        "increased_bleed_damage" => StatKey::IncreasedBleedDamage,
        "increased_ignite_damage" => StatKey::IncreasedIgniteDamage,
        // Damage — delivery
        "increased_spell_damage" => StatKey::IncreasedSpellDamage,
        "increased_melee_damage" => StatKey::IncreasedMeleeDamage,
        "increased_ranged_damage" => StatKey::IncreasedRangedDamage,
        "increased_minion_damage" => StatKey::IncreasedMinionDamage,
        "increased_area_damage" => StatKey::IncreasedAreaDamage,
        // Flat added damage
        "added_fire_damage" => StatKey::FlatAddedFireDamage,
        "added_cold_damage" => StatKey::FlatAddedColdDamage,
        "added_lightning_damage" => StatKey::FlatAddedLightningDamage,
        "added_void_damage" => StatKey::FlatAddedVoidDamage,
        "added_physical_damage" => StatKey::FlatAddedPhysicalDamage,
        // Crit
        "critical_strike_chance" => StatKey::CriticalStrikeChance,
        "critical_strike_multiplier" => StatKey::CriticalStrikeMultiplier,
        "critical_strike_avoidance" => StatKey::CriticalStrikeAvoidance,
        // Defense
        "max_hp" => StatKey::MaxHp,
        "max_hp_percent" => StatKey::MaxHpPercent,
        "hp_regen_per_sec" => StatKey::HpRegenPerSec,
        "ward_per_second" => StatKey::WardPerSecond,
        "ward_on_hit" => StatKey::WardOnHit,
        "armor" => StatKey::Armor,
        "endurance_threshold" => StatKey::EnduranceThreshold,
        "endurance_percent" => StatKey::EndurancePercent,
        "fire_resistance" => StatKey::FireResistance,
        "cold_resistance" => StatKey::ColdResistance,
        "lightning_resistance" => StatKey::LightningResistance,
        "void_resistance" => StatKey::VoidResistance,
        "poison_resistance" => StatKey::PoisonResistance,
        "physical_resistance" => StatKey::PhysicalResistance,
        "necrotic_resistance" => StatKey::NecroticResistance,
        "all_resistances" => StatKey::AllResistances,
        "dodge_rating" => StatKey::DodgeRating,
        "life_leech_percent" => StatKey::LifeLeechPercent,
        "healing_effectiveness" => StatKey::HealingEffectiveness,
        "block_chance" => StatKey::BlockChance,
        // Speed
        "attack_speed" => StatKey::AttackSpeed,
        "cast_speed" => StatKey::CastSpeed,
        "movement_speed" => StatKey::MovementSpeed,
        "area_of_effect" => StatKey::AreaOfEffect,
        "cooldown_recovery_speed" => StatKey::CooldownRecoverySpeed,
        // Mana
        "max_mana" => StatKey::MaxMana,
        "mana_regen_per_sec" => StatKey::ManaRegenPerSec,
        // Penetration
        "fire_penetration" => StatKey::FirePenetration,
        "cold_penetration" => StatKey::ColdPenetration,
        "lightning_penetration" => StatKey::LightningPenetration,
        "void_penetration" => StatKey::VoidPenetration,
        "elemental_penetration" => StatKey::ElementalPenetration,
        "physical_penetration" => StatKey::PhysicalPenetration,
        // Ailments
        "ignite_duration" => StatKey::IgniteDuration,
        "poison_duration" => StatKey::PoisonDuration,
        "bleed_duration" => StatKey::BleedDuration,
        "freeze_rate_multiplier" => StatKey::FreezeRateMultiplier,
        "max_poison_stacks" => StatKey::MaxPoisonStacks,
        // Minion
        "increased_minion_count" => StatKey::IncreasedMinionCount,
        "increased_minion_hp" => StatKey::IncreasedMinionHp,
        // Attributes
        "strength" => StatKey::Strength,
        "dexterity" => StatKey::Dexterity,
        "intelligence" => StatKey::Intelligence,
        "attunement" => StatKey::Attunement,
        "vitality" => StatKey::Vitality,
        _ => return None,
    })
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

    // ── Story 4.0 — gear affix ingestion tests (AC4) ────────────────────────────

    /// Loads the committed `affixes.json` (the transform's output) and parses it exactly as the
    /// loader does at startup — no Tauri handle required.
    fn committed_gear_affixes() -> HashMap<String, GearAffixData> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("items")
            .join("affixes.json");
        let raw = std::fs::read_to_string(&path).expect("read affixes.json");
        let affixes: Vec<RawAffix> = serde_json::from_str(&raw).expect("parse affixes.json");
        parse_gear_affixes(&affixes)
    }

    /// AC4 — end-to-end value+element parity for a REAL corpus affix. `affix-inevitable-prefix`
    /// (tier 1 = +4% Void Penetration) equipped → compute_stats attributes exactly 4.0
    /// VoidPenetration to `weapon:affix-inevitable-prefix`. Value + element + source, not a count.
    #[test]
    fn gear_affix_parity_inevitable_void_penetration() {
        use scoring_core::build_snapshot::{AffixEntry, BuildSnapshot, GearSlotSnapshot};
        use scoring_core::compute::compute_stats;
        use scoring_core::compute_options::ComputeOptions;

        let map = committed_gear_affixes();
        let inev = map.get("affix-inevitable-prefix").expect("Inevitable affix present");
        assert_eq!(inev.stats.len(), 1, "Inevitable is single-stat");
        assert_eq!(inev.stats[0].stat_key, StatKey::VoidPenetration);
        assert_eq!(inev.stats[0].modifier_type, ModifierType::Flat);
        assert_eq!(inev.stats[0].values_by_tier.get(&1).copied(), Some(4.0));

        let mut gd = GameData::default();
        gd.gear_affixes = map.clone();
        let mut snapshot = BuildSnapshot { character_level: 80, ..Default::default() };
        let mut slot = GearSlotSnapshot::default();
        slot.prefixes.push(AffixEntry { affix_id: "affix-inevitable-prefix".to_string(), tier: 1 });
        snapshot.gear_slots.insert("weapon".to_string(), slot);

        let sheet = compute_stats(&snapshot, &gd, ComputeOptions { track_sources: true });
        let sources = sheet.stat_sources.expect("track_sources → Some");
        let vp = sources.get("VoidPenetration").expect("VoidPenetration sourced");
        let entry = vp
            .iter()
            .find(|s| s.source_label == "weapon:affix-inevitable-prefix")
            .expect("attributed to weapon:affix-inevitable-prefix");
        assert_eq!(entry.value, 4.0, "exact tier-1 void penetration value");
        assert_eq!(entry.modifier_type, ModifierType::Flat);
    }

    /// AC4/hybrid — a real hybrid corpus affix contributes BOTH stat clauses. `affix-glacial-prefix`
    /// tier 1 = +30% Freeze Rate Multiplier (avg 20–40) AND +5% Cold Resistance.
    #[test]
    fn gear_affix_parity_hybrid_glacial() {
        use scoring_core::build_snapshot::{AffixEntry, BuildSnapshot, GearSlotSnapshot};
        use scoring_core::compute::compute_stats;
        use scoring_core::compute_options::ComputeOptions;

        let map = committed_gear_affixes();
        let glacial = map.get("affix-glacial-prefix").expect("Glacial affix present");
        assert_eq!(glacial.stats.len(), 2, "Glacial is a hybrid (2 stats)");

        let mut gd = GameData::default();
        gd.gear_affixes = map.clone();
        let mut snapshot = BuildSnapshot { character_level: 80, ..Default::default() };
        let mut slot = GearSlotSnapshot::default();
        slot.prefixes.push(AffixEntry { affix_id: "affix-glacial-prefix".to_string(), tier: 1 });
        snapshot.gear_slots.insert("chest".to_string(), slot);

        let sheet = compute_stats(&snapshot, &gd, ComputeOptions { track_sources: true });
        let sources = sheet.stat_sources.expect("track_sources → Some");
        let src_val = |k: &str| {
            sources
                .get(k)
                .and_then(|v| v.iter().find(|s| s.source_label == "chest:affix-glacial-prefix"))
                .map(|s| s.value)
        };
        assert_eq!(src_val("FreezeRateMultiplier"), Some(30.0), "primary freeze rate (avg 20-40)");
        assert_eq!(src_val("ColdResistance"), Some(5.0), "hybrid second stat cold res");
    }

    /// AC4 / Source-Audit — NO dead `StatKey`. Every distinct StatKey the loader emits from the
    /// shipped dataset, when equipped alone, must MOVE some `StatSheet` field. A key that surfaces
    /// nothing is a dead key and must be excluded from emission (see INERT_STAT_KEYS in the
    /// transform + stat_key_from_str). Prefers single-stat affixes so each key is isolated.
    #[test]
    fn no_dead_gear_stat_keys() {
        use scoring_core::build_snapshot::{AffixEntry, BuildSnapshot, GearSlotSnapshot};
        use scoring_core::compute::compute_stats;
        use scoring_core::compute_options::ComputeOptions;
        use std::collections::BTreeMap;

        let map = committed_gear_affixes();
        // Representative (affix_id, tier) per distinct emitted StatKey; prefer single-stat affixes.
        let mut rep: BTreeMap<String, (String, u32, bool)> = BTreeMap::new();
        for (id, d) in &map {
            let single = d.stats.len() == 1;
            for s in &d.stats {
                let Some((&tier, _)) = s.values_by_tier.iter().find(|(_, &v)| v != 0.0) else {
                    continue;
                };
                let k = format!("{:?}", s.stat_key);
                let better = match rep.get(&k) {
                    Some((_, _, existing_single)) => single && !existing_single,
                    None => true,
                };
                if better {
                    rep.insert(k, (id.clone(), tier, single));
                }
            }
        }
        assert!(!rep.is_empty(), "no gear affixes parsed from committed dataset");

        let base_snap = BuildSnapshot { character_level: 100, ..Default::default() };
        let baseline = serde_json::to_value(compute_stats(
            &base_snap,
            &GameData::default(),
            ComputeOptions::default(),
        ))
        .unwrap();

        let mut gd = GameData::default();
        gd.gear_affixes = map.clone();
        let mut dead = Vec::new();
        for (key, (affix_id, tier, _)) in &rep {
            let mut snap = BuildSnapshot { character_level: 100, ..Default::default() };
            let mut slot = GearSlotSnapshot::default();
            slot.prefixes.push(AffixEntry { affix_id: affix_id.clone(), tier: *tier });
            snap.gear_slots.insert("weapon".to_string(), slot);
            let with =
                serde_json::to_value(compute_stats(&snap, &gd, ComputeOptions::default())).unwrap();
            if with == baseline {
                dead.push(key.clone());
            }
        }
        assert!(
            dead.is_empty(),
            "dead StatKeys emitted by loader (surface no StatSheet field): {:?}",
            dead
        );
    }

    /// The loader never inserts an affix whose primary statKey is inert/unresolvable (no dead key).
    #[test]
    fn parse_gear_affixes_skips_unresolvable_primary() {
        let raw = vec![
            RawAffix {
                id: "good".to_string(),
                name: "Good".to_string(),
                affix_type: "prefix".to_string(),
                item_slots: vec!["weapon".to_string()],
                tiers: vec![AffixTier { tier: 1, min_value: 10.0, max_value: 10.0 }],
                modifier_type: Some("flat".to_string()),
                scope: Some("generic".to_string()),
                damage_type: None,
                stat_key: Some("armor".to_string()),
                extra_stats: vec![],
            },
            RawAffix {
                id: "inert".to_string(),
                name: "Inert".to_string(),
                affix_type: "prefix".to_string(),
                item_slots: vec![],
                tiers: vec![AffixTier { tier: 1, min_value: 10.0, max_value: 10.0 }],
                modifier_type: Some("flat".to_string()),
                scope: None,
                damage_type: None,
                stat_key: None, // null → skipped entirely
                extra_stats: vec![],
            },
        ];
        let map = parse_gear_affixes(&raw);
        assert!(map.contains_key("good"));
        assert!(!map.contains_key("inert"), "null-statKey affix must not be inserted");
        assert_eq!(map["good"].stats[0].stat_key, StatKey::Armor);
        assert_eq!(map["good"].item_slots, vec!["weapon".to_string()]);
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
