use tauri::AppHandle;
use crate::db;
use crate::models::build::BuildMeta;

#[tauri::command]
pub async fn save_build(
    app_handle: AppHandle,
    id: String,
    name: String,
    class_id: String,
    mastery_id: String,
    schema_version: i64,
    data: String,
    created_at: String,
    updated_at: String,
) -> Result<(), String> {
    let conn = db::open_connection(&app_handle)?;
    conn.execute(
        "INSERT INTO builds (id, name, class_id, mastery_id, schema_version, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           class_id = excluded.class_id,
           mastery_id = excluded.mastery_id,
           schema_version = excluded.schema_version,
           data = excluded.data,
           updated_at = excluded.updated_at",
        rusqlite::params![id, name, class_id, mastery_id, schema_version, data, created_at, updated_at],
    )
    .map_err(|e| format!("STORAGE_ERROR: save_build: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn load_builds_list(app_handle: AppHandle) -> Result<Vec<BuildMeta>, String> {
    let conn = db::open_connection(&app_handle)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, class_id, mastery_id, created_at, updated_at
             FROM builds
             ORDER BY updated_at DESC",
        )
        .map_err(|e| format!("STORAGE_ERROR: load_builds_list prepare: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(BuildMeta {
                id: row.get(0)?,
                name: row.get(1)?,
                class_id: row.get(2)?,
                mastery_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("STORAGE_ERROR: load_builds_list query: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("STORAGE_ERROR: load_builds_list collect: {e}"))
}

#[tauri::command]
pub async fn load_build(app_handle: AppHandle, id: String) -> Result<String, String> {
    let conn = db::open_connection(&app_handle)?;
    conn.query_row(
        "SELECT data FROM builds WHERE id = ?1",
        [&id],
        |row| row.get(0),
    )
    .map_err(|e| format!("STORAGE_ERROR: load_build: {e}"))
}

#[tauri::command]
pub async fn delete_build(app_handle: AppHandle, id: String) -> Result<(), String> {
    let conn = db::open_connection(&app_handle)?;
    conn.execute("DELETE FROM builds WHERE id = ?1", [&id])
        .map_err(|e| format!("STORAGE_ERROR: delete_build: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn rename_build(
    app_handle: AppHandle,
    id: String,
    new_name: String,
) -> Result<(), String> {
    let conn = db::open_connection(&app_handle)?;
    conn.execute(
        "UPDATE builds SET name = ?1 WHERE id = ?2",
        rusqlite::params![new_name, id],
    )
    .map_err(|e| format!("STORAGE_ERROR: rename_build: {e}"))?;
    Ok(())
}
