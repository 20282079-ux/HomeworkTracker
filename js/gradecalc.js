// gradecalc.js — Grade calculator extracted from app.js
// Contains: renderGradeCalc, renderGCOverallGPA, renderGCSubjectList,
// renderGCSummary, updateGCCalculation.

function renderGradeCalc(self) { renderGCSubjectList(self); renderGCSummary(self); renderGCOverallGPA(self); }

function renderGCOverallGPA(self) {
  var el = document.getElementById('gc-overall-gpa'); if (!el) return;
  var graded = self.state.tests.filter(function(t) { return self.getScorePct(t) !== null; });
  if (!graded.length) { el.innerHTML = '<div class="gc-overall-card"><div class="gc-overall-value">—</div><div class="gc-overall-label">Overall GPA</div><div class="gc-overall-sub">No graded tests yet</div></div>'; return; }
  var totalPct = graded.reduce(function(s,t) { return s + self.getScorePct(t); }, 0);
  var avg = Math.round(totalPct / graded.length); var letter = self.getLetterGrade(avg);
  var col = letter==='A'?'var(--success)':letter==='B'?'#60a5fa':letter==='C'?'var(--warn)':letter==='D'?'#fb923c':'var(--danger)';
  el.innerHTML = '<div class="gc-overall-card"><div class="gc-overall-value" style="color:'+self.escHtml(col)+'">'+self.escHtml(letter)+'</div><div class="gc-overall-label">Overall GPA</div><div class="gc-overall-sub">'+self.escHtml(String(avg))+'% average · '+self.escHtml(String(graded.length))+' graded test'+(graded.length!==1?'s':'')+'</div></div><div class="gc-overall-card"><div class="gc-overall-value" style="color:var(--accent)">'+self.escHtml(String(avg))+'%</div><div class="gc-overall-label">Average Score</div><div class="gc-overall-sub">Across all subjects</div></div>';
}

function renderGCSubjectList(self) {
  var container = document.getElementById('gc-subjects'); if (!container) return;
  var bySubject = {};
  self.state.tests.forEach(function(t) { if (!bySubject[t.subject]) bySubject[t.subject] = []; bySubject[t.subject].push(t); });
  if (!Object.keys(bySubject).length) { container.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0">Add tests to see grade breakdown.</div>'; return; }
  container.innerHTML = Object.entries(bySubject).map(function(pair) {
    var subj = pair[0], tests = pair[1];
    var graded = tests.filter(function(t) { return self.getScorePct(t) !== null; });
    var ungraded = tests.filter(function(t) { return self.getScorePct(t) === null; });
    var subjData = self.state.subjects.find(function(s) { return s.name === subj; }) || {color:'#7c6af7'};
    var avgPct = null;
    if (graded.length) avgPct = Math.round(graded.reduce(function(s,t) { return s+self.getScorePct(t); },0)/graded.length);
    var letter = self.getLetterGrade(avgPct);
    var col = letter==='A'?'var(--success)':letter==='B'?'#60a5fa':letter==='C'?'var(--warn)':letter==='D'?'#fb923c':'var(--danger)';
    return '<div class="gc-subject-card" style="border-left:3px solid '+self.escHtml(subjData.color)+'"><div class="gc-subject-header"><div><div class="gc-subject-name" style="color:'+self.escHtml(subjData.color)+'">'+self.escHtml(subj)+'</div><div class="gc-subject-meta">'+self.escHtml(String(graded.length))+' graded · '+self.escHtml(String(ungraded.length))+' pending</div></div><div class="gc-subject-grade" style="color:'+self.escHtml(col)+'">'+(avgPct!==null?self.escHtml(letter)+' ('+self.escHtml(String(avgPct))+'%)':'—')+'</div></div></div>';
  }).join('');
}

function renderGCSummary(self) {
  var el = document.getElementById('gc-summary'); if (!el) return;
  var graded = self.state.tests.filter(function(t) { return self.getScorePct(t)!==null; });
  if (!graded.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">Add graded tests to see summary.</div>'; return; }
  var scores = graded.map(function(t) { return self.getScorePct(t); });
  var highest = Math.max.apply(null,scores), lowest = Math.min.apply(null,scores);
  var avg = Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length);
  el.innerHTML = '<div class="gc-stats-row"><div class="gc-stat"><div class="gc-stat-value" style="color:var(--success)">'+self.escHtml(String(highest))+'%</div><div class="gc-stat-label">Highest</div></div><div class="gc-stat"><div class="gc-stat-value" style="color:var(--accent)">'+self.escHtml(String(avg))+'%</div><div class="gc-stat-label">Average</div></div><div class="gc-stat"><div class="gc-stat-value" style="color:var(--danger)">'+self.escHtml(String(lowest))+'%</div><div class="gc-stat-label">Lowest</div></div><div class="gc-stat"><div class="gc-stat-value" style="color:var(--warn)">'+self.escHtml(String(graded.length))+'</div><div class="gc-stat-label">Graded</div></div></div><div class="gc-custom-calc" style="margin-top:16px"><div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px">🎯 Target Grade Calculator</div><div class="gc-calc-row"><label for="gc-calc-current">Current Average (%)</label><input type="number" id="gc-calc-current" min="0" max="100" value="'+self.escHtml(String(avg))+'\" oninput=\"App.updateGCCalculation()\" /></div><div class="gc-calc-row"><label for="gc-calc-weight">Current Weight (%)</label><input type="number" id="gc-calc-weight" min="0" max="100" value="70" oninput=\"App.updateGCCalculation()\" /></div><div class="gc-calc-row"><label for="gc-calc-target">Desired Final Grade (%)</label><input type=\"number\" id=\"gc-calc-target\" min=\"0\" max=\"100\" value=\"90\" oninput=\"App.updateGCCalculation()\" /></div><div id=\"gc-calc-result\" class=\"gc-calc-result\"></div></div>';
  updateGCCalculation(self);
}

function updateGCCalculation(self) {
  var el = document.getElementById('gc-calc-result'); if (!el) return;
  var current = parseFloat(document.getElementById('gc-calc-current')?.value);
  var weight = parseFloat(document.getElementById('gc-calc-weight')?.value);
  var target = parseFloat(document.getElementById('gc-calc-target')?.value);
  if (isNaN(current)||isNaN(weight)||isNaN(target)||weight>=100||weight<=0) { el.innerHTML = '<span style="color:var(--text3);font-size:13px">Enter valid values (weight 1-99%)</span>'; return; }
  var rw = 100-weight, needed = Math.round(((target*100)-(current*weight))/rw);
  if (needed>100) el.innerHTML = '<div class="gc-calc-impossible">❌ Need <strong>'+self.escHtml(String(needed))+'%</strong> on remaining '+self.escHtml(String(rw))+'% — not possible</div>';
  else if (needed<=0) el.innerHTML = '<div class="gc-calc-easy">✅ Already secured your target!</div>';
  else el.innerHTML = '<div class="gc-calc-possible">📈 Need <strong>'+self.escHtml(String(needed))+'%</strong> ('+self.escHtml(self.getLetterGrade(needed)||'')+') on remaining <strong>'+self.escHtml(String(rw))+'%</strong></div>';
}
