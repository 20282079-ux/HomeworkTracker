// 3-quickadd.js (split from app.js) — quick-add history + suggestions dropdown
// ═══════════════════════════════════════════════
//  SMART DEFAULTS (frequency tracking)
// ═══════════════════════════════════════════════
function getQuickAddHistory() {
  try { var d = localStorage.getItem('hw_quickadd_history'); return d ? JSON.parse(d) : []; } catch(e) { return []; }
}
function saveQuickAddHistory(list) {
  localStorage.setItem('hw_quickadd_history', JSON.stringify(list.slice(0, 50)));
}
function recordQuickAdd(raw) {
  if (!raw || !raw.trim()) return;
  var input = raw.trim();
  var list = getQuickAddHistory();
  // Find existing entry or add new
  var existing = list.find(function(e) { return e.input.toLowerCase() === input.toLowerCase(); });
  if (existing) {
    existing.count++;
    existing.lastUsed = Date.now();
  } else {
    list.unshift({ input: input, count: 1, lastUsed: Date.now() });
  }
  // Sort by frequency (desc), then recency (desc)
  list.sort(function(a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastUsed - a.lastUsed;
  });
  saveQuickAddHistory(list);
}
function getSuggestions(query) {
  if (!query || !query.trim()) return [];
  var q = query.trim().toLowerCase();
  var list = getQuickAddHistory();
  // Only match entries where the query is a prefix or substring of the stored input
  var matches = list.filter(function(e) {
    var lower = e.input.toLowerCase();
    return lower.indexOf(q) >= 0;
  });
  // Sort: prefix matches first, then by frequency, then recency
  matches.sort(function(a, b) {
    var aLower = a.input.toLowerCase();
    var bLower = b.input.toLowerCase();
    var aPrefix = aLower.indexOf(q) === 0;
    var bPrefix = bLower.indexOf(q) === 0;
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
    if (b.count !== a.count) return b.count - a.count;
    return b.lastUsed - a.lastUsed;
  });
  return matches.slice(0, 5);
}

var _suggestionIndex = -1;
var _suggestionVisible = false;

function showSuggestions(query) {
  var dropdown = document.getElementById('qa-suggestions');
  var qaInput = document.getElementById('qa-input');
  if (!dropdown) return;
  var suggestions = getSuggestions(query);
  // Filter out exact match (redundant suggestion)
  var qLower = query.trim().toLowerCase();
  suggestions = suggestions.filter(function(s) { return s.input.toLowerCase() !== qLower; });
  if (suggestions.length === 0) {
    hideSuggestions();
    return;
  }
  _suggestionVisible = true;
  _suggestionIndex = -1;
  if (qaInput) qaInput.setAttribute('aria-expanded', 'true');
  dropdown.innerHTML = '';
  suggestions.forEach(function(s, i) {
    var item = document.createElement('div');
    item.className = 'qa-suggestion-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-index', i);
    // Highlight the matching part
    var lower = s.input.toLowerCase();
    var idx = lower.indexOf(query.trim().toLowerCase());
    if (idx >= 0) {
      var before = s.input.substring(0, idx);
      var match = s.input.substring(idx, idx + query.trim().length);
      var after = s.input.substring(idx + query.trim().length);
      item.innerHTML = escHtml(before) + '<span class="qa-suggestion-highlight">' + escHtml(match) + '</span>' + escHtml(after);
    } else {
      item.textContent = s.input;
    }
    // Frequency badge
    var badge = document.createElement('span');
    badge.className = 'qa-suggestion-count';
    badge.textContent = s.count + '×';
    item.appendChild(badge);

    item.addEventListener('mousedown', function(e) {
      e.preventDefault();
      selectSuggestion(i);
    });
    item.addEventListener('mouseenter', function() {
      highlightSuggestion(i);
    });
    dropdown.appendChild(item);
  });
  dropdown.classList.remove('hidden');
}

function hideSuggestions() {
  var dropdown = document.getElementById('qa-suggestions');
  var qaInput = document.getElementById('qa-input');
  if (dropdown) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; }
  if (qaInput) qaInput.setAttribute('aria-expanded', 'false');
  _suggestionVisible = false;
  _suggestionIndex = -1;
}
function scheduleHideSuggestions() {
  setTimeout(hideSuggestions, 150);
}

function highlightSuggestion(index) {
  var dropdown = document.getElementById('qa-suggestions');
  if (!dropdown) return;
  var items = dropdown.querySelectorAll('.qa-suggestion-item');
  items.forEach(function(el, i) {
    el.classList.toggle('qa-suggestion-active', i === index);
  });
  _suggestionIndex = index;
}

function selectSuggestion(index) {
  var suggestions = getSuggestions(document.getElementById('qa-input').value);
  if (index < 0 || index >= suggestions.length) return;
  var input = document.getElementById('qa-input');
  input.value = suggestions[index].input;
  hideSuggestions();
  // Trigger preview update
  var event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);
  input.focus();
}

function handleSuggestionKeydown(e) {
  if (!_suggestionVisible) return false;
  var dropdown = document.getElementById('qa-suggestions');
  var items = dropdown ? dropdown.querySelectorAll('.qa-suggestion-item') : [];
  var count = items.length;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _suggestionIndex = (_suggestionIndex + 1) % count;
    highlightSuggestion(_suggestionIndex);
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    _suggestionIndex = (_suggestionIndex - 1 + count) % count;
    highlightSuggestion(_suggestionIndex);
    return true;
  }
  if (e.key === 'Enter' && _suggestionIndex >= 0) {
    e.preventDefault();
    selectSuggestion(_suggestionIndex);
    return true;
  }
  if (e.key === 'Escape') {
    hideSuggestions();
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════
//  QUICK-ADD HISTORY (last 10, one-click)
// ═══════════════════════════════════════════════
function getRecentHistory(max) {
  max = max || 10;
  var list = getQuickAddHistory();
  // Sort by recency (lastUsed desc)
  var sorted = list.slice().sort(function(a, b) { return b.lastUsed - a.lastUsed; });
  return sorted.slice(0, max);
}

// renderQuickAddHistory is a no-op per user request — the "🕐 Recent" chip
// section is removed from the quick-add bar. The sentinel #qa-history div
// remains in the DOM (aria-hidden) so legacy callers don't crash, but we
// never replace its content or flip its display. Smart-default suggestions
// (via #qa-suggestions) still use the same localStorage history under the
// hood — just no longer surfaced as a horizontally-scrolling chip strip.
function renderQuickAddHistory() {
  var container = document.getElementById('qa-history');
  if (!container) return;
  container.innerHTML = '';
  container.style.display = 'none';
}

// ═══════════════════════════════════════════════
