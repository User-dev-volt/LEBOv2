use crate::services::connectivity_service;
use crate::services::keychain_service;
use reqwest;

const OPENROUTER_AUTH_URL: &str = "https://openrouter.ai/api/v1/auth/key";

#[tauri::command]
pub async fn set_api_key(app_handle: tauri::AppHandle, key: String) -> Result<(), String> {
    keychain_service::set_api_key(&app_handle, &key).await
}

#[tauri::command]
pub async fn check_api_key_configured(app_handle: tauri::AppHandle) -> Result<bool, String> {
    keychain_service::is_api_key_configured(&app_handle).await
}

#[tauri::command]
pub async fn check_connectivity() -> bool {
    connectivity_service::check_once().await
}

#[tauri::command]
pub async fn restart_app(app_handle: tauri::AppHandle) {
    app_handle.restart();
}

#[tauri::command]
pub async fn set_llm_provider(app_handle: tauri::AppHandle, provider: String) -> Result<(), String> {
    keychain_service::set_llm_provider(&app_handle, &provider).await
}

#[tauri::command]
pub async fn get_llm_provider(app_handle: tauri::AppHandle) -> Result<String, String> {
    keychain_service::get_llm_provider(&app_handle).await
}

#[tauri::command]
pub async fn set_openrouter_api_key(app_handle: tauri::AppHandle, key: String) -> Result<(), String> {
    keychain_service::set_openrouter_api_key(&app_handle, &key).await
}

#[tauri::command]
pub async fn check_openrouter_configured(app_handle: tauri::AppHandle) -> Result<bool, String> {
    keychain_service::is_openrouter_configured(&app_handle).await
}

/// Validates the saved OpenRouter API key by calling the /auth/key endpoint.
/// Returns a human-readable status string on success (e.g. credits remaining),
/// or an error string describing the problem.
#[tauri::command]
pub async fn validate_openrouter_key(app_handle: tauri::AppHandle) -> Result<String, String> {
    let key = keychain_service::get_openrouter_api_key(&app_handle).await
        .map_err(|_| "No OpenRouter API key saved. Enter a key and click Save first.".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(OPENROUTER_AUTH_URL)
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Request timed out — check your internet connection.".to_string()
            } else {
                format!("Network error: {}", e)
            }
        })?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    match status.as_u16() {
        200 => {
            // Parse out usage/limit if present
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                let usage = json["data"]["usage"].as_f64();
                let limit = json["data"]["limit"].as_f64();
                let is_free = json["data"]["is_free_tier"].as_bool().unwrap_or(false);
                match (usage, limit) {
                    (Some(u), Some(l)) => Ok(format!(
                        "Key valid ✓  |  ${:.4} used of ${:.2} limit{}",
                        u, l,
                        if is_free { "  (free tier)" } else { "" }
                    )),
                    (Some(u), None) => Ok(format!(
                        "Key valid ✓  |  ${:.4} used  (no spending limit){}",
                        u,
                        if is_free { "  (free tier)" } else { "" }
                    )),
                    _ => Ok("Key valid ✓".to_string()),
                }
            } else {
                Ok("Key valid ✓".to_string())
            }
        }
        401 | 403 => Err("Invalid API key — check the key and try again.".to_string()),
        429 => Err("Rate limited — your key is valid but currently throttled.".to_string()),
        _ => Err(format!("OpenRouter returned HTTP {} — {}", status, body.chars().take(120).collect::<String>())),
    }
}

