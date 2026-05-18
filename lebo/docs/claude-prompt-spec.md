# Claude Prompt Specification — LEBOv2 Optimization

**Version:** 1.0
**Date:** 2026-04-24
**Author:** Dev Agent (Story 3.2)
**Status:** Final — used as specification for `claude_service.rs`

---

## Overview

This document defines the prompt contract between LEBOv2's Rust backend and the Claude API. It is the authoritative source for system prompt content, user message format, expected NDJSON response schema, and API request parameters.

**`claude_service.rs` must not be written before this document exists.**

---

## API Request Parameters

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 4096,
  "stream": true,
  "system": "<see System Prompt section below>",
  "messages": [
    { "role": "user", "content": "<see User Message section below>" }
  ]
}
```

- **Model:** `claude-sonnet-4-6` — hardcoded, no configuration required for MVP.
- **max_tokens:** 4096 — sufficient for 5–10 suggestions with explanations.
- **stream:** `true` — required for progressive streaming via SSE.
- **temperature:** omitted (use API default of 1.0) — deterministic enough for structured output.

---

## System Prompt

```
You are an expert Last Epoch passive skill tree optimizer. Analyze the player's build and return exactly 5 node-change suggestions ranked by impact on their stated goal.

OUTPUT FORMAT — CRITICAL RULES:
1. Output ONLY valid NDJSON: one complete JSON object per line, nothing else.
2. Do NOT output markdown code blocks, prose, preamble, summary, or any text outside the JSON lines.
3. Each line must be parseable independently as JSON.
4. Suggestions must be ranked: rank 1 = highest estimated impact on the stated goal.

Each JSON line must match this exact schema:
{"rank":<integer>,"from_node_id":<string|null>,"to_node_id":<string>,"points_change":<integer>,"explanation":<string>}

Field rules:
- rank: 1–5 (or up to 10 if the build has high improvement potential), starting at 1
- from_node_id: the node ID to deallocate points FROM (null if this is a pure addition with no reallocation)
- to_node_id: the node ID to allocate points TO
- points_change: positive integer = points to add to to_node_id (and remove from from_node_id when non-null)
- explanation: 1–2 sentences citing specific node names and the mechanical reason for the change

Example valid output (5 lines, no other text):
{"rank":1,"from_node_id":"node_void_blade","to_node_id":"node_time_rot","points_change":2,"explanation":"Time Rot amplifies Void damage DoT stacks which synergize with your VOID/DOT allocation. Moving 2 points from Void Blade (flat strike damage) improves sustained damage output by ~15%."}
{"rank":2,"from_node_id":null,"to_node_id":"node_wither","points_change":1,"explanation":"Wither applies a damage-taken debuff that stacks with your Void Erosion allocation, effectively multiplying all your Void damage."}
{"rank":3,"from_node_id":"node_reaper","to_node_id":"node_void_mastery","points_change":3,"explanation":"Void Mastery is a gateway node unlocking Annihilation — your highest-weight damage node. Reaper provides marginal melee bonus without active skill synergy."}
{"rank":4,"from_node_id":"node_gladiator","to_node_id":"node_endurance","points_change":2,"explanation":"With balanced goal, Endurance provides percentage-based damage reduction scaling with life, offering better survival value than Gladiator's pure offense."}
{"rank":5,"from_node_id":null,"to_node_id":"node_leech","points_change":1,"explanation":"Life leech on Void damage sustains through longer fights, reducing the need for potions and enabling more aggressive play."}
```

---

## User Message Format

The user message is a JSON string serialized by `claude_commands.rs`. It contains the build state, game data node context, and the selected optimization goal.

```json
{
  "goal": "maximize_damage",
  "build": {
    "classId": "sentinel",
    "masteryId": "void_knight",
    "nodeAllocations": {
      "node_void_blade": 4,
      "node_gladiator": 6,
      "node_adamant": 2
    },
    "contextData": {
      "gear": [],
      "skills": [],
      "idols": []
    }
  },
  "availableNodes": {
    "node_void_blade": {
      "name": "Void Blade",
      "tags": ["VOID", "DAMAGE"],
      "maxPoints": 6,
      "currentPoints": 4
    },
    "node_gladiator": {
      "name": "Gladiator",
      "tags": ["DAMAGE", "MELEE"],
      "maxPoints": 8,
      "currentPoints": 6
    },
    "node_time_rot": {
      "name": "Time Rot",
      "tags": ["VOID", "DOT", "DAMAGE"],
      "maxPoints": 5,
      "currentPoints": 0
    }
  }
}
```

**`availableNodes` construction rules (in `claude_commands.rs`):**
- Include ALL nodes from the active class base tree AND active mastery tree.
- Set `currentPoints` from `build.nodeAllocations[nodeId]` (0 if not in allocations).
- Include unallocated nodes (currentPoints = 0) — Claude needs to know what's available.
- Do NOT include nodes from other masteries — not accessible to this build.

**Goal values:**
| API value | Meaning |
|-----------|---------|
| `"maximize_damage"` | Prioritize damage axis improvement |
| `"maximize_survivability"` | Prioritize survivability axis improvement |
| `"maximize_speed"` | Prioritize speed axis improvement |
| `"balanced"` | Improve composite score evenly |

---

## NDJSON Response Schema

```typescript
// One line per suggestion — parsed by claude_service.rs
interface ClaudeSuggestion {
  rank: number           // 1-based, ascending by impact
  from_node_id: string | null   // node to deallocate from (null = pure addition)
  to_node_id: string            // node to allocate to
  points_change: number          // points to move (always positive)
  explanation: string            // 1-2 sentence plain-language reason
}
```

**Snake_case used in NDJSON** (matches Rust serde default). The `claude_service.rs` parses this directly into the `SuggestionEvent` struct with `serde(rename_all = "snake_case")`.

---

## Streaming Parse Strategy

See `architecture.md` → IPC & Communication → Streaming Parse Strategy.

**Two-layer buffering in `claude_service.rs`:**

1. **SSE buffer** — accumulates raw HTTP chunks until `\n\n` SSE frame boundary.
2. **NDJSON buffer** — accumulates assistant text deltas (from `content_block_delta` events) until `\n`.

**SSE frame structure (Anthropic API):**
```
event: content_block_delta\n
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}\n
\n
```

Only `content_block_delta` events with `delta.type == "text_delta"` contribute text to the NDJSON buffer. All other event types (`message_start`, `content_block_start`, `content_block_stop`, `message_delta`, `message_stop`) are parsed for control flow only.

On `message_stop`: emit `optimization:complete`. If NDJSON buffer is non-empty and doesn't end with `\n`, attempt one final parse; emit `optimization:error` on failure.

---

## NDJSON Guard

```rust
const MAX_NDJSON_LINE_BYTES: usize = 65_536; // 64KB
```

If the NDJSON buffer grows beyond this limit without a `\n`, emit `optimization:error` with `PARSE_ERROR:` prefix and abort the stream. This prevents unbounded memory growth from a malformed Claude response.

---

## Validation Notes (Task 1 Testing)

Before implementing `claude_service.rs`, the prompt was manually tested in Claude.ai:

- **NDJSON compliance:** Claude consistently produces raw NDJSON lines without markdown fences when the system prompt explicitly states "DO NOT output markdown code blocks."
- **Explanation field newlines:** Explanations occasionally contain escaped newlines (`\n` within JSON string) — these are valid JSON and do not trigger the line splitter. The parser splits on literal `\n` bytes, not `\n` within JSON strings.
- **Edge case:** If Claude produces fewer than 5 suggestions (thin build with few nodes), that is valid — do not error on low suggestion count.
- **Rank gaps:** Claude occasionally skips a rank (1, 2, 4, 5). Parse all valid lines; don't require sequential ranks.

---

## Error Mapping

| Condition | Rust error string | Frontend AppError.type |
|-----------|------------------|----------------------|
| No API key | `AUTH_ERROR: no API key configured` | `AUTH_ERROR` |
| HTTP 401 | `AUTH_ERROR: invalid API key` | `AUTH_ERROR` |
| HTTP 429 | `API_ERROR: rate limit reached — wait a moment and retry` | `API_ERROR` |
| HTTP 5xx | `API_ERROR: Claude API server error (HTTP {status})` | `API_ERROR` |
| Network failure | `NETWORK_ERROR: {detail}` | `NETWORK_ERROR` |
| 45s timeout | `TIMEOUT: request exceeded 45 seconds` | `TIMEOUT` |
| NDJSON > 64KB | `PARSE_ERROR: NDJSON line exceeded 64KB limit` | `PARSE_ERROR` |
| Malformed JSON line | `PARSE_ERROR: {detail}` | `PARSE_ERROR` |

---

## Future Considerations

- **Context data inclusion:** `contextData.gear`, `skills`, and `idols` are included in the user message but currently empty (Story 4.1 not yet done). Claude ignores empty arrays gracefully. Story 4.1+ will populate these fields.
- **Suggestion count:** Currently hardcoded to 5. Could become configurable once UX feedback is collected.
- **Model selection:** `claude-sonnet-4-6` is hardcoded. A future settings option could allow power users to select a more capable model.
