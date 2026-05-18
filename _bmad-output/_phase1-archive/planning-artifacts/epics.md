---
stepsCompleted: ['step-01', 'step-02', 'step-03', 'step-04']
workflowStatus: complete
completedAt: '2026-04-18'
lastEdited: '2026-04-18'
editHistory:
  - date: '2026-04-18'
    changes: 'IR fixes: NFR7 wording corrected to tauri-plugin-stronghold; Story 1.3 split into 1.3a (research spike) + 1.3b (implementation); Story 3.4 virtual scroll library resolved to @tanstack/react-virtual; Story 3.5 AC added for prerequisite validation failure on Apply; Story 3.6 AC added for preview state cleanup before re-run; Story 5.1 AC added for first-launch Stronghold vault initialization; Story 5.5 prerequisites section added for code signing certificates'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# LEBOv2 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for LEBOv2, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can create a new build by selecting a class and mastery from all available options (all 5 classes, all 15 masteries)
FR2: User can import an existing build by pasting a build code string
FR3: System displays per-node resolution status when a build import contains unrecognized node IDs
FR4: User can save a build locally with a name for future retrieval
FR5: User can load a previously saved build
FR6: User can rename a saved build
FR7: User can delete a saved build
FR8: User can view the full passive skill tree for their selected class and mastery
FR9: User can view the skill-specific trees for active skills associated with their build
FR10: User can allocate and deallocate skill tree nodes interactively
FR11: User can pan and zoom the skill tree to navigate large trees
FR12: User can view node details (name, effect, tags, connections) for any node
FR13: System visually distinguishes allocated, unallocated, and prerequisite-locked nodes
FR14: User can select an optimization goal (maximize damage / maximize survivability / maximize speed / balanced) before triggering optimization
FR15: User can trigger AI optimization analysis for their current build state
FR16: System generates a ranked list of specific skill tree node change recommendations based on the selected goal
FR17: System calculates and displays a composite score (damage, survivability, speed) for the current build state
FR18: System includes context panel data (gear, active skills, idols) in the AI optimization request
FR19: System declines to generate suggestions for nodes where game data is missing or incomplete, and indicates which nodes were excluded
FR20: User can view the ranked suggestion list ordered by impact on the selected optimization goal
FR21: User can view the exact node change specified in each suggestion (points to add/remove/reallocate, from/to which nodes)
FR22: User can view before/after numeric deltas for damage, survivability, and speed scores for each suggestion
FR23: User can view a plain-language technical explanation for each suggestion — each explanation must reference at least one specific node interaction, mechanic, or scaling relationship
FR24: User can preview the visual effect of a suggestion on the skill tree before applying it
FR25: User can accept or dismiss individual suggestions
FR26: User can re-run optimization on the current build state after making changes
FR27: User can input gear items via a searchable structured form — item name auto-fills from game data; affix fields are selectable from the item's valid affix list
FR28: User can input active skill selections via a searchable skill selector — skill names auto-fill from the class's available active skills
FR29: User can input idol slot contents via a searchable structured form — idol type and modifiers auto-fill from game data
FR31: System loads skill tree, passive tree, and node data for all 5 Last Epoch classes and 15 masteries
FR32: System checks for updated game data on application launch
FR33: User can manually trigger a game data update
FR34: System displays the current game data version and last-updated date
FR35: System displays a staleness warning when local data version is behind the current game version
FR36: User can acknowledge a staleness warning and continue with outdated data
FR37: User can configure their Claude API key in application settings
FR38: System displays current API connectivity status in the UI
FR39: User can access the skill tree visualizer and saved builds when offline
FR40: AI optimization features are disabled when offline; UI displays: "AI optimization requires internet connectivity. Connect to the internet and retry."
FR41: Application checks for app updates on launch and notifies the user when a new version is available
FR42: User can install application updates from within the application

### NonFunctional Requirements

NFR1: Skill tree graph renders at ≥ 60fps on mid-range hardware (Intel Core i5 equivalent, integrated graphics) during pan, zoom, hover, and node click
NFR2: Application cold-start to interactive: ≤ 5 seconds
NFR3: Build import (paste to rendered tree): ≤ 3 seconds for a complete build
NFR4: AI optimization results returned and displayed: ≤ 30 seconds under normal network conditions
NFR5: Game data initial load (all 5 classes): ≤ 10 seconds on first launch after install
NFR6: UI input latency remains ≤ 100ms during AI optimization request processing — no freeze or blocked interaction while awaiting Claude API response
NFR7: Claude API key stored in tauri-plugin-stronghold (AES-256 encrypted vault in app data directory — not OS-native credential managers; OS-native integration is a post-MVP enhancement) — never in plain text in config files, application state, or IPC responses
NFR8: All Claude API and game data requests transmitted over HTTPS
NFR9: No user build data or personal information transmitted to any service other than the Claude API (limited to build state required for optimization)
NFR10: Application does not execute any code received from remote sources
NFR11: Claude API failures (timeout, rate limit, 5xx) surfaced to user with an error message identifying the failure type and a retry option — no silent failures, no empty results
NFR12: Claude API requests time out after 45 seconds maximum; user notified and able to retry
NFR13: Game data download failures do not prevent app launch — fallback to cached data with visible staleness warning
NFR14: Application remains functional (build view, saved builds, manual editing) when all external services are unavailable
NFR15: All interactive controls (nodes, buttons, inputs) are keyboard-accessible
NFR16: Skill tree node tooltips and suggestion panel content are readable at 100% system font scale without truncation
NFR17: Node state (allocated / unallocated / locked) is indicated by shape, icon, or label — not color alone

### Additional Requirements

- **STARTER TEMPLATE (Epic 1 Story 1):** `pnpm create tauri-app@latest lebo --template react-ts` — Tauri 2.10.3 + React 19 + Vite 6 + TypeScript strict mode
- **RENDERER SPIKE GATE:** PixiJS v8 WebGL renderer must be spiked and validated at ≥60fps on target hardware (Intel i5 + integrated graphics) before any other skill tree work proceeds — this is a hard architectural gate
- **FULL TECH STACK:** Add to starter — Tailwind CSS v4, @headlessui/react, PixiJS v8 + @pixi/react, Zustand v5, tauri-plugin-sql v2, tauri-plugin-stronghold v2, tauri-plugin-http v2, tauri-plugin-updater v2, tauri-plugin-store v2, Vitest, react-hot-toast
- **IPC ARCHITECTURE:** All frontend↔backend communication via `invokeCommand()` wrapper in `src/shared/utils/invokeCommand.ts` — no raw `invoke()` calls; all errors normalize to `AppError` type before reaching components
- **SECURITY MODEL:** API key lifecycle — user inputs → Tauri command → tauri-plugin-stronghold (OS keychain) → Rust retrieves on API call → injected into HTTP header → key NEVER crosses to frontend JS
- **ZUSTAND STORES:** Four domain-separated stores: `useBuildStore` (active build, saved builds), `useGameDataStore` (game data, version, staleness), `useOptimizationStore` (goal, suggestions, scores), `useAppStore` (isOnline, currentView, panel states)
- **CLAUDE STREAMING:** Claude API responses stream via Tauri event system — `optimization:suggestion-received`, `optimization:complete`, `optimization:error` — populating `optimizationStore` incrementally
- **BUILD STORAGE:** SQLite via `tauri-plugin-sql` with schema: `id TEXT PRIMARY KEY, name TEXT NOT NULL, schema_version INTEGER, data TEXT NOT NULL, created_at TEXT, updated_at TEXT`
- **GAME DATA FORMAT:** Versioned JSON files in app data directory; `manifest.json` tracks `gameVersion`, `dataVersion`, `generatedAt`, `classes`
- **NO ROUTER:** View switching via `appStore.currentView: 'main' | 'settings'` — no React Router
- **SKILL TREE ISOLATION:** `SkillTreeCanvas` receives all data via props only (`treeData`, `highlightedNodes`, `allocatedNodes`) — no store access inside PixiJS render context
- **NO BARREL FILES:** No `index.ts` barrel files anywhere in `src/`
- **SESSION UNDO:** `useBuildStore.undoStack` — max 10 tree state snapshots; `buildStore.undoNodeChange()` available
- **NAMING CONVENTIONS:** React components PascalCase; feature folders kebab-case; utilities camelCase; stores `[domain]Store.ts`; Rust commands snake_case; Tauri events `feature:action`
- **RESEARCH TASKS (must precede certain stories):** (1) Build code import format audit before `buildParser.ts`; (2) Claude prompt contract spec (`docs/claude-prompt-spec.md`) before `claude_commands.rs`; (3) Scoring algorithm research (`docs/scoring-model.md`) before `scoringEngine.ts`; (4) Game data source URL/format research before `game_data_service.rs`
- **CI/CD:** GitHub Actions with `tauri-apps/tauri-action` building Windows + macOS binaries on git tag push; code signing required (Windows Authenticode, macOS Developer ID + notarization)
- **TESTING LAYERS:** Vitest unit tests (pure functions); Vitest + mock Tauri commands (store/component); Playwright + tauri-driver E2E (core loop: import → optimize → apply)

### UX Design Requirements

UX-DR1: Implement Tailwind CSS v4 color token system — bg-base (#0a0a0b), bg-surface (#141417), bg-elevated (#1c1c21), bg-hover (#252530); accent-gold (#C9A84C), accent-gold-soft (#D4B96A), accent-gold-dim (#8B7030); data-damage (#E8614A), data-surv (#4A9EE8), data-speed (#4AE89E), data-positive (#5EBD78), data-negative (#E85E5E), data-neutral (#6B7280); node-allocated (#C9A84C), node-available (#4A7A9E), node-locked (#2A2A35), node-suggested (#7B68EE); text-primary (#F0EAE0), text-secondary (#9E9494), text-muted (#5A5050)
UX-DR2: Implement typography system — Inter variable font (UI text, labels, explanations) + JetBrains Mono variable font (numeric scores, delta values); type scale: Display 24px/600/Inter, Heading 18px/600/Inter, Subheading 14px/500/Inter, Body 14px/400/Inter, Label 12px/500/Inter, Data 16px/700/JetBrains Mono, Data-small 12px/600/JetBrains Mono, Caption 11px/400/Inter
UX-DR3: Implement Command Center three-column layout — left panel (260px, collapsible to 48px icon rail), center tree canvas (flex-grow, no padding), right panel (320px, collapsible to 48px icon rail), app header row, status bar row; minimum supported resolution 1280×720
UX-DR4: Implement SkillTreeCanvas component (PixiJS v8 WebGL) — pan (mouse drag), zoom (scroll wheel), hover tooltip trigger, click allocate/deallocate, keyboard navigation (Tab follows connection graph, arrow keys within cluster, Enter to allocate); node states: allocated (gold filled circle), available (blue-grey ring), locked (dark X-pattern), AI-suggested (purple ring + glow); partial-import amber flag state; NFR17 compliance (shape + fill + color, never color alone)
UX-DR5: Implement SuggestionCard component — rank badge, change description (from/to nodes + points), three-axis delta scores in JetBrains Mono with directional color (data-positive/negative/neutral), plain-language explanation, Preview/Apply/Skip action buttons; states: Default (collapsed), Expanded (full explanation), Previewing (tree after-state shown), Applied (checkmark + greyed); screen reader announces "[Rank N] Suggestion: [desc]. Damage: [before]→[after]. Survivability: [before]→[after]. Speed: [before]→[after]. [Explanation]"
UX-DR6: Implement ScoreGauge component — Damage/Survivability/Speed scores each with JetBrains Mono value + color-coded mini bar (data-damage/surv/speed colors), composite score, hover breakdown tooltip, comparison mode showing baseline vs. preview state simultaneously
UX-DR7: Implement BuildImportInput component — text input that begins parsing on paste (no submit button), progressive node resolution counter ("Resolving nodes: 340/342"), partial-import warning state (amber indicator), error state (red border + message), clipboard auto-detection on app focus (offer "Paste build from clipboard?" banner)
UX-DR8: Implement NodeTooltip component — node name, point cost, current allocation, effect description, tags (damage types, ailments), connection requirements; triggered by hover AND keyboard focus; AI-suggested variant has purple accent border + "Suggested" label; content available to screen readers via aria-describedby
UX-DR9: Implement ContextPanel with GearInput, SkillInput, IdolInput — searchable structured forms for gear items (item name auto-fill + affix selector from game data), active skills (skill name auto-fill from class skills), idol slots (type + modifiers auto-fill from game data); 200ms debounce on search; Empty/Partial/Complete states; structured as form with labelled fieldsets per section
UX-DR10: Implement StatusBar component — API connectivity status indicator (green online / amber offline with text "Offline"), current game data version + last-updated date, reactive to `app:connectivity-changed` event; Optimize button disables with tooltip per FR40 when offline
UX-DR11: Implement button hierarchy with Tailwind tokens — Primary (accent-gold fill, bg-base text), Secondary (accent-gold outline, accent-gold text), Ghost (no border, text-muted), Destructive (data-negative outline after confirmation), Disabled (dimmed, no interaction); rule: never two Primary buttons simultaneously; Optimize is always the primary CTA
UX-DR12: Implement global keyboard shortcuts — O: focus Optimize button; I: focus import input; Ctrl+S: save current build; Escape: close expanded suggestion / clear tree preview; suggestion list: Up/Down arrows navigate cards, Enter expand/apply, P preview, S skip
UX-DR13: Implement AI loading state — animated "Analyzing..." with pulsing waveform indicator in right panel (never full-screen spinner), "This usually takes 20–30 seconds" message, partial suggestions stream and render incrementally as they arrive from Tauri events; right panel error state for API failures per NFR11
UX-DR14: Implement empty and edge-case states — empty tree: low-opacity class art background + centered "Paste Build Code" / "Create New Build" CTAs; empty suggestion list: goal selector + prominent Optimize CTA + prompt text; no-suggestions-found: "Your build is well-optimized for [goal]" + goal-switch option; partial import: amber-flagged unresolved nodes + toast + "See details" modal listing node IDs
UX-DR15: Implement accessibility infrastructure — axe-core integrated in dev/CI build (CI fails on any axe error); aria-live="polite" on import progress region, AI loading status region, suggestion list container; aria-live="assertive" on critical error regions; "Skip to tree" + "Skip to suggestions" skip links (hidden until focused); prefers-reduced-motion support disables all animated transitions; focus ring: 2px solid accent-gold on all interactive elements (never outline:none without replacement)
UX-DR16: Implement panel collapse system — chevron button at inner edge of each panel, panel collapses to 48px icon rail with icon tooltips for primary actions; tree canvas uses ResizeObserver to re-fit PixiJS viewport on container resize without re-rendering node graph data

### FR Coverage Map

FR1: Epic 2 — User creates new build via class/mastery selector
FR2: Epic 2 — User imports build by pasting a build code string
FR3: Epic 2 — System shows per-node resolution status on partial import
FR4: Epic 2 — User saves build locally with a name (SQLite persistence)
FR5: Epic 2 — User loads previously saved build from saved list
FR6: Epic 2 — User renames a saved build
FR7: Epic 2 — User deletes a saved build (with confirmation)
FR8: Epic 1 — User views full passive skill tree for selected class/mastery
FR9: Epic 1 — User views skill-specific trees via tab navigation per active skill
FR10: Epic 1 — User allocates/deallocates nodes interactively via click
FR11: Epic 1 — User pans (drag) and zooms (scroll) the tree canvas
FR12: Epic 1 — User views node details on hover via NodeTooltip
FR13: Epic 1 — System visually distinguishes all 4 node states (shape + fill + color)
FR14: Epic 3 — User selects optimization goal (damage/survivability/speed/balanced)
FR15: Epic 3 — User triggers AI optimization analysis
FR16: Epic 3 — System generates ranked node-change suggestion list
FR17: Epic 3 — System calculates and displays composite score (damage, survivability, speed)
FR18: Epic 4 — Context panel data (gear, skills, idols) included in AI optimization request
FR19: Epic 3 — System excludes and flags nodes with missing game data
FR20: Epic 3 — User views ranked suggestion list ordered by goal impact
FR21: Epic 3 — User views exact node change per suggestion (from/to nodes, points)
FR22: Epic 3 — User views before/after deltas for all 3 scoring axes per suggestion
FR23: Epic 3 — User views plain-language technical explanation citing specific node interactions
FR24: Epic 3 — User previews visual effect of suggestion on tree before applying
FR25: Epic 3 — User accepts or dismisses individual suggestions
FR26: Epic 3 — User re-runs optimization after applying changes
FR27: Epic 4 — User inputs gear items via searchable form with game-data auto-fill
FR28: Epic 4 — User inputs active skill selections via searchable skill selector
FR29: Epic 4 — User inputs idol slot contents via searchable form with game-data auto-fill
FR31: Epic 1 — System loads all 5 classes and 15 masteries on startup (Story 1.3b)
FR32: Epic 1 — System checks for updated game data on launch
FR33: Epic 1 — User can manually trigger game data update
FR34: Epic 1 — System displays current game data version and last-updated date
FR35: Epic 1 — System displays staleness warning when local data is behind
FR36: Epic 1 — User can acknowledge staleness warning and continue with outdated data
FR37: Epic 5 — User configures Claude API key in settings (stored in OS keychain)
FR38: Epic 5 — System displays API connectivity status persistently in StatusBar
FR39: Epic 5 — User accesses skill tree visualizer and saved builds when offline
FR40: Epic 5 — AI features disabled offline with prescribed message
FR41: Epic 5 — App checks for updates on launch and notifies user
FR42: Epic 5 — User installs app updates from within the application

## Epic List

### Epic 1: Foundation & Interactive Skill Tree
Users can launch the app, select any of the 5 classes and 15 masteries, and interact with a full-fidelity, 60fps skill tree — panning, zooming, hovering for node details, and allocating/deallocating nodes. Game data stays current via automatic staleness detection and manual update triggering.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13, FR31, FR32, FR33, FR34, FR35, FR36
**NFRs covered:** NFR1, NFR2, NFR5
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR8, UX-DR11, UX-DR14 (empty tree state), UX-DR16

### Epic 2: Build Management
Users can create builds from scratch with a class/mastery selector, import existing builds by pasting a build code string (with graceful partial-import handling for unrecognized nodes), and save, load, rename, and delete multiple builds locally with full persistence across sessions.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7
**NFRs covered:** NFR3
**UX-DRs covered:** UX-DR7 (BuildImportInput), UX-DR14 (partial import states)

### Epic 3: AI Optimization Engine
Users can select an optimization goal, trigger AI analysis of their skill tree, and receive a ranked suggestion list — each with the exact node change, quantified before/after deltas across all three scoring axes, a plain-language technical explanation citing specific node interactions, and a visual tree preview. Users can accept, dismiss, or re-run optimization iteratively.
**FRs covered:** FR14, FR15, FR16, FR17, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26
**NFRs covered:** NFR4, NFR6, NFR11, NFR12
**UX-DRs covered:** UX-DR5 (SuggestionCard), UX-DR6 (ScoreGauge), UX-DR13 (AI loading state), UX-DR14 (empty/no-suggestions states)

**Dependency note:** Context Panel data (Epic 4 — gear, skills, idols) improves suggestion relevance when populated. Epic 3 ships without Epic 4, meaning initial AI suggestions are based on skill tree nodes only. This is an intentional sequencing trade-off: the core value proposition is validated before the context enrichment layer is built. The UI discloses this limitation inline (Story 3.3). Community alpha release should target Epic 4 completion, not Epic 3 completion, to maximise first-impression quality.

**Story implementation order within Epic 3:**
- If **Path B** (app-computed deltas) was chosen for DECISION-1: Story 3.1 (Scoring Engine) is a HARD PREREQUISITE for Story 3.2 — implement in that order.
- If **Path A** (Claude-computed deltas) was chosen: Stories 3.1 and 3.2 can proceed in parallel.
- Story 3.3 (Goal Selector + Trigger) depends on Story 3.2 (streaming backend) — do not build the UI trigger before the backend exists.
- Stories 3.4 and 3.5 depend on both 3.2 and 3.3.

### Epic 4: Context Panel
Users can input their gear, active skills, and idol data into a searchable structured context panel. This data is passed to the AI optimization engine so suggestions reflect the character's complete build state — not skill tree nodes in isolation.
**FRs covered:** FR18, FR27, FR28, FR29
**UX-DRs covered:** UX-DR9 (ContextPanel, GearInput, SkillInput, IdolInput)

### Epic 5: Application Infrastructure & Reliability
Users can configure their Claude API key securely (stored in OS keychain, never exposed to frontend JS), the app handles offline mode gracefully with clear messaging, API and network failures surface with retry options, data staleness never blocks launch, and the app notifies and installs updates from within.
**FRs covered:** FR37, FR38, FR39, FR40, FR41, FR42
**NFRs covered:** NFR7, NFR8, NFR9, NFR10, NFR13, NFR14
**UX-DRs covered:** UX-DR10 (StatusBar), UX-DR11 (settings view/ApiKeyInput)

### Epic 6: Accessibility & Polish
All users — including those using keyboard-only navigation or screen readers — can complete every workflow. The app passes WCAG 2.1 AA compliance with axe-core CI enforcement, has global keyboard shortcuts for all primary actions, proper focus management, skip links, reduced-motion support, and readable tooltips at system font scale.
**NFRs covered:** NFR15, NFR16, NFR17
**UX-DRs covered:** UX-DR12 (keyboard shortcuts), UX-DR15 (accessibility infrastructure)

---

<!-- STORIES BEGIN BELOW — Generated by step-03 -->

## Epic 1: Foundation & Interactive Skill Tree

Users can launch the app, select any of the 5 classes and 15 masteries, and interact with a full-fidelity, 60fps skill tree — panning, zooming, hovering for node details, and allocating/deallocating nodes. Game data stays current via automatic staleness detection and manual update triggering.

### Story 1.1: App Foundation — Tauri + React + Design System Scaffold

As an advanced Last Epoch player,
I want the application to launch with a clean dark interface using the Last Epoch aesthetic,
So that the tool feels like a polished, purpose-built companion app from the moment I open it.

**Acceptance Criteria:**

**Given** the application is installed
**When** the user launches LEBOv2
**Then** the app opens to the three-column Command Center layout (left panel 260px, center tree canvas flex-grow, right panel 320px) with app header and status bar rows
**And** all background surfaces use the defined design tokens: bg-base (#0a0a0b), bg-surface (#141417), bg-elevated (#1c1c21)
**And** all text uses Inter variable font at the defined type scale (Body 14px, Label 12px, Heading 18px)
**And** all numeric values use JetBrains Mono font at the defined data scale
**And** the app renders at minimum 1280×720 resolution without layout breakage

**Given** the Tauri project is initialized with `pnpm create tauri-app@latest lebo --template react-ts`
**When** the developer runs `pnpm tauri dev`
**Then** the development build compiles and opens the Tauri window without errors
**And** the following dependencies are installed and configured: Tailwind CSS v4 (with full LEBOv2 token system in tailwind.config.ts), @headlessui/react, PixiJS v8 + @pixi/react, Zustand v5, tauri-plugin-sql v2, tauri-plugin-stronghold v2, tauri-plugin-http v2, tauri-plugin-updater v2, tauri-plugin-store v2, Vitest, react-hot-toast
**And** TypeScript strict mode is enabled in tsconfig.json
**And** the project structure matches the architecture specification: `src/features/`, `src/shared/stores/`, `src/shared/utils/`, `src-tauri/src/commands/`, `src-tauri/src/services/`, `src-tauri/src/models/`

**Given** the app is running
**When** the user resizes the window
**Then** the left and right panels maintain fixed widths, the center canvas expands/contracts fluidly, and no layout elements overflow or clip
**And** the app header and status bar remain pinned at the top and bottom of the viewport

**Dev Notes:**
- Initialize with: `pnpm create tauri-app@latest lebo --template react-ts`
- Set up Tailwind CSS v4 with complete token system from UX-DR1 (all 18 semantic color tokens + typography tokens)
- Set up Inter and JetBrains Mono variable fonts in `src/assets/fonts/` and global CSS
- Set up all four Zustand stores as stubs: `src/shared/stores/buildStore.ts`, `gameDataStore.ts`, `optimizationStore.ts`, `appStore.ts`
- Set up `src/shared/utils/invokeCommand.ts` wrapper and `src/shared/types/errors.ts` with full AppError type and all ErrorType variants
- Center tree canvas renders a placeholder ("Tree will render here") until Story 1.2 and 1.4
- Left and right panels render empty placeholder sections — real content added in later stories
- No `index.ts` barrel files anywhere in `src/`
- **Panel collapse system (UX-DR16):** Implement `PanelCollapseToggle.tsx` (chevron button at inner edge of each panel); panels collapse to 48px icon rail showing icon tooltips for primary actions; `useAppStore.activePanel` tracks collapse state; the tree canvas container uses `ResizeObserver` to notify the PixiJS renderer of container size changes (actual PixiJS viewport resize wired in Story 1.2)

---

### Story 1.2: PixiJS WebGL Renderer Spike — 60fps Validation Gate

As an advanced Last Epoch player,
I want the skill tree canvas to render at 60fps even on mid-range hardware,
So that interacting with nodes during pan, zoom, and hover feels completely fluid — not laggy or stuttering.

**Acceptance Criteria:**

**Given** the PixiJS v8 WebGL renderer spike is implemented with mock skill tree data (at minimum: 500 circular nodes with connections, representing a large Last Epoch passive tree)
**When** the user performs pan (drag), zoom (scroll wheel), and rapid cursor movement over nodes
**Then** the frame rate measures at ≥ 60fps throughout on the target hardware profile (Intel Core i5, integrated Intel Iris/UHD graphics, 8GB RAM)
**And** no sustained frame drops below 45fps occur during any interaction lasting > 5 seconds

**Given** the PixiJS application is mounted inside `src/features/skill-tree/SkillTreeCanvas.tsx`
**When** the component renders
**Then** `SkillTreeCanvas` receives all data exclusively via props (`treeData`, `highlightedNodes`, `allocatedNodes`) — no Zustand store imports appear inside the SkillTreeCanvas component file or inside `pixiRenderer.ts`
**And** the PixiJS Application instance is created on mount and destroyed on unmount without memory leaks

**Given** the renderer handles 800 nodes (full-size tree scenario)
**When** the user zooms from 30% to 150% and back
**Then** all nodes remain correctly positioned relative to each other throughout the zoom gesture
**And** frame rate does not drop below 45fps during the zoom

**Dev Notes:**
- This story is a GATE — no other skill tree feature story (1.3 onward) may begin until this spike passes its 60fps benchmark
- All PixiJS rendering logic (node drawing, connection drawing, event handling) lives in `src/features/skill-tree/pixiRenderer.ts` (pure PixiJS, no React)
- `SkillTreeCanvas.tsx` is the thin React wrapper that mounts the PixiJS Application and bridges props to the renderer — it fires callbacks (`onNodeClick`, `onNodeHover`) back to parent
- **Before writing mock data:** Query the game data source (Story 1.3 research) to determine the actual maximum passive tree node count for any single class/mastery. If Story 1.3 is not yet complete, use a conservative estimate of 1,200 rendered objects (nodes + connection edges + overlay states) as the spike target. The spike MUST be re-run if real node counts exceed what was tested.
- Mock tree data must represent structural complexity of a real Last Epoch passive tree: circular nodes of 3 size variants, directed connection edges, multi-tier prerequisite chains, and at least two simultaneously active glow/highlight overlay states — not bare circles on a blank canvas
- Document FPS benchmark results AND actual real-world node count in `docs/pixi-spike-report.md`
- If PixiJS v8 fails to hit 60fps on target hardware: evaluate Konva.js Canvas 2D as fallback and re-spike before proceeding

---

### Story 1.3a: Game Data Source Research Spike

As an advanced Last Epoch player,
I want confidence that the app has a reliable, compliant source of Last Epoch game data,
So that skill tree and node data is accurate and the team can commit to building the data pipeline.

**⚠️ SPIKE STORY — time-boxed to 2–3 days. Output is documentation only; no implementation code is produced. All subsequent game data implementation (Story 1.3b) is blocked until this spike is complete.**

**Acceptance Criteria:**

**Given** the research spike is executed
**When** the spike is complete
**Then** `docs/game-data-source.md` exists and documents: the chosen community data source, its URL, the data format spec (JSON structure, field names, node ID scheme), update frequency, and terms-of-service compliance assessment

**Given** a viable compliant source is found
**When** the spike concludes
**Then** `docs/game-data-source.md` includes the maximum passive tree node count for any single class/mastery (required to scope the PixiJS spike mock data in Story 1.2)
**And** the document confirms whether idol, gear, and active skill data are available in the same source (required for Stories 3.1, 4.1, 4.2)

**Given** no viable compliant source is found
**When** the spike concludes
**Then** `docs/game-data-source.md` documents the gap and the chosen fallback path: (a) scraper with explicit ToS approval from site operator, (b) community contributors for a manually curated dataset, or (c) scope reduction to one class as proof-of-concept — with a go/no-go decision from the team before Story 1.3b begins

**Dev Notes:**
- Sources to evaluate: lastepochtools.com API, community GitHub repositories, community-maintained JSON exports (Last Epoch Modding community, community Discord data bots)
- ToS compliance: read the terms of service of each source; document rate limits, attribution requirements, and any restrictions on redistribution
- **This spike gates:** Story 1.3b, Story 1.4 (tree rendering), Story 1.5 (node interaction), Story 2.1 (build parser), Story 3.1 (scoring engine), Story 3.2 (Claude prompt), and Story 4.1 (context panel auto-fill)
- If Story 1.2 (PixiJS spike) has not yet been completed when this spike starts, use 1,200 rendered objects as the provisional node count target for Story 1.2 mock data — update Story 1.2 if real counts exceed this after the research is done
- No code is written in this story — the output is `docs/game-data-source.md` only

---

### Story 1.3b: Game Data Pipeline — Implementation

As an advanced Last Epoch player,
I want the app to load the complete skill tree and passive tree data for all 5 classes and 15 masteries at startup,
So that I can view any class tree without waiting for on-demand network requests during my session.

**Prerequisite: Story 1.3a must be complete and `docs/game-data-source.md` must exist before this story begins.**

**Acceptance Criteria:**

**Given** the game data pipeline is implemented
**When** the application launches for the first time after install
**Then** all 5 classes (Sentinel, Mage, Primalist, Acolyte, Rogue) and their 15 masteries load successfully
**And** the load completes within ≤ 10 seconds (NFR5)
**And** the loaded data includes for each node: node ID, name, point cost, max points, prerequisite node IDs, effect description, tags, and position coordinates for tree layout

**Given** game data files are present in the app data directory
**When** the user launches the app with no network connection
**Then** game data loads successfully from local cache
**And** no network error is shown for game data (staleness detection is separate and non-blocking)

**Given** `useGameDataStore` is populated
**When** any feature reads `useGameDataStore.gameData`
**Then** all class and mastery data is accessible by classId and masteryId
**And** the data follows the architecture format: versioned JSON per class in app data directory; `manifest.json` tracking `gameVersion`, `dataVersion`, `generatedAt`, `classes[]`

**Dev Notes:**
- Implement `src-tauri/src/services/game_data_service.rs` — fetches from the source documented in `docs/game-data-source.md` via `tauri-plugin-http`; caches locally to app data directory
- Implement `src-tauri/src/commands/game_data_commands.rs`: `load_game_data`, `check_data_version`, `update_game_data`
- Implement `src/features/game-data/gameDataLoader.ts` — calls Tauri commands via `invokeCommand()`, populates `useGameDataStore`
- Bundle a baseline data snapshot in the installer for offline-first first launch
- All Tauri HTTP calls use `tauri-plugin-http` with an allowlist — only the community data source URL is permitted
- **This implementation unblocks:** Story 1.4, Story 1.5, Story 2.1, Story 3.1, Story 3.2, Story 4.1

---

### Story 1.4: Passive Skill Tree Rendering

As an advanced Last Epoch player,
I want to select a class and mastery and immediately see their full passive skill tree rendered in the canvas,
So that I can visually explore all available nodes and their connections before building.

**Acceptance Criteria:**

**Given** game data is loaded and the user selects a class and mastery via the left panel selector
**When** the mastery selection is confirmed
**Then** the full passive skill tree renders in the center canvas within ≤ 5 seconds
**And** all nodes appear at their correct relative positions with connection edges drawn between them

**Given** a passive skill tree is rendered
**When** the user inspects any node visually
**Then** each node's state is communicated using shape + fill + color (NFR17 — never color alone):
- Allocated: gold filled circle
- Available (allocatable): blue-grey ring
- Locked (prerequisite not met): dark background with X-pattern fill
- AI-suggested: purple ring + glow (wired up in Epic 3)

**Given** the class/mastery selector in the left panel
**When** the user opens the class selector
**Then** all 5 classes are listed: Sentinel, Mage, Primalist, Acolyte, Rogue
**And** selecting a class reveals that class's 3 mastery options
**And** selecting a mastery triggers tree rendering for that mastery's passive tree

**Given** no build has been loaded or created yet
**When** the app first opens
**Then** the empty tree state appears in the center canvas: low-opacity class art background with centered CTA "Import a build or start fresh" and two buttons: "Paste Build Code" / "Create New Build"

**Dev Notes:**
- Class/mastery selector uses Headless UI Listbox components in the left panel
- Tree layout coordinates come from game data node position fields; PixiJS renderer places nodes at those coordinates
- `SkillTreeCanvas` receives props: `treeData` (nodes + edges for selected class/mastery), `allocatedNodes: Record<NodeId, number>` (empty for new builds), `highlightedNodes` (empty Set initially)
- A thin wrapper component in `src/features/skill-tree/` reads from `useBuildStore` and `useGameDataStore` to construct these props — `SkillTreeCanvas` itself has no store access
- Class art assets go in `src/assets/images/class-art/`

---

### Story 1.5: Interactive Tree Controls — Allocation, Pan/Zoom, NodeTooltip

As an advanced Last Epoch player,
I want to click nodes to allocate or deallocate skill points, pan and zoom the tree freely, and hover over any node to instantly see its details,
So that I can build and explore my skill tree without consulting external resources for basic node information.

**Acceptance Criteria:**

**Given** a passive skill tree is rendered with unallocated nodes
**When** the user clicks an available (not locked) node
**Then** the node transitions to allocated state (gold filled circle) within one render frame
**And** `useBuildStore.applyNodeChange()` updates `activeBuild.nodeAllocations`
**And** allocating a node that satisfies the prerequisite for a neighbor causes that neighbor to transition from locked to available state

**Given** the user clicks an allocated node
**When** the deallocation attempt fires
**Then** if no currently-allocated descendants depend on this node, it deallocates successfully
**And** if removal would orphan downstream allocations, a tooltip appears on the node: "Cannot remove — [N] nodes depend on this" and the click is ignored

**Given** the user holds the left mouse button and drags on the canvas
**When** the drag is in progress
**Then** the tree pans smoothly in the direction of drag maintaining 60fps (NFR1)
**And** when the user scrolls the mouse wheel on the canvas
**Then** the tree zooms in/out centered on the cursor position at 60fps

**Given** the user moves the cursor over any node
**When** the cursor enters the node's hit area
**Then** a NodeTooltip appears within 100ms showing: node name, point cost, current allocation, effect description, tags, and connection requirements
**And** the tooltip dismisses when the cursor leaves the node
**And** the tooltip repositions if it would clip outside the viewport
**And** the tooltip also appears when the node receives keyboard focus (NFR15)

**Dev Notes:**
- `useSkillTree.ts` manages tree interaction state (hover node ID, focused node ID, pan state, zoom level)
- `NodeTooltip.tsx` is portal-mounted (renders outside the PixiJS canvas DOM element) to avoid canvas clipping
- PixiJS fires `onNodeClick`, `onNodeHover`, `onNodeLeave`, `onNodeFocus` callbacks to the React wrapper via props — no store access inside pixiRenderer.ts
- Session undo stack: `useBuildStore.undoStack` stores up to 10 `BuildState` snapshots; Ctrl+Z calls `undoNodeChange()`
- **`applyNodeChange()` guards:** (1) clamp allocated points: `newPoints = Math.max(0, Math.min(current + delta, gameData.nodes[id].maxPoints))` — reject silently if this produces no change; (2) validate prerequisites before allocating: if the node's prerequisite nodes are not allocated, surface a tooltip error and abort. These guards apply to BOTH user clicks AND AI-applied suggestions, preventing impossible build states from entering `nodeAllocations`.

---

### Story 1.6: Active Skill Tree Tab Navigation

As an advanced Last Epoch player,
I want to switch between my passive tree and the skill trees of each of my active skills using tabs at the top of the canvas,
So that I can view and interact with my complete build across all tree types in one interface.

**Acceptance Criteria:**

**Given** a build has one or more active skills set in the context panel
**When** the user views the skill tree canvas
**Then** tabs appear at the top of the canvas: "Passive Tree" plus one tab per active skill (labeled with the skill name)
**And** the selected tab has a gold underline and primary text weight; unselected tabs show muted text

**Given** the user clicks an active skill tab
**When** the tab selection changes
**Then** the canvas switches to render the skill-specific tree for that active skill within ≤ 2 seconds (tree data already loaded from game data pipeline)

**Given** no active skills have been set in the context panel
**When** the user views the canvas header
**Then** only the "Passive Tree" tab is visible — no empty placeholder skill tabs

**Dev Notes:**
- Tab navigation uses Headless UI Tabs component styled with design tokens
- `SkillTreeCanvas` receives different `treeData` prop depending on which tab is active — same component, different data input
- Active skill list for tab display sourced from `useBuildStore.activeBuild.contextData.skills` (set in Epic 4, Story 4.2)
- For this story: wire up tab navigation with hardcoded stub skill data to verify tab switching works; real context panel integration happens in Epic 4

---

### Story 1.7: Game Data Versioning & Update UX

As an advanced Last Epoch player,
I want to know when my skill tree data is outdated and be able to update it with one click,
So that I can be confident my builds reflect the current game version and my optimization suggestions are accurate.

**Acceptance Criteria:**

**Given** the app launches with internet connectivity
**When** the launch-time `check_data_version` command runs
**Then** the local manifest's `gameVersion` is compared against the remote manifest's latest version
**And** if local data is behind: an amber staleness banner appears above the tree canvas: "Game data is [N version(s)] behind. Suggestions may be inaccurate. [Update Now]"
**And** the status bar shows the current data version and last-updated date (e.g., "Data: v1.2.3 — 2026-04-15")

**Given** game data is up to date
**When** the user views the status bar
**Then** the data version and last-updated date are displayed without any staleness warning

**Given** a staleness warning is displayed
**When** the user clicks "Update Now" (FR33 — manual trigger)
**Then** the system fetches the latest game data files from the remote source
**And** a progress indicator shows while downloading
**And** on success: the staleness banner clears, the version display updates, and `useGameDataStore` is refreshed

**Given** the data update download fails
**When** the update attempt completes with failure
**Then** an error message identifies the failure type with a Retry option
**And** the app continues operating with the existing local data — no crash or data loss

**Given** a staleness warning is shown
**When** the user clicks "Continue with current data" or dismisses the banner
**Then** the banner dismisses for this session and the user proceeds normally
**And** the status bar continues showing the current data version so staleness remains visible (FR36)

**Dev Notes:**
- `DataStalenessBar.tsx` in `src/features/game-data/` — renders amber banner, wired to `useGameDataStore.isStale`
- `StatusBar.tsx` (shared) displays version and date from `useGameDataStore.dataVersion` and `dataUpdatedAt`
- `check_data_version` Tauri command fetches remote `manifest.json` via `tauri-plugin-http`; compares `gameVersion` fields
- All data download calls originate from `game_data_service.rs` — never from frontend fetch()
- **Staleness banner dismissed state:** add `useGameDataStore.stalenessAcknowledged: boolean` (default false). `DataStalenessBar` only renders when `isStale === true && stalenessAcknowledged === false`. The dismiss action sets `stalenessAcknowledged = true`. Without this flag, `isStale` remaining true causes the banner to reappear on any component re-mount within the same session.
- **Game data update lock during optimization:** the "Update Now" trigger must check `useOptimizationStore.isOptimizing`; if true, defer the update and show a toast "Game data update queued — will apply after optimization completes." Updating game data while `scoringEngine.ts` is computing deltas mid-stream produces inconsistent suggestion scores.

---

## Epic 2: Build Management

Users can create builds from scratch with a class/mastery selector, import existing builds by pasting a build code string (with graceful partial-import handling for unrecognized nodes), and save, load, rename, and delete multiple builds locally with full persistence across sessions.

### Story 2.1: Build Code Import — Happy Path

As an advanced Last Epoch player,
I want to paste my build code from lastepochtools.com and immediately see my full skill tree rendered,
So that I can skip manual node-by-node entry and jump straight to analyzing my actual in-game character state.

**Acceptance Criteria:**

**Given** the user has a valid Last Epoch build code string
**When** the user pastes the build code into the `BuildImportInput` field (paste event — no submit button required)
**Then** parsing begins immediately
**And** a progressive counter is displayed: "Resolving nodes: 0/N..."
**And** within ≤ 3 seconds (NFR3), the full passive skill tree renders with all recognized nodes in their allocated state
**And** the build's class and mastery are auto-detected and set on `useBuildStore.activeBuild`

**Given** the app is in focus and the user has a build code in their clipboard
**When** the app window receives focus
**Then** a banner offer appears: "Build code detected in clipboard. Import?" with "Import" and "Dismiss" buttons
**And** clicking "Import" triggers the same parse and render flow as manual paste

**Given** the build code is from the current game version with no unknown nodes
**When** parsing completes
**Then** all nodes resolve successfully with no error or warning state
**And** the build is named from the class/mastery (e.g., "Forge Guard") — editable by the user after import

**Dev Notes:**
- **HARD GATE:** Audit the exact format of Last Epoch build code strings from lastepochtools.com (and any other community tools that export build codes). Document format spec — encoding scheme, field layout, node ID representation — in `docs/build-code-format.md`. This document must exist before implementing `buildParser.ts`.
- **Contingency if format is undocumented or proprietary:** (a) Contact lastepochtools.com maintainers to request documentation or partnership, (b) implement "manual build entry" (node-by-node allocation via Story 2.3's UI) as the primary onboarding path and treat build code import as Post-MVP, (c) do not reverse-engineer a production app's format without explicit permission — creates a fragile parser that breaks on every app update.
- `buildParser.ts` must be implemented as a versioned adapter: `{ formatVersion: string, parse: (code: string) => ParseResult }` so format versions can be swapped without touching callers.
- Implement `src/features/build-manager/buildParser.ts` — parses build code string into `{ buildState: BuildState, report: ImportResolutionReport }`
- Implement `src/features/build-manager/nodeResolver.ts` — resolves node IDs against `useGameDataStore.gameData`
- `BuildImportInput.tsx` monitors paste events and clipboard (via Tauri clipboard plugin or browser Clipboard API)
- `useBuildStore.setActiveBuild(parsedBuild)` sets active build; `SkillTreeCanvas` re-renders via its props wrapper
- NFR3: parsing and rendering must complete in ≤ 3 seconds for a full build
- **Clipboard deduplication:** store a hash of the last-offered clipboard content in session state; on each app-focus event, skip showing the import banner if the clipboard hash is unchanged since the last offer or dismissal — prevents the banner reappearing on every alt-tab with the same content

---

### Story 2.2: Partial Build Import & Error Handling

As an advanced Last Epoch player,
I want to see which nodes couldn't be resolved when I import a build from an older patch,
So that I understand exactly what's missing and can still optimize the resolved portion of my build.

**Acceptance Criteria:**

**Given** the user imports a build code where some node IDs are not found in current game data
**When** parsing completes
**Then** the tree renders with all resolved nodes in their correct allocation state
**And** unresolved nodes are visually flagged with an amber indicator using shape + overlay (not color alone — NFR17)
**And** a toast notification appears: "[N] node(s) not found — may be from an older patch. [See details]"

**Given** the user clicks "See details" from the toast
**When** the details modal opens
**Then** a modal lists each unresolved node ID with: "Node [ID] not found in current data (v[X])"
**And** a note reads: "These nodes were excluded from optimization suggestions"

**Given** a partial build is loaded and the user triggers optimization (Epic 3)
**When** the AI optimization request is built
**Then** the request payload includes only the resolved nodes
**And** the suggestion response includes a disclaimer: "Optimization based on [M] of [N] nodes — [K] nodes excluded due to missing data" (FR19)

**Given** the user pastes a completely invalid build code (not parseable at all)
**When** parsing fails
**Then** the `BuildImportInput` field shows a red border and inline message: "Could not parse build code. Check the format and try again."
**And** no partial tree is rendered and no toast appears

**Dev Notes:**
- `buildParser.ts` returns `{ buildState: BuildState | null, report: ImportResolutionReport }` where `ImportResolutionReport = { resolved: NodeId[], unresolved: NodeId[], totalNodes: number }`
- Amber flag state: passed as a special `unresolvedNodes: Set<NodeId>` prop to `SkillTreeCanvas`; pixiRenderer draws an amber overlay shape on those nodes
- Details modal uses Headless UI Dialog component
- **Unresolved node isolation:** unresolved node IDs must NOT be stored in `BuildState.nodeAllocations` — store them only in `ImportResolutionReport.unresolved`. Keeping them out of `nodeAllocations` ensures `scoringEngine.ts` and the Claude prompt never receive invalid node IDs. The amber overlay in `SkillTreeCanvas` is driven by the separate `unresolvedNodes` prop, not by a sentinel value in `nodeAllocations`.

---

### Story 2.3: New Build Creator — Class & Mastery Selector

As an advanced Last Epoch player,
I want to create a blank build by selecting my class and mastery,
So that I can theory-craft a new character from scratch without needing an existing build code.

**Acceptance Criteria:**

**Given** the user clicks "Create New Build" from the empty state CTAs or a button in the left panel
**When** the new build flow opens
**Then** all 5 classes are displayed as selectable options: Sentinel, Mage, Primalist, Acolyte, Rogue

**Given** the user selects a class
**When** the class is selected
**Then** the 3 masteries for that class are displayed as selectable options

**Given** the user selects a mastery and confirms
**When** the selection is completed
**Then** a blank passive tree for the selected mastery renders with all nodes in unallocated state
**And** a new `BuildState` is created in `useBuildStore.activeBuild`: `{ schemaVersion: 1, id: uuidv4(), name: '[MasteryName]', classId, masteryId, nodeAllocations: {}, createdAt, updatedAt }`
**And** the user can immediately begin clicking nodes to allocate skill points (Story 1.5 behavior applies)

**Given** the user is mid-selection and changes their mind
**When** the user navigates back to class selection
**Then** they can select a different class without any error state

**Dev Notes:**
- Class/mastery selector uses Headless UI RadioGroup or Listbox — styled with design tokens
- The build name defaults to the mastery name and is editable inline in the left panel header
- This story does NOT include saving the build — that is Story 2.4

---

### Story 2.4: Build Persistence — Save, Load, Rename, Delete

As an advanced Last Epoch player,
I want to save my builds locally, load them between sessions, rename them, and delete ones I no longer need,
So that I can maintain a library of character builds and return to optimize them over multiple sessions.

**Acceptance Criteria:**

**Given** the user has an active build loaded
**When** the user clicks "Save Build" or presses `Ctrl+S`
**Then** the build is persisted to SQLite in the app data directory under the current build name
**And** a toast confirms "Build saved as [name]" (auto-dismiss 3 seconds)
**And** if the build has no name, an inline prompt asks the user to enter one before saving

**Given** one or more builds have been saved
**When** the user opens the "Saved Builds" list in the left panel
**Then** all saved builds are listed with: name, class, mastery, and last-saved date

**Given** the user clicks a saved build in the list
**When** the build loads
**Then** the active build switches to the selected build and the tree re-renders with that build's node allocations

**Given** a saved build is in the list
**When** the user accesses the context menu for that build item (right-click or kebab menu)
**Then** "Rename" and "Delete" options are available

**Given** the user selects "Rename"
**When** the rename is confirmed with a new name
**Then** the build's name updates in SQLite and immediately reflects in the saved builds list

**Given** the user selects "Delete"
**When** the delete action is initiated
**Then** a confirmation dialog appears: "Delete '[build name]'? This cannot be undone."
**And** confirming removes the build from SQLite and the list
**And** canceling returns to the list with no changes

**Given** the user relaunches the app after a previous session with saved builds
**When** the app loads and the saved builds list populates
**Then** all previously saved builds appear, correctly restored from SQLite with their names, classes, masteries, and node allocations

**Dev Notes:**
- SQLite schema (migration `src-tauri/src/db/migrations/001_initial.sql`): `CREATE TABLE IF NOT EXISTS builds (id TEXT PRIMARY KEY, name TEXT NOT NULL, class_id TEXT NOT NULL, mastery_id TEXT NOT NULL, schema_version INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);` — `class_id` and `mastery_id` are top-level columns so `load_builds_list` can SELECT them without reading the full `data` blob
- Implement `src-tauri/src/commands/build_commands.rs`: `save_build`, `load_builds_list`, `load_build`, `delete_build`, `rename_build`
  - `load_builds_list`: returns metadata only (id, name, classId, masteryId, created_at, updated_at) — no `data` column; used for sidebar display
  - `load_build(id: String)`: returns full `BuildState` including `data` column; called only when user selects a build to open
- `SavedBuildsList.tsx` in `src/features/build-manager/`
- Confirmation dialog uses Headless UI Dialog
- Auto-save: after every `applyNodeChange()`, trigger a debounced (500ms) `save_build` call ONLY if `useBuildStore.activeBuild.isPersisted === true`
- `isPersisted` is set to `true` only after the first explicit user-triggered save (Ctrl+S or "Save Build" button) — default-named new builds are NOT auto-saved until then
- If the user clicks "Optimize" or attempts to load a different build on an unsaved (`isPersisted === false`) build: show a non-blocking toast "Unsaved build — save it to keep your work? [Save Now]"
- **Debounce race guard:** capture `buildId = activeBuild.id` at debounce start; on fire, check `if (activeBuild.id !== buildId) return` before calling `save_build` — prevents a stale in-flight save from overwriting a different build the user switched to during the debounce window
- **BuildState migration:** `load_build` must call a `migrateBuildState(raw: unknown): BuildState` function before deserializing. If `raw.schemaVersion` is less than the current version, upcast it to the current schema (add missing fields with defaults). Emit a `STORAGE_ERROR` warning (non-fatal) if the version is unrecognized. This prevents undefined-field crashes when loading builds saved by an older app version.

---

## Epic 3: AI Optimization Engine

Users can select an optimization goal, trigger AI analysis of their skill tree, and receive a ranked suggestion list — each with the exact node change, quantified before/after deltas across all three scoring axes, a plain-language technical explanation, and a visual tree preview. Users can accept, dismiss, or re-run optimization iteratively.

### Story 3.1: Scoring Engine Research & Implementation

As an advanced Last Epoch player,
I want to see a numeric score for my build's damage, survivability, and speed,
So that I have a clear baseline to compare against AI suggestions and understand my build's current strengths and weaknesses at a glance.

**Acceptance Criteria:**

**Given** a build is loaded with node allocations
**When** the scoring engine runs
**Then** a `BuildScore { damage: number | null, survivability: number | null, speed: number | null }` is returned
**And** all non-null scores are on a 0–100 integer scale
**And** nodes with missing game data contribute `null` to affected score dimensions (FR19 compliance)

**Given** the `ScoreGauge` component is rendered in the right panel
**When** the user views the scores
**Then** each axis (Damage, Survivability, Speed) shows: a JetBrains Mono numeric value + a color-coded mini bar (data-damage / data-surv / data-speed colors)
**And** a composite summary score is displayed
**And** hovering the gauge shows a breakdown tooltip

**Given** the user applies a node change to the tree
**When** `useBuildStore.applyNodeChange()` fires
**Then** the scoring engine recalculates and `useOptimizationStore.scores` updates within ≤ 100ms (NFR6 — scoring is synchronous on the frontend)

**Dev Notes:**
- **Research task (first):** Research Last Epoch game mechanics relevant to scoring. Map node tags and effect types to scoring axes (e.g., "+% increased damage" tags → damage score, defensive/life nodes → survivability, movement speed nodes → speed). Define weighting formula. Document in `docs/scoring-model.md`. This document must exist before implementing `scoringEngine.ts`.
- `scoringEngine.ts` in `src/features/optimization/` — pure TypeScript function: `calculateScore(build: BuildState, gameData: GameData): BuildScore`
- `ScoreGauge.tsx` in `src/features/optimization/` — receives `baselineScore` and optional `previewScore` props; comparison mode used in Story 3.5
- Vitest unit tests for `scoringEngine.ts` using known build states with expected score ranges
- **Main-thread performance gate:** during the spike, benchmark `calculateScore()` on a full build (all nodes, all contextData populated) on the target hardware profile (Intel i5 + integrated graphics). If wall-clock time exceeds 30ms, move scoring to a Web Worker before Story 3.2 begins — Path B requires `scoringEngine` to run per-suggestion mid-stream, so a slow scorer will block the renderer thread on every streamed suggestion and violate NFR6 (≤100ms UI latency). Document measured time in `docs/scoring-model.md`.

---

### Story 3.2: Claude API Integration — Streaming Foundation

As an advanced Last Epoch player,
I want AI-powered optimization suggestions to stream into the suggestions panel as they're generated,
So that I see results progressively and the wait feels shorter than a 30-second block.

**Acceptance Criteria:**

**Given** a build is loaded and a Claude API key is configured
**When** the user triggers optimization
**Then** the Rust backend calls the Claude API with the current build state, game data context, and selected goal
**And** suggestions stream via Tauri events (`optimization:suggestion-received`) as the Claude API streams its response
**And** `useOptimizationStore` accumulates partial suggestions in real time via `useOptimizationStream.ts`
**And** the full optimization completes within ≤ 30 seconds under normal network conditions (NFR4)

**Given** the Claude API request is in flight
**When** 45 seconds elapse without completion (NFR12)
**Then** the request times out and is cancelled
**And** the user sees: "Request timed out after 45 seconds. Your build was not lost. [Retry]"
**And** build state is intact — no corruption

**Given** the Claude API returns an error (rate limit, 5xx, network failure)
**When** the error occurs
**Then** the right panel shows an inline error identifying the failure type (e.g., "API rate limit reached — wait a moment and retry") with a Retry button (NFR11)
**And** no silent failure — the error is always surfaced visibly

**Given** optimization is running
**When** the user interacts with other UI elements
**Then** input latency remains ≤ 100ms — the renderer thread is never blocked (NFR6)

**Dev Notes:**
- **Research task (first):** Design the Claude API prompt contract. Determine: system prompt content, context format (build state + game data subset + selected goal), expected JSON response schema per suggestion. Document in `docs/claude-prompt-spec.md`. This document must exist before implementing `claude_commands.rs`.
- **NDJSON output is a hard constraint:** The prompt spec MUST require Claude to output one complete JSON suggestion object per line (NDJSON format). This enables robust streaming parsing in `claude_service.rs` without a streaming JSON parser. Include example output in the spec and validate in prompt testing that Claude consistently produces NDJSON — not wrapped in markdown code blocks, not as a JSON array. See Architecture document → IPC & Communication → Streaming Parse Strategy for the Rust-side parsing design.
- **Delta ownership: App (Path B — deterministic).** Claude returns node change specifications only — no delta values. The prompt spec must NOT ask Claude for score deltas.
  - Claude response schema per suggestion: `{ rank, from_node_id, to_node_id, points_change, explanation }`
  - After each suggestion is parsed, `scoringEngine.ts` runs synchronously: compute baseline `BuildScore` → apply the node change → compute post-change `BuildScore` → derive delta
  - `SuggestionResult` type: Claude fields + app-computed `{ delta_damage, delta_survivability, delta_speed }`
  - UX: suggestions may appear with a brief "computing…" placeholder for delta values (typically <50ms if scoring is fast); this is acceptable
  - **Story 3.1 (Scoring Engine) is a HARD PREREQUISITE for this story** — do not implement `claude_commands.rs` until `scoringEngine.ts` is complete and tested
- Implement `src-tauri/src/services/claude_service.rs` — streaming HTTP client to Claude API; emits `optimization:suggestion-received` Tauri events per streamed suggestion
- Implement `src-tauri/src/commands/claude_commands.rs`: `invoke_claude_api(build_state, goal, context) -> Result<(), AppError>`
- Implement `src/shared/hooks/useOptimizationStream.ts` — listens to `optimization:suggestion-received`, `optimization:complete`, `optimization:error` events; populates `useOptimizationStore`
- API key is retrieved from `tauri-plugin-stronghold` in `keychain_service.rs` — never crosses IPC boundary to frontend JS
- `tauri-plugin-http` allowlist includes only the Claude API endpoint
- **NDJSON buffer max size guard:** in `claude_service.rs`, if the accumulation buffer exceeds a defined `MAX_NDJSON_LINE_BYTES` constant (e.g., 64KB) without a `\n` boundary, emit `optimization:error` and abort the stream. Without this guard, a malformed or runaway Claude response causes unbounded memory growth.
- **`useOptimizationStream.ts` cleanup on unmount:** the `useEffect` that registers `optimization:*` event listeners MUST return a cleanup function that calls `unlisten()` on all three listeners AND calls `setIsOptimizing(false)`. If the component unmounts mid-stream (e.g., user navigates to Settings), without cleanup the `isOptimizing` flag never resets and the Optimize button stays permanently stuck in "Analyzing..." state.

---

### Story 3.3: Optimization Goal Selector & Trigger

As an advanced Last Epoch player,
I want to choose what I want to optimize for before triggering analysis,
So that AI suggestions are tailored to my current character goals rather than a generic template.

**Acceptance Criteria:**

**Given** a build is loaded in the right panel
**When** the user views the optimization section
**Then** a goal selector displays four options as a RadioGroup: "Maximize Damage", "Maximize Survivability", "Maximize Speed", "Balanced"
**And** "Balanced" is selected by default on first use
**And** the `ScoreGauge` shows the current build's baseline scores for all three axes so users can see which has the most headroom

**Given** the user selects a goal and clicks "Optimize"
**When** optimization fires
**Then** the "Optimize" button transitions to a loading state (text: "Analyzing...") with a pulsing waveform animation in the right panel — not a full-screen spinner
**And** the message "This usually takes 20–30 seconds" appears below the indicator
**And** `invokeCommand('invoke_claude_api', { build, goal, context })` is called (triggering Story 3.2 streaming)

**Given** no build is loaded
**When** the user views the right panel
**Then** the "Optimize" button is disabled (dimmed, non-interactive)

**Given** the user changes the goal selection after optimization has already run
**When** a new goal is selected
**Then** `useOptimizationStore.goal` updates but no automatic re-run occurs — the user must click "Optimize" again

**Dev Notes:**
- `GoalSelector.tsx` uses Headless UI RadioGroup styled with design tokens
- `OptimizeButton.tsx` — Primary button (accent-gold fill, bg-base text); `useOptimizationStore.isOptimizing` gate prevents double-submission
- UX-DR13: loading animation is implemented in this story (pulsing waveform + estimated time text)
- When "Optimize" is clicked with an empty context panel (`activeBuild.contextData.gear.length === 0 && skills.length === 0 && idols.length === 0`): display a non-blocking inline note below the button — "Add gear, skills, and idols in the context panel for more relevant suggestions." Do NOT block optimization. Dismiss permanently once the user has populated any context panel field.

---

### Story 3.4: Suggestion List Display

As an advanced Last Epoch player,
I want to see a ranked list of AI suggestions — each showing the exact node change, quantified impact on all three scoring axes, and a plain-language technical explanation — as they stream in,
So that I can evaluate and prioritize which changes to apply without doing the analysis myself.

**Acceptance Criteria:**

**Given** the Claude API streaming completes
**When** the suggestion list renders
**Then** suggestions appear in ranked order (rank 1 = highest impact on selected goal)
**And** each `SuggestionCard` shows: rank badge, change description ("Reallocate [N] pts: [FromNode] → [ToNode]"), three-axis deltas in JetBrains Mono with sign and directional color (data-positive green, data-negative red, data-neutral grey), composite score change ("[42 → 51 Damage Score]"), and a plain-language explanation accessible via Disclosure/Accordion expansion

**Given** the suggestion list has more than 5 cards
**When** the user scrolls the suggestion area
**Then** the list uses virtual scrolling — no DOM performance degradation from large suggestion sets

**Given** suggestions are streaming from the Claude API
**When** the first suggestion token is received and a complete suggestion is parseable
**Then** it renders in the suggestion list immediately — the user sees results progressively, not all at once after 30 seconds

**Given** optimization returns no suggestions
**When** the response is processed
**Then** the right panel shows: "Your build is well-optimized for [Goal]. No high-impact changes found." with an option to switch goals

**Given** a suggestion explanation is expanded
**When** the user clicks the Disclosure toggle on a SuggestionCard
**Then** the explanation text renders in Body 14px Inter without truncation at 100% system font scale (NFR16)
**And** the explanation cites at least one specific node interaction, mechanic, or scaling relationship (FR23 contract from Claude prompt spec)

**Dev Notes:**
- `SuggestionCard.tsx` — anatomy per UX-DR5 spec
- `SuggestionList.tsx` — virtual scroll using `@tanstack/react-virtual` (the maintained successor to `react-virtual`)
- `useOptimizationStore.suggestions: SuggestionResult[]` populated incrementally by `useOptimizationStream.ts`
- Suggestion cards stream in during the AI call — partial list displayed as suggestions arrive

---

### Story 3.5: Suggestion Interactions — Preview, Apply, Dismiss

As an advanced Last Epoch player,
I want to preview how a suggestion would change my tree, apply suggestions I agree with, and skip ones I don't — all with a single click each,
So that I maintain full control over my build while still benefiting from AI-guided analysis.

**Acceptance Criteria:**

**Given** a suggestion is visible in the list
**When** the user hovers or focuses a `SuggestionCard`
**Then** the tree canvas highlights the affected nodes: "from" nodes dim slightly, "to" nodes glow in node-suggested purple (#7B68EE)
**And** `SkillTreeCanvas` receives updated `highlightedNodes: { dimmed: Set<NodeId>, glowing: Set<NodeId> }` prop — no store access inside PixiJS

**Given** the user clicks the "Preview" button on a card
**When** preview mode activates
**Then** the tree canvas shows the full after-state: affected node allocations reflect the proposed change
**And** `ScoreGauge` enters comparison mode showing baseline score and preview score side-by-side
**And** the right panel header shows "Previewing suggestion #[N] — [Apply] [Cancel Preview]"

**Given** the user clicks "Apply" (from preview or directly)
**When** the apply action fires
**Then** `useBuildStore.applyNodeChange(change)` updates `activeBuild.nodeAllocations`
**And** the tree re-renders with the new allocation
**And** the suggestion card shows a "✓ Applied" badge and greys out
**And** the build auto-saves (Story 2.4 debounced save)
**And** the apply is pushed to the session undo stack (max 10 snapshots)

**Given** the user clicks "Skip" on a suggestion
**When** the dismiss fires
**Then** the suggestion is removed from the active list and moves to a "Skipped" collapsed section at the bottom of the panel (visible if expanded — not permanently deleted)

**Given** the user clicks "Apply" on a suggestion and the target node's prerequisite is unmet (e.g., game data changed since the suggestion was generated, or a prior suggestion already removed the prerequisite node)
**When** the apply fires
**Then** an inline error appears on the suggestion card: "Cannot apply: prerequisite node not allocated"
**And** no node state changes occur — `activeBuild.nodeAllocations` remains unchanged

**Given** the user presses `Ctrl+Z`
**When** the undo fires
**Then** the last applied node change is reverted from `useBuildStore.undoStack`
**And** the tree re-renders to the pre-apply state

**Dev Notes:**
- Hover-triggered highlight: parent wrapper updates `highlightedNodes` prop to `SkillTreeCanvas` on SuggestionCard mouse-enter/leave events
- Preview mode: parent wrapper computes a modified `allocatedNodes` prop by applying the suggestion's `NodeChange` temporarily
- `ScoreGauge` comparison mode: receives both `baselineScore` and `previewScore` props and renders both
- **AI-applied prerequisite validation:** "Apply" must run the same prerequisite check as user clicks (from `applyNodeChange()` guards in Story 1.5). An AI suggestion can reference a node whose prerequisite is unmet if game data changed since the suggestion was generated — surface an inline error on the card ("Cannot apply: prerequisite node not allocated") rather than committing an invalid state.

---

### Story 3.6: Re-run Optimization & Iterative Workflow

As an advanced Last Epoch player,
I want to re-run AI optimization after applying suggestion changes to my build,
So that I can iterate through multiple rounds of improvement — getting fresh, relevant suggestions each time — until I'm satisfied with my build.

**Acceptance Criteria:**

**Given** the user has applied one or more suggestions and the build state has changed
**When** the user clicks "Optimize" again
**Then** a fresh AI optimization request is sent with the updated `BuildState` (all applied changes included)
**And** the previous suggestion list clears before the new list populates
**And** the `ScoreGauge` updates to show new baseline scores reflecting the updated build

**Given** the user re-runs optimization with a different goal
**When** the new goal is selected and "Optimize" is clicked
**Then** the AI request includes the new goal parameter
**And** the suggestion ranking order reflects the new goal's priority weighting

**Given** suggestions were skipped in a prior run
**When** optimization is re-run
**Then** the skipped suggestions section from the prior run is cleared — the new run starts fresh
**And** previously-skipped nodes are not excluded from new suggestions

**Given** a suggestion preview is currently active (tree canvas is showing the after-state of a suggestion, `ScoreGauge` is in comparison mode)
**When** the user clicks "Optimize"
**Then** preview mode exits first: `allocatedNodes` returns to baseline, `ScoreGauge` clears `previewScore`, and the preview header bar ("Previewing suggestion #N") dismisses
**And** the optimization run then begins with the correct baseline build state — not the previewed after-state

**Dev Notes:**
- `useOptimizationStore.clearSuggestions()` is called before each new optimization run
- "Optimize" button re-enables immediately after a completed run (success or error)
- `useOptimizationStore.isOptimizing` prevents double-submission — button disabled while in-flight
- **Preview state cleanup on re-run:** before calling `clearSuggestions()`, check if a suggestion preview is active (tree canvas showing after-state). If so, exit preview mode first — restore `allocatedNodes` to baseline, clear `previewScore` from `ScoreGauge`, and dismiss the preview header bar. Without this, the tree remains frozen in the prior suggestion's after-state while the new suggestion list is empty.

---

## Epic 4: Context Panel

Users can input gear, active skills, and idol data into a searchable structured context panel. This data is passed to the AI optimization engine so suggestions reflect the character's complete build state — not skill tree nodes in isolation.

### Story 4.1: Context Panel Shell & Gear Input

As an advanced Last Epoch player,
I want to input my equipped gear items so the AI has full context about my character's item-based stats and affixes,
So that optimization suggestions account for synergies between my skill tree and my gear — not skill tree nodes in isolation.

**Acceptance Criteria:**

**Given** the user views the left panel
**When** they scroll down or expand the context panel section
**Then** the Context Panel is visible with three labeled fieldset sections: "Gear", "Active Skills", "Idols"
**And** each section shows its completion state visually: Empty (all slots blank with placeholder prompts), Partial (some filled), Complete

**Given** the user focuses a gear slot input (e.g., "Helmet")
**When** they begin typing an item name
**Then** after a 200ms debounce, a dropdown appears with matching item names from game data
**And** selecting an item from the dropdown sets the item name and reveals affix selector fields below it

**Given** an item is selected for a gear slot
**When** the user clicks an affix field
**Then** a searchable dropdown shows only affixes valid for that item type (sourced from game data)
**And** the user can select up to the item's maximum affix count for that item type

**Given** gear inputs are filled and the user triggers optimization (Story 3.3)
**When** `invokeCommand('invoke_claude_api', ...)` is called
**Then** the gear data from `ContextPanel` is included in the payload as `contextData.gear: GearItem[]` (FR18)

**Dev Notes:**
- `ContextPanel.tsx` in `src/features/context-panel/` — Headless UI Disclosure/Accordion per section
- `GearInput.tsx` — Headless UI Listbox (or Combobox for searchable) for item name + affix selectors per slot
- Context data stored in `useBuildStore.activeBuild.contextData: { gear: GearItem[], skills: ActiveSkill[], idols: IdolItem[] }`
- This story covers Gear only; Story 4.2 covers Active Skills and Idols
- Game data must include item names and valid affixes per item type — verify this is present in the data source chosen in Story 1.3

---

### Story 4.2: Active Skill & Idol Context Input

As an advanced Last Epoch player,
I want to input my active skill selections and idol items so the AI has complete visibility into my full character state,
So that optimization suggestions reflect how my skill tree interacts with my actual skill loadout and idol bonuses.

**Acceptance Criteria:**

**Given** the user opens the "Active Skills" section of the Context Panel
**When** the user clicks an active skill slot
**Then** a searchable selector appears with active skill names auto-filled from the current class's available active skills (from `useGameDataStore.gameData`)
**And** selecting a skill sets that slot in `useBuildStore.activeBuild.contextData.skills`

**Given** one or more active skills are set
**When** the tree canvas tab row renders (Story 1.6)
**Then** tabs appear for each selected active skill, labeled with the skill name — the tab list updates reactively as skills are added or removed

**Given** the user opens the "Idols" section
**When** they click an idol slot
**Then** a searchable form appears: idol type selector (auto-fill from game data idol types) + modifier fields (auto-fill valid modifiers for that idol type)
**And** filling idol slot data sets it in `useBuildStore.activeBuild.contextData.idols`

**Given** all three context sections have data entered
**When** the user triggers optimization
**Then** the full `contextData: { gear: GearItem[], skills: ActiveSkill[], idols: IdolItem[] }` is passed in the `invoke_claude_api` payload (FR18)
**And** the AI can reference all context fields when generating skill tree node suggestions

**Dev Notes:**
- `SkillInput.tsx` and `IdolInput.tsx` in `src/features/context-panel/`
- Active skill list sourced from `useGameDataStore.gameData` filtered by `classId` — each class has a different active skill pool
- Idol types and modifiers: verify game data source (Story 1.3) includes idol data; if not, stub with placeholder until data is available
- Context data is read-only for AI suggestions in MVP — the AI generates suggestions for skill tree nodes only; context is supplementary information (FR27–FR29 scoping note)

---

## Epic 5: Application Infrastructure & Reliability

Users can configure their Claude API key securely, the app handles offline mode gracefully, API and network failures surface with retry options, and the app notifies and installs updates from within.

### Story 5.1: API Key Management & Settings View

As an advanced Last Epoch player,
I want to configure my Claude API key in the application settings and have it stored securely in my OS keychain,
So that the AI optimization engine can make authenticated requests without my key ever appearing in plain text on disk or in memory.

**Acceptance Criteria:**

**Given** the user opens Settings (via header button or any "Go to Settings" link)
**When** the Settings view renders (`appStore.currentView = 'settings'`)
**Then** an "AI API Key" section is visible with a masked text input labeled "Claude API Key"
**And** a "Save Key" Primary button is visible

**Given** the user enters a Claude API key and clicks "Save Key"
**When** the save command fires
**Then** `invokeCommand('set_api_key', { key })` is called
**And** the Rust handler stores the key via `tauri-plugin-stronghold` (OS keychain)
**And** the key NEVER appears in any log file, app state, IPC response, or Zustand store
**And** a success toast confirms "API key saved securely"

**Given** an API key is already stored
**When** the user opens Settings
**Then** the key input shows a masked placeholder (e.g., "sk-ant-••••••••[last 4 chars]") — the full key is NOT retrieved or displayed in the UI

**Given** the application has never been launched before (no Stronghold vault exists in the app data directory)
**When** the user opens Settings for the first time
**Then** the API key input shows an empty masked field with no error message
**And** no AUTH_ERROR is surfaced — the missing vault is silently initialized on first access by `keychain_service.rs`

**Given** no API key is configured and the user clicks "Optimize"
**When** the optimization attempt fires
**Then** an `AUTH_ERROR` surfaces with message: "No API key configured. Add your Claude API key in Settings." with a "Go to Settings" link

**Dev Notes:**
- Settings view is a full view swap via `useAppStore.currentView = 'settings'` — no React Router
- `Settings.tsx` and `ApiKeyInput.tsx` in `src/features/settings/`
- `src-tauri/src/commands/app_commands.rs`: `set_api_key(key: String) -> Result<(), AppError>`, `check_api_key_configured() -> Result<bool, AppError>`
- `src-tauri/src/services/keychain_service.rs` — `tauri-plugin-stronghold` read/write
- NFR7: key stored in OS keychain only; NFR8: all API calls over HTTPS; NFR9: key never sent to any service other than Claude API; NFR10: no remote code execution
- **Stronghold vault initialization guard:** on first-ever launch, the Stronghold vault file does not exist yet. `keychain_service.rs` must explicitly handle the "vault not found" case: create and initialize the vault on first use. `check_api_key_configured()` must return `Ok(false)` — not `Err(AppError::AUTH_ERROR)` — when the vault doesn't exist yet. An unguarded read on a missing vault would surface an AUTH_ERROR to the user before they've had any chance to enter a key.

---

### Story 5.2: Connectivity Detection & Offline Mode

As an advanced Last Epoch player,
I want the app to detect when I'm offline and gracefully restrict AI features while keeping my skill tree and saved builds fully accessible,
So that I can still use the tool at a LAN party or with spotty internet without the app feeling broken.

**Acceptance Criteria:**

**Given** the app launches with no internet connection
**When** the UI renders
**Then** an amber "Offline" badge appears in the status bar
**And** the "Optimize" button in the right panel is disabled (dimmed) with tooltip: "AI optimization requires internet connectivity. Connect to the internet and retry." (FR40)

**Given** the app is offline
**When** the user loads a saved build
**Then** the build loads from local SQLite and the tree renders from local game data (FR39)
**And** all tree interactions (node allocation, pan, zoom, hover) work normally

**Given** the app is online and the connection drops mid-session
**When** the `app:connectivity-changed { isOnline: false }` Tauri event fires
**Then** `useAppStore.isOnline` updates to false
**And** the status bar badge transitions to amber "Offline"
**And** the Optimize button immediately disables

**Given** internet is restored
**When** `app:connectivity-changed { isOnline: true }` fires
**Then** the status bar returns to online state and the Optimize button re-enables without requiring any user action

**Dev Notes:**
- `src/shared/hooks/useConnectivity.ts` — subscribes to `app:connectivity-changed` events; calls `useAppStore.setOnline(bool)`
- `src-tauri/src/commands/app_commands.rs` — periodic connectivity check (or OS network event) emits `app:connectivity-changed` via Tauri emit
- `StatusBar.tsx` reads `useAppStore.isOnline`
- NFR13: game data load failure on launch is handled here — app bootstraps with cached data; staleness banner shows if stale
- NFR14: build viewing and manual editing work without any network dependency

---

### Story 5.3: In-App Auto-Update System

As an advanced Last Epoch player,
I want the app to notify me when a new version is available and let me install it without leaving the app,
So that I always have the latest features and game data compatibility fixes without manually downloading updates.

**Acceptance Criteria:**

**Given** the app launches with internet connectivity
**When** the launch-time update check runs
**Then** if a new version is available: a non-blocking notification appears in the app header "LEBOv2 [version] is available. [Install Update]" (FR41)
**And** if no update is available: no notification appears and the check is completely silent

**Given** the user clicks "Install Update"
**When** the update starts downloading
**Then** a progress indicator shows download progress (in-header or status bar — not a modal)
**And** when download completes: "Update ready. Restart LEBOv2 to apply? [Restart Now]"

**Given** the user dismisses the update notification
**When** the banner is dismissed
**Then** the user continues using the app normally — no forced install
**And** the notification does not reappear in the same session

**Dev Notes:**
- `tauri-plugin-updater` handles update check, download, and install (FR41, FR42)
- Update manifest hosted on GitHub Releases (infrastructure decision from architecture)
- Update check triggered on app launch — no background polling after that
- Notification rendered in app header area — never a modal (per UX anti-pattern guidance)

---

### Story 5.4: Error Handling Infrastructure & Reliability

As an advanced Last Epoch player,
I want every error state — API failures, storage errors, network errors — to show me a clear message with a specific next step,
So that I'm never left wondering if the app is broken — I always know what went wrong and what to do about it.

**Acceptance Criteria:**

**Given** a retryable error occurs (API_ERROR, NETWORK_ERROR, TIMEOUT)
**When** the error surfaces in the UI
**Then** the relevant panel shows an inline error identifying the failure type in plain language
**And** a "Retry" button is visible and functional for retryable error types
**And** all errors conform to the `AppError` type: `{ type: ErrorType, message: string, detail?: string }`

**Given** a non-retryable error occurs (PARSE_ERROR, AUTH_ERROR, UNKNOWN)
**When** the error surfaces
**Then** no "Retry" button appears
**And** actionable next steps are shown (e.g., "Check your API key in Settings" for AUTH_ERROR)

**Given** a storage error occurs (STORAGE_ERROR)
**When** the SQLite read/write fails
**Then** a dismissible toast notification appears (non-blocking)
**And** the active build in memory is not lost
**And** the user is guided to try saving again

**Given** game data download fails on launch (NFR13)
**When** the failure occurs
**Then** the app launches using cached local data without any blocking error screen
**And** the staleness indicator reflects the cached state

**Given** all external services are unavailable simultaneously (NFR14)
**When** the user attempts to use the app
**Then** skill tree visualization, saved build loading, and manual node editing all work
**And** only AI optimization is restricted (with the offline/error message)

**Dev Notes:**
- `src/shared/utils/errorNormalizer.ts` — maps Rust error strings to typed `AppError` objects before they reach any component
- `invokeCommand()` wrapper already normalizes errors — all components receive `AppError`, never raw strings
- Error display rules: API errors → inline in right panel; storage errors → toast; critical (no game data at all) → full-panel error with retry
- `src/shared/components/Toast.tsx` — `react-hot-toast` wrapper styled with design tokens (bg-surface background, text-primary, data-negative for error variant)
- All 8 ErrorType variants have defined user-facing messages and retryability flags

---

### Story 5.5: Distribution Readiness — Code Signing & Release Pipeline

As an advanced Last Epoch player downloading LEBOv2,
I want the installer to open without a Windows SmartScreen warning or macOS Gatekeeper block,
So that I can install the tool without clicking through security prompts or disabling OS security.

**Prerequisites (must be completed before this story can begin):**
- Windows Authenticode certificate (OV or EV) purchased from a CA such as DigiCert or Sectigo (~$300–700/year) and stored in GitHub Actions secrets: `WINDOWS_CERTIFICATE` (base64 PFX), `WINDOWS_CERTIFICATE_PASSWORD`
- Apple Developer Program membership ($99/year) enrolled at developer.apple.com, and stored in GitHub Actions secrets: `APPLE_CERTIFICATE` (base64 P12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`

**Acceptance Criteria:**

**Given** the Windows build is produced by GitHub Actions
**When** the .msi installer is downloaded and double-clicked on Windows 10/11
**Then** no SmartScreen "Windows protected your PC" dialog appears
**And** the installer opens directly to the setup wizard

**Given** the macOS build is produced by GitHub Actions
**When** the .dmg is opened and the .app is launched on macOS 12+
**Then** Gatekeeper does not block the app with "cannot be opened because the developer cannot be verified"
**And** the app opens directly

**Given** a new version tag is pushed to GitHub (`v*`)
**When** the GitHub Actions release workflow runs
**Then** the Windows binary is signed with an Authenticode certificate before packaging
**And** the macOS binary is signed with a Developer ID certificate and notarized via Apple's notarization service before packaging
**And** signed binaries are uploaded to GitHub Releases automatically

**Dev Notes:**
- **Prerequisites (must complete before implementation):**
  - Windows Authenticode OV certificate: purchase from DigiCert, Sectigo, or equivalent CA (~$300–500/year). EV certificates (~$400–700/year) eliminate SmartScreen warning on first run for new publishers; OV builds reputation over time.
  - Apple Developer Program membership ($99/year): enroll at developer.apple.com
  - Store secrets in GitHub Actions: `WINDOWS_CERTIFICATE` (base64 PFX), `WINDOWS_CERTIFICATE_PASSWORD`, `APPLE_CERTIFICATE` (base64 P12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
- Update `.github/workflows/release.yml` to use `tauri-apps/tauri-action` signing options
- Apple notarization can take 2–15 minutes — verify CI timeout accommodates this
- Test signed installers on a clean Windows VM and clean macOS machine before first public release
- **Budget note:** Allocate ~$400–800 for certificates before setting a public launch date. Without signing, SmartScreen warnings will deter community adoption — this is not optional for any release targeting the general community.

---

## Epic 6: Accessibility & Polish

All users — including those using keyboard-only navigation or screen readers — can complete every workflow. The app passes WCAG 2.1 AA compliance with axe-core CI enforcement, global keyboard shortcuts, proper focus management, skip links, and reduced-motion support throughout.

### Story 6.1: Keyboard Navigation & Global Shortcuts

As an advanced Last Epoch player who prefers keyboard-driven workflows,
I want to navigate the skill tree, trigger optimization, and interact with suggestions entirely by keyboard,
So that I can operate the tool efficiently without requiring a mouse for any primary action.

**Acceptance Criteria:**

**Given** the app is open with a build loaded
**When** the user presses `O`
**Then** focus moves to the Optimize button in the right panel

**Given** the app is open
**When** the user presses `I`
**Then** focus moves to the build import input in the left panel

**Given** a build is active
**When** the user presses `Ctrl+S`
**Then** the current build saves (triggering Story 2.4 save behavior)

**Given** a suggestion card is expanded or a tree preview is active
**When** the user presses `Escape`
**Then** the expanded card collapses or the tree preview clears — returning to neutral state

**Given** the suggestion list is visible and has keyboard focus
**When** the user presses `Up` or `Down` arrow keys
**Then** focus moves between suggestion cards
**And** pressing `Enter` on a focused card expands or applies it
**And** pressing `P` activates preview for the focused suggestion
**And** pressing `S` skips/dismisses the focused suggestion

**Given** the skill tree canvas has keyboard focus
**When** the user presses `Tab`
**Then** focus moves to the next node in connection graph order (parent nodes before children)
**And** the focused node shows a 2px solid accent-gold focus ring
**And** pressing `Enter` allocates or deallocates the focused node

**Given** the user is within a node cluster with keyboard focus
**When** the user presses an arrow key (Up/Down/Left/Right)
**Then** focus moves to the nearest adjacent node in that direction

**Dev Notes:**
- Global shortcuts (`O`, `I`, `Ctrl+S`, `Escape`) handled via `keydown` listener in `App.tsx` or a `useGlobalShortcuts` hook — the handler MUST guard: `if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).isContentEditable) return` before processing bare-key shortcuts (`O`, `I`). Without this guard, typing 'o' or 'i' in the build name field, API key input, or any search box will hijack focus mid-typing. `Ctrl+S` and `Escape` are safe to handle globally as they don't conflict with normal text input.
- **Canvas keyboard accessibility — invisible focus overlay pattern:**
  - A positioned `<div>` overlay sits on top of the PixiJS canvas (same dimensions, `pointer-events: none` except when keyboard navigating)
  - For each node in the currently visible viewport, render a visually-hidden `<button>` positioned at the node's canvas coordinates (updated on pan/zoom via `ResizeObserver` and PixiJS viewport events)
  - Each button has `aria-label="[NodeName] — [state: allocated/available/locked] — [effect description]"` and handles `Enter`/`Space` to allocate/deallocate
  - The 2px accent-gold focus ring is a CSS `outline` on the button element — no PixiJS rendering required for the focus ring itself
  - `useSkillTree.ts` maintains `focusedNodeId: string | null`; when it changes, the corresponding hidden button receives `.focus()` programmatically
  - PixiJS optionally renders a subtle visual indicator on the focused node (redundant with focus ring, but visible to sighted keyboard users)
  - **Viewport-only rendering:** hidden buttons are only rendered for nodes visible in the current pan/zoom viewport — not the full tree — to maintain performance
  - This is the standard pattern used by Google Maps, Figma, and other canvas-heavy apps for keyboard/screen reader accessibility
  - **Pan/zoom button position sync:** `ResizeObserver` fires on container size changes only — it does NOT fire on pan or zoom. Button positions must ALSO be updated via a PixiJS `ticker` post-render callback (or a PixiJS `viewport.moved` event if using pixi-viewport) that runs after every pan/zoom frame. If button positions are only updated via `ResizeObserver`, keyboard focus rings render at stale coordinates after any pan or zoom.
- Tree keyboard navigation (Tab, arrow keys) managed entirely by `useSkillTree.ts` — no keyboard handling inside `pixiRenderer.ts`
- All Headless UI components provide correct keyboard behavior natively — verify in context
- NFR15: every interactive control must be reachable and activatable by keyboard — this story finalizes that requirement
- Keyboard shortcuts reference listed in the Settings view
- **Story 1.5 minimal keyboard nav already in place (2026-04-23):** `SkillTreeCanvas` container is `tabIndex={0}`, `aria-label` describes arrow/Tab/Enter controls. `focusedIndexRef` cycles through `treeData.nodes` array order via arrow keys + Tab/Shift+Tab; Escape clears; Enter/Space fires `onNodeClick`. `RendererInstance.getViewport()` converts world→screen coords. `useSkillTree` exposes `keyboardFocusedNodeId` + `keyboardPosition`; `SkillTreeView` renders `NodeTooltip` for keyboard focus at third priority (below error and hover). **What Story 6.1 must replace/extend:** (a) replace the linear array-order Tab cycling with connection-graph traversal per UX-DR4; (b) implement the invisible-button overlay pattern (visually-hidden `<button>` per node) for full ARIA + screen reader support and proper focus rings; (c) sync button positions on pan/zoom via PixiJS ticker; (d) remove the `tabIndex` + `onKeyDown` from the container `<div>` once the overlay buttons own keyboard interaction.

---

### Story 6.2: Screen Reader Support, ARIA Infrastructure & Accessibility CI

As an advanced Last Epoch player who uses assistive technology,
I want screen reader announcements for all dynamic content changes — suggestion updates, build import progress, error states — and complete ARIA compliance throughout the app,
So that the tool is fully usable with NVDA (Windows) and VoiceOver (macOS) without any functionality gaps.

**Acceptance Criteria:**

**Given** axe-core is integrated into the Vitest suite and GitHub Actions CI
**When** any CI build runs
**Then** axe-core automatically audits WCAG 2.1 AA compliance on all views
**And** any axe violation causes the CI build to fail — no accessibility regressions can ship

**Given** the user is importing a build code
**When** the progressive node resolution counter updates
**Then** a `aria-live="polite"` region announces the progress ("Resolving nodes: 340/342") to screen readers without interrupting existing speech

**Given** AI optimization is running
**When** the loading state is active
**Then** a `aria-live="polite"` region announces "Analyzing your build..." to the screen reader
**And** when complete: "Optimization complete. [N] suggestions available" is announced

**Given** a critical error occurs (API failure, import parse failure)
**When** the error message appears
**Then** a `aria-live="assertive"` region announces the error immediately

**Given** the user navigates to a SuggestionCard
**When** a card receives focus
**Then** the screen reader announces the full card content: "[Rank N] Suggestion: [description]. Damage: [before] → [after]. Survivability: [before] → [after]. Speed: [before] → [after]. [Explanation text]" (UX-DR5)

**Given** the page loads
**When** the user presses Tab at the very beginning of the document
**Then** "Skip to tree" and "Skip to suggestions" skip links appear (hidden until focused)
**And** activating a skip link moves focus to the correct landmark (`id="skill-tree-canvas"` or `id="suggestion-panel"`)

**Given** any animated transition in the app exists (loading pulses, node highlight animations, score bar animations)
**When** the user has `prefers-reduced-motion: reduce` set in OS accessibility preferences
**Then** all CSS animations and transitions are disabled
**And** all functional states are still communicated via static visual indicators — no animation-only feedback

**Given** any interactive element in the app
**When** it receives keyboard focus
**Then** a 2px solid accent-gold focus ring is visible
**And** `outline: none` is never applied without an explicit custom focus style in its place

**Dev Notes:**
- axe-core + `vitest-axe` (or `@axe-core/playwright` for E2E) installed as dev dependency; CI job runs on main view and settings view
- Three dedicated `aria-live` `<div>` elements in `App.tsx`: polite import progress region, polite AI status region, assertive critical error region
- Skip links: two visually hidden `<a>` elements at top of `App.tsx` that become visible on `:focus`
- `src/shared/hooks/useReducedMotion.ts` — reads `prefers-reduced-motion` media query; consumed by animation helper utilities throughout the codebase
- NFR16: validate tooltip readability at 100% system font scale manually on both Windows and macOS before marking story complete
- NFR17: all node state differentiation (shape + fill + color) already enforced in Story 1.4 — this story verifies it passes axe audit
