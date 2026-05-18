import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore } from '../../shared/stores/buildStore'

export function OptimizationSlider() {
  const sliderPosition = useOptimizationStore((s) => s.sliderPosition)
  const setSliderPosition = useOptimizationStore((s) => s.setSliderPosition)
  const setActiveBuildSliderPosition = useBuildStore((s) => s.setActiveBuildSliderPosition)

  const survivability = 100 - sliderPosition
  const damage = sliderPosition

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const newPos = Math.min(100, useOptimizationStore.getState().sliderPosition + 5)
      setSliderPosition(newPos)
      setActiveBuildSliderPosition(newPos)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      const newPos = Math.max(0, useOptimizationStore.getState().sliderPosition - 5)
      setSliderPosition(newPos)
      setActiveBuildSliderPosition(newPos)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Optimization Intent
      </p>

      <div className="relative flex flex-col gap-1">
        {/* Endpoint labels */}
        <div className="flex justify-between">
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Juggernaut
          </span>
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Glass Cannon
          </span>
        </div>

        {/* Slider with tooltip */}
        <div className="relative">
          {/* Thumb tooltip */}
          <div
            className="absolute text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
            style={{
              top: '100%',
              marginTop: '4px',
              left: `${sliderPosition}%`,
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {survivability}% Survivability / {damage}% Damage
          </div>

          <input
            type="range"
            className="optimization-slider"
            min={0}
            max={100}
            step={1}
            value={sliderPosition}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={sliderPosition}
            aria-label="Optimization intent"
            aria-valuetext={`${survivability}% Survivability / ${damage}% Damage`}
            onChange={(e) => {
              const val = Number(e.target.value)
              setSliderPosition(val)
              setActiveBuildSliderPosition(val)
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  )
}
