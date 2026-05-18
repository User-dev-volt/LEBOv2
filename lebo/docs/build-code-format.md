# Build Code Format — Research Findings

**Date:** 2026-04-23  
**Author:** Dev Agent (claude-sonnet-4-6)  
**Status:** HARD GATE — no pasteable build code format exists; Story 2.1 deferred Post-MVP

---

## Summary

Last Epoch does **not** have a pasteable, self-contained build code string (analogous to Path of Building codes in Path of Exile). Story 2.1's "paste build code" premise does not apply to the current game ecosystem. The HARD GATE contingency from the Epic 2 dev notes is activated.

---

## What Was Researched

### lastepochtools.com Build Planner

- Builds are stored **server-side** and accessed via opaque short IDs (e.g., `lastepochtools.com/planner/kB5dyWvQ`)
- The short hash (`kB5dyWvQ`) is a server-side lookup key, not a decodable client-side string
- No public API or documented format for resolving these IDs to build data
- Sharing = sharing the URL, not copying a portable code

### Maxroll.gg Build Planner

- Also uses server-side stored builds with URL sharing
- No portable build code export feature

### Last Epoch Offline Save Files

- Located at `C:\Users\{User}\AppData\LocalLow\Eleventh Hour Games\Last Epoch\Saves`
- Format: JSON prefixed with `"EPOCH"` bytes that must be stripped before parsing
- Community-documented passive tree structure: `"nodeIDs": [41, 1, 3, 6, ...], "nodePoints": [3, 8, 2, ...]`
- **Critical blocker:** Uses **numeric integer node IDs** (e.g., `41`, `1`, `3`)
- Our game data (tunklab.com community source) uses **string slug IDs** (e.g., `"sentinel-base-gladiator"`)
- **No published mapping** exists between the game's numeric node IDs and our community string IDs
- Implementing save-file import would require a complete numeric→slug mapping table that does not currently exist

### Musholic/LastEpochPlanner (open source)

- A fork of Path of Building adapted for Last Epoch
- Supports "Character import from offline character and LE tools build planner"
- Source code not accessible during research, but this is a standalone desktop app (not web-parseable)
- No documented build code string format

---

## Conclusion

| Source | Shareable Build Code? | Parseable Without Server? | Node ID Mapping Available? |
|--------|----------------------|--------------------------|---------------------------|
| lastepochtools.com | Server-side hash only | No | No |
| maxroll.gg | Server-side hash only | No | No |
| Save file (.le) | N/A (file, not string) | Yes (JSON w/ EPOCH prefix) | **No** — numeric IDs unmapped |

There is no standard, portable "build code" string format for Last Epoch.

---

## Contingency Activation

Per Epic 2 dev notes:

> **Contingency if format is undocumented or proprietary:** (b) implement "manual build entry" (node-by-node allocation via Story 2.3's UI) as the primary onboarding path and treat build code import as Post-MVP.

**Story 2.1 is deferred Post-MVP.**

---

## Path Forward

1. **Story 2.3 (New Build Creator)** — class/mastery selector → blank tree is the primary "start a build" path
2. **Story 2.4 (Persistence)** — save/load builds locally
3. **Post-MVP: Save file import** — requires building a numeric→slug node ID mapping table. This can be created if/when a community tool publishes the mapping, or if we generate it by extracting game assets.
4. **Post-MVP: lastepochtools.com API partnership** — contact maintainers to request documented build export API

---

## If Node ID Mapping Becomes Available

If the community publishes a numeric-to-slug mapping table, save file import becomes feasible. The implementation would be:

1. Strip `"EPOCH"` prefix from save file bytes
2. Parse JSON
3. Extract `nodeIDs[]` + `nodePoints[]` arrays from passive tree section
4. Map each numeric ID to our string slug via the mapping table
5. Create `BuildState.nodeAllocations` from the resolved pairs
6. Detect class/mastery from the save file's class/mastery fields

The `buildParser.ts` / `nodeResolver.ts` architecture from the original story spec remains valid for this future implementation.
