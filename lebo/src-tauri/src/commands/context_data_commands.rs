use crate::models::context_data::{BlessingsDatabase, ConditionsDatabase, IdolData};
use crate::models::game_data::DataVersionCheckResult;
use crate::services::context_data_service;
use crate::services::game_data_service::{self, REMOTE_DATA_BASE_URL};

#[tauri::command]
pub async fn load_idol_data(app_handle: tauri::AppHandle) -> Result<IdolData, String> {
    let data_dir = context_data_service::copy_bundled_context_resources(&app_handle)?;
    context_data_service::load_idol_data_from_dir(&data_dir)
}

#[tauri::command]
pub async fn load_blessings_data(app_handle: tauri::AppHandle) -> Result<BlessingsDatabase, String> {
    let data_dir = context_data_service::copy_bundled_context_resources(&app_handle)?;
    context_data_service::load_blessings_from_dir(&data_dir)
}

#[tauri::command]
pub async fn load_conditions_data(app_handle: tauri::AppHandle) -> Result<ConditionsDatabase, String> {
    let data_dir = context_data_service::copy_bundled_context_resources(&app_handle)?;
    context_data_service::load_conditions_from_dir(&data_dir)
}

#[tauri::command]
pub async fn check_idol_data_freshness(
    app_handle: tauri::AppHandle,
) -> Result<DataVersionCheckResult, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let local = game_data_service::load_manifest(&data_dir)?;
    let remote = game_data_service::fetch_remote_manifest(REMOTE_DATA_BASE_URL).await?;

    let local_version = local.idol_data_version.unwrap_or_default();
    let remote_version = remote.idol_data_version.unwrap_or_default();

    // Treat as not stale when remote has no idolDataVersion (graceful degradation)
    let is_stale = !local_version.is_empty() && !remote_version.is_empty() && local_version != remote_version;
    let versions_behind = if is_stale { 1 } else { 0 };

    Ok(DataVersionCheckResult {
        is_stale,
        local_version,
        remote_version,
        versions_behind,
    })
}

#[tauri::command]
pub async fn check_blessings_data_freshness(
    app_handle: tauri::AppHandle,
) -> Result<DataVersionCheckResult, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let local = game_data_service::load_manifest(&data_dir)?;
    let remote = game_data_service::fetch_remote_manifest(REMOTE_DATA_BASE_URL).await?;

    let local_version = local.blessings_data_version.unwrap_or_default();
    let remote_version = remote.blessings_data_version.unwrap_or_default();

    let is_stale = !local_version.is_empty() && !remote_version.is_empty() && local_version != remote_version;
    let versions_behind = if is_stale { 1 } else { 0 };

    Ok(DataVersionCheckResult {
        is_stale,
        local_version,
        remote_version,
        versions_behind,
    })
}
