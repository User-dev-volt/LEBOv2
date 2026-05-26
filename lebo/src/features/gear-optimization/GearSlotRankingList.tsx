import type { GearSlotRanking, WishlistAffix } from '../../shared/types/statSheet'

// Maps Rust canonical slot IDs to display labels.
// Covers GEAR_SLOTS IDs and possible Rust canonical variants (Story 1.3 naming may differ).
const SLOT_DISPLAY: Record<string, string> = {
  helmet: 'Helmet',
  body: 'Body',
  gloves: 'Gloves',
  belt: 'Belt',
  boots: 'Boots',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  amulet: 'Amulet',
  relic: 'Relic',
  weapon: 'Weapon',
  offhand: 'Off-hand',
  // Rust canonical variants from Story 1.3 AC wording
  helm: 'Helmet',
  chest: 'Body',
  ring_1: 'Ring 1',
  ring_2: 'Ring 2',
  off_hand: 'Off-hand',
}

function slotDisplayName(slotId: string): string {
  return SLOT_DISPLAY[slotId] ?? slotId
}

function efficiencyColor(pct: number): string {
  if (pct >= 80) return 'var(--color-text-secondary)'
  if (pct >= 50) return 'var(--color-accent-gold)'
  return 'var(--color-data-damage)'
}

interface WishlistRowProps {
  affix: WishlistAffix
}

function WishlistRow({ affix }: WishlistRowProps) {
  if (affix.satisfied) {
    return (
      <div className="flex flex-col">
        <div
          className="flex items-start gap-2"
          style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
          aria-label={`${affix.display_name} — satisfied`}
        >
          <span aria-hidden="true">✓</span>
          <span className="flex-1">{affix.display_name}</span>
          <span className="text-xs shrink-0">T{affix.target_tier}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div
        className="flex items-start gap-2"
        style={{ color: 'var(--color-text-primary)' }}
        aria-label={`${affix.display_name} — missing or below tier T${affix.target_tier}`}
      >
        <span aria-hidden="true">○</span>
        <span className="flex-1">{affix.display_name}</span>
        <span className="text-xs shrink-0">T{affix.target_tier}+</span>
      </div>
      {affix.mechanical_reason && (
        <p className="text-xs mt-0.5 ml-4" style={{ color: 'var(--color-text-muted)' }}>
          {affix.mechanical_reason}
        </p>
      )}
    </div>
  )
}

interface WishlistSectionProps {
  label: string
  affixes: WishlistAffix[]
}

function WishlistSection({ label, affixes }: WishlistSectionProps) {
  if (affixes.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <div className="flex flex-col gap-1.5 text-xs">
        {affixes.map((affix, i) => (
          <WishlistRow key={`${affix.affix_id}-${i}`} affix={affix} />
        ))}
      </div>
    </div>
  )
}

interface SlotRowProps {
  ranking: GearSlotRanking
  isPriority: boolean
}

function SlotRow({ ranking, isPriority }: SlotRowProps) {
  const pct = Math.round(ranking.efficiency_percent)
  const hasWishlist = ranking.ideal_prefix.length > 0 || ranking.ideal_suffix.length > 0

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
      tabIndex={0}
    >
      {/* Slot header */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {slotDisplayName(ranking.slot)}
        </span>
        {isPriority && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-semibold shrink-0"
            style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
            aria-label="Priority Upgrade slot"
          >
            Priority
          </span>
        )}
        <span
          className="text-xs font-mono shrink-0"
          style={{ color: efficiencyColor(pct) }}
        >
          {pct}% of ideal
        </span>
      </div>

      {/* Wishlist */}
      {hasWishlist ? (
        <div className="flex flex-col gap-2 pl-1">
          <WishlistSection label="Prefixes" affixes={ranking.ideal_prefix} />
          <WishlistSection label="Suffixes" affixes={ranking.ideal_suffix} />
        </div>
      ) : (
        <p className="text-xs pl-1" style={{ color: 'var(--color-text-muted)' }}>
          No affix recommendations available
        </p>
      )}

      {/* TODO (Story 5.5): "correct — keep" badge for unique/set items once Rust emits
          is_correct_unique on GearSlotRanking or the item database provides rarity. */}
    </div>
  )
}

interface Props {
  rankings: GearSlotRanking[]
  prioritySlot: string
}

export function GearSlotRankingList({ rankings, prioritySlot }: Props) {
  if (rankings.length === 0) return null

  return (
    <div className="flex flex-col gap-2" data-testid="gear-slot-ranking-list">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        Upgrade Priority
      </p>
      {rankings.map((ranking, i) => (
        <SlotRow
          key={`${ranking.slot}-${i}`}
          ranking={ranking}
          isPriority={prioritySlot !== '' && ranking.slot === prioritySlot}
        />
      ))}
    </div>
  )
}
