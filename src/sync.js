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
