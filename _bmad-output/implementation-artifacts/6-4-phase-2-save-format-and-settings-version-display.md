# Story 6.4: Phase 2 Save Format and Settings Version Display

Status: done

## Story

As a theory-crafter,
I want all new builds I create and save in Phase 2 to use the v2 schema, and I want to see my current game data and item database versions in the settings panel,
so that I know my data is current and my builds are saved in the latest format.

## Acceptance Criteria

**AC1 — New builds serialize with `schemaVersion: 2`:**
Given a player creates a new build in Phase 2 or modifies an existing one,
when `useBuildStore.saveBuild()` is called,
then the build serializes with `schemaVersion: 2` and gear stored as `GearItemV2[]`; the Rust command writes the JSON to SQLite (FR52).

**AC2 — v2 build passes through `migrateBuildState` unchanged:**
Given a Phase 2 build (schemaVersion: 2) is loaded from SQLite,
when `migrateBuildState` runs on it,
then the build passes through unchanged (idempotency; FR54). *(This is already implemented in story 6-1 — verify it still holds, no new code needed.)*

**AC3 — Settings panel shows game data and item database versions:**
Given the player opens the settings panel,
when the panel renders,
then it shows:
- "Game Data: {gameVersion} (last updated {generatedAt date})" as a read-only text label
- "Item Database: {itemDataVersion}" as a read-only text label
(FR55); both labels show "—" as a fallback when the manifest hasn't loaded yet.

## Tasks / Subtasks

- [x] Task 1: Fix `createBuild` in `buildStore.ts` to initialize with `schemaVersion: 2` (AC1)
  - [x] 1.1: In `lebo/src/shared/stores/buildStore.ts`, in the `createBuild` action, change:
    ```typescript
    schemaVersion: 1,
    ```
    to:
    ```typescript
    schemaVersion: 2,
    sliderPosition: 50,
    fineTuneWeights: null,
    ```
  - [x] 1.2: In `applyNodeChange`'s auto-create block (the fallback that creates a new build when `activeBuild` is null), apply the same change: `schemaVersion: 2`, add `sliderPosition: 50`, `fineTuneWeights: null`

- [x] Task 2: Update Settings panel to display version info (AC3)
  - [x] 2.1: In `lebo/src/features/settings/Settings.tsx`, import `useGameDataStore` from `../../shared/stores/gameDataStore`
  - [x] 2.2: In the component body, read:
    ```typescript
    const dataVersion = useGameDataStore((s) => s.dataVersion)
    const dataUpdatedAt = useGameDataStore((s) => s.dataUpdatedAt)
    const itemDataVersion = useGameDataStore((s) => s.gameData?.manifest.itemDataVersion ?? null)
    ```
  - [x] 2.3: In the "Data Sources" section of the JSX, add two read-only labels below the existing icon source line:
    - "Game Data: {dataVersion} (last updated {formatted date})" — format `dataUpdatedAt` as a short date string (e.g. `new Date(dataUpdatedAt).toLocaleDateString()`); show "—" when `dataVersion` is null
    - "Item Database: {itemDataVersion}" — show "—" when `itemDataVersion` is null
    - Use `data-testid="game-data-version"` and `data-testid="item-data-version"` on these elements

- [x] Task 3: Tests (AC1, AC3)
  - [x] 3.1: In `lebo/src/shared/stores/buildStore.test.ts`, add a test under `buildStore`:
    - `createBuild initializes with schemaVersion 2`: set `selectedClassId` and `selectedMasteryId`, call `createBuild('VoidKnight')`, assert `activeBuild.schemaVersion === 2`, `activeBuild.sliderPosition === 50`, `activeBuild.fineTuneWeights === null`
  - [x] 3.2: In `lebo/src/features/build-manager/buildPersistence.test.ts`, add a test under `saveBuild`:
    - `saves a v2 build with schemaVersion 2 in invoke args`: call `saveBuild` with a v2 build object (`schemaVersion: 2`), assert `mockInvoke` was called with `schemaVersion: 2` in the args
  - [x] 3.3: In `lebo/src/features/settings/Settings.test.tsx`, add tests:
    - `shows game data version when store has data`: set `useGameDataStore` state with `dataVersion: '1.4.4'` and `dataUpdatedAt: '2026-04-22T00:00:00Z'`, render `<Settings />`, assert `data-testid="game-data-version"` contains "1.4.4"
    - `shows item data version when manifest has itemDataVersion`: set `useGameDataStore` state with `gameData: { manifest: { ..., itemDataVersion: '1.0.0' }, classes: {} }`, render, assert `data-testid="item-data-version"` contains "1.0.0"
    - `shows em-dash when versions not yet loaded`: render with default (null) store state, assert both version labels show "—"

## Dev Notes

### CRITICAL: `schemaVersion: 1` appears in two places in `buildStore.ts`

Both must be changed to `schemaVersion: 2`. Missing either one means certain code paths still create v1 builds:

1. **`createBuild` action** — the normal path when a user picks a mastery and gets a new build.
2. **`applyNodeChange` auto-create block** — the fallback path at line ~134 that creates an implicit build when `activeBuild` is null but class/mastery are selected. This path is a safety net but still needs v2 schema.

Since `BuildState` defines `sliderPosition?: number` and `fineTuneWeights?: FineTuneWeights | null` as optional, omitting them from the new build object is technically valid TypeScript. However, adding them explicitly (`sliderPosition: 50, fineTuneWeights: null`) makes the v2 defaults consistent with `migrateBuildState`'s own defaults and prevents the v2 passthrough from applying defaults on first load.

### `saveBuild` needs no changes

`buildPersistence.ts:saveBuild()` already passes `schemaVersion: build.schemaVersion` to the Rust command. Once `createBuild` starts producing v2 builds, `saveBuild` will automatically write `schemaVersion: 2` to SQLite — no changes needed in that file.

### Settings panel: version data is already in the store

`useGameDataStore.dataVersion` and `useGameDataStore.dataUpdatedAt` are populated by `loadAllClasses()` in `gameDataLoader.ts` (which calls `setDataVersion(manifest.gameVersion)` and `setDataUpdatedAt(manifest.generatedAt)`).

`itemDataVersion` is NOT a separate store field — it lives on `gameData.manifest.itemDataVersion` (optional field added in story 6-3). Access it as:
```typescript
useGameDataStore((s) => s.gameData?.manifest.itemDataVersion ?? null)
```

Do NOT add a new field to `gameDataStore.ts` for `itemDataVersion` — it's already accessible via `gameData.manifest`.

### Date formatting in Settings

`dataUpdatedAt` is an ISO 8601 string (e.g. `"2026-04-22T00:00:00Z"`). Use `new Date(dataUpdatedAt).toLocaleDateString()` for a short locale-appropriate display. Guard against null:
```tsx
{dataVersion
  ? `${dataVersion} (last updated ${new Date(dataUpdatedAt ?? '').toLocaleDateString()})`
  : '—'}
```

If `dataUpdatedAt` is null, `new Date('')` is an Invalid Date — use a fallback: `dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleDateString() : ''`.

### `BuildState` TypeScript type — `schemaVersion: 1 | 2`

The type already allows both values. Changing `createBuild` to emit `2` requires no type changes.

### Test setup for `Settings.test.tsx` with `useGameDataStore`

Follow the same pattern as `useAppStore` in the existing test: capture initial state in a `const initialGameDataState = useGameDataStore.getState()` outside the describe, then `useGameDataStore.setState(initialGameDataState, true)` in `beforeEach`. Setting specific values is then `useGameDataStore.setState({ dataVersion: '1.4.4', ... })`.

The existing `vi.mock('@tauri-apps/api/core', ...)` at the top of `Settings.test.tsx` already covers the `ProviderSelector` sub-component's IPC calls. No additional mocking needed for `useGameDataStore` — it's a plain Zustand store, not an IPC call.

### No Rust changes

This story makes no Rust changes. The Rust `save_build` command already stores whatever JSON it receives; `schemaVersion` is just a field inside the `data` TEXT column. No `lib.rs` changes needed.

### Previous Story Learnings (from 6-3)

- **Optional fields in manifest**: `itemDataVersion` is `?: string` in `GameDataManifest`. It may be `undefined` when the manifest is an older cached version that predates story 6-3. Always use `?? null` or `?? '—'` when reading it.
- **No barrel files**: Do NOT create `index.ts` in any feature folder. Import directly.
- **TypeScript strict mode**: Every unused import is a compile error. Only import what's used.
- **Test co-location**: Tests sit next to their source file. Do not create new test directories.

### Project Structure Notes

Files to modify (all existing — no new files):

| File | Change |
|------|--------|
| `lebo/src/shared/stores/buildStore.ts` | Change `schemaVersion: 1` to `schemaVersion: 2` + add `sliderPosition`/`fineTuneWeights` defaults in two places |
| `lebo/src/features/settings/Settings.tsx` | Add `useGameDataStore` reads; add two version labels to "Data Sources" section |
| `lebo/src/shared/stores/buildStore.test.ts` | Add `createBuild initializes with schemaVersion 2` test |
| `lebo/src/features/build-manager/buildPersistence.test.ts` | Add `saveBuild saves v2 build with schemaVersion 2` test |
| `lebo/src/features/settings/Settings.test.tsx` | Add three version display tests |

No new files. No Rust changes. No `lib.rs` changes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4] — ACs, user story, FR52, FR54, FR55
- [Source: lebo/src/shared/stores/buildStore.ts:70-95] — `createBuild` action with `schemaVersion: 1` to fix
- [Source: lebo/src/shared/stores/buildStore.ts:130-152] — `applyNodeChange` auto-create block with `schemaVersion: 1` to fix
- [Source: lebo/src/features/build-manager/buildPersistence.ts:122-158] — `saveBuild` (already correct — no changes needed)
- [Source: lebo/src/features/build-manager/buildPersistence.ts:30-120] — `migrateBuildState` (idempotency already implemented)
- [Source: lebo/src/features/settings/Settings.tsx:1-99] — Settings component to extend with version labels
- [Source: lebo/src/shared/stores/gameDataStore.ts:1-66] — `dataVersion`, `dataUpdatedAt`, `gameData` fields already present
- [Source: lebo/src/shared/types/gameData.ts:28-37] — `GameDataManifest` with `itemDataVersion?: string` already present
- [Source: lebo/src/features/game-data/gameDataLoader.ts:49-56] — `loadAllClasses` sets `dataVersion` and `dataUpdatedAt`
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — no barrel files, strict TypeScript, four stores only

### Review Findings

- [x] [Review][Patch] Malformed label when `dataVersion` is set but `dataUpdatedAt` is null — renders "(last updated )" with empty parenthetical [`lebo/src/features/settings/Settings.tsx`]
- [x] [Review][Patch] `new Date(dataUpdatedAt).toLocaleDateString()` renders "Invalid Date" string for malformed date input — no validation before use [`lebo/src/features/settings/Settings.tsx`]
- [x] [Review][Patch] `buildPersistence.test.ts` v2 test only asserts `schemaVersion: 2` in invoke args — `sliderPosition` and `fineTuneWeights` not asserted in payload [`lebo/src/features/build-manager/buildPersistence.test.ts`]
- [x] [Review][Patch] Version label format assertions too weak — tests only assert `.toContain(version)`, full label structure and date portion never verified [`lebo/src/features/settings/Settings.test.tsx`]
- [x] [Review][Patch] `applyNodeChange` auto-create path produces `schemaVersion: 2` but has zero test coverage [`lebo/src/shared/stores/buildStore.test.ts`]
- [x] [Review][Patch] AC2 unverified — no test confirms `migrateBuildState` passes a v2 build through unchanged [`lebo/src/features/build-manager/buildPersistence.test.ts`]
- [x] [Review][Patch] No test for `gameData` loaded with manifest missing `itemDataVersion` — fallback "—" for absent-but-not-null field is untested [`lebo/src/features/settings/Settings.test.tsx`]
- [x] [Review][Defer] Two duplicate `createBuild` paths can drift independently — pre-existing architectural concern [`lebo/src/shared/stores/buildStore.ts:74,134`] — deferred, pre-existing
- [x] [Review][Defer] `initialGameDataState` captured at module evaluation time — could be contaminated by prior test files in same Vitest worker [`lebo/src/features/settings/Settings.test.tsx`] — deferred, pre-existing
- [x] [Review][Defer] Undo stack rehydrates v1-era build snapshots lacking `sliderPosition`/`fineTuneWeights` — optional fields in `BuildState` type [`lebo/src/shared/stores/buildStore.ts`] — deferred, pre-existing
- [x] [Review][Defer] `migrateBuildState` treats undefined `schemaVersion` as v1 — a corrupt v2 build with missing version field would lose its `sliderPosition` via v1 migration [`lebo/src/features/build-manager/buildPersistence.ts`] — deferred, pre-existing
- [x] [Review][Defer] Early-return guard in `createBuild` prevents re-creating a fresh v2 build for the same class/mastery — pre-existing behavior, now more observable with new defaults [`lebo/src/shared/stores/buildStore.ts:73`] — deferred, pre-existing
- [x] [Review][Defer] Auto-create path `sliderPosition: 50` silently committed with no undo path to "no build" — pre-existing undo design [`lebo/src/shared/stores/buildStore.ts:136`] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Changed `schemaVersion: 1` to `schemaVersion: 2` with `sliderPosition: 50` and `fineTuneWeights: null` in both places in `buildStore.ts`: `createBuild` action (line ~76) and `applyNodeChange` auto-create fallback (line ~134). Updated existing test that asserted `schemaVersion: 1` to assert `2`.
- Task 2: Added `useGameDataStore` import and three store selectors to `Settings.tsx`. Added two read-only labels in the "Data Sources" section with `data-testid` attributes and null guards.
- Task 3: Added 5 new tests across 3 files. All pass. Pre-existing failure (`renders the ProviderSelector`) in `Settings.test.tsx` is unrelated — `ProviderSelector` component lacks `data-testid="provider-selector"` and was failing before this story.

### File List

- `lebo/src/shared/stores/buildStore.ts`
- `lebo/src/features/settings/Settings.tsx`
- `lebo/src/shared/stores/buildStore.test.ts`
- `lebo/src/features/build-manager/buildPersistence.test.ts`
- `lebo/src/features/settings/Settings.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-4-phase-2-save-format-and-settings-version-display.md`
