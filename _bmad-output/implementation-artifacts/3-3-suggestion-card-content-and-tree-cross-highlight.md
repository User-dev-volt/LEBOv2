# Story 3.3: Suggestion card content and tree cross-highlight

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want each suggestion card to be informative and to highlight its node on the tree when I interact with it,
So that I never have to hunt for the suggested node.

## Acceptance Criteria

**AC1 — Informative suggestion card (FR-19)**
**Given** a suggestion
**When** its card renders in the right panel
**Then** it shows **rank number**, **node name**, **score delta** (e.g. `+4.2`), **point cost + path cost** (e.g. `2 pts / 4 pts to reach`), and a **one-sentence Claude mechanical explanation** citing the specific deltas.

> **Confirmed scope/source decisions (see Dev Notes "DECISIONS" + "## Source Audit"):**
> - **Score delta `+4.2`** = the suggestion's own **composite ΔBuildScore**, derived on the frontend from `suggestion.baselineScore → previewScore` using the **same composite formula ScoreGauge already uses** (`round` of the average of non-null `damage/survivability/speed` axes; delta to one decimal). It is **NOT** read from the Claude-echoed `toNodeId → nodeEfficiencies` join (full-path + echo-fragile — the displayed-but-not-sourced trap). The three existing per-axis DMG/SUR/SPD pills stay as the corroborating breakdown.
> - **Point cost** = the node's own cost (`GameNode.pointCost`/`maxPoints`, deterministic gameData). **Path cost ("N pts to reach")** = total points to allocate the unallocated **prerequisite** chain to reach the node, **computed on the frontend** by walking `GameNode.prerequisiteNodeIds` to the nearest allocated node (mirrors `nearestAllocatedPath`). Neither field exists on `SuggestionResult`; both are derived from already-produced data, never invented or pulled from the LLM explanation.
> - The Claude explanation must be **always visible** on actionable cards (today it is gated behind hover/expand).

**AC2 — Card → tree cross-highlight + compact canvas tooltip (FR-18)**
**Given** I hover **or** click a suggestion card
**When** the interaction fires
**Then** the corresponding node(s) **pulse with an intensified highlight** that **amplifies (does not replace)** the Story 3.2 gold/silver tier treatment,
**And** a **compact canvas tooltip** shows **node name, point cost, path cost, and per-stat deltas** (e.g. `+22% Necrotic Damage, +8% Cast Speed`).

> **Confirmed scope/decisions:** The interaction must be reachable by **hover, click, AND keyboard focus** (today only hover is wired; click/keyboard are net-new — required for a11y, NFR-14/UX-DR12). "Node(s)" minimum = intensify the **target node** (the 3.2 dashed gold path to the nearest allocated node already shows the route); pulsing the prerequisite-path nodes is **optional/nice-to-have**, not required. The per-stat deltas come from `computeStatDeltas(statSheet, previewStatSheet)` (existing), filtered to **changed, non-inert** fields (do **not** list perpetual `±0` inert stats — that is itself the displayed-but-not-sourced defect class). Synthetic/informational cards get **no** cross-highlight/tooltip/focus (guarded).

**AC3 — Off-screen node smoothly centers via `focusNode(nodeId)` (FR-18 / AR-6)**
**Given** the suggested node is off-screen (tree panned/zoomed away)
**When** I interact with its card
**Then** the canvas **smoothly animates to center it** via a **new** `SkillTreeCanvasHandle.focusNode(nodeId)`,
**And** the canvas stays **props/ref-driven with no Zustand access inside it**.

> **Confirmed scope/decisions:** `focusNode` is added to the imperative handle and animates renderer-owned camera state (the `fitToTree` pattern) — **no store read inside `SkillTreeCanvas`/`pixiRenderer`** (AR-6). Under `prefers-reduced-motion` it **jumps instantly to the centered transform** (it must **not** copy `triggerFlash`'s reduced-motion early-return, which would make it a no-op). The right-panel→canvas trigger crosses sibling subtrees, so it routes through the **store** (a new focus signal) read by `SkillTreeView`, which forces the passive tab active and calls `passiveCanvasRef.current?.focusNode(id)`. `focusNode` is shared with Epic 6 (AR-6 partial) — keep the signature generic.

---

## Tasks / Subtasks

- [x] **Task 1 — FR-19 card content: score delta, point cost + path cost, always-visible explanation (AC1)**
  - [x] In `SuggestionCard.tsx`, add a **single composite score delta** (e.g. `+4.2`) to the actionable card header. Derive it with the **ScoreGauge composite** (`round((damage+survivability+speed)/non-null count)` of `previewScore` minus the same of `baselineScore`, shown to one decimal like ScoreGauge's `▲ 9.0`). **Extract/reuse** the ScoreGauge composite helper rather than duplicating the average (`features/optimization/ScoreGauge.tsx`; behavior pinned by `ScoreGauge.test.tsx:17-18,44-54`). Keep the three per-axis DMG/SUR/SPD `DeltaPill`s (`SuggestionCard.tsx:277-296`) as the breakdown.
  - [x] Add a **"point cost / path cost"** line in the exact FR-19 format `N pts / M pts to reach` **alongside** (not replacing) the existing ADD/REMOVE/SWAP badge + `Allocate N pt` text (`SuggestionCard.tsx:40-49,236-257`). **Point cost** = node's `GameNode.pointCost` (or `maxPoints` for full allocation — pick per the node's semantics; deterministic gameData, `gameData.ts:4-5`). **Path cost** = the Task-2 shared helper's result. These are **new props** on `SuggestionCard`, computed in `SuggestionsList.renderCard` (it already has `gameData`/`classId`/`masteryId` and builds names — `SuggestionsList.tsx:320-353`).
  - [x] Make the Claude **explanation always visible** on actionable cards: change `showExplanation = (isExpanded || isHovered) && !!suggestion.explanation` (`SuggestionCard.tsx:104`) so the sentence renders by default. Preserve the always-on explanation for informational cards (`:187-195`) and ensure `onHoverEnter/onHoverLeave` still fire (don't break the `isHovered` mirror at `:128-136`).
  - [x] Extend the card **`aria-label`** (`SuggestionCard.tsx:109-118`) to include the new score delta + point cost + path cost so the spoken label matches the visual.

- [x] **Task 2 — Shared, pure, sourced helpers (AC1/AC2 — source-audit backbone)**
  - [x] **`pathPointCost` (new, `shared/utils/`)** — pure BFS over `GameNode.prerequisiteNodeIds` (`gameData.ts:6`) from the suggested node to the nearest **allocated** node (`(nodeAllocations[id] ?? 0) > 0`), summing each unallocated node's `GameNode.pointCost`. Returns `0` (or the node's own cost) when a prerequisite is already allocated / the node is directly reachable. Mirror `nearestAllocatedPath.ts:13-56` (parent-pointer BFS, head cursor not `shift()`, `has()`-guard, returns the no-op case cleanly). It **must live in `shared/`**, not in a feature folder, because the optimization card and the skill-tree tooltip both consume it and **cross-feature imports are forbidden** (project-context: "route through `src/shared/`"). `nearestAllocatedPath.ts` (skill-tree, over `treeData.connections`) stays the in-renderer analog for the dashed line — do not delete it.
  - [x] **`getNodeName` → shared** — extract the existing `getNodeName` (`SuggestionsList.tsx:15-29`, `gameData…nodes[id].name ?? baseTree[id].name ?? id`) into `shared/utils/` so the canvas tooltip (skill-tree feature) reuses the **same** resolver. Keep the terminal `?? id` fallback (guarantees no empty render).
  - [x] **`computeStatDeltas` → shared** — extract `computeStatDeltas` + `StatDeltas` (`StatSheetPanel.tsx:68-132`, currently feature-local) into `shared/utils/` for the AC2 tooltip. It diffs `previewStatSheet` vs baseline `statSheet`. **Filter to changed, non-inert fields** for the tooltip (omit perpetual `±0` inert stats — `stun_chance`, ailment/avoidance fields per `statSheet.ts`) so the tooltip never shows a sourced-looking `±0` for a stat the build can't move.
  - [x] Each helper gets a **co-located element-level test** asserting **exact values** for a known fixture (per the verification guardrail — value+element, not count/snapshot).

- [x] **Task 3 — Card activation: hover + click + keyboard all drive the cross-highlight (AC2)**
  - [x] **Extend, do not rewrite,** `SuggestionsList.handleHoverEnter` (`:208-247`) — it is the 3.2-preserved substrate that sets `highlightedNodeIds.glowing` (+ `dimmed` for SWAP `fromNodeId`) and fires the **Story 4.5** preview `compute_stats` IPC. Factor a shared `activate(suggestion)` that both hover and the new click/keyboard paths call; **preserve** the `isSyntheticNodeId` early-return (`:208-210`), the `!isComputingStats` gate, and the `previewAbortRef` stale-hover cancellation in `handleHoverLeave` (`:249-253`).
  - [x] **Add card `onClick`** — the card root is `role=article` with `onMouseEnter/Leave` but **no `onClick`** today (`SuggestionCard.tsx:128-158`). Add a whole-card activate click that routes through the same `activate()` path. **Guard button bubbling**: Preview/Apply/Skip (`SuggestionCard.tsx:318-353`) must `stopPropagation` so they don't double-fire activation; do **not** route the Preview button through `activate()`.
  - [x] **Keyboard parity** — focusing a card via ArrowUp/Down (`focusedCardIndex`, `SuggestionsList.tsx:127-206`) must also fire `activate()` (today keyboard focus does **not** highlight). This satisfies the review-rubric keyboard pattern (activate-on-focus / dismiss-on-blur).
  - [x] **Do not conflate with Preview** — `previewSuggestionRank`/`handlePreview`/the preview banner/`previewAdded`/`previewRemoved` (`SuggestionsList.tsx:255-257,357-394`; `SkillTreeView.tsx:233-261`) is a separate button-driven feature; cross-highlight layers beside it and must not clear or trigger it.

- [x] **Task 4 — Renderer: intensified highlight that COMPOSES with the 3.2 tier treatment (AC2)**
  - [x] **Fix the deferred 3.2 precedence bug.** In `pixiRenderer.ts` the node-loop branch order is `previewRemoved → previewAdded → allocated → (isGlowing||suggested)→drawSuggested → isDimmed → tier gold/silver → locked → available` (`:447-477`), so `isGlowing` (`:453`) **wins over** the tier branch (`:458-472`): hovering a gold/silver suggestion's card currently **downgrades** it from `r×1.4`/`r×1.2` + tier ring + gold pulse + dashed path to a flat base-radius purple ring. **Remove `isGlowing` from the mutually-exclusive base-draw chain** so the base draw is decided only by allocated/tier/locked/available.
  - [x] **Add an additive emphasis pass** after the base if/else: `if (isGlowing) drawEmphasis(...)` that layers an emphasis ring **on top of** the already-drawn node, at the node's **effective radius** (`r×GOLD_TIER_SCALE` / `r×SILVER_TIER_SCALE` for gold/silver, plain `r` otherwise) so it hugs the tier node instead of sitting as a base-size ring inside it. The `suggestedGraphics` layer is already above `goldPulseGraphics`/`tierGraphics`/icons (`:233-252`), so an additive draw layers correctly with no `addChild` reorder.
  - [x] **Animate the intensified pulse** via a parallel `emphasisPulse` layer + targets + ticker callback, cloning the `goldPulseTick` pattern (`:339-354,394,407,464,659`): register like `:354`, clear in `renderTree` like `:394/:407`, populate for every `isGlowing` node, **tear down in `destroy()`** like `:659` (+ a teardown test — a 3.2-deferred hardening item). Keep it independent from the gold tier pulse. **Read `reducedMotionEnabled` every frame** (mirror `:345`); under reduced motion draw a **static** emphasis ring (not nothing) so hover/click still produces a locatable highlight.
  - [x] **Preserve**: `drawDimmed` for the SWAP `fromNode` (`isDimmed && !isGlowing`, `:456-457`); the dead `node.state==='suggested'` half of the OR; cross-highlight stays **passive-tree only** (skill/weaver canvases get no `glowing`).

- [x] **Task 5 — Compact canvas tooltip on card interaction (AC2)**
  - [x] Surface a **compact tooltip** showing **node name + point cost + path cost + per-stat deltas** when a card is hovered/clicked. **Extend `NodeTooltip.tsx`** (a DOM portal overlay, `:1,18,22-30`) with an optional compact variant / new optional props (`pathCost`, per-stat deltas, optional score delta) and render them, **keeping all current props/behavior** so `NodeTooltip.test.tsx:21-118` stays green. Reuse the `DeltaPill`/`formatDelta`/`getDeltaColor` formatting (`SuggestionCard.tsx:11-38`) for visual consistency.
  - [x] **Drive it from the card interaction**, not just canvas hover. Today `NodeTooltip` is fed only by `useSkillTree` `hoveredNodeId`/`keyboardFocusedNodeId` inside `SkillTreeView` (`:766-794`). Add a card-interaction tooltip state in `SkillTreeView` fed by the active suggestion's node id + screen position. Position at the node's screen coords (`viewport.x + node.x*scale` — `SkillTreeCanvas.tsx:120-123`; expose `getViewport()` on the handle if needed) or anchor after `focusNode` centers the node.
  - [x] **Handle async + guards**: `previewStatSheet` (the per-stat-delta source) is set async via the card-hover `compute_stats` IPC (`SuggestionsList.tsx:219-247`) and may lag the interaction — render a graceful loading/empty state. Synthetic suggestions skip preview entirely — no tooltip for them.

- [x] **Task 6 — `focusNode(nodeId)` on the canvas handle (AC3)**
  - [x] Add `focusNode(nodeId: string): void` to **`RendererInstance`** and **`SkillTreeCanvasHandle`** (`types.ts:14-40`), and to the **`useImperativeHandle`** in `SkillTreeCanvas.tsx:50-54` (`focusNode: (id) => rendererRef.current?.focusNode(id)` — same `?.`-guard/closure shape as `fitToTree`; no new props, **no store access**).
  - [x] Implement `focusNode(nodeId)` in `pixiRenderer.ts` (add to the returned object at `:727-738`). Resolve the node's world `(x,y)` from `lastRenderedNodeMap` (`:307,378,690`); compute the target translate by **mirroring `fitToTree` centering** (`worldContainer.x = canvasW/2 − node.x*scale; .y = canvasH/2 − node.y*scale`, `:617-620`), keeping current scale or a clamped focus scale (MIN/MAX `0.3–2.5`, `:288-289`). Guard `canvasW/H === 0` by deferring (the `pendingFitNodes` precedent, `:597-600,645-654`).
  - [x] **Smooth tween**: ease `worldContainer.x/y` from current to target over a fixed duration via a **self-removing `app.ticker`** callback modeled on `triggerFlash` (`:677-725`) — `performance.now()` progress, remove the listener at `progress>=1`, cancel any in-flight focus tween (`activeTick`-style).
  - [x] **Reduced motion**: gate on `reducedMotionEnabled` (`:589`) — when true, **set the final centered transform immediately** (jump). Do **NOT** copy `triggerFlash`'s reduced-motion early-return (`:678`) — that would make `focusNode` a no-op and never center.
  - [x] **Off-screen check** (AC3 wording): only run the pan when the node is off-screen (compute its screen pos via `getViewport()`); when already comfortably visible, skip or instant-center.

- [x] **Task 7 — Right-panel → canvas focus signal, canvas stays store-free (AC3)**
  - [x] Add a **focus signal** to `optimizationStore` (e.g. `focusNodeId: string | null` **plus a nonce/counter**, or a focus-request token) mirroring `highlightedNodeIds` (`optimizationStore.ts:6-9,17,56,136`). A nonce is required so **re-activating the same node re-fires** (a plain unchanged value won't re-run the effect).
  - [x] In `SuggestionsList`/`SuggestionCard`, set the focus signal (alongside the existing `highlightedNodeIds`) on hover/click/keyboard activation for the suggestion's `toNodeId`; preserve the synthetic-node guard.
  - [x] In **`SkillTreeView`**, observe the focus signal in a `useEffect`, **force the passive tab active** (`centerTab='tree'`, `activeTabIndex 0` — the passive canvas is `display:none` when `centerTab≠tree`, `CenterCanvas.tsx:136-143`), then call `passiveCanvasRef.current?.focusNode(id)` (`:122,733,749`). The store read stays in `SkillTreeView` (React glue), **never inside the canvas** (AR-6).

- [x] **Task 8 — Tokens (Pattern P4-8) + accessibility (NFR-14 / UX-DR12)**
  - [x] **Tokens, not inline hex**: consume `--color-accent-gold` `#C9A84C`, `--color-accent-gold-soft` `#D4B96A`, `--color-node-suggested` `#7B68EE`, `--color-node-suggested-silver` `#C0C6D2` (added by 3.2). For the intensified emphasis use the **node's own tier color amplified** (gold-soft over gold, silver over silver, suggested-purple over untreated) — see DECISIONS. If a distinct "intensified" color is chosen, add a new `--color-*` token + mirrored documented hex constant (the System-A purple is currently inline `0x7b68ee` at `pixiRenderer.ts:83,86` — do not add to that debt).
  - [x] **a11y**: keep the 2px solid `--color-accent-gold` focus ring on the focusable card; add a **polite `aria-live`** region so streamed/ranked suggestions + the active selection are announced (UX-DR12; the list has only `role=status` on the empty-budget notice today, `SuggestionsList.tsx:495`). New/changed components must pass **vitest-axe** with **zero new violations**.

- [x] **Task 9 — Tests (value + element assertions — per the verification guardrail)**
  - [x] **`SuggestionCard.test.tsx`** / **`SuggestionsList.test.tsx`**: assert the **exact** rendered score delta for a known `baselineScore`/`previewScore` (composite-of-non-null-axes math), the **exact** `N pts / M pts to reach` string for a known node + allocations, always-visible explanation, click activation fires the highlight, keyboard-focus fires the highlight, and the existing hover-sets-`glowing` / hover-leave-clears tests still pass. Assert SWAP card sets `glowing(toNodeId)` + `dimmed(fromNodeId)`.
  - [x] **`pathPointCost` / `getNodeName` / `computeStatDeltas` shared tests**: exact-value assertions on real fixtures (path cost over a known prereq chain; name resolution + `id` fallback; per-stat delta diff excludes inert `±0` fields).
  - [x] **`pixiRenderer.test.ts`**: add the currently-**missing** glowing+tier composition tests — a `glowing` **gold** node still draws at `r×1.4` with its tier ring **and** receives the additive emphasis; same for silver at `r×1.2`; assert the emphasis is **static** (no animated glow) under `setReducedMotion(true)` while scale+ring remain; assert the emphasis ticker is removed in `destroy()`. (All existing tier tests use `emptyHl()` with no `glowing`, so the precedence bug is invisible to them — `:150-159,373-431`.)
  - [x] **`SkillTreeCanvas.test.tsx`**: extend the `mockRenderer` (`:24-35`) with `focusNode` and assert the handle **forwards** `focusNode` to the renderer (model the `fitToTree` mock). This file is in the failing baseline — update the mock so it does **not** regress further.
  - [x] **`NodeTooltip.test.tsx`**: add compact-variant render tests (name + point cost + path cost + per-stat deltas) without breaking the existing contract.
  - [x] `pnpm build` (tsc + vite) clean; **full `pnpm vitest` shows no new failures vs the standing baseline: ProviderSelector / Settings / SkillTreeCanvas / TreeControls** (currently 1156 passed / 8 failed). Do not "fix" unrelated baseline failures here.

---

## Dev Notes

### What this story is (and is not)

This is the **right-panel ↔ canvas integration** story: it makes the suggestion card carry FR-19's full content and wires hover/click/keyboard on a card to (a) an **intensified, tier-composing** node highlight, (b) a **compact canvas tooltip**, and (c) a smooth **`focusNode`** pan/zoom. **No `scoring-core`/Rust change, no `NodeEfficiency` schema change, no `optimization:node-efficiencies`/`run_optimization` payload change** is needed — every new displayed value is presentation or **frontend derivation of already-produced data** (see `## Source Audit`).

**Out of scope — do not implement here:**
- **Shift+click fill-to-max** = Story **3.4** (FR-44). Do not touch `buildStore` allocation actions or `useSkillTree` click handling for multi-allocate.
- **Right-click remove-all + orphan cascade** = Story **3.5** (FR-45). `NodeContextMenu.tsx` exists but is **unrendered scaffolding** — do not wire/render it or alter the `handleNodeContextMenu`/`onNodeContextMenu` seam (`SkillTreeView.tsx:409,758,817`).
- **"Focus on Passive Tree" unified grouped output** (FR-25) = **Epic 6 / Story 6.5**. `focusNode` is shared with Epic 6 (AR-6 partial) — keep its signature generic, but do not build the multi-suggestion pre-highlight here.
- **Informational/synthetic suggestion scaffolding** (`warning:`/`unique:`/`synergy:`) is **dead-but-keep** for Epic 6 (Story 3.1 made `run_optimization` `passive_node`-only). Preserve its always-on explanation; give it **no** cross-highlight/tooltip/focus.

### The two suggestion-rendering systems (recap) and the precedence resolution

Story 3.2 documented two independent systems; 3.3 must make them **compose**:

| | System A — hover/interaction glow | System B — tier overlay (3.2) |
|---|---|---|
| Function | `drawSuggested` (`pixiRenderer.ts:81-87`) | `drawSuggestedGold/Silver` + gold pulse (`:458-472`) |
| Trigger | `highlightedNodes.glowing` (card hover/click) | `NodeEfficiency.tier` |
| Hover-free? | No (on interaction) | Yes (persistent) |

The bug 3.2 deferred: the `isGlowing` branch (`:453`) sits **before** the tier branch (`:458`) in a mutually-exclusive `if/else` chain, so hovering a gold/silver card replaces its tier visual (scale + ring + pulse + dashed path) with a flat base-radius purple ring. **FR-17 is the hover-free baseline; FR-18's "intensified highlight" amplifies it on interaction** — they are meant to stack. The fix (Task 4): take `isGlowing` **out** of the base-draw chain and draw an **additive** emphasis pass at the node's effective (tier-scaled) radius. Do **not** reorder the chain so `glowing` wins — that erases the 3.2 deliverable.

### DECISIONS (no UX markdown spec exists — FR text governs; flag for Alec)

There is **no standalone UX design doc** for the card layout / compact tooltip / cross-highlight in the active planning dir (`Glob *ux*` = none); the only visual reference is the Claude Design handoff JSX prototype (partial — its card omits rank# and point/path cost; its tooltip shows only name/type/desc). The FR text (`prd.md:223-233`) governs. The following are **dev-time defaults; confirm with Alec** (surfaced in the completion question list):

1. **Score delta `+4.2` source** → composite ΔBuildScore from the suggestion's own `baselineScore→previewScore` using the **ScoreGauge composite** (`round(avg of non-null axes)`, delta to one decimal). **Rationale:** single-node-consistent with the per-axis pills and Apply; fully sourced; avoids the Claude-echoed `nodeEfficiencies` join's miss-renders-empty + full-path-vs-single-node mismatch (see `## Source Audit`). Per-axis pills stay as the breakdown.
2. **Point cost vs path cost** → point cost = node's own `GameNode.pointCost`/`maxPoints`; path cost = frontend BFS over `prerequisiteNodeIds` summing `pointCost` to the nearest allocated node. **Deterministic gameData, no LLM/`nodeEfficiencies` dependency.**
3. **Intensified-highlight color** → amplify the node's **own** tier color (gold-soft over gold, silver over silver, suggested-purple over untreated/available), brighter/larger than the steady tier glow. **Do not recolor a gold/silver node System-A purple** (reads as a downgrade).
4. **Focus signal mechanism** → `optimizationStore` `focusNodeId` **+ nonce** (re-fires on same-node re-activation), read by `SkillTreeView`. Alternative considered: a `window` `CustomEvent('canvas:focusNode')` mirroring the `keyboard:escape` bus (`App.tsx:116`) — store+nonce is preferred for testability and store-consistency with `highlightedNodeIds`.
5. **"Node(s)" scope** → required = intensify the **target** node (the 3.2 dashed path already traces the route); prerequisite-path-node pulsing is optional.

### Current state of the files being modified

- **`SuggestionCard.tsx`** — renders rank (`:179-184`/`:268-274`), node name from `toNodeName` (`:245-251`), ADD/REMOVE/SWAP badge + `Allocate N pt` (`:40-49,236-257`), three per-axis `DeltaPill`s (`:277-296`), explanation **gated** by `showExplanation=(isExpanded||isHovered)` (`:104,298-306`). Root is `role=article`, `onMouseEnter/Leave`, **no `onClick`** (`:128-158`). **No** aggregate score delta, **no** point/path cost.
- **`SuggestionsList.tsx`** — `getNodeName` (`:15-29`, module-local), `handleHoverEnter` sets `highlightedNodeIds.glowing` + fires Story-4.5 preview `compute_stats` (`:208-247`), `handleHoverLeave` clears (`:249-253`), `renderCard` wiring (`:320-353`), keyboard nav (`:127-206`), `keyboard:escape` listener (`:136-143`), synthetic-id early-return (`:208-210`), `role=list`/`role=status` only (`:483-495`).
- **`pixiRenderer.ts`** — node-loop branch order + the `isGlowing`-before-tier bug (`:447-477`); `drawSuggested` purple ring (`:81-87`); `goldPulseTick`/targets/graphics reusable pulse pattern (`:339-354,394,407,464,659`); layer z-order `suggestedGraphics` above tier/icons (`:233-252`); `fitToTree` centering (`:595-621`, instant — no tween); `triggerFlash` self-removing tween model (`:677-725`, but reduced-motion early-returns at `:678`); returned handle (`:727-738`); `lastRenderedNodeMap` (`:307,378,690`); `getViewport` (`:665-667`); `worldContainer` + zoom clamp `0.3–2.5` (`:199,288-289`); `reducedMotionEnabled` (`:589-593`).
- **`SkillTreeCanvas.tsx` / `types.ts`** — props-only canvas, `useImperativeHandle` exposes `fitToTree/zoomIn/zoomOut` only (`SkillTreeCanvas.tsx:50-54`; `types.ts:14-40`); **`focusNode` does not exist** anywhere (grep negative). `mockRenderer` in `SkillTreeCanvas.test.tsx:24-35` must gain `focusNode`.
- **`NodeTooltip.tsx`** — DOM portal overlay (`:1,18,22-30`), shows name + `{allocated}/{maxPoints} pts · {pointCost} pt/node` + effect + tags + prereqs (`:84-130`); **no** deltas/path cost; driven **only** by canvas hover/keyboard via `SkillTreeView` (`:766-794`).
- **`SkillTreeView.tsx`** — builds the 6-field `HighlightedNodes` (`EMPTY_HIGHLIGHTED` + store `glowing/dimmed` + preview + search, `:47-55,105,248-261,348-351`); owns `passiveCanvasRef` and the `fitToTree` call site (`:122,733,749`); passive canvas is `display:none` when `centerTab≠tree` (`CenterCanvas.tsx:136-143`).
- **`optimizationStore.ts`** — `HighlightedNodeIds {glowing,dimmed}` + `setHighlightedNodeIds` (`:6-9,17,56,136`); `statSheet` (`:22/82`), `previewStatSheet` (`:25/85`); `nodeEfficiencies` (`:24/84`). No focus signal.
- **`StatSheetPanel.tsx`** — `computeStatDeltas`/`StatDeltas` (`:68-132`), feature-local (extract to shared for the tooltip).

### Anti-patterns / guardrails (do not violate)

- **Canvas is props/ref-only** — no Zustand inside `SkillTreeCanvas`/`pixiRenderer` (AR-6, `architecture.md:270`). The focus signal is read in `SkillTreeView`; `focusNode` receives `nodeId` as an argument.
- **No cross-feature imports** — `optimization/` must not import from `skill-tree/`. Put `pathPointCost`/`getNodeName`/`computeStatDeltas` in `shared/utils/`.
- **No new dead/inert displayed number** — the tooltip's per-stat deltas exclude perpetual `±0` inert stats; the card's score delta + path cost are derived from produced data, never the LLM sentence or an invented field (see `## Source Audit`).
- **Compose, don't clobber** — the intensified highlight is additive over the 3.2 tier treatment; the focus/highlight edits stay additive and localized so Stories 3.4/3.5 (shared `pixiRenderer.ts`/`useSkillTree.ts`) don't conflict.
- **Reduced motion (NFR-14)** — the intensified pulse and `focusNode` pan are both new animations; gate both on `prefers-reduced-motion` (static emphasis ring; instant centering).
- **Tokens, not inline hex** (Pattern P4-8); named exports only, no barrel files, strict TS (`noUnusedLocals/Parameters`); the WebGL null-info-log patch is already at module load in `pixiRenderer.ts` — never re-inject.
- **New tickers must be torn down** in `destroy()` (+ a teardown test) — a 3.2-deferred hardening item inherited by touching this surface.

## Source Audit

Per the LEBOv2 guardrail (the Epic-1 computed/displayed-but-not-sourced defect class: penetration / stun / minion — a correct-looking UI fed by data the loader never produces). Story 3.3 surfaces several **new displayed values** (single score delta, point cost, path cost, per-stat deltas), so an audit is mandatory even though **no new `StatKey`/`StatSheet` field is introduced** (`newStatIntroduced = false`, confirmed by two independent adversarial skeptics, `agree:true` on every field). The `SuggestionResult` type carries only: `rank`, `nodeChange{fromNodeId,toNodeId,pointsChange}`, `explanation`, `deltaDamage/Survivability/Speed`, `baselineScore`, `previewScore` (`optimization.ts:45-54`) — it has **no** aggregate score delta, **no** path cost, **no** node name, **no** per-stat deltas. Element-level findings:

### Per-field sourcing (FR-19 card + FR-18 tooltip)

| Displayed field | Required by | Source (produced) | Status |
|---|---|---|---|
| Rank # | FR-19 | Rust `scoring_commands.rs:374`, Claude-echoed `claude_service.rs:51` → `useOptimizationStream.ts:129`; consumed `SuggestionCard.tsx:183/273` | **Sourced** |
| Node name | FR-19 + FR-18 | `GameNode.name` (`gameData.ts:3`) via `getNodeName` (`SuggestionsList.tsx:15-29`), terminal `?? id` fallback — cannot render empty | **Sourced (frontend-derived)** |
| Explanation | FR-19 | Claude free-text NDJSON `explanation` (`claude_service.rs:55` → `useOptimizationStream.ts:135`); rendered `SuggestionCard.tsx:298-306` | **Sourced (string)** |
| **Score delta `+4.2`** | FR-19 | **Derive** composite of `suggestion.baselineScore→previewScore` (ScoreGauge formula) — both fields produced (`useOptimizationStream.ts:136-147`, single-node) | **Sourced via frontend derivation** |
| **Point cost** | FR-19 + FR-18 | `GameNode.pointCost`/`maxPoints` (`gameData.ts:4-5`), deterministic; or `pointsChange` (`optimization.ts:42`) | **Sourced** |
| **Path cost ("N pts to reach")** | FR-19 + FR-18 | **Derive** via BFS over `GameNode.prerequisiteNodeIds` (`gameData.ts:6`) + `nodeAllocations`, summing `pointCost` (mirrors `nearestAllocatedPath.ts:13-56`) | **Sourced via frontend derivation** |
| **Per-stat deltas** | FR-18 | `computeStatDeltas(statSheet, previewStatSheet)` (`StatSheetPanel.tsx:68-132`); both full `StatSheet` in store (`optimizationStore.ts:22,25`) | **Sourced (filter inert ±0)** |

### THE DISPLAYED-BUT-NOT-SOURCED TRAP this story must avoid (flagged by both skeptics)

There **is** a tempting wrong source for the score delta and path cost: `NodeEfficiency.path_delta_score` / `effective_point_cost` (produced `scan.rs:160-166`, in `store.nodeEfficiencies` `useOptimizationStream.ts:198-199`). Reaching them requires the join `nodeEfficiencies.find(e => e.node_id === suggestion.nodeChange.toNodeId)`. **Two problems make this the defect class:**
1. **The join key is the Claude-echoed `to_node_id`** (`useOptimizationStream.ts:113→132`); Claude is only *asked* to echo it (`scoring_commands.rs:402`), never validated. A hallucinated/renamed/dropped id → `find()` returns `undefined` → the field renders **empty/NaN**.
2. **Semantic mismatch even on a hit**: `path_delta_score`/`effective_point_cost` are **full-path** quantities (allocate `max_points` on every path node, `scan.rs:260-263`), while the card's per-axis deltas + Apply are **single-node** (`useOptimizationStream.ts:117-126`). A joined `+4.2` would visually **contradict** the per-axis pills beside it.

**Mandate:** derive the score delta from `baselineScore→previewScore` and the path cost from the gameData prerequisite walk (both single-node-consistent, both immune to the echo miss). `NodeEfficiency.*` may be used only as optional corroboration, never as the displayed source. No `NodeEfficiency` schema/route field is added.

### No-dead-key check
The `node-efficiencies` channel (Rust `NodeEfficiency` → TS `statSheet.ts:125-131`) and the NDJSON suggestion payload (`claude_service.rs:60-67` → `useOptimizationStream.ts:15-21`) are **snake_case on both sides — no rename mismatch, no dead key**. The only produced-but-not-consumed-by-cards values (`path_delta_score`/`effective_point_cost`) are intentionally **not** wired (see trap above); they remain consumed by the 3.2 canvas overlay, so they are not dead.

### Verdict: **N/A — no-new-stat / no-dead-key**, with a mandated frontend-derivation + value/element test
No new `StatKey` or `StatSheet` field. Every new displayed value is presentation or frontend derivation of already-produced data. The story's source-audit obligation is met by (a) deriving score delta + path cost from single-node-consistent produced data rather than the echo-fragile `nodeEfficiencies` join, (b) filtering inert `±0` stats out of the tooltip, and (c) **value+element tests** asserting the exact composite delta and the exact path-cost integer for known fixtures (per the verification guardrail — **not** a golden count or snapshot).

### Project Structure Notes

- New pure helpers go in **`shared/utils/`** (`pathPointCost`, extracted `getNodeName`, extracted `computeStatDeltas`) — both the `optimization/` card and the `skill-tree/` tooltip consume them, and cross-feature imports are forbidden. Co-located element-level tests.
- `focusNode` is additive to `RendererInstance` + `SkillTreeCanvasHandle` + the `useImperativeHandle` + the `SkillTreeCanvas.test.tsx` mock; no new view, no router, no store schema change beyond the additive focus signal (`focusNodeId` + nonce) and (if chosen) an additive `HighlightedNodeIds` field.
- `pixiRenderer.ts` and `useSkillTree.ts` are **shared across Epic 3** (3.2/3.4/3.5) — keep the emphasis pass, the emphasis ticker, and `focusNode` additive and localized to the suggestion-highlight surface.
- No new dependencies (PixiJS 8.18.1 already in use; v8 has no native tween — hand-rolled via the existing ticker, same as 3.2's dashed line had no native dash). No web research required.

### References

- [Source: epics.md:669-687 / Epic 3, Story 3.3] — story statement + the three ACs (FR-19 card content; FR-18 hover/click intensified highlight + compact tooltip; AR-6 off-screen `focusNode`).
- [Source: prd.md:223-233] — **authoritative FR-18 + FR-19 text** (cross-highlight, compact tooltip fields = node name + point cost + path cost incl. prerequisites + per-stat delta breakdown e.g. "+22% Necrotic Damage, +8% Cast Speed"; card content fields; off-screen smooth center).
- [Source: prd.md:212-218 / FR-17] — the tier baseline that FR-18 intensifies (they compose).
- [Source: epics.md:64-65,160 / FR-18, FR-19, AR-6] — requirement-inventory + `SkillTreeCanvasHandle gains focusNode(nodeId)`.
- [Source: epics.md:271-275 / Epic 3 framing] — Owns (AR-6 partial `focusNode`) + SHARED-files note (`pixiRenderer.ts`/`useSkillTree.ts`/`buildStore.ts`).
- [Source: architecture.md:270] — `focusNode(nodeId)` smoothly pans/zooms to center; canvas props-only/ref-driven, no store access inside.
- [Source: architecture.md:474-475,525,590] — `pixiRenderer.ts` EXTENDED (FR-17 overlay + `focusNode`); `SuggestionCard.tsx` MODIFIED (FR-19 + FR-18); **no scoring-core suggestion-shape change planned**.
- [Source: architecture.md:296-302,400-402 / Pattern P4-8] — tokens `--color-accent-gold #C9A84C`, `--color-node-suggested #7B68EE`; values-only via `--color-*`, route rarity via `rarityColors.ts`.
- [Source: epics.md:144 / NFR-14] + [epics.md:197 / UX-DR12] — 2px gold focus ring, `prefers-reduced-motion` gates all animation, polite `aria-live` on the suggestion list, zero new axe violations.
- [Source: optimization.ts:33-54] — `SuggestionResult`/`NodeChange`/`BuildScore` (no aggregate delta, no point/path cost, no per-stat deltas).
- [Source: ScoreGauge.tsx + ScoreGauge.test.tsx:17-18,44-54] — composite = `round(avg of non-null axes)`; composite delta to one decimal (the score-delta formula to reuse).
- [Source: SuggestionCard.tsx:11-38,40-49,104,109-118,128-158,236-296] — DeltaPill/formatters, change badge, gated explanation, aria-label, card root (no onClick), actionable layout.
- [Source: SuggestionsList.tsx:15-29,107,127-206,208-253,320-353,483-495] — `getNodeName`, cardRefs, keyboard nav, `handleHoverEnter/Leave` (glow substrate + 4.5 preview), renderCard wiring, a11y surface.
- [Source: pixiRenderer.ts:81-87,233-252,288-289,307,339-354,394,407,447-477,589-593,595-621,659,665-667,677-725,727-738] — drawSuggested, layer z-order, zoom clamp, nodeMap, gold-pulse pattern, the glow-before-tier bug, reduced-motion, fitToTree centering, ticker teardown, getViewport, triggerFlash tween, returned handle.
- [Source: SkillTreeCanvas.tsx:50-54,120-123 + types.ts:14-40] — `useImperativeHandle` (fitToTree model), world→screen formula, handle/renderer interfaces (add `focusNode`).
- [Source: SkillTreeView.tsx:47-55,105,122,248-261,733,749,766-794 + CenterCanvas.tsx:136-143] — highlight assembly, `passiveCanvasRef`, fitToTree call site, NodeTooltip drive, passive-tab `display:none` gating.
- [Source: NodeTooltip.tsx:1,8-16,18-30,84-130 + NodeTooltip.test.tsx:21-118] — portal overlay, current prop contract + fields (extend for the compact variant; keep tests green).
- [Source: optimizationStore.ts:6-9,17,22,24,25,56,82,84,85,136] — `HighlightedNodeIds`, `statSheet`, `nodeEfficiencies`, `previewStatSheet`, setters (focus-signal precedent).
- [Source: StatSheetPanel.tsx:68-132] — `computeStatDeltas`/`StatDeltas` to extract to shared.
- [Source: nearestAllocatedPath.ts:13-56 + nearestAllocatedPath.test.ts:38-62] — pure-helper + element-level-test pattern to mirror for `pathPointCost`.
- [Source: gameData.ts:1-12] — `GameNode.pointCost/maxPoints/prerequisiteNodeIds` (point/path cost source).
- [Source: claude_service.rs:49-67 + scoring_commands.rs:50-52,363-408 + scan.rs:148-166,253-266] — suggestion NDJSON (5 fields), node-efficiencies emit, the Claude-echo `to_node_id` + full-path `path_delta_score`/`effective_point_cost` (the trap to avoid).
- [Source: deferred-work.md:300-303 + 3-2-...md:60-62,80-81,180] — inherited 3.2 defers: the `isGlowing`→tier precedence, ticker-teardown/silver-path/BFS-tie-break test hardening, shared-file caution, "preserve System-A glow as 3.3 substrate".
- [Source: project-context.md] — props-only canvas, no cross-feature imports (route via `shared/`), tokens not hex, `useReducedMotion()`, no barrels/named exports, value+element tests (no snapshots).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code `create-story` + ultracode multi-agent analysis: 6 parallel deep-read agents + 2 adversarial source-audit skeptics).

### Debug Log References

### Completion Notes List

- **All 3 ACs satisfied, all 44 subtasks complete.** `pnpm build` exit 0 (only the pre-existing >500 kB chunk advisory). `pnpm vitest` = **1230 passed / 8 failed**, the 8 being exactly the pre-existing baseline (`ProviderSelector` ×5, `Settings` ×1, `SkillTreeCanvas` ×1, `TreeControls` ×1) — **zero new failures**. Story added ~70 tests.
- **AC1 (FR-19) card content** — rank, node name, composite ΔBuildScore (`compositeDelta(baselineScore, previewScore)`, one decimal, signed), point cost + path cost (`formatCostLine` → e.g. "2 pts / 4 pts to reach"), and an **always-visible** Claude explanation. Per-axis DMG/SUR/SPD pills retained as the breakdown.
- **AC2 (FR-18) cross-highlight** — hover / whole-card click / keyboard-focus activate an **additive** emphasis (gold-soft over gold, silver over silver, suggested-purple over untreated) that **composes with** the Story 3.2 tier treatment at the node's effective (tier-scaled) radius. The 3.2-deferred precedence bug was resolved by **composing, not clobbering**: `isGlowing` removed from the mutually-exclusive base-draw chain + an additive emphasis pass + a reduced-motion-gated emphasis pulse ticker (torn down in `destroy()`). Compact `NodeTooltip` shows node name + point/path cost + per-stat deltas; synthetic/informational cards get no highlight/tooltip/focus.
- **AC3 (AR-6) focusNode** — new `SkillTreeCanvasHandle.focusNode(nodeId)` centers an off-screen node via a self-removing tween (reduced motion **jumps** to centered, not a no-op); driven by `optimizationStore.focusNodeId` + nonce read in `SkillTreeView`. Canvas stays props/ref-only — no Zustand access in `SkillTreeCanvas`/`pixiRenderer`.
- **Source Audit honored** — every new displayed value is frontend-derived from already-produced data: score delta from the ScoreGauge composite (single-node-consistent with the pills), path cost from a frontend BFS over `GameNode.prerequisiteNodeIds`, per-stat deltas from `tooltipStatDeltaEntries` (excludes perpetual ±0 inert stats). Never the echo-fragile `toNodeId→nodeEfficiencies` join.
- **ultracode adversarial self-review** (5 dimensions — AC fidelity, source-audit, render correctness, scope/regression, test quality — each finding independently verified; **0 false positives**) surfaced and **fixed 4 issues, each with a new regression test**: (1) keyboard arrow-nav left a stale `previewStatSheet` → the compact tooltip briefly showed the previous node's deltas → now cleared up-front in `activate()`; (2) hovering a **skipped** card produced a fabricated "0 pts" tooltip cost (displayed-but-not-sourced) → `onHoverEnter` now gated on `allowInteraction`; (3) the emphasis pulse layer sat above the node face/icon and veiled it → moved below the node layers (mirrors `goldPulse`), static ring still on top; (4) `focusNode` cancelled an in-flight tween *before* the on-screen early-return, so a hover→click re-fire froze the node off-centre → reordered so the centring tween finishes. A 5th finding (pre-existing cross-feature import `SuggestionsList → skill-tree/treeDataTransformer`, used by `handleApply`) was verified **out of scope** for 3.3 — not introduced or worsened here; left for opportunistic cleanup.

### File List

**New (12):**
- `lebo/src/shared/utils/scoreComposite.ts`, `scoreComposite.test.ts`
- `lebo/src/shared/utils/getNodeName.ts`, `getNodeName.test.ts`
- `lebo/src/shared/utils/pathPointCost.ts`, `pathPointCost.test.ts`
- `lebo/src/shared/utils/statDeltas.ts`, `statDeltas.test.ts`
- `lebo/src/shared/utils/formatDelta.ts`, `formatDelta.test.ts`
- `lebo/src/shared/utils/formatCost.ts`, `formatCost.test.ts`

**Modified (15):**
- `lebo/src/features/optimization/ScoreGauge.tsx`
- `lebo/src/features/optimization/SuggestionCard.tsx`, `SuggestionCard.test.tsx`
- `lebo/src/features/optimization/SuggestionsList.tsx`, `SuggestionsList.test.tsx`
- `lebo/src/features/skill-tree/pixiRenderer.ts`, `pixiRenderer.test.ts`
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx`, `SkillTreeCanvas.test.tsx`
- `lebo/src/features/skill-tree/SkillTreeView.tsx`
- `lebo/src/features/skill-tree/NodeTooltip.tsx`, `NodeTooltip.test.tsx`
- `lebo/src/features/skill-tree/types.ts`
- `lebo/src/features/stat-sheet/StatSheetPanel.tsx`
- `lebo/src/shared/stores/optimizationStore.ts`

## Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story 3.3 created (create-story + ultracode: 6 parallel deep-read agents + 2 adversarial source-audit skeptics, all Opus). Scope = FR-19 suggestion-card content + FR-18 card↔node cross-highlight/compact tooltip + AR-6 `focusNode(nodeId)`. **Source Audit verdict: N/A — no-new-stat / no-dead-key** (`newStatIntroduced=false`, both skeptics `agree:true` on every field; `SuggestionResult` carries no aggregate delta / point-or-path cost / node name / per-stat deltas). The audit's load-bearing finding: the FR-19 **score delta** + **path cost** and FR-18 **per-stat deltas** are new *displayed values* that MUST be **frontend-derived from already-produced data** — score delta = ScoreGauge composite of `baselineScore→previewScore` (single-node-consistent), path cost = BFS over `GameNode.prerequisiteNodeIds`+`pointCost`, per-stat deltas = `computeStatDeltas(statSheet, previewStatSheet)` filtered to changed non-inert fields — and **NOT** read via the `toNodeId→nodeEfficiencies` join, which is keyed on a Claude-echoed `to_node_id` (can miss → empty) and is full-path vs single-node (would contradict the per-axis pills): exactly the penetration/stun/minion displayed-but-not-sourced defect class. AC2 resolves the 3.2-deferred precedence bug by **composing, not clobbering** (remove `isGlowing` from the mutually-exclusive base-draw chain `pixiRenderer.ts:453`; additive emphasis pass at the node's effective/tier-scaled radius + a reduced-motion-gated emphasis pulse ticker cloning `goldPulseTick`, torn down in `destroy()`). AC3 adds `focusNode` to `RendererInstance`/`SkillTreeCanvasHandle`/`useImperativeHandle`, mirroring `fitToTree` centering with a `triggerFlash`-style self-removing tween — but **reduced motion JUMPS to centered** (must not copy triggerFlash's reduced-motion no-op); right-panel→canvas via a new `optimizationStore.focusNodeId`+nonce read by `SkillTreeView` (forces passive tab, calls `passiveCanvasRef.focusNode`), canvas stays store-free (AR-6). New shared pure helpers (`pathPointCost`, extracted `getNodeName`/`computeStatDeltas`) live in `shared/utils/` (no cross-feature import). Tests = value+element (exact composite delta, exact path-cost integer, glowing+tier composition — currently untested since all tier tests use `emptyHl()`, focusNode handle-forwarding + reduced-motion jump, `SkillTreeCanvas.test.tsx` mock + `NodeTooltip` compact variant). Scope boundary: 3.4 shift-click / 3.5 right-click+`NodeContextMenu` / Epic-6 FR-25 / `useSkillTree` click handling / scoring-core+Rust + `NodeEfficiency` schema + `optimization:*` emit + `run_optimization` payload all untouched; Story-4.5 hover preview IPC + `previewSuggestionRank` preview preserved. Baseline: full `pnpm vitest` must show no new failures vs ProviderSelector/Settings/SkillTreeCanvas/TreeControls (1156 passed / 8 failed). Status → ready-for-dev. |
| 2026-06-29 | Story 3.3 implemented (bmad-dev-story + ultracode). All 3 ACs + 44 subtasks complete; `pnpm build` exit 0; `pnpm vitest` **1230 passed / 8 failed** (8 = pre-existing baseline, zero new failures; ~70 tests added). FR-19 card content (rank / name / composite score delta / point+path cost / always-visible explanation); FR-18 additive cross-highlight composing with the 3.2 tier treatment + compact tooltip (precedence bug resolved by composing, not clobbering); AR-6 `focusNode(nodeId)` (reduced motion jumps) via `optimizationStore.focusNodeId`+nonce, canvas store-free. All displayed values frontend-derived per Source Audit (composite delta, BFS path cost, inert-filtered stat deltas) — not the `nodeEfficiencies` join. 6 new `shared/utils` pure helpers (`scoreComposite`, `getNodeName`, `pathPointCost`, `statDeltas`, `formatDelta`, `formatCost`). **ultracode adversarial review** (5 dimensions, per-finding verification, 0 false positives) found + fixed 4 issues, each with a regression test: stale `previewStatSheet` on keyboard nav; fabricated "0 pts" on skipped-card hover; emphasis pulse veiling the node icon; `focusNode` tween cancelled before the on-screen check. 1 pre-existing cross-feature import verified out of scope. Status → review. |
