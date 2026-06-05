import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreGauge } from './ScoreGauge'
import type { BuildScore } from '../../shared/types/optimization'

const FULL_SCORE: BuildScore = { damage: 80, survivability: 60, speed: 20 }
const NULL_SCORE: BuildScore = { damage: null, survivability: null, speed: null }
const PARTIAL_NULL: BuildScore = { damage: 50, survivability: null, speed: 10 }

describe('ScoreGauge', () => {
  it('renders the region wrapper and Build Score label', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.getByTestId('score-gauge')).toBeInTheDocument()
    expect(screen.getByText('Build Score')).toBeInTheDocument()
  })

  it('renders the composite score as the rounded average of non-null axes', () => {
    // damage=80, surv=60, speed=20 → composite = round((80+60+20)/3) = 53
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.getByTestId('gauge-center')).toHaveTextContent('53')
  })

  it('averages only non-null axes', () => {
    // damage=50, surv=null, speed=10 → composite = round((50+10)/2) = 30
    render(<ScoreGauge baselineScore={PARTIAL_NULL} />)
    expect(screen.getByTestId('gauge-center')).toHaveTextContent('30')
  })

  it('shows em dash composite when all axes are null', () => {
    render(<ScoreGauge baselineScore={NULL_SCORE} />)
    expect(screen.getByTestId('gauge-center')).toHaveTextContent('—')
  })

  it('shows em dash composite when baselineScore is null', () => {
    render(<ScoreGauge baselineScore={null} />)
    expect(screen.getByTestId('gauge-center')).toHaveTextContent('—')
  })

  it('shows no delta when previewScore is undefined', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} />)
    expect(screen.queryByTestId('gauge-delta')).toBeNull()
  })

  it('shows an upward delta when preview composite exceeds baseline', () => {
    // base composite = 53, preview = round((90+70+25)/3) = 62 → ▲ 9.0
    const preview: BuildScore = { damage: 90, survivability: 70, speed: 25 }
    render(<ScoreGauge baselineScore={FULL_SCORE} previewScore={preview} />)
    const delta = screen.getByTestId('gauge-delta')
    expect(delta).toHaveTextContent('▲')
    expect(delta).toHaveTextContent('9.0')
  })

  it('shows a downward delta when preview composite is below baseline', () => {
    // base composite = 53, preview = round((60+50+10)/3) = 40 → ▼ 13.0
    const preview: BuildScore = { damage: 60, survivability: 50, speed: 10 }
    render(<ScoreGauge baselineScore={FULL_SCORE} previewScore={preview} />)
    const delta = screen.getByTestId('gauge-delta')
    expect(delta).toHaveTextContent('▼')
    expect(delta).toHaveTextContent('13.0')
  })

  it('shows no delta when preview composite equals baseline', () => {
    render(<ScoreGauge baselineScore={FULL_SCORE} previewScore={FULL_SCORE} />)
    expect(screen.queryByTestId('gauge-delta')).toBeNull()
  })
})
