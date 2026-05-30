# PRD Quality Review — LEBOv2 Phase 3

**Reviewer:** Claude Code (automated rubric pass)
**Reviewed:** 2026-05-19
**Artifacts reviewed:** `prd.md`, `addendum.md`, `.decision-log.md`, Phase 2 archive (`architecture.md`)

---

## Overall verdict

The PRD has a sharp thesis and the Functional Requirements are among the most concrete and algorithmically precise seen in a solo-dev product document. The two largest risks are (1) a silent contradiction between the decision log ("scoring engine is Rust-side") and the PRD/addendum (which never state this, leaving architecture to guess), and (2) an FR ID collision (two FR-A19s) plus an OQ-2 discrepancy between the PRD and the decision log that will cause downstream confusion during story creation. Once those mechanical issues are corrected, this document is effectively implementation-ready.

---

## 1. Decision-readiness — strong

The PRD names trade-offs honestly: deterministic engine over better prompting, narrative-only Claude role, Phase 3 vs. Phase 4 scoping of item recommendations and idol optimization. The open questions that remain (OQ-3 through OQ-5) are correctly flagged with owners and timing gates. The counter-metric (suggestions per session should not increase without quality improvement) is a rare and valuable honesty signal.

### Findings

- **high** OQ-2 state contradiction (§Open Questions vs. `.decision-log.md`) — The PRD marks OQ-2 as "RESOLVED (partial)" but the decision log's Open Items table still lists OQ-2 as open: "Is skill damage delivery type (melee/ranged/spell/element) in game data JSON? Blocking for FR-A19/A20 and Epic H affix scoring." The addendum's final note (§E) contradicts OQ-1 resolution: "The `modifierType` annotation is not present in current community data sources — this is a LEBO-maintained annotation layer." This directly contradicts the PRD's §Open Questions resolution of OQ-1 ("Modifier type data is available via lastepochtools.com"). One of these is wrong and a story author implementing Epic A/G will build on a false assumption. *Fix:* Reconcile OQ-1 and OQ-2 explicitly. The addendum §E position ("LEBO-maintained annotation layer") and the PRD OQ-1 resolution ("ingestion task from community DB") cannot both be true. Pick one, strike the other, and add a clear note in FR-A6 / FR-G2.

- **medium** Scoring engine language/location never stated in PRD (§Functional Requirements, NFR-1) — The decision log records that the scoring engine is Rust-side (performance rationale: <100ms, co-located with Claude API call). The PRD never states this. A story developer starting from the PRD alone could implement the scoring engine in TypeScript (which the addendum pseudocode implicitly suggests). *Fix:* Add one sentence in the NFR-1 or in section A intro: "The scoring engine runs in the Rust backend via a Tauri command, consistent with the existing architecture constraint that all compute-intensive and API operations live in `src-tauri/`."

---

## 2. Substance over theater — strong

The user journeys earn their keep: UJ-1 gives a specific passive node with exact point cost and damage delta; UJ-2 shows the exact resistance values and how the UI responds. These are testable acceptance scenarios, not persona theater. The Executive Summary's three "Transformation" labels are concrete, not marketing filler — each maps directly to an FR group. The Success Metrics table is specific (exact hex colors, exact latency bounds, zero false-positive target). No generic NFR boilerplate or interchangeable vision statements found.

### Findings

- **low** FR-A13 mastery depth multiplier lacks a rationale anchor (§A.3) — The 1.2x multiplier for mastery depth 7–10 is stated without justification. A developer implementing this must trust it without being able to validate it. The addendum repeats the formula but also doesn't explain it. This is acceptable for a solo dev who set the value deliberately, but it is the one arbitrary magic number without a "why." *Fix:* Add a parenthetical "(validated against PoB's power-report heatmap pattern, where LE mastery nodes at depth 7–10 are empirically the highest-value cluster)" or similar. One sentence is enough.

---

## 3. Strategic coherence — strong

The thesis is explicit and tight: the scoring engine is the asset, Claude is the interface. Every major feature serves it: the stat sheet validates the engine output in real time; idols/blessings/conditions feed the engine accurate inputs; the gear optimizer surfaces the engine's affix scorer; the Season 4 update ensures the engine uses correct game state. The overlay and Gear Optimization screen are output surfaces for the engine. The success metrics (latency, zero false positives, expert agreement) directly test whether the thesis holds.

The Expansion Readiness section (Paradox Classes) is a well-placed forward-looking constraint that has a corresponding NFR-5 — it is not orphaned strategy text.

### Findings

No findings. Coherence is the document's strongest dimension.

---

## 4. Done-ness clarity — adequate

Most FRs are precise: formula definitions with variable names, exact color hex values, specific latency bounds, named UI behaviors. However, several FRs in sections F (Visual & UX Polish) and H (Gear Optimization) use qualitative language that leaves implementation ambiguous.

### Findings

- **high** FR-F5 uses "appropriate" and "if unavailable" without definition (§F.3) — "Each active skill tree canvas renders a distinct background appropriate to that skill's damage archetype or class." What triggers "appropriate"? Which backgrounds map to which archetypes? How many skill archetypes exist? "If a generic skill-tree background is used where archetype detection is unavailable, a neutral dark fallback applies" — what is "archetype detection unavailable"? A developer implementing this cannot know when to fall back. *Fix:* Either enumerate the archetype-to-background mapping (fire=warm ember tone, cold=crystalline, void=purple, physical=stone, etc.) or explicitly defer to the UX design doc ("see UX spec §tree-backgrounds for asset list and trigger conditions"). As written, this FR will produce inconsistent results.

- **medium** FR-H7 "73% of ideal" efficiency display is undefined (§H.3) — The FR requires showing "Weapon: 73% of ideal" but `current_efficiency = current_score / ideal_score` from the addendum's pseudocode is defined only in terms of `upgrade_score`. A slot with a correct unique equipped (FR-H8: "flagged as correct — keep") would show what percentage? Zero gap would be 100%, but that may not render correctly with the "keep" flag applied simultaneously. *Fix:* Specify the formula and the display rule for the unique-item exception case in the FR text, or add a note cross-referencing the addendum's pseudocode explicitly.

- **medium** FR-E3 "shown only when relevant passives or skills are active" has no threshold (§E) — "Is enemy Hexed?" appears only for builds with hex application. What counts as "has hex application"? Is it detecting specific skill tags, specific node names, or is it a game-data field? Without a data hook this is unimplementable. *Fix:* Specify the detection mechanism: "A condition is shown when any active skill or allocated node has the `tag: 'hex'` attribute in game data" or equivalent.

- **medium** FR-C2 "verifying it fits within the grid's valid placement rules" (§C) — FR-C2 says the player can place an idol by selecting size and "verifying it fits" — but OQ-3 says the idol grid layout data may not exist yet. FR-C2 as written implies the placement rules are already encoded. This is a false premise if OQ-3 resolves negatively. *Fix:* Add a conditional: "Implementation is gated on OQ-3 resolution. If layout data is not available from the community source, layout rules are hardcoded from in-game observation as a fallback."

- **low** FR-A12 "3–5x scoring weight multiplier" range without interpolation rule (§A.3) — The range is specified in the FR text, and the addendum gives the interpolation formula `scaled by (1 + increased_pct / 200)`. The addendum formula is the authoritative spec but it is not in the FR. The FR text alone ("3–5x") is ambiguous. *Fix:* Either move the formula into the FR or add an explicit cross-reference: "See addendum §A, Stage 2 for interpolation formula."

---

## 5. Scope honesty — strong

The Out of Scope section is specific, complete, and consistently deferred to a named Phase 4 (not just "future work"). Every deferred item has a reason. ASSUMPTION coverage is adequate: OQ-3 through OQ-5 are correctly flagged. The decision log records why each in-scope item was included. The counter-metric is an explicit honesty mechanism against feature creep in suggestion volume.

### Findings

- **medium** Armour is missing from the defensive floor check (§A.2, FR-A7) — FR-A7 defines three defensive floor checks (resistances, crit avoidance, sustain). The addendum's defense layer reference (§D) lists Armour as a separate layer with non-linear DR. Armour is not included in the floor check. This could be intentional (armour value is harder to define a hard floor for) but it is not noted as a deliberate omission. A developer might assume it is an oversight. *Fix:* Add a note in FR-A7: "Armour is not part of the defensive floor check — its non-linear DR makes a hard threshold inappropriate. It is included in EHP calculations but not as a Critical-priority floor gate."

- **low** Dodge is in the defence layer reference (addendum §D) but absent from stat sheet FR-B4 (§B) — FR-B4 lists dodge chance % as a displayed stat but the scoring model in §A.3 and the defensive floor check in §A.2 make no reference to dodge. The addendum gives a dodge EHP formula. It is unclear whether dodge feeds SurvivabilityScore or is display-only. *Fix:* Clarify in FR-B4 or FR-A3 whether dodge contributes to SurvivabilityScore. If yes, add it to the formula. If display-only for now, note that explicitly.

---

## 6. Downstream usability — adequate

FR IDs are mostly contiguous and follow a logical grouping pattern. The user journeys map cleanly to features (UJ-1→A+F, UJ-2→A.2+B+H, UJ-3→C+A.7). Section letters (A through H) correspond to logical epics. The addendum correctly separates implementation blueprints from requirements. Terminology is mostly consistent (BuildScore, DamageScore, SurvivabilityScore, UpgradeScore all appear in both PRD and addendum with matching names).

### Findings

- **critical** Duplicate FR-A19 (§A.5 and §A.6) — FR-A19 is assigned to two different requirements: (1) the skill damage delivery/element type zero-weighting rule (§A.5, gear affix scorer), and (2) the zero-value passive allocation detection (§A.6, synergy detector). Any story, epic, or architecture decision that references FR-A19 is ambiguous. *Fix:* Renumber §A.6's FR-A19 to FR-A22, then renumber FR-A22→FR-A25 forward by one (FR-A22→FR-A23, FR-A23→FR-A24, FR-A24→FR-A25, FR-A25→FR-A26, FR-A26→FR-A27, FR-A27→FR-A28). Update all cross-references.

- **high** FR-A6 and FR-G2 are partially redundant without a clear owner split (§A.1, §G) — FR-A6 requires `modifierType` on every node/affix. FR-G2 repeats this requirement in the context of Season 4 data. Both say the same thing. A story author assigning implementation will not know if this is one task (data engineering, assign once) or two tasks (annotate S4 data separately from existing data). *Fix:* Make FR-A6 the normative requirement ("all game data, including S4 data, must include `modifierType`") and make FR-G2 a cross-reference only: "Season 4 data satisfies FR-A6 — see FR-A6 for annotation specification."

- **medium** The Gear Optimization screen section (H) lacks a clear "screen type" declaration (§H intro) — The intro paragraph says it is "a dedicated view (accessible via the app header, alongside the main build view and settings)." But there is no FR for the view itself — how it is navigated to, how it is dismissed, whether it is a modal, a full-screen replacement, or a panel. Story creation will need to infer this from the intro paragraph. *Fix:* Add FR-H0: "The Gear Optimization screen is a full-page view, switchable via the app header using the same `appStore.currentView` mechanism as the main build view and settings view."

- **low** Section letter G (Season 4 Data) sits after Section F (Visual Polish) but is a prerequisite for Section A (Scoring Engine) — A developer executing stories in section order would implement Section A before Section G, but Section A requires G's `modifierType` annotation to be complete first (FR-A6 / FR-G2). The section ordering implies the wrong implementation sequence. *Fix:* Either reorder (G before A, or G before F), or add an explicit prerequisite note at the top of Section A: "Epic A depends on Epic G (Season 4 data update with `modifierType` annotation) being complete first."

---

## 7. Shape fit — strong

The PRD is appropriately sized for a brownfield desktop companion app with a solo dev/PM. It does not have stakeholder sign-off rituals, persona empathy maps, or accessibility boilerplate beyond what is specific to the product. The algorithm detail that would be overkill in a consumer PRD is correct here because the scoring engine is the product's core differentiator — getting it right matters. Separating that depth into an addendum is the right call. The decision log is a mature addition for a solo developer whose "handoff" is to future-self — it prevents reasoning drift.

The user journeys are the right length: long enough to be testable, short enough to stay readable. The success metrics are measurable by one person. The Out of Scope section is a genuine project management tool, not theater.

### Findings

- **low** The "Target users" paragraph (§Executive Summary) reads more like a product brief note than PRD content — for a solo developer who knows the audience deeply, this adds no decision value. It could be cut without loss. This is a minor shape observation, not a defect.

---

## Mechanical notes

**FR ID continuity:**
- FR-A19 is duplicated — see critical finding in §6 above.
- FR numbering within sections is not globally unique (FR-A1 through FR-A27, FR-B1 through FR-B8, etc.). This is acceptable for downstream story creation as long as section prefix is always included. Stories should reference "FR-A7" not "FR-7."

**OQ-1 / OQ-2 discrepancy:**
- PRD §Open Questions: OQ-1 resolved (community DB source), OQ-2 resolved partial.
- Decision log Open Items: OQ-2 still open ("blocking for FR-A19/A20").
- Addendum §E: Contradicts OQ-1 resolution by saying `modifierType` is "not present in current community data sources."
- These three documents disagree. One resolution session is needed before Epic A/G story creation begins.

**Cross-reference completeness:**
- FR-A12 references a 3–5x range; the addendum has the formula. No cross-reference in the FR. Add one.
- FR-H7 efficiency display references addendum pseudocode implicitly. Add an explicit pointer.
- FR-G2 duplicates FR-A6. Collapse to a cross-reference.

**Glossary drift:**
- "scoring engine" and "optimization engine" are used interchangeably (e.g., "scoring engine" in §NFR-1, "optimization engine" in §C FR-C7, §E FR-E4). Pick one term and use it throughout. Recommend "scoring engine" (it is more precise — the engine scores, Claude optimizes in the narrative sense).
- "Game-Changer" suggestion tier appears in FR-A21 and FR-H15 with matching meaning — consistent. Good.
- "ideal" configuration (FR-A17, FR-H7, FR-H9) is used consistently. Good.

**ASSUMPTION tag usage:**
- OQ-3, OQ-4, OQ-5 are correctly flagged with owners and timing gates. No orphaned assumptions found.
- The Armour omission from the defensive floor check is an untagged assumption (see §5 finding). Needs a note.
