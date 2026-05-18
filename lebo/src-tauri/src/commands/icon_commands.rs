use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use crate::services::game_data_service;

/// Tauri managed state for the parsed skill-icon-map, cached after first load.
pub struct IconMapCache(pub Mutex<Option<HashMap<String, String>>>);

/// Returns the icon cache directory path without creating it.
fn icon_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("ICON_ERROR: app_data_dir: {}", e))?;
    Ok(base.join("lebo").join("icons"))
}

/// Returns the icon cache directory, creating it if absent.
fn ensure_icon_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let icon_dir = icon_cache_dir(app_handle)?;
    std::fs::create_dir_all(&icon_dir)
        .map_err(|e| format!("ICON_ERROR: create icon cache dir: {}", e))?;
    Ok(icon_dir)
}

// Duplicates copy_dir_recursive from game_data_service.rs — both use String errors
// but game_data_service uses io::Result internally. Extraction to a shared utility
// is deferred; keep in sync if either copy diverges.
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("ICON_ERROR: create dir {}: {}", dst.display(), e))?;
    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("ICON_ERROR: read dir {}: {}", src.display(), e))?
    {
        let entry = entry.map_err(|e| format!("ICON_ERROR: read entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("ICON_ERROR: copy {}: {}", src_path.display(), e))?;
        }
    }
    Ok(())
}

/// Copies the skills/ subdirectory and skill-icon-map.json from src_icons into icon_dir.
fn copy_icon_resources(src_icons: &Path, icon_dir: &Path) -> Result<(), String> {
    copy_dir_recursive(&src_icons.join("skills"), &icon_dir.join("skills"))?;
    std::fs::copy(
        src_icons.join("skill-icon-map.json"),
        icon_dir.join("skill-icon-map.json"),
    )
    .map_err(|e| format!("ICON_ERROR: copy skill-icon-map.json: {}", e))?;
    Ok(())
}

/// Reads and parses skill-icon-map.json; returns None if the file is absent
/// (pipeline not yet initialized).
fn load_icon_map(icon_dir: &Path) -> Result<Option<HashMap<String, String>>, String> {
    let map_path = icon_dir.join("skill-icon-map.json");
    if !map_path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&map_path)
        .map_err(|e| format!("ICON_ERROR: read skill-icon-map: {}", e))?;
    let map: HashMap<String, String> = serde_json::from_str(&raw)
        .map_err(|e| format!("ICON_ERROR: parse skill-icon-map: {}", e))?;
    Ok(Some(map))
}

/// Resolves a skill_id to its absolute icon path using a pre-loaded map, or None.
/// Returns None for unmapped skills and for map entries whose file is absent on disk.
fn resolve_icon_path(
    map: &HashMap<String, String>,
    skill_id: &str,
    icon_dir: &Path,
) -> Option<String> {
    let filename = map.get(skill_id)?;
    let path = icon_dir.join("skills").join(filename);
    if path.exists() {
        Some(path.to_string_lossy().to_string())
    } else {
        None
    }
}

/// Best-effort: records iconSource and iconCacheVersion in manifest.json.
/// Silently skips if the manifest doesn't exist yet (startup race condition).
async fn update_manifest_icon_source(app_handle: &tauri::AppHandle, icon_source: &str) {
    let Ok(data_dir) = game_data_service::ensure_game_data_dir(app_handle) else { return };
    let Ok(mut manifest) = game_data_service::load_manifest(&data_dir) else { return };
    manifest.icon_source = Some(icon_source.to_string());
    manifest.icon_cache_version = Some("1.0.0".to_string());
    if let Ok(json) = serde_json::to_string_pretty(&manifest) {
        let _ = game_data_service::atomic_write_file(&data_dir.join("manifest.json"), json.as_bytes()).await;
    }
}

#[tauri::command]
pub async fn initialize_icon_pipeline(app_handle: tauri::AppHandle) -> Result<(), String> {
    let icon_dir = ensure_icon_cache_dir(&app_handle)?;

    // Idempotent — both the skip path and the copy path emit { "iconSource": "game-files" }.
    if icon_dir.join("skill-icon-map.json").exists() {
        update_manifest_icon_source(&app_handle, "game-files").await;
        app_handle
            .emit(
                "icon-pipeline:initialized",
                serde_json::json!({ "iconSource": "game-files" }),
            )
            .map_err(|e| format!("ICON_ERROR: emit icon-pipeline:initialized: {}", e))?;
        return Ok(());
    }

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("ICON_ERROR: resource_dir: {}", e))?;
    let src_icons = resource_dir.join("resources").join("icons");

    copy_icon_resources(&src_icons, &icon_dir)?;

    update_manifest_icon_source(&app_handle, "game-files").await;
    app_handle
        .emit(
            "icon-pipeline:initialized",
            serde_json::json!({ "iconSource": "game-files" }),
        )
        .map_err(|e| format!("ICON_ERROR: emit icon-pipeline:initialized: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_icon_cache_path(
    app_handle: tauri::AppHandle,
    cache: tauri::State<'_, IconMapCache>,
    skill_id: String,
) -> Result<Option<String>, String> {
    // Pure path derivation — intentionally no create_dir_all; a read-only lookup
    // must not create directories as a side effect.
    let icon_dir = icon_cache_dir(&app_handle)?;

    // Fast path: use in-memory cache if already populated.
    {
        let guard = cache
            .0
            .lock()
            .map_err(|_| "ICON_ERROR: icon map cache lock poisoned".to_string())?;
        if let Some(ref map) = *guard {
            return Ok(resolve_icon_path(map, &skill_id, &icon_dir));
        }
    }

    // Slow path: load from disk, then cache for subsequent calls.
    let Some(map) = load_icon_map(&icon_dir)? else {
        return Ok(None); // Pipeline not yet initialized
    };

    let result = resolve_icon_path(&map, &skill_id, &icon_dir);
    let mut guard = cache
        .0
        .lock()
        .map_err(|_| "ICON_ERROR: icon map cache lock poisoned".to_string())?;
    *guard = Some(map);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("lebo_icon_{}_{}_{}", std::process::id(), label, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().subsec_nanos()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_map(icon_dir: &Path, entries: &[(&str, &str)]) {
        let map: HashMap<&str, &str> = entries.iter().copied().collect();
        fs::write(
            icon_dir.join("skill-icon-map.json"),
            serde_json::to_string(&map).unwrap(),
        )
        .unwrap();
    }

    fn write_icon(icon_dir: &Path, filename: &str) -> PathBuf {
        let skills = icon_dir.join("skills");
        fs::create_dir_all(&skills).unwrap();
        let path = skills.join(filename);
        fs::write(&path, b"fake-png").unwrap();
        path
    }

    #[test]
    fn load_icon_map_returns_none_when_file_absent() {
        let dir = temp_dir("map_absent");
        assert!(load_icon_map(&dir).unwrap().is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn load_icon_map_parses_entries() {
        let dir = temp_dir("map_valid");
        write_map(&dir, &[("mage-fireball", "skillIcon-fireball.png")]);
        let map = load_icon_map(&dir).unwrap().unwrap();
        assert_eq!(
            map.get("mage-fireball").map(String::as_str),
            Some("skillIcon-fireball.png")
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_icon_path_returns_none_for_unmapped_skill() {
        let dir = temp_dir("resolve_unmapped");
        let map = HashMap::new();
        // Unmapped skill IDs return None without error (AC #4)
        assert!(resolve_icon_path(&map, "mage-lightning-blast", &dir).is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_icon_path_returns_none_when_file_missing_despite_map_entry() {
        let dir = temp_dir("resolve_no_file");
        let mut map = HashMap::new();
        map.insert("mage-fireball".to_string(), "skillIcon-fireball.png".to_string());
        // Map entry present but PNG absent → None, not an error (AC #5)
        assert!(resolve_icon_path(&map, "mage-fireball", &dir).is_none());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolve_icon_path_returns_absolute_path_when_file_exists() {
        let dir = temp_dir("resolve_exists");
        write_icon(&dir, "skillIcon-fireball.png");
        let mut map = HashMap::new();
        map.insert("mage-fireball".to_string(), "skillIcon-fireball.png".to_string());
        let result = resolve_icon_path(&map, "mage-fireball", &dir).unwrap();
        assert!(result.ends_with("skillIcon-fireball.png"));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn copy_icon_resources_writes_map_and_skills_directory() {
        let tmp = temp_dir("copy_res");
        let src = tmp.join("src");
        let dst = tmp.join("dst");

        fs::create_dir_all(src.join("skills")).unwrap();
        fs::write(src.join("skills").join("skillIcon-fireball.png"), b"fake").unwrap();
        write_map(&src, &[("mage-fireball", "skillIcon-fireball.png")]);

        copy_icon_resources(&src, &dst).unwrap();

        assert!(dst.join("skill-icon-map.json").exists());
        assert!(dst.join("skills").join("skillIcon-fireball.png").exists());
        fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn idempotent_skip_detected_via_map_file_presence() {
        let dir = temp_dir("idempotent");
        write_map(&dir, &[]);
        // load_icon_map returns Some when map file exists — mirrors the skip
        // guard in initialize_icon_pipeline (AC #2)
        assert!(load_icon_map(&dir).unwrap().is_some());
        fs::remove_dir_all(&dir).ok();
    }
}
