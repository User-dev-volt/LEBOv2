import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { axe } from 'vitest-axe'
import 'vitest-axe/extend-expect'
import { SkillPickerGrid } from './SkillPickerGrid'
import type { SkillEntry } from '../../shared/types/gameData'

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn().mockResolvedValue(null),
}))

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tauri-apps/api/core')>()
  return {
    ...actual,
    convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  }
})

const baseSkills: SkillEntry[] = [
  { skillId: 'skill-1', skillName: 'Forge Strike', masteryId: null, masteryName: null, masteryGatePoints: null, type: 'unknown' },
  { skillId: 'skill-2', skillName: 'Warpath', masteryId: null, masteryName: null, masteryGatePoints: null, type: 'unknown' },
]

const masterySkills: SkillEntry[] = [
  { skillId: 'skill-3', skillName: 'Lunge', masteryId: 'void_knight', masteryName: 'Void Knight', masteryGatePoints: 15, type: 'unknown' },
  { skillId: 'skill-4', skillName: 'Devouring Orb', masteryId: 'void_knight', masteryName: 'Void Knight', masteryGatePoints: 20, type: 'unknown' },
  { skillId: 'skill-5', skillName: 'Hammer Throw', masteryId: 'forge_guard', masteryName: 'Forge Guard', masteryGatePoints: 10, type: 'unknown' },
]

const allSkills = [...baseSkills, ...masterySkills]

describe('SkillPickerGrid', () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders section headers for base class and mastery sections', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={allSkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Sentinel Skills')).toBeInTheDocument()
    expect(screen.getByText('Void Knight Skills')).toBeInTheDocument()
    expect(screen.getByText('Forge Guard Skills')).toBeInTheDocument()
  })

  it('renders mastery-gated cells with correct badge point threshold', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={allSkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('applies gold border class to the selected skill cell', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={allSkills}
        selectedSkillId="skill-1"
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    const selectedCell = screen.getByRole('gridcell', { name: /Forge Strike/ })
    expect(selectedCell).toHaveClass('border')
    const nonSelectedCell = screen.getByRole('gridcell', { name: /Warpath/ })
    expect(nonSelectedCell).not.toHaveClass('border')
  })

  it('calls onSelect with correct skillId when Enter is pressed on focused cell', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={allSkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('skill-1')
  })

  it('calls onClose when Escape is pressed', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={allSkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has role="grid" on container and role="gridcell" on each skill cell', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={allSkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    expect(screen.getByRole('grid')).toBeInTheDocument()
    const cells = screen.getAllByRole('gridcell')
    expect(cells).toHaveLength(allSkills.length)
  })

  it('has correct aria-label for base class skills', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={baseSkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    expect(screen.getByRole('gridcell', { name: 'Forge Strike (base class skill)' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'Warpath (base class skill)' })).toBeInTheDocument()
  })

  it('has correct aria-label for mastery-gated skills', () => {
    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={masterySkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    expect(
      screen.getByRole('gridcell', { name: 'Lunge (Void Knight skill, requires 15 points)' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('gridcell', { name: 'Hammer Throw (Forge Guard skill, requires 10 points)' })
    ).toBeInTheDocument()
  })

  it('passes axe accessibility check with zero violations', async () => {
    const { container } = render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={allSkills}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    await act(async () => {})
    expect(await axe(container)).toHaveNoViolations()
  })

  it('converts icon path with convertFileSrc before storing', async () => {
    const mockPath = '/cache/icons/skills/skillIcon-fireball.png'
    const { invokeCommand } = await import('../../shared/utils/invokeCommand')
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    vi.mocked(invokeCommand).mockResolvedValueOnce(mockPath)

    render(
      <SkillPickerGrid
        baseClassName="Sentinel"
        skills={[baseSkills[0]]}
        selectedSkillId={null}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    await act(async () => {})

    expect(convertFileSrc).toHaveBeenCalledWith(mockPath)
  })
})
