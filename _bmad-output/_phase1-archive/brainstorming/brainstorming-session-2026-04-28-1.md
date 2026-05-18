---
stepsCompleted: [1]
inputDocuments: []
session_topic: 'Multi-LLM Provider Support in LEBO Settings'
session_goals: 'Explore whether and how to add support for multiple LLM providers beyond Claude; evaluate freellmapi as a free-tier option; determine timing and architectural approach'
selected_approach: ''
techniques_used: []
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Alec
**Date:** 2026-04-28

## Session Overview

**Topic:** Multi-LLM Provider Support in LEBO Settings
**Goals:** Explore whether and how to add support for multiple LLM providers beyond Claude; evaluate freellmapi as a free-tier option; determine timing and architectural approach

### Context Guidance

- LEBO is a Tauri desktop app — all LLM calls go through Rust backend (`claude_service.rs`)
- Currently Claude is hardcoded: one vault key `anthropic_api_key`, one service file calling Anthropic's API directly, model pinned to `claude-sonnet-4-6`
- No provider abstraction exists — adding one is a prerequisite for multi-provider support
- **freellmapi** is a self-hosted Node.js proxy (OpenAI-compatible) that routes across 14 free-tier providers (~1.3B tokens/month claimed). Tops out at Llama 3.3 70B / Gemini 2.5 Pro — no frontier models. Not an npm package; requires cloning and running locally.

### Session Setup

_Ready to brainstorm. Technique approach TBD by user selection._
