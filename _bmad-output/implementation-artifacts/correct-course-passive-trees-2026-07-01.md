# Correct-Course Proposal — Passive-Tree Data Completeness (DECISION REQUIRED)

**Status:** awaiting Alec's decision · **Raised:** 2026-07-01 full-project audit · **Owner:** unassigned until decided

## The problem

4 of 5 class passive trees are Phase-1 placeholder stubs with **invented node effects**:

| Class | Nodes shipped (base + mastery) | Real game (approx.) |
|-------|-------------------------------|---------------------|
| Sentinel | 108 (15 + 31×3) | ~113–140 |
| Mage | 34 (8 + 26) | ~130+ |
| Primalist | 32 (8 + 24) | ~130+ |
| Rogue | 32 (8 + 24) | ~130+ |
| Acolyte | 32 (8 + 24) | ~130+ |

(Counted live from `lebo/src-tauri/resources/game-data/classes/*.json` — the same files both the canvas and the Rust scoring loader read.)

Consequences while this stands:
- The **done** Epic 3 passive optimizer produces knapsack suggestions from fabricated 8-node mastery stubs for **12 of 15 masteries** — plausible-looking, game-meaningless, undisclosed in the UI.
- NFR-1 (±2% tunklab stat parity) is unachievable for any non-Sentinel passive build.
- FR-42 (Popular Builds: ≥3 builds × **15 masteries**) will reference nodes that don't exist in our data.
- Epic 7 offline import of any non-Sentinel character will fail to resolve nearly every passive node ID (FR-48's unresolved-ID summary becomes the whole tree).

Why the plan never caught it: **no FR demands passive-tree data completeness**, so the "49/49 FRs covered" map is structurally blind to it. The Phase 1 pipeline story (1-3b) shipped the stubs "per MVP scope" and mandated "a tracked follow-up task" that was never created; the Snapshot-era "Epic G: Season 4 data" scope silently shrank across the phase boundary.

## Option A — Author the missing trees (full product)

Add a per-class data-gate story set (mirrors the Epic 4 data-gate pattern), sequenced **before Epic 6** (whose CBO and popular-builds features span all masteries):

- 5.0a–5.0d: author mage / primalist / rogue / acolyte trees (~460 nodes total) from lastepochtools.com, using the 1-3b extraction conventions; per-class coverage exit gates (node count vs source, spot-check value parity on N sampled nodes); loader multi-clause fix (deferred-work) lands FIRST so authored multi-stat nodes parse.
- Estimated effort: the ~238 existing nodes were "a multi-hour manual task" per 1-3b — realistically **1–2 weeks of data curation** for ~460 nodes plus verification. No code velocity applies.
- Schedule impact: working-product date moves toward the audit's 3-month bound.

**Choose A if:** LEBO's promise ("the definitive build tool", UJ-1 is literally a *Rogue* user journey) is the point, and Epic 6/7 should work for every class.

## Option B — Descope to Sentinel-first, disclose in-app (fast, honest)

- Formal PRD/epics amendment: Phase 4 optimizes **Sentinel** end-to-end; other classes are "data preview" status.
- In-app disclosure story (small): per-class `dataCompleteness` flag in the game-data manifest, surfaced in the class selector + StatusBar/staleness bar ("Mage tree: preview data — optimizer disabled/flagged"), optimizer either disabled or watermarked for stub classes. The `WeaverTreePlaceholder` pattern is precedent.
- FR-42 and Epic 6 scope-notes amended to Sentinel (+later classes as data lands); Epic 7 import warns on non-Sentinel.
- Schedule impact: working-Sentinel-product inside ~6 weeks per the audit projection; other classes become explicitly-tracked post-Phase-4 data tranches.

**Choose B if:** shipping a *trustworthy* optimizer soon matters more than class breadth, and you'd rather label the gap than silently ship it.

## Recommendation

**B now, A as scheduled follow-on tranches.** The audit's core lesson is that undisclosed fabricated data is the product's biggest trust risk — disclosure converts a silent defect into a roadmap item. Authoring all four trees before Epic 4/6 would stall the pillar work behind weeks of curation; doing it per-class *after* the Epic 4 data gate proves the refresh pipeline lets each class light up as its data lands (and the class selector disclosure makes progress visible in-product).

## Decision

- [ ] Option A — author all trees before Epic 6
- [ ] Option B — Sentinel-first + disclosure story, trees as follow-on tranches
- [ ] Other: ______

*(Record the decision here and in sprint-status.yaml; whichever option is chosen needs its stories created via create-story with the source-audit discipline.)*
