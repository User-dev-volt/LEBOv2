import { useState } from 'react'
import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { SkillRoleDesignator } from './SkillRoleDesignator'

export function GearOptimizationView() {
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const skillRoles = activeBuild?.skillRoles ?? {}
  const hasPrimaryOffense = Object.values(skillRoles).includes('primary_offense')
  const hasAnyRole = Object.keys(skillRoles).length > 0

  function handleAnalyzeGear() {
    if (!hasPrimaryOffense) {
      setAnalyzeError('Please designate at least one skill as Primary Offense before running gear analysis')
      return
    }
    setAnalyzeError(null)
    // Story 5.3 will call invokeCommand('run_gear_scoring', { snapshot }) here
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Header */}
      <header
        className="h-10 flex items-center px-4 border-b shrink-0"
        style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-bg-hover)' }}
      >
        <button
          onClick={() => setCurrentView('main')}
          data-testid="gear-optimization-back-button"
          className="text-xs px-2 py-1 rounded"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Back to main view"
        >
          ← Back
        </button>
        <span className="ml-3 font-semibold text-sm" style={{ color: 'var(--color-accent-gold)' }}>
          Gear Optimization
        </span>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Role designation — always at top */}
        <SkillRoleDesignator />

        {/* Prompt when no roles are set at all */}
        {!hasAnyRole && (
          <p
            data-testid="gear-optimization-no-roles-prompt"
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Designate at least one skill as Primary Offense before running gear analysis.
          </p>
        )}

        {/* Analyze button */}
        <div className="flex flex-col gap-2">
          <button
            data-testid="analyze-gear-button"
            onClick={handleAnalyzeGear}
            className="text-sm px-4 py-2 rounded font-medium"
            style={{
              backgroundColor: 'var(--color-accent-gold)',
              color: 'var(--color-bg-base)',
            }}
          >
            Analyze Gear
          </button>
          {analyzeError && (
            <p
              data-testid="analyze-gear-error"
              className="text-xs"
              style={{ color: 'var(--color-data-negative)' }}
            >
              {analyzeError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
