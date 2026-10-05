// tests/core.test.mjs — Vitest suite for the Homework Tracker core (React).
//
// The app logic lives in framework-free modules (src/*.js) so it can be
// tested directly with jsdom for browser APIs; components are exercised via
// the structural guards below. Coverage: date math, stats, filter/sort,
// storage round-trips + legacy-key purge, theme presets, command fuzzy
// matching, sync merge + the zero-setup relay transport, and structural
// guards that keep the Vite+React shell intact and removed features gone.

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Pure modules (imported directly, no sandbox needed) ──
const { computeStats, filterAndSortTasks, getDaysLeft, formatDate, todayStr, soonStr, PRIO_WEIGHT } = await import("../src/tasks.js");
const { DEFAULT_SUBJECTS, loadAll, uid, loadAppSettings, saveAppSettings } = await import("../src/storage.js");
const { PRESETS, themeStyle } = await import("../src/theme.js");
const { cmdFuzzyScore, filterCommands } = await import("../src/commands.js");
const { mergeBoards, snapshot, normalizeSyncCode, newSyncCode } = await import("../src/sync.js");
const { openBoard, boardTopic, RELAY_BROKERS } = await import("../src/relay.js");

let counter = 0;
function mkTask(overrides) {
  counter += 1;
  return Object.assign(
    {
      id: `_t${counter}`,
      created: Date.now(),
      title: "Task",
      subject: "Math",
      notes: "",
      due: "",
      priority: "Medium",
      time: 0,
      status: "pending",
    },
    overrides
  );
}

beforeEach(() => {
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════
//  DATES
// ═══════════════════════════════════════════════════════════════════════
describe("dates", () => {
  it("todayStr is an ISO calendar date", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("soonStr is exactly 3 days after todayStr", () => {
    expect(getDaysLeft(soonStr())).toBe(3);
  });

  it("getDaysLeft counts calendar days", () => {
    expect(getDaysLeft(todayStr())).toBe(0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getDaysLeft(tomorrow.toISOString().split("T")[0])).toBe(1);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    expect(getDaysLeft(lastWeek.toISOString().split("T")[0])).toBe(-7);
  });

  it("formatDate renders 'Mon D' without zero padding", () => {
    expect(formatDate("2026-06-09")).toBe("Jun 9");
    expect(formatDate("2026-12-25")).toBe("Dec 25");
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════════════
describe("stats", () => {
  it("counts total, done, overdue and due-soon", () => {
    const tasks = [
      mkTask({ id: "a", status: "done" }),
      mkTask({ id: "b", due: "2000-01-01" }),
      mkTask({ id: "c", due: todayStr() }),
      mkTask({ id: "d", due: soonStr() }),
      mkTask({ id: "e", due: "2099-01-01" }),
      mkTask({ id: "f" }),
    ];
    const s = computeStats(tasks);
    expect(s.total).toBe(6);
    expect(s.done).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(2);
    expect(s.pct).toBe(17);
  });

  it("handles an empty board", () => {
    expect(computeStats([])).toEqual({ total: 0, done: 0, overdue: 0, dueSoon: 0, pct: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  FILTER + SORT
// ═══════════════════════════════════════════════════════════════════════
describe("filterAndSortTasks", () => {
  const base = { activeFilter: "All", search: "", sort: "created", statusFilter: "all", showDone: true, groupBySubject: false };

  it("filters by subject", () => {
    const tasks = [mkTask({ id: "a", subject: "Math" }), mkTask({ id: "b", subject: "Science" })];
    const groups = filterAndSortTasks(tasks, { ...base, activeFilter: "Math" });
    expect(groups[0].items.map((t) => t.id)).toEqual(["a"]);
  });

  it("hides done tasks when showDone is off", () => {
    const tasks = [mkTask({ id: "a" }), mkTask({ id: "b", status: "done" })];
    const groups = filterAndSortTasks(tasks, { ...base, showDone: false });
    expect(groups[0].items.map((t) => t.id)).toEqual(["a"]);
  });

  it("searches title, notes and subject", () => {
    const tasks = [
      mkTask({ id: "a", title: "Chapter 5" }),
      mkTask({ id: "b", title: "Essay", notes: "Gatsby analysis" }),
      mkTask({ id: "c", title: "Lab", subject: "Gatsbyology" }),
    ];
    const groups = filterAndSortTasks(tasks, { ...base, search: "gatsby" });
    expect(groups[0].items.map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("sorts by due date with undated last", () => {
    const tasks = [mkTask({ id: "none", due: "" }), mkTask({ id: "late", due: "2099-01-02" }), mkTask({ id: "soon", due: "2099-01-01" })];
    const groups = filterAndSortTasks(tasks, { ...base, sort: "due" });
    expect(groups[0].items.map((t) => t.id)).toEqual(["soon", "late", "none"]);
  });

  it("sorts by priority weight, Urgent first", () => {
    const tasks = [mkTask({ id: "l", priority: "Low" }), mkTask({ id: "u", priority: "Urgent" }), mkTask({ id: "m", priority: "Medium" })];
    const groups = filterAndSortTasks(tasks, { ...base, sort: "priority" });
    expect(groups[0].items.map((t) => t.id)).toEqual(["u", "m", "l"]);
    expect(PRIO_WEIGHT.Urgent).toBe(4);
  });

  it("floats pinned tasks to the top", () => {
    const tasks = [mkTask({ id: "x", priority: "Urgent" }), mkTask({ id: "p", priority: "Low", pinned: true })];
    const groups = filterAndSortTasks(tasks, { ...base, sort: "priority" });
    expect(groups[0].items.map((t) => t.id)).toEqual(["p", "x"]);
  });

  it("groups by subject when groupBySubject is on", () => {
    const tasks = [mkTask({ id: "a", subject: "Math" }), mkTask({ id: "b", subject: "Science" }), mkTask({ id: "c", subject: "Math" })];
    const groups = filterAndSortTasks(tasks, { ...base, groupBySubject: true });
    expect(groups.map((g) => g.subject)).toEqual(["Math", "Science"]);
    expect(groups[0].items.length).toBe(2);
  });

  it("returns one ungrouped batch when grouping is off", () => {
    const groups = filterAndSortTasks([mkTask({}), mkTask({})], base);
    expect(groups.length).toBe(1);
    expect(groups[0].subject).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════════════════════════════════════
describe("storage", () => {
  it("loadAll seeds sample tasks on first run and flags it", () => {
    const { tasks, subjects, isFirstRun } = loadAll();
    expect(isFirstRun).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    expect(subjects.length).toBe(DEFAULT_SUBJECTS.length);
  });

  it("loadAll round-trips persisted tasks and subjects", () => {
    const tasks = [mkTask({ id: "keep", title: "Restored" })];
    const subjects = [{ name: "Bio", color: "#000000" }];
    localStorage.setItem("hw_tasks", JSON.stringify(tasks));
    localStorage.setItem("hw_subjects", JSON.stringify(subjects));
    const out = loadAll();
    expect(out.isFirstRun).toBe(false);
    expect(out.tasks[0].title).toBe("Restored");
    expect(out.subjects[0].name).toBe("Bio");
  });

  it("loadAll survives corrupted JSON", () => {
    localStorage.setItem("hw_tasks", "{not json");
    expect(() => loadAll()).not.toThrow();
    expect(Array.isArray(loadAll().tasks)).toBe(true);
  });

  it("purges the localStorage keys left behind by removed features", () => {
    const legacy = [
      "hw_quickadd_history", "hw_custom_synonyms", "hw_ai_provider", "hw_ai_model",
      "hw_openrouter_key", "hw_gemini_key", "hw_tests", "hw_starfield_state",
      "hw_forest_state", "hw_tree_state", "hw_hold_keys", "hw_auto_theme", "hw_templates",
    ];
    for (const key of legacy) localStorage.setItem(key, "leftover");
    localStorage.setItem("hw_tasks", JSON.stringify([mkTask({ id: "keep" })]));
    localStorage.setItem("hw_preset", "forest");

    loadAll();

    for (const key of legacy) {
      expect(localStorage.getItem(key), `${key} should be purged`).toBeNull();
    }
    expect(localStorage.getItem("hw_preset")).toBe("forest");
  });

  it("uid() returns unique underscore-prefixed ids", () => {
    const ids = new Set();
    for (let i = 0; i < 200; i++) {
      const id = uid();
      expect(id).toMatch(/^_[a-z0-9]+$/);
      ids.add(id);
    }
    expect(ids.size).toBe(200);
  });

  it("app settings round-trip with sane defaults", () => {
    const defaults = loadAppSettings();
    expect(defaults.showDone).toBe(true);
    expect(defaults.confetti).toBe(true);
    expect(defaults.groupBySubject).toBe(false);
    saveAppSettings({ ...defaults, showDone: false, title: "My Planner", compact: true });
    const loaded = loadAppSettings();
    expect(loaded.showDone).toBe(false);
    expect(loaded.title).toBe("My Planner");
    expect(loaded.compact).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════════════════════
describe("theme", () => {
  it("every preset defines the full variable set", () => {
    const required = ["--bg", "--bg2", "--bg3", "--surface", "--surface2", "--border", "--text", "--text2", "--text3", "--accent", "--accent2", "--accent-glow"];
    for (const [name, vars] of Object.entries(PRESETS)) {
      for (const k of required) {
        expect(vars[k], `${name} missing ${k}`).toMatch(/^(#|rgba)/);
      }
    }
  });

  it("themeStyle merges the preset with the radius token", () => {
    const style = themeStyle("midnight", 14);
    expect(style["--accent"]).toBe("#7c6af7");
    expect(style["--radius"]).toBe("14px");
    expect(themeStyle("nonsense", 8)["--radius"]).toBe("8px");
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  COMMAND PALETTE
// ═══════════════════════════════════════════════════════════════════════
describe("command palette", () => {
  const commands = [
    { id: "a", label: "Add Task", category: "Tasks" },
    { id: "b", label: "Theme: Ocean", category: "Theme" },
    { id: "c", label: "Open Settings", category: "App" },
  ];

  it("scores exact, prefix and substring matches", () => {
    expect(cmdFuzzyScore("Add Task", "add task")).toBe(2);
    expect(cmdFuzzyScore("Add Task", "add")).toBe(1.8);
    expect(cmdFuzzyScore("Add Task", "task")).toBe(1.5);
  });

  it("scores character subsequences and rejects non-matches", () => {
    expect(cmdFuzzyScore("Add Task", "adt")).toBeGreaterThan(0);
    expect(cmdFuzzyScore("Add Task", "zzz")).toBe(0);
  });

  it("filters commands by label or category", () => {
    expect(filterCommands(commands, "ocean").map((c) => c.id)).toEqual(["b"]);
    expect(filterCommands(commands, "theme").map((c) => c.id)).toEqual(["b"]);
    expect(filterCommands(commands, "").length).toBe(3);
    expect(filterCommands(commands, "zzz").length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  CLOUD SYNC MERGE
// ═══════════════════════════════════════════════════════════════════════
describe("cloud sync merge", () => {
  it("snapshot only covers the synced collections", () => {
    const board = { tasks: [mkTask({ id: "a" })], subjects: [{ name: "Math", color: "#fff" }], settings: { showDone: true } };
    const withServerField = { ...board, updatedAt: 12345 };
    expect(snapshot(board)).toBe(snapshot(withServerField));
    expect(snapshot(board)).not.toBe(snapshot({ ...board, settings: { showDone: false } }));
  });

  it("unions tasks by id without losing either side", () => {
    const local = { tasks: [mkTask({ id: "local1", title: "Only local" }), mkTask({ id: "both", title: "Local copy" })], subjects: [], settings: {} };
    const remote = { tasks: [mkTask({ id: "remote1", title: "Only remote" }), mkTask({ id: "both", title: "Remote copy" })], subjects: [], settings: {} };
    const merged = mergeBoards(local, remote);
    expect(merged.tasks.map((t) => t.id).sort()).toEqual(["both", "local1", "remote1"]);
    // Remote is the shared copy and wins on conflicts.
    expect(merged.tasks.find((t) => t.id === "both").title).toBe("Remote copy");
  });

  it("preserves local completion and pinning on conflicting tasks", () => {
    const local = { tasks: [mkTask({ id: "x", status: "done", pinned: true })], subjects: [], settings: {} };
    const remote = { tasks: [mkTask({ id: "x", status: "pending", title: "Remote" })], subjects: [], settings: {} };
    const merged = mergeBoards(local, remote);
    expect(merged.tasks[0].status).toBe("done");
    expect(merged.tasks[0].pinned).toBe(true);
    expect(merged.tasks[0].title).toBe("Remote");
  });

  it("unions subjects by case-insensitive name, remote first", () => {
    const local = { tasks: [], subjects: [{ name: "math", color: "#111111" }, { name: "Art", color: "#222222" }], settings: {} };
    const remote = { tasks: [], subjects: [{ name: "Math", color: "#ffffff" }], settings: {} };
    const merged = mergeBoards(local, remote);
    expect(merged.subjects.map((s) => s.name)).toEqual(["Math", "Art"]);
    expect(merged.subjects[0].color).toBe("#ffffff");
  });

  it("merges settings with local preferences winning", () => {
    const local = { tasks: [], subjects: [], settings: { title: "My Planner", compact: true } };
    const remote = { tasks: [], subjects: [], settings: { title: "Homework Tracker", showDone: false } };
    const merged = mergeBoards(local, remote);
    expect(merged.settings.title).toBe("My Planner");
    expect(merged.settings.compact).toBe(true);
    expect(merged.settings.showDone).toBe(false);
  });

  it("tolerates empty or missing collections", () => {
    const merged = mergeBoards({ tasks: [mkTask({ id: "a" })] }, {});
    expect(merged.tasks.length).toBe(1);
    expect(mergeBoards({}, null).subjects).toEqual([]);
  });

  it("normalizeSyncCode canonicalizes typed codes", () => {
    expect(normalizeSyncCode("  K3M9-XQ2A PT ")).toBe("k3m9xq2apt");
    expect(normalizeSyncCode("k3m9 xq2a")).toBe("k3m9xq2a");
    expect(normalizeSyncCode(null)).toBe("");
    expect(normalizeSyncCode("!!!")).toBe("");
  });

  it("newSyncCode generates 10 unambiguous lowercase alphanumerics", () => {
    const code = newSyncCode();
    expect(code).toMatch(/^[a-z0-9]{10}$/);
    expect(code).not.toMatch(/[ilo01]/);
    expect(newSyncCode(16)).toHaveLength(16);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(newSyncCode());
    expect(seen.size).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  SYNC RELAY — the zero-setup transport (public MQTT over WebSocket)
// ═══════════════════════════════════════════════════════════════════════
describe("sync relay", () => {
  const BROKERS = ["wss://a.example/mqtt", "wss://b.example/mqtt", "wss://c.example/mqtt"];
  const PAYLOAD = JSON.stringify({ tasks: [{ id: "a" }], subjects: [], settings: {} });

  // Minimal mqtt-client stand-in: the event surface openBoard drives
  // (connect/message/close/error/offline/reconnect) plus subscribe/publish
  // with ack callbacks.
  function fakeClient(url) {
    const handlers = {};
    const client = {
      url,
      subs: [],
      publishes: [],
      ended: false,
      on(ev, fn) {
        (handlers[ev] || (handlers[ev] = [])).push(fn);
      },
      emit(ev, ...args) {
        (handlers[ev] || []).forEach((fn) => fn(...args));
      },
      subscribe(topic, opts, cb) {
        client.subs.push({ topic, opts });
        if (cb) cb(null);
      },
      publish(topic, payload, opts, cb) {
        client.publishes.push({ topic, payload, opts });
        if (cb) cb(null);
      },
      end() {
        client.ended = true;
      },
    };
    return client;
  }

  function harness(code = "k3m9xq2apt", overrides = {}) {
    const made = [];
    const seen = { boards: [], statuses: [] };
    const handle = openBoard(
      code,
      {
        onBoard: (b) => seen.boards.push(b),
        onStatus: (s) => seen.statuses.push(s),
      },
      {
        brokers: BROKERS,
        connect: (url) => {
          const c = fakeClient(url);
          made.push(c);
          return c;
        },
        firstPullTimeoutMs: 50,
        rotateRetryMs: 10,
        rotateAfterMs: 100,
        ...overrides,
      }
    );
    return { handle, made, seen };
  }

  it("boardTopic namespaces and sanitizes codes", () => {
    expect(boardTopic("k3m9xq2apt")).toBe("homeworktracker/v1/k3m9xq2apt");
    expect(boardTopic("K3-9 X!")).toBe("homeworktracker/v1/k39x");
    expect(boardTopic(null)).toBe("homeworktracker/v1/");
    expect(RELAY_BROKERS.every((u) => u.startsWith("wss://"))).toBe(true);
  });

  it("starts every device of a code on the same broker", () => {
    const a = harness();
    const b = harness();
    expect(a.made[0].url).toBe(b.made[0].url);
    expect(BROKERS).toContain(a.made[0].url);
    a.handle.close();
    b.handle.close();
  });

  it("reports connecting → online → offline around the session", () => {
    vi.useFakeTimers();
    const { handle, made, seen } = harness();
    expect(seen.statuses).toEqual(["connecting"]);
    made[0].emit("connect");
    expect(seen.statuses).toEqual(["connecting", "online"]);
    made[0].emit("close");
    expect(seen.statuses).toEqual(["connecting", "online", "offline"]);
    handle.close();
    vi.useRealTimers();
  });

  it("verdicts a fresh code only when the relay stays silent", () => {
    vi.useFakeTimers();
    const { handle, made, seen } = harness();
    made[0].emit("connect");
    expect(seen.boards).toEqual([]);
    vi.advanceTimersByTime(60);
    expect(seen.boards).toEqual([null]);
    handle.close();
    vi.useRealTimers();
  });

  it("delivers the retained board and withholds the fresh verdict", () => {
    vi.useFakeTimers();
    const { handle, made, seen } = harness();
    made[0].emit("connect");
    made[0].emit("message", boardTopic("k3m9xq2apt"), { toString: () => PAYLOAD });
    expect(seen.boards).toHaveLength(1);
    expect(seen.boards[0].tasks).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(seen.boards).toHaveLength(1); // no null verdict afterwards
    handle.close();
    vi.useRealTimers();
  });

  it("ignores junk payloads on the public topic", () => {
    vi.useFakeTimers();
    const { handle, made, seen } = harness();
    made[0].emit("connect");
    made[0].emit("message", boardTopic("k3m9xq2apt"), { toString: () => "not json" });
    made[0].emit("message", boardTopic("k3m9xq2apt"), { toString: () => '{"nope":1}' });
    expect(seen.boards).toEqual([]);
    handle.close();
    vi.useRealTimers();
  });

  it("queues publishes while offline and flushes them as retained QoS1", () => {
    const { handle, made } = harness();
    handle.publish(PAYLOAD); // not connected yet — must not vanish
    expect(made[0].publishes).toHaveLength(0);
    made[0].emit("connect");
    expect(made[0].publishes).toHaveLength(1);
    expect(made[0].publishes[0]).toMatchObject({
      topic: "homeworktracker/v1/k3m9xq2apt",
      payload: PAYLOAD,
      opts: { qos: 1, retain: true },
    });
    handle.publish(PAYLOAD); // acknowledged — the next publish goes straight out
    expect(made[0].publishes).toHaveLength(2);
    handle.close();
    expect(made[0].ended).toBe(true);
  });

  it("fails over to the next broker only after two failed attempts", () => {
    vi.useFakeTimers();
    const { handle, made, seen } = harness();
    const startIdx = BROKERS.indexOf(made[0].url);
    made[0].emit("close"); // attempt 1 failed — mqtt.js would retry
    vi.advanceTimersByTime(15);
    expect(made).toHaveLength(1);
    made[0].emit("close"); // attempt 2 failed — give up on this broker
    vi.advanceTimersByTime(15);
    expect(made).toHaveLength(2);
    expect(made[1].url).toBe(BROKERS[(startIdx + 1) % BROKERS.length]);
    made[1].emit("connect");
    expect(seen.statuses[seen.statuses.length - 1]).toBe("online");
    handle.close();
    vi.useRealTimers();
  });

  it("re-seeds an empty broker after a long outage", () => {
    vi.useFakeTimers();
    const { handle, made } = harness();
    made[0].emit("connect");
    vi.advanceTimersByTime(60); // fresh verdict
    handle.publish(PAYLOAD);
    expect(made[0].publishes).toHaveLength(1);
    // Connection drops for longer than the rotation threshold → move on and,
    // finding nothing on the new broker, republish the last known board.
    made[0].emit("close");
    vi.advanceTimersByTime(101);
    made[0].emit("reconnect");
    vi.advanceTimersByTime(15);
    expect(made).toHaveLength(2);
    made[1].emit("connect");
    vi.advanceTimersByTime(60);
    expect(made[1].publishes).toHaveLength(1);
    expect(made[1].publishes[0].payload).toBe(PAYLOAD);
    handle.close();
    vi.useRealTimers();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  STRUCTURAL GUARDS — the Vite+React shell and the removed features
// ═══════════════════════════════════════════════════════════════════════
describe("structural guards", () => {
  const ROOT = resolve(process.cwd());

  it("package.json is a Vite + React project", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies.react).toBeTruthy();
    expect(pkg.dependencies["react-dom"]).toBeTruthy();
    expect(pkg.devDependencies.vite).toBeTruthy();
    expect(pkg.devDependencies["@vitejs/plugin-react"]).toBeTruthy();
    expect(pkg.scripts.build).toContain("vite build");
  });

  it("index.html is a Vite entry that mounts the React app", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    expect(html).toContain('id="root"');
    expect(html).toContain('/src/main.jsx');
  });

  it("the React source tree contains the app components", () => {
    for (const f of ["src/main.jsx", "src/App.jsx", "src/components/TaskCard.jsx", "src/components/TaskModal.jsx", "src/components/SettingsModal.jsx", "src/components/CommandPalette.jsx"]) {
      expect(existsSync(resolve(ROOT, f)), `${f} should exist`).toBe(true);
    }
  });

  it("the app no longer exposes templates / subtasks / recurring / export", () => {
    for (const dir of ["src"]) {
      const files = ["App.jsx", "components/TaskCard.jsx", "components/TaskModal.jsx", "components/SettingsModal.jsx", "components/CommandPalette.jsx", "tasks.js", "storage.js"];
      for (const f of files) {
        const src = readFileSync(resolve(ROOT, dir, f), "utf8");
        expect(src).not.toMatch(/\b(applyTemplate|saveAsTemplate|addSubtask|removeSubtask|exportCSV|exportICS|dailyReset|weeklyReset|pruneCompletedPastDue)\b/);
      }
    }
  });

  it("the legacy plain-JS modules stay deleted", () => {
    for (const f of ["js/state.js", "js/tasks.js", "js/app.js", "js/settings.js", "js/util.js", "js/command-palette.js", "js/tests.js", "js/gamification.js", "js/devmode.js"]) {
      expect(existsSync(resolve(ROOT, f)), `${f} should be deleted`).toBe(false);
    }
  });

  it("the service worker caches no removed modules and is at v9", () => {
    const sw = readFileSync(resolve(ROOT, "public/sw.js"), "utf8");
    expect(sw).toMatch(/'hw-tracker-v\d+'/);
    expect(sw).not.toMatch(/js\/(state|tasks|app|settings|util|command-palette|tests|gamification|devmode)\.js/);
  });

  it("sync ships with zero setup: no accounts, keys or env config", () => {
    const main = readFileSync(resolve(ROOT, "src/main.jsx"), "utf8");
    const cloud = readFileSync(resolve(ROOT, "src/cloud.jsx"), "utf8");
    const relay = readFileSync(resolve(ROOT, "src/relay.js"), "utf8");
    expect(main).not.toMatch(/convex|VITE_CONVEX_URL/);
    expect(cloud).not.toMatch(/convex|useQuery|useMutation|signIn|useAuthActions/);
    expect(relay).toMatch(/wss:/); // anonymous public relay, port 443
    expect(relay).not.toMatch(/apiKey|API_KEY|secret|bearer/i);
  });

  it("the manifest and icons ship in public/", () => {
    for (const f of ["public/manifest.json", "public/icon.svg", "public/icon-192.png", "public/icon-512.png", "public/apple-touch-icon.png"]) {
      expect(existsSync(resolve(ROOT, f)), `${f} should exist`).toBe(true);
    }
    expect(JSON.parse(readFileSync(resolve(ROOT, "public/manifest.json"), "utf8")).name).toBe("Homework Tracker");
  });
});
