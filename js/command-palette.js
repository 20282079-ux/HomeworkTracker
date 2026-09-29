// command-palette.js — Ctrl+K / Cmd+K command palette with fuzzy search
// Registers all app actions, renders a searchable overlay, and supports
// keyboard navigation (↑↓ to move, ↵ to select, Esc to close).
//
// IMPORTANT: This file MUST load BEFORE app.js so its document-level
// keydown listener registers first. The palette uses stopImmediatePropagation()
// to prevent app.js's Esc handler from also firing when the palette is open.
// If you reorder the script tags in index.html, Esc inside the palette will
// close both the palette AND trigger _closeAllSoft (undesirable).

var COMMANDS = [
  // ── Tasks ──
  { id: 'add-task',    label: 'Add Task',              category: 'Tasks',      icon: '＋', shortcut: 'N', action: function() { App.openAddForm(); } },
  { id: 'search-tasks',label: 'Search Tasks',          category: 'Tasks',      icon: '🔍', shortcut: '',  action: function() { setTimeout(function() { var s = document.getElementById('search-input'); if (s) s.focus(); }, 50); } },

  // ── View ──
  { id: 'toggle-compact', label: 'Toggle Compact View', category: 'View',     icon: '⊟', shortcut: '',  action: function() { App.toggleCompact(); } },
  { id: 'open-settings',  label: 'Open Settings',       category: 'App',       icon: '⚙', shortcut: '',  action: function() { App.openSettings(); } },

  // ── Data ──
  { id: 'clear-all',      label: 'Clear All Tasks',         category: 'Data',  icon: '🗑', shortcut: '', action: function() { App.clearAllTasks(); } },

  // ── Themes ──
  { id: 'theme-midnight', label: 'Theme: Midnight', category: 'Theme', icon: '🌙', shortcut: '', action: function() { App.applyPreset('midnight'); } },
  { id: 'theme-forest',   label: 'Theme: Forest',   category: 'Theme', icon: '🌿', shortcut: '', action: function() { App.applyPreset('forest'); } },
  { id: 'theme-ocean',    label: 'Theme: Ocean',    category: 'Theme', icon: '🌊', shortcut: '', action: function() { App.applyPreset('ocean'); } },
  { id: 'theme-sunset',   label: 'Theme: Sunset',   category: 'Theme', icon: '🌅', shortcut: '', action: function() { App.applyPreset('sunset'); } },
  { id: 'theme-rose',     label: 'Theme: Rose',     category: 'Theme', icon: '🌸', shortcut: '', action: function() { App.applyPreset('rose'); } },
  { id: 'theme-light',    label: 'Theme: Light',    category: 'Theme', icon: '☀️', shortcut: '', action: function() { App.applyPreset('light'); } },
  { id: 'theme-coffee',   label: 'Theme: Coffee',   category: 'Theme', icon: '☕', shortcut: '', action: function() { App.applyPreset('coffee'); } },

  // ── Help ──
  { id: 'shortcuts',      label: 'Keyboard Shortcuts', category: 'Help',      icon: '⌨',   shortcut: '', action: function() { App.showKeybindsHelp(); } },
];

// ── State ──
var cmdActiveIndex = 0;
var cmdFiltered = [];

// ── Highlight matching text in a label ──
function cmdHighlight(text, query) {
  if (!query) return escHtml(text);
  var lower = text.toLowerCase();
  var q = query.toLowerCase();
  var idx = lower.indexOf(q);
  if (idx < 0) return escHtml(text);
  var before = escHtml(text.slice(0, idx));
  var match = escHtml(text.slice(idx, idx + q.length));
  var after = escHtml(text.slice(idx + q.length));
  return before + '<mark>' + match + '</mark>' + after;
}

// ── Fuzzy score: higher = better match ──
function cmdFuzzyScore(text, query) {
  if (!query) return 1;
  var t = text.toLowerCase();
  var q = query.toLowerCase();
  if (t === q) return 2;                        // exact match
  if (t.indexOf(q) === 0) return 1.8;           // starts with
  if (t.indexOf(q) >= 0) return 1.5;            // contains
  // Simple character-by-character match (subsequence scoring)
  var qi = 0, score = 0;
  for (var i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { score += 1; qi++; }
  }
  if (qi === q.length) return score / t.length; // all chars matched in order
  return 0;                                      // no match
}

// ── Filter commands by query ──
function cmdFilter(query) {
  if (!query) return COMMANDS.slice();
  var scored = [];
  for (var i = 0; i < COMMANDS.length; i++) {
    var s = cmdFuzzyScore(COMMANDS[i].label, query);
    // Also search category
    var cs = cmdFuzzyScore(COMMANDS[i].category, query);
    var best = Math.max(s, cs);
    if (best > 0) scored.push({ cmd: COMMANDS[i], score: best });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.map(function(x) { return x.cmd; });
}

// ── Render results ──
function cmdRender(query) {
  var container = document.getElementById('cmd-palette-results');
  if (!container) return;
  cmdFiltered = cmdFilter(query);
  if (!cmdFiltered.length) {
    container.innerHTML = '<div class="cmd-palette-empty">No matching commands</div>';
    container.removeAttribute('aria-activedescendant');
    return;
  }
  var html = '';
  var activeId = '';
  for (var i = 0; i < cmdFiltered.length; i++) {
    var c = cmdFiltered[i];
    var itemId = 'cmd-item-' + i;
    var activeCls = i === cmdActiveIndex ? ' active' : '';
    if (i === cmdActiveIndex) activeId = itemId;
    var shortcutHtml = c.shortcut ? '<span class="cmd-palette-item-shortcut">' + escHtml(c.shortcut) + '</span>' : '';
    html += '<div id="' + itemId + '" class="cmd-palette-item' + activeCls + '" data-index="' + i + '" role="option" aria-selected="' + (i === cmdActiveIndex ? 'true' : 'false') + '">' +
      '<span class="cmd-palette-item-icon">' + c.icon + '</span>' +
      '<span class="cmd-palette-item-label">' + cmdHighlight(c.label, query) + '</span>' +
      '<span class="cmd-palette-item-category">' + escHtml(c.category) + '</span>' +
      shortcutHtml +
      '</div>';
  }
  container.innerHTML = html;
  // ARIA: point to the active item for screen readers
  if (activeId) container.setAttribute('aria-activedescendant', activeId);
  else container.removeAttribute('aria-activedescendant');
  // Scroll active into view
  var activeEl = container.querySelector('.cmd-palette-item.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

// ── Open / Close ──
function cmdOpen() {
  var overlay = document.getElementById('command-palette');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  cmdActiveIndex = 0;
  var input = document.getElementById('cmd-palette-input');
  if (input) { input.value = ''; setTimeout(function() { input.focus(); }, 50); }
  cmdRender('');
}

function cmdClose() {
  var overlay = document.getElementById('command-palette');
  if (overlay) overlay.classList.add('hidden');
  cmdActiveIndex = 0;
  cmdFiltered = [];
}  // ── Execute selected command ──
function cmdExecute(index) {
  if (index >= 0 && index < cmdFiltered.length) {
    var cmd = cmdFiltered[index];
    cmdClose();
    if (typeof cmd.action === 'function') {
      // Fire on next microtask so the palette is hidden before the action triggers.
      // (The .hidden class applies display:none instantly, so 0ms is sufficient.)
      setTimeout(function() { cmd.action(); }, 0);
    }
  }
}

// ── Event handlers ──
document.addEventListener('keydown', function(e) {
  var meta = e.metaKey || e.ctrlKey;
  // Ctrl+K / Cmd+K → open palette (never in form fields)
  if (meta && e.key === 'k') {
    e.preventDefault();
    var overlay = document.getElementById('command-palette');
    if (!overlay || overlay.classList.contains('hidden')) {
      cmdOpen();
    } else {
      cmdClose();
    }
    return;
  }

  // If palette is open, handle palette-specific keys
  var overlay = document.getElementById('command-palette');
  if (!overlay || overlay.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    cmdClose();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopImmediatePropagation();
    cmdActiveIndex = Math.min(cmdActiveIndex + 1, Math.max(0, cmdFiltered.length - 1));
    cmdRender(document.getElementById('cmd-palette-input').value);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopImmediatePropagation();
    cmdActiveIndex = Math.max(cmdActiveIndex - 1, 0);
    cmdRender(document.getElementById('cmd-palette-input').value);
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopImmediatePropagation();
    cmdExecute(cmdActiveIndex);
    return;
  }
});

// Input handler — filter on type
document.addEventListener('input', function(e) {
  if (e.target.id === 'cmd-palette-input') {
    cmdActiveIndex = 0;
    cmdRender(e.target.value);
  }
});

// Click handler — delegate from results container
document.addEventListener('click', function(e) {
  var item = e.target.closest('.cmd-palette-item');
  if (!item) return;
  var idx = parseInt(item.dataset.index, 10);
  if (!isNaN(idx)) cmdExecute(idx);
});

// Click outside to close
document.addEventListener('click', function(e) {
  var overlay = document.getElementById('command-palette');
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (e.target === overlay) cmdClose();
});
