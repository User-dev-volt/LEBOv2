import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

describe('DeleteConfirmDialog', () => {
  it('renders the build name in the prompt', () => {
    render(
      <DeleteConfirmDialog
        buildName="Void Knight"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText(/Delete build\?/)).toBeInTheDocument()
    expect(screen.getByText(/Void Knight/)).toBeInTheDocument()
  })

  it('calls onConfirm when Delete button is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <DeleteConfirmDialog
        buildName="Test Build"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <DeleteConfirmDialog
        buildName="Test Build"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
