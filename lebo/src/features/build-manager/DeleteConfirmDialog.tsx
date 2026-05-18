import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'

interface Props {
  buildName: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({ buildName, onConfirm, onCancel }: Props) {
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
            Delete build?
          </DialogTitle>

          <p
            className="text-sm mb-6"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Delete &ldquo;{buildName}&rdquo;? This cannot be undone.
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
                backgroundColor: 'var(--color-data-negative)',
                color: '#fff',
                border: 'none',
              }}
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
