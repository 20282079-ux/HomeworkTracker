// 6-settings.js (split from app.js) — settings modal, subjects CRUD, exports
function openSettings() {
  renderSubjectList();
  syncColorInputs();
  renderTemplateList();
  // Sync the sound-toggle checkbox on settings open so it reflects the
  // current persisted state (defaulting to ON if never set).
  var ssnd = document.getElementById('s-sound');
  if (ssnd && typeof _soundEnabled !== 'undefined') ssnd.checked = _soundEnabled;
  // Populate the hold-key inputs from the persisted map.
  var hk = (typeof getHoldKeys === 'function') ? getHoldKeys() : { focus:'f', nightSky:'n' };
  var fEl = document.getElementById('hk-focus');
  var nEl = document.getElementById('hk-nightsky');
  if (fEl) fEl.value = hk.focus || '';
  if (nEl) nEl.value = hk.nightSky || '';
  // Sync auto-theme toggle to reflect persisted localStorage state.
  var autoThemeEl = document.getElementById('s-auto-theme');
  if (autoThemeEl) { try { autoThemeEl.checked = localStorage.getItem('hw_auto_theme') === '1'; } catch(e) { /* localStorage may be full or disabled */ } }
  document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); save(); }
function closeSettingsOutside(e) { if (e.target.id === 'settings-modal') closeSettings(); }

function applyColor(varName, value) {
  document.documentElement.style.setProperty(varName, value);
  syncColorInputs();
}

function syncColorText(varName, colorId, textId) {
  const val = document.getElementById(textId).value;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    document.documentElement.style.setProperty(varName, val);
    document.getElementById(colorId).value = val;
  }
}

function syncColorInputs() {
  const style = getComputedStyle(document.documentElement);
  const pairs = [
    ['--bg','c-bg','ct-bg'],
    ['--bg2','c-surface','ct-surface'],
    ['--accent','c-accent','ct-accent'],
    ['--text','c-text','ct-text'],
    ['--border','c-border','ct-border'],
  ];
  pairs.forEach(([v, cid, tid]) => {
    const val = style.getPropertyValue(v).trim();
    const el = document.getElementById(cid);
    const tel = document.getElementById(tid);
    if (el && isValidHex(val)) el.value = val;
    if (tel) tel.value = val;
  });
}

function isValidHex(s) { return /^#[0-9a-fA-F]{6}$/.test(s.trim()); }

const PRESETS = {
  midnight: { '--bg':'#0e0f1a','--bg2':'#13141f','--bg3':'#1a1b2e','--surface':'#1e2035','--surface2':'#252740','--border':'#2a2d4a','--text':'#e8eaf6','--text2':'#8b90c1','--text3':'#7179aa','--accent':'#7c6af7','--accent2':'#a78bfa','--accent-glow':'rgba(124,106,247,0.18)' },
  forest: { '--bg':'#0b1a12','--bg2':'#0f2019','--bg3':'#152a1e','--surface':'#1a3226','--surface2':'#1e3d2d','--border':'#234d35','--text':'#d4f0df','--text2':'#7ab88e','--text3':'#518f66','--accent':'#3ecf6c','--accent2':'#6ee89a','--accent-glow':'rgba(62,207,108,0.18)' },
  ocean: { '--bg':'#071523','--bg2':'#0b1e30','--bg3':'#0f263c','--surface':'#132e48','--surface2':'#17375a','--border':'#1d4468','--text':'#cce8ff','--text2':'#6aaddb','--text3':'#4586a8','--accent':'#2a8fd4','--accent2':'#5bbaee','--accent-glow':'rgba(42,143,212,0.18)' },
  sunset: { '--bg':'#1a0f0a','--bg2':'#22140d','--bg3':'#2a1a10','--surface':'#33200e','--surface2':'#3e280d','--border':'#5a3a14','--text':'#fde8cd','--text2':'#d4935a','--text3':'#ad6f3e','--accent':'#f97316','--accent2':'#fb923c','--accent-glow':'rgba(249,115,22,0.18)' },
  rose: { '--bg':'#1a0d14','--bg2':'#22111a','--bg3':'#2c1520','--surface':'#361825','--surface2':'#40192b','--border':'#5e2438','--text':'#fde4ef','--text2':'#d47a9e','--text3':'#b05180','--accent':'#e83a7a','--accent2':'#f472b6','--accent-glow':'rgba(232,58,122,0.18)' },
  // Stripe-inspired light theme — cool slate-blue background with
  // crisp white cards. bg (#ecf1f6) is 6% below pure white with a
  // +10 blue bias so it reads as a clear tint, not a washed-out near-
  // white. Cards (bg2 = #fff) float on top via subtle shadow.
  // Depth: bg3 (darkest, receding inputs) → bg (surface ground) →
  // surface2 → surface → bg2 (white, forward cards).
  light: { '--bg':'#ecf1f6','--bg2':'#ffffff','--bg3':'#e1e7f0','--surface':'#f5f7fc','--surface2':'#eff2f8','--border':'#c9d2e0','--text':'#0f1117','--text2':'#475066','--text3':'#758097','--accent':'#2563eb','--accent2':'#3b82f6','--accent-glow':'rgba(37,99,235,0.18)' },
  // Bright afternoon-sky blue — feels like a clear day. White cards
  // float on a noticeably blue-tinted background. Starfield handles
  // the sky gradient; the body mesh is hidden for daytime.
  // Depth: bg3 (darkest, receding inputs) → bg (sky ground) →
  // surface2 → surface → bg2 (white, forward cards).
  daytime: { '--bg':'#e3edf8','--bg2':'#ffffff','--bg3':'#d7e3f0','--surface':'#f3f7fc','--surface2':'#edf3f9','--border':'#c2cfe0','--text':'#0e121d','--text2':'#444e68','--text3':'#6f7b99','--accent':'#2563eb','--accent2':'#3b82f6','--accent-glow':'rgba(37,99,235,0.16)' },
  dawn: { '--bg':'#fef7ed','--bg2':'#fdf0d5','--bg3':'#fde4bf','--surface':'#faecd0','--surface2':'#f5e0b8','--border':'#e5c98a','--text':'#2d1a0c','--text2':'#6b4423','--text3':'#9a6b3e','--accent':'#d84a00','--accent2':'#f97316','--accent-glow':'rgba(216,74,0,0.15)' },
  dusk: { '--bg':'#1a0f0a','--bg2':'#22140d','--bg3':'#2a1a10','--surface':'#33200e','--surface2':'#3e280d','--border':'#5a3a14','--text':'#fde8cd','--text2':'#d4935a','--text3':'#ad6f3e','--accent':'#f97316','--accent2':'#fb923c','--accent-glow':'rgba(249,115,22,0.18)' },
  coffee: { '--bg':'#16100b','--bg2':'#1e1510','--bg3':'#261c15','--surface':'#2e231b','--surface2':'#382b21','--border':'#4e3d2e','--text':'#f5e6d0','--text2':'#b09070','--text3':'#8a7564','--accent':'#c8813f','--accent2':'#e8a460','--accent-glow':'rgba(200,129,63,0.18)' },
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.entries(p).forEach(([k,v]) => document.documentElement.style.setProperty(k, v));
  // Persist the preset name so the theme-* class is restored on the
  // next page load. Without this the CSS selectors that depend on
  // html.theme-light (body::before mesh, #starfield/#constellation-panel
  // hide rules) stop matching after a refresh.
  try { localStorage.setItem('hw_preset', name); } catch (e) { /* non-critical — best-effort persistence */ }
  // Re-theme the starfield canvas to match the new color scheme —
  // unique constellation palette per theme + sky gradient swap.
  // `applyStarfieldTheme` is defined in gamification.js and reaches
  // every already-built slot's CSS vars + redraws lines per theme.
  if (typeof applyStarfieldTheme === 'function') applyStarfieldTheme(name);
  syncColorInputs();
  toast(`Theme: ${name} ✓`, 'success');
}

function resetSettings() {
  applyPreset('midnight');
  applyRadius(14);
  document.getElementById('s-radius').value = 14;
}

function applyRadius(v) {
  document.documentElement.style.setProperty('--radius', v + 'px');
  document.getElementById('radius-val').textContent = v + 'px';
}

function renderSubjectList() {
  const container = document.getElementById('subject-list');
  container.innerHTML = '';
  subjects.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'subject-item';
    div.innerHTML = `
      <div class="subject-dot" style="background:${escHtml(s.color)}"></div>
      <input type="text" id="subj-name-${i}" name="subj-name-${i}" value="${escHtml(s.name)}" onchange="subjects[${i}].name=this.value;renderFilterChips();populateSubjectSelects();filterTasks()" />
      <input type="color" id="subj-color-${i}" name="subj-color-${i}" value="${escHtml(s.color)}" oninput="subjects[${i}].color=this.value;renderSubjectList();renderFilterChips();filterTasks()" title="Color" />
      <button class="task-act-btn del" onclick="removeSubject(${i})" title="Remove">✕</button>
    `;
    container.appendChild(div);
  });
}

function addSubject() {
  const nameEl = document.getElementById('new-subject-name');
  const colorEl = document.getElementById('new-subject-color');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }
  if (subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) { toast('Subject already exists', 'error'); return; }
  subjects.push({ name, color: colorEl.value });
  nameEl.value = '';
  save();
  render();
  renderSubjectList();
  toast(`Subject "${name}" added ✓`, 'success');
}

function removeSubject(i) {
  if (!confirm(`Remove subject "${subjects[i].name}"? Tasks will stay but lose their subject color.`)) return;
  subjects.splice(i, 1);
  save();
  render();
  renderSubjectList();
}

function populateSubjectSelects() {
  ['m-subject'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = subjects.map(s => `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`).join('');
    if (subjects.find(s => s.name === cur)) sel.value = cur;
  });
  // also refresh test modal subject select if open
  populateTestSubjectSelect(document.getElementById('t-subject')?.value);
}

function exportCSV() {
  const header = ['Title','Subject','Priority','Status','Due Date','Est. Time (min)','Notes','Recurring'];
  const rows = tasks.map(t => [t.title, t.subject, t.priority, t.status, t.due||'', t.time||'', t.notes||'', t.recurring||''].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'homework-tracker.csv';
  a.click();
  toast('Exported to CSV ✓', 'success');
}

function exportICS() {
  var pending = tasks.filter(function(t) { return t.status !== 'done' && t.due; });
  if (pending.length === 0) { toast('No pending tasks with due dates to export', 'error'); return; }
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Homework Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  pending.forEach(function(t) {
    var d = t.due.split('-');
    var ymd = d[0] + String(d[1]).padStart(2,'0') + String(d[2]).padStart(2,'0');
    var subj = t.subject || 'Other';
    var priority = t.priority === 'Urgent' ? '1' : t.priority === 'High' ? '3' : t.priority === 'Medium' ? '5' : '9';
    var desc = (t.notes || '').replace(/\n/g, '\\n');
    if (t.time) desc += (desc ? '\\n' : '') + 'Estimated time: ' + t.time + ' min';
    desc += (desc ? '\\n' : '') + 'Priority: ' + t.priority;
    // Escape special characters for iCalendar
    var summary = (t.title + ' — ' + subj).replace(/,/g, '\\,').replace(/;/g, '\\;');
    desc = desc.replace(/,/g, '\\,').replace(/;/g, '\\;');
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + t.id + '@homework-tracker');
    lines.push('DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''));
    lines.push('DTSTART;VALUE=DATE:' + ymd);
    lines.push('DTEND;VALUE=DATE:' + ymd);
    lines.push('SUMMARY:' + summary);
    if (desc) lines.push('DESCRIPTION:' + desc);
    lines.push('PRIORITY:' + priority);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  var icsContent = lines.join('\r\n');
  var blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'homework-tracker.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Exported ' + pending.length + ' events to Google Calendar ✓', 'success');
}
