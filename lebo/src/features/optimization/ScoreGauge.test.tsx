import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreGauge } from './ScoreGauge'
import type { BuildScore } from '../../shared/types/optimization'

const FULL_SCORE: BuildScore = { damage: 80, survivability: 60, speed: 20 }
const NULL_SCORE: BuildScore = { damage: null, survivability: null, speed: null }
const PARTIAL_NULL: BuildScore = { damage: 50, survivability: null, speed: 10 }

describe('ScoreGauge', () => {
  it('renders three axis rows', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.getByTestId('axis-damage')).toBeInTheDocument()
    expect(screen.getByTestId('axis-survivability')).toBeInTheDocument()
    expect(screen.getByTestId('axis-speed')).toBeInTheDocument()
  })

  it('renders axis labels', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.getByText('Damage')).toBeInTheDocument()
    expect(screen.getByText('Surv')).toBeInTheDocument()
    expect(screen.getByText('Speed')).toBeInTheDocument()
  })

  it('renders numeric score values', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('renders null scores as em dash (—)', () => {
    render(<ScoreGauge baselineScore={NULL_SCORE} />)
    const dashes = screen.getAllByText('—')
    // Three axis dashes + composite dash
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })

  it('renders em dash for null axes and number for non-null axes in partial null score', () => {
    render(<ScoreGauge baselineScore={PARTIAL_NULL} />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('renders em dash for all axes when baselineScore is null', () => {
    render(<ScoreGauge baselineScore={null} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })

  it('renders composite score as average of non-null axes', () => {
    // damage=80, surv=60, speed=20 → composite = round((80+60+20)/3) = round(53.33) = 53
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.getByText('53')).toBeInTheDocument()
  })

  it('composite averages only non-null axes', () => {
    // damage=50, surv=null, speed=10 → composite = round((50+10)/2) = 30
    render(<ScoreGauge baselineScore={PARTIAL_NULL} />)
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('composite is em dash when all axes are null', () => {
    render(<ScoreGauge baselineScore={NULL_SCORE} />)
    // All four display values (3 axes + composite) should be em dash
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBe(4)
  })

  it('renders composite row', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.getByTestId('composite-row')).toBeInTheDocument()
    expect(screen.getByText('Composite')).toBeInTheDocument()
  })

  it('comparison mode renders → arrow between baseline and preview scores', () => {
    const preview: BuildScore = { damage: 90, survivability: 70, speed: 25 }
    render(<ScoreGauge baselineScore={FULL_SCORE} previewScore={preview} />)
    // Arrows appear in axis rows and composite row
    const arrows = screen.getAllByText(/→/)
    expect(arrows.length).toBeGreaterThanOrEqual(3)
  })

  it('comparison mode shows both baseline and preview values', () => {
    const preview: BuildScore = { damage: 90, survivability: 70, speed: 25 }
    render(<ScoreGauge baselineScore={FULL_SCORE} previewScore={preview} />)
    expect(screen.getByText('80 → 90')).toBeInTheDocument()
    expect(screen.getByText('60 → 70')).toBeInTheDocument()
    expect(screen.getByText('20 → 25')).toBeInTheDocument()
  })

  it('no comparison mode when previewScore is undefined', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.queryByText(/→/)).toBeNull()
  })
})
