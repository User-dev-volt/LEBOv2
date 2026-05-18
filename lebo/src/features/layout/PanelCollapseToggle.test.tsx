import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PanelCollapseToggle } from './PanelCollapseToggle'

describe('PanelCollapseToggle', () => {
  it('shows "Expand left panel" label when left panel is collapsed', () => {
    render(<PanelCollapseToggle side="left" isCollapsed={true} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Expand left panel' })).toBeInTheDocument()
  })

  it('shows "Collapse left panel" label when left panel is expanded', () => {
    render(<PanelCollapseToggle side="left" isCollapsed={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Collapse left panel' })).toBeInTheDocument()
  })

  it('shows "Expand right panel" label when right panel is collapsed', () => {
    render(<PanelCollapseToggle side="right" isCollapsed={true} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Expand right panel' })).toBeInTheDocument()
  })

  it('shows "Collapse right panel" label when right panel is expanded', () => {
    render(<PanelCollapseToggle side="right" isCollapsed={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Collapse right panel' })).toBeInTheDocument()
  })

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<PanelCollapseToggle side="left" isCollapsed={false} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggle exactly once per click', async () => {
    const onToggle = vi.fn()
    render(<PanelCollapseToggle side="right" isCollapsed={true} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  it('SVG arrow is aria-hidden', () => {
    render(<PanelCollapseToggle side="left" isCollapsed={false} onToggle={vi.fn()} />)
    const svg = screen.getByRole('button').querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })
})
