import { useAppStore, type CenterTab } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { SkillTreeView } from '../skill-tree/SkillTreeView'
import { GearTab } from './tabs/GearTab'
import { SkillTab } from './tabs/SkillTab'
import { IdolTab } from './tabs/IdolTab'
import { BlessingTab } from './tabs/BlessingTab'
import { DataStalenessBar } from '../game-data/DataStalenessBar'
import type { BuildState } from '../../shared/types/build'

interface TabDef {
  id: CenterTab
  label: string
  getBadge: (build: BuildState | null) => string
  dividerBefore?: boolean
}

const TABS: TabDef[] = [
  {
    id: 'tree',
    label: 'Skill Trees',
    getBadge: (b) => {
      if (!b) return '0'
      return String(Object.values(b.nodeAllocations).reduce((s, v) => s + v, 0))
    },
  },
  {
    id: 'gear',
    label: 'Gear',
    dividerBefore: true,
    getBadge: (b) => {
      if (!b) return '0/11'
      const filled = (b.contextData.gear ?? []).filter((g) => g.itemName.trim() !== '').length
      return `${filled}/11`
    },
  },
  {
    id: 'skill',
    label: 'Skills',
    getBadge: (b) => {
      if (!b) return '0/5'
      const filled = (b.contextData.skills ?? []).filter((s) => s.skillName.trim() !== '').length
      return `${filled}/5`
    },
  },
  {
    id: 'idol',
    label: 'Idols',
    getBadge: (b) => {
      if (!b) return '0'
      return String((b.idolGrid ?? []).length)
    },
  },
  {
    id: 'blessing',
    label: 'Blessings',
    getBadge: (b) => {
      if (!b) return '0/5'
      const filled = Object.values(b.blessings ?? {}).filter((v) => v !== null).length
      return `${filled}/5`
    },
  },
]

export function CenterCanvas() {
  const centerTab = useAppStore((s) => s.centerTab)
  const setCenterTab = useAppStore((s) => s.setCenterTab)
  const activeBuild = useBuildStore((s) => s.activeBuild)

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Tab bar */}
      <div
        className="flex items-center shrink-0 px-2 gap-0.5"
        style={{
          height: '40px',
          backgroundColor: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-bg-elevated)',
        }}
      >
        {TABS.map((tab) => {
          const isActive = centerTab === tab.id
          const badge = tab.getBadge(activeBuild)
          return (
            <div key={tab.id} className="flex items-center">
              {tab.dividerBefore && (
                <div
                  className="mx-1"
                  style={{ width: 1, height: 18, backgroundColor: 'var(--color-bg-elevated)' }}
                />
              )}
              <button
                type="button"
                onClick={() => setCenterTab(tab.id)}
                className="flex items-center gap-1.5 px-3 rounded text-xs font-medium"
                style={{
                  height: '30px',
                  color: isActive ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                  transition: 'background-color 120ms, color 120ms',
                }}
              >
                <span>{tab.label}</span>
                <span
                  className="px-1 rounded-full text-[9px] font-mono"
                  style={{
                    backgroundColor: isActive ? 'rgba(0,0,0,0.3)' : 'var(--color-bg-base)',
                    color: isActive ? 'var(--color-accent-gold)' : 'var(--color-text-muted)',
                  }}
                >
                  {badge}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <DataStalenessBar />

      {/* Tab content — non-tree tabs scroll; tree uses full-bleed canvas */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div style={{ display: centerTab === 'tree' ? 'block' : 'none', height: '100%' }}>
          <SkillTreeView />
        </div>
        {centerTab === 'gear' && <GearTab />}
        {centerTab === 'skill' && <SkillTab />}
        {centerTab === 'idol' && <IdolTab />}
        {centerTab === 'blessing' && <BlessingTab />}
      </div>
    </div>
  )
}
