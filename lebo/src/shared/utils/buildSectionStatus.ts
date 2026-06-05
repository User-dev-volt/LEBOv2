import type { CenterTab } from '../stores/appStore'
import type { BuildState } from '../types/build'

export interface SectionStatus {
  // Fill-count display string (FR-21 format, e.g. "8/11", "3 pts").
  count: string
  // Count-is-maxed visual signal (existing left-panel cue) — separate from the gate threshold.
  full: boolean
  // FR-21 completeness-gate threshold met → renders the gold checkmark.
  // Single source of truth: Epic 6's CompletenessGate (FR-22) must reuse these same predicates.
  done: boolean
}

function passivePoints(build: BuildState): number {
  return Object.values(build.nodeAllocations).reduce((sum, v) => sum + v, 0)
}

function weaverPoints(build: BuildState): number {
  return Object.values(build.weaverAllocations).reduce((sum, v) => sum + v, 0)
}

function filledGear(build: BuildState): number {
  return (build.contextData.gear ?? []).filter((g) => (g.itemName ?? '').trim() !== '').length
}

function filledSkills(build: BuildState): number {
  return (build.contextData.skills ?? []).filter((s) => (s.skillName ?? '').trim() !== '').length
}

function placedIdols(build: BuildState): number {
  return (build.idolGrid ?? []).length
}

function filledBlessings(build: BuildState): number {
  return Object.values(build.blessings ?? {}).filter((v) => v !== null).length
}

export function getSectionStatus(build: BuildState | null): Record<CenterTab, SectionStatus> {
  if (!build) {
    return {
      tree: { count: '0 pts', full: false, done: false },
      weaver: { count: '0 pts', full: false, done: false },
      gear: { count: '0/11', full: false, done: false },
      skill: { count: '0/5', full: false, done: false },
      idol: { count: '0 placed', full: false, done: false },
      blessing: { count: '0/5', full: false, done: false },
    }
  }

  const pts = passivePoints(build)
  const weaver = weaverPoints(build)
  const gear = filledGear(build)
  const skills = filledSkills(build)
  const idols = placedIdols(build)
  const blessings = filledBlessings(build)

  return {
    tree: { count: `${pts} pts`, full: false, done: pts >= 1 },
    weaver: { count: `${weaver} pts`, full: false, done: weaver >= 1 },
    gear: { count: `${gear}/11`, full: gear === 11, done: gear === 11 },
    skill: { count: `${skills}/5`, full: skills === 5, done: skills >= 2 },
    idol: { count: `${idols} placed`, full: false, done: idols >= 1 },
    blessing: { count: `${blessings}/5`, full: blessings === 5, done: blessings >= 1 },
  }
}
