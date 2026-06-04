# Story 2.1: Design-token reconciliation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the app to adopt the Claude Design palette,
so that LEBO looks like a polished, native Last Epoch companion in one coherent re-skin.

This is the **first story of Epic 2 (UI/UX Revamp)** and the keystone of the whole epic: ADR-P4-007 / Pattern **P4-8** make the re-skin a **values-only** change. Because every component already consumes `--color-*` tokens (and all rarity/damage colors route through `rarityColors.ts`), updating values in the **single** global stylesheet re-skins the entire app at once, and stories 2.2–2.8 then rebuild component *layouts* on top of these already-correct tokens. **This story changes only color values and adds one new token — it touches no component, no layout, no logic.**

**Reality check vs. the epic AC (important — the literal AC was written against an older baseline):**

- The bg / accent / node-suggested values the AC says to "update to" are **already at their target values** in `global.css` today (Phase 3 already used the Claude gold `#C9A84C`, bg `#0A0A0B/#141417/#1C1C21/#252530`, node-suggested `#7B68EE`). For those tokens this story is **verify-and-confirm, not change**. Do **not** invent changes to make a diff appear — confirm they match and move on.
- The AC says "(adding the legendary tier)" for rarity, but **`legendary` already exists** in `rarityColors.ts` (added in Phase 3 story 6-1, value `#C62828`). So legendary is a **value update** here (`#C62828` → `#B068E8`), not an addition.
- The **only genuinely new** token is `--color-bg-sunken: #060607` (provisioned now; consumed by later Epic-2 stories).

**The defining discipline (P4-8):** never rename a `--color-*` token, never introduce an unprefixed `--*` token from the prototype, never hardcode a rarity/damage hex inline. The reconciliation lands in **`rarityColors.ts`** (the single source of truth for rarity/damage colors) and in **token *values*** in `global.css`.

## Acceptance Criteria

**AC1 — Token values reconciled to the Claude palette; `--color-bg-sunken` added; no renames (AR-9 / ADR-P4-007, UX-DR1, Pattern P4-8)**
- **Given** the global stylesheet `lebo/src/assets/styles/global.css` (Tailwind v4 CSS-first `@theme` block, no config file),
- **When** the token values are reconciled,
- **Then** the existing `--color-*` token **names are all kept** and their values equal the Claude palette: accent gold `--color-accent-gold: #C9A84C`; backgrounds `--color-bg-base: #0A0A0B` / `--color-bg-surface: #141417` / `--color-bg-elevated: #1C1C21` / `--color-bg-hover: #252530`; `--color-node-suggested: #7B68EE` (all of these are already at target — confirm, do not "fix"),
- **And** a new token **`--color-bg-sunken: #060607`** is added under the `--color-*` namespace,
- **And** **no** token is renamed and **no** unprefixed `--*` token from the prototype is introduced (P4-8). `pnpm build` (which compiles the `@theme` block) stays green.

**AC2 — Rarity colors reconciled in `rarityColors.ts` (UX-DR2, FR-7 rarity list, Pattern P4-8)**
- **Given** `lebo/src/shared/utils/rarityColors.ts`,
- **When** rarity colors are reconciled,
- **Then** `RARITY_COLORS` reflects the Claude palette: **Normal `#C6C0B5`** (the `common` key — see Dev Notes "Normal vs. common"), magic `#4A7A9E`, rare `#C9A84C`, set `#5EBD78`, unique `#D4805A`, legendary `#B068E8`,
- **And** the existing `exalted` key is **left intact** (no design value was supplied for it — see Dev Notes "Exalted"),
- **And** `getRarityColorForItemType()` continues to return the Normal color for base items and the unique color for uniques (no signature change),
- **And** all rarity/damage colors **continue to route through this utility** — no new hardcoded rarity/damage hex anywhere in the codebase (P4-8).

**AC3 — Unused `--color-rarity-*` tokens kept honest (consistency; values-only)**
- **Given** the seven `--color-rarity-*` tokens in `global.css` (currently **unused** — the live rarity colors flow through `rarityColors.ts`, not these CSS vars),
- **When** the palette is reconciled,
- **Then** their **values** are updated to match the same palette so the two definitions cannot silently disagree: `--color-rarity-common: #C6C0B5`, `--color-rarity-magic: #4A7A9E`, `--color-rarity-rare: #C9A84C`, `--color-rarity-set: #5EBD78`, `--color-rarity-unique: #D4805A`, `--color-rarity-legendary: #B068E8`; `--color-rarity-exalted` is left as-is,
- **And** **no `--color-rarity-*` token is renamed** (P4-8 forbids it — keep `--color-rarity-common`, do not introduce `--color-rarity-normal`).

**AC4 — Build stays green; tests assert the new values; zero regressions**
- **Given** the existing test baseline,
- **When** the reconciliation is applied,
- **Then** `pnpm exec tsc --noEmit` stays at exit 0 and `CI=true pnpm exec vitest run` introduces **no new failures** beyond the documented pre-existing UI baseline (`SkillTreeCanvas`/`TreeControls`/`AppHeader`/`RightPanel`/`ProviderSelector`/`Settings` — jsdom/Headless-UI/canvas environment, unrelated to this story),
- **And** `rarityColors.test.ts` is updated to assert the **new value** of every reconciled key (Normal/common `#C6C0B5`, magic `#4A7A9E`, rare `#C9A84C`, unique `#D4805A`, set `#5EBD78`, legendary `#B068E8`), the unchanged `exalted` value, the **7-entry** key count, and the updated `getRarityColorForItemType` returns (base → `#C6C0B5`, unique → `#D4805A`); the `DAMAGE_TYPE_COLORS` tests continue to pass unchanged.

## Source Audit

**Not applicable — this story introduces, computes, and surfaces NO new stat.** It changes color *values* and adds one color *token* only. It touches no game-data loader, no `scoring-core` / `compute/*` module, no `StatKey`, no `StatSheet` field, and no displayed numeric stat. The SOURCE-AUDIT GUARDRAIL's mapping-to-shipped-data requirement is therefore satisfied by this explicit no-new-stat / no-dead-key declaration, and the guardrail's "value + element assertion test" requirement (which targets prose/tag stat parsing) does not apply. The relevant verification here is **color-value assertion tests** in `rarityColors.test.ts` (AC4), which already exist and are updated to the new values.

## Tasks / Subtasks

- [ ] **Task 1 — Reconcile token values + add `--color-bg-sunken` (AC: 1, 3)** — `lebo/src/assets/styles/global.css`
  - [ ] In the `@theme` block, **confirm** (do not change unless they differ): `--color-accent-gold: #C9A84C`, `--color-bg-base: #0a0a0b`, `--color-bg-surface: #141417`, `--color-bg-elevated: #1c1c21`, `--color-bg-hover: #252530`, `--color-node-suggested: #7B68EE` already equal the Claude palette. (Hex case is irrelevant; do **not** churn lines just to uppercase them.)
  - [ ] Add `--color-bg-sunken: #060607;` in the Backgrounds group, directly after `--color-bg-hover`.
  - [ ] Update the seven (currently unused) `--color-rarity-*` token **values** to: common `#C6C0B5`, magic `#4A7A9E`, rare `#C9A84C`, set `#5EBD78`, unique `#D4805A`, legendary `#B068E8`. Leave `--color-rarity-exalted` unchanged. **Do not rename any token** (keep `--color-rarity-common`).
  - [ ] Leave `--color-accent-gold-soft` / `-dim`, all `--color-dmg-*`, `--color-data-*`, `--color-node-*`, slider/pip/text tokens untouched — they are out of this story's scope.

- [ ] **Task 2 — Reconcile `RARITY_COLORS` values (AC: 2)** — `lebo/src/shared/utils/rarityColors.ts`
  - [ ] Update `RARITY_COLORS` values only: `common: '#C6C0B5'`, `magic: '#4A7A9E'`, `rare: '#C9A84C'`, `unique: '#D4805A'`, `set: '#5EBD78'`, `legendary: '#B068E8'`. Leave `exalted: '#9C27B0'` unchanged. **Keep the existing keys** (`common`, not `normal`) — see Dev Notes.
  - [ ] Do **not** change `getRarityColorForItemType` (it reads `RARITY_COLORS.unique` / `RARITY_COLORS.common` — both keys remain) and do **not** touch `DAMAGE_TYPE_COLORS` / `getDamageTypeColor`.
  - [ ] Confirm no rarity/damage hex is hardcoded anywhere else (grep for the old hexes `#E8E8E8`, `#5B9BD5`, `#D4AF37`, `#E87722`, `#4CAF50`, `#C62828` outside this file + global.css; there should be none in `src/`).

- [ ] **Task 3 — Update color-value tests (AC: 4)** — `lebo/src/shared/utils/rarityColors.test.ts`
  - [ ] Update each `RARITY_COLORS.*` value assertion to the new hex (common `#C6C0B5`, magic `#4A7A9E`, rare `#C9A84C`, unique `#D4805A`, set `#5EBD78`, legendary `#B068E8`); keep the `exalted` `#9C27B0` assertion and the `toHaveLength(7)` count.
  - [ ] Update `getRarityColorForItemType` assertions: `'base'` → `'#C6C0B5'`, `'unique'` → `'#D4805A'`.
  - [ ] Leave the `DAMAGE_TYPE_COLORS` / `getDamageTypeColor` describe blocks unchanged.

- [ ] **Task 4 — Verify build + suite + visual (AC: 1, 4)**
  - [ ] Run `pnpm exec tsc --noEmit` (exit 0) and `CI=true pnpm exec vitest run` (no new failures vs. the documented UI baseline).
  - [ ] Run `pnpm build` to confirm the `@theme` block compiles with the new `--color-bg-sunken` token.
  - [ ] Sanity-check visually (the re-skin is automatic): the app's gold/backgrounds are unchanged (already on-palette) and a gear item's name color reflects the new rarity hex (e.g. a unique now renders `#D4805A`, not `#E87722`). `--color-bg-sunken` will not be visible until later Epic-2 stories consume it.

## Dev Notes

### Scope discipline (read first)
- **Values-only re-skin (Pattern P4-8, ADR-P4-007).** No component, layout, hook, store, or Rust change. Three files total: `global.css`, `rarityColors.ts`, `rarityColors.test.ts`. If you find yourself editing a component, stop — that work belongs to stories 2.2–2.8.
- **Single global stylesheet.** `lebo/src/assets/styles/global.css` is the Tailwind v4 entry (`@import "tailwindcss"` + `@theme`). There is no `tailwind.config.js` (CSS-first). All tokens live here.
- **Never hardcode the new hex inline; never rename a token.** Rarity/damage colors route through `rarityColors.ts`; bg/accent/etc. route through `--color-*` vars. (project-context.md: `rarityColors.ts` "always use these utilities — never hardcode rarity or damage-type hex colors inline".)

### Normal vs. `common` (key-name decision)
The design source of truth (PRD rarity filter "Any / Normal / Magic / Rare / Set / Unique / Legendary", prototype `data.js` `rarity: "normal"`, ADR-P4-007 table "normal `#C6C0B5`") all use the LE-canonical term **"Normal"**. The shipped code, however, keys this tier as **`common`** (Phase 3 story 6-1) and `getRarityColorForItemType` reads `RARITY_COLORS.common`. **Decision for this story: keep the `common` key and only update its value to `#C6C0B5`.** Rationale: (1) P4-8's "never rename" discipline; (2) renaming the key would force changes to `getRarityColorForItemType` and any item-data path that passes `'common'`, expanding a values-only story into a refactor for zero visual benefit; (3) the AC's word "normal" refers to the *rarity tier/value*, which the `#C6C0B5` value satisfies. The cosmetic key↔term mismatch is flagged to Alec below — a follow-up rename can be done deliberately if desired, but is **out of scope here**.

### Exalted
Last Epoch's real rarity ladder is Normal / Magic / Rare / **Exalted** / Unique / Set / Legendary. The shipped code already has an `exalted` key (`#9C27B0`); the prototype mock data and the ADR-P4-007 table simply don't enumerate it (the prototype's mock items never use it). **Keep `exalted` intact** — removing it would drop a legitimate LE tier and could break any future/real item data tagged `exalted`. No new design value was supplied, so its value stays `#9C27B0`. Flagged to Alec below.

### The unused `--color-rarity-*` tokens (why AC3 exists)
`global.css` defines `--color-rarity-common … --color-rarity-legendary`, but **nothing in `src/` consumes them** — the live rarity colors come from `rarityColors.ts` (hardcoded hex), while `DAMAGE_TYPE_COLORS` *does* use `var(--color-dmg-*)`. Leaving the `--color-rarity-*` values stale would create a latent two-sources-of-truth trap (a future component that grabs `var(--color-rarity-unique)` would get the old `#E87722`). AC3 updates their **values** (not names) so the palette stays internally coherent. This is values-only and P4-8-compliant.

### What's already correct (don't "fix")
Current `global.css` already has `--color-accent-gold: #C9A84C`, `--color-bg-base: #0a0a0b`, `-surface: #141417`, `-elevated: #1c1c21`, `-hover: #252530`, `--color-node-suggested: #7B68EE`. These equal the AR-9 targets. Confirm and leave them; the only net-new token is `--color-bg-sunken`.

### Old → new value map (for reference)
| Token / key | Old | New |
|---|---|---|
| `RARITY_COLORS.common` / `--color-rarity-common` | `#E8E8E8` | `#C6C0B5` |
| `RARITY_COLORS.magic` / `--color-rarity-magic` | `#5B9BD5` | `#4A7A9E` |
| `RARITY_COLORS.rare` / `--color-rarity-rare` | `#D4AF37` | `#C9A84C` |
| `RARITY_COLORS.set` / `--color-rarity-set` | `#4CAF50` | `#5EBD78` |
| `RARITY_COLORS.unique` / `--color-rarity-unique` | `#E87722` | `#D4805A` |
| `RARITY_COLORS.legendary` / `--color-rarity-legendary` | `#C62828` | `#B068E8` |
| `RARITY_COLORS.exalted` / `--color-rarity-exalted` | `#9C27B0` | _(unchanged)_ |
| `--color-bg-sunken` | _(absent)_ | `#060607` _(NEW)_ |

### Out of scope (do NOT touch here)
- The deferred `necrotic` `DAMAGE_TYPE_COLORS` key (deferred-work.md, stories 1.2/1.6) — that's a damage-type gap reachable only when per-type damage rows go live; not part of this re-skin.
- `--color-accent-gold-soft` / `-dim`, all `--color-dmg-*`, `--color-data-*`, `--color-node-allocated/available/locked`, slider/pip/badge/text tokens.
- Any component layout (header, panels, tab bar, blessing/idol editors, status bar) — those are stories 2.2–2.8.

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). No separate config; do not duplicate the four `test-setup.ts` stubs.
- Co-located test only: `rarityColors.test.ts` next to `rarityColors.ts`. Explicit `expect` assertions, no snapshots.
- **CSS `@theme` tokens are not unit-testable** in jsdom (the stylesheet/`@theme` is a build-time construct, not parsed by jsdom). Verify `--color-bg-sunken` and the `--color-rarity-*` value updates via `pnpm build` (compiles) + visual sanity, not a unit test. The unit-testable surface here is `rarityColors.ts` (AC4).

### Project Structure Notes
- All three target files are inside `LEBOv2/lebo/src` — Phase 2 active tree, write freely. The `_bmad-output/last-epoch-build-optimizer-UI-Handoff/` prototype (`styles.css`, `data.js`) is **read-only reference** for the palette; never wire the prototype JSX/CSS into the app (ADR-P4-007: "faithful recreation, not a wrapping of the prototype").
- No naming-convention variance: `rarityColors.ts` is `camelCase.ts` (utility), `global.css` is the established stylesheet path.

### References
- [Source: epics.md#Story 2.1: Design-token reconciliation] — ACs, UX-DR1/UX-DR2.
- [Source: architecture.md#ADR-P4-007 — Design-Token Reconciliation] — AR-9 token table (line 294–300): bg-sunken `#060607`, rarity palette, "keep names, update values, no rename".
- [Source: architecture.md#Pattern P4-8 — Token reconciliation is values-only] — never rename `--color-*`, never introduce unprefixed `--*`, route rarity/damage through `rarityColors.ts`.
- [Source: project-context.md#Tailwind v4] — CSS-first, no config, `rarityColors.ts` is the rarity/damage color utility (never hardcode inline).
- [Source: lebo/src/assets/styles/global.css:19-84] — current `@theme` block (bg/accent/node/rarity tokens).
- [Source: lebo/src/shared/utils/rarityColors.ts] — current `RARITY_COLORS` + `getRarityColorForItemType`.
- [Source: lebo/src/shared/utils/rarityColors.test.ts] — current value/count assertions to update.
- [Source: prds/prd-LEBOv2-2026-05-29/prd.md:320] — rarity filter "Any / Normal / Magic / Rare / Set / Unique / Legendary".

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
