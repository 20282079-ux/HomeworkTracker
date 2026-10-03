// sync.js — pure helpers for merging the local board with the cloud copy.
//
// Kept free of framework/Convex imports so the merge rules can be unit
// tested directly. The board is small and synced whole, so merging is a
// simple union: tasks by id, subjects by (case-insensitive) name, and
// settings keyed by name.

// Stable string form of a board used to detect "dirty" local edits and to
// compare boards. Only the three synced collections are included — extra
// server fields (like updatedAt) must not affect the comparison.
export function snapshot(board) {
  return JSON.stringify({
    tasks: board.tasks,
    subjects: board.subjects,
    settings: board.settings,
  });
}

// Merge the local board with the remote (cloud) board without losing data
// from either side. Used when a device signs in for the first time so
// existing local homework is uploaded alongside whatever the account
// already had.
//
// Conflict rules (same task / subject on both sides):
//   - the remote copy wins as the base (it is the shared copy),
//   - but local progress is preserved: a locally completed task stays done
//     and a locally pinned task stays pinned.
export function mergeBoards(local, remote) {
  return {
    tasks: mergeTasks(local && local.tasks, remote && remote.tasks),
    subjects: mergeSubjects(local && local.subjects, remote && remote.subjects),
    settings: mergeSettings(local && local.settings, remote && remote.settings),
  };
}

function mergeTasks(localTasks, remoteTasks) {
  const byId = new Map();
  for (const t of remoteTasks || []) {
    if (t && t.id != null) byId.set(t.id, t);
  }
  for (const t of localTasks || []) {
    if (!t || t.id == null) continue;
    const r = byId.get(t.id);
    if (!r) {
      byId.set(t.id, t);
      continue;
    }
    const merged = { ...r };
    if (t.status === "done" && r.status !== "done") merged.status = "done";
    if (t.pinned === true) merged.pinned = true;
    byId.set(t.id, merged);
  }
  return [...byId.values()];
}

function mergeSubjects(localSubjects, remoteSubjects) {
  const out = [];
  const seen = new Set();
  for (const s of [...(remoteSubjects || []), ...(localSubjects || [])]) {
    if (!s || typeof s.name !== "string") continue;
    const key = s.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function mergeSettings(localSettings, remoteSettings) {
  // Local device preferences win on conflicts (the settings you set up on
  // the device you are holding), remote-only keys are kept.
  return { ...(remoteSettings || {}), ...(localSettings || {}) };
}

// ── Sync codes ──
// Devices pair without accounts: every device that enters the same code
// shares one board. The code is a shared secret — treat it like a password.
// Codes are lowercase alphanumerics without ambiguous glyphs (i, l, o, 0, 1)
// so they are painless to retype on another device.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// Canonical form of a code a user typed: trim, lowercase, and strip
// everything that is not a letter or digit (spaces, dashes, emoji …).
export function normalizeSyncCode(raw) {
  return String(raw == null ? "" : raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// A fresh random code. Long enough that guessing another board is
// impractical (31^10 ≈ 10^15 possibilities).
export function newSyncCode(length = 10) {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n); // reject the tail to avoid modulo bias
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    for (const b of bytes) {
      if (b < limit) out += CODE_ALPHABET[b % n];
      if (out.length === length) break;
    }
  }
  return out;
}
