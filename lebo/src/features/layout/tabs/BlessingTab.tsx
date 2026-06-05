import { BlessingsPanel } from '../../blessings/BlessingsPanel'
import { ConditionsPanel } from '../../conditions/ConditionsPanel'
import { useBuildStore } from '../../../shared/stores/buildStore'

export function BlessingTab() {
  const activeBuild = useBuildStore((s) => s.activeBuild)

  if (!activeBuild) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Create or load a build to manage blessings.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-[880px] mx-auto flex flex-col gap-6">
        <div>
          <h2
            className="text-sm font-semibold uppercase tracking-wide mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Blessings
          </h2>
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-bg-elevated)' }}
          >
            <BlessingsPanel />
          </div>
        </div>

        <div>
          <h2
            className="text-sm font-semibold uppercase tracking-wide mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Conditions
          </h2>
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-bg-elevated)' }}
          >
            <ConditionsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
