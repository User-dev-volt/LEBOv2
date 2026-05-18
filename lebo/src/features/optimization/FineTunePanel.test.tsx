import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { FineTunePanel } from './FineTunePanel'

describe('FineTunePanel', () => {
  let initialState: ReturnType<typeof useOptimizationStore.getState>

  beforeAll(() => {
    initialState = useOptimizationStore.getState()
  })

  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
  })

  it('renders "Fine Tune" trigger button', () => {
    render(<FineTunePanel />)
    expect(screen.getByRole('button', { name: /fine tune/i })).toBeInTheDocument()
  })

  it('clicking trigger reveals sub-sliders', () => {
    render(<FineTunePanel />)
    fireEvent.click(screen.getByRole('button', { name: /fine tune/i }))
    expect(screen.getByRole('slider', { name: 'Damage Weight' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Survivability Weight' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Speed Weight' })).toBeInTheDocument()
  })

  it('sub-sliders initialize from sliderPosition=70 (damage=70, survivability=30, speed=0)', () => {
    useOptimizationStore.setState({ sliderPosition: 70 })
    render(<FineTunePanel />)
    fireEvent.click(screen.getByRole('button', { name: /fine tune/i }))
    expect(screen.getByRole('slider', { name: 'Damage Weight' })).toHaveAttribute('aria-valuenow', '70')
    expect(screen.getByRole('slider', { name: 'Survivability Weight' })).toHaveAttribute('aria-valuenow', '30')
    expect(screen.getByRole('slider', { name: 'Speed Weight' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('adjusting damage sub-slider sets fineTuneWeights in store', () => {
    render(<FineTunePanel />)
    fireEvent.click(screen.getByRole('button', { name: /fine tune/i }))
    const damageSlider = screen.getByRole('slider', { name: 'Damage Weight' })
    fireEvent.change(damageSlider, { target: { value: '60' } })
    expect(useOptimizationStore.getState().fineTuneWeights).not.toBeNull()
    expect(useOptimizationStore.getState().fineTuneWeights?.damage).toBe(60)
  })

  it('shows "(Custom)" when fineTuneWeights is non-null', () => {
    useOptimizationStore.setState({ fineTuneWeights: { damage: 60, survivability: 30, speed: 10 } })
    render(<FineTunePanel />)
    expect(screen.getByRole('button', { name: /fine tune.*custom/i })).toBeInTheDocument()
  })

  it('does not show "(Custom)" when fineTuneWeights is null', () => {
    render(<FineTunePanel />)
    const button = screen.getByRole('button', { name: /fine tune/i })
    expect(button.textContent).not.toContain('Custom')
  })

  it('each sub-slider has role="slider" and distinct aria-label', () => {
    render(<FineTunePanel />)
    fireEvent.click(screen.getByRole('button', { name: /fine tune/i }))
    expect(screen.getByRole('slider', { name: 'Damage Weight' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Survivability Weight' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Speed Weight' })).toBeInTheDocument()
  })

  it('passes axe accessibility check (collapsed)', async () => {
    const { container } = render(<FineTunePanel />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('passes axe accessibility check (expanded)', async () => {
    const { container } = render(<FineTunePanel />)
    fireEvent.click(screen.getByRole('button', { name: /fine tune/i }))
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('setSliderPosition scaling with fineTuneWeights', () => {
  let initialState: ReturnType<typeof useOptimizationStore.getState>

  beforeAll(() => {
    initialState = useOptimizationStore.getState()
  })

  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
  })

  it('does not modify fineTuneWeights when sliderPosition changes', () => {
    useOptimizationStore.setState({
      fineTuneWeights: { damage: 60, survivability: 30, speed: 10 },
      sliderPosition: 50,
    })
    useOptimizationStore.getState().setSliderPosition(70)
    const weights = useOptimizationStore.getState().fineTuneWeights
    expect(weights?.damage).toBe(60)
    expect(weights?.survivability).toBe(30)
    expect(weights?.speed).toBe(10)
    expect(useOptimizationStore.getState().sliderPosition).toBe(70)
  })

  it('does not modify fineTuneWeights when null', () => {
    useOptimizationStore.setState({ fineTuneWeights: null, sliderPosition: 50 })
    useOptimizationStore.getState().setSliderPosition(70)
    expect(useOptimizationStore.getState().fineTuneWeights).toBeNull()
    expect(useOptimizationStore.getState().sliderPosition).toBe(70)
  })
})
