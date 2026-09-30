// sound.js — task-completion click sound, ported from js/settings.js.
let _audioCtx = null;
let _soundEnabled = (() => {
  try {
    return localStorage.getItem("hw_sound_enabled") !== "0";
  } catch {
    return true;
  }
})();

export function soundEnabled() {
  return _soundEnabled;
}

export function toggleSound() {
  _soundEnabled = !_soundEnabled;
  try {
    localStorage.setItem("hw_sound_enabled", _soundEnabled ? "1" : "0");
  } catch {
    /* non-critical */
  }
  return _soundEnabled;
}

function getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      /* no audio available */
    }
  }
  return _audioCtx;
}

function playTone(freq, type, duration, vol) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playClick() {
  if (!_soundEnabled) return;
  playTone(600, "sine", 0.03, 0.05);
}
