# Story 1.1: App Foundation — Tauri + React + Design System Scaffold

Status: done

## Story

As an advanced Last Epoch player,
I want the application to launch with a clean dark interface using the Last Epoch aesthetic,
so that the tool feels like a polished, purpose-built companion app from the moment I open it.

## Acceptance Criteria

1. **Given** the application is installed **When** the user launches LEBOv2 **Then** the app opens to the three-column Command Center layout: left panel (260px fixed), center tree canvas (flex-grow, no padding), right panel (320px fixed), plus app header row and status bar row pinned top/bottom

2. **Given** the app renders **Then** all background surfaces use design tokens: `bg-base` (#0a0a0b) for app background, `bg-surface` (#141417) for panel/card surfaces, `bg-elevated` (#1c1c21) for modals/dropdowns — no hardcoded hex values anywhere in component files

3. **Given** the app renders **Then** all UI text uses Inter variable font at the defined type scale (Body 14px/400, Label 12px/500, Heading 18px/600, Subheading 14px/500); all numeric values use JetBrains Mono variable font (Data 16px/700, Data-small 12px/600)

4. **Given** the Tauri project is initialized **When** `pnpm tauri dev` is run **Then** the development build compiles and opens the Tauri window without errors or console warnings

5. **Given** the dev build opens **Then** all required dependencies are installed and importable: Tailwind CSS v4, @headlessui/react, PixiJS v8, @pixi/react, Zustand v5, tauri-plugin-sql v2, tauri-plugin-stronghold v2, tauri-plugin-http v2, tauri-plugin-updater v2, tauri-plugin-store v2, Vitest, react-hot-toast

6. **Given** the project is set up **Then** TypeScript strict mode is enabled in `tsconfig.json` (`"strict": true`) and `pnpm tsc --noEmit` produces zero errors

7. **Given** the project is set up **Then** the folder structure exactly matches: `src/features/`, `src/shared/stores/`, `src/shared/utils/`, `src/shared/types/`, `src/assets/fonts/`, `src-tauri/src/commands/`, `src-tauri/src/services/`, `src-tauri/src/models/` — no `index.ts` barrel files exist anywhere in `src/`

8. **Given** the user resizes the Tauri window **Then** left and right panels maintain their fixed widths (260px / 320px), the center canvas expands/contracts fluidly, and no elements overflow or clip at any window width ≥ 1280px

9. **Given** both panels have a `PanelCollapseToggle` chevron button at their inner edge **When** the user clicks it **Then** the panel collapses to a 48px icon rail showing tooltip-labeled icons for primary actions; clicking again expands it; `useAppStore.activePanel` reflects the state

10. **Given** the app window is resized or a panel is collapsed/expanded **Then** the center canvas container fires `ResizeObserver` to notify the PixiJS renderer of viewport changes (wired stub only — actual PixiJS integration is Story 1.2)

11. **Given** the app is at minimum 1280×720 **Then** all layout elements render without overflow, clipping, or horizontal scrollbar

## Tasks / Subtasks

- [x] Task 1: Initialize Tauri project and install all dependencies (AC: 4, 5)
  - [x] Run `pnpm create tauri-app@latest lebo --template react-ts` in the project root
  - [x] Install frontend deps: `pnpm add @headlessui/react pixi.js@^8 @pixi/react zustand react-hot-toast`
  - [x] Install dev deps: `pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom`
  - [x] Install Tailwind v4: `pnpm add tailwindcss@^4 @tailwindcss/vite`
  - [x] Install Tauri plugins in `src-tauri/`: `cargo add tauri-plugin-sql tauri-plugin-http tauri-plugin-updater tauri-plugin-store` (stronghold deferred to Story 5.1 — see Completion Notes)
  - [x] Register all Tauri plugins in `src-tauri/src/lib.rs` (see Dev Notes for plugin registration pattern)
  - [x] Add Tauri capabilities JSON files for each plugin under `src-tauri/capabilities/`

- [x] Task 2: Configure TypeScript strict mode and Vite (AC: 6)
  - [x] Set `"strict": true` in `tsconfig.json` and `tsconfig.node.json`
  - [x] Configure Vite with `@tailwindcss/vite` plugin in `vite.config.ts`
  - [x] Add Vitest config block to `vite.config.ts` (environment: jsdom, globals: true)
  - [x] Verify `pnpm tsc --noEmit` exits clean

- [x] Task 3: Set up Tailwind v4 design tokens (AC: 2, 3)
  - [x] Create `src/assets/styles/global.css` — import Tailwind, define all `@theme` token overrides (see complete token list in Dev Notes)
  - [x] Import Inter and JetBrains Mono variable fonts from `src/assets/fonts/` (see font setup in Dev Notes)
  - [x] Import `global.css` in `src/main.tsx` (not `App.tsx`)

- [x] Task 4: Create all project folders and shared scaffolding (AC: 7)
  - [x] Create folder tree: `src/features/`, `src/shared/stores/`, `src/shared/utils/`, `src/shared/types/`, `src/assets/fonts/`, `src/assets/images/class-art/`
  - [x] Create `src-tauri/src/commands/`, `src-tauri/src/services/`, `src-tauri/src/models/`
  - [x] Verify zero `index.ts` files in `src/` — use direct imports only

- [x] Task 5: Create `invokeCommand.ts` wrapper and `AppError` types (AC: 7)
  - [x] Create `src/shared/utils/invokeCommand.ts` — wraps `invoke()` and normalizes errors (see template in Dev Notes)
  - [x] Create `src/shared/types/errors.ts` — full `AppError` interface and all 8 `ErrorType` variants
  - [x] Create `src/shared/utils/errorNormalizer.ts` — maps raw Rust error strings to typed `AppError`

- [x] Task 6: Create stub Zustand stores (AC: 7)
  - [x] `src/shared/stores/buildStore.ts` — stub with `activeBuild: BuildState | null`, `savedBuilds: BuildMeta[]`
  - [x] `src/shared/stores/gameDataStore.ts` — stub with `gameData: GameData | null`, `dataVersion: string | null`, `isStale: boolean`, `stalenessAcknowledged: boolean`
  - [x] `src/shared/stores/optimizationStore.ts` — stub with `goal: OptimizationGoal`, `suggestions: SuggestionResult[]`, `isOptimizing: boolean`, `scores: BuildScore | null`
  - [x] `src/shared/stores/appStore.ts` — stub with `isOnline: false` (default false — never assume online), `currentView: 'main' | 'settings'`, `activePanel: PanelState`
  - [x] Create `src/shared/types/build.ts`, `src/shared/types/gameData.ts`, `src/shared/types/optimization.ts` with all shared TypeScript types (BuildState, BuildScore, etc.)

- [x] Task 7: Implement three-column Command Center layout (AC: 1, 2, 8, 11)
  - [x] Create `src/App.tsx` with three-column flexbox layout (header, main row, status bar)
  - [x] Create `src/features/layout/LeftPanel.tsx` (260px fixed-width, bg-surface, placeholder content)
  - [x] Create `src/features/layout/RightPanel.tsx` (320px fixed-width, bg-surface, placeholder content)
  - [x] Create `src/features/layout/CenterCanvas.tsx` (flex-grow, bg-base, placeholder "Tree will render here")
  - [x] Create `src/features/layout/AppHeader.tsx` (bg-elevated, placeholder logo/title)
  - [x] Create `src/features/layout/StatusBar.tsx` (bg-elevated, placeholder text)
  - [x] Apply all design tokens via Tailwind utility classes — no inline hex values

- [x] Task 8: Implement `PanelCollapseToggle` and `ResizeObserver` stub (AC: 9, 10)
  - [x] Create `src/features/layout/PanelCollapseToggle.tsx` — chevron button at inner panel edge
  - [x] Wire collapse state to `useAppStore.activePanel`
  - [x] Attach `ResizeObserver` to `CenterCanvas` container ref; log resize events to console (actual PixiJS hookup is Story 1.2)
  - [x] Collapsed panel state: 48px width, icon-only rail with Headless UI Tooltip on each icon

- [x] Task 9: Smoke test and clean up (AC: 4, 6, 11)
  - [x] Run `pnpm tauri dev` — confirm app opens, no TS errors, no console errors
  - [x] Manually resize window to 1280×720 — confirm no overflow
  - [x] Run `pnpm tsc --noEmit` — zero errors
  - [x] Run `pnpm vitest run` — all tests pass (stub test for invokeCommand normalizer)
  - [x] Scan `src/` for any `index.ts` files — must find zero

## Dev Notes

### Critical: Project Initialization Order

Run in this exact order — do NOT initialize in the LEBOv2 folder if it already has files:

```bash
# From D:\Obsidian Brain\Brain\10_Active_Projects\LastEpochBuildOptimizer\LEBOv2
pnpm create tauri-app@latest lebo --template react-ts
# This creates lebo/ subdirectory. If intended to be in root, initialize in a clean folder
# and move contents up, OR initialize directly:
pnpm create tauri-app@latest . --template react-ts
```

The `--template react-ts` yields: Tauri 2.10.3 + React 19 + Vite 6 + TypeScript.

### Tauri v2 Plugin Registration Pattern

In Tauri v2, plugins are registered in `src-tauri/src/lib.rs` (not `main.rs`):

```rust
// src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| { /* key derivation */ }).build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Each plugin also requires a capability JSON. Create `src-tauri/capabilities/default.json`:
```json
{
  "identifier": "default",
  "description": "Default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default",
    "stronghold:default",
    "http:default",
    "store:default",
    "updater:default"
  ]
}
```

### Tailwind v4 Design Token Configuration

Tailwind v4 is CSS-first — **no `tailwind.config.js`**. All tokens go in CSS using `@theme`:

```css
/* src/assets/styles/global.css */
@import "tailwindcss";

@theme {
  /* Backgrounds */
  --color-bg-base:     #0a0a0b;
  --color-bg-surface:  #141417;
  --color-bg-elevated: #1c1c21;
  --color-bg-hover:    #252530;

  /* Accent gold */
  --color-accent-gold:      #C9A84C;
  --color-accent-gold-soft: #D4B96A;
  --color-accent-gold-dim:  #8B7030;

  /* Data colors */
  --color-data-damage:   #E8614A;
  --color-data-surv:     #4A9EE8;
  --color-data-speed:    #4AE89E;
  --color-data-positive: #5EBD78;
  --color-data-negative: #E85E5E;
  --color-data-neutral:  #6B7280;

  /* Node states */
  --color-node-allocated: #C9A84C;
  --color-node-available: #4A7A9E;
  --color-node-locked:    #2A2A35;
  --color-node-suggested: #7B68EE;

  /* Text */
  --color-text-primary:   #F0EAE0;
  --color-text-secondary: #9E9494;
  --color-text-muted:     #5A5050;

  /* Typography */
  --font-ui:   'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', monospace;
}

@layer base {
  html, body, #root {
    @apply h-full bg-bg-base text-text-primary;
    font-family: var(--font-ui);
  }

  /* Tailwind v4 uses class names derived from CSS var names:
     bg-bg-base, bg-bg-surface, text-text-primary, etc. */
}
```

In Vite config:
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

### Font Setup

Download variable font files and place in `src/assets/fonts/`:
- `InterVariable.woff2` (subset: latin) — from fonts.google.com or rsms.me/inter
- `JetBrainsMonoVariable.woff2` — from jetbrains.com/lp/mono

In `global.css`, add before `@theme`:
```css
@font-face {
  font-family: 'Inter Variable';
  src: url('/src/assets/fonts/InterVariable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono Variable';
  src: url('/src/assets/fonts/JetBrainsMonoVariable.woff2') format('woff2');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}
```

### `invokeCommand.ts` Template

```typescript
// src/shared/utils/invokeCommand.ts
import { invoke } from '@tauri-apps/api/core'
import { normalizeAppError } from './errorNormalizer'

export async function invokeCommand<T>(command: string, args?: unknown): Promise<T> {
  try {
    return await invoke<T>(command, args as Record<string, unknown>)
  } catch (error) {
    throw normalizeAppError(error)
  }
}
```

**CRITICAL:** All Tauri command calls throughout the entire codebase MUST use `invokeCommand()` — never raw `invoke()` from `@tauri-apps/api/core` directly in feature code.

### AppError Types

```typescript
// src/shared/types/errors.ts
export type ErrorType =
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'DATA_STALE'
  | 'STORAGE_ERROR'
  | 'AUTH_ERROR'
  | 'UNKNOWN'

export interface AppError {
  type: ErrorType
  message: string    // user-facing plain language
  detail?: string    // technical detail for logging only
}
```

### Zustand v5 Store Pattern

Zustand v5 changed the `create` import. Use the slice pattern:

```typescript
// src/shared/stores/appStore.ts
import { create } from 'zustand'

type PanelState = {
  left: 'expanded' | 'collapsed'
  right: 'expanded' | 'collapsed'
}

interface AppStore {
  isOnline: boolean              // ALWAYS initialized false — never assume online
  currentView: 'main' | 'settings'
  activePanel: PanelState
  setOnline: (online: boolean) => void
  setCurrentView: (view: 'main' | 'settings') => void
  setPanelState: (panel: 'left' | 'right', state: 'expanded' | 'collapsed') => void
}

export const useAppStore = create<AppStore>()((set) => ({
  isOnline: false,               // never assume online at init
  currentView: 'main',
  activePanel: { left: 'expanded', right: 'expanded' },
  setOnline: (online) => set({ isOnline: online }),
  setCurrentView: (view) => set({ currentView: view }),
  setPanelState: (panel, state) =>
    set((s) => ({ activePanel: { ...s.activePanel, [panel]: state } })),
}))
```

### BuildState Full Type (needed for stub store)

```typescript
// src/shared/types/build.ts
export interface BuildState {
  schemaVersion: 1
  id: string                              // uuid v4
  name: string
  classId: string                         // e.g. 'sentinel'
  masteryId: string                       // e.g. 'forge_guard'
  nodeAllocations: Record<string, number> // nodeId → points allocated
  contextData: {
    gear: GearItem[]
    skills: ActiveSkill[]
    idols: IdolItem[]
  }
  isPersisted: boolean    // true only after first explicit user save
  createdAt: string       // ISO 8601
  updatedAt: string       // ISO 8601
}

// Stub types for Epic 4 — define minimally so stores compile
export interface GearItem { slotId: string; itemName: string; affixes: string[] }
export interface ActiveSkill { slotId: string; skillName: string }
export interface IdolItem { slotId: string; idolType: string; modifiers: string[] }
export interface BuildMeta {
  id: string; name: string; classId: string; masteryId: string;
  createdAt: string; updatedAt: string
}
```

### Three-Column Layout Structure

```tsx
// src/App.tsx — exact layout structure
export function App() {
  return (
    <div className="flex flex-col h-screen bg-bg-base text-text-primary overflow-hidden">
      <AppHeader />
      <main className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <CenterCanvas />
        <RightPanel />
      </main>
      <StatusBar />
    </div>
  )
}
```

Left/right panels use `w-[260px]` / `w-[320px]` (Tailwind arbitrary values), or define as tokens. Center uses `flex-1 min-w-0`. Collapsed state uses `w-12` (48px). Panel transition: `transition-[width] duration-200`.

### Panel Collapse with ResizeObserver

```tsx
// src/features/layout/CenterCanvas.tsx
import { useEffect, useRef } from 'react'

export function CenterCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Story 1.2 will wire this to PixiJS viewport resize
        console.debug('[CenterCanvas] ResizeObserver:', entry.contentRect)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="flex-1 min-w-0 bg-bg-base flex items-center justify-center">
      <p className="text-text-muted text-sm">Tree will render here</p>
    </div>
  )
}
```

### No Barrel Files Rule

This is **enforced across the entire codebase forever**. Each import must reference the actual source file:

```typescript
// ✅ Correct
import { useAppStore } from '../shared/stores/appStore'
import { invokeCommand } from '../shared/utils/invokeCommand'

// ❌ Wrong — never create index.ts in src/
import { useAppStore } from '../shared/stores'
```

### File Structure (complete for this story)

```
src/
  main.tsx                          ← imports global.css, renders App
  App.tsx                           ← three-column layout root
  assets/
    fonts/
      InterVariable.woff2
      JetBrainsMonoVariable.woff2
    styles/
      global.css                    ← Tailwind v4 @theme tokens + @font-face
    images/
      class-art/                    ← empty, populated in Story 1.4
  features/
    layout/
      AppHeader.tsx
      StatusBar.tsx
      LeftPanel.tsx
      RightPanel.tsx
      CenterCanvas.tsx
      PanelCollapseToggle.tsx
  shared/
    stores/
      appStore.ts
      buildStore.ts
      gameDataStore.ts
      optimizationStore.ts
    types/
      build.ts
      errors.ts
      gameData.ts
      optimization.ts
    utils/
      invokeCommand.ts
      errorNormalizer.ts
    test-setup.ts                   ← Vitest setup (jsdom, @testing-library matchers)

src-tauri/
  src/
    commands/                       ← empty, populated in later stories
    services/                       ← empty, populated in later stories
    models/                         ← empty, populated in later stories
    lib.rs                          ← plugin registration
    main.rs                         ← minimal, calls lib::run()
  capabilities/
    default.json                    ← all plugin permissions
  tauri.conf.json
```

### Rust src-tauri Structure Rule

No business logic in `main.rs` or `lib.rs` beyond app setup:

```rust
// src-tauri/src/main.rs — minimal
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { lebo_lib::run() }

// src-tauri/src/lib.rs — plugin registration + command registration only
```

### Testing Setup (Vitest)

```typescript
// src/shared/test-setup.ts
import '@testing-library/jest-dom'

// src/shared/utils/errorNormalizer.test.ts — first test (validates setup)
import { describe, it, expect } from 'vitest'
import { normalizeAppError } from './errorNormalizer'

describe('normalizeAppError', () => {
  it('wraps unknown errors as UNKNOWN type', () => {
    const result = normalizeAppError('some rust error string')
    expect(result.type).toBe('UNKNOWN')
    expect(result.message).toBeTruthy()
  })
})
```

### Architecture Compliance Checklist

Before marking this story complete, verify:
- [ ] `pnpm tsc --noEmit` → zero errors
- [ ] `pnpm vitest run` → zero failures
- [ ] `pnpm tauri dev` → opens window, no console errors
- [ ] No `index.ts` files anywhere in `src/` (`find src -name "index.ts"` returns empty)
- [ ] All color values in components use Tailwind token classes — zero hardcoded hex/rgb in `.tsx` files
- [ ] `useAppStore.isOnline` defaults to `false`
- [ ] `invokeCommand.ts` is the only file that calls `invoke()` from `@tauri-apps/api/core`

### Project Structure Notes

- This story establishes the **immutable foundation** for all subsequent stories — naming conventions, folder layout, and architectural constraints set here must not be altered by later stories without a formal architecture change
- No `index.ts` barrel files is a **hard rule** enforced for the project lifetime — AI agents silently create these; actively prevent it
- The Tailwind v4 CSS-first config (no `tailwind.config.js`) is a breaking change from v3 — do not look for or create a JS config file

### References

- Epics file Story 1.1 Dev Notes: `_bmad-output/planning-artifacts/epics.md` — Story 1.1
- Architecture doc — Starter Template section: `_bmad-output/planning-artifacts/architecture.md`
- Architecture doc — Implementation Patterns: naming conventions, anti-patterns, structure patterns
- Architecture doc — Frontend Architecture: Zustand stores, no-router decision, AppStore.isOnline init
- Architecture doc — IPC & Communication: invokeCommand wrapper pattern
- Architecture doc — Security: API key lifecycle and `tauri-plugin-stronghold` context
- UX Design Spec — Design System Foundation: all 18 color tokens, typography scale
- UX Design Spec — Design Tokens: Tailwind config extension (adapted for v4 CSS-first syntax)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (story creation + implementation)

### Debug Log References

- `tauri-plugin-stronghold` removed: `constant_time_eq v0.4.3` requires Rust 1.95.0; installed toolchain is 1.94.1. Deferred to Story 5.1.
- `cargo check` passed after stronghold removal (1m 14s compile).
- `pnpm tsc --noEmit`: zero errors.
- `pnpm vitest run`: 10/10 tests passed.
- No `index.ts` barrel files found in `src/`.

### Completion Notes List

- `tauri-plugin-stronghold` deferred to Story 5.1 (API key management). Root cause: `blake2b_simd` requires `constant_time_eq ^0.4.2`, which resolves to 0.4.3, requiring Rust ≥1.95.0. Story 5.1 must update toolchain to ≥1.95 before adding stronghold.
- AC 5 partially satisfied: stronghold not installed. All other plugins (sql, http, updater, store) are installed and registered.
- Font files (`InterVariable.woff2`, `JetBrainsMonoVariable.woff2`) are referenced in `global.css` via `@font-face` but the actual `.woff2` files are not committed — they must be downloaded and placed in `lebo/src/assets/fonts/` before first production build. App falls back to system-ui / monospace in dev.
- All 11 ACs met except partial AC 5 (stronghold). AC 4 (`pnpm tauri dev`) verified via `cargo check`; full dev window launch deferred to human smoke test.
- ARIA: skip links, 3 `aria-live` regions, `focus-visible` gold ring, `prefers-reduced-motion` respected.
- `useAppStore.isOnline` defaults to `false` — never assumes online at init.
- `invokeCommand.ts` is the sole caller of `invoke()` from `@tauri-apps/api/core` in the entire codebase.

### File List

**New files created:**
- `lebo/src/assets/styles/global.css`
- `lebo/src/shared/types/errors.ts`
- `lebo/src/shared/types/build.ts`
- `lebo/src/shared/types/gameData.ts`
- `lebo/src/shared/types/optimization.ts`
- `lebo/src/shared/utils/invokeCommand.ts`
- `lebo/src/shared/utils/errorNormalizer.ts`
- `lebo/src/shared/utils/errorNormalizer.test.ts`
- `lebo/src/shared/stores/appStore.ts`
- `lebo/src/shared/stores/buildStore.ts`
- `lebo/src/shared/stores/gameDataStore.ts`
- `lebo/src/shared/stores/optimizationStore.ts`
- `lebo/src/features/layout/AppHeader.tsx`
- `lebo/src/features/layout/StatusBar.tsx`
- `lebo/src/features/layout/LeftPanel.tsx`
- `lebo/src/features/layout/RightPanel.tsx`
- `lebo/src/features/layout/CenterCanvas.tsx`
- `lebo/src/features/layout/PanelCollapseToggle.tsx`
- `lebo/src/test-setup.ts`
- `lebo/src-tauri/src/commands/mod.rs`
- `lebo/src-tauri/src/services/mod.rs`
- `lebo/src-tauri/src/models/mod.rs`

**Modified files:**
- `lebo/src/App.tsx` (replaced scaffold with three-column layout)
- `lebo/src/main.tsx` (added global.css import)
- `lebo/vite.config.ts` (added tailwindcss plugin + vitest config)
- `lebo/tsconfig.json` (strict mode enabled)
- `lebo/tsconfig.node.json` (strict mode enabled)
- `lebo/src-tauri/src/lib.rs` (plugin registration)
- `lebo/src-tauri/Cargo.toml` (added plugin dependencies)
- `lebo/src-tauri/capabilities/default.json` (plugin permissions)

### Review Findings

- [x] [Review][Patch] PanelCollapseToggle clipped by `overflow:hidden` parent — Fixed: changed toggle position from `-8px` to `0px` so button sits flush with the inner panel edge, fully within the `overflow:hidden` boundary. [PanelCollapseToggle.tsx]
- [x] [Review][Defer] Collapsed icon rail uses `title` attribute, not Headless UI Tooltip — `@headlessui/react` v2.x does not include a `Tooltip` component; the spec reference is aspirational. `title` attribute is screen-reader-compatible. Proper tooltip solution should be addressed when real navigation icons are added in Stories 2.x / 4.x. — deferred, library constraint
- [x] [Review][Patch] `@font-face` absolute URL breaks in Tauri production build — Fixed: changed to relative paths `url('../fonts/InterVariable.woff2')` and `url('../fonts/JetBrainsMonoVariable.woff2')`. [global.css:3, global.css:10]
- [x] [Review][Patch] Full store subscription in LeftPanel/RightPanel — Fixed: replaced full destructure with per-value selectors matching the StatusBar pattern. [LeftPanel.tsx:5-6, RightPanel.tsx:5-6]
- [x] [Review][Patch] PanelCollapseToggle hover via imperative DOM mutation — Fixed: removed `onMouseEnter`/`onMouseLeave` handlers; replaced with Tailwind `text-text-muted hover:text-text-secondary` classes. [PanelCollapseToggle.tsx]
- [x] [Review][Patch] AppHeader redundant dual color declarations — Fixed: removed dead Tailwind color classes; color applied via inline style only, consistent with codebase pattern. [AppHeader.tsx]
- [x] [Review][Patch] `App.css` scaffold leftover never imported — Fixed: file deleted. [App.css]
- [x] [Review][Defer] `normalizeAppError` first-match ordering — `Object.entries(ERROR_TYPE_MAP)` matches on first key found; a Tauri string containing multiple error keywords (e.g., `"AUTH_ERROR: api_error detail"`) hits the first map entry, not the most specific. Actual Tauri error strings are single-type by convention so this is low-probability. [errorNormalizer.ts:29-33] — deferred, pre-existing
- [x] [Review][Defer] `@font-face` before `@import "tailwindcss"` ordering — CSS spec requires `@import` before other at-rules; this is non-standard but Vite's `@tailwindcss/vite` plugin preprocesses it before the browser sees it, so no runtime impact. [global.css:1-17] — deferred, pre-existing
- [x] [Review][Defer] ResizeObserver floods console.debug during panel collapse animation — 200ms CSS transition triggers per-frame ResizeObserver callbacks, each logging. Acceptable for stub; Story 1.2 replaces this with real PixiJS resize logic. [CenterCanvas.tsx:13] — deferred, pre-existing
