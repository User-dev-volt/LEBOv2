// Launch the Tauri dev app with WebView2 remote debugging (CDP) enabled, cross-platform.
//
// On Windows this sets WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS so the app's WebView2 exposes a CDP
// endpoint that scripts/tauri-runner/attach.mjs can drive. On Linux the same idea maps to the
// WebKitGTK inspector; on macOS Tauri WebView automation is not supported.
//
// Usage:  node scripts/tauri-runner/launch.mjs            (compiles Rust the first time — can take minutes)
// Env:    TAURI_CDP_PORT (default 9222)
//
// Leave this running in one terminal; drive the app from another with attach.mjs.

import { spawn } from 'node:child_process'

const port = process.env.TAURI_CDP_PORT || '9222'
const env = { ...process.env }

if (process.platform === 'win32') {
  env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = `--remote-debugging-port=${port}`
} else if (process.platform === 'linux') {
  // WebKitGTK: expose the remote inspector on the same port.
  env.WEBKIT_INSPECTOR_SERVER = `127.0.0.1:${port}`
} else {
  console.warn('[tauri-runner] macOS WebView automation is not supported; launching without CDP.')
}

console.log(`[tauri-runner] launching "pnpm tauri dev" with CDP port ${port} (platform: ${process.platform})`)
const child = spawn('pnpm', ['tauri', 'dev'], { env, stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
