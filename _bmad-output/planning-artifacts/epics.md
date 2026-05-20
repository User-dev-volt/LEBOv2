---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-05-20'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-19/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-19/addendum.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/project-context.md'
---

# LEBOv2 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for LEBOv2 Phase 3, decomposing the requirements from the PRD, Architecture, and Addendum into implementable stories. Phase 3 transforms LEBO from a polished companion app into the definitive Last Epoch build tool through three transformations: a deterministic scoring engine, a gear optimization screen, and full visual fidelity matching the game aesthetic.

---

## Requirements Inventory

### Functional Requirements

**Section A — Deterministic Scoring Engine**

FR-A1: The app computes a `DamageScore` using the Last Epoch damage formula: `Base × (1 + Σ Increased%) × Π More%` where Increased modifiers are summed additively and More modifiers are applied multiplicatively in sequence.

FR-A2: The app computes crit-weighted average damage as: `Hit × [(CritMulti × CritChance) + (1 × (1 - CritChance))]` where `CritMulti = 200% + Σ AdditionalCritMulti%` and `CritChance` is capped at 100%.

FR-A3: The app computes a `SurvivabilityScore` as effective HP: `HP × (1 + WardRatio) × EnduranceReduction`, with a bonus multiplier for each active defensive layer beyond 2 (endurance, Ward, resistances capped, crit avoidance capped, sustain layer).

FR-A4: The app computes a `SpeedScore` from: movement speed %, attack/cast speed, and AoE coverage modifier.

FR-A5: The app combines scores into a composite `BuildScore = w_dmg × DamageScore + w_surv × SurvivabilityScore + w_speed × SpeedScore` using archetype weights derived from the Glass Cannon ↔ Juggernaut slider position and fine-tune overrides.

FR-A6: Every passive node effect and every affix entry in the game data includes a `modifierType` field: `"increased"`, `"more"`, or `"flat"`. This annotation drives the scoring engine — `"more"` modifiers apply multiplicatively, `"increased"` additively. Without this field the scoring engine falls back to treating the modifier as `"increased"`.

FR-A7: Before generating any optimization suggestion, the app performs a defensive floor check on the current build: (1) All elemental resistances ≥ 75% (cap), (2) Crit avoidance ≥ 80%, (3) At least one active sustain mechanism (life leech, Ward generation, or life regeneration ≥ 100/s).

FR-A8: Any defensive floor failure produces a `Critical`-priority suggestion that ranks above all offensive suggestions, regardless of the player's archetype weight settings. The Critical suggestion names the specific gap and the specific fix (e.g., "Fire resistance is 52% — cap requires +23%. Helm slot has room for a Fire Resistance suffix at T5").

FR-A9: For every unallocated passive node, the app computes `Efficiency(node) = ΔBuildScore(path) / EffectivePointCost(path)` where `EffectivePointCost` = the node's own point cost plus the total cost of all unallocated prerequisite nodes on the shortest path from current allocation to that node.

FR-A10: The path ΔBuildScore is the sum of score contributions from all nodes on the path (not just the target node), rewarding paths where intermediate nodes also have value.

FR-A11: The efficiency scan is implemented as a modified shortest-path traversal on the tree graph, targeting O(N log N) for N unallocated nodes.

FR-A12: `"more"` damage modifier nodes receive a 3–5× scoring weight multiplier relative to an equivalent `"increased"` node when the build already stacks significant Increased% (threshold: Σ Increased% > 200%), reflecting their exponentially higher effective value.

FR-A13: Mastery depth bonus: nodes at depth 7–10 in the mastery sub-tree receive a 1.2× efficiency multiplier, reflecting that the highest-value LE nodes are concentrated in the mastery's deep tier.

FR-A14: When the player has N unspent points (N > 1), the app uses a two-phase solver: (1) greedy shortlist of top 20 highest-efficiency candidate paths; (2) bounded knapsack DP over the shortlist to find the globally optimal set of path allocations within budget N.

FR-A15: The solver output is an ordered list of node allocations (cheapest-first path ordering) that maximizes BuildScore for the given budget.

FR-A16: The app computes a dynamic affix weight: `Weight(affix, build) = ΔBuildScore when this affix is present at T5` — injecting each affix into the current build and measuring the score delta. Weights are cached per build state and invalidated on class, mastery, skill assignment, or skill role designation change.

FR-A17: For each gear slot, the app ranks all possible affixes by `Weight × TierValue` and identifies the 2 best prefix + 2 best suffix combinations as the "ideal" configuration for that slot. Rankings are skill-context-aware: affix weights account for the build's active skill damage types (e.g., a Poison build's affix scorer weights Poison-damage affixes and ailment-scaling prefixes highly regardless of generic damage score contributions).

FR-A18: The gap between a slot's current affix configuration and its ideal configuration produces an `UpgradeScore` per slot. Slots are ranked by UpgradeScore to identify upgrade priority order.

FR-A19: The affix scorer recognizes skill damage delivery types (melee / ranged / spell / minion) and damage element types (fire / cold / lightning / void / physical / poison / bleed) from the active skill configuration. Affixes that do not apply to the build's delivery type or damage element receive a zero weight.

FR-A20: The app detects zero-value passive allocations: nodes that are allocated but whose bonuses never apply to the build's active skills. These are flagged as Medium-priority reallocation suggestions.

FR-A21: The app detects mismatched affix types: gear affixes whose scope doesn't match the active skill's damage delivery type. These are flagged as High-priority replacement suggestions with the correct affix scope identified.

FR-A22: The app detects synergy enabler thresholds: cases where a build-enabling unique item would change the archetype score by >30% if certain stat thresholds were met. These are surfaced as a special "Game-Changer" suggestion tier explaining what threshold is needed and how close the build is.

FR-A23: The optimization payload sent to Claude includes: the full ranked suggestion list with `ΔBuildScore`, `EffectivePointCost`, synergy flags, and the specific numerical context for each suggestion.

FR-A24: Claude's output is a natural-language explanation for each suggestion that references the specific delta values and explains the mechanical reason behind the priority.

FR-A25: Claude's role is narrative generation only — the suggestion list, priority order, and delta values are produced deterministically by the engine. Claude does not reorder or invent suggestions.

FR-A26: After an optimization run, the passive tree canvas displays a color-coded overlay on every unallocated node indicating its per-point efficiency tier: gold = top quartile (highest value), silver = second quartile, dim = third/fourth quartile (low value or unreachable within budget).

FR-A27: Nodes already at the suggestion cap (no remaining unspent points) show no overlay.

FR-A28: The overlay is toggleable via a button in the tree controls area; it defaults to on when suggestions are present.

**Section B — Live Stat Sheet**

FR-B1: The right panel adds a stat sheet section with five tabs: **General**, **Offense**, **Defense**, **Minion**, **Other**.

FR-B2: **General tab** displays: character level, total passive points spent vs. available (per mastery), per-skill levels and skill points spent vs. available, class and mastery name.

FR-B3: **Offense tab** displays: computed DamageScore, average hit damage (base), average hit damage (crit-weighted), critical strike chance %, critical strike multiplier %, attack speed or cast speed (per active skill), AoE modifier.

FR-B4: **Defense tab** displays: effective HP, raw HP pool, Ward (if applicable), endurance % and endurance threshold, armor value, all resistances (fire, cold, lightning, void, poison, physical), crit avoidance %, dodge chance %.

FR-B5: **Minion tab** displays minion-relevant stats (minion count, minion damage multiplier, minion HP multiplier) for builds with active minion skills; tab is hidden for builds with no minion skills.

FR-B6: **Other tab** displays: movement speed %, cooldown recovery speed, mana pool and mana regen, resource-specific stats relevant to the active build.

FR-B7: All stat sheet values recompute in real time on every state change: node allocation/deallocation, gear slot change, affix tier change, idol placement, blessing assignment, condition toggle, character level change, skill level change. No "Recalculate" button exists.

FR-B8: When an AI suggestion is previewed (hover on suggestion item), all affected stat sheet values show a before/after delta: gains in green `(+X%)`, losses in red `(-X%)`, unchanged values in neutral. Delta display disappears when hover ends.

**Section C — Idol Grid Builder**

FR-C1: The context panel includes an idol grid that matches the Last Epoch default idol grid — a 5×5 cell space with the four corners and center cell blocked (~20 active cells). Valid idol placement positions for each idol size type are encoded in a bundled JSON data file (not hardcoded in UI logic). Idol Altar variants are out of scope for Phase 3; the data file structure must accommodate altar variants as a Phase 4 addition without breaking the grid component.

FR-C2: Players can place an idol in any slot by selecting its size type (1×1, 1×2, 1×3, 2×2) and verifying it fits within the grid's valid placement rules.

FR-C3: Each placed idol supports up to one prefix and one suffix affix selected from the idol affix database. Both prefix and suffix are required for idol types that mandate both (matching in-game behavior).

FR-C4: Idol affix selection respects size and type restrictions — only affixes valid for that idol type and size are shown in the picker.

FR-C5: Idol affix tiers are selectable (T1 through the affix's maximum tier), consistent with the gear slot tier picker pattern.

FR-C6: Idol stats are included in all stat sheet calculations — HP, resistances, and damage affixes from idols contribute to the scoring engine's input.

FR-C7: Full idol context (slot position, idol size, affix IDs, tiers) is passed to the AI optimization engine as structured context, enabling idol-specific suggestions.

FR-C8: Players can clear individual idol slots or reset the full grid. Clearing a slot removes its stat contributions immediately.

FR-C9: The idol database is bundled with the application and follows the same staleness-check pattern as the item and game data systems.

**Section D — Blessings Panel**

FR-D1: The context panel includes a Blessings section where players can assign up to one blessing per monolith timeline (matching in-game rules).

FR-D2: The blessings database contains all current LE monolith timeline blessings with their stat effects (resistance values, damage multipliers, HP bonuses, etc.).

FR-D3: Blessing selection uses a searchable dropdown organized by timeline, drawing from the blessings database.

FR-D4: Active blessings contribute to the stat sheet as permanent additive bonuses — their effects are included in resistance totals, damage calculations, and EHP.

FR-D5: The blessings database is updatable via the existing staleness check system when new timelines or blessing values are patched.

**Section E — Conditions / Buffs Panel**

FR-E1: A Conditions panel is accessible from the context panel or a dedicated tab. It allows players to set simulation context used by the scoring engine.

FR-E2: Universal conditions include: enemy type (standard mob / rare / unique boss / pinnacle boss), enemy elemental resistances (as % values for relevant damage types), active charge counts (frenzy, power, endurance) up to maximum.

FR-E3: Build-specific conditions are shown only when relevant passives or skills are active in the build.

FR-E4: Condition values are used by the scoring engine to produce context-accurate DamageScore and SurvivabilityScore.

FR-E5: Condition values are included in the Claude optimization payload so AI suggestions can reference the combat context.

**Section F — Visual & UX Polish**

FR-F1: All item names, item tooltips, and affix listing headers use Last Epoch's canonical rarity color system: Common (#E8E8E8), Magic (#5B9BD5), Rare (#D4AF37), Unique (#E87722), Set (#4CAF50), Exalted (#9C27B0), Legendary (#C62828).

FR-F2: Unique and Set items in the gear slots display their item name in the correct rarity color. Affix entries on unique items are presented as read-only (matching in-game: unique item stats are fixed).

FR-F3: All stat sheet values and tooltips that reference damage or resistance values use LE's canonical damage-type color coding: Physical (#D0D0D0), Fire (#E85D2A), Cold (#5BC8E8), Lightning (#F0D020), Void (#A050D0), Poison/Necrotic (#50B840), Bleed/Armor Shred (#A03030).

FR-F4: The passive tree canvas renders a dark stone/obsidian-textured background using a PixiJS `TilingSprite` backed by a bundled 256×256 WebP stone tile texture (`bg_stone_tile.webp`). The TilingSprite is the first child of `worldContainer` (inserted before `edgeGraphics`), making it render beneath all nodes and edges.

FR-F5: Each active skill tree canvas renders a background tinted by the skill's primary damage type tag: FIRE → warm amber overlay (rgba(180, 80, 20, 0.18)), COLD → cool blue overlay (rgba(40, 100, 180, 0.18)), LIGHTNING → pale yellow overlay (rgba(180, 160, 20, 0.18)), VOID → deep purple overlay (rgba(80, 20, 140, 0.18)), POISON → green overlay (rgba(30, 120, 40, 0.18)), PHYSICAL/MELEE/UNKNOWN → neutral dark (no tint). Base layer is the same dark stone texture as the passive tree.

FR-F6: The Weaver Tree tab displays a void/crystalline purple aesthetic using `bg_weaver_tile.webp` as a background — applied to `WeaverTreePlaceholder` as a CSS background image in Phase 3. When community Weaver Tree node data becomes available, the placeholder is replaced by a full PixiJS canvas with the TilingSprite background.

FR-F7: `Ctrl+Z` / `Ctrl+Y` (Windows) and `Cmd+Z` / `Cmd+Y` (macOS) are bound to undo/redo. Visible undo (↩) and redo (↪) icon buttons appear in the tree controls bar alongside the existing reset button.

FR-F8: Keyboard shortcut `C` focuses the context panel (gear / idols / blessings), `S` focuses the active skill tree, `P` focuses the passive tree. These are global shortcuts active when no text input is focused.

FR-F9: Node tooltips that overflow the visible viewport are scrollable in place (mouse wheel scrolls the tooltip content) rather than clipping or expanding the layout.

FR-F10: `Shift+click` on a passive tree node allocates multiple points in one action (up to the node's maximum or remaining budget, whichever is lower), matching lastepochtools.com behavior.

**Section G — Season 4 Game Data Update**

FR-G1: The bundled game data is updated to Last Epoch Season 4 (Shattered Omens, released 2026-03-26). This includes: all new and updated passive tree nodes, new unique items and set items, updated affix tables (including Rune of Corruption affix entries), new and updated skill specialization tree nodes.

FR-G2: The Season 4 data ingestion pipeline ensures every passive node effect and affix entry includes the `modifierType` and `scope` fields required by the scoring engine (FR-A6). Source: lastepochtools.com community DB. This must be complete before any scoring engine development begins.

FR-G3: The game data version string in `manifest.json` reflects Season 4. The existing staleness check system surfaces an update prompt to players running older data.

FR-G4: Season 4 idol data (if new idol types or affix entries were added in S4) is included in the idol database bundle.

FR-G5: Season 4 blessings (any new monolith timelines or blessing updates in S4) are included in the blessings database bundle.

**Section H — Gear Optimization Screen**

FR-H1: Before the gear analysis can run, the player designates roles for their active skill slots: **Primary Offense** (required), **Secondary Offense** (optional), **Defensive** (optional), and **Utility** (optional). At minimum, one skill must be designated Primary Offense.

FR-H2: Skill role designations are saved with the build and persist across sessions.

FR-H3: The Gear Optimization screen prompts for skill role designations if none are set. Once set, roles are displayed and editable at the top of the screen.

FR-H4: When the player opens the Gear Optimization screen (or clicks "Analyze Gear"), the app captures a full build snapshot: active skills with their role designations, passive tree allocations, current gear (all 12 slots), idols, blessings, active conditions, character level, and slider position.

FR-H5: The snapshot is passed to the scoring engine to compute per-slot `UpgradeScore` (from FR-A18) and per-affix `Weight` (from FR-A16) using the skill-role-aware affix scorer.

FR-H6: The app ranks all equipped gear slots by `UpgradeScore` (highest gap between current configuration and ideal). The slot with the highest UpgradeScore is flagged as the **Priority Upgrade** slot with a visual indicator.

FR-H7: The upgrade priority ranking is displayed as an ordered list of all 12 gear slots, showing each slot's current score efficiency (e.g., "Weapon: 73% of ideal", "Boots: 41% of ideal").

FR-H8: Unique and set items that are correct for the build (their special effects contribute positively to BuildScore) are flagged as "correct — keep" regardless of affix scores.

FR-H9: For each gear slot, the app displays the ideal affix wishlist: the top 2 prefix and top 2 suffix recommendations ranked by weight, with each affix labeled by its tier target.

FR-H10: Each recommended affix includes a brief mechanical reason drawn from the scoring context — why this affix specifically matters for this build.

FR-H11: When the current gear item already has a recommended affix, the slot shows that affix as satisfied (checked off) and highlights which recommended affixes are still missing or below target tier.

FR-H12: The wishlist distinguishes between prefix and suffix recommendations per slot, matching LE's crafting system (2 prefix + 2 suffix per item).

FR-H13: Claude generates a gear analysis narrative for the full build — prioritized story across all slots, not slot-by-slot boilerplate.

FR-H14: Claude's narrative references the player's designated Primary Offense skill by name throughout.

FR-H15: Claude identifies any build-enabling unique items that would be upgrades given the current build state (from FR-A21's synergy enabler detection), surfaced as "Game-Changer" recommendations.

FR-H16: All gear recommendations are weighted by the current Glass Cannon ↔ Juggernaut slider position.

FR-H17: The gear narrative explicitly calls out the archetype context (slider position and its effect on recommendations).

---

### NonFunctional Requirements

NFR-1: The scoring engine (defensive floor check + passive tree efficiency scan + gear affix scoring + synergy detection) completes in < 100ms for a full build evaluation on target hardware. Claude API latency (2–5s) remains the only user-perceived bottleneck.

NFR-2: Stat sheet recalculation on any single state change (node click, affix tier change, condition toggle) completes in < 16ms to support smooth 60fps updates during node allocation.

NFR-3: Node efficiency overlay rendering adds no more than 2ms to the tree's frame render time — backgrounds and overlays are precomputed assets or display-list operations, not per-frame computation.

NFR-4: All stat values, scoring weights, modifier thresholds, and defensive floor thresholds are data-driven — sourced from game data files at runtime, never as numeric constants in source code. This is the primary mechanism for season-over-season accuracy without code changes.

NFR-5: The scoring engine is structured to support pluggable class-specific scoring modules. When Paradox Classes ship, adding a new class scoring module must not require modifying the base scoring engine. The interface for class modules is documented (`ClassModule` trait).

NFR-6: The idol grid layout and valid placement rules are encoded in the bundled idol data, not hardcoded in UI logic. New idol types added by EHG in future patches can be supported by updating the data file, not the component.

NFR-7: The blessings and conditions databases follow the same staleness-check and update pipeline as the existing game data and item database systems.

NFR-8: The damage scoring formula and crit math have dedicated unit tests verifying results against known-correct examples from Maxroll.gg. Any formula regression fails CI.

NFR-9: The defensive floor check has unit tests covering all failure conditions: each uncapped resistance type, crit avoidance below threshold, and no sustain layer present.

NFR-10: All new interactive UI components (idol grid, blessings picker, conditions panel, stat sheet tabs) pass axe-core accessibility checks. CI continues to fail on any new `axe` violation.

NFR-11: Platform targets are maintained: Windows 10/11 (.msi) and macOS 12+ (.dmg). No new platform targets are added in Phase 3.

NFR-12: All Phase 3 features must function fully offline. No network calls are required for scoring, stat display, idol/blessings input, or conditions setup. The Claude API call remains the only network operation.

---

### Additional Requirements

**From Architecture — Rust Workspace & Crate Structure (ADR-001)**
- `scoring-core` is a separate Cargo workspace crate (`src-tauri/scoring-core/`) with NO Tauri, NO tokio dependencies. Pure Rust: serde, serde_json, rayon only.
- `src-tauri/Cargo.toml` becomes a workspace root with two members: `.` (existing Tauri crate) and `scoring-core`.
- `scoring_commands.rs` in the Tauri crate owns all `#[tauri::command]` handlers; `game_data_loader.rs` owns disk→`GameData` construction.

**From Architecture — IPC Strategy (D2, D3)**
- **Debounced rAF + Rust IPC (Path C):** State changes accumulate within a 16ms rAF window. One `invokeCommand('compute_stats', ...)` fires per frame maximum.
- Three IPC commands registered in `lib.rs invoke_handler!`: `compute_stats` (sync, Stage 1 only, ~2ms), `run_optimization` (async, Stages 1–3 + 5–6, ~50ms), `run_gear_scoring` (async, Stages 1 + 4 + 6).
- `useStatSheet.ts` hook in `shared/stores/` — replaces inline `calculateScore` subscribe blocks in App.tsx (lines 74–88, 100–111).

**From Architecture — Type System (D4)**
- New `shared/types/statSheet.ts` file: `StatSheet`, `OffenseStats`, `DefenseStats`, `ScoreComponents`, `AilmentStats` (Phase 4 placeholder), `MinionStats` (Phase 4 placeholder), `StatWarning`, `NodeEfficiency`, `GearAnalysis`, `SynergyFlag`.

**From Architecture — Store Placement (D1)**
- `optimizationStore` extended with: `statSheet: StatSheet | null`, `isComputingStats: boolean`, `setStatSheet()`, `setIsComputingStats()`.
- `nodeEfficiencies: NodeEfficiency[] | null` also added to `optimizationStore` for overlay wiring (Gap 1 resolution).

**From Architecture — Critical Patterns (all patterns must be enforced in stories)**
- Pattern 1: `buildSnapshotSerializer.ts` (`toBuildSnapshot()`) is the only conversion point from `BuildState` to `BuildSnapshot`. Never pass `BuildState` directly to scoring commands.
- Pattern 2: Rust input structs use `#[serde(rename_all = "camelCase")]`; output structs use default snake_case. TypeScript interfaces mirror Rust output field names exactly.
- Pattern 3: Sync commands — `.read().unwrap()` no clone; async commands — `.read().unwrap().clone()` then release before `spawn_blocking`.
- Pattern 4: Generation-based cancellation in `useStatSheet` — stale results discarded via `useRef` counter.
- Pattern 5: `SCORING_ERROR:` prefix on all scoring Rust errors. Must be added to `ErrorType` enum and `errorNormalizer.ts` before any scoring IPC story.
- Pattern 6: Gear analysis uses `gear:analysis-complete` / `gear:error` events. Never reuse `optimization:*` namespace.
- Pattern 7: Null `StatSheet` sub-sheets (`ailment`, `minion`) are hidden sections — never rendered as errors or empty containers.

**From Architecture — Data Gate**
- Epic G (Season 4 data ingestion + `modifierType`/`scope` field addition) is the **sole critical-path gate** blocking all scoring engine work. All other implementation work can proceed in parallel with mock game data.
- Three new game databases: `idol-data.json`, `blessings.json`, `conditions.json` — all following the existing staleness-check pattern.

**From Architecture — Parallelism (ADR-003)**
- `rayon` inside `scoring-core` for the passive tree efficiency scan (embarrassingly parallel per node).
- `spawn_blocking` at the Tauri command boundary for full optimization and gear scoring runs.
- Never hold a `RwLock` read guard across an `await` boundary.

**From Architecture — Deprecation**
- `features/optimization/scoringEngine.ts` is deprecated once `useStatSheet` is live. Deletion is a follow-up story, not in the same PR as hook addition.
- `scores: BuildScore | null` in `optimizationStore` deprecated once Rust engine live; removed in follow-up story.

---

### UX Design Requirements

No formal UX Design Specification document exists for Phase 3. All visual and interaction requirements are captured directly as Functional Requirements in Section F (FR-F1 through FR-F10) of the PRD and are covered above.

---

### FR Coverage Map

**Epic 1 — Season 4 Data Foundation:**
FR-G1: Epic 1 — Update bundled game data to Season 4 (nodes, uniques, affixes, skill trees)
FR-G2: Epic 1 — Annotate every passive node and affix with `modifierType` and `scope` fields from lastepochtools.com DB
FR-G3: Epic 1 — Update `manifest.json` to Season 4 version string; trigger staleness prompt for old data
FR-G4: Epic 1 — Include Season 4 idol data in idol database bundle
FR-G5: Epic 1 — Include Season 4 blessings in blessings database bundle

**Epic 2 — Scoring Engine & Live Stat Sheet:**
FR-A1: Epic 2 — DamageScore formula (Base × Σ Increased% × Π More%)
FR-A2: Epic 2 — Crit-weighted average damage computation
FR-A3: Epic 2 — SurvivabilityScore as effective HP with defensive layer bonus
FR-A4: Epic 2 — SpeedScore from move speed, attack/cast speed, AoE modifier
FR-A5: Epic 2 — Composite BuildScore with archetype weights from slider
FR-A6: Epic 2 — `modifierType` field drives modifier application (increased/more/flat)
FR-A7: Epic 2 — Defensive floor check (resistances, crit avoidance, sustain) before suggestions
FR-A8: Epic 2 — Critical-priority suggestion for any defensive floor failure
FR-B1: Epic 2 — Right panel stat sheet with 5 tabs (General, Offense, Defense, Minion, Other)
FR-B2: Epic 2 — General tab content (level, points, skill levels, class/mastery)
FR-B3: Epic 2 — Offense tab content (DamageScore, hit damage, crit %, crit multi, attack/cast speed, AoE)
FR-B4: Epic 2 — Defense tab content (EHP, raw HP, Ward, endurance, armor, resistances, crit avoidance, dodge)
FR-B5: Epic 2 — Minion tab (shown only when minion skills active)
FR-B6: Epic 2 — Other tab content (move speed, CDR, mana pool, resource-specific stats)
FR-B7: Epic 2 — Real-time recalculation on every state change, no recalculate button

**Epic 3 — Build Context: Idols, Blessings & Conditions:**
FR-C1: Epic 3 — Idol grid (5×5, blocked corners + center, layout from JSON not hardcoded)
FR-C2: Epic 3 — Idol placement by size type with valid placement rule enforcement
FR-C3: Epic 3 — Idol prefix + suffix affix support (mandated types require both)
FR-C4: Epic 3 — Idol affix picker respects size/type restrictions
FR-C5: Epic 3 — Idol affix tier selection (T1 through max tier)
FR-C6: Epic 3 — Idol stats included in all stat sheet calculations
FR-C7: Epic 3 — Full idol context passed to AI optimization engine as structured data
FR-C8: Epic 3 — Clear individual idol slots or full grid reset
FR-C9: Epic 3 — Idol database bundled with staleness-check pattern
FR-D1: Epic 3 — Blessings section: one blessing per monolith timeline
FR-D2: Epic 3 — Blessings database with all current blessings and stat effects
FR-D3: Epic 3 — Searchable blessing dropdown organized by timeline
FR-D4: Epic 3 — Active blessings contribute to stat sheet as additive bonuses
FR-D5: Epic 3 — Blessings database updatable via staleness check system
FR-E1: Epic 3 — Conditions panel accessible from context panel or dedicated tab
FR-E2: Epic 3 — Universal conditions (enemy type, resistances, charge counts)
FR-E3: Epic 3 — Build-specific conditions shown only when relevant passives/skills active
FR-E4: Epic 3 — Condition values used by scoring engine for context-accurate scores
FR-E5: Epic 3 — Condition values included in Claude optimization payload

**Epic 4 — Passive Tree Intelligence & Optimization:**
FR-A9: Epic 4 — Per-node efficiency score (ΔBuildScore / EffectivePointCost via Dijkstra path)
FR-A10: Epic 4 — Path ΔBuildScore sums contributions from all nodes on path (not just target)
FR-A11: Epic 4 — Efficiency scan as O(N log N) shortest-path traversal
FR-A12: Epic 4 — "more" modifier nodes get 3–5× multiplier when Σ Increased% > 200%
FR-A13: Epic 4 — Mastery depth bonus: nodes at depth 7–10 get 1.2× efficiency multiplier
FR-A14: Epic 4 — Two-phase budget solver: greedy shortlist (top 20) + bounded DP knapsack
FR-A15: Epic 4 — Solver output: ordered node allocation list maximizing BuildScore within budget
FR-A20: Epic 4 — Zero-value passive allocation detection (Medium-priority reallocation suggestions)
FR-A21: Epic 4 — Mismatched affix type detection (High-priority replacement suggestions)
FR-A22: Epic 4 — Synergy enabler threshold detection (Game-Changer suggestion tier)
FR-A23: Epic 4 — Full optimization payload sent to Claude (ranked suggestions + delta values + context)
FR-A24: Epic 4 — Claude produces natural-language explanations referencing specific delta values
FR-A25: Epic 4 — Claude role is narrative only; suggestion list and priority are deterministic
FR-A26: Epic 4 — Node efficiency overlay on passive tree (gold/silver/dim tiers)
FR-A27: Epic 4 — No overlay on nodes when no unspent points remain
FR-A28: Epic 4 — Overlay toggleable; defaults on when suggestions are present
FR-B8: Epic 4 — Stat sheet shows before/after delta on AI suggestion hover (green/red deltas)

**Epic 5 — Gear Optimization Screen:**
FR-A16: Epic 5 — Dynamic affix weight (ΔBuildScore at T5); cached per build state
FR-A17: Epic 5 — Ideal affix config per slot (top 2 prefix + 2 suffix); skill-context-aware
FR-A18: Epic 5 — UpgradeScore per slot (gap from current to ideal); slots ranked by UpgradeScore
FR-A19: Epic 5 — Affix scorer is delivery-type and damage-element aware (zero-weight inapplicable affixes)
FR-H1: Epic 5 — Skill role designation (Primary Offense required; Secondary, Defensive, Utility optional)
FR-H2: Epic 5 — Skill role designations saved with build and persist across sessions
FR-H3: Epic 5 — Gear Optimization screen prompts for roles if none set; roles editable at screen top
FR-H4: Epic 5 — Full build snapshot captured on screen open / "Analyze Gear"
FR-H5: Epic 5 — Snapshot passed to scoring engine for UpgradeScore and Weight computation
FR-H6: Epic 5 — Gear slots ranked by UpgradeScore; highest-gap slot flagged as Priority Upgrade
FR-H7: Epic 5 — Upgrade priority list showing all 12 slots with current efficiency % of ideal
FR-H8: Epic 5 — Correct unique/set items flagged as "correct — keep" regardless of affix scores
FR-H9: Epic 5 — Per-slot affix wishlist: top 2 prefix + top 2 suffix with tier targets
FR-H10: Epic 5 — Each recommended affix includes a mechanical reason from scoring context
FR-H11: Epic 5 — Satisfied affixes shown checked off; missing/below-tier affixes highlighted
FR-H12: Epic 5 — Wishlist distinguishes prefix vs. suffix (matching LE's 2P+2S crafting system)
FR-H13: Epic 5 — Claude gear narrative: prioritized story across all slots, not slot-by-slot boilerplate
FR-H14: Epic 5 — Claude narrative references Primary Offense skill name throughout
FR-H15: Epic 5 — Claude surfaces build-enabling unique items as Game-Changer recommendations
FR-H16: Epic 5 — All gear recommendations weighted by Glass Cannon ↔ Juggernaut slider position
FR-H17: Epic 5 — Gear narrative explicitly calls out archetype context and slider-driven priority

**Epic 6 — Visual Fidelity & UX Polish:**
FR-F1: Epic 6 — Item rarity color system applied to all item names, tooltips, affix headers (7 canonical colors)
FR-F2: Epic 6 — Unique/Set item names in rarity color; unique affix entries displayed as read-only
FR-F3: Epic 6 — Damage-type color coding in stat sheet and tooltips (7 canonical colors)
FR-F4: Epic 6 — Passive tree: dark stone TilingSprite background (`bg_stone_tile.webp`), inserted before edge graphics
FR-F5: Epic 6 — Skill tree canvases: damage-type tint overlay on stone base texture (palette per FR-F5)
FR-F6: Epic 6 — Weaver Tree tab: void/crystalline purple aesthetic (`bg_weaver_tile.webp`) on WeaverTreePlaceholder
FR-F7: Epic 6 — Ctrl+Z/Y (Win) and Cmd+Z/Y (Mac) undo/redo; visible ↩/↪ buttons in tree controls bar
FR-F8: Epic 6 — Global keyboard shortcuts: C = context panel, S = skill tree, P = passive tree
FR-F9: Epic 6 — Node tooltips overflowing viewport are scrollable in place (mouse wheel)
FR-F10: Epic 6 — Shift+click allocates multiple points in one action (up to node max or budget)

---

## Epic List

### Epic 1: Season 4 Game Data Foundation
Players' optimization suggestions are accurate for the current game season. The bundled game data is updated to Last Epoch Season 4 (Shattered Omens) and annotated with the `modifierType` and `scope` fields required by the scoring engine. This epic is the **critical-path gate** — all scoring engine stories in Epic 2+ depend on this data being available; development proceeds with mock data until this epic is complete.
**FRs covered:** FR-G1, FR-G2, FR-G3, FR-G4, FR-G5

### Epic 2: Scoring Engine & Live Stat Sheet
Players can see their build's computed damage, survivability, and speed scores update in real time on every passive node click, gear change, or level adjustment — powered by a deterministic Rust scoring engine implementing Last Epoch's actual damage formula. The engine runs in a separate pure Rust crate (`scoring-core`) and communicates via Tauri IPC with debounced rAF updates. Defensive floor failures (uncapped resistances, low crit avoidance, no sustain) are flagged as Critical suggestions before any offensive recommendations.
**FRs covered:** FR-A1, FR-A2, FR-A3, FR-A4, FR-A5, FR-A6, FR-A7, FR-A8, FR-B1, FR-B2, FR-B3, FR-B4, FR-B5, FR-B6, FR-B7

### Epic 3: Build Context — Idols, Blessings & Conditions
Players can input their complete in-game build context: place idols on an accurate 5×5 idol grid, assign monolith blessings from a searchable dropdown, and configure combat conditions (enemy type, charge counts, build-specific toggles). All context contributions flow into the live stat sheet in real time and are included in the Claude optimization payload, making suggestions context-accurate.
**FRs covered:** FR-C1, FR-C2, FR-C3, FR-C4, FR-C5, FR-C6, FR-C7, FR-C8, FR-C9, FR-D1, FR-D2, FR-D3, FR-D4, FR-D5, FR-E1, FR-E2, FR-E3, FR-E4, FR-E5

### Epic 4: Passive Tree Intelligence & Optimization
Players can run an AI-powered optimization that scans every unallocated passive node, computes per-path efficiency using a Dijkstra traversal and budget knapsack solver, detects mismatched/zero-value allocations, and overlays a gold/silver/dim efficiency heatmap directly on the passive tree canvas. Claude receives the full deterministic suggestion list and produces personalized natural-language explanations. Hovering a suggestion shows before/after stat deltas in the live stat sheet.
**FRs covered:** FR-A9, FR-A10, FR-A11, FR-A12, FR-A13, FR-A14, FR-A15, FR-A20, FR-A21, FR-A22, FR-A23, FR-A24, FR-A25, FR-A26, FR-A27, FR-A28, FR-B8

### Epic 5: Gear Optimization Screen
Players can open a dedicated Gear Optimization screen that analyzes all 12 gear slots against their build's ideal affix configuration. The player designates skill roles (Primary Offense required), and the scoring engine computes a skill-context-aware affix weight for every possible affix, ranks slots by upgrade priority, and generates a per-slot wishlist (top 2 prefix + suffix). Claude produces a prioritized gear narrative that references the player's specific Primary Offense skill and flags build-enabling unique items as Game-Changer recommendations.
**FRs covered:** FR-A16, FR-A17, FR-A18, FR-A19, FR-H1, FR-H2, FR-H3, FR-H4, FR-H5, FR-H6, FR-H7, FR-H8, FR-H9, FR-H10, FR-H11, FR-H12, FR-H13, FR-H14, FR-H15, FR-H16, FR-H17

### Epic 6: Visual Fidelity & UX Polish
The app achieves Last Epoch's authentic visual language throughout: canonical item rarity colors (7 tiers), damage-type color coding (7 types), and tree backgrounds (dark stone TilingSprite for passive/skill trees, void crystalline for the Weaver tab) that match the game's aesthetic. Keyboard shortcuts match lastepochtools.com conventions. Shift+click enables rapid multi-point allocation. Node tooltips that overflow the viewport scroll in place.
**FRs covered:** FR-F1, FR-F2, FR-F3, FR-F4, FR-F5, FR-F6, FR-F7, FR-F8, FR-F9, FR-F10


---

## Epic 1: Season 4 Game Data Foundation

Players' optimization suggestions are accurate for the current game season. The bundled game data is updated to Last Epoch Season 4 (Shattered Omens) and annotated with the `modifierType` and `scope` fields required by the scoring engine. This epic is the critical-path gate — all scoring engine stories in Epic 2+ depend on this data.

### Story 1.1: Game Data Type Extension & Schema Definition

As a developer,
I want the TypeScript types and JSON schemas extended to include `modifierType`, `scope`, and `damageType` fields on nodes and affixes, plus defined schemas for the three new game databases,
So that subsequent data ingestion and scoring engine stories have a stable contract to build against.

**Acceptance Criteria:**

**Given** the TypeScript type definitions in `shared/types/gameData.ts`
**When** a developer imports the passive node and affix types
**Then** passive node effects include an optional `modifierType?: 'increased' | 'more' | 'flat'` field
**And** affix entries (`AffixEntryV2`) include optional `modifierType`, `scope: 'melee' | 'ranged' | 'spell' | 'minion' | 'generic'`, and `damageType` fields

**Given** all new fields are optional
**When** the scoring engine encounters a node or affix without `modifierType`
**Then** the engine falls back to treating it as `"increased"` (no panic, no error)

**Given** the `idol-data.json` schema is documented
**When** an agent reviews the schema definition
**Then** the schema includes `version`, `defaultGrid` (with `rows`, `cols`, `blockedCells[]`), and an empty `altarVariants: []` array
**And** the `altarVariants` array is the documented Phase 4 extension point

**Given** the `conditions.json` schema is documented
**When** an agent reviews it
**Then** each condition entry includes: `id`, `displayLabel`, `category: 'universal' | 'build-specific'`, and an optional `filter` (class ID or skill tag)

**Given** the updated TypeScript types
**When** `pnpm build` runs
**Then** the build succeeds with zero TypeScript errors

### Story 1.2: Season 4 Node & Class Data Ingestion

As a player,
I want the passive tree and skill tree data to reflect Season 4 content including all new nodes and updated node effects annotated with modifier types,
So that optimization suggestions reference current-season nodes and produce correct scoring results.

**Acceptance Criteria:**

**Given** the class JSON files in `src-tauri/resources/classes/`
**When** the Season 4 ingestion pipeline runs against the lastepochtools.com community DB
**Then** all passive tree node effects in all 5 class files have a `modifierType` field populated as `"increased"`, `"more"`, or `"flat"`
**And** new Season 4 passive nodes (Spellblade updates, new Rogue nodes) are present in the relevant class files

**Given** the `manifest.json` file
**When** the Season 4 data is integrated
**Then** the `dataVersion` field reflects Season 4 (e.g., `"s4.1"` or equivalent format)
**And** the `gameVersion` string matches Season 4 (Shattered Omens)

**Given** a player running the app with Season 3 data
**When** the app compares the stored data version to the bundled version
**Then** the staleness bar displays an update prompt indicating Season 4 data is available

**Given** any passive node with no `modifierType` in the source DB
**When** the ingestion pipeline processes it
**Then** the pipeline uses a fallback heuristic (e.g., "more" keyword in effect text → `"more"`) and logs a warning
**And** no node is left without a `modifierType` field in the output JSON

### Story 1.3: Season 4 Affix & Item Data Ingestion

As a player,
I want the affix database and item database to reflect Season 4 content with delivery-type and damage-element scope annotations,
So that the gear affix scorer can correctly weight affixes for any build's damage delivery type and element.

**Acceptance Criteria:**

**Given** the affix database file
**When** the Season 4 ingestion pipeline runs
**Then** all affix entries have `modifierType`, `scope`, and `damageType` fields populated
**And** Rune of Corruption affixes from Season 4 are present with correct values and `modifierType` annotations

**Given** an affix whose scope cannot be determined from the community DB
**When** the ingestion pipeline processes it
**Then** a heuristic fallback applies: "Melee" in the affix name → `scope: "melee"`, "Spell" → `scope: "spell"`, etc.
**And** a fallback count is logged so the data can be manually verified

**Given** new Season 4 unique and set items
**When** the item database is inspected
**Then** all new uniques and set items are present with correct affix value tables and `modifierType` annotations
**And** build-enabling uniques (Exsanguinous, Bleeding Heart, Omnividence) are present with correct effect descriptions for the synergy detector

**Given** the updated affix and item databases
**When** `pnpm build` and `cargo build` both run
**Then** both succeed without errors
**And** no existing TypeScript type assertions fail due to schema changes

### Story 1.4: New Game Database Files & Staleness Integration

As a player,
I want the app to load idol, blessings, and conditions data on startup and surface staleness indicators when those databases are out of date,
So that the context input features in Epic 3 have correct data from day one and players are notified when updates are available.

**Acceptance Criteria:**

**Given** the Tauri resource bundle
**When** the app starts for the first time
**Then** `idol-data.json`, `blessings.json`, and `conditions.json` are all loaded without error
**And** all loading uses `invokeCommand<T>()` — never raw `invoke()`

**Given** `gameDataStore`
**When** the store is initialized
**Then** it exposes `isIdolDataStale`, `idolDataStaleAcknowledged`, `isBlessingsDataStale`, `blessingsDataStaleAcknowledged` boolean flags
**And** the new flags follow the identical initialization pattern as the existing `isItemDataStale` flag

**Given** the loaded `idol-data.json`
**When** the default grid layout is accessed
**Then** the grid has 5 rows and 5 columns with exactly 5 blocked cells: (0,0), (0,4), (4,0), (4,4), (2,2)
**And** the `altarVariants` array is present and empty

**Given** the loaded `blessings.json`
**When** blessings are queried by timeline
**Then** all current Season 4 monolith timeline blessings are present with their stat effects
**And** each blessing entry includes: `id`, `timelineId`, `timelineName`, `displayName`, and `statEffects[]`

**Given** the loaded `conditions.json`
**When** universal conditions are queried
**Then** entries for enemy type, per-element enemy resistance, and charge counts (frenzy, power, endurance) are all present
**And** build-specific conditions include at minimum: "Sigil of Hope active" (Paladin), "Is enemy Hexed?" (hex builds)


---

## Epic 2: Scoring Engine & Live Stat Sheet

Players can see their build's computed damage, survivability, and speed scores update in real time on every passive node click, gear change, or level adjustment — powered by a deterministic Rust scoring engine implementing Last Epoch's actual damage formula. Defensive floor failures are flagged as Critical suggestions before any offensive recommendations.

### Story 2.1: Scoring Engine Foundation — Crate Setup & Type System

As a developer,
I want the `scoring-core` Rust workspace crate scaffolded with all core types, the `ClassModule` trait, five class module stubs, and the `SCORING_ERROR` prefix wired into the TypeScript error system,
So that all subsequent Epic 2 stories have a stable, compiler-enforced foundation to build against.

**Acceptance Criteria:**

**Given** the `src-tauri/` directory
**When** a developer runs `cargo build -p scoring-core`
**Then** the crate compiles without errors
**And** `scoring-core/Cargo.toml` has no Tauri, no tokio, no async runtime dependencies — only serde, serde_json, rayon

**Given** `scoring-core/src/modifier.rs`
**When** an agent reviews it
**Then** `Modifier`, `ModifierType`, `Condition`, and `ModifierRegistry` are defined and public
**And** `ModifierRegistry::query(stat, active_conditions)` filters by `stat_key` and `condition.is_active(active_conditions)`
**And** the `Condition` enum includes `Always`, `Named(String)`, `Stacked { name, count }`, `Threshold { stat, above }`, and `Composite(Vec<Condition>)` variants

**Given** the `ClassModule` trait in `scoring-core/src/class_module.rs`
**When** an agent reviews it
**Then** the trait requires `class_id()`, `apply_modifiers(&mut registry, &snapshot)`, and `compute_class_stats(&base, &snapshot) -> Option<ClassStats>` methods
**And** five stub class modules exist in `scoring-core/src/classes/` (sentinel, mage, primalist, rogue, acolyte), each compiling with no-op implementations

**Given** `shared/types/errors.ts`
**When** an agent inspects the `ErrorType` const
**Then** `SCORING_ERROR: 'SCORING_ERROR'` is present as a value
**And** `shared/utils/errorNormalizer.ts` maps `'SCORING_ERROR'` in `ERROR_TYPE_MAP` via case-insensitive substring match

**Given** `shared/types/statSheet.ts` (new file)
**When** a developer imports from it
**Then** `StatSheet`, `OffenseStats`, `DefenseStats`, `ScoreComponents`, `StatWarning`, `NodeEfficiency`, `GearAnalysis`, `SynergyFlag` are all exported
**And** `AilmentStats` and `MinionStats` are exported as Phase 4 placeholder interfaces (empty interfaces)
**And** no `index.ts` barrel file is created

**Given** the TypeScript build
**When** `pnpm build` runs after this story
**Then** zero TypeScript errors occur

### Story 2.2: Stage 1 — Build Score Function Implementation

As a player,
I want the scoring engine to compute my build's DamageScore, SurvivabilityScore, SpeedScore, and composite BuildScore using Last Epoch's actual damage formula,
So that every stat value I see in the app is mathematically correct rather than estimated.

**Acceptance Criteria:**

**Given** a `BuildSnapshot` with passive nodes containing only "increased" modifiers summing to 150%
**When** `compute_stats()` is called
**Then** `offense.damage_score` matches `base × (1 + 1.50) × 1.0` = `base × 2.5`
**And** the computation completes in < 2ms on target hardware

**Given** a build with 82% crit chance and a crit multiplier of 350%
**When** `compute_stats()` is called
**Then** `offense.avg_hit_damage_crit_weighted` equals `base_hit × (3.50 × 0.82 + 1.0 × 0.18)` = `base_hit × 3.05`
**And** crit chance inputs above 100% are clamped to 1.0 before computation

**Given** a build with HP 1500, Ward 300, Endurance 30%
**When** `compute_stats()` is called
**Then** `defense.effective_hp` equals `1500 × (1 + 300/1500) × (1 / (1 - 0.30))` ≈ 2571
**And** defensive layer count is tracked and used in the survivability bonus multiplier

**Given** a slider position of 50 (balanced: w_dmg=0.55, w_surv=0.35, w_speed=0.10)
**When** `compute_stats()` is called
**Then** `scores.build_score` equals `0.55 × damage_score + 0.35 × surv_score + 0.10 × speed_score`

**Given** a passive node with no `modifierType` field
**When** `compute_stats()` processes it
**Then** the modifier is treated as `"increased"` (additive) with no panic or error

**Given** the `scoring-core` unit test suite
**When** `cargo test -p scoring-core` runs
**Then** all formula tests pass including: damage formula with increased-only, damage formula with a more multiplier, crit-weighted damage at various crit chance values, EHP with Ward and Endurance, BuildScore weights at all five slider positions from the archetype weight table

### Story 2.3: Defensive Floor Check

As a player,
I want the app to flag uncapped resistances, low crit avoidance, and missing sustain as Critical-priority warnings before showing any offensive suggestions,
So that I never receive offensive optimization suggestions while my build has survivability-breaking gaps.

**Acceptance Criteria:**

**Given** a build with Fire resistance at 52%
**When** `compute_stats()` runs the defensive floor check
**Then** `stat_sheet.warnings` contains a `StatWarning` with `type: "fire_resistance_uncapped"`, `current_value: 52`, `gap: 23`
**And** the warning includes the specific gear slot that has room for a resistance fix

**Given** a build with Crit Avoidance at 62%
**When** `compute_stats()` runs
**Then** `stat_sheet.warnings` contains a `StatWarning` with `type: "crit_avoidance_low"` and `current_value: 62`

**Given** a build with no sustain layer (no life leech, no Ward generation, life regen < 100/s)
**When** `compute_stats()` runs
**Then** `stat_sheet.warnings` contains a `StatWarning` with `type: "no_sustain_layer"`

**Given** a build that passes all three defensive floor checks
**When** `compute_stats()` runs
**Then** `stat_sheet.warnings` is empty

**Given** the `scoring-core` unit test suite
**When** defensive floor check tests run
**Then** tests cover all failure cases: fire/cold/lightning/void/poison/physical resistance uncapped, crit avoidance below 80%, no sustain layer, and the happy path
**And** all tests pass

### Story 2.4: Tauri IPC Wiring — `compute_stats` Command

As a developer,
I want the `compute_stats` Tauri command registered and wired to `scoring-core::compute_stats`, with game data loaded once at startup and held in `AppState`,
So that TypeScript can call `invokeCommand<StatSheet>('compute_stats', { snapshot })` and receive a correct `StatSheet`.

**Acceptance Criteria:**

**Given** `src-tauri/Cargo.toml`
**When** an agent reviews it
**Then** it is a workspace root with `members = [".", "scoring-core"]`
**And** `rayon` is listed as a dependency only in `scoring-core/Cargo.toml`

**Given** `scoring_commands.rs` in the Tauri crate
**When** an agent reviews it
**Then** the sync `compute_stats` Tauri command is defined there (not inline in `lib.rs`)
**And** it calls `scoring_core::compute_stats(&snapshot, &game_data, ComputeOptions::default())`

**Given** `game_data_loader.rs` in the Tauri crate
**When** the Tauri app starts
**Then** `scoring_core::GameData` is constructed from disk JSON files exactly once
**And** it is held in `AppState` as `Arc<RwLock<scoring_core::GameData>>` and reused for every command call without re-reading disk

**Given** the sync `compute_stats` command execution
**When** it runs
**Then** it takes a `.read().unwrap()` lock (no clone), computes, and the lock drops at function end
**And** the lock is never held across an `await` boundary

**Given** a TypeScript call to `invokeCommand<StatSheet>('compute_stats', { snapshot })`
**When** the command resolves successfully
**Then** the returned `StatSheet` has snake_case field names (e.g., `build_score`, `offense`)
**And** the Rust `BuildSnapshot` input struct has `#[serde(rename_all = "camelCase")]` so TypeScript sends camelCase properties

**Given** a scoring computation error in Rust
**When** the error propagates
**Then** the error string is prefixed with `"SCORING_ERROR: "`
**And** `normalizeAppError()` maps it to `ErrorType.SCORING_ERROR` correctly without falling through to `UNKNOWN_ERROR`

### Story 2.5: TypeScript Integration — Serializer, Hook & Store

As a developer,
I want the `buildSnapshotSerializer.ts` utility, `useStatSheet.ts` hook, and `optimizationStore` extensions wired together so stat sheet updates flow automatically on every build state change,
So that the stat sheet display in Story 2.6 has live data without any "Recalculate" button.

**Acceptance Criteria:**

**Given** `shared/utils/buildSnapshotSerializer.ts`
**When** `toBuildSnapshot(activeBuild, gameData)` is called with a full `BuildState`
**Then** the returned `BuildSnapshot` contains only ID-based data (node IDs, affix IDs, tiers, idol placements, blessings, conditions, level, class, mastery, slider)
**And** `BuildState` UI-specific fields (`schemaVersion`, undo metadata) are absent from the snapshot

**Given** `shared/stores/useStatSheet.ts`
**When** the user rapidly allocates five nodes in < 16ms
**Then** only one `invokeCommand('compute_stats', ...)` call fires per rAF frame
**And** the stat sheet reflects the final allocation state, not an intermediate state

**Given** a pending `compute_stats` call and a newer state change arriving before it resolves
**When** the newer call's result arrives and then the older call also resolves
**Then** the stale (older) result is discarded via the `generationRef` counter
**And** `optimizationStore.statSheet` reflects only the latest generation's result

**Given** `App.tsx`
**When** an agent reviews it
**Then** the inline `calculateScore` subscribe blocks are removed
**And** `useStatSheet()` is called as a single hook call in `App.tsx`
**And** `scoringEngine.ts` still exists in place with a deprecation comment (deletion is a follow-up story, not part of this story)

**Given** `optimizationStore`
**When** an agent reviews its fields
**Then** `statSheet: StatSheet | null`, `isComputingStats: boolean`, `setStatSheet()`, and `setIsComputingStats()` are all present
**And** `nodeEfficiencies: NodeEfficiency[] | null` and its setter are present (will be wired in Epic 4 Story 4.4)

### Story 2.6: Stat Sheet UI — Five-Tab Display

As a player,
I want a five-tab stat sheet in the right panel showing General, Offense, Defense, Minion, and Other stats that update in real time on every state change,
So that I can see my build's computed performance across all dimensions without any manual recalculation.

**Acceptance Criteria:**

**Given** the right panel stat sheet section with the General tab active
**When** a player views it
**Then** character level, passive points spent vs. available (per mastery), per-skill levels and skill points spent vs. available, class and mastery name are all displayed with correct values
**And** values update within one rAF frame of any node allocation or level change

**Given** an Offense tab with a crit-focused build loaded
**When** the player views it
**Then** DamageScore, average hit damage (base and crit-weighted), crit chance %, crit multi %, attack or cast speed per active skill, and AoE modifier are all displayed with correct computed values

**Given** the Defense tab with any resistance below the 75% cap
**When** that resistance is displayed
**Then** it is visually flagged as uncapped (distinct color or warning icon)
**And** a tooltip or inline label indicates the gap to cap (e.g., "+23% needed")

**Given** a build with no minion skills active
**When** the stat sheet is rendered
**Then** the Minion tab is not visible (hidden, not just disabled or greyed out)
**And** when a minion skill is later assigned, the Minion tab appears without requiring a page refresh

**Given** `optimizationStore.isComputingStats = true` during recalculation
**When** the stat sheet renders
**Then** a loading indicator is visible on the stat sheet
**And** the previous stat values remain visible during loading (no blank flash or layout shift)

**Given** the stat sheet with all five tabs rendered
**When** `axe(container)` accessibility check runs
**Then** `expect(await axe(container)).toHaveNoViolations()` passes
**And** all tabs are keyboard-navigable with correct `aria-selected` states and 2px solid accent-gold focus rings


---

## Epic 3: Build Context — Idols, Blessings & Conditions

Players can input their complete in-game build context: idol placement on an accurate 5×5 grid, monolith blessings from a searchable panel, and combat conditions (enemy type, charge counts, build-specific toggles). All context flows into the live stat sheet in real time and is included in the Claude optimization payload.

### Story 3.1: Idol Grid Builder — Layout & Placement

As a player,
I want an idol grid that matches the Last Epoch in-game layout where I can place idols by size type with valid placement enforcement and clear/reset controls,
So that my idol configuration is accurately modeled in the app's stat calculations.

**Acceptance Criteria:**

**Given** the context panel is open
**When** a player navigates to the Idols section
**Then** a 5×5 grid is displayed with the four corners and center cell visually blocked (non-interactive, distinct visual treatment)
**And** the layout matches the Last Epoch in-game idol grid per the `idol-data.json` `defaultGrid` spec

**Given** an empty idol grid
**When** a player clicks an active cell and selects idol size type "1×2"
**Then** the idol occupies 2 cells in the correct column-orientation and the cells become visually occupied
**And** the idol's visual representation shows placeholder affix slots (configured in Story 3.2)

**Given** a player tries to place a "2×2" idol that would overlap an existing "1×2" idol
**When** the placement is attempted
**Then** the placement is rejected and an error message explains the overlap
**And** no partial placement occurs

**Given** a placed idol
**When** the player clicks "Clear slot" for that idol
**Then** the cells return to empty state immediately
**And** the idol's stat contributions are removed from the stat sheet within one rAF frame

**Given** a grid with multiple placed idols
**When** the player clicks "Reset all idols"
**Then** all slots clear and the stat sheet updates to reflect no idol contributions

**Given** idol grid state when a build is saved and then reloaded
**When** the build is restored
**Then** all placed idols are at their exact positions with correct size types
**And** idol state is persisted in `buildStore.activeBuild.contextData`

### Story 3.2: Idol Affix Selection & Stat Contribution

As a player,
I want to assign prefix and suffix affixes with tier selection to each placed idol, with affix contributions flowing into the live stat sheet and optimization payload,
So that the scoring engine factors in my actual idol bonuses when computing stats and suggestions.

**Acceptance Criteria:**

**Given** a placed idol of size 1×2
**When** the player opens the affix picker
**Then** only affixes valid for that idol's size and type appear in the prefix picker
**And** only valid suffixes appear in the suffix picker (sourced from `idol-data.json` affix tables)

**Given** an idol with a T2 Endurance Threshold prefix selected
**When** the player changes the tier to T5
**Then** the Defense tab's endurance threshold value updates immediately
**And** the `BuildSnapshot` passed to `compute_stats` includes the updated tier value

**Given** an idol type that requires both prefix and suffix (per game rules)
**When** the player tries to confirm placement with only one affix selected
**Then** confirmation is blocked with a clear message that both are required for this idol type

**Given** placed idols with affixes configured
**When** `run_optimization` or `run_gear_scoring` is called
**Then** the full idol context (slot position, idol size, affix IDs, tiers) is present in `BuildSnapshot`
**And** the optimization payload includes idol data so Claude can generate idol-specific suggestions

### Story 3.3: Blessings Panel

As a player,
I want to assign monolith blessings from a searchable panel with one blessing per timeline, with blessing contributions flowing into the stat sheet in real time,
So that my actual blessings are modeled in the scoring engine and included in optimization suggestions.

**Acceptance Criteria:**

**Given** the context panel with the Blessings section open
**When** the player views it
**Then** all monolith timelines are listed, each with a searchable dropdown for selecting one blessing
**And** selecting a blessing from one timeline does not affect other timelines' selections

**Given** the blessing search field in any timeline dropdown
**When** a player types "critical"
**Then** only blessings with "critical" in their name or description are shown (case-insensitive)

**Given** a blessing selected from a timeline that provides +14% fire resistance
**When** that blessing is active
**Then** the Defense tab's fire resistance value increases by 14%
**And** the `BuildSnapshot` includes the blessing's stat effect for `compute_stats`

**Given** a player who deselects a previously selected blessing
**When** the blessing is removed
**Then** the stat sheet removes its contribution immediately
**And** the optimization payload no longer includes the blessing's effect

**Given** a stale blessings database detected by the staleness check system
**When** the app displays the blessings panel
**Then** the staleness indicator uses the existing staleness bar pattern
**And** the blessing selection remains functional with current data while the update is pending

### Story 3.4: Conditions Panel

As a player,
I want a conditions panel where I can set combat context (enemy type, charges, build-specific toggles) that flows into the scoring engine and Claude's optimization payload,
So that optimization suggestions are accurate for my actual play context (e.g., boss fight with power charges active).

**Acceptance Criteria:**

**Given** the Conditions panel is opened
**When** the player views universal conditions
**Then** an enemy type selector (standard mob / rare / unique boss / pinnacle boss), per-element enemy resistance inputs, and charge count selectors (frenzy, power, endurance up to their maximums) are all displayed

**Given** a Paladin build with "Sigil of Hope" skill assigned to an active slot
**When** the Conditions panel is displayed
**Then** a "Is Sigil of Hope active?" toggle is visible
**And** a non-Paladin build without Sigil of Hope does not show this toggle

**Given** conditions set to "pinnacle boss" with 3 power charges active
**When** `compute_stats()` is called
**Then** `BuildSnapshot.activeConditions` includes `["on_pinnacle_boss", "power_charges_3"]`
**And** the DamageScore in the stat sheet reflects the condition-adjusted computation

**Given** active conditions when `run_optimization` is triggered
**When** the Claude optimization payload is assembled
**Then** `build_context.conditions` in the payload matches the active conditions
**And** Claude references the conditions in at least one suggestion explanation

**Given** a build-specific condition visible for a skill currently in a slot
**When** the player replaces that skill with a different skill
**Then** the condition disappears from the panel
**And** the `BuildSnapshot` no longer includes the now-irrelevant condition

---

## Epic 4: Passive Tree Intelligence & Optimization

Players can run an AI-powered optimization that scans every unallocated passive node, computes per-path efficiency using Dijkstra + knapsack, detects mismatched/zero-value allocations, and overlays a gold/silver/dim efficiency heatmap on the passive tree canvas. Claude receives the deterministic suggestion list and produces personalized explanations. Hovering a suggestion shows before/after deltas in the live stat sheet.

### Story 4.1: Passive Tree Efficiency Scan — Dijkstra + Knapsack Solver

As a player,
I want the optimization engine to compute the efficiency of every unallocated passive path using shortest-path traversal with "more" modifier and mastery depth bonuses, then solve for the optimal multi-point allocation within my budget,
So that optimization recommendations are the highest-value moves for my specific build, not guesses.

**Acceptance Criteria:**

**Given** a passive tree with 50 unallocated nodes and a single allocated region
**When** `run_efficiency_scan()` is called in `scoring-core/scan.rs`
**Then** each unallocated node has `efficiency = path_delta_score / effective_point_cost`
**And** `effective_point_cost` correctly counts all unallocated prerequisites on the minimum-cost Dijkstra path

**Given** a build with Σ Increased% = 250% (above the 200% threshold) and a "more" damage node unallocated
**When** `run_efficiency_scan()` runs
**Then** that node's efficiency is multiplied by a factor between 3.0 and 5.0 (scaled by `1 + 250/200 = 2.25`, capped at 5×)
**And** an equivalent "increased" modifier node at the same point cost scores lower

**Given** a passive node at depth 8 in the mastery sub-tree
**When** `run_efficiency_scan()` runs
**Then** that node's efficiency includes the 1.2× mastery depth bonus
**And** a node at depth 5 does not receive this bonus

**Given** a player with 6 unspent points
**When** the budget knapsack solver runs after the efficiency scan
**Then** the greedy phase selects the top 20 highest-efficiency candidate paths as the shortlist
**And** the DP knapsack over the shortlist finds the globally optimal combination within the 6-point budget
**And** the output is an ordered allocation list with cheapest-first ordering within each path

**Given** `scoring-core` unit tests for `scan.rs`
**When** `cargo test -p scoring-core` runs
**Then** tests cover: correct Dijkstra path finding on a synthetic tree, "more" multiplier application, mastery depth bonus, knapsack output matching manual calculation for a 5-node example
**And** rayon parallelism produces identical output to a sequential reference implementation

**Given** a passive tree with 150 unallocated nodes
**When** `run_efficiency_scan()` runs using rayon
**Then** the scan completes in < 20ms on target hardware
**And** output is deterministic across repeated runs with the same input

### Story 4.2: Cross-Domain Synergy Detection

As a player,
I want the engine to detect passive nodes I've allocated that don't apply to my skills, affix mismatches between my gear and my damage delivery type, and build-enabling unique items I'm close to unlocking,
So that I can reallocate wasted passive points, fix inapplicable gear affixes, and know when a single unique item would be transformative.

**Acceptance Criteria:**

**Given** a caster build with a "Melee Damage" passive node allocated
**When** `run_synergy_detection()` is called
**Then** that node is flagged as a Medium-priority "zero-value reallocation" suggestion
**And** the suggestion identifies the node by name and explains it contributes zero value (melee damage on a spell build)

**Given** a spell-only build with "Melee Critical Strike Chance" affix on a gear slot
**When** `run_synergy_detection()` is called
**Then** that affix is flagged as a High-priority "mismatched affix" suggestion
**And** the suggestion identifies "Spell Critical Strike Chance" as the correct replacement scope

**Given** a build where equipping Exsanguinous would increase BuildScore by > 30%
**When** `run_synergy_detection()` is called
**Then** Exsanguinous appears as a "Game-Changer" suggestion
**And** the suggestion includes the specific stat threshold needed and the current gap

**Given** synergy detection results combined with the efficiency scan results
**When** `run_optimization` assembles the full suggestion list
**Then** Critical defensive suggestions (from the floor check) rank above all synergy and efficiency suggestions
**And** High-priority synergy suggestions (mismatched affixes) rank above Medium-priority (zero-value reallocations)

### Story 4.3: `run_optimization` Tauri Command & Claude Narrative

As a player,
I want clicking "Optimize" to trigger the full pipeline and receive Claude's natural-language explanations that reference specific delta values from the deterministic engine,
So that every suggestion I read is verifiably correct and explained in plain language referencing my specific build numbers.

**Acceptance Criteria:**

**Given** the `lib.rs` invoke handler
**When** an agent inspects it
**Then** `run_optimization` is registered in `invoke_handler!`
**And** the handler is `async` and uses `spawn_blocking` for the CPU-intensive scan and synergy stages

**Given** a `run_optimization` call completes
**When** the Claude payload is assembled
**Then** the payload includes for each suggestion: `ΔBuildScore`, `EffectivePointCost`, synergy flags, and the specific numerical context (current crit chance, exact resistance gap, node ID and path)
**And** `build_context` includes class, mastery, active skills, level, slider position, and active conditions

**Given** Claude processes the optimization payload
**When** suggestion explanations stream back via `optimization:suggestion-received`
**Then** each explanation references the specific delta values from the engine (e.g., "190% average damage gain")
**And** the suggestion stream order matches the engine's priority order exactly
**And** Claude does not add suggestions beyond what the engine produced

**Given** the existing `useOptimizationStream` hook
**When** an agent reviews it after this story
**Then** it calls `invokeCommand('run_optimization', { snapshot })` as the active optimization path
**And** all existing suggestion streaming behavior is preserved (`optimization:suggestion-received` events still fire per suggestion)

### Story 4.4: Node Efficiency Overlay on Passive Tree

As a player,
I want a color-coded efficiency heatmap overlay on the passive tree canvas showing which unallocated nodes offer the highest value for my current budget, with a toggle button to hide/show it,
So that I can visually identify the highest-value passive nodes at a glance without reading every suggestion detail.

**Acceptance Criteria:**

**Given** `run_optimization` completes with node efficiencies
**When** `optimizationStore.nodeEfficiencies` is populated
**Then** the passive tree canvas renders efficiency tier colors on every unallocated node: gold = top quartile, silver = second quartile, dim = third/fourth quartile or unreachable within budget

**Given** all passive points are spent (zero unspent budget)
**When** the overlay is active
**Then** no efficiency overlay colors are rendered on any node (per FR-A27)

**Given** the tree controls bar
**When** a player clicks the overlay toggle button
**Then** the overlay hides if currently visible, and shows if currently hidden
**And** the overlay defaults to visible when `nodeEfficiencies` is non-null

**Given** the efficiency overlay is rendering
**When** a frame renders
**Then** the overlay adds ≤ 2ms to the frame render time (precomputed when `nodeEfficiencies` changes, not recalculated per frame)

**Given** `SkillTreeCanvas` implementation
**When** an agent reviews it
**Then** `SkillTreeCanvas` does NOT access `optimizationStore` directly
**And** `nodeEfficiencies` is passed as a prop from `SkillTreeView` (following the props-only canvas rule)

### Story 4.5: Stat Sheet Suggestion Preview — Hover Deltas

As a player,
I want to hover over any AI suggestion to see how applying it would change my stat sheet values — gains in green and losses in red — so I can evaluate the trade-off at a glance.

**Acceptance Criteria:**

**Given** a suggestion item in the suggestion list
**When** the player hovers over it
**Then** affected stat sheet values display before/after deltas: gains appear as green `(+X%)`, losses appear as red `(-X%)`
**And** unaffected stat sheet values show no delta notation

**Given** hover delta display is active
**When** the player moves the mouse off the suggestion item
**Then** all stat sheet values return to normal display immediately with no animation delay

**Given** the stat sheet is in a loading state (`isComputingStats = true`)
**When** the player hovers a suggestion
**Then** hover delta display is suppressed — deltas cannot be shown against an in-flight computation

**Given** the hover delta implementation
**When** `axe(container)` runs on the suggestion list
**Then** `expect(await axe(container)).toHaveNoViolations()` passes
**And** color is not the sole differentiator — delta values include `+` or `-` prefix signs for color-blind accessibility


---

## Epic 5: Gear Optimization Screen

Players can open a dedicated Gear Optimization screen that analyzes all 12 gear slots against their build's ideal affix configuration. The player designates skill roles, and the scoring engine computes skill-context-aware affix weights, ranks slots by upgrade priority, and generates per-slot wishlists. Claude produces a prioritized gear narrative referencing the player's specific Primary Offense skill.

### Story 5.1: Skill Role Designation

As a player,
I want to designate which of my active skills is my Primary Offense (required) and optionally tag others as Secondary Offense, Defensive, or Utility — with those designations saved with the build,
So that the gear scoring engine knows which damage type and delivery type to optimize affix recommendations around.

**Acceptance Criteria:**

**Given** the Gear Optimization screen opened for the first time (no roles set)
**When** the player views the screen
**Then** a prompt explains that at least one skill must be designated Primary Offense before analysis can run
**And** a role designation UI shows all active skill slots with role buttons or dropdowns

**Given** skill roles are designated and the build is saved
**When** the build is reloaded
**Then** the skill role designations are restored exactly as saved
**And** roles do not affect the passive tree optimization flow or the main optimization view

**Given** a player changes the skill assigned to a slot that had a role
**When** the skill changes
**Then** the role designation for that slot is cleared
**And** the Gear Optimization screen's role display reflects the cleared state

**Given** only a Secondary Offense role is designated with no Primary Offense
**When** the player clicks "Analyze Gear"
**Then** the analysis is blocked with an error: "Please designate at least one skill as Primary Offense before running gear analysis"

### Story 5.2: Gear Affix Scorer — Rust Implementation

As a player,
I want the scoring engine to compute skill-context-aware affix weights that zero out inapplicable affixes, identify ideal affix configurations per slot, and rank slots by upgrade priority,
So that gear recommendations are specific to my build's damage type and delivery method rather than generic.

**Acceptance Criteria:**

**Given** a Poison Bladedancer build with Poison Eruption as Primary Offense (spell delivery type)
**When** `run_gear_scoring()` computes affix weights
**Then** Poison-damage affixes and ailment-scaling prefixes score significantly higher than generic damage affixes
**And** "Melee Critical Strike Chance" scores exactly zero (delivery type mismatch: Poison Eruption is a spell)

**Given** all 12 equipped gear slots
**When** `run_gear_scoring()` computes UpgradeScore per slot
**Then** each slot has an `UpgradeScore` = gap between current affix config and ideal (top 2 prefix + 2 suffix by weight × tier value)
**And** the slot with the highest UpgradeScore is identified as the Priority Upgrade slot

**Given** a player changes their Primary Offense skill designation
**When** the affix weight cache is checked
**Then** the cache is invalidated and the next `run_gear_scoring()` recomputes all weights from scratch

**Given** the `scoring-core` unit tests for `gear.rs`
**When** `cargo test -p scoring-core` runs
**Then** tests cover: delivery-type zero-weight filtering, damage-element filtering, ideal prefix/suffix ranking, UpgradeScore computation for a known-correct gear scenario
**And** all tests pass

### Story 5.3: `run_gear_scoring` Tauri Command & TypeScript Wiring

As a developer,
I want the `run_gear_scoring` Tauri command registered, with `useGearStream.ts` subscribing to `gear:analysis-complete` and `gear:error` events — completely isolated from the `optimization:*` namespace,
So that the Gear Optimization screen receives gear analysis results without interfering with the main optimization flow.

**Acceptance Criteria:**

**Given** `lib.rs` invoke handler
**When** an agent inspects it
**Then** `run_gear_scoring` is registered in `invoke_handler!`
**And** the handler is `async` and uses `spawn_blocking` for the gear scoring computation

**Given** `run_gear_scoring` completes on the Rust side
**When** the gear analysis result is ready
**Then** a `gear:analysis-complete` Tauri event is emitted with the full `GearAnalysis` payload
**And** the `optimization:*` event namespace is NOT used for any gear analysis events

**Given** `shared/stores/useGearStream.ts`
**When** the hook is active
**Then** it subscribes to `gear:analysis-complete` and `gear:error` events
**And** on `analysis-complete`, it updates the relevant store field with the `GearAnalysis` payload
**And** on `gear:error`, it surfaces a user-facing error via the existing toast/error system

**Given** the `GearAnalysis` TypeScript type in `shared/types/statSheet.ts`
**When** a developer imports it
**Then** field names mirror the Rust output struct's snake_case naming exactly
**And** the type includes `slotRankings: GearSlotRanking[]`, `prioritySlot: string`, and all required nested types

### Story 5.4: Gear Optimization View — Priority Ranking & Wishlists

As a player,
I want the Gear Optimization screen to show all 12 gear slots ranked by upgrade priority with a per-slot affix wishlist including tier targets, mechanical reasons, and satisfied-affix checkmarks, weighted by my slider position,
So that I know exactly what to craft or trade for, in order of impact.

**Acceptance Criteria:**

**Given** the Gear Optimization screen after "Analyze Gear" completes
**When** the player views the ranking list
**Then** all 12 gear slots appear in descending UpgradeScore order
**And** each slot shows its name and "XX% of ideal" efficiency value
**And** the highest-gap slot is visually flagged as "Priority Upgrade" (distinct badge or color)

**Given** a Unique item in a gear slot whose special effect contributes positively to BuildScore
**When** that slot is shown in the ranking
**Then** it is marked "correct — keep" regardless of affix UpgradeScore
**And** a tooltip explains: "This unique's effect contributes positively to your build"

**Given** a gear slot's per-slot wishlist section
**When** the player views it
**Then** up to 2 prefix recommendations and 2 suffix recommendations are shown, each with: affix name, target tier label (e.g., "T5+"), and a one-sentence mechanical reason
**And** current affixes that match a wishlist item are shown with a checkmark (satisfied)
**And** missing or below-target-tier affixes are visually highlighted

**Given** the Glass Cannon ↔ Juggernaut slider at position 20 (near Juggernaut)
**When** gear analysis runs
**Then** defensive affixes (Hybrid Health, Endurance Threshold, Resistances) rank in the top positions of every slot's wishlist
**And** at slider position 80, offensive affixes rank highest

**Given** the Gear Optimization screen rendered
**When** `axe(container)` runs
**Then** `expect(await axe(container)).toHaveNoViolations()` passes
**And** all slot items and wishlist rows have accessible labels and keyboard-navigation support

### Story 5.5: Claude Gear Narrative Integration

As a player,
I want Claude to generate a personalized gear narrative that references my Primary Offense skill by name, identifies my weakest slot with specific delta values, surfaces Game-Changer unique item recommendations, and calls out my slider-driven archetype priorities,
So that the gear narrative feels tailored to my specific build rather than generic boilerplate.

**Acceptance Criteria:**

**Given** a Poison Bladedancer with "Poison Eruption" as Primary Offense and a crit-less Amulet
**When** Claude generates the gear narrative
**Then** the narrative names "Poison Eruption" at least once and identifies the Amulet by slot name
**And** the narrative includes specific delta values from the engine (e.g., "+22% average damage" from a T5 crit prefix)

**Given** a build where equipping Exsanguinous would be a Game-Changer (>30% BuildScore increase)
**When** Claude generates the gear narrative
**Then** Exsanguinous is explicitly surfaced as a "Game-Changer" recommendation
**And** the narrative includes the specific stat threshold needed and how close the build currently is

**Given** the slider set to full Glass Cannon position
**When** Claude generates the gear narrative
**Then** the narrative includes text stating that offensive affixes are prioritized and notes that shifting toward Juggernaut would elevate Hybrid Health and Endurance Threshold to the top of every slot

**Given** the gear narrative is being generated
**When** the player views the Gear Optimization screen
**Then** a streaming/loading state is shown while Claude generates
**And** narrative text appears progressively as Claude streams it

---

## Epic 6: Visual Fidelity & UX Polish

The app achieves Last Epoch's authentic visual language throughout: canonical rarity colors, damage-type color coding, tree backgrounds matching the game aesthetic, keyboard shortcuts that match lastepochtools.com conventions, scrollable node tooltips, and Shift+click multi-point allocation.

### Story 6.1: Item Rarity & Damage-Type Color Systems

As a player,
I want all item names, tooltips, and affix headers to use Last Epoch's canonical rarity colors, and all damage/resistance values in the stat sheet to use LE's canonical damage-type colors,
So that the app's visual language feels continuous with the game itself.

**Acceptance Criteria:**

**Given** an item name displayed in any panel (gear context, tooltips, affix headers)
**When** the item's rarity is "Rare"
**Then** the item name text renders in `#D4AF37` (Rare yellow)
**And** all 7 rarity colors are applied consistently: Common (#E8E8E8), Magic (#5B9BD5), Rare (#D4AF37), Unique (#E87722), Set (#4CAF50), Exalted (#9C27B0), Legendary (#C62828)

**Given** a Unique item equipped in a gear slot
**When** the gear panel renders
**Then** the item name appears in `#E87722` (Unique orange)
**And** all of its affix entries are read-only (no affix picker, no tier selector)

**Given** the Defense tab showing Fire resistance
**When** the stat is displayed
**Then** the value and label use `#E85D2A` (Fire color)
**And** each damage type uses its canonical color: Cold (#5BC8E8), Lightning (#F0D020), Void (#A050D0), Poison (#50B840), Physical (#D0D0D0), Bleed (#A03030)

**Given** any panel using the new color system
**When** `axe(container)` runs
**Then** `expect(await axe(container)).toHaveNoViolations()` passes
**And** color is not the only differentiator — icons, labels, or text also distinguish rarity and damage type for color-blind accessibility

### Story 6.2: Tree Background Textures

As a player,
I want the passive tree and skill tree canvases to display a dark stone texture background with damage-type tint overlays on skill trees and a void/crystalline purple background on the Weaver tab,
So that the tree UI feels immersive and visually connected to the game.

**Acceptance Criteria:**

**Given** the passive tree canvas is initialized
**When** the tree renders
**Then** a `TilingSprite` with `bg_stone_tile.webp` texture is the first child of `worldContainer` (inserted before `edgeGraphics`)
**And** `app.init()` uses `backgroundAlpha: 0` (transparent) — the `TilingSprite` handles the entire background

**Given** a skill tree canvas for a skill with COLD as primary damage type
**When** the canvas renders
**Then** a semi-transparent cool blue overlay (`rgba(40, 100, 180, 0.18)`) is applied over the stone base texture
**And** the overlay is a single precomputed `Graphics` rect (not a per-frame draw call)

**Given** the Weaver Tree tab (Tab 6)
**When** a player clicks on it
**Then** the `WeaverTreePlaceholder` panel has `bg_weaver_tile.webp` applied as a CSS background image
**And** the weaver tab looks intentional and on-brand (not a blank grey box)

**Given** the bundled app resources
**When** `src-tauri/resources/backgrounds/` is inspected
**Then** both `bg_stone_tile.webp` and `bg_weaver_tile.webp` are present as static resources
**And** their combined file size is < 50KB

**Given** `pixiRenderer.ts`
**When** an agent reviews it
**Then** the WebGL null info-log patch IIFE at module load is still present and unchanged

### Story 6.3: Keyboard Shortcuts & Undo/Redo Controls

As a player,
I want Ctrl+Z/Y (Win) and Cmd+Z/Y (Mac) for undo/redo with visible ↩/↪ buttons in the tree controls bar, and global C/S/P shortcuts to focus context panel, skill tree, and passive tree respectively,
So that keyboard-driven workflow matches the conventions I'm used to from other build planning tools.

**Acceptance Criteria:**

**Given** no text input has focus
**When** the user presses `Ctrl+Z` (Windows) or `Cmd+Z` (macOS)
**Then** the last passive node allocation is undone
**And** the stat sheet updates to reflect the undone state within one rAF frame

**Given** an undone state
**When** the user presses `Ctrl+Y` (Windows) or `Cmd+Y` (macOS)
**Then** the undone allocation is redone and the stat sheet updates correctly

**Given** the tree controls bar
**When** an agent reviews it
**Then** a visible ↩ (undo) button and ↪ (redo) button are present alongside the existing reset button
**And** both buttons are disabled when no undo/redo history is available (respectively)
**And** both buttons have accessible `aria-label` attributes and meet the 2px solid accent-gold focus ring standard

**Given** no text input has focus
**When** the user presses `C`
**Then** the context panel (gear / idols / blessings section) receives keyboard focus with a visible focus ring
**And** `S` focuses the active skill tree tab, `P` focuses the passive tree tab

**Given** a text input (affix search, blessing search, etc.) is focused
**When** the user types `C`, `S`, or `P`
**Then** the global panel shortcuts are NOT triggered — the character is entered into the text input normally

### Story 6.4: Tooltip Polish & Multi-Point Allocation

As a player,
I want node tooltips that overflow the viewport to be scrollable in place via mouse wheel, and Shift+click to allocate multiple points at once up to my remaining budget — matching lastepochtools.com behavior,
So that long tooltips don't get clipped and multi-point node allocation is fast.

**Acceptance Criteria:**

**Given** a passive node whose tooltip content is taller than 60% of the viewport height
**When** the player hovers over that node
**Then** the tooltip renders with a maximum height (60vh) and an internal scrollbar
**And** mouse wheel scrolling inside the tooltip scrolls the tooltip content (not the page or tree canvas)

**Given** a passive node that allows up to 5 allocations and the player has 4 unspent points
**When** the player `Shift+click`s that node
**Then** 4 points are allocated in one action (limited by budget, not node max of 5)
**And** the stat sheet updates after all 4 points are applied as a single batch (one rAF compute cycle)

**Given** a passive node already at its maximum allocation (5/5)
**When** the player `Shift+click`s it
**Then** no additional allocation occurs
**And** the node shows its "at max" visual state unchanged

**Given** a node that requires 3 path points to reach and the player has 1 unspent point
**When** the player `Shift+click`s that node
**Then** the allocation is rejected with no partial allocation
**And** no points are spent — the engine validates the full path cost before applying any changes
