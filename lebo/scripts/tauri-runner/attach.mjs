// Attach Playwright to the RUNNING Tauri app's WebView2 over the Chrome DevTools Protocol.
//
// Tauri (Windows) renders in a native WebView2 window that Playwright cannot launch or attach to
// normally. But WebView2 honors WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>,
// which exposes a standard CDP endpoint. This script connects to that endpoint and drives the REAL
// app (real Tauri IPC, real game data) — screenshots, DOM/state probes, keyboard, mouse.
//
// Prereq: start the app with CDP enabled, e.g.  node scripts/tauri-runner/launch.mjs
//
// Usage:
//   node scripts/tauri-runner/attach.mjs info                 # title/url/canvas/dialog/body snapshot (JSON)
//   node scripts/tauri-runner/attach.mjs shot <path.png>      # screenshot the app window
//   node scripts/tauri-runner/attach.mjs eval "<js expr>"     # evaluate JS in the page, print JSON result
//   node scripts/tauri-runner/attach.mjs press Control+z ...  # dispatch one or more key chords to the app
//   node scripts/tauri-runner/attach.mjs click <x> <y>        # click viewport coords (for the PixiJS canvas)
//
// Env: TAURI_CDP_URL (default http://127.0.0.1:9222)
//
// The script NEVER closes the app — it detaches and force-exits, leaving the window running.

import { chromium } from 'playwright-core'

const CDP = process.env.TAURI_CDP_URL || 'http://127.0.0.1:9222'

async function connectWithRetry(attempts = 40, delayMs = 1500) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await chromium.connectOverCDP(CDP)
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw new Error(`Could not reach WebView2 CDP at ${CDP} after ${attempts} tries: ${lastErr?.message}`)
}

// Pick the real app page (localhost:1420 / http url), skipping about:blank and devtools targets.
async function getAppPage(browser) {
  for (let i = 0; i < 40; i++) {
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        const url = p.url()
        if (url.startsWith('http://') || url.startsWith('https://') || url.includes('tauri.localhost')) return p
      }
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('No app page found over CDP (is the Tauri window open?)')
}

const [, , cmd = 'info', ...rest] = process.argv
const browser = await connectWithRetry()
let exitCode = 0
try {
  const page = await getAppPage(browser)
  switch (cmd) {
    case 'info': {
      const info = await page.evaluate(() => ({
        title: document.title,
        url: location.href,
        canvasCount: document.querySelectorAll('canvas').length,
        dialogPresent: !!document.querySelector('[role="dialog"]'),
        dialogText: document.querySelector('[role="dialog"]')?.innerText?.slice(0, 300) ?? null,
        bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
      }))
      console.log(JSON.stringify(info, null, 2))
      break
    }
    case 'shot': {
      const path = rest[0] || 'tauri-shot.png'
      await page.screenshot({ path, scale: 'css' })
      console.log('screenshot -> ' + path)
      break
    }
    case 'eval': {
      const expr = rest.join(' ')
      const result = await page.evaluate((code) => {
        const r = eval(code)
        return r
      }, expr)
      console.log(JSON.stringify(result ?? null, null, 2))
      break
    }
    case 'press': {
      for (const combo of rest) {
        await page.keyboard.press(combo)
        await new Promise((r) => setTimeout(r, 120))
      }
      console.log('pressed: ' + rest.join(' '))
      break
    }
    case 'click': {
      const x = Number(rest[0])
      const y = Number(rest[1])
      await page.mouse.click(x, y, { button: rest[2] === 'right' ? 'right' : 'left' })
      console.log(`clicked ${x},${y}${rest[2] ? ' (' + rest[2] + ')' : ''}`)
      break
    }
    case 'clicktext': {
      const text = rest.join(' ')
      await page.getByText(text, { exact: false }).first().click({ timeout: 5000 })
      console.log('clicked text: ' + text)
      break
    }
    case 'shiftrightclick': {
      const x = Number(rest[0])
      const y = Number(rest[1])
      await page.keyboard.down('Shift')
      await page.mouse.click(x, y, { button: 'right' })
      await page.keyboard.up('Shift')
      console.log(`shift+right-click ${x},${y}`)
      break
    }
    default:
      console.error('unknown command: ' + cmd)
      exitCode = 2
  }
} catch (err) {
  console.error('attach error: ' + (err?.stack || err?.message || err))
  exitCode = 1
} finally {
  // Detach WITHOUT closing the app: drop the process, which severs the CDP socket but leaves WebView2 running.
  process.exit(exitCode)
}
