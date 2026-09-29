// app.js — App object bridge + init/keybindings.
const App = {
  state: {
    get tasks() { return tasks; }, set tasks(v) { tasks = v; },
    get subjects() { return subjects; }, set subjects(v) { subjects = v; },
    get activeFilter() { return activeFilter; }, set activeFilter(v) { activeFilter = v; },
    get editingId() { return editingId; }, set editingId(v) { editingId = v; },
    get compactMode() { return compactMode; }, set compactMode(v) { compactMode = v; },
    get lastDeleted() { return typeof lastDeleted !== "undefined" ? lastDeleted : null; },
    set lastDeleted(v) { lastDeleted = v; },
    get undoTimer() { return typeof undoTimer !== "undefined" ? undoTimer : null; },
    set undoTimer(v) { undoTimer = v; },
  },

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
  openModal: openModal,
  closeModal: closeModal,
  closeModalOutside: closeModalOutside,
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
  toggleSound: toggleSound,
  toggleSoundFromSettings: function(el) {
    if (typeof _soundEnabled === 'undefined') return;
    _soundEnabled = !_soundEnabled;
    try { localStorage.setItem('hw_sound_enabled', _soundEnabled ? '1' : '0'); } catch (e) {}
    if (el) el.checked = _soundEnabled;
  },
  launchConfetti: launchConfetti,
  showKeybindsHelp: function() {
    var msg = '⌨ Shortcuts: N → new task · Ctrl+K → command palette · Esc → close';
    if (typeof toast === 'function') toast(msg, '', 5000);
  },
  render: function() {
    this.renderFilterChips();
    this.filterTasks();
    this.renderStats();
    this.syncColorInputs();
    this.renderSubjectList();
    this.populateSubjectSelects();
    this.updateTitle(document.getElementById('s-title').value || 'Homework Tracker');
  },
};

// ── Init + Esc cascade ──
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
    var self = this;
    document.addEventListener('keydown', function(e) {
      // Form-field guard — never hijack typing in any input/textarea/select.
      var inField = !!(e.target && typeof e.target.matches === 'function' && e.target.matches('input,textarea,select,[contenteditable]'));
      if (inField) {
        // But Esc inside a form field still cascades close chain.
        if (e.key === 'Escape') { self._closeAllSoft(); }
        return;
      }

      // n / N → new task modal
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); self.openAddForm(); return; }

      // Esc → chain of "soft close" actions.
      if (e.key === 'Escape') {
        self._closeAllSoft();
        return;
      }
    });
};
App._closeAllSoft = function() {
    var self = this;
    self.closeModal(); self.closeSettings();
};

window.addEventListener('DOMContentLoaded', function() { App.init(); });
