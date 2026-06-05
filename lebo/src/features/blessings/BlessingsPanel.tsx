import { useMemo } from 'react'
import type { BlessingEntry } from '../../shared/types/contextDatabase'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'

const EMPTY_BLESSINGS_DB: BlessingEntry[] = []
const EMPTY_BLESSINGS: Record<string, string | null> = {}

interface TimelineGroup {
  timelineId: string
  timelineName: string
  entries: BlessingEntry[]
}

function formatStatEffects(entry: BlessingEntry): string {
  return entry.statEffects
    .map(
      (e) =>
        `${e.modifierType === 'increased' ? '+' : ''}${e.value}${e.modifierType !== 'flat' ? '%' : ''} ${e.statKey.replace(/_/g, ' ')}`,
    )
    .join(', ')
}

function OptionRow({
  label,
  ariaLabel,
  summary,
  isActive,
  onClick,
}: {
  label: string
  ariaLabel?: string
  summary?: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isActive}
      onClick={onClick}
      className="w-full text-left rounded px-2 py-1 flex flex-col"
      style={{
        border: `1px solid ${isActive ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)'}`,
        backgroundColor: isActive ? 'var(--color-bg-hover)' : 'transparent',
        color: isActive ? 'var(--color-accent-gold-soft)' : 'var(--color-text-secondary)',
      }}
    >
      <span className="text-xs">{label}</span>
      {summary && (
        <span
          className="text-[0.6rem]"
          style={{ color: isActive ? 'var(--color-accent-gold-soft)' : 'var(--color-text-muted)' }}
        >
          {summary}
        </span>
      )}
    </button>
  )
}

function BlessingCard({
  group,
  selectedId,
  onSelect,
}: {
  group: TimelineGroup
  selectedId: string | null | undefined
  onSelect: (timelineId: string, blessingId: string | null) => void
}) {
  const hasActive = selectedId != null && group.entries.some((b) => b.id === selectedId)

  return (
    <div
      data-testid={`blessing-card-${group.timelineId}`}
      className="rounded-lg p-2.5"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: `1px solid ${hasActive ? 'var(--color-accent-gold-dim)' : 'var(--color-bg-elevated)'}`,
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: hasActive ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)' }}
      >
        {group.timelineName}
      </p>
      <div className="flex flex-col gap-1">
        <OptionRow
          label="None"
          ariaLabel={`None — ${group.timelineName}`}
          isActive={selectedId == null}
          onClick={() => onSelect(group.timelineId, null)}
        />
        {group.entries.map((entry) => (
          <OptionRow
            key={entry.id}
            label={entry.displayName}
            summary={formatStatEffects(entry)}
            isActive={selectedId === entry.id}
            onClick={() => onSelect(group.timelineId, entry.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function BlessingsPanel() {
  const blessingsDatabase = useGameDataStore((s) => s.blessingsDatabase ?? EMPTY_BLESSINGS_DB)
  const isBlessingsDataStale = useGameDataStore((s) => s.isBlessingsDataStale)
  const blessingsDataStaleAcknowledged = useGameDataStore((s) => s.blessingsDataStaleAcknowledged)
  const acknowledgeBlessingsDataStaleness = useGameDataStore((s) => s.acknowledgeBlessingsDataStaleness)

  const blessings = useBuildStore((s) => s.activeBuild?.blessings ?? EMPTY_BLESSINGS)
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
          >
            Dismiss
          </button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        {timelineGroups.map((group) => (
          <BlessingCard
            key={group.timelineId}
            group={group}
            selectedId={blessings[group.timelineId]}
            onSelect={setBlessing}
          />
        ))}
      </div>
    </div>
  )
}
