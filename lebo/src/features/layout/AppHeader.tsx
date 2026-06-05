import { Fragment } from 'react'
import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { getPendingUpdate } from '../../shared/hooks/useUpdateCheck'
import { invokeCommand } from '../../shared/utils/invokeCommand'

export function AppHeader() {
  const currentView = useAppStore((s) => s.currentView)
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const isOnline = useAppStore((s) => s.isOnline)
  const isOnlineChecked = useAppStore((s) => s.isOnlineChecked)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const updateInfo = useAppStore((s) => s.updateInfo)
  const updateStatus = useAppStore((s) => s.updateStatus)
  const updateProgress = useAppStore((s) => s.updateProgress)
  const updateDismissed = useAppStore((s) => s.updateDismissed)
  const setUpdateStatus = useAppStore((s) => s.setUpdateStatus)
  const setUpdateProgress = useAppStore((s) => s.setUpdateProgress)
  const setUpdateDismissed = useAppStore((s) => s.setUpdateDismissed)

  async function startDownload() {
    const update = getPendingUpdate()
    if (!update) return
    setUpdateStatus('downloading')
    let downloaded = 0
    let contentLength = 0
    try {
      await update.download((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          setUpdateProgress(pct)
        } else if (event.event === 'Finished') {
          setUpdateStatus('ready')
        }
      })
    } catch {
      setUpdateStatus('error')
    }
  }

  async function installAndRestart() {
    const update = getPendingUpdate()
    if (!update) return
    await update.install()
    await invokeCommand('restart_app')
  }

  // FR-33 order: Builder | Complete Build Optimizer | Gear Optimization | Settings.
  // Complete Build Optimizer is rendered separately as an inert item (see below).
  const navItems: Array<{ id: 'main' | 'gear-optimization' | 'settings'; label: string; testid: string; requiresBuild?: boolean }> = [
    { id: 'main', label: 'Builder', testid: 'builder-button' },
    { id: 'gear-optimization', label: 'Gear Optimization', testid: 'gear-optimization-button', requiresBuild: true },
    { id: 'settings', label: 'Settings', testid: 'settings-button' },
  ]

  function renderNavButton(id: 'main' | 'gear-optimization' | 'settings', label: string, testid: string) {
    const isActive = currentView === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => setCurrentView(id)}
        data-testid={testid}
        aria-current={isActive ? 'page' : undefined}
        className={
          'flex items-center h-7 px-3 rounded text-xs font-medium' +
          (isActive ? '' : ' hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]')
        }
        style={{
          color: isActive ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)',
          backgroundColor: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
          transition: 'background-color 120ms, color 120ms',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <header
      className="shrink-0 flex items-center px-3.5 border-b gap-4"
      style={{
        height: '44px',
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-bg-elevated)',
      }}
    >
      {/* Logo */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="font-mono font-bold text-sm tracking-wider" style={{ color: 'var(--color-accent-gold)' }}>
          LEBOv2
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Last Epoch Build Optimizer
        </span>
      </div>

      {/* Nav — single source: navItems; the inert Complete Build Optimizer is injected after Builder (FR-33 order). */}
      <nav className="flex items-center gap-0.5 ml-2">
        {navItems.map(({ id, label, testid, requiresBuild }) => {
          if (requiresBuild && !activeBuild) return null
          return (
            <Fragment key={id}>
              {renderNavButton(id, label, testid)}
              {/* Epic 6 / Story 6.1 (D-P4-5) wires this: add 'complete-optimizer' to currentView union + route the view, then remove disabled. */}
              {id === 'main' && (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  data-testid="complete-optimizer-button"
                  title="Coming soon"
                  className="flex items-center h-7 px-3 rounded text-xs font-medium"
                  style={{
                    color: 'var(--color-text-muted)',
                    backgroundColor: 'transparent',
                    cursor: 'not-allowed',
                  }}
                >
                  Complete Build Optimizer
                </button>
              )}
            </Fragment>
          )
        })}
      </nav>

      {/* Update banner */}
      {updateInfo && !updateDismissed && (
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
          data-testid="update-banner"
        >
          {updateStatus === 'idle' && (
            <>
              <span data-testid="update-version-text">
                LEBOv2 {updateInfo.version} is available.
              </span>
              <button
                onClick={startDownload}
                data-testid="install-update-button"
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
              >
                Install
              </button>
            </>
          )}
          {updateStatus === 'downloading' && (
            <span data-testid="download-progress-text">Downloading... {updateProgress}%</span>
          )}
          {updateStatus === 'error' && (
            <span data-testid="update-error-text">Update failed.</span>
          )}
          {updateStatus === 'ready' && (
            <>
              <span data-testid="update-ready-text">Update ready. Restart LEBOv2 to apply?</span>
              <button
                onClick={installAndRestart}
                data-testid="restart-now-button"
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
              >
                Restart
              </button>
            </>
          )}
          {(updateStatus === 'idle' || updateStatus === 'ready' || updateStatus === 'error') && (
            <button
              onClick={() => setUpdateDismissed(true)}
              data-testid="dismiss-update-button"
              className="text-xs ml-1"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Dismiss update notification"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3.5">
        {/* Online indicator */}
        {isOnlineChecked && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isOnline ? 'var(--color-data-positive)' : 'var(--color-data-negative)',
                boxShadow: isOnline ? '0 0 5px rgba(94,189,120,0.6)' : 'none',
              }}
            />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        )}
        <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
          v2
        </span>
      </div>
    </header>
  )
}
