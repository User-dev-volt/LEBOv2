import { useAppStore } from '../../shared/stores/appStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

export function StatusBar() {
  const isOnline = useAppStore((s) => s.isOnline)
  const dataVersion = useGameDataStore((s) => s.dataVersion)
  const dataUpdatedAt = useGameDataStore((s) => s.dataUpdatedAt)

  const dateOnly = dataUpdatedAt ? dataUpdatedAt.split('T')[0] : null

  return (
    <footer
      className="h-6 flex items-center px-4 gap-4 shrink-0 text-xs border-t"
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-bg-hover)',
        color: 'var(--color-text-secondary)',
      }}
    >
      <span
        className="flex items-center gap-1"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: isOnline ? 'var(--color-data-speed)' : 'var(--color-accent-gold)' }}
          aria-hidden="true"
        />
        {isOnline ? 'Online' : 'Offline'}
      </span>
      {dataVersion && (
        <span>Data: {dataVersion}{dateOnly ? ` — ${dateOnly}` : ''}</span>
      )}
    </footer>
  )
}
