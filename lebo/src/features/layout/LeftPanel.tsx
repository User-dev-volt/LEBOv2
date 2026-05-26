import { useAppStore, type CenterTab } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { saveBuild } from '../build-manager/buildPersistence'
import { SavedBuildsList } from '../build-manager/SavedBuildsList'
import { BuildImportInput } from '../build-manager/BuildImportInput'
import { PanelCollapseToggle } from './PanelCollapseToggle'
import { ClassMasterySelector } from '../skill-tree/ClassMasterySelector'

interface NavRow {
  id: CenterTab
  label: string
  getCount: (b: ReturnType<typeof useBuildStore.getState>['activeBuild']) => string
  full?: (b: ReturnType<typeof useBuildStore.getState>['activeBuild']) => boolean
}

const NAV_ROWS: NavRow[] = [
  {
    id: 'tree',
    label: 'Skill Trees',
    getCount: (b) => {
      if (!b) return '0 pts'
      const pts = Object.values(b.nodeAllocations).reduce((s, v) => s + v, 0)
      return `${pts} pts`
    },
  },
  {
    id: 'gear',
    label: 'Gear',
    getCount: (b) => {
      if (!b) return '0/11'
      const filled = (b.contextData.gear ?? []).filter((g) => g.itemName.trim() !== '').length
      return `${filled}/11`
    },
    full: (b) => {
      if (!b) return false
      return (b.contextData.gear ?? []).filter((g) => g.itemName.trim() !== '').length === 11
    },
  },
  {
    id: 'skill',
    label: 'Active Skills',
    getCount: (b) => {
      if (!b) return '0/5'
      const filled = (b.contextData.skills ?? []).filter((s) => s.skillName.trim() !== '').length
      return `${filled}/5`
    },
    full: (b) => {
      if (!b) return false
      return (b.contextData.skills ?? []).filter((s) => s.skillName.trim() !== '').length === 5
    },
  },
  {
    id: 'idol',
    label: 'Idols',
    getCount: (b) => {
      if (!b) return '0 placed'
      return `${(b.idolGrid ?? []).length} placed`
    },
  },
  {
    id: 'blessing',
    label: 'Blessings',
    getCount: (b) => {
      if (!b) return '0/5'
      const filled = Object.values(b.blessings ?? {}).filter((v) => v !== null).length
      return `${filled}/5`
    },
    full: (b) => {
      if (!b) return false
      return Object.values(b.blessings ?? {}).filter((v) => v !== null).length === 5
    },
  },
]

export function LeftPanel() {
  const isCollapsed = useAppStore((s) => s.activePanel.left === 'collapsed')
  const setPanelState = useAppStore((s) => s.setPanelState)
  const centerTab = useAppStore((s) => s.centerTab)
  const setCenterTab = useAppStore((s) => s.setCenterTab)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const selectedClassId = useBuildStore((s) => s.selectedClassId)
  const gameData = useGameDataStore((s) => s.gameData)

  const selectedClass = selectedClassId && gameData ? gameData.classes[selectedClassId] : null

  async function handleSave() {
    if (!activeBuild) return
    await saveBuild(activeBuild)
  }

  if (isCollapsed) {
    return (
      <aside
        className="relative shrink-0 flex flex-col border-r overflow-hidden"
        style={{
          width: '48px',
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'var(--color-bg-elevated)',
        }}
        aria-label="Left panel"
      >
        <PanelCollapseToggle
          side="left"
          isCollapsed={isCollapsed}
          onToggle={() => setPanelState('left', 'expanded')}
        />
        <div className="flex flex-col items-center pt-10 gap-1.5 px-1">
          {NAV_ROWS.map((row) => {
            const isActive = centerTab === row.id
            return (
              <button
                key={row.id}
                type="button"
                title={row.label}
                onClick={() => setCenterTab(row.id)}
                className="w-9 h-9 flex items-center justify-center rounded text-xs font-mono"
                style={{
                  color: isActive ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                }}
              >
                {row.id === 'tree' ? '⬡' : row.id === 'gear' ? '⚔' : row.id === 'skill' ? '✦' : row.id === 'idol' ? '◈' : '✴'}
              </button>
            )
          })}
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative shrink-0 flex flex-col border-r overflow-hidden"
      style={{
        width: '272px',
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-bg-elevated)',
      }}
      aria-label="Left panel"
    >
      <PanelCollapseToggle
        side="left"
        isCollapsed={isCollapsed}
        onToggle={() => setPanelState('left', 'collapsed')}
      />

      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
        {/* Active build card */}
        {activeBuild && selectedClass && (
          <div className="mb-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Active Build
            </p>
            <div
              className="flex items-center gap-2.5 px-2.5 py-2 rounded"
              style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center rounded text-xs font-mono shrink-0"
                style={{
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-accent-gold-dim)',
                  color: 'var(--color-accent-gold)',
                }}
              >
                {selectedClass.className.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {activeBuild.name}
                </p>
                <p className="text-[10px] uppercase tracking-wide truncate" style={{ color: 'var(--color-accent-gold)' }}>
                  {selectedClass.className} · {activeBuild.masteryId}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Class / Mastery selectors */}
        <ClassMasterySelector />

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)' }} />

        {/* Build sections navigator */}
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Build Sections
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_ROWS.map((row) => {
              const isActive = centerTab === row.id
              const count = row.getCount(activeBuild)
              const isFull = row.full?.(activeBuild) ?? false
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setCenterTab(row.id)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded text-left w-full"
                  style={{
                    backgroundColor: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(201,168,76,0.25)' : 'transparent'}`,
                    transition: 'background-color 120ms',
                  }}
                >
                  <span className="flex-1 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {row.label}
                  </span>
                  <span
                    className="text-[10px] font-mono shrink-0"
                    style={{ color: isFull ? 'var(--color-data-positive)' : isActive ? 'var(--color-accent-gold-soft)' : 'var(--color-text-muted)' }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)' }} />

        {/* Save button */}
        {activeBuild && (
          <button
            type="button"
            className="w-full py-2 rounded text-sm font-semibold"
            style={{
              backgroundColor: activeBuild.isPersisted ? 'var(--color-bg-elevated)' : 'var(--color-accent-gold)',
              color: activeBuild.isPersisted ? 'var(--color-text-secondary)' : 'var(--color-bg-base)',
              border: '1px solid transparent',
            }}
            onClick={handleSave}
          >
            {activeBuild.isPersisted ? 'Saved' : 'Save Build'}
          </button>
        )}

        {/* Import */}
        <BuildImportInput />

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)' }} />

        {/* Saved builds */}
        <SavedBuildsList />
      </div>
    </aside>
  )
}
