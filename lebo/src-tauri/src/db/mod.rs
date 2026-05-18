use rusqlite::Connection;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("STORAGE_ERROR: cannot get app data dir: {e}"))?;
    Ok(data_dir.join("lebo.db"))
}

pub fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = get_db_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("STORAGE_ERROR: create db dir: {e}"))?;
    }
    let conn = Connection::open(&path)
        .map_err(|e| format!("STORAGE_ERROR: open db: {e}"))?;
    apply_migrations(&conn)?;
    Ok(conn)
}

fn apply_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS builds (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class_id TEXT NOT NULL,
            mastery_id TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("STORAGE_ERROR: migration: {e}"))
}
