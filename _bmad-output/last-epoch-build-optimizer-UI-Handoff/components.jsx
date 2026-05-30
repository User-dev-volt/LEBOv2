/* ============================================================
   Shared small components (Select, Toggle, Tooltip helpers)
   ============================================================ */

const { useState, useRef, useEffect, useMemo, useCallback } = React;

function Select({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className="select" ref={ref}>
      <div
        className={`select-trigger ${open ? "open" : ""} ${disabled ? "btn-disabled" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span style={{ color: current ? "var(--text-primary)" : "var(--text-muted)" }}>
          {current ? current.label : (placeholder || "Select…")}
        </span>
        <span className="select-caret" />
      </div>
      {open && (
        <div className="select-menu">
          {options.map((o) => (
            <div
              key={o.value}
              className={`select-option ${o.value === value ? "active" : ""}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.icon ? <Icon name={o.icon} size={14} /> : null}
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => onChange(!value)}>
      <div className={`toggle ${value ? "on" : ""}`} />
      {label && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>}
    </div>
  );
}

// Reusable kbd badge
function Kbd({ children }) { return <span className="kbd">{children}</span>; }

// Counter pip strip for affix tiers
function TierPips({ tier, max, onChange, isLegendary }) {
  return (
    <div className="affix-tier-pips" onClick={(e) => e.stopPropagation()}>
      {Array.from({ length: max }).map((_, i) => {
        const cls = (i < tier) ? (isLegendary && i >= 5 ? "on t7" : "on") : "";
        return (
          <div
            key={i}
            className={`tier-pip ${cls}`}
            onClick={() => onChange(i + 1)}
            title={`T${i + 1}`}
          />
        );
      })}
    </div>
  );
}

Object.assign(window, { Select, Toggle, Kbd, TierPips });
