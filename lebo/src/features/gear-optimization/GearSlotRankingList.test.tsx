import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { GearSlotRankingList } from './GearSlotRankingList'
import type { GearSlotRanking, WishlistAffix } from '../../shared/types/statSheet'

function makeAffix(satisfied: boolean): WishlistAffix {
  return {
    affix_id: 'test-affix',
    display_name: 'Hybrid Health',
    target_tier: 5,
    weight: 0.8,
    mechanical_reason: 'Increases effective HP by 15%',
    satisfied,
  }
}

function makeRanking(slot: string, efficiencyPercent: number, wishlistFilled = false): GearSlotRanking {
  return {
    slot,
    upgrade_score: 100 - efficiencyPercent,
    efficiency_percent: efficiencyPercent,
    ideal_prefix: wishlistFilled ? [makeAffix(false)] : [],
    ideal_suffix: wishlistFilled ? [makeAffix(true)] : [],
  }
}

describe('GearSlotRankingList', () => {
  it('renders slot display names from ranking data', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 73)]} prioritySlot="" />)
    expect(screen.getByText('Helmet')).toBeInTheDocument()
    expect(screen.getByText('73% of ideal')).toBeInTheDocument()
  })

  it('falls back to raw slot ID if unrecognized', () => {
    render(<GearSlotRankingList rankings={[makeRanking('unknownslot', 90)]} prioritySlot="" />)
    expect(screen.getByText('unknownslot')).toBeInTheDocument()
  })

  it('renders nothing when rankings array is empty', () => {
    const { container } = render(<GearSlotRankingList rankings={[]} prioritySlot="" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows Priority badge on the priority slot', () => {
    const rankings = [makeRanking('helmet', 40), makeRanking('boots', 80)]
    render(<GearSlotRankingList rankings={rankings} prioritySlot="helmet" />)
    expect(screen.getByLabelText('Priority Upgrade slot')).toBeInTheDocument()
  })

  it('does not show Priority badge on non-priority slots', () => {
    const rankings = [makeRanking('helmet', 40), makeRanking('boots', 80)]
    render(<GearSlotRankingList rankings={rankings} prioritySlot="helmet" />)
    // Only one priority badge exists
    expect(screen.getAllByLabelText('Priority Upgrade slot')).toHaveLength(1)
  })

  it('shows no Priority badge when prioritySlot is empty string', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 100)]} prioritySlot="" />)
    expect(screen.queryByLabelText('Priority Upgrade slot')).toBeNull()
  })

  it('shows checkmark for satisfied wishlist affixes', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 80, true)]} prioritySlot="" />)
    const satisfiedRow = screen.getByLabelText(/satisfied/i)
    expect(satisfiedRow).toBeInTheDocument()
  })

  it('shows missing indicator for unsatisfied wishlist affixes', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 80, true)]} prioritySlot="" />)
    const missingRow = screen.getByLabelText(/missing or below tier/i)
    expect(missingRow).toBeInTheDocument()
  })

  it('shows mechanical reason for unsatisfied affixes', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 80, true)]} prioritySlot="" />)
    expect(screen.getByText('Increases effective HP by 15%')).toBeInTheDocument()
  })

  it('does not show mechanical reason for satisfied affixes', () => {
    const affixSatisfied: WishlistAffix = {
      affix_id: 'sat-affix',
      display_name: 'Satisfied Affix',
      target_tier: 3,
      weight: 0.5,
      mechanical_reason: 'This reason should not appear',
      satisfied: true,
    }
    const ranking: GearSlotRanking = {
      slot: 'helmet',
      upgrade_score: 0,
      efficiency_percent: 100,
      ideal_prefix: [affixSatisfied],
      ideal_suffix: [],
    }
    render(<GearSlotRankingList rankings={[ranking]} prioritySlot="" />)
    expect(screen.queryByText('This reason should not appear')).toBeNull()
  })

  it('shows no affix data message when wishlist is empty', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 100, false)]} prioritySlot="" />)
    expect(screen.getByText(/no affix recommendations available/i)).toBeInTheDocument()
  })

  it('shows Prefixes and Suffixes section labels when wishlist is filled', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 80, true)]} prioritySlot="" />)
    expect(screen.getByText('Prefixes')).toBeInTheDocument()
    expect(screen.getByText('Suffixes')).toBeInTheDocument()
  })

  it('handles Rust canonical slot ID variants', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helm', 60)]} prioritySlot="" />)
    expect(screen.getByText('Helmet')).toBeInTheDocument()
    render(<GearSlotRankingList rankings={[makeRanking('chest', 60)]} prioritySlot="" />)
    expect(screen.getAllByText('Body').length).toBeGreaterThan(0)
  })

  it('renders multiple slots', () => {
    const rankings = [
      makeRanking('helmet', 40),
      makeRanking('boots', 70),
      makeRanking('weapon', 90),
    ]
    render(<GearSlotRankingList rankings={rankings} prioritySlot="" />)
    expect(screen.getByText('Helmet')).toBeInTheDocument()
    expect(screen.getByText('Boots')).toBeInTheDocument()
    expect(screen.getByText('Weapon')).toBeInTheDocument()
  })

  it('passes axe accessibility check', async () => {
    const { container } = render(
      <GearSlotRankingList
        rankings={[makeRanking('helmet', 40, true), makeRanking('boots', 80)]}
        prioritySlot="helmet"
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
