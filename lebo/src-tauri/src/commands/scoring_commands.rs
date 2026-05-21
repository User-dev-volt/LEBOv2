use scoring_core::{BuildSnapshot, ComputeOptions, StatSheet};
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
