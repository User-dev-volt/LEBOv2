/* ============================================================
   Idol grid editor — 5x4 grid, drag from tray
   ============================================================ */

const { IDOL_DEFS } = window.LEBO_DATA;

const SHAPE_DIMS = {
  "1x1": [1, 1],
  "2x1": [2, 1],
  "1x2": [1, 2],
  "2x2": [2, 2],
  "1x3": [1, 3],
  "3x1": [3, 1],
};

function IdolEditor({ state, dispatch }) {
  const [selectedTray, setSelectedTray] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);

  const COLS = 5, ROWS = 4;

  // Compute occupancy map: id -> idol placement
  const grid = useMemo(() => {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    state.idols.forEach((it) => {
      const [w, h] = SHAPE_DIMS[it.shape];
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          if (g[it.r + dy]?.[it.c + dx] !== undefined) {
            g[it.r + dy][it.c + dx] = { ...it, head: dx === 0 && dy === 0 };
          }
        }
      }
    });
    return g;
  }, [state.idols]);

  const canPlace = (def, r, c) => {
    if (!def) return false;
    const [w, h] = SHAPE_DIMS[def.shape];
    if (r + h > ROWS || c + w > COLS) return false;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        if (grid[r + dy][c + dx]) return false;
    return true;
  };

  const onCellClick = (r, c) => {
    const existing = grid[r][c];
    if (existing) {
      dispatch({ type: "idol:remove", placementId: existing.placementId });
      return;
    }
    if (selectedTray) {
      const def = IDOL_DEFS.find((d) => d.id === selectedTray);
      if (canPlace(def, r, c)) {
        dispatch({ type: "idol:place", def, r, c });
      }
    }
  };

  // Preview overlay for selected tray idol
  const previewCells = useMemo(() => {
    if (!selectedTray || !hoverCell) return new Set();
    const def = IDOL_DEFS.find((d) => d.id === selectedTray);
    const [w, h] = SHAPE_DIMS[def.shape];
    const out = new Set();
    if (!canPlace(def, hoverCell.r, hoverCell.c)) return out;
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        out.add(`${hoverCell.r + dy}_${hoverCell.c + dx}`);
    return out;
  }, [selectedTray, hoverCell, grid]);

  // Render cells: skip cells already occupied by a non-head placement
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell && !cell.head) continue;
      if (cell) {
        const [w, h] = SHAPE_DIMS[cell.shape];
        cells.push(
          <div
            key={`${r}_${c}`}
            className={`idol-cell occupied head idol-shape-${cell.shape}`}
            style={{ gridColumn: `${c + 1} / span ${w}`, gridRow: `${r + 1} / span ${h}` }}
            onClick={() => onCellClick(r, c)}
            title={`${cell.name}\n${cell.stat}`}
          >
            <div className="idol-occupied-name">{cell.name.replace(/^(Lesser|Stout|Slender|Grand|Humble|Wide) Idol of /, "")}</div>
          </div>
        );
      } else {
        cells.push(
          <div
            key={`${r}_${c}`}
            className={`idol-cell ${previewCells.has(`${r}_${c}`) ? "preview" : ""}`}
            style={{ gridColumn: `${c + 1} / span 1`, gridRow: `${r + 1} / span 1` }}
            onMouseEnter={() => setHoverCell({ r, c })}
            onMouseLeave={() => setHoverCell(null)}
            onClick={() => onCellClick(r, c)}
          >
            {selectedTray ? "" : "+"}
          </div>
        );
      }
    }
  }

  const totalCells = state.idols.reduce((sum, i) => {
    const [w, h] = SHAPE_DIMS[i.shape];
    return sum + w * h;
  }, 0);

  return (
    <div className="idol-editor">
      <div className="idol-board">
        <div className="idol-board-head">
          <div>
            <div className="idol-board-title">Idol Inventory</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              5 × 4 grid · click empty cells to place selected idol · click placed idol to remove
            </div>
          </div>
          <div className="idol-board-stats">
            <span className="mono">{totalCells} / 20 cells</span>
            <span style={{ width: 1, height: 14, background: "var(--hairline)" }} />
            <span>{state.idols.length} idols placed</span>
          </div>
        </div>
        <div className="idol-grid">{cells}</div>

        {/* Stat summary */}
        <div style={{ marginTop: 14, padding: 12, background: "var(--bg-elevated)", borderRadius: 5, border: "1px solid var(--hairline)" }}>
          <div className="label" style={{ marginBottom: 6 }}>Active Idol Stats</div>
          {state.idols.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No idols placed.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {state.idols.map((i) => (
                <div key={i.placementId} className="mono" style={{ fontSize: 11, color: "var(--accent-gold-soft)" }}>
                  • {i.stat}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="idol-tray">
        <div className="idol-tray-head">
          <div style={{ fontSize: 13, fontWeight: 600 }}>Available Idols</div>
          <span className="chip mono">{IDOL_DEFS.length}</span>
        </div>
        <div style={{ padding: "10px 12px 4px" }}>
          <input className="input" placeholder="Filter idols…" />
        </div>
        <div className="idol-tray-body">
          {IDOL_DEFS.map((def) => {
            const [w, h] = SHAPE_DIMS[def.shape];
            return (
              <div
                key={def.id}
                className={`idol-card ${selectedTray === def.id ? "active" : ""}`}
                onClick={() => setSelectedTray(def.id === selectedTray ? null : def.id)}
              >
                <div className="idol-card-shape" style={{ width: 18 + w * 8, height: 18 + h * 8 }}>
                  {w}×{h}
                </div>
                <div className="idol-card-info">
                  <div className="idol-card-name">{def.name}</div>
                  <div className="idol-card-stat">{def.stat}</div>
                </div>
                <div className="idol-card-cells">{def.cells}c</div>
              </div>
            );
          })}
        </div>
        {selectedTray && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--hairline)", background: "var(--accent-gold-tint)" }}>
            <div style={{ fontSize: 11, color: "var(--accent-gold)" }}>
              <Icon name="plus" size={11} /> Click empty grid cell to place
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.IdolEditor = IdolEditor;
