import React, { useState, useEffect, useRef } from "react";

// Highlight matching text in a label (plain text — labels are our own).
function highlight(text, query) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function CommandPalette({ commands, onClose, query, setQuery }) {
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector(".cmd-palette-item.active");
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active, commands]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(0, commands.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = commands[active];
      if (cmd) {
        onClose();
        setTimeout(() => cmd.run(window.__appActions), 0);
      }
    }
  };

  return (
    <div className="cmd-palette-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="cmd-palette-modal">
        <div className="cmd-palette-header">
          <span className="cmd-palette-icon">⌘</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Type a command…"
            autoComplete="off"
            aria-label="Search commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="cmd-palette-kbd">Esc</kbd>
        </div>
        <div ref={listRef} className="cmd-palette-results" role="listbox" aria-label="Command results">
          {commands.length === 0 ? (
            <div className="cmd-palette-empty">No matching commands</div>
          ) : (
            commands.map((c, i) => (
              <div
                key={c.id}
                className={`cmd-palette-item${i === active ? " active" : ""}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onClose();
                  setTimeout(() => c.run(window.__appActions), 0);
                }}
              >
                <span className="cmd-palette-item-icon">{c.icon}</span>
                <span className="cmd-palette-item-label">{highlight(c.label, query)}</span>
                <span className="cmd-palette-item-category">{c.category}</span>
                {c.shortcut ? <span className="cmd-palette-item-shortcut">{c.shortcut}</span> : null}
              </div>
            ))
          )}
        </div>
        <div className="cmd-palette-footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
