// app.js — App object bridge + state/init/keybindings.

const App = {
  state: {
    get tasks() { return tasks; }, set tasks(v) { tasks = v; },
    get tests() { return tests; }, set tests(v) { tests = v; },
    get subjects() { return subjects; }, set subjects(v) { subjects = v; },
    get activeFilter() { return activeFilter; }, set activeFilter(v) { activeFilter = v; },
    get activeTestFilter() { return activeTestFilter; }, set activeTestFilter(v) { activeTestFilter = v; },
    get editingId() { return editingId; }, set editingId(v) { editingId = v; },
    get editingTestId() { return editingTestId; }, set editingTestId(v) { editingTestId = v; },
    get compactMode() { return compactMode; }, set compactMode(v) { compactMode = v; },
    get lastDeleted() { return typeof lastDeleted !== "undefined" ? lastDeleted : null; },
    set lastDeleted(v) { lastDeleted = v; },
    get undoTimer() { return typeof undoTimer !== "undefined" ? undoTimer : null; },
    set undoTimer(v) { undoTimer = v; },
  },
  flashcards: {
    get deck() { return typeof fcDeck !== "undefined" ? fcDeck : []; },
    set deck(v) { fcDeck = v; },
    get index() { return typeof fcIndex !== "undefined" ? fcIndex : 0; },
    set index(v) { fcIndex = v; },
    get flipped() { return typeof fcFlipped !== "undefined" ? fcFlipped : false; },
    set flipped(v) { fcFlipped = v; },
  },
  subtaskEditor: { items: [] },

  // ── Delegated methods (mapped to original global functions) ──
  escHtml: escHtml,
  hexToRgba: hexToRgba,
  uid: uid,
  todayStr: todayStr,
  soonStr: soonStr,
  getDaysLeft: getDaysLeft,
  formatDate: formatDate,
  isValidHex: isValidHex,
  save: save,
  load: load,
  getSettings: getSettings,
  applySettings: applySettings,
  toast: toast,
  renderStats: renderStats,
  filterTasks: filterTasks,
  buildCard: buildCard,
  renderFilterChips: renderFilterChips,
  setFilter: setFilter,
  openAddForm: openAddForm,
  openEdit: openEdit,
  saveTask: saveTask,
  toggleDone: toggleDone,
  deleteTask: deleteTask,
  undoDelete: undoDelete,
  togglePin: togglePin,
  clearAllTasks: clearAllTasks,
  clearModalForm: clearModalForm,
  removeSubtask: function(id) { this.subtaskEditor.items = this.subtaskEditor.items.filter(s => s.id !== id); this.renderSubtaskEditor(); },
  toggleSubtaskEditor: function(id) { var item = this.subtaskEditor.items.find(s => s.id === id); if (item) item.done = !item.done; this.renderSubtaskEditor(); },
  openModal: openModal,
  closeModal: closeModal,
  closeModalOutside: closeModalOutside,
  dailyReset: dailyReset,
  weeklyReset: weeklyReset,
  pruneCompletedPastDue: pruneCompletedPastDue,
  openSettings: openSettings,
  closeSettings: closeSettings,
  closeSettingsOutside: closeSettingsOutside,
  applyColor: applyColor,
  syncColorText: syncColorText,
  syncColorInputs: syncColorInputs,
  applyPreset: applyPreset,
  resetSettings: resetSettings,
  applyRadius: applyRadius,
  updateTitle: updateTitle,
  renderSubjectList: renderSubjectList,
  addSubject: addSubject,
  removeSubject: removeSubject,
  populateSubjectSelects: populateSubjectSelects,
  toggleCompact: toggleCompact,
  toggleCompactFromSettings: toggleCompactFromSettings,
  exportCSV: exportCSV,
  exportICS: exportICS,
  toggleSound: typeof toggleSound === 'function' ? toggleSound : null,
  // Silent variant for the settings-side toggle — no toast, no fan-fare.
  toggleSoundFromSettings: function(el) {
    if (typeof _soundEnabled === 'undefined') return;
    _soundEnabled = !_soundEnabled;
    try { localStorage.setItem('hw_sound_enabled', _soundEnabled ? '1' : '0'); } catch (e) {}
    if (el) el.checked = _soundEnabled;
  },
  // ── View-mode (Focus + Night Sky) HOLD-ONLY API.
  //    Per user request, no header buttons exist any more. Modes activate on
  //    keydown of the configured hold key, deactivate on keyup. Esc clears
  //    both at once. App.setFocus/setNightSky accept a single boolean —
  //    true=enter, false=exit. They DO NOT persist to disk; only the older
  //    toggleFocus/toggleNightSky (kept for the legacy dev-mode "spacebar"
  //    path) write to localStorage.
  setFocus: function(active) { if (typeof setFocus === 'function') setFocus(active); },
  setNightSky: function(active) { if (typeof setNightSky === 'function') setNightSky(active); },
  exitFocus: function() { if (typeof exitFocus === 'function') exitFocus(); },
  toggleAutoTheme: typeof toggleAutoTheme === 'function' ? toggleAutoTheme : function() {},
  // Back-compat shims (kept for any legacy/direct callers like DevMode):
  toggleFocus: function() { if (typeof toggleFocus === 'function') toggleFocus(); },
  toggleNightSky: function() { if (typeof toggleNightSky === 'function') toggleNightSky(); },
  // Returns the currently-held view keys for code-reviewer/dev inspection.
  // { focus: true, nightSky: false }
  _heldViewKeys: function() { return typeof _heldViewKeys === 'object' && _heldViewKeys ? _heldViewKeys : {}; },
  // Save a new hold-key binding (writes to localStorage hw_hold_keys).
  // `slot` ∈ 'focus' | 'nightSky', value is a single character (case low).
  // Empty value disables that slot entirely (keyed-up without ever firing).
  setHoldKey: function(slot, value) {
    if (slot !== 'focus' && slot !== 'nightSky') return;
    var map = getHoldKeys();
    map[slot] = (value || '').toLowerCase();
    saveHoldKeys(map);
    window.HOLD_KEYS_REFRESH = true;
  },
  resetHoldKeys: function() {
    saveHoldKeys({ focus:'f', nightSky:'n' });
    window.HOLD_KEYS_REFRESH = true;
    var fEl = document.getElementById('hk-focus');
    var nEl = document.getElementById('hk-nightsky');
    if (fEl) fEl.value = 'f';
    if (nEl) nEl.value = 'n';
    if (typeof toast === 'function') toast('Hold keys reset to F / N', '', 1500);
  },
  showKeybindsHelp: function() {
    var hk = getHoldKeys();
    var focusKey = (hk.focus || 'F').toUpperCase();
    var nightKey = (hk.nightSky || 'N').toUpperCase();
    var msg = '⌨ Shortcuts: Hold ' + focusKey + ' → focus mode | Hold ' + nightKey + ' → night sky | Esc → close | N (if not rebound) → new task';
    if (typeof toast === 'function') toast(msg, '', 6000);
  },
  switchTab: switchTab,
  getLetterGrade: getLetterGrade,
  getScorePct: getScorePct,
  renderTests: renderTests,
  buildTestCard: buildTestCard,
  setTestFilter: setTestFilter,
  openTestForm: openTestForm,
  openTestEdit: openTestEdit,
  closeTestModal: closeTestModal,
  closeTestModalOutside: closeTestModalOutside,
  saveTest: saveTest,
  deleteTest: deleteTest,
  populateTestSubjectSelect: populateTestSubjectSelect,
  renderCountdown: renderCountdown,
  // Study-timer methods are defined once, further down this literal.
  openFlashcards: openFlashcards,
  closeFlashcards: closeFlashcards,
  shuffleFlashcards: shuffleFlashcards,
  flipCard: flipCard,
  fcNext: fcNext,
  fcPrev: fcPrev,
  renderFlashcard: renderFlashcard,
  launchConfetti: launchConfetti,
  // renderGradeCalc was defined in gradecalc.js (removed); renderStats is
  // aliased in the block at the top.
  renderTestStats: renderTestStats,
  render: function() {
    this.renderFilterChips();
    this.filterTasks();
    this.renderStats();
    this.syncColorInputs();
    this.renderSubjectList();
    this.populateSubjectSelects();
    this.updateTitle(document.getElementById('s-title').value || 'Homework Tracker');
    if (typeof renderStarfield === 'function') renderStarfield();
  },

  // ── Close outside handlers ──
  closeFlashcardsOutside: function(e) { if (e.target.id === 'flashcard-overlay') this.closeFlashcards(); },

  // ── Add subtask ──
  addSubtask: function() {
    var input = document.getElementById('new-subtask-input');
    var text = input.value.trim();
    if (!text) return;
    this.subtaskEditor.items.push({ id: this.uid(), text: text, done: false });
    input.value = '';
    this.renderSubtaskEditor();
    input.focus();
  },
  renderSubtaskEditor: function() {
    var container = document.getElementById('subtask-list');
    if (!container) return;
    var self = this;
    container.innerHTML = '';
    this.subtaskEditor.items.forEach(function(s) {
      var div = document.createElement('div');
      div.className = 'subtask-item';

      // Checkbox button
      var cb = document.createElement('button');
      cb.className = 'task-checkbox' + (s.done ? ' checked' : '');
      cb.setAttribute('role', 'checkbox');
      cb.setAttribute('aria-checked', s.done);
      cb.setAttribute('aria-label', 'Toggle subtask: ' + s.text);
      cb.innerHTML = '<svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4L4.5 7.5L11 1" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      (function(id) { cb.onclick = function() { self.toggleSubtaskEditor(id); }; })(s.id);
      div.appendChild(cb);

      // Text span
      var span = document.createElement('span');
      span.className = 'subtask-text' + (s.done ? ' done' : '');
      span.textContent = s.text;
      div.appendChild(span);

      // Remove button
      var rb = document.createElement('button');
      rb.className = 'subtask-remove';
      rb.title = 'Remove';
      rb.textContent = '✕';
      (function(id) { rb.onclick = function() { self.removeSubtask(id); }; })(s.id);
      div.appendChild(rb);

      container.appendChild(div);
    });
  },

  // ── Templates (gamification.js) ──
  renderTemplateList: function() { renderTemplateList(); },
  applyTemplate: function(tplId) { applyTemplate(tplId); },
  saveAsTemplate: function() { saveAsTemplate(); },
};

// ── MODULE-LEVEL STATE (outside the App object literal) ──
// Hold-key state — a flat object keyed by slot ('focus' | 'nightSky') with
// a boolean tracking whether the key is currently down. Defaults do NOT
// conflict with form fields; we early-return if e.target is a form input.
var _heldViewKeys = { focus: false, nightSky: false };

function getHoldKeys() {
  try {
    var d = localStorage.getItem('hw_hold_keys');
    if (d) {
      var parsed = JSON.parse(d);
      return Object.assign({ focus:'f', nightSky:'n' }, parsed);
    }
  } catch (e) {}
  return { focus:'f', nightSky:'n' };
}
function saveHoldKeys(map) {
  try { localStorage.setItem('hw_hold_keys', JSON.stringify(map)); } catch (e) {}
}

// ── Init + Esc cascade ──
// Defined OUTSIDE the const App = {} block (already closed above). Attached
// via App.init = / App._closeAllSoft = so they're callable from app code
// but don't need to live INSIDE the literal — which kept us from parsing
// `var` declarations inside an object literal (the syntax error we
// fixed in this rewrite).
App.init = function() {
    // ── Service Worker registration (PWA offline support) ──
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        // Listen for updates — if a new SW is waiting, notify the user
        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — show persistent toast (12s)
              if (typeof toast === 'function') {
                toast('🔄 Update available — refresh the page to get the latest version', '', 12000);
              }
            }
          });
        });
      }).catch(function(err) {
        // SW registration failed — non-critical, app works without it
        console.warn('Service Worker registration failed:', err);
      });
    }

    this.load();
    this.render();
    // Resume auto time-of-day theme scheduler if it was enabled last session.
    if (typeof startAutoThemeScheduler === 'function') startAutoThemeScheduler();
    renderTemplateList();
    var self = this;
    document.addEventListener('keydown', function(e) {
      // Rapid-fire guard — if the user holds a configured hold key, we only
      // act on the FIRST keydown (subsequent repeats are no-ops).
      if (e.repeat) return;
      // Form-field guard — never hijack typing in any input/textarea/select.
      var inField = !!(e.target && typeof e.target.matches === 'function' && e.target.matches('input,textarea,select,[contenteditable]'));
      if (inField) {
        // But Esc inside a form field still cascades close chain.
        if (e.key === 'Escape') { self._closeAllSoft(); }
        return;
      }
      var k = getHoldKeys();
      var key = (e.key || '').toLowerCase();

      // n / N → new task modal (only when N isn't the nightSky hold key).
      if (key === 'n' && k.nightSky !== 'n') { e.preventDefault(); self.openAddForm(); return; }

      // Hold-key activate: focus + nightSky are mutually inclusive.
      if (key === k.focus && !_heldViewKeys.focus) {
        _heldViewKeys.focus = true;
        self.setFocus(true);
        if (key === k.nightSky && !_heldViewKeys.nightSky) { _heldViewKeys.nightSky = true; self.setNightSky(true); }
        e.preventDefault();
        return;
      }
      if (key === k.nightSky && !_heldViewKeys.nightSky) {
        _heldViewKeys.nightSky = true;
        self.setNightSky(true);
        e.preventDefault();
        return;
      }

      // Esc → chain of "soft close" actions + force-exit any active hold.
      if (e.key === 'Escape') {
        self._closeAllSoft();
        return;
      }
    });
    document.addEventListener('keyup', function(e) {
      var k = getHoldKeys();
      var key = (e.key || '').toLowerCase();
      // Release focus hold key
      if (key === k.focus && _heldViewKeys.focus) {
        _heldViewKeys.focus = false;
        self.setFocus(false);
        // If nightSky is still held, re-affirm nightSky (the setFocus call
        // above is purely a CSS class toggle and doesn't touch night-sky).
        if (_heldViewKeys.nightSky) self.setNightSky(true);
        else if (document.documentElement.classList.contains('night-sky-mode')) self.setNightSky(false);
        return;
      }
      // Release nightSky hold key
      if (key === k.nightSky && _heldViewKeys.nightSky) {
        _heldViewKeys.nightSky = false;
        // When focus is STILL held, don't exit night-sky — the user is
        // holding both keys and only released N. Night-sky stays on as
        // long as F is held (the keydown path above re-applies it).
        if (!_heldViewKeys.focus) {
          self.setNightSky(false);
        }
        return;
      }
    });
    // If the user tabs/alt-tabs away while a hold key is down, ensure we
    // release so the UI doesn't stick in mode on focus regain.
    window.addEventListener('blur', function() {
      if (_heldViewKeys.focus)   { self.setFocus(false); }
      if (_heldViewKeys.nightSky){ self.setNightSky(false); }
      _heldViewKeys.focus = false;
      _heldViewKeys.nightSky = false;
    });
    document.addEventListener('keydown', function(e) {
      if (!document.getElementById('flashcard-overlay')?.classList.contains('hidden')) {
        if (e.key==='ArrowRight') self.fcNext();
        if (e.key==='ArrowLeft') self.fcPrev();
        if (e.key===' ') { e.preventDefault(); self.flipCard(); }
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key==='Enter' && e.target.id==='new-subtask-input') { e.preventDefault(); self.addSubtask(); }
    });
};
App._closeAllSoft = function() {
    var self = this;
    if (document.documentElement.classList.contains('focus-mode') || document.documentElement.classList.contains('night-sky-mode')) {
      _heldViewKeys.focus = false; _heldViewKeys.nightSky = false;
      self.exitFocus();
      return;
    }
    self.closeModal(); self.closeSettings(); self.closeTestModal(); self.closeFlashcards();
};

window.addEventListener('DOMContentLoaded', function() { App.init(); });
