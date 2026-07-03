import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import type { ItemDatabase, SearchResult } from '../../shared/types/itemDatabase'
import { buildItemSearchIndex, queryItemIndex, type IndexedItem } from './itemSearchIndex'
import { dbSlotsForGearSlot } from './slotMap'
import { getRarityColorForItemType } from '../../shared/utils/rarityColors'
import { SlotGlyph } from './SlotGlyph'

interface ItemPickerModalProps {
  slotId: string
  slotName: string
  itemDatabase: ItemDatabase | null
  onEquip: (item: SearchResult) => void
  onClose: () => void
}

type Collection = 'all' | 'base' | 'unique' | 'set'

const COLLECTIONS: { value: Collection; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'base', label: 'Base' },
  { value: 'unique', label: 'Unique' },
  { value: 'set', label: 'Set' },
]

// Cap rendered cards so the roving grid stays light; the status region surfaces the true match count
// so nothing is silently hidden. Slot-scoping already narrows most slots below this.
const MAX_RENDERED = 200

function toSearchResult(it: IndexedItem): SearchResult {
  return { id: it.id, name: it.name, baseType: it.baseType, slot: it.slot, type: it.type }
}

export function ItemPickerModal({ slotId, slotName, itemDatabase, onEquip, onClose }: ItemPickerModalProps) {
  const dbSlots = useMemo(() => dbSlotsForGearSlot(slotId), [slotId])
  const index = useMemo(() => (itemDatabase ? buildItemSearchIndex(itemDatabase) : null), [itemDatabase])

  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState<Collection>('all')
  const [itemType, setItemType] = useState<string>('all')
  const [maxLevel, setMaxLevel] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Item Type options = the distinct baseTypes available for THIS slot (slot-scoped, and stable
  // across the other filters so the select never empties itself). The honest, sourced analog of the
  // FR-27 "Required Tags" filter — PoB4LE ships no tags field, so baseType is the real categorical.
  const itemTypeOptions = useMemo(() => {
    if (!index) return []
    const inSlot = dbSlots.length > 0 ? index.items.filter((i) => dbSlots.includes(i.slot)) : index.items
    return Array.from(new Set(inSlot.map((i) => i.baseType))).sort((a, b) => a.localeCompare(b))
  }, [index, dbSlots])

  const results = useMemo(() => {
    if (!index) return []
    const base = queryItemIndex(index, query, {
      slots: dbSlots.length > 0 ? dbSlots : undefined,
      collection: collection === 'all' ? undefined : collection,
      maxLevel: maxLevel ?? undefined,
    })
    return itemType === 'all' ? base : base.filter((it) => it.baseType === itemType)
  }, [index, query, dbSlots, collection, maxLevel, itemType])

  const rendered = useMemo(() => results.slice(0, MAX_RENDERED), [results])
  const selected = useMemo(() => rendered.find((r) => r.id === selectedId) ?? null, [rendered, selectedId])

  // Keep the roving focus target valid as filters change.
  useEffect(() => {
    if (rendered.length === 0) {
      setFocusedId(null)
      return
    }
    if (!focusedId || !rendered.some((r) => r.id === focusedId)) {
      setFocusedId(rendered[0].id)
    }
  }, [rendered, focusedId])

  function equip(it: IndexedItem) {
    onEquip(toSearchResult(it))
  }

  function moveFocus(id: string) {
    setFocusedId(id)
    cellRefs.current.get(id)?.focus()
  }

  function handleGridKeyDown(e: React.KeyboardEvent) {
    if (rendered.length === 0) return
    const idx = rendered.findIndex((r) => r.id === focusedId)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      moveFocus(rendered[idx > 0 ? idx - 1 : rendered.length - 1].id)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      moveFocus(rendered[idx < rendered.length - 1 ? idx + 1 : 0].id)
    } else if (e.key === 'Enter' && focusedId) {
      e.preventDefault()
      setSelectedId(focusedId)
    }
    // Escape is handled by the Dialog's onClose (focus-trap + restore).
  }

  const sliderMin = index?.minLevel ?? 0
  const sliderMax = index?.maxLevel ?? 0
  const sliderValue = maxLevel ?? sliderMax
  const capped = results.length > MAX_RENDERED

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className="rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-bg-elevated)' }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Choose {slotName}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close item picker"
              className="text-lg leading-none"
              style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          {itemDatabase === null || index === null ? (
            <div className="px-5 pb-6" style={{ color: 'var(--color-text-muted)' }}>
              <p className="text-sm">Database unavailable</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-5 pb-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search items…"
                  aria-label="Search items"
                  className="w-full text-sm px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-bg-elevated)',
                  }}
                />
              </div>

              <div className="flex-1 min-h-0 flex">
                {/* Sidebar filters — every control is backed by real shipped data (Source Audit). */}
                <aside
                  className="w-48 shrink-0 px-5 py-2 overflow-y-auto flex flex-col gap-4"
                  style={{ borderRight: '1px solid var(--color-bg-elevated)' }}
                >
                  <div role="group" aria-label="Rarity">
                    <p className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      Rarity
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {COLLECTIONS.map((c) => {
                        const active = collection === c.value
                        return (
                          <button
                            key={c.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setCollection(c.value)}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: active ? 'var(--color-bg-hover)' : 'var(--color-bg-elevated)',
                              color: active ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)',
                              border: active
                                ? '1px solid var(--color-accent-gold)'
                                : '1px solid var(--color-bg-elevated)',
                            }}
                          >
                            {c.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="item-type-filter"
                      className="text-[11px] uppercase tracking-wide mb-1.5 block"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Item Type
                    </label>
                    <select
                      id="item-type-filter"
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value)}
                      className="w-full text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: 'var(--color-bg-base)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-bg-elevated)',
                      }}
                    >
                      <option value="all">All types</option>
                      {itemTypeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="item-level-filter"
                      className="text-[11px] uppercase tracking-wide mb-1.5 block"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Item Level ≤ {sliderValue}
                    </label>
                    <input
                      id="item-level-filter"
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      value={sliderValue}
                      onChange={(e) => setMaxLevel(Number(e.target.value))}
                      className="w-full"
                      aria-label="Maximum item level"
                    />
                    <div className="flex justify-between text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{sliderMin}</span>
                      <span>{sliderMax}</span>
                    </div>
                  </div>
                </aside>

                {/* Results */}
                <div className="flex-1 min-h-0 flex flex-col px-5 py-2">
                  <div role="status" aria-live="polite" className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    {results.length === 0
                      ? 'No items match these filters'
                      : capped
                        ? `Showing ${MAX_RENDERED} of ${results.length} items`
                        : `${results.length} item${results.length === 1 ? '' : 's'}`}
                  </div>

                  {rendered.length === 0 ? (
                    <div
                      className="flex-1 flex items-center justify-center text-sm"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Try a different search or filter.
                    </div>
                  ) : (
                  <div
                    role="grid"
                    aria-label={`${slotName} items`}
                    onKeyDown={handleGridKeyDown}
                    className="flex-1 min-h-0 overflow-y-auto"
                  >
                    <div role="row" className="grid grid-cols-2 gap-2">
                      {rendered.map((it) => {
                        const rarityColor = getRarityColorForItemType(it.type)
                        const isSelected = it.id === selectedId
                        const isFocused = it.id === focusedId
                        const isHovered = it.id === hoveredId
                        const showTip = isHovered && it.tooltipLines.length > 0
                        const ttId = `item-tt-${it.id}`
                        // Base items advertise craftable affix slots; uniques and sets are fixed —
                        // show their first real stat line (or a rarity label), never a slot count.
                        const footer =
                          it.type === 'base'
                            ? `${it.affixCount} affix slots`
                            : it.tooltipLines[0] ?? (it.type === 'set' ? 'Set' : 'Unique')
                        return (
                          <button
                            key={it.id}
                            role="gridcell"
                            type="button"
                            aria-selected={isSelected}
                            aria-label={`${it.name}, ${it.baseType}`}
                            aria-describedby={showTip ? ttId : undefined}
                            tabIndex={isFocused ? 0 : -1}
                            ref={(el) => {
                              if (el) cellRefs.current.set(it.id, el)
                              else cellRefs.current.delete(it.id)
                            }}
                            onClick={() => setSelectedId(it.id)}
                            onDoubleClick={() => equip(it)}
                            onMouseEnter={() => setHoveredId(it.id)}
                            onMouseLeave={() => setHoveredId((h) => (h === it.id ? null : h))}
                            onFocus={() => {
                              setFocusedId(it.id)
                              setHoveredId(it.id)
                            }}
                            onBlur={() => setHoveredId((h) => (h === it.id ? null : h))}
                            className="relative text-left rounded p-2 flex gap-2 items-start"
                            style={{
                              backgroundColor: isSelected ? 'var(--color-bg-hover)' : 'var(--color-bg-elevated)',
                              border: isSelected
                                ? '1px solid var(--color-accent-gold)'
                                : '1px solid var(--color-bg-elevated)',
                              cursor: 'pointer',
                            }}
                          >
                            <span className="shrink-0 mt-0.5">
                              <SlotGlyph slotId={slotId} color={rarityColor} />
                            </span>
                            <span className="flex flex-col min-w-0">
                              <span className="text-[13px] font-semibold truncate" style={{ color: rarityColor }}>
                                {it.name}
                              </span>
                              <span className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                                {it.baseType}
                              </span>
                              <span className="text-[11px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                {footer}
                              </span>
                            </span>
                            {showTip && (
                              <span
                                role="tooltip"
                                id={ttId}
                                className="absolute z-10 left-2 top-full mt-1 rounded p-2 text-[11px] flex flex-col gap-0.5 shadow-lg"
                                style={{
                                  backgroundColor: 'var(--color-bg-base)',
                                  border: '1px solid var(--color-bg-elevated)',
                                  color: 'var(--color-text-secondary)',
                                  minWidth: 180,
                                }}
                              >
                                {it.tooltipLines.map((line, i) => (
                                  <span key={i}>{line}</span>
                                ))}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  )}
                </div>
              </div>

              <div
                className="flex items-center justify-end gap-3 px-5 py-3"
                style={{ borderTop: '1px solid var(--color-bg-elevated)' }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-sm rounded"
                  style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-bg-hover)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => selected && equip(selected)}
                  className="px-4 py-1.5 text-sm rounded font-medium"
                  style={{
                    backgroundColor: selected ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)',
                    color: selected ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
                    border: 'none',
                    cursor: selected ? 'pointer' : 'not-allowed',
                  }}
                >
                  Equip Item
                </button>
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
