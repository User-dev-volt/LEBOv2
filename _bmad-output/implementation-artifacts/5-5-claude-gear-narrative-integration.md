---
title: 'Claude Gear Narrative Integration'
story_id: '5.5'
story_key: '5-5-claude-gear-narrative-integration'
epic: 5
status: ready-for-dev
created: '2026-05-26'
---

## Story

**As a player,**
I want Claude to generate a personalized gear narrative that references my Primary Offense skill by name, identifies my weakest slot with specific delta values, surfaces Game-Changer unique item recommendations, and calls out my slider-driven archetype priorities,
**so that** the gear narrative feels tailored to my specific build rather than generic boilerplate.

---

## Context

This is Story 5.5 — the final story in Epic 5 (Gear Optimization Screen). All prior Epic 5 stories are done:

- **5.1** — skill role designation, `BuildState.skillRoles`, `SkillRoleDesignator.tsx`
- **5.2** — `run_gear_scoring()` pure Rust engine in `scoring-core/src/gear.rs`
- **5.3** — `run_gear_scoring` Tauri command, `useGearStream.ts`, `gear:analysis-complete` / `gear:error` events, `BuildSnapshot.skillRoles` / `primaryOffenseDeliveryType`
- **5.4** — `GearSlotRankingList.tsx` and `GearOptimizationView.tsx` display layer

**What this story adds:**

1. `primary_offense_skill_name: Option<String>` field in `BuildSnapshot` (Rust `build_snapshot.rs` + TS `buildSnapshotSerializer.ts`)
2. `run_gear_scoring` extended: after emitting `gear:analysis-complete`, also runs `compute_stats` + `run_synergy_detection` (for game-changer flags), assembles a narrative payload, and calls `stream_gear_narrative()`
3. `stream_gear_narrative()` in both `claude_service.rs` and `openrouter_service.rs` — streams free-form prose as `gear:narrative-chunk` events, ends with `gear:narrative-complete`
4. `GEAR_NARRATIVE_SYSTEM_PROMPT` in `prompts.rs`
5. `assemble_gear_narrative_payload()` in `scoring_commands.rs`
6. `optimizationStore`: `gearNarrative: string | null`, `isGeneratingNarrative: boolean`, plus setters
7. `useGearStream.ts`: new listeners for `gear:narrative-chunk`, `gear:narrative-complete`, `gear:narrative-error`; `startGearAnalysis()` clears previous narrative on each call
8. `GearNarrativePanel.tsx` — new props-only component: loading state + streaming text display
9. `GearNarrativePanel.test.tsx` — unit tests
10. `GearOptimizationView.tsx` — integrates `GearNarrativePanel` below `GearSlotRankingList`

**What this story does NOT do:**
- Change the `gear:analysis-complete` event shape — `GearAnalysis` struct is unchanged
- Add any new Tauri command — `run_gear_scoring` is extended, not replaced
- Change the `optimization:*` event namespace (Pattern 6: gear events stay in `gear:` namespace)
- Add game-changer info to the `GearAnalysis` TypeScript type — flags are used only server-side to assemble the narrative prompt

---

## Acceptance Criteria

**AC1 — Skill name in narrative (primary offense):**
**Given** a Poison Bladedancer with "Poison Eruption" as Primary Offense and a crit-less Amulet
**When** Claude generates the gear narrative
**Then** the narrative names "Poison Eruption" at least once and identifies the Amulet by slot name
**And** the narrative includes specific delta values from the engine (e.g., "+22% average damage" from a T5 crit prefix)

**AC2 — Game-Changer unique item surfaced:**
**Given** a build where equipping Exsanguinous would be a Game-Changer (>30% BuildScore increase)
**When** Claude generates the gear narrative
**Then** Exsanguinous is explicitly surfaced as a "Game-Changer" recommendation
**And** the narrative includes the specific stat threshold needed and how close the build currently is

**AC3 — Slider-driven archetype priorities:**
**Given** the slider set to full Glass Cannon position (0)
**When** Claude generates the gear narrative
**Then** the narrative includes text stating that offensive affixes are prioritized
**And** notes that shifting toward Juggernaut would elevate Hybrid Health and Endurance Threshold to the top of every slot

**AC4 — Streaming loading state:**
**Given** the gear narrative is being generated
**When** the player views the Gear Optimization screen
**Then** a loading state is shown while Claude generates (before any text arrives)
**And** narrative text appears progressively as Claude streams it (chunks appended to existing text)

**AC5 — Narrative appears below slot ranking list:**
**Given** `gearAnalysis` is non-null AND narrative generation is complete or in progress
**When** the Gear Optimization screen renders
**Then** the narrative panel appears below `GearSlotRankingList`
**And** the panel is NOT shown before any gear analysis has run (pre-analysis state)

**AC6 — Narrative cleared on re-analysis:**
**Given** a completed gear narrative is displayed
**When** the player clicks "Analyze Gear" again
**Then** the previous narrative is cleared immediately when the new analysis starts
**And** a fresh loading state is shown for the new narrative

**AC7 — TypeScript build passes:**
**Given** `pnpm build` from the `lebo/` directory
**When** it runs after all story changes
**Then** it succeeds with zero TypeScript errors

**AC8 — Tests pass:**
**Given** `pnpm vitest` runs
**Then** new tests pass for: GearNarrativePanel loading state, GearNarrativePanel streaming state, GearNarrativePanel complete state, GearNarrativePanel null state (not rendered), axe accessibility

---

## Tasks / Subtasks

- [ ] Task 1: Extend `BuildSnapshot` with `primary_offense_skill_name` (AC1)
  - [ ] `lebo/src-tauri/scoring-core/src/build_snapshot.rs` — add `primary_offense_skill_name: Option<String>` with `#[serde(default)]`
  - [ ] `lebo/src/shared/utils/buildSnapshotSerializer.ts` — add `primaryOffenseSkillName: string | null` to `BuildSnapshot` interface
  - [ ] Add `extractPrimaryOffenseSkillName()` helper and call it in `toBuildSnapshot()`
  - [ ] `pnpm build` passes

- [ ] Task 2: Add `stream_gear_narrative()` to Rust services and new prompt (AC1–AC3)
  - [ ] `lebo/src-tauri/src/services/prompts.rs` — add `GEAR_NARRATIVE_SYSTEM_PROMPT` constant
  - [ ] `lebo/src-tauri/src/services/claude_service.rs` — add new event payload types (`GearNarrativeChunkPayload`, `GearNarrativeCompletePayload`) and `stream_gear_narrative()` function
  - [ ] `lebo/src-tauri/src/services/openrouter_service.rs` — add `stream_gear_narrative()` function mirroring the claude_service version

- [ ] Task 3: Extend `run_gear_scoring` and add payload assembly (AC1–AC4)
  - [ ] `lebo/src-tauri/src/commands/scoring_commands.rs` — add `assemble_gear_narrative_payload()` function
  - [ ] Extend `run_gear_scoring`: run `compute_stats` + `run_synergy_detection` in the same `spawn_blocking` call, then after emitting `gear:analysis-complete`, call `stream_gear_narrative()`

- [ ] Task 4: Extend TypeScript store and gear stream hook (AC4, AC6)
  - [ ] `lebo/src/shared/stores/optimizationStore.ts` — add `gearNarrative`, `isGeneratingNarrative`, `setGearNarrative`, `setIsGeneratingNarrative`, `appendGearNarrativeChunk`
  - [ ] `lebo/src/shared/stores/useGearStream.ts` — add listeners for `gear:narrative-chunk`, `gear:narrative-complete`, `gear:narrative-error`; update `startGearAnalysis()` to clear previous narrative

- [ ] Task 5: Create `GearNarrativePanel.tsx` and tests (AC4, AC5)
  - [ ] Create `lebo/src/features/gear-optimization/GearNarrativePanel.tsx` — props-only component
  - [ ] Create `lebo/src/features/gear-optimization/GearNarrativePanel.test.tsx`
  - [ ] `pnpm vitest src/features/gear-optimization/GearNarrativePanel.test.tsx` passes

- [ ] Task 6: Integrate into `GearOptimizationView.tsx` (AC5, AC6)
  - [ ] Import `GearNarrativePanel`, add store selectors for `gearNarrative` and `isGeneratingNarrative`
  - [ ] Render `<GearNarrativePanel>` below `<GearSlotRankingList>`
  - [ ] Update `GearOptimizationView.test.tsx` — add narrative integration tests
  - [ ] `pnpm build` passes; `pnpm vitest` all green

---

## Technical Requirements

### 1. `BuildSnapshot` extension — `primary_offense_skill_name`

**Rust (`build_snapshot.rs`):**
```rust
/// Human-readable name of the Primary Offense skill (e.g., "Poison Eruption").
/// Populated by TypeScript via buildSnapshotSerializer. None when no Primary Offense is set.
#[serde(default)]
pub primary_offense_skill_name: Option<String>,
```

**TypeScript (`buildSnapshotSerializer.ts`):**
```typescript
// Add to BuildSnapshot interface:
primaryOffenseSkillName: string | null

// Add helper function (mirror of extractPrimaryOffenseDeliveryType):
function extractPrimaryOffenseSkillName(build: BuildState, gameData: GameData): string | null {
  if (!build.skillRoles) return null
  const primarySlotId = Object.entries(build.skillRoles).find(([, role]) => role === 'primary_offense')?.[0]
  if (!primarySlotId) return null
  const activeSkill = build.contextData.skills.find((s) => s.slotId === primarySlotId)
  if (!activeSkill) return null
  const classData = gameData.classes?.[build.classId]
  if (!classData) return null
  const skillEntry = classData.skills.find((s) => s.skillId === activeSkill.skillId)
  return skillEntry?.skillName ?? null
}

// In toBuildSnapshot(), add:
primaryOffenseSkillName: extractPrimaryOffenseSkillName(build, gameData),
```

Note: `SkillEntry` in `shared/types/gameData.ts` has `skillName: string` (not `name`). Use `skillEntry?.skillName`, not `skillEntry?.name`.

### 2. Gear Narrative Event Namespace (Pattern 6)

All new events MUST use the `gear:` prefix:
- `gear:narrative-chunk` → `{ chunk: string }` — emitted for each SSE text delta
- `gear:narrative-complete` → `{}` — emitted at message_stop
- `gear:narrative-error` → `{ error_type: string, message: string }` — on error

**Do NOT** use `optimization:*` events for gear narrative. Pattern 6 is enforced here exactly as in Story 5.3.

### 3. `stream_gear_narrative()` — Rust Implementation

The gear narrative is **free-form prose**, NOT NDJSON. The streaming function is simpler than `stream_optimization()`:

**New payload types in `claude_service.rs`:**
```rust
#[derive(Serialize, Clone)]
pub struct GearNarrativeChunkPayload {
    pub chunk: String,
}

#[derive(Serialize, Clone)]
pub struct GearNarrativeCompletePayload {}
```

**`stream_gear_narrative()` pseudocode:**
```rust
pub async fn stream_gear_narrative(
    app_handle: &tauri::AppHandle,
    api_key: &str,
    user_message: String,
) -> Result<(), String> {
    // Build and send request (same as stream_optimization but with GEAR_NARRATIVE_SYSTEM_PROMPT
    // and max_tokens 1024 — narrative is short, not ranked suggestions)
    
    // SSE streaming loop:
    // - Each text_delta → emit "gear:narrative-chunk" with { chunk: delta_text }
    // - message_stop → emit "gear:narrative-complete" with {}
    // - Errors → return Err(format!("...")) — caller emits gear:narrative-error
    
    // NO ndjson_buffer needed — each delta is emitted immediately as a chunk
}
```

**Key differences from `stream_optimization()`:**
1. Uses `GEAR_NARRATIVE_SYSTEM_PROMPT` instead of `OPTIMIZATION_SYSTEM_PROMPT`
2. `max_tokens: 1024` (narrative is ~300–500 words, not 5+ suggestions)
3. No NDJSON parsing — each SSE text delta is emitted as `gear:narrative-chunk` immediately
4. No `suggestion_count` counter — just `gear:narrative-complete {}` at the end

**Error propagation:** If `stream_gear_narrative()` returns `Err(e)`, the caller in `scoring_commands.rs` emits `gear:narrative-error` with `{ error_type, message }` (same pattern as `run_gear_scoring`'s error handling for the gear:error event). The command then returns `Err(e)`.

**`openrouter_service.rs`:** Add an identical `stream_gear_narrative()` using OpenRouter's chat completions API and the `GEAR_NARRATIVE_SYSTEM_PROMPT`. The OpenRouter function follows the same pattern as its `stream_optimization()` counterpart — use SSE parsing with the existing `Delta`/`Choice` structs and emit `gear:narrative-chunk` / `gear:narrative-complete` events.

### 4. `GEAR_NARRATIVE_SYSTEM_PROMPT`

Add to `prompts.rs`:

```rust
pub const GEAR_NARRATIVE_SYSTEM_PROMPT: &str = r#"You are a Last Epoch gear optimizer generating a personalized upgrade narrative for a player's build.

OUTPUT FORMAT — CRITICAL RULES:
1. Output continuous prose (2–4 short paragraphs). No JSON, no bullet points, no headers, no markdown.
2. Reference the player's Primary Offense skill by name in the first sentence.
3. Call out the priority upgrade slot by name (the slot with the largest upgrade gap) with specific numbers.
4. If game-changer unique items are present, name them explicitly as "Game-Changer" recommendations.
5. In the final sentence, reference the player's archetype (Glass Cannon / Juggernaut / Balanced) and how it shapes gear priorities.
6. Keep it under 400 words. Be direct, specific, build-aware. Never use generic boilerplate like 'optimize your gear'.

The narrative should feel like advice from a knowledgeable friend who has studied this specific build."#;
```

### 5. `assemble_gear_narrative_payload()` — Rust

Add to `scoring_commands.rs`:

```rust
fn assemble_gear_narrative_payload(
    snapshot: &scoring_core::BuildSnapshot,
    gear_analysis: &scoring_core::GearAnalysis,
    game_changers: &[&scoring_core::SynergyFlag],
) -> Result<String, String> {
    let archetype_label = match snapshot.slider_position {
        0..=25 => "Glass Cannon",
        26..=74 => "Balanced",
        _ => "Juggernaut",
    };

    let skill_name = snapshot.primary_offense_skill_name
        .as_deref()
        .unwrap_or("your Primary Offense skill");

    let priority_slot_info = gear_analysis.slot_rankings
        .iter()
        .max_by(|a, b| a.upgrade_score.partial_cmp(&b.upgrade_score).unwrap_or(std::cmp::Ordering::Equal))
        .map(|r| serde_json::json!({
            "slot": r.slot,
            "upgradeScore": r.upgrade_score,
            "efficiencyPercent": r.efficiency_percent,
            "topWishlistAffix": r.ideal_prefix.first().or_else(|| r.ideal_suffix.first())
                .map(|a| serde_json::json!({
                    "name": a.display_name,
                    "targetTier": a.target_tier,
                    "reason": a.mechanical_reason
                }))
        }));

    let game_changer_list: Vec<serde_json::Value> = game_changers.iter().map(|f| serde_json::json!({
        "description": f.description,
        "deltaBuildScore": f.delta_build_score
    })).collect();

    let slot_summary: Vec<serde_json::Value> = gear_analysis.slot_rankings.iter().take(4).map(|r| {
        serde_json::json!({
            "slot": r.slot,
            "efficiencyPercent": r.efficiency_percent,
            "upgradeScore": r.upgrade_score
        })
    }).collect();

    let payload = serde_json::json!({
        "buildContext": {
            "primaryOffenseSkillName": skill_name,
            "classId": snapshot.class_id,
            "masteryId": snapshot.mastery_id,
            "sliderPosition": snapshot.slider_position,
            "archetypeLabel": archetype_label,
            "characterLevel": snapshot.character_level
        },
        "prioritySlot": priority_slot_info,
        "worstFourSlots": slot_summary,
        "gameChangers": game_changer_list,
        "instruction": "Write a personalized gear narrative following the system prompt rules."
    });

    serde_json::to_string(&payload)
        .map_err(|e| format!("SCORING_ERROR: failed to serialize gear narrative payload: {e}"))
}
```

### 6. Extended `run_gear_scoring` — CRITICAL

The current `run_gear_scoring` in `scoring_commands.rs` only runs `scoring_core::run_gear_scoring`. This story extends it to also run `compute_stats` and `run_synergy_detection` for game-changer context.

**New `spawn_blocking` block** (replaces the existing single-function call):
```rust
let (stat_sheet, gear_result, synergy_flags) =
    tauri::async_runtime::spawn_blocking(move || {
        let sheet = scoring_core::compute_stats(
            &snapshot_for_engine,
            &game_data,
            scoring_core::ComputeOptions::default(),
        );
        let gear = scoring_core::run_gear_scoring(&snapshot_for_engine, &game_data);
        let synergy = scoring_core::run_synergy_detection(&snapshot_for_engine, &game_data);
        (sheet, gear, synergy)
    })
    .await
    .map_err(|e| { ... })?;
```

**After `spawn_blocking`:**
1. `let _ = app_handle.emit("gear:analysis-complete", &gear_result);` — unchanged from Story 5.3
2. Filter game-changers: `synergy_flags.iter().filter(|f| f.flag_type == "game_changer").collect()`
3. Call `assemble_gear_narrative_payload(&snapshot, &gear_result, &game_changers)`
4. Provider routing (same pattern as `run_optimization`) → `stream_gear_narrative()`
5. On stream error → emit `gear:narrative-error` and return `Err(...)`

**IMPORTANT:** The `gear:analysis-complete` event fires BEFORE the Claude narrative starts streaming. This means:
- The slot ranking list appears immediately (fast, ~10–50ms)
- The narrative starts streaming after (2–5s Claude latency)
- `isAnalyzingGear` goes false when `gear:analysis-complete` fires
- `isGeneratingNarrative` goes true when `gear:analysis-complete` fires (TypeScript side)

**Current `run_gear_scoring` structure to reference:**
```rust
// lines 137–175 in scoring_commands.rs
// The game_data clone pattern and spawn_blocking structure are already there.
// The emit("gear:analysis-complete", ...) and error handling follow the same pattern.
// The provider routing block for stream_gear_narrative mirrors run_optimization lines 68–117.
```

### 7. TypeScript Store Extension (`optimizationStore.ts`)

Add to the store interface:
```typescript
gearNarrative: string | null
isGeneratingNarrative: boolean
setGearNarrative: (narrative: string | null) => void
setIsGeneratingNarrative: (generating: boolean) => void
appendGearNarrativeChunk: (chunk: string) => void
```

Add to the store initial state:
```typescript
gearNarrative: null,
isGeneratingNarrative: false,
```

Add implementations:
```typescript
setGearNarrative: (narrative) => set({ gearNarrative: narrative }),
setIsGeneratingNarrative: (generating) => set({ isGeneratingNarrative: generating }),
appendGearNarrativeChunk: (chunk) =>
  set((s) => ({ gearNarrative: (s.gearNarrative ?? '') + chunk })),
```

**Do NOT** add these to `clearSuggestions()` — that function is for the optimization flow only. Gear narrative state is cleared in `startGearAnalysis()` instead.

### 8. `useGearStream.ts` Updates

**`startGearAnalysis()` changes:**
```typescript
// Add before the existing setIsAnalyzingGear(true) call:
useOptimizationStore.getState().setGearNarrative(null)
useOptimizationStore.getState().setIsGeneratingNarrative(false)
```

**New event listeners in `registerListeners()`:**

```typescript
// Existing: unlisten1 = gear:analysis-complete, unlisten2 = gear:error
// UPDATE unlisten1 handler to also set isGeneratingNarrative:
const unlisten1 = await listen<GearAnalysis>(
  'gear:analysis-complete',
  (event) => {
    useOptimizationStore.getState().setGearAnalysis(event.payload)
    useOptimizationStore.getState().setIsAnalyzingGear(false)
    useOptimizationStore.getState().setIsGeneratingNarrative(true)  // narrative starts now
  },
)

// NEW: gear:narrative-chunk
const unlisten3 = await listen<{ chunk: string }>(
  'gear:narrative-chunk',
  (event) => {
    useOptimizationStore.getState().appendGearNarrativeChunk(event.payload.chunk)
  },
)
if (!isMounted) { unlisten3(); return }
unlisteners.push(unlisten3)

// NEW: gear:narrative-complete
const unlisten4 = await listen(
  'gear:narrative-complete',
  () => {
    useOptimizationStore.getState().setIsGeneratingNarrative(false)
  },
)
if (!isMounted) { unlisten4(); return }
unlisteners.push(unlisten4)

// NEW: gear:narrative-error
const unlisten5 = await listen<GearErrorPayload>(
  'gear:narrative-error',
  (event) => {
    const { error_type, message } = event.payload
    const appError = normalizeAppError(`${error_type}: ${message}`)
    useOptimizationStore.getState().setStreamError(appError)
    useOptimizationStore.getState().setIsGeneratingNarrative(false)
  },
)
if (!isMounted) { unlisten5(); return }
unlisteners.push(unlisten5)
```

**Cleanup function** — add `setIsGeneratingNarrative(false)` to the existing cleanup:
```typescript
return () => {
  isMounted = false
  for (const unlisten of unlisteners) { unlisten() }
  useOptimizationStore.getState().setIsAnalyzingGear(false)
  useOptimizationStore.getState().setIsGeneratingNarrative(false)  // NEW
}
```

**isMounted guard pattern:** The pattern already in `useGearStream` checks `if (!isMounted) { unlisten(); return }` immediately after each `await listen()`. Follow the same pattern for unlisten3, unlisten4, unlisten5 (check after each, as shown above). The `return` inside the `if (!isMounted)` block exits `registerListeners()` — subsequent `await listen()` calls are skipped, preventing zombie listeners.

### 9. `GearNarrativePanel.tsx` — Props Interface and Rendering

```tsx
interface Props {
  narrative: string | null
  isGenerating: boolean
}

export function GearNarrativePanel({ narrative, isGenerating }: Props) {
  // Render nothing when no narrative and not generating
  if (!narrative && !isGenerating) return null

  return (
    <section
      aria-label="Claude gear narrative"
      className="flex flex-col gap-2"
      style={{ borderTop: '1px solid var(--color-bg-hover)', paddingTop: '1rem', marginTop: '0.5rem' }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-accent-gold)' }}>
        Gear Analysis
      </h3>

      {/* Loading state — only when generating and no text yet */}
      {isGenerating && !narrative && (
        <p
          aria-live="polite"
          data-testid="gear-narrative-loading"
          className="text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Generating gear narrative…
        </p>
      )}

      {/* Narrative text — shown once text starts arriving */}
      {narrative && (
        <p
          aria-live="polite"
          data-testid="gear-narrative-text"
          className="text-sm whitespace-pre-wrap"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {narrative}
          {/* Streaming cursor — shows while generating */}
          {isGenerating && (
            <span aria-hidden="true" style={{ color: 'var(--color-text-muted)' }}>▋</span>
          )}
        </p>
      )}
    </section>
  )
}
```

**Props-only rule:** `GearNarrativePanel` does NOT access any Zustand store. It is pure React — testable without mocking.

### 10. `GearOptimizationView.tsx` Integration

Add two selectors:
```tsx
const gearNarrative = useOptimizationStore((s) => s.gearNarrative)
const isGeneratingNarrative = useOptimizationStore((s) => s.isGeneratingNarrative)
```

Add below `GearSlotRankingList` in JSX:
```tsx
<GearNarrativePanel
  narrative={gearNarrative}
  isGenerating={isGeneratingNarrative}
/>
```

**Import** `GearNarrativePanel` directly: `import { GearNarrativePanel } from './GearNarrativePanel'`

The `GearNarrativePanel` renders `null` when `!narrative && !isGenerating` — so it costs nothing when pre-analysis.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src-tauri/scoring-core/src/build_snapshot.rs` | MODIFY | Add `primary_offense_skill_name: Option<String>` field |
| `lebo/src-tauri/src/services/prompts.rs` | MODIFY | Add `GEAR_NARRATIVE_SYSTEM_PROMPT` |
| `lebo/src-tauri/src/services/claude_service.rs` | MODIFY | Add `GearNarrativeChunkPayload`, `GearNarrativeCompletePayload`, `stream_gear_narrative()` |
| `lebo/src-tauri/src/services/openrouter_service.rs` | MODIFY | Add `stream_gear_narrative()` |
| `lebo/src-tauri/src/commands/scoring_commands.rs` | MODIFY | Add `assemble_gear_narrative_payload()`; extend `run_gear_scoring` to run compute_stats + synergy + stream_gear_narrative |
| `lebo/src/shared/utils/buildSnapshotSerializer.ts` | MODIFY | Add `primaryOffenseSkillName` to interface + `extractPrimaryOffenseSkillName()` |
| `lebo/src/shared/stores/optimizationStore.ts` | MODIFY | Add `gearNarrative`, `isGeneratingNarrative`, setters, `appendGearNarrativeChunk` |
| `lebo/src/shared/stores/useGearStream.ts` | MODIFY | Add 3 new event listeners; update `startGearAnalysis()` to clear narrative |
| `lebo/src/features/gear-optimization/GearNarrativePanel.tsx` | CREATE | Props-only narrative component |
| `lebo/src/features/gear-optimization/GearNarrativePanel.test.tsx` | CREATE | Unit tests |
| `lebo/src/features/gear-optimization/GearOptimizationView.tsx` | MODIFY | Add 2 store selectors; render `<GearNarrativePanel>` |
| `lebo/src/features/gear-optimization/GearOptimizationView.test.tsx` | MODIFY | Add narrative integration tests |

**Do NOT touch:**
- `shared/types/statSheet.ts` — `GearAnalysis` struct is unchanged; game-changer flags are server-side only
- `scoring-core/src/gear.rs` — the pure Rust gear scorer is unchanged
- `scoring-core/src/synergy.rs` — already tested; used as-is
- `GearSlotRankingList.tsx` — no changes needed

---

## Architecture & Pattern Compliance

**Four stores only:** Do NOT create a new store for narrative state. Extend `optimizationStore` with `gearNarrative`, `isGeneratingNarrative`, and setters.

**No barrel files:** Import `GearNarrativePanel` directly from its path. No `index.ts`.

**Props-only component:** `GearNarrativePanel` receives `narrative: string | null` and `isGenerating: boolean` as props. It does NOT import `useOptimizationStore`. The parent `GearOptimizationView` is the store boundary.

**Pattern 6 — gear namespace:** ALL new events use the `gear:` prefix. Never use `optimization:*` for any gear narrative event.

**Pattern 7 — null hidden:** `GearNarrativePanel` returns `null` when `!narrative && !isGenerating`. No empty container, no placeholder.

**Tailwind v4:** No `@apply`. `className` for layout/spacing + inline `style={{ color: 'var(--color-*)' }}` for design tokens.

**SkillTreeCanvas props-only rule analogy:** `GearNarrativePanel` is the gear equivalent — pure props, no internal store access, independently testable.

**Provider routing in `run_gear_scoring`:** The provider routing block for `stream_gear_narrative` mirrors the pattern in `run_optimization` exactly (lines 68–117 of `scoring_commands.rs`). Use `keychain_service::get_llm_provider()` → if `"openrouter"`, get OpenRouter key → call `openrouter_service::stream_gear_narrative()`; else → get Anthropic key → call `claude_service::stream_gear_narrative()`. Emit `gear:narrative-error` (not `gear:error`) on each auth failure.

**`#[cfg(debug_assertions)]` override:** In `run_gear_scoring`, the Anthropic API key path should NOT get the `std::env::var("ANTHROPIC_API_KEY")` override — that override only exists in `run_optimization` (see `scoring_commands.rs` line 115). Do NOT add it here — rely on the key from keychain in all configurations.

Wait — actually, re-reading `scoring_commands.rs` line 115: this override IS needed for dev builds to work without a keychain. Add it to `run_gear_scoring` as well, following the same pattern:
```rust
#[cfg(debug_assertions)]
let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or(api_key);
```

---

## Testing Requirements

### `GearNarrativePanel.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { GearNarrativePanel } from './GearNarrativePanel'

describe('GearNarrativePanel', () => {
  it('renders nothing when narrative is null and not generating', () => {
    const { container } = render(<GearNarrativePanel narrative={null} isGenerating={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows loading state when generating with no narrative yet', () => {
    render(<GearNarrativePanel narrative={null} isGenerating={true} />)
    expect(screen.getByTestId('gear-narrative-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('gear-narrative-text')).toBeNull()
  })

  it('shows narrative text when available', () => {
    render(<GearNarrativePanel narrative="Your Poison Eruption build needs better gear." isGenerating={false} />)
    expect(screen.getByTestId('gear-narrative-text')).toHaveTextContent('Poison Eruption')
    expect(screen.queryByTestId('gear-narrative-loading')).toBeNull()
  })

  it('shows narrative text with cursor when streaming (generating + narrative)', () => {
    render(<GearNarrativePanel narrative="Your Poison" isGenerating={true} />)
    const textEl = screen.getByTestId('gear-narrative-text')
    expect(textEl).toBeInTheDocument()
    // Loading text is hidden when narrative exists
    expect(screen.queryByTestId('gear-narrative-loading')).toBeNull()
  })

  it('passes axe accessibility check with narrative', async () => {
    const { container } = render(
      <GearNarrativePanel narrative="Full narrative text here." isGenerating={false} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('passes axe accessibility check in loading state', async () => {
    const { container } = render(
      <GearNarrativePanel narrative={null} isGenerating={true} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

### `GearOptimizationView.test.tsx` additions

```tsx
it('shows GearNarrativePanel when narrative is available', () => {
  useOptimizationStore.setState({
    gearAnalysis: {
      slot_rankings: [{ slot: 'helmet', upgrade_score: 0, efficiency_percent: 100, ideal_prefix: [], ideal_suffix: [] }],
      priority_slot: '',
    },
    gearNarrative: 'Your Poison Eruption build needs better gear.',
    isGeneratingNarrative: false,
    isAnalyzingGear: false,
  })
  render(<GearOptimizationView />)
  expect(screen.getByTestId('gear-narrative-text')).toBeInTheDocument()
})

it('shows narrative loading state when isGeneratingNarrative is true', () => {
  useOptimizationStore.setState({
    gearAnalysis: {
      slot_rankings: [],
      priority_slot: '',
    },
    gearNarrative: null,
    isGeneratingNarrative: true,
    isAnalyzingGear: false,
  })
  render(<GearOptimizationView />)
  expect(screen.getByTestId('gear-narrative-loading')).toBeInTheDocument()
})
```

**Remember:** Add `gearNarrative: null, isGeneratingNarrative: false` to `initialOptimizationState` in `GearOptimizationView.test.tsx` when capturing the initial state for reset in `beforeEach`.

### Verification commands

```bash
# From lebo/:
pnpm build                                                              # Zero TS errors
pnpm vitest src/features/gear-optimization/GearNarrativePanel.test.tsx  # New component tests
pnpm vitest src/features/gear-optimization/GearOptimizationView.test.tsx # Integration tests
pnpm vitest                                                             # Full suite green
```

---

## Previous Story Intelligence (from 5.4)

- **Review finding AC3 — wishlist cap:** The 5.4 review noted that `WishlistSection` renders all affixes without `.slice(0, 2)`. This is still a deferred decision — Story 5.5 doesn't need to resolve it.
- **`useGearStream` isMounted pattern:** The existing pattern checks `if (!isMounted) { unlisten(); return }` after each `await listen()`. The `return` exits `registerListeners()`, so subsequent listeners are not registered. When adding 3 new listeners (unlisten3/4/5), apply the same check after each `await listen()` call in sequence. Do not batch these checks.
- **`GearSlotRankingList` is props-only:** Same rule applies to `GearNarrativePanel`. Never import `useOptimizationStore` inside a leaf display component.
- **Pre-existing test failures:** `SkillTreeCanvas`, `TreeControls`, `ProviderSelector`, `Settings` tests had pre-existing failures as of Story 5.3. Do not diagnose or fix them — they are unrelated to Epic 5 work.
- **Degraded mode stays valid:** `gear_affixes` is still empty in Phase 3, so all slots show 0% upgrade score. The Claude narrative will receive this data — the prompt must not break when wishlists are empty. The `assemble_gear_narrative_payload()` handles this gracefully because `ideal_prefix`/`ideal_suffix` arrays being empty just means those fields don't appear in the payload.

---

## Dev Notes

**`compute_stats` is already a dependency of `run_optimization` but NOT of `run_gear_scoring`.** Adding it to `run_gear_scoring` is necessary for getting defensive floor warnings (for `run_synergy_detection`), which needs a `StatSheet`. The additional ~0.3ms is negligible given the ~10–50ms gear scoring computation and 2–5s Claude API latency.

**Game-changer threshold in ACs:** The epic AC says ">30% BuildScore increase" qualifies as a game-changer. This threshold is already baked into `scoring-core/src/synergy.rs` — `run_synergy_detection` returns flags of type `"game_changer"` based on the engine's own threshold. Just filter for `flag_type == "game_changer"` — do not apply a separate 30% filter in TypeScript.

**Narrative payload is for Claude only — NOT stored in TypeScript.** The `assemble_gear_narrative_payload()` result is passed to `stream_gear_narrative()` and never emitted as a Tauri event. The TypeScript side never sees the assembled payload.

**`isAnalyzingGear` vs `isGeneratingNarrative` are independent states.** The Analyze Gear button is disabled while `isAnalyzingGear` is true. The narrative loading indicator is shown while `isGeneratingNarrative` is true. They overlap briefly (both true) but serve different purposes. The button becomes re-enabled as soon as `gear:analysis-complete` fires, even while the narrative is still generating.

**Empty `primary_offense_skill_name`:** If no Primary Offense skill is set (edge case — the UI prevents this but the engine degrades gracefully), the payload uses `"your Primary Offense skill"` as the fallback (see `assemble_gear_narrative_payload` §5 above). Claude's prompt will still produce a valid narrative.

**The `gear:narrative-error` event uses the same `GearErrorPayload` struct** that already exists in `useGearStream.ts` (the same shape as `gear:error`). Reuse the existing `GearErrorPayload` interface definition — do not define it twice.

### Project Structure Notes

- `GearNarrativePanel.tsx` is co-located in `features/gear-optimization/` — same folder as `GearOptimizationView.tsx` and `GearSlotRankingList.tsx`. Correct per project conventions.
- Tests co-located: `GearNarrativePanel.test.tsx` next to the component.
- No new feature folder is created.
- New Rust event payload structs (`GearNarrativeChunkPayload`, `GearNarrativeCompletePayload`) go in `claude_service.rs` alongside the existing `OptimizationCompletePayload` pattern. They must also be `pub` so `openrouter_service.rs` can reuse them (check if needed, or define locally in each service file — either is fine).

### References

- `BuildSnapshot` Rust struct: `lebo/src-tauri/scoring-core/src/build_snapshot.rs`
- `BuildSnapshot` TS interface: `lebo/src/shared/utils/buildSnapshotSerializer.ts`
- Existing `stream_optimization()`: `lebo/src-tauri/src/services/claude_service.rs` (lines 100–252)
- Existing `run_gear_scoring` command (to extend): `lebo/src-tauri/src/commands/scoring_commands.rs` (lines 133–175)
- Existing provider routing pattern: `scoring_commands.rs` lines 68–117 (in `run_optimization`)
- `optimizationStore` current fields: `lebo/src/shared/stores/optimizationStore.ts`
- `useGearStream.ts` current implementation: `lebo/src/shared/stores/useGearStream.ts`
- `GearOptimizationView.tsx`: `lebo/src/features/gear-optimization/GearOptimizationView.tsx`
- `GearOptimizationView.test.tsx`: `lebo/src/features/gear-optimization/GearOptimizationView.test.tsx`
- `SkillEntry.skillName` field: `lebo/src/shared/types/gameData.ts` line 47
- Design tokens: `lebo/src/` (search for `--color-` in existing components)
- 5.4 story (previous story learnings): `_bmad-output/implementation-artifacts/5-4-gear-optimization-view-priority-ranking-and-wishlists.md`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-05-26)

### Debug Log References

### Completion Notes List

### File List
