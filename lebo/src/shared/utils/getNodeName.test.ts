import { describe, it, expect } from 'vitest'
import { getNodeName } from './getNodeName'
import type { GameData, GameNode } from '../types/gameData'

function node(id: string, name: string): GameNode {
  return {
    id,
    name,
    pointCost: 1,
    maxPoints: 1,
    prerequisiteNodeIds: [],
    effectDescription: '',
    tags: [],
    position: { x: 0, y: 0 },
    size: 'medium',
  }
}

const gameData: GameData = {
  manifest: {
    schemaVersion: 1,
    gameVersion: '1.0',
    dataVersion: '1.0',
    generatedAt: '2026-01-01',
    classes: ['sentinel'],
  },
  classes: {
    sentinel: {
      classId: 'sentinel',
      className: 'Sentinel',
      baseTree: { 'base-1': node('base-1', 'Juggernaut') },
      masteries: {
        void_knight: {
          masteryId: 'void_knight',
          masteryName: 'Void Knight',
          nodes: { 'm-1': node('m-1', 'Void Cleave') },
        },
      },
      skills: [],
      skillTrees: {},
    },
  },
}

describe('getNodeName', () => {
  it('resolves a mastery node name', () => {
    expect(getNodeName('m-1', gameData, 'sentinel', 'void_knight')).toBe('Void Cleave')
  })

  it('resolves a base-tree node name when not in the mastery', () => {
    expect(getNodeName('base-1', gameData, 'sentinel', 'void_knight')).toBe('Juggernaut')
  })

  it('falls back to the raw id when the node is unknown', () => {
    expect(getNodeName('ghost-node', gameData, 'sentinel', 'void_knight')).toBe('ghost-node')
  })

  it('falls back to the raw id when gameData is null', () => {
    expect(getNodeName('m-1', null, 'sentinel', 'void_knight')).toBe('m-1')
  })

  it('falls back to the raw id for an unknown class', () => {
    expect(getNodeName('m-1', gameData, 'mage', 'void_knight')).toBe('m-1')
  })
})
