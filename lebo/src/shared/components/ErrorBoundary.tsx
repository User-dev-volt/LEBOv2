import React from 'react'

interface State { hasError: boolean }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4"
          style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          data-testid="error-boundary-fallback"
        >
          <p className="text-sm font-semibold">Something went wrong.</p>
          <button
            onClick={() => window.location.reload()}
            data-testid="reload-app-button"
            className="px-3 py-1.5 rounded text-sm"
            style={{
              backgroundColor: 'var(--color-accent-gold)',
              color: 'var(--color-bg-base)',
            }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
