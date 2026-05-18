# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Phase Boundary — CRITICAL

This is **Phase 2 (LEBOv2)**. The git repo root contains Phase 1 artifacts at `../_bmad-output/` (one level above this directory). Those files are **READ-ONLY historical context** — never modify them.

| Path | Status |
|------|--------|
| `LEBOv2/` (this directory and everything inside) | ✅ Active — read and write freely |
| `../_bmad-output/` (Phase 1 planning artifacts) | 🚫 Read-only context — never modify |
| `../lebo/` (Phase 1 source code, if present) | 🚫 Read-only context — never modify |

**Rule:** If you find yourself about to edit any file outside `LEBOv2/`, stop and ask the user. Phase 1 files can be read for context (e.g., to understand existing architecture, game data format, prior decisions) but must never be written, updated, or committed as part of Phase 2 work.

## Commands

All commands run from `lebo/` (the Vite project root). Package manager is **pnpm**.

```bash
# Dev server (Vite, port 1420)
pnpm dev

# Type-check + production build
pnpm build

# Preview production build
pnpm preview

# Tauri desktop app (dev)
pnpm tauri dev

# Run all tests
pnpm vitest

# Run tests in watch mode
pnpm vitest --watch

# Run a single test file
pnpm vitest src/features/skill-tree/treeDataTransformer.test.ts

# Run tests matching a name pattern
pnpm vitest -t "should calculate score"
```

No ESLint or Prettier config is present — TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`) enforces code quality at build time.

## Architecture

**Tauri 2 desktop app** — React 19 + TypeScript 5.8 + Vite 7 frontend, Rust backend (in `src-tauri/`). The frontend communicates with Rust via Tauri IPC using `shared/utils/invokeCommand.ts`.

### State — Zustand stores (`shared/stores/`)

Four stores hold all runtime state:
- **appStore** — UI state: current view, panel collapse, LLM provider, update status
- **buildStore** — Active build, saved builds, undo/redo stack
- **gameDataStore** — Loaded game data + staleness metadata
- **optimizationStore** — Optimization scores and suggestions

`App.tsx` wires the stores together on startup: it initializes game data, loads saved builds from Tauri vault, detects the LLM provider (Claude or OpenRouter), and subscribes to build/gameData changes to trigger score recalculation.

### Rendering split

The UI uses two rendering stacks side by side:
- **React + Tailwind** — All panels, dialogs, inputs, and overlays
- **PixiJS 8 (WebGL)** — Skill tree canvas only (`features/skill-tree/`)

The skill tree pipeline: `treeDataTransformer.ts` converts raw game data into a renderable tree → `pixiRenderer.ts` draws it via PixiJS → `useSkillTree.ts` handles interactivity (zoom, pan, node hover/click).

### Feature layout (`src/features/`)

Each feature folder is self-contained: component, hook, data file, and test co-located.

| Feature | Responsibility |
|---------|----------------|
| `skill-tree/` | PixiJS canvas, class mastery selector, node tooltip |
| `optimization/` | Scoring engine, goal selector, suggestions list, score gauge |
| `context-panel/` | Gear / skill / idol inputs that define the build context |
| `build-manager/` | Save/load/import/delete builds, auto-save hook |
| `game-data/` | Game data loader, staleness bar |
| `layout/` | AppHeader, LeftPanel, RightPanel, CenterCanvas, StatusBar |
| `settings/` | API key input, provider selector, OpenRouter config |

### Types (`shared/types/`)

Central type definitions — `build.ts`, `gameData.ts`, `optimization.ts`, `treeData.ts`, `errors.ts`. Avoid duplicating these; all features import from here.

### Testing

Vitest with jsdom + React Testing Library + vitest-axe. Config lives inside `vite.config.ts` (no separate vitest.config). `test-setup.ts` provides ResizeObserver and matchMedia polyfills required by Headless UI.

## Model Routing — Haiku vs Sonnet

Use the Agent tool with `model: "claude-haiku-4-5-20251001"` for these tasks:

| Task type | Example |
|-----------|---------|
| Sprint/epic status lookups | "What stories are in-progress?" |
| File existence / inventory checks | "Does this component file exist?" |
| Commit message generation | After a focused change is complete |
| Boilerplate from an established pattern | New TypeScript interface matching existing ones |
| Test result summarization | "Did the tests pass? What failed?" |
| YAML/JSON formatting or validation | Reformatting a config file |
| Simple grep/search with no reasoning | "Find all usages of this function name" |

Use Sonnet (default) for everything else:
- PixiJS / WebGL rendering work
- Architecture or design decisions
- Debugging across multiple files
- BMAD planning, story creation, epic decomposition
- Any task requiring judgment about trade-offs

## BMAD Session Context

`sprint-status.yaml` and `epics.md` are pre-loaded into your context at session
start by the Second Brain hook. **Do not re-read them during the session** unless
you just wrote a change to them and need to verify it. Work from the pre-loaded
versions — they are current as of session start.

## Playwright MCP Rules

**Never call `page.goto()` inside `browser_run_code`.** It orphans the tool's page context and hangs indefinitely. Navigation must always be a separate `browser_navigate` call.

Correct pattern:
1. `browser_run_code` — setup only (addInitScript, evaluate, assertions)
2. `browser_navigate` — navigate
3. `browser_take_screenshot` — inspect result

## PixiJS / WebGL

The WebGL `getShaderInfoLog` null patch is applied at module load in `pixiRenderer.ts`. Do not re-inject it via Playwright — it's already in the source.

This app is canvas-based (PixiJS). `browser_snapshot` (accessibility tree) is useless here — use `browser_take_screenshot` for all visual inspection.
