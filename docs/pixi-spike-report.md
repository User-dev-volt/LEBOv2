# PixiJS WebGL Renderer Spike — Benchmark Report

## Story

Story 1.2: PixiJS WebGL Renderer Spike — 60fps Validation Gate

## Hardware Profile (Target Tier)

| Attribute | Value |
|-----------|-------|
| CPU | Intel Core i5 (mid-range, integrated graphics) |
| GPU | Intel Iris / UHD Graphics (integrated) |
| RAM | 8 GB |
| OS | Windows 11 |
| Display | 1080p / 1440p (devicePixelRatio 1–2) |

## PixiJS Version

| Package | Version |
|---------|---------|
| `pixi.js` | 8.18.1 |

## Object Counts (Spike Configuration)

| Category | Count |
|----------|-------|
| Total nodes | 800 |
| Total edges | ~1,200 |
| Batch Graphics objects | 5 (edges, locked, available, allocated, suggested) |
| Per-node invisible hit areas | 800 (in `hitAreaContainer`) |
| FPS counter overlay | 1 Text object (screen space) |
| **Total rendered objects** | **~1,807** |

## Architecture Note

Rendering uses **5 shared `Graphics` objects** (one per visual state). This batches 800 nodes into 5 draw calls instead of 800, which is the primary performance driver. `worldContainer` is the single pan/zoom target; `app.stage` is pan/zoom-independent (FPS overlay stays fixed).

## FPS Measurements

> **Note:** Measurements below require manual execution via `pnpm tauri dev` on target hardware. Fill in observed values after running the benchmark session.

| Scenario | Duration | Expected | Observed | Pass |
|----------|----------|----------|----------|------|
| Idle (no interaction) | — | ≥60fps | _TBD_ | _TBD_ |
| Continuous pan drag | 10s | ≥60fps sustained | _TBD_ | _TBD_ |
| Zoom 30% → 150% → 30% | 5s | ≥45fps min | _TBD_ | _TBD_ |
| Rapid hover over 100+ nodes | 10s | ≥60fps | _TBD_ | _TBD_ |
| Sustained any interaction >5s | 5s+ | No drop below 45fps | _TBD_ | _TBD_ |

### How to Benchmark

1. `pnpm tauri dev` — app opens with 800-node radial tree in center canvas
2. Check FPS counter (top-left, green text: `FPS: XX | Nodes: 800`)
3. Test each scenario and record observed FPS in table above
4. Confirm ≥60fps sustained; note any drops below 45fps

## Go/No-Go Statement

> **Status: PENDING** — Awaiting manual benchmark run on target hardware (Intel Core i5, integrated graphics, 8 GB RAM).

| Outcome | Condition |
|---------|-----------|
| ✅ GO | FPS ≥60 sustained; no drop below 45fps for any interaction >5s |
| ❌ NO-GO | FPS fails threshold → execute Konva.js fallback spike (see story Dev Notes) |

## Spike Re-Run Requirement

Story 1.3a will reveal actual Last Epoch passive tree node counts. If counts exceed 800, re-run this benchmark with the real count before Story 1.4 begins. Update this document with the new results and a second go/no-go statement.

## Fallback Reference

If PixiJS cannot sustain 60fps:
1. Document exact FPS and node count where degradation starts (in this file)
2. `pnpm add konva react-konva`
3. Re-spike with identical mock data and identical interactions
4. Add Konva.js results to this document with a comparison table
5. Go/no-go decision required before Story 1.3a begins
