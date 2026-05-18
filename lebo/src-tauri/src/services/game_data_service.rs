use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_http::reqwest;

use crate::models::game_data::{GameDataManifest, RawClassData};

pub const REMOTE_DATA_BASE_URL: &str =
    "https://raw.githubusercontent.com/alec-vautherot/lebo-data/main";

pub fn ensure_game_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir error: {}", e))?;
    let data_dir = base.join("lebo").join("game-data");
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("mkdir error: {}", e))?;
    Ok(data_dir)
}

pub fn copy_bundled_resources(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let data_dir = ensure_game_data_dir(app_handle)?;

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir error: {}", e))?;
    let bundled_data = resource_dir.join("resources").join("game-data");

    // Re-copy whenever the bundled dataVersion differs from what's on disk.
    // This ensures schema changes (new fields, restructured JSON) are picked up
    // after an app update, even if the game version hasn't changed.
    let manifest_path = data_dir.join("manifest.json");
    if manifest_path.exists() {
        let bundled_manifest_path = bundled_data.join("manifest.json");
        let needs_update = if bundled_manifest_path.exists() {
            match (
                std::fs::read_to_string(&manifest_path),
                std::fs::read_to_string(&bundled_manifest_path),
            ) {
                (Ok(local_raw), Ok(bundled_raw)) => {
                    let local: serde_json::Value = serde_json::from_str(&local_raw).unwrap_or_default();
                    let bundled: serde_json::Value = serde_json::from_str(&bundled_raw).unwrap_or_default();
                    local["dataVersion"] != bundled["dataVersion"]
                }
                _ => false,
            }
        } else {
            false
        };
        if !needs_update {
            return Ok(());
        }
    }

    copy_dir_recursive(&bundled_data, &data_dir)
        .map_err(|e| format!("copy resources error: {}", e))?;

    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

pub fn load_manifest(data_dir: &Path) -> Result<GameDataManifest, String> {
    let path = data_dir.join("manifest.json");
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("STORAGE_ERROR: read manifest: {}", e))?;
    serde_json::from_str::<GameDataManifest>(&raw)
        .map_err(|e| format!("STORAGE_ERROR: parse manifest: {}", e))
}

pub fn load_class_data(data_dir: &Path, class_id: &str) -> Result<RawClassData, String> {
    let path = data_dir.join("classes").join(format!("{}.json", class_id));
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("STORAGE_ERROR: read class {}: {}", class_id, e))?;
    serde_json::from_str::<RawClassData>(&raw)
        .map_err(|e| format!("STORAGE_ERROR: parse class {}: {}", class_id, e))
}

pub fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("NETWORK_ERROR: build http client: {}", e))
}

pub async fn fetch_remote_manifest(base_url: &str) -> Result<GameDataManifest, String> {
    let url = format!("{}/manifest.json", base_url);
    let response = http_client()?
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("NETWORK_ERROR: fetch remote manifest: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("NETWORK_ERROR: fetch remote manifest: HTTP {}", response.status()));
    }
    let text = response
        .text()
        .await
        .map_err(|e| format!("NETWORK_ERROR: read remote manifest body: {}", e))?;
    serde_json::from_str::<GameDataManifest>(&text)
        .map_err(|e| format!("STORAGE_ERROR: parse remote manifest: {}", e))
}

pub async fn atomic_write_file(path: &Path, data: &[u8]) -> Result<(), String> {
    let temp = path.with_extension("tmp");
    if let Err(e) = tokio::fs::write(&temp, data).await {
        let _ = std::fs::remove_file(&temp);
        return Err(format!("STORAGE_ERROR: write temp {}: {}", path.display(), e));
    }
    if let Err(e) = tokio::fs::rename(&temp, path).await {
        let _ = std::fs::remove_file(&temp);
        return Err(format!("STORAGE_ERROR: rename temp {}: {}", path.display(), e));
    }
    Ok(())
}

pub async fn download_class_files(
    base_url: &str,
    data_dir: &Path,
    classes: &[String],
) -> Result<(), String> {
    let classes_dir = data_dir.join("classes");
    std::fs::create_dir_all(&classes_dir)
        .map_err(|e| format!("STORAGE_ERROR: create classes dir: {}", e))?;

    let client = http_client()?;
    for class_id in classes {
        let url = format!("{}/classes/{}.json", base_url, class_id);
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("NETWORK_ERROR: fetch class {}: {}", class_id, e))?;
        if !response.status().is_success() {
            return Err(format!("NETWORK_ERROR: fetch class {}: HTTP {}", class_id, response.status()));
        }
        let text = response
            .text()
            .await
            .map_err(|e| format!("NETWORK_ERROR: read class {} body: {}", class_id, e))?;
        // Validate JSON before writing to disk
        serde_json::from_str::<RawClassData>(&text)
            .map_err(|e| format!("STORAGE_ERROR: validate class {}: {}", class_id, e))?;
        let dest = classes_dir.join(format!("{}.json", class_id));
        atomic_write_file(&dest, text.as_bytes()).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "lebo_gds_{}_{}_{}", std::process::id(), label,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn atomic_write_success_creates_final_file() {
        let dir = temp_dir("atomic_success");
        let path = dir.join("test.json");
        atomic_write_file(&path, b"{\"ok\":true}").await.unwrap();
        assert!(path.exists(), "final file should exist after atomic write");
        assert!(!path.with_extension("tmp").exists(), ".tmp should be gone after rename");
        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "{\"ok\":true}");
        fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn atomic_write_fails_when_parent_dir_missing() {
        let dir = temp_dir("atomic_no_parent");
        // Use a path whose parent does not exist — write will fail
        let path = dir.join("nonexistent").join("test.json");
        let result = atomic_write_file(&path, b"{}").await;
        assert!(result.is_err(), "should return Err when parent dir is missing");
        let msg = result.unwrap_err();
        assert!(msg.starts_with("STORAGE_ERROR:"), "error should use STORAGE_ERROR prefix; got: {}", msg);
        fs::remove_dir_all(&dir).ok();
    }
}
