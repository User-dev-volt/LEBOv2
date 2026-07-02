# Correct-Course Record — 2026-07-01 Full-Project Audit

**Trigger:** Alec asked "is the product on track — will LEBO work when the epics are done?" A 43-agent audit (7 readers → 5 gap-hunting lenses → 30 findings adversarially verified against code at HEAD, 0 refuted) answered **off track as planned**: execution quality is fine, but four data gaps and one live defect had no owning story. This record captures the corrective changes applied today and the one decision still pending.

---

## 1. Changes APPLIED 2026-07-01

### 1a. Hotfix: saved-build load data loss (audit theme C1) — DONE
`migrateBuildState` (`lebo/src/features/build-manager/buildPersistence.ts`) dropped `idolGrid`, `blessings`, `activeConditions`, `conditionValues`, and `skillRoles` in BOTH the v2 pass-through and v1→v2 branches; `useAutoSave` then re-persisted the stripped build ≈500ms after load — permanent on-disk destruction of user input on every saved-build load.

- The five fields now carry through `sharedFields` with type guards (invalid/absent → safe empty defaults matching `createBuild`).
- The two auto-create fallbacks in `buildStore.ts` (`applyNodeChange`, `fillNodeToMax`) now initialize the same fields as `createBuild` (closes the deferred-work item from the 3-1 idol review).
- +5 value-level tests in `buildPersistence.test.ts` incl. full round-trip through `JSON.stringify`/`parse`.
- Verified: `tsc` 0 errors; full `pnpm vitest` **1278 passed / 7 failed = exactly the standing baseline** (ProviderSelector×5, Settings×1, TreeControls×1), no new failures.

### 1b. Epic 4 re-scope: Story 4.0 added, mock-data authorization rescinded — DONE
Audit finding (verified at HEAD): the affix corpus has **no stat semantics** — 0/4,176 affixes carry a `statKey`, all are blanket `modifierType:"increased"`, ~86% machine-named `unnamed-*`, `itemSlots` empty on 4,171, all 2,338 unique affix refs unresolvable, 897/897 implicits empty — because `generate_item_db.py` discards source stat text. `GameData.gear_affixes` loads as an empty HashMap, so **gear contributes zero to `compute_stats` today**. The Epic 3 retro's "4.1 is a wiring job" re-cut was correct about `position` but wrong by omission about everything else.

Edits to `planning-artifacts/epics.md`:
- New **Story 4.0: Affix stat-semantics data gate (upstream re-transform)** — re-transform retaining stat text; statKey/modifierType/per-tier values/names/itemSlots; automated coverage exit gates with counts; `gear_affixes` ingestion; `gear.rs` slot-validity model; end-to-end value-level scoring parity test. Committed re-runnable script = the per-patch refresh path.
- New audit-correction callout after the Epic 3 retro callout (documents the evidence).
- 4.1's "downstream work can proceed against mock-annotated affixes" AC **rescinded**; 4.2–4.6 gated on 4.0 + 4.1 done. Epic List §4 intro + implementation notes updated to match.
- Story 4.5 gains an AC: committed Playwright (real-browser) harness exercising drag-to-equip lands with the story at the latest — jsdom cannot simulate HTML5 DnD; this is the Epic 1/Epic 3 retros' standing harness ask (third time).
- `sprint-status.yaml`: `4-0-affix-stat-semantics-data-gate: backlog` added.

### 1c. Process fixes — see §3
Applied same-day where safe (stale Rust test, CI). AutoSave push diagnosis recorded below.

---

## 2. DECISION PENDING (Alec): the passive-tree data gap
*(Proposal in `correct-course-passive-trees-2026-07-01.md` — the single biggest schedule lever found by the audit.)*

4 of 5 class passive trees are Phase-1 stubs with invented values (mage 34 / primalist 32 / rogue 32 / acolyte 32 total nodes vs sentinel 108; ~700 needed for full coverage). No FR demands passive-tree completeness → the 49/49 coverage map is structurally blind; the Phase-1 follow-up (story 1-3b) was dropped at the phase boundary. Epic 3's done optimizer fabricates suggestions for 12/15 masteries, undisclosed. FR-42 (popular builds, all 15 masteries) and Epic 7 (import of non-Sentinel characters) will collide with the stubs.

---

## 3. Audit follow-ups applied or recorded (process truth)

- **Stale `MODELS.len() == 4` test** (`openrouter_service.rs:483`): corrected to 7 — was red since the model list grew; also pre-assigned to 4.1/AR-16, done early because it kept `cargo test --workspace` red.
- **CI**: `.github/workflows/ci.yml` added — tsc + vitest (tolerating only the documented standing baseline) + cargo test on push. Previously the ONLY workflow was tag-triggered release with zero tests.
- **AutoSave publish path — full diagnosis (reflog + forensic log evidence):** the `autosave/main` redirect (added to `.gitaccount` 16:29) **works correctly** — verified live at 22:54 when an autosave pushed only `autosave/main`, leaving origin/main untouched. origin/main's raw-AutoSave tip came from two other paths: (a) four direct autosave pushes 06:44–11:49, before the redirect existed, and (b) a **manual push of main at 17:57:55** (no accompanying commit) while HEAD was the AutoSave SHA `3694cd1` — deliberate pushes publish whatever HEAD is, and HEAD on main is almost always an unreviewed `[AutoSave]` commit. **Policy consequence:** before any manual `git push`/`/gitpush` of main, land a deliberate reviewed commit first (that push then IS the fix — no history rewrite needed). Remaining hardening (proposed, not applied): `pre_commit_gate.should_gate` never fires on `lebo/src-tauri/**` or game-data resources — extend it to run `cargo test -p scoring-core` when Rust/data files changed (mind the 240s hook timeout on cold builds; the new CI covers this remotely in the meantime). Racing-writer note: a session-aware phantom edit to `Snapshot.md` was observed live ~22:40 while all 43 audit agents were read-only, then auto-committed at 22:54 (`c4d628f`) — the writer is in the Second Brain hook/watcher layer; still unidentified.

---

## 4. Recommended follow-ups NOT yet applied (ride-along during Epics 4–5)

1. Emit knapsack suggestions locally with LLM prose as enhancement, not gate (`scoring_commands.rs:100-116` — today no API key/failed call = zero suggestion cards despite the deterministic scan having run).
2. Re-point suggestion card deltas to Rust; delete deprecated `scoringEngine.ts` (architecture.md ordered it) and the dead ScoreGauge `setScores` path.
3. Schedule the BuildScore → tunklab-EHP re-baseline story (flagged in Epic 1 + Epic 3 retros; `compute/mod.rs:41-79` still ranks by legacy `effective_hp`) — before gear scoring stacks on the legacy metric.
4. Restructure Epic 5: loader multi-clause fix BEFORE any 5.1 authoring; split 5.1 into pipeline-spike + per-class tranches; 5-build popular-builds curation dry-run before sizing 5.4; name a per-patch data owner (OQ-5).
5. Epic 6 pre-story decisions: blessing-suggestion stage story or cut Blessings from FR-21/FR-25 defaults; drop/gate the Weaver scope checkbox and banner the Weaver tab as synthetic; name 5.5 an explicit Epic 6 dependency.
6. Delivery story before any release: updater points at wrong repo (404), `lebo-data` remote nonexistent, freshness errors swallowed (`.catch(() => {})`), data bundles copy first-launch-only; remove ghost `build-import-input` references; Stronghold vault password/salt are hardcoded constants (keys recoverable from a shipped binary).
