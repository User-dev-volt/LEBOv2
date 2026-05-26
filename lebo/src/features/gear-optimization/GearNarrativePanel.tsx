interface Props {
  narrative: string | null
  isGenerating: boolean
}

export function GearNarrativePanel({ narrative, isGenerating }: Props) {
  if (!narrative && !isGenerating) return null

  return (
    <section
      aria-label="Claude gear narrative"
      className="flex flex-col gap-2"
      style={{ borderTop: '1px solid var(--color-bg-hover)', paddingTop: '1rem', marginTop: '0.5rem' }}
    >
      <h3
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-accent-gold)' }}
      >
        Gear Analysis
      </h3>

      {isGenerating && !narrative && (
        <p
          aria-live="polite"
          data-testid="gear-narrative-loading"
          className="text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Generating gear narrative…
        </p>
      )}

      {narrative && (
        <p
          aria-live="polite"
          data-testid="gear-narrative-text"
          className="text-sm whitespace-pre-wrap"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {narrative}
          {isGenerating && (
            <span aria-hidden="true" style={{ color: 'var(--color-text-muted)' }}>▋</span>
          )}
        </p>
      )}
    </section>
  )
}
