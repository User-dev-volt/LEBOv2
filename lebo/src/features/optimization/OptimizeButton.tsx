interface OptimizeButtonProps {
  onOptimize: () => void
  disabled: boolean
  isOptimizing: boolean
}

const BAR_DELAYS = ['0ms', '160ms', '320ms', '480ms', '640ms']

export function OptimizeButton({ onOptimize, disabled, isOptimizing }: OptimizeButtonProps) {
  const isInteractive = !disabled && !isOptimizing

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={isInteractive ? onOptimize : undefined}
        disabled={disabled || isOptimizing}
        aria-disabled={disabled || isOptimizing ? 'true' : 'false'}
        aria-busy={isOptimizing ? 'true' : 'false'}
        aria-label={isOptimizing ? 'Analyzing build...' : 'Optimize build'}
        id="optimize-button"
        data-testid="optimize-button"
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-semibold"
        style={{
          backgroundColor: disabled
            ? 'var(--color-bg-elevated)'
            : 'var(--color-accent-gold)',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-bg-base)',
          opacity: disabled ? 0.5 : 1,
          cursor: !isInteractive ? 'not-allowed' : 'pointer',
        }}
      >
        {isOptimizing ? (
          <>
            <span>Analyzing...</span>
            <div
              className="flex items-end gap-px"
              style={{ height: '14px' }}
              data-testid="optimize-loading-indicator"
              aria-hidden="true"
            >
              {BAR_DELAYS.map((delay) => (
                <div
                  key={delay}
                  style={{
                    width: '3px',
                    height: '4px',
                    backgroundColor: 'var(--color-bg-base)',
                    borderRadius: '2px',
                    animation: `analyzing-bar 0.9s ease-in-out infinite`,
                    animationDelay: delay,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          'Optimize'
        )}
      </button>

      {isOptimizing && (
        <div className="flex flex-col gap-1.5">
          {/* Indeterminate progress bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: '3px', backgroundColor: 'var(--color-bg-elevated)' }}
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: '40%',
                backgroundColor: 'var(--color-accent-gold)',
                animation: 'analyzing-progress 1.8s ease-in-out infinite',
              }}
            />
          </div>
          <p
            className="text-xs text-center"
            style={{ color: 'var(--color-text-muted)' }}
          >
            This usually takes 20–30 seconds
          </p>
        </div>
      )}
    </div>
  )
}
