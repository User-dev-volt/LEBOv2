# Sprint Change Proposal — 2026-06-03

**Project:** LEBOv2 (Phase 4 — Complete Build Tool)
**Author:** Alec (via Correct Course workflow)
**Change scope:** Moderate (backlog addition — one new story)
**Status:** Approved

---

## Section 1 — Issue Summary

**Problem statement.** During the creation of **Story 1.5 — Ailment, attribute, and minion stats**, the source audit revealed that **correct minion stats (FR-10) cannot be delivered in Story 1.5**, blocked by two prerequisites that do not yet exist:

1. **The engine is structurally blind to the dominant minion-scaling source.** `BuildSnapshot.skill_node_allocations` (`build_snapshot.rs:42`) is deserialized but **never consumed** — `build_registry` (`compute/mod.rs:72-140`) iterates only passive `node_allocations`, idols, blessings, and gear. In Last Epoch, the majority of minion count/HP/damage comes from the **skill specialization tree**, which therefore reaches no stat. Wiring skill allocations into the registry is a non-trivial new engine capability.
2. **Reliable minion-skill detection needs Epic 5's skill database.** `GameData` loads skill *tree nodes*, not skill *definitions/tags* (FR-40, Epic 5), so "is this slot a minion skill?" cannot be answered cleanly today.

Additionally, minion **HP/Speed** are currently **conflated into player `MaxHp`/`AttackSpeed`** by `tags_to_stat_key` (the `MINION` short-circuit only covers minion *damage*). De-conflating them is a deliberate score re-baseline, not a safe side effect.

**Discovery context.** Found during the Story 1.5 data-source audit (the same audit discipline that caught the Story 1.2 computed-but-unsourced trap). Recorded as a **Decision** in `_bmad-output/implementation-artifacts/1-5-ailment-attribute-and-minion-stats.md`.

**Evidence.** `skill_node_allocations` appears only twice in the Tauri/scoring-core source — its `BuildSnapshot` field declaration and a loader comment explicitly excluding skill allocations from the passive scan — and nowhere in `build_registry`. The audit table in Story 1.5 documents minion damage as the only sourced minion stat; HP/Speed conflated; count unsourced.

---

## Section 2 — Impact Analysis

- **Epic impact.** No existing epic is invalidated. **Epic 1** remains complete-as-scoped; **Story 1.5 is unchanged** (ships minion *damage* real, count/HP/speed honest-`0.0`, with `MinionStats` + TS mirror + `Some`/`None` plumbing in place as the foundation). The new work depends on **Epic 5** (skill DB) plus a new skill-allocations→registry capability, so it must sequence **after Epic 5**.
- **Story impact.** One new story added: **Story 5.5 — Minion stat correctness**. No existing story modified.
- **Artifact conflicts.** PRD: none (FR-10 already exists; this completes it). Architecture: the skill-allocations→registry wiring is a **new general engine capability** (worth noting; not a conflict). UX: none — the Minion-tab layout/hiding is Story 1.6; Story 5.5 only fills values.
- **Technical impact / risk to flag.** Scope item (a), wiring `skill_node_allocations` into the registry, is a **general** capability: once landed, skill-tree allocations contribute to **all** stats (damage, EHP, speed, …) for any build with skill allocations — a broader score re-baseline than minions alone. Story 5.5's AC1 calls this out so it is sized and gated deliberately (re-baseline of `effective_hp_*` / `build_score_slider_*` / `ehp_reference` + optimizer/gear-scoring revalidation).

---

## Section 3 — Recommended Approach

**Selected: Option 1 — Direct Adjustment (add one story).** Effort: Low (planning); Risk: Low.
Options 2 (rollback) and 3 (MVP review) are N/A — nothing is reverted and MVP scope is unchanged; this completes already-committed FR-10 at the point where it is actually achievable.

**Placement rationale.** Per the recorded decision ("a late Epic-5 story or folded into Epic 6"), the story is appended as **Story 5.5**, physically after Epic 5's stories and before Epic 6, satisfying the "after Epic 5" dependency while keeping it adjacent to the skill-data work it relies on.

**Considered alternative:** splitting the registry-wiring (item a) into its own foundational story. Kept as one story for now (per direction); flagged in-story so it can be split at sizing time if the re-baseline scope warrants.

---

## Section 4 — Detailed Change Proposals

### 4.1 `epics.md` — new Story 5.5 (appended after Story 5.4, before the Epic 6 header)

```markdown
### Story 5.5: Minion stat correctness (skill-tree wiring + de-conflation)

As a theory-crafting player with a minion build,
I want minion Count, HP, and Speed computed correctly from all real sources,
So that the Minion tab reflects my actual minion power, not just minion damage.

**Context:** Completes FR-10, deferred from Story 1.5 (see its Decision section). Story 1.5
shipped `minion_damage_multi` real and `MinionStats`/TS mirror/`Some`-`None` plumbing in place;
count/HP/speed surfaced honest-`0.0` to preserve the frozen player `effective_hp`/speed parity
gate. This story fills those values once its prerequisites land. Depends on Epic 5 (skill DB)
and the skill-allocations→registry capability delivered in AC1.

**Acceptance Criteria:**

**Given** `BuildSnapshot.skill_node_allocations` (today deserialized but consumed nowhere)
**When** `build_registry` runs
**Then** skill-specialization-tree node effects contribute modifiers to the registry, so
skill-tree scaling reaches the stat engine (AC1).
**And** this is recognized as a general re-baseline: skill-tree allocations now feed ALL stats
(damage_score, effective_hp, speed, etc.) for any build with skill allocations — the change is
made deliberately with the `effective_hp_*`/`build_score_slider_*`/`ehp_reference` gates
re-baselined and the optimizer/gear-scoring outputs revalidated.

**Given** minion Health/Attack-Speed nodes currently mapped to player `MaxHp`/`AttackSpeed`
**When** `tags_to_stat_key` is updated
**Then** `MINION`+`HEALTH` → `IncreasedMinionHp` and `MINION`+`ATTACK_SPEED` → a minion-speed key
are matched before the player branches, de-conflating minion HP/Speed off player stats; the
player-HP/speed re-baseline and the `GOLDEN_EFFECT_COUNT` change are deliberate and documented
(the Necrotic-split precedent).

**Given** all minion sources (passives, skill spec trees, uniques, idols)
**When** `compute_minion` runs
**Then** `minion_count`, `minion_damage_multi`, `minion_hp_multi`, and `minion_speed` are computed
from real sourced values (no dead keys); minion count is sourced from spec trees / uniques / idols.

**Given** Epic 5's skill database (skill tags/metadata)
**When** minion-skill presence is evaluated
**Then** Story 1.5's interim signal (`primary_offense_delivery_type == "minion"` ∨ any minion
modifier) is replaced with real per-skill minion metadata, so `StatSheet.minion` is `Some(..)`
exactly when ≥1 assigned skill is a minion skill (FR-10).
```

### 4.2 `epics.md` — FR Coverage Map row updated

```
OLD: | FR-10 | Epic 1 | Minion stats + conditional Minion tab |
NEW: | FR-10 | Epic 1 (+ Epic 5 Story 5.5) | Minion stats + conditional Minion tab; full correctness (count/HP/speed, skill-tree wiring) completed post–Epic-5 in Story 5.5 |
```

### 4.3 `sprint-status.yaml` — new story entry under Epic 5

```yaml
  5-4-popular-builds-database-with-client-side-matching: backlog
  5-5-minion-stat-correctness: backlog        # ← added
  epic-5-retrospective: optional
```

Epic 5 status stays `backlog`; no renumbering of existing stories.

---

## Section 5 — Implementation Handoff

- **Scope classification:** Moderate (backlog addition; no code now).
- **Recipients / responsibilities:**
  - **Product Owner / Dev (now):** backlog entry created (this proposal) — no further action until Epic 5 nears completion.
  - **Dev (later):** when Epic 5 is done and the skill DB exists, run `create-story` on `5-5-minion-stat-correctness`, then `dev-story`. The story's AC1 re-baseline must be sized deliberately (consider splitting the registry-wiring into its own foundational story at that point if warranted).
- **Success criteria:** Story 5.5 created and `dev-story`-implemented after Epic 5; minion Count/HP/Speed compute from real sources; player `effective_hp`/speed re-baseline performed deliberately with all parity gates updated and revalidated; Story 1.5's interim minion-skill signal replaced with Epic-5 metadata.

---

## Artifacts Modified

- `_bmad-output/planning-artifacts/epics.md` — added Story 5.5; updated FR-10 coverage row.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — added `5-5-minion-stat-correctness: backlog`.
- `_bmad-output/implementation-artifacts/1-5-ailment-attribute-and-minion-stats.md` — Decision section already records the deferral + follow-up spec (prior to this proposal).
