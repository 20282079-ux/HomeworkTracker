// 6-settings.js (split from app.js) — settings modal, subjects CRUD, exports, course synonyms
function openSettings() {
  renderSubjectList();
  syncColorInputs();
  populateSynonymSelect();
  renderSynonymList();
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
  // Populate AI provider, model, and keys from localStorage.
  if (typeof Voice !== 'undefined') {
    var provEl = document.getElementById('s-ai-provider');
    if (provEl) provEl.value = Voice.getProvider();
    var modelEl = document.getElementById('s-ai-model');
    if (modelEl) {
      // Populate model dropdown based on current provider
      var models = Voice.getProvider() === 'openrouter' ? Voice.OPENROUTER_MODELS : Voice.GEMINI_MODELS;
      modelEl.innerHTML = '';
      models.forEach(function(m) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        modelEl.appendChild(opt);
      });
      modelEl.value = Voice.getModel();
    }
    var orKeyEl = document.getElementById('s-openrouter-key');
    if (orKeyEl) orKeyEl.value = Voice.getOpenRouterKey();
    var gemKeyEl = document.getElementById('s-gemini-key');
    if (gemKeyEl) gemKeyEl.value = Voice.getGeminiKey();
    // Show/hide key fields based on provider
    var prov = Voice.getProvider();
    var orDiv = document.getElementById('ai-key-openrouter');
    var gemDiv = document.getElementById('ai-key-gemini');
    if (orDiv) orDiv.style.display = (prov === 'openrouter') ? '' : 'none';
    if (gemDiv) gemDiv.style.display = (prov === 'gemini') ? '' : 'none';
  }
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
      <div class="subject-dot" style="background:${s.color}"></div>
      <input type="text" id="subj-name-${i}" name="subj-name-${i}" value="${escHtml(s.name)}" onchange="subjects[${i}].name=this.value;renderFilterChips();populateSubjectSelects();filterTasks();populateSynonymSelect();renderSynonymList()" />
      <input type="color" id="subj-color-${i}" name="subj-color-${i}" value="${s.color}" oninput="subjects[${i}].color=this.value;renderSubjectList();renderFilterChips();filterTasks()" title="Color" />
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
  populateSynonymSelect();
  renderSynonymList();
  if (typeof App !== 'undefined' && App.buildAndExtendCompromisePlugin) App.buildAndExtendCompromisePlugin();
  toast(`Subject "${name}" added ✓`, 'success');
}

function removeSubject(i) {
  if (!confirm(`Remove subject "${subjects[i].name}"? Tasks will stay but lose their subject color.`)) return;
  subjects.splice(i, 1);
  save();
  render();
  renderSubjectList();
  populateSynonymSelect();
  renderSynonymList();
  if (typeof App !== 'undefined' && App.buildAndExtendCompromisePlugin) App.buildAndExtendCompromisePlugin();
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

// ═══════════════════════════════════════
var COURSE_CATEGORIES = {
  'history': [
    'history','hist','social studies','government','gov','us history','american history',
    'world history','world','civics','polisci','political science','apush',
    'euro','european history','us gov','american gov','comp gov','comparative government',
    'human geo','human geography','ap human','macro','micro','economics','econ',
    'ap gov','ap world','ap euro','ap world history','ap us history','ap european',
    'ap government','honors history'
  ],
  'english': [
    'english','eng','ela','language arts','writing','literature','lit',
    'ap seminar','seminar','composition','comp','rhetoric','speech',
    'lang','ap lang','ap lit','ap language','ap literature',
    'honors english','honors lit','creative writing','journalism',
    'english lang','english lit','english language','ap english',
    'honors language'
  ],
  'math': [
    'math','mathematics','algebra','geometry','calculus','calc',
    'trig','trigonometry','stats','statistics','precalc','precalculus',
    'arith','arithmetic','ap calc','ap stats','calc ab','calc bc',
    'ap calculus','ap statistics','honors math','honors calc','honors precalc',
    'algebra 1','algebra 2','algebra i','algebra ii',
    'maths','mathe'
  ],
  'science': [
    'science','chem','chemistry','bio','biology','physics','phys',
    'earth science','environmental science','enviro','lab science',
    'ap bio','ap chem','ap physics','ap environmental','ap enviro',
    'ap biology','ap chemistry','honors bio','honors chem','honors physics',
    'anatomy','physiology','astronomy','marine bio','marine biology',
    'ap science','honors science','ap environmental science'
  ],
  'engineering': [
    'engineering','engineer','engr','design','tech','technology','robotics',
    'ap engineering','honors engineering'
  ],
  'hebrew': ['hebrew','jewish','judaic','judaica','tanakh','torah'],
  'sociology': [
    'sociology','soc','social science','psychology','psych','psy',
    'ap psych','ap psychology','ap soc','ap sociology',
    'honors psych','honors sociology'
  ],
  'art': [
    'art','music','band','choir','photography','drama','theater','theatre',
    'film','media','photo','sketch','painting','drawing','craft',
    'ap art','ap music','ap studio','ap drawing','ap studio art',
    'ap 2d','ap 3d','orchestra','chorus','honors art',
    'ceramics','sculpture','digital art','graphic design'
  ],
  'pe': [
    'pe','health','gym','physical education','fitness','sports','athletics',
    'wellness','honors pe'
  ],
  'cs': [
    'cs','computer science','programming','coding','python','javascript','java','web dev',
    'ap cs','compsci','comp sci','apcsa','apcsp','ap computer science','ap comp sci',
    'honors cs','computer programming'
  ],
  'language': [
    'spanish','french','latin','german','mandarin','chinese','japanese','korean',
    'language','foreign language','lote',
    'ap spanish','ap french','ap latin','ap chinese','ap japanese','ap german',
    'honors spanish','honors french','asl','sign language','american sign language','italian'
  ],
};

var CATEGORY_TYPOS = {
  'history': [
    'histoy','histry','histroy','hisotry','hitsory',
    'apushs','goverment','governemnt','govermnent',
    'econmics','econimcs','macroecon','microecon'
  ],
  'english': [
    'englsih','englsh','engish','englih','enlgish','englihs',
    'langauge','langugae','langage','languge','langguage',
    'litrature','literture','literatue','seminar'
  ],
  'math': [
    'algebr','algebraa','aplgebra','algebrs','algeba','algebgra',
    'algerba','algbera','maths','matn','mathe',
    'clac','clculus','calclus','calulus','calclulus',
    'trigonmetry','trigonomtry','trignometry',
    'precal','precalclus','precalcus'
  ],
  'science': [
    'chemsitry','chemsitr','chemstry','chemestry','chemstiry',
    'biolgy','biolgoy','biolog','bioloy','bilogy',
    'phyiscs','phisics','phsyics','physcis',
    'scinece','sciense','sciecne','scence'
  ],
  'sociology': [
    'sociolgy','socioloy','socilogy','psycholgy','psycholoy',
    'psycholgoy','psycology','pscyhology','pshychology'
  ],
  'hebrew': ['hebrw','hebrow','hebrwe'],
  'engineering': [
    'enginering','engineerng','engineeing','engnieering',
    'engneering','enginerring','engneer'
  ],
  'cs': [
    'cmputer','cmoputer','coputer','comptuer',
    'progamming','progrmaming','progam','programing'
  ],
  'language': [
    'spanich','spansih','spnaish',
    'frenhc','frensh','frnech',
    'german','germna','geramn'
  ],
};

// ── Helper: check if a multi-word term matches a subject name ──
// Returns true if every word in `term` appears as a substring in `subjectName`
// (words can be non-contiguous, e.g. "ap lang" matches "ap english language").
// Single-word terms fall through to the standard indexOf check.
function _termMatchesSubject(term, subjectName) {
  if (subjectName === term) return true;
  if (subjectName.length >= 3 && subjectName.indexOf(term) >= 0) return true;
  if (term.length >= 4 && term.startsWith(subjectName)) return true;
  // Multi-word term: check if ALL words appear somewhere in subject name.
  // e.g. "ap lang" → words ["ap","lang"] → both in "ap english language" ✓
  var termWords = term.split(/\s+/);
  if (termWords.length >= 2) {
    for (var w = 0; w < termWords.length; w++) {
      if (subjectName.indexOf(termWords[w]) === -1) return false;
    }
    return true;
  }
  return false;
}

function buildSubjectSynonyms() {
  var synonyms = {};
  for (var category in COURSE_CATEGORIES) {
    var categoryTerms = COURSE_CATEGORIES[category];
    var matchedSubject = null;
    for (var i = 0; i < subjects.length; i++) {
      var subLower = subjects[i].name.toLowerCase();
      for (var j = 0; j < categoryTerms.length; j++) {
        var term = categoryTerms[j];
        if (_termMatchesSubject(term, subLower)) {
          matchedSubject = subjects[i].name;
          break;
        }
      }
      if (matchedSubject) break;
    }
    if (matchedSubject) {
      for (var k = 0; k < categoryTerms.length; k++) {
        synonyms[categoryTerms[k]] = matchedSubject;
      }
      var typos = CATEGORY_TYPOS[category];
      if (typos) {
        for (var t = 0; t < typos.length; t++) {
          synonyms[typos[t]] = matchedSubject;
        }
      }
    }
  }
  var customSyns = getCustomSynonyms();
  for (var cs in customSyns) {
    synonyms[cs] = customSyns[cs];
  }
  return synonyms;
}

function getCustomSynonyms() {
  try { var data = localStorage.getItem('hw_custom_synonyms'); return data ? JSON.parse(data) : {}; } catch(e) { return {}; /* corrupted data — reset to empty */ }
}
function saveCustomSynonyms(syns) { localStorage.setItem('hw_custom_synonyms', JSON.stringify(syns)); }
function addCustomSynonym(synonym, subjectName) {
  var syns = getCustomSynonyms(); syns[synonym.toLowerCase()] = subjectName; saveCustomSynonyms(syns);
}
function removeCustomSynonym(synonym) {
  var syns = getCustomSynonyms(); delete syns[synonym.toLowerCase()]; saveCustomSynonyms(syns);
}
function renderSynonymList() {
  var container = document.getElementById('synonym-list');
  if (!container) return;
  container.innerHTML = '';
  var customSyns = getCustomSynonyms();
  var keys = Object.keys(customSyns).sort();
  if (keys.length === 0) {
    var hint = document.createElement('div');
    hint.style.cssText = 'color:var(--text3);font-size:13px;padding:8px 0';
    hint.textContent = 'No custom synonyms yet. Add below to map terms to courses.';
    container.appendChild(hint);
    return;
  }
  keys.forEach(function(syn) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px';
    var label = document.createElement('span');
    label.style.cssText = 'color:var(--text2);flex:1';
    label.textContent = '"' + syn + '"';
    div.appendChild(label);
    var arrow = document.createElement('span');
    arrow.style.cssText = 'color:var(--text3);font-size:12px';
    arrow.textContent = '→';
    div.appendChild(arrow);
    var target = document.createElement('span');
    target.style.cssText = 'color:var(--accent);flex:1';
    target.textContent = customSyns[syn];
    div.appendChild(target);
    var btn = document.createElement('button');
    btn.className = 'task-act-btn del';
    btn.title = 'Remove';
    btn.textContent = '✕';
    (function(s) { btn.onclick = function() { removeCustomSynonym(s); renderSynonymList(); }; })(syn);
    div.appendChild(btn);
    container.appendChild(div);
  });
}
function populateSynonymSelect() {
  var sel = document.getElementById('new-synonym-target');
  if (!sel) return;
  sel.innerHTML = '';
  subjects.forEach(function(s) {
    var opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
}

function addSynonymFromUI() {
  var termEl = document.getElementById('new-synonym-term');
  var targetEl = document.getElementById('new-synonym-target');
  if (!termEl || !targetEl) return;
  var term = termEl.value.trim().toLowerCase();
  var target = targetEl.value;
  if (!term || !target) { if (termEl) termEl.focus(); return; }
  addCustomSynonym(term, target);
  termEl.value = '';
  renderSynonymList();
  toast('Synonym "' + term + '" → ' + target + ' added', 'success');
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



