use crate::services::{claude_service, game_data_service, keychain_service, openrouter_service};
use serde_json::{json, Value};
use tauri::Emitter;

#[derive(serde::Deserialize)]
pub struct FineTuneWeights {
    damage: f32,
    survivability: f32,
    speed: f32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelContext {
    character_level: u32,
    available_passive_points: u32,
    #[allow(dead_code)]
    allocated_passive_points: u32,
    unspent_passive_points: i32,
    active_skill_levels: std::collections::HashMap<String, u32>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredGearAffix {
    name: String,
    tier: Option<u32>,
    value: Option<f64>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredGearSlot {
    slot: String,
    item_name: String,
    affixes: Vec<StructuredGearAffix>,
}

/// Invoke the Claude API with the current build state and optimization weights.
/// Streams suggestions via Tauri events:
///   optimization:suggestion-received — one per parsed suggestion
///   optimization:complete            — on stream completion
///   optimization:error               — on any failure
#[tauri::command]
pub async fn invoke_claude_api(
    app_handle: tauri::AppHandle,
    build_state: Value,
    slider_position: f32,
    fine_tune_weights: Option<FineTuneWeights>,
    level_context: Option<LevelContext>,
    structured_gear: Option<Vec<StructuredGearSlot>>,
) -> Result<(), String> {
    // API key is fetched per-branch below based on the active provider.

    // ── Extract class/mastery IDs from build state ────────────────────────────
    let class_id = build_state["classId"]
        .as_str()
        .ok_or("PARSE_ERROR: missing classId in build state")?
        .to_string();
    let mastery_id = build_state["masteryId"]
        .as_str()
        .ok_or("PARSE_ERROR: missing masteryId in build state")?
        .to_string();

    // ── Load game data for node context ──────────────────────────────────────
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let class_data = game_data_service::load_class_data(&data_dir, &class_id)?;

    // Find the requested mastery
    let mastery_data = class_data
        .masteries
        .iter()
        .find(|m| m.id == mastery_id)
        .ok_or_else(|| format!("PARSE_ERROR: mastery '{}' not found in class '{}'", mastery_id, class_id))?;

    // ── Build node context map for the prompt ─────────────────────────────────
    // node_id → { name, tags, maxPoints, currentPoints, lockedFromRemoval }
    let node_allocations = build_state["nodeAllocations"].as_object().cloned().unwrap_or_default();

    // Build parent→children map from edges: edge { from_id, to_id } means to_id requires from_id.
    // A node is locked from removal if any of its children are currently allocated.
    let mut children_of: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for edge in class_data.base_tree.edges.iter().chain(mastery_data.passive_tree.edges.iter()) {
        children_of.entry(edge.from_id.clone()).or_default().push(edge.to_id.clone());
    }

    let is_locked = |node_id: &str| -> bool {
        children_of
            .get(node_id)
            .map(|children| {
                children.iter().any(|child_id| {
                    node_allocations.get(child_id).and_then(|v| v.as_u64()).unwrap_or(0) > 0
                })
            })
            .unwrap_or(false)
    };

    let mut available_nodes = serde_json::Map::new();

    // Base class tree nodes
    for node in &class_data.base_tree.nodes {
        let current_points = node_allocations
            .get(&node.id)
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let all_tags: Vec<String> = node.effects.iter().flat_map(|e| e.tags.clone()).collect();
        available_nodes.insert(
            node.id.clone(),
            json!({
                "name": node.name,
                "tags": all_tags,
                "maxPoints": node.max_points,
                "currentPoints": current_points,
                "lockedFromRemoval": is_locked(&node.id)
            }),
        );
    }

    // Mastery tree nodes
    for node in &mastery_data.passive_tree.nodes {
        let current_points = node_allocations
            .get(&node.id)
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let all_tags: Vec<String> = node.effects.iter().flat_map(|e| e.tags.clone()).collect();
        available_nodes.insert(
            node.id.clone(),
            json!({
                "name": node.name,
                "tags": all_tags,
                "maxPoints": node.max_points,
                "currentPoints": current_points,
                "lockedFromRemoval": is_locked(&node.id)
            }),
        );
    }

    // ── Assemble user message ─────────────────────────────────────────────────
    let optimization_intent = compute_optimization_intent(slider_position, fine_tune_weights);
    let level_constraints = level_context.as_ref().map(build_level_constraints);
    let gear_context = structured_gear.as_deref().map(build_gear_context);
    let user_message = serde_json::to_string(&json!({
        "optimizationIntent": optimization_intent,
        "levelConstraints": level_constraints,
        "gearContext": gear_context,
        "build": build_state,
        "availableNodes": available_nodes
    }))
    .map_err(|e| format!("PARSE_ERROR: failed to serialize context: {}", e))?;

    // ── Route by provider ────────────────────────────────────────────────────
    let provider = match keychain_service::get_llm_provider(&app_handle).await {
        Ok(p) => p,
        Err(e) => {
            let err = format!("STORAGE_ERROR: failed to read provider setting: {e}");
            let _ = app_handle.emit(
                "optimization:error",
                &claude_service::OptimizationErrorPayload {
                    error_type: "STORAGE_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            return Err(err);
        }
    };

    let stream_result = if provider == "openrouter" {
        let or_key = match keychain_service::get_openrouter_api_key(&app_handle).await {
            Ok(k) => k,
            Err(e) => {
                let err = format!("AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings. ({})", e);
                let _ = app_handle.emit(
                    "optimization:error",
                    &claude_service::OptimizationErrorPayload {
                        error_type: "AUTH_ERROR".to_string(),
                        message: "No OpenRouter API key configured. Add your key in Settings.".to_string(),
                    },
                );
                return Err(err);
            }
        };
        openrouter_service::stream_optimization(&app_handle, &or_key, user_message).await
    } else {
        let api_key = keychain_service::get_api_key(&app_handle).await?;
        #[cfg(debug_assertions)]
        let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or(api_key);
        claude_service::stream_optimization(&app_handle, &api_key, user_message).await
    };

    if let Err(err) = stream_result {
        let _ = app_handle.emit(
            "optimization:error",
            &claude_service::OptimizationErrorPayload {
                error_type: extract_error_type(&err),
                message: err.clone(),
            },
        );
        return Err(err);
    }

    Ok(())
}

fn compute_optimization_intent(slider_position: f32, fine_tune_weights: Option<FineTuneWeights>) -> String {
    let (damage_pct, surv_pct, speed_pct) = if let Some(w) = fine_tune_weights {
        (w.damage.round() as i32, w.survivability.round() as i32, w.speed.round() as i32)
    } else {
        (slider_position.round() as i32, (100.0 - slider_position).round() as i32, 0)
    };
    format!("Optimization intent: {}% damage, {}% survivability, {}% speed", damage_pct, surv_pct, speed_pct)
}

fn build_gear_context(slots: &[StructuredGearSlot]) -> String {
    slots
        .iter()
        .map(|slot| {
            if slot.affixes.is_empty() {
                format!("{}: {}", slot.slot, slot.item_name)
            } else {
                let affixes_str: Vec<String> = slot
                    .affixes
                    .iter()
                    .map(|a| match (a.tier, a.value) {
                        (Some(t), Some(v)) => format!("{} T{} (+{:.0})", a.name, t, v),
                        (Some(t), None) => format!("{} T{}", a.name, t),
                        _ => a.name.clone(),
                    })
                    .collect();
                format!("{}: {} \u{2014} {}", slot.slot, slot.item_name, affixes_str.join(", "))
            }
        })
        .collect::<Vec<_>>()
        .join("; ")
}

fn build_level_constraints(ctx: &LevelContext) -> String {
    let skills_str = if ctx.active_skill_levels.is_empty() {
        "none".to_string()
    } else {
        let mut skills: Vec<String> = ctx
            .active_skill_levels
            .iter()
            .map(|(slot, level)| format!("{}: {}", slot, level))
            .collect();
        skills.sort();
        skills.join(", ")
    };
    format!(
        "Build constraints: Level {}, {} passive points available ({} unspent), skill levels: {}",
        ctx.character_level,
        ctx.available_passive_points,
        ctx.unspent_passive_points,
        skills_str
    )
}

fn extract_error_type(err: &str) -> String {
    for prefix in &["AUTH_ERROR", "API_ERROR", "NETWORK_ERROR", "TIMEOUT", "PARSE_ERROR"] {
        if err.starts_with(prefix) {
            return prefix.to_string();
        }
    }
    "UNKNOWN".to_string()
}
