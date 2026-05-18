# Story 1.3a: Game Data Source Research Spike

Status: done

## Story

As an advanced Last Epoch player,
I want confidence that the app has a reliable, compliant source of Last Epoch game data,
So that skill tree and node data is accurate and the team can commit to building the data pipeline.

**⚠️ SPIKE STORY — time-boxed to 2–3 days. Output is documentation only; no implementation code is produced. All subsequent game data implementation (Story 1.3b) is blocked until this spike is complete.**

## Acceptance Criteria

1. **Given** the research spike is executed **When** the spike is complete **Then** `docs/game-data-source.md` exists and documents: the chosen community data source, its URL, the data format spec (JSON structure, field names, node ID scheme), update frequency, and terms-of-service compliance assessment

2. **Given** a viable compliant source is found **When** the spike concludes **Then** `docs/game-data-source.md` includes the maximum passive tree node count for any single class/mastery (required to scope the PixiJS spike mock data in Story 1.2) **And** the document confirms whether idol, gear, and active skill data are available in the same source (required for Stories 3.1, 4.1, 4.2)

3. **Given** no viable compliant source is found **When** the spike concludes **Then** `docs/game-data-source.md` documents the gap and the chosen fallback path: (a) scraper with explicit ToS approval from site operator, (b) community contributors for a manually curated dataset, or (c) scope reduction to one class as proof-of-concept — with a go/no-go decision from the team before Story 1.3b begins

## Tasks / Subtasks

- [x] Task 1: Research lastepochtools.com for API endpoints, data format, and ToS (AC: 1, 2)
  - [x] Identify any public API endpoints or data endpoints
  - [x] Document data format spec (JSON structure, field names, node ID scheme)
  - [x] Document update frequency and staleness indicators
  - [x] Review terms of service for rate limits, attribution requirements, redistribution restrictions

- [x] Task 2: Research community GitHub repositories for Last Epoch game data (AC: 1, 2)
  - [x] Search for community-maintained Last Epoch data repositories
  - [x] Assess data completeness (all 5 classes, all 15 masteries, skill trees)
  - [x] Review license terms for redistribution/embedding in a desktop app

- [x] Task 3: Identify maximum passive tree node counts and data availability (AC: 2)
  - [x] Document maximum passive tree node count for any single class/mastery
  - [x] Confirm availability of: idol data, gear/affix data, active skill data

- [x] Task 4: Select source and determine fallback strategy (AC: 1, 2, 3)
  - [x] Make go/no-go decision on chosen primary source
  - [x] Define fallback path if primary source is unavailable
  - [x] Document bundled offline fallback strategy

- [x] Task 5: Write `docs/game-data-source.md` (AC: 1, 2, 3)
  - [x] Complete source documentation with all required fields
  - [x] Include data format spec, node schema, and implementation guidance for Story 1.3b

### Review Findings

- [x] [Review][Decision] x,y coordinate mitigation — resolved: use algorithmic layout (radial/layered from connection graph topology, same approach as mockTreeData.ts); positions are approximate until EHG releases coordinate data [`docs/game-data-source.md`]
- [x] [Review][Decision] `effects` per-point scaling — resolved: store per-point description text + `maxPoints`; scoring engine multiplies by allocation count [`docs/game-data-source.md`]
- [x] [Review][Decision] Node ID scheme unstable — resolved: use slug-based IDs `{class}_{tree_type}_{node_name_slug}` — stable across patch additions, human-readable [`docs/game-data-source.md`]
- [x] [Review][Patch] `connections[]` on node schema redundantly duplicates `edges[]` — removed; `edges[]` is authoritative [`docs/game-data-source.md`]
- [x] [Review][Patch] AC2 gap: idol/gear/active skill data availability not explicitly confirmed — added explicit Y/N table [`docs/game-data-source.md`]
- [x] [Review][Patch] `skill_id` naming convention undefined — defined as `{skill_name_slug}` (kebab-case, globally unique within Last Epoch) [`docs/game-data-source.md`]
- [x] [Review][Patch] AC1 gap: update frequency not documented — added EHG patch cadence note [`docs/game-data-source.md`]
- [x] [Review][Patch] Base+mastery tree coordinate space and cross-tree edges not described — added combination rendering note [`docs/game-data-source.md`]
- [x] [Review][Patch] `dataVersion` vs `gameVersion` semantics undefined — added definitions [`docs/game-data-source.md`]
- [x] [Review][Defer] Remote URL for `check_data_freshness()` — no community service hosts a version manifest yet; Story 1.7 will define this — deferred, pre-existing
- [x] [Review][Defer] `classId: string` can't represent multi-class skills — MVP scope; all Last Epoch active skills are class-specific — deferred, pre-existing
- [x] [Review][Defer] Skill-to-mastery eligibility mapping — Story 1.6 scope, not 1.3a/b — deferred, pre-existing
- [x] [Review][Defer] Idol/gear schema for Epic 4 — Story 4 spike scope — deferred, pre-existing

## Dev Notes

### Scope

**This is documentation-only.** No Rust, TypeScript, or migration files are produced. The sole output is `docs/game-data-source.md`.

### Sources to Evaluate

- lastepochtools.com API and/or data endpoints
- Community GitHub repositories (Last Epoch Modding community, community Discord data bots)
- Community-maintained JSON exports

### ToS Compliance Checklist

For each source: rate limits, attribution requirements, restrictions on redistribution, commercial use terms.

### This Spike Gates

Story 1.3b, Story 1.4, Story 1.5, Story 2.1, Story 3.1, Story 3.2, Story 4.1

### Story 1.2 Retrospective Note

PixiJS spike was benchmarked with 800 nodes. If actual passive tree node counts exceed 800, the benchmark should be flagged for re-run (though Story 1.2 already passed at 800 — assess real counts here).

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_none_

### Completion Notes List

- **GO decision reached.** No public EHG API exists (partner-only, confirmed May 2025). No complete, licensed community data repo exists.
- **Chosen strategy:** Manually curated static JSON bundle (seeded from community pages). MIT-licensed LastEpochPlanner (Musholic) usable as derivative reference.
- **Key insight — node counts are small:** ~47 passive nodes per mastery, ~29 nodes per skill tree, ~192 nodes for a typical build view. PixiJS 800-node benchmark provides >4× margin — no re-run needed.
- **Critical gap identified:** Node position coordinates (x, y) are NOT available from any machine-readable source. Story 1.3b must either reconstruct positions from tree screenshots or derive them algorithmically from the connection graph. This is the primary manual effort for the data authoring step.
- **Full data format spec, directory layout, and implementation guidance** are documented in `docs/game-data-source.md`.
- **Blockers for Story 1.3b:** None. All required decisions are made. Story 1.3b can begin immediately.

### File List

- `docs/game-data-source.md` (new)

## Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Story file created and completed. Research spike executed: 5 sources evaluated, curated static JSON bundle chosen, full data format spec written. `docs/game-data-source.md` produced. Status → review. |
