# Epic 2 Context: Scoring Engine & Live Stat Sheet

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic delivers a deterministic Rust scoring engine (`scoring-core` crate) implementing Last Epoch's exact damage formula, wired to the TypeScript frontend via Tauri IPC with rAF-debounced updates. The result is a live stat sheet in the right panel with five tabs — General, Offense, Defense, Minion, Other — that update in real time on every build state change without a "Recalculate" button. Defensive floor failures (uncapped resistances, low crit avoidance, no sustain) are flagged as Critical warnings before any offensive suggestions.

## Stories

- Story 2.1: Scoring Engine Foundation — Crate Setup & Type System
- Story 2.2: Stage 1 — Build Score Function Implementation
- Story 2.3: Defensive Floor Check
- Story 2.4: Tauri IPC Wiring — `compute_stats` Command
- Story 2.5: TypeScript Integration — Serializer, Hook & Store
- Story 2.6: Stat Sheet UI — Five-Tab Display

## Requirements & Constraints

**Stat sheet five-tab layout (FR-B1–B6):**
- **General:** character level, total passive points spent vs. available (per mastery), per-skill levels and skill points spent vs. available, class and mastery name
- **Offense:** DamageScore, average hit damage (base and crit-weighted), crit chance %, crit multi %, attack or cast speed per active skill, AoE modifier
- **Defense:** effective HP, raw HP pool, Ward (if applicable), endurance % and endurance threshold, armor value, all 6 resistances (fire/cold/lightning/void/poison/physical), crit avoidance %, dodge %
- **Minion:** minion count, minion damage multiplier, minion HP multiplier — hidden entirely when no minion skills are active
- **Other:** movement speed %, cooldown recovery speed, mana pool and mana regen, resource-specific stats

**Real-time recalculation (FR-B7):** All stat values recompute on every state change. No "Recalculate" button ever.

**Performance (NFR-2):** Stat sheet recalculation on any single state change must complete in < 16ms to support 60fps.

**Accessibility (NFR-10):** All interactive UI passes axe-core. Any new axe violation fails CI.

**Resistance display:** Resistances below the 75% cap must be visually flagged. Tooltip or inline label shows the gap to cap (e.g., "+23% needed").

**Minion tab visibility:** Hidden — not greyed, not disabled — when no minion skills are active. Appears without a page refresh when a minion skill is assigned.

**Loading state:** When `isComputingStats = true`, a loading indicator is visible. Previous stat values remain visible (no blank flash or layout shift).

**Suggestion hover deltas (FR-B8):** When an AI suggestion is previewed, affected stat values show before/after deltas — gains green `(+X%)`, losses red `(-X%)`. Deferred to Story 4.5.

## Technical Decisions

**Data flow (all done in 2.1–2.5):**
- `optimizationStore.statSheet: StatSheet | null` — the single source of truth for the UI
- `optimizationStore.isComputingStats: boolean` — drives loading indicator
- `useStatSheet()` hook (in `App.tsx`) subscribes to buildStore + gameDataStore, rAF-debounces, calls `invokeCommand<StatSheet>('compute_stats', { snapshot })`. Already live.
- `StatSheet` has snake_case fields (Rust default output serialization — Pattern 2). TypeScript interfaces must mirror Rust field names exactly.

**`StatSheet` shape (from `shared/types/statSheet.ts`, defined in 2.1):**
- `offense: OffenseStats` — damage_score, avg_hit_damage, avg_hit_damage_crit_weighted, crit_chance, crit_multiplier, attack_speed, aoe_modifier
- `defense: DefenseStats` — effective_hp, hp, ward, endurance_percent, endurance_threshold, armor, fire_res, cold_res, lightning_res, void_res, poison_res, physical_res, crit_avoidance, dodge_chance
- `scores: ScoreComponents` — build_score, damage_score, surv_score, speed_score, slider_position, archetype_weights
- `warnings: StatWarning[]` — each warning has `type`, `current_value`, `gap`; fired by defensive floor check
- `minion?: MinionStats | null` — null when no minion skills; tab hidden when null
- `general` data comes from `BuildState` directly (level, points, class/mastery), NOT from `StatSheet` — the Rust engine doesn't own character level display

**Critical patterns (must not violate):**
- Pattern 7: Null `StatSheet` sub-sheets (`minion`) are hidden sections — never rendered as errors or empty containers
- `SkillTreeCanvas` is props-only — the stat sheet component must NOT access optimization store from inside the canvas; this only applies to canvas; the tab component itself can read from store
- Four stores only — no new stores; stat sheet reads from `useOptimizationStore` and `useBuildStore`
- No barrel files — no `index.ts` anywhere in `src/`
- Named exports only — no default exports

**Component location:** New `StatSheet` feature lives in `src/features/stat-sheet/` (kebab-case folder, self-contained). Component reads from `useOptimizationStore` and `useBuildStore`.

**Tailwind v4:** CSS-first config, no `tailwind.config.js`. Use `var(--color-*)` CSS variables for custom colors. Never `@apply`.

**`StatSheet` general tab data:** `buildStore.activeBuild` (characterLevel, classId, masteryId, skillNodeAllocations, nodeAllocations) + `gameDataStore.gameData` (class/mastery names, skill names, budgets). Not from Rust.

## UX & Interaction Patterns

Tabs use a tab bar pattern with `aria-selected` states, keyboard navigation, and 2px solid accent-gold focus rings. Tab component should follow the Headless UI `Tab` pattern already used elsewhere in the project.

Uncapped resistances (< 75%) get a distinct visual treatment (warning color + gap label). This is a purely presentational layer on top of raw `StatSheet.defense` values.

The Minion tab is conditionally rendered — check `statSheet?.minion != null` (not undefined/null).

Loading state: overlay or spinner on the stat sheet section while `isComputingStats = true`, not a full-panel blank.

## Cross-Story Dependencies

- Stories 2.1–2.5 are all **done** — `StatSheet` type, `optimizationStore` fields, `useStatSheet` hook, and `compute_stats` Tauri command are all live.
- Story 2.6 (this story) is purely additive React UI work — no Rust changes, no new IPC, no new stores.
- Story 4.5 (Suggestion Hover Deltas) builds on top of this component — reserve space in the design for delta overlays but do NOT implement them here.
- Story 4.4 (Node Efficiency Overlay) populates `optimizationStore.nodeEfficiencies` — no dependency on 2.6.
