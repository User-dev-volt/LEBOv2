import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/react'
import { AffixTierControl } from './AffixTierControl'
import { AffixPicker } from './AffixPicker'
import type { ItemDatabase, AffixEntry, SearchResult } from '../../shared/types/itemDatabase'
import type { AffixEntryV2 } from '../../shared/types/build'
import { useBuildStore } from '../../shared/stores/buildStore'
import { searchItems } from './itemSearch'
import { getRarityColorForItemType } from '../../shared/utils/rarityColors'

interface ResolvedAffix {
  affixId: string
  name: string
  affixEntry: AffixEntry
}

interface GearSlotProps {
  slotId: string
  slotName: string
  itemDatabase: ItemDatabase | null
}

function medianTier(affixEntry: AffixEntry): number {
  return Math.ceil(affixEntry.tiers.length / 2)
}

function resolveAffixes(item: SearchResult, itemDatabase: ItemDatabase): ResolvedAffix[] {
  if (item.type === 'base') {
    const baseItem = itemDatabase.baseItems.find((b) => b.id === item.id)
    if (!baseItem) return []
    return baseItem.implicitAffixIds.flatMap((affixId) => {
      const entry = itemDatabase.affixes.find((a) => a.id === affixId)
      return entry ? [{ affixId, name: entry.name, affixEntry: entry }] : []
    })
  } else {
    const uniqueItem = itemDatabase.uniqueItems.find((u) => u.id === item.id)
    if (!uniqueItem) return []
    return uniqueItem.affixes.flatMap(({ affixId }) => {
      const entry = itemDatabase.affixes.find((a) => a.id === affixId)
      return entry ? [{ affixId, name: entry.name, affixEntry: entry }] : []
    })
  }
}

function buildAffixEntries(
  resolved: ResolvedAffix[],
  tiers: Record<string, number>
): AffixEntryV2[] {
  // value intentionally omitted — story 7-5 will resolve min/max from the item DB at prompt-build time.
  return resolved.map((r) => {
    const tier = tiers[r.affixId] ?? medianTier(r.affixEntry)
    return { affixId: r.affixId, name: r.name, tier }
  })
}

export function GearSlot({ slotId, slotName, itemDatabase }: GearSlotProps) {
  const [query, setQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null)
  const [affixTiers, setAffixTiers] = useState<Record<string, number>>({})
  const affixTiersRef = useRef<Record<string, number>>({})
  affixTiersRef.current = affixTiers

  const [isFreeText, setIsFreeText] = useState<boolean>(false)
  const [freeText, setFreeText] = useState<string>('')
  const [affixPickerOpen, setAffixPickerOpen] = useState<boolean>(false)
  const [customAffixIds, setCustomAffixIds] = useState<string[]>([])

  const activeBuildId = useBuildStore((s) => s.activeBuild?.id ?? null)

  useEffect(() => {
    setQuery('')
    setSelectedItem(null)
    setAffixTiers({})
    setIsFreeText(false)
    setFreeText('')
    setAffixPickerOpen(false)
    setCustomAffixIds([])
  }, [activeBuildId])

  const searchResults = useMemo(() => {
    if (!itemDatabase || query.trim().length < 1) return []
    return searchItems(query, itemDatabase).slice(0, 6)
  }, [query, itemDatabase])

  const resolvedAffixes = useMemo<ResolvedAffix[]>(() => {
    if (!selectedItem || !itemDatabase) return []
    return resolveAffixes(selectedItem, itemDatabase)
  }, [selectedItem, itemDatabase])

  const customResolvedAffixes = useMemo<ResolvedAffix[]>(() => {
    if (!itemDatabase || selectedItem === null) return []
    return customAffixIds.flatMap((affixId) => {
      const entry = itemDatabase.affixes.find((a) => a.id === affixId)
      return entry ? [{ affixId, name: entry.name, affixEntry: entry }] : []
    })
  }, [customAffixIds, itemDatabase, selectedItem])

  function writeToStore(
    item: SearchResult | null,
    resolved: ResolvedAffix[],
    tiers: Record<string, number>
  ) {
    const allGear = useBuildStore.getState().activeBuild?.contextData.gear ?? []
    const otherSlots = allGear.filter((g) => g.slotId !== slotId)

    if (!item) {
      useBuildStore.getState().updateContextGear([
        ...otherSlots,
        { slotId, itemName: '', affixes: [] },
      ])
      return
    }

    const affixEntries = buildAffixEntries(resolved, tiers)
    useBuildStore.getState().updateContextGear([
      ...otherSlots,
      { slotId, itemName: item.name, affixes: affixEntries },
    ])
  }

  function handleSelect(item: SearchResult | null) {
    if (!item) {
      handleClear()
      return
    }
    setSelectedItem(item)
    setQuery('')
    setCustomAffixIds([])
    setAffixPickerOpen(false)
    const resolved = itemDatabase ? resolveAffixes(item, itemDatabase) : []
    const initialTiers: Record<string, number> = {}
    for (const r of resolved) {
      initialTiers[r.affixId] = medianTier(r.affixEntry)
    }
    setAffixTiers(initialTiers)
    writeToStore(item, resolved, initialTiers)
  }

  function handleClear() {
    setSelectedItem(null)
    setQuery('')
    setAffixTiers({})
    setIsFreeText(false)
    setFreeText('')
    setAffixPickerOpen(false)
    setCustomAffixIds([])
    writeToStore(null, [], {})
  }

  function handleTierChange(affixId: string, tier: number) {
    if (selectedItem?.type === 'unique') return
    const nextTiers = { ...affixTiersRef.current, [affixId]: tier }
    setAffixTiers(nextTiers)
    writeToStore(selectedItem, [...resolvedAffixes, ...customResolvedAffixes], nextTiers)
  }

  function handleAddCustomAffix(affix: AffixEntry) {
    const initialTier = medianTier(affix)
    const newCustomIds = [...customAffixIds, affix.id]
    const newTiers = { ...affixTiersRef.current, [affix.id]: initialTier }
    setCustomAffixIds(newCustomIds)
    setAffixTiers(newTiers)
    setAffixPickerOpen(false)
    const newCustomResolved: ResolvedAffix[] = newCustomIds.flatMap((id) => {
      const entry = itemDatabase?.affixes.find((a) => a.id === id)
      return entry ? [{ affixId: id, name: entry.name, affixEntry: entry }] : []
    })
    writeToStore(selectedItem, [...resolvedAffixes, ...newCustomResolved], newTiers)
  }

  return (
    <div
      role="group"
      aria-label={`${slotName} slot`}
      className="flex flex-col gap-1 py-2 px-3"
      style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}
    >
      {isFreeText ? (
        <>
          <textarea
            rows={3}
            value={freeText}
            aria-label={`Free text for ${slotName}`}
            onChange={(e) => {
              setFreeText(e.target.value)
              const allGear = useBuildStore.getState().activeBuild?.contextData.gear ?? []
              const otherSlots = allGear.filter((g) => g.slotId !== slotId)
              useBuildStore.getState().updateContextGear([
                ...otherSlots,
                { slotId, itemName: e.target.value, affixes: [] },
              ])
            }}
            style={{
              backgroundColor: 'var(--color-bg-base)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-elevated)',
              resize: 'none',
              width: '100%',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 4,
            }}
          />
          <button
            onClick={() => {
              setIsFreeText(false)
              setFreeText('')
              writeToStore(null, [], {})
            }}
            className="text-[11px] self-start mt-0.5"
            style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Switch to database search
          </button>
        </>
      ) : selectedItem === null ? (
        itemDatabase === null ? (
          <>
            <input
              type="text"
              placeholder={slotName}
              className="w-full text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-elevated)',
              }}
              onChange={(e) => {
                const allGear = useBuildStore.getState().activeBuild?.contextData.gear ?? []
                const otherSlots = allGear.filter((g) => g.slotId !== slotId)
                useBuildStore.getState().updateContextGear([
                  ...otherSlots,
                  { slotId, itemName: e.target.value, affixes: [] },
                ])
              }}
            />
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Database unavailable
            </span>
            <button
              onClick={() => setIsFreeText(true)}
              className="text-[11px] self-start mt-0.5"
              style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Free text mode
            </button>
          </>
        ) : (
          <>
            <div className="relative">
              <Combobox<SearchResult | null>
                value={selectedItem}
                onChange={handleSelect}
                immediate
              >
                <div className="flex items-center gap-1">
                  <ComboboxInput
                    displayValue={() => query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search items…"
                    className="w-full text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--color-bg-base)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-bg-elevated)',
                    }}
                  />
                  <ComboboxButton className="shrink-0 text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>
                    ▾
                  </ComboboxButton>
                </div>
                <ComboboxOptions
                  className="absolute z-10 w-full max-h-40 overflow-y-auto rounded mt-1"
                  style={{ backgroundColor: 'var(--color-bg-elevated)' }}
                >
                  {searchResults.map((result) => (
                    <ComboboxOption
                      key={result.id}
                      value={result}
                      className="px-2 py-1 text-xs cursor-pointer data-[focus]:bg-[var(--color-bg-hover)]"
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>{result.name}</span>
                      <span
                        className="ml-2 text-[10px]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {result.baseType}
                      </span>
                    </ComboboxOption>
                  ))}
                </ComboboxOptions>
              </Combobox>
            </div>
            <button
              onClick={() => setIsFreeText(true)}
              className="text-[11px] self-start mt-0.5"
              style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Free text mode
            </button>
          </>
        )
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span
                className="text-[14px] font-semibold truncate"
                style={{ color: getRarityColorForItemType(selectedItem.type) }}
              >
                {selectedItem.name}
              </span>
              <span
                className="text-[12px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {selectedItem.baseType}
              </span>
            </div>
            <button
              onClick={handleClear}
              aria-label={`Clear ${slotName}`}
              className="shrink-0 text-sm leading-none"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ×
            </button>
          </div>
          {selectedItem.type === 'unique' ? (
            /* Unique item: affixes are fixed — display read-only, no tier controls */
            resolvedAffixes.map((r) => (
              <div key={r.affixId} className="flex items-center px-1 py-0.5">
                <span
                  className="text-[13px] truncate"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {r.name}
                </span>
              </div>
            ))
          ) : (
            /* Base item: affixes are editable */
            <>
              {resolvedAffixes.map((r) => (
                <div key={r.affixId} className="flex items-center gap-2 px-1">
                  <span
                    className="flex-1 text-[13px] truncate"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {r.name}
                  </span>
                  <AffixTierControl
                    affixEntry={r.affixEntry}
                    currentTier={affixTiers[r.affixId] ?? medianTier(r.affixEntry)}
                    onChange={(tier) => handleTierChange(r.affixId, tier)}
                  />
                </div>
              ))}
              {customResolvedAffixes.map((r) => (
                <div key={r.affixId} className="flex items-center gap-2 px-1">
                  <span
                    className="flex-1 text-[13px] truncate"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {r.name}
                  </span>
                  <AffixTierControl
                    affixEntry={r.affixEntry}
                    currentTier={affixTiers[r.affixId] ?? medianTier(r.affixEntry)}
                    onChange={(tier) => handleTierChange(r.affixId, tier)}
                  />
                </div>
              ))}
              <button
                onClick={() => setAffixPickerOpen(true)}
                aria-label={`Add custom affix to ${slotName}`}
                className="text-[11px] self-start mt-1"
                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                + Add affix
              </button>
              {affixPickerOpen && itemDatabase && (
                <div className="relative mt-1">
                  <AffixPicker
                    allAffixes={itemDatabase.affixes}
                    excludeIds={[
                      ...resolvedAffixes.map((r) => r.affixId),
                      ...customAffixIds,
                    ]}
                    onSelect={handleAddCustomAffix}
                    onClose={() => setAffixPickerOpen(false)}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
