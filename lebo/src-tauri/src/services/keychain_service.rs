use argon2::{Argon2, Params};
use std::sync::OnceLock;
use tauri::Manager;
use tauri_plugin_stronghold::stronghold::Stronghold as SHVault;

const VAULT_PASSWORD: &[u8] = b"lebo-vault-password";
const CLIENT_NAME: &[u8] = b"lebo";
const VAULT_KEY: &[u8] = b"anthropic_api_key";
const LLM_PROVIDER_KEY: &[u8] = b"llm_provider";
const OPENROUTER_API_KEY: &[u8] = b"openrouter_api_key";
const MODEL_PREFERENCE_KEY: &[u8] = b"openrouter_model_preference";

// Argon2id output is deterministic for fixed inputs — compute once per process.
static VAULT_KEY_CACHE: OnceLock<Vec<u8>> = OnceLock::new();

pub fn hash_vault_password() -> Vec<u8> {
    VAULT_KEY_CACHE
        .get_or_init(|| {
            let params = Params::new(65536, 2, 1, Some(32)).expect("invalid argon2 params");
            let mut output = vec![0u8; 32];
            Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params)
                .hash_password_into(VAULT_PASSWORD, b"lebo-stronghold-salt", &mut output)
                .expect("argon2 hash failed");
            output
        })
        .clone()
}

fn get_vault_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("lebo.stronghold")
}

fn open_vault(vault_path: &std::path::Path) -> Result<SHVault, String> {
    let password = hash_vault_password();
    SHVault::new(vault_path, password).map_err(|e| format!("STORAGE_ERROR: failed to open vault: {e}"))
}

pub async fn set_api_key(app: &tauri::AppHandle, key: &str) -> Result<(), String> {
    let vault_path = get_vault_path(app);
    let key = key.to_string();
    tokio::task::spawn_blocking(move || {
        let sh = open_vault(&vault_path)?;
        let client = match sh.load_client(CLIENT_NAME) {
            Ok(c) => c,
            Err(_) => sh
                .create_client(CLIENT_NAME)
                .map_err(|e| format!("STORAGE_ERROR: failed to create client: {e}"))?,
        };
        client
            .store()
            .insert(VAULT_KEY.to_vec(), key.as_bytes().to_vec(), None)
            .map_err(|e| format!("STORAGE_ERROR: failed to store key: {e}"))?;
        sh.save()
            .map_err(|e| format!("STORAGE_ERROR: failed to save vault: {e}"))
    })
    .await
    .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

pub async fn get_api_key(app: &tauri::AppHandle) -> Result<String, String> {
    let vault_path = get_vault_path(app);
    if !vault_path.exists() {
        return Err(
            "AUTH_ERROR: No API key configured. Add your Claude API key in Settings.".to_string(),
        );
    }
    tokio::task::spawn_blocking(move || {
        let sh = open_vault(&vault_path).map_err(|e| e)?;
        let client = sh
            .load_client(CLIENT_NAME)
            .map_err(|e| format!("STORAGE_ERROR: failed to load vault client: {e}"))?;
        let data = client
            .store()
            .get(VAULT_KEY)
            .map_err(|e| format!("STORAGE_ERROR: failed to read from vault: {e}"))?
            .ok_or_else(|| "AUTH_ERROR: No API key configured. Add your Claude API key in Settings.".to_string())?;
        String::from_utf8(data).map_err(|_| "AUTH_ERROR: API key corrupted in vault".to_string())
    })
    .await
    .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

pub async fn is_api_key_configured(app: &tauri::AppHandle) -> Result<bool, String> {
    let vault_path = get_vault_path(app);
    if !vault_path.exists() {
        return Ok(false);
    }
    tokio::task::spawn_blocking(move || {
        let sh = open_vault(&vault_path).map_err(|e| format!("STORAGE_ERROR: {e}"))?;
        let client = match sh.load_client(CLIENT_NAME) {
            Ok(c) => c,
            Err(_) => return Ok(false),
        };
        let exists = client
            .store()
            .get(VAULT_KEY)
            .map(|v| v.is_some())
            .unwrap_or(false);
        Ok(exists)
    })
    .await
    .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

// ── Generic vault helpers ────────────────────────────────────────────────────

fn vault_write(vault_path: std::path::PathBuf, key: &'static [u8], value: String) -> Result<(), String> {
    let sh = open_vault(&vault_path)?;
    let client = match sh.load_client(CLIENT_NAME) {
        Ok(c) => c,
        Err(_) => sh
            .create_client(CLIENT_NAME)
            .map_err(|e| format!("STORAGE_ERROR: failed to create client: {e}"))?,
    };
    client
        .store()
        .insert(key.to_vec(), value.as_bytes().to_vec(), None)
        .map_err(|e| format!("STORAGE_ERROR: failed to store value: {e}"))?;
    sh.save()
        .map_err(|e| format!("STORAGE_ERROR: failed to save vault: {e}"))
}

fn vault_read(vault_path: std::path::PathBuf, key: &[u8], default: Option<String>, absent_err: Option<String>) -> Result<String, String> {
    if !vault_path.exists() {
        if let Some(d) = default { return Ok(d); }
        return Err(absent_err.unwrap_or_else(|| "AUTH_ERROR: key not found".to_string()));
    }
    let sh = open_vault(&vault_path)?;
    let client = match sh.load_client(CLIENT_NAME) {
        Ok(c) => c,
        Err(_) => {
            if let Some(d) = default { return Ok(d); }
            return Err(absent_err.unwrap_or_else(|| "AUTH_ERROR: key not found".to_string()));
        }
    };
    match client.store().get(key) {
        Ok(Some(data)) => String::from_utf8(data).map_err(|_| "AUTH_ERROR: value corrupted in vault".to_string()),
        Ok(None) => {
            if let Some(d) = default { Ok(d) }
            else { Err(absent_err.unwrap_or_else(|| "AUTH_ERROR: key not found".to_string())) }
        }
        Err(e) => Err(format!("STORAGE_ERROR: failed to read from vault: {e}")),
    }
}

fn vault_key_exists(vault_path: std::path::PathBuf, key: &[u8]) -> Result<bool, String> {
    if !vault_path.exists() { return Ok(false); }
    let sh = open_vault(&vault_path).map_err(|e| format!("STORAGE_ERROR: {e}"))?;
    let client = match sh.load_client(CLIENT_NAME) {
        Ok(c) => c,
        Err(_) => return Ok(false),
    };
    Ok(client.store().get(key).map(|v| v.is_some()).unwrap_or(false))
}

// ── LLM provider ─────────────────────────────────────────────────────────────

fn validate_provider(provider: &str) -> Result<(), String> {
    match provider {
        "claude" | "openrouter" => Ok(()),
        other => Err(format!("VALIDATION_ERROR: unknown provider '{}'. Must be 'claude' or 'openrouter'.", other)),
    }
}

pub async fn set_llm_provider(app: &tauri::AppHandle, provider: &str) -> Result<(), String> {
    validate_provider(provider)?;
    let vault_path = get_vault_path(app);
    let provider = provider.to_string();
    tokio::task::spawn_blocking(move || vault_write(vault_path, LLM_PROVIDER_KEY, provider))
        .await
        .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

pub async fn get_llm_provider(app: &tauri::AppHandle) -> Result<String, String> {
    let vault_path = get_vault_path(app);
    tokio::task::spawn_blocking(move || {
        vault_read(vault_path, LLM_PROVIDER_KEY, Some("claude".to_string()), None)
    })
    .await
    .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

// ── OpenRouter API key ────────────────────────────────────────────────────────

pub async fn set_openrouter_api_key(app: &tauri::AppHandle, key: &str) -> Result<(), String> {
    let vault_path = get_vault_path(app);
    let key = key.to_string();
    tokio::task::spawn_blocking(move || vault_write(vault_path, OPENROUTER_API_KEY, key))
        .await
        .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

pub async fn get_openrouter_api_key(app: &tauri::AppHandle) -> Result<String, String> {
    let vault_path = get_vault_path(app);
    tokio::task::spawn_blocking(move || {
        vault_read(
            vault_path,
            OPENROUTER_API_KEY,
            None,
            Some("AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings.".to_string()),
        )
    })
    .await
    .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

pub async fn is_openrouter_configured(app: &tauri::AppHandle) -> Result<bool, String> {
    let vault_path = get_vault_path(app);
    tokio::task::spawn_blocking(move || vault_key_exists(vault_path, OPENROUTER_API_KEY))
        .await
        .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

// ── Model preference ──────────────────────────────────────────────────────────

fn validate_model_preference(preference: &str) -> Result<(), String> {
    if preference.is_empty() {
        return Err("VALIDATION_ERROR: model preference cannot be empty".to_string());
    }
    if preference.len() > 128 {
        return Err(format!(
            "VALIDATION_ERROR: model preference too long ({} chars, max 128)",
            preference.len()
        ));
    }
    // Allow "free-first" sentinel and model IDs like "google/gemini-2.0-flash-exp:free".
    // Permitted chars: alphanumeric, /, -, :, ., _
    if !preference.chars().all(|c| c.is_alphanumeric() || matches!(c, '/' | '-' | ':' | '.' | '_')) {
        return Err("VALIDATION_ERROR: model preference contains invalid characters".to_string());
    }
    Ok(())
}

pub async fn set_model_preference(app: &tauri::AppHandle, preference: &str) -> Result<(), String> {
    validate_model_preference(preference)?;
    let vault_path = get_vault_path(app);
    let preference = preference.to_string();
    tokio::task::spawn_blocking(move || vault_write(vault_path, MODEL_PREFERENCE_KEY, preference))
        .await
        .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

pub async fn get_model_preference(app: &tauri::AppHandle) -> Result<String, String> {
    let vault_path = get_vault_path(app);
    tokio::task::spawn_blocking(move || {
        vault_read(vault_path, MODEL_PREFERENCE_KEY, Some("free-first".to_string()), None)
    })
    .await
    .map_err(|e| format!("STORAGE_ERROR: vault task panicked: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_providers() {
        assert!(validate_provider("claude").is_ok());
        assert!(validate_provider("openrouter").is_ok());
    }

    #[test]
    fn rejects_unknown_provider() {
        let err = validate_provider("groq").unwrap_err();
        assert!(err.starts_with("VALIDATION_ERROR:"));
    }

    #[test]
    fn accepts_valid_model_preferences() {
        assert!(validate_model_preference("free-first").is_ok());
        assert!(validate_model_preference("google/gemini-2.0-flash-exp:free").is_ok());
        assert!(validate_model_preference("meta-llama/llama-3.3-70b-instruct:free").is_ok());
    }

    #[test]
    fn rejects_empty_model_preference() {
        let err = validate_model_preference("").unwrap_err();
        assert!(err.starts_with("VALIDATION_ERROR:"));
    }

    #[test]
    fn rejects_model_preference_with_invalid_chars() {
        let err = validate_model_preference("model; DROP TABLE users;").unwrap_err();
        assert!(err.starts_with("VALIDATION_ERROR:"));
    }

    #[test]
    fn rejects_model_preference_over_128_chars() {
        let long = "a".repeat(129);
        let err = validate_model_preference(&long).unwrap_err();
        assert!(err.starts_with("VALIDATION_ERROR:"));
    }

    #[test]
    fn hash_vault_password_is_cached() {
        let first = hash_vault_password();
        let second = hash_vault_password();
        assert_eq!(first, second);
        assert_eq!(first.len(), 32);
    }
}
