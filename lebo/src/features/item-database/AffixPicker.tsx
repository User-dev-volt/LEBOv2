import { useState, useMemo } from 'react'
import {
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/react'
import type { AffixEntry } from '../../shared/types/itemDatabase'

interface AffixPickerProps {
  allAffixes: AffixEntry[]
  excludeIds: string[]
  onSelect: (affix: AffixEntry) => void
  onClose: () => void
}

export function AffixPicker({ allAffixes, excludeIds, onSelect, onClose }: AffixPickerProps) {
  const [query, setQuery] = useState('')

  const filteredAffixes = useMemo(() => {
    return allAffixes
      .filter((a) => !excludeIds.includes(a.id))
      .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
  }, [allAffixes, excludeIds, query])

  return (
    <div className="relative">
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
          onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
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
