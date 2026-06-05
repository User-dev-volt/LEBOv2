import { useState, useEffect } from 'react'
import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { startOptimization } from '../../shared/stores/useOptimizationStream'
import { PanelCollapseToggle } from './PanelCollapseToggle'
import { ScoreGauge } from '../optimization/ScoreGauge'
import { ScoreTrio } from '../optimization/ScoreTrio'
import { OptimizationSlider } from '../optimization/OptimizationSlider'
import { FineTunePanel } from '../optimization/FineTunePanel'
import { OptimizeButton } from '../optimization/OptimizeButton'
import { SuggestionsList } from '../optimization/SuggestionsList'
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

  if (isCollapsed) {
    return (
      <aside
        className="relative shrink-0 flex flex-col border-l overflow-hidden"
        style={{
          width: '48px',
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'var(--color-bg-elevated)',
        }}
        aria-label="Right panel"
      >
        <PanelCollapseToggle
          side="right"
          isCollapsed={isCollapsed}
          onToggle={() => setPanelState('right', 'expanded')}
        />
        <div className="flex flex-col items-center pt-10 gap-3 px-2">
          {scores && (
            <span
              className="text-[11px] font-mono"
              title="Build Score"
              style={{ color: 'var(--color-accent-gold)' }}
            >
              {Math.round(((scores.damage ?? 0) + (scores.survivability ?? 0) + (scores.speed ?? 0)) / 3)}
            </span>
          )}
          <span title="Suggestions" style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>⚡</span>
          <span title="Stats" style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>≡</span>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative shrink-0 flex flex-col border-l overflow-hidden"
      style={{
        width: '340px',
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-bg-elevated)',
      }}
      aria-label="Right panel"
    >
      <PanelCollapseToggle
        side="right"
        isCollapsed={isCollapsed}
        onToggle={() => setPanelState('right', 'collapsed')}
      />

      <div className="flex-1 overflow-y-auto flex flex-col gap-0">
        {/* Score section */}
        <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
          {activeBuild ? (
            <>
              <ScoreGauge baselineScore={scores} previewScore={previewScore} />
              <ScoreTrio scores={scores} />
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Select a build to see scores
            </p>
          )}
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)', margin: '0 16px' }} />

        {/* Optimization controls */}
        <div className="px-4 py-3 flex flex-col gap-3" id="suggestion-panel">
          <OptimizationSlider />
          <FineTunePanel />

          <OptimizeButton
            onOptimize={startOptimization}
            disabled={!activeBuild || !isOnline}
            isOptimizing={isOptimizing}
            hasSuggestions={suggestions.length > 0}
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
              AI optimization requires internet. Connect and retry.
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
                Add gear, skills, and idols for more relevant suggestions.
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
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)', margin: '0 16px' }} />

        {/* AI Suggestions */}
        <div className="px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              AI Suggestions
            </span>
            {suggestions.length > 0 && (
              <span
                className="text-[10px] tabular-nums"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
              >
                {suggestions.length} ranked
              </span>
            )}
          </div>
          <SuggestionsList onRetry={startOptimization} />
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)', margin: '0 16px' }} />

        {/* Stat sheet */}
        <div className="px-4 pt-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Stat Sheet
          </span>
        </div>
        <div
          className="overflow-y-auto"
          style={{ maxHeight: '320px' }}
        >
          <StatSheetPanel />
        </div>
      </div>
    </aside>
  )
}
