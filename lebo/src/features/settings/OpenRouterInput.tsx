import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { invokeCommand } from '../../shared/utils/invokeCommand'
import type { AppError } from '../../shared/types/errors'

interface Props {
  isConfigured: boolean
  onConfigured: () => void
}

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

export function OpenRouterInput({ isConfigured, onConfigured }: Props) {
  const [keyValue, setKeyValue] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const cancelledRef = useRef(false)

  async function handleSave() {
    setInlineError(null)
    setTestResult(null)
    setIsSaving(true)
    cancelledRef.current = false
    try {
      await invokeCommand('set_openrouter_api_key', { key: keyValue.trim() })
      if (cancelledRef.current) return
      onConfigured()
      setKeyValue('')
      toast.success('OpenRouter API key saved')
    } catch (err) {
      if (cancelledRef.current) return
      const appErr = err as AppError
      setInlineError(appErr.message ?? 'Failed to save OpenRouter key')
    } finally {
      if (!cancelledRef.current) setIsSaving(false)
    }
  }

  function handleReset() {
    cancelledRef.current = true
    setIsSaving(false)
    setKeyValue('')
    setInlineError(null)
    setTestResult(null)
  }

  async function handleTest() {
    setTestResult(null)
    setIsTesting(true)
    try {
      const result = await invokeCommand<string>('validate_openrouter_key')
      setTestResult({ ok: true, message: result as string })
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err as AppError).message ?? 'Test failed'
      setTestResult({ ok: false, message: msg })
    } finally {
      setIsTesting(false)
    }
  }

  const saveDisabled = isSaving || keyValue.trim().length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="openrouter-key-field"
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          OpenRouter API Key
        </label>
        <input
          id="openrouter-key-field"
          type="password"
          data-testid="openrouter-key-input"
          value={keyValue}
          onChange={(e) => { setKeyValue(e.target.value); setTestResult(null) }}
          disabled={isSaving}
          placeholder={isConfigured ? 'OpenRouter API key saved ✓' : 'sk-or-...'}
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
        {testResult && (
          <span
            className="text-xs mt-1"
            style={{ color: testResult.ok ? 'var(--color-data-positive)' : 'var(--color-data-negative)' }}
          >
            {testResult.message}
          </span>
        )}
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Automatically rotates through Gemini 2.0 Flash, Llama 3.3 70B, Mistral 7B, and Gemma 2 27B
        when free-tier limits are reached.
      </p>

      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={handleSave}
          data-testid="save-openrouter-btn"
          disabled={saveDisabled}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold w-fit"
          style={
            saveDisabled
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
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        {isSaving && (
          <button
            onClick={handleReset}
            data-testid="reset-openrouter-btn"
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

        {isConfigured && !isSaving && (
          <button
            onClick={handleTest}
            data-testid="test-openrouter-btn"
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold"
            style={
              isTesting
                ? {
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-muted)',
                    opacity: 0.5,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-bg-hover)',
                  }
            }
          >
            {isTesting && <Spinner />}
            {isTesting ? 'Testing…' : 'Test Connection'}
          </button>
        )}
      </div>
    </div>
  )
}
