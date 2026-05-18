import { useState, useEffect, useRef } from 'react'
import { Field, Label, Switch } from '@headlessui/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { MAX_CHARACTER_LEVEL } from '../../shared/utils/budgetCalculator'

export function BudgetToggle() {
  const characterLevel = useBuildStore((s) => s.activeBuild?.characterLevel ?? 1)
  const budgetEnforced = useBuildStore((s) => s.activeBuild?.budgetEnforced ?? false)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const setCharacterLevel = useBuildStore((s) => s.setCharacterLevel)
  const setBudgetEnforced = useBuildStore((s) => s.setBudgetEnforced)

  const [inputValue, setInputValue] = useState(String(characterLevel))
  const [isFocused, setIsFocused] = useState(false)
  const justCommittedRef = useRef(false)

  // Sync local input string from store when level changes externally (build switch, undo)
  // and the input is not currently being edited.
  useEffect(() => {
    if (!isFocused) {
      setInputValue(String(characterLevel))
    }
  }, [characterLevel, isFocused])

  if (!activeBuild) return null

  function commitLevelChange() {
    const raw = parseInt(inputValue, 10)
    const clamped = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, isNaN(raw) ? 1 : raw))
    setCharacterLevel(clamped)
    setInputValue(String(clamped))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      justCommittedRef.current = true
      commitLevelChange()
    }
    if (e.key === 'Escape') { setInputValue(String(characterLevel)); e.currentTarget.blur() }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', fontSize: 13 }}>
        <span>Level</span>
        <input
          type="number"
          min={1}
          max={MAX_CHARACTER_LEVEL}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            if (!justCommittedRef.current) commitLevelChange()
            justCommittedRef.current = false
            setIsFocused(false)
          }}
          onKeyDown={handleKeyDown}
          aria-label="Character level"
          style={{
            width: 56,
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

      <Field style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Switch
          checked={budgetEnforced}
          onChange={setBudgetEnforced}
          aria-label="Enforce level budget"
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            backgroundColor: budgetEnforced ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)',
            border: '1px solid',
            borderColor: budgetEnforced ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)',
            cursor: 'pointer',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: 'var(--color-text-primary)',
              position: 'absolute',
              top: 2,
              left: budgetEnforced ? 18 : 2,
              transition: 'left 0.15s ease',
            }}
          />
        </Switch>
        <Label style={{ color: 'var(--color-text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          Enforce Level Budget
        </Label>
      </Field>
    </div>
  )
}
