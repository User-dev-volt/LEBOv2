import { GearSlot } from '../../item-database/GearSlot'
import { GEAR_SLOTS } from '../../context-panel/gearData'
import { useGameDataStore } from '../../../shared/stores/gameDataStore'

export function GearTab() {
  const itemDatabase = useGameDataStore((s) => s.itemDatabase)

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Equipment
          </h2>
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {GEAR_SLOTS.length} slots
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {GEAR_SLOTS.map(({ slotId, label }) => (
            <GearSlot
              key={slotId}
              slotId={slotId}
              slotName={label}
              itemDatabase={itemDatabase}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
