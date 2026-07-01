# Tauri Runner — drive the real app for UI checks

The app is a **Tauri 2 desktop app**: the skill tree (PixiJS canvas) and all data (game data, builds,
vault) come from the **Rust backend over Tauri IPC**. A plain browser against the Vite dev server
(`localhost:1420`) therefore renders an empty shell — `invoke`/`listen` throw, no game data loads, the
tree never renders. To verify real behavior you must drive the **actual WebView2 window**.

Playwright can't launch or attach to a native WebView2 window directly. The workaround: WebView2 honors
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>`, which exposes a standard
**Chrome DevTools Protocol** endpoint. `playwright-core`'s `chromium.connectOverCDP()` attaches to it and
drives the real app — real IPC, real game data — with full screenshot / DOM / keyboard / mouse control.

## Prerequisites (verified on this machine)

- Rust toolchain (`cargo`, `rustc`) — needed to build the Tauri backend.
- **WebView2 runtime** (Windows 11 ships it; here: 149.x) — provides the CDP endpoint.
- `playwright-core` (devDependency) — the CDP connector. No browser download needed.

## Usage

**1. Launch the app with CDP enabled** (one terminal; first run compiles Rust — minutes):

```bash
node scripts/tauri-runner/launch.mjs
# equivalently, on Windows bash:
#   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 pnpm tauri dev
```

**2. Drive / inspect the running app** (another terminal):

```bash
node scripts/tauri-runner/attach.mjs info                 # title / url / canvas count / dialog / body text (JSON)
node scripts/tauri-runner/attach.mjs shot out.png         # screenshot the real window
node scripts/tauri-runner/attach.mjs eval "document.querySelectorAll('canvas').length"
node scripts/tauri-runner/attach.mjs press Control+z      # dispatch a key chord to the app
node scripts/tauri-runner/attach.mjs press 2              # bare key (e.g. center-tab shortcut)
node scripts/tauri-runner/attach.mjs click 640 360 right  # click viewport coords (for the PixiJS canvas)
```

`attach.mjs` never closes the app — it detaches and exits, leaving the window running so you can chain
commands. Override the endpoint with `TAURI_CDP_URL` (default `http://127.0.0.1:9222`).

## Notes

- `canvasCount > 0` from `info` confirms the PixiJS tree rendered with real game data (the thing a plain
  browser can't do).
- Keyboard chords go through the app's real `window` keydown handler — the same path exercised by
  `App.keyboard.test.tsx`, but live. Useful for verifying global-shortcut behavior (undo/redo, tab keys,
  modal suppression).
- Clicking specific tree nodes needs canvas coordinates; use `eval` to read node screen positions from the
  renderer when a check needs to target a specific node.
