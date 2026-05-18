import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { TreeControls } from './TreeControls'

describe('TreeControls', () => {
  it('renders RESET button and search input', () => {
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search skill tree nodes' })).toBeInTheDocument()
  })

  it('typing in search input calls onSearchChange with the typed value', () => {
    const onSearchChange = vi.fn()
    render(<TreeControls searchQuery="" onSearchChange={onSearchChange} onReset={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Search skill tree nodes' })
    fireEvent.change(input, { target: { value: 'void' } })
    expect(onSearchChange).toHaveBeenCalledWith('void')
  })

  it('pressing Escape in input calls onSearchChange with empty string', () => {
    const onSearchChange = vi.fn()
    render(<TreeControls searchQuery="void" onSearchChange={onSearchChange} onReset={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Search skill tree nodes' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onSearchChange).toHaveBeenCalledWith('')
  })

  it('clicking × button calls onSearchChange with empty string', () => {
    const onSearchChange = vi.fn()
    render(<TreeControls searchQuery="void" onSearchChange={onSearchChange} onReset={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearchChange).toHaveBeenCalledWith('')
  })

  it('clicking RESET button calls onReset', () => {
    const onReset = vi.fn()
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={onReset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('× button is not rendered when searchQuery is empty', () => {
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('× button is rendered when searchQuery is non-empty', () => {
    render(<TreeControls searchQuery="fire" onSearchChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })

  it('passes accessibility check', async () => {
    const { container } = render(
      <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // ── Review-finding fixes ─────────────────────────────────────────────────

  it('Fit button is not rendered when onFit is not provided', () => {
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Fit tree to view' })).not.toBeInTheDocument()
  })

  it('Fit button is rendered and calls onFit when onFit is provided', () => {
    const onFit = vi.fn()
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onFit={onFit} />)
    const fitBtn = screen.getByRole('button', { name: 'Fit tree to view' })
    expect(fitBtn).toBeInTheDocument()
    fireEvent.click(fitBtn)
    expect(onFit).toHaveBeenCalledTimes(1)
  })
})
