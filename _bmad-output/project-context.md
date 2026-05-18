---
project_name: 'LEBOv2'
user_name: 'Alec'
date: '2026-05-05'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 47
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in this project. Focused on unobvious details agents might otherwise miss._

---

## Technology Stack & Versions

**Desktop Shell:** Tauri 2.x (tauri-cli ^2, @tauri-apps/api ^2)
**Frontend:** React 19.1 + TypeScript ~5.8.3 (strict mode) + Vite 7 + Tailwind CSS v4
**Canvas Rendering:** PixiJS 8.18.1 + @pixi/react 8.0.5
**State Management:** Zustand 5.0.12 (4 domain stores)
**UI Primitives:** @headlessui/react 2.2.10
**Toasts:** react-hot-toast 2.6.0
**Backend (Rust):** Tauri 2, serde/serde_json 1, rusqlite 0.32 (bundled), reqwest 0.12 (json+stream), tokio 1, argon2 0.5
**Tauri Plugins:** tauri-plugin-sql 2.4.0 (sqlite), tauri-plugin-stronghold 2, tauri-plugin-http 2.5.8, tauri-plugin-updater 2.10.1, tauri-plugin-store 2.4.2
**Testing:** Vitest 4.1.4 + @testing-library/react 16 + jsdom 29 + vitest-axe 0.1.0
**Build:** TypeScript bundler mode, Vite test config lives in `vite.config.ts` (no separate vitest.config)

---

## Critical Implementation Rules

### Language-Specific Rules

- **TypeScript strict mode is enforced:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`. Every unused import or parameter is a compile error.
- **Module resolution is `bundler`** — use `allowImportingTsExtensions`. No `.js` extensions on imports.
- **No barrel files anywhere in `src/`** — never create `index.ts` re-export files. Import directly from the source file.
- **All errors normalize to `AppError`** before reaching any component. The `AppError` type is `{ type: ErrorType; message: string; detail?: string }`. The `normalizeAppError()` utility in `src/shared/utils/errorNormalizer.ts` is the single normalization point.
- **`ErrorType` enum values must match Rust error string prefixes** — `normalizeAppError` does a case-insensitive substring search. New error types require a matching prefix in Rust (e.g., `"STORAGE_ERROR: ..."`) and an entry in `ERROR_TYPE_MAP`.

### Framework-Specific Rules

**IPC (Tauri):**
- **NEVER call raw `invoke()` from `@tauri-apps/api/core`** — always use the `invokeCommand<T>()` wrapper in `src/shared/utils/invokeCommand.ts`. It normalizes errors automatically.
- All Tauri command names are snake_case strings (matching Rust function names). All must be registered in `lib.rs` `invoke_handler!`.
- **Vault (Stronghold) reads must be sequential, not concurrent.** Never `Promise.all()` multiple vault reads — see `App.tsx` startup: vault reads are chained with `.then()`.
- The `ANTHROPIC_API_KEY` environment variable override in `claude_commands.rs` (`#[cfg(debug_assertions)]`) must be removed before any public release build.

**React / Zustand:**
- **Four domain stores only:** `useBuildStore`, `useGameDataStore`, `useOptimizationStore`, `useAppStore`. Do not create new top-level stores; extend existing ones.
- **No React Router** — view switching is `appStore.currentView: 'main' | 'settings'`. Never add a router.
- Zustand stores use `create<Interface>()((set, get) => ...)` pattern with inline function bodies. Do not use `immer` middleware.
- `useBuildStore.undoStack` caps at 10 snapshots (MAX_UNDO_STACK = 10). Undo only tracks `nodeAllocations` changes, not contextData changes.
- **`SkillTreeCanvas` is props-only** — it receives `treeData`, `allocatedNodes`, and `highlightedNodes` via props. It does NOT access any Zustand store internally. The PixiJS render context has no React store access.

**PixiJS:**
- The **WebGL null info-log patch** is applied at module load time in `pixiRenderer.ts` (IIFE at top of file). Never re-inject it from tests or via Playwright. It patches `WebGLRenderingContext.prototype` and `WebGL2RenderingContext.prototype`.
- `SkillTreeCanvas` uses `initChainRef` to serialize PixiJS `Application.init()` calls — prevents React StrictMode double-mount from launching two concurrent WebGL inits.
- All node drawing functions (`drawAllocated`, `drawAvailable`, `drawLocked`, `drawSuggested`) are pure PixiJS `Graphics` calls. Use hex colors from the design token list (see below).
- `reducedMotion` must be respected: `drawSuggested` skips the glow ring when `reducedMotion = true`.

**Tauri Event Streaming (Claude API):**
- Claude API streams via Tauri events — never via a direct return value from `invoke_claude_api`.
- Three event names: `optimization:suggestion-received`, `optimization:complete`, `optimization:error`.
- The `useOptimizationStream` hook (in `src/shared/stores/`) subscribes to these events and populates `optimizationStore`.

**Tailwind v4:**
- CSS-first config — no `tailwind.config.js`. All custom tokens are CSS variables defined in the global stylesheet.
- **Never use `@apply`** — Tailwind v4 dropped reliable `@apply` support for custom properties.
- Design tokens use `var(--color-*)` CSS variables: `--color-bg-base`, `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-hover`, `--color-accent-gold`, `--color-accent-gold-soft`, `--color-accent-gold-dim`, `--color-data-damage`, `--color-data-surv`, `--color-data-speed`, `--color-node-allocated`, `--color-node-available`, `--color-node-locked`, `--color-node-suggested`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`.

### Testing Rules

- **Vitest config lives in `vite.config.ts`** under the `test` key (`environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate `vitest.config.ts`.
- **`test-setup.ts` provides three stubs** that must not be duplicated in individual test files:
  1. `@testing-library/jest-dom` matchers
  2. `vitest-axe` `toHaveNoViolations` matcher
  3. `ResizeObserver` no-op stub (required for Headless UI)
  4. `window.matchMedia` no-op stub (required for `useReducedMotion`)
- **Mock Tauri IPC** via `vi.mock('@tauri-apps/api/core', ...)` or `vi.mock('../../shared/utils/invokeCommand', ...)`. Never let tests reach real Tauri IPC.
- **Accessibility tests** use `vitest-axe`: `import { axe } from 'vitest-axe'` then `expect(await axe(container)).toHaveNoViolations()`.
- Test files co-locate with source: `ComponentName.test.tsx` next to `ComponentName.tsx`, `store.test.ts` next to `store.ts`.
- No snapshot tests — use explicit `expect` assertions.

### Code Quality & Style Rules

**Naming conventions (strictly enforced):**
- React components: `PascalCase.tsx`
- Feature folders: `kebab-case/` (e.g., `skill-tree/`, `build-manager/`)
- Utilities / hooks: `camelCase.ts` (e.g., `invokeCommand.ts`, `useReducedMotion.ts`)
- Stores: `[domain]Store.ts` (e.g., `buildStore.ts`, `appStore.ts`)
- Rust commands: `snake_case` (matching Tauri invoke string)
- Tauri events: `feature:action` (e.g., `optimization:suggestion-received`)

**Comments:**
- Write no comments by default. Only add a comment when the WHY is non-obvious (hidden constraint, workaround, subtle invariant). Never describe what code does — only why it must be done that way.

**Imports:**
- No default exports in any module except `App.tsx` (which uses named export anyway). Always named exports.
- Group imports: external libs → internal shared → internal feature-local.

**SQLite schema** (build storage via tauri-plugin-sql):
```
id TEXT PRIMARY KEY
name TEXT NOT NULL
schema_version INTEGER
data TEXT NOT NULL
created_at TEXT
updated_at TEXT
```
All `BuildState` objects have `schemaVersion: 1`. The `migrateBuildState` function in `buildPersistence.ts` handles schema upgrades.

### Development Workflow Rules

- **Desktop-first Tauri** — never introduce Node.js/Electron patterns. All backend logic in Rust, never in a Node sidecar.
- **No server** — the app calls Claude API directly from Rust. No proxy, no backend service.
- **Game data** is versioned JSON files in the Tauri app data dir. `manifest.json` tracks `gameVersion`, `dataVersion`, `generatedAt`, `classes`. Class data files are `classes/{classId}.json`.
- **Two target platforms:** Windows 10/11 (`.msi`) and macOS 12+ (`.dmg`). CI uses `tauri-apps/tauri-action` on git tag push.
- **Pre-release blocker:** Code signing certs required before first public release — Windows Authenticode EV cert + Apple Developer Program ($99/yr). See `deferred-work.md` for details.

### Critical Don't-Miss Rules

**Security:**
- **API key NEVER crosses to frontend JS.** The key is stored in Stronghold (AES-256), retrieved by Rust on API call, injected into the HTTP header. Any code that reads an API key in TypeScript is wrong.
- `VAULT_PASSWORD` in `keychain_service.rs` is a static constant (known deferred). This is acceptable for MVP; do not replace with per-device secret without a full migration plan.
- `#[cfg(debug_assertions)] let api_key = std::env::var("ANTHROPIC_API_KEY")...` in `claude_commands.rs` — **must be removed before public release build.**

**PixiJS / Canvas:**
- This app is canvas-based. `browser_snapshot` (accessibility tree) is useless for visual inspection — always use `browser_take_screenshot`.
- Never call `page.goto()` inside Playwright `browser_run_code` — it orphans the page context and hangs. Navigation must be a separate `browser_navigate` call.

**Accessibility:**
- All interactive elements must have a `2px solid accent-gold` focus ring — never `outline: none` without a replacement.
- `aria-live="polite"` on: import progress region, AI loading status, suggestion list container.
- `aria-live="assertive"` on: critical error regions only.
- `prefers-reduced-motion` must gate all animated transitions. Use `useReducedMotion()` hook.
- axe-core CI: any new `axe` violation fails CI. Run `vitest-axe` checks on all new views/components.

**State management gotchas:**
- `useBuildStore.applyNodeChange` validates prerequisites before allocating and dependents before deallocating. Do not bypass this with direct `set()` calls.
- `useOptimizationStore.clearSuggestions()` must be called before starting a new optimization run (handled in `useOptimizationStream`).
- `useAppStore.isOnlineChecked` starts `false` — AI optimization must check both `isOnline` AND `isOnlineChecked` before enabling.

**Panel system:**
- Left panel = 260px (collapsible to 48px icon rail). Right panel = 320px (collapsible to 48px). Center = flex-grow.
- `SkillTreeCanvas` uses `ResizeObserver` to re-fit the PixiJS viewport on container resize — do not trigger resize via direct dimension props.

**Optimization flow:**
- `invoke_claude_api` emits events AND may return `Err()` — this double-emit pattern is pre-existing. Do not "fix" it by removing the event emit.
- Suggestions are streamed and rendered incrementally as `optimization:suggestion-received` fires. The suggestion list must handle partial state (items arriving one by one).

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in this project.
- Follow ALL rules exactly — especially: no barrel files, no raw `invoke()`, WebGL patch is already present, props-only SkillTreeCanvas.
- When adding a Tauri command: implement in Rust → register in `lib.rs` invoke_handler → call via `invokeCommand<T>()` in TypeScript.
- When adding a new view: add it to `appStore.currentView` union type and route in `App.tsx`. Never add React Router.
- **PHASE BOUNDARY — NEVER MODIFY Phase 1 files.** This is Phase 2 (LEBOv2). Files outside the `LEBOv2/` directory (e.g., `../_bmad-output/`, `../lebo/`) are Phase 1 artifacts. Read them for context only — never write, edit, or commit changes to them.

**For Humans:**
- Update the Technology Stack section when upgrading major dependencies.
- Add to Critical Don't-Miss Rules when a new non-obvious constraint is discovered.
- Review after each epic completion for stale rules.

Last Updated: 2026-05-05
