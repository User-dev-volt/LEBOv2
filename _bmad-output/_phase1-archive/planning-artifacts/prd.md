---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
workflowStatus: complete
completedAt: '2026-04-17'
lastEdited: '2026-04-17'
editHistory:
  - date: '2026-04-17'
    changes: 'Validation-driven edits: FR21-23 reformatted to user-capability format; FR27-29 input contract specified (structured form with auto-fill/search); FR30 converted to scoping note; FR39 active voice; FR40 specific offline message; FR6/7/41/42 traceability annotations; NFR6 quantified to ≤100ms; NFR11 subjective language removed'
inputDocuments: ['_bmad-output/project-intent.md']
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 0
projectDocsCount: 0
classification:
  projectType: desktop_app
  domain: general
  complexity: high
  projectContext: greenfield
---

# Product Requirements Document — LEBOv2 (Last Epoch Build Optimizer)

**Author:** Alec
**Date:** 2026-04-17

---

## Executive Summary

LEBOv2 is an AI-powered desktop build optimizer for Last Epoch. Users input or import their current skill tree state; the AI engine analyzes it against a chosen optimization goal (damage / survivability / speed / balanced) and delivers prioritized, specific node change recommendations — each with a quantified before/after delta across all three scoring dimensions and a plain-language technical explanation.

**Target users:** Advanced Last Epoch players — min-maxers and theory-crafters who understand the game's systems and need smarter tooling than static build templates. The core pain: no existing tool bridges the gap between "here is an optimal build template" and "here is exactly what *your* build needs to change to get there." Users currently cross-reference multiple static tools and apply manual judgment — a slow, error-prone process with no quantifiable feedback loop.

**Project type:** Desktop application (Tauri preferred; Electron fallback) — local install, no backend required in MVP. Greenfield. High complexity: AI integration (Claude API), skill tree graph rendering, scoring engine, community game data modeling.

### What Makes This Special

Every competing tool — lastepochtools.com, Maxroll guides — is a static planner that answers "what does an optimal build look like?" LEBOv2 answers a harder question: "given *my* current build, what are the highest-impact changes I should make right now, and by how much will each change improve my character?"

The core differentiator is the before/after scoring system paired with AI-generated change-specific explanations. This transforms build optimization from a research task into a guided, iterative improvement loop. The user's current build is the starting point — every suggestion is ranked by quantified impact.

The skill tree visualizer is the hero UI element: fully interactive, full-fidelity, and the surface through which all AI suggestions are presented. This mirrors the Path of Building (PoB) paradigm advanced players rely on in adjacent games, extended with an AI advisory layer no comparable tool offers.

| Tool | Interactive Tree | AI Suggestions | Per-Change Delta | Explanation |
|------|----------------|---------------|-----------------|-------------|
| lastepochtools.com | ✓ | ✗ | ✗ | ✗ |
| Maxroll Guides | ✗ | ✗ | ✗ | Narrative only |
| Path of Building (PoE) | ✓ | ✗ | Manual calc | ✗ |
| **LEBOv2** | **✓** | **✓** | **✓** | **✓** |

---

## Success Criteria

### User Success

- User imports an existing build or creates one from scratch and receives a ranked AI suggestion list within 30 seconds
- Each suggestion shows quantified before/after deltas across damage, survivability, and speed — magnitude of each change is immediately clear
- Skill tree visualizer is smooth and full-fidelity across all 5 classes and 15 masteries — no rendering lag or node data gaps
- Explanations are technical but readable — a min-maxer understands *why* each change is recommended without cross-referencing external resources
- "Aha moment": user sees their build's specific weaknesses named and ranked with a trusted improvement path

### Business Success

- MVP ships with all 5 classes (Sentinel, Mage, Primalist, Acolyte, Rogue) and all 15 masteries — no artificial limitation
- Users return to re-optimize as their character progresses (repeat engagement, not one-time use)
- Community adoption in Last Epoch theory-crafting spaces (Discord, Reddit, forums) via organic word-of-mouth
- No monetization required for MVP — success is adoption and community validation

### Technical Success

- Skill tree graph renders at interactive frame rates with full node data across all masteries
- Claude API integration is reliable — suggestions generated and returned without timeouts or failures
- Community data pipeline stays current with game patches — staleness is visible to users when it occurs
- App packages, installs, and updates cleanly on Windows (primary) and macOS (secondary)
- Desktop app calls Claude API directly — no server infrastructure required in MVP

### Measurable Outcomes

| Metric | Target |
|--------|--------|
| Time-to-first-suggestion | < 30 seconds from build import |
| Class coverage at launch | 100% (5 classes, 15 masteries) |
| Rendering performance | ≥ 60fps on mid-range hardware |
| Data currency | Within 1 patch cycle of current game version |

---

## Product Scope

### MVP — Minimum Viable Product

1. **Class & Mastery Selector** — all 5 classes, all 15 masteries
2. **Skill Tree Visualizer** — interactive, full-fidelity passive and active skill trees
3. **Build Input** — create from scratch or import/paste an existing build
4. **Optimization Goal Selector** — damage / survivability / speed / balanced
5. **AI Optimization Engine** — analyzes skill tree state, generates ranked change suggestions
6. **Before/After Scoring System** — numeric scores across damage, survivability, speed with per-suggestion delta
7. **Suggestion Explanations** — plain-language technical reasoning for each recommendation
8. **Context Panel** — gear, active skills, and idol slots shown as context for AI (read-only in MVP)

**MVP philosophy:** Experience MVP — all three pillars (interactive tree + AI suggestions + before/after scoring) must ship together. A partial MVP would not validate the core innovation or be useful to the target audience.

### Growth Features (Post-MVP)

- Build sharing and export URLs
- Historical build versioning ("compare to my previous state")
- Meta-tier context overlay ("similar to current S-tier meta builds")
- Idol optimization layer
- Enhanced import formats (multiple community build code formats)

### Vision (Future)

- Full item/gear recommendation layer
- Web version
- Multi-character roster management
- Community build database with AI-ranked meta analysis
- Live game state integration (if Last Epoch adds export capability)

---

## User Journeys

### Journey 1: The Frustrated Min-Maxer (Happy Path — Import & Optimize)

**Persona:** Kira, 28. 300 hours on her Falconer Rogue. DPS has plateaued at endgame corruption. She's read three Maxroll guides — all slightly different, none written for her exact build state.

Kira opens LEBOv2, pastes her build code from lastepochtools.com. Her full skill tree renders in seconds — nodes highlighted, connections drawn, matching her in-game state exactly. She selects "Maximize Damage" and clicks Optimize. Within 20 seconds:

1. "Reallocate 4 pts from Efficiency → Falcon Strikes: +18% Damage Score (42 → 51)" — *You're not cooldown-capped. Efficiency offers diminishing returns here; Falcon Strikes directly scales your primary damage source.*
2. "Remove 2 pts from Dodge Rating → Predator's Instinct: +11% Damage Score (51 → 57)" — *Your survivability score has headroom at this corruption level; Predator's Instinct scales with attack speed, which you're already stacking.*

She clicks suggestion #1; the tree updates visually with the before/after state. She applies both changes in-game and notices the difference. She posts a screenshot to her guild Discord — three members download it that evening.

*Capabilities: build import, skill tree rendering, optimization goal selector, AI engine, ranked suggestion list with deltas, per-suggestion explanations, visual before/after preview.*

---

### Journey 2: The Theorycraft Builder (From Scratch — Season Start)

**Persona:** Marcus, 35. Veteran ARPG player, first time on Forge Guard (Sentinel). Refuses to follow guides — wants to understand *why* a build works.

Marcus selects Sentinel → Forge Guard. A blank skill tree appears. He allocates 40 nodes by intuition, selects "Balanced," and clicks Optimize. The AI suggests targeted changes; he accepts two, declines one, re-runs. After three optimize → adjust → re-optimize cycles, he has a build that feels like his own and has been stress-tested by the AI — he understands every node because the AI explained what each cluster does together.

*Capabilities: class/mastery selector, interactive skill tree (click-to-allocate), optimization goal selector, AI engine, suggestion accept/decline, iterative optimize workflow.*

---

### Journey 3: Edge Case — Partial Import / Data Gap

**Persona:** Sam imports a build string from Discord. It's from a previous patch; two passive node IDs no longer exist.

LEBOv2 resolves 98% of the build — the two unknown nodes are highlighted in amber: "Node ID [X] not found in current data — may be from an older patch." Sam can see the rest of their build, run optimization on the resolved portion, and manually handle the flagged nodes.

*Capabilities: graceful partial import, per-node resolution status, data-staleness messaging, optimize-on-partial-build.*

---

### Journey 4: Edge Case — Offline / API Unavailable

**Persona:** Alex opens LEBOv2 at a LAN party with spotty internet.

Their saved build renders from local cache. Alex clicks Optimize — the button is grayed: "AI suggestions require an active internet connection. Your build is saved locally." They browse the tree and make manual edits. When back online, optimization works normally. No data is lost.

*Capabilities: local build save/load, offline-safe skill tree viewer, API connectivity status, graceful degradation.*

### Journey Requirements Summary

| Capability | Required By |
|-----------|-------------|
| Build import (paste/code) | J1, J3 |
| Class & mastery selector | J1, J2 |
| Interactive skill tree (render + click-to-allocate) | J1, J2, J3, J4 |
| Optimization goal selector | J1, J2 |
| AI Optimization Engine | J1, J2 |
| Ranked suggestion list with before/after deltas | J1, J2 |
| Per-suggestion plain-language explanations | J1, J2 |
| Visual before/after tree preview | J1 |
| Partial import with per-node resolution status | J3 |
| Data staleness messaging | J3 |
| Local build save/load | J4 |
| Offline-safe skill tree viewer | J4 |
| API connectivity status / graceful degradation | J4 |

---

## Domain-Specific Requirements

No regulatory or compliance requirements. Technical domain constraints:

### Data Dependencies

- All skill tree, node, and passive data sourced from community Last Epoch database. Data accuracy is a hard dependency — stale or incorrect data produces wrong optimization suggestions. Data versioning must be tracked and surfaced to users.
- Data consumption from lastepochtools.com and community sources must respect rate limits and terms of use — no scraping in violation of source site policies.
- Claude API: AI suggestions depend on external API availability. Timeouts, rate limits, and outages must be handled gracefully without data corruption or crashes.

### Desktop Platform Constraints

- Tauri/Electron sandboxed environment — file system access for local save/load must use platform-appropriate APIs
- Auto-update mechanisms handled per-platform (Windows installer, macOS .dmg)
- No local game file access in MVP — community data is the exclusive source

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Game patch breaks community data | Version-stamp data; display staleness warning; allow continuation with stale data |
| Claude API unavailable | Graceful offline degradation; last suggestion set cached locally |
| Community data source offline | Data snapshots cached locally; user notified when stale beyond threshold |
| Import format changes | Versioned import parser; fail gracefully with per-node error reporting |

---

## Innovation Analysis

### Novel Combination: AI Advisory + Interactive Build Visualizer

LEBOv2 is the first tool to combine a full-fidelity, interactive build planner with an AI advisory engine that treats the user's current build state as the optimization starting point. The innovation is the integration — AI reads the tree, tree displays suggestions, user iterates — not either component alone.

### Quantified Per-Suggestion Impact

No existing Last Epoch tool produces numeric before/after deltas at the individual node-change level. The scoring engine creates a feedback loop that transforms optimization from intuitive judgment into a data-driven iterative process.

### Build-State-as-Input Paradigm

Competitors answer "what does the optimal build look like?" LEBOv2 answers "what does *my* build need to become optimal?" This paradigm shift — template-first to build-state-first — is the core product insight. Path of Building (PoE) provides the visualizer but still requires the user to manually apply template knowledge. LEBOv2 automates the delta.

### Validation Approach

| Signal | Method |
|--------|--------|
| Suggestion quality | Does the top suggestion produce measurable improvement in-game? (Immediately user-testable) |
| Novelty | Do users describe suggestions as "things they wouldn't have thought to change"? |
| Value loop | Do users return to re-optimize after leveling or gear changes? |
| Early validation | Alpha release to Last Epoch theory-crafting Discord/Reddit communities |

### Innovation Risks

| Risk | Mitigation |
|------|-----------|
| AI suggestions low-quality or wrong | Tight prompt engineering with full skill tree context; scoring engine provides ground-truth check |
| Scoring model doesn't reflect game mechanics | Community feedback loop; versioned scoring model with visible assumptions |
| Community data too incomplete for AI | Data completeness indicator; AI declines to suggest on nodes with missing data |
| Users distrust AI recommendations | Mandatory explanations for every suggestion; citations to specific node interactions |

---

## Desktop Application Requirements

LEBOv2 is a native desktop application (Tauri preferred, Electron fallback). Runs locally; stores build data locally; calls external services (Claude API, community data) only when needed. No server infrastructure required in MVP.

### Platform Support

| Platform | Priority | Distribution |
|---------|---------|------------|
| Windows 10/11 | Primary | .msi or .exe installer |
| macOS 12+ | Secondary | .dmg / .app |
| Linux | Not in MVP | Community-driven post-MVP |

No app store distribution in MVP — direct download only.

### System Integration

- **File system:** Read/write for local build save/load (user's app data directory)
- **Network:** Outbound HTTPS only — Claude API and community data endpoint
- **Clipboard:** Read clipboard for build code paste (import UX)
- No local game file access in MVP
- No system tray, no background processes — user-launched, user-closed

### Update Strategy

**App updates:** Built-in auto-updater (Tauri Updater or Electron auto-updater). Check on launch; user notified, not forced; silent download, user-triggered install.

**Game data updates:** Versioned independently from app. On launch: check if local data version matches latest. If stale: prompt user (non-blocking — can continue with staleness warning).

### Offline Capability

| Feature | Offline |
|---------|---------|
| Skill tree visualizer | ✓ — renders from local cache |
| Saved builds | ✓ — stored locally |
| Build editing (manual) | ✓ — no network needed |
| AI Optimization Engine | ✗ — requires Claude API |
| Game data update | ✗ — requires network |

### Implementation Guidance

- **Tauri preferred** for performance and binary size; Electron if Tauri blocks the rendering library
- **Frontend:** Web technologies (React/Vue/Svelte) bundled inside desktop shell
- **Graph rendering:** Canvas or WebGL (D3.js, Cytoscape.js, or custom) — must hit ≥ 60fps; DOM-based rendering is not acceptable
- **Local storage:** SQLite or flat JSON for build persistence
- **API key:** Stored in OS keychain (Windows Credential Manager / macOS Keychain) — never in plain text

---

## Project Scoping

### MVP Strategy

**Approach:** Experience MVP — all three pillars (interactive tree + AI suggestions + scoring) must ship together. A partial MVP would not validate the core innovation and would not be useful to the target audience.

**Resources:** Solo developer or 2-person team. Breadth intentionally limited — no gear optimization, no sharing, no web version — to concentrate quality on the core experience.

### MVP Feature Rationale

| Capability | Why It's MVP |
|-----------|-------------|
| Class & Mastery Selector (all 5/15) | Unsupported classes = tool is useless to those users |
| Interactive Skill Tree Visualizer | Hero UI — without it, the product is a text list |
| Build Import + Build Creator | Primary and secondary onboarding paths |
| Optimization Goal Selector | Required for personalized AI suggestions |
| AI Optimization Engine | The core differentiator |
| Before/After Scoring | What separates LEBOv2 from every static planner |
| Per-Suggestion Explanations | Trust — users won't act on unexplained suggestions |
| Context Panel (read-only) | AI needs gear/skills/idol context to generate relevant suggestions. Note: Context Panel (Epic 4) ships after AI Optimization (Epic 3). During Epic 3 delivery, AI suggestions are generated on skill tree state only. The UI must disclose this inline: "Add gear and skills in the context panel for more relevant suggestions." Community alpha release should target Epic 4 completion, not Epic 3 completion, to maximise first-impression quality. |
| Local Build Save/Load | Users must return to builds across sessions |
| Data Staleness Indicator | Data integrity communication is non-negotiable |
| API Connectivity / Offline Degradation | Graceful failure required for desktop apps |

### Risk Mitigation

**Technical:**
- *Highest:* Skill tree rendering performance (5 classes × 3 masteries × per-skill trees). Spike the rendering engine first; validate ≥60fps before full feature development. Canvas/WebGL only.
- *Second:* Claude API prompt design quality. Build a test harness with known-good build states and expected suggestion outputs before shipping.

**Market:**
- *Primary:* AI suggestion quality is the core promise — if suggestions are wrong or obvious, the product fails. Mitigate with alpha release to theory-crafting community before broader release.
- *Data:* Community data incompleteness could limit AI context. Audit data completeness early; define minimum requirements per node type.

**Resource:**
- All 5 classes in MVP means longer development before launch. This is a deliberate trade-off — a single-class tool wouldn't attract the target audience.
- *Contingency:* If timeline extends, context panel can be reduced to placeholder display without removing it from the UI.

---

## Functional Requirements

### Build Management

- **FR1:** User can create a new build by selecting a class and mastery from all available options
- **FR2:** User can import an existing build by pasting a build code string
- **FR3:** System displays per-node resolution status when a build import contains unrecognized node IDs
- **FR4:** User can save a build locally with a name for future retrieval
- **FR5:** User can load a previously saved build
- **FR6:** User can rename a saved build *(Source: Desktop Application Requirements — standard build management)*
- **FR7:** User can delete a saved build *(Source: Desktop Application Requirements — standard build management)*

### Skill Tree Visualization

- **FR8:** User can view the full passive skill tree for their selected class and mastery
- **FR9:** User can view the skill-specific trees for active skills associated with their build
- **FR10:** User can allocate and deallocate skill tree nodes interactively
- **FR11:** User can pan and zoom the skill tree to navigate large trees
- **FR12:** User can view node details (name, effect, tags, connections) for any node
- **FR13:** System visually distinguishes allocated, unallocated, and prerequisite-locked nodes

### Optimization Engine

- **FR14:** User can select an optimization goal (maximize damage / maximize survivability / maximize speed / balanced) before triggering optimization
- **FR15:** User can trigger AI optimization analysis for their current build state
- **FR16:** System generates a ranked list of specific skill tree node change recommendations based on the selected goal
- **FR17:** System calculates and displays a composite score (damage, survivability, speed) for the current build state
- **FR18:** System includes context panel data (gear, active skills, idols) in the AI optimization request
- **FR19:** System declines to generate suggestions for nodes where game data is missing or incomplete, and indicates which nodes were excluded

### Suggestion Presentation

- **FR20:** User can view the ranked suggestion list ordered by impact on the selected optimization goal
- **FR21:** User can view the exact node change specified in each suggestion (points to add/remove/reallocate, from/to which nodes)
- **FR22:** User can view before/after numeric deltas for damage, survivability, and speed scores for each suggestion
- **FR23:** User can view a plain-language technical explanation for each suggestion — each explanation must reference at least one specific node interaction, mechanic, or scaling relationship
- **FR24:** User can preview the visual effect of a suggestion on the skill tree before applying it
- **FR25:** User can accept or dismiss individual suggestions
- **FR26:** User can re-run optimization on the current build state after making changes

### Context Panel

- **FR27:** User can input gear items via a searchable structured form — item name auto-fills from game data; affix fields are selectable from the item's valid affix list
- **FR28:** User can input active skill selections via a searchable skill selector — skill names auto-fill from the class's available active skills
- **FR29:** User can input idol slot contents via a searchable structured form — idol type and modifiers auto-fill from game data

- **FR30 [Scoping Note — Not a user-facing requirement]:** The AI Optimization Engine does not generate optimization suggestions for gear, active skills, or idol slots in MVP. Context panel data (FR27–FR29) is passed to Claude as supplementary read-only context for skill tree node analysis only. Gear, skill, and idol optimization are Post-MVP features. *(This note was preserved as FR30 to maintain traceability to the original requirement discussion.)*

*Scoping note: Context panel data (FR27–FR29) is included in AI optimization requests as read-only context. The AI engine does not generate optimization suggestions for gear, active skills, or idols in MVP — skill tree nodes only.*

### Game Data Management

- **FR31:** System loads skill tree, passive tree, and node data for all 5 Last Epoch classes and 15 masteries
- **FR32:** System checks for updated game data on application launch
- **FR33:** User can manually trigger a game data update
- **FR34:** System displays the current game data version and last-updated date
- **FR35:** System displays a staleness warning when local data version is behind the current game version
- **FR36:** User can acknowledge a staleness warning and continue with outdated data

### Application & System

- **FR37:** User can configure their Claude API key in application settings
- **FR38:** System displays current API connectivity status in the UI
- **FR39:** User can access the skill tree visualizer and saved builds when offline
- **FR40:** AI optimization features are disabled when offline; the UI displays: "AI optimization requires internet connectivity. Connect to the internet and retry."
- **FR41:** Application checks for app updates on launch and notifies the user when a new version is available *(Source: Desktop Application Requirements — Update Strategy)*
- **FR42:** User can install application updates from within the application *(Source: Desktop Application Requirements — Update Strategy)*

---

## Non-Functional Requirements

### Performance

- **NFR1:** Skill tree graph renders at ≥ 60fps on mid-range hardware (Intel Core i5 equivalent, integrated graphics) during pan, zoom, hover, and node click
- **NFR2:** Application cold-start to interactive: ≤ 5 seconds
- **NFR3:** Build import (paste to rendered tree): ≤ 3 seconds for a complete build
- **NFR4:** AI optimization results returned and displayed: ≤ 30 seconds under normal network conditions
- **NFR5:** Game data initial load (all 5 classes): ≤ 10 seconds on first launch after install
- **NFR6:** UI input latency remains ≤ 100ms during AI optimization request processing — no freeze or blocked interaction while awaiting Claude API response

### Security

- **NFR7:** Claude API key stored in an encrypted credential vault (`tauri-plugin-stronghold`) — never in plain text in config files, application state, or IPC responses. Stronghold provides AES-256 encryption at rest. Note: this is Tauri's cross-platform encrypted vault, not OS-native credential managers (Windows Credential Manager / macOS Keychain); OS-native integration is a post-MVP enhancement.
- **NFR8:** All Claude API and game data requests transmitted over HTTPS
- **NFR9:** No user build data or personal information transmitted to any service other than the Claude API (limited to build state required for optimization)
- **NFR10:** Application does not execute any code received from remote sources

### Integration Reliability

- **NFR11:** Claude API failures (timeout, rate limit, 5xx) surfaced to user with an error message identifying the failure type and a retry option — no silent failures, no empty results
- **NFR12:** Claude API requests time out after 45 seconds maximum; user notified and able to retry
- **NFR13:** Game data download failures do not prevent app launch — fallback to cached data with visible staleness warning
- **NFR14:** Application remains functional (build view, saved builds, manual editing) when all external services are unavailable

### Accessibility

- **NFR15:** All interactive controls (nodes, buttons, inputs) are keyboard-accessible
- **NFR16:** Skill tree node tooltips and suggestion panel content are readable at 100% system font scale without truncation
- **NFR17:** Node state (allocated / unallocated / locked) is indicated by shape, icon, or label — not color alone
