// 4-tasks.js (split from app.js) — render, filter, buildCard, saveTask, toggleDone, deleteTask, undo, pin, daily/weekly reset, modal helpers
//
// Perf notes:
// - buildCard O(n) subject lookup → cached as a single hash map per render.
let _subjByName = {}; // populated by filterTasks() so buildCard is O(1) per card
function render() {
  renderFilterChips();
  filterTasks();
  renderStats();
  syncColorInputs();
  renderSubjectList();
  populateSubjectSelects();
  updateTitle(document.getElementById('s-title').value || 'Homework Tracker');
}

function renderStats() {
  const today = todayStr();
  const soon = soonStr();
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.due && t.due < today).length;
  const dueSoon = tasks.filter(t => t.status !== 'done' && t.due && t.due >= today && t.due <= soon).length;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-overdue').textContent = overdue;
  document.getElementById('stat-soon').textContent = dueSoon;
  const pct = total ? Math.round((done/total)*100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('pct-label').textContent = pct + '%';
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function soonStr() { const d = new Date(); d.setDate(d.getDate()+3); return d.toISOString().split('T')[0]; }

function filterTasks() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const sort = document.getElementById('sort-select').value;
  const statusF = document.getElementById('status-filter').value;
  const showDone = document.getElementById('s-show-done').checked;
  const grouped = document.getElementById('s-group').checked;

  // Build the subject-by-name hash ONCE per render — every buildCard call
  // below hits this cache so the cardinality drops from O(tasks × subjects)
  // to O(tasks).
  _subjByName = {};
  for (var si = 0; si < subjects.length; si++) _subjByName[subjects[si].name] = subjects[si];

  let list = tasks.filter(t => {
    if (!showDone && t.status === 'done') return false;
    if (statusF === 'pending' && t.status === 'done') return false;
    if (statusF === 'done' && t.status !== 'done') return false;
    if (activeFilter !== 'All' && t.subject !== activeFilter) return false;
    if (search && !t.title.toLowerCase().includes(search) && !t.notes.toLowerCase().includes(search) && !t.subject.toLowerCase().includes(search)) return false;
    return true;
  });

  // Pinned tasks always float to top (within their sort group)
  list.sort((a,b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (sort === 'due') {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    }
    if (sort === 'priority') return (PRIO_WEIGHT[b.priority]||0) - (PRIO_WEIGHT[a.priority]||0);
    if (sort === 'subject') return a.subject.localeCompare(b.subject);
    if (sort === 'alpha') return a.title.localeCompare(b.title);
    return b.created - a.created;
  });

  const container = document.getElementById('tasks-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="emoji">✅</span>${tasks.length === 0 ? 'No assignments yet — hit <b>+ Add Task</b> to begin!' : 'No tasks match your filters.'}</div>`;
    renderStats();
    return;
  }

  if (grouped) {
    const groups = {};
    list.forEach(t => { if (!groups[t.subject]) groups[t.subject] = []; groups[t.subject].push(t); });
    Object.entries(groups).forEach(([sub, items]) => {
      const gh = document.createElement('div');
      gh.className = 'group-header';
      const subj = subjects.find(s => s.name === sub);
      gh.innerHTML = `<span style="color:${escHtml(subj ? subj.color : '#fff')}">${escHtml(sub)}</span> <span style="opacity:.4">(${items.length})</span>`;
      container.appendChild(gh);
      items.forEach((t,i) => container.appendChild(buildCard(t, i)));
    });
  } else {
    list.forEach((t,i) => container.appendChild(buildCard(t, i)));
  }

  renderStats();
}

function buildCard(t, index) {
  const today = todayStr();
  const soon = soonStr();
  const isOverdue = t.status !== 'done' && t.due && t.due < today;
  const isSoon = t.status !== 'done' && t.due && t.due >= today && t.due <= soon;
  const isDone = t.status === 'done';
  // O(1) lookup via the per-render hash map populated by filterTasks().
  const subj = _subjByName[t.subject] || { color: '#7c6af7' };

  const card = document.createElement('div');
  card.style.animationDelay = (index * 0.04) + 's';

  // Due badge
  let dueBadge = '';
  if (t.due) {
    const d = getDaysLeft(t.due);
    if (d < 0) dueBadge = `<span class="badge badge-overdue">⚠ Overdue ${Math.abs(d)}d</span>`;
    else if (d === 0) dueBadge = `<span class="badge badge-today">⏰ Due today</span>`;
    else if (d <= 3) dueBadge = `<span class="badge badge-soon">⚡ ${d}d left</span>`;
    else dueBadge = `<span class="badge badge-due">📅 ${formatDate(t.due)}</span>`;
  }

  const timeBadge = t.time ? `<span class="badge badge-due">⏱ ${t.time}m</span>` : '';
  const statusBadge = t.status === 'in-progress' ? `<span class="badge" style="background:rgba(96,165,250,.15);color:#60a5fa;border-color:rgba(96,165,250,.3)">In Progress</span>` : '';

  const pinnedClass = t.pinned ? ' pinned' : '';
  card.className = `task-card${isDone ? ' done' : ''}${isOverdue ? ' overdue' : ''}${isSoon && !isOverdue ? ' due-soon' : ''}${compactMode ? ' compact' : ''}${pinnedClass}`;

  card.innerHTML = `
    <div class="task-strip" style="background:${escHtml(subj.color)}"></div>
    <button class="star-btn${t.pinned ? ' starred' : ''}" onclick="togglePin('${escJsAttr(t.id)}')" title="${t.pinned ? 'Unpin' : 'Pin task'}">${t.pinned ? '⭐' : '☆'}</button>
    <div class="task-checkbox${isDone ? ' checked' : ''}" onclick="toggleDone('${escJsAttr(t.id)}')">
      <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4L4.5 7.5L11 1" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="task-body">
      <div class="task-title">${escHtml(t.title)}</div>
      ${t.notes ? `<div class="task-note">${escHtml(t.notes)}</div>` : ''}
      <div class="task-meta">
        <span class="badge" style="background:${hexToRgba(subj.color,.15)};color:${escHtml(subj.color)};border-color:${hexToRgba(subj.color,.3)}">${escHtml(t.subject)}</span>
        <span class="badge badge-priority-${escHtml(t.priority)}">${escHtml(t.priority)}</span>
        ${statusBadge}
        ${dueBadge}
        ${timeBadge}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-act-btn edit" onclick="openEdit('${escJsAttr(t.id)}')" title="Edit">✎</button>
      <button class="task-act-btn del" onclick="deleteTask('${escJsAttr(t.id)}')" title="Delete">✕</button>
    </div>
  `;
  return card;
}

function getDaysLeft(due) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(due); d.setHours(0,0,0,0);
  return Math.ceil((d - today) / 86400000);
}

function formatDate(s) {
  const [y,m,d] = s.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m-1]} ${+d}`;
}

function renderFilterChips() {
  const container = document.getElementById('filter-chips');
  container.innerHTML = `<button class="chip${activeFilter==='All'?' active':''}" data-filter="All" onclick="setFilter(this)">All</button>`;
  subjects.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (activeFilter === s.name ? ' active' : '');
    btn.dataset.filter = s.name;
    btn.onclick = function() { setFilter(this); };
    btn.textContent = s.name;
    if (activeFilter === s.name) {
      btn.style.background = s.color;
      btn.style.borderColor = s.color;
    }
    container.appendChild(btn);
  });
}

function setFilter(btn) {
  activeFilter = btn.dataset.filter;
  document.querySelectorAll('.filter-chips .chip').forEach(c => {
    c.classList.remove('active');
    c.style.background = '';
    c.style.borderColor = '';
    c.style.color = '';
  });
  btn.classList.add('active');
  if (activeFilter !== 'All') {
    const subj = subjects.find(s => s.name === activeFilter);
    if (subj) { btn.style.background = subj.color; btn.style.borderColor = subj.color; btn.style.color = '#fff'; }
  }
  filterTasks();
}

// ═══════════════════════════════════════
//  ADD / EDIT TASKS
// ═══════════════════════════════════════
function openAddForm() {
  editingId = null;
  document.getElementById('modal-title').textContent = '📝 New Assignment';
  clearModalForm();
  openModal();
}

function openEdit(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('modal-title').textContent = '✏️ Edit Assignment';
  document.getElementById('m-title').value = t.title;
  document.getElementById('m-subject').value = t.subject;
  document.getElementById('m-notes').value = t.notes || '';
  document.getElementById('m-due').value = t.due || '';
  document.getElementById('m-priority').value = t.priority;
  document.getElementById('m-time').value = t.time || '';
  document.getElementById('m-status').value = t.status;
  openModal();
}

function saveTask() {
  const title = document.getElementById('m-title').value.trim();
  if (!title) {
    document.getElementById('m-title').classList.add('shake');
    setTimeout(() => document.getElementById('m-title').classList.remove('shake'), 400);
    return;
  }
  const data = {
    title,
    subject: document.getElementById('m-subject').value,
    notes: document.getElementById('m-notes').value.trim(),
    due: document.getElementById('m-due').value,
    priority: document.getElementById('m-priority').value,
    time: parseInt(document.getElementById('m-time').value) || 0,
    status: document.getElementById('m-status').value,
  };
  if (editingId) {
    const idx = tasks.findIndex(t => t.id === editingId);
    if (idx > -1) tasks[idx] = { ...tasks[idx], ...data };
    toast('Task updated ✓', 'success');
  } else {
    tasks.unshift({ id: uid(), created: Date.now(), ...data });
    toast('Task added ✓', 'success');
  }
  save();
  render();
  closeModal();
}

// Unified "mark complete and remove" path. Per user request, checking off a
// task AND tapping the delete button both go through this same flow. Both
// entry points set status='done' then remove the task from the array; the
// 5-second undo toast gives the user a generous window to recover from
// accidental taps.
function _markCompleteAndRemove(id) {
  const t = tasks.find(function(x){return x.id === id;});
  if (!t) return;
  const wasDone = t.status === 'done';

  // Mark done then remove from array.
  t.status = 'done';
  lastDeleted = { task: Object.assign({}, t), index: tasks.findIndex(function(x){return x.id === id;}) };
  tasks = tasks.filter(function(x){return x.id !== id;});

  // Side-effects: confetti (when on), completion click, persist, refresh view.
  // ── Data integrity: save BEFORE side-effects so a crash mid-render doesn't lose state. ──
  save();
  if (!wasDone && document.getElementById('s-confetti') && document.getElementById('s-confetti').checked) launchConfetti();
  if (!wasDone && typeof playClick === 'function') playClick();
  filterTasks();
  renderStats();

  // Undo toast — uses the same DOM pattern as the legacy deleteTask toast.
  if (undoTimer) clearTimeout(undoTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.id = 'undo-toast';
  el.innerHTML = '<span>✓ Task removed</span><button class="toast-undo" onclick="undoDelete()">Undo</button>';
  document.getElementById('toast-container').appendChild(el);
  undoTimer = setTimeout(function() { el.remove(); lastDeleted = null; }, 5000);
}

// toggleDone and deleteTask now BOTH call _markCompleteAndRemove —
// tapping the checkbox OR the delete button yield the same behavior.
// skipConfirm=true is preserved on deleteTask for callers that bypass the
// native confirm() (currently no in-page callers, but kept for parity).
function toggleDone(id) { _markCompleteAndRemove(id); }
function deleteTask(id, skipConfirm) { void skipConfirm; _markCompleteAndRemove(id); }

let lastDeleted = null;
let undoTimer = null;

function undoDelete() {
  if (!lastDeleted) return;
  tasks.splice(lastDeleted.index, 0, lastDeleted.task);
  lastDeleted = null;
  if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
  document.getElementById('undo-toast')?.remove();
  save();
  render();
  toast('Task restored ✓', 'success');
}

function togglePin(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.pinned = !t.pinned;
  save();
  filterTasks();
}

function clearAllTasks() {
  if (!confirm('Delete ALL tasks? This cannot be undone.')) return;
  tasks = [];
  save();
  render();
  toast('All tasks cleared', 'error');
  closeSettings();
}

function clearModalForm() {
  ['m-title','m-notes','m-due','m-time'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-priority').value = 'Medium';
  document.getElementById('m-status').value = 'pending';
  document.getElementById('m-subject').value = subjects[0]?.name || '';
}

function openModal() { document.getElementById('task-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('task-modal').classList.add('hidden'); editingId = null; }
function closeModalOutside(e) { if (e.target.id === 'task-modal') closeModal(); }

