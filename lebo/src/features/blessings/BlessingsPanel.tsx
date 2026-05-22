import { useMemo, useState } from 'react'
import type { BlessingEntry } from '../../shared/types/contextDatabase'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'

interface TimelineGroup {
  timelineId: string
  timelineName: string
  entries: BlessingEntry[]
}

function TimelineRow({
  group,
  selectedId,
  onSelect,
}: {
  group: TimelineGroup
  selectedId: string | null | undefined
  onSelect: (timelineId: string, blessingId: string | null) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = searchTerm
    ? group.entries.filter(
        (b) =>
          b.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.statEffects.some((e) => e.statKey.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    : group.entries

  const selectedBlessing = selectedId
    ? group.entries.find((b) => b.id === selectedId)
    : undefined

  return (
    <div className="mb-2">
      <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
        {group.timelineName}
      </p>
      <input
        type="text"
        placeholder="Search…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label={`Search blessings for ${group.timelineName}`}
        className="w-full text-xs rounded px-1.5 py-0.5"
        style={{
          backgroundColor: 'var(--color-bg-base)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
        }}
      />
      <select
        value={selectedId ?? ''}
        onChange={(e) => onSelect(group.timelineId, e.target.value || null)}
        aria-label={`Select blessing for ${group.timelineName}`}
        className="w-full text-xs rounded px-1 py-0.5 mt-0.5"
        style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
      >
        <option value="">— None —</option>
        {filtered.map((b) => (
          <option key={b.id} value={b.id}>
            {b.displayName}
          </option>
        ))}
      </select>
      {selectedBlessing && (
        <p
          aria-label={`Active blessing: ${selectedBlessing.displayName}`}
          style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '2px' }}
        >
          {selectedBlessing.statEffects
            .map(
              (e) =>
                `${e.modifierType === 'increased' ? '+' : ''}${e.value}${e.modifierType !== 'flat' ? '%' : ''} ${e.statKey.replace(/_/g, ' ')}`,
            )
            .join(', ')}
        </p>
      )}
    </div>
  )
}

export function BlessingsPanel() {
  const blessingsDatabase = useGameDataStore((s) => s.blessingsDatabase ?? [])
  const isBlessingsDataStale = useGameDataStore((s) => s.isBlessingsDataStale)
  const blessingsDataStaleAcknowledged = useGameDataStore((s) => s.blessingsDataStaleAcknowledged)
  const acknowledgeBlessingsDataStaleness = useGameDataStore((s) => s.acknowledgeBlessingsDataStaleness)

  const blessings = useBuildStore((s) => s.activeBuild?.blessings ?? {})
  const setBlessing = useBuildStore((s) => s.setBlessing)

  const timelineGroups = useMemo<TimelineGroup[]>(() => {
    const map = new Map<string, TimelineGroup>()
    for (const b of blessingsDatabase) {
      if (!map.has(b.timelineId)) {
        map.set(b.timelineId, { timelineId: b.timelineId, timelineName: b.timelineName, entries: [] })
      }
      map.get(b.timelineId)!.entries.push(b)
    }
    return Array.from(map.values())
  }, [blessingsDatabase])

  if (blessingsDatabase.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-text-muted)', padding: '4px 0' }}>
        Blessings data not loaded.
      </p>
    )
  }

  return (
    <div data-testid="blessings-panel" className="pt-1">
      {isBlessingsDataStale && !blessingsDataStaleAcknowledged && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between px-2 py-1 rounded text-xs mb-2"
          style={{ backgroundColor: 'var(--color-accent-gold-soft)', color: 'var(--color-bg-base)' }}
        >
          <span>Blessings data may be outdated</span>
          <button
            onClick={acknowledgeBlessingsDataStaleness}
            aria-label="Dismiss blessings staleness notice"
            className="opacity-75 hover:opacity-100 ml-2"
            style={{ outline: 'none' }}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent-gold)' }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
          >
            Dismiss
          </button>
        </div>
      )}
      {timelineGroups.map((group) => (
        <TimelineRow
          key={group.timelineId}
          group={group}
          selectedId={blessings[group.timelineId]}
          onSelect={setBlessing}
        />
      ))}
    </div>
  )
}
