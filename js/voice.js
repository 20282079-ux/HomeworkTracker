// voice.js — Voice input + AI parsing for the quick-add bar.
// Supports two providers: Google Gemini (native API) and OpenRouter (OpenAI-compatible).
// Depends on: App object (for state, parser fallback, toast, renderQuickAddPreview)
// No external dependencies — uses Web Speech API (browser-native) and fetch.

var Voice = {
  // ── State ──
  listening: false,
  processing: false,
  _recognition: null,
  _interimResult: '',
  _abortController: null,

  // ── Provider ──
  getProvider: function() {
    try { return localStorage.getItem('hw_ai_provider') || 'openrouter'; } catch(e) { return 'openrouter'; }
  },
  setProvider: function(p) {
    try { localStorage.setItem('hw_ai_provider', p); } catch(e) {}
  },

  // ── Gemini API Key ──
  getGeminiKey: function() {
    try { return localStorage.getItem('hw_gemini_key') || ''; } catch(e) { return ''; }
  },
  setGeminiKey: function(key) {
    try { localStorage.setItem('hw_gemini_key', (key || '').trim()); } catch(e) {}
  },

  // ── OpenRouter API Key ──
  getOpenRouterKey: function() {
    try { return localStorage.getItem('hw_openrouter_key') || ''; } catch(e) { return ''; }
  },
  setOpenRouterKey: function(key) {
    try { localStorage.setItem('hw_openrouter_key', (key || '').trim()); } catch(e) {}
  },

  // ── Does the current provider have a key? ──
  hasKey: function() {
    var p = this.getProvider();
    if (p === 'openrouter') return !!this.getOpenRouterKey();
    return !!this.getGeminiKey();
  },

  // ── Model ──
  GEMINI_MODELS: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
  OPENROUTER_MODELS: [
    'google/gemini-2.0-flash-001:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'google/gemini-2.5-flash-lite:free'
  ],
  getModel: function() {
    var key = 'hw_ai_model';
    try { return localStorage.getItem(key) || this._defaultModel(); } catch(e) { return this._defaultModel(); }
  },
  setModel: function(model) {
    try { localStorage.setItem('hw_ai_model', (model || '').trim()); } catch(e) {}
  },
  _defaultModel: function() {
    var p = this.getProvider();
    if (p === 'openrouter') return 'google/gemini-2.0-flash-001:free';
    return 'gemini-2.0-flash';
  },

  // ── Browser support check ──
  isSupported: function() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  // ── Init: hide mic button on unsupported browsers ──
  init: function() {
    if (!this.isSupported()) {
      var btn = document.getElementById('voice-mic-btn');
      if (btn) btn.classList.add('hidden');
    }
  },

  // ── Start listening ──
  start: function() {
    if (this.listening || this.processing) return;
    if (this._abortController) {
      try { this._abortController.abort(); } catch(e) {}
      this._abortController = null;
    }
    if (!this.isSupported()) {
      if (typeof toast === 'function') toast('🎤 Voice input is not supported in this browser. Try Chrome or Edge.', 'error', 4000);
      return;
    }
    this._interimResult = '';

    var self = this;
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = function() {
      self.listening = true;
      self._updateMicUI('listening');
      var qa = document.getElementById('qa-input');
      if (qa) { qa.placeholder = '🎤 Listening…'; qa.focus(); }
    };

    rec.onresult = function(e) {
      var transcript = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      transcript = transcript.trim();
      if (transcript) {
        self._interimResult = transcript;
        var qa = document.getElementById('qa-input');
        if (qa) {
          qa.value = transcript;
          qa.placeholder = '🎤 Listening…';
          if (typeof App !== 'undefined' && App.onQuickAddInput) {
            App.onQuickAddInput({ target: qa });
          }
        }
      }
    };

    rec.onerror = function(e) { self._handleRecognitionError(e); };

    rec.onend = function() {
      self.listening = false;
      self._updateMicUI('idle');
      var qa = document.getElementById('qa-input');
      if (qa) qa.placeholder = 'Quick add: e.g. Math homework due Friday 30m high';

      var finalText = self._interimResult;
      if (finalText && self.hasKey()) {
        self._processWithAI(finalText);
      } else if (finalText) {
        var provider = self.getProvider();
        var name = provider === 'openrouter' ? 'OpenRouter' : 'Gemini';
        if (typeof toast === 'function') toast('🎤 Transcribed! Add an ' + name + ' API key in ⚙ Customize for AI-powered parsing.', '', 5000);
      }
    };

    this._recognition = rec;
    try { rec.start(); } catch(e) {
      self.listening = false;
      self._updateMicUI('idle');
      if (typeof toast === 'function') toast('🎤 Could not start microphone. Please allow microphone access.', 'error', 4000);
    }
  },

  // ── Stop listening ──
  stop: function() {
    if (this._recognition) {
      try { this._recognition.stop(); } catch(e) {}
      this._recognition = null;
    }
    if (this._abortController) {
      try { this._abortController.abort(); } catch(e) {}
      this._abortController = null;
    }
    this.listening = false;
    this.processing = false;
    this._updateMicUI('idle');
    var qa = document.getElementById('qa-input');
    if (qa) qa.placeholder = 'Quick add: e.g. Math homework due Friday 30m high';
  },

  toggle: function() {
    if (this.listening) { this.stop(); } else { this.start(); }
  },

  _handleRecognitionError: function(e) {
    this.listening = false;
    this._updateMicUI('idle');
    var qa = document.getElementById('qa-input');
    if (qa) qa.placeholder = 'Quick add: e.g. Math homework due Friday 30m high';
    var map = {
      'not-allowed': '🎤 Microphone access denied. Please allow mic access in browser settings.',
      'no-speech': '🎤 No speech detected. Try again.',
      'audio-capture': '🎤 No microphone found.',
      'network': '🎤 Network error during speech recognition.'
    };
    var msg = map[e.error] || ('🎤 Speech recognition error: ' + (e.error || 'unknown'));
    if (typeof toast === 'function') toast(msg, 'error', 3500);
  },

  // ═══════════════════════════════════════
  //  AI PROCESSING — routes to Gemini or OpenRouter
  // ═══════════════════════════════════════
  _processWithAI: function(transcript) {
    var provider = this.getProvider();
    if (provider === 'openrouter') {
      this._callOpenRouter(transcript);
    } else {
      this._callGemini(transcript);
    }
  },

  // ── OpenRouter (OpenAI-compatible) ──
  _callOpenRouter: function(transcript) {
    var self = this;
    this.processing = true;
    this._updateMicUI('processing');

    var qa = document.getElementById('qa-input');
    if (qa) qa.placeholder = '🤖 AI is parsing…';

    var prompt = this._buildPrompt(transcript);
    var apiKey = this.getOpenRouterKey();
    this._abortController = new AbortController();
    var signal = this._abortController.signal;

    var body = {
      model: this.getModel(),
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.3,
      max_tokens: 1024
    };

    console.log('[Voice] OpenRouter request:', body.model, 'key starts with:', apiKey.substring(0, 8) + '...');

    fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Homework Tracker'
      },
      body: JSON.stringify(body)
    })
    .then(function(res) {
      if (!res.ok) {
        return res.text().then(function(text) {
          try {
            var err = JSON.parse(text);
            var msg = (err.error && err.error.message) || ('HTTP ' + res.status);
            console.warn('[Voice] OpenRouter error response:', JSON.stringify(err));
            throw new Error(msg);
          } catch(e) {
            // If our own error was thrown above, re-throw it
            if (e.message && (e.message.indexOf('HTTP') !== -1 || e.message.indexOf('rate') !== -1 || e.message.indexOf('key') !== -1)) throw e;
            // JSON parse failed — use status code
            throw new Error('HTTP ' + res.status);
          }
        });
      }
      return res.json();
    })
    .then(function(data) {
      self._onAISuccess(data, transcript, 'openrouter');
    })
    .catch(function(err) {
      self._onAIError(err, 'openrouter');
    });
  },

  // ── Gemini (native API) ──
  _callGemini: function(transcript) {
    var self = this;
    this.processing = true;
    this._updateMicUI('processing');

    var qa = document.getElementById('qa-input');
    if (qa) qa.placeholder = '🤖 AI is parsing…';

    var prompt = this._buildPrompt(transcript);
    var apiKey = this.getGeminiKey();
    this._abortController = new AbortController();
    var signal = this._abortController.signal;

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              encodeURIComponent(this.getModel()) +
              ':generateContent?key=' + encodeURIComponent(apiKey);

    console.log('[Voice] Gemini request:', this.getModel());

    fetch(url, {
      signal: signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.text().then(function(text) {
          try {
            var err = JSON.parse(text);
            var msg = (err.error && err.error.message) || ('HTTP ' + res.status);
            console.warn('[Voice] Gemini error response:', JSON.stringify(err));
            throw new Error(msg);
          } catch(e) {
            if (e.message && (e.message.indexOf('HTTP') !== -1 || e.message.indexOf('rate') !== -1 || e.message.indexOf('key') !== -1)) throw e;
            throw new Error('HTTP ' + res.status);
          }
        });
      }
      return res.json();
    })
    .then(function(data) {
      self._onAISuccess(data, transcript, 'gemini');
    })
    .catch(function(err) {
      self._onAIError(err, 'gemini');
    });
  },

  // ── Handle successful AI response (either provider) ──
  _onAISuccess: function(data, transcript, provider) {
    this.processing = false;
    this._abortController = null;
    this._updateMicUI('idle');
    var qa = document.getElementById('qa-input');
    if (qa) qa.placeholder = 'Quick add: e.g. Math homework due Friday 30m high';

    var content;
    if (provider === 'openrouter') {
      content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    } else {
      // Gemini native
      if (!data.candidates || !data.candidates.length) {
        var reason = (data.promptFeedback && data.promptFeedback.blockReason) || 'blocked';
        throw new Error('Response blocked: ' + reason);
      }
      content = data.candidates[0].content && data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    }

    if (!content) throw new Error('Empty response from AI');

    // Strip markdown code fences
    var cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '').trim();
    }

    var parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch(e) {
      console.warn('[Voice] Failed to parse JSON from AI:', cleaned.substring(0, 200));
      throw new Error('AI returned invalid JSON');
    }

    this._applyResult(parsed, transcript);
  },

  // ── Handle AI errors ──
  _onAIError: function(err, provider) {
    if (err.name === 'AbortError') { this._abortController = null; return; }
    this.processing = false;
    this._abortController = null;
    this._updateMicUI('idle');
    var qa = document.getElementById('qa-input');
    if (qa) qa.placeholder = 'Quick add: e.g. Math homework due Friday 30m high';

    var errMsg = (err.message || 'unknown error').toLowerCase();
    console.warn('[Voice] ' + provider + ' error:', err.message || err);

    if (typeof toast !== 'function') return;

    if (errMsg.indexOf('401') >= 0 || errMsg.indexOf('403') >= 0 || errMsg.indexOf('invalid') >= 0) {
      var name = provider === 'openrouter' ? 'OpenRouter' : 'Gemini';
      toast('🔑 Invalid ' + name + ' API key. Check it in ⚙ Customize.', 'error', 5000);
    } else if (errMsg.indexOf('429') >= 0 || errMsg.indexOf('rate') >= 0 || errMsg.indexOf('quota') >= 0 || errMsg.indexOf('exhausted') >= 0) {
      toast('⏳ Rate limit reached. Try again later or switch provider in ⚙ Customize.', 'error', 5000);
    } else if (errMsg.indexOf('404') >= 0 || errMsg.indexOf('not found') >= 0) {
      toast('🤖 Model not found. Try a different model in ⚙ Customize.', 'error', 4000);
    } else if (errMsg.indexOf('blocked') >= 0 || errMsg.indexOf('safety') >= 0) {
      toast('🛡 Content blocked by safety filter.', 'error', 4000);
    } else {
      toast('🤖 AI parsing failed — using quick-parse instead. (' + (err.message || 'unknown') + ')', 'error', 5000);
    }
  },

  // ── Build the parsing prompt (shared across providers) ──
  _buildPrompt: function(transcript) {
    var subjects = [];
    try {
      if (typeof App !== 'undefined' && App.state && App.state.subjects) {
        subjects = App.state.subjects.map(function(s) { return s.name; });
      }
    } catch(e) {}
    if (!subjects.length) subjects = ['Math', 'Science', 'English', 'History', 'Art', 'PE', 'Other'];

    var today = new Date();
    var todayStr = today.toISOString().split('T')[0];
    var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    var sys = 'You are a homework assignment parser. Return ONLY a JSON object with these fields:\n' +
      '- "title": clean task title\n' +
      '- "subject": one of ' + JSON.stringify(subjects) + ' (closest match)\n' +
      '- "due": YYYY-MM-DD or "". Today is ' + todayStr + ' (' + dayNames[today.getDay()] + '). ' +
      '"tomorrow"=next day, "Friday"=upcoming Friday, "end of week"=this Friday, "next week"=Monday next week.\n' +
      '- "time": minutes (integer), 0 if not mentioned\n' +
      '- "priority": "Low"/"Medium"/"High"/"Urgent". Infer from urgency words.\n' +
      '- "notes": extra details mentioned\n' +
      '- "assignmentType": "homework"/"essay"/"lab report"/"problem set"/"reading"/"worksheet"/"project"/"quiz"/"test"/"review"/"discussion" or ""\n' +
      '- "isTestLike": true/false\n' +
      '- "actionVerb": "study"/"review"/"prep"/"prepare"/"read"/"submit"/"revise"/"practice" or null\n' +
      '- "entities": {"chapters":[],"pages":[],"urls":[],"people":[],"quoted":[]}\n' +
      'Rules: "study for X test"→actionVerb="study",isTestLike=true. "read chapters 3-5"→assignmentType="reading",entities.chapters=["3-5"]. ' +
      'If multiple items joined by "and"/"then", parse first only. Default priority=Medium.';

    return {
      system: sys,
      user: 'Parse: "' + transcript + '"'
    };
  },

  // ── Apply parsed result to the quick-add flow ──
  _applyResult: function(parsed, rawTranscript) {
    var result = {
      title: parsed.title || rawTranscript,
      subject: parsed.subject || ((App.state.subjects[0] || {name:'Other'}).name),
      due: parsed.due || '',
      time: typeof parsed.time === 'number' ? parsed.time : 0,
      priority: ['Low','Medium','High','Urgent'].indexOf(parsed.priority) >= 0 ? parsed.priority : 'Medium',
      status: 'pending',
      notes: parsed.notes || '',
      assignmentType: parsed.assignmentType || '',
      entities: {
        chapters: (parsed.entities && parsed.entities.chapters) || [],
        pages: (parsed.entities && parsed.entities.pages) || [],
        urls: (parsed.entities && parsed.entities.urls) || [],
        people: (parsed.entities && parsed.entities.people) || [],
        quoted: (parsed.entities && parsed.entities.quoted) || []
      },
      actionVerb: parsed.actionVerb || null,
      isTestLike: !!parsed.isTestLike,
      isProjectLike: parsed.assignmentType === 'project',
      intentScores: {
        test: parsed.isTestLike ? 5 : 0,
        study: parsed.actionVerb === 'study' ? 3 : (parsed.actionVerb === 'review' ? 1 : 0),
        task: !parsed.isTestLike ? 3 : 0
      },
      confidence: { subject: 0.9, title: 0.85, due: parsed.due ? 0.9 : 0.3, time: parsed.time > 0 ? 0.9 : 0.3, priority: 0.85 },
      entityResolution: []
    };

    // Fuzzy-match subject
    try {
      var userSubjects = App.state.subjects.map(function(s) { return s.name.toLowerCase(); });
      if (userSubjects.indexOf(result.subject.toLowerCase()) < 0 && typeof parserFuzzyMatch === 'function') {
        var match = parserFuzzyMatch(result.subject, App.state.subjects.map(function(s) { return s.name; }), 2);
        if (match) { result.subject = match; result.confidence.subject = 0.75; }
      }
    } catch(e) {}

    var qa = document.getElementById('qa-input');
    if (qa) qa.value = rawTranscript;

    if (typeof App !== 'undefined') {
      App.quickAddState.parsed = [result];
      App.quickAddState._fromAI = true;
      App.renderQuickAddPreview([result], rawTranscript);
      App.quickAddState.previewVisible = true;
    }

    if (typeof toast === 'function') toast('🤖 AI parsed! Review and press Enter or + Add.', 'success', 3000);
  },

  // ── Mic button UI ──
  _updateMicUI: function(state) {
    var btn = document.getElementById('voice-mic-btn');
    if (!btn) return;
    btn.classList.remove('voice-listening', 'voice-processing');
    switch(state) {
      case 'listening':
        btn.classList.add('voice-listening');
        btn.setAttribute('aria-label', 'Stop listening');
        btn.title = 'Stop listening';
        break;
      case 'processing':
        btn.classList.add('voice-processing');
        btn.setAttribute('aria-label', 'AI is processing…');
        btn.title = 'AI is processing…';
        break;
      default:
        btn.setAttribute('aria-label', 'Voice input');
        btn.title = 'Click to speak your assignment';
        break;
    }
  },

  handleKeydown: function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'v') {
      e.preventDefault();
      this.toggle();
    }
  }
};
