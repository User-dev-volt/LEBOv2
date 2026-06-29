import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

// Mirrors CLAUDE_MODEL in src-tauri/src/services/claude_service.rs:8. No IPC exposes the
// model name to the frontend, so this must be updated by hand whenever the Rust const changes.
const CLAUDE_MODEL_LABEL = 'claude-sonnet-4-6'

export function StatusBar() {
  const isOnline = useAppStore((s) => s.isOnline)
  const llmProvider = useAppStore((s) => s.llmProvider)
  const dataVersion = useGameDataStore((s) => s.dataVersion)
  const dataUpdatedAt = useGameDataStore((s) => s.dataUpdatedAt)
  const activeBuild = useBuildStore((s) => s.activeBuild)

  const dateOnly = dataUpdatedAt ? dataUpdatedAt.split('T')[0] : null
  const isDirty = activeBuild ? !activeBuild.isPersisted : false

  return (
    <footer
      className="h-6 flex items-center px-4 gap-4 shrink-0 text-xs border-t"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        borderColor: 'var(--color-bg-elevated)',
        color: 'var(--color-text-muted)',
      }}
    >
      {dataVersion && (
        <span>
          Data: <span style={{ color: 'var(--color-text-secondary)' }}>{dataVersion}</span>
          {dateOnly && <> — <span className="font-mono">{dateOnly}</span></>}
        </span>
      )}

      <span className="flex-1 text-center">
        {activeBuild &&
          (isDirty ? (
            <span style={{ color: 'var(--color-accent-gold)' }}>● Unsaved changes</span>
          ) : (
            <span>● All changes saved</span>
          ))}
      </span>

      {llmProvider && (
        <span>
          LLM:{' '}
          {llmProvider === 'claude' ? (
            <>
              <span style={{ color: 'var(--color-text-secondary)' }}>Claude</span> ·{' '}
              <span className="font-mono">{CLAUDE_MODEL_LABEL}</span>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--color-text-secondary)' }}>OpenRouter</span> ·{' '}
              <span className="font-mono">free rotation</span>
            </>
          )}
        </span>
      )}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </footer>
  )
}
