# Story 2.1: Build Code Import — Happy Path

Status: deferred

> **DEFERRED POST-MVP** — See `lebo/docs/build-code-format.md` for full research findings.
>
> **Reason:** No pasteable build code format exists for Last Epoch. lastepochtools.com uses server-side URL hashes (not decodable client strings). Offline save files use numeric node IDs with no published mapping to our community string IDs. The Epic 2 HARD GATE contingency applies.
>
> **Path forward:** Story 2.3 (manual build creator) is the primary onboarding path for MVP. Build import can be revisited Post-MVP if: (a) a numeric→slug node ID mapping becomes available for save file parsing, or (b) lastepochtools.com provides a documented API for build export.

## Story

As an advanced Last Epoch player,
I want to paste my build code from lastepochtools.com and immediately see my full skill tree rendered,
So that I can skip manual node-by-node entry and jump straight to analyzing my actual in-game character state.

## Acceptance Criteria

1. **Given** the user has a valid Last Epoch build code string
   **When** the user pastes the build code into the `BuildImportInput` field (paste event — no submit button required)
   **Then** parsing begins immediately
   **And** a progressive counter is displayed: "Resolving nodes: 0/N..."
   **And** within ≤ 3 seconds (NFR3), the full passive skill tree renders with all recognized nodes in their allocated state
   **And** the build's class and mastery are auto-detected and set on `useBuildStore.activeBuild`

2. **Given** the app is in focus and the user has a build code in their clipboard
   **When** the app window receives focus
   **Then** a banner offer appears: "Build code detected in clipboard. Import?" with "Import" and "Dismiss" buttons
   **And** clicking "Import" triggers the same parse and render flow as manual paste

3. **Given** the build code is from the current game version with no unknown nodes
   **When** parsing completes
   **Then** all nodes resolve successfully with no error or warning state
   **And** the build is named from the class/mastery (e.g., "Forge Guard") — editable by the user after import

## Tasks / Subtasks

> All tasks deferred. See status note above.

## Dev Notes

- **HARD GATE RESULT:** Research documented in `lebo/docs/build-code-format.md`. No build code format found. Contingency (b) activated.
- **Revisit prerequisites:**
  - Numeric-to-slug node ID mapping table (community or game asset extraction)
  - OR lastepochtools.com public API documentation
- If/when prerequisites are met: implement `buildParser.ts` as a versioned adapter `{ formatVersion: string, parse: (code: string) => ParseResult }` so format versions can be swapped without touching callers
- `nodeResolver.ts` resolves node IDs against `useGameDataStore.gameData`
- `BuildImportInput.tsx` monitors paste events and clipboard (Tauri clipboard plugin or browser Clipboard API)

## Change Log

| Date | Change |
|------|--------|
| 2026-04-23 | Story created. Immediately deferred after HARD GATE research — no build code format exists. See `lebo/docs/build-code-format.md`. |
