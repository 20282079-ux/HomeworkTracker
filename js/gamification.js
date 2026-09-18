// ═══════════════════════════════════════════════════════════════
//  CONSTELLATION STARFIELD
//  A non-polygon ambient motivation layer. Five named
//  constellations, each tracking one productivity metric.
//  Stars are inherently varied (size, color, twinkle phase,
//  glow halo), so visual diversity comes from PROCEDURAL
//  placement rather than invented shapes.
//
//  By default the sky is silent and ambient. The opt-in
//  `○` chip in the corner reveals per-constellation names
//  and metric counts.
// ═══════════════════════════════════════════════════════════════

// ─── Spectral-type → realistic star color ───
//  Harvard spectral classification: O (hottest/bluest) → M (coolest/reddest).
//  Luminosity class (I-V) doesn't change hue, just line width — we ignore it.
//  Returns a CSS hex color suitable for fill/background, or null if unknown.
function getSpectralColor(spType) {
  if (!spType) return null;
  var cls = spType.charAt(0).toUpperCase();
  // Standard HR-diagram colors — main-sequence tints.
  // O: blue-white   B: blue-white   A: white        F: yellow-white
  // G: yellow       K: orange       M: red-orange
  switch (cls) {
    case 'O': return '#b8cbff';  // deep blue-white
    case 'B': return '#cad9ff';  // blue-white
    case 'A': return '#f2f5ff';  // white (barely blue)
    case 'F': return '#fff8e7';  // yellow-white
    case 'G': return '#ffe8b8';  // yellow
    case 'K': return '#ffd68a';  // gold-orange
    case 'M': return '#ffbc6e';  // red-orange
    default:  return null;
  }
}

// ─── Seeded PRNG (mulberry32) ───

// ─── Realistic twinkle amplitude from apparent magnitude ───
//  Brighter stars (low magnitude) twinkle LESS because their wider light
//  cone averages out atmospheric turbulence. Dim stars (high magnitude)
//  have a narrow cone and flicker noticeably. Returns 0.03–0.65.
//    mag 0.03 (Vega)    → amp 0.033  (steady)
//    mag 3.0  (moderate) → amp 0.30   (mild)
//    mag 6.5  (very dim) → amp 0.61   (active twinkle)
function getTwinkleAmp(mag) {
  if (typeof mag !== 'number' || isNaN(mag)) return 0.35;
  var amp = 0.03 + (mag / 7.0) * 0.62;
  return Math.min(0.65, Math.max(0.03, amp));
}

// ─── Parallax depth from distance in light-years ───
//  Closer stars (low distLY) shift MORE with mouse movement.
//  Distant stars (high distLY) barely move. Returns 0.02–0.90.
//    Vega (25 ly)        → depth 0.90  (lots of parallax)
//    Deneb (2615 ly)      → depth 0.13  (subtle shift)
//    Field star (5000 ly) → depth ~0.05 (barely moves)
function getParallaxDepth(distLY, maxRange) {
  if (typeof distLY !== 'number' || isNaN(distLY)) distLY = 3000;
  var range = maxRange || 3000;
  var depth = 1.0 - (distLY / range);
  return Math.min(0.90, Math.max(0.02, depth));
}

// ─── Mouse-parallax engine ───
var _pxRafId = null;
function startParallax(wrap) {
  if (!wrap || wrap.dataset.pxActive === '1') return;
  wrap.dataset.pxActive = '1';
  document.addEventListener('mousemove', function(e) {
    // Throttle to one update per animation frame.
    if (_pxRafId) return;
    _pxRafId = requestAnimationFrame(function() {
      _pxRafId = null;
      var cx = window.innerWidth / 2;
      var cy = window.innerHeight / 2;
      var dx = (e.clientX - cx) / cx;  // -1 … +1
      var dy = (e.clientY - cy) / cy;
      var maxShift = 14;  // pixels of maximum shift
      wrap.style.setProperty('--px-offset-x', (dx * maxShift).toFixed(1) + 'px');
      wrap.style.setProperty('--px-offset-y', (dy * maxShift).toFixed(1) + 'px');
    });
  });
}

// ─── Shared spectral-type generator ───
//  Used by placeAstronomicalStars (constellation ambient SVG stars) and
//  buildStarfieldOnce (background star-ambient dots). Avoids ~60 lines of
//  duplicated distribution arrays and picker functions.
var _SPEC_DIST = [
  { cls:'M', w:0.760 }, { cls:'K', w:0.120 }, { cls:'G', w:0.075 },
  { cls:'F', w:0.030 }, { cls:'A', w:0.010 }, { cls:'B', w:0.004 },
  { cls:'O', w:0.001 }
];
var _SPEC_TOTAL = (function(){ var s=0; for(var i=0;i<_SPEC_DIST.length;i++)s+=_SPEC_DIST[i].w;return s;})();
var _LUM_DIST = [
  { cls:'V', w:0.82 }, { cls:'IV', w:0.06 }, { cls:'III', w:0.09 },
  { cls:'II', w:0.02 }, { cls:'I', w:0.01 }
];
var _LUM_TOTAL = (function(){ var s=0; for(var i=0;i<_LUM_DIST.length;i++)s+=_LUM_DIST[i].w;return s;})();
function generateSpectralType(rng) {
  var r = rng() * _SPEC_TOTAL, cum = 0;
  for (var i = 0; i < _SPEC_DIST.length; i++) {
    cum += _SPEC_DIST[i].w;
    if (r <= cum) {
      var spCls = _SPEC_DIST[i].cls;
      var lumR = rng() * _LUM_TOTAL, lumCum = 0, lumCls = 'V';
      for (var j = 0; j < _LUM_DIST.length; j++) {
        lumCum += _LUM_DIST[j].w;
        if (lumR <= lumCum) { lumCls = _LUM_DIST[j].cls; break; }
      }
      return spCls + Math.floor(rng() * 10) + ' ' + lumCls;
    }
  }
  return 'M5 V';
}
function mulberry32(seed) {
  var a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Storage ───
var STARFIELD_KEY = 'hw_starfield_state';
var STARFIELD_DEFAULTS = {
  m: { tasks: 0, tests: 0, streak: 0, subjects: 0, early: 0 },
  detail: false,
  shooting: false,
  // VIEW-MODE TOGGLES (per user request):
  //   focusMode    — UI chrome faded out, starfield + sky remain
  //   nightSkyMode — UI chrome faded + midnight theme forced + ambient density boosted
  // Composing these two lets the user pick:
  //   none                  → normal app view
  //   focusMode only        → focus current theme
  //   nightSkyMode only     → force dark + boost sky
  //   both                  → focus + midnight + brightest stars (the immersive "stargazer" mode)
  focusMode: false,
  nightSkyMode: false,
  // The user's last-selected theme preset (midnight/light/etc). Used by
  // setNightSky/false hold-release path to restore the user's saved look.
  preset: null
};

function getStarfieldState() {
  // Migrate legacy forest / tree state into the starfield on first read.
  try {
    var d = localStorage.getItem(STARFIELD_KEY);
    if (d) {
      var parsed = JSON.parse(d);
      var merged = Object.assign({}, STARFIELD_DEFAULTS, parsed);
      // Backfill the metric dict too, so old payloads still expose all 5 metrics.
      merged.m = Object.assign({}, STARFIELD_DEFAULTS.m, parsed.m || {});
      return merged;
    }
    var legacyKeys = ['hw_forest_state', 'hw_tree_state'];
    var METRIC_KEYS = ['tasks','tests','streak','subjects','early'];
    for (var i = 0; i < legacyKeys.length; i++) {
      var lk = legacyKeys[i];
      var legacy = localStorage.getItem(lk);
      if (!legacy) continue;
      try {
        var l = JSON.parse(legacy);
        var m = (l && l.m) ? l.m : l;
        var merged2 = Object.assign({}, STARFIELD_DEFAULTS);
        var migrated = 0;
        if (m && typeof m === 'object') {
          METRIC_KEYS.forEach(function(k){
            if (typeof m[k] === 'number') { merged2.m[k] = m[k]; migrated++; }
          });
        }
        if (l && typeof l.detail === 'boolean') migrated++;
        if (migrated > 0) {
          saveStarfieldState(merged2);
          try { localStorage.removeItem(lk); } catch (e2) { /* legacy key may not exist */ }
        }
        if (migrated > 0) return merged2;
      } catch (e) { /* legacy state unreadable — skip migration */ }
    }
    return Object.assign({}, STARFIELD_DEFAULTS);
  } catch (e) { /* localStorage unavailable or disabled */
    return Object.assign({}, STARFIELD_DEFAULTS);
  }
}
function saveStarfieldState(s) {
  try { localStorage.setItem(STARFIELD_KEY, JSON.stringify(s)); } catch (e) {}
}

// ─── 5 REAL Constellations ───
var CONSTELLATIONS = [
  { id:'opera',       metric:'tasks',    name:'Orion',       latin:'Tasks completed',   cx:62, cy:38, r:90, color:'#f4c98a', accent:'#ffe2a8',
    raCenter:5.55,  decCenter:-1.0,  totalStars:28,
    namedStars: [
      { name:'Rigel',      ra:5.242, dec:-8.202, mag:0.13, hip:24436, spType:'B8 Ia', distLY:860 },
      { name:'Betelgeuse', ra:5.919, dec: 7.407, mag:0.42, hip:27989, spType:'M2 Iab', distLY:548 },
      { name:'Bellatrix',  ra:5.418, dec: 6.350, mag:1.64, hip:25336, spType:'B2 III', distLY:250 },
      { name:'Alnilam',    ra:5.604, dec:-1.202, mag:1.69, hip:26311, spType:'B0 Ia', distLY:2000 },
      { name:'Alnitak',    ra:5.679, dec:-1.943, mag:1.74, hip:26727, spType:'O9.5 Ib', distLY:1260 },
      { name:'Saiph',      ra:5.796, dec:-9.670, mag:2.06, hip:27366, spType:'B0.5 Ia', distLY:650 },
      { name:'Mintaka',    ra:5.533, dec:-0.299, mag:2.23, hip:25930, spType:'O9.5 II', distLY:1200 },
      { name:'Meissa',     ra:5.586, dec: 9.934, mag:3.39, hip:26207, spType:'O8 III', distLY:1100 },
      { name:'Hatysa',     ra:5.602, dec:-0.836, mag:4.40, hip:26199, spType:'B3 V', distLY:490 },
      { name:'ψ Ori',      ra:5.029, dec: 4.083, mag:4.60, hip:23055, spType:'B0 III', distLY:820 }
    ],
    lines: [
      ['Mintaka','Alnilam'], ['Alnilam','Alnitak'],
      ['Betelgeuse','Bellatrix'],
      ['Betelgeuse','Alnitak'], ['Bellatrix','Alnilam'],
      ['Saiph','Rigel'],
      ['Saiph','Alnitak'], ['Rigel','Mintaka'],
      ['Meissa','Betelgeuse']
    ] },
  { id:'examina',     metric:'tests',    name:'Cassiopeia',  latin:'Tests passed',      cx:18, cy:24, r:80, color:'#6ed3d3', accent:'#a3eaea',
    raCenter:1.0,   decCenter:60.0,  totalStars:12,
    namedStars: [
      { name:'Caph',     ra:0.153, dec:59.150, mag:2.27, hip: 746, spType:'F2 III', distLY:55 },
      { name:'Schedar',  ra:0.675, dec:56.537, mag:2.24, hip:3179, spType:'K0 IIIa', distLY:228 },
      { name:'Tsih',     ra:0.945, dec:60.717, mag:2.47, hip:4427, spType:'B0.5 IV', distLY:610 },
      { name:'Ruchbah',  ra:1.430, dec:60.235, mag:2.68, hip:6686, spType:'A5 IIIv', distLY:99 },
      { name:'Segin',    ra:1.907, dec:63.670, mag:3.38, hip:8886, spType:'B3 III', distLY:440 },
      { name:'Achird',   ra:1.895, dec:59.149, mag:3.46, hip:8829, spType:'G3 V', distLY:19 },
      { name:'φ Cas',    ra:1.272, dec:58.297, mag:4.95, hip:6242, spType:'F0 Ia', distLY:4700 }
    ],
    lines: [
      ['Caph','Schedar'], ['Schedar','Tsih'],
      ['Tsih','Ruchbah'], ['Ruchbah','Segin']
    ] },
  { id:'calendarium', metric:'streak',   name:'Ursa Minor',  latin:'Day streak',        cx:80, cy:72, r:80, color:'#d99b5a', accent:'#f3bf85',
    raCenter:15.4,  decCenter:78.0,  totalStars:30,
    namedStars: [
      { name:'Polaris',  ra: 2.530, dec:89.264, mag:1.97, hip:11767, spType:'F7 Ib-IIv', distLY:433 },
      { name:'Kochab',   ra:14.845, dec:74.156, mag:2.08, hip:72607, spType:'K4 III', distLY:131 },
      { name:'Pherkad',  ra:15.346, dec:71.834, mag:3.00, hip:75097, spType:'A3 II-III', distLY:487 },
      { name:'Yildun',   ra:17.537, dec:86.587, mag:4.36, hip:85822, spType:'A1 Vn', distLY:183 },
      { name:'ε UMi',    ra:16.767, dec:82.068, mag:4.23, hip:82080, spType:'G5 III', distLY:347 },
      { name:'ζ UMi',    ra:15.734, dec:77.794, mag:4.32, hip:77055, spType:'A3 V', distLY:376 },
      { name:'η UMi',    ra:16.292, dec:75.755, mag:4.95, hip:79822, spType:'F5 V', distLY:97 },
      { name:'δ UMi',    ra:17.536, dec:86.587, mag:4.36, hip:85822, spType:'A1 Vn', distLY:183 },
      { name:'γ UMi',    ra:15.346, dec:71.834, mag:3.00, hip:75097, spType:'A3 II-III', distLY:487 }
    ],
    lines: [
      ['Yildun','ε UMi'], ['ε UMi','ζ UMi'],
      ['ζ UMi','η UMi'], ['η UMi','Pherkad'],
      ['Pherkad','Kochab'],
      ['ε UMi','Polaris']
    ] },
  { id:'atlas',       metric:'subjects', name:'Cygnus',      latin:'Subjects touched',  cx:30, cy:78, r:78, color:'#b894e0', accent:'#d3bcf0',
    raCenter:20.5,  decCenter:40.0,  totalStars:9,
    namedStars: [
      { name:'Deneb',    ra:20.691, dec:45.280, mag:1.25, hip:102098, spType:'A2 Ia', distLY:2615 },
      { name:'Sadr',     ra:20.371, dec:40.257, mag:2.23, hip:100453, spType:'F8 Ib', distLY:1800 },
      { name:'Gienah',   ra:20.770, dec:33.970, mag:2.48, hip:102488, spType:'K0 III', distLY:72 },
      { name:'δ Cyg',    ra:19.749, dec:45.131, mag:2.87, hip: 97165, spType:'B9.5 III+F', distLY:165 },
      { name:'Albireo',  ra:19.512, dec:27.960, mag:3.08, hip: 95947, spType:'K3 II+B8 V', distLY:430 },
      { name:'ζ Cyg',    ra:21.130, dec:30.227, mag:3.21, hip:104060, spType:'G8 IIIa', distLY:151 },
      { name:'ε Cyg',    ra:20.770, dec:33.970, mag:2.48, hip:102488, spType:'K0 III', distLY:72 }
    ],
    lines: [
      ['Deneb','Sadr'], ['Sadr','Albireo'],
      ['Sadr','Gienah'], ['Sadr','δ Cyg']
    ] },
  { id:'aurora',      metric:'early',    name:'Lyra',        latin:'Finished early',    cx:14, cy:58, r:78, color:'#f0a8b8', accent:'#fbcbd6',
    raCenter:18.75, decCenter:37.0,  totalStars:18,
    namedStars: [
      { name:'Vega',     ra:18.616, dec:38.784, mag:0.03, hip:91262, spType:'A0 Va', distLY:25 },
      { name:'Sulafat',  ra:18.983, dec:32.691, mag:3.24, hip:93194, spType:'B9.5 V', distLY:620 },
      { name:'Sheliak',  ra:18.835, dec:33.363, mag:3.52, hip:92420, spType:'B8.5 Iab', distLY:960 },
      { name:'ζ Lyr',    ra:18.746, dec:37.605, mag:4.36, hip:91971, spType:'F0 V', distLY:152 },
      { name:'ε Lyr',    ra:18.739, dec:39.670, mag:4.59, hip:91926, spType:'A8 Vn+F0 V', distLY:162 },
      { name:'δ Lyr',    ra:18.878, dec:36.898, mag:4.33, hip:92728, spType:'M4 II', distLY:900 },
      { name:'β Lyr',    ra:18.835, dec:33.363, mag:3.52, hip:92420, spType:'B8.5 Iab', distLY:960 }
    ],
    lines: [
      ['Vega','ζ Lyr'], ['Vega','ε Lyr'],
      ['ζ Lyr','Sulafat'], ['ε Lyr','Sheliak'],
      ['Sulafat','Sheliak']
    ] }
];

// ─── THEMED PALETTE (per color preset) ───
var THEME_PALETTES = {
  midnight: {
    opera:       ['#f4c98a', '#ffe2a8'],
    examina:     ['#6ed3d3', '#a3eaea'],
    calendarium: ['#d99b5a', '#f3bf85'],
    atlas:       ['#b894e0', '#d3bcf0'],
    aurora:      ['#f0a8b8', '#fbcbd6'],
    sky: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(40,32,90,0.42) 0%, rgba(20,18,40,0.18) 40%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 70% 50% at 20% 80%, rgba(70,40,80,0.20) 0%, rgba(40,20,50,0.10) 50%, rgba(0,0,0,0) 80%)'
  },
  forest: {
    opera:       ['#6ee89a', '#a3f5c1'],
    examina:     ['#3ecf6c', '#82e3a8'],
    calendarium: ['#b8d97f', '#d4eb9b'],
    atlas:       ['#a8e0bd', '#caecd0'],
    aurora:      ['#d4f0df', '#e8f7ec'],
    sky: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(20,60,40,0.46) 0%, rgba(10,40,30,0.20) 40%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 70% 50% at 80% 20%, rgba(40,90,60,0.18) 0%, rgba(20,50,30,0.10) 50%, rgba(0,0,0,0) 80%)'
  },
  ocean: {
    opera:       ['#5bbaee', '#a3dafa'],
    examina:     ['#cce8ff', '#e0efff'],
    calendarium: ['#6aaddb', '#a3c7e8'],
    atlas:       ['#7dd3fc', '#bae6fd'],
    aurora:      ['#60a5fa', '#93c5fd'],
    sky: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(20,50,90,0.50) 0%, rgba(10,30,60,0.22) 40%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 70% 50% at 30% 80%, rgba(40,80,120,0.18) 0%, rgba(20,40,80,0.10) 50%, rgba(0,0,0,0) 80%)'
  },
  sunset: {
    opera:       ['#fb923c', '#fcd5a3'],
    examina:     ['#f97316', '#fdba74'],
    calendarium: ['#fbbf24', '#fde68a'],
    atlas:       ['#c084fc', '#d8b4fe'],
    aurora:      ['#fed7aa', '#fff1e0'],
    sky: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(140,60,30,0.50) 0%, rgba(70,30,20,0.22) 40%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(180,80,40,0.20) 0%, rgba(100,40,20,0.10) 50%, rgba(0,0,0,0) 80%)'
  },
  rose: {
    opera:       ['#f472b6', '#fbcbd6'],
    examina:     ['#fde4ef', '#fde4ef'],
    calendarium: ['#d47a9e', '#e7a7c0'],
    atlas:       ['#c084fc', '#d8b4fe'],
    aurora:      ['#fb7185', '#fda4af'],
    sky: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(80,30,50,0.46) 0%, rgba(40,15,30,0.20) 40%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 70% 50% at 20% 80%, rgba(100,40,70,0.18) 0%, rgba(60,20,40,0.10) 50%, rgba(0,0,0,0) 80%)'
  },
  coffee: {
    opera:       ['#e8a460', '#f3c489'],
    examina:     ['#f5e6d0', '#f0d9b3'],
    calendarium: ['#c8813f', '#d99a5f'],
    atlas:       ['#b09070', '#c8a988'],
    aurora:      ['#f5e6d0', '#f0d9b3'],
    sky: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(80,55,30,0.46) 0%, rgba(40,25,15,0.20) 40%, rgba(0,0,0,0) 70%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(100,70,40,0.18) 0%, rgba(60,40,20,0.10) 50%, rgba(0,0,0,0) 80%)'
  },
  //  Light theme BRIGHTER MID-TONE JEWEL COLORS — per user request, the previous
  //  dark jewel tones (#1e3a8a / #0e7490 / #92400e / #6b21a8 / #9f1239) were
  //  too dark to see against a warm-white #fafaf7 background. We now use bright
  //  mid-tones that are clearly visible on white while preserving hue identity:
  //    opera (Orion / tasks)       → vivid blue
  //    examina (Cassiopeia / tests) → bright teal
  //    calendarium (Ursa Minor)    → warm amber
  //    atlas (Cygnus)              → bold violet
  //    aurora (Lyra)               → deep rose
  light: {
    opera:       ['#2563eb', '#3b82f6'],
    examina:     ['#0891b2', '#06b6d4'],
    calendarium: ['#d97706', '#f59e0b'],
    atlas:       ['#7c3aed', '#8b5cf6'],
    aurora:      ['#e11d48', '#f43f5e'],
    sky: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,255,255,0.65) 0%, rgba(248,250,254,0.35) 40%, rgba(246,249,252,0.08) 70%), radial-gradient(ellipse 70% 40% at 40% 85%, rgba(230,235,242,0.45) 0%, rgba(240,243,248,0.12) 55%, rgba(246,249,252,0) 80%)'
  },
  //  Dawn theme — warm sunrise gradient (5am–7am EST). Golden-orange
  //  glow near the horizon fades upward into a soft pink-purple.
  //  Constellation colours are warm amber/gold to complement the sky.
  dawn: {
    opera:       ['#f59e0b', '#fbbf24'],    // warm gold
    examina:     ['#f97316', '#fb923c'],    // sunrise orange
    calendarium: ['#eab308', '#fde047'],    // bright yellow
    atlas:       ['#d97706', '#f59e0b'],    // amber
    aurora:      ['#ef4444', '#f87171'],    // warm red
    sky: 'radial-gradient(ellipse 90% 70% at 50% 80%, rgba(251,146,60,0.55) 0%, rgba(251,191,36,0.35) 30%, rgba(236,72,153,0.18) 55%, rgba(139,92,246,0.08) 75%, rgba(0,0,0,0) 100%), radial-gradient(ellipse 80% 60% at 50% 20%, rgba(30,20,50,0.35) 0%, rgba(20,15,40,0.20) 50%, rgba(0,0,0,0) 85%)'
  },
  //  Dusk theme — warm sunset gradient (5pm–7pm EST). Deep orange/red
  //  near the horizon fades upward into a rich purple-night transition.
  dusk: {
    opera:       ['#f97316', '#fb923c'],    // orange
    examina:     ['#ef4444', '#f87171'],    // red
    calendarium: ['#eab308', '#fde047'],    // yellow
    atlas:       ['#c084fc', '#d8b4fe'],    // violet
    aurora:      ['#f472b6', '#fbcfe8'],    // pink
    sky: 'radial-gradient(ellipse 90% 70% at 50% 80%, rgba(234,88,12,0.50) 0%, rgba(239,68,68,0.32) 28%, rgba(168,85,247,0.18) 55%, rgba(30,15,50,0.30) 80%, rgba(0,0,0,0) 100%), radial-gradient(ellipse 80% 60% at 50% 25%, rgba(15,10,40,0.45) 0%, rgba(8,5,25,0.35) 55%, rgba(0,0,0,0) 90%)'
  },
  //  Daytime theme — natural blue-sky palette with dark visible stars.
  //  Constellation colours are bold mid-tones that pop against the sky.
  //  The sky gradient simulates a clear afternoon: deep blue at zenith
  //  fading to a paler horizon glow, then a subtle haze layer near the
  //  bottom. Stars use darker fills (see .theme-daytime CSS).
  daytime: {
    opera:       ['#2563eb', '#3b82f6'],    // vivid blue
    examina:     ['#0d9488', '#14b8a6'],    // bright teal
    calendarium: ['#d97706', '#f59e0b'],    // warm amber
    atlas:       ['#7c3aed', '#8b5cf6'],    // bold violet
    aurora:      ['#e11d48', '#f43f5e'],    // deep rose
    sky: 'radial-gradient(ellipse 90% 70% at 50% 20%, rgba(100,170,230,0.55) 0%, rgba(160,200,240,0.38) 35%, rgba(210,225,245,0.18) 65%, rgba(240,245,250,0.05) 100%), radial-gradient(ellipse 80% 50% at 40% 90%, rgba(200,220,240,0.25) 0%, rgba(220,235,248,0.10) 50%, rgba(255,255,255,0) 80%)'
  },
  //  Night-sky palette — used when the user toggles "Night Sky" mode. Re-uses
  //  midnight's deep saturated hues but with a SHARPER contrast lift on accent
  //  so the stars pop against the very dark background. Captures the immersive
  //  "real night sky" feel that the user can toggle into.
  'night-sky': {
    opera:       ['#ffd896', '#ffe9bc'],
    examina:     ['#9be7e7', '#c3f3f3'],
    calendarium: ['#e8b57a', '#f3caa0'],
    atlas:       ['#d3a7f0', '#e6cbf5'],
    aurora:      ['#ffb0c5', '#ffcfd9'],
    sky: 'radial-gradient(ellipse 90% 70% at 50% 25%, rgba(8,6,20,0.95) 0%, rgba(4,3,12,0.85) 50%, rgba(0,0,4,1.0) 100%), radial-gradient(ellipse 70% 50% at 20% 80%, rgba(14,8,30,0.65) 0%, rgba(0,0,0,0) 80%)'
  }
};
function getActiveTheme() {
  var html = document.documentElement;
  var cn = html && html.className;
  var m = cn && cn.match && cn.match(/theme-(\\w+)/);
  // Night-sky mode forces the active theme to read as night-sky regardless of
  // the user's stored preset — the click in app.js toggleNightSky()
  // swaps the theme-* class to 'night-sky' while keeping the user's stored
  // preset intact, so toggling off restores.
  return m ? m[1] : 'midnight';
}
function themedConstellation(c) {
  var palette = (THEME_PALETTES[getActiveTheme()] || {})[c.id];
  if (!palette) return c;
  var out = {};
  for (var k in c) out[k] = c[k];
  out.color = palette[0];
  out.accent = palette[1];
  return out;
}
function applyStarfieldTheme(name) {
  if (!THEME_PALETTES[name]) name = 'midnight';
  var html = document.documentElement;
  ['midnight','forest','ocean','sunset','rose','coffee','light','dawn','dusk','daytime','night-sky'].forEach(function(t) {
    if (t !== name) html.classList.remove('theme-' + t);
  });
  html.classList.add('theme-' + name);

  Object.keys(_slotCache).forEach(function(id) {
    var entry = _slotCache[id];
    if (!entry || !entry.slot) return;
    var base = null;
    for (var i = 0; i < CONSTELLATIONS.length; i++) {
      if (CONSTELLATIONS[i].id === id) { base = CONSTELLATIONS[i]; break; }
    }
    if (!base) return;
    var themed = themedConstellation(base);
    entry.slot.style.setProperty('--cn-color',  themed.color);
    entry.slot.style.setProperty('--cn-accent', themed.accent);
    entry.slot.style.color = themed.color;
    var count = (getStarfieldState().m[base.metric] || 0) | 0;
    var lit = Math.min(count, base.totalStars);
    updateConstellationLuminescence(themed, lit);
  });

  var wrap = document.getElementById('starfield');
  if (wrap) {
    var skyPalette = (THEME_PALETTES[name] || {}).sky;
    if (skyPalette) wrap.style.background = skyPalette;
  }
}

// ─── Per-constellation scale ───
function constellationScale(c) {
  var maxExt = 1;
  (c.namedStars || []).forEach(function (n) {
    var dRa = n.ra - c.raCenter;
    while (dRa > 12) dRa -= 24;
    while (dRa < -12) dRa += 24;
    var dRaDegLocal = Math.abs(dRa * 15 * Math.cos(n.dec * Math.PI / 180));
    var dDecLocal = Math.abs(n.dec - c.decCenter);
    var ext = Math.sqrt(dRaDegLocal * dRaDegLocal + dDecLocal * dDecLocal);
    if (ext > maxExt) maxExt = ext;
  });
  return Math.min(7.5, 85 / maxExt);
}

// ─── Astronomical star placement ───
function placeAstronomicalStars(c) {
  var scale = constellationScale(c);
  var positions = [];
  var namedIdx = {};
  var namedCount = (c.namedStars || []).length;

  var namedSorted = (c.namedStars || []).slice().sort(function (a, b) {
    return a.mag - b.mag;
  });

  namedSorted.forEach(function (n, i) {
    var dRa = n.ra - c.raCenter;
    while (dRa > 12) dRa -= 24;
    while (dRa < -12) dRa += 24;
    var avgDec = (c.decCenter + n.dec) / 2;
    var cosDec = Math.cos(avgDec * Math.PI / 180);
    var dRaDeg = dRa * 15 * cosDec;
    var dDec   = n.dec - c.decCenter;
    var r = Math.max(1.2, (5.5 - n.mag) * 0.55);
    positions.push({
      dx: -dRaDeg * scale,
      dy: -dDec   * scale,
      size: r,
      twPhase: -((n.ra * 7 + n.dec) % 9),
      twSpeed: 5.0 + (n.mag / 7.0) * 4.0,  // brighter = slower cycle
      hueShift: 0,
      isNamed: true,
      name: n.name,
      mag: n.mag,
      hip: n.hip
    });
    namedIdx[n.name] = i;
  });

  var ambientCount = Math.max(0, c.totalStars - namedCount);
  if (ambientCount > 0) {
    var daySeed = Math.floor(Date.now() / 86400000);
    var rng = mulberry32(
      c.id.charCodeAt(0) * 131 +
      c.cx * 89 +
      c.cy * 73 +
      (namedCount * 31) +
      daySeed * 17
    );
    var maxExt = 1;
    namedSorted.forEach(function (n) {
      var dRa = n.ra - c.raCenter;
      while (dRa > 12) dRa -= 24; while (dRa < -12) dRa += 24;
      var dRaDegLocal = Math.abs(dRa * 15 * Math.cos(n.dec * Math.PI / 180));
      var dDecLocal = Math.abs(n.dec - c.decCenter);
      var ext = Math.sqrt(dRaDegLocal * dRaDegLocal + dDecLocal * dDecLocal);
      if (ext > maxExt) maxExt = ext;
    });
    for (var i = 0; i < ambientCount; i++) {
      var ang = rng() * Math.PI * 2;
      var rad = Math.sqrt(rng()) * maxExt * scale * 0.92;
      var spType = generateSpectralType(rng);
      var mag = 3.0 + rng() * 4.0;
      var distLY = Math.round(15 + rng() * rng() * 5000);
      positions.push({
        dx: Math.cos(ang) * rad,
        dy: Math.sin(ang) * rad * 0.82,
        size: Math.max(1.8, (6.0 - mag) * 0.55),  // bigger = brighter (min 1.8px for hoverability)
        twPhase: -rng() * 9,
        twSpeed: 3.5 + rng() * 4.5,
        hueShift: (rng() - 0.5) * 0.10,
        isNamed: false,
        spType: spType,
        mag: mag,
        distLY: distLY
      });
    }
  }

  return { positions: positions, namedIndexByName: namedIdx };
}

// ─── Pull derived metrics from app state ───
function refreshStarfieldMetrics(_forceAll) {
  if (typeof tasks === 'undefined' || !Array.isArray(tasks)) return;
  var state = getStarfieldState();

  var dates = {};
  tasks.forEach(function (t) {
    if (t.status === 'done' && t.lastCheckedDate) dates[t.lastCheckedDate] = 1;
  });
  var streak = 0;
  var cur = new Date();
  for (var i = 0; i < 60; i++) {
    var dStr = cur.toISOString().split('T')[0];
    if (dates[dStr]) { streak++; cur.setDate(cur.getDate() - 1); }
    else if (i === 0) { cur.setDate(cur.getDate() - 1); }
    else break;
  }

  var subjSet = {};
  tasks.forEach(function (t) { if (t.subject) subjSet[t.subject] = 1; });

  var early = tasks.filter(function (t) {
    return t.status === 'done' && t.lastCheckedDate && t.due &&
           t.lastCheckedDate <= t.due;
  }).length;

  var testsPassed = 0;
  if (typeof tests !== 'undefined' && Array.isArray(tests)) {
    testsPassed = tests.filter(function (t) {
      if (t.score == null || t.score === '' || t.score === undefined) return false;
      var max = t.maxScore || 100;
      return ((+t.score) / max) * 100 >= 60;
    }).length;
  }

  var doneCount = tasks.filter(function (t) { return t.status === 'done'; }).length;

  state.m.tasks = doneCount;
  state.m.tests = testsPassed;
  state.m.streak = streak;
  state.m.subjects = Object.keys(subjSet).length;
  state.m.early = early;
  saveStarfieldState(state);
}

// ─── Build star-field DOM on first render ───
var _slotCache = {};
var _starInfoHover = null;

function buildStarfieldOnce(wrap) {
  if (wrap.dataset.built === '1') return;
  _slotCache = {};

  var rotLayer = document.createElement('div');
  rotLayer.className = 'sky-rotation';
  wrap.appendChild(rotLayer);

  // 1. Ambient background stars.
  //    Every ambient dot now carries synthetic stellar data (spectral type,
  //    magnitude, distance) so ALL stars — not just the catalogue-named ones —
  //    surface realistic info on hover. Spectral-type tinting varies the dot
  //    colour across the HR diagram (blue → orange-red) instead of uniform white.
  //
  //    In night-sky mode we boost the count (110 → 200) so the sky feels
  //    denser / more like a real clear night. Other modes keep the calm field.
  var ambient = document.createElement('div');
  ambient.className = 'starfield-ambient';
  var daySeed = Math.floor(Date.now() / 86400000);
  var aRng = mulberry32(7777 + daySeed * 13);
  var isNightSky = !!getStarfieldState().nightSkyMode;
  var ambientTarget = isNightSky ? 200 : 110;
  for (var i = 0; i < ambientTarget; i++) {
    var dot = document.createElement('div');
    var spType = generateSpectralType(aRng);
    var mag = 2.5 + aRng() * 5.0;  // apparent mag 2.5–7.5
    var distLY = Math.round(12 + aRng() * aRng() * 4800);
    var x = aRng() * 100, y = aRng() * 100;
    var sz = Math.max(1.8, (6.5 - mag) * 0.52);  // min 1.8px for hoverability
    var op = 0.25 + aRng() * 0.35;
    var spColor = getSpectralColor(spType);
    // Class: 'star-ambient' + 'star-ambient-interactive' if large enough.
    dot.className = 'star-ambient' + (sz >= 2.0 ? ' star-ambient-interactive' : '');
    // Store synthetic data so the hover tooltip works on every star.
    dot.dataset.spType = spType;
    dot.dataset.mag    = mag.toFixed(2);
    dot.dataset.distLY = String(distLY);
    dot.dataset.starName = '✦';  // trigger tooltip display; no proper name
    dot.dataset.starType = 'ambient';
    dot.setAttribute('title', spType + ' · mag ' + mag.toFixed(1) + ' · ' + distLY + ' ly');
    dot.style.left = x + '%';
    dot.style.top = y + '%';
    // In night-sky mode, drop wait time a touch so the field stays lively but
    // doesn't strobe.
    var twSpeed = isNightSky ? (2.0 + aRng() * 3.0) : (3 + aRng() * 4.5);
    var bgColor = spColor || '#fff';
    dot.style.cssText =
      'left:' + x + '%;top:' + y + '%;width:' + sz.toFixed(2) + 'px;height:' + sz.toFixed(2) +
      'px;opacity:' + op + ';' +
      'background:' + bgColor + ';' +
      '--sp-tint:' + bgColor + ';' +
      '--base-op:' + op.toFixed(2) + ';' +
      '--twinkle-amp:' + getTwinkleAmp(mag).toFixed(3) + ';' +
      '--parallax-depth:' + getParallaxDepth(distLY).toFixed(3) + ';' +
      'animation:sf-twinkle ' + twSpeed.toFixed(2) +
      's ease-in-out infinite;' +
      'animation-delay:' + (-aRng() * 9).toFixed(2) + 's;';
    ambient.appendChild(dot);
  }
  rotLayer.appendChild(ambient);

  CONSTELLATIONS.forEach(function (c) {
    var slot = document.createElement('div');
    slot.className = 'constellation';
    slot.dataset.id = c.id;
    slot.dataset.constellation = c.name;
    slot.style.left = c.cx + '%';
    slot.style.top = c.cy + '%';

    _slotCache[c.id] = {
      slot: slot,
      starsG: null,
      linesG: null,
      stars: [],
      namedByName: {}
    };

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('constellation-svg');
    svg.setAttribute('viewBox', '-120 -100 240 200');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    slot.appendChild(svg);

    var placeResult = placeAstronomicalStars(c);
    var stars = placeResult.positions;
    var linesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linesG.setAttribute('class', 'constellation-lines');
    svg.appendChild(linesG);

    var starsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    starsG.setAttribute('class', 'constellation-stars');
    svg.appendChild(starsG);

    stars.forEach(function (p, i) {
      var c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c1.setAttribute('cx', p.dx.toFixed(1));
      c1.setAttribute('cy', p.dy.toFixed(1));
      c1.setAttribute('r', p.size.toFixed(2));
      var className = p.isNamed ? 'star named' : 'star named';
      c1.setAttribute('class', className);
      c1.style.animation = 'sf-twinkle ' + p.twSpeed.toFixed(2) +
                            's ease-in-out infinite';
      c1.style.animationDelay = p.twPhase.toFixed(2) + 's';
      c1.style.setProperty('--hue-shift', (p.hueShift || 0).toFixed(2));
      // Realistic twinkle: brighter stars flicker less.
      var twAmp = getTwinkleAmp(p.mag || 3.5);
      c1.style.setProperty('--twinkle-amp', twAmp.toFixed(3));
      c1.style.setProperty('--base-op', '0.55');
      c1.dataset.idx = i;
      if (p.isNamed) {
        c1.dataset.starName = p.name;
        c1.dataset.starMag  = p.mag.toFixed(2);
        c1.dataset.starHip  = p.hip;
        // Match the named star back to its catalogue entry so we can
        // surface spectral type + distance on hover.
        var spT = '', dLY = '';
        for (var ni = 0; ni < (c.namedStars || []).length; ni++) {
          if (c.namedStars[ni].name === p.name) {
            if (c.namedStars[ni].spType) { spT = c.namedStars[ni].spType; c1.dataset.spType = spT; }
            if (c.namedStars[ni].distLY) { dLY = c.namedStars[ni].distLY; c1.dataset.distLY = dLY; }
            break;
          }
        }
        // Parallax depth from catalogue distance — Vega (25 ly) shifts a lot,
        // Deneb (2615 ly) barely moves. Real 3D depth feel.
        c1.style.setProperty('--parallax-depth', getParallaxDepth(dLY || 3000).toFixed(3));
        // Spectral-type tinting for named stars — each star gets a subtle
        // hue from its Harvard spectral class. Lit stars still use the
        // constellation colour, but the base fill reflects real physics.
        var spColor = getSpectralColor(spT);
        if (spColor) c1.style.setProperty('--sp-tint', spColor);
        c1.dataset.constellation = c.name;
        // Keyboard accessibility — every named star is tabbable so the
        // hover-info tooltip is reachable without a mouse.
        c1.setAttribute('tabindex', '0');
        c1.setAttribute('role', 'button');
        c1.setAttribute('aria-label', c.name + ' — ' + p.name + ' (mag ' + p.mag.toFixed(2) + ')');
      } else {
        // Constellation ambient (field) stars — carry synthetic stellar
        // data from placeAstronomicalStars. Hoverable like named stars.
        // Parallax depth: field stars have synthetic distLY from placement.
        c1.style.setProperty('--parallax-depth', getParallaxDepth(p.distLY || 3000).toFixed(3));
        c1.dataset.starName = '✦';
        c1.dataset.starType = 'field';
        if (p.spType) { c1.dataset.spType = p.spType; c1.style.setProperty('--sp-tint', getSpectralColor(p.spType) || ''); }
        if (p.mag)    c1.dataset.starMag = p.mag.toFixed(2);
        if (p.distLY) c1.dataset.distLY = String(p.distLY);
        c1.setAttribute('tabindex', '0');
        c1.setAttribute('role', 'button');
        c1.setAttribute('aria-label', 'Field star · ' + (p.spType || '') + ' · mag ' + (p.mag || '?').toString().substring(0,4));
      }
      starsG.appendChild(c1);
    });

    var label = document.createElement('div');
    label.className = 'constellation-label';
    label.innerHTML = '<span class="cn-name">' + escHtml(c.name) + '</span>' +
                      '<span class="cn-metric">' + escHtml(c.latin) + '</span>';
    slot.appendChild(label);

    slot.style.setProperty('--cn-color', c.color);
    slot.style.setProperty('--cn-accent', c.accent);
    slot.style.color = c.color;
    var _themedForBuild = (THEME_PALETTES[getActiveTheme()] || {})[c.id];
    if (_themedForBuild) {
      slot.style.setProperty('--cn-color', _themedForBuild[0]);
      slot.style.setProperty('--cn-accent', _themedForBuild[1]);
      slot.style.color = _themedForBuild[0];
    }

    rotLayer.appendChild(slot);

    var starElems = starsG.querySelectorAll('.star');
    var namedByName = {};
    for (var j = 0; j < starElems.length; j++) {
      // Only catalogue-named stars (not field stars with data-star-name='✦')
      // go into namedByName — field stars would collide on the same key,
      // breaking the all-lit check and line-drawing name lookups.
      if (starElems[j].dataset.starType === 'field') continue;
      var n = starElems[j].getAttribute('data-star-name');
      if (n) namedByName[n] = starElems[j];
    }
    _slotCache[c.id].starsG = starsG;
    _slotCache[c.id].linesG = linesG;
    _slotCache[c.id].stars  = starElems;
    _slotCache[c.id].namedByName = namedByName;
  });

  var shotSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  shotSvg.classList.add('starfield-shootings');
  shotSvg.setAttribute('preserveAspectRatio', 'none');
  shotSvg.dataset.role = 'shooting-layer';
  wrap.appendChild(shotSvg);

  if (!wrap.querySelector('.starfield-toggle')) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'starfield-toggle-btn';
    btn.className = 'starfield-toggle';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('aria-label', 'Show constellation details');
    btn.title = '✦ Constellation details';
    btn.textContent = '✦ Stars';
    btn.addEventListener('click', toggleStarfieldDetail);
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      toggleStarfieldShooting();
    });
    btn.addEventListener('dblclick', function () {
      toggleStarfieldInfo();
    });
    wrap.appendChild(btn);
  }

  // SINGLE GLOBAL .star-info-hover overlay. ALWAYS available (no
  // detail-mode gate) — per user request, every named star should surface
  // its info on hover. Built once on first layout; appended if missing.
  if (!wrap.querySelector('.star-info-hover')) {
    var info = document.createElement('div');
    info.className = 'star-info-hover';
    info.setAttribute('role', 'tooltip');
    info.setAttribute('aria-hidden', 'true');
    info.innerHTML = '<div class="star-info-name"></div>' +
                     '<div class="star-info-meta"></div>' +
                     '<div class="star-info-meta2"></div>';
    wrap.appendChild(info);
    _starInfoHover = info;

    // Hover handler — fires on every named star AND every ambient interactive
    // star, regardless of detail-mode. All stars surface their astrophysical
    // data (spectral type, magnitude, distance) on hover.
    // Also adds a gravitational-lensing glow pulse (.lensing class).
    wrap.addEventListener('pointerover', function (ev) {
      var star = ev.target && ev.target.closest && ev.target.closest('.constellation-stars .star.named');
      if (!star) {
        // Try ambient interactive dots — they are HTML divs, not SVG circles.
        var amb = ev.target && ev.target.closest && ev.target.closest('.star-ambient-interactive');
        if (amb) { amb.style.animation += ', sf-lensing-ambient 0.8s ease-in-out infinite'; showStarInfo(amb, ev); return; }
        return;
      }
      star.style.animation += ', sf-lensing 0.8s ease-in-out infinite';
      showStarInfo(star, ev);
    });
    wrap.addEventListener('pointermove', function (ev) {
      if (!_starInfoHover || !_starInfoHover.classList.contains('visible')) return;
      positionStarInfo(ev);
    });
    wrap.addEventListener('pointerout', function (ev) {
      var star = ev.target && ev.target.closest && ev.target.closest('.constellation-stars .star.named');
      var amb  = ev.target && ev.target.closest && ev.target.closest('.star-ambient-interactive');
      if (!star && !amb) return;
      // Always strip lensing from the leaving element — even when
      // moving between stars (the new star gets its own lensing in
      // pointerover). Only skip hiding the tooltip.
      if (star) star.style.animation = star.style.animation.replace(', sf-lensing 0.8s ease-in-out infinite', '');
      if (amb)  amb.style.animation = amb.style.animation.replace(', sf-lensing-ambient 0.8s ease-in-out infinite', '');
      // Don't hide tooltip if moving to another interactive star or ambient dot.
      if (ev.relatedTarget && ev.relatedTarget.closest) {
        if (ev.relatedTarget.closest('.constellation-stars .star.named') ||
            ev.relatedTarget.closest('.star-ambient-interactive')) {
          return;
        }
      }
      hideStarInfo();
    });
    // Keyboard: Tab to a named star surfaces the tooltip without needing
    // detail-mode on. Always-on by design (per user request).
    // Also applies the gravitational-lensing glow pulse.
    wrap.addEventListener('focusin', function (ev) {
      var star = ev.target && ev.target.closest &&
                 ev.target.closest('.constellation-stars .star.named');
      if (!star) {
        var amb = ev.target && ev.target.closest &&
                  ev.target.closest('.star-ambient-interactive');
        if (amb) {
          amb.style.animation += ', sf-lensing-ambient 0.8s ease-in-out infinite';
          var rect = amb.getBoundingClientRect();
          var fakeEv = { clientX: rect.left, clientY: rect.top };
          showStarInfo(amb, fakeEv, true);
        }
        return;
      }
      star.style.animation += ', sf-lensing 0.8s ease-in-out infinite';
      var fakeEv = { clientX: star.getBoundingClientRect().left,
                     clientY: star.getBoundingClientRect().top };
      showStarInfo(star, fakeEv, /*pinned*/ true);
    });
    wrap.addEventListener('focusout', function (ev) {
      var star = ev.target && ev.target.closest &&
                 ev.target.closest('.constellation-stars .star.named');
      if (!star) {
        var amb = ev.target && ev.target.closest &&
                  ev.target.closest('.star-ambient-interactive');
        if (amb) amb.style.animation = amb.style.animation.replace(', sf-lensing-ambient 0.8s ease-in-out infinite', '');
      } else {
        star.style.animation = star.style.animation.replace(', sf-lensing 0.8s ease-in-out infinite', '');
      }
      hideStarInfo();
    });
  }

  // Start mouse-parallax engine so stars shift with cursor movement.
  startParallax(wrap);

  wrap.dataset.built = '1';
}

function updateConstellationLuminescence(c, litCount) {
  var cacheEntry = _slotCache[c.id];
  if (!cacheEntry) return;
  var slot = cacheEntry.slot;
  var stars = cacheEntry.stars;
  var linesG = cacheEntry.linesG;
  var namedByName = cacheEntry.namedByName;

  for (var i = 0; i < stars.length; i++) {
    var node = stars[i];
    if (i < litCount) node.classList.add('lit');
    else node.classList.remove('lit');
  }

  if (litCount >= 2 && c.lines && c.lines.length) {
    var html = '';
    for (var li = 0; li < c.lines.length; li++) {
      var pair = c.lines[li];
      var a = namedByName[pair[0]];
      var b = namedByName[pair[1]];
      if (!a || !b) continue;
      if (!a.classList.contains('lit') || !b.classList.contains('lit')) continue;
      var ax = +a.getAttribute('cx'), ay = +a.getAttribute('cy');
      var bx = +b.getAttribute('cx'), by = +b.getAttribute('cy');
      html += '<line x1="' + ax.toFixed(1) +
              '" y1="' + ay.toFixed(1) +
              '" x2="' + bx.toFixed(1) +
              '" y2="' + by.toFixed(1) +
              '" stroke="' + c.color + '" stroke-width="0.7" ' +
              'stroke-linecap="round" opacity="0.55"/>';
    }
    var namedCount = Object.keys(namedByName).length;
    var litNamed = 0;
    for (var nm in namedByName) {
      if (namedByName[nm].classList.contains('lit')) litNamed++;
    }
    if (litNamed === namedCount && namedCount >= 3 && c.lines.length) {
      var first = c.lines[0];
      var last  = c.lines[c.lines.length - 1];
      var h = namedByName[first[0]], tl = namedByName[last[1]];
      if (h && tl && h !== tl) {
        html += '<line x1="' + (+h.getAttribute('cx')).toFixed(1) +
                '" y1="' + (+h.getAttribute('cy')).toFixed(1) +
                '" x2="' + (+tl.getAttribute('cx')).toFixed(1) +
                '" y2="' + (+tl.getAttribute('cy')).toFixed(1) +
                '" stroke="' + c.color + '" stroke-width="0.4" ' +
                'stroke-linecap="round" opacity="0.22" stroke-dasharray="2 3"/>';
      }
    }
    if (linesG.innerHTML !== html) linesG.innerHTML = html;
  } else if (linesG.innerHTML !== '') {
    linesG.innerHTML = '';
  }

  slot.classList.toggle('forming', litCount >= 2);
  slot.classList.toggle('budding', litCount === 1);
  slot.classList.toggle('full',    litCount >= c.totalStars);

  var labelEl = slot.querySelector('.cn-metric');
  if (labelEl) {
    labelEl.textContent = c.latin + ' · ' + Math.min(litCount, c.totalStars) +
                          ' / ' + c.totalStars;
  }
}

function skyRotationDeg() {
  var ms = Date.now();
  var days = ms / 86400000;
  var frac = days - Math.floor(days);
  return (frac * 360) % 360;
}
function applySkyRotation() {
  var rot = document.querySelector('.starfield .sky-rotation');
  if (!rot) return;
  rot.style.willChange = 'transform';
  rot.style.transform = 'rotate(' + skyRotationDeg().toFixed(2) + 'deg)';
  requestAnimationFrame(function() { rot.style.willChange = 'auto'; });
}

function showStarInfo(star, ev, pinned) {
  if (!_starInfoHover) return;
  // Use dataset (camelCase) for consistent access regardless of whether
  // attributes were set via setAttribute('data-*') or dataset.*.
  // Named stars use starMag/starHip, ambient stars use mag (no star- prefix).
  var ds = star.dataset;
  var name = ds.starName || '';
  var mag  = ds.starMag || ds.mag || '';
  var hip  = ds.starHip || '';
  var cn   = ds.constellation || '';
  var spType = ds.spType || '';
  var distLY = ds.distLY || '';
  var isFieldOrAmbient = ds.starType === 'field' || ds.starType === 'ambient';
  if (!name) return;
  // Proper named stars show their catalogue name (Rigel, Vega, etc.).
  // Field/ambient stars show 'Field star' — spType lives in meta2 already.
  _starInfoHover.querySelector('.star-info-name').textContent =
    isFieldOrAmbient ? 'Field star' : name;
  var meta = [];
  if (cn)                meta.push(cn);
  if (mag)               meta.push('mag ' + mag);
  if (!isFieldOrAmbient && hip) meta.push('HIP ' + hip);
  var meta2 = [];
  if (spType) meta2.push(spType);
  if (distLY) meta2.push(distLY + ' ly');
  _starInfoHover.querySelector('.star-info-meta').textContent =
    meta.length ? meta.join(' · ') : (isFieldOrAmbient ? 'Deep-sky object' : '');
  var meta2El = _starInfoHover.querySelector('.star-info-meta2');
  if (meta2El) meta2El.textContent = meta2.join(' · ');
  _starInfoHover.classList.add('visible');
  _starInfoHover.setAttribute('aria-hidden', pinned ? 'false' : 'true');
  // Set the spectral tint colour on the tooltip name so it matches the star.
  var spColor = getSpectralColor(spType);
  var nameEl = _starInfoHover.querySelector('.star-info-name');
  if (nameEl) nameEl.style.color = spColor || '';
  if (ev) positionStarInfo(ev);
}
function hideStarInfo() {
  if (!_starInfoHover) return;
  _starInfoHover.classList.remove('visible');
  _starInfoHover.setAttribute('aria-hidden', 'true');
}
function positionStarInfo(ev) {
  if (!_starInfoHover) return;
  var pad = 14;
  var x = Math.min(window.innerWidth  - _starInfoHover.offsetWidth  - pad,
                    Math.max(pad, ev.clientX + pad));
  var y = Math.min(window.innerHeight - _starInfoHover.offsetHeight - pad,
                    Math.max(pad, ev.clientY + pad));
  _starInfoHover.style.left = x + 'px';
  _starInfoHover.style.top  = y + 'px';
}

function toggleStarfieldInfo() {
  var state = getStarfieldState();
  state.info = !state.info;
  saveStarfieldState(state);
  renderStarfield();
}

// ─── Shooting stars ───
var _shootingTimer = null;
// One-shot shooting star launcher — public so task completion can trigger
// a streak across the sky. Finds the .starfield-shootings layer on its own
// so callers don't need to track a DOM reference.
function fireShootingStar(layer) {
  if (!layer) layer = document.querySelector('.starfield-shootings');
  if (!layer) return;
  // Don't spam if there are already 2+ shooting stars in flight.
  if (layer.childElementCount > 2) return;
  var s = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  var w = layer.clientWidth || window.innerWidth;
  var h = layer.clientHeight || window.innerHeight;
  var startX = (0.55 + Math.random() * 0.40) * w;
  var startY = (Math.random() * 0.45) * h;
  var len = 90 + Math.random() * 140;
  var dx = -(len * Math.cos(Math.PI / 7));
  var dy =  (len * Math.sin(Math.PI / 7));
  var dur = 1.1 + Math.random() * 0.8;
  s.setAttribute('transform',
    'translate(' + startX.toFixed(1) + ',' + startY.toFixed(1) + ')');
  s.innerHTML =
    '<line x1="0" y1="0" x2="' + dx.toFixed(1) + '" y2="' + dy.toFixed(1) +
    '" stroke="white" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/>' +
    '<circle cx="0" cy="0" r="2" fill="white" opacity="1"/>' +
    '<circle cx="' + (dx * 0.7).toFixed(1) + '" cy="' + (dy * 0.7).toFixed(1) +
    '" r="1.2" fill="white" opacity="0.6"/>';
  var anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
  anim.setAttribute('attributeName', 'transform');
  anim.setAttribute('type', 'translate');
  anim.setAttribute('from', startX.toFixed(1) + ' ' + startY.toFixed(1));
  anim.setAttribute('to', (startX + dx).toFixed(1) + ' ' + (startY + dy).toFixed(1));
  anim.setAttribute('dur', dur.toFixed(2) + 's');
  anim.setAttribute('fill', 'freeze');
  var opa = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  opa.setAttribute('attributeName', 'opacity');
  opa.setAttribute('from', '1');
  opa.setAttribute('to', '0');
  opa.setAttribute('dur', dur.toFixed(2) + 's');
  opa.setAttribute('fill', 'freeze');
  s.appendChild(anim);
  s.appendChild(opa);
  layer.appendChild(s);
  setTimeout(function () {
    if (s.parentNode) s.parentNode.removeChild(s);
  }, dur * 1000 + 50);
}
function startShootingStars(layer) {
  if (_shootingTimer) return;
  fireShootingStar(layer);
  _shootingTimer = setInterval(function() { fireShootingStar(layer); }, 60000);
}
function stopShootingStars() {
  if (_shootingTimer) { clearInterval(_shootingTimer); _shootingTimer = null; }
}
function applyShootingState(layer, on) {
  if (on) startShootingStars(layer);
  else stopShootingStars();
}

// ─── Public Composer ───
function renderStarfield() {
  // Skip the entire starfield for light/daytime themes — stars aren't
  // visible on bright backgrounds, and the canvas eats performance.
  // Visibility is handled purely via CSS (html.theme-light #starfield etc.)
  // to avoid inline-style persistence across auto-theme transitions.
  var activeTheme = getActiveTheme();
  if (activeTheme === 'light' || activeTheme === 'daytime') return;
  var wrap = document.getElementById('starfield');
  if (!wrap) return;
  refreshStarfieldMetrics();
  var state = getStarfieldState();
  // Skip the heavy DOM rebuild when nothing user-visible changed since the
  // last paint. Themes only need a class-toggled re-render — no node churn.
  // (applyStarfieldTheme already handles the per-slot palette update.)
  buildStarfieldOnce(wrap);

  // Night-sky mode composes with focus mode. nightSkyMode forces midnight
  // theme + boosts ambient, but it does NOT hide UI chrome by itself —
  // focusMode is what fades the UI.
  //
  // SAFETY GUARD: Never let a stale localStorage flag (from legacy toggle
  // code) auto-engage focus/night-sky mode. The hold-key system (setFocus/
  // setNightSky) is the ONLY path that adds these classes. Without this
  // guard, checking off a task — which calls renderStarfield via
  // notifyTreeGrowth — would surprise the user with focus-mode.
  var html = document.documentElement;
  // Defensive: _heldViewKeys is defined in app.js (loaded after gamification.js).
  // Use typeof to avoid ReferenceError during early script evaluation.
  var hvk = (typeof _heldViewKeys === 'object' && _heldViewKeys) || { focus: false, nightSky: false };
  if (!hvk.focus    && html.classList.contains('focus-mode'))     html.classList.remove('focus-mode');
  if (!hvk.nightSky && html.classList.contains('night-sky-mode')) html.classList.remove('night-sky-mode');

  var anyGrowth = false;
  CONSTELLATIONS.forEach(function (baseC) {
    var c = themedConstellation(baseC);
    var count = (state.m[c.metric] || 0) | 0;
    var lit = Math.min(count, c.totalStars);
    if (lit > 0) anyGrowth = true;
    updateConstellationLuminescence(c, lit);
  });

  wrap.classList.toggle('has-growth', anyGrowth);
  wrap.classList.toggle('detail-mode', !!state.detail);

  // Populate the constellation info panel (bottom-right glassmorphism card)
  // whenever detail-mode is on. This replaces the scattered inline labels
  // with a single clean card. Cached to avoid innerHTML rebuild on every
  // renderStarfield call (which fires on every task check).
  var panel = document.getElementById('constellation-panel');
  if (panel) {
    // Cancel any pending hide timeout from a previous toggle-off.
    if (panel._hideTimer) { clearTimeout(panel._hideTimer); panel._hideTimer = null; }
    if (state.detail) {
      // Compute a fingerprint so we skip the rebuild when nothing changed.
      var fpParts = [];
      CONSTELLATIONS.forEach(function(baseC) {
        var count = (state.m[baseC.metric] || 0) | 0;
        var lit = Math.min(count, baseC.totalStars);
        fpParts.push(baseC.id + ':' + lit);
      });
      var fp = fpParts.join('|');
      if (panel._lastFingerprint !== fp) {
        panel._lastFingerprint = fp;
        var panelHtml = '<div class="constellation-panel-title">✦ Constellations</div>';
        CONSTELLATIONS.forEach(function(baseC) {
          var c = themedConstellation(baseC);
          var count = (state.m[c.metric] || 0) | 0;
          var lit = Math.min(count, c.totalStars);
          panelHtml += '<div class="constellation-panel-row">' +
            '<span class="constellation-panel-dot" style="color:' + c.color + ';background:' + c.color + '"></span>' +
            '<div class="constellation-panel-info">' +
              '<div class="constellation-panel-name" style="color:' + c.color + '">' + escHtml(c.name) + '</div>' +
              '<div class="constellation-panel-metric">' + escHtml(c.latin) + '</div>' +
            '</div>' +
            '<span class="constellation-panel-progress">' + lit + '/' + c.totalStars + '</span>' +
          '</div>';
        });
        panel.innerHTML = panelHtml;
      }
      panel.style.display = 'block';
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    } else if (panel.style.display !== 'none') {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(8px)';
      panel._hideTimer = setTimeout(function() {
        panel.style.display = 'none';
        panel._hideTimer = null;
      }, 400);
    }
  }

  var btn = document.getElementById('starfield-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-on', !!state.detail);
    var onInfo = !!state.info;
    btn.textContent = state.detail ? (onInfo ? '◈' : '◉') : '○';
    btn.title = state.detail
      ? (onInfo
          ? 'Hide constellation names & per-star hover info'
          : 'Show per-star hover info on hover')
      : 'Show constellation names';
  }

  var shotLayer = wrap.querySelector('.starfield-shootings');
  if (shotLayer) applyShootingState(shotLayer, !!state.shooting);

  applySkyRotation();
}

function notifyStarfieldGrowth(_metricIgnored) { renderStarfield(); }
function notifyTreeGrowth()   { renderStarfield(); }
function notifyTreeDeletion() { renderStarfield(); }
function syncForestMetricsFromApp(_appCounts) { renderStarfield(); }

function toggleStarfieldDetail() {
  var state = getStarfieldState();
  state.detail = !state.detail;
  saveStarfieldState(state);
  renderStarfield();
}

function toggleStarfieldShooting() {
  var state = getStarfieldState();
  state.shooting = !state.shooting;
  saveStarfieldState(state);
  renderStarfield();
}

window.STARFIELD = {
  toggleDetail: toggleStarfieldDetail,
  toggleShooting: toggleStarfieldShooting,
  toggleInfo: toggleStarfieldInfo,
  rotationDeg: skyRotationDeg
};

// ═══════════════════════════════════════
//  VIEW-MODE TOGGLES (Focus + Night Sky)
//
//  Per user request, BOTH modes are HOLD-only keybindings (no on-screen
//  buttons). Pressing a configured key activates, releasing deactivates.
//  They compose: holding both keys → focus + night-sky simultaneously.
//  Releasing restores the user's stored preset theme WITHOUT touching
//  the persisted localStorage state — so a tap-and-release never writes
//  the temporary mode to disk.
//
//  Public API:
//    setFocus(active)         — apply/release focus mode (CSS only, no save)
//    setNightSky(active)      — apply/release night-sky (CSS only, no save)
//    exitFocus()              — force clear BOTH modes + restore preset
//    getActiveViewMode()      — {preset, focusMode, nightSkyMode, ambientDensity}
//
//  Back-compat shims kept for any legacy code paths that still call
//  toggleFocus()/toggleNightSky(): they toggle the persisted state and
//  snap back via exitFocus() if BOTH were off.
// ═══════════════════════════════════════
var _holdRestore = { preset: null }; // remembers user's stored preset while a hold is active

// Apply/remove the .focus-mode class without touching localStorage.
// `active=true`  → fade UI chrome.
// `active=false` → restore UI chrome. Does NOT change _holdRestore.preset.
// The .focus-exiting class is added briefly during exit so the CSS
// will-change: opacity hint activates during the fade-out transition.
function setFocus(active) {
  var html = document.documentElement;
  if (active) {
    html.classList.add('focus-mode');
    html.classList.remove('focus-exiting');
  } else if (html.classList.contains('focus-mode')) {
    html.classList.add('focus-exiting');
    html.classList.remove('focus-mode');
    // Clean up the exit class after the transition completes.
    setTimeout(function() { html.classList.remove('focus-exiting'); }, 600);
  }
}

// Apply/remove the .night-sky-mode class + force 'night-sky' theme for the
// duration of the hold. Releasing restores the stored preset.
function setNightSky(active) {
  var html = document.documentElement;
  var state = getStarfieldState();
  if (active) {
    // Remember user's stored preset so we can put it back on release.
    try {
      _holdRestore.preset = state.preset || localStorage.getItem('hw_preset') || 'midnight';
    } catch (e) { _holdRestore.preset = 'midnight'; }
    // Force the night-sky theme for the duration of the hold. Don't write to
    // disk — purely visual.
    ['midnight','forest','ocean','sunset','rose','coffee','light','dawn','dusk','daytime'].forEach(function(t){
      html.classList.remove('theme-' + t);
    });
    html.classList.add('theme-night-sky');
    html.classList.add('night-sky-mode');
    // Bump ambient density for the hold. We do NOT rebuild the starfield —
    // buildStarfieldOnce is gated on dataset.built which we leave intact, but
    // we resize the AMBIENT layer once on enter to maximize impact then go
    // back down on release.
    var wrap = document.getElementById('starfield');
    if (wrap) {
      var ambient = wrap.querySelector('.starfield-ambient');
      if (ambient) {
        ambient.dataset.density = 'high';
      }
    }
  } else {
    // Release: remove the night-sky classes, then re-add the user's
    // original theme-* class so the UI snaps back to their preset
    // WITHOUT writing anything to localStorage. No applyPreset() —
    // that function triggers a full settings cascade we don't need.
    html.classList.remove('night-sky-mode');
    html.classList.remove('theme-night-sky');
    var restorePreset = _holdRestore.preset || 'midnight';
    html.classList.add('theme-' + restorePreset);
    // Reset ambient density (lower dot count for normal themes).
    var wrap2 = document.getElementById('starfield');
    if (wrap2) {
      var ambient2 = wrap2.querySelector('.starfield-ambient');
      if (ambient2) delete ambient2.dataset.density;
    }
  }
}

// Force-clear BOTH modes regardless of which keys are currently held. Also
// called by Esc — kills any active hold keys via _heldViewKeys reset.
function exitFocus() {
  document.documentElement.classList.remove('focus-mode', 'night-sky-mode');
  // Restore preset (only meaningful if a previous night-sky hold had moved us).
  var restorePreset = 'midnight';
  try { restorePreset = localStorage.getItem('hw_preset') || 'midnight'; } catch (e) {}
  if (typeof applyPreset === 'function') applyPreset(restorePreset);
  // Clear hold-key tracking state so a "force-clear" via Esc doesn't leave
  // ghost press events in flight.
  _heldViewKeys = {};
  if (typeof toast === 'function') toast('Exited view mode', 'success', 1000);
}

// Read-only helpers used by code-reviewer + tests.
function getActiveViewMode() {
  var html = document.documentElement;
  return {
    preset: 'see localStorage hw_preset',
    focusMode: html.classList.contains('focus-mode'),
    nightSkyMode: html.classList.contains('night-sky-mode'),
    ambientDensity: (html.querySelector && html.querySelector('.starfield-ambient'))
      ? (html.querySelector('.starfield-ambient').dataset.density || 'normal')
      : 'normal'
  };
}

// Back-compat toggle shims. These DO persist to localStorage, since that's
// the older contract — but the hold-keybind path doesn't go through them
// (the new path uses setFocus/setNightSky directly).
function toggleFocus() {
  var state = getStarfieldState();
  state.focusMode = !state.focusMode;
  saveStarfieldState(state);
  setFocus(state.focusMode);
  renderStarfield();
}
function toggleNightSky() {
  var state = getStarfieldState();
  state.nightSkyMode = !state.nightSkyMode;
  saveStarfieldState(state);
  var wrap = document.getElementById('starfield');
  if (wrap) delete wrap.dataset.built;
  setNightSky(state.nightSkyMode);
  renderStarfield();
}

// ═══════════════════════════════════════
//  Sound (kept — independent of widget)
// ═══════════════════════════════════════
var _audioCtx = null;
var _soundEnabled = (function(){ try { return localStorage.getItem('hw_sound_enabled') !== '0'; } catch(e) { return true; } })();
function toggleSound() {
  _soundEnabled = !_soundEnabled;
  try { localStorage.setItem('hw_sound_enabled', _soundEnabled ? '1' : '0'); } catch (e) {}
  toast(_soundEnabled ? '🔊 Sound on' : '🔇 Sound off', '', 1200);
}
function getAudioCtx() {
  if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  return _audioCtx;
}
function playTone(freq, type, duration, vol) {
  var ctx = getAudioCtx(); if (!ctx) return;
  var osc = ctx.createOscillator(); var gain = ctx.createGain();
  osc.type = type || 'sine'; osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.10, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration);
}
function playSuccess() { if (!_soundEnabled) return; playTone(523.25,'sine',.12,.08); setTimeout(function(){ playTone(659.25,'sine',.12,.08); }, 80); }
function playClick()   { if (!_soundEnabled) return; playTone(600,'sine',.03,.05); }

// ═══════════════════════════════════════
//  TIME-OF-DAY AUTO THEME (EST)
//  Reads the current US Eastern hour and picks the best theme.
//  Runs on load and every minute while auto-theme is enabled.
// ═══════════════════════════════════════
var _autoThemeTimer = null;
function getESTHour() {
  var now = new Date();
  var utcH = now.getUTCHours();
  var utcM = now.getUTCMinutes();
  var utcD = now.getUTCDate();
  // UTC-5 for EST (UTC-4 for EDT March-Nov). Simplify: always use UTC-5
  // which is close enough for visual theming purposes.
  var estH = (utcH - 5 + 24) % 24;
  return estH;
}
function getTimeOfDayTheme() {
  var hour = getESTHour();
  // Dawn (5–7am): warm sunrise glow.
  // Day (7am–5pm): blue sky.
  // Dusk (5–7pm): warm sunset fade to night.
  // Night (7pm–5am): midnight.
  if (hour >= 5 && hour < 7)  return 'dawn';
  if (hour >= 7 && hour < 17)  return 'daytime';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'midnight';
}
function autoApplyTimeOfDay() {
  var autoOn = false;
  try { autoOn = localStorage.getItem('hw_auto_theme') === '1'; } catch(e) {}
  if (!autoOn) return;
  var theme = getTimeOfDayTheme();
  var html = document.documentElement;
  if (!html.classList.contains('theme-' + theme)) {
    // Apply silently — no toast. applyPreset fires a toast on every
    // call, which would spam the user at 7am and 5pm every day.
    // We apply the CSS variables + starfield theme directly.
    var p = (typeof PRESETS !== 'undefined' ? PRESETS : null) || {};
    var vars = p[theme];
    if (vars) {
      Object.keys(vars).forEach(function(k) {
        html.style.setProperty(k, vars[k]);
      });
    }
    if (typeof applyStarfieldTheme === 'function') applyStarfieldTheme(theme);
  }
}
function startAutoThemeScheduler() {
  // Don't start the 60s timer if auto-theme is off — avoids wasting
  // a setInterval on users who never enable the feature.
  var autoOn = false;
  try { autoOn = localStorage.getItem('hw_auto_theme') === '1'; } catch(e) {}
  if (!autoOn) return;
  autoApplyTimeOfDay();
  if (_autoThemeTimer) clearInterval(_autoThemeTimer);
  _autoThemeTimer = setInterval(autoApplyTimeOfDay, 60000);
}
function stopAutoThemeScheduler() {
  if (_autoThemeTimer) { clearInterval(_autoThemeTimer); _autoThemeTimer = null; }
}
function toggleAutoTheme(checkbox) {
  var on = checkbox && checkbox.checked;
  try { localStorage.setItem('hw_auto_theme', on ? '1' : '0'); } catch(e) {}
  if (on) {
    startAutoThemeScheduler();
    if (typeof toast === 'function') toast('🌓 Auto theme: ON (follows EST time of day)', 'success', 3000);
  } else {
    stopAutoThemeScheduler();
    if (typeof toast === 'function') toast('Auto theme: OFF', '', 2000);
  }
}

// ═══════════════════════════════════════
//  Templates System (kept — independent)
// ═══════════════════════════════════════
var DEFAULT_TEMPLATES = [
  { id:'tpl_essay', name:'📝 Essay Workflow', subject:'', priority:'High', time:180, notes:'', recurring:'', subtasks:[
    { text:'Research sources', done:false }, { text:'Create outline', done:false },
    { text:'Write first draft', done:false }, { text:'Revise & edit', done:false },
    { text:'Proofread & format citations', done:false }, { text:'Final submission', done:false }
  ]},
  { id:'tpl_study', name:'📚 Study Session', subject:'', priority:'Medium', time:60, notes:'', recurring:'', subtasks:[
    { text:'Review lecture slides', done:false }, { text:'Do practice problems', done:false },
    { text:'Summarize key concepts', done:false }
  ]},
  { id:'tpl_lab', name:'🔬 Lab Report', subject:'', priority:'High', time:120, notes:'', recurring:'', subtasks:[
    { text:'Record data & observations', done:false }, { text:'Create graphs/tables', done:false },
    { text:'Write abstract & hypothesis', done:false }, { text:'Write discussion & conclusion', done:false },
    { text:'Format & submit', done:false }
  ]},
  { id:'tpl_project', name:'🎯 Project (Milestones)', subject:'', priority:'High', time:60, notes:'', recurring:'', subtasks:[
    { text:'Define scope & requirements', done:false }, { text:'Milestone 1: Research phase', done:false },
    { text:'Milestone 2: First draft', done:false }, { text:'Milestone 3: Peer review', done:false },
    { text:'Final polish & submission', done:false }
  ]},
  { id:'tpl_reading', name:'📖 Reading Assignment', subject:'', priority:'Medium', time:45, notes:'', recurring:'', subtasks:[
    { text:'Read chapter/pages', done:false }, { text:'Take notes', done:false },
    { text:'Write reflection/summary', done:false }
  ]},
  { id:'tpl_quiz_prep', name:'🧩 Quiz/Test Prep', subject:'', priority:'High', time:90, notes:'', recurring:'', subtasks:[
    { text:'Review all lecture notes', done:false }, { text:'Redo practice problems', done:false },
    { text:'Make flashcards for weak areas', done:false }, { text:'Do practice quiz', done:false },
    { text:'Review mistakes & re-study', done:false }
  ]},
  { id:'tpl_hw', name:'✏️ Standard Homework', subject:'', priority:'Medium', time:30, notes:'', recurring:'', subtasks:[
    { text:'Read instructions', done:false }, { text:'Complete all problems', done:false },
    { text:'Check answers', done:false }
  ]},
  { id:'tpl_presentation', name:'🎤 Presentation', subject:'', priority:'High', time:120, notes:'', recurring:'', subtasks:[
    { text:'Research topic', done:false }, { text:'Create slide outline', done:false },
    { text:'Design slides', done:false }, { text:'Write speaker notes', done:false },
    { text:'Practice delivery (2x)', done:false }, { text:'Final presentation', done:false }
  ]}
];
function getTemplates() {
  try {
    var d = localStorage.getItem('hw_templates');
    if (d) return JSON.parse(d);
    saveTemplates(DEFAULT_TEMPLATES);
    return DEFAULT_TEMPLATES;
  } catch (e) { return DEFAULT_TEMPLATES; }
}
function saveTemplates(list) { try { localStorage.setItem('hw_templates', JSON.stringify(list)); } catch (e) {} }

function applyTemplate(tplId) {
  var templates = getTemplates();
  var tpl = templates.find(function (t) { return t.id === tplId; });
  if (!tpl) return;
  editingId = null;
  document.getElementById('modal-title').textContent = '📝 ' + tpl.name;
  clearModalForm();
  document.getElementById('m-title').value = tpl.name.replace(/^[^\s]+\s/, '');
  if (tpl.subject) document.getElementById('m-subject').value = tpl.subject;
  if (tpl.priority) document.getElementById('m-priority').value = tpl.priority;
  if (tpl.time) document.getElementById('m-time').value = tpl.time;
  if (tpl.notes) document.getElementById('m-notes').value = tpl.notes;
  if (tpl.recurring) document.getElementById('m-recurring').value = tpl.recurring;
  App.subtaskEditor.items = (tpl.subtasks || []).map(function (st) {
    return { id: uid(), text: st.text, done: false };
  });
  App.renderSubtaskEditor();
  openModal();
}

function saveAsTemplate() {
  var title = document.getElementById('m-title').value.trim();
  if (!title) { toast('Enter a task title first', 'error'); return; }
  var tpl = {
    id: 'tpl_' + uid(),
    name: title,
    subject: document.getElementById('m-subject').value,
    priority: document.getElementById('m-priority').value,
    time: parseInt(document.getElementById('m-time').value) || 0,
    notes: document.getElementById('m-notes').value.trim(),
    recurring: document.getElementById('m-recurring').value,
    subtasks: App.subtaskEditor.items.map(function (st) { return { text: st.text, done: false }; })
  };
  var templates = getTemplates();
  templates.push(tpl);
  saveTemplates(templates);
  playClick();
  toast('Template saved: ' + title, 'success');
}

function deleteTemplate(tplId) {
  var templates = getTemplates().filter(function (t) { return t.id !== tplId; });
  saveTemplates(templates);
  renderTemplateList();
}

function renderTemplateList() {
  var el = document.getElementById('template-list');
  if (!el) return;
  var templates = getTemplates();
  var html = '';
  templates.forEach(function (tpl) {
    var subtasksCount = (tpl.subtasks || []).length;
    html += '<div class="template-item">' +
      '<div class="template-info" onclick="applyTemplate(\'' + tpl.id + '\')" title="Click to apply this template">' +
        '<div class="template-name">' + escHtml(tpl.name) + '</div>' +
        '<div class="template-meta">' +
          (tpl.subject ? '<span class="template-tag">' + escHtml(tpl.subject) + '</span>' : '') +
          '<span class="template-tag">' + tpl.priority + '</span>' +
          (tpl.time ? '<span class="template-tag">⏱ ' + tpl.time + 'm</span>' : '') +
          (subtasksCount ? '<span class="template-tag">☑ ' + subtasksCount + ' subtasks</span>' : '') +
        '</div>' +
      '</div>' +
      '<button class="task-act-btn del" onclick="deleteTemplate(\'' + tpl.id + '\')" title="Delete template">✕</button>' +
    '</div>';
  });
  if (templates.length === 0) {
    html = '<div style="color:var(--text3);font-size:13px;padding:12px 0">No templates yet. Save the current task form as a template.</div>';
  }
  el.innerHTML = html;
}
