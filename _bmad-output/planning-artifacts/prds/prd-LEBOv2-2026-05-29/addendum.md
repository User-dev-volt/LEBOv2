# PRD Addendum — LEBOv2 Phase 4
*Technical and design depth that informs architecture/epics but does not belong in the PRD itself.*

---

## A. ModifierSource Data Structure (for architecture)

The `scoring-core` crate needs a `ModifierSource` type alongside every `Modifier`. Suggested shape:

```rust
pub struct ModifierSource {
    pub source_type: SourceType,   // enum: PassiveNode, GearSlot, Idol, Blessing, SkillNode, Condition
    pub source_label: String,      // human-readable: "Shadow Cascade", "Helm — Fire Resistance T5"
    pub value: f64,                // contribution amount (before aggregation)
    pub modifier_type: ModifierType, // Flat / Increased / More
}
```

The `compute_stats` IPC response gains: `stat_sources: HashMap<String, Vec<ModifierSource>>` where the key is the `StatKey` string. This is additive — the aggregated stat value is unchanged, sources are metadata.

Performance note: Source tracking is a Vec append per modifier consumed. For typical builds (~200-400 modifiers), this is negligible. Do not run source tracking in hot-loop scoring paths (knapsack DP); only the final build-state `compute_stats` call needs sources.

---

## B. EHP / Ward Methodology Notes

Phase 3 used a simplified EHP formula. Phase 4 aligns with tunklab's methodology:

**EHP vs Hits:** `HP × (1/(1 - armor_dr)) × (1/(1 - resistance_dr)) × (1/(1 - endurance_dr)) × (1/(1 - dodge_chance × effective_dodge_dr)) × ...`

Each layer applies multiplicatively. The tunklab calculator outputs three values:
- **Average EHP:** weighted average across expected hit distribution
- **EHP vs DoTs:** excludes Dodge, Parry, Block (DoTs bypass avoidance)
- **EHP vs 1-shots:** uses endurance threshold as a hard floor; hits above threshold bypass endurance reduction

**Ward equilibrium (Stable Ward):**
`Stable Ward = (Ward/sec + HP_regen_to_ward_conversion) / Ward_decay_rate`
Where `Ward_decay_rate = (1 - Ward_Retention) × decay_function(current_ward, decay_threshold)`

The tunklab Ward calculator inputs are the ground truth — architecture should implement the calculator's observable behavior (same inputs → same Stable Ward output) rather than deriving the formula independently.

---

## C. Popular Builds Database Schema

```json
{
  "version": "season-4",
  "builds": [
    {
      "mastery": "Lich",
      "name": "Bone Curse Lich",
      "source": "maxroll.gg/last-epoch/planner/...",
      "skills": ["rip_blood", "bone_curse", "transplant", "marrow_shards", "soul_feast"],
      "tags": ["necrotic", "dot", "caster"]
    }
  ]
}
```

Minimum: 3 builds per mastery × 15 masteries = 45 entries. Source curation from maxroll.gg/lastepochtools.com builds section; should be reviewed per Season patch for accuracy.

Matching logic for FR-23: filter by `mastery` exact match, then sort by count of `skills` overlap with the build's already-assigned skills. Return top 3 matches.

---

## D. Optimization Orb — Design Implementation

**Confirmed CSS-based** (from `CompleteOptimizer.jsx` in the Claude Design handoff). The orb is an overlay (`orb-overlay` full-screen div) containing:

- `orb-stage` — relative-positioned container, 280px
- `orb-ring` — two concentric CSS rings (280px outer, 200px inner) with gold border animation
- `orb-core` — central gold glowing circle
- `orb-token` — one per checked section; positioned via `transform: translate(x, y)` on a circle of radius 130px. When `absorbed` (step > token index), transitions to `translate(0,0) scale(0.4)` — shrinks into the core. Each token shows the section icon + label.
- `orb-status` — text block beneath with phrase, sub-text ("Analyzing N sections · X%"), and a progress bar fill

Phrase sequence (canonical from code):
1. "Ingesting build state…"
2. "Evaluating passive efficiency…"
3. "Scoring gear upgrade paths…"
4. "Cross-referencing idol affixes…"
5. "Weighing blessing timelines…"
6. "Assembling narrative…"

Timing: one token absorbed per 620ms interval. Total animation ~= (N sections + 2) × 620ms before results render.

---

## E. Deferred-Work Items Elevated to Phase 4

The following items from `_bmad-output/implementation-artifacts/deferred-work.md` are directly relevant to Phase 4 features and should be addressed as part of the relevant epics (not as standalone cleanup):

- `affix prefix/suffix discriminator` — required for FR-28 (Affix Picker prefix/suffix display) and gear scoring engine
- `warningGap === 0 triggers warning UI` — fix in the stat engine as part of FR-5/FR-6
- `All gear affixes classified as prefixes` — fix in the serializer as part of the affix discriminator work
- `modifier_type: Option<String>` in Rust — replace with serde enum as part of FR-1 (Complete Stats Engine)
- `GearSlotRanking / WishlistAffix not re-exported from lib.rs` — fix during Epic 5 gear scoring work
- `stale MODELS.len() == 4 Rust test` — fix during any Rust work that touches openrouter_service.rs

---

## F. Stat Sheet Tab Structure (Final)

Five tabs per Claude Design (General, Offense, Defense, Minion, Other):

**General:** Class, Mastery, Level, Passive Points (spent/available), Idol Cells Used, Skill Slots, Attributes (Str/Dex/Int/Att)

**Offense:** Build Score, Damage Score (per type), Avg Hit, Avg Hit (crit-weighted), Crit Chance, Crit Multi, Attack Speed, Cast Speed, AoE Modifier, Penetration (per type), Stun Chance, Ailment Chances (Bleed/Ignite/Poison/Freeze/Shock)

**Defense:** Effective HP (vs Hits / vs DoTs / vs 1-shots), HP, Stable Ward, Ward Retention, Armor, Endurance (% + threshold), Fire/Cold/Lightning/Void/Necrotic/Physical/Poison Res, Dodge, Parry, Block, Glancing Blow, Crit Avoidance, Reduced Crit Bonus, Ailment Avoidance

**Minion:** (hidden if no minion skills) Minion Count, Minion Damage Multi, Minion HP Multi, Minion Speed

**Other:** Survivability Score, Speed Score, Move Speed, Cooldown Recovery, Mana (pool + regen), Health Regen, Life Leech, Ward/sec, Increased Healing Effectiveness, Resource-specific stats
