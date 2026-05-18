export function BuildImportInput() {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="build-import-input"
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Import Build
      </label>
      <textarea
        id="build-import-input"
        placeholder="Paste build code here..."
        rows={3}
        className="w-full rounded px-2 py-1.5 text-xs resize-none focus:outline focus:outline-1 focus:outline-[var(--color-accent-gold)]"
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-bg-hover)',
        }}
      />
    </div>
  )
}
