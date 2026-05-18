interface PanelCollapseToggleProps {
  side: 'left' | 'right'
  isCollapsed: boolean
  onToggle: () => void
}

export function PanelCollapseToggle({ side, isCollapsed, onToggle }: PanelCollapseToggleProps) {
  const pointsRight = side === 'left' ? !isCollapsed : isCollapsed
  const label = isCollapsed
    ? `Expand ${side} panel`
    : `Collapse ${side} panel`

  return (
    <button
      onClick={onToggle}
      aria-label={label}
      className="absolute top-1/2 -translate-y-1/2 w-4 h-8 flex items-center justify-center rounded transition-colors z-10 text-text-muted hover:text-text-secondary"
      style={{
        [side === 'left' ? 'right' : 'left']: '0px',
        backgroundColor: 'var(--color-bg-elevated)',
      }}
    >
      <svg
        width="8"
        height="12"
        viewBox="0 0 8 12"
        fill="none"
        aria-hidden="true"
        style={{
          transform: pointsRight ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 200ms',
        }}
      >
        <path
          d="M2 2L6 6L2 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
