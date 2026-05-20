export interface IdolGridCell {
  row: number
  col: number
}

export interface IdolDefaultGrid {
  rows: number
  cols: number
  blockedCells: IdolGridCell[]
}

export type IdolSizeType = '1x1' | '1x2' | '1x3' | '2x2'

export interface IdolAffixSlot {
  affixId: string
  tier: number
}

export interface IdolPlacementRule {
  sizeType: IdolSizeType
  validOriginCells: IdolGridCell[]
}

export interface IdolData {
  version: string
  defaultGrid: IdolDefaultGrid
  placementRules: IdolPlacementRule[]
  altarVariants: unknown[]
}
