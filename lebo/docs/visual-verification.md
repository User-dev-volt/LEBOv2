# Visual Verification Loop (Epic 2 — UI/UX Revamp)

Epic 1 was math, so "flagged for the reviewer to confirm in-app" was survivable. Epic 2 is a
visual re-skin to the Claude Design handoff — a rebuild verified only in jsdom is verified
**nowhere**. This is the before/after screenshot loop the team committed to in the Epic 1 retro:
render the rebuilt screen, render the handoff target, and diff them by eye until they match.

## The two sides of the diff

| Side | What it is | How to render |
|------|-----------|---------------|
| **Candidate** | Our rebuilt React app | `pnpm dev` (Vite, port **1420**) → Playwright navigate `http://localhost:1420` |
| **Target** | The Claude Design handoff prototype | Serve `_bmad-output/last-epoch-build-optimizer-UI-Handoff/` → Playwright navigate `LEBO.html` |

The handoff is a self-contained React-via-Babel prototype (`LEBO.html` + `styles.css` + per-screen
JSX: `LeftPanel.jsx`, `RightPanel.jsx`, `PassiveTree.jsx`, `GearEditor.jsx`, `IdolEditor.jsx`,
`BlessingWeaver.jsx`, `SkillEditor.jsx`, `CompleteOptimizer.jsx`, `GearOptScreen.jsx`,
`SettingsScreen.jsx`). It pulls React/Babel from unpkg, so it must be **served over HTTP**, not
opened via `file://` (local script loads are CORS-blocked under `file://`).

There are also 13 ready-made captures in `…/UI-Handoff/screenshots/` — use these as the target
where they cover a screen (orb sequence, CBO, import), and render the prototype for everything else.

## Running the loop

### 1. Start both servers (background)
```powershell
# Candidate — our app (Vite dev server, port 1420)
pnpm --dir lebo dev

# Target — handoff prototype (any static server; pick an unused port)
npx serve -l 4321 _bmad-output/last-epoch-build-optimizer-UI-Handoff
```

### 2. Capture with the Playwright MCP — NOT a project install
There is no `@playwright/test` dependency; use the Playwright **MCP tools** (`browser_navigate`,
`browser_take_screenshot`). Honor the project's Playwright rules (also in CLAUDE.md):

- **Never** call `page.goto()` inside `browser_run_code` — it orphans the page context and hangs.
  Navigation is always a separate `browser_navigate` call.
- The skill-tree canvas is **PixiJS/WebGL** — `browser_snapshot` (a11y tree) is useless for it.
  Use `browser_take_screenshot` for all visual inspection.
- The WebGL `getShaderInfoLog` null patch is already in `pixiRenderer.ts`. Never re-inject it.

Per screen:
1. `browser_navigate` → candidate URL (`http://localhost:1420`, route to the screen)
2. `browser_take_screenshot` → save as `candidate-<screen>.png`
3. `browser_navigate` → target URL (`http://localhost:4321/LEBO.html`, route to the same screen)
4. `browser_take_screenshot` → save as `target-<screen>.png`
5. Compare side by side. A rebuilt screen is **not "done" until it visually reconciles with its
   handoff target** — layout, spacing, the dark-stone/gold-typography/class-glyph aesthetic, and
   the design tokens from story 2-1.

### 3. Resize to the real window
The app ships at desktop sizes. `browser_resize` to a representative window (e.g. 1440×900) before
screenshotting so panel widths match (left 260px, right 340px, center flex — see project-context).

## Screen → reference map

| App screen | Candidate route | Handoff reference |
|------------|-----------------|-------------------|
| Main shell (header, left/right panels, center) | `/` (main view) | `LEBO.html` default + `LeftPanel.jsx` / `RightPanel.jsx` |
| Passive tree canvas | main, tree tab | `PassiveTree.jsx` |
| Gear editor | center gear tab | `GearEditor.jsx` |
| Idol editor | center idol tab | `IdolEditor.jsx` |
| Blessing grid / weaver | center blessing tab | `BlessingWeaver.jsx` |
| Skill editor | center skill tab | `SkillEditor.jsx` |
| Complete Build Optimizer + orb | CBO view | `CompleteOptimizer.jsx` + `screenshots/01-orbseq.png`…`03-orbseq.png`, `cbo.png`, `orbnow.png` |
| Gear optimization | gear-optimization view | `GearOptScreen.jsx` |
| Settings | settings view | `SettingsScreen.jsx` |
| Character import | import modal | `screenshots/01-import.png`, `import2.png` |

## Acceptance use (story 2-1 and beyond)
Story 2-1 (design-token reconciliation) re-skins everything from one stylesheet — its acceptance
reference is the handoff render above. Each subsequent Epic 2 story owns one screen rebuild; the
candidate↔target diff for that screen is part of its definition of done. Also reconcile the two
carried token deferrals here: the `--color-dmg-necrotic` token and `DAMAGE_TYPE_COLORS['necrotic']`.
