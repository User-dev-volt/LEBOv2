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

  // ── Story 3.3 — compact card-interaction variant (FR-18) ──
  describe('compact variant', () => {
    it('renders the node name and the FR-19 point/path cost line', () => {
      render(
        <NodeTooltip compact gameNode={mockNode} allocatedPoints={0} position={position} pointCost={2} pathCost={4} statDeltas={[]} />
      )
      expect(screen.getByText('Fortitude')).toBeDefined()
      expect(screen.getByTestId('node-tooltip-cost')).toHaveTextContent('2 pts / 4 pts to reach')
    })

    it('drops the "to reach" clause when path cost is 0', () => {
      render(
        <NodeTooltip compact gameNode={mockNode} allocatedPoints={0} position={position} pointCost={2} pathCost={0} statDeltas={[]} />
      )
      const cost = screen.getByTestId('node-tooltip-cost')
      expect(cost).toHaveTextContent('2 pts')
      expect(cost.textContent).not.toContain('to reach')
    })

    it('renders per-stat deltas with sign + unit (% to one decimal, small flats to one decimal)', () => {
      render(
        <NodeTooltip
          compact
          gameNode={mockNode}
          allocatedPoints={0}
          position={position}
          pointCost={1}
          pathCost={0}
          statDeltas={[
            { label: 'Necrotic Res', delta: 22, unit: '%' },
            { label: 'Cast Speed', delta: 8.2, unit: '' },
          ]}
        />
      )
      const deltas = screen.getByTestId('node-tooltip-deltas')
      expect(deltas).toHaveTextContent('+22% Necrotic Res')
      expect(deltas).toHaveTextContent('+8.2 Cast Speed')
    })

    it('renders the composite score delta when provided', () => {
      render(
        <NodeTooltip compact gameNode={mockNode} allocatedPoints={0} position={position} pointCost={1} pathCost={0} scoreDelta={4.2} statDeltas={[]} />
      )
      expect(screen.getByTestId('node-tooltip-score-delta')).toHaveTextContent('+4.2')
    })

    it('shows a graceful pending state when stat deltas are not yet available', () => {
      render(
        <NodeTooltip compact gameNode={mockNode} allocatedPoints={0} position={position} pointCost={1} pathCost={0} statDeltas={[]} />
      )
      expect(screen.getByTestId('node-tooltip-deltas-pending')).toBeInTheDocument()
      expect(screen.queryByTestId('node-tooltip-deltas')).toBeNull()
    })

    it('leaves the full (non-compact) tooltip contract unchanged', () => {
      render(<NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />)
      expect(screen.getByText(/3\/8 pts allocated/)).toBeDefined()
      expect(screen.queryByTestId('node-tooltip-compact')).toBeNull()
    })
  })
})
