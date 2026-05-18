import { useAppStore } from '../../shared/stores/appStore'
import { getPendingUpdate } from '../../shared/hooks/useUpdateCheck'
import { invokeCommand } from '../../shared/utils/invokeCommand'

export function AppHeader() {
  const currentView = useAppStore((s) => s.currentView)
  const setCurrentView = useAppStore((s) => s.setCurrentView)
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

  return (
    <header
      className="h-10 flex items-center px-4 border-b border-bg-elevated shrink-0"
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
    >
      <span className="font-semibold text-sm tracking-wide" style={{ color: 'var(--color-accent-gold)' }}>
        LEBOv2
      </span>
      <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Last Epoch Build Optimizer
      </span>

      {updateInfo && !updateDismissed && (
        <div
          className="ml-4 flex items-center gap-2 text-xs"
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
                style={{
                  backgroundColor: 'var(--color-accent-gold)',
                  color: 'var(--color-bg-base)',
                }}
              >
                Install Update
              </button>
            </>
          )}
          {updateStatus === 'downloading' && (
            <span data-testid="download-progress-text">
              Downloading... {updateProgress}%
            </span>
          )}
          {updateStatus === 'error' && (
            <span data-testid="update-error-text">
              Update failed.
            </span>
          )}
          {updateStatus === 'ready' && (
            <>
              <span data-testid="update-ready-text">
                Update ready. Restart LEBOv2 to apply?
              </span>
              <button
                onClick={installAndRestart}
                data-testid="restart-now-button"
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: 'var(--color-accent-gold)',
                  color: 'var(--color-bg-base)',
                }}
              >
                Restart Now
              </button>
            </>
          )}
          {(updateStatus === 'idle' || updateStatus === 'ready' || updateStatus === 'error') && (
            <button
              onClick={() => setUpdateDismissed(true)}
              data-testid="dismiss-update-button"
              className="ml-1 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Dismiss update notification"
            >
              ×
            </button>
          )}
        </div>
      )}

      {currentView !== 'settings' && (
        <button
          onClick={() => setCurrentView('settings')}
          data-testid="settings-button"
          className="ml-auto text-xs px-3 py-1 rounded"
          style={{
            backgroundColor: 'var(--color-bg-hover)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Settings
        </button>
      )}
    </header>
  )
}
