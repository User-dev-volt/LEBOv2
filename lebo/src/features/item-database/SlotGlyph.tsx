interface SlotGlyphProps {
  slotId: string
  color: string
  size?: number
}

// Inline SVG slot glyphs — abstract, original line-art (no ripped game imagery), one motif per gear
// slot, tinted by the item's rarity color via the `color` prop. There is no item-icon asset pipeline
// (useIconTextures is PixiJS skill-tree only), so the card icon is a slot glyph. Mirrors the
// ClassGlyph inline-SVG pattern locally (item-database owns its own copy — no cross-feature import).
export function SlotGlyph({ slotId, color, size = 20 }: SlotGlyphProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (slotId) {
    case 'helmet':
      return (
        <svg {...props}>
          <path d="M5 13a7 7 0 0 1 14 0v3H5z" />
          <path d="M5 16h14v3H5z" />
        </svg>
      )
    case 'body':
      return (
        <svg {...props}>
          <path d="M7 4l5 2 5-2 1 6-2 2v6H8v-6l-2-2z" />
        </svg>
      )
    case 'gloves':
      return (
        <svg {...props}>
          <path d="M8 11V5a1.5 1.5 0 0 1 3 0v4M11 9V4a1.5 1.5 0 0 1 3 0v5M14 9V6a1.5 1.5 0 0 1 3 0v8a5 5 0 0 1-5 5H10l-4-4 1.5-1.5L10 10" />
        </svg>
      )
    case 'belt':
      return (
        <svg {...props}>
          <rect x="3" y="9" width="18" height="6" rx="1" />
          <rect x="10" y="9" width="4" height="6" />
        </svg>
      )
    case 'boots':
      return (
        <svg {...props}>
          <path d="M9 4v9l-3 3v4h11v-3c0-3-4-3-4-6V4z" />
        </svg>
      )
    case 'ring1':
    case 'ring2':
      return (
        <svg {...props}>
          <circle cx="12" cy="14" r="6" />
          <path d="M9.5 8.5L11 5h2l1.5 3.5" />
        </svg>
      )
    case 'amulet':
      return (
        <svg {...props}>
          <path d="M6 4l6 3 6-3" />
          <path d="M12 7v3" />
          <path d="M12 10l3 4-3 4-3-4z" />
        </svg>
      )
    case 'relic':
      return (
        <svg {...props}>
          <path d="M12 3l7 9-7 9-7-9z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )
    case 'weapon':
      return (
        <svg {...props}>
          <path d="M18 4l-9 9M6 15l3 3M4 17l3 3M5 16l3 3" />
          <path d="M13 9l4-4 2 .5.5 2-4 4" />
        </svg>
      )
    case 'offhand':
      return (
        <svg {...props}>
          <path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      )
  }
}
