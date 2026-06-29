use scoring_core::{BuildSnapshot, ComputeOptions, StatSheet, SynergyFlag};
use tauri::Emitter;
use crate::ScoringState;

/// Sync Tauri command — Stage 1 scoring only (~2ms). No async, no clone.
/// Pattern 3: read lock, compute, lock drops at function end.
/// Pattern 5: all errors prefixed with "SCORING_ERROR: ".
#[tauri::command]
pub fn compute_stats(
    snapshot: BuildSnapshot,
    state: tauri::State<ScoringState>,
) -> Result<StatSheet, String> {
    let game_data = state.game_data.read()
        .map_err(|e| format!("SCORING_ERROR: game_data lock poisoned: {}", e))?;
    // The ONLY site in the codebase that enables source tracking (Pattern P4-2) — the display
    // path can afford the source-collection pass; every loop path stays on ::default() (false).
    Ok(scoring_core::compute_stats(
        &snapshot,
        &game_data,
        ComputeOptions { track_sources: true, ..Default::default() },
    ))
}

/// Passive-tree optimization pipeline: run_efficiency_scan → assemble passive-node payload →
/// delegate to the existing Claude streaming infrastructure.
/// Pattern 3: clone game_data BEFORE spawn_blocking; never hold a read lock across await.
/// Pattern P4-3 / ADR-P4-003: suggestions are filtered to passive-node (knapsack) allocations
/// only. The defensive floor check still runs in `compute_stats` (driven by `useStatSheet`) and
/// populates `StatSheet.warnings`; it is intentionally NOT re-presented as a suggestion here.
#[tauri::command]
pub async fn run_optimization(
    app_handle: tauri::AppHandle,
    snapshot: scoring_core::BuildSnapshot,
    state: tauri::State<'_, ScoringState>,
) -> Result<(), String> {
    let game_data = state.game_data.read()
        .map_err(|e| format!("SCORING_ERROR: game_data lock poisoned: {}", e))?
        .clone();

    let snapshot_for_engine = snapshot.clone();

    let scan_result = tauri::async_runtime::spawn_blocking(move || {
        scoring_core::run_efficiency_scan(&snapshot_for_engine, &game_data)
    })
    .await
    .map_err(|e| format!("SCORING_ERROR: optimization compute panicked: {}", e))?;

    // Emit node efficiencies for the passive tree overlay (Story 4.4).
    // Emitted before Claude delegation so the overlay appears as soon as the engine finishes.
    if let Ok(eff_json) = serde_json::to_string(&scan_result.node_efficiencies) {
        let _ = app_handle.emit("optimization:node-efficiencies", eff_json);
    }

    let user_message = assemble_run_optimization_payload(
        &snapshot, &scan_result,
    ).map_err(|e| {
        let _ = app_handle.emit(
            "optimization:error",
            &crate::services::claude_service::OptimizationErrorPayload {
                error_type: "SCORING_ERROR".to_string(),
                message: e.clone(),
            },
        );
        e
    })?;

    // Provider routing — identical pattern to invoke_claude_api.
    let provider = match crate::services::keychain_service::get_llm_provider(&app_handle).await {
        Ok(p) => p,
        Err(e) => {
            let err = format!("STORAGE_ERROR: failed to read provider setting: {e}");
            let _ = app_handle.emit(
                "optimization:error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "STORAGE_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            return Err(err);
        }
    };

    let stream_result = if provider == "openrouter" {
        let or_key = match crate::services::keychain_service::get_openrouter_api_key(&app_handle).await {
            Ok(k) => k,
            Err(e) => {
                let err = format!("AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings. ({})", e);
                let _ = app_handle.emit(
                    "optimization:error",
                    &crate::services::claude_service::OptimizationErrorPayload {
                        error_type: "AUTH_ERROR".to_string(),
                        message: "No OpenRouter API key configured. Add your key in Settings.".to_string(),
                    },
                );
                return Err(err);
            }
        };
        crate::services::openrouter_service::stream_optimization(&app_handle, &or_key, user_message).await
    } else {
        let api_key = match crate::services::keychain_service::get_api_key(&app_handle).await {
            Ok(k) => k,
            Err(e) => {
                let err = format!("AUTH_ERROR: No Anthropic API key configured. Add your key in Settings. ({})", e);
                let _ = app_handle.emit(
                    "optimization:error",
                    &crate::services::claude_service::OptimizationErrorPayload {
                        error_type: "AUTH_ERROR".to_string(),
                        message: "No Anthropic API key configured. Add your key in Settings.".to_string(),
                    },
                );
                return Err(err);
            }
        };
        #[cfg(debug_assertions)]
        let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or(api_key);
        crate::services::claude_service::stream_optimization(&app_handle, &api_key, user_message).await
    };

    if let Err(err) = stream_result {
        let _ = app_handle.emit(
            "optimization:error",
            &crate::services::claude_service::OptimizationErrorPayload {
                error_type: extract_optimization_error_type(&err),
                message: err.clone(),
            },
        );
        return Err(err);
    }

    Ok(())
}

/// Async Tauri command — gear slot affix analysis + Claude gear narrative.
/// Pattern 3: clone game_data BEFORE spawn_blocking; never hold a read lock across await.
/// Emits gear:analysis-complete immediately after scoring, then streams narrative via gear:narrative-* events.
/// Pattern 6: all events use gear:* namespace (NOT optimization:*).
#[tauri::command]
pub async fn run_gear_scoring(
    app_handle: tauri::AppHandle,
    snapshot: scoring_core::BuildSnapshot,
    state: tauri::State<'_, ScoringState>,
) -> Result<(), String> {
    let game_data = state.game_data.read()
        .map_err(|e| {
            let err = format!("SCORING_ERROR: game_data lock poisoned: {}", e);
            let _ = app_handle.emit(
                "gear:error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "SCORING_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            err
        })?
        .clone();

    let snapshot_for_engine = snapshot.clone();

    let (gear_result, synergy_flags) =
        tauri::async_runtime::spawn_blocking(move || {
            let gear = scoring_core::run_gear_scoring(&snapshot_for_engine, &game_data);
            let synergy = scoring_core::run_synergy_detection(&snapshot_for_engine, &game_data);
            (gear, synergy)
        })
        .await
        .map_err(|e| {
            let err = format!("SCORING_ERROR: gear scoring compute panicked: {}", e);
            let _ = app_handle.emit(
                "gear:error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "SCORING_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            err
        })?;

    // Emit analysis results immediately — UI shows slot rankings without waiting for narrative
    let _ = app_handle.emit("gear:analysis-complete", &gear_result);

    // Assemble gear narrative payload and stream via Claude
    let game_changers: Vec<&SynergyFlag> = synergy_flags
        .iter()
        .filter(|f| f.flag_type == "game_changer")
        .collect();

    let narrative_payload = match assemble_gear_narrative_payload(&snapshot, &gear_result, &game_changers) {
        Ok(p) => p,
        Err(e) => {
            let _ = app_handle.emit(
                "gear:narrative-error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "SCORING_ERROR".to_string(),
                    message: e.clone(),
                },
            );
            return Err(e);
        }
    };

    // Provider routing — same pattern as run_optimization
    let provider = match crate::services::keychain_service::get_llm_provider(&app_handle).await {
        Ok(p) => p,
        Err(e) => {
            let err = format!("STORAGE_ERROR: failed to read provider setting: {e}");
            let _ = app_handle.emit(
                "gear:narrative-error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "STORAGE_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            return Err(err);
        }
    };

    let stream_result = if provider == "openrouter" {
        let or_key = match crate::services::keychain_service::get_openrouter_api_key(&app_handle).await {
            Ok(k) => k,
            Err(e) => {
                let err = format!("AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings. ({})", e);
                let _ = app_handle.emit(
                    "gear:narrative-error",
                    &crate::services::claude_service::OptimizationErrorPayload {
                        error_type: "AUTH_ERROR".to_string(),
                        message: "No OpenRouter API key configured. Add your key in Settings.".to_string(),
                    },
                );
                return Err(err);
            }
        };
        crate::services::openrouter_service::stream_gear_narrative(&app_handle, &or_key, narrative_payload).await
    } else {
        let api_key = match crate::services::keychain_service::get_api_key(&app_handle).await {
            Ok(k) => k,
            Err(e) => {
                let err = format!("AUTH_ERROR: No Anthropic API key configured. Add your key in Settings. ({})", e);
                let _ = app_handle.emit(
                    "gear:narrative-error",
                    &crate::services::claude_service::OptimizationErrorPayload {
                        error_type: "AUTH_ERROR".to_string(),
                        message: "No Anthropic API key configured. Add your key in Settings.".to_string(),
                    },
                );
                return Err(err);
            }
        };
        #[cfg(debug_assertions)]
        let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or(api_key);
        crate::services::claude_service::stream_gear_narrative(&app_handle, &api_key, narrative_payload).await
    };

    if let Err(err) = stream_result {
        let _ = app_handle.emit(
            "gear:narrative-error",
            &crate::services::claude_service::OptimizationErrorPayload {
                error_type: extract_optimization_error_type(&err),
                message: err.clone(),
            },
        );
        return Err(err);
    }

    Ok(())
}

fn assemble_gear_narrative_payload(
    snapshot: &scoring_core::BuildSnapshot,
    gear_analysis: &scoring_core::GearAnalysis,
    game_changers: &[&SynergyFlag],
) -> Result<String, String> {
    let archetype_label = match snapshot.slider_position {
        0..=25 => "Glass Cannon",
        26..=74 => "Balanced",
        _ => "Juggernaut",
    };

    let skill_name = snapshot.primary_offense_skill_name
        .as_deref()
        .unwrap_or("your Primary Offense skill");

    let priority_slot_info = gear_analysis.slot_rankings
        .iter()
        .max_by(|a, b| a.upgrade_score.partial_cmp(&b.upgrade_score).unwrap_or(std::cmp::Ordering::Equal))
        .map(|r| {
            let top_affix = r.ideal_prefix.first().or_else(|| r.ideal_suffix.first())
                .map(|a| serde_json::json!({
                    "name": a.display_name,
                    "targetTier": a.target_tier,
                    "reason": a.mechanical_reason
                }));
            serde_json::json!({
                "slot": r.slot,
                "upgradeScore": r.upgrade_score,
                "efficiencyPercent": r.efficiency_percent,
                "topWishlistAffix": top_affix
            })
        });

    let game_changer_list: Vec<serde_json::Value> = game_changers.iter().map(|f| serde_json::json!({
        "description": f.description,
        "deltaBuildScore": f.delta_build_score
    })).collect();

    let slot_summary: Vec<serde_json::Value> = gear_analysis.slot_rankings.iter().take(4).map(|r| {
        serde_json::json!({
            "slot": r.slot,
            "efficiencyPercent": r.efficiency_percent,
            "upgradeScore": r.upgrade_score
        })
    }).collect();

    let payload = serde_json::json!({
        "buildContext": {
            "primaryOffenseSkillName": skill_name,
            "classId": snapshot.class_id,
            "masteryId": snapshot.mastery_id,
            "sliderPosition": snapshot.slider_position,
            "archetypeLabel": archetype_label,
            "characterLevel": snapshot.character_level
        },
        "prioritySlot": priority_slot_info,
        "worstFourSlots": slot_summary,
        "gameChangers": game_changer_list,
        "instruction": "Write a personalized gear narrative following the system prompt rules."
    });

    serde_json::to_string(&payload)
        .map_err(|e| format!("SCORING_ERROR: failed to serialize gear narrative payload: {e}"))
}

fn extract_optimization_error_type(err: &str) -> String {
    for prefix in &["AUTH_ERROR", "API_ERROR", "NETWORK_ERROR", "TIMEOUT", "PARSE_ERROR", "SCORING_ERROR"] {
        if err.starts_with(prefix) {
            return prefix.to_string();
        }
    }
    "UNKNOWN".to_string()
}

/// Builds the ranked passive-node suggestion payload for the Claude user_message.
/// Per Pattern P4-3 / ADR-P4-003, `run_optimization` emits ONLY passive-node (knapsack)
/// allocations. The off-tree categories that previously fed this payload — defensive-floor
/// warnings (`StatSheet.warnings`) and synergy flags (`game_changer` / `mismatched_affix` /
/// `zero_value_allocation`) — are deliberately excluded: the floor check still runs in
/// `compute_stats` and surfaces via `StatSheet.warnings`, it is simply not re-presented here
/// as a suggestion. Those off-tree inputs are no longer parameters, so leakage is impossible
/// by construction (the strongest form of the Pattern P4-3 filter).
fn assemble_run_optimization_payload(
    snapshot: &scoring_core::BuildSnapshot,
    scan_result: &scoring_core::ScanResult,
) -> Result<String, String> {
    let mut suggestions: Vec<serde_json::Value> = Vec::new();
    let mut rank: u32 = 1;

    // Knapsack solution paths (optimal passive allocations) — the ONLY suggestion kind
    // run_optimization emits (suggestion.kind == PassiveNode).
    // solve_knapsack sorts each path cheapest-first (scan.rs:327), so path.last() is NOT
    // reliably the efficiency target. Find the target by locating the path node that was
    // scored for efficiency (bridge nodes are never in node_efficiencies).
    for path in &scan_result.knapsack_solution {
        if path.is_empty() { continue; }
        let efficiency_entry = path
            .iter()
            .find_map(|nid| scan_result.node_efficiencies.iter().find(|e| &e.node_id == nid));
        let target_node = efficiency_entry
            .map(|e| e.node_id.as_str())
            .unwrap_or_else(|| path.last().unwrap().as_str());
        let (delta_score, point_cost) = efficiency_entry
            .map(|e| (e.path_delta_score, e.effective_point_cost))
            .unwrap_or((0.0, path.len() as u32));
        let from_node: Option<&str> = if path.len() > 1 { Some(path[0].as_str()) } else { None };
        suggestions.push(serde_json::json!({
            "rank": rank,
            "kind": "passive_node",
            "type": "efficiency",
            "toNodeId": target_node,
            "fromNodeId": from_node,
            "pointCost": point_cost,
            "deltaBuildScore": delta_score,
            "context": format!(
                "Allocating {} adds {:.2} BuildScore for {} passive point(s). Path: {}.",
                target_node,
                delta_score,
                point_cost,
                path.join(" → ")
            )
        }));
        rank += 1;
    }

    let payload = serde_json::json!({
        "buildContext": {
            "classId": snapshot.class_id,
            "masteryId": snapshot.mastery_id,
            "characterLevel": snapshot.character_level,
            "sliderPosition": snapshot.slider_position,
            "activeConditions": snapshot.active_conditions,
            "activeSkillLevels": snapshot.active_skill_levels,
            "buildScoreBaseline": scan_result.build_score_baseline
        },
        "instructions": "You are a Last Epoch build optimizer. For each suggestion below, output exactly one NDJSON line matching the schema: {\"rank\":N,\"from_node_id\":null|\"nodeId\",\"to_node_id\":\"nodeId\",\"points_change\":N,\"explanation\":\"...\"}. Output one line per suggestion in rank order. Reference the specific delta values and context in your explanation. Do not add suggestions beyond the list.",
        "suggestions": suggestions
    });

    serde_json::to_string(&payload)
        .map_err(|e| format!("SCORING_ERROR: failed to serialize optimization payload: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_efficiency(node_id: &str, delta: f64, cost: u32, tier: &str) -> scoring_core::NodeEfficiency {
        scoring_core::NodeEfficiency {
            node_id: node_id.to_string(),
            efficiency: if cost > 0 { delta / cost as f64 } else { 0.0 },
            path_delta_score: delta,
            effective_point_cost: cost,
            tier: tier.to_string(),
        }
    }

    fn make_snapshot() -> scoring_core::BuildSnapshot {
        let mut s = scoring_core::BuildSnapshot::default();
        s.class_id = "sentinel".to_string();
        s.mastery_id = "void_knight".to_string();
        s.character_level = 20;
        s.slider_position = 50;
        s
    }

    // The off-tree synthetic prefixes the OLD payload emitted (warnings / uniques / synergies).
    // Element-level assertions below prove none of these can survive the Pattern P4-3 filter.
    const OFF_TREE_PREFIXES: [&str; 3] = ["warning:", "unique:", "synergy:"];
    const OFF_TREE_TYPES: [&str; 4] =
        ["critical_warning", "game_changer", "mismatched_affix", "zero_value_allocation"];

    /// AC1 / AC2: every emitted suggestion is a passive node sourced from the knapsack;
    /// no off-tree category (warning / unique / synergy) can leak into the payload, and ranks
    /// are sequential from 1 over the surviving passive-node suggestions only.
    #[test]
    fn run_optimization_payload_emits_only_passive_node_suggestions() {
        let snapshot = make_snapshot();
        let scan_result = scoring_core::ScanResult {
            node_efficiencies: vec![
                make_efficiency("passive_alpha", 4.0, 2, "gold"),
                make_efficiency("passive_beta", 2.0, 1, "silver"),
            ],
            build_score_baseline: 100.0,
            // A single-node path and a bridge→target path (path.last() is NOT the scored node).
            knapsack_solution: vec![
                vec!["passive_alpha".to_string()],
                vec!["bridge_node".to_string(), "passive_beta".to_string()],
            ],
        };

        let json = assemble_run_optimization_payload(&snapshot, &scan_result)
            .expect("payload must serialize");
        let value: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");
        let suggestions = value["suggestions"].as_array().expect("suggestions array");

        assert_eq!(suggestions.len(), 2, "one suggestion per non-empty knapsack path");

        for (i, s) in suggestions.iter().enumerate() {
            // Every suggestion is explicitly tagged passive_node (the kind discriminator).
            assert_eq!(
                s["kind"].as_str(),
                Some("passive_node"),
                "suggestion {i} must be kind=passive_node"
            );
            // Rank is sequential from 1, no gaps from removed categories.
            assert_eq!(s["rank"].as_u64(), Some((i + 1) as u64), "rank must be sequential from 1");

            // No off-tree discriminator survives on either `kind` or `type`.
            let kind = s["kind"].as_str().unwrap_or("");
            let typ = s["type"].as_str().unwrap_or("");
            assert!(!OFF_TREE_TYPES.contains(&kind), "kind {kind} must not be an off-tree category");
            assert!(!OFF_TREE_TYPES.contains(&typ), "type {typ} must not be an off-tree category");

            // The target id is a real passive node, never a synthetic off-tree id.
            let to_node = s["toNodeId"].as_str().expect("toNodeId is a string");
            assert!(
                !OFF_TREE_PREFIXES.iter().any(|p| to_node.starts_with(p)),
                "toNodeId {to_node} must not carry an off-tree synthetic prefix"
            );
        }

        // Element-level: the surviving suggestions are exactly the knapsack passive targets.
        let targets: Vec<&str> = suggestions
            .iter()
            .map(|s| s["toNodeId"].as_str().unwrap())
            .collect();
        assert!(targets.contains(&"passive_alpha"), "single-node path target survives");
        assert!(targets.contains(&"passive_beta"), "bridge→target path resolves to the scored node");
    }

    /// AC2 inverse: an empty knapsack yields zero suggestions. node_efficiencies are present
    /// (the canvas-overlay feed) but must NOT become suggestions, and nothing off-tree fills the gap.
    #[test]
    fn run_optimization_payload_is_empty_when_knapsack_is_empty() {
        let snapshot = make_snapshot();
        let scan_result = scoring_core::ScanResult {
            node_efficiencies: vec![make_efficiency("passive_alpha", 4.0, 2, "gold")],
            build_score_baseline: 100.0,
            knapsack_solution: vec![],
        };

        let json = assemble_run_optimization_payload(&snapshot, &scan_result)
            .expect("payload must serialize");
        let value: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");
        let suggestions = value["suggestions"].as_array().expect("suggestions array");

        assert!(suggestions.is_empty(), "empty knapsack must produce zero suggestions");
    }

    /// Degenerate (empty) knapsack paths are skipped without leaving rank gaps.
    #[test]
    fn run_optimization_payload_skips_empty_paths_without_rank_gaps() {
        let snapshot = make_snapshot();
        let scan_result = scoring_core::ScanResult {
            node_efficiencies: vec![
                make_efficiency("passive_alpha", 4.0, 2, "gold"),
                make_efficiency("passive_beta", 2.0, 1, "silver"),
            ],
            build_score_baseline: 100.0,
            knapsack_solution: vec![
                vec!["passive_alpha".to_string()],
                vec![], // degenerate path — skipped, must not create a rank gap
                vec!["passive_beta".to_string()],
            ],
        };

        let json = assemble_run_optimization_payload(&snapshot, &scan_result).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let suggestions = value["suggestions"].as_array().unwrap();

        assert_eq!(suggestions.len(), 2, "the empty path is skipped");
        assert_eq!(suggestions[0]["rank"].as_u64(), Some(1));
        assert_eq!(suggestions[1]["rank"].as_u64(), Some(2));
    }
}
