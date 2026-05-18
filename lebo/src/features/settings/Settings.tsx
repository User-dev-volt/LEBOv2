import { useAppStore } from '../../shared/stores/appStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { ProviderSelector } from './ProviderSelector'

function safeLocalDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

export function Settings() {
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const iconSource = useAppStore((s) => s.iconSource)
  const dataVersion = useGameDataStore((s) => s.dataVersion)
  const dataUpdatedAt = useGameDataStore((s) => s.dataUpdatedAt)
  const itemDataVersion = useGameDataStore((s) => s.gameData?.manifest.itemDataVersion ?? null)

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', backgroundColor: 'var(--color-bg-base)' }}
    >
      <header
        className="h-10 flex items-center px-4 border-b shrink-0"
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-bg-elevated)',
        }}
      >
        <button
          onClick={() => setCurrentView('main')}
          data-testid="settings-back-btn"
          className="text-xs mr-4"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Back to main view"
        >
          ← Back
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Settings
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-6 max-w-lg flex flex-col gap-8">
        <ProviderSelector />

        <section>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Keyboard Shortcuts
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ color: 'var(--color-text-muted)' }}>
                <th className="text-left pb-2 pr-4 font-medium">Shortcut</th>
                <th className="text-left pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody style={{ color: 'var(--color-text-secondary)' }}>
              {[
                ['O', 'Focus Optimize button'],
                ['I', 'Focus Import Build input'],
                ['Ctrl+S', 'Save current build'],
                ['Escape', 'Collapse suggestion / Clear preview'],
                ['Up / Down', 'Navigate suggestion list'],
                ['P', 'Preview focused suggestion'],
                ['S', 'Skip focused suggestion'],
                ['Tab / Shift+Tab', 'Navigate tree nodes (connection order)'],
                ['Enter', 'Allocate / deallocate focused tree node'],
                ['Arrow keys', 'Move to adjacent connected tree node'],
              ].map(([shortcut, action]) => (
                <tr key={shortcut} style={{ borderTop: '1px solid var(--color-bg-elevated)' }}>
                  <td className="py-1.5 pr-4">
                    <kbd
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: 'var(--color-bg-elevated)',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-mono)',
                        border: '1px solid var(--color-bg-hover)',
                      }}
                    >
                      {shortcut}
                    </kbd>
                  </td>
                  <td className="py-1.5">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Data Sources
          </p>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Icon source: </span>
            {iconSource === 'game-files'
              ? 'game files'
              : iconSource === 'community-cdn'
                ? 'community CDN'
                : iconSource === 'placeholder'
                  ? 'placeholder'
                  : '—'}
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Game Data: </span>
            <span data-testid="game-data-version">
              {dataVersion
                ? dataUpdatedAt
                  ? `${dataVersion} (last updated ${safeLocalDate(dataUpdatedAt)})`
                  : dataVersion
                : '—'}
            </span>
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Item Database: </span>
            <span data-testid="item-data-version">
              {itemDataVersion ?? '—'}
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
