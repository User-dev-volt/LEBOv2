import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuggestionCard } from './SuggestionCard'
import type { SuggestionResult } from '../../shared/types/optimization'

const BASE_SCORE = { damage: 10, survivability: 10, speed: 10 }
const PREVIEW_SCORE = { damage: 14, survivability: 8, speed: 10 }

function makeSuggestion(overrides: Partial<SuggestionResult> = {}): SuggestionResult {
  return {
    rank: 1,
    nodeChange: { fromNodeId: null, toNodeId: 'node-123', pointsChange: 2 },
    explanation: 'Good node',
    deltaDamage: 4,
    deltaSurvivability: -2,
    deltaSpeed: 0,
    baselineScore: BASE_SCORE,
    previewScore: PREVIEW_SCORE,
    ...overrides,
  }
}

const DEFAULT_HANDLERS = {
  onApply: vi.fn(),
  onSkip: vi.fn(),
  onPreview: vi.fn(),
  onHoverEnter: vi.fn(),
  onHoverLeave: vi.fn(),
}

describe('SuggestionCard', () => {
  it('renders rank badge', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Iron Mastery" />)
    const card = screen.getByTestId('suggestion-card-1')
    expect(card).toBeInTheDocument()
    expect(card).toHaveTextContent('1')
  })

  it('renders correct data-testid on card root using rank', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ rank: 3 })} toNodeName="Flame Ward" />)
    expect(screen.getByTestId('suggestion-card-3')).toBeInTheDocument()
  })

  it('renders type badge with testid', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Iron Mastery" />)
    expect(screen.getByTestId('suggestion-type-badge')).toBeInTheDocument()
  })

  it('renders node name with testid', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Iron Mastery" />)
    expect(screen.getByTestId('suggestion-node-name')).toHaveTextContent('Iron Mastery')
  })

  it('derives ADD type when fromNodeId is null and pointsChange > 0', () => {
    const suggestion = makeSuggestion({ nodeChange: { fromNodeId: null, toNodeId: 'n1', pointsChange: 2 } })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-type-badge')).toHaveTextContent('ADD')
  })

  it('derives REMOVE type when fromNodeId is null and pointsChange < 0', () => {
    const suggestion = makeSuggestion({ nodeChange: { fromNodeId: null, toNodeId: 'n1', pointsChange: -1 } })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-type-badge')).toHaveTextContent('REMOVE')
  })

  it('derives SWAP type when fromNodeId is non-null', () => {
    const suggestion = makeSuggestion({ nodeChange: { fromNodeId: 'n0', toNodeId: 'n1', pointsChange: 1 } })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-type-badge')).toHaveTextContent('SWAP')
  })

  it('shows "Allocate N pt" for ADD type', () => {
    const suggestion = makeSuggestion({ nodeChange: { fromNodeId: null, toNodeId: 'n1', pointsChange: 3 } })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-card-1')).toHaveTextContent('Allocate 3 pt')
  })

  it('shows "Deallocate N pt" for REMOVE type (absolute value)', () => {
    const suggestion = makeSuggestion({ nodeChange: { fromNodeId: null, toNodeId: 'n1', pointsChange: -2 } })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-card-1')).toHaveTextContent('Deallocate 2 pt')
  })

  it('shows "Swap" for SWAP type', () => {
    const suggestion = makeSuggestion({ nodeChange: { fromNodeId: 'n0', toNodeId: 'n1', pointsChange: 1 } })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-card-1')).toHaveTextContent('Swap')
  })

  it('renders all three delta pills', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-damage')).toBeInTheDocument()
    expect(screen.getByTestId('delta-surv')).toBeInTheDocument()
    expect(screen.getByTestId('delta-speed')).toBeInTheDocument()
  })

  it('formats positive delta as +N', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaDamage: 4 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-damage')).toHaveTextContent('+4')
  })

  it('formats negative delta as -N', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaSurvivability: -2 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-surv')).toHaveTextContent('-2')
  })

  it('formats zero delta as ±0', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaSpeed: 0 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-speed')).toHaveTextContent('±0')
  })

  it('formats null delta as ?', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaDamage: null })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-damage')).toHaveTextContent('?')
  })

  it('uses ▲ indicator for positive delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaDamage: 4 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-damage')).toHaveTextContent('▲')
  })

  it('uses ▼ indicator for negative delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaSurvivability: -2 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-surv')).toHaveTextContent('▼')
  })

  it('uses ◈ indicator for zero delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaSpeed: 0 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-speed')).toHaveTextContent('◈')
  })

  it('uses ◈ indicator for null delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaDamage: null })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-damage')).toHaveTextContent('◈')
  })

  it('applies positive color for positive delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaDamage: 5 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-damage')).toHaveStyle({ color: 'var(--color-data-positive)' })
  })

  it('applies negative color for negative delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaSurvivability: -3 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-surv')).toHaveStyle({ color: 'var(--color-data-negative)' })
  })

  it('applies neutral color for zero delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaSpeed: 0 })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-speed')).toHaveStyle({ color: 'var(--color-data-neutral)' })
  })

  it('applies neutral color for null delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ deltaDamage: null })} toNodeName="Node A" />)
    expect(screen.getByTestId('delta-damage')).toHaveStyle({ color: 'var(--color-data-neutral)' })
  })

  // Story 3.5: interaction tests

  it('renders Preview, Apply, Skip buttons when not applied', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-preview-btn')).toBeInTheDocument()
    expect(screen.getByTestId('suggestion-apply-btn')).toBeInTheDocument()
    expect(screen.getByTestId('suggestion-skip-btn')).toBeInTheDocument()
  })

  it('calls onApply when Apply button clicked', () => {
    const onApply = vi.fn()
    render(<SuggestionCard {...DEFAULT_HANDLERS} onApply={onApply} suggestion={makeSuggestion()} toNodeName="Node A" />)
    fireEvent.click(screen.getByTestId('suggestion-apply-btn'))
    expect(onApply).toHaveBeenCalledOnce()
  })

  it('calls onSkip when Skip button clicked', () => {
    const onSkip = vi.fn()
    render(<SuggestionCard {...DEFAULT_HANDLERS} onSkip={onSkip} suggestion={makeSuggestion()} toNodeName="Node A" />)
    fireEvent.click(screen.getByTestId('suggestion-skip-btn'))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('calls onPreview when Preview button clicked', () => {
    const onPreview = vi.fn()
    render(<SuggestionCard {...DEFAULT_HANDLERS} onPreview={onPreview} suggestion={makeSuggestion()} toNodeName="Node A" />)
    fireEvent.click(screen.getByTestId('suggestion-preview-btn'))
    expect(onPreview).toHaveBeenCalledOnce()
  })

  it('calls onHoverEnter on mouse enter', () => {
    const onHoverEnter = vi.fn()
    render(<SuggestionCard {...DEFAULT_HANDLERS} onHoverEnter={onHoverEnter} suggestion={makeSuggestion()} toNodeName="Node A" />)
    fireEvent.mouseEnter(screen.getByTestId('suggestion-card-1'))
    expect(onHoverEnter).toHaveBeenCalledOnce()
  })

  it('calls onHoverLeave on mouse leave', () => {
    const onHoverLeave = vi.fn()
    render(<SuggestionCard {...DEFAULT_HANDLERS} onHoverLeave={onHoverLeave} suggestion={makeSuggestion()} toNodeName="Node A" />)
    fireEvent.mouseLeave(screen.getByTestId('suggestion-card-1'))
    expect(onHoverLeave).toHaveBeenCalledOnce()
  })

  it('shows applied badge and hides buttons when isApplied', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} isApplied suggestion={makeSuggestion()} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-applied-badge')).toBeInTheDocument()
    expect(screen.queryByTestId('suggestion-apply-btn')).toBeNull()
    expect(screen.queryByTestId('suggestion-skip-btn')).toBeNull()
    expect(screen.queryByTestId('suggestion-preview-btn')).toBeNull()
  })

  it('aria-label includes score deltas in before → after format', () => {
    const suggestion = makeSuggestion({
      rank: 2,
      nodeChange: { fromNodeId: null, toNodeId: 'n1', pointsChange: 1 },
      explanation: 'Great synergy',
      baselineScore: { damage: 47, survivability: 30, speed: 10 },
      previewScore: { damage: 52, survivability: 30, speed: 10 },
    })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Iron Mastery" />)
    const card = screen.getByRole('article')
    const label = card.getAttribute('aria-label') ?? ''
    expect(label).toContain('Damage: 47 → 52')
    expect(label).toContain('Survivability: 30 → 30')
    expect(label).toContain('Speed: 10 → 10')
    expect(label).toContain('[Rank 2]')
    expect(label).toContain('Great synergy')
  })

  it('aria-label formats null score as em dash', () => {
    const suggestion = makeSuggestion({
      baselineScore: { damage: null, survivability: null, speed: null },
      previewScore: { damage: null, survivability: null, speed: null },
    })
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={suggestion} toNodeName="Node A" />)
    const card = screen.getByRole('article')
    const label = card.getAttribute('aria-label') ?? ''
    expect(label).toContain('Damage: — → —')
  })

  it('shows apply error message when applyError is set', () => {
    render(
      <SuggestionCard
        {...DEFAULT_HANDLERS}
        suggestion={makeSuggestion()}
        toNodeName="Node A"
        applyError="Cannot apply: prerequisite node not allocated"
      />
    )
    expect(screen.getByTestId('suggestion-apply-error')).toHaveTextContent('Cannot apply: prerequisite node not allocated')
  })

  it('does not show apply error when applyError is null', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" applyError={null} />)
    expect(screen.queryByTestId('suggestion-apply-error')).toBeNull()
  })

  // ── Story 3.3 — FR-19 content + cross-highlight activation ──

  it('renders the composite score delta with sign and indicator', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" scoreDelta={4.2} />)
    const delta = screen.getByTestId('suggestion-score-delta')
    expect(delta).toHaveTextContent('▲')
    expect(delta).toHaveTextContent('4.2')
  })

  it('uses the down indicator and negative color for a negative score delta', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" scoreDelta={-1.5} />)
    const delta = screen.getByTestId('suggestion-score-delta')
    expect(delta).toHaveTextContent('▼')
    expect(delta).toHaveTextContent('1.5')
    expect(delta).toHaveStyle({ color: 'var(--color-data-negative)' })
  })

  it('omits the score delta when scoreDelta is null/undefined', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" scoreDelta={null} />)
    expect(screen.queryByTestId('suggestion-score-delta')).toBeNull()
  })

  it('renders the FR-19 point cost + path cost line', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" pointCost={2} pathCost={4} />)
    expect(screen.getByTestId('suggestion-cost')).toHaveTextContent('2 pts / 4 pts to reach')
  })

  it('drops the "to reach" clause when the node is directly reachable (pathCost 0)', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" pointCost={2} pathCost={0} />)
    const cost = screen.getByTestId('suggestion-cost')
    expect(cost).toHaveTextContent('2 pts')
    expect(cost.textContent).not.toContain('to reach')
  })

  it('shows the Claude explanation by default (no hover/expand needed)', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion({ explanation: 'Crit synergy' })} toNodeName="Node A" />)
    expect(screen.getByTestId('suggestion-explanation')).toHaveTextContent('Crit synergy')
  })

  it('fires onActivate when the card body is clicked', () => {
    const onActivate = vi.fn()
    render(<SuggestionCard {...DEFAULT_HANDLERS} onActivate={onActivate} suggestion={makeSuggestion()} toNodeName="Node A" />)
    fireEvent.click(screen.getByTestId('suggestion-card-1'))
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it('does NOT fire onActivate when an action button is clicked (stopPropagation)', () => {
    const onActivate = vi.fn()
    const onApply = vi.fn()
    render(<SuggestionCard {...DEFAULT_HANDLERS} onActivate={onActivate} onApply={onApply} suggestion={makeSuggestion()} toNodeName="Node A" />)
    fireEvent.click(screen.getByTestId('suggestion-apply-btn'))
    expect(onApply).toHaveBeenCalledOnce()
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('extends the aria-label with the score delta and cost when provided', () => {
    render(<SuggestionCard {...DEFAULT_HANDLERS} suggestion={makeSuggestion()} toNodeName="Node A" scoreDelta={4.2} pointCost={2} pathCost={4} />)
    const label = screen.getByRole('article').getAttribute('aria-label') ?? ''
    expect(label).toContain('Score +4.2')
    expect(label).toContain('2 pts / 4 pts to reach')
  })
})
