import { SkillInput } from '../../context-panel/SkillInput'
import { SKILL_SLOTS } from '../../context-panel/skillData'

export function SkillTab() {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Active Skills
          </h2>
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {SKILL_SLOTS.length} slots
          </span>
        </div>
        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-bg-elevated)' }}
        >
          <SkillInput />
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Assign skills to slots to include them in optimization context. Use the Skill Trees tab to allocate specialization nodes.
        </p>
      </div>
    </div>
  )
}
