interface ClassGlyphProps {
  classId: string
  size?: number
}

// Abstract, original class glyphs — no game-derived/ripped imagery.
// One distinct motif per Last Epoch base class; generic circle fallback for unknown ids.
export function ClassGlyph({ classId, size = 18 }: ClassGlyphProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'var(--color-accent-gold)',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (classId) {
    // Acolyte — skull / necrotic motif
    case 'acolyte':
      return (
        <svg {...props}>
          <path d="M5 10a7 7 0 0 1 14 0v5l-2 1v3h-3v-2h-4v2H7v-3l-2-1z" />
          <circle cx="9" cy="11" r="1.2" fill="var(--color-accent-gold)" stroke="none" />
          <circle cx="15" cy="11" r="1.2" fill="var(--color-accent-gold)" stroke="none" />
        </svg>
      )
    // Mage — radiant orb / four-point star
    case 'mage':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19" />
        </svg>
      )
    // Primalist — claw / talon
    case 'primalist':
      return (
        <svg {...props}>
          <path d="M6 3c1 5 1 9 0 13M12 3c1 5 1 10 0 14M18 3c-1 5-1 9 0 13" />
          <path d="M5 16c1 3 4 5 7 5s6-2 7-5" />
        </svg>
      )
    // Rogue — crossed daggers
    case 'rogue':
      return (
        <svg {...props}>
          <path d="M5 4l11 14M4 7l3-1 1-3" />
          <path d="M19 4L8 18M20 7l-3-1-1-3" />
          <path d="M7 18l-2 2M17 18l2 2" />
        </svg>
      )
    // Sentinel — shield / cross
    case 'sentinel':
      return (
        <svg {...props}>
          <path d="M12 3l8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6z" />
          <path d="M12 8v8M8 11h8" opacity="0.7" />
        </svg>
      )
    // Generic fallback
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}
