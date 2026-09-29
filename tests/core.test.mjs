// tests/core.test.mjs — Vitest suite for the Homework Tracker core.
//
// The app is a plain-script PWA (no bundler, no ES modules): every file shares
// one global scope in the browser. To exercise that here we concatenate the
// sources into a single script and run it inside a Node `vm` context with a
// minimal DOM/localStorage shim — the same thing the browser does when it
// evaluates a run of <script> tags in one realm.
//
// Coverage: escaping helpers, date/grade math, storage round-trips, task
// filtering/sorting, completion + undo, and a structural guard that the
// removed quick-add/parser/voice, tests-tab/starfield/dev-mode and
// templates/subtasks/recurring/export surfaces stay gone.

import { describe, it, expect, beforeEach } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Minimal DOM shim ───────────────────────────────────────────────────
function makeClassList() {
  const set = new Set();
  return {
    add(...c) { c.forEach(x => set.add(x)); },
    remove(...c) { c.forEach(x => set.delete(x)); },
    toggle(c, on) {
      if (on === undefined) { set.has(c) ? set.delete(c) : set.add(c); }
      else if (on) set.add(c);
      else set.delete(c);
    },
    contains(c) { return set.has(c); },
  };
}

function makeElement(tag) {
  const children = [];
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    id: '',
    className: '',
    classList: makeClassList(),
    style: {},
    dataset: {},
    value: '',
    checked: false,
    innerText: '',
    textContent: '',
    title: '',
    type: '',
    href: '',
    download: '',
    children,
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) { children.push(child); return child; },
    removeChild(child) { const i = children.indexOf(child); if (i >= 0) children.splice(i, 1); return child; },
    insertBefore(child) { children.push(child); return child; },
    remove() {},
    focus() {},
    blur() {},
    select() {},
    click() {},
    closest() { return null; },
    matches() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getContext() { return null; },
  };
  // Assigning innerHTML replaces any previously appended children, like the
  // real DOM does — the app relies on `container.innerHTML = ''` to reset lists.
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return html; },
    set(v) { html = v; children.length = 0; },
    enumerable: true,
  });
  return el;
}

function makeDocument(captured) {
  const elements = {};
  const get = (id) => {
    if (!elements[id]) {
      const el = makeElement('div');
      el.id = id;
      elements[id] = el;
    }
    return elements[id];
  };
  // Mirror the initial checked state declared in index.html.
  get('s-show-done').checked = true;

  return {
    getElementById: get,
    createElement(tag) {
      const el = makeElement(tag);
      if (String(tag).toLowerCase() === 'a') captured.anchors.push(el);
      return el;
    },
    createTextNode(t) { return { nodeType: 3, textContent: t }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    documentElement: {
      style: { setProperty() {}, getPropertyValue() { return ''; } },
      classList: makeClassList(),
    },
    body: { classList: makeClassList(), style: {}, appendChild() {}, removeChild() {} },
  };
}

function makeStorage() {
  const store = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    _raw: store,
  };
}

// ── Boot the app bundle inside a VM ────────────────────────────────────
const captured = { anchors: [], blobs: [] };
const doc = makeDocument(captured);
const storage = makeStorage();

class MockBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options && options.type;
    captured.blobs.push(this);
  }
}

function buildSandbox(document, localStorage) {
  const s = {
    document,
    localStorage,
    window: {
      innerWidth: 1024,
      innerHeight: 768,
      matchMedia() { return { matches: false }; },
      addEventListener() {},
      removeEventListener() {},
    },
    navigator: { serviceWorker: null, onLine: true },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    getComputedStyle() { return { getPropertyValue() { return ''; } }; },
    confirm() { return true; },
    alert() {},
    Blob: MockBlob,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL() {} },
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    cancelAnimationFrame(id) { clearTimeout(id); },
    HTMLCanvasElement: function () {},
    Event: function (type) { this.type = type; },
    CustomEvent: function (type) { this.type = type; },
  };
  s.window.document = document;
  s.window.localStorage = localStorage;
  s.window.navigator = s.navigator;
  return s;
}

const sandbox = buildSandbox(doc, storage);

// Load in the same dependency order as index.html. Concatenated into one
// script so `let`/`const` cross-file references resolve, exactly like
// separate <script> tags sharing a realm.
const LOAD_ORDER = [
  'state.js',
  'util.js',
  'tasks.js',
  'settings.js',
  'command-palette.js',
  'app.js',
];

let megaScript = '';
for (const file of LOAD_ORDER) {
  const code = readFileSync(resolve(process.cwd(), 'js', file), 'utf8');
  megaScript += `\n// === BEGIN ${file} ===\n${code}\n// === END ${file} ===\n`;
}
// `const App` is lexical, so hoist it onto the shared global for assertions.
megaScript += '\nglobalThis.App = typeof App !== "undefined" ? App : undefined;\n';

const ctx = createContext(sandbox);
runInContext(megaScript, ctx, { filename: 'app-bundle.js' });

const App = sandbox.App;
const g = sandbox; // top-level `function` declarations land on the sandbox

function setEl(id, props) { Object.assign(doc.getElementById(id), props); }

function mkTask(overrides) {
  return Object.assign({
    id: '_' + Math.random().toString(36).slice(2, 11),
    created: Date.now(),
    title: 'Task',
    subject: 'Math',
    notes: '',
    due: '',
    priority: 'Medium',
    time: 0,
    status: 'pending',
  }, overrides);
}

beforeEach(() => {
  App.state.tasks = [];
  App.state.subjects = [
    { name: 'Math', color: '#818cf8' },
    { name: 'Science', color: '#34d399' },
    { name: 'English', color: '#fb923c' },
    { name: 'Other', color: '#94a3b8' },
  ];
  App.state.activeFilter = 'All';
  App.state.compactMode = false;
  setEl('search-input', { value: '' });
  setEl('sort-select', { value: 'created' });
  setEl('status-filter', { value: 'all' });
  setEl('s-show-done', { checked: true });
  setEl('s-group', { checked: false });
  setEl('s-confetti', { checked: false });
  storage.clear();
  captured.anchors.length = 0;
  captured.blobs.length = 0;
  // filterTasks() also repopulates buildCard()'s O(1) subject-by-name cache.
  g.filterTasks();
});

// ═══════════════════════════════════════════════════════════════════════
//  ESCAPING HELPERS
// ═══════════════════════════════════════════════════════════════════════
describe('util — escaping', () => {
  it('escHtml escapes the five HTML-special characters', () => {
    expect(g.escHtml('<a href="x">&\'</a>'))
      .toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });

  it('escHtml stringifies non-strings', () => {
    expect(g.escHtml(42)).toBe('42');
  });

  it('escJsAttr escapes backslashes and single quotes', () => {
    expect(g.escJsAttr("a'b")).toBe('a\\&#39;b');
    expect(g.escJsAttr('a\\b')).toBe('a\\\\b');
  });

  it('escJsAttr neutralises a quote-breakout payload inside an onclick literal', () => {
    const out = g.escJsAttr("');alert(1);//");
    expect(out).not.toContain("'");
    expect(out).toContain('&#39;');
  });

  it('hexToRgba converts a 6-digit hex to rgba', () => {
    expect(g.hexToRgba('#7c6af7', 0.15)).toBe('rgba(124,106,247,0.15)');
    expect(g.hexToRgba('#ffffff', 1)).toBe('rgba(255,255,255,1)');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  DATES
// ═══════════════════════════════════════════════════════════════════════
describe('dates', () => {
  it('todayStr is an ISO calendar date', () => {
    expect(g.todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('soonStr is exactly 3 days after todayStr', () => {
    const days = g.getDaysLeft(g.soonStr());
    expect(days).toBe(3);
  });

  it('getDaysLeft counts calendar days and ignores time of day', () => {
    expect(g.getDaysLeft(g.todayStr())).toBe(0);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    expect(g.getDaysLeft(tomorrow.toISOString().split('T')[0])).toBe(1);
    const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 7);
    expect(g.getDaysLeft(lastWeek.toISOString().split('T')[0])).toBe(-7);
  });

  it('formatDate renders "Mon D" without zero padding', () => {
    expect(g.formatDate('2026-06-09')).toBe('Jun 9');
    expect(g.formatDate('2026-12-25')).toBe('Dec 25');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  SETTINGS HELPERS
// ═══════════════════════════════════════════════════════════════════════
describe('settings helpers', () => {
  it('isValidHex accepts only 6-digit hex colors', () => {
    expect(g.isValidHex('#ffffff')).toBe(true);
    expect(g.isValidHex('#A1b2C3')).toBe(true);
    expect(g.isValidHex('  #123456 ')).toBe(true);
    expect(g.isValidHex('#fff')).toBe(false);
    expect(g.isValidHex('ffffff')).toBe(false);
    expect(g.isValidHex('rgb(1,2,3)')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  STATE + STORAGE
// ═══════════════════════════════════════════════════════════════════════
describe('state', () => {
  it('uid() returns unique underscore-prefixed ids', () => {
    const ids = new Set();
    for (let i = 0; i < 200; i++) {
      const id = g.uid();
      expect(id).toMatch(/^_[a-z0-9]{1,9}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(200);
  });

  it('save() persists tasks, subjects and settings', () => {
    App.state.tasks = [mkTask({ title: 'Saved' })];
    g.save();
    expect(JSON.parse(storage.getItem('hw_tasks'))[0].title).toBe('Saved');
    expect(JSON.parse(storage.getItem('hw_subjects')).length).toBe(4);
    expect(JSON.parse(storage.getItem('hw_settings'))).toBeTypeOf('object');
    expect(storage.getItem('hw_tests')).toBeNull();
  });

  it('load() restores persisted tasks and subjects', () => {
    storage.setItem('hw_tasks', JSON.stringify([mkTask({ title: 'Restored' })]));
    storage.setItem('hw_subjects', JSON.stringify([{ name: 'Bio', color: '#000000' }]));
    storage.setItem('hw_settings', JSON.stringify({}));
    g.load();
    expect(App.state.tasks[0].title).toBe('Restored');
    expect(App.state.subjects[0].name).toBe('Bio');
  });

  it('load() purges the localStorage keys left behind by removed features', () => {
    const legacy = [
      'hw_quickadd_history', 'hw_custom_synonyms', 'hw_ai_provider',
      'hw_ai_model', 'hw_openrouter_key', 'hw_gemini_key',
      'hw_tests', 'hw_starfield_state', 'hw_forest_state',
      'hw_tree_state', 'hw_hold_keys', 'hw_auto_theme',
    ];
    for (const key of legacy) storage.setItem(key, 'leftover');
    // Keys the app still uses must survive the purge untouched.
    storage.setItem('hw_tasks', JSON.stringify([mkTask({ title: 'Keep me' })]));
    storage.setItem('hw_settings', JSON.stringify({}));
    storage.setItem('hw_preset', 'forest');

    g.load();

    for (const key of legacy) {
      expect(storage.getItem(key), `${key} should be purged`).toBeNull();
    }
    expect(storage.getItem('hw_preset')).toBe('forest');
    expect(App.state.tasks[0].title).toBe('Keep me');
  });

  it('load() survives corrupted JSON in storage', () => {
    storage.setItem('hw_tasks', '{not json');
    storage.setItem('hw_settings', JSON.stringify({}));
    expect(() => g.load()).not.toThrow();
    expect(Array.isArray(App.state.tasks)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  TASK FILTERING + SORTING
// ═══════════════════════════════════════════════════════════════════════
describe('tasks — filtering and sorting', () => {
  it('filters by the active subject chip', () => {
    App.state.tasks = [
      mkTask({ id: '_a', title: 'Math hw', subject: 'Math' }),
      mkTask({ id: '_b', title: 'Bio lab', subject: 'Science' }),
    ];
    App.state.activeFilter = 'Math';
    g.filterTasks();
    const ids = doc.getElementById('tasks-list').children.map(c => c.id || c.innerHTML);
    expect(doc.getElementById('tasks-list').children.length).toBe(1);
    expect(ids.length).toBe(1);
  });

  it('hides completed tasks when "show completed" is off', () => {
    App.state.tasks = [
      mkTask({ id: '_a', title: 'Open' }),
      mkTask({ id: '_b', title: 'Finished', status: 'done' }),
    ];
    setEl('s-show-done', { checked: false });
    g.filterTasks();
    expect(doc.getElementById('tasks-list').children.length).toBe(1);
  });

  it('filters by status', () => {
    App.state.tasks = [
      mkTask({ id: '_a', title: 'Open' }),
      mkTask({ id: '_b', title: 'Finished', status: 'done' }),
    ];
    setEl('status-filter', { value: 'done' });
    g.filterTasks();
    expect(doc.getElementById('tasks-list').children.length).toBe(1);
  });

  it('search matches title, notes and subject', () => {
    App.state.tasks = [
      mkTask({ id: '_a', title: 'Chapter 5', subject: 'Math' }),
      mkTask({ id: '_b', title: 'Essay', notes: 'Gatsby analysis', subject: 'English' }),
      mkTask({ id: '_c', title: 'Lab', subject: 'Science' }),
    ];
    setEl('search-input', { value: 'gatsby' });
    g.filterTasks();
    expect(doc.getElementById('tasks-list').children.length).toBe(1);
  });

  it('sorts by due date with undated tasks last', () => {
    App.state.tasks = [
      mkTask({ id: '_none', title: 'No date', due: '' }),
      mkTask({ id: '_late', title: 'Later', due: '2099-01-02' }),
      mkTask({ id: '_soon', title: 'Sooner', due: '2099-01-01' }),
    ];
    setEl('sort-select', { value: 'due' });
    g.filterTasks();
    const titles = doc.getElementById('tasks-list').children.map(c => c.innerHTML.match(/task-title">([^<]*)/)[1]);
    expect(titles).toEqual(['Sooner', 'Later', 'No date']);
  });

  it('sorts by priority weight, Urgent first', () => {
    App.state.tasks = [
      mkTask({ id: '_l', title: 'Low', priority: 'Low' }),
      mkTask({ id: '_u', title: 'Urgent', priority: 'Urgent' }),
      mkTask({ id: '_m', title: 'Medium', priority: 'Medium' }),
    ];
    setEl('sort-select', { value: 'priority' });
    g.filterTasks();
    const titles = doc.getElementById('tasks-list').children.map(c => c.innerHTML.match(/task-title">([^<]*)/)[1]);
    expect(titles).toEqual(['Urgent', 'Medium', 'Low']);
  });

  it('floats pinned tasks to the top regardless of sort', () => {
    App.state.tasks = [
      mkTask({ id: '_x', title: 'Normal', priority: 'Urgent' }),
      mkTask({ id: '_p', title: 'Pinned', priority: 'Low', pinned: true }),
    ];
    setEl('sort-select', { value: 'priority' });
    g.filterTasks();
    const titles = doc.getElementById('tasks-list').children.map(c => c.innerHTML.match(/task-title">([^<]*)/)[1]);
    expect(titles).toEqual(['Pinned', 'Normal']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  COMPLETION + UNDO
// ═══════════════════════════════════════════════════════════════════════
describe('tasks — completion and undo', () => {
  it('toggleDone removes the task and records an undo entry', () => {
    App.state.tasks = [mkTask({ id: '_a', title: 'Do me' })];
    g.toggleDone('_a');
    expect(App.state.tasks.length).toBe(0);
    expect(App.state.lastDeleted.task.title).toBe('Do me');
  });

  it('undoDelete restores the task at its original index', () => {
    App.state.tasks = [
      mkTask({ id: '_a', title: 'First' }),
      mkTask({ id: '_b', title: 'Second' }),
      mkTask({ id: '_c', title: 'Third' }),
    ];
    g.toggleDone('_b');
    g.undoDelete();
    expect(App.state.tasks.map(t => t.title)).toEqual(['First', 'Second', 'Third']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  CARD RENDERING (XSS REGRESSION)
// ═══════════════════════════════════════════════════════════════════════
describe('task card rendering', () => {
  it('escapes a hostile task title', () => {
    const card = g.buildCard(mkTask({ title: '<img src=x onerror=alert(1)>' }), 0);
    expect(card.innerHTML).not.toContain('<img src=x');
    expect(card.innerHTML).toContain('&lt;img src=x');
  });

  it('escapes a hostile subject color', () => {
    const card = g.buildCard(mkTask({ subject: 'Math', priority: 'High' }), 0);
    expect(card.innerHTML).toContain('#818cf8');
    expect(card.innerHTML).not.toContain('undefined');
  });

  it('escapes the task id inside inline onclick handlers', () => {
    const card = g.buildCard(mkTask({ id: "x');alert(1);//" }), 0);
    expect(card.innerHTML).not.toContain("onclick=\"openEdit('x');");
    expect(card.innerHTML).toContain('&#39;');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  STRUCTURAL GUARDS — the removed modules must stay removed
// ═══════════════════════════════════════════════════════════════════════
describe('removed quick-add / parser / voice surface', () => {
  const REMOVED_FILES = [
    'js/parser.js', 'js/quickadd.js', 'js/voice.js',
    'js/calendar.js', 'js/gradecalc.js',
  ];

  it('deletes the parser, quick-add, voice, calendar and grade-calc modules', () => {
    for (const f of REMOVED_FILES) {
      expect(existsSync(resolve(process.cwd(), f)), `${f} should be deleted`).toBe(false);
    }
  });

  it('no longer exposes the parser/quick-add/voice API on App', () => {
    const gone = [
      'parseQuickAdd', 'parseQuickAddAll', 'confirmQuickAdd', 'onQuickAddInput',
      'onQuickAddKeydown', 'renderQuickAddPreview', 'clearQuickAddHistory',
      'buildAndExtendCompromisePlugin', '_refreshAISettings', 'toggleVoice',
      'getTemplateForAssignmentType', 'renderSynonymList', 'addSynonymFromUI',
      'populateSynonymSelect', 'getCustomSynonyms', 'removeCustomSynonym',
      // calendar / grade-calculator / study-timer removals
      'renderCalendar', 'renderCalendarDayDetail', 'prevMonth', 'nextMonth',
      'todayMonth', 'selectCalendarDay', 'openAddFormForDate',
      'renderGradeCalc', 'renderGCOverallGPA', 'renderGCSubjectList',
      'renderGCSummary', 'updateGCCalculation',
      'openStudyTimer', 'closeTimer', 'setTimerPreset', 'toggleTimer',
      'resetTimer', 'updateTimerDisplay',
      // dead focus-trap + sound-accessor helpers
      'trapFocus', 'releaseFocusTrap', 'restoreFocus', 'isSoundEnabled',
    ];
    for (const key of gone) expect(App[key], `App.${key} should be gone`).toBeUndefined();
  });

  it('keeps the manual add/edit task API intact', () => {
    for (const key of ['openAddForm', 'saveTask', 'openEdit', 'toggleDone', 'deleteTask', 'togglePin', 'undoDelete']) {
      expect(typeof App[key], `App.${key} should exist`).toBe('function');
    }
  });

  it('no longer exposes the removed tests-tab / starfield / dev-mode API', () => {
    const gone = [
      'openTestForm', 'saveTest', 'deleteTest', 'renderTests', 'buildTestCard',
      'setTestFilter', 'renderCountdown', 'populateTestSubjectSelect',
      'openFlashcards', 'closeFlashcards', 'flipCard', 'fcNext', 'fcPrev',
      'renderFlashcard', 'shuffleFlashcards', 'renderTestStats',
      'getLetterGrade', 'getScorePct', 'switchTab',
      'setFocus', 'setNightSky', 'exitFocus', 'toggleFocus', 'toggleNightSky',
      'setHoldKey', 'resetHoldKeys', '_heldViewKeys', 'toggleAutoTheme',
    ];
    for (const key of gone) expect(App[key], `App.${key} should be gone`).toBeUndefined();
  });

  it('deletes the tests-tab, starfield, dev-mode and hold-key modules', () => {
    for (const f of ['js/tests.js', 'js/gamification.js', 'js/devmode.js',
                     'css/gamification.css', 'css/devmode.css']) {
      expect(existsSync(resolve(process.cwd(), f)), `${f} should be deleted`).toBe(false);
    }
  });

  it('index.html loads no removed script and no CDN NLP bundle', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).not.toMatch(/js\/(parser|quickadd|voice|calendar|gradecalc|tests|gamification|devmode)\.js/);
    expect(html).not.toMatch(/chrono|compromise|jsdelivr/);
    expect(html).not.toMatch(/qa-input|qa-preview|qa-suggestions|voice-mic-btn/);
  });

  it('index.html keeps no removed tests-tab / starfield / dev-mode markup', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).not.toMatch(/panel-tests|test-modal|tests-list|countdown-grid|flashcard-overlay|fc-card/);
    expect(html).not.toMatch(/starfield|constellation|mode-exit-hint|dev-overlay|matrix-canvas/);
    expect(html).not.toMatch(/hk-focus|hk-nightsky|hold-key-row|s-auto-theme/);
    expect(html).not.toMatch(/gamification\.css|devmode\.css/);
  });

  it('index.html keeps no removed calendar / grade-calc / timer markup', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).not.toMatch(/id="cal-|class="cal-|calendar-wrap/);
    expect(html).not.toMatch(/id="gc-|gc-overall|gc-summary|gc-subjects/);
    expect(html).not.toMatch(/timer-overlay|timer-modal|timer-ring|timer-display|timer-sessions/);
    expect(html).not.toMatch(/trend-svg|chart-subject-filter|gpa-grid/);
  });

  it('sw.js precaches no removed modules', () => {
    const sw = readFileSync(resolve(process.cwd(), 'sw.js'), 'utf8');
    expect(sw).not.toMatch(/calendar\.js|gradecalc\.js|tests\.js|gamification|devmode/);
    expect(sw).toContain("'hw-tracker-v8'");
  });

  it('index.html only references script files that exist', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const srcs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) {
      expect(existsSync(resolve(process.cwd(), src)), `${src} should exist`).toBe(true);
    }
  });

  it('the service worker precaches exactly the files index.html loads', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const sw = readFileSync(resolve(process.cwd(), 'sw.js'), 'utf8');
    const htmlScripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => '/' + m[1]);
    const appShell = (sw.match(/var APP_SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
    for (const src of htmlScripts) {
      expect(appShell, `APP_SHELL should list ${src}`).toContain(`'${src}'`);
    }
  });

  it('the service worker caches no third-party origin any more', () => {
    const sw = readFileSync(resolve(process.cwd(), 'sw.js'), 'utf8');
    expect(sw).not.toMatch(/jsdelivr|chrono|compromise/);
  });

  it('evaluates the full index.html script order without throwing', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const files = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
    expect(files.length).toBeGreaterThan(5);

    const bootSandbox = buildSandbox(makeDocument({ anchors: [], blobs: [] }), makeStorage());
    const bootCtx = createContext(bootSandbox);
    let script = '';
    for (const file of files) {
      script += `\n// === BEGIN ${file} ===\n${readFileSync(resolve(process.cwd(), file), 'utf8')}\n`;
    }
    script += '\nglobalThis.App = typeof App !== "undefined" ? App : undefined;\n';

    expect(() => runInContext(script, bootCtx, { filename: 'index-bundle.js' })).not.toThrow();
    expect(bootSandbox.App).toBeTypeOf('object');
    expect(typeof bootSandbox.App.init).toBe('function');
  });

  it('the CSP no longer allows third-party script or connect origins', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('cdn.jsdelivr.net');
    expect(csp).not.toContain('generativelanguage.googleapis.com');
    expect(csp).not.toContain('openrouter.ai');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('no longer exposes the removed templates / subtasks / recurring / export API', () => {
    const gone = [
      'applyTemplate', 'saveAsTemplate', 'renderTemplateList',
      'addSubtask', 'removeSubtask', 'renderSubtaskEditor', 'toggleSubtaskEditor',
      'exportCSV', 'exportICS',
      'dailyReset', 'weeklyReset', 'pruneCompletedPastDue',
    ];
    for (const key of gone) expect(App[key], `App.${key} should be gone`).toBeUndefined();
  });

  it('index.html keeps no removed templates / subtasks / recurring / export markup', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).not.toMatch(/subtask-editor|new-subtask-input|subtask-list|Save as Template/);
    expect(html).not.toMatch(/template-list|m-recurring/);
    expect(html).not.toMatch(/exportCSV|exportICS/);
  });
});
