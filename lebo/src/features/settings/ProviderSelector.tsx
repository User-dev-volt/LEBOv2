import { useState } from 'react'
import toast from 'react-hot-toast'
import { invokeCommand } from '../../shared/utils/invokeCommand'
import { useAppStore } from '../../shared/stores/appStore'
import { ApiKeyInput } from './ApiKeyInput'
import { OpenRouterInput } from './OpenRouterInput'

function ActiveBadge() {
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
    >
      Active
    </span>
  )
}

export function ProviderSelector() {
  const llmProvider = useAppStore((s) => s.llmProvider)
  const setLlmProvider = useAppStore((s) => s.setLlmProvider)
  const isOpenRouterConfigured = useAppStore((s) => s.isOpenRouterConfigured)
  const setOpenRouterConfigured = useAppStore((s) => s.setOpenRouterConfigured)

  const [activating, setActivating] = useState<'claude' | 'openrouter' | null>(null)

  async function handleActivate(provider: 'claude' | 'openrouter') {
    if (llmProvider === provider) return
    const prev = llmProvider
    setActivating(provider)
    try {
      await invokeCommand('set_llm_provider', { provider })
      setLlmProvider(provider)
      toast.success(provider === 'claude' ? 'Switched to Claude' : 'Switched to OpenRouter')
    } catch {
      setLlmProvider(prev)
      toast.error('Failed to switch provider')
    } finally {
      setActivating(null)
    }
  }

  const cardStyle = (active: boolean): React.CSSProperties => ({
    border: `1px solid ${active ? 'var(--color-accent-gold)' : 'var(--color-bg-hover)'}`,
    borderRadius: '8px',
    padding: '16px',
    backgroundColor: 'var(--color-bg-elevated)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  })

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        AI Provider
      </h2>

      {/* Claude card */}
      <div style={cardStyle(llmProvider === 'claude')}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Claude (Anthropic)
          </span>
          {llmProvider === 'claude' && <ActiveBadge />}
        </div>

        <ApiKeyInput />

        {llmProvider !== 'claude' && (
          <button
            data-testid="activate-claude-btn"
            onClick={() => handleActivate('claude')}
            disabled={activating !== null}
            className="px-4 py-1.5 rounded text-xs font-semibold w-fit"
            style={
              activating !== null
                ? {
                    backgroundColor: 'var(--color-bg-hover)',
                    color: 'var(--color-text-muted)',
                    opacity: 0.5,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: 'var(--color-accent-gold)',
                    border: '1px solid var(--color-accent-gold)',
                  }
            }
          >
            {activating === 'claude' ? 'Switching…' : 'Use this provider'}
          </button>
        )}
      </div>

      {/* OpenRouter card */}
      <div style={cardStyle(llmProvider === 'openrouter')}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            OpenRouter
          </span>
          {llmProvider === 'openrouter' && <ActiveBadge />}
        </div>

        <OpenRouterInput
          isConfigured={isOpenRouterConfigured ?? false}
          onConfigured={() => setOpenRouterConfigured(true)}
        />

        {llmProvider !== 'openrouter' && (
          <button
            data-testid="activate-openrouter-btn"
            onClick={() => handleActivate('openrouter')}
            disabled={activating !== null}
            className="px-4 py-1.5 rounded text-xs font-semibold w-fit"
            style={
              activating !== null
                ? {
                    backgroundColor: 'var(--color-bg-hover)',
                    color: 'var(--color-text-muted)',
                    opacity: 0.5,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: 'var(--color-accent-gold)',
                    border: '1px solid var(--color-accent-gold)',
                  }
            }
          >
            {activating === 'openrouter' ? 'Switching…' : 'Use this provider'}
          </button>
        )}
      </div>
    </div>
  )
}
