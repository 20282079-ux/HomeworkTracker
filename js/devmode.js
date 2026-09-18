// ═══════════════════════════════════════
//  SECRET DEV MODE
//  Hidden developer area with cheats & easter eggs.
//
//  Note: as of the constellation-starfield rewrite, the legacy
//  `notifyTreeGrowth()`, `getTreeState()`, `getTreeStage()`, etc.
//  APIs that this panel used to call were replaced by the
//  star-field equivalents. The cheat paths are rewritten here
//  to call those equivalents. Single-tree stats and tree-stage
//  achievements are gone; new ones cover the five constellations.
// ═══════════════════════════════════════

var DevMode = (function () {
  var _active = false;
  var _speedMultiplier = 1;
  var _matrixAnimFrame = null;
  var _devAchievements = {};
  var _partyInterval = null;

  var KONAMI = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
  var _konamiIdx = 0;

  var CONSTELLATION_LABELS = (function () {
    var map = {};
    if (typeof CONSTELLATIONS !== 'undefined') {
      CONSTELLATIONS.forEach(function (c) {
        map[c.metric] = c.name;
      });
    }
    return map;
  })();

  var ACHIEVEMENTS = {
    'first_hack':     { name: 'First Hack',     emoji: '🔓', desc: 'Activated dev mode' },
    'coin_baron':     { name: 'Coin Baron',     emoji: '💰', desc: 'Added 10,000+ tasks at once' },
    'speed_demon':    { name: 'Speed Demon',    emoji: '⚡', desc: 'Set speed to 50x or higher' },
    'sky_writer':     { name: 'Sky Writer',     emoji: '✨', desc: 'Lighted 50+ stars at once' },
    'constellation_full': { name: 'Full Sky',  emoji: '🌌', desc: 'Filled every constellation' },
    'party_animal':   { name: 'Party Animal',   emoji: '🎉', desc: 'Activated party mode' },
    'matrix_user':    { name: 'Matrix User',    emoji: '🟢', desc: 'Entered the Matrix' }
  };

  // ─── Init ───
  function init() {
    document.addEventListener('keydown', function (e) {
      if (e.keyCode === KONAMI[_konamiIdx]) {
        _konamiIdx++;
        if (_konamiIdx === KONAMI.length) {
          _konamiIdx = 0;
          openDevPanel();
        }
      } else {
        _konamiIdx = 0;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _active) closeDevPanel();
    });

    var titleEl = document.getElementById('app-title');
    if (titleEl) {
      var clickCount = 0;
      var clickTimer = null;
      titleEl.addEventListener('click', function () {
        clickCount++;
        if (clickCount >= 3) {
          clickCount = 0;
          clearTimeout(clickTimer);
          openDevPanel();
        } else {
          clearTimeout(clickTimer);
          clickTimer = setTimeout(function () { clickCount = 0; }, 400);
        }
      });
    }
  }

  // ─── Helpers for star-field actions ───
  function _isStarfieldReady() {
    return typeof getStarfieldState === 'function' &&
           typeof CONSTELLATIONS !== 'undefined' &&
           typeof notifyStarfieldGrowth === 'function';
  }
  function _lightManyStars(n) {
    if (!_isStarfieldReady()) {
      // Fall back through back-compat alias for the legacy tree API.
      for (var i = 0; i < n; i++) {
        if (typeof notifyTreeGrowth === 'function') notifyTreeGrowth();
      }
      return;
    }
    var state = getStarfieldState();
    if (!state.m) state.m = {};
    // Distribute across each constellation.
    var metrics = CONSTELLATIONS.map(function (c) { return c.metric; });
    var round = 0;
    while (round < n) {
      for (var k = 0; k < metrics.length && round < n; k++) {
        var key = metrics[k];
        if (typeof state.m[key] !== 'number') state.m[key] = 0;
        state.m[key]++;
        round++;
      }
    }
    saveStarfieldState(state);
    if (typeof renderStarfield === 'function') renderStarfield();
  }

  // ─── Panel Open/Close ───
  function openDevPanel() {
    _active = true;
    unlock('first_hack');
    var overlay = document.getElementById('dev-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      document.body.classList.add('dev-mode-active');
      startMatrixRain();
      updateDevStats();
      renderAchievements();
      var slider = document.getElementById('dev-speed-slider');
      if (slider) slider.value = _speedMultiplier;
      var speedVal = document.getElementById('dev-speed-val');
      if (speedVal) speedVal.textContent = _speedMultiplier + 'x';
      toast('🔓 ACCESS GRANTED — Dev Mode Activated', 'success');
    }
  }

  function closeDevPanel() {
    _active = false;
    var overlay = document.getElementById('dev-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.classList.remove('dev-mode-active');
    stopMatrixRain();
    if (_partyInterval) { clearInterval(_partyInterval); _partyInterval = null; }
  }

  function isActive() { return _active; }

  // ─── CHEAT: Add Tasks / Stars ───
  function addCoins(amount) {
    amount = parseInt(amount) || 0;
    if (amount <= 0) return;
    _lightManyStars(amount);
    if (amount >= 10000) unlock('coin_baron');
    toast('+' + amount.toLocaleString() + ' ✨ stars lit', 'success');
    updateDevStats();
  }

  function instantComplete() {
    _lightManyStars(10);
    toast('⚡ Instant star burst!', 'success');
    updateDevStats();
  }

  function setSpeed(multiplier) {
    multiplier = parseFloat(multiplier) || 1;
    _speedMultiplier = Math.max(1, Math.min(100, multiplier));
    if (_speedMultiplier >= 50) unlock('speed_demon');
    var valEl = document.getElementById('dev-speed-val');
    if (valEl) valEl.textContent = _speedMultiplier + 'x';
    toast('Speed set to ' + _speedMultiplier + 'x', '');
  }

  function resetSpeed() {
    _speedMultiplier = 1;
    var valEl = document.getElementById('dev-speed-val');
    if (valEl) valEl.textContent = '1x';
    var slider = document.getElementById('dev-speed-slider');
    if (slider) slider.value = 1;
    toast('Speed reset to 1x', '');
  }

  function unlockAllSpecies() {
    if (!_isStarfieldReady()) {
      toast('Starfield not loaded yet', 'error');
      return;
    }
    // Light stars in EVERY constellation one tier at a time.
    var tiers = 6;
    for (var t = 0; t < tiers; t++) {
      CONSTELLATIONS.forEach(function (c) {
        var state = getStarfieldState();
        if (!state.m[c.metric]) state.m[c.metric] = 0;
        state.m[c.metric] += 1;
        saveStarfieldState(state);
      });
    }
    if (typeof renderStarfield === 'function') renderStarfield();
    unlock('constellation_full');
    toast('🌌 Every constellation lit!', 'success');
    updateDevStats();
  }

  function maxStats() {
    _lightManyStars(100);
    unlock('constellation_full');
    toast('👑 Maximised — sky is fully formed', 'success');
    updateDevStats();
  }

  function fillGarden(count) {
    count = parseInt(count) || 20;
    count = Math.min(count, 100);
    _lightManyStars(count);
    if (count >= 50) unlock('sky_writer');
    toast('✨ Lit ' + count + ' stars across the sky', 'success');
    updateDevStats();
  }

  function addFakeSession(minutes) {
    minutes = parseInt(minutes) || 25;
    var units = Math.ceil(minutes / 5);
    _lightManyStars(units);
    toast('Added fake session: ' + minutes + 'min → ' + units + ' stars', 'success');
    updateDevStats();
  }

  function resetAllData() {
    if (!confirm('⚠️ This will DELETE all gamification data. Are you sure?')) return;
    try {
      localStorage.removeItem('hw_starfield_state');
      var legacyKeys = ['hw_forest_state', 'hw_tree_state', 'hw_starfield_state_v0'];
      legacyKeys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) { /* non-critical — best-effort cleanup */ }
    _speedMultiplier = 1;
    toast('🗑 All starfield data reset', 'success');
    updateDevStats();
    if (typeof renderStarfield === 'function') renderStarfield();
    else if (typeof renderStarfield === 'function') renderStarfield();
  }

  // ═══ EASTER EGGS ═══

  function partyMode() {
    unlock('party_animal');
    document.body.classList.toggle('party-mode');
    if (document.body.classList.contains('party-mode')) {
      toast('🎉 Party Mode ON!', 'success');
      _partyInterval = setInterval(function () {
        if (typeof launchConfetti === 'function') launchConfetti();
      }, 2000);
    } else {
      toast('Party Mode OFF', '');
      clearInterval(_partyInterval);
      _partyInterval = null;
    }
  }

  function matrixMode() {
    unlock('matrix_user');
    document.body.classList.toggle('matrix-mode');
    if (document.body.classList.contains('matrix-mode')) {
      toast('🟢 Welcome to the Matrix...', 'success');
    } else {
      toast('Left the Matrix', '');
    }
  }

  function glitchTitle() {
    var title = document.getElementById('app-title');
    if (!title) return;
    title.classList.add('glitch-active');
    setTimeout(function () { title.classList.remove('glitch-active'); }, 3000);
    toast('⚠️ SYSTEM GLITCH', 'error');
  }

  function secretConsole(cmd) {
    cmd = (cmd || '').toLowerCase().trim();
    switch (cmd) {
      case 'sudo':
        toast("Nice try 😏 This isn't a terminal... or is it?", '');
        break;
      case '42':
        toast('🧠 The Answer to the Ultimate Question of Homework: 42', 'success');
        break;
      case 'hack':      glitchTitle(); break;
      case 'party':     partyMode();   break;
      case 'matrix':    matrixMode();  break;
      case 'shooting':  if (typeof toggleStarfieldShooting === 'function') toggleStarfieldShooting(); break;
      case 'detail':    if (typeof toggleStarfieldDetail === 'function') toggleStarfieldDetail(); break;
      case 'moon':
        toast('To the moon! 🚀', 'success');
        document.body.style.transition = 'transform 1.5s ease-in';
        document.body.style.transform = 'translateY(-100vh)';
        setTimeout(function () {
          document.body.style.transition = 'transform 0.5s ease-out';
          document.body.style.transform = '';
        }, 1500);
        break;
      case 'help':
        toast('Commands: sudo, 42, hack, party, matrix, moon, shooting, detail, help', '');
        break;
      default:
        toast('Unknown command: "' + cmd + '" — try "help"', 'error');
    }
  }

  // ═══ MATRIX RAIN ═══

  function startMatrixRain() {
    var canvas = document.getElementById('matrix-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var parent = canvas.parentElement;
    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight;
    var fontSize = 14;
    var cols = Math.floor(canvas.width / fontSize);
    var drops = [];
    for (var i = 0; i < cols; i++) drops.push(Math.random() * canvas.height / fontSize);
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?/~`🌟⭐✨💫🌠💎🏆';

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f0';
      ctx.font = fontSize + 'px monospace';
      for (var i = 0; i < drops.length; i++) {
        var ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      _matrixAnimFrame = requestAnimationFrame(draw);
    }
    draw();
  }

  function stopMatrixRain() {
    if (_matrixAnimFrame) {
      cancelAnimationFrame(_matrixAnimFrame);
      _matrixAnimFrame = null;
    }
  }

  // ═══ ACHIEVEMENTS ═══

  function unlock(id) {
    if (_devAchievements[id]) return;
    _devAchievements[id] = true;
    var a = ACHIEVEMENTS[id];
    if (a) toast('🏆 Dev Achievement: ' + a.emoji + ' ' + a.name, 'success');
    renderAchievements();
  }

  function renderAchievements() {
    var el = document.getElementById('dev-achievements');
    if (!el) return;
    var html = '';
    Object.keys(ACHIEVEMENTS).forEach(function (id) {
      var a = ACHIEVEMENTS[id];
      var unlocked = _devAchievements[id];
      html += '<div class="dev-achievement ' + (unlocked ? 'unlocked' : 'locked') + '">' +
        '<span class="dev-achievement-emoji">' + (unlocked ? a.emoji : '🔒') + '</span>' +
        '<span class="dev-achievement-name">' + a.name + '</span>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  // ═══ DEV STATS ═══
  function updateDevStats() {
    var el = document.getElementById('dev-stats-info');
    if (!el) return;

    var rows = '';
    if (_isStarfieldReady()) {
      var state = getStarfieldState();
      rows += '<div class="dev-stat-row"><span>Speed:</span><span>' + _speedMultiplier + 'x</span></div>';
      rows += '<div class="dev-stats-section-title" style="margin-top:8px;color:var(--text2);font-size:11px;letter-spacing:0.6px;text-transform:uppercase">Constellations</div>';
      var totalLit = 0;
      var totalCap = 0;
      CONSTELLATIONS.forEach(function (c) {
        var m = (state.m && state.m[c.metric]) || 0;
        var lit = Math.min(m, c.stars);
        var capped = c.stars;
        totalLit += lit;
        totalCap += capped;
        var pct = capped ? Math.round((lit / capped) * 100) : 0;
        rows += '<div class="dev-stat-row"><span>' + c.name + ':</span><span>' + lit +
                ' / ' + capped + ' <span style="color:var(--text3);font-size:11px">(' + pct + '%)</span></span></div>';
      });
      rows += '<div class="dev-stat-row" style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px"><span>Total stars lit:</span><span>' + totalLit + ' / ' + totalCap + '</span></div>';
      if (state.detail) rows += '<div class="dev-stat-row"><span>Detail mode:</span><span>on ✓</span></div>';
      if (state.shooting) rows += '<div class="dev-stat-row"><span>Shooting stars:</span><span>on ✓</span></div>';
      if (totalLit >= totalCap && totalCap > 0) unlock('constellation_full');
    } else {
      rows += '<div class="dev-stat-row"><span>Status:</span><span>starfield not loaded</span></div>';
      rows += '<div class="dev-stat-row"><span>Speed:</span><span>' + _speedMultiplier + 'x</span></div>';
    }
    el.innerHTML = rows;
  }

  return {
    init: init,
    open: openDevPanel,
    close: closeDevPanel,
    isActive: isActive,
    addCoins: addCoins,
    instantComplete: instantComplete,
    setSpeed: setSpeed,
    resetSpeed: resetSpeed,
    unlockAllSpecies: unlockAllSpecies,
    maxStats: maxStats,
    fillGarden: fillGarden,
    addFakeSession: addFakeSession,
    resetAllData: resetAllData,
    partyMode: partyMode,
    matrixMode: matrixMode,
    glitchTitle: glitchTitle,
    secretConsole: secretConsole,
    renderAchievements: renderAchievements,
    updateDevStats: updateDevStats
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  DevMode.init();
});
