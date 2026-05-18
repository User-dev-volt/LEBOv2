import { useState, useEffect, useRef } from 'react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { MAX_SKILL_LEVEL } from '../../shared/utils/budgetCalculator'

interface SkillLevelInputProps {
  slotId: string
}

export function SkillLevelInput({ slotId }: SkillLevelInputProps) {
  const storedLevel = useBuildStore(
    (s) => s.activeBuild !== null ? (s.activeBuild.activeSkillLevels[slotId] ?? 1) : null
  )
  const setSkillLevel = useBuildStore((s) => s.setSkillLevel)

  const [inputValue, setInputValue] = useState(String(storedLevel ?? 1))
  const [isFocused, setIsFocused] = useState(false)
  const justCommittedRef = useRef(false)

  useEffect(() => {
    if (!isFocused && storedLevel !== null) {
      setInputValue(String(storedLevel))
    }
  }, [storedLevel, isFocused])

  if (storedLevel === null) return null

  function commitLevelChange() {
    const raw = parseInt(inputValue, 10)
    const clamped = Math.max(1, Math.min(MAX_SKILL_LEVEL, isNaN(raw) ? 1 : raw))
    setSkillLevel(slotId, clamped)
    setInputValue(String(clamped))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      justCommittedRef.current = true
      commitLevelChange()
    }
    if (e.key === 'Escape') {
      setInputValue(String(storedLevel))
      e.currentTarget.blur()
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Skill Lv.</span>
      <input
        type="number"
        min={1}
        max={MAX_SKILL_LEVEL}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          if (!justCommittedRef.current) commitLevelChange()
          justCommittedRef.current = false
          setIsFocused(false)
        }}
        onKeyDown={handleKeyDown}
        aria-label="Skill level"
        style={{
          width: 48,
          height: 28,
          padding: '0 6px',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-bg-elevated)',
          borderRadius: 4,
          color: 'var(--color-text-primary)',
          fontSize: 13,
          outline: isFocused ? '2px solid var(--color-accent-gold)' : 'none',
          outlineOffset: 2,
        }}
      />
    </div>
  )
}
