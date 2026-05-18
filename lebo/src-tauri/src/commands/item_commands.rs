use crate::models::game_data::DataVersionCheckResult;
use crate::models::item_data::ItemDatabase;
use crate::services::game_data_service::{self, REMOTE_DATA_BASE_URL};
use crate::services::item_data_service;

#[tauri::command]
pub async fn load_item_database(app_handle: tauri::AppHandle) -> Result<ItemDatabase, String> {
    let data_dir = item_data_service::copy_bundled_item_resources(&app_handle)?;
    item_data_service::load_item_database_from_dir(&data_dir)
}

#[tauri::command]
pub async fn check_item_data_freshness(
    app_handle: tauri::AppHandle,
) -> Result<DataVersionCheckResult, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let local = game_data_service::load_manifest(&data_dir)?;
    let remote = game_data_service::fetch_remote_manifest(REMOTE_DATA_BASE_URL).await?;

    let local_version = local.item_data_version.unwrap_or_default();
    let remote_version = remote.item_data_version.unwrap_or_default();

    // Treat as not stale when remote has no itemDataVersion (graceful degradation)
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
pub async fn update_item_data(app_handle: tauri::AppHandle) -> Result<(), String> {
    let game_data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let item_data_dir = item_data_service::ensure_item_data_dir(&app_handle)?;

    let remote = game_data_service::fetch_remote_manifest(REMOTE_DATA_BASE_URL).await?;
    let remote_version = remote.item_data_version.clone().unwrap_or_default();
    if remote_version.is_empty() {
        return Err("ITEM_DATA_ERROR: remote manifest has no itemDataVersion".to_string());
    }

    let client = game_data_service::http_client()?;
    for filename in &["base-items.json", "uniques.json", "affixes.json"] {
        let url = format!("{}/items/{}", REMOTE_DATA_BASE_URL, filename);
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("NETWORK_ERROR: fetch item file {}: {}", filename, e))?;
        if !response.status().is_success() {
            return Err(format!(
                "NETWORK_ERROR: fetch item file {}: HTTP {}",
                filename,
                response.status()
            ));
        }
        let content = response
            .bytes()
            .await
            .map_err(|e| format!("NETWORK_ERROR: read item file {} body: {}", filename, e))?;

        let dest_path = item_data_dir.join(filename);
        game_data_service::atomic_write_file(&dest_path, &content).await?;
    }

    // Surgically update only itemDataVersion in local manifest — do not overwrite game data fields
    let mut local = game_data_service::load_manifest(&game_data_dir)?;
    local.item_data_version = Some(remote_version);
    let manifest_json = serde_json::to_string_pretty(&local)
        .map_err(|e| format!("ITEM_DATA_ERROR: serialize manifest: {}", e))?;
    game_data_service::atomic_write_file(&game_data_dir.join("manifest.json"), manifest_json.as_bytes()).await?;

    Ok(())
}
