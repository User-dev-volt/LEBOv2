export function WeaverTreePlaceholder() {
  return (
    <div
      className="flex items-center justify-center h-full"
      role="region"
      aria-label="Weaver Tree"
      style={{
        backgroundImage: 'url("/backgrounds/bg_weaver_tile.png")',
        backgroundRepeat: 'repeat',
        backgroundSize: '256px 256px',
      }}
    >
      <p
        className="text-sm text-center max-w-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Weaver Tree planning is in research. Node data is not available from community sources.
      </p>
    </div>
  )
}
