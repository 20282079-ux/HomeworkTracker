import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { loadAll, saveAll, loadAppSettings, saveAppSettings, uid } from "./storage.js";
import { computeStats, filterAndSortTasks, getDaysLeft, formatDate, PRIORITIES } from "./tasks.js";
import { themeStyle } from "./theme.js";
import { launchConfetti } from "./confetti.js";
import { soundEnabled, toggleSound, playClick } from "./sound.js";
import { filterCommands } from "./commands.js";
import TaskCard from "./components/TaskCard.jsx";
import TaskModal from "./components/TaskModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import Toasts from "./components/Toasts.jsx";

const COMMANDS = [
  { id: "add-task", label: "Add Task", category: "Tasks", icon: "＋", shortcut: "N", run: (a) => a.openAdd() },
  { id: "search-tasks", label: "Search Tasks", category: "Tasks", icon: "🔍", shortcut: "", run: (a) => a.focusSearch() },
  { id: "toggle-compact", label: "Toggle Compact View", category: "View", icon: "⊟", shortcut: "", run: (a) => a.toggleCompact() },
  { id: "open-settings", label: "Open Settings", category: "App", icon: "⚙", shortcut: "", run: (a) => a.openSettings() },
  { id: "clear-all", label: "Clear All Tasks", category: "Data", icon: "🗑", shortcut: "", run: (a) => a.clearAll() },
  { id: "theme-midnight", label: "Theme: Midnight", category: "Theme", icon: "🌙", shortcut: "", run: (a) => a.applyPreset("midnight") },
  { id: "theme-forest", label: "Theme: Forest", category: "Theme", icon: "🌿", shortcut: "", run: (a) => a.applyPreset("forest") },
  { id: "theme-ocean", label: "Theme: Ocean", category: "Theme", icon: "🌊", shortcut: "", run: (a) => a.applyPreset("ocean") },
  { id: "theme-sunset", label: "Theme: Sunset", category: "Theme", icon: "🌅", shortcut: "", run: (a) => a.applyPreset("sunset") },
  { id: "theme-rose", label: "Theme: Rose", category: "Theme", icon: "🌸", shortcut: "", run: (a) => a.applyPreset("rose") },
  { id: "theme-light", label: "Theme: Light", category: "Theme", icon: "☀️", shortcut: "", run: (a) => a.applyPreset("light") },
  { id: "theme-coffee", label: "Theme: Coffee", category: "Theme", icon: "☕", shortcut: "", run: (a) => a.applyPreset("coffee") },
  { id: "shortcuts", label: "Keyboard Shortcuts", category: "Help", icon: "⌨", shortcut: "", run: (a) => a.showShortcuts() },
];

export default function App() {
  const boot = useMemo(loadAll, []);
  const [tasks, setTasks] = useState(boot.tasks);
  const [subjects, setSubjects] = useState(boot.subjects);
  const [settings, setSettings] = useState(loadAppSettings);
  const [preset, setPreset] = useState(() => {
    try {
      const stored = localStorage.getItem("hw_preset");
      if (stored) return stored;
      // First visit: follow the OS preference so light-mode users start light.
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
      return "midnight";
    } catch {
      return "midnight";
    }
  });
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState({ open: false, editing: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [toasts, setToasts] = useState([]);
  const [undo, setUndo] = useState(null); // { task, index, timer }
  const searchRef = useRef(null);
  const titleRef = useRef(null);

  // ── Persistence ──
  useEffect(() => {
    saveAll(tasks, subjects);
  }, [tasks, subjects]);
  useEffect(() => {
    saveAppSettings(settings);
    document.title = settings.title;
  }, [settings]);

  // ── Toasts ──
  const toast = useCallback((msg, type = "") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  // ── Theme: CSS variables on :root so the body background, modals and
  // toasts inherit them (they sit outside the .app container), plus a
  // theme class that drives light-mode elevation/contrast rules. ──
  useEffect(() => {
    const vars = themeStyle(preset, settings.radius);
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    const c = document.documentElement.classList;
    ["theme-light", "theme-daytime", "theme-dawn", "theme-dusk"].forEach((k) => c.remove(k));
    if (preset !== "midnight") c.add(`theme-${preset}`);
  }, [preset, settings.radius]);

  // ── First-run welcome ──
  useEffect(() => {
    if (boot.isFirstRun) {
      const t = setTimeout(() => toast("👋 Welcome! Hit ＋ Add Task to create your first assignment. Press ⌨ Shortcuts for keyboard tips.", ""), 600);
      return () => clearTimeout(t);
    }
  }, [boot.isFirstRun, toast]);

  // ── Actions ──
  const openAdd = useCallback(() => setModal({ open: true, editing: null }), []);
  const openEdit = useCallback((id) => setModal({ open: true, editing: id }), []);
  const closeModal = useCallback(() => setModal({ open: false, editing: null }), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const toggleCompact = useCallback(() => setSettings((s) => ({ ...s, compact: !s.compact })), []);
  const focusSearch = useCallback(() => searchRef.current && searchRef.current.focus(), []);
  const showShortcuts = useCallback(() => toast("⌨ Shortcuts: N → new task · Ctrl+K → command palette · Esc → close", ""), [toast]);
  const applyPreset = useCallback((name) => {
    setPreset(name);
    try {
      localStorage.setItem("hw_preset", name);
    } catch {
      /* non-critical */
    }
    toast(`Theme: ${name} ✓`, "success");
  }, [toast]);

  const saveTask = useCallback(
    (data) => {
      if (modal.editing) {
        setTasks((ts) => ts.map((t) => (t.id === modal.editing ? { ...t, ...data } : t)));
        toast("Task updated ✓", "success");
      } else {
        setTasks((ts) => [{ id: uid(), created: Date.now(), ...data }, ...ts]);
        toast("Task added ✓", "success");
      }
      closeModal();
    },
    [modal.editing, toast, closeModal]
  );

  // Unified mark-complete-and-remove path (checkbox and delete both land here).
  const completeAndRemove = useCallback(
    (id) => {
      setTasks((ts) => {
        const t = ts.find((x) => x.id === id);
        if (!t) return ts;
        const wasDone = t.status === "done";
        const removed = { ...t, status: "done" };
        if (!wasDone) {
          if (settings.confetti) launchConfetti();
          if (soundEnabled()) playClick();
        }
        if (undo && undo.timer) clearTimeout(undo.timer);
        const timer = setTimeout(() => setUndo(null), 5000);
        setUndo({ task: removed, index: ts.findIndex((x) => x.id === id), timer });
        return ts.filter((x) => x.id !== id);
      });
    },
    [settings.confetti, undo]
  );

  const undoDelete = useCallback(() => {
    setUndo((u) => {
      if (!u) return null;
      if (u.timer) clearTimeout(u.timer);
      setTasks((ts) => {
        const next = ts.slice();
        next.splice(Math.min(u.index, next.length), 0, u.task);
        return next;
      });
      toast("Task restored ✓", "success");
      return null;
    });
  }, [toast]);

  const togglePin = useCallback((id) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  }, []);

  const clearAll = useCallback(() => {
    if (!confirm("Delete ALL tasks? This cannot be undone.")) return;
    setTasks([]);
    toast("All tasks cleared", "error");
    setSettingsOpen(false);
  }, [toast]);

  const addSubject = useCallback(
    (name, color) => {
      if (subjects.find((s) => s.name.toLowerCase() === name.toLowerCase())) {
        toast("Subject already exists", "error");
        return;
      }
      setSubjects((s) => [...s, { name, color }]);
      toast(`Subject "${name}" added ✓`, "success");
    },
    [subjects, toast]
  );

  const removeSubject = useCallback(
    (i) => {
      if (!confirm(`Remove subject "${subjects[i].name}"? Tasks will stay but lose their subject color.`)) return;
      setSubjects((s) => s.filter((_, idx) => idx !== i));
    },
    [subjects]
  );

  // ── Derived data ──
  const stats = useMemo(() => computeStats(tasks), [tasks]);
  const groups = useMemo(
    () =>
      filterAndSortTasks(tasks, {
        activeFilter,
        search,
        sort,
        statusFilter,
        showDone: settings.showDone,
        groupBySubject: settings.groupBySubject,
      }),
    [tasks, activeFilter, search, sort, statusFilter, settings.showDone, settings.groupBySubject]
  );
  const subjectByName = useMemo(() => {
    const m = {};
    for (const s of subjects) m[s.name] = s;
    return m;
  }, [subjects]);

  const actions = useMemo(
    () => ({ openAdd, focusSearch, toggleCompact, openSettings, clearAll, applyPreset, showShortcuts }),
    [openAdd, focusSearch, toggleCompact, openSettings, clearAll, applyPreset, showShortcuts]
  );
  // Command palette actions are dispatched through this bridge.
  useEffect(() => {
    window.__appActions = actions;
  }, [actions]);
  const filteredCommands = useMemo(() => filterCommands(COMMANDS, paletteQuery), [paletteQuery, COMMANDS]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const inField = !!(e.target && typeof e.target.matches === "function" && e.target.matches("input,textarea,select,[contenteditable]"));
      if (inField) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openAdd();
      } else if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (modal.open) closeModal();
        else if (settingsOpen) setSettingsOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openAdd, paletteOpen, modal.open, settingsOpen, closeModal]);

  const compact = settings.compact === true;

  return (
    <div className="app">
      <canvas id="confetti-canvas" aria-hidden="true" />
      <div id="toast-container" role="log" aria-live="polite" aria-atomic="false">
        {undo && (
          <div className="toast" id="undo-toast">
            <span>✓ Task removed</span>
            <button className="toast-undo" onClick={undoDelete}>
              Undo
            </button>
          </div>
        )}
        <Toasts toasts={toasts} />
      </div>

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="header">
        <div className="header-left">
          <h1 id="app-title">
            {settings.title.split(" ").slice(0, -1).join(" ")} <span>{settings.title.split(" ").slice(-1)}.</span>
          </h1>
          <p className="header-sub">Track your assignments with style</p>
        </div>
        <nav className="header-actions" aria-label="App actions">
          <button className="btn btn-ghost btn-sm" onClick={showShortcuts} title="Keyboard shortcuts: N for new task, Ctrl+K for the command palette, Esc to close" aria-label="Keyboard shortcuts help">
            ⌨ Shortcuts
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggleCompact} title="Toggle compact view" aria-pressed={compact}>
            ⊟ {compact ? "Detailed" : "Compact"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={openSettings} title="Customize settings">
            ⚙ Customize
          </button>
          <button className="btn btn-primary" onClick={openAdd} id="add-btn">
            ＋ Add Task
          </button>
        </nav>
      </header>

      <main id="main-content">
        <section className="tab-panel active" aria-label="Assignments">
          <div className="stats-row" role="group" aria-label="Assignment statistics">
            {[
              ["Total", stats.total, "accent"],
              ["Done", stats.done, "success"],
              ["Overdue", stats.overdue, "danger"],
              ["Due Soon", stats.dueSoon, "warn"],
            ].map(([label, value, cls]) => (
              <div className="stat-card" key={label}>
                <div className="stat-label">{label}</div>
                <div className={`stat-value ${cls}`} aria-live="polite">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="progress-wrap" role="group" aria-label="Overall progress">
            <div className="progress-label">
              <span>Overall Progress</span>
              <span>{stats.pct}%</span>
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={stats.pct} aria-valuemin="0" aria-valuemax="100" aria-label="Assignment completion progress">
              <div className="progress-fill" style={{ width: `${stats.pct}%` }} />
            </div>
          </div>

          <div className="toolbar" role="search" aria-label="Filter and search assignments">
            <div className="filter-chips" role="group" aria-label="Subject filters">
              <button className={`chip${activeFilter === "All" ? " active" : ""}`} onClick={() => setActiveFilter("All")}>
                All
              </button>
              {subjects.map((s) => (
                <button
                  key={s.name}
                  className={`chip${activeFilter === s.name ? " active" : ""}`}
                  style={activeFilter === s.name ? { background: s.color, borderColor: s.color } : undefined}
                  onClick={() => setActiveFilter(s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <label htmlFor="search-input" className="sr-only">
              Search assignments
            </label>
            <input
              ref={searchRef}
              className="search-input"
              type="search"
              placeholder="🔍 Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="search-input"
              aria-label="Search assignments"
            />
            <label htmlFor="sort-select" className="sr-only">
              Sort by
            </label>
            <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} id="sort-select" aria-label="Sort assignments">
              <option value="created">Newest first</option>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
              <option value="subject">Subject</option>
              <option value="alpha">A–Z</option>
            </select>
            <label htmlFor="status-filter" className="sr-only">
              Filter by status
            </label>
            <select className="sort-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} id="status-filter" aria-label="Filter by status">
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="done">Completed</option>
            </select>
          </div>

          <div className="tasks-list" role="list" aria-label="Assignments">
            {groups.every((g) => g.items.length === 0) ? (
              <div className="empty-state">
                <span className="emoji">✅</span>
                {tasks.length === 0 ? (
                  <>
                    No assignments yet — hit <b>+ Add Task</b> to begin!
                  </>
                ) : (
                  "No tasks match your filters."
                )}
              </div>
            ) : (
              groups.map((g) =>
                g.subject === null ? (
                  g.items.map((t, i) => <TaskCard key={t.id} task={t} index={i} compact={compact} subject={subjectByName[t.subject] || { color: "#7c6af7" }} onEdit={openEdit} onDelete={completeAndRemove} onToggle={completeAndRemove} onPin={togglePin} />)
                ) : (
                  <div key={g.subject}>
                    <div className="group-header">
                      <span style={{ color: (subjectByName[g.subject] || {}).color || "#fff" }}>{g.subject}</span> <span style={{ opacity: 0.4 }}>({g.items.length})</span>
                    </div>
                    {g.items.map((t, i) => (
                      <TaskCard key={t.id} task={t} index={i} compact={compact} subject={subjectByName[t.subject] || { color: "#7c6af7" }} onEdit={openEdit} onDelete={completeAndRemove} onToggle={completeAndRemove} onPin={togglePin} />
                    ))}
                  </div>
                )
              )
            )}
          </div>
        </section>
      </main>

      {modal.open && (
        <TaskModal
          key={modal.editing || "new"}
          editing={modal.editing ? tasks.find((t) => t.id === modal.editing) : null}
          subjects={subjects}
          onSave={saveTask}
          onClose={closeModal}
          defaultSubject={subjects[0]?.name || ""}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          setSettings={setSettings}
          preset={preset}
          applyPreset={applyPreset}
          subjects={subjects}
          addSubject={addSubject}
          removeSubject={removeSubject}
          onClose={() => setSettingsOpen(false)}
          onClearAll={clearAll}
          soundEnabled={soundEnabled()}
          onToggleSound={() => {
            toggleSound();
            setSettings((s) => ({ ...s, sound: soundEnabled() }));
          }}
          onRename={(title) => setSettings((s) => ({ ...s, title }))}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          commands={filteredCommands}
          onClose={() => setPaletteOpen(false)}
          query={paletteQuery}
          setQuery={setPaletteQuery}
        />
      )}
    </div>
  );
}
