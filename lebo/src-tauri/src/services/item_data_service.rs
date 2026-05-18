use std::path::{Path, PathBuf};
use tauri::Manager;
use crate::models::item_data::ItemDatabase;

pub fn ensure_item_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("ITEM_DATA_ERROR: app_data_dir: {}", e))?;
    let data_dir = base.join("lebo").join("items");
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("ITEM_DATA_ERROR: create items dir: {}", e))?;
    Ok(data_dir)
}

pub fn copy_bundled_item_resources(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = ensure_item_data_dir(app_handle)?;
    let files = ["base-items.json", "uniques.json", "affixes.json"];
    if files.iter().all(|f| data_dir.join(f).exists()) {
        return Ok(data_dir);
    }
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("ITEM_DATA_ERROR: resource_dir: {}", e))?;
    let src = resource_dir.join("resources").join("items");
    for filename in &files {
        let src_path = src.join(filename);
        let dst_path = data_dir.join(filename);
        std::fs::copy(&src_path, &dst_path)
            .map_err(|e| format!("ITEM_DATA_ERROR: copy {}: {}", filename, e))?;
    }
    Ok(data_dir)
}

pub fn load_item_database_from_dir(data_dir: &Path) -> Result<ItemDatabase, String> {
    let base_items_raw = std::fs::read_to_string(data_dir.join("base-items.json"))
        .map_err(|e| format!("ITEM_DATA_ERROR: read base-items.json: {}", e))?;
    let unique_items_raw = std::fs::read_to_string(data_dir.join("uniques.json"))
        .map_err(|e| format!("ITEM_DATA_ERROR: read uniques.json: {}", e))?;
    let affixes_raw = std::fs::read_to_string(data_dir.join("affixes.json"))
        .map_err(|e| format!("ITEM_DATA_ERROR: read affixes.json: {}", e))?;

    let base_items = serde_json::from_str(&base_items_raw)
        .map_err(|e| format!("ITEM_DATA_ERROR: parse base-items.json: {}", e))?;
    let unique_items = serde_json::from_str(&unique_items_raw)
        .map_err(|e| format!("ITEM_DATA_ERROR: parse uniques.json: {}", e))?;
    let affixes = serde_json::from_str(&affixes_raw)
        .map_err(|e| format!("ITEM_DATA_ERROR: parse affixes.json: {}", e))?;

    Ok(ItemDatabase { base_items, unique_items, affixes })
}
