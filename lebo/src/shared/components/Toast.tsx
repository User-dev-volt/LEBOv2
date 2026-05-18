import toast from 'react-hot-toast'

export function showErrorToast(message: string): void {
  toast.error(message, {
    style: { borderLeft: '3px solid var(--color-data-negative)' },
  })
}

export function showSuccessToast(message: string): void {
  toast.success(message)
}

export function showInfoToast(message: string, opts?: Parameters<typeof toast>[1]): void {
  toast(message, opts)
}
