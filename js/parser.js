// parser.js — NLP parser extracted from app.js
// Contains: NL_DATE_SYNONYMS, applyDateSynonyms, buildAndExtendCompromisePlugin,
// INTENT_KEYWORDS, ASSIGNMENT_TYPE_TO_TEMPLATE, parseQuickAdd + all helpers.

// Maps shorthand / shifted date phrases to canonical forms the parser
// recognises later ("tomorrow", "end of week", "next week", "next weekend").
// Longer keys listed FIRST so e.g. "next weekend" doesn't get partially
// rewritten by a standalone "next" rule downstream. Kept separate from the
// legacy shorthand normalization in parseQuickAdd so each system's
// behavior can be read in isolation.
var NL_DATE_SYNONYMS = {
  'end of wk':      'end of week',
  'next wk':        'next week',
  'this wk':        'this week',
  'next weekend':   'next weekend',
  'this weekend':   'this weekend',
  'coming weekend': 'next weekend',
  'in a week':      'in one week',
  'in a day':       'in one day',
  'in 2 weeks':     'in two weeks',
  'in 3 weeks':     'in three weeks'
};
function applyDateSynonyms(text) {
  var keys = Object.keys(NL_DATE_SYNONYMS);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var pattern = new RegExp('\\b' + k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi');
    text = text.replace(pattern, NL_DATE_SYNONYMS[k]);
  }
  return text;
}

// ── Compromise.js custom plugin ────────────────────────────────────────
// Builds a compromise plugin that tags user course names + synonyms as
// #Course entities and assignment-type keywords as #AssignmentType.
// Called at App.init() and re-built whenever subjects change (add/remove)
// so the lexicon stays in sync with the user's custom subject list.
function buildAndExtendCompromisePlugin() {
  if (typeof nlp === 'undefined' || typeof nlp.extend !== 'function') return;
  var courseWords = {};
  var assignmentWords = {};
  // User subjects (canonical names)
  for (var i = 0; i < subjects.length; i++) {
    var nameLower = subjects[i].name.toLowerCase();
    courseWords[nameLower] = 'Course';
  }
  // Course-specific synonym database — maps common terms/typos to actual
  // course names so "bio", "algebra", "apush" etc. are all tagged #Course.
  var synonyms = buildSubjectSynonyms();
  for (var syn in synonyms) {
    if (synonyms.hasOwnProperty(syn)) {
      courseWords[syn] = 'Course';
    }
  }
  // Assignment-type keywords (same list used in parseQuickAdd's type detection loop)
  var typeGroups = [
    ['homework','hw','hmwk','assignment'],
    ['essay','paper','report'],
    ['lab report','lab'],
    ['problem set','pset','exercises'],
    ['reading','read'],
    ['worksheet','ws'],
    ['project','presentation','poster'],
    ['quiz'],
    ['test','exam','midterm','final'],
    ['review','study guide','study'],
    ['discussion','reflection','reflection paper']
  ];
  for (var gi = 0; gi < typeGroups.length; gi++) {
    var keywords = typeGroups[gi];
    for (var ki = 0; ki < keywords.length; ki++) {
      assignmentWords[keywords[ki]] = 'AssignmentType';
    }
  }
  nlp.extend({
    tags: {
      Course: { isA: 'Noun' },
      AssignmentType: { isA: 'Noun' }
    },
    words: Object.assign({}, courseWords, assignmentWords)
  });
}

// Weighted keyword-scoring table for intent classification.
// Each keyword contributes to one of three intent scores (test / study / task).
// The intent with the highest total score wins during routing.
// Weights are additive — "math final exam" scores 5+5=10 test intent.
var INTENT_KEYWORDS = [
  // ── Test intent ──
  { words: ['exam', 'midterm', 'final'],          weight: 5, intent: 'test' },
  { words: ['test'],                                weight: 4, intent: 'test' },
  { words: ['quiz'],                                weight: 3, intent: 'test' },
  // ── Study intent ──
  { words: ['study'],                               weight: 3, intent: 'study' },
  { words: ['practice', 'prep', 'prepare'],         weight: 2, intent: 'study' },
  { words: ['review', 'revise'],                    weight: 1, intent: 'study' },
  // ── Task intent ──
  { words: ['homework', 'hw', 'hmwk', 'assignment'], weight: 3, intent: 'task' },
  { words: ['essay', 'paper', 'report', 'lab', 'reading', 'worksheet', 'pset', 'exercises'], weight: 2, intent: 'task' },
  { words: ['project', 'presentation', 'poster', 'discussion', 'reflection'], weight: 2, intent: 'task' },
];

var ASSIGNMENT_TYPE_TO_TEMPLATE = {
  'homework':     'tpl_hw',
  'essay':        'tpl_essay',
  'lab report':   'tpl_lab',
  'problem set':  'tpl_hw',
  'reading':      'tpl_reading',
  'worksheet':    'tpl_hw',
  'project':      'tpl_project',
  'quiz':         'tpl_quiz_prep',
  'test':         'tpl_quiz_prep',
  'review':       'tpl_study',
  'discussion':   'tpl_study',
};

// ── Parser helper: escape regex special characters ──
function parserEscRegex(s) { return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); }

// ── Parser helper: Levenshtein distance ──
function parserLevenshtein(a, b) {
  if (a===b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  var m = []; for (var i=0;i<=b.length;i++) m[i]=[i]; for (var j=0;j<=a.length;j++) m[0][j]=j;
  for (var i=1;i<=b.length;i++) for (var j=1;j<=a.length;j++) { var cost=b[i-1]===a[j-1]?0:1; m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+cost); }
  return m[b.length][a.length];
}

// ── Parser helper: fuzzy match ──
function parserFuzzyMatch(word, candidates, maxDist) {
  if (!word||!candidates.length) return null;
  var w=word.toLowerCase(), best=null, bestDist=maxDist||3;
  for (var i=0;i<candidates.length;i++) { var cl=candidates[i].toLowerCase(); if (w===cl) return candidates[i]; var d=parserLevenshtein(w,cl); if (d<bestDist) { bestDist=d; best=candidates[i]; } }
  return best;
}

// ── TIER 4: Multi-intent splitter ──
// Splits raw input on ` and ` / ` then ` / `, `. URLs are masked BEFORE the
// split with a unique placeholder so any internal URL punctuation (commas in
// query strings, etc.) never causes a false split. The placeholder is then
// restored after the split.
function parserSplitIntents(raw) {
  if (!raw || !raw.trim()) return [raw || ''];
  // Greedy non-whitespace URL match — comma is part of the URL, never a split trigger.
  var urlRegex = /https?:\/\/[^\s]+|\b(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\/[^\s]*/gi;
  var urls = [];
  var workingText = raw.replace(urlRegex, function(m) {
    urls.push(m);
    return '\u0001U' + (urls.length - 1) + '\u0001';
  });
  var parts = workingText.split(/\s+(?:and|then)\s+|\s*,\s+/i).map(function(p) {
    return p.replace(/\u0001U(\d+)\u0001/g, function(_, n) { return urls[+n] || ''; }).trim();
  });
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i]) out.push(parts[i]);
  }
  return out.length ? out : [raw.trim()];
}

// ── TIER 3: Entity resolution & graph linking ──
// Score each existing task against the parsed result. Returns the top matches
// above threshold (>= 0.5) sorted desc by score.
function parserResolveExistingTaskMatches(parsed, existingTasks) {
  if (!parsed || !existingTasks || !existingTasks.length) return [];
  var matches = [];
  for (var i = 0; i < existingTasks.length; i++) {
    var t = existingTasks[i];
    if (!t || !t.title) continue;
    var subjectExact = (t.subject && parsed.subject && t.subject.toLowerCase() === parsed.subject.toLowerCase()) ? 1.0 : 0;
    var titleSim = _titleFuzzyScore(parsed.title || '', t.title || '');
    var personScore = _personOverlapScore(parsed.entities || {}, t);
    var quotedScore = _quotedOverlapScore(parsed.entities || {}, t);
    var score = Math.min(1, titleSim * 0.6 + subjectExact * 0.3 + personScore * 0.1 + quotedScore * 0.15);
    if (score >= 0.5) {
      matches.push({
        taskId: t.id, title: t.title, subject: t.subject,
        score: Math.round(score * 100) / 100,
        kind: titleSim >= 0.95 ? 'duplicate' : (subjectExact ? 'same-subject' : 'related')
      });
    }
  }
  matches.sort(function(a, b) { return b.score - a.score; });
  return matches.slice(0, 3);

  function _titleFuzzyScore(a, b) {
    if (!a || !b) return 0;
    var al = a.toLowerCase().trim(), bl = b.toLowerCase().trim();
    if (al === bl) return 1;
    var aw = al.split(/\s+/).filter(Boolean);
    var bw = bl.split(/\s+/).filter(Boolean);
    var aSet = {}, bSet = {};
    for (var i = 0; i < aw.length; i++) aSet[aw[i]] = true;
    for (var j = 0; j < bw.length; j++) bSet[bw[j]] = true;
    var inter = 0; for (var k in aSet) if (bSet[k]) inter++;
    var union = aw.length + bw.length - inter;
    var jacc = union ? inter / union : 0;
    var d = parserLevenshtein(al, bl);
    var lev = Math.max(0, 1 - d / Math.max(al.length, bl.length, 1));
    return Math.max(jacc, lev);
  }
  function _personOverlapScore(pe, ex) {
    var ppl = pe.people || [];
    if (!ppl.length) return 0;
    var haystack = ((ex.title || '') + ' ' + (ex.notes || '')).toLowerCase();
    var matched = 0;
    for (var k = 0; k < ppl.length; k++) {
      if (haystack.indexOf(ppl[k].toLowerCase()) >= 0) matched++;
    }
    return matched / ppl.length;
  }
  function _quotedOverlapScore(pe, ex) {
    var pQ = (pe && pe.quoted) || [];
    var eQ = ((ex && ex.entities && ex.entities.quoted) || []);
    if (!pQ.length || !eQ.length) return 0;
    var pNorm = pQ.map(function(q) { return { a:(q.author||'').toLowerCase().trim(), t:(q.title||'').toLowerCase().trim() }; });
    var eNorm = eQ.map(function(q) { return { a:(q.author||'').toLowerCase().trim(), t:(q.title||'').toLowerCase().trim() }; });
    var matched = 0;
    for (var i = 0; i < pNorm.length; i++) {
      for (var j = 0; j < eNorm.length; j++) {
        if (eNorm[j].a === pNorm[i].a && eNorm[j].t === pNorm[i].t) { matched++; break; }
      }
    }
    return matched / pQ.length;
  }
}

// ── Weighted keyword-scoring for intent classification ──
function parserScoreIntents(raw, result) {
  var lower = raw.toLowerCase();
  var scores = { test: 0, study: 0, task: 0 };
  INTENT_KEYWORDS.forEach(function(group) {
    for (var i = 0; i < group.words.length; i++) {
      if (new RegExp('\\b' + parserEscRegex(group.words[i]) + '\\b', 'i').test(lower)) {
        scores[group.intent] += group.weight;
        break; // one match per keyword group to prevent double-counting synonyms
      }
    }
  });
  result.intentScores = scores;
  result.isTestLike = scores.test > scores.task && scores.test > 0;
}

// ── Resolve a parsed assignmentType to its matching template ──
function parserGetTemplateForAssignmentType(type) {
  if (!type) return null;
  var tplId = ASSIGNMENT_TYPE_TO_TEMPLATE[type];
  if (!tplId || typeof getTemplates !== 'function') return null;
  var tpls = getTemplates();
  return tpls.find(function(t) { return t.id === tplId; }) || null;
}

// ── Format an ISO date as M/D with no zero-padding ──
function parserFormatMD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return m + '/' + d;
}

// ── MAIN PARSER: parseQuickAdd ──
// `self` parameter is the App object (used as `this` context).
// Extracted as a standalone function so it can live in its own file.
function parseQuickAdd(self, raw) {
  if (!raw||!raw.trim()) return null;
  var result = {
    title: '', subject: (self.state.subjects[0]||{name:'Other'}).name, due: '', time: 0,
    priority: 'Medium', status: 'pending', notes: '', assignmentType: '',
    entities: { chapters: [], pages: [], urls: [], people: [], quoted: [] },
    actionVerb: null, isTestLike: false, isProjectLike: false,
    intentScores: { test: 0, study: 0, task: 0 },
    confidence: { subject: 0.3, title: 0.3, due: 0.3, time: 0.3, priority: 0.7 }
  };
  var text = raw.trim().toLowerCase();
  var originalText = raw.trim();

  // ── Intent scoring ──
  parserScoreIntents(raw, result);

  // Normalize shorthand + apply NL_DATE_SYNONYMS
  text = applyDateSynonyms(text);
  text = text.replace(/\btmrw?\b/g,'tomorrow')
             .replace(/\btonite?\b/g,'today')
             .replace(/\btonight\b/g,'today')
             .replace(/\b2day\b/g,'today')
             .replace(/\beod\b/g,'today')
             .replace(/\beow\b/g,'end of week')
             .replace(/\bnext\s+wk\b/g,'next week')
             .replace(/\bthis\s+wk\b/g,'this week')
             .replace(/\bnxt\b/g,'next')
             .replace(/\bwk\b/g,'week')
             .replace(/\bnite\b/g,'night')
             .replace(/\b1st\b/g,'first')
             .replace(/\b2nd\b/g,'second')
             .replace(/\b3rd\b/g,'third');

  // Release-note entities
  var QUOTED_RE = /["\u201C\u201D]([^"\u201C\u201D]+)["\u201C\u201D]|['\u2018\u2019]([^'\u2018\u2019]+)['\u2018\u2019]/g;
  var _qMatch;
  while ((_qMatch = QUOTED_RE.exec(originalText)) !== null) {
    var _qContent = (_qMatch[1] || _qMatch[2] || '').trim();
    if (!_qContent) continue;
    var _qAuthor = null;
    var _qTitle = _qContent;
    var _qCommaAt = _qContent.indexOf(',');
    if (_qCommaAt > 0) {
      var _aPart = _qContent.slice(0, _qCommaAt).trim();
      var _tPart = _qContent.slice(_qCommaAt + 1).trim();
      if (_aPart && _tPart) { _qAuthor = _aPart; _qTitle = _tPart; }
    }
    result.entities.quoted.push({ quote: _qMatch[0], author: _qAuthor, title: _qTitle });
  }

  // Tier 2: extract structured entities BEFORE filler removal
  var chapterMatch = text.match(/\b(?:ch\.?|chapter)\s+(\d+(?:\s*[-–]\s*\d+)?)\b/i);
  if (chapterMatch) {
    result.entities.chapters.push(chapterMatch[1].replace(/\s/g, ''));
    text = text.replace(chapterMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }
  var pagesMatch = text.match(/\b(?:pp?|pages?)\s+(\d+(?:\s*[-–]\s*\d+)?)\b/i);
  if (pagesMatch) {
    result.entities.pages.push(pagesMatch[1].replace(/\s/g, ''));
    text = text.replace(pagesMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }
  var urlMatch = text.match(/https?:\/\/[^\s,]+|\b(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\/[^\s,]*/i);
  if (urlMatch) {
    result.entities.urls.push(urlMatch[0].replace(/[,.]$/, ''));
    text = text.replace(urlMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }
  var personMatches = [];
  var personRegex = /\b(?:with|for|to|at|by|from)\s+((?:Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  var pmMatch;
  while ((pmMatch = personRegex.exec(originalText)) !== null) {
    personMatches.push({ full: pmMatch[0], name: pmMatch[1].trim() });
  }
  for (var pi = 0; pi < personMatches.length; pi++) {
    result.entities.people.push(personMatches[pi].name);
    text = text.replace(personMatches[pi].full.toLowerCase(), ' ').replace(/\s+/g, ' ').trim();
  }

  // Capture leading action verb
  var ACTION_VERBS = ['study','review','prep','prepare','read','submit','revise','practice'];
  for (var avk = 0; avk < ACTION_VERBS.length; avk++) {
    var avr = new RegExp('\\b' + parserEscRegex(ACTION_VERBS[avk]) + '\\b', 'i');
    if (avr.test(text)) { result.actionVerb = ACTION_VERBS[avk]; break; }
  }

  // ── PRE-FILLER DATE PHRASES ──
  if (!result.due && /\bend\s+of\s+week\b/i.test(text)) {
    var preEowD = new Date();
    var preEowDiff = (5 - preEowD.getDay() + 7) % 7;
    preEowD.setDate(preEowD.getDate() + preEowDiff);
    result.due = preEowD.toISOString().split('T')[0];
    result.confidence.due = 0.85;
    text = text.replace(/\bend\s+of\s+week\b/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!result.due && /\bday\s+after\s+tomorrow\b/i.test(text)) {
    var datD = new Date();
    datD.setDate(datD.getDate() + 2);
    result.due = datD.toISOString().split('T')[0];
    result.confidence.due = 0.9;
    text = text.replace(/\bday\s+after\s+tomorrow\b/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!result.due && /\bthis\s+week\b/i.test(text)) {
    var twD = new Date();
    var twDiff = (5 - twD.getDay() + 7) % 7;
    twD.setDate(twD.getDate() + twDiff);
    result.due = twD.toISOString().split('T')[0];
    result.confidence.due = 0.75;
    text = text.replace(/\bthis\s+week\b/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  // ── CHRONO DATE EXTRACTION (before filler removal) ──
  if (!result.due && typeof chrono !== 'undefined' && chrono.parse) {
    var refDate = new Date();
    var chronoResults = chrono.parse(text, refDate);
    if (chronoResults.length > 0) {
      var cr = chronoResults[0];
      var parsedDate = cr.start.date();
      var dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      var matchedLower = cr.text.toLowerCase().trim();
      var isWeekday = dayNames.indexOf(matchedLower) !== -1;
      var isToday = parsedDate.toDateString() === refDate.toDateString();
      var todayStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
      var isPast = parsedDate < todayStart;
      if (isWeekday && (isToday || isPast)) {
        parsedDate.setDate(parsedDate.getDate() + 7);
      }
      var looksLikeExplicit = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2})\b/i.test(cr.text);
      if (!isWeekday && isPast && looksLikeExplicit) {
        parsedDate.setFullYear(parsedDate.getFullYear() + 1);
      }
      result.due = parsedDate.toISOString().split('T')[0];
      result.confidence.due = 0.9;
      var stripped = text.replace(new RegExp(parserEscRegex(cr.text), 'i'), ' ').replace(/\s+/g, ' ').trim();
      if (stripped !== text) text = stripped;
    }
  }

  // ── Compromise NLP block ──
  var sharedDoc = null;
  var timeStripText = '';
  if (typeof nlp !== 'undefined') {
    sharedDoc = nlp(text);
    // 1) Extract adjectives for priority
    if (result.confidence.priority < 1.0) {
      var adjMap = { urgent: 'Urgent', critical: 'Urgent', high: 'High', important: 'High',
                     major: 'High', hard: 'High', difficult: 'High', medium: 'Medium',
                     normal: 'Medium', regular: 'Medium', low: 'Low', minor: 'Low',
                     easy: 'Low', simple: 'Low', optional: 'Low' };
      var adjs = sharedDoc.adjectives().out('array');
      for (var ai = 0; ai < adjs.length; ai++) {
        var adjLower = adjs[ai].toLowerCase();
        if (adjMap[adjLower]) {
          result.priority = adjMap[adjLower];
          result.confidence.priority = 0.85;
          break;
        }
      }
    }
    // 2) Extract numbers with time units
    if (!result.time) {
      var numResults = sharedDoc.numbers().json();
      for (var ni = 0; ni < numResults.length; ni++) {
        var nr = numResults[ni];
        var rawUnit = (nr.unit || '').toLowerCase();
        if (rawUnit === 'm' || rawUnit === 'min' || rawUnit === 'mins' || rawUnit === 'minutes') {
          result.time = Math.round(nr.number);
          result.confidence.time = 1.0;
          timeStripText = nr.text || nr.whole || '';
          break;
        }
        if (rawUnit === 'h' || rawUnit === 'hr' || rawUnit === 'hrs' || rawUnit === 'hours' || rawUnit === 'hour') {
          result.time = Math.round(nr.number * 60);
          result.confidence.time = 1.0;
          timeStripText = nr.text || nr.whole || '';
          break;
        }
      }
    }
    // 3) Filler removal via POS tags
    text = sharedDoc.not('#Preposition').not('#Determiner')
      .not('#Modal').not('#Auxiliary').text();
    text = text.replace(/\b(plz|pls|please|need to|gotta|have to|should|finish|complete|do|due|also|still|just|really|very|kinda|sorta|maybe|my|and|or|but|nor)\b/g,'').replace(/\s+/g,' ').trim();
    if (timeStripText) {
      text = text.replace(new RegExp('\\b' + parserEscRegex(timeStripText) + '\\b', 'i'), ' ').replace(/\s+/g, ' ').trim();
    }
  } else {
    text = text.replace(/\b(plz|pls|please|need to|gotta|have to|should|finish|complete|do|my|the|a|an|for|of|and|or|to|with|due|by|before|till|until|also|still|just|really|very|kinda|sorta|maybe)\b/g,'').replace(/\s+/g,' ').trim();
  }

  if (!text) { result.title = raw.trim(); return result; }

  // Extract priority — keyword map
  var prioMap = {'urgent':'Urgent','asap':'Urgent','critical':'Urgent','immediately':'Urgent','overdue':'Urgent','late':'Urgent','super important':'Urgent','top priority':'Urgent','important':'High','priority':'High','major':'High','big':'High','hard':'High','difficult':'High','high':'High','medium':'Medium','normal':'Medium','regular':'Medium','meh':'Medium','low':'Low','minor':'Low','easy':'Low','small':'Low','simple':'Low','trivial':'Low','whenever':'Low','no rush':'Low','eventually':'Low','optional':'Low'};
  for (var k in prioMap) { if (new RegExp('\\b'+k+'\\b','i').test(text)) { result.priority = prioMap[k]; result.confidence.priority = 1.0; text = text.replace(new RegExp('\\b'+k+'\\b','gi'),' ').trim(); break; } }

  // Extract time — regex fallback chain
  if (!result.time) {
    var ct = text.match(/\b(\d+)\s*h(?:r|rs)?\s+(\d+)\s*(?:m|min|mins|minutes)\b/i);
    if (ct) { result.time = parseInt(ct[1])*60+parseInt(ct[2]); result.confidence.time = 1.0; text = text.replace(ct[0],' ').trim(); }
    else { var cm = text.match(/\b(couple|coupla)(?:\s+of)?\s+(?:hours?|hrs?)\b/i); if (cm) { result.time=120; result.confidence.time = 0.85; text=text.replace(cm[0],' ').trim(); } else { var hm = text.match(/\bhalf\s+(?:an?\s+)?(?:hour|hrs?)\b/i); if (hm) { result.time=30; result.confidence.time = 0.85; text=text.replace(hm[0],' ').trim(); } else { var st = text.match(/\b(\d+\.?\d*)\s*(m|min|mins|minutes|h|hr|hrs|hour|hours)\b/i); if (st) { var v=parseFloat(st[1]),u=st[2].toLowerCase(); result.time=u.startsWith('h')?Math.round(v*60):Math.round(v); result.confidence.time = 1.0; text=text.replace(st[0],' ').trim(); } } } }
  }

  // ── Compromise custom-entity extraction ──
  var subjectFound = false;
  if (typeof nlp !== 'undefined') {
    var courseMatches = sharedDoc.match('#Course+');
    if (courseMatches.found) {
      var matchedText = courseMatches.text().toLowerCase().trim();
      for (var cj = 0; cj < self.state.subjects.length; cj++) {
        var cjNameLower = self.state.subjects[cj].name.toLowerCase();
        if (matchedText === cjNameLower || matchedText.indexOf(cjNameLower + ' ') === 0) {
          result.subject = self.state.subjects[cj].name;
          result.confidence.subject = 1.0;
          text = text.replace(new RegExp('\\b' + parserEscRegex(self.state.subjects[cj].name) + '\\b', 'i'), ' ').replace(/\s+/g, ' ').trim();
          subjectFound = true;
          break;
        }
      }
      if (!subjectFound) {
        var courseSyns = buildSubjectSynonyms();
        if (courseSyns[matchedText]) {
          var canonSubj = courseSyns[matchedText];
          var canonMatch = self.state.subjects.find(function(s){return s.name===canonSubj;});
          if (canonMatch) {
            result.subject = canonMatch.name;
            result.confidence.subject = 0.85;
            // Strip the FULL matched text (e.g., "ap lang") not just the first word
            text = text.replace(new RegExp('\\b' + parserEscRegex(matchedText) + '\\b', 'i'), ' ').replace(/\s+/g, ' ').trim();
            subjectFound = true;
          }
        }
        if (!subjectFound) {
          var spanWords = matchedText.split(' ');
          for (var swi = 0; swi < spanWords.length; swi++) {
            if (courseSyns[spanWords[swi]]) {
              var cs = courseSyns[spanWords[swi]];
              var cm = self.state.subjects.find(function(s){return s.name===cs;});
              if (cm) {
                result.subject = cm.name;
                result.confidence.subject = 0.85;
                text = text.replace(new RegExp('\\b' + parserEscRegex(spanWords[swi]) + '\\b', 'i'), ' ').replace(/\s+/g, ' ').trim();
                subjectFound = true;
                break;
              }
            }
          }
        }
      }
    }
    // #AssignmentType entity spans
    if (!result.assignmentType) {
      var typeMatches = sharedDoc.match('#AssignmentType+');
      if (typeMatches.found) {
        var typeMatchedText = typeMatches.text().toLowerCase().trim();
        var typeMap = {};
        var typeGroups = [
          {type:'homework',s:['homework','hw','hmwk','assignment']},
          {type:'essay',s:['essay','paper','report']},
          {type:'lab report',s:['lab report','lab']},
          {type:'problem set',s:['problem set','pset','exercises']},
          {type:'reading',s:['reading','read']},
          {type:'worksheet',s:['worksheet','ws']},
          {type:'project',s:['project','presentation','poster']},
          {type:'quiz',s:['quiz']},
          {type:'test',s:['test','exam','midterm','final']},
          {type:'review',s:['review','study guide','study']},
          {type:'discussion',s:['discussion','reflection','reflection paper']}
        ];
        for (var tgi = 0; tgi < typeGroups.length; tgi++) {
          for (var tsi = 0; tsi < typeGroups[tgi].s.length; tsi++) {
            typeMap[typeGroups[tgi].s[tsi]] = typeGroups[tgi].type;
          }
        }
        if (typeMap[typeMatchedText]) {
          result.assignmentType = typeMap[typeMatchedText];
          text = text.replace(new RegExp('\\b' + parserEscRegex(typeMatchedText) + '\\b', 'gi'), ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }
    // Fallback: generic noun phrase extraction
    if (!subjectFound) {
      var nounPhrases = sharedDoc.nouns().out('array');
      for (var npi = 0; npi < nounPhrases.length; npi++) {
        var np = nounPhrases[npi].toLowerCase().trim();
        for (var sj = 0; sj < self.state.subjects.length; sj++) {
          var nameLower = self.state.subjects[sj].name.toLowerCase();
          if (np === nameLower || np.indexOf(nameLower + ' ') === 0) {
            result.subject = self.state.subjects[sj].name;
            result.confidence.subject = 1.0;
            text = text.replace(new RegExp('\\b' + parserEscRegex(self.state.subjects[sj].name) + '\\b', 'i'), ' ').replace(/\s+/g, ' ').trim();
            subjectFound = true;
            break;
          }
        }
        if (subjectFound) break;
      }
    }
  }

  // Extract subject — regex fallback
  self.state.subjects.forEach(function(s) {
    if (!subjectFound && new RegExp('\\b' + parserEscRegex(s.name) + '\\b', 'i').test(text)) {
      result.subject = s.name;
      result.confidence.subject = 1.0;
      text = text.replace(new RegExp('\\b' + parserEscRegex(s.name) + '\\b', 'gi'), ' ').trim();
      subjectFound = true;
    }
  });

  // Course-specific synonym database
  var subjectSynonyms = buildSubjectSynonyms();
  if (!subjectFound) {
    for (var syn in subjectSynonyms) {
      if (new RegExp('\\b' + parserEscRegex(syn) + '\\b', 'i').test(text)) {
        var canonical = subjectSynonyms[syn];
        var userMatch = self.state.subjects.find(function(s){return s.name===canonical;});
        if (userMatch) { result.subject = userMatch.name; result.confidence.subject = 0.85; subjectFound = true; }
        else { result.subject = (self.state.subjects[0]||{name:'Other'}).name; result.confidence.subject = 0.3; subjectFound = true; }
        text = text.replace(new RegExp('\\b' + parserEscRegex(syn) + '\\b', 'gi'), ' ').trim();
        break;
      }
    }

    // If still not found, try stripping "ap ", "honors ", or "honor " prefix
    // from the original raw input and retry synonym matching. This handles
    // cases like "ap lang hw" when the user has "AP English Language" but
    // "ap lang" isn't a direct synonym (only "lang" is). Also strips the
    // matched synonym from `text` so it doesn't pollute the title.
    if (!subjectFound) {
      var originalRaw = raw.trim();
      var strippedRaw = originalRaw.replace(/\b(ap|honors?)\s+/i, '').trim();
      if (strippedRaw !== originalRaw) {
        for (var syn2 in subjectSynonyms) {
          if (new RegExp('\\b' + parserEscRegex(syn2) + '\\b', 'i').test(strippedRaw)) {
            var canonical2 = subjectSynonyms[syn2];
            var userMatch2 = self.state.subjects.find(function(s){return s.name===canonical2;});
            if (userMatch2) { result.subject = userMatch2.name; result.confidence.subject = 0.8; subjectFound = true; }
            // Strip the matched synonym from text for clean title generation
            text = text.replace(new RegExp('\\b' + parserEscRegex(syn2) + '\\b', 'gi'), ' ').trim();
            break;
          }
        }
      }
    }
  }

  // ── Strip course prefix words (ap, honors, honor) ──
  // Runs after ALL subject-detection paths so it applies to NLP, regex,
  // synonym, and prefix-stripping paths alike. Prevents "honor english
  // essay" from having a title of "honor essay".
  if (subjectFound) {
    text = text.replace(/\b(ap|honors?)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  // Fuzzy match against user subjects
  if (!subjectFound && text.length >= 3) {
    var words = text.split(/\s+/);
    for (var fi = 0; fi < words.length; fi++) {
      if (words[fi].length < 3) continue;
      var maxDist = words[fi].length <= 4 ? 1 : 2;
      var candidate = parserFuzzyMatch(words[fi], self.state.subjects.map(function(s){return s.name;}), maxDist);
      if (candidate) { result.subject = candidate; result.confidence.subject = 0.6; subjectFound = true; text = text.replace(new RegExp('\\b' + parserEscRegex(words[fi]) + '\\b', 'gi'), ' ').trim(); break; }
      if (!candidate) {
        var synKeys = Object.keys(subjectSynonyms);
        var synCandidate = parserFuzzyMatch(words[fi], synKeys, maxDist);
        if (synCandidate && subjectSynonyms[synCandidate]) {
          var synCanonical = subjectSynonyms[synCandidate];
          var synUserMatch = self.state.subjects.find(function(s){return s.name===synCanonical;});
          if (synUserMatch) { result.subject = synUserMatch.name; result.confidence.subject = 0.65; subjectFound = true; }
          text = text.replace(new RegExp('\\b' + parserEscRegex(words[fi]) + '\\b', 'gi'), ' ').trim();
          break;
        }
      }
    }
  }

  // Assignment type detection — regex fallback
  if (!result.assignmentType) {
    var types = [{type:'homework',s:['homework','hw','hmwk','assignment']},{type:'essay',s:['essay','paper','report']},{type:'lab report',s:['lab report','lab']},{type:'problem set',s:['problem set','pset','exercises']},{type:'reading',s:['reading','read']},{type:'worksheet',s:['worksheet','ws']},{type:'project',s:['project','presentation','poster']},{type:'quiz',s:['quiz']},{type:'test',s:['test','exam','midterm','final']},{type:'review',s:['review','study guide','study']},{type:'discussion',s:['discussion','reflection','reflection paper']}];
    for (var ti = 0; ti < types.length; ti++) {
      for (var si = 0; si < types[ti].s.length; si++) {
        if (new RegExp('\\b' + parserEscRegex(types[ti].s[si]) + '\\b', 'i').test(text)) {
          result.assignmentType = types[ti].type;
          text = text.replace(new RegExp('\\b' + parserEscRegex(types[ti].s[si]) + '\\b', 'gi'), ' ').trim();
          break;
        }
        if (result.assignmentType) break;
      }
    }
  }

  result.isProjectLike = (result.assignmentType === 'project');

  // Strip the captured action verb
  if (result.actionVerb) {
    text = text.replace(new RegExp('\\b' + parserEscRegex(result.actionVerb) + '\\b', 'gi'), ' ').replace(/\\s+/g, ' ').trim();
  }

  // Clean title
  text = text.replace(/^[:\-\s,]+|[:\-\s,]+$/g,'').trim().replace(/\s+/g,' ').trim();
  text = text.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|tomorrow|today|tonight|next week|this week|end of week)\b/gi,'').trim().replace(/\s+/g,' ').trim();
  text = text.replace(/\b(on|at|in|by|the|a|an|to)\b/gi, ' ').replace(/\s+/g, ' ').trim();

  if (!text) {
    if (result.actionVerb) {
      result.title = result.actionVerb;
    } else {
      var parts=[];
      if (result.assignmentType) parts.push(result.assignmentType);
      parts.push(result.subject);
      result.title = parts.join(' ');
    }
    result.confidence.title = 0.4;
  } else {
    result.title = result.actionVerb ? (result.actionVerb + ' ' + text) : text;
    result.confidence.title = 0.7;
  }

  result.entityResolution = parserResolveExistingTaskMatches(result, self.state.tasks);
  return result;
}

// ── TIER 4: Higher-level entry returning an array ──
function parseQuickAddAll(self, raw) {
  if (!raw || !raw.trim()) return [];
  return parserSplitIntents(raw).map(function(part) {
    return parseQuickAdd(self, part);
  });
}
