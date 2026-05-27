import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkillTreeTabBar } from './SkillTreeTabBar'
import type { ActiveSkill } from '../../shared/types/build'

const twoSkills: ActiveSkill[] = [
  { slotId: 'slot-1', skillId: 'judgement', skillName: 'Judgement' },
  { slotId: 'slot-2', skillId: 'volatile-reversal', skillName: 'Volatile Reversal' },
]

describe('SkillTreeTabBar', () => {
  it('always renders 7 tabs (passive + 5 skill slots + weaver)', () => {
    render(<SkillTreeTabBar activeSkills={[]} selectedIndex={0} onChange={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(7)
    expect(screen.getByText('Passive Tree')).toBeInTheDocument()
    expect(screen.getByText('Skill 1')).toBeInTheDocument()
    expect(screen.getByText('Skill 5')).toBeInTheDocument()
    expect(screen.getByText('Weaver Tree')).toBeInTheDocument()
  })

  it('shows assigned skill names and fallback labels for empty slots', () => {
    render(<SkillTreeTabBar activeSkills={twoSkills} selectedIndex={0} onChange={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(7)
    expect(screen.getByText('Skill 1')).toBeInTheDocument()
    expect(screen.getByText('Judgement')).toBeInTheDocument()
    expect(screen.getByText('Volatile Reversal')).toBeInTheDocument()
    expect(screen.getByText('Skill 4')).toBeInTheDocument()
  })

  it('marks the tab at selectedIndex as aria-selected', () => {
    render(<SkillTreeTabBar activeSkills={twoSkills} selectedIndex={1} onChange={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(tabs[2].getAttribute('aria-selected')).toBe('false')
  })

  it('calls onChange with the clicked tab index', async () => {
    const onChange = vi.fn()
    render(<SkillTreeTabBar activeSkills={twoSkills} selectedIndex={0} onChange={onChange} />)
    await userEvent.click(screen.getByText('Judgement'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('calls onSkillTabClick with correct slotIndex when a skill tab is clicked', async () => {
    const onSkillTabClick = vi.fn()
    render(
      <SkillTreeTabBar
        activeSkills={twoSkills}
        selectedIndex={0}
        onChange={() => {}}
        onSkillTabClick={onSkillTabClick}
      />
    )
    await userEvent.click(screen.getByText('Skill 1'))
    expect(onSkillTabClick).toHaveBeenCalledWith(0, expect.any(HTMLButtonElement))
  })

  it('renders Weaver Tree as the last (rightmost) tab', () => {
    render(<SkillTreeTabBar activeSkills={[]} selectedIndex={0} onChange={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[tabs.length - 1]).toHaveTextContent('Weaver Tree')
  })

  it('does not call onSkillTabClick when Weaver Tree tab is clicked', async () => {
    const onSkillTabClick = vi.fn()
    render(
      <SkillTreeTabBar
        activeSkills={[]}
        selectedIndex={0}
        onChange={() => {}}
        onSkillTabClick={onSkillTabClick}
      />
    )
    await userEvent.click(screen.getByText('Weaver Tree'))
    expect(onSkillTabClick).not.toHaveBeenCalled()
  })
})

describe('SkillTreeTabBar icon rendering', () => {
  const mockActiveSkill: ActiveSkill = {
    slotId: 'slot-0',
    skillId: 'mage-fireball',
    skillName: 'Fireball',
  }

  it('renders img with aria-hidden when iconUrls has a URL for the assigned skill', () => {
    const iconUrls = new Map([['mage-fireball', 'asset://localhost/icons/skillIcon-fireball.png']])
    render(
      <SkillTreeTabBar
        activeSkills={[mockActiveSkill]}
        selectedIndex={0}
        onChange={vi.fn()}
        iconUrls={iconUrls}
      />
    )
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img?.src).toContain('skillIcon-fireball.png')
    expect(img?.alt).toBe('')
  })

  it('renders no img when iconUrls prop is omitted', () => {
    render(
      <SkillTreeTabBar
        activeSkills={[mockActiveSkill]}
        selectedIndex={0}
        onChange={vi.fn()}
      />
    )
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull()
  })

  it('renders no img for skill tabs with no assigned skill', () => {
    const iconUrls = new Map([['mage-fireball', 'asset://localhost/icons/skillIcon-fireball.png']])
    render(
      <SkillTreeTabBar
        activeSkills={[]}
        selectedIndex={0}
        onChange={vi.fn()}
        iconUrls={iconUrls}
      />
    )
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull()
  })

  it('renders no img when iconUrls does not contain the assigned skill', () => {
    const iconUrls = new Map<string, string>()
    render(
      <SkillTreeTabBar
        activeSkills={[mockActiveSkill]}
        selectedIndex={0}
        onChange={vi.fn()}
        iconUrls={iconUrls}
      />
    )
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull()
  })
})
