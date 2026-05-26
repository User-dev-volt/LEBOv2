import { IdolGrid } from '../../idol-grid/IdolGrid'
import { useGameDataStore } from '../../../shared/stores/gameDataStore'
import { useBuildStore } from '../../../shared/stores/buildStore'

export function IdolTab() {
  const idolData = useGameDataStore((s) => s.idolData)
  const activeBuild = useBuildStore((s) => s.activeBuild)

  if (!activeBuild) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Create or load a build to manage idols.
        </p>
      </div>
    )
  }

  if (!idolData) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Loading idol data…
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-sm font-semibold uppercase tracking-wide mb-4"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Idols
        </h2>
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-bg-elevated)' }}
        >
          <IdolGrid />
        </div>
      </div>
    </div>
  )
}
