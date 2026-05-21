/// Read-only game reference data loaded once at startup.
/// Holds resolved stat tables, tree graphs, affix value tables, class definitions.
/// Populated in Story 2.4 (Tauri IPC wiring) from disk JSON files.
#[derive(Debug, Clone, Default)]
pub struct GameData {
    // Story 2.4 adds: passive tree graph, affix value tables, class node data, etc.
}
