---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-04-18'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/project-intent.md'
workflowType: 'architecture'
project_name: 'LEBOv2'
user_name: 'Alec'
date: '2026-04-18'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 42 FRs across 7 categories
- Build Management (FR1–7): Create, import, save, load, rename, delete builds
- Skill Tree Visualization (FR8–13): Full-fidelity interactive tree, pan/zoom, node states, tooltips
- Optimization Engine (FR14–19): Goal selector, AI trigger, ranked suggestions, composite scoring, context inclusion, data-gap handling
- Suggestion Presentation (FR20–26): Ranked list, exact node changes, before/after deltas, plain-language explanations, visual preview, accept/dismiss, re-run
- Context Panel (FR27–29): Gear/skill/idol input with searchable structured forms and game-data auto-fill
- Game Data Management (FR31–36): Load all 5 classes + 15 masteries, update check on launch, manual update, version display, staleness warning
- Application & System (FR37–42): API key config, connectivity status, offline access, AI disabled offline, auto-update notification, in-app install

**Non-Functional Requirements (architecturally significant):**
- NFR1: SkillTreeCanvas ≥60fps on Intel i5 + integrated graphics — mandates Canvas/WebGL, not DOM
- NFR2: Cold-start ≤5s — impacts app bootstrapping and data load sequencing
- NFR3: Build import ≤3s — import parser must be fast; parsing on main thread is not acceptable
- NFR4: AI results ≤30s — Claude API 45s hard timeout (NFR12)
- NFR6: UI input latency ≤100ms during AI call — non-blocking IPC architecture required
- NFR7: API key in OS-native keychain — requires platform-native credential store integration
- NFR8: HTTPS only for all external calls
- NFR9: No user data to third parties beyond Claude API (build state only)
- NFR10: No remote code execution
- NFR11–14: Full error handling for all external service failures with retry paths

**Scale & Complexity:**
- Primary domain: Desktop application (Tauri/Electron + React + Canvas/WebGL)
- Complexity level: High
- Estimated architectural components: 9 major layers

### Technical Constraints & Dependencies

- **Desktop shell**: Tauri preferred (Rust-based, better performance, smaller binary) vs Electron fallback (Node.js, more ecosystem compatibility)
- **Rendering library**: Must sustain 60fps for trees with hundreds of nodes — Canvas 2D or WebGL only; DOM-based (SVG, HTML) excluded
- **External dependencies**: Claude API (Anthropic) — requires network, has rate limits, timeouts; Community Last Epoch game data — versioned, can go stale
- **Platform targets**: Windows 10/11 (primary, .msi/.exe), macOS 12+ (secondary, .dmg)
- **No server infrastructure in MVP** — desktop app calls Claude API directly

### Cross-Cutting Concerns Identified

1. **Async / non-blocking architecture** — all external calls (AI, data fetch) must run off the renderer thread; UI must remain responsive at all times (NFR6)
2. **Offline state machine** — four-level connectivity: online/full, offline/cached-data, offline/no-data, online/stale-data — each produces different UI states
3. **Data versioning** — game data patch version must be tracked and propagated to: import parser (node ID resolution), scoring engine (node effect values), AI prompt (context accuracy), staleness warning (UI)
4. **Secure API key lifecycle** — key flows: user inputs in settings → stored in OS keychain → retrieved by desktop shell main process → injected into Claude API request header → never exposed to renderer JS
5. **Error surface standardization** — Claude failure, data staleness, import parse failure, and update failure all need a consistent error-type → user message → retry action pattern

---

## Starter Template Evaluation

### Primary Technology Domain

Desktop application — Tauri 2.x + React + TypeScript, based on project requirements and stated preferences.

### Starter Options Considered

| Option | Source | Includes | Verdict |
|--------|--------|----------|---------|
| `create-tauri-app` React-TS | Official Tauri | Tauri 2.x, React 19, Vite 6, TypeScript | **Selected** |
| dannysmith/tauri-template | Community | Above + tauri-specta, typed bridge | Useful reference, not base |
| kitlib/tauri-app-template | Community | Above + shadcn/ui | Conflicts with Headless UI choice |
| MrLightful/create-tauri-react | Community | Above + shadcn/ui + Tailwind | shadcn/ui conflicts |

Community templates include shadcn/ui which conflicts with the UX spec's choice of Headless UI + custom Tailwind tokens. The official template is minimal and gives us full control over the design system layer.

### Selected Starter: `create-tauri-app` (React TypeScript)

**Rationale:** Official, minimal, current. Gives Tauri 2.10.3 + React 19 + Vite 6 foundation without opinionated UI libraries that conflict with our design system.

**Initialization Command:**

```bash
pnpm create tauri-app@latest lebo --template react-ts
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript 5.x — strict mode enabled
- React 19 — concurrent features available
- Node.js frontend, Rust backend (Tauri 2.10.3)

**Build Tooling:**
- Vite 6 — frontend bundler and dev server
- Cargo — Rust build tool for backend
- `tauri build` — cross-platform binary bundler

**Code Organization:**
- `src/` — React frontend
- `src-tauri/` — Rust backend (Tauri shell, commands, services)

**Development Experience:**
- Vite HMR for frontend hot reload
- `tauri dev` for full-stack dev mode (frontend + native shell)
- TypeScript strict config

**Additional Stack Added On Top (not from starter):**

| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | v4 | Utility-first styling with custom design tokens |
| @headlessui/react | latest | Accessible unstyled UI primitives (RadioGroup, Dialog, Disclosure, etc.) |
| PixiJS | v8 | WebGL renderer for SkillTreeCanvas (60fps hard requirement) |
| @pixi/react | v8 | React bindings for PixiJS |
| Zustand | v5 | Lightweight state management |
| tauri-plugin-sql | v2 | SQLite for local build storage |
| tauri-plugin-stronghold | v2 | Encrypted credential storage (API key) |
| tauri-plugin-http | v2 | HTTP client for Rust-side API calls |
| tauri-plugin-updater | v2 | In-app auto-updater |
| tauri-plugin-store | v2 | Key-value persistence for app preferences |
| Vitest | latest | Unit and integration testing |
| react-hot-toast | latest | Toast notifications |

**Note:** Tree renderer spike (PixiJS vs Konva.js) must be the **first implementation story** — validate ≥60fps on target hardware before any other work. PixiJS (WebGL) selected over Konva.js (Canvas 2D) due to WebGL's GPU-accelerated rendering advantage at high object counts.

**Spike scope requirement:** Before writing mock data for the spike, audit the game data source (Story 1.3) to determine the actual maximum passive tree node count for any single class/mastery. The mock must match real-world complexity: nodes + connection edges + multi-tier prerequisite overlays + simultaneous highlight states. Do not use bare circles on a blank canvas — the spike must represent actual rendering load. Document real node counts in `docs/pixi-spike-report.md` alongside FPS results. If real counts exceed what was spiked, re-spike before proceeding.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Desktop shell: Tauri 2.x (confirmed — performance + security model fits all NFRs)
2. Tree renderer: PixiJS v8 / WebGL (confirmed — 60fps hard constraint eliminates Canvas 2D options)
3. API key security: `tauri-plugin-stronghold` — encrypted storage, never in renderer process
4. IPC model: All external network calls from Rust backend only (API key never exposed to frontend JS)
5. State management: Zustand v5 with domain-separated stores

**Important Decisions (Shape Architecture):**
6. Build storage: SQLite via `tauri-plugin-sql` (structured queries needed for list/rename/delete)
7. Game data format: Versioned JSON files in app data directory, manifest.json tracks version
8. Scoring engine location: Frontend TypeScript (pure functions, game data from store)
9. Claude API streaming: Tauri event system (`optimization:suggestion-received` events)
10. No client-side router: View switching via Zustand `appStore.currentView` flag

**Deferred to Post-MVP:**
- Web version architecture (different security model, no Tauri)
- Multi-character roster storage schema
- Build sharing/export URL format

---

### Data Architecture

**Build Storage — SQLite via `tauri-plugin-sql`**
- Decision: SQLite, not flat JSON
- Rationale: FR1–7 require list, rename, delete, and load by ID — structured queries are cleaner than directory scanning. SQLite is bundled in Tauri; no additional runtime dependency.
- Schema version field on all tables for future migrations
- Stored in Tauri's app data directory (`AppData/Roaming/lebo/` on Windows)

**Two query patterns for build commands (performance requirement):**

| Command | SQL | Purpose |
|---------|-----|---------|
| `load_builds_list` | `SELECT id, name, class_id, mastery_id, created_at, updated_at FROM builds ORDER BY updated_at DESC` | Sidebar list — omits `data` column |
| `load_build` | `SELECT * FROM builds WHERE id = ?` | Load specific build for editing |

The `data` column is NOT fetched for list operations. `load_builds_list` returns only display metadata; the full `BuildState` is loaded only when the user selects a specific build to open.

**Game Data — Versioned JSON in App Data Directory**
- Decision: Bundled JSON snapshot + remote update check on launch
- Rationale: Offline-first requirement (FR39) — game data must be available without network. Updates fetched via Tauri HTTP plugin from community source.
- Format: `game-data/` directory containing `manifest.json` (versions) + per-class JSON files
- Staleness threshold: if `manifest.gameVersion` ≠ latest remote version → show warning (FR35)

**Scoring Engine — Frontend TypeScript**
- Decision: Pure TypeScript functions in `src/features/optimization/scoringEngine.ts`
- Rationale: Scoring is game-mechanics modeling that evolves with patches. Frontend location allows faster iteration without Rust recompilation. Game data already in frontend store.
- Inputs: `BuildState` + `GameData` (from stores) → outputs: `BuildScore { damage: number, survivability: number, speed: number }`
- Values: 0–100 scale; `null` when node data is missing (FR19 compliance)
- **Delta ownership (Path B — deterministic):** `scoringEngine.ts` is authoritative for ALL score values — baseline display AND per-suggestion deltas. Claude returns node change specs only; the app runs `scoringEngine` twice (baseline, post-change) to compute the delta for each suggestion. This is a hard prerequisite: `scoringEngine.ts` must be complete and tested before Claude API integration (Story 3.2) can be implemented.

---

### Security Architecture

**API Key Lifecycle**
```
User inputs API key in Settings UI
    → Frontend sends via Tauri command: set_api_key(key)
    → Rust: tauri-plugin-stronghold stores encrypted in Stronghold vault
       (Stronghold = IOTA's encrypted credential vault, AES-256, stored as a file in app data dir.
        Not Windows Credential Manager or macOS Keychain — cross-platform consistency chosen over
        OS-native trust chain. OS keychain integration is a post-MVP enhancement if users request it.)
    → On Claude API call: Rust retrieves key from Stronghold vault
    → Rust injects key into HTTP Authorization header
    → Response returned to frontend via command result
    → API key NEVER touches frontend JavaScript at any point
```

**Network Security**
- All outbound HTTP calls originate from Rust (`src-tauri/src/services/`)
- `tauri-plugin-http` with allowlist — only Claude API and game data URLs permitted
- Tauri CSP configured to block all frontend network access

**No Remote Code Execution**
- Tauri's capability system restricts frontend privileges to minimum required
- No `eval()`, no dynamic script loading, no remote JS execution (NFR10)

---

### IPC & Communication Architecture

**Tauri Command Pattern (IPC Boundary)**

All frontend↔backend communication via `invoke()`:

```typescript
// Frontend: src/shared/utils/invokeCommand.ts
async function invokeCommand<T>(command: string, args?: unknown): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    throw normalizeAppError(error)  // maps Rust error to AppError
  }
}
```

All Rust commands return `Result<T, AppError>`:
```rust
// src-tauri/src/commands/claude_commands.rs
#[tauri::command]
async fn invoke_claude_api(build_state: BuildState, goal: OptimizationGoal) 
  -> Result<(), AppError>  // streams via events, returns on completion
```

**Claude API Streaming Pattern**
- Rust service connects to Claude API with streaming enabled
- As each suggestion token arrives, Rust emits Tauri event: `optimization:suggestion-received`
- Frontend listens: `await listen('optimization:suggestion-received', handler)`
- Frontend `optimizationStore` accumulates partial suggestions in real-time
- On completion: Rust emits `optimization:complete` or `optimization:error`

**Streaming Parse Strategy — NDJSON Contract**

The Claude prompt spec (`docs/claude-prompt-spec.md`, created in Story 3.2 research task) MUST constrain Claude's output to one complete JSON object per line (NDJSON). This eliminates partial-JSON parsing complexity:

```
{"rank":1,"from_node_id":"node_123","to_node_id":"node_456","points_change":2,"explanation":"..."}
{"rank":2,"from_node_id":"node_789","to_node_id":"node_234","points_change":1,"explanation":"..."}
```
Note: Path B — Claude returns node change specs only. No delta fields. `scoringEngine.ts` computes all deltas app-side.

`claude_service.rs` streaming implementation:
- Buffer incoming stream bytes
- On each `\n`: attempt JSON parse on the buffered line
- On success: emit `optimization:suggestion-received`; clear buffer
- On failure: continue buffering (mid-object newline in explanation text)
- On stream close: if buffer non-empty, attempt final parse; emit `optimization:error` if malformed

The NDJSON constraint must be enforced in the system prompt and verified during prompt testing before Story 3.2 is marked complete.

**Event Namespace Contract**

| Event | Payload | Direction |
|-------|---------|-----------|
| `optimization:suggestion-received` | `{ rank: number, partial: PartialSuggestion }` | Rust → Frontend |
| `optimization:complete` | `{ suggestionCount: number }` | Rust → Frontend |
| `optimization:error` | `{ error: AppError }` | Rust → Frontend |
| `game-data:update-available` | `{ latestVersion: string }` | Rust → Frontend |
| `app:connectivity-changed` | `{ isOnline: boolean }` | Rust → Frontend |

---

### Frontend Architecture

**State Management — Zustand v5**

Four domain stores, no cross-store mutations:

| Store | Owns | Key State |
|-------|------|-----------|
| `useBuildStore` | Active build lifecycle | `activeBuild`, `savedBuilds`, `isImporting` |
| `useGameDataStore` | Game data + versioning | `gameData`, `dataVersion`, `isStalent`, `isLoading` |
| `useOptimizationStore` | AI results + goal | `goal`, `suggestions`, `isOptimizing`, `scores` |
| `useAppStore` | Global flags | `isOnline` (default: `false` — set to `true` only after first confirmed-online ping; never assume online at init), `currentView`, `activePanel` |

Store actions are the only mutation mechanism — no direct state writes from components.

**No Router — View Switching via `appStore.currentView`**
- Decision: No React Router (TanStack or otherwise)
- Rationale: This is a single-canvas desktop app. "Navigation" is panel state, not URL routing. A router adds bundle weight and routing concepts that don't map to the UX model.
- `currentView: 'main' | 'settings'` — only two top-level views

**PixiJS Integration**
- `SkillTreeCanvas` is a React component that mounts a PixiJS Application instance
- All node rendering, panning, zooming, hover, and click handling are managed inside the PixiJS canvas
- PixiJS canvas receives tree data and highlight state as props; fires callbacks for node interactions
- Zustand stores are NOT accessed inside PixiJS render loop — only via React props boundary to avoid coupling

---

### Infrastructure & Deployment

**Build & Distribution**
- Tauri bundler outputs: `.msi` + NSIS installer (Windows), `.dmg` + `.app` (macOS)
- Code signing: Windows Authenticode (required for SmartScreen bypass), macOS Developer ID + notarization (required for Gatekeeper)
- Distribution: GitHub Releases (direct download, no app store)

**Auto-Updater**
- `tauri-plugin-updater` checks for updates on launch (FR41)
- Update manifest hosted on GitHub Releases
- Silent background download, user-triggered install (FR42)
- No forced updates

**CI/CD**
- GitHub Actions: `tauri-apps/tauri-action` builds Windows + macOS binaries in parallel
- Triggers: Git tag push (`v*`) → builds + publishes GitHub Release

**Testing**
- Unit: Vitest for pure functions (scoring engine, build parser, node resolver)
- Integration: Vitest + mock Tauri commands for store/component tests
- E2E: Playwright + `tauri-driver` for full app flow (import → optimize → apply)
- Performance: Manual FPS monitoring during SkillTreeCanvas spike story

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Files and Directories**
- React components: `PascalCase.tsx` — `SkillTreeCanvas.tsx`, `SuggestionCard.tsx`
- Feature folders: `kebab-case/` — `skill-tree/`, `build-manager/`, `optimization/`
- Utility/service files: `camelCase.ts` — `buildParser.ts`, `invokeCommand.ts`, `scoringEngine.ts`
- Rust command files: `snake_case_commands.rs` — `build_commands.rs`, `claude_commands.rs`
- Store files: `[domain]Store.ts` — `buildStore.ts`, `optimizationStore.ts`
- Test files: co-located with source, `*.test.ts` — `buildParser.test.ts`

**Code Naming**
- React components: PascalCase — `SuggestionCard`, `ScoreGauge`, `NodeTooltip`
- Zustand stores (hook export): camelCase with `use` prefix — `useBuildStore`, `useGameDataStore`
- Zustand store actions: camelCase verb — `setBuildName`, `applyNodeChange`, `clearSuggestions`, `setOptimizationGoal`
- TypeScript types/interfaces: PascalCase, no `I` prefix — `BuildState`, `NodeChange`, `SuggestionResult`, `AppError`
- Tauri commands (Rust): `snake_case` — `save_build`, `invoke_claude_api`, `get_api_key`
- Tauri commands (TS invoke string): match Rust name — `invoke('save_build', {...})`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_OPTIMIZATION_TIMEOUT_MS`, `SCORE_SCALE_MAX`
- Tauri event names: `feature:action` kebab pattern — `optimization:suggestion-received`, `game-data:update-available`

**Anti-patterns (forbidden):**
- ❌ `INodeData`, `TBuildState` — no Hungarian notation prefixes on types
- ❌ `utils.ts` at root — utilities must live in feature or `shared/utils/[name].ts`
- ❌ `index.ts` barrel files — import directly from source file (avoids circular dep confusion for AI agents)
- ❌ `data`, `info`, `manager` as generic component/store suffixes — be specific (`buildStorage`, not `dataManager`)

---

### Structure Patterns

**Feature Folder Layout**
Every feature in `src/features/[feature-name]/` follows:
```
[feature-name]/
  [ComponentName].tsx     # One component per file
  use[Feature].ts         # Feature-specific hooks (optional)
  [feature]Service.ts     # Non-store logic (optional)
  types.ts                # Feature-local types (if not shared)
```

**Shared vs Feature**
- A type/component used by >1 feature → moves to `src/shared/`
- A type used by only 1 feature → stays in `src/features/[feature]/types.ts`
- Stores always in `src/shared/stores/` (all features read from them)

**Rust Source Layout**
- All Tauri command handlers → `src-tauri/src/commands/`
- Business logic, external HTTP calls → `src-tauri/src/services/`
- Serializable data models (shared with frontend via `serde`) → `src-tauri/src/models/`
- No business logic in `main.rs` or `lib.rs` — only app setup and command registration

---

### Format Patterns

**AppError — Universal Error Type**

All errors (Rust→ frontend and frontend-generated) conform to:
```typescript
interface AppError {
  type: ErrorType
  message: string   // user-facing
  detail?: string   // technical detail for logging
}

type ErrorType =
  | 'API_ERROR'       // Claude API non-2xx
  | 'NETWORK_ERROR'   // No connectivity
  | 'TIMEOUT'         // Request exceeded limit
  | 'PARSE_ERROR'     // Build code parse failure
  | 'DATA_STALE'      // Game data behind current version
  | 'STORAGE_ERROR'   // SQLite read/write failure
  | 'AUTH_ERROR'      // Missing or invalid API key
  | 'UNKNOWN'         // Catch-all
```

**BuildState Schema (versioned)**
```typescript
interface BuildState {
  schemaVersion: 1          // increment on breaking changes
  id: string                // uuid v4
  name: string
  classId: string           // e.g. 'sentinel'
  masteryId: string         // e.g. 'forge_guard'
  nodeAllocations: Record<string, number>  // nodeId → points allocated
  contextData: {
    gear: GearItem[]        // populated in Epic 4; empty array [] by default
    skills: ActiveSkill[]   // populated in Epic 4; empty array [] by default
    idols: IdolItem[]       // populated in Epic 4; empty array [] by default
  }
  isPersisted: boolean      // true only after first explicit user save (controls auto-save gate)
  createdAt: string         // ISO 8601
  updatedAt: string         // ISO 8601
}
```

**Scoring Values**
- Scale: 0–100 (integers)
- `null` = cannot compute (missing node data — FR19 compliance)
- Delta display: `+N` / `-N` with sign always shown; never show bare `N`

**Game Data Manifest**
```json
{
  "gameVersion": "1.2.3",
  "dataVersion": "2026-04-15",
  "generatedAt": "2026-04-15T10:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"]
}
```

**Date/Time**
- All timestamps: ISO 8601 strings (`2026-04-18T10:00:00Z`) — never Unix timestamps in stored data
- Display formatting done at render time, never stored

---

### State Management Patterns

**Store Ownership (no cross-store mutations)**
```
useBuildStore      → owns: activeBuild, savedBuilds list, import state
useGameDataStore   → owns: all game node/class data, version, staleness
useOptimizationStore → owns: goal, suggestions, scores, optimization loading
useAppStore        → owns: isOnline, currentView, panel collapse states
```

**Loading State Pattern**
Every async operation in a store has a dedicated boolean flag:
```typescript
// ✅ correct
isImporting: boolean
isOptimizing: boolean
isGameDataLoading: boolean

// ❌ wrong — generic loading states cause race conditions
isLoading: boolean
```

**Suggestion Accumulation (streaming)**
```typescript
// optimizationStore
suggestions: SuggestionResult[]    // finalized suggestions
streamingBuffer: PartialSuggestion | null  // in-flight partial

// on 'optimization:suggestion-received' event:
// → update streamingBuffer until rank boundary, then push to suggestions
```

---

### Process Patterns

**IPC Call Pattern (all Tauri commands)**
```typescript
// src/shared/utils/invokeCommand.ts — ALL Tauri calls use this
async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args ?? {})
  } catch (err) {
    throw normalizeAppError(err)
  }
}
```
- No raw `invoke()` calls outside of this wrapper
- Errors always normalize to `AppError` before reaching components

**Offline Guard Pattern**
```typescript
// Before any AI-dependent operation:
const { isOnline } = useAppStore()
if (!isOnline) {
  // show inline message per FR40 — never throw
  return
}
```

**Error Display Rules**
- API errors → inline in the relevant panel (right panel for optimization, import area for parse errors)
- Storage errors → toast (non-blocking, dismissible)
- Critical errors (no game data at all, app crash boundary) → full-panel error state with retry

**Retry Pattern**
Retryable error types: `API_ERROR`, `NETWORK_ERROR`, `TIMEOUT`
Non-retryable: `PARSE_ERROR`, `AUTH_ERROR`, `UNKNOWN`
UI: "Retry" button only shown for retryable types

**Destructive Action Confirmation**
- "Delete Build" → confirmation dialog required (irreversible)
- "Apply suggestion" → no confirmation (reversible within session via `buildStore.undoNodeChange()`)
- Session undo stack: max 10 tree state snapshots

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
lebo/
├── .github/
│   └── workflows/
│       └── release.yml                 # tauri-apps/tauri-action builds Win + macOS
├── src/                                # React frontend
│   ├── main.tsx                        # Vite entry, mounts <App />
│   ├── App.tsx                         # Root: view router (main | settings)
│   ├── features/
│   │   ├── skill-tree/                 # FR8–13
│   │   │   ├── SkillTreeCanvas.tsx     # PixiJS app mount, props-only (no store access)
│   │   │   ├── NodeTooltip.tsx         # Hover tooltip overlay (portal)
│   │   │   ├── useSkillTree.ts         # Tree interaction state hook
│   │   │   ├── pixiRenderer.ts         # PixiJS rendering logic (pure PixiJS, no React)
│   │   │   ├── pixiRenderer.test.ts
│   │   │   └── types.ts
│   │   ├── build-manager/              # FR1–7
│   │   │   ├── BuildImportInput.tsx
│   │   │   ├── SavedBuildsList.tsx
│   │   │   ├── buildParser.ts          # Import code → BuildState + resolution report
│   │   │   ├── buildParser.test.ts
│   │   │   ├── nodeResolver.ts         # Node ID → GameData node lookup
│   │   │   ├── nodeResolver.test.ts
│   │   │   └── types.ts
│   │   ├── optimization/               # FR14–26
│   │   │   ├── GoalSelector.tsx
│   │   │   ├── OptimizeButton.tsx
│   │   │   ├── SuggestionCard.tsx
│   │   │   ├── SuggestionList.tsx      # Virtual-scrolled list of SuggestionCards
│   │   │   ├── ScoreGauge.tsx
│   │   │   ├── scoringEngine.ts        # Pure TS: BuildState + GameData → BuildScore
│   │   │   ├── scoringEngine.test.ts
│   │   │   └── types.ts
│   │   ├── context-panel/              # FR27–29
│   │   │   ├── ContextPanel.tsx
│   │   │   ├── GearInput.tsx
│   │   │   ├── SkillInput.tsx
│   │   │   ├── IdolInput.tsx
│   │   │   └── types.ts
│   │   ├── game-data/                  # FR31–36
│   │   │   ├── DataStalenessBar.tsx
│   │   │   ├── gameDataLoader.ts       # Invokes Tauri commands, populates store
│   │   │   └── types.ts
│   │   └── settings/                   # FR37
│   │       ├── Settings.tsx
│   │       └── ApiKeyInput.tsx
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── StatusBar.tsx           # FR38, FR40 — connectivity + API status
│   │   │   ├── Toast.tsx               # react-hot-toast wrapper
│   │   │   └── PanelCollapseToggle.tsx
│   │   ├── stores/
│   │   │   ├── buildStore.ts           # useBuildStore
│   │   │   ├── gameDataStore.ts        # useGameDataStore
│   │   │   ├── optimizationStore.ts    # useOptimizationStore
│   │   │   └── appStore.ts             # useAppStore
│   │   ├── hooks/
│   │   │   ├── useConnectivity.ts      # Listens to app:connectivity-changed event
│   │   │   └── useOptimizationStream.ts # Listens to optimization:* events
│   │   ├── types/
│   │   │   ├── build.ts                # BuildState, NodeChange
│   │   │   ├── gameData.ts             # GameNode, ClassData, GameDataManifest
│   │   │   ├── optimization.ts         # SuggestionResult, BuildScore, OptimizationGoal
│   │   │   └── errors.ts               # AppError, ErrorType
│   │   └── utils/
│   │       ├── invokeCommand.ts        # Typed Tauri invoke wrapper (ALL IPC goes here)
│   │       └── errorNormalizer.ts      # Rust error string → AppError
│   └── assets/
│       ├── fonts/
│       │   ├── Inter-Variable.woff2
│       │   └── JetBrainsMono-Variable.woff2
│       └── images/
│           └── class-art/              # Low-opacity class art for empty tree state
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json                 # Capability system, updater config, app metadata
│   ├── capabilities/
│   │   └── default.json                # Tauri v2 permission grants
│   └── src/
│       ├── main.rs                     # Entry point, app setup only
│       ├── lib.rs                      # Command registration, plugin setup
│       ├── commands/                   # Tauri command handlers (IPC boundary)
│       │   ├── build_commands.rs       # save_build, load_builds, delete_build, rename_build
│       │   ├── game_data_commands.rs   # load_game_data, check_data_version, update_game_data
│       │   ├── claude_commands.rs      # invoke_claude_api (streaming via events)
│       │   └── app_commands.rs         # get_api_key, set_api_key, check_connectivity
│       ├── services/                   # Business logic + external HTTP
│       │   ├── claude_service.rs       # Claude API client (streaming HTTP)
│       │   ├── game_data_service.rs    # Fetch + cache game data JSON
│       │   └── keychain_service.rs     # stronghold read/write for API key
│       ├── models/                     # Rust structs (serde Serialize/Deserialize)
│       │   ├── build.rs                # SavedBuild, BuildStatePayload
│       │   ├── game_data.rs            # GameNode, ClassData, DataManifest
│       │   ├── optimization.rs         # OptimizationRequest, SuggestionEvent
│       │   └── errors.rs               # AppError enum (maps to TS ErrorType)
│       └── db/
│           └── migrations/
│               └── 001_initial.sql     # builds table, schema
├── tests/
│   ├── unit/                           # Vitest — pure function tests
│   └── e2e/                            # Playwright + tauri-driver
│       └── core-loop.spec.ts           # Import → Optimize → Apply happy path
├── package.json
├── vite.config.ts
├── tailwind.config.ts                  # Design tokens (from UX spec)
└── tsconfig.json
```

---

### Architectural Boundaries

**IPC Boundary (Tauri Commands — the ONLY crossing point)**

```
Frontend (TypeScript / React)          Backend (Rust / Tauri)
─────────────────────────────          ──────────────────────
invokeCommand('save_build', data)  →   save_build() command handler
                                   ←   Result<SavedBuild, AppError>

invokeCommand('invoke_claude_api') →   invoke_claude_api() starts stream
optimization:suggestion-received   ←   events emitted per suggestion
optimization:complete              ←   final event
```

**Rules enforced at this boundary:**
- Frontend NEVER calls `fetch()` to external URLs
- API key NEVER crosses from backend to frontend
- All Rust→Frontend data must be `serde::Serialize`
- All Frontend→Rust data must be `serde::Deserialize`

**Component Boundaries**

`SkillTreeCanvas` is deliberately isolated:
- Receives all data via props (`treeData`, `highlightedNodes`, `allocatedNodes`)
- Fires callbacks for interactions (`onNodeClick`, `onNodeHover`)
- No store access inside — prevents PixiJS render loop from triggering React re-renders
- Stores feed it via a thin wrapper component

**Data Boundaries**

| Data | Owner | Access Pattern |
|------|-------|---------------|
| Build saves | SQLite via Rust | CRUD via Tauri commands only |
| Game data files | App data dir via Rust | Read via Tauri command on startup; cached in `useGameDataStore` |
| API key | Stronghold encrypted vault via `tauri-plugin-stronghold` (AES-256 file in app data dir, not OS keychain) | Write/read via `app_commands.rs` only |
| Active build state | `useBuildStore` | Read/write from frontend only |
| AI suggestions | `useOptimizationStore` | Populated via event stream from Rust |

---

### Requirements to Structure Mapping

| FR Category | Feature Folder | Rust Commands |
|------------|---------------|---------------|
| Build Management (FR1–7) | `features/build-manager/` | `build_commands.rs` |
| Skill Tree Visualization (FR8–13) | `features/skill-tree/` | — (pure frontend) |
| Optimization Engine (FR14–19) | `features/optimization/` | `claude_commands.rs` |
| Suggestion Presentation (FR20–26) | `features/optimization/` | (streaming events) |
| Context Panel (FR27–29) | `features/context-panel/` | — (pure frontend) |
| Game Data Management (FR31–36) | `features/game-data/` | `game_data_commands.rs` |
| Application & System (FR37–42) | `features/settings/`, `shared/` | `app_commands.rs` |

**Cross-Cutting Concerns Locations**

| Concern | Location |
|---------|---------|
| Offline detection | `shared/hooks/useConnectivity.ts` + `useAppStore.isOnline` |
| Error normalization | `shared/utils/errorNormalizer.ts` |
| All IPC calls | `shared/utils/invokeCommand.ts` |
| Global connectivity status | `shared/components/StatusBar.tsx` |
| Session undo stack | `useBuildStore.undoStack` |

---

### Data Flow

**Happy Path: Import → Optimize → Apply**

```
1. User pastes build code
   → BuildImportInput → buildParser.ts (TypeScript)
   → nodeResolver.ts checks against useGameDataStore
   → useBuildStore.setActiveBuild(parsedBuild)
   → SkillTreeCanvas re-renders via props

2. User clicks Optimize
   → invokeCommand('invoke_claude_api', { build, goal, context })
   → Rust: claude_service.rs calls Claude API with streaming
   → Rust emits 'optimization:suggestion-received' events
   → useOptimizationStream.ts populates useOptimizationStore.suggestions
   → SuggestionList renders incrementally as suggestions arrive

3. User clicks Apply on suggestion
   → useBuildStore.applyNodeChange(change)
   → SkillTreeCanvas re-renders with new allocation
   → scoringEngine.ts recalculates BuildScore
   → useOptimizationStore.updateScores(newScore)
   → invokeCommand('save_build', updatedBuild)  [auto-save]
```

**Game Data Bootstrap (on app launch)**

```
App starts → gameDataLoader.ts
→ invokeCommand('load_game_data')
→ Rust: reads local JSON files from app data dir
→ useGameDataStore.setGameData(data)
→ invokeCommand('check_data_version')
→ Rust: fetches remote manifest (if online)
→ if stale: useGameDataStore.setStale(true) → DataStalenessBar shows
```

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices form a proven, compatible stack. Tauri 2.10.3 officially supports React + Vite + TypeScript. PixiJS v8 and @pixi/react v8 are version-matched. Tailwind CSS v4 and Headless UI are framework-agnostic and fully compatible. Zustand v5 is React 19-compatible. All `tauri-plugin-*` libraries are Tauri v2-compatible official plugins.

**Pattern Consistency:**
- Naming conventions are non-overlapping and unambiguous across TypeScript and Rust (PascalCase components / camelCase utilities / snake_case Rust)
- `invokeCommand()` wrapper enforces a single IPC entry point — no agent can diverge from this
- Store ownership is explicitly defined per domain — no overlap or ambiguity
- AppError type is the single error representation across the entire system

**Structure Alignment:**
Project structure derives directly from FR categories. Every feature folder maps to a specific FR set. Rust command files mirror frontend feature folders. Shared utilities consolidate cross-cutting concerns at a predictable location. The structure will guide AI agents to the right location without ambiguity.

---

### Requirements Coverage Validation ✅

**Functional Requirements Coverage — All 42 FRs addressed:**

| FR Range | Category | Architectural Support |
|----------|----------|-----------------------|
| FR1–7 | Build Management | `features/build-manager/` + `build_commands.rs` + SQLite |
| FR8–13 | Skill Tree Visualization | `features/skill-tree/` + PixiJS v8 |
| FR14–19 | Optimization Engine | `features/optimization/` + `claude_commands.rs` + streaming |
| FR20–26 | Suggestion Presentation | `features/optimization/` + `useOptimizationStore` + event stream |
| FR27–29 | Context Panel | `features/context-panel/` (read from `useGameDataStore` for autocomplete) |
| FR31–36 | Game Data Management | `features/game-data/` + `game_data_commands.rs` + manifest versioning |
| FR37–42 | Application & System | `features/settings/` + `app_commands.rs` + `useAppStore` + Tauri updater |

**Non-Functional Requirements Coverage — All 17 NFRs addressed:**

| NFR | Requirement | Architectural Solution |
|-----|------------|----------------------|
| NFR1 | ≥60fps tree rendering | PixiJS v8 WebGL — GPU-accelerated, confirmed 60fps at large node counts |
| NFR2 | ≤5s cold start | Vite bundle, async game data load (non-blocking), Tauri fast startup |
| NFR3 | ≤3s build import | TypeScript parser in frontend — no Rust roundtrip for parsing |
| NFR4 | ≤30s AI results | Streaming response + 45s hard timeout in `claude_service.rs` |
| NFR5 | ≤10s initial data load | Async `load_game_data` command, reads pre-cached local JSON |
| NFR6 | ≤100ms UI during AI | AI call runs in Rust async task — renderer thread fully free |
| NFR7 | Encrypted credential store for API key | `tauri-plugin-stronghold` — Stronghold vault (AES-256), never in renderer or config file. Note: not OS-native keychain; see Security Architecture section for tradeoff rationale. |
| NFR8 | HTTPS only | `tauri-plugin-http` allowlist; CSP blocks frontend network access |
| NFR9 | No user data to third parties | Only build state to Claude API; enforced by Rust-side HTTP client |
| NFR10 | No remote code execution | Tauri CSP + capability system; no eval, no dynamic script |
| NFR11 | API failures surfaced to user | `AppError` type system + inline error display in right panel |
| NFR12 | 45s API timeout | Configured in `claude_service.rs` timeout; `TIMEOUT` error type surfaced |
| NFR13 | Data failure doesn't block launch | App bootstrap: game data load is async, non-fatal if fails |
| NFR14 | Functional offline | Offline gate in `useAppStore.isOnline`; tree + saves work without network |
| NFR15 | Keyboard accessible | Headless UI (all primitives) + SkillTreeCanvas keyboard nav in `useSkillTree.ts` |
| NFR16 | Readable at 100% scale | Typography system defined in UX spec + Tailwind token system |
| NFR17 | Node state not color-only | PixiJS renderer uses shape + fill pattern + color for all 4 node states |

---

### Implementation Readiness Validation ✅

**Decision Completeness:**
All 10 critical and important decisions are documented with specific libraries and versions. No decision requires "TBD" resolution before a first story can be written. The tree renderer spike is called out as Story 1 explicitly.

**Structure Completeness:**
Every file and directory in the project tree is named specifically (no `[component].tsx` placeholders). Every file has a comment explaining its purpose. FR category → directory mapping is explicit and complete.

**Pattern Completeness:**
- 4 naming domains covered (files, components, stores, Rust)
- 4 anti-patterns explicitly forbidden to prevent AI divergence
- Complete `AppError` type definition prevents ad-hoc error types
- Loading state pattern prevents generic `isLoading` anti-pattern
- `invokeCommand()` wrapper prevents raw `invoke()` usage

---

### Gap Analysis Results

**Important Gaps (acknowledged, not blocking implementation):**

1. **Build code import format** — The architecture defines `buildParser.ts` but the exact format of Last Epoch build code strings (from lastepochtools.com) is not specified. The first implementation story for `buildParser.ts` must include a research sub-task: audit the community build code format before implementing. The parser should be written against a documented format spec, not reverse-engineered during implementation.

2. **Claude API prompt contract** — `claude_commands.rs` will call the Claude API, but the prompt structure (system prompt, context format, expected response schema) is not specified in this architecture. This is intentional — prompt engineering is iterative and belongs in a separate prompt design artifact. However, **a structured JSON response format for suggestions must be established before `claude_commands.rs` is implemented**, since `optimizationStore` parses the streamed response. Recommendation: create a `docs/claude-prompt-spec.md` as the first output of the optimization feature spike.

3. **Scoring algorithm** — `scoringEngine.ts` is defined as "pure TypeScript, BuildState + GameData → BuildScore" but the scoring formula is not specified. The scoring model is domain-specific (Last Epoch game mechanics) and requires community research. This must be spiked and documented in `docs/scoring-model.md` before the optimization feature is implemented. The architecture provides the interface; the scoring research provides the implementation.

4. **Game data source URL and format** — `game_data_service.rs` fetches game data, but the exact source URL (lastepochtools.com API, a community GitHub repo, a maintained dataset) is not specified. This requires a pre-implementation research task to identify the most reliable, terms-of-service-compliant data source.

5. **SQLite schema detail** — `001_initial.sql` is planned but the builds table schema is not fully specified. Recommendation: specify at minimum: `id TEXT PRIMARY KEY, name TEXT NOT NULL, class_id TEXT NOT NULL, mastery_id TEXT NOT NULL, schema_version INTEGER, data TEXT NOT NULL, created_at TEXT, updated_at TEXT`. `class_id` and `mastery_id` MUST be top-level columns (not buried in the `data` JSON) because `load_builds_list` selects them directly for the sidebar display without loading the full `data` blob.

**None of these gaps block the first 3–4 implementation stories** (scaffold, tree renderer spike, game data loading, build import). They become blocking when implementation reaches the optimization feature.

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (PRD, UX spec, project-intent.md)
- [x] Scale and complexity assessed — High complexity, 9 architectural layers
- [x] Technical constraints identified (60fps, OS keychain, Tauri sandbox)
- [x] Cross-cutting concerns mapped (async, offline, versioning, error surface, security)

**✅ Architectural Decisions**
- [x] Critical decisions documented with library versions
- [x] Technology stack fully specified (Tauri 2.10.3, React 19, PixiJS v8, Zustand v5)
- [x] Integration patterns defined (IPC boundary, streaming, event system)
- [x] Performance considerations addressed (WebGL, async IPC, non-blocking renderer)

**✅ Implementation Patterns**
- [x] Naming conventions established (files, code, Rust, events)
- [x] Anti-patterns explicitly forbidden
- [x] Structure patterns defined (feature folders, shared/, Rust layout)
- [x] Communication patterns specified (IPC wrapper, event namespace, store ownership)
- [x] Process patterns documented (error handling, retry, offline guard, undo)

**✅ Project Structure**
- [x] Complete directory structure defined with specific file names
- [x] Component boundaries established (SkillTreeCanvas props-only isolation)
- [x] Integration points mapped (IPC boundary diagram, data boundaries table)
- [x] Requirements to structure mapping complete (FR category → feature folder table)
- [x] Data flow documented (happy path + bootstrap sequence)

---

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High**

Key strengths:
- Tauri's security model solves the API key problem elegantly — no server needed, no key exposure
- PixiJS WebGL selection gives substantial performance headroom over the 60fps NFR on integrated graphics
- Feature-folder structure with explicit FR mapping means AI agents will always know where new code belongs
- `invokeCommand()` wrapper + AppError type system create a single, enforceable contract for all IPC and error handling
- Streaming Claude API integration is architecturally supported — reduces the perceived wait time that the UX spec identifies as the highest-anxiety moment

Areas for future enhancement:
- Scoring model algorithm (requires domain research, does not block MVP start)
- Claude prompt engineering artifact (iterative, separate from architecture)
- E2E test coverage expansion (Playwright + tauri-driver setup is defined; test cases are not)
- Performance monitoring tooling (FPS dashboard for SkillTreeCanvas development)

---

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented — do not introduce alternative libraries without updating this document
- Use `invokeCommand()` for ALL Tauri calls — no raw `invoke()` anywhere
- All errors must conform to `AppError` type before reaching any component
- No store cross-mutations — each store owns its domain exclusively
- `SkillTreeCanvas` receives props only — no store access inside PixiJS context
- No `index.ts` barrel files anywhere in `src/`
- Refer to this document for all architectural questions before making assumptions

**Implementation Story Order:**
1. **Project scaffold** — `pnpm create tauri-app@latest lebo --template react-ts` + add Tailwind v4 + Headless UI + Zustand
2. **SkillTreeCanvas spike** — PixiJS v8 rendering with mock tree data, validate ≥60fps on target hardware **(GATE: must pass before other stories)**
3. **Game data pipeline** — `game_data_commands.rs` + `gameDataLoader.ts` + `useGameDataStore` + staleness detection
4. **Build import** — `buildParser.ts` + `nodeResolver.ts` + `BuildImportInput` + `useBuildStore` (requires: game data format known)
5. **Build persistence** — SQLite schema + `build_commands.rs` + save/load/rename/delete
6. **Scoring engine spike** — `scoringEngine.ts` research + implementation (requires: game data loaded, scoring model documented)
7. **Claude API integration** — `claude_service.rs` streaming + `claude_commands.rs` + prompt design + `useOptimizationStream.ts`
8. **Suggestion presentation** — `SuggestionCard` + `SuggestionList` + `ScoreGauge` + tree highlight integration
9. **Context panel** — `ContextPanel` + `GearInput` + `SkillInput` + `IdolInput`
10. **Settings + security** — `ApiKeyInput` + `app_commands.rs` + `tauri-plugin-stronghold` integration
11. **App infrastructure** — `StatusBar` + offline detection + auto-updater + error boundaries
12. **Polish + accessibility** — keyboard nav, WCAG AA audit, axe-core CI integration
