import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { invokeCommand } from '../../shared/utils/invokeCommand'
import { useAppStore } from '../../shared/stores/appStore'
import type { AppError } from '../../shared/types/errors'

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ApiKeyInput() {
  const isApiKeyConfigured = useAppStore((s) => s.isApiKeyConfigured)
  const setApiKeyConfigured = useAppStore((s) => s.setApiKeyConfigured)

  const [localKeyValue, setLocalKeyValue] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const cancelledRef = useRef(false)

  async function handleSave() {
    if (!localKeyValue.trim()) return
    setInlineError(null)
    setIsSaving(true)
    cancelledRef.current = false
    try {
      await invokeCommand('set_api_key', { key: localKeyValue })
      if (cancelledRef.current) return
      setApiKeyConfigured(true)
      setLocalKeyValue('')
      toast.success('API key saved securely')
    } catch (err) {
      if (cancelledRef.current) return
      const appErr = err as AppError
      setInlineError(appErr.message ?? 'Failed to save API key')
    } finally {
      if (!cancelledRef.current) setIsSaving(false)
    }
  }

  function handleReset() {
    cancelledRef.current = true
    setIsSaving(false)
    setLocalKeyValue('')
    setInlineError(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="api-key-field"
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Claude API Key
        </label>
        <input
          id="api-key-field"
          type="password"
          data-testid="api-key-input"
          value={localKeyValue}
          onChange={(e) => setLocalKeyValue(e.target.value)}
          disabled={isSaving}
          placeholder={isApiKeyConfigured ? 'Claude API key saved ✓' : 'sk-ant-api03-...'}
          className="rounded px-3 py-2 text-sm w-full"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-bg-hover)',
            opacity: isSaving ? 0.5 : 1,
            cursor: isSaving ? 'not-allowed' : undefined,
          }}
        />
        {inlineError && (
          <span className="text-xs mt-1" style={{ color: 'var(--color-data-negative)' }}>
            {inlineError}
          </span>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={handleSave}
          data-testid="save-key-btn"
          disabled={!localKeyValue.trim() || isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold w-fit"
          style={
            !localKeyValue.trim() || isSaving
              ? {
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-muted)',
                  opacity: 0.5,
                }
              : {
                  backgroundColor: 'var(--color-accent-gold)',
                  color: 'var(--color-bg-base)',
                }
          }
        >
          {isSaving && <Spinner />}
          {isSaving ? 'Saving…' : 'Save Key'}
        </button>
        {isSaving && (
          <button
            onClick={handleReset}
            data-testid="reset-key-btn"
            className="px-4 py-2 rounded text-sm font-semibold"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-bg-hover)',
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
