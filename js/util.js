// 2-util.js (split from app.js) — small helpers (escHtml, hexToRgba, dates, toast, confetti, title, tabs, compact)
// ═══════════════════════════════════════
function updateTitle(val) {
  if (!val) return;
  const words = val.trim().split(' ');
  const last = words.pop();
  document.getElementById('app-title').innerHTML = `${words.join(' ')} <span>${last}.</span>`;
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function toast(msg, type, ms) {
  if (type === undefined) type = '';
  var duration = (typeof ms === 'number' && ms > 0) ? ms : 2800;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', '': 'ℹ️' };
  // Built from DOM nodes rather than innerHTML: toast messages routinely
  // embed user-supplied text (subject names, task titles).
  const icon = document.createElement('span');
  icon.textContent = icons[type] || 'ℹ️';
  el.appendChild(icon);
  el.appendChild(document.createTextNode(' ' + msg));
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ═══════════════════════════════════════
//  CONFETTI
// ═══════════════════════════════════════
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({length: 80}, () => ({
    x: Math.random()*canvas.width, y: -10,
    vx: (Math.random()-0.5)*4, vy: Math.random()*4+2,
    color: ['#7c6af7','#4ade80','#facc15','#f87171','#fb923c','#60a5fa'][Math.floor(Math.random()*6)],
    size: Math.random()*8+4, rot: Math.random()*360, rotV: (Math.random()-0.5)*6
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      ctx.restore();
    });
    frame++;
    if (frame < 90) requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  draw();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Escape a value for a JS string literal that is itself embedded in an HTML
// attribute, e.g. onclick="doThing('VALUE')". escHtml() alone is NOT enough
// there: the HTML parser decodes entities before the JS engine parses the
// string, so an embedded quote would still break out of the literal.
function escJsAttr(s) {
  return escHtml(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// ── Global error barrier: catches unhandled errors in event handlers and
//    scheduled callbacks. Prevents a single JS error from white-screening
//    the entire app. Logs to console so developers can still debug.
window.addEventListener('error', function(e) {
  console.error('Homework Tracker — unhandled error:', e.error || e.message);
  // Prevent the browser's default "unhandled error" from blanking the page.
  // The toast system may be unavailable, so we fall back silently.
  try {
    if (typeof toast === 'function') {
      toast('⚠ Something went wrong — please refresh the page', 'error', 6000);
    }
  } catch (_) { /* toast unavailable during boot */ }
});
// Catch unhandled Promise rejections too (e.g. async localStorage failures).
// Log to console only — don't suppress the browser's native warning so
// developers can still see stack traces during debugging.
window.addEventListener('unhandledrejection', function(e) {
  console.error('Homework Tracker — unhandled rejection:', e.reason);
});
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════
//  COMPACT VIEW
// ═══════════════════════════════════════
function toggleCompact() {
  compactMode = !compactMode;
  var btn = document.getElementById('compact-btn');
  btn.textContent = compactMode ? '⊟ Detailed' : '⊟ Compact';
  btn.setAttribute('aria-pressed', String(compactMode));
  document.getElementById('s-compact').checked = compactMode;
  filterTasks();
}
function toggleCompactFromSettings(el) {
  compactMode = el.checked;
  var btn = document.getElementById('compact-btn');
  btn.textContent = compactMode ? '⊟ Detailed' : '⊟ Compact';
  btn.setAttribute('aria-pressed', String(compactMode));
  filterTasks();
}

