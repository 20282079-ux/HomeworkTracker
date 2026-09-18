// calendar.js — Calendar rendering extracted from app.js
// Contains: renderCalendar, renderCalendarDayDetail, calendar nav helpers,
// MONTHS, DAYS_SHORT, PRIORITIES, PRIO_WEIGHT constants.

// Shared calendar constants (used by both calendar rendering and grade calc)
var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
var PRIO_WEIGHT = { 'Low': 1, 'Medium': 2, 'High': 3, 'Urgent': 4 };

// ── Calendar navigation ──
function calPrevMonth(self) { self.calendar.month--; if (self.calendar.month < 0) { self.calendar.month = 11; self.calendar.year--; } self.calendar.selectedDay = null; renderCalendar(self); }
function calNextMonth(self) { self.calendar.month++; if (self.calendar.month > 11) { self.calendar.month = 0; self.calendar.year++; } self.calendar.selectedDay = null; renderCalendar(self); }
function calTodayMonth(self) { self.calendar.year = new Date().getFullYear(); self.calendar.month = new Date().getMonth(); self.calendar.selectedDay = self.todayStr(); renderCalendar(self); }
function calSelectDay(self, dateStr) { self.calendar.selectedDay = self.calendar.selectedDay === dateStr ? null : dateStr; renderCalendar(self); }
function calOpenAddFormForDate(self, dateStr) { self.openAddForm(); document.getElementById('m-due').value = dateStr; }

// ── Calendar rendering ──
function renderCalendar(self) {
  var year = self.calendar.year, month = self.calendar.month;
  var monthLabel = document.getElementById('cal-month-label');
  if (monthLabel) monthLabel.textContent = MONTHS[month] + ' ' + year;
  var grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';
  DAYS_SHORT.forEach(function(d) { var h = document.createElement('div'); h.className = 'cal-header'; h.textContent = d; grid.appendChild(h); });
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = self.todayStr();
  for (var i = 0; i < firstDay; i++) { var e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e); }
  for (var day = 1; day <= daysInMonth; day++) {
    var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    var cell = document.createElement('div');
    var isToday = dateStr === today;
    cell.className = 'cal-day' + (isToday ? ' today' : '') + (self.calendar.selectedDay === dateStr ? ' selected' : '');
    cell.setAttribute('role', 'button'); cell.setAttribute('tabindex', '0');
    cell.setAttribute('aria-label', MONTHS[month] + ' ' + day + (isToday ? ' (today)' : ''));
    (function(ds) { cell.onclick = function() { calSelectDay(self, ds); }; cell.onkeydown = function(e) { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); calSelectDay(self, ds); } }; })(dateStr);
    var inner = '<div class="cal-day-num">' + day + '</div>';
    var tasksForDay = self.state.tasks.filter(function(t) { return t.due === dateStr; });
    var testsForDay = self.state.tests.filter(function(t) { return t.date === dateStr; });
    if (tasksForDay.length + testsForDay.length > 0) {
      inner += '<div class="cal-dots">';
      tasksForDay.slice(0,4).forEach(function(t) { var s = self.state.subjects.find(function(x){return x.name===t.subject;}) || {color:'#7c6af7'}; inner += '<span class="cal-dot" style="background:'+s.color+'\" title=\"'+self.escHtml(t.title)+'\"></span>'; });
      testsForDay.slice(0,4).forEach(function(t) { inner += '<span class="cal-dot test-dot" title=\"'+self.escHtml(t.title)+'\"></span>'; });
      var total = tasksForDay.length + testsForDay.length;
      if (total > 4) inner += '<span class="cal-more">+' + (total-4) + '</span>';
      inner += '</div>';
    }
    cell.innerHTML = inner;
    grid.appendChild(cell);
  }
  renderCalendarDayDetail(self);
}

function renderCalendarDayDetail(self) {
  var detail = document.getElementById('cal-day-detail'); if (!detail) return;
  if (!self.calendar.selectedDay) { detail.innerHTML = '<div class="cal-empty-hint">Click a day to see details</div>'; return; }
  var dateStr = self.calendar.selectedDay;
  var tasks = self.state.tasks.filter(function(t) { return t.due === dateStr; });
  var tests = self.state.tests.filter(function(t) { return t.date === dateStr; });
  var total = tasks.length + tests.length;
  if (total === 0) { detail.innerHTML = '<div class="cal-detail-header">' + self.escHtml(self.formatDate(dateStr)) + ' <span style="color:var(--text3);font-size:12px">— No items</span></div><button class="btn btn-primary btn-sm" style="margin-top:10px" data-date="' + self.escHtml(dateStr) + '" onclick="App.openAddFormForDate(this.dataset.date)">＋ Add Task for this day</button>'; return; }
  var html = '<div class="cal-detail-header">' + self.escHtml(self.formatDate(dateStr)) + ' <span style="color:var(--text3);font-size:12px">— ' + self.escHtml(String(total)) + ' item' + (total!==1?'s':'') + '</span></div>';
  if (tasks.length > 0) {
    html += '<div class="cal-detail-section"><div class="cal-detail-section-title">📚 Assignments</div>';
    tasks.forEach(function(t) { var s = self.state.subjects.find(function(x){return x.name===t.subject;}) || {color:'#7c6af7'}; html += '<div class="cal-detail-item'+(t.status==='done'?' done':'')+'\"><span class="cal-detail-dot" style=\"background:'+self.escHtml(s.color)+'\"></span><span class="cal-detail-name\">'+self.escHtml(t.title)+'</span><span class=\"cal-detail-badge badge badge-priority-'+self.escHtml(t.priority)+'\">'+self.escHtml(t.priority)+'</span></div>'; });
    html += '</div>';
  }
  if (tests.length > 0) {
    html += '<div class="cal-detail-section"><div class="cal-detail-section-title">🧪 Tests</div>';
    tests.forEach(function(t) { var p = self.getScorePct(t); var g = self.getLetterGrade(p); html += '<div class="cal-detail-item\"><span class=\"cal-detail-dot\" style=\"background:var(--accent)\"></span><span class=\"cal-detail-name\">'+self.escHtml(t.title)+'</span><span class=\"cal-detail-badge badge badge-due\">'+(p!==null?self.escHtml(g)+' '+self.escHtml(String(p))+'%':self.escHtml(t.type||'Test'))+'</span></div>'; });
    html += '</div>';
  }
  html += '<button class=\"btn btn-primary btn-sm\" style=\"margin-top:10px\" data-date=\"' + self.escHtml(dateStr) + '\" onclick=\"App.openAddFormForDate(this.dataset.date)\">＋ Add Task for this day</button>';
  detail.innerHTML = html;
}
