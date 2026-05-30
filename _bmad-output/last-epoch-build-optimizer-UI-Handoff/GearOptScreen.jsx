/* ============================================================
   Gear Optimization screen
   A full-width GEAR workspace:
   - Character paper-doll (drag-drop equip targets)
   - Searchable gear database (drag items onto slots)
   - Selected-item detail with affix add/remove picker
   - AI-ranked gear swap recommendations
   ============================================================ */

const { GEAR_SLOTS: GO_SLOTS, ITEMS_BY_SLOT: GO_ITEMS, AFFIX_POOL: GO_AFFIX } = window.LEBO_DATA;

// Flat catalog tagged with slot
const GO_CATALOG = Object.entries(GO_ITEMS).flatMap(([slotId, items]) =>
  items.map((it) => ({ ...it, slotId }))
);

function GearOptScreen({ state, dispatch, onBack }) {
  const [activeSlot, setActiveSlot] = useState("weapon");
  const [dropSlot, setDropSlot] = useState(null);       // {id, valid}
  const [draggingId, setDraggingId] = useState(null);
  const [query, setQuery] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");  // all | <slotId>
  const [rarityFilter, setRarityFilter] = useState("any");
  const [affixPicker, setAffixPicker] = useState(null); // {slotId, affixIdx}
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);

  const activeItem = activeSlot ? state.gear[activeSlot] : null;
  const activeSlotDef = activeSlot ? GO_SLOTS.find((s) => s.id === activeSlot) : null;

  // ---- drag & drop ----
  const onDragStart = (e, item) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: item.id, slotId: item.slotId }));
    e.dataTransfer.effectAllowed = "copy";
    setDraggingId(item.id);
  };
  const onDragEnd = () => { setDraggingId(null); setDropSlot(null); };

  const onSlotDragOver = (e, slot) => {
    e.preventDefault();
    const valid = draggingId ? GO_CATALOG.find((c) => c.id === draggingId)?.slotId === slot.id : true;
    e.dataTransfer.dropEffect = valid ? "copy" : "none";
    setDropSlot({ id: slot.id, valid });
  };
  const onSlotDrop = (e, slot) => {
    e.preventDefault();
    setDropSlot(null);
    setDraggingId(null);
    try {
      const { id, slotId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (slotId !== slot.id) return; // wrong slot type
      const catItem = GO_CATALOG.find((c) => c.id === id);
      if (catItem) {
        dispatch({ type: "gear:set", slotId: slot.id, item: window.hydrateItem(catItem) });
        setActiveSlot(slot.id);
      }
    } catch (_) {}
  };

  // ---- database filtering ----
  const filtered = GO_CATALOG.filter((it) => {
    if (slotFilter !== "all" && it.slotId !== slotFilter) return false;
    if (rarityFilter !== "any" && it.rarity !== rarityFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!it.name.toLowerCase().includes(q) && !it.base.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const equip = (it) => {
    dispatch({ type: "gear:set", slotId: it.slotId, item: window.hydrateItem(it) });
    setActiveSlot(it.slotId);
  };

  const equippedCount = Object.values(state.gear).filter(Boolean).length;

  // ---- AI analysis ----
  const analyze = () => {
    setAnalyzing(true);
    setResults(null);
    setTimeout(() => {
      setAnalyzing(false);
      setResults([
        { slot: "weapon",  current: "Necrotic Scepter (Rare)", rec: "Famine's Edge (Unique)",  delta: +18.4, why: "Enemies take 30% increased damage — multiplies your whole loop." },
        { slot: "amulet",  current: "Empty",                    rec: "Heart of the Lich King",  delta: +12.1, why: "Spend health instead of mana fits the Rip Blood sustain loop." },
        { slot: "chest",   current: "Empty",                    rec: "Cinderclad Vestment",     delta: +9.7,  why: "Ward retention + ignite doubling raises effective HP and DoT." },
        { slot: "gloves",  current: "Ascetic Gloves (Rare)",    rec: "Touch of the Reaper",     delta: +6.2,  why: "Crit-bleed combo lifts clear speed without losing survivability." },
        { slot: "ring2",   current: "Empty",                    rec: "Auric Circle (Rare)",     delta: +3.4,  why: "Closes the Lightning Resistance gap (+34%)." },
        { slot: "boots",   current: "Empty",                    rec: "Striders of the Wandering Star", delta: -1.1, why: "Loses some res, but +45% move speed for a low-armor glass build." },
      ]);
    }, 1100);
  };

  const RARITIES = [
    { v: "any", l: "Any" }, { v: "normal", l: "Normal" }, { v: "magic", l: "Magic" },
    { v: "rare", l: "Rare" }, { v: "set", l: "Set" }, { v: "unique", l: "Unique" }, { v: "legendary", l: "Legendary" },
  ];

  return (
    <div className="gearopt">
      <div className="gearopt-head">
        <div className="gearopt-back" onClick={onBack}>
          <Icon name="chevron-left" size={14} /> Back to Builder
        </div>
        <div style={{ width: 1, height: 18, background: "var(--hairline)" }} />
        <div>
          <div className="gearopt-title">Gear Optimization</div>
          <div className="gearopt-sub">Drag gear from the database onto your character, tune affixes, and let AI rank upgrades per slot.</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="chip mono">{equippedCount} / 11 equipped</span>
        <button className="btn btn-gold btn-lg" disabled={analyzing} onClick={analyze}
          style={analyzing ? { animation: "pulse-gold 1.4s ease-in-out infinite" } : {}}>
          <Icon name="zap" size={14} /> {analyzing ? "Analyzing gear…" : "Optimize Gear"}
        </button>
      </div>

      <div className="gearopt-workspace">
        {/* ---------------- Paper-doll ---------------- */}
        <div className="go-doll">
          <div className="go-doll-head">
            <div style={{ fontSize: 13, fontWeight: 600 }}>Equipped</div>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>drag items here →</span>
          </div>
          <div className="go-doll-body">
            {GO_SLOTS.map((slot) => {
              const item = state.gear[slot.id];
              const isDrop = dropSlot?.id === slot.id;
              return (
                <div
                  key={slot.id}
                  className={`go-slot ${item ? `filled rarity-${item.rarity}` : ""} ${activeSlot === slot.id ? "active" : ""} ${isDrop ? (dropSlot.valid ? "dropping" : "invalid-drop") : ""}`}
                  onClick={() => setActiveSlot(slot.id)}
                  onDragOver={(e) => onSlotDragOver(e, slot)}
                  onDragLeave={() => setDropSlot(null)}
                  onDrop={(e) => onSlotDrop(e, slot)}
                >
                  <div className="go-slot-tile">
                    <Icon name={slot.glyph} size={26} color={item ? `var(--rarity-${item.rarity})` : "var(--text-faint)"} />
                  </div>
                  <div className="go-slot-info">
                    <div className="go-slot-label">{slot.label}</div>
                    {item ? (
                      <div className="go-slot-name">{item.name}</div>
                    ) : (
                      <div className="go-slot-empty-name">Empty — drag to equip</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- Gear database ---------------- */}
        <div className="go-db">
          <div className="go-db-toolbar">
            <div className="go-db-search">
              <Icon name="search" size={14} color="var(--text-muted)" />
              <input className="input" placeholder="Search the item database by name or base type…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="go-db-filters">
              <span className="filter-pill" style={{ pointerEvents: "none", background: "transparent", border: "none", color: "var(--text-muted)", padding: "4px 2px" }}>Slot:</span>
              <div className={`filter-pill ${slotFilter === "all" ? "on" : ""}`} onClick={() => setSlotFilter("all")}>All</div>
              {GO_SLOTS.map((s) => (
                <div key={s.id} className={`filter-pill ${slotFilter === s.id ? "on" : ""}`} onClick={() => setSlotFilter(s.id)}>
                  <Icon name={s.glyph} size={11} /> {s.label}
                </div>
              ))}
            </div>
            <div className="go-db-filters">
              <span className="filter-pill" style={{ pointerEvents: "none", background: "transparent", border: "none", color: "var(--text-muted)", padding: "4px 2px" }}>Rarity:</span>
              {RARITIES.map((r) => (
                <div key={r.v} className={`filter-pill ${rarityFilter === r.v ? "on" : ""}`} onClick={() => setRarityFilter(r.v)}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: r.v === "any" ? "var(--text-muted)" : `var(--rarity-${r.v})`, display: "inline-block" }} />
                  {r.l}
                </div>
              ))}
            </div>
          </div>
          <div className="go-db-list">
            {filtered.map((it) => {
              const slot = GO_SLOTS.find((s) => s.id === it.slotId);
              const isEquipped = state.gear[it.slotId]?.id === it.id;
              return (
                <div
                  key={it.id}
                  className={`go-db-card rarity-${it.rarity} ${isEquipped ? "equipped" : ""} ${draggingId === it.id ? "dragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, it)}
                  onDragEnd={onDragEnd}
                  onDoubleClick={() => equip(it)}
                  title="Drag onto a slot, or double-click to equip"
                >
                  <div className="go-db-card-icon">
                    <Icon name={slot.glyph} size={24} color={`var(--rarity-${it.rarity})`} />
                  </div>
                  <div className="go-db-card-info">
                    <div className="go-db-card-name">{it.name}</div>
                    <div className="go-db-card-base">{it.base}</div>
                    <div className="go-db-card-tag">
                      {it.uniqueText ? "Unique effect" : `${it.affixes} affixes`} · {slot.label}
                      {isEquipped ? " · EQUIPPED" : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-muted)", padding: 30 }}>
                No items match your filters.
              </div>
            )}
          </div>
        </div>

        {/* ---------------- Detail / affix editor ---------------- */}
        <div className="go-detail">
          {!activeItem ? (
            <div className="go-detail-empty">
              <Icon name="gear" size={32} color="var(--text-faint)" />
              <div style={{ fontSize: 12 }}>{activeSlotDef ? `${activeSlotDef.label} is empty` : "Select a slot"}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", maxWidth: 220 }}>
                Drag an item from the database onto this slot, or double-click any item to equip it. Then add or remove affixes here.
              </div>
            </div>
          ) : (
            <ItemDetail
              slot={activeSlotDef}
              item={activeItem}
              onChangeItem={() => { setSlotFilter(activeSlot); setQuery(""); }}
              onRemove={() => { dispatch({ type: "gear:set", slotId: activeSlot, item: null }); }}
              onAddAffix={() => setAffixPicker({ slotId: activeSlot, affixIdx: -1 })}
              onEditAffix={(i) => setAffixPicker({ slotId: activeSlot, affixIdx: i })}
              onRemoveAffix={(i) => dispatch({ type: "gear:removeAffix", slotId: activeSlot, affixIdx: i })}
              onChangeTier={(i, tier) => dispatch({ type: "gear:setTier", slotId: activeSlot, affixIdx: i, tier })}
            />
          )}
        </div>
      </div>

      {/* Affix picker (reused from gear editor) */}
      {affixPicker && (
        <window.AffixPickerModal
          slotId={affixPicker.slotId}
          existing={state.gear[affixPicker.slotId]?.affixList?.[affixPicker.affixIdx]}
          onClose={() => setAffixPicker(null)}
          onPick={(affix, tier) => {
            dispatch({ type: "gear:setAffix", slotId: affixPicker.slotId, affixIdx: affixPicker.affixIdx, affix, tier });
            setAffixPicker(null);
          }}
        />
      )}

      {/* AI results panel */}
      {results && (
        <div style={{
          position: "absolute",
          top: 0, right: 0, bottom: 0,
          width: 480,
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--accent-gold-dim)",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          animation: "slide-in-right 240ms ease",
          zIndex: 20,
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-gold)" }}>Recommended Gear Swaps</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{results.length} upgrades ranked by build-score delta</div>
            </div>
            <div className="modal-close" onClick={() => setResults(null)}><Icon name="x" size={14} /></div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--hairline)",
                borderLeft: `3px solid ${r.delta > 0 ? "var(--data-positive)" : "var(--data-negative)"}`,
                borderRadius: 5,
                padding: 12,
                marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>{r.slot}</span>
                  </div>
                  <span className={`mono ${r.delta > 0 ? "pos" : "neg"}`} style={{ fontSize: 13, fontWeight: 700 }}>
                    {r.delta > 0 ? "+" : ""}{r.delta.toFixed(1)}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "left" }}>{r.current}</div>
                  <Icon name="chevron-right" size={12} color="var(--accent-gold-dim)" />
                  <div style={{ fontSize: 11, color: "var(--accent-gold)", fontWeight: 600, textAlign: "right" }}>{r.rec}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{r.why}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 14, borderTop: "1px solid var(--hairline)", display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setResults(null)}>Dismiss</button>
            <button className="btn btn-gold" style={{ flex: 1 }}>Apply All Recommended</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.GearOptScreen = GearOptScreen;
