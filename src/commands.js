// commands.js — command registry + fuzzy scoring for the Ctrl+K palette.
// Ported from the legacy command-palette.js with the DOM rendering removed
// (React renders the results; this module only scores and filters).

export function cmdFuzzyScore(text, query) {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 2; // exact match
  if (t.indexOf(q) === 0) return 1.8; // starts with
  if (t.indexOf(q) >= 0) return 1.5; // contains
  // Simple character-by-character subsequence scoring.
  let qi = 0;
  let score = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += 1;
      qi++;
    }
  }
  if (qi === q.length) return score / t.length;
  return 0;
}

export function filterCommands(commands, query) {
  if (!query) return commands.slice();
  const scored = [];
  for (const cmd of commands) {
    const s = cmdFuzzyScore(cmd.label, query);
    const cs = cmdFuzzyScore(cmd.category, query);
    const best = Math.max(s, cs);
    if (best > 0) scored.push({ cmd, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.cmd);
}
