// cloud.jsx — cross-device sync for the homework board.
//
// CloudSync is an invisible component: while signed in with a Google account
// it pulls the account's board from Convex (reactive), merges it with the
// local board on first sign-in, and pushes local edits back (debounced).
// localStorage stays the offline source of truth — when signed out nothing
// changes about the local-only experience.
//
// Sync model: whole-board document per account, last-writer-wins. While
// local edits are pending (not yet pushed) incoming server updates are
// ignored so a slow network can never clobber what you just typed; once
// pushed, later server updates fast-forward the board.
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { api } from "./convex/_generated/api.js";
import { mergeBoards, snapshot } from "./sync.js";

const PUSH_DEBOUNCE_MS = 500;

export function CloudSync({ tasks, subjects, settings, onApplyRemote }) {
  const { isAuthenticated } = useConvexAuth();
  const remote = useQuery(api.userData.get, isAuthenticated ? {} : "skip");
  const save = useMutation(api.userData.save);

  // Last board state that is known to match the server copy.
  const baseline = useRef(null);
  // Whether the first pull/upload for this sign-in has happened.
  const settled = useRef(false);

  const board = { tasks, subjects, settings };
  const snap = snapshot(board);

  // ── Pull: react to server-side changes ──
  useEffect(() => {
    if (!isAuthenticated) {
      baseline.current = null;
      settled.current = false;
      return;
    }
    if (remote === undefined) return; // still loading
    if (!settled.current) {
      settled.current = true;
      if (remote === null) {
        // First sign-in for this account: upload the local board as-is.
        baseline.current = snap;
        save({ tasks, subjects, settings }).catch(() => {
          baseline.current = null; // retry on the next local change
        });
      } else {
        // The account already has a board: merge so nothing local is lost,
        // then store the merged result.
        const merged = mergeBoards({ tasks, subjects, settings }, remote);
        baseline.current = snapshot(merged);
        onApplyRemote(merged);
        save(merged).catch(() => {
          baseline.current = null;
        });
      }
      return;
    }
    // Later server updates: fast-forward only when there are no unsaved
    // local edits (their pending push would otherwise be clobbered).
    if (snap === baseline.current) {
      const next = { tasks: remote.tasks, subjects: remote.subjects, settings: remote.settings };
      baseline.current = snapshot(next);
      onApplyRemote(next);
    }
  }, [remote, isAuthenticated]);

  // ── Push: debounce local edits up to the server ──
  useEffect(() => {
    if (!isAuthenticated || remote === undefined) return;
    if (snap === baseline.current) return;
    const timer = setTimeout(() => {
      baseline.current = snap;
      save({ tasks, subjects, settings }).catch(() => {
        baseline.current = null; // retry on the next local change
      });
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [snap, isAuthenticated, remote === undefined]);

  return null;
}

export function SyncButton({ onMessage }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const [busy, setBusy] = useState(false);
  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setBusy(true);
          signIn("google", { redirectTo: window.location.href })
            .catch(() => {
              setBusy(false);
              if (onMessage) onMessage("Cloud sync isn't set up yet — check the deployment settings.", "error");
            });
        }}
        disabled={busy}
        title="Sign in with Google to back up your homework and sync it across devices"
        aria-label="Sign in with Google to sync your homework across devices"
      >
        ☁ Sign in
      </button>
    );
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        if (!confirm("Sign out? Your homework stays on this device and in your Google account.")) return;
        setBusy(true);
        signOut().finally(() => setBusy(false));
      }}
      disabled={busy}
      title="Signed in — your homework syncs across devices. Click to sign out."
      aria-label="Signed in with Google, data synced across devices. Click to sign out."
    >
      ☁ Synced · Sign out
    </button>
  );
}
