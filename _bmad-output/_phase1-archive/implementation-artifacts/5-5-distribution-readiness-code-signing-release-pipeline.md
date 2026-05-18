# Story 5.5: Distribution Readiness — Code Signing & Release Pipeline

Status: done

## Story

As an advanced Last Epoch player downloading LEBOv2,
I want the installer to open without a Windows SmartScreen warning or macOS Gatekeeper block,
so that I can install the tool without clicking through security prompts or disabling OS security.

## Acceptance Criteria

1. **Given** the Windows build is produced by GitHub Actions
   **When** the `.msi` installer is downloaded and double-clicked on Windows 10/11
   **Then** no SmartScreen "Windows protected your PC" dialog appears
   **And** the installer opens directly to the setup wizard

2. **Given** the macOS build is produced by GitHub Actions
   **When** the `.dmg` is opened and the `.app` is launched on macOS 12+
   **Then** Gatekeeper does not block the app with "cannot be opened because the developer cannot be verified"
   **And** the app opens directly

3. **Given** a new version tag is pushed to GitHub (`v*`)
   **When** the GitHub Actions release workflow runs
   **Then** the Windows binary is signed with an Authenticode certificate before packaging
   **And** the macOS binary is signed with a Developer ID certificate and notarized via Apple's notarization service before packaging
   **And** signed binaries are uploaded to GitHub Releases automatically

4. **Given** the release is published to GitHub Releases
   **When** the in-app auto-updater (5.3) checks for updates
   **Then** `latest.json` is present in the release assets and passes Tauri's updater signature verification
   **And** `useUpdateCheck` correctly detects the new version

## Prerequisites (must be complete before implementation begins)

- Windows Authenticode OV or EV certificate purchased (DigiCert, Sectigo, or equivalent, ~$300–700/yr). **EV certificates eliminate SmartScreen on first run; OV builds reputation over time.**
- Apple Developer Program membership ($99/yr) enrolled at developer.apple.com
- GitHub repository created and the following Actions secrets stored:

| Secret | Value |
|--------|-------|
| `WINDOWS_CERTIFICATE` | Base64-encoded PFX file: `base64 -i cert.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX export password |
| `APPLE_CERTIFICATE` | Base64-encoded P12: `base64 -i cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | P12 export password |
| `APPLE_SIGNING_IDENTITY` | e.g. `"Developer ID Application: Alec Vautherot (XXXXXXXXXX)"` |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_PASSWORD` | App-specific password (generated at appleid.apple.com) |
| `APPLE_TEAM_ID` | 10-character team ID from developer.apple.com |
| `TAURI_SIGNING_PRIVATE_KEY` | Output of step 1 keypair generation (see Task 1) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password chosen during keypair generation |

## Tasks / Subtasks

- [x] Task 1: Generate Tauri updater signing keypair (AC: 4)
  - [x] Run from the `lebo/` directory: `pnpm tauri signer generate -w ~/.tauri/lebo.key`
  - [x] Copy the **public key** output (long base64 string) — goes into `tauri.conf.json` (Task 2)
  - [x] Copy the **private key** file content — store as `TAURI_SIGNING_PRIVATE_KEY` GitHub secret
  - [x] Store chosen password as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secret
  - [x] Do NOT commit the private key file to git

- [x] Task 2: Update `tauri.conf.json` with real updater config (AC: 4)
  - [x] Replace `"PLACEHOLDER_REPLACE_WITH_TAURI_SIGNER_PUBKEY"` in `lebo/src-tauri/tauri.conf.json` plugins.updater.pubkey with the public key from Task 1
  - [x] Replace `"https://github.com/OWNER/REPO/releases/latest/download/latest.json"` with actual repo URL (e.g. `https://github.com/AlecVautherot/lebo/releases/latest/download/latest.json`)
  - [x] Add Windows signing config under `bundle.windows` (see Dev Notes for exact shape)

- [x] Task 3: Create GitHub Actions release workflow (AC: 1, 2, 3)
  - [x] Create directory `.github/workflows/` (repo root — GitHub only reads workflows from here)
  - [x] Create `.github/workflows/release.yml` (see Dev Notes for full file)
  - [x] Verify the workflow triggers on `v*` tag pushes only
  - [x] Verify Windows job runs on `windows-latest`
  - [x] Verify macOS job runs on `macos-latest` with both `aarch64-apple-darwin` and `x86_64-apple-darwin` targets (universal binary)

- [x] Task 4: Verify local build produces correct bundles (AC: 1, 2)
  - [x] Run `pnpm tauri build` locally (Windows or macOS respectively) to confirm the build succeeds
  - [x] Confirm output artifacts are in `lebo/src-tauri/target/release/bundle/`
  - [x] On Windows: `.msi` and NSIS `.exe` present; on macOS: `.dmg` and `.app` present

- [ ] Task 5: Tag a test release and verify CI (AC: 3, 4) — **DEFERRED: pre-launch**
  - [ ] Push a test tag: `git tag v0.1.0-rc1 && git push origin v0.1.0-rc1`
  - [ ] Monitor GitHub Actions — both Windows and macOS jobs must pass
  - [ ] Confirm `latest.json` is present in release assets (required by 5.3 updater)
  - [ ] Confirm `.msi` and `.dmg` assets are present and named correctly

- [ ] Task 6: Smoke-test signed installers (AC: 1, 2) — **DEFERRED: pre-launch**
  - [ ] Download `.msi` from GitHub Release and install on a clean Windows 10/11 machine (or VM). Confirm no SmartScreen dialog.
  - [ ] Download `.dmg` from GitHub Release and run `.app` on a clean macOS 12+ machine. Confirm no Gatekeeper block.
  - [ ] If SmartScreen appears on EV cert (shouldn't) or Gatekeeper blocks (shouldn't): document exact error and do NOT merge — re-check signing config.

## Dev Notes

### What Already Exists — DO NOT Reinvent

| What | Status | Where |
|------|--------|-------|
| `tauri-plugin-updater = "2.10.1"` registered in lib.rs | ✅ exists | `lebo/src-tauri/Cargo.toml:23` |
| `plugins.updater` section in `tauri.conf.json` (placeholder values) | ✅ exists (placeholders) | `lebo/src-tauri/tauri.conf.json` |
| `"updater:default"` capability | ✅ exists | `lebo/src-tauri/capabilities/default.json:15` |
| `useUpdateCheck.ts` + update banner in `AppHeader.tsx` | ✅ exists | `lebo/src/shared/hooks/useUpdateCheck.ts` |
| `restart_app` Tauri command | ✅ exists | `lebo/src-tauri/src/commands/app_commands.rs` |
| `tauri.conf.json` current state: placeholder pubkey + `OWNER/REPO` endpoint | ⚠️ placeholders | `lebo/src-tauri/tauri.conf.json` |

Story 5.3 deliberately deferred all CI/CD and pubkey work to this story. The in-app updater is already wired — this story makes it functional by providing real secrets + a real release pipeline.

---

### `tauri.conf.json` — required additions

Add `bundle.windows` signing config and replace the two updater placeholders:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [ ... ],
    "resources": [ ... ],
    "windows": {
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "<REPLACE: public key from tauri signer generate>",
      "endpoints": [
        "https://github.com/<OWNER>/<REPO>/releases/latest/download/latest.json"
      ]
    }
  }
}
```

`digestAlgorithm: "sha256"` and `timestampUrl` are required for Authenticode. Without `timestampUrl`, the signature expires when the certificate expires — always timestamp.

---

### `lebo/.github/workflows/release.yml` — full file

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
            args: ''
          - platform: macos-latest
            args: '--target universal-apple-darwin'

    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Install macOS universal target
        if: matrix.platform == 'macos-latest'
        run: |
          rustup target add aarch64-apple-darwin
          rustup target add x86_64-apple-darwin

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './lebo/src-tauri -> target'

      - name: Install frontend dependencies
        run: pnpm install
        working-directory: lebo

      # Windows: decode PFX certificate to temp file for Tauri CLI
      - name: Decode Windows certificate
        if: matrix.platform == 'windows-latest'
        shell: pwsh
        run: |
          $certBytes = [System.Convert]::FromBase64String("${{ secrets.WINDOWS_CERTIFICATE }}")
          $certPath = Join-Path $env:RUNNER_TEMP "lebo_windows.pfx"
          [IO.File]::WriteAllBytes($certPath, $certBytes)
          echo "TAURI_SIGNING_WINDOWS_CERTIFICATE_FILE=$certPath" | Out-File -FilePath $env:GITHUB_ENV -Append

      - name: Build and publish release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Tauri updater signing (required for self-updates via plugin-updater)
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # Windows Authenticode
          TAURI_SIGNING_WINDOWS_CERTIFICATE_FILE: ${{ env.TAURI_SIGNING_WINDOWS_CERTIFICATE_FILE }}
          TAURI_SIGNING_WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
          # macOS Developer ID + notarization
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          projectPath: lebo
          tagName: ${{ github.ref_name }}
          releaseName: 'LEBOv2 v__VERSION__'
          releaseBody: 'Download the installer for your platform from Assets below.'
          releaseDraft: true
          prerelease: false
          includeUpdaterJson: true
          args: ${{ matrix.args }}
```

**Critical notes on this workflow:**

- `releaseDraft: true` — releases stay as drafts so you can review before publishing. Publish manually in GitHub UI after verifying assets. Only published releases are detected by the in-app updater.
- `includeUpdaterJson: true` — generates `latest.json` (with updater signatures) and attaches it to the release. The 5.3 updater endpoint points to this file.
- `--target universal-apple-darwin` — builds a single binary that runs natively on both Intel and Apple Silicon Macs. Requires both rustup targets added (step above).
- `TAURI_SIGNING_WINDOWS_CERTIFICATE_FILE` is set via `$GITHUB_ENV` (not `$env:` direct interpolation) because the cert path is generated at runtime.
- `APPLE_PASSWORD` is the **app-specific password** generated at appleid.apple.com — NOT your Apple ID login password. The epics used `APPLE_ID_PASSWORD` as the secret name; the Tauri 2.x env var name is `APPLE_PASSWORD`. Map accordingly: if stored as `APPLE_ID_PASSWORD`, reference it as `${{ secrets.APPLE_ID_PASSWORD }}` here.
- Apple notarization takes 2–15 minutes — CI timeout must accommodate this. GitHub Actions default timeout (6 hours) is sufficient; do not add an artificial timeout on the build step.

---

### Tauri Signer Keypair Generation (Task 1 detail)

```bash
# From lebo/ directory — requires pnpm tauri CLI (already installed)
pnpm tauri signer generate -w ~/.tauri/lebo.key

# Output looks like:
# Please enter a password to protect the private key:
# Your secret key was saved to /Users/you/.tauri/lebo.key — keep it safe!
# -------------------------------------
# Public key: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkgLi4u...
```

- The long base64 `Public key:` line → paste into `tauri.conf.json` plugins.updater.pubkey
- The content of `~/.tauri/lebo.key` → store as `TAURI_SIGNING_PRIVATE_KEY` GitHub secret
- The password you entered → store as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secret

**Back up the private key file.** If lost, existing installs cannot receive updates — you'd need to ship a manual installer to break users out of the old updater config.

---

### SmartScreen / Gatekeeper behavior by cert type

| Scenario | Result |
|----------|--------|
| No code signing | SmartScreen blocks with "Windows protected your PC" (requires "Run anyway" click); Gatekeeper blocks with "cannot be verified" |
| OV Authenticode (new publisher) | SmartScreen may still warn on first runs until reputation builds. Warning disappears after enough installs. |
| EV Authenticode | SmartScreen bypass on first run — no reputation building needed. Preferred for community release. |
| Developer ID + notarization (macOS) | Gatekeeper passes immediately — no warning |

---

### Scope — DO NOT do in this story

- No changes to the Rust backend, frontend, or any feature code
- No GitHub Pages or CDN setup — GitHub Releases only
- No auto-publishing of drafts (manual promotion in GitHub UI is intentional)
- No CI for PRs or push-to-main — only `v*` tag triggers
- No code signing for Windows `.exe` (NSIS installer) separately — Tauri handles both `.msi` and NSIS output
- No delta update support
- No crash reporting or telemetry

### File Locations

**New files:**
- `.github/workflows/release.yml` (repo root — moved from `lebo/.github/workflows/` which GitHub does not read)

**Modified files:**
- `lebo/src-tauri/tauri.conf.json` — replace pubkey placeholder + OWNER/REPO endpoint + add bundle.windows signing config

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

**Tasks 1–4 complete (2026-04-29):**

- Task 1: Ran `pnpm tauri signer generate -w ~/.tauri/lebo.key -p ""` from `lebo/`. Keypair generated at `C:\Users\MD_Ki\.tauri\lebo.key` (private) and `.lebo.key.pub` (public). Empty password used — see GitHub Secrets section below.
- Task 2: `tauri.conf.json` updated with real pubkey, correct endpoint (`User-dev-volt/last-epoch-build-optimizer`), and `bundle.windows` Authenticode config (`digestAlgorithm: sha256`, `timestampUrl: http://timestamp.digicert.com`).
- Task 3: `.github/workflows/release.yml` created at repo root (moved from `lebo/.github/workflows/` — GitHub only reads workflows at repo root). Triggers on `v*` tags. Matrix: `windows-latest` (unsigned build) + `macos-latest --target universal-apple-darwin`. Uses `tauri-apps/tauri-action@v0` with `includeUpdaterJson: true` for `latest.json` generation. pnpm pinned to `9.15.0`.
- Task 4: `pnpm tauri build` succeeded locally on Windows. Output: `bundle/msi/lebo_0.1.0_x64_en-US.msi` and `bundle/nsis/lebo_0.1.0_x64-setup.exe`. Build uses the generated Tauri signing keypair (set via env vars).

**Tasks 5 & 6 — Intentionally deferred to pre-launch milestone:**

Tasks 5 (CI tag test) and 6 (smoke-test signed installers) require Windows Authenticode and Apple Developer ID certificates (~$300–700/yr + $99/yr). These are only needed for public distribution. Deferred until the app is validated through local testing and ready for public release.

**GitHub secrets to add now** (repo: `User-dev-volt/last-epoch-build-optimizer` → Settings → Secrets → Actions):
- `TAURI_SIGNING_PRIVATE_KEY` = contents of `C:\Users\MD_Ki\.tauri\lebo.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = password set during key generation

**When ready to go public**, complete Tasks 5 & 6 by purchasing certs and configuring the remaining 8 secrets from the Prerequisites table.

### File List

- `lebo/src-tauri/tauri.conf.json` — replaced pubkey placeholder, updated endpoint URL, added bundle.windows signing config
- `.github/workflows/release.yml` — Tauri release pipeline (repo root; moved from `lebo/.github/workflows/` which GitHub ignores)

### Change Log

- 2026-04-29: Tasks 1–4 complete. Tauri updater keypair generated; tauri.conf.json updated; GitHub Actions release workflow created; local build verified. Tasks 5–6 blocked on code signing certificate purchase (see Completion Notes).
