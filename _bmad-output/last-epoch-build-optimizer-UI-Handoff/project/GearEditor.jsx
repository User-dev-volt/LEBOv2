/* ============================================================
   Gear editor — paper-doll silhouette + detail pane
   + Item Picker Modal + Affix Picker Modal
   ============================================================ */

const { GEAR_SLOTS, ITEMS_BY_SLOT, AFFIX_POOL } = window.LEBO_DATA;

function GearEditor({ state, dispatch }) {
  const [activeSlot, setActiveSlot] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(null);
  const [affixPickerOpen, setAffixPickerOpen] = useState(null); // {slotId, affixIdx}

  const leftSlots = GEAR_SLOTS.filter((s) => s.col === "left");
  const rightSlots = GEAR_SLOTS.filter((s) => s.col === "right");

  const activeItem = activeSlot ? state.gear[activeSlot] : null;
  const activeSlotDef = activeSlot ? GEAR_SLOTS.find((s) => s.id === activeSlot) : null;

  const renderSlot = (slot) => {
    const item = state.gear[slot.id];
    return (
      <div
        key={slot.id}
        className={`gear-slot ${item ? `filled rarity-${item.rarity}` : ""} ${activeSlot === slot.id ? "active" : ""}`}
        onClick={() => { setActiveSlot(slot.id); if (!item) setPickerOpen(slot.id); }}
      >
        <div className="gear-slot-tile">
          {item ? (
            <Icon name={slot.glyph} size={28} color={`var(--rarity-${item.rarity})`} />
          ) : (
            <Icon name={slot.glyph} size={26} color="var(--text-faint)" />
          )}
        </div>
        <div className="gear-slot-info">
          <div className="gear-slot-label">{slot.label}</div>
          {item ? (
            <>
              <div className="gear-slot-itemname">{item.name}</div>
              <div className="gear-slot-affixes">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`affix-pip ${item.affixList && item.affixList[i] ? "filled" : ""}`} />
                ))}
              </div>
            </>
          ) : (
            <div className="gear-slot-itemname" style={{ color: "var(--text-muted)", fontWeight: 500 }}>Empty</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="gear-editor">
      <div className="gear-doll">
        <div className="gear-doll-head">
          <div className="gear-doll-title">Equipment</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="chip mono">{Object.values(state.gear).filter(Boolean).length} / 11</span>
            <button className="btn btn-sm"><Icon name="reset" size={11} /> Clear all</button>
          </div>
        </div>
        <div className="gear-doll-body">
          <div className="doll-col">{leftSlots.map(renderSlot)}</div>
          <div className="doll-col center">
            <svg width="120" height="240" viewBox="0 0 120 240" fill="none">
              <ellipse cx="60" cy="38" rx="22" ry="26" stroke="var(--accent-gold-dim)" strokeWidth="1.2" opacity="0.6" />
              <path d="M30 70c10-6 50-6 60 0v90H30z" stroke="var(--accent-gold-dim)" strokeWidth="1.2" opacity="0.6" />
              <path d="M30 70l-12 70M90 70l12 70" stroke="var(--accent-gold-dim)" strokeWidth="1.2" opacity="0.6" />
              <path d="M40 160h12v60H30zM68 160h12v60H68" stroke="var(--accent-gold-dim)" strokeWidth="1.2" opacity="0.6" />
              <text x="60" y="40" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)" letterSpacing="2">LICH</text>
            </svg>
          </div>
          <div className="doll-col">{rightSlots.map(renderSlot)}</div>
        </div>
      </div>

      {/* Detail pane */}
      <div className="gear-detail">
        {!activeItem ? (
          <div className="gear-detail-empty">
            <Icon name="gear" size={32} color="var(--text-faint)" />
            <div style={{ fontSize: 12 }}>Select a gear slot</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", maxWidth: 220 }}>
              Click any equipment slot on the left to edit affixes, or click an empty slot to browse items.
            </div>
          </div>
        ) : (
          <ItemDetail
            slot={activeSlotDef}
            item={activeItem}
            onChangeItem={() => setPickerOpen(activeSlot)}
            onRemove={() => { dispatch({ type: "gear:set", slotId: activeSlot, item: null }); setActiveSlot(null); }}
            onAddAffix={() => setAffixPickerOpen({ slotId: activeSlot, affixIdx: -1 })}
            onEditAffix={(i) => setAffixPickerOpen({ slotId: activeSlot, affixIdx: i })}
            onRemoveAffix={(i) => dispatch({ type: "gear:removeAffix", slotId: activeSlot, affixIdx: i })}
            onChangeTier={(i, tier) => dispatch({ type: "gear:setTier", slotId: activeSlot, affixIdx: i, tier })}
          />
        )}
      </div>

      {pickerOpen && (
        <ItemPickerModal
          slotId={pickerOpen}
          currentId={state.gear[pickerOpen]?.id}
          onClose={() => setPickerOpen(null)}
          onPick={(item) => {
            dispatch({ type: "gear:set", slotId: pickerOpen, item });
            setActiveSlot(pickerOpen);
            setPickerOpen(null);
          }}
        />
      )}

      {affixPickerOpen && (
        <AffixPickerModal
          slotId={affixPickerOpen.slotId}
          existing={state.gear[affixPickerOpen.slotId]?.affixList?.[affixPickerOpen.affixIdx]}
          onClose={() => setAffixPickerOpen(null)}
          onPick={(affix, tier) => {
            dispatch({
              type: "gear:setAffix",
              slotId: affixPickerOpen.slotId,
              affixIdx: affixPickerOpen.affixIdx,
              affix, tier,
            });
            setAffixPickerOpen(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Item Detail (right side) ---------- */

function ItemDetail({ slot, item, onChangeItem, onRemove, onAddAffix, onEditAffix, onRemoveAffix, onChangeTier }) {
  const affList = item.affixList || [];
  return (
    <>
      <div className="gear-detail-head">
        <div className="gear-detail-class">{slot.label} · {item.base}</div>
        <div className={`gear-detail-name rarity-${item.rarity}`}>{item.name}</div>
        {item.uniqueText && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic" }}>
            "{item.uniqueText}"
          </div>
        )}
      </div>
      <div className="gear-detail-body">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="btn btn-sm" style={{ flex: 1 }} onClick={onChangeItem}>
            <Icon name="search" size={11} /> Swap item
          </button>
          <button className="btn btn-sm" onClick={onRemove}>
            <Icon name="x" size={11} /> Remove
          </button>
        </div>

        <div className="label" style={{ marginBottom: 6 }}>Affixes</div>

        {affList.map((a, i) => (
          <div key={i} className="affix-row">
            <div className="affix-row-head">
              <div className="affix-row-name">{a.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="affix-row-value">
                  {Math.round(a.range[0] + (a.range[1] - a.range[0]) * (a.tier / a.maxTier))}
                  {a.unit}
                </div>
                <div className="affix-row-remove" onClick={() => onRemoveAffix(i)}><Icon name="x" size={12} /></div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              Range T{a.tier}: {Math.round(a.range[0] + (a.range[1]-a.range[0]) * ((a.tier-1)/a.maxTier))}–{Math.round(a.range[0] + (a.range[1]-a.range[0]) * (a.tier/a.maxTier))}{a.unit}
            </div>
            <TierPips tier={a.tier} max={a.maxTier} onChange={(t) => onChangeTier(i, t)} isLegendary={a.maxTier === 7} />
          </div>
        ))}

        {affList.length < 4 && (
          <button className="add-affix-btn" onClick={onAddAffix}>
            <Icon name="plus" size={12} /> Add affix ({affList.length}/4)
          </button>
        )}

        {item.rarity === "unique" && (
          <div style={{ marginTop: 14, padding: 10, background: "rgba(212, 128, 90, 0.08)", border: "1px solid rgba(212, 128, 90, 0.3)", borderRadius: 5 }}>
            <div className="label" style={{ color: "var(--rarity-unique)", marginBottom: 4 }}>Unique Item</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Uniques have fixed effects; affixes can be added via the Legendary forging system once a Glyph of Despair is socketed.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Item Picker Modal ---------- */

function ItemPickerModal({ slotId, currentId, onClose, onPick }) {
  const slot = GEAR_SLOTS.find((s) => s.id === slotId);
  const allItems = ITEMS_BY_SLOT[slotId] || [];
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("any");
  const [selected, setSelected] = useState(currentId || null);

  const filtered = allItems.filter((i) => {
    if (rarity !== "any" && i.rarity !== rarity) return false;
    if (query && !i.name.toLowerCase().includes(query.toLowerCase()) && !i.base.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const selectedItem = filtered.find((i) => i.id === selected) || allItems.find((i) => i.id === selected);

  const confirm = () => {
    if (!selectedItem) return;
    // Hydrate with affixList
    const item = {
      ...selectedItem,
      affixList: Array.from({ length: selectedItem.affixes || 0 }).map((_, i) => {
        const pool = i < 2 ? AFFIX_POOL.offense : AFFIX_POOL.defense;
        const a = pool[i % pool.length];
        return { ...a, maxTier: a.tier, tier: Math.max(3, a.tier - 2) };
      }),
    };
    onPick(item);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal item-picker">
        <div className="modal-head">
          <div className="modal-title">
            Choose <span className="gold">{slot.label}</span>
          </div>
          <div className="modal-close" onClick={onClose}><Icon name="x" size={14} /></div>
        </div>
        <div className="modal-body">
          <div className="item-picker-sidebar">
            <div className="filter-cat">
              <div className="filter-cat-title">Rarity</div>
              {[
                { v: "any", l: "Any" },
                { v: "normal", l: "Normal" },
                { v: "magic", l: "Magic" },
                { v: "rare", l: "Rare" },
                { v: "set", l: "Set" },
                { v: "unique", l: "Unique" },
                { v: "legendary", l: "Legendary" },
              ].map((r) => (
                <div key={r.v} className={`filter-pill ${rarity === r.v ? "on" : ""}`} onClick={() => setRarity(r.v)}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: r.v === "any" ? "var(--text-muted)" : `var(--rarity-${r.v})`, display: "inline-block" }} />
                  {r.l}
                </div>
              ))}
            </div>
            <div className="filter-cat">
              <div className="filter-cat-title">Item Level</div>
              <input type="range" min="1" max="100" defaultValue="92" className="weight-slider" />
              <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>1 – 92</div>
            </div>
            <div className="filter-cat">
              <div className="filter-cat-title">Required Tags</div>
              {["Fire", "Cold", "Necrotic", "Void", "Minion"].map((t) => (
                <div key={t} className="filter-pill">{t}</div>
              ))}
            </div>
          </div>
          <div className="item-picker-main">
            <div className="item-picker-toolbar">
              <Icon name="search" size={13} color="var(--text-muted)" />
              <input className="input" placeholder="Search items by name or base…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="item-picker-list">
              {filtered.map((it) => (
                <div
                  key={it.id}
                  className={`item-card rarity-${it.rarity} ${selected === it.id ? "selected" : ""}`}
                  onClick={() => setSelected(it.id)}
                  onDoubleClick={() => { setSelected(it.id); setTimeout(confirm, 0); }}
                >
                  <div className="item-card-icon">
                    <Icon name={slot.glyph} size={26} color={`var(--rarity-${it.rarity})`} />
                  </div>
                  <div className="item-card-info">
                    <div className="item-card-name">{it.name}</div>
                    <div className="item-card-base">{it.base}</div>
                    <div className="item-card-affix">
                      {it.uniqueText ? <em style={{ color: `var(--rarity-${it.rarity})` }}>{it.uniqueText}</em> : `${it.affixes} affix slots`}
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: "span 2", textAlign: "center", color: "var(--text-muted)", padding: 30 }}>
                  No items match.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span style={{ flex: 1, fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} items · double-click to equip</span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" disabled={!selectedItem} onClick={confirm}>Equip Item</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Affix Picker Modal ---------- */

function AffixPickerModal({ slotId, existing, onClose, onPick }) {
  const [selected, setSelected] = useState(existing?.id || null);
  const [tier, setTier] = useState(existing?.tier || 5);
  const [query, setQuery] = useState("");

  const groups = [
    { title: "Offense", key: "offense", items: AFFIX_POOL.offense },
    { title: "Defense", key: "defense", items: AFFIX_POOL.defense },
    { title: "Utility", key: "utility", items: AFFIX_POOL.utility },
  ];

  const matches = (a) => !query || a.name.toLowerCase().includes(query.toLowerCase());

  const sel = [...AFFIX_POOL.offense, ...AFFIX_POOL.defense, ...AFFIX_POOL.utility].find((a) => a.id === selected);

  const rollMin = sel ? Math.round(sel.range[0] + (sel.range[1] - sel.range[0]) * ((tier - 1) / sel.tier)) : 0;
  const rollMax = sel ? Math.round(sel.range[0] + (sel.range[1] - sel.range[0]) * (tier / sel.tier)) : 0;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal affix-picker">
        <div className="modal-head">
          <div className="modal-title">{existing ? "Change Affix" : "Add Affix"}</div>
          <div className="modal-close" onClick={onClose}><Icon name="x" size={14} /></div>
        </div>
        <div className="item-picker-toolbar">
          <Icon name="search" size={13} color="var(--text-muted)" />
          <input className="input" placeholder="Search affix by stat…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="affix-picker-body">
          {groups.map((g) => {
            const items = g.items.filter(matches);
            if (!items.length) return null;
            return (
              <div className="affix-group" key={g.key}>
                <div className="affix-group-title">{g.title}</div>
                {items.map((a) => (
                  <div
                    key={a.id}
                    className={`affix-option ${selected === a.id ? "selected" : ""}`}
                    onClick={() => setSelected(a.id)}
                  >
                    <div>
                      <div className="affix-option-name">{a.name}</div>
                      <div className="affix-option-tags">{g.title} · max T{a.tier}</div>
                    </div>
                    <div className="affix-option-range mono">
                      {a.range[0]}–{a.range[1]}{a.unit}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {sel && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--hairline)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Tier</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--accent-gold)" }}>
                T{tier} → {rollMin}–{rollMax}{sel.unit}
              </span>
            </div>
            <TierPips tier={tier} max={sel.tier} onChange={setTier} isLegendary={sel.tier === 7} />
          </div>
        )}
        <div className="modal-foot">
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" disabled={!sel} onClick={() => onPick(sel, tier)}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// Shared hydrate helper: turn a catalog item into an equipped item w/ affixList
function hydrateItem(it) {
  return {
    ...it,
    affixList: Array.from({ length: it.affixes || 0 }).map((_, i) => {
      const pool = i < 2 ? AFFIX_POOL.offense : AFFIX_POOL.defense;
      const a = pool[i % pool.length];
      return { ...a, maxTier: a.tier, tier: Math.max(3, a.tier - 2) };
    }),
  };
}

Object.assign(window, { GearEditor, ItemDetail, ItemPickerModal, AffixPickerModal, hydrateItem });
