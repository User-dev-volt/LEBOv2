# Last Epoch Stats Reference — Research Compilation
*Compiled: 2026-05-30 for LEBOv2 Phase 4 PRD*

## Sources
- Forum: https://forum.lastepoch.com/t/stats-reference-sheet-and-opinion-gathering/81259
- Tunklab: https://lastepoch.tunklab.com/
- Community Spreadsheet (v4.4.2, April 2026): https://docs.google.com/spreadsheets/d/1DLiKBOApPtBBm5prr185HU-iYM9k28ENFgz-voXpB-4

---

## EHP Calculator Inputs (tunklab)
Defensive layers fed into EHP:
- Health, Ward, Area Level
- Base DR %, Defense Rating, Armor Rating
- Resistance % (per element)
- Endurance Threshold
- Chance-on-hit DR
- Dodge Rating, Parry Rating
- Block Effectiveness
- Glancing Blow (35% static value)

**EHP Outputs:** Average EHP · EHP vs DoTs · EHP vs 1-shots
**DR vs Hits Breakdown:** conditional — above/below endurance threshold

---

## Ward Calculator Inputs (tunklab)
- Max Health
- Ward Retention (%)
- Ward Decay Threshold
- Ward per Second (generation)
- Health Regen
- % of Current Health Lost per second
- % of Missing Health gained as Ward per second

**Ward Outputs:** Stable Ward · Stable HP

---

## Defensive Stats (forum + tunklab combined)
- Health (raw), Health Regen (%), Health Leech (%), Increased Healing Effectiveness
- Ward, Ward Retention (%), Ward Decay Threshold, Ward/sec
- Armor, Armor Mitigation (%)
- Resistances: Fire, Cold, Lightning, Void, Necrotic, Physical, Poison
- Endurance (%), Endurance Threshold
- Dodge Chance (%), Dodge Rating
- Parry Chance (%), Parry Rating
- Block Chance (%), Block Effectiveness / Mitigation (%)
- Glancing Blow (35% static on non-crit melee hits)
- Critical Avoidance (%) — community recommends 100%, 80% minimum
- Reduced Bonus Damage from Crits (%)

## Offensive Stats
- Damage types: Physical, Fire, Cold, Lightning, Void, Necrotic, Poison, Bleed, Corruption
- Increased/More per damage type + global
- Critical Strike Chance (%), Critical Strike Multiplier (%)
- Attack Speed, Cast Speed, AoE Modifier
- Penetration (elemental, physical)
- Stun Chance (%)

## Ailments
- Bleed Chance, Bleed DoT
- Ignite Chance, Ignite DoT
- Poison Chance, Poison DoT
- Freeze Rate
- Shock Chance
- Armor Shred
- Ailment Avoidance (Chill immunity, Stun immunity, Bleed immunity)

## Attributes
- Strength, Dexterity, Intelligence, Attunement
- All Attributes (combined bonus affix)
- Attribute thresholds affect secondary stats (e.g., per-40-attribute scaling affixes)

## Utility / Other
- Movement Speed (%)
- Cooldown Recovery Speed (%)
- Mana (pool), Mana Regen
- Resource-specific: Spirit, Rage, Mana (class-dependent)
- Idol Slot efficiency

## Minion
- Minion Count
- Minion Damage Multiplier
- Minion HP Multiplier
- Minion Speed

---

## Affix Coverage (tunklab — 1,112 total affixes)
Categories: Prefix / Suffix / Class-specific (per class)
Conditional mechanics: per-40-attributes scaling, on-hit buffs, on-block, on-kill triggers
Temporary buffs: Haste, Shrouds, Aegis, Frailty, Marked for Death

---

## Spreadsheet Notable Content (v4.4.2)
- Crit Chance Calculator, Mana Cost Calculator
- DPS calculators for specific skills (Lightning Blast, Frost Claw, Doom Pulse, etc.)
- Idol layout data
- LP drop chance tables
- Corruption vs XP scaling
- Legendary crafting methodology
- Weaver Imprints crafting
