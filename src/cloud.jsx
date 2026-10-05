// cloud.jsx — cross-device sync for the homework board, without accounts.
//
// Devices pair with a shared sync code: every device that enters the same
// code reads and writes the same board through the public relay in
// relay.js — no sign-in, no API keys, no configuration. SyncControl owns the
// whole flow — the sync engine, the header button and the pairing dialog.
//
// Sync model: whole-board document per code, last-writer-wins. On first
// join the local board is merged with the shared board so nothing on the
// device is lost. While local edits are pending (not yet pushed) incoming
// relay updates are ignored so a slow network can never clobber what you
// just typed; once pushed, later relay updates fast-forward the board.
// localStorage stays the offline source of truth when not syncing, and a
// lost connection only pauses sync — the queue flushes on reconnect.
import { useEffect, useRef, useState } from "react";
import { openBoard } from "./relay.js";
import { mergeBoards, snapshot, normalizeSyncCode, newSyncCode } from "./sync.js";

const PUSH_DEBOUNCE_MS = 500;
const CODE_STORAGE_KEY = "hw_sync_code";

function loadCode() {
  try {
    return normalizeSyncCode(localStorage.getItem(CODE_STORAGE_KEY));
  } catch {
    return "";
  }
}

function storeCode(code) {
  try {
    if (code) localStorage.setItem(CODE_STORAGE_KEY, code);
    else localStorage.removeItem(CODE_STORAGE_KEY);
  } catch {
    /* storage blocked — sync code just won't persist */
  }
}

export function SyncControl({ tasks, subjects, settings, onApplyRemote, onMessage }) {
  const [code, setCode] = useState(loadCode);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  // Shared copy from the relay: undefined = first pull still in flight,
  // null = this code has no shared copy yet, object = the shared board.
  const [remote, setRemote] = useState(undefined);
  // Relay connection: "connecting" | "online" | "offline".
  const [conn, setConn] = useState("connecting");

  // Last board state that is known to match the shared copy.
  const baseline = useRef(null);
  // Whether the first pull/upload for this code has happened.
  const settled = useRef(false);
  // The live relay session for the current code.
  const relay = useRef(null);

  const board = { tasks, subjects, settings };
  const snap = snapshot(board);

  // ── Session: joining, leaving or switching codes starts fresh ──
  useEffect(() => {
    baseline.current = null;
    settled.current = false;
    setRemote(undefined);
    if (!code) return;
    setConn("connecting");
    const session = openBoard(code, {
      onBoard: (b) => setRemote(b),
      onStatus: (s) => setConn(s),
    });
    relay.current = session;
    return () => {
      relay.current = null;
      session.close();
    };
  }, [code]);

  // ── Pull: react to changes made on other devices ──
  useEffect(() => {
    if (!code) return;
    if (remote === undefined) return; // still loading
    if (!settled.current) {
      settled.current = true;
      if (remote === null) {
        // Fresh code: upload this device's board as the shared copy.
        baseline.current = snap;
        relay.current && relay.current.publish(snap);
      } else {
        // The code already has a board: merge so nothing local is lost,
        // then store the merged result.
        const merged = mergeBoards({ tasks, subjects, settings }, remote);
        const mergedSnap = snapshot(merged);
        baseline.current = mergedSnap;
        onApplyRemote(merged);
        relay.current && relay.current.publish(mergedSnap);
      }
      return;
    }
    // Later updates: fast-forward only when there are no unsaved local
    // edits (their pending push would otherwise be clobbered).
    if (remote === null) return; // still nothing on the relay
    const next = { tasks: remote.tasks, subjects: remote.subjects, settings: remote.settings };
    const remoteSnap = snapshot(next);
    if (remoteSnap === baseline.current) return; // echo of our own push
    if (snap === baseline.current) {
      baseline.current = remoteSnap;
      onApplyRemote(next);
    }
  }, [remote, code]);

  // ── Push: debounce local edits up to the shared board ──
  useEffect(() => {
    if (!code || remote === undefined) return;
    if (snap === baseline.current) return;
    const timer = setTimeout(() => {
      baseline.current = snap;
      relay.current && relay.current.publish(snap);
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [snap, code, remote]);

  // ── Dialog: Esc closes ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const join = (raw) => {
    const next = normalizeSyncCode(raw);
    if (next.length < 4) {
      if (onMessage) onMessage("Sync codes are at least 4 letters or digits.", "error");
      return;
    }
    storeCode(next);
    setCode(next);
    setOpen(false);
    setInput("");
    if (onMessage) onMessage(`☁ Syncing with code ${next}`, "success");
  };

  const stop = () => {
    storeCode("");
    setCode("");
    setOpen(false);
    if (onMessage) onMessage("Sync stopped — your homework stays on this device.", "");
  };

  const copyCode = () => {
    const done = () => onMessage && onMessage("Sync code copied ✓", "success");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => {});
    }
  };

  const label = !code ? "Sync" : conn === "online" ? "Syncing" : conn === "offline" ? "Offline" : "Connecting…";
  const buttonTitle = !code
    ? "Sync your homework across devices — no account needed"
    : conn === "online"
      ? `Syncing across devices with code ${code}. Click to manage.`
      : conn === "offline"
        ? `Sync relay offline — edits are saved on this device and will sync when you're back online (code ${code}).`
        : `Connecting to the sync relay (code ${code})…`;
  const buttonLabel = !code
    ? "Set up cloud sync across devices"
    : conn === "online"
      ? `Cloud sync on with code ${code}. Click to manage sync.`
      : conn === "offline"
        ? `Cloud sync reconnecting for code ${code}. Your edits are saved on this device.`
        : `Connecting cloud sync for code ${code}.`;

  return (
    <>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen(true)}
        title={buttonTitle}
        aria-label={buttonLabel}
      >
        ☁ {label}
      </button>

      {open && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)} role="dialog" aria-modal="true" aria-labelledby="sync-modal-title">
          <div className="modal">
            <h2 className="modal-title" id="sync-modal-title">
              ☁ Cloud Sync
            </h2>
            {code ? (
              <>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label htmlFor="sync-code-display">Sync code</label>
                  <input
                    id="sync-code-display"
                    value={code}
                    readOnly
                    onFocus={(e) => e.target.select()}
                    aria-describedby="sync-code-hint"
                  />
                </div>
                <p id="sync-code-hint" className="task-note" style={{ marginBottom: 16 }}>
                  Every device that enters this code shares this homework board. Boards travel through a public
                  sync relay, so treat the code like a password — don't post it anywhere public.
                </p>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={stop}>
                    Stop syncing
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={copyCode}>
                    Copy code
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  join(input);
                }}
              >
                <p className="task-note" style={{ marginBottom: 16 }}>
                  Keep your homework in sync on every device — no account, no sign-in, no setup. Enter the sync
                  code shown on another device, or create a new code to start a shared board. This device's
                  homework is merged in, so nothing is lost.
                </p>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label htmlFor="sync-code-input">Sync code</label>
                  <input
                    id="sync-code-input"
                    placeholder="e.g. k3m9xq2apt"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => join(newSyncCode())}>
                    Create a new code
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Sync with this code
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
