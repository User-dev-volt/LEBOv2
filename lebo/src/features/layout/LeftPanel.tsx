import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { saveBuild } from '../build-manager/buildPersistence'
import { SavedBuildsList } from '../build-manager/SavedBuildsList'
import { BuildImportInput } from '../build-manager/BuildImportInput'
import { PanelCollapseToggle } from './PanelCollapseToggle'
import { ClassMasterySelector } from '../skill-tree/ClassMasterySelector'
import { ContextPanel } from '../context-panel/ContextPanel'

export function LeftPanel() {
  const isCollapsed = useAppStore((s) => s.activePanel.left === 'collapsed')
  const setPanelState = useAppStore((s) => s.setPanelState)
  const activeBuild = useBuildStore((s) => s.activeBuild)

  async function handleSave() {
    if (!activeBuild) return
    await saveBuild(activeBuild)
  }

  return (
    <aside
      className="relative shrink-0 flex flex-col border-r overflow-hidden transition-[width] duration-200"
      style={{
        width: isCollapsed ? '48px' : '260px',
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-bg-elevated)',
      }}
      aria-label="Left panel"
    >
      <PanelCollapseToggle
        side="left"
        isCollapsed={isCollapsed}
        onToggle={() => setPanelState('left', isCollapsed ? 'expanded' : 'collapsed')}
      />

      {isCollapsed ? (
        <div className="flex flex-col items-center pt-3 gap-3 px-2">
          <span
            className="text-xs"
            title="Builds"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ☰
          </span>
        </div>
      ) : (
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          <BuildImportInput />

          <ClassMasterySelector />

          {activeBuild && (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-sm font-medium rounded"
              style={{
                backgroundColor: activeBuild.isPersisted
                  ? 'var(--color-bg-elevated)'
                  : 'var(--color-accent-gold)',
                color: activeBuild.isPersisted
                  ? 'var(--color-text-secondary)'
                  : 'var(--color-bg-base)',
                border: '1px solid transparent',
              }}
              onClick={handleSave}
            >
              {activeBuild.isPersisted ? 'Saved' : 'Save Build'}
            </button>
          )}

          <SavedBuildsList />

          {activeBuild && <ContextPanel />}
        </div>
      )}
    </aside>
  )
}
