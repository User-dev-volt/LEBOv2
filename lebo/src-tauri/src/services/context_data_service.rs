use std::path::{Path, PathBuf};
use tauri::Manager;
use crate::models::context_data::{BlessingsDatabase, ConditionsDatabase, IdolData};

pub fn ensure_context_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("CONTEXT_DATA_ERROR: app_data_dir: {}", e))?;
    let data_dir = base.join("lebo").join("context-data");
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: create context-data dir: {}", e))?;
    Ok(data_dir)
}

pub fn copy_bundled_context_resources(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = ensure_context_data_dir(app_handle)?;
    let files = ["idol-data.json", "blessings.json", "conditions.json"];
    if files.iter().all(|f| data_dir.join(f).exists()) {
        return Ok(data_dir);
    }
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("CONTEXT_DATA_ERROR: resource_dir: {}", e))?;
    let src = resource_dir.join("resources").join("context-data");
    for filename in &files {
        let src_path = src.join(filename);
        let dst_path = data_dir.join(filename);
        std::fs::copy(&src_path, &dst_path)
            .map_err(|e| format!("CONTEXT_DATA_ERROR: copy {}: {}", filename, e))?;
    }
    Ok(data_dir)
}

pub fn load_idol_data_from_dir(data_dir: &Path) -> Result<IdolData, String> {
    let raw = std::fs::read_to_string(data_dir.join("idol-data.json"))
        .map_err(|e| format!("CONTEXT_DATA_ERROR: read idol-data.json: {}", e))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: parse idol-data.json: {}", e))
}

pub fn load_blessings_from_dir(data_dir: &Path) -> Result<BlessingsDatabase, String> {
    let raw = std::fs::read_to_string(data_dir.join("blessings.json"))
        .map_err(|e| format!("CONTEXT_DATA_ERROR: read blessings.json: {}", e))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: parse blessings.json: {}", e))
}

pub fn load_conditions_from_dir(data_dir: &Path) -> Result<ConditionsDatabase, String> {
    let raw = std::fs::read_to_string(data_dir.join("conditions.json"))
        .map_err(|e| format!("CONTEXT_DATA_ERROR: read conditions.json: {}", e))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("CONTEXT_DATA_ERROR: parse conditions.json: {}", e))
}
