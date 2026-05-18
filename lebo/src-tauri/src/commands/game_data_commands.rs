use crate::models::game_data::{DataVersionCheckResult, GameDataManifest, RawClassData};
use crate::services::game_data_service;

#[tauri::command]
pub async fn get_manifest(app_handle: tauri::AppHandle) -> Result<GameDataManifest, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    game_data_service::load_manifest(&data_dir)
}

#[tauri::command]
pub async fn load_game_data(
    app_handle: tauri::AppHandle,
    class_id: Option<String>,
) -> Result<Vec<RawClassData>, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let manifest = game_data_service::load_manifest(&data_dir)?;

    match class_id {
        Some(id) => {
            let class_data = game_data_service::load_class_data(&data_dir, &id)?;
            Ok(vec![class_data])
        }
        None => {
            let mut classes = Vec::new();
            for class in &manifest.classes {
                let class_data = game_data_service::load_class_data(&data_dir, class)?;
                classes.push(class_data);
            }
            Ok(classes)
        }
    }
}

#[tauri::command]
pub async fn initialize_game_data(app_handle: tauri::AppHandle) -> Result<(), String> {
    game_data_service::ensure_game_data_dir(&app_handle)?;
    game_data_service::copy_bundled_resources(&app_handle)
}

#[tauri::command]
pub async fn check_data_version(
    app_handle: tauri::AppHandle,
) -> Result<DataVersionCheckResult, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let local = game_data_service::load_manifest(&data_dir)?;
    let remote =
        game_data_service::fetch_remote_manifest(game_data_service::REMOTE_DATA_BASE_URL).await?;
    let is_stale = local.game_version != remote.game_version;
    let versions_behind = if is_stale { 1 } else { 0 };
    Ok(DataVersionCheckResult {
        is_stale,
        local_version: local.game_version,
        remote_version: remote.game_version,
        versions_behind,
    })
}

#[tauri::command]
pub async fn download_game_data_update(
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let remote =
        game_data_service::fetch_remote_manifest(game_data_service::REMOTE_DATA_BASE_URL).await?;
    // Download class files before writing manifest (so partial failure leaves old manifest intact)
    game_data_service::download_class_files(
        game_data_service::REMOTE_DATA_BASE_URL,
        &data_dir,
        &remote.classes,
    )
    .await?;
    // Write manifest last — only once class files are successfully written.
    // Preserve local-only fields (icon_source, icon_cache_version, item_data_version) that the
    // remote CDN manifest has no knowledge of; load local first and carry them forward.
    let mut merged = remote;
    if let Ok(local) = game_data_service::load_manifest(&data_dir) {
        merged.icon_source = local.icon_source;
        merged.icon_cache_version = local.icon_cache_version;
        merged.item_data_version = local.item_data_version;
    }
    let manifest_json = serde_json::to_string_pretty(&merged)
        .map_err(|e| format!("STORAGE_ERROR: serialize manifest: {}", e))?;
    game_data_service::atomic_write_file(&data_dir.join("manifest.json"), manifest_json.as_bytes()).await?;
    Ok(())
}
