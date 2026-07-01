import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { RemoveNodeConfirmDialog } from './RemoveNodeConfirmDialog'

describe('RemoveNodeConfirmDialog', () => {
  it('names exactly the orphaned nodes in the body copy — set-equal, in order (AC2 literal)', () => {
    render(
      <RemoveNodeConfirmDialog orphanNames={['Node A', 'Node B']} onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(
      screen.getByText('Removing this node will also deallocate: Node A, Node B. Continue?')
    ).toBeInTheDocument()
  })

  it('renders a single orphan name with no trailing separator', () => {
    render(<RemoveNodeConfirmDialog orphanNames={['Solo Node']} onConfirm={() => {}} onCancel={() => {}} />)
    expect(
      screen.getByText('Removing this node will also deallocate: Solo Node. Continue?')
    ).toBeInTheDocument()
  })

  it('Continue fires onConfirm exactly once, never onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <RemoveNodeConfirmDialog orphanNames={['Node A']} onConfirm={onConfirm} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Cancel fires onCancel, never onConfirm (allocations untouched)', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <RemoveNodeConfirmDialog orphanNames={['Node A']} onConfirm={onConfirm} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { baseElement } = render(
      <RemoveNodeConfirmDialog orphanNames={['Node A', 'Node B']} onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
