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

  // ── Story 4.4: Overlay toggle ────────────────────────────────────────────

  it('Overlay button is absent when hasOverlay is false', () => {
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} hasOverlay={false} />)
    expect(screen.queryByRole('button', { name: 'Toggle efficiency overlay' })).not.toBeInTheDocument()
  })

  it('Overlay button is present when hasOverlay is true', () => {
    render(
      <TreeControls
        searchQuery=""
        onSearchChange={vi.fn()}
        onReset={vi.fn()}
        hasOverlay={true}
        showOverlay={false}
        onToggleOverlay={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Toggle efficiency overlay' })).toBeInTheDocument()
  })

  it('clicking Overlay button fires onToggleOverlay', () => {
    const onToggleOverlay = vi.fn()
    render(
      <TreeControls
        searchQuery=""
        onSearchChange={vi.fn()}
        onReset={vi.fn()}
        hasOverlay={true}
        showOverlay={false}
        onToggleOverlay={onToggleOverlay}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Toggle efficiency overlay' }))
    expect(onToggleOverlay).toHaveBeenCalledTimes(1)
  })

  it('Overlay button aria-pressed reflects showOverlay', () => {
    const { rerender } = render(
      <TreeControls
        searchQuery=""
        onSearchChange={vi.fn()}
        onReset={vi.fn()}
        hasOverlay={true}
        showOverlay={false}
        onToggleOverlay={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: 'Toggle efficiency overlay' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <TreeControls
        searchQuery=""
        onSearchChange={vi.fn()}
        onReset={vi.fn()}
        hasOverlay={true}
        showOverlay={true}
        onToggleOverlay={vi.fn()}
      />
    )
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  // ── Story 6.3: Undo/Redo buttons ─────────────────────────────────────────────

  it('Undo button is absent when onUndo is not provided', () => {
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('Redo button is absent when onRedo is not provided', () => {
    render(<TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Redo' })).not.toBeInTheDocument()
  })

  it('Undo button is rendered and calls onUndo when clicked', () => {
    const onUndo = vi.fn()
    render(
      <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onUndo={onUndo} canUndo={true} />
    )
    const btn = screen.getByRole('button', { name: 'Undo' })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('Undo button is disabled when canUndo is false', () => {
    render(
      <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onUndo={vi.fn()} canUndo={false} />
    )
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('Redo button is rendered and calls onRedo when clicked', () => {
    const onRedo = vi.fn()
    render(
      <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onRedo={onRedo} canRedo={true} />
    )
    const btn = screen.getByRole('button', { name: 'Redo' })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onRedo).toHaveBeenCalledTimes(1)
  })

  it('Redo button is disabled when canRedo is false', () => {
    render(
      <TreeControls searchQuery="" onSearchChange={vi.fn()} onReset={vi.fn()} onRedo={vi.fn()} canRedo={false} />
    )
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('passes accessibility check with undo and redo buttons', async () => {
    const { container } = render(
      <TreeControls
        searchQuery=""
        onSearchChange={vi.fn()}
        onReset={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo={true}
        canRedo={false}
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
