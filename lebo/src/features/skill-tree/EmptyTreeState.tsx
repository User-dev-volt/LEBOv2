import { useAppStore } from '../../shared/stores/appStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

function expandAndFocus(setPanelState: (panel: 'left' | 'right', state: 'expanded' | 'collapsed') => void, targetId: string) {
  setPanelState('left', 'expanded')
  // Wait for the 200ms panel expand transition before focusing
  setTimeout(() => {
    document.getElementById(targetId)?.focus()
  }, 220)
}

export function EmptyTreeState() {
  const setPanelState = useAppStore((s) => s.setPanelState)
  const isLoading = useGameDataStore((s) => s.isLoading)
  const gameDataLoaded = useGameDataStore((s) => s.gameData !== null)

  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      style={{
        background:
          'radial-gradient(ellipse at center, var(--color-bg-elevated) 0%, var(--color-bg-base) 70%)',
      }}
    >
      <p
        className="text-lg font-semibold mb-6"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Import a build or start fresh
      </p>

      <div className="flex gap-4">
        <button
          type="button"
          className="px-5 py-2 text-sm font-medium rounded transition-opacity hover:opacity-75 active:opacity-60"
          style={{
            border: '1px solid var(--color-accent-gold)',
            color: 'var(--color-accent-gold)',
            backgroundColor: 'transparent',
          }}
          onClick={() => expandAndFocus(setPanelState, 'build-import-input')}
        >
          Paste Build Code
        </button>

        <button
          type="button"
          className="px-5 py-2 text-sm font-medium rounded transition-opacity hover:opacity-75 active:opacity-60 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-bg-elevated)',
          }}
          disabled={isLoading}
          onClick={() => expandAndFocus(setPanelState, 'class-selector-btn')}
        >
          {isLoading ? 'Loading data…' : 'Create New Build'}
        </button>
      </div>

      {isLoading && (
        <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Loading game data…
        </p>
      )}

      {!isLoading && !gameDataLoaded && (
        <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Game data unavailable — check the status bar for details.
        </p>
      )}
    </div>
  )
}
