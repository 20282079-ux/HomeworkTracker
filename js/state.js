// 1-state.js (split from app.js) — shared state, storage, seeds, resets

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
let tasks = [];
let tests = [];
let activeTestFilter = 'All';
let editingTestId = null;
let subjects = [
  { name: 'Math',    color: '#818cf8' },
  { name: 'Science', color: '#34d399' },
  { name: 'English', color: '#fb923c' },
  { name: 'History', color: '#f472b6' },
  { name: 'Art',     color: '#a78bfa' },
  { name: 'PE',      color: '#38bdf8' },
  { name: 'Other',   color: '#94a3b8' },
];
let activeFilter = 'All';
let editingId = null;
let compactMode = false;

// PRIORITIES and PRIO_WEIGHT are defined in calendar.js (extracted from app.js)

// ═══════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════
function save() {
  localStorage.setItem('hw_tasks', JSON.stringify(tasks));
  localStorage.setItem('hw_subjects', JSON.stringify(subjects));
  localStorage.setItem('hw_settings', JSON.stringify(getSettings()));
  localStorage.setItem('hw_tests', JSON.stringify(tests));
}

function load() {
  const t = localStorage.getItem('hw_tasks');
  const s = localStorage.getItem('hw_subjects');
  const cfg = localStorage.getItem('hw_settings');
  const te = localStorage.getItem('hw_tests');
  var isFirstRun = !t && !cfg && !te;
  try { if (t) tasks = JSON.parse(t); } catch (e) { tasks = []; /* corrupted data */ }
  try { if (s) subjects = JSON.parse(s); } catch (e) { /* keep defaults */ }
  try { if (cfg) applySettings(JSON.parse(cfg)); else seedSampleTasks(); } catch (e) { seedSampleTasks(); /* corrupted settings */ }
  if (!cfg) {
    // Auto-detect OS dark/light preference on first load
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        localStorage.setItem('hw_preset', 'light');
        if (typeof applyPreset === 'function') applyPreset('light');
      }
    } catch (e2) { /* non-critical */ }
  }
  try { if (te) tests = JSON.parse(te); else seedSampleTests(); } catch (e) { tests = []; seedSampleTests(); /* corrupted data */ }

  // Restore the theme-* class on <html> so CSS selectors that depend on
  // html.theme-light / html.theme-midnight etc. match after a page refresh.
  // applySettings() above restores the CSS-variable values, but the class
  // itself is transient — only persistable via hw_preset in localStorage.
  try {
    var savedPreset = localStorage.getItem('hw_preset');
    if (savedPreset && typeof applyStarfieldTheme === 'function') {
      applyStarfieldTheme(savedPreset);
    }
  } catch (e) {}

  // Run daily/weekly resets and cleanup
  dailyReset();
  weeklyReset();
  pruneCompletedPastDue();

  // First-run welcome tip — shown once, dismissible via localStorage flag.
  if (isFirstRun && typeof toast === 'function') {
    setTimeout(function() {
      toast('👋 Welcome! Type in the quick-add bar, e.g. "math homework due friday 30m". Click ⌨ Shortcuts for keyboard tips.', '', 8000);
    }, 800);
  }
}

function getSettings() {
  const vars = ['--bg','--bg2','--bg3','--surface','--surface2','--border','--text','--text2','--text3','--accent','--accent2','--radius'];
  const out = {};
  const style = getComputedStyle(document.documentElement);
  vars.forEach(v => out[v] = style.getPropertyValue(v).trim());
  out.title = document.getElementById('app-title').innerText.replace('\n','').replace('Tracker.','Tracker').trim();
  out.compact = compactMode;
  return out;
}

function applySettings(cfg) {
  Object.entries(cfg).forEach(([k,v]) => {
    if (k.startsWith('--')) document.documentElement.style.setProperty(k, v);
  });
  if (cfg.title) {
    const parts = cfg.title.split(' ');
    const last = parts.pop();
    document.getElementById('app-title').innerHTML = `${parts.join(' ')} <span>${last}.</span>`;
    document.getElementById('s-title').value = cfg.title;
  }
  if (cfg.compact) { compactMode = true; document.getElementById('s-compact').checked = true; }
  syncColorInputs();
}

function seedSampleTasks() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const add = n => { const d = new Date(); d.setDate(d.getDate()+n); return fmt(d); };
  tasks = [
    { id: uid(), subject:'Math', title:'Chapter 5 Problem Set', notes:'Problems 1–30, show work', due: add(1), priority:'High', status:'pending', created: Date.now()-5000, time:60, recurring:'' },
    { id: uid(), subject:'English', title:'Essay: The Great Gatsby', notes:'3 pages, MLA format', due: add(3), priority:'Medium', status:'in-progress', created: Date.now()-4000, time:90, recurring:'' },
    { id: uid(), subject:'Science', title:'Lab Report Write-up', notes:'Include hypothesis and conclusion', due: add(-1), priority:'Urgent', status:'pending', created: Date.now()-3000, time:45, recurring:'' },
    { id: uid(), subject:'History', title:'WWII Timeline Poster', notes:'', due: add(7), priority:'Low', status:'pending', created: Date.now()-2000, time:30, recurring:'' },
    { id: uid(), subject:'Math', title:'Practice Quiz Corrections', notes:'', due: add(2), priority:'Medium', status:'done', created: Date.now()-1000, time:20, recurring:'' },
  ];
}

function uid() { return '_' + Math.random().toString(36).substr(2,9); }
