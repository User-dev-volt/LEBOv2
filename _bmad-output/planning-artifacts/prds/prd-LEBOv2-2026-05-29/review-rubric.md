# PRD Quality Review — LEBOv2 Phase 4

**Reviewer:** Claude Code (Sonnet 4.6)
**Reviewed:** prd.md + addendum.md
**Date:** 2026-05-30
**Verdict:** READY WITH MINOR FIXES

---

## Dimension Scores

| Dimension | Score | Notes |
|-----------|-------|-------|
| Decision-Readiness | 4/5 | FRs are specific and testable; one ambiguity in FR-32 |
| Substance | 5/5 | Capabilities/behaviors well-stated; Consequences blocks are meaningful; [ASSUMPTION] tags present |
| Strategic Coherence | 5/5 | Vision → features are tightly coupled; non-goals match phase boundary; SMs map to FRs cleanly |
| Completeness | 4/5 | Two minor journey gaps; one undefined term |
| Downstream Readiness | 4/5 | 6 OQs well-scoped; addendum gives architecture what it needs; one structural gap |

---

## Findings

### Finding 1 — MINOR: FR-32 "no hallucinated items" is a consequence, not a testable gate

FR-32 states "Recommendations include only items that exist in the gear database (no hallucinated items)" as a prose sentence with no Consequences block and no SM tied to it. For a LLM-backed feature this is a real constraint that needs a testable enforcement mechanism. The architecture team needs to know: is the Claude payload restricted to a named item list, or does the frontend validate results against the database before rendering?

**Fix:** Add a Consequences block to FR-32 stating how hallucination is prevented (e.g., "The optimization prompt includes only item IDs from the gear database; the frontend validates all returned item references against the database and silently drops invalid ones"). Add SM-8 to verify zero hallucinated items appear in a 10-run smoke test.

---

### Finding 2 — MINOR: UJ-1 hover behavior has no defined dismissal state for touch/keyboard navigation

UJ-1 and FR-13 specify tooltip-on-hover and "dismisses on mouse-leave." The app is desktop-only (Tauri), but keyboard navigation is plausible (stat sheet is in a panel). No keyboard path to the breakdown tooltip is defined. This is low risk given the sole-developer context but leaves a gap if the architect routes stat sheet navigation through keyboard.

**Fix:** Add a one-line note to FR-13: "Keyboard: tooltip also activates on focus of a stat row and dismisses on blur."

---

### Finding 3 — MINOR: §6.2 defers "attribute-to-secondary-stat full conversion" without defining what IS included

FR-9 says attributes are tracked and feed secondary stat calculations "where the game specifies the conversion." §6.2 defers "full conversion tables." The gap between these two statements is undefined — the architecture team cannot determine what attribute-to-secondary work is in scope for Phase 4 vs deferred. This is already flagged as an [ASSUMPTION] but the assumption is too vague to act on.

**Fix:** Add a concrete example to FR-9 (e.g., "Attunement → Ward/sec on caster builds is in scope; full attribute-to-resistance, attribute-to-crit conversion tables are out of scope per §6.2"). Alternatively, add OQ-7 asking the architect to enumerate the in-scope conversions.

---

### Finding 4 — MINOR: "Stable HP at equilibrium" in FR-7 is undefined in the Glossary

FR-7 references "Stable HP at equilibrium" as a displayed value alongside Stable Ward. This term is not in the Glossary (§3) and is not explained in the addendum. For a build without Ward, the concept is unclear — is it just Health + Health Regen at steady state, or does it involve leech?

**Fix:** Add "Stable HP" to the Glossary: "Health pool adjusted for steady-state Health Regen and Health Leech, shown on the Defense tab for non-Ward builds as a counterpart to Stable Ward."

---

### Finding 5 — OBSERVATION (no fix required): Addendum Appendix E deferred-work list is authoritative but risks being missed

The deferred-work elevations in Appendix E (affix prefix/suffix discriminator, modifier_type serde enum, etc.) are important for epics scoping — they must be bundled into the relevant epics or they'll be missed. The PRD body does not reference Appendix E at all. The epics writer may not read the addendum as carefully as the PRD.

**Recommendation:** Add a sentence to §0 (Document Purpose): "The addendum (addendum.md) is a required companion document; Appendix E lists Phase 3 deferred items that must be bundled into Phase 4 epics."

---

## What is Working Well

- **FR specificity is excellent.** Every FR has testable Consequences or a direct SM. The FR-17 node visualization table (gold/silver/dim tiers with exact scale factors and animation cycles) is the right level of detail for a PixiJS implementation.
- **Glossary is comprehensive.** All domain terms used in FRs are defined. Modifier/ModifierSource/Stat Source Breakdown chain is airtight.
- **Open Questions are genuinely open.** OQ-1 (Parry player accessibility), OQ-2 (prefix/suffix structure), OQ-3 (orb rendering stack), OQ-6 (idol AI token budget) are all architectural decisions that cannot be resolved from the PRD alone.
- **Non-goals are phase-precise.** Each non-goal names the phase it is deferred to (Phase 5), making scope boundaries unambiguous.
- **Counter-metrics SM-C1 and SM-C2 are a standout.** Explicitly bounding animation delay and IPC overhead prevents the architecture from over-engineering the attribution feature.

---

## Required Changes Before Architecture Session

| Priority | Finding | Action |
|----------|---------|--------|
| Should-fix | Finding 1 | Add FR-32 Consequences + SM-8 for hallucination prevention |
| Should-fix | Finding 3 | Clarify FR-9 in-scope vs deferred attribute conversions |
| Should-fix | Finding 4 | Add "Stable HP" to Glossary §3 |
| Nice-to-fix | Finding 2 | Add keyboard path to FR-13 |
| Nice-to-fix | Finding 5 | Cross-reference addendum Appendix E in §0 |

None of these block the architecture session — an architect can make reasonable assumptions for all five. But items 1 and 3 carry the most ambiguity risk for the epics writer.
