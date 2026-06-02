---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-06-01'
workflowType: 'architecture'
project_name: 'LEBOv2'
user_name: 'Alec'
date: '2026-06-01'
phase: 'Phase 4 — Complete Build Tool'
scope: 'brownfield — extends the Phase 3 scoring-core engine, IPC surface, data pipeline, and React UI. Ten new/expanded subsystems (FR-1–FR-49).'
supersedes: 'Phase 3 architecture (frozen at _bmad-output/_phase3-archive/planning-artifacts/architecture.md)'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/addendum.md'
  - '_bmad-output/_phase3-archive/planning-artifacts/architecture.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - '_bmad-output/last-epoch-build-optimizer-UI-Handoff/ (Claude Design prototype)'
  - '_bmad-output/planning-artifacts/epics.md (Phase 3 breakdown — context)'
---

# Architecture Decision Document — LEBOv2 Phase 4 (Complete Build Tool)

_Brownfield. The Phase 3 architecture stands unchanged and is the technical foundation for this phase — the prior `scoring-core` crate, three-command IPC surface, four-store frontend, Modifier Registry, and `ClassModule` trait are all extended, not replaced. This document covers only the ten Phase 4 subsystems: (1) Complete Stats Engine to full game parity, (2) Stat Source Attribution, (3) Passive Tree Optimizer refinement, (4) Complete Build Optimizer, (5) Gear Item & Affix Pickers, (6) Gear Optimization screen rework, (7) full Claude Design UI/UX revamp, (8) data completeness (skills, icons, popular builds), (9) multi-allocate fix, (10) character import._

_The Phase 3 design anticipated this phase deliberately: `Option<T>` slots on `StatSheet` (`ailment`, `minion`), the open `Condition` enum, the forward-compatible affix schema, and the pure-crate boundary were all built as Phase 4 expansion joints. Phase 4 fills them in. Where Phase 3 said "populated Phase 4," this is that population._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements (FR-1–FR-49, ten feature groups):**

| Group | FRs | Architectural surface |
|---|---|---|
| §4.1 Complete Stats Engine | FR-1–11 | `scoring-core` — full damage-type, defensive-layer, ailment, attribute, minion coverage; tunklab-aligned EHP/Ward |
| §4.2 Stat Source Attribution | FR-12–14 | `scoring-core` `ModifierSource` propagation; `compute_stats` response gains `stat_sources` |
| §4.3 Passive Tree Optimizer (refined) | FR-15–19 | `run_optimization` output scope-restricted to `passive_node`; PixiJS suggestion-overlay overhaul |
| §4.4 Complete Build Optimizer | FR-20–26 | New full-screen view + new `run_complete_optimization` command + `complete-opt:*` event namespace + CSS orb |
| §4.5 Gear Item & Affix Pickers | FR-27–29 | Modal components; affix prefix/suffix discriminator added to schema |
| §4.6 Gear Optimization screen | FR-30–32 | Three-column rework of `gear-optimization/`; native HTML5 drag-drop |
| §4.7 UI/UX revamp | FR-33–39 | Design-token value reconciliation; component rebuild to Claude Design; `CenterTab` union expansion |
| §4.8 Data completeness | FR-40–43 | 133-skill DB, full icon set, bundled `popular-builds.json` |
| §4.9 Multi-allocate fix | FR-44–45 | `buildStore` bulk allocate/remove actions; single undo step |
| §4.10 Character import | FR-46–49 | New Tauri `character_import.rs` (offline save parsing); online stub gated on EHG API |

**Non-Functional Requirements driving architecture:**

- **SM-1 / ±2% tunklab parity** — defensive math must reproduce the tunklab EHP/Ward calculators' observable outputs, not an independently-derived formula. Drives a dedicated reference-fixture test suite.
- **SM-2 / SM-C2** — Stat Source Breakdown tooltip < 50ms; source tracking must add < 20ms to `compute_stats` round-trip. Drives the additive, opt-in `track_sources` design.
- **NFR carried from Phase 3** — `compute_stats` < 16ms (rAF-debounced, Stage-1 path), full pipeline < 100ms, all values data-driven (no numeric constants in source), pluggable class modules, formula regression fails CI, offline-only except the Claude/OpenRouter call.
- **SM-C1** — Optimization Orb animation must never delay result rendering; results appear within 500ms of backend return regardless of animation state. Drives a hard decoupling of the CSS animation from the IPC result path.
- **SM-5** — Item Picker search < 100ms over the full item DB. Drives a client-side prebuilt search index.

### Scale & Complexity

- Complexity: **High** — the stat engine roughly triples in stat coverage; a second full-pipeline optimization flow (Complete Build Optimizer) is added; the entire UI is rebuilt to a new design system; a binary save-file parser must be reverse-engineered.
- Primary domains: **Rust scoring engine** (stat parity, sources, multi-domain optimization) + **React/PixiJS UI** (full revamp, two new full-screen views, three modals) + **Rust file I/O** (save import).
- Estimated new/modified components: ~6 new `scoring-core` modules, 1 new Tauri command module + 3 new commands, ~2 extended commands, 2 new full-screen views, 3 modals, ~8 rebuilt panels, 1 new bundled database, 1 new Rust import module.
- This is the largest phase to date and the one "a player would pay for" (PRD §1). It is still brownfield — no greenfield rewrite, no new runtime, no new framework.

### Technical Constraints & Dependencies

- **Modifier Registry is the load-bearing inheritance.** The Phase 3 registry (`modifier.rs`) was explicitly built so that "adding ailment stacking means adding a `StatKey` and a `ModifierType` variant — the registry absorbs them with zero changes to existing computation logic." Phase 4's full stat parity is exactly this exercise. The architecture must not introduce a parallel computation path that bypasses the registry.
- **Data gate, again.** Phase 3 closed the `modifierType`/`scope` schema gap. Phase 4 has two new data dependencies: the **affix prefix/suffix discriminator** (OQ-2; also a deferred-work item) and the **completed 133-skill database + icons** (§4.8). The affix discriminator blocks FR-28 (Affix Picker) and correct suffix-side gear scoring. Treat it as Phase 4's critical-path data gate, the way Epic G was Phase 3's.
- **Brownfield IPC discipline unchanged.** All new commands follow `invokeCommand<T>()`, register in `lib.rs invoke_handler!`, use `#[serde(rename_all = "camelCase")]` on input structs and default snake_case on outputs. No new IPC patterns.
- **Four-store rule unchanged.** No new top-level Zustand store. Complete Build Optimizer state extends `optimizationStore`; the new full-screen views extend `appStore.currentView`.
- **Save-file format is unknown until a spike resolves it (OQ-8).** FR-48 cannot be sized until a Rust parsing spike against the community save-editor format (gaconvt159/last-epoch-save-editor) succeeds. The architecture provides the module boundary and a documented fallback (shell-invoke the community Java tool, parse its JSON), but the binary format itself is a research deliverable, not an architecture deliverable.
- **EHG online API is partner-gated (OQ-7).** FR-49 ships as a wired stub returning "API access pending"; the real endpoint substitutes in later with no UI change.

### Cross-Cutting Concerns Identified

1. **Source tracking vs. hot-path cost** — `ModifierSource` collection is acceptable on the single display `compute_stats` call but forbidden inside the knapsack/scan hot loops. Resolved by an opt-in `ComputeOptions.track_sources` flag (see ADR-P4-002).
2. **Two optimization flows sharing one engine** — the refined Passive Tree Optimizer (single-domain) and the Complete Build Optimizer (multi-domain) must reuse `scoring-core` without duplicating scoring logic. Resolved by a shared `run_complete_optimization` that composes the existing stage functions across a scope mask (ADR-P4-004).
3. **Design-token reconciliation** — the codebase uses `--color-*` tokens; the handoff uses `--*` tokens with different gold/rarity values. A rename would churn every component and `rarityColors.ts`. Resolved by a values-only update plus additive tokens (ADR-P4-007).
4. **Defensive-floor results: warning vs. suggestion** — FR-15 forbids the floor check from appearing in Passive Tree Optimizer output. The check still runs and still feeds the stat-sheet warnings and the Complete Build Optimizer. Resolved by separating "compute warnings" (always) from "emit suggestions" (scope-filtered) at the command boundary (ADR-P4-003).

---

## Starter Template Evaluation

**Not applicable — brownfield continuation.** No starter template is evaluated or introduced. The technology stack is locked, pinned, and verified in `project-context.md` (last updated 2026-05-30) and unchanged since Phase 3:

- **Shell:** Tauri 2.x (`@tauri-apps/api ^2`, `tauri-plugin-*` 2.x)
- **Frontend:** React 19.1, TypeScript ~5.8.3 (strict), Vite 7.0.4, Tailwind v4.2.2 (CSS-first, no config file)
- **Canvas:** PixiJS 8.18.1 + `@pixi/react` 8.0.5
- **State:** Zustand 5.0.12 (four domain stores)
- **UI primitives:** `@headlessui/react` 2.2.10; toasts `react-hot-toast`
- **Backend (Rust):** Tauri 2, serde/serde_json 1, rusqlite 0.32, reqwest 0.12, tokio 1, argon2 0.5; **`rayon`** (added Phase 3, inside `scoring-core` only)
- **Testing:** Vitest 4.1.4 + Testing Library + jsdom + vitest-axe; `cargo test -p scoring-core`

**New dependencies introduced by Phase 4:** **none mandatory on the frontend.** Two Rust-side considerations are evaluated under ADR-P4-010 (character import): the save-file parser uses only `std` + existing `serde_json` if the binary format is JSON-like; a parsing-helper crate (e.g. `nom`/`binrw`) is admitted **only if** the OQ-8 spike proves the format requires it. Native HTML5 drag-and-drop is used for the Gear Optimization screen (ADR-P4-006) specifically to avoid a new frontend dependency.

**Rationale:** versions are inherited from a working, shipping Phase 3 build verified one day before this document. Re-deriving or re-pinning them would add risk, not value. The first implementation story is not a project init; it is the affix prefix/suffix discriminator data gate (see Handoff).

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (block implementation):**
- **D-P4-1** — `ModifierType` enum migration (`Option<String>` → serde enum). Blocks all FR-1 stat-engine work; also clears a deferred-work item.
- **D-P4-2** — Affix prefix/suffix discriminator on `AffixEntryV2`/`GearAffixV2`. Blocks FR-28 Affix Picker and correct suffix-side gear scoring. Phase 4's data-gate equivalent of Epic G.
- **D-P4-3** — `stat_sources` response shape and `ComputeOptions.track_sources` flag. Blocks FR-12–14.
- **D-P4-4** — `run_complete_optimization` command + `complete-opt:*` events + scope mask. Blocks FR-20–26.
- **D-P4-5** — `appStore.currentView` and `CenterTab` union expansion. Blocks the two new full-screen views and the Skills/Weaver tab rework.

**Important (shape the architecture):**
- ADR-P4-001 `scoring-core` module split; ADR-P4-005 popular-builds data placement; ADR-P4-007 design-token reconciliation; ADR-P4-010 character-import module boundary.

**Deferred (post-Phase 4 / Phase 5):**
- Weaver Tree full PixiJS renderer (PRD non-goal — opt-in scope checkbox only).
- Full attribute → secondary-stat conversion tables (FR-9 caps Phase 4 at attribute totals + parseable conversions only).
- Online character import going live (gated on EHG API partnership, OQ-7).
- Node/tree art-asset fidelity, environment art (Phase 5 non-goals).

---

### ADR-P4-001 — `scoring-core` Module Split for Full Stat Parity

**Decision:** Split the growing `compute.rs` into a `compute/` submodule directory before adding Phase 4 stat coverage. Stat parity roughly triples the computation surface; one file would become unmaintainable and would obscure which math maps to which FR.

```
scoring-core/src/
  compute.rs          → becomes compute/mod.rs: orchestrates, owns compute_stats() entry
  compute/
    offense.rs        FR-1,2,3,4: per-damage-type increased/more, crit, attack/cast speed, AoE
    penetration.rs    FR-4: elemental + physical penetration
    defense.rs        FR-5: armor, endurance, dodge, parry, block, glancing, crit-avoidance, resistances
    ehp.rs            FR-6: EHP vs Hits / DoTs / 1-shots (tunklab-aligned, multiplicative layers)
    ward.rs           FR-7: Stable Ward + Stable HP equilibrium
    ailment.rs        FR-8: bleed/ignite/poison/freeze/shock/armour-shred chances + avoidance
    attributes.rs     FR-9: Str/Dex/Int/Att totals + parseable conversions only
    minion.rs         FR-10: minion count/damage/HP/speed (populates Option<MinionStats>)
  modifier.rs         EXTENDED: ModifierType enum migration; new StatKey variants
  stat_sheet.rs       EXTENDED: OffenseStats/DefenseStats expanded; AilmentStats/MinionStats filled in
```

**Rationale:** Each module maps 1:1 to a PRD feature sub-section, so a story and its acceptance criteria land in exactly one file. The `compute/mod.rs` orchestrator still exposes the single pure `compute_stats(snapshot, game_data, options) -> StatSheet` entry — the IPC contract and the `compute_stats` Tauri command are unchanged. The Modifier Registry remains the only data source for every module: each `compute/*` module queries the registry by `StatKey` and applies modifiers in `flat → increased → more` order. No module reads raw snapshot fields directly for stat math.

**EHP/Ward special note (FR-6/FR-7, SM-1):** `ehp.rs` and `ward.rs` implement the tunklab calculators' **observable behavior** — same inputs produce the same outputs — rather than a re-derived closed-form formula. Layers apply multiplicatively (armor DR × resistance DR × endurance DR × avoidance), with `EHP vs DoTs` excluding dodge/parry/block and `EHP vs 1-shots` treating the endurance threshold as a hard floor. Concrete reference builds with known tunklab outputs live in `scoring-core/tests/ehp_reference.rs`; the ±2% tolerance (SM-1) is asserted there and gates CI.

**Rejected:** keep one `compute.rs` — would exceed maintainable size and scatter FR traceability; defeats the per-story acceptance-criteria mapping the BMAD flow depends on.

---

### ADR-P4-D-P4-1 — `ModifierType` Enum Migration

**Decision:** Replace `modifier_type: Option<String>` (and the affix `scope`/`modifierType` `String` fields) with proper serde enums, deserialized once at game-data load.

```rust
#[derive(Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModifierType { Flat, Increased, More, Conversion }

// Unknown / absent → default Increased (preserves the Phase 3 fallback contract)
impl Default for ModifierType { fn default() -> Self { ModifierType::Increased } }
```

`scope` (`melee|ranged|spell|minion|generic`) and the new affix `position` (below) become enums by the same pattern. This closes four related deferred-work items (`modifier_type: Option<String>`, "narrow union types not validated in Rust", "`affix_class`/`scope` unvalidated strings", "open `String` vs closed union at IPC boundary").

**Rationale:** Phase 4 scoring depends on `more` vs `increased` being correct for every damage type — a silent typo (`"More"`, `"MELEE"`) currently misdirects a modifier with no error. Validating at the deserialization boundary makes bad game data fail loudly at load, not silently at score time. The fallback-to-`Increased` contract relied on by existing tests is preserved via `Default` + `#[serde(default)]`.

**Migration safety:** game data JSON already stores these as lowercase strings; the enum's `rename_all = "lowercase"` matches existing files with no re-ingestion. This is a Rust-side type tightening, not a data format change.

---

### ADR-P4-D-P4-2 — Affix Prefix/Suffix Discriminator (Phase 4 Data Gate)

**Decision:** Add `position: 'prefix' | 'suffix'` to `AffixEntryV2` (TypeScript) / `GearAffixV2` and to the Rust affix type, populated by the data-ingestion pipeline. (OQ-2 resolved in favour of a single discriminator field, not parallel `prefixes[]`/`suffixes[]` arrays.)

**Rationale:** A single `position` field is the minimal change that unblocks three things at once: FR-28's grouped Affix Picker, FR-29's prefix/suffix pip display, and correct suffix-side gear scoring (today `buildSnapshotSerializer.ts` classifies *all* gear affixes as prefixes and `detect_mismatched_affixes` never sees suffixes — two standing deferred-work items). Parallel arrays would force a `GearItemV2` shape change and ripple through every gear consumer; a discriminator field is additive and back-compatible (absent → treat as prefix, matching today's behavior until data is populated).

**Gate status:** This is the critical-path data dependency for the gear features (§4.5, §4.6) and must be the **first story** of the gear epic, exactly as Epic G's schema annotation was Phase 3's first gate. Engine and UI work proceeds against mock-annotated affixes until ingestion completes.

---

### ADR-P4-D-P4-3 — Stat Source Attribution: Response Shape & Opt-In Tracking

**Decision:** `ModifierSource` (per PRD addendum A) is attached to every `Modifier` as it is consumed, and surfaced as a new field on the `compute_stats` response. Tracking is opt-in via `ComputeOptions`.

```rust
pub struct ModifierSource {
    pub source_type:   SourceType,   // PassiveNode | GearSlot | Idol | Blessing | SkillNode | Condition
    pub source_label:  String,       // "Shadow Cascade", "Helm — Fire Resistance T5"
    pub value:         f64,
    pub modifier_type: ModifierType,
}

// StatSheet gains (only populated when options.track_sources == true):
pub stat_sources: Option<HashMap<String, Vec<ModifierSource>>>,  // key = StatKey string

pub struct ComputeOptions {
    pub track_sources: bool,  // true: display compute_stats path; false: scan/knapsack hot loops
    // ...existing options...
}
```

**Rationale:** SM-C2 caps source tracking at +20ms on the `compute_stats` round-trip. Source collection is a `Vec` append per modifier (~200–400 per build) — negligible for the single display call, but multiplied by hundreds of candidate paths in the Stage-3 scan it would blow the NFR-1 budget. The `track_sources` flag draws the line exactly where the addendum prescribes: **on** for the one display `compute_stats` call (the only place the tooltip data is needed), **off** everywhere the engine runs in a loop. `stat_sources` is `Option` so the scan path returns `None` and pays zero serialization cost.

**Frontend (FR-13/14):** the breakdown tooltip reads `statSheet.stat_sources[statKey]`, groups by `source_type`, and renders the grouped list with the pre-cap total and cap-gap annotation. The tooltip is a pure render of already-present data — no extra IPC call, satisfying SM-2's 50ms budget trivially.

---

### ADR-P4-D-P4-4 — Complete Build Optimizer: Command, Events, Scope Mask

**Decision:** A new async Tauri command `run_complete_optimization` composes the existing `scoring-core` stage functions across a **scope mask**, streaming results over a new `complete-opt:*` event namespace. It does **not** duplicate scoring logic.

```rust
// Input (camelCase from TS)
pub struct CompleteOptScope {
    pub passive_tree: bool,
    pub active_skills: bool,
    pub gear: bool,
    pub idols: bool,
    pub blessings: bool,
    pub weaver: bool,
}

#[tauri::command]
async fn run_complete_optimization(
    snapshot: BuildSnapshot,
    scope: CompleteOptScope,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let game_data = state.game_data.read().unwrap().clone();   // clone, release lock (Pattern 3)
    tokio::task::spawn_blocking(move || {
        // reuse existing stage fns; gate each by the scope mask
        if scope.passive_tree { /* scan.rs + knapsack */ }
        if scope.gear         { /* gear.rs */ }
        if scope.idols        { /* idol recommendation pass (new in idol.rs) */ }
        // synergy detection always runs across whatever is in scope
    }).await.map_err(|e| format!("SCORING_ERROR: {e}"))?
}
```

| Command | Sync/Async | Trigger | Scope | Events |
|---|---|---|---|---|
| `compute_stats` (extended) | Sync | every state change | Stage 1 + optional sources | — (direct return) |
| `run_optimization` (extended) | Async | "Optimize Build" (right panel) | passive tree only — output **filtered to `passive_node`** | `optimization:*` |
| `run_gear_scoring` | Async | Gear Optimization screen | gear (Stage 1 + 4) | `gear:*` |
| `run_complete_optimization` (NEW) | Async | Complete Build Optimizer "Optimize" | scope mask: tree+skills+gear+idols+blessings(+weaver) | `complete-opt:suggestion-received`, `complete-opt:complete`, `complete-opt:error` |

**Events:** `complete-opt:suggestion-received` (incremental, carries a domain badge per FR-25), `complete-opt:complete`, `complete-opt:error`. A new `useCompleteOptStream.ts` hook in `shared/stores/` subscribes — mirroring `useOptimizationStream`/`useGearStream` exactly. The existing two streams are untouched.

**Idol recommendations (FR-26, OQ-6):** the idol-scope pass builds a **filtered** idol-database subset for the Claude payload (only idol types/affixes relevant to the build's damage types and empty grid cells), never the full idol DB — resolving the OQ-6 token-budget concern. Recommended placements are validated against existing placed idols via the same `validatePlacement()` used by the editor.

**Rejected:** a `mode` flag on `run_optimization` — re-rejected for the same reason Phase 3 rejected it (couples distinct user triggers into one handler; defeats independent testability). Four discrete commands map to four discrete triggers.

---

### ADR-P4-D-P4-5 — View & Tab Topology Expansion

**Decision:** Extend the existing enums; introduce no router (the no-React-Router rule holds).

```ts
// appStore — two new full-screen views
type CurrentView = 'main' | 'settings' | 'gear-optimization' | 'complete-optimizer'  // + 'complete-optimizer'

// appStore — center tab bar gains Weaver as a first-class tab sibling of Passive Tree
type CenterTab = 'tree' | 'weaver' | 'gear' | 'skill' | 'idol' | 'blessing'           // + 'weaver'
// keys 1–6 switch tabs (was 1–5); a visual divider separates {tree, weaver} from {gear, skill, idol, blessing}
```

**Rationale:** The Claude Design handoff models Complete Build Optimizer and Gear Optimization as header-nav full-screen views (`view: 'complete' | 'gearopt'`) and the center tab bar as six tabs with a divider after Weaver (FR-36). The existing `currentView` union and `centerTab` union are the precedent for both — extending them is consistent with the established pattern and avoids a router. Per-skill specialization trees (the old `SkillTreeTabBar` slots 1–5) are accessed *inside* the Skill tab's editor (FR-43), not as top-level center tabs; the passive and weaver trees are the two canvas tabs. `Esc` returns to `main` from any full-screen view (FR-33), matching the handoff's keydown handler.

**Cross-highlight handle (FR-18):** `SkillTreeCanvasHandle` gains `focusNode(nodeId: string)` alongside the existing `fitToTree()` — it smoothly pans/zooms the PixiJS viewport to center a suggested node. This keeps the canvas props-only and ref-driven; no store access inside the canvas.

---

### ADR-P4-005 — Popular Builds Database Placement

**Decision:** `popular-builds.json` is a bundled Tauri resource (schema per addendum C), loaded once at startup into `gameDataStore` as `popularBuilds: PopularBuild[] | null`. It follows the **`conditions.json` pattern, not the staleness pattern** — bundled, updated with app releases, never network-stale.

**Rationale:** FR-42 requires ≥3 builds per mastery × 15 masteries (≥45 entries), curated per Season patch from maxroll.gg/lastepochtools.com. The data changes with game patches, not player-initiated updates — identical to `conditions.json`, which Phase 3 deliberately excluded from the network staleness pipeline. The FR-23 matching logic (filter by `mastery`, sort by skill-overlap count, return top 3) runs entirely client-side with no network request, satisfying the offline NFR.

---

### ADR-P4-006 — Gear Drag-and-Drop Primitive

**Decision:** Native HTML5 drag-and-drop (`draggable`, `onDragStart`/`onDragOver`/`onDrop`) for the Gear Optimization screen's database-card → paper-doll-slot interaction (FR-31). No new dependency.

**Rationale:** The interaction is simple — drag a card onto one of 11 typed slots, with gold/red validity highlighting. Native HTML5 DnD covers it; pulling in `@dnd-kit` or `react-dnd` would violate the "no new frontend dependencies" preference for a feature this contained. The idol grid keeps its existing click-to-place model (already shipped in Phase 3), so DnD is needed in exactly one place. Double-click-to-equip (FR-31) is a plain `onDoubleClick` fallback.

---

### ADR-P4-007 — Design-Token Reconciliation

**Decision:** Keep the existing `--color-*` token **names**; update their **values** to the Claude Design palette and add the missing tokens. No rename.

| Token (existing name) | New value (from handoff) |
|---|---|
| `--color-accent-gold` | `#C9A84C` |
| `--color-bg-base` / `-surface` / `-elevated` / `-hover` | `#0A0A0B` / `#141417` / `#1C1C21` / `#252530` |
| `--color-node-suggested` | `#7B68EE` |
| rarity tokens (via `rarityColors.ts`) | normal `#C6C0B5`, magic `#4A7A9E`, rare `#C9A84C`, set `#5EBD78`, unique `#D4805A`, legendary `#B068E8` |
| NEW: `--color-bg-sunken` | `#060607` |

**Rationale:** The codebase references `--color-*` everywhere and `rarityColors.ts` keys off them; the handoff uses unprefixed `--*` tokens with a different gold and an added legendary rarity. Renaming tokens would touch every component and the rarity utility for zero visual benefit. Updating values in the single global stylesheet (Tailwind v4 CSS-first, no config file) re-skins the whole app at once, and `rarityColors.ts` keeps working. FR-7 also revises Phase 3's rarity hex list (`#E87722` unique → `#D4805A`, etc.) — this is the place that reconciliation lands. Components are then rebuilt to the Claude Design layout (FR-33–39) consuming these tokens — a faithful recreation, not a wrapping of the prototype JSX (PRD §4.7).

---

### ADR-P4-010 — Character Import Module Boundary

**Decision:** Save-file scanning and parsing live in a **new Tauri-crate module `character_import.rs`**, never in `scoring-core` (which stays pure, no I/O). Three new commands; online import is a wired stub.

```rust
// src-tauri/src/character_import.rs
#[tauri::command] fn scan_save_files() -> Result<Vec<DetectedCharacter>, String>;   // FR-47
#[tauri::command] fn parse_save_file(path: String) -> Result<ImportedBuild, String>; // FR-48
#[tauri::command] async fn import_online_character(account: String, character: String)
    -> Result<ImportedBuild, String>;                                                // FR-49 — stub
```

- **Offline (FR-47/48):** `scan_save_files` checks both known paths (Steam `userdata/.../899770/...Saves/` and AppData `LocalLow/Eleventh Hour Games/Last Epoch/Saves/`), parses the `1CHARACTERSLOT_BETA_###` header for name+class, and returns the list. `parse_save_file` extracts `charClass`, `level`, `charTree`, `skillTrees`, `equipment` into an `ImportedBuild` that maps to a new `BuildState`. Unresolved item/node IDs are reported in a post-import summary (FR-48), and the import creates a new named build (preserving the prior one).
- **Spike gate (OQ-8):** the binary format is reverse-engineered from the community save-editor source before the FR-48 story is written. Documented fallback: shell-invoke the community Java tool and parse its JSON output. The module boundary and command signatures are stable regardless of which path the spike chooses.
- **Online (FR-49, OQ-7):** `import_online_character` returns `Err("CHARACTER_IMPORT_ERROR: API access pending")` until EHG partnership is granted. The UI (two-tab modal) and the command are fully built; only the endpoint + auth headers substitute later. A new `CHARACTER_IMPORT_ERROR` prefix is added to `ErrorType`/`errorNormalizer.ts` (Story-0 setup task, same discipline as Phase 3's `SCORING_ERROR`).

**Rationale:** File I/O and OS-path logic belong in the Tauri crate by the project's "all backend logic in Rust, `scoring-core` stays pure" rule. Keeping the parser out of `scoring-core` preserves the crate's WASM-readiness and no-mock unit-test guarantee. The stub-with-real-UI approach for online import lets the whole import surface ship now and light up later with zero rework.

### Cross-Component Dependencies

```
D-P4-2 (affix prefix/suffix discriminator)   ← Phase 4 critical-path data gate
  ↓ unblocks
§4.5 Affix Picker  +  correct suffix-side gear scoring (gear.rs, serializer)

D-P4-1 (ModifierType enum)
  ↓ unblocks
§4.1 Complete Stats Engine (compute/* modules)
  ↓ enables
§4.2 Stat Source Attribution (track_sources)  →  Source Breakdown tooltip
  ↓ feeds
§4.4 Complete Build Optimizer (full-picture analysis)  →  run_complete_optimization
                                                          →  complete-opt:* / useCompleteOptStream

§4.8 popular-builds.json  →  FR-23 skill suggestion (Complete Build Optimizer gate)
§4.7 token reconciliation →  whole-app re-skin  →  component rebuilds (FR-33–39)
§4.10 character import     →  independent; gated only by OQ-8 spike (offline) / OQ-7 (online)
```

The affix discriminator and the `ModifierType` enum are the two gates; everything else parallelizes behind mock data, exactly as Phase 3 ran behind Epic G.

---

## Implementation Patterns & Consistency Rules

All Phase 3 patterns (Patterns 1–7) remain in force and are **not** repeated. `project-context.md`'s 85 rules remain authoritative. The following are **additive** Phase 4 patterns.

### Pattern P4-1 — Stat math reads the registry, never the snapshot

**Conflict:** An agent adding a Phase 4 stat (e.g. Parry, a new ailment) might read `snapshot.gear[...]` or a passive allocation directly to compute it — bypassing the Modifier Registry and re-introducing the "formula not data-transformation" trap the Phase 3 architecture warned against.

**Rule:** Every `compute/*` module computes its stats **only** by querying `ModifierRegistry` for `StatKey`s. Sources register their modifiers once (`module.apply_modifiers` + the snapshot-ingest pass); computation queries and applies `flat → increased → more`. New stats = new `StatKey` variants + new modifier registrations, never a new direct-read code path.

```rust
// Correct — registry query
let inc = registry.query(StatKey::IncreasedFireDamage, conds).iter().map(|m| m.value).sum();
// Wrong — direct snapshot read for a stat value
let inc = snapshot.gear.values().filter(|a| a.stat == "fire").map(...).sum();
```

### Pattern P4-2 — `track_sources` is on only for the display call

**Rule:** `ComputeOptions.track_sources` is `true` exactly once: the `compute_stats` call driven by `useStatSheet`. Every scan/knapsack/gear/complete-opt internal `compute_stats` call passes `track_sources: false`. An agent must never enable source tracking inside a loop. `stat_sources` is `Option`; loop paths return `None`.

### Pattern P4-3 — Warnings always compute; suggestions are scope-filtered

**Conflict:** FR-15 forbids the defensive floor check from appearing as a Passive Tree Optimizer suggestion, but the check must still drive stat-sheet warnings (FR-14) and Complete Build Optimizer output.

**Rule:** The floor check runs inside `compute_stats` and always populates `StatSheet.warnings`. **Emitting suggestions** is a separate, command-level concern: `run_optimization` filters its output to `suggestion.kind == PassiveNode` only. Floor-derived gear/resistance suggestions appear **only** in `run_complete_optimization` when `scope.gear == true`. Never emit a non-`passive_node` suggestion from `run_optimization`.

### Pattern P4-4 — `complete-opt:*` is its own event namespace

**Rule:** Complete Build Optimizer streaming uses `complete-opt:suggestion-received` / `complete-opt:complete` / `complete-opt:error` exclusively. Never reuse `optimization:*` or `gear:*`. A dedicated `useCompleteOptStream.ts` subscribes; the other two stream hooks are not modified. (Direct parallel to Phase 3 Pattern 6.)

### Pattern P4-5 — Orb animation is decoupled from results (SM-C1)

**Conflict:** An agent might gate result rendering on the orb animation completing (`(N+2) × 620ms`), delaying results.

**Rule:** The Optimization Orb (CSS, per addendum D — `.orb-overlay`/`.orb-ring`/`.orb-core`/`.orb-token`/`.orb-status`) is a pure presentational overlay driven by a local timer. Results render the instant `complete-opt:complete` arrives, regardless of orb step. If results arrive before the animation finishes, the orb snaps to complete and the results panel slides in (≤500ms, SM-C1). The orb never blocks, awaits, or sequences the IPC result path. `prefers-reduced-motion` collapses the orb to a static progress indicator.

### Pattern P4-6 — Recommendations are constrained to payload IDs

**Conflict:** Claude could return a gear/idol recommendation referencing an item or affix ID not in the payload (hallucination), and the UI might render it.

**Rule:** For `run_gear_scoring` and `run_complete_optimization`, the Claude payload includes the exact catalog subset of candidate IDs, and the frontend **rejects** any recommendation whose ID is absent from that subset before display (FR-32 / FR-26). Slots with no meaningful upgrade are omitted, never rendered as placeholder suggestions.

### Pattern P4-7 — Batch allocate/remove is a single undo step

**Conflict:** Shift+click fill (FR-44) and right-click remove-all-with-orphan-cascade (FR-45) could push N separate undo entries.

**Rule:** Bulk operations push exactly **one** snapshot onto `undoStack`. New `buildStore` actions `fillNodeToMax(nodeId)` and `removeAllPoints(nodeId)` snapshot once, then apply the full batch. `removeAllPoints` runs the prerequisite/orphan check first; if removal orphans allocated children it deallocates them in the same single step after the confirmation prompt naming the orphaned nodes (FR-45). Never implement these as a loop of single `applyNodeChange` calls.

### Pattern P4-8 — Token reconciliation is values-only

**Rule:** Never rename a `--color-*` token or introduce an unprefixed `--*` token from the prototype. Update values in the global stylesheet and add new tokens under the `--color-*` namespace. All rarity/damage-type colors continue to route through `rarityColors.ts` — never hardcode the new hex values inline (existing rule, reaffirmed).

### Enforcement Summary

**All agents implementing Phase 4 work MUST:**

1. Compute every stat via `ModifierRegistry` queries — never read snapshot fields for stat math (P4-1).
2. Enable `track_sources` only on the single display `compute_stats` call (P4-2).
3. Keep floor-check **warnings** in `compute_stats` and floor-derived **suggestions** out of `run_optimization` (P4-3).
4. Use `complete-opt:*` events for the Complete Build Optimizer; add `useCompleteOptStream.ts` (P4-4).
5. Never let the orb animation gate result rendering (P4-5).
6. Reject Claude recommendations whose IDs are not in the payload subset (P4-6).
7. Make batch allocate/remove a single undo step via dedicated store actions (P4-7).
8. Reconcile design tokens by value only, under the `--color-*` namespace (P4-8).
9. Add `CHARACTER_IMPORT_ERROR` (and reuse `SCORING_ERROR`) to `ErrorType`/`errorNormalizer.ts` as Story-0 setup tasks.
10. Migrate `ModifierType`/`scope`/`position` to serde enums; never branch on raw strings (D-P4-1).

---

## Project Structure & Boundaries

New additions and modifications only. Everything under `lebo/src/` and `src-tauri/` not listed here is unchanged from Phase 3.

### File Tree (new / modified)

```
lebo/
├── src/
│   ├── shared/
│   │   ├── types/
│   │   │   ├── statSheet.ts                 ← EXTENDED  AilmentStats/MinionStats filled in;
│   │   │   │                                            OffenseStats/DefenseStats expanded (all
│   │   │   │                                            damage types, all defensive layers, EHP×3,
│   │   │   │                                            Stable Ward); + ModifierSource, SourceType;
│   │   │   │                                            stat_sources field on StatSheet
│   │   │   ├── gameData.ts                   ← EXTENDED  AffixEntryV2.position; PopularBuild
│   │   │   ├── build.ts                      ← EXTENDED  ImportedBuild → BuildState mapping types
│   │   │   ├── optimization.ts               ← EXTENDED  CompleteOptScope, CompleteOptSuggestion (domain badge)
│   │   │   └── errors.ts                     ← EXTENDED  CHARACTER_IMPORT_ERROR
│   │   ├── utils/
│   │   │   ├── buildSnapshotSerializer.ts    ← MODIFIED  emit affix position (suffix-side fix)
│   │   │   ├── errorNormalizer.ts            ← EXTENDED  CHARACTER_IMPORT_ERROR map entry
│   │   │   └── popularBuildMatch.ts          ← NEW       FR-23 client-side mastery/skill-overlap match
│   │   └── stores/
│   │       ├── optimizationStore.ts          ← EXTENDED  completeOpt state; statSheet.stat_sources consumer
│   │       ├── gameDataStore.ts              ← EXTENDED  popularBuilds: PopularBuild[] | null
│   │       ├── appStore.ts                   ← EXTENDED  currentView += 'complete-optimizer'; CenterTab += 'weaver'
│   │       └── useCompleteOptStream.ts       ← NEW       complete-opt:* listener hook
│   ├── features/
│   │   ├── stat-sheet/
│   │   │   ├── StatSheetPanel.tsx            ← MODIFIED  5-tab General/Offense/Defense/Minion/Other (addendum F)
│   │   │   └── StatSourceTooltip.tsx         ← NEW       FR-13/14 grouped source breakdown + cap gap
│   │   ├── optimization/
│   │   │   ├── SuggestionCard.tsx            ← MODIFIED  FR-19 format; cross-highlight (FR-18)
│   │   │   └── scoringEngine.ts              ← DELETE    (Phase 3 follow-up; superseded by Rust engine)
│   │   ├── complete-optimizer/               ← NEW feature folder (§4.4)
│   │   │   ├── CompleteOptimizerView.tsx
│   │   │   ├── ScopeSelector.tsx             ← FR-21 checkboxes + fill-status labels
│   │   │   ├── CompletenessGate.tsx          ← FR-22 inline red alerts + "Go to [Section]"
│   │   │   ├── OptimizationOrb.tsx           ← FR-24 CSS orb (Pattern P4-5)
│   │   │   ├── UnifiedSuggestionList.tsx     ← FR-25 domain-grouped output
│   │   │   ├── useCompleteOptimization.ts
│   │   │   └── CompleteOptimizerView.test.tsx
│   │   ├── gear/                             ← §4.5 modals
│   │   │   ├── ItemPickerModal.tsx           ← FR-27 (search index, rarity/slot/tag filters)
│   │   │   ├── AffixPickerModal.tsx          ← FR-28 (Offense/Defense/Utility groups, tier pips, position)
│   │   │   ├── itemSearchIndex.ts            ← NEW prebuilt index (SM-5 < 100ms)
│   │   │   └── *.test.tsx
│   │   ├── gear-optimization/                ← §4.6 rework
│   │   │   ├── GearOptimizationView.tsx      ← MODIFIED  three-column + HTML5 DnD (FR-30/31)
│   │   │   └── PaperDoll.tsx                 ← NEW       11-slot drop targets
│   │   ├── skill-tree/
│   │   │   └── pixiRenderer.ts               ← EXTENDED  FR-17 suggestion overlay (gold/silver/dim
│   │   │                                                 scale+glow, dashed path lines), focusNode()
│   │   ├── skills/                           ← §4.8
│   │   │   └── SkillPickerGrid.tsx           ← MODIFIED  draws from complete 133-skill DB (FR-40/43)
│   │   ├── character-import/                 ← NEW feature folder (§4.10)
│   │   │   ├── CharacterImportModal.tsx      ← FR-46 two-tab (Offline / Online)
│   │   │   ├── OfflineImportTab.tsx          ← FR-47 detected list + Browse fallback
│   │   │   ├── OnlineImportTab.tsx           ← FR-49 stub UI
│   │   │   └── *.test.tsx
│   │   └── layout/
│   │       ├── AppHeader.tsx                 ← MODIFIED  FR-33 nav: Builder | Complete | Gear Opt | Settings
│   │       ├── LeftPanel.tsx                 ← MODIFIED  FR-34 build identity + section navigator + Import
│   │       ├── RightPanel.tsx                ← MODIFIED  FR-35 score gauge, archetype slider, optimizer
│   │       ├── CenterCanvas.tsx              ← MODIFIED  FR-36 six-tab bar w/ divider, keys 1–6
│   │       └── StatusBar.tsx                 ← MODIFIED  FR-39 data version, unsaved dot, LLM provider
│   └── App.tsx                               ← MODIFIED  add useCompleteOptStream(); route 'complete-optimizer'
│
└── src-tauri/
    ├── src/
    │   ├── lib.rs                            ← MODIFIED  register run_complete_optimization,
    │   │                                                 scan_save_files, parse_save_file,
    │   │                                                 import_online_character
    │   ├── scoring_commands.rs               ← EXTENDED  run_complete_optimization handler + payload assembly;
    │   │                                                 compute_stats track_sources wiring;
    │   │                                                 run_optimization passive_node filter
    │   └── character_import.rs               ← NEW       FR-47/48/49 (offline parse, online stub)
    └── scoring-core/
        ├── Cargo.toml                        ← unchanged (serde, serde_json, rayon)
        └── src/
            ├── modifier.rs                   ← EXTENDED  ModifierType/scope enums; new StatKeys;
            │                                             ModifierSource + SourceType
            ├── stat_sheet.rs                 ← EXTENDED  expanded Offense/Defense; AilmentStats/MinionStats;
            │                                             stat_sources: Option<HashMap<..>>
            ├── compute.rs → compute/mod.rs   ← REFACTORED orchestrator
            ├── compute/                       ← NEW submodules (ADR-P4-001)
            │   ├── offense.rs   penetration.rs  defense.rs  ehp.rs
            │   ├── ward.rs      ailment.rs       attributes.rs  minion.rs
            ├── gear.rs                        ← EXTENDED  suffix-side scoring (affix position)
            ├── idol.rs                        ← NEW       FR-26 idol recommendation pass
            ├── synergy.rs                     ← EXTENDED  cross-domain over scope mask
            └── tests/
                ├── ehp_reference.rs           ← NEW       tunklab parity fixtures (SM-1 ±2%, CI gate)
                └── ...formula regression tests (extended)
```

### Epic-to-Structure Mapping (anticipated; epics generated separately)

| Feature group | FRs | Primary files |
|---|---|---|
| Complete Stats Engine | FR-1–11 | `scoring-core/compute/*`, `modifier.rs`, `stat_sheet.rs`, `tests/ehp_reference.rs` |
| Stat Source Attribution | FR-12–14 | `modifier.rs` (ModifierSource), `scoring_commands.rs`, `stat-sheet/StatSourceTooltip.tsx` |
| Passive Tree Optimizer (refined) | FR-15–19 | `scoring_commands.rs` (filter), `skill-tree/pixiRenderer.ts`, `optimization/SuggestionCard.tsx` |
| Complete Build Optimizer | FR-20–26 | `complete-optimizer/`, `useCompleteOptStream.ts`, `scoring_commands.rs`, `scoring-core/idol.rs` |
| Gear Item & Affix Pickers | FR-27–29 | `gear/ItemPickerModal.tsx`, `AffixPickerModal.tsx`, `itemSearchIndex.ts`, `gameData.ts` (position) |
| Gear Optimization screen | FR-30–32 | `gear-optimization/`, `scoring-core/gear.rs`, `buildSnapshotSerializer.ts` |
| UI/UX revamp | FR-33–39 | `layout/*`, global stylesheet (tokens), `rarityColors.ts` |
| Data completeness | FR-40–43 | `popular-builds.json` (resource), `gameDataStore.ts`, `popularBuildMatch.ts`, `skills/` |
| Multi-allocate fix | FR-44–45 | `buildStore.ts` (`fillNodeToMax`, `removeAllPoints`), `useSkillTree.ts`, `pixiRenderer.ts` |
| Character import | FR-46–49 | `character-import/`, `src-tauri/character_import.rs`, `lib.rs` |

### Integration Boundaries & Data Flow

**Stat sheet + sources (every state change):**
```
buildStore / gameDataStore change
  → useStatSheet (rAF debounce + generation token)            [unchanged Phase 3 pattern]
    → toBuildSnapshot()                                        [serializer now emits affix position]
      → compute_stats(snapshot, { track_sources: true })       [SYNC; sources on]
        → scoring_core::compute_stats → ModifierRegistry
          → compute/* modules → StatSheet { ..., stat_sources: Some(map) }
        → optimizationStore.setStatSheet()
          → StatSheetPanel (5 tabs) + StatSourceTooltip (hover, no extra IPC)
```

**Complete Build Optimizer (explicit, multi-domain):**
```
CompleteOptimizerView "Optimize" (gates passed)
  → useCompleteOptimization → invokeCommand('run_complete_optimization', { snapshot, scope })
    → [Rust async] spawn_blocking → scoring_core stage fns gated by scope mask
       (track_sources: false everywhere here)
      → assemble filtered-catalog payload → claude_commands.rs
        → stream complete-opt:suggestion-received (domain-badged) → complete-opt:complete
          → useCompleteOptStream → optimizationStore.completeOpt
            → UnifiedSuggestionList   (OptimizationOrb runs independently — Pattern P4-5)
```

**Character import (offline):**
```
CharacterImportModal → OfflineImportTab
  → invokeCommand('scan_save_files')          → DetectedCharacter[]   (Steam + AppData paths)
  → select + Import → invokeCommand('parse_save_file', { path })
    → [Rust] character_import::parse_save_file → ImportedBuild
      → confirmation → buildStore creates new named build (prior preserved)
        → unresolved-ID post-import summary
```

**Hard boundary (unchanged):** `scoring-core` receives data, returns data — no Tauri, no I/O. All IPC wiring, event emission, Claude payload assembly, and **file I/O for import** live in the Tauri crate (`scoring_commands.rs`, `character_import.rs`). The `scoring-core/Cargo.toml` dependency list is the enforcement mechanism.

---

## Architecture Validation Results

### Coherence Validation ✅

- **Engine reuse, not duplication:** `run_complete_optimization` composes existing `scan.rs`/`gear.rs`/`synergy.rs`/new `idol.rs` behind a scope mask — no second scoring implementation. Consistent with the Modifier Registry single-source-of-truth principle.
- **IPC consistency:** four commands map to four distinct user triggers; `complete-opt:*` namespace has no collision with `optimization:*`/`gear:*`; input structs camelCase, outputs snake_case — all consistent with Phase 3 Patterns 2/6.
- **Store discipline:** no new store; `completeOpt` state and `stat_sources` consumption extend `optimizationStore`; `popularBuilds` extends `gameDataStore`; two new views/one new tab extend `appStore` enums. Four-store rule and no-router rule both preserved.
- **Purity preserved:** all Phase 4 stat math stays in `scoring-core` via the registry; file I/O for import is quarantined in the Tauri crate. WASM-readiness and no-mock unit tests remain intact.
- **Token reconciliation** is values-only — no component churn, `rarityColors.ts` unaffected by name.

### Requirements Coverage Validation

| Requirement | Coverage | Status |
|---|---|---|
| FR-1–11 (full stat engine) | `compute/*` modules; registry-driven; EHP/Ward via tunklab fixtures | ✅ |
| FR-12–14 (source attribution) | `ModifierSource` + opt-in `track_sources` + tooltip | ✅ |
| FR-15–19 (passive optimizer refined) | command-level `passive_node` filter + PixiJS overlay overhaul + `focusNode()` | ✅ |
| FR-20–26 (Complete Build Optimizer) | new view + `run_complete_optimization` + scope mask + CSS orb + filtered idol payload | ✅ |
| FR-27–29 (gear pickers) | modals + `position` discriminator + search index | ✅ |
| FR-30–32 (gear opt screen) | three-column + HTML5 DnD + payload-constrained recs | ✅ |
| FR-33–39 (UI revamp) | token reconciliation + layout rebuilds + view/tab topology | ✅ |
| FR-40–43 (data completeness) | 133-skill DB + icons + bundled `popular-builds.json` | ✅ |
| FR-44–45 (multi-allocate) | single-undo bulk store actions | ✅ |
| FR-46–48 (offline import) | `character_import.rs` (spike-gated format, documented fallback) | ⚠️ spike-gated |
| FR-49 (online import) | wired stub; live on EHG partnership | ⚠️ partner-gated (OQ-7) |
| SM-1 (±2% tunklab) | `tests/ehp_reference.rs` CI gate | ✅ |
| SM-C2 (+≤20ms sources) | `track_sources` opt-in, additive Vec append | ✅ |
| SM-C1 (orb never delays) | Pattern P4-5 decoupling | ✅ |
| SM-5 (<100ms item search) | prebuilt client index | ✅ |

### Gap Analysis

**Critical-path gates (resolve first, not blocking once done):**
- **Gate 1 — affix `position` discriminator (D-P4-2):** first story of the gear epic; everything else mocks it.
- **Gate 2 — `ModifierType` enum (D-P4-1):** prerequisite for `compute/*` work.

**Spikes required before sizing the affected stories:**
- **OQ-8 — save-file binary format:** Rust parsing spike vs. community editor; fallback = shell-invoke Java tool + parse JSON. Resolve before the FR-48 story.
- **OQ-1 — Parry as a player stat in Season 4:** verify against game data; if enemy-only, drop from FR-5/`defense.rs`. Resolve during the `defense.rs` story.

**Minor gaps (capture in story acceptance criteria):**
- Filtered idol-payload subset rule (OQ-6) — specify the exact filter (build damage types + empty cells) before the FR-26 story.
- `popular-builds.json` curation workflow (OQ-5) — manual per-patch curation is the Phase 4 approach; no automation in scope.
- Right-panel `shrink-0` layout overflow on short windows (standing deferred-work item) — address during the FR-35 right-panel rebuild.
- `warningGap === 0` false-warning (standing deferred-work item) — fix in `defense.rs`/`ward.rs` as the gap floor, not the renderer (FR-5/FR-6).

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (PRD + addendum + Phase 3 arch + handoff + deferred-work)
- [x] Scale and complexity assessed (ten subsystems, two data gates, two spikes)
- [x] Technical constraints identified (registry inheritance, data gates, format/API gates)
- [x] Cross-cutting concerns mapped (source cost, dual flows, token reconciliation, warning vs suggestion)

**Architectural Decisions**
- [x] Critical decisions documented with rationale (D-P4-1–5, ADR-P4-001/005/006/007/010)
- [x] Technology stack fully specified (inherited & pinned; zero new mandatory deps)
- [x] Integration patterns defined (four commands, three event namespaces, three data flows)
- [x] Performance considerations addressed (track_sources opt-in, orb decoupling, search index, tunklab fixtures)

**Implementation Patterns**
- [x] Naming conventions established (enum migration, `complete-opt:*`, `CHARACTER_IMPORT_ERROR`)
- [x] Structure patterns defined (registry-only stat math, warnings vs suggestions, payload-ID constraint)
- [x] Communication patterns specified (new stream hook, event namespace isolation)
- [x] Process patterns documented (single-undo batch ops, orb decoupling, token values-only)

**Project Structure**
- [x] Complete directory structure defined (new + modified + deleted explicit)
- [x] Component boundaries established (`scoring-core` purity; import I/O in Tauri crate)
- [x] Integration points mapped (three data-flow diagrams)
- [x] Requirements-to-structure mapping complete (ten-group table)

### Architecture Readiness Assessment

**Overall Status: READY WITH MINOR GAPS**

Two data gates (affix `position`, `ModifierType` enum) and two spikes (OQ-8 save format, OQ-1 Parry) are identified with resolutions/fallbacks and sequencing; none blocks the majority of implementation, which proceeds behind mock data exactly as Phase 3 did behind Epic G. Online character import (FR-49) is intentionally a wired stub pending EHG partnership.

**Confidence Level: High**

**Key Strengths:**
- Phase 4 is the redemption of Phase 3's deliberate expansion joints — `Option<T>` stat slots, the open `Condition` enum, the forward-compatible affix schema, and the pure-crate boundary all pay off here with no engine rewrite.
- The Modifier Registry absorbs full stat parity by adding `StatKey`s and registrations, not new computation paths (Pattern P4-1).
- Source attribution is purely additive metadata, gated by an opt-in flag — no hot-path regression (SM-C2 honoured by construction).
- The second optimization flow reuses the first's stages via a scope mask — one engine, two flows.
- The whole UI re-skins from a single stylesheet token update; components rebuild to the design without touching the rarity utility.

**Areas for Future Enhancement (Phase 5):**
- Weaver Tree full PixiJS renderer (opt-in scope only in Phase 4).
- Full attribute → secondary-stat conversion tables (Phase 4 ships totals + parseable conversions).
- Live online character import once EHG API access is granted.
- Node/tree art-asset fidelity and environment art.

### Implementation Handoff

**AI Agent Guidelines:**
- Read `project-context.md` (85 rules) and the **Phase 3 architecture** (`_phase3-archive/.../architecture.md`) before any code — this document is additive to both.
- The `scoring-core` crate boundary and the Modifier Registry are the primary consistency-enforcement mechanisms — never add Tauri/I/O types to the crate, never compute a stat outside the registry.
- Use `toBuildSnapshot()` for every scoring command; outputs are snake_case; inputs are camelCase.
- Add `CHARACTER_IMPORT_ERROR` to `ErrorType`/`errorNormalizer.ts` (reuse `SCORING_ERROR`) as Story-0 setup, before any import/scoring IPC story.

**First Implementation Priorities (in order):**
1. **Gate 1** — affix `position` discriminator + ingestion (data gate for §4.5/§4.6).
2. **Gate 2** — `ModifierType`/`scope` serde enum migration (prerequisite for `compute/*`).
3. In parallel behind mock data: `scoring-core/compute/*` build-out (FR-1–11) and the design-token reconciliation + layout rebuild (FR-33–39).
4. Spikes: OQ-8 (save format) before FR-48; OQ-1 (Parry) before `defense.rs`.

**Next workflow:** run **`bmad-create-epics-and-stories`** to decompose these ten feature groups into the Phase 4 epic/story breakdown (regenerating the active `epics.md`, whose Phase 3 copy is frozen in `_phase3-archive/`).
