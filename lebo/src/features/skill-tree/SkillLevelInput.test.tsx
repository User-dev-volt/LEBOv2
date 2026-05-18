import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { SkillLevelInput } from './SkillLevelInput'
import { useBuildStore } from '../../shared/stores/buildStore'

vi.mock('../../shared/stores/buildStore', () => ({
  useBuildStore: vi.fn(),
}))

const mockSetSkillLevel = vi.fn()

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
    activeSkillLevels: { 'slot-0': 5 },
    contextData: { gear: [], skills: [], idols: [] },
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  setSkillLevel: mockSetSkillLevel,
}

describe('SkillLevelInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: typeof baseStore) => unknown) => selector(baseStore)
    )
  })

  it('renders label and input', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    expect(screen.getByText('Skill Lv.')).toBeTruthy()
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    expect((input as HTMLInputElement).value).toBe('5')
  })

  it('shows default level 1 when slotId not in activeSkillLevels', () => {
    render(<SkillLevelInput slotId="slot-3" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    expect((input as HTMLInputElement).value).toBe('1')
  })

  it('value change commits on blur', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    fireEvent.change(input, { target: { value: '15' } })
    expect(mockSetSkillLevel).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(mockSetSkillLevel).toHaveBeenCalledWith('slot-0', 15)
  })

  it('clear-then-blur defaults to 1', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(mockSetSkillLevel).toHaveBeenCalledWith('slot-0', 1)
  })

  it('clamps to MAX_SKILL_LEVEL (20) when value exceeds max', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.blur(input)
    expect(mockSetSkillLevel).toHaveBeenCalledWith('slot-0', 20)
  })

  it('clamps to 1 when value is below min', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)
    expect(mockSetSkillLevel).toHaveBeenCalledWith('slot-0', 1)
  })

  it('Enter commits the value', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockSetSkillLevel).toHaveBeenCalledWith('slot-0', 12)
  })

  it('does not double-write when Enter is followed by blur', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(mockSetSkillLevel).toHaveBeenCalledTimes(1)
  })

  it('Escape reverts to stored value without writing to store', () => {
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    fireEvent.change(input, { target: { value: '18' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockSetSkillLevel).not.toHaveBeenCalled()
    expect((input as HTMLInputElement).value).toBe('5')
  })

  it('external store change syncs while not focused', () => {
    const updatedStore = {
      ...baseStore,
      activeBuild: {
        ...baseStore.activeBuild,
        activeSkillLevels: { 'slot-0': 17 },
      },
    }
    ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: typeof updatedStore) => unknown) => selector(updatedStore)
    )
    render(<SkillLevelInput slotId="slot-0" />)
    const input = screen.getByRole('spinbutton', { name: /skill level/i })
    expect((input as HTMLInputElement).value).toBe('17')
  })

  it('returns null when activeBuild is null', () => {
    ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: typeof baseStore) => unknown) =>
        selector({ ...baseStore, activeBuild: null as unknown as typeof baseStore['activeBuild'] })
    )
    const { container } = render(<SkillLevelInput slotId="slot-0" />)
    expect(container.firstChild).toBeNull()
  })

  it('passes axe accessibility check', async () => {
    const { container } = render(<SkillLevelInput slotId="slot-0" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
