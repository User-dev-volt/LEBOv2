# Story 3.2: Enhanced suggested-node visualization on the canvas

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player optimizing my passive tree,
I want suggested nodes rendered with tiered, hover-free highlighting and a path line to the tree,
So that I can spot the best nodes to allocate at a glance, without hunting or hovering.

## Acceptance Criteria

**AC1 — Tiered, hover-free node treatment (FR-17; Alec-confirmed gold+silver scope)**
**Given** ranked suggestions (the `nodeEfficiencies` overlay from a completed `run_optimization`)
**When** the PixiJS canvas renders them
**Then** Gold-tier nodes scale to **1.4×** with a **pulsing gold glow (1.8s cycle)** and Silver-tier nodes scale to **1.2×** with a **steady silver glow**,
**And** Dim-tier nodes render as **ordinary available nodes** (no scale, no glow, no special outline).

> **Confirmed scope deviation (Alec):** FR-17 also defines a 1.05× muted-blue Dim treatment. It is **intentionally not rendered** — only the high-value Gold/Silver tiers get the suggested treatment, which is what makes AC2's distinctness hold. The produced `dim` tier becomes the "render as plain available" signal. See Dev Notes "DECISION". A reviewer must read AC1-met as "gold + silver treated, dim rendered as available" — not the literal FR-17 three-tier text.

**AC2 — Dashed path line + distinctness from available nodes (FR-17)**
**Given** a suggested (Gold- or Silver-tier) node whose prerequisites are not yet allocated
**When** it renders
**Then** a **dashed gold path line** connects it to the nearest allocated node,
**And** a suggested node is **visually distinct from a merely available (allocatable) node without hovering** — satisfied structurally: only Gold/Silver receive the tiered scale+glow, while every other allocatable node (including Dim-tier) renders in the plain available style.

**AC3 — Reduced-motion static fallback (FR-17, NFR-14)**
**Given** `prefers-reduced-motion` is set
**When** suggestions render
**Then** the pulsing glow is suppressed in favor of a static treatment (`drawSuggested`/the tiered draw **skips the glow ring**; scale + outline are retained).

---

## Tasks / Subtasks

- [x] **Task 1 — Drive Gold/Silver tiered rendering off `NodeEfficiency.tier` inside the main node loop (AC1, AC2-distinctness)**
  - [x] In `lebo/src/features/skill-tree/pixiRenderer.ts`, thread the efficiency map (`effMap`, currently built at `:479` in the *second* overlay pass) **up into the main node loop** (`:348-372`), mirroring how `isAllocated`/`isGlowing` are computed at `:351-352`. For an **unallocated** node whose tier is **`gold` or `silver`**, draw it as a **scaled, tiered suggested node IN PLACE OF** `drawAvailable` — not as a thin ring layered on top. (A ring-on-top leaves a base-radius node visible inside a 1.4× ring; see Dev Notes "Why scaling must move into the main loop".)
  - [x] **Dim-tier (and any non-gold/non-silver tier) → fall through to `drawAvailable`** (Alec-confirmed, AC1 scope). A dim-tier node must render **identically** to a plain available node — no scale, no glow, no special outline. This is the structural source of AC2's distinctness (only gold/silver are treated). Do **not** add a dim draw; let the existing `else → drawAvailable` (`:370`) handle it.
  - [x] Split `drawSuggested` (`:68-74`) into the two tier-aware draws — e.g. `drawSuggestedGold` (`r×1.4`, gold ring) / `drawSuggestedSilver` (`r×1.2`, silver ring) — each keeping the node's icon/label centered on the scaled node.
  - [x] Repurpose or remove the standalone second overlay pass (`:478-491`): the Gold/Silver tier visuals now come from the main loop, and the old dim ring (`drawOverlayDim`, `:111-113`) is dropped. If you keep a second pass, it should emit **only** the dashed path lines + the gold pulse layer, not base tier rings (avoid double-drawing). `drawOverlayDim` may be deleted as now-unused (strict TS will flag it).
  - [x] **Color tokens, not inline hex** (Pattern P4-8): replace the current hardcoded gold `0xFFD700` (`:104`) with `--color-accent-gold` `#C9A84C`. There is **no silver token today** — add one (see Task 4). Pull all tier colors through tokens.

- [x] **Task 2 — Add the 1.8s pulsing gold glow via a persistent ticker, reduced-motion gated (AC1 gold, AC3)**
  - [x] No per-frame pulse exists today — `renderTree` runs only on data change (`SkillTreeCanvas.tsx:207-209`). Add a **persistent ticker callback** (model on `iconAnimTick` at `:270-282`; register like `:282`; tear down in `destroy` at `:561-567`) that each frame computes a pulse phase from `performance.now()` over an **1800 ms period** (e.g. `sin(2π · (t mod 1800)/1800)`) and applies it to a **gold-only pulse layer** (glow ring alpha/radius). Do **not** re-run full `renderTree` per frame — animate a dedicated gold glow `Graphics`/`Container` only.
  - [x] Silver = **steady** glow (a static ring drawn once in the main loop; no ticker). Dim = no treatment (rendered as plain available, Task 1).
  - [x] **AC3:** the pulse ticker must read `reducedMotionEnabled` (`:494`, set via `setReducedMotion` `:496-498`) **every frame** and skip the gold glow when true, leaving the static scaled node + outline. Mirror the existing `if (!reducedMotion)` gate at `:69`. Reduced-motion is already threaded end-to-end: `useReducedMotion()` (`SkillTreeCanvas.tsx:46`) → `reducedMotionRef` (`:47,:91`) → `r.setReducedMotion(...)` on mount (`:182`) and on change (`:215`).

- [x] **Task 3 — Dashed gold path line to the nearest allocated node (AC2)**
  - [x] **No backend route exists for this** — `NodeEfficiency` carries no `path`/`from_node`/route field (see `## Source Audit`). Derive the path on the **frontend** from data the renderer already receives. Add a **pure, unit-testable helper** (e.g. `lebo/src/features/skill-tree/nearestAllocatedPath.ts`) — do **not** bury the graph code in the Pixi render loop.
  - [x] The helper takes `treeData` (`nodes` with `connections: string[]` and `edges: TreeEdge[]`, `treeData.ts:19,23-31`) + `nodeAllocations` and, for a given suggested node, runs a **BFS/Dijkstra over `connections`** to the nearest node with an allocation (`(nodeAllocations[id] ?? 0) > 0`, the same allocated predicate as `pixiRenderer.ts:351`). Return the node-id path (or just the two endpoints) for drawing. Prefer following real prerequisite edges over Euclidean distance so the line traces the actual tree.
  - [x] **Gate per the AC:** only draw the line for a **treated (Gold/Silver-tier) suggested node** **whose prerequisites are not yet allocated** — i.e. the node is reachable but not directly adjacent to an allocated node. (Dim-tier nodes are rendered as plain available and get **no** path line; a node all of whose prereqs are already allocated needs no line either.) Use the node's prerequisite/connection set + `nodeAllocations`.
  - [x] Draw the line **dashed and gold** (`--color-accent-gold`). PixiJS v8 `Graphics` has **no native dash** — hand-segment the line (`moveTo`/`lineTo` in on/off increments) along the derived path. Insert a dashed-path `Graphics` layer **between** `edgeGraphics` and the node layers (near `:180-197`) so it sits under nodes but over the solid edges.

- [x] **Task 4 — Design token for silver (AC1, Pattern P4-8)**
  - [x] In the global stylesheet (`lebo/src/assets/styles/global.css`, node-state token block ~`:40-44`), add the missing **silver** suggested token under the `--color-*` namespace — e.g. `--color-node-suggested-silver`. Gold already exists (`--color-accent-gold` `#C9A84C` `:28`; soft `#D4B96A` `:29` for the pulse peak; dim `#8B7030` `:30` for a low-phase/dashed candidate). **No dim suggested token is needed** — dim renders as plain available (Task 1).
  - [x] Reference these tokens from `pixiRenderer.ts` as `0xRRGGBB` PixiJS hex (the renderer reads numeric hex; keep the canonical value in the token and mirror it as a documented constant if a JS literal is unavoidable — do **not** scatter raw hex).

- [x] **Task 5 — Preserve the existing overlay gating and the orthogonal hover highlight (no regression)**
  - [x] Keep all FR-17 visuals inside the existing gate: the tier overlay is **passive-tree only** (`nodeEfficiencies`/`showOverlay` are passed only to the passive `SkillTreeCanvas`, `SkillTreeView.tsx:762-763`; skill/weaver canvases pass neither), suppressed when `unspentPassivePoints <= 0` (`effectiveNodeEfficiencies`, `SkillTreeView.tsx:656`), and gated by the `showOverlay` toggle (auto-on when efficiencies arrive `:152-158`; manual via `TreeControls`). Do not render tier visuals on the skill/weaver canvases or when there are no points to spend.
  - [x] **Do not delete or repurpose the hover-glow system** (System A): `drawSuggested` driven by `highlightedNodes.glowing` is the suggestion-card hover highlight (`SuggestionsList.handleHoverEnter`, `features/optimization/SuggestionsList.tsx:212-217`) and is the substrate for **Story 3.3** (card↔node cross-highlight, FR-18). Keep `glowing` working as an orthogonal "I'm hovering this card" highlight, distinct from the persistent tier overlay. (The `node.state === 'suggested'` half of the OR at `:363` is dead in production — only `mockTreeData.ts:34` sets it — leave it as-is; it's harmless and out of scope.)

- [x] **Task 6 — Tests (value + element assertions, not counts — per the verification guardrail)**
  - [x] **`nearestAllocatedPath.test.ts`** (pure util): over a small real edge fixture, assert the **exact** nearest-allocated target node and path for a suggested node, and that the function returns **no path** when a node's prerequisites are already allocated (or no allocated node is reachable). Element-level — assert the specific node ids, not "a path exists."
  - [x] **`pixiRenderer.test.ts`** (extend the existing mocked-Graphics tests): assert **per-tier** behavior — a gold node draws at radius ≈ `r×1.4` with a glow ring; silver at `r×1.2` with a steady ring; **a dim-tier node draws identically to a plain available node** (base radius `r`, available stroke, **no** scale, **no** glow — the confirmed AC1 scope). Assert the **reduced-motion** path: with `setReducedMotion(true)`, the gold glow ring draw is **absent** while the scaled gold node + ring remain. Assert the dashed path line is drawn between the correct two node coordinates and is **not** drawn for a dim-tier node. These are value/element assertions on the draw calls — **no snapshot tests**, no count-only "N rings drawn."
  - [x] **Guardrail:** a count-only or golden-snapshot test is insufficient — it would pass even if every node rendered the wrong tier. Assert the tier→scale/glow mapping and the path endpoints by value.
  - [x] `pnpm build` (tsc + vite) clean; full `pnpm vitest` shows **no new failures** vs the standing baseline (ProviderSelector / Settings / SkillTreeCanvas / TreeControls). Note `SkillTreeCanvas.test.tsx` is already in the failing baseline — do not let it regress further, and do not "fix" unrelated baseline failures here.

---

## Dev Notes

### What this story is (and is not)

This is a **PixiJS rendering overhaul**, not new scoring math and not new backend data. The tier data (`gold`/`silver`/`dim`) already flows end-to-end from the engine to the canvas (see `## Source Audit`); Story 3.1 **deliberately preserved** the `optimization:node-efficiencies` emit "(Story 3.2)". 3.2 replaces the current near-invisible thin-ring overlay with the unmistakable, hover-free, tiered treatment FR-17 specifies, and adds the dashed path line.

**Out of scope — do not implement here:**
- **`focusNode()` / suggestion-card cross-highlight / canvas tooltip** = **Story 3.3** (FR-18/FR-19). The architecture lists `focusNode()` in the same `pixiRenderer.ts` line as FR-17 [architecture.md:474], but it is a separate AC owned by 3.3. Do not add `focusNode` here.
- **Shift+click fill / right-click remove** = Stories **3.4 / 3.5** (FR-44/45). Do not touch `buildStore` allocation actions or `useSkillTree` click handling.
- **Any `scoring-core` / Rust change.** Do **not** add a `path` field to `NodeEfficiency` — AC2's line is frontend-derived (Dev Notes "Dashed path line"). Keep the engine and the `optimization:node-efficiencies` emit byte-unchanged.

### The two suggestion-rendering systems — and which one FR-17 targets

There are **two independent** systems in the renderer today; conflating them is the main trap:

| | System A — hover glow | System B — tier overlay |
|---|---|---|
| Function | `drawSuggested` (`:68-74`) | `drawOverlayGold/Silver/Dim` (`:103-113`), 2nd pass `:478-491` |
| Trigger | `highlightedNodes.glowing` (hover) / dead `node.state==='suggested'` | `NodeEfficiency.tier` |
| Source | `SuggestionsList` card hover (`SuggestionsList.tsx:212-217`) | `nodeEfficiencies` store (data-backed) |
| Hover-free? | **No** (one node, on hover) | **Yes** (persistent) |

**FR-17 ("tiered, hover-free highlighting") maps onto System B only** — it is the sole carrier of gold/silver/dim and the only one that renders without hovering. The reconciliation 3.2 makes: **fold the tiered scale+glow into the `drawSuggested` family driven by `NodeEfficiency.tier`** (AC3's wording — "`drawSuggested` skips the glow ring" — signals this intended unification), while **keeping System A's hover glow intact** for Story 3.3. Do not merge `glowing` into the tier logic; they are orthogonal.

### Current state of the files being modified

`pixiRenderer.ts` (the primary surface):
- `drawSuggested` (`:68-74`) — a **static** translucent `+6px` ring (purple `0x7b68ee`) + base node; no scale, no pulse, no tier awareness. `reducedMotion=true` skips the ring (the AC3 pattern to mirror).
- `drawOverlayGold/Silver/Dim` (`:103-113`) — thin **static** rings at ~base radius (`r+4`/`r+3`/`r+2`), hardcoded `0xFFD700`/`0xAAAAAA`/`0x444455`. No scale, no animation. Dim (`0x444455`, alpha 0.45) is effectively invisible.
- Main node loop `:348-372` — draws each node at base radius `r`; the final `else` (`:370`) is `drawAvailable`. The efficiency overlay is a **separate second pass** (`:478-491`) layered on top, skipping allocated/preview nodes.
- Edges (`:337-345`) — all **solid** (`0x3a3a45`, width 1.5). No dashed line exists anywhere.
- Ticker (`app.ticker`) runs `iconAnimTick` (icon pop-in, `:270-282`) and transient `triggerFlash` (`:612-628`); a public `addTickerListener` hook exists (`:573-577`). **No per-node pulse.**
- `renderTree(treeData, nodeAllocations, highlightedNodes, iconTextures, selectedNodeId, nodeEfficiencies, showOverlay, primaryDamageType)` — 8 params already in place (`:284-291`). **No prop/signature change needed** for this story; `nodeEfficiencies`, `showOverlay`, and reduced-motion already arrive (`SkillTreeCanvas.tsx:28-29,:46,:183-184,:208,:216-217`).

### Why scaling must move into the main loop

The base node is drawn at radius `r` in the main loop **before** the overlay second pass runs. A "draw a bigger ring on top" approach leaves a small base node visible inside a 1.4× ring. True 1.4× (gold) / 1.2× (silver) scaling requires **branching the main loop on tier** so a treated unallocated node is drawn *as* the scaled node (in place of `drawAvailable`), not decorated after the fact. Thread `effMap` (built at `:479`) into the loop alongside `isAllocated`/`isGlowing` (`:351-352`). (Dim falls through to `drawAvailable`, so it needs no scaling branch.)

### Dashed path line — frontend derivation (the one new data dependency)

`NodeEfficiency` carries **no route field** — the overlay feed cannot tell you "nearest allocated node" (see `## Source Audit`). The route the engine computes (`ScanResult.knapsack_solution`, `scan.rs:30`) is **never emitted**; it only feeds the Claude prompt. So AC2's line **must** be derived on the frontend, and the data to do it exists: `TreeData` exposes per-node `connections: string[]` (`treeData.ts:19`), `edges: TreeEdge[]` (`treeData.ts:23-31`), and per-node `state` incl. `'allocated'` (`treeData.ts:2,20`), all populated from game data (`treeDataTransformer.ts:61-80`). Implement a **pure BFS/Dijkstra helper** (own file + test) from the suggested node to the nearest allocated node; the renderer calls it (it already has `treeData` + `nodeAllocations` as props — no store access, satisfies the props-only canvas rule). **Reading a route off the `NodeEfficiency` payload would be the "rendered-but-not-sourced" defect** — don't.

### DECISION — "suggested vs merely available" (AC2 distinctness): **Alec-confirmed = Gold + Silver only**

The engine tiers **every reachable unallocated node** (`scan.rs:66-80` collect all reachable, `:148-168` all tiered; **no** efficiency-positivity filter). `dim` is the **bottom half** (`i >= n/2`). Consequence: while the overlay is active, essentially *every* allocatable node carries a tier, so a literal reading of "distinct from a merely available node" is in tension with the data — if dim got its own treatment, nearly every allocatable node would light up and "suggested" would blur into "available."

> **DECISION (Alec-confirmed): cap the suggested treatment to Gold + Silver; Dim-tier nodes render as plain available.** This makes the recommended set crisp and unmistakable, and satisfies AC2's distinctness **structurally** (only the high-value tiers are treated; everything else — dim and untreated — shares the plain available style). It is a deliberate, confirmed deviation from FR-17's literal three-tier text: the 1.05× muted-blue **Dim treatment is dropped**. The produced `dim` tier is still consumed — it is read to identify "render as available" — so no dead key; it simply maps to the no-treatment branch. The alternative (render all three tiers faithfully) was considered and **rejected by Alec** for blurring suggested vs available.

Implementation consequence: branch the main loop on `gold`/`silver` only; `dim` (and any other value) falls through to `drawAvailable`. Path lines and the gold pulse apply to treated nodes only.

### Anti-patterns / guardrails (do not violate)

- **Canvas is props-only** — `SkillTreeCanvas`/the renderer must **not** read Zustand. Tier data and `treeData` arrive as props [architecture.md:270]. The nearest-allocated helper operates on those props, not store reads.
- **Tokens, not inline hex** (Pattern P4-8 [architecture.md:402]): no raw hex literals for tier colors; add a `--color-*` silver token (none exists), fix gold to `--color-accent-gold` `#C9A84C`.
- **No per-frame full re-render** — animate only the gold pulse layer in the ticker; `renderTree` stays change-driven.
- **Passive-tree only** — never render the tier overlay on the skill or weaver canvases.
- **No `scoring-core`/Rust edit, no `NodeEfficiency` schema change, no touching the `optimization:node-efficiencies` emit** (3.1's territory).
- **Strict TS** (`noUnusedLocals/Parameters`), **no barrel files, named exports only** [project-context.md].
- **PixiJS WebGL null-info-log patch is already at module load** in `pixiRenderer.ts` — never re-inject it.

## Source Audit

Per the LEBOv2 guardrail (the visualization analog of the Epic-1 computed-but-not-sourced defect class: penetration / stun / minion), every rendered tier and every rendered path line must be backed by produced data. Element-level findings:

### AC1 — tiered highlighting (gold / silver treated; dim → available): FULLY SOURCED
- `run_efficiency_scan` ranks every reachable unallocated node by efficiency and assigns a tier in Step 7:
  - `scan.rs:144-146` — `let n = with_eff.len(); let gold_cutoff = n / 4; let silver_cutoff = n / 2;`
  - `scan.rs:152-159` — `let tier = if i < gold_cutoff { "gold" } else if i < silver_cutoff { "silver" } else { "dim" };` written into `NodeEfficiency.tier` at `scan.rs:160-166`.
- All three tiers are produced. **Per the Alec-confirmed decision, only `gold` and `silver` receive a visual treatment; `dim` is intentionally rendered as a plain available node.** The `dim` value is still **consumed** — it maps a node to the no-treatment branch (i.e. it is read to decide "render as available"), so there is no dead key; the produced tier still has a live consumer, it just resolves to the available style. (Integer-division cutoffs collapse tiers only for trivially small `n`: `n<4` → no gold, `n=1` → all dim. Irrelevant on the real tree.)

### `node_efficiencies` — PRODUCED and CONSUMED (no dead key)
- Produced: `scan.rs:148-168`, returned in `ScanResult.node_efficiencies` (`scan.rs:24`).
- Emitted: `scoring_commands.rs:50-52` — `serde_json::to_string(&scan_result.node_efficiencies)` → `app_handle.emit("optimization:node-efficiencies", eff_json)` (a JSON **string** payload).
- Consumed: `useOptimizationStream.ts:191-204` (`JSON.parse(...) as NodeEfficiency[]` → `setNodeEfficiencies`) → `optimizationStore.ts:84` → `SkillTreeView.tsx:108,656,762-763` → `SkillTreeCanvas` → `pixiRenderer.ts:478-489`.
- Field names align (no serde `rename_all`; snake_case on both sides — `stat_sheet.rs:149-157` ≡ `statSheet.ts:125-131` ≡ renderer reads `e.node_id`/`eff.tier`). **No camelCase mismatch.**
- For 3.2, `tier` is the load-bearing field and is fully backed. (`efficiency`/`path_delta_score`/`effective_point_cost` are produced + stored but not consumed at the render layer — they feed the Claude payload `scoring_commands.rs:369-371` and the deterministic sort `scan.rs:137-141`; available to 3.2 for magnitude if wanted, not required.)

### AC2 — dashed gold PATH LINE: NEW (frontend) DATA DEPENDENCY — no backend route on the overlay feed
- `NodeEfficiency` has exactly five fields — `node_id`, `efficiency`, `path_delta_score`, `effective_point_cost`, `tier` — and **no** `from_node`/`path`/`prereq`/`route` field (`stat_sheet.rs:149-157`). The overlay event serializes only `node_efficiencies` (`scoring_commands.rs:50-52`).
- Route data exists in the engine but **never reaches the canvas**: `ScanResult.knapsack_solution: Vec<Vec<String>>` (`scan.rs:30`, built by `reconstruct_path` `scan.rs:230-249`) and the `fromNodeId`/`toNodeId`/`"Path: …"` fields (`scoring_commands.rs:372-388`) feed the **Claude user_message**, returning as NDJSON suggestions on a separate stream — not the tier overlay. (`fromNodeId` is the knapsack path *start*, explicitly **not** "nearest allocated node.")
- Therefore the dashed gold path-to-nearest-allocated line **must be derived on the frontend**, and the source exists: `TreeData` exposes `connections: string[]` (`treeData.ts:19`), `edges: TreeEdge[]` (`treeData.ts:23-31`), and per-node `state` incl. `'allocated'` (`treeData.ts:2,20`), populated from game data (`treeDataTransformer.ts:61-80`, verified `treeDataTransformer.test.ts:114-144`). A client-side BFS/Dijkstra from a suggested node to the nearest `state==='allocated'` node is fully sourced.
- **Action (owned by Task 3):** derive the path on the frontend over `treeData` edges; do **not** read a route off the overlay payload (there is none).

### AC2 — "suggested vs merely available" distinction: resolved by Alec-confirmed decision (no new backend data)
- The scan tiers **every** reachable unallocated node, so a "merely available" node is itself in `node_efficiencies`, typically as `dim`. There is no separate available-but-not-suggested set in produced data. **Resolved per Dev Notes "DECISION" (Alec-confirmed): treat Gold + Silver only; Dim → plain available.** Distinctness is then structural — only the two high-value tiers carry scale+glow, and everything else (dim + untreated) shares the available style. No new backend data; only the gold/silver branch + the frontend path derivation are added.

### Verdict: NEW_DATA_DEPENDENCY_AC2_PATH (not N/A, not a dead tier)
All three tiers are genuinely produced and consumed with no dead key; AC1 is fully sourced. The single new exposure is AC2's dashed path line, which has no backend route field and **must** be frontend-derived from `treeData` edges (sourced and available). The story owns that derivation explicitly (Task 3) with a value+element test (Task 6). Per the verification guardrail, the equivalent rigor to a "value+element loader test" is the **element-level path-endpoint assertion** in `nearestAllocatedPath.test.ts` and the **tier→scale/glow value assertions** in `pixiRenderer.test.ts` — not a golden node-count or snapshot.

### Project Structure Notes

- Primary change is confined to `lebo/src/features/skill-tree/pixiRenderer.ts` (overlay overhaul), one new pure helper `nearestAllocatedPath.ts` (+ its test) co-located in the same feature folder, and new `--color-*` tokens in `lebo/src/assets/styles/global.css`. No new feature folder, no router, no new view, no store schema change.
- No `renderTree`/`SkillTreeCanvas` prop or signature change — `nodeEfficiencies`, `showOverlay`, and reduced-motion already arrive.
- `pixiRenderer.ts` is a shared file also touched by FR-44/45 multi-allocate (Stories 3.4/3.5) [architecture.md:531] — keep changes additive and localized to the suggestion overlay so later stories don't conflict.
- No new dependencies (frontend or Rust); versions locked per project-context.md / architecture.md. No web research required (PixiJS 8.18.1 already in use; v8 `Graphics` dashed lines are hand-segmented — no plugin).

### References

- [Source: epics.md:648-667 / Epic 3, Story 3.2] — story statement + the three ACs (gold 1.4×/pulse 1.8s, silver 1.2×/steady, dim 1.05×/blue, dashed gold path, reduced-motion).
- [Source: epics.md:63 / FR-17] — "Render suggested nodes on the PixiJS canvas with unmistakable, hover-free treatment … dashed gold path lines for prerequisite nodes."
- [Source: epics.md:274-275 / Epic 3 Owns + Implementation notes] — `pixiRenderer.ts` overlay overhaul; `focusNode()` is the *3.3* concern.
- [Source: architecture.md:474-475] — `pixiRenderer.ts` EXTENDED: FR-17 suggestion overlay (gold/silver/dim scale+glow, dashed path lines), focusNode().
- [Source: architecture.md:270] — `SkillTreeCanvas` is props-only / ref-driven, no store access; `focusNode(nodeId)` (FR-18, Story 3.3).
- [Source: architecture.md:296,298] — tokens `--color-accent-gold` `#C9A84C`, `--color-node-suggested` `#7B68EE`. (No silver token exists — add one.)
- [Source: architecture.md:402 / Pattern P4-8] — add new tokens under the `--color-*` namespace; never hardcode hex inline.
- [Source: scan.rs:66-80, 144-168] — every reachable unallocated node tiered; gold/silver/dim cutoffs (`n/4`, `n/2`).
- [Source: stat_sheet.rs:149-157] — `NodeEfficiency` (5 fields, no route field).
- [Source: scoring_commands.rs:50-52] — `optimization:node-efficiencies` emit (node_efficiencies only).
- [Source: statSheet.ts:125-131] — TS `NodeEfficiency`, `tier: 'gold' | 'silver' | 'dim'`.
- [Source: useOptimizationStream.ts:191-204] — overlay listener → `setNodeEfficiencies`.
- [Source: optimizationStore.ts:24,76,84] — `nodeEfficiencies` field + setter.
- [Source: SkillTreeView.tsx:108,118,152-158,656,762-763] — store read, `showOverlay` state + auto-on, `effectiveNodeEfficiencies` 0-budget suppression, props to passive canvas.
- [Source: SkillTreeCanvas.tsx:28-29,46,182,208,215-217] — props-only forwarding; reduced-motion threading; `renderTree` call.
- [Source: pixiRenderer.ts:56-59,68-74,103-113,270-282,337-345,348-372,478-491,494-498,573-577] — available/suggested/overlay draws, ticker, solid edges, main loop, second overlay pass, reduced-motion setter, ticker hook.
- [Source: treeData.ts:2,19,23-31] + [treeDataTransformer.ts:54-80] — `connections`, `edges`, `state==='allocated'` for the frontend path derivation.
- [Source: project-context.md] — props-only canvas, tokens via `rarityColors.ts`/CSS vars, reduced-motion `useReducedMotion()`, no barrel files, testing rules (PixiJS not unit-testable; pure utils get co-located tests; no snapshots).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code `dev-story` + ultracode multi-agent adversarial review).

### Debug Log References

- `pnpm vitest run nearestAllocatedPath.test.ts pixiRenderer.test.ts` → 29/29 pass (6 helper + 23 renderer).
- `pnpm build` → tsc 0 errors, vite build clean (pre-existing >500 kB chunk advisory + runtime-resolved font URLs only).
- Full `pnpm vitest run` → 1156 passed, 8 failed = the exact standing baseline (ProviderSelector / Settings / SkillTreeCanvas / TreeControls); +13 tests, no new failures, SkillTreeCanvas not regressed further.
- Mock completeness fix in `pixiRenderer.test.ts`: the `Text` mock gained `anchor` — the point-count label path (`label.anchor.set`) was exercised for the first time by the allocation-bearing dashed-path fixtures.

### Completion Notes List

- **AC1 (tiered, hover-free):** Folded gold/silver into the **main node loop** as a single mutually-exclusive `else if (tier === 'gold' || 'silver')` branch placed **before** `locked` and the final `drawAvailable`. `drawSuggestedGold` (r×1.4 + gold ring) replaces the available node in place; `drawSuggestedSilver` (r×1.2 + steady silver glow + ring). Dim-tier and any untreated node fall through to the natural available/locked style — **dim renders as plain available** per the Alec-confirmed DECISION (FR-17's literal 1.05× blue dim intentionally dropped). Removed the old `drawOverlayGold/Silver/Dim` thin-ring second pass and the `overlayGraphics` layer entirely (no double-draw, no dead code).
- **AC2 (dashed path + distinctness):** New pure `nearestAllocatedPath.ts` BFS over the bidirectional `connections` graph, frontend-derived (no route field exists on `NodeEfficiency` — only `.tier` is read). Returns `null` when a direct prerequisite is already allocated (available node → no line) and the shortest path otherwise (locked-state suggestion → line). Branch ordering ensures **locked** gold/silver suggestions — exactly AC2's "prerequisites not yet allocated" case — still get treated and a line. Dashed segments are hand-cut (PixiJS v8 has no native dash), accumulated on a `dashedPathGraphics` layer between edges and nodes, stroked once.
- **AC3 (reduced-motion):** 1.8s gold pulse via a **persistent ticker** (`goldPulseTick`) animating only the dedicated `goldPulseGraphics` layer — never a full `renderTree` per frame. Reads `reducedMotionEnabled` every frame and suppresses the glow while the static scale + ring remain; silver steady glow gated at render time. Ticker torn down in `destroy()`.
- **AC1/P4-8 token:** Added `--color-node-suggested-silver: #C0C6D2`; tier colors flow through documented hex constants mirroring `--color-accent-gold` / `-soft` / the new silver token (no inline tier hex; gold fixed off `0xFFD700`).
- **Scope held:** no Rust/scoring-core change, no `NodeEfficiency` schema change, no `optimization:node-efficiencies` emit change, no `focusNode`/shift-click/right-click, no store/`useSkillTree` change; canvas stays props-only; System A hover-glow (`drawSuggested` via `highlightedNodes.glowing`) preserved orthogonally for Story 3.3.
- **Ultracode review:** 6-lens adversarial review — AC1, AC2, AC3, and scope/guardrails all PASS with zero findings; render-correctness returned two perf-only findings (no AC violation). **Fixed** the MEDIUM finding: `nearestAllocatedPath` now reuses the `nodeMap` `renderTree` already builds (was rebuilding an O(N) map per suggestion) and uses parent-pointer BFS (no growing-array spread). **Deferred** the LOW finding (per-frame gold-glow geometry redraw vs animate-transform) — the story explicitly sanctions per-frame animation of the gold glow layer; the alpha/transform refinement is a future perf pass.

### File List

- `lebo/src/features/skill-tree/pixiRenderer.ts` (modified) — tier draws, gold pulse ticker, dashed-path layer, main-loop tier branch, removed legacy overlay pass
- `lebo/src/features/skill-tree/nearestAllocatedPath.ts` (new) — pure BFS path helper
- `lebo/src/features/skill-tree/nearestAllocatedPath.test.ts` (new) — element-level path assertions
- `lebo/src/features/skill-tree/pixiRenderer.test.ts` (modified) — op-recording mock + per-tier value/element + reduced-motion + dashed-path tests
- `lebo/src/assets/styles/global.css` (modified) — `--color-node-suggested-silver` token

## Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story 3.2 implemented (dev-story + ultracode). Tiered gold (1.4×, pulsing glow) / silver (1.2×, steady glow) rendering folded into the main node loop in place of `drawAvailable`; dim → plain available (Alec-confirmed). New `nearestAllocatedPath.ts` BFS helper derives AC2's dashed gold path to the nearest allocated node on the frontend (no `NodeEfficiency` route field). 1.8s pulse via a persistent reduced-motion-gated ticker on a dedicated glow layer; legacy `drawOverlay*` thin-ring second pass + `overlayGraphics` removed. New `--color-node-suggested-silver` token; tier hex via tokenized constants. 6-lens adversarial review: AC1/AC2/AC3/scope all PASS, 0 findings; 1 MEDIUM perf finding fixed (reuse nodeMap + parent-pointer BFS), 1 LOW perf finding deferred (story-sanctioned per-frame glow animation). tsc 0 / build 0 / full vitest 1156 passed, 8 failed = standing baseline (+13 tests, no new failures). Status → review. |
| 2026-06-29 | Story 3.2 created (create-story + ultracode multi-agent analysis). Source-audit verified element-level: all three tiers (gold/silver/dim) produced by `scan.rs:152-158` and consumed; `node_efficiencies` produced+consumed, no dead key, no snake_case mismatch. AC2 dashed path line flagged NEW_DATA_DEPENDENCY — no backend route field on the overlay feed; must be frontend-derived from `treeData` edges (sourced). Two suggestion systems (hover-glow vs tier-overlay) reconciled: FR-17 → tier overlay; hover-glow preserved for Story 3.3. AC2 "suggested vs available" tension resolved — **DECISION (Alec-confirmed): Gold + Silver treated only; Dim → plain available** (deliberate deviation from FR-17's literal dim clause; dim tier still consumed as the render-as-available signal, no dead key). Status → ready-for-dev. |
