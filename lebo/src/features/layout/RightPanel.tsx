import { useState, useEffect } from 'react'
import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { startOptimization } from '../../shared/stores/useOptimizationStream'
import { PanelCollapseToggle } from './PanelCollapseToggle'
import { ScoreGauge } from '../optimization/ScoreGauge'
import { OptimizationSlider } from '../optimization/OptimizationSlider'
import { FineTunePanel } from '../optimization/FineTunePanel'
import { OptimizeButton } from '../optimization/OptimizeButton'
import { SuggestionsList } from '../optimization/SuggestionsList'
import { GearSlot } from '../item-database/GearSlot'
import { GEAR_SLOTS } from '../context-panel/gearData'
import { StatSheetPanel } from '../stat-sheet/StatSheetPanel'

export function RightPanel() {
  const isCollapsed = useAppStore((s) => s.activePanel.right === 'collapsed')
  const isOnline = useAppStore((s) => s.isOnline)
  const isOnlineChecked = useAppStore((s) => s.isOnlineChecked)
  const setPanelState = useAppStore((s) => s.setPanelState)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const scores = useOptimizationStore((s) => s.scores)
  const isOptimizing = useOptimizationStore((s) => s.isOptimizing)
  const currentModel = useOptimizationStore((s) => s.currentModel)
  const previewSuggestionRank = useOptimizationStore((s) => s.previewSuggestionRank)
  const suggestions = useOptimizationStore((s) => s.suggestions)
  const itemDatabase = useGameDataStore((s) => s.itemDatabase)

  const previewScore =
    previewSuggestionRank !== null
      ? (suggestions.find((s) => s.rank === previewSuggestionRank)?.previewScore ?? null)
      : null

  const [isBannerDismissed, setIsBannerDismissed] = useState(false)

  useEffect(() => {
    setIsBannerDismissed(false)
  }, [activeBuild?.id])

  const isEmptyContext =
    !!activeBuild &&
    activeBuild.contextData.gear.every((g) => g.itemName.trim() === '') &&
    activeBuild.contextData.skills.length === 0 &&
    activeBuild.contextData.idols.length === 0

  const showContextNote = isEmptyContext && !isBannerDismissed

  return (
    <aside
      className="relative shrink-0 flex flex-col border-l overflow-hidden transition-[width] duration-200"
      style={{
        width: isCollapsed ? '48px' : '320px',
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-bg-elevated)',
      }}
      aria-label="Right panel"
    >
      <PanelCollapseToggle
        side="right"
        isCollapsed={isCollapsed}
        onToggle={() => setPanelState('right', isCollapsed ? 'expanded' : 'collapsed')}
      />

      {isCollapsed ? (
        <div className="flex flex-col items-center pt-3 gap-3 px-2">
          <span
            className="text-xs"
            title="Optimization"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✦
          </span>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Upper: Gear Context — independently scrollable */}
          <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-0 pt-3 pb-1">
            <p
              className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Gear
            </p>
            {GEAR_SLOTS.map(({ slotId, label }) => (
              <GearSlot
                key={slotId}
                slotId={slotId}
                slotName={label}
                itemDatabase={itemDatabase}
              />
            ))}
          </div>

          {/* Middle: Stat Sheet */}
          <div
            className="shrink-0 overflow-y-auto border-t"
            style={{ borderColor: 'var(--color-bg-elevated)', maxHeight: '280px' }}
          >
            <StatSheetPanel />
          </div>

          {/* Lower: Optimization — pinned, never scrolls off */}
          <div
            className="shrink-0 flex flex-col gap-4 p-4 overflow-y-auto border-t"
            style={{ borderColor: 'var(--color-bg-elevated)' }}
          >
            {activeBuild ? (
              <>
                <ScoreGauge baselineScore={scores} previewScore={previewScore} />
                <OptimizationSlider />
                <FineTunePanel />
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Select a build to see scores
              </p>
            )}

            <OptimizeButton
              onOptimize={startOptimization}
              disabled={!activeBuild || !isOnline}
              isOptimizing={isOptimizing}
            />

            {isOptimizing && currentModel && (
              <p
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
                data-testid="current-model-indicator"
              >
                Using: {currentModel}
              </p>
            )}

            {isOnlineChecked && !isOnline && (
              <p
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
                data-testid="offline-note"
              >
                AI optimization requires internet connectivity. Connect to the internet and retry.
              </p>
            )}

            {showContextNote && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded text-xs"
                style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-muted)',
                }}
                data-testid="context-note"
              >
                <span className="flex-1">
                  Add gear, skills, and idols in the context panel for more relevant suggestions.
                </span>
                <button
                  onClick={() => setIsBannerDismissed(true)}
                  aria-label="Dismiss"
                  className="shrink-0 leading-none"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  ×
                </button>
              </div>
            )}

            <SuggestionsList onRetry={startOptimization} />
          </div>
        </div>
      )}
    </aside>
  )
}
