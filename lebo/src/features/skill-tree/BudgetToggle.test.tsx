import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { BudgetToggle } from './BudgetToggle'
import { useBuildStore } from '../../shared/stores/buildStore'

vi.mock('../../shared/stores/buildStore', () => ({
  useBuildStore: vi.fn(),
}))

const mockSetCharacterLevel = vi.fn()
const mockSetBudgetEnforced = vi.fn()

const baseStore = {
  activeBuild: {
    schemaVersion: 1 as const,
    id: 'build-1',
    name: 'Test',
    classId: 'sentinel',
    masteryId: 'void_knight',
    characterLevel: 10,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    contextData: { gear: [], skills: [], idols: [] },
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  setCharacterLevel: mockSetCharacterLevel,
  setBudgetEnforced: mockSetBudgetEnforced,
}

describe('BudgetToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: typeof baseStore) => unknown) => selector(baseStore)
    )
  })

  it('renders level input with current characterLevel', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    expect((input as HTMLInputElement).value).toBe('10')
  })

  it('renders the budget toggle switch', () => {
    render(<BudgetToggle />)
    const toggle = screen.getByRole('switch', { name: /enforce level budget/i })
    expect(toggle).toBeTruthy()
  })

  it('calls setCharacterLevel with clamped value on blur', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '50' } })
    expect(mockSetCharacterLevel).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(mockSetCharacterLevel).toHaveBeenCalledWith(50)
  })

  it('does not write to store while typing (before blur)', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '' } })
    expect(mockSetCharacterLevel).not.toHaveBeenCalled()
  })

  it('clamps to 1 when field is cleared and blurred', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(mockSetCharacterLevel).toHaveBeenCalledWith(1)
  })

  it('clamps level to 100 when value exceeds max', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '150' } })
    fireEvent.blur(input)
    expect(mockSetCharacterLevel).toHaveBeenCalledWith(100)
  })

  it('clamps level to 1 when value is below min', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)
    expect(mockSetCharacterLevel).toHaveBeenCalledWith(1)
  })

  it('commits on Enter key', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '75' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockSetCharacterLevel).toHaveBeenCalledWith(75)
  })

  it('does not double-write to store when Enter is followed by blur with same value', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '75' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(mockSetCharacterLevel).toHaveBeenCalledTimes(1)
    expect(mockSetCharacterLevel).toHaveBeenCalledWith(75)
  })

  it('reverts to stored level on Escape and does not write to store', () => {
    render(<BudgetToggle />)
    const input = screen.getByRole('spinbutton', { name: /character level/i })
    fireEvent.change(input, { target: { value: '77' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockSetCharacterLevel).not.toHaveBeenCalled()
    expect((input as HTMLInputElement).value).toBe('10')
  })

  it('calls setBudgetEnforced exactly once when switch is clicked', () => {
    render(<BudgetToggle />)
    const toggle = screen.getByRole('switch', { name: /enforce level budget/i })
    fireEvent.click(toggle)
    expect(mockSetBudgetEnforced).toHaveBeenCalledTimes(1)
    expect(mockSetBudgetEnforced).toHaveBeenCalledWith(true)
  })

  it('returns null when activeBuild is null', () => {
    ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: typeof baseStore) => unknown) =>
        selector({ ...baseStore, activeBuild: null as unknown as typeof baseStore['activeBuild'] })
    )
    const { container } = render(<BudgetToggle />)
    expect(container.firstChild).toBeNull()
  })

  it('passes axe accessibility check', async () => {
    const { container } = render(<BudgetToggle />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
