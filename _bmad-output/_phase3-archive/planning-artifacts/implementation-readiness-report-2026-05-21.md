---
stepsCompleted: ['step-01-document-discovery']
documentsIncluded:
  prd: '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-19/prd.md'
  prd_addendum: '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-19/addendum.md'
  architecture: '_bmad-output/planning-artifacts/architecture.md'
  epics: '_bmad-output/planning-artifacts/epics.md'
  ux_design: 'MISSING'
  ux_research: '_bmad-output/planning-artifacts/research/domain-pob-lastepoch-ux-ui-patterns-research-2026-05-18.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-21
**Project:** LEBOv2

## Document Inventory

| Document Type | File | Status |
|---|---|---|
| PRD (sharded) | `prds/prd-LEBOv2-2026-05-19/prd.md` + `addendum.md` | ✅ Found |
| Architecture | `architecture.md` | ✅ Found |
| Epics & Stories | `epics.md` | ✅ Found |
| UX Design Specification | — | ⚠️ Missing |
| UX/UI Research | `research/domain-pob-lastepoch-ux-ui-patterns-research-2026-05-18.md` | ✅ Found (research only) |

**Issues:** No dedicated UX design specification document. UX/UI research doc exists as a proxy.

---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review']

---

## PRD Analysis

### Functional Requirements

**Section A — Deterministic Scoring Engine**

- FR-A1: Compute `DamageScore` using LE formula: `Base × (1 + Σ Increased%) × Π More%`
- FR-A2: Compute crit-weighted average damage: `Hit × [(CritMulti × CritChance) + (1 × (1 - CritChance))]` where `CritMulti = 200% + Σ AdditionalCritMulti%`, CritChance capped at 100%
- FR-A3: Compute `SurvivabilityScore` as effective HP: `HP × (1 + WardRatio) × EnduranceReduction` with bonus multiplier for each active defensive layer beyond 2
- FR-A4: Compute `SpeedScore` from movement speed %, attack/cast speed, and AoE coverage modifier
- FR-A5: Combine into `BuildScore = w_dmg × DamageScore + w_surv × SurvivabilityScore + w_speed × SpeedScore` using archetype weights from slider
- FR-A6: Every passive node effect and affix entry includes a `modifierType` field (`"increased"`, `"more"`, or `"flat"`); falls back to `"increased"` if missing
- FR-A7: Defensive floor check before any optimization: (1) all elemental resistances ≥ 75%, (2) crit avoidance ≥ 80%, (3) at least one active sustain mechanism
- FR-A8: Defensive floor failure produces Critical-priority suggestion that outranks all offensive suggestions, naming specific gap and specific fix
- FR-A9: Per-node `Efficiency(node) = ΔBuildScore(path) / EffectivePointCost(path)` using Dijkstra-based shortest-path
- FR-A10: Path ΔBuildScore = sum of score contributions from all nodes on path (not just target)
- FR-A11: Efficiency scan implemented as O(N log N) modified shortest-path traversal
- FR-A12: `"more"` modifier nodes receive 3–5× scoring weight multiplier when Σ Increased% > 200%
- FR-A13: Mastery depth bonus: nodes at depth 7–10 receive 1.2× efficiency multiplier
- FR-A14: Two-phase budget solver: (1) greedy top-20 shortlist, (2) bounded knapsack DP
- FR-A15: Solver outputs ordered allocation list (cheapest-first), maximizing BuildScore within budget
- FR-A16: Dynamic affix weight: `Weight(affix, build) = ΔBuildScore when affix is at T5`; cached per build state, invalidated on class/mastery/skill/role change
- FR-A17: Per-slot ideal 2 prefix + 2 suffix affix ranking, skill-context-aware (weights account for active skill damage types)
- FR-A18: `UpgradeScore` per slot = gap between current and ideal; slots ranked by UpgradeScore
- FR-A19: Affix scorer recognizes delivery types (melee/ranged/spell/minion) and damage element types; non-applicable affixes get zero weight
- FR-A20: Zero-value passive allocations (nodes whose bonuses never apply to active skills) flagged as Medium-priority reallocation suggestions
- FR-A21: Mismatched affix types flagged as High-priority replacement suggestions with correct affix scope identified
- FR-A22: Synergy enabler threshold detection — build-enabling unique items that would change archetype score >30% surfaced as "Game-Changer" suggestions
- FR-A23: Optimization payload to Claude includes full ranked suggestion list with `ΔBuildScore`, `EffectivePointCost`, synergy flags, and numerical context
- FR-A24: Claude produces 1–3 sentence natural-language explanation per suggestion referencing specific delta values
- FR-A25: Claude does not reorder or invent suggestions; role is narrative only
- FR-A26: Node efficiency overlay on passive tree canvas after optimization run: gold = top quartile, silver = second quartile, dim = third/fourth quartile
- FR-A27: Nodes at suggestion cap (no unspent points remaining) show no overlay
- FR-A28: Overlay toggleable; defaults to on when suggestions are present

**Section B — Live Stat Sheet**

- FR-B1: Stat sheet section in right panel with 5 tabs: General, Offense, Defense, Minion, Other
- FR-B2: General tab: character level, passive points spent/available per mastery, per-skill levels and points, class and mastery name
- FR-B3: Offense tab: DamageScore, average hit damage (base and crit-weighted), crit chance %, crit multiplier %, attack/cast speed per active skill, AoE modifier
- FR-B4: Defense tab: effective HP, raw HP, Ward, endurance % and threshold, armor, all resistances (6 types), crit avoidance %, dodge chance %
- FR-B5: Minion tab: minion count, damage multiplier, HP multiplier; hidden for builds with no minion skills
- FR-B6: Other tab: movement speed %, cooldown recovery speed, mana pool/regen, build-specific resource stats
- FR-B7: All values recompute in real time on every state change (node, gear, idol, blessing, condition, level, skill level) — no Recalculate button
- FR-B8: Suggestion preview hover shows before/after delta (gains green, losses red); disappears on hover end

**Section C — Idol Grid Builder**

- FR-C1: Full 5×5 idol grid matching LE default layout (~20 active cells); layout encoded in JSON, not hardcoded; data file must support altar variants as Phase 4 extension
- FR-C2: Player selects idol by size type (1×1, 1×2, 1×3, 2×2) and places in valid grid slot
- FR-C3: Each idol supports up to one prefix and one suffix affix (mandatory where in-game rules require both)
- FR-C4: Affix selection restricted to valid affixes for that idol type and size
- FR-C5: Affix tier selectable T1 to max (consistent with gear slot tier picker)
- FR-C6: Idol stats included in all stat sheet calculations
- FR-C7: Full idol context (position, size, affix IDs, tiers) passed to optimization engine for idol-specific suggestions
- FR-C8: Clear individual idol slots or reset full grid; clearing immediately removes stat contributions
- FR-C9: Idol database bundled with app, follows staleness-check pattern

**Section D — Blessings Panel**

- FR-D1: Blessings section in context panel; up to one blessing per monolith timeline
- FR-D2: Blessings database contains all current LE monolith timeline blessings with stat effects
- FR-D3: Searchable dropdown organized by timeline
- FR-D4: Active blessings contribute to stat sheet as permanent additive bonuses (included in resistances, damage, EHP)
- FR-D5: Blessings database updatable via existing staleness check system

**Section E — Conditions / Buffs Panel**

- FR-E1: Conditions panel accessible from context panel or dedicated tab
- FR-E2: Universal conditions: enemy type, enemy elemental resistances, active charge counts
- FR-E3: Build-specific conditions shown only when relevant passives/skills are active
- FR-E4: Condition values used by scoring engine for context-accurate scores
- FR-E5: Conditions included in Claude optimization payload

**Section F — Visual & UX Polish**

- FR-F1: Canonical item rarity colors: Common (#E8E8E8), Magic (#5B9BD5), Rare (#D4AF37), Unique (#E87722), Set (#4CAF50), Exalted (#9C27B0), Legendary (#C62828)
- FR-F2: Unique/set items display name in rarity color; unique item affixes read-only
- FR-F3: Canonical damage-type colors: Physical (#D0D0D0), Fire (#E85D2A), Cold (#5BC8E8), Lightning (#F0D020), Void (#A050D0), Poison/Necrotic (#50B840), Bleed/Armor Shred (#A03030)
- FR-F4: Passive tree canvas renders dark stone background via PixiJS `TilingSprite` with `bg_stone_tile.webp` (256×256 WebP); first child of `worldContainer`; `background` set transparent; texture loaded once and reused
- FR-F5: Each skill tree canvas renders base stone texture with damage-type tint overlay (fire amber, cold blue, lightning pale yellow, void purple, poison green, physical/unknown = no tint)
- FR-F6: Weaver tree tab: Phase 3 applies void/crystalline purple background (`bg_weaver_tile.webp`) to `WeaverTreePlaceholder` as CSS background; upgrades to PixiJS canvas when community node data available
- FR-F7: `Ctrl+Z`/`Ctrl+Y` (Win) and `Cmd+Z`/`Cmd+Y` (Mac) for undo/redo; visible undo/redo icon buttons in tree controls bar
- FR-F8: Global keyboard shortcuts `C` (context panel), `S` (active skill tree), `P` (passive tree) — active when no text input focused
- FR-F9: Node tooltips that overflow viewport are scrollable in place (not clipping/layout-expanding)
- FR-F10: `Shift+click` on passive node allocates multiple points (up to max or remaining budget)

**Section G — Season 4 Game Data Update**

- FR-G1: Bundled game data updated to Season 4 (Shattered Omens, 2026-03-26): all new/updated passive nodes, new uniques/set items, updated affix tables, new/updated skill trees
- FR-G2: S4 data ingestion ensures every node and affix includes `modifierType` and `scope` fields; sourced from lastepochtools.com DB
- FR-G3: `manifest.json` reflects Season 4; staleness check surfaces update prompt for older data
- FR-G4: S4 idol data (new idol types/affixes) included in idol database
- FR-G5: S4 blessings (new timelines or blessing updates) included in blessings database

**Section H — Gear Optimization Screen**

- FR-H1: Skill role designation UI: Primary Offense (required), Secondary Offense, Defensive, Utility (optional)
- FR-H2: Skill role designations saved with build and persist across sessions; do not affect passive tree optimization
- FR-H3: Gear Optimization screen prompts for skill roles if none set; roles editable at top of screen
- FR-H4: Opening screen captures full build snapshot: skills with roles, passive allocations, all 12 gear slots, idols, blessings, conditions, character level, slider position
- FR-H5: Snapshot passed to scoring engine for per-slot `UpgradeScore` and per-affix `Weight`
- FR-H6: Priority upgrade slot detection (highest UpgradeScore) with visual indicator
- FR-H7: Upgrade priority ranking of all 12 slots showing current score efficiency (e.g., "Weapon: 73% of ideal")
- FR-H8: Correct unique/set items flagged as "correct — keep" regardless of affix scores
- FR-H9: Per-slot ideal affix wishlist: top 2 prefix + top 2 suffix with tier targets
- FR-H10: Each recommended affix includes mechanical reason drawn from scoring context
- FR-H11: Current gear comparison: satisfied/missing/below-tier per recommended affix
- FR-H12: Prefix/suffix distinction per slot matching LE crafting system (2+2)
- FR-H13: Claude gear narrative for full build (prioritized story, not boilerplate)
- FR-H14: Claude references primary offense skill by name throughout narrative
- FR-H15: Claude identifies build-enabling unique upgrade recommendations (Game-Changer)
- FR-H16: Gear recommendations weighted by slider position (Glass Cannon → offensive; Juggernaut → defensive)
- FR-H17: Gear narrative explicitly calls out archetype context and how shifting slider changes priorities

**Total FRs: 62** (FR-A1 through FR-A28: 28; FR-B1 through FR-B8: 8; FR-C1 through FR-C9: 9; FR-D1 through FR-D5: 5; FR-E1 through FR-E5: 5; FR-F1 through FR-F10: 10; FR-G1 through FR-G5: 5; FR-H1 through FR-H17: 17 = 92 total — correction: A=28, B=8, C=9, D=5, E=5, F=10, G=5, H=17 = 87 FRs)

### Non-Functional Requirements

- NFR-1 (Performance): Scoring engine (full evaluation) completes in < 100ms local; Claude API latency (2–5s) is the only user-perceived bottleneck
- NFR-2 (Performance): Stat sheet recalculation on single state change < 16ms (60fps target)
- NFR-3 (Performance): Node efficiency overlay adds ≤ 2ms to frame render time (precomputed assets only)
- NFR-4 (Architecture): All stat values, scoring weights, modifier thresholds, and defensive floor thresholds are data-driven from game data files — no numeric constants in source code
- NFR-5 (Architecture): Scoring engine supports pluggable class-specific scoring modules for Paradox Classes; adding a new class module must not modify the base engine; interface documented
- NFR-6 (Architecture): Idol grid layout and placement rules encoded in bundled idol data, not hardcoded; new idol types via data file update only
- NFR-7 (Architecture): Blessings and conditions databases follow same staleness-check and update pipeline as existing game/item data
- NFR-8 (Quality): Damage scoring formula and crit math have dedicated unit tests against known-correct examples from Maxroll.gg; formula regression fails CI
- NFR-9 (Quality): Defensive floor check has unit tests covering all failure conditions
- NFR-10 (Quality): All new interactive UI components (idol grid, blessings picker, conditions panel, stat sheet tabs) pass axe-core accessibility checks; CI fails on any new violation
- NFR-11 (Platform): Windows 10/11 (.msi) and macOS 12+ (.dmg) only; no new platform targets
- NFR-12 (Offline): All Phase 3 features function fully offline; Claude API call is the only network operation

**Total NFRs: 12**

### Additional Requirements / Constraints

- **Prerequisite constraint:** Season 4 data update (Section G) and `modifierType`/`scope` field annotation (FR-A6, FR-G2) must be complete before any scoring engine development begins
- **Phase boundary:** Phase 3 builds on Phase 2 (full skill trees, item database, gear input, optimization slider, Claude API integration)
- **Out of scope (deferred to Phase 4):** Named item recommendations, idol combinatoric optimization by AI, loot filter export, build sharing, Compare Trees, Full Calcs tab, Paradox Classes, mobile/web
- **Pre-release blocker:** `ANTHROPIC_API_KEY` env var override in `claude_commands.rs` must be removed before public release
- **Expansion readiness:** Architecture must support pluggable scoring modules for Orobyss expansion Paradox Classes

### PRD Completeness Assessment

The PRD is exceptionally detailed and well-structured. Requirements are numbered, algorithmic approaches are specified (with pseudocode in the Addendum), open questions are all resolved, and out-of-scope items are explicitly called out. The six OQs that existed have all been resolved.

**Potential gaps noted:**
1. No explicit FR for how the Gear Optimization screen is navigated to (only mentions "accessible via the app header" in prose)
2. The scoring engine's `scope` field for affix delivery type is referenced in FRs but the exact schema definition lives in OQ-2 resolution notes rather than a dedicated FR
3. No FR covering build state persistence/auto-save behavior for idol and blessings data specifically (though the existing auto-save system is presumably inherited)

---

## Epic Coverage Validation

### Coverage Matrix Summary

All **87 Functional Requirements** are covered in the epics document. The FR Coverage Map in `epics.md` is complete and accurate.

| Epic | FRs Covered | Count |
|---|---|---|
| Epic 1 — Season 4 Data Foundation | FR-G1, FR-G2, FR-G3, FR-G4, FR-G5 | 5 |
| Epic 2 — Scoring Engine & Live Stat Sheet | FR-A1–A8, FR-B1–B7 | 15 |
| Epic 3 — Build Context: Idols, Blessings & Conditions | FR-C1–C9, FR-D1–D5, FR-E1–E5 | 19 |
| Epic 4 — Passive Tree Intelligence & Optimization | FR-A9–A15, FR-A20–A28, FR-B8 | 17 |
| Epic 5 — Gear Optimization Screen | FR-A16–A19, FR-H1–H17 | 21 |
| Epic 6 — Visual Fidelity & UX Polish | FR-F1–F10 | 10 |
| **Total** | | **87 / 87** |

### NFR Story-Level Coverage

| NFR | Requirement | Story Coverage | Status |
|---|---|---|---|
| NFR-1 | <100ms full pipeline | Story 4.1 tests scan <20ms; Story 2.2 tests Stage 1 <2ms. No integration AC for full 100ms budget. | ⚠️ Partial |
| NFR-2 | <16ms stat sheet | rAF debounce in Story 2.5 addresses timing; no explicit end-to-end timing AC | ⚠️ Partial |
| NFR-3 | ≤2ms overlay render | Story 4.4 AC explicitly tests ≤2ms | ✅ Covered |
| NFR-4 | Data-driven values | Architecture specifies; no explicit story AC validates it | ⚠️ Partial |
| NFR-5 | Pluggable class modules | Story 2.1 defines ClassModule trait ✅ | ✅ Covered |
| NFR-6 | Idol grid in data | Story 1.1 covers schema ✅ | ✅ Covered |
| NFR-7 | Staleness pipeline | Stories 1.4 and 3.3 cover ✅ | ✅ Covered |
| NFR-8 | Formula unit tests | Story 2.2 explicitly covers ✅ | ✅ Covered |
| NFR-9 | Defensive floor unit tests | Story 2.3 explicitly covers ✅ | ✅ Covered |
| NFR-10 | axe accessibility | Stories 2.6, 4.5, 5.4, 6.1 ✅ | ✅ Covered |
| NFR-11 | Windows/macOS platforms | No story-level AC explicitly verifies platform builds | ❌ Missing |
| NFR-12 | Fully offline | No story-level AC verifies offline behavior | ❌ Missing |

### Missing Requirements

#### Missing NFR Story Coverage

**NFR-11:** No story verifies that CI builds produce a working `.msi` (Windows) and `.dmg` (macOS) artifact. This is a shipping constraint with no implementation hook.
- Recommendation: Add an acceptance criterion to Epic 1 Story 1.4 or create a dedicated infrastructure story that verifies Tauri build targets produce valid installers.

**NFR-12:** No story verifies that Phase 3 features function with no network connection. The scoring engine, stat sheet, idols, blessings, and conditions are all supposed to work offline.
- Recommendation: Add an AC to the relevant stories (e.g., Story 2.4, 3.4, or a dedicated offline-verification story) that confirms no network calls are made for non-Claude functionality.

### Coverage Statistics

- **Total PRD FRs:** 87
- **FRs covered in epics:** 87
- **FR coverage:** 100%
- **Total NFRs:** 12
- **NFRs with full story-level coverage:** 8
- **NFRs with partial story coverage:** 2 (NFR-1, NFR-2)
- **NFRs with no story-level verification:** 2 (NFR-11, NFR-12)

---

## UX Alignment Assessment

### UX Document Status

**No formal UX Design Specification document exists for Phase 3.** This is an intentional and documented design choice — the `epics.md` explicitly states: *"No formal UX Design Specification document exists for Phase 3. All visual and interaction requirements are captured directly as Functional Requirements in Section F (FR-F1 through FR-F10) of the PRD and are covered above."*

The following related resources exist:
- **UX/UI Research:** `research/domain-pob-lastepoch-ux-ui-patterns-research-2026-05-18.md` — competitive analysis of PoB and lastepochtools.com patterns used to inform PRD requirements
- **PRD Section F** (FR-F1 through FR-F10) — all visual/interaction requirements with exact hex color values, PixiJS implementation notes, and interaction specifications

### Alignment Issues

No structural misalignments found between PRD Section F and the Architecture/Epics. Key visual requirements are traceable:

| UX Requirement | Source | Epic Coverage | Architecture Support |
|---|---|---|---|
| Item rarity color system (7 colors, exact hex) | FR-F1, FR-F2 | Epic 6 Story 6.1 | CSS variables in global stylesheet |
| Damage-type color system (7 types) | FR-F3 | Epic 6 Story 6.1 | CSS variables |
| Stone texture tree backgrounds | FR-F4, FR-F5 | Epic 6 Story 6.2 | PixiJS TilingSprite, addendum spec |
| Weaver tab aesthetic | FR-F6 | Epic 6 Story 6.2 | CSS background-image on placeholder |
| Undo/redo buttons + keyboard shortcuts | FR-F7, FR-F8 | Epic 6 Story 6.3 | Existing buildStore.undoStack |
| Scrollable node tooltips | FR-F9 | Epic 6 Story 6.4 | CSS max-height |
| Shift+click multi-point | FR-F10 | Epic 6 Story 6.4 | PixiJS pointer event modifier check |
| Gear Optimization screen navigation | *(prose in H intro)* | Epic 5 | appStore.currentView — no explicit FR |
| Stat sheet tab navigation | FR-B1–B6 | Epic 2 Story 2.6 | Headless UI Tabs |

### Warnings

1. **⚠️ No FR for Gear Optimization screen navigation entry point.** The PRD prose says it's "accessible via the app header alongside the main build view and settings" — but no FR formally captures this. Epic 5 implements the screen but the navigation to it is implicit. This is minor (it's clearly implied), but a missing FR means no acceptance criterion validates the navigation path.

2. **ℹ️ UX research doc is background only.** The UX research doc (`domain-pob-lastepoch-ux-ui-patterns-research-2026-05-18.md`) is competitive analysis for PoB/lastepochtools UX patterns. It informed PRD decisions but is not a specification. Its findings are already encoded in the PRD FRs. No gap.

3. **ℹ️ Stat sheet tab design is specified via FRs but not mocked up.** All five tabs (General, Offense, Defense, Minion, Other) have their content specified in FR-B2 through FR-B6. Story 2.6 is the implementation target. No wireframe exists, but the FRs are specific enough that implementation can proceed without one.

---

## Epic Quality Review

### Epic Structure Validation

#### Epic 1: Season 4 Game Data Foundation

**User Value:** ⚠️ **Borderline**. The epic is framed as enabling accurate suggestions — indirect user value. No story in Epic 1 produces a visible change for the player. Story 1.1 extends TypeScript types; Story 1.2–1.3 run data ingestion pipelines; Story 1.4 loads new databases.

This is a necessary data infrastructure epic in a brownfield context with a clearly documented critical-path rationale. For a game optimization tool, correct data IS the product — stale or wrong data means wrong suggestions, which breaks the core value proposition. The brownfield/data-gate justification is sound.

**Independence:** ✅ Epic 1 stands completely alone.

**Stories:** Logical forward-only dependency chain: 1.1 (types) → 1.2 (node data) → 1.3 (affix/item data) → 1.4 (new databases). Appropriate.

**Violations found:**
- 🟡 **Story 1.1 AC uses developer-centric language** ("Given a developer imports..." "When an agent reviews..."). BDD ACs should be player/user-facing where possible, or at minimum frame the "Given" as a system state. Minor but worth noting.

---

#### Epic 2: Scoring Engine & Live Stat Sheet

**User Value:** ✅ Clear. "Players can see their build's computed damage...update in real time."

**Independence:** ✅ Can proceed with mock game data (architecture confirms). Real data from Epic 1 makes results correct, but the feature works without it.

**Story Breakdown:**
- Story 2.1 (Foundation): Technical setup story — no direct user value. Appropriate as an invisible prerequisite.
- Story 2.2 (Build Score): Developer-facing ACs (formula test assertions with exact numbers). Dual-purpose: foundational correctness + hidden user value via future stat display.
- Story 2.3 (Defensive Floor Check): Same — formula-first developer ACs.
- Story 2.4 (IPC Wiring): Pure technical story. No user-visible outcome.
- Story 2.5 (TS Integration): Pure technical story — hook and store wiring.
- Story 2.6 (Stat Sheet UI): First story with direct user-visible outcome. ✅

**Violations found:**
- 🟡 **Stories 2.1–2.5 deliver zero user-visible value individually.** Each is a prerequisite layer for Story 2.6. This is acceptable for a complex Rust engine feature, but means the epic has a long build-up before the user sees anything. Risk: if Epic 2 is time-constrained, delivering Story 2.6 requires completing all five prior stories.
- 🟡 **Story 2.2 AC uses "target hardware" without definition.** "Completes in < 2ms on target hardware" — what is target hardware? Windows 11 mid-range gaming PC? No spec. The NFR-1/2 requirements have the same issue. Minor but test-environment sensitive.

---

#### Epic 3: Build Context — Idols, Blessings & Conditions

**User Value:** ✅ Clear. "Players can input their complete in-game build context."

**Independence:** ⚠️ **Soft dependency on Epic 2.** Stories 3.2, 3.3, and 3.4 reference stat sheet updates ("the Defense tab's [value] updates immediately", "the `BuildSnapshot` passed to `compute_stats`"). These require Epic 2's scoring IPC to be live. Functionally, Epic 3's UI components can be built but won't show stat contributions without Epic 2.

This is expected and documented — Epic 3 extends the build context that feeds Epic 2's stat calculation. The dependency direction is correct (3 depends on 2).

**Violations found:**
- 🟠 **Story 3.2 AC ("Idol Affix Selection & Stat Contribution") has a forward dependency concern.** One AC: "When `run_optimization` or `run_gear_scoring` is called, Then the full idol context is present in `BuildSnapshot`." `run_gear_scoring` is Epic 5 work. This AC tests behavior that Epic 3 cannot independently verify — it requires Epic 5 to be implemented before this AC can be validated. This is a **forward-looking AC that can't be tested until Epic 5**.
  - Recommendation: Split this AC into two. The Epic 3 AC should only verify "When `run_optimization` is called, idol context is present." The gear scoring half is an Epic 5 validation responsibility.

- 🟡 **Story 3.1 doesn't specify idol state persistence in `buildStore`.** The AC says "idol state is persisted in `buildStore.activeBuild.contextData`" but `contextData` as a field isn't defined in the existing `BuildState` type. If `contextData` is a new field, it needs a schema extension — that work appears in no story. This is a schema gap.
  - Recommendation: Add an AC to Story 3.1 or Story 1.4 that defines and extends `BuildState` with idol/blessings/conditions persistence fields.

---

#### Epic 4: Passive Tree Intelligence & Optimization

**User Value:** ✅ Strong. The AI optimization + efficiency heatmap is the core differentiating feature.

**Independence:** ✅ Depends on Epics 1–3 (backward dependencies). No forward dependencies.

**Stories:** Logical chain: 4.1 (scan) → 4.2 (synergy) → 4.3 (optimization command + Claude) → 4.4 (overlay) → 4.5 (hover deltas).

**Violations found:**
- 🟠 **Story 4.3 has an unresolved architectural gap as a noted dependency.** The architecture doc flags: *"Minor gap: `run_optimization` relationship to existing `invoke_claude_api` — clarify before Epic A Claude narrative story."* Story 4.3's ACs assume this relationship is clear but don't specify whether `run_optimization` internally calls `invoke_claude_api` or whether `scoring_commands.rs` calls `claude_commands.rs` functions directly. If the agent implementing Story 4.3 makes the wrong assumption, it could break the existing streaming behavior.
  - Recommendation: Add one explicit AC to Story 4.3: "Given `run_optimization` completes the scoring stages, When it triggers the Claude narrative, Then it calls `claude_commands.rs`'s existing streaming function with the assembled payload — the existing `optimization:suggestion-received` event pipeline is unchanged."

- 🟡 **Story 4.1 AC: "rayon parallelism produces identical output to a sequential reference implementation."** This AC requires a sequential reference implementation to exist for comparison. No story creates this reference. A future implementer may skip it. Minor but worth flagging.

---

#### Epic 5: Gear Optimization Screen

**User Value:** ✅ Clear dedicated screen for gear analysis.

**Independence:** ⚠️ **Depends on Epics 1–4** (full stat scoring, affix weights, skill role context). FR-A16–A19 (gear affix scorer) are in this epic, but the underlying `compute_stats` and `run_optimization` must exist from Epic 2 and 4.

**Story breakdown:**
- 5.1 → 5.2 → 5.3 → 5.4 → 5.5: Clean forward chain, all backward dependencies.

**Violations found:**
- 🟠 **Gear slot count inconsistency.** Story 5.4 references "all 12 gear slots" but the gear slot list (helm, chest, gloves, boots, belt, amulet, ring×2, weapon, offhand, relic, and potentially others) is never enumerated in the epics. The PRD says "all 12 slots including weapons and rings" without a canonical list. If the actual game has a different count or naming convention, Story 5.4's "12 gear slots" assertion could fail.
  - Recommendation: Add to Story 1.3 or a shared constant an explicit list of the 12 valid gear slot IDs (sourced from the lastepochtools.com build planner as part of data ingestion), so Story 5.4 has a definitive reference.

- 🟡 **Story 5.2 AC references "a Poison Bladedancer build with Poison Eruption as Primary Offense"** — a very specific example. The scoring rule being tested (delivery type = spell for Poison Eruption) is correct but this AC would pass even if the underlying routing (which skill delivery type maps to Poison Eruption?) is wrong. The AC should also verify the delivery type detection logic.
  - Recommendation: Add one AC: "Given the skills database, When Poison Eruption is loaded, Then its `delivery_type` is `'spell'`." This makes the zero-weight filtering AC actually testable.

---

#### Epic 6: Visual Fidelity & UX Polish

**User Value:** ✅ Clear visual and interaction polish.

**Independence:** ✅ Largely standalone. Tree backgrounds and keyboard shortcuts don't depend on Epics 2–5. Undo/redo uses the existing `buildStore.undoStack`.

**Stories:** All Quick Dev candidates — appropriately sized, localized changes.

**Violations found:**
- 🟡 **Story 6.1 ("Rarity & Damage-Type Colors") AC notes "color is not the only differentiator — icons, labels, or text also distinguish rarity and damage type for color-blind accessibility."** This AC requirement is correct but vague. It doesn't specify what the non-color differentiator is. An implementer might add any icon and satisfy the AC.
  - Recommendation: Specify the non-color differentiator: e.g., for rarity — a rarity tier badge or abbreviation label; for damage type — a dedicated damage icon from the existing icon pipeline.

- 🟡 **Story 6.3 keyboard shortcuts (`C`/`S`/`P`) conflict check.** The ACs correctly handle the text-input guard, but don't verify that these shortcuts don't conflict with any existing browser or Tauri keyboard bindings.

---

### Best Practices Compliance Checklist

| Epic | Delivers User Value | Independent | Stories Sized Appropriately | No Forward Dependencies | Clear ACs | FR Traceability |
|---|---|---|---|---|---|---|
| Epic 1 | ⚠️ Indirect | ✅ | ✅ | ✅ | ⚠️ Dev-centric | ✅ |
| Epic 2 | ✅ | ✅ | ⚠️ Long buildup | ✅ | ⚠️ "target hardware" | ✅ |
| Epic 3 | ✅ | ⚠️ Soft dep on E2 | ✅ | 🟠 Story 3.2 forward AC | ✅ | ✅ |
| Epic 4 | ✅ | ✅ | ✅ | 🟠 Story 4.3 gap | ✅ | ✅ |
| Epic 5 | ✅ | ⚠️ Needs E1-4 | ✅ | ✅ | ⚠️ Gear slot count | ✅ |
| Epic 6 | ✅ | ✅ | ✅ | ✅ | ⚠️ Color a11y vague | ✅ |

### Quality Findings by Severity

#### 🟠 Major Issues (Require Fix Before Implementation)

1. **Story 3.2 Forward AC:** The AC "When `run_gear_scoring` is called, idol context is present" cannot be verified until Epic 5. This AC will be impossible to test during Epic 3 implementation. Split the AC so only `run_optimization` (Epic 4) is tested in Story 3.2.

2. **Story 4.3 Claude Narrative Gap:** The relationship between `run_optimization` and `invoke_claude_api`/`claude_commands.rs` is unspecified in story ACs. An agent could implement this incorrectly and break the existing `optimization:suggestion-received` streaming pipeline. Add an explicit AC specifying that the existing streaming mechanism is preserved.

3. **BuildState persistence extension undefined:** Story 3.1 references `buildStore.activeBuild.contextData` (idols), Story 3.3 implies blessings persistence, Story 3.4 implies conditions persistence. No story defines the schema extension to `BuildState` for these new context fields. This is a gap that will cause blockers mid-implementation.

4. **Gear slot canonical list missing:** 12 gear slots are referenced repeatedly across Epic 5 without a canonical definition. This is a data contract gap that could cause Story 5.2, 5.4 to produce incorrect results if the slot count or naming is wrong.

#### 🟡 Minor Concerns (Address if Time Permits)

5. Developer-centric AC language in Stories 1.1–2.5 (Given "a developer..." / "an agent reviews...") — acceptable for infrastructure stories but inconsistent with BDD style.
6. "Target hardware" performance assertions lack a definition of what hardware is being tested against.
7. Story 4.1 sequential reference implementation for rayon comparison is implied but not created in any story.
8. Story 5.2 delivery-type detection logic not independently verified by AC.
9. Story 6.1 non-color accessibility differentiator is vague — needs specificity.
10. NFR-11 (platform builds) and NFR-12 (offline) have no story-level verification.

---

## Summary and Recommendations

### Overall Readiness Status

**🟡 READY WITH TARGETED FIXES**

The planning artifacts are of high quality. The PRD is exceptionally detailed with all open questions resolved, the architecture is well-reasoned with clear decision rationale, and all 87 FRs are fully covered in epics. The project is implementable now. However, 4 targeted issues should be fixed in the epics before implementation stories begin, to prevent mid-sprint blockers.

### Critical Issues Requiring Immediate Action

#### Fix 1 — Resolve Story 3.2's Forward AC (Epic 3, Before Sprint Begins)

**Problem:** Story 3.2 contains an AC that can only be verified after Epic 5 is implemented: "When `run_gear_scoring` is called, idol context is present in BuildSnapshot." During Epic 3 implementation, `run_gear_scoring` doesn't exist yet — this AC will be impossible to test and will be skipped or deferred, leaving a gap.

**Fix:** Edit Story 3.2 to remove the `run_gear_scoring` AC. Replace with: "When the BuildSnapshot is serialized by `toBuildSnapshot()`, Then the full idol context (slot position, idol size, affix IDs, tiers) is present in the snapshot." This is verifiable in Epic 3. Add the gear-scoring verification to Epic 5 Story 5.3's ACs.

---

#### Fix 2 — Define BuildState Extension for Idols, Blessings, Conditions (Epic 1 or Story 3.1)

**Problem:** Stories 3.1, 3.3, and 3.4 all reference persisting idol, blessings, and conditions data in `buildStore.activeBuild`, but no story defines the schema extension to `BuildState` for these fields. An implementer starting Story 3.1 will immediately need to know how these fields are structured in the TypeScript type and whether they require a `schemaVersion` migration.

**Fix:** Add an AC to Story 1.4 (or as a new preparatory story): "Given `BuildState` in `shared/types/build.ts`, When an agent reviews it, Then it includes `idolGrid: IdolGridState`, `blessings: Record<timelineId, blessingId | null>`, and `activeConditions: string[]` fields — all optional and defaulting to empty state — and `schemaVersion` remains at `2` (no migration needed since fields default to empty)."

---

#### Fix 3 — Specify Claude Narrative Wiring in Story 4.3

**Problem:** Story 4.3's ACs assume the agent knows how `run_optimization` connects to `claude_commands.rs` to produce streamed suggestions. The architecture flags this as an unresolved minor gap. Without an explicit AC, an agent could implement an incompatible integration that bypasses the existing streaming pipeline.

**Fix:** Add one AC to Story 4.3: "Given `run_optimization` completes Stages 1–3 and Stage 5 (synergy detection), When it triggers the Claude narrative, Then it invokes the existing function in `claude_commands.rs` with the assembled optimization payload — the `optimization:suggestion-received` streaming event pipeline is unchanged, and no new IPC event namespace is introduced for the narrative layer."

---

#### Fix 4 — Define Canonical Gear Slot List (Epic 1 Data Ingestion)

**Problem:** Epic 5 references "all 12 gear slots" in multiple stories without a canonical list. The actual Last Epoch gear slots need to be established as a data contract so Story 5.2 (affix scorer per slot) and Story 5.4 (priority ranking) have a definitive reference.

**Fix:** Add to Story 1.3's ACs: "Given the updated item database, When gear slot IDs are queried, Then the following 12 slot IDs are present: `helm`, `chest`, `gloves`, `boots`, `belt`, `amulet`, `ring_1`, `ring_2`, `weapon`, `offhand`, `relic`, `[verify 12th with lastepochtools.com]`." This grounds all Epic 5 slot references in a verified data contract.

---

### Recommended Next Steps

1. **Apply the 4 targeted fixes above** to `epics.md` before beginning any implementation story. These are targeted edits — no restructuring needed. Estimated effort: 30 minutes.

2. **Add NFR-11/NFR-12 verification** — Either add ACs to existing stories (Story 1.4 for offline data loading; Story 2.4 for offline scoring) or acknowledge these as out-of-story-scope platform tests handled by CI. Document the decision.

3. **Start with Epic 1 and Epic 2 in parallel** — Architecture is explicit: Epic 1 (data ingestion) is the critical-path gate but Epic 2 scaffolding can proceed with mock data. Begin Story 1.1 (type extensions) and Story 2.1 (scoring-core crate setup) simultaneously.

4. **Treat Quick Dev candidates efficiently** — 9 stories are flagged as Quick Dev candidates (Stories 3.3, 3.4, 5.1, 6.1, 6.2, 6.3, 6.4, 4.5). These are pure React/CSS stories. Use `/bmad-quick-dev` for these to accelerate delivery without full planning ceremony.

5. **Before Story 4.3, clarify `invoke_claude_api` integration** — Read the current `claude_commands.rs` and `useOptimizationStream.ts` to understand the exact call chain before implementing the `run_optimization` Tauri command. The architecture notes this as an explicit pre-story requirement.

### Final Note

This assessment identified **14 issues** across **5 categories** (FR coverage, NFR coverage, UX alignment, epic quality — major and minor). Of these:
- **4 are Major Issues** requiring targeted fixes to story ACs or schema definitions before implementation begins
- **2 are NFR gaps** (NFR-11/12) with no story-level verification — low risk since these are platform/infrastructure concerns, but worth documenting
- **8 are Minor Concerns** that can be addressed opportunistically during implementation or accepted as-is

The core planning is sound. The PRD is fully traced to epics, the architecture is well-specified with forward-compatibility built in (Modifier Registry, ClassModule trait, pluggable data files), and the epics themselves are logically ordered with correct dependency directionality. The 4 major fixes above are precise, targeted, and will prevent mid-sprint blockers rather than require rework.

**Assessment completed:** 2026-05-21  
**Documents reviewed:** PRD (prd.md + addendum.md), architecture.md, epics.md, project-context.md, project-intent.md  
**FRs traced:** 87/87 (100%)  
**NFRs with story coverage:** 8/12 (67%)



