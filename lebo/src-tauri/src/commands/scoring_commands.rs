use scoring_core::{BuildSnapshot, ComputeOptions, StatSheet};
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
    Ok(scoring_core::compute_stats(&snapshot, &game_data, ComputeOptions::default()))
}

/// Full optimization pipeline: compute_stats → run_efficiency_scan → run_synergy_detection,
/// then assembles a ranked payload and delegates to the existing Claude streaming infrastructure.
/// Pattern 3: clone game_data BEFORE spawn_blocking; never hold a read lock across await.
/// ADR-003: all three pure engine stages run in one spawn_blocking call.
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

    let (stat_sheet, scan_result, synergy_flags) =
        tauri::async_runtime::spawn_blocking(move || {
            let sheet = scoring_core::compute_stats(
                &snapshot_for_engine,
                &game_data,
                scoring_core::ComputeOptions::default(),
            );
            let scan = scoring_core::run_efficiency_scan(&snapshot_for_engine, &game_data);
            let synergy = scoring_core::run_synergy_detection(&snapshot_for_engine, &game_data);
            (sheet, scan, synergy)
        })
        .await
        .map_err(|e| format!("SCORING_ERROR: optimization compute panicked: {}", e))?;

    let user_message = assemble_run_optimization_payload(
        &snapshot, &stat_sheet, &scan_result, &synergy_flags,
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

fn extract_optimization_error_type(err: &str) -> String {
    for prefix in &["AUTH_ERROR", "API_ERROR", "NETWORK_ERROR", "TIMEOUT", "PARSE_ERROR", "SCORING_ERROR"] {
        if err.starts_with(prefix) {
            return prefix.to_string();
        }
    }
    "UNKNOWN".to_string()
}

/// Priority-merges stat_sheet warnings + synergy flags + knapsack paths into a ranked
/// JSON string for the Claude user_message. Priority order:
/// 1. Critical warnings (defensive floors)  2. Game-changer synergies
/// 3. High-priority mismatched affixes       4. Knapsack solution paths
/// 5. Medium-priority zero-value reallocations
fn assemble_run_optimization_payload(
    snapshot: &scoring_core::BuildSnapshot,
    stat_sheet: &scoring_core::StatSheet,
    scan_result: &scoring_core::ScanResult,
    synergy_flags: &[scoring_core::SynergyFlag],
) -> Result<String, String> {
    let mut suggestions: Vec<serde_json::Value> = Vec::new();
    let mut rank: u32 = 1;

    // 1. Critical defensive warnings (highest priority)
    for warning in &stat_sheet.warnings {
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "critical_warning",
            "toNodeId": format!("warning:{}", warning.warning_type),
            "fromNodeId": serde_json::Value::Null,
            "pointCost": 0,
            "deltaBuildScore": serde_json::Value::Null,
            "context": format!(
                "Defensive floor failure: {} (current: {:.0}, gap: {:.0}). Fix this before optimizing offensively.",
                warning.warning_type, warning.current_value, warning.gap
            )
        }));
        rank += 1;
    }

    // 2. Game-changer synergy flags sorted by delta_build_score descending
    let mut game_changers: Vec<&scoring_core::SynergyFlag> = synergy_flags
        .iter()
        .filter(|f| f.flag_type == "game_changer")
        .collect();
    game_changers.sort_by(|a, b| {
        b.delta_build_score.unwrap_or(0.0)
            .partial_cmp(&a.delta_build_score.unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for flag in game_changers {
        let to_node_id = flag.node_id
            .as_deref()
            .map(|n| format!("unique:{}", n))
            .unwrap_or_else(|| "unique:unknown".to_string());
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "game_changer",
            "toNodeId": to_node_id,
            "fromNodeId": serde_json::Value::Null,
            "pointCost": 0,
            "deltaBuildScore": flag.delta_build_score,
            "context": flag.description
        }));
        rank += 1;
    }

    // 3. High-priority synergy flags (mismatched affixes, not game_changers)
    for flag in synergy_flags.iter().filter(|f| f.priority == "high" && f.flag_type != "game_changer") {
        let to_node_id = flag.slot
            .as_deref()
            .map(|s| format!("synergy:affix:{}", s))
            .unwrap_or_else(|| "synergy:affix:unknown".to_string());
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "mismatched_affix",
            "toNodeId": to_node_id,
            "fromNodeId": serde_json::Value::Null,
            "pointCost": 0,
            "deltaBuildScore": serde_json::Value::Null,
            "context": flag.description
        }));
        rank += 1;
    }

    // 4. Knapsack solution paths (optimal passive allocations)
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

    // 5. Medium-priority synergy flags (zero-value reallocations)
    for flag in synergy_flags.iter().filter(|f| f.priority == "medium") {
        let to_node_id = flag.node_id
            .as_deref()
            .unwrap_or("synergy:unknown")
            .to_string();
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "zero_value_allocation",
            "toNodeId": to_node_id,
            "fromNodeId": serde_json::Value::Null,
            "pointCost": 0,
            "deltaBuildScore": serde_json::Value::Null,
            "context": flag.description
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
