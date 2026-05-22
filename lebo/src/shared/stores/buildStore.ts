import { create } from 'zustand'
import type { BuildState, BuildMeta, ApplyNodeResult, GearItemV2, ActiveSkill, IdolItem, IdolGridState, PlacedIdol } from '../types/build'
import type { FineTuneWeights } from '../types/optimization'
import type { SkillEntry } from '../types/gameData'
import type { TreeData } from '../types/treeData'
import { calculatePassivePoints, calculateSkillPoints, calculateWeaverPoints } from '../utils/budgetCalculator'

const MAX_UNDO_STACK = 10

export interface BuildStore {
  activeBuild: BuildState | null
  savedBuilds: BuildMeta[]
  isImporting: boolean
  selectedClassId: string | null
  selectedMasteryId: string | null
  undoStack: BuildState[]
  setActiveBuild: (build: BuildState | null) => void
  setSavedBuilds: (builds: BuildMeta[]) => void
  setIsImporting: (importing: boolean) => void
  setSelectedClass: (classId: string | null) => void
  setSelectedMastery: (masteryId: string | null) => void
  createBuild: (masteryName: string) => void
  setCharacterLevel: (level: number) => void
  setSkillLevel: (slotId: string, level: number) => void
  setBudgetEnforced: (v: boolean) => void
  setActiveBuildPersisted: () => void
  clearActiveBuild: () => void
  applyNodeChange: (
    nodeId: string,
    delta: number,
    treeData: TreeData
  ) => ApplyNodeResult
  applySkillNodeChange: (
    slotId: string,
    nodeId: string,
    delta: number,
    treeData: TreeData
  ) => ApplyNodeResult
  assignSkillToSlot: (slotId: string, skill: Pick<SkillEntry, 'skillId' | 'skillName'>) => void
  applyWeaverNodeChange: (
    nodeId: string,
    delta: number,
    treeData: TreeData
  ) => ApplyNodeResult
  resetActiveTree: (treeType: 'passive' | 'skill' | 'weaver', slotId?: string) => void
  undoNodeChange: () => void
  updateContextGear: (gear: GearItemV2[]) => void
  updateContextSkills: (skills: ActiveSkill[]) => void
  updateContextIdols: (idols: IdolItem[]) => void
  placeIdol: (placed: PlacedIdol) => void
  clearIdolSlot: (idolId: string) => void
  resetIdolGrid: () => void
  setActiveBuildSliderPosition: (pos: number) => void
  setActiveBuildFineTuneWeights: (weights: FineTuneWeights | null) => void
}

export const selectAvailablePassivePoints = (s: BuildStore): number =>
  calculatePassivePoints(s.activeBuild?.characterLevel ?? 1)

export const useBuildStore = create<BuildStore>()((set, get) => ({
  activeBuild: null,
  savedBuilds: [],
  isImporting: false,
  selectedClassId: null,
  selectedMasteryId: null,
  undoStack: [],
  setActiveBuild: (build) => set({ activeBuild: build }),
  setSavedBuilds: (builds) => set({ savedBuilds: builds }),
  setIsImporting: (importing) => set({ isImporting: importing }),
  setSelectedClass: (classId) => set({ selectedClassId: classId, selectedMasteryId: null, activeBuild: null, undoStack: [] }),
  setSelectedMastery: (masteryId) => set({ selectedMasteryId: masteryId }),
  setActiveBuildPersisted: () =>
    set((s) => s.activeBuild ? { activeBuild: { ...s.activeBuild, isPersisted: true } } : {}),
  clearActiveBuild: () =>
    set({ activeBuild: null, selectedClassId: null, selectedMasteryId: null, undoStack: [] }),
  createBuild: (masteryName) => {
    const { selectedClassId, selectedMasteryId, activeBuild } = get()
    if (!selectedClassId || !selectedMasteryId) return
    if (activeBuild?.classId === selectedClassId && activeBuild?.masteryId === selectedMasteryId) return
    const now = new Date().toISOString()
    set({
      activeBuild: {
        schemaVersion: 2,
        sliderPosition: 50,
        fineTuneWeights: null,
        id: crypto.randomUUID(),
        name: masteryName,
        classId: selectedClassId,
        masteryId: selectedMasteryId,
        characterLevel: 1,
        budgetEnforced: false,
        nodeAllocations: {},
        skillNodeAllocations: {},
        activeSkillLevels: {},
        weaverAllocations: {},
        contextData: { gear: [], skills: [], idols: [] },
        idolGrid: [],
        blessings: {},
        activeConditions: [],
        isPersisted: false,
        createdAt: now,
        updatedAt: now,
      },
      undoStack: [],
    })
  },

  setCharacterLevel: (level) =>
    set((s) =>
      s.activeBuild
        ? { activeBuild: { ...s.activeBuild, characterLevel: level, isPersisted: false, updatedAt: new Date().toISOString() } }
        : {}
    ),

  setSkillLevel: (slotId, level) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              activeSkillLevels: { ...s.activeBuild.activeSkillLevels, [slotId]: level },
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  setBudgetEnforced: (v) =>
    set((s) =>
      s.activeBuild
        ? { activeBuild: { ...s.activeBuild, budgetEnforced: v, isPersisted: false, updatedAt: new Date().toISOString() } }
        : {}
    ),

  applyNodeChange: (nodeId, delta, treeData) => {
    const state = get()
    let activeBuild = state.activeBuild

    if (!activeBuild) {
      if (!state.selectedClassId || !state.selectedMasteryId) {
        return { success: false, error: 'No class/mastery selected' }
      }
      const now = new Date().toISOString()
      activeBuild = {
        schemaVersion: 2,
        sliderPosition: 50,
        fineTuneWeights: null,
        id: crypto.randomUUID(),
        name: state.selectedMasteryId,
        classId: state.selectedClassId,
        masteryId: state.selectedMasteryId,
        characterLevel: 1,
        budgetEnforced: false,
        nodeAllocations: {},
        skillNodeAllocations: {},
        activeSkillLevels: {},
        weaverAllocations: {},
        contextData: { gear: [], skills: [], idols: [] },
        isPersisted: false,
        createdAt: now,
        updatedAt: now,
      }
    }

    const nodeMap = new Map(treeData.nodes.map((n) => [n.id, n]))
    const node = nodeMap.get(nodeId)
    if (!node) return { success: false }

    const current = activeBuild.nodeAllocations[nodeId] ?? 0
    const newPoints = Math.max(0, Math.min(current + delta, node.maxPoints))

    if (newPoints === current) {
      return { success: false }
    }

    if (delta > 0) {
      const prerequisites = treeData.edges.filter((e) => e.toId === nodeId).map((e) => e.fromId)
      const prereqsMet = prerequisites.every(
        (prereqId) => (activeBuild!.nodeAllocations[prereqId] ?? 0) > 0
      )
      if (!prereqsMet) {
        return { success: false, error: 'Prerequisite not met' }
      }
      if (activeBuild.budgetEnforced) {
        const available = calculatePassivePoints(activeBuild.characterLevel)
        const allocated = Object.values(activeBuild.nodeAllocations).reduce((sum, v) => sum + v, 0)
        if (available - allocated <= 0) {
          return { success: false }
        }
      }
    }

    if (delta < 0 && newPoints === 0) {
      const dependents = treeData.edges
        .filter((e) => e.fromId === nodeId)
        .map((e) => e.toId)
        .filter((depId) => (activeBuild!.nodeAllocations[depId] ?? 0) > 0)
      if (dependents.length > 0) {
        return {
          success: false,
          error: `Cannot remove — ${dependents.length} node(s) depend on this`,
          blockedByDependents: dependents,
        }
      }
    }

    const newNodeAllocations = { ...activeBuild.nodeAllocations }
    if (newPoints === 0) {
      delete newNodeAllocations[nodeId]
    } else {
      newNodeAllocations[nodeId] = newPoints
    }

    const newActiveBuild: BuildState = {
      ...activeBuild,
      nodeAllocations: newNodeAllocations,
      updatedAt: new Date().toISOString(),
    }

    const newUndoStack = [...state.undoStack, activeBuild].slice(-MAX_UNDO_STACK)
    set({ activeBuild: newActiveBuild, undoStack: newUndoStack })
    return { success: true }
  },

  applyWeaverNodeChange: (nodeId, delta, treeData) => {
    const state = get()
    const activeBuild = state.activeBuild
    if (!activeBuild) return { success: false, error: 'No active build' }

    const nodeMap = new Map(treeData.nodes.map((n) => [n.id, n]))
    const node = nodeMap.get(nodeId)
    if (!node) return { success: false }

    const current = activeBuild.weaverAllocations[nodeId] ?? 0
    const newPoints = Math.max(0, Math.min(current + delta, node.maxPoints))

    if (newPoints === current) return { success: false }

    if (delta > 0) {
      const prerequisites = treeData.edges.filter((e) => e.toId === nodeId).map((e) => e.fromId)
      const prereqsMet = prerequisites.every(
        (prereqId) => (activeBuild.weaverAllocations[prereqId] ?? 0) > 0
      )
      if (!prereqsMet) return { success: false, error: 'Prerequisite not met' }
      if (activeBuild.budgetEnforced) {
        const available = calculateWeaverPoints(activeBuild.characterLevel)
        const allocated = Object.values(activeBuild.weaverAllocations).reduce((sum, v) => sum + v, 0)
        if (available - allocated <= 0) return { success: false }
      }
    }

    if (delta < 0 && newPoints === 0) {
      const dependents = treeData.edges
        .filter((e) => e.fromId === nodeId)
        .map((e) => e.toId)
        .filter((depId) => (activeBuild.weaverAllocations[depId] ?? 0) > 0)
      if (dependents.length > 0) {
        return {
          success: false,
          error: `Cannot remove — ${dependents.length} node(s) depend on this`,
          blockedByDependents: dependents,
        }
      }
    }

    const newWeaverAllocations = { ...activeBuild.weaverAllocations }
    if (newPoints === 0) {
      delete newWeaverAllocations[nodeId]
    } else {
      newWeaverAllocations[nodeId] = newPoints
    }

    const newActiveBuild: BuildState = {
      ...activeBuild,
      weaverAllocations: newWeaverAllocations,
      isPersisted: false,
      updatedAt: new Date().toISOString(),
    }

    const newUndoStack = [...state.undoStack, activeBuild].slice(-MAX_UNDO_STACK)
    set({ activeBuild: newActiveBuild, undoStack: newUndoStack })
    return { success: true }
  },

  resetActiveTree: (treeType, slotId) => {
    const { activeBuild, undoStack } = get()
    if (!activeBuild) return
    if (treeType === 'passive') {
      if (Object.keys(activeBuild.nodeAllocations).length === 0) return
      set({
        activeBuild: {
          ...activeBuild,
          nodeAllocations: {},
          isPersisted: false,
          updatedAt: new Date().toISOString(),
        },
        undoStack: [...undoStack, activeBuild].slice(-MAX_UNDO_STACK),
      })
    } else if (treeType === 'skill' && slotId) {
      if (Object.keys(activeBuild.skillNodeAllocations[slotId] ?? {}).length === 0) return
      set({
        activeBuild: {
          ...activeBuild,
          skillNodeAllocations: { ...activeBuild.skillNodeAllocations, [slotId]: {} },
          isPersisted: false,
          updatedAt: new Date().toISOString(),
        },
        undoStack: [...undoStack, activeBuild].slice(-MAX_UNDO_STACK),
      })
    } else if (treeType === 'weaver') {
      if (Object.keys(activeBuild.weaverAllocations).length === 0) return
      set({
        activeBuild: {
          ...activeBuild,
          weaverAllocations: {},
          isPersisted: false,
          updatedAt: new Date().toISOString(),
        },
        undoStack: [...undoStack, activeBuild].slice(-MAX_UNDO_STACK),
      })
    }
  },

  undoNodeChange: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    set({ activeBuild: previous, undoStack: undoStack.slice(0, -1) })
  },

  assignSkillToSlot: (slotId, skill) => {
    set((s) => {
      if (!s.activeBuild) return {}
      const existingSkill = s.activeBuild.contextData.skills.find((sk) => sk.slotId === slotId)
      const skillChanged = existingSkill?.skillId !== skill.skillId
      const updatedSkills = [
        ...s.activeBuild.contextData.skills.filter((sk) => sk.slotId !== slotId),
        { slotId, skillId: skill.skillId, skillName: skill.skillName },
      ]
      const updatedSkillNodeAllocations = skillChanged
        ? { ...s.activeBuild.skillNodeAllocations, [slotId]: {} }
        : s.activeBuild.skillNodeAllocations
      return {
        activeBuild: {
          ...s.activeBuild,
          contextData: { ...s.activeBuild.contextData, skills: updatedSkills },
          skillNodeAllocations: updatedSkillNodeAllocations,
          isPersisted: false,
          updatedAt: new Date().toISOString(),
        },
      }
    })
  },

  applySkillNodeChange: (slotId, nodeId, delta, treeData) => {
    const state = get()
    const activeBuild = state.activeBuild
    if (!activeBuild) return { success: false, error: 'No active build' }

    const nodeMap = new Map(treeData.nodes.map((n) => [n.id, n]))
    const node = nodeMap.get(nodeId)
    if (!node) return { success: false }

    const slotAllocations = activeBuild.skillNodeAllocations[slotId] ?? {}
    const current = slotAllocations[nodeId] ?? 0
    const newPoints = Math.max(0, Math.min(current + delta, node.maxPoints))

    if (newPoints === current) return { success: false }

    if (delta > 0) {
      const prerequisites = treeData.edges.filter((e) => e.toId === nodeId).map((e) => e.fromId)
      const prereqsMet = prerequisites.every((prereqId) => (slotAllocations[prereqId] ?? 0) > 0)
      if (!prereqsMet) return { success: false, error: 'Prerequisite not met' }
      if (activeBuild.budgetEnforced) {
        const skillBudget = calculateSkillPoints(activeBuild.activeSkillLevels[slotId] ?? 1)
        const allocatedSkillPoints = Object.values(slotAllocations).reduce((sum, v) => sum + v, 0)
        if (skillBudget - allocatedSkillPoints <= 0) {
          return { success: false }
        }
      }
    }

    if (delta < 0 && newPoints === 0) {
      const dependents = treeData.edges
        .filter((e) => e.fromId === nodeId)
        .map((e) => e.toId)
        .filter((depId) => (slotAllocations[depId] ?? 0) > 0)
      if (dependents.length > 0) {
        return {
          success: false,
          error: `Cannot remove — ${dependents.length} node(s) depend on this`,
          blockedByDependents: dependents,
        }
      }
    }

    const newSlotAllocations = { ...slotAllocations }
    if (newPoints === 0) {
      delete newSlotAllocations[nodeId]
    } else {
      newSlotAllocations[nodeId] = newPoints
    }

    const newActiveBuild: BuildState = {
      ...activeBuild,
      skillNodeAllocations: { ...activeBuild.skillNodeAllocations, [slotId]: newSlotAllocations },
      isPersisted: false,
      updatedAt: new Date().toISOString(),
    }

    const newUndoStack = [...state.undoStack, activeBuild].slice(-MAX_UNDO_STACK)
    set({ activeBuild: newActiveBuild, undoStack: newUndoStack })
    return { success: true }
  },

  updateContextGear: (gear) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              contextData: { ...s.activeBuild.contextData, gear },
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  updateContextSkills: (skills) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              contextData: { ...s.activeBuild.contextData, skills },
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  updateContextIdols: (idols) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              contextData: { ...s.activeBuild.contextData, idols },
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  placeIdol: (placed) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              idolGrid: [...(s.activeBuild.idolGrid ?? []), placed],
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  clearIdolSlot: (idolId) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              idolGrid: (s.activeBuild.idolGrid ?? []).filter((p) => p.id !== idolId),
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  resetIdolGrid: () =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              idolGrid: [],
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  setActiveBuildSliderPosition: (pos) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              sliderPosition: Math.max(0, Math.min(100, pos)),
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),

  setActiveBuildFineTuneWeights: (weights) =>
    set((s) =>
      s.activeBuild
        ? {
            activeBuild: {
              ...s.activeBuild,
              fineTuneWeights: weights,
              isPersisted: false,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}
    ),
}))
