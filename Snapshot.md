# LEBOv2 — Snapshot

> All state for this project lives here. Game_Save only holds a pointer to this file.
> Update this on every Wrap Up and Quick Save.

---

## Status

**Phase:** `Implementation — Epics 1-3 done, Epic 4 next`
**Health:** `At Risk → corrective actions applied 2026-07-01 (see audit)`
**Last Touched:** `2026-07-01`

---

## Current Focus

```
2026-07-01 full-project audit: verdict OFF TRACK as planned — four unowned data gaps
(passive trees 4/5 stub, affix stat semantics, skills/popular-builds, Blessings/Weaver
CBO stages) + live loadBuild data-loss bug. Corrective actions applied same day:
hotfix landed, Story 4.0 data gate added, mock-affix authorization rescinded, CI stood up.
See _bmad-output/implementation-artifacts/correct-course-2026-07-01-audit.md
```

---

## Next Action
1. ALEC DECISION: passive-tree data — author all classes vs Sentinel-first + disclosure (`correct-course-passive-trees-2026-07-01.md`)
2. Then: create-story 4.0 (affix stat-semantics data gate) via source-audit discipline

---

---

## Mental RAM

- PRD is at `_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-19/prd.md` — status: final
- UI redesign complete: `appStore.centerTab: CenterTab` (`'tree'|'gear'|'skill'|'idol'|'blessing'`) drives center canvas. SkillTreeView always mounted (display:none when inactive). Tab components in `src/features/layout/tabs/`. Right panel 340px. Keys 1-5 and [/] live.
- All 5 OQs from PRD are resolved (see `.decision-log.md`)
- Epic A (Rust scoring engine) is the most complex — 6-stage pipeline. Architecture doc should nail the module structure before stories are written
- Data ingestion prerequisite: `modifierType` annotation + affix `scope` field — NOT in current `affixes.json`. Must be sourced from lastepochtools.com DB. This is a blocking prerequisite for Epic A
- Weaver Tree is a placeholder panel (`WeaverTreePlaceholder.tsx`) — Phase 3 applies void background as CSS only. No PixiJS canvas for Weaver in Phase 3
- Claude's role in the optimizer = narrative-only. Scoring engine is 100% deterministic Rust. Claude only writes 1–3 sentence explanations of the suggestions the engine produces
- Skill role designation (Primary Offense / Secondary / Defensive / Utility) is player-set input, saved with build — feeds Gear Optimization Screen

---

## Open Loops

- [x] UI redesign: 5-tab center canvas, navigator left panel, reorganized right panel — DONE 2026-05-26
- [ ] Architecture session: Rust scoring engine module, IPC surface, data ingestion pipeline (resolved — Epics 1-4 done)
- [ ] Epic C (idol grid): needs idol grid layout data authored from lastepochtools.com/guide/section/idols
- [ ] Epic F (tree backgrounds): needs `bg_stone_tile.webp` + `bg_weaver_tile.webp` assets — check icon pipeline first, Perlin noise fallback
- [ ] Epic G (Season 4 data): `modifierType` + affix `scope` ingestion from lastepochtools.com (prerequisite for Epic A)

---

## Decision Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-05-19 | Phase 3 scope = Optimizer Brain + Gear Optimization Screen + Visual/UX Polish | Alec: "AI optimization bones are there, it just needs more magic" + "everything gets entered in" |
| 2026-05-19 | Scoring engine is Rust-side | <100ms requirement; naturally co-locates with Claude API call |
| 2026-05-19 | Claude is narrative-only; suggestions are 100% deterministic | Research: better prompt on naive score = better-sounding bad advice. Algorithm is the magic |
| 2026-05-19 | Architecture before Epics for Epic A | Rust module structure + IPC surface too vague to story without it |

---

## Session History

| Date | What I Did | Where I Left Off |
|------|------------|------------------|
| 2026-05-19 | Full Phase 3 PRD via /bmad-prd — research, discovery, all 5 OQs resolved, rubric review, finalized | PRD final; architecture next |
| 2026-05-26 | UI/UX redesign from Claude Design handoff — 5-tab center canvas (tree/gear/skill/idol/blessing), left panel as navigator, right panel reorganized (score gauge at top, 340px), keyboard shortcuts 1-5 and [/] | Story 5-4 next |
| 2026-07-01 | Full-project audit (43 agents, 30 findings confirmed, 0 refuted) → correct-course: loadBuild data-loss hotfix (+5 tests, baseline exact), Story 4.0 affix stat-semantics data gate added + mock-affix clause rescinded, Playwright AC folded into 4.5, MODELS test fixed (cargo workspace green), CI workflow + vitest-baseline ratchet added, AutoSave push path diagnosed (redirect works; manual pushes were the leak) | Alec: passive-tree decision (A: author ~460 nodes / B: Sentinel-first + disclosure) |

---

## Project Links

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/prd.md`
- **Addendum (algorithm blueprint):** `_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/addendum.md`
- **Decision Log:** `_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/.decision-log.md`
- **Audit + correct-course (2026-07-01):** `_bmad-output/implementation-artifacts/correct-course-2026-07-01-audit.md`
- **Codebase:** `lebo/` (Vite project root — pnpm)

---

## Completion Criteria

- [ ] Deterministic scoring engine live (Epic A) — passive tree efficiency overlay, build score, knapsack solver
- [ ] Gear Optimization Screen live (Epic H) — skill roles, per-slot wishlists, weakest slot, Claude narrative
- [ ] Full visual/UX polish shipped (Epics B–F) — idol grid, blessings, conditions, stat sheet, tree backgrounds
- [ ] Season 4 game data updated (Epic G)
