import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { OptimizationSlider } from './OptimizationSlider'

describe('OptimizationSlider', () => {
  let initialState: ReturnType<typeof useOptimizationStore.getState>

  beforeAll(() => {
    initialState = useOptimizationStore.getState()
  })

  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
  })

  it('renders with default sliderPosition 50', () => {
    render(<OptimizationSlider />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50')
  })

  it('renders endpoint labels "Juggernaut" and "Glass Cannon"', () => {
    render(<OptimizationSlider />)
    expect(screen.getByText('Juggernaut')).toBeInTheDocument()
    expect(screen.getByText('Glass Cannon')).toBeInTheDocument()
  })

  it('renders aria-valuetext with correct weight split at default 50', () => {
    render(<OptimizationSlider />)
    expect(screen.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      '50% Survivability / 50% Damage'
    )
  })

  it('renders aria-label "Optimization intent"', () => {
    render(<OptimizationSlider />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Optimization intent')
  })

  it('arrow right key increments sliderPosition by 5', () => {
    render(<OptimizationSlider />)
    const input = screen.getByRole('slider')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(useOptimizationStore.getState().sliderPosition).toBe(55)
  })

  it('arrow left key decrements sliderPosition by 5', () => {
    useOptimizationStore.setState({ sliderPosition: 60 })
    render(<OptimizationSlider />)
    const input = screen.getByRole('slider')
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(useOptimizationStore.getState().sliderPosition).toBe(55)
  })

  it('arrow right at 100 clamps to 100', () => {
    useOptimizationStore.setState({ sliderPosition: 100 })
    render(<OptimizationSlider />)
    const input = screen.getByRole('slider')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(useOptimizationStore.getState().sliderPosition).toBe(100)
  })

  it('arrow left at 0 clamps to 0', () => {
    useOptimizationStore.setState({ sliderPosition: 0 })
    render(<OptimizationSlider />)
    const input = screen.getByRole('slider')
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(useOptimizationStore.getState().sliderPosition).toBe(0)
  })

  it('onChange updates sliderPosition in store', () => {
    render(<OptimizationSlider />)
    const input = screen.getByRole('slider')
    fireEvent.change(input, { target: { value: '75' } })
    expect(useOptimizationStore.getState().sliderPosition).toBe(75)
  })

  it('passes axe accessibility check', async () => {
    const { container } = render(<OptimizationSlider />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
