---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-06-02'
phase: 'Phase 4 — Complete Build Tool'
project_name: 'LEBOv2'
user_name: 'Alec'
date: '2026-06-02'
supersedes: 'Phase 3 epics (frozen at _bmad-output/_phase3-archive/planning-artifacts/epics.md)'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/addendum.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/last-epoch-build-optimizer-UI-Handoff/ (Claude Design prototype)'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - '_bmad-output/project-context.md'
---

# LEBOv2 Phase 4 — Epic Breakdown

## Overview

This document is the complete epic and story breakdown for **LEBOv2 Phase 4 — Complete Build Tool**, decomposing the requirements from the Phase 4 PRD (`prd-LEBOv2-2026-05-29`), its addendum, and the Phase 4 architecture into implementable stories with full acceptance criteria.

Phase 4 transforms LEBO from a capable companion tool into the definitive Last Epoch build tool. It completes the stat engine to full game parity, adds Stat Source Attribution, replaces the partial optimizer with two purpose-built optimization flows (surgical passive-tree optimizer + holistic Complete Build Optimizer), ships the full Claude Design UI/UX, and adds character import from local save files.

**Brownfield.** Every subsystem extends Phase 3 — the `scoring-core` crate, the IPC surface, the four Zustand stores, the Modifier Registry, and the `ClassModule` trait are all extended, not replaced. The Phase 3 architecture stands as the technical foundation; this breakdown covers only the ten Phase 4 subsystems.

**Two critical-path data gates** precede most parallel work (mirroring how Epic G gated Phase 3):
1. **Gate 1 — affix `position` discriminator** (D-P4-2): unblocks the gear pickers and correct suffix-side gear scoring.
2. **Gate 2 — `ModifierType` serde enum migration** (D-P4-1): prerequisite for all `compute/*` stat-engine work.

---

## Requirements Inventory

### Functional Requirements

**§4.1 — Complete Stats Engine**

- **FR-1:** Compute Increased% and More% multipliers for each damage type independently (Physical, Fire, Cold, Lightning, Void, Necrotic, Poison, Bleed, Corruption), with hit and DoT variants where mechanics support it. Damage-type modifiers do not bleed across types.
- **FR-2:** Compute Critical Strike Chance (capped 100%), Critical Strike Multiplier (base 200% + additive), and Stun Chance; crit-weighted average damage uses `Hit × [(CritMulti × CritChance) + (1 × (1 − CritChance))]`.
- **FR-3:** Compute Attack Speed and Cast Speed as separate stats from all sources; compute and display AoE Modifier.
- **FR-4:** Compute Elemental Penetration and Physical Penetration separately; penetration reduces effective enemy resistance in score calc.
- **FR-5:** Compute every defensive layer as an independent value (Health/Regen/Leech, Healing Effectiveness, Ward/Retention/Decay Threshold/per-sec, Armor + Mitigation%, Endurance% + Threshold, Dodge, Parry, Block, Glancing Blow, Crit Avoidance, Reduced Bonus Damage from Crits, all 7 resistances). Resistances at cap show gold; below cap show the gap.
- **FR-6:** Compute EHP as three values — EHP vs Hits, EHP vs DoTs, EHP vs 1-shots — using tunklab-aligned multiplicative-layer methodology. DoTs exclude Dodge/Parry/Block.
- **FR-7:** Compute Stable Ward and Stable HP at equilibrium from Ward Retention, Decay Threshold, Ward/sec, Health Regen, %Current Health Lost/sec, %Missing Health→Ward/sec. [ASSUMPTION: those last two are parseable in Season 4 data]
- **FR-8:** Compute ailment stats (Bleed/Ignite/Poison/Freeze/Shock/Armor Shred Chance) as offense stats; ailment avoidance (Chill/Stun/Bleed immunity) as defense stats.
- **FR-9:** Track Str/Dex/Int/Att totals from all sources on the General tab; implement attribute→secondary-stat conversion only where a parseable ratio exists in game data. Complex per-class conversions deferred to Phase 5. [ASSUMPTION]
- **FR-10:** Compute Minion Count, Damage Multi, HP Multi, Speed; the Minion tab is visible only when ≥1 minion skill is assigned.
- **FR-11:** All stats recompute immediately on any build-state change (node/gear/affix/idol/blessing/condition/level/skill/slider). No manual recalculate button.

**§4.2 — Stat Source Attribution**

- **FR-12:** `scoring-core` attaches a `ModifierSource` (source_type, source_label, value, modifier_type) to every Modifier; `compute_stats` response gains `stat_sources: HashMap<StatKey, Vec<ModifierSource>>` — additive metadata, no separate pass.
- **FR-13:** Hovering any Stat Sheet row shows an adjacent Source Breakdown tooltip listing all sources grouped by category (Passive Nodes / Gear / Idols / Blessings / Skills / Conditions); shows pre-cap total when capped; "Base value only" when no sources; dismiss on mouse-leave.
- **FR-14:** Resistance rows show a delta annotation in warning color when below cap (e.g., `68% (+7 to cap)`); the tooltip repeats the cap gap.

**§4.3 — Passive Tree Optimizer (Refined)**

- **FR-15:** The Passive Tree Optimizer produces `passive_node` suggestions only — never gear, resistance, blessing, idol, or off-tree suggestions; the defensive floor check is excluded from its output.
- **FR-16:** With zero unspent passive points, return the message: "No unspent passive points available. Allocate additional points or use the Complete Build Optimizer for a full reallocation analysis."
- **FR-17:** Render suggested nodes on the PixiJS canvas with unmistakable, hover-free treatment: Gold tier (1.4× ring + pulsing gold glow 1.8s), Silver tier (1.2× + steady silver glow), Dim tier (1.05× + muted blue outline, no anim); dashed gold path lines for prerequisite nodes.
- **FR-18:** Hover/click a suggestion card → corresponding node(s) pulse with intensified highlight; a compact canvas tooltip shows node name, point cost, path cost, per-stat deltas; canvas smoothly pans/zooms to center the node if off-screen.
- **FR-19:** Each suggestion card shows rank #, node name, score delta (e.g., `+4.2`), point cost + path cost (e.g., `2 pts / 4 pts to reach`), and a one-sentence Claude mechanical explanation citing the specific deltas.

**§4.4 — Complete Build Optimizer**

- **FR-20:** Header nav gains "Complete Build Optimizer"; clicking it replaces the builder with a full-screen view; a "Back to Builder" control returns.
- **FR-21:** Scope Selector with one checkbox per section (Passive Tree, Active Skills, Gear, Idols, Blessings — checked by default; Weaver — unchecked), each showing fill status (e.g., "Gear 8/11"); completeness gate per section.
- **FR-22:** On "Run", each checked section's completeness gate is evaluated before analysis; failed gates render inline red alert cards (icon + plain-language reason + "Go to [Section]" button); all alerts shown simultaneously; run blocked until all pass.
- **FR-23:** When Active Skills is checked and <2 slots filled, the gate offers "Suggest skills for my build" — queries the Popular Builds Database by class/mastery + already-assigned skills, shows ranked popular skill sets, user picks one to auto-fill remaining slots without overwriting assigned skills.
- **FR-24:** Optimization Orb animation while running — central gold/void orb, one token per checked section orbiting inward and absorbed, status text cycling 6 canonical phrases; CSS-based, 60fps, must not block IPC results.
- **FR-25:** Unified ranked output grouped by domain section headers (Passive Tree / Gear / Idols / Blessings / Active Skills), ranked by ΔBuildScore within each, suggestion cards in FR-19 format + domain badge; sections expand/collapse; "Focus on Passive Tree" shortcut navigates with passive suggestions pre-highlighted.
- **FR-26:** When Idols is in scope with empty cells, recommend specific idol placements (size, coordinates, affix selection, stat contribution) as cards with a grid placement preview; references real idol DB affix IDs/tiers; placements never conflict with existing idols.

**§4.5 — Gear System: Item Picker & Affix Picker**

- **FR-27:** Item Picker Modal — sidebar filters (Rarity, Item Level range, Required Tags), real-time search, item grid (icon in rarity color + name + base + affix slot count / unique flavor), single-click select / double-click equip, hover tooltip with full stat description.
- **FR-28:** Affix Picker Modal — search by stat name, affixes grouped under Offense/Defense/Utility with name + category tag + full-tier stat range + one-line description (required for every affix), Tier Pip selector showing live value per tier, Apply adds/replaces; affixes filtered to valid entries for the slot type.
- **FR-29:** Each equipped gear slot shows four affix pips below the item name; filled = present, empty = available; clicking a pip opens the Affix Picker for that position.

**§4.6 — Gear Optimization Screen**

- **FR-30:** Three-column layout — left paper-doll (11 slots as drop targets), center searchable gear DB (slot/rarity filter pills + search, draggable cards), right active-slot detail panel with affix list + tier pips + Affix Picker integration.
- **FR-31:** Drag-and-drop equip — dragging over a valid slot highlights gold, invalid red; drop equips; double-click also equips to default slot type. (Native HTML5 DnD per ADR-P4-006.)
- **FR-32:** "Optimize Gear" runs AI gear analysis (payload = current gear, build score, skill roles, archetype weights); slide-in panel shows ranked swaps (current→recommended, ΔBuildScore, Claude reason); recommendations constrained to bundled-DB item IDs; non-upgrade slots omitted.

**§4.7 — UI/UX Revamp (Claude Design System)**

- **FR-33:** Header nav — Builder | Complete Build Optimizer | Gear Optimization | Settings; active item highlighted; `Esc` returns to Builder from any full-screen view.
- **FR-34:** Left panel — Active Build card (class glyph, name, class·mastery), Class/Mastery selectors (restyled), Build Sections navigator with fill counts + gold checkmarks for complete sections, Save Build button (gold when dirty), Import Character button (replaces removed "Paste build code"), Saved Builds list (restyled).
- **FR-35:** Right panel — 3/4-arc SVG Score Gauge with delta, DMG/SURV/SPD pill trio, Optimization Intent header with Juggernaut↔Glass Cannon slider + zone label, Fine Tune Weights (collapsible), Optimize Build button (gold, pulsing when running), AI Suggestions cards, restyled Stat Sheet.
- **FR-36:** Center canvas tab bar — Passive Tree | Weaver | Gear | Skills | Idols | Blessings with badge counts, visual divider between tree tabs and context tabs, keyboard shortcuts 1–6.
- **FR-37:** Blessing editor — two-column card grid, one card per monolith timeline, active blessing highlighted gold with gold border, inline selection (no dropdown).
- **FR-38:** Idol editor — tray + grid layout: 5×4 grid with hover "+", occupied cells show abbreviated name in shape-scaled colored tile (click to remove); right tray of all idol definitions with shape viz + filter + selection; live placement-preview overlay; size-aware valid-cell highlighting; Active Idol Stats summary.
- **FR-39:** Status bar — data version (Season 4 / Shattered Omens + date), unsaved-changes gold dot, LLM provider + model name.

**§4.8 — Data Completeness: Skills, Icons, Popular Builds**

- **FR-40:** All 133 Season 4 skills present in the skills DB with name, class/mastery, tags, icon ref, and specialization tree node data; the Skills tab surfaces all class-appropriate skills.
- **FR-41:** All skill icons resolved via the Rust icon pipeline (`get_icon_cache_path`); missing icons fall back to placeholder glyph. [ASSUMPTION: same pipeline as Phase 2/3]
- **FR-42:** Bundled `popular-builds.json` with ≥3 curated builds per class/mastery (all 15 masteries; ≥45 entries), each with mastery, 5 skill IDs, build name, source URL; updated per game-data patch; queried client-side with no network.
- **FR-43:** Skills tab shows a full skill picker grid (icon + name + tag) drawing from the complete DB; skills assignable to 5 slots; assigned skills show specialization point allocation.

**§4.9 — Multi-Allocate Fix**

- **FR-44:** Shift+click on a passive node fills all remaining points up to `max_points` or remaining budget (whichever is lower) in one action, recorded as a single undo step.
- **FR-45:** Right-click removes all points from an allocated node in one action; prerequisite/orphan check runs first; orphaned children are deallocated in the same step after a confirmation prompt naming them; single undo step.

**§4.10 — Character Import**

- **FR-46:** Left panel "Import Character" button opens a two-tab modal (Offline / Online), dismissible via ✕ or outside click.
- **FR-47:** Offline tab — Rust scans both known save paths (Steam userdata + AppData LocalLow), lists detected `1CHARACTERSLOT_BETA_###` files with character name + class from header; "Browse" fallback; "No save files detected" empty state.
- **FR-48:** Rust parses the selected save file to extract charClass, level, charTree, skillTrees, equipment; populates a new named build after a replace-confirmation; unresolved item/node IDs reported in a post-import summary; prior build preserved. [ASSUMPTION + spike-gated: OQ-8]
- **FR-49:** Online tab (gated) — Account Name + Character Name + Import; Tauri command calls EHG character API; same parse-and-populate flow; inline errors for not-found/private. Built as a wired stub returning "API access pending" until EHG partnership (OQ-7).

**§4.11 — Passive-Tree Data Completeness** *(added 2026-07-02, audit correct-course: no prior FR demanded complete passive-tree data, so the coverage map was structurally blind to 4/5 classes shipping as ~32-node stubs with invented values)*

- **FR-50:** All 5 classes ship complete passive-tree data — base tree + all 3 mastery trees per class — with every node carrying its real name, max points, prerequisites, position, and ALL stat effects with live-game values (lastepochtools-sourced, 1-3b extraction conventions). Node counts match the source tree (automated count check); sampled nodes verified value-exact against the source; no placeholder/stub nodes remain in shipped `classes/*.json`. Alec decision 2026-07-02: author all classes (Option A) rather than descope to Sentinel.

### NonFunctional Requirements

**Primary success metrics (PRD §7):**

- **NFR-1 (SM-1):** Stat Sheet displays all 40+ stats with values within ±2% of the tunklab EHP/Ward calculators for identical inputs. (Validates FR-1–7; enforced by `tests/ehp_reference.rs` CI gate.)
- **NFR-2 (SM-2):** Stat Source Breakdown tooltip appears within 50ms of hover and lists all sources with correct values. (FR-12, FR-13.)
- **NFR-3 (SM-3):** Passive Tree Optimizer returns no gear/resistance/off-tree suggestions when ≥1 unspent point exists. (FR-15.)
- **NFR-4 (SM-4):** Complete Build Optimizer runs for a fully-configured build (6 sections gated) and returns suggestions across ≥3 domains. (FR-20–25.)

**Secondary metrics:**

- **NFR-5 (SM-5):** Item Picker search returns filtered results in <100ms over the full item DB. (FR-27; client-side prebuilt index.)
- **NFR-6 (SM-6):** Shift+click batch allocation completes as a single undo step. (FR-44.)
- **NFR-7 (SM-7):** Popular Builds Database covers all 15 masteries with ≥3 builds each. (FR-42.)

**Counter-metrics (must not regress):**

- **NFR-8 (SM-C1):** Optimization Orb animation never delays result rendering — results appear within 500ms of backend return regardless of animation state.
- **NFR-9 (SM-C2):** Stat Source Attribution must not add >20ms to `compute_stats` round-trip.

**Carried Phase 3 NFRs (still in force):**

- **NFR-10:** `compute_stats` Stage-1 path < 16ms (rAF-debounced); full optimization pipeline < 100ms.
- **NFR-11:** All values data-driven — no numeric stat constants in source; every stat computed via the Modifier Registry.
- **NFR-12:** Pluggable class modules (`ClassModule` trait) preserved; formula regression tests fail CI on drift.
- **NFR-13:** Offline-only except the Claude/OpenRouter API call; no server, no proxy.
- **NFR-14:** All interactive elements keep a 2px solid accent-gold focus ring; `prefers-reduced-motion` gates all animation; new components pass `vitest-axe` (any new violation fails CI).

### Additional Requirements

_Technical requirements from the Phase 4 architecture that shape epics/stories but are not PRD FRs._

**Critical-path data gates (sequence first):**

- **AR-1 (Gate 2, D-P4-1):** Migrate `ModifierType` from `Option<String>` to a serde enum (`Flat | Increased | More | Conversion`, default `Increased`); migrate `scope` and the new affix `position` by the same pattern. Closes four deferred-work items. Prerequisite for all `compute/*` work.
- **AR-2 (Gate 1, D-P4-2):** Add `position: 'prefix' | 'suffix'` to `AffixEntryV2`/`GearAffixV2` (TS + Rust) populated by ingestion (absent → treat as prefix). Critical-path data gate for §4.5/§4.6; must be the first story of the gear epic.

**Architecture decisions affecting structure:**

- **AR-3 (ADR-P4-001):** Split `compute.rs` into `compute/` submodules (offense, penetration, defense, ehp, ward, ailment, attributes, minion) before adding stat coverage; `compute/mod.rs` keeps the single `compute_stats` entry; each module maps 1:1 to a PRD sub-section.
- **AR-4 (D-P4-3):** `compute_stats` gains `ComputeOptions.track_sources` (on only for the display call); `stat_sources: Option<HashMap<..>>` returns `None` on scan/knapsack/gear/complete-opt paths (Pattern P4-2).
- **AR-5 (D-P4-4):** New async command `run_complete_optimization(snapshot, scope)` composing existing stage fns behind a scope mask; new `complete-opt:{suggestion-received,complete,error}` event namespace; new `useCompleteOptStream.ts` hook. No scoring-logic duplication. `run_optimization` output filtered to `passive_node` (Pattern P4-3).
- **AR-6 (D-P4-5):** Extend `appStore.currentView` += `'complete-optimizer'`; extend `CenterTab` += `'weaver'` (keys 1–6, divider after Weaver); no React Router. `SkillTreeCanvasHandle` gains `focusNode(nodeId)` for FR-18 cross-highlight.
- **AR-7 (ADR-P4-005):** `popular-builds.json` is a bundled Tauri resource loaded once into `gameDataStore.popularBuilds` (conditions.json pattern — bundled, never network-stale).
- **AR-8 (ADR-P4-006):** Native HTML5 drag-and-drop for the gear paper-doll (no new frontend dependency).
- **AR-9 (ADR-P4-007 / Pattern P4-8):** Design-token reconciliation is values-only — keep `--color-*` names, update values to the Claude palette, add `--color-bg-sunken`; route all rarity/damage colors through `rarityColors.ts`; no token renames.
- **AR-10 (ADR-P4-010):** New Tauri module `character_import.rs` (offline scan + parse; online stub) — never in `scoring-core` (stays pure, no I/O). Add `CHARACTER_IMPORT_ERROR` to `ErrorType`/`errorNormalizer.ts`.

**Cross-cutting engine rules (Patterns P4-1…P4-8):** stat math reads the registry never the snapshot (P4-1); `track_sources` on for display call only (P4-2); warnings always compute, suggestions are scope-filtered (P4-3); `complete-opt:*` is its own namespace (P4-4); orb decoupled from results (P4-5); recommendations constrained to payload IDs (P4-6); batch allocate/remove is a single undo step (P4-7); token reconciliation values-only (P4-8).

**Story-0 setup tasks:** add `CHARACTER_IMPORT_ERROR` (reuse `SCORING_ERROR`) to `ErrorType`/`errorNormalizer.ts` before any import/scoring IPC story.

**Spikes (resolve before sizing the affected story):**

- **AR-11 (OQ-8):** Reverse-engineer the `1CHARACTERSLOT_BETA_###` save binary against the community save-editor (gaconvt159/last-epoch-save-editor); fallback = shell-invoke the Java tool and parse its JSON. Resolve before the FR-48 story.
- **AR-12 (OQ-1):** Verify Parry is a player-accessible Season 4 stat; if enemy-only, drop from FR-5/`defense.rs`. Resolve during the `defense.rs` story.
- **AR-13 (OQ-6):** Specify the filtered idol-payload subset (build damage types + empty cells only, never full idol DB) before the FR-26 story.

**Deferred-work items elevated into Phase 4 (addressed inside the relevant epic, not as standalone cleanup):**

- **AR-14:** `warningGap === 0` false-warning — fix in `defense.rs`/`ward.rs` as the gap floor (FR-5/FR-6).
- **AR-15:** "All gear affixes classified as prefixes" + `detect_mismatched_affixes` never sees suffixes — fixed by AR-2 + serializer emitting `position`.
- **AR-16:** `GearSlotRanking`/`WishlistAffix` not re-exported from `lib.rs`; stale `MODELS.len() == 4` Rust test — fix during the gear-scoring / any-Rust work.

### UX Design Requirements

_First-class design-system work items from the Claude Design handoff (`last-epoch-build-optimizer-UI-Handoff/`), beyond the per-screen FRs._

- **UX-DR1:** Apply the Claude Design color palette via values-only token update (accent gold `#C9A84C`; bg base/surface/elevated/hover `#0A0A0B`/`#141417`/`#1C1C21`/`#252530`; new `--color-bg-sunken` `#060607`; node-suggested `#7B68EE`). (AR-9)
- **UX-DR2:** Reconcile rarity colors in `rarityColors.ts` (normal `#C6C0B5`, magic `#4A7A9E`, rare `#C9A84C`, set `#5EBD78`, unique `#D4805A`, legendary `#B068E8` — adds the legendary tier).
- **UX-DR3:** Class-specific gold glyph system for the Active Build card and class/mastery selectors (LeftPanel.jsx).
- **UX-DR4:** Score Gauge — 3/4-arc SVG with gradient fill, center build score + delta indicator (RightPanel.jsx).
- **UX-DR5:** Optimization Intent slider with five zone labels in zone colors (Juggernaut / Bulwark / Balanced / Aggressive / Glass Cannon).
- **UX-DR6:** Optimization Orb CSS component (`.orb-overlay/.orb-stage/.orb-ring/.orb-core/.orb-token/.orb-status`), 130px token radius, one token absorbed per 620ms, 6-phrase status sequence, `prefers-reduced-motion` → static progress (addendum D, Pattern P4-5).
- **UX-DR7:** Five-tab Stat Sheet structure (General / Offense / Defense / Minion / Other) per addendum F, with Minion tab conditionally hidden.
- **UX-DR8:** Stat Source Breakdown tooltip layout — grouped categories, per-source contribution, pre-cap total + cap-gap line.
- **UX-DR9:** Reusable TierPips component (carried from Phase 3) reused in both the Affix Picker and the gear detail panel.
- **UX-DR10:** Gear paper-doll visual states — equipped (rarity-color border), empty ("drag to equip"), valid drop (gold), invalid drop (red).
- **UX-DR11:** Idol shape visualizations (proportional rectangle + `W×H` label) in the tray and size-aware valid-cell highlighting in the grid.
- **UX-DR12:** Accessibility baseline for all new/rebuilt components: 2px accent-gold focus rings, aria-live regions (polite on suggestion/loading/import-progress, assertive on critical errors), reduced-motion gating, zero new axe violations (NFR-14).

### FR Coverage Map

| FR | Epic | Coverage |
|----|------|----------|
| FR-1 | Epic 1 | Per-damage-type increased/more multipliers |
| FR-2 | Epic 1 | Crit chance/multi, stun, crit-weighted hit |
| FR-3 | Epic 1 | Attack/cast speed, AoE modifier |
| FR-4 | Epic 1 | Elemental + physical penetration |
| FR-5 | Epic 1 | Full defensive-layer computation |
| FR-6 | Epic 1 | EHP ×3 (Hits/DoTs/1-shots), tunklab-aligned |
| FR-7 | Epic 1 | Stable Ward + Stable HP equilibrium |
| FR-8 | Epic 1 | Ailment chances + avoidance |
| FR-9 | Epic 1 | Attribute totals + parseable conversions |
| FR-10 | Epic 1 (+ Epic 5 Story 5.5) | Minion stats + conditional Minion tab; full correctness (count/HP/speed, skill-tree wiring) completed post–Epic-5 in Story 5.5 |
| FR-11 | Epic 1 | Recompute on any build-state change |
| FR-12 | Epic 1 | ModifierSource tracking + stat_sources field |
| FR-13 | Epic 1 | Source Breakdown tooltip |
| FR-14 | Epic 1 | Resistance cap-gap annotation |
| FR-15 | Epic 3 | Optimizer scope restricted to passive_node |
| FR-16 | Epic 3 | Empty-budget fallback message |
| FR-17 | Epic 3 | Gold/silver/dim node highlight + path lines |
| FR-18 | Epic 3 | Suggestion card → tree cross-highlight + focusNode |
| FR-19 | Epic 3 | Suggestion card content format |
| FR-20 | Epic 6 | Complete Build Optimizer nav + full-screen view |
| FR-21 | Epic 6 | Scope Selector checkboxes + fill status |
| FR-22 | Epic 6 | Completeness gates + inline red alerts |
| FR-23 | Epic 6 | Skill suggestion from Popular Builds (uses Epic 5) |
| FR-24 | Epic 6 | Optimization Orb animation |
| FR-25 | Epic 6 | Unified domain-grouped output |
| FR-26 | Epic 6 | Idol AI recommendations |
| FR-27 | Epic 4 | Item Picker Modal |
| FR-28 | Epic 4 | Affix Picker Modal |
| FR-29 | Epic 4 | Gear slot affix pips |
| FR-30 | Epic 4 | Three-column gear workspace |
| FR-31 | Epic 4 | Drag-and-drop equip |
| FR-32 | Epic 4 | AI gear analysis |
| FR-33 | Epic 2 | Header navigation |
| FR-34 | Epic 2 | Left panel — identity + section navigator |
| FR-35 | Epic 2 | Right panel — gauge, archetype, optimizer chrome |
| FR-36 | Epic 2 | Center canvas six-tab bar |
| FR-37 | Epic 2 | Blessing editor card grid |
| FR-38 | Epic 2 | Idol editor tray + grid |
| FR-39 | Epic 2 | Status bar |
| FR-40 | Epic 5 | Complete 133-skill database |
| FR-41 | Epic 5 | Complete skill icons |
| FR-42 | Epic 5 | Popular Builds Database |
| FR-43 | Epic 5 | Skills tab full picker |
| FR-44 | Epic 3 | Shift+click fill to max |
| FR-45 | Epic 3 | Right-click remove all |
| FR-46 | Epic 7 | Character Import Modal (two tabs) |
| FR-47 | Epic 7 | Offline save-file detection |
| FR-48 | Epic 7 | Offline save-file parsing (spike-gated) |
| FR-49 | Epic 7 | Online import (stub, partner-gated) |
| FR-50 | Epic 5 | Passive-tree data completeness — Stories 5.6–5.9 (per class), gated by Story 5.0 loader fix; must complete before Epic 6 planning |

All 50 FRs mapped. NFR-1–14 and Additional Requirements AR-1–16 / UX-DR1–12 are allocated within the epics below (see each epic's implementation notes).

## Epic List

**Recommended sequence:** 1 → 2 → 3 → 4 → 5 → 6 → 7. Epics are independently shippable; the hard cross-epic dependencies are **Epic 6 depends on Epic 1** (full stat engine for full-picture analysis), **Epic 6's FR-23 depends on Epic 5** (Popular Builds Database), and **Epic 6 + Epic 7 depend on Epic 5's FR-50 passive-tree completion (Stories 5.6–5.9)** — the CBO and popular-build matching span all 15 masteries, and import of non-Sentinel characters must resolve real node IDs. Each epic's first story resolves any data gate it owns. *(2026-07-01 audit note: the "parallelizes behind mocks" pattern is rescinded for Epic 4 — see the Epic 4 callout; data gates must land before dependent UI.)*

### Epic 1: Complete Stat Sheet & Source Attribution
Players see every computed stat in the game across a five-tab stat sheet — all damage types, every defensive layer, EHP ×3, Stable Ward, ailments, attributes, and minions — agreeing within ±2% of tunklab — and can hover any stat to learn exactly which passives, gear, idols, blessings, skills, and conditions contribute to it. This is the core intelligence Phase 4 is built on; it unblocks both optimizers' full-picture analysis.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14
**Owns:** AR-1 (ModifierType enum — Gate 2, first story), AR-3 (`compute/` module split), AR-4 (`track_sources`), AR-12 (Parry spike), AR-14 (`warningGap===0` fix), Story-0 `SCORING_ERROR` reuse. NFR-1, NFR-2, NFR-9, NFR-10, NFR-11, NFR-12. UX-DR7, UX-DR8.
**Implementation notes:** Owns the functional StatSheetPanel five-tab content (addendum F) and StatSourceTooltip; the surrounding right-panel chrome restyle is Epic 2. Stat math reads the Modifier Registry only (Pattern P4-1); `track_sources` on only for the display call (Pattern P4-2). EHP/Ward implement tunklab observable behavior with `tests/ehp_reference.rs` as the CI parity gate.

### Epic 2: UI/UX Revamp — Claude Design System
The entire app is re-skinned and rebuilt to the Claude Design handoff — a dark-stone, gold-typography, class-glyph aesthetic that feels native to Last Epoch. Header navigation, left build-identity panel with section navigator, right panel with score gauge and archetype slider, six-tab center canvas, blessing card grid, idol tray+grid editor, and status bar are all rebuilt. The design-token foundation (first story) re-skins everything from a single stylesheet, so later epics inherit the look automatically.
**FRs covered:** FR-33, FR-34, FR-35, FR-36, FR-37, FR-38, FR-39
**Owns:** AR-9 (token reconciliation — first story), AR-6 partial (`CenterTab += 'weaver'`, keys 1–6, divider). UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR10, UX-DR11, UX-DR12. NFR-14.
**Implementation notes:** Token reconciliation is values-only (Pattern P4-8); all rarity/damage colors route through `rarityColors.ts`. Components are faithfully rebuilt to the design, not wrappers of the prototype JSX. Section-navigator completion indicators reuse the FR-21 gate thresholds. Blessing/idol editors here are the visual rebuilds; their data wiring is unchanged from Phase 3.

### Epic 3: Passive Tree Optimizer & Allocation
Players get surgical, point-budget-aware passive-tree suggestions with unmistakable on-canvas highlighting and one-click cross-navigation from suggestion card to node — and can allocate faster with shift+click fill-to-max and right-click remove-all. The optimizer never surfaces off-tree noise (no resistance/gear warnings), resolving the Phase 3 pain.
**FRs covered:** FR-15, FR-16, FR-17, FR-18, FR-19, FR-44, FR-45
**Owns:** AR-5 partial (`run_optimization` filtered to `passive_node`, Pattern P4-3), AR-6 partial (`SkillTreeCanvasHandle.focusNode()`). Pattern P4-7 (single-undo batch ops). NFR-3, NFR-6.
**Implementation notes:** Shared files — `pixiRenderer.ts` (overlay overhaul + multi-allocate visuals), `useSkillTree.ts`, `buildStore.ts` (`fillNodeToMax`, `removeAllPoints`). Floor-check warnings still compute in `compute_stats`; only suggestion emission is scope-filtered. Both multi-allocate ops push exactly one undo snapshot.

### Epic 4: Gear System & Optimization
Players build and tune gear without leaving the app — a searchable item-database browser (Item Picker Modal), an affix selector grouped Offense/Defense/Utility with tier pips (Affix Picker Modal), affix pips on every slot, and a full three-column Gear Optimization screen with drag-and-drop equip and AI-ranked gear-swap recommendations.
**FRs covered:** FR-27, FR-28, FR-29, FR-30, FR-31, FR-32
**Owns:** AR-2 (affix `position` discriminator — Gate 1, first story), AR-8 (HTML5 DnD), AR-15 (suffix-side scoring fix), AR-16 (lib.rs re-exports + stale test). Pattern P4-6 (payload-ID-constrained recs). NFR-5.
**Implementation notes:** First TWO stories are data gates: 4.0 (affix stat semantics — statKey/modifierType/per-tier values/slot validity re-transformed upstream, `gear_affixes` ingested, scoring parity proven) then 4.1 (`position` discriminator wiring). 4.2–4.6 are gated on both being done — the earlier "proceed against mock-annotated affixes" authorization is **rescinded** (2026-07-01 audit: the corpus has no stat semantics, so mock-built UI would ship on data that scores silent zeros). Item Picker uses a prebuilt client search index (<100ms). Affix Picker reuses the Phase 3 TierPips component (UX-DR9). Gear recommendations rejected if their item ID is absent from the payload subset.

### Epic 5: Skills, Passive Trees & Popular Builds Data
The skills database is completed to all 133 Season 4 skills with icons and specialization-tree data, the Skills tab surfaces a full class-appropriate picker, a bundled Popular Builds Database (≥3 builds × 15 masteries) ships with client-side matching — and the four stub class passive trees (mage, primalist, rogue, acolyte) are authored to full live-game data (FR-50), so the optimizer is real for all 15 masteries, not just Sentinel.
**FRs covered:** FR-40, FR-41, FR-42, FR-43, FR-50
**Owns:** AR-7 (popular-builds.json as bundled resource, `conditions.json` pattern), `popularBuildMatch.ts` (client match). NFR-7, NFR-13. The loader multi-clause fix (Story 5.0 — deferred from the Epic 1 retro) gates ALL data authoring in this epic.
**Implementation notes:** Story 5.0 (loader parses every stat clause, not just the first) lands before any authoring — otherwise authored multi-stat nodes silently mis-parse. Stories 5.6–5.9 (per-class passive trees, ~460 nodes total, 1-3b extraction conventions) must complete before Epic 6 planning. `popularBuilds` loads once into `gameDataStore`; matching (filter by mastery, sort by skill-overlap, top 3) is fully offline. SkillPickerGrid is extended to draw from the complete DB. This epic supplies the data FR-23 (Epic 6) consumes.

### Epic 6: Complete Build Optimizer
Players run a single holistic optimization across passive tree, skills, gear, idols, and blessings together and receive a unified, domain-grouped, ranked upgrade roadmap. A scope selector with per-section completeness gates guides setup, a skill-suggestion shortcut fills gaps from popular builds, and an animated Optimization Orb covers the wait without ever delaying results.
**FRs covered:** FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-26
**Owns:** AR-5 (`run_complete_optimization` + `complete-opt:*` + `useCompleteOptStream`), AR-6 partial (`currentView += 'complete-optimizer'`), AR-13 (idol-payload subset spec). Patterns P4-4, P4-5, P4-6. NFR-4, NFR-8.
**Depends on:** Epic 1 (full stat engine), Epic 5 (FR-23 skill suggestion data).
**Implementation notes:** Reuses existing stage functions behind a scope mask — no scoring-logic duplication. Orb is CSS, decoupled from the IPC result path (results within 500ms of backend return). Idol recs use a filtered idol-payload subset (build damage types + empty cells), validated via `validatePlacement()`.

### Epic 7: Character Import
Players import an existing Last Epoch character into LEBO instead of rebuilding by hand — a two-tab modal where the Offline tab scans local save files, parses the selected character into a new build, and reports any unresolved IDs, while the Online tab ships as a wired stub that lights up when EHG API access is granted.
**FRs covered:** FR-46, FR-47, FR-48, FR-49
**Owns:** AR-10 (`character_import.rs` module + `CHARACTER_IMPORT_ERROR`), AR-11 (OQ-8 save-format spike — before the FR-48 story).
**Implementation notes:** File I/O lives in the Tauri crate, never `scoring-core`. FR-48 is sized only after the OQ-8 spike succeeds (fallback: shell-invoke the community Java tool, parse its JSON). Import creates a new named build, preserving the prior one. FR-49 returns "API access pending" until EHG partnership (OQ-7); UI and command are fully built.

---

## Epic 1: Complete Stat Sheet & Source Attribution

Deliver a five-tab stat sheet computing every stat in Last Epoch — all damage types, every defensive layer, EHP ×3, Stable Ward, ailments, attributes, minions — within ±2% of tunklab, with a hover breakdown revealing every contributing source. This is the engine the rest of Phase 4 builds on.

### Story 1.1: ModifierType enum migration and compute module split

As a developer extending the scoring engine,
I want `ModifierType`/`scope`/`position` migrated to serde enums and `compute.rs` split into the `compute/` submodule layout,
So that full stat parity can be added module-by-module on a type-safe foundation without one unmaintainable file.

**Acceptance Criteria:**

**Given** game data stores `modifierType`/`scope` as lowercase strings
**When** game data is loaded
**Then** they deserialize into `ModifierType { Flat, Increased, More, Conversion }` and the `scope` enum with `rename_all = "lowercase"`
**And** an unknown or absent value defaults to `ModifierType::Increased`, preserving the Phase 3 fallback contract (verified by an existing-data regression test).

**Given** the `compute.rs` monolith
**When** the split is complete
**Then** `compute/mod.rs` exposes the single `compute_stats(snapshot, game_data, options) -> StatSheet` entry and the `compute/` submodule files (`offense`, `penetration`, `defense`, `ehp`, `ward`, `ailment`, `attributes`, `minion`) exist as scaffolds
**And** the `compute_stats` IPC contract and Tauri command signature are unchanged
**And** all Phase 3 formula-regression tests still pass.

**Given** the error-normalization layer
**When** this story completes
**Then** `SCORING_ERROR` remains mapped and a `CHARACTER_IMPORT_ERROR` entry is added to `ErrorType`/`errorNormalizer.ts` as Story-0 setup
**And** branching on raw modifier-type strings no longer exists anywhere in `scoring-core`.

### Story 1.2: Offense stats — damage types, crit, speed, penetration

As a theory-crafting player,
I want the Offense tab to show per-damage-type Increased%/More%, crit stats, attack/cast speed, AoE, and penetration,
So that I can read my offensive profile without summing modifiers by hand.

**Acceptance Criteria:**

**Given** a build with modifiers across multiple damage types
**When** `compute_stats` runs
**Then** Increased% and More% are computed independently per type (Physical, Fire, Cold, Lightning, Void, Necrotic, Poison, Bleed, Corruption) with hit/DoT variants where supported (FR-1)
**And** a modifier tagged for one damage type does not affect another type's score.

**Given** crit and speed modifiers
**When** `compute_stats` runs
**Then** Crit Chance is capped at 100%, Crit Multi is `200% + Σ additive`, Stun Chance is computed, and crit-weighted average damage uses `Hit × [(CritMulti × CritChance) + (1 × (1 − CritChance))]` (FR-2)
**And** Attack Speed and Cast Speed are computed as separate stats and AoE Modifier is computed (FR-3)
**And** Elemental Penetration and Physical Penetration are computed separately and reduce effective enemy resistance in the score calc (FR-4).

**Given** the offense computation
**When** any module computes a stat
**Then** it reads values only via `ModifierRegistry` queries by `StatKey`, never from raw snapshot fields (Pattern P4-1).

### Story 1.3: Defensive layer computation

As a theory-crafting player,
I want every defensive layer computed as an independent value on the Defense tab,
So that I can see my full mitigation picture at a glance.

**Acceptance Criteria:**

**Given** a build with defensive modifiers
**When** `compute_stats` runs
**Then** each layer in the FR-5 table is computed independently: Health/Regen/Leech, Healing Effectiveness, Ward + Retention + Decay Threshold + Ward/sec, Armor + Mitigation%, Endurance% + Threshold, Dodge, Parry, Block, Glancing Blow, Crit Avoidance, Reduced Bonus Damage from Crits, and all seven resistances.

**Given** resistance values
**When** the Defense tab renders
**Then** resistances at cap show the gold at-cap indicator and below-cap show the gap (e.g., "+7% to cap") in the warning color
**And** a value exactly at cap (gap == 0) does NOT render the false warning (AR-14 `warningGap===0` fix lives in the engine gap floor, not the renderer).

**Given** the OQ-1 Parry question
**When** this story is implemented
**Then** the spike verifies whether Parry is a player-accessible Season 4 stat, and if it is enemy-only Parry is dropped from FR-5 and `defense.rs` with the decision recorded.

### Story 1.4: EHP triple and Stable Ward/HP equilibrium

As a theory-crafting player,
I want EHP reported as vs Hits / vs DoTs / vs 1-shots plus Stable Ward and Stable HP,
So that my survivability numbers match the community tunklab calculators I trust.

**Acceptance Criteria:**

**Given** a build with mitigation layers
**When** EHP is computed
**Then** three values are produced — EHP vs Hits, EHP vs DoTs, EHP vs 1-shots — with layers applied multiplicatively, DoTs excluding Dodge/Parry/Block, and 1-shots treating the endurance threshold as a hard floor (FR-6).

**Given** a build using Ward as a buffer
**When** Stable Ward is computed
**Then** it uses Ward Retention, Decay Threshold, Ward/sec, Health Regen, %Current Health Lost/sec, and %Missing Health→Ward/sec, and both Stable Ward and Stable HP at equilibrium are shown on the Defense tab (FR-7).

**Given** the reference fixtures in `scoring-core/tests/ehp_reference.rs`
**When** CI runs
**Then** computed EHP/Ward values agree within ±2% of the recorded tunklab outputs for every reference build, and a drift beyond tolerance fails CI (NFR-1).

### Story 1.5: Ailment, attribute, and minion stats

As a theory-crafting player,
I want ailment chances/avoidance, attribute totals, and minion stats computed,
So that the stat sheet covers ailment and minion builds, not just direct-hit builds.

**Acceptance Criteria:**

**Given** a build with ailment modifiers
**When** `compute_stats` runs
**Then** Bleed/Ignite/Poison/Freeze/Shock/Armor Shred Chance appear as offense stats and Chill/Stun/Bleed immunity appear as defense avoidance stats (FR-8).

> **Dev note (from Story 1.2):** Stun **Chance** (offense) is already computed — `StatKey::StunChance` + `OffenseStats.stun_chance` exist and are summed/clamped — but it has **no data source wired**. The only `STUN`-tagged passive node (`["BLOCK","MELEE","STUN"]`, Shield Bash) carries a *damage* value plus a described "apply Stun" mechanic, not a numeric stun-chance %, so the loader correctly drops it (mapping it would break the golden effect-count of 179). It surfaces `0` until a real source exists. **This story (or Epic 4 gear) should decide where stun-chance data comes from:** a gear/idol affix carries an explicit `stat_key`, so a "+X% Stun Chance" affix flows into `StunChance` with **zero loader changes** — that's the cleanest source. Also reconcile that FR-2 frames stun as an *offense chance* while FR-8 lists Stun on the *defense/immunity* side; both can coexist (stun chance dealt vs. stun avoidance taken).

**Given** attribute sources across passives/gear/idols
**When** `compute_stats` runs
**Then** Str/Dex/Int/Att totals are computed and shown on the General tab, and attribute→secondary-stat conversion is applied only where a parseable ratio exists in game data (complex per-class conversions deferred to Phase 5) (FR-9).

**Given** a build with at least one minion skill assigned
**When** the stat sheet renders
**Then** Minion Count, Damage Multi, HP Multi, and Speed are computed and the Minion tab is visible; with no minion skill the Minion tab is hidden (FR-10).

### Story 1.6: Five-tab Stat Sheet panel with live recompute

As a theory-crafting player,
I want all computed stats laid out across General/Offense/Defense/Minion/Other tabs that update instantly,
So that I always see the current build's full picture without a recalculate button.

**Acceptance Criteria:**

**Given** the computed `StatSheet`
**When** the panel renders
**Then** stats are organized across the five tabs exactly per addendum F (General / Offense / Defense / Minion / Other) (UX-DR7)
**And** the Minion tab is conditionally hidden when no minion skill is assigned.

**Given** any build-state change (node, gear, affix tier, idol, blessing, condition, level, skill, archetype slider)
**When** the change is applied
**Then** all stats recompute immediately via the existing `useStatSheet` rAF-debounced path and the panel reflects new values, with no manual recalculate control present (FR-11)
**And** the Stage-1 display `compute_stats` round-trip stays under 16ms (NFR-10).

### Story 1.7: ModifierSource tracking and opt-in stat_sources

As a developer building attribution,
I want every Modifier to carry a `ModifierSource` surfaced via an opt-in `stat_sources` response field,
So that the UI can show where any stat comes from without a second computation pass or a hot-path cost.

**Acceptance Criteria:**

**Given** `ComputeOptions.track_sources == true`
**When** the display `compute_stats` call runs
**Then** the response includes `stat_sources: Some(HashMap<StatKey, Vec<ModifierSource>>)` where each `ModifierSource` has `source_type`, `source_label`, `value`, and `modifier_type` (FR-12).

**Given** any scan/knapsack/gear/complete-opt internal `compute_stats` call
**When** it runs with `track_sources == false`
**Then** `stat_sources` is `None` and no per-modifier source collection occurs (Pattern P4-2).

**Given** source tracking enabled on the display call
**When** round-trip time is measured
**Then** source tracking adds no more than 20ms to the `compute_stats` round-trip (NFR-9).

### Story 1.8: Stat Source Breakdown tooltip with cap-gap annotation

As a theory-crafting player,
I want to hover any stat row and see every source contributing to it,
So that I can find exactly which passive, gear, or idol to change — especially for resistance tuning.

**Acceptance Criteria:**

**Given** a stat row with sources
**When** I hover it
**Then** an adjacent tooltip lists all `ModifierSource`s grouped by category (Passive Nodes / Gear / Idols / Blessings / Skills / Conditions) with each source's name and contribution (FR-13, UX-DR8)
**And** the tooltip appears within 50ms of hover (NFR-2)
**And** it dismisses on mouse-leave.

**Given** a capped stat (e.g., a resistance at 75%)
**When** the tooltip renders
**Then** it shows the pre-cap total and the cap gap; a stat with no sources shows "Base value only."

**Given** a resistance below cap
**When** the Defense tab row renders
**Then** it shows a delta annotation in the warning color (e.g., `68% (+7 to cap)`) and the tooltip repeats the cap gap (FR-14).

---

## Epic 2: UI/UX Revamp — Claude Design System

Re-skin and rebuild the whole app to the Claude Design handoff. A single values-only token update re-skins everything; then header, panels, tab bar, blessing/idol editors, and status bar are rebuilt to the design.

### Story 2.1: Design-token reconciliation

As a player,
I want the app to adopt the Claude Design palette,
So that LEBO looks like a polished, native Last Epoch companion in one coherent re-skin.

**Acceptance Criteria:**

**Given** the global stylesheet (Tailwind v4 CSS-first, no config file)
**When** the token values are updated
**Then** existing `--color-*` token names are kept and their values updated to the Claude palette (accent gold `#C9A84C`; bg base/surface/elevated/hover `#0A0A0B`/`#141417`/`#1C1C21`/`#252530`; node-suggested `#7B68EE`) and `--color-bg-sunken` `#060607` is added (AR-9, UX-DR1)
**And** no token is renamed and no unprefixed `--*` token from the prototype is introduced (Pattern P4-8).

**Given** `rarityColors.ts`
**When** rarity colors are reconciled
**Then** `RARITY_COLORS` reflects normal `#C6C0B5`, magic `#4A7A9E`, rare `#C9A84C`, set `#5EBD78`, unique `#D4805A`, legendary `#B068E8` (adding the legendary tier) and all rarity/damage colors continue to route through this utility — never hardcoded inline (UX-DR2).

### Story 2.2: Header navigation

As a player,
I want top-level header navigation between Builder, Complete Build Optimizer, Gear Optimization, and Settings,
So that I can move between the app's major surfaces.

**Acceptance Criteria:**

**Given** the app header
**When** it renders
**Then** it shows nav items Builder | Complete Build Optimizer | Gear Optimization | Settings with the active item highlighted/underlined (FR-33).

**Given** any full-screen view
**When** I press `Esc`
**Then** the app returns to the Builder view
**And** navigation is driven by `appStore.currentView` with no React Router introduced.

### Story 2.3: Left panel — build identity and section navigator

As a player,
I want the left panel to show my build identity and a section navigator with fill counts,
So that I can see my build's progress and jump between sections.

**Acceptance Criteria:**

**Given** an active build
**When** the left panel renders
**Then** it shows the Active Build card (class glyph, build name, class·mastery subtitle), restyled Class/Mastery selectors, a Build Sections navigator listing each center tab with its fill count (e.g., "Gear — 8/11"), a Save Build button (gold when there are unsaved changes), an Import Character button, and the restyled Saved Builds list (FR-34, UX-DR3).

**Given** a section meeting its FR-21 gate threshold
**When** the navigator renders
**Then** that section shows a gold checkmark
**And** the former "Paste build code" input is removed (Last Epoch has no build code system).

**Given** the Import Character button
**When** it is present
**Then** it is the control that opens the Character Import modal (modal behavior delivered in Epic 7; the button and its open-intent exist here).

### Story 2.4: Right panel — score gauge, archetype, optimizer chrome

As a player,
I want the right panel rebuilt with the score gauge, archetype slider, and optimizer controls,
So that my build score and optimization intent are clear and on-brand.

**Acceptance Criteria:**

**Given** the right panel
**When** it renders
**Then** it shows a 3/4-arc SVG Score Gauge with gradient fill, center build score, and delta indicator (UX-DR4); the DMG/SURV/SPD pill trio; an Optimization Intent header with the Juggernaut↔Glass Cannon slider and a zone label in zone color (Juggernaut / Bulwark / Balanced / Aggressive / Glass Cannon, UX-DR5); a collapsible Fine Tune Weights section; the Optimize Build button (gold, pulsing while running); the AI Suggestions card area; and the restyled Stat Sheet (FR-35).

**Given** the Stat Sheet within the right panel
**When** rendered
**Then** it hosts the five-tab functional content delivered in Epic 1 (this story restyles the surrounding chrome, not the stat content).

### Story 2.5: Center canvas six-tab bar with Weaver

As a player,
I want a six-tab center canvas bar with a divider and keyboard shortcuts,
So that I can switch between tree and context editors quickly.

**Acceptance Criteria:**

**Given** the center canvas
**When** the tab bar renders
**Then** it shows Passive Tree | Weaver | Gear | Skills | Idols | Blessings with badge counts and a visual divider separating the tree tabs (Passive, Weaver) from the context tabs (Gear, Skills, Idols, Blessings) (FR-36).

**Given** the keyboard
**When** I press keys 1–6
**Then** the corresponding tab activates
**And** `CenterTab` is extended to include `'weaver'` and `safeTabIndex` guards out-of-range indices (AR-6 partial)
**And** the always-mounted `SkillTreeView` is preserved (shown/hidden, never unmounted) to keep the WebGL context.

### Story 2.6: Blessing editor card grid

As a player,
I want blessings shown as a two-column card grid per timeline,
So that I can pick blessings inline without dropdowns.

**Acceptance Criteria:**

**Given** the Blessing tab
**When** it renders
**Then** it shows a two-column card grid with one card per monolith timeline, the timeline name as the card header, and inline blessing selection (no dropdown) (FR-37)
**And** the active blessing is highlighted in gold with a gold border
**And** blessing data wiring is unchanged from Phase 3 (visual rebuild only).

### Story 2.7: Idol editor tray and grid

As a player,
I want the idol editor rebuilt as a tray plus grid with live placement preview,
So that placing idols is visual and mistake-proof.

**Acceptance Criteria:**

**Given** the Idol tab
**When** it renders
**Then** it shows the 5×4 idol grid on the left and a scrollable Idol Tray on the right listing all idol definitions with shape visualizations (proportional rectangle + `W×H` label), names, stat descriptions, and a filter input (FR-38, UX-DR11)
**And** an Active Idol Stats summary is shown below the grid.

**Given** an idol selected in the tray
**When** I hover grid cells
**Then** a live placement-preview overlay shows which cells would be occupied, only cells where the idol fits (given shape + current occupancy) are highlighted as valid, and overflow/collision cells render invalid and are not clickable
**And** clicking outside the grid deselects the placing idol
**And** clicking an occupied cell removes that idol (placement validation routes through the existing `validatePlacement()`).

### Story 2.8: Status bar

As a player,
I want a footer status bar showing data version, unsaved state, and LLM provider,
So that I always know my data freshness and which model is active.

**Acceptance Criteria:**

**Given** the footer
**When** it renders
**Then** it shows the data version (Season 4 / Shattered Omens + date), an unsaved-changes gold dot when the build is dirty, and the LLM provider + model name (FR-39).

**Given** all components rebuilt in this epic
**When** they render
**Then** each keeps a 2px solid accent-gold focus ring on interactive elements, gates animation behind `prefers-reduced-motion`, applies the appropriate aria-live regions, and introduces zero new `vitest-axe` violations (UX-DR12, NFR-14).

---

## Epic 3: Passive Tree Optimizer & Allocation

Refine the passive-tree optimizer to be strictly on-tree, give suggested nodes unmistakable on-canvas treatment with card↔node cross-navigation, and speed up tree editing with shift+click fill and right-click remove-all.

### Story 3.1: Scope-restricted optimizer with empty-budget fallback

As a player optimizing my tree,
I want the Optimize Build button to return only passive-node suggestions,
So that I get actionable tree advice instead of off-tree resistance/gear warnings.

**Acceptance Criteria:**

**Given** a build with at least one unspent passive point
**When** I run the Passive Tree Optimizer
**Then** every returned suggestion is of kind `passive_node` and none references gear, resistances, blessings, idols, or any off-tree stat (FR-15, NFR-3).

**Given** the defensive floor check
**When** the optimizer runs
**Then** the floor check still computes and populates `StatSheet.warnings`, but its results are excluded from `run_optimization` output (Pattern P4-3); the command filters its output to `suggestion.kind == PassiveNode`.

**Given** a build with zero unspent passive points
**When** I run the optimizer
**Then** it returns the message "No unspent passive points available. Allocate additional points or use the Complete Build Optimizer for a full reallocation analysis." (FR-16).

### Story 3.2: Enhanced suggested-node visualization on the canvas

As a player,
I want suggested nodes rendered with tiered, hover-free highlighting,
So that I can spot the best nodes on the tree at a glance.

**Acceptance Criteria:**

**Given** ranked suggestions
**When** the PixiJS canvas renders them
**Then** Gold-tier nodes scale to 1.4× with a pulsing gold glow (1.8s cycle), Silver-tier scale to 1.2× with a steady silver glow, and Dim-tier scale to 1.05× with a muted blue outline and no animation (FR-17).

**Given** a suggested node whose prerequisites are not yet allocated
**When** it renders
**Then** a dashed gold path line connects it to the nearest allocated node
**And** a suggested node is visually distinct from a merely available (allocatable) node without hovering.

**Given** `prefers-reduced-motion` is set
**When** suggestions render
**Then** the pulsing glow is suppressed in favor of a static treatment (`drawSuggested` skips the glow ring).

### Story 3.3: Suggestion card content and tree cross-highlight

As a player,
I want each suggestion card to be informative and to highlight its node on the tree when I interact with it,
So that I never have to hunt for the suggested node.

**Acceptance Criteria:**

**Given** a suggestion
**When** its card renders in the right panel
**Then** it shows rank number, node name, score delta (e.g., `+4.2`), point cost + path cost (e.g., `2 pts / 4 pts to reach`), and a one-sentence Claude mechanical explanation citing the specific deltas (FR-19).

**Given** I hover or click a suggestion card
**When** the interaction fires
**Then** the corresponding node(s) pulse with an intensified highlight and a compact canvas tooltip shows node name, point cost, path cost, and per-stat deltas (FR-18).

**Given** the suggested node is off-screen (tree panned/zoomed away)
**When** I interact with its card
**Then** the canvas smoothly animates to center it via `SkillTreeCanvasHandle.focusNode(nodeId)` (AR-6), keeping the canvas props/ref-driven with no store access inside it.

### Story 3.4: Shift+click fill node to max

As a player,
I want shift+click to fill a node to its max in one action,
So that I can allocate multi-point nodes without repeated clicking.

**Acceptance Criteria:**

**Given** a partially-allocated or available node
**When** I shift+click it
**Then** all remaining points up to the node's `max_points` or the remaining budget (whichever is lower) are allocated in a single action (FR-44).

**Given** 2 unspent points and a node with 3 points remaining
**When** I shift+click
**Then** exactly 2 points are allocated (budget-limited)
**And** the batch is recorded as a single undo step via `buildStore.fillNodeToMax`, never a loop of `applyNodeChange` calls (Pattern P4-7, NFR-6).

### Story 3.5: Right-click remove all points with orphan cascade

As a player,
I want right-click to remove all points from a node in one action,
So that I can quickly undo an allocation without clicking down each point.

**Acceptance Criteria:**

**Given** an allocated node with no dependent allocated children
**When** I right-click it
**Then** all its points are removed in one action as a single undo step via `buildStore.removeAllPoints` (FR-45, Pattern P4-7).

**Given** an allocated node whose removal would orphan allocated child nodes
**When** I right-click it
**Then** a confirmation prompt names the orphaned nodes ("Removing this node will also deallocate: [Node A], [Node B]. Continue?")
**And** on confirm, the node and its orphaned children are deallocated together in one single undo step.

---

## Epic 4: Gear System & Optimization

Give players a full in-app gear workflow: an item-database browser, a grouped affix picker with tier pips, per-slot affix pips, and a three-column Gear Optimization screen with drag-drop equip and AI-ranked swaps. Two data gates come first: Story 4.0 (affix stat semantics) then Story 4.1 (`position` discriminator wiring).

> **⚠️ Epic 3 retrospective corrections (2026-07-01) — read before running `create-story` on any 4.x:**
> A code-grounded readiness pass (8-agent ultracode analysis) found the plan understates existing work. Correct these first:
> 1. **The `position` SOURCE data already exists and is already loaded.** `src-tauri/resources/items/affixes.json` (4,176 affixes: 3,616 `prefix` / 560 `suffix`) is already read into `ItemDatabase`, and Rust already models it (`GearAffixData.affix_class` is an `AffixPosition` enum — *not* the "unvalidated String" an old deferred-work note claims). **Story 4.1 is a wiring/ingestion job** (populate the empty `GameData.gear_affixes` from the existing source in `game_data_loader.rs`, add a `position` field to `AffixEntryV2`, and route prefix-vs-suffix in `buildSnapshotSerializer.ts` instead of dumping all affixes to prefixes) — **not data authoring.** Re-cut its estimate accordingly.
> 2. **The gear stack is already wired end-to-end.** The Rust scorer (`gear.rs` / `run_gear_scoring`), the Claude **and** OpenRouter gear-narrative backends (`gear:*` events), and a Phase-3 frontend (`gear-optimization/*`, `item-database/*`, `useGearStream`) all exist. **Epic 4 is mostly reconcile/extend, not greenfield** — the genuine exception is Story 4.5's native HTML5 drag-drop, which has **zero prior art** in `src/` (only PixiJS canvas panning) and must be built under the AR-8 no-new-dependency rule.
> 3. **`GearAffixV2` does not exist** in the codebase (only `AffixEntryV2` + `GearItemV2`). The reference in Story 4.1 below is corrected.
> 4. **Displayed-but-not-sourced trap (project memory):** two parallel affix paths exist — real `ItemDatabase.affixes` (populated) vs `GameData.gear_affixes` (empty). Wire the UI to the real path while the scorer stays empty and it will *look* done while scoring silent zeros. **Ingest + verify end-to-end gear scoring against real data BEFORE building any 4.x UI on it.**
> 5. Housekeeping already assigned to 4.1/AR-16: fix the stale `MODELS.len() == 4` Rust test (actual 7, currently failing) and add the missing `GearSlotRanking`/`WishlistAffix` re-exports to scoring-core `lib.rs` (only `GearAnalysis` is re-exported today).

> **⚠️ 2026-07-01 full-project audit — partial correction to point 1 above (read before `create-story` on 4.0/4.1):**
> The "wiring job" re-cut is right about `position` (the prefix/suffix source data exists and loads) but wrong by omission about everything else the scorer needs: **the affix corpus has no stat semantics.** Verified at HEAD: 0 of 4,176 affixes carry a `statKey`, all 4,176 are blanket `modifierType:"increased"`, ~86% are machine-named `unnamed-*`, `itemSlots` is empty on 4,171, all 2,338 unique-item affix references resolve to nothing, and 897/897 base-item implicits are empty — because `docs/data-transform/generate_item_db.py` discards the source stat text (~lines 213–215). Wiring `position` alone makes the Affix Picker group correctly while every equipped affix still contributes **zero** to `compute_stats` — point 4's displayed-but-not-sourced trap at corpus scale. **Story 4.0 below is the real data gate.** 4.2–4.6 are gated on 4.0 + 4.1 done; the "mock-annotated affixes" clause formerly in 4.1's ACs is rescinded.

### Story 4.0: Affix stat-semantics data gate (upstream re-transform)

As a developer enabling trustworthy gear scoring,
I want every shipped affix and item to carry real stat semantics — stat key, modifier type, per-tier values, human name, and slot validity,
So that equipped gear contributes true values to `compute_stats` and every 4.x feature is built on data that scores correctly.

**Acceptance Criteria:**

**Given** the item-data pipeline (`docs/data-transform/generate_item_db.py`)
**When** it is extended and re-run against its PoB4LE source
**Then** it retains the per-affix stat text it currently discards and emits, for every affix: a `statKey` resolvable to an engine `StatKey`, a correct `modifierType` (not blanket `"increased"`), per-tier value ranges, a human-readable name, and an `itemSlots` validity list — and the transform is a committed, re-runnable script (the per-patch refresh path), not a one-off edit.

**Given** the regenerated dataset
**When** an automated coverage check runs (a committed script or test, not eyeballing)
**Then** it enforces these exit gates, each reported with actual counts: ≥95% of affixes have a resolved `statKey` (the unmapped remainder explicitly listed in the data manifest); no `unnamed-*` machine names remain in picker-visible data; 100% of affix references from shipped uniques resolve; base-item implicits are populated or their deferral recorded per item class; `itemSlots` is non-empty for every picker-visible affix.

**Given** the corrected dataset
**When** `game_data_loader.rs` ingests it
**Then** `GameData.gear_affixes` is populated from it (today an empty `HashMap`, so gear contributes nothing to any score) and `gear.rs` gains a slot-validity model so per-slot wishlists differ by slot (today all 12 slots produce identical wishlists).

**Given** a build with a known item and known affix tiers equipped
**When** `compute_stats` runs
**Then** element+value tests assert the exact expected stat contributions end-to-end (Source Audit discipline: this story exists to make the gear stat source REAL — the parity test is the proof, per project memory `source-audit-at-create-story`).

### Story 4.1: Affix prefix/suffix discriminator (data gate)

As a developer enabling the gear features,
I want a `position: 'prefix' | 'suffix'` discriminator on affixes end-to-end,
So that the Affix Picker can group correctly and gear scoring sees suffixes.

**Acceptance Criteria:**

**Given** the affix schema
**When** the discriminator is added
**Then** `AffixEntryV2` (TypeScript; the earlier-draft `GearAffixV2` type does not exist — use `AffixEntryV2`/`GearItemV2`) and the Rust affix type gain a `position` field populated by the data-ingestion pipeline, with an absent value treated as `prefix` (back-compatible) (AR-2).

**Given** `buildSnapshotSerializer.ts`
**When** it serializes gear
**Then** it emits each affix's `position`, so `detect_mismatched_affixes` and `gear.rs` see suffixes (resolving the "all affixes classified as prefixes" deferred-work item, AR-15).

**Given** the Rust lib surface
**When** this story completes
**Then** `GearSlotRanking` and `WishlistAffix` are re-exported from `lib.rs` and the stale `MODELS.len() == 4` test is corrected (AR-16)
**And** downstream gear engine and UI work (4.2–4.6) does NOT begin until Stories 4.0 and 4.1 are both done — the former "proceed against mock-annotated affixes" clause is rescinded (2026-07-01 audit: the corpus has no stat semantics, so mock-built features would look done while scoring silent zeros).

### Story 4.2: Item Picker Modal

As a player building gear,
I want a searchable, filterable item-database modal,
So that I can find and equip any base item without leaving the app.

**Acceptance Criteria:**

**Given** an empty gear slot or "Swap item" on an equipped slot
**When** I click it
**Then** the Item Picker Modal opens with sidebar filters (Rarity, Item Level range slider, Required Tags), a real-time search bar, and an item grid showing icon (slot glyph in rarity color), name, base type, and affix slot count or unique flavor text (FR-27).

**Given** the full item database
**When** I type a search query
**Then** filtered results return in under 100ms via a prebuilt client search index (NFR-5).

**Given** an item in the grid
**When** I single-click it
**Then** it is selected and equippable via an "Equip Item" button; double-click equips immediately with a default affix configuration that can be modified
**And** hovering an item card shows a tooltip with its full stat description.

### Story 4.3: Affix Picker Modal

As a player tuning gear,
I want a grouped affix picker with full names, ranges, descriptions, and tier pips,
So that I can add the exact affix and tier I want.

**Acceptance Criteria:**

**Given** "Add Affix" or an existing affix row
**When** I click it
**Then** the Affix Picker Modal opens with a stat-name search and affixes grouped under Offense / Defense / Utility, each row showing name, category tag (e.g., "Defense · max T7"), full-tier stat range, and a one-line description present for every affix entry (FR-28).

**Given** an affix selected
**When** the tier selector appears
**Then** a Tier Pip row (T1–Tmax) is shown using the Phase 3 TierPips component, clicking a pip sets the tier, the live value for the selected tier is displayed (e.g., "T5 → 48–64%"), and Apply adds or replaces the affix at that tier (UX-DR9).

**Given** a specific gear slot
**When** the picker lists affixes
**Then** only affixes valid for that slot type are shown (weapon affixes do not appear for boots).

### Story 4.4: Gear slot affix pips

As a player,
I want each equipped slot to show affix pips I can click,
So that I can see and edit affixes directly from the paper-doll.

**Acceptance Criteria:**

**Given** an equipped gear slot
**When** it renders
**Then** four affix pips appear below the item name, filled pips indicating present affixes and empty pips indicating available positions (FR-29).

**Given** an affix pip
**When** I click it
**Then** the Affix Picker opens for that specific affix position.

### Story 4.5: Three-column Gear Optimization workspace with drag-drop

As a player,
I want a dedicated three-column gear screen with drag-and-drop equip,
So that I can manage my full loadout in one workspace.

**Acceptance Criteria:**

**Given** the Gear Optimization view
**When** it renders
**Then** it shows a left paper-doll with all 11 slots as drop targets (equipped item icon + name + rarity-color border, or "drag to equip" empty state), a center searchable gear database with slot/rarity filter pills and draggable item cards, and a right detail panel for the active slot with its affix list, tier pips, and Affix Picker integration (FR-30, UX-DR10).

**Given** a draggable item card
**When** I drag it over a slot
**Then** a valid (correct-type) slot highlights gold and an invalid slot highlights red; dropping on a valid slot equips the item; double-clicking a card equips it to its default slot type (FR-31)
**And** drag-and-drop uses native HTML5 DnD with no new frontend dependency (AR-8).

**Given** the drag-drop workspace is implemented
**When** the story is verified
**Then** a committed, repeatable Playwright (or equivalent real-browser) harness exercises drag-to-equip end-to-end — jsdom cannot simulate native HTML5 DnD, and this is the standing retro action (Epic 1 + Epic 3, third ask) for a visual-verification harness; the harness lands with this story at the latest.

### Story 4.6: AI gear analysis

As a player,
I want AI-ranked gear-swap recommendations,
So that I know which gear upgrades most improve my build.

**Acceptance Criteria:**

**Given** a build with gear and skill roles
**When** I click "Optimize Gear"
**Then** the analysis payload includes current gear, build score, skill-role designations, and archetype weights, and results appear in a slide-in panel ranked by slot showing current item → recommended item, ΔBuildScore, and Claude's mechanical reason (FR-32).

**Given** a returned recommendation
**When** the frontend processes it
**Then** any recommendation whose item ID is absent from the payload's catalog subset is rejected before display, and slots with no meaningful upgrade are omitted rather than shown as placeholders (Pattern P4-6).

---

## Epic 5: Skills, Passive Trees & Popular Builds Data

Complete the skills database to all 133 Season 4 skills with icons and specialization data, surface a full skill picker, ship a bundled Popular Builds Database with client-side matching that powers popular-build awareness and the Complete Build Optimizer's skill suggestion — and author the four stub class passive trees to full live-game data (FR-50).

> **⚠️ Sequencing (2026-07-02 audit correct-course, Alec decision Option A — author all trees):**
> 1. **Story 5.0 (loader multi-clause fix) gates ALL data authoring in this epic.** Today `game_data_loader.rs` parses only the first stat clause per effect and a golden test pins that wrong behavior — authoring multi-stat nodes before the fix means silently dropped stats.
> 2. **Stories 5.6–5.9 (per-class passive trees, ~460 hand-authored nodes) must be DONE before Epic 6 planning.** The CBO and FR-42 popular builds span all 15 masteries, and Epic 7 import of non-Sentinel characters must resolve real node IDs. Until they land, 4 of 5 classes optimize against Phase-1 stubs with invented values.
> 3. These are data-curation stories — no code velocity applies. Budget them as real calendar time (audit estimate: 1–2 weeks total for 5.6–5.9), and follow the 1-3b extraction conventions plus the `source-audit-at-create-story` discipline.

### Story 5.0: Game-data loader multi-clause stat parsing (data-authoring gate)

As a developer authoring real game data,
I want the loader to parse every stat clause on a node or affix effect,
So that authored multi-stat nodes contribute all of their stats instead of only the first.

**Acceptance Criteria:**

**Given** a node effect whose text carries multiple stat clauses
**When** game data loads
**Then** every clause becomes a modifier in the registry — not only the first (the single-stat-per-effect limitation deferred from the Epic 1 retro, `game_data_loader.rs` effect parsing).

**Given** the golden test that currently pins single-clause behavior
**When** this story completes
**Then** it is corrected to assert multi-clause output, and any frozen parity gate whose value changes from newly-parsed clauses is re-baselined deliberately, each delta explained in the story record (not blanket-accepted).

**Given** a fixture node with three stat clauses
**When** loaded
**Then** element+value tests assert exactly the three expected modifiers (stat key, modifier type, value each).

**Given** a clause the parser cannot resolve
**When** loading completes
**Then** it fails loudly — logged and counted in the data manifest — never silently dropped.

### Story 5.1: Complete 133-skill database

As a player,
I want every Season 4 skill available for my mastery,
So that I can build any character without missing skills.

**Acceptance Criteria:**

**Given** the skills database
**When** it is completed
**Then** all 133 Season 4 skills are present, each with skill name, class/mastery affiliation, tags (damage type, delivery type), an icon reference, and specialization tree node data (FR-40).

**Given** an active mastery
**When** the skill data is queried
**Then** all class-appropriate skills for that mastery are available to the picker.

### Story 5.2: Complete skill icons

As a player,
I want every skill to show its icon,
So that the skill picker is visually scannable.

**Acceptance Criteria:**

**Given** a skill with an icon asset
**When** the picker renders it
**Then** the icon is resolved via the Rust icon pipeline (`get_icon_cache_path`) (FR-41).

**Given** a skill whose icon is not cached
**When** the picker renders it
**Then** it falls back to the placeholder glyph without error.

### Story 5.3: Skills tab full picker

As a player,
I want the Skills tab to show a complete picker and my specialization allocations,
So that I can assign and inspect my five skills.

**Acceptance Criteria:**

**Given** the Skills tab
**When** it renders
**Then** it shows a full skill picker grid (icon + name + tag) drawing from the complete 133-skill database, with skills assignable to the 5 skill slots (FR-43).

**Given** an assigned skill
**When** it renders in a slot
**Then** its specialization point allocation is shown
**And** `SkillPickerGrid` continues to exclude skills already assigned to other slots.

### Story 5.4: Popular Builds Database with client-side matching

As a player,
I want a bundled database of popular builds with offline matching,
So that I can see and reuse proven skill combinations for my mastery.

**Acceptance Criteria:**

**Given** the bundled `popular-builds.json`
**When** the app loads
**Then** it contains ≥3 curated builds for each of the 15 masteries (≥45 entries), each with mastery, five skill IDs, a build name, and a source URL, and it loads once into `gameDataStore.popularBuilds` following the bundled `conditions.json` pattern (FR-42, AR-7, NFR-7).

**Given** a build's class/mastery and currently-assigned skills
**When** `popularBuildMatch.ts` runs
**Then** it filters by exact mastery match, sorts by count of skill overlap with assigned skills, and returns the top 3 matches entirely client-side with no network request (NFR-13).

### Story 5.5: Minion stat correctness (skill-tree wiring + de-conflation)

As a theory-crafting player with a minion build,
I want minion Count, HP, and Speed computed correctly from all real sources,
So that the Minion tab reflects my actual minion power, not just minion damage.

**Context:** Completes FR-10, deferred from Story 1.5 (see its Decision section). Story 1.5 shipped `minion_damage_multi` real and `MinionStats`/TS mirror/`Some`-`None` plumbing in place; count/HP/speed surfaced honest-`0.0` to preserve the frozen player `effective_hp`/speed parity gate. This story fills those values once its prerequisites land. Depends on **Epic 5** (skill DB) and the skill-allocations→registry capability delivered in AC1.

**Acceptance Criteria:**

**Given** `BuildSnapshot.skill_node_allocations` (today deserialized but consumed nowhere)
**When** `build_registry` runs
**Then** skill-specialization-tree node effects contribute modifiers to the registry, so skill-tree scaling reaches the stat engine (AC1).
**And** this is recognized as a general re-baseline: skill-tree allocations now feed ALL stats (damage_score, effective_hp, speed, etc.) for any build with skill allocations — the change is made deliberately with the `effective_hp_*`/`build_score_slider_*`/`ehp_reference` gates re-baselined and the optimizer/gear-scoring outputs revalidated.

**Given** minion Health/Attack-Speed nodes currently mapped to player `MaxHp`/`AttackSpeed`
**When** `tags_to_stat_key` is updated
**Then** `MINION`+`HEALTH` → `IncreasedMinionHp` and `MINION`+`ATTACK_SPEED` → a minion-speed key are matched **before** the player branches, de-conflating minion HP/Speed off player stats; the player-HP/speed re-baseline and the `GOLDEN_EFFECT_COUNT` change are deliberate and documented (the Necrotic-split precedent).

**Given** all minion sources (passives, skill spec trees, uniques, idols)
**When** `compute_minion` runs
**Then** `minion_count`, `minion_damage_multi`, `minion_hp_multi`, and `minion_speed` are computed from real sourced values (no dead keys); minion count is sourced from spec trees / uniques / idols.

**Given** Epic 5's skill database (skill tags/metadata)
**When** minion-skill presence is evaluated
**Then** Story 1.5's interim signal (`primary_offense_delivery_type == "minion"` ∨ any minion modifier) is replaced with real per-skill minion metadata, so `StatSheet.minion` is `Some(..)` exactly when ≥1 assigned skill is a minion skill (FR-10).

### Story 5.6: Mage passive-tree data authoring (FR-50)

As a Mage player,
I want the full Mage base tree and the Sorcerer, Spellblade, and Runemaster mastery trees in the app,
So that the stat sheet and optimizer work on my real tree instead of a 34-node placeholder stub.

**Acceptance Criteria:**

**Given** the shipped `mage.json`
**When** authoring completes
**Then** it contains the complete live-game node set (base + all 3 mastery trees), each node carrying its real name, max points, prerequisites (AND semantics, as in the Story 2.4 diamonds), canvas position, and ALL stat effects with live-game values — sourced from lastepochtools.com using the 1-3b extraction conventions; the node count matches the source tree via an automated count check (source count recorded at create-story time per the source-audit discipline).

**Given** authored multi-stat nodes
**When** game data loads (Story 5.0 loader)
**Then** every stat clause parses into the registry — zero silently-dropped clauses — and ≥10 sampled nodes per mastery are element+value-verified exactly against the source (stat key, modifier type, value each).

**Given** the previously shipped stub data
**When** this story completes
**Then** no invented nodes or values remain in `mage.json`; the PixiJS canvas renders the authored tree; and passive-optimizer suggestions for a Mage build reference only real node IDs (spot-verified in a real browser via the Story 4.5 Playwright harness).

**Given** any new stat key the authored nodes introduce
**When** the Source Audit runs
**Then** it resolves to an engine `StatKey` (or is explicitly registered with a sourced computation), and any frozen parity gate affected by newly-real Mage data is re-baselined deliberately with each delta explained.

### Story 5.7: Primalist passive-tree data authoring (FR-50)

As a Primalist player,
I want the full Primalist base tree and the Beastmaster, Shaman, and Druid mastery trees in the app,
So that the stat sheet and optimizer work on my real tree instead of a 32-node placeholder stub.

**Acceptance Criteria:**

Identical structure to Story 5.6 applied to `primalist.json` (base + Beastmaster/Shaman/Druid): complete authored node set with automated count check against the recorded source count; Story 5.0 multi-clause parse with ≥10 sampled nodes per mastery element+value-verified; no stub nodes or invented values remain; canvas render + optimizer real-node-ID spot-check via the Playwright harness; Source Audit on new stat keys with deliberate parity re-baselines.

### Story 5.8: Rogue passive-tree data authoring (FR-50)

As a Rogue player,
I want the full Rogue base tree and the Bladedancer, Marksman, and Falconer mastery trees in the app,
So that the stat sheet and optimizer work on my real tree instead of a 32-node placeholder stub — UJ-1's Rogue user journey finally runs on real data.

**Acceptance Criteria:**

Identical structure to Story 5.6 applied to `rogue.json` (base + Bladedancer/Marksman/Falconer), same gates: automated count check, ≥10 sampled nodes per mastery element+value-verified through the 5.0 loader, zero stub remnants, canvas + optimizer real-ID verification via the Playwright harness, Source Audit + deliberate parity re-baselines.

### Story 5.9: Acolyte passive-tree data authoring (FR-50)

As an Acolyte player,
I want the full Acolyte base tree and the Necromancer, Lich, and Warlock mastery trees in the app,
So that the stat sheet and optimizer work on my real tree instead of a 32-node placeholder stub.

**Acceptance Criteria:**

Identical structure to Story 5.6 applied to `acolyte.json` (base + Necromancer/Lich/Warlock), same gates: automated count check, ≥10 sampled nodes per mastery element+value-verified through the 5.0 loader, zero stub remnants, canvas + optimizer real-ID verification via the Playwright harness, Source Audit + deliberate parity re-baselines. Minion-heavy Acolyte nodes must land AFTER (or alongside) Story 5.5's minion de-conflation so minion stat keys resolve to minion stats, not player stats.

---

## Epic 6: Complete Build Optimizer

A full-screen, scope-driven holistic optimizer that reasons across tree, skills, gear, idols, and blessings together and returns a unified, domain-grouped, ranked roadmap — with completeness gates, a skill-suggestion shortcut, and a non-blocking Optimization Orb. Depends on Epic 1 (stat engine) and Epic 5 (popular builds for FR-23; FR-50 complete passive trees via Stories 5.6–5.9 — all-mastery analysis is meaningless against stub trees).

### Story 6.1: Complete Build Optimizer view and routing

As a player,
I want a full-screen Complete Build Optimizer reachable from the header,
So that I have a dedicated space for holistic optimization.

**Acceptance Criteria:**

**Given** the header navigation
**When** I click "Complete Build Optimizer"
**Then** the builder view is replaced by the full-screen Complete Build Optimizer and a "Back to Builder" control returns to it (FR-20).

**Given** the view topology
**When** this story completes
**Then** `appStore.currentView` is extended with `'complete-optimizer'` and routed in `App.tsx` with no React Router (AR-6)
**And** `Esc` returns to the Builder (consistent with FR-33).

### Story 6.2: Scope Selector

As a player,
I want to choose which build sections the optimization includes,
So that I can focus or exclude sections like the empty Weaver tree.

**Acceptance Criteria:**

**Given** the Complete Build Optimizer
**When** the Scope Selector renders
**Then** it shows one checkbox per section — Passive Tree, Active Skills, Gear, Idols, Blessings (checked by default) and Weaver (unchecked) — each with a secondary fill-status label (e.g., "Gear 8/11") (FR-21).

**Given** an unchecked section
**When** an optimization runs
**Then** that section is excluded from the optimization payload and from the suggestions.

### Story 6.3: Completeness gates with inline alerts

As a player,
I want clear validation before a run with direct fixes,
So that I know exactly what to complete before optimizing.

**Acceptance Criteria:**

**Given** checked sections
**When** I click "Run Complete Build Optimization"
**Then** each checked section's completeness gate is evaluated before analysis (Passive Tree ≥1 point; Active Skills ≥2 slots; Gear all 11 slots; Idols none; Blessings ≥1; Weaver budget >0) (FR-21, FR-22).

**Given** one or more failed gates
**When** validation runs
**Then** all failing gates render their inline red alert cards simultaneously, each with the section icon, a plain-language reason (e.g., "Gear requires all 11 slots filled — 3 slots are empty"), and a "Go to [Section]" button that navigates the builder to the relevant tab
**And** the optimization run does not start until all checked gates pass.

### Story 6.4: Complete optimization command, scope mask, and stream

As a developer,
I want a `run_complete_optimization` command that composes existing stages behind a scope mask and streams results,
So that the multi-domain flow reuses one engine without duplicating scoring logic.

**Acceptance Criteria:**

**Given** a snapshot and a `CompleteOptScope`
**When** `run_complete_optimization` runs
**Then** it executes inside `spawn_blocking`, reuses the existing scan/gear/synergy/idol stage functions gated by the scope mask, and never duplicates scoring logic; all internal `compute_stats` calls pass `track_sources: false` (AR-5, Pattern P4-2).

**Given** the streaming surface
**When** results are produced
**Then** they stream over a dedicated `complete-opt:suggestion-received` (domain-badged) / `complete-opt:complete` / `complete-opt:error` namespace, with no reuse of `optimization:*` or `gear:*` (Pattern P4-4)
**And** a new `useCompleteOptStream.ts` hook subscribes and populates `optimizationStore.completeOpt`, leaving the existing two stream hooks unmodified.

### Story 6.5: Unified domain-grouped suggestion output

As a player,
I want results grouped by domain and ranked,
So that I can act on the highest-impact change in each area.

**Acceptance Criteria:**

**Given** a completed optimization
**When** results render
**Then** suggestions are grouped under domain section headers (Passive Tree / Gear / Idols / Blessings / Active Skills), ranked by ΔBuildScore within each, using the FR-19 card format plus a domain badge; gear cards show current→recommended + delta + reason; sections expand/collapse (FR-25).

**Given** passive-tree suggestions in the results
**When** I click "Focus on Passive Tree"
**Then** the builder navigates to the passive tree with all Complete Build Optimizer passive suggestions pre-highlighted using the FR-17 visualization
**And** the run returns suggestions spanning at least 3 domains for a fully-configured build (NFR-4).

### Story 6.6: Optimization Orb animation

As a player,
I want an engaging animation while optimization runs,
So that the wait feels intentional — without delaying my results.

**Acceptance Criteria:**

**Given** a running optimization
**When** the orb renders
**Then** it shows a central gold/void orb with one token per checked section orbiting inward and absorbed (130px radius, one absorbed per ~620ms), and status text cycling the six canonical phrases ("Ingesting build state…" → … → "Assembling narrative…"), built in CSS per addendum D (FR-24, UX-DR6).

**Given** backend results arrive
**When** `complete-opt:complete` fires
**Then** results render immediately regardless of orb step — if results arrive first, the orb snaps to complete and the panel slides in within 500ms of backend return; the orb never gates the IPC result path (NFR-8, Pattern P4-5)
**And** `prefers-reduced-motion` collapses the orb to a static progress indicator.

### Story 6.7: Idol AI recommendations

As a player,
I want specific idol-placement recommendations when idols are in scope,
So that I can fill empty idol cells optimally.

**Acceptance Criteria:**

**Given** Idols in scope with empty grid cells
**When** the optimization runs
**Then** it recommends specific idol placements — size, placement coordinates, affix selection, and resulting stat contribution — shown as cards with a grid placement preview (FR-26).

**Given** the idol recommendation payload
**When** it is assembled
**Then** it includes only a filtered idol-database subset (idol types/affixes relevant to the build's damage types and empty cells), never the full idol DB (AR-13)
**And** recommended placements reference real affix IDs/tiers, do not conflict with existing placed idols (validated via `validatePlacement()`), and any rec with an out-of-payload ID is rejected before display (Pattern P4-6).

### Story 6.8: Skill suggestion from Popular Builds

As a player with an incomplete skill bar,
I want suggested skill sets from popular builds,
So that I can fill my remaining slots with proven combinations and proceed to optimize.

**Acceptance Criteria:**

**Given** Active Skills is checked and fewer than 2 slots are filled
**When** the gate renders
**Then** it includes a "Suggest skills for my build" action that queries the Popular Builds Database (Epic 5) by the build's class/mastery and already-assigned skills, showing a ranked list of popular skill sets with the current partial match highlighted (FR-23).

**Given** I select a suggested skill set
**When** it is applied
**Then** it auto-fills only the remaining empty slots without overwriting already-assigned skills
**And** when no popular build shares the assigned skills, the closest mastery-level match is shown.

---

## Epic 7: Character Import

Let players import an existing Last Epoch character instead of rebuilding by hand: a two-tab modal whose Offline tab scans and parses local save files into a new build, and whose Online tab ships as a wired stub pending EHG API access.

### Story 7.1: Character Import modal shell and error wiring

As a player,
I want an Import Character modal with Offline and Online tabs,
So that I have one place to bring a character into LEBO.

**Acceptance Criteria:**

**Given** the left-panel Import Character button
**When** I click it
**Then** a modal opens with two tabs, Offline and Online, dismissible via an ✕ button or clicking outside (FR-46).

**Given** the error-handling surface
**When** this story completes
**Then** `CHARACTER_IMPORT_ERROR` exists in `ErrorType`/`errorNormalizer.ts` (reusing the `SCORING_ERROR` discipline) so import commands normalize errors correctly (AR-10).

### Story 7.2: Save-file format spike and offline detection

As a player,
I want LEBO to find my local character save files,
So that I can pick a character to import.

**Acceptance Criteria:**

**Given** the OQ-8 save-format question
**When** this story begins
**Then** a Rust parsing spike against the community save-editor (gaconvt159/last-epoch-save-editor) resolves the `1CHARACTERSLOT_BETA_###` binary format, or the documented fallback (shell-invoke the Java tool, parse its JSON) is adopted; the chosen approach is recorded before sizing FR-48 (AR-11).

**Given** the Offline tab
**When** it opens
**Then** `scan_save_files` checks both known locations (Steam `userdata/.../899770/...Saves/` and AppData `LocalLow/Eleventh Hour Games/Last Epoch/Saves/`) and lists detected files with character name and class parsed from the header (FR-47).

**Given** neither default path exists
**When** the tab opens
**Then** it shows a "No save files detected" state with a Browse button for manual path selection.

### Story 7.3: Offline save-file parsing into a new build

As a player,
I want my selected character parsed into a new build,
So that I can optimize my real character in LEBO.

**Acceptance Criteria:**

**Given** a selected save file
**When** I click Import and confirm the replace prompt
**Then** `parse_save_file` extracts charClass, level, charTree, skillTrees, and equipment into an `ImportedBuild` mapped to a new `BuildState`, and the import creates a new named build (character name default) preserving the prior build (FR-48).

**Given** items or node IDs newer than the bundled data
**When** parsing completes
**Then** unresolved IDs are flagged in a post-import summary (e.g., "3 items could not be resolved — their slots have been imported as empty")
**And** all file I/O lives in `character_import.rs` in the Tauri crate, never in `scoring-core`.

### Story 7.4: Online import stub tab

As a player,
I want the Online import UI present and ready,
So that online import works the moment EHG API access is granted, with no UI rework.

**Acceptance Criteria:**

**Given** the Online tab
**When** it renders
**Then** it shows Account Name and Character Name fields and an Import button mirroring the lastepochtools.com import UI (FR-49).

**Given** the EHG API is partner-gated (OQ-7)
**When** I submit the Online form
**Then** `import_online_character` returns `Err("CHARACTER_IMPORT_ERROR: API access pending")` surfaced as an inline error (not a toast), with the command and UI fully wired so only the endpoint + auth headers substitute later.
