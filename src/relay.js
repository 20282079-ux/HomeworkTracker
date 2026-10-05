// relay.js — zero-setup cross-device sync transport.
//
// There are no accounts and no API keys anywhere in this path: devices meet
// on public MQTT-over-WebSocket brokers (anonymous, port 443). One topic per
// sync code, and the shared board is stored as a *retained* message — so a
// device that joins later receives the current board immediately, even if
// every other device is offline right now, and every connected device gets
// updates in realtime.
//
// Brokers are picked deterministically from the sync code so all devices of
// one board start on the same shared store. Failover only happens while a
// device cannot connect at all (or after a very long outage), and a device
// that lands on an empty broker republishes its last known board so the
// stores converge again.
//
// The transport is treated as unreliable on purpose: localStorage stays the
// source of truth and cloud.jsx reconciles whatever arrives here.

import mqtt from "mqtt";

// Public, anonymous MQTT brokers with a WebSocket listener on port 443.
// scripts/sync-probe.mjs imports this list to verify the round-trip.
export const RELAY_BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

const TOPIC_PREFIX = "homeworktracker/v1/";
const RECONNECT_MS = 2000; // mqtt.js retry period against a chosen broker
const ROTATE_RETRY_MS = 1000; // pause before trying the next broker
const ROTATE_AFTER_MS = 120000; // abandon a stuck broker after 2min of outage
const FIRST_PULL_TIMEOUT_MS = 1500; // silence after SUBACK = "no shared copy"

// Topic for a board. The app already normalizes codes to [a-z0-9]; sanitize
// again so a malformed code can never escape the namespace.
export function boardTopic(code) {
  return TOPIC_PREFIX + sanitize(code);
}

function sanitize(code) {
  return String(code == null ? "" : code).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Deterministic first broker for a code (djb2), so every device of the same
// board prefers the same store.
function startIndex(code, count) {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h << 5) + h + code.charCodeAt(i)) >>> 0;
  return count > 0 ? h % count : 0;
}

// Open a sync session for `code`.
//
// handlers:
//   onBoard(board|null) — the shared copy; `null` is sent at most once per
//                         session and means "this code has no shared copy
//                         yet" (delivered after the first-pull timeout, so
//                         it also covers the broker having nothing stored).
//   onStatus(s)         — "connecting" | "online" | "offline".
//
// Returns { publish(payload), close() }. Publishing while offline is queued
// and flushed on the next subscribe; only the newest payload is kept.
export function openBoard(code, handlers = {}, options = {}) {
  const brokers = options.brokers && options.brokers.length ? options.brokers : RELAY_BROKERS;
  const connectFn = options.connect || mqtt.connect;
  const firstPullTimeoutMs = options.firstPullTimeoutMs ?? FIRST_PULL_TIMEOUT_MS;
  const rotateRetryMs = options.rotateRetryMs ?? ROTATE_RETRY_MS;
  const rotateAfterMs = options.rotateAfterMs ?? ROTATE_AFTER_MS;
  const onBoard = typeof handlers.onBoard === "function" ? handlers.onBoard : () => {};
  const onStatus = typeof handlers.onStatus === "function" ? handlers.onStatus : () => {};

  const clean = sanitize(code);
  const topic = boardTopic(clean);

  let index = startIndex(clean, brokers.length);
  let client = null;
  let closed = false;
  let connected = false; // current client is up right now
  let clientUp = false; // current client ever connected (rotate on failure)
  let sessionUp = false; // any client in this session connected
  let pulled = false; // first-pull verdict already delivered
  let failures = 0; // failed connect attempts against the current broker
  let sawMessage = false; // valid board arrived since the last subscribe
  let outageStart = 0;
  let firstTimer = null;
  let seedTimer = null;
  let retryTimer = null;
  let pending = null; // payload not yet acknowledged by the broker
  let lastPayload = null; // newest payload we ever wrote (for reseeding)

  const emitStatus = (s) => {
    if (!closed) onStatus(s);
  };
  const emitBoard = (b) => {
    if (!closed) onBoard(b);
  };

  function send(c) {
    if (!pending || !c || c !== client || !connected) return;
    const payload = pending;
    c.publish(topic, payload, { qos: 1, retain: true }, (err) => {
      if (!err && pending === payload) pending = null;
    });
  }

  function subscribe(c) {
    sawMessage = false;
    c.subscribe(topic, { qos: 1 }, (err) => {
      if (closed || client !== c || err) return;
      if (!pulled) {
        // Retained messages are delivered right after SUBACK, so silence
        // until the timeout means this code has no shared copy yet.
        firstTimer = setTimeout(() => {
          firstTimer = null;
          if (closed || client !== c || pulled) return;
          pulled = true;
          emitBoard(null);
        }, firstPullTimeoutMs);
      } else if (lastPayload) {
        // Re-subscribe after a reconnect (possibly on another broker): if
        // nothing arrives, republish our last known board so the shared
        // store is not left empty. If something does arrive, the newer
        // remote state wins and the seed is skipped.
        seedTimer = setTimeout(() => {
          seedTimer = null;
          if (closed || client !== c || sawMessage) return;
          pending = lastPayload;
          send(c);
        }, firstPullTimeoutMs);
      }
      send(c);
    });
  }

  function rotate() {
    const dead = client;
    client = null;
    connected = false;
    clientUp = false;
    if (firstTimer) clearTimeout(firstTimer);
    if (seedTimer) clearTimeout(seedTimer);
    firstTimer = seedTimer = null;
    try {
      if (dead) dead.end(true);
    } catch {
      /* already gone */
    }
    index += 1;
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      start();
    }, rotateRetryMs);
  }

  function start() {
    if (closed) return;
    const url = brokers[index % brokers.length];
    connected = false;
    clientUp = false;
    failures = 0;
    sawMessage = false;
    emitStatus(sessionUp ? "offline" : "connecting");

    let c;
    try {
      c = connectFn(url, { reconnectPeriod: RECONNECT_MS, connectTimeout: 8000, keepalive: 30 });
    } catch {
      rotate();
      return;
    }
    client = c;
    const current = () => !closed && client === c;

    c.on("connect", () => {
      if (!current()) return;
      connected = true;
      clientUp = true;
      sessionUp = true;
      outageStart = 0;
      emitStatus("online");
      subscribe(c);
    });

    c.on("message", (_topic, payload) => {
      if (!current()) return;
      let board;
      try {
        board = JSON.parse(payload.toString());
      } catch {
        return; // junk on a public topic — ignore
      }
      if (!board || typeof board !== "object" || !Array.isArray(board.tasks)) return;
      sawMessage = true;
      if (!pulled) {
        pulled = true;
        if (firstTimer) {
          clearTimeout(firstTimer);
          firstTimer = null;
        }
      }
      if (seedTimer) {
        clearTimeout(seedTimer);
        seedTimer = null;
      }
      emitBoard(board);
    });

    const wentDown = () => {
      if (!current()) return false;
      if (connected) {
        connected = false;
        outageStart = Date.now();
        emitStatus("offline");
        return true;
      }
      return false;
    };

    c.on("offline", () => {
      if (!current()) return;
      if (!wentDown()) emitStatus(sessionUp ? "offline" : "connecting");
    });
    c.on("close", () => {
      if (!current()) return;
      wentDown();
      if (!clientUp) {
        // A broker that never answered: let mqtt.js retry once (a single
        // transient failure must not push this device onto a different
        // shared store than the rest of the board), then move on.
        failures += 1;
        if (failures >= 2) rotate();
      }
    });
    c.on("error", () => {
      // Listener required so EventEmitter errors never become throws;
      // the matching 'close' drives the retry/rotation logic above.
    });
    c.on("reconnect", () => {
      if (!current()) return;
      if (outageStart && Date.now() - outageStart > rotateAfterMs) rotate();
    });
  }

  function publish(payload) {
    if (closed || typeof payload !== "string") return;
    lastPayload = payload;
    pending = payload;
    send(client);
  }

  function close() {
    if (closed) return;
    closed = true;
    if (firstTimer) clearTimeout(firstTimer);
    if (seedTimer) clearTimeout(seedTimer);
    if (retryTimer) clearTimeout(retryTimer);
    firstTimer = seedTimer = retryTimer = null;
    const dead = client;
    client = null;
    try {
      if (dead) dead.end(true);
    } catch {
      /* already gone */
    }
  }

  start();
  return { publish, close };
}
