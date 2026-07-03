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
    let files = ["base-items.json", "uniques.json", "affixes.json", "set-items.json"];
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
    let set_items_raw = std::fs::read_to_string(data_dir.join("set-items.json"))
        .map_err(|e| format!("ITEM_DATA_ERROR: read set-items.json: {}", e))?;

    let base_items = serde_json::from_str(&base_items_raw)
        .map_err(|e| format!("ITEM_DATA_ERROR: parse base-items.json: {}", e))?;
    let unique_items = serde_json::from_str(&unique_items_raw)
        .map_err(|e| format!("ITEM_DATA_ERROR: parse uniques.json: {}", e))?;
    let affixes = serde_json::from_str(&affixes_raw)
        .map_err(|e| format!("ITEM_DATA_ERROR: parse affixes.json: {}", e))?;
    let set_items = serde_json::from_str(&set_items_raw)
        .map_err(|e| format!("ITEM_DATA_ERROR: parse set-items.json: {}", e))?;

    Ok(ItemDatabase { base_items, unique_items, affixes, set_items })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn items_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("items")
    }

    /// Story 4.1.5 (AC1, AC2) — the shipped item DB, loaded through the REAL production loader,
    /// carries item level + base-implicit / unique-affix display text end-to-end (the fields the
    /// Rust structs previously dropped serde-side). Value+element assertions over real sampled items:
    /// a golden count would not catch a mis-parsed level or an empty text string — the exact failure
    /// mode this gate closes. [SOURCE-AUDIT + VERIFICATION GUARDRAIL]
    #[test]
    fn shipped_item_db_carries_level_and_display_text() {
        let db = load_item_database_from_dir(&items_dir()).expect("load shipped item database");

        // AC1 — item level survives loader -> struct. Jewelled Circlet -> 7 (spike-verified).
        let circlet = db
            .base_items
            .iter()
            .find(|b| b.id == "jewelled-circlet")
            .expect("jewelled-circlet present in base-items.json");
        assert_eq!(circlet.level_requirement, 7, "Jewelled Circlet level requirement");
        // level 0 is a real value (Refuge Helmet), not a missing field; Iron Casque is a third value.
        let refuge = db
            .base_items
            .iter()
            .find(|b| b.id == "refuge-helmet")
            .expect("refuge-helmet present");
        assert_eq!(refuge.level_requirement, 0, "Refuge Helmet level requirement");
        let iron = db
            .base_items
            .iter()
            .find(|b| b.id == "iron-casque")
            .expect("iron-casque present");
        assert_eq!(iron.level_requirement, 10, "Iron Casque level requirement");

        // AC2 — base implicit display text reaches the loader (previously dropped). Assert the VALUE:
        // a known token from the real implicit lines, not a count.
        assert!(
            circlet
                .implicits
                .iter()
                .any(|im| im.text.contains("Mana") || im.text.contains("Spell Damage")),
            "Jewelled Circlet implicits must carry real display text (got: {:?})",
            circlet.implicits.iter().map(|im| &im.text).collect::<Vec<_>>()
        );

        // AC2 — unique affix display text reaches the loader (RawUniqueItemAffix.text no longer dropped).
        let calamity = db
            .unique_items
            .iter()
            .find(|u| u.id == "calamity")
            .expect("calamity present in uniques.json");
        assert!(
            calamity
                .affixes
                .iter()
                .any(|a| a.text.as_deref().map_or(false, |t| t.contains("increased Fire Damage"))),
            "Calamity must carry a real unique affix text line (got: {:?})",
            calamity.affixes.iter().map(|a| a.text.as_deref()).collect::<Vec<_>>()
        );
    }

    /// AC1 regression floor — levelRequirement is the REAL sourced value across the shipped corpus,
    /// not a blanket serde default. A future transform/serde regression that drops it fails here too.
    #[test]
    fn shipped_item_db_level_requirement_is_populated() {
        let db = load_item_database_from_dir(&items_dir()).expect("load shipped item database");
        let total = db.base_items.len() + db.unique_items.len();
        assert!(total > 1000, "sanity: full corpus loaded (got {total} items)");
        // Many items carry a non-zero level -> proves it's sourced from req.level, not defaulted to 0.
        let nonzero = db.base_items.iter().filter(|b| b.level_requirement > 0).count()
            + db.unique_items.iter().filter(|u| u.level_requirement > 0).count();
        assert!(nonzero > 100, "expected many items with a non-zero level (got {nonzero})");
    }
}
