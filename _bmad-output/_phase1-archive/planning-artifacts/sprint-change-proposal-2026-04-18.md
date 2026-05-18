# Sprint Change Proposal — LEBOv2
**Date:** 2026-04-18
**Author:** Correct Course workflow (triggered by adversarial review)
**Status:** Complete — all changes applied 2026-04-18. DECISION-1 resolved: Path B (app-computed deltas, deterministic). All 17 changes applied across architecture.md, prd.md, and epics.md.

---

## Section 1: Issue Summary

A pre-implementation adversarial review of the three core planning artifacts (PRD, Architecture, Epics) was conducted on 2026-04-18. Fifteen findings were identified across documentation quality, architectural ambiguity, unresolved dependencies, and specification gaps.

**No code has been written.** This is the highest-leverage moment to fix these issues — every correction now costs zero rework. The same corrections made during or after implementation carry multiplied cost.

The findings cluster into five categories:

| Category | Count | Severity |
|----------|-------|----------|
| Unresolved architectural decisions (block implementation) | 2 | Critical |
| Documentation gaps (incorrect or missing content) | 4 | High |
| Story/spec refinements (incorrect acceptance criteria or missing detail) | 6 | Medium |
| New story needed | 1 | Medium |
| Sequence/dependency clarifications | 2 | Low |

**One finding requires an explicit architectural decision from Alec before documents can be updated:** delta ownership (who computes before/after scores — Claude or `scoringEngine.ts`). All other findings have clear fixes documented below.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Nature |
|------|--------|--------|
| Epic 1: Foundation & Skill Tree | Medium | Story 1.2 (PixiJS spike) scope needs tightening; Story 1.3 needs a hard gate |
| Epic 2: Build Management | Medium | Story 2.1 needs failure-mode handling; Story 2.4 auto-save logic is wrong; `BuildState` schema needs `contextData` |
| Epic 3: AI Optimization | High | Delta ownership must be resolved before Story 3.2 can be implemented; Story 3.4 needs streaming design |
| Epic 4: Context Panel | Low | Needs explicit dependency note relative to Epic 3; `BuildState` schema fix (from Epic 2) carries here |
| Epic 5: Infrastructure | Medium | NFR7 language fix; new Story 5.5 (code signing) |
| Epic 6: Accessibility | Medium | Canvas keyboard accessibility approach needs a concrete implementation design |

### Artifact Conflicts

| Artifact | Sections Affected | Change Type |
|----------|------------------|-------------|
| PRD | NFR7, FR27–FR29 scoping note (FR30), NFR15 notes | Text correction + documentation gap fill |
| Architecture | `BuildState` schema, delta ownership decision, Stronghold description, streaming design, saved builds query, PixiJS spike spec | Schema update + design additions + 1 open decision |
| Epics.md | Stories 1.2, 1.3, 2.1, 2.4, 3.2, 3.4, 5.x (new), 6.1; Epic 3 description | Acceptance criteria + dev notes + new story |

---

## Section 3: Recommended Approach

**Option 1: Direct Adjustment — Document Edits Only**

Rationale: We are pre-implementation. Every finding is a planning document problem, not a code problem. Fixing documents now costs hours; fixing them after Epic 1 ships costs days. The recommended approach is complete document edits before any implementation story is started.

**Exception — one architectural decision cannot be made unilaterally:**
Finding 2 (delta ownership) requires Alec to choose between two valid architectural paths. This decision must be made first because it affects the Architecture document, the Claude prompt spec requirements (Story 3.2), the `scoringEngine.ts` interface, and how `SuggestionCard` displays deltas. The two options are presented in Section 4 below.

**Effort estimate:** Low — all fixes are document text edits  
**Risk:** Low — no code changes  
**Timeline impact:** None to implementation start; these fixes ARE the prerequisite to a clean implementation start  

---

## Section 4: Detailed Change Proposals

Changes are ordered by dependency — resolve Critical first, then High, then Medium.

---

### P0 — REQUIRES ALEC'S DECISION BEFORE DOCUMENTS CAN BE UPDATED

---

#### DECISION-1: Delta Ownership — Who Computes Before/After Scores?

**Finding:** Finding 2 from adversarial review. The architecture specifies `scoringEngine.ts` computes `BuildScore`, but the Claude API response schema (Story 3.2 dev notes) includes `delta_damage`, `delta_survivability`, `delta_speed` per suggestion. These two cannot both be authoritative without contradiction.

**Two viable paths:**

**Path A — Claude owns deltas; `scoringEngine` owns baseline display only**
- Claude is prompted to compute and return per-suggestion deltas in its JSON response
- `scoringEngine.ts` computes only the current build's baseline `BuildScore` for the `ScoreGauge`
- Deltas in `SuggestionCard` come directly from Claude's response
- Pro: Simpler implementation; streaming works cleanly; no post-processing needed per suggestion
- Con: Delta accuracy depends on Claude's game knowledge; no ground-truth check on Claude's numbers; scoring model research becomes lower priority (only needed for baseline display)

**Path B — App owns deltas; Claude provides node changes only**
- Claude returns only the node change specification (which nodes, how many points)
- After each suggestion is parsed, `scoringEngine.ts` runs synchronously to compute baseline vs. post-change `BuildScore`
- `SuggestionCard` displays app-computed deltas
- Pro: Ground-truth deltas from the same engine the user sees; consistent with the scoring system
- Con: Suggestions cannot fully stream (must compute delta before displaying each card); scoring research becomes a hard blocker for AI integration; Claude prompt becomes simpler

**Recommendation:** Path A, with a caveat. Path A ships faster and the scoring engine research (which is deep game-mechanics work) doesn't block the AI integration. Claude's deltas can be presented as "AI-estimated" with a tooltip; if community feedback shows they're inaccurate, Path B can be layered in post-MVP when the scoring model is mature. Path B as MVP is high-risk because the scoring model is currently undefined and its quality is unknown.

**👉 Alec: Choose Path A or Path B. All delta-related document edits below depend on this choice.**

---

### P1 — Architecture Document Fixes

---

#### ARCH-1: `BuildState` Schema — Add `contextData`

**Finding:** Finding 8. The `BuildState` interface in the Architecture document does not include `contextData`, yet Stories 4.1 and 4.2 store gear/skills/idols in `useBuildStore.activeBuild.contextData`. The SQLite `data` column persists the full `BuildState` — so context panel data is silently dropped on save/load.

**File:** `_bmad-output/planning-artifacts/architecture.md`

**Section:** Format Patterns → BuildState Schema (versioned)

```
OLD:
interface BuildState {
  schemaVersion: 1          // increment on breaking changes
  id: string                // uuid v4
  name: string
  classId: string           // e.g. 'sentinel'
  masteryId: string         // e.g. 'forge_guard'
  nodeAllocations: Record<string, number>  // nodeId → points allocated
  createdAt: string         // ISO 8601
  updatedAt: string         // ISO 8601
}

NEW:
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
  isPersisted: boolean      // true after first explicit user save (controls auto-save gate)
  createdAt: string         // ISO 8601
  updatedAt: string         // ISO 8601
}
```

**Rationale:** Fixes the schema inconsistency. `isPersisted` is added here to resolve the auto-save issue (STORY-4 below). `contextData` fields default to empty arrays so Epic 3 works before Epic 4 is implemented.

---

#### ARCH-2: Stronghold Description — Correct Credential Store Language

**Finding:** Finding 5. `tauri-plugin-stronghold` is not Windows Credential Manager or macOS Keychain. NFR7 claims OS-native keychain; the implementation uses Stronghold's encrypted vault file. These are different security mechanisms.

**File:** `_bmad-output/planning-artifacts/architecture.md`

**Section:** Security Architecture → API Key Lifecycle

```
OLD (text blocks throughout security section):
"tauri-plugin-stronghold stores encrypted in OS keychain"
"Rust: tauri-plugin-stronghold stores encrypted in OS keychain"

NEW:
"tauri-plugin-stronghold stores encrypted in Stronghold vault (encrypted file in app data directory, AES-256; not the OS credential manager)"
```

**Also in the API Key Lifecycle code comment:**

```
OLD:
→ Rust: tauri-plugin-stronghold stores encrypted in OS keychain
→ On Claude API call: Rust retrieves key from stronghold

NEW:
→ Rust: tauri-plugin-stronghold stores encrypted in Stronghold vault
   (Stronghold = IOTA's encrypted credential vault, not Windows Credential Manager or macOS Keychain.
    Tradeoff: cross-platform consistency vs. OS-native trust chain. OS keychain integration
    is a post-MVP enhancement if users request it.)
→ On Claude API call: Rust retrieves key from Stronghold vault
```

---

#### ARCH-3: Saved Builds — Metadata-Only List Query

**Finding:** Finding 13. The `load_builds` command loads all columns including the `data` TEXT column (full serialized `BuildState`) for every saved build, just to populate the sidebar list. This is unnecessary for display and will be slow as build libraries grow.

**File:** `_bmad-output/planning-artifacts/architecture.md`

**Section:** Data Architecture → Build Storage

Add after the existing schema description:

```
NEW (add):
**Two query patterns for build commands:**

| Command | SQL | Purpose |
|---------|-----|---------|
| `load_builds_list` | `SELECT id, name, class_id, mastery_id, created_at, updated_at FROM builds ORDER BY updated_at DESC` | Sidebar list — no data column |
| `load_build` | `SELECT * FROM builds WHERE id = ?` | Load specific build for editing |

The `data` column is NOT fetched for list operations. This keeps the sidebar list fast regardless of build count or build size.
```

**Also update `build_commands.rs` reference:**
```
OLD:
build_commands.rs: save_build, load_builds, delete_build, rename_build

NEW:
build_commands.rs: save_build, load_builds_list, load_build, delete_build, rename_build
```

---

#### ARCH-4: Streaming Design — Add NDJSON Constraint and Parsing Approach

**Finding:** Finding 10. The architecture's streaming model says Rust emits `optimization:suggestion-received` events per suggestion, and the `streamingBuffer` accumulates partial suggestions. But partial JSON from an LLM stream (token by token) requires detecting JSON object boundaries — which is nontrivial and not addressed anywhere.

**File:** `_bmad-output/planning-artifacts/architecture.md`

**Section:** IPC & Communication Architecture → Claude API Streaming Pattern

Add after the existing streaming description:

```
NEW (add after "Frontend listens: `await listen(...)` line):

**Streaming Parse Strategy — NDJSON Contract**

The Claude prompt spec (to be created in Story 3.2 research task) MUST constrain Claude's output format to one complete JSON object per line (NDJSON). This eliminates the partial-JSON parsing problem:

Example Claude output (streamed line by line):
  {"rank":1,"from":"node_123","to":"node_456","pts":2,"delta":{"dmg":9,"surv":0,"spd":0},"explanation":"..."}
  {"rank":2,"from":"node_789","to":"node_234","pts":1,"delta":{"dmg":4,"surv":-1,"spd":2},"explanation":"..."}

Rust implementation in `claude_service.rs`:
- Buffer incoming stream bytes
- On each `\n` character: attempt JSON parse on the buffered line
- On success: emit `optimization:suggestion-received` with the parsed object; clear buffer
- On failure: continue buffering (mid-object newline from explanation text)
- On stream close: if buffer non-empty, attempt final parse; emit error if malformed

This approach is robust and avoids streaming JSON parser complexity. The NDJSON constraint must be enforced in the system prompt and verified in prompt testing.
```

---

#### ARCH-5: PixiJS Spike — Specify Realistic Node Count

**Finding:** Finding 14. Story 1.2 specifies "at minimum 500 nodes" and "800 nodes for full-size tree scenario." The actual node count for Last Epoch trees is not verified against these numbers, potentially making the spike unrepresentative.

**File:** `_bmad-output/planning-artifacts/architecture.md`

**Section:** Starter Template Evaluation → Note about tree renderer spike

```
OLD:
"PixiJS (WebGL) selected over Konva.js (Canvas 2D) because benchmarks show Konva drops to 23fps at 8k objects vs PixiJS at 60fps"

NEW:
"PixiJS (WebGL) selected over Konva.js (Canvas 2D) due to WebGL's GPU-accelerated rendering advantage at high object counts. The renderer spike (Story 1.2) must use actual Last Epoch node counts as its benchmark: audit the game data source to determine the maximum passive tree node count (across all classes) before writing the spike mock data. The mock must match real-world complexity, including edges/connections, multi-tier node sizes, and glow-state overlays — not bare circles."
```

---

### P1 — PRD Fixes

---

#### PRD-1: FR30 — Document the Missing Requirement

**Finding:** Finding 3. The PRD frontmatter states "FR30 converted to scoping note" but FR30 does not appear in the document body. The requirements jump from FR29 to FR31 with no explanation.

**File:** `_bmad-output/planning-artifacts/prd.md`

**Section:** Functional Requirements → Context Panel (after FR29)

```
OLD:
- **FR29:** User can input idol slot contents...

*Scoping note: Context panel data (FR27–FR29)...*

NEW:
- **FR29:** User can input idol slot contents...

- **FR30 [Scoping Note — Not a user-facing requirement]:** The AI Optimization Engine does not generate optimization suggestions for gear, active skills, or idol slots in MVP. Context panel data (FR27–FR29) is passed to Claude as supplementary read-only context for skill tree node analysis. Gear, skill, and idol optimization are Post-MVP features.

*This note was preserved as FR30 to maintain traceability to the original requirement discussion.*
```

---

#### PRD-2: NFR7 — Correct Credential Store Description

**Finding:** Finding 5. NFR7 claims "OS-native secure credential store (Windows Credential Manager / macOS Keychain)." The implementation uses `tauri-plugin-stronghold`, which is an encrypted vault file — not OS keychain integration.

**File:** `_bmad-output/planning-artifacts/prd.md`

**Section:** Non-Functional Requirements → Security

```
OLD:
- **NFR7:** Claude API key stored in OS-native secure credential store (Windows Credential Manager / macOS Keychain) — never in plain text in config files or application state

NEW:
- **NFR7:** Claude API key stored in an encrypted credential vault (`tauri-plugin-stronghold`) — never in plain text in config files, application state, or IPC responses. Stronghold provides AES-256 encryption at rest. Note: this is Tauri's cross-platform encrypted vault, not OS-native credential managers (Windows Credential Manager / macOS Keychain); OS-native integration is a post-MVP enhancement.
```

---

#### PRD-3: Context Panel at MVP — Add User Expectation Note

**Finding:** Finding 9. Epic 3 (AI Optimization) ships before Epic 4 (Context Panel). Users who adopt the tool during this window receive skill-tree-only suggestions. No user-facing disclosure of this limitation exists in the PRD.

**File:** `_bmad-output/planning-artifacts/prd.md`

**Section:** MVP Feature Rationale table

```
OLD (Context Panel row):
| Context Panel (read-only) | AI needs gear/skills/idol context to generate relevant suggestions |

NEW:
| Context Panel (read-only) | AI needs gear/skills/idol context to generate relevant suggestions. Note: Context Panel (Epic 4) ships after AI Optimization (Epic 3). During Epic 3 delivery, AI suggestions are generated on skill tree state only. The UI should disclose this with an inline message in the optimization panel: "Add gear and skills in the context panel for more relevant suggestions." |
```

---

### P2 — Epics / Stories Fixes

---

#### STORY-1: Story 1.2 — PixiJS Spike Node Count Requirement

**Finding:** Finding 14.

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 1.2 Dev Notes

```
OLD:
- Mock tree data must represent structural complexity of a real Last Epoch passive tree (nodes, edges, multi-point nodes, varied sizes)

NEW:
- **Before writing mock data:** Query the game data source (established in Story 1.3 research) to determine the actual maximum passive tree node count for any single class/mastery. If Story 1.3 isn't yet complete, use a conservative estimate of 1,200 rendered objects (nodes + connection edges + overlay states) as the spike target. The spike MUST fail-fast if real node counts exceed what was tested.
- Mock tree data must represent structural complexity of a real Last Epoch passive tree: circular nodes of 3 size variants, connection edges (directed lines), multi-tier prerequisite chains, and at least two simultaneously active glow/highlight overlay states
- Document actual real-world node count in `docs/pixi-spike-report.md` alongside FPS results
```

---

#### STORY-2: Story 1.3 — Game Data Source Hard Gate

**Finding:** Finding 7. The research task in Story 1.3 gates all downstream work. The current story text doesn't make the gate explicit enough — it reads as a soft recommendation.

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 1.3 Dev Notes

```
OLD:
- **Research task (first):** Audit community game data sources... Document chosen source, URL, format spec, and ToS notes in `docs/game-data-source.md`. This document must exist before implementing `game_data_service.rs`.

NEW:
- **HARD GATE — Implementation cannot proceed without this:** Audit community game data sources... Document chosen source, URL, format spec, and ToS notes in `docs/game-data-source.md`.
- **If no compliant source is found:** Escalate immediately. The fallback paths are: (a) build a community data scraper with explicit ToS approval from site operator, (b) generate data from game files directly (requires legal assessment), (c) manually curate a minimal dataset for one class as a proof-of-concept, then seek community contributors. Do not start `game_data_service.rs` without a viable source.
- This document gates: Story 1.4 (tree rendering), Story 1.5 (node interaction), Story 2.1 (build parser), Story 3.1 (scoring engine), Story 3.2 (Claude prompt), and Story 4.1 (context panel auto-fill).
```

---

#### STORY-3: Story 2.1 — Build Code Format Failure Mode

**Finding:** Finding 4. The research task for build code format has no contingency if the format is undocumented or proprietary.

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 2.1 Dev Notes

```
OLD:
- **Research task (first):** Audit the exact format of Last Epoch build code strings from lastepochtools.com... Document the format specification in `docs/build-code-format.md`. This document must exist before implementing `buildParser.ts`.

NEW:
- **HARD GATE:** Audit the exact format of Last Epoch build code strings from lastepochtools.com (and community tools). Document format spec in `docs/build-code-format.md`. This document must exist before implementing `buildParser.ts`.
- **Contingency if format is undocumented or proprietary:** (a) Contact lastepochtools.com maintainers to request documentation or partnership, (b) implement a "manual build entry" fallback (node-by-node allocation via Story 2.3's UI) as the primary onboarding path, (c) treat build code import as a Post-MVP enhancement until format is confirmed. Do not attempt to reverse-engineer a production app's format without explicit permission — this creates a fragile parser that breaks on every app update.
- The `buildParser.ts` must be written as a versioned adapter: `{ formatVersion: string, parse: (code: string) => ParseResult }` so format versions can be swapped without touching the caller.
```

---

#### STORY-4: Story 2.4 — Fix Auto-Save to Prevent Unintended Persistence

**Finding:** Finding 12. Story 2.3 creates builds with a default name (e.g., "Forge Guard"), making the auto-save condition "if the build already has a name" always true. New builds auto-save after the first node click without user intent.

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 2.4 Dev Notes

```
OLD:
- Auto-save: after every `applyNodeChange()`, trigger a debounced (500ms) `save_build` call if the build already has a name

NEW:
- Auto-save: after every `applyNodeChange()`, trigger a debounced (500ms) `save_build` call ONLY if `useBuildStore.activeBuild.isPersisted === true`
- `isPersisted` is set to `true` only after the first explicit user-triggered save (Ctrl+S or "Save Build" button)
- Default-named new builds are NOT auto-saved until the user saves explicitly at least once
- If the user clicks "Optimize" or closes the app on an unsaved build: show a non-blocking toast "Unsaved build — save it to keep your work? [Save Now]"
```

---

#### STORY-5: Story 2.4 — Fix Saved Builds List Command Name

**Finding:** Finding 13 (companion to ARCH-3).

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 2.4 Dev Notes

```
OLD:
- Implement `src-tauri/src/commands/build_commands.rs`: `save_build`, `load_builds`, `delete_build`, `rename_build`

NEW:
- Implement `src-tauri/src/commands/build_commands.rs`: `save_build`, `load_builds_list`, `load_build`, `delete_build`, `rename_build`
- `load_builds_list`: returns metadata only (id, name, classId, masteryId, created_at, updated_at) — no `data` column
- `load_build(id)`: returns full `BuildState` including `data` column, called only when user selects a build to open
```

---

#### STORY-6: Story 3.2 — Delta Ownership (Conditional on DECISION-1)

**Finding:** Finding 2. This change depends on Alec's choice of Path A or Path B.

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 3.2 Dev Notes

**If Path A is chosen (Claude owns deltas):**
```
ADD to Story 3.2 Dev Notes:
- **Delta ownership: Claude.** The `docs/claude-prompt-spec.md` must specify that Claude returns per-suggestion deltas in its JSON response (delta_damage, delta_survivability, delta_speed). `scoringEngine.ts` is NOT used for suggestion deltas — it computes baseline build scores only.
- Deltas in `SuggestionCard` come directly from Claude's parsed response. Label them "AI-estimated" in the tooltip: "Delta values are Claude's estimates based on game knowledge."
- `SuggestionResult` type must include the three delta fields from Claude's response.
```

**If Path B is chosen (App owns deltas):**
```
ADD to Story 3.2 Dev Notes:
- **Delta ownership: App.** The Claude prompt returns node change specifications only (from_node, to_node, points, explanation) — no delta values.
- After each suggestion is received and parsed, `scoringEngine.ts` runs synchronously: compute baseline score, apply the node change, compute post-change score, compute delta.
- Streaming UX impact: suggestions appear with a brief "computing..." state for the delta values (typically <50ms if scoring is fast). This is acceptable.
- `SuggestionResult` type: Claude provides { rank, from_node_id, to_node_id, points_change, explanation }; app adds { delta_damage, delta_survivability, delta_speed } after scoring.
- Story 3.1 (Scoring Engine) becomes a HARD PREREQUISITE for Story 3.2. Implement in that order.
```

---

#### STORY-7: Story 3.2 — Add NDJSON Prompt Contract Requirement

**Finding:** Finding 10 (companion to ARCH-4).

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 3.2 Dev Notes

```
ADD to Story 3.2 Dev Notes (under Claude prompt research task):
- The `docs/claude-prompt-spec.md` MUST specify NDJSON output format: one complete JSON object per line. This is a hard constraint that enables robust streaming parsing in `claude_service.rs`. Include example output in the spec document. Validate in prompt testing that Claude consistently produces NDJSON (not wrapped JSON, not markdown code blocks).
```

---

#### STORY-8: Story 3.3 — Add Context Panel Disclosure

**Finding:** Finding 9.

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 3.3 Dev Notes

```
ADD to Story 3.3 Dev Notes:
- When the user clicks "Optimize" with an empty context panel, display an inline non-blocking note below the Optimize button (not a blocking error): "Add gear, skills, and idols in the context panel for more relevant suggestions." This dismisses permanently once the user has populated any context panel field.
- Do NOT block optimization — skill-tree-only analysis is valid and useful.
```

---

#### STORY-9: Story 6.1 — Canvas Keyboard Accessibility Implementation Approach

**Finding:** Finding 6. The PixiJS canvas is a single `<canvas>` DOM element — individual nodes are not keyboard-accessible without explicit DOM scaffolding. The current dev note says "keyboard events caught at React level" without specifying how.

**File:** `_bmad-output/planning-artifacts/epics.md` — Story 6.1 Dev Notes

```
OLD:
- Tree keyboard focus managed by `useSkillTree.ts` — keyboard events caught at React level, not inside PixiJS

NEW:
- Tree keyboard focus managed by `useSkillTree.ts` using the **invisible focus overlay pattern**:
  - A positioned `<div>` overlay sits on top of the PixiJS canvas (same dimensions, `pointer-events: none` except when keyboard navigating)
  - For each node in the active tree, render a visually-hidden `<button>` element positioned at the node's canvas coordinates (updated when tree pans/zooms)
  - These buttons have `aria-label="[NodeName] — [state] — [effect]"` and handle `Enter`/`Space` to allocate/deallocate
  - The 2px accent-gold focus ring is a CSS outline on the button element — no PixiJS rendering needed for focus ring
  - `useSkillTree.ts` maintains `focusedNodeId: string | null`; PixiJS renderer reads this prop to optionally render a subtle visual highlight on the focused node (redundant with focus ring, but visible to sighted keyboard users at zoom)
  - When `focusedNodeId` changes (Tab, arrow keys), the corresponding hidden button receives `.focus()`
  - Performance: hidden buttons are only rendered/updated for visible viewport nodes (not the full tree). `ResizeObserver` + pan/zoom events trigger button position updates.
  - This pattern is used by Google Maps, Figma, and other canvas-heavy apps for keyboard/screen reader accessibility.
```

---

### P2 — New Story Needed

---

#### NEW-STORY: Story 5.5 — Distribution Readiness: Code Signing & Release Pipeline

**Finding:** Finding 11. Code signing certificates are required for Windows SmartScreen bypass and macOS Gatekeeper clearance. Without them, the installer triggers security warnings that will deter the community adoption the PRD targets. No story, task, or budget allocation addresses obtaining these.

**Add to Epic 5 in `_bmad-output/planning-artifacts/epics.md`:**

```
### Story 5.5: Distribution Readiness — Code Signing & Release Pipeline

As an advanced Last Epoch player downloading LEBOv2,
I want the installer to open without a Windows SmartScreen warning or macOS Gatekeeper block,
So that I can install the tool without clicking through scary security prompts or disabling OS security.

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
**Then** Windows binary is signed with Authenticode certificate before packaging
**And** macOS binary is signed with Developer ID certificate and notarized via Apple's notarization service before packaging
**And** the signed binaries are uploaded to GitHub Releases automatically

**Dev Notes:**
- **Prerequisites (must be completed before this story):**
  - Windows Authenticode (OV) certificate: purchase from DigiCert, Sectigo, or equivalent CA (~$300–500/year). EV certificates are preferred (no SmartScreen warning on first run) but cost more (~$400–700/year). OV certificates build reputation over time.
  - Apple Developer Program membership ($99/year): enroll at developer.apple.com
  - Store certificate files as GitHub Actions secrets: `WINDOWS_CERTIFICATE` (base64 PFX), `WINDOWS_CERTIFICATE_PASSWORD`, `APPLE_CERTIFICATE` (base64 P12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
- Update `.github/workflows/release.yml` to use `tauri-apps/tauri-action` signing options
- Verify notarization completes within CI timeout (Apple notarization can take 2–15 minutes)
- Test signed installers manually on a clean Windows VM and macOS machine before first public release
- **Budget note:** Allocate ~$400–800 for certificates before planning the public launch date
```

---

### P2 — Sequence / Dependency Clarifications

---

#### SEQ-1: Epic 3 Description — Add Epic 4 Dependency Note

**Finding:** Finding 15. Epic 4 (Context Panel) is sequenced after Epic 3 (AI Optimization) but provides better AI context. Users who adopt during Epic 3 delivery will form impressions based on context-free analysis.

**File:** `_bmad-output/planning-artifacts/epics.md` — Epic 3 description block

```
OLD:
### Epic 3: AI Optimization Engine
Users can select an optimization goal, trigger AI analysis...

NEW:
### Epic 3: AI Optimization Engine
Users can select an optimization goal, trigger AI analysis...

**Dependency note:** Context Panel data (Epic 4 — gear, skills, idols) improves suggestion relevance when populated. Epic 3 ships without Epic 4, meaning initial AI suggestions are based on skill tree nodes only. This is an intentional sequencing trade-off: the core value proposition (skill tree optimization) is validated before the context enrichment layer (gear/skill/idol context) is built. The UI discloses this limitation inline (Story 3.3). Community alpha release should coincide with Epic 4 completion, not Epic 3 completion, to maximize first-impression quality.
```

---

#### SEQ-2: Epic 3 Story Order — Clarify 3.1 → 3.2 Dependency

**Finding:** Finding 1 (scoring model) combined with DECISION-1 resolution.

**File:** `_bmad-output/planning-artifacts/epics.md` — Epic 3 intro or implementation order note

```
ADD (at the top of Epic 3 story list):
**Story implementation order within Epic 3:**
- Story 3.1 (Scoring Engine) MUST be spiked before Story 3.2 IF Path B (app-computed deltas) is chosen per DECISION-1.
- If Path A (Claude-computed deltas) is chosen, 3.2 and 3.1 can proceed in parallel (they are independent).
- Story 3.3 (Goal Selector) depends on Story 3.2 (streaming foundation) — do not build the UI trigger before the backend exists.
- Stories 3.4 and 3.5 depend on 3.2 and 3.3.
```

---

## Section 5: Implementation Handoff

### Change Scope Classification: **Moderate**

All changes are document edits, but the delta ownership decision (DECISION-1) requires architectural judgment from Alec, and the code signing story involves external procurement (certificates) with budget implications.

### Handoff Plan

| Change Group | Owner | Action |
|-------------|-------|--------|
| DECISION-1 (delta ownership) | **Alec** | Choose Path A or B; confirm in this document |
| ARCH-1 through ARCH-5 | **Architect Agent** or Alec | Edit `architecture.md` with approved changes |
| PRD-1 through PRD-3 | **PM Agent** or Alec | Edit `prd.md` with approved changes |
| STORY-1 through STORY-9 | **PO/Dev Agent** or Alec | Edit `epics.md` dev notes and acceptance criteria |
| NEW-STORY (5.5) | **Alec** | Procure certificates; add Story 5.5 to Epic 5 |
| SEQ-1, SEQ-2 | **PO Agent** or Alec | Add dependency notes to `epics.md` |

### Success Criteria

The document update phase is complete when:
- [ ] DECISION-1 is resolved and all delta-related document sections reflect the chosen path
- [ ] `BuildState` schema in `architecture.md` includes `contextData` and `isPersisted`
- [ ] FR30 is documented in `prd.md`
- [ ] NFR7 in `prd.md` correctly describes Stronghold (not OS keychain)
- [ ] Story 2.4 auto-save condition uses `isPersisted` not `hasName`
- [ ] Story 1.3 and 2.1 have explicit hard gates with contingency paths
- [ ] Canvas keyboard accessibility has a concrete implementation approach in Story 6.1
- [ ] Story 5.5 exists in Epic 5 with certificate procurement noted
- [ ] NDJSON constraint documented in ARCH-4 and STORY-7
- [ ] Epic 3 has an explicit dependency note on Epic 4

### Implementation Start Gate

**No implementation story should begin until:**
1. DECISION-1 is resolved by Alec
2. All P1 (Critical/High) document changes are applied
3. Story 1.3 research task (game data source) is completed — this is the single highest-risk item and should be the first action taken

---

*Sprint Change Proposal generated by bmad-correct-course workflow.*
*Awaiting Alec's review and approval.*
