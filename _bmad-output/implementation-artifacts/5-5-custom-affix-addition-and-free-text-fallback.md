# Story 5.5: Custom Affix Addition and Free-Text Fallback

Status: done

## Story

As a theory-crafter,
I want to add affixes not pre-loaded on my item (for crafted or fractured gear) by searching the full affix database, and fall back to free-text input if I prefer or can't find my item,
so that I can represent any item in the game regardless of its affix configuration.

## Acceptance Criteria

1. **Given** a GearSlot in "populated-database" state
   **When** the player clicks the "+" button
   **Then** a Headless UI Combobox (`AffixPicker`) opens anchored below the gear card; the player can type to search the full affix database (1,112+ affixes); selecting an affix adds it to the affix list at median tier with an AffixTierControl

2. **Given** the player selects a custom affix from the AffixPicker
   **When** it is added to the slot
   **Then** it appears in the affix list below the item's pre-loaded affixes with a tier control; the player can set its tier/value using the same AffixTierControl from Story 5.3; the affix is stored in the slot's `affixes` string array using the same `"{affixName}: {value}"` encoding as pre-loaded affixes

3. **Given** a gear slot is in "empty" state
   **When** the player clicks the "Free text mode" ghost link
   **Then** the slot transitions to "populated-freetext" state: a 3-row textarea appears; the player can type any gear description; a "Switch to database search" link is visible

4. **Given** a slot is in "populated-freetext" state with text entered
   **When** the build is saved (i.e., on each textarea change)
   **Then** the text is stored as `{ slotId, itemName: freeTextValue, affixes: [] }` in `useBuildStore` via `updateContextGear` — no structured affix data for free-text slots

5. **Given** a slot is in "populated-freetext" state
   **When** the player clicks "Switch to database search"
   **Then** the slot resets to "empty" state: freeText is cleared, Combobox is shown, store entry for this slot is cleared to `{ slotId, itemName: '', affixes: [] }`

6. **And** `AffixPicker` is at `src/features/item-database/AffixPicker.tsx` with no barrel file

7. **And** the free-text fallback textarea is always reachable via the "Free text mode" link in empty state and is never hidden (FR30)

## Tasks / Subtasks

- [x] Task 1: Create `AffixPicker.tsx` at `src/features/item-database/AffixPicker.tsx` (AC: #1, #2, #6)
  - [x] Named export: `export function AffixPicker({ allAffixes, excludeIds, onSelect, onClose }: AffixPickerProps)`
  - [x] Props: `{ allAffixes: AffixEntry[]; excludeIds: string[]; onSelect: (affix: AffixEntry) => void; onClose: () => void }`
  - [x] Local state: `query: string` initialized to `''`
  - [x] `filteredAffixes` via `useMemo`: filter `allAffixes` (excluding `excludeIds`) by `a.name.toLowerCase().includes(query.toLowerCase())`; cap at 8 results
  - [x] Use Headless UI Combobox: `<Combobox<AffixEntry | null> value={null} onChange={(affix) => { if (affix) { onSelect(affix); onClose() } }} immediate>`
  - [x] `ComboboxInput`: `displayValue={() => query}`, `onChange={(e) => setQuery(e.target.value)}`, `placeholder="Search affixes…"`, auto-focus via `autoFocus` prop
  - [x] `ComboboxOptions`: render `filteredAffixes`; each `ComboboxOption` shows `affix.name` + `affix.type` label; use same styling as GearSlot's item Combobox
  - [x] Handle Escape key: `onKeyDown` on the container div — if `e.key === 'Escape'`, call `onClose()`
  - [x] Wrap in `<div className="relative">` with `absolute z-20` positioned dropdown

- [x] Task 2: Modify `GearSlot.tsx` to add free-text mode, `+` button, and custom affix tracking (AC: #1–#5, #7)
  - [x] Add new state:
    - `isFreeText: boolean` (default `false`) — controls free-text mode
    - `freeText: string` (default `''`) — textarea value
    - `affixPickerOpen: boolean` (default `false`) — controls AffixPicker visibility
    - `customAffixIds: string[]` (default `[]`) — ordered list of custom-added affix IDs
  - [x] Add `customResolvedAffixes` derived from `customAffixIds` via `useMemo`:
    - For each id in `customAffixIds`, find in `itemDatabase.affixes`; collect as `ResolvedAffix[]` (same interface already in file)
  - [x] Update `useEffect` on `activeBuildId` reset to also clear `isFreeText`, `freeText`, `affixPickerOpen`, `customAffixIds`
  - [x] Update `handleClear` to also clear `isFreeText`, `freeText`, `affixPickerOpen`, `customAffixIds`
  - [x] Update `handleSelect` (on item select) to also clear `customAffixIds` and `affixPickerOpen` (in case picker was open)
  - [x] Update `writeToStore` to encode both `resolvedAffixes` and `customResolvedAffixes` into the affixes string array (concat, same encoding)
  - [x] Add `handleAddCustomAffix(affix: AffixEntry)`:
    - Append `affix.id` to `customAffixIds`
    - Initialize `affixTiers[affix.id]` to `medianTier(affix)` using functional updater
    - Call `writeToStore` with updated state
    - Close picker: `setAffixPickerOpen(false)`
  - [x] **Empty state (selectedItem === null && !isFreeText)**:
    - Add "Free text mode" ghost link below the Combobox/null-db input:
      ```tsx
      <button
        onClick={() => setIsFreeText(true)}
        className="text-[11px] self-start mt-0.5"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        Free text mode
      </button>
      ```
    - Show this button whether `itemDatabase` is null or not
  - [x] **Free-text state (isFreeText === true)**:
    - Render a `<textarea>` with `rows={3}`, `value={freeText}`, `onChange` writing to store + `setFreeText`
    - Style consistent with other inputs: `backgroundColor: 'var(--color-bg-base)'`, `color: 'var(--color-text-primary)'`, `border: '1px solid var(--color-bg-elevated)'`, `resize: 'none'`, `width: '100%'`, `fontSize: 12`, `padding: '4px 8px'`, `borderRadius: 4`
    - `aria-label={`Free text for ${slotName}`}` on the textarea
    - "Switch to database search" ghost link below textarea:
      ```tsx
      <button
        onClick={() => { setIsFreeText(false); setFreeText(''); writeToStore(null, [], {}) }}
        className="text-[11px] self-start mt-0.5"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        Switch to database search
      </button>
      ```
    - `onChange` for the textarea:
      ```tsx
      onChange={(e) => {
        setFreeText(e.target.value)
        const allGear = useBuildStore.getState().activeBuild?.contextData.gear ?? []
        const otherSlots = allGear.filter((g) => g.slotId !== slotId)
        useBuildStore.getState().updateContextGear([
          ...otherSlots,
          { slotId, itemName: e.target.value, affixes: [] },
        ])
      }}
      ```
  - [x] **Populated-database state (selectedItem !== null)**: add `+` button and AffixPicker below existing affix rows:
    - After the `resolvedAffixes.map(...)` block, add `customResolvedAffixes.map(...)` with the same layout (same AffixTierControl, same `handleTierChange`)
    - Add `+` button at the bottom of the affix list section:
      ```tsx
      <button
        onClick={() => setAffixPickerOpen(true)}
        aria-label={`Add custom affix to ${slotName}`}
        className="text-[11px] self-start mt-1"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        + Add affix
      </button>
      ```
    - Conditionally render `<AffixPicker>` anchored in a `relative` wrapper below the `+` button:
      ```tsx
      {affixPickerOpen && itemDatabase && (
        <div className="relative mt-1">
          <AffixPicker
            allAffixes={itemDatabase.affixes}
            excludeIds={[
              ...resolvedAffixes.map(r => r.affixId),
              ...customAffixIds,
            ]}
            onSelect={handleAddCustomAffix}
            onClose={() => setAffixPickerOpen(false)}
          />
        </div>
      )}
      ```
  - [x] Import `AffixPicker` from `'./AffixPicker'`
  - [x] Ensure TypeScript strict mode: no unused vars, all state typed

- [x] Task 3: Create `AffixPicker.test.tsx` at `src/features/item-database/AffixPicker.test.tsx` (AC: #1, #2)
  - [x] Import `AffixPicker` from `'./AffixPicker'`
  - [x] Use the same `mockAffixes` (subset of the `mockItemDatabase.affixes` from `GearSlot.test.tsx`)
  - [x] Test: renders an input with `placeholder="Search affixes…"`
  - [x] Test: empty query shows first N affixes from allAffixes (up to cap)
  - [x] Test: typing filters to matching affixes by name
  - [x] Test: `excludeIds` hides excluded affixes from results
  - [x] Test: selecting an option calls `onSelect` with the full `AffixEntry` and calls `onClose`
  - [x] Test: pressing Escape calls `onClose`
  - [x] Test: `expect(await axe(container)).toHaveNoViolations()`

- [x] Task 4: Add tests to `GearSlot.test.tsx` for new 5.5 behaviors (AC: #1–#5, #7)
  - [x] Test: "Free text mode" link is visible in empty state
  - [x] Test: clicking "Free text mode" shows a textarea (not the Combobox input)
  - [x] Test: typing in the textarea writes `{ slotId, itemName: text, affixes: [] }` to store
  - [x] Test: "Switch to database search" link in freetext state resets to Combobox
  - [x] Test: "Switch to database search" clears the freetext value in store (writes `itemName: ''`)
  - [x] Test: `+` button visible in populated-database state
  - [x] Test: clicking `+` shows AffixPicker (mock it as a simple stub via `vi.mock` to avoid Headless UI complexity)
  - [x] Test: selecting an affix from AffixPicker adds an AffixTierControl for that affix
  - [x] Test: custom affix tier change updates the encoded affix string in the store

## Dev Notes

### What Story 5.4 left for this story

The 5.4 dev notes explicitly documented that these items are out-of-scope for that story and belong here:

- `GearInput.tsx` in `src/features/context-panel/GearInput.tsx` — **do not touch** (it is still the old Phase 1 free-text input in the ContextPanel Disclosure; it is NOT the same as the new free-text mode in GearSlot). The `GearSlot` free-text mode is independent.
- The `+` custom affix button and `AffixPicker` Combobox
- The "Free text mode" ghost link

### Do NOT introduce GearItemV2 types

Same constraint as 5.4: **do not introduce `GearItemV2` or `AffixEntryV2` types**. That is Story 6.1's job. All affix data continues to be written as `string[]` using the existing `buildAffixStrings` encoding pattern. Custom affixes are encoded the same way.

### Custom affix state management

The `customAffixIds: string[]` state holds the ordered list of custom-added affix IDs. To render custom affixes:

```typescript
const customResolvedAffixes = useMemo<ResolvedAffix[]>(() => {
  if (!itemDatabase || selectedItem === null) return []
  return customAffixIds.flatMap((affixId) => {
    const entry = itemDatabase.affixes.find((a) => a.id === affixId)
    return entry ? [{ affixId, name: entry.name, affixEntry: entry }] : []
  })
}, [customAffixIds, itemDatabase, selectedItem])
```

The existing `affixTiers` Record is shared between pre-loaded and custom affixes — no need for a separate tier state. When `handleAddCustomAffix` is called, it should use the **functional state updater** to avoid closure staleness (same lesson from 5.4 Patch #6):

```typescript
function handleAddCustomAffix(affix: AffixEntry) {
  const initialTier = medianTier(affix)
  setCustomAffixIds((prev) => [...prev, affix.id])
  setAffixTiers((prev) => ({ ...prev, [affix.id]: initialTier }))
  setAffixPickerOpen(false)
  // Write to store must be deferred slightly — the state updaters above are async.
  // Use the current resolvedAffixes from the closure (unchanged by adding a custom affix)
  // and the new customAffixIds / tiers computed inline:
  const newCustomIds = [...customAffixIds, affix.id]
  const newTiers = { ...affixTiersRef.current, [affix.id]: initialTier }
  const newCustomResolved: ResolvedAffix[] = newCustomIds.flatMap((id) => {
    const entry = itemDatabase?.affixes.find((a) => a.id === id)
    return entry ? [{ affixId: id, name: entry.name, affixEntry: entry }] : []
  })
  writeToStore(selectedItem, [...resolvedAffixes, ...newCustomResolved], newTiers)
}
```

**Alternatively**, the simpler pattern: inline the combined list in `writeToStore` rather than tracking them separately:

```typescript
function writeToStore(
  item: SearchResult | null,
  allResolved: ResolvedAffix[],  // pass resolvedAffixes + customResolvedAffixes concatenated
  tiers: Record<string, number>
) { ... }
```

This is already the existing signature (it takes an arbitrary `resolved` list). Use it consistently.

### `writeToStore` call in freetext mode

For free-text, write directly from the `onChange` handler without going through `writeToStore` (which requires a `SearchResult`). This avoids type gymnastics:

```typescript
// In textarea onChange:
const allGear = useBuildStore.getState().activeBuild?.contextData.gear ?? []
const otherSlots = allGear.filter((g) => g.slotId !== slotId)
useBuildStore.getState().updateContextGear([
  ...otherSlots,
  { slotId, itemName: e.target.value, affixes: [] },
])
```

When switching back to database search mode via "Switch to database search":

```typescript
setIsFreeText(false)
setFreeText('')
writeToStore(null, [], {})  // clears the slot in the store
```

### AffixPicker component design

`AffixPicker` is a self-contained search Combobox — it does NOT share state with `GearSlot`; it simply calls `onSelect` with the chosen `AffixEntry` and `onClose` when done. Keep it simple:

```tsx
export function AffixPicker({ allAffixes, excludeIds, onSelect, onClose }: AffixPickerProps) {
  const [query, setQuery] = useState('')

  const filteredAffixes = useMemo(() => {
    return allAffixes
      .filter((a) => !excludeIds.includes(a.id))
      .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
  }, [allAffixes, excludeIds, query])

  return (
    <div onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <Combobox<AffixEntry | null>
        value={null}
        onChange={(affix) => {
          if (affix) {
            onSelect(affix)
            onClose()
          }
        }}
        immediate
      >
        <ComboboxInput
          displayValue={() => query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search affixes…"
          autoFocus
          className="w-full text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: 'var(--color-bg-base)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-bg-elevated)',
          }}
        />
        <ComboboxOptions
          className="absolute z-20 w-full max-h-40 overflow-y-auto rounded mt-1"
          style={{ backgroundColor: 'var(--color-bg-elevated)' }}
        >
          {filteredAffixes.map((affix) => (
            <ComboboxOption
              key={affix.id}
              value={affix}
              className="px-2 py-1 text-xs cursor-pointer data-[focus]:bg-[var(--color-bg-hover)]"
            >
              <span style={{ color: 'var(--color-text-primary)' }}>{affix.name}</span>
              <span className="ml-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {affix.type}
              </span>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </Combobox>
    </div>
  )
}
```

### Ordering: custom affixes after pre-loaded affixes

In the populated-database JSX, render pre-loaded affixes first, then custom affixes, then the `+` button, then the AffixPicker (when open):

```tsx
{/* Pre-loaded affixes from item selection */}
{resolvedAffixes.map((r) => (
  <div key={r.affixId} className="flex items-center gap-2 px-1">
    <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
      {r.name}
    </span>
    <AffixTierControl
      affixEntry={r.affixEntry}
      currentTier={affixTiers[r.affixId] ?? medianTier(r.affixEntry)}
      onChange={(tier) => handleTierChange(r.affixId, tier)}
    />
  </div>
))}

{/* Custom-added affixes */}
{customResolvedAffixes.map((r) => (
  <div key={r.affixId} className="flex items-center gap-2 px-1">
    <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
      {r.name}
    </span>
    <AffixTierControl
      affixEntry={r.affixEntry}
      currentTier={affixTiers[r.affixId] ?? medianTier(r.affixEntry)}
      onChange={(tier) => handleTierChange(r.affixId, tier)}
    />
  </div>
))}

{/* + button */}
<button ... onClick={() => setAffixPickerOpen(true)}>+ Add affix</button>

{/* AffixPicker (when open) */}
{affixPickerOpen && itemDatabase && (
  <div className="relative mt-1">
    <AffixPicker
      allAffixes={itemDatabase.affixes}
      excludeIds={[...resolvedAffixes.map(r => r.affixId), ...customAffixIds]}
      onSelect={handleAddCustomAffix}
      onClose={() => setAffixPickerOpen(false)}
    />
  </div>
)}
```

### Test mock strategy for AffixPicker inside GearSlot tests

Testing the `+` button → AffixPicker → select affix flow requires either:

**Option A**: Mock `AffixPicker` so the test controls what gets selected:
```typescript
vi.mock('./AffixPicker', () => ({
  AffixPicker: ({ onSelect, onClose }: { onSelect: (a: AffixEntry) => void; onClose: () => void }) => (
    <button
      data-testid="mock-affix-picker"
      onClick={() => {
        onSelect(mockItemDatabase.affixes[2])  // Movement Speed affix
        onClose()
      }}
    >
      Pick affix
    </button>
  ),
}))
```

**Option B**: Use the real `AffixPicker` and type into the Combobox input.

Option A is simpler and avoids Headless UI's internal state complexity in tests. Use Option A in `GearSlot.test.tsx`. The real `AffixPicker` gets its own tests in `AffixPicker.test.tsx`.

### AffixPicker tests — Headless UI + jsdom note

`AffixPicker.test.tsx` uses the real Headless UI Combobox. The `autoFocus` prop on `ComboboxInput` may not trigger in jsdom — if focus tests are flaky, skip focus-related assertions and focus on query filtering and click-to-select behavior. The axe check is the most important assertion.

### TypeScript strict mode guard

When adding new state variables, ensure they are all initialized with proper types:
- `const [isFreeText, setIsFreeText] = useState<boolean>(false)`
- `const [freeText, setFreeText] = useState<string>('')`
- `const [affixPickerOpen, setAffixPickerOpen] = useState<boolean>(false)`
- `const [customAffixIds, setCustomAffixIds] = useState<string[]>([])`

The `AffixPickerProps` interface:
```typescript
interface AffixPickerProps {
  allAffixes: AffixEntry[]
  excludeIds: string[]
  onSelect: (affix: AffixEntry) => void
  onClose: () => void
}
```

### Files to modify

- `lebo/src/features/item-database/GearSlot.tsx` — **MODIFY**: add free-text mode, `+` button, AffixPicker integration, custom affix state
- `lebo/src/features/item-database/GearSlot.test.tsx` — **MODIFY**: add 5+ new test cases for 5.5 behaviors

### Files to create

- `lebo/src/features/item-database/AffixPicker.tsx` — **CREATE**: standalone Combobox for affix search
- `lebo/src/features/item-database/AffixPicker.test.tsx` — **CREATE**: unit tests + axe check

### Files NOT to touch

- `src/features/context-panel/GearInput.tsx` — do not remove or modify; it is still the Phase 1 free-text input in ContextPanel
- `src/features/context-panel/ContextPanel.tsx` — no changes
- `src/shared/types/build.ts` — no GearItemV2 in this story
- `src/shared/stores/buildStore.ts` — no schema changes; use existing `updateContextGear`
- `src/shared/stores/gameDataStore.ts` — no changes
- `AffixTierControl.tsx` — no changes needed

### Architecture constraints enforced by this story

- No barrel files: `import { AffixPicker } from '../item-database/AffixPicker'` — direct import
- Named export only: `export function AffixPicker(...)` — no default export
- Tailwind v4: use `var(--color-*)` tokens via inline styles; no `@apply`
- No new Zustand stores; no changes to existing store shape
- No comments in code unless WHY is non-obvious

### Project Structure Notes

All new files go inside the already-established `src/features/item-database/` folder. No new folders needed.

| File | Action |
|------|--------|
| `lebo/src/features/item-database/GearSlot.tsx` | MODIFY |
| `lebo/src/features/item-database/GearSlot.test.tsx` | MODIFY |
| `lebo/src/features/item-database/AffixPicker.tsx` | CREATE |
| `lebo/src/features/item-database/AffixPicker.test.tsx` | CREATE |

### References

- Story 5.3 AffixTierControl spec: [epics.md — Story 5.3] — reuse unchanged; custom affixes use the same component
- Story 5.4 dev notes (GearSlot.tsx current implementation): `_bmad-output/implementation-artifacts/5-4-gearslot-component-with-typeahead-item-search.md`
- Architecture Decision 4 (Item Database Architecture): [architecture.md — Decision 4] — "Item search is TypeScript-only after initial load; never IPC round-trip"
- UX-DR4 (GearSlot ARIA pattern): [epics.md — UX-DR4]
- FR27, FR28, FR29, FR30: [epics.md — Functional Requirements]

### Review Findings

- [x] [Review][Patch] AffixPicker outer `<div>` has no `relative` class — `ComboboxOptions` (`absolute z-20`) will anchor to GearSlot's `<div className="relative mt-1">` wrapper, creating an implicit positioning dependency. If AffixPicker is ever rendered outside that wrapper the dropdown will misposition. Fix: add `relative` to AffixPicker's root `<div>`. [`AffixPicker.tsx:28`]
- [x] [Review][Defer] No removal mechanism for custom affixes [`GearSlot.tsx`] — deferred, out of scope for 5.5; only `handleClear` resets the full slot
- [x] [Review][Defer] `excludeIds.includes()` is O(n×m) — could use a `Set` for O(1) lookup [`AffixPicker.tsx:22`] — deferred, handful of IDs in practice; premature optimization
- [x] [Review][Defer] `+ Add affix` button rendered even when `itemDatabase` is null post-selection — clicking it shows nothing with no feedback [`GearSlot.tsx`] — deferred, game-data failure scenario; `selectedItem` can only be set while `itemDatabase !== null`
- [x] [Review][Defer] `AffixPicker value={null}` + `immediate` prop — if `onClose` doesn't fire synchronously, Headless UI may re-open dropdown on next focus [`AffixPicker.tsx:29`] — deferred, theoretical concurrent-mode edge; tests pass

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Created AffixPicker.tsx — Headless UI Combobox with query filtering (cap 8), excludeIds support, onSelect/onClose callbacks, autoFocus. Escape handler moved to ComboboxInput (outer div does not receive Escape from Headless UI v2).
- Task 2: Modified GearSlot.tsx — added isFreeText/freeText/affixPickerOpen/customAffixIds state; free-text mode with textarea + switch link; + Add affix button + AffixPicker in populated-database state; handleAddCustomAffix computes inline to avoid closure staleness; handleTierChange passes combined resolvedAffixes+customResolvedAffixes.
- Task 3: Created AffixPicker.test.tsx — 7 tests including axe check; all pass.
- Task 4: Added 9 new tests to GearSlot.test.tsx covering all 5.5 behaviors; AffixPicker mocked via vi.mock to avoid Headless UI complexity; all 31 total tests pass.
- Pre-existing test failures confirmed in ProviderSelector, SkillTreeCanvas, TreeControls — not caused by 5.5 changes.

### File List

- lebo/src/features/item-database/AffixPicker.tsx (created)
- lebo/src/features/item-database/AffixPicker.test.tsx (created)
- lebo/src/features/item-database/GearSlot.tsx (modified)
- lebo/src/features/item-database/GearSlot.test.tsx (modified)
