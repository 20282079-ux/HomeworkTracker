// sync-probe.mjs — verifies the zero-setup sync relay end to end.
//
// The app pairs devices with a sync code and stores the shared board as a
// *retained* MQTT message on a public broker, so any device that joins later
// gets the current board immediately (even if the other device is offline).
// This probe checks exactly that contract against every broker in the app's
// failover list:
//
//   1. client A publishes a retained board snapshot, then disconnects,
//   2. client B joins fresh and must receive the retained snapshot,
//   3. while B is online, client C publishes an update that B must receive
//      in realtime,
//   4. informational: whether B receives its own publish (MQTT echo).
//
// Usage:  node scripts/sync-probe.mjs   (or `npm run probe:sync`)
// Exits 0 when at least one broker passes steps 1–3.
import { connect } from "mqtt";
import { randomBytes } from "node:crypto";
import { RELAY_BROKERS as BROKERS } from "../src/relay.js";

const CONNECT_TIMEOUT_MS = 6000;
const MESSAGE_TIMEOUT_MS = 4000;

function open(url) {
  return new Promise((resolve, reject) => {
    const client = connect(url, { connectTimeout: CONNECT_TIMEOUT_MS, reconnectPeriod: 0 });
    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error(`connect timeout after ${CONNECT_TIMEOUT_MS}ms`));
    }, CONNECT_TIMEOUT_MS);
    client.once("connect", () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function nextMessage(client, timeoutMs = MESSAGE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no message within ${timeoutMs}ms`)), timeoutMs);
    client.once("message", (topic, payload) => {
      clearTimeout(timer);
      resolve(payload.toString());
    });
  });
}

async function probe(url) {
  const topic = `homeworktracker/probe-${randomBytes(4).toString("hex")}`;
  const first = JSON.stringify({ probe: 1, at: Date.now() });
  const second = JSON.stringify({ probe: 2, at: Date.now() });
  const echo = JSON.stringify({ probe: 3, at: Date.now() });
  const result = { url, retained: false, realtime: false, echo: false, error: "" };

  let a;
  let b;
  let c;
  try {
    // 1. Someone synced a board earlier and went offline — retained publish.
    a = await open(url);
    await a.publishAsync(topic, first, { qos: 1, retain: true });
    a.end(true);

    // 2. A fresh device joins: the retained board must arrive on subscribe.
    b = await open(url);
    await b.subscribeAsync(topic, { qos: 1 });
    result.retained = (await nextMessage(b)) === first;

    // 3. A second device updates while we are online: realtime delivery.
    c = await open(url);
    const realtime = nextMessage(b);
    await c.publishAsync(topic, second, { qos: 1, retain: true });
    result.realtime = (await realtime) === second;
    c.end(true);

    // 4. Informational — does the broker echo our own publish back to us?
    const echoWatch = nextMessage(b, 1500).then(() => true, () => false);
    await b.publishAsync(topic, echo, { qos: 1, retain: true });
    result.echo = await echoWatch;
    b.end(true);
  } catch (err) {
    result.error = String((err && err.message) || err);
    for (const client of [a, b, c]) {
      try {
        if (client) client.end(true);
      } catch {
        /* already closed */
      }
    }
  }
  return result;
}

let passed = 0;
for (const url of BROKERS) {
  process.stdout.write(`probing ${url} … `);
  const r = await probe(url);
  if (r.error) {
    console.log(`FAIL (${r.error})`);
  } else {
    const ok = r.retained && r.realtime;
    if (ok) passed += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  retained=${r.retained} realtime=${r.realtime} echo=${r.echo}`
    );
  }
}

console.log(passed > 0 ? `\n${passed}/${BROKERS.length} broker(s) usable for sync.` : "\nNo usable broker.");
process.exit(passed > 0 ? 0 : 1);
