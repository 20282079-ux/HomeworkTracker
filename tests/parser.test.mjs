// tests/parser.test.mjs — Comprehensive Vitest test suite for the NLP parser
// Tests App.parseQuickAdd() across all parsing dimensions:
//   subject detection, date parsing, time extraction, priority, assignment types,
//   entities, action verbs, intent scoring, multi-intent splitting, edge cases.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as chrono from 'chrono-node';
import nlp from 'compromise';

// ── Browser polyfills for the VM sandbox ──────────────────────────────
function makeMockDocument() {
  const elements = {};
  const doc = {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = {
          id,
          classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
          style: {},
          value: '',
          checked: false,
          innerText: id === 'app-title' ? 'Homework Tracker' : '',
          innerHTML: '',
          textContent: '',
          setAttribute() {},
          getAttribute() {},
          addEventListener() {},
          removeEventListener() {},
          querySelector() { return null; },
          querySelectorAll() { return []; },
          appendChild() {},
          focus() {},
          closest() { return null; },
          matches() { return false; },
        };
      }
      return elements[id];
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        style: {},
        value: '',
        checked: false,
        innerText: '',
        innerHTML: '',
        textContent: '',
        setAttribute() {},
        getAttribute() {},
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        appendChild() {},
        focus() {},
        select() {},
        closest() { return null; },
        matches() { return false; },
      };
    },
    documentElement: {
      style: { setProperty() {}, getPropertyValue() { return ''; } },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    },
    body: {
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      style: {},
      appendChild() {},
      removeChild() {},
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
  };
  return doc;
}

function makeMockLocalStorage() {
  const store = {};
  return {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
  };
}

function makeMockWindow() {
  return {
    innerWidth: 1024,
    innerHeight: 768,
    matchMedia() { return { matches: false }; },
    addEventListener() {},
    removeEventListener() {},
    AudioContext: null,
    webkitAudioContext: null,
    requestAnimationFrame(fn) { setTimeout(fn, 0); return 1; },
    cancelAnimationFrame() {},
    navigator: { serviceWorker: null },
    location: { origin: 'http://localhost' },
  };
}

// ── Global setup — run once before all tests ───────────────────────────
let parserApp = null;

beforeAll(() => {
  // Build the VM sandbox with all browser globals
  const sandbox = {
    document: makeMockDocument(),
    localStorage: makeMockLocalStorage(),
    window: makeMockWindow(),
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
    // NLP libraries (loaded as globals like the browser CDN does)
    chrono,
    nlp,
    // Canvas mock
    HTMLCanvasElement: function() {},
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    cancelAnimationFrame(id) { clearTimeout(id); },
  };

  // Link window → sandbox circular refs
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.document.documentElement.style.getPropertyValue = function(v) {
    // Return sensible defaults for CSS variable lookups
    const defaults = {
      '--bg': '#0e0f1a', '--bg2': '#13141f', '--bg3': '#1a1b2e',
      '--surface': '#1e2035', '--surface2': '#252740', '--border': '#2a2d4a',
      '--text': '#e8eaf6', '--text2': '#8b90c1', '--text3': '#4a4f7a',
      '--accent': '#7c6af7', '--accent2': '#a78bfa',
      '--accent-glow': 'rgba(124,106,247,0.18)', '--radius': '14px',
    };
    return defaults[v] || '';
  };

  const ctx = createContext(sandbox);

  // Load source files in dependency order (same as index.html <script> order).
  // CRITICAL: We concatenate ALL files into a single script before running in
  // the VM.  Node's vm.runInContext isolates let/const between separate calls,
  // which would break cross-file references (e.g. app.js reading `tasks` from
  // state.js).  Concatenating mirrors browser behaviour where all <script>
  // tags share the same realm.
  const jsDir = resolve(process.cwd(), 'js');
  const loadOrder = [
    'state.js',
    'util.js',
    'quickadd.js',
    'tasks.js',
    'tests.js',
    'settings.js',
    'command-palette.js',
    'gamification.js',
    'devmode.js',
    'parser.js',
    'calendar.js',
    'gradecalc.js',
    'app.js',
  ];

  // Build the mega‑script: each file wrapped in its own block to avoid
  // top-level return / strict-mode issues, then capture const exports.
  let megaScript = '';
  for (const file of loadOrder) {
    const code = readFileSync(resolve(jsDir, file), 'utf8');
    megaScript += `\n// === BEGIN ${file} ===\n${code}\n// === END ${file} ===\n`;
  }

  // After all source files, capture const-declared exports onto globalThis
  // (which IS the sandbox object inside the VM).
  megaScript += '\nglobalThis.App = typeof App !== "undefined" ? App : undefined;\n';

  runInContext(megaScript, ctx, { filename: 'mega-script.js' });

  // Access the now-initialized App object from the sandbox
  parserApp = sandbox.App;

  // Verify the parser is accessible
  if (!parserApp || typeof parserApp.parseQuickAdd !== 'function') {
    throw new Error('App.parseQuickAdd not found after loading source files');
  }

  // Register the compromise.js custom plugin so #Course and #AssignmentType
  // tags are available for NLP extraction (called by App.init in production).
  if (typeof sandbox.buildAndExtendCompromisePlugin === 'function') {
    sandbox.buildAndExtendCompromisePlugin();
  }
});

// ── Helper: run the parser and return a cleaned result ─────────────────
function parse(raw) {
  const result = parserApp.parseQuickAdd(raw);
  if (!result) return null;
  return {
    title: result.title,
    subject: result.subject,
    due: result.due,
    time: result.time,
    priority: result.priority,
    status: result.status,
    assignmentType: result.assignmentType,
    actionVerb: result.actionVerb,
    isTestLike: result.isTestLike,
    isProjectLike: result.isProjectLike,
    intentScores: result.intentScores,
    entities: result.entities,
    entityResolution: result.entityResolution,
    confidence: result.confidence,
  };
}

// ── Reset subjects before each test to avoid state pollution ────────────
beforeEach(() => {
  // Reset to default subjects
  parserApp.state.subjects = [
    { name: 'Math',    color: '#818cf8' },
    { name: 'Science', color: '#34d399' },
    { name: 'English', color: '#fb923c' },
    { name: 'History', color: '#f472b6' },
    { name: 'Art',     color: '#a78bfa' },
    { name: 'PE',      color: '#38bdf8' },
    { name: 'Other',   color: '#94a3b8' },
  ];
  // Reset tasks for entity resolution
  parserApp.state.tasks = [];
  // Reset tests
  parserApp.state.tests = [];
});

// ═══════════════════════════════════════════════════════════════════════
//  TEST SUITE
// ═══════════════════════════════════════════════════════════════════════

describe('parseQuickAdd — Subject Detection', () => {
  it('detects exact subject match', () => {
    expect(parse('math homework').subject).toBe('Math');
    expect(parse('science lab report').subject).toBe('Science');
    expect(parse('english essay').subject).toBe('English');
  });

  it('detects subject as first word of multi-word input', () => {
    const r = parse('history read chapter 5');
    expect(r.subject).toBe('History');
  });

  it('falls back to first subject (Math) when no subject is detected', () => {
    const r = parse('do the thing');
    expect(r.subject).toBe('Math'); // default fallback
    expect(r.confidence.subject).toBeLessThan(0.6);
  });

  it('detects subject via course synonym (bio → Science)', () => {
    const r = parse('bio homework');
    // "bio" maps to Science via COURSE_CATEGORIES
    expect(r.subject).toBe('Science');
  });

  it('detects subject via synonym (algebra → Math)', () => {
    const r = parse('algebra problem set');
    expect(r.subject).toBe('Math');
  });

  it('detects subject via synonym (calc → Math)', () => {
    const r = parse('calc homework due tomorrow');
    expect(r.subject).toBe('Math');
  });
});

describe('parseQuickAdd — Date Parsing', () => {
  it('parses "tomorrow" as a due date', () => {
    const r = parse('math homework due tomorrow');
    expect(r.due).toBeTruthy();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(r.due).toBe(tomorrow.toISOString().split('T')[0]);
  });

  it('parses "today" as a due date', () => {
    const r = parse('math homework due today');
    expect(r.due).toBe(new Date().toISOString().split('T')[0]);
  });

  it('parses "end of week" as this Friday', () => {
    const r = parse('math homework due end of week');
    expect(r.due).toBeTruthy();
    const eow = new Date();
    eow.setDate(eow.getDate() + ((5 - eow.getDay() + 7) % 7));
    expect(r.due).toBe(eow.toISOString().split('T')[0]);
  });

  it('parses "next week" via chrono', () => {
    const r = parse('math homework due next week');
    // chrono should resolve this to a date
    expect(r.due).toBeTruthy();
  });

  it('parses a specific date like "friday" via chrono', () => {
    const r = parse('math homework due friday');
    expect(r.due).toBeTruthy();
    // chrono resolves "friday" to the nearest future Friday.
    // The exact day depends on today + the post-processing push-forward
    // logic for past weekdays. Just verify we got a valid ISO date.
    const d = new Date(r.due);
    expect(d.getTime()).toBeGreaterThan(Date.now() - 86400000); // not in the past
    expect(/^\d{4}-\d{2}-\d{2}$/.test(r.due)).toBe(true);
  });

  it('handles "in 3 days" via chrono', () => {
    const r = parse('math homework due in 3 days');
    expect(r.due).toBeTruthy();
  });

  it('parses shorthand "tmrw" as tomorrow', () => {
    const r = parse('math homework due tmrw');
    expect(r.due).toBeTruthy();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(r.due).toBe(tomorrow.toISOString().split('T')[0]);
  });

  it('returns empty due for inputs without a date', () => {
    const r = parse('math homework');
    expect(r.due).toBe('');
  });

  it('parses "end of wk" shorthand as end of week', () => {
    const r = parse('math homework due end of wk');
    expect(r.due).toBeTruthy();
    const eow = new Date();
    eow.setDate(eow.getDate() + ((5 - eow.getDay() + 7) % 7));
    expect(r.due).toBe(eow.toISOString().split('T')[0]);
  });
});

describe('parseQuickAdd — Time Extraction', () => {
  it('extracts minutes: "30m"', () => {
    const r = parse('math homework 30m');
    expect(r.time).toBe(30);
    expect(r.confidence.time).toBeGreaterThanOrEqual(0.85);
  });

  it('extracts minutes: "45 min"', () => {
    const r = parse('science lab 45 min');
    expect(r.time).toBe(45);
  });

  it('extracts hours: "2h"', () => {
    const r = parse('english essay 2h');
    expect(r.time).toBe(120); // 2 * 60
  });

  it('extracts hours: "1 hour" (also covers regex fallback)', () => {
    const r = parse('history project 1 hour');
    expect(r.time).toBe(60);
  });

  it('extracts combined hours+minutes: "1h 30m"', () => {
    const r = parse('math homework 1h 30m');
    expect(r.time).toBe(90);
  });

  it('returns 0 for inputs without time', () => {
    const r = parse('math homework');
    expect(r.time).toBe(0);
    expect(r.confidence.time).toBeLessThan(0.5);
  });
});

describe('parseQuickAdd — Priority Detection', () => {
  it('detects "high" priority', () => {
    const r = parse('math homework high');
    expect(r.priority).toBe('High');
  });

  it('detects "urgent" priority', () => {
    const r = parse('math homework urgent');
    expect(r.priority).toBe('Urgent');
  });

  it('detects "low" priority', () => {
    const r = parse('math homework low');
    expect(r.priority).toBe('Low');
  });

  it('detects "asap" as Urgent', () => {
    const r = parse('math homework asap');
    expect(r.priority).toBe('Urgent');
  });

  it('defaults to Medium when no priority specified', () => {
    const r = parse('math homework');
    expect(r.priority).toBe('Medium');
    expect(r.confidence.priority).toBe(0.7); // confident default
  });
});

describe('parseQuickAdd — Assignment Type Detection', () => {
  it('detects "homework" type', () => {
    const r = parse('math homework');
    expect(r.assignmentType).toBe('homework');
  });

  it('detects "essay" type', () => {
    const r = parse('english essay');
    expect(r.assignmentType).toBe('essay');
  });

  it('detects "lab report" type', () => {
    const r = parse('science lab report');
    expect(r.assignmentType).toBe('lab report');
  });

  it('detects "project" type', () => {
    const r = parse('history project');
    expect(r.assignmentType).toBe('project');
    expect(r.isProjectLike).toBe(true);
  });

  it('detects "quiz" type', () => {
    const r = parse('math quiz');
    expect(r.assignmentType).toBe('quiz');
  });

  it('detects shorthand "hw" as homework', () => {
    const r = parse('math hw');
    expect(r.assignmentType).toBe('homework');
  });

  it('detects "reading" type', () => {
    const r = parse('history reading');
    expect(r.assignmentType).toBe('reading');
  });
});

describe('parseQuickAdd — Entity Extraction (Tier 2)', () => {
  it('extracts chapter numbers', () => {
    const r = parse('math homework chapter 5');
    expect(r.entities.chapters).toContain('5');
  });

  it('extracts chapter numbers with shorthand "ch"', () => {
    const r = parse('science ch 3');
    expect(r.entities.chapters).toContain('3');
  });

  it('extracts page ranges', () => {
    const r = parse('english reading pp 45-67');
    expect(r.entities.pages).toContain('45-67');
  });

  it('extracts URLs', () => {
    const r = parse('math homework https://example.com/assignment');
    expect(r.entities.urls.length).toBeGreaterThan(0);
    expect(r.entities.urls[0]).toContain('example.com');
  });

  it('extracts person names with honorific', () => {
    const r = parse('math homework with Mr. Kim');
    expect(r.entities.people.length).toBeGreaterThan(0);
  });

  it('extracts quoted entities', () => {
    const r = parse('english essay on "The Great Gatsby"');
    expect(r.entities.quoted.length).toBeGreaterThan(0);
  });
});

describe('parseQuickAdd — Action Verb Capture', () => {
  it('captures "study" as action verb', () => {
    const r = parse('study math');
    expect(r.actionVerb).toBe('study');
  });

  it('captures "review" as action verb', () => {
    const r = parse('review history chapter 4');
    expect(r.actionVerb).toBe('review');
  });

  it('captures "read" as action verb', () => {
    const r = parse('read bio ch 5');
    expect(r.actionVerb).toBe('read');
  });

  it('returns null when no action verb is present', () => {
    const r = parse('math homework chapter 5');
    expect(r.actionVerb).toBeNull();
  });
});

describe('parseQuickAdd — Intent Scoring', () => {
  it('scores test intent high for "exam" keyword', () => {
    const r = parse('math final exam');
    expect(r.intentScores.test).toBeGreaterThanOrEqual(5);
  });

  it('scores test intent for "test" keyword', () => {
    const r = parse('science test friday');
    expect(r.intentScores.test).toBeGreaterThanOrEqual(4);
  });

  it('scores study intent for "study" keyword', () => {
    const r = parse('study math');
    expect(r.intentScores.study).toBeGreaterThanOrEqual(3);
  });

  it('scores task intent for "homework" keyword', () => {
    const r = parse('math homework');
    expect(r.intentScores.task).toBeGreaterThanOrEqual(3);
  });

  it('sets isTestLike when test intent dominates', () => {
    const r = parse('math exam friday');
    expect(r.isTestLike).toBe(true);
  });

  it('does not set isTestLike for regular homework', () => {
    const r = parse('math homework');
    expect(r.isTestLike).toBe(false);
  });
});

describe('parseQuickAdd — Title Generation', () => {
  it('generates title from remaining text after extraction', () => {
    const r = parse('math homework chapter 5');
    expect(r.title).toBeTruthy();
  });

  it('prefixes title with action verb when present', () => {
    const r = parse('study math chapter 5');
    expect(r.title).toMatch(/^study/);
  });

  it('falls back to raw input when all content is stripped', () => {
    const r = parse('math');
    expect(r.title).toBeTruthy();
  });
});

describe('parseQuickAdd — Entity Resolution (Tier 3)', () => {
  it('matches existing tasks with same subject and similar title', () => {
    parserApp.state.tasks = [
      { id: 't1', title: 'Chapter 5 Problem Set', subject: 'Math', notes: '', due: '' },
    ];
    const r = parse('math problem set');
    expect(r.entityResolution.length).toBeGreaterThan(0);
    expect(r.entityResolution[0].taskId).toBe('t1');
  });

  it('returns empty resolution when no tasks exist', () => {
    parserApp.state.tasks = [];
    const r = parse('math homework');
    expect(r.entityResolution).toEqual([]);
  });
});

describe('parseQuickAdd — Edge Cases', () => {
  it('returns null for empty input', () => {
    expect(parse('')).toBeNull();
    expect(parse('   ')).toBeNull();
    expect(parse(null)).toBeNull();
  });

  it('handles input with only priority keyword', () => {
    const r = parse('urgent');
    expect(r).toBeTruthy();
    expect(r.priority).toBe('Urgent');
  });

  it('handles very long input', () => {
    const r = parse('math homework chapter 5 problems 1 through 30 due friday 45 min high priority');
    expect(r).toBeTruthy();
    expect(r.subject).toBe('Math');
    expect(r.assignmentType).toBe('homework');
  });

  it('handles input with special characters', () => {
    const r = parse('math homework: problem set #3');
    expect(r).toBeTruthy();
    expect(r.subject).toBe('Math');
  });
});

describe('parseQuickAdd — Multi-Intent Splitting (Tier 4)', () => {
  it('splits on "and" in parseQuickAddAll', () => {
    const results = parserApp.parseQuickAddAll('math homework and science lab');
    expect(results.length).toBe(2);
    expect(results[0].subject).toBe('Math');
    expect(results[1].subject).toBe('Science');
  });

  it('splits on comma in parseQuickAddAll', () => {
    const results = parserApp.parseQuickAddAll('math homework, science lab');
    expect(results.length).toBe(2);
  });
});

describe('parseQuickAdd — Confidence Scores', () => {
  it('gives high confidence for exact subject match', () => {
    const r = parse('math homework');
    expect(r.confidence.subject).toBeGreaterThanOrEqual(0.85);
  });

  it('gives high confidence for chrono-detected dates', () => {
    const r = parse('math homework due friday');
    expect(r.confidence.due).toBeGreaterThanOrEqual(0.9);
  });

  it('gives high confidence for explicit time units', () => {
    const r = parse('math homework 30m');
    expect(r.confidence.time).toBeGreaterThanOrEqual(0.85);
  });

  it('gives low confidence for default fallback values', () => {
    const r = parse('do the thing');
    expect(r.confidence.subject).toBeLessThan(0.6);
  });
});

describe('parseQuickAdd — Date Synonyms', () => {
  it('normalizes "end of wk" to "end of week"', () => {
    const r = parse('math homework end of wk');
    expect(r.due).toBeTruthy();
  });

  it('normalizes "next wk" to "next week"', () => {
    const r = parse('math homework due next wk');
    expect(r.due).toBeTruthy();
  });
});

describe('parseQuickAdd — Fuzzy Subject Matching', () => {
  it('matches "Meth" (typo of Math)', () => {
    // With default subjects, "Meth" should fuzzy match "Math"
    const r = parse('meth homework');
    // Fuzzy match with distance 1 should match "Math"
    expect(r.subject).toBe('Math');
  });

  it('matches "Sciense" (typo of Science)', () => {
    const r = parse('sciense lab');
    expect(r.subject).toBe('Science');
  });
});

describe('parseQuickAdd — AP/Honors Prefix Stripping', () => {
  it('recognizes "lang" as English via synonym (without AP prefix)', () => {
    const r = parse('lang homework due friday');
    expect(r.subject).toBe('English');
    expect(r.title).not.toMatch(/\blang\b/i); // synonym stripped from title
  });

  it('strips "ap " prefix and matches "lang" → English', () => {
    const r = parse('ap lang homework due friday');
    expect(r.subject).toBe('English');
    expect(r.title).not.toMatch(/\bap\b/i);  // prefix not in title
    expect(r.title).not.toMatch(/\blang\b/i); // synonym stripped from title
  });

  it('strips "Honors " prefix and matches underlying synonym', () => {
    const r = parse('honors english essay due tomorrow');
    expect(r.subject).toBe('English');
    expect(r.title).not.toMatch(/\bhonors\b/i); // prefix not in title
  });

  it('recognizes "euro" as History via synonym', () => {
    const r = parse('euro study guide');
    expect(r.subject).toBe('History');
    expect(r.title).not.toMatch(/\beuro\b/i); // synonym stripped from title
  });

  it('recognizes "ap euro" as History via prefix stripping', () => {
    const r = parse('ap euro exam friday');
    expect(r.subject).toBe('History');
    expect(r.title).not.toMatch(/\bap\b/i);   // prefix not in title
    expect(r.title).not.toMatch(/\beuro\b/i); // synonym stripped from title
  });

  it('recognizes "compsci" as CS via synonym (with CS subject added)', () => {
    parserApp.state.subjects = [
      { name: 'Math',    color: '#818cf8' },
      { name: 'Science', color: '#34d399' },
      { name: 'English', color: '#fb923c' },
      { name: 'History', color: '#f472b6' },
      { name: 'Computer Science', color: '#38bdf8' },
      { name: 'Art',     color: '#a78bfa' },
      { name: 'Other',   color: '#94a3b8' },
    ];
    const r = parse('compsci homework');
    expect(r.subject).toBe('Computer Science');
    expect(r.title).not.toMatch(/\bcompsci\b/i);
  });

  it('recognizes "world" as History via synonym (world history)', () => {
    const r = parse('world reading chapter 3');
    expect(r.subject).toBe('History');
    expect(r.title).not.toMatch(/\bworld\b/i);
  });

  it('handles "honor" (singular) prefix stripping too', () => {
    const r = parse('honor english essay');
    expect(r.subject).toBe('English');
    expect(r.title).not.toMatch(/\bhonor\b/i);
  });
});

describe('parseQuickAdd — AP Subject Variants', () => {
  it('recognizes "ap calc" via multi-word synonym matching', () => {
    const r = parse('ap calc homework');
    // "ap calc" → "calc" in math category → Math
    expect(r.subject).toBe('Math');
  });

  it('recognizes "ap bio" as Science', () => {
    const r = parse('ap bio lab report');
    expect(r.subject).toBe('Science');
  });

  it('recognizes "ap chem" as Science', () => {
    const r = parse('ap chem homework');
    expect(r.subject).toBe('Science');
  });

  it('recognizes "ap psych" as Sociology via synonym (with Sociology subject)', () => {
    parserApp.state.subjects = [
      { name: 'Math',    color: '#818cf8' },
      { name: 'Science', color: '#34d399' },
      { name: 'English', color: '#fb923c' },
      { name: 'History', color: '#f472b6' },
      { name: 'Sociology', color: '#a78bfa' },
      { name: 'Art',     color: '#38bdf8' },
      { name: 'Other',   color: '#94a3b8' },
    ];
    const r = parse('ap psych study guide');
    expect(r.subject).toBe('Sociology');
  });

  it('recognizes "ap gov" as History', () => {
    const r = parse('ap gov essay');
    expect(r.subject).toBe('History');
  });

  it('recognizes "ap spanish" with a language subject present', () => {
    parserApp.state.subjects = [
      { name: 'Math',    color: '#818cf8' },
      { name: 'Science', color: '#34d399' },
      { name: 'English', color: '#fb923c' },
      { name: 'History', color: '#f472b6' },
      { name: 'Spanish', color: '#38bdf8' },
      { name: 'Art',     color: '#a78bfa' },
      { name: 'Other',   color: '#94a3b8' },
    ];
    const r = parse('ap spanish homework');
    expect(r.subject).toBe('Spanish');
  });
});

describe('parseQuickAdd — Student Slang & Shorthands', () => {
  it('recognizes "hw" as homework assignment type', () => {
    const r = parse('math hw ch 5');
    expect(r.assignmentType).toBe('homework');
  });

  it('recognizes "asap" as Urgent priority', () => {
    const r = parse('math homework asap');
    expect(r.priority).toBe('Urgent');
  });

  it('recognizes "tmrw" as tomorrow date', () => {
    const r = parse('math homework due tmrw');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(r.due).toBe(tomorrow.toISOString().split('T')[0]);
  });

  it('recognizes "eng" as English', () => {
    const r = parse('eng essay');
    expect(r.subject).toBe('English');
  });

  it('recognizes "stats" as Math', () => {
    const r = parse('stats homework due friday');
    expect(r.subject).toBe('Math');
  });
});

describe('parseQuickAdd — Typo Tolerance', () => {
  it('tolerates "biolgy" → Science via category typos', () => {
    const r = parse('biolgy homework');
    expect(r.subject).toBe('Science');
  });

  it('tolerates "algerba" → Math via category typos', () => {
    const r = parse('algerba problem set');
    expect(r.subject).toBe('Math');
  });

  it('tolerates "clac" → Math via category typos', () => {
    const r = parse('clac homework');
    expect(r.subject).toBe('Math');
  });

  it('tolerates "langauge" → English via category typos', () => {
    const r = parse('langauge essay');
    expect(r.subject).toBe('English');
  });
});

describe('parseQuickAdd — Economics & Social Science', () => {
  it('recognizes "econ" as History', () => {
    const r = parse('econ homework');
    expect(r.subject).toBe('History');
  });

  it('recognizes "economics" as History', () => {
    const r = parse('economics study guide');
    expect(r.subject).toBe('History');
  });

  it('recognizes "macro" as History', () => {
    const r = parse('macro homework');
    expect(r.subject).toBe('History');
  });
});

describe('parseQuickAdd — Art & Music Variants', () => {
  it('recognizes "band" as Art', () => {
    const r = parse('band practice');
    expect(r.subject).toBe('Art');
  });

  it('recognizes "orchestra" as Art', () => {
    const r = parse('orchestra rehearsal');
    expect(r.subject).toBe('Art');
  });

  it('recognizes "choir" as Art', () => {
    const r = parse('choir concert prep');
    expect(r.subject).toBe('Art');
  });

  it('recognizes "ceramics" as Art', () => {
    const r = parse('ceramics project');
    expect(r.subject).toBe('Art');
  });
});

describe('parseQuickAdd — Science Variants', () => {
  it('recognizes "anatomy" as Science', () => {
    const r = parse('anatomy study guide');
    expect(r.subject).toBe('Science');
  });

  it('recognizes "astronomy" as Science', () => {
    const r = parse('astronomy homework');
    expect(r.subject).toBe('Science');
  });
});
