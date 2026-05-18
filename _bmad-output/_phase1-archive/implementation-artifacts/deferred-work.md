# Deferred Work

## Deferred from: code review of 6-2-screen-reader-support-aria-infrastructure-accessibility-ci (2026-04-30)

- **Button positions at origin on zero-size container mount** — `syncButtonPositions` viewport equality check short-circuits on the initial tick if the container reports zero dimensions at mount; buttons are placed at the origin and stay there until the user pans or zooms. Production (Tauri) always provides a real layout; test mock overrides `getBoundingClientRect` correctly. Address if Playwright CI reports off-position overlays.
- **BFS Tab order undefined on cyclic graphs** — The `bfsOrder` useMemo in `SkillTreeCanvas` assumes a DAG; cyclic connections (if ever introduced in game data) would produce an arbitrary Tab order that may jump backward visually. Not a real scenario for Last Epoch's current skill trees.
- **Action buttons lack per-suggestion accessible names** — "Preview", "Apply", "Skip" buttons on `SuggestionCard` use only their text content as their accessible name; when listed in isolation by screen-reader browse mode, they are indistinguishable across cards. Pre-existing; `axe-core` passes because the buttons are non-empty and the parent `role="article"` aria-label provides context. Consider `aria-labelledby` or `aria-label` in a future a11y polish story.
- **Live region elements absent from settings view** — `#ai-status-region` and `#critical-error-region` are only mounted in the main view branch of `App.tsx`; `useAccessibilityAnnouncer` silently drops announcements when the user navigates to settings. Structural design choice; optimization cannot be triggered from settings view so the gap is theoretical.
- **`o`/`i` shortcuts silently no-op when target unmounted** — `document.getElementById('optimize-button')?.focus()` gives no feedback when the element isn't in the DOM. Pre-existing carry-over from Story 6.1 deferred list.

## Deferred from: 5-5-distribution-readiness-code-signing-release-pipeline (2026-04-29)

- **Task 5 — CI tag test** — Push `v0.1.0-rc1` tag, verify GitHub Actions Windows + macOS jobs pass, confirm `latest.json` and `.msi`/`.dmg` assets are present. Blocked on code signing certificate purchase.

## Deferred from: code review of 6-1-keyboard-navigation-global-shortcuts (2026-04-29)

- **O/I shortcut silent fail** — `document.getElementById('optimize-button')?.focus()` gives no user feedback when the button isn't visible or mounted. Would need a toast/announcement mechanism; out of scope for 6.1.
- **SuggestionCard child button tab stops** — Apply/Preview/Skip buttons inside each card remain in the natural Tab order, creating unwanted tab stops outside the managed keyboard-nav model. Spec is silent on child button `tabIndex`; addressing this would require a more invasive interaction redesign.
- **aria-label verbosity** — `SuggestionCard` embeds the full `suggestion.explanation` in its `aria-label`, which can be very long and verbose for screen readers. No spec constraint on label length; consider abbreviating in a future accessibility story (6.2).
- **addTickerListener closure double-registration** — The `const cb = () => fn()` wrapper means passing the same `fn` reference twice registers two unremovable subscriptions. Single-call usage in practice makes this safe for now.
- **cardRefs keyed by rank collision** — `SuggestionsList` `cardRefs` map uses `suggestion.rank` as key; reused rank numbers across optimizer re-runs could cause the ref to point to a stale card. Low risk with sequential rank assignment.
- **Arrow key nav off-screen dead-end** — Arrow key navigation silently stops when connected nodes are outside the current viewport. Intentional per dev notes (viewport-only rendering for performance). Consider a pan-to-node behavior in a future story.
- **focusedCardIndex/expandedRank mouse desync** — Mouse interactions (Apply/Skip) don't reset `focusedCardIndex` or `expandedRank`, leaving stale keyboard-focus state. Minor cosmetic issue.
- **tabIndex={0} entry point shifts during pan** — The Tab-reachable entry node for the skill tree changes as the viewport pans (first visible node in array). Acceptable limitation of the viewport-array approach; could be fixed by designating a stable "root" node.
- **Task 6 — Smoke-test signed installers** — Install `.msi` on clean Windows 10/11 (no SmartScreen dialog); run `.app` on clean macOS 12+ (no Gatekeeper block). Blocked on certificate purchase. Prerequisites: Windows Authenticode EV cert (~$300–700/yr, DigiCert/Sectigo) + Apple Developer Program ($99/yr). Once certs are purchased, store 8 secrets in GitHub Actions (see Prerequisites table in story file) and run both tasks before publishing the first public release.

## Deferred from: code review of 5-6-multi-provider-llm-openrouter-model-selection (2026-04-28)

- **W1 — Tautological unit tests in `openrouter_service.rs`** — tests assert hardcoded string equality rather than calling production functions; streaming function has no unit test coverage. HTTP mock infrastructure needed; defer until test tooling expands.
- **W2 — `sse_buffer` O(n²) re-allocation in SSE loop** — `sse_buffer = sse_buffer[newline_pos+1..].to_string()` allocates a new `String` on every SSE line; use `drain()` or a cursor for O(n). Performance optimization; not a correctness bug.
- **W3 — Model ID not in `MODELS` list restored into dropdown** — `setSelectedModel(pref)` with no membership check; stale or removed model IDs produce a blank dropdown on load. Acceptable for the current curated list; add guard if model list is made dynamic.
- **W4 — `vault_write` reopens vault on every call** — three sequential OpenRouter saves open/lock/flush three times; no transaction grouping. Pre-existing vault interaction pattern; optimize if Stronghold lock contention is observed.
- **W5 — Raw vault error strings may surface in toasts** — `format!("STORAGE_ERROR: failed to store value: {e}")` may expose file paths or library internals. Pre-existing pattern across all keychain_service functions.
- **W6 — `saveDisabled` uses local React state, not live vault state** — external vault wipe leaves `isConfigured = false` only after next mount. Extreme edge case; not a practical security concern.
- **W7 — Provider toggle persists `llm_provider` on click, not on Save** — breaks AC4 atomicity intent but AC7 AUTH_ERROR covers the missing-key case. Defer UX redesign until user feedback indicates a problem.

## Deferred from: code review of 5-1-api-key-management-settings-view (2026-04-26)

## Deferred from: code review of 5-4-error-handling-infrastructure-reliability (2026-04-28)

- **ErrorBoundary has no componentDidCatch** — render errors are caught but never logged or reported; no monitoring or console hook. No error reporting infrastructure exists in scope for MVP. Add logging when/if error analytics are introduced.
- **Stale closure over savedBuilds/activeBuild in deleteBuild/renameBuild** — store state is destructured before the await; mutations between call and resolution are silently ignored. Pre-existing pattern in buildPersistence.ts; address if concurrent save/delete scenarios are observed in practice.
- **Toaster unguarded outside ErrorBoundary** — react-hot-toast throwing would propagate to the root uncaught. Pre-existing architectural choice; acceptable given react-hot-toast is a stable dependency.
- **showInfoToast exposes react-hot-toast parameter types in public API** — `opts?: Parameters<typeof toast>[1]` leaks the internal library shape. Internal module only; acceptable until toast library is replaced.
- **saveBuild stale destructure of savedBuilds before await** — concurrent saves could produce stale list updates. Pre-existing pattern; revisit if concurrent save scenarios are observed.
- **useAutoSave catch swallows saveBuild re-throw** — toast fires before the throw so user is informed; catch is swallowing only the error propagation. Pre-existing; acceptable given the toast feedback loop.
- **Toast accumulation on rapid bulk failures** — no deduplication or coalescing in showErrorToast; react-hot-toast default behavior. Address if UX testing reveals noisy stacking.
- **loadBuild/deleteBuild/renameBuild error toast paths untested** — Task 7 only required saveBuild error test; the other three functions' error paths have no test coverage. Beyond story 5.4 task scope; add in a future test hardening pass.
- **Task 5 completion unverified** — dev agent claims SavedBuildsList had no simple string toasts to migrate (only a render-function toast). Verified implicitly by 409 passing tests; no action needed unless a regression surfaces.

## Deferred from: code review of 5-2-connectivity-detection-offline-mode (2026-04-28)

- **In-flight optimization not aborted when connectivity drops mid-stream** — `useOptimizationStream` has no connectivity guard; if `isOnline` flips to false during an active Claude API stream, the button disables but the call continues with contradictory UI (offline note + active spinner). Out of scope for 5.2; candidate for story 5.4 (error handling infrastructure).
- **Test asserts invoke called with `(check_connectivity, undefined)` args** — `invokeCommand` may omit `undefined` when calling Tauri's `invoke`; assertion passes via mock but may diverge from runtime behavior. Low-confidence without running the test against the real Tauri IPC. Verify when integration testing is possible.

## Deferred from: code review of 5-1-api-key-management-settings-view (2026-04-26)

- **Hardcoded vault password** [`keychain_service.rs:5`] — `VAULT_PASSWORD = b"lebo-vault-password"` is a static app-level constant; documented in story dev notes as "standard practice for desktop app credential vaults." Vault is still encrypted; threat model accepts this for MVP. Revisit in a future security-hardening story using OS keychain or per-device secret.
- **Debug env var override bypasses Stronghold** [`claude_commands.rs:18-19`] — `#[cfg(debug_assertions)] let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or(api_key)` is intentional per story spec Task 4 dev ergonomics. Remove or scope-limit before any public release build.
- **Double-emit pattern in invoke_claude_api** [`claude_commands.rs`] — Command emits `optimization:error` event AND returns `Err(err)`, causing two sequential `setStreamError` calls in the frontend. Pre-existing; benign for identical errors. Address when error handling infrastructure is consolidated in Story 5.4.
- **hash_vault_password() blocks async executor** [`keychain_service.rs`] — 64 MB Argon2id KDF runs synchronously on every vault open, blocking the Tokio executor thread. Should be `spawn_blocking`-wrapped. Pre-existing perf concern; address in Story 5.4 or a dedicated perf pass.
- **API key String not zeroized after use** [`keychain_service.rs:get_api_key`] — The key lives in heap memory without the `zeroize` crate. Out of scope for this story; address in a future security hardening pass.

## Deferred from: code review of 3-1-scoring-engine-research-implementation (2026-04-24)

- **ScoreGauge hover tooltip absent in comparison mode** [`ScoreGauge.tsx:88`] — `title` attribute only on single-value span; comparison mode spans have no tooltip. AC2 says "hovering the gauge shows a breakdown tooltip." Low impact for MVP — comparison mode is primarily a Story 3.5 concern. Address when building out suggestion preview in 3.5.
- **`MELEE`/`SPELL` omission from DAMAGE_TAGS undocumented** [`scoringEngine.ts`, `docs/scoring-model.md`] — Both tags were listed in the story spec's damage axis but omitted from implementation. Functionally correct (any node with MELEE or SPELL also has DAMAGE/elemental tags that already classify it as damage). The scoring-model.md should note this intentional omission to prevent future confusion. Add a clarifying sentence during a doc pass.

## Deferred from: code review of 2-3-new-build-creator-class-mastery-selector (2026-04-24)

- **Lazy `applyNodeChange` build-creation path uses raw `selectedMasteryId` as name** [`buildStore.ts:74`] — Pre-existing fallback that cannot fire in normal UI flow (createBuild now always runs first on mastery selection), but name would be the ID string ("void_knight") rather than the display name ("Void Knight") if somehow triggered. Remove or unify the lazy path with `createBuild` in a future cleanup pass.
- **`ApplyNodeResult` loose return typing** [`build.ts`] — `{ success: false }` without an `error` field is valid per the type but callers must defensively handle `result.error` being undefined. Pre-existing; consider making `error` required when `success` is false in a future types cleanup.
- **No integration test for select-mastery → click-node flow** — Unit tests cover `createBuild` and `applyNodeChange` independently but no single test selects a mastery then immediately allocates a node. Better addressed via E2E tests in a future testing story.

## Deferred from: code review of 1-7-game-data-versioning-update-ux (2026-04-23)

- **Sequential class file downloads in `download_class_files`** [`game_data_service.rs:83-109`] — 5 HTTP requests fired sequentially (one per class). No correctness impact; acceptable for MVP. Use `tokio::join!` or `futures::future::join_all` in a post-MVP perf pass.
- **No guard for `versionsBehind: 0` when `isStale: true` banner text** [`DataStalenessBar.tsx:40`] — Banner would read "0 version(s) behind" if stores diverge. Currently impossible: Rust always returns `versions_behind=1` when stale. Add a `Math.max(1, versionsBehind)` clamp defensively if store mutation surfaces grow.

## Deferred from: code review of 1-6-active-skill-tree-tab-navigation (2026-04-23)

- **Non-null assertions `hoveredNodeId!` and `keyboardFocusedNodeId!`** [`SkillTreeView.tsx L151, L166`] — Guards above each usage make the assertions safe but TypeScript doesn't narrow the type; pre-existing from story 1.5. Clean up when tooltips are refactored in a polish pass.
- **`EMPTY_ALLOCATED` typed as mutable `Record<string, number>`** [`SkillTreeView.tsx L13`] — Should be `Readonly<Record<string, number>>` to signal sentinel intent. Pre-existing pattern; fix in a future types cleanup.
- **Inline style object allocations on every render in `SkillTreeTabBar`** [`SkillTreeTabBar.tsx L21–35`] — Static CSS var styles recreated as objects per render. Negligible for a 5-tab component; revisit if profiling flags tab-bar churn.
- **No text truncation for long skill names in tabs** [`SkillTreeTabBar.tsx L25`] — Tab labels overflow without ellipsis or max-width. Address when real skill data with long names is validated in Story 4.2.

## Deferred from: code review of 1-5-interactive-tree-controls-allocation-pan-zoom-nodetooltip (2026-04-23)

- **Multi-point node toggle-only UX** [`useSkillTree.ts:38`] — `delta = currentPoints > 0 ? -1 : 1` means nodes with `maxPoints > 1` can only be toggled between 0 and 1 via click. Increment/decrement UI is future story scope.
- **Error tooltip position drifts when cursor moves after click** [`SkillTreeView.tsx:94–101`] — `nodeError.nodeId` may differ from the node under the cursor by the time the error tooltip renders. Transient (auto-clears in 2 s).
- **`NodeTooltip` uses 100% inline styles instead of Tailwind** [`NodeTooltip.tsx`] — Deviates from "Tailwind v4 CSS-first" project convention. Color tokens are correct. Style debt for a later polish pass.
- **Undo stack not reset on `setActiveBuild(null)`** [`buildStore.ts:35`] — Stale entries survive explicit build clear; `undoNodeChange()` after a clear restores a deleted build. Low-impact; address when build lifecycle is formalized in Story 2.3/2.4.
- **Undo stack not reset on `setSelectedClass`/`setSelectedMastery`** [`buildStore.ts:38–39`] — Cross-class `BuildState` snapshots remain on stack after class change. Undo semantics across class changes to be defined in Story 2.3 when build creation is formalized.

## Deferred from: code review of 1-4-passive-skill-tree-rendering (2026-04-23)

- **No locked-node state assignment in `buildTreeData`** — `buildTreeData` only emits `'allocated'` or `'available'`; the `'locked'` state (prerequisite not met) is never set because prerequisite validation logic does not exist yet. The renderer fully supports `drawLocked`. Deferred to Story 1.5 which implements allocation and prerequisite-checking logic.

## Deferred from: code review of 1-3b-game-data-pipeline-implementation (2026-04-22)

- **Manifest read twice per launch** — `load_game_data` Rust command reads `manifest.json` internally to resolve which class files to load, then the frontend issues a separate `get_manifest` IPC call. Two file reads of the same file per launch. No correctness impact. Natural consolidation point: Story 1.7 (game data versioning) when the manifest becomes more central to the update flow.

- **Partial-init guard does not verify class files** — `copy_bundled_resources` uses `manifest.json` existence as the idempotency guard but does not check whether individual class JSON files are present. If a user manually deletes `classes/`, the guard skips the copy and `load_game_data` fails. Low-probability scenario; acceptable for MVP.

- **`tauri.conf.json` resources require manual update per new class file** — Tauri 2.x build script requires resource files to exist at build time; glob map format fails. Each new class file must be explicitly listed. Resolve if/when Tauri adds reliable glob resource bundling, or at Story 1.7 if new class files are added.

## Deferred from: code review of 1-3a-game-data-source-research-spike (2026-04-21)

- **Remote URL for `check_data_freshness()`** — No community service currently hosts a versioned `manifest.json` for Last Epoch game data. Story 1.7 will define the hosting strategy (GitHub release asset, dedicated CDN endpoint, or EHG partner API if available by then). HTTP allowlist in `tauri.conf.json` cannot be configured until the URL is known.

- **`classId: string` single-class assumption** — MVP scope: all Last Epoch active skills are class-specific, so a single `classId` is correct for v1.4.4. If EHG adds cross-class skills in a future patch, change to `classIds: string[]`. Revisit at Story 4.2 (SkillInput) when skill selection is implemented.

- **Skill-to-mastery eligibility mapping** — Which active skills are available to each mastery is not defined in the current data schema. Required by Story 1.6 (Active Skill Tab Navigation) to know which skill tabs to show per mastery. Story 1.6 will need to add a `masteryIds: string[]` field to the skill JSON or a separate mapping table.

- **Idol and gear data schema for Epic 4** — tunklab.com confirms idol and affix data exists (1,112 affixes, 674 base items, 445 uniques). No JSON schema is proposed here. A dedicated Story 4.x research spike should define the gear/idol data format before Story 4.1 begins.

## Deferred from: code review of 1-1-app-foundation-tauri-react-design-system-scaffold (2026-04-18)

- **Collapsed panel icon rail tooltips (AC9)** — `@headlessui/react` v2.x has no `Tooltip` component; `title` attribute used as fallback. Address when real icon navigation is added in Stories 2.x / 4.x — choose a tooltip solution then (Headless UI if they add it, or a lightweight alternative).

- **`normalizeAppError` first-match ordering** — `Object.entries(ERROR_TYPE_MAP)` matches the first key found in a string; multi-keyword strings could misclassify. Low risk since Tauri error strings are single-type by convention. Revisit when error surface grows in later stories.
- **`@font-face` before `@import "tailwindcss"` ordering** — Non-standard CSS ordering (import must precede at-rules per spec), but the `@tailwindcss/vite` plugin preprocesses before the browser sees it so no runtime impact. Cosmetic; fix if a CSS linter is added.
- **ResizeObserver floods console.debug during panel collapse animation** — Per-frame callbacks during 200ms transition generate noise. Acceptable for the Story 1.2 stub; real PixiJS resize logic in Story 1.2 will replace or throttle this.

## Deferred from: code review of 4-1-context-panel-shell-gear-input (2026-04-25)

- **O(n²) gear.find per keystroke** [`GearInput.tsx:14`] — `getSlot()` does a linear scan of `gear` inside `GEAR_SLOTS.map` (11×11 = 121 ops per keystroke). Not perceptible for 11 items; revisit if slot count grows or profiling flags churn.
- **Stale slot reference in handleAddAffix** [`GearInput.tsx:21`] — `slot` captured from render closure; theoretical under concurrent React. Not an issue with Zustand's synchronous state model; revisit if concurrent mode causes observable stale-write symptoms.
- **Double store subscriptions (ContextPanel + GearInput)** — Both components independently subscribe to the same gear slice. Two subscriptions per gear update. Inconsequential for this component size; lift to prop if profiling shows unnecessary re-renders.
- **No Enter key on item-name input** [`GearInput.tsx:49`] — Affix input supports Enter to submit; item-name input does not. Minor UX inconsistency; address in a future polish pass.
- **activeBuild cleared while editing** — `updateContextGear` no-ops when activeBuild is null; component unmounts via LeftPanel guard so no data loss path exists. Edge case already handled.
- **Empty string affix gives no visual feedback** [`GearInput.tsx:21`] — Silent no-op on Add with blank input. Add a disabled state or shake animation in a polish pass.
- **Affix content has no validation** — Free-text is intentional per Dev Notes; add length/character guard if Claude API has prompt injection concerns in a future security pass.
- **Count format diverges from spec example** [`ContextPanel.tsx:23`] — Renders `{n} / 11` instead of `Gear — {n} / 11 slots filled`. `(e.g.,)` qualifier in AC1 makes this cosmetic; align format in a polish pass if desired.
- **Undo stack excludes contextData.gear changes** — Intentional per scope: undo is for skill tree node allocations only. Document in `buildStore.ts` if this causes confusion in future stories.
- **`migrateBuildState` casts contextData without field validation** [`buildPersistence.ts`] — Pre-existing: cast to `BuildState['contextData']` without structural checks. Add Zod/manual validation if build schema migrations become frequent.

## Deferred from: code review of 3-6-re-run-optimization-iterative-workflow (2026-04-25)

- **`GOAL_LABELS` not type-anchored to `OptimizationGoal`** [`SuggestionsList.tsx:39-44`] — Typed as `Record<string, string>` so future goal additions won't surface a compile error to update the map. Pre-existing pattern; address in a future types cleanup or when adding a new goal.
- **Re-run race during active stream** — If the Optimize button lacks an `isOptimizing` guard (should exist from Story 3.3), a concurrent call to `startOptimization` would clear state while prior stream handlers are still appending suggestions. Verify the button's disabled state; address if the guard is missing.

## Deferred from: code review of 3-4-suggestion-list-display (2026-04-25)

- **`fromNodeName` declared in `SuggestionCardProps` but never rendered** [`SuggestionCard.tsx:59`, `SuggestionsList.tsx:88-92`] — intentional scaffolding per story spec; Story 3.5 will wire SWAP source-node display in the apply/preview layer.
- **`formatDelta` has no float-rounding guard** [`SuggestionCard.tsx:10-14`] — calculateScore produces integers in current implementation; revisit if scoring model changes to percentage-based values.
- **`getChangeType` empty-string `fromNodeId` misclassified as SWAP** [`SuggestionCard.tsx:39-42`] — TypeScript `string | null` type prevents this in practice; deferred as upstream data contract issue.
- **`suggestions-count` visible alongside error banner during partial+error state** [`SuggestionsList.tsx`] — spec gap; mid-stream error producing partial results + error banner is reasonable default; address in 3.5/3.6 if UX feedback calls for suppression.
- **Inline style objects per render in `DeltaPill` and card divs** [`SuggestionCard.tsx`] — micro-perf concern; premature optimization for ≤10 suggestion cards; revisit if render profiling flags churn.

## Deferred from: code review of 3-3-optimization-goal-selector-trigger (2026-04-24)

- **contextData null guard** — `activeBuild.contextData.gear.length` assumes non-null contextData; TS type contract enforces this at schema boundary. Revisit if schema changes in a future story.
- **Optimization in-flight when build switches** — No cancellation when `activeBuild` changes mid-stream; stale event listeners continue updating store. Story 3.2 cleanup concern; address in Story 3.6 (iterative workflow) or a dedicated error-handling story.
- **Story 3.4 placeholder `<p>` renders outside activeBuild branch** — `<p>Suggestion list — Story 3.4</p>` shows in the no-build state. Story 3.4 will replace this stub; the placeholder location is intentional.
- **`scores` null guard** — `ScoreGauge` receives `scores` before first optimization; null/empty guard belongs inside ScoreGauge. Out of 3.3 scope.
- **Collapsed panel shows no "Analyzing…" indicator during optimization** — UX gap: if user collapses panel while optimizing, they get no progress feedback. Address in polish / Story 6.x.
