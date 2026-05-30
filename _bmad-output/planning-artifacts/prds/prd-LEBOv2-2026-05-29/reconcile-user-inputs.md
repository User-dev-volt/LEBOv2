# Reconciliation: User Inputs vs PRD Draft

_Generated 2026-05-30. Each gap is a user-stated requirement that is absent or ambiguously addressed in the PRD._

---

## INPUT 1 — Phase 4 Feature List

**GAP 1 — "Evade" as distinct stat**
User listed "evade" separately from dodge. The PRD covers Dodge Rating vs Dodge Chance (FR-5) but never addresses whether "Evade" is a distinct game mechanic (separate avoidance layer) or an alias. No open question captures this; OQ-1 covers Parry but not Evade. Add to Open Questions.

**GAP 2 — Life Steal as a computed stat**
FR-5's sustain layer 1 lists "Health Leech" but user specifically called out "life steal." In Last Epoch these may differ (leech = % on hit returned over time; life steal = instant). The PRD merges them as "Health Leech" without confirming coverage of both variants. No FR explicitly validates the distinction.

**GAP 3 — Affix Picker shows prefix vs suffix grouping**
User said "when picking Affixes and suffixes I want to see the Affixes and suffixes so I can see what ones to add." FR-28 groups by Offense/Defense/Utility only. Open Question OQ-2 notes the prefix/suffix discriminator is unresolved at the data level, but FR-28's display spec never commits to showing prefix vs suffix as a visible grouping in the modal UI even once the data field is resolved.

**GAP 4 — Gear browser scroll + icon display in builder (not just Gear Optimization screen)**
User said "I want to see the gear and pick from a display of all icons and tooltips... scroll through the gear within search." FR-27 (Item Picker Modal) covers icon grid + search, but FR-27 is scoped to "clicking an empty gear slot or Swap item." The Gear Optimization screen (FR-30) adds a separate gear database center column. It is unclear whether the icon-grid scroll experience described by the user is satisfied by FR-30 alone or whether FR-27 also needs a scroll-through browsing mode beyond the filter+search pattern. PRD does not confirm scrollable icon-grid browsing is a design requirement in both contexts.

**GAP 5 — Idol system interactivity: size-aware picker menu**
User said the idol system should "know the size as you select it from a picker menu." FR-38 (Idol Tray) describes shape visualizations and a placement preview overlay but does not explicitly require that the tray entry communicate the idol's grid footprint in a way that constrains valid placement cells before selection. The "live placement preview" language implies it, but it is not stated as a functional requirement — an implementer could ship the tray without size-aware placement filtering.

---

## INPUT 2 — Clarifications

All five clarification items (completeness gates, popular builds source, skills suggestion, orb animation as separate tab, Phase 5 non-goals) are fully reflected in the PRD (FR-20–26, §5 Non-Goals). No gaps found.

---

## INPUT 3 — Stats and UX Additions

**GAP 6 — "Evade" stat identity (duplicate flag from Input 1)**
See GAP 1. Raised again here because user explicitly listed it as a "new" stat alongside Parry and Glancing Blow, suggesting it is not merely a synonym for Dodge in their mental model.

**GAP 7 — Ward Decay Threshold display distinction**
FR-5 lists "Ward Decay Threshold" as a stat. FR-7 (Stable Ward computation) uses it. However no FR specifies how Ward Decay Threshold is displayed relative to Ward/sec or Stable Ward on the Defense tab — e.g., whether it shows as an absolute HP value, a percentage, or both. The tunklab methodology makes this distinction meaningful; the PRD leaves it implicit.

**GAP 8 — Affix tooltip/description in Affix Picker (not just range)**
User: "Affix tooltip/description needed in picker (not just range)." FR-28 specifies "name, category tag, and stat range across all tiers (min–max with unit)" but does not include a description field (e.g., "Increased Fire Damage — adds to the Increased damage pool for Fire hits"). For affixes like ailment chance or conditional modifiers, the raw number without a description is ambiguous. No FR captures a description/flavor field in the Affix Picker row.

---

## Summary Table

| # | Input | Gap | FR Affected |
|---|-------|-----|-------------|
| 1 | Input 1 | "Evade" as distinct stat not resolved | FR-5 + new OQ |
| 2 | Input 1 | Life Steal vs Health Leech distinction | FR-5 |
| 3 | Input 1 | Prefix/suffix visible grouping in Affix Picker UI | FR-28 |
| 4 | Input 1 | Icon-grid scroll browsing coverage in both FR-27 and FR-30 | FR-27, FR-30 |
| 5 | Input 1 | Idol size-aware picker: placement cell filtering before selection | FR-38 |
| 6 | Input 3 | Ward Decay Threshold display format not specified | FR-5, FR-7 |
| 7 | Input 3 | Affix description field missing from Affix Picker spec | FR-28 |
