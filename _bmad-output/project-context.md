---
project_name: 'LEBOv2'
user_name: 'Alec'
date: '2026-05-30'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 85
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in this project. Focused on unobvious details agents might otherwise miss._

---

## Technology Stack & Versions

**Desktop Shell:** Tauri 2.x (tauri-cli ^2, @tauri-apps/api ^2, tauri-plugin-opener 2)
**Frontend:** React 19.1 + TypeScript ~5.8.3 (strict mode) + Vite 7.0.4 + Tailwind CSS v4.2.2
**Canvas Rendering:** PixiJS 8.18.1 + @pixi/react 8.0.5
**State Management:** Zustand 5.0.12 (4 domain stores)
**UI Primitives:** @headlessui/react 2.2.10
**Toasts:** react-hot-toast 2.6.0
**Backend (Rust):** Tauri 2, serde/serde_json 1, rusqlite 0.32 (bundled), reqwest 0.12 (json+stream), tokio 1, argon2 0.5, futures-util 0.3
**Tauri Plugins:** tauri-plugin-sql 2.4.0 (sqlite), tauri-plugin-stronghold 2, tauri-plugin-http 2.5.8, tauri-plugin-updater 2.10.1, tauri-plugin-store 2.4.2, tauri-plugin-opener 2
**Testing:** Vitest 4.1.4 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 + jsdom 29 + vitest-axe 0.1.0
**Build:** TypeScript bundler mode, Vite test config lives in `vite.config.ts` (no separate vitest.config)

---

## Critical Implementation Rules

### Language-Specific Rules

- **TypeScript strict mode is enforced:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`. Every unused import or parameter is a compile error.
- **Module resolution is `bundler`** — use `allowImportingTsExtensions`. No `.js` extensions on imports.
- **No barrel files anywhere in `src/`** — never create `index.ts` re-export files. Import directly from the source file.
- **All errors normalize to `AppError`** before reaching any component. The `AppError` type is `{ type: ErrorType; message: string; detail?: string }`. The `normalizeAppError()` utility in `src/shared/utils/errorNormalizer.ts` is the single normalization point.
- **`ErrorType` enum values must match Rust error string prefixes** — `normalizeAppError` does a case-insensitive substring search. New error types require a matching prefix in Rust (e.g., `"STORAGE_ERROR: ..."`) and an entry in `ERROR_TYPE_MAP`.
- **`BuildState.schemaVersion` is `1 | 2`** — new builds always use `schemaVersion: 2`. The `migrateBuildState` function in `buildPersistence.ts` upgrades v1 persisted builds on load. Never create a new build with `schemaVersion: 1`.
- **Allocation records omit zero-value keys** — `nodeAllocations`, `skillNodeAllocations[slotId]`, and `weaverAllocations` delete keys when the value reaches 0 (they do NOT store `{ nodeId: 0 }`). All reads should use `?? 0` as the default.
- **`GearItem` is deprecated** — all new code uses `GearItemV2` with `AffixEntryV2[]`. Never reference the old `GearItem` interface.
- **`BuildState` has several optional fields** added in Phase 3 — `idolGrid?: IdolGridState`, `blessings?: Record<string, string | null>`, `activeConditions?: string[]`, `conditionValues?: Record<string, string | number | boolean>`, `skillRoles?: Record<string, SkillRole>`, `sliderPosition?: number`, `fineTuneWeights?: FineTuneWeights | null`. Always default with `?? {}` / `?? []` / `?? 50` when reading these.
- **`conditionValues` → `activeConditions` encoding** is handled exclusively by `encodeConditionValues()` in `buildSnapshotSerializer.ts`. Never manually build the `activeConditions` array from `conditionValues`. Encoding rules: `boolean true` → `id`, `string` (non-empty) → `on_${value}`, `number !== 0` → `${id}_${value}`.
- **`toBuildSnapshot()` in `buildSnapshotSerializer.ts` is the ONLY conversion point** from `BuildState` to `BuildSnapshot`. Never pass `BuildState` directly to `invokeCommand('compute_stats', ...)` or `invokeCommand('run_gear_scoring', ...)` — always call `toBuildSnapshot(build, gameData)` first.
- **Rust output types use snake_case field names** — `StatSheet`, `OffenseStats`, `DefenseStats`, `NodeEfficiency`, `GearAnalysis`, `GearSlotRanking`, `WishlistAffix`, `SynergyFlag` all mirror Rust serde output with snake_case keys (e.g. `damage_score`, `effective_hp`, `node_id`). Do NOT camelCase these field accesses.

### Framework-Specific Rules

**IPC (Tauri):**
- **NEVER call raw `invoke()` from `@tauri-apps/api/core`** — always use the `invokeCommand<T>()` wrapper in `src/shared/utils/invokeCommand.ts`. It normalizes errors automatically.
- All Tauri command names are snake_case strings (matching Rust function names). All must be registered in `lib.rs` `invoke_handler!`.
- **Vault (Stronghold) reads must be sequential, not concurrent.** Never `Promise.all()` multiple vault reads — see `App.tsx` startup: vault reads are chained with `.then()`.
- The `ANTHROPIC_API_KEY` environment variable override in `claude_commands.rs` (`#[cfg(debug_assertions)]`) must be removed before any public release build.
- **`compute_stats` returns a `StatSheet` directly** — no events. Always call via `invokeCommand<StatSheet>('compute_stats', { snapshot })`.
- **`run_gear_scoring` returns no value** — result arrives via `gear:analysis-complete` event. Call it fire-and-forget; listen for the event separately.
- **`run_optimization` returns no value** — result arrives via `optimization:*` events.

**React / Zustand:**
- **Four domain stores only:** `useBuildStore`, `useGameDataStore`, `useOptimizationStore`, `useAppStore`. Do not create new top-level stores; extend existing ones.
- **No React Router** — view switching is `appStore.currentView: 'main' | 'settings' | 'gear-optimization'`. Never add a router.
- Zustand stores use `create<Interface>()((set, get) => ...)` pattern with inline function bodies. Do not use `immer` middleware.
- `useBuildStore.undoStack` caps at 10 snapshots (MAX_UNDO_STACK = 10). Undo snapshots the entire `BuildState`, tracking all three allocation namespaces.
- **`SkillTreeCanvas` is props-only** — it receives `treeData`, `nodeAllocations`, `highlightedNodes`, `iconTextures`, and more via props. It does NOT access any Zustand store internally.

**Multi-tree architecture:**
- Three separate allocation namespaces in `BuildState`:
  - `nodeAllocations` — passive tree (`Record<string, number>`)
  - `skillNodeAllocations` — per-skill trees (`Record<slotId, Record<nodeId, number>>`)
  - `weaverAllocations` — weaver tree (`Record<string, number>`)
- Three corresponding store actions: `applyNodeChange`, `applySkillNodeChange`, `applyWeaverNodeChange`. Never mutate allocations directly with `set()`.
- Three reset variants: `resetActiveTree('passive')`, `resetActiveTree('skill', slotId)`, `resetActiveTree('weaver')`.
- **`assignSkillToSlot` auto-clears skill nodes** — when a skill changes on a slot, `skillNodeAllocations[slotId]` is reset to `{}`. Never manually clear it.

**Budget system:**
- All budget math lives in `src/shared/utils/budgetCalculator.ts`. Never inline these formulas:
  - Passive: `level - 2` (0 at levels 1–2), max level 100
  - Skill: `level` (1 point per level, max 20)
  - Weaver: fixed `53` (`WEAVER_TOTAL_POINTS`) — not level-gated
- `selectAvailablePassivePoints` is an exported Zustand selector from `buildStore.ts`. Use it instead of calling `calculatePassivePoints` in components.

**SkillTreeTabBar (7 tabs, indices 0–6):**
- Tab 0 = Passive Tree, Tabs 1–5 = Skill slots (`slot-0` through `slot-4`), Tab 6 = Weaver Tree.
- `safeTabIndex` guards against out-of-range — any index > 6 falls back to 0. Always use `safeTabIndex` for routing tab logic, never raw `activeTabIndex`.
- Skill tab click fires both `onChange` (sets active index) AND `onSkillTabClick` (opens SkillPickerGrid). These are separate concerns — never merge them.

**SkillTreeCanvas props:**
- Accepts `treeLayout?: 'weaver'` — pass this for the weaver tab. Omit for passive/skill trees.
- Accepts `iconTextures: Map<string, Texture>` — always pass a stable module-level `EMPTY_TEXTURES` constant rather than creating `new Map()` inline.
- Exposes `SkillTreeCanvasHandle` ref with `fitToTree()`. Use `useRef<SkillTreeCanvasHandle>`.

**SkillPickerGrid:**
- Opens as **full panel** when the slot has no assigned skill (`!isPopover`).
- Opens as **popover** (fixed position from anchor rect) when the slot already has a skill (`isPopover: true`).
- `filteredSkills` excludes skills assigned to other slots. Always filter before passing to `SkillPickerGrid`.

**PixiJS:**
- The **WebGL null info-log patch** is applied at module load time in `pixiRenderer.ts` (IIFE at top of file). Never re-inject it from tests or via Playwright.
- `SkillTreeCanvas` uses `initChainRef` to serialize PixiJS `Application.init()` calls — prevents React StrictMode double-mount from launching two concurrent WebGL inits.
- All node drawing functions are pure PixiJS `Graphics` calls. Use hex colors from the design token list.
- `reducedMotion` must be respected: `drawSuggested` skips the glow ring when `reducedMotion = true`.

**Icon pipeline:**
- `useIconTextures(skillIds: string[])` returns `Map<string, Texture>`. Call it once in `SkillTreeView` — never in individual canvas draw functions.
- Icon loading is async; the map may be empty on first render. Canvas must gracefully fall back to placeholder rendering when a texture is missing.
- Pass `EMPTY_TEXTURES` (module-level constant) to the Weaver canvas — icons are not used for weaver nodes.

**Tauri Event Streaming (Claude API):**
- Claude API streams via Tauri events — never via a direct return value from `invoke_claude_api`.
- Three optimization event names: `optimization:suggestion-received`, `optimization:complete`, `optimization:error`.
- Five gear event names: `gear:analysis-complete`, `gear:error`, `gear:narrative-chunk`, `gear:narrative-complete`, `gear:narrative-error`.
- The `useOptimizationStream` hook subscribes to optimization events and populates `optimizationStore`.
- The `useGearStream` hook subscribes to gear events. Call it at the top of `GearOptimizationView` (it registers/unregisters on mount/unmount).
- `startGearAnalysis()` is a plain async function (not a hook) in `useGearStream.ts` — call it in event handlers, not at render time.

**Scoring engine / stat sheet:**
- `useStatSheet` hook in `shared/stores/useStatSheet.ts` subscribes to build + game-data changes and calls `compute_stats`. Uses `requestAnimationFrame` debounce + generation counter to discard stale IPC results — never duplicate this pattern inline.
- `optimizationStore.statSheet` holds the current `StatSheet | null`. `isComputingStats` is true while an IPC call is in flight.
- `optimizationStore.nodeEfficiencies: NodeEfficiency[] | null` holds the node efficiency overlay data. `NodeEfficiency.tier` is `'gold' | 'silver' | 'dim'`.
- `optimizationStore.previewStatSheet` replaces `statSheet` in the stat sheet display when a suggestion is being previewed.
- `clearSuggestions()` clears optimization stream state (`suggestions`, `scores`, `nodeEfficiencies`, `previewStatSheet`, etc.) but does **NOT** clear gear state (`gearAnalysis`, `gearNarrative`, `isAnalyzingGear`, `isGeneratingNarrative`).

**Gear Optimization view:**
- `GearOptimizationView` is a full-screen view (`height: 100dvh`), not a center tab. Navigate to it via `setCurrentView('gear-optimization')` and back with `setCurrentView('main')`.
- Gear analysis requires at least one skill designated as `primary_offense` in `BuildState.skillRoles` before `startGearAnalysis()` can be called.
- `SkillRole` type: `'primary_offense' | 'secondary_offense' | 'defensive' | 'utility'`.
- `BuildState.skillRoles` is optional (`Record<string, SkillRole> | undefined`). Default with `?? {}`.

**Idol grid:**
- `IdolGridState = PlacedIdol[]` — stored in `BuildState.idolGrid` (optional, default `[]`).
- `PlacedIdol` has `{ id, row, col, idolTypeId, prefixId?, prefixTier?, suffixId?, suffixTier? }`.
- All idol placement validation goes through `validatePlacement()` in `idol-grid/idolGridUtils.ts`. Never inline placement collision logic.
- Idol grid config (rows, cols, blocked cells) comes from `contextDatabase` (`IdolGrid` type). Grid dimensions and blocked cells vary by game version — never hardcode them.
- `toBuildSnapshot` converts `idolGrid` via `toIdolPlacements()` (internal) — the `idolTypeId` field maps to `idolSize` in the snapshot sent to Rust.

**Blessings and conditions:**
- `BuildState.blessings?: Record<string, string | null>` — keys are blessing slot IDs, values are blessing IDs or `null`. The snapshot serializer extracts non-null values as a flat `string[]`.
- `BuildState.conditionValues?: Record<string, string | number | boolean>` — structured condition state. Never write to `activeConditions` directly; it is a computed field derived by `encodeConditionValues()` in `buildSnapshotSerializer.ts`.

**Tailwind v4:**
- CSS-first config — no `tailwind.config.js`. All custom tokens are CSS variables defined in the global stylesheet.
- **Never use `@apply`** — Tailwind v4 dropped reliable `@apply` support for custom properties.
- Design tokens use `var(--color-*)` CSS variables: `--color-bg-base`, `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-hover`, `--color-accent-gold`, `--color-accent-gold-soft`, `--color-accent-gold-dim`, `--color-data-damage`, `--color-data-surv`, `--color-data-speed`, `--color-node-allocated`, `--color-node-available`, `--color-node-locked`, `--color-node-suggested`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`.
- **Damage type color CSS variables**: `--color-dmg-physical`, `--color-dmg-fire`, `--color-dmg-cold`, `--color-dmg-lightning`, `--color-dmg-void`, `--color-dmg-poison`, `--color-dmg-bleed`.
- **`rarityColors.ts`** provides `RARITY_COLORS` (keyed by rarity name) and `DAMAGE_TYPE_COLORS` (keyed by `DamageType`). Always use these utilities — never hardcode rarity or damage-type hex colors inline.

### Testing Rules

- **Vitest config lives in `vite.config.ts`** under the `test` key (`environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate `vitest.config.ts`.
- **`test-setup.ts` provides four stubs** that must not be duplicated in individual test files:
  1. `@testing-library/jest-dom` matchers
  2. `vitest-axe` `toHaveNoViolations` matcher
  3. `ResizeObserver` no-op stub (required for Headless UI)
  4. `window.matchMedia` no-op stub (required for `useReducedMotion`)
- **Mock Tauri IPC** via `vi.mock('@tauri-apps/api/core', ...)` or `vi.mock('../../shared/utils/invokeCommand', ...)`. Never let tests reach real Tauri IPC.
- **Accessibility tests** use `vitest-axe`: `import { axe } from 'vitest-axe'` then `expect(await axe(container)).toHaveNoViolations()`.
- Test files co-locate with source: `ComponentName.test.tsx` next to `ComponentName.tsx`, `store.test.ts` next to `store.ts`.
- No snapshot tests — use explicit `expect` assertions.
- **PixiJS components are not unit-testable** — `SkillTreeCanvas` and `pixiRenderer.ts` have separate test files that mock PixiJS internals. Do not attempt to render real WebGL in jsdom tests.
- **Budget math tests** go in `budgetCalculator.test.ts` — keep formula verification there, not scattered in component tests.
- **`buildSwitchSync`** has its own test file. Cross-store coordination logic must be tested there, not as side effects of store action tests.

### Code Quality & Style Rules

**Naming conventions (strictly enforced):**
- React components: `PascalCase.tsx`
- Feature folders: `kebab-case/` (e.g., `skill-tree/`, `build-manager/`, `item-database/`, `icon-pipeline/`, `weaver-tree/`)
- Utilities / hooks: `camelCase.ts` (e.g., `invokeCommand.ts`, `budgetCalculator.ts`, `useIconTextures.ts`)
- Stores: `[domain]Store.ts` (e.g., `buildStore.ts`, `gameDataStore.ts`)
- Rust commands: `snake_case` (matching Tauri invoke string)
- Tauri events: `feature:action` (e.g., `optimization:suggestion-received`)

**Comments:**
- Write no comments by default. Only add a comment when the WHY is non-obvious (hidden constraint, workaround, subtle invariant). Never describe what code does — only why it must be done that way.

**Imports:**
- No default exports in any module. Always named exports.
- Group imports: external libs → internal shared → internal feature-local.

**Constants:**
- Stable empty values (`EMPTY_ALLOCATED`, `EMPTY_SET`, `EMPTY_TEXTURES`, `EMPTY_SKILLS`, `EMPTY_HIGHLIGHTED`) must be module-level constants, not created inline in render. This prevents unnecessary PixiJS re-renders from referential inequality.

**SQLite schema** (build storage via tauri-plugin-sql):
```
id TEXT PRIMARY KEY
name TEXT NOT NULL
schema_version INTEGER
data TEXT NOT NULL
created_at TEXT
updated_at TEXT
```
All new `BuildState` objects have `schemaVersion: 2`. The `migrateBuildState` function in `buildPersistence.ts` handles schema upgrades from v1.

**Feature folder structure:**
Each feature folder is self-contained: component, hook, data file, and test co-located. Shared cross-feature types live in `src/shared/types/` only. Do not import from one feature folder into another — route through `src/shared/` instead.

### Development Workflow Rules

- **Desktop-first Tauri** — never introduce Node.js/Electron patterns. All backend logic in Rust, never in a Node sidecar.
- **No server** — the app calls Claude API directly from Rust. No proxy, no backend service.
- **Game data** is versioned JSON files in the Tauri app data dir. `manifest.json` tracks `gameVersion`, `dataVersion`, `generatedAt`, `classes`. Class data files are `classes/{classId}.json`. Item database is a separate data file tracked by its own staleness flags in `gameDataStore`.
- **Two target platforms:** Windows 10/11 (`.msi`) and macOS 12+ (`.dmg`). CI uses `tauri-apps/tauri-action` on git tag push.
- **Pre-release blocker:** Code signing certs required before first public release — Windows Authenticode EV cert + Apple Developer Program ($99/yr).
- **Commands run from `lebo/` (the Vite project root).** Package manager is `pnpm`. Never use `npm` or `yarn`.
- **Phase boundary — CRITICAL:** This is Phase 2 (LEBOv2). Files outside the `LEBOv2/` directory (`../_bmad-output/`, `../lebo/`) are Phase 1 read-only artifacts. Never write, edit, or commit changes to them.
- **When adding a Tauri command:** implement in Rust → register in `lib.rs` `invoke_handler!` → call via `invokeCommand<T>()` in TypeScript.
- **When adding a new view:** add it to `appStore.currentView` union type and route in `App.tsx`. Never add React Router.
- **When adding a new tree type:** requires new allocation field in `BuildState`, new store action (`apply*NodeChange`), new reset variant in `resetActiveTree`, new tab entry in `SkillTreeTabBar`, and migration in `migrateBuildState`.

### Critical Don't-Miss Rules

**Security:**
- **API key NEVER crosses to frontend JS.** The key is stored in Stronghold (AES-256), retrieved by Rust on API call, injected into the HTTP header. Any code that reads an API key in TypeScript is wrong.
- `VAULT_PASSWORD` in `keychain_service.rs` is a static constant (acceptable for MVP; do not replace without a full migration plan).
- `#[cfg(debug_assertions)] let api_key = std::env::var("ANTHROPIC_API_KEY")...` in `claude_commands.rs` — **must be removed before public release.**

**PixiJS / Canvas:**
- This app is canvas-based. `browser_snapshot` (accessibility tree) is useless for visual inspection — always use `browser_take_screenshot`.
- Never call `page.goto()` inside Playwright `browser_run_code` — it orphans the page context and hangs. Navigation must be a separate `browser_navigate` call.
- The WebGL null info-log patch is already in `pixiRenderer.ts` at module load. Never re-inject it.

**Store action rules:**
- `applyNodeChange` / `applySkillNodeChange` / `applyWeaverNodeChange` validate prerequisites and budget before allocating. **Never bypass with direct `set()`.**
- `applyNodeChange` auto-creates a build when `activeBuild` is null (if class and mastery are selected). `applySkillNodeChange` and `applyWeaverNodeChange` do NOT — they return `{ success: false }` if `activeBuild` is null.
- `useOptimizationStore.clearSuggestions()` must be called before starting a new optimization run (handled in `useOptimizationStream` — do not call again). It clears `suggestions`, `scores`, `nodeEfficiencies`, `previewStatSheet`, and stream state but does **NOT** clear gear analysis state (`gearAnalysis`, `gearNarrative`, `isAnalyzingGear`, `isGeneratingNarrative`).
- `useAppStore.isOnlineChecked` starts `false` — AI optimization must check both `isOnline` AND `isOnlineChecked` before enabling.

**Skill/tab rules:**
- Tab index 6 is the Weaver tab — `isWeaverTab = safeTabIndex === 6`. The weaver branch returns early with its own full JSX tree. Any logic before `if (isWeaverTab)` runs for all tabs including weaver — all hooks must be called unconditionally before any early return.
- `weaverTreeData` in `gameDataStore` may be `null` — the weaver tab shows `WeaverTreePlaceholder` until real data loads. Never assume it's populated.
- `skillNodeAllocations[slotId]` may be `undefined` for slots that have never been used. Always default with `?? {}` or `?? EMPTY_ALLOCATED`.

**Optimization flow:**
- `invoke_claude_api` emits events AND may return `Err()` — this double-emit pattern is pre-existing. Do not "fix" it by removing the event emit.
- Suggestions are streamed incrementally via `optimization:suggestion-received`. The suggestion list must handle partial state (items arriving one by one).
- `previewSuggestionRank` in `optimizationStore` drives the preview overlay on the passive tree. A non-null rank means `previewAllocatedNodes` replaces `baseAllocatedNodes` for the canvas render.
- `optimizationStore.statSheet` is populated by `useStatSheet` (continuous background hook). Do not read `statSheet` before calling `toBuildSnapshot` for the scoring engine — they use different data shapes.
- `previewStatSheet` replaces `statSheet` in the stat sheet display while a suggestion is being previewed. Reset it by calling `setPreviewStatSheet(null)` when the preview ends.
- `useStatSheet` uses `requestAnimationFrame` debouncing with a generation counter. Do not attempt to debounce stat sheet computation manually outside this hook.
- Gear analysis state in `optimizationStore` (`gearAnalysis`, `gearNarrative`, `isAnalyzingGear`, `isGeneratingNarrative`) persists across optimization runs. It is only cleared by starting a new gear analysis via `startGearAnalysis()`.

**Accessibility:**
- All interactive elements must have a `2px solid accent-gold` focus ring — never `outline: none` without a replacement.
- `aria-live="polite"` on: import progress region, AI loading status, suggestion list container.
- `aria-live="assertive"` on: critical error regions only.
- `prefers-reduced-motion` must gate all animated transitions. Use `useReducedMotion()` hook.
- axe-core CI: any new `axe` violation fails CI. Run `vitest-axe` checks on all new views/components.

**Panel system:**
- Left panel = 260px (collapsible to 48px icon rail). Right panel = 340px (collapsible to 48px). Center = flex-grow.
- `SkillTreeCanvas` uses `ResizeObserver` to re-fit the PixiJS viewport on container resize — do not trigger resize via direct dimension props.
- `SkillTreeCanvasHandle.fitToTree()` is the only external resize trigger. Call it after tab switches or panel expand/collapse.

**Center canvas tabs:**
- `appStore.centerTab: CenterTab` where `CenterTab = 'tree' | 'gear' | 'skill' | 'idol' | 'blessing'`. Keys 1–5 switch tabs; `setCenterTab()` is the action.
- `SkillTreeView` is **always mounted** inside `CenterCanvas` — it is shown/hidden via `display: 'none'` style, never unmounted. This preserves the PixiJS WebGL context across tab switches.
- Tab content components live in `src/features/layout/tabs/`: `GearTab.tsx`, `SkillTab.tsx`, `IdolTab.tsx`, `BlessingTab.tsx`.
- The left panel is a **navigator only** (no ContextPanel accordion). Gear/idols/blessings/skills are center tabs, not left-panel sections.

**Item database:**
- `itemDatabase` in `gameDataStore` is separate from game data — it has its own staleness flags (`isItemDataStale`, `itemDataStaleAcknowledged`, `isItemDataUpdating`). Do not conflate with the game data staleness flags.
- `GearItemV2.affixes` uses `AffixEntryV2` (with optional `affixId`, `tier`, `value`). The old `GearItem` with `affixes: string[]` is deprecated and must not be used in new code.

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in this project.
- Follow ALL rules exactly — especially: no barrel files, no raw `invoke()`, WebGL patch is already present, props-only SkillTreeCanvas, module-level empty constants.
- When adding a Tauri command: implement in Rust → register in `lib.rs` invoke_handler → call via `invokeCommand<T>()` in TypeScript.
- When adding a new view: add it to `appStore.currentView` union type and route in `App.tsx`. Never add React Router.
- When working with trees: use the correct allocation namespace and store action for the tree type (passive/skill/weaver).
- When passing build data to Rust scoring commands: always call `toBuildSnapshot(build, gameData)` first. Never pass `BuildState` directly.
- When reading Rust-output types (`StatSheet`, `GearAnalysis`, etc.): field names are snake_case — never camelCase them.
- When reading optional `BuildState` fields (Phase 3 additions): always default with `?? {}` / `?? []` / `?? 50`.
- **PHASE BOUNDARY — NEVER MODIFY Phase 1 files.** This is Phase 2 (LEBOv2). Files outside the `LEBOv2/` directory are Phase 1 artifacts. Read them for context only — never write, edit, or commit changes to them.

**For Humans:**
- Update the Technology Stack section when upgrading major dependencies.
- Add to Critical Don't-Miss Rules when a new non-obvious constraint is discovered.
- Review after each epic completion for stale rules.

Last Updated: 2026-05-30
