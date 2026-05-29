/* ============================================================
   Settings screen
   ============================================================ */

function SettingsScreen({ onBack }) {
  const [activeProvider, setActiveProvider] = useState("openrouter");
  const [keyClaude, setKeyClaude] = useState("");
  const [keyOR, setKeyOR] = useState("sk-or-…hidden…d4f");
  const [dataMode, setDataMode] = useState("auto");
  const [llmTemp, setLlmTemp] = useState(0.6);

  return (
    <div className="settings">
      <div className="settings-head">
        <div className="gearopt-back" onClick={onBack}>
          <Icon name="chevron-left" size={14} /> Back
        </div>
        <div style={{ width: 1, height: 18, background: "var(--hairline)" }} />
        <div>
          <div className="gearopt-title" style={{ fontSize: 18 }}>Settings</div>
          <div className="gearopt-sub">Configure AI providers, data sources, and keyboard shortcuts.</div>
        </div>
      </div>

      <div className="settings-body">
        {/* AI Providers */}
        <div className="settings-section">
          <h3>AI Provider</h3>
          <div className="settings-section-sub">
            LEBO uses AI to rank passive tree suggestions and recommend gear. Choose your provider and add credentials.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className={`provider-card ${activeProvider === "claude" ? "active" : ""}`} onClick={() => setActiveProvider("claude")}>
              <div className="provider-head">
                <div className="provider-name">
                  <div className="provider-logo">C</div>
                  <div>
                    <div>Claude</div>
                    <div className="provider-desc">Anthropic · highest quality</div>
                  </div>
                </div>
                {activeProvider === "claude" && <span className="chip chip-gold">Active</span>}
              </div>
              <input className="input mono" placeholder="sk-ant-api03-…" value={keyClaude} onChange={(e) => setKeyClaude(e.target.value)} />
              <button className="btn btn-gold-outline btn-sm" style={{ marginTop: 8 }} disabled={!keyClaude}>Save Key</button>
            </div>

            <div className={`provider-card ${activeProvider === "openrouter" ? "active" : ""}`} onClick={() => setActiveProvider("openrouter")}>
              <div className="provider-head">
                <div className="provider-name">
                  <div className="provider-logo">OR</div>
                  <div>
                    <div>OpenRouter</div>
                    <div className="provider-desc">Free-tier multi-model rotation</div>
                  </div>
                </div>
                {activeProvider === "openrouter" && <span className="chip chip-gold">Active</span>}
              </div>
              <input className="input mono" placeholder="sk-or-…" value={keyOR} onChange={(e) => setKeyOR(e.target.value)} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                Auto-rotates Gemini 2.0 Flash, Llama 3.3 70B, Mistral 7B, Gemma 2 27B as free quotas refresh.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 12, background: "var(--bg-elevated)", borderRadius: 5, border: "1px solid var(--hairline)" }}>
            <div className="label" style={{ marginBottom: 8 }}>Inference Tuning</div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 40px", alignItems: "center", gap: 12, padding: "4px 0" }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Temperature</span>
              <input type="range" min="0" max="1" step="0.05" value={llmTemp} onChange={(e) => setLlmTemp(+e.target.value)} className="weight-slider" />
              <span className="mono" style={{ fontSize: 11 }}>{llmTemp.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              Lower → consistent, predictable. Higher → more experimental builds.
            </div>
          </div>
        </div>

        {/* Data Sources */}
        <div className="settings-section half">
          <h3>Data Sources</h3>
          <div className="settings-section-sub">Game data and item database.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <DataRow label="Game Data" value="Season 4 (Shattered Omens)" sub="Updated 2026-03-25" status="fresh" />
            <DataRow label="Item Database" value="s4.1" sub="Updated 2026-03-26" status="fresh" />
            <DataRow label="Icon Source" value="Bundled placeholders" sub="No game icons shipped" status="info" />
            <DataRow label="Patch Notes Cache" value="Stale (24d)" sub="Last sync 2026-03-02" status="stale" />
          </div>
          <button className="btn btn-sm btn-full" style={{ marginTop: 10 }}><Icon name="reset" size={11} /> Refresh All</button>
        </div>

        {/* App preferences */}
        <div className="settings-section half">
          <h3>App Preferences</h3>
          <div className="settings-section-sub">Behavior and persistence.</div>
          <PrefRow label="Auto-save current build" value={true} />
          <PrefRow label="Confirm before resetting passive tree" value={true} />
          <PrefRow label="Show node connection lines" value={true} />
          <PrefRow label="Animate AI suggestions" value={true} />
          <PrefRow label="Telemetry (anonymous)" value={false} />
        </div>

        {/* Keyboard shortcuts */}
        <div className="settings-section">
          <h3>Keyboard Shortcuts</h3>
          <div className="settings-section-sub">Most actions are mapped to single keys for speed.</div>
          <table className="shortcut-table">
            <tbody>
              <tr><td><Kbd>O</Kbd></td><td>Focus Optimize button</td></tr>
              <tr><td><Kbd>I</Kbd></td><td>Focus Import Build input</td></tr>
              <tr><td><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd></td><td>Save current build</td></tr>
              <tr><td><Kbd>Esc</Kbd></td><td>Collapse suggestion / clear preview</td></tr>
              <tr><td><Kbd>↑</Kbd>/<Kbd>↓</Kbd></td><td>Navigate suggestion list</td></tr>
              <tr><td><Kbd>P</Kbd></td><td>Preview focused suggestion</td></tr>
              <tr><td><Kbd>S</Kbd></td><td>Skip focused suggestion</td></tr>
              <tr><td><Kbd>Tab</Kbd>/<Kbd>Shift</Kbd>+<Kbd>Tab</Kbd></td><td>Navigate tree nodes (connection order)</td></tr>
              <tr><td><Kbd>Enter</Kbd></td><td>Allocate / deallocate focused tree node</td></tr>
              <tr><td><Kbd>←</Kbd>/<Kbd>→</Kbd>/<Kbd>↑</Kbd>/<Kbd>↓</Kbd></td><td>Move to adjacent connected node</td></tr>
              <tr><td><Kbd>1</Kbd>–<Kbd>6</Kbd></td><td>Switch center tab</td></tr>
              <tr><td><Kbd>[</Kbd>/<Kbd>]</Kbd></td><td>Collapse / expand side panels</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value, sub, status }) {
  const dotColor = status === "fresh" ? "var(--data-positive)" : status === "stale" ? "var(--accent-gold)" : "var(--text-muted)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px dashed var(--hairline)" }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: dotColor }} />
      <div>
        <div style={{ fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{sub}</div>
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function PrefRow({ label, value: initial }) {
  const [v, setV] = useState(initial);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--hairline)" }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <Toggle value={v} onChange={setV} />
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
