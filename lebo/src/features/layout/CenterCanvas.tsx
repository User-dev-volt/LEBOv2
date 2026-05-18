import { SkillTreeView } from '../skill-tree/SkillTreeView'
import { DataStalenessBar } from '../game-data/DataStalenessBar'

export function CenterCanvas() {
  return (
    <div className="flex flex-col flex-1 min-w-0 bg-bg-base overflow-hidden">
      <DataStalenessBar />
      <div className="flex-1 min-h-0">
        <SkillTreeView />
      </div>
    </div>
  )
}
