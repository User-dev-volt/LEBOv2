# Project Intent — Last Epoch Build Optimizer

**Captured:** 2026-04-14
**Track:** BMad Method (full pipeline)
**Modules:** BMM (backbone) + GDS (game project)

---

## Product Vision

A desktop application that serves as an AI-powered build optimizer and builder for Last Epoch. Users can either create builds from scratch or paste in/load an existing build and receive AI-driven optimization suggestions with full before/after impact scoring.

---

## Target Audience

- **Primary:** Hardcore min-maxers and theory-crafters who want deep number-crunching, damage formula breakdowns, and fine-grained control over every optimization parameter
- **Skill level:** Advanced Last Epoch players who understand the game's systems but want smarter tooling than manually reading wikis and build guides
- **Pain point:** Existing tools are static planners — they don't tell you *what to change* or *why*

---

## Platform & Delivery

- **Platform:** Desktop application (Electron or Tauri)
- **Distribution:** Local install
- **Future:** Potential web version later, but desktop-first

---

## Data Sources

- **Primary:** Community-maintained Last Epoch database and APIs (lastepochtools.com data, community wikis, community-scraped game data)
- **No local game file parsing** in MVP — community data is the source of truth

---

## Core Features

### Must-Have (MVP)
1. **Class & Mastery Selector** — all classes and masteries available from day one
2. **Skill Tree Visualizer** — interactive, full-fidelity visualization of skill/passive trees for selected class
3. **Build Input** — create from scratch OR import/paste an existing build
4. **AI Optimization Engine** — analyzes current skill tree state and suggests specific node changes
5. **Optimization Goal Selector** — user specifies goal: maximize damage / maximize survivability / maximize speed / balanced
6. **Before/After Scoring System** — numeric scores across damage, survivability, and speed; each AI suggestion shows delta impact
7. **Suggestion Explanations** — AI explains *why* each change is recommended in plain but technical language
8. **Skill tree context panel** — gear, active skills, and idol slots displayed as context (not optimized by AI in MVP)

### Nice-to-Have (Post-MVP)
- Build sharing / export URLs
- Historical build versioning ("try this and compare to your current")
- Meta-tier context ("this build is similar to current S-tier meta builds")
- Idol optimization layer
- Full item/gear recommendation layer

### Explicit Exclusions (MVP)
- Local game file parsing
- Multiplayer/social features
- Monetization layer in MVP
- Mobile version

---

## Differentiation

| Feature | lastepochtools.com | Maxroll Guides | This Tool |
|---------|-------------------|---------------|-----------|
| Static build planner | ✓ | ✓ | ✓ |
| AI-driven suggestions | ✗ | ✗ | ✓ |
| Before/after scoring | ✗ | ✗ | ✓ |
| Explains *why* each change | ✗ | ✗ | ✓ |
| Optimizes for your specific build state | ✗ | ✗ | ✓ |

---

## Technical Preferences

- **App framework:** Electron or Tauri (TBD in architecture phase — Tauri preferred for performance)
- **AI layer:** Claude API (Anthropic) for optimization suggestions and explanations
- **Data:** Community Last Epoch database/API
- **Performance:** Skill tree graph rendering must be smooth and responsive — this is a core UX concern
- **No backend required initially** — desktop app can call Claude API directly

---

## Design & UX

- **Visual style:** Dark Last Epoch-inspired aesthetic (dark backgrounds, gold/amber accents, fantasy typography) with clean data visualization layered on top
- **Feel:** Polished third-party companion app — immersive but data-forward and readable
- **Reference apps:** Think a hybrid of Path of Exile's community tools (PoB) and a modern dark-mode dashboard
- **Key UX principle:** The skill tree graph is the hero element — it must be visually compelling and fully interactive

---

## Scope & Scale

- **MVP:** Complete product with all classes — no single-class limitation
- **Complexity:** High — skill tree graph rendering, AI integration, scoring engine, and game data modeling are all non-trivial
- **Recommended track:** BMad Method (full 4-phase pipeline)

---

## Domain Knowledge

- **Game:** Last Epoch by Eleventh Hour Games
- **Core systems:** Classes (Sentinel, Mage, Primalist, Acolyte, Rogue) each with 3 masteries; each mastery has a passive skill tree; active skills each have their own skill tree
- **Key data types:** Passive trees, skill trees, node connections, node effects, tags (damage types, ailments), item affixes, idols
- **Community resources:** lastepochtools.com, Last Epoch Wiki, community Discord databases
- **Comparable tools in other games:** Path of Building (PoB) for Path of Exile — the gold standard for build planners

---

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-14 | Desktop-first (Tauri/Electron) over web | User preference; better performance for graph rendering |
| 2026-04-14 | Community data over local file parsing | Simpler data pipeline for MVP |
| 2026-04-14 | All classes in MVP | No artificial scope limitation |
| 2026-04-14 | Skill trees as AI optimization core | Other components (gear, idols) shown as context only in MVP |
| 2026-04-14 | BMM + GDS modules | Game project with substantial product scope |
