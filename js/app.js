// app.js — App object bridge + state/init/keybindings.
// Parser extracted to parser.js, calendar to calendar.js, grade calc to gradecalc.js.

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
  timer: {
    get interval() { return typeof timerInterval !== "undefined" ? timerInterval : null; },
    set interval(v) { timerInterval = v; },
    get seconds() { return typeof timerSeconds !== "undefined" ? timerSeconds : 25*60; },
    set seconds(v) { timerSeconds = v; },
    get total() { return typeof timerTotal !== "undefined" ? timerTotal : 25*60; },
    set total(v) { timerTotal = v; },
    get running() { return typeof timerRunning !== "undefined" ? timerRunning : false; },
    set running(v) { timerRunning = v; },
    get sessions() { return typeof timerSessions !== "undefined" ? timerSessions : 0; },
    set sessions(v) { timerSessions = v; },
    get testId() { return typeof timerTestId !== "undefined" ? timerTestId : null; },
    set testId(v) { timerTestId = v; },
  },
  flashcards: {
    get deck() { return typeof fcDeck !== "undefined" ? fcDeck : []; },
    set deck(v) { fcDeck = v; },
    get index() { return typeof fcIndex !== "undefined" ? fcIndex : 0; },
    set index(v) { fcIndex = v; },
    get flipped() { return typeof fcFlipped !== "undefined" ? fcFlipped : false; },
    set flipped(v) { fcFlipped = v; },
  },
  calendar: {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    selectedDay: null,
  },
  subtaskEditor: { items: [] },
  _previousFocus: null,
  _activeTrapElement: null,
  _activeTrapHandler: null,
  quickAddState: { parsed: null, previewVisible: false, overrides: { subject: null, title: null, due: null, time: null, priority: null } },

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
  // Read-only accessor so other code can sync the toggle UI without a write.
  isSoundEnabled: function() { return typeof _soundEnabled === 'undefined' ? true : !!_soundEnabled; },
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
    var msg = '⌨ Shortcuts: Hold ' + focusKey + ' → focus mode | Hold ' + nightKey + ' → night sky | Q → quick-add | Ctrl+Shift+V → voice | Esc → close | N (if not rebound) → new task';
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
  openStudyTimer: openStudyTimer,
  closeTimer: closeTimer,
  setTimerPreset: setTimerPreset,
  toggleTimer: toggleTimer,
  resetTimer: resetTimer,
  openFlashcards: openFlashcards,
  closeFlashcards: closeFlashcards,
  shuffleFlashcards: shuffleFlashcards,
  flipCard: flipCard,
  fcNext: fcNext,
  fcPrev: fcPrev,
  renderFlashcard: renderFlashcard,
  launchConfetti: launchConfetti,
  renderCalendar: function() { renderCalendar.call(this); },
  renderGradeCalc: function() { renderGradeCalc.call(this); },
  renderStats: renderStats,
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

  // ── Focus management ──
  trapFocus: function(element) {
    this.releaseFocusTrap();
    var focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    var self = this;
    var handler = function(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    this._activeTrapElement = element;
    this._activeTrapHandler = handler;
    element.addEventListener('keydown', handler);
    first.focus();
  },
  releaseFocusTrap: function() {
    if (this._activeTrapElement && this._activeTrapHandler) {
      this._activeTrapElement.removeEventListener('keydown', this._activeTrapHandler);
      this._activeTrapElement = null;
      this._activeTrapHandler = null;
    }
  },
  restoreFocus: function() {
    if (this._previousFocus && this._previousFocus.offsetParent !== null) this._previousFocus.focus();
  },

  // ── Close outside handlers ──
  closeFlashcardsOutside: function(e) { if (e.target.id === 'flashcard-overlay') this.closeFlashcards(); },

  // ── Voice toggle (delegated to Voice module) ──
  toggleVoice: function() { if (typeof Voice !== 'undefined') Voice.toggle(); },

  // ── Refresh AI settings UI when provider changes ──
  _refreshAISettings: function() {
    if (typeof Voice === 'undefined') return;
    var prov = Voice.getProvider();
    // Update model dropdown
    var modelEl = document.getElementById('s-ai-model');
    if (modelEl) {
      var models = prov === 'openrouter' ? Voice.OPENROUTER_MODELS : Voice.GEMINI_MODELS;
      modelEl.innerHTML = '';
      for (var i = 0; i < models.length; i++) {
        var opt = document.createElement('option');
        opt.value = models[i];
        opt.textContent = models[i];
        modelEl.appendChild(opt);
      }
      modelEl.value = Voice.getModel();
    }
    // Show/hide key fields
    var orDiv = document.getElementById('ai-key-openrouter');
    var gemDiv = document.getElementById('ai-key-gemini');
    if (orDiv) orDiv.style.display = (prov === 'openrouter') ? '' : 'none';
    if (gemDiv) gemDiv.style.display = (prov === 'gemini') ? '' : 'none';
  },

  // ── Sound Toggle ──


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
  },  // ── Calendar (extracted to calendar.js) ──
  MONTHS: MONTHS,
  DAYS_SHORT: DAYS_SHORT,
  PRIORITIES: PRIORITIES,
  PRIO_WEIGHT: PRIO_WEIGHT,
  renderCalendar: function() { renderCalendar(this); },
  renderCalendarDayDetail: function() { renderCalendarDayDetail(this); },
  prevMonth: function() { calPrevMonth(this); },
  nextMonth: function() { calNextMonth(this); },
  todayMonth: function() { calTodayMonth(this); },
  selectCalendarDay: function(dateStr) { calSelectDay(this, dateStr); },
  openAddFormForDate: function(dateStr) { calOpenAddFormForDate(this, dateStr); },

  // ── Grade Calculator (extracted to gradecalc.js) ──
  renderGradeCalc: function() { renderGCSubjectList(this); renderGCSummary(this); renderGCOverallGPA(this); },
  renderGCOverallGPA: function() { renderGCOverallGPA(this); },
  renderGCSubjectList: function() { renderGCSubjectList(this); },
  renderGCSummary: function() { renderGCSummary(this); },
  updateGCCalculation: function() { updateGCCalculation(this); },

  // ── Quick-add preview ──
  onQuickAddInput: function(e) {
    var raw = e.target.value;
    if (!raw.trim()) this._clearQuickAddOverrides();
    var parsed = this._parseQuickAddWithOverrides(raw);
    this.quickAddState.parsed = parsed;
    this.renderQuickAddPreview(parsed, raw);
    showSuggestions(raw);
  },
  onQuickAddKeydown: function(e) {
    if (handleSuggestionKeydown(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.confirmQuickAdd();
    }
    if (e.key === 'Escape') {
      hideSuggestions();
    }
  },
  hideSuggestions: function() { hideSuggestions(); },
  clearQuickAddHistory: function() {
    if (confirm('Clear all quick-add suggestions history?')) {
      localStorage.removeItem('hw_quickadd_history');
      toast('Quick-add history cleared', '');
      renderQuickAddHistory();
    }
  },
  renderQuickAddPreview: function(parsed, raw) {
    var el = document.getElementById('qa-preview');
    // Tier 4: accept a parsed-intent ARRAY (length >= 1 for non-empty input). Single parsed
    // objects still work for back-compat with existing callers.
    var parsedArr = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    if (!el || !parsedArr.length || !raw.trim()) { if (el) el.classList.add('hidden'); this.quickAddState.previewVisible = false; return; }
    this.quickAddState.previewVisible = true;
    var self = this;
    // Multi-intent path: stacked compact rows with ⛓ chips; no per-field editing on those rows.
    if (parsedArr.length > 1) { this._renderMultiIntentsPreview(el, parsedArr); return; }
    var parsed = parsedArr[0];
    var subj = this.state.subjects.find(function(s){return s.name===parsed.subject;}) || {color:'#7c6af7'};
    // Confidence is still tracked internally (subjectOk gate in _autoSiblings + override bumps)
    // but the on-preview visual cue (dashed outline + "?" marker) is intentionally suppressed per
    // user request. The class hook remains so future re-enablement is a one-line flip.
    var lowConfCls = function(field) { return ''; };
    // Build clickable pills — each one holds its current parsed value but can be inline-edited on click/Enter/Space.
    var subjPill = '<span class="qa-pill badge qa-pill-editable'+lowConfCls('subject')+'" data-field="subject" role="button" tabindex="0" aria-label="Change subject (currently '+this.escHtml(parsed.subject)+')" style="background:'+this.hexToRgba(subj.color,.15)+';color:'+subj.color+';border-color:'+this.hexToRgba(subj.color,.3)+'">'+this.escHtml(parsed.subject)+'</span>';
    var titlePill = '<span class="qa-pill qa-preview-title qa-pill-editable'+lowConfCls('title')+'" data-field="title" role="button" tabindex="0" aria-label="Rename task">'+this.escHtml(parsed.title)+'</span>';
    var duePill;
    if (parsed.due) {
      var d = this.getDaysLeft(parsed.due);
      var label = d<0?'Overdue':d===0?'Today':d===1?'Tomorrow':d+'d away';
      duePill = '<span class="qa-pill badge badge-soon qa-pill-editable'+lowConfCls('due')+'" data-field="due" role="button" tabindex="0" aria-label="Change due date (currently '+this.escHtml(label)+')">📅 '+this.escHtml(label)+'</span>';
    } else {
      duePill = '<span class="qa-pill qa-pill-empty qa-pill-editable'+lowConfCls('due')+'" data-field="due" role="button" tabindex="0" aria-label="Set a due date">+ date</span>';
    }
    var timePill;
    if (parsed.time) {
      timePill = '<span class="qa-pill badge badge-due qa-pill-editable'+lowConfCls('time')+'" data-field="time" role="button" tabindex="0" aria-label="Change estimated time (currently '+parsed.time+' minutes)">⏱ '+parsed.time+'m</span>';
    } else {
      timePill = '<span class="qa-pill qa-pill-empty qa-pill-editable'+lowConfCls('time')+'" data-field="time" role="button" tabindex="0" aria-label="Estimate time">+ time</span>';
    }
    var prioPill = '<span class="qa-pill badge badge-priority-'+parsed.priority+' qa-pill-editable'+lowConfCls('priority')+'" data-field="priority" role="button" tabindex="0" aria-label="Change priority (currently '+this.escHtml(parsed.priority)+')">'+this.escHtml(parsed.priority)+'</span>';

    // Tier 2: render a row of entity chips (chapters, pages, URLs, people) as small visual pills below the main row.
    // Display-only in this tier — editing is reserved for a follow-up.
    var entities = parsed.entities || {};
    var entityChips = [];
    (entities.chapters || []).forEach(function(c) { entityChips.push('<span class="qa-pill qa-pill-entity" data-entity="chapter">📖 Ch ' + self.escHtml(c) + '</span>'); });
    (entities.pages || []).forEach(function(p) { entityChips.push('<span class="qa-pill qa-pill-entity" data-entity="pages">📄 pp ' + self.escHtml(p) + '</span>'); });
    (entities.urls || []).forEach(function(u) { entityChips.push('<span class="qa-pill qa-pill-entity" data-entity="url">🔗 ' + self.escHtml(u) + '</span>'); });
    (entities.people || []).forEach(function(p) { entityChips.push('<span class="qa-pill qa-pill-entity" data-entity="person">👤 ' + self.escHtml(p) + '</span>'); });
    (entities.quoted || []).forEach(function(q) {
      var displayLabel = q.author ? (q.author + ' — ' + q.title) : q.title;
      entityChips.push('<span class="qa-pill qa-pill-entity" data-entity="quoted">📖 ‘' + self.escHtml(displayLabel) + '’</span>');
    });
    var entitiesRow = entityChips.length
      ? '<div class="qa-entities-row">' + entityChips.join('') + '</div>'
      : '';

    // Tier 3: 🖇️ chips for entity-resolution matches against existing tasks (above threshold).
    var linkChips = [];
    (parsed.entityResolution || []).forEach(function(m) {
      linkChips.push('<span class="qa-pill qa-pill-link" data-task-id="' + self.escHtml(m.taskId) + '" title="Linked (' + m.score.toFixed(2) + ')">🖇️ ' + self.escHtml(m.title) + '</span>');
    });
    var linksRow = linkChips.length
      ? '<div class="qa-links-row">' + linkChips.join('') + '</div>'
      : '';

    el.innerHTML = '<div class="qa-preview-inner"><span class="qa-label">Preview:</span>'+subjPill+titlePill+duePill+timePill+prioPill+'</div>' + entitiesRow + linksRow;
    el.classList.remove('hidden');

    // Delegated handlers — replaced on each render. Cheapest option that survives innerHTML replace.
    // Important: the original event.target may be detached by the time we get here (if a sibling pill's
    // blur already re-rendered the preview), so we look up the LIVE pill by its data-field.
    function livePillFor(target) {
      var orig = target.closest('.qa-pill-editable');
      if (!orig) return null;
      return el.querySelector('[data-field="' + orig.dataset.field + '"]');
    }
    el.onclick = function(e) {
      var pill = livePillFor(e.target);
      if (!pill) return;
      self._editPreviewField(pill.dataset.field, pill);
    };
    el.onkeydown = function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var pill = livePillFor(e.target);
      if (!pill) return;
      e.preventDefault();
      self._editPreviewField(pill.dataset.field, pill);
    };  },

  // Tier 4: stacked multi-intent preview. Renders one compact row per parsed intent
  // separated by a divider. Inline editing is OFF for these rows (the user can refine
  // per-element via the existing pill UI by typing one intent at a time if needed).
  _renderMultiIntentsPreview: function(el, parsedArr) {
    var self = this;
    var stack = parsedArr.map(function(p, i) {
      var subj = self.state.subjects.find(function(s){return s.name===p.subject;}) || {color:'#7c6af7'};
      var subjStyle = 'background:' + self.hexToRgba(subj.color,.15) + ';color:' + subj.color + ';border-color:' + self.hexToRgba(subj.color,.3);
      var verbPrefix = p.actionVerb ? (p.actionVerb + ' ') : '';
      var titleOrFallback = p.title || (verbPrefix + (p.subject || ''));
      var dueHtml = '';
      if (p.due) {
        var dl = self.getDaysLeft(p.due);
        var lab = dl<0?'Overdue':dl===0?'Today':dl===1?'Tomorrow':dl+'d away';
        dueHtml = ' 📅 ' + self.escHtml(lab);
      }
      var linkHtml = (p.entityResolution || []).slice(0,1).map(function(m){ return ' 🖇️ ' + self.escHtml(m.title); }).join('');
      return (
        '<div class="qa-multi-preview-row" data-row-idx="' + (i+1) + '">' +
          '<span class="qa-multi-row-num">' + (i+1) + '.</span>' +
          '<span class="qa-pill badge" style="' + subjStyle + '">' + self.escHtml(p.subject) + '</span>' +
          '<span class="qa-pill qa-preview-title">' + self.escHtml(titleOrFallback) + '</span>' +
          dueHtml + linkHtml +
        '</div>'
      );
    });
    var html = stack.join('<div class="qa-multi-intent-divider"></div>');
    el.innerHTML = '<div class="qa-preview-stack"><span class="qa-label">' + parsedArr.length + ' intents:</span>' + html + '</div>';
    el.classList.remove('hidden');
  },

  // Parses raw text and applies any explicit user overrides (sticky until +Add or empty input).
  _parseQuickAddWithOverrides: function(raw) {
    var parsed = this.parseQuickAdd(raw);
    if (!parsed) return null;
    var o = this.quickAddState.overrides;
    // User-edited fields are treated as authoritative → bump confidence to 1.0 so the pill no longer reads "low confidence".
    if (o.subject) { parsed.subject = o.subject; parsed.confidence.subject = 1.0; }
    if (o.title !== null && o.title !== undefined) { parsed.title = o.title; parsed.confidence.title = 1.0; }
    if (o.due !== null && o.due !== undefined) { parsed.due = o.due; parsed.confidence.due = 1.0; }
    if (o.time !== null && o.time !== undefined) { parsed.time = o.time; parsed.confidence.time = 1.0; }
    if (o.priority) { parsed.priority = o.priority; parsed.confidence.priority = 1.0; }
    return parsed;
  },
  _clearQuickAddOverrides: function() {
    this.quickAddState.overrides = { subject: null, title: null, due: null, time: null, priority: null };
  },
  // Inline-edit a preview field. Replaces the pill's content with a small input tied to that field.
  _editPreviewField: function(field, pillEl) {
    var self = this;
    if (!this.quickAddState.parsed) return;

    // Note: a different pill's input (if any) commits via natural blur when focus moves here,
    // because every pill has tabindex="0" and clicks naturally shift focus from a child input.
    if (pillEl.querySelector('.qa-pill-input')) return; // re-entry guard

    var current = this.quickAddState.parsed[field];
    var input;

    if (field === 'subject') {
      input = document.createElement('select');
      input.id = 'qa-edit-subject';
      input.className = 'qa-pill-input';
      this.state.subjects.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        if (s.name === current) opt.selected = true;
        input.appendChild(opt);
      });
      // If the current subject no longer exists in subjects list (orphan from older data), allow keeping it.
      if (current && this.state.subjects.every(function(s) { return s.name !== current; })) {
        var orphan = document.createElement('option');
        orphan.value = current; orphan.textContent = current;
        input.appendChild(orphan);
      }
    } else if (field === 'priority') {
      input = document.createElement('select');
      input.id = 'qa-edit-priority';
      input.className = 'qa-pill-input';
      this.PRIORITIES.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        if (p === current) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (field === 'due') {
      input = document.createElement('input');
      input.type = 'date';
      input.id = 'qa-edit-due';
      input.className = 'qa-pill-input';
      input.value = current || '';
    } else if (field === 'time') {
      input = document.createElement('input');
      input.type = 'number';
      input.id = 'qa-edit-time';
      input.min = '1'; input.max = '999';
      input.placeholder = 'min';
      input.className = 'qa-pill-input';
      // Don't pre-fill with 0 — show empty so placeholder shows.
      input.value = current > 0 ? String(current) : '';
    } else if (field === 'title') {
      input = document.createElement('input');
      input.type = 'text';
      input.id = 'qa-edit-title';
      input.className = 'qa-pill-input qa-pill-input-wide';
      input.value = current || '';
    }

    pillEl.innerHTML = '';
    pillEl.appendChild(input);
    pillEl.classList.add('qa-pill-active');

    // Defer focus so the click that opened this doesn't immediately blur it.
    setTimeout(function() { input.focus(); if (typeof input.select === 'function') input.select(); }, 0);

    var cancelled = false;
    var commit = function() {
      if (cancelled || !self.quickAddState.parsed) return;
      var val = input.value;
      if (field === 'time') val = parseInt(val, 10) > 0 ? parseInt(val, 10) : 0;
      if (field === 'due' && val === '') val = '';
      // Title must never save as empty — fall back to the parser's value.
      if (field === 'title' && !val.trim()) {
        if (previewEl) self.renderQuickAddPreview(self.quickAddState.parsed, document.getElementById('qa-input').value);
        var qa = document.getElementById('qa-input'); if (qa) qa.focus();
        return;
      }
      self.quickAddState.parsed[field] = val;
      self.quickAddState.overrides[field] = val;
      var raw = document.getElementById('qa-input').value;
      var fresh = self._parseQuickAddWithOverrides(raw);
      self.quickAddState.parsed = fresh;
      self.renderQuickAddPreview(fresh, raw);
      // Restore focus so the user can keep tweaking (or hit +Add).
      var qaInput = document.getElementById('qa-input');
      if (qaInput) qaInput.focus();
    };
    var cancel = function() {
      var raw = document.getElementById('qa-input').value;
      self.renderQuickAddPreview(self.quickAddState.parsed, raw);
      var qaInput = document.getElementById('qa-input');
      if (qaInput) qaInput.focus();
    };

    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); } // triggers commit once via blur
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // don't bubble up to doc-level Escape that closes modals
        cancelled = true;
        cancel();
      }
    });
  },
  confirmQuickAdd: function() {
    var input = document.getElementById('qa-input');
    var raw = input && input.value ? input.value.trim() : '';
    if (!raw) return;
    recordQuickAdd(raw);
    // When the parse came from AI (Voice._fromAI flag), skip the rule-based
    // re-parse and use the AI result directly. User overrides from pill edits
    // still apply via _applyOverridesToArray.
    if (this.quickAddState._fromAI && Array.isArray(this.quickAddState.parsed) && this.quickAddState.parsed.length) {
      var parsedArr = this.quickAddState.parsed;
      this._applyOverridesToArray(parsedArr);
      this.quickAddState._fromAI = false;
    } else {
      var parsedArr = this.parseQuickAddAll(raw);
      this._applyOverridesToArray(parsedArr);
      this.quickAddState.parsed = parsedArr;
    }
    if (!parsedArr.length) return;
    // Reject parses where the parser extracted NO structured data at all.
    // `parseQuickAdd` always produces a title (raw fallback), so we can't
    // gate on empty title. Instead: if EVERY structured field has low/default
    // confidence (no real subject, no date, no time, no explicit priority),
    // the user likely typed gibberish — show a helpful error toast.
    var anyUseful = parsedArr.some(function(p) {
      return !!(p && ((p.confidence && p.confidence.subject >= 0.6) ||
                       p.due ||
                       (p.time && p.confidence && p.confidence.time >= 1.0) ||
                       (p.confidence && p.confidence.priority >= 1.0) ||
                       (p.entities && (p.entities.chapters.length || p.entities.pages.length || p.entities.urls.length || p.entities.people.length || p.entities.quoted.length)) ||
                       (p.assignmentType && p.assignmentType !== '')));
    });
    if (!anyUseful) {
      if (typeof toast === 'function') toast('⚠ Couldn\'t parse that — try: subject task due day (e.g. "math homework due friday 30m")', 'error', 4000);
      return;
    }

    // Per-element routing — score-based intent classification.
    // The winning intent is the one with the highest keyword score.
    // Route to test when test intent dominates AND no action verb overrides.
    var self = this;
    var hasAnyTest = false, hasAnyTask = false;
    parsedArr.forEach(function(p) {
      var s = p.intentScores || { test: 0, study: 0, task: 0 };
      var maxScore = Math.max(s.test, s.study, s.task);
      var winningIntent = maxScore === s.test && s.test > 0  ? 'test'  :
                          maxScore === s.study && s.study > 0 ? 'study' :
                          maxScore === s.task && s.task > 0   ? 'task'  : 'task';
      // Route to test: test intent dominates (highest keyword score wins)
      if (winningIntent === 'test') {
        self._pushTestFromParsed(p, raw);
        hasAnyTest = true;
      } else {
        self._pushTaskFromParsed(p);
        hasAnyTask = true;
      }
    });

    // ── TIER 5: AUTO-SIBLINGS ──
    // Phase 2 of confirmQuickAdd: each parsed intent's category (test /
    // study / project) primes a complementary record so the user doesn't
    // have to manually create both halves. Rules (matched per intent):
    //   test-intent wins + no verb → push study task buddy (title="study")
    //   actionVerb === 'study' + ok-subject → push test buddy (type=Test)
    //   project-type intent        → push prep task buddy (title="prep")
    // "review" intentionally does NOT spawn test buddies — "review history
    // essay" / "review biology chapter 4" don't imply an exam. Only the
    // explicit leading "study" verb warrants a test buddy.
    // Dedup: skip buddies that already match an existing (subject, due,
    // title) tuple so multi-intent inputs don't loop into duplicates.
    var sibling = self._autoSiblings(parsedArr, raw);
    if (sibling.addedTest) hasAnyTest = true;
    if (sibling.addedTask) hasAnyTask = true;

    if (typeof save === 'function') save();
    // Refresh the tasks view only when tasks were added; tests render regardless of active tab.
    if (hasAnyTask) self.render();
    else if (hasAnyTest && typeof renderTests === 'function') renderTests();
    input.value = '';
    self._clearQuickAddOverrides();
    hideSuggestions();
    renderQuickAddHistory();
    var preview = document.getElementById('qa-preview'); if (preview) preview.classList.add('hidden');
    var count = parsedArr.length;
    if (count > 1) self.toast(count + ' items added ✓', 'success');
    else if (hasAnyTest) self.toast('Test added ✓', 'success');
    else self.toast('Task added ✓', 'success');
    // Switch to the tests tab when the user added tests AND no tasks (mixed-mode stays put).
    if (hasAnyTest && !hasAnyTask && typeof switchTab === 'function') switchTab('tests');
  },

  // ── NLP Parser v2 (extracted to parser.js) ──
  _levenshtein: function(a,b) { return parserLevenshtein(a,b); },
  _fuzzyMatch: function(word,candidates,maxDist) { return parserFuzzyMatch(word,candidates,maxDist); },
  _escRegex: function(s) { return parserEscRegex(s); },
  // Resolve a parsed assignmentType to its matching template (for template-driven subtask prepopulation).
  // Returns null when there's no match (e.g., type is empty or templates haven't loaded yet).
  getTemplateForAssignmentType: function(type) { return parserGetTemplateForAssignmentType(type); },

  // ── TIER 3: Entity resolution & graph linking ──
  // Score each existing task against the parsed result. Returns the top matches
  // above threshold (>= 0.5) sorted desc by score. Each match carries an existing
  // `taskId` so confirmQuickAdd can persist `linkedTaskIds` on the new task, and
  // renderQuickAddPreview can surface a 🖇️ chip in the preview.
  _resolveExistingTaskMatches: function(parsed, existingTasks) { return parserResolveExistingTaskMatches(parsed, existingTasks); },

  // ── TIER 4: Multi-intent splitter ──
  // Splits raw input on ` and ` / ` then ` / `, `. URLs are masked BEFORE the
  // split with a unique placeholder so any internal URL punctuation (commas in
  // query strings, etc.) never causes a false split. The placeholder is then
  // restored after the split.
  _splitIntents: function(raw) { return parserSplitIntents(raw); },

  // TIER 4: Higher-level entry returning an array (length >= 1 for non-empty input).
  // `parseQuickAdd` keeps its single-result shape so the 105-test suite + other
  // call sites stay green; preview/confirm go through this one.
  parseQuickAddAll: function(raw) { return parseQuickAddAll(this, raw); },

  // ── TIER 4: confirmQuickAdd helpers ──
  // Apply user overrides (sticky until +Add or empty input) to every element of a
  // parsed-intent array.
  _applyOverridesToArray: function(arr) {
    var o = this.quickAddState.overrides;
    if (!o) return;
    arr.forEach(function(p) {
      if (o.subject) { p.subject = o.subject; if (p.confidence) p.confidence.subject = 1.0; }
      if (o.title !== null && o.title !== undefined)    { p.title = o.title; if (p.confidence) p.confidence.title = 1.0; }
      if (o.due !== null && o.due !== undefined)        { p.due = o.due; if (p.confidence) p.confidence.due = 1.0; }
      if (o.time !== null && o.time !== undefined)      { p.time = o.time; if (p.confidence) p.confidence.time = 1.0; }
      if (o.priority) { p.priority = o.priority; if (p.confidence) p.confidence.priority = 1.0; }
    });
  },

  // Push a Test record from a parsed element. Title format: "<Subject> <Type> M/D" per user spec.
  // Examples: "Math Test 6/19", "English Quiz 6/19", "History Midterm 6/22".
  // Without a parsed date, the M/D suffix is dropped — title is "<Subject> <Type>".
  // _siblingTestP (Tier 5) builds a synthetic parsed shape that flows through this function, so
  // test buddies automatically inherit the new format too.
  _pushTestFromParsed: function(p, raw) {
    var routeType = 'Test';
    if (/\bfinal\b/i.test(raw))         routeType = 'Final';
    else if (/\bmidterm\b/i.test(raw))  routeType = 'Midterm';
    else if (/\bquiz\b/i.test(raw))     routeType = 'Quiz';
    var subject = p.subject || 'Test';
    var md = this._formatMD(p.due);
    var testTitle = subject + ' ' + routeType + (md ? ' ' + md : '');
    this.state.tests.unshift({
      id: this.uid(), created: Date.now(),
      title: testTitle, subject: subject,
      type: routeType, date: p.due,
      score: null, maxScore: 100,
      notes: p.notes || '',
      assignmentType: p.assignmentType || '',
      entities: p.entities || { chapters: [], pages: [], urls: [], people: [], quoted: [] },
      linkedTaskIds: (p.entityResolution || []).map(function(m){return m.taskId;})
    });
  },
  // Format an ISO date (YYYY-MM-DD) as M/D with no zero-padding ("6/19" not "06/19").
  // Returns an empty string for falsy/invalid input so callers can detect the no-date case.
  _formatMD: function(dateStr) { return parserFormatMD(dateStr); },

  // Push a Task record from a parsed element (templated subtasks, persisted entities + links).
  _pushTaskFromParsed: function(p) {
    var tpl = this.getTemplateForAssignmentType(p.assignmentType);
    var subtasks = [];
    if (tpl && tpl.subtasks) {
      var self = this;
      subtasks = tpl.subtasks.map(function(st) {
        return { id: self.uid(), text: st.text, done: false };
      });
    }
    this.state.tasks.unshift({
      id: this.uid(), created: Date.now(),
      title: p.title, subject: p.subject, due: p.due,
      time: p.time, priority: p.priority, status: p.status,
      notes: p.notes, recurring: '',
      subtasks: subtasks,
      assignmentType: p.assignmentType || '',
      entities: p.entities || { chapters: [], pages: [], urls: [], people: [], quoted: [] },
      linkedTaskIds: (p.entityResolution || []).map(function(m){return m.taskId;})
    });
  },

  _escRegex: function(s) { return parserEscRegex(s); },

  // Weighted keyword-scoring for intent classification.
  // Scores raw input across three dimensions (test / study / task).
  // Writes result.intentScores and back-compat flags result.isTestLike / result.isProjectLike.
  _scoreIntents: function(raw, result) { parserScoreIntents(raw, result); },

  // ── TIER 5: AUTO-SIBLINGS ──
  // Run AFTER the per-element routing loop in confirmQuickAdd. For each
  // parsed intent that mentions a test / project / uses the "study" verb,
  // push ONE complementary record (the "buddy") so the user doesn't have
  // to manually create both halves — creating a test primes a study task,
  // and adding a study session primes a matching test.
  //
  // Rules (matched per intent):
  //   testDominant + subjectOk           → push a "study" task buddy
  //   actionVerb === 'study' + subjectOk → push a test buddy
  //   isProjectLike + subjectOk          → push a "prep" task buddy
  //
  // "review" intentionally does NOT spawn test buddies — scalar inputs
  // like "review history essay" or "review biology chapter 4" don't imply
  // an exam. The explicit "study" verb is the only verb whose presence
  // reliably signals test prep.
  //
  // Dedup kicks in to prevent the multiplier effect: if a buddy would
  // match an existing record's (subject, due, title) tuple, skip it.
  // Multi-intent inputs like "math test friday and study math friday"
  // naturally produce 1 test + 1 study without doubling.
  //
  // Returns { addedTest, addedTask } so confirmQuickAdd can update the
  // render-after hint about whether to switch tabs.
  _autoSiblings: function(parsedArr, raw) {
    var self = this;
    var addedTest = false, addedTask = false;
    parsedArr.forEach(function(p) {
      // Subject-confidence gate applied UNIFORMLY to all three rules. Only
      // push a buddy when the parser actually identified a real subject
      // (exact / synonym / fuzzy match → confidence ≥ 0.6). Otherwise the
      // parser fell back to subjects[0] and any phantom record we push
      // would be a duplicate of the wrong subject (e.g. "study" alone →
      // subject falls back to "Math" → we'd push a phantom Math test).
      var subjectOk = !!(p.confidence && p.confidence.subject >= 0.6);
      // 1) Test-intent dominates → push a "study" task buddy.
      //    Gated on subjectOk so orphan-subject test inputs don't spawn
      //    a wrong-subject study task.
      var s = p.intentScores || { test: 0, study: 0, task: 0 };
      var testDominant = s.test > s.task && s.test > 0;
      if (testDominant && subjectOk) {
        if (!self._hasTaskBuddy(p.subject, p.due, 'study')) {
          self._pushTaskFromParsed(self._siblingTaskP(p, 'study', 'review'));
          addedTask = true;
        }
      }
      // 2) Leading "study" verb + valid subject → push a matching test record.
      if (p.actionVerb === 'study' && subjectOk) {
        if (!self._hasTestBuddy(p.subject, p.due)) {
          self._pushTestFromParsed(self._siblingTestP(p), raw);
          addedTest = true;
        }
      }
      // 3) Project-type intent → push a "prep" task buddy.
      //    Same gate so "presentation" alone (subject=Other) doesn't spawn
      //    a wrong-subject prep task.
      if (p.isProjectLike && subjectOk) {
        if (!self._hasTaskBuddy(p.subject, p.due, 'prep')) {
          self._pushTaskFromParsed(self._siblingTaskP(p, 'prep', 'review'));
          addedTask = true;
        }
      }
    });
    return { addedTest: addedTest, addedTask: addedTask };
  },
  // Build a synthetic parsed-task shape for a buddy. _pushTaskFromParsed
  // does the heavy lifting (template selection + persistence).
  _siblingTaskP: function(p, title, assignmentType) {
    return {
      title: title,
      subject: p.subject,
      due: p.due,
      time: 0,
      priority: 'Medium',
      status: 'pending',
      notes: '',
      recurring: '',
      assignmentType: assignmentType,
      entities: { chapters: [], pages: [], urls: [], people: [], quoted: [] },
      linkedTaskIds: [],
      // Synthetic fields are intentionally inferred, not guessed — flag
      // them as confident-default so a re-opened preview doesn't show
      // them as low-confidence (which would mislead the user).
      confidence: { subject: 1, title: 1, due: 1, time: 0.3, priority: 0.7 },
      actionVerb: null,
      intentScores: { test: 0, study: 0, task: 0 },
    };
  },
  // Build a synthetic parsed-test shape for the buddy. _pushTestFromParsed
  // strips the assignmentType prefix from `title` so we pass the subject
  // name directly (matches the test-routing branch's "Math" output).
  _siblingTestP: function(p) {
    return {
      title: p.subject,
      subject: p.subject,
      due: p.due,
      assignmentType: '',
      entities: { chapters: [], pages: [], urls: [], people: [], quoted: [] },
      linkedTaskIds: [],
      intentScores: { test: 5, study: 0, task: 0 },
      isTestLike: true,
      isProjectLike: false,
      actionVerb: null,
      confidence: { subject: 1, title: 1, due: 1, time: 0.3, priority: 0.7 }
    };
  },
  _hasTaskBuddy: function(subject, due, title) {
    return this.state.tasks.some(function(t) {
      return t.subject === subject && (t.due || '') === (due || '') && t.title === title;
    });
  },
  _hasTestBuddy: function(subject, due) {
    return this.state.tests.some(function(t) {
      return t.subject === subject && (t.date || '') === (due || '');
    });
  },

  parseQuickAdd: function(raw) { return parseQuickAdd(this, raw); },
    renderSynonymList: function() { renderSynonymList(); },
  addSynonymFromUI: function() { addSynonymFromUI(); },
  populateSynonymSelect: function() { populateSynonymSelect(); },
  getCustomSynonyms: function() { return getCustomSynonyms(); },
  removeCustomSynonym: function(s) { removeCustomSynonym(s); renderSynonymList(); },


  openStudyTimer: function(testId) { openStudyTimer(testId); },
  closeTimer: function() { closeTimer(); },
  setTimerPreset: function(btn, mins) { setTimerPreset(btn, mins); },
  toggleTimer: function() { toggleTimer(); },
  resetTimer: function() { resetTimer(); },
  updateTimerDisplay: function() { updateTimerDisplay(); },
  // ── Templates ──
  // ── Templates ──
  renderTemplateList: function() { renderTemplateList(); },
  applyTemplate: function(tplId) { applyTemplate(tplId); },
  saveAsTemplate: function() { saveAsTemplate(); },
  buildAndExtendCompromisePlugin: buildAndExtendCompromisePlugin,
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
    // Init voice module (hides mic button if unsupported)
    if (typeof Voice !== 'undefined' && Voice.init) Voice.init();
    buildAndExtendCompromisePlugin();
    renderQuickAddHistory();
    // Resume auto time-of-day theme scheduler if it was enabled last session.
    if (typeof startAutoThemeScheduler === 'function') startAutoThemeScheduler();
    renderTemplateList();
    var self = this;
    document.addEventListener('keydown', function(e) {
      // Voice shortcut: Ctrl+Shift+V (works everywhere, including form fields)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        if (typeof Voice !== 'undefined') Voice.toggle();
        return;
      }
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
      // q / Q → focus quick-add bar
      if (key === 'q') { e.preventDefault(); var qa=document.getElementById('qa-input'); if(qa) qa.focus(); return; }

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
    self.closeModal(); self.closeSettings(); self.closeTestModal(); self.closeTimer(); self.closeFlashcards();
};

window.addEventListener('DOMContentLoaded', function() { App.init(); });
