import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import type { FineTuneWeights } from '../../shared/types/optimization'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore } from '../../shared/stores/buildStore'

export function FineTunePanel() {
  const sliderPosition = useOptimizationStore((s) => s.sliderPosition)
  const fineTuneWeights = useOptimizationStore((s) => s.fineTuneWeights)
  const setFineTuneWeights = useOptimizationStore((s) => s.setFineTuneWeights)
  const setActiveBuildFineTuneWeights = useBuildStore((s) => s.setActiveBuildFineTuneWeights)
  const reducedMotion = useReducedMotion()

  const derivedDamage = sliderPosition
  const derivedSurvivability = 100 - sliderPosition
  const derivedSpeed = 0

  const displayDamage = fineTuneWeights?.damage ?? derivedDamage
  const displaySurvivability = fineTuneWeights?.survivability ?? derivedSurvivability
  const displaySpeed = fineTuneWeights?.speed ?? derivedSpeed

  const isCustom = fineTuneWeights !== null

  const handleChange = (field: keyof FineTuneWeights, value: number) => {
    const current: FineTuneWeights = fineTuneWeights ?? {
      damage: derivedDamage,
      survivability: derivedSurvivability,
      speed: derivedSpeed,
    }
    const next = { ...current, [field]: value }
    setFineTuneWeights(next)
    setActiveBuildFineTuneWeights(next)
  }

  return (
    <Disclosure>
      {({ open }) => (
        <>
          <DisclosureButton
            aria-controls="fine-tune-panel"
            className="flex items-center gap-1.5 text-xs w-full text-left py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus:outline focus:outline-2 focus:outline-offset-2"
            style={{
              color: 'var(--color-text-secondary)',
              outlineColor: 'var(--color-accent-gold)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                fontSize: '8px',
                transition: reducedMotion ? 'none' : 'transform 0.15s ease-out',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </span>
            Fine Tune Weights{isCustom ? ' (Custom)' : ''}
          </DisclosureButton>

          <DisclosurePanel
            id="fine-tune-panel"
            transition
            className="overflow-hidden data-[closed]:opacity-0 motion-safe:transition-opacity motion-safe:data-[enter]:duration-200 motion-safe:data-[leave]:duration-150"
          >
            <div className="flex flex-col gap-3 pt-2">
              <SubSlider
                label="Damage Weight"
                value={displayDamage}
                onChange={(v) => handleChange('damage', v)}
              />
              <SubSlider
                label="Survivability Weight"
                value={displaySurvivability}
                onChange={(v) => handleChange('survivability', v)}
              />
              <SubSlider
                label="Speed Weight"
                value={displaySpeed}
                onChange={(v) => handleChange('speed', v)}
              />
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}

function SubSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        className="optimization-slider"
        min={0}
        max={100}
        step={1}
        value={value}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
