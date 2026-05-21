pub mod commands;
pub mod db;
pub mod models;
pub mod services;

use commands::app_commands::{
    check_api_key_configured, check_connectivity, restart_app, set_api_key,
    set_llm_provider, get_llm_provider,
    set_openrouter_api_key, check_openrouter_configured, validate_openrouter_key,
};
use commands::build_commands::{
    delete_build, load_build, load_builds_list, rename_build, save_build,
};
use commands::claude_commands::invoke_claude_api;
use commands::game_data_commands::{
    check_data_version, download_game_data_update, get_manifest, initialize_game_data,
    load_game_data,
};
use commands::icon_commands::{get_icon_cache_path, initialize_icon_pipeline, IconMapCache};
use commands::context_data_commands::{
    load_idol_data, load_blessings_data, load_conditions_data,
    check_idol_data_freshness, check_blessings_data_freshness, check_conditions_data_freshness,
};
use commands::item_commands::{check_item_data_freshness, load_item_database, update_item_data};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(IconMapCache(std::sync::Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(services::connectivity_service::start_watcher(handle));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(
            // KDF closure is only invoked by the plugin's frontend command layer,
            // which this app does not use — backend vault access goes through
            // keychain_service directly. Delegate to the same function so params
            // stay in one place and can never drift.
            tauri_plugin_stronghold::Builder::new(|_password| {
                services::keychain_service::hash_vault_password()
            })
            .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_manifest,
            load_game_data,
            initialize_game_data,
            check_data_version,
            download_game_data_update,
            save_build,
            load_builds_list,
            load_build,
            delete_build,
            rename_build,
            initialize_icon_pipeline,
            get_icon_cache_path,
            invoke_claude_api,
            set_api_key,
            check_api_key_configured,
            check_connectivity,
            restart_app,
            set_llm_provider,
            get_llm_provider,
            set_openrouter_api_key,
            check_openrouter_configured,
            validate_openrouter_key,
            load_item_database,
            check_item_data_freshness,
            update_item_data,
            load_idol_data,
            load_blessings_data,
            load_conditions_data,
            check_idol_data_freshness,
            check_blessings_data_freshness,
            check_conditions_data_freshness,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
