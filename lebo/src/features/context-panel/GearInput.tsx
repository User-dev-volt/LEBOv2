import { useEffect, useState } from 'react'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { GearItemV2, AffixEntryV2 } from '../../shared/types/build'
import { GEAR_SLOTS } from './gearData'

const EMPTY_GEAR: GearItemV2[] = []

export function GearInput() {
  const gear = useBuildStore((s) => s.activeBuild?.contextData.gear ?? EMPTY_GEAR)
  const activeBuildId = useBuildStore((s) => s.activeBuild?.id ?? null)
  const [pendingAffixes, setPendingAffixes] = useState<Record<string, string>>({})

  useEffect(() => {
    setPendingAffixes({})
  }, [activeBuildId])

  function getSlot(slotId: string): GearItemV2 {
    return gear.find((g) => g.slotId === slotId) ?? { slotId, itemName: '', affixes: [] }
  }

  function handleNameChange(slotId: string, itemName: string) {
    const updated = GEAR_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...getSlot(id), itemName } : getSlot(id)
    )
    useBuildStore.getState().updateContextGear(updated)
  }

  function handleAddAffix(slotId: string) {
    const affix = (pendingAffixes[slotId] ?? '').trim()
    if (!affix) return
    const slot = getSlot(slotId)
    const entry: AffixEntryV2 = { name: affix }
    const updated = GEAR_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...slot, affixes: [...slot.affixes, entry] } : getSlot(id)
    )
    useBuildStore.getState().updateContextGear(updated)
    setPendingAffixes((prev) => ({ ...prev, [slotId]: '' }))
  }

  function handleRemoveAffix(slotId: string, index: number) {
    const slot = getSlot(slotId)
    const updated = GEAR_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...slot, affixes: slot.affixes.filter((_, i) => i !== index) } : getSlot(id)
    )
    useBuildStore.getState().updateContextGear(updated)
  }

  return (
    <div className="flex flex-col gap-3 px-1 pt-1">
      {GEAR_SLOTS.map(({ slotId, label }) => {
        const slot = getSlot(slotId)
        return (
          <div key={slotId} data-testid={`gear-slot-${slotId}`} className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </span>
            <input
              type="text"
              data-testid={`gear-item-name-${slotId}`}
              placeholder="Add item…"
              value={slot.itemName}
              onChange={(e) => handleNameChange(slotId, e.target.value)}
              className="w-full text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-elevated)',
              }}
            />
            {slot.affixes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {slot.affixes.map((affix, i) => (
                  <span
                    key={`${affix.name}-${i}`}
                    data-testid={`gear-affix-tag-${slotId}-${i}`}
                    className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
                  >
                    {affix.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveAffix(slotId, i)}
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label={`Remove affix ${affix.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <input
                type="text"
                data-testid={`gear-affix-input-${slotId}`}
                placeholder="Add affix…"
                value={pendingAffixes[slotId] ?? ''}
                onChange={(e) =>
                  setPendingAffixes((prev) => ({ ...prev, [slotId]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddAffix(slotId)
                }}
                className="flex-1 text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: 'var(--color-bg-base)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-bg-elevated)',
                }}
              />
              <button
                type="button"
                data-testid={`gear-affix-add-${slotId}`}
                onClick={() => handleAddAffix(slotId)}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
              >
                Add
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
