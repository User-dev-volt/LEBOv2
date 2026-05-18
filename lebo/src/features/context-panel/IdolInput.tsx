import { useEffect, useState } from 'react'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { IdolItem } from '../../shared/types/build'
import { IDOL_SLOTS } from './idolData'

export function IdolInput() {
  const idols = useBuildStore((s) => s.activeBuild?.contextData.idols ?? [])
  const activeBuildId = useBuildStore((s) => s.activeBuild?.id ?? null)
  const [pendingModifiers, setPendingModifiers] = useState<Record<string, string>>({})

  useEffect(() => {
    setPendingModifiers({})
  }, [activeBuildId])

  function getSlot(slotId: string): IdolItem {
    return idols.find((i) => i.slotId === slotId) ?? { slotId, idolType: '', modifiers: [] }
  }

  function handleTypeChange(slotId: string, idolType: string) {
    const updated = IDOL_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...getSlot(id), idolType } : getSlot(id)
    )
    useBuildStore.getState().updateContextIdols(updated)
  }

  function handleAddModifier(slotId: string) {
    const modifier = (pendingModifiers[slotId] ?? '').trim()
    if (!modifier) return
    const slot = getSlot(slotId)
    const updated = IDOL_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...slot, modifiers: [...slot.modifiers, modifier] } : getSlot(id)
    )
    useBuildStore.getState().updateContextIdols(updated)
    setPendingModifiers((prev) => ({ ...prev, [slotId]: '' }))
  }

  function handleRemoveModifier(slotId: string, index: number) {
    const slot = getSlot(slotId)
    const updated = IDOL_SLOTS.map(({ slotId: id }) =>
      id === slotId ? { ...slot, modifiers: slot.modifiers.filter((_, i) => i !== index) } : getSlot(id)
    )
    useBuildStore.getState().updateContextIdols(updated)
  }

  return (
    <div className="flex flex-col gap-3 px-1 pt-1">
      {IDOL_SLOTS.map(({ slotId, label }) => {
        const slot = getSlot(slotId)
        return (
          <div key={slotId} data-testid={`idol-slot-${slotId}`} className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </span>
            <input
              type="text"
              data-testid={`idol-type-${slotId}`}
              placeholder="Add idol type…"
              value={slot.idolType}
              onChange={(e) => handleTypeChange(slotId, e.target.value)}
              className="w-full text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-elevated)',
              }}
            />
            {slot.modifiers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {slot.modifiers.map((modifier, i) => (
                  <span
                    key={`${modifier}-${i}`}
                    data-testid={`idol-modifier-tag-${slotId}-${i}`}
                    className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
                  >
                    {modifier}
                    <button
                      type="button"
                      onClick={() => handleRemoveModifier(slotId, i)}
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label={`Remove modifier ${modifier}`}
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
                data-testid={`idol-modifier-input-${slotId}`}
                placeholder="Add modifier…"
                value={pendingModifiers[slotId] ?? ''}
                onChange={(e) =>
                  setPendingModifiers((prev) => ({ ...prev, [slotId]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddModifier(slotId)
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
                data-testid={`idol-modifier-add-${slotId}`}
                onClick={() => handleAddModifier(slotId)}
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
