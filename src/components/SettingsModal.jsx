import React, { useState } from "react";
import { PRESETS } from "../theme.js";

const PRESET_LIST = [
  ["midnight", "🌙 Midnight"],
  ["forest", "🌿 Forest"],
  ["ocean", "🌊 Ocean"],
  ["sunset", "🌅 Sunset"],
  ["rose", "🌸 Rose"],
  ["light", "☀️ Light"],
  ["coffee", "☕ Coffee"],
];

export default function SettingsModal({ settings, setSettings, preset, applyPreset, subjects, addSubject, removeSubject, onUpdateSubject, onClose, onClearAll, soundOn, onToggleSound }) {
  const [newSubject, setNewSubject] = useState("");
  const [newColor, setNewColor] = useState("#7c6af7");

  const submitSubject = (e) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    addSubject(newSubject.trim(), newColor);
    setNewSubject("");
  };

  const updateSubject = (i, patch) => onUpdateSubject(i, patch);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Customize settings">
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2 className="modal-title">🎨 Customize</h2>

        <div className="settings-section">
          <h3 className="settings-section-title">✨ Theme Presets</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRESET_LIST.map(([name, label]) => (
              <button key={name} className={`btn btn-ghost btn-sm${preset === name ? " preset-active" : ""}`} onClick={() => applyPreset(name)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">📚 Subjects</h3>
          <div id="subject-list">
            {subjects.map((s, i) => (
              <div className="subject-item" key={i}>
                <div className="subject-dot" style={{ background: s.color }} />
                <input
                  type="text"
                  value={s.name}
                  aria-label={`Subject ${i + 1} name`}
                  onChange={(e) => updateSubject(i, { name: e.target.value })}
                />
                <input type="color" value={s.color} aria-label={`Subject ${i + 1} color`} title="Color" onChange={(e) => updateSubject(i, { color: e.target.value })} />
                <button className="task-act-btn del" onClick={() => removeSubject(i)} title="Remove">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <form className="add-subject-row" style={{ marginTop: 10, gap: 8, display: "flex" }} onSubmit={submitSubject}>
            <input
              type="text"
              placeholder="New subject…"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              style={{ flex: 1, background: "var(--surface2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 13, outline: "none" }}
            />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 44, height: 44, border: "none", borderRadius: 8, padding: 3, background: "var(--surface2)", cursor: "pointer" }} aria-label="New subject color" />
            <button type="submit" className="btn btn-primary btn-sm">
              Add
            </button>
          </form>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">🔊 Sound</h3>
          <div className="toggle-row">
            <label htmlFor="s-sound">Task-completion sound 🔊</label>
            <label className="toggle">
              <input type="checkbox" id="s-sound" checked={soundOn} onChange={onToggleSound} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">⚙️ Settings</h3>
          <div className="toggle-row">
            <label htmlFor="s-show-done">Show completed tasks</label>
            <label className="toggle">
              <input type="checkbox" id="s-show-done" checked={settings.showDone} onChange={(e) => setSettings((s) => ({ ...s, showDone: e.target.checked }))} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="toggle-row">
            <label htmlFor="s-compact">Compact view</label>
            <label className="toggle">
              <input type="checkbox" id="s-compact" checked={settings.compact === true} onChange={(e) => setSettings((s) => ({ ...s, compact: e.target.checked }))} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="toggle-row">
            <label htmlFor="s-confetti">Confetti on completion 🎉</label>
            <label className="toggle">
              <input type="checkbox" id="s-confetti" checked={settings.confetti} onChange={(e) => setSettings((s) => ({ ...s, confetti: e.target.checked }))} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="toggle-row">
            <label htmlFor="s-group">Group tasks by subject</label>
            <label className="toggle">
              <input type="checkbox" id="s-group" checked={settings.groupBySubject} onChange={(e) => setSettings((s) => ({ ...s, groupBySubject: e.target.checked }))} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label htmlFor="s-radius" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 8 }}>
              Border Radius: <span id="radius-val">{settings.radius}px</span>
            </label>
            <input type="range" min="0" max="28" value={settings.radius} id="s-radius" onChange={(e) => setSettings((s) => ({ ...s, radius: +e.target.value }))} />
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">📝 App Title</h3>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="s-title" className="sr-only">
              App title
            </label>
            <input type="text" id="s-title" placeholder="App title…" value={settings.title} onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))} style={{ background: "var(--surface2)" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button className="btn btn-danger btn-sm" onClick={onClearAll}>
            🗑 Clear All Tasks
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { applyPreset("midnight"); setSettings((s) => ({ ...s, radius: 14 })); }}>
              ↺ Reset Theme
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
