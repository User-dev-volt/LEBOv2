import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import type { Texture } from 'pixi.js'
import type { GameNode } from '../../shared/types/gameData'
import type { ActiveSkill } from '../../shared/types/build'
import type { NodeChange } from '../../shared/types/optimization'
import type { HighlightedNodes, SkillTreeCanvasHandle } from './types'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore, selectAvailablePassivePoints } from '../../shared/stores/buildStore'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useAppStore } from '../../shared/stores/appStore'
import { buildTreeData, buildSkillTreeData } from './treeDataTransformer'
import { SkillTreeCanvas } from './SkillTreeCanvas'
import { EmptyTreeState } from './EmptyTreeState'
import { NodeTooltip } from './NodeTooltip'
import { SkillTreeTabBar } from './SkillTreeTabBar'
import { useSkillTree } from './useSkillTree'
import { SkillPickerGrid } from '../skill-picker/SkillPickerGrid'
import { TreeControls } from './TreeControls'
import { useIconTextures } from '../icon-pipeline/useIconTextures'
import { BudgetToggle } from './BudgetToggle'
import { UnspentCounter } from './UnspentCounter'
import { SkillLevelInput } from './SkillLevelInput'
import { calculateSkillPoints, calculateWeaverPoints } from '../../shared/utils/budgetCalculator'
import { WeaverTreePlaceholder } from '../weaver-tree/WeaverTreePlaceholder'

const DAMAGE_TYPE_TAGS = ['FIRE', 'COLD', 'LIGHTNING', 'VOID', 'POISON'] as const

function deriveSkillDamageType(nodes: GameNode[]): string | undefined {
  const tagCounts: Record<string, number> = {}
  for (const node of nodes) {
    for (const tag of node.tags) {
      if ((DAMAGE_TYPE_TAGS as readonly string[]).includes(tag)) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }
  }
  const entries = Object.entries(tagCounts)
  if (entries.length === 0) return undefined
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return entries[0][0]
}

const EMPTY_ALLOCATED: Record<string, number> = {}
const EMPTY_SKILL_ALLOC: Record<string, Record<string, number>> = {}
const EMPTY_SET = new Set<string>()
const EMPTY_HIGHLIGHTED: HighlightedNodes = {
  glowing: EMPTY_SET,
  dimmed: EMPTY_SET,
  previewRemoved: EMPTY_SET,
  previewAdded: EMPTY_SET,
  searchHighlighted: EMPTY_SET,
  searchDimmed: EMPTY_SET,
}
const EMPTY_SKILLS: ActiveSkill[] = []
const EMPTY_TEXTURES = new Map<string, Texture>()

type PickerState = {
  slotIndex: number
  anchorRect: DOMRect
  isPopover: boolean
}

function computePreviewAllocations(
  base: Record<string, number>,
  nodeChange: NodeChange
): Record<string, number> {
  const result = { ...base }
  if (nodeChange.fromNodeId) {
    delete result[nodeChange.fromNodeId]
  }
  const currentTo = result[nodeChange.toNodeId] ?? 0
  const newTo = Math.max(0, currentTo + nodeChange.pointsChange)
  if (newTo === 0) delete result[nodeChange.toNodeId]
  else result[nodeChange.toNodeId] = newTo
  return result
}

export function SkillTreeView() {
  const gameData = useGameDataStore((s) => s.gameData)
  const isLoading = useGameDataStore((s) => s.isLoading)
  const weaverTreeData = useGameDataStore((s) => s.weaverTreeData)
  const weaverGameNodes = useGameDataStore((s) => s.weaverGameNodes)
  const selectedClassId = useBuildStore((s) => s.selectedClassId)
  const selectedMasteryId = useBuildStore((s) => s.selectedMasteryId)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const undoNodeChange = useBuildStore((s) => s.undoNodeChange)
  const redoNodeChange = useBuildStore((s) => s.redoNodeChange)
  const canUndo = useBuildStore((s) => s.undoStack.length > 0)
  const canRedo = useBuildStore((s) => s.redoStack.length > 0)
  const assignSkillToSlot = useBuildStore((s) => s.assignSkillToSlot)
  const resetActiveTree = useBuildStore((s) => s.resetActiveTree)
  const applyWeaverNodeChange = useBuildStore((s) => s.applyWeaverNodeChange)
  const weaverAllocations = useBuildStore((s) => s.activeBuild?.weaverAllocations ?? EMPTY_ALLOCATED)
  const activeSkills = useBuildStore(
    (s) => s.activeBuild?.contextData.skills ?? EMPTY_SKILLS
  )
  const skillNodeAllocations = useBuildStore(
    (s) => s.activeBuild?.skillNodeAllocations ?? EMPTY_SKILL_ALLOC
  )
  const activeBuildId = useBuildStore((s) => s.activeBuild?.id ?? null)
  const budgetEnforced = useBuildStore((s) => s.activeBuild?.budgetEnforced ?? false)
  const availablePassivePoints = useBuildStore(selectAvailablePassivePoints)
  const highlightedNodeIds = useOptimizationStore((s) => s.highlightedNodeIds)
  const previewSuggestionRank = useOptimizationStore((s) => s.previewSuggestionRank)
  const suggestions = useOptimizationStore((s) => s.suggestions)
  const nodeEfficiencies = useOptimizationStore((s) => s.nodeEfficiencies)
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId)

  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [pickerState, setPickerState] = useState<PickerState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [weaverFlashNodeIds, setWeaverFlashNodeIds] = useState<string[] | null>(null)
  const [showOverlay, setShowOverlay] = useState(false)
  const emptySlotButtonRef = useRef<HTMLButtonElement>(null)

  // Canvas refs for imperative viewport control (fit, zoom)
  const passiveCanvasRef = useRef<SkillTreeCanvasHandle>(null)
  const skillCanvasRef = useRef<SkillTreeCanvasHandle>(null)
  const weaverCanvasRef = useRef<SkillTreeCanvasHandle>(null)

  useEffect(() => {
    setActiveTabIndex(0)
    setPickerState(null)
    setSelectedNodeId(null)
  }, [activeBuildId, setSelectedNodeId])

  useEffect(() => {
    if (activeTabIndex > 6) {
      setActiveTabIndex(0)
    }
  }, [activeTabIndex])

  // Auto-show when new efficiencies arrive; reset when cleared between runs
  useEffect(() => {
    if (nodeEfficiencies && nodeEfficiencies.length > 0) {
      setShowOverlay(true)
    } else {
      setShowOverlay(false)
    }
  }, [nodeEfficiencies])

  const classData = selectedClassId && gameData ? gameData.classes[selectedClassId] : null

  const skillIds = useMemo(() => classData?.skills.map((s) => s.skillId) ?? [], [classData])
  const iconTextures = useIconTextures(skillIds)

  const allGameNodes = useMemo<Record<string, GameNode>>(() => {
    if (!classData) return {}
    const nodes: Record<string, GameNode> = { ...classData.baseTree }
    if (selectedMasteryId) {
      const mastery = classData.masteries[selectedMasteryId]
      if (mastery) Object.assign(nodes, mastery.nodes)
    }
    return nodes
  }, [classData, selectedMasteryId])

  const baseAllocatedNodes = activeBuild?.nodeAllocations ?? EMPTY_ALLOCATED

  const previewSuggestion = useMemo(
    () => suggestions.find((s) => s.rank === previewSuggestionRank) ?? null,
    [suggestions, previewSuggestionRank]
  )

  const previewAllocatedNodes = useMemo(
    () =>
      previewSuggestion !== null
        ? computePreviewAllocations(baseAllocatedNodes, previewSuggestion.nodeChange)
        : null,
    [previewSuggestion, baseAllocatedNodes]
  )

  const nodeAllocations = previewAllocatedNodes ?? baseAllocatedNodes

  const highlightedNodes = useMemo<HighlightedNodes>(() => {
    // HighlightedNodeIds only has glowing/dimmed; spread EMPTY_HIGHLIGHTED first to fill all required fields
    const base: HighlightedNodes = { ...EMPTY_HIGHLIGHTED, ...(highlightedNodeIds ?? {}) }
    if (!previewSuggestion) {
      return { ...base, previewRemoved: EMPTY_SET, previewAdded: EMPTY_SET }
    }
    const previewRemoved = new Set<string>()
    const previewAdded = new Set<string>()
    if (previewSuggestion.nodeChange.fromNodeId) {
      previewRemoved.add(previewSuggestion.nodeChange.fromNodeId)
    }
    previewAdded.add(previewSuggestion.nodeChange.toNodeId)
    return { ...base, previewRemoved, previewAdded }
  }, [highlightedNodeIds, previewSuggestion])

  const treeData = useMemo(
    () =>
      classData && selectedMasteryId
        ? buildTreeData(classData, selectedMasteryId, nodeAllocations)
        : null,
    [classData, selectedMasteryId, nodeAllocations]
  )

  const safeTabIndex = activeTabIndex > 6 ? 0 : activeTabIndex
  const isPassiveTab = safeTabIndex === 0
  const isWeaverTab = safeTabIndex === 6

  const slotId = isPassiveTab || isWeaverTab ? null : `slot-${safeTabIndex - 1}`
  const activeSkill = slotId ? activeSkills.find((s) => s.slotId === slotId) ?? null : null
  const skillNodes = activeSkill ? classData?.skillTrees[activeSkill.skillId] : undefined

  const skillPrimaryDamageType = useMemo<string | undefined>(() => {
    if (!activeSkill || !classData) return undefined
    const nodes = Object.values(classData.skillTrees[activeSkill.skillId] ?? {})
    return deriveSkillDamageType(nodes)
  }, [activeSkill, classData])
  const slotAllocations = slotId ? (skillNodeAllocations[slotId] ?? EMPTY_ALLOCATED) : EMPTY_ALLOCATED
  const skillLevel = useBuildStore(
    (s) => slotId ? (s.activeBuild?.activeSkillLevels[slotId] ?? 1) : 1
  )

  // Moved before early returns so search memos (hooks) can reference it unconditionally
  const activeGameNodes = useMemo<Record<string, GameNode>>(
    () =>
      isPassiveTab
        ? allGameNodes
        : (activeSkill ? (classData?.skillTrees[activeSkill.skillId] ?? {}) : {}),
    [isPassiveTab, allGameNodes, activeSkill, classData]
  )

  const skillTreeData = useMemo(
    () => (skillNodes ? buildSkillTreeData(skillNodes, slotAllocations) : null),
    [skillNodes, slotAllocations]
  )

  const filteredSkills = useMemo(() => {
    if (!classData) return []
    const currentSlotId = pickerState ? `slot-${pickerState.slotIndex}` : null
    const assignedElsewhere = new Set(
      activeSkills.filter((s) => s.slotId !== currentSlotId).map((s) => s.skillId)
    )
    return classData.skills.filter(
      (s) =>
        (s.masteryId === null || s.masteryId === selectedMasteryId) &&
        !assignedElsewhere.has(s.skillId)
    )
  }, [classData, selectedMasteryId, activeSkills, pickerState])

  const activeTreeData = isPassiveTab ? treeData : skillTreeData

  const searchHighlighted = useMemo<Set<string>>(() => {
    if (!searchQuery || !activeTreeData) return EMPTY_SET
    const q = searchQuery.toLowerCase()
    return new Set(
      activeTreeData.nodes
        .filter((n) => {
          const gn = activeGameNodes[n.id]
          return (gn?.name ?? '').toLowerCase().includes(q) ||
            (gn?.effectDescription ?? '').toLowerCase().includes(q)
        })
        .map((n) => n.id)
    )
  }, [searchQuery, activeTreeData, activeGameNodes])

  const searchDimmed = useMemo<Set<string>>(() => {
    if (!searchQuery || !activeTreeData) return EMPTY_SET
    const q = searchQuery.toLowerCase()
    return new Set(
      activeTreeData.nodes
        .filter((n) => {
          const gn = activeGameNodes[n.id]
          return !(
            (gn?.name ?? '').toLowerCase().includes(q) ||
            (gn?.effectDescription ?? '').toLowerCase().includes(q)
          )
        })
        .map((n) => n.id)
    )
  }, [searchQuery, activeTreeData, activeGameNodes])

  const passiveHighlightedNodes = useMemo<HighlightedNodes>(
    () => ({ ...highlightedNodes, searchHighlighted, searchDimmed }),
    [highlightedNodes, searchHighlighted, searchDimmed]
  )

  const skillHighlightedNodes = useMemo<HighlightedNodes>(
    () => ({ ...EMPTY_HIGHLIGHTED, searchHighlighted, searchDimmed }),
    [searchHighlighted, searchDimmed]
  )

  const weaverSearchHighlighted = useMemo<Set<string>>(() => {
    if (!searchQuery || !weaverTreeData) return EMPTY_SET
    const q = searchQuery.toLowerCase()
    return new Set(
      weaverTreeData.nodes
        .filter((n) => {
          const gn = weaverGameNodes[n.id]
          return (gn?.name ?? '').toLowerCase().includes(q) ||
            (gn?.effectDescription ?? '').toLowerCase().includes(q)
        })
        .map((n) => n.id)
    )
  }, [searchQuery, weaverTreeData, weaverGameNodes])

  const weaverSearchDimmed = useMemo<Set<string>>(() => {
    if (!searchQuery || !weaverTreeData) return EMPTY_SET
    const q = searchQuery.toLowerCase()
    return new Set(
      weaverTreeData.nodes
        .filter((n) => {
          const gn = weaverGameNodes[n.id]
          return !(
            (gn?.name ?? '').toLowerCase().includes(q) ||
            (gn?.effectDescription ?? '').toLowerCase().includes(q)
          )
        })
        .map((n) => n.id)
    )
  }, [searchQuery, weaverTreeData, weaverGameNodes])

  const weaverHighlightedNodes = useMemo<HighlightedNodes>(
    () => ({ ...EMPTY_HIGHLIGHTED, searchHighlighted: weaverSearchHighlighted, searchDimmed: weaverSearchDimmed }),
    [weaverSearchHighlighted, weaverSearchDimmed]
  )

  const allocatedWeaverPoints = Object.values(weaverAllocations).reduce((sum, v) => sum + v, 0)

  const passiveInteraction = useSkillTree(treeData)
  const skillInteraction = useSkillTree(skillTreeData, slotId ?? undefined)
  const weaverInteraction = useSkillTree(isWeaverTab ? weaverTreeData : null)

  const {
    hoveredNodeId,
    mousePosition,
    nodeError,
    keyboardFocusedNodeId,
    keyboardPosition,
    flashNodeIds,
    handleNodeClick,
    handleNodeSelect,
    handleNodeHover,
    handleNodeContextMenu,
    handlePointerMove,
    handleKeyboardNavigate,
    handleTooltipEnter,
    handleTooltipLeave,
  } = isPassiveTab ? passiveInteraction : skillInteraction

  const handleTabChange = useCallback((index: number) => {
    setActiveTabIndex(index)
    setPickerState(null)
    setSearchQuery('')
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const handleReset = useCallback(() => {
    if (isPassiveTab) {
      resetActiveTree('passive')
      setSearchQuery('')
    } else if (slotId) {
      resetActiveTree('skill', slotId)
      setSearchQuery('')
    }
  }, [isPassiveTab, slotId, resetActiveTree])

  const { setNodeError: setWeaverNodeError } = weaverInteraction

  const handleWeaverNodeClick = useCallback((nodeId: string, button: 0 | 2) => {
    if (!weaverTreeData) return
    const delta: 1 | -1 = button === 2 ? -1 : 1
    const result = applyWeaverNodeChange(nodeId, delta, weaverTreeData)
    if (!result.success && result.error) {
      setWeaverNodeError({ nodeId, message: result.error })
      if (button === 2 && result.blockedByDependents && result.blockedByDependents.length > 0) {
        setWeaverFlashNodeIds([...result.blockedByDependents])
      } else {
        setWeaverFlashNodeIds([nodeId])
      }
    }
  }, [weaverTreeData, applyWeaverNodeChange, setWeaverNodeError])

  const handleSkillTabClick = useCallback(
    (slotIndex: number, el: HTMLButtonElement) => {
      const sid = `slot-${slotIndex}`
      const hasSkill = activeSkills.some((s) => s.slotId === sid)
      setPickerState({ slotIndex, anchorRect: el.getBoundingClientRect(), isPopover: hasSkill })
      setActiveTabIndex(slotIndex + 1)
    },
    [activeSkills]
  )

  const handleSkillSelect = useCallback(
    (skillId: string) => {
      if (!pickerState || !classData) return
      const skillEntry = classData.skills.find((s) => s.skillId === skillId)
      if (!skillEntry) return
      const sid = `slot-${pickerState.slotIndex}`
      assignSkillToSlot(sid, skillEntry)
      setPickerState(null)
    },
    [pickerState, classData, assignSkillToSlot]
  )

  const openPickerForCurrentSlot = useCallback(() => {
    if (emptySlotButtonRef.current) {
      const sid = `slot-${safeTabIndex - 1}`
      const hasSkill = activeSkills.some((s) => s.slotId === sid)
      setPickerState({
        slotIndex: safeTabIndex - 1,
        anchorRect: emptySlotButtonRef.current.getBoundingClientRect(),
        isPopover: hasSkill,
      })
    }
  }, [safeTabIndex, activeSkills])

  if (isWeaverTab) {
    const {
      hoveredNodeId: weaverHoveredNodeId,
      mousePosition: weaverMousePosition,
      nodeError: weaverNodeError,
      keyboardFocusedNodeId: weaverKeyboardFocusedNodeId,
      keyboardPosition: weaverKeyboardPosition,
      handleNodeSelect: handleWeaverNodeSelect,
      handleNodeHover: handleWeaverNodeHover,
      handleNodeContextMenu: handleWeaverNodeContextMenu,
      handlePointerMove: handleWeaverPointerMove,
      handleKeyboardNavigate: handleWeaverKeyboardNavigate,
      handleTooltipEnter: handleWeaverTooltipEnter,
      handleTooltipLeave: handleWeaverTooltipLeave,
    } = weaverInteraction

    const weaverHoveredGameNode = weaverHoveredNodeId ? weaverGameNodes[weaverHoveredNodeId] ?? null : null
    const weaverErrorGameNode = weaverNodeError ? weaverGameNodes[weaverNodeError.nodeId] ?? null : null
    const weaverKeyboardGameNode =
      !weaverHoveredNodeId && !weaverNodeError && weaverKeyboardFocusedNodeId
        ? weaverGameNodes[weaverKeyboardFocusedNodeId] ?? null
        : null

    const getWeaverPrereqNames = (node: GameNode | null) =>
      node ? node.prerequisiteNodeIds.map((id) => weaverGameNodes[id]?.name ?? id) : []

    const unspentWeaverPoints = calculateWeaverPoints(activeBuild?.characterLevel ?? 1) - allocatedWeaverPoints

    return (
      <div id="skill-tree-canvas" className="flex flex-col h-full">
        <SkillTreeTabBar
          activeSkills={activeSkills}
          selectedIndex={safeTabIndex}
          onChange={handleTabChange}
          onSkillTabClick={handleSkillTabClick}
        />

        {activeBuild && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', height: 36, borderBottom: '1px solid var(--color-bg-elevated)' }}>
            <BudgetToggle />
            <UnspentCounter count={unspentWeaverPoints} treeType="weaver" budgetEnforced={budgetEnforced} />
          </div>
        )}

        {weaverTreeData !== null && (
          <TreeControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onReset={() => { resetActiveTree('weaver'); setSearchQuery('') }}
            onFit={() => weaverCanvasRef.current?.fitToTree()}
            onUndo={undoNodeChange}
            onRedo={redoNodeChange}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        )}

        <div className="flex-1 min-h-0">
          {weaverTreeData !== null ? (
            <div className="relative h-full" onMouseLeave={() => handleWeaverNodeHover(null)}>
              <SkillTreeCanvas
                ref={weaverCanvasRef}
                treeData={weaverTreeData}
                treeLayout="weaver"
                nodeAllocations={weaverAllocations}
                highlightedNodes={weaverHighlightedNodes}
                iconTextures={EMPTY_TEXTURES}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleWeaverNodeClick}
                onNodeHover={handleWeaverNodeHover}
                onNodeSelect={handleWeaverNodeSelect}
                onNodeContextMenu={handleWeaverNodeContextMenu}
                onKeyboardNavigate={handleWeaverKeyboardNavigate}
                onPointerMove={handleWeaverPointerMove}
                flashNodeIds={weaverFlashNodeIds ?? undefined}
              />

              {weaverHoveredGameNode && !weaverNodeError && (
                <NodeTooltip
                  gameNode={weaverHoveredGameNode}
                  allocatedPoints={weaverAllocations[weaverHoveredNodeId!] ?? 0}
                  position={weaverMousePosition}
                  prerequisiteNames={getWeaverPrereqNames(weaverHoveredGameNode)}
                  onMouseEnter={handleWeaverTooltipEnter}
                  onMouseLeave={handleWeaverTooltipLeave}
                />
              )}

              {weaverNodeError && weaverErrorGameNode && (
                <NodeTooltip
                  gameNode={weaverErrorGameNode}
                  allocatedPoints={weaverAllocations[weaverNodeError.nodeId] ?? 0}
                  position={weaverMousePosition}
                  errorMessage={weaverNodeError.message}
                  prerequisiteNames={getWeaverPrereqNames(weaverErrorGameNode)}
                />
              )}

              {weaverKeyboardGameNode && (
                <NodeTooltip
                  gameNode={weaverKeyboardGameNode}
                  allocatedPoints={weaverAllocations[weaverKeyboardFocusedNodeId!] ?? 0}
                  position={weaverKeyboardPosition}
                  prerequisiteNames={getWeaverPrereqNames(weaverKeyboardGameNode)}
                />
              )}

            </div>
          ) : (
            <WeaverTreePlaceholder />
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <p className="text-sm">Loading game data…</p>
      </div>
    )
  }

  // Passive tab: needs full tree to be ready
  if (isPassiveTab && (!selectedClassId || !selectedMasteryId || !gameData || !classData || !treeData)) {
    return (
      <div id="skill-tree-canvas" className="flex flex-col h-full">
        <SkillTreeTabBar
          activeSkills={activeSkills}
          selectedIndex={safeTabIndex}
          onChange={handleTabChange}
          onSkillTabClick={handleSkillTabClick}
        />
        <div className="flex-1 min-h-0">
          <EmptyTreeState />
        </div>
      </div>
    )
  }

  // Skill tab: can show even without full passive tree
  if (!isPassiveTab && !isWeaverTab && (!selectedClassId || !selectedMasteryId || !gameData || !classData)) {
    return (
      <div id="skill-tree-canvas" className="flex flex-col h-full">
        <SkillTreeTabBar
          activeSkills={activeSkills}
          selectedIndex={safeTabIndex}
          onChange={handleTabChange}
          onSkillTabClick={handleSkillTabClick}
        />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Select a class to continue</p>
        </div>
      </div>
    )
  }

  const activeAllocations = isPassiveTab ? nodeAllocations : slotAllocations

  const allocatedPassivePoints = Object.values(baseAllocatedNodes).reduce((sum, v) => sum + v, 0)
  const unspentPassivePoints = availablePassivePoints - allocatedPassivePoints

  // FR-A27: suppress overlay when zero unspent passive points (nothing to reallocate)
  const effectiveNodeEfficiencies = unspentPassivePoints > 0 ? nodeEfficiencies : null

  const allocatedSkillPoints = Object.values(slotAllocations).reduce((sum, v) => sum + v, 0)
  const unspentSkillPoints = calculateSkillPoints(skillLevel) - allocatedSkillPoints

  const hoveredGameNode = hoveredNodeId ? activeGameNodes[hoveredNodeId] : null
  const errorGameNode = nodeError ? activeGameNodes[nodeError.nodeId] : null
  const keyboardGameNode =
    !hoveredNodeId && !nodeError && keyboardFocusedNodeId
      ? activeGameNodes[keyboardFocusedNodeId]
      : null

  function getPrerequisiteNames(gameNode: typeof hoveredGameNode): string[] {
    if (!gameNode || gameNode.prerequisiteNodeIds.length === 0) return []
    return gameNode.prerequisiteNodeIds.map((id) => activeGameNodes[id]?.name ?? id)
  }

  const isPickerFullPanel =
    !isPassiveTab &&
    !isWeaverTab &&
    pickerState !== null &&
    !pickerState.isPopover &&
    pickerState.slotIndex === safeTabIndex - 1

  const showControls = isPassiveTab
    ? treeData !== null
    : activeSkill !== null && skillTreeData !== null && !isPickerFullPanel

  // Active canvas ref (for any external calls)
  const activeCanvasRef = isPassiveTab ? passiveCanvasRef : skillCanvasRef

  return (
    <div id="skill-tree-canvas" className="flex flex-col h-full">
      <SkillTreeTabBar
        activeSkills={activeSkills}
        selectedIndex={safeTabIndex}
        onChange={handleTabChange}
        onSkillTabClick={handleSkillTabClick}
      />

      {!isPassiveTab && activeSkill && (
        <div
          className="px-4 py-1.5 flex items-center gap-3 text-sm"
          style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}
        >
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            {activeSkill.skillName}
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>Level —</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {classData?.skills.find((s) => s.skillId === activeSkill.skillId)?.masteryGatePoints != null
              ? `Requires ${classData.skills.find((s) => s.skillId === activeSkill.skillId)!.masteryGatePoints} mastery points`
              : classData?.className
                ? `Available for ${classData.className}`
                : ''}
          </span>
        </div>
      )}

      {isPassiveTab && activeBuild ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', height: 36, borderBottom: '1px solid var(--color-bg-elevated)' }}>
          <BudgetToggle />
          <UnspentCounter count={unspentPassivePoints} treeType="passive" budgetEnforced={budgetEnforced} />
        </div>
      ) : !isPassiveTab && activeBuild && slotId && activeSkill ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', height: 36, borderBottom: '1px solid var(--color-bg-elevated)' }}>
          <SkillLevelInput slotId={slotId} />
          <UnspentCounter count={unspentSkillPoints} treeType="skill" budgetEnforced={budgetEnforced} />
        </div>
      ) : null}

      {showControls && (
        <TreeControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReset={handleReset}
          onFit={() => activeCanvasRef.current?.fitToTree()}
          hasOverlay={isPassiveTab && !!effectiveNodeEfficiencies && effectiveNodeEfficiencies.length > 0}
          showOverlay={showOverlay}
          onToggleOverlay={() => setShowOverlay((v) => !v)}
          onUndo={undoNodeChange}
          onRedo={redoNodeChange}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      )}

      {/* No onMouseMove on this div — pointer position comes from native listener inside SkillTreeCanvas */}
      <div className="flex-1 min-h-0 relative" onMouseLeave={() => handleNodeHover(null)}>
        {isPassiveTab ? (
          <>
            <SkillTreeCanvas
              ref={passiveCanvasRef}
              treeData={treeData!}
              nodeAllocations={nodeAllocations}
              highlightedNodes={passiveHighlightedNodes}
              iconTextures={iconTextures}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onNodeSelect={handleNodeSelect}
              onNodeContextMenu={handleNodeContextMenu}
              onKeyboardNavigate={handleKeyboardNavigate}
              onPointerMove={handlePointerMove}
              flashNodeIds={flashNodeIds ?? undefined}
              nodeEfficiencies={effectiveNodeEfficiencies}
              showOverlay={showOverlay}
            />

            {hoveredGameNode && !nodeError && (
              <NodeTooltip
                gameNode={hoveredGameNode}
                allocatedPoints={nodeAllocations[hoveredNodeId!] ?? 0}
                position={mousePosition}
                prerequisiteNames={getPrerequisiteNames(hoveredGameNode)}
                onMouseEnter={handleTooltipEnter}
                onMouseLeave={handleTooltipLeave}
              />
            )}

            {nodeError && errorGameNode && (
              <NodeTooltip
                gameNode={errorGameNode}
                allocatedPoints={nodeAllocations[nodeError.nodeId] ?? 0}
                position={mousePosition}
                errorMessage={nodeError.message}
                prerequisiteNames={getPrerequisiteNames(errorGameNode)}
              />
            )}

            {keyboardGameNode && (
              <NodeTooltip
                gameNode={keyboardGameNode}
                allocatedPoints={nodeAllocations[keyboardFocusedNodeId!] ?? 0}
                position={keyboardPosition}
                prerequisiteNames={getPrerequisiteNames(keyboardGameNode)}
              />
            )}
          </>
        ) : isPickerFullPanel ? (
          <SkillPickerGrid
            baseClassName={classData?.className ?? ''}
            skills={filteredSkills}
            selectedSkillId={activeSkills.find((s) => s.slotId === `slot-${pickerState!.slotIndex}`)?.skillId ?? null}
            onSelect={handleSkillSelect}
            onClose={() => setPickerState(null)}
          />
        ) : activeSkill && skillTreeData ? (
          <>
            <SkillTreeCanvas
              ref={skillCanvasRef}
              treeData={skillTreeData}
              primaryDamageType={skillPrimaryDamageType}
              nodeAllocations={slotAllocations}
              highlightedNodes={skillHighlightedNodes}
              iconTextures={iconTextures}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onNodeSelect={handleNodeSelect}
              onNodeContextMenu={handleNodeContextMenu}
              onKeyboardNavigate={handleKeyboardNavigate}
              onPointerMove={handlePointerMove}
              flashNodeIds={flashNodeIds ?? undefined}
            />

            {hoveredGameNode && !nodeError && (
              <NodeTooltip
                gameNode={hoveredGameNode}
                allocatedPoints={activeAllocations[hoveredNodeId!] ?? 0}
                position={mousePosition}
                prerequisiteNames={getPrerequisiteNames(hoveredGameNode)}
                onMouseEnter={handleTooltipEnter}
                onMouseLeave={handleTooltipLeave}
              />
            )}

            {nodeError && errorGameNode && (
              <NodeTooltip
                gameNode={errorGameNode}
                allocatedPoints={activeAllocations[nodeError.nodeId] ?? 0}
                position={mousePosition}
                errorMessage={nodeError.message}
                prerequisiteNames={getPrerequisiteNames(errorGameNode)}
              />
            )}

            {keyboardGameNode && (
              <NodeTooltip
                gameNode={keyboardGameNode}
                allocatedPoints={activeAllocations[keyboardFocusedNodeId!] ?? 0}
                position={keyboardPosition}
                prerequisiteNames={getPrerequisiteNames(keyboardGameNode)}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p style={{ color: 'var(--color-text-muted)' }}>No skill selected</p>
            <button
              ref={emptySlotButtonRef}
              style={{ color: 'var(--color-accent-gold)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={openPickerForCurrentSlot}
            >
              Select a skill
            </button>
          </div>
        )}
      </div>

      {pickerState?.isPopover && (
        <>
          <div
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setPickerState(null)}
          />
          <div
            style={{
              position: 'fixed',
              top: pickerState.anchorRect.bottom + 4,
              left: pickerState.anchorRect.left,
              zIndex: 50,
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: 4,
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            <SkillPickerGrid
              baseClassName={classData?.className ?? ''}
              skills={filteredSkills}
              selectedSkillId={activeSkills.find((s) => s.slotId === `slot-${pickerState.slotIndex}`)?.skillId ?? null}
              onSelect={handleSkillSelect}
              onClose={() => setPickerState(null)}
            />
          </div>
        </>
      )}
    </div>
  )
}
