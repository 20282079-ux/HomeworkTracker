// storage.js — localStorage persistence, seeds and legacy key cleanup.
//
// Keys are identical to the legacy plain-JS app so existing installs keep
// their data after the React migration.
const LEGACY_STORAGE_KEYS = [
  "hw_quickadd_history", // quick-add suggestions/history (removed)
  "hw_custom_synonyms", // custom term → course mappings (removed)
  "hw_ai_provider", // voice provider selection (removed)
  "hw_ai_model", // voice model selection (removed)
  "hw_openrouter_key", // voice API key (removed)
  "hw_gemini_key", // voice API key (removed)
  "hw_tests", // tests/quizzes tab (removed)
  "hw_starfield_state", // constellation starfield (removed)
  "hw_forest_state", // legacy tree gamification (removed)
  "hw_tree_state", // legacy tree gamification (removed)
  "hw_hold_keys", // focus / night-sky hold keys (removed)
  "hw_auto_theme", // time-of-day auto theme scheduler (removed)
  "hw_templates", // task templates (removed)
];

function purgeLegacyKeys() {
  LEGACY_STORAGE_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage blocked — nothing to clean */
    }
  });
}

export const DEFAULT_SUBJECTS = [
  { name: "Math", color: "#818cf8" },
  { name: "Science", color: "#34d399" },
  { name: "English", color: "#fb923c" },
  { name: "History", color: "#f472b6" },
  { name: "Art", color: "#a78bfa" },
  { name: "PE", color: "#38bdf8" },
  { name: "Other", color: "#94a3b8" },
];

// First-run sample tasks so a brand-new install shows a populated board.
export function seedSampleTasks() {
  const fmt = (d) => d.toISOString().split("T")[0];
  const add = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return fmt(d);
  };
  return [
    { id: uid(), subject: "Math", title: "Chapter 5 Problem Set", notes: "Problems 1–30, show work", due: add(1), priority: "High", status: "pending", created: Date.now() - 5000, time: 60 },
    { id: uid(), subject: "English", title: "Essay: The Great Gatsby", notes: "3 pages, MLA format", due: add(3), priority: "Medium", status: "in-progress", created: Date.now() - 4000, time: 90 },
    { id: uid(), subject: "Science", title: "Lab Report Write-up", notes: "Include hypothesis and conclusion", due: add(-1), priority: "Urgent", status: "pending", created: Date.now() - 3000, time: 45 },
    { id: uid(), subject: "History", title: "WWII Timeline Poster", notes: "", due: add(7), priority: "Low", status: "pending", created: Date.now() - 2000, time: 30 },
    { id: uid(), subject: "Math", title: "Practice Quiz Corrections", notes: "", due: add(2), priority: "Medium", status: "done", created: Date.now() - 1000, time: 20 },
  ];
}

export function uid() {
  return "_" + Math.random().toString(36).slice(2, 11);
}

// Persisted app settings (toggles live outside CSS so they survive refresh).
export function loadAppSettings() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem("hw_app_settings") || "{}");
  } catch {
    s = {};
  }
  return {
    showDone: s.showDone !== false,
    groupBySubject: s.groupBySubject === true,
    confetti: s.confetti !== false,
    sound: localStorage.getItem("hw_sound_enabled") !== "0",
    title: s.title || "Homework Tracker",
    radius: typeof s.radius === "number" ? s.radius : 14,
  };
}

export function saveAppSettings(settings) {
  try {
    localStorage.setItem("hw_app_settings", JSON.stringify(settings));
  } catch {
    /* non-critical */
  }
}

// Load all app state. Returns { tasks, subjects, isFirstRun }.
export function loadAll() {
  purgeLegacyKeys();
  let tasks = [];
  let subjects = DEFAULT_SUBJECTS;
  let isFirstRun = false;
  try {
    const t = localStorage.getItem("hw_tasks");
    const s = localStorage.getItem("hw_subjects");
    if (t) tasks = JSON.parse(t);
    if (s) subjects = JSON.parse(s);
    if (!t && !s) {
      isFirstRun = true;
      tasks = seedSampleTasks();
    }
  } catch {
    tasks = [];
  }
  if (!Array.isArray(tasks)) tasks = [];
  if (!Array.isArray(subjects) || subjects.length === 0) subjects = DEFAULT_SUBJECTS;
  return { tasks, subjects, isFirstRun };
}

export function saveAll(tasks, subjects) {
  try {
    localStorage.setItem("hw_tasks", JSON.stringify(tasks));
    localStorage.setItem("hw_subjects", JSON.stringify(subjects));
  } catch {
    /* storage full/blocked — best effort */
  }
}
