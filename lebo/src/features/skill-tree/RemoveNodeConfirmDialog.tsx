import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'

interface Props {
  orphanNames: string[]
  onConfirm: () => void
  onCancel: () => void
}

// Story 3.5 AC2: centered confirmation for shift+right-click remove-all when the cascade would orphan
// other allocated nodes. Mirrors the DeleteConfirmDialog PATTERN locally (cross-feature imports are
// forbidden). Receives already-resolved orphan display names — id→name resolution happens in SkillTreeView.
export function RemoveNodeConfirmDialog({ orphanNames, onConfirm, onCancel }: Props) {
  return (
    <Dialog open onClose={onCancel} className="relative z-50">
      <div
        className="fixed inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        aria-hidden="true"
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className="rounded-lg p-6 w-full max-w-sm shadow-xl"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-bg-elevated)',
          }}
        >
          <DialogTitle
            className="text-base font-semibold mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Remove all points?
          </DialogTitle>

          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Removing this node will also deallocate: {orphanNames.join(', ')}. Continue?
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-1.5 text-sm rounded"
              style={{
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-hover)',
              }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-1.5 text-sm rounded font-medium"
              style={{
                backgroundColor: 'var(--color-accent-gold)',
                color: 'var(--color-bg-base)',
                border: 'none',
              }}
              onClick={onConfirm}
            >
              Continue
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
