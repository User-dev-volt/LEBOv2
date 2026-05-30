/* ============================================================
   Generic icon glyphs — abstract, original shapes
   No game-derived imagery
   ============================================================ */

const Icon = ({ name, size = 16, color = "currentColor", stroke = 1.6 }) => {
  const s = size;
  const props = {
    width: s, height: s, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "tree": return (
      <svg {...props}>
        <circle cx="12" cy="5" r="2.2" />
        <circle cx="5" cy="14" r="2.2" />
        <circle cx="19" cy="14" r="2.2" />
        <circle cx="12" cy="20" r="2.2" />
        <path d="M12 7v11M11 6L6 13M13 6l5 7M7 15l4 5M17 15l-4 5" opacity="0.6" />
      </svg>
    );
    case "weave": return (
      <svg {...props}>
        <path d="M4 8c4 0 4 8 8 8s4-8 8-8" />
        <path d="M4 16c4 0 4-8 8-8s4 8 8 8" />
      </svg>
    );
    case "gear": return (
      <svg {...props}>
        <path d="M9 4h6l1 3 2 1 3-1v4l-3 1-1 2 1 3-3 2-2-2h-2l-2 2-3-2 1-3-1-2-3-1V7l3 1 2-1z" />
      </svg>
    );
    case "skill": return (
      <svg {...props}>
        <path d="M12 3l2 6 6 1-4.5 4 1 6L12 17l-4.5 3 1-6L4 10l6-1z" />
      </svg>
    );
    case "idol": return (
      <svg {...props}>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="16" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
      </svg>
    );
    case "blessing": return (
      <svg {...props}>
        <path d="M12 3v18M3 12h18" opacity="0.5" />
        <path d="M12 3c5 3 5 15 0 18M12 3c-5 3-5 15 0 18" />
      </svg>
    );
    case "search": return (
      <svg {...props}>
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4-4" />
      </svg>
    );
    case "plus": return (
      <svg {...props}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
    case "x": return (
      <svg {...props}>
        <path d="M6 6l12 12M6 18L18 6" />
      </svg>
    );
    case "chevron-left": return (
      <svg {...props}><path d="M15 6l-6 6 6 6" /></svg>
    );
    case "chevron-right": return (
      <svg {...props}><path d="M9 6l6 6-6 6" /></svg>
    );
    case "chevron-down": return (
      <svg {...props}><path d="M6 9l6 6 6-6" /></svg>
    );
    case "check": return (
      <svg {...props}><path d="M5 12l4 5L19 6" /></svg>
    );
    case "alert": return (
      <svg {...props}><path d="M12 4l9 16H3z" /><path d="M12 10v5M12 18v0.5" /></svg>
    );
    case "minion": return (
      <svg {...props}><circle cx="12" cy="8" r="3.5" /><path d="M6 21c0-4 2.5-7 6-7s6 3 6 7" /><path d="M9 11l-2 3M15 11l2 3" opacity="0.5" /></svg>
    );
    case "globe": return (
      <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>
    );
    case "folder": return (
      <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
    );
    case "user": return (
      <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M5 21c0-4 3-6 7-6s7 2 7 6" /></svg>
    );
    case "save": return (
      <svg {...props}>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M8 4v5h8V4M8 13h8v7H8z" />
      </svg>
    );
    case "import": return (
      <svg {...props}>
        <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
      </svg>
    );
    case "settings": return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    );
    case "bolt": return (
      <svg {...props} fill="currentColor" stroke="none">
        <path d="M13 2L4 14h6l-2 8 10-12h-6z" />
      </svg>
    );
    case "filter": return (
      <svg {...props}>
        <path d="M3 5h18l-7 9v6l-4-2v-4z" />
      </svg>
    );
    case "reset": return (
      <svg {...props}>
        <path d="M4 12a8 8 0 1 0 3-6.2" />
        <path d="M3 3v5h5" />
      </svg>
    );
    case "fit": return (
      <svg {...props}>
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </svg>
    );
    case "zap": return (
      <svg {...props} fill="currentColor" stroke="none">
        <path d="M14 2L5 13h6l-1 9 9-13h-6z" />
      </svg>
    );
    // class glyphs (abstract)
    case "glyph-acolyte": return (
      <svg {...props}>
        <circle cx="12" cy="9" r="4" />
        <path d="M6 21c1-5 4-7 6-7s5 2 6 7" />
      </svg>
    );
    case "glyph-skull": return (
      <svg {...props}>
        <path d="M5 10a7 7 0 0 1 14 0v5l-2 1v3h-3v-2h-4v2H7v-3l-2-1z" />
        <circle cx="9" cy="11" r="1.2" fill="currentColor" />
        <circle cx="15" cy="11" r="1.2" fill="currentColor" />
      </svg>
    );
    // gear slot glyphs — abstract silhouettes
    case "helm": return (
      <svg {...props}><path d="M6 14c0-5 3-9 6-9s6 4 6 9v3H6z" /><path d="M9 14h6" opacity="0.4" /></svg>
    );
    case "amulet": return (
      <svg {...props}><path d="M7 4h10l-2 5a3 3 0 1 1-6 0z" /><circle cx="12" cy="14" r="3.5" /></svg>
    );
    case "chest": return (
      <svg {...props}><path d="M6 8l3-3h6l3 3v12H6z" /><path d="M12 5v15M9 11h6" opacity="0.5" /></svg>
    );
    case "belt": return (
      <svg {...props}><rect x="3" y="9" width="18" height="6" rx="1" /><rect x="10" y="9" width="4" height="6" /></svg>
    );
    case "boots": return (
      <svg {...props}><path d="M8 4v10l-3 4v2h8v-3l3-3V4z" /></svg>
    );
    case "weapon": return (
      <svg {...props}><path d="M5 19l9-13 4 4-9 13z" /><path d="M3 21l3-1" /></svg>
    );
    case "shield": return (
      <svg {...props}><path d="M12 3l8 3v7c0 4-3 6-8 8-5-2-8-4-8-8V6z" /></svg>
    );
    case "gloves": return (
      <svg {...props}><path d="M7 6c0-1.5 1-2 2-2v6h2V3c0-1 2-1 2 0v7h2V4c0-1 2-1 2 0v9c0 4-2 7-5 7H10c-2 0-3-2-3-4z" /></svg>
    );
    case "ring": return (
      <svg {...props}><path d="M12 3l3 4-3 2-3-2z" /><ellipse cx="12" cy="15" rx="6" ry="5" /></svg>
    );
    case "relic": return (
      <svg {...props}><path d="M12 3l5 4-2 13H9L7 7z" /><circle cx="12" cy="11" r="2" /></svg>
    );
    // skill glyphs
    case "skill-harvest": return (
      <svg {...props}><path d="M4 4l16 16" /><path d="M14 4a6 6 0 0 1 6 6h-3a3 3 0 0 0-3-3z" fill="currentColor" stroke="none" /></svg>
    );
    case "skill-blood": return (
      <svg {...props}><path d="M12 3c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z" fill="currentColor" stroke="none" /></svg>
    );
    case "skill-bone": return (
      <svg {...props}><path d="M6 6c-2 0-2 4 0 4h2l8 8v2c0 2 4 2 4 0v-2c0-2-4-2-4 0M8 10l8-4" /></svg>
    );
    case "skill-wraith": return (
      <svg {...props}><path d="M6 18c0-7 3-12 6-12s6 5 6 12c-2 0-3-2-6-2s-4 2-6 2z" /><circle cx="10" cy="10" r="0.8" fill="currentColor" /><circle cx="14" cy="10" r="0.8" fill="currentColor" /></svg>
    );
    case "skill-teleport": return (
      <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" /></svg>
    );
    case "skill-volley": return (
      <svg {...props}><path d="M4 20L20 4M10 4h6v6M4 14v6h6" /></svg>
    );
    default: return (
      <svg {...props}><circle cx="12" cy="12" r="8" /></svg>
    );
  }
};

window.Icon = Icon;
