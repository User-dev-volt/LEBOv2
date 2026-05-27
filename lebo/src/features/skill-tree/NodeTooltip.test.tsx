import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeTooltip } from './NodeTooltip'
import type { GameNode } from '../../shared/types/gameData'

const mockNode: GameNode = {
  id: 'test-node',
  name: 'Fortitude',
  pointCost: 1,
  maxPoints: 8,
  prerequisiteNodeIds: ['gladiator'],
  effectDescription: '+5 Vitality per point',
  tags: ['PHYSICAL', 'DEFENSE'],
  position: { x: 0, y: 0 },
  size: 'medium',
}

const position = { x: 100, y: 100 }

describe('NodeTooltip', () => {
  it('renders the node name', () => {
    render(<NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />)
    expect(screen.getByText('Fortitude')).toBeDefined()
  })

  it('renders the effect description', () => {
    render(<NodeTooltip gameNode={mockNode} allocatedPoints={0} position={position} />)
    expect(screen.getByText('+5 Vitality per point')).toBeDefined()
  })

  it('renders tag chips', () => {
    render(<NodeTooltip gameNode={mockNode} allocatedPoints={0} position={position} />)
    expect(screen.getByText('PHYSICAL')).toBeDefined()
    expect(screen.getByText('DEFENSE')).toBeDefined()
  })

  it('renders error message when errorMessage prop is provided', () => {
    render(
      <NodeTooltip
        gameNode={mockNode}
        allocatedPoints={0}
        position={position}
        errorMessage="Cannot remove — 2 node(s) depend on this"
      />
    )
    expect(screen.getByText('Cannot remove — 2 node(s) depend on this')).toBeDefined()
  })

  it('renders allocation and prerequisite info', () => {
    render(<NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />)
    expect(screen.getByText(/3\/8 pts allocated/)).toBeDefined()
    expect(screen.getByText(/Requires:/)).toBeDefined()
  })

  it('renders with maxHeight 60vh', () => {
    render(<NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />)
    const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
    expect(tooltip).not.toBeNull()
    expect(tooltip.style.maxHeight).toBe('60vh')
  })

  it('renders with overflowY auto', () => {
    render(<NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />)
    const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
    expect(tooltip).not.toBeNull()
    expect(tooltip.style.overflowY).toBe('auto')
  })

  it('does not set pointerEvents to none', () => {
    render(<NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />)
    const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
    expect(tooltip).not.toBeNull()
    expect(tooltip.style.pointerEvents).not.toBe('none')
  })

  it('calls onMouseEnter when mouse enters the tooltip', () => {
    const onMouseEnter = vi.fn()
    render(
      <NodeTooltip
        gameNode={mockNode}
        allocatedPoints={3}
        position={position}
        onMouseEnter={onMouseEnter}
      />
    )
    const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
    fireEvent.mouseEnter(tooltip)
    expect(onMouseEnter).toHaveBeenCalledTimes(1)
  })

  it('calls onMouseLeave when mouse leaves the tooltip', () => {
    const onMouseLeave = vi.fn()
    render(
      <NodeTooltip
        gameNode={mockNode}
        allocatedPoints={3}
        position={position}
        onMouseLeave={onMouseLeave}
      />
    )
    const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
    fireEvent.mouseLeave(tooltip)
    expect(onMouseLeave).toHaveBeenCalledTimes(1)
  })

  it('error tooltip also renders with maxHeight 60vh', () => {
    render(
      <NodeTooltip
        gameNode={mockNode}
        allocatedPoints={0}
        position={position}
        errorMessage="Some error"
      />
    )
    const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
    expect(tooltip).not.toBeNull()
    expect(tooltip.style.maxHeight).toBe('60vh')
  })
})
