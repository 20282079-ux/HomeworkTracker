// 5-tests.js (split from app.js) — test tracker + countdown + grade chart + GPA + study timer + flashcards
function seedSampleTests() {
  const add = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; };
  tests = [
    { id: uid(), subject:'Math', title:'Chapter 4 Quiz', type:'Quiz', date: add(-14), score:92, maxScore:100, notes:'Aced the derivatives section', created: Date.now()-5000 },
    { id: uid(), subject:'English', title:'Reading Comprehension Test', type:'Test', date: add(-7), score:78, maxScore:100, notes:'Need to work on inference questions', created: Date.now()-4000 },
    { id: uid(), subject:'Science', title:'Biology Midterm', type:'Midterm', date: add(-3), score:61, maxScore:100, notes:'Missed cell cycle questions', created: Date.now()-3000 },
    { id: uid(), subject:'History', title:'WWII Unit Exam', type:'Test', date: add(5), score:null, maxScore:100, notes:'Study: causes, key battles, aftermath', created: Date.now()-2000 },
    { id: uid(), subject:'Math', title:'Calculus Final', type:'Final', date: add(14), score:null, maxScore:100, notes:'Cover all chapters 1–8', created: Date.now()-1000 },
  ];
}

function getLetterGrade(pct) {
  if (pct === null || pct === undefined) return null;
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function getScorePct(test) {
  if (test.score === null || test.score === undefined || test.score === '') return null;
  const max = test.maxScore || 100;
  return Math.round((test.score / max) * 100);
}

function renderTestStats() {
  const graded = tests.filter(t => getScorePct(t) !== null);
  const today = todayStr();
  const upcoming = tests.filter(t => !t.date || t.date >= today).filter(t => getScorePct(t) === null);
  const passed = graded.filter(t => getScorePct(t) >= 60);
  const avg = graded.length ? Math.round(graded.reduce((s,t) => s + getScorePct(t), 0) / graded.length) : null;

  document.getElementById('tstat-total').textContent = tests.length;
  document.getElementById('tstat-passed').textContent = passed.length;
  document.getElementById('tstat-upcoming').textContent = upcoming.length;
}

function renderTests() {
  renderTestStats();
  const search = (document.getElementById('test-search')?.value || '').toLowerCase();
  const sort = document.getElementById('test-sort')?.value || 'created';
  const today = todayStr();

  let list = tests.filter(t => {
    const pct = getScorePct(t);
    const isUpcoming = (!t.date || t.date >= today) && pct === null;
    const isPassed = pct !== null && pct >= 60;
    const isFailed = pct !== null && pct < 60;
    if (activeTestFilter === 'upcoming' && !isUpcoming) return false;
    if (activeTestFilter === 'passed' && !isPassed) return false;
    if (activeTestFilter === 'failed' && !isFailed) return false;
    if (search && !t.title.toLowerCase().includes(search) && !t.subject.toLowerCase().includes(search) && !(t.notes||'').toLowerCase().includes(search)) return false;
    return true;
  });

  list.sort((a, b) => {
    if (sort === 'date') {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    }
    if (sort === 'score') {
      const pa = getScorePct(a); const pb = getScorePct(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pb - pa;
    }
    if (sort === 'subject') return a.subject.localeCompare(b.subject);
    return b.created - a.created;
  });

  const container = document.getElementById('tests-list');
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="emoji">🧪</span>${tests.length === 0 ? 'No tests yet — hit <b>+ Add Test</b> to begin!' : 'No tests match your filters.'}</div>`;
    return;
  }

  list.forEach((t, i) => container.appendChild(buildTestCard(t, i)));
  renderCountdown();
}

function buildTestCard(t, index) {
  const pct = getScorePct(t);
  const letter = getLetterGrade(pct);
  const today = todayStr();
  const isUpcoming = (!t.date || t.date >= today) && pct === null;
  const isPassed = pct !== null && pct >= 60;
  const isFailed = pct !== null && pct < 60;
  const subj = subjects.find(s => s.name === t.subject) || { color: '#7c6af7' };

  const card = document.createElement('div');
  card.style.animationDelay = (index * 0.04) + 's';
  card.className = `test-card${isPassed ? ' passed' : isFailed ? ' failed' : isUpcoming ? ' upcoming' : ''}`;

  let dateBadge = '';
  if (t.date) {
    const d = getDaysLeft(t.date);
    if (d < 0 && pct === null) dateBadge = `<span class="badge badge-overdue">⚠ ${Math.abs(d)}d ago</span>`;
    else if (d === 0) dateBadge = `<span class="badge badge-today">⏰ Today!</span>`;
    else if (d > 0 && d <= 7) dateBadge = `<span class="badge badge-soon">⚡ ${d}d away</span>`;
    else dateBadge = `<span class="badge badge-due">📅 ${formatDate(t.date)}</span>`;
  }

  const typeBadge = `<span class="badge" style="background:${hexToRgba(subj.color,.15)};color:${subj.color};border-color:${hexToRgba(subj.color,.3)}">${escHtml(t.type||'Test')}</span>`;
  const subjectBadge = `<span class="badge badge-due">${escHtml(t.subject)}</span>`;

  let scoreDisplay = '';
  if (pct !== null) {
    const cls = pct >= 90 ? 'pass' : pct >= 60 ? 'pass' : 'fail';
    scoreDisplay = `<div class="test-score-display ${cls}">${letter}<span style="font-size:13px;opacity:.7;margin-left:3px">${pct}%</span></div>`;
  } else {
    scoreDisplay = `<div class="test-score-display pending">—</div>`;
  }

  card.innerHTML = `
    <div class="task-strip" style="background:${subj.color}"></div>
    <div class="task-body">
      <div class="test-title">${escHtml(t.title)}</div>
      ${t.notes ? `<div class="test-note">${escHtml(t.notes)}</div>` : ''}
      <div class="test-meta">${typeBadge}${subjectBadge}${dateBadge}</div>
    </div>
    ${scoreDisplay}
    <div class="task-actions">
      <button class="task-act-btn" onclick="openStudyTimer('${t.id}')" title="Study Timer" style="background:rgba(124,106,247,0.15);color:var(--accent)">⏱</button>
      <button class="task-act-btn edit" onclick="openTestEdit('${t.id}')" title="Edit">✎</button>
      <button class="task-act-btn del" onclick="deleteTest('${t.id}', this)" title="Delete">✕</button>
    </div>
  `;
  return card;
}

function setTestFilter(btn) {
  activeTestFilter = btn.dataset.filter;
  document.querySelectorAll('#test-filter-chips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderTests();
}

function openTestForm() {
  editingTestId = null;
  document.getElementById('test-modal-title').textContent = '🧪 New Test';
  document.getElementById('t-title').value = '';
  document.getElementById('t-date').value = '';
  document.getElementById('t-score').value = '';
  document.getElementById('t-maxscore').value = '';
  document.getElementById('t-notes').value = '';
  document.getElementById('t-type').value = 'Test';
  populateTestSubjectSelect();
  document.getElementById('test-modal').classList.remove('hidden');
}

function openTestEdit(id) {
  const t = tests.find(x => x.id === id);
  if (!t) return;
  editingTestId = id;
  document.getElementById('test-modal-title').textContent = '✏️ Edit Test';
  document.getElementById('t-title').value = t.title;
  document.getElementById('t-date').value = t.date || '';
  document.getElementById('t-score').value = t.score !== null && t.score !== undefined ? t.score : '';
  document.getElementById('t-maxscore').value = t.maxScore || '';
  document.getElementById('t-notes').value = t.notes || '';
  document.getElementById('t-type').value = t.type || 'Test';
  populateTestSubjectSelect(t.subject);
  document.getElementById('test-modal').classList.remove('hidden');
}

function closeTestModal() { document.getElementById('test-modal').classList.add('hidden'); }
function closeTestModalOutside(e) { if (e.target.id === 'test-modal') closeTestModal(); }

function saveTest() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) {
    document.getElementById('t-title').classList.add('shake');
    setTimeout(() => document.getElementById('t-title').classList.remove('shake'), 400);
    return;
  }
  const scoreRaw = document.getElementById('t-score').value;
  const maxRaw = document.getElementById('t-maxscore').value;
  const data = {
    title,
    subject: document.getElementById('t-subject').value,
    type: document.getElementById('t-type').value,
    date: document.getElementById('t-date').value,
    score: scoreRaw !== '' ? parseFloat(scoreRaw) : null,
    maxScore: maxRaw !== '' ? parseFloat(maxRaw) : 100,
    notes: document.getElementById('t-notes').value.trim(),
  };
  if (editingTestId) {
    const idx = tests.findIndex(t => t.id === editingTestId);
    if (idx > -1) tests[idx] = { ...tests[idx], ...data };
    toast('Test updated ✓', 'success');
  } else {
    tests.unshift({ id: uid(), created: Date.now(), ...data });
    toast('Test added ✓', 'success');
  }
  save();
  renderTests();
  closeTestModal();
}

function deleteTest(id, btn) {
  if (btn.dataset.confirm !== '1') {
    btn.dataset.confirm = '1';
    btn.textContent = '✓?';
    btn.style.background = 'rgba(248,113,113,0.3)';
    btn.style.color = 'var(--danger)';
    setTimeout(() => { if (btn.dataset.confirm) { btn.dataset.confirm=''; btn.textContent='✕'; btn.style.background=''; btn.style.color=''; } }, 2500);
    return;
  }
  tests = tests.filter(t => t.id !== id);
  save();
  renderTests();
  toast('Test deleted', '');
}

function populateTestSubjectSelect(selected) {
  const sel = document.getElementById('t-subject');
  if (!sel) return;
  sel.innerHTML = subjects.map(s => `<option value="${escHtml(s.name)}"${s.name === selected ? ' selected' : ''}>${escHtml(s.name)}</option>`).join('');
}

// ═══════════════════════════════════════
//  FEATURE 1: COUNTDOWN PANEL
// ═══════════════════════════════════════
function renderCountdown() {
  const today = todayStr();
  const upcoming = tests
    .filter(t => t.date && t.date >= today && getScorePct(t) === null)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 6);
  const grid = document.getElementById('countdown-grid');
  const panel = document.getElementById('countdown-panel');
  if (!grid) return;
  if (upcoming.length === 0) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  grid.innerHTML = upcoming.map(t => {
    const d = getDaysLeft(t.date);
    const cls = d === 0 ? 'urgent' : d <= 3 ? 'urgent' : d <= 7 ? 'soon' : 'ok';
    const dayCls = d <= 3 ? 'urgent' : d <= 7 ? 'soon' : 'ok';
    const label = d === 0 ? 'Today!' : d === 1 ? '1 day' : `${d} days`;
    const subj = subjects.find(s => s.name === t.subject) || {color:'#7c6af7'};
    return `<div class="countdown-card ${cls}">
      <div class="countdown-days ${dayCls}">${d === 0 ? '!' : d}</div>
      <div class="countdown-info">
        <div class="countdown-name">${escHtml(t.title)}</div>
        <div class="countdown-sub" style="color:${subj.color}">${escHtml(t.subject)}</div>
        <div class="countdown-sub">${d === 0 ? 'Today!' : label + ' away'} · ${formatDate(t.date)}</div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
//  FEATURE 2: GRADE TREND CHART
// ═══════════════════════════════════════
function renderTrendChart() {
  const svg = document.getElementById('trend-svg');
  if (!svg) return;
  const subjectF = document.getElementById('chart-subject-filter')?.value || 'All';
  const graded = tests
    .filter(t => t.date && getScorePct(t) !== null)
    .filter(t => subjectF === 'All' || t.subject === subjectF)
    .sort((a,b) => a.date.localeCompare(b.date));

  svg.innerHTML = '';
  if (graded.length < 2) {
    svg.innerHTML = `<text x="350" y="85" text-anchor="middle" fill="var(--text3)" font-size="13" font-family="Manrope,sans-serif">Need at least 2 graded tests to show trend</text>`;
    return;
  }

  const W = 700, H = 160, pad = { t:16, r:20, b:32, l:44 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const scores = graded.map(t => getScorePct(t));
  const minS = Math.max(0, Math.min(...scores) - 10);
  const maxS = Math.min(100, Math.max(...scores) + 10);

  const xOf = i => pad.l + (i / (graded.length - 1)) * iW;
  const yOf = v => pad.t + iH - ((v - minS) / (maxS - minS)) * iH;

  // Grid lines
  [60, 70, 80, 90, 100].forEach(y => {
    if (y < minS || y > maxS) return;
    const yp = yOf(y);
    svg.innerHTML += `<line x1="${pad.l}" y1="${yp}" x2="${W-pad.r}" y2="${yp}" stroke="var(--border)" stroke-width="1"/>`;
    svg.innerHTML += `<text x="${pad.l-6}" y="${yp+4}" text-anchor="end" fill="var(--text3)" font-size="10" font-family="Manrope,sans-serif">${y}</text>`;
  });

  // Area fill
  const pts = graded.map((t,i) => `${xOf(i)},${yOf(getScorePct(t))}`).join(' ');
  const areaD = `M${xOf(0)},${yOf(getScorePct(graded[0]))} ` +
    graded.map((t,i) => `L${xOf(i)},${yOf(getScorePct(t))}`).join(' ') +
    ` L${xOf(graded.length-1)},${H-pad.b} L${xOf(0)},${H-pad.b} Z`;
  svg.innerHTML += `<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
  svg.innerHTML += `<path d="${areaD}" fill="url(#trendGrad)"/>`;

  // Line
  const lineD = graded.map((t,i) => `${i===0?'M':'L'}${xOf(i)},${yOf(getScorePct(t))}`).join(' ');
  svg.innerHTML += `<path d="${lineD}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Dots + labels
  graded.forEach((t, i) => {
    const x = xOf(i), y = yOf(getScorePct(t)), pct = getScorePct(t);
    const col = pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--accent)' : pct >= 60 ? 'var(--warn)' : 'var(--danger)';
    svg.innerHTML += `<circle cx="${x}" cy="${y}" r="5" fill="${col}" stroke="var(--bg2)" stroke-width="2"/>`;
    if (graded.length <= 10) {
      svg.innerHTML += `<text x="${x}" y="${y-10}" text-anchor="middle" fill="var(--text2)" font-size="10" font-family="Manrope,sans-serif">${pct}%</text>`;
    }
    // X labels
    if (graded.length <= 8) {
      svg.innerHTML += `<text x="${x}" y="${H-pad.b+16}" text-anchor="middle" fill="var(--text3)" font-size="9" font-family="Manrope,sans-serif">${formatDate(t.date)}</text>`;
    }
  });
}

// ═══════════════════════════════════════
//  FEATURE 3: GPA BY SUBJECT
// ═══════════════════════════════════════
function renderGPA() {
  const grid = document.getElementById('gpa-grid');
  if (!grid) return;
  const bySubject = {};
  tests.forEach(t => {
    const pct = getScorePct(t);
    if (pct === null) return;
    if (!bySubject[t.subject]) bySubject[t.subject] = [];
    bySubject[t.subject].push(pct);
  });
  if (Object.keys(bySubject).length === 0) {
    grid.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:12px 0">No graded tests yet.</div>`;
    return;
  }
  grid.innerHTML = Object.entries(bySubject).map(([subj, scores]) => {
    const avg = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
    const letter = getLetterGrade(avg);
    const col = letter==='A'?'var(--success)':letter==='B'?'#60a5fa':letter==='C'?'var(--warn)':letter==='D'?'#fb923c':'var(--danger)';
    const s = subjects.find(s=>s.name===subj)||{color:'#7c6af7'};
    return `<div class="gpa-card" style="border-color:${hexToRgba(s.color,.3)}">
      <div class="gpa-letter" style="color:${col}">${letter}</div>
      <div class="gpa-pct">${avg}%</div>
      <div class="gpa-subject" style="color:${s.color}">${escHtml(subj)}</div>
      <div class="gpa-count">${scores.length} test${scores.length!==1?'s':''}</div>
    </div>`;
  }).join('');
}

function openStudyTimer(testId) {
  timerTestId = testId;
  const t = tests.find(x => x.id === testId);
  document.getElementById('timer-subject-label').textContent = t ? t.subject : '';
  document.getElementById('timer-test-name').textContent = t ? t.title : 'Study Session';
  resetTimer();
  document.getElementById('timer-overlay').classList.remove('hidden');
}

function closeTimer() {
  if (timerRunning) { clearInterval(timerInterval); timerRunning = false; }
  document.getElementById('timer-overlay').classList.add('hidden');
}

function setTimerPreset(btn, mins) {
  document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  timerTotal = mins * 60;
  timerSeconds = timerTotal;
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timer-toggle-btn').textContent = '▶ Start';
  document.getElementById('timer-phase').textContent = mins <= 15 ? 'Break' : 'Focus';
  updateTimerDisplay();
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timer-toggle-btn').textContent = '▶ Resume';
  } else {
    timerRunning = true;
    document.getElementById('timer-toggle-btn').textContent = '⏸ Pause';
    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        timerSessions++;
        document.getElementById('timer-sessions').textContent = `Sessions completed: ${timerSessions}`;
        document.getElementById('timer-toggle-btn').textContent = '▶ Start';
        timerSeconds = timerTotal;
        updateTimerDisplay();
        toast('⏱ Timer complete! Great work!', 'success');
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerTotal;
  document.getElementById('timer-toggle-btn').textContent = '▶ Start';
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  const disp = document.getElementById('timer-display');
  const circle = document.getElementById('timer-ring-circle');
  disp.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const pct = timerSeconds / timerTotal;
  const circumference = 2 * Math.PI * 80;
  circle.style.strokeDashoffset = circumference * (1 - pct);
  const col = pct > 0.33 ? 'var(--accent)' : pct > 0.1 ? 'var(--warn)' : 'var(--danger)';
  circle.style.stroke = col;
  disp.className = 'timer-display' + (pct <= 0.1 ? ' danger' : pct <= 0.33 ? ' warn' : '');
  document.getElementById('timer-sessions').textContent = `Sessions completed: ${timerSessions}`;
}

function openFlashcards() {
  fcDeck = tests.filter(t => t.title).slice();
  if (fcDeck.length === 0) { toast('No tests to review!', ''); return; }
  fcIndex = 0; fcFlipped = false;
  renderFlashcard();
  document.getElementById('flashcard-overlay').classList.remove('hidden');
}

function closeFlashcards() {
  document.getElementById('flashcard-overlay').classList.add('hidden');
}

function shuffleFlashcards() {
  for (let i = fcDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fcDeck[i], fcDeck[j]] = [fcDeck[j], fcDeck[i]];
  }
  fcIndex = 0; fcFlipped = false;
  renderFlashcard();
  toast('Deck shuffled 🔀', '');
}

function flipCard() {
  fcFlipped = !fcFlipped;
  document.getElementById('fc-card').classList.toggle('flipped', fcFlipped);
}

function fcNext() {
  fcFlipped = false;
  document.getElementById('fc-card').classList.remove('flipped');
  fcIndex = (fcIndex + 1) % fcDeck.length;
  setTimeout(renderFlashcard, 100);
}

function fcPrev() {
  fcFlipped = false;
  document.getElementById('fc-card').classList.remove('flipped');
  fcIndex = (fcIndex - 1 + fcDeck.length) % fcDeck.length;
  setTimeout(renderFlashcard, 100);
}

function renderFlashcard() {
  const t = fcDeck[fcIndex];
  if (!t) return;
  const pct = getScorePct(t);
  const letter = getLetterGrade(pct);
  const subj = subjects.find(s => s.name === t.subject) || {color:'#7c6af7'};

  document.getElementById('fc-progress').textContent = `${fcIndex+1} / ${fcDeck.length}`;
  document.getElementById('fc-front-text').textContent = t.title;
  document.getElementById('fc-front-sub').textContent = `${t.subject} · ${t.type||'Test'}${t.date ? ' · ' + formatDate(t.date) : ''}`;
  document.getElementById('fc-front-sub').style.color = subj.color;

  if (pct !== null) {
    const col = pct>=90?'var(--success)':pct>=80?'#60a5fa':pct>=70?'var(--warn)':pct>=60?'#fb923c':'var(--danger)';
    document.getElementById('fc-back-score').textContent = letter;
    document.getElementById('fc-back-score').style.color = col;
    document.getElementById('fc-back-pct').textContent = pct + '%';
  } else {
    document.getElementById('fc-back-score').textContent = '?';
    document.getElementById('fc-back-score').style.color = 'var(--text3)';
    document.getElementById('fc-back-pct').textContent = 'Not yet graded';
  }
  document.getElementById('fc-back-notes').textContent = t.notes || '';
}

// Keyboard navigation for flashcards
document.addEventListener('keydown', e => {
  if (!document.getElementById('flashcard-overlay')?.classList.contains('hidden')) {
    if (e.key === 'ArrowRight') fcNext();
    if (e.key === 'ArrowLeft') fcPrev();
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
  }
});

